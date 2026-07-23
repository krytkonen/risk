// Saaristomaailma-kartta: 41 aluetta, 8 saariryhmää — fantasia-arkkipelagi.
// Käsin sommiteltu maailma (tools/gen-saaristo.mjs → saaristo-land.js):
// seitsemän teemallista saariryhmää ison usvaisen keskussaaren (Sumusaari)
// ympärillä. Puhdas saaristokartta: kaikki ryhmien väliset rajat ovat meri-
// ylityksiä (reittiviivat), vain Sumusaaren sisällä on maarajoja.
// Naapuruudet johdetaan särmälistasta (symmetrisiä).

import { fromEdges } from './_util.js';
import { LAND } from '../geo/saaristo-land.js';

export const continents = {
  helmisaaret:      { name: 'Helmisaaret',      bonus: 2, color: '#6fb8d9' },
  myrskysaaret:     { name: 'Myrskysaaret',     bonus: 3, color: '#b05ec0' },
  lohikaarmesaaret: { name: 'Lohikäärmesaaret', bonus: 3, color: '#d94f4f' },
  kauppasaaret:     { name: 'Kauppasaaret',     bonus: 2, color: '#e6b84a' },
  sumusaari:        { name: 'Sumusaari',        bonus: 4, color: '#16a89a' },
  riimusaaret:      { name: 'Riimusaaret',      bonus: 3, color: '#7ba84a' },
  merirosvosaaret:  { name: 'Merirosvosaaret',  bonus: 2, color: '#d96c4a' },
  koralliriutat:    { name: 'Koralliriutat',    bonus: 2, color: '#d977a3' },
};

