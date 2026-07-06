// Eurooppa 2025 -kartta Nato vs Venäjä -skenaariota varten: 33 aluetta,
// 7 aluetta (bonusryhmää). Suomi neljänä alueena (puolustussyvyyttä),
// Venäjä useana, mukana Kaliningrad sekä miehitetty Itä-Ukraina ja Krim.
// Toimii myös vapaana karttana ilman skenaariota. Naapuruudet
// särmälistasta (symmetrisiä).

import { fromEdges } from './_util.js';

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
  lappi:         { name: 'Lappi',       gen: 'Lapin',        continent: 'suomi', x: 615, y: 65 },
  oulu:          { name: 'Oulu',        gen: 'Oulun',        continent: 'suomi', x: 635, y: 140 },
  'jarvi-suomi': { name: 'Järvi-Suomi', gen: 'Järvi-Suomen', continent: 'suomi', x: 655, y: 215 },
  'etela-suomi': { name: 'Etelä-Suomi', gen: 'Etelä-Suomen', continent: 'suomi', x: 590, y: 260 },

  // --- Pohjola ---
  'pohjois-norja':  { name: 'Pohjois-Norja',  gen: 'Pohjois-Norjan',  continent: 'pohjola', x: 480, y: 60 },
  'etela-norja':    { name: 'Etelä-Norja',    gen: 'Etelä-Norjan',    continent: 'pohjola', x: 390, y: 165 },
  'pohjois-ruotsi': { name: 'Pohjois-Ruotsi', gen: 'Pohjois-Ruotsin', continent: 'pohjola', x: 540, y: 130 },
  'etela-ruotsi':   { name: 'Etelä-Ruotsi',   gen: 'Etelä-Ruotsin',   continent: 'pohjola', x: 480, y: 230 },
  tanska:           { name: 'Tanska',         gen: 'Tanskan',         continent: 'pohjola', x: 390, y: 290 },

  // --- Itämeren rannikko ---
  viro:        { name: 'Viro',        gen: 'Viron',         continent: 'itameri', x: 625, y: 330 },
  latvia:      { name: 'Latvia',      gen: 'Latvian',       continent: 'itameri', x: 600, y: 395 },
  liettua:     { name: 'Liettua',     gen: 'Liettuan',      continent: 'itameri', x: 560, y: 455 },
  kaliningrad: { name: 'Kaliningrad', gen: 'Kaliningradin', continent: 'itameri', x: 485, y: 420 },
  puola:       { name: 'Puola',       gen: 'Puolan',        continent: 'itameri', x: 515, y: 510 },

  // --- Länsi-Eurooppa ---
  britannia: { name: 'Britannia', gen: 'Britannian', continent: 'lansi', x: 165, y: 250 },
  benelux:   { name: 'Benelux',   gen: 'Beneluxin',  continent: 'lansi', x: 280, y: 330 },
  saksa:     { name: 'Saksa',     gen: 'Saksan',     continent: 'lansi', x: 390, y: 390 },
  ranska:    { name: 'Ranska',    gen: 'Ranskan',    continent: 'lansi', x: 230, y: 440 },

  // --- Etelä-Eurooppa ---
  'etela-eurooppa': { name: 'Etelä-Eurooppa', gen: 'Etelä-Euroopan', continent: 'etela', x: 320, y: 560 },
  balkan:           { name: 'Balkan',         gen: 'Balkanin',       continent: 'etela', x: 480, y: 605 },
  romania:          { name: 'Romania',        gen: 'Romanian',       continent: 'etela', x: 595, y: 560 },
  turkki:           { name: 'Turkki',         gen: 'Turkin',         continent: 'etela', x: 720, y: 630 },

  // --- Ukraina ---
  'lansi-ukraina': { name: 'Länsi-Ukraina', gen: 'Länsi-Ukrainan', continent: 'ukraina', x: 630, y: 505 },
  kiova:           { name: 'Kiova',         gen: 'Kiovan',         continent: 'ukraina', x: 700, y: 445 },
  odessa:          { name: 'Odessa',        gen: 'Odessan',        continent: 'ukraina', x: 700, y: 560 },
  'ita-ukraina':   { name: 'Itä-Ukraina',   gen: 'Itä-Ukrainan',   continent: 'ukraina', x: 810, y: 480 },
  krim:            { name: 'Krim',          gen: 'Krimin',         continent: 'ukraina', x: 790, y: 590 },

  // --- Venäjä ---
  kuola:          { name: 'Kuolan niemimaa', gen: 'Kuolan niemimaan', continent: 'venaja', x: 760, y: 55 },
  karjala:        { name: 'Karjala',       gen: 'Karjalan',       continent: 'venaja', x: 745, y: 150 },
  pietari:        { name: 'Pietari',       gen: 'Pietarin',       continent: 'venaja', x: 720, y: 245 },
  moskova:        { name: 'Moskova',       gen: 'Moskovan',       continent: 'venaja', x: 855, y: 250 },
  'valko-venaja': { name: 'Valko-Venäjä',  gen: 'Valko-Venäjän',  continent: 'venaja', x: 700, y: 350 },
  'etela-venaja': { name: 'Etelä-Venäjä',  gen: 'Etelä-Venäjän',  continent: 'venaja', x: 900, y: 420 },
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

export default { id: 'eurooppa2025', name: 'Eurooppa 2025', continents, territories };
