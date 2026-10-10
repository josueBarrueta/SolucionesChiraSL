import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { whatsappLink } from './whatsapp-link';

@Directive({
  selector: 'a[appWhatsapp]',
  standalone: true
})
export class WhatsappDirective {
  private readonly element = inject(ElementRef<HTMLAnchorElement>);

  constructor() {
    this.updateLink();
  }

  // Actualiza el saludo justo antes de abrir el enlace.
  @HostListener('click')
  @HostListener('auxclick')
  @HostListener('contextmenu')
  @HostListener('focus')
  updateLink(): void {
    this.element.nativeElement.href = whatsappLink();
  }
}
