import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  constructor() { void this.actualizar(); }

  async actualizar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try { this.encuestas = (await this.api.listar()).encuestas; }
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
