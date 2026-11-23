# FinishDecor Discover — Scopri il tuo stile

Web app in un file solo per il grande schermo verticale dello showroom. È il
sistema di suggestione: accompagna il cliente in sei micro-esperienze e
trasforma le sue scelte in una proposta progettuale personale.

Stessa forma, stessi colori e stesso logo di FinishDecor Trend (`finish-decor`):
frame 9:16, isola glass in alto, ambra come unico accento, DM Sans, sheet iOS.

## Il percorso

Un solo percorso. Se nello showroom ci sono due schermi, mostrano la stessa cosa
(sono sincronizzati): il cliente può riprendere dall'uno o dall'altro.

| Fase | Cosa fa il cliente | Cosa raccoglie il sistema |
|---|---|---|
| 0 · Attract | Vede una stanza che cambia colore: ogni 5 secondi una nuova mano scende sulla parete, con il nome del colore della Colour Wall. Tocca un punto qualsiasi dello schermo (o "Inizia") | — |
| 1 · Ambiente | Sceglie lo spazio da una griglia alta quanto lo schermo: casa, hotel, ristorante, negozio, ufficio, business, wellness | la tipologia: decide le foto delle fasi 2 e 3 e cosa disegna l'AI |
| 2 · Esplora | Prima una schermata spiega che dalle risposte nasce il suo profilo e mostra le tre risposte con i gesti; poi 16 immagini: le 8 della tipologia scelta alternate a 8 ispirazioni comuni (paesaggi, arte, architettura, materia). "Non fa per me", "Mi incuriosisce" o "Mi rappresenta", anche trascinando (sinistra, su, destra). "Annulla" riporta l'ultima foto | −1 / +1 / +3 ai linguaggi di ogni immagine |
| 3 · Scegli | 6 confronti A oppure B, diversi per ogni tipologia. "Annulla" riporta l'ultimo confronto (dal primo, l'ultima foto di Esplora) | +3 ai linguaggi dell'ambiente scelto |
| 4 · Linguaggio | Sceglie fino a tre approcci tra neutro, caldo, naturale, sofisticato, audace, minimale, materico; il sottotitolo conta le scelte e un quarto viene rifiutato con un messaggio | +4 a ciascuno |
| 5 · Palette | Vede le sue tre palette con i nomi della Colour Wall Sikkens (es. Mild Sage, da cercare sul muro) e un QR "Portale con te". Quando il telefono apre il QR, lo schermo passa a "Continua il percorso" con una mazzetta nei suoi colori che si apre a ventaglio, finché fa il giro fisico dei campioni. Dopo 1 minuto (`WAIT_MS`) compare il pulsante "Scegli la tua palette", che riporta le stesse palette da scegliere, una, due o tutte e tre. Con "Cambia colori" e un tocco su un colore lo sostituisce con uno visto sul muro: la scheda mostra i 192 colori della Colour Wall, famiglia per famiglia come sul muro. Senza telefono: il pulsante "Continua senza telefono" | le palette scelte |
| 6 · Il progetto | Legge le osservazioni dell'AI mentre l'AI disegna, per ogni palette scelta, tre spazi diversi della sua tipologia e un moodboard. "Vedi il tuo progetto" compare con l'ultima osservazione | — |
| Proposta | Nome del profilo e, per ogni palette scelta: i colori con il nome della Colour Wall, tre spazi (per un hotel: camera, hall, bagno), il moodboard, i prodotti | — |

La pillola in alto mostra i due linguaggi in testa, aggiornati a ogni scelta.

