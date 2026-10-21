import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SERVICE_QUESTIONS } from '../../formulario/formulario.questions';

import {
  ApiError,
  ChiraApiService,
  Encuesta,
  EstadoEncuesta,
} from '../../shared/chira-api.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
type Estado = EstadoEncuesta;

@Component({
  selector: 'app-admin-encuestas',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-encuestas.component.html',
  styleUrls: ['./admin-encuestas.component.scss'],
})
export class AdminEncuestasComponent implements OnDestroy {
  @ViewChild('respuestaModal', { static: true })
  private respuestaModal!: ElementRef<HTMLDialogElement>;
  @ViewChild('nuevaModal', { static: true }) private nuevaModal!: ElementRef<HTMLDialogElement>;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ChiraApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  soloPendientes = false;
  cargando = true;
  guardando = false;
  errorCarga = '';
  private refreshTimer?: ReturnType<typeof setInterval>;
  private previousOverflow: string | null = null;
  clientes: Record<string, any>[] = [];
  modoCliente = 'existente';
  cargandoClientes = false;
  guardandoNueva = false;
  creando = false;
  errorNueva = '';
  nueva: Record<string, any> = {
    clienteId: '',
    cliente: {},
    servicios: [],
    origen: 'Teléfono',
    descripcion: '',
    notas: '',
  };
  private nuevaKey = '';
  private nuevaSignature = '';
  async abrirNueva(): Promise<void> {
    this.errorNueva = '';
    this.modoCliente = 'existente';
    this.nueva = {
      clienteId: '',
      cliente: {
        nombre: '',
        email: '',
        telefono: '',
        direccion: '',
        codigoPostal: '',
        localidad: '',
        nif: '',
      },
      servicios: [],
      origen: 'Teléfono',
      descripcion: '',
      notas: '',
    };
    this.nuevaKey = '';
    this.nuevaSignature = '';
    this.creando = true;
    this.cargandoClientes = true;
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.nuevaModal.nativeElement.showModal();
    try {
      this.clientes = (
        await this.api.request<{ registros: Record<string, any>[] }>('/gestion/clientes')
      ).registros.filter((c) => !c['archivada']);
      if (!this.clientes.length) this.modoCliente = 'nuevo';
    } catch (error) {
      this.errorNueva =
        error instanceof Error ? error.message : 'No se pudieron cargar los clientes.';
      this.modoCliente = 'nuevo';
    } finally {
      this.cargandoClientes = false;
      this.changeDetector.markForCheck();
    }
  }
  cerrarNueva(): void {
    if (this.guardandoNueva) return;
    this.nuevaModal.nativeElement.close();
    this.creando = false;
    this.restaurarScroll();
  }
  get clienteElegido(): Record<string, any> | undefined {
    return this.clientes.find((c) => c['id'] === this.nueva['clienteId']);
  }
  servicioNuevo(service: string, event: Event): void {
    const selected = this.nueva['servicios'] as string[];
    this.nueva['servicios'] = (event.target as HTMLInputElement).checked
      ? [...new Set([...selected, service])]
      : selected.filter((s) => s !== service);
  }
  async guardarNueva(): Promise<void> {
    if (this.guardandoNueva) return;
    this.errorNueva = '';
    if (!this.nueva['servicios'].length) {
      this.errorNueva = 'Selecciona al menos un servicio.';
      return;
    }
    if (this.modoCliente === 'existente' && !this.clienteElegido) {
      this.errorNueva = 'Selecciona un cliente.';
      return;
    }
    if (this.modoCliente === 'nuevo' && !this.nueva['cliente']['nombre']?.trim()) {
      this.errorNueva = 'Indica el nombre completo del cliente.';
      return;
    }
    const payload = {
      clienteId: this.modoCliente === 'existente' ? this.nueva['clienteId'] : '',
      cliente: this.modoCliente === 'nuevo' ? this.nueva['cliente'] : undefined,
      servicios: this.nueva['servicios'],
      origen: this.nueva['origen'],
      descripcion: this.nueva['descripcion'],
      notas: this.nueva['notas'],
    };
    const signature = JSON.stringify(payload);
    if (!this.nuevaKey || this.nuevaSignature !== signature) {
      this.nuevaKey = crypto.randomUUID();
      this.nuevaSignature = signature;
    }
    this.guardandoNueva = true;
    try {
      const saved = (
        await this.api.request<{ encuesta: Encuesta }>('/gestion/solicitudes', 'POST', payload, {
          'Idempotency-Key': this.nuevaKey,
        })
      ).encuesta;
      this.encuestas = [saved, ...this.encuestas.filter((s) => s.id !== saved.id)];
      this.verTodas = false;
      this.verArchivadas = false;
      this.limpiarFiltros();
      this.guardandoNueva = false;
      this.cerrarNueva();
      this.abrir(saved);
      this.mensajeGuardado =
        'Solicitud registrada como Nueva. Puedes confirmarla cuando acordéis el servicio.';
    } catch (error) {
      this.errorNueva =
        error instanceof Error
          ? error.message
          : 'No se pudo confirmar el guardado. Conservamos los datos para reintentar.';
    } finally {
      this.guardandoNueva = false;
      this.changeDetector.markForCheck();
    }
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.respuestaModal.nativeElement.close();
    this.seleccionada = null;
    this.restaurarScroll();
  }

