// POST /api/scan  { id }  → the phone opened the palettes from the QR
// GET  /api/scan?id=…      → { scanned } : the showroom screen asks, and moves on
//
// The phone and the showroom screen reach different functions on Vercel, so the
// scan is kept in the shared store (_ai.js); on the showroom PC, in memory.

import { bump, peek, send } from './_ai.js';

const ID = /^[a-z0-9]{6,16}$/;
const TTL = 30 * 60;   // seconds

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const id = String(req.body?.id || '');
      if (!ID.test(id)) return send(res, 400, { error: 'id non valido' });
      await bump('scan:' + id, TTL);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
      return send(res, 200, { scanned: ID.test(id) && (await peek('scan:' + id)) > 0 });
    }
    send(res, 405, { error: 'Usa GET o POST' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
