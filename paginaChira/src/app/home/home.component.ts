import { ResponsiveImageDirective } from '../shared/responsive-image.directive';
import { FeaturedServicesComponent } from '../shared/featured-services/featured-services.component';
import { Component, ElementRef, NgZone, OnDestroy, afterNextRender, inject } from '@angular/core';

import { RouterLink } from '@angular/router';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ResponsiveImageDirective, RouterLink, FeaturedServicesComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private media?: ReturnType<typeof gsap.matchMedia>;

  readonly galleryPhotos = [
    {
      image: 'chira-traslado-oficina-cristales.webp',
      label: 'Desmontaje de mamparas',
      alt: 'Dos miembros del equipo trabajando en una mampara de cristal',
      position: '44% center',
    },
    {
      image: 'chira-CsDtYZ9oC6m-1.webp',
      label: 'Montaje de armario',
      alt: 'Armario de madera montado en una habitación',
      position: 'center',
    },
    {
      image: 'chira-montaje-mueble.webp',
      label: 'Cada pieza en su sitio',
      alt: 'Sofá gris en forma de L instalado en un salón',
      position: 'center 72%',
    },
    {
      image: 'chira-porte-sillas.webp',
      label: 'Traslado de mobiliario',
      alt: 'Carga de sillas en una furgoneta',
      position: 'center',
    },
    {
      image: 'chira-desmontaje-transporte-montaje.webp',
      label: 'Muebles en su nuevo espacio',
      alt: 'Sofá gris con cojines y mesa de centro en un salón',
      position: 'center',
    },
    {
      image: 'chira-CrLLvGFIWqP.webp',
      label: 'Preparados para el traslado',
      alt: 'Furgoneta con cajas y muebles para un traslado',
      position: 'center',
    },
    {
      image: 'chira-CsDtYZ9oC6m-2.webp',
      label: 'Montaje de dormitorio',
      alt: 'Cama con cajones rojos y blancos',
      position: 'center',
    },
    {
      image: 'chira-CsRnaU7IW0t.webp',
      label: 'Montaje, pieza a pieza',
      alt: 'Estructura de madera y mueble durante su montaje',
      position: 'center',
    },
    {
      image: 'chira-CwnX-joIPtM-2.webp',
      label: 'Cuidado en cada montaje',
      alt: 'Trabajador montando una cama con base de almacenaje',
      position: 'center',
    },
    {
      image: 'chira-CwnX-joIPtM-3.webp',
      label: 'Mobiliario para el hogar',
      alt: 'Armario blanco con una franja de acabado de madera',
      position: 'center',
    },
    {
      image: 'chira-CwnX-joIPtM-4.webp',
      label: 'Ajustando cada detalle',
      alt: 'Trabajador ajustando las divisiones interiores de un mueble',
      position: 'center',
    },
    {
      image: 'chira-CwnX-joIPtM-5.webp',
      label: 'Del montaje al resultado',
      alt: 'Estructura de una cama durante su montaje',
      position: 'center',
    },
    {
      image: 'chira-montaje-armario-herramientas.webp',
      label: 'Manos a la obra',
      alt: 'Herramientas y piezas de un armario durante su montaje',
      position: 'center',
    },
  ];

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.startAnimations();
      });
    });
  }

  private startAnimations(): void {
    gsap.registerPlugin(ScrollTrigger);

    const root = this.element.nativeElement as HTMLElement;

    this.media = gsap.matchMedia();

    this.media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const intro = gsap.timeline({
          defaults: {
            duration: 0.8,
            ease: 'power3.out',
          },
        });

        const enter = root.querySelectorAll('.hero-enter');
        if (enter.length)
          intro.from(
            enter,
            {
              y: 24,
              opacity: 0,
              stagger: 0.12,
            },
            0,
          );
        const team = root.querySelector('.team-story');
        const film = root.querySelector('.story-film');
        const map = root.querySelector('.coverage figure');
        if (film && team) {
          const track = film.querySelector<HTMLElement>('.story-film-track');
          const speed = { rate: 24 };
          const applySpeed = () => {
            track?.getAnimations().forEach((animation) => animation.updatePlaybackRate(speed.rate));
          };
          gsap.fromTo(
            speed,
            { rate: 24 },
            {
              rate: 1,
              ease: 'power2.out',
              onUpdate: applySpeed,
              scrollTrigger: {
                trigger: film,
                start: 'top bottom',
                end: 'center center',
                scrub: 0.6,
              },
            },
          );
          applySpeed();
          const heading = team.querySelector('.story-heading');
          const closing = team.querySelector('.story-closing');
          [heading, closing].forEach((text) => {
            if (!text) return;
            gsap.fromTo(
              text,
              { opacity: 0 },
              {
                opacity: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: text,
                  start: 'top 95%',
                  end: 'top 55%',
                  scrub: 0.5,
                },
              },
            );
          });
        }
        if (map) {
          gsap.from(map, {
            opacity: 0,
            duration: 0.8,
            scrollTrigger: { trigger: map, start: 'top 85%', once: true },
          });
        }

        root.querySelectorAll('.reveal').forEach((item: Element) => {
          if (item.closest('.team-story')) return;
          gsap.from(item, {
            y: 28,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 92%',
              once: true,
            },
          });
        });
      },
      root,
    );
  }

  ngOnDestroy(): void {
    this.media?.revert();
  }
}
