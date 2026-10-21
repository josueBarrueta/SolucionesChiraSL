import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SEO_PAGES, SITE_URL, BUSINESS } from '../src/app/seo/seo.config.ts';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/** Client-only routes still need metadata in the HTML returned before JavaScript runs. */
export function clientMetadata(html, path) {
  const page = SEO_PAGES.find((item) => item.path === path);
  const title = page?.title ?? 'Acceso privado | Soluciones Chira SL';
  const description = page?.description ?? 'Área privada de gestión de Soluciones Chira SL.';
  const canonical = page ? new URL(page.path, SITE_URL).href : null;
  const image = new URL('images/trabajos/equipo-mudanzas.webp', SITE_URL).href;
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<meta name="robots" content="${page ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}">`,
  ];
  if (canonical) tags.push(`<link rel="canonical" href="${escape(canonical)}">`);
  if (page) {
    for (const [property, content] of Object.entries({
      'og:type': 'website',
      'og:site_name': BUSINESS.name,
      'og:locale': 'es_ES',
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:image': image,
    }))
      tags.push(`<meta property="${property}" content="${escape(content)}">`);
    tags.push(
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escape(title)}">`,
      `<meta name="twitter:description" content="${escape(description)}">`,
      `<meta name="twitter:image" content="${escape(image)}">`,
    );
  }
  return html
    .replace(/<title>[^<]*<\/title>/gi, '')
    .replace(
      /<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi,
      '',
    )
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*id=["']chira-structured-data["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('</head>', tags.join('\n') + '\n</head>');
}

export async function prepareSeo(output, paths) {
  const root = resolve(output);
  for (const path of paths) {
    if (SEO_PAGES.some((page) => page.path === path) && path !== 'formulario') continue;
    const file = resolve(root, path, 'index.html');
    await writeFile(file, clientMetadata(await readFile(file, 'utf8'), path));
  }
  const notFound = resolve(root, '404.html');
  let html = clientMetadata(await readFile(notFound, 'utf8'), '__not_found__');
  html = html.replace(
    'Acceso privado | Soluciones Chira SL',
    'Página no encontrada | Soluciones Chira SL',
  );
  await writeFile(notFound, html);
  const urls = SEO_PAGES.map(
    (page) => `  <url><loc>${escape(new URL(page.path, SITE_URL).href)}</loc></url>`,
  ).join('\n');
  await writeFile(
    resolve(root, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  const basePath = new URL(SITE_URL).pathname;
  await writeFile(
    resolve(root, 'robots.txt'),
    `User-agent: *\nAllow: ${basePath}\n\nSitemap: ${new URL('sitemap.xml', SITE_URL).href}\n`,
  );
}
