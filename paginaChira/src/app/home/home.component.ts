import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal
} from '@angular/core';

import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Trabajo {
  id: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  imagen: string;
  alt: string;
  pendiente: boolean;
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

  @ViewChild('visor')
  private visor?: ElementRef<HTMLDialogElement>;

  readonly filtro = signal('Todos');
  readonly trabajoActivo = signal<Trabajo | null>(null);
  readonly imagenesFallidas = signal<Set<string>>(new Set());

  readonly categorias = [
    'Todos',
    'Portes',
    'Montaje',
    'Mudanzas',
    'Vaciados',
    'Limpieza',
    'Pintura'
  ];

  // Cada elemento es una fotografía del collage.
  // Puedes añadir varias fotografías de una misma categoría.
  // Cada fotografía debe tener un id diferente.
  //
  // Para añadir una foto:
  // imagen: '/images/nombre-de-tu-foto.webp'
  //
  // Actualiza título, descripción y alt con datos reales.
  // Cambia pendiente a false cuando esté completa.
  readonly trabajos: Trabajo[] = [
    {
      id: 'porte-01',
      categoria: 'Portes',
      titulo: 'Fotografía de portes',
      descripcion: 'Fotografía de un trabajo de portes pendiente de añadir.',
      imagen: '',
      alt: '',
      pendiente: true
    },
    {
      id: 'montaje-01',
      categoria: 'Montaje',
      titulo: 'Fotografía de montaje',
      descripcion: 'Fotografía de un montaje de muebles pendiente de añadir.',
      imagen: '',
      alt: '',
      pendiente: true
    },
    {
      id: 'mudanza-01',
      categoria: 'Mudanzas',
      titulo: 'Fotografía de mudanza',
      descripcion: 'Fotografía de una mudanza pendiente de añadir.',
      imagen: '',
      alt: '',
      pendiente: true
    },
    {
      id: 'vaciado-01',
      categoria: 'Vaciados',
      titulo: 'Fotografía de vaciado',
      descripcion: 'Fotografía de un vaciado pendiente de añadir.',
      imagen: '',
      alt: '',
      pendiente: true
    },
    {
      id: 'limpieza-01',
      categoria: 'Limpieza',
      titulo: 'Fotografía de limpieza',
      descripcion: 'Fotografía de un trabajo de limpieza pendiente de añadir.',
      imagen: '',
      alt: '',
      pendiente: true
    },
    {
      id: 'pintura-01',
      categoria: 'Pintura',
      titulo: 'Fotografía de pintura',
      descripcion: 'Fotografía de un trabajo de pintura pendiente de añadir.',
      imagen: '',
      alt: '',
      pendiente: true
    }
  ];

  readonly trabajosFiltrados = computed(() => {
    if (this.filtro() === 'Todos') {
      return this.trabajos;
    }

    return this.trabajos.filter(
      (trabajo) => trabajo.categoria === this.filtro()
    );
  });

  readonly hayPendientes = computed(() =>
    this.trabajosFiltrados().some((trabajo) => trabajo.pendiente)
  );

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

  seleccionarCategoria(categoria: string): void {
    this.filtro.set(categoria);

    // Actualiza los puntos de animación después de cambiar
    // la altura del collage.
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        if (!this.element.nativeElement.isConnected) {
          return;
        }

        ScrollTrigger.refresh();
      });
    });
  }

  abrirTrabajo(trabajo: Trabajo): void {
    const dialogo = this.visor?.nativeElement;

    if (!dialogo || dialogo.open) {
      return;
    }

    this.trabajoActivo.set(trabajo);
    dialogo.showModal();
  }

  cerrarVisor(): void {
    this.visor?.nativeElement.close();
  }

  cerrarDesdeFondo(evento: MouseEvent): void {
    const dialogo = this.visor?.nativeElement;

    if (!dialogo || evento.target !== dialogo) {
      return;
    }

    const limites = dialogo.getBoundingClientRect();

    const fueraDelDialogo =
      evento.clientX < limites.left ||
      evento.clientX > limites.right ||
      evento.clientY < limites.top ||
      evento.clientY > limites.bottom;

    if (fueraDelDialogo) {
      this.cerrarVisor();
    }
  }

  marcarImagenFallida(id: string): void {
    this.imagenesFallidas.update(
      (actuales) => new Set([...actuales, id])
    );
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
    this.visor?.nativeElement.close();
    this.media?.revert();
  }
}