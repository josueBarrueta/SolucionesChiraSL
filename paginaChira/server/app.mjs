import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  LEGACY_SERVICE_QUESTIONS,
  MAX_SERVICE_ITEMS,
  SERVICE_QUESTIONS,
  serviceUsesItems,
} from '../src/app/formulario/formulario.questions.ts';
import { verifyPassword, tokenHash, hashPassword } from './security.mjs';
import { createManagement, ManagementError, validateManagement } from './management.mjs';
import { serveWeb } from './web.mjs';

export const ESTADOS = ['Nueva', 'Contactado', 'Aceptada', 'Finalizada'];
const ESTADOS_ANTERIORES = {
  'En revisión': 'Nueva',
  'Presupuesto enviado': 'Contactado',
  Aceptado: 'Aceptada',
  Atendida: 'Finalizada',
};
const SERVICIOS = [...SERVICE_QUESTIONS.map((b) => b.service), 'Otra consulta'];
const COOKIE = 'chira_session';
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const invalid = (message) => {
  throw new ApiError(400, message);
};
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
  if (
    !Array.isArray(body.services) ||
    !body.services.length ||
    body.services.length > SERVICIOS.length ||
    body.services.some((s) => !SERVICIOS.includes(s))
  )
    invalid('Revisa los servicios.');
  const services = [...new Set(body.services)];
  const phone = parsePhoneNumberFromString(text(body.phone, 'el teléfono', 35, 1));
  if (!phone?.isPossible()) invalid('Revisa el teléfono.');
  const simple = body.questionnaireVersion === 3;
  const details = simple ? {} : body.details;
  if (!details || typeof details !== 'object' || Array.isArray(details))
    invalid('Revisa los detalles.');
  if (
    body.questionnaireVersion !== undefined &&
    body.questionnaireVersion !== 2 &&
    body.questionnaireVersion !== 3
  )
    invalid('Versión de encuesta no válida.');
  const modern = body.questionnaireVersion === 2;
  const respuestas = [];
  const normalizedDetails = {};
  const selectedBlocks = SERVICE_QUESTIONS.filter((block) => services.includes(block.service));
  if (modern) {
    const readField = (field) => {
      const value = text(
        details[field.name],
        field.label,
        field.maxLength ?? 300,
        field.required ? 1 : 0,
      );
      if (field.type === 'select' && value && !field.options.includes(value))
        invalid(`Revisa ${field.label}.`);
      if (field.pattern && value && !new RegExp(field.pattern).test(value))
        invalid(`Revisa ${field.label}.`);
      if (
        field.type === 'number' &&
        value &&
        (!/^\d+(?:[.,]\d{1,2})?$/.test(value) || Number(value.replace(',', '.')) > 100000)
      )
        invalid(`Revisa ${field.label}.`);
      if (
        (field.name.endsWith('_boxes') || field.name.endsWith('_rooms')) &&
        value &&
        !/^\d+$/.test(value)
      )
        invalid(`Revisa ${field.label}.`);
      normalizedDetails[field.name] = value;
      return value;
    };
    for (const block of selectedBlocks) {
      for (const field of block.fields)
        respuestas.push({
          pregunta: `${block.service} — ${field.label}`,
          respuesta: readField(field) || 'No indicado',
        });
      if (serviceUsesItems(block, normalizedDetails)) {
        const countText = text(details[block.slug + '_count'], block.items.label, 3, 1);
        const count = Number(countText);
        if (!/^\d+$/.test(countText) || count < 1 || count > MAX_SERVICE_ITEMS)
          invalid(`Revisa ${block.items.label}.`);
        normalizedDetails[block.slug + '_count'] = String(count);
        respuestas.push({
          pregunta: `${block.service} — ${block.items.label}`,
          respuesta: String(count),
        });
        for (let i = 1; i <= count; i++) {
          const key = `${block.slug}_item_${i}_name`;
          const name = text(details[key], `${block.items.singular} ${i}`, 300, 1);
          normalizedDetails[key] = name;
          respuestas.push({
            pregunta: `${block.service} — ${block.items.singular} ${i}`,
            respuesta: name,
          });
          if (block.items.extraLabel) {
            const extraKey = `${block.slug}_item_${i}_extra`;
            const extra = text(details[extraKey], block.items.extraLabel, 300);
            normalizedDetails[extraKey] = extra;
            if (extra)
              respuestas.push({
                pregunta: `${block.service} — ${block.items.singular} ${i}: ${block.items.extraLabel}`,
                respuesta: extra,
              });
          }
        }
      }
      for (const address of block.addresses)
        for (const field of address.fields)
          respuestas.push({
            pregunta: `${block.service} — ${address.label}: ${field.label}`,
            respuesta: readField(field) || 'No indicado',
          });
    }
  }
  for (const block of (modern || simple ? [] : LEGACY_SERVICE_QUESTIONS).filter((b) =>
    services.includes(b.service),
  )) {
    for (const field of block.fields) {
      const value = text(details[field.name], field.label, 300);
      if (field.type === 'select' && value && !['Sí', 'No'].includes(value))
        invalid(`Revisa ${field.label}.`);
      respuestas.push({
        pregunta: `${block.service} — ${field.label}`,
        respuesta: value || 'No indicado',
      });
    }
  }
  const prefix = modern ? selectedBlocks[0]?.addresses[0].prefix : undefined;
  const primary = prefix
    ? {
        location: normalizedDetails[prefix + '_locality'],
        street: `${normalizedDetails[prefix + '_street']}, ${normalizedDetails[prefix + '_number']}`,
        postalCode: normalizedDetails[prefix + '_postcode'],
        floor: normalizedDetails[prefix + '_floor'],
        door: normalizedDetails[prefix + '_door'],
        staircase: normalizedDetails[prefix + '_staircase'],
      }
    : body;
  const codigoPostal = text(primary.postalCode, 'el código postal', 5, simple ? 5 : 0);
  const calle = text(primary.street, 'la calle', simple ? 140 : 180, simple ? 1 : 0);
  const numero = simple ? text(body.number, 'el número', 30, 1) : '';
  if (codigoPostal && !/^\d{5}$/.test(codigoPostal)) invalid('Revisa el código postal.');
  return {
    nombre: `${firstName} ${lastName}`,
    nombres: firstName,
    apellidos: lastName,
    email,
    telefono: phone.formatInternational(),
    telefonoInternacional: phone.number,
    servicios: services,
    localidad: text(primary.location, 'la localidad', 120, 2),
    direccion: simple ? `${calle}, ${numero}` : calle || 'No indicada',
    ...(simple ? { calle, numero, questionnaireVersion: 3 } : {}),
    codigoPostal: codigoPostal || 'No indicado',
    piso: text(primary.floor, 'el piso', 30) || 'No indicado',
    puerta: text(primary.door, 'la puerta', 30) || 'No indicada',
    escalera: text(primary.staircase, 'la escalera', 40) || 'No indicada',
    mensaje: simple ? '' : text(body.message, 'la descripción', 3000, 20),
    respuestas,
    ...(modern ? { questionnaireVersion: 2, detalles: normalizedDetails } : {}),
    estado: 'Nueva',
    notas: '',
    fechaTrabajo: '',
    archivada: false,
  };
}
function publicDocument(row) {
  const { _id, submissionKey, ...data } = row;
  return { ...data, estado: ESTADOS_ANTERIORES[data.estado] ?? data.estado, id: _id.toString() };
}
async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new ApiError(415, 'Se requiere JSON.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 524288) throw new ApiError(413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ApiError(400, 'Solicitud no válida.');
  }
}

