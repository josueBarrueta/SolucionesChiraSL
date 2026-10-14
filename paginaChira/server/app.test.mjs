import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp, validateSubmission, validDate } from './app.mjs';
import { createManagement } from './management.mjs';
import { hashPassword, verifyPassword } from './security.mjs';

function memoryDb() {
  const collections = new Map();
  function matches(row, query) {
    return Object.entries(query).every(([key, value]) => {
      if (value?.$gt) return row[key] > value.$gt;
      return String(row[key]) === String(value);
    });
  }
  return {
    command: async () => ({ ok: 1 }),
    collection(name) {
      if (collections.has(name)) return collections.get(name);
      const rows = [];
      const collection = {
        findOne: async query => rows.find(row => matches(row, query)) ?? null,
        insertOne: async data => {
          const row = { _id: new ObjectId(), ...data };
          rows.push(row); return { insertedId: row._id };
        },
        deleteOne: async query => {
          const i = rows.findIndex(row => matches(row, query));
          if (i !== -1) rows.splice(i, 1);
        },
        find: (query = {}) => { const selected = () => rows.filter(row => matches(row, query)); return { toArray: async () => selected(), sort: () => ({ toArray: async () => selected().reverse() }) }; },
        findOneAndUpdate: async (query, update, options) => {
          let row = rows.find(row => matches(row, query));
          if (!row && options.upsert) { row = { _id: new ObjectId(), ...query, ...update.$setOnInsert }; rows.push(row); }
          if (!row) return null;
          if (update.$inc) for (const [key, value] of Object.entries(update.$inc)) row[key] = (row[key] ?? 0) + value;
          if (update.$push) for (const [key, value] of Object.entries(update.$push)) (row[key] ??= []).push(value);
          if (update.$set) Object.assign(row, update.$set);
          return { ...row };
        }
      };
      collections.set(name, collection); return collection;
    }
  };
}
const submission = {
  firstName: 'Prueba', lastName: 'Local', email: 'prueba@example.com',
  phone: '+34600000000', services: ['Mudanzas', 'Limpieza'], location: 'Valencia',
  street: '', postalCode: '', floor: '', door: '', staircase: '',
  message: 'Solicitud de prueba sin datos personales reales.', details: {}, website: ''
};

test('valida formulario, varios servicios y fechas reales', () => {
  const data = validateSubmission(submission);
  assert.equal(data.estado, 'Nueva'); assert.equal(data.archivada, false);
  assert.equal(data.servicios.length, 2); assert.equal(data.respuestas.length, 10);
  assert.throws(() => validateSubmission({ ...submission, services: ['Servicio inventado'] }));
  assert.throws(() => validateSubmission({ ...submission, phone: '123' }));
  assert.throws(() => validateSubmission({ ...submission, message: 'breve' }));
  assert.throws(() => validateSubmission({ ...submission, email: '<script>' }));
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2026-10-11'), true);
});

test('contraseña almacenada como hash y comprobación correcta', async () => {
  const hash = await hashPassword('contraseña-solo-para-test');
  assert.equal(await verifyPassword('contraseña-solo-para-test', hash), true);
  assert.equal(await verifyPassword('incorrecta', hash), false);
});

