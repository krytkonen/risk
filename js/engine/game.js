// Risk-pelin ydinlogiikka: pelitila, vuorovaiheet (vahvistus, hyökkäys,
// linnoitus), vahvistuslaskenta, valloitus, pelaajan putoaminen ja
// voittoehto. Puhdas moduuli – ei DOM-riippuvuuksia, testattavissa Nodella.

import { TERRITORIES, TERRITORY_IDS, CONTINENTS, continentTerritories, setActiveMap, activeMapId } from '../data/territories.js';
import { makeRng, randomSeed } from './rng.js';
import { resolveAttack } from './combat.js';
import { buildDeck, shuffle, setValue, setValueFixed, isValidSet } from './cards.js';

export const PHASES = { REINFORCE: 'reinforce', ATTACK: 'attack', FORTIFY: 'fortify', GAMEOVER: 'gameover' };

// Tekoälyn vaikeustasot heikoimmasta vahvimpaan.
export const DIFFICULTIES = ['helppo', 'normaali', 'vaikea', 'kenraali'];
const normDiff = (d, fallback = 'normaali') => (DIFFICULTIES.includes(d) ? d : fallback);

// Aloitusarmeijat pelaajamäärän mukaan (klassinen Risk).
const STARTING_ARMIES = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };

export function startingArmiesFor(playerCount) {
  return STARTING_ARMIES[playerCount] ?? Math.max(20, 50 - playerCount * 5);
}

// ---------------------------------------------------------------------------
// Verbien taivutusapu (2. persoona yksikkö, mennyt aika)
// ---------------------------------------------------------------------------

/** Taivutuskartta: 3. persoona → 2. persoona (ihmispelaaja "Sinä") */
const VERB_2ND = {
  'valloitti': 'valloitit',
  'sai': 'sait',
  'siirsi': 'siirsit',
  'putosi': 'putosit',
  'aloittaa': 'aloitat',
  'vaihtoi': 'vaihdoit',
  'voitti': 'voitit',
  'hallitsee': 'hallitset',
};

/**
 * Muodostaa lokiviestin jossa pelaajan nimi on subjektina.
 * Jos pelaajan nimi on 'Sinä', käytetään 2. persoonan taivutusta
 * (esim. "Sinä valloitit" eikä "Sinä valloitti").
 * @param {string} playerName pelaajan nimi
 * @param {string} verb verbi 3. persoonassa (esim. 'valloitti')
 * @param {string} [rest] lauseen loppuosa
 */
function playerVerb(playerName, verb, rest = '') {
  const v = (playerName === 'Sinä') ? (VERB_2ND[verb] || verb) : verb;
  return rest ? `${playerName} ${v} ${rest}` : `${playerName} ${v}`;
}

/**
 * Luo uuden pelin.
 * @param {{players?: {name:string,color:string,isAI:boolean,team?:string}[], seed?:number,
 *           mapId?:string, options?:{fogOfWar?:boolean, blizzard?:boolean},
 *           scenario?: import('../data/scenarios.js').Scenario}} opts
 *
 * Skenaariossa (scenario annettu): pelaajat, liittoumat, omistukset ja
 * armeijat tulevat skenaariosta – mitään ei arvota, ja ensimmäisen vuoron
 * saa scenario.firstPlayer. Lumimyrsky ei ole käytössä skenaarioissa
 * (suljetut alueet rikkoisivat kiinteän asetelman).
 */
