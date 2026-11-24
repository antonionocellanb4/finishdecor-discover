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
| 0 · Attract | Vede una stanza che cambia colore: ogni 5 secondi una nuova mano scende sulla parete, in un altro colore della Colour Wall. Tocca un punto qualsiasi dello schermo (o "Inizia") | — |
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
"Ricomincia" in alto o tocca il logo. Tutti e due chiedono conferma e cancellano le
scelte per il cliente dopo. Sul telefono non c'è il pulsante per ricominciare e il
logo non fa niente.

## Il profilo: cosa è misurato

Il profilo nasce da sette linguaggi: neutro, caldo, naturale, sofisticato, audace,
minimale, materico. I loro nomi e i confini tra l'uno e l'altro sono una scelta;
il resto è misurato, con le stesse regole per i colori del muro e per le foto.

**Le misure.** Ogni colore si misura in CIELAB, lo spazio colore standard della CIE
costruito perché le distanze seguano la vista: chiarezza L\*, croma C\* (quanto
colore ha) e tinta h. Il caldo/freddo è il *colour heat* di Ou, Luo, Woodcock e
Wright (2004): −0,5 + 0,02 · C\*^1,07 · cos(h − 50°), positivo per i colori caldi.

**I linguaggi** (`LANG_RULES` in `index.html`). Un colore può stare in più linguaggi;
dei 192 della Colour Wall uno solo, Gentle Savanna, non entra in nessuno.

| Linguaggio | Regola |
|---|---|
| Neutro | croma sotto 12, chiarezza tra 30 e 90: poco colore, né bianco né nero |
| Minimale | croma sotto 7, chiarezza sopra 88 o sotto 30: quasi senza colore, agli estremi |
| Caldo | colour heat di Ou positivo |
| Audace | croma da 18 in su: colori pieni |
| Naturale | tinta tra 90° e 230° (verdi, verde acqua, azzurri), croma da 6 |
| Sofisticato | tinta tra 230° e 40° (blu, viola, prugna, malva), croma tra 4 e 28: polverosi |
| Materico | tinta tra 30° e 90° (terre), croma tra 6 e 30, chiarezza tra 20 e 92: calce, argilla, pietra |

**Le palette** (`compose`). Per ogni linguaggio la pagina compone 5 colori della
Colour Wall con i risultati di Schloss e Palmer (2011): due colori sembrano più
armonici quanto più le loro tinte sono vicine, e piacciono di più quanto più sono
lontani in chiarezza; un colore "figura" piace di più quanto più la sua tinta
contrasta con lo sfondo. Quindi le tre pareti (base, supporto, profondità) hanno
tinte vicine (differenza di tinta CIE ΔH\*ab) e chiarezze lontane; l'accento è la
figura, con la tinta più lontana dalle pareti; il dettaglio accompagna l'accento. I
linguaggi con meno colori scelgono per primi e ogni colore va a un solo linguaggio:
le sette palette non hanno colori in comune, e quindi nemmeno le tre del cliente.

**Le foto.** I linguaggi di ogni foto (`tags` in `IMG`) sono misurati dai suoi colori
con `tools/misura-foto.js`: i 6 colori principali della foto come appare nell'app
(k-means in CIELAB su una miniatura), ognuno nei linguaggi con le regole sopra,
pesato per l'area che occupa e un po' di più se è saturo, perché le zone colorate
attirano lo sguardo. Ogni linguaggio diventa poi un punteggio standard rispetto a
tutte le foto (di quante deviazioni standard la foto si stacca dalla media): una foto
è "naturale" quando ha molti più colori naturali della foto media. Restano i
linguaggi almeno una deviazione standard sopra la media, al massimo 3; se nessuno ci
arriva, il più alto. Se cambiate le foto, rilanciate lo script (le istruzioni sono
nel file).

**I confronti A/B.** Le due foto di ogni coppia mostrano lo stesso spazio e non hanno
linguaggi in comune, così ogni scelta sposta il profilo. La cucina verde di Casa
(`assets/foto/cucina-verde.webp`) è generata con l'AI dell'app, perché le altre cucine
erano tutte "neutro"; in `IMG` una foto dell'app ha il percorso al posto dell'id Unsplash.

