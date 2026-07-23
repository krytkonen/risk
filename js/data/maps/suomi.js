// Suomi-kartta: 53 aluetta, 9 suuraluetta — pelin suurin kartta.
// Aito maantiede (Natural Earth 50m, Miller-ikkuna lon 19..32, lat 59.5..70.2
// → tools/geo.mjs; vaakasuunnan 2× venytys täyttää kankaan). Solmut aidoilla
// projisoiduilla kaupunkisijainneilla. Ruotsi/Norja/Venäjä jäävät pelin
// ulkopuolisena neutraalina maana.
//
// NAAPURUUS johdetaan renderöidystä geometriasta (tools/adjacency.mjs): peli-
// naapuruus = ne alueet joiden VYÖHYKE-VORONOI-solut todella koskettavat maalla
// → jokainen näkyvästi vierekkäinen maakunta on hyökättävissä eikä yhtään
// "näennäistä" naapuria jää yhdistämättä. landAdjacency:true → maa-naapuruus
// näkyy koskettavista soluista (ei viivaa) ja vain seaRoutes saa reittiviivan.

import { fromEdges } from './_util.js';
import { LAND } from '../geo/finland-land.js';

export const continents = {
  lappi:         { name: 'Lappi',         bonus: 5, color: '#6fb8d9' },
  pohjanmaa:     { name: 'Pohjanmaa',     bonus: 4, color: '#e6b84a' },
  kainuu:        { name: 'Kainuu',        bonus: 2, color: '#b05ec0' },
  'keski-suomi': { name: 'Keski-Suomi',   bonus: 2, color: '#7ba84a' },
  savo:          { name: 'Savo',          bonus: 3, color: '#16a89a' },
  karjala:       { name: 'Karjala',       bonus: 3, color: '#d94f4f' },
  'lansi-suomi': { name: 'Länsi-Suomi',   bonus: 3, color: '#d96c4a' },
  'lounais-suomi': { name: 'Lounais-Suomi', bonus: 3, color: '#4a78d9' },
  uusimaa:       { name: 'Uusimaa',       bonus: 3, color: '#d977a3' },
};

