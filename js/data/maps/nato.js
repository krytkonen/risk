// Eurooppa 2025 -kartta Nato vs Venäjä -skenaariota varten: 33 aluetta,
// 7 aluetta (bonusryhmää). Suomi neljänä alueena (puolustussyvyyttä),
// Venäjä useana, mukana Kaliningrad sekä miehitetty Itä-Ukraina ja Krim.
// Toimii myös vapaana karttana ilman skenaariota. Naapuruudet
// särmälistasta (symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/eu2025-land.js';

export const continents = {
  suomi:   { name: 'Suomi',          bonus: 3, color: '#4a9fd9' },
  pohjola: { name: 'Pohjola',        bonus: 3, color: '#7fc4e8' },
  itameri: { name: 'Itämeren rannikko', bonus: 3, color: '#e6b84a' },
  lansi:   { name: 'Länsi-Eurooppa', bonus: 4, color: '#4a78d9' },
  etela:   { name: 'Etelä-Eurooppa', bonus: 3, color: '#7ba84a' },
  ukraina: { name: 'Ukraina',        bonus: 3, color: '#e0a020' },
  venaja:  { name: 'Venäjä',         bonus: 5, color: '#d96c4a' },
};

const base = {
  // --- Suomi ---
  lappi:         { name: 'Lappi',       gen: 'Lapin',        continent: 'suomi', x: 519, y: 116 },
  oulu:          { name: 'Oulu',        gen: 'Oulun',        continent: 'suomi', x: 519, y: 176 },
  'jarvi-suomi': { name: 'Järvi-Suomi', gen: 'Järvi-Suomen', continent: 'suomi', x: 539, y: 239 },
  'etela-suomi': { name: 'Etelä-Suomi', gen: 'Etelä-Suomen', continent: 'suomi', x: 458, y: 248 },

  // --- Pohjola ---
  'pohjois-norja':  { name: 'Pohjois-Norja',  gen: 'Pohjois-Norjan',  continent: 'pohjola', x: 461, y: 78 },
  'etela-norja':    { name: 'Etelä-Norja',    gen: 'Etelä-Norjan',    continent: 'pohjola', x: 288, y: 252 },
  'pohjois-ruotsi': { name: 'Pohjois-Ruotsi', gen: 'Pohjois-Ruotsin', continent: 'pohjola', x: 423, y: 157 },
  'etela-ruotsi':   { name: 'Etelä-Ruotsi',   gen: 'Etelä-Ruotsin',   continent: 'pohjola', x: 372, y: 283 },
  tanska:           { name: 'Tanska',         gen: 'Tanskan',         continent: 'pohjola', x: 301, y: 340 },

  // --- Itämeren rannikko ---
  viro:        { name: 'Viro',        gen: 'Viron',         continent: 'itameri', x: 523, y: 302 },
  latvia:      { name: 'Latvia',      gen: 'Latvian',       continent: 'itameri', x: 466, y: 330 },
  liettua:     { name: 'Liettua',     gen: 'Liettuan',      continent: 'itameri', x: 514, y: 384 },
  kaliningrad: { name: 'Kaliningrad', gen: 'Kaliningradin', continent: 'itameri', x: 426, y: 360 },
  puola:       { name: 'Puola',       gen: 'Puolan',        continent: 'itameri', x: 436, y: 424 },

  // --- Länsi-Eurooppa ---
  britannia: { name: 'Britannia', gen: 'Britannian', continent: 'lansi', x: 160, y: 398 },
  benelux:   { name: 'Benelux',   gen: 'Beneluxin',  continent: 'lansi', x: 243, y: 414 },
  saksa:     { name: 'Saksa',     gen: 'Saksan',     continent: 'lansi', x: 311, y: 422 },
  ranska:    { name: 'Ranska',    gen: 'Ranskan',    continent: 'lansi', x: 211, y: 492 },

  // --- Etelä-Eurooppa ---
  'etela-eurooppa': { name: 'Etelä-Eurooppa', gen: 'Etelä-Euroopan', continent: 'etela', x: 205, y: 565 },
  balkan:           { name: 'Balkan',         gen: 'Balkanin',       continent: 'etela', x: 442, y: 551 },
  romania:          { name: 'Romania',        gen: 'Romanian',       continent: 'etela', x: 500, y: 502 },
  turkki:           { name: 'Turkki',         gen: 'Turkin',         continent: 'etela', x: 603, y: 594 },

  // --- Ukraina ---
  'lansi-ukraina': { name: 'Länsi-Ukraina', gen: 'Länsi-Ukrainan', continent: 'ukraina', x: 506, y: 446 },
  kiova:           { name: 'Kiova',         gen: 'Kiovan',         continent: 'ukraina', x: 596, y: 452 },
  odessa:          { name: 'Odessa',        gen: 'Odessan',        continent: 'ukraina', x: 548, y: 508 },
  'ita-ukraina':   { name: 'Itä-Ukraina',   gen: 'Itä-Ukrainan',   continent: 'ukraina', x: 660, y: 461 },
  krim:            { name: 'Krim',          gen: 'Krimin',         continent: 'ukraina', x: 610, y: 514 },

  // --- Venäjä ---
  kuola:          { name: 'Kuolan niemimaa', gen: 'Kuolan niemimaan', continent: 'venaja', x: 628, y: 116 },
  karjala:        { name: 'Karjala',       gen: 'Karjalan',       continent: 'venaja', x: 603, y: 205 },
  pietari:        { name: 'Pietari',       gen: 'Pietarin',       continent: 'venaja', x: 595, y: 280 },
  moskova:        { name: 'Moskova',       gen: 'Moskovan',       continent: 'venaja', x: 662, y: 345 },
  'valko-venaja': { name: 'Valko-Venäjä',  gen: 'Valko-Venäjän',  continent: 'venaja', x: 560, y: 388 },
  'etela-venaja': { name: 'Etelä-Venäjä',  gen: 'Etelä-Venäjän',  continent: 'venaja', x: 725, y: 469 },
};

