import { SwipeDirective } from '../swipe.directive';
import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-featured-services', standalone: true,
  imports: [RouterLink, ButtonModule, SwipeDirective],
  templateUrl: './featured-services.component.html',
  styleUrls: ['./featured-services.component.scss']
})
export class FeaturedServicesComponent {
  readonly active = signal(0);
  readonly slides = [
    {id:'derribos', name:'Derribos', title:'Un nuevo espacio.', accent:'Un buen comienzo.', description:'¿Estás pensando en renovar? Valoramos tu derribo y lo que necesitas conservar antes de dar el siguiente paso.', action:'Consultar mi proyecto', caption:'VALORAMOS CADA PROYECTO DESDE EL PRINCIPIO'},
    {id:'mudanzas', name:'Mudanzas', title:'Cambiamos de lugar.', accent:'Cuidamos lo que importa.', description:'Te acompañamos en tu próxima etapa. Coordinamos tu mudanza con atención a tus muebles, tus objetos y cada detalle del traslado.', action:'Planificar mi mudanza', caption:'DE AQUÍ, A TU SIGUIENTE ETAPA'},
    {id:'vaciados', name:'Vaciados', title:'Deja espacio.', accent:'Abre posibilidades.', description:'Recupera el espacio de tu vivienda, local o trastero. Cuéntanos qué necesitas retirar y valoramos contigo el trabajo.', action:'Consultar un vaciado', caption:'ESPACIO PARA LO QUE VIENE'},
    {id:'pintura', name:'Pintura', title:'Un cambio de color.', accent:'Un nuevo aire.', description:'Renueva tu hogar o negocio con una nueva pintura. Revisamos el espacio y el acabado que buscas para preparar tu propuesta.', action:'Consultar mi pintura', caption:'TU ESPACIO, CON OTRA MIRADA'}
  ];
  readonly renderedSlides = [...this.slides, ...this.slides, ...this.slides];
  readonly cursor = signal(this.slides.length);
  readonly resetting = signal(false);
  private moving = false;
  private pending?: number;
  private settleTimer?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private readonly root = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  private visible = false;
  private reduced = false;
  private timer?: ReturnType<typeof setInterval>;
  private touching = false;

  constructor() {
    afterNextRender(() => {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = preference.matches;
      const sync = () => this.restart();
      const motion = () => {this.reduced = preference.matches; sync();};
      const observer = new IntersectionObserver(entries => {this.visible = entries[0].isIntersecting; sync();}, {threshold:.25});
      observer.observe(this.root.nativeElement);
      document.addEventListener('visibilitychange', sync);
      preference.addEventListener('change', motion);
      this.destroy.onDestroy(() => {clearInterval(this.timer); clearTimeout(this.settleTimer); cancelAnimationFrame(this.frame); observer.disconnect(); document.removeEventListener('visibilitychange', sync); preference.removeEventListener('change', motion);});
    });
  }
  position(index:number): number {return index-this.cursor();}
  select(index:number): void {
    const target=(index+this.slides.length)%this.slides.length;
    if(this.moving) {this.pending=target; return;}
    let delta=target-this.active();
    if(Math.abs(delta)>this.slides.length/2) delta-=Math.sign(delta)*this.slides.length;
    this.travel(delta);
  }
  move(step:number): void {
    if(this.moving) {this.pending=(this.active()+step+this.slides.length)%this.slides.length; return;}
    this.travel(step);
  }
  private travel(delta:number): void {
    if(!delta) return;
    this.moving=true;
    this.active.set((this.active()+delta+this.slides.length)%this.slides.length);
    this.cursor.update(value=>value+delta);
    this.restart();
    this.settleTimer=setTimeout(() => {
      // Recenter on identical copies without animating their wrap-around.
      this.resetting.set(true);
      this.cursor.set(this.slides.length+this.active());
      this.frame=requestAnimationFrame(() => {
        this.frame=requestAnimationFrame(() => {
          this.resetting.set(false);
          this.moving=false;
          const pending=this.pending;
          this.pending=undefined;
          if(pending!==undefined) this.select(pending);
        });
      });
    },this.reduced ? 0 : 680);
  }
  setTouching(value:boolean): void {this.touching=value; this.restart();}
  private restart(): void {
    clearInterval(this.timer);
    if(!this.visible || this.touching || this.reduced || document.hidden) return;
    this.zone.runOutsideAngular(() => {this.timer=setInterval(() => this.zone.run(() => this.move(1)),5000);});
  }
}
