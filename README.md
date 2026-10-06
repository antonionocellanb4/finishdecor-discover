# FinishDecor Discover — Scopri il tuo stile

Web app in un file solo per il grande schermo verticale dello showroom. È il
sistema di suggestione: accompagna il cliente in cinque micro-esperienze e
trasforma le sue scelte in una proposta progettuale personale.

Stessa forma, stessi colori e stesso logo di FinishDecor Trend (`finish-decor`):
frame 9:16, isola glass in alto, ambra come unico accento, DM Sans, sheet iOS.

## Il percorso

| Fase | Cosa fa il cliente | Cosa raccoglie il sistema |
|---|---|---|
| 0 · Attract | Vede un muro di immagini che scorre, tocca "Inizia" | — |
| 1 · Esplora | 16 immagini (interni, hotel, ristoranti, paesaggi, arte, architettura, materiali, dettagli): "Non fa per me", "Mi incuriosisce" o "Mi rappresenta", anche trascinando (sinistra, su, destra) | −1 / +1 / +3 ai linguaggi di ogni immagine |
| 2 · Scegli | 6 confronti A oppure B (soggiorno, camera, cucina, bagno, pranzo, hotel) | +3 ai linguaggi dell'ambiente scelto |
| 3 · Simula | Una foto vera di un soggiorno (`assets/room.jpg`) con le pareti ricolorate pixel per pixel: palette, saturazione, contrasto, quantità di colore. Finché non la tocca, cambia palette da sola | palette, gusto per saturazione e contrasto, quantità |
| 4 · Linguaggio | Sceglie fino a tre approcci tra neutro, caldo, naturale, sofisticato, audace, minimale, materico | +4 a ciascuno |
| 5 · Profilo AI | Vede le osservazioni sul suo profilo comparire una alla volta | — |
| Proposta | Nome del profilo, palette con nomi ed esadecimali, la stanza in tre alternative, moodboard, indicazioni di prodotto | — |

La pillola "Profilo" in alto mostra il profilo che si forma a ogni scelta.

## Salvare e condividere

"Porta a casa il progetto" mostra un QR. Il progetto viaggia **tutto nel link**
(`#p=…`): punteggi, regolazioni, immagini scelte. Il telefono che inquadra il
codice ricostruisce la stessa proposta. Niente server, niente dati del cliente
salvati da nessuna parte.

Per questo il QR funziona solo se l'app è pubblicata su un indirizzo vero
(Vercel, GitHub Pages…). Da `localhost` o da file il link punta al computer
dello showroom.

## Monitor verticale

Le misure sono in `rem`, e 1rem vale 12px più l'1% della larghezza del frame:
circa 16px su un telefono, circa 23px su un 1080×1920. Testi e icone restano
leggibili da vicino senza diventare enormi; lo spazio in più va alle immagini.

Dopo 2 minuti senza tocchi l'app torna alla schermata iniziale e cancella le
scelte: il cliente dopo non trova il profilo di chi c'era prima. Un link aperto
sul telefono non si azzera mai.

## La stanza ricolorata

`assets/room.jpg` è una foto con pareti bianche. Lo script ridipinge solo i pixel
di parete: dentro due zone (parete di fondo e parete sporgente a destra), fuori
dagli oggetti ritagliati a mano (quadro, tavolino, lampada) e né troppo
saturi né troppo scuri (poltrona, TV, mobili restano com'erano). Il colore viene
moltiplicato per la luminosità originale, così luci e ombre della foto restano.

Per cambiare foto vanno ridisegnate le zone `BACK`, `SIDE` e `HOLES` in
`index.html`, in pixel della foto originale. Aperta da file (`file://`) la
pagina non può leggere i pixel e mostra la foto senza ricolorarla: serve il
server.

## L'AI (facoltativa)

Due funzioni server in `api/`, che Vercel pubblica da sole insieme alla pagina:

| File | Quando | Cosa fa |
|---|---|---|
| `api/room.js` | fine dei confronti A/B | genera una stanza con le preferenze raccolte (Gemini, modello immagini) |
| `api/room.js` | ogni modifica in Simula | rimanda all'AI la stanza **originale** con i nuovi colori delle pareti e la riceve ridipinta |
| `api/proposal.js` | "Così mi piace" | scrive profilo, osservazioni, palette e prodotti scegliendo **solo** dal catalogo `data/catalogo.js` |

L'ordine delle fasi è Esplora → Scegli → Linguaggio → Simula: la stanza si
genera mentre il cliente sceglie i linguaggi.

- **La chiave non entra mai nella pagina.** Sta in `GEMINI_API_KEY`: in locale
  nel file `.env` (copia `.env.example`), online nelle Environment Variables di Vercel.
- **L'AI non può inventare.** Il server scarta ogni codice colore o prodotto che
  non esiste in `data/catalogo.js`. Il catalogo attuale è **di esempio**: va
  sostituito con quello vero, stessa forma.
- **Nessun errore a schermo.** Se l'AI non risponde (niente chiave, rete giù,
  errore del modello) la sessione torna da sola alla foto ricolorata in locale e
  alla proposta calcolata in locale.
- **Costi sotto controllo.** In Simula una modifica parte solo quando la mano si
  ferma (1,2 s), le combinazioni già viste tornano dalla cache, e ci sono al
  massimo 10 ridipinture per cliente (`MAX_EDITS`). Le ultime versioni restano
  come miniature cliccabili sulla stanza.
- **Modelli:** `GEMINI_IMAGE_MODEL` e `GEMINI_TEXT_MODEL` in `.env` per cambiarli
  senza toccare il codice. I nomi di default vanno verificati con la chiave.

## Avviare in locale

```bash
node dev-server.mjs            # http://localhost:8137
```

Serve Node 20 o più recente, nessuna dipendenza da installare. Il server
mostra la pagina e fa girare `api/` come farebbe Vercel. All'avvio dice se
l'AI è attiva. `AI_MOCK=1 node dev-server.mjs` prova tutto il flusso senza
chiamare Gemini: la stanza resta la foto e la proposta è di prova.

Aperta con doppio clic sul file, la pagina funziona lo stesso ma senza AI e
senza ricolorazione della foto.

## Dove si cambia cosa

- `data/catalogo.js` — colori e prodotti che l'AI può proporre.

Il resto è in `index.html`, nello script:

- `ARCH` — i sette linguaggi: nome, descrizione, palette di 5 colori (nell'ordine base, supporto, accento, profondità, dettaglio).
- `PRODUCTS` — le finiture suggerite per ogni linguaggio.
- `IMG`, `DECK`, `PAIRS` — le immagini e i confronti, ognuno con i linguaggi che evoca.
- `IDLE_MS` — il tempo prima del ritorno alla schermata iniziale.

## Note

- Senza AI il profilo lo calcolano dei pesi in locale; con l'AI i pesi restano
  la base e il modello scrive testi e proposta sopra di essi.
- Le foto sono Unsplash, da sostituire con i progetti e i campioni FinishDecor.
- Il QR arriva da cdnjs (`qrcodejs`, versione fissata). Se non si carica,
  resta il bottone per copiare o condividere il link.