const base = {
  // --- Lappi ---
  kasivarsi:  { name: 'Käsivarsi',  gen: 'Käsivarren',  continent: 'lappi', x: 360, y: 109 },
  utsjoki:    { name: 'Utsjoki',    gen: 'Utsjoen',     continent: 'lappi', x: 611, y: 41 },
  inari:      { name: 'Inari',      gen: 'Inarin',      continent: 'lappi', x: 648, y: 129 },
  sodankyla:  { name: 'Sodankylä',  gen: 'Sodankylän',  continent: 'lappi', x: 581, y: 207 },
  kittila:    { name: 'Kittilä',    gen: 'Kittilän',    continent: 'lappi', x: 456, y: 192 },
  rovaniemi:  { name: 'Rovaniemi',  gen: 'Rovaniemen',  continent: 'lappi', x: 516, y: 267 },
  kemijarvi:  { name: 'Kemijärvi',  gen: 'Kemijärven',  continent: 'lappi', x: 640, y: 252 },
  merilappi:  { name: 'Meri-Lappi', gen: 'Meri-Lapin',  continent: 'lappi', x: 434, y: 314 },

  // --- Pohjanmaa (länsirannikko + Oulu) ---
  oulu:        { name: 'Oulu',        gen: 'Oulun',        continent: 'pohjanmaa', x: 498, y: 361 },
  raahe:       { name: 'Raahe',       gen: 'Raahen',       continent: 'pohjanmaa', x: 384, y: 409 },
  ylivieska:   { name: 'Ylivieska',   gen: 'Ylivieskan',   continent: 'pohjanmaa', x: 430, y: 419 },
  kokkola:     { name: 'Kokkola',     gen: 'Kokkolan',     continent: 'pohjanmaa', x: 355, y: 473 },
  pietarsaari: { name: 'Pietarsaari', gen: 'Pietarsaaren', continent: 'pohjanmaa', x: 294, y: 446 },
  vaasa:       { name: 'Vaasa',       gen: 'Vaasan',       continent: 'pohjanmaa', x: 216, y: 478 },
  seinajoki:   { name: 'Seinäjoki',   gen: 'Seinäjoen',    continent: 'pohjanmaa', x: 311, y: 510 },
  kauhajoki:   { name: 'Kauhajoki',   gen: 'Kauhajoen',    continent: 'pohjanmaa', x: 255, y: 511 },

  // --- Kainuu (koillinen) ---
  kuusamo:     { name: 'Kuusamo',     gen: 'Kuusamon',     continent: 'kainuu', x: 772, y: 301 },
  pudasjarvi:  { name: 'Pudasjärvi',  gen: 'Pudasjärven',  continent: 'kainuu', x: 610, y: 339 },
  suomussalmi: { name: 'Suomussalmi', gen: 'Suomussalmen', continent: 'kainuu', x: 741, y: 369 },
  kajaani:     { name: 'Kajaani',     gen: 'Kajaanin',     continent: 'kainuu', x: 665, y: 407 },
  kuhmo:       { name: 'Kuhmo',       gen: 'Kuhmon',       continent: 'kainuu', x: 797, y: 416 },

  // --- Keski-Suomi ---
  aanekoski: { name: 'Äänekoski', gen: 'Äänekosken', continent: 'keski-suomi', x: 517, y: 491 },
  jyvaskyla: { name: 'Jyväskylä', gen: 'Jyväskylän', continent: 'keski-suomi', x: 566, y: 538 },
  jamsa:     { name: 'Jämsä',     gen: 'Jämsän',     continent: 'keski-suomi', x: 477, y: 553 },

  // --- Savo ---
  iisalmi:    { name: 'Iisalmi',    gen: 'Iisalmen',    continent: 'savo', x: 621, y: 447 },
  kuopio:     { name: 'Kuopio',     gen: 'Kuopion',     continent: 'savo', x: 669, y: 469 },
  varkaus:    { name: 'Varkaus',    gen: 'Varkauden',   continent: 'savo', x: 680, y: 531 },
  mikkeli:    { name: 'Mikkeli',    gen: 'Mikkelin',    continent: 'savo', x: 631, y: 563 },
  savonlinna: { name: 'Savonlinna', gen: 'Savonlinnan', continent: 'savo', x: 746, y: 529 },

  // --- Karjala ---
  nurmes:       { name: 'Nurmes',       gen: 'Nurmeksen',      continent: 'karjala', x: 742, y: 451 },
  joensuu:      { name: 'Joensuu',      gen: 'Joensuun',       continent: 'karjala', x: 798, y: 513 },
  kitee:        { name: 'Kitee',        gen: 'Kiteen',         continent: 'karjala', x: 842, y: 538 },
  lappeenranta: { name: 'Lappeenranta', gen: 'Lappeenrannan',  continent: 'karjala', x: 696, y: 605 },
  imatra:       { name: 'Imatra',       gen: 'Imatran',        continent: 'karjala', x: 741, y: 592 },

  // --- Länsi-Suomi (Pirkanmaa + Satakunta) ---
  mantta:     { name: 'Mänttä',    gen: 'Mäntän',     continent: 'lansi-suomi', x: 430, y: 540 },
  tampere:    { name: 'Tampere',   gen: 'Tampereen',  continent: 'lansi-suomi', x: 368, y: 557 },
  sastamala:  { name: 'Sastamala', gen: 'Sastamalan', continent: 'lansi-suomi', x: 307, y: 576 },
  kankaanpaa: { name: 'Kankaanpää', gen: 'Kankaanpään', continent: 'lansi-suomi', x: 204, y: 540 },
  pori:       { name: 'Pori',      gen: 'Porin',      continent: 'lansi-suomi', x: 256, y: 575 },
  rauma:      { name: 'Rauma',     gen: 'Rauman',     continent: 'lansi-suomi', x: 222, y: 606 },

  // --- Lounais-Suomi (Varsinais-Suomi + Häme) ---
  uusikaupunki: { name: 'Uusikaupunki', gen: 'Uudenkaupungin', continent: 'lounais-suomi', x: 185, y: 627 },
  turku:        { name: 'Turku',        gen: 'Turun',          continent: 'lounais-suomi', x: 260, y: 638 },
  salo:         { name: 'Salo',         gen: 'Salon',          continent: 'lounais-suomi', x: 320, y: 642 },
  forssa:       { name: 'Forssa',       gen: 'Forssan',        continent: 'lounais-suomi', x: 361, y: 620 },
  hameenlinna:  { name: 'Hämeenlinna',  gen: 'Hämeenlinnan',   continent: 'lounais-suomi', x: 412, y: 601 },
  lahti:        { name: 'Lahti',        gen: 'Lahden',         continent: 'lounais-suomi', x: 516, y: 588 },
  maarianhamina: { name: 'Maarianhamina', gen: 'Maarianhaminan', continent: 'lounais-suomi', x: 89, y: 656 },

  // --- Uusimaa (+ Kymenlaakso) ---
  lohja:    { name: 'Lohja',    gen: 'Lohjan',    continent: 'uusimaa', x: 388, y: 659 },
  hyvinkaa: { name: 'Hyvinkää', gen: 'Hyvinkään', continent: 'uusimaa', x: 470, y: 622 },
  helsinki: { name: 'Helsinki', gen: 'Helsingin', continent: 'uusimaa', x: 433, y: 652 },
  porvoo:   { name: 'Porvoo',   gen: 'Porvoon',   continent: 'uusimaa', x: 518, y: 645 },
  kouvola:  { name: 'Kouvola',  gen: 'Kouvolan',  continent: 'uusimaa', x: 562, y: 606 },
  kotka:    { name: 'Kotka',    gen: 'Kotkan',    continent: 'uusimaa', x: 606, y: 629 },
};

