// Klassinen Risk-maailmankartta: 42 aluetta, 6 mannerta.
// Koordinaatit viewBox 1000 x 700. Pelkkää dataa – ei DOM-riippuvuuksia.

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
  alaska:        { id: 'alaska', name: 'Alaska', gen: 'Alaskan', continent: 'north-america', x: 70,  y: 95,  adj: ['northwest-territory', 'alberta', 'kamchatka'] },
  'northwest-territory': { id: 'northwest-territory', name: 'Luoteisterritorio', gen: 'Luoteisterritorion', continent: 'north-america', x: 165, y: 90, adj: ['alaska', 'alberta', 'ontario', 'greenland'] },
  greenland:     { id: 'greenland', name: 'Grönlanti', gen: 'Grönlannin', continent: 'north-america', x: 320, y: 60, adj: ['northwest-territory', 'ontario', 'quebec', 'iceland'] },
  alberta:       { id: 'alberta', name: 'Alberta', gen: 'Albertan', continent: 'north-america', x: 150, y: 155, adj: ['alaska', 'northwest-territory', 'ontario', 'western-us'] },
  ontario:       { id: 'ontario', name: 'Ontario', gen: 'Ontarion', continent: 'north-america', x: 225, y: 160, adj: ['northwest-territory', 'alberta', 'greenland', 'quebec', 'western-us', 'eastern-us'] },
  quebec:        { id: 'quebec', name: 'Quebec', gen: 'Quebecin', continent: 'north-america', x: 300, y: 155, adj: ['greenland', 'ontario', 'eastern-us'] },
  'western-us':  { id: 'western-us', name: 'Länsi-USA', gen: 'Länsi-USA:n', continent: 'north-america', x: 160, y: 230, adj: ['alberta', 'ontario', 'eastern-us', 'central-america'] },
  'eastern-us':  { id: 'eastern-us', name: 'Itä-USA', gen: 'Itä-USA:n', continent: 'north-america', x: 240, y: 245, adj: ['ontario', 'quebec', 'western-us', 'central-america'] },
  'central-america': { id: 'central-america', name: 'Keski-Amerikka', gen: 'Keski-Amerikan', continent: 'north-america', x: 185, y: 310, adj: ['western-us', 'eastern-us', 'venezuela'] },

  // --- Etelä-Amerikka ---
  venezuela:     { id: 'venezuela', name: 'Venezuela', gen: 'Venezuelan', continent: 'south-america', x: 255, y: 405, adj: ['central-america', 'brazil', 'peru'] },
  brazil:        { id: 'brazil', name: 'Brasilia', gen: 'Brasilian', continent: 'south-america', x: 330, y: 480, adj: ['venezuela', 'peru', 'argentina', 'north-africa'] },
  peru:          { id: 'peru', name: 'Peru', gen: 'Perun', continent: 'south-america', x: 255, y: 510, adj: ['venezuela', 'brazil', 'argentina'] },
  argentina:     { id: 'argentina', name: 'Argentiina', gen: 'Argentiinan', continent: 'south-america', x: 275, y: 605, adj: ['peru', 'brazil'] },

  // --- Eurooppa ---
  iceland:       { id: 'iceland', name: 'Islanti', gen: 'Islannin', continent: 'europe', x: 440, y: 105, adj: ['greenland', 'great-britain', 'scandinavia'] },
  'great-britain': { id: 'great-britain', name: 'Iso-Britannia', gen: 'Iso-Britannian', continent: 'europe', x: 435, y: 185, adj: ['iceland', 'scandinavia', 'northern-europe', 'western-europe'] },
  scandinavia:   { id: 'scandinavia', name: 'Skandinavia', gen: 'Skandinavian', continent: 'europe', x: 525, y: 95, adj: ['iceland', 'great-britain', 'northern-europe', 'ukraine'] },
  'northern-europe': { id: 'northern-europe', name: 'Pohjois-Eurooppa', gen: 'Pohjois-Euroopan', continent: 'europe', x: 525, y: 175, adj: ['great-britain', 'scandinavia', 'ukraine', 'southern-europe', 'western-europe'] },
  'western-europe': { id: 'western-europe', name: 'Länsi-Eurooppa', gen: 'Länsi-Euroopan', continent: 'europe', x: 460, y: 260, adj: ['great-britain', 'northern-europe', 'southern-europe', 'north-africa'] },
  'southern-europe': { id: 'southern-europe', name: 'Etelä-Eurooppa', gen: 'Etelä-Euroopan', continent: 'europe', x: 545, y: 250, adj: ['western-europe', 'northern-europe', 'ukraine', 'middle-east', 'egypt', 'north-africa'] },
  ukraine:       { id: 'ukraine', name: 'Ukraina', gen: 'Ukrainan', continent: 'europe', x: 620, y: 145, adj: ['scandinavia', 'northern-europe', 'southern-europe', 'ural', 'afghanistan', 'middle-east'] },

  // --- Afrikka ---
  'north-africa': { id: 'north-africa', name: 'Pohjois-Afrikka', gen: 'Pohjois-Afrikan', continent: 'africa', x: 495, y: 390, adj: ['brazil', 'western-europe', 'southern-europe', 'egypt', 'east-africa', 'congo'] },
  egypt:         { id: 'egypt', name: 'Egypti', gen: 'Egyptin', continent: 'africa', x: 570, y: 375, adj: ['southern-europe', 'north-africa', 'east-africa', 'middle-east'] },
  'east-africa': { id: 'east-africa', name: 'Itä-Afrikka', gen: 'Itä-Afrikan', continent: 'africa', x: 610, y: 450, adj: ['egypt', 'north-africa', 'congo', 'south-africa', 'madagascar', 'middle-east'] },
  congo:         { id: 'congo', name: 'Kongo', gen: 'Kongon', continent: 'africa', x: 555, y: 475, adj: ['north-africa', 'east-africa', 'south-africa'] },
  'south-africa': { id: 'south-africa', name: 'Etelä-Afrikka', gen: 'Etelä-Afrikan', continent: 'africa', x: 565, y: 565, adj: ['congo', 'east-africa', 'madagascar'] },
  madagascar:    { id: 'madagascar', name: 'Madagaskar', gen: 'Madagaskarin', continent: 'africa', x: 650, y: 545, adj: ['east-africa', 'south-africa'] },

  // --- Aasia ---
  ural:          { id: 'ural', name: 'Ural', gen: 'Uralin', continent: 'asia', x: 710, y: 150, adj: ['ukraine', 'siberia', 'china', 'afghanistan'] },
  siberia:       { id: 'siberia', name: 'Siperia', gen: 'Siperian', continent: 'asia', x: 770, y: 105, adj: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'] },
  yakutsk:       { id: 'yakutsk', name: 'Jakutsk', gen: 'Jakutskin', continent: 'asia', x: 855, y: 80, adj: ['siberia', 'irkutsk', 'kamchatka'] },
  kamchatka:     { id: 'kamchatka', name: 'Kamtšatka', gen: 'Kamtšatkan', continent: 'asia', x: 935, y: 100, adj: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'] },
  irkutsk:       { id: 'irkutsk', name: 'Irkutsk', gen: 'Irkutskin', continent: 'asia', x: 830, y: 155, adj: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'] },
  mongolia:      { id: 'mongolia', name: 'Mongolia', gen: 'Mongolian', continent: 'asia', x: 835, y: 220, adj: ['siberia', 'irkutsk', 'kamchatka', 'japan', 'china'] },
  japan:         { id: 'japan', name: 'Japani', gen: 'Japanin', continent: 'asia', x: 935, y: 210, adj: ['kamchatka', 'mongolia'] },
  afghanistan:   { id: 'afghanistan', name: 'Afganistan', gen: 'Afganistanin', continent: 'asia', x: 705, y: 225, adj: ['ukraine', 'ural', 'china', 'india', 'middle-east'] },
  china:         { id: 'china', name: 'Kiina', gen: 'Kiinan', continent: 'asia', x: 800, y: 280, adj: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'] },
  'middle-east': { id: 'middle-east', name: 'Lähi-itä', gen: 'Lähi-idän', continent: 'asia', x: 665, y: 300, adj: ['ukraine', 'southern-europe', 'egypt', 'east-africa', 'afghanistan', 'india'] },
  india:         { id: 'india', name: 'Intia', gen: 'Intian', continent: 'asia', x: 750, y: 320, adj: ['afghanistan', 'china', 'middle-east', 'siam'] },
  siam:          { id: 'siam', name: 'Siam', gen: 'Siamin', continent: 'asia', x: 840, y: 330, adj: ['china', 'india', 'indonesia'] },

  // --- Australia ---
  indonesia:     { id: 'indonesia', name: 'Indonesia', gen: 'Indonesian', continent: 'australia', x: 855, y: 445, adj: ['siam', 'new-guinea', 'western-australia'] },
  'new-guinea':  { id: 'new-guinea', name: 'Uusi-Guinea', gen: 'Uusi-Guinean', continent: 'australia', x: 945, y: 460, adj: ['indonesia', 'western-australia', 'eastern-australia'] },
  'western-australia': { id: 'western-australia', name: 'Länsi-Australia', gen: 'Länsi-Australian', continent: 'australia', x: 875, y: 565, adj: ['indonesia', 'new-guinea', 'eastern-australia'] },
  'eastern-australia': { id: 'eastern-australia', name: 'Itä-Australia', gen: 'Itä-Australian', continent: 'australia', x: 950, y: 585, adj: ['new-guinea', 'western-australia'] },
};

// Mannerparit jotka ovat MAAYHTEYDESSÄ (yhtä maamassaa) → niiden rannikot
// piirretään koskettamaan (ei merisaukkoa). Muut mannerrajat = merireittejä,
// jäävät auki. Avain: mannerid:t aakkosjärjestyksessä "a|b".
// Euraasia (Eurooppa–Aasia), Amerikat (Panama), Afro-Aasia (Siinai).
export const landBridges = ['asia|europe', 'africa|asia', 'north-america|south-america'];

export default { id: 'classic', name: 'Maailma (klassinen)', continents, territories, landBridges };
