import { writeFileSync } from 'node:fs';
const value = process.env.CHIRA_API_URL?.trim();
if (!value) {
  console.error('Falta CHIRA_API_URL. Configura la URL del servidor público antes de publicar GitHub Pages.');
  process.exit(1);
}
let url;
try { url = new URL(value); } catch { console.error('CHIRA_API_URL no es una URL válida.'); process.exit(1); }
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost')) {
  console.error('CHIRA_API_URL debe ser una dirección pública HTTPS sin credenciales.');
  process.exit(1);
}
writeFileSync(new URL('../public/api-config.json', import.meta.url), JSON.stringify({apiUrl:url.href.replace(/\/$/,'')})+'\n');
console.log('Dirección pública del servidor configurada.');