export function createGame({ players, seed, mapId, options, scenario }) {
  if (scenario) {
    players = scenario.players;
    mapId = scenario.mapId;
  }
  if (!players || players.length < 2 || players.length > 6) {
    throw new Error('Pelaajia oltava 2–6');
  }
  // Aktivoi valittu kartta (oletus säilyy jos mapId puuttuu).
  if (mapId) setActiveMap(mapId);
  const usedSeed = seed ?? randomSeed();
  const rng = makeRng(usedSeed);

  const state = {
    seed: usedSeed,
    rng,
    options: {
      fogOfWar: !!options?.fogOfWar,
      blizzard: !!options?.blizzard && !scenario,
      // Korttibonus: false = kasvava (klassinen), true = kiinteä tyypin mukaan.
      fixedCards: !!options?.fixedCards,
      // Pehmeä vuororaja: jos kukaan ei ole voittanut tähän mennessä, voittaja
      // ratkaistaan pisteillä (alueet, sitten armeijat) → peli päättyy aina
      // siististi eikä juutu pattitilanteeseen. 0 = ei rajaa.
      maxTurns: Number.isFinite(options?.maxTurns) ? options.maxTurns : 50,
      // Tekoälyn vaikeustaso: 'helppo' | 'normaali' | 'vaikea'. Vaikuttaa vain
      // AI-pelaajien pelityyliin (vahvistuksen keskitys, hyökkäyskynnys,
      // kertoimet). Ihmispelaajiin ei vaikutusta.
      difficulty: normDiff(options?.difficulty),
      // Salaiset tavoitteet: jokainen pelaaja saa oman voittotavoitteen. Voitto
      // joko tavoitteen täyttämällä TAI herruudella. Ei skenaarioissa (liittoumat).
      missions: !!options?.missions && !scenario,
    },
    scenarioId: scenario?.id ?? null,
    teamNames: scenario?.teamNames ?? null,
    players: players.map((p, i) => ({
      index: i,
      name: p.name,
      color: p.color,
      isAI: !!p.isAI,
      team: p.team ?? null,
      reinforcementBonus: p.reinforcementBonus || 0,
      // Per-pelaaja vaikeus (oletus pelin optiosta). Sallii sekavaikeat pelit
      // (esim. tasapainosimulaatio) ilman että UI paljastaa sitä.
      difficulty: normDiff(p.difficulty, normDiff(options?.difficulty)),
      cards: [],
      alive: true,
    })),
    territories: {},
    blizzards: [],
    current: 0,
    phase: PHASES.REINFORCE,
    reinforcements: 0,
    setsTraded: 0,
    conqueredThisTurn: false,
    deck: [],
    discard: [],
    pendingConquest: null,
    winner: null,
    winnerTeam: null,
    turnCount: 1,
    log: [],
    stats: players.map(() => emptyStats()),
  };

  for (const id of TERRITORY_IDS) state.territories[id] = { owner: null, armies: 0 };

  // Lumimyrsky: valitse pysyvästi suljetut alueet ennen jakoa.
  pickBlizzards(state);
  const playable = playableIds(state);

  state.deck = shuffle(buildDeck(playable), rng);
  if (scenario) {
    applyScenarioSetup(state, scenario);
  } else {
    distributeTerritories(state);
    deployStartingArmies(state);
  }

  state.current = scenario?.firstPlayer ?? 0;
  startReinforcement(state);
  if (scenario) {
    log(state, scenario.intro || `Skenaario: ${scenario.name}.`, 'attack');
    log(state, `${playerVerb(state.players[state.current].name, 'aloittaa')}.`, 'turn');
  } else {
    log(state, `Peli alkaa. ${playerVerb(state.players[state.current].name, 'aloittaa')}.`, 'info');
  }
  if (state.options.blizzard && state.blizzards.length) {
    log(state, `❄ Lumimyrsky sulkee: ${state.blizzards.map((id) => TERRITORIES[id].name).join(', ')}.`, 'info');
  }
  if (state.options.missions) assignMissions(state);
  return state;
}

// ---------------------------------------------------------------------------
// Salaiset tavoitteet (missiot)
// ---------------------------------------------------------------------------

// Arpoo jokaiselle pelaajalle voittotavoitteen kartan koon mukaan (siemennetysti).
// Tyypit ovat kaikki LAUDASTA JOHDETTAVISSA (ei erillistä seurantaa):
//  - continents: valtaa 2 nimettyä mannerta
//  - anyContinents: valtaa mitkä tahansa N mannerta
//  - territories: hallitse K aluetta
//  - territoriesArmed: hallitse K aluetta, joissa kussakin ≥2 armeijaa
function assignMissions(state) {
  const rng = state.rng;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const conts = Object.keys(CONTINENTS);
  const nTerr = Object.keys(state.territories).length;
  const nCont = conts.length;
  const sized = conts.map((c) => ({ c, n: continentTerritories(c).length })).sort((a, b) => a.n - b.n);

  function continentPair() {
    // c1 pienemmästä puoliskosta, c2 mikä tahansa muu, yhteiskoko ≤ 60 % kartasta.
    const smaller = sized.slice(0, Math.max(1, Math.ceil(sized.length / 2))).map((x) => x.c);
    const c1 = pick(smaller);
    const options = conts.filter((c) => c !== c1
      && continentTerritories(c1).length + continentTerritories(c).length <= nTerr * 0.6);
    if (!options.length) return null;
    return [c1, pick(options)].sort();
  }

  for (const p of state.players) {
    const roll = rng();
    let m = null;
    if (roll < 0.35) { const pair = continentPair(); if (pair) m = { type: 'continents', ids: pair }; }
    else if (roll < 0.55) m = { type: 'anyContinents', count: Math.max(2, Math.ceil(nCont / 2)) };
    else if (roll < 0.8) m = { type: 'territories', count: Math.round(nTerr * 0.55) };
    else m = { type: 'territoriesArmed', count: Math.round(nTerr * 0.42), armies: 2 };
    // Varmuus: jos mannerpari epäonnistui, käytä aluetavoitetta.
    p.mission = m || { type: 'territories', count: Math.round(nTerr * 0.55) };
  }
}

/** Omistaako pelaaja koko mantereen (kaikki sen alueet)? */
function ownsContinent(state, pi, contId) {
  return continentTerritories(contId).every((id) => state.territories[id].owner === pi);
}

