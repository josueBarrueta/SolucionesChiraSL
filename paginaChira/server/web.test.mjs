import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveWeb } from './web.mjs';

test('web: sirve la página prerenderizada, marca el panel noindex y devuelve 404 real', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chira-web-seo-'));
  const server = createServer(async (req, res) => {
    if (!(await serveWeb(req, res, root))) {
      res.statusCode = 404;
      res.end();
    }
  });
  try {
    await mkdir(join(root, 'servicios/portes'), { recursive: true });
    await mkdir(join(root, 'admin'), { recursive: true });
    await writeFile(join(root, 'index.html'), 'Inicio');
    await writeFile(join(root, 'servicios/portes/index.html'), 'Portes prerenderizado');
    await writeFile(join(root, 'admin/index.html'), 'Panel');
    await writeFile(join(root, '404.html'), 'No encontrada');
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(base + '/servicios/portes');
    assert.equal(page.status, 200);
    assert.equal(await page.text(), 'Portes prerenderizado');
    assert.match((await fetch(base + '/admin')).headers.get('x-robots-tag'), /noindex/);
    const missing = await fetch(base + '/no-existe');
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), 'No encontrada');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
