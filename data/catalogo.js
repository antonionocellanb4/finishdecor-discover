// Base di conoscenza che l'AI usa per comporre le palette: un catalogo per
// ogni marchio che il cliente può scegliere nel percorso.
//
// CATALOGHI DI ESEMPIO: codici e prodotti sono segnaposto costruiti dalle
// palette dell'app, uguali per tutti i marchi tranne il prefisso. Vanno
// sostituiti con le cartelle colori reali (stessa forma: code, name, hex,
// famiglia). Il server scarta qualsiasi codice che l'AI proponga e che non sia
// nel catalogo del marchio scelto: l'AI può solo scegliere, mai inventare.
//
// Per aggiungere un marchio basta una voce in `marchi`: la pagina lo mostra
// da sola nella scelta del marchio, con il logo in `logo` (fondo trasparente,
// leggibile sullo scuro; senza logo scrive il nome). La pagina legge questo stesso file.

const COLORI = [
  { code: 'FD-C101', name: 'Lino',       hex: '#EAE5DD', famiglia: 'Neutro' },
  { code: 'FD-C102', name: 'Sabbia',     hex: '#D6CDBF', famiglia: 'Neutro' },
  { code: 'FD-C103', name: 'Corda',      hex: '#B3A797', famiglia: 'Neutro' },
  { code: 'FD-C104', name: 'Tortora',    hex: '#857C70', famiglia: 'Neutro' },
  { code: 'FD-C105', name: 'Ardesia',    hex: '#46423C', famiglia: 'Neutro' },
  { code: 'FD-C201', name: 'Crema',      hex: '#F0E2D0', famiglia: 'Caldo' },
  { code: 'FD-C202', name: 'Albicocca',  hex: '#E2B184', famiglia: 'Caldo' },
  { code: 'FD-C203', name: 'Terracotta', hex: '#C46F45', famiglia: 'Caldo' },
  { code: 'FD-C204', name: 'Ruggine',    hex: '#8E4A2C', famiglia: 'Caldo' },
  { code: 'FD-C205', name: 'Cacao',      hex: '#4E2D20', famiglia: 'Caldo' },
  { code: 'FD-C301', name: 'Avena',      hex: '#E7E4D3', famiglia: 'Naturale' },
  { code: 'FD-C302', name: 'Salvia',     hex: '#C3C6A4', famiglia: 'Naturale' },
  { code: 'FD-C303', name: 'Oliva',      hex: '#7F8C5E', famiglia: 'Naturale' },
  { code: 'FD-C304', name: 'Felce',      hex: '#5D6E55', famiglia: 'Naturale' },
  { code: 'FD-C305', name: 'Corteccia',  hex: '#4A3D2F', famiglia: 'Naturale' },
  { code: 'FD-C401', name: 'Cipria',     hex: '#E7DDD5', famiglia: 'Sofisticato' },
  { code: 'FD-C402', name: 'Malva',      hex: '#B3A0A0', famiglia: 'Sofisticato' },
  { code: 'FD-C403', name: 'Prugna',     hex: '#5F4A57', famiglia: 'Sofisticato' },
  { code: 'FD-C404', name: 'Blu notte',  hex: '#2C3846', famiglia: 'Sofisticato' },
  { code: 'FD-C405', name: 'Ottone',     hex: '#B08D57', famiglia: 'Sofisticato' },
  { code: 'FD-C501', name: 'Avorio',     hex: '#F3EADB', famiglia: 'Audace' },
  { code: 'FD-C502', name: 'Zafferano',  hex: '#EFAE34', famiglia: 'Audace' },
  { code: 'FD-C503', name: 'Corallo',    hex: '#D4513A', famiglia: 'Audace' },
  { code: 'FD-C504', name: 'Petrolio',   hex: '#1E6B67', famiglia: 'Audace' },
  { code: 'FD-C505', name: 'Indaco',     hex: '#2B2752', famiglia: 'Audace' },
  { code: 'FD-C601', name: 'Gesso',      hex: '#F4F3F0', famiglia: 'Minimale' },
  { code: 'FD-C602', name: 'Nebbia',     hex: '#E1DFDB', famiglia: 'Minimale' },
  { code: 'FD-C603', name: 'Cemento',    hex: '#BDBAB4', famiglia: 'Minimale' },
  { code: 'FD-C604', name: 'Grafite',    hex: '#6F6E6B', famiglia: 'Minimale' },
  { code: 'FD-C605', name: 'Nero',       hex: '#1D1D1D', famiglia: 'Minimale' },
  { code: 'FD-C701', name: 'Calce',      hex: '#DDD4C6', famiglia: 'Materico' },
  { code: 'FD-C702', name: 'Arenaria',   hex: '#B9A68F', famiglia: 'Materico' },
  { code: 'FD-C703', name: 'Argilla',    hex: '#957A60', famiglia: 'Materico' },
  { code: 'FD-C704', name: 'Pietra',     hex: '#625649', famiglia: 'Materico' },
  { code: 'FD-C705', name: 'Ferro',      hex: '#3A332D', famiglia: 'Materico' },
];
const PRODOTTI = [
  { code: 'FD-P01', name: 'Pittura lavabile opaca',            dove: 'Pareti di tutta la casa',            note: 'Resa uniforme, tinte morbide che reggono ogni luce',          linguaggi: ['Neutro', 'Minimale'] },
  { code: 'FD-P02', name: 'Velatura decorativa',               dove: 'Parete del soggiorno',               note: 'Profondità leggera senza cambiare tono',                      linguaggi: ['Neutro', 'Sofisticato'] },
  { code: 'FD-P03', name: 'Carta da parati effetto lino',      dove: 'Camera da letto',                    note: 'Una trama sottile al posto del colore',                       linguaggi: ['Neutro', 'Naturale'] },
  { code: 'FD-P04', name: 'Stucco veneziano',                  dove: 'Ingresso e soggiorno',               note: 'Superficie viva, riflessi caldi',                             linguaggi: ['Caldo', 'Sofisticato'] },
  { code: 'FD-P05', name: 'Smalto all\'acqua satinato',        dove: 'Porte e boiserie',                   note: 'Colore pieno che si lava, anche nei passaggi',                linguaggi: ['Caldo', 'Audace'] },
  { code: 'FD-P06', name: 'Carta da parati effetto tessuto',   dove: 'Testata del letto',                  note: 'Calore tattile, assorbe il suono',                            linguaggi: ['Caldo', 'Sofisticato'] },
  { code: 'FD-P07', name: 'Pittura a calce',                   dove: 'Pareti principali',                  note: 'Traspirante, opaca, con variazioni naturali di tono',         linguaggi: ['Naturale', 'Materico'] },
  { code: 'FD-P08', name: 'Pittura all\'argilla',              dove: 'Camera e studio',                    note: 'Minerale, regola l\'umidità',                                 linguaggi: ['Naturale', 'Materico'] },
  { code: 'FD-P09', name: 'Carta da parati in fibra naturale', dove: 'Parete d\'accento',                  note: 'Grasscloth e rafia per una texture vegetale',                 linguaggi: ['Naturale'] },
  { code: 'FD-P10', name: 'Stucco veneziano lucido',           dove: 'Zona living',                        note: 'Profondità e riflessi che cambiano durante il giorno',       linguaggi: ['Sofisticato'] },
  { code: 'FD-P11', name: 'Finitura metallica',                dove: 'Nicchie, dettagli, soffitto',        note: 'Ottone o bronzo spazzolato, a piccole dosi',                  linguaggi: ['Sofisticato', 'Audace'] },
  { code: 'FD-P12', name: 'Carta da parati con accenti metallici', dove: 'Sala da pranzo',                 note: 'Un pattern sottile che si accende con la luce',               linguaggi: ['Sofisticato'] },
  { code: 'FD-P13', name: 'Pittura ad alta saturazione',       dove: 'Una parete protagonista',            note: 'Pigmenti pieni che non sbiadiscono',                          linguaggi: ['Audace'] },
  { code: 'FD-P14', name: 'Smalto colorato',                   dove: 'Porte, infissi e soffitto',          note: 'Il colore anche dove non te lo aspetti',                      linguaggi: ['Audace'] },
  { code: 'FD-P15', name: 'Carta da parati a grande pattern',  dove: 'Bagno o corridoio',                  note: 'Piccoli spazi, grande carattere',                             linguaggi: ['Audace'] },
  { code: 'FD-P16', name: 'Microcemento',                      dove: 'Pareti e pavimenti, bagno compreso', note: 'Superficie continua, senza fughe',                            linguaggi: ['Minimale', 'Materico'] },
  { code: 'FD-P17', name: 'Pittura opaca super-coprente',      dove: 'Tutta la casa',                      note: 'Bianchi e grigi senza riflessi',                              linguaggi: ['Minimale'] },
  { code: 'FD-P18', name: 'Resina',                            dove: 'Pavimenti',                          note: 'Una sola superficie da una stanza all\'altra',                linguaggi: ['Minimale'] },
  { code: 'FD-P19', name: 'Intonachino minerale',              dove: 'Pareti del living',                  note: 'Grana visibile, effetto pietra naturale',                     linguaggi: ['Materico'] },
  { code: 'FD-P20', name: 'Effetto travertino',                dove: 'Parete d\'accento o bagno',          note: 'La materia della pietra con lo spessore di una pittura',     linguaggi: ['Materico'] },
  { code: 'FD-P21', name: 'Microcemento spatolato',            dove: 'Pavimenti e piani',                  note: 'Le passate della spatola restano visibili',                   linguaggi: ['Materico', 'Minimale'] },
];

// ponytail: un solo elenco di esempio per tutti i marchi; sparisce quando arrivano i cataloghi veri
const esempio = prefisso => ({
  colori: COLORI.map(c => ({ ...c, code: c.code.replace('FD-C', prefisso + '-') })),
  prodotti: PRODOTTI.map(p => ({ ...p, code: p.code.replace('FD-', prefisso + '-') })),
});

export default {
  marchi: {
    sikkens: { nome: 'Sikkens', logo: 'assets/marchi/sikkens.svg', ...esempio('SIK') },
    duco: { nome: 'Duco', logo: 'assets/marchi/duco.webp', ...esempio('DUC') },
  },
};
