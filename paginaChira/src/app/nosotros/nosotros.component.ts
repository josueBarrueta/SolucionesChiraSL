import { animatePage } from '../shared/page-motion';
import { ServiceSceneComponent } from '../shared/service-scene/service-scene.component';
import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [RouterLink, ServiceSceneComponent],
  templateUrl: './nosotros.component.html',
  styleUrls: ['./nosotros.component.scss'],
})
export class NosotrosComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly fotoActiva = signal(0);
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
        const cleanup = animatePage(this.element.nativeElement, '.nosotros-intro, .datos, .team-story-heading, .historia-texto, .valor, .nosotros-cta');
        this.destroyRef.onDestroy(cleanup);
      });
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const temporizador = window.setInterval(() => {
        this.fotoActiva.update(indice => (indice + 1) % this.fotosEquipo.length);
      }, 5000);
      this.destroyRef.onDestroy(() => window.clearInterval(temporizador));
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