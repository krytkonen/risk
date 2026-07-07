// Salaiset tavoitteet (missiot): tavoitteen arvonta, tunnistus laudasta,
// voittoehto, ja serialisointi. Kaikki tyypit johdetaan pelkästään laudasta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, PHASES, endTurn, attack, resolveConquest, missionComplete, missionText,
  serializeGame, restoreGame,
} from '../js/engine/game.js';
import { TERRITORIES, TERRITORY_IDS, continentTerritories, setActiveMap } from '../js/data/territories.js';

function game(missions, seed = 3) {
  setActiveMap('classic');
  const players = [
    { name: 'A', color: '#46f', isAI: false },
    { name: 'B', color: '#f44', isAI: true },
    { name: 'C', color: '#4a4', isAI: true },
  ];
  return createGame({ players, seed, options: { missions } });
}

test('missiot arvotaan vain kun moodi päällä', () => {
  const on = game(true);
  const off = game(false);
  assert.ok(on.options.missions);
  assert.ok(on.players.every((p) => p.mission && p.mission.type), 'kaikilla tavoite');
  assert.ok(!off.options.missions);
  assert.ok(off.players.every((p) => !p.mission), 'ei tavoitteita kun moodi pois');
});

test('missionComplete: territories', () => {
  const s = game(true);
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 1; s.territories[id].armies = 1; }
  s.players[0].mission = { type: 'territories', count: 5 };
  assert.equal(missionComplete(s, 0), false);
  const some = TERRITORY_IDS.slice(0, 5);
  for (const id of some) s.territories[id].owner = 0;
  assert.equal(missionComplete(s, 0), true);
});

test('missionComplete: territoriesArmed vaatii armeijat', () => {
  const s = game(true);
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  s.players[0].mission = { type: 'territoriesArmed', count: 3, armies: 2 };
  assert.equal(missionComplete(s, 0), false, '1 armeija/alue ei riitä');
  let n = 0;
  for (const id of TERRITORY_IDS) { if (n++ < 3) s.territories[id].armies = 2; }
  assert.equal(missionComplete(s, 0), true);
});

test('missionComplete: continents ja anyContinents', () => {
  const s = game(true);
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 1; s.territories[id].armies = 1; }
  const aus = continentTerritories('australia');
  const sa = continentTerritories('south-america');
  for (const id of [...aus, ...sa]) s.territories[id].owner = 0;
  s.players[0].mission = { type: 'continents', ids: ['australia', 'south-america'] };
  assert.equal(missionComplete(s, 0), true);
  s.players[0].mission = { type: 'continents', ids: ['australia', 'africa'] };
  assert.equal(missionComplete(s, 0), false, 'afrikkaa ei omisteta');
  s.players[0].mission = { type: 'anyContinents', count: 2 };
  assert.equal(missionComplete(s, 0), true, 'kaksi kokonaista mannerta');
  s.players[0].mission = { type: 'anyContinents', count: 3 };
  assert.equal(missionComplete(s, 0), false);
});

test('tavoitteen täyttyminen päättää pelin (endTurn → GAMEOVER, winByMission)', () => {
  const s = game(true);
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 1; s.territories[id].armies = 1; }
  // Player 0 omistaa tarpeeksi alueita ja on vuorossa.
  const mine = TERRITORY_IDS.slice(0, 6);
  for (const id of mine) s.territories[id].owner = 0;
  s.players[0].mission = { type: 'territories', count: 5 };
  s.current = 0; s.phase = PHASES.FORTIFY;
  const r = endTurn(s);
  assert.ok(r.ok);
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.equal(s.winner, 0);
  assert.ok(s.winByMission);
});

test('missiot: herruus voittaa yhä jos tavoite ei täyty (valtauksen kautta)', () => {
  const s = game(true);
  // Player 0 omistaa kaiken paitsi yhden alueen (p1); p2 jo pudonnut.
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  const Y = TERRITORY_IDS.find((id) => TERRITORIES[id].adj.length > 0);
  const X = TERRITORIES[Y].adj[0];
  s.territories[Y].armies = 30;
  s.territories[X].owner = 1; s.territories[X].armies = 1;
  s.players[2].alive = false;
  s.players[0].mission = { type: 'anyContinents', count: 99 }; // mahdoton → herruus ratkaisee
  s.current = 0; s.phase = PHASES.ATTACK;
  let guard = 0;
  while (s.phase === PHASES.ATTACK && guard++ < 60) {
    const r = attack(s, Y, X);
    if (!r.ok) break;
    if (s.pendingConquest) resolveConquest(s, s.territories[Y].armies - 1);
  }
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.equal(s.winner, 0, 'herruus ratkaisee vaikka tavoite ei täyty');
  assert.ok(!s.winByMission, 'ei missiovoitto');
});

test('missionText tuottaa suomenkielisen kuvauksen', () => {
  assert.match(missionText({ type: 'territories', count: 24 }), /24 aluetta/);
  assert.match(missionText({ type: 'continents', ids: ['australia', 'south-america'] }), /Australia|Etelä/);
  assert.match(missionText({ type: 'anyContinents', count: 3 }), /3 mannerta/);
});

test('serialisointi säilyttää tavoitteet ja moodin', () => {
  const s = game(true, 7);
  const saved = serializeGame(s);
  const r = restoreGame(saved);
  assert.ok(r.options.missions);
  assert.deepEqual(r.players.map((p) => p.mission), s.players.map((p) => p.mission));
});
