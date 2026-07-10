// Taruvaltakuntien maamassan sommittelu → js/data/geo/taru-land.js.
// Muodot toistavat valtakuntien teemoja: vuonoinen jäärannikko, tulivuorikaari,
// sileä dyynimanner, poukamainen rannikko, iso metsämanner, kraaginen ylämaa.
import { writeFileSync } from 'node:fs';
import { islandPoly } from './islands.mjs';

const SPECS = [
  // Sydänmetsä: iso metsämanner (NW)
  { cx: 185, cy: 155, rx: 128, ry: 96, wobble: 0.3, seed: 7, n: 44 },
  // Ylämaa: kraaginen ylätasanko (N)
  { cx: 437, cy: 152, rx: 88, ry: 84, wobble: 0.46, seed: 11, n: 40 },
  // Jäätiköt: pitkä vuonorannikko (NE) + jääluodot
  { cx: 760, cy: 142, rx: 168, ry: 78, rot: -0.08, wobble: 0.5, seed: 23, n: 52 },
  { cx: 585, cy: 58, rx: 16, ry: 11, wobble: 0.4, seed: 24, n: 14 },
  // Rannikko: poukamainen saari (SW) + helmiluodot
  { cx: 228, cy: 392, rx: 118, ry: 88, wobble: 0.44, seed: 31, n: 46 },
  { cx: 352, cy: 492, rx: 12, ry: 9, wobble: 0.4, seed: 33, n: 12 },
  { cx: 330, cy: 522, rx: 8, ry: 6, wobble: 0.4, seed: 34, n: 10 },
  // Tulivuoret: neljän keilasaaren kaari (S)
  { cx: 432, cy: 346, rx: 52, ry: 46, wobble: 0.5, seed: 41, n: 30 },
  { cx: 527, cy: 416, rx: 50, ry: 44, wobble: 0.5, seed: 43, n: 30 },
  { cx: 422, cy: 477, rx: 50, ry: 45, wobble: 0.48, seed: 47, n: 30 },
  { cx: 508, cy: 547, rx: 46, ry: 42, wobble: 0.5, seed: 53, n: 30 },
  // Aavikot: leveä sileä dyynimanner (SE)
  { cx: 742, cy: 442, rx: 142, ry: 128, wobble: 0.18, seed: 61, n: 48 },
  // Koristeluodot (ei-pelattavia, vyöhykkeiden ulkopuolella → neutraaleja)
  { cx: 45, cy: 300, rx: 9, ry: 7, wobble: 0.45, seed: 71, n: 10 },
  { cx: 90, cy: 578, rx: 12, ry: 9, wobble: 0.45, seed: 72, n: 12 },
  { cx: 500, cy: 656, rx: 10, ry: 7, wobble: 0.45, seed: 73, n: 10 },
  { cx: 968, cy: 306, rx: 8, ry: 7, wobble: 0.45, seed: 74, n: 10 },
  { cx: 302, cy: 648, rx: 7, ry: 5, wobble: 0.45, seed: 75, n: 10 },
  { cx: 556, cy: 652, rx: 8, ry: 6, wobble: 0.45, seed: 76, n: 10 },
];

const polys = SPECS.map(islandPoly);
const total = polys.reduce((s, p) => s + p.length, 0);
const body = `// GENEROITU tools/gen-taru.mjs:llä (tools/islands.mjs-sommittelija).
// Taruvaltakuntien käsin sommiteltu fantasiamaailma. ÄLÄ MUOKKAA KÄSIN.
export const LAND = ${JSON.stringify(polys)};
`;
writeFileSync('js/data/geo/taru-land.js', body);
console.log(`taru-land.js: ${polys.length} polygonia, ${total} pistettä, ${(body.length / 1024).toFixed(1)} KB`);
