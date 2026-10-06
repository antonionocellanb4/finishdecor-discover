// POST /api/room
//   { mode: 'generate', choices, walls }  → a living room built from the visitor's choices
//   { mode: 'edit', image, walls }        → the same picture with only the walls repainted
// Answers { image: 'data:image/...;base64,...' }.
//
// Edits always start from the ORIGINAL generated room (the page sends it), not
// from the last edit: repainting a repaint drifts a little more every time.

import { gemini, imageOut, dataUrlParts, checkWalls, clean, send, mockImage, sleep, HttpError, IMAGE_MODEL, MOCK } from './_gemini.js';

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

function generatePrompt(choices, w) {
  const langs = (choices?.languages || []).slice(0, 3).map(l => clean(l.name, 20)).filter(n => STYLE[n]);
  const loved = (choices?.loved || []).slice(0, 8).map(l => clean(l.title, 40)).filter(Boolean);
  const approaches = (choices?.approaches || []).slice(0, 3).map(a => clean(a, 20)).filter(Boolean);
  return [
    'Photorealistic interior photograph of a living room, eye-level, natural daylight, interior design magazine quality.',
    `Style: ${langs.map(n => STYLE[n]).join('; ') || STYLE.Neutro}.`,
    loved.length ? `The visitor was drawn to images titled (Italian): ${loved.join(', ')}.` : '',
    approaches.length ? `Colour approaches they feel close to: ${approaches.join(', ')}.` : '',
    `Large, clearly visible wall surfaces. The back wall is painted ${w.back.name} (${w.back.hex}), the side walls ${w.side.name} (${w.side.hex}), flat matte interior paint.`,
    'No people, no text, no logos, no watermarks.',
  ].filter(Boolean).join(' ');
}

function editPrompt(w) {
  return [
    'Edit this photograph: repaint ONLY the wall surfaces.',
    `Back wall: ${w.back.name} (${w.back.hex}). Side walls: ${w.side.name} (${w.side.hex}).`,
    'Flat matte interior paint; keep the original light, shadows and reflections falling on the walls.',
    'Do not change furniture, floor, ceiling, decor, plants, art, camera angle, framing or lighting.',
    'Return the same photograph with only the wall colours changed.',
  ].join(' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Usa POST' });
  try {
    const { mode, choices, walls, image } = req.body || {};
    const w = checkWalls(walls);
    if (mode !== 'generate' && mode !== 'edit') throw new HttpError(400, 'mode deve essere generate o edit');
    if (MOCK) { await sleep(mode === 'generate' ? 2500 : 1500); return send(res, 200, { image: await mockImage(), mock: true }); }

    const parts = mode === 'generate'
      ? [{ text: generatePrompt(choices, w) }]
      : [{ inlineData: dataUrlParts(image) }, { text: editPrompt(w) }];
    const json = await gemini(IMAGE_MODEL, {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], ...(mode === 'generate' && { imageConfig: { aspectRatio: '4:3' } }) },
    });
    send(res, 200, { image: imageOut(json) });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}