  cerrarDesdeFondo(event: MouseEvent): void {
    const dialog = this.respuestaModal.nativeElement;
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.cerrarModal();
    }
  }

  private restaurarScroll(): void {
    if (this.previousOverflow !== null) {
      this.document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    this.nuevaModal?.nativeElement.close();
    this.restaurarScroll();
  }

  busqueda = '';
  servicio = '';
  estado = '';
  fechaFiltro = '';
  private filtrosAplicados = { busqueda: '', servicio: '', estado: '', fechaFiltro: '' };
  seleccionada: Encuesta | null = null;
  verArchivadas = false;
  verTodas = false;
  mensajeGuardado = '';
  readonly estados: Estado[] = ['Nueva', 'Contactado', 'Aceptada', 'Finalizada'];
  readonly servicios = [...SERVICE_QUESTIONS.map((block) => block.service), 'Otra consulta'];
  encuestas: Encuesta[] = [];
  trabajos: Record<string, any>[] = [];
  get trabajoVinculado(): Record<string, any> | undefined {
    return this.trabajos.find((j) => j['encuestaId'] === this.seleccionada?.id);
  }

  get filtradas(): Encuesta[] {
    const { busqueda, servicio, estado, fechaFiltro } = this.filtrosAplicados;
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return this.encuestas.filter(
      (e) =>
        `${this.referencia(e)} ${e.nombre} ${e.email} ${e.localidad} ${e.servicios.join(' ')}`
          .toLocaleLowerCase('es')
          .includes(texto) &&
        (!servicio || e.servicios.includes(servicio)) &&
        (!estado || e.estado === estado) &&
        (!fechaFiltro || e.fecha === fechaFiltro) &&
        (!this.soloPendientes || e.estado === 'Nueva') &&
        (this.verTodas || e.archivada === this.verArchivadas),
    );
  }

  get activas(): number {
    return this.encuestas.filter((e) => !e.archivada).length;
  }

  get archivadas(): number {
    return this.encuestas.filter((e) => e.archivada).length;
  }

  referencia(encuesta: Encuesta): string {
    return encuesta.referencia;
  }

  abrir(encuesta: Encuesta): void {
    this.seleccionada = { ...encuesta };
    this.mensajeGuardado = '';
    this.changeDetector.detectChanges();
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.respuestaModal.nativeElement.showModal();
  }

  mostrarArchivadas(archivadas: boolean): void {
    this.verTodas = false;
    this.verArchivadas = archivadas;
    this.seleccionada = null;
    this.limpiarFiltros();
  }

  async archivar(encuesta: Encuesta): Promise<void> {
    encuesta.archivada = !encuesta.archivada;
    if (!(await this.guardar())) encuesta.archivada = !encuesta.archivada;
  }

  constructor() {
    void this.cargar();
    this.refreshTimer = setInterval(() => {
      if (
        !this.cargando &&
        !this.guardando &&
        !this.creando &&
        !this.seleccionada &&
        this.document.visibilityState === 'visible'
      )
        void this.refrescar();
    }, 30000);
  }

  private async refrescar(): Promise<void> {
    this.cargando = true;
    try {
      const [surveys, jobs] = await Promise.all([
        this.api.listar(),
        this.api.request<{ registros: Record<string, any>[] }>('/gestion/trabajos'),
      ]);
      this.encuestas = surveys.encuestas;
      this.trabajos = jobs.registros;
      this.errorCarga = '';
    } catch (error) {
      this.errorCarga =
        error instanceof Error ? error.message : 'No se pudieron actualizar las encuestas.';
      if (error instanceof ApiError && error.status === 401) await this.router.navigate(['/login']);
    } finally {
      this.cargando = false;
    }
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.errorCarga = '';
    try {
      const [surveys, jobs] = await Promise.all([
        this.api.listar(),
        this.api.request<{ registros: Record<string, any>[] }>('/gestion/trabajos'),
      ]);
      this.encuestas = surveys.encuestas;
      this.trabajos = jobs.registros;
      const params = this.route.snapshot.queryParamMap;
      this.verArchivadas = params.get('archivadas') === 'true';
      this.verTodas = params.get('todas') === 'true';
      const estado = params.get('estado');
      this.estado = this.estados.includes(estado as Estado) ? estado! : '';
      this.buscar();
      this.soloPendientes = params.get('pendientes') === 'true';
      const respuesta = this.encuestas.find((e) => e.id === params.get('respuesta'));
      if (respuesta) {
        this.verArchivadas = respuesta.archivada;
        this.abrir(respuesta);
      }
    } catch (error) {
      this.errorCarga =
        error instanceof Error ? error.message : 'No se pudieron cargar las encuestas.';
      if (error instanceof ApiError && error.status === 401) await this.router.navigate(['/login']);
    } finally {
      this.cargando = false;
    }
  }

  async guardar(): Promise<boolean> {
    if (!this.seleccionada || this.guardando) return false;
    this.guardando = true;
    this.mensajeGuardado = '';
    try {
      const saved = (await this.api.guardar(this.seleccionada)).encuesta;
      this.encuestas = this.encuestas.map((e) => (e.id === saved.id ? saved : e));
      this.mensajeGuardado = 'Cambios guardados correctamente.';
      this.guardando = false;
      this.cerrarModal();
      return true;
    } catch (error) {
      this.mensajeGuardado =
        error instanceof Error ? error.message : 'No se pudieron guardar los cambios.';
      return false;
    } finally {
      this.guardando = false;
    }
  }

  async confirmarTrabajo(): Promise<void> {
    if (!this.seleccionada || this.guardando) return;
    const existing = this.trabajoVinculado;
    if (existing) {
      this.cerrarModal();
      await this.router.navigate(['/admin/trabajos'], {
        queryParams: { registro: existing['id'] },
      });
      return;
    }
    this.guardando = true;
    this.mensajeGuardado = '';
    try {
      const saved = (await this.api.guardar({ ...this.seleccionada, estado: 'Aceptada' })).encuesta;
      this.encuestas = this.encuestas.map((s) => (s.id === saved.id ? saved : s));
      this.seleccionada = saved;
      const jobs = await this.api.request<{ registros: Record<string, any>[] }>(
        '/gestion/trabajos',
      );
      this.trabajos = jobs.registros;
      const job = jobs.registros.find((j) => j['encuestaId'] === saved.id);
      if (!job) throw new Error('La solicitud está aceptada. Actualiza para abrir el trabajo.');
      this.guardando = false;
      this.cerrarModal();
      await this.router.navigate(['/admin/trabajos'], { queryParams: { registro: job['id'] } });
    } catch (error) {
      this.mensajeGuardado =
        error instanceof Error ? error.message : 'No se pudo confirmar el trabajo.';
    } finally {
      this.guardando = false;
    }
  }
  whatsapp(encuesta: Encuesta): string {
    return `https://wa.me/${encuesta.telefonoInternacional.replace(/\D/g, '')}`;
  }

  correo(encuesta: Encuesta): string {
    return `mailto:${encuesta.email}?subject=${encodeURIComponent('Tu solicitud ' + encuesta.referencia + ' · Soluciones Chira')}`;
  }

  get estadoVisible(): string {
    if (this.verTodas) return 'Todas las solicitudes';
    if (this.verArchivadas) return 'Archivadas';
    if (this.soloPendientes) return 'Pendientes de revisar';
    return this.filtrosAplicados.estado || 'Activas';
  }

  readonly iconosEstado: Record<Estado, string> = {
    Nueva: 'pi-bell',
    Contactado: 'pi-phone',
    Aceptada: 'pi-thumbs-up',
    Finalizada: 'pi-check-circle',
  };

  estadoSeleccionado(estado: Estado | ''): boolean {
    return (
      !this.verTodas &&
      !this.verArchivadas &&
      !this.soloPendientes &&
      this.filtrosAplicados.estado === estado
    );
  }

  filtrarEstado(estado: Estado): void {
    this.mostrarArchivadas(false);
    this.estado = estado;
    this.buscar();
  }

  totalEstado(estado: Estado): number {
    return this.encuestas.filter((e) => !e.archivada && e.estado === estado).length;
  }

  fechaVisible(fecha: string): string {
    return fecha.split('-').reverse().join('/');
  }

  buscar(): void {
    this.soloPendientes = false;
    this.filtrosAplicados = {
      busqueda: this.busqueda,
      servicio: this.servicio,
      estado: this.estado,
      fechaFiltro: this.fechaFiltro,
    };
  }

  limpiarFiltros(): void {
    this.busqueda = this.servicio = this.estado = this.fechaFiltro = '';
    this.buscar();
  }
}
