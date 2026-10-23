import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError, ChiraApiService } from '../../shared/chira-api.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-configuracion.component.html',
  styleUrls: ['../gestion/gestion.component.scss', './admin-configuracion.component.scss'],
})
export class AdminConfiguracionComponent {
  private readonly api = inject(ChiraApiService);
  private readonly router = inject(Router);
  data: Record<string, any> = {
    nombre: 'Soluciones Chira SL',
    nif: '',
    direccion: '',
    email: '',
    telefono: '',
    iban: '',
    moneda: 'EUR',
    ivaPredeterminado: null,
    condiciones: '',
    serieFacturas: '',
    primerNumero: 1,
    programaActual: '',
  };
  readonly fields = [
    { key: 'nombre', label: 'Nombre / razón social' },
    { key: 'nif', label: 'NIF / CIF' },
    { key: 'direccion', label: 'Dirección fiscal' },
    { key: 'email', label: 'Correo de contacto' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'iban', label: 'IBAN para documentos' },
  ];
  loading = true;
  saving = false;
  error = '';
  message = '';
  current = '';
  next = '';
  repeat = '';
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    try {
      this.data = {
        ...this.data,
        ...(
          await this.api.request<{ configuracion: Record<string, any> }>('/gestion/configuracion')
        ).configuracion,
      };
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo cargar.';
      if (e instanceof ApiError && e.status === 401) await this.router.navigate(['/login']);
    } finally {
      this.loading = false;
    }
  }
  async save(): Promise<void> {
    this.saving = true;
    this.error = '';
    this.message = '';
    try {
      await this.api.request('/gestion/configuracion', 'PATCH', this.data);
      this.message = 'Configuración guardada.';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo guardar.';
    } finally {
      this.saving = false;
    }
  }
  async password(): Promise<void> {
    if (this.next !== this.repeat) {
      this.error = 'Las contraseñas nuevas no coinciden.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.message = '';
    try {
      await this.api.request('/gestion/contrasena', 'POST', {
        actual: this.current,
        nueva: this.next,
      });
      this.current = '';
      this.next = '';
      this.repeat = '';
      this.message = 'Contraseña actualizada. Las sesiones anteriores se han invalidado. Vuelve a iniciar sesión con la nueva contraseña.';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo cambiar.';
    } finally {
      this.saving = false;
    }
  }
}
