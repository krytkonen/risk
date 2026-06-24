import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, PHASES, ownedBy, calcReinforcements, controlledContinents,
  placeArmies, endReinforcement, tradeCards, attack, resolveConquest, endAttack,
  fortify, areConnected, endTurn, startingArmiesFor, snapshot,
} from '../js/engine/game.js';
import { TERRITORY_IDS, TERRITORIES, continentTerritories } from '../js/data/territories.js';

const PLAYERS = [
  { name: 'Sininen', color: '#46f', isAI: false },
  { name: 'Punainen', color: '#f44', isAI: true },
  { name: 'Vihreä', color: '#4a4', isAI: true },
];

function newGame(seed = 42) {
  return createGame({ players: PLAYERS, seed });
}

test('alkujako: kaikki 42 aluetta jaettu, jokaisella >=1 armeija', () => {
  const s = newGame();
  let total = 0;
  for (const id of TERRITORY_IDS) {
    assert.notEqual(s.territories[id].owner, null, `${id} ilman omistajaa`);
    assert.ok(s.territories[id].armies >= 1);
    total += s.territories[id].armies;
  }
  // armeijoiden yhteismäärä = pelaajamäärä * aloitusarmeijat
  assert.equal(total, PLAYERS.length * startingArmiesFor(PLAYERS.length));
});

