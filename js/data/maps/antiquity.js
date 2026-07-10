// Antiikin maailma -kartta: 20 aluetta, 5 mannerta (Välimeren ympäristö).
// Naapuruudet johdetaan särmälistasta (taatusti symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/antiquity-land.js';

export const continents = {
  iberia: { name: 'Iberia',  bonus: 2, color: '#e6b84a' },
  gallia: { name: 'Gallia',  bonus: 3, color: '#7ba84a' },
  italia: { name: 'Italia',  bonus: 3, color: '#d96c4a' },
  balkan: { name: 'Balkan',  bonus: 3, color: '#4a78d9' },
  oriens: { name: 'Itämaat', bonus: 4, color: '#52b3a4' },
};

const base = {
  // --- Iberia ---
  lusitania:  { name: 'Lusitania',  gen: 'Lusitanian',  continent: 'iberia', x: 76, y: 350 },
  hispania:   { name: 'Hispania',   gen: 'Hispanian',   continent: 'iberia', x: 134, y: 335 },
  mauretania: { name: 'Mauretania', gen: 'Mauretanian', continent: 'iberia', x: 115, y: 460 },

  // --- Gallia ---
  britannia:  { name: 'Britannia',  gen: 'Britannian',  continent: 'gallia', x: 160, y: 182 },
  belgica:    { name: 'Belgica',    gen: 'Belgican',    continent: 'gallia', x: 243, y: 215 },
  gallia:     { name: 'Gallia',     gen: 'Gallian',     continent: 'gallia', x: 211, y: 276 },
  germania:   { name: 'Germania',   gen: 'Germanian',   continent: 'gallia', x: 301, y: 207 },

  // --- Italia ---
  italia:     { name: 'Italia',     gen: 'Italian',     continent: 'italia', x: 339, y: 343 },
  sisilia:    { name: 'Sisilia',    gen: 'Sisilian',    continent: 'italia', x: 376, y: 396 },
  karthago:   { name: 'Karthago',   gen: 'Karthagon',   continent: 'italia', x: 301, y: 397 },
  numidia:    { name: 'Numidia',    gen: 'Numidian',    continent: 'italia', x: 217, y: 419 },

  // --- Balkan ---
  dacia:      { name: 'Dacia',      gen: 'Dacian',      continent: 'balkan', x: 500, y: 284 },
  makedonia:  { name: 'Makedonia',  gen: 'Makedonian',  continent: 'balkan', x: 446, y: 334 },
  traakia:    { name: 'Traakia',    gen: 'Traakian',    continent: 'balkan', x: 519, y: 345 },
  kreikka:    { name: 'Kreikka',    gen: 'Kreikan',     continent: 'balkan', x: 474, y: 392 },

  // --- Itämaat ---
  anatolia:   { name: 'Anatolia',   gen: 'Anatolian',   continent: 'oriens', x: 596, y: 356 },
  syyria:     { name: 'Syyria',     gen: 'Syyrian',     continent: 'oriens', x: 660, y: 419 },
  persia:     { name: 'Persia',     gen: 'Persian',     continent: 'oriens', x: 820, y: 460 },
  arabia:     { name: 'Arabia',     gen: 'Arabian',     continent: 'oriens', x: 692, y: 538 },
  egypti:     { name: 'Egypti',     gen: 'Egyptin',     continent: 'oriens', x: 564, y: 525 },
};

const edges = [
  // Iberia
  ['lusitania', 'hispania'], ['hispania', 'mauretania'], ['hispania', 'gallia'],
  ['mauretania', 'numidia'],
  // Gallia
  ['britannia', 'belgica'], ['britannia', 'gallia'],
  ['belgica', 'gallia'], ['belgica', 'germania'],
  ['gallia', 'germania'], ['gallia', 'italia'],
  ['germania', 'dacia'],
  // Italia
  ['italia', 'sisilia'], ['italia', 'makedonia'], ['italia', 'karthago'],
  ['sisilia', 'karthago'],
  ['karthago', 'numidia'], ['karthago', 'egypti'],
  // Balkan
  ['dacia', 'makedonia'], ['dacia', 'traakia'],
  ['makedonia', 'traakia'], ['makedonia', 'kreikka'],
  ['traakia', 'anatolia'],
  ['kreikka', 'anatolia'],
  // Itämaat
  ['anatolia', 'syyria'],
  ['syyria', 'persia'], ['syyria', 'arabia'], ['syyria', 'egypti'],
  ['arabia', 'persia'], ['arabia', 'egypti'],
];

export const territories = fromEdges(base, edges);

// Maayhteydessä: Iberia–Gallia (Pyreneet) ja Gallia–Italia (Alpit) = yhtä
// mannerta. Muut (Iberia–Italia, Balkan–Italia Adrianmeri, Italia/Balkan–
// Itämaat, Balkan–Gallia) ovat Välimeren ylityksiä → jäävät auki.
export const landBridges = ['gallia|iberia', 'gallia|italia'];


// MANNERVYÖHYKKEET (geo-tila): antiikin Välimeren maailma. Pohjoinen
// barbaricum, Libyan autiomaa ja ikkunan reunat jäävät neutraaleiksi.
export const zones = {
  iberia: [[25,290],[150,320],[215,335],[190,380],[165,420],[165,520],[25,520]],
  gallia: [[25,101],[430,101],[430,240],[360,270],[330,285],[300,290],[270,310],[240,330],[215,335],[180,332],[150,320],[25,290]],
  italia: [[300,292],[340,288],[370,272],[400,300],[400,360],[380,400],[400,440],[380,490],[320,515],[165,520],[165,420],[190,380],[215,335],[240,330],[270,310]],
  balkan: [[430,220],[560,220],[560,240],[551,330],[540,360],[520,400],[470,435],[430,430],[400,360],[400,300],[370,272],[400,250],[430,240]],
  oriens: [[560,240],[600,300],[700,300],[800,290],[870,280],[945,290],[945,632],[510,632],[495,555],[485,480],[470,435],[520,400],[540,360],[551,330]],
};

export default { id: 'antiquity', name: 'Antiikin maailma', continents, territories, landBridges, geo: { land: LAND }, zones };