const base = {
  // --- Helmisaaret (luoteinen helmiarkkipelagi) ---
  helmiluoto:    { name: 'Helmiluoto',    gen: 'Helmiluodon',    continent: 'helmisaaret', x: 85, y: 80 },
  simpukkasaari: { name: 'Simpukkasaari', gen: 'Simpukkasaaren', continent: 'helmisaaret', x: 190, y: 65 },
  hohtoriutta:   { name: 'Hohtoriutta',   gen: 'Hohtoriutan',    continent: 'helmisaaret', x: 255, y: 140 },
  vaahtokari:    { name: 'Vaahtokari',    gen: 'Vaahtokarin',    continent: 'helmisaaret', x: 95, y: 175 },
  kuunsaari:     { name: 'Kuunsaari',     gen: 'Kuunsaaren',     continent: 'helmisaaret', x: 185, y: 205 },

  // --- Myrskysaaret (pohjoinen ukkosrintama) ---
  ukkoskari:   { name: 'Ukkoskari',   gen: 'Ukkoskarin',   continent: 'myrskysaaret', x: 350, y: 75 },
  salamasaari: { name: 'Salamasaari', gen: 'Salamasaaren', continent: 'myrskysaaret', x: 460, y: 55 },
  pilvilinna:  { name: 'Pilvilinna',  gen: 'Pilvilinnan',  continent: 'myrskysaaret', x: 545, y: 115 },
  tuulenpesa:  { name: 'Tuulenpesä',  gen: 'Tuulenpesän',  continent: 'myrskysaaret', x: 365, y: 165 },
  sadesaari:   { name: 'Sadesaari',   gen: 'Sadesaaren',   continent: 'myrskysaaret', x: 470, y: 172 },

  // --- Lohikäärmesaaret (koillinen tulivuorikaari) ---
  kaarmeenpaa: { name: 'Käärmeenpää', gen: 'Käärmeenpään', continent: 'lohikaarmesaaret', x: 680, y: 70 },
  liekkivuori: { name: 'Liekkivuori', gen: 'Liekkivuoren', continent: 'lohikaarmesaaret', x: 790, y: 55 },
  tuhkasaari:  { name: 'Tuhkasaari',  gen: 'Tuhkasaaren',  continent: 'lohikaarmesaaret', x: 895, y: 90 },
  hehkuluoto:  { name: 'Hehkuluoto',  gen: 'Hehkuluodon',  continent: 'lohikaarmesaaret', x: 735, y: 160 },
  suomusaari:  { name: 'Suomusaari',  gen: 'Suomusaaren',  continent: 'lohikaarmesaaret', x: 860, y: 185 },

  // --- Kauppasaaret (läntinen kauppaväylä) ---
  majakkaluoto: { name: 'Majakkaluoto', gen: 'Majakkaluodon', continent: 'kauppasaaret', x: 80, y: 320 },
  satamasaari:  { name: 'Satamasaari',  gen: 'Satamasaaren',  continent: 'kauppasaaret', x: 185, y: 300 },
  kultakari:    { name: 'Kultakari',    gen: 'Kultakarin',    continent: 'kauppasaaret', x: 85, y: 420 },
  basaarisaari: { name: 'Basaarisaari', gen: 'Basaarisaaren', continent: 'kauppasaaret', x: 200, y: 395 },
  tullisaari:   { name: 'Tullisaari',   gen: 'Tullisaaren',   continent: 'kauppasaaret', x: 125, y: 490 },

  // --- Sumusaari (usvainen keskussaari — ainoa manner) ---
  usvaranta:    { name: 'Usvaranta',    gen: 'Usvarannan',    continent: 'sumusaari', x: 361, y: 294 },
  harmaasatama: { name: 'Harmaasatama', gen: 'Harmaasataman', continent: 'sumusaari', x: 424, y: 310 },
  hamaravuori:  { name: 'Hämärävuori',  gen: 'Hämärävuoren',  continent: 'sumusaari', x: 480, y: 275 },
  kaikulaakso:  { name: 'Kaikulaakso',  gen: 'Kaikulaakson',  continent: 'sumusaari', x: 555, y: 330 },
  varjolehto:   { name: 'Varjolehto',   gen: 'Varjolehdon',   continent: 'sumusaari', x: 395, y: 380 },
  unohdusniemi: { name: 'Unohdusniemi', gen: 'Unohdusniemen', continent: 'sumusaari', x: 515, y: 395 },

  // --- Riimusaaret (itäiset loitsuvedet) ---
  riimukivi:   { name: 'Riimukivi',   gen: 'Riimukiven',   continent: 'riimusaaret', x: 700, y: 300 },
  loitsuluoto: { name: 'Loitsuluoto', gen: 'Loitsuluodon', continent: 'riimusaaret', x: 810, y: 280 },
  seitasaari:  { name: 'Seitasaari',  gen: 'Seitasaaren',  continent: 'riimusaaret', x: 920, y: 320 },
  noidankari:  { name: 'Noidankari',  gen: 'Noidankarin',  continent: 'riimusaaret', x: 760, y: 390 },
  taikavuono:  { name: 'Taikavuono',  gen: 'Taikavuonon',  continent: 'riimusaaret', x: 880, y: 430 },

  // --- Merirosvosaaret (lounaiset kaapparivedet) ---
  aarresaari:   { name: 'Aarresaari',   gen: 'Aarresaaren',   continent: 'merirosvosaaret', x: 85, y: 590 },
  kalloluoto:   { name: 'Kalloluoto',   gen: 'Kalloluodon',   continent: 'merirosvosaaret', x: 175, y: 570 },
  rommiranta:   { name: 'Rommiranta',   gen: 'Rommirannan',   continent: 'merirosvosaaret', x: 170, y: 640 },
  kaapparikari: { name: 'Kaapparikari', gen: 'Kaapparikarin', continent: 'merirosvosaaret', x: 280, y: 600 },
  mustalippu:   { name: 'Mustalippu',   gen: 'Mustalipun',    continent: 'merirosvosaaret', x: 360, y: 635 },

  // --- Koralliriutat (kaakkoiset laguunit) ---
  koralliluoto: { name: 'Koralliluoto', gen: 'Koralliluodon', continent: 'koralliriutat', x: 620, y: 530 },
  laguunisaari: { name: 'Laguunisaari', gen: 'Laguunisaaren', continent: 'koralliriutat', x: 730, y: 510 },
  neitokari:    { name: 'Neitokari',    gen: 'Neitokarin',    continent: 'koralliriutat', x: 840, y: 545 },
  ahvenriutta:  { name: 'Ahvenriutta',  gen: 'Ahvenriutan',   continent: 'koralliriutat', x: 700, y: 610 },
  tahtiriutta:  { name: 'Tähtiriutta',  gen: 'Tähtiriutan',   continent: 'koralliriutat', x: 905, y: 620 },
};

