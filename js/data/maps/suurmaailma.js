// Suuri maailma: laajennettu maapallo, 50 aluetta ja 8 mannerta.
// Enemmän jakoja, useita kapeikkoja ja muutama pitkä merireitti (katkoviiva
// piirtyy automaattisesti kun kahden pisteen etäisyys > 220). Naapuruudet
// johdetaan särmälistasta (symmetrisiä). ViewBox 1000 x 700, pelkkää dataa.

import { fromEdges } from './_util.js';

export const continents = {
  'pohjois-amerikka': { name: 'Pohjois-Amerikka', bonus: 6, color: '#e6b84a' },
  'etela-amerikka':   { name: 'Etelä-Amerikka',   bonus: 3, color: '#d96c4a' },
  'eurooppa':         { name: 'Eurooppa',         bonus: 5, color: '#4a78d9' },
  'pohjois-aasia':    { name: 'Pohjois-Aasia',    bonus: 5, color: '#52b3a4' },
  'ita-aasia':        { name: 'Itä-Aasia',        bonus: 4, color: '#5aa0c0' },
  'etela-aasia':      { name: 'Etelä-Aasia',      bonus: 5, color: '#c0a24a' },
  'afrikka':          { name: 'Afrikka',          bonus: 3, color: '#7ba84a' },
  'oseania':          { name: 'Oseania',          bonus: 3, color: '#b05ec0' },
};