test('alkujako: alueet jakautuvat tasaisesti (max 1 ero)', () => {
  const s = newGame();
  const counts = s.players.map((p) => ownedBy(s, p.index).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test('peli alkaa vahvistusvaiheesta ja vahvistuksia on >=3', () => {
  const s = newGame();
  assert.equal(s.phase, PHASES.REINFORCE);
  assert.ok(s.reinforcements >= 3);
});

test('calcReinforcements: vähintään 3', () => {
  const s = newGame();
  // pakota pelaajalle vain 1 alue
  for (const id of TERRITORY_IDS) s.territories[id].owner = 1;
  s.territories[TERRITORY_IDS[0]].owner = 0;
  assert.equal(calcReinforcements(s, 0), 3);
});

test('calcReinforcements: mannerbonus kun manner hallussa', () => {
  const s = newGame();
  // anna pelaajalle 0 koko Australia + muutama muu
  for (const id of TERRITORY_IDS) s.territories[id].owner = 1;
  const aus = continentTerritories('australia');
  for (const id of aus) s.territories[id].owner = 0;
  assert.deepEqual(controlledContinents(s, 0), ['australia']);
  // 4 aluetta -> max(3, floor(4/3)=1) = 3, + australia bonus 2 = 5
  assert.equal(calcReinforcements(s, 0), 5);
});

test('vahvistusten sijoitus vähentää poolia ja kasvattaa armeijaa', () => {
  const s = newGame();
  const id = ownedBy(s, 0)[0];
  const before = s.territories[id].armies;
  const pool = s.reinforcements;
  const r = placeArmies(s, id, 2);
  assert.equal(r.ok, true);
  assert.equal(s.territories[id].armies, before + 2);
  assert.equal(s.reinforcements, pool - 2);
});

test('vahvistuksia ei voi sijoittaa toisen alueelle', () => {
  const s = newGame();
  const enemy = ownedBy(s, 1)[0];
  assert.equal(placeArmies(s, enemy, 1).ok, false);
});

test('endReinforcement vaatii että pool on tyhjä', () => {
  const s = newGame();
  assert.equal(endReinforcement(s).ok, false);
  const id = ownedBy(s, 0)[0];
  placeArmies(s, id, s.reinforcements);
  assert.equal(endReinforcement(s).ok, true);
  assert.equal(s.phase, PHASES.ATTACK);
});

test('hyökkäys ja valloitus siirtää omistuksen ja armeijat', () => {
  const s = newGame();
  // siirry hyökkäysvaiheeseen
  placeArmies(s, ownedBy(s, 0)[0], s.reinforcements);
  endReinforcement(s);

  // valitse oma alue jolla vihollisnaapuri, kasaa joukkoja ja hyökkää
  let from = null, to = null;
  for (const id of ownedBy(s, 0)) {
    const adjEnemy = TERRITORIES[id].adj.find((n) => s.territories[n].owner !== 0);
    if (adjEnemy) { from = id; to = adjEnemy; break; }
  }
  assert.ok(from && to);
  s.territories[from].armies = 40; // ylivoima takaa valloituksen ajan myötä
  s.territories[to].armies = 1;

  let guard = 0;
  while (!s.pendingConquest && guard++ < 100) {
    const r = attack(s, from, to);
    assert.equal(r.ok, true);
    if (s.phase === PHASES.GAMEOVER) break;
  }
  assert.ok(s.pendingConquest, 'valloituksen olisi pitänyt tapahtua');
  const res = resolveConquest(s, s.pendingConquest.minMove);
  assert.equal(res.ok, true);
  assert.equal(s.territories[to].owner, 0);
  assert.ok(s.territories[to].armies >= 1);
  assert.equal(s.conqueredThisTurn, true);
});

test('areConnected seuraa vain omia alueita', () => {
  const s = newGame();
  // tee ketju: pakota kaikki pelaajalle 0
  for (const id of TERRITORY_IDS) s.territories[id].owner = 0;
  assert.equal(areConnected(s, 'alaska', 'kamchatka', 0), true);
  // katkaise: kamchatkan naapurit toiselle
  s.territories['kamchatka'].owner = 1;
  assert.equal(areConnected(s, 'alaska', 'kamchatka', 0), false);
});

test('fortify siirtää joukot ja päättää vuoron', () => {
  const s = newGame();
  for (const id of TERRITORY_IDS) s.territories[id].owner = 0;
  s.players[1].alive = true;
  // varmista ettei peli ole jo ohi: anna yksi alue pelaajalle 1
  s.territories['madagascar'].owner = 1;
  s.phase = PHASES.FORTIFY;
  s.territories['alaska'].armies = 5;
  s.territories['alberta'].armies = 1;
  const before = s.current;
  const r = fortify(s, 'alaska', 'alberta', 3);
  assert.equal(r.ok, true);
  assert.equal(s.territories['alberta'].armies, 4);
  assert.equal(s.territories['alaska'].armies, 2);
  assert.notEqual(s.current, before); // vuoro vaihtui
});

test('pelaaja putoaa kun menettää kaikki alueet', () => {
  const s = newGame();
  for (const id of TERRITORY_IDS) s.territories[id].owner = 0;
  s.territories['madagascar'].owner = 1; // pelaajan 1 ainoa alue
  s.players[1].cards.push({ type: 'wild', territoryId: null });
  s.current = 0;
  s.phase = PHASES.ATTACK;
  s.territories['east-africa'].owner = 0;
  s.territories['east-africa'].armies = 40;
  s.territories['madagascar'].armies = 1;
  let guard = 0;
  while (!s.pendingConquest && guard++ < 100) attack(s, 'east-africa', 'madagascar');
  resolveConquest(s, s.pendingConquest.minMove);
  assert.equal(s.players[1].alive, false);
  // voittaja peri kortit
  assert.ok(s.players[0].cards.length >= 1);
});

test('voittoehto: yksi pelaaja jäljellä', () => {
  const s = newGame();
  for (const id of TERRITORY_IDS) s.territories[id].owner = 0;
  s.territories['madagascar'].owner = 1;
  s.current = 0;
  s.phase = PHASES.ATTACK;
  s.territories['east-africa'].owner = 0;
  s.territories['east-africa'].armies = 40;
  s.territories['madagascar'].armies = 1;
  s.players[2].alive = false; // vain 0 ja 1 elossa
  let guard = 0;
  while (!s.pendingConquest && guard++ < 100) attack(s, 'east-africa', 'madagascar');
  resolveConquest(s, s.pendingConquest.minMove);
  assert.equal(s.phase, PHASES.GAMEOVER);
  assert.equal(s.winner, 0);
});

test('snapshot palauttaa pelaajakohtaiset summat', () => {
  const s = newGame();
  const snap = snapshot(s);
  assert.equal(snap.length, 3);
  assert.ok(snap[0].territories > 0);
});
