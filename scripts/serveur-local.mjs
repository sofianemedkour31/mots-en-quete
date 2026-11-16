// Serveur de test local, sans dépendance : sert l'application et les fonctions /api.
// Usage : node scripts/serveur-local.mjs [--dist] [--port 5174]
// Les variables d'environnement peuvent être mises dans un fichier .env à la racine.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dist = args.includes('--dist');
const port = Number(args[args.indexOf('--port') + 1]) || 5174;

if (existsSync(path.join(racine, '.env'))) {
  for (const ligne of readFileSync(path.join(racine, '.env'), 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2',
};

async function fichier(chemin) {
  try { const s = await stat(chemin); return s.isFile() ? chemin : null; } catch { return null; }
}

function enveloppe(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const nom = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
      const module = path.join(racine, 'api', `${nom}.js`);
      if (!existsSync(module)) { res.statusCode = 404; return res.end('Fonction inconnue'); }
      const { default: handler } = await import(pathToFileURL(module).href);
      return handler(req, enveloppe(res));
    }
    const base = dist ? path.join(racine, 'dist') : racine;
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const candidats = dist ? [path.join(base, p)] : [path.join(racine, p), path.join(racine, 'public', p)];
    let trouve = null;
    for (const c of candidats) {
      if (!c.startsWith(racine)) continue;
      trouve = await fichier(c);
      if (trouve) break;
    }
    if (!trouve) { res.statusCode = 404; return res.end('Introuvable'); }
    res.setHeader('Content-Type', TYPES[path.extname(trouve)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(await readFile(trouve));
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end(String(e.message));
  }
}).listen(port, () => console.log(`Mots en quête : http://localhost:${port}  (studio : http://localhost:${port}/#/studio)`));
