import { DestroyRef, Directive, ElementRef, HostListener, inject, input, output } from '@angular/core';
import { swipeDirection, type SwipeDirection } from './swipe-direction';

@Directive({selector:'[appSwipe]', standalone:true})
export class SwipeDirective {
  readonly swipe = output<SwipeDirection>();
  readonly swipeActive = output<boolean>();
  readonly swipeMaxWidth = input<number | null>(null);
  private start?: {x:number; y:number; id:number};
  private suppressClickUntil = 0;
  private readonly element = inject(ElementRef<HTMLElement>);

  constructor() {
    // A swipe beginning on a link or calendar day must not also activate it.
    const preventSwipeClick = (event:MouseEvent) => {
      if(event.detail > 0 && Date.now() < this.suppressClickUntil) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    this.element.nativeElement.addEventListener('click', preventSwipeClick, true);
    inject(DestroyRef).onDestroy(() => this.element.nativeElement.removeEventListener('click', preventSwipeClick, true));
  }

  @HostListener('touchstart', ['$event'])
  begin(event:TouchEvent): void {
    this.cancel();
    if(event.touches.length !== 1) return;
    const max=this.swipeMaxWidth();
    if(max !== null && !window.matchMedia(`(max-width: ${max}px)`).matches) return;
    if((event.target as Element).closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    const touch=event.touches[0];
    this.start={x:touch.clientX,y:touch.clientY,id:touch.identifier};
    this.swipeActive.emit(true);
  }

  @HostListener('touchmove', ['$event'])
  track(event:TouchEvent): void {
    if(event.touches.length !== 1) {this.cancel(); return;}
    if(!this.start) return;
    const touch=event.touches[0];
    const dx=touch.clientX-this.start.x, dy=touch.clientY-this.start.y;
    if(Math.abs(dy)>12 && Math.abs(dy)>Math.abs(dx)) {this.cancel(); return;}
    if(swipeDirection(dx,dy)) this.suppressClickUntil=Date.now()+700;
  }

  @HostListener('touchend', ['$event'])
  end(event:TouchEvent): void {
    if(!this.start) return;
    const touch=Array.from(event.changedTouches).find(t=>t.identifier===this.start!.id);
    const direction=touch ? swipeDirection(touch.clientX-this.start.x,touch.clientY-this.start.y) : null;
    this.cancel();
    if(direction) {this.suppressClickUntil=Date.now()+700; this.swipe.emit(direction);}
  }

  @HostListener('touchcancel')
  cancel(): void {
    if(!this.start) return;
    this.start=undefined;
    this.swipeActive.emit(false);
  }
}
