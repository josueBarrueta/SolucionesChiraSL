import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError, ChiraApiService, Encuesta } from '../../shared/chira-api.service';

type AgendaTrabajo = Encuesta & { gestionId?: string };

@Component({
  selector: 'app-admin-agenda',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-agenda.component.html',
  styleUrls: ['./admin-agenda.component.scss']
})
export class AdminAgendaComponent implements OnDestroy {
  @ViewChild('diaModal', { static: true }) private diaModal!: ElementRef<HTMLDialogElement>;
  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private previousOverflow: string | null = null;

  abrirDia(fecha: string): void {
    this.seleccion = fecha;
    this.changeDetector.detectChanges();
    if (!this.diaModal.nativeElement.open) {
      this.previousOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
      this.diaModal.nativeElement.showModal();
    }
  }
  cerrarDia(): void {
    this.diaModal.nativeElement.close();
    this.restaurarScroll();
  }
  cerrarDesdeFondo(event: MouseEvent): void {
    const dialog = this.diaModal.nativeElement;
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.cerrarDia();
  }
  private restaurarScroll(): void {
    if (this.previousOverflow !== null) {
      this.document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }
  ngOnDestroy(): void { this.restaurarScroll(); }

  private readonly api = inject(ChiraApiService);
  private readonly router = inject(Router);
  readonly hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
  mes = new Date(Number(this.hoy.slice(0, 4)), Number(this.hoy.slice(5, 7)) - 1, 1);
  seleccion = this.hoy;
  encuestas: AgendaTrabajo[] = [];
  cargando = true;
  error = '';
  mostrarFinalizadas = false;
  readonly diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  constructor() { void this.cargar(); }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const [surveys, jobs, clients] = await Promise.all([
        this.api.listar(), this.api.request<{registros: Record<string, any>[]}>('/gestion/trabajos'),
        this.api.request<{registros: Record<string, any>[]}>('/gestion/clientes')
      ]);
      const linked = new Set(jobs.registros.map(job => job['encuestaId']).filter(Boolean));
      const records: AgendaTrabajo[] = jobs.registros.filter(job => job['estado'] !== 'Cancelado').map(job => {
        const client = clients.registros.find(c => c['id'] === job['clienteId']);
        const survey = surveys.encuestas.find(e => e.id === job['encuestaId']);
        return { id: `trabajo-${job['id']}`, gestionId: job['id'], referencia: survey?.referencia ?? 'Trabajo manual',
          nombre: client?.['nombre'] ?? job['titulo'], fecha: job['fecha'] || '', servicios: [job['titulo']],
          telefono: client?.['telefono'] ?? '', telefonoInternacional: '', localidad: client?.['localidad'] ?? '',
          direccion: job['direccion'] ?? '', codigoPostal: client?.['codigoPostal'] ?? '', piso:'',puerta:'',escalera:'',
          mensaje: job['descripcion'] ?? '', fechaTrabajo: job['fecha'] ?? '', archivada: job['archivada'],
          estado: job['estado'] === 'Finalizado' ? 'Finalizada' : 'Aceptada', email: client?.['email'] ?? '',
          respuestas:[], notas: job['notas'] ?? '' };
      });
      this.encuestas = [...records, ...surveys.encuestas.filter(survey => !linked.has(survey.id))];
    }
    catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar la agenda.';
      if (error instanceof ApiError && error.status === 401) await this.router.navigate(['/login']);
    } finally { this.cargando = false; }
  }

  private fecha(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  get tituloMes(): string { return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(this.mes); }
  get fechaSeleccionada(): string {
    const [year, month, day] = this.seleccion.split('-').map(Number);
    return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
  }
  get visibles(): AgendaTrabajo[] { return this.encuestas.filter(e => !e.archivada && (this.mostrarFinalizadas || e.estado !== 'Finalizada')); }
  get dias(): { fecha: string; numero: number; delMes: boolean; trabajos: AgendaTrabajo[] }[] {
    const inicio = new Date(this.mes.getFullYear(), this.mes.getMonth(), 1);
    inicio.setDate(1 - (inicio.getDay() + 6) % 7);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + index);
      const fecha = this.fecha(date);
      return { fecha, numero: date.getDate(), delMes: date.getMonth() === this.mes.getMonth(), trabajos: this.visibles.filter(e => e.fechaTrabajo === fecha) };
    });
  }
  get trabajosDia(): AgendaTrabajo[] { return this.visibles.filter(e => e.fechaTrabajo === this.seleccion); }
  get sinFecha(): AgendaTrabajo[] { return this.encuestas.filter(e => !e.archivada && e.estado === 'Aceptada' && !e.fechaTrabajo); }
  get totalMes(): number { return this.visibles.filter(e => e.fechaTrabajo.startsWith(this.fecha(this.mes).slice(0, 7))).length; }
  cambiarMes(delta: number): void {
    this.mes = new Date(this.mes.getFullYear(), this.mes.getMonth() + delta, 1);
    this.seleccion = this.fecha(this.mes);
  }
  irHoy(): void {
    this.mes = new Date(Number(this.hoy.slice(0, 4)), Number(this.hoy.slice(5, 7)) - 1, 1);
    this.seleccion = this.hoy;
  }
}
