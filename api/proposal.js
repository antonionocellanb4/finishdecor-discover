// POST /api/proposal  { typology, choices }
// The model reads the visitor's choices and composes three palettes of free
// colours (name + hex). The brand is chosen later, at station 2: the page then
// turns every colour into that brand's nearest catalogue colour, so the codes
// the visitor sees always exist.

import catalogo from '../data/catalogo.js';
import { gemini, textOut, checkTipo, clean, send, sleep, HttpError, TEXT_MODEL, MOCK, TIPI } from './_gemini.js';

const SYSTEM = `Sei il consulente colore di FinishDecor, specialisti delle finiture d'interni.
Un cliente ha appena completato un percorso sul monitor dello showroom. Ricevi le sue scelte e componi la sua proposta.
Regole:
- palettes: esattamente 3 palette diverse tra loro, tutte coerenti con le scelte. La prima è la più vicina al suo profilo, la terza la più coraggiosa.
- Per ogni palette: name (2-3 parole, evocativo), description (una frase rivolta al cliente, tu), colors (esattamente 5 colori di pittura per interni armonici, ognuno con name, un nome breve in italiano, e hex nel formato #RRGGBB; il primo è il colore delle pareti principali).
- name: nome del profilo creativo, 2-4 parole, evocativo.
- description: 2-3 frasi rivolte al cliente (tu), concrete, niente gergo.
- insights: 4 osservazioni brevi su cosa dicono le sue scelte, una frase ciascuna, in seconda persona.
- Italiano, tono caldo e professionale.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    description: { type: 'STRING' },
    insights: { type: 'ARRAY', items: { type: 'STRING' } },
    palettes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          colors: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, hex: { type: 'STRING' } }, required: ['name', 'hex'] },
          },
        },
        required: ['name', 'description', 'colors'],
      },
    },
  },
  required: ['name', 'description', 'insights', 'palettes'],
};

// What the page sent, re-stated as plain checked text for the prompt
function brief(tipo, choices) {
  const langs = (choices?.languages || []).slice(0, 3).map(l => `${clean(l.name, 20)} (${Number(l.weight) || 0})`);
  const loved = (choices?.loved || []).slice(0, 12).map(l => `${clean(l.title, 40)} [${clean(l.category, 20)}]`);
  const appr = (choices?.approaches || []).slice(0, 3).map(a => clean(a, 20));
  return [
    `Tipo di spazio da progettare: ${TIPI[tipo].it}.`,
    `Linguaggi più forti (con peso): ${langs.join(', ') || 'nessuno'}.`,
    `Immagini che lo rappresentano o lo incuriosiscono: ${loved.join('; ') || 'nessuna'}.`,
    `Approcci al colore scelti: ${appr.join(', ') || 'nessuno'}.`,
  ].join('\n');
}

// Keep only well-formed colours; refuse the answer if too little survives
const HEX = /^#[0-9A-F]{6}$/i;
function validate(raw) {
  const palettes = (raw.palettes || []).slice(0, 3).map(p => ({
    name: String(p.name || '').slice(0, 40),
    description: String(p.description || '').slice(0, 240),
    colors: (p.colors || []).filter(c => HEX.test(c?.hex)).slice(0, 5)
      .map(c => ({ code: '', name: clean(c.name, 24) || c.hex, hex: c.hex.toUpperCase() })),
  })).filter(p => p.colors.length >= 3);
  if (!palettes.length) throw new HttpError(502, 'Palette non valide');
  return {
    name: String(raw.name || '').slice(0, 40),
    description: String(raw.description || '').slice(0, 500),
    insights: (raw.insights || []).map(s => String(s).slice(0, 200)).slice(0, 4),
    palettes,
  };
}

// AI_MOCK: a believable answer from the example catalogue's families, to try the flow with no key
function mock(choices) {
  const colori = Object.values(catalogo.marchi)[0].colori;
  const fams = (choices?.languages || []).map(l => clean(l.name, 20)).concat('Neutro', 'Caldo', 'Naturale');
  return validate({
    name: 'Prova senza AI',
    description: 'Questa è una risposta di prova (AI_MOCK=1): il testo vero lo scrive il modello quando c\'è la chiave.',
    insights: ['Osservazione di prova 1.', 'Osservazione di prova 2.', 'Osservazione di prova 3.', 'Osservazione di prova 4.'],
    palettes: [...new Set(fams)].filter(f => colori.some(c => c.famiglia === f)).slice(0, 3).map((f, i) => ({
      name: `Palette di prova ${i + 1}`, description: `Costruita dalla famiglia ${f}.`,
      colors: colori.filter(c => c.famiglia === f).map(({ name, hex }) => ({ name, hex })),
    })),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa POST' });
  try {
    const { typology, choices } = req.body || {};
    const tipo = checkTipo(typology);
    if (MOCK) { await sleep(2000); return send(res, 200, mock(choices)); }
    const json = await gemini(TEXT_MODEL, {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: brief(tipo, choices) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.7 },
    });
    let raw;
    try { raw = JSON.parse(textOut(json)); } catch { throw new HttpError(502, 'Risposta del modello non leggibile'); }
    send(res, 200, validate(raw));
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
