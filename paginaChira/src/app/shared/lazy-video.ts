/** Solo conecta el archivo de vídeo cuando su componente va a mostrarlo. */
export function loadVisibleVideo(video: HTMLVideoElement): void {
  if (video.hasAttribute('src')) return;
  const source = video.dataset['src'];
  if (!source) return;
  video.preload = 'auto';
  video.src = source;
  video.load();
}
