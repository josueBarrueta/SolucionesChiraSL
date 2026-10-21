import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';

export class ManagementError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message) => {
  throw new ManagementError(400, message);
};
const resources = ['clientes', 'trabajos', 'gastos', 'facturas'];
const states = {
  trabajos: ['Pendiente', 'En curso', 'Finalizado', 'Cancelado'],
  facturas: ['Borrador', 'Registrada'],
};
const date = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const txt = (body, key, max = 250, required = false) => {
  const value = body[key] ?? '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    fail(`Revisa ${key}.`);
  return value.trim();
};
const num = (value, label, max = 100000000, positive = false) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    (positive && value === 0)
  )
    fail(`Revisa ${label}.`);
  return value;
};
const cents = (value) => Math.round(value * 100);
const positiveMoney = (value, label, max) => {
  const scaled = num(value, label, max, true) * 100;
  const rounded = Math.round(scaled);
  if (
    rounded < 1 ||
    Math.abs(scaled - rounded) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  )
    fail(`Revisa ${label}: mínimo 0,01 € y como máximo dos decimales.`);
  return rounded;
};
const optionalDate = (body, key, required = false) => {
  const value = txt(body, key, 10, required);
  if (value && !date(value)) fail(`Revisa ${key}.`);
  return value;
};
const publicRow = (row) => {
  const { _id, ...rest } = row;
  return { ...rest, id: _id.toString() };
};
const reference = (value) => {
  if (!value) return '';
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) fail('Referencia no válida.');
  return value;
};
export function totals(lines) {
  let baseCentimos = 0,
    ivaCentimos = 0;
  for (const line of lines) {
    const base = cents(line.cantidad * line.precio);
    baseCentimos += base;
    ivaCentimos += Math.round((base * line.iva) / 100);
  }
  return { baseCentimos, ivaCentimos, totalCentimos: baseCentimos + ivaCentimos };
}
export function validateManagement(resource, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Datos no válidos.');
  if (body.archivada !== undefined && typeof body.archivada !== 'boolean')
    fail('Archivo no válido.');
  const data = { notas: txt(body, 'notas', 3000), archivada: body.archivada ?? false };
  if (resource === 'clientes') {
    Object.assign(data, {
      nombre: txt(body, 'nombre', 200, true),
      email: txt(body, 'email', 254).toLowerCase(),
      telefono: txt(body, 'telefono', 40),
    });
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('Correo no válido.');
    if (resource === 'clientes')
      Object.assign(data, {
        nif: txt(body, 'nif', 40),
        direccion: txt(body, 'direccion', 500),
        localidad: txt(body, 'localidad'),
        codigoPostal: txt(body, 'codigoPostal', 20),
      });
  } else if (resource === 'trabajos') {
    if (!states.trabajos.includes(body.estado)) fail('Estado de trabajo no válido.');
    Object.assign(data, {
      titulo: txt(body, 'titulo', 200, true),
      clienteId: reference(body.clienteId),
      encuestaId: reference(body.encuestaId),
      fecha: optionalDate(body, 'fecha'),
      estado: body.estado,
      direccion: txt(body, 'direccion', 500),
      descripcion: txt(body, 'descripcion', 3000),
      tareas: txt(body, 'tareas', 3000),
      precioAcordadoCentimos:
        body.precioAcordado == null || body.precioAcordado === ''
          ? null
          : body.precioAcordado === 0
            ? 0
            : positiveMoney(body.precioAcordado, 'el precio acordado', 1000000),
    });
  } else if (resource === 'gastos') {
    Object.assign(data, {
      concepto: txt(body, 'concepto', 200, true),
      fecha: optionalDate(body, 'fecha', true),
      categoria: txt(body, 'categoria', 100, true),
      trabajoId: reference(body.trabajoId),
      importeCentimos: positiveMoney(body.importe, 'el importe', 1000000),
      justificante: txt(body, 'justificante', 500),
      proveedor: txt(body, 'proveedor', 200),
      pagado: body.pagado === true,
      ivaCentimos:
        body.ivaImporte == null || body.ivaImporte === ''
          ? null
          : cents(num(body.ivaImporte, 'el IVA del gasto', body.importe)),
      adjunto: validateAttachment(body.adjunto),
    });
  } else if (resource === 'facturas') {
    if (!states[resource].includes(body.estado)) fail('Estado de documento no válido.');
    if (!Array.isArray(body.lineas) || !body.lineas.length || body.lineas.length > 50)
      fail('Añade entre 1 y 50 conceptos.');
    const lineas = body.lineas.map((line) => {
      if (!line || typeof line !== 'object') fail('Concepto no válido.');
      return {
        concepto: txt(line, 'concepto', 300, true),
        cantidad: num(line.cantidad, 'la cantidad', 100000, true),
        precio: num(line.precio, 'el precio', 1000000),
        iva: num(line.iva, 'el IVA', 100),
      };
    });
    Object.assign(data, {
      clienteId: reference(body.clienteId),
      trabajoId: reference(body.trabajoId),
      fecha: optionalDate(body, 'fecha', true),
      vencimiento: optionalDate(body, 'vencimiento'),
      estado: body.estado,
      lineas,
      ...totals(lineas),
      moneda: 'EUR',
    });
    if (!data.clienteId) fail('Selecciona un cliente.');
    if (data.vencimiento && data.vencimiento < data.fecha)
      fail('El vencimiento no puede ser anterior a la fecha.');
    if (body.clienteFiscal != null) {
      if (typeof body.clienteFiscal !== 'object' || Array.isArray(body.clienteFiscal))
        fail('Datos fiscales del cliente no válidos.');
      data.clienteFiscal = {
        nombre: txt(body.clienteFiscal, 'nombre', 200, true),
        nif: txt(body.clienteFiscal, 'nif', 40),
        direccion: txt(body.clienteFiscal, 'direccion', 500),
        email: txt(body.clienteFiscal, 'email', 254),
        telefono: txt(body.clienteFiscal, 'telefono', 40),
      };
      if (data.clienteFiscal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clienteFiscal.email))
        fail('Correo del cliente no válido.');
    }
    data.numeroExterno = txt(body, 'numeroExterno', 100);
    data.condiciones = txt(body, 'condiciones', 3000);
    data.observaciones = txt(body, 'observaciones', 2000);
    if (resource === 'facturas' && data.estado !== 'Borrador')
      fail('Usa la acción Confirmar para cerrar el registro.');
  } else fail('Apartado no válido.');
  return data;
}
export function validateAttachment(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) fail('Justificante no válido.');
  const nombre = txt(value, 'nombre', 200, true),
    tipo = txt(value, 'tipo', 60, true);
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(tipo))
    fail('Usa PDF, JPG, PNG o WebP.');
  const data = txt(value, 'data', 400000, true);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
    fail('Archivo no válido.');
  const bytes = Buffer.from(data, 'base64');
  const valid =
    tipo === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : tipo === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : tipo === 'image/png'
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.subarray(0, 4).toString() === 'RIFF' &&
            bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid || bytes.length > 300000) fail('El justificante no es válido o supera 300 KB.');
  return { nombre, tipo, data };
}
export function validateSettings(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Configuración no válida.');
  const data = {
    nombre: txt(body, 'nombre', 200, true),
    nif: txt(body, 'nif', 40),
    direccion: txt(body, 'direccion'),
    email: txt(body, 'email', 254).toLowerCase(),
    telefono: txt(body, 'telefono', 40),
    iban: txt(body, 'iban', 40),
    moneda: 'EUR',
    ivaPredeterminado:
      body.ivaPredeterminado === null || body.ivaPredeterminado === undefined
        ? null
        : num(body.ivaPredeterminado, 'el IVA', 100),
    condiciones: txt(body, 'condiciones', 3000),
    serieFacturas: txt(body, 'serieFacturas', 30).toUpperCase(),
    primerNumero: body.primerNumero ?? 1,
    programaActual: txt(body, 'programaActual', 200),
  };
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('Correo no válido.');
  if (data.serieFacturas && !/^[A-Z0-9][A-Z0-9._/-]*$/.test(data.serieFacturas))
    fail('Serie de facturas no válida.');
  if (
    !Number.isSafeInteger(data.primerNumero) ||
    data.primerNumero < 1 ||
    data.primerNumero > 999999999
  )
    fail('Primer número no válido.');
  return data;
}
function surveyAddress(survey, includeLocality = false) {
  if (![2, 3].includes(survey.questionnaireVersion))
    return includeLocality
      ? `${survey.direccion} · ${survey.localidad}`
      : survey.direccion === 'No indicada'
        ? ''
        : survey.direccion;
  const meaningful = (value) => value && !['No indicado', 'No indicada'].includes(value);
  return [
    survey.direccion,
    meaningful(survey.piso) ? `Planta: ${survey.piso}` : '',
    meaningful(survey.puerta) ? `Puerta: ${survey.puerta}` : '',
    meaningful(survey.escalera) ? `Escalera: ${survey.escalera}` : '',
    includeLocality ? `${survey.codigoPostal} ${survey.localidad}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export function createManagement(db) {
  const collection = (name) => db.collection(name);
  const find = async (name, id) => {
    const row = await collection(name).findOne({ _id: new ObjectId(reference(id)) });
    if (!row) throw new ManagementError(404, 'No se encontró el registro relacionado.');
    return row;
  };
  async function relations(data) {
    if (data.encuestaId && data.clienteId) {
      const source = await find('encuestas', data.encuestaId);
      if (source.clienteId && source.clienteId !== data.clienteId)
        fail('La solicitud pertenece a otro cliente.');
    }
    for (const [key, name] of [
      ['clienteId', 'clientes'],
      ['trabajoId', 'trabajos'],
      ['encuestaId', 'encuestas'],
    ])
      if (data[key]) {
        const row = await find(name, data[key]);
        if (key === 'clienteId' && row.archivada) fail('El cliente está archivado.');
        if (key === 'trabajoId' && data.clienteId && row.clienteId !== data.clienteId)
          fail('El documento o trabajo pertenece a otro cliente.');
      }
  }
  let issueQueue = Promise.resolve();
  async function issueInvoice(id, expectedUpdatedAt) {
    const execute = async (session) => {
      const options = session ? { session } : {};
      const invoice = await collection('facturas').findOne({ _id: new ObjectId(id) }, options);
      if (!invoice) throw new ManagementError(404, 'No se encontró la factura.');
      if (invoice.estado === 'Registrada') return invoice;
      if (
        expectedUpdatedAt &&
        new Date(expectedUpdatedAt).getTime() !== new Date(invoice.updatedAt).getTime()
      )
        throw new ManagementError(
          409,
          'El borrador ha cambiado. Actualiza y revisa su contenido antes de emitir.',
        );
      if (invoice.archivada) fail('Restaura el borrador antes de emitirlo.');
      const empresa =
        (await collection('configuracion').findOne({ _id: 'empresa' }, options)) ?? {};
      const fichaCliente = await collection('clientes').findOne(
        { _id: new ObjectId(invoice.clienteId) },
        options,
      );
      const cliente = invoice.clienteFiscal ?? fichaCliente;
      for (const key of ['nombre', 'nif', 'direccion', 'serieFacturas'])
        if (!empresa[key]?.trim()) fail('Completa los datos fiscales y la serie en Configuración.');
      for (const key of ['nombre', 'nif', 'direccion'])
        if (!cliente?.[key]?.trim()) fail('Completa nombre, NIF y domicilio fiscal del cliente.');
      if (!fichaCliente || fichaCliente.archivada) fail('El cliente no existe o está archivado.');
      const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(
        new Date(),
      );
      if (invoice.fecha > hoy) fail('La fecha de la operación no puede ser futura.');
      const calculated = totals(invoice.lineas);
      if (
        calculated.totalCentimos <= 0 ||
        calculated.totalCentimos > 100000000000 ||
        Object.entries(calculated).some(([k, v]) => !Number.isSafeInteger(v) || invoice[k] !== v)
      )
        fail('Revisa los importes del borrador.');
      const serie = empresa.serieFacturas;
      const counterKey = JSON.stringify([empresa.nif.toUpperCase(), serie]);
      const counter = await collection('contadores').findOneAndUpdate(
        { _id: 'emision-' + counterKey },
        { $setOnInsert: { value: (empresa.primerNumero ?? 1) - 1, lastHash: '' } },
        { ...options, upsert: true, returnDocument: 'after' },
      );
      const sequence = counter.value + 1;
      const referencia = `${serie}/${String(sequence).padStart(6, '0')}`;
      const snapshot = {
        nombre: empresa.nombre,
        nif: empresa.nif,
        direccion: empresa.direccion,
        email: empresa.email,
        telefono: empresa.telefono,
        iban: empresa.iban,
        condiciones: empresa.condiciones,
      };
      const clientSnapshot = {
        nombre: cliente.nombre,
        nif: cliente.nif,
        direccion: cliente.direccion,
        email: cliente.email,
        telefono: cliente.telefono,
      };
      const record = {
        estado: 'Registrada',
        modoEmision: 'Emitida',
        referencia,
        serie,
        secuencia: sequence,
        fechaOperacion: invoice.fecha,
        fecha: hoy,
        empresa: snapshot,
        cliente: clientSnapshot,
        emitidaAt: new Date(),
        hashAnterior: counter.lastHash || '',
      };
      record.hashRegistro = createHash('sha256')
        .update(JSON.stringify({ ...record, lineas: invoice.lineas, ...calculated }))
        .digest('hex');
      const row = await collection('facturas').findOneAndUpdate(
        { _id: invoice._id, estado: 'Borrador', updatedAt: invoice.updatedAt },
        { $set: { ...record, updatedAt: new Date() } },
        { ...options, returnDocument: 'after' },
      );
      if (!row) throw new ManagementError(409, 'El borrador cambió. Actualiza antes de emitir.');
      await collection('contadores').findOneAndUpdate(
        { _id: 'emision-' + counterKey },
        { $set: { value: sequence, lastHash: record.hashRegistro } },
        { ...options, returnDocument: 'after' },
      );
      await collection('emisiones').insertOne(
        {
          facturaId: id,
          referencia,
          registro: { ...record, lineas: invoice.lineas, ...calculated },
        },
        options,
      );
      return row;
    };
    // Atlas commits the number, snapshot and audit record together.
    if (db.client?.startSession) {
      const session = db.client.startSession();
      try {
        return await session.withTransaction(() => execute(session));
      } finally {
        await session.endSession();
      }
    }
    return execute(null);
  }
  async function clientFromSurvey(survey) {
    if (
      survey.clienteId &&
      (await collection('clientes').findOne({ _id: new ObjectId(survey.clienteId) }))
    )
      return survey.clienteId;
    const key = survey.email.toLowerCase();
    const previous = await collection('clientes').findOne({ origenEmail: key });
    if (previous) return previous._id.toString();
    const existing = await collection('clientes').findOne({ email: key });
    if (existing) return existing._id.toString();
    const row = await collection('clientes').findOneAndUpdate(
      { origenEmail: key },
      {
        $setOnInsert: {
          nombre: survey.nombre,
          nombres: survey.nombres ?? '',
          apellidos: survey.apellidos ?? '',
          email: key,
          telefono: survey.telefono,
          telefonoInternacional: survey.telefonoInternacional,
          calle: survey.calle ?? '',
          numero: survey.numero ?? '',
          piso: survey.piso,
          puerta: survey.puerta,
          nif: '',
          direccion: surveyAddress(survey),
          localidad: survey.localidad,
          codigoPostal: survey.codigoPostal === 'No indicado' ? '' : survey.codigoPostal,
          notas: '',
          archivada: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return row._id.toString();
  }
  let syncQueue = Promise.resolve();
  function syncSurvey(survey) {
    const next = syncQueue.then(() => importSurvey(survey));
    syncQueue = next.catch(() => {});
    return next;
  }
  async function importSurvey(survey) {
    if (survey.archivada) return null;
    const clienteId = await clientFromSurvey(survey);
    if (survey.clienteId !== clienteId) {
      await collection('encuestas').findOneAndUpdate(
        { _id: survey._id },
        { $set: { clienteId } },
        { returnDocument: 'after' },
      );
      survey.clienteId = clienteId;
    }
    const encuestaId = survey._id.toString();
    const previous = await collection('trabajos').findOne({ encuestaId });
    if (previous) {
      // Refresh only values that the owner has not customized in the job.
      const source = previous.origen ?? {};
      const updates = {
        origen: {
          fecha: survey.fechaTrabajo ?? '',
          estado: survey.estado,
          notas: survey.notas ?? '',
        },
      };
      if (previous.fecha === source.fecha) updates.fecha = survey.fechaTrabajo ?? '';
      if (previous.notas === source.notas) updates.notas = survey.notas ?? '';
      if (previous.estado === source.estadoTrabajo)
        updates.estado = ['Finalizada', 'Atendida'].includes(survey.estado)
          ? 'Finalizado'
          : 'Pendiente';
      updates.origen.estadoTrabajo = ['Finalizada', 'Atendida'].includes(survey.estado)
        ? 'Finalizado'
        : 'Pendiente';
      return collection('trabajos').findOneAndUpdate(
        { _id: previous._id },
        { $set: updates },
        { returnDocument: 'after' },
      );
    }
    if (
      survey.questionnaireVersion === 3 &&
      !['Aceptada', 'Finalizada', 'Atendida'].includes(survey.estado)
    )
      return null;
    return collection('trabajos').findOneAndUpdate(
      { encuestaId },
      {
        $setOnInsert: {
          clienteId,
          precioAcordadoCentimos: null,
          titulo: survey.servicios.join(', '),
          fecha: survey.fechaTrabajo ?? '',
          estado: ['Finalizada', 'Atendida'].includes(survey.estado) ? 'Finalizado' : 'Pendiente',
          direccion: surveyAddress(survey, true),
          descripcion: survey.mensaje,
          tareas:
            survey.questionnaireVersion === 2
              ? 'Consulta los objetos, zonas y direcciones en las respuestas de la encuesta vinculada.'
              : (survey.respuestas ?? []).map((r) => `${r.pregunta}: ${r.respuesta}`).join('\n'),
          origen: {
            fecha: survey.fechaTrabajo ?? '',
            estado: survey.estado,
            estadoTrabajo: ['Finalizada', 'Atendida'].includes(survey.estado)
              ? 'Finalizado'
              : 'Pendiente',
            notas: survey.notas ?? '',
          },
          notas: survey.notas ?? '',
          archivada: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }
  let backfill = null;
  async function ensureImported() {
    if (!backfill)
      backfill = (async () => {
        for (const survey of await collection('encuestas').find({}).toArray())
          await syncSurvey(survey);
      })().catch((error) => {
        backfill = null;
        throw error;
      });
    await backfill;
  }
  async function handle(path, method, readBody) {
    if (path === '/api/gestion/configuracion') {
      if (method === 'GET')
        return {
          status: 200,
          body: {
            configuracion: (await collection('configuracion').findOne({ _id: 'empresa' })) ?? {
              nombre: 'Soluciones Chira SL',
              moneda: 'EUR',
              ivaPredeterminado: null,
            },
          },
        };
      if (method === 'PATCH') {
        const data = validateSettings(await readBody());
        await collection('configuracion').findOneAndUpdate(
          { _id: 'empresa' },
          { $set: data },
          { upsert: true, returnDocument: 'after' },
        );
        return { status: 200, body: { configuracion: data } };
      }
    }
    if (path === '/api/gestion/sincronizar' && method === 'POST') {
      const surveys = await collection('encuestas').find({}).toArray();
      let count = 0;
      for (const row of surveys) if (await syncSurvey(row)) count++;
      return { status: 200, body: { trabajos: count } };
    }
    const match = path.match(
      /^\/api\/gestion\/([a-z]+)(?:\/([a-f0-9]{24})(?:\/(emitir|pago))?)?$/i,
    );
    if (!match || !resources.includes(match[1])) return null;
    const [, resource, id, action] = match;
    if (!id && method === 'GET' && ['clientes', 'trabajos'].includes(resource)) {
      await ensureImported();
    }
    if (!id && method === 'GET')
      return {
        status: 200,
        body: {
          registros: (await collection(resource).find({}).sort({ createdAt: -1 }).toArray()).map(
            publicRow,
          ),
        },
      };
    if (id && action === 'emitir' && method === 'POST' && resource === 'facturas') {
      const body = await readBody();
      const next = issueQueue.then(() => issueInvoice(id, body?.expectedUpdatedAt));
      issueQueue = next.catch(() => {});
      return { status: 200, body: { registro: publicRow(await next) } };
    }
    if (id && action === 'pago' && method === 'POST' && resource === 'facturas') {
      const invoice = await find(resource, id);
      if (invoice.estado !== 'Registrada') fail('Confirma la factura antes de registrar un pago.');
      const body = await readBody();
      const importeCentimos = positiveMoney(body.importe, 'el pago', 100000000);
      const fecha = optionalDate(body, 'fecha', true);
      const saldo = invoice.totalCentimos - (invoice.pagadoCentimos ?? 0);
      if (importeCentimos > saldo) fail('El pago supera el importe pendiente.');
      const pago = { importeCentimos, fecha, metodo: txt(body, 'metodo', 100, true) };
      const row = await collection(resource).findOneAndUpdate(
        { _id: new ObjectId(id), pagadoCentimos: invoice.pagadoCentimos ?? 0 },
        {
          $inc: { pagadoCentimos: importeCentimos },
          $push: { pagos: pago },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' },
      );
      if (!row)
        throw new ManagementError(
          409,
          'La factura ha cambiado. Actualiza antes de registrar el pago.',
        );
      return { status: 200, body: { registro: publicRow(row) } };
    }
    if ((!id && method === 'POST') || (id && !action && method === 'PATCH')) {
      const body = await readBody();
      const previous = id ? await find(resource, id) : null;
      if (previous?.estado === 'Registrada' && resource === 'facturas')
        fail('Una factura registrada no se puede modificar.');
      if (
        resource === 'facturas' &&
        previous &&
        body?.expectedUpdatedAt &&
        new Date(body.expectedUpdatedAt).getTime() !== new Date(previous.updatedAt).getTime()
      )
        throw new ManagementError(409, 'El borrador ha cambiado. Actualiza antes de guardar.');
      const data = validateManagement(resource, body);
      await relations(data);
      data.updatedAt = new Date(
        resource === 'facturas' && previous
          ? Math.max(Date.now(), new Date(previous.updatedAt ?? 0).getTime() + 1)
          : Date.now(),
      );
      if (!id) {
        data.createdAt = new Date();
        if (resource === 'facturas') {
          data.pagadoCentimos = 0;
          data.pagos = [];
        }
        const result = await collection(resource).insertOne(data);
        return { status: 201, body: { registro: { ...data, id: result.insertedId.toString() } } };
      }
      const query = {
        _id: new ObjectId(id),
        ...(resource === 'facturas' ? { estado: 'Borrador', updatedAt: previous.updatedAt } : {}),
      };
      const row = await collection(resource).findOneAndUpdate(
        query,
        { $set: data },
        { returnDocument: 'after' },
      );
      if (!row) throw new ManagementError(409, 'El registro ha cambiado. Actualiza la página.');
      if (resource === 'trabajos' && row.encuestaId) {
        const source = await find('encuestas', row.encuestaId);
        const estado =
          row.estado === 'Finalizado'
            ? 'Finalizada'
            : row.estado === 'En curso'
              ? 'Aceptada'
              : source.estado === 'Finalizada'
                ? 'Aceptada'
                : source.estado;
        await collection('encuestas').findOneAndUpdate(
          { _id: source._id },
          { $set: { estado, fechaTrabajo: row.fecha, updatedAt: new Date() } },
          {},
        );
      }
      return { status: 200, body: { registro: publicRow(row) } };
    }
    return null;
  }
  return { handle, syncSurvey };
}
