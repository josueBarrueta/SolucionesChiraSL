import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Service {
  id: string;
  number: string;
  title: string;
  category: string;
  description: string;
  features: string[];
  action: string;
}

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.scss']
})
export class ServiciosComponent implements OnDestroy {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone = inject(NgZone);

  private readonly opened = signal<Set<string>>(new Set());
  private media?: ReturnType<typeof gsap.matchMedia>;

  readonly services: Service[] = [
    {
      id: 'portes',
      number: '01',
      title: 'Portes',
      category: 'Transporte',
      description:
        'Trasladamos muebles, electrodomésticos y otros objetos con cuidado desde la recogida hasta la entrega.',
      features: [
        'Traslado de muebles y electrodomésticos',
        'Recogidas y entregas',
        'Atención a particulares y negocios'
      ],
      action: 'Consultar un porte'
    },
    {
      id: 'montaje',
      number: '02',
      title: 'Montaje de muebles',
      category: 'Montaje',
      description:
        'Tus muebles, listos para usar. Nos encargamos del montaje con precisión y cuidado por tu espacio.',
      features: [
        'Muebles para el hogar',
        'Mobiliario de oficina',
        'Montaje de muebles nuevos'
      ],
      action: 'Consultar un montaje'
    },
    {
      id: 'mudanzas',
      number: '03',
      title: 'Mudanzas',
      category: 'Traslados',
      description:
        'Empieza tu nueva etapa con un equipo que te ayude a trasladar tus pertenencias y coordinar el cambio.',
      features: [
        'Mudanzas locales',
        'Traslados nacionales e internacionales',
        'Mudanzas de hogares y negocios'
      ],
      action: 'Consultar una mudanza'
    },
    {
      id: 'vaciados',
      number: '04',
      title: 'Vaciados',
      category: 'Espacios',
      description:
        'Recupera el espacio que necesitas. Cuéntanos qué hay que retirar y dónde para valorar el trabajo.',
      features: [
        'Viviendas y locales',
        'Oficinas',
        'Trasteros'
      ],
      action: 'Consultar un vaciado'
    },
    {
      id: 'limpieza',
      number: '05',
      title: 'Limpieza',
      category: 'Cuidado',
      description:
        'Limpieza a fondo para que tu hogar o lugar de trabajo esté listo para disfrutarlo.',
      features: [
        'Limpieza de hogares',
        'Oficinas y espacios comerciales',
        'Atención a las necesidades de cada espacio'
      ],
      action: 'Consultar una limpieza'
    },
    {
      id: 'pintura',
      number: '06',
      title: 'Pintura',
      category: 'Renovación',
      description:
        'Un nuevo aire para tus espacios. Trabajos de pintura interior y exterior con acabados cuidados.',
      features: [
        'Pintura interior',
        'Pintura exterior',
        'Renovación de hogares y negocios'
      ],
      action: 'Consultar un trabajo de pintura'
    }
  ];

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.startAnimations();
      });
    });
  }

  isOpen(id: string): boolean {
    return this.opened().has(id);
  }

  toggleService(
    id: string,
    panel: HTMLDivElement,
    trigger: HTMLButtonElement
  ): void {
    const opening = !this.isOpen(id);

    if (!opening && panel.contains(document.activeElement)) {
      trigger.focus();
    }

    this.opened.update((current) => {
      const next = new Set(current);

      if (opening) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });

    this.zone.runOutsideAngular(() => {
      // Cancela la animación anterior si se pulsa varias veces.
      gsap.killTweensOf(panel);

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      if (reducedMotion) {
        panel.hidden = !opening;
        gsap.set(panel, { clearProps: 'height,opacity' });
        ScrollTrigger.refresh();
        return;
      }

      if (opening) {
        if (panel.hidden) {
          panel.hidden = false;
          gsap.set(panel, { height: 0, opacity: 0 });
        }

        gsap.to(panel, {
          height: 'auto',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
          onComplete: () => {
            gsap.set(panel, { clearProps: 'height,opacity' });
            ScrollTrigger.refresh();
          }
        });
      } else {
        // Fija la altura actual para animar el cierre desde ella.
        gsap.set(panel, {
          height: panel.getBoundingClientRect().height
        });

        gsap.to(panel, {
          height: 0,
          opacity: 0,
          duration: 0.35,
          ease: 'power2.inOut',
          onComplete: () => {
            panel.hidden = true;
            gsap.set(panel, { clearProps: 'height,opacity' });
            ScrollTrigger.refresh();
          }
        });
      }
    });
  }

  private startAnimations(): void {
    gsap.registerPlugin(ScrollTrigger);

    const root: HTMLElement = this.element.nativeElement;

    this.media = gsap.matchMedia();

    this.media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        gsap.from('.intro-enter', {
          y: 20,
          opacity: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out'
        });

        const items = root.querySelectorAll<HTMLElement>(
          '.service-card, .reveal'
        );

        items.forEach((item: HTMLElement) => {
          gsap.from(item, {
            y: 24,
            opacity: 0,
            duration: 0.7,
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
  }

  ngOnDestroy(): void {
    this.element.nativeElement
      .querySelectorAll<HTMLElement>('.service-panel')
      .forEach((panel) => {
        gsap.killTweensOf(panel);
      });

    this.media?.revert();
  }
}