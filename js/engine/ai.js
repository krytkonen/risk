// Tekoälyvastustaja. Pelaa kokonaisen vuoron moottorin julkista rajapintaa
// käyttäen: vaihtaa kortit, sijoittaa vahvistukset rajalle, hyökkää
// edullisissa tilanteissa ja linnoittaa sisämaasta rajalle.
//
// runAITurn(state, hooks?) on async: jos hooks annetaan (UI), se odottaa
// niitä animointia varten. Ilman hookeja se suorittaa vuoron synkronisesti
// (käytetään testeissä yhden mikrotaskin sisällä).

import { TERRITORIES, continentTerritories } from '../data/territories.js';
import {
  PHASES, ownedBy, placeArmies, endReinforcement, attack, resolveConquest,
  endAttack, fortify, endTurn, tradeCards, mustTradeCards, areConnected, controlledContinents,
  isBlizzard, sameTeam,
} from './game.js';
import { findSet } from './cards.js';
import { calcBlitzWinProb } from './combat.js';

const noop = async () => {};

// Nykyisen AI-pelaajan vaikeustaso (per-pelaaja, oletus pelin optiosta).
function difficultyOf(state) {
  const p = state.players[state.current];
  return p?.difficulty || state.options?.difficulty || 'normaali';
}

// Vihollisnaapurit: ei lumimyrskyn sulkemia eikä omia/liittolaisten alueita.
function enemyNeighbors(state, id, me) {
  return TERRITORIES[id].adj.filter((n) =>
    !isBlizzard(state, n) &&
    state.territories[n].owner !== me &&
    !sameTeam(state, me, state.territories[n].owner));
}
function isBorder(state, id, me) {
  return enemyNeighbors(state, id, me).length > 0;
}
function enemyPressure(state, id, me) {
  return enemyNeighbors(state, id, me).reduce((s, n) => s + state.territories[n].armies, 0);
}

// --- Vahvistus ------------------------------------------------------------

function weakestEnemyNeighbor(state, id, me) {
  const vals = enemyNeighbors(state, id, me).map((n) => state.territories[n].armies);
  return vals.length ? Math.min(...vals) : Infinity;
}

function aiTradeCards(state) {
  // Vaihda sarja heti kun sellainen on koossa: "escalating"-arvon vuoksi
  // korttien pitäminen ei kannata, ja jatkuva armeijavirta murtaa pattitilanteet.
  while (true) {
    const set = findSet(state.players[state.current].cards);
    if (!set) break;
    if (!tradeCards(state, set).ok) break;
  }
}

export function aiReinforce(state) {
  const me = state.current;
  const diff = difficultyOf(state);
  aiTradeCards(state);
  if (state.reinforcements <= 0) return;

  const owned = ownedBy(state, me);
  const borders = owned.filter((id) => isBorder(state, id, me));
  const targets = borders.length ? borders : owned;

  // HELPPO: hajota vahvistukset tasan kaikille raja-alueille → ei keskitettyä
  // hyökkäyskärkeä → offensiivi jää heikoksi ja peli on ihmiselle voitettava.
  if (diff === 'helppo') {
    let i = 0;
    while (state.reinforcements > 0) { placeArmies(state, targets[i % targets.length], 1); i++; }
    return;
  }

  // VAIKEA: varaa puolustusosuus uhatuimmalle rajalle jos vihollispaine ylittää
  // oman voiman selvästi → ei menetä alueita heikkoon selustaan. Loput kärkeen.
  if (diff === 'vaikea') {
    let guardId = null, worst = 0;
    for (const id of targets) {
      const deficit = enemyPressure(state, id, me) - state.territories[id].armies;
      if (deficit > worst) { worst = deficit; guardId = id; }
    }
    if (guardId && worst > 2) {
      const reserve = Math.min(state.reinforcements - 1, Math.ceil(worst / 2));
      if (reserve > 0) placeArmies(state, guardId, reserve);
    }
  }

  // NORMAALI & VAIKEA: keskitä loput yhteen kärkeen. Kärki = raja-alue jolta saa
  // parhaan ylivoiman heikointa vihollisnaapuria vastaan → varma läpimurto.
  // VAIKEA lisää mannerprogressin: suosii kärkeä joka johtaa mantereeseen jonka
  // se omistaa jo suurelta osin → viimeistelee bonukset nopeasti → lumipallo.
  let spearhead = targets[0];
  let bestScore = -Infinity;
  for (const id of targets) {
    const weakest = weakestEnemyNeighbor(state, id, me);
    const own = state.territories[id].armies;
    let score = own - (isFinite(weakest) ? weakest : 0);
    if (diff === 'vaikea') {
      let bestProg = 0;
      for (const n of enemyNeighbors(state, id, me)) {
        const terrs = continentTerritories(TERRITORIES[n].continent);
        const ownedCount = terrs.filter((c) => state.territories[c].owner === me).length;
        bestProg = Math.max(bestProg, ownedCount / terrs.length);
      }
      score += bestProg * 12; // painota vahvasti mantereen viimeistelyä (lumipallo)
    }
    if (score > bestScore) { bestScore = score; spearhead = id; }
  }
  placeArmies(state, spearhead, state.reinforcements);
}

