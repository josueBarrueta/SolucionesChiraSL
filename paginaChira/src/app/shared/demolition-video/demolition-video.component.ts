import { isPlatformBrowser } from '@angular/common';
import { loadVisibleVideo } from '../lazy-video';
import {
  Component,
  PLATFORM_ID,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  untracked,
  inject,
  input,
  signal,
} from '@angular/core';

const MEDIA = 'videos/derribos/';

@Component({
  selector: 'app-demolition-video',
  standalone: true,
  templateUrl: './demolition-video.component.html',
  styleUrl: './demolition-video.component.scss',
})
export class DemolitionVideoComponent {
  readonly zones = [
    { name: 'Cocina', before: 'cocina-antes', after: 'cocina-despues' },
    { name: 'Salón', before: 'salon-antes', after: 'salon-despues' },
    { name: 'Planta superior', before: 'planta-superior-antes', after: 'planta-superior-despues' },
  ];
  readonly selected = signal(0);
  readonly playbackActive = input(true);
  readonly paused = signal(false);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly failed = signal(false);
  readonly media = MEDIA;
  private visible = false;
  readonly leaving = signal<number | null>(null);
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private readonly root: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroy = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.playbackActive();
      untracked(() => this.sync());
    });
    afterNextRender(() => {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.paused.set(preference.matches);
      const observer = new IntersectionObserver(
        (entries) => {
          this.visible = entries[0].isIntersecting;
          this.sync();
        },
        { threshold: 0.15 },
      );
      const visibility = () => this.sync();
      const motion = () => {
        this.paused.set(preference.matches);
        this.sync();
      };
      observer.observe(this.root.nativeElement);
      document.addEventListener('visibilitychange', visibility);
      preference.addEventListener('change', motion);
      this.destroy.onDestroy(() => {
        clearTimeout(this.transitionTimer);
        observer.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        preference.removeEventListener('change', motion);
      });
    });
  }

  private videos(index: number): HTMLVideoElement[] {
    const pair = this.root.nativeElement.querySelectorAll('.pair')[index];
    return pair ? Array.from(pair.querySelectorAll('video')) : [];
  }

  ready(): void {
    this.advance(this.selected());
    this.sync();
  }

  advance(index: number): void {
    if (!this.playbackActive() || index !== this.selected()) return;
    const current = this.videos(index);
    const next = (index + 1) % this.zones.length;
    // Carga la siguiente pareja al terminar; conserva el último fotograma durante la espera.
    if (current.length === 2 && current.every((video) => video.ended) && this.visible) {
      this.videos(next).forEach(loadVisibleVideo);
    }
    // Keep the final frames visible until both incoming videos can display a frame.
    if (
      current.length !== 2 ||
      !current.every((video) => video.ended) ||
      !this.videos(next).every((video) => video.readyState >= 2)
    )
      return;
    clearTimeout(this.transitionTimer);
    this.leaving.set(index);
    this.selected.set(next);
    this.failed.set(false);
    this.sync();
    this.transitionTimer = setTimeout(() => {
      this.leaving.set(null);
      for (const video of current) video.currentTime = 0;
    }, 650);
  }

  toggle(): void {
    this.paused.update((value) => !value);
    this.sync();
  }

  sync(): void {
    if (!this.browser) return;
    const active = this.videos(this.selected());
    for (const video of this.root.nativeElement.querySelectorAll('video')) {
      video.muted = true;
      if (
        active.includes(video) &&
        this.playbackActive() &&
        this.visible &&
        !document.hidden &&
        !this.paused() &&
        !video.ended
      ) {
        loadVisibleVideo(video);
        void video.play().catch(() => {
          if (video.isConnected && video.error === null) {
            this.paused.set(true);
            this.root.nativeElement
              .querySelectorAll('video')
              .forEach((item: HTMLVideoElement) => item.pause());
          }
        });
      } else {
        video.pause();
      }
    }
  }
}
