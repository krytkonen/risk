// Kartan piirto SVG:nä pelitilasta. Piirtää meren, mannerlaatikot,
// naapuruusviivat, aluenapit (armeijamäärä) ja korostukset valinnoille.
// Ei pelilogiikkaa – vain visualisointi + napautusten välitys.

import { TERRITORIES, TERRITORY_IDS, CONTINENTS, continentTerritories } from '../data/territories.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const NODE_R = 21;

export const PLAYER_COLORS = ['#2f7bd6', '#d63b3b', '#3aa84a', '#e0a020', '#9b59c6', '#16a89a'];
export const PLAYER_COLORS_DARK = ['#1d4f8a', '#8e2424', '#246b2f', '#946a12', '#653a82', '#0d6b62'];
// Vaaleammat keskisävyt napin radiaaligradientin keskelle (syvyysvaikutelma).
const PLAYER_COLORS_LIGHT = ['#7db4f0', '#f08585', '#7ed98e', '#f5cf6a', '#c79be0', '#5fd6c8'];
const NEUTRAL_LIGHT = '#8a8a8a', NEUTRAL_MID = '#555', NEUTRAL_DARK = '#333';

const FOG_HOLE_R = 70; // sumun läpi paljastuvan "portin" säde

// Omistajakohtaiset reunusrenkaan katkoviivakuviot (värisokeusystävällisyys:
// omistaja erottuu kuviosta ilman väriäkin). Indeksi = pelaajaindeksi.
const RIM_DASH = ['none', '6 3', '2 3', '8 2 2 2', '1 4', '10 4'];
const RIM_DASH_NEUTRAL = '1.5 4.5';

function el(name, attrs = {}) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function continentBounds(contId) {
  const ids = continentTerritories(contId);
  const xs = ids.map((i) => TERRITORIES[i].x);
  const ys = ids.map((i) => TERRITORIES[i].y);
  const pad = 38;
  return {
    x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + pad * 2,
    h: Math.max(...ys) - Math.min(...ys) + pad * 2,
  };
}

// --- Värityökalut per-map sävytystä varten -------------------------------

/** #rrggbb -> {r,g,b}. */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Sekoita kaksi väriä suhteessa t (0 = a, 1 = b). */
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

// --- Alue-REGIONIEN täyttövärit (esilaskettu kerran moduulitasolla) --------
// Pelaajan väri tummennettuna merensiniseen päin: lauta pysyy tyylikkäänä eikä
// huuda, mutta omistaja erottuu yhdellä silmäyksellä kuten oikeassa laudassa.
const REGION_FILL = PLAYER_COLORS.map((c) => mix(c, '#0a1c2e', 0.45));
const REGION_FILL_NEUTRAL = mix('#7a8894', '#0a1c2e', 0.55);
const REGION_FILL_FOG = '#131c26';
const REGION_FILL_BLIZZARD = '#9fc2d6';

/**
 * Laske kartan "mieliala" mantereiden keskivärin lämpötilana (-1 viileä .. +1 lämmin).
 * Lämmin = punaista enemmän kuin sinistä (esim. antiikin okra), viileä = päinvastoin.
 */
function mapWarmth() {
  const cols = Object.values(CONTINENTS).map((c) => c.color);
  if (!cols.length) return 0;
  let r = 0, g = 0, b = 0;
  for (const c of cols) { const v = hexToRgb(c); r += v.r; g += v.g; b += v.b; }
  const n = cols.length;
  r /= n; g /= n; b /= n;
  // Normalisoi -1..1 punaisuus vs. sinisyys.
  return Math.max(-1, Math.min(1, (r - b) / 160));
}

