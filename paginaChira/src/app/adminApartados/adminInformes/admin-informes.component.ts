import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';
@Component({
  selector: 'app-admin-informes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-informes.component.html',
  styleUrls: ['../gestion/gestion.component.scss', './admin-informes.component.scss'],
})
export class AdminInformesComponent {
  private readonly api = inject(ChiraApiService);
  private readonly router = inject(Router);
  encuestas: Encuesta[] = [];
  trabajos: Record<string, any>[] = [];
  facturas: Record<string, any>[] = [];
  gastos: Record<string, any>[] = [];
  desde = '';
  hasta = '';
  loading = true;
  error = '';
  private readonly document = inject(DOCUMENT);
  period = 'mes';
  anchor = this.dateKey(new Date());
  constructor() {
    this.applyPeriod();
    void this.load();
  }
  dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  applyPeriod(): void {
    if (this.period === 'todo') {
      this.desde = '';
      this.hasta = '';
      return;
    }
    if (this.period === 'personalizado' || !this.anchor) return;
    const [year, month, day] = this.anchor.split('-').map(Number);
    const start = new Date(year, month - 1, day, 12);
    const end = new Date(start);
    if (this.period === 'semana') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
    }
    if (this.period === 'mes') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
    }
    if (this.period === 'ano') {
      start.setMonth(0, 1);
      end.setMonth(11, 31);
    }
    this.desde = this.dateKey(start);
    this.hasta = this.dateKey(end);
  }
  get periodLabel(): string {
    return this.desde && this.hasta ? `${this.desde} — ${this.hasta}` : 'Todo el periodo';
  }
  print(): void {
    if (this.loading || this.error || this.invalid) return;
    const popup = this.document.defaultView?.open('', '_blank');
    if (!popup) {
      this.error = 'Permite ventanas emergentes para imprimir el informe.';
      return;
    }
    const escape = (value: unknown) =>
      String(value ?? '').replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
      );
    const table = (headers: string[], rows: unknown[][]) =>
      `<table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Sin registros en este periodo.</td></tr>`}</tbody></table>`;
    const logoUrl = new URL('images/marca/logo-header.jpg', this.document.baseURI).href;
    const jobs = [...this.jobs].sort((a, b) =>
      String(a['fecha']).localeCompare(String(b['fecha'])),
    );
    popup.document.write(
      /* HTML */ `<!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Informe · ${escape(this.periodLabel)}</title>
            <style>
              html {
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
              }
              * {
                box-sizing: border-box;
              }
              body {
                margin: 0;
                background: #edf0f3;
                color: #222;
                font:
                  12px/1.5 Arial,
                  Helvetica,
                  sans-serif;
              }
              .toolbar {
                width: 210mm;
                max-width: 100%;
                margin: 20px auto;
                text-align: right;
                padding: 0 12px;
              }
              button {
                background: #0066b3;
                color: white;
                border: 0;
                border-radius: 8px;
                padding: 12px 20px;
                font: inherit;
                cursor: pointer;
              }
              main {
                width: 210mm;
                max-width: 100%;
                min-height: 297mm;
                margin: 0 auto 32px;
                padding: 12mm;
                background: white;
                box-shadow: 0 2px 18px #17354d14;
              }
              header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8mm;
                border-bottom: 1px solid #aab5bf;
                padding-bottom: 6mm;
                margin-bottom: 6mm;
                break-inside: avoid;
              }
              .brand {
                font-size: 12px;
                font-weight: bold;
              }
              .logo {
                display: block;
                width: 70mm;
                max-width: 100%;
                height: 23mm;
                object-fit: contain;
                object-position: left center;
                filter: invert(1) hue-rotate(180deg);
                background: #000;
              }
              .brand-name {
                margin-top: 2mm;
              }
              .report-title {
                text-align: right;
              }
              h1 {
                font-size: 23px;
                line-height: 1.2;
                margin: 0 0 3mm;
              }
              h2 {
                font-size: 13px;
                color: #17354d;
                margin: 8mm 0 3mm;
                break-after: avoid;
              }
              .period {
                font-size: 11px;
                color: #596065;
              }
              .metrics {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0;
                border-top: 1px solid #b9c3cc;
                border-left: 1px solid #b9c3cc;
                break-inside: avoid;
              }
              .metric {
                padding: 3mm;
                border-right: 1px solid #b9c3cc;
                border-bottom: 1px solid #b9c3cc;
                display: flex;
                justify-content: space-between;
                gap: 3mm;
                align-items: center;
                font-size: 11px;
              }
              .metric strong {
                white-space: nowrap;
                color: #0066b3;
                font-variant-numeric: tabular-nums;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                font-size: 11px;
                margin-bottom: 4mm;
              }
              th {
                text-align: left;
                background: #edf4f9;
                font-size: 10px;
                color: #222;
              }
              th,
              td {
                padding: 3mm 2mm;
                border: 1px solid #b9c3cc;
                vertical-align: top;
                overflow-wrap: anywhere;
              }
              td:last-child {
                font-variant-numeric: tabular-nums;
              }
              tr {
                break-inside: avoid;
              }
              thead {
                display: table-header-group;
              }
              .note,
              footer {
                font-size: 10px;
                color: #596065;
                line-height: 1.6;
              }
              footer {
                margin-top: 10mm;
                padding-top: 3mm;
                border-top: 1px solid #aab5bf;
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
                .toolbar {
                  display: none;
                }
                main {
                  width: auto;
                  max-width: none;
                  min-height: 0;
                  padding: 0;
                  margin: 0;
                  box-shadow: none;
                }
                .logo,
                th {
                  print-color-adjust: exact;
                  -webkit-print-color-adjust: exact;
                }
              }
              @media screen and (max-width: 600px) {
                main {
                  padding: 20px;
                }
                header {
                  flex-direction: column;
                  align-items: flex-start;
                }
                .report-title {
                  text-align: left;
                }
                .metrics {
                  grid-template-columns: 1fr;
                }
              }
            </style>
          </head>
          <body>
            <div class="toolbar">
              <button onclick="window.print()">Imprimir / guardar PDF</button>
            </div>
            <main>
              <header>
                <div class="brand">
                  <img class="logo" src="${escape(logoUrl)}" alt="Soluciones Chira SL" />
                  <div class="brand-name">Soluciones Chira SL</div>
                </div>
                <div class="report-title">
                  <h1>INFORME DE ACTIVIDAD</h1>
                  <div class="period">Periodo: ${escape(this.periodLabel)}</div>
                </div>
              </header>
              <div class="metrics">
                ${this.metrics
                  .map(
                    (m) =>
                      `<div class="metric"><span>${escape(m.label)}</span><strong>${escape(m.value)}</strong></div>`,
                  )
                  .join('')}
              </div>
              <p class="note">
                Los trabajos se seleccionan por su fecha prevista; su estado indica cuáles están
                finalizados. Los cobros se seleccionan por fecha de pago. El pendiente corresponde
                al saldo actual de las facturas del periodo. Cobros menos gastos no equivale al
                beneficio contable.
              </p>
              <h2>Trabajos del periodo</h2>
              ${table(
                ['Fecha prevista', 'Trabajo', 'Estado'],
                jobs.map((r) => [r['fecha'], r['titulo'], r['estado']]),
              )}
              <h2>Facturas registradas</h2>
              ${table(
                ['Fecha', 'Referencia', 'Total', 'Pendiente actual'],
                this.invoices.map((r) => [
                  r['fecha'],
                  r['referencia'],
                  this.money(r['totalCentimos']),
                  this.money(r['totalCentimos'] - r['pagadoCentimos']),
                ]),
              )}
              <h2>Gastos del periodo</h2>
              ${table(
                ['Fecha', 'Concepto', 'Categoría', 'Importe'],
                this.expenses.map((r) => [
                  r['fecha'],
                  r['concepto'],
                  r['categoria'],
                  this.money(r['importeCentimos']),
                ]),
              )}
              <h2>Cobros por método</h2>
              ${table(
                ['Método', 'Importe'],
                this.paymentMethods.map((r) => [r.name, this.money(r.value)]),
              )}
              <h2>Desglose de IVA</h2>
              ${table(
                ['Tipo', 'Base', 'IVA', 'Total'],
                this.taxGroups.map((r) => [
                  r.rate + ' %',
                  this.money(r.base),
                  this.money(r.tax),
                  this.money(r.total),
                ]),
              )}
              <p class="note">
                IVA de gastos registrado: ${this.money(this.expenseTax)}. Gastos con IVA pendiente:
                ${this.money(this.unknownExpenseTax)}.
              </p>
              <h2>Servicios solicitados</h2>
              ${table(
                ['Servicio', 'Solicitudes'],
                this.services.map((r) => [r.name, r.count]),
              )}
              <footer>
                Resumen de gestión interna · No sustituye una factura ni acredita el pago. Los
                trabajos sin fecha no se incluyen.
              </footer>
            </main>
          </body>
        </html>`,
    );
    popup.document.close();
    popup.opener = null;
  }
  money(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
      value / 100,
    );
  }
  inRange(date: string): boolean {
    return !!date && (!this.desde || date >= this.desde) && (!this.hasta || date <= this.hasta);
  }
  get invalid(): boolean {
    return !!this.desde && !!this.hasta && this.desde > this.hasta;
  }
  get invoices(): Record<string, any>[] {
    return this.facturas.filter((r) => r['estado'] === 'Registrada' && this.inRange(r['fecha']));
  }
  get expenses(): Record<string, any>[] {
    return this.gastos.filter((r) => !r['archivada'] && this.inRange(r['fecha']));
  }
  get billed(): number {
    return this.invoices.reduce((s, r) => s + r['totalCentimos'], 0);
  }
  get collected(): number {
    return this.facturas
      .filter((r) => r['estado'] === 'Registrada')
      .flatMap((r) => r['pagos'] ?? [])
      .filter((p) => this.inRange(p['fecha']))
      .reduce((s, p) => s + p['importeCentimos'], 0);
  }
  get outstanding(): number {
    return this.invoices.reduce((s, r) => s + r['totalCentimos'] - r['pagadoCentimos'], 0);
  }
  get spent(): number {
    return this.expenses.reduce((s, r) => s + r['importeCentimos'], 0);
  }
  get jobs(): Record<string, any>[] {
    return this.trabajos.filter((r) => !r['archivada'] && this.inRange(r['fecha']));
  }
  get services(): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const e of this.encuestas.filter((e) => !e.archivada && this.inRange(e.fecha)))
      for (const name of e.servicios) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
  get categories(): { name: string; value: number }[] {
    const values = new Map<string, number>();
    for (const e of this.expenses)
      values.set(e['categoria'], (values.get(e['categoria']) ?? 0) + e['importeCentimos']);
    return [...values].map(([name, value]) => ({ name, value }));
  }
  get metrics(): { label: string; value: string | number }[] {
    return [
      { label: 'Gastos pagados', value: this.money(this.paidExpenses) },
      { label: 'Gastos pendientes', value: this.money(this.spent - this.paidExpenses) },
      {
        label: 'Solicitudes recibidas',
        value: this.encuestas.filter((e) => this.inRange(e.fecha)).length,
      },
      { label: 'Trabajos programados', value: this.jobs.length },
      {
        label: 'Trabajos finalizados',
        value: this.jobs.filter((r) => r['estado'] === 'Finalizado').length,
      },
      { label: 'Facturado (con IVA)', value: this.money(this.billed) },
      { label: 'Cobrado en el periodo', value: this.money(this.collected) },
      { label: 'Pendiente de las facturas del periodo', value: this.money(this.outstanding) },
      { label: 'Gastos registrados', value: this.money(this.spent) },
      { label: 'Cobros menos gastos', value: this.money(this.collected - this.spent) },
    ];
  }
  get paymentMethods(): { name: string; value: number }[] {
    const amounts = new Map<string, number>();
    for (const invoice of this.facturas.filter((r) => r['estado'] === 'Registrada'))
      for (const payment of invoice['pagos'] ?? [])
        if (this.inRange(payment['fecha']))
          amounts.set(
            payment['metodo'],
            (amounts.get(payment['metodo']) ?? 0) + payment['importeCentimos'],
          );
    return [...amounts].map(([name, value]) => ({ name, value }));
  }
  get taxGroups(): { rate: number; base: number; tax: number; total: number }[] {
    const groups = new Map<number, { rate: number; base: number; tax: number; total: number }>();
    for (const invoice of this.invoices)
      for (const line of invoice['lineas'] ?? []) {
        const rate = line['iva'],
          base = Math.round(line['cantidad'] * line['precio'] * 100),
          tax = Math.round((base * rate) / 100);
        const group = groups.get(rate) ?? { rate, base: 0, tax: 0, total: 0 };
        group.base += base;
        group.tax += tax;
        group.total += base + tax;
        groups.set(rate, group);
      }
    return [...groups.values()].sort((a, b) => a.rate - b.rate);
  }
  get expenseTax(): number {
    return this.expenses.reduce((n, r) => n + (r['ivaCentimos'] ?? 0), 0);
  }
  get unknownExpenseTax(): number {
    return this.expenses
      .filter((r) => r['ivaCentimos'] == null)
      .reduce((n, r) => n + r['importeCentimos'], 0);
  }
  get paidExpenses(): number {
    return this.expenses.filter((r) => r['pagado']).reduce((n, r) => n + r['importeCentimos'], 0);
  }
  downloadCsv(rows: unknown[][], name: string): void {
    const cell = (v: unknown) => {
      let value = String(v ?? '');
      if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
      return '"' + value.replace(/"/g, '""') + '"';
    };
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + rows.map((row) => row.map(cell).join(';')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const a = this.document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  exportExpenses(): void {
    if (this.loading || this.error || this.invalid) return;
    this.downloadCsv(
      [
        ['GASTOS', this.periodLabel],
        [
          'Fecha',
          'Proveedor',
          'Concepto',
          'Categoría',
          'Justificante',
          'Total EUR',
          'IVA EUR',
          'Pagado',
        ],
        ...this.expenses.map((r) => [
          r['fecha'],
          r['proveedor'],
          r['concepto'],
          r['categoria'],
          r['justificante'],
          r['importeCentimos'] / 100,
          r['ivaCentimos'] == null ? 'Pendiente' : r['ivaCentimos'] / 100,
          r['pagado'] ? 'Sí' : 'No',
        ]),
      ],
      'chira-gastos.csv',
    );
  }
  exportReport(): void {
    if (this.loading || this.error || this.invalid) return;
    this.downloadCsv(
      [
        ['RESUMEN PARA GESTORÍA', this.periodLabel],
        ...this.metrics.map((m) => [m.label, m.value]),
        [],
        ['DESGLOSE IVA FACTURAS'],
        ['Tipo %', 'Base EUR', 'IVA EUR', 'Total EUR'],
        ...this.taxGroups.map((g) => [g.rate, g.base / 100, g.tax / 100, g.total / 100]),
        [],
        ['COBROS POR MÉTODO'],
        ...this.paymentMethods.map((g) => [g.name, g.value / 100]),
        [],
        ['FACTURAS DEL PERIODO'],
        [
          'Número',
          'Fecha',
          'Cliente',
          'NIF',
          'Trabajo',
          'Base EUR',
          'IVA EUR',
          'Total EUR',
          'Pendiente EUR',
          'Tipo de registro',
        ],
        ...this.invoices.map((r) => [
          r['referencia'],
          r['fecha'],
          r['cliente']?.['nombre'],
          r['cliente']?.['nif'],
          r['trabajoId'],
          r['baseCentimos'] / 100,
          r['ivaCentimos'] / 100,
          r['totalCentimos'] / 100,
          (r['totalCentimos'] - (r['pagadoCentimos'] ?? 0)) / 100,
          r['modoEmision'] === 'Emitida' ? 'Emitida' : 'Registro interno',
        ]),
        [],
        ['GASTOS'],
        ['Fecha', 'Proveedor', 'Concepto', 'Total EUR', 'IVA EUR', 'Pagado'],
        ...this.expenses.map((r) => [
          r['fecha'],
          r['proveedor'],
          r['concepto'],
          r['importeCentimos'] / 100,
          r['ivaCentimos'] == null ? 'Pendiente' : r['ivaCentimos'] / 100,
          r['pagado'] ? 'Sí' : 'No',
        ]),
      ],
      'chira-gestoria.csv',
    );
  }
  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const [surveys, ...records] = await Promise.all([
        this.api.listar(),
        ...['trabajos', 'facturas', 'gastos'].map((name) =>
          this.api.request<{ registros: Record<string, any>[] }>(`/gestion/${name}`),
        ),
      ]);
      this.encuestas = (surveys as { encuestas: Encuesta[] }).encuestas;
      [this.trabajos, this.facturas, this.gastos] = records.map(
        (r) => (r as { registros: Record<string, any>[] }).registros,
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron cargar los informes.';
      if (e instanceof ApiError && e.status === 401) await this.router.navigate(['/login']);
    } finally {
      this.loading = false;
    }
  }
}
