import { Directive, computed, input } from '@angular/core';

/** Variantes generadas durante la compilación; cada pantalla define sus propios tamaños. */
@Directive({
  selector: 'img[appResponsiveImage]',
  standalone: true,
  host: { '[attr.src]': 'fallback()', '[attr.srcset]': 'srcset()' },
})
export class ResponsiveImageDirective {
  readonly source = input.required<string>({ alias: 'appResponsiveImage' });
  readonly imageWidths = input<readonly number[]>([480, 960]);
  private readonly base = computed(() =>
    this.source()
      .replace(/^images\//, 'images/optimized/')
      .replace(/\.[^.]+$/, ''),
  );
  readonly fallback = computed(() => `${this.base()}.960.webp`);
  readonly srcset = computed(() =>
    this.imageWidths()
      .map((width) => `${this.base()}.${width}.webp ${width}w`)
      .join(', '),
  );
}
