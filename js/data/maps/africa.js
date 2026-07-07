// Afrikka-kartta: 20 aluetta, 5 alueryhmää. Yksi yhtenäinen maamassa (kaikki
// ryhmät maayhteydessä), selkeät kapeikot → hyvä kartta puolustus­strategialle.
// Naapuruudet johdetaan särmälistasta (taatusti symmetrisiä).

import { fromEdges } from './_util.js';

export const continents = {
  pohjoinen: { name: 'Pohjois-Afrikka', bonus: 4, color: '#e6b84a' },
  lansi:     { name: 'Länsi-Afrikka',   bonus: 3, color: '#7ba84a' },
  keski:     { name: 'Keski-Afrikka',   bonus: 3, color: '#d96c4a' },
  ita:       { name: 'Itä-Afrikka',     bonus: 4, color: '#4a9fd9' },
  etela:     { name: 'Etelä-Afrikka',   bonus: 3, color: '#b05ec0' },
};

const base = {
  // --- Pohjois-Afrikka ---
  marokko: { name: 'Marokko', gen: 'Marokon', continent: 'pohjoinen', x: 200, y: 150 },
  algeria: { name: 'Algeria', gen: 'Algerian', continent: 'pohjoinen', x: 340, y: 150 },
  libya:   { name: 'Libya',   gen: 'Libyan',   continent: 'pohjoinen', x: 480, y: 155 },
  egypti:  { name: 'Egypti',  gen: 'Egyptin',  continent: 'pohjoinen', x: 620, y: 140 },
  sudan:   { name: 'Sudan',   gen: 'Sudanin',  continent: 'pohjoinen', x: 560, y: 255 },

  // --- Länsi-Afrikka ---
  senegal: { name: 'Senegal', gen: 'Senegalin', continent: 'lansi', x: 120, y: 255 },
  mali:    { name: 'Mali',    gen: 'Malin',     continent: 'lansi', x: 255, y: 250 },
  guinea:  { name: 'Guinea',  gen: 'Guinean',   continent: 'lansi', x: 155, y: 340 },
  nigeria: { name: 'Nigeria', gen: 'Nigerian',  continent: 'lansi', x: 350, y: 330 },

  // --- Keski-Afrikka ---
  tsad:    { name: 'Tšad',    gen: 'Tšadin',    continent: 'keski', x: 465, y: 275 },
  kamerun: { name: 'Kamerun', gen: 'Kamerunin', continent: 'keski', x: 405, y: 375 },
  gabon:   { name: 'Gabon',   gen: 'Gabonin',   continent: 'keski', x: 375, y: 460 },
  kongo:   { name: 'Kongo',   gen: 'Kongon',    continent: 'keski', x: 500, y: 435 },

  // --- Itä-Afrikka ---
  etiopia: { name: 'Etiopia', gen: 'Etiopian',  continent: 'ita', x: 690, y: 295 },
  somalia: { name: 'Somalia', gen: 'Somalian',  continent: 'ita', x: 800, y: 285 },
  kenia:   { name: 'Kenia',   gen: 'Kenian',    continent: 'ita', x: 695, y: 400 },
  tansania:{ name: 'Tansania',gen: 'Tansanian', continent: 'ita', x: 665, y: 480 },

  // --- Etelä-Afrikka ---
  angola:       { name: 'Angola',        gen: 'Angolan',        continent: 'etela', x: 470, y: 545 },
  sambia:       { name: 'Sambia',        gen: 'Sambian',        continent: 'etela', x: 595, y: 545 },
  'etela-afrikka': { name: 'Etelä-Afrikka', gen: 'Etelä-Afrikan', continent: 'etela', x: 545, y: 625 },
};

const edges = [
  // Pohjois-Afrikka
  ['marokko', 'algeria'], ['algeria', 'libya'], ['libya', 'egypti'],
  ['libya', 'sudan'], ['egypti', 'sudan'],
  // Pohjois ↔ Länsi
  ['marokko', 'senegal'], ['algeria', 'mali'],
  // Länsi-Afrikka
  ['senegal', 'mali'], ['senegal', 'guinea'], ['mali', 'guinea'], ['mali', 'nigeria'],
  // Länsi ↔ Keski
  ['nigeria', 'kamerun'], ['nigeria', 'tsad'],
  // Pohjois ↔ Keski
  ['libya', 'tsad'], ['sudan', 'tsad'],
  // Keski-Afrikka
  ['tsad', 'kamerun'], ['kamerun', 'gabon'], ['kamerun', 'kongo'], ['gabon', 'kongo'],
  // Pohjois ↔ Itä
  ['sudan', 'etiopia'],
  // Itä-Afrikka
  ['etiopia', 'somalia'], ['etiopia', 'kenia'], ['somalia', 'kenia'], ['kenia', 'tansania'],
  // Keski ↔ Itä
  ['kongo', 'tansania'],
  // Keski ↔ Etelä
  ['kongo', 'angola'], ['kongo', 'sambia'],
  // Itä ↔ Etelä
  ['tansania', 'sambia'],
  // Etelä-Afrikka
  ['angola', 'sambia'], ['angola', 'etela-afrikka'], ['sambia', 'etela-afrikka'],
];

export const territories = fromEdges(base, edges);

// Koko Afrikka on yhtä maamassaa → kaikki vierekkäiset aluepari-rajat ovat
// maayhteyksiä (rannikot koskettavat). Ei merirajoja (ei saaria). "a|b" aakkosin.
export const landBridges = [
  'lansi|pohjoinen', 'keski|pohjoinen', 'ita|pohjoinen',
  'keski|lansi', 'ita|keski', 'etela|keski', 'etela|ita',
];

export default { id: 'africa', name: 'Afrikka', continents, territories, landBridges };
