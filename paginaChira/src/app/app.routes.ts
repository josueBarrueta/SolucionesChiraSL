import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then(
        (m) => m.HomeComponent
      )
  },
  {
    path: 'servicios',
    loadComponent: () =>
      import('./servicios/servicios.component').then(
        (m) => m.ServiciosComponent
      )
  },
  {
    path: 'contacto',
    loadComponent: () =>
      import('./contacto/contacto.component').then(
        (m) => m.ContactoComponent
      )
  },
  {
    path: 'formulario',
    loadComponent: () =>
      import('./formulario/formulario.component').then(
        (m) => m.FormularioComponent
      )
  },
  {
    path: 'nosotros',
    loadComponent: () =>
      import('./nosotros/nosotros.component').then(
        (m) => m.NosotrosComponent
      )
  },
  {
    path: '**',
    redirectTo: ''
  }
];