export function createApp({
  db,
  adminEmail,
  passwordHash,
  origins,
  secureCookies = false,
  webDirectory = null,
  localPasswordHash = null,
}) {
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
  const cookie = (token, age) =>
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${secureCookies ? '; Secure' : ''}`;
  async function session(req) {
    const bearer = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const token =
      bearer ??
      (req.headers.cookie ?? '')
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new ApiError(401, 'Inicia sesión para continuar.');
    const current = await sessions.findOne({
      _id: tokenHash(token),
      expiresAt: { $gt: new Date() },
    });
    if (!current) throw new ApiError(401, 'Tu sesión ha caducado. Vuelve a iniciar sesión.');
    return current;
  }
  let manualQueue = Promise.resolve();
  async function createManualRequest(body, key) {
    const submissionKey = 'manual:' + key;
    const previous = await surveys.findOne({ submissionKey });
    if (previous) {
      await management.syncSurvey(previous);
      return { created: false, row: previous };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Solicitud no válida.');
    if (
      !Array.isArray(body.servicios) ||
      !body.servicios.length ||
      body.servicios.length > SERVICIOS.length ||
      body.servicios.some((service) => !SERVICIOS.includes(service))
    )
      invalid('Selecciona al menos un servicio válido.');
    const servicios = [...new Set(body.servicios)];
    const origen = text(body.origen, 'el canal de contacto', 40, 1);
    if (!['Teléfono', 'WhatsApp', 'Presencial', 'Otro'].includes(origen))
      invalid('Canal de contacto no válido.');
    const mensaje = text(body.descripcion, 'la descripción', 3000),
      notas = text(body.notas, 'las notas', 3000);
    let cliente;
    if (body.clienteId) {
      if (typeof body.clienteId !== 'string' || !/^[a-f0-9]{24}$/i.test(body.clienteId))
        invalid('Selecciona un cliente válido.');
      cliente = await db.collection('clientes').findOne({ _id: new ObjectId(body.clienteId) });
      if (!cliente) throw new ApiError(404, 'No se encontró el cliente.');
      if (cliente.archivada) invalid('Restaura el cliente antes de añadir una solicitud.');
    } else {
      const data = validateManagement('clientes', body.cliente);
      if (data.codigoPostal && !/^\d{5}$/.test(data.codigoPostal))
        invalid('Introduce un código postal de cinco dígitos.');
      if (data.telefono) {
        const phone = parsePhoneNumberFromString(data.telefono, 'ES');
        if (!phone?.isPossible()) invalid('Revisa el teléfono y su prefijo.');
        data.telefono = phone.formatInternational();
      }
      if (data.email) cliente = await db.collection('clientes').findOne({ email: data.email });
      if (cliente?.archivada)
        invalid('El correo pertenece a un cliente archivado. Restaura su ficha para continuar.');
      if (!cliente) {
        const id = new ObjectId(
          createHash('sha256')
            .update('cliente-' + submissionKey)
            .digest('hex')
            .slice(0, 24),
        );
        cliente = await db.collection('clientes').findOneAndUpdate(
          { _id: id },
          {
            $setOnInsert: {
              ...data,
              archivada: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true, returnDocument: 'after' },
        );
      }
    }
    const phone = parsePhoneNumberFromString(cliente.telefono ?? '', 'ES');
    const count = await counters.findOneAndUpdate(
      { _id: 'encuestas' },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const row = {
      _id: new ObjectId(
        createHash('sha256')
          .update('solicitud-' + submissionKey)
          .digest('hex')
          .slice(0, 24),
      ),
      clienteId: cliente._id.toString(),
      nombre: cliente.nombre,
      email: cliente.email ?? '',
      telefono: phone?.isPossible() ? phone.formatInternational() : (cliente.telefono ?? ''),
      telefonoInternacional: phone?.isPossible() ? phone.number : '',
      servicios,
      origen,
      questionnaireVersion: 3,
      localidad: cliente.localidad || 'No indicada',
      direccion: cliente.direccion || 'No indicada',
      codigoPostal: cliente.codigoPostal || 'No indicado',
      piso: 'No indicado',
      puerta: 'No indicada',
      escalera: 'No indicada',
      mensaje,
      notas,
      respuestas: [],
      estado: 'Nueva',
      fechaTrabajo: '',
      archivada: false,
      fecha: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date()),
      createdAt: new Date(),
      updatedAt: new Date(),
      submissionKey,
      referencia: `CHI-${String(count.value).padStart(6, '0')}`,
    };
    try {
      await surveys.insertOne(row);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const saved = await surveys.findOne({ submissionKey });
      if (!saved) throw error;
      await management.syncSurvey(saved);
      return { created: false, row: saved };
    }
    await management.syncSurvey(row);
    return { created: true, row };
  }
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    try {
      const path = new URL(req.url, 'http://local').pathname;
      const method = req.method;
      if (!path.startsWith('/api/') && webDirectory && (await serveWeb(req, res, webDirectory)))
        return;
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) throw new ApiError(403, 'Origen no permitido.');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      if (method === 'OPTIONS') {
        if (!origin) throw new ApiError(403, 'Origen no permitido.');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Idempotency-Key',
        );
        res.setHeader('Access-Control-Max-Age', '600');
        res.statusCode = 204;
        return res.end();
      }
      if (['POST', 'PATCH', 'DELETE'].includes(method) && !origin) {
        throw new ApiError(403, 'Origen no permitido.');
      }
      if (path === '/api/health' && method === 'GET') {
        await db.command({ ping: 1 });
        return send(200, { success: true });
      }
      if (path === '/api/login' && method === 'POST') {
        rateLimit(attempts, req.socket.remoteAddress, 10, 15 * 60 * 1000);
        const body = await readJson(req);
        const username = text(body?.username, 'el usuario', 254, 1);
        const password = text(body?.password, 'la contraseña', 256, 1);
        const savedCredentials = await db.collection('credenciales').findOne({ _id: 'admin' });
        const verified = await verifyPassword(
          password,
          localPasswordHash ?? savedCredentials?.passwordHash ?? passwordHash,
        );
        if (username !== adminEmail || !verified)
          throw new ApiError(401, 'Usuario o contraseña incorrectos.');
        const token = randomBytes(32).toString('hex');
        await sessions.insertOne({
          _id: tokenHash(token),
          expiresAt: new Date(Date.now() + 12 * 3600000),
        });
        res.setHeader('Set-Cookie', cookie(token, 12 * 3600));
        return send(200, { authenticated: true, token });
      }
      if (path === '/api/session' && method === 'GET') {
        await session(req);
        return send(200, { authenticated: true });
      }
      if (path === '/api/logout' && method === 'POST') {
        const current = await session(req);
        await sessions.deleteOne({ _id: current._id });
        res.setHeader('Set-Cookie', cookie('', 0));
        return send(200, { success: true });
      }
      if (path === '/api/gestion/solicitudes' && method === 'POST') {
        await session(req);
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/i.test(key))
          invalid('Identificador de envío no válido.');
        const body = await readJson(req);
        const pending = manualQueue.then(() => createManualRequest(body, key));
        manualQueue = pending.catch(() => {});
        const result = await pending;
        return send(result.created ? 201 : 200, { encuesta: publicDocument(result.row) });
      }
      if (path === '/api/encuestas' && method === 'POST') {
        rateLimit(submissions, req.socket.remoteAddress, 20, 3600000);
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/i.test(key))
          invalid('Identificador de envío no válido.');
        const data = validateSubmission(await readJson(req));
        const existing = await surveys.findOne({ submissionKey: key });
        if (existing) {
          await management.syncSurvey(existing);
          return send(200, { success: true, referencia: existing.referencia });
        }
        const count = await counters.findOneAndUpdate(
          { _id: 'encuestas' },
          { $inc: { value: 1 } },
          { upsert: true, returnDocument: 'after' },
        );
        const row = {
          ...data,
          fecha: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date()),
          createdAt: new Date(),
          updatedAt: new Date(),
          submissionKey: key,
          referencia: `CHI-${String(count.value).padStart(6, '0')}`,
        };
        try {
          await surveys.insertOne(row);
        } catch (error) {
          if (error.code !== 11000) throw error;
          const saved = await surveys.findOne({ submissionKey: key });
          await management.syncSurvey(saved);
          return send(200, { success: true, referencia: saved.referencia });
        }
        await management.syncSurvey(await surveys.findOne({ submissionKey: key }));
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
        if (!ESTADOS.includes(body?.estado) || typeof body?.archivada !== 'boolean')
          invalid('Revisa el estado de la solicitud.');
        const notas = text(body.notas, 'las notas', 3000);
        const fechaTrabajo = text(body.fechaTrabajo, 'la fecha prevista', 10);
        if (fechaTrabajo && !validDate(fechaTrabajo)) invalid('Fecha prevista no válida.');
        const row = await surveys.findOneAndUpdate(
          { _id: new ObjectId(match[1]) },
          {
            $set: {
              estado: body.estado,
              notas,
              fechaTrabajo,
              archivada: body.archivada,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after' },
        );
        if (!row) throw new ApiError(404, 'No se encontró la solicitud.');
        await management.syncSurvey(row);
        return send(200, { encuesta: publicDocument(row) });
      }
      if (path === '/api/gestion/contrasena' && method === 'POST') {
        await session(req);
        rateLimit(attempts, req.socket.remoteAddress, 10, 15 * 60 * 1000);
        const body = await readJson(req);
        if (localPasswordHash)
          throw new ApiError(
            400,
            'El acceso local usa una contraseña configurada en el servidor. Cambia LOCAL_ADMIN_PASSWORD_HASH para actualizarla.',
          );
        const actual = text(body.actual, 'la contraseña actual', 256, 1);
        const nueva = text(body.nueva, 'la contraseña nueva (mínimo 12 caracteres)', 256, 12);
        const credentials = db.collection('credenciales');
        const saved = await credentials.findOne({ _id: 'admin' });
        if (!(await verifyPassword(actual, saved?.passwordHash ?? passwordHash)))
          throw new ApiError(400, 'La contraseña actual no es correcta.');
        await credentials.findOneAndUpdate(
          { _id: 'admin' },
          { $set: { passwordHash: await hashPassword(nueva) } },
          { upsert: true, returnDocument: 'after' },
        );
        return send(200, { success: true });
      }
      if (path.startsWith('/api/gestion/')) {
        await session(req);
        const result = await management.handle(path, method, () => readJson(req));
        if (result) return send(result.status, result.body);
      }
      send(404, { message: 'No se encontró esta ruta.' });
    } catch (error) {
      const status =
        error instanceof ApiError || error instanceof ManagementError ? error.status : 503;
      send(status, {
        message:
          status === 503 ? 'El servicio no está disponible. Inténtalo de nuevo.' : error.message,
      });
    }
  });
}
