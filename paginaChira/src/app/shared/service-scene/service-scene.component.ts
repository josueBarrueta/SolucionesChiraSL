import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, input } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-service-scene',
  standalone: true,
  templateUrl: './service-scene.component.html',
  styleUrls: ['./service-scene.component.scss']
})
export class ServiceSceneComponent {
  readonly kind = input('mudanzas');
  readonly ambient = input(false);
  readonly borderless = input(false);
  readonly panoramic = input(false);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      const root: HTMLElement = this.element.nativeElement;
      let loop: gsap.core.Timeline | undefined;
      let visible = false;
      let entered = false;
      const sync = () => {
        if (visible && entered && !document.hidden) loop?.play();
        else loop?.pause();
      };
      const observer = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; sync();}, {threshold:.15});
      observer.observe(root);
      document.addEventListener('visibilitychange', sync);
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        entered = false;
        if (this.ambient()) {
          loop = gsap.timeline({repeat:-1, repeatDelay:.6, paused:true});
          const movers = root.querySelectorAll('.scene-move');
          const pieces = root.querySelectorAll('.scene-piece');
          const finishes = root.querySelectorAll('.scene-finish');
          if (this.panoramic()) {
            switch (this.kind()) {
              case 'portes':
                const truck = root.querySelector('.truck-trip');
                const cargo = root.querySelectorAll('.truck-cargo');
                gsap.set(truck, {x:-620});
                gsap.set(cargo, {opacity:0});
                loop.set(truck, {x:-620})
                  .set(cargo, {opacity:0,x:130,y:112})
                  .to(truck, {x:0,duration:2.6,ease:'power2.out'})
                  .to(cargo, {x:0,y:0,opacity:1,stagger:.65,duration:1.1,ease:'power2.inOut'})
                  .to({}, {duration:1})
                  .to(truck, {x:650,duration:3,ease:'power2.in'});

                break;
              case 'montaje': {
                const furniture = Array.from(root.querySelectorAll<SVGElement>('.assembled-furniture'));
                const allParts = root.querySelectorAll('.assembly-part');
                gsap.set(allParts, {opacity:0});
                loop.set(allParts, {opacity:0});
                for (const item of furniture) {
                  const parts = Array.from(item.querySelectorAll<SVGElement>('.assembly-part'));
                  loop.set(item, {x:0});
                  for (const part of parts) {
                    const fromX=Number(part.dataset['fromX']);
                    const fromY=Number(part.dataset['fromY']);
                    loop.set(part, {x:fromX,y:fromY,scale:.12,opacity:0,transformOrigin:'50% 50%'})
                      .to(part, {y:fromY-55,scale:.5,opacity:1,duration:.35,ease:'power2.out'})
                      .to(part, {x:0,y:0,scale:1,duration:.6,ease:'power3.inOut'});
                  }
                  loop.to({}, {duration:1.2})
                    .to(item, {x:650,duration:2.4,ease:'power2.in'})
                    .set(parts, {opacity:0})
                    .set(item, {x:0});
                }
                break;
              }
              case 'mudanzas': {
                const origin = root.querySelector('.move-origin-house');
                const destination = root.querySelector('.move-destination-house');
                const truck = root.querySelector('.move-truck');
                const scenery = root.querySelector('.move-landscape');
                const cargo = Array.from(root.querySelectorAll('.move-cargo'));
                const pickupOffsets = [244,245,245];
                const deliveryOffsets = [268,218.5,169];
                gsap.set(truck, {x:-620});
                gsap.set(destination, {x:620});
                gsap.set(scenery, {x:620});
                cargo.forEach((box,i) => gsap.set(box, {x:pickupOffsets[i],y:104,scale:1}));
                loop.set(origin, {x:0,opacity:1})
                  .set(destination, {x:620,opacity:1})
                  .set(truck, {x:-620})
                  .set(scenery, {x:620});
                cargo.forEach((box,i) => loop!.set(box, {x:pickupOffsets[i],y:104,scale:1,opacity:1}));
                loop.to(truck, {x:0,duration:2.4,ease:'power2.out'});
                for (const box of cargo) {
                  loop.to(box, {y:8,duration:.6,ease:'power2.out'})
                    .to(box, {x:0,y:0,duration:.7,ease:'power2.inOut'});
                }
                const travelAt=loop.duration()+.6;
                loop.to(origin, {x:-620,duration:3.5,ease:'sine.inOut'},travelAt)
                  .to(destination, {x:0,duration:3.5,ease:'sine.inOut'},travelAt)
                  .to(scenery, {x:-250,duration:3.5,ease:'none'},travelAt);
                loop.to({}, {duration:.6});
                for (let i=cargo.length-1;i>=0;i--) {
                  loop.to(cargo[i], {x:deliveryOffsets[i],y:104,scale:.55,transformOrigin:'50% 50%',duration:1,ease:'power2.inOut'})
                    .to(cargo[i], {opacity:0,duration:.25});
                }
                loop.to({}, {duration:.8})
                  .to(truck, {x:650,duration:2,ease:'power2.in'})
                  .to(destination, {opacity:0,duration:.5});
                break;
              }
              case 'vaciados': {
                const boxes = Array.from(root.querySelectorAll('.moving-out-box'));
                const items = Array.from(root.querySelectorAll<SVGElement>('.packing-item'));
                gsap.set(boxes, {opacity:0});
                loop.set(boxes, {x:0,opacity:0})
                  .set(items, {x:0,y:0,scale:1,opacity:0,transformOrigin:'50% 50%'})
                  .to(items, {opacity:1,stagger:.1,duration:.45})
                  .to({}, {duration:1.2})
                  .to(boxes, {opacity:1,stagger:.15,duration:.4});
                for (const item of items) {
                  loop.to(item, {
                    x:Number(item.dataset['packX']),y:Number(item.dataset['packY']),
                    scale:.2,duration:.75,ease:'power2.inOut'
                  }).set(item, {opacity:0});
                }
                loop.to({}, {duration:.5});
                // Leave in order, with all objects already packed and the room empty.
                for (const box of boxes) {
                  loop.to(box, {x:-430,duration:1.8,ease:'power2.inOut'});
                }
                loop.to({}, {duration:1});
                break;
              }
              case 'limpieza': {
                const room = root.querySelector('.cleaning-room');
                const dirt = Array.from(root.querySelectorAll<SVGRectElement>('.window-dirt'));
                const prints = Array.from(root.querySelectorAll('.floor-footprint'));
                const squeegee = root.querySelector('.window-squeegee');
                const mop = root.querySelector('.floor-mop');
                const trail = root.querySelector('.mop-trail');
                const sparkles = root.querySelectorAll('.cleaning-sparkle');
                const windowProgress={value:0},floorProgress={value:0};
                gsap.set(room,{x:-620});
                gsap.set(sparkles,{opacity:0});
                loop.repeatDelay(0);
                loop.set(room,{x:-620})
                  .set([windowProgress,floorProgress],{value:0})
                  .set(prints,{opacity:1})
                  .set(sparkles,{opacity:0,scale:.6,transformOrigin:'50% 50%'})
                  .set(squeegee,{y:0,opacity:1})
                  .set(mop,{x:0,opacity:1})
                  .set(trail,{attr:{width:0}});
                dirt.forEach((patch,i) => loop!.set(patch,{attr:{y:94+i*(80/3),height:80/3}}));
                loop.to(room,{x:0,duration:1.8,ease:'power2.out'});
                loop.to(windowProgress,{value:1,duration:3.3,ease:'sine.inOut',onUpdate:() => {
                  const edge=94+80*windowProgress.value;
                  gsap.set(squeegee,{y:80*windowProgress.value});
                  dirt.forEach((patch,i) => {
                    const top=Math.max(94+i*(80/3),edge);
                    patch.setAttribute('y',String(top));
                    patch.setAttribute('height',String(Math.max(0,94+(i+1)*(80/3)-top)));
                  });
                }},2);
                loop.to(floorProgress,{value:1,duration:4.2,ease:'sine.inOut',onUpdate:() => {
                  const x=136*floorProgress.value;
                  gsap.set(mop,{x});
                  gsap.set(trail,{attr:{width:Math.max(0,Math.min(150,160+x-141))}});
                  prints.forEach((foot,i) => gsap.set(foot,{opacity:Math.max(0,Math.min(1,(169+i*24-(160+x))/10))}));
                }},2.35);
                loop.to([squeegee,mop],{opacity:0,duration:.4},6.65)
                  .to(sparkles,{opacity:1,scale:1,stagger:.15,duration:.5,ease:'power2.out'},7.05)
                  .to(sparkles,{opacity:.45,stagger:.1,duration:.45},7.75)
                  .to(sparkles,{opacity:1,stagger:.1,duration:.45},8.2)
                  .to(room,{x:650,duration:2.1,ease:'power2.inOut'},9.1);
                break;
              }
              case 'pintura': {
                const wall = root.querySelector('.paint-wall');
                const rollers = Array.from(root.querySelectorAll('.painting-roller'));
                const vertical = Array.from(root.querySelectorAll<SVGRectElement>('.paint-vertical'));
                const horizontal = Array.from(root.querySelectorAll<SVGRectElement>('.paint-horizontal'));
                gsap.set(wall, {x:-620});
                loop.repeatDelay(0);
                loop.set(wall, {x:-620})
                  .set(vertical, {attr:{height:0,y:55}})
                  .set(horizontal, {attr:{width:0,x:245}})
                  .set(rollers, {opacity:0,x:-4,y:-11.5,rotation:180,transformOrigin:'17.5px 5.5px'})
                  .set(rollers[2], {x:-38.4167,y:17.4167,rotation:0,smoothOrigin:false})
                  .to(wall, {x:0,duration:1.8,ease:'power2.out'})
                  .to(rollers, {opacity:1,duration:.25},1.8);
                const verticalPass = (strip:SVGRectElement, roller:Element, start:number, duration:number, upward=false) => {
                  const progress={value:0};
                  loop!.set(progress,{value:0},start).to(progress, {value:1,duration,ease:'sine.inOut',onUpdate:() => {
                    const height=173.5*progress.value;
                    strip.setAttribute('height',String(height));
                    strip.setAttribute('y',String(upward?228.5-height:55));
                    const edge=upward?228.5-height:55+height;
                    gsap.set(roller,{y:Math.min(156.5,edge-66.5)});
                  }},start);
                };
                verticalPass(vertical[0],rollers[0],1.9,2.2);
                loop.to(rollers[0],{x:31,duration:.35,ease:'sine.inOut'},4.1);
                verticalPass(vertical[1],rollers[0],4.45,2.35,true);
                verticalPass(vertical[2],rollers[1],2.35,3);
                loop.to(rollers[1],{x:31,duration:.45,ease:'sine.inOut'},5.35);
                verticalPass(vertical[3],rollers[1],5.8,1.7,true);
                const horizontalPass = (band:SVGRectElement,start:number,duration:number,reverse=false) => {
                  const progress={value:0};
                  loop!.set(progress,{value:0},start).to(progress,{value:1,duration,ease:'sine.inOut',onUpdate:() => {
                    const width=70*progress.value;
                    band.setAttribute('width',String(width));
                    band.setAttribute('x',String(reverse?315-width:245));
                    const edge=reverse?315-width:245+width;
                    gsap.set(rollers[2],{x:edge-(reverse?272.4167:283.4167)});
                  }},start);
                };
                horizontalPass(horizontal[0],2.15,1.45);
                loop.to(rollers[2],{x:42.5833,y:75.25,duration:.4,ease:'sine.inOut'},3.6);
                horizontalPass(horizontal[1],4,1.9,true);
                loop.to(rollers[2],{x:-38.4167,y:133.0833,duration:.4,ease:'sine.inOut'},5.9);
                horizontalPass(horizontal[2],6.3,1.4);
                loop.to(rollers,{opacity:0,duration:.3},8.05)
                  .to(wall,{x:650,duration:2.1,ease:'power2.inOut'},8.5);
                break;
              }
            }
          } else switch(this.kind()) {
            case 'portes':
              loop.to(movers, {x:12,y:-2,duration:1.4,ease:'sine.inOut'})
                .to(movers, {x:0,y:0,duration:1.4,ease:'sine.inOut'});
              break;
            case 'montaje':
              loop.to(pieces, {y:-7,stagger:.15,duration:.7,ease:'sine.inOut'})
                .to(pieces, {y:0,stagger:.15,duration:.9,ease:'power2.out'})
                .to(movers, {x:10,duration:.6}).to(movers, {x:0,duration:.8,ease:'power2.out'});
              break;
            case 'mudanzas':
              loop.to(movers, {x:12,y:-4,duration:1.2,ease:'sine.inOut'})
                .to(movers, {x:0,y:0,duration:1.2,ease:'sine.inOut'});
              break;
            case 'vaciados':
              loop.to(movers, {x:-18,opacity:.35,duration:1.4,ease:'power2.inOut'})
                .to(movers, {x:0,opacity:1,duration:1.1,ease:'power2.inOut'});
              break;
            case 'limpieza':
              loop.to(movers, {x:-24,duration:1.1,ease:'sine.inOut'})
                .to(movers, {x:0,duration:1.1,ease:'sine.inOut'});
              break;
            case 'pintura':
              loop.to(movers, {y:-28,duration:1.2,ease:'sine.inOut'})
                .to(movers, {y:0,duration:1.2,ease:'sine.inOut'});
              break;
          }
          loop.to(finishes, {opacity:.5,duration:.5,stagger:.1},0)
            .to(finishes, {opacity:1,duration:.6,stagger:.1},.7);
        }
        const timeline = gsap.timeline({onComplete: () => {entered = true; sync();}, scrollTrigger: {trigger: root, start: 'top 90%', once: true}, defaults: {duration: .85, ease: 'power3.out'}});
        timeline.from(root.querySelectorAll('.scene-backdrop'), {opacity: 0, scale: .9, transformOrigin: '50% 50%'})
          .from(root.querySelectorAll('.scene-piece'), {opacity: 0, y: 22, stagger: .12}, .15)
          .from(root.querySelectorAll('.scene-move'), {x: -55, opacity: 0, duration: 1.2}, .35)
          .from(root.querySelectorAll('.scene-finish'), {scale: 0, opacity: 0, transformOrigin: '50% 50%', stagger: .14, ease: 'back.out(1.5)'}, .75);
      }, root);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
        media.revert();
      });
    }));
  }
}
