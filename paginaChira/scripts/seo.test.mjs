import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePages } from './prepare-pages.mjs';
import { clientMetadata, prepareSeo } from './prepare-seo.mjs';

const shell =
  '<html lang="es"><head><title>Chira</title></head><body><app-root></app-root></body></html>';
test('publicación conserva el HTML prerenderizado y usa la aplicación vacía para el panel', async () => {
  const output = await mkdtemp(join(tmpdir(), 'chira-seo-'));
  try {
    const source =
      "const routes = [{path:''},{path:'contacto'},{path:'formulario'},{path:'login'},{path:'admin'}];";
    await mkdir(join(output, 'contacto'));
    await writeFile(join(output, 'index.html'), '<html>Inicio prerenderizado</html>');
    await writeFile(join(output, 'index.csr.html'), shell);
    await writeFile(join(output, 'contacto/index.html'), '<html>Contacto prerenderizado</html>');
    await preparePages(output, source);
    assert.equal(
      await readFile(join(output, 'contacto/index.html'), 'utf8'),
      '<html>Contacto prerenderizado</html>',
    );
    assert.equal(await readFile(join(output, 'admin/index.html'), 'utf8'), shell);
    await prepareSeo(output, ['contacto', 'formulario', 'login', 'admin']);
    assert.match(await readFile(join(output, 'admin/index.html'), 'utf8'), /noindex, nofollow/);
    assert.match(
      await readFile(join(output, 'formulario/index.html'), 'utf8'),
      /Solicitar presupuesto/,
    );
    const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes('/servicios/mudanzas'));
    assert.ok(!sitemap.includes('/admin') && !sitemap.includes('/login'));
    await preparePages(output, source);
    assert.equal(
      await readFile(join(output, 'contacto/index.html'), 'utf8'),
      '<html>Contacto prerenderizado</html>',
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
test('metadatos no duplican canonical ni robots y separan páginas públicas y privadas', () => {
  const html = clientMetadata(clientMetadata(shell, 'formulario'), 'formulario');
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.equal((html.match(/name="robots"/g) ?? []).length, 1);
  assert.match(html, /twitter:card/);
  const privateHtml = clientMetadata(html, 'admin/facturas');
  assert.ok(!privateHtml.includes('rel="canonical"'));
  assert.match(privateHtml, /noindex, nofollow/);
});
