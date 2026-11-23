// Misura i linguaggi delle foto dai loro colori.
//
// Come si usa: avviate l'app (node dev-server.mjs, http://localhost:8137), aprite la console
// del browser (F12), incollate tutto questo file e premete Invio. Dopo qualche secondo c'è una
// tabella con, per ogni foto, i linguaggi di prima e quelli misurati: copiate i misurati nel
// campo tags della stessa foto in IMG (index.html).
//
// Il metodo (README, "Il profilo: cosa è misurato"): i 6 colori principali della foto come
// appare nell'app (ritaglio 4:5, k-means in CIELAB su una miniatura 48×60). Ogni colore va nei
// linguaggi con le stesse regole della Colour Wall (LANG_RULES), pesato per l'area che occupa e
// un po' di più se è saturo, perché le zone colorate attirano lo sguardo. Poi ogni linguaggio
// diventa un punteggio standard rispetto a tutte le foto (di quante deviazioni standard la foto
// si stacca dalla media): una foto è "naturale" quando ha più colori naturali della foto media.
// I tag sono i linguaggi almeno una deviazione standard sopra la media, dal più alto, al massimo
// 3; se non ce n'è nessuno, il più alto.
(async () => {
  const K = 6, W = 48, H = 60, SAL = 20, Z = 1;
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const kmeans = px => {
    const byL = [...px].sort((x, y) => x[0] - y[0]);
    let cs = Array.from({ length: K }, (_, j) => byL[Math.floor((j + 0.5) / K * byL.length)]), n = [];
    for (let it = 0; it < 12; it++) {
      const sum = cs.map(() => [0, 0, 0, 0]);
      px.forEach(q => {
        let bi = 0, bd = Infinity;
        cs.forEach((c, j) => { const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2; if (d < bd) { bd = d; bi = j; } });
        const s = sum[bi]; s[0] += q[0]; s[1] += q[1]; s[2] += q[2]; s[3]++;
      });
      cs = cs.map((c, j) => (sum[j][3] ? sum[j].slice(0, 3).map(v => v / sum[j][3]) : c));
      n = sum.map(s => s[3]);
    }
    return cs.map((c, j) => ({ lab: c, share: n[j] / px.length }));
  };
  const scoreOf = id => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';   // Unsplash answers with CORS, so the canvas can be read
    im.onerror = () => res(null);
    im.onload = () => {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const r = Math.min(im.naturalWidth / W, im.naturalHeight / H), sw = W * r, sh = H * r;   // the middle 4:5, as the app shows it
      cx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
      const d = cx.getImageData(0, 0, W, H).data, px = [];
      for (let i = 0; i < d.length; i += 4) px.push(lab(toHex(d[i], d[i + 1], d[i + 2])));
      const score = Object.fromEntries(KEYS.map(k => [k, 0]));
      kmeans(px).forEach(c => {
        const m = measure(c.lab), w = c.share * (1 + m.C / SAL);
        KEYS.forEach(k => { if (LANG_RULES[k](m)) score[k] += w; });
      });
      res(score);
    };
    const src = U(id, W);
    im.src = src.includes('?') ? src + '&h=' + H : src;   // Unsplash crops on its side; the app's own pictures come whole
  });
  const raw = await Promise.all(IMG.map(x => scoreOf(x.id)));
  const ok = raw.filter(Boolean);
  const mean = Object.fromEntries(KEYS.map(k => [k, ok.reduce((a, s) => a + s[k], 0) / ok.length]));
  const sd = Object.fromEntries(KEYS.map(k => [k, Math.sqrt(ok.reduce((a, s) => a + (s[k] - mean[k]) ** 2, 0) / ok.length) || 1]));
  const tags = raw.map(s => {
    if (!s) return null;
    const r = KEYS.map(k => [k, (s[k] - mean[k]) / sd[k]]).sort((a, b) => b[1] - a[1]);
    return r.filter(([, v], i) => i === 0 || v >= Z).slice(0, 3).map(([k]) => k);
  });
  console.table(IMG.map((x, i) => ({ foto: x.t, prima: x.tags.join(', '), misurati: tags[i] ? tags[i].join(', ') : 'non caricata' })));
  return Object.fromEntries(IMG.map((x, i) => [x.id, tags[i]]));
})();
