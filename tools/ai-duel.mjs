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
// 2p-tikapuut: näissä pään-yhteen-otoissa aggressiivinen lumipallo ratkaisee →
// selvä paremmuusjärjestys Vaikea > Normaali > Helppo.
const ladder = [
  ['vaikea', 'normaali'],
  ['vaikea', 'helppo'],
  ['normaali', 'helppo'],
];
let allPass = true;
console.log('2P-TIKAPUUT (pään-yhteen-otto):');
for (const [strong, weak] of ladder) {
  const r = await matchup(strong, weak);
  const pass = r.pct > 55;
  if (!pass) allPass = false;
  console.log(`  ${strong.padEnd(9)} vs ${weak.padEnd(9)}: ${strong} voittaa ${r.pct.toFixed(1)}% (${r.strongWins}/${r.total})  ${pass ? '✓' : '✗ ODOTUS PETTI'}`);
}
// Kenraali 2p: puolustettavuusstrategia EI ole 2p-etu (ei kolmatta rankaisemassa
// ylilaajentumista) → riittää ettei se ROMAHDA Vaikeaa vastaan (≈tasan).
{
  const r = await matchup('kenraali', 'vaikea');
  const pass = r.pct >= 45;
  if (!pass) allPass = false;
  console.log(`  ${'kenraali'.padEnd(9)} vs ${'vaikea'.padEnd(9)}: ${r.pct.toFixed(1)}% (2p ≈ tasan odotettu; kynnys ≥45%)  ${pass ? '✓' : '✗ ODOTUS PETTI'}`);
}

// --- FFA (moninpeli): tässä puolustettavuus/kapeikko-strategia loistaa, koska
//     ylilaajentuminen rankaistaan. Yksi kohdetaso vs (P-1) verrokkia, kohteen
//     paikka kierrätetään. Odotus: kohde voittaa selvästi yli reilun 1/P osuuden.
const PALETTE = ['#46f', '#f44', '#4a4', '#fb0', '#a4f', '#0bb'];
async function ffa(targetDiff, baseDiff, P, blizzard = false) {
  let wins = 0, total = 0;
  for (const mapId of MAPS) {
    for (let i = 0; i < N; i++) {
      for (let seat = 0; seat < P; seat++) {
        const players = Array.from({ length: P }, (_, k) => ({
          name: `P${k}`, color: PALETTE[k], isAI: true,
          difficulty: k === seat ? targetDiff : baseDiff,
        }));
        const g = createGame({ players, seed: 4000 + i * 29 + seat * 101, mapId, options: { maxTurns: 60, blizzard } });
        let guard = 0;
        while (g.phase !== PHASES.GAMEOVER && guard++ < 9000) await runAITurn(g);
        if (g.winner === seat) wins++;
        total++;
      }
    }
  }
  return { pct: (100 * wins) / total, wins, total, fair: 100 / P };
}

console.log('\nFFA (moninpeli — kenraalin puolustettavuusstrategian oikea koeympäristö):');
for (const [P, bliz] of [[3, false], [4, false], [4, true]]) {
  const r = await ffa('kenraali', 'vaikea', P, bliz);
  const pass = r.pct > r.fair * 1.2; // ≥20 % yli reilun osuuden
  if (!pass) allPass = false;
  const tag = `${P}p${bliz ? ' +myrsky' : ''}`;
  console.log(`  ${tag.padEnd(10)}: kenraali vs ${P - 1}×vaikea → ${r.pct.toFixed(1)}% (reilu ${r.fair.toFixed(1)}%)  ${pass ? '✓' : '✗ ODOTUS PETTI'}`);
}

console.log(`\n${allPass ? 'VERIFY OK' : 'VERIFY: osa odotuksista petti (ks. yllä)'}`);
process.exit(allPass ? 0 : 1);
