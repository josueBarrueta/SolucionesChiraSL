type Row = Record<string, any>;
const escape = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const euros = (cents: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const number = (value: number): string =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }).format(value);
const price = (value: number): string =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(
    value,
  ) + ' €';
const date = (value: unknown): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value).split('-').reverse().join('/') : '';
const multiline = (value: unknown): string => escape(value).replace(/\r?\n/g, '<br>');

/** A4 layout follows Jofemar; issued documents use only their stored snapshots. */
export function renderInvoiceDocument(
  invoice: Row,
  settings: Row,
  client: Row,
  baseUri: string,
): { title: string; html: string } {
  const issued = invoice['modoEmision'] === 'Emitida';
  const internal = !issued && invoice['estado'] === 'Registrada';
  const issuer = issued || internal ? (invoice['empresa'] ?? {}) : settings;
  const recipient =
    issued || internal ? (invoice['cliente'] ?? {}) : (invoice['clienteFiscal'] ?? client);
  const reference =
    issued || internal
      ? (invoice['referencia'] ?? '')
      : 'B-' + String(invoice['id'] ?? 'VISTA-PREVIA').toUpperCase();
  const heading = issued ? 'FACTURA' : internal ? 'REGISTRO INTERNO' : 'FACTURA · BORRADOR';
  const title =
    (issued ? 'Factura ' : internal ? 'Registro interno ' : 'Borrador de factura ') + reference;
  const logoUrl = new URL('images/marca/logo-header.jpg', baseUri).href;
  const groups = new Map<number, { base: number; tax: number }>();
  let calculatedTotal = 0;
  const lines = (invoice['lineas'] ?? [])
    .map((line: Row) => {
      const base = Math.round(line['cantidad'] * line['precio'] * 100);
      const tax = Math.round((base * line['iva']) / 100);
      const group = groups.get(line['iva']) ?? { base: 0, tax: 0 };
      group.base += base;
      group.tax += tax;
      groups.set(line['iva'], group);
      calculatedTotal += base + tax;
      return `<tr><td>${multiline(line['concepto'])}</td><td class="num">${number(line['cantidad'])}</td><td class="num">${price(line['precio'])}</td><td class="num">${number(line['iva'])} %</td><td class="num">${euros(base + tax)}</td></tr>`;
    })
    .join('');
  const note = issued
    ? 'Factura emitida · La reimpresión conserva el mismo número y los datos originales.'
    : internal
      ? 'Registro de gestión interna · No sustituye una factura emitida.'
      : 'BORRADOR · Pendiente de emisión. La referencia no es un número de factura emitida.';
  const body = /* HTML */ `<header>
      <div class="company">
        <img class="logo" src="${escape(logoUrl)}" alt="Soluciones Chira SL" />
        <div class="issuer">
          <strong>${escape(issuer['nombre'] || 'Datos fiscales pendientes')}</strong><br />NIF:
          ${escape(issuer['nif'] || 'Pendiente')}<br />${multiline(
            issuer['direccion'] || 'Domicilio pendiente',
          )}${issuer['email'] || issuer['telefono']
            ? `<br>${[issuer['email'], issuer['telefono']].filter(Boolean).map(escape).join(' · ')}`
            : ''}
        </div>
      </div>
      <div class="document">
        <h1>${heading}</h1>
        <div class="client">
          <b>DATOS DEL CLIENTE</b><strong>${escape(recipient['nombre'])}</strong><br />NIF:
          ${escape(recipient['nif'] || 'Pendiente')}<br />${multiline(
            recipient['direccion'] || 'Domicilio pendiente',
          )}
        </div>
      </div>
    </header>
    <div class="meta">
      <span>${issued ? 'Nº factura' : 'Referencia'}: <b>${escape(reference)}</b></span
      ><span
        >${issued || internal ? 'Fecha de emisión' : 'Fecha del borrador'}:
        ${date(invoice['fecha'])}</span
      >${invoice['fechaOperacion'] && invoice['fechaOperacion'] !== invoice['fecha']
        ? `<span>Fecha de operación: ${date(invoice['fechaOperacion'])}</span>`
        : ''}${invoice['vencimiento']
        ? `<span>Vencimiento: ${date(invoice['vencimiento'])}</span>`
        : ''}${invoice['trabajoId']
        ? `<span>Trabajo: TR-${escape(String(invoice['trabajoId']).toUpperCase())}</span>`
        : ''}
    </div>
    <table class="concepts">
      <colgroup>
        <col class="concept" />
        <col class="quantity" />
        <col class="unit" />
        <col class="tax" />
        <col class="amount" />
      </colgroup>
      <thead>
        <tr>
          <th>CONCEPTO</th>
          <th class="num">CANT.</th>
          <th class="num">PRECIO NETO</th>
          <th class="num">IVA</th>
          <th class="num">IMPORTE</th>
        </tr>
      </thead>
      <tbody>
        ${lines || '<tr><td colspan="5">Sin conceptos.</td></tr>'}
      </tbody>
    </table>
    <table class="totals">
      <thead>
        <tr>
          <th>BASE IMPONIBLE</th>
          <th>TIPO IVA</th>
          <th>CUOTA IVA</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${[...groups]
          .sort(([a], [b]) => a - b)
          .map(
            ([rate, g]) =>
              `<tr><td>${euros(g.base)}</td><td>${number(rate)} %</td><td>${euros(g.tax)}</td><td>${euros(g.base + g.tax)}</td></tr>`,
          )
          .join('')}
        <tr class="grand-total">
          <td colspan="3"><b>TOTAL FACTURA</b></td>
          <td class="total">${euros(invoice['totalCentimos'] ?? calculatedTotal)}</td>
        </tr>
      </tbody>
    </table>
    ${invoice['observaciones']
      ? `<section class="observations"><h2>Observaciones</h2><p>${multiline(invoice['observaciones'])}</p></section>`
      : ''}${invoice['condiciones']
      ? `<section class="conditions"><h2>Condiciones</h2><p>${multiline(invoice['condiciones'])}</p></section>`
      : ''}${issuer['iban']
      ? `<p class="payment"><strong>Datos de pago · IBAN:</strong> ${escape(issuer['iban'])}</p>`
      : ''}
    <div class="signature">${note}</div>`;
  const css = `
* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
}
body {
  color: #222;
  font:
    12px Arial,
    Helvetica,
    sans-serif;
  background: #edf0f3;
}
main {
  padding: 12mm;
  width: 210mm;
  min-height: 297mm;
  margin: 8mm auto;
  background: white;
  box-shadow: 0 2px 18px #17354d14;
}
.logo {
  display: block;
  width: 75mm;
  height: 25mm;
  object-fit: contain;
  object-position: left center;
  filter: invert(1) hue-rotate(180deg);
  background: #000;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 12mm;
  margin-bottom: 8mm;
  align-items: flex-start;
}
.company {
  flex: 1;
  min-width: 0;
}
.document {
  width: 85mm;
  flex-shrink: 0;
}
h1 {
  font-size: 25px;
  margin: 0 0 5mm;
  font-weight: 700;
}
h2 {
  font-size: 13px;
  margin: 0 0 2mm;
}
p {
  line-height: 1.6;
}
.issuer {
  line-height: 1.6;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.client {
  border: 1px solid #aab5bf;
  padding: 3mm;
  line-height: 1.7;
  overflow-wrap: anywhere;
  break-inside: avoid;
}
.client b {
  display: block;
  background: #edf4f9;
  padding: 2mm;
  margin: -3mm -3mm 3mm;
}
.meta {
  display: flex;
  justify-content: space-between;
  gap: 3mm 4mm;
  border: 1px solid #aab5bf;
  padding: 3mm;
  margin: 6mm 0;
  flex-wrap: wrap;
  font-size: 11px;
}
.meta span {
  overflow-wrap: anywhere;
  max-width: 100%;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 5mm 0;
  font-size: 11px;
  table-layout: fixed;
}
th,
td {
  padding: 3mm 2mm;
  border: 1px solid #b9c3cc;
  text-align: left;
  overflow-wrap: anywhere;
  vertical-align: top;
}
th {
  background: #edf4f9;
  font-size: 10px;
}
td.num,
th.num {
  text-align: right;
  white-space: nowrap;
}
.concept {
  width: 40%;
}
.quantity {
  width: 10%;
}
.unit {
  width: 19%;
}
.tax {
  width: 11%;
}
.amount {
  width: 20%;
}
thead {
  display: table-header-group;
}
tr {
  break-inside: avoid;
}
.total {
  font-size: 19px;
  font-weight: bold;
  color: #0066b3;
  white-space: nowrap;
}
.totals {
  margin-top: 10mm;
}
.totals tbody td {
  font-variant-numeric: tabular-nums;
}
.grand-total td {
  padding-top: 4mm;
  padding-bottom: 4mm;
  vertical-align: middle;
}
.conditions,
.observations {
  margin-top: 6mm;
}
.conditions p,
.observations p {
  margin: 0;
  overflow-wrap: anywhere;
}
.payment {
  font-size: 11px;
  overflow-wrap: anywhere;
}
.signature {
  margin-top: 12mm;
  border-top: 1px solid #aab5bf;
  padding-top: 3mm;
  font-size: 10px;
  line-height: 1.6;
}
.signature,
.grand-total {
  break-inside: avoid;
}
@page {
  size: A4;
  margin: 12mm;
}
@media print {
  html,
  body {
    background: white;
  }
  main {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
  .logo {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  th,
  .client b {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;
  return {
    title,
    html: /* HTML */ `<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${escape(title)}</title>
          <style>
            ${css}
          </style>
        </head>
        <body>
          <main>${body}</main>
        </body>
      </html>`,
  };
}
