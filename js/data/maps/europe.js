// Eurooppa-kartta: 20 aluetta, 5 mannerta (alueryhmää).
// Naapuruudet johdetaan särmälistasta (taatusti symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/europe-land.js';

export const continents = {
  nordic:  { name: 'Pohjola',         bonus: 3, color: '#4a9fd9' },
  isles:   { name: 'Brittein saaret', bonus: 2, color: '#7ba84a' },
  west:    { name: 'Länsi-Eurooppa',  bonus: 4, color: '#d96c4a' },
  central: { name: 'Keski-Eurooppa',  bonus: 5, color: '#e6b84a' },
  east:    { name: 'Itä-Eurooppa',    bonus: 4, color: '#b05ec0' },
};

const base = {
  // --- Pohjola ---
  iceland:   { name: 'Islanti',   gen: 'Islannin',   continent: 'nordic', x: 117, y: 159 },
  norway:    { name: 'Norja',     gen: 'Norjan',     continent: 'nordic', x: 507, y: 227 },
  sweden:    { name: 'Ruotsi',    gen: 'Ruotsin',    continent: 'nordic', x: 599, y: 256 },
  finland:   { name: 'Suomi',     gen: 'Suomen',     continent: 'nordic', x: 748, y: 208 },
  denmark:   { name: 'Tanska',    gen: 'Tanskan',    continent: 'nordic', x: 514, y: 328 },

  // --- Brittein saaret ---
  ireland:   { name: 'Irlanti',   gen: 'Irlannin',   continent: 'isles', x: 266, y: 376 },
  britain:   { name: 'Britannia', gen: 'Britannian', continent: 'isles', x: 358, y: 388 },

  // --- Länsi-Eurooppa ---
  portugal:  { name: 'Portugali', gen: 'Portugalin', continent: 'west', x: 263, y: 591 },
  spain:     { name: 'Espanja',   gen: 'Espanjan',   continent: 'west', x: 327, y: 581 },
  france:    { name: 'Ranska',    gen: 'Ranskan',    continent: 'west', x: 415, y: 485 },
  benelux:   { name: 'Benelux',   gen: 'Beneluxin',  continent: 'west', x: 450, y: 405 },

  // --- Keski-Eurooppa ---
  germany:   { name: 'Saksa',     gen: 'Saksan',     continent: 'central', x: 526, y: 413 },
  poland:    { name: 'Puola',     gen: 'Puolan',     continent: 'central', x: 656, y: 397 },
  alps:      { name: 'Alppimaat', gen: 'Alppimaiden',continent: 'central', x: 528, y: 481 },
  italy:     { name: 'Italia',    gen: 'Italian',    continent: 'central', x: 557, y: 542 },

  // --- Itä-Eurooppa ---
  baltics:   { name: 'Baltia',    gen: 'Baltian',    continent: 'east', x: 727, y: 319 },
  ukraine:   { name: 'Ukraina',   gen: 'Ukrainan',   continent: 'east', x: 819, y: 441 },
  hungary:   { name: 'Unkari',    gen: 'Unkarin',    continent: 'east', x: 653, y: 474 },
  balkans:   { name: 'Balkan',    gen: 'Balkanin',   continent: 'east', x: 670, y: 532 },
  greece:    { name: 'Kreikka',   gen: 'Kreikan',    continent: 'east', x: 699, y: 599 },
};

const edges = [
  // Pohjola
  ['iceland', 'norway'], ['iceland', 'britain'],
  ['norway', 'sweden'], ['norway', 'denmark'],
  ['sweden', 'finland'], ['sweden', 'denmark'], ['sweden', 'baltics'],
  ['finland', 'baltics'],
  ['denmark', 'germany'], ['denmark', 'britain'],
  // Brittein saaret
  ['ireland', 'britain'],
  ['britain', 'benelux'], ['britain', 'france'],
  // Länsi-Eurooppa
  ['portugal', 'spain'],
  ['spain', 'france'],
  ['france', 'benelux'], ['france', 'alps'], ['france', 'italy'],
  ['benelux', 'germany'],
  // Keski-Eurooppa
  ['germany', 'poland'], ['germany', 'alps'], ['germany', 'baltics'],
  ['poland', 'baltics'], ['poland', 'ukraine'], ['poland', 'hungary'],
  ['alps', 'italy'], ['alps', 'hungary'],
  ['italy', 'balkans'], ['italy', 'greece'],
  // Itä-Eurooppa
  ['baltics', 'ukraine'],
  ['ukraine', 'hungary'], ['ukraine', 'balkans'],
  ['hungary', 'balkans'],
  ['balkans', 'greece'],
];

export const territories = fromEdges(base, edges);

// Maayhteydessä olevat mannerparit → rannikot koskettavat. Manner-Eurooppa on
// yhtä maamassaa: Pohjola kiinnittyy mantereeseen Tanska–Saksa-kannaksella
// (central|nordic) ja Itä-Eurooppa Puola–Baltia-maarajalla (central|east).
// Pohjola↔Itä-Eurooppa (Ruotsi/Suomi–Baltia) on sen sijaan Itämeri/Suomenlahti
// → EI siltaa, meri jää auki. Brittein saaret = saaret (meri auki). "a|b" aakkosin.
export const landBridges = ['central|east', 'central|nordic', 'central|west'];


// MANNERVYÖHYKKEET (geo-tila): jakavat aidon Euroopan; Venäjä, Anatolia ja
// Pohjois-Afrikka jäävät neutraaleiksi. Kanaali/Doverin salmi ja Adrianmeri
// kierretään niin että rannikot värittyvät oikein.
export const zones = {
  nordic: [[25,25],[800,25],[800,258],[690,262],[660,300],[640,330],[620,352],[536,352],[470,352],[470,300],[300,300],[25,300]],
  isles: [[240,300],[430,300],[430,390],[408,404],[396,410],[370,428],[330,436],[280,430],[240,415]],
  west: [[240,415],[280,430],[330,436],[370,428],[396,410],[408,404],[430,390],[455,385],[479,372],[492,430],[500,465],[487,511],[500,560],[480,610],[460,632],[25,632],[25,415]],
  central: [[479,372],[536,352],[620,352],[660,355],[703,349],[700,430],[620,445],[600,470],[575,508],[620,570],[640,632],[560,632],[520,570],[487,511],[500,465],[492,430]],
  east: [[690,262],[800,258],[800,290],[870,290],[870,560],[800,565],[790,580],[770,632],[640,632],[620,570],[575,508],[600,470],[620,445],[700,430],[703,349],[690,330],[660,300]],
};

export default { id: 'europe', name: 'Eurooppa', continents, territories, landBridges, geo: { land: LAND }, zones };
