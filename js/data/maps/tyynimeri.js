// Tyynimeri-kartta: 33 aluetta, 9 mannerta — Kaakkois-Aasiasta Fidžille.
// Aito maantiede (Natural Earth 50m, Miller-ikkuna lon 93..181, lat -48..25
// → tools/geo.mjs). Saaristokartta: lähes kaikki mannerrajat ovat meriä,
// joten landBridges on tyhjä ja reittiviivat kantavat pelin.
// Naapuruudet johdetaan särmälistasta (symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/pacific-land.js';

export const continents = {
  indokiina:      { name: 'Indokiina',    bonus: 3, color: '#16a89a' },
  sunda:          { name: 'Sunda',        bonus: 2, color: '#7ba84a' },
  borneo:         { name: 'Borneo',       bonus: 1, color: '#e6b84a' },
  filippiinit:    { name: 'Filippiinit',  bonus: 2, color: '#b05ec0' },
  wallacea:       { name: 'Wallacea',     bonus: 2, color: '#d94f4f' },
  'uusi-guinea':  { name: 'Uusi-Guinea',  bonus: 2, color: '#8a8f4a' },
  melanesia:      { name: 'Melanesia',    bonus: 2, color: '#4a78d9' },
  australia:      { name: 'Australia',    bonus: 3, color: '#d96c4a' },
  tasmaninmeri:   { name: 'Tasmaninmeri', bonus: 2, color: '#6fb8d9' },
};

const base = {
  // --- Indokiina ---
  myanmar:  { name: 'Myanmar',  gen: 'Myanmarin',  continent: 'indokiina', x: 63, y: 78 },
  thaimaa:  { name: 'Thaimaa',  gen: 'Thaimaan',   continent: 'indokiina', x: 108, y: 111 },
  vietnam:  { name: 'Vietnam',  gen: 'Vietnamin',  continent: 'indokiina', x: 159, y: 62 },
  kambodza: { name: 'Kambodža', gen: 'Kambodžan',  continent: 'indokiina', x: 159, y: 137 },
  malakka:  { name: 'Malakka',  gen: 'Malakan',    continent: 'indokiina', x: 112, y: 186 },
  hainan:   { name: 'Hainan',   gen: 'Hainanin',   continent: 'indokiina', x: 205, y: 80 },

  // --- Sunda ---
  sumatra:     { name: 'Sumatra',     gen: 'Sumatran',     continent: 'sunda', x: 118, y: 250 },
  jaava:       { name: 'Jaava',       gen: 'Jaavan',       continent: 'sunda', x: 197, y: 301 },
  sundasaaret: { name: 'Sundasaaret', gen: 'Sundasaarten', continent: 'sunda', x: 310, y: 319 },

  // --- Borneo ---
  'pohjois-borneo': { name: 'Pohjois-Borneo', gen: 'Pohjois-Borneon', continent: 'borneo', x: 275, y: 191 },
  'etela-borneo':   { name: 'Etelä-Borneo',   gen: 'Etelä-Borneon',   continent: 'borneo', x: 257, y: 253 },

  // --- Filippiinit ---
  taiwan:   { name: 'Taiwan',   gen: 'Taiwanin',    continent: 'filippiinit', x: 327, y: 42 },
  luzon:    { name: 'Luzon',    gen: 'Luzonin',     continent: 'filippiinit', x: 328, y: 104 },
  visayat:  { name: 'Visayat',  gen: 'Visayoiden',  continent: 'filippiinit', x: 340, y: 182 },
  mindanao: { name: 'Mindanao', gen: 'Mindanaon',   continent: 'filippiinit', x: 385, y: 173 },

  // --- Wallacea ---
  sulawesi: { name: 'Sulawesi', gen: 'Sulawesin',  continent: 'wallacea', x: 319, y: 254 },
  molukit:  { name: 'Molukit',  gen: 'Molukkien',  continent: 'wallacea', x: 399, y: 236 },
  timor:    { name: 'Timor',    gen: 'Timorin',    continent: 'wallacea', x: 377, y: 315 },

  // --- Uusi-Guinea ---
  'lansi-papua': { name: 'Länsi-Papua', gen: 'Länsi-Papuan', continent: 'uusi-guinea', x: 460, y: 272 },
  'ita-papua':   { name: 'Itä-Papua',   gen: 'Itä-Papuan',   continent: 'uusi-guinea', x: 581, y: 294 },

  // --- Melanesia ---
  salomonsaaret:    { name: 'Salomonsaaret',  gen: 'Salomonsaarten',   continent: 'melanesia', x: 749, y: 320 },
  vanuatu:          { name: 'Vanuatu',        gen: 'Vanuatun',         continent: 'melanesia', x: 820, y: 364 },
  'uusi-kaledonia': { name: 'Uusi-Kaledonia', gen: 'Uuden-Kaledonian', continent: 'melanesia', x: 817, y: 425 },
  fidzi:            { name: 'Fidži',          gen: 'Fidžin',           continent: 'melanesia', x: 943, y: 389 },

  // --- Australia ---
  'pohjois-australia': { name: 'Pohjois-Australia', gen: 'Pohjois-Australian', continent: 'australia', x: 457, y: 399 },
  'lansi-australia':   { name: 'Länsi-Australia',   gen: 'Länsi-Australian',   continent: 'australia', x: 295, y: 456 },
  'etela-australia':   { name: 'Etelä-Australia',   gen: 'Etelä-Australian',   continent: 'australia', x: 478, y: 491 },
  queensland:          { name: 'Queensland',        gen: 'Queenslandin',       continent: 'australia', x: 581, y: 421 },
  'uusi-etela-wales':  { name: 'Uusi Etelä-Wales',  gen: 'Uuden Etelä-Walesin', continent: 'australia', x: 600, y: 505 },
  victoria:            { name: 'Victoria',          gen: 'Victorian',          continent: 'australia', x: 559, y: 568 },

  // --- Tasmaninmeri ---
  tasmania:     { name: 'Tasmania',     gen: 'Tasmanian',     continent: 'tasmaninmeri', x: 606, y: 610 },
  pohjoissaari: { name: 'Pohjoissaari', gen: 'Pohjoissaaren', continent: 'tasmaninmeri', x: 918, y: 581 },
  etelasaari:   { name: 'Eteläsaari',   gen: 'Eteläsaaren',   continent: 'tasmaninmeri', x: 859, y: 624 },
};

