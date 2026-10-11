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
        find: () => ({ sort: () => ({ toArray: async () => [...rows].reverse() }) }),
        findOneAndUpdate: async (query, update, options) => {
          let row = rows.find(row => matches(row, query));
          if (!row && options.upsert) { row = { ...query, value: 0 }; rows.push(row); }
          if (!row) return null;
          if (update.$inc) row.value += update.$inc.value;
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
  const update = {estado:'Presupuesto enviado',notas:'Llamar mañana',fechaTrabajo:'2026-10-24',archivada:true};
  assert.equal((await call(`/api/encuestas/${row.id}`, 'PATCH', {...update, fechaTrabajo:'2026-02-30'})).response.status,400);
  assert.equal((await call(`/api/encuestas/${row.id}`, 'PATCH', update, {Origin:'https://evil.example'})).response.status,403);
  const changed = await call(`/api/encuestas/${row.id}`, 'PATCH', update);
  assert.equal(changed.response.status,200); assert.equal(changed.data.encuesta.archivada,true);
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
