// Skenaariot: valmiiksi rakennetut aloitusasetelmat kiinteine pelaajineen,
// liittoumineen (team), omistuksineen ja armeijoineen. Skenaariossa alueita
// ei arvota – asetelma on aina sama, ja ensimmäisen vuoron saa hyökkääjä.
//
// Liittouma (team): saman liittouman pelaajat eivät voi hyökätä toisiaan
// vastaan, ja peli päättyy kun yksi liittouma on jäljellä tai hallitsee
// koko karttaa (ks. engine/game.js).

/**
 * @typedef {{
 *   id: string, name: string, description: string, mapId: string,
 *   humanIndex: number, firstPlayer: number,
 *   teamNames: Record<string,string>,
 *   players: {name:string,color:string,isAI:boolean,team:string}[],
 *   ownership: Record<string, number>,
 *   armies: Record<string, number>,
 *   intro?: string,
 * }} Scenario
 */

/** @type {Record<string, Scenario>} */
export const SCENARIOS = {
  'suomi-nato': {
    id: 'suomi-nato',
    name: '🇫🇮 Suomi Natossa',
    description: 'Venäjä hyökkää yllättäen Natoa vastaan. Puolusta Suomea!',
    mapId: 'eurooppa2025',
    humanIndex: 0,
    firstPlayer: 3, // Venäjä aloittaa yllätyshyökkäyksellä
    teamNames: { lansi: 'Nato ja Ukraina', ita: 'Venäjä' },
    players: [
      { name: 'Suomi',              color: '#2f7bd6', isAI: false, team: 'lansi' },
      { name: '🤝 Nato-liittolaiset', color: '#16a89a', isAI: true,  team: 'lansi' },
      { name: '🤝 Ukraina',          color: '#e0a020', isAI: true,  team: 'lansi' },
      // Suurvallan sotatalous: kiinteä vahvistuslisä joka vuoro.
      // Tasapainotettu simuloimalla: länsi voittaa ~60 % AI-peleistä.
      { name: '🤖 Venäjä',           color: '#d63b3b', isAI: true,  team: 'ita', reinforcementBonus: 3 },
    ],
    // Aloitusasetelma: Venäjän ja Ukrainan sota on käynnissä (Itä-Ukraina ja
    // Krim miehitetty), Kaliningrad on Venäjän, Nato hallitsee muun Euroopan.
    ownership: {
      'pohjois-suomi': 0, 'etela-suomi': 0,
      norja: 1, ruotsi: 1, tanska: 1, baltia: 1, puola: 1,
      saksa: 1, benelux: 1, britannia: 1, ranska: 1,
      'etela-eurooppa': 1, balkan: 1, turkki: 1,
      'lansi-ukraina': 2, kiova: 2,
      kaliningrad: 3, 'valko-venaja': 3, pietari: 3, kuola: 3,
      moskova: 3, 'etela-venaja': 3, 'ita-ukraina': 3, krim: 3,
    },
    armies: {
      'pohjois-suomi': 3, 'etela-suomi': 5,
      norja: 3, ruotsi: 3, tanska: 2, baltia: 4, puola: 6,
      saksa: 5, benelux: 2, britannia: 4, ranska: 4,
      'etela-eurooppa': 3, balkan: 3, turkki: 4,
      'lansi-ukraina': 4, kiova: 6,
      kaliningrad: 5, 'valko-venaja': 6, pietari: 8, kuola: 6,
      moskova: 10, 'etela-venaja': 7, 'ita-ukraina': 8, krim: 5,
    },
    intro: '❗ Venäjä aloittaa yllätyshyökkäyksen! Puolusta Suomea ja auta liittolaisia.',
  },
};

/** Skenaariovalikko UI:lle. */
export const SCENARIO_LIST = Object.values(SCENARIOS).map((s) => ({
  id: s.id, name: s.name, description: s.description,
}));