const edges = [
  // Indokiina (manner)
  ['myanmar', 'thaimaa'], ['thaimaa', 'vietnam'], ['thaimaa', 'kambodza'],
  ['kambodza', 'vietnam'], ['vietnam', 'hainan'], ['thaimaa', 'malakka'],
  // Indokiinasta merelle
  ['hainan', 'taiwan'], ['malakka', 'sumatra'], ['malakka', 'pohjois-borneo'],
  // Sunda
  ['sumatra', 'jaava'], ['jaava', 'sundasaaret'], ['jaava', 'etela-borneo'],
  ['sundasaaret', 'sulawesi'], ['sundasaaret', 'timor'],
  // Borneo
  ['pohjois-borneo', 'etela-borneo'], ['pohjois-borneo', 'visayat'],
  ['etela-borneo', 'sulawesi'],
  // Filippiinit
  ['taiwan', 'luzon'], ['luzon', 'visayat'], ['visayat', 'mindanao'],
  ['mindanao', 'sulawesi'], ['mindanao', 'molukit'],
  // Wallacea
  ['sulawesi', 'molukit'], ['sulawesi', 'timor'], ['molukit', 'lansi-papua'],
  ['timor', 'pohjois-australia'],
  // Uusi-Guinea
  ['lansi-papua', 'ita-papua'], ['ita-papua', 'salomonsaaret'], ['ita-papua', 'queensland'],
  // Melanesia
  ['salomonsaaret', 'vanuatu'], ['vanuatu', 'uusi-kaledonia'], ['vanuatu', 'fidzi'],
  ['uusi-kaledonia', 'queensland'], ['fidzi', 'pohjoissaari'],
  // Australia
  ['pohjois-australia', 'lansi-australia'], ['pohjois-australia', 'etela-australia'],
  ['pohjois-australia', 'queensland'], ['lansi-australia', 'etela-australia'],
  ['etela-australia', 'queensland'], ['etela-australia', 'uusi-etela-wales'],
  ['etela-australia', 'victoria'], ['queensland', 'uusi-etela-wales'],
  ['uusi-etela-wales', 'victoria'],
  // Tasmaninmeri
  ['victoria', 'tasmania'], ['tasmania', 'etelasaari'], ['etelasaari', 'pohjoissaari'],
];

export const territories = fromEdges(base, edges);

// Saaristomaailma: yksikään mannerpari ei ole maayhteydessä — kaikki
// mannertenväliset rajat ovat meriylityksiä (reittiviivat).
export const landBridges = [];

// MANNERVYÖHYKKEET (geo-tila): rajat kulkevat salmissa ja merillä —
// Malakansalmi, Karimata, Makassar, Luzoninsalmi, Ombai, Torresinsalmi,
// Bassinsalmi, Tasmaninmeri. Etelä-Kiina jää neutraaliksi.
export const zones = {
  indokiina: [[25,30],[78,30],[100,45],[125,52],[150,48],[170,58],[192,66],[203,63],[214,72],[224,88],[228,105],[225,135],[208,162],[192,185],[178,200],[166,218],[152,242],[120,228],[95,212],[60,192],[25,176]],
  sunda: [[25,176],[60,192],[95,212],[120,228],[152,242],[160,252],[197,262],[230,290],[268,296],[352,296],[352,340],[25,340]],
  borneo: [[176,200],[192,180],[290,182],[297,215],[297,245],[285,266],[268,290],[230,290],[197,262],[176,235]],
  filippiinit: [[312,30],[365,30],[385,80],[398,130],[402,198],[330,198],[322,186],[300,190],[268,178],[268,168],[284,152],[300,132],[308,118],[308,55]],
  wallacea: [[300,202],[415,202],[415,246],[437,252],[437,278],[420,296],[400,302],[392,330],[376,344],[352,348],[352,304],[306,304],[288,282],[285,266],[297,245],[297,215]],
  'uusi-guinea': [[438,218],[680,218],[684,308],[636,330],[560,324],[500,318],[452,300],[438,286]],
  melanesia: [[686,218],[975,218],[975,460],[700,460],[686,320]],
  australia: [[230,352],[340,345],[400,340],[418,330],[540,325],[600,327],[640,331],[688,333],[700,420],[688,475],[655,540],[625,575],[600,582],[230,582]],
  tasmaninmeri: [[560,588],[648,588],[678,638],[700,656],[820,656],[825,502],[975,502],[975,670],[560,670]],
};

export default {
  id: 'tyynimeri', name: 'Tyynimeri', continents, territories, landBridges,
  geo: { land: LAND }, zones,
};
