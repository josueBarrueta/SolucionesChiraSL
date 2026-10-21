import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './nosotros.component.html',
  styleUrls: ['./nosotros.component.scss'],
})
export class NosotrosComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly fotoActiva = signal(0);
  readonly galeriaEnPausa = signal(false);
  readonly fotosEquipo = [
    { imagen: 'images/trabajos/montaje-mampara-oficina.webp', descripcion: 'Miembro del equipo trabajando en una mampara de cristal' },
    { imagen: 'images/trabajos/equipo-mudanzas.webp', descripcion: 'Dos compañeros de Chira junto a la furgoneta' },
    { imagen: 'images/trabajos/carga-muebles.webp', descripcion: 'Miembro del equipo cargando un mueble en la furgoneta' },
    { imagen: 'images/collage/chira-porte-sillas.webp', descripcion: 'Carga de sillas de oficina en una furgoneta' },
    { imagen: 'images/collage/chira-traslado-oficina-cristales.webp', descripcion: 'Compañeros desmontando una mampara de cristal' },
    { imagen: 'images/collage/chira-CwnX-joIPtM-2.webp', descripcion: 'Trabajador montando una cama con almacenaje' },
    { imagen: 'images/collage/chira-CwnX-joIPtM-4.webp', descripcion: 'Trabajador ajustando las divisiones de un mueble' },
  ];
  private readonly destroyRef = inject(DestroyRef);

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        gsap.registerPlugin(ScrollTrigger);
        const root: HTMLElement = this.element.nativeElement;
        const media = gsap.matchMedia();
        media.add('(prefers-reduced-motion: no-preference)', () => {
          gsap.from(root.querySelectorAll('.nosotros-intro > *, .hero-photo'), {
            y: 24, opacity: 0, duration: .85, stagger: .1, ease: 'power3.out'
          });
          root.querySelectorAll('.dato, .team-gallery, .historia-texto, .seccion-intro, .valor, .nosotros-cta').forEach(item => {
            gsap.from(item, {
              y: 24, opacity: 0, duration: .8, ease: 'power2.out',
              scrollTrigger: {trigger: item, start: 'top 92%', once: true}
            });
          });
          const timer = window.setInterval(() => {
            const gallery = root.querySelector('.team-gallery');
            const bounds = gallery?.getBoundingClientRect();
            if (document.hidden || this.galeriaEnPausa() || !bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
            this.zone.run(() => this.fotoActiva.update(index => (index + 1) % this.fotosEquipo.length));
          }, 5000);
          return () => window.clearInterval(timer);
        }, root);
        this.destroyRef.onDestroy(() => media.revert());
      });
    });
    this.title.setTitle(
      'Sobre nosotros | Soluciones Chira SL'
    );

    this.meta.updateTag({
      name: 'description',
      content:
        'Conoce Soluciones Chira SL, empresa con sede en Valencia, sus servicios para hogares y negocios y su propuesta de trabajo.',
    });
  }
}