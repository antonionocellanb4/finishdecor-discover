// Local server: serves the static app and runs api/*.js exactly as Vercel
// would, so the showroom PC (or this laptop) needs nothing but Node.
//
//   node dev-server.mjs            → http://localhost:8137
//
// Reads GEMINI_API_KEY (and the optional AI_MOCK, GEMINI_*_MODEL) from the
// environment or from a .env file next to this one. No dependencies.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8137;

// minimal .env: KEY=value per line, # comments; real env vars win
if (existsSync(join(ROOT, '.env'))) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const API = new Set(['room', 'proposal', 'scan']);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const api = /^\/api\/([a-z]+)$/.exec(url.pathname);
  if (api && API.has(api[1])) {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 15e6) { res.writeHead(413).end(); return; } chunks.push(c); }
    try { req.body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}; } catch { res.writeHead(400).end('JSON non valido'); return; }
    const { default: handler } = await import(`./api/${api[1]}.js`);
    return handler(req, res);
  }
  // static files, never outside ROOT and never the private ones
  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^([/\\])+/, '');
  if (rel.startsWith('..') || /^(api|\.env|dev-server)/.test(rel)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(join(ROOT, rel));
    // no-cache: the page is being edited, a reload must always show the latest version
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end('Non trovato'); }
}).listen(PORT, () => {
  const mode = process.env.AI_MOCK === '1' ? 'AI di prova (AI_MOCK=1)' : process.env.GEMINI_API_KEY ? 'AI attiva (Gemini)' : 'senza AI (manca GEMINI_API_KEY)';
  console.log(`FinishDecor Discover → http://localhost:${PORT}  ·  ${mode}`);
});
