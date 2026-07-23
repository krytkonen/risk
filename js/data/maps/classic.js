// Klassinen Risk-maailmankartta: 42 aluetta, 6 mannerta.
// Koordinaatit viewBox 1000 x 700 — alueiden sijainnit ovat AITOJA
// maantieteellisiä sijainteja Miller-projektiossa (tools/geo.mjs, ikkuna
// lon -168..190, lat -55..84, pystyvenytys 1.34). Maamassa: geo/world-land.js
// (Natural Earth 110m). Pelkkää dataa – ei DOM-riippuvuuksia.

import { LAND } from '../geo/world-land.js';

/** @typedef {{id:string,name:string,gen:string,continent:string,x:number,y:number,adj:string[]}} Territory */

export const continents = {
  'north-america': { name: 'Pohjois-Amerikka', bonus: 5, color: '#e6b84a' },
  'south-america': { name: 'Etelä-Amerikka', bonus: 2, color: '#d96c4a' },
  'europe':        { name: 'Eurooppa',        bonus: 5, color: '#4a78d9' },
  'africa':        { name: 'Afrikka',         bonus: 3, color: '#7ba84a' },
  'asia':          { name: 'Aasia',           bonus: 7, color: '#52b3a4' },
  'australia':     { name: 'Australia',       bonus: 2, color: '#b05ec0' },
};

