import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  showPassword = false;
  error = '';
  loading = false;

  async acceder(): Promise<void> {
    if (this.loading) return;
    this.error = '';
    this.showPassword = false;
    this.loading = true;
    try {
      await this.auth.login(this.username, this.password);
      this.password = '';
      await this.router.navigate(['/admin']);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      this.password = '';
    } finally {
      this.loading = false;
    }
  }
}
