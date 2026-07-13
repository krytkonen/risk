// Saaristomaailman maamassan sommittelu → js/data/geo/saaristo-land.js.
// Fantasia-arkkipelagi: 7 saariryhmää + iso keskussaari (Sumusaari).
// Muodot toistavat ryhmien teemoja: sileät helmiluodot, kraagiset myrsky-
// saaret, tulivuorikeilat, matalat koralliriutat.
import { writeFileSync } from 'node:fs';
import { islandPoly } from './islands.mjs';

const SPECS = [
  // Helmisaaret (NW): sileät, helmimäiset saaret
  { cx: 85, cy: 80, rx: 34, ry: 26, wobble: 0.22, seed: 101, n: 26 },
  { cx: 190, cy: 65, rx: 38, ry: 28, wobble: 0.22, seed: 102, n: 26 },
  { cx: 255, cy: 140, rx: 33, ry: 26, wobble: 0.24, seed: 103, n: 26 },
  { cx: 95, cy: 175, rx: 33, ry: 27, wobble: 0.22, seed: 104, n: 26 },
  { cx: 185, cy: 205, rx: 30, ry: 25, wobble: 0.24, seed: 105, n: 26 },
  // Myrskysaaret (N): rikkonaiset, kraagiset
  { cx: 350, cy: 75, rx: 34, ry: 27, wobble: 0.5, seed: 111, n: 30 },
  { cx: 460, cy: 55, rx: 36, ry: 26, wobble: 0.5, seed: 112, n: 30 },
  { cx: 545, cy: 115, rx: 32, ry: 27, wobble: 0.5, seed: 113, n: 30 },
  { cx: 365, cy: 165, rx: 33, ry: 26, wobble: 0.48, seed: 114, n: 30 },
  { cx: 470, cy: 172, rx: 32, ry: 24, wobble: 0.48, seed: 115, n: 30 },
  // Lohikäärmesaaret (NE): tulivuorikeilojen kaari
  { cx: 680, cy: 70, rx: 34, ry: 27, wobble: 0.5, seed: 121, n: 30 },
  { cx: 790, cy: 55, rx: 36, ry: 28, wobble: 0.5, seed: 122, n: 30 },
  { cx: 895, cy: 90, rx: 33, ry: 26, wobble: 0.5, seed: 123, n: 30 },
  { cx: 735, cy: 160, rx: 31, ry: 25, wobble: 0.48, seed: 124, n: 30 },
  { cx: 860, cy: 185, rx: 33, ry: 26, wobble: 0.5, seed: 125, n: 30 },
  // Kauppasaaret (W): keskikokoiset satamasaaret
  { cx: 80, cy: 320, rx: 30, ry: 25, wobble: 0.3, seed: 131, n: 28 },
  { cx: 185, cy: 300, rx: 38, ry: 29, wobble: 0.3, seed: 132, n: 28 },
  { cx: 85, cy: 420, rx: 32, ry: 26, wobble: 0.3, seed: 133, n: 28 },
  { cx: 200, cy: 395, rx: 35, ry: 27, wobble: 0.3, seed: 134, n: 28 },
  { cx: 125, cy: 490, rx: 30, ry: 24, wobble: 0.3, seed: 135, n: 28 },
  // Sumusaari (keskusta): iso usvainen manner­saari
  { cx: 455, cy: 330, rx: 135, ry: 92, rot: 0.1, wobble: 0.3, seed: 141, n: 52 },
  // Riimusaaret (E): riimukivien saaret
  { cx: 700, cy: 300, rx: 32, ry: 26, wobble: 0.42, seed: 151, n: 28 },
  { cx: 810, cy: 280, rx: 34, ry: 26, wobble: 0.42, seed: 152, n: 28 },
  { cx: 920, cy: 320, rx: 31, ry: 25, wobble: 0.42, seed: 153, n: 28 },
  { cx: 760, cy: 390, rx: 33, ry: 26, wobble: 0.42, seed: 154, n: 28 },
  { cx: 880, cy: 430, rx: 34, ry: 27, wobble: 0.42, seed: 155, n: 28 },
  // Merirosvosaaret (SW): rosoiset kaapparivedet
  { cx: 85, cy: 590, rx: 30, ry: 24, wobble: 0.44, seed: 161, n: 28 },
  { cx: 175, cy: 570, rx: 30, ry: 24, wobble: 0.44, seed: 162, n: 28 },
  { cx: 170, cy: 640, rx: 32, ry: 23, wobble: 0.44, seed: 163, n: 28 },
  { cx: 280, cy: 600, rx: 32, ry: 25, wobble: 0.44, seed: 164, n: 28 },
  { cx: 360, cy: 635, rx: 30, ry: 23, wobble: 0.44, seed: 165, n: 28 },
  // Koralliriutat (SE): matalat riutta­saaret
  { cx: 620, cy: 530, rx: 28, ry: 23, wobble: 0.35, seed: 171, n: 26 },
  { cx: 730, cy: 510, rx: 30, ry: 24, wobble: 0.35, seed: 172, n: 26 },
  { cx: 840, cy: 545, rx: 28, ry: 23, wobble: 0.35, seed: 173, n: 26 },
  { cx: 700, cy: 610, rx: 29, ry: 23, wobble: 0.35, seed: 174, n: 26 },
  { cx: 905, cy: 620, rx: 30, ry: 24, wobble: 0.35, seed: 175, n: 26 },
  // Koristeluodot (ei-pelattavia, vyöhykkeiden ulkopuolella → neutraaleja)
  { cx: 475, cy: 520, rx: 8, ry: 6, wobble: 0.45, seed: 181, n: 10 },
  { cx: 530, cy: 645, rx: 9, ry: 7, wobble: 0.45, seed: 182, n: 10 },
  { cx: 602, cy: 140, rx: 6, ry: 5, wobble: 0.45, seed: 183, n: 10 },
  { cx: 950, cy: 475, rx: 7, ry: 5, wobble: 0.45, seed: 184, n: 10 },
  { cx: 35, cy: 250, rx: 7, ry: 5, wobble: 0.45, seed: 185, n: 10 },
];

const polys = SPECS.map(islandPoly);
const total = polys.reduce((s, p) => s + p.length, 0);
const body = `// GENEROITU tools/gen-saaristo.mjs:llä (tools/islands.mjs-sommittelija).
// Saaristomaailman käsin sommiteltu fantasia-arkkipelagi. ÄLÄ MUOKKAA KÄSIN.
export const LAND = ${JSON.stringify(polys)};
`;
writeFileSync('js/data/geo/saaristo-land.js', body);
console.log(`saaristo-land.js: ${polys.length} polygonia, ${total} pistettä, ${(body.length / 1024).toFixed(1)} KB`);
// Tulosta pelisaarten bboxit vyöhykerajojen asetteluun.
for (let i = 0; i < SPECS.length; i++) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of polys[i]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  console.log(`  #${i} (${SPECS[i].cx},${SPECS[i].cy}): x ${x0.toFixed(0)}..${x1.toFixed(0)}, y ${y0.toFixed(0)}..${y1.toFixed(0)}`);
}
