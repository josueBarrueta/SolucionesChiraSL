import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject
} from '@angular/core';

import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Fotografia {
  id: string;
  imagen: string;
  descripcion: string;
  ancho: number;
  alto: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  private media?: ReturnType<typeof gsap.matchMedia>;

  readonly fotografias: Fotografia[] = [
  {
    "id": "chira-montaje-mueble",
    "imagen": "images/collage/chira-montaje-mueble.webp",
    "descripcion": "Sofá gris en forma de L instalado en un salón",
    "ancho": 899,
    "alto": 899
  },
  {
    "id": "chira-porte-sillas",
    "imagen": "images/collage/chira-porte-sillas.webp",
    "descripcion": "Carga de sillas de oficina en una furgoneta",
    "ancho": 1440,
    "alto": 1440
  },
  {
    "id": "chira-traslado-oficina-cristales",
    "imagen": "images/collage/chira-traslado-oficina-cristales.webp",
    "descripcion": "Dos trabajadores desmontando una mampara de cristal en una oficina",
    "ancho": 1080,
    "alto": 1080
  },
  {
    "id": "chira-desmontaje-transporte-montaje",
    "imagen": "images/collage/chira-desmontaje-transporte-montaje.webp",
    "descripcion": "Sofá gris con cojines de colores y mesa de centro en un salón",
    "ancho": 810,
    "alto": 810
  },
  {
    "id": "chira-CrLLvGFIWqP",
    "imagen": "images/collage/chira-CrLLvGFIWqP.webp",
    "descripcion": "Furgoneta con cajas y muebles cargados para un traslado",
    "ancho": 720,
    "alto": 720
  },
  {
    "id": "chira-CsDtYZ9oC6m-1",
    "imagen": "images/collage/chira-CsDtYZ9oC6m-1.webp",
    "descripcion": "Armario de madera montado en una habitación",
    "ancho": 720,
    "alto": 720
  },
  {
    "id": "chira-CsDtYZ9oC6m-2",
    "imagen": "images/collage/chira-CsDtYZ9oC6m-2.webp",
    "descripcion": "Cama de dormitorio con cajones rojos y blancos en su base",
    "ancho": 720,
    "alto": 720
  },
  {
    "id": "chira-CsRnaU7IW0t",
    "imagen": "images/collage/chira-CsRnaU7IW0t.webp",
    "descripcion": "Estructura de madera y mueble durante su montaje",
    "ancho": 720,
    "alto": 720
  },
  {
    "id": "chira-CwnX-joIPtM-2",
    "imagen": "images/collage/chira-CwnX-joIPtM-2.webp",
    "descripcion": "Trabajador montando una cama con base de almacenaje",
    "ancho": 1440,
    "alto": 1440
  },
  {
    "id": "chira-CwnX-joIPtM-3",
    "imagen": "images/collage/chira-CwnX-joIPtM-3.webp",
    "descripcion": "Armario blanco con franja central de acabado madera",
    "ancho": 1200,
    "alto": 1200
  },
  {
    "id": "chira-CwnX-joIPtM-4",
    "imagen": "images/collage/chira-CwnX-joIPtM-4.webp",
    "descripcion": "Trabajador ajustando las divisiones interiores de un mueble",
    "ancho": 1440,
    "alto": 1440
  },
  {
    "id": "chira-CwnX-joIPtM-5",
    "imagen": "images/collage/chira-CwnX-joIPtM-5.webp",
    "descripcion": "Estructura de una cama durante el montaje en un dormitorio",
    "ancho": 1440,
    "alto": 1440
  },
  {
    "id": "chira-montaje-armario-herramientas",
    "imagen": "images/collage/chira-montaje-armario-herramientas.webp",
    "descripcion": "Herramientas y piezas de un armario durante su montaje",
    "ancho": 1440,
    "alto": 1440
  }
];

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