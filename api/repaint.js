// POST /api/repaint  { image: 'data:image/jpeg;base64,…', ratio, palette: [{ name, hex }] } → { id }
// GET  /api/repaint?id=…  → { status: 'running' } | { image: url } | { error }
//
// "Prova i colori sulla tua stanza": the photo of the visitor's own room goes to
// Comfy Cloud, where GPT Image 2 repaints its walls with the chosen palette. The
// same workflow LeadWin and ManyTask use (OpenAIGPTImage1, model gpt-image-2).
// A picture takes about 40 seconds, so the page asks every few seconds instead
// of holding one request open past Vercel's time limit. COMFY_API_KEY stays here.
//
// shortcut: no cap per visitor on the paid generations; add one (per IP, in a KV) before the link goes public.

import { randomUUID } from 'node:crypto';
import { checkPalette, send, HttpError, MOCK, mockImage } from './_gemini.js';

const COMFY = 'https://cloud.comfy.org';
const PHOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const ID = /^(mock-\d{13}|[0-9a-f-]{36})$/i;

function key() {
  const k = process.env.COMFY_API_KEY;
  if (!k) throw new HttpError(503, 'Manca COMFY_API_KEY: la prova sulla tua stanza non è attiva');
  return k;
}
const comfy = (path, init = {}) => fetch(COMFY + path, { ...init, headers: { 'X-API-Key': key(), ...init.headers } });

// The output keeps the photo's shape: short side 1088, long side up to 1936, multiples of 16 (gpt-image-2)
function size(ratio) {
  const r = Math.min(16 / 9, Math.max(9 / 16, Number(ratio) || 1));
  const long = Math.min(1936, Math.round(1088 * Math.max(r, 1 / r) / 16) * 16);
  return r >= 1 ? [long, 1088] : [1088, long];
}

function prompt(pal) {
  const c = pal.map(x => `${x.name} (${x.hex})`);
  return [
    'Modifica la foto allegata: è una stanza vera del cliente. Ridipingi le pareti come farebbe un decoratore, con pittura opaca per interni.',
    `Le pareti principali diventano ${c[0]}.`,
    `Se nella foto c'è una parete che si presta a fare da accento (per esempio dietro il letto, il divano o il tavolo), dipingi solo quella ${c[2] || c[1]}.`,
    'Tutto il resto resta identico: arredi, pavimento, soffitto, porte, finestre, oggetti, luce, ombre, prospettiva e inquadratura. Non aggiungere e non togliere nulla.',
    'Il colore è uniforme e realistico, con la luce e le ombre della foto originale. Nessun testo, nessun logo.',
  ].join('\n');
}

async function start(body) {
  const m = PHOTO.exec(String(body?.image || ''));
  if (!m || m[2].length > 8e6) throw new HttpError(400, 'Foto non valida');
  const pal = checkPalette(body.palette);
  if (MOCK) return { id: `mock-${Date.now()}` };

  // a name of its own: two visitors at once must not overwrite each other's photo
  const form = new FormData();
  form.append('image', new Blob([Buffer.from(m[2], 'base64')], { type: `image/${m[1]}` }), `stanza-${randomUUID()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
  form.append('type', 'input');
  form.append('overwrite', 'true');
  const up = await comfy('/api/upload/image', { method: 'POST', body: form });
  const uj = await up.json().catch(() => null);
  if (!up.ok || !uj?.name) throw new HttpError(502, 'Caricamento della foto non riuscito');

  const [w, h] = size(body.ratio);
  const workflow = {
    3: { class_type: 'LoadImage', inputs: { image: uj.name } },
    1: { class_type: 'OpenAIGPTImage1', inputs: {
      prompt: prompt(pal), quality: 'medium', background: 'opaque', n: 1, model: 'gpt-image-2',
      size: 'Custom', custom_width: w, custom_height: h,
      seed: Math.floor(Math.random() * 2147483647),   // a new seed every time, or Comfy answers from its cache
      image: ['3', 0],
    } },
    2: { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'finishdecor' } },
  };
  const r = await comfy('/api/prompt', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, extra_data: { api_key_comfy_org: key() } }) });
  const j = await r.json().catch(() => null);
  if (r.status === 402) throw new HttpError(503, 'Crediti Comfy finiti');
  if (!r.ok || !j?.prompt_id) throw new HttpError(502, 'Comfy non è partito');
  return { id: String(j.prompt_id) };
}

async function check(id) {
  if (!ID.test(id)) throw new HttpError(400, 'id non valido');
  if (id.startsWith('mock-')) return Date.now() - Number(id.slice(5)) < 4000 ? { status: 'running' } : { image: await mockImage() };
  const st = await comfy(`/api/job/${id}/status`).then(x => x.json()).catch(() => null);
  if (['error', 'non_retryable_error', 'lost', 'cancelled'].includes(st?.status)) throw new HttpError(502, 'La generazione non è riuscita');
  if (st?.status !== 'success') return { status: 'running' };
  const job = await comfy(`/api/jobs/${id}`).then(x => x.json()).catch(() => null);
  const out = job?.outputs?.['2']?.images?.[0];
  if (!out?.filename) throw new HttpError(502, 'Comfy ha finito ma il risultato non c\'è');
  // /api/view answers 302 to a signed link: the page loads the picture from there, without the key
  const view = await comfy(`/api/view?${new URLSearchParams({ filename: out.filename, subfolder: out.subfolder || '', type: 'output' })}`, { redirect: 'manual' });
  const signed = view.headers.get('location');
  if (!signed) throw new HttpError(502, 'Download del risultato non riuscito');
  return { image: signed };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return send(res, 200, await start(req.body));
    if (req.method === 'GET') return send(res, 200, await check(new URL(req.url, 'http://x').searchParams.get('id') || ''));
    send(res, 405, { error: 'Usa GET o POST' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