const base = {
  // --- Pohjois-Amerikka ---
  alaska:              { name: 'Alaska',            gen: 'Alaskan',            continent: 'pohjois-amerikka', x: 80,  y: 90 },
  luoteisterritorio:   { name: 'Luoteisterritorio', gen: 'Luoteisterritorion', continent: 'pohjois-amerikka', x: 175, y: 75 },
  gronlanti:           { name: 'Grönlanti',         gen: 'Grönlannin',         continent: 'pohjois-amerikka', x: 300, y: 55 },
  alberta:             { name: 'Alberta',           gen: 'Albertan',           continent: 'pohjois-amerikka', x: 150, y: 165 },
  ontario:             { name: 'Ontario',           gen: 'Ontarion',           continent: 'pohjois-amerikka', x: 245, y: 155 },
  quebec:              { name: 'Quebec',            gen: 'Quebecin',           continent: 'pohjois-amerikka', x: 330, y: 140 },
  'lansi-usa':         { name: 'Länsi-USA',         gen: 'Länsi-USA:n',        continent: 'pohjois-amerikka', x: 150, y: 255 },
  'ita-usa':           { name: 'Itä-USA',           gen: 'Itä-USA:n',          continent: 'pohjois-amerikka', x: 260, y: 255 },
  'keski-amerikka':    { name: 'Keski-Amerikka',    gen: 'Keski-Amerikan',     continent: 'pohjois-amerikka', x: 185, y: 345 },

  // --- Etelä-Amerikka ---
  venezuela:  { name: 'Venezuela',  gen: 'Venezuelan',  continent: 'etela-amerikka', x: 255, y: 425 },
  kolumbia:   { name: 'Kolumbia',   gen: 'Kolumbian',   continent: 'etela-amerikka', x: 195, y: 485 },
  brasilia:   { name: 'Brasilia',   gen: 'Brasilian',   continent: 'etela-amerikka', x: 340, y: 505 },
  peru:       { name: 'Peru',       gen: 'Perun',       continent: 'etela-amerikka', x: 235, y: 565 },
  argentiina: { name: 'Argentiina', gen: 'Argentiinan', continent: 'etela-amerikka', x: 285, y: 645 },

  // --- Eurooppa ---
  islanti:          { name: 'Islanti',         gen: 'Islannin',        continent: 'eurooppa', x: 410, y: 90 },
  britannia:        { name: 'Britannia',       gen: 'Britannian',      continent: 'eurooppa', x: 410, y: 180 },
  skandinavia:      { name: 'Skandinavia',     gen: 'Skandinavian',    continent: 'eurooppa', x: 510, y: 85 },
  'keski-eurooppa': { name: 'Keski-Eurooppa',  gen: 'Keski-Euroopan',  continent: 'eurooppa', x: 505, y: 195 },
  'lansi-eurooppa': { name: 'Länsi-Eurooppa',  gen: 'Länsi-Euroopan',  continent: 'eurooppa', x: 420, y: 270 },
  'etela-eurooppa': { name: 'Etelä-Eurooppa',  gen: 'Etelä-Euroopan',  continent: 'eurooppa', x: 545, y: 275 },
  ukraina:          { name: 'Ukraina',         gen: 'Ukrainan',        continent: 'eurooppa', x: 615, y: 175 },

  // --- Pohjois-Aasia ---
  ural:            { name: 'Ural',           gen: 'Uralin',           continent: 'pohjois-aasia', x: 670, y: 150 },
  'lansi-siperia': { name: 'Länsi-Siperia',  gen: 'Länsi-Siperian',   continent: 'pohjois-aasia', x: 730, y: 90 },
  'keski-siperia': { name: 'Keski-Siperia',  gen: 'Keski-Siperian',   continent: 'pohjois-aasia', x: 810, y: 75 },
  jakutsk:         { name: 'Jakutsk',        gen: 'Jakutskin',        continent: 'pohjois-aasia', x: 885, y: 75 },
  irkutsk:         { name: 'Irkutsk',        gen: 'Irkutskin',        continent: 'pohjois-aasia', x: 835, y: 155 },
  kamtsatka:       { name: 'Kamtšatka',      gen: 'Kamtšatkan',       continent: 'pohjois-aasia', x: 950, y: 115 },

  // --- Itä-Aasia ---
  mongolia: { name: 'Mongolia', gen: 'Mongolian', continent: 'ita-aasia', x: 845, y: 235 },
  kiina:    { name: 'Kiina',    gen: 'Kiinan',    continent: 'ita-aasia', x: 795, y: 310 },
  korea:    { name: 'Korea',    gen: 'Korean',    continent: 'ita-aasia', x: 905, y: 290 },
  japani:   { name: 'Japani',   gen: 'Japanin',   continent: 'ita-aasia', x: 955, y: 215 },
  kaukoita: { name: 'Kaukoitä', gen: 'Kaukoidän', continent: 'ita-aasia', x: 925, y: 375 },

  // --- Etelä-Aasia ---
  'keski-aasia': { name: 'Keski-Aasia', gen: 'Keski-Aasian', continent: 'etela-aasia', x: 695, y: 225 },
  afganistan:    { name: 'Afganistan',  gen: 'Afganistanin', continent: 'etela-aasia', x: 690, y: 300 },
  'lahi-ita':    { name: 'Lähi-itä',    gen: 'Lähi-idän',    continent: 'etela-aasia', x: 620, y: 320 },
  arabia:        { name: 'Arabia',      gen: 'Arabian',      continent: 'etela-aasia', x: 610, y: 410 },
  intia:         { name: 'Intia',       gen: 'Intian',       continent: 'etela-aasia', x: 740, y: 365 },
  indokiina:     { name: 'Indokiina',   gen: 'Indokiinan',   continent: 'etela-aasia', x: 825, y: 425 },

  // --- Afrikka ---
  'pohjois-afrikka': { name: 'Pohjois-Afrikka', gen: 'Pohjois-Afrikan', continent: 'afrikka', x: 510, y: 360 },
  egypti:            { name: 'Egypti',          gen: 'Egyptin',         continent: 'afrikka', x: 575, y: 365 },
  sahel:             { name: 'Sahel',           gen: 'Sahelin',         continent: 'afrikka', x: 505, y: 445 },
  'ita-afrikka':     { name: 'Itä-Afrikka',     gen: 'Itä-Afrikan',     continent: 'afrikka', x: 615, y: 470 },
  kongo:             { name: 'Kongo',           gen: 'Kongon',          continent: 'afrikka', x: 540, y: 530 },
  'etela-afrikka':   { name: 'Etelä-Afrikka',   gen: 'Etelä-Afrikan',   continent: 'afrikka', x: 565, y: 615 },
  madagaskar:        { name: 'Madagaskar',      gen: 'Madagaskarin',    continent: 'afrikka', x: 665, y: 575 },

  // --- Oseania ---
  indonesia:         { name: 'Indonesia',       gen: 'Indonesian',       continent: 'oseania', x: 835, y: 480 },
  'uusi-guinea':     { name: 'Uusi-Guinea',     gen: 'Uuden-Guinean',    continent: 'oseania', x: 935, y: 475 },
  'lansi-australia': { name: 'Länsi-Australia', gen: 'Länsi-Australian', continent: 'oseania', x: 855, y: 580 },
  'ita-australia':   { name: 'Itä-Australia',   gen: 'Itä-Australian',   continent: 'oseania', x: 945, y: 600 },
  'uusi-seelanti':   { name: 'Uusi-Seelanti',   gen: 'Uuden-Seelannin',  continent: 'oseania', x: 900, y: 665 },
};

