// Tekoälyn vaikeustasot: todentaa että Helppo/Normaali/Vaikea pelaavat
// MITATTAVASTI eri tavalla. Nämä ovat deterministisiä mikrotestejä; koko
// pelin voimasuhde (Vaikea > Normaali > Helppo) varmistetaan erikseen
// tools/ai-duel.mjs -simulaatiolla.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, PHASES, ownedBy } from '../js/engine/game.js';
import { bestAttack, aiReinforce } from '../js/engine/ai.js';
import { TERRITORIES, TERRITORY_IDS, setActiveMap } from '../js/data/territories.js';

function freshBoard(difficulty) {
  setActiveMap('classic');
  const players = [
    { name: 'A', color: '#46f', isAI: true, difficulty },
    { name: 'B', color: '#f44', isAI: true, difficulty: 'normaali' },
  ];
  const s = createGame({ players, seed: 5, options: { difficulty } });
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  s.current = 0;
  return s;
}

// --- Hyökkäyskynnys: Helppo vaatii selvän ylivoiman, Normaali ei -----------

function singleAttack(difficulty, fromArmies, defArmies) {
  const s = freshBoard(difficulty);
  s.phase = PHASES.ATTACK;
  // Yksi ainoa mahdollinen hyökkäys: oma fromArmies vs vihollinen defArmies.
  const fromId = TERRITORY_IDS.find((id) => TERRITORIES[id].adj.length > 0);
  const toId = TERRITORIES[fromId].adj[0];
  s.territories[fromId].armies = fromArmies;
  s.territories[toId].owner = 1; s.territories[toId].armies = defArmies;
  return bestAttack(s);
}

test('kolmiportainen hyökkäyskuri: Helppo varovaisin, Vaikea laskee kertoimet', () => {
  // Ohut hyökkäys 3v2 (ylivoima 1, voittotod. ~0.36):
  assert.equal(singleAttack('helppo', 3, 2), null, 'Helppo vaatii ylivoiman ≥3');
  assert.ok(singleAttack('normaali', 3, 2), 'Normaali hyökkää jo ylivoimalla 1');
  assert.equal(singleAttack('vaikea', 3, 2), null, 'Vaikea hylkää huonot kertoimet (wp<0.4)');
  // Hyvät kertoimet pienelläkin ylivoimalla 4v2 (ylivoima 2, voittotod. ~0.66):
  assert.equal(singleAttack('helppo', 4, 2), null, 'Helppo yhä varovainen (ylivoima 2 < 3)');
  assert.ok(singleAttack('normaali', 4, 2), 'Normaali hyökkää');
  assert.ok(singleAttack('vaikea', 4, 2), 'Vaikea hyökkää hyvällä kertoimella');
  // Selvä ylivoima: kaikki hyökkäävät.
  assert.ok(singleAttack('helppo', 5, 2), 'Helppo hyökkää selvällä ylivoimalla (≥3)');
});

// --- Vahvistuksen sijoitus: Helppo hajottaa, muut keskittävät --------------

function reinforceSpread(difficulty) {
  const s = freshBoard(difficulty);
  s.phase = PHASES.REINFORCE;
  // Rakenna 3 erillistä raja-aluetta (kullakin vihollisnaapuri).
  const borders = [];
  for (const id of TERRITORY_IDS) {
    if (borders.length >= 3) break;
    const foe = TERRITORIES[id].adj.find((n) => s.territories[n].owner === 0
      && !borders.includes(n) && !borders.includes(id));
    // valitse alue+naapuri joita ei vielä käytetty
    if (foe && s.territories[id].owner === 0) {
      s.territories[foe].owner = 1; // naapurista vihollinen → id on rajalla
      borders.push(id);
    }
  }
  assert.ok(borders.length >= 2, 'testin pitää tuottaa ≥2 raja-aluetta');
  s.reinforcements = 6;
  const before = Object.fromEntries(TERRITORY_IDS.map((id) => [id, s.territories[id].armies]));
  aiReinforce(s);
  // Montako OMAA aluetta sai lisää joukkoja?
  const grew = TERRITORY_IDS.filter((id) => s.territories[id].owner === 0
    && s.territories[id].armies > before[id]).length;
  return grew;
}

test('Helppo hajottaa vahvistukset ≥2 alueelle, Normaali/Vaikea keskittää yhteen', () => {
  assert.ok(reinforceSpread('helppo') >= 2, 'Helpon pitäisi hajottaa usealle rajalle');
  assert.equal(reinforceSpread('normaali'), 1, 'Normaalin pitäisi keskittää yhteen kärkeen');
  assert.equal(reinforceSpread('vaikea'), 1, 'Vaikean pitäisi keskittää yhteen kärkeen (ei uhkaa → ei varausta)');
});

// --- Oletus & serialisointi ------------------------------------------------

test('vaikeustaso oletuksena normaali ja säilyy per-pelaaja', () => {
  setActiveMap('classic');
  const s = createGame({ players: [
    { name: 'A', color: '#46f', isAI: true },
    { name: 'B', color: '#f44', isAI: true, difficulty: 'vaikea' },
  ], seed: 1, options: {} });
  assert.equal(s.options.difficulty, 'normaali');
  assert.equal(s.players[0].difficulty, 'normaali');
  assert.equal(s.players[1].difficulty, 'vaikea');
});
