import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInvoiceDocument } from '../src/app/adminApartados/adminFacturas/invoice-document.ts';
const settings = {
  nombre: 'Soluciones Chira SL',
  nif: 'EMP-TEST',
  direccion: 'Domicilio de ejemplo',
  iban: 'IBAN DE PRUEBA',
};
const client = {
  nombre: 'Cliente de ejemplo',
  nif: 'CLIENTE-TEST',
  direccion: 'Calle Ejemplo, 12',
};
const invoice = {
  estado: 'Borrador',
  fecha: '2026-10-21',
  lineas: [
    { concepto: 'Mudanza', cantidad: 2, precio: 100, iva: 21 },
    { concepto: 'Otro servicio', cantidad: 1, precio: 50, iva: 10 },
  ],
  notas: 'NOTA INTERNA NO VISIBLE',
};

test('documento de factura: desglose de varios tipos de IVA y total coherente', () => {
  const doc = renderInvoiceDocument(invoice, settings, client, 'http://localhost:4200/');
  assert.match(doc.title, /Borrador/);
  assert.match(doc.html, /FACTURA · BORRADOR/);
  assert.match(doc.html, /BASE IMPONIBLE/);
  assert.match(doc.html, /CUOTA IVA/);
  for (const value of ['200,00', '42,00', '50,00', '5,00', '297,00'])
    assert.ok(doc.html.includes(value), value);
  assert.ok(!doc.html.includes(invoice.notas));
  assert.match(doc.html, /size:\s*A4/);
  assert.ok(doc.html.includes('http://localhost:4200/images/marca/logo-header.jpg'));
  assert.ok(!doc.html.includes('Mesa:'));
  assert.ok(!doc.html.includes('Recibo:'));
});
test('documento de factura: reimpresión usa datos fiscales guardados y referencia de trabajo', () => {
  const issued = {
    ...invoice,
    modoEmision: 'Emitida',
    estado: 'Registrada',
    referencia: 'CHI/000001',
    fechaOperacion: '2026-10-20',
    trabajoId: 'abc123',
    empresa: settings,
    cliente: client,
    totalCentimos: 29700,
  };
  const doc = renderInvoiceDocument(
    issued,
    { nombre: 'EMPRESA CAMBIADA' },
    { nombre: 'CLIENTE CAMBIADO' },
    'http://localhost:4200/',
  );
  assert.equal(doc.title, 'Factura CHI/000001');
  assert.ok(doc.html.includes('Soluciones Chira SL'));
  assert.ok(doc.html.includes('Cliente de ejemplo'));
  assert.ok(!doc.html.includes('EMPRESA CAMBIADA'));
  assert.ok(!doc.html.includes('CLIENTE CAMBIADO'));
  assert.ok(doc.html.includes('TR-ABC123'));
  assert.ok(doc.html.includes('20/10/2026'));
  assert.ok(doc.html.includes('21/10/2026'));
});
test('documento de factura: los campos del cliente y los conceptos se escapan', () => {
  const unsafe = '<script>alert("x")</script>';
  const doc = renderInvoiceDocument(
    {
      ...invoice,
      clienteFiscal: { ...client, nombre: unsafe },
      condiciones: unsafe,
      lineas: [{ concepto: unsafe, cantidad: 1, precio: 1, iva: 0 }],
    },
    settings,
    client,
    'http://localhost:4200/',
  );
  assert.ok(!doc.html.includes('<script>'));
  assert.ok(doc.html.includes('&lt;script&gt;'));
  const internal = renderInvoiceDocument(
    { ...invoice, estado: 'Registrada', referencia: 'FAC-ANTERIOR' },
    settings,
    client,
    'http://localhost:4200/',
  );
  assert.match(internal.title, /Registro interno/);
  assert.ok(internal.html.includes('No sustituye una factura emitida'));
});

test('documento de factura: observaciones públicas visibles y notas internas privadas', () => {
  const doc = renderInvoiceDocument(
    { ...invoice, observaciones: 'Servicio entregado\nGracias por su confianza.' },
    settings,
    client,
    'http://localhost:4200/',
  );
  assert.ok(doc.html.includes('Servicio entregado<br>Gracias por su confianza.'));
  assert.ok(!doc.html.includes(invoice.notas));
});
