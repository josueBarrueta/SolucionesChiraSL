import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-facturas',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-facturas.component.html',
  styleUrls: ['./admin-facturas.component.scss']
})
export class AdminFacturasComponent {}
