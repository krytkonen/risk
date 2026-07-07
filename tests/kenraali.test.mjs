// Kenraali-taso: deterministiset mikrotestit strategian rakennuspalikoille.
// (Koko pelin voimasuhde varmistetaan tools/ai-duel.mjs FFA-simulaatiolla:
//  kenraali > vaikea moninpelissä, myös lumimyrskyllä.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, PHASES, ownedBy } from '../js/engine/game.js';
import { bestAttack, aiReinforce } from '../js/engine/ai.js';
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

// Käyttäjän palaute: "joka alueella vain 1 joukko" → helppo ihmiselle. Kenraali
// VAHVISTAA rajansa (garrison) niin ettei jää ilmaisia läpimurtoja.
test('Kenraali ei jätä 1-joukon rajoja kun vahvistuksia riittää (garrison)', () => {
  const s = board('kenraali');
  s.phase = PHASES.REINFORCE;
  // Kolme erillistä raja-aluetta: anna kullekin vihollisnaapuri.
  const borders = [];
  for (const id of TERRITORY_IDS) {
    if (borders.length >= 3) break;
    const foe = TERRITORIES[id].adj.find((n) => s.territories[n].owner === 0 && n !== id
      && !borders.includes(n) && !borders.includes(id));
    if (foe && s.territories[id].owner === 0) { s.territories[foe].owner = 1; borders.push(id); }
  }
  assert.ok(borders.length >= 2);
  s.reinforcements = 60; // reilusti budjettia (0.6 → 36) kaikkien rajojen nostoon
  aiReinforce(s);
  const myBorderOnes = TERRITORY_IDS.filter((id) => s.territories[id].owner === 0
    && s.territories[id].armies === 1
    && TERRITORIES[id].adj.some((n) => s.territories[n].owner !== 0));
  assert.equal(myBorderOnes.length, 0, 'kenraalilla ei saa jäädä 1-joukon rajoja');
});

// Käyttäjän idea 2: estä vihollista pitämästä kokonaista mannerta (kiellä bonus).
test('Kenraali priorisoi vihollisen KOKO mantereen rikkomista', () => {
  const s = board('kenraali');
  s.phase = PHASES.ATTACK;
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  // Vihollinen (1) omistaa KOKO Australian.
  const aus = continentTerritories('australia');
  for (const id of aus) { s.territories[id].owner = 1; s.territories[id].armies = 2; }
  // Oma hyökkääjä Australian viereen (portti → Indonesia).
  const indonesia = aus.find((id) => TERRITORIES[id].adj.some((n) => !aus.includes(n)));
  const gate = TERRITORIES[indonesia].adj.find((n) => !aus.includes(n));
  s.territories[gate].owner = 0; s.territories[gate].armies = 12;
  // Kilpaileva YHTÄ HYVÄ hyökkäys joka EI riko mannerta EIKÄ viimeistele omaani:
  // kohde w pelaajalla 2, ja saman mantereen toinen alue myös pelaajalla 2
  // (→ valtaus ei viimeistele mannerta pelaajalle 0).
  let z = null, w = null, mate = null;
  for (const id of TERRITORY_IDS) {
    if (aus.includes(id) || id === gate) continue;
    const foe = TERRITORIES[id].adj.find((n) => !aus.includes(n) && n !== indonesia && n !== gate);
    if (!foe) continue;
    // Mate = w:n mantereen toinen alue joka EI ole hyökkääjä z eikä w → jää
    // pelaajalle 2, jottei valtaus VIIMEISTELE mannerta pelaajalle 0.
    const mates = continentTerritories(TERRITORIES[foe].continent)
      .filter((c) => c !== foe && c !== id && !aus.includes(c));
    if (mates.length) { z = id; w = foe; mate = mates[0]; break; }
  }
  assert.ok(z && w, 'kilpaileva hyökkäys pitää löytyä');
  s.territories[z].owner = 0; s.territories[z].armies = 12;
  s.territories[w].owner = 2; s.territories[w].armies = 2;
  s.territories[mate].owner = 2; s.territories[mate].armies = 1; // estä 0:n mannerviimeistely
  s._kenraaliKill = null; s._kenraaliTarget = null;
  const a = bestAttack(s);
  assert.ok(a, 'hyökkäys löytyy');
  assert.equal(a.toId, indonesia, 'Kenraalin pitäisi rikkoa vihollisen koko manner (kiellä bonus)');
});
