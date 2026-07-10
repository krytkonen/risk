// Amerikat-kartta: 40 aluetta, 9 mannerta Alaskasta Falklandeille. Aito
// maantiede (Natural Earth 50m, Miller-ikkuna lon -170..-32, lat -56..74).
// Panama on kartan keskeinen kapeikko. Naapuruudet särmälistasta.

import { fromEdges } from './_util.js';
import { LAND } from '../geo/americas-land.js';

export const continents = {
  arktis:          { name: 'Arktis',          bonus: 4, color: '#6fb8d9' },
  kanada:          { name: 'Kanada',          bonus: 3, color: '#d96c4a' },
  'usa-lansi':     { name: 'Länsi-USA',       bonus: 3, color: '#e6b84a' },
  'usa-ita':       { name: 'Itä-USA',         bonus: 4, color: '#4a78d9' },
  'vali-amerikka': { name: 'Väli-Amerikka',   bonus: 3, color: '#7ba84a' },
  karibia:         { name: 'Karibia',         bonus: 2, color: '#b05ec0' },
  amazonia:        { name: 'Amazonia',        bonus: 3, color: '#16a89a' },
  andit:           { name: 'Andit',           bonus: 3, color: '#d94f4f' },
  atlantti:        { name: 'Atlantin rannikko', bonus: 3, color: '#8a8f4a' },
};

const base = {
  // --- Arktis ---
  alaska:             { name: 'Alaska',             gen: 'Alaskan',             continent: 'arktis', x: 149, y: 103 },
  yukon:              { name: 'Yukon',              gen: 'Yukonin',             continent: 'arktis', x: 266, y: 106 },
  luoteisterritoriot: { name: 'Luoteisterritoriot', gen: 'Luoteisterritorioiden', continent: 'arktis', x: 404, y: 103 },
  nunavut:            { name: 'Nunavut',            gen: 'Nunavutin',           continent: 'arktis', x: 541, y: 96 },
  baffininmaa:        { name: 'Baffininmaa',        gen: 'Baffininmaan',        continent: 'arktis', x: 700, y: 75 },
  gronlanti:          { name: 'Grönlanti',          gen: 'Grönlannin',          continent: 'arktis', x: 906, y: 46 },

  // --- Kanada ---
  'brittilainen-kolumbia': { name: 'Brit. Kolumbia', gen: 'Brit. Kolumbian', continent: 'kanada', x: 305, y: 159 },
  preeriat:          { name: 'Preeriat',        gen: 'Preerioiden',      continent: 'kanada', x: 484, y: 145 },
  ontario:           { name: 'Ontario',         gen: 'Ontarion',         continent: 'kanada', x: 617, y: 185 },
  quebec:            { name: 'Quebec',          gen: 'Quebecin',         continent: 'kanada', x: 706, y: 168 },
  'atlantin-kanada': { name: 'Atlantin Kanada', gen: 'Atlantin Kanadan', continent: 'kanada', x: 763, y: 205 },

  // --- Länsi-USA ---
  'luoteis-usa':  { name: 'Luoteis-USA',  gen: 'Luoteis-USA:n',  continent: 'usa-lansi', x: 371, y: 183 },
  kalifornia:     { name: 'Kalifornia',   gen: 'Kalifornian',    continent: 'usa-lansi', x: 349, y: 245 },
  kalliovuoret:   { name: 'Kalliovuoret', gen: 'Kalliovuorten',  continent: 'usa-lansi', x: 446, y: 209 },
  'lounais-usa':  { name: 'Lounais-USA',  gen: 'Lounais-USA:n',  continent: 'usa-lansi', x: 404, y: 271 },

  // --- Itä-USA ---
  tasangot:       { name: 'Tasangot',     gen: 'Tasankojen',     continent: 'usa-ita', x: 524, y: 211 },
  teksas:         { name: 'Teksas',       gen: 'Teksasin',       continent: 'usa-ita', x: 518, y: 274 },
  keskilansi:     { name: 'Keskilänsi',   gen: 'Keskilännen',    continent: 'usa-ita', x: 573, y: 226 },
  'kaakkois-usa': { name: 'Kaakkois-USA', gen: 'Kaakkois-USA:n', continent: 'usa-ita', x: 627, y: 255 },
  'koillis-usa':  { name: 'Koillis-USA',  gen: 'Koillis-USA:n',  continent: 'usa-ita', x: 683, y: 230 },

  // --- Väli-Amerikka ---
  'pohjois-meksiko': { name: 'Pohjois-Meksiko', gen: 'Pohjois-Meksikon', continent: 'vali-amerikka', x: 460, y: 303 },
  'etela-meksiko':   { name: 'Etelä-Meksiko',   gen: 'Etelä-Meksikon',   continent: 'vali-amerikka', x: 528, y: 344 },
  jukatan:           { name: 'Jukatan',         gen: 'Jukatanin',        continent: 'vali-amerikka', x: 573, y: 327 },
  'keski-amerikka':  { name: 'Keski-Amerikka',  gen: 'Keski-Amerikan',   continent: 'vali-amerikka', x: 617, y: 371 },
  panama:            { name: 'Panama',          gen: 'Panaman',          continent: 'vali-amerikka', x: 686, y: 398 },

  // --- Karibia ---
  kuuba:            { name: 'Kuuba',           gen: 'Kuuban',           continent: 'karibia', x: 654, y: 318 },
  hispaniola:       { name: 'Hispaniola',      gen: 'Hispaniolan',      continent: 'karibia', x: 711, y: 330 },

  // --- Amazonia ---
  venezuela: { name: 'Venezuela', gen: 'Venezuelan', continent: 'amazonia', x: 781, y: 404 },
  kolumbia:  { name: 'Kolumbia',  gen: 'Kolumbian',  continent: 'amazonia', x: 729, y: 417 },
  guayanat:  { name: 'Guayanat',  gen: 'Guayanoiden', continent: 'amazonia', x: 828, y: 392 },
  amazonia:  { name: 'Amazonia',  gen: 'Amazonian',  continent: 'amazonia', x: 818, y: 468 },

  // --- Andit ---
  ecuador: { name: 'Ecuador', gen: 'Ecuadorin', continent: 'andit', x: 646, y: 441 },
  peru:    { name: 'Peru',    gen: 'Perun',     continent: 'andit', x: 701, y: 481 },
  bolivia: { name: 'Bolivia', gen: 'Bolivian',  continent: 'andit', x: 750, y: 489 },
  chile:   { name: 'Chile',   gen: 'Chilen',    continent: 'andit', x: 708, y: 552 },

  // --- Atlantin rannikko ---
  brasilia:   { name: 'Brasilia',   gen: 'Brasilian',   continent: 'atlantti', x: 884, y: 469 },
  laplata:    { name: 'La Plata',   gen: 'La Platan',   continent: 'atlantti', x: 793, y: 550 },
  patagonia:  { name: 'Patagonia',  gen: 'Patagonian',  continent: 'atlantti', x: 724, y: 615 },
  falklandit: { name: 'Falklandit', gen: 'Falklandien', continent: 'atlantti', x: 790, y: 646 },
};

