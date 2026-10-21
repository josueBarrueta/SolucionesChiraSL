import { DOCUMENT } from '@angular/common';
import { InvoicePreviewService } from '../adminFacturas/invoice-preview.service';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';

type Resource = 'clientes' | 'trabajos' | 'gastos' | 'facturas';
type Row = Record<string, any>;
interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  source?: Resource | 'encuestas';
}
const fields: Record<Resource, Field[]> = {
  clientes: [
    { key: 'nombre', label: 'Nombre o razón social', required: true },
    { key: 'email', label: 'Correo', type: 'email' },
    { key: 'telefono', label: 'Teléfono', type: 'tel' },
    { key: 'nif', label: 'NIF / CIF' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'localidad', label: 'Localidad' },
    { key: 'codigoPostal', label: 'Código postal' },
  ],
  trabajos: [
    { key: 'titulo', label: 'Servicio / trabajo', required: true },
    { key: 'clienteId', label: 'Cliente', source: 'clientes', required: true },
    { key: 'encuestaId', label: 'Solicitud de origen', source: 'encuestas' },
    { key: 'fecha', label: 'Fecha prevista', type: 'date' },
    { key: 'precioAcordado', label: 'Precio acordado sin IVA (€)', type: 'number' },
    {
      key: 'estado',
      label: 'Estado',
      options: ['Pendiente', 'En curso', 'Finalizado', 'Cancelado'],
      required: true,
    },
    { key: 'direccion', label: 'Lugar del trabajo' },
    { key: 'descripcion', label: 'Descripción', type: 'textarea' },
    { key: 'tareas', label: 'Tareas y materiales', type: 'textarea' },
  ],
  gastos: [
    { key: 'concepto', label: 'Concepto', required: true },
    { key: 'fecha', label: 'Fecha', type: 'date', required: true },
    {
      key: 'categoria',
      label: 'Categoría',
      options: ['Materiales', 'Combustible', 'Personal', 'Transporte', 'Otros'],
      required: true,
    },
    { key: 'importe', label: 'Importe (€)', type: 'number', required: true },
    { key: 'trabajoId', label: 'Trabajo relacionado', source: 'trabajos' },
    { key: 'justificante', label: 'Referencia del justificante' },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'ivaImporte', label: 'IVA del justificante (€)', type: 'number' },
  ],
  facturas: [
    { key: 'numeroExterno', label: 'Número de factura externa (opcional)' },
    { key: 'clienteId', label: 'Cliente', source: 'clientes', required: true },
    { key: 'trabajoId', label: 'Trabajo', source: 'trabajos' },
    { key: 'fecha', label: 'Fecha', type: 'date', required: true },
    { key: 'vencimiento', label: 'Vencimiento', type: 'date' },
  ],
};
@Component({
  selector: 'app-gestion',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './gestion.component.html',
  styleUrls: ['./gestion.component.scss'],
})
export class GestionComponent implements OnInit, OnDestroy {
  @Input({ required: true }) resource!: Resource;
  @ViewChild('editor', { static: true }) editor!: ElementRef<HTMLDialogElement>;
  protected readonly api = inject(ChiraApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly invoicePreview = inject(InvoicePreviewService);
  private refreshTimer?: ReturnType<typeof setInterval>;
  private overflow: string | null = null;
  data: Record<Resource, Row[]> = { clientes: [], trabajos: [], gastos: [], facturas: [] };
  encuestas: Encuesta[] = [];
  empresa: Row = {};
  draft: Row = {};
  loading = false;
  saving = false;
  error = '';
  editorError = '';
  message = '';
  search = '';
  jobSearch = '';
  jobPickerOpen = false;
  showArchived = false;
  status = '';
  selected: Row | null = null;
  payment: Row = {};
  readonly today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(
    new Date(),
  );
  get title(): string {
    return { clientes: 'Clientes', trabajos: 'Trabajos', gastos: 'Gastos', facturas: 'Facturas' }[
      this.resource
    ];
  }
  get fields(): Field[] {
    return fields[this.resource];
  }
  get documents(): boolean {
    return this.resource === 'facturas';
  }
  get issued(): boolean {
    return this.resource === 'facturas' && this.draft['estado'] === 'Registrada';
  }
  get rows(): Row[] {
    return this.data[this.resource].filter(
      (row) =>
        row['archivada'] === this.showArchived &&
        (!this.status ||
          (this.resource === 'gastos'
            ? row['pagado']
              ? 'Pagado'
              : 'Pendiente'
            : row['estado']) === this.status) &&
        (!this.financial || this.inPeriod(row['fecha'])) &&
        `${row['nombre'] ?? ''} ${row['titulo'] ?? ''} ${row['concepto'] ?? ''} ${row['referencia'] ?? ''} ${this.clientName(row['clienteId'])} ${row['email'] ?? ''} ${row['clienteFiscal']?.['nombre'] ?? ''} ${row['clienteFiscal']?.['nif'] ?? ''} ${row['cliente']?.['nif'] ?? ''} ${row['proveedor'] ?? ''} ${row['justificante'] ?? ''} ${row['telefono'] ?? ''} ${row['localidad'] ?? ''} ${row['direccion'] ?? ''} ${this.resource === 'clientes' ? this.clientServices(row).join(' ') : ''}`
          .toLocaleLowerCase('es')
          .includes(this.search.toLocaleLowerCase('es')),
    );
  }
  get states(): string[] {
    return (
      fields[this.resource].find((f) => f.key === 'estado')?.options ??
      (this.resource === 'facturas'
        ? ['Borrador', 'Registrada']
        : this.resource === 'gastos'
          ? ['Pagado', 'Pendiente']
          : [])
    );
  }
  get draftTotal(): number {
    return (this.draft['lineas'] ?? []).reduce((sum: number, line: Row) => {
      const base = Math.round(Number(line['cantidad'] ?? 0) * Number(line['precio'] ?? 0) * 100);
      return sum + base + Math.round((base * Number(line['iva'] ?? 0)) / 100);
    }, 0);
  }
  clientRequests(client: Row): Encuesta[] {
    const id = client['id'];
    if (!id) return [];
    return this.encuestas.filter((s) =>
      s.clienteId
        ? s.clienteId === id
        : !!client['email'] &&
          s.email.toLowerCase() === String(client['origenEmail'] || client['email']).toLowerCase(),
    );
  }
  clientServices(client: Row): string[] {
    return [...new Set(this.clientRequests(client).flatMap((s) => s.servicios))];
  }
  pendingRequests(client: Row): number {
    return this.clientRequests(client).filter(
      (s) => !s.archivada && ['Nueva', 'Contactado'].includes(s.estado),
    ).length;
  }
  clientJobs(client: Row): Row[] {
    return this.data.trabajos.filter((r) => r['clienteId'] === client['id']);
  }
  clientInvoices(client: Row): Row[] {
    return this.data.facturas.filter((r) => r['clienteId'] === client['id']);
  }
  clientBalance(client: Row): number {
    return this.clientInvoices(client)
      .filter((r) => r['estado'] === 'Registrada')
      .reduce((n, r) => n + r['totalCentimos'] - (r['pagadoCentimos'] ?? 0), 0);
  }
  get activeClientCount(): number {
    return this.data.clientes.filter((c) => !c['archivada']).length;
  }
  get activeJobCount(): number {
    return this.data.trabajos.filter(
      (j) => !j['archivada'] && !['Finalizado', 'Cancelado'].includes(j['estado']),
    ).length;
  }
  get pendingRequestCount(): number {
    return this.encuestas.filter((s) => !s.archivada && ['Nueva', 'Contactado'].includes(s.estado))
      .length;
  }
  get requestClient(): Row | undefined {
    return this.data.clientes.find((c) => c['id'] === this.draft['clienteId']);
  }
  confirmingIssue = false;
  period = 'mes';
  anchor = this.today;
  desde = this.today.slice(0, 7) + '-01';
  hasta =
    this.today.slice(0, 7) +
    '-' +
    new Date(Number(this.today.slice(0, 4)), Number(this.today.slice(5, 7)), 0).getDate();
  get financial(): boolean {
    return this.resource === 'facturas' || this.resource === 'gastos';
  }
  get invalidPeriod(): boolean {
    return !!this.desde && !!this.hasta && this.desde > this.hasta;
  }
  inPeriod(value: string): boolean {
    return (
      !!value &&
      !this.invalidPeriod &&
      (!this.desde || value >= this.desde) &&
      (!this.hasta || value <= this.hasta)
    );
  }
  applyPeriod(): void {
    if (this.period === 'todo') {
      this.desde = '';
      this.hasta = '';
      return;
    }
    if (this.period === 'personalizado' || !this.anchor) return;
    const [y, m, d] = this.anchor.split('-').map(Number),
      start = new Date(y, m - 1, d, 12),
      end = new Date(start);
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
    const key = (v: Date) =>
      `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    this.desde = key(start);
    this.hasta = key(end);
  }
  get periodRows(): Row[] {
    return this.data[this.resource].filter(
      (row) => !row['archivada'] && this.inPeriod(row['fecha']),
    );
  }
  get summary(): { label: string; value: string; note: string }[] {
    const sum = (rows: Row[], key: string) =>
      this.money(rows.reduce((n, row) => n + (row[key] ?? 0), 0));
    if (this.resource === 'gastos')
      return [
        {
          label: 'Gastos registrados',
          value: sum(this.periodRows, 'importeCentimos'),
          note: 'Importes totales del periodo',
        },
        {
          label: 'Gastos pagados',
          value: sum(
            this.periodRows.filter((r) => r['pagado']),
            'importeCentimos',
          ),
          note: 'Según el estado registrado',
        },
        {
          label: 'Gastos pendientes',
          value: sum(
            this.periodRows.filter((r) => !r['pagado']),
            'importeCentimos',
          ),
          note: 'Pendientes o sin pago indicado',
        },
      ];
    return [
      {
        label: 'Borradores del periodo',
        value: sum(
          this.periodRows.filter((r) => r['estado'] === 'Borrador'),
          'totalCentimos',
        ),
        note: 'No añaden ingresos',
      },
      {
        label: 'Facturas emitidas',
        value: sum(
          this.periodRows.filter((r) => r['modoEmision'] === 'Emitida'),
          'totalCentimos',
        ),
        note: 'Con número definitivo',
      },
      {
        label: 'Pendiente de cobro',
        value: this.money(
          this.periodRows
            .filter((r) => r['estado'] === 'Registrada')
            .reduce((n, r) => n + r['totalCentimos'] - (r['pagadoCentimos'] ?? 0), 0),
        ),
        note: 'Saldo actual del periodo',
      },
    ];
  }
  get finishedJobs(): Row[] {
    return this.data.trabajos.filter(
      (r) => !r['archivada'] && r['estado'] === 'Finalizado' && this.inPeriod(r['fecha']),
    );
  }
  prepareJob(job: Row): void {
    const previous =
      this.data.facturas.find(
        (r) => r['trabajoId'] === job['id'] && r['estado'] === 'Registrada',
      ) ?? this.data.facturas.find((r) => r['trabajoId'] === job['id'] && !r['archivada']);
    if (previous) {
      this.open(previous);
      return;
    }
    if (!job['clienteId']) {
      this.error = 'Completa el cliente del trabajo antes de preparar su factura.';
      return;
    }
    this.open();
    Object.assign(this.draft, {
      clienteId: job['clienteId'],
      trabajoId: job['id'],
      lineas: [
        {
          concepto: job['titulo'],
          cantidad: 1,
          precio: job['precioAcordadoCentimos'] == null ? 0 : job['precioAcordadoCentimos'] / 100,
          iva: this.empresa['ivaPredeterminado'],
        },
      ],
    });
  }
  invoiceState(row: Row): string {
    return row['modoEmision'] === 'Emitida'
      ? 'Emitida · ' + row['referencia']
      : row['estado'] === 'Registrada'
        ? 'Registro interno · ' + row['referencia']
        : 'Borrador';
  }
  get issuerMissing(): string[] {
    return [
      { key: 'nombre', label: 'razón social' },
      { key: 'nif', label: 'NIF' },
      { key: 'direccion', label: 'domicilio fiscal' },
      { key: 'serieFacturas', label: 'serie de facturas' },
    ]
      .filter((f) => !this.empresa[f.key]?.trim())
      .map((f) => f.label);
  }
  requestIssue(): void {
    this.editorError = '';
    if (
      JSON.stringify(this.draft) !==
      JSON.stringify(this.data.facturas.find((r) => r['id'] === this.draft['id']))
    ) {
      this.editorError = 'Guarda los cambios del borrador antes de emitirlo.';
      return;
    }
    if (this.issuerMissing.length) {
      this.editorError = 'Completa en Configuración: ' + this.issuerMissing.join(', ') + '.';
      return;
    }
    this.confirmingIssue = true;
  }
  async attach(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    if (
      file.size > 300000 ||
      !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      this.editorError = 'Elige un PDF o una imagen de hasta 300 KB.';
      input.value = '';
      return;
    }
    const draft = this.draft;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (this.draft === draft) {
        draft['adjunto'] = { nombre: file.name, tipo: file.type, data };
        this.editorError = '';
      }
    } catch {
      this.editorError = 'No se pudo leer el justificante.';
    }
  }
  downloadAttachment(row: Row): void {
    const file = row['adjunto'];
    if (!file) return;
    const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0)),
      url = URL.createObjectURL(new Blob([bytes], { type: file.tipo }));
    const a = this.document.createElement('a');
    a.href = url;
    a.download = file.nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  ngOnInit(): void {
    const state = this.route.snapshot.queryParamMap.get('estado');
    if (state && this.states.includes(state)) this.status = state;
    void this.load();
    this.refreshTimer = setInterval(() => {
      if (
        !this.loading &&
        !this.saving &&
        !this.editor.nativeElement.open &&
        this.document.visibilityState === 'visible'
      )
        void this.load();
    }, 30000);
  }
  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    this.restoreScroll();
  }
  money(cents: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
      (cents ?? 0) / 100,
    );
  }
  clientName(id: string): string {
    return this.data.clientes.find((r) => r['id'] === id)?.['nombre'] ?? 'Sin cliente';
  }
  label(row: Row): string {
    return (
      row['nombre'] ??
      row['titulo'] ??
      row['concepto'] ??
      row['referencia'] ??
      'Factura en borrador'
    );
  }
  options(source: Resource | 'encuestas', current?: string): Row[] {
    return source === 'encuestas'
      ? this.encuestas
          .filter(
            (e) =>
              !this.draft['clienteId'] || !e.clienteId || e.clienteId === this.draft['clienteId'],
          )
          .map((e) => ({ id: e.id, nombre: `${e.referencia} · ${e.nombre}` }))
      : this.data[source].filter((r) => !r['archivada'] || r['id'] === current);
  }
  jobReference(job: Row): string {
    return (
      this.encuestas.find((e) => e.id === job['encuestaId'])?.referencia ||
      job['referencia'] ||
      `Trabajo · ${job['id']}`
    );
  }
  jobDate(job: Row): string {
    const value = String(job['fecha'] || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value.split('-').reverse().join('/')
      : 'Sin fecha prevista';
  }
  jobInvoice(job: Row): string {
    const invoices = this.data.facturas.filter(
      (r) => r['trabajoId'] === job['id'] && !r['archivada'] && r['id'] !== this.draft['id'],
    );
    return invoices.some((r) => r['estado'] === 'Registrada')
      ? 'Ya facturado'
      : invoices.length
        ? 'Factura en borrador'
        : '';
  }
  get selectedJob(): Row | undefined {
    return this.data.trabajos.find((r) => r['id'] === this.draft['trabajoId']);
  }
  get invoiceJobs(): Row[] {
    if (!this.draft['clienteId']) return [];
    const query = this.jobSearch.trim().toLocaleLowerCase('es');
    return this.options('trabajos', this.draft['trabajoId']).filter(
      (job) =>
        job['clienteId'] === this.draft['clienteId'] &&
        [job['titulo'], this.jobReference(job), job['direccion'], this.jobDate(job), job['estado']]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(query),
    );
  }
  clientChanged(): void {
    if (this.resource === 'trabajos') {
      const source = this.encuestas.find((s) => s.id === this.draft['encuestaId']);
      if (source?.clienteId && source.clienteId !== this.draft['clienteId'])
        this.draft['encuestaId'] = '';
      if (!this.draft['direccion']) {
        const client = this.requestClient;
        if (client)
          this.draft['direccion'] = [
            client['direccion'],
            client['codigoPostal'],
            client['localidad'],
          ]
            .filter(Boolean)
            .join(' · ');
      }
      return;
    }
    if (this.resource !== 'facturas') return;
    if (this.selectedJob?.['clienteId'] !== this.draft['clienteId']) this.draft['trabajoId'] = '';
    this.jobSearch = '';
    this.jobPickerOpen = false;
  }
  selectJob(job?: Row): void {
    this.draft['trabajoId'] = job?.['id'] || '';
    this.jobPickerOpen = false;
    this.jobSearch = '';
  }
  get surveyGroups(): {
    title: string;
    address: boolean;
    answers: { label: string; value: string; missing: boolean }[];
  }[] {
    const groups = new Map<
      string,
      {
        title: string;
        address: boolean;
        answers: { label: string; value: string; missing: boolean }[];
      }
    >();
    for (const answer of this.solicitud?.respuestas || []) {
      const split = answer.pregunta.indexOf(' — ');
      const service = split >= 0 ? answer.pregunta.slice(0, split) : 'Solicitud';
      const question = split >= 0 ? answer.pregunta.slice(split + 3) : answer.pregunta;
      const address = /^Dirección[^:]*:/i.test(question);
      const colon = question.indexOf(':');
      const title = address ? `${service} · ${question.slice(0, colon)}` : service;
      if (!groups.has(title)) groups.set(title, { title, address, answers: [] });
      const missing =
        !answer.respuesta?.trim() ||
        /^No indicad[oa]$|^Sin especificar$/i.test(answer.respuesta.trim());
      groups.get(title)!.answers.push({
        label: address ? question.slice(colon + 1).trim() : question,
        value: missing ? 'Sin especificar' : answer.respuesta,
        missing,
      });
    }
    return [...groups.values()];
  }
  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const names = Object.keys(this.data) as Resource[];
      const [records, surveys, settings] = await Promise.all([
        Promise.all(
          names.map((name) => this.api.request<{ registros: Row[] }>(`/gestion/${name}`)),
        ),
        this.api.listar(),
        this.api.request<{ configuracion: Row }>('/gestion/configuracion'),
      ]);
      names.forEach((name, i) => (this.data[name] = records[i].registros));
      this.encuestas = surveys.encuestas;
      this.empresa = settings.configuracion;
      const id = this.route.snapshot.queryParamMap.get('registro');
      const trabajoId = this.route.snapshot.queryParamMap.get('trabajo');
      if (this.resource === 'facturas' && trabajoId && !this.editor.nativeElement.open) {
        const job = this.data.trabajos.find(
          (r) => r['id'] === trabajoId && r['estado'] === 'Finalizado',
        );
        if (job && !job['clienteId'])
          throw new Error('Completa el cliente del trabajo antes de preparar la factura.');
        if (job) {
          const invoice =
            this.data.facturas.find(
              (r) => r['trabajoId'] === trabajoId && r['estado'] === 'Registrada',
            ) ?? this.data.facturas.find((r) => r['trabajoId'] === trabajoId && !r['archivada']);
          this.open(invoice);
          if (!invoice)
            Object.assign(this.draft, {
              clienteId: job['clienteId'],
              trabajoId,
              lineas: [
                {
                  concepto: job['titulo'],
                  cantidad: 1,
                  precio:
                    job['precioAcordadoCentimos'] == null ? 0 : job['precioAcordadoCentimos'] / 100,
                  iva: this.empresa['ivaPredeterminado'],
                },
              ],
            });
          this.message = invoice
            ? 'Factura vinculada al trabajo.'
            : 'Completa el precio y el IVA antes de guardar la factura.';
        }
      }
      if (id && !this.editor.nativeElement.open) {
        const row = this.data[this.resource].find((r) => r['id'] === id);
        if (row) this.open(row);
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron cargar los datos.';
      if (e instanceof ApiError && e.status === 401) await this.router.navigate(['/login']);
    } finally {
      this.loading = false;
    }
  }
  open(row?: Row): void {
    this.selected = row ?? null;
    this.editorError = '';
    this.jobSearch = '';
    this.jobPickerOpen = false;
    this.draft = row
      ? structuredClone(row)
      : {
          nombre: '',
          titulo: '',
          concepto: '',
          email: '',
          telefono: '',
          nif: '',
          direccion: '',
          localidad: '',
          codigoPostal: '',
          funcion: '',
          disponibilidad: '',
          clienteId: '',
          trabajoId: '',
          encuestaId: '',
          estado: this.resource === 'trabajos' ? 'Pendiente' : 'Borrador',
          fecha: this.resource === 'trabajos' ? '' : this.today,
          precioAcordado: null,
          vencimiento: '',
          categoria: 'Otros',
          importe: 0,
          descripcion: '',
          tareas: '',
          notas: '',
          condiciones: this.empresa['condiciones'] ?? '',
          archivada: false,
          lineas: [
            { concepto: '', cantidad: 1, precio: 0, iva: this.empresa['ivaPredeterminado'] },
          ],
        };
    if (this.resource === 'gastos' && row) {
      this.draft['importe'] = row['importeCentimos'] / 100;
      this.draft['ivaImporte'] = row['ivaCentimos'] == null ? null : row['ivaCentimos'] / 100;
    }
    if (this.resource === 'trabajos' && row)
      this.draft['precioAcordado'] =
        row['precioAcordadoCentimos'] == null ? null : row['precioAcordadoCentimos'] / 100;
    this.confirmingIssue = false;
    this.payment = { importe: 0, fecha: this.today, metodo: 'Transferencia' };
    if (!this.editor.nativeElement.open) {
      this.overflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
      this.editor.nativeElement.showModal();
    }
  }
  close(): void {
    if (this.saving) return;
    this.editor.nativeElement.close();
    this.restoreScroll();
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
  closeForNavigation(): void {
    if (this.saving) return;
    this.editor.nativeElement.close();
    this.restoreScroll();
  }
  restoreScroll(): void {
    if (this.overflow !== null) {
      this.document.body.style.overflow = this.overflow;
      this.overflow = null;
    }
  }
  async save(): Promise<void> {
    if (this.saving || this.issued) return;
    this.editorError = '';
    if (this.resource === 'gastos' && !this.validAmount(this.draft['importe'])) {
      this.editorError = 'Introduce un importe de al menos 0,01 € y como máximo dos decimales.';
      return;
    }
    if (
      this.resource === 'facturas' &&
      this.draft['trabajoId'] &&
      (!this.selectedJob || this.selectedJob['clienteId'] !== this.draft['clienteId'])
    ) {
      this.editorError = 'Selecciona un trabajo del cliente de esta factura.';
      return;
    }
    this.saving = true;
    try {
      await this.api.request(
        `/gestion/${this.resource}${this.draft['id'] ? '/' + this.draft['id'] : ''}`,
        this.draft['id'] ? 'PATCH' : 'POST',
        this.draft,
      );
      this.message = 'Registro guardado.';
      this.saving = false;
      this.close();
      await this.load();
    } catch (e) {
      this.editorError = e instanceof Error ? e.message : 'No se pudo guardar.';
    } finally {
      this.saving = false;
    }
  }
  async archive(): Promise<void> {
    this.draft['archivada'] = !this.draft['archivada'];
    await this.save();
    if (this.editorError) this.draft['archivada'] = !this.draft['archivada'];
  }
  contact(row: Row): Row | undefined {
    return this.resource === 'clientes'
      ? row
      : this.data.clientes.find((client) => client['id'] === row['clienteId']);
  }
  whatsapp(row: Row): string {
    return 'https://wa.me/' + String(this.contact(row)?.['telefono'] ?? '').replace(/\D/g, '');
  }
  correo(row: Row): string {
    return (
      'mailto:' +
      this.contact(row)?.['email'] +
      '?subject=' +
      encodeURIComponent('Tu solicitud · Soluciones Chira')
    );
  }
  get solicitud(): Encuesta | undefined {
    return this.encuestas.find((e) => e.id === this.draft['encuestaId']);
  }
  async sync(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.request<{ trabajos: number }>(
        '/gestion/sincronizar',
        'POST',
        {},
      );
      this.message = `Solicitudes sincronizadas. Clientes actualizados y ${result.trabajos} trabajos vinculados, sin duplicados.`;
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo sincronizar.';
    } finally {
      this.loading = false;
    }
  }
  addLine(): void {
    this.draft['lineas'].push({
      concepto: '',
      cantidad: 1,
      precio: 0,
      iva: this.empresa['ivaPredeterminado'],
    });
  }
  async issue(): Promise<void> {
    if (this.saving || !this.confirmingIssue) return;
    this.saving = true;
    this.editorError = '';
    try {
      const result = await this.api.request<{ registro: Row }>(
        `/gestion/facturas/${this.draft['id']}/emitir`,
        'POST',
        {},
      );
      this.draft = result.registro;
      this.confirmingIssue = false;
      this.message =
        'Factura ' +
        this.draft['referencia'] +
        ' emitida. Puedes reimprimirla con el mismo número.';
      await this.load();
    } catch (e) {
      this.editorError = e instanceof Error ? e.message : 'No se pudo emitir.';
    } finally {
      this.saving = false;
    }
  }
  validAmount(value: unknown): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.01) return false;
    const scaled = value * 100;
    return (
      Math.abs(scaled - Math.round(scaled)) <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
    );
  }
  async pay(): Promise<void> {
    if (this.saving) return;
    if (!this.validAmount(this.payment['importe'])) {
      this.editorError = 'Introduce un pago de al menos 0,01 € y como máximo dos decimales.';
      return;
    }
    this.saving = true;
    this.editorError = '';
    try {
      const result = await this.api.request<{ registro: Row }>(
        `/gestion/facturas/${this.draft['id']}/pago`,
        'POST',
        this.payment,
      );
      this.draft = result.registro;
      this.payment['importe'] = 0;
      this.message = 'Pago registrado.';
      await this.load();
    } catch (e) {
      this.editorError = e instanceof Error ? e.message : 'No se pudo registrar el pago.';
    } finally {
      this.saving = false;
    }
  }
  print(rowOverride?: Row): void {
    const row =
      rowOverride ??
      this.data[this.resource].find((r) => r['id'] === this.draft['id']) ??
      this.draft;
    const empresa = row['empresa'] ?? this.empresa;
    const cliente =
      row['cliente'] ??
      row['clienteFiscal'] ??
      this.data.clientes.find((r) => r['id'] === row['clienteId']) ??
      {};
    if (this.documents) {
      this.invoicePreview.show(row, empresa, cliente);
      return;
    }
    const escape = (value: unknown) =>
      String(value ?? '').replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
      );
    const popup = this.document.defaultView?.open('', '_blank');
    if (!popup) {
      this.editorError = 'Permite ventanas emergentes para imprimir o guardar como PDF.';
      return;
    }
    const title =
      this.resource === 'trabajos'
        ? 'Ficha de servicio'
        : row['modoEmision'] === 'Emitida'
          ? 'Factura'
          : row['estado'] === 'Registrada'
            ? 'Registro interno de factura'
            : 'Borrador de factura';
    const details = (values: unknown[]) =>
      values
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map((value) => escape(value))
        .join('<br>');
    const section = (label: string, value: unknown) =>
      value ? `<section class="notes"><h2>${label}</h2><p>${escape(value)}</p></section>` : '';
    const survey = this.encuestas.find((e) => e.id === row['encuestaId']);
    const paymentSummary =
      this.resource === 'facturas' && row['estado'] === 'Registrada'
        ? `<div class="payment-status"><div><span>Pagado</span><strong>${this.money(row['pagadoCentimos'] ?? 0)}</strong></div><div><span>Pendiente</span><strong>${this.money(row['totalCentimos'] - (row['pagadoCentimos'] ?? 0))}</strong></div></div>`
        : '';
    const content =
      this.resource === 'trabajos'
        ? `<h2 class="service-title">${escape(row['titulo'])}</h2>${section('Lugar del servicio', row['direccion'])}${section('Descripción', row['descripcion'])}${section('Tareas y materiales', row['tareas'])}${(survey?.respuestas ?? []).map((r) => section(escape(r.pregunta), r.respuesta)).join('')}`
        : /* HTML */ `<table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th class="number">Cant.</th>
                  <th class="number">Precio</th>
                  <th class="number">IVA</th>
                  <th class="number">Base</th>
                </tr>
              </thead>
              <tbody>
                ${(row['lineas'] ?? [])
                  .map(
                    (line: Row) =>
                      `<tr><td>${escape(line['concepto'])}</td><td class="number">${escape(line['cantidad'])}</td><td class="number">${this.money(Math.round(line['precio'] * 100))}</td><td class="number">${escape(line['iva'])}%</td><td class="number">${this.money(Math.round(line['cantidad'] * line['precio'] * 100))}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            <div class="totals">
              <div>
                <span>Base imponible</span><strong>${this.money(row['baseCentimos'])}</strong>
              </div>
              <div><span>IVA</span><strong>${this.money(row['ivaCentimos'])}</strong></div>
              <div class="grand-total">
                <span>Total</span><strong>${this.money(row['totalCentimos'])}</strong>
              </div>
            </div>
            ${paymentSummary}${section('Condiciones', row['condiciones'])}${section(
              'Datos de pago · IBAN',
              empresa['iban'],
            )}`;
    popup.document.write(
      /* HTML */ `<!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>
              ${escape(title)} · ${escape(row['referencia'] ?? row['titulo'] ?? 'Borrador')}
            </title>
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
                background: #eaecee;
                color: #1d2023;
                font:
                  14px/1.55 Arial,
                  Helvetica,
                  sans-serif;
              }
              .toolbar {
                max-width: 800px;
                margin: 24px auto;
                text-align: right;
                padding: 0 24px;
              }
              .toolbar button {
                border: 0;
                border-radius: 6px;
                background: #293946;
                color: white;
                padding: 12px 20px;
                font: inherit;
                cursor: pointer;
              }
              .receipt {
                max-width: 800px;
                margin: 0 auto 40px;
                background: white;
                padding: 48px;
                box-shadow: 0 8px 32px #0b172312;
                border-top: 6px solid #293946;
              }
              .header {
                display: flex;
                justify-content: space-between;
                gap: 24px;
                padding-bottom: 28px;
                border-bottom: 1px solid #d7dce0;
              }
              .brand {
                font-size: 23px;
                font-weight: 700;
                line-height: 1.2;
                margin: 0 0 12px;
              }
              .company {
                font-size: 12px;
                color: #545e66;
              }
              .document {
                text-align: right;
              }
              .eyebrow,
              h2 {
                font-size: 11px;
                letter-spacing: 1.3px;
                text-transform: uppercase;
                color: #4f5a63;
                margin: 0 0 10px;
              }
              .document h1 {
                font-size: 22px;
                line-height: 1.25;
                margin: 0 0 12px;
              }
              .reference {
                font-size: 13px;
                color: #545e66;
              }
              .info {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
                padding: 28px 0;
                border-bottom: 1px dashed #bac2c8;
                margin-bottom: 28px;
              }
              .info p,
              .company {
                margin: 0;
              }
              .meta div {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 7px;
              }
              .meta span {
                color: #5f6b75;
              }
              .meta strong {
                font-weight: 500;
                text-align: right;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
              }
              th {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: #4f5a63;
                padding: 12px 8px;
                border-bottom: 2px solid #293946;
              }
              td {
                padding: 15px 8px;
                border-bottom: 1px solid #dfe2e5;
                vertical-align: top;
                overflow-wrap: anywhere;
              }
              th:first-child,
              td:first-child {
                text-align: left;
                width: 44%;
                padding-left: 0;
              }
              .number {
                text-align: right;
              }
              th:last-child,
              td:last-child {
                padding-right: 0;
              }
              .totals {
                width: 55%;
                margin: 24px 0 32px auto;
              }
              .totals div {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                padding: 7px 0;
              }
              .grand-total {
                border-top: 2px solid #293946;
                margin-top: 10px;
                font-size: 21px;
                color: #293946;
              }
              .notes {
                margin: 24px 0;
                break-inside: avoid;
              }
              .notes p {
                margin: 0;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
              }
              .service-title {
                font-size: 20px;
                letter-spacing: 0;
                text-transform: none;
                color: #1d2023;
              }
              .footer {
                margin-top: 36px;
                border-top: 1px dashed #bac2c8;
                padding-top: 18px;
                font-size: 11px;
                color: #5f6b75;
                text-align: center;
              }
              thead {
                display: table-header-group;
              }
              tr {
                break-inside: avoid;
              }
              @page {
                size: A4;
                margin: 16mm;
              }
              @media (max-width: 600px) {
                .receipt {
                  padding: 24px;
                }
                .header {
                  display: block;
                }
                .document {
                  text-align: left;
                  margin-top: 24px;
                }
                .info {
                  grid-template-columns: 1fr;
                }
                .totals {
                  width: 100%;
                }
              }
              @media print {
                body {
                  background: white;
                  color: #000000;
                }
                .toolbar {
                  display: none;
                }
                .receipt {
                  max-width: none;
                  margin: 0;
                  padding: 0;
                  box-shadow: none;
                  border-top: 3px solid #293946;
                  padding-top: 8mm;
                }
                .header {
                  display: flex;
                }
                .document {
                  text-align: right;
                  margin: 0;
                }
                .info {
                  grid-template-columns: 1fr 1fr;
                }
                .totals {
                  width: 55%;
                  break-inside: avoid;
                }
                .footer {
                  break-inside: avoid;
                }
              }

              body {
                background: #eaecee;
                font-size: 13px;
              }
              .toolbar {
                max-width: 620px;
                text-align: center;
              }
              .receipt {
                max-width: 620px;
                padding: 36px 40px;
                border-top: 0;
                box-shadow: 0 10px 40px #0b172316;
              }
              .header {
                display: block;
                text-align: center;
                border-bottom: 2px dashed #93a0aa;
                padding-bottom: 22px;
              }
              .brand {
                font-size: 24px;
                letter-spacing: 0.3px;
              }
              .company {
                font-size: 11px;
                line-height: 1.7;
              }
              .document {
                text-align: center;
                margin-top: 20px;
                padding-top: 18px;
                border-top: 1px dashed #bfc7cd;
              }
              .document .eyebrow {
                display: none;
              }
              .document h1 {
                font-size: 18px;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .reference {
                font-family: monospace;
                font-size: 13px;
                color: #1d2023;
              }
              .info {
                grid-template-columns: 1fr;
                gap: 18px;
                padding: 22px 0;
                border-bottom: 1px dashed #93a0aa;
                margin-bottom: 16px;
              }
              .meta {
                padding-top: 16px;
                border-top: 1px dashed #cbd2d7;
              }
              .meta div {
                margin-bottom: 5px;
              }
              .number,
              .totals strong,
              .payment-status strong {
                font-variant-numeric: tabular-nums;
                font-family: monospace;
                white-space: nowrap;
              }
              th {
                padding: 10px 4px;
                font-size: 9px;
                letter-spacing: 0;
              }
              td {
                padding: 12px 4px;
                font-size: 12px;
              }
              th:first-child,
              td:first-child {
                width: 40%;
              }
              .totals {
                width: 100%;
                margin: 20px 0;
              }
              .grand-total {
                border-top: 2px dashed #4f5a63;
                border-bottom: 2px dashed #4f5a63;
                padding: 14px 0 !important;
                font-size: 23px;
              }
              .notes {
                margin: 20px 0;
              }
              .notes h2 {
                font-size: 10px;
                letter-spacing: 0.8px;
              }
              .footer {
                margin-top: 24px;
                font-size: 10px;
                line-height: 1.6;
              }
              .payment-status {
                padding: 12px 0;
                border-bottom: 1px dashed #bac2c8;
              }
              .payment-status div {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                padding: 4px 0;
              }
              .payment-status span {
                color: #545e66;
              }
              @media print {
                .receipt {
                  max-width: 148mm;
                  margin: 0 auto;
                  padding: 0;
                  border-top: 0;
                }
                .header {
                  display: block;
                }
                .document {
                  text-align: center;
                  margin-top: 18px;
                }
                .info {
                  grid-template-columns: 1fr;
                }
                .totals {
                  width: 100%;
                }
                .payment-status {
                  break-inside: avoid;
                }
              }
              @media (max-width: 420px) {
                .receipt {
                  padding: 24px 16px;
                }
                td {
                  font-size: 11px;
                }
                .grand-total {
                  font-size: 21px;
                }
              }
            </style>
          </head>
          <body>
            <div class="toolbar">
              <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
            </div>
            <main class="receipt">
              <header class="header">
                <div>
                  <p class="brand">${escape(empresa['nombre'] || 'Soluciones Chira')}</p>
                  <p class="company">
                    ${details([
                      empresa['nif'],
                      empresa['direccion'],
                      empresa['email'],
                      empresa['telefono'],
                    ])}
                  </p>
                </div>
                <div class="document">
                  <p class="eyebrow">Soluciones Chira</p>
                  <h1>${title}</h1>
                  <div class="reference">
                    ${escape(
                      row['referencia'] ??
                        (this.resource === 'trabajos' ? 'Detalle del trabajo' : 'BORRADOR'),
                    )}
                  </div>
                </div>
              </header>
              <section class="info">
                <div>
                  <h2>Cliente</h2>
                  <p>
                    <strong>${escape(cliente['nombre'])}</strong><br />${details([
                      cliente['nif'],
                      cliente['direccion'],
                      cliente['telefono'],
                      cliente['email'],
                    ])}
                  </p>
                </div>
                <div class="meta">
                  <h2>Datos del documento</h2>
                  <div>
                    <span>${this.resource === 'trabajos' ? 'Fecha prevista' : 'Fecha'}</span
                    ><strong>${escape(row['fecha'] || 'Sin asignar')}</strong>
                  </div>
                  ${row['fechaOperacion']
                    ? `<div><span>Fecha de la operación</span><strong>${escape(row['fechaOperacion'])}</strong></div>`
                    : ''}${row['vencimiento']
                    ? `<div><span>Vencimiento</span><strong>${escape(row['vencimiento'])}</strong></div>`
                    : ''}${row['estado']
                    ? `<div><span>Estado</span><strong>${escape(row['estado'])}</strong></div>`
                    : ''}
                </div>
              </section>
              ${content}
              <footer class="footer">
                ${this.resource === 'facturas'
                  ? row['modoEmision'] === 'Emitida'
                    ? 'Factura emitida · Los pagos reflejan los cobros registrados.'
                    : 'Borrador o registro interno · No acredita el pago.'
                  : 'Ficha de servicio · Detalle de los trabajos previstos.'}
              </footer>
            </main>
          </body>
        </html>`,
    );
    popup.document.close();
    popup.opener = null;
  }
}