**Cosa resta una scelta.** I nomi dei linguaggi e le soglie delle regole; i pesi
delle risposte (−1, +1, +3 nelle foto, +3 nei confronti, +4 per ogni linguaggio
scelto); quanto conta la saturazione nelle foto. La misura guarda il colore, non la
materia o lo stile: "materico" sono le terre, non la grana di una superficie.

Fonti:
[Ou, Luo, Woodcock, Wright (2004), *A study of colour emotion and colour preference. Part I: Colour emotions for single colours*, Color Research & Application 29(3), 232–240](https://doi.org/10.1002/col.20010);
[Schloss, Palmer (2011), *Aesthetic response to color combinations: preference, harmony, and similarity*, Attention, Perception, & Psychophysics 73, 551–571](https://doi.org/10.3758/s13414-010-0027-0).

## L'AI (facoltativa)

Funzioni server in `api/` (più `api/scan.js` per il QR delle palette), che Vercel pubblica da sole insieme alla pagina:

| File | Quando | Cosa fa |
|---|---|---|
| `api/proposal.js` | dopo il linguaggio | scrive profilo, osservazioni e il nome e la frase delle **tre palette**, che compone la pagina (vedi "Il profilo: cosa è misurato"), con Google Gemini su Comfy Cloud |
| `api/room.js` | dopo la scelta delle palette | per ogni palette scelta disegna tre spazi diversi della tipologia e un moodboard, con Nano Banana su Comfy Cloud (circa 15 s a immagine) |
| `api/repaint.js` | sul telefono, "Prova i colori sulla tua stanza" | carica la foto su **Comfy Cloud** e ne ridipinge le pareti con **GPT Image 2** (stesso nodo e stessa chiave di ManyTask e LeadWin). Circa 40 secondi: la pagina chiede ogni 3 s se è pronta |

- **Una sola chiave, mai nella pagina.** Tutta l'AI passa da Comfy Cloud con
  `COMFY_API_KEY`: in locale nel file `.env` (copia `.env.example`), online
  nelle Environment Variables di Vercel. Senza chiave il percorso usa le palette
  calcolate in locale e il telefono dice "La prova sulla tua stanza non è ancora attiva".
- **L'AI non sceglie i colori.** Le palette le compone la pagina dalla Colour Wall
  con le regole qui sotto; il modello riceve i nomi dei colori e scrive solo il nome
  e la frase di ogni palette. I prodotti sono quelli Sikkens per il linguaggio della
  palette.
- **Nessun errore a schermo.** Se l'AI non risponde (niente chiave, rete giù,
  errore del modello) la sessione usa le stesse palette, con i nomi dei linguaggi,
  e le foto del percorso.
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

- `ROOM` e `assets/stanza/` — la stanza della schermata iniziale, un'immagine per colore, nello stesso ordine della lista. La foto 1 l'ha fatta l'AI della prova sulla stanza (`api/repaint.js`); le altre sono la stessa foto con la sola parete ritinta da `tools/stanza-pareti.js`, così luci, ombre e arredi restano identici e cambia solo il colore del muro. Per cambiare un colore: cambiatelo in `ROOM` e rifate le foto con quel file (istruzioni in testa), senza AI.
- `ARCH` — i sette linguaggi: nome e descrizione. Le loro palette di 5 colori (base, supporto, accento, profondità, dettaglio) le compone la pagina dalla Colour Wall; quelle scritte qui valgono solo se il catalogo non si legge (pagina aperta da file).
- `LANG_RULES` e `compose` — le regole dei linguaggi e delle palette (vedi "Il profilo: cosa è misurato").
- `PRODUCTS` — le finiture suggerite per ogni linguaggio.
- `IMG`, `TYPES`, `SHARED` — le immagini, e per ogni tipologia le sue 8 foto del mazzo (`own`) e i 6 confronti (`pairs`); `SHARED` sono le 8 ispirazioni comuni. I linguaggi di ogni foto (`tags`) sono misurati con `tools/misura-foto.js`.

## Note

- Il profilo lo calcolano sempre i pesi in locale e le palette le compongono le
  regole; con l'AI il modello scrive i testi: profilo, osservazioni, nomi delle palette.
- Le foto sono Unsplash, da sostituire con i progetti e i campioni FinishDecor.
- Il QR arriva da cdnjs (`qrcodejs`, versione fissata). Se non si carica,
  resta il bottone per copiare o condividere il link.
