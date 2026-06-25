import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, isBlizzard, playableIds, visibleTerritories, canAttack,
  calcReinforcements, controlledContinents, PHASES,
} from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';
import { CONTINENTS, continentTerritories } from '../js/data/territories.js';

const mkPlayers = () => [
  { name: 'Sinä', color: '#fff', isAI: false },
  { name: '🤖 A', color: '#f00', isAI: true },
];

test('ilman blizzard-moodia ei suljettuja alueita', () => {
  const s = createGame({ players: mkPlayers(), seed: 1, mapId: 'classic' });
  assert.equal(s.blizzards.length, 0);
  assert.equal(playableIds(s).length, 42);
});

test('blizzard-moodi sulkee alueita: ei omistajaa, ei joukkoja', () => {
  const s = createGame({ players: mkPlayers(), seed: 1, mapId: 'classic', options: { blizzard: true } });
  assert.ok(s.blizzards.length >= 2, 'suljettuja alueita pitäisi olla');
  for (const id of s.blizzards) {
    assert.ok(isBlizzard(s, id));
    assert.equal(s.territories[id].owner, null, `${id} ei saa olla kenenkään`);
    assert.equal(s.territories[id].armies, 0, `${id} ei saa olla joukkoja`);
  }
  // pelattavat = kaikki paitsi suljetut
  assert.equal(playableIds(s).length, 42 - s.blizzards.length);
});

test('suljettuun alueeseen ei voi hyökätä', async () => {
  const s = createGame({ players: mkPlayers(), seed: 5, mapId: 'classic', options: { blizzard: true } });
  const { TERRITORIES } = await import('../js/data/territories.js');
  const blocked = s.blizzards[0];
  // etsi naapuri jonka voisi muuten käyttää hyökkääjänä
  for (const n of TERRITORIES[blocked].adj) {
    s.territories[n].owner = 0;
    s.territories[n].armies = 5;
    s.current = 0;
    s.phase = PHASES.ATTACK;
    assert.equal(canAttack(s, n, blocked), false, `${n} -> ${blocked} ei saa olla sallittu`);
  }
});

test('suljettua aluetta ei tarvitse miehittää mantereen bonukseen', () => {
  // Rakenna tila jossa pelaaja 0 omistaa Australian kaikki AVOIMET alueet,
  // ja yksi Australian alue on suljettu.
  const s = createGame({ players: mkPlayers(), seed: 1, mapId: 'classic', options: { blizzard: true } });
  const ausIds = continentTerritories('australia');
  // pakota: yksi australialainen suljettu, muut pelaajalle 0
  s.blizzards = [ausIds[0]];
  for (const id of ausIds) {
    if (id === ausIds[0]) { s.territories[id].owner = null; s.territories[id].armies = 0; }
    else { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  }
  assert.ok(controlledContinents(s, 0).includes('australia'),
    'Australian pitäisi olla hallussa vaikka yksi alue on suljettu');
  // bonus sisältyy vahvistuksiin
  const base = Math.max(3, Math.floor((s.territories ? Object.keys(s.territories).filter((id) => s.territories[id].owner === 0).length : 0) / 3));
  assert.ok(calcReinforcements(s, 0) >= base + CONTINENTS['australia'].bonus);
});

test('jäljellä oleva kartta pysyy yhtenäisenä', async () => {
  const { TERRITORIES } = await import('../js/data/territories.js');
  const s = createGame({ players: mkPlayers(), seed: 9, mapId: 'classic', options: { blizzard: true } });
  const open = playableIds(s);
  const seen = new Set([open[0]]);
  const q = [open[0]];
  while (q.length) {
    const cur = q.shift();
    for (const n of TERRITORIES[cur].adj) {
      if (isBlizzard(s, n) || seen.has(n)) continue;
      seen.add(n); q.push(n);
    }
  }
  assert.equal(seen.size, open.length, 'avoin kartta ei ole yhtenäinen');
});

test('sumu: näkyvä joukko = omat + naapurit, ja suljetut alueet näkyvät aina', async () => {
  const { TERRITORIES, TERRITORY_IDS } = await import('../js/data/territories.js');
  const s = createGame({ players: mkPlayers(), seed: 3, mapId: 'classic', options: { fogOfWar: true, blizzard: true } });
  const vis = visibleTerritories(s, 0);
  for (const id of s.blizzards) assert.ok(vis.has(id), `suljettu ${id} pitäisi näkyä`);
  for (const id of TERRITORY_IDS) {
    if (s.territories[id].owner === 0) {
      assert.ok(vis.has(id));
      for (const n of TERRITORIES[id].adj) assert.ok(vis.has(n));
    }
  }
});

test('koko peli toimii kun sumu ja lumimyrsky päällä', async () => {
  const s = createGame({ players: [
    { name: 'Sinä', color: '#fff', isAI: true },
    { name: '🤖 A', color: '#f00', isAI: true },
    { name: '🤖 B', color: '#0f0', isAI: true },
  ], seed: 99, mapId: 'classic', options: { fogOfWar: true, blizzard: true } });
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 3000) await runAITurn(s);
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.ok(s.winner != null);
  // suljetut alueet pysyivät tyhjinä koko pelin
  for (const id of s.blizzards) {
    assert.equal(s.territories[id].owner, null);
    assert.equal(s.territories[id].armies, 0);
  }
});
