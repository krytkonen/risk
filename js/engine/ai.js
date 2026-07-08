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

// LAAJENNUSKOHDE: manner jota kohti vallata seuraavaksi. Karttaa ANALYSOIDEN
// (ei kartta­kohtaisia sääntöjä): suosii mannerta jonka voin VIIMEISTELLÄ
// HALVIMMALLA JA PIAN (bonustulo lumipalloa varten) ja joka on PUOLUSTETTAVA
// (bonus/kapeikot). Painot: viimeistelyn läheisyys (prog), harvat & heikot
// jäljellä olevat viholliset, puolustettavuus.
function pickExpansionTarget(state, me) {
  let best = null, bestScore = -Infinity;
  for (const c of Object.keys(CONTINENTS)) {
    const terrs = continentTerritories(c);
    const remaining = terrs.filter((id) => state.territories[id].owner !== me);
    if (!remaining.length) continue; // jo hallussa → ei laajennuskohde
    const foothold = (terrs.length - remaining.length) > 0
      || terrs.some((id) => TERRITORIES[id].adj.some((n) => state.territories[n].owner === me
        && !isBlizzard(state, n)));
    if (!foothold) continue;
    const prog = (terrs.length - remaining.length) / terrs.length;
    const remArmies = remaining.reduce((s, id) => s + state.territories[id].armies, 0);
    // LUMIMYRSKY: suljettuja jäljellä olevia alueita EI voi vallata nyt → manner
    // ei ole viimeisteltävissä ennen kuin myrsky siirtyy. Rankaise → suosi
    // mannerta jonka voi VIEDÄ LOPPUUN heti (karttaa analysoiden).
    const blocked = remaining.filter((id) => isBlizzard(state, id)).length;
    const fullyBlocked = blocked === remaining.length; // ei yhtään vallattavaa nyt
    // Halpa & pian valmis & AVOIN + puolustettava = paras lumipallon moottori.
    const score = continentDefensibility(state, c) * (1 + prog * 2)
      - remaining.length * 0.6 - remArmies * 0.12 - (fullyBlocked ? 5 : 0);
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
    const terrs = ownedBy(state, p.index);
    if (!terrs.length || terrs.length > 6) continue; // liian iso = ei tapeta yhdessä vuorossa
    const pset = new Set(terrs);
    let myForce = 0;
    for (const id of ownedBy(state, me)) {
      if (TERRITORIES[id].adj.some((n) => pset.has(n))) myForce += Math.max(0, state.territories[id].armies - 1);
    }
    const pArmies = terrs.reduce((s, id) => s + state.territories[id].armies, 0);
    // Toteutettavuus: hyökkäysvoimani riittää murtamaan kaikki + miehitykseen.
    if (myForce < (pArmies + terrs.length) * 1.15) continue;
    // Eliminointi kannattaa AINA (poistaa kilpailijan + valtaa alueita); kortit ja
    // helppo murto ovat lisäbonus. Vain toteutettavat kohteet hyväksytään.
    const cards = (p.cards || []).length;
    const score = cards * 10 + (myForce - pArmies) + (6 - terrs.length) * 2;
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

function strongestEnemyNeighbor(state, id, me) {
  const vals = enemyNeighbors(state, id, me).map((n) => state.territories[n].armies);
  return vals.length ? Math.max(...vals) : 0;
}

// Onko koko manner pelaajan pi hallussa? (bonuksen kieltämisen arviointiin)
function aiOwnsContinent(state, pi, contId) {
  return continentTerritories(contId).every((id) => state.territories[id].owner === pi);
}

// GARRISON: poista ILMAISET LÄPIMURROT (ihmispelaajan hyödyntämä heikkous:
// "joka alueella vain 1 joukko"). Kaksi vaihetta annetun budjetin sisällä:
//  1) nosta JOKAINEN 1-joukon raja vähintään 2:een (halpa, tappaa cascade-reitit),
//  2) paikkaa suurimmat vajeet kohti vahvinta viereistä vihollispinoa.
// Loput vahvistuksista jää hyökkäyskärkeen.
function garrisonBorders(state, me, borders, budgetFrac) {
  let budget = Math.floor(state.reinforcements * budgetFrac);
  if (budget <= 0 || !borders.length) return;
  // Vaihe 1: ei yhtään 1-joukon rajaa (uhatuimmat ensin).
  const ones = borders
    .filter((id) => state.territories[id].armies < 2)
    .sort((a, b) => strongestEnemyNeighbor(state, b, me) - strongestEnemyNeighbor(state, a, me));
  for (const id of ones) {
    if (budget <= 0) break;
    placeArmies(state, id, 1); budget--;
  }
  // Vaihe 2: paikkaa jäljelle jäävät vajeet.
  if (budget <= 0) return;
  const needs = borders
    .map((id) => ({ id, need: strongestEnemyNeighbor(state, id, me) + 1 - state.territories[id].armies }))
    .filter((x) => x.need > 0)
    .sort((a, b) => b.need - a.need);
  for (const { id, need } of needs) {
    if (budget <= 0) break;
    const give = Math.min(need, budget);
    if (give > 0) { placeArmies(state, id, give); budget -= give; }
  }
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
  // Turvaverkko: ilman alueita ei ole minne sijoittaa. Estää helppo-haaran
  // while-silmukan jumiutumisen (targets[i % 0] → undefined ei vähennä
  // vahvistuksia → PWA jäätyisi) jos current omistaa 0 aluetta.
  if (!targets.length) return;

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

  // (2) GARRISON ENSIN: puolusta koko perimeter niin ettei jää ilmaisia
  // läpimurtoja. Enintään puolet vahvistuksista → loput hyökkäyskärkeen.
  const borders = owned.filter((id) => isBorder(state, id, me));
  garrisonBorders(state, me, borders, 0.2);
  if (state.reinforcements <= 0) return;

  // (3) Loput yhteen hyökkäyskärkeen joka parhaiten TUNKEUTUU LAAJENNUSKOHTEESEEN
  // (sama manner jota hyökkäys viimeistelee → keskitetty voima tukee suoraan
  // valtausta, ei hajaannu). Jos kohdetta ei ole (harvinaista), laajenna
  // puolustettavuuden suuntaan.
  const tgt = state._kenraaliTarget;
  if (!tgt) { placeArmies(state, defensibleSpearhead(state, me, targets), state.reinforcements); return; }
  const tset = new Set(continentTerritories(tgt));
  let spearhead = null, bestS = -Infinity;
  for (const id of targets) {
    const intoTarget = TERRITORIES[id].adj.some((n) => tset.has(n)
      && state.territories[n].owner !== me && !isBlizzard(state, n));
    const w = weakestEnemyNeighbor(state, id, me);
    const score = state.territories[id].armies - (isFinite(w) ? w : 0) + (intoTarget ? 10 : 0);
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
  // KENRAALI, PULLONKAULA-DOKTRIINI (vain moninpelissä ≥3 elossa; 2p:ssä yksi
  // rintama → aggressiivinen lumipallo parempi): valtaa VAIN laajennuskohdetta
  // (puolustettava manner) kohti ja PYSÄHDY sen kapeikkoihin. Poikkeukset joita
  // saa vallata muualtakin: vihollisen KOKO mantereen rikkominen (kiellä bonus)
  // ja tapettavan korttien haltijan alueet (korttisaalis).
  const multiplayer = state.players.filter((p) => p.alive).length > 2;
  const tgt = (diff === 'kenraali' && multiplayer) ? state._kenraaliTarget : null;
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
        // kaappaa hänen korttinsa ja poistaa vastustajan. KENRAALI on tiukempi
        // (≥0.55): ei vuoda pinojaan tasaväkisiin taisteluihin → paksummat rajat.
        const wp = calcBlitzWinProb(from.armies, to.armies);
        // KENRAALI, KORTTITALOUS: kunnes tämän vuoron kortti on ansaittu (≥1
        // valtaus), hyökkää herkemmin (≥0.45) → varmista kortti joka vuoro
        // (kasvava sarjabonus on Riskin suurin voimavara). Kortin jälkeen tiukka
        // (≥0.55) → säilytä pinot paksuina rajoina.
        // KENRAALI kynnys: LAAJENNUSKOHTEESEEN (kohdemanner) tunkeudutaan
        // ROHKEASTI (0.4) — bonustulon vuoksi riskin arvoinen ja avaa pääsyn
        // seuraaviin mantereisiin. Muualle vasta KORTIN JÄLKEEN kuria­llisemmin
        // (0.46) → korttitalous joka vuoro ilman turhaa pinojen tuhlausta.
        const intoTgt = tgt && TERRITORIES[toId].continent === tgt;
        const wpFloor = diff === 'kenraali'
          ? (intoTgt ? 0.4 : (state.conqueredThisTurn ? 0.46 : 0.4))
          : 0.4;
        if (wp < wpFloor) continue;
        const defenderLast = to.owner != null && ownedBy(state, to.owner).length === 1;
        score += wp * 3 + (defenderLast ? 5 : 0);
      }
      const isKill = kill != null && to.owner === kill;
      const denies = diff === 'kenraali' && to.owner != null
        && aiOwnsContinent(state, to.owner, TERRITORIES[toId].continent);
      if (isKill) score += 6;      // korttisaalis
      if (denies) score += 9;      // vie viholliselta mannerbonus
      // PULLONKAULA-DOKTRIINI (pehmeä): suosi VAHVASTI laajennuskohteen alueita ja
      // rankaise sprawlausta avoimeen rajaan. Yhdessä varovaisen kynnyksen (wp≥0.55)
      // kanssa valtaus pysähtyy luonnostaan kohdemantereen kapeikoihin — mutta ei
      // turtlaa, koska hyvät valtaukset kohdemantereeseen etenevät yhä.
      // LUMIMYRSKYSSÄ mannerfokus on volatiili (kapeikot muuttuvat kun myrsky
      // siirtyy) → kevennä sprawl-sakkoa, nappaa AVOINTA aluetta joustavammin.
      if (tgt) {
        if (TERRITORIES[toId].continent === tgt) score += 10;
        else if (!denies && !isKill) score -= (state.options?.blizzard ? 1 : 2);
      }
      if (!best || score > best.score) best = { fromId, toId, score };
    }
  }
  return best;
}

