// Taistelun ratkaisu Risk-säännöin: hyökkääjä heittää enintään 3 noppaa,
// puolustaja enintään 2. Nopat lasketaan suuruusjärjestyksessä pareittain;
// tasapelin voittaa puolustaja.

import { rollDie } from './rng.js';

/**
 * Yhden hyökkäyserän nopat.
 * @param {number} attackerArmies hyökkäävän alueen armeijat (>=2)
 * @param {number} defenderArmies puolustavan alueen armeijat (>=1)
 * @param {() => number} rng
 */
export function rollBattle(attackerArmies, defenderArmies, rng) {
  const attackerDiceCount = Math.min(3, Math.max(0, attackerArmies - 1));
  const defenderDiceCount = Math.min(2, defenderArmies);

  const attackerDice = [];
  const defenderDice = [];
  for (let i = 0; i < attackerDiceCount; i++) attackerDice.push(rollDie(rng));
  for (let i = 0; i < defenderDiceCount; i++) defenderDice.push(rollDie(rng));

  const a = [...attackerDice].sort((x, y) => y - x);
  const d = [...defenderDice].sort((x, y) => y - x);

  let attackerLosses = 0;
  let defenderLosses = 0;
  const comparisons = Math.min(a.length, d.length);
  for (let i = 0; i < comparisons; i++) {
    if (a[i] > d[i]) defenderLosses++;
    else attackerLosses++; // tasapeli -> puolustaja voittaa
  }

  return { attackerDice, defenderDice, attackerLosses, defenderLosses };
}

/**
 * Soveltaa yhden taisteluerän pelitilan kahteen alueeseen ja palauttaa
 * tuloksen. Ei siirrä armeijoita valloituksessa – sen tekee kutsuja
 * (game.js), koska siirrettävä määrä on pelaajan valinta.
 *
 * @returns {{attackerLosses:number,defenderLosses:number,attackerDice:number[],
 *            defenderDice:number[],conquered:boolean}}
 */
export function resolveAttack(state, fromId, toId, rng) {
  const from = state.territories[fromId];
  const to = state.territories[toId];
  const r = rollBattle(from.armies, to.armies, rng);
  from.armies -= r.attackerLosses;
  to.armies -= r.defenderLosses;
  const conquered = to.armies <= 0;
  return { ...r, conquered };
}

// ---------------------------------------------------------------------------
// Tasapainotettu Blitz (Balanced Blitz)
// ---------------------------------------------------------------------------

// Esilasketut todennäköisyystaulut jokaiselle noppayhdistelmälle
// Muoto: [todennäköisyys, hyökkääjänHäviöt, puolustajaNHäviöt]
const DICE_OUTCOMES = {
  '3,2': [[0.3717, 0, 2], [0.3358, 1, 1], [0.2926, 2, 0]],
  '2,2': [[0.2276, 0, 2], [0.3241, 1, 1], [0.4483, 2, 0]],
  '3,1': [[0.6597, 0, 1], [0.3403, 1, 0]],
  '2,1': [[0.5787, 0, 1], [0.4213, 1, 0]],
  '1,1': [[0.4167, 0, 1], [0.5833, 1, 0]],
  '1,2': [[0.2546, 0, 1], [0.7454, 1, 0]],
};

// Memoized voittotodennäköisyys koko blitz-taistelulle.
const _wpCache = {};
export function calcBlitzWinProb(a, d) {
  if (a <= 1) return 0;
  if (d <= 0) return 1;
  const key = `${a}:${d}`;
  if (key in _wpCache) return _wpCache[key];
  const aDice = Math.min(3, a - 1);
  const dDice = Math.min(2, d);
  const outcomes = DICE_OUTCOMES[`${aDice},${dDice}`] || DICE_OUTCOMES['1,1'];
  let p = 0;
  for (const [prob, aL, dL] of outcomes) {
    p += prob * calcBlitzWinProb(a - aL, d - dL);
  }
  _wpCache[key] = p;
  return p;
}

// Luo uskottavat noppa-arvot jotka tuottavat halutun tuloksen
function makeDiceForOutcome(aDiceCount, dDiceCount, aLoss, dLoss) {
  const comparisons = Math.min(aDiceCount, dDiceCount);
  const pairs = [];
  // dLoss vertailua: hyökkääjä voittaa (att > def)
  for (let i = 0; i < dLoss; i++) {
    const att = 4 + Math.floor(Math.random() * 3); // 4-6
    const def = 1 + Math.floor(Math.random() * (att - 1)); // < att
    pairs.push([att, Math.max(1, def)]);
  }
  // aLoss vertailua: puolustaja voittaa (def >= att)
  for (let i = 0; i < aLoss; i++) {
    const def = 3 + Math.floor(Math.random() * 4); // 3-6
    const att = 1 + Math.floor(Math.random() * def); // <= def
    pairs.push([att, def]);
  }
  pairs.sort((a, b) => b[0] - a[0]); // järjestä hyökkääjän nopan mukaan laskevasti
  const aDice = pairs.map((p) => p[0]);
  const dDice = pairs.map((p) => p[1]);
  // Ylimääräiset nopat (ei vertailla)
  for (let i = comparisons; i < aDiceCount; i++) aDice.push(1 + Math.floor(Math.random() * 6));
  for (let i = comparisons; i < dDiceCount; i++) dDice.push(1 + Math.floor(Math.random() * 6));
  aDice.sort((a, b) => b - a);
  dDice.sort((a, b) => b - a);
  return { attackerDice: aDice, defenderDice: dDice, attackerLosses: aLoss, defenderLosses: dLoss };
}

/**
 * Tasapainotettu blitz: simuloi koko taistelu vinostaen kierroksia
 * ennalta määrättyä voittajaa kohti.
 *
 * @param {number} fromArmies hyökkäävät armeijat
 * @param {number} defArmies puolustavan alueen armeijat
 * @param {() => number} rng satunnaislukugeneraattori
 * @returns {{rounds: object[], finalAttacker: number, finalDefender: number, conquered: boolean}}
 */
export function resolveBalancedBlitz(fromArmies, defArmies, rng) {
  const p = calcBlitzWinProb(fromArmies, defArmies);
  const attackerWins = rng() < p;
  let a = fromArmies, d = defArmies;
  const rounds = [];
  while (a > 1 && d > 0) {
    const aDice = Math.min(3, a - 1);
    const dDice = Math.min(2, d);
    const outcomes = DICE_OUTCOMES[`${aDice},${dDice}`] || DICE_OUTCOMES['1,1'];
    // Vinosta tuloksia ennalta määrättyä voittajaa kohti
    const weighted = outcomes.map(([prob, aL, dL]) => {
      const fp = calcBlitzWinProb(a - aL, d - dL);
      const w = attackerWins ? fp : (1 - fp);
      return [prob * (w + 0.1), aL, dL]; // +0.1 estää nollapainon
    });
    const total = weighted.reduce((s, [pw]) => s + pw, 0);
    let r = rng() * total;
    let chosen = weighted[weighted.length - 1];
    for (const w of weighted) { r -= w[0]; if (r <= 0) { chosen = w; break; } }
    const [, aLoss, dLoss] = chosen;
    const dice = makeDiceForOutcome(aDice, dDice, aLoss, dLoss);
    rounds.push(dice);
    a -= aLoss;
    d -= dLoss;
  }
  return { rounds, finalAttacker: a, finalDefender: d, conquered: d <= 0 };
}
