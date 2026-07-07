// Antiikin maailma -kartta: 20 aluetta, 5 mannerta (Välimeren ympäristö).
// Naapuruudet johdetaan särmälistasta (taatusti symmetrisiä).

import { fromEdges } from './_util.js';

export const continents = {
  iberia: { name: 'Iberia',  bonus: 2, color: '#e6b84a' },
  gallia: { name: 'Gallia',  bonus: 3, color: '#7ba84a' },
  italia: { name: 'Italia',  bonus: 3, color: '#d96c4a' },
  balkan: { name: 'Balkan',  bonus: 3, color: '#4a78d9' },
  oriens: { name: 'Itämaat', bonus: 4, color: '#52b3a4' },
};

const base = {
  // --- Iberia ---
  lusitania:  { name: 'Lusitania',  gen: 'Lusitanian',  continent: 'iberia', x: 95,  y: 380 },
  hispania:   { name: 'Hispania',   gen: 'Hispanian',   continent: 'iberia', x: 180, y: 355 },
  mauretania: { name: 'Mauretania', gen: 'Mauretanian', continent: 'iberia', x: 130, y: 520 },

  // --- Gallia ---
  britannia:  { name: 'Britannia',  gen: 'Britannian',  continent: 'gallia', x: 215, y: 110 },
  belgica:    { name: 'Belgica',    gen: 'Belgican',    continent: 'gallia', x: 320, y: 175 },
  gallia:     { name: 'Gallia',     gen: 'Gallian',     continent: 'gallia', x: 265, y: 275 },
  germania:   { name: 'Germania',   gen: 'Germanian',   continent: 'gallia', x: 410, y: 150 },

  // --- Italia ---
  italia:     { name: 'Italia',     gen: 'Italian',     continent: 'italia', x: 440, y: 330 },
  sisilia:    { name: 'Sisilia',    gen: 'Sisilian',    continent: 'italia', x: 460, y: 455 },
  karthago:   { name: 'Karthago',   gen: 'Karthagon',   continent: 'italia', x: 360, y: 525 },
  numidia:    { name: 'Numidia',    gen: 'Numidian',    continent: 'italia', x: 270, y: 575 },

  // --- Balkan ---
  dacia:      { name: 'Dacia',      gen: 'Dacian',      continent: 'balkan', x: 580, y: 190 },
  makedonia:  { name: 'Makedonia',  gen: 'Makedonian',  continent: 'balkan', x: 575, y: 305 },
  traakia:    { name: 'Traakia',    gen: 'Traakian',    continent: 'balkan', x: 660, y: 250 },
  kreikka:    { name: 'Kreikka',    gen: 'Kreikan',     continent: 'balkan', x: 610, y: 405 },

  // --- Itämaat ---
  anatolia:   { name: 'Anatolia',   gen: 'Anatolian',   continent: 'oriens', x: 765, y: 300 },
  syyria:     { name: 'Syyria',     gen: 'Syyrian',     continent: 'oriens', x: 850, y: 390 },
  persia:     { name: 'Persia',     gen: 'Persian',     continent: 'oriens', x: 935, y: 330 },
  arabia:     { name: 'Arabia',     gen: 'Arabian',     continent: 'oriens', x: 870, y: 520 },
  egypti:     { name: 'Egypti',     gen: 'Egyptin',     continent: 'oriens', x: 720, y: 530 },
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

export default { id: 'antiquity', name: 'Antiikin maailma', continents, territories, landBridges };
