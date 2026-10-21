import { verifySeo } from './verify-seo.mjs';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pagePaths, preparePages } from './prepare-pages.mjs';
import { prepareSeo } from './prepare-seo.mjs';

const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  ['node_modules/@angular/cli/bin/ng.js', 'build', ...args],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const index = args.findIndex((arg) => arg === '--output-path' || arg.startsWith('--output-path='));
const output =
  index < 0
    ? 'dist/paginaChira'
    : args[index].includes('=')
      ? args[index].split('=').slice(1).join('=')
      : args[index + 1];
if (!output) throw new Error('Falta la carpeta de salida.');
const browser = resolve(output, 'browser');
const source = await readFile('src/app/app.routes.ts', 'utf8');
await preparePages(browser, source);
await prepareSeo(browser, pagePaths(source));
await verifySeo(browser);
console.log('SEO preparado: páginas públicas, sitemap y metadatos del panel.');
