import { Component } from '@angular/core';
import { GestionComponent } from '../gestion/gestion.component';
@Component({
  selector: 'app-admin-gastos',
  standalone: true,
  imports: [GestionComponent],
  templateUrl: './admin-gastos.component.html',
  styleUrls: ['./admin-gastos.component.scss'],
})
export class AdminGastosComponent {}
