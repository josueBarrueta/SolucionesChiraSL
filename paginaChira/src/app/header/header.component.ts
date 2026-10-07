import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly router = inject(Router);

  @ViewChild('menuButton')
  private menuButton?: ElementRef<HTMLButtonElement>;

  readonly menuAbierto = signal(false);

  constructor() {
    // También cierra el menú al navegar con atrás o adelante.
    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe((evento) => {
        if (evento instanceof NavigationEnd) {
          this.cerrarMenu();
        }
      });
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarConEscape(evento: Event): void {
    if (!this.menuAbierto()) {
      return;
    }

    evento.preventDefault();
    evento.stopPropagation();

    this.cerrarMenu();
    this.menuButton?.nativeElement.focus();
  }
}