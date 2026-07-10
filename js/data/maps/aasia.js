// Aasia-kartta: 40 aluetta, 9 mannerta. Aito maantiede (Natural Earth 50m,
// Miller-ikkuna lon 25..150, lat -12..74 → tools/geo.mjs). Solmut aidoilla
// projisoiduilla sijainneilla. Himalaja, Hindukush ja Ural ovat vyöhykerajoja.
// Naapuruudet johdetaan särmälistasta (symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/asia-land.js';

export const continents = {
  'lahi-ita':       { name: 'Lähi-itä',       bonus: 3, color: '#d96c4a' },
  arabia:           { name: 'Arabia',         bonus: 2, color: '#e6b84a' },
  'keski-aasia':    { name: 'Keski-Aasia',    bonus: 2, color: '#b05ec0' },
  siperia:          { name: 'Siperia',        bonus: 4, color: '#6fb8d9' },
  'etela-aasia':    { name: 'Etelä-Aasia',    bonus: 4, color: '#7ba84a' },
  'kaakkois-aasia': { name: 'Kaakkois-Aasia', bonus: 3, color: '#16a89a' },
  'ita-aasia':      { name: 'Itä-Aasia',      bonus: 5, color: '#d94f4f' },
  'koillis-aasia':  { name: 'Koillis-Aasia',  bonus: 3, color: '#4a78d9' },
  saaristo:         { name: 'Saaristo',       bonus: 3, color: '#8a8f4a' },
};

const base = {
  // --- Lähi-itä ---
  anatolia:    { name: 'Anatolia',    gen: 'Anatolian',    continent: 'lahi-ita', x: 66, y: 341 },
  levantti:    { name: 'Levantti',    gen: 'Levantin',     continent: 'lahi-ita', x: 112, y: 369 },
  mesopotamia: { name: 'Mesopotamia', gen: 'Mesopotamian', continent: 'lahi-ita', x: 169, y: 383 },
  kaukasus:    { name: 'Kaukasus',    gen: 'Kaukasuksen',  continent: 'lahi-ita', x: 174, y: 319 },
  persia:      { name: 'Persia',      gen: 'Persian',      continent: 'lahi-ita', x: 234, y: 390 },

  // --- Arabia ---
  'lansi-arabia': { name: 'Länsi-Arabia', gen: 'Länsi-Arabian', continent: 'arabia', x: 113, y: 431 },
  'ita-arabia':   { name: 'Itä-Arabia',   gen: 'Itä-Arabian',   continent: 'arabia', x: 223, y: 456 },
  jemen:          { name: 'Jemen',        gen: 'Jemenin',       continent: 'arabia', x: 171, y: 497 },

  // --- Keski-Aasia ---
  kazakstan:  { name: 'Kazakstan',  gen: 'Kazakstanin',  continent: 'keski-aasia', x: 344, y: 273 },
  uzbekistan: { name: 'Uzbekistan', gen: 'Uzbekistanin', continent: 'keski-aasia', x: 293, y: 329 },
  kirgisia:   { name: 'Kirgisia',   gen: 'Kirgisian',    continent: 'keski-aasia', x: 401, y: 326 },
  afganistan: { name: 'Afganistan', gen: 'Afganistanin', continent: 'keski-aasia', x: 345, y: 362 },

  // --- Siperia ---
  'lansi-siperia': { name: 'Länsi-Siperia', gen: 'Länsi-Siperian', continent: 'siperia', x: 344, y: 185 },
  'keski-siperia': { name: 'Keski-Siperia', gen: 'Keski-Siperian', continent: 'siperia', x: 519, y: 138 },
  jakutia:         { name: 'Jakutia',       gen: 'Jakutian',       continent: 'siperia', x: 800, y: 138 },
  baikal:          { name: 'Baikal',        gen: 'Baikalin',       continent: 'siperia', x: 649, y: 227 },
  kaukoita:        { name: 'Kaukoitä',      gen: 'Kaukoidän',      continent: 'siperia', x: 861, y: 269 },

  // --- Etelä-Aasia ---
  pakistan:        { name: 'Pakistan',      gen: 'Pakistanin',      continent: 'etela-aasia', x: 362, y: 425 },
  'pohjois-intia': { name: 'Pohjois-Intia', gen: 'Pohjois-Intian',  continent: 'etela-aasia', x: 428, y: 423 },
  'etela-intia':   { name: 'Etelä-Intia',   gen: 'Etelä-Intian',    continent: 'etela-aasia', x: 397, y: 500 },
  bengali:         { name: 'Bengali',       gen: 'Bengalin',        continent: 'etela-aasia', x: 505, y: 460 },
  'sri-lanka':     { name: 'Sri Lanka',     gen: 'Sri Lankan',      continent: 'etela-aasia', x: 454, y: 549 },

  // --- Kaakkois-Aasia ---
  burma:   { name: 'Burma',   gen: 'Burman',   continent: 'kaakkois-aasia', x: 568, y: 469 },
  thaimaa: { name: 'Thaimaa', gen: 'Thaimaan', continent: 'kaakkois-aasia', x: 615, y: 479 },
  vietnam: { name: 'Vietnam', gen: 'Vietnamin', continent: 'kaakkois-aasia', x: 661, y: 501 },
  malakka: { name: 'Malakka', gen: 'Malakan',  continent: 'kaakkois-aasia', x: 592, y: 545 },

  // --- Itä-Aasia ---
  'lansi-kiina':   { name: 'Länsi-Kiina',   gen: 'Länsi-Kiinan',   continent: 'ita-aasia', x: 473, y: 330 },
  tiibet:          { name: 'Tiibet',        gen: 'Tiibetin',       continent: 'ita-aasia', x: 504, y: 396 },
  'pohjois-kiina': { name: 'Pohjois-Kiina', gen: 'Pohjois-Kiinan', continent: 'ita-aasia', x: 698, y: 355 },
  'etela-kiina':   { name: 'Etelä-Kiina',   gen: 'Etelä-Kiinan',   continent: 'ita-aasia', x: 671, y: 436 },
  mongolia:        { name: 'Mongolia',      gen: 'Mongolian',      continent: 'ita-aasia', x: 618, y: 289 },

  // --- Koillis-Aasia ---
  mantsuria: { name: 'Mantšuria', gen: 'Mantšurian', continent: 'koillis-aasia', x: 789, y: 289 },
  korea:     { name: 'Korea',     gen: 'Korean',     continent: 'koillis-aasia', x: 804, y: 358 },
  japani:    { name: 'Japani',    gen: 'Japanin',    continent: 'koillis-aasia', x: 883, y: 374 },
  hokkaido:  { name: 'Hokkaido',  gen: 'Hokkaidon',  continent: 'koillis-aasia', x: 922, y: 311 },

  // --- Saaristo ---
  filippiinit: { name: 'Filippiinit', gen: 'Filippiinien', continent: 'saaristo', x: 764, y: 511 },
  borneo:      { name: 'Borneo',      gen: 'Borneon',      continent: 'saaristo', x: 701, y: 579 },
  sumatra:     { name: 'Sumatra',     gen: 'Sumatran',     continent: 'saaristo', x: 605, y: 608 },
  jaava:       { name: 'Jaava',       gen: 'Jaavan',       continent: 'saaristo', x: 675, y: 641 },
  sulawesi:    { name: 'Sulawesi',    gen: 'Sulawesin',    continent: 'saaristo', x: 758, y: 611 },
};

