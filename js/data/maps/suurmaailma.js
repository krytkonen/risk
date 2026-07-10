// Suuri maailma: laajennettu maapallo, 50 aluetta ja 8 mannerta.
// Enemmän jakoja, useita kapeikkoja ja muutama pitkä merireitti (katkoviiva
// piirtyy automaattisesti kun kahden pisteen etäisyys > 220). Naapuruudet
// johdetaan särmälistasta (symmetrisiä). ViewBox 1000 x 700, pelkkää dataa.

import { fromEdges } from './_util.js';
import { LAND } from '../geo/world-land.js';

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
  alaska:              { name: 'Alaska',            gen: 'Alaskan',            continent: 'pohjois-amerikka', x: 67, y: 179 },
  luoteisterritorio:   { name: 'Luoteisterritorio', gen: 'Luoteisterritorion', continent: 'pohjois-amerikka', x: 166, y: 173 },
  gronlanti:           { name: 'Grönlanti',         gen: 'Grönlannin',         continent: 'pohjois-amerikka', x: 359, y: 130 },
  alberta:             { name: 'Alberta',           gen: 'Albertan',           continent: 'pohjois-amerikka', x: 166, y: 231 },
  ontario:             { name: 'Ontario',           gen: 'Ontarion',           continent: 'pohjois-amerikka', x: 237, y: 246 },
  quebec:              { name: 'Quebec',            gen: 'Quebecin',           continent: 'pohjois-amerikka', x: 282, y: 246 },
  'lansi-usa':         { name: 'Länsi-USA',         gen: 'Länsi-USA:n',        continent: 'pohjois-amerikka', x: 168, y: 299 },
  'ita-usa':           { name: 'Itä-USA',           gen: 'Itä-USA:n',          continent: 'pohjois-amerikka', x: 248, y: 311 },
  'keski-amerikka':    { name: 'Keski-Amerikka',    gen: 'Keski-Amerikan',     continent: 'pohjois-amerikka', x: 211, y: 373 },

  // --- Etelä-Amerikka ---
  venezuela:  { name: 'Venezuela',  gen: 'Venezuelan',  continent: 'etela-amerikka', x: 300, y: 412 },
  kolumbia:   { name: 'Kolumbia',   gen: 'Kolumbian',   continent: 'etela-amerikka', x: 247, y: 452 },
  brasilia:   { name: 'Brasilia',   gen: 'Brasilian',   continent: 'etela-amerikka', x: 333, y: 480 },
  peru:       { name: 'Peru',       gen: 'Perun',       continent: 'etela-amerikka', x: 288, y: 512 },
  argentiina: { name: 'Argentiina', gen: 'Argentiinan', continent: 'etela-amerikka', x: 298, y: 579 },

  // --- Eurooppa ---
  islanti:          { name: 'Islanti',         gen: 'Islannin',        continent: 'eurooppa', x: 416, y: 166 },
  britannia:        { name: 'Britannia',       gen: 'Britannian',      continent: 'eurooppa', x: 450, y: 222 },
  skandinavia:      { name: 'Skandinavia',     gen: 'Skandinavian',    continent: 'eurooppa', x: 511, y: 185 },
  'keski-eurooppa': { name: 'Keski-Eurooppa',  gen: 'Keski-Euroopan',  continent: 'eurooppa', x: 505, y: 250 },
  'lansi-eurooppa': { name: 'Länsi-Eurooppa',  gen: 'Länsi-Euroopan',  continent: 'eurooppa', x: 441, y: 299 },
  'etela-eurooppa': { name: 'Etelä-Eurooppa',  gen: 'Etelä-Euroopan',  continent: 'eurooppa', x: 521, y: 315 },
  ukraina:          { name: 'Ukraina',         gen: 'Ukrainan',        continent: 'eurooppa', x: 568, y: 244 },

  // --- Pohjois-Aasia ---
  ural:            { name: 'Ural',           gen: 'Uralin',           continent: 'pohjois-aasia', x: 630, y: 201 },
  'lansi-siperia': { name: 'Länsi-Siperia',  gen: 'Länsi-Siperian',   continent: 'pohjois-aasia', x: 678, y: 190 },
  'keski-siperia': { name: 'Keski-Siperia',  gen: 'Keski-Siperian',   continent: 'pohjois-aasia', x: 736, y: 167 },
  jakutsk:         { name: 'Jakutsk',        gen: 'Jakutskin',        continent: 'pohjois-aasia', x: 810, y: 167 },
  irkutsk:         { name: 'Irkutsk',        gen: 'Irkutskin',        continent: 'pohjois-aasia', x: 749, y: 231 },
  kamtsatka:       { name: 'Kamtšatka',      gen: 'Kamtšatkan',       continent: 'pohjois-aasia', x: 895, y: 211 },

  // --- Itä-Aasia ---
  mongolia: { name: 'Mongolia', gen: 'Mongolian', continent: 'ita-aasia', x: 742, y: 275 },
  kiina:    { name: 'Kiina',    gen: 'Kiinan',    continent: 'ita-aasia', x: 758, y: 338 },
  korea:    { name: 'Korea',    gen: 'Korean',    continent: 'ita-aasia', x: 800, y: 326 },
  japani:   { name: 'Japani',   gen: 'Japanin',   continent: 'ita-aasia', x: 862, y: 324 },
  kaukoita: { name: 'Kaukoitä', gen: 'Kaukoidän', continent: 'ita-aasia', x: 826, y: 260 },

  // --- Etelä-Aasia ---
  'keski-aasia': { name: 'Keski-Aasia', gen: 'Keski-Aasian', continent: 'etela-aasia', x: 643, y: 273 },
  afganistan:    { name: 'Afganistan',  gen: 'Afganistanin', continent: 'etela-aasia', x: 654, y: 336 },
  'lahi-ita':    { name: 'Lähi-itä',    gen: 'Lähi-idän',    continent: 'etela-aasia', x: 582, y: 323 },
  arabia:        { name: 'Arabia',      gen: 'Arabian',      continent: 'etela-aasia', x: 604, y: 386 },
  intia:         { name: 'Intia',       gen: 'Intian',       continent: 'etela-aasia', x: 680, y: 402 },
  indokiina:     { name: 'Indokiina',   gen: 'Indokiinan',   continent: 'etela-aasia', x: 742, y: 400 },

  // --- Afrikka ---
  'pohjois-afrikka': { name: 'Pohjois-Afrikka', gen: 'Pohjois-Afrikan', continent: 'afrikka', x: 480, y: 364 },
  egypti:            { name: 'Egypti',          gen: 'Egyptin',         continent: 'afrikka', x: 546, y: 350 },
  sahel:             { name: 'Sahel',           gen: 'Sahelin',         continent: 'afrikka', x: 497, y: 428 },
  'ita-afrikka':     { name: 'Itä-Afrikka',     gen: 'Itä-Afrikan',     continent: 'afrikka', x: 572, y: 450 },
  kongo:             { name: 'Kongo',           gen: 'Kongon',          continent: 'afrikka', x: 529, y: 455 },
  'etela-afrikka':   { name: 'Etelä-Afrikka',   gen: 'Etelä-Afrikan',   continent: 'afrikka', x: 534, y: 551 },
  madagaskar:        { name: 'Madagaskar',      gen: 'Madagaskarin',    continent: 'afrikka', x: 596, y: 513 },

  // --- Oseania ---
  indonesia:         { name: 'Indonesia',       gen: 'Indonesian',       continent: 'oseania', x: 784, y: 464 },
  'uusi-guinea':     { name: 'Uusi-Guinea',     gen: 'Uuden-Guinean',    continent: 'oseania', x: 850, y: 466 },
  'lansi-australia': { name: 'Länsi-Australia', gen: 'Länsi-Australian', continent: 'oseania', x: 795, y: 539 },
  'ita-australia':   { name: 'Itä-Australia',   gen: 'Itä-Australian',   continent: 'oseania', x: 858, y: 547 },
  'uusi-seelanti':   { name: 'Uusi-Seelanti',   gen: 'Uuden-Seelannin',  continent: 'oseania', x: 927, y: 599 },
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


