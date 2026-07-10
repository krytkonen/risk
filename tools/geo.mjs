// Geodata-putki: Natural Earth GeoJSON → pelin koordinaatistoon projisoidut,
// yksinkertaistetut maapolygonit. Ajetaan KEHITYSAIKANA (tulos committoidaan
// js/data/geo/-tiedostoksi) — ei ajonaikaista riippuvuutta verkkoon.
//
// Käyttö: node tools/geo.mjs <geojson> <out.js> <lonMin> <lonMax> <latMin> <latMax>
//         [tolPx=1.6] [minIslandPx=7] [x0=25] [y0=30] [w=950] [h=640]
// Projektio: Miller (kompromissi Mercatorin ja tasavälisen välillä — klassinen
// maailmankartan näkymä ilman napojen räjähtämistä).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , src, out, lonMinS, lonMaxS, latMinS, latMaxS,
  tolS = '1.6', minIslS = '7', x0S = '25', y0S = '30', wS = '950', hS = '640',
  stretchS = '1'] = process.argv;
if (!src || !out) { console.error('geo.mjs: anna lähde ja kohde'); process.exit(1); }
const lonMin = +lonMinS, lonMax = +lonMaxS, latMin = +latMinS, latMax = +latMaxS;
const tol = +tolS, minIsl = +minIslS, X0 = +x0S, Y0 = +y0S, W = +wS, H = +hS;
const STRETCH = +stretchS; // pysty­venytys (pelikarttojen tapaan), 1 = ei

const rad = (d) => (d * Math.PI) / 180;
const millerY = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * rad(lat)));

// Sovita ikkuna kohdesuorakaiteeseen mittakaava säilyttäen (ei venytystä).
const mx0 = rad(lonMin), mx1 = rad(lonMax);
const myTop = millerY(latMax), myBot = millerY(latMin); // myTop > myBot
const scaleX = Math.min(W / (mx1 - mx0), (H / (myTop - myBot)) * 2); // ei hulluja venytyksiä
const scaleY = Math.min(scaleX * STRETCH, H / (myTop - myBot));
const ox = X0 + (W - (mx1 - mx0) * scaleX) / 2;
const oy = Y0 + (H - (myTop - myBot) * scaleY) / 2;
const project = ([lon, lat]) => [
  ox + (rad(lon) - mx0) * scaleX,
  oy + (myTop - millerY(lat)) * scaleY, // y kasvaa alaspäin
];

// Sutherland–Hodgman-leikkaus ikkunaan (lon/lat-suorakaide, konveksi).
function clipRect(ring) {
  const planes = [
    (p) => p[0] >= lonMin, (p) => p[0] <= lonMax,
    (p) => p[1] >= latMin, (p) => p[1] <= latMax,
  ];
  const inter = (a, b, axis, v) => {
    const t = (v - a[axis]) / (b[axis] - a[axis]);
    return axis === 0 ? [v, a[1] + (b[1] - a[1]) * t] : [a[0] + (b[0] - a[0]) * t, v];
  };
  const vals = [[0, lonMin], [0, lonMax], [1, latMin], [1, latMax]];
  let poly = ring;
  for (let k = 0; k < 4; k++) {
    const inside = planes[k]; const [axis, v] = vals[k];
    const outp = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ia = inside(a), ib = inside(b);
      if (ia) outp.push(a);
      if (ia !== ib) outp.push(inter(a, b, axis, v));
    }
    poly = outp;
    if (poly.length < 3) return [];
  }
  return poly;
}

// Douglas–Peucker projisoituihin pikseleihin.
function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [ax, ay] = pts[i0], [bx, by] = pts[i1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxD = -1, maxI = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = pts[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const qx = ax + t * dx, qy = ay + t * dy;
      const d = (px - qx) ** 2 + (py - qy) ** 2;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > eps * eps) { keep[maxI] = true; stack.push([i0, maxI], [maxI, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const gj = JSON.parse(readFileSync(src, 'utf8'));
const rings = [];
for (const f of gj.features) {
  const geom = f.geometry;
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) rings.push(poly[0]); // vain ulkokehät (ei järviä)
}

const outPolys = [];
for (const ring of rings) {
  const clipped = clipRect(ring);
  if (clipped.length < 3) continue;
  let pts = clipped.map(project);
  // bbox-diagonaali → pudota mikrosaaret.
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (Math.hypot(maxX - minX, maxY - minY) < minIsl) continue;
  pts = simplify(pts, tol);
  if (pts.length < 3) continue;
  outPolys.push(pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}
outPolys.sort((a, b) => b.length - a.length);

const totalPts = outPolys.reduce((s, p) => s + p.length, 0);
const body = `// GENEROITU tools/geo.mjs:llä Natural Earth -datasta (public domain).
// Ikkuna lon ${lonMin}..${lonMax}, lat ${latMin}..${latMax} → Miller-projektio.
// ${outPolys.length} polygonia, ${totalPts} pistettä. ÄLÄ MUOKKAA KÄSIN.
export const LAND = ${JSON.stringify(outPolys)};
export const PROJ = { lonMin: ${lonMin}, lonMax: ${lonMax}, latMin: ${latMin}, latMax: ${latMax}, x0: ${X0}, y0: ${Y0}, w: ${W}, h: ${H} };
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, body);
console.log(`${out}: ${outPolys.length} polygonia, ${totalPts} pistettä, ${(body.length / 1024).toFixed(1)} KB`);

// Apuri: tulosta projisoituja referenssipisteitä (lon,lat → x,y) argumentilla PTS.
if (process.env.PTS) {
  for (const spec of process.env.PTS.split(';')) {
    const [name, lon, lat] = spec.split(',');
    const [x, y] = project([+lon, +lat]);
    console.log(`  ${name}: [${Math.round(x)}, ${Math.round(y)}]`);
  }
}
