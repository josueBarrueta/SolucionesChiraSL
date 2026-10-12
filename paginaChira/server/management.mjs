import { ObjectId } from 'mongodb';

export class ManagementError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = message => { throw new ManagementError(400, message); };
const resources = ['clientes', 'equipo', 'trabajos', 'gastos', 'presupuestos', 'facturas'];
const states = { trabajos: ['Pendiente', 'En curso', 'Finalizado', 'Cancelado'], presupuestos: ['Borrador', 'Enviado', 'Aceptado', 'Rechazado'], facturas: ['Borrador', 'Registrada'] };
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const txt = (body, key, max = 250, required = false) => { const value = body[key] ?? ''; if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(`Revisa ${key}.`); return value.trim(); };
const num = (value, label, max = 100000000, positive = false) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (positive && value === 0)) fail(`Revisa ${label}.`); return value; };
const cents = value => Math.round(value * 100);
const optionalDate = (body, key, required = false) => { const value = txt(body, key, 10, required); if (value && !date(value)) fail(`Revisa ${key}.`); return value; };
const publicRow = row => { const { _id, ...rest } = row; return { ...rest, id: _id.toString() }; };
const reference = value => { if (!value) return ''; if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) fail('Referencia no válida.'); return value; };
export function totals(lines) {
  let baseCentimos = 0, ivaCentimos = 0;
  for (const line of lines) { const base = cents(line.cantidad * line.precio); baseCentimos += base; ivaCentimos += Math.round(base * line.iva / 100); }
  return { baseCentimos, ivaCentimos, totalCentimos: baseCentimos + ivaCentimos };
}
export function validateManagement(resource, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Datos no válidos.');
  if (body.archivada !== undefined && typeof body.archivada !== 'boolean') fail('Archivo no válido.');
  const data = { notas: txt(body, 'notas', 3000), archivada: body.archivada ?? false };
  if (['clientes', 'equipo'].includes(resource)) {
    Object.assign(data, { nombre: txt(body, 'nombre', 200, true), email: txt(body, 'email', 254), telefono: txt(body, 'telefono', 40) });
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('Correo no válido.');
    if (resource === 'clientes') Object.assign(data, { nif: txt(body, 'nif', 40), direccion: txt(body, 'direccion'), localidad: txt(body, 'localidad'), codigoPostal: txt(body, 'codigoPostal', 20) });
    else Object.assign(data, { funcion: txt(body, 'funcion', 150), disponibilidad: txt(body, 'disponibilidad', 500) });
  } else if (resource === 'trabajos') {
    if (!states.trabajos.includes(body.estado)) fail('Estado de trabajo no válido.');
    if (!Array.isArray(body.equipoIds) || body.equipoIds.length > 50) fail('Equipo no válido.');
    Object.assign(data, { titulo: txt(body, 'titulo', 200, true), clienteId: reference(body.clienteId), encuestaId: reference(body.encuestaId), presupuestoId: reference(body.presupuestoId), fecha: optionalDate(body, 'fecha'), estado: body.estado, direccion: txt(body, 'direccion'), descripcion: txt(body, 'descripcion', 3000), tareas: txt(body, 'tareas', 3000), equipoIds: [...new Set(body.equipoIds.map(reference))] });
  } else if (resource === 'gastos') {
    Object.assign(data, { concepto: txt(body, 'concepto', 200, true), fecha: optionalDate(body, 'fecha', true), categoria: txt(body, 'categoria', 100, true), trabajoId: reference(body.trabajoId), importeCentimos: cents(num(body.importe, 'el importe', 1000000, true)), justificante: txt(body, 'justificante', 500) });
  } else if (['presupuestos', 'facturas'].includes(resource)) {
    if (!states[resource].includes(body.estado)) fail('Estado de documento no válido.');
    if (!Array.isArray(body.lineas) || !body.lineas.length || body.lineas.length > 50) fail('Añade entre 1 y 50 conceptos.');
    const lineas = body.lineas.map(line => { if (!line || typeof line !== 'object') fail('Concepto no válido.'); return { concepto: txt(line, 'concepto', 300, true), cantidad: num(line.cantidad, 'la cantidad', 100000, true), precio: num(line.precio, 'el precio', 1000000), iva: num(line.iva, 'el IVA', 100) }; });
    Object.assign(data, { clienteId: reference(body.clienteId), trabajoId: reference(body.trabajoId), presupuestoId: reference(body.presupuestoId), fecha: optionalDate(body, 'fecha', true), vencimiento: optionalDate(body, 'vencimiento'), estado: body.estado, lineas, ...totals(lineas), moneda: 'EUR' });
    if (!data.clienteId) fail('Selecciona un cliente.');
    if (data.vencimiento && data.vencimiento < data.fecha) fail('El vencimiento no puede ser anterior a la fecha.');
    data.numeroExterno = txt(body, 'numeroExterno', 100);
    data.condiciones = txt(body, 'condiciones', 3000);
    if (resource === 'facturas' && data.estado !== 'Borrador') fail('Usa la acción Confirmar para cerrar el registro.');
  } else fail('Apartado no válido.');
  return data;
}
export function validateSettings(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Configuración no válida.');
  const data = { nombre: txt(body, 'nombre', 200, true), nif: txt(body, 'nif', 40), direccion: txt(body, 'direccion'), email: txt(body, 'email', 254), telefono: txt(body, 'telefono', 40), iban: txt(body, 'iban', 40), moneda: 'EUR', ivaPredeterminado: body.ivaPredeterminado === null || body.ivaPredeterminado === undefined ? null : num(body.ivaPredeterminado, 'el IVA', 100), condiciones: txt(body, 'condiciones', 3000) };
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('Correo no válido.');
  return data;
}
export function createManagement(db) {
  const collection = name => db.collection(name);
  const find = async (name, id) => { const row = await collection(name).findOne({ _id: new ObjectId(reference(id)) }); if (!row) throw new ManagementError(404, 'No se encontró el registro relacionado.'); return row; };
  async function relations(data) {
    for (const [key, name] of [['clienteId', 'clientes'], ['trabajoId', 'trabajos'], ['presupuestoId', 'presupuestos'], ['encuestaId', 'encuestas']]) if (data[key]) { const row = await find(name, data[key]); if (key === 'clienteId' && row.archivada) fail('El cliente está archivado.'); if (['trabajoId','presupuestoId'].includes(key) && data.clienteId && row.clienteId !== data.clienteId) fail('El documento o trabajo pertenece a otro cliente.'); }
    for (const id of data.equipoIds ?? []) { const member = await find('equipo', id); if (member.archivada) fail('Hay una persona archivada en el equipo.'); }
  }
  async function number(resource) { const year = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date()).slice(0,4); const count = await collection('contadores').findOneAndUpdate({ _id: `${resource}-${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' }); return `${resource === 'facturas' ? 'FAC' : 'PRE'}-${year}-${String(count.value).padStart(6, '0')}`; }
  async function clientFromSurvey(survey) {
    const key = survey.email.toLowerCase();
    const previous = await collection('clientes').findOne({ origenEmail: key });
    if (previous) return previous._id.toString();
    const existing = await collection('clientes').findOne({ email: key });
    if (existing) return existing._id.toString();
    const row = await collection('clientes').findOneAndUpdate({ origenEmail: key }, { $setOnInsert: { nombre: survey.nombre, email: key, telefono: survey.telefono, nif: '', direccion: survey.direccion === 'No indicada' ? '' : survey.direccion, localidad: survey.localidad, codigoPostal: survey.codigoPostal === 'No indicado' ? '' : survey.codigoPostal, notas: '', archivada: false, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
    return row._id.toString();
  }
  async function syncSurvey(survey) {
    if (survey.archivada || !['Aceptada', 'Finalizada', 'Aceptado', 'Atendida'].includes(survey.estado)) return null;
    const clienteId = await clientFromSurvey(survey);
    const encuestaId = survey._id.toString();
    const previous = await collection('trabajos').findOne({ encuestaId });
    if (previous) {
      // Refresh only values that the owner has not customized in the job.
      const source = previous.origen ?? {};
      const updates = { origen: { fecha: survey.fechaTrabajo ?? '', estado: survey.estado, notas: survey.notas ?? '' } };
      if (previous.fecha === source.fecha) updates.fecha = survey.fechaTrabajo ?? '';
      if (previous.notas === source.notas) updates.notas = survey.notas ?? '';
      if (previous.estado === source.estadoTrabajo) updates.estado = ['Finalizada', 'Atendida'].includes(survey.estado) ? 'Finalizado' : 'Pendiente';
      updates.origen.estadoTrabajo = ['Finalizada', 'Atendida'].includes(survey.estado) ? 'Finalizado' : 'Pendiente';
      return collection('trabajos').findOneAndUpdate({ _id: previous._id }, { $set: updates }, { returnDocument: 'after' });
    }
    return collection('trabajos').findOneAndUpdate({ encuestaId }, { $setOnInsert: { clienteId, titulo: survey.servicios.join(', '), presupuestoId: '', fecha: survey.fechaTrabajo ?? '', estado: ['Finalizada', 'Atendida'].includes(survey.estado) ? 'Finalizado' : 'Pendiente', direccion: `${survey.direccion} · ${survey.localidad}`, descripcion: survey.mensaje, tareas: '', equipoIds: [], origen: { fecha: survey.fechaTrabajo ?? '', estado: survey.estado, estadoTrabajo: ['Finalizada','Atendida'].includes(survey.estado) ? 'Finalizado' : 'Pendiente', notas: survey.notas ?? '' }, notas: survey.notas ?? '', archivada: false, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
  }
  async function handle(path, method, readBody) {
    if (path === '/api/gestion/configuracion') {
      if (method === 'GET') return { status: 200, body: { configuracion: await collection('configuracion').findOne({ _id: 'empresa' }) ?? { nombre: 'Soluciones Chira SL', moneda: 'EUR', ivaPredeterminado: null } } };
      if (method === 'PATCH') { const data = validateSettings(await readBody()); await collection('configuracion').findOneAndUpdate({ _id: 'empresa' }, { $set: data }, { upsert: true, returnDocument: 'after' }); return { status: 200, body: { configuracion: data } }; }
    }
    if (path === '/api/gestion/sincronizar' && method === 'POST') {
      const surveys = await collection('encuestas').find({}).toArray(); let count = 0;
      for (const row of surveys) if (await syncSurvey(row)) count++;
      return { status: 200, body: { trabajos: count } };
    }
    const match = path.match(/^\/api\/gestion\/([a-z]+)(?:\/([a-f0-9]{24})(?:\/(emitir|pago))?)?$/i);
    if (!match || !resources.includes(match[1])) return null;
    const [, resource, id, action] = match;
    if (!id && method === 'GET') return { status: 200, body: { registros: (await collection(resource).find({}).sort({ createdAt: -1 }).toArray()).map(publicRow) } };
    if (id && action === 'emitir' && method === 'POST' && resource === 'facturas') {
      const invoice = await find(resource, id); if (invoice.estado === 'Registrada') return { status: 200, body: { registro: publicRow(invoice) } };
      const empresa = await collection('configuracion').findOne({ _id: 'empresa' }) ?? { nombre: 'Soluciones Chira SL' }; const cliente = await find('clientes', invoice.clienteId);

      const referencia = await number('facturas');
      const row = await collection(resource).findOneAndUpdate({ _id: new ObjectId(id), estado: 'Borrador' }, { $set: { estado: 'Registrada', referencia, empresa: { nombre: empresa.nombre, nif: empresa.nif, direccion: empresa.direccion, email: empresa.email, telefono: empresa.telefono, iban: empresa.iban, condiciones: empresa.condiciones }, cliente: { nombre: cliente.nombre, nif: cliente.nif, direccion: cliente.direccion, email: cliente.email }, emitidaAt: new Date(), updatedAt: new Date() } }, { returnDocument: 'after' });
      return { status: 200, body: { registro: publicRow(row ?? await find(resource, id)) } };
    }
    if (id && action === 'pago' && method === 'POST' && resource === 'facturas') {
      const invoice = await find(resource, id); if (invoice.estado !== 'Registrada') fail('Confirma la factura antes de registrar un pago.');
      const body = await readBody(); const importeCentimos = cents(num(body.importe, 'el pago', 100000000, true)); const fecha = optionalDate(body, 'fecha', true);
      const saldo = invoice.totalCentimos - (invoice.pagadoCentimos ?? 0); if (importeCentimos > saldo) fail('El pago supera el importe pendiente.');
      const pago = { importeCentimos, fecha, metodo: txt(body, 'metodo', 100, true) };
      const row = await collection(resource).findOneAndUpdate({ _id: new ObjectId(id), pagadoCentimos: invoice.pagadoCentimos ?? 0 }, { $inc: { pagadoCentimos: importeCentimos }, $push: { pagos: pago }, $set: { updatedAt: new Date() } }, { returnDocument: 'after' });
      if (!row) throw new ManagementError(409, 'La factura ha cambiado. Actualiza antes de registrar el pago.');
      return { status: 200, body: { registro: publicRow(row) } };
    }
    if ((!id && method === 'POST') || (id && !action && method === 'PATCH')) {
      const body = await readBody(); const previous = id ? await find(resource, id) : null;
      if (previous?.estado === 'Registrada' && resource === 'facturas') fail('Una factura registrada no se puede modificar.');
      const data = validateManagement(resource, body); await relations(data); data.updatedAt = new Date();
      if (!id) {
        data.createdAt = new Date(); if (resource === 'presupuestos') data.referencia = await number(resource); if (resource === 'facturas') { data.pagadoCentimos = 0; data.pagos = []; }
        const result = await collection(resource).insertOne(data); return { status: 201, body: { registro: { ...data, id: result.insertedId.toString() } } };
      }
      const query = { _id: new ObjectId(id), ...(resource === 'facturas' ? { estado: 'Borrador' } : {}) };
      const row = await collection(resource).findOneAndUpdate(query, { $set: data }, { returnDocument: 'after' });
      if (!row) throw new ManagementError(409, 'El registro ha cambiado. Actualiza la página.');
      return { status: 200, body: { registro: publicRow(row) } };
    }
    return null;
  }
  return { handle, syncSurvey };
}
