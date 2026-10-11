import { Injectable, inject, signal } from '@angular/core';
import { ApiError, ChiraApiService } from '../shared/chira-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ChiraApiService);
  readonly authenticated = signal(false);

  async login(username: string, password: string): Promise<void> {
    const result = await this.api.request<{ token: string }>('/login', 'POST', { username: username.trim(), password });
    this.api.establecerSesion(result.token);
    this.authenticated.set(true);
  }

  async comprobarSesion(): Promise<boolean> {
    try {
      await this.api.request('/session');
      this.authenticated.set(true);
      return true;
    } catch (error) {
      this.authenticated.set(false);
      if (error instanceof ApiError && error.status === 401) return false;
      return false;
    }
  }

  async logout(): Promise<void> {
    try { await this.api.request('/logout', 'POST', {}); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    this.api.establecerSesion('');
    this.authenticated.set(false);
  }
}
