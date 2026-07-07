// Tekoälyvastustaja. Pelaa kokonaisen vuoron moottorin julkista rajapintaa
// käyttäen: vaihtaa kortit, sijoittaa vahvistukset rajalle, hyökkää
// edullisissa tilanteissa ja linnoittaa sisämaasta rajalle.
//
// runAITurn(state, hooks?) on async: jos hooks annetaan (UI), se odottaa
// niitä animointia varten. Ilman hookeja se suorittaa vuoron synkronisesti
// (käytetään testeissä yhden mikrotaskin sisällä).

import { TERRITORIES, CONTINENTS, continentTerritories } from '../data/territories.js';
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

// --- Kenraali-tason apurit (puolustettavuus + korttisaalis) ----------------

// Mantereen ELÄVÄT KAPEIKOT: sen alueet joita voi juuri nyt hyökätä ulkoa.
// Vähemmän kapeikkoja = vähemmän puolustettavaa rajaa = helpompi pitää.
// LUMIMYRSKY-tietoinen: suljettua aluetta ei voi hyökätä (ei elävä raja) eikä
// suljetusta naapurista käsin → myrsky voi tehdä mantereesta hetkellisesti
// paljon puolustettavamman. (Myrskyttä tämä = staattinen rajajoukko.)
function continentChokes(state, contId) {
  const ids = continentTerritories(contId);
  const inside = new Set(ids);
  return ids.filter((id) => !isBlizzard(state, id)
    && TERRITORIES[id].adj.some((n) => !inside.has(n) && !isBlizzard(state, n)));
}

// Mantereen puolustettavuus: bonus per elävä kapeikko. Australia (2/1) >> Aasia (7/monta).
function continentDefensibility(state, contId) {
  return CONTINENTS[contId].bonus / Math.max(1, continentChokes(state, contId).length);
}

