// Maa-naapuruuden johtaminen RENDERÖIDYSTÄ geometriasta. Pelin näkyvät solut
// piirretään vyöhyke-Voronoina (render.js continentCells), mutta pelinaapuruus
// tuli aiemmin VAIN käsin kirjoitetusta särmälistasta → tiheillä kartoilla ne
// ajautuivat erilleen (näennäisesti vierekkäiset alueet eivät olleet hyökät-
// tävissä). Tämä moduuli rasteroi kartan täsmälleen kuten render (piste →
// vyöhyke = manner → lähin saman mantereen solmu) ja johtaa naapuruuden todella
// koskettavista soluista. Tulos memoloidaan karttaobjektiin (yksi rasterointi
// per kartan elinaika). Jaettu selaimen ja Node-testien kesken (ei DOM:ia).
//
// Käyttö kartan datassa: `landAdjacency: true`  → KAIKKI koskettavat parit
//   hyökättävissä (yksi maamassa / alue­kartat; merireitit jäävät särmälistaan).
// `landAdjacency: 'same'` → vain SAMAN mantereen koskettavat parit lisätään;
//   mantereiden väliset yhteydet pysyvät suunniteltuina kapeikkoina (maailman-
//   kartat, joissa mannerbonusten tasapaino nojaa rajattuihin ylityksiin).

const STEP = 3, MIN_BORDER = 6, W = 1000, H = 700;

function inPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/** Palauttaa (ja memoloi) joukon "a|b" (a<b) alueita joiden solut koskettavat maalla. */
export function deriveLandPairs(map) {
  if (map.__landPairs) return map.__landPairs;
  const land = map.geo ? map.geo.land : null;
  const zones = map.zones || null;
  const contIds = Object.keys(map.continents);
  const T = map.territories;
  const ids = Object.keys(T);
  const nodesByCont = {};
  for (const id of ids) (nodesByCont[T[id].continent] ||= []).push(id);
  // Maan bounding box → nopea hylkäys mereltä.
  let lx0 = 0, ly0 = 0, lx1 = W, ly1 = H;
  if (land) {
    lx0 = ly0 = Infinity; lx1 = ly1 = -Infinity;
    for (const p of land) for (const [x, y] of p) { if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; if (y < ly0) ly0 = y; if (y > ly1) ly1 = y; }
  }
  const onLand = (x, y) => !land || land.some((p) => inPoly(x, y, p));
  const owner = (x, y) => {
    if (x < lx0 || x > lx1 || y < ly0 || y > ly1) return null;
    if (!onLand(x, y)) return null;
    let cont = null;
    if (zones) { for (const c of contIds) if (zones[c] && inPoly(x, y, zones[c])) cont = c; if (!cont) return null; }
    else cont = contIds[0];
    let best = null, bd = Infinity;
    for (const id of nodesByCont[cont] || []) { const t = T[id]; const d = (t.x - x) ** 2 + (t.y - y) ** 2; if (d < bd) { bd = d; best = id; } }
    return best;
  };
  const cols = Math.ceil(W / STEP), rows = Math.ceil(H / STEP);
  const grid = new Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r * cols + c] = owner(c * STEP, r * STEP);
  const border = new Map();
  const bump = (a, b) => { if (!a || !b || a === b) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; border.set(k, (border.get(k) || 0) + STEP); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const o = grid[r * cols + c];
    if (c + 1 < cols) bump(o, grid[r * cols + c + 1]);
    if (r + 1 < rows) bump(o, grid[(r + 1) * cols + c]);
  }
  const set = new Set([...border.entries()].filter(([, l]) => l >= MIN_BORDER).map(([k]) => k));
  Object.defineProperty(map, '__landPairs', { value: set, enumerable: false, configurable: true });
  return set;
}

/**
 * Liittää geometriasta johdetut maa-naapuruudet kartan adj-listoihin.
 * Idempotentti + memoloitu. Vaikuttaa vain jos map.landAdjacency on asetettu.
 */
export function applyLandAdjacency(map) {
  if (!map || !map.landAdjacency || map.__landAdjApplied) return;
  const pairs = deriveLandPairs(map);
  const T = map.territories;
  const sameOnly = map.landAdjacency === 'same';
  for (const key of pairs) {
    const [a, b] = key.split('|');
    if (!T[a] || !T[b]) continue;
    if (sameOnly && T[a].continent !== T[b].continent) continue;
    if (!T[a].adj.includes(b)) T[a].adj.push(b);
    if (!T[b].adj.includes(a)) T[b].adj.push(a);
  }
  Object.defineProperty(map, '__landAdjApplied', { value: true, enumerable: false, configurable: true });
}