test('API: login, permiso, envío sin duplicados, edición, archivo y cierre de sesión', async t => {
  const db = memoryDb();
  const app = createApp({ db, origins: ['http://localhost:4200'], adminEmail: 'test@example.com', passwordHash: await hashPassword('contraseña-solo-para-test') });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${app.address().port}`;
  let cookie = '';
  async function call(path, method = 'GET', body, extra = {}) {
    const response = await fetch(base + path, {method, headers: {
      Origin: 'http://localhost:4200', Cookie: cookie, 'Content-Type': 'application/json', ...extra
    }, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    return { response, data: await response.json() };
  }
  assert.equal((await call('/api/encuestas')).response.status, 401);
  assert.equal((await call('/api/login', 'POST', {username: 'test@example.com', password: 'bad'})).response.status, 401);
  assert.equal((await call('/api/login', 'POST', {username: 'test@example.com', password: 'contraseña-solo-para-test'}, {Origin: 'https://evil.example'})).response.status, 403);
  const key = 'fd1f3dd0-2a64-4fe1-a95f-bfcb24fd8cd2';
  const sent = await call('/api/encuestas', 'POST', { ...submission, estado: 'Aceptado', notas: 'inyección' }, {'Idempotency-Key': key});
  assert.equal(sent.response.status, 201);
  const retry = await call('/api/encuestas', 'POST', submission, {'Idempotency-Key':key});
  assert.equal(retry.data.referencia, sent.data.referencia);
  const preflight = await fetch(base + '/api/encuestas', { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'PATCH',
    'Access-Control-Request-Headers': 'Authorization, Content-Type'
  } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:4200');
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  assert.equal((await fetch(base + '/api/encuestas', {method:'OPTIONS',headers:{Origin:'https://evil.example'}})).status,403);
  const logged = await call('/api/login', 'POST', {username:'test@example.com',password:'contraseña-solo-para-test'});
  assert.equal(logged.response.status, 200);
  const header = logged.response.headers.get('set-cookie');
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/);
  assert.equal(typeof logged.data.token, 'string');
  const bearer = await call('/api/session', 'GET', undefined, {Authorization:`Bearer ${logged.data.token}`});
  assert.equal(bearer.response.status, 200);
  cookie = header.split(';')[0];
  assert.equal((await call('/api/session')).response.status,200);
  let listed = await call('/api/encuestas');
  assert.equal(listed.data.encuestas.length, 1);
  const row = listed.data.encuestas[0];
  assert.equal(row.estado, 'Nueva'); assert.equal(row.notas, ''); assert.equal(row.submissionKey, undefined);
  const update = {estado:'Contactado',notas:'Llamar mañana',fechaTrabajo:'2026-10-24',archivada:true};
  assert.equal((await call(`/api/encuestas/${row.id}`, 'PATCH', {...update, fechaTrabajo:'2026-02-30'})).response.status,400);
  assert.equal((await call(`/api/encuestas/${row.id}`, 'PATCH', update, {Origin:'https://evil.example'})).response.status,403);
  const changed = await call(`/api/encuestas/${row.id}`, 'PATCH', update);
  assert.equal(changed.response.status,200); assert.equal(changed.data.encuesta.estado, 'Contactado'); assert.equal(changed.data.encuesta.archivada,true);
  listed = await call('/api/encuestas'); assert.equal(listed.data.encuestas[0].notas, 'Llamar mañana');
  assert.equal((await call('/api/logout','POST',{})).response.status,200);
  assert.equal((await call('/api/encuestas')).response.status,401);
  assert.equal((await call('/api/session','GET',undefined,{Authorization:`Bearer ${logged.data.token}`})).response.status,401);
  assert.equal((await call(`/api/encuestas/${row.id}`, 'PATCH', update)).response.status,401);
});

test('web y API bajo el mismo dominio, sin exponer archivos privados', async t => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'chira-web-test-'));
  await writeFile(join(directory, 'index.html'), '<html>Chira test</html>');
  await writeFile(join(directory, '.env'), 'private=test');
  const app = createApp({ db: memoryDb(), origins: ['http://localhost:4200'], adminEmail: 'test@example.com', passwordHash: await hashPassword('test-password'), webDirectory: directory });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }); await rm(directory, {recursive:true}); });
  const base = `http://127.0.0.1:${app.address().port}`;
  const web = await fetch(base + '/admin/encuestas');
  assert.equal(web.status, 200); assert.match(await web.text(), /Chira test/);
  assert.equal((await fetch(base+'/.env')).status,404);
  assert.equal((await fetch(base+'/api/encuestas')).status,401);
});

