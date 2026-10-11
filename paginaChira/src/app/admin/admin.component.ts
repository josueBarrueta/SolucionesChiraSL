import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChiraApiService, Encuesta } from '../shared/chira-api.service';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ChiraApiService);
  encuestas: Encuesta[] = [];
  cargando = true;
  error = '';
  saliendo = false;

  ultimaActualizacion = '';
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    void this.actualizar();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd && this.isResumen) void this.actualizar();
    });
  }
  get nuevas(): number { return this.encuestas.filter(e => !e.archivada && e.estado === 'Nueva').length; }
  get completadas(): number { return this.encuestas.filter(e => !e.archivada && e.estado === 'Atendida').length; }
  get necesitanAtencion(): Encuesta[] { return this.encuestas.filter(e => !e.archivada && ['Nueva', 'En revisión'].includes(e.estado)).slice(0, 5); }
  get proximosTrabajos(): Encuesta[] {
    const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    return this.encuestas.filter(e => !e.archivada && e.fechaTrabajo >= hoy && e.estado !== 'Atendida')
      .sort((a, b) => a.fechaTrabajo.localeCompare(b.fechaTrabajo)).slice(0, 5);
  }
  fechaVisible(fecha: string): string { return fecha.split('-').reverse().join('/'); }


  async actualizar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try { this.encuestas = (await this.api.listar()).encuestas; this.ultimaActualizacion = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
    catch (error) { this.error = error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.'; }
    finally { this.cargando = false; }
  }

  get pendientes(): number {
    return this.encuestas.filter(e => !e.archivada && ['Nueva', 'En revisión'].includes(e.estado)).length;
  }

  get revisadas(): number {
    return this.encuestas.filter(e => !['Nueva', 'En revisión'].includes(e.estado)).length;
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