const edges = [
  // JOHDETTU renderöidystä geometriasta (tools/adjacency.mjs): jokainen
  // näkyvästi koskettava alue on hyökättävissä. + kaksi merireittiä.
  ['aanekoski', 'iisalmi'], ['aanekoski', 'jamsa'], ['aanekoski', 'jyvaskyla'],
  ['aanekoski', 'ylivieska'], ['forssa', 'hameenlinna'], ['forssa', 'lohja'],
  ['forssa', 'salo'], ['forssa', 'sastamala'], ['forssa', 'tampere'],
  ['hameenlinna', 'helsinki'], ['hameenlinna', 'hyvinkaa'], ['hameenlinna', 'lahti'],
  ['hameenlinna', 'lohja'], ['hameenlinna', 'mantta'], ['hameenlinna', 'tampere'],
  ['helsinki', 'hyvinkaa'], ['helsinki', 'lohja'], ['hyvinkaa', 'lahti'],
  ['hyvinkaa', 'porvoo'], ['iisalmi', 'jyvaskyla'], ['iisalmi', 'kajaani'],
  ['iisalmi', 'kuopio'], ['iisalmi', 'mikkeli'], ['imatra', 'joensuu'], ['imatra', 'kitee'],
  ['imatra', 'lappeenranta'], ['imatra', 'savonlinna'], ['inari', 'kemijarvi'],
  ['inari', 'sodankyla'], ['inari', 'utsjoki'], ['jamsa', 'jyvaskyla'], ['joensuu', 'kitee'],
  ['joensuu', 'kuhmo'], ['joensuu', 'nurmes'], ['joensuu', 'savonlinna'], ['kajaani', 'kuopio'],
  ['kajaani', 'nurmes'], ['kajaani', 'pudasjarvi'], ['kajaani', 'suomussalmi'],
  ['kankaanpaa', 'pori'], ['kankaanpaa', 'rauma'], ['kasivarsi', 'kittila'],
  ['kasivarsi', 'merilappi'], ['kasivarsi', 'utsjoki'], ['kauhajoki', 'pietarsaari'],
  ['kauhajoki', 'pori'], ['kauhajoki', 'seinajoki'], ['kauhajoki', 'vaasa'],
  ['kemijarvi', 'kuusamo'], ['kemijarvi', 'pudasjarvi'], ['kemijarvi', 'rovaniemi'],
  ['kemijarvi', 'sodankyla'], ['kitee', 'kuhmo'], ['kittila', 'merilappi'],
  ['kittila', 'rovaniemi'], ['kittila', 'sodankyla'], ['kittila', 'utsjoki'],
  ['kokkola', 'pietarsaari'], ['kokkola', 'raahe'], ['kokkola', 'seinajoki'],
  ['kokkola', 'ylivieska'], ['kotka', 'kouvola'], ['kotka', 'porvoo'], ['kouvola', 'lahti'],
  ['kouvola', 'porvoo'], ['kuhmo', 'kuusamo'], ['kuhmo', 'nurmes'], ['kuhmo', 'suomussalmi'],
  ['kuopio', 'mikkeli'], ['kuopio', 'nurmes'], ['kuopio', 'savonlinna'], ['kuopio', 'varkaus'],
  ['kuusamo', 'pudasjarvi'], ['kuusamo', 'suomussalmi'], ['lahti', 'porvoo'],
  ['lappeenranta', 'varkaus'], ['maarianhamina', 'turku'], ['mantta', 'tampere'],
  ['merilappi', 'oulu'], ['merilappi', 'rovaniemi'], ['merilappi', 'vaasa'],
  ['mikkeli', 'varkaus'], ['nurmes', 'savonlinna'], ['nurmes', 'suomussalmi'],
  ['oulu', 'pudasjarvi'], ['oulu', 'rovaniemi'], ['oulu', 'ylivieska'],
  ['pietarsaari', 'seinajoki'], ['pori', 'rauma'], ['pori', 'sastamala'], ['pori', 'turku'],
  ['pudasjarvi', 'rovaniemi'], ['pudasjarvi', 'suomussalmi'], ['raahe', 'ylivieska'],
  ['rauma', 'turku'], ['rauma', 'uusikaupunki'], ['rovaniemi', 'sodankyla'],
  ['salo', 'sastamala'], ['salo', 'turku'], ['sastamala', 'seinajoki'],
  ['sastamala', 'tampere'], ['sastamala', 'turku'], ['savonlinna', 'varkaus'],
  ['seinajoki', 'tampere'], ['sodankyla', 'utsjoki'], ['turku', 'uusikaupunki'],
];

