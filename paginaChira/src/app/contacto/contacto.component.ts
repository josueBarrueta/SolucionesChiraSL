import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [],
  templateUrl: './contacto.component.html',
  styleUrls: ['./contacto.component.scss'],
})
export class ContactoComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.title.setTitle(
      'Contacto | Soluciones Chira SL en Valencia'
    );

    this.meta.updateTag({
      name: 'description',
      content:
        'Contacta con Soluciones Chira SL en Valencia. Consulta nuestros servicios de portes, mudanzas, montaje de muebles, vaciados, limpieza y pintura.',
    });
  }
}