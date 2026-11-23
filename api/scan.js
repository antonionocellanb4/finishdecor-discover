// POST /api/scan  { id }           → the phone opened the palettes from the QR
// GET  /api/scan?id=…              → { scanned } : the showroom screen asks, and moves on
// POST /api/scan  { id, project }  → the screen reached the project: it is kept for that phone
// GET  /api/scan?project=1&id=…    → { project } : the phone asks, and turns into the project
//
// The phone and the showroom screen reach different functions on Vercel, so the
// scan and the project are kept in the shared store (_ai.js); on the showroom PC, in memory.

import { bump, peek, save, load, send } from './_ai.js';

const ID = /^[a-z0-9]{6,16}$/;
const PROJECT = /^[A-Za-z0-9%_.!~*'()-]{20,4000}$/;   // the page's encode(): encodeURIComponent of a small JSON
const TTL = 30 * 60;   // seconds

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const id = String(req.body?.id || '');
      if (!ID.test(id)) return send(res, 400, { error: 'id non valido' });
      if (req.body.project !== undefined) {
        const project = String(req.body.project);
        if (!PROJECT.test(project)) return send(res, 400, { error: 'progetto non valido' });
        // only for a code a phone has really opened: nobody else is waiting for it
        if (!(await peek('scan:' + id))) return send(res, 409, { error: 'nessun telefono ha inquadrato questo codice' });
        await save('proj:' + id, project, TTL);
        return send(res, 200, { ok: true });
      }
      await bump('scan:' + id, TTL);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET') {
      const q = new URL(req.url, 'http://x').searchParams, id = q.get('id') || '';
      if (q.has('project')) return send(res, 200, { project: ID.test(id) ? await load('proj:' + id) : null });
      return send(res, 200, { scanned: ID.test(id) && (await peek('scan:' + id)) > 0 });
    }
    send(res, 405, { error: 'Usa GET o POST' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
