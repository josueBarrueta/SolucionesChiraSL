import { PaintingVideoComponent } from '../painting-video/painting-video.component';
import { DemolitionVideoComponent } from '../demolition-video/demolition-video.component';
import { SwipeDirective } from '../swipe.directive';
import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-featured-services',
  standalone: true,
  imports: [
    RouterLink,
    ButtonModule,
    SwipeDirective,
    DemolitionVideoComponent,
    PaintingVideoComponent,
  ],
  templateUrl: './featured-services.component.html',
  styleUrls: ['./featured-services.component.scss'],
})
export class FeaturedServicesComponent {
  readonly active = signal(0);
  private focused = false;
  readonly slides = [
    {
      id: 'derribos',
      name: 'Derribos',
      title: 'Un nuevo espacio.',
      accent: 'Un buen comienzo.',
      description:
        'Prepara tu próxima reforma. Revisamos qué necesitas derribar y qué quieres conservar.',
      action: 'Consultar mi proyecto',
      caption: 'VALORAMOS CADA PROYECTO DESDE EL PRINCIPIO',
    },
    {
      id: 'pintura',
      name: 'Pintura',
      title: 'Un cambio de color.',
      accent: 'Un nuevo aire.',
      description:
        'Dale otro aire a tu hogar o negocio. Valoramos las superficies y el acabado que buscas.',
      action: 'Consultar mi pintura',
      caption: 'TU ESPACIO, CON OTRA MIRADA',
    },
    {
      id: 'vaciados',
      name: 'Vaciados',
      title: 'Deja espacio.',
      accent: 'Abre posibilidades.',
      description:
        'Recupera tu vivienda, local o trastero. Cuéntanos qué quieres retirar y organizamos el vaciado.',
      action: 'Consultar un vaciado',
      image: 'images/trabajos/carga-muebles.webp',
      imageAlt:
        'Miembro del equipo retirando un panel de madera junto a una zona con muebles y materiales',
      caption: 'Espacio para lo que viene.',
    },
    {
      id: 'mudanzas',
      name: 'Mudanzas',
      title: 'Cambiamos de lugar.',
      accent: 'Cuidamos lo que importa.',
      description:
        'Tu hogar cambia de lugar. Nosotros cuidamos de tus muebles y de cada detalle del traslado.',
      action: 'Planificar mi mudanza',
      image: 'images/collage/chira-porte-sillas.webp',
      imageAlt: 'Miembro del equipo cargando sillas en una furgoneta',
      caption: 'De aquí, a tu siguiente etapa.',
    },
  ];
  readonly renderedSlides = [...this.slides, ...this.slides, ...this.slides];
  readonly cursor = signal(this.slides.length);
  readonly resetting = signal(false);
  private moving = false;
  private pending?: number;
  private settleTimer?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private readonly root = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  private visible = false;
  private reduced = false;
  private timer?: ReturnType<typeof setInterval>;
  private touching = false;
  private hovered = false;

  constructor() {
    afterNextRender(() => {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = preference.matches;
      const sync = () => this.restart();
      const motion = () => {
        this.reduced = preference.matches;
        sync();
      };
      const observer = new IntersectionObserver(
        (entries) => {
          this.visible = entries[0].isIntersecting;
          sync();
        },
        { threshold: 0.25 },
      );
      observer.observe(this.root.nativeElement);
      document.addEventListener('visibilitychange', sync);
      preference.addEventListener('change', motion);
      this.destroy.onDestroy(() => {
        clearInterval(this.timer);
        clearTimeout(this.settleTimer);
        cancelAnimationFrame(this.frame);
        observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
        preference.removeEventListener('change', motion);
      });
    });
  }
  position(index: number): number {
    return index - this.cursor();
  }
  select(index: number): void {
    const target = (index + this.slides.length) % this.slides.length;
    if (this.moving) {
      this.pending = target;
      return;
    }
    let delta = target - this.active();
    if (Math.abs(delta) > this.slides.length / 2) delta -= Math.sign(delta) * this.slides.length;
    this.travel(delta);
  }
  move(step: number): void {
    if (this.moving) {
      this.pending = (this.active() + step + this.slides.length) % this.slides.length;
      return;
    }
    this.travel(step);
  }
  private travel(delta: number): void {
    if (!delta) return;
    this.moving = true;
    this.active.set((this.active() + delta + this.slides.length) % this.slides.length);
    this.cursor.update((value) => value + delta);
    this.restart();
    this.settleTimer = setTimeout(
      () => {
        // Recenter on identical copies without animating their wrap-around.
        this.resetting.set(true);
        this.cursor.set(this.slides.length + this.active());
        this.frame = requestAnimationFrame(() => {
          this.frame = requestAnimationFrame(() => {
            this.resetting.set(false);
            this.moving = false;
            const pending = this.pending;
            this.pending = undefined;
            if (pending !== undefined) this.select(pending);
          });
        });
      },
      this.reduced ? 0 : 680,
    );
  }
  setHovered(value: boolean): void {
    this.hovered = value;
    this.restart();
  }
  setTouching(value: boolean): void {
    this.touching = value;
    this.restart();
  }
  setFocused(value: boolean): void {
    this.focused = value;
    this.restart();
  }
  onFocusOut(event: FocusEvent): void {
    if (!this.root.nativeElement.contains(event.relatedTarget as Node | null))
      this.setFocused(false);
  }
  private restart(): void {
    clearInterval(this.timer);
    if (
      !this.visible ||
      this.touching ||
      this.hovered ||
      this.focused ||
      this.reduced ||
      document.hidden
    )
      return;
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(
        () => this.zone.run(() => this.move(1)),
        this.slides[this.active()].id === 'derribos' ? 24000 : 12000,
      );
    });
  }
}
