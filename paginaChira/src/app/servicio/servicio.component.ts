import { animatePage } from '../shared/page-motion';
import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SERVICIOS } from './servicios.data';

@Component({
  selector: 'app-servicio',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './servicio.component.html',
  styleUrls: ['./servicio.component.scss'],
})
export class ServicioComponent {
  readonly services = SERVICIOS;
  service = SERVICIOS[0];

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  constructor() {
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        const cleanup = animatePage(
          this.element.nativeElement,
          '.service-title-block, .service-summary, .scope-list > li',
        );
        this.destroyRef.onDestroy(cleanup);
      }),
    );
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.service = SERVICIOS.find((item) => item.slug === data['service']) ?? SERVICIOS[0];
    });
  }
}
