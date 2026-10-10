import { WhatsappDirective } from '../shared/whatsapp.directive';
import {
  Component,
  ElementRef,
  HostListener,
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
import { SERVICIOS } from '../servicio/servicios.data';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, WhatsappDirective],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly router = inject(Router);

  @ViewChild('menuButton')
  private menuButton?: ElementRef<HTMLButtonElement>;

  private readonly element = inject(ElementRef<HTMLElement>);

  @ViewChild('servicesButton')
  private servicesButton?: ElementRef<HTMLButtonElement>;

  readonly menuAbierto = signal(false);
  readonly serviciosAbiertos = signal(false);
  readonly services = SERVICIOS;

  alternarServicios(): void {
    this.serviciosAbiertos.update((abierto) => !abierto);
  }

  @HostListener('document:click', ['$event'])
  cerrarFuera(event: Event): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.serviciosAbiertos.set(false);
    }
  }

  cerrarAlSalir(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.serviciosAbiertos.set(false);
    }
  }

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
    this.serviciosAbiertos.set(false);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
    this.serviciosAbiertos.set(false);
  }

  cerrarConEscape(evento: Event): void {
    if (this.serviciosAbiertos()) {
      evento.preventDefault();
      evento.stopPropagation();
      this.serviciosAbiertos.set(false);
      this.servicesButton?.nativeElement.focus();
      return;
    }
    if (!this.menuAbierto()) {
      return;
    }

    evento.preventDefault();
    evento.stopPropagation();

    this.cerrarMenu();
    this.menuButton?.nativeElement.focus();
  }
}