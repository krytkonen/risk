// KENRAALI-BENCHMARK: mittaa Kenraalin voitto-osuuden FFA:ssa KAIKILLA kartoilla
// ja KAIKISSA moodeissa (normaali / sumu / lumimyrsky / kiinteä korttibonus),
// jotta parannus ei ole kartta- tai moodikohtainen. Yksi Kenraali vs (P-1)
// Vaikeaa, istumapaikka kierrätetään (kumoaa aloitusedun). EI osa tuotantoa.
//
// Käyttö: node tools/kenraali-bench.mjs [N=10] [P=4]
import { createGame, PHASES } from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';
import { MAP_LIST } from '../js/data/territories.js';

const N = Number(process.argv[2] || 10);
const P = Number(process.argv[3] || 4);
const PALETTE = ['#46f', '#f44', '#4a4', '#fb0', '#a4f', '#0bb'];
const MODES = [
  { key: 'normaali', opt: {} },
  { key: 'sumu', opt: { fogOfWar: true } },
  { key: 'myrsky', opt: { blizzard: true } },
  { key: 'kiinteä', opt: { fixedCards: true } },
];

async function winRate(mapId, modeOpt, target = 'kenraali', base = 'vaikea') {
  let wins = 0, total = 0;
  for (let i = 0; i < N; i++) {
    for (let seat = 0; seat < P; seat++) {
      const players = Array.from({ length: P }, (_, k) => ({
        name: `P${k}`, color: PALETTE[k], isAI: true,
        difficulty: k === seat ? target : base,
      }));
      const g = createGame({ players, seed: 4000 + i * 29 + seat * 101, mapId,
        options: { maxTurns: 60, ...modeOpt } });
      let guard = 0;
      while (g.phase !== PHASES.GAMEOVER && guard++ < 9000) await runAITurn(g);
      if (g.winner === seat) wins++;
      total++;
    }
  }
  return { wins, total, pct: (100 * wins) / total };
}

const fair = 100 / P;
console.log(`KENRAALI-BENCH: ${P} pelaajaa (1 kenraali vs ${P - 1} vaikea), N=${N}/paikka, reilu osuus ${fair.toFixed(1)}%\n`);
const header = 'Kartta'.padEnd(22) + MODES.map((m) => m.key.padEnd(9)).join('') + 'KA.';
console.log(header);
console.log('-'.repeat(header.length + 4));

let grandWins = 0, grandTotal = 0;
const modeAgg = Object.fromEntries(MODES.map((m) => [m.key, { wins: 0, total: 0 }]));
for (const { id, name } of MAP_LIST) {
  const cells = [];
  let mapWins = 0, mapTotal = 0;
  for (const m of MODES) {
    const r = await winRate(id, m.opt);
    cells.push(`${r.pct.toFixed(0)}%`.padEnd(9));
    mapWins += r.wins; mapTotal += r.total;
    modeAgg[m.key].wins += r.wins; modeAgg[m.key].total += r.total;
  }
  grandWins += mapWins; grandTotal += mapTotal;
  console.log(name.padEnd(22) + cells.join('') + `${(100 * mapWins / mapTotal).toFixed(0)}%`);
}
console.log('-'.repeat(header.length + 4));
const modeRow = MODES.map((m) => `${(100 * modeAgg[m.key].wins / modeAgg[m.key].total).toFixed(0)}%`.padEnd(9)).join('');
console.log('KA. (moodi)'.padEnd(22) + modeRow);
console.log(`\nKOKONAIS-VOITTO-%: ${(100 * grandWins / grandTotal).toFixed(1)}%  (reilu ${fair.toFixed(1)}%, ${grandWins}/${grandTotal})`);
