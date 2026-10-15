import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pagePaths, preparePages } from './prepare-pages.mjs';

test('publishes every current public and protected route with the unchanged application shell', async () => {
  const source = await readFile(new URL('../src/app/app.routes.ts', import.meta.url), 'utf8');
  const expected = ['', 'servicios', 'contacto', 'formulario', 'nosotros', 'login', 'admin',
    ...['portes', 'montaje', 'mudanzas', 'vaciados', 'limpieza', 'pintura', 'derribos'].map(path => `servicios/${path}`),
    ...['clientes', 'trabajos', 'facturas', 'gastos', 'informes', 'configuracion', 'agenda', 'encuestas'].map(path => `admin/${path}`)];
  assert.deepEqual(pagePaths(source).sort(), expected.sort());
  const output = await mkdtemp(join(tmpdir(), 'chira-pages-'));
  const shell = '<base href="/SolucionesChiraSL/"><app-root></app-root>';
  try {
    await writeFile(join(output, 'index.html'), shell);
    await preparePages(output, source);
    for (const path of expected) assert.equal(await readFile(join(output, path, 'index.html'), 'utf8'), shell, path);
    assert.equal(await readFile(join(output, '404.html'), 'utf8'), shell);
    assert.ok(!(await readdir(join(output, 'admin'))).includes('**'));
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('handles nested routes, new siblings, quoted properties and redirects', () => {
  const source = `const routes = [
    { path: 'admin', children: [{path: 'reports', children: [{path: 'annual'}]}] },
    { 'path': 'new-page' }, {path: 'old', redirectTo: 'new-page'}, {path: '**', redirectTo: ''}
  ];`;
  assert.deepEqual(pagePaths(source), ['admin', 'admin/reports', 'admin/reports/annual', 'new-page']);
});

test('fails clearly for unsupported dynamic routes rather than silently missing pages', () => {
  assert.throws(() => pagePaths(`const routes = [{path: 'servicios/:slug'}];`), /dinámicas/);
  assert.throws(() => pagePaths('const unrelated = [];'), /lista de rutas/);
});
