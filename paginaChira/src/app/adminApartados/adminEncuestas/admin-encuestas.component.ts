import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SERVICE_QUESTIONS } from '../../formulario/formulario.questions';

import { ApiError, ChiraApiService, Encuesta, EstadoEncuesta } from '../../shared/chira-api.service';
import { Router } from '@angular/router';
type Estado = EstadoEncuesta;

@Component({
  selector: 'app-admin-encuestas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-encuestas.component.html',
  styleUrls: ['./admin-encuestas.component.scss']
})
export class AdminEncuestasComponent implements OnDestroy {
  @ViewChild('respuestaModal', { static: true })
  private respuestaModal!: ElementRef<HTMLDialogElement>;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ChiraApiService);
  private readonly router = inject(Router);
  cargando = true;
  guardando = false;
  errorCarga = '';
  private previousOverflow: string | null = null;

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
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
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
    this.restaurarScroll();
  }

  busqueda = '';
  servicio = '';
  estado = '';
  fechaFiltro = '';
  private filtrosAplicados = { busqueda: '', servicio: '', estado: '', fechaFiltro: '' };
  seleccionada: Encuesta | null = null;
  verArchivadas = false;
  mensajeGuardado = '';
  readonly estados: Estado[] = ['Nueva', 'En revisión', 'Contactado', 'Presupuesto enviado', 'Aceptado', 'Atendida'];
  readonly servicios = [...SERVICE_QUESTIONS.map(block => block.service), 'Otra consulta'];
  encuestas: Encuesta[] = [];

  get filtradas(): Encuesta[] {
    const { busqueda, servicio, estado, fechaFiltro } = this.filtrosAplicados;
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return this.encuestas.filter(e =>
      `${this.referencia(e)} ${e.nombre} ${e.email} ${e.localidad} ${e.servicios.join(' ')}`.toLocaleLowerCase('es').includes(texto) &&
      (!servicio || e.servicios.includes(servicio)) &&
      (!estado || e.estado === estado) &&
      (!fechaFiltro || e.fecha === fechaFiltro) &&
      e.archivada === this.verArchivadas
    );
  }

  get activas(): number {
    return this.encuestas.filter(e => !e.archivada).length;
  }

  get archivadas(): number {
    return this.encuestas.filter(e => e.archivada).length;
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
    this.verArchivadas = archivadas;
    this.seleccionada = null;
    this.limpiarFiltros();
  }

  async archivar(encuesta: Encuesta): Promise<void> {
    encuesta.archivada = !encuesta.archivada;
    if (!await this.guardar()) encuesta.archivada = !encuesta.archivada;
  }

  constructor() { void this.cargar(); }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.errorCarga = '';
    try {
      this.encuestas = (await this.api.listar()).encuestas;
    } catch (error) {
      this.errorCarga = error instanceof Error ? error.message : 'No se pudieron cargar las encuestas.';
      if (error instanceof ApiError && error.status === 401) await this.router.navigate(['/login']);
    } finally { this.cargando = false; }
  }

  async guardar(): Promise<boolean> {
    if (!this.seleccionada || this.guardando) return false;
    this.guardando = true;
    this.mensajeGuardado = '';
    try {
      const saved = (await this.api.guardar(this.seleccionada)).encuesta;
      this.encuestas = this.encuestas.map(e => e.id === saved.id ? saved : e);
      this.mensajeGuardado = 'Cambios guardados correctamente.';
      this.guardando = false;
      this.cerrarModal();
      return true;
    } catch (error) {
      this.mensajeGuardado = error instanceof Error ? error.message : 'No se pudieron guardar los cambios.';
      return false;
    } finally { this.guardando = false; }
  }

  whatsapp(encuesta: Encuesta): string {
    return `https://wa.me/${encuesta.telefonoInternacional.replace(/\D/g, '')}`;
  }

  correo(encuesta: Encuesta): string {
    return `mailto:${encuesta.email}?subject=${encodeURIComponent('Tu solicitud ' + encuesta.referencia + ' · Soluciones Chira')}`;
  }

  totalEstado(estado: Estado): number {
    return this.encuestas.filter(e => !e.archivada && e.estado === estado).length;
  }

  fechaVisible(fecha: string): string {
    return fecha.split('-').reverse().join('/');
  }

  buscar(): void {
    this.filtrosAplicados = {
      busqueda: this.busqueda, servicio: this.servicio,
      estado: this.estado, fechaFiltro: this.fechaFiltro
    };
  }

  limpiarFiltros(): void {
    this.busqueda = this.servicio = this.estado = this.fechaFiltro = '';
    this.buscar();
  }
}