// MANNERVYÖHYKKEET (geo-tila): manner = vyöhyke ∩ aito maamassa. Tarkkoja vain
// maaylityksissä (Panama, Ural, Suez, Malakka, Aasian sisäjaot).
export const zones = {
  'pohjois-amerikka': [[15,22],[398,22],[398,150],[365,205],[330,290],[318,360],[285,398],[262,404],[240,428],[150,430],[15,430]],
  'etela-amerikka': [[240,428],[262,404],[285,398],[345,400],[395,470],[395,665],[200,665],[200,470],[228,440]],
  eurooppa: [[398,22],[622,22],[622,248],[614,258],[602,270],[578,280],[560,290],[545,292],[531,309],[524,316],[455,318],[430,300],[405,262],[398,200]],
  'pohjois-aasia': [[622,22],[985,22],[985,246],[672,246],[622,248]],
  'ita-aasia': [[672,246],[985,246],[985,358],[690,358],[690,252],[672,252]],
  'etela-aasia': [[622,248],[672,252],[690,252],[690,358],[985,358],[985,372],[780,372],[766,398],[756,420],[748,445],[737,432],[733,415],[722,410],[710,438],[694,446],[672,446],[655,414],[632,396],[618,391],[600,391],[587,392],[558,332],[548,318],[531,309],[545,292],[560,290],[578,280],[602,270],[614,258]],
  afrikka: [[455,318],[524,316],[531,309],[548,318],[558,332],[587,394],[600,393],[618,393],[634,398],[652,420],[675,470],[675,665],[400,665],[400,400],[428,332]],
  oseania: [[694,446],[710,438],[722,410],[733,415],[737,432],[748,445],[756,420],[766,398],[780,372],[985,372],[985,690],[694,690]],
};

export default { id: 'suurmaailma', name: 'Suuri maailma', continents, territories, landBridges, geo: { land: LAND }, zones };
