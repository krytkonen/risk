import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, canAttack, sameTeam, serializeGame, restoreGame, PHASES,
} from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';
import { SCENARIOS } from '../js/data/scenarios.js';
import { MAPS } from '../js/data/territories.js';

const SC = SCENARIOS['suomi-nato'];

test('skenaarion asetelma kattaa koko kartan ja armeijat täsmäävät', () => {
  const map = MAPS[SC.mapId];
  const ids = Object.keys(map.territories);
  for (const id of ids) {
    assert.ok(SC.ownership[id] !== undefined, `omistaja puuttuu: ${id}`);
    assert.ok((SC.armies[id] ?? 0) >= 1, `armeijat puuttuvat: ${id}`);
  }
  // Ei ylimääräisiä alueita asetelmassa.
  for (const id of Object.keys(SC.ownership)) assert.ok(map.territories[id], `tuntematon alue: ${id}`);
});

test('skenaario käynnistyy: kiinteä asetelma, Venäjä aloittaa', () => {
  const s = createGame({ scenario: SC, seed: 1 });
  assert.equal(s.current, SC.firstPlayer, 'Venäjän pitäisi aloittaa');
  assert.equal(s.players[0].name, 'Suomi');
  assert.equal(s.players[0].isAI, false);
  assert.equal(s.territories['pohjois-suomi'].owner, 0);
  assert.equal(s.territories['moskova'].owner, 3);
  assert.equal(s.territories['moskova'].armies, SC.armies['moskova']);
  assert.equal(s.blizzards.length, 0, 'skenaariossa ei lumimyrskyä');
});

test('liittolaista vastaan ei voi hyökätä', () => {
  const s = createGame({ scenario: SC, seed: 2 });
  assert.ok(sameTeam(s, 0, 1) && sameTeam(s, 0, 2), 'Suomi + Nato + Ukraina samassa liittoumassa');
  assert.ok(!sameTeam(s, 0, 3), 'Suomi ja Venäjä eri liittoumissa');
  // Suomen vuorolla naapuri-Ruotsiin (Nato) ei saa hyökätä, Venäjän Kuolaan saa.
  s.current = 0;
  s.phase = PHASES.ATTACK;
  s.territories['pohjois-suomi'].armies = 5;
  assert.equal(canAttack(s, 'pohjois-suomi', 'ruotsi'), false, 'liittolaiseen ei saa hyökätä');
  assert.equal(canAttack(s, 'pohjois-suomi', 'kuola'), true, 'viholliseen saa hyökätä');
});

test('skenaario pelautuu loppuun ja voittaja on liittouma', async () => {
  // Ihminen korvataan tekoälyllä simulointia varten.
  const sim = { ...SC, players: SC.players.map((p) => ({ ...p, isAI: true })) };
  for (const seed of [11, 77]) {
    const s = createGame({ scenario: sim, seed });
    let guard = 0;
    while (s.phase !== PHASES.GAMEOVER && guard++ < 4000) await runAITurn(s);
    assert.equal(s.phase, PHASES.GAMEOVER, `seed ${seed}: pelin pitäisi päättyä`);
    assert.ok(s.winnerTeam === 'lansi' || s.winnerTeam === 'ita', `seed ${seed}: voittajaliittouma puuttuu`);
    // Liittolaiset eivät koskaan vallanneet toisiltaan: voittajatiimin jäsenet
    // ovat joko elossa tai vain vihollinen on pudottanut heidät — epäsuora
    // tarkistus: jos lansi voitti, Venäjä ei omista yhtään aluetta TAI on kuollut.
    if (s.winnerTeam === 'lansi') {
      const rusOwned = Object.keys(s.territories).filter((id) => s.territories[id].owner === 3);
      assert.ok(!s.players[3].alive || rusOwned.length === 0);
    }
  }
});

test('liittoumatiedot säilyvät tallennuksen läpi', () => {
  const s = createGame({ scenario: SC, seed: 3 });
  const r = restoreGame(serializeGame(s));
  assert.equal(r.scenarioId, 'suomi-nato');
  assert.deepEqual(r.teamNames, SC.teamNames);
  assert.equal(r.players[1].team, 'lansi');
  assert.equal(r.players[3].team, 'ita');
  assert.equal(r.current, SC.firstPlayer);
  assert.ok(sameTeam(r, 0, 2));
});

test('vapaa peli toimii ennallaan (ei liittoumia)', () => {
  const s = createGame({
    players: [
      { name: 'Sinä', color: '#fff', isAI: false },
      { name: '🤖 A', color: '#f00', isAI: true },
    ],
    seed: 4, mapId: 'classic',
  });
  assert.equal(s.players[0].team, null);
  assert.ok(!sameTeam(s, 0, 1));
  assert.equal(s.scenarioId, null);
});
