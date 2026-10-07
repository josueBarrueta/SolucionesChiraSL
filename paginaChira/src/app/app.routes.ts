import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ServiciosComponent } from './servicios/servicios.component'
import { ContactoComponent } from './contacto/contacto.component'
import { NosotrosComponent } from './nosotros/nosotros.component'

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'servicios', component: ServiciosComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'nosotros', component: NosotrosComponent },
  { path: '**', redirectTo: '' }
];