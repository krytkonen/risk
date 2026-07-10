// Automaattinen solmusiirtäjä: minimoi token/label-törmäykset pitäen solmut
// omalla vyöhykkeellään ja maalla, mahdollisimman lähellä alkuperäistä
// sijaintia. Ahne mäenkiipeily pienin siirroin. Tulostaa muuttuneet koordinaatit.
// Käyttö: node tools/mapfix.mjs <mapId>
import { MAPS, setActiveMap, TERRITORIES, TERRITORY_IDS } from '../js/data/territories.js';

const NODE_R = 21, LBL_DY = 34, LBL_H = 13, PXC = 6.2;
const mapId = process.argv[2];
setActiveMap(mapId);
const map = MAPS[mapId];
const T = TERRITORY_IDS.map((id) => ({ id, name: TERRITORIES[id].name, cont: TERRITORIES[id].continent, x0: TERRITORIES[id].x, y0: TERRITORIES[id].y, x: TERRITORIES[id].x, y: TERRITORIES[id].y }));

function inPolys(x, y, polys) {
  let ins = false;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
  }
  return ins;
}
const onLand = (x, y) => !map.geo || inPolys(x, y, map.geo.land);
const inZone = (t, x, y) => !map.zones || inPolys(x, y, [map.zones[t.cont]]);

function overlap(ax0, ax1, ay0, ay1, bx0, bx1, by0, by1) {
  const w = Math.min(ax1, bx1) - Math.max(ax0, bx0);
  const h = Math.min(ay1, by1) - Math.max(ay0, by0);
  return (w > 0 && h > 0) ? w * h + 40 : 0;
}
function loss(t, x, y) {
  let L = 0;
  const hw = (t.name.length * PXC) / 2;
  for (const o of T) {
    if (o.id === t.id) continue;
    const d = Math.hypot(x - o.x, y - o.y);
    if (d < 46) L += (46 - d) * 60;
    const ohw = (o.name.length * PXC) / 2;
    // oma label × toisen token
    L += overlap(x - hw, x + hw, y + LBL_DY - LBL_H / 2, y + LBL_DY + LBL_H / 2, o.x - NODE_R, o.x + NODE_R, o.y - NODE_R, o.y + NODE_R);
    // oma token × toisen label
    L += overlap(x - NODE_R, x + NODE_R, y - NODE_R, y + NODE_R, o.x - ohw, o.x + ohw, o.y + LBL_DY - LBL_H / 2, o.y + LBL_DY + LBL_H / 2);
    // label × label
    L += overlap(x - hw, x + hw, y + LBL_DY - LBL_H / 2, y + LBL_DY + LBL_H / 2, o.x - ohw, o.x + ohw, o.y + LBL_DY - LBL_H / 2, o.y + LBL_DY + LBL_H / 2) * 0.8;
  }
  L += Math.hypot(x - t.x0, y - t.y0) * 1.2; // ankkuri alkuperäiseen
  return L;
}

const DIRS = [];
for (const r of [6, 12, 20, 30]) for (let k = 0; k < 12; k++) DIRS.push([Math.round(Math.cos((k / 12) * 6.283) * r), Math.round(Math.sin((k / 12) * 6.283) * r)]);

for (let round = 0; round < 60; round++) {
  let moved = false;
  for (const t of T) {
    let bestL = loss(t, t.x, t.y), bx = t.x, by = t.y;
    for (const [dx, dy] of DIRS) {
      const nx = t.x + dx, ny = t.y + dy;
      if (!inZone(t, nx, ny) || !onLand(nx, ny)) continue;
      const L = loss(t, nx, ny);
      if (L < bestL - 0.5) { bestL = L; bx = nx; by = ny; }
    }
    if (bx !== t.x || by !== t.y) { t.x = bx; t.y = by; moved = true; }
  }
  if (!moved) break;
}
// Maalle pakotus niille jotka alkoivat mereltä eikä optimointi siirtänyt.
for (const t of T) {
  if (onLand(t.x, t.y)) continue;
  let best = null, bd = 1e9;
  for (let dx = -50; dx <= 50; dx += 3) for (let dy = -50; dy <= 50; dy += 3) {
    const nx = t.x + dx, ny = t.y + dy, d = dx * dx + dy * dy;
    if (d < bd && onLand(nx, ny) && inZone(t, nx, ny)) { bd = d; best = [nx, ny]; }
  }
  if (best) { t.x = best[0]; t.y = best[1]; }
}
const changed = T.filter((t) => t.x !== t.x0 || t.y !== t.y0);
console.log(`${changed.length} siirtoa:`);
for (const t of changed) console.log(`  '${t.id}': (${t.x0},${t.y0}) → (${t.x},${t.y})`);
console.log('\nPYTHON_SUBS = [');
for (const t of changed) console.log(` ("x: ${t.x0}, y: ${t.y0} }", "x: ${t.x}, y: ${t.y} }"),`);
console.log(']');
