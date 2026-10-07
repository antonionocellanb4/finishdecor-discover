// POST /api/scan  { id }  → the phone opened the palettes from the QR
// GET  /api/scan?id=…      → { scanned } : the showroom screen asks, and moves on
//
// ponytail: kept in memory, which holds on one Node process (dev-server.mjs on
// the showroom PC). On Vercel the functions do not share memory: there it needs
// a small shared store (Vercel KV / Upstash Redis).

import { send } from './_gemini.js';

const seen = new Map();   // id → when the phone opened it
const ID = /^[a-z0-9]{6,16}$/;
const TTL = 30 * 60000;

export default function handler(req, res) {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > TTL) seen.delete(k);
  if (req.method === 'POST') {
    const id = String(req.body?.id || '');
    if (!ID.test(id)) return send(res, 400, { error: 'id non valido' });
    if (seen.size < 5000) seen.set(id, now);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET') {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    return send(res, 200, { scanned: seen.has(id) });
  }
  send(res, 405, { error: 'Usa GET o POST' });
}
