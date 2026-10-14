import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function animatePage(root: HTMLElement, selectors: string): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    root.querySelectorAll<HTMLElement>(selectors).forEach(item => {
      gsap.from(item, {y: 24, opacity: 0, duration: .8, ease: 'power3.out', scrollTrigger: {trigger: item, start: 'top 92%', once: true}});
    });
  }, root);
  return () => media.revert();
}
