// POST /api/room
//   { mode: 'scene', scene: 0|1|2, typology, palette, choices } → one of three spaces of the visitor's type, in that palette
//   { mode: 'moodboard', typology, palette, choices }         → a flat lay of samples in that palette
// Answers { image: 'data:image/...;base64,...' }.
//
// The page asks for four pictures per chosen palette (scenes 0–2 and the
// moodboard) while the AI screen reads the choices, and shows them in the proposal.

import { gemini, imageOut, checkPalette, checkTipo, clean, send, mockImage, sleep, HttpError, IMAGE_MODEL, MOCK, TIPI } from './_gemini.js';

// What each colour language looks like, said in the words an image model knows
const STYLE = {
  Neutro: 'calm neutral tones, linen, sand and soft greige',
  Caldo: 'warm oak, cognac leather, terracotta and cotto accents',
  Naturale: 'natural fibres, rattan, plants, pale oak and jute',
  Sofisticato: 'deep dusty tones, velvet, brass details, refined lighting',
  Audace: 'bold colour accents, statement furniture, graphic art',
  Minimale: 'minimal clean surfaces, very few objects, architectural light',
  Materico: 'lime plaster, travertine, raw stone and textured surfaces',
};

function style(choices) {
  const langs = (choices?.languages || []).slice(0, 3).map(l => clean(l.name, 20)).filter(n => STYLE[n]);
  return langs.map(n => STYLE[n]).join('; ') || STYLE.Neutro;
}
const colours = pal => pal.map(c => `${c.name} (${c.hex})`).join(', ');

function scenePrompt(tipo, scene, pal, choices) {
  const loved = (choices?.loved || []).slice(0, 8).map(l => clean(l.title, 40)).filter(Boolean);
  return [
    `Photorealistic interior photograph of ${TIPI[tipo].scenes[scene]}, natural light, interior design magazine quality.`,
    `Style: ${style(choices)}.`,
    loved.length ? `The client was drawn to spaces described (in Italian) as: ${loved.join(', ')}.` : '',
    `Colour scheme taken strictly from this paint palette: ${colours(pal)}.`,
    `The main walls are painted ${pal[0].name} (${pal[0].hex}); the other colours go on an accent wall, joinery, textiles and details. Matte interior paint and decorative wall finishes, clearly visible.`,
    'No people, no text, no logos, no watermarks.',
  ].filter(Boolean).join(' ');
}

function moodboardPrompt(tipo, pal, choices) {
  return [
    'Interior design moodboard: a tidy flat lay photographed from directly above on a plain light board.',
    `Painted colour sample cards in exactly these colours: ${colours(pal)}.`,
    `With material samples for ${TIPI[tipo].scenes[0]} in this style: ${style(choices)} (for example wood, stone, plaster, fabric), and one small natural element.`,
    'Soft daylight, realistic photograph. No text, no labels, no logos, no watermarks.',
  ].join(' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa POST' });
  try {
    const { mode, scene, typology, palette, choices } = req.body || {};
    if (mode !== 'scene' && mode !== 'moodboard') throw new HttpError(400, 'mode deve essere scene o moodboard');
    const tipo = checkTipo(typology), pal = checkPalette(palette), sc = [0, 1, 2].includes(scene) ? scene : 0;
    if (MOCK) { await sleep(2500 + Math.random() * 3000); return send(res, 200, { image: await mockImage(), mock: true }); }

    const json = await gemini(IMAGE_MODEL, {
      contents: [{ role: 'user', parts: [{ text: mode === 'scene' ? scenePrompt(tipo, sc, pal, choices) : moodboardPrompt(tipo, pal, choices) }] }],
      // the page shows the first space and the moodboard wide, the other two spaces square
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: mode === 'moodboard' || sc === 0 ? '4:3' : '1:1' } },
    });
    send(res, 200, { image: imageOut(json) });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
