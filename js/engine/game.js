// Risk-pelin ydinlogiikka: pelitila, vuorovaiheet (vahvistus, hyökkäys,
// linnoitus), vahvistuslaskenta, valloitus, pelaajan putoaminen ja
// voittoehto. Puhdas moduuli – ei DOM-riippuvuuksia, testattavissa Nodella.

import { TERRITORIES, TERRITORY_IDS, CONTINENTS, continentTerritories } from '../data/territories.js';
import { makeRng, randomSeed } from './rng.js';
import { resolveAttack } from './combat.js';
import { buildDeck, shuffle, setValue, isValidSet } from './cards.js';

export const PHASES = { REINFORCE: 'reinforce', ATTACK: 'attack', FORTIFY: 'fortify', GAMEOVER: 'gameover' };

// Aloitusarmeijat pelaajamäärän mukaan (klassinen Risk).
const STARTING_ARMIES = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };

export function startingArmiesFor(playerCount) {
  return STARTING_ARMIES[playerCount] ?? Math.max(20, 50 - playerCount * 5);
}

// ---------------------------------------------------------------------------
// Verbien taivutusapu (2. persoona yksikkö, mennyt aika)
// ---------------------------------------------------------------------------

/** Taivutuskartta: 3. persoona → 2. persoona menneessä ajassa */
const VERB_2ND = {
  'valloitti': 'valloitit',
  'sai': 'sait',
  'siirsi': 'siirsit',
  'putosi': 'putosit',
};

/**
 * Muodostaa lokiviestin jossa pelaajan nimi on subjektina.
 * Jos pelaajan nimi on 'Sinä', käytetään 2. persoonan taivutusta.
 * @param {string} playerName pelaajan nimi
 * @param {string} verb verbi 3. persoonassa (esim. 'valloitti')
 * @param {string} rest lauseen loppuosa
 */
function playerVerb(playerName, verb, rest) {
  if (playerName === 'Sinä') {
    const v2 = VERB_2ND[verb] || verb;
    return `${playerName} ${v2} ${rest}`;
  }
  return `${playerName} ${verb} ${rest}`;
}

/**
 * Luo uuden pelin.
 * @param {{players: {name:string,color:string,isAI:boolean}[], seed?:number}} opts
 */
export function createGame({ players, seed }) {
  if (!players || players.length < 2 || players.length > 6) {
    throw new Error('Pelaajia oltava 2–6');
  }
  const usedSeed = seed ?? randomSeed();
  const rng = makeRng(usedSeed);

  const state = {
    seed: usedSeed,
    rng,
    players: players.map((p, i) => ({
      index: i,
      name: p.name,
      color: p.color,
      isAI: !!p.isAI,
      cards: [],
      alive: true,
    })),
    territories: {},
    current: 0,
    phase: PHASES.REINFORCE,
    reinforcements: 0,
    setsTraded: 0,
    conqueredThisTurn: false,
    deck: [],
    discard: [],
    pendingConquest: null,
    winner: null,
    turnCount: 1,
    log: [],
  };

  for (const id of TERRITORY_IDS) state.territories[id] = { owner: null, armies: 0 };

  state.deck = shuffle(buildDeck(TERRITORY_IDS), rng);
  distributeTerritories(state);
  deployStartingArmies(state);

  state.current = 0;
  startReinforcement(state);
  log(state, `Peli alkaa. ${state.players[state.current].name} aloittaa.`, 'info');
  return state;
}

// --- Alkujako -------------------------------------------------------------

function distributeTerritories(state) {
  const ids = shuffle([...TERRITORY_IDS], state.rng);
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

export function ownedBy(state, playerIndex) {
  return TERRITORY_IDS.filter((id) => state.territories[id].owner === playerIndex);
}

export function log(state, msg, type = 'info') {
  state.log.push({ msg, type, turn: state.turnCount });
  if (state.log.length > 200) state.log.shift();
}

/** Vahvistusten määrä pelaajalle: max(3, alueet/3) + mannerbonukset. */
export function calcReinforcements(state, playerIndex) {
  const owned = ownedBy(state, playerIndex);
  let n = Math.max(3, Math.floor(owned.length / 3));
  for (const contId of Object.keys(CONTINENTS)) {
    const terrs = continentTerritories(contId);
    if (terrs.every((t) => state.territories[t].owner === playerIndex)) {
      n += CONTINENTS[contId].bonus;
    }
  }
  return n;
}

/** Mantereet jotka pelaaja hallitsee kokonaan. */
export function controlledContinents(state, playerIndex) {
  return Object.keys(CONTINENTS).filter((contId) =>
    continentTerritories(contId).every((t) => state.territories[t].owner === playerIndex)
  );
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

  const bonus = setValue(state.setsTraded);
  state.setsTraded++;
  state.reinforcements += bonus;

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

  log(state, `${player.name} vaihtoi korttisarjan: +${bonus} armeijaa${territoryBonus ? ` (+${territoryBonus} aluebonus)` : ''}.`, 'info');
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
  if (from.owner !== state.current) return false;
  if (to.owner === state.current) return false;
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
  const attackerDiceUsed = Math.min(3, from.armies - 1);
  const r = resolveAttack(state, fromId, toId, state.rng);

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
  log(state, `${loser.name} putosi pelistä! ${playerVerb(conqueror.name, 'sai', 'kortit.')}`, 'eliminate');
}

function checkWin(state) {
  const alive = state.players.filter((p) => p.alive);
  if (alive.length === 1) {
    state.winner = alive[0].index;
    state.phase = PHASES.GAMEOVER;
    log(state, `${alive[0].name} voitti pelin!`, 'win');
    return;
  }
  // Maailmanherruus: yksi pelaaja omistaa kaikki alueet.
  const owners = new Set(TERRITORY_IDS.map((id) => state.territories[id].owner));
  if (owners.size === 1) {
    const w = [...owners][0];
    state.winner = w;
    state.phase = PHASES.GAMEOVER;
    log(state, `${state.players[w].name} hallitsee maailmaa!`, 'win');
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
  startReinforcement(state);
  if (state.phase !== PHASES.GAMEOVER) {
    log(state, `${state.players[state.current].name} aloittaa vuoron (+${state.reinforcements} armeijaa).`, 'turn');
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
  from.armies = finalAttacker;
  to.armies = finalDefender;
  if (finalDefender <= 0) {
    const minMove = Math.max(1, Math.min(3, finalAttacker - 1));
    const maxMove = finalAttacker - 1;
    state.pendingConquest = { fromId, toId, minMove, maxMove };
    const playerName = state.players[state.current].name;
    log(state, playerVerb(playerName, 'valloitti', `${TERRITORIES[toId].gen}!`), 'attack');
    state.conqueredThisTurn = true;
  }
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
