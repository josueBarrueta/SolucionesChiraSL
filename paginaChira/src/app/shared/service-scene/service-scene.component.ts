import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-service-scene',
  standalone: true,
  templateUrl: './service-scene.component.html',
  styleUrls: ['./service-scene.component.scss'],
})
export class ServiceSceneComponent {
  readonly kind = input('mudanzas');
  readonly ambient = input(false);
  readonly borderless = input(false);
  readonly panoramic = input(false);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        gsap.registerPlugin(ScrollTrigger);
        const root: HTMLElement = this.element.nativeElement;
        let loop: gsap.core.Timeline | undefined;
        let visible = false;
        let entered = false;
        const sync = () => {
          if (visible && entered && !document.hidden) loop?.play();
          else loop?.pause();
        };
        const observer = new IntersectionObserver(
          (entries) => {
            visible = entries[0].isIntersecting;
            sync();
          },
          { threshold: 0.15 },
        );
        observer.observe(root);
        document.addEventListener('visibilitychange', sync);
        const media = gsap.matchMedia();
        media.add(
          '(prefers-reduced-motion: no-preference)',
          () => {
            entered = false;
            if (this.ambient()) {
              loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
              const movers = root.querySelectorAll('.scene-move');
              const pieces = root.querySelectorAll('.scene-piece');
              const finishes = root.querySelectorAll('.scene-finish');
              if (this.kind() === 'derribos' && this.panoramic()) {
                this.demolitionSequence(root, loop);
              } else if (this.kind() === 'derribos') {
                const arm = root.querySelector('.demolition-arm');
                loop
                  .to(arm, {
                    rotation: -8,
                    svgOrigin: '230 171',
                    duration: 1.6,
                    ease: 'sine.inOut',
                  })
                  .to(arm, { rotation: 0, duration: 1.6, ease: 'sine.inOut' });
              } else if (this.panoramic()) {
                switch (this.kind()) {
                  case 'portes':
                    const truck = root.querySelector('.truck-trip');
                    const cargo = root.querySelectorAll('.truck-cargo');
                    gsap.set(truck, { x: -620 });
                    gsap.set(cargo, { opacity: 0 });
                    loop
                      .set(truck, { x: -620 })
                      .set(cargo, { opacity: 0, x: 130, y: 112 })
                      .to(truck, { x: 0, duration: 2.6, ease: 'power2.out' })
                      .to(cargo, {
                        x: 0,
                        y: 0,
                        opacity: 1,
                        stagger: 0.65,
                        duration: 1.1,
                        ease: 'power2.inOut',
                      })
                      .to({}, { duration: 1 })
                      .to(truck, { x: 650, duration: 3, ease: 'power2.in' });

                    break;
                  case 'montaje': {
                    const furniture = Array.from(
                      root.querySelectorAll<SVGElement>('.assembled-furniture'),
                    );
                    const allParts = root.querySelectorAll('.assembly-part');
                    gsap.set(allParts, { opacity: 0 });
                    loop.set(allParts, { opacity: 0 });
                    furniture.forEach((item, index) => {
                      const parts = Array.from(item.querySelectorAll<SVGElement>('.assembly-part'));
                      const start = index * 2.6;
                      loop!.set(item, { x: 0 }, start);
                      parts.forEach((part, i) => {
                        const x = Number(part.dataset['fromX']) * 0.35;
                        const y = Number(part.dataset['fromY']) * 0.35;
                        loop!.fromTo(
                          part,
                          { x, y, opacity: 0 },
                          {
                            x: 0,
                            y: 0,
                            opacity: 1,
                            duration: 0.7,
                            ease: 'sine.inOut',
                            immediateRender: false,
                          },
                          start + i * 0.1,
                        );
                      });
                      loop!
                        .to(item, { x: 650, duration: 0.8, ease: 'power2.in' }, start + 1.75)
                        .set(parts, { opacity: 0 }, start + 2.55);
                    });
                    break;
                  }
                  case 'mudanzas': {
                    const origin = root.querySelector('.move-origin-house');
                    const destination = root.querySelector('.move-destination-house');
                    const truck = root.querySelector('.move-truck');
                    const scenery = root.querySelector('.move-landscape');
                    const cargo = Array.from(root.querySelectorAll('.move-cargo'));
                    gsap.set(truck, { x: -620 });
                    gsap.set([destination, scenery], { x: 620 });
                    cargo.forEach((box) => gsap.set(box, { x: 245, y: 104 }));
                    loop
                      .set(origin, { x: 0, opacity: 1 })
                      .set(destination, { x: 620, opacity: 1 })
                      .set(truck, { x: -620 })
                      .set(scenery, { x: 620 })
                      .set(cargo, { x: 245, y: 104, scale: 1, opacity: 1 })
                      .to(truck, { x: 0, duration: 1.6, ease: 'power2.out' })
                      .to(
                        cargo,
                        { x: 0, y: 0, duration: 1, stagger: 0.18, ease: 'sine.inOut' },
                        1.7,
                      )
                      .to(origin, { x: -620, duration: 2, ease: 'sine.inOut' }, 3.2)
                      .to(destination, { x: 0, duration: 2, ease: 'sine.inOut' }, 3.2)
                      .to(scenery, { x: -250, duration: 2, ease: 'none' }, 3.2);
                    cargo.forEach((box, i) =>
                      loop!
                        .to(
                          box,
                          {
                            x: 268 - i * 49.5,
                            y: 104,
                            scale: 0.55,
                            transformOrigin: '50% 50%',
                            duration: 0.9,
                            ease: 'sine.inOut',
                          },
                          5.4 + i * 0.2,
                        )
                        .to(box, { opacity: 0, duration: 0.25 }, 6.5 + i * 0.2),
                    );
                    loop
                      .to(truck, { x: 650, duration: 1.4, ease: 'power2.in' }, 7)
                      .to(destination, { opacity: 0, duration: 0.4 }, 8.2);
                    break;
                  }
                  case 'vaciados': {
                    const boxes = Array.from(root.querySelectorAll('.moving-out-box'));
                    const items = Array.from(root.querySelectorAll<SVGElement>('.packing-item'));
                    gsap.set(boxes, { opacity: 0 });
                    loop
                      .set(boxes, { x: 0, opacity: 0 })
                      .set(items, { x: 0, y: 0, scale: 1, opacity: 0, transformOrigin: '50% 50%' })
                      .to(items, { opacity: 1, stagger: 0.1, duration: 0.5, ease: 'sine.out' })
                      .to(boxes, { opacity: 1, stagger: 0.15, duration: 0.5 }, 1.4);
                    items.forEach((item, i) =>
                      loop!
                        .to(
                          item,
                          {
                            x: Number(item.dataset['packX']),
                            y: Number(item.dataset['packY']),
                            scale: 0.2,
                            duration: 1,
                            ease: 'sine.inOut',
                          },
                          2 + i * 0.3,
                        )
                        .to(item, { opacity: 0, duration: 0.2 }, 2.8 + i * 0.3),
                    );
                    loop
                      .to(
                        boxes,
                        { x: -520, duration: 1.8, stagger: 0.35, ease: 'power2.inOut' },
                        4.6,
                      )
                      .to({}, { duration: 0.8 });
                    break;
                  }
                  case 'limpieza': {
                    const room = root.querySelector('.cleaning-room');
                    const dirt = Array.from(root.querySelectorAll<SVGRectElement>('.window-dirt'));
                    const prints = Array.from(root.querySelectorAll('.floor-footprint'));
                    const squeegee = root.querySelector('.window-squeegee');
                    const mop = root.querySelector('.floor-mop');
                    const trail = root.querySelector('.mop-trail');
                    const sparkles = root.querySelectorAll('.cleaning-sparkle');
                    const windowProgress = { value: 0 },
                      floorProgress = { value: 0 };
                    gsap.set(room, { x: -620 });
                    gsap.set(sparkles, { opacity: 0 });
                    loop.repeatDelay(0);
                    loop
                      .set(room, { x: -620 })
                      .set([windowProgress, floorProgress], { value: 0 })
                      .set(prints, { opacity: 1 })
                      .set(sparkles, { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' })
                      .set(squeegee, { y: 0, opacity: 1 })
                      .set(mop, { x: 0, opacity: 1 })
                      .set(trail, { attr: { width: 0 } });
                    dirt.forEach((patch, i) =>
                      loop!.set(patch, { attr: { y: 94 + i * (80 / 3), height: 80 / 3 } }),
                    );
                    loop.to(room, { x: 0, duration: 1.8, ease: 'power2.out' });
                    loop.to(
                      windowProgress,
                      {
                        value: 1,
                        duration: 3.3,
                        ease: 'sine.inOut',
                        onUpdate: () => {
                          const edge = 94 + 80 * windowProgress.value;
                          gsap.set(squeegee, { y: 80 * windowProgress.value });
                          dirt.forEach((patch, i) => {
                            const top = Math.max(94 + i * (80 / 3), edge);
                            patch.setAttribute('y', String(top));
                            patch.setAttribute(
                              'height',
                              String(Math.max(0, 94 + (i + 1) * (80 / 3) - top)),
                            );
                          });
                        },
                      },
                      2,
                    );
                    loop.to(
                      floorProgress,
                      {
                        value: 1,
                        duration: 4.2,
                        ease: 'sine.inOut',
                        onUpdate: () => {
                          const x = 136 * floorProgress.value;
                          gsap.set(mop, { x });
                          gsap.set(trail, {
                            attr: { width: Math.max(0, Math.min(150, 160 + x - 141)) },
                          });
                          prints.forEach((foot, i) =>
                            gsap.set(foot, {
                              opacity: Math.max(0, Math.min(1, (169 + i * 24 - (160 + x)) / 10)),
                            }),
                          );
                        },
                      },
                      2.35,
                    );
                    loop
                      .to([squeegee, mop], { opacity: 0, duration: 0.4 }, 6.65)
                      .to(
                        sparkles,
                        { opacity: 1, scale: 1, stagger: 0.15, duration: 0.5, ease: 'power2.out' },
                        7.05,
                      )
                      .to(room, { x: 650, duration: 2.1, ease: 'power2.inOut' }, 9.1);
                    break;
                  }
                  case 'pintura': {
                    const wall = root.querySelector('.paint-wall');
                    const rollers = Array.from(root.querySelectorAll('.painting-roller'));
                    const vertical = Array.from(
                      root.querySelectorAll<SVGRectElement>('.paint-vertical'),
                    );
                    const horizontal = Array.from(
                      root.querySelectorAll<SVGRectElement>('.paint-horizontal'),
                    );
                    gsap.set(wall, { x: -620 });
                    loop.repeatDelay(0);
                    loop
                      .set(wall, { x: -620 })
                      .set(vertical, { attr: { height: 0, y: 55 } })
                      .set(horizontal, { attr: { width: 0, x: 245 } })
                      .set(rollers, {
                        opacity: 0,
                        x: -4,
                        y: -11.5,
                        rotation: 180,
                        transformOrigin: '17.5px 5.5px',
                      })
                      .set(rollers[2], {
                        x: -38.4167,
                        y: 17.4167,
                        rotation: 0,
                        smoothOrigin: false,
                      })
                      .to(wall, { x: 0, duration: 1.8, ease: 'power2.out' })
                      .to(rollers, { opacity: 1, duration: 0.25 }, 1.8);
                    const verticalPass = (
                      strip: SVGRectElement,
                      roller: Element,
                      start: number,
                      duration: number,
                      upward = false,
                    ) => {
                      const progress = { value: 0 };
                      loop!.set(progress, { value: 0 }, start).to(
                        progress,
                        {
                          value: 1,
                          duration,
                          ease: 'sine.inOut',
                          onUpdate: () => {
                            const height = 173.5 * progress.value;
                            strip.setAttribute('height', String(height));
                            strip.setAttribute('y', String(upward ? 228.5 - height : 55));
                            const edge = upward ? 228.5 - height : 55 + height;
                            gsap.set(roller, { y: Math.min(156.5, edge - 66.5) });
                          },
                        },
                        start,
                      );
                    };
                    verticalPass(vertical[0], rollers[0], 1.9, 2.2);
                    loop.to(rollers[0], { x: 31, duration: 0.35, ease: 'sine.inOut' }, 4.1);
                    verticalPass(vertical[1], rollers[0], 4.45, 2.35, true);
                    verticalPass(vertical[2], rollers[1], 2.35, 3);
                    loop.to(rollers[1], { x: 31, duration: 0.45, ease: 'sine.inOut' }, 5.35);
                    verticalPass(vertical[3], rollers[1], 5.8, 1.7, true);
                    const horizontalPass = (
                      band: SVGRectElement,
                      start: number,
                      duration: number,
                      reverse = false,
                    ) => {
                      const progress = { value: 0 };
                      loop!.set(progress, { value: 0 }, start).to(
                        progress,
                        {
                          value: 1,
                          duration,
                          ease: 'sine.inOut',
                          onUpdate: () => {
                            const width = 70 * progress.value;
                            band.setAttribute('width', String(width));
                            band.setAttribute('x', String(reverse ? 315 - width : 245));
                            const edge = reverse ? 315 - width : 245 + width;
                            gsap.set(rollers[2], { x: edge - (reverse ? 272.4167 : 283.4167) });
                          },
                        },
                        start,
                      );
                    };
                    horizontalPass(horizontal[0], 2.15, 1.45);
                    loop.to(
                      rollers[2],
                      { x: 42.5833, y: 75.25, duration: 0.4, ease: 'sine.inOut' },
                      3.6,
                    );
                    horizontalPass(horizontal[1], 4, 1.9, true);
                    loop.to(
                      rollers[2],
                      { x: -38.4167, y: 133.0833, duration: 0.4, ease: 'sine.inOut' },
                      5.9,
                    );
                    horizontalPass(horizontal[2], 6.3, 1.4);
                    loop
                      .to(rollers, { opacity: 0, duration: 0.3 }, 8.05)
                      .to(wall, { x: 650, duration: 2.1, ease: 'power2.inOut' }, 8.5);
                    break;
                  }
                }
              } else
                switch (this.kind()) {
                  case 'portes':
                    loop
                      .to(movers, { x: 12, y: -2, duration: 1.4, ease: 'sine.inOut' })
                      .to(movers, { x: 0, y: 0, duration: 1.4, ease: 'sine.inOut' });
                    break;
                  case 'montaje':
                    loop
                      .to(pieces, { y: -7, stagger: 0.15, duration: 0.7, ease: 'sine.inOut' })
                      .to(pieces, { y: 0, stagger: 0.15, duration: 0.9, ease: 'power2.out' })
                      .to(movers, { x: 10, duration: 0.6 })
                      .to(movers, { x: 0, duration: 0.8, ease: 'power2.out' });
                    break;
                  case 'mudanzas':
                    loop
                      .to(movers, { x: 12, y: -4, duration: 1.2, ease: 'sine.inOut' })
                      .to(movers, { x: 0, y: 0, duration: 1.2, ease: 'sine.inOut' });
                    break;
                  case 'vaciados':
                    loop
                      .to(movers, { x: -18, opacity: 0.35, duration: 1.4, ease: 'power2.inOut' })
                      .to(movers, { x: 0, opacity: 1, duration: 1.1, ease: 'power2.inOut' });
                    break;
                  case 'limpieza':
                    loop
                      .to(movers, { x: -24, duration: 1.1, ease: 'sine.inOut' })
                      .to(movers, { x: 0, duration: 1.1, ease: 'sine.inOut' });
                    break;
                  case 'pintura':
                    loop
                      .to(movers, { y: -28, duration: 1.2, ease: 'sine.inOut' })
                      .to(movers, { y: 0, duration: 1.2, ease: 'sine.inOut' });
                    break;
                }
              if (this.panoramic()) {
                // Scale the whole narrative together so overlapping movements keep their rhythm.
                loop.repeatDelay(0.35);
                loop.timeScale((loop.duration() + loop.repeatDelay()) / 8.5);
              }
              if (!this.panoramic() && finishes.length)
                loop
                  .to(finishes, { opacity: 0.5, duration: 0.5, stagger: 0.1 }, 0)
                  .to(finishes, { opacity: 1, duration: 0.6, stagger: 0.1 }, 0.7);
            }
            gsap.set(root.querySelector('.scene'), { autoAlpha: 1 });
            const timeline = gsap.timeline({
              onComplete: () => {
                entered = true;
                sync();
              },
              scrollTrigger: { trigger: root, start: 'top 90%', once: true },
              defaults: { duration: 0.85, ease: 'power3.out' },
            });
            // Each illustration has different parts; only animate groups it actually renders.
            const backdrops = root.querySelectorAll('.scene-backdrop');
            const pieces = root.querySelectorAll('.scene-piece');
            const movers = root.querySelectorAll('.scene-move:not(.demolition-machine)');
            const finishes = root.querySelectorAll('.scene-finish');
            if (backdrops.length)
              timeline.from(backdrops, { opacity: 0, scale: 0.9, transformOrigin: '50% 50%' }, 0);
            if (pieces.length) timeline.from(pieces, { opacity: 0, y: 22, stagger: 0.12 }, 0.15);
            if (movers.length) timeline.from(movers, { x: -55, opacity: 0, duration: 1.2 }, 0.35);
            if (finishes.length)
              timeline.from(
                finishes,
                {
                  scale: 0,
                  opacity: 0,
                  transformOrigin: '50% 50%',
                  stagger: 0.14,
                  ease: 'back.out(1.5)',
                },
                0.75,
              );
          },
          root,
        );
        this.destroyRef.onDestroy(() => {
          observer.disconnect();
          document.removeEventListener('visibilitychange', sync);
          media.revert();
        });
      }),
    );
  }

  private demolitionSequence(root: HTMLElement, loop: gsap.core.Timeline): void {
    const machine = root.querySelector('.demolition-machine');
    const arm = root.querySelector('.demolition-arm');
    const stick = root.querySelector('.demolition-stick');
    const breaker = root.querySelector('.demolition-breaker');
    const bricks = Array.from(root.querySelectorAll('.demolition-brick'));
    const dust = root.querySelector('.demolition-dust');
    const rubble = root.querySelector('.demolition-rubble');
    const tread = root.querySelector('.demolition-tread');
    gsap.set(machine, { x: 640 });
    gsap.set(dust, { opacity: 0 });
    gsap.set(rubble, { opacity: 0 });
    loop.repeatDelay(0.8);
    loop
      .set(machine, { x: 640 })
      .set(bricks, { x: 0, y: 0, rotation: 0, opacity: 1 })
      .set(arm, { rotation: -16, svgOrigin: '230 171' })
      .set(stick, { rotation: 18, svgOrigin: '193 77' })
      .set(breaker, { x: 0, y: 0 })
      .set(dust, { opacity: 0, scale: 0.5, x: 0, y: 0, svgOrigin: '85 187' })
      .set(rubble, { opacity: 0 })
      .to(machine, { x: 0, duration: 2.3, ease: 'power2.out' })
      .fromTo(
        tread,
        { strokeDashoffset: 0 },
        { strokeDashoffset: 70, duration: 2.3, ease: 'none' },
        0,
      )
      .to(arm, { rotation: 0, duration: 1, ease: 'power2.inOut' }, 2.6)
      .to(stick, { rotation: 0, duration: 1, ease: 'power2.inOut' }, 2.6);
    // Three controlled strikes, with falling blocks and a small settling dust cloud.
    for (let strike = 0; strike < 3; strike++) {
      const at = 3.8 + strike * 1.55;
      loop
        .to(breaker, { y: 3, duration: 0.08, repeat: 7, yoyo: true, ease: 'none' }, at)
        .to(
          bricks.slice(strike * 2, strike * 2 + 2),
          {
            y: 90 - strike * 35,
            x: (i: number) => (i ? 18 : -12),
            rotation: (i: number) => (i ? 24 : -18),
            opacity: 0,
            duration: 0.8,
            stagger: 0.12,
            ease: 'power2.in',
          },
          at + 0.25,
        )
        .fromTo(
          dust,
          { opacity: 0, scale: 0.5, y: 0 },
          { opacity: 0.5, scale: 1.3, y: -8, duration: 0.35, ease: 'power2.out' },
          at + 0.25,
        )
        .to(dust, { opacity: 0, scale: 1.8, y: -22, duration: 0.7 }, at + 0.6)
        .to(rubble, { opacity: (strike + 1) / 3, duration: 0.5 }, at + 0.7);
    }
    loop
      .to(arm, { rotation: -16, duration: 0.9, ease: 'power2.inOut' }, 8.6)
      .to(stick, { rotation: 18, duration: 0.9, ease: 'power2.inOut' }, 8.6)
      .to({}, { duration: 0.8 }, 9.5)
      .to(machine, { x: 640, duration: 2.2, ease: 'power2.inOut' }, 10.3)
      .fromTo(
        tread,
        { strokeDashoffset: 70 },
        { strokeDashoffset: 0, duration: 2.2, ease: 'none' },
        10.3,
      )
      .to(rubble, { opacity: 0, duration: 0.4 }, 12.6);
  }
}