/** @type {Record<string, Territory>} */
export const territories = {
  // --- Pohjois-Amerikka ---
  alaska:        { id: 'alaska', name: 'Alaska', gen: 'Alaskan', continent: 'north-america', x: 67,  y: 179, adj: ['northwest-territory', 'alberta', 'kamchatka'] },
  'northwest-territory': { id: 'northwest-territory', name: 'Luoteisterritorio', gen: 'Luoteisterritorion', continent: 'north-america', x: 166, y: 173, adj: ['alaska', 'alberta', 'ontario', 'greenland'] },
  greenland:     { id: 'greenland', name: 'Grönlanti', gen: 'Grönlannin', continent: 'north-america', x: 359, y: 130, adj: ['northwest-territory', 'ontario', 'quebec', 'iceland'] },
  alberta:       { id: 'alberta', name: 'Alberta', gen: 'Albertan', continent: 'north-america', x: 166, y: 231, adj: ['alaska', 'northwest-territory', 'ontario', 'western-us'] },
  ontario:       { id: 'ontario', name: 'Ontario', gen: 'Ontarion', continent: 'north-america', x: 237, y: 246, adj: ['northwest-territory', 'alberta', 'greenland', 'quebec', 'western-us', 'eastern-us'] },
  quebec:        { id: 'quebec', name: 'Quebec', gen: 'Quebecin', continent: 'north-america', x: 282, y: 246, adj: ['greenland', 'ontario', 'eastern-us'] },
  'western-us':  { id: 'western-us', name: 'Länsi-USA', gen: 'Länsi-USA:n', continent: 'north-america', x: 168, y: 299, adj: ['alberta', 'ontario', 'eastern-us', 'central-america'] },
  'eastern-us':  { id: 'eastern-us', name: 'Itä-USA', gen: 'Itä-USA:n', continent: 'north-america', x: 248, y: 311, adj: ['ontario', 'quebec', 'western-us', 'central-america'] },
  'central-america': { id: 'central-america', name: 'Keski-Amerikka', gen: 'Keski-Amerikan', continent: 'north-america', x: 211, y: 373, adj: ['western-us', 'eastern-us', 'venezuela'] },

  // --- Etelä-Amerikka ---
  venezuela:     { id: 'venezuela', name: 'Venezuela', gen: 'Venezuelan', continent: 'south-america', x: 293, y: 420, adj: ['central-america', 'brazil', 'peru'] },
  brazil:        { id: 'brazil', name: 'Brasilia', gen: 'Brasilian', continent: 'south-america', x: 333, y: 480, adj: ['venezuela', 'peru', 'argentina', 'north-africa'] },
  peru:          { id: 'peru', name: 'Peru', gen: 'Perun', continent: 'south-america', x: 280, y: 488, adj: ['venezuela', 'brazil', 'argentina'] },
  argentina:     { id: 'argentina', name: 'Argentiina', gen: 'Argentiinan', continent: 'south-america', x: 298, y: 579, adj: ['peru', 'brazil'] },

  // --- Eurooppa ---
  iceland:       { id: 'iceland', name: 'Islanti', gen: 'Islannin', continent: 'europe', x: 416, y: 166, adj: ['greenland', 'great-britain', 'scandinavia'] },
  'great-britain': { id: 'great-britain', name: 'Iso-Britannia', gen: 'Iso-Britannian', continent: 'europe', x: 450, y: 222, adj: ['iceland', 'scandinavia', 'northern-europe', 'western-europe'] },
  scandinavia:   { id: 'scandinavia', name: 'Skandinavia', gen: 'Skandinavian', continent: 'europe', x: 511, y: 185, adj: ['iceland', 'great-britain', 'northern-europe', 'ukraine'] },
  'northern-europe': { id: 'northern-europe', name: 'Pohjois-Eurooppa', gen: 'Pohjois-Euroopan', continent: 'europe', x: 505, y: 250, adj: ['great-britain', 'scandinavia', 'ukraine', 'southern-europe', 'western-europe'] },
  'western-europe': { id: 'western-europe', name: 'Länsi-Eurooppa', gen: 'Länsi-Euroopan', continent: 'europe', x: 441, y: 299, adj: ['great-britain', 'northern-europe', 'southern-europe', 'north-africa'] },
  'southern-europe': { id: 'southern-europe', name: 'Etelä-Eurooppa', gen: 'Etelä-Euroopan', continent: 'europe', x: 521, y: 315, adj: ['western-europe', 'northern-europe', 'ukraine', 'middle-east', 'egypt', 'north-africa'] },
  ukraine:       { id: 'ukraine', name: 'Ukraina', gen: 'Ukrainan', continent: 'europe', x: 588, y: 232, adj: ['scandinavia', 'northern-europe', 'southern-europe', 'ural', 'afghanistan', 'middle-east'] },

  // --- Afrikka ---
  'north-africa': { id: 'north-africa', name: 'Pohjois-Afrikka', gen: 'Pohjois-Afrikan', continent: 'africa', x: 472, y: 372, adj: ['brazil', 'western-europe', 'southern-europe', 'egypt', 'east-africa', 'congo'] },
  egypt:         { id: 'egypt', name: 'Egypti', gen: 'Egyptin', continent: 'africa', x: 563, y: 380, adj: ['southern-europe', 'north-africa', 'east-africa', 'middle-east'] },
  'east-africa': { id: 'east-africa', name: 'Itä-Afrikka', gen: 'Itä-Afrikan', continent: 'africa', x: 578, y: 444, adj: ['egypt', 'north-africa', 'congo', 'south-africa', 'madagascar', 'middle-east'] },
  congo:         { id: 'congo', name: 'Kongo', gen: 'Kongon', continent: 'africa', x: 529, y: 459, adj: ['north-africa', 'east-africa', 'south-africa'] },
  'south-africa': { id: 'south-africa', name: 'Etelä-Afrikka', gen: 'Etelä-Afrikan', continent: 'africa', x: 534, y: 547, adj: ['congo', 'east-africa', 'madagascar'] },
  madagascar:    { id: 'madagascar', name: 'Madagaskar', gen: 'Madagaskarin', continent: 'africa', x: 596, y: 513, adj: ['east-africa', 'south-africa'] },

  // --- Aasia ---
  ural:          { id: 'ural', name: 'Ural', gen: 'Uralin', continent: 'asia', x: 630, y: 201, adj: ['ukraine', 'siberia', 'china', 'afghanistan'] },
  siberia:       { id: 'siberia', name: 'Siperia', gen: 'Siperian', continent: 'asia', x: 710, y: 179, adj: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'] },
  yakutsk:       { id: 'yakutsk', name: 'Jakutsk', gen: 'Jakutskin', continent: 'asia', x: 808, y: 173, adj: ['siberia', 'irkutsk', 'kamchatka'] },
  kamchatka:     { id: 'kamchatka', name: 'Kamtšatka', gen: 'Kamtšatkan', continent: 'asia', x: 895, y: 201, adj: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'] },
  irkutsk:       { id: 'irkutsk', name: 'Irkutsk', gen: 'Irkutskin', continent: 'asia', x: 749, y: 227, adj: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'] },
  mongolia:      { id: 'mongolia', name: 'Mongolia', gen: 'Mongolian', continent: 'asia', x: 744, y: 273, adj: ['siberia', 'irkutsk', 'kamchatka', 'japan', 'china'] },
  japan:         { id: 'japan', name: 'Japani', gen: 'Japanin', continent: 'asia', x: 840, y: 307, adj: ['kamchatka', 'mongolia'] },
  afghanistan:   { id: 'afghanistan', name: 'Afganistan', gen: 'Afganistanin', continent: 'asia', x: 664, y: 302, adj: ['ukraine', 'ural', 'china', 'india', 'middle-east'] },
  china:         { id: 'china', name: 'Kiina', gen: 'Kiinan', continent: 'asia', x: 749, y: 327, adj: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'] },
  'middle-east': { id: 'middle-east', name: 'Lähi-itä', gen: 'Lähi-idän', continent: 'asia', x: 610, y: 328, adj: ['ukraine', 'southern-europe', 'egypt', 'east-africa', 'afghanistan', 'india'] },
  india:         { id: 'india', name: 'Intia', gen: 'Intian', continent: 'asia', x: 678, y: 369, adj: ['afghanistan', 'china', 'middle-east', 'siam'] },
  siam:          { id: 'siam', name: 'Siam', gen: 'Siamin', continent: 'asia', x: 739, y: 387, adj: ['china', 'india', 'indonesia'] },

  // --- Australia ---
  indonesia:     { id: 'indonesia', name: 'Indonesia', gen: 'Indonesian', continent: 'australia', x: 771, y: 448, adj: ['siam', 'new-guinea', 'western-australia'] },
  'new-guinea':  { id: 'new-guinea', name: 'Uusi-Guinea', gen: 'Uusi-Guinean', continent: 'australia', x: 850, y: 466, adj: ['indonesia', 'western-australia', 'eastern-australia'] },
  'western-australia': { id: 'western-australia', name: 'Länsi-Australia', gen: 'Länsi-Australian', continent: 'australia', x: 795, y: 539, adj: ['indonesia', 'new-guinea', 'eastern-australia'] },
  'eastern-australia': { id: 'eastern-australia', name: 'Itä-Australia', gen: 'Itä-Australian', continent: 'australia', x: 858, y: 547, adj: ['new-guinea', 'western-australia'] },
};

// Mannerparit jotka ovat MAAYHTEYDESSÄ (yhtä maamassaa) → niiden rannikot
// piirretään koskettamaan (ei merisaukkoa). Muut mannerrajat = merireittejä,
// jäävät auki. Avain: mannerid:t aakkosjärjestyksessä "a|b".
// Euraasia (Eurooppa–Aasia), Amerikat (Panama), Afro-Aasia (Siinai).
export const landBridges = ['asia|europe', 'africa|asia', 'north-america|south-america'];

// MANNERVYÖHYKKEET: karkeat polygonit jotka jakavat AIDON maamassan (geo.land)
// mantereiksi leikkauksella (manner = vyöhyke ∩ maa). Tarkkoja vain siellä
// missä raja ylittää maata: Panama, Ural/Kaukasus, Suez/Punainenmeri, Malakka.
// Muualla raja kulkee merellä → muodolla ei väliä.
export const zones = {
  'north-america': [
    [15, 22], [398, 22], [398, 150], [365, 205], [330, 290], [318, 360],
    [285, 398], [262, 404], [240, 428], [150, 430], [15, 430],
  ],
  'south-america': [
    [240, 428], [262, 404], [285, 398], [345, 400], [395, 470], [395, 665],
    [200, 665], [200, 470], [228, 440],
  ],
  europe: [
    [398, 22], [622, 22], [622, 248], [614, 258], [602, 270], [578, 280],
    [560, 290], [545, 292], [531, 309], [524, 316], [455, 318], [430, 300],
    [405, 262], [398, 200],
  ],
  africa: [
    [455, 318], [524, 316], [531, 309], [548, 318], [558, 332], [587, 394],
    [600, 393], [618, 393], [634, 398], [652, 420], [675, 470], [675, 665],
    [400, 665], [400, 400], [428, 332],
  ],
  asia: [
    [622, 22], [985, 22], [985, 372], [780, 372], [766, 398], [756, 420],
    [748, 445], [737, 432], [733, 415], [722, 410], [710, 438], [694, 446],
    [672, 446], [655, 414], [632, 396], [618, 391], [600, 391], [587, 392],
    [558, 332], [548, 318], [531, 309], [545, 292], [560, 290], [578, 280],
    [602, 270], [614, 258], [622, 248],
  ],
  australia: [
    [694, 446], [710, 438], [722, 410], [733, 415], [737, 432], [748, 445],
    [756, 420], [766, 398], [780, 372], [985, 372], [985, 665], [694, 665],
  ],
};

export default {
  id: 'classic', landAdjacency: 'same', name: 'Maailma (klassinen)', continents, territories, landBridges,
  geo: { land: LAND }, zones,
};
