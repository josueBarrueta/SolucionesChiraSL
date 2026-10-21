import { readdir, mkdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

/** Las variantes se regeneran al cambiar el original; las fotografías originales se conservan. */
export async function optimizeImages() {
  const root = resolve('public/images');
  const files = (await readdir(root, { recursive: true })).filter(
    (file) => /\.(webp|jpe?g)$/i.test(file) && !file.startsWith('optimized/'),
  );
  const transformerDate = (await stat(new URL(import.meta.url))).mtimeMs;
  let count = 0;
  for (const file of files) {
    const source = join(root, file);
    const widths = file === 'trabajos/equipo-mudanzas.webp' ? [480, 960, 1440] : [480, 960];
    for (const width of widths) {
      const target = join(root, 'optimized', file.replace(/\.[^.]+$/, `.${width}.webp`));
      try {
        if ((await stat(target)).mtimeMs >= Math.max((await stat(source)).mtimeMs, transformerDate))
          continue;
      } catch {}
      await mkdir(dirname(target), { recursive: true });
      await sharp(source).rotate().resize({ width }).webp({ quality: 82 }).toFile(target);
      count++;
    }
  }
  console.log(
    `Imágenes adaptables: ${count} variantes actualizadas en ${relative(process.cwd(), join(root, 'optimized'))}.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await optimizeImages();