/** Onko pelaajan tavoite täyttynyt (johdetaan pelkästään laudasta)? */
export function missionComplete(state, pi) {
  const m = state.players[pi]?.mission;
  if (!m) return false;
  const owned = ownedBy(state, pi);
  switch (m.type) {
    case 'territories': return owned.length >= m.count;
    case 'territoriesArmed':
      return owned.filter((id) => state.territories[id].armies >= m.armies).length >= m.count;
    case 'anyContinents':
      return Object.keys(CONTINENTS).filter((c) => ownsContinent(state, pi, c)).length >= m.count;
    case 'continents':
      return m.ids.every((c) => ownsContinent(state, pi, c));
    default: return false;
  }
}

/** Ihmisluettava tavoitekuvaus (suomeksi). */
export function missionText(mission) {
  if (!mission) return '';
  switch (mission.type) {
    case 'continents':
      return `Valtaa kokonaan: ${mission.ids.map((c) => CONTINENTS[c].name).join(' ja ')}.`;
    case 'anyContinents':
      return `Valtaa kokonaan mitkä tahansa ${mission.count} mannerta.`;
    case 'territories':
      return `Hallitse vähintään ${mission.count} aluetta.`;
    case 'territoriesArmed':
      return `Hallitse vähintään ${mission.count} aluetta, joissa kussakin ≥ ${mission.armies} armeijaa.`;
    default: return '';
  }
}

/** Asettaa skenaarion kiinteän aloitusasetelman (omistukset + armeijat). */
function applyScenarioSetup(state, scenario) {
  for (const id of TERRITORY_IDS) {
    const owner = scenario.ownership[id];
    if (owner === undefined || !state.players[owner]) {
      throw new Error(`Skenaariosta puuttuu omistaja alueelle ${id}`);
    }
    state.territories[id].owner = owner;
    state.territories[id].armies = Math.max(1, scenario.armies[id] ?? 1);
  }
}

// --- Liittoumat -------------------------------------------------------------

/** Ovatko kaksi pelaajaa samassa liittoumassa (tai sama pelaaja)? */
export function sameTeam(state, a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (a === b) return true;
  const ta = state.players[a]?.team;
  const tb = state.players[b]?.team;
  return !!ta && ta === tb;
}

// --- Pelimoodit: lumimyrsky & sumu ---------------------------------------

/**
 * Valitsee pysyvät lumimyrskyalueet (n. 10 % kartasta) pelin alussa.
 * Lumimyrskyalue on koko pelin ajan suljettu: ei omistajaa eikä joukkoja,
 * sitä ei voi vallata eikä sen läpi pääse, eikä sitä lasketa mantereen
 * bonukseen. Valinta säilyttää muun kartan yhtenäisyyden, jotta peli ei
 * voi jäädä jumiin saartuneiden alueiden takia.
 */
function pickBlizzards(state) {
  state.blizzards = [];
  if (!state.options?.blizzard) return;
  const target = Math.max(2, Math.round(TERRITORY_IDS.length * 0.10));
  const blocked = new Set();
  for (const cand of shuffle([...TERRITORY_IDS], state.rng)) {
    if (blocked.size >= target) break;
    blocked.add(cand);
    if (!remainderConnected(blocked)) blocked.delete(cand); // ei saa katkaista karttaa
  }
  state.blizzards = [...blocked];
}

