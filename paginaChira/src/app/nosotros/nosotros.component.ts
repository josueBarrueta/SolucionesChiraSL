import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './nosotros.component.html',
  styleUrls: ['./nosotros.component.scss'],
})
export class NosotrosComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.title.setTitle(
      'Sobre nosotros | Soluciones Chira SL'
    );

    this.meta.updateTag({
      name: 'description',
      content:
        'Conoce Soluciones Chira SL, empresa con sede en Valencia, sus servicios para hogares y negocios y su propuesta de trabajo.',
    });
  }
}