test('gestión: importación sin duplicados, relaciones, importes, emisión inmutable y pagos', async t => {
  const db = memoryDb();
  const app = createApp({ db, origins: ['http://localhost:4200'], adminEmail: 'test@example.com', passwordHash: await hashPassword('management-test-password') });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${app.address().port}`;
  let token = '';
  async function call(path, method='GET', body) {
    const response = await fetch(base+path, { method, headers: {Origin:'http://localhost:4200','Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}, ...(body===undefined?{}:{body:JSON.stringify(body)}) });
    return {status:response.status,body:await response.json()};
  }
  for (const name of ['clientes','trabajos','equipo','gastos','facturas','presupuestos','configuracion']) assert.equal((await call('/api/gestion/'+name)).status,401);
  token=(await call('/api/login','POST',{username:'test@example.com',password:'management-test-password'})).body.token;
  const survey = {...validateSubmission(submission),_id:new ObjectId(),referencia:'CHI-TEST',estado:'Aceptada',fechaTrabajo:'2026-10-24'};
  await db.collection('encuestas').insertOne(survey);
  assert.equal((await call('/api/gestion/sincronizar','POST',{})).status,200);
  await call('/api/gestion/sincronizar','POST',{});
  const clients=(await call('/api/gestion/clientes')).body.registros;
  const jobs=(await call('/api/gestion/trabajos')).body.registros;
  assert.equal(clients.length,1);assert.equal(jobs.length,1);assert.equal(jobs[0].fecha,'2026-10-24');assert.equal(jobs[0].clienteId,clients[0].id);
  const changedSurvey = {...survey,estado:'Aceptada',archivada:false,notas:'Recordatorio',fechaTrabajo:'2026-10-25'};
  assert.equal((await call('/api/encuestas/'+survey._id,'PATCH',changedSurvey)).status,200);
  let currentJob=(await call('/api/gestion/trabajos')).body.registros[0];
  assert.equal(currentJob.fecha,'2026-10-25');assert.equal(currentJob.notas,'Recordatorio');
  currentJob.fecha='2026-10-26';
  assert.equal((await call('/api/gestion/trabajos/'+currentJob.id,'PATCH',currentJob)).status,200);
  await call('/api/encuestas/'+survey._id,'PATCH',{...changedSurvey,fechaTrabajo:'2026-10-27'});
  assert.equal((await call('/api/gestion/trabajos')).body.registros[0].fecha,'2026-10-26');
  for(const name of ['equipo','presupuestos']) {
    assert.equal((await call('/api/gestion/'+name)).status,404);
    assert.equal((await call('/api/gestion/'+name,'POST',{nombre:'Apartado retirado'})).status,404);
  }
  const manual=await call('/api/gestion/trabajos','POST',{titulo:'Trabajo manual',clienteId:clients[0].id,estado:'Pendiente',fecha:'2026-10-28'});
  assert.equal(manual.status,201);
  const client={...clients[0],nif:'TEST-NIF',direccion:'Dirección de prueba'};
  assert.equal((await call('/api/gestion/clientes/'+client.id,'PATCH',client)).status,200);
  assert.equal((await call('/api/gestion/trabajos','POST',{titulo:'Prueba',estado:'Pendiente',clienteId:new ObjectId().toString()})).status,404);
  const expense=await call('/api/gestion/gastos','POST',{concepto:'Material',fecha:'2026-10-12',categoria:'Materiales',importe:12.34,trabajoId:jobs[0].id});assert.equal(expense.status,201);assert.equal(expense.body.registro.importeCentimos,1234);
  assert.equal((await call('/api/gestion/gastos','POST',{concepto:'Material',fecha:'2026-02-30',categoria:'Materiales',importe:12})).status,400);
  const draft={clienteId:client.id,trabajoId:jobs[0].id,fecha:'2026-10-12',vencimiento:'2026-10-30',estado:'Borrador',lineas:[{concepto:'Trabajo',cantidad:2,precio:10.25,iva:21}],notas:'Condiciones'};
  assert.equal((await call('/api/gestion/facturas','POST',{...draft,lineas:[{concepto:'x',cantidad:1,precio:2,iva:null}]})).status,400);
  const created=await call('/api/gestion/facturas','POST',draft);assert.equal(created.status,201);const invoice=created.body.registro;assert.equal(invoice.totalCentimos,2481);
  assert.equal((await call('/api/gestion/configuracion','PATCH',{nombre:'Empresa de prueba',nif:'TEST-CIF',direccion:'Dirección fiscal de prueba',ivaPredeterminado:21})).status,200);
  const issued=await call(`/api/gestion/facturas/${invoice.id}/emitir`,'POST',{});assert.equal(issued.status,200);assert.match(issued.body.registro.referencia,/^FAC-\d{4}-000001$/);assert.equal(issued.body.registro.cliente.nif,'TEST-NIF');
  assert.equal((await call(`/api/gestion/facturas/${invoice.id}/emitir`,'POST',{})).body.registro.referencia,issued.body.registro.referencia);
  assert.equal((await call(`/api/gestion/facturas/${invoice.id}`,'PATCH',draft)).status,400);
  assert.equal((await call(`/api/gestion/facturas/${invoice.id}/pago`,'POST',{importe:25,fecha:'2026-10-12',metodo:'Transferencia'})).status,400);
  for (const importe of [0.001, 0.005, 1.001, 10.999]) {
    assert.equal((await call(`/api/gestion/facturas/${invoice.id}/pago`,'POST',{importe,fecha:'2026-10-12',metodo:'Transferencia'})).status,400);
    assert.equal((await call('/api/gestion/gastos','POST',{concepto:'Precisión inválida',fecha:'2026-10-12',categoria:'Otros',importe})).status,400);
  }
  const untouched=(await call('/api/gestion/facturas')).body.registros.find(row=>row.id===invoice.id);
  assert.equal(untouched.pagadoCentimos,0);assert.equal(untouched.pagos.length,0);
  for (const importe of [0.01, 0.29, 30.50, 1000000]) {
    const expense=await call('/api/gestion/gastos','POST',{concepto:'Precisión válida',fecha:'2026-10-12',categoria:'Otros',importe});
    assert.equal(expense.status,201);assert.equal(expense.body.registro.importeCentimos,Math.round(importe*100));
  }
  const paid=await call(`/api/gestion/facturas/${invoice.id}/pago`,'POST',{importe:10,fecha:'2026-10-12',metodo:'Transferencia'});assert.equal(paid.status,200);assert.equal(paid.body.registro.pagadoCentimos,1000);assert.equal(paid.body.registro.pagos.length,1);
  assert.equal((await call('/api/gestion/contrasena','POST',{actual:'bad',nueva:'otra-password-test'})).status,400);
  assert.equal((await call('/api/gestion/contrasena','POST',{actual:'management-test-password',nueva:'otra-password-test'})).status,200);
  assert.equal((await call('/api/login','POST',{username:'test@example.com',password:'management-test-password'})).status,401);
  assert.equal((await call('/api/login','POST',{username:'test@example.com',password:'otra-password-test'})).status,200);
});


test('encuesta nueva: cliente y trabajo automáticos, reintentos y cambios manuales', async () => {
  const db = memoryDb();
  const management = createManagement(db);
  const survey = { ...validateSubmission(submission), _id: new ObjectId(), fecha: '2026-10-13', referencia: 'CHI-AUTO', respuestas: [{pregunta: 'Accesos', respuesta: 'Ascensor'}] };
  await Promise.all([management.syncSurvey(survey), management.syncSurvey(survey)]);
  const clients = await db.collection('clientes').find({}).toArray();
  const jobs = await db.collection('trabajos').find({}).toArray();
  assert.equal(clients.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].estado, 'Pendiente');
  assert.equal(jobs[0].tareas, 'Accesos: Ascensor');
  assert.equal(jobs[0].clienteId, clients[0]._id.toString());
  await db.collection('trabajos').findOneAndUpdate({_id: jobs[0]._id}, {$set: {estado: 'Finalizado', fecha: '2026-10-20', notas: 'Dato manual'}}, {});
  await management.syncSurvey({...survey, fechaTrabajo: '2026-10-22', notas: 'Cambio de encuesta'});
  const saved = await db.collection('trabajos').findOne({_id: jobs[0]._id});
  assert.equal(saved.estado, 'Finalizado');
  assert.equal(saved.fecha, '2026-10-20');
  assert.equal(saved.notas, 'Dato manual');
  await management.syncSurvey({...survey, _id: new ObjectId()});
  assert.equal((await db.collection('clientes').find({}).toArray()).length, 1);
  assert.equal((await db.collection('trabajos').find({}).toArray()).length, 2);
});

test('encuestas anteriores se importan al abrir gestión, sin duplicados', async () => {
  const db = memoryDb();
  await db.collection('encuestas').insertOne({...validateSubmission(submission), referencia: 'CHI-ANTERIOR'});
  const management = createManagement(db);
  const [clients, jobs] = await Promise.all([
    management.handle('/api/gestion/clientes', 'GET'),
    management.handle('/api/gestion/trabajos', 'GET')
  ]);
  assert.equal(clients.body.registros.length, 1);
  assert.equal(jobs.body.registros.length, 1);
  await management.handle('/api/gestion/trabajos', 'GET');
  assert.equal((await db.collection('trabajos').find({}).toArray()).length, 1);
});


test('finalizar trabajo actualiza la encuesta y mantiene el vínculo para facturar', async () => {
  const db = memoryDb();
  const management = createManagement(db);
  const survey = {...validateSubmission(submission), referencia: 'CHI-FINAL'};
  const result = await db.collection('encuestas').insertOne(survey);
  await management.syncSurvey(await db.collection('encuestas').findOne({_id: result.insertedId}));
  const job = (await management.handle('/api/gestion/trabajos', 'GET')).body.registros[0];
  const saved = await management.handle('/api/gestion/trabajos/' + job.id, 'PATCH', async () => ({...job, estado: 'Finalizado', fecha: '2026-10-20'}));
  assert.equal(saved.body.registro.estado, 'Finalizado');
  const source = await db.collection('encuestas').findOne({_id: result.insertedId});
  assert.equal(source.estado, 'Finalizada');
  assert.equal(source.fechaTrabajo, '2026-10-20');
});

async function modernSubmission(services = ['Portes']) {
  const { SERVICE_QUESTIONS } = await import('../src/app/formulario/formulario.questions.ts');
  const details = {};
  for (const block of SERVICE_QUESTIONS.filter(b => services.includes(b.service))) {
    for (const field of block.fields) details[field.name] = field.required ? field.options?.[0] ?? 'Prueba' : '';
    details[`${block.slug}_count`] = '2';
    details[`${block.slug}_item_1_name`] = 'Sofá';
    details[`${block.slug}_item_2_name`] = 'Mesa';
    for (const [index, address] of block.addresses.entries()) {
      const values = {locality: 'Valencia', street: index ? 'Calle Destino' : 'Calle Origen', number: '24', postcode:'46001', floor:'3', door:'B', staircase:'2', lift:'Sí', access:''};
      for (const [key, value] of Object.entries(values)) details[`${address.prefix}_${key}`] = value;
    }
  }
  return {...submission, services, questionnaireVersion:2, details};
}

test('nueva encuesta: direcciones distintas, objetos y campos obligatorios', async () => {
  const body = await modernSubmission();
  const data = validateSubmission({...body, location:'Dirección manipulada'});
  assert.equal(data.localidad, 'Valencia');
  assert.equal(data.direccion, 'Calle Origen, 24');
  assert.equal(data.detalles.portes_destination_street, 'Calle Destino');
  assert.ok(data.respuestas.some(r => r.pregunta.includes('Objeto 2') && r.respuesta === 'Mesa'));
  assert.ok(data.respuestas.some(r => r.pregunta.includes('Dirección de entrega: Calle') && r.respuesta === 'Calle Destino'));
  for (const [key, value] of [['portes_count','0'],['portes_count','101'],['portes_count','1.5'],['portes_item_2_name',' '],['portes_origin_postcode','4600'],['portes_origin_floor','']]) {
    assert.throws(() => validateSubmission({...body,details:{...body.details,[key]:value}}), key);
  }
  const reduced = validateSubmission({...body,details:{...body.details,portes_count:'1',pintura_item_1_name:'Dato ajeno'}});
  assert.equal(reduced.detalles.portes_item_2_name, undefined);
  assert.equal(reduced.detalles.pintura_item_1_name, undefined);
});

test('los seis servicios conservan sus datos y vaciado completo no exige lista', async () => {
  const services = ['Portes','Montaje de muebles','Mudanzas','Vaciados','Limpieza','Pintura'];
  const body = await modernSubmission(services);
  const data = validateSubmission(body);
  assert.equal(data.servicios.length,6);
  assert.equal(data.detalles.pintura_item_2_name,'Mesa');
  const whole = await modernSubmission(['Vaciados']);
  whole.details.vaciados_mode = 'Todo el espacio';
  whole.details.vaciados_count = '0';
  whole.details.vaciados_item_1_name = '';
  const validated = validateSubmission(whole);
  assert.equal(validated.detalles.vaciados_count,undefined);
  assert.equal(validated.detalles.vaciados_item_2_name,undefined);
});

test('encuesta ampliada crea trabajo editable, cliente y conserva todos los objetos sin duplicados', async () => {
  const body = await modernSubmission();
  body.details.portes_count = '100';
  for(let i=1;i<=100;i++) body.details[`portes_item_${i}_name`] = `Objeto ${i} ${'x'.repeat(270)}`;
  const survey = {...validateSubmission(body),_id:new ObjectId(),referencia:'CHI-NUEVA'};
  const db = memoryDb();
  await db.collection('encuestas').insertOne(survey);
  const management = createManagement(db);
  await management.syncSurvey(survey);
  await management.syncSurvey(survey);
  const jobs = await db.collection('trabajos').find().toArray();
  const clients = await db.collection('clientes').find().toArray();
  assert.equal(jobs.length,1);assert.equal(clients.length,1);
  assert.match(jobs[0].direccion,/Planta: 3.*Puerta: B.*46001 Valencia/);
  assert.match(clients[0].direccion,/Puerta: B/);
  assert.ok(jobs[0].tareas.length < 3000);
  assert.equal(survey.detalles.portes_item_100_name,body.details.portes_item_100_name);
  assert.equal(jobs[0].encuestaId,survey._id.toString());
  const changed = await management.handle(`/api/gestion/trabajos/${jobs[0]._id}`, 'PATCH', async () => ({...jobs[0],estado:'Finalizado',notas:'Revisado manualmente'}));
  assert.equal(changed.status,200);
  await management.syncSurvey(survey);
  const saved = await db.collection('trabajos').findOne({_id:jobs[0]._id});
  assert.equal(saved.notas,'Revisado manualmente');
  assert.equal(saved.estado,'Finalizado');
});

test('Derribos: admite todos los servicios y exige alcance, ubicación y consulta de escombros', async () => {
  const body = await modernSubmission(['Derribos']);
  Object.assign(body.details, {derribos_scope:'Valorar dos zonas, conservando la entrada',derribos_item_1_name:'Zona interior',derribos_item_2_name:'Revestimiento',derribos_surface:'12,5',derribos_rubble:'Sí, quiero consultarla'});
  const data = validateSubmission(body);
  assert.equal(data.detalles.derribos_surface,'12,5');
  assert.equal(data.detalles.derribos_rubble,'Sí, quiero consultarla');
  assert.ok(data.respuestas.some(r => r.pregunta.includes('Elemento o zona 2') && r.respuesta==='Revestimiento'));
  for (const [key,value] of [['derribos_scope',''],['derribos_location_street',''],['derribos_rubble','Incluida'],['derribos_surface','-1']]) {
    assert.throws(() => validateSubmission({...body, details:{...body.details,[key]:value}}));
  }
  const {SERVICE_QUESTIONS} = await import('../src/app/formulario/formulario.questions.ts');
  const all = await modernSubmission([...SERVICE_QUESTIONS.map(b=>b.service),'Otra consulta']);
  assert.equal(validateSubmission(all).servicios.length,8);
});

test('API Derribos: envío crea cliente/trabajo sin duplicados, respuestas y fecha acordada', async t => {
  const db=memoryDb();
  const app=createApp({db,origins:['http://localhost:4200'],adminEmail:'test@example.com',passwordHash:await hashPassword('derribos-test-password')});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const base=`http://127.0.0.1:${app.address().port}`;
  let token='';
  async function call(path,method='GET',body,extra={}) {
    const response=await fetch(base+path,{method,headers:{Origin:'http://localhost:4200','Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  }
  const body=await modernSubmission(['Derribos']);
  Object.assign(body.details,{derribos_scope:'Consulta de derribo de una zona interior',derribos_item_1_name:'Zona del local',derribos_item_2_name:'Revestimiento de pared',derribos_surface:'18',derribos_rubble:'No lo sé todavía'});
  const key='c88a819a-cace-48e9-8f09-c6011492e141';
  assert.equal((await call('/api/encuestas','POST',body,{'Idempotency-Key':key})).status,201);
  await call('/api/encuestas','POST',body,{'Idempotency-Key':key});
  token=(await call('/api/login','POST',{username:'test@example.com',password:'derribos-test-password'})).body.token;
  const surveys=(await call('/api/encuestas')).body.encuestas;
  const clients=(await call('/api/gestion/clientes')).body.registros;
  const jobs=(await call('/api/gestion/trabajos')).body.registros;
  assert.equal(surveys.length,1);assert.equal(clients.length,1);assert.equal(jobs.length,1);
  assert.equal(jobs[0].titulo,'Derribos');assert.equal(jobs[0].estado,'Pendiente');assert.equal(jobs[0].fecha,'');
  assert.equal(jobs[0].clienteId,clients[0].id);assert.equal(jobs[0].encuestaId,surveys[0].id);
  assert.ok(surveys[0].respuestas.some(r=>r.respuesta==='Revestimiento de pared'));
  assert.ok(surveys[0].respuestas.some(r=>r.pregunta.includes('escombros') && r.respuesta==='No lo sé todavía'));
  assert.match(jobs[0].direccion,/Calle Origen.*Puerta: B.*46001 Valencia/);
  const saved=await call(`/api/gestion/trabajos/${jobs[0].id}`,'PATCH',{...jobs[0],fecha:'2026-11-02',notas:'Fecha acordada con el cliente'});
  assert.equal(saved.status,200);
  assert.equal((await call('/api/encuestas')).body.encuestas[0].fechaTrabajo,'2026-11-02');
  assert.equal((await call('/api/gestion/trabajos')).body.registros.length,1);
});
