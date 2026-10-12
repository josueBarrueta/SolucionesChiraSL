import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, ElementRef, HostListener, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChiraApiService, Encuesta } from '../shared/chira-api.service';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TooltipModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  private esBarraLateral(): boolean {
    return this.element.nativeElement.ownerDocument.defaultView?.matchMedia('(min-width: 801px)').matches ?? false;
  }

  ampliarBarra(): void {
    if (this.esBarraLateral()) this.barraMinimizada = false;
  }

  ampliarConCursor(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.ampliarBarra();
  }

  @HostListener('document:click', ['$event'])
  minimizarFuera(event: MouseEvent): void {
    if (!this.esBarraLateral()) return;
    const sidebar = this.element.nativeElement.querySelector('.sidebar');
    if (event.target && !sidebar?.contains(event.target as Node)) this.barraMinimizada = true;
  }

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ChiraApiService);
  encuestas: Encuesta[] = [];
  trabajos: (Encuesta & { gestionId?: string })[] = [];
  cargando = true;
  error = '';
  saliendo = false;
  menuAbierto = false;
  barraMinimizada = false;
  grupoAbierto: 'general' | 'gestion' | 'empresa' | null = null;

  ultimaActualizacion = '';
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    void this.actualizar();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.menuAbierto = false;
        this.grupoAbierto = null;
        if (this.isResumen) void this.actualizar();
      }
    });
  }
  alternarGrupo(grupo: 'general' | 'gestion' | 'empresa'): void {
    this.grupoAbierto = this.grupoAbierto === grupo ? null : grupo;
  }

  get nuevas(): number { return this.encuestas.filter(e => !e.archivada && e.estado === 'Nueva').length; }
  get completadas(): number { return this.trabajos.filter(e => !e.archivada && e.estado === 'Finalizada').length; }
  get necesitanAtencion(): Encuesta[] { return this.encuestas.filter(e => !e.archivada && e.estado === 'Nueva').slice(0, 5); }
  get proximosTrabajos(): (Encuesta & { gestionId?: string })[] {
    const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    return this.trabajos.filter(e => !e.archivada && e.fechaTrabajo >= hoy && e.estado !== 'Finalizada')
      .sort((a, b) => a.fechaTrabajo.localeCompare(b.fechaTrabajo)).slice(0, 5);
  }
  fechaVisible(fecha: string): string { return fecha.split('-').reverse().join('/'); }


  async actualizar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const [surveys, jobs, clients] = await Promise.all([this.api.listar(), this.api.request<{registros: Record<string, any>[]}>('/gestion/trabajos'), this.api.request<{registros: Record<string, any>[]}>('/gestion/clientes')]);
      this.encuestas = surveys.encuestas;
      const linked = new Set(jobs.registros.map(job => job['encuestaId']).filter(Boolean));
      this.trabajos = [...jobs.registros.filter(job => job['estado'] !== 'Cancelado').map(job => {
        const client = clients.registros.find(c => c['id'] === job['clienteId']);
        return { id: `trabajo-${job['id']}`, gestionId: job['id'], referencia: job['titulo'], nombre: client?.['nombre'] ?? job['titulo'], fecha: job['fecha'] ?? '', servicios:[job['titulo']], telefono:'', telefonoInternacional:'', localidad:'', direccion:job['direccion'] ?? '', codigoPostal:'', piso:'',puerta:'',escalera:'', mensaje:job['descripcion'] ?? '', fechaTrabajo:job['fecha'] ?? '', archivada:job['archivada'], estado: (job['estado'] === 'Finalizado' ? 'Finalizada' : 'Aceptada') as Encuesta['estado'], email:'',respuestas:[],notas:job['notas'] ?? '' };
      }), ...this.encuestas.filter(e => !linked.has(e.id))];
      this.ultimaActualizacion = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
    catch (error) { this.error = error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.'; }
    finally { this.cargando = false; }
  }

  get pendientes(): number {
    return this.encuestas.filter(e => !e.archivada && e.estado === 'Nueva').length;
  }

  get revisadas(): number {
    return this.encuestas.filter(e => e.estado !== 'Nueva').length;
  }

  protected get isResumen(): boolean {
    return this.router.url.split(/[?#]/)[0].replace(/\/$/, '') === '/admin';
  }

  async cerrarSesion(): Promise<void> {
    if (this.saliendo) return;
    this.saliendo = true;
    this.error = '';
    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cerrar sesión. Inténtalo de nuevo.';
    } finally { this.saliendo = false; }
  }
}
