// Taruvaltakunnat: fantasiamaailma 25 alueella ja 6 valtakunnalla.
// Evokatiiviset suomenkieliset nimet, joilla luonteva genitiivi. Naapuruudet
// johdetaan särmälistasta (symmetrisiä). ViewBox 1000 x 700, pelkkää dataa.

import { fromEdges } from './_util.js';

export const continents = {
  sydanmetsa: { name: 'Sydänmetsä', bonus: 4, color: '#4f9d5b' },
  ylamaa:     { name: 'Ylämaa',     bonus: 2, color: '#8a8f4a' },
  jaatikot:   { name: 'Jäätiköt',   bonus: 3, color: '#6fb8d9' },
  rannikko:   { name: 'Rannikko',   bonus: 3, color: '#4a9fd9' },
  tulivuoret: { name: 'Tulivuoret', bonus: 4, color: '#d95f3a' },
  aavikot:    { name: 'Aavikot',    bonus: 4, color: '#e0b24a' },
};

const base = {
  // --- Sydänmetsä ---
  hamarametsa:  { name: 'Hämärämetsä', gen: 'Hämärämetsän', continent: 'sydanmetsa', x: 110, y: 110 },
  kuiskausneva: { name: 'Kuiskausneva', gen: 'Kuiskausnevan', continent: 'sydanmetsa', x: 215, y: 95 },
  sammalvaara:  { name: 'Sammalvaara', gen: 'Sammalvaaran', continent: 'sydanmetsa', x: 140, y: 210 },
  lehtomaa:     { name: 'Lehtomaa',    gen: 'Lehtomaan',    continent: 'sydanmetsa', x: 250, y: 200 },

  // --- Ylämaa ---
  tuulenharja: { name: 'Tuulenharja', gen: 'Tuulenharjan', continent: 'ylamaa', x: 390, y: 110 },
  kotkanpesa:  { name: 'Kotkanpesä',  gen: 'Kotkanpesän',  continent: 'ylamaa', x: 480, y: 95 },
  kivikko:     { name: 'Kivikko',     gen: 'Kivikon',      continent: 'ylamaa', x: 420, y: 210 },

  // --- Jäätiköt ---
  routavuori:  { name: 'Routavuori',  gen: 'Routavuoren',  continent: 'jaatikot', x: 615, y: 95 },
  ikirouta:    { name: 'Ikirouta',    gen: 'Ikiroudan',    continent: 'jaatikot', x: 725, y: 90 },
  lumikentta:  { name: 'Lumikenttä',  gen: 'Lumikentän',   continent: 'jaatikot', x: 835, y: 110 },
  hallavuono:  { name: 'Hallavuono',  gen: 'Hallavuonon',  continent: 'jaatikot', x: 900, y: 195 },
  pakkasselka: { name: 'Pakkasselkä', gen: 'Pakkasselän',  continent: 'jaatikot', x: 700, y: 195 },

  // --- Rannikko ---
  suolakari:   { name: 'Suolakari',   gen: 'Suolakarin',   continent: 'rannikko', x: 150, y: 340 },
  myrskylahti: { name: 'Myrskylahti', gen: 'Myrskylahden', continent: 'rannikko', x: 275, y: 330 },
  helmisatama: { name: 'Helmisatama', gen: 'Helmisataman', continent: 'rannikko', x: 195, y: 450 },
  nakinniemi:  { name: 'Näkinniemi',  gen: 'Näkinniemen',  continent: 'rannikko', x: 305, y: 450 },

  // --- Tulivuoret ---
  tuhkavuori:     { name: 'Tuhkavuori',     gen: 'Tuhkavuoren',     continent: 'tulivuoret', x: 430, y: 345 },
  liekkilaakso:   { name: 'Liekkilaakso',   gen: 'Liekkilaakson',   continent: 'tulivuoret', x: 525, y: 415 },
  kraatterijarvi: { name: 'Kraatterijärvi', gen: 'Kraatterijärven', continent: 'tulivuoret', x: 420, y: 475 },
  laavavirta:     { name: 'Laavavirta',     gen: 'Laavavirran',     continent: 'tulivuoret', x: 505, y: 545 },

  // --- Aavikot ---
  hiekkameri:  { name: 'Hiekkameri',  gen: 'Hiekkameren',  continent: 'aavikot', x: 650, y: 345 },
  paahderotko: { name: 'Paahderotko', gen: 'Paahderotkon', continent: 'aavikot', x: 760, y: 320 },
  dyynikentta: { name: 'Dyynikenttä', gen: 'Dyynikentän',  continent: 'aavikot', x: 700, y: 450 },
  keidas:      { name: 'Keidas',      gen: 'Keitaan',      continent: 'aavikot', x: 825, y: 430 },
  luuautio:    { name: 'Luuautio',    gen: 'Luuaution',    continent: 'aavikot', x: 770, y: 560 },
};

const edges = [
  // Sydänmetsä
  ['hamarametsa', 'kuiskausneva'], ['hamarametsa', 'sammalvaara'],
  ['kuiskausneva', 'lehtomaa'], ['sammalvaara', 'lehtomaa'],
  // Ylämaa
  ['tuulenharja', 'kotkanpesa'], ['tuulenharja', 'kivikko'], ['kotkanpesa', 'kivikko'],
  // Jäätiköt
  ['routavuori', 'ikirouta'], ['ikirouta', 'lumikentta'], ['lumikentta', 'hallavuono'],
  ['routavuori', 'pakkasselka'], ['ikirouta', 'pakkasselka'], ['pakkasselka', 'hallavuono'],
  // Rannikko
  ['suolakari', 'myrskylahti'], ['suolakari', 'helmisatama'],
  ['myrskylahti', 'nakinniemi'], ['helmisatama', 'nakinniemi'],
  // Tulivuoret
  ['tuhkavuori', 'liekkilaakso'], ['tuhkavuori', 'kraatterijarvi'],
  ['liekkilaakso', 'kraatterijarvi'], ['kraatterijarvi', 'laavavirta'], ['liekkilaakso', 'laavavirta'],
  // Aavikot
  ['hiekkameri', 'paahderotko'], ['hiekkameri', 'dyynikentta'],
  ['paahderotko', 'dyynikentta'], ['paahderotko', 'keidas'],
  ['dyynikentta', 'keidas'], ['dyynikentta', 'luuautio'], ['keidas', 'luuautio'],

  // Valtakuntien väliset kapeikot
  ['lehtomaa', 'kivikko'], ['kuiskausneva', 'tuulenharja'],
  ['sammalvaara', 'suolakari'], ['lehtomaa', 'myrskylahti'],
  ['kotkanpesa', 'routavuori'],
  ['kivikko', 'tuhkavuori'], ['nakinniemi', 'tuhkavuori'],
  ['liekkilaakso', 'hiekkameri'], ['laavavirta', 'dyynikentta'],
  ['pakkasselka', 'hiekkameri'],
];

export const territories = fromEdges(base, edges);

export default { id: 'taruvaltakunnat', name: 'Taruvaltakunnat', continents, territories };
