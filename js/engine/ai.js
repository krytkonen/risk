// Tekoälyvastustaja. Pelaa kokonaisen vuoron moottorin julkista rajapintaa
// käyttäen: vaihtaa kortit, sijoittaa vahvistukset rajalle, hyökkää
// edullisissa tilanteissa ja linnoittaa sisämaasta rajalle.
//
// runAITurn(state, hooks?) on async: jos hooks annetaan (UI), se odottaa
// niitä animointia varten. Ilman hookeja se suorittaa vuoron synkronisesti
// (käytetään testeissä yhden mikrotaskin sisällä).

import { TERRITORIES } from '../data/territories.js';
import {
  PHASES, ownedBy, placeArmies, endReinforcement, attack, resolveConquest,
  endAttack, fortify, endTurn, tradeCards, mustTradeCards, areConnected, controlledContinents,
} from './game.js';
import { findSet } from './cards.js';

const noop = async () => {};

function enemyNeighbors(state, id, me) {
  return TERRITORIES[id].adj.filter((n) => state.territories[n].owner !== me);
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

function aiReinforce(state) {
  const me = state.current;
  aiTradeCards(state);
  if (state.reinforcements <= 0) return;

  const owned = ownedBy(state, me);
  const borders = owned.filter((id) => isBorder(state, id, me));
  const targets = borders.length ? borders : owned;

  // Valitse hyökkäyskärki: raja-alue, jolta heikointa vihollisnaapuria vastaan
  // saa parhaan ylivoiman. Keskitetään vahvistukset sinne läpimurron takaamiseksi.
  let spearhead = targets[0];
  let bestScore = -Infinity;
  for (const id of targets) {
    const weakest = weakestEnemyNeighbor(state, id, me);
    const own = state.territories[id].armies;
    // Suosi pehmeää kohdetta (pieni weakest) ja olemassa olevaa voimaa.
    const score = own - (isFinite(weakest) ? weakest : 0);
    if (score > bestScore) { bestScore = score; spearhead = id; }
  }
  placeArmies(state, spearhead, state.reinforcements);
}

// --- Hyökkäys -------------------------------------------------------------

function bestAttack(state) {
  const me = state.current;
  let best = null;
  for (const fromId of ownedBy(state, me)) {
    const from = state.territories[fromId];
    if (from.armies < 2) continue;
    for (const toId of TERRITORIES[fromId].adj) {
      const to = state.territories[toId];
      if (to.owner === me) continue;
      const advantage = from.armies - to.armies;
      // Hyökkää aina kun on ylivoima (myös pieni): keskitetty kärki etenee.
      if (advantage >= 1) {
        const score = advantage + (to.armies <= 2 ? 1 : 0);
        if (!best || score > best.score) best = { fromId, toId, score };
      }
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