const edges = [
  // Lähi-itä
  ['anatolia', 'levantti'], ['anatolia', 'kaukasus'], ['anatolia', 'mesopotamia'],
  ['levantti', 'mesopotamia'], ['mesopotamia', 'kaukasus'], ['mesopotamia', 'persia'],
  ['kaukasus', 'persia'],
  ['levantti', 'lansi-arabia'], ['mesopotamia', 'ita-arabia'],
  ['kaukasus', 'kazakstan'], ['persia', 'uzbekistan'], ['persia', 'afganistan'], ['persia', 'pakistan'],
  // Arabia
  ['lansi-arabia', 'ita-arabia'], ['lansi-arabia', 'jemen'], ['ita-arabia', 'jemen'],
  ['ita-arabia', 'persia'],
  // Keski-Aasia
  ['kazakstan', 'uzbekistan'], ['kazakstan', 'kirgisia'], ['uzbekistan', 'kirgisia'],
  ['uzbekistan', 'afganistan'], ['kirgisia', 'afganistan'],
  ['kazakstan', 'lansi-siperia'], ['kazakstan', 'lansi-kiina'], ['kirgisia', 'lansi-kiina'],
  ['afganistan', 'pakistan'],
  // Siperia
  ['lansi-siperia', 'keski-siperia'], ['keski-siperia', 'jakutia'], ['keski-siperia', 'baikal'],
  ['jakutia', 'baikal'], ['jakutia', 'kaukoita'], ['baikal', 'kaukoita'],
  ['baikal', 'mongolia'], ['kaukoita', 'mantsuria'], ['kaukoita', 'hokkaido'],
  ['keski-siperia', 'mongolia'],
  // Etelä-Aasia
  ['pakistan', 'pohjois-intia'], ['pohjois-intia', 'bengali'], ['pohjois-intia', 'etela-intia'],
  ['etela-intia', 'sri-lanka'], ['etela-intia', 'bengali'],
  ['pohjois-intia', 'tiibet'], ['bengali', 'tiibet'], ['bengali', 'burma'],
  ['pakistan', 'lansi-kiina'],
  // Kaakkois-Aasia
  ['burma', 'thaimaa'], ['thaimaa', 'vietnam'], ['thaimaa', 'malakka'],
  ['burma', 'tiibet'], ['burma', 'etela-kiina'], ['vietnam', 'etela-kiina'],
  ['malakka', 'sumatra'], ['vietnam', 'filippiinit'],
  // Itä-Aasia
  ['lansi-kiina', 'tiibet'], ['lansi-kiina', 'mongolia'], ['tiibet', 'pohjois-kiina'],
  ['pohjois-kiina', 'etela-kiina'], ['pohjois-kiina', 'mongolia'], ['pohjois-kiina', 'mantsuria'],
  ['pohjois-kiina', 'korea'], ['mongolia', 'mantsuria'], ['etela-kiina', 'filippiinit'],
  // Koillis-Aasia
  ['mantsuria', 'korea'], ['korea', 'japani'], ['japani', 'hokkaido'],
  // Saaristo
  ['sumatra', 'jaava'], ['sumatra', 'borneo'], ['jaava', 'borneo'],
  ['borneo', 'sulawesi'], ['borneo', 'filippiinit'], ['sulawesi', 'filippiinit'],
];

