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
