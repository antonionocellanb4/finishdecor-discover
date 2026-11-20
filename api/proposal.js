// POST /api/proposal  { typology, choices }
// The model reads the visitor's choices and composes three palettes of free
// colours (name + hex). The page then turns every colour into the nearest
// colour of the Colour Wall, so the colours the visitor sees always exist.
// The model is Google Gemini, run on Comfy Cloud (node GeminiNode); the text
// comes back through a PreviewAny node.

import catalogo from '../data/catalogo.js';
import { submit, waitFor, seed, limit, checkTipo, clean, send, sleep, HttpError, MOCK, TIPI } from './_ai.js';

// Comfy's list of Gemini models: the GeminiNode entry of /api/object_info
const TEXT_MODEL = 'gemini-3-1-flash-lite';

const SYSTEM = `Sei il consulente colore di FinishDecor, specialisti delle finiture d'interni.
Un cliente ha appena completato un percorso sul monitor dello showroom. Ricevi le sue scelte e componi la sua proposta.
Regole:
- palettes: esattamente 3 palette diverse tra loro, tutte coerenti con le scelte. La prima è la più vicina al suo profilo, la terza la più coraggiosa.
- Per ogni palette: name (2-3 parole, evocativo), description (una frase rivolta al cliente, tu), colors (esattamente 5 colori di pittura per interni armonici, ognuno con name, un nome breve in italiano, e hex nel formato #RRGGBB; il primo è il colore delle pareti principali).
- name: nome del profilo creativo, 2-4 parole, evocativo.
- description: 2-3 frasi rivolte al cliente (tu), concrete, niente gergo.
- insights: 4 osservazioni brevi su cosa dicono le sue scelte, una frase ciascuna, in seconda persona.
- Italiano, tono caldo e professionale.
Rispondi solo con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice, in questa forma:
{"name": "...", "description": "...", "insights": ["..."], "palettes": [{"name": "...", "description": "...", "colors": [{"name": "...", "hex": "#RRGGBB"}]}]}`;

// The JSON in the model's text, even when it comes wrapped in a code fence
function parse(text) {
  const s = String(text), a = s.indexOf('{'), b = s.lastIndexOf('}');
  try { return JSON.parse(s.slice(a, b + 1)); } catch { throw new HttpError(502, 'Risposta del modello non leggibile'); }
}

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

// AI_MOCK: a believable answer from three families of the Colour Wall, to try the flow without Comfy
function mock() {
  const colori = catalogo.marchi.sikkens.colori;
  return validate({
    name: 'Prova senza AI',
    description: 'Questa è una risposta di prova (AI_MOCK=1): il testo vero lo scrive il modello quando c\'è la chiave.',
    insights: ['Osservazione di prova 1.', 'Osservazione di prova 2.', 'Osservazione di prova 3.', 'Osservazione di prova 4.'],
    palettes: ['Sage', 'Red Terra', 'Greige'].map((f, i) => ({
      name: `Palette di prova ${i + 1}`, description: `Costruita dalla famiglia ${f} della Colour Wall.`,
      colors: colori.filter(c => c.famiglia === f).slice(1, 6).map(({ name, hex }) => ({ name, hex })),
    })),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa POST' });
  try {
    const { typology, choices } = req.body || {};
    const tipo = checkTipo(typology);
    if (MOCK) { await sleep(2000); return send(res, 200, mock()); }
    await limit(req, 'proposal', 30, 200);
    const id = await submit({
      1: { class_type: 'GeminiNode', inputs: { prompt: brief(tipo, choices), model: TEXT_MODEL, seed: seed(), system_prompt: SYSTEM } },
      2: { class_type: 'PreviewAny', inputs: { source: ['1', 0] } },
    });
    const out = await waitFor(id, 40000);   // the page waits 45 s, then goes on without the AI
    send(res, 200, validate(parse([].concat(out['2']?.text ?? '').join(''))));
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