const edges = [
  // Helmisaaret
  ['helmiluoto', 'simpukkasaari'], ['simpukkasaari', 'hohtoriutta'],
  ['hohtoriutta', 'kuunsaari'], ['kuunsaari', 'vaahtokari'], ['vaahtokari', 'helmiluoto'],
  ['simpukkasaari', 'kuunsaari'],
  // Myrskysaaret
  ['ukkoskari', 'salamasaari'], ['salamasaari', 'pilvilinna'], ['pilvilinna', 'sadesaari'],
  ['sadesaari', 'tuulenpesa'], ['tuulenpesa', 'ukkoskari'], ['salamasaari', 'sadesaari'],
  // Lohikäärmesaaret
  ['kaarmeenpaa', 'liekkivuori'], ['liekkivuori', 'tuhkasaari'], ['kaarmeenpaa', 'hehkuluoto'],
  ['hehkuluoto', 'suomusaari'], ['tuhkasaari', 'suomusaari'], ['liekkivuori', 'hehkuluoto'],
  // Kauppasaaret
  ['majakkaluoto', 'satamasaari'], ['satamasaari', 'basaarisaari'], ['majakkaluoto', 'kultakari'],
  ['kultakari', 'tullisaari'], ['basaarisaari', 'tullisaari'], ['kultakari', 'basaarisaari'],
  // Sumusaari (maarajat)
  ['usvaranta', 'harmaasatama'], ['usvaranta', 'varjolehto'], ['usvaranta', 'hamaravuori'],
  ['harmaasatama', 'hamaravuori'], ['harmaasatama', 'varjolehto'], ['harmaasatama', 'unohdusniemi'],
  ['hamaravuori', 'kaikulaakso'], ['kaikulaakso', 'unohdusniemi'], ['varjolehto', 'unohdusniemi'],
  // Riimusaaret
  ['riimukivi', 'loitsuluoto'], ['loitsuluoto', 'seitasaari'], ['riimukivi', 'noidankari'],
  ['noidankari', 'taikavuono'], ['seitasaari', 'taikavuono'], ['loitsuluoto', 'noidankari'],
  // Merirosvosaaret
  ['aarresaari', 'kalloluoto'], ['aarresaari', 'rommiranta'], ['kalloluoto', 'rommiranta'],
  ['kalloluoto', 'kaapparikari'], ['rommiranta', 'kaapparikari'], ['kaapparikari', 'mustalippu'],
  // Koralliriutat
  ['koralliluoto', 'laguunisaari'], ['laguunisaari', 'ahvenriutta'], ['ahvenriutta', 'koralliluoto'],
  ['laguunisaari', 'neitokari'], ['neitokari', 'tahtiriutta'],
  // Ryhmien väliset merireitit
  ['hohtoriutta', 'ukkoskari'],       // Helmisaaret ↔ Myrskysaaret
  ['kuunsaari', 'usvaranta'],         // Helmisaaret ↔ Sumusaari
  ['vaahtokari', 'majakkaluoto'],     // Helmisaaret ↔ Kauppasaaret
  ['pilvilinna', 'kaarmeenpaa'],      // Myrskysaaret ↔ Lohikäärmesaaret
  ['sadesaari', 'hamaravuori'],       // Myrskysaaret ↔ Sumusaari
  ['tuulenpesa', 'usvaranta'],        // Myrskysaaret ↔ Sumusaari
  ['hehkuluoto', 'loitsuluoto'],      // Lohikäärmesaaret ↔ Riimusaaret
  ['suomusaari', 'seitasaari'],       // Lohikäärmesaaret ↔ Riimusaaret
  ['satamasaari', 'usvaranta'],       // Kauppasaaret ↔ Sumusaari
  ['basaarisaari', 'varjolehto'],     // Kauppasaaret ↔ Sumusaari
  ['tullisaari', 'kalloluoto'],       // Kauppasaaret ↔ Merirosvosaaret
  ['kaikulaakso', 'riimukivi'],       // Sumusaari ↔ Riimusaaret
  ['unohdusniemi', 'koralliluoto'],   // Sumusaari ↔ Koralliriutat
  ['varjolehto', 'kaapparikari'],     // Sumusaari ↔ Merirosvosaaret
  ['taikavuono', 'laguunisaari'],     // Riimusaaret ↔ Koralliriutat
  ['mustalippu', 'koralliluoto'],     // Merirosvosaaret ↔ Koralliriutat
];

export const territories = fromEdges(base, edges);

// Saaristomaailma: yksikään saariryhmäpari ei ole maayhteydessä — kaikki
// ryhmien väliset rajat ovat meriylityksiä (reittiviivat).
export const landBridges = [];

// SAARIRYHMÄVYÖHYKKEET: suorakaidemaiset laatikot saariryhmien ympärillä;
// rajat kulkevat avomerellä. Koristeluodot jäävät laatikoiden ulkopuolelle
// → neutraaleja. Keskietelän avomeri jää tyhjäksi merikäärmeille.
export const zones = {
  helmisaaret: [[25,30],[295,30],[295,243],[25,243]],
  myrskysaaret: [[302,16],[594,16],[594,210],[302,210]],
  lohikaarmesaaret: [[610,16],[975,16],[975,228],[610,228]],
  kauppasaaret: [[25,256],[268,256],[268,530],[25,530]],
  sumusaari: [[290,214],[620,214],[620,468],[290,468]],
  riimusaaret: [[632,234],[975,234],[975,462],[632,462]],
  merirosvosaaret: [[30,538],[438,538],[438,670],[30,670]],
  koralliriutat: [[590,484],[975,484],[975,670],[590,670]],
};

export default {
  id: 'saaristomaailma', landAdjacency: true, name: 'Saaristomaailma', continents, territories, landBridges,
  geo: { land: LAND }, zones, fantasy: true,
};
