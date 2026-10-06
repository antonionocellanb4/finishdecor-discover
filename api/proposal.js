// POST /api/proposal  { typology, brand, choices }
// The model reads the visitor's choices and composes three palettes from the
// catalogue of the brand they picked. It returns codes; this file maps every
// code back to that catalogue and drops whatever is not in it, so the page can
// only ever show colours and products that exist.

import catalogo from '../data/catalogo.js';
import { gemini, textOut, checkTipo, clean, send, sleep, HttpError, TEXT_MODEL, MOCK, TIPI } from './_gemini.js';

function system(marchio) {
  return `Sei il consulente colore di FinishDecor, specialisti delle finiture d'interni.
Un cliente ha appena completato un percorso sul monitor dello showroom. Ricevi le sue scelte e componi la sua proposta con il catalogo ${marchio.nome}.
Regole:
- Usa SOLO codici presenti nei cataloghi qui sotto. Mai inventare codici, nomi o prodotti.
- palettes: esattamente 3 palette diverse tra loro, tutte coerenti con le scelte. La prima è la più vicina al suo profilo, la terza la più coraggiosa.
- Per ogni palette: name (2-3 parole, evocativo), description (una frase rivolta al cliente, tu), colors (esattamente 5 codici colore armonici: il primo è il colore delle pareti principali), products (da 2 a 3 prodotti, ognuno con dove applicarlo nel tipo di spazio scelto, perché fa per lui in una frase, e il codice colore della palette da usare).
- name: nome del profilo creativo, 2-4 parole, evocativo.
- description: 2-3 frasi rivolte al cliente (tu), concrete, niente gergo.
- insights: 4 osservazioni brevi su cosa dicono le sue scelte, una frase ciascuna, in seconda persona.
- Italiano, tono caldo e professionale.

CATALOGO COLORI ${marchio.nome} (codice | nome | hex | famiglia):
${marchio.colori.map(c => `${c.code} | ${c.name} | ${c.hex} | ${c.famiglia}`).join('\n')}

CATALOGO PRODOTTI ${marchio.nome} (codice | nome | dove | note | linguaggi):
${marchio.prodotti.map(p => `${p.code} | ${p.name} | ${p.dove} | ${p.note} | ${p.linguaggi.join(', ')}`).join('\n')}`;
}

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
          colors: { type: 'ARRAY', items: { type: 'STRING' } },
          products: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { code: { type: 'STRING' }, where: { type: 'STRING' }, why: { type: 'STRING' }, color: { type: 'STRING' } },
              required: ['code', 'where', 'why', 'color'],
            },
          },
        },
        required: ['name', 'description', 'colors', 'products'],
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

// Keep only what exists in the brand's catalogue; refuse the answer if too little survives
function validate(raw, marchio) {
  const COLORI = new Map(marchio.colori.map(c => [c.code, c]));
  const PRODOTTI = new Map(marchio.prodotti.map(p => [p.code, p]));
  const palettes = (raw.palettes || []).slice(0, 3).map(p => {
    const colors = [...new Set((p.colors || []).map(String))].filter(c => COLORI.has(c)).slice(0, 5).map(c => COLORI.get(c));
    const codes = colors.map(c => c.code);
    return {
      name: String(p.name || '').slice(0, 40),
      description: String(p.description || '').slice(0, 240),
      colors: colors.map(({ code, name, hex }) => ({ code, name, hex })),
      products: (p.products || []).filter(x => PRODOTTI.has(x.code)).slice(0, 3).map(x => ({
        code: x.code,
        name: PRODOTTI.get(x.code).name,
        where: clean(x.where, 80) || PRODOTTI.get(x.code).dove,
        why: String(x.why || '').slice(0, 220),
        color: Math.max(0, codes.indexOf(x.color)),
      })),
    };
  }).filter(p => p.colors.length >= 3);
  if (!palettes.length) throw new HttpError(502, 'Palette non valide');
  return {
    name: String(raw.name || '').slice(0, 40),
    description: String(raw.description || '').slice(0, 500),
    insights: (raw.insights || []).map(s => String(s).slice(0, 200)).slice(0, 4),
    palettes,
  };
}

// AI_MOCK: a believable answer built from the catalogue, to try the flow with no key
function mock(choices, marchio) {
  const fams = (choices?.languages || []).map(l => clean(l.name, 20)).concat('Neutro', 'Caldo', 'Naturale');
  const fam = f => marchio.colori.filter(c => c.famiglia === f);
  return validate({
    name: 'Prova senza AI',
    description: 'Questa è una risposta di prova (AI_MOCK=1): il testo vero lo scrive il modello quando c\'è la chiave.',
    insights: ['Osservazione di prova 1.', 'Osservazione di prova 2.', 'Osservazione di prova 3.', 'Osservazione di prova 4.'],
    palettes: [...new Set(fams)].filter(f => fam(f).length).slice(0, 3).map((f, i) => {
      const colors = fam(f).map(c => c.code);
      return {
        name: `Palette di prova ${i + 1}`, description: `Costruita dalla famiglia ${f}.`, colors,
        products: marchio.prodotti.filter(p => p.linguaggi.includes(f)).slice(0, 2).map(p => ({ code: p.code, where: p.dove, why: p.note, color: colors[2] })),
      };
    }),
  }, marchio);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa POST' });
  try {
    const { typology, brand, choices } = req.body || {};
    const tipo = checkTipo(typology);
    if (!Object.hasOwn(catalogo.marchi, brand)) throw new HttpError(400, 'Marchio non valido');
    const marchio = catalogo.marchi[brand];
    if (MOCK) { await sleep(2000); return send(res, 200, mock(choices, marchio)); }
    const json = await gemini(TEXT_MODEL, {
      systemInstruction: { parts: [{ text: system(marchio) }] },
      contents: [{ role: 'user', parts: [{ text: brief(tipo, choices) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.7 },
    });
    let raw;
    try { raw = JSON.parse(textOut(json)); } catch { throw new HttpError(502, 'Risposta del modello non leggibile'); }
    send(res, 200, validate(raw, marchio));
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
