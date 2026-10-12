import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { SERVICE_QUESTIONS } from '../src/app/formulario/formulario.questions.ts';
import { verifyPassword, tokenHash, hashPassword } from './security.mjs';
import { createManagement, ManagementError } from './management.mjs';
import { serveWeb } from './web.mjs';

export const ESTADOS = ['Nueva', 'Contactado', 'Aceptada', 'Finalizada'];
const ESTADOS_ANTERIORES = { 'En revisión': 'Nueva', 'Presupuesto enviado': 'Contactado', 'Aceptado': 'Aceptada', 'Atendida': 'Finalizada' };
const SERVICIOS = [...SERVICE_QUESTIONS.map(b => b.service), 'Otra consulta'];
const COOKIE = 'chira_session';
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const invalid = message => { throw new ApiError(400, message); };
function text(value, label, max, min = 0) {
  if (value === undefined && min === 0) return '';
  if (typeof value !== 'string') return invalid(`Revisa ${label}.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) return invalid(`Revisa ${label}.`);
  return clean;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Solicitud no válida.');
  if (body.website) invalid('Solicitud no válida.');
  const firstName = text(body.firstName, 'el nombre', 100, 1);
  const lastName = text(body.lastName, 'los apellidos', 150, 1);
  const email = text(body.email, 'el correo', 254, 3);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Revisa el correo.');
  if (!Array.isArray(body.services) || !body.services.length || body.services.length > 7 ||
      body.services.some(s => !SERVICIOS.includes(s))) invalid('Revisa los servicios.');
  const services = [...new Set(body.services)];
  const phone = parsePhoneNumberFromString(text(body.phone, 'el teléfono', 35, 1));
  if (!phone?.isPossible()) invalid('Revisa el teléfono.');
  const details = body.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) invalid('Revisa los detalles.');
  const respuestas = [];
  for (const block of SERVICE_QUESTIONS.filter(b => services.includes(b.service))) {
    for (const field of block.fields) {
      const value = text(details[field.name], field.label, 300);
      if (field.type === 'select' && value && !['Sí', 'No'].includes(value)) invalid(`Revisa ${field.label}.`);
      respuestas.push({ pregunta: `${block.service} — ${field.label}`, respuesta: value || 'No indicado' });
    }
  }
  const codigoPostal = text(body.postalCode, 'el código postal', 5);
  if (codigoPostal && !/^\d{5}$/.test(codigoPostal)) invalid('Revisa el código postal.');
  return {
    nombre: `${firstName} ${lastName}`, email, telefono: phone.formatInternational(),
    telefonoInternacional: phone.number, servicios: services,
    localidad: text(body.location, 'la localidad', 120, 2),
    direccion: text(body.street, 'la dirección', 180) || 'No indicada',
    codigoPostal: codigoPostal || 'No indicado',
    piso: text(body.floor, 'el piso', 30) || 'No indicado',
    puerta: text(body.door, 'la puerta', 30) || 'No indicada',
    escalera: text(body.staircase, 'la escalera', 40) || 'No indicada',
    mensaje: text(body.message, 'la descripción', 3000, 20), respuestas,
    estado: 'Nueva', notas: '', fechaTrabajo: '', archivada: false
  };
}
function publicDocument(row) {
  const { _id, submissionKey, ...data } = row;
  return { ...data, estado: ESTADOS_ANTERIORES[data.estado] ?? data.estado, id: _id.toString() };
}
async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Se requiere JSON.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) throw new ApiError(413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new ApiError(400, 'Solicitud no válida.'); }
}

export function createApp({ db, adminEmail, passwordHash, origins, secureCookies = false, webDirectory = null }) {
  const management = createManagement(db);
  const surveys = db.collection('encuestas');
  const sessions = db.collection('sesiones');
  const counters = db.collection('contadores');
  const attempts = new Map();
  const submissions = new Map();
  function rateLimit(map, ip, limit, windowMs) {
    const now = Date.now();
    // La limpieza limita el uso de memoria y evita conservar direcciones indefinidamente.
    for (const [key, entry] of map) if (entry.expires <= now) map.delete(key);
    if (map.size >= 10000 && !map.has(ip)) throw new ApiError(429, 'Inténtalo más tarde.');
    const entry = map.get(ip) ?? { count: 0, expires: now + windowMs };
    entry.count++;
    map.set(ip, entry);
    if (entry.count > limit) throw new ApiError(429, 'Demasiados intentos. Inténtalo más tarde.');
  }
  const cookie = (token, age) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${secureCookies ? '; Secure' : ''}`;
  async function session(req) {
    const bearer = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const token = bearer ?? (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'Inicia sesión para continuar.');
    const current = await sessions.findOne({ _id: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!current) throw new ApiError(401, 'Tu sesión ha caducado. Vuelve a iniciar sesión.');
    return current;
  }
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const path = new URL(req.url, 'http://local').pathname;
      const method = req.method;
      if (!path.startsWith('/api/') && webDirectory && await serveWeb(req, res, webDirectory)) return;
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) throw new ApiError(403, 'Origen no permitido.');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      if (method === 'OPTIONS') {
        if (!origin) throw new ApiError(403, 'Origen no permitido.');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
        res.setHeader('Access-Control-Max-Age', '600');
        res.statusCode = 204; return res.end();
      }
      if (['POST', 'PATCH', 'DELETE'].includes(method) && !origin) {
        throw new ApiError(403, 'Origen no permitido.');
      }
      if (path === '/api/health' && method === 'GET') {
        await db.command({ ping: 1 }); return send(200, { success: true });
      }
      if (path === '/api/login' && method === 'POST') {
        rateLimit(attempts, req.socket.remoteAddress, 10, 15 * 60 * 1000);
        const body = await readJson(req);
        const username = text(body?.username, 'el usuario', 254, 1);
        const password = text(body?.password, 'la contraseña', 256, 1);
        const savedCredentials = await db.collection('credenciales').findOne({ _id: 'admin' });
        const verified = await verifyPassword(password, savedCredentials?.passwordHash ?? passwordHash);
        if (username !== adminEmail || !verified) throw new ApiError(401, 'Usuario o contraseña incorrectos.');
        const token = randomBytes(32).toString('hex');
        await sessions.insertOne({ _id: tokenHash(token), expiresAt: new Date(Date.now() + 12 * 3600000) });
        res.setHeader('Set-Cookie', cookie(token, 12 * 3600));
        return send(200, { authenticated: true, token });
      }
      if (path === '/api/session' && method === 'GET') {
        await session(req); return send(200, { authenticated: true });
      }
      if (path === '/api/logout' && method === 'POST') {
        const current = await session(req);
        await sessions.deleteOne({ _id: current._id });
        res.setHeader('Set-Cookie', cookie('', 0)); return send(200, { success: true });
      }
      if (path === '/api/encuestas' && method === 'POST') {
        rateLimit(submissions, req.socket.remoteAddress, 20, 3600000);
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/i.test(key)) invalid('Identificador de envío no válido.');
        const data = validateSubmission(await readJson(req));
        const existing = await surveys.findOne({ submissionKey: key });
        if (existing) return send(200, { success: true, referencia: existing.referencia });
        const count = await counters.findOneAndUpdate({ _id: 'encuestas' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
        const row = { ...data, fecha: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date()),
          createdAt: new Date(), updatedAt: new Date(), submissionKey: key,
          referencia: `CHI-${String(count.value).padStart(6, '0')}` };
        try { await surveys.insertOne(row); }
        catch (error) {
          if (error.code !== 11000) throw error;
          const saved = await surveys.findOne({ submissionKey: key });
          return send(200, { success: true, referencia: saved.referencia });
        }
        return send(201, { success: true, referencia: row.referencia });
      }
      if (path === '/api/encuestas' && method === 'GET') {
        await session(req);
        const rows = await surveys.find({}).sort({ createdAt: -1 }).toArray();
        return send(200, { encuestas: rows.map(publicDocument) });
      }
      const match = path.match(/^\/api\/encuestas\/([a-f0-9]{24})$/i);
      if (match && method === 'PATCH') {
        await session(req);
        const body = await readJson(req);
        if (!ESTADOS.includes(body?.estado) || typeof body?.archivada !== 'boolean') invalid('Revisa el estado de la solicitud.');
        const notas = text(body.notas, 'las notas', 3000);
        const fechaTrabajo = text(body.fechaTrabajo, 'la fecha prevista', 10);
        if (fechaTrabajo && !validDate(fechaTrabajo)) invalid('Fecha prevista no válida.');
        const row = await surveys.findOneAndUpdate({ _id: new ObjectId(match[1]) }, { $set: {
          estado: body.estado, notas, fechaTrabajo, archivada: body.archivada, updatedAt: new Date()
        } }, { returnDocument: 'after' });
        if (!row) throw new ApiError(404, 'No se encontró la solicitud.');
        await management.syncSurvey(row);
        return send(200, { encuesta: publicDocument(row) });
      }
      if (path === '/api/gestion/contrasena' && method === 'POST') {
        await session(req);
        rateLimit(attempts, req.socket.remoteAddress, 10, 15 * 60 * 1000);
        const body = await readJson(req);
        const actual = text(body.actual, 'la contraseña actual', 256, 1);
        const nueva = text(body.nueva, 'la contraseña nueva (mínimo 12 caracteres)', 256, 12);
        const credentials = db.collection('credenciales');
        const saved = await credentials.findOne({ _id: 'admin' });
        if (!await verifyPassword(actual, saved?.passwordHash ?? passwordHash)) throw new ApiError(400, 'La contraseña actual no es correcta.');
        await credentials.findOneAndUpdate({ _id: 'admin' }, { $set: { passwordHash: await hashPassword(nueva) } }, { upsert: true, returnDocument: 'after' });
        return send(200, { success: true });
      }
      if (path.startsWith('/api/gestion/')) {
        await session(req);
        const result = await management.handle(path, method, () => readJson(req));
        if (result) return send(result.status, result.body);
      }
      send(404, { message: 'No se encontró esta ruta.' });
    } catch (error) {
      const status = error instanceof ApiError || error instanceof ManagementError ? error.status : 503;
      send(status, { message: status === 503 ? 'El servicio no está disponible. Inténtalo de nuevo.' : error.message });
    }
  });
}
