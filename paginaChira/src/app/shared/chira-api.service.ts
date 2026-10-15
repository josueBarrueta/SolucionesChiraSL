import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type EstadoEncuesta = 'Nueva' | 'Contactado' | 'Aceptada' | 'Finalizada';
export interface Encuesta {
  id: string;
  referencia: string;
  nombre: string;
  fecha: string;
  servicios: string[];
  telefono: string;
  telefonoInternacional: string;
  localidad: string;
  direccion: string;
  codigoPostal: string;
  piso: string;
  puerta: string;
  escalera: string;
  mensaje: string;
  fechaTrabajo: string;
  archivada: boolean;
  estado: EstadoEncuesta;
  email: string;
  respuestas: { pregunta: string; respuesta: string }[];
  notas: string;
}
export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
@Injectable({ providedIn: 'root' })
export class ChiraApiService {
  private readonly document = inject(DOCUMENT);
  private apiUrl: Promise<string> | null = null;
  private token = '';

  establecerSesion(token: string): void { this.token = token; }

  private async baseUrl(): Promise<string> {
    if (!this.apiUrl) {
      this.apiUrl = (async () => {
        const response = await fetch(new URL('api-config.json', this.document.baseURI), { cache: 'no-store' });
        if (!response.ok) throw new ApiError(0, 'No se pudo cargar la configuración del servidor.');
        const config: { apiUrl?: unknown } = await response.json();
        if (typeof config.apiUrl !== 'string') throw new ApiError(0, 'Configuración del servidor no válida.');
        if (!config.apiUrl) {
          if (this.document.location.hostname.endsWith('.github.io')) {
            throw new ApiError(0, 'El servidor público todavía no está configurado.');
          }
          return '/api';
        }
        const url = new URL(config.apiUrl);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
          throw new ApiError(0, 'La dirección del servidor debe usar HTTPS.');
        }
        return url.href.replace(/\/$/, '') + '/api';
      })().catch(error => { this.apiUrl = null; throw error; });
    }
    return this.apiUrl;
  }

  async puedeComprobarSesion(): Promise<boolean> {
    // Same-origin requests can use the HttpOnly cookie; an external API needs a token.
    const base = await this.baseUrl();
    return Boolean(this.token) || new URL(base, this.document.baseURI).origin === this.document.location.origin;
  }

  async request<T>(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const base = await this.baseUrl();
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method, credentials: 'same-origin',
        headers: { ...headers, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000)
      });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.');
    }
    let data: T & { message?: string };
    try { data = await response.json(); }
    catch { throw new ApiError(response.status, 'El servidor de encuestas no está disponible.'); }
    if (!response.ok) throw new ApiError(response.status, data.message ?? 'No se pudo completar la operación.');
    return data;
  }
  async listar(): Promise<{ encuestas: Encuesta[] }> {
    const data = await this.request<{ encuestas: Encuesta[] }>('/encuestas');
    const anteriores: Record<string, EstadoEncuesta> = {
      'En revisión': 'Nueva', 'Presupuesto enviado': 'Contactado',
      'Aceptado': 'Aceptada', 'Atendida': 'Finalizada'
    };
    return { encuestas: data.encuestas.map(e => ({ ...e, estado: anteriores[e.estado] ?? e.estado })) };
  }
  guardar(encuesta: Encuesta): Promise<{ encuesta: Encuesta }> {
    return this.request(`/encuestas/${encuesta.id}`, 'PATCH', {
      estado: encuesta.estado, notas: encuesta.notas,
      fechaTrabajo: encuesta.fechaTrabajo, archivada: encuesta.archivada
    });
  }
}
