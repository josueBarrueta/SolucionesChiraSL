import { FeaturedServicesComponent } from '../shared/featured-services/featured-services.component';
import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FeaturedServicesComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private media?: ReturnType<typeof gsap.matchMedia>;

  readonly mosaicPhotos = [
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
  readonly mosaicSlots = [0, 1, 2];
  readonly mosaicActive = signal([0, 1, 2]);
  private mosaicTimer?: ReturnType<typeof setInterval>;
  private mosaicObserver?: IntersectionObserver;
  private mosaicMotion?: MediaQueryList;
  private mosaicVisible = false;
  private mosaicHovered = false;
  private nextMosaicPhoto = 3;
  private nextMosaicSlot = 0;
  private readonly syncMosaic = () => this.restartMosaic();

  private startMosaic(): void {
    const mosaic = this.element.nativeElement.querySelector('.team-story-mosaic');
    if (!mosaic) return;
    this.mosaicMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mosaicObserver = new IntersectionObserver(
      (entries) => {
        this.mosaicVisible = entries[0].isIntersecting;
        this.restartMosaic();
      },
      { threshold: 0.2 },
    );
    this.mosaicObserver.observe(mosaic);
    this.mosaicMotion.addEventListener('change', this.syncMosaic);
    document.addEventListener('visibilitychange', this.syncMosaic);
  }

  setMosaicHovered(value: boolean): void {
    this.mosaicHovered = value;
    this.restartMosaic();
  }

  private restartMosaic(): void {
    clearInterval(this.mosaicTimer);
    if (!this.mosaicVisible || this.mosaicHovered || this.mosaicMotion?.matches || document.hidden)
      return;
    this.zone.runOutsideAngular(() => {
      this.mosaicTimer = setInterval(() => this.advanceMosaic(), 4500);
    });
  }

  private advanceMosaic(): void {
    const active = this.mosaicActive();
    // Only fade to a loaded photo, and never show the same photo twice at once.
    for (let attempt = 0; attempt < this.mosaicPhotos.length; attempt++) {
      const candidate = this.nextMosaicPhoto++ % this.mosaicPhotos.length;
      if (active.includes(candidate)) continue;
      const img = (this.element.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.story-photo')
        [this.nextMosaicSlot]?.querySelector<HTMLImageElement>(`img[data-photo="${candidate}"]`);
      if (!img?.complete || !img.naturalWidth) continue;
      const next = [...active];
      next[this.nextMosaicSlot] = candidate;
      this.nextMosaicSlot = (this.nextMosaicSlot + 1) % 3;
      this.zone.run(() => this.mosaicActive.set(next));
      return;
    }
  }

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.startAnimations();
        this.startMosaic();
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
        const visual = root.querySelectorAll('.hero-visual');
        const badge = root.querySelectorAll('.experience-badge');
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
        if (visual.length)
          intro.from(
            visual,
            {
              y: 30,
              opacity: 0,
              duration: 1,
            },
            0.15,
          );
        if (badge.length)
          intro.from(
            badge,
            {
              y: 16,
              scale: 0.95,
              opacity: 0,
              duration: 0.6,
            },
            0.65,
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

        root.querySelectorAll('.reveal, .collage-foto').forEach((item: Element) => {
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

    this.media.add(
      '(min-width: 951px) and (prefers-reduced-motion: no-preference)',
      () => {
        const photos = root.querySelectorAll('.hero-photo img');
        const hero = root.querySelector('.hero');
        if (!photos.length || !hero) return;
        gsap.fromTo(
          photos,
          {
            scale: 1.08,
            yPercent: -2,
          },
          {
            scale: 1.08,
            yPercent: 2,
            ease: 'none',
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom top',
              scrub: 1,
            },
          },
        );
      },
      root,
    );
  }

  ngOnDestroy(): void {
    this.media?.revert();
    clearInterval(this.mosaicTimer);
    this.mosaicObserver?.disconnect();
    this.mosaicMotion?.removeEventListener('change', this.syncMosaic);
    this.element.nativeElement.ownerDocument.removeEventListener(
      'visibilitychange',
      this.syncMosaic,
    );
  }
}
