import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

// Herramienta opcional para regenerar las portadas cuando cambien los vídeos originales.
const ffmpeg = process.env.CHIRA_FFMPEG || 'ffmpeg';
for (const file of (await readdir('public/videos', { recursive: true })).filter((file) =>
  file.endsWith('.mp4'),
)) {
  const source = join('public/videos', file);
  const frame = spawnSync(
    ffmpeg,
    [
      '-v',
      'error',
      '-ss',
      '0.1',
      '-i',
      source,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      'pipe:1',
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  if (frame.error) throw frame.error;
  if (frame.status !== 0) throw new Error(frame.stderr.toString());
  await sharp(frame.stdout)
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(source.replace(/\.mp4$/, '.poster.webp'));
}
console.log('Portadas de vídeo actualizadas.');
