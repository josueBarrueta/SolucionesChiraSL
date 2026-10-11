import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);

  protected get isPrivatePage(): boolean {
    const path = this.router.url.split(/[?#]/)[0];
    return path === '/login' || path === '/admin' || path.startsWith('/admin/');
  }

  protected readonly title = signal('paginaChira');
}