/** Onko jäljellä oleva (ei-suljettu) kartta yhtenäinen, kun `blocked` poistetaan? */
function remainderConnected(blocked) {
  const open = TERRITORY_IDS.filter((id) => !blocked.has(id));
  if (open.length === 0) return false;
  const seen = new Set([open[0]]);
  const q = [open[0]];
  while (q.length) {
    const cur = q.shift();
    for (const n of TERRITORIES[cur].adj) {
      if (blocked.has(n) || seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen.size === open.length;
}

/** Onko alue lumimyrskyn sulkema (pelin ajan)? */
export function isBlizzard(state, id) {
  return !!(state.blizzards && state.blizzards.includes(id));
}

/** Pelattavat alueet: kaikki paitsi lumimyrskyn sulkemat. */
export function playableIds(state) {
  if (!state.blizzards || state.blizzards.length === 0) return TERRITORY_IDS;
  return TERRITORY_IDS.filter((id) => !state.blizzards.includes(id));
}

/**
 * Sumu (fog of war): pelaaja näkee vain omat alueensa ja niiden naapurit.
 * Lumimyrskyn sulkemat alueet (maasto) näkyvät aina. Palauttaa Setin
 * alueista, jotka annettu pelaaja näkee.
 * @param {object} state
 * @param {number} viewerIndex
 * @returns {Set<string>}
 */
export function visibleTerritories(state, viewerIndex) {
  const visible = new Set();
  for (const id of TERRITORY_IDS) {
    if (isBlizzard(state, id)) { visible.add(id); continue; }
    if (state.territories[id].owner === viewerIndex) {
      visible.add(id);
      for (const n of TERRITORIES[id].adj) visible.add(n);
    }
  }
  return visible;
}

// --- Alkujako -------------------------------------------------------------

function distributeTerritories(state) {
  const ids = shuffle(playableIds(state), state.rng);
  const n = state.players.length;
  ids.forEach((id, i) => {
    const owner = i % n;
    state.territories[id].owner = owner;
    state.territories[id].armies = 1;
  });
}

function deployStartingArmies(state) {
  const n = state.players.length;
  const total = startingArmiesFor(n);
  for (let p = 0; p < n; p++) {
    const owned = ownedBy(state, p);
    let remaining = total - owned.length; // 1 armeija per alue jo jaettu
    while (remaining > 0) {
      const t = owned[Math.floor(state.rng() * owned.length)];
      state.territories[t].armies++;
      remaining--;
    }
  }
}

// --- Apufunktiot ----------------------------------------------------------

/** Tyhjä tilastorivi yhdelle pelaajalle. */
export function emptyStats() {
  return { conquests: 0, battlesWon: 0, battlesLost: 0, setsTraded: 0, eliminations: 0 };
}

/**
 * Pelaajan tilastorivi. Luo puuttuvat rivit laiskasti (vanhat tallennukset
 * eivät sisällä statseja – ne alkavat nollista).
 */
export function statsFor(state, playerIndex) {
  if (!state.stats) state.stats = state.players.map(() => emptyStats());
  if (!state.stats[playerIndex]) state.stats[playerIndex] = emptyStats();
  return state.stats[playerIndex];
}

export function ownedBy(state, playerIndex) {
  return TERRITORY_IDS.filter((id) => state.territories[id].owner === playerIndex);
}

export function log(state, msg, type = 'info') {
  state.log.push({ msg, type, turn: state.turnCount });
  if (state.log.length > 200) state.log.shift();
}

/**
 * Pelaaja hallitsee mantereen, jos omistaa kaikki sen avoimet (ei lumimyrskyn
 * sulkemat) alueet. Lumimyrskyalueita ei tarvitse miehittää bonukseen.
 */
function controlsContinent(state, contId, playerIndex) {
  const open = continentTerritories(contId).filter((t) => !isBlizzard(state, t));
  return open.length > 0 && open.every((t) => state.territories[t].owner === playerIndex);
}

/**
 * Vahvistusten määrä pelaajalle: max(3, alueet/3) + mannerbonukset
 * + pelaajan kiinteä lisä (skenaariot, esim. suurvallan sotatalous).
 */
export function calcReinforcements(state, playerIndex) {
  const owned = ownedBy(state, playerIndex);
  let n = Math.max(3, Math.floor(owned.length / 3));
  for (const contId of Object.keys(CONTINENTS)) {
    if (controlsContinent(state, contId, playerIndex)) n += CONTINENTS[contId].bonus;
  }
  n += state.players[playerIndex].reinforcementBonus || 0;
  return n;
}

/** Mantereet jotka pelaaja hallitsee kokonaan (lumimyrskyalueet pois lukien). */
export function controlledContinents(state, playerIndex) {
  return Object.keys(CONTINENTS).filter((contId) => controlsContinent(state, contId, playerIndex));
}

// --- Vuorovaiheet ---------------------------------------------------------

export function startReinforcement(state) {
  const p = state.current;
  state.phase = PHASES.REINFORCE;
  state.reinforcements = calcReinforcements(state, p);
  state.conqueredThisTurn = false;
  state.pendingConquest = null;
}

/** Pakollinen vaihto: jos kädessä on 5+ korttia, on vaihdettava. */
export function mustTradeCards(state, playerIndex = state.current) {
  return state.players[playerIndex].cards.length >= 5;
}

/**
 * Vaihtaa kolmen kortin sarjan armeijoiksi.
 * @param {number[]} indices kolmen kortin indeksit pelaajan kädessä
 */
export function tradeCards(state, indices) {
  if (state.phase !== PHASES.REINFORCE) return { ok: false, reason: 'Väärä vaihe' };
  const player = state.players[state.current];
  if (!indices || indices.length !== 3) return { ok: false, reason: 'Valitse 3 korttia' };
  const cards = indices.map((i) => player.cards[i]);
  if (cards.some((c) => !c)) return { ok: false, reason: 'Virheellinen valinta' };
  if (!isValidSet(cards)) return { ok: false, reason: 'Ei kelvollinen sarja' };

  const bonus = state.options?.fixedCards ? setValueFixed(cards) : setValue(state.setsTraded);
  state.setsTraded++;
  state.reinforcements += bonus;
  statsFor(state, state.current).setsTraded++;

  // +2 armeijaa jos omistaa sarjan kortin alueen (klassinen sääntö).
  let territoryBonus = 0;
  for (const c of cards) {
    if (c.territoryId && state.territories[c.territoryId].owner === state.current) {
      state.territories[c.territoryId].armies += 2;
      territoryBonus += 2;
      break;
    }
  }

  // Poista kortit kädestä (suuremmasta indeksistä alkaen) ja siirrä poistopakkaan.
  const sorted = [...indices].sort((a, b) => b - a);
  for (const i of sorted) state.discard.push(player.cards.splice(i, 1)[0]);

  log(state, `${playerVerb(player.name, 'vaihtoi', 'korttisarjan:')} +${bonus} armeijaa${territoryBonus ? ` (+${territoryBonus} aluebonus)` : ''}.`, 'info');
  return { ok: true, bonus, territoryBonus };
}

/** Sijoittaa n vahvistusta alueelle vahvistusvaiheessa. */
export function placeArmies(state, territoryId, n = 1) {
  if (state.phase !== PHASES.REINFORCE) return { ok: false, reason: 'Väärä vaihe' };
  const t = state.territories[territoryId];
  if (!t || t.owner !== state.current) return { ok: false, reason: 'Ei oma alue' };
  if (n <= 0 || n > state.reinforcements) return { ok: false, reason: 'Liikaa armeijoita' };
  t.armies += n;
  state.reinforcements -= n;
  return { ok: true };
}

/**
 * Kumoaa vahvistusten sijoituksen: palauttaa n armeijaa alueelta takaisin
 * sijoituspooliin. Sallittu vain vahvistusvaiheessa omalle alueelle, ja
 * alueelle on jäätävä vähintään 1 armeija.
 */
export function unplaceArmies(state, territoryId, n = 1) {
  if (state.phase !== PHASES.REINFORCE) return { ok: false, reason: 'Väärä vaihe' };
  const t = state.territories[territoryId];
  if (!t || t.owner !== state.current) return { ok: false, reason: 'Ei oma alue' };
  if (n <= 0 || t.armies - n < 1) return { ok: false, reason: 'Alueelle on jäätävä vähintään 1 armeija' };
  t.armies -= n;
  state.reinforcements += n;
  return { ok: true };
}

export function endReinforcement(state) {
  if (state.phase !== PHASES.REINFORCE) return { ok: false };
  if (state.reinforcements > 0) return { ok: false, reason: 'Sijoita kaikki vahvistukset ensin' };
  if (mustTradeCards(state)) return { ok: false, reason: 'Vaihda korttisi ensin (5+ kädessä)' };
  state.phase = PHASES.ATTACK;
  return { ok: true };
}

/** Voiko alueelta from hyökätä alueelle to? */
export function canAttack(state, fromId, toId) {
  const from = state.territories[fromId];
  const to = state.territories[toId];
  if (!from || !to) return false;
  if (isBlizzard(state, fromId) || isBlizzard(state, toId)) return false; // suljettu maasto
  if (from.owner !== state.current) return false;
  if (to.owner === state.current) return false;
  if (sameTeam(state, from.owner, to.owner)) return false; // liittolaista vastaan ei hyökätä
  if (from.armies < 2) return false;
  return TERRITORIES[fromId].adj.includes(toId);
}

/**
 * Suorittaa yhden hyökkäyserän. Jos puolustaja tuhostuu, asettaa
 * pendingConquest-tilan; kutsujan on kutsuttava resolveConquest.
 */
export function attack(state, fromId, toId) {
  if (state.phase !== PHASES.ATTACK) return { ok: false, reason: 'Väärä vaihe' };
  if (state.pendingConquest) return { ok: false, reason: 'Viimeistele valloitus ensin' };
  if (!canAttack(state, fromId, toId)) return { ok: false, reason: 'Hyökkäys ei sallittu' };

  const from = state.territories[fromId];
  const defenderIndex = state.territories[toId].owner;
  const attackerDiceUsed = Math.min(3, from.armies - 1);
  const r = resolveAttack(state, fromId, toId, state.rng);

  // Tilastot: erän voittaa se, joka tuhosi enemmän (tasaerä ei kummallekaan).
  if (r.defenderLosses > r.attackerLosses) {
    statsFor(state, state.current).battlesWon++;
    if (defenderIndex !== null) statsFor(state, defenderIndex).battlesLost++;
  } else if (r.attackerLosses > r.defenderLosses) {
    statsFor(state, state.current).battlesLost++;
    if (defenderIndex !== null) statsFor(state, defenderIndex).battlesWon++;
  }

  if (r.conquered) {
    const minMove = Math.max(1, Math.min(attackerDiceUsed, from.armies - 1));
    const maxMove = from.armies - 1;
    state.pendingConquest = { fromId, toId, minMove, maxMove };
    const playerName = state.players[state.current].name;
    log(state, playerVerb(playerName, 'valloitti', `${TERRITORIES[toId].gen}!`), 'attack');
  }
  return { ok: true, ...r };
}

/** Viimeistelee valloituksen siirtämällä armeijat valloitetulle alueelle. */
export function resolveConquest(state, moveCount) {
  const pc = state.pendingConquest;
  if (!pc) return { ok: false, reason: 'Ei valloitusta kesken' };
  const from = state.territories[pc.fromId];
  const to = state.territories[pc.toId];
  const move = Math.max(pc.minMove, Math.min(moveCount, pc.maxMove));

  const loserIndex = to.owner;
  to.owner = state.current;
  from.armies -= move;
  to.armies = move;
  state.conqueredThisTurn = true;
  state.pendingConquest = null;
  statsFor(state, state.current).conquests++;

  // Putosiko puolustaja pelistä?
  if (loserIndex !== null && ownedBy(state, loserIndex).length === 0) {
    eliminatePlayer(state, loserIndex, state.current);
  }
  checkWin(state);
  return { ok: true, move };
}

function eliminatePlayer(state, loserIndex, conquerorIndex) {
  const loser = state.players[loserIndex];
  if (!loser.alive) return;
  loser.alive = false;
  // Voittaja perii kukistetun pelaajan kortit (klassinen sääntö).
  const conqueror = state.players[conquerorIndex];
  conqueror.cards.push(...loser.cards);
  loser.cards = [];
  statsFor(state, conquerorIndex).eliminations++;
  log(state, `${playerVerb(loser.name, 'putosi', 'pelistä!')} ${playerVerb(conqueror.name, 'sai', 'kortit.')}`, 'eliminate');
}

/** Liittouma-avain voittotarkistukseen: team tai yksilöllinen soolotunniste. */
function teamKey(state, playerIndex) {
  return state.players[playerIndex].team || `solo-${playerIndex}`;
}

/** Julistaa liittouman (tai soolopelaajan) voittajaksi. */
function declareWin(state, key, viaDomination) {
  const members = state.players.filter((p, i) => p.alive && teamKey(state, i) === key);
  if (!members.length) return;
  // Voittajaksi merkitään liittouman ihmispelaaja jos elossa, muuten ensimmäinen.
  const lead = members.find((p) => !p.isAI) || members[0];
  state.winner = lead.index;
  state.winnerTeam = state.players[lead.index].team || null;
  state.phase = PHASES.GAMEOVER;
  const teamName = state.teamNames?.[state.winnerTeam] || null;
  if (teamName && members.length > 1) {
    log(state, `${teamName} ${viaDomination ? 'hallitsee koko karttaa' : 'voitti sodan'}!`, 'win');
  } else if (viaDomination) {
    log(state, `${playerVerb(lead.name, 'hallitsee', 'maailmaa!')}`, 'win');
  } else {
    log(state, `${playerVerb(lead.name, 'voitti', 'pelin!')}`, 'win');
  }
}

/** Liittouman pisteet: alueet painavat ensin, armeijat ratkaisevat tasapelin. */
function teamScore(state, key) {
  let terr = 0, armies = 0;
  for (const id of playableIds(state)) {
    const o = state.territories[id].owner;
    if (o !== null && teamKey(state, o) === key) { terr++; armies += state.territories[id].armies; }
  }
  return terr * 100000 + armies;
}

/** Pehmeän vuororajan täyttyessä: julistaa pisteiden johtajan voittajaksi. */
function declarePointsWinner(state) {
  const aliveKeys = [...new Set(state.players.filter((p) => p.alive).map((p) => teamKey(state, p.index)))];
  if (!aliveKeys.length) return;
  let best = aliveKeys[0], bestScore = -1;
  for (const k of aliveKeys) { const sc = teamScore(state, k); if (sc > bestScore) { bestScore = sc; best = k; } }
  const members = state.players.filter((p, i) => p.alive && teamKey(state, i) === best);
  const lead = members.find((p) => !p.isAI) || members[0];
  state.winner = lead.index;
  state.winnerTeam = state.players[lead.index].team || null;
  state.winByPoints = true;
  state.phase = PHASES.GAMEOVER;
  const teamName = state.teamNames?.[state.winnerTeam] || null;
  const who = (teamName && members.length > 1) ? teamName : lead.name;
  log(state, `Vuororaja saavutettu — ${who} johti pisteissä ja voitti!`, 'win');
}

/** Julistaa pelaajan voittajaksi tavoitteen täyttymisestä. */
function declareMissionWin(state, pi) {
  state.winner = pi;
  state.winnerTeam = state.players[pi].team || null;
  state.winByMission = true;
  state.phase = PHASES.GAMEOVER;
  log(state, `${playerVerb(state.players[pi].name, 'täytti', 'salaisen tavoitteensa ja voitti!')}`, 'win');
}

function checkWin(state) {
  // Missiovoitto: juuri toiminut pelaaja täytti salaisen tavoitteensa.
  if (state.options?.missions) {
    const cur = state.current;
    if (state.players[cur]?.alive && missionComplete(state, cur)) { declareMissionWin(state, cur); return; }
  }
  // Yksi liittouma (tai soolopelaaja) jäljellä → voitto.
  const aliveKeys = new Set(state.players.filter((p) => p.alive).map((p) => teamKey(state, p.index)));
  if (aliveKeys.size === 1) {
    declareWin(state, [...aliveKeys][0], false);
    return;
  }
  // Herruus: yksi liittouma omistaa kaikki avoimet (ei-suljetut) alueet.
  const ownerKeys = new Set(playableIds(state).map((id) => {
    const o = state.territories[id].owner;
    return o === null ? 'nobody' : teamKey(state, o);
  }));
  if (ownerKeys.size === 1 && !ownerKeys.has('nobody')) {
    declareWin(state, [...ownerKeys][0], true);
  }
}

export function endAttack(state) {
  if (state.phase !== PHASES.ATTACK) return { ok: false };
  if (state.pendingConquest) return { ok: false, reason: 'Viimeistele valloitus ensin' };
  state.phase = PHASES.FORTIFY;
  return { ok: true };
}

/** Ovatko a ja b yhdistetyt saman pelaajan alueiden ketjun kautta? */
export function areConnected(state, aId, bId, owner) {
  if (aId === bId) return false;
  const seen = new Set([aId]);
  const queue = [aId];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of TERRITORIES[cur].adj) {
      if (seen.has(n)) continue;
      if (state.territories[n].owner !== owner) continue;
      if (n === bId) return true;
      seen.add(n);
      queue.push(n);
    }
  }
  return false;
}

/** Linnoitus: siirtää armeijoita kahden yhdistetyn oman alueen välillä. */
export function fortify(state, fromId, toId, count) {
  if (state.phase !== PHASES.FORTIFY) return { ok: false, reason: 'Väärä vaihe' };
  const from = state.territories[fromId];
  const to = state.territories[toId];
  if (!from || !to) return { ok: false, reason: 'Virheellinen alue' };
  if (from.owner !== state.current || to.owner !== state.current) return { ok: false, reason: 'Molempien oltava omia' };
  if (count <= 0 || count > from.armies - 1) return { ok: false, reason: 'Vähintään 1 jäätävä' };
  if (!areConnected(state, fromId, toId, state.current)) return { ok: false, reason: 'Alueet eivät yhdistä' };
  from.armies -= count;
  to.armies += count;
  const playerName = state.players[state.current].name;
  log(state, `${playerVerb(playerName, 'siirsi', `${count} armeijaa`)} ${TERRITORIES[fromId].name} → ${TERRITORIES[toId].name}.`, 'fortify');
  endTurn(state);
  return { ok: true };
}

/** Korttipakasta nosto (täydentää poistopakasta tarvittaessa). */
function drawCard(state) {
  if (state.deck.length === 0) {
    state.deck = shuffle(state.discard, state.rng);
    state.discard = [];
  }
  return state.deck.length ? state.deck.pop() : null;
}

export function endTurn(state) {
  if (state.phase === PHASES.GAMEOVER) return { ok: false };
  // Missiovoitto voi täyttyä myös armeijoiden sijoituksesta/siirrosta (esim.
  // "K aluetta ≥2 armeijaa") → tarkista vuoron lopussa ennen vaihtoa.
  if (state.options?.missions && state.players[state.current]?.alive
    && missionComplete(state, state.current)) { declareMissionWin(state, state.current); return { ok: true }; }
  // Kortti, jos valloitti vähintään yhden alueen.
  if (state.conqueredThisTurn) {
    const c = drawCard(state);
    if (c) {
      state.players[state.current].cards.push(c);
      const playerName = state.players[state.current].name;
      log(state, `${playerVerb(playerName, 'sai', 'Risk-kortin.')}`, 'info');
    }
  }
  // Seuraava elossa oleva pelaaja.
  const n = state.players.length;
  let next = state.current;
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n;
    if (state.players[next].alive) break;
  }
  if (next <= state.current) state.turnCount++;
  state.current = next;
  // Pehmeä vuororaja: uuden kierroksen alkaessa yli rajan → pistevoitto.
  const cap = state.options?.maxTurns || 0;
  if (cap > 0 && state.turnCount > cap && state.phase !== PHASES.GAMEOVER) {
    declarePointsWinner(state);
    return { ok: true };
  }
  startReinforcement(state);
  if (state.phase !== PHASES.GAMEOVER) {
    log(state, `${playerVerb(state.players[state.current].name, 'aloittaa', 'vuoron')} (+${state.reinforcements} armeijaa).`, 'turn');
  }
  return { ok: true };
}

