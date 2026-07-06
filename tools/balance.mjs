// Tasapainosimulaatio: ajaa kaikilla kartoilla N kpl kaikki-tekoäly-pelejä ja
// raportoi voittojakauman aloituspaikan (seat) mukaan, herruus- vs pistevoiton
// suhteen sekä keskimääräisen pelin pituuden. EI osa tuotantoa.
//
// Käyttö: node tools/balance.mjs [pelejä=40] [pelaajia=3]
import { createGame, PHASES } from '../js/engine/game.js';
import { runAITurn } from '../js/engine/ai.js';
import { MAP_LIST } from '../js/data/territories.js';

const N = Number(process.argv[2] || 40);
const P = Number(process.argv[3] || 3);
const colors = ['#46f', '#f44', '#4a4', '#fb0', '#a4f', '#0bb'];

console.log(`Tasapaino: ${N} peliä/kartta, ${P} pelaajaa (kaikki TÄ)\n`);
console.log('Kartta'.padEnd(22) + 'seat-voitto%'.padEnd(22) + 'herruus/pisteet'.padEnd(18) + 'ka.vuorot');
console.log('-'.repeat(72));

for (const { id, name } of MAP_LIST) {
  const wins = Array(P).fill(0);
  let points = 0, dom = 0, totalTurns = 0, valid = 0;
  for (let s = 0; s < N; s++) {
    const players = Array.from({ length: P }, (_, i) => ({ name: `AI${i}`, color: colors[i], isAI: true }));
    const game = createGame({ players, seed: 1000 + s * 7, mapId: id });
    let guard = 0;
    while (game.phase !== PHASES.GAMEOVER && guard++ < 8000) await runAITurn(game);
    if (game.phase !== PHASES.GAMEOVER || game.winner == null) continue;
    valid++;
    wins[game.winner]++;
    totalTurns += game.turnCount;
    if (game.winByPoints) points++; else dom++;
  }
  if (!valid) { console.log(`${name.padEnd(22)}(ei valmiita pelejä)`); continue; }
  const pct = wins.map((w) => `${Math.round((100 * w) / valid)}`.padStart(3)).join(' ');
  const seat = `[${pct} ]`;
  console.log(name.padEnd(22) + seat.padEnd(22) + `${dom}/${points}`.padEnd(18) + (totalTurns / valid).toFixed(1));
}
