# FinishDecor Discover — Scopri il tuo stile

Web app in un file solo per il grande schermo verticale dello showroom. È il
sistema di suggestione: accompagna il cliente in sette micro-esperienze e
trasforma le sue scelte in una proposta progettuale personale.

Stessa forma, stessi colori e stesso logo di FinishDecor Trend (`finish-decor`):
frame 9:16, isola glass in alto, ambra come unico accento, DM Sans, sheet iOS.

## Il percorso

| Fase | Cosa fa il cliente | Cosa raccoglie il sistema |
|---|---|---|
| 0 · Attract | Vede un muro di immagini che scorre, tocca "Inizia" | — |
| 1 · Ambiente | Sceglie lo spazio: casa, hotel, ristorante, negozio, ufficio, business, wellness | la tipologia: decide le foto delle fasi 2 e 3 e cosa disegna l'AI |
| 2 · Esplora | 16 immagini: le 8 della tipologia scelta alternate a 8 ispirazioni comuni (paesaggi, arte, architettura, materia). "Non fa per me", "Mi incuriosisce" o "Mi rappresenta", anche trascinando (sinistra, su, destra) | −1 / +1 / +3 ai linguaggi di ogni immagine |
| 3 · Scegli | 6 confronti A oppure B, diversi per ogni tipologia | +3 ai linguaggi dell'ambiente scelto |
| 4 · Linguaggio | Sceglie fino a tre approcci tra neutro, caldo, naturale, sofisticato, audace, minimale, materico | +4 a ciascuno |
| 5 · Marchio | Sceglie il marchio (oggi Sikkens o Duco) | il catalogo da cui nascono le palette |
| 6 · Palette | Per 30 secondi vede solo "Continua il percorso" con una mazzetta di campioni nei suoi colori che si apre a ventaglio: prosegue nello showroom e tocca con mano colori e materiali. Poi compaiono le tre palette, con nome e codice di ogni colore: "Scegli la tua palette", una, due o tutte e tre | le palette scelte |
| 7 · Il progetto | Legge le osservazioni dell'AI mentre l'AI disegna, per ogni palette scelta, tre spazi diversi della sua tipologia e un moodboard | — |
| Proposta | Nome del profilo e, per ogni palette scelta: colori con i codici del catalogo, tre spazi (per un hotel: camera, hall, bagno), il moodboard, indicazioni di prodotto | — |

La pillola "Profilo" in alto mostra il profilo che si forma a ogni scelta.

L'attesa della fase 6 (30 s) è `PAL_MS`; la fase 7 aspetta le immagini al massimo `AI_MAX` (90 s),
poi apre la proposta e le immagini mancanti arrivano lì. Durante la fase 6 il ritorno
automatico all'inizio scatta dopo 6 minuti invece di 2: il cliente è alla parete dei campioni.

## Salvare e condividere

"Porta a casa il progetto" mostra un QR. Il progetto viaggia **tutto nel link**
(`#p=…`): tipologia, marchio, punteggi, immagini scelte e le palette scelte come
codici del catalogo. Il telefono che inquadra il codice ricostruisce la proposta,
con le foto del percorso al posto delle immagini dell'AI (quelle restano sullo
schermo dello showroom: per portarle a casa servirebbe salvarle su un server).
Nessun dato del cliente salvato da nessuna parte.

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

## L'AI (facoltativa)

Due funzioni server in `api/`, che Vercel pubblica da sole insieme alla pagina:

| File | Quando | Cosa fa |
|---|---|---|
| `api/proposal.js` | scelta del marchio | scrive profilo, osservazioni e **tre palette** con i loro prodotti, scegliendo **solo** dal catalogo del marchio in `data/catalogo.js` |
| `api/room.js` | dopo la scelta delle palette | per ogni palette scelta disegna tre spazi diversi della tipologia (Gemini, modello immagini) e un moodboard |

- **La chiave non entra mai nella pagina.** Sta in `GEMINI_API_KEY`: in locale
  nel file `.env` (copia `.env.example`), online nelle Environment Variables di Vercel.
- **L'AI non può inventare.** Il server scarta ogni codice colore o prodotto che
  non esiste nel catalogo del marchio scelto.
- **Nessun errore a schermo.** Se l'AI non risponde (niente chiave, rete giù,
  errore del modello) la sessione usa tre palette calcolate in locale dai
  linguaggi più forti, con i colori del catalogo più vicini, e le foto del percorso.
- **Costi.** 1 testo + 4 immagini per ogni palette scelta (da 4 a 12 per cliente),
  3 alla volta (`IMG_PARALLEL`). Le palette non scelte non vengono disegnate.
- **Modelli:** `GEMINI_IMAGE_MODEL` e `GEMINI_TEXT_MODEL` in `.env` per cambiarli
  senza toccare il codice. I nomi di default vanno verificati con la chiave.

## Avviare in locale

```bash
node dev-server.mjs            # http://localhost:8137
```

Serve Node 20 o più recente, nessuna dipendenza da installare. Il server
mostra la pagina e fa girare `api/` come farebbe Vercel. All'avvio dice se
l'AI è attiva. `AI_MOCK=1 node dev-server.mjs` prova tutto il flusso senza
chiamare Gemini: le immagini sono una foto fissa e la proposta è di prova.

Aperta con doppio clic sul file, la pagina funziona lo stesso ma senza AI e
senza la scelta del marchio (il catalogo non si può leggere da file).

## Dove si cambia cosa

- `data/catalogo.js` — i marchi, ognuno con i suoi colori e prodotti. Una voce
  in più in `marchi` aggiunge il marchio alla fase 5. **I cataloghi attuali sono
  di esempio** (stessi colori per tutti, codici SIK-/DUC- inventati): vanno
  sostituiti con le cartelle colori vere, stessa forma.
- `api/_gemini.js`, `TIPI` — il nome di ogni tipologia per l'AI e i tre spazi da disegnare (stesso ordine di `spaces` in `TYPES`).

Il resto è in `index.html`, nello script:

- `ARCH` — i sette linguaggi: nome, descrizione, palette di 5 colori (nell'ordine base, supporto, accento, profondità, dettaglio).
- `PRODUCTS` — le finiture suggerite per ogni linguaggio.
- `IMG`, `TYPES`, `SHARED` — le immagini, e per ogni tipologia le sue 8 foto del mazzo (`own`) e i 6 confronti (`pairs`); `SHARED` sono le 8 ispirazioni comuni. Ogni foto ha i linguaggi che evoca.
- `IDLE_MS` — il tempo prima del ritorno alla schermata iniziale.

## Note

- Senza AI il profilo lo calcolano dei pesi in locale; con l'AI i pesi restano
  la base e il modello scrive testi e palette sopra di essi.
- Le foto sono Unsplash, da sostituire con i progetti e i campioni FinishDecor.
- Il QR arriva da cdnjs (`qrcodejs`, versione fissata). Se non si carica,
  resta il bottone per copiare o condividere il link.
