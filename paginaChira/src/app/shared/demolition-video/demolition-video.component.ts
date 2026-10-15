import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';

const MEDIA = 'videos/derribos/';

@Component({
  selector: 'app-demolition-video',
  standalone: true,
  templateUrl: './demolition-video.component.html',
  styleUrl: './demolition-video.component.scss'
})
export class DemolitionVideoComponent {
  readonly zones = [
    { name: 'Cocina', before: 'cocina-antes', after: 'cocina-despues' },
    { name: 'Salón', before: 'salon-antes', after: 'salon-despues' },
    { name: 'Planta superior', before: 'planta-superior-antes', after: 'planta-superior-despues' }
  ];
  readonly selected = signal(0);
  readonly paused = signal(false);
  readonly failed = signal(false);
  readonly media = MEDIA;
  private visible = false;
  private readonly injector = inject(Injector);
  private readonly root: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroy = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.paused.set(preference.matches);
      const observer = new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        this.sync();
      }, { threshold: .15 });
      const visibility = () => this.sync();
      const motion = () => { this.paused.set(preference.matches); this.sync(); };
      observer.observe(this.root.nativeElement);
      document.addEventListener('visibilitychange', visibility);
      preference.addEventListener('change', motion);
      this.destroy.onDestroy(() => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        preference.removeEventListener('change', motion);
      });
    });
  }

  advance(): void {
    const videos = Array.from(this.root.nativeElement.querySelectorAll('video'));
    // Both sides must finish before replacing the comparison.
    if (videos.length !== 2 || !videos.every(video => video.ended)) return;
    this.selected.update(index => (index + 1) % this.zones.length);
    this.failed.set(false);
    afterNextRender(() => this.sync(), { injector: this.injector });
  }

  toggle(): void {
    this.paused.update(value => !value);
    this.sync();
  }

  sync(): void {
    for (const video of this.root.nativeElement.querySelectorAll('video')) {
      video.muted = true;
      if (this.visible && !document.hidden && !this.paused() && !video.ended) {
        void video.play().catch(() => {
          if (video.isConnected && video.error === null) {
            this.paused.set(true);
            this.root.nativeElement.querySelectorAll('video').forEach((item: HTMLVideoElement) => item.pause());
          }
        });
      } else {
        video.pause();
      }
    }
  }
}