export const territories = fromEdges(base, edges);

// Maayhteydessä olevat mannerparit (Aasia on yhtä maamassaa; saaristo ja
// Japani ovat meren takana). "a|b" aakkosjärjestyksessä.
export const landBridges = [
  'arabia|lahi-ita', 'keski-aasia|lahi-ita', 'etela-aasia|lahi-ita',
  'keski-aasia|siperia', 'etela-aasia|keski-aasia', 'ita-aasia|keski-aasia',
  'ita-aasia|siperia', 'koillis-aasia|siperia', 'etela-aasia|ita-aasia',
  'ita-aasia|kaakkois-aasia', 'etela-aasia|kaakkois-aasia', 'ita-aasia|koillis-aasia',
];

// MANNERVYÖHYKKEET (geo-tila): rajat kulkevat aidoista kohdista — Ural,
// Kaspia, Hindukush, Himalaja, Amur, Jalu. Eurooppa (Uralin länsipuoli),
// Egypti ja Taiwan jäävät neutraaleiksi.
export const zones = {
  'lahi-ita': [[25,310],[70,295],[120,295],[150,300],[195,306],[223,330],[245,358],[290,372],[302,380],[302,440],[250,430],[210,420],[150,420],[86,412],[60,405],[25,405]],
  arabia: [[86,412],[150,420],[210,420],[250,430],[268,445],[268,520],[200,545],[140,520],[86,455]],
  'keski-aasia': [[245,358],[223,330],[223,289],[260,270],[291,261],[291,245],[400,250],[440,270],[437,340],[430,395],[380,402],[340,398],[302,390],[302,380],[290,372]],
  siperia: [[291,25],[945,25],[945,300],[880,295],[861,290],[820,275],[780,258],[700,252],[640,252],[560,255],[470,272],[440,270],[400,250],[291,245]],
  'ita-aasia': [[440,270],[470,272],[560,255],[640,252],[700,252],[750,258],[762,268],[785,330],[760,340],[740,360],[740,390],[720,420],[700,455],[660,470],[620,470],[590,450],[557,417],[520,412],[480,408],[430,395],[437,340]],
  'koillis-aasia': [[762,268],[780,258],[820,275],[861,290],[880,295],[945,300],[945,420],[860,420],[820,400],[800,380],[785,330]],
  'etela-aasia': [[302,380],[302,440],[310,470],[350,510],[390,560],[420,600],[470,600],[500,570],[520,520],[540,480],[557,440],[557,417],[520,412],[480,408],[428,403],[380,402],[340,398],[302,390]],
  'kaakkois-aasia': [[557,417],[557,440],[540,480],[556,520],[576,548],[600,562],[618,580],[645,585],[665,540],[680,505],[660,470],[620,470],[590,450]],
  saaristo: [[560,585],[576,560],[600,572],[618,586],[645,592],[665,545],[680,510],[700,480],[740,470],[766,466],[810,480],[835,525],[835,655],[560,655]],
};

export default {
  id: 'aasia', name: 'Aasia', continents, territories, landBridges,
  geo: { land: LAND }, zones,
};
