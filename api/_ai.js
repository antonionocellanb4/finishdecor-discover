// Shared helpers for the endpoints. Files starting with "_" are not routes on
// Vercel, so this is never reachable from the browser.
//
// Every AI call goes through Comfy Cloud and its credits: the proposal's text
// (Google Gemini), the pictures and the repainted rooms (GPT Image 2.6).
// COMFY_API_KEY lives only in the server environment: the page is a static
// file anyone can read, so a key used from the browser would be public.

import { readFile } from 'node:fs/promises';

const COMFY = 'https://cloud.comfy.org';
// AI_MOCK=1 answers without calling Comfy, to try the page flow with no key.
export const MOCK = process.env.AI_MOCK === '1';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
// a new seed every time, or Comfy answers from its cache
export const seed = () => Math.floor(Math.random() * 2147483647);

function key() {
  const k = process.env.COMFY_API_KEY;
  if (!k) throw new HttpError(503, 'AI non configurata: manca COMFY_API_KEY');
  return k;
}
export const comfy = (path, init = {}) => fetch(COMFY + path, { ...init, headers: { 'X-API-Key': key(), ...init.headers } });

// A workflow in Comfy's API format, queued: its job id
export async function submit(workflow) {
  const r = await comfy('/api/prompt', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, extra_data: { api_key_comfy_org: key() } }) });
  const j = await r.json().catch(() => null);
  if (r.status === 402) throw new HttpError(503, 'Crediti Comfy finiti');
  if (!r.ok || !j?.prompt_id) throw new HttpError(502, 'Comfy non è partito');
  return String(j.prompt_id);
}

// null while the job runs, its outputs (by node id) once done; a failed job throws
export async function outputs(id) {
  const st = await comfy(`/api/job/${id}/status`).then(x => x.json()).catch(() => null);
  if (['error', 'non_retryable_error', 'lost', 'cancelled'].includes(st?.status)) throw new HttpError(502, 'La generazione non è riuscita');
  if (st?.status !== 'success') return null;
  const job = await comfy(`/api/jobs/${id}`).then(x => x.json()).catch(() => null);
  if (!job?.outputs) throw new HttpError(502, 'Comfy ha finito ma il risultato non c\'è');
  return job.outputs;
}

// For the endpoints that answer in one request: a check every 1.5 s, given up before Vercel's 60 s
export async function waitFor(id, ms = 50000) {
  for (const end = Date.now() + ms; Date.now() < end;) {
    await sleep(1500);
    const out = await outputs(id);
    if (out) return out;
  }
  throw new HttpError(504, 'Comfy ci sta mettendo troppo');
}

// A saved picture: /api/view answers 302 to a signed link (it lasts about 6 hours),
// which the page loads directly, without the key and without passing through here
export async function imageLink(nodeOut) {
  const f = nodeOut?.images?.[0];
  if (!f?.filename) throw new HttpError(502, 'Il modello non ha restituito un\'immagine');
  const view = await comfy(`/api/view?${new URLSearchParams({ filename: f.filename, subfolder: f.subfolder || '', type: 'output' })}`, { redirect: 'manual' });
  const signed = view.headers.get('location');
  if (!signed) throw new HttpError(502, 'Download del risultato non riuscito');
  return signed;
}

