// VERIFY iter B: hyökkäyspaneelin voitto-osuusmerkki EI SAA VALEHDELLA.
// Näytetty luku = calcBlitzWinProb(a,d). Tämä testi todistaa että se on
// rehellinen ennuste: resolveBalancedBlitz-valloitusten EMPIIRINEN osuus
// vastaa calcBlitzWinProb-arvoa (adversariaalinen falsifiointi).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcBlitzWinProb, resolveBalancedBlitz, rollBattle } from '../js/engine/combat.js';
import { makeRng } from '../js/engine/rng.js';

// Reilu koko taistelu tavallisilla nopilla (Nopat-tila pelattuna loppuun).
function fairBattle(a, d, rng) {
  let A = a, D = d;
  while (A > 1 && D > 0) {
    const r = rollBattle(A, D, rng);
    A -= r.attackerLosses; D -= r.defenderLosses;
  }
  return D <= 0;
}

test('calcBlitzWinProb rajatapaukset', () => {
  assert.equal(calcBlitzWinProb(1, 5), 0, 'yksi armeija ei voi hyökätä → 0');
  assert.equal(calcBlitzWinProb(5, 0), 1, 'tyhjä puolustus → 1');
  // Monotonisuus: enemmän hyökkääjiä ⇒ ei pienempi voittotod.
  assert.ok(calcBlitzWinProb(8, 3) > calcBlitzWinProb(4, 3));
  // Enemmän puolustajia ⇒ ei suurempi voittotod.
  assert.ok(calcBlitzWinProb(6, 2) > calcBlitzWinProb(6, 5));
});

test('näytetty voitto-osuus vastaa REILUJEN noppien valloitusosuutta (±3 %-yks.)', () => {
  // Merkki näyttää calcBlitzWinProb = koko taistelun voittotod. tavallisilla
  // nopilla. Todennetaan että se vastaa toteutunutta Nopat-tilan lopputulosta.
  const cases = [[5, 3], [8, 2], [4, 4], [10, 6], [3, 2], [12, 8]];
  const SAMPLES = 4000;
  for (const [a, d] of cases) {
    const p = calcBlitzWinProb(a, d);
    let conquered = 0;
    for (let i = 0; i < SAMPLES; i++) {
      if (fairBattle(a, d, makeRng(1 + i * 2654435761 + a * 131 + d))) conquered++;
    }
    const emp = conquered / SAMPLES;
    assert.ok(Math.abs(emp - p) < 0.03,
      `${a}v${d}: näytetty ${(p * 100).toFixed(1)}% vs reilut nopat ${(emp * 100).toFixed(1)}% — merkki valehtelee`);
  }
});

test('merkki ei koskaan yliarvioi: Blitz valloittaa vähintään yhtä usein kuin näytetty', () => {
  // Tasapainotettu Blitz vinouttaa lievästi hyökkääjän eduksi → toteutunut
  // valloitusosuus ON VÄHINTÄÄN näytetyn suuruinen. Merkki on siis konservatiivinen
  // (ei koskaan lupaa liikaa), kummassakin hyökkäystilassa rehellinen.
  for (const [a, d] of [[5, 3], [10, 6], [4, 4]]) {
    const p = calcBlitzWinProb(a, d);
    let conquered = 0; const SAMPLES = 4000;
    for (let i = 0; i < SAMPLES; i++) {
      if (resolveBalancedBlitz(a, d, makeRng(7 + i * 40503 + a * 17 + d)).conquered) conquered++;
    }
    assert.ok(conquered / SAMPLES >= p - 0.02, `${a}v${d}: Blitz alle näytetyn`);
  }
});