/**
 * Soveltaa tasapainotetun blitzin tuloksen pelitilaan.
 * Asettaa armeijat ja käynnistää valloituslogiiikan tarvittaessa.
 */
export function applyBlitzResult(state, fromId, toId, finalAttacker, finalDefender) {
  const from = state.territories[fromId];
  const to = state.territories[toId];
  const defenderIndex = to.owner;
  from.armies = finalAttacker;
  to.armies = finalDefender;
  // Tilastot: koko blitz lasketaan yhdeksi taisteluksi.
  if (finalDefender <= 0) {
    statsFor(state, state.current).battlesWon++;
    if (defenderIndex !== null) statsFor(state, defenderIndex).battlesLost++;
  } else {
    statsFor(state, state.current).battlesLost++;
    if (defenderIndex !== null) statsFor(state, defenderIndex).battlesWon++;
  }
  if (finalDefender <= 0) {
    const minMove = Math.max(1, Math.min(3, finalAttacker - 1));
    const maxMove = finalAttacker - 1;
    state.pendingConquest = { fromId, toId, minMove, maxMove };
    const playerName = state.players[state.current].name;
    log(state, playerVerb(playerName, 'valloitti', `${TERRITORIES[toId].gen}!`), 'attack');
    state.conqueredThisTurn = true;
  }
}

