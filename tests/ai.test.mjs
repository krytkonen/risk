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

// --- Manner-bonustietoisuus: AI suosii valtausta joka viimeistelee mantereen ---
import { bestAttack } from '../js/engine/ai.js';
import { TERRITORIES, TERRITORY_IDS, continentTerritories, setActiveMap } from '../js/data/territories.js';

test('bestAttack suosii mantereen viimeistelevää valtausta isommankin ylivoiman ohi', () => {
  setActiveMap('classic');
  const players = [
    { name: 'A', color: '#46f', isAI: true },
    { name: 'B', color: '#f44', isAI: true },
    { name: 'C', color: '#4a4', isAI: true },
  ];
  const s = createGame({ players, seed: 5 });
  // Nollaa lauta: kaikki pelaajalle 0, 1 armeija → ei muita hyökkäyksiä.
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 0; s.territories[id].armies = 1; }
  s.current = 0; s.phase = PHASES.ATTACK;

  // Australia lähes valmis: yksi alue vihollisella, viereinen oma vahva.
  const aus = continentTerritories('australia');
  const target = aus[0];                          // viimeinen valloitettava
  s.territories[target].owner = 1; s.territories[target].armies = 1;
  const attacker = aus.find((id) => id !== target && TERRITORIES[target].adj.includes(id));
  assert.ok(attacker, 'testikartalla pitää olla viereinen oma Australia-alue');
  s.territories[attacker].armies = 5;             // ylivoima 4, viimeistelee mantereen

  // KILPAILEVA hyökkäys muualla: isompi RAAKA ylivoima mutta ei viimeistele.
  let enemy2 = null, att2 = null;
  for (const id of TERRITORY_IDS) {
    if (aus.includes(id)) continue;
    const own = id;
    const foe = TERRITORIES[id].adj.find((n) => !aus.includes(n) && n !== target);
    if (foe) { att2 = own; enemy2 = foe; break; }
  }
  s.territories[att2].owner = 0; s.territories[att2].armies = 8;
  s.territories[enemy2].owner = 2; s.territories[enemy2].armies = 2; // ylivoima 6 (isompi!)
  // Kilpailevan kohteen manner EI saa olla viimeisteltävissä (muuten sekin saa
  // bonuksen) → merkitse toinenkin sen mantereen alue viholliselle.
  const c2 = TERRITORIES[enemy2].continent;
  const other = continentTerritories(c2).find((id) => id !== enemy2 && id !== att2);
  assert.ok(other, 'kilpailevalla mantereella pitää olla toinen alue');
  s.territories[other].owner = 2; s.territories[other].armies = 1;

  const a = bestAttack(s);
  assert.ok(a, 'hyökkäys pitäisi löytyä');
  // Ilman manner-bonusta AI valitsisi kilpailevan (ylivoima 6 > 4). Bonus kääntää.
  assert.equal(a.toId, target, `AI:n pitäisi viimeistellä manner (valitsi ${a.fromId}→${a.toId})`);
});

// Turvaverkko (paneelin niputtama korjaus): aiReinforce ei saa jäätyä jos
// nykyinen pelaaja omistaa 0 aluetta. Ennen korjausta helppo-haaran
// while(reinforcements>0)-silmukka indeksoisi targets[i % 0] = undefined,
// mikä ei vähennä vahvistuksia → ikuinen silmukka (PWA jäätyy).
import { aiReinforce } from '../js/engine/ai.js';
test('aiReinforce palautuu välittömästi kun pelaaja omistaa 0 aluetta (ei jäätymistä)', () => {
  setActiveMap('classic');
  const players = [
    { name: 'A', color: '#46f', isAI: true, difficulty: 'helppo' },
    { name: 'B', color: '#f44', isAI: true, difficulty: 'helppo' },
  ];
  const s = createGame({ players, seed: 3, options: { difficulty: 'helppo' } });
  // Vie kaikki alueet pelaajalle 1 → pelaaja 0 omistaa 0 aluetta.
  for (const id of TERRITORY_IDS) { s.territories[id].owner = 1; s.territories[id].armies = 1; }
  s.current = 0;
  s.phase = PHASES.REINFORCE;
  s.reinforcements = 5;
  aiReinforce(s); // ei saa jäädä silmukkaan; palautuu heti
  assert.equal(s.reinforcements, 5, 'ilman alueita vahvistuksia ei sijoiteta');
});
