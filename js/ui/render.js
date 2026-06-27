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

  // --- Meri: syvä radiaaligradientti + päälle laskeva lineaarinen sävytys. ---
  const sea = el('radialGradient', { id: 'sea', cx: '50%', cy: '38%', r: '80%' });
  sea.appendChild(el('stop', { offset: '0%', 'stop-color': seaTop }));
  sea.appendChild(el('stop', { offset: '55%', 'stop-color': seaMid }));
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

/** Suljettu pehmeä polku (Catmull-Rom → bezier) pistejoukon läpi. */
function smoothClosedPath(pts) {
  const n = pts.length;
  const f = (v) => v.toFixed(1);
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)} `;
  }
  return d + 'Z';
}

/**
 * Mannermuodon polku: alueiden koordinaattien konveksi peite, laajennettu
 * ulospäin keskipisteestä ja pehmennetty. Pienille mantereille (1–2 aluetta)
 * muodostetaan kahdeksankulmainen "saari" bounding boxin ympärille.
 */
function continentShape(contId, pad = 50) {
  const ids = continentTerritories(contId);
  const points = ids.map((i) => ({ x: TERRITORIES[i].x, y: TERRITORIES[i].y }));
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  let hull = convexHull(points);
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
    return smoothClosedPath(oct);
  }
  // Laajenna jokainen peitteen kärki säteittäin ulospäin keskipisteestä.
  const expanded = hull.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
  });
  return smoothClosedPath(expanded);
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

  // Mantereet maamassan muotoisina: alueiden konveksista peitteestä
  // pehmennetty "rantaviiva", rosoutettu rantasuodattimella, matalan veden
  // vaahto rannan ympärillä, reliefivalaistus kohovaikutelmaksi.
  const gCont = el('g', { id: 'g-continents' });
  const contIds = Object.keys(CONTINENTS);
  contIds.forEach((contId, ci) => {
    const b = continentBounds(contId);
    const color = CONTINENTS[contId].color;
    const path = continentShape(contId);

    // Matalan veden vaahto: sama polku useana levenevänä vetona rannan alle.
    // EI suodattimia (suorituskyky) – pelkät vedot riittävät rantavyöhykkeeksi.
    const foam = el('g', { 'class': 'cont-foam', 'pointer-events': 'none' });
    foam.appendChild(el('path', { d: path, fill: 'none', stroke: '#bfe6ef', 'stroke-opacity': 0.09, 'stroke-width': 13, 'stroke-linejoin': 'round' }));
    foam.appendChild(el('path', { d: path, fill: 'none', stroke: '#bfe6ef', 'stroke-opacity': 0.15, 'stroke-width': 8, 'stroke-linejoin': 'round' }));
    foam.appendChild(el('path', { d: path, fill: 'none', stroke: '#cfeaf3', 'stroke-opacity': 0.26, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    gCont.appendChild(foam);

    // Maamassa: pehmeä rantaviiva + rantaviivan veto. Yksi kevyt varjo.
    const land = el('g', { 'class': 'cont-panel', filter: 'url(#cont-shadow)' });
    land.appendChild(el('path', { d: path, fill: color, 'fill-opacity': 0.22 }));
    land.appendChild(el('path', { d: path, fill: 'none', stroke: color, 'stroke-opacity': 0.6, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    gCont.appendChild(land);

    // Otsikkomerkki (nimi + bonus) mantereen yläreunaan.
    const labelG = el('g', { 'class': 'cont-label' });
    const txt = `${CONTINENTS[contId].name}  +${CONTINENTS[contId].bonus}`;
    const padX = 9, lblH = 20;
    const lblW = txt.length * 7.6 + padX * 2;
    const lx = Math.max(6, Math.min(b.x + b.w / 2 - lblW / 2, 1000 - lblW - 6));
    const ly = Math.max(4, b.y + 4);
    labelG.appendChild(el('rect', {
      x: lx, y: ly, width: lblW, height: lblH, rx: 10, ry: 10,
      fill: '#04101c', 'fill-opacity': 0.5, stroke: color, 'stroke-opacity': 0.5, 'stroke-width': 1,
    }));
    const label = el('text', {
      x: lx + padX, y: ly + lblH / 2, fill: color,
      'font-size': 13, 'font-weight': 700, 'dominant-baseline': 'central',
    });
    label.textContent = txt;
    labelG.appendChild(label);
    gCont.appendChild(labelG);
  });
  gMap.appendChild(gCont);

  // Naapuruusviivat (jokainen särmä kerran).
  const gEdges = el('g', { id: 'g-edges' });
  for (const id of TERRITORY_IDS) {
    for (const n of TERRITORIES[id].adj) {
      if (id < n) {
        const a = TERRITORIES[id], b = TERRITORIES[n];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const sea = dist > 220; // pitkä merireitti -> hohtava katkoviiva
        if (sea) {
          // Sea route: pehmeä hehkuva katkoviiva (taustaviiva + päällysviiva).
          gEdges.appendChild(el('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            'class': 'edge-sea-glow', stroke: '#6fb6e8', 'stroke-opacity': 0.12,
            'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 11',
          }));
          gEdges.appendChild(el('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            'class': 'edge-sea', stroke: '#9fd0f0', 'stroke-opacity': 0.4,
            'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 11',
          }));
        } else {
          // Land border: hillitty yhtenäinen viiva.
          gEdges.appendChild(el('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            'class': 'edge-land', stroke: '#cfe2f2', 'stroke-opacity': 0.32,
            'stroke-width': 1.8, 'stroke-linecap': 'round',
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
    const circle = el('circle', { cx: t.x, cy: t.y, r: NODE_R, 'stroke-width': 2.5, 'class': 'node', filter: 'url(#node-shadow)' });
    const count = el('text', { x: t.x, y: t.y, 'class': 'army-count', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 18, 'font-weight': 800 });
    const name = el('text', { x: t.x, y: t.y + NODE_R + 12, 'class': 'terr-name', 'text-anchor': 'middle', 'font-size': 10.5 });
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
    g.appendChild(chill); g.appendChild(halo); g.appendChild(circle);
    g.appendChild(count); g.appendChild(name); g.appendChild(snow); g.appendChild(frost);
    const handler = (ev) => { ev.preventDefault(); ev.stopPropagation(); onTap(id); };
    g.addEventListener('click', handler);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handler(ev); });
    gNodes.appendChild(g);
    nodeRefs[id] = { g, halo, circle, count, name, frost, chill, snow, flakes };
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

    if (blocked) {
      r.circle.setAttribute('fill', 'url(#node-grad-blizzard)');
      r.circle.setAttribute('stroke', '#6f9cb8');
    } else if (hidden) {
      r.circle.setAttribute('fill', 'url(#node-grad-fog)');
      r.circle.setAttribute('stroke', '#0c141d');
    } else if (owner == null) {
      r.circle.setAttribute('fill', 'url(#node-grad-neutral)');
      r.circle.setAttribute('stroke', NEUTRAL_DARK);
    } else {
      const idx = owner % PLAYER_COLORS.length;
      r.circle.setAttribute('fill', `url(#node-grad-${idx})`);
      r.circle.setAttribute('stroke', PLAYER_COLORS_DARK[idx]);
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

    let haloOpacity = 0, haloColor = '#ffd34d', haloR = NODE_R + 5;
    // Tilakohtaiset CSS-luokat halojen pulssausta varten.
    r.halo.classList.remove('halo-selected', 'halo-target', 'halo-valid');
    if (id === selected) {
      haloOpacity = 1; haloColor = '#ffd34d'; haloR = NODE_R + 6;
      r.halo.classList.add('halo-selected');
    } else if (id === attackTarget) {
      haloOpacity = 1; haloColor = '#ff3b3b'; haloR = NODE_R + 7;
      r.halo.classList.add('halo-target');
    } else if (targets.has(id)) {
      haloOpacity = 0.85; haloColor = '#ff7a7a';
      r.halo.classList.add('halo-valid');
    }
    r.halo.setAttribute('stroke', haloColor);
    r.halo.setAttribute('stroke-opacity', haloOpacity);
    r.halo.setAttribute('r', haloR);
    r.g.classList.toggle('selectable', targets.has(id));
  }
}