**Il QR delle palette.** Il link porta le palette con sé (nomi e colori, circa
300 caratteri dopo `#v=`): il telefono le mostra senza server. Porta anche un
`?scan=` casuale: aprendolo il telefono avvisa `api/scan`, e lo schermo, che chiede
ogni 1,5 s, passa all'attesa. Su Vercel telefono e schermo raggiungono funzioni
diverse, quindi l'avviso sta nell'archivio condiviso (Upstash Redis, collegato da
Vercel → Storage: aggiunge `KV_REST_API_URL` e `KV_REST_API_TOKEN`); senza
archivio resta in memoria, che basta col server locale sul PC dello showroom.
Nello stesso archivio stanno i limiti delle chiamate a pagamento (`limit` in
`api/_ai.js`): proposta 30 l'ora per visitatore e 200 al giorno, immagini 120
l'ora e 1200 al giorno, prova sulla stanza 12 l'ora e 200 al giorno.
Per provarlo col telefono in locale apri la pagina
dall'indirizzo di rete del PC (es. `http://192.168.1.20:8137`), non da `localhost`,
con telefono e PC sulla stessa rete.

**Un solo QR.** Il telefono che ha inquadrato le palette riceve da solo anche il
progetto finale. Quando lo schermo arriva alla proposta lascia il codice del
progetto (lo stesso del link `#p=`) in `api/scan`, sotto l'id del QR, per 30
minuti, e solo se un telefono ha davvero aperto quel QR. La pagina delle palette
sul telefono chiede ogni 5 secondi (per 20 minuti al massimo) e, appena lo trova,
diventa il progetto, come se il QR finale fosse stato inquadrato.

La fase 6 apre la proposta appena finite le osservazioni: le immagini ancora in
lavorazione arrivano lì, segnate "in arrivo".

## Salvare e condividere

"Porta a casa il progetto" mostra un QR. Il progetto viaggia **tutto nel link**
(`#p=…`): tipologia, punteggi, immagini scelte e le palette scelte come
codici del catalogo. Il telefono che inquadra il codice ricostruisce la proposta,
con le foto del percorso al posto delle immagini dell'AI (quelle restano sullo
schermo dello showroom: per portarle a casa servirebbe salvarle su un server).
Nessun dato del cliente viene salvato, tranne il codice del progetto per 30 minuti
quando un telefono ha inquadrato il QR delle palette (vedi "Un solo QR").

**Prova i colori sulla tua stanza.** Nel progetto aperto sul telefono il bottone
in basso non è più "Porta a casa il progetto" (il progetto è già lì) ma "Prova
sulla tua stanza": si sceglie la palette, si scatta o si sceglie una foto di una
stanza e l'AI ne ridipinge le pareti (pareti principali nel primo colore, una
parete d'accento nel terzo; il resto della foto resta com'è). Fino a 3 prove:
ognuna è un prima/dopo con il cursore da trascinare e l'icona per scaricarla, e
le miniature passano da una prova all'altra. Sul monitor dello showroom la
sezione non c'è: le foto della persona stanno sul suo telefono.

Per questo il QR funziona solo se l'app è pubblicata su un indirizzo vero
(Vercel, GitHub Pages…). Da `localhost` o da file il link punta al computer
dello showroom.

## Monitor verticale

Le misure sono in `rem`, e 1rem vale 12px più l'1% della larghezza del frame:
circa 16px su un telefono, circa 23px su un 1080×1920. Testi e icone restano
leggibili da vicino senza diventare enormi; lo spazio in più va alle immagini.

L'app non torna da sola all'inizio: resta dov'è finché qualcuno preme
"Ricomincia" in alto, che cancella le scelte per il cliente dopo. Un link aperto
sul telefono non ha il pulsante per ricominciare.

## L'AI (facoltativa)

Funzioni server in `api/` (più `api/scan.js` per il QR delle palette), che Vercel pubblica da sole insieme alla pagina:

| File | Quando | Cosa fa |
|---|---|---|
| `api/proposal.js` | dopo il linguaggio | scrive profilo, osservazioni e **tre palette** di colori liberi (nome + hex), con Google Gemini su Comfy Cloud |
| `api/room.js` | dopo la scelta delle palette | per ogni palette scelta disegna tre spazi diversi della tipologia e un moodboard, con Nano Banana su Comfy Cloud (circa 15 s a immagine) |
| `api/repaint.js` | sul telefono, "Prova i colori sulla tua stanza" | carica la foto su **Comfy Cloud** e ne ridipinge le pareti con **GPT Image 2** (stesso nodo e stessa chiave di ManyTask e LeadWin). Circa 40 secondi: la pagina chiede ogni 3 s se è pronta |

