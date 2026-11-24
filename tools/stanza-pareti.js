// Rifà le foto della schermata iniziale (assets/stanza/2.webp … 6.webp) perché cambi solo la parete.
//
// Come si usa: avviate l'app (node dev-server.mjs, http://localhost:8137), aprite la console
// del browser (F12), incollate tutto questo file e premete Invio. Dopo qualche secondo scarica
// 2.webp … 6.webp: copiateli in assets/stanza/ al posto di quelli che ci sono. La foto 1 non cambia.
//
// Perché: le sei foto le aveva fatte l'AI della prova sulla stanza, una per colore, e l'AI
// ridisegna tutta l'immagine: con la parete cambiavano anche luci, ombre, pavimento e divano.
// Il metodo:
// 1. la parete è dove le sei foto hanno colori diversi: a* o b* (CIELAB) che tra una foto e
//    l'altra si spostano di più di 14. Fuori dalla parete si spostano meno di 15, sulla parete
//    più di 30: la soglia cade nel vuoto in mezzo;
// 2. tolti i pezzi piccoli (riflessi, puntini) e riempiti i buchi piccoli dentro la parete;
// 3. tenuto solo ciò che nella foto 1 ha il colore della pittura (a* e b* divisi per L*+16, che
//    per la stessa pittura non cambiano tra luce e ombra): foglie e oggetti davanti al muro restano;
// 4. sulla parete la foto 1 viene ritinta, in luce lineare, per il rapporto tra il colore k e il
//    colore 1 della lista ROOM (index.html): stessa luce, stesse ombre, altra pittura.
// Per cambiare un colore basta cambiarlo in ROOM e rifare le foto qui: non serve l'AI.
(async () => {
  const N = ROOM.length, SWING = 14, D1 = 0.07, D2 = 0.14;
  const imgs = await Promise.all(ROOM.map(async (_, k) => { const im = new Image(); im.src = `assets/stanza/${k + 1}.webp`; await im.decode(); return im; }));
  const W = imgs[0].naturalWidth, H = imgs[0].naturalHeight, P = W * H;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const LIN = Float32Array.from({ length: 256 }, (_, v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const SRGB = Uint8ClampedArray.from({ length: 4096 }, (_, i) => { const v = i / 4095; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055); });
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  // 1 · how far a* and b* move across the six photos; photo 1's chromaticity on the side
  const loA = new Float32Array(P).fill(Infinity), hiA = new Float32Array(P).fill(-Infinity);
  const loB = new Float32Array(P).fill(Infinity), hiB = new Float32Array(P).fill(-Infinity);
  const cu = new Float32Array(P), cw = new Float32Array(P);
  let base;
  imgs.forEach((im, k) => {
    cx.drawImage(im, 0, 0);
    const px = cx.getImageData(0, 0, W, H), d = px.data;
    if (!k) base = px;
    for (let i = 0; i < P; i++) {
      const r = LIN[d[4 * i]], g = LIN[d[4 * i + 1]], b = LIN[d[4 * i + 2]];
      const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b), fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
      const A = 500 * (fx - fy), B = 200 * (fy - fz);
      if (A < loA[i]) loA[i] = A; if (A > hiA[i]) hiA[i] = A;
      if (B < loB[i]) loB[i] = B; if (B > hiB[i]) hiB[i] = B;
      if (!k) { cu[i] = A / (116 * fy); cw[i] = B / (116 * fy); }   // 116·fy = L* + 16
    }
  });
  const wall = new Uint8Array(P);
  for (let i = 0; i < P; i++) wall[i] = Math.max(hiA[i] - loA[i], hiB[i] - loB[i]) > SWING ? 1 : 0;

  // 2 · connected patches of value v smaller than min change side
  const q = new Int32Array(P);
  const flipSmall = (v, min) => {
    const seen = new Uint8Array(P);
    for (let s = 0; s < P; s++) {
      if (seen[s] || wall[s] !== v) continue;
      let h = 0, t = 0; q[t++] = s; seen[s] = 1;
      while (h < t) {
        const i = q[h++], x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < P && !seen[j] && wall[j] === v) { seen[j] = 1; q[t++] = j; }
      }
      if (t < min) for (let n = 0; n < t; n++) wall[q[n]] = 1 - v;
    }
  };
  flipSmall(1, P * 0.005);    // reflections on the table and the lamp, specks
  flipSmall(0, P * 0.0005);   // small dark spots inside the wall
  const share = wall.reduce((a, v) => a + v, 0) / P;
  console.assert(share > 0.2 && share < 0.8, 'parete trovata su una parte strana della foto', share);

  // 3 · a soft edge (box blur, radius 1, twice), then only what has the paint's chromaticity in photo 1
  const soft = Float32Array.from(wall), tmp = new Float32Array(P);
  for (let n = 0; n < 2; n++) {
    for (let i = 0; i < P; i++) { const x = i % W; tmp[i] = (soft[x ? i - 1 : i] + soft[i] + soft[x < W - 1 ? i + 1 : i]) / 3; }
    for (let i = 0; i < P; i++) soft[i] = (tmp[i >= W ? i - W : i] + tmp[i] + tmp[i + W < P ? i + W : i]) / 3;
  }
  const us = [], ws = [];
  for (let i = 0; i < P; i += 7) if (wall[i]) { us.push(cu[i]); ws.push(cw[i]); }
  const median = a => a.sort((x, y) => x - y)[a.length >> 1], mu = median(us), mw = median(ws);
  for (let i = 0; i < P; i++) {
    const t = Math.min(1, Math.max(0, (Math.hypot(cu[i] - mu, cw[i] - mw) - D1) / (D2 - D1)));
    soft[i] *= 1 - t * t * (3 - 2 * t);
  }

  // 4 · photo 1 re-tinted on the wall by the ratio of the two paints, in linear light
  const lin = h => [1, 3, 5].map(j => LIN[parseInt(h.slice(j, j + 2), 16)]), c1 = lin(ROOM[0][1]), out = [];
  for (let k = 1; k < N; k++) {
    const ratio = lin(ROOM[k][1]).map((v, j) => v / c1[j]), o = new ImageData(W, H), od = o.data, bd = base.data;
    for (let i = 0; i < P; i++) {
      for (let j = 0; j < 3; j++) od[4 * i + j] = SRGB[Math.min(4095, Math.round(LIN[bd[4 * i + j]] * (1 + soft[i] * (ratio[j] - 1)) * 4095))];
      od[4 * i + 3] = 255;
    }
    cx.putImageData(o, 0, 0);
    out.push([`${k + 1}.webp`, cv.toDataURL('image/webp', 0.8)]);
  }
  out.forEach(([name, href]) => Object.assign(document.createElement('a'), { href, download: name }).click());
  console.log(`Parete: ${Math.round(share * 100)}% della foto. Scaricate ${out.map(o => o[0]).join(', ')}.`);
  return Object.fromEntries(out);
})();
