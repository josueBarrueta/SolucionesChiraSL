import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp, validateSubmission, validDate } from './app.mjs';
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
  const member=await call('/api/gestion/equipo','POST',{nombre:'Persona de prueba',funcion:'Montaje',disponibilidad:'Lunes a viernes'});
  assert.equal(member.status,201);
  const manual=await call('/api/gestion/trabajos','POST',{titulo:'Trabajo manual',clienteId:clients[0].id,estado:'Pendiente',fecha:'2026-10-28',equipoIds:[member.body.registro.id]});
  assert.equal(manual.status,201);
  const archived=await call('/api/gestion/equipo/'+member.body.registro.id,'PATCH',{...member.body.registro,archivada:true});assert.equal(archived.status,200);
  assert.equal((await call('/api/gestion/trabajos','POST',{titulo:'Asignación inválida',estado:'Pendiente',equipoIds:[member.body.registro.id]})).status,400);
  const client={...clients[0],nif:'TEST-NIF',direccion:'Dirección de prueba'};
  assert.equal((await call('/api/gestion/clientes/'+client.id,'PATCH',client)).status,200);
  assert.equal((await call('/api/gestion/trabajos','POST',{titulo:'Prueba',estado:'Pendiente',clienteId:new ObjectId().toString(),equipoIds:[]})).status,404);
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
  const paid=await call(`/api/gestion/facturas/${invoice.id}/pago`,'POST',{importe:10,fecha:'2026-10-12',metodo:'Transferencia'});assert.equal(paid.status,200);assert.equal(paid.body.registro.pagadoCentimos,1000);assert.equal(paid.body.registro.pagos.length,1);
  assert.equal((await call('/api/gestion/contrasena','POST',{actual:'bad',nueva:'otra-password-test'})).status,400);
  assert.equal((await call('/api/gestion/contrasena','POST',{actual:'management-test-password',nueva:'otra-password-test'})).status,200);
  assert.equal((await call('/api/login','POST',{username:'test@example.com',password:'management-test-password'})).status,401);
  assert.equal((await call('/api/login','POST',{username:'test@example.com',password:'otra-password-test'})).status,200);
});
