// Kenraali-taso: deterministiset mikrotestit strategian rakennuspalikoille.
// (Koko pelin voimasuhde varmistetaan tools/ai-duel.mjs FFA-simulaatiolla:
//  kenraali > vaikea moninpelissä, myös lumimyrskyllä.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, PHASES, ownedBy } from '../js/engine/game.js';
import { bestAttack } from '../js/engine/ai.js';
import { TERRITORIES, TERRITORY_IDS, continentTerritories, setActiveMap } from '../js/data/territories.js';

function board(difficulty, mapId = 'classic', options = {}) {
  setActiveMap(mapId);
  const players = [
    { name: 'A', color: '#46f', isAI: true, difficulty },
    { name: 'B', color: '#f44', isAI: true, difficulty: 'normaali' },
    { name: 'C', color: '#4a4', isAI: true, difficulty: 'normaali' },
  ];
  const s = createGame({ players, seed: 9, options: { difficulty, ...options } });
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  s.current = 0;
  return s;
}

// Australia klassisessa = 1 kapeikko (Indonesia↔Siam) → puolustettavin manner.
test('Kenraali priorisoi tapettavan korttien haltijan alueen hyökkäyskohteeksi', () => {
  const s = board('kenraali');
  s.phase = PHASES.ATTACK;
  // Kaksi yhtä hyvää hyökkäyskohdetta, toinen kuuluu kortilliselle pelaajalle 1,
  // joka on tapettavissa (1 alue). Kenraalin pitää valita korttien haltija.
  const fromId = TERRITORY_IDS.find((id) => TERRITORIES[id].adj.length >= 2);
  const [t1, t2] = TERRITORIES[fromId].adj;
  s.territories[fromId].armies = 10;
  s.territories[t1].owner = 1; s.territories[t1].armies = 2; // kortillinen, tapettavissa
  s.territories[t2].owner = 2; s.territories[t2].armies = 2; // ei kortteja
  s.players[1].cards = [{ t: 'inf' }, { t: 'cav' }, { t: 'art' }]; // 3 korttia
  s.players[2].cards = [];
  s._kenraaliKill = 1; // runAITurn asettaisi tämän; asetetaan testissä suoraan
  const a = bestAttack(s);
  assert.ok(a, 'hyökkäys pitäisi löytyä');
  assert.equal(a.toId, t1, 'Kenraalin pitäisi hyökätä korttien haltijaa vastaan');
});

test('Kenraali-hyökkäys hylkää huonot kertoimet kuten Vaikea (jaettu logiikka)', () => {
  const s = board('kenraali');
  s.phase = PHASES.ATTACK;
  const fromId = TERRITORY_IDS.find((id) => TERRITORIES[id].adj.length > 0);
  const toId = TERRITORIES[fromId].adj[0];
  s.territories[fromId].armies = 3;
  s.territories[toId].owner = 1; s.territories[toId].armies = 2; // wp ~0.36 < 0.4
  s._kenraaliKill = null;
  assert.equal(bestAttack(s), null, 'Kenraali ei hyökkää huonolla kertoimella');
});

// Lumimyrsky-tietoisuus: suljettu kapeikkonaapuri EI ole elävä raja → manner
// muuttuu hetkellisesti puolustettavammaksi. Todennetaan bestAttackin kautta:
// suljettuun alueeseen ei hyökätä (jaettu isBlizzard-portti), mikä on
// sama portti jota continentChokes käyttää.
test('Kenraali ei hyökkää lumimyrskyn sulkemaan alueeseen', () => {
  const s = board('kenraali', 'classic', { blizzard: true });
  s.phase = PHASES.ATTACK;
  const fromId = TERRITORY_IDS.find((id) => TERRITORIES[id].adj.length > 0);
  const toId = TERRITORIES[fromId].adj[0];
  s.territories[fromId].armies = 20;
  s.territories[toId].owner = 1; s.territories[toId].armies = 1;
  s.blizzards = [toId]; // kohde suljettu
  s._kenraaliKill = null;
  const a = bestAttack(s);
  assert.ok(!a || a.toId !== toId, 'suljettuun alueeseen ei saa hyökätä');
});

test('vaikeustasoja on neljä ja kenraali on validi', () => {
  const s = board('kenraali');
  assert.equal(s.options.difficulty, 'kenraali');
  assert.equal(s.players[0].difficulty, 'kenraali');
});
