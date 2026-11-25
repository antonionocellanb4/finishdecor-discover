// POST /api/repaint  { image: 'data:image/jpeg;base64,…', ratio, palette: [{ name, hex }] } → { ids: [3 ids] }
// GET  /api/repaint?id=…  → { status: 'running' } | { image: url } | { error }
//
// "Prova i colori sulla tua stanza": the photo of the visitor's own room goes to
// Comfy Cloud, where GPT Image 2.6 "sunburst", the detail-first one, repaints its
// walls with the chosen palette (node OpenAIGPTImageNodeV3, the photo as reference),
// in three versions at once, one per entry of SCHEMES.
// A picture takes about 40 seconds, so the page asks every few seconds instead
// of holding one request open past Vercel's time limit. COMFY_API_KEY stays here.
//
// Capped like every paid call (see limit in _ai.js), one count per photo: the phone
// allows 3 photos a page, the server 12 an hour per visitor and 200 a day for everybody.

import { randomUUID } from 'node:crypto';
import { comfy, submit, outputs, imageLink, seed, limit, checkPalette, send, HttpError, MOCK, mockImage } from './_ai.js';

const PHOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const ID = /^(mock-\d{13}|[0-9a-f-]{36})$/i;

// The output keeps the photo's shape: short side 1088, long side up to 1936, multiples of 16 (GPT Image)
function size(ratio) {
  const r = Math.min(16 / 9, Math.max(9 / 16, Number(ratio) || 1));
  const long = Math.min(1936, Math.round(1088 * Math.max(r, 1 / r) / 16) * 16);
  return r >= 1 ? [long, 1088] : [1088, long];
}

// Three ways to use the same palette on the walls. The colours are the palette's roles
// (compose in index.html): 0 base, 1 support, 2 accent, 3 depth, 4 detail; a palette of
// three uses its last colour for the missing ones. Same order as TRY_VERSIONS in index.html.
const SCHEMES = [
  c => [`Le pareti principali diventano ${c(0)}.`,
    `Se nella foto c'è una parete che si presta a fare da accento (per esempio dietro il letto, il divano o il tavolo), dipingi solo quella ${c(2)}.`],
  c => [`Pareti a due toni: la parte bassa di tutte le pareti, fino a circa un metro da terra, diventa ${c(3)}; la parte alta ${c(0)}.`,
    'Il confine tra i due colori è una linea orizzontale netta e dritta, alla stessa altezza su tutte le pareti, senza cornici né modanature.'],
  c => [`Tutte le pareti, nessuna esclusa, diventano ${c(1)}: un solo colore avvolgente, uguale in tutta la stanza.`],
];

function prompt(pal, scheme) {
  const c = i => { const x = pal[i] || pal[pal.length - 1]; return `${x.name} (${x.hex})`; };
  return [
    'Modifica la foto allegata: è una stanza vera del cliente. Ridipingi le pareti come farebbe un decoratore, con pittura opaca per interni.',
    ...SCHEMES[scheme](c),
    'Tutto il resto resta identico: arredi, pavimento, soffitto, porte, finestre, oggetti, luce, ombre, prospettiva e inquadratura. Non aggiungere e non togliere nulla.',
    'Il colore è uniforme e realistico, con la luce e le ombre della foto originale. Nessun testo, nessun logo.',
  ].join('\n');
}

async function start(body, req) {
  const m = PHOTO.exec(String(body?.image || ''));
  if (!m || m[2].length > 8e6) throw new HttpError(400, 'Foto non valida');
  const pal = checkPalette(body.palette);
  if (MOCK) return { ids: SCHEMES.map((_, i) => `mock-${Date.now() + i * 1500}`) };   // the versions arrive one after the other
  await limit(req, 'repaint', 12, 200);

  // a name of its own: two visitors at once must not overwrite each other's photo
  const form = new FormData();
  form.append('image', new Blob([Buffer.from(m[2], 'base64')], { type: `image/${m[1]}` }), `stanza-${randomUUID()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
  form.append('type', 'input');
  form.append('overwrite', 'true');
  const up = await comfy('/api/upload/image', { method: 'POST', body: form });
  const uj = await up.json().catch(() => null);
  if (!up.ok || !uj?.name) throw new HttpError(502, 'Caricamento della foto non riuscito');

  // one upload, three jobs on it
  const [w, h] = size(body.ratio);
  const workflow = scheme => ({
    3: { class_type: 'LoadImage', inputs: { image: uj.name } },
    1: { class_type: 'OpenAIGPTImageNodeV3', inputs: {   // a model with inputs of its own: they go as "model.<name>"
      model: 'gpt-image-2.6-sunburst',
      'model.prompt': prompt(pal, scheme), 'model.size': 'Custom', 'model.custom_width': w, 'model.custom_height': h,
      'model.background': 'opaque', 'model.quality': 'medium', 'model.complexity': 'medium', 'model.seed': seed(),
      'model.images.image_1': ['3', 0],
    } },
    2: { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'finishdecor' } },
  });
  return { ids: await Promise.all(SCHEMES.map((_, i) => submit(workflow(i)))) };
}

async function check(id) {
  if (!ID.test(id)) throw new HttpError(400, 'id non valido');
  if (id.startsWith('mock-')) return Date.now() - Number(id.slice(5)) < 4000 ? { status: 'running' } : { image: await mockImage() };
  const out = await outputs(id);
  return out ? { image: await imageLink(out['2']) } : { status: 'running' };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return send(res, 200, await start(req.body, req));
    if (req.method === 'GET') return send(res, 200, await check(new URL(req.url, 'http://x').searchParams.get('id') || ''));
    send(res, 405, { error: 'Usa GET o POST' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
