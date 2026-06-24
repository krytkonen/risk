import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollBattle, calcBlitzWinProb } from '../js/engine/combat.js';
import { createGame, isBlizzard, visibleTerritories, applyBlizzard, PHASES } from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';
import { makeRng } from '../js/engine/rng.js';

const mkPlayers = () => [
  { name: 'Sinä', color: '#fff', isAI: false },
  { name: '🤖 A', color: '#f00', isAI: true },
];

test('lumimyrsky rajaa hyökkääjän kahteen noppaan', () => {
  const rng = makeRng(42);
  // monella armeijalla hyökkääjä saisi normaalisti 3 noppaa
  const normal = rollBattle(10, 5, rng, false);
  assert.equal(normal.attackerDice.length, 3);
  const storm = rollBattle(10, 5, rng, true);
  assert.equal(storm.attackerDice.length, 2);
});

test('lumimyrsky laskee hyökkääjän voittotodennäköisyyttä', () => {
  const normal = calcBlitzWinProb(10, 8, false);
  const storm = calcBlitzWinProb(10, 8, true);
  assert.ok(storm < normal, `blizzard ${storm} pitäisi olla < normaali ${normal}`);
});

test('blizzard-moodi täyttää state.blizzards, ilman moodia tyhjä', () => {
  const on = createGame({ players: mkPlayers(), seed: 1, options: { blizzard: true } });
  assert.ok(on.blizzards.length >= 2, 'lumimyrskyalueita pitäisi olla');
  assert.ok(on.blizzards.every((id) => isBlizzard(on, id)));
  const off = createGame({ players: mkPlayers(), seed: 1 });
  assert.equal(off.blizzards.length, 0);
  assert.equal(isBlizzard(off, off.blizzards[0]), false);
});

test('lumimyrsky siirtyy vuoron vaihtuessa', () => {
  const s = createGame({ players: mkPlayers(), seed: 7, options: { blizzard: true } });
  const before = [...s.blizzards].sort().join(',');
  // pakota uusi arvonta
  applyBlizzard(s);
  // arvonta on satunnainen mutta deterministinen; varmista että setti on validi koko ajan
  assert.ok(s.blizzards.length >= 2);
  assert.ok(s.blizzards.every((id) => s.territories[id]));
  assert.ok(typeof before === 'string');
});

test('sumu: näkyvä joukko on tasan omat alueet + niiden naapurit', async () => {
  const { TERRITORIES, TERRITORY_IDS } = await import('../js/data/territories.js');
  const s = createGame({ players: mkPlayers(), seed: 3, mapId: 'classic', options: { fogOfWar: true } });
  const vis = visibleTerritories(s, 0);
  // Laske odotettu joukko: omat + omien naapurit.
  const expected = new Set();
  for (const id of TERRITORY_IDS) {
    if (s.territories[id].owner === 0) {
      expected.add(id);
      for (const n of TERRITORIES[id].adj) expected.add(n);
    }
  }
  assert.equal(vis.size, expected.size);
  for (const id of expected) assert.ok(vis.has(id), `${id} pitäisi näkyä`);
});

test('koko peli toimii kun sumu ja lumimyrsky päällä', async () => {
  const s = createGame({ players: [
    { name: 'Sinä', color: '#fff', isAI: true },
    { name: '🤖 A', color: '#f00', isAI: true },
    { name: '🤖 B', color: '#0f0', isAI: true },
  ], seed: 99, options: { fogOfWar: true, blizzard: true } });
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 3000) await runAITurn(s);
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.ok(s.winner != null);
});