// --- Tallennus ja palautus --------------------------------------------------

/**
 * Muuntaa pelitilan puhtaaksi JSON-yhteensopivaksi objektiksi tallennusta
 * varten. Satunnaislukugeneraattori tallennetaan siemenenä + kutsulaskurina,
 * jotta palautettu peli jatkuu deterministisesti täsmälleen samasta kohdasta.
 */
export function serializeGame(state) {
  return JSON.parse(JSON.stringify({
    v: 1,
    seed: state.seed,
    rngCalls: state.rng?.calls ?? 0,
    mapId: activeMapId,
    scenarioId: state.scenarioId ?? null,
    teamNames: state.teamNames ?? null,
    winnerTeam: state.winnerTeam ?? null,
    options: state.options,
    players: state.players,
    territories: state.territories,
    blizzards: state.blizzards,
    current: state.current,
    phase: state.phase,
    reinforcements: state.reinforcements,
    setsTraded: state.setsTraded,
    conqueredThisTurn: state.conqueredThisTurn,
    deck: state.deck,
    discard: state.discard,
    pendingConquest: state.pendingConquest,
    winner: state.winner,
    turnCount: state.turnCount,
    log: state.log,
    stats: state.stats ?? state.players.map(() => emptyStats()),
  }));
}

/**
 * Palauttaa pelitilan serializeGame-tallennuksesta. Aktivoi tallennetun
 * kartan, luo rng:n samalla siemenellä ja "polttaa" tallennetun määrän
 * arvontoja – peli jatkuu ilman uudelleenarvontaa.
 */
