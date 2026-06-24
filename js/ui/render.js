// Kartan piirto SVG:nä pelitilasta. Piirtää meren, mannerlaatikot,
// naapuruusviivat, aluenapit (armeijamäärä) ja korostukset valinnoille.
// Ei pelilogiikkaa – vain visualisointi + napautusten välitys.

import { TERRITORIES, TERRITORY_IDS, CONTINENTS, continentTerritories } from '../data/territories.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const NODE_R = 21;

export const PLAYER_COLORS = ['#2f7bd6', '#d63b3b', '#3aa84a', '#e0a020', '#9b59c6', '#16a89a'];
export const PLAYER_COLORS_DARK = ['#1d4f8a', '#8e2424', '#246b2f', '#946a12', '#653a82', '#0d6b62'];

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

/** Rakentaa staattisen kartan kerran (mantereet + viivat + napit). */
export function buildMap(svg, onTap) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', '0 0 1000 700');

  const defs = el('defs');
  const grad = el('radialGradient', { id: 'sea', cx: '50%', cy: '40%', r: '75%' });
  grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#16324f' }));
  grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#0a1c2e' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea)' }));

  const gMap = el('g', { id: 'g-map' });
  svg.appendChild(gMap);

  // Mannerlaatikot taustalle.
  const gCont = el('g', { id: 'g-continents' });
  for (const contId of Object.keys(CONTINENTS)) {
    const b = continentBounds(contId);
    const rect = el('rect', {
      x: b.x, y: b.y, width: b.w, height: b.h, rx: 26, ry: 26,
      fill: CONTINENTS[contId].color, 'fill-opacity': 0.14,
      stroke: CONTINENTS[contId].color, 'stroke-opacity': 0.4, 'stroke-width': 1.5,
    });
    gCont.appendChild(rect);
    const label = el('text', {
      x: b.x + 12, y: b.y + 22, fill: CONTINENTS[contId].color,
      'font-size': 15, 'font-weight': 700, opacity: 0.85, 'class': 'cont-label',
    });
    label.textContent = `${CONTINENTS[contId].name} (+${CONTINENTS[contId].bonus})`;
    gCont.appendChild(label);
  }
  gMap.appendChild(gCont);

  // Naapuruusviivat (jokainen särmä kerran).
  const gEdges = el('g', { id: 'g-edges' });
  for (const id of TERRITORY_IDS) {
    for (const n of TERRITORIES[id].adj) {
      if (id < n) {
        const a = TERRITORIES[id], b = TERRITORIES[n];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const sea = dist > 220; // pitkä merireitti -> katkoviiva
        gEdges.appendChild(el('line', {
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          stroke: '#bcd', 'stroke-opacity': sea ? 0.22 : 0.38,
          'stroke-width': sea ? 1 : 1.6,
          'stroke-dasharray': sea ? '5 6' : 'none',
        }));
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
    const halo = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 5, fill: 'none', 'stroke-width': 4, 'class': 'halo', 'stroke-opacity': 0 });
    const circle = el('circle', { cx: t.x, cy: t.y, r: NODE_R, 'stroke-width': 2.5, 'class': 'node' });
    const count = el('text', { x: t.x, y: t.y, 'class': 'army-count', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 17, 'font-weight': 800 });
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
 * @param {{selected?:string, validTargets?:Set<string>, lastBattle?:object}} ui
 */
export function updateMap(refs, state, ui = {}) {
  const selected = ui.selected || null;
  const targets = ui.validTargets || new Set();
  for (const id of TERRITORY_IDS) {
    const t = state.territories[id];
    const r = refs[id];
    const owner = t.owner;
    r.circle.setAttribute('fill', owner == null ? '#555' : PLAYER_COLORS[owner % PLAYER_COLORS.length]);
    r.circle.setAttribute('stroke', owner == null ? '#333' : PLAYER_COLORS_DARK[owner % PLAYER_COLORS_DARK.length]);
    r.count.textContent = t.armies;
    r.count.setAttribute('fill', '#fff');

    let haloOpacity = 0, haloColor = '#ffd34d', haloR = NODE_R + 5;
    if (id === selected) { haloOpacity = 1; haloColor = '#ffd34d'; haloR = NODE_R + 6; }
    else if (targets.has(id)) { haloOpacity = 0.95; haloColor = '#ff5757'; }
    r.halo.setAttribute('stroke', haloColor);
    r.halo.setAttribute('stroke-opacity', haloOpacity);
    r.halo.setAttribute('r', haloR);
    r.g.classList.toggle('selectable', targets.has(id));
  }
}
