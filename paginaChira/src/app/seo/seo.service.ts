import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUSINESS, SEO_PAGES, SITE_URL } from './seo.config';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.update(event.urlAfterRedirects);
    });
  }

  private update(url: string): void {
    const path = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
    const page = SEO_PAGES.find((item) => item.path === path);
    const canonical = new URL(path, SITE_URL).href;
    const title = page?.title ?? 'Acceso privado | Soluciones Chira SL';
    const description = page?.description ?? 'Área privada de gestión de Soluciones Chira SL.';
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'robots',
      content: page ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    });
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (page) {
      if (!link) {
        link = this.document.createElement('link');
        link.rel = 'canonical';
        this.document.head.appendChild(link);
      }
      link.href = canonical;
    } else {
      link?.remove();
    }
    const image = new URL('images/trabajos/equipo-mudanzas.webp', SITE_URL).href;
    for (const [property, content] of Object.entries({
      'og:type': 'website',
      'og:site_name': BUSINESS.name,
      'og:locale': 'es_ES',
      'og:title': title,
      'og:description': description,
      'og:url': page ? canonical : SITE_URL,
      'og:image': image,
      'og:image:alt': 'Equipo de Soluciones Chira SL',
    }))
      this.meta.updateTag({ property, content });
    for (const [name, content] of Object.entries({
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': image,
    }))
      this.meta.updateTag({ name, content });
    this.document.getElementById('chira-structured-data')?.remove();
    if (!page) return;
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'HomeAndConstructionBusiness',
        '@id': SITE_URL + '#business',
        name: BUSINESS.name,
        url: SITE_URL,
        telephone: BUSINESS.telephone,
        image,
        areaServed: { '@type': 'Place', name: BUSINESS.areaServed },
        sameAs: [BUSINESS.instagram],
      },
      {
        '@type': 'WebSite',
        '@id': SITE_URL + '#website',
        url: SITE_URL,
        name: BUSINESS.name,
        inLanguage: 'es',
      },
      {
        '@type': 'WebPage',
        '@id': canonical + '#webpage',
        url: canonical,
        name: title,
        description,
        inLanguage: 'es',
        isPartOf: { '@id': SITE_URL + '#website' },
        about: { '@id': SITE_URL + '#business' },
      },
    ];
    if (path) {
      const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL }];
      if (path.startsWith('servicios/'))
        crumbs.push({
          '@type': 'ListItem',
          position: 2,
          name: 'Servicios',
          item: new URL('servicios', SITE_URL).href,
        });
      crumbs.push({
        '@type': 'ListItem',
        position: crumbs.length + 1,
        name: title.split(' | ')[0],
        item: canonical,
      });
      graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs });
    }
    if (path.startsWith('servicios/'))
      graph.push({
        '@type': 'Service',
        name: title.split(' | ')[0],
        description,
        url: canonical,
        provider: { '@id': SITE_URL + '#business' },
        areaServed: BUSINESS.areaServed,
      });
    const script = this.document.createElement('script');
    script.id = 'chira-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    }).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }
}