export function restoreGame(saved) {
  if (!saved || typeof saved.seed !== 'number' || !saved.territories || !saved.players) {
    throw new Error('Virheellinen tallennus');
  }
  setActiveMap(saved.mapId || 'classic');
  const data = JSON.parse(JSON.stringify(saved)); // irrota tallennusobjektista
  const rng = makeRng(data.seed);
  const burn = Math.max(0, data.rngCalls | 0);
  for (let i = 0; i < burn; i++) rng();

  const state = {
    seed: data.seed,
    rng,
    options: { fogOfWar: !!data.options?.fogOfWar, blizzard: !!data.options?.blizzard, fixedCards: !!data.options?.fixedCards,
      maxTurns: Number.isFinite(data.options?.maxTurns) ? data.options.maxTurns : 50,
      difficulty: normDiff(data.options?.difficulty), missions: !!data.options?.missions },
    scenarioId: data.scenarioId ?? null,
    teamNames: data.teamNames ?? null,
    winnerTeam: data.winnerTeam ?? null,
    players: data.players,
    territories: data.territories,
    blizzards: data.blizzards || [],
    current: data.current,
    phase: data.phase,
    reinforcements: data.reinforcements,
    setsTraded: data.setsTraded,
    conqueredThisTurn: !!data.conqueredThisTurn,
    deck: data.deck || [],
    discard: data.discard || [],
    pendingConquest: data.pendingConquest ?? null,
    winner: data.winner ?? null,
    turnCount: data.turnCount ?? 1,
    log: data.log || [],
    stats: data.stats || data.players.map(() => emptyStats()),
  };
  // Varmista että kaikki alueet ovat olemassa (tallennus samalta kartalta).
  for (const id of TERRITORY_IDS) {
    if (!state.territories[id]) throw new Error('Tallennus ei vastaa karttaa');
  }
  return state;
}

/** Kevyt tilannekuva UI:lle / debuggaukseen. */
export function snapshot(state) {
  return state.players.map((p) => ({
    name: p.name,
    alive: p.alive,
    territories: ownedBy(state, p.index).length,
    armies: ownedBy(state, p.index).reduce((s, id) => s + state.territories[id].armies, 0),
    cards: p.cards.length,
  }));
}
