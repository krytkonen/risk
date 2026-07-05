import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, serializeGame, restoreGame, placeArmies, unplaceArmies,
  endReinforcement, attack, resolveConquest, endAttack, endTurn, snapshot,
  ownedBy, canAttack, PHASES,
} from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';

const mkPlayers = () => [
  { name: 'Sinä', color: '#fff', isAI: false },
  { name: '🤖 A', color: '#f00', isAI: true },
  { name: '🤖 B', color: '#0f0', isAI: true },
];

/** Etsii pelaajan 0 laillisen hyökkäyksen (from,to) tai null. */
function findAttack(state) {
  for (const from of ownedBy(state, 0)) {
    if (state.territories[from].armies < 2) continue;
    const { TERRITORIES } = stateAdj;
    for (const to of TERRITORIES[from].adj) {
      if (canAttack(state, from, to)) return { from, to };
    }
  }
  return null;
}
// adjacency-haku ilman kiertotuontia
import * as stateAdj from '../js/data/territories.js';

test('serialize → restore tuottaa identtisen tilannekuvan', () => {
  const s = createGame({ players: mkPlayers(), seed: 42, mapId: 'classic', options: { blizzard: true } });
  const restored = restoreGame(serializeGame(s));
  assert.deepEqual(snapshot(restored), snapshot(s));
  assert.deepEqual(restored.blizzards, s.blizzards);
  assert.equal(restored.phase, s.phase);
  assert.equal(restored.reinforcements, s.reinforcements);
  assert.equal(restored.rng.calls, s.rng.calls);
});

test('palautettu peli jatkuu deterministisesti (sama taistelu, sama tulos)', () => {
  // Kaksi identtistä peliä samalla siemenellä; toinen kierrätetään tallennuksen läpi.
  const a = createGame({ players: mkPlayers(), seed: 777, mapId: 'classic' });
  const b = restoreGame(serializeGame(createGame({ players: mkPlayers(), seed: 777, mapId: 'classic' })));

  // Vie molemmat hyökkäysvaiheeseen ja tee sama hyökkäys.
  for (const s of [a, b]) {
    const owned = ownedBy(s, 0);
    placeArmies(s, owned[0], s.reinforcements);
    endReinforcement(s);
  }
  const atkA = findAttack(a);
  const atkB = findAttack(b);
  assert.deepEqual(atkA, atkB, 'sama hyökkäysmahdollisuus molemmissa');
  if (atkA) {
    const resA = attack(a, atkA.from, atkA.to);
    const resB = attack(b, atkB.from, atkB.to);
    assert.deepEqual(
      { ad: resA.attackerDice, dd: resA.defenderDice },
      { ad: resB.attackerDice, dd: resB.defenderDice },
      'nopat identtiset tallennuksen jälkeen'
    );
  }
});

test('tallennettu peli pelautuu loppuun asti', async () => {
  let s = createGame({ players: mkPlayers().map((p) => ({ ...p, isAI: true })), seed: 5, mapId: 'europe' });
  // Pelaa muutama vuoro, tallenna, palauta, pelaa loppuun.
  for (let i = 0; i < 5 && s.phase !== PHASES.GAMEOVER; i++) await runAITurn(s);
  s = restoreGame(serializeGame(s));
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 3000) await runAITurn(s);
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.ok(s.winner != null);
});

test('unplaceArmies kumoaa sijoituksen ja palauttaa vahvistukset', () => {
  const s = createGame({ players: mkPlayers(), seed: 9, mapId: 'classic' });
  const id = ownedBy(s, 0)[0];
  const before = s.territories[id].armies;
  const rem = s.reinforcements;
  assert.ok(placeArmies(s, id, 3).ok);
  assert.equal(s.territories[id].armies, before + 3);
  assert.equal(s.reinforcements, rem - 3);
  assert.ok(unplaceArmies(s, id, 3).ok);
  assert.equal(s.territories[id].armies, before);
  assert.equal(s.reinforcements, rem);
  // Ei voi kumota alle yhden armeijan.
  assert.equal(unplaceArmies(s, id, before).ok, false);
});

test('tilastot kirjautuvat ja kulkevat tallennuksen läpi', async () => {
  let s = createGame({ players: mkPlayers().map((p) => ({ ...p, isAI: true })), seed: 123, mapId: 'classic' });
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 3000) {
    await runAITurn(s);
    if (guard === 3) s = restoreGame(serializeGame(s)); // välitallennus kesken pelin
  }
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.ok(Array.isArray(s.stats) && s.stats.length === 3);
  const total = s.stats.reduce((sum, st) => sum + st.conquests, 0);
  assert.ok(total > 0, 'valloituksia pitäisi olla kirjattuna');
});
