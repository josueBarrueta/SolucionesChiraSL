import { Routes } from '@angular/router';
import { authGuard } from './login/auth.guard';

export const routes: Routes = [
  {
    path: 'servicios/portes',
    data: { service: 'portes' },
    loadComponent: () =>
      import('./servicio/servicio.component').then(
        (m) => m.ServicioComponent
      )
  },
  {
    path: 'servicios/montaje',
    data: { service: 'montaje' },
    loadComponent: () =>
      import('./servicio/servicio.component').then(
        (m) => m.ServicioComponent
      )
  },
  {
    path: 'servicios/mudanzas',
    data: { service: 'mudanzas' },
    loadComponent: () =>
      import('./servicio/servicio.component').then(
        (m) => m.ServicioComponent
      )
  },
  {
    path: 'servicios/vaciados',
    data: { service: 'vaciados' },
    loadComponent: () =>
      import('./servicio/servicio.component').then(
        (m) => m.ServicioComponent
      )
  },
  {
    path: 'servicios/limpieza',
    data: { service: 'limpieza' },
    loadComponent: () =>
      import('./servicio/servicio.component').then(
        (m) => m.ServicioComponent
      )
  },
  {
    path: 'servicios/pintura',
    data: { service: 'pintura' },
    loadComponent: () =>
      import('./servicio/servicio.component').then(
        (m) => m.ServicioComponent
      )
  },

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
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then(
        (m) => m.LoginComponent
      )
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./admin/admin.component').then(
        (m) => m.AdminComponent
      ),
    children: [
      {
        path: 'agenda',
        loadComponent: () => import('./adminApartados/adminAgenda/admin-agenda.component').then(m => m.AdminAgendaComponent)
      },
      {
        path: 'encuestas',
        loadComponent: () =>
          import('./adminApartados/adminEncuestas/admin-encuestas.component').then(
            (m) => m.AdminEncuestasComponent
          )
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
