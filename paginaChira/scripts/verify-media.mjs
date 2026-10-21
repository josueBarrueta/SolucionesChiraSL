import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Comprueba la salida real para evitar descargas tempranas o imágenes adaptables rotas. */
export async function verifyMedia(output) {
  const html = await readFile(resolve(output, 'index.html'), 'utf8');
  const videos = html.match(/<video\b[^>]*>/g) ?? [];
  assert.ok(videos.length, 'El inicio conserva sus vídeos.');
  for (const video of videos) {
    assert.ok(
      !/\ssrc=/.test(video),
      'Los vídeos no deben conectar su archivo antes de ser visibles.',
    );
    assert.match(video, /preload="none"/);
    const poster = video.match(/\sposter="([^"]+)"/)?.[1];
    assert.ok(poster, 'Cada vídeo debe mostrar una portada mientras carga.');
    await access(resolve(output, poster));
  }
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  let responsive = 0;
  for (const image of images) {
    const set = image.match(/\ssrcset="([^"]+)"/)?.[1];
    if (!set) continue;
    assert.match(
      image,
      /\ssizes="[^"]+"/,
      'El navegador necesita saber el tamaño de cada fotografía.',
    );
    for (const candidate of set.split(','))
      await access(resolve(output, candidate.trim().split(/\s+/)[0]));
    responsive++;
  }
  assert.ok(responsive > 10, 'Las fotografías de inicio deben usar variantes adaptables.');
  console.log(
    `Recursos verificados: ${responsive} imágenes adaptables y ${videos.length} vídeos con carga aplazada.`,
  );
}
