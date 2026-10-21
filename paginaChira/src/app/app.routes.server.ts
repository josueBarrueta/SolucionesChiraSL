import { RenderMode, ServerRoute } from '@angular/ssr';
import { SEO_PAGES } from './seo/seo.config';

export const serverRoutes: ServerRoute[] = [
  ...SEO_PAGES.filter((page) => page.path !== 'formulario').map<ServerRoute>((page) => ({
    path: page.path,
    renderMode: RenderMode.Prerender,
  })),
  { path: '**', renderMode: RenderMode.Client },
];
