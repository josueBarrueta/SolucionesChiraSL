import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject
} from '@angular/core';

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

  private media?: ReturnType<typeof gsap.matchMedia>;

  constructor() {
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

    // Animaciones para quienes no han solicitado reducir movimiento.
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

        // Cada elemento se anima cuando entra en pantalla.
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

    // Movimiento de la fotografía solo en pantallas grandes.
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