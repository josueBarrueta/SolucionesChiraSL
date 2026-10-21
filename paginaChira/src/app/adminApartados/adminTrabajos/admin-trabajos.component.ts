import { Component } from '@angular/core';
import { GestionComponent } from '../gestion/gestion.component';
@Component({
  selector: 'app-admin-trabajos',
  standalone: true,
  imports: [GestionComponent],
  templateUrl: './admin-trabajos.component.html',
  styleUrls: ['./admin-trabajos.component.scss'],
})
export class AdminTrabajosComponent {}
