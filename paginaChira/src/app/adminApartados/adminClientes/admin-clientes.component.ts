import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-clientes',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-clientes.component.html',
  styleUrls: ['./admin-clientes.component.scss']
})
export class AdminClientesComponent {}
