import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  private media?: ReturnType<typeof gsap.matchMedia>;

  constructor() {
    this.title.setTitle(
      'Soluciones Chira SL | Servicios para tu hogar y negocio en Valencia'
    );

    this.meta.updateTag({
      name: 'description',
      content:
        'Portes, mudanzas, montaje de muebles, vaciados, limpieza y pintura en Valencia y alrededores. Contacta con Soluciones Chira SL y consulta tu proyecto.'
    });

    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.startAnimations();
      });
    });
  }

  private startAnimations(): void {
    gsap.registerPlugin(ScrollTrigger);

    const root = this.element.nativeElement;

    this.media = gsap.matchMedia();

    this.media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const intro = gsap.timeline({
          defaults: {
            duration: 0.8,
            ease: 'power3.out'
          }
        });

        intro
          .from('.hero-enter', {
            y: 24,
            opacity: 0,
            stagger: 0.12
          })
          .from(
            '.hero-visual',
            {
              y: 30,
              opacity: 0,
              duration: 1
            },
            0.15
          )
          .from(
            '.experience-badge',
            {
              y: 16,
              scale: 0.95,
              opacity: 0,
              duration: 0.6
            },
            0.65
          );

        root.querySelectorAll('.reveal').forEach((item: Element) => {
          gsap.from(item, {
            y: 28,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 92%',
              once: true
            }
          });
        });
      },
      root
    );

    this.media.add(
      '(min-width: 951px) and (prefers-reduced-motion: no-preference)',
      () => {
        gsap.fromTo(
          '.hero-photo img',
          {
            scale: 1.08,
            yPercent: -2
          },
          {
            scale: 1.08,
            yPercent: 2,
            ease: 'none',
            scrollTrigger: {
              trigger: root.querySelector('.hero'),
              start: 'top top',
              end: 'bottom top',
              scrub: 1
            }
          }
        );
      },
      root
    );
  }

  ngOnDestroy(): void {
    this.media?.revert();
  }
}