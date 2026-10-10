import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SERVICIOS } from './servicios.data';

@Component({
  selector: 'app-servicio',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './servicio.component.html',
  styleUrls: ['./servicio.component.scss']
})
export class ServicioComponent {
  readonly services = SERVICIOS;
  service = SERVICIOS[0];

  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.service =
          SERVICIOS.find((item) => item.slug === data['service']) ?? SERVICIOS[0];
        this.title.setTitle(
          `${this.service.name} en Valencia | Soluciones Chira SL`
        );
        this.meta.updateTag({
          name: 'description',
          content:
            `${this.service.description} Valencia y alrededores. Solicita un presupuesto sin compromiso.`
          });
      });
  }
}
