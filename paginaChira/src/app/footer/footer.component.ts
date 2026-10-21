import { ResponsiveImageDirective } from '../shared/responsive-image.directive';
import { WhatsappDirective } from '../shared/whatsapp.directive';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [ResponsiveImageDirective, RouterLink, WhatsappDirective],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {}
