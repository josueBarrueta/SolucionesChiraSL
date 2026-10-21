import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { renderInvoiceDocument } from './invoice-document';
@Injectable({ providedIn: 'root' })
export class InvoicePreviewService {
  private readonly document = inject(DOCUMENT);
  readonly preview = signal<{ title: string; html: string } | null>(null);
  show(
    invoice: Record<string, any>,
    settings: Record<string, any>,
    client: Record<string, any>,
  ): void {
    this.preview.set(renderInvoiceDocument(invoice, settings, client, this.document.baseURI));
  }
  close(): void {
    this.preview.set(null);
  }
}
