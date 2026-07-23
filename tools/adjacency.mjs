// Naapuruuden johtaminen RENDERÖIDYSTÄ geometriasta. Juurisyy pelattavuus-
// bugiin ("näennäisesti vierekkäiset maakunnat eivät ole yhteydessä"): peli-
// naapuruus (edges) on käsin kirjoitettu ERILLÄÄN näkyvistä soluista, jotka
// render.js laskee vyöhyke-Voronoina. Tämä työkalu rasteroi kartan täsmälleen
// kuten render (piste → vyöhyke = manner → lähin saman mantereen solmu) ja
// löytää parit joiden solut TODELLA koskettavat maalla. Tulos = aito maa-
// naapuruus, joka täsmää siihen mitä pelaaja näkee.
//
// Käyttö: node tools/adjacency.mjs <mapId> [step] [minBorderPx]
//   Tulostaa johdetun särmälistan + diffin karttadatan edges-listaan.
import { MAPS, setActiveMap, TERRITORIES, TERRITORY_IDS } from '../js/data/territories.js';

const mapId = process.argv[2];
const STEP = +(process.argv[3] || 2);
const MIN_BORDER = +(process.argv[4] || 6); // jaettua rajaa väh. näin monta px
if (!mapId || !MAPS[mapId]) { console.error('adjacency.mjs: anna kelpo mapId'); process.exit(1); }
setActiveMap(mapId);
const map = MAPS[mapId];

function inPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const land = map.geo ? map.geo.land : null;
const onLand = (x, y) => !land || land.some((p) => inPoly(x, y, p));
const zones = map.zones || null;
// Manner-avaimet piirtojärjestyksessä; päällekkäisyyksissä VIIMEINEN voittaa
// (kuten render piirtää myöhemmät mantereet päälle).
const contIds = Object.keys(map.continents);
const nodesByCont = {};
for (const id of TERRITORY_IDS) (nodesByCont[TERRITORIES[id].continent] ||= []).push(id);

// Piste → omistava alue (tai null jos meri/neutraali/pelin ulkopuolinen maa).
function owner(x, y) {
  if (!onLand(x, y)) return null;
  let cont = null;
  if (zones) {
    for (const c of contIds) if (zones[c] && inPoly(x, y, zones[c])) cont = c; // last wins
    if (!cont) return null; // neutraali maa (Ruotsi/Venäjä…)
  } else {
    cont = contIds[0];
  }
  let best = null, bd = Infinity;
  for (const id of nodesByCont[cont] || []) {
    const t = TERRITORIES[id];
    const d = (t.x - x) ** 2 + (t.y - y) ** 2;
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// Rasteroi ja kerää naapuriparien jaettu rajapituus (4-naapurusto).
const W = 1000, H = 700;
const cols = Math.ceil(W / STEP), rows = Math.ceil(H / STEP);
const grid = new Array(cols * rows);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r * cols + c] = owner(c * STEP, r * STEP);
const border = new Map();
const bump = (a, b) => {
  if (!a || !b || a === b) return;
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  border.set(k, (border.get(k) || 0) + STEP);
};
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const o = grid[r * cols + c];
  if (c + 1 < cols) bump(o, grid[r * cols + c + 1]);
  if (r + 1 < rows) bump(o, grid[(r + 1) * cols + c]);
}
const adj = [...border.entries()].filter(([, len]) => len >= MIN_BORDER).map(([k]) => k).sort();

// Vertaa karttadatan käsin kirjoitettuun särmälistaan.
const declared = new Set();
for (const id of TERRITORY_IDS) for (const n of TERRITORIES[id].adj) declared.add(id < n ? `${id}|${n}` : `${n}|${id}`);
const derived = new Set(adj);
const missing = [...derived].filter((k) => !declared.has(k)).sort();   // näkyy vierekkäin, EI pelinaapuri
const spurious = [...declared].filter((k) => !derived.has(k)).sort();  // pelinaapuri, EI näy koskettavan

console.log(`=== ${map.name} (${mapId}) — johdettu maanaapuruus (step ${STEP}px, min ${MIN_BORDER}px) ===`);
console.log(`Johdettuja maapareja: ${adj.length}, käsin: ${declared.size}`);
console.log(`\nPUUTTUU pelistä (solut koskettavat, ei särmää) — ${missing.length}:`);
for (const k of missing) console.log(`  ${k}  (${border.get(k)}px)`);
console.log(`\nYLIMÄÄRÄISIÄ särmiä (särmä on, solut EIVÄT kosketa maalla) — ${spurious.length}:`);
for (const k of spurious) console.log(`  ${k}`);

console.log('\n--- Johdettu edges-lista (maayhteydet) ---');
console.log('const landEdges = [');
let line = ' ';
for (const k of adj) {
  const [a, b] = k.split('|');
  const e = ` ['${a}', '${b}'],`;
  if (line.length + e.length > 96) { console.log(line); line = ' '; }
  line += e;
}
if (line.trim()) console.log(line);
console.log('];');
