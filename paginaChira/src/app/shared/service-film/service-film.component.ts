import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';

type Piece = [number, number, number, number, string, number?];
const green = '#42612e', pale = '#cedbbd', wood = '#cfa77b', glass = '#b4d0c7';
const hidden: Piece = [200, 160, 0, 0, pale, 0];

@Component({
  selector: 'app-service-film', standalone: true, imports: [RouterLink],
  templateUrl: './service-film.component.html', styleUrls: ['./service-film.component.scss']
})
export class ServiceFilmComponent {
  readonly active = signal(0);
  readonly paused = signal(false);
  readonly services = [
    {id:'portes', title:'Portes', description:'Tus muebles y objetos, de puerta a puerta.', cue:'Recogemos. Protegemos. Transportamos.'},
    {id:'montaje', title:'Montaje', description:'Cada pieza encaja. Tu espacio cobra forma.', cue:'Cada pieza, en su sitio.'},
    {id:'mudanzas', title:'Mudanzas', description:'Te acompañamos en tu próxima etapa.', cue:'Un nuevo destino. La misma tranquilidad.'},
    {id:'vaciados', title:'Vaciados', description:'Recupera espacio para lo que viene.', cue:'Dejamos sitio a un nuevo comienzo.'},
    {id:'limpieza', title:'Limpieza', description:'Un espacio cuidado, listo para disfrutar.', cue:'El cuidado se ve en los detalles.'},
    {id:'pintura', title:'Pintura', description:'Un nuevo aire para tu hogar o negocio.', cue:'Transformamos tu espacio.'},
    {id:'derribos', title:'Derribos', description:'Valoramos el espacio antes de dar el siguiente paso.', cue:'Un proyecto empieza con una buena valoración.'}
  ];
  // The same pieces are rearranged throughout the film rather than swapping illustrations.
  private readonly layouts: Piece[][] = [
    [[93,139,181,92,green],[274,165,67,66,pale],[285,176,39,26,glass],[166,91,62,48,wood],[228,107,46,32,wood],[125,161,87,7,pale],hidden,hidden],
    [[135,75,18,160,green],[285,75,18,160,green],[135,75,168,16,green],[135,145,168,15,green],[135,219,168,16,green],[166,106,40,39,wood],[230,178,46,41,pale],[166,185,35,34,wood]],
    [[182,96,139,139,green],[202,114,42,43,pale],[260,114,42,43,pale],[239,180,31,55,wood],[77,177,78,58,wood],[99,132,56,45,wood],[180,81,143,17,green],hidden],
    [[148,69,159,166,green],[168,89,119,146,pale],[175,220,104,6,green],[54,177,71,58,wood],[70,133,55,44,wood],hidden,hidden,hidden],
    [[133,75,166,160,green],[150,93,132,112,glass],[212,93,8,112,pale],[150,146,132,8,pale],[332,83,8,126,wood],[310,205,48,20,green],hidden,hidden],
    [[122,69,188,166,pale],[122,69,125,166,green],[218,109,99,28,wood],[311,123,9,39,green],[271,155,49,8,green],[267,155,9,69,wood],[261,192,21,43,green],hidden],
    [[202,210,151,24,'#25352a'],[208,172,139,37,green],[263,116,57,56,pale],[270,124,42,39,glass],[213,218,128,6,pale],[78,132,47,100,pale],[78,157,47,5,green],[78,188,47,5,green]]
  ];
  private readonly root = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  private timeline?: gsap.core.Timeline;
  private reduced = false;
  private visible = false;
  private index = 0;
  private manualTransition = false;
  private pieces: SVGRectElement[] = [];
  private wheels: SVGCircleElement[] = [];
  private text?: HTMLElement;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      const root: HTMLElement = this.root.nativeElement;
      this.pieces = Array.from(root.querySelectorAll<SVGRectElement>('.film-piece'));
      this.wheels = Array.from(root.querySelectorAll<SVGCircleElement>('.film-wheel'));
      this.text = root.querySelector<HTMLElement>('.film-copy')!;
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = preference.matches;
      this.setScene(0);
      this.buildFilm();
      const observer = new IntersectionObserver(entries => {this.visible = entries[0].isIntersecting; this.syncPlayback();}, {threshold:.15});
      observer.observe(root);
      const visibility = () => this.syncPlayback();
      const motion = () => {this.reduced = preference.matches; this.index = this.active(); this.setScene(this.index); this.buildFilm();};
      document.addEventListener('visibilitychange', visibility);
      preference.addEventListener('change', motion);
      this.destroy.onDestroy(() => {observer.disconnect(); document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion); this.timeline?.kill(); gsap.killTweensOf([...this.pieces,...this.wheels,this.text!]);});
    }));
  }

  private attrs(piece: Piece) {return {x:piece[0],y:piece[1],width:piece[2],height:piece[3],fill:piece[4]};}
  private setScene(index: number): void {
    this.layouts[index].forEach((piece,i) => gsap.set(this.pieces[i], {attr:this.attrs(piece),opacity:piece[5] ?? 1}));
    gsap.set(this.wheels, {opacity:index === 0 ? 1 : 0});
    gsap.set(this.text!, {opacity:1,y:0});
  }

  private buildFilm(target = (this.index + 1) % this.services.length, manual = false): void {
    this.timeline?.kill();
    this.manualTransition = manual;
    if (this.reduced) {
      this.index = this.active();
      this.setScene(this.index);
      return;
    }
    const start = manual ? 0 : 1.4;
    const timeline = gsap.timeline({paused:true, onComplete: () => {
      this.index = target;
      this.manualTransition = false;
      this.buildFilm();
    }});
    this.timeline = timeline;
    timeline.to(this.text!, {opacity:0,y:-10,duration:.2},start);
    this.layouts[target].forEach((piece,i) => timeline.to(this.pieces[i], {
      attr:this.attrs(piece),opacity:piece[5] ?? 1,duration:.85,ease:'power3.inOut'
    },start+i*.035));
    timeline.to(this.wheels, {opacity:target===0?1:0,duration:.4},start);
    timeline.call(() => this.zone.run(() => this.active.set(target)),[],start+.25);
    timeline.fromTo(this.text!, {opacity:0,y:10},{opacity:1,y:0,duration:.4,immediateRender:false},start+.4);
    if(target === 6) {
      const arm = this.root.nativeElement.querySelector('.film-demolition-arm');
      timeline.fromTo(arm, {rotation:0}, {rotation:-8,svgOrigin:'232 175',duration:.65,ease:'sine.inOut'},start+1.15)
        .to(arm, {rotation:0,duration:.65,ease:'sine.inOut'});
    }
    this.syncPlayback();
  }

  private syncPlayback(): void {
    const mayPlay = this.manualTransition || !this.paused();
    if(this.visible && !document.hidden && mayPlay && !this.reduced) this.timeline?.play();
    else this.timeline?.pause();
  }
  togglePlayback(): void {this.paused.update(value=>!value);this.syncPlayback();}
  select(index:number): void {
    if (!this.pieces.length) return;
    if (this.reduced) {
      this.index = index;
      this.active.set(index);
      this.setScene(index);
      return;
    }
    // Animate from the current positions, including when another transition is interrupted.
    this.zone.runOutsideAngular(() => this.buildFilm(index, true));
  }
}
