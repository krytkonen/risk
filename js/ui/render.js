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

/** Lisää kaikki gradientit ja filtterit <defs>-elementtiin. */
function buildDefs() {
  const defs = el('defs');

  // --- Meri: syvä radiaaligradientti + päälle laskeva lineaarinen sävytys. ---
  const sea = el('radialGradient', { id: 'sea', cx: '50%', cy: '38%', r: '80%' });
  sea.appendChild(el('stop', { offset: '0%', 'stop-color': '#1b3e5e' }));
  sea.appendChild(el('stop', { offset: '55%', 'stop-color': '#12304c' }));
  sea.appendChild(el('stop', { offset: '100%', 'stop-color': '#081523' }));
  defs.appendChild(sea);

  const seaSheen = el('linearGradient', { id: 'sea-sheen', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  seaSheen.appendChild(el('stop', { offset: '0%', 'stop-color': '#2a5680', 'stop-opacity': 0.35 }));
  seaSheen.appendChild(el('stop', { offset: '45%', 'stop-color': '#10283f', 'stop-opacity': 0 }));
  seaSheen.appendChild(el('stop', { offset: '100%', 'stop-color': '#040d16', 'stop-opacity': 0.45 }));
  defs.appendChild(seaSheen);

  // --- Vinjetti reunoille (tummennus). ---
  const vignette = el('radialGradient', { id: 'vignette', cx: '50%', cy: '50%', r: '72%' });
  vignette.appendChild(el('stop', { offset: '60%', 'stop-color': '#000', 'stop-opacity': 0 }));
  vignette.appendChild(el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.42 }));
  defs.appendChild(vignette);

  // --- Hienovarainen kohina meren päälle (syvyys/tekstuuri). ---
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

  // --- Per-pelaaja radiaaligradientit napin täytölle (vaalea keskus → tumma reuna). ---
  for (let i = 0; i < PLAYER_COLORS.length; i++) {
    const g = el('radialGradient', { id: `node-grad-${i}`, cx: '38%', cy: '32%', r: '72%' });
    g.appendChild(el('stop', { offset: '0%', 'stop-color': PLAYER_COLORS_LIGHT[i] }));
    g.appendChild(el('stop', { offset: '55%', 'stop-color': PLAYER_COLORS[i] }));
    g.appendChild(el('stop', { offset: '100%', 'stop-color': PLAYER_COLORS_DARK[i] }));
    defs.appendChild(g);
  }
  // Neutraali (omistamaton) alue.
  const ng = el('radialGradient', { id: 'node-grad-neutral', cx: '38%', cy: '32%', r: '72%' });
  ng.appendChild(el('stop', { offset: '0%', 'stop-color': NEUTRAL_LIGHT }));
  ng.appendChild(el('stop', { offset: '60%', 'stop-color': NEUTRAL_MID }));
  ng.appendChild(el('stop', { offset: '100%', 'stop-color': NEUTRAL_DARK }));
  defs.appendChild(ng);

  return defs;
}

