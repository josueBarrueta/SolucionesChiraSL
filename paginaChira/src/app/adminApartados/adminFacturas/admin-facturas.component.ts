import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';
import { InvoicePreviewService } from './invoice-preview.service';
type Row = Record<string, any>;
@Component({
  selector: 'app-admin-facturas',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-facturas.component.html',
  styleUrls: ['../gestion/gestion.component.scss', './admin-facturas.component.scss'],
})
export class AdminFacturasComponent implements OnInit, OnDestroy {
  @ViewChild('issueDialog', { static: true }) issueDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('recordEditor') recordEditor?: ElementRef<HTMLElement>;
  private readonly api = inject(ChiraApiService);
  private readonly documents = inject(InvoicePreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly cd = inject(ChangeDetectorRef);
  private timer?: ReturnType<typeof setInterval>;
  private handledRequest = '';
  invoices: Row[] = [];
  clients: Row[] = [];
  jobs: Row[] = [];
  surveys: Encuesta[] = [];
  settings: Row = {};
  loading = true;
  ready = false;
  saving = false;
  error = '';
  message = '';
  editorError = '';
  editorOpen = false;
  search = '';
  jobsSearch = '';
  showArchived = false;
  status = '';
  jobScope = 'period';
  draft: Row = { clienteFiscal: {}, lineas: [] };
  issuingInvoice: Row | null = null;
  paymentInvoice: Row | null = null;
  readonly today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(
    new Date(),
  );
  period = 'mes';
  anchor = this.today;
  month = this.today.slice(0, 7);
  year = Number(this.today.slice(0, 4));
  desde = this.month + '-01';
  hasta = this.monthEnd(this.month);
  appliedFrom = this.desde;
  appliedTo = this.hasta;
  payment: Row = { importe: 0, fecha: this.today, metodo: 'Transferencia' };
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.ready) this.consumeRequest();
    });
  }
  ngOnInit(): void {
    void this.load();
    this.timer = setInterval(() => {
      if (
        !this.loading &&
        !this.saving &&
        !this.editorOpen &&
        !this.issuingInvoice &&
        !this.paymentInvoice &&
        !this.documents.preview() &&
        this.document.visibilityState === 'visible'
      )
        void this.load();
    }, 30000);
  }
  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.issueDialog?.nativeElement.close();
  }
  money(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
      (value ?? 0) / 100,
    );
  }
  displayDate(value: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
      ? value.split('-').reverse().join('/')
      : 'Sin fecha';
  }
  monthEnd(value: string): string {
    const [y, m] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }
  get invalidPeriod(): boolean {
    return !this.desde || !this.hasta || this.desde > this.hasta;
  }
  async applyPeriod(): Promise<void> {
    if (this.period === 'dia') this.desde = this.hasta = this.anchor;
    if (this.period === 'semana' && this.anchor) {
      const d = new Date(this.anchor + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      this.desde = d.toISOString().slice(0, 10);
      d.setUTCDate(d.getUTCDate() + 6);
      this.hasta = d.toISOString().slice(0, 10);
    }
    if (this.period === 'mes' && /^\d{4}-\d{2}$/.test(this.month)) {
      this.desde = this.month + '-01';
      this.hasta = this.monthEnd(this.month);
    }
    if (
      this.period === 'ano' &&
      Number.isInteger(this.year) &&
      this.year >= 1900 &&
      this.year <= 9999
    ) {
      this.desde = this.year + '-01-01';
      this.hasta = this.year + '-12-31';
    }
    await this.load();
  }
  inRange(date: string): boolean {
    return !!date && date >= this.appliedFrom && date <= this.appliedTo;
  }
  get periodInvoices(): Row[] {
    return this.invoices.filter((i) => !i['archivada'] && this.inRange(i['fecha']));
  }
  get draftInvoices(): Row[] {
    return this.periodInvoices.filter((i) => i['estado'] === 'Borrador');
  }
  get issuedInvoices(): Row[] {
    return this.periodInvoices.filter((i) => i['modoEmision'] === 'Emitida');
  }
  sum(rows: Row[]): number {
    return rows.reduce((n, r) => n + (r['totalCentimos'] ?? 0), 0);
  }
  get filteredInvoices(): Row[] {
    const q = this.search.trim().toLocaleLowerCase('es');
    return this.invoices.filter(
      (i) =>
        !!i['archivada'] === this.showArchived &&
        this.inRange(i['fecha']) &&
        (!this.status || i['estado'] === this.status) &&
        [this.clientFor(i)['nombre'], this.clientFor(i)['nif'], i['referencia']]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(q),
    );
  }
  get sourceJobs(): Row[] {
    const q = this.jobsSearch.trim().toLocaleLowerCase('es');
    return this.jobs.filter(
      (j) =>
        !j['archivada'] &&
        j['estado'] !== 'Cancelado' &&
        (this.jobScope === 'all' ||
          (j['estado'] === 'Finalizado' &&
            (this.jobScope === 'unbilled' ? !this.invoiceForJob(j) : this.inRange(j['fecha'])))) &&
        [j['titulo'], this.clientName(j['clienteId']), this.jobReference(j)]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(q),
    );
  }
  get issuerMissing(): string[] {
    return [
      ['nombre', 'razón social'],
      ['nif', 'NIF'],
      ['direccion', 'domicilio fiscal'],
      ['serieFacturas', 'serie'],
    ]
      .filter(([key]) => !String(this.settings[key] ?? '').trim())
      .map(([, label]) => label);
  }
  get fiscal(): Row {
    return this.draft['clienteFiscal'];
  }
  get draftTotals(): { base: number; tax: number; total: number } {
    let base = 0,
      tax = 0;
    for (const line of this.draft['lineas'] ?? []) {
      const value = Math.round(
        (Number(line['cantidad']) || 0) * (Number(line['precio']) || 0) * 100,
      );
      base += value;
      tax += Math.round((value * (Number(line['iva']) || 0)) / 100);
    }
    return { base, tax, total: base + tax };
  }
  get availableJobs(): Row[] {
    return this.jobs.filter(
      (j) =>
        !j['archivada'] &&
        j['estado'] !== 'Cancelado' &&
        (!this.draft['clienteId'] || !j['clienteId'] || j['clienteId'] === this.draft['clienteId']),
    );
  }
  get selectedJob(): Row | undefined {
    return this.jobs.find((j) => j['id'] === this.draft['trabajoId']);
  }
  clientName(id: string): string {
    return this.clients.find((c) => c['id'] === id)?.['nombre'] ?? 'Cliente por completar';
  }
  jobReference(job: Row): string {
    return (
      this.surveys.find((s) => s.id === job['encuestaId'])?.referencia ??
      'TR-' + String(job['id']).slice(-8).toUpperCase()
    );
  }
  invoiceForJob(job: Row): Row | undefined {
    return (
      this.invoices.find((i) => i['trabajoId'] === job['id'] && i['estado'] === 'Registrada') ??
      this.invoices.find((i) => i['trabajoId'] === job['id'] && !i['archivada'])
    );
  }
  clientFor(invoice: Row): Row {
    return (
      invoice['cliente'] ??
      invoice['clienteFiscal'] ??
      this.clients.find((c) => c['id'] === invoice['clienteId']) ??
      {}
    );
  }
  fiscalFor(id: string): Row {
    const c = this.clients.find((c) => c['id'] === id) ?? {},
      p = this.invoices.find((i) => i['clienteId'] === id && (i['cliente'] || i['clienteFiscal'])),
      saved = p ? this.clientFor(p) : {};
    return {
      nombre: c['nombre'] || saved['nombre'] || '',
      nif: c['nif'] || saved['nif'] || '',
      direccion: c['direccion']
        ? [c['direccion'], c['codigoPostal'], c['localidad']].filter(Boolean).join(' · ')
        : saved['direccion'] || '',
      email: c['email'] || saved['email'] || '',
      telefono: c['telefono'] || saved['telefono'] || '',
    };
  }
  invoiceState(row: Row): string {
    return row['modoEmision'] === 'Emitida'
      ? 'Emitida · ' + row['referencia']
      : row['estado'] === 'Registrada'
        ? 'Registro interno · ' + row['referencia']
        : 'Borrador';
  }
  async load(): Promise<void> {
    if (this.invalidPeriod) {
      this.error = 'Selecciona un periodo válido.';
      return;
    }
    this.loading = true;
    this.error = '';
    const from = this.desde,
      to = this.hasta;
    try {
      const [invoices, clients, jobs, settings, surveys] = await Promise.all([
        this.api.request<{ registros: Row[] }>('/gestion/facturas'),
        this.api.request<{ registros: Row[] }>('/gestion/clientes'),
        this.api.request<{ registros: Row[] }>('/gestion/trabajos'),
        this.api.request<{ configuracion: Row }>('/gestion/configuracion'),
        this.api.listar(),
      ]);
      this.invoices = invoices.registros;
      this.clients = clients.registros;
      this.jobs = jobs.registros;
      this.settings = settings.configuracion;
      this.surveys = surveys.encuestas;
      this.appliedFrom = from;
      this.appliedTo = to;
      this.ready = true;
      this.consumeRequest();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudieron cargar las facturas.';
      if (error instanceof ApiError && error.status === 401) await this.router.navigate(['/login']);
    } finally {
      this.loading = false;
      this.cd.markForCheck();
    }
  }
  private consumeRequest(): void {
    const p = this.route.snapshot.queryParamMap,
      id = p.get('registro'),
      jobId = p.get('trabajo'),
      key = id ? 'invoice:' + id : jobId ? 'job:' + jobId : '';
    if (!key) {
      this.handledRequest = '';
      return;
    }
    if (this.handledRequest === key) return;
    this.handledRequest = key;
    if (id) {
      const row = this.invoices.find((i) => i['id'] === id);
      if (row) {
        if (row['estado'] === 'Registrada') this.openPayments(row);
        else this.editInvoice(row);
      }
    } else {
      const job = this.jobs.find((j) => j['id'] === jobId);
      if (job) this.prepareJob(job);
    }
  }
  private showEditor(): void {
    this.cd.detectChanges();
    this.document.defaultView?.requestAnimationFrame(() =>
      this.recordEditor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  private clearRequest(): void {
    if (
      this.route.snapshot.queryParamMap.has('registro') ||
      this.route.snapshot.queryParamMap.has('trabajo')
    )
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { registro: null, trabajo: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
  }
  newInvoice(): void {
    this.draft = {
      estado: 'Borrador',
      clienteId: '',
      trabajoId: '',
      fecha: this.today,
      vencimiento: '',
      clienteFiscal: { nombre: '', nif: '', direccion: '', email: '', telefono: '' },
      lineas: [
        { concepto: '', cantidad: 1, precio: 0, iva: this.settings['ivaPredeterminado'] ?? null },
      ],
      condiciones: this.settings['condiciones'] ?? '',
      observaciones: '',
      notas: '',
      archivada: false,
    };
    this.editorOpen = true;
    this.paymentInvoice = null;
    this.editorError = '';
    this.message = '';
    this.showEditor();
  }
  editInvoice(row: Row): void {
    if (row['estado'] === 'Registrada') {
      this.preview(row);
      return;
    }
    this.draft = structuredClone(row);
    this.draft['clienteFiscal'] = structuredClone(
      row['clienteFiscal'] ?? this.fiscalFor(row['clienteId']),
    );
    this.editorOpen = true;
    this.paymentInvoice = null;
    this.editorError = '';
    this.showEditor();
  }
  closeEditor(): void {
    if (this.saving) return;
    this.editorOpen = false;
    this.editorError = '';
    this.clearRequest();
  }
  chooseClient(): void {
    this.draft['clienteFiscal'] = this.fiscalFor(this.draft['clienteId']);
    if (
      this.selectedJob?.['clienteId'] &&
      this.selectedJob['clienteId'] !== this.draft['clienteId']
    )
      this.draft['trabajoId'] = '';
  }
  useJob(): void {
    const j = this.selectedJob;
    if (!j) return;
    const targetClient = j['clienteId'] || this.draft['clienteId'] || '';
    const sameClient = this.draft['clienteId'] === targetClient && !!this.fiscal['nombre'];
    this.draft['clienteId'] = targetClient;
    if (!sameClient) this.draft['clienteFiscal'] = this.fiscalFor(this.draft['clienteId']);
    this.draft['lineas'] = [
      {
        concepto: j['titulo'],
        cantidad: 1,
        precio: j['precioAcordadoCentimos'] == null ? 0 : j['precioAcordadoCentimos'] / 100,
        iva: this.settings['ivaPredeterminado'] ?? null,
      },
    ];
  }
  prepareJob(job: Row): void {
    const previous = this.invoiceForJob(job);
    if (previous?.['estado'] === 'Registrada') {
      this.preview(previous);
      return;
    }
    if (previous) {
      this.editInvoice(previous);
      return;
    }
    this.newInvoice();
    this.draft['trabajoId'] = job['id'];
    this.useJob();
  }
  addLine(): void {
    this.draft['lineas'].push({
      concepto: '',
      cantidad: 1,
      precio: 0,
      iva: this.settings['ivaPredeterminado'] ?? null,
    });
  }
  private validateDraft(emit: boolean): string {
    if (!String(this.fiscal['nombre'] ?? '').trim()) return 'Indica el nombre del cliente.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.draft['fecha'] ?? ''))
      return 'Indica la fecha de la operación.';
    if (this.draft['vencimiento'] && this.draft['vencimiento'] < this.draft['fecha'])
      return 'El vencimiento no puede ser anterior a la fecha.';
    if (
      (this.draft['lineas'] ?? []).some(
        (l: Row) =>
          !String(l['concepto'] ?? '').trim() ||
          typeof l['cantidad'] !== 'number' ||
          !Number.isFinite(l['cantidad']) ||
          l['cantidad'] <= 0 ||
          typeof l['precio'] !== 'number' ||
          !Number.isFinite(l['precio']) ||
          l['precio'] < 0 ||
          typeof l['iva'] !== 'number' ||
          !Number.isFinite(l['iva']) ||
          l['iva'] < 0 ||
          l['iva'] > 100,
      )
    )
      return 'Completa el concepto, la cantidad, el precio y el IVA de cada línea.';
    if (emit && this.issuerMissing.length)
      return 'Completa en Configuración: ' + this.issuerMissing.join(', ') + '.';
    if (emit && (!this.fiscal['nif']?.trim() || !this.fiscal['direccion']?.trim()))
      return 'Completa el NIF y el domicilio fiscal del cliente.';
    if (emit && this.draft['fecha'] > this.today)
      return 'La fecha de la operación no puede ser futura.';
    if (emit && this.draftTotals.total <= 0)
      return 'El total de la factura debe ser mayor que cero.';
    const linked = this.selectedJob ? this.invoiceForJob(this.selectedJob) : undefined;
    if (linked && linked['id'] !== this.draft['id'])
      return 'Este trabajo ya tiene una factura. Abre la factura vinculada para continuar.';
    return '';
  }
  async saveDraft(mode: 'save' | 'preview' | 'issue' = 'save'): Promise<void> {
    if (this.saving) return;
    this.editorError = this.validateDraft(mode === 'issue');
    if (this.editorError) return;
    this.saving = true;
    try {
      if (!this.draft['clienteId']) {
        const tax = String(this.fiscal['nif'] ?? '')
            .replace(/\s/g, '')
            .toUpperCase(),
          email = String(this.fiscal['email'] ?? '').toLowerCase();
        const known = this.clients.find(
          (c) =>
            !c['archivada'] &&
            ((tax &&
              String(c['nif'] ?? '')
                .replace(/\s/g, '')
                .toUpperCase() === tax) ||
              (email && String(c['email'] ?? '').toLowerCase() === email)),
        );
        if (known) this.draft['clienteId'] = known['id'];
        else {
          const c = (
            await this.api.request<{ registro: Row }>('/gestion/clientes', 'POST', {
              ...this.fiscal,
              archivada: false,
              notas: '',
            })
          ).registro;
          this.clients = [c, ...this.clients];
          this.draft['clienteId'] = c['id'];
        }
      }
      if (this.selectedJob && !this.selectedJob['clienteId']) {
        const j = this.selectedJob;
        const saved = (
          await this.api.request<{ registro: Row }>('/gestion/trabajos/' + j['id'], 'PATCH', {
            ...j,
            clienteId: this.draft['clienteId'],
            precioAcordado:
              j['precioAcordadoCentimos'] == null ? null : j['precioAcordadoCentimos'] / 100,
          })
        ).registro;
        this.jobs = this.jobs.map((row) => (row['id'] === j['id'] ? saved : row));
      }
      const row = (
        await this.api.request<{ registro: Row }>(
          '/gestion/facturas' + (this.draft['id'] ? '/' + this.draft['id'] : ''),
          this.draft['id'] ? 'PATCH' : 'POST',
          { ...this.draft, expectedUpdatedAt: this.draft['updatedAt'] },
        )
      ).registro;
      this.invoices = [row, ...this.invoices.filter((i) => i['id'] !== row['id'])];
      this.draft = structuredClone(row);
      this.message = 'Borrador guardado en la base de datos.';
      this.saving = false;
      this.editorOpen = false;
      this.clearRequest();
      if (mode === 'preview') this.preview(row);
      if (mode === 'issue') this.requestIssue(row);
    } catch (error) {
      this.editorError = error instanceof Error ? error.message : 'No se pudo guardar la factura.';
    } finally {
      this.saving = false;
      this.cd.markForCheck();
    }
  }
  preview(row: Row): void {
    this.documents.show(row, this.settings, this.clientFor(row));
  }
  previewDraft(): void {
    const t = this.draftTotals;
    this.preview({
      ...this.draft,
      baseCentimos: t.base,
      ivaCentimos: t.tax,
      totalCentimos: t.total,
    });
  }
  requestIssue(row: Row): void {
    if (this.saving || row['estado'] === 'Registrada') return;
    if (this.issuerMissing.length) {
      this.error = 'Completa ' + this.issuerMissing.join(', ') + ' en Configuración.';
      return;
    }
    const c = this.clientFor(row);
    if (!c['nif']?.trim() || !c['direccion']?.trim()) {
      this.editInvoice(row);
      this.editorError = 'Completa el NIF y el domicilio fiscal del cliente antes de emitir.';
      return;
    }
    this.error = '';
    this.issuingInvoice = structuredClone(row);
    this.issueDialog.nativeElement.showModal();
  }
  cancelIssue(): void {
    if (this.saving) return;
    this.issueDialog.nativeElement.close();
    this.issuingInvoice = null;
  }
  async confirmIssue(): Promise<void> {
    const invoice = this.issuingInvoice;
    if (!invoice || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      const row = (
        await this.api.request<{ registro: Row }>(
          `/gestion/facturas/${invoice['id']}/emitir`,
          'POST',
          { expectedUpdatedAt: invoice['updatedAt'] },
        )
      ).registro;
      this.invoices = [row, ...this.invoices.filter((i) => i['id'] !== row['id'])];
      this.issueDialog.nativeElement.close();
      this.issuingInvoice = null;
      this.message =
        'Factura ' + row['referencia'] + ' emitida. Puedes reimprimirla conservando su número.';
      this.preview(row);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo emitir la factura.';
    } finally {
      this.saving = false;
      this.cd.markForCheck();
    }
  }
  async archive(row: Row): Promise<void> {
    if (this.saving || row['estado'] === 'Registrada') return;
    this.saving = true;
    this.error = '';
    try {
      const saved = (
        await this.api.request<{ registro: Row }>('/gestion/facturas/' + row['id'], 'PATCH', {
          ...row,
          archivada: !row['archivada'],
          expectedUpdatedAt: row['updatedAt'],
        })
      ).registro;
      this.invoices = this.invoices.map((i) => (i['id'] === saved['id'] ? saved : i));
      this.message = saved['archivada']
        ? 'Borrador archivado. Puedes recuperarlo desde Archivadas.'
        : 'Borrador restaurado.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo archivar.';
    } finally {
      this.saving = false;
    }
  }
  openPayments(row: Row): void {
    this.paymentInvoice = row;
    this.editorOpen = false;
    this.payment = { importe: 0, fecha: this.today, metodo: 'Transferencia' };
  }
  async pay(): Promise<void> {
    const invoice = this.paymentInvoice;
    if (!invoice || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      const row = (
        await this.api.request<{ registro: Row }>(
          `/gestion/facturas/${invoice['id']}/pago`,
          'POST',
          this.payment,
        )
      ).registro;
      this.invoices = this.invoices.map((i) => (i['id'] === row['id'] ? row : i));
      this.paymentInvoice = row;
      this.payment['importe'] = 0;
      this.message = 'Cobro registrado.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo registrar el cobro.';
    } finally {
      this.saving = false;
    }
  }
}
