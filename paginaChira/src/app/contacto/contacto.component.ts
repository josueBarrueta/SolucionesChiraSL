import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './contacto.component.html',
  styleUrls: ['./contacto.component.scss'],
})
export class ContactoComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        gsap.registerPlugin(ScrollTrigger);
        const root: HTMLElement = this.element.nativeElement;
        const media = gsap.matchMedia();
        media.add(
          '(prefers-reduced-motion: no-preference)',
          () => {
            gsap.from(root.querySelectorAll('.contacto-header > *'), {
              y: 20,
              opacity: 0,
              duration: 0.75,
              stagger: 0.1,
              ease: 'power3.out',
            });
            root.querySelectorAll('.contacto-card').forEach((item) => {
              gsap.from(item, {
                y: 24,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: { trigger: item, start: 'top 92%', once: true },
              });
            });
          },
          root,
        );
        this.destroyRef.onDestroy(() => media.revert());
      }),
    );
  }
}
