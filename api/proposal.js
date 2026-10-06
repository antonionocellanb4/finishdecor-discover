// POST /api/proposal  { choices, tuning, walls }
// The model reads the visitor's choices and composes the proposal from the
// FinishDecor catalogue. It returns codes; this file maps every code back to
// the catalogue and drops whatever is not in it, so the page can only ever
// show colours and products that exist.

import catalogo from '../data/catalogo.js';
import { gemini, textOut, checkWalls, clean, send, sleep, HttpError, TEXT_MODEL, MOCK } from './_gemini.js';

const COLORI = new Map(catalogo.colori.map(c => [c.code, c]));
const PRODOTTI = new Map(catalogo.prodotti.map(p => [p.code, p]));

const SYSTEM = `Sei il consulente colore di FinishDecor, specialisti delle finiture d'interni.
Un cliente ha appena completato un percorso sul monitor dello showroom. Ricevi le sue scelte e componi la sua proposta.
Regole:
- Usa SOLO codici presenti nel catalogo qui sotto. Mai inventare codici, nomi o prodotti.
- palette: esattamente 5 codici colore, armonici tra loro e coerenti con le scelte e con i colori delle pareti che ha regolato.
- products: da 3 a 5 prodotti; per ognuno dove applicarlo (where), perché fa per lui (why, una frase) e il codice colore della palette da usare (color).
- name: nome del profilo creativo, 2-4 parole, evocativo.
- description: 2-3 frasi rivolte al cliente (tu), concrete, niente gergo.
- insights: 4 osservazioni brevi su cosa dicono le sue scelte, una frase ciascuna, in seconda persona.
- Italiano, tono caldo e professionale.

CATALOGO COLORI (codice | nome | hex | famiglia):
${catalogo.colori.map(c => `${c.code} | ${c.name} | ${c.hex} | ${c.famiglia}`).join('\n')}

CATALOGO PRODOTTI (codice | nome | dove | note | linguaggi):
${catalogo.prodotti.map(p => `${p.code} | ${p.name} | ${p.dove} | ${p.note} | ${p.linguaggi.join(', ')}`).join('\n')}`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    description: { type: 'STRING' },
    insights: { type: 'ARRAY', items: { type: 'STRING' } },
    palette: { type: 'ARRAY', items: { type: 'STRING' } },
    products: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { code: { type: 'STRING' }, where: { type: 'STRING' }, why: { type: 'STRING' }, color: { type: 'STRING' } },
        required: ['code', 'where', 'why', 'color'],
      },
    },
  },
  required: ['name', 'description', 'insights', 'palette', 'products'],
};

// What the page sent, re-stated as plain checked text for the prompt
function brief(choices, tuning, w) {
  const langs = (choices?.languages || []).slice(0, 3).map(l => `${clean(l.name, 20)} (${Number(l.weight) || 0})`);
  const loved = (choices?.loved || []).slice(0, 12).map(l => `${clean(l.title, 40)} [${clean(l.category, 20)}]`);
  const appr = (choices?.approaches || []).slice(0, 3).map(a => clean(a, 20));
  const sat = Number(tuning?.sat), con = Number(tuning?.con), qty = Number(tuning?.qty);
  return [
    `Linguaggi più forti (con peso): ${langs.join(', ') || 'nessuno'}.`,
    `Immagini che lo rappresentano o lo incuriosiscono: ${loved.join('; ') || 'nessuna'}.`,
    `Approcci al colore scelti: ${appr.join(', ') || 'nessuno'}.`,
    `In simulazione: saturazione ${sat}/100, contrasto ${con}/100, quantità di colore "${['un dettaglio', 'una parete', 'tutto'][qty] || 'una parete'}".`,
    `Pareti come le ha lasciate: fondo ${w.back.name} ${w.back.hex}, laterali ${w.side.name} ${w.side.hex}.`,
  ].join('\n');
}

// Keep only what exists in the catalogue; refuse the answer if too little survives
function validate(raw) {
  const palette = [...new Set((raw.palette || []).map(String))].filter(c => COLORI.has(c)).slice(0, 5).map(c => COLORI.get(c));
  if (palette.length < 3) throw new HttpError(502, 'Palette non valida');
  const codes = palette.map(c => c.code);
  const products = (raw.products || []).filter(p => PRODOTTI.has(p.code)).slice(0, 5).map(p => ({
    code: p.code,
    name: PRODOTTI.get(p.code).name,
    where: clean(p.where, 80) || PRODOTTI.get(p.code).dove,
    why: String(p.why || '').slice(0, 220),
    color: Math.max(0, codes.indexOf(p.color)),
  }));
  if (products.length < 2) throw new HttpError(502, 'Prodotti non validi');
  return {
    name: String(raw.name || '').slice(0, 40),
    description: String(raw.description || '').slice(0, 500),
    insights: (raw.insights || []).map(s => String(s).slice(0, 200)).slice(0, 4),
    palette: palette.map(({ code, name, hex }) => ({ code, name, hex })),
    products,
  };
}

// AI_MOCK: a believable answer built from the catalogue, to try the flow with no key
function mock(choices) {
  const fams = (choices?.languages || []).map(l => clean(l.name, 20));
  const fam = f => catalogo.colori.filter(c => c.famiglia === f);
  const a = fam(fams[0]).length ? fam(fams[0]) : fam('Neutro'), b = fam(fams[1]).length ? fam(fams[1]) : a;
  const palette = [a[0], b[1], a[2], a[3], b[2]];
  const prods = catalogo.prodotti.filter(p => p.linguaggi.includes(fams[0])).slice(0, 3)
    .concat(catalogo.prodotti.filter(p => p.linguaggi.includes(fams[1])).slice(0, 2));
  return validate({
    name: 'Prova senza AI',
    description: 'Questa è una risposta di prova (AI_MOCK=1): il testo vero lo scrive il modello quando c\'è la chiave.',
    insights: ['Osservazione di prova 1.', 'Osservazione di prova 2.', 'Osservazione di prova 3.', 'Osservazione di prova 4.'],
    palette: palette.map(c => c.code),
    products: prods.map((p, i) => ({ code: p.code, where: p.dove, why: p.note, color: palette[i % 5].code })),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa POST' });
  try {
    const { choices, tuning, walls } = req.body || {};
    const w = checkWalls(walls);
    if (MOCK) { await sleep(2000); return send(res, 200, mock(choices)); }
    const json = await gemini(TEXT_MODEL, {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: brief(choices, tuning, w) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.7 },
    });
    let raw;
    try { raw = JSON.parse(textOut(json)); } catch { throw new HttpError(502, 'Risposta del modello non leggibile'); }
    send(res, 200, validate(raw));
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
