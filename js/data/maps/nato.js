// Eurooppa 2025 -kartta Nato vs Venäjä -skenaariota varten: 24 aluetta,
// 7 aluetta (bonusryhmää). Suomi kahtena alueena, Venäjä useana, mukana
// Kaliningrad sekä miehitetty Itä-Ukraina ja Krim. Toimii myös vapaana
// karttana ilman skenaariota. Naapuruudet särmälistasta (symmetrisiä).

import { fromEdges } from './_util.js';

export const continents = {
  suomi:   { name: 'Suomi',          bonus: 2, color: '#4a9fd9' },
  pohjola: { name: 'Pohjola',        bonus: 2, color: '#7fc4e8' },
  itameri: { name: 'Itämeren rannikko', bonus: 2, color: '#e6b84a' },
  lansi:   { name: 'Länsi-Eurooppa', bonus: 4, color: '#4a78d9' },
  etela:   { name: 'Etelä-Eurooppa', bonus: 2, color: '#7ba84a' },
  ukraina: { name: 'Ukraina',        bonus: 3, color: '#e0a020' },
  venaja:  { name: 'Venäjä',         bonus: 4, color: '#d96c4a' },
};

const base = {
  // --- Suomi ---
  'pohjois-suomi': { name: 'Pohjois-Suomi', gen: 'Pohjois-Suomen', continent: 'suomi', x: 615, y: 85 },
  'etela-suomi':   { name: 'Etelä-Suomi',   gen: 'Etelä-Suomen',   continent: 'suomi', x: 610, y: 190 },

  // --- Pohjola ---
  norja:   { name: 'Norja',  gen: 'Norjan',  continent: 'pohjola', x: 420, y: 90 },
  ruotsi:  { name: 'Ruotsi', gen: 'Ruotsin', continent: 'pohjola', x: 500, y: 150 },
  tanska:  { name: 'Tanska', gen: 'Tanskan', continent: 'pohjola', x: 400, y: 235 },

  // --- Itämeren rannikko ---
  baltia:      { name: 'Baltia',      gen: 'Baltian',      continent: 'itameri', x: 600, y: 285 },
  puola:       { name: 'Puola',       gen: 'Puolan',       continent: 'itameri', x: 505, y: 375 },
  kaliningrad: { name: 'Kaliningrad', gen: 'Kaliningradin', continent: 'itameri', x: 525, y: 295 },

  // --- Länsi-Eurooppa ---
  saksa:     { name: 'Saksa',     gen: 'Saksan',     continent: 'lansi', x: 380, y: 330 },
  benelux:   { name: 'Benelux',   gen: 'Beneluxin',  continent: 'lansi', x: 285, y: 300 },
  britannia: { name: 'Britannia', gen: 'Britannian', continent: 'lansi', x: 165, y: 250 },
  ranska:    { name: 'Ranska',    gen: 'Ranskan',    continent: 'lansi', x: 245, y: 410 },

  // --- Etelä-Eurooppa ---
  'etela-eurooppa': { name: 'Etelä-Eurooppa', gen: 'Etelä-Euroopan', continent: 'etela', x: 330, y: 530 },
  balkan:           { name: 'Balkan',         gen: 'Balkanin',       continent: 'etela', x: 520, y: 520 },
  turkki:           { name: 'Turkki',         gen: 'Turkin',         continent: 'etela', x: 700, y: 610 },

  // --- Ukraina ---
  'lansi-ukraina': { name: 'Länsi-Ukraina', gen: 'Länsi-Ukrainan', continent: 'ukraina', x: 615, y: 450 },
  kiova:           { name: 'Kiova',          gen: 'Kiovan',          continent: 'ukraina', x: 705, y: 405 },
  'ita-ukraina':   { name: 'Itä-Ukraina',    gen: 'Itä-Ukrainan',    continent: 'ukraina', x: 795, y: 455 },
  krim:            { name: 'Krim',           gen: 'Krimin',          continent: 'ukraina', x: 760, y: 555 },

  // --- Venäjä ---
  'valko-venaja': { name: 'Valko-Venäjä', gen: 'Valko-Venäjän', continent: 'venaja', x: 685, y: 325 },
  pietari:        { name: 'Pietari',      gen: 'Pietarin',      continent: 'venaja', x: 725, y: 205 },
  kuola:          { name: 'Kuolan niemimaa', gen: 'Kuolan niemimaan', continent: 'venaja', x: 800, y: 75 },
  moskova:        { name: 'Moskova',      gen: 'Moskovan',      continent: 'venaja', x: 845, y: 285 },
  'etela-venaja': { name: 'Etelä-Venäjä', gen: 'Etelä-Venäjän', continent: 'venaja', x: 895, y: 430 },
};

const edges = [
  // Suomi
  ['pohjois-suomi', 'etela-suomi'], ['pohjois-suomi', 'norja'], ['pohjois-suomi', 'ruotsi'],
  ['pohjois-suomi', 'kuola'],
  ['etela-suomi', 'ruotsi'], ['etela-suomi', 'pietari'], ['etela-suomi', 'baltia'],
  // Pohjola
  ['norja', 'ruotsi'], ['norja', 'tanska'], ['norja', 'britannia'],
  ['ruotsi', 'tanska'], ['ruotsi', 'puola'],
  ['tanska', 'saksa'], ['tanska', 'britannia'],
  // Itämeri
  ['baltia', 'pietari'], ['baltia', 'kaliningrad'], ['baltia', 'puola'], ['baltia', 'valko-venaja'],
  ['kaliningrad', 'puola'],
  ['puola', 'saksa'], ['puola', 'valko-venaja'], ['puola', 'lansi-ukraina'],
  // Länsi
  ['saksa', 'benelux'], ['saksa', 'ranska'],
  ['benelux', 'britannia'], ['benelux', 'ranska'],
  ['britannia', 'ranska'],
  ['ranska', 'etela-eurooppa'],
  // Etelä
  ['etela-eurooppa', 'balkan'],
  ['balkan', 'lansi-ukraina'], ['balkan', 'turkki'],
  ['turkki', 'krim'], ['turkki', 'etela-venaja'],
  // Ukraina
  ['lansi-ukraina', 'kiova'],
  ['kiova', 'valko-venaja'], ['kiova', 'ita-ukraina'],
  ['ita-ukraina', 'moskova'], ['ita-ukraina', 'etela-venaja'], ['ita-ukraina', 'krim'],
  ['krim', 'etela-venaja'],
  // Venäjä
  ['valko-venaja', 'moskova'],
  ['pietari', 'kuola'], ['pietari', 'moskova'],
  ['kuola', 'moskova'],
  ['moskova', 'etela-venaja'],
];

export const territories = fromEdges(base, edges);

export default { id: 'eurooppa2025', name: 'Eurooppa 2025', continents, territories };