export const territories = fromEdges(base, edges);

// Koko Suomi on yhtä maamassaa → kaikki naapurisuuralueet ovat maayhteydessä
// (rannikot koskettavat). Ahvenanmaa (Maarianhamina) on meren takana → sen
// yhteys Turkuun piirtyy reittinä. "a|b" aakkosjärjestyksessä.
// Vierekkäiset suuralueparit (johdettu geometriasta): rannikot koskettavat.
export const landBridges = [
  'kainuu|karjala', 'kainuu|lappi', 'kainuu|pohjanmaa', 'kainuu|savo',
  'karjala|savo', 'keski-suomi|pohjanmaa', 'keski-suomi|savo',
  'lansi-suomi|lounais-suomi', 'lansi-suomi|pohjanmaa', 'lappi|pohjanmaa',
  'lounais-suomi|uusimaa',
];

// SUURALUEVYÖHYKKEET (geo-tila): suuralue = vyöhyke ∩ aito maamassa. Rajat
// kulkevat maakuntarajoja mukaillen. Ruotsi/Norja/Venäjä jäävät vyöhykkeiden
// ulkopuolelle → neutraalia harmaata maata.
export const zones = {
  lappi: [[40,10],[900,10],[900,235],[810,245],[760,250],[715,255],[700,285],[665,300],[635,285],[605,315],[560,300],[510,315],[470,330],[410,335],[330,340],[210,342],[100,345],[40,345]],
  pohjanmaa: [[100,345],[210,342],[330,340],[410,335],[470,330],[510,315],[560,300],[560,360],[540,400],[490,440],[450,480],[420,505],[400,530],[360,545],[300,548],[250,545],[210,525],[190,470],[175,430],[160,395],[120,365]],
  kainuu: [[560,300],[605,315],[635,285],[665,300],[700,285],[715,255],[760,250],[810,245],[900,235],[900,435],[820,440],[760,438],[710,435],[690,430],[665,432],[640,430],[620,415],[600,400],[575,380],[560,360]],
  'keski-suomi': [[470,440],[540,430],[600,445],[585,500],[580,540],[555,560],[510,575],[466,574],[462,545],[461,510],[464,470]],
  savo: [[600,445],[640,430],[665,432],[690,430],[710,435],[715,470],[720,510],[770,540],[765,575],[700,585],[650,590],[615,580],[600,545],[585,500]],
  karjala: [[710,435],[820,440],[900,435],[900,620],[760,625],[700,610],[675,590],[695,585],[765,575],[770,540],[720,510],[715,470]],
  'lansi-suomi': [[185,522],[250,545],[300,548],[360,546],[418,538],[459,538],[460,575],[450,598],[420,602],[360,600],[290,605],[235,608],[195,612],[168,585],[162,548]],
  'lounais-suomi': [[45,590],[165,585],[200,608],[300,600],[420,600],[470,585],[525,588],[540,615],[515,622],[430,620],[370,622],[355,648],[310,652],[255,650],[195,645],[120,672],[45,672]],
  uusimaa: [[355,648],[370,622],[430,620],[515,622],[540,615],[560,600],[620,600],[640,642],[610,662],[520,657],[430,662],[355,668]],
};

// Merireitit (ei-koskettavat yhteydet) ovat särmälistan pareja jotka jäävät
// johdetun maa-naapuruuden ULKOPUOLELLE → render piirtää niille viivan:
// Ahvenanmaa↔Turku ja Kotka↔Porvoo (Suomenlahden rannikkohyppy).

export default {
  id: 'suomi', landAdjacency: true, name: 'Suomi', continents, territories, landBridges,
  geo: { land: LAND }, zones,
};
