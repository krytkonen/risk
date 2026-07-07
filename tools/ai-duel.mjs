// Tekoälyn vaikeustasojen VERIFY-simulaatio: ajaa kaksintaisteluja eri
// vaikeustasojen välillä ja raportoi voitto-osuudet. Odotus: Vaikea > Normaali
// > Helppo selvästi. Kumpikin suunta pelataan (seat 0 / seat 1) jotta
// ensimmäisen siirron etu kumoutuu. EI osa tuotantoa.
//
// Käyttö: node tools/ai-duel.mjs [pelejä/suunta=40]

import { createGame, PHASES, snapshot } from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';

const N = Number(process.argv[2] || 40);
const MAPS = ['classic', 'europe', 'suurmaailma', 'antiquity'];
const colors = ['#46f', '#f44'];

// Pelaa yksi peli: seat0/seat1 vaikeudet annettu. Palauttaa voittajan vaikeuden.
async function playDuel(dA, dB, seed, mapId) {
  const players = [
    { name: 'S0', color: colors[0], isAI: true, difficulty: dA },
    { name: 'S1', color: colors[1], isAI: true, difficulty: dB },
  ];
  const g = createGame({ players, seed, mapId, options: { maxTurns: 60 } });
  let guard = 0;
  while (g.phase !== PHASES.GAMEOVER && guard++ < 8000) await runAITurn(g);
  if (g.phase !== PHASES.GAMEOVER || g.winner == null) {
    // Ratkaisematon → voittaja alueiden mukaan (turvaverkko).
    const snap = snapshot(g);
    return snap[0].territories >= snap[1].territories ? dA : dB;
  }
  return g.winner === 0 ? dA : dB;
}

async function matchup(dStrong, dWeak) {
  let strongWins = 0, total = 0;
  for (const mapId of MAPS) {
    for (let i = 0; i < N; i++) {
      // Suunta 1: vahva seat 0
      if (await playDuel(dStrong, dWeak, 3000 + i * 13, mapId) === dStrong) strongWins++;
      total++;
      // Suunta 2: vahva seat 1 (kumoaa seat-edun)
      if (await playDuel(dWeak, dStrong, 5000 + i * 17, mapId) === dStrong) strongWins++;
      total++;
    }
  }
  return { pct: (100 * strongWins) / total, strongWins, total };
}

console.log(`AI-kaksintaistelu: ${N} peliä/suunta/kartta × ${MAPS.length} karttaa = ${N * 2 * MAPS.length} peliä/matchup\n`);
const cases = [
  ['vaikea', 'helppo'],
  ['vaikea', 'normaali'],
  ['normaali', 'helppo'],
];
let allPass = true;
for (const [strong, weak] of cases) {
  const r = await matchup(strong, weak);
  const pass = r.pct > 55; // vahvemman pitää voittaa selvästi yli 50%
  if (!pass) allPass = false;
  console.log(`${strong.padEnd(9)} vs ${weak.padEnd(9)}: ${strong} voittaa ${r.pct.toFixed(1)}% (${r.strongWins}/${r.total})  ${pass ? '✓' : '✗ ODOTUS PETTI'}`);
}
console.log(`\n${allPass ? 'VERIFY OK: vaikeustasot järjestyksessä Vaikea > Normaali > Helppo' : 'VERIFY EPÄONNISTUI'}`);
process.exit(allPass ? 0 : 1);
