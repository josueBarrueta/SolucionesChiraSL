import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
export async function serveWeb(req, res, directory) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  const root = resolve(directory);
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname); }
  catch { return false; }
  if (pathname.split('/').some(part => part.startsWith('.'))) return false;
  let file = resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + sep)) return false;
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
  } catch {
    if (extname(pathname)) return false;
    file = resolve(root, 'index.html');
    try { if (!(await stat(file)).isFile()) return false; }
    catch { return false; }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  return true;
}
