import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InvoicePreviewService } from './invoice-preview.service';
@Component({
  selector: 'app-invoice-preview',
  standalone: true,
  template: `<dialog
    #dialog
    class="invoice-preview"
    aria-labelledby="invoice-preview-title"
    (cancel)="$event.preventDefault(); close()"
  >
    <header>
      <h2 id="invoice-preview-title">{{ title }}</h2>
      <div>
        <button type="button" [disabled]="!loaded || printing" (click)="print()">
          {{ printing ? 'Preparando…' : 'Imprimir / Guardar PDF' }}</button
        ><button type="button" (click)="close()" aria-label="Cerrar vista previa">Cerrar</button>
      </div>
    </header>
    <p>
      Factura en A4. Al imprimir, usa escala 100 % y desactiva los encabezados y pies del navegador.
    </p>
    @if (error) {
      <p role="alert">{{ error }}</p>
    }
    <iframe
      #frame
      [srcdoc]="html"
      sandbox="allow-same-origin allow-modals"
      [title]="title"
      (load)="loaded = true"
    ></iframe>
  </dialog>`,
  styles: [
    `
      dialog {
        width: min(1150px, calc(100vw - 24px));
        height: 95dvh;
        max-height: 95dvh;
        padding: 20px;
        border: 1px solid #d7e1e9;
        border-radius: 16px;
        background: #fff;
        color: #17354d;
        font-family: Arial, sans-serif;
      }
      dialog::backdrop {
        background: #0b172399;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      h2 {
        font-size: 18px;
        margin: 0;
        overflow-wrap: anywhere;
      }
      header div {
        display: flex;
        gap: 10px;
      }
      button {
        min-height: 44px;
        border: 1px solid #d4dfe9;
        border-radius: 9px;
        padding: 12px 16px;
        background: white;
        color: #17354d;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      button:first-child {
        background: #0066b3;
        border-color: #0066b3;
        color: #fff;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      p {
        font-size: 12px;
        color: #64798b;
        line-height: 1.6;
        margin: 16px 0;
      }
      iframe {
        display: block;
        width: 100%;
        height: calc(100% - 112px);
        border: 1px solid #d7e1e9;
        background: #edf0f3;
      }
      @media (max-width: 600px) {
        dialog {
          padding: 14px;
        }
        header {
          align-items: flex-start;
        }
        header div {
          width: 100%;
        }
        header button:first-child {
          flex: 1;
        }
        iframe {
          height: calc(100% - 165px);
        }
      }
    `,
  ],
})
export class InvoicePreviewComponent {
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>;
  private readonly api = inject(InvoicePreviewService);
  private readonly sanitizer = inject(DomSanitizer);
  html: SafeHtml = '';
  title = '';
  loaded = false;
  printing = false;
  error = '';
  constructor() {
    effect(() => {
      const preview = this.api.preview();
      if (!preview) {
        this.dialog?.nativeElement.close();
        return;
      }
      this.title = preview.title;
      this.loaded = false;
      this.printing = false;
      this.error = '';
      // Only our generated document is trusted; all supplied values are escaped by the renderer.
      this.html = this.sanitizer.bypassSecurityTrustHtml(preview.html);
      queueMicrotask(() => {
        const dialog = this.dialog?.nativeElement;
        if (this.api.preview() === preview && dialog?.isConnected && !dialog.open)
          dialog.showModal();
      });
    });
  }
  close(): void {
    this.api.close();
  }
  async print(): Promise<void> {
    const window = this.frame?.nativeElement.contentWindow;
    if (!window || this.printing) return;
    this.printing = true;
    this.error = '';
    try {
      await Promise.all([...window.document.images].map((image) => image.decode().catch(() => {})));
      if (!this.api.preview()) return;
      window.focus();
      window.print();
    } catch {
      this.error = 'No se pudo abrir la impresión. Vuelve a intentarlo.';
    } finally {
      this.printing = false;
    }
  }
}