// Valitse KOHDEMANNER jota rakentaa/pitää: puolustettavin manner johon minulla on
// jalansija (omistan siitä osan tai rajoitun siihen). Painotus: puolustettavuus ×
// (edistyminen), lievä suosinta pienemmälle mantereelle (vähemmän valloitettavaa).
function pickTargetContinent(state, me) {
  let best = null, bestScore = -Infinity;
  for (const c of Object.keys(CONTINENTS)) {
    const terrs = continentTerritories(c);
    const ownedCount = terrs.filter((id) => state.territories[id].owner === me).length;
    const foothold = ownedCount > 0
      || terrs.some((id) => TERRITORIES[id].adj.some((n) => state.territories[n].owner === me));
    if (!foothold) continue;
    const prog = ownedCount / terrs.length;
    const score = continentDefensibility(state, c) * (0.4 + prog) - terrs.length * 0.05;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Etsi ELIMINOITAVA korttien haltija: elossa oleva vastustaja jolla on kortteja
// ja jonka KAIKKI alueet voi uskottavasti vallata tällä vuorolla (rajallani on
// riittävä ylivoima). Korttisaalis (3+) mahdollistaa heti uuden sarjanvaihdon.
function pickKillTarget(state, me) {
  let best = null, bestScore = 0;
  for (const p of state.players) {
    if (!p.alive || p.index === me || sameTeam(state, me, p.index)) continue;
    if (!p.cards || p.cards.length === 0) continue; // vain kortilliset houkuttavat
    const terrs = ownedBy(state, p.index);
    if (!terrs.length || terrs.length > 5) continue; // liian iso = ei tapeta yhdessä vuorossa
    const pset = new Set(terrs);
    let myForce = 0;
    for (const id of ownedBy(state, me)) {
      if (TERRITORIES[id].adj.some((n) => pset.has(n))) myForce += Math.max(0, state.territories[id].armies - 1);
    }
    const pArmies = terrs.reduce((s, id) => s + state.territories[id].armies, 0);
    // Karkea toteutettavuus: hyökkäysvoimani riittää murtamaan kaikki + jättämään
    // miehityksen. Marginaali 1.15 kattaa noppatappiot.
    if (myForce < (pArmies + terrs.length) * 1.15) continue;
    const score = p.cards.length * 10 + (myForce - pArmies);
    if (score > bestScore) { bestScore = score; best = p.index; }
  }
  return best;
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

  // KENRAALI: puolustettavuus- ja korttisaalis-tietoinen keskitys (oma haara).
  if (diff === 'kenraali') { aiReinforceKenraali(state, me, owned, targets); return; }

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

// KENRAALI: (1) jos kortillinen vastustaja on tapettavissa tällä vuorolla,
// keskitä kärki häntä vasten (korttisaalis). Muuten (2) rakenna/pidä
// PUOLUSTETTAVIN manner: rakennusvaiheessa työnnä sen viholliskapeikkoihin,
// pito­vaiheessa PINOA uhatuin kapeikko ja laajenna loput puolustettavuuden
// suuntaan. Lumimyrsky huomioidaan elävien kapeikkojen kautta.
function aiReinforceKenraali(state, me, owned, targets) {
  // (1) Korttisaalis: keskitä kärki tapettavan pelaajan heikoimpaan rajaan.
  const kill = state._kenraaliKill;
  if (kill != null) {
    const killSet = new Set(ownedBy(state, kill));
    let spearhead = null, bestS = -Infinity;
    for (const id of owned) {
      const adjKill = TERRITORIES[id].adj.filter((n) => killSet.has(n) && !isBlizzard(state, n));
      if (!adjKill.length) continue;
      const weakest = Math.min(...adjKill.map((n) => state.territories[n].armies));
      const score = state.territories[id].armies - weakest;
      if (score > bestS) { bestS = score; spearhead = id; }
    }
    if (spearhead) { placeArmies(state, spearhead, state.reinforcements); return; }
  }

  // (2) Puolustettavin manner.
  const target = pickTargetContinent(state, me);
  const targetTerrs = target ? continentTerritories(target) : [];
  const holdTarget = target && targetTerrs.length
    && targetTerrs.every((id) => state.territories[id].owner === me);

  if (holdTarget) {
    // Pidä mutta ÄLÄ turtlaa: varaa vain sen verran että uhatuin ELÄVÄ kapeikko
    // pysyy vahvempana kuin sen vihollispaine; LOPUT laajennukseen (lumipallo).
    const chokes = continentChokes(state, target).filter((id) => isBorder(state, id, me));
    const worst = chokes
      .map((id) => ({ id, deficit: enemyPressure(state, id, me) - state.territories[id].armies }))
      .sort((a, b) => b.deficit - a.deficit)[0];
    if (worst && worst.deficit > 0) {
      const reserve = Math.min(state.reinforcements - 1, worst.deficit + 1);
      if (reserve > 0) placeArmies(state, worst.id, reserve);
    }
    if (state.reinforcements > 0) placeArmies(state, defensibleSpearhead(state, me, targets), state.reinforcements);
    return;
  }

  // Rakenna: kärki = oma raja joka rajoittuu KOHDEMANTEREEN viholliseen (koste-
  // taan siihen); muuten paras puolustettavuuskärki.
  const tset = new Set(targetTerrs);
  let spearhead = null, bestS = -Infinity;
  for (const id of targets) {
    const intoTarget = TERRITORIES[id].adj.some((n) => tset.has(n)
      && state.territories[n].owner !== me && !isBlizzard(state, n));
    const w = weakestEnemyNeighbor(state, id, me);
    const score = state.territories[id].armies - (isFinite(w) ? w : 0) + (intoTarget ? 8 : 0);
    if (score > bestS) { bestS = score; spearhead = id; }
  }
  placeArmies(state, spearhead || defensibleSpearhead(state, me, targets), state.reinforcements);
}

// Kärki joka maksimoi ylivoiman + puolustettavan mantereen edistymisen.
function defensibleSpearhead(state, me, targets) {
  let best = targets[0], bestScore = -Infinity;
  for (const id of targets) {
    const w = weakestEnemyNeighbor(state, id, me);
    let score = state.territories[id].armies - (isFinite(w) ? w : 0);
    let pull = 0;
    for (const n of enemyNeighbors(state, id, me)) {
      const c = TERRITORIES[n].continent;
      const terrs = continentTerritories(c);
      const prog = terrs.filter((t) => state.territories[t].owner === me).length / terrs.length;
      pull = Math.max(pull, prog * continentDefensibility(state, c));
    }
    score += pull * 4;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

// --- Hyökkäys -------------------------------------------------------------

export function bestAttack(state) {
  const me = state.current;
  const diff = difficultyOf(state);
  // HELPPO hyökkää vain selvällä ylivoimalla (>=3) eikä osaa arvostaa
  // mannerbonusta → jättää monta hyvää valtausta tekemättä. VAIKEA/NORMAALI
  // hyökkää jo pienellä ylivoimalla.
  const minAdvantage = diff === 'helppo' ? 3 : 1;
  const hard = diff === 'vaikea' || diff === 'kenraali'; // kertoimet + eliminointi
  const kill = diff === 'kenraali' ? state._kenraaliKill : null;
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
        if (completes) score += (hard ? 8 : 4); // vahvat tasot painottavat bonusta enemmän
      }
      if (hard) {
        // Käytä oikeaa voittotodennäköisyyttä: älä tuhlaa joukkoja huonoihin
        // kertoimiin, ja priorisoi vihollisen ELIMINOINTI (viimeinen alue) →
        // kaappaa hänen korttinsa ja poistaa vastustajan.
        const wp = calcBlitzWinProb(from.armies, to.armies);
        if (wp < 0.4) continue;
        const defenderLast = to.owner != null && ownedBy(state, to.owner).length === 1;
        score += wp * 3 + (defenderLast ? 5 : 0);
      }
      // KENRAALI: priorisoi tapettavan korttien haltijan alueita (korttisaalis).
      if (kill != null && to.owner === kill) score += 6;
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
  const diff = difficultyOf(state);
  const owned = ownedBy(state, me);
  if (diff === 'kenraali') return aiFortifyKenraali(state, me, owned);
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

// KENRAALI: keskitä puolustus. Kohde = uhatuin raja-alue (suurin vajaus).
// Lähde = mikä tahansa yhdistetty oma alue jolla suurin "vapaa" ylijäämä (myös
// matalapaineinen raja käy → hylätään turvattomat reunat ja pinotaan kapeikko).
function aiFortifyKenraali(state, me, owned) {
  const borders = owned.filter((id) => isBorder(state, id, me));
  if (!borders.length) return null;
  const dest = borders
    .map((id) => ({ id, deficit: enemyPressure(state, id, me) - state.territories[id].armies }))
    .sort((a, b) => b.deficit - a.deficit)[0].id;
  const surplus = (id) => state.territories[id].armies - 1 - enemyPressure(state, id, me) * 0.5;
  const sources = owned
    .filter((id) => id !== dest && state.territories[id].armies > 1 && areConnected(state, id, dest, me))
    .sort((a, b) => surplus(b) - surplus(a));
  for (const src of sources) {
    const move = state.territories[src].armies - 1;
    if (move > 0) return fortify(state, src, dest, move);
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

  // KENRAALI: valitse vuoron alussa mahdollinen tapettava korttien haltija.
  // Transientti (ei serialisoida) — vahvistus ja hyökkäys lukevat tämän.
  state._kenraaliKill = difficultyOf(state) === 'kenraali' ? pickKillTarget(state, state.current) : null;

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