// --- Hyökkäys -------------------------------------------------------------

export function bestAttack(state) {
  const me = state.current;
  const diff = difficultyOf(state);
  // HELPPO hyökkää vain selvällä ylivoimalla (>=3) eikä osaa arvostaa
  // mannerbonusta → jättää monta hyvää valtausta tekemättä. VAIKEA/NORMAALI
  // hyökkää jo pienellä ylivoimalla.
  const minAdvantage = diff === 'helppo' ? 3 : 1;
  let best = null;
  for (const fromId of ownedBy(state, me)) {
    const from = state.territories[fromId];
    if (from.armies < 2) continue;
    for (const toId of TERRITORIES[fromId].adj) {
      if (isBlizzard(state, toId)) continue; // suljettua maastoa ei voi vallata
      const to = state.territories[toId];
      if (to.owner === me) continue;
      if (sameTeam(state, me, to.owner)) continue; // liittolaiseen ei kosketa
      const advantage = from.armies - to.armies;
      if (advantage < minAdvantage) continue;
      let score = advantage + (to.armies <= 2 ? 1 : 0);
      if (diff !== 'helppo') {
        // Manner-bonus: jos tämä valtaus VIIMEISTELISI mantereen (kaikki muut
        // sen alueet jo omia), suosi vahvasti — bonusarmeijat ovat iso etu.
        const cont = TERRITORIES[toId].continent;
        const completes = continentTerritories(cont)
          .every((c) => c === toId || state.territories[c].owner === me);
        if (completes) score += (diff === 'vaikea' ? 8 : 4); // Vaikea painottaa bonusta enemmän
      }
      if (diff === 'vaikea') {
        // Käytä oikeaa voittotodennäköisyyttä: älä tuhlaa joukkoja huonoihin
        // kertoimiin, ja priorisoi vihollisen ELIMINOINTI (viimeinen alue) →
        // kaappaa hänen korttinsa ja poistaa vastustajan.
        const wp = calcBlitzWinProb(from.armies, to.armies);
        if (wp < 0.4) continue;
        const defenderLast = to.owner != null && ownedBy(state, to.owner).length === 1;
        score += wp * 3 + (defenderLast ? 5 : 0);
      }
      if (!best || score > best.score) best = { fromId, toId, score };
    }
  }
  return best;
}

async function aiAttack(state, hooks) {
  const me = state.current;
  let guard = 0;
  while (guard++ < 40) {
    const a = bestAttack(state);
    if (!a) break;
    const res = attack(state, a.fromId, a.toId);
    if (!res.ok) break;
    await hooks.afterAttack(a, res);
    if (state.pendingConquest) {
      const pc = state.pendingConquest;
      const from = state.territories[pc.fromId];
      // Jätä selustaan puolustus jos lähtöalue on yhä rajalla, muuten työnnä
      // kaikki eteenpäin.
      const sourceStillBorder = enemyNeighbors(state, pc.fromId, me).length > 0;
      let move = sourceStillBorder
        ? Math.max(pc.minMove, Math.floor(from.armies / 2))
        : from.armies - 1;
      move = Math.min(Math.max(move, pc.minMove), pc.maxMove);
      resolveConquest(state, move);
      await hooks.afterConquest(pc);
      if (state.phase === PHASES.GAMEOVER) return;
    }
  }
}

// --- Linnoitus ------------------------------------------------------------

function aiFortify(state) {
  const me = state.current;
  const owned = ownedBy(state, me);
  // Lähde: sisämaa-alue (ei vihollisnaapureita) jolla eniten ylimääräisiä joukkoja.
  const sources = owned
    .filter((id) => !isBorder(state, id, me) && state.territories[id].armies > 1)
    .sort((a, b) => state.territories[b].armies - state.territories[a].armies);
  const borders = owned.filter((id) => isBorder(state, id, me));
  for (const src of sources) {
    // Kohde: yhdistetty raja-alue jolla suurin paine.
    const dests = borders
      .filter((d) => d !== src && areConnected(state, src, d, me))
      .sort((a, b) => enemyPressure(state, b, me) - enemyPressure(state, a, me));
    if (dests.length) {
      const move = state.territories[src].armies - 1;
      return fortify(state, src, dests[0], move); // fortify päättää vuoron
    }
  }
  return null;
}

// --- Koko vuoro -----------------------------------------------------------

export async function runAITurn(state, hooks = {}) {
  const h = {
    afterReinforce: hooks.afterReinforce || noop,
    afterAttack: hooks.afterAttack || noop,
    afterConquest: hooks.afterConquest || noop,
    afterFortify: hooks.afterFortify || noop,
  };
  if (state.phase === PHASES.GAMEOVER) return;

  aiReinforce(state);
  await h.afterReinforce();
  endReinforcement(state);
  if (state.phase === PHASES.GAMEOVER) return;

  await aiAttack(state, h);
  if (state.phase === PHASES.GAMEOVER) return;
  endAttack(state);

  const fortified = aiFortify(state);
  await h.afterFortify();
  if (!fortified) endTurn(state); // jos ei linnoitettu, päätä vuoro silti
}