// A small shared store, for what every function must see the same: the QR scans
// and the counts of paid calls. On Vercel the functions share no memory, so it is
// Upstash Redis through its REST API (Vercel's Storage tab adds the two variables);
// on one Node process (dev-server.mjs on the showroom PC) a Map does the same job.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = new Map();   // key → { n, until }
async function redis(...cmd) {
  const r = await fetch(KV_URL, { method: 'POST', headers: { authorization: `Bearer ${KV_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new HttpError(502, 'Archivio condiviso non raggiungibile');
  return j.result;
}
// +1 on a counter that lives `secs` seconds from its first count: its new value
export async function bump(key, secs) {
  if (KV_URL && KV_TOKEN) {
    const n = await redis('INCR', key);
    if (n === 1) await redis('EXPIRE', key, secs);
    return n;
  }
  const now = Date.now(), e = mem.get(key), live = e && e.until > now;
  if (mem.size > 2000) for (const [k, x] of mem) if (x.until <= now) mem.delete(k);
  mem.set(key, { n: live ? e.n + 1 : 1, until: live ? e.until : now + secs * 1000 });
  return mem.get(key).n;
}
// the counter's value, 0 once it has expired
export async function peek(key) {
  if (KV_URL && KV_TOKEN) return Number(await redis('GET', key)) || 0;
  const e = mem.get(key);
  return e && e.until > Date.now() ? e.n : 0;
}
// The paid calls, capped per visitor (their IP) per hour, and for everybody per day,
// so a link passed around cannot run up the bill. AI_MOCK costs nothing: no cap.
export async function limit(req, what, perIpHour, perDay) {
  if (MOCK) return;
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const hour = new Date().toISOString().slice(0, 13);
  if (perIpHour && await bump(`cap:${what}:${ip}:${hour}`, 3600) > perIpHour) throw new HttpError(429, 'Troppe prove: riprova più tardi');
  if (await bump(`cap:${what}:${hour.slice(0, 10)}`, 86400) > perDay) throw new HttpError(429, 'Limite di oggi raggiunto: riprova domani');
}

// Untrusted text from the page goes into prompts: keep it short and single-line
export function clean(v, max = 60) {
  return String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N} .,'&·()#%-]/gu, '').slice(0, max).trim();
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
// A palette as the page sends it: 3 to 5 colours, each a name and a hex
export function checkPalette(p) {
  if (!Array.isArray(p) || p.length < 3 || p.length > 5) throw new HttpError(400, 'Palette non valida');
  return p.map(c => {
    if (!c || !HEX.test(c.hex)) throw new HttpError(400, 'Colore non valido');
    return { name: clean(c.name, 30), hex: c.hex.toUpperCase() };
  });
}

// The space types of the journey's first step: the Italian name the AI writes
// for, and the three different spaces the image model draws for every chosen
// palette. Same order as `spaces` in TYPES (index.html), which labels them.
export const TIPI = {
  casa: { it: 'Casa (abitazione privata)', scenes: [
    'the living room of a private home',
    'the bedroom of the same home',
    'the kitchen with a dining table of the same home'] },
  hotel: { it: 'Hotel', scenes: [
    'a boutique hotel bedroom suite',
    'the hotel lobby with its reception desk',
    'the en-suite hotel bathroom with a freestanding tub'] },
  ristorante: { it: 'Ristorante, bistrot, bar o caffè', scenes: [
    'a restaurant dining room set for service',
    'the bar counter of the same restaurant, with stools',
    'a cosy corner of the same restaurant with banquette seating'] },
  negozio: { it: 'Negozio, boutique o showroom', scenes: [
    'a boutique retail store interior with clothing rails and a counter',
    'a display wall with shelves and niches in the same shop',
    'the fitting room area of the same shop'] },
  ufficio: { it: 'Ufficio', scenes: [
    'a contemporary open-plan office with workstations',
    'a meeting room in the same office',
    'an executive private office in the same office'] },
  business: { it: 'Spazi business di rappresentanza: hall, reception, lounge', scenes: [
    'a corporate entrance lobby with a reception desk',
    'the waiting lounge of the same building',
    'a conference room in the same building'] },
  wellness: { it: 'Wellness: spa, piscina, palestra, centro estetico', scenes: [
    'a spa relaxation room with loungers',
    'the indoor pool of the same spa',
    'a treatment room of the same spa'] },
};
export function checkTipo(t) {
  if (!Object.hasOwn(TIPI, t)) throw new HttpError(400, 'Tipologia non valida');
  return t;
}

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

export async function mockImage() {
  const buf = await readFile(new URL('../assets/room.jpg', import.meta.url));
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}
