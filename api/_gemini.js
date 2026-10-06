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

// Only real image data URLs get forwarded to the model
export function dataUrlParts(url) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(typeof url === 'string' ? url : '');
  if (!m) throw new HttpError(400, 'Immagine non valida');
  if (m[2].length > 8_000_000) throw new HttpError(413, 'Immagine troppo grande');
  return { mimeType: m[1], data: m[2] };
}

// Untrusted text from the page goes into prompts: keep it short and single-line
export function clean(v, max = 60) {
  return String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N} .,'&·()#%-]/gu, '').slice(0, max).trim();
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
export function checkWalls(w) {
  const wall = x => {
    if (!x || !HEX.test(x.hex)) throw new HttpError(400, 'Colore parete non valido');
    return { name: clean(x.name, 30), hex: x.hex.toUpperCase() };
  };
  return { back: wall(w?.back), side: wall(w?.side) };
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
