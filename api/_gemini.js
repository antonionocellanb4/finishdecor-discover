// Shared helpers for the two endpoints. Files starting with "_" are not routes
// on Vercel, so this is never reachable from the browser.
//
// The key lives only in the server environment (GEMINI_API_KEY): the page is a
// static file anyone can read, so a key used from the browser would be public.

import { readFile } from 'node:fs/promises';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
// Model ids change often: both are overridable without touching code.
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-lite';
// AI_MOCK=1 answers without calling Gemini, to try the page flow with no key.
export const MOCK = process.env.AI_MOCK === '1';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function gemini(model, body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'AI non configurata: manca GEMINI_API_KEY');
  const res = await fetch(BASE + model + ':generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, json.error?.message || `Gemini ${res.status}`);
  return json;
}

export function imageOut(json) {
  const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) throw new HttpError(502, 'Il modello non ha restituito un\'immagine');
  return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}

export function textOut(json) {
  return (json.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
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

export const sleep = ms => new Promise(r => setTimeout(r, ms));