const edges = [
  // Suomi (sisäinen verkko)
  ['lappi', 'oulu'], ['oulu', 'jarvi-suomi'], ['jarvi-suomi', 'etela-suomi'],
  ['oulu', 'etela-suomi'],
  // Suomi–Venäjä (itäraja)
  ['lappi', 'kuola'], ['oulu', 'karjala'], ['jarvi-suomi', 'karjala'],
  ['etela-suomi', 'pietari'],
  // Suomi–länsi (maaraja ja meriyhteydet)
  ['lappi', 'pohjois-ruotsi'], ['lappi', 'pohjois-norja'],
  ['oulu', 'pohjois-ruotsi'],
  ['etela-suomi', 'etela-ruotsi'], ['etela-suomi', 'viro'],
  // Pohjola
  ['pohjois-norja', 'etela-norja'], ['pohjois-norja', 'pohjois-ruotsi'],
  ['pohjois-norja', 'kuola'],
  ['pohjois-ruotsi', 'etela-ruotsi'], ['pohjois-ruotsi', 'etela-norja'],
  ['etela-norja', 'etela-ruotsi'], ['etela-norja', 'tanska'], ['etela-norja', 'britannia'],
  ['etela-ruotsi', 'tanska'], ['etela-ruotsi', 'puola'],
  ['tanska', 'saksa'], ['tanska', 'britannia'],
  // Itämeren rannikko
  ['viro', 'latvia'], ['viro', 'pietari'],
  ['latvia', 'liettua'], ['latvia', 'valko-venaja'],
  ['liettua', 'kaliningrad'], ['liettua', 'puola'], ['liettua', 'valko-venaja'],
  ['kaliningrad', 'puola'],
  ['puola', 'saksa'], ['puola', 'valko-venaja'], ['puola', 'lansi-ukraina'],
  // Länsi
  ['saksa', 'benelux'], ['saksa', 'ranska'],
  ['benelux', 'britannia'], ['benelux', 'ranska'],
  ['britannia', 'ranska'],
  ['ranska', 'etela-eurooppa'],
  // Etelä
  ['etela-eurooppa', 'balkan'],
  ['balkan', 'romania'], ['balkan', 'turkki'],
  ['romania', 'lansi-ukraina'], ['romania', 'odessa'],
  ['turkki', 'krim'], ['turkki', 'etela-venaja'],
  // Ukraina
  ['lansi-ukraina', 'kiova'], ['lansi-ukraina', 'odessa'], ['lansi-ukraina', 'valko-venaja'],
  ['kiova', 'valko-venaja'], ['kiova', 'ita-ukraina'], ['kiova', 'odessa'],
  ['odessa', 'krim'],
  ['ita-ukraina', 'moskova'], ['ita-ukraina', 'etela-venaja'], ['ita-ukraina', 'krim'],
  ['krim', 'etela-venaja'],
  // Venäjä
  ['kuola', 'karjala'],
  ['karjala', 'pietari'],
  ['pietari', 'moskova'],
  ['moskova', 'valko-venaja'], ['moskova', 'etela-venaja'],
];

export const territories = fromEdges(base, edges);

// Maayhteydessä olevat mannerparit (manner-Eurooppa/Baltia/Venäjä yhtenäisiä).
// Itämeren rannikko kiinnittyy Länteen Puola–Saksa-maarajalla (itameri|lansi).
// MERI jää auki: Suomenlahti (Itämeren rannikko–Suomi), avoin Itämeri
// (Itämeri–Pohjola: Ruotsi–Puola), Pohjola/Etelä–Venäjä (pitkät). "a|b" aakkosin.
export const landBridges = [
  'pohjola|suomi', 'suomi|venaja', 'itameri|lansi', 'itameri|venaja',
  'itameri|ukraina', 'etela|ukraina', 'ukraina|venaja', 'lansi|pohjola',
  'etela|lansi',
];


// MANNERVYÖHYKKEET (geo-tila): jakavat aidon Pohjois-/Itä-Euroopan oikeita
// rajoja pitkin (Suomi–Venäjä, Valko-Venäjä–Ukraina, Tonava...). Kaukasus ja
// ikkunan ulkopuoliset maat jäävät neutraaleiksi.
export const zones = {
  suomi: [[500,25],[575,25],[570,180],[555,250],[548,290],[490,295],[450,260],[460,175],[485,105]],
  pohjola: [[25,25],[500,25],[485,105],[460,175],[450,260],[445,300],[440,330],[415,352],[340,352],[310,355],[25,355]],
  itameri: [[445,300],[490,295],[548,290],[540,345],[560,415],[470,420],[430,440],[390,430],[408,375],[415,352],[440,330]],
  lansi: [[25,355],[310,355],[340,352],[415,352],[408,375],[390,430],[345,460],[300,470],[250,500],[180,520],[25,520]],
  etela: [[25,520],[180,520],[250,500],[300,470],[345,460],[390,430],[430,440],[470,420],[470,455],[530,480],[545,540],[620,555],[700,560],[720,590],[700,632],[25,632]],
  ukraina: [[470,420],[560,415],[640,405],[695,440],[695,520],[700,560],[620,555],[545,540],[530,480],[470,455]],
  venaja: [[575,25],[820,25],[820,530],[800,540],[720,520],[695,520],[695,440],[640,405],[560,415],[540,345],[548,290],[555,250],[570,180]],
};

export default { id: 'eurooppa2025', name: 'Eurooppa 2025', continents, territories, landBridges, geo: { land: LAND }, zones };