const edges = [
  // Arktis
  ['alaska', 'yukon'], ['yukon', 'luoteisterritoriot'], ['luoteisterritoriot', 'nunavut'],
  ['nunavut', 'baffininmaa'], ['baffininmaa', 'gronlanti'],
  ['alaska', 'brittilainen-kolumbia'], ['yukon', 'brittilainen-kolumbia'],
  ['luoteisterritoriot', 'preeriat'], ['nunavut', 'ontario'], ['baffininmaa', 'quebec'],
  // Kanada
  ['brittilainen-kolumbia', 'preeriat'], ['preeriat', 'ontario'], ['ontario', 'quebec'],
  ['quebec', 'atlantin-kanada'],
  ['brittilainen-kolumbia', 'luoteis-usa'], ['preeriat', 'kalliovuoret'], ['preeriat', 'tasangot'],
  ['ontario', 'keskilansi'], ['quebec', 'koillis-usa'], ['atlantin-kanada', 'koillis-usa'],
  // Länsi-USA
  ['luoteis-usa', 'kalifornia'], ['luoteis-usa', 'kalliovuoret'],
  ['kalifornia', 'lounais-usa'], ['kalliovuoret', 'lounais-usa'], ['kalliovuoret', 'tasangot'],
  ['lounais-usa', 'teksas'], ['lounais-usa', 'pohjois-meksiko'], ['kalifornia', 'pohjois-meksiko'],
  // Itä-USA
  ['tasangot', 'keskilansi'], ['tasangot', 'teksas'], ['keskilansi', 'koillis-usa'],
  ['keskilansi', 'kaakkois-usa'], ['teksas', 'kaakkois-usa'], ['kaakkois-usa', 'koillis-usa'],
  ['teksas', 'pohjois-meksiko'], ['kaakkois-usa', 'kuuba'],
  // Väli-Amerikka
  ['pohjois-meksiko', 'etela-meksiko'], ['etela-meksiko', 'jukatan'],
  ['etela-meksiko', 'keski-amerikka'], ['jukatan', 'keski-amerikka'], ['jukatan', 'kuuba'],
  ['keski-amerikka', 'panama'], ['panama', 'kolumbia'],
  // Karibia
  ['kuuba', 'hispaniola'], ['hispaniola', 'venezuela'],
  // Amazonia
  ['venezuela', 'kolumbia'], ['venezuela', 'guayanat'], ['venezuela', 'amazonia'],
  ['guayanat', 'amazonia'], ['kolumbia', 'amazonia'], ['kolumbia', 'ecuador'],
  ['amazonia', 'peru'], ['amazonia', 'brasilia'],
  // Andit
  ['ecuador', 'peru'], ['peru', 'bolivia'], ['bolivia', 'chile'], ['bolivia', 'laplata'],
  ['bolivia', 'brasilia'], ['chile', 'patagonia'], ['chile', 'laplata'],
  // Atlantin rannikko
  ['brasilia', 'laplata'], ['laplata', 'patagonia'], ['patagonia', 'falklandit'],
];

