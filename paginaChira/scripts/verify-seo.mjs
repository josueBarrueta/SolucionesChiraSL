import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SEO_PAGES, SITE_URL } from '../src/app/seo/seo.config.ts';

export async function verifySeo(output) {
  const sitemap = await readFile(resolve(output, 'sitemap.xml'), 'utf8');
  for (const page of SEO_PAGES) {
    const html = await readFile(resolve(output, page.path, 'index.html'), 'utf8');
    const canonical = new URL(page.path, SITE_URL).href;
    assert.ok(html.includes(`<title>${page.title}</title>`), `${page.path}: título propio`);
    assert.ok(html.includes(canonical), `${page.path}: canonical`);
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1, `${page.path}: canonical único`);
    assert.match(html, /<meta name="description" content="[^"<>]+"/);
    assert.match(html, /<meta name="robots" content="index, follow/);
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
    assert.match(html, /property="og:image"/);
    if (page.path !== 'formulario') {
      assert.match(html, /<h1[\s>]/, `${page.path}: contenido entregado en HTML`);
      const json = html.match(/<script[^>]*id="chira-structured-data"[^>]*>([\s\S]*?)<\/script>/);
      assert.ok(json, `${page.path}: datos estructurados`);
      assert.equal(JSON.parse(json[1])['@context'], 'https://schema.org');
    }
  }
  for (const path of [
    'login/index.html',
    'admin/index.html',
    'admin/clientes/index.html',
    '404.html',
  ]) {
    const html = await readFile(resolve(output, path), 'utf8');
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.ok(!html.includes('chira-structured-data'));
    assert.ok(
      !html.includes('id="hero-title"'),
      'La página privada no recibe la portada prerenderizada.',
    );
    assert.ok(!html.includes('rel="canonical"'));
  }
  assert.ok(!sitemap.includes('/admin') && !sitemap.includes('/login'));
  assert.match(await readFile(resolve(output, 'robots.txt'), 'utf8'), /Sitemap: https:/);
  console.log(
    `SEO verificado: ${SEO_PAGES.length} páginas públicas, datos estructurados y exclusión del panel.`,
  );
}