- **Una sola chiave, mai nella pagina.** Tutta l'AI passa da Comfy Cloud con
  `COMFY_API_KEY`: in locale nel file `.env` (copia `.env.example`), online
  nelle Environment Variables di Vercel. Senza chiave il percorso usa le palette
  calcolate in locale e il telefono dice "La prova sulla tua stanza non è ancora attiva".
- **L'AI non può inventare colori.** Appena composte le palette, la pagina porta
  ogni colore sul colore della Colour Wall più vicino alla vista (distanza CIELAB,
  ogni colore del muro al massimo una volta per palette), e i prodotti sono quelli
  per il linguaggio della palette.
- **Nessun errore a schermo.** Se l'AI non risponde (niente chiave, rete giù,
  errore del modello) la sessione usa tre palette calcolate in locale dai
  linguaggi più forti e le foto del percorso.
- **Costi.** 1 testo + 4 immagini per ogni palette scelta (da 4 a 12 per cliente),
  3 alla volta (`IMG_PARALLEL`). Le palette non scelte non vengono disegnate.
- **Modelli:** si cambiano nei file di `api/`. I nomi validi sono quelli dei nodi
  di Comfy (`GeminiNode`, `GeminiImageNode`, `OpenAIGPTImage1`), elencati da
  `/api/object_info` di Comfy Cloud.

## Avviare in locale

```bash
node dev-server.mjs            # http://localhost:8137
```

Serve Node 20 o più recente, nessuna dipendenza da installare. Il server
mostra la pagina e fa girare `api/` come farebbe Vercel. All'avvio dice se
l'AI è attiva. `AI_MOCK=1 node dev-server.mjs` prova tutto il flusso senza
chiamare Comfy: le immagini sono una foto fissa e la proposta è di prova.

Aperta con doppio clic sul file, la pagina funziona lo stesso ma senza AI e
con i colori dell'app al posto della Colour Wall (il catalogo non si può leggere da file).

## Dove si cambia cosa

- `data/catalogo.js` — il catalogo Sikkens, unico marchio dello showroom. I
  **colori sono quelli veri della Colour Wall 2025**: 24 famiglie per 8 livelli
  (da Deep a Delicate), 192 colori, nomi e valori presi dal sito sikkens.it
  (novembre 2026). Sul muro un colore si cerca per nome, quindi non c'è codice.
  **I prodotti sono quelli Sikkens per interni** del sito (pitture murali, effetti
  decorativi, uno smalto), tre per ogni linguaggio: l'ordine nella lista decide quali escono.
- `api/_ai.js`, `TIPI` — il nome di ogni tipologia per l'AI e i tre spazi da disegnare (stesso ordine di `spaces` in `TYPES`).

Il resto è in `index.html`, nello script:

- `ROOM` e `assets/stanza/` — la stanza della schermata iniziale: la stessa foto ridipinta una volta sola con l'AI della prova sulla stanza (`api/repaint.js`), un'immagine per colore, nello stesso ordine della lista.
- `ARCH` — i sette linguaggi: nome, descrizione, palette di 5 colori (nell'ordine base, supporto, accento, profondità, dettaglio).
- `PRODUCTS` — le finiture suggerite per ogni linguaggio.
- `IMG`, `TYPES`, `SHARED` — le immagini, e per ogni tipologia le sue 8 foto del mazzo (`own`) e i 6 confronti (`pairs`); `SHARED` sono le 8 ispirazioni comuni. Ogni foto ha i linguaggi che evoca.

## Note

- Senza AI il profilo lo calcolano dei pesi in locale; con l'AI i pesi restano
  la base e il modello scrive testi e palette sopra di essi.
- Le foto sono Unsplash, da sostituire con i progetti e i campioni FinishDecor.
- Il QR arriva da cdnjs (`qrcodejs`, versione fissata). Se non si carica,
  resta il bottone per copiare o condividere il link.