/** Rakentaa staattisen kartan kerran (mantereet + viivat + napit). */
export function buildMap(svg, onTap) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', '0 0 1000 700');

  svg.appendChild(buildDefs());

  // Meri – kerroksittain: pohjagradientti, kohina, sävy, leveys/pituuspiirit, vinjetti.
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea)' }));
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, filter: 'url(#sea-noise)', opacity: 0.5, 'pointer-events': 'none' }));
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea-sheen)', 'pointer-events': 'none' }));

  // Hienot leveys-/pituuspiiriviivat.
  const gGrid = el('g', { id: 'g-grid', 'pointer-events': 'none' });
  for (let x = 100; x < 1000; x += 100) {
    gGrid.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: 700, stroke: '#9fc4e8', 'stroke-opacity': 0.05, 'stroke-width': 1 }));
  }
  for (let y = 100; y < 700; y += 100) {
    gGrid.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#9fc4e8', 'stroke-opacity': 0.05, 'stroke-width': 1 }));
  }
  svg.appendChild(gGrid);
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#vignette)', 'pointer-events': 'none' }));

  const gMap = el('g', { id: 'g-map' });
  svg.appendChild(gMap);

  // Mannerlaatikot taustalle – pyöristetyt läpikuultavat paneelit + varjo + sisäkehä.
  const gCont = el('g', { id: 'g-continents' });
  for (const contId of Object.keys(CONTINENTS)) {
    const b = continentBounds(contId);
    const color = CONTINENTS[contId].color;
    const panel = el('g', { 'class': 'cont-panel', filter: 'url(#cont-shadow)' });
    panel.appendChild(el('rect', {
      x: b.x, y: b.y, width: b.w, height: b.h, rx: 30, ry: 30,
      fill: color, 'fill-opacity': 0.12,
    }));
    // Sisempi vaalea kehä (inner glow -tunne).
    panel.appendChild(el('rect', {
      x: b.x + 2.5, y: b.y + 2.5, width: b.w - 5, height: b.h - 5, rx: 27, ry: 27,
      fill: 'none', stroke: color, 'stroke-opacity': 0.5, 'stroke-width': 1.4,
    }));
    gCont.appendChild(panel);

    // Otsikkomerkki (nimi + bonus) hienovaraisella taustalla.
    const labelG = el('g', { 'class': 'cont-label' });
    const txt = `${CONTINENTS[contId].name}  +${CONTINENTS[contId].bonus}`;
    const padX = 9, lblH = 20;
    const lblW = txt.length * 7.6 + padX * 2;
    labelG.appendChild(el('rect', {
      x: b.x + 10, y: b.y + 8, width: lblW, height: lblH, rx: 10, ry: 10,
      fill: '#04101c', 'fill-opacity': 0.45, stroke: color, 'stroke-opacity': 0.45, 'stroke-width': 1,
    }));
    const label = el('text', {
      x: b.x + 10 + padX, y: b.y + 8 + lblH / 2, fill: color,
      'font-size': 13, 'font-weight': 700, 'dominant-baseline': 'central',
    });
    label.textContent = txt;
    labelG.appendChild(label);
    gCont.appendChild(labelG);
  }
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

  // Aluenapit.
  const gNodes = el('g', { id: 'g-nodes' });
  const nodeRefs = {};
  for (const id of TERRITORY_IDS) {
    const t = TERRITORIES[id];
    const g = el('g', { 'class': 'territory', 'data-id': id, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', t.name);
    const halo = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 5, fill: 'none', 'stroke-width': 4, 'class': 'halo', 'stroke-opacity': 0, filter: 'url(#halo-glow)' });
    const circle = el('circle', { cx: t.x, cy: t.y, r: NODE_R, 'stroke-width': 2.5, 'class': 'node', filter: 'url(#node-shadow)' });
    const count = el('text', { x: t.x, y: t.y, 'class': 'army-count', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 18, 'font-weight': 800 });
    const name = el('text', { x: t.x, y: t.y + NODE_R + 12, 'class': 'terr-name', 'text-anchor': 'middle', 'font-size': 10.5 });
    name.textContent = t.name;
    g.appendChild(halo); g.appendChild(circle); g.appendChild(count); g.appendChild(name);
    const handler = (ev) => { ev.preventDefault(); ev.stopPropagation(); onTap(id); };
    g.addEventListener('click', handler);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handler(ev); });
    gNodes.appendChild(g);
    nodeRefs[id] = { g, halo, circle, count, name };
  }
  gMap.appendChild(gNodes);

  return { gMap, nodeRefs };
}

/**
 * Päivittää napit pelitilan mukaan.
 * @param {object} refs buildMapin palauttama nodeRefs
 * @param {object} state pelitila
 * @param {{selected?:string, attackTarget?:string, validTargets?:Set<string>, lastBattle?:object}} ui
 */
export function updateMap(refs, state, ui = {}) {
  const selected = ui.selected || null;
  const attackTarget = ui.attackTarget || null;
  const targets = ui.validTargets || new Set();
  for (const id of TERRITORY_IDS) {
    const t = state.territories[id];
    const r = refs[id];
    const owner = t.owner;
    if (owner == null) {
      r.circle.setAttribute('fill', 'url(#node-grad-neutral)');
      r.circle.setAttribute('stroke', NEUTRAL_DARK);
    } else {
      const idx = owner % PLAYER_COLORS.length;
      r.circle.setAttribute('fill', `url(#node-grad-${idx})`);
      r.circle.setAttribute('stroke', PLAYER_COLORS_DARK[idx]);
    }

    // Armeijamäärä – pop-animaatio kun luku muuttuu.
    const armies = String(t.armies);
    if (r.count.getAttribute('data-val') !== armies) {
      r.count.setAttribute('data-val', armies);
      r.count.textContent = armies;
      // Käynnistä count-pop uudelleen: poista luokka, pakota reflow lukemalla
      // layout-ominaisuus, lisää luokka takaisin.
      r.count.classList.remove('count-pop');
      try { void r.count.getBBox(); } catch (_) { /* getBBox voi heittää jos ei näkyvissä */ }
      r.count.classList.add('count-pop');
    }
    r.count.setAttribute('fill', '#fff');

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
