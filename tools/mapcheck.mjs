// Kartan automaattinen laatutarkistus (kehitystyökalu):
//  1) token-parit ≥ 43 px (ympyrät eivät leikkaa)
//  2) nimilappu (y+34, fs 11) ei osu naapuritokeniin
//  3) nimilaput eivät osu toisiinsa (sama rivikaista)
//  4) geo-kartat: solmu oman vyöhykkeensä sisällä + maalla
// Käyttö: node tools/mapcheck.mjs [mapId ...]  (oletus: kaikki kartat)
import { MAPS, setActiveMap, TERRITORIES, TERRITORY_IDS } from '../js/data/territories.js';

const NODE_R = 21;
const LBL_DY = 34, LBL_H = 13, PX_PER_CHAR = 6.2;

function pointInPolys(x, y, polys) {
  let inside = false;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
let totalIssues = 0;
for (const mapId of ids) {
  setActiveMap(mapId);
  const map = MAPS[mapId];
  const issues = [];
  const T = TERRITORY_IDS.map((id) => ({ id, ...TERRITORIES[id] }));
  // 1) token-etäisyydet
  for (let a = 0; a < T.length; a++) for (let b = a + 1; b < T.length; b++) {
    const d = Math.hypot(T[a].x - T[b].x, T[a].y - T[b].y);
    if (d < 43) issues.push(`TOKEN  ${T[a].id} ↔ ${T[b].id}: ${d.toFixed(0)}px (<43)`);
  }
  // 2) nimilappu × token
  for (const t of T) {
    const ly = t.y + LBL_DY, hw = (t.name.length * PX_PER_CHAR) / 2;
    const l0 = t.x - hw, l1 = t.x + hw, r0 = ly - LBL_H / 2, r1 = ly + LBL_H / 2;
    for (const o of T) {
      if (o.id === t.id) continue;
      const ox0 = o.x - NODE_R, ox1 = o.x + NODE_R, oy0 = o.y - NODE_R, oy1 = o.y + NODE_R;
      const w = Math.min(l1, ox1) - Math.max(l0, ox0);
      const h = Math.min(r1, oy1) - Math.max(r0, oy0);
      if (w > 3 && h > 3) issues.push(`LABEL  "${t.name}" (${t.id}) osuu tokeniin ${o.id} (${w.toFixed(0)}×${h.toFixed(0)}px)`);
    }
  }
  // 3) nimilappu × nimilappu
  for (let a = 0; a < T.length; a++) for (let b = a + 1; b < T.length; b++) {
    const ta = T[a], tb = T[b];
    if (Math.abs((ta.y + LBL_DY) - (tb.y + LBL_DY)) > LBL_H - 2) continue;
    const hwA = (ta.name.length * PX_PER_CHAR) / 2, hwB = (tb.name.length * PX_PER_CHAR) / 2;
    const gap = Math.abs(ta.x - tb.x) - hwA - hwB;
    if (gap < -3) issues.push(`LBLLBL "${ta.name}" × "${tb.name}": limitys ${(-gap).toFixed(0)}px`);
  }
  // 4) geo: vyöhyke + maa
  if (map.geo && map.zones) {
    for (const t of T) {
      const zone = map.zones[t.continent];
      if (!zone) { issues.push(`ZONE   ${t.id}: mantereella ${t.continent} ei vyöhykettä`); continue; }
      if (!pointInPolys(t.x, t.y, [zone])) issues.push(`ZONE   ${t.id} (${t.x},${t.y}) EI ole vyöhykkeen ${t.continent} sisällä`);
      if (!pointInPolys(t.x, t.y, map.geo.land)) issues.push(`LAND   ${t.id} (${t.x},${t.y}) ei ole maalla (token kelluu meressä)`);
    }
  }
  console.log(`\n=== ${map.name} (${mapId}) — ${T.length} aluetta: ${issues.length ? issues.length + ' ONGELMAA' : 'OK'} ===`);
  for (const i of issues) console.log('  ' + i);
  totalIssues += issues.length;
}
process.exit(totalIssues ? 1 : 0);