export const territories = fromEdges(base, edges);

// Maayhteydessä olevat mannerparit ("a|b" aakkosin). Karibia = saaria.
export const landBridges = [
  'arktis|kanada', 'kanada|usa-lansi', 'kanada|usa-ita', 'usa-ita|usa-lansi',
  'usa-lansi|vali-amerikka', 'usa-ita|vali-amerikka', 'amazonia|vali-amerikka',
  'amazonia|andit', 'amazonia|atlantti', 'andit|atlantti',
];

// MANNERVYÖHYKKEET (geo-tila): rajat aidoista kohdista — arktinen raja,
// 49. leveyspiiri, Rio Grande, Panama–Kolumbia, Andien itäreuna.
export const zones = {
  arktis: [[25,25],[945,25],[945,110],[780,110],[700,120],[600,125],[507,128],[400,133],[300,140],[200,140],[100,133],[25,128]],
  kanada: [[25,128],[100,133],[200,140],[300,140],[400,133],[507,128],[600,125],[700,120],[780,110],[945,110],[945,230],[790,230],[740,215],[680,205],[600,200],[507,191],[420,185],[350,182],[280,175],[200,168],[100,160],[25,155]],
  'usa-lansi': [[25,155],[100,160],[200,168],[280,175],[350,182],[420,185],[490,188],[490,296],[430,282],[380,272],[340,268],[25,268]],
  'usa-ita': [[490,188],[507,191],[600,200],[680,205],[740,215],[790,230],[790,260],[700,260],[685,295],[660,318],[624,314],[600,300],[560,300],[507,288],[490,296]],
  'vali-amerikka': [[25,268],[340,268],[380,272],[430,282],[507,288],[560,300],[600,302],[598,318],[612,342],[630,360],[648,372],[660,380],[690,398],[686,414],[655,414],[620,404],[596,382],[600,372],[565,352],[520,345],[450,330],[350,318],[200,300],[25,295]],
  karibia: [[622,319],[700,313],[810,318],[810,368],[760,368],[700,355],[660,342],[625,332]],
  amazonia: [[686,414],[690,398],[688,380],[740,368],[800,380],[830,392],[830,468],[784,476],[740,452],[700,430],[686,414]],
  andit: [[686,414],[700,430],[740,455],[765,472],[758,502],[730,530],[696,574],[700,600],[680,622],[652,572],[640,500],[630,450],[638,430],[660,428]],
  atlantti: [[830,392],[900,420],[930,460],[900,520],[850,560],[810,610],[810,660],[700,660],[692,610],[700,600],[696,574],[730,530],[758,502],[765,472],[740,455],[700,430],[740,452],[784,476],[830,468]],
};

export default {
  id: 'amerikat', name: 'Amerikat', continents, territories, landBridges,
  geo: { land: LAND }, zones,
};
