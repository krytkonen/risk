// Eurooppa-kartta: 20 aluetta, 5 mannerta (alueryhmää).
// Naapuruudet johdetaan särmälistasta (taatusti symmetrisiä).

import { fromEdges } from './_util.js';

export const continents = {
  nordic:  { name: 'Pohjola',         bonus: 3, color: '#4a9fd9' },
  isles:   { name: 'Brittein saaret', bonus: 2, color: '#7ba84a' },
  west:    { name: 'Länsi-Eurooppa',  bonus: 4, color: '#d96c4a' },
  central: { name: 'Keski-Eurooppa',  bonus: 5, color: '#e6b84a' },
  east:    { name: 'Itä-Eurooppa',    bonus: 4, color: '#b05ec0' },
};

const base = {
  // --- Pohjola ---
  iceland:   { name: 'Islanti',   gen: 'Islannin',   continent: 'nordic', x: 180, y: 80 },
  norway:    { name: 'Norja',     gen: 'Norjan',     continent: 'nordic', x: 470, y: 90 },
  sweden:    { name: 'Ruotsi',    gen: 'Ruotsin',    continent: 'nordic', x: 540, y: 110 },
  finland:   { name: 'Suomi',     gen: 'Suomen',     continent: 'nordic', x: 630, y: 95 },
  denmark:   { name: 'Tanska',    gen: 'Tanskan',    continent: 'nordic', x: 480, y: 200 },

  // --- Brittein saaret ---
  ireland:   { name: 'Irlanti',   gen: 'Irlannin',   continent: 'isles', x: 250, y: 210 },
  britain:   { name: 'Britannia', gen: 'Britannian', continent: 'isles', x: 330, y: 220 },

  // --- Länsi-Eurooppa ---
  portugal:  { name: 'Portugali', gen: 'Portugalin', continent: 'west', x: 230, y: 430 },
  spain:     { name: 'Espanja',   gen: 'Espanjan',   continent: 'west', x: 320, y: 440 },
  france:    { name: 'Ranska',    gen: 'Ranskan',    continent: 'west', x: 400, y: 340 },
  benelux:   { name: 'Benelux',   gen: 'Beneluxin',  continent: 'west', x: 450, y: 280 },

  // --- Keski-Eurooppa ---
  germany:   { name: 'Saksa',     gen: 'Saksan',     continent: 'central', x: 540, y: 280 },
  poland:    { name: 'Puola',     gen: 'Puolan',     continent: 'central', x: 640, y: 250 },
  alps:      { name: 'Alppimaat', gen: 'Alppimaiden',continent: 'central', x: 530, y: 380 },
  italy:     { name: 'Italia',    gen: 'Italian',    continent: 'central', x: 560, y: 470 },

  // --- Itä-Eurooppa ---
  baltics:   { name: 'Baltia',    gen: 'Baltian',    continent: 'east', x: 680, y: 175 },
  ukraine:   { name: 'Ukraina',   gen: 'Ukrainan',   continent: 'east', x: 770, y: 300 },
  hungary:   { name: 'Unkari',    gen: 'Unkarin',    continent: 'east', x: 670, y: 380 },
  balkans:   { name: 'Balkan',    gen: 'Balkanin',   continent: 'east', x: 700, y: 470 },
  greece:    { name: 'Kreikka',   gen: 'Kreikan',    continent: 'east', x: 730, y: 560 },
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

// Maayhteydessä olevat mannerparit → rannikot koskettavat. Manner-Eurooppa
// (Länsi/Keski/Itä-Eurooppa + Pohjola) on yhtä maamassaa; Brittein saaret =
// saaret (meri, jää auki). Avaimet aakkosjärjestyksessä "a|b".
export const landBridges = ['central|nordic', 'central|west', 'central|east', 'east|nordic'];

export default { id: 'europe', name: 'Eurooppa', continents, territories, landBridges };
