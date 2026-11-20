// POST /api/room
//   { mode: 'scene', scene: 0|1|2, typology, palette, choices } → one of three spaces of the visitor's type, in that palette
//   { mode: 'moodboard', typology, palette, choices }         → a flat lay of samples in that palette
// Answers { image: url }: Comfy's signed link to the picture (it lasts about 6 hours).
//
// The page asks for four pictures per chosen palette (scenes 0–2 and the
// moodboard) while the AI screen reads the choices, and shows them in the proposal.
// The model is GPT Image 2.6 "flare", the fast one, on Comfy Cloud (node
// OpenAIGPTImageNodeV3): this request waits for the picture and answers in one go.

import { submit, waitFor, imageLink, seed, limit, checkPalette, checkTipo, clean, send, mockImage, sleep, HttpError, MOCK, TIPI } from './_ai.js';

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
    await limit(req, 'room', 120, 1200);   // 12 pictures a visitor: about 100 visitors a day

    const wide = mode === 'moodboard' || sc === 0;   // the page shows the first space and the moodboard 4:3, the other two square
    const id = await submit({
      1: { class_type: 'OpenAIGPTImageNodeV3', inputs: {   // a model with inputs of its own: they go as "model.<name>"
        model: 'gpt-image-2.6-flare',
        'model.prompt': mode === 'scene' ? scenePrompt(tipo, sc, pal, choices) : moodboardPrompt(tipo, pal, choices),
        'model.size': wide ? 'Custom' : '1024x1024', 'model.custom_width': 1024, 'model.custom_height': wide ? 768 : 1024,
        'model.background': 'opaque', 'model.quality': 'medium', 'model.complexity': 'medium', 'model.seed': seed(),
      } },
      2: { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'finishdecor' } },
    });
    send(res, 200, { image: await imageLink((await waitFor(id))['2']) });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