const edges = [
  // Pohjois-Amerikka
  ['alaska', 'luoteisterritorio'], ['alaska', 'alberta'],
  ['luoteisterritorio', 'alberta'], ['luoteisterritorio', 'ontario'], ['luoteisterritorio', 'gronlanti'],
  ['gronlanti', 'quebec'], ['gronlanti', 'ontario'],
  ['alberta', 'ontario'], ['alberta', 'lansi-usa'],
  ['ontario', 'quebec'], ['ontario', 'ita-usa'], ['ontario', 'lansi-usa'],
  ['quebec', 'ita-usa'],
  ['lansi-usa', 'ita-usa'], ['lansi-usa', 'keski-amerikka'], ['ita-usa', 'keski-amerikka'],
  // Pohjois-Amerikka -> muut
  ['keski-amerikka', 'venezuela'],
  ['gronlanti', 'islanti'],
  ['alaska', 'kamtsatka'], // pitkä merireitti (Beringinsalmi)

  // Etelä-Amerikka
  ['venezuela', 'kolumbia'], ['venezuela', 'brasilia'],
  ['kolumbia', 'brasilia'], ['kolumbia', 'peru'],
  ['brasilia', 'peru'], ['brasilia', 'argentiina'],
  ['peru', 'argentiina'],
  ['brasilia', 'pohjois-afrikka'], // pitkä merireitti (Atlantti)

  // Eurooppa
  ['islanti', 'britannia'], ['islanti', 'skandinavia'],
  ['britannia', 'skandinavia'], ['britannia', 'keski-eurooppa'], ['britannia', 'lansi-eurooppa'],
  ['skandinavia', 'keski-eurooppa'], ['skandinavia', 'ukraina'],
  ['keski-eurooppa', 'lansi-eurooppa'], ['keski-eurooppa', 'etela-eurooppa'], ['keski-eurooppa', 'ukraina'],
  ['lansi-eurooppa', 'etela-eurooppa'], ['etela-eurooppa', 'ukraina'],
  // Eurooppa -> Afrikka / Aasia
  ['lansi-eurooppa', 'pohjois-afrikka'], ['etela-eurooppa', 'pohjois-afrikka'], ['etela-eurooppa', 'egypti'],
  ['etela-eurooppa', 'lahi-ita'],
  ['ukraina', 'ural'], ['ukraina', 'keski-aasia'],

  // Pohjois-Aasia
  ['ural', 'lansi-siperia'],
  ['lansi-siperia', 'keski-siperia'], ['lansi-siperia', 'irkutsk'],
  ['keski-siperia', 'jakutsk'], ['keski-siperia', 'irkutsk'],
  ['jakutsk', 'irkutsk'], ['jakutsk', 'kamtsatka'], ['jakutsk', 'mongolia'],
  ['irkutsk', 'kamtsatka'], ['irkutsk', 'mongolia'],
  ['keski-siperia', 'mongolia'], ['kamtsatka', 'japani'],
  ['ural', 'keski-aasia'],

  // Itä-Aasia
  ['mongolia', 'kiina'], ['mongolia', 'korea'], ['mongolia', 'japani'],
  ['kiina', 'korea'], ['korea', 'japani'],
  ['korea', 'kaukoita'], ['kiina', 'kaukoita'],
  ['kiina', 'keski-aasia'], ['kiina', 'intia'], ['kiina', 'indokiina'],
  ['kaukoita', 'uusi-guinea'],

  // Etelä-Aasia
  ['keski-aasia', 'afganistan'],
  ['afganistan', 'lahi-ita'], ['afganistan', 'intia'],
  ['lahi-ita', 'arabia'],
  ['arabia', 'intia'], ['arabia', 'egypti'], ['arabia', 'ita-afrikka'],
  ['intia', 'indokiina'],
  ['indokiina', 'indonesia'],
  ['intia', 'madagaskar'], // pitkä merireitti (Intian valtameri)

  // Afrikka
  ['pohjois-afrikka', 'egypti'], ['pohjois-afrikka', 'sahel'],
  ['egypti', 'sahel'], ['egypti', 'ita-afrikka'],
  ['sahel', 'ita-afrikka'], ['sahel', 'kongo'],
  ['ita-afrikka', 'kongo'], ['ita-afrikka', 'etela-afrikka'], ['ita-afrikka', 'madagaskar'],
  ['kongo', 'etela-afrikka'],
  ['etela-afrikka', 'madagaskar'],

  // Oseania
  ['indonesia', 'uusi-guinea'], ['indonesia', 'lansi-australia'],
  ['uusi-guinea', 'lansi-australia'], ['uusi-guinea', 'ita-australia'],
  ['lansi-australia', 'ita-australia'], ['lansi-australia', 'uusi-seelanti'],
  ['ita-australia', 'uusi-seelanti'],
];

export const territories = fromEdges(base, edges);

// Maayhteydessä olevat mannerparit (yhtä maamassaa) → rannikot koskettavat.
// Euraasia (Eurooppa + Pohjois-/Itä-/Etelä-Aasia yhtenäisiä) + Afro-Aasia
// (Siinai) + Amerikat (Panama). Oseania & Atlantin/Välimeren ylitykset = meri.
export const landBridges = [
  'etela-amerikka|pohjois-amerikka',
  'eurooppa|pohjois-aasia',
  'etela-aasia|eurooppa',
  'etela-aasia|pohjois-aasia',
  'etela-aasia|ita-aasia',
  'ita-aasia|pohjois-aasia',
  'afrikka|etela-aasia',
];

export default { id: 'suurmaailma', name: 'Suuri maailma', continents, territories, landBridges };
