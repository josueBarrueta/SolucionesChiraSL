import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { optimizeImages } from './optimize-images.mjs';

export async function prepareAssets() {
  // Conserva las clases del proveedor y genera una única fuente WOFF2 que no bloquee el texto.
  const original = await readFile('node_modules/primeicons/primeicons.css', 'utf8');
  const icons = original.replace(
    /@font-face\s*\{[^}]*\}/,
    `@font-face {
    font-family: 'primeicons';
    font-display: swap;
    src: url('../../node_modules/primeicons/fonts/primeicons.woff2') format('woff2');
    font-weight: normal;
    font-style: normal;
  }`,
  );
  await mkdir('src/generated', { recursive: true });
  const target = 'src/generated/primeicons.scss';
  let current;
  try {
    current = await readFile(target, 'utf8');
  } catch {}
  if (current !== icons) await writeFile(target, icons);
  await optimizeImages();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await prepareAssets();
