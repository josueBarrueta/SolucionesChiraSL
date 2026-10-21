import { Component } from '@angular/core';
import { GestionComponent } from '../gestion/gestion.component';
@Component({
  selector: 'app-admin-clientes',
  standalone: true,
  imports: [GestionComponent],
  templateUrl: './admin-clientes.component.html',
  styleUrls: ['./admin-clientes.component.scss'],
})
export class AdminClientesComponent {}