/** Lisää kaikki gradientit ja filtterit <defs>-elementtiin. */
function buildDefs(warmth = 0) {
  const defs = el('defs');

  // Sävytä meri & vinjetti kartan mielialan mukaan (hienovaraisesti).
  // Lämpimämmissä kartoissa hieman ruskeahko/teal-sävyinen syvyys, viileissä sininen.
  const seaTop = mix('#1b3e5e', warmth > 0 ? '#244e56' : '#163a60', Math.abs(warmth) * 0.5);
  const seaMid = mix('#12304c', warmth > 0 ? '#173a3e' : '#0f2c4e', Math.abs(warmth) * 0.5);
  const seaBot = mix('#081523', warmth > 0 ? '#0a1816' : '#06121f', Math.abs(warmth) * 0.5);
  const glowCol = warmth > 0 ? '#2a6a6e' : '#1e5a78';

  // --- Meri: syvä monipysäkkinen radiaaligradientti (rikkaampi syvyys). ---
  const sea = el('radialGradient', { id: 'sea', cx: '50%', cy: '38%', r: '85%' });
  sea.appendChild(el('stop', { offset: '0%', 'stop-color': mix(seaTop, '#ffffff', 0.06) }));
  sea.appendChild(el('stop', { offset: '30%', 'stop-color': seaTop }));
  sea.appendChild(el('stop', { offset: '55%', 'stop-color': mix(seaTop, seaMid, 0.65) }));
  sea.appendChild(el('stop', { offset: '78%', 'stop-color': seaMid }));
  sea.appendChild(el('stop', { offset: '100%', 'stop-color': seaBot }));
  defs.appendChild(sea);

  // --- Meren syvyyshehku: nostaa laudan mustasta taustasta. ---
  const seaGlow = el('radialGradient', { id: 'sea-glow', cx: '50%', cy: '40%', r: '65%' });
  seaGlow.appendChild(el('stop', { offset: '0%', 'stop-color': glowCol, 'stop-opacity': 1 }));
  seaGlow.appendChild(el('stop', { offset: '60%', 'stop-color': glowCol, 'stop-opacity': 0 }));
  defs.appendChild(seaGlow);

  const seaSheen = el('linearGradient', { id: 'sea-sheen', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  seaSheen.appendChild(el('stop', { offset: '0%', 'stop-color': '#2a5680', 'stop-opacity': 0.35 }));
  seaSheen.appendChild(el('stop', { offset: '45%', 'stop-color': '#10283f', 'stop-opacity': 0 }));
  seaSheen.appendChild(el('stop', { offset: '100%', 'stop-color': '#040d16', 'stop-opacity': 0.45 }));
  defs.appendChild(seaSheen);

  // --- Vinjetti reunoille (tummennus); sävy lämpötilan mukaan. ---
  const vigCol = warmth > 0 ? mix('#000000', '#1a0c00', Math.abs(warmth) * 0.6) : '#000000';
  const vignette = el('radialGradient', { id: 'vignette', cx: '50%', cy: '50%', r: '72%' });
  vignette.appendChild(el('stop', { offset: '60%', 'stop-color': vigCol, 'stop-opacity': 0 }));
  vignette.appendChild(el('stop', { offset: '100%', 'stop-color': vigCol, 'stop-opacity': 0.42 }));
  defs.appendChild(vignette);

  // --- Hienovarainen kohina meren päälle (syvyys/tekstuuri). ---
  // STAATTINEN, rasteroidaan kerran. EI <animate>-elementtiä: jatkuva
  // turbulenssin animointi rasteroisi koko kerroksen joka framella = lagi.
  const noise = el('filter', { id: 'sea-noise', x: '0%', y: '0%', width: '100%', height: '100%' });
  noise.appendChild(el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012 0.018', numOctaves: 2, seed: 7, result: 'n' }));
  const noiseCm = el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0' });
  noise.appendChild(noiseCm);
  defs.appendChild(noise);

  // --- Pehmeä varjo napeille. ---
  const nodeShadow = el('filter', { id: 'node-shadow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  const dropB = el('feDropShadow', { dx: 0, dy: 2, stdDeviation: 2.2, 'flood-color': '#000', 'flood-opacity': 0.55 });
  nodeShadow.appendChild(dropB);
  defs.appendChild(nodeShadow);

  // --- Pehmeä hehku korostuksille (haloille). ---
  const glow = el('filter', { id: 'halo-glow', x: '-80%', y: '-80%', width: '260%', height: '260%' });
  glow.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 3, result: 'blur' }));
  const gMerge = el('feMerge');
  gMerge.appendChild(el('feMergeNode', { in: 'blur' }));
  gMerge.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(gMerge);
  defs.appendChild(glow);

  // --- Manneraneelien pehmeä varjo. ---
  const contShadow = el('filter', { id: 'cont-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  contShadow.appendChild(el('feDropShadow', { dx: 0, dy: 3, stdDeviation: 5, 'flood-color': '#000', 'flood-opacity': 0.3 }));
  defs.appendChild(contShadow);

  // --- Pehmeä reunainen maski-radial (valkoinen keskus -> musta reuna). ---
  // Sumukerros on litteä väri + tämä maski (ei turbulenssia/blurria) =
  // halpa komposointi myös karttaa raahatessa.
  const maskSoft = el('radialGradient', { id: 'mask-soft', cx: '50%', cy: '50%', r: '50%' });
  maskSoft.appendChild(el('stop', { offset: '0%', 'stop-color': '#fff' }));
  maskSoft.appendChild(el('stop', { offset: '55%', 'stop-color': '#fff' }));
  maskSoft.appendChild(el('stop', { offset: '100%', 'stop-color': '#000' }));
  defs.appendChild(maskSoft);

  // --- Pakkashehku jäätyneen napin taakse (valkoinen -> läpinäkyvä). ---
  const chill = el('radialGradient', { id: 'chill-glow', cx: '50%', cy: '50%', r: '50%' });
  chill.appendChild(el('stop', { offset: '0%', 'stop-color': '#dff4ff', 'stop-opacity': 0.85 }));
  chill.appendChild(el('stop', { offset: '60%', 'stop-color': '#bfe6ef', 'stop-opacity': 0.25 }));
  chill.appendChild(el('stop', { offset: '100%', 'stop-color': '#bfe6ef', 'stop-opacity': 0 }));
  defs.appendChild(chill);

  // --- Per-pelaaja radiaaligradientit napin täytölle (vaalea keskus → tumma reuna). ---
  // Tiukennettu highlight (cx36% cy30% r66%) -> emaloitu, terävä markkeri.
  for (let i = 0; i < PLAYER_COLORS.length; i++) {
    const g = el('radialGradient', { id: `node-grad-${i}`, cx: '36%', cy: '30%', r: '66%' });
    g.appendChild(el('stop', { offset: '0%', 'stop-color': PLAYER_COLORS_LIGHT[i] }));
    g.appendChild(el('stop', { offset: '55%', 'stop-color': PLAYER_COLORS[i] }));
    g.appendChild(el('stop', { offset: '100%', 'stop-color': PLAYER_COLORS_DARK[i] }));
    defs.appendChild(g);
  }
  // Neutraali (omistamaton) alue.
  const ng = el('radialGradient', { id: 'node-grad-neutral', cx: '36%', cy: '30%', r: '66%' });
  ng.appendChild(el('stop', { offset: '0%', 'stop-color': NEUTRAL_LIGHT }));
  ng.appendChild(el('stop', { offset: '60%', 'stop-color': NEUTRAL_MID }));
  ng.appendChild(el('stop', { offset: '100%', 'stop-color': NEUTRAL_DARK }));
  defs.appendChild(ng);

  // Sumun peittämä (fog of war) alue: tumma, ei paljasta omistajaa.
  const fg = el('radialGradient', { id: 'node-grad-fog', cx: '36%', cy: '30%', r: '66%' });
  fg.appendChild(el('stop', { offset: '0%', 'stop-color': '#2b3a49' }));
  fg.appendChild(el('stop', { offset: '100%', 'stop-color': '#161f29' }));
  defs.appendChild(fg);

  // Lumimyrskyn sulkema alue: jäinen vaalea sini-valkoinen.
  const bz = el('radialGradient', { id: 'node-grad-blizzard', cx: '36%', cy: '28%', r: '68%' });
  bz.appendChild(el('stop', { offset: '0%', 'stop-color': '#f2fbff' }));
  bz.appendChild(el('stop', { offset: '55%', 'stop-color': '#cfe9f7' }));
  bz.appendChild(el('stop', { offset: '100%', 'stop-color': '#8fb6cc' }));
  defs.appendChild(bz);

  // --- Per-manner lineaarigradientit maamassan täytölle (ylhäältä vaaleampi,
  // alhaalta tummempi) – korvaa litteän fill-opacityn ilman suodattimia. ---
  Object.values(CONTINENTS).forEach((cont, ci) => {
    const c = cont.color;
    const lg = el('linearGradient', { id: `cont-grad-${ci}`, x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
    lg.appendChild(el('stop', { offset: '0%', 'stop-color': mix(c, '#ffffff', 0.22), 'stop-opacity': 0.34 }));
    lg.appendChild(el('stop', { offset: '55%', 'stop-color': c, 'stop-opacity': 0.24 }));
    lg.appendChild(el('stop', { offset: '100%', 'stop-color': mix(c, '#000000', 0.35), 'stop-opacity': 0.3 }));
    defs.appendChild(lg);
  });

  return defs;
}

// --- Mannermuodot: konveksi peite pehmennettynä maamassaksi ----------------

/** Konveksi peite (Andrew'n monotone chain). */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/** Suljettu murtoviivapolku (ei pehmennystä) pistejoukon läpi.
 * Koordinaatit pyöristetään 0.1 tarkkuuteen. Käytetään sekä rantaviivaan
 * että Voronoi-soluihin, jotta solut ja rannikko osuvat täsmälleen yhteen. */
function closedPolyPath(pts) {
  const f = (v) => v.toFixed(1);
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${f(pts[i].x)} ${f(pts[i].y)}`;
  return d + ' Z';
}

// --- Voronoi-solut puolitasoleikkauksella ----------------------------------

/**
 * Sutherland–Hodgman-leikkaus puolitasoa vasten: säilytä pisteet jotka ovat
 * lähempänä sitea si kuin sj, ts. dot(p - m, sj - si) <= 0 missä m on
 * keskipiste. Palauttaa { poly, cut }: cut kertoo leikkasiko puolittaja
 * monikulmiota oikeasti (jokin kärki oli ulkopuolella) → sj on Voronoi-naapuri.
 */
function clipHalfPlane(poly, si, sj) {
  const mx = (si.x + sj.x) / 2, my = (si.y + sj.y) / 2;
  const dx = sj.x - si.x, dy = sj.y - si.y;
  const side = (p) => (p.x - mx) * dx + (p.y - my) * dy;
  const out = [];
  let cut = false;
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const a = poly[k], b = poly[(k + 1) % n];
    const sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    else cut = true;
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return { poly: out, cut };
}

/** Varasolu degeneroituneelle tulokselle: pieni 10-kulmio siten sitensä ympärillä. */
function fallbackCell(site, r = 34) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const ang = (Math.PI * 2 * k) / 10;
    pts.push({ x: site.x + Math.cos(ang) * r, y: site.y + Math.sin(ang) * r });
  }
  return pts;
}

/**
 * Mantereen Voronoi-solut: kullekin alueelle mantereen ääriviivamonikulmio
 * leikattuna jokaisen saman mantereen sisaralueen puolittajaa vasten.
 * Palauttaa { cells: {id: pts[]}, pairs: Set<'a|b'> } missä pairs sisältää
 * Voronoi-naapuriparit (a < b). Lasketaan KERRAN buildMapissa.
 */
function continentCells(ids, outlinePts) {
  const cells = {};
  const pairs = new Set();
  for (const i of ids) {
    const si = TERRITORIES[i];
    let poly = outlinePts;
    for (const j of ids) {
      if (j === i) continue;
      const res = clipHalfPlane(poly, si, TERRITORIES[j]);
      if (res.cut) pairs.add(i < j ? `${i}|${j}` : `${j}|${i}`);
      poly = res.poly;
      if (poly.length < 3) break;
    }
    cells[i] = poly.length >= 3 ? poly : fallbackCell(si);
  }
  return { cells, pairs };
}

/**
 * Kahden solun jaettu rajajakso: solun i särmät joiden molemmat päätepisteet
 * ovat yhtä kaukana siteistä i ja j (eps ~0.5). Palauttaa jakson kaksi
 * ääripäätä {a,b} tai null jos jaettua rajaa ei (enää) ole.
 */
function sharedBorder(cell, si, sj, eps = 0.5) {
  const eq = (p) => Math.abs(Math.hypot(p.x - si.x, p.y - si.y) - Math.hypot(p.x - sj.x, p.y - sj.y)) < eps;
  const verts = [];
  const n = cell.length;
  for (let k = 0; k < n; k++) {
    const a = cell[k], b = cell[(k + 1) % n];
    if (eq(a) && eq(b)) { verts.push(a); verts.push(b); }
  }
  if (verts.length < 2) return null;
  let best = null, bestD = -1;
  for (let a = 0; a < verts.length; a++) {
    for (let b = a + 1; b < verts.length; b++) {
      const d = Math.hypot(verts[a].x - verts[b].x, verts[a].y - verts[b].y);
      if (d > bestD) { bestD = d; best = { a: verts[a], b: verts[b] }; }
    }
  }
  return bestD > 0 ? best : null;
}

/**
 * Vuoristoharjanteen siksak-polut jaetun rajan keskimmäiselle ~70 %:lle:
 * "raja jota ei voi ylittää" saman mantereen ei-naapurien välillä.
 * Palauttaa { d, d2 } (tumma harjanne + vaalea korostus) tai null jos raja
 * on liian lyhyt merkittäväksi.
 */
function ridgePaths(A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const L = Math.hypot(dx, dy);
  if (L < 14) return null;
  const ax = A.x + dx * 0.15, ay = A.y + dy * 0.15;
  const bx = A.x + dx * 0.85, by = A.y + dy * 0.85;
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const segs = Math.max(2, Math.round((L * 0.7) / 9));
  const f = (v) => v.toFixed(1);
  const zig = (off) => {
    let d = `M ${f(ax + px * off)} ${f(ay + py * off)}`;
    for (let k = 1; k < segs; k++) {
      const t = k / segs;
      const amp = (k % 2 ? 3 : -3) + off;
      d += ` L ${f(ax + (bx - ax) * t + px * amp)} ${f(ay + (by - ay) * t + py * amp)}`;
    }
    return d + ` L ${f(bx + px * off)} ${f(by + py * off)}`;
  };
  return { d: zig(0), d2: zig(1.2) };
}

/**
 * Deterministinen pseudokohina -1..1 (sin-hash). Sama (a,b) -> sama arvo,
 * joten rantaviivat ovat pysyviä joka latauksella – ei satunnaisuutta.
 */
function seededNoise(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Tihennä suljettu monikulmio (~step px välein lisäpisteitä) ja rosoita
 * jokainen piste normaalin suuntaan seedatulla kohinalla. Tulos: uskottavan
 * rikkonainen rantaviiva puhtaana polkudatana – nolla ajonaikaista kustannusta.
 * Amplitudi on rajattu (amp << laajennuspad), joten muoto ei vuoda naapureihin.
 */
function densifyAndJitter(pts, seed, step = 40, amp = 8) {
  const dense = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    dense.push({ x: a.x, y: a.y });
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const segs = Math.floor(d / step);
    for (let k = 1; k <= segs; k++) {
      const t = k / (segs + 1);
      dense.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  const m = dense.length;
  return dense.map((p, i) => {
    const prev = dense[(i - 1 + m) % m], next = dense[(i + 1) % m];
    let nx = next.y - prev.y, ny = -(next.x - prev.x);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const tx = (next.x - prev.x) / len, ty = (next.y - prev.y) / len;
    const j = seededNoise(seed, i) * amp;              // normaalin suuntaan
    const j2 = seededNoise(seed + 57, i) * amp * 0.35; // kevyt tangentiaalinen huojunta
    return { x: p.x + nx * j + tx * j2, y: p.y + ny * j + ty * j2 };
  });
}

/** Siirrä pisteitä säteittäin keskipisteestä d verran (+ ulos, - sisään). */
function offsetRadial(pts, cx, cy, d) {
  return pts.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * d, y: p.y + (dy / len) * d };
  });
}

/**
 * Mannermuodon ääriviivapisteet: alueiden koordinaattien konveksi peite,
 * laajennettu ulospäin keskipisteestä, tihennetty ja rosoitettu orgaaniseksi
 * rantaviivaksi. Pienille mantereille (1–2 aluetta) kahdeksankulmainen "saari".
 * Palauttaa { pts, cx, cy } jotta samasta ääriviivasta voi johtaa shelf-/
 * highlight-versiot säteittäisellä siirrolla.
 */
function continentOutline(contId, seed, pad = 50) {
  const ids = continentTerritories(contId);
  const points = ids.map((i) => ({ x: TERRITORIES[i].x, y: TERRITORIES[i].y }));
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  let base;
  const hull = convexHull(points);
  if (hull.length < 3) {
    // Liian vähän pisteitä peitteeksi: tee kahdeksankulmio bbox-keskuksen ympäri.
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const w = Math.max(40, Math.max(...xs) - Math.min(...xs)) / 2 + pad;
    const h = Math.max(40, Math.max(...ys) - Math.min(...ys)) / 2 + pad;
    const oct = [];
    for (let k = 0; k < 8; k++) {
      const ang = (Math.PI * 2 * k) / 8 - Math.PI / 2;
      oct.push({ x: cx + Math.cos(ang) * w, y: cy + Math.sin(ang) * h });
    }
    base = oct;
  } else {
    // Laajenna jokainen peitteen kärki säteittäin ulospäin keskipisteestä.
    base = hull.map((p) => {
      const dx = p.x - cx, dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
    });
  }
  return { pts: densifyAndJitter(base, seed * 13 + 3, 40, 8), cx, cy };
}

// --- Staattiset merikoristeet (aaltoglyyfit + kompassiruusu) ---------------

/** Pienin etäisyys pisteestä mihinkään alueeseen. */
function minDistToTerritories(x, y) {
  let best = Infinity;
  for (const id of TERRITORY_IDS) {
    const t = TERRITORIES[id];
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < best) best = d;
  }
  return best;
}

/** Sirottele muutama pieni aaltoglyyfi avomerelle (kauas alueista). */
function buildWaveGlyphs() {
  const g = el('g', { 'class': 'sea-deco', 'pointer-events': 'none' });
  const spots = [];
  for (let x = 90; x <= 910; x += 115) {
    for (let y = 80; y <= 620; y += 105) {
      const d = minDistToTerritories(x, y);
      if (d > 100) spots.push({ x, y, d });
    }
  }
  spots.sort((a, b) => b.d - a.d);
  const chosen = [];
  for (const s of spots) {
    if (chosen.length >= 5) break;
    if (chosen.every((c) => Math.hypot(c.x - s.x, c.y - s.y) > 140)) chosen.push(s);
  }
  chosen.forEach((s, i) => {
    // Deterministinen pieni siirtymä, ettei ruudukko erotu.
    const ox = seededNoise(11, i) * 18, oy = seededNoise(23, i) * 12;
    const x = s.x + ox, y = s.y + oy;
    const wave = (wx, wy, w) => el('path', {
      d: `M ${(wx - w).toFixed(1)} ${wy.toFixed(1)} q ${(w / 2).toFixed(1)} -5 ${w.toFixed(1)} 0 q ${(w / 2).toFixed(1)} 5 ${w.toFixed(1)} 0`,
      fill: 'none', stroke: '#a8d4f0', 'stroke-width': 1.3, 'stroke-linecap': 'round',
      'stroke-opacity': 0.16,
    });
    g.appendChild(wave(x, y, 9));
    const w2 = wave(x + 4, y + 7, 6);
    w2.setAttribute('stroke-opacity', '0.11');
    g.appendChild(w2);
  });
  return g;
}

/** 8-sakarainen tähtipolku (vuorotellen ulko-/sisäsäde). */
function starPath(cx, cy, rOut, rIn, rot) {
  let d = '';
  for (let k = 0; k < 8; k++) {
    const ang = (Math.PI / 4) * k + rot;
    const r = k % 2 === 0 ? rOut : rIn;
    d += `${k === 0 ? 'M' : 'L'} ${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy + Math.sin(ang) * r).toFixed(1)} `;
  }
  return d + 'Z';
}

/** Proseduraalinen kompassiruusu tyhjimpään kulmaan (staattinen, himmeä). */
function buildCompassRose() {
  const corners = [
    { x: 78, y: 92 }, { x: 922, y: 92 }, { x: 78, y: 608 }, { x: 922, y: 608 },
  ];
  let best = corners[0], bestD = -1;
  for (const c of corners) {
    const d = minDistToTerritories(c.x, c.y);
    if (d > bestD) { bestD = d; best = c; }
  }
  const { x, y } = best;
  const ink = '#9fc4e8';
  const g = el('g', { 'class': 'sea-deco compass-rose', 'pointer-events': 'none' });
  g.appendChild(el('circle', { cx: x, cy: y, r: 26, fill: 'none', stroke: ink, 'stroke-opacity': 0.22, 'stroke-width': 1 }));
  g.appendChild(el('circle', { cx: x, cy: y, r: 21, fill: 'none', stroke: ink, 'stroke-opacity': 0.1, 'stroke-width': 0.75 }));
  // Diagonaalitähti (lyhyet sakarat) alle, pääilmansuunnat (pitkät) päälle.
  g.appendChild(el('path', { d: starPath(x, y, 12, 3.5, -Math.PI / 4), fill: ink, 'fill-opacity': 0.12, stroke: ink, 'stroke-opacity': 0.18, 'stroke-width': 0.75 }));
  g.appendChild(el('path', { d: starPath(x, y, 22, 4.5, -Math.PI / 2), fill: ink, 'fill-opacity': 0.18, stroke: ink, 'stroke-opacity': 0.32, 'stroke-width': 1 }));
  g.appendChild(el('circle', { cx: x, cy: y, r: 2, fill: ink, 'fill-opacity': 0.4 }));
  const n = el('text', {
    x, y: y - 30, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700,
    fill: ink, 'fill-opacity': 0.45, 'letter-spacing': 1,
  });
  n.textContent = 'N';
  g.appendChild(n);
  return g;
}

/** Rakentaa staattisen kartan kerran (mantereet + viivat + napit). */
export function buildMap(svg, onTap) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', '0 0 1000 700');

  const warmth = mapWarmth();
  svg.appendChild(buildDefs(warmth));

  // Meri – kerroksittain: pohjagradientti, syvyyshehku, kohina, sävy, ruudukko, vinjetti.
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea)' }));
  // Syvyyshehku nostaa laudan tummasta taustasta.
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea-glow)', opacity: 0.4, 'pointer-events': 'none' }));
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, filter: 'url(#sea-noise)', opacity: 0.5, 'pointer-events': 'none' }));
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea-sheen)', 'pointer-events': 'none' }));

  // Hienot leveys-/pituuspiiriviivat (hillitty mustetta).
  const gridCol = '#7fa6c8';
  const gGrid = el('g', { id: 'g-grid', 'pointer-events': 'none' });
  for (let x = 100; x < 1000; x += 100) {
    gGrid.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: 700, stroke: gridCol, 'stroke-opacity': 0.045, 'stroke-width': 1 }));
  }
  for (let y = 100; y < 700; y += 100) {
    gGrid.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: gridCol, 'stroke-opacity': 0.045, 'stroke-width': 1 }));
  }
  svg.appendChild(gGrid);
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#vignette)', 'pointer-events': 'none' }));

  // Neatline: kaksoiskehys atlaksen tapaan, hillitty muste.
  const frameCol = '#9fc4e8';
  svg.appendChild(el('rect', { x: 10, y: 10, width: 980, height: 680, fill: 'none', stroke: frameCol, 'stroke-opacity': 0.18, 'stroke-width': 2, 'pointer-events': 'none' }));
  svg.appendChild(el('rect', { x: 16, y: 16, width: 968, height: 668, fill: 'none', stroke: frameCol, 'stroke-opacity': 0.1, 'stroke-width': 1, 'pointer-events': 'none' }));

  const gMap = el('g', { id: 'g-map' });
  svg.appendChild(gMap);

  // Staattiset merikoristeet: aaltoglyyfit avomerellä + kompassiruusu
  // tyhjimmässä kulmassa. Molemmat matalan opasiteetin viivapiirroksia,
  // ei suodattimia, ei animaatioita.
  gMap.appendChild(buildWaveGlyphs());
  gMap.appendChild(buildCompassRose());

  // Mantereet maamassan muotoisina: rosoitettu orgaaninen "rantaviiva"
  // (tihennetty + seedattu jitter, pelkkää polkudataa), mannerjalusta
  // matalana vetenä alla. Maamassa TÄYTETÄÄN alueittain Voronoi-soluilla
  // (#g-regions) kuten oikeassa pelilaudassa: solut lasketaan KERRAN tässä
  // puolitasoleikkauksella samasta rosoisesta ääriviivasta, joten solujen
  // ulkoreuna ja rantaviiva osuvat täsmälleen yhteen. Ei uusia suodattimia.
  const gCont = el('g', { id: 'g-continents' });          // jalusta + vaahto
  const gRegions = el('g', { id: 'g-regions' });          // aluesolut (klikattavat)
  const gCoast = el('g', { id: 'g-coasts', 'pointer-events': 'none' }); // rantaviiva + kartussit
  const gRidges = el('g', { id: 'g-ridges', 'pointer-events': 'none' }); // vuoristoharjanteet
  const regionEls = {};
  const contIds = Object.keys(CONTINENTS);
  contIds.forEach((contId, ci) => {
    const b = continentBounds(contId);
    const color = CONTINENTS[contId].color;
    const { pts, cx, cy } = continentOutline(contId, ci);
    const path = closedPolyPath(pts);
    const shelfPath = closedPolyPath(offsetRadial(pts, cx, cy, 10));

    // Mannerjalusta: hieman isompi kopio polusta vaaleana merenvaahtosävynä
    // – "matala vesi" rannikon ympärillä, ilman suodattimia.
    gCont.appendChild(el('path', {
      d: shelfPath, 'class': 'cont-shelf', 'pointer-events': 'none',
      fill: '#bfe6ef', 'fill-opacity': 0.06,
      stroke: '#bfe6ef', 'stroke-opacity': 0.08, 'stroke-width': 5, 'stroke-linejoin': 'round',
    }));

    // Matalan veden vaahto: sama polku useana levenevänä vetona rannan alle.
    // EI suodattimia (suorituskyky) – pelkät vedot riittävät rantavyöhykkeeksi.
    const foam = el('g', { 'class': 'cont-foam', 'pointer-events': 'none' });
    foam.appendChild(el('path', { d: path, fill: 'none', stroke: '#bfe6ef', 'stroke-opacity': 0.09, 'stroke-width': 13, 'stroke-linejoin': 'round' }));
    foam.appendChild(el('path', { d: path, fill: 'none', stroke: '#bfe6ef', 'stroke-opacity': 0.15, 'stroke-width': 8, 'stroke-linejoin': 'round' }));
    foam.appendChild(el('path', { d: path, fill: 'none', stroke: '#cfeaf3', 'stroke-opacity': 0.26, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    gCont.appendChild(foam);

    // Aluesolut: Voronoi-jako mantereen ääriviivan sisällä. Vierekkäiset
    // solut jakavat täsmälleen saman rajajanan; rannikkosärmät perivät
    // rosoitetun ääriviivan. Täyttöväri asetetaan updateMapissa omistajan
    // mukaan – tässä vain geometria + neutraali aloitusväri.
    const ids = continentTerritories(contId);
    const { cells, pairs } = continentCells(ids, pts);
    for (const tid of ids) {
      const region = el('path', {
        d: closedPolyPath(cells[tid]), 'class': 'region', 'data-id': tid,
        fill: REGION_FILL_NEUTRAL, 'fill-opacity': 0.85,
        stroke: '#0c1826', 'stroke-width': 1.6, 'stroke-linejoin': 'round',
      });
      region.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); onTap(tid); });
      gRegions.appendChild(region);
      regionEls[tid] = region;
    }

    // Rantaviiva alueiden PÄÄLLE mantereen värillä: ulkoreuna pysyy terävänä.
    gCoast.appendChild(el('path', {
      d: path, 'class': 'coastline', fill: 'none', stroke: color,
      'stroke-opacity': 0.85, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
    }));

    // Vuoristoharjanteet: saman mantereen Voronoi-naapurit jotka EIVÄT ole
    // pelinaapureita saavat jaetun rajan keskelle tumman siksak-harjanteen
    // ("raja jota ei voi ylittää"). Jos jaettu raja leikkautui kokonaan pois,
    // ohitetaan hiljaa.
    for (const key of pairs) {
      const [i, j] = key.split('|');
      if (TERRITORIES[i].adj.includes(j)) continue;
      const seg = sharedBorder(cells[i], TERRITORIES[i], TERRITORIES[j]);
      if (!seg) continue;
      const rp = ridgePaths(seg.a, seg.b);
      if (!rp) continue;
      gRidges.appendChild(el('path', {
        d: rp.d, 'class': 'ridge', fill: 'none', stroke: '#1a2733',
        'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
      gRidges.appendChild(el('path', {
        d: rp.d2, 'class': 'ridge-hi', fill: 'none', stroke: '#4a5a68',
        'stroke-width': 1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
    }

    // Otsikkokartussi (nimi + bonus): pilleri mantereen värisellä reunuksella.
    // Sijoitus: mieluiten ylimmän napin yläpuolelle; jos päällekkäin nappien
    // kanssa, kokeillaan bounds-yläreunaa tai alimman napin alapuolta.
    const labelG = el('g', { 'class': 'cont-label' });
    const txt = `${CONTINENTS[contId].name}  +${CONTINENTS[contId].bonus}`;
    const padX = 10, lblH = 21;
    const lblW = txt.length * 8.2 + padX * 2;
    let topT = TERRITORIES[ids[0]], botT = TERRITORIES[ids[0]];
    for (const tid of ids) {
      const t = TERRITORIES[tid];
      if (t.y < topT.y) topT = t;
      if (t.y > botT.y) botT = t;
    }
    const clampX = (v) => Math.max(6, Math.min(v, 1000 - lblW - 6));
    const clampY = (v) => Math.max(4, Math.min(v, 700 - lblH - 4));
    const candidates = [
      { x: clampX(topT.x - lblW / 2), y: clampY(topT.y - NODE_R - 16 - lblH) },
      { x: clampX(b.x + b.w / 2 - lblW / 2), y: clampY(b.y + 4) },
      { x: clampX(botT.x - lblW / 2), y: clampY(botT.y + NODE_R + 18) },
    ];
    // Päällekkäisyydet minkä tahansa aluenapin kanssa (rect–circle-etäisyys).
    const overlaps = (c) => {
      let n = 0;
      for (const tid of TERRITORY_IDS) {
        const p = TERRITORIES[tid];
        const qx = Math.max(c.x, Math.min(p.x, c.x + lblW));
        const qy = Math.max(c.y, Math.min(p.y, c.y + lblH));
        if (Math.hypot(p.x - qx, p.y - qy) < NODE_R + 12) n++;
      }
      return n;
    };
    let bestPos = candidates[0], bestN = overlaps(candidates[0]);
    for (let k = 1; k < candidates.length && bestN > 0; k++) {
      const n = overlaps(candidates[k]);
      if (n < bestN) { bestN = n; bestPos = candidates[k]; }
    }
    const lx = bestPos.x, ly = bestPos.y;
    labelG.appendChild(el('rect', {
      x: lx, y: ly, width: lblW, height: lblH, rx: 10.5, ry: 10.5,
      fill: '#04101c', 'fill-opacity': 0.55, stroke: color, 'stroke-opacity': 0.55, 'stroke-width': 1,
    }));
    const label = el('text', {
      x: lx + lblW / 2, y: ly + lblH / 2, fill: mix(color, '#ffffff', 0.25),
      'text-anchor': 'middle',
      'font-size': 12.5, 'font-weight': 700, 'dominant-baseline': 'central',
    });
    label.textContent = txt;
    labelG.appendChild(label);
    gCoast.appendChild(labelG);
  });
  gMap.appendChild(gCont);
  gMap.appendChild(gRegions);
  gMap.appendChild(gCoast);
  gMap.appendChild(gRidges);

  // Naapuruusviivat: VAIN mannerten väliset yhteydet – saman mantereen
  // naapuruus näkyy nyt suoraan toisiaan koskettavista alueista.
  const gEdges = el('g', { id: 'g-edges' });
  let seaEdgeIdx = 0;
  for (const id of TERRITORY_IDS) {
    for (const n of TERRITORIES[id].adj) {
      if (id < n) {
        if (TERRITORIES[id].continent === TERRITORIES[n].continent) continue;
        const a = TERRITORIES[id], b = TERRITORIES[n];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const sea = dist > 220; // pitkä merireitti -> hohtava katkoviiva
        if (sea) {
          // Sea route: loiva kvadraattinen kaari (purjehdusreitin tuntu).
          // Kaaren suunta valitaan deterministisesti seedatulla kohinalla.
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const px = -(b.y - a.y) / dist, py = (b.x - a.x) / dist;
          const bow = Math.min(20, 12 + dist * 0.02);
          const sign = seededNoise(7, seaEdgeIdx++) >= 0 ? 1 : -1;
          const d = `M ${a.x} ${a.y} Q ${(mx + px * bow * sign).toFixed(1)} ${(my + py * bow * sign).toFixed(1)} ${b.x} ${b.y}`;
          // Pehmeä hehkuva katkoviiva (taustaviiva + päällysviiva).
          gEdges.appendChild(el('path', {
            d, fill: 'none',
            'class': 'edge-sea-glow', stroke: '#6fb6e8', 'stroke-opacity': 0.12,
            'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 11',
          }));
          gEdges.appendChild(el('path', {
            d, fill: 'none',
            'class': 'edge-sea', stroke: '#9fd0f0', 'stroke-opacity': 0.4,
            'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 11',
          }));
        } else {
          // Lyhyt mannerten välinen yhteys: "salmi/silta" – lyhyt yhtenäinen viiva.
          gEdges.appendChild(el('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            'class': 'edge-land', stroke: '#cfe2f2', 'stroke-opacity': 0.5,
            'stroke-width': 2, 'stroke-linecap': 'round',
          }));
        }
      }
    }
  }
  gMap.appendChild(gEdges);

  // --- Sumukerros: ajautuva murk joka peittää piilotetut alueet. -----------
  // Sijaitsee mantereiden/viivojen YLÄPUOLELLA mutta nappien ALAPUOLELLA, jotta
  // piilotettu maa katoaa sumuun mutta armeijaluvut pysyvät luettavina.
  // Maski (userSpaceOnUse) = valkoinen koko lauta + musta sulava ympyrä per alue.
  const fogMask = el('mask', { id: 'fog-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1000, height: 700 });
  fogMask.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: '#fff' }));
  const fogHoles = {};
  for (const id of TERRITORY_IDS) {
    const t = TERRITORIES[id];
    // Aloitusarvo r=0: sumu peittää kaiken, kunnes updateMap avaa portit.
    const hole = el('circle', { cx: t.x, cy: t.y, r: 0, fill: 'url(#mask-soft)' });
    fogMask.appendChild(hole);
    fogHoles[id] = hole;
  }
  const fogDefs = el('defs');
  fogDefs.appendChild(fogMask);
  gMap.appendChild(fogDefs);

  const gFog = el('g', { id: 'g-fog', 'pointer-events': 'none' });
  gFog.style.display = 'none'; // piilossa kunnes sumu päällä
  // Litteä murk-väri + maski (ei suodatinta) – kevyt raahatessakin.
  gFog.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: '#0e1822', 'fill-opacity': 0.82, mask: 'url(#fog-mask)' }));
  gMap.appendChild(gFog);

  // Aluenapit.
  const gNodes = el('g', { id: 'g-nodes' });
  const nodeRefs = {};
  for (const id of TERRITORY_IDS) {
    const t = TERRITORIES[id];
    const g = el('g', { 'class': 'territory', 'data-id': id, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', t.name);
    // Pakkashehku jäätyneen napin taakse (näkyy vain .frozen-tilassa CSS:llä).
    const chill = el('circle', { cx: t.x, cy: t.y, r: 38, fill: 'url(#chill-glow)', 'class': 'chill', 'pointer-events': 'none', opacity: 0 });
    const halo = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 5, fill: 'none', 'stroke-width': 4, 'class': 'halo', 'stroke-opacity': 0, filter: 'url(#halo-glow)' });
    // Premium-token kerroksittain ILMAN uusia suodattimia: tumma pohjarengas
    // (bezel), gradienttikiekko (filter vain tässä – katettu .interacting-
    // eskaappirulella), omistajan katkoviivakuvioitu rengas, spekulaarikiilto.
    const ringDark = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 2.5, fill: 'none', stroke: '#081119', 'stroke-width': 3.5, 'stroke-opacity': 0.55, 'class': 'node-ring-dark', 'pointer-events': 'none' });
    const circle = el('circle', { cx: t.x, cy: t.y, r: NODE_R, 'stroke-width': 2.5, 'class': 'node', filter: 'url(#node-shadow)' });
    const ring = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 2.5, fill: 'none', 'stroke-width': 1.8, stroke: '#000', 'stroke-opacity': 0, 'class': 'node-rim', 'pointer-events': 'none' });
    const glossCx = t.x - NODE_R * 0.3, glossCy = t.y - NODE_R * 0.4;
    const gloss = el('ellipse', {
      cx: glossCx, cy: glossCy, rx: NODE_R * 0.48, ry: NODE_R * 0.28,
      fill: '#ffffff', opacity: 0.22, 'class': 'node-gloss', 'pointer-events': 'none',
      transform: `rotate(-24 ${glossCx} ${glossCy})`,
    });
    const count = el('text', { x: t.x, y: t.y, 'class': 'army-count', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 18, 'font-weight': 800 });
    const name = el('text', { x: t.x, y: t.y + NODE_R + 13, 'class': 'terr-name', 'text-anchor': 'middle', 'font-size': 11 });
    name.textContent = t.name;
    // Lumi-hiukkaset (näkyvät vain .frozen-tilassa CSS:llä). 4 kpl, porrastettu.
    const snow = el('g', { 'class': 'snow', 'pointer-events': 'none' });
    const flakes = [];
    for (let s = 0; s < 4; s++) {
      const fx = t.x + (s - 1.5) * 7;
      const fl = el('circle', { cx: fx, cy: t.y - NODE_R + 4, r: 1.5, fill: '#fff', opacity: 0, 'class': `flake flake-${s}` });
      snow.appendChild(fl);
      flakes.push(fl);
    }
    // Lumimyrskymerkki (❄) keskellä – näkyy kun alue on suljettu.
    const frost = el('text', { x: t.x, y: t.y, 'class': 'frost', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 22, opacity: 0 });
    frost.textContent = '❄';
    g.appendChild(chill); g.appendChild(halo); g.appendChild(ringDark); g.appendChild(circle);
    g.appendChild(ring); g.appendChild(gloss);
    g.appendChild(count); g.appendChild(name); g.appendChild(snow); g.appendChild(frost);
    const handler = (ev) => { ev.preventDefault(); ev.stopPropagation(); onTap(id); };
    g.addEventListener('click', handler);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handler(ev); });
    gNodes.appendChild(g);
    nodeRefs[id] = { g, halo, circle, count, name, frost, chill, snow, flakes, ring, gloss, region: regionEls[id] };
  }
  gMap.appendChild(gNodes);

  // Liitä sumun apurakenteet myös nodeRefs-objektiin, koska main.js välittää
  // updateMapille pelkän nodeRefsin (buildMap(...).nodeRefs). Nämä eivät ole
  // alue-id:itä, joten ne eivät häiritse nodeRefs[id]-iterointia (TERRITORY_IDS).
  nodeRefs.fogHoles = fogHoles;
  nodeRefs.gFog = gFog;

  return { gMap, nodeRefs, fogHoles, gFog };
}

/**
 * Lyhytaikainen hohtava "tracer" hyökkääjältä puolustajalle.
 * Lisää <circle>:n gMappiin ja animoi sen cx/cy:n SVG <animate>:lla (ei JS-loopia).
 * Poistetaan automaattisesti ~300ms kuluttua.
 * @param {SVGGElement} gMap buildMapin palauttama kartan ryhmä
 * @param {{x:number,y:number}} from lähtöalue (TERRITORIES[id])
 * @param {{x:number,y:number}} to kohdealue (TERRITORIES[id])
 * @param {{dur?:number, r?:number}} [opts] kesto sekunteina / säde (blitzissä kevyempi)
 */
export function fireTracer(gMap, from, to, opts = {}) {
  if (!gMap || !from || !to) return;
  const dur = opts.dur ?? 0.26;
  const r = opts.r ?? 4;
  const c = el('circle', {
    cx: from.x, cy: from.y, r, fill: '#ffd34d',
    filter: 'url(#halo-glow)', 'pointer-events': 'none',
  });
  const aX = el('animate', { attributeName: 'cx', from: from.x, to: to.x, dur: `${dur}s`, fill: 'freeze' });
  const aY = el('animate', { attributeName: 'cy', from: from.y, to: to.y, dur: `${dur}s`, fill: 'freeze' });
  c.appendChild(aX); c.appendChild(aY);
  gMap.appendChild(c);
  setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, dur * 1000 + 60);
}

/**
 * Päivittää napit pelitilan mukaan.
 * HUOM: ei lisää/poista filttereitä eikä rakenna defs-elementtejä uudelleen –
 * vain attribuutteja ja luokkia (mobiilisuorituskyky).
 * @param {object} refs buildMapin palauttama paluuarvo (nodeRefs + fogHoles + gFog)
 * @param {object} state pelitila
 * @param {{selected?:string, attackTarget?:string, validTargets?:Set<string>,
 *          visible?:Set<string>, blizzards?:Set<string>}} ui
 */
export function updateMap(refs, state, ui = {}) {
  const selected = ui.selected || null;
  const attackTarget = ui.attackTarget || null;
  const targets = ui.validTargets || new Set();
  const fog = ui.visible || null; // jos annettu, sumu päällä: vain nämä näkyvät
  const blizzards = ui.blizzards || new Set();

  // nodeRefs voi olla suoraan refs (vanha kutsumalli) tai refs.nodeRefs.
  // main.js käyttää buildMap(...).nodeRefs joten refs[id] on suoraan node.
  const nodes = refs;
  const fogHoles = refs.fogHoles || null;
  const gFog = refs.gFog || null;

  // Sumukerroksen näkyvyys + porttien koko.
  if (gFog && fogHoles) {
    if (fog) {
      gFog.style.display = '';
      gFog.style.opacity = '1';
      for (const id of TERRITORY_IDS) {
        const hole = fogHoles[id];
        if (hole) hole.setAttribute('r', fog.has(id) ? FOG_HOLE_R : 0);
      }
    } else {
      // Sumu pois: piilota koko kerros, älä tee muuta.
      gFog.style.opacity = '0';
      gFog.style.display = 'none';
    }
  }

  for (const id of TERRITORY_IDS) {
    const t = state.territories[id];
    const r = nodes[id];
    const owner = t.owner;
    const blocked = blizzards.has(id);          // lumimyrskyn sulkema (pysyvä)
    const hidden = !blocked && fog && !fog.has(id); // sumun peittämä vihollisalue

    // Omistajan reunusrengas: väri + katkoviivakuvio per pelaajaindeksi, jotta
    // omistus erottuu myös ilman värinäköä (RIM_DASH). Vain attribuutteja.
    const rim = r.ring || null;
    if (blocked) {
      r.circle.setAttribute('fill', 'url(#node-grad-blizzard)');
      r.circle.setAttribute('stroke', '#6f9cb8');
      if (rim) {
        rim.setAttribute('stroke', '#d6f0ff');
        rim.setAttribute('stroke-opacity', 0.6);
        rim.setAttribute('stroke-dasharray', '2 3');
      }
    } else if (hidden) {
      r.circle.setAttribute('fill', 'url(#node-grad-fog)');
      r.circle.setAttribute('stroke', '#0c141d');
      if (rim) {
        rim.setAttribute('stroke', '#31445a');
        rim.setAttribute('stroke-opacity', 0.25);
        rim.setAttribute('stroke-dasharray', 'none');
      }
    } else if (owner == null) {
      r.circle.setAttribute('fill', 'url(#node-grad-neutral)');
      r.circle.setAttribute('stroke', NEUTRAL_DARK);
      if (rim) {
        rim.setAttribute('stroke', '#9aa6b0');
        rim.setAttribute('stroke-opacity', 0.35);
        rim.setAttribute('stroke-dasharray', RIM_DASH_NEUTRAL);
      }
    } else {
      const idx = owner % PLAYER_COLORS.length;
      r.circle.setAttribute('fill', `url(#node-grad-${idx})`);
      r.circle.setAttribute('stroke', PLAYER_COLORS_DARK[idx]);
      if (rim) {
        rim.setAttribute('stroke', PLAYER_COLORS_LIGHT[idx]);
        rim.setAttribute('stroke-opacity', 0.9);
        rim.setAttribute('stroke-dasharray', RIM_DASH[idx % RIM_DASH.length]);
      }
    }

    // Alue-region: täyttö omistajan mukaan (sama blocked/hidden/omistaja-
    // logiikka kuin tokenilla) + korostusluokat. Vain attribuutteja/luokkia;
    // CSS:n fill-transition tekee valloituksesta väripyyhkäisyn.
    if (r.region) {
      let rf;
      if (blocked) rf = REGION_FILL_BLIZZARD;
      else if (hidden) rf = REGION_FILL_FOG;
      else if (owner == null) rf = REGION_FILL_NEUTRAL;
      else rf = REGION_FILL[owner % REGION_FILL.length];
      r.region.setAttribute('fill', rf);
      r.region.classList.toggle('region-selected', !blocked && id === selected);
      r.region.classList.toggle('region-target', !blocked && id === attackTarget);
      r.region.classList.toggle('region-valid',
        !blocked && id !== selected && id !== attackTarget && targets.has(id));
    }

    // Armeijamäärä – pop-animaatio kun luku muuttuu. Suljetussa ei lukua, sumussa '?'.
    const armies = blocked ? '' : (hidden ? '?' : String(t.armies));
    if (r.count.getAttribute('data-val') !== armies) {
      r.count.setAttribute('data-val', armies);
      r.count.textContent = armies;
      // Käynnistä count-pop uudelleen: poista luokka, pakota reflow lukemalla
      // layout-ominaisuus, lisää luokka takaisin.
      r.count.classList.remove('count-pop');
      try { void r.count.getBBox(); } catch (_) { /* getBBox voi heittää jos ei näkyvissä */ }
      r.count.classList.add('count-pop');
    }
    r.count.setAttribute('fill', hidden ? '#9fb6cf' : '#fff');

    // Lumimyrskyn ❄-merkki suljetun alueen keskellä + jäätynyt kehä.
    if (r.frost) {
      r.frost.setAttribute('opacity', blocked ? 1 : 0);
      r.g.classList.toggle('frozen', blocked);
    }
    if (r.chill) r.chill.setAttribute('opacity', blocked ? 1 : 0);
    // Suljettua aluetta ei voi valita.
    if (blocked) {
      r.halo.setAttribute('stroke-opacity', 0);
      r.halo.classList.remove('halo-selected', 'halo-target', 'halo-valid');
      r.g.classList.remove('selectable');
      continue;
    }

    let haloOpacity = 0, haloColor = '#ffd34d', haloR = NODE_R + 5, haloW = 4;
    // Tilakohtaiset CSS-luokat halojen pulssausta varten.
    r.halo.classList.remove('halo-selected', 'halo-target', 'halo-valid');
    if (id === selected) {
      haloOpacity = 1; haloColor = '#ffd34d'; haloR = NODE_R + 6; haloW = 4;
      r.halo.classList.add('halo-selected');
    } else if (id === attackTarget) {
      haloOpacity = 1; haloColor = '#ff2b2b'; haloR = NODE_R + 7.5; haloW = 5.5;
      r.halo.classList.add('halo-target');
    } else if (targets.has(id)) {
      haloOpacity = 0.8; haloColor = '#ff8585'; haloW = 3.5;
      r.halo.classList.add('halo-valid');
    }
    r.halo.setAttribute('stroke', haloColor);
    r.halo.setAttribute('stroke-opacity', haloOpacity);
    r.halo.setAttribute('r', haloR);
    r.halo.setAttribute('stroke-width', haloW);
    r.g.classList.toggle('selectable', targets.has(id));
  }
}
