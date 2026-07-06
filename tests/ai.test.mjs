import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, PHASES, snapshot } from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';

function aiGame(seed, playerCount = 4) {
  const players = [];
  const colors = ['#46f', '#f44', '#4a4', '#fb0', '#a4f', '#0bb'];
  for (let i = 0; i < playerCount; i++) {
    players.push({ name: `AI${i}`, color: colors[i], isAI: true });
  }
  return createGame({ players, seed });
}

test('tekoäly pelaa vuoron ilman virheitä ja vaihtaa vaihetta', async () => {
  const s = aiGame(11);
  const startTurnPlayer = s.current;
  await runAITurn(s);
  // vuoron jälkeen joko peli on ohi tai vuoro on edennyt
  assert.ok(s.phase === PHASES.GAMEOVER || s.current !== startTurnPlayer || s.players.filter(p=>p.alive).length === 1);
});

test('tekoälypeli päättyy voittajaan kohtuullisessa ajassa', async () => {
  for (const seed of [1, 2, 3, 7, 42, 99, 2024, 64, 7]) {
    const s = aiGame(seed, 4);
    let guard = 0;
    while (s.phase !== PHASES.GAMEOVER && guard++ < 4000) {
      await runAITurn(s);
    }
    assert.equal(s.phase, PHASES.GAMEOVER, `siemen ${seed} ei päättynyt (${guard} vuoroa)`);
    assert.notEqual(s.winner, null);
    // Voittaja joko hallitsee koko karttaa (herruus) tai johti pisteissä
    // vuororajalla → kummassakin tapauksessa voittajalla on eniten alueita.
    const snap = snapshot(s);
    const maxTerr = Math.max(...s.players.map((p, i) => (p.alive ? snap[i].territories : 0)));
    assert.equal(snap[s.winner].territories, maxTerr, `siemen ${seed}: voittajalla ei eniten alueita`);
  }
});

test('invariantti: armeijoiden ja alueiden määrät pysyvät järkevinä koko pelin', async () => {
  const s = aiGame(555, 3);
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 4000) {
    await runAITurn(s);
    // jokaisella alueella aina vähintään 1 armeija ja omistaja
    for (const id of Object.keys(s.territories)) {
      assert.ok(s.territories[id].armies >= 1, `${id} armeijat alle 1`);
      assert.notEqual(s.territories[id].owner, null);
    }
  }
  assert.equal(s.phase, PHASES.GAMEOVER);
});

test('2 pelaajan peli toimii ja päättyy', async () => {
  const s = aiGame(31, 2);
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 4000) await runAITurn(s);
  assert.equal(s.phase, PHASES.GAMEOVER);
});

test('6 pelaajan peli toimii ja päättyy', async () => {
  const s = aiGame(64, 6);
  let guard = 0;
  while (s.phase !== PHASES.GAMEOVER && guard++ < 4000) await runAITurn(s);
  assert.equal(s.phase, PHASES.GAMEOVER);
});
