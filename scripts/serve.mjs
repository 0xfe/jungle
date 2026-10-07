import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json', '.wav': 'audio/wav', '.txt': 'text/plain' };

/** Local preview, optionally with deployment cache headers and a real subdirectory mount. */
export function createSiteServer(root, { cache = false, basePath = '/' } = {}) {
  root = resolve(root);
  const canonicalRoot = realpath(root);
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) throw new Error('BASE_PATH must start/end with / and contain simple directory names');
  return createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
        res.writeHead(308, { Location: basePath + new URL(req.url, 'http://localhost').search, 'Cache-Control': 'no-store' }).end(); return;
      }
      if (!pathname.startsWith(basePath)) { res.writeHead(404, { 'Cache-Control': 'no-store' }).end('Not found'); return; }
      const path = pathname.slice(basePath.length) || 'index.html';
      if (path.split('/').some(part => part.startsWith('.'))) { res.writeHead(403, { 'Cache-Control': 'no-store' }).end(); return; }
      const file = await realpath(resolve(root, path));
      if (!file.startsWith(await canonicalRoot + sep)) { res.writeHead(403, { 'Cache-Control': 'no-store' }).end(); return; }
      const data = await readFile(file);
      const cacheControl = !cache ? 'no-store' : path === 'index.html'
        ? 'public,max-age=300,must-revalidate' : 'public,max-age=86400,immutable';
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cacheControl }).end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }).end('Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve('dist'), port = Number(process.env.PORT ?? 5174), basePath = process.env.BASE_PATH ?? '/';
  try { await stat(resolve(root, 'index.html')); } catch { console.error('Run npm run build first.'); process.exit(1); }
  createSiteServer(root, { cache: process.argv.includes('--cache'), basePath }).listen(port, '127.0.0.1', () => console.log(`Jungle → http://localhost:${port}${basePath} (Ctrl+C to stop)`));
}