async function aiAttack(state, hooks) {
  const me = state.current;
  const diff = difficultyOf(state);
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
      // kaikki eteenpäin. KENRAALI jättää selkeän varuskunnan (vahvin viereinen
      // vihollispino) ettei etenevä kärki jätä ohuita 1-joukon rajoja taakseen.
      const sourceStillBorder = enemyNeighbors(state, pc.fromId, me).length > 0;
      let move;
      if (!sourceStillBorder) {
        move = from.armies - 1;
      } else if (diff === 'kenraali') {
        const keep = Math.min(from.armies - 1, strongestEnemyNeighbor(state, pc.fromId, me) + 1);
        move = from.armies - keep;
      } else {
        move = Math.floor(from.armies / 2);
      }
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

// KENRAALI: kasaa voima sinne missä siitä on eniten hyötyä ensi vuorolla.
// Kohde = mieluiten LAAJENNUSFRONTTI (oma raja joka rajoittuu kohdemantereen
// viholliseen) → seuraavan vuoron läpimurto; muuten uhatuin raja (puolustus).
// Lähde = yhdistetty oma alue jolla suurin "vapaa" ylijäämä (myös matala­paineinen
// raja käy → hylätään turvattomat reunat, keskitetään voima).
function aiFortifyKenraali(state, me, owned) {
  const borders = owned.filter((id) => isBorder(state, id, me));
  if (!borders.length) return null;
  const dest = borders
    .map((id) => ({ id, need: enemyPressure(state, id, me) - state.territories[id].armies }))
    .sort((a, b) => b.need - a.need)[0].id;
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

  // KENRAALI: valitse vuoron alussa tapettava korttien haltija JA kohdemanner.
  // Transientteja (ei serialisoida) — vahvistus ja hyökkäys lukevat nämä.
  const isKenraali = difficultyOf(state) === 'kenraali';
  state._kenraaliKill = isKenraali ? pickKillTarget(state, state.current) : null;
  // Laajennuskohde: manner jota kohti vallata (halvin viimeisteltävä + puolustettava,
  // karttaa analysoiden). Vahvistus JA hyökkäys keskittyvät samaan → lumipallo.
  state._kenraaliTarget = isKenraali ? pickExpansionTarget(state, state.current) : null;

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
