import { Component, DestroyRef, ElementRef, afterNextRender, effect, untracked, inject, input, signal } from '@angular/core';


@Component({
  selector: 'app-painting-video',
  standalone: true,
  templateUrl: './painting-video.component.html',
  styleUrl: './painting-video.component.scss'
})
export class PaintingVideoComponent {
  readonly companionPhoto = input<string>();
  readonly playbackActive = input(true);
  readonly paused = signal(false);
  readonly failed = signal(false);
  private visible = false;
  private readonly root = inject(ElementRef<HTMLElement>);
  private readonly destroy = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.playbackActive();
      untracked(() => this.sync());
    });
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

  toggle(): void {
    this.paused.update(value => !value);
    this.sync();
  }

  sync(): void {
    for (const video of this.root.nativeElement.querySelectorAll('video')) {
      video.muted = true;
      if (this.playbackActive() && this.visible && !document.hidden && !this.paused()) {
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
