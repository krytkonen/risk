// Afrikka-kartta: 20 aluetta, 5 alueryhmää. Yksi yhtenäinen maamassa (kaikki
// ryhmät maayhteydessä), selkeät kapeikot → hyvä kartta puolustus­strategialle.
// Naapuruudet johdetaan särmälistasta (taatusti symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/africa-land.js';

export const continents = {
  pohjoinen: { name: 'Pohjois-Afrikka', bonus: 4, color: '#e6b84a' },
  lansi:     { name: 'Länsi-Afrikka',   bonus: 3, color: '#7ba84a' },
  keski:     { name: 'Keski-Afrikka',   bonus: 3, color: '#d96c4a' },
  ita:       { name: 'Itä-Afrikka',     bonus: 4, color: '#4a9fd9' },
  etela:     { name: 'Etelä-Afrikka',   bonus: 3, color: '#b05ec0' },
};

const base = {
  // --- Pohjois-Afrikka ---
  marokko: { name: 'Marokko', gen: 'Marokon', continent: 'pohjoinen', x: 200, y: 86 },
  algeria: { name: 'Algeria', gen: 'Algerian', continent: 'pohjoinen', x: 313, y: 122 },
  libya:   { name: 'Libya',   gen: 'Libyan',   continent: 'pohjoinen', x: 487, y: 131 },
  egypti:  { name: 'Egypti',  gen: 'Egyptin',  continent: 'pohjoinen', x: 650, y: 131 },
  sudan:   { name: 'Sudan',   gen: 'Sudanin',  continent: 'pohjoinen', x: 650, y: 235 },

  // --- Länsi-Afrikka ---
  senegal: { name: 'Senegal', gen: 'Senegalin', continent: 'lansi', x: 94, y: 239 },
  mali:    { name: 'Mali',    gen: 'Malin',     continent: 'lansi', x: 225, y: 218 },
  guinea:  { name: 'Guinea',  gen: 'Guinean',   continent: 'lansi', x: 138, y: 273 },
  nigeria: { name: 'Nigeria', gen: 'Nigerian',  continent: 'lansi', x: 375, y: 281 },

  // --- Keski-Afrikka ---
  tsad:    { name: 'Tšad',    gen: 'Tšadin',    continent: 'keski', x: 506, y: 231 },
  kamerun: { name: 'Kamerun', gen: 'Kamerunin', continent: 'keski', x: 431, y: 314 },
  gabon:   { name: 'Gabon',   gen: 'Gabonin',   continent: 'keski', x: 421, y: 365 },
  kongo:   { name: 'Kongo',   gen: 'Kongon',    continent: 'keski', x: 562, y: 384 },

  // --- Itä-Afrikka ---
  etiopia: { name: 'Etiopia', gen: 'Etiopian',  continent: 'ita', x: 769, y: 289 },
  somalia: { name: 'Somalia', gen: 'Somalian',  continent: 'ita', x: 850, y: 318 },
  kenia:   { name: 'Kenia',   gen: 'Kenian',    continent: 'ita', x: 750, y: 355 },
  tansania:{ name: 'Tansania',gen: 'Tansanian', continent: 'ita', x: 712, y: 413 },

  // --- Etelä-Afrikka ---
  angola:       { name: 'Angola',        gen: 'Angolan',        continent: 'etela', x: 494, y: 463 },
  sambia:       { name: 'Sambia',        gen: 'Sambian',        continent: 'etela', x: 619, y: 480 },
  'etela-afrikka': { name: 'Etelä-Afrikka', gen: 'Etelä-Afrikan', continent: 'etela', x: 575, y: 606 },
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


// MANNERVYÖHYKKEET (geo-tila): osiot laatoittuvat jakaen AIDON Afrikan;
// Arabia/Levantti (Punaisenmeren linjan takana) ja Madagaskar jäävät
// neutraaleiksi (eivät pelattavia). Naapuriosiot jakavat rajaketjunsa.
export const zones = {
  pohjoinen: [[25,20],[660,20],[681,104],[816,254],[760,255],[700,300],[580,300],[560,185],[420,185],[300,180],[180,170],[90,160],[25,150]],
  lansi: [[25,150],[90,160],[180,170],[300,180],[420,185],[430,255],[380,330],[330,345],[240,345],[120,330],[25,330]],
  keski: [[420,185],[560,185],[580,300],[640,300],[640,430],[450,430],[380,330],[430,255]],
  ita: [[580,300],[700,300],[760,255],[816,254],[945,270],[945,425],[790,425],[768,470],[640,430],[640,300]],
  etela: [[640,430],[768,470],[790,500],[790,660],[300,660],[300,470],[450,430]],
};

export default { id: 'africa', landAdjacency: true, name: 'Afrikka', continents, territories, landBridges, geo: { land: LAND }, zones };
