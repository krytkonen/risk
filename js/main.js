// Risk – käyttöliittymän ja pelilogiikan yhdistävä päämoduuli.
// Hoitaa ihmispelaajan napautukset, vaiheiden kulun, dialogit, tekoälyvuorojen
// animoinnin sekä kartan zoomauksen/raahaamisen.

import {
  createGame, PHASES, ownedBy, placeArmies, endReinforcement, tradeCards,
  mustTradeCards, canAttack, attack, resolveConquest, endAttack, fortify,
  areConnected, endTurn, calcReinforcements, snapshot,
} from './engine/game.js';
import { isValidSet } from './engine/cards.js';
import { runAITurn } from './engine/ai.js';
import { TERRITORIES } from './data/territories.js';
import { buildMap, updateMap, PLAYER_COLORS } from './ui/render.js';

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const PHASE_NAMES = { reinforce: 'Vahvistus', attack: 'Hyökkäys', fortify: 'Linnoitus', gameover: 'Loppu' };
const CARD_ICONS = { infantry: '🪖', cavalry: '🐎', artillery: '🎯', wild: '⭐' };
const AI_DELAY = 600;

let state = null;
let mapRefs = null;
const ui = { selected: null, validTargets: new Set(), busy: false };

// ---------------------------------------------------------------------------
// Pelin aloitus
// ---------------------------------------------------------------------------

const cfg = { players: 3, humans: 1 };

function setupHandlers() {
  document.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.step;
      const dir = Number(btn.dataset.dir);
      if (key === 'players') cfg.players = clamp(cfg.players + dir, 2, 6);
      if (key === 'humans') cfg.humans = clamp(cfg.humans + dir, 1, cfg.players);
      cfg.humans = clamp(cfg.humans, 1, cfg.players);
      refreshSetup();
    });
  });
  $('btn-start').addEventListener('click', startGame);
  $('gameover-new').addEventListener('click', () => { show('modal-gameover', false); show('modal-setup', true); });
  $('btn-menu').addEventListener('click', () => { if (confirm('Aloita uusi peli?')) show('modal-setup', true); });

  // Korttidialogi
  $('trade-auto').addEventListener('click', autoTrade);
  $('trade-do').addEventListener('click', doTradeSelected);
  $('trade-close').addEventListener('click', () => { if (!mustTradeCards(state)) show('modal-trade', false); else toast('Sinun on vaihdettava (5+ korttia).'); });

  // Valloitusdialogi
  $('conquest-range').addEventListener('input', (e) => { $('conquest-val').textContent = e.target.value; });
  $('conquest-confirm').addEventListener('click', confirmConquest);

  // Linnoitusdialogi
  $('fortify-range').addEventListener('input', (e) => { $('fortify-val').textContent = e.target.value; });
  $('fortify-confirm').addEventListener('click', confirmFortify);
  $('fortify-cancel').addEventListener('click', () => { show('modal-fortify', false); fortifyCtx = null; });

  setupZoom();
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function refreshSetup() { $('cfg-players').textContent = cfg.players; $('cfg-humans').textContent = cfg.humans; }

function startGame() {
  const palette = ['Sininen', 'Punainen', 'Vihreä', 'Keltainen', 'Violetti', 'Turkoosi'];
  const players = [];
  for (let i = 0; i < cfg.players; i++) {
    const isHuman = i < cfg.humans;
    players.push({
      name: isHuman ? (cfg.humans === 1 ? 'Sinä' : `Pelaaja ${i + 1}`) : `🤖 ${palette[i]}`,
      color: PLAYER_COLORS[i],
      isAI: !isHuman,
    });
  }
  state = createGame({ players });
  ui.selected = null; ui.validTargets = new Set(); ui.busy = false;
  mapRefs = buildMap($('map'), onTerritoryTap).nodeRefs;
  show('modal-setup', false);
  resetView();
  render();
  beginTurn();
}

// ---------------------------------------------------------------------------
// Vuorojen kulku
// ---------------------------------------------------------------------------

async function beginTurn() {
  if (state.phase === PHASES.GAMEOVER) return gameOver();
  const p = state.players[state.current];
  if (p.isAI) {
    await runAI();
  } else {
    // Ihmispelaaja: pakollinen korttien vaihto jos 5+.
    if (mustTradeCards(state)) openTrade();
    render();
  }
}

async function runAI() {
  ui.busy = true; ui.selected = null; ui.validTargets = new Set();
  render();
  await delay(AI_DELAY);
  await runAITurn(state, {
    afterReinforce: async () => { render(); await delay(AI_DELAY); },
    afterAttack: async (a, res) => { showBattle(a.fromId, a.toId, res); render(); await delay(AI_DELAY); },
    afterConquest: async () => { hideBattle(); render(); await delay(AI_DELAY / 2); },
    afterFortify: async () => { render(); await delay(AI_DELAY / 2); },
  });
  ui.busy = false;
  hideBattle();
  render();
  await delay(250);
  beginTurn();
}

function afterHumanTurnEnd() {
  ui.selected = null; ui.validTargets = new Set();
  render();
  beginTurn();
}

// ---------------------------------------------------------------------------
// Napautukset kartalla (ihmispelaaja)
// ---------------------------------------------------------------------------

function onTerritoryTap(id) {
  if (ui.busy || state.phase === PHASES.GAMEOVER) return;
  if (state.players[state.current].isAI) return;
  if (!anyModalOpen()) {
    if (state.phase === PHASES.REINFORCE) tapReinforce(id);
    else if (state.phase === PHASES.ATTACK) tapAttack(id);
    else if (state.phase === PHASES.FORTIFY) tapFortify(id);
  }
}

function tapReinforce(id) {
  const t = state.territories[id];
  if (t.owner !== state.current) return toast('Ei oma alueesi.');
  if (state.reinforcements <= 0) return toast('Ei vahvistuksia jäljellä. Paina “Valmis”.');
  placeArmies(state, id, 1);
  flashNode(id);
  render();
}

function tapAttack(id) {
  const t = state.territories[id];
  const me = state.current;
  if (state.pendingConquest) return;
  if (!ui.selected) {
    if (t.owner === me && t.armies >= 2) selectAttacker(id);
    else if (t.owner === me) toast('Tarvitset vähintään 2 armeijaa hyökätäksesi.');
    else toast('Valitse ensin oma alue josta hyökätä.');
    return;
  }
  if (id === ui.selected) { clearSelection(); render(); return; }
  if (ui.validTargets.has(id)) {
    const res = attack(state, ui.selected, id);
    if (!res.ok) { toast(res.reason || 'Hyökkäys ei onnistunut.'); return; }
    showBattle(ui.selected, id, res);
    if (state.pendingConquest) { openConquest(); return; }
    // jatka samasta alueesta jos vielä mahdollista
    if (state.territories[ui.selected].armies < 2) clearSelection();
    else recomputeAttackTargets();
    render();
    return;
  }
  if (t.owner === me && t.armies >= 2) { selectAttacker(id); return; }
  toast('Ei kelvollinen kohde.');
}

function tapFortify(id) {
  const t = state.territories[id];
  const me = state.current;
  if (!ui.selected) {
    if (t.owner === me && t.armies >= 2) {
      ui.selected = id;
      ui.validTargets = new Set(ownedBy(state, me).filter((d) => d !== id && areConnected(state, id, d, me)));
      if (ui.validTargets.size === 0) { toast('Ei yhdistettyjä alueita siirtoon.'); clearSelection(); }
      render();
    } else toast('Valitse oma alue jolla vähintään 2 armeijaa.');
    return;
  }
  if (id === ui.selected) { clearSelection(); render(); return; }
  if (ui.validTargets.has(id)) { openFortify(ui.selected, id); return; }
  if (t.owner === me && t.armies >= 2) {
    ui.selected = id;
    ui.validTargets = new Set(ownedBy(state, me).filter((d) => d !== id && areConnected(state, id, d, me)));
    render();
    return;
  }
  toast('Ei kelvollinen kohde.');
}

function selectAttacker(id) {
  ui.selected = id;
  recomputeAttackTargets();
  if (ui.validTargets.size === 0) { toast('Ei vihollisia naapurissa.'); clearSelection(); }
  render();
}
function recomputeAttackTargets() {
  const id = ui.selected;
  ui.validTargets = new Set(TERRITORIES[id].adj.filter((n) => canAttack(state, id, n)));
}
function clearSelection() { ui.selected = null; ui.validTargets = new Set(); }

// ---------------------------------------------------------------------------
// Dialogit: valloitus & linnoitus
// ---------------------------------------------------------------------------

function openConquest() {
  const pc = state.pendingConquest;
  $('conquest-text').textContent =
    `Valtasit ${TERRITORIES[pc.toId].name}! Siirrä ${pc.minMove}–${pc.maxMove} armeijaa alueelle.`;
  const r = $('conquest-range');
  r.min = pc.minMove; r.max = pc.maxMove; r.value = pc.minMove;
  $('conquest-val').textContent = pc.minMove;
  show('modal-conquest', true);
  render();
}
function confirmConquest() {
  const v = Number($('conquest-range').value);
  resolveConquest(state, v);
  show('modal-conquest', false);
  hideBattle();
  if (state.phase === PHASES.GAMEOVER) { render(); return gameOver(); }
  if (state.territories[ui.selected]?.armies < 2) clearSelection();
  else recomputeAttackTargets();
  render();
}

let fortifyCtx = null;
function openFortify(fromId, toId) {
  fortifyCtx = { fromId, toId };
  const max = state.territories[fromId].armies - 1;
  $('fortify-text').textContent =
    `Siirrä joukkoja ${TERRITORIES[fromId].name} → ${TERRITORIES[toId].name}.`;
  const r = $('fortify-range');
  r.min = 1; r.max = max; r.value = max;
  $('fortify-val').textContent = max;
  show('modal-fortify', true);
}
function confirmFortify() {
  if (!fortifyCtx) return;
  const v = Number($('fortify-range').value);
  const res = fortify(state, fortifyCtx.fromId, fortifyCtx.toId, v);
  show('modal-fortify', false);
  fortifyCtx = null;
  if (!res.ok) { toast(res.reason); return; }
  afterHumanTurnEnd();
}

// ---------------------------------------------------------------------------
// Dialogi: korttien vaihto
// ---------------------------------------------------------------------------

const tradeSel = new Set();
function openTrade() { tradeSel.clear(); renderTrade(); show('modal-trade', true); }
function renderTrade() {
  const player = state.players[state.current];
  const wrap = $('trade-cards');
  wrap.innerHTML = '';
  player.cards.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'card' + (tradeSel.has(i) ? ' sel' : '');
    d.innerHTML = `<span class="card-ico">${CARD_ICONS[c.type]}</span>` +
      `<span>${c.type === 'wild' ? 'Jokeri' : ({ infantry: 'Jalkaväki', cavalry: 'Ratsuväki', artillery: 'Tykistö' })[c.type]}</span>` +
      `<span class="card-terr">${c.territoryId ? (TERRITORIES[c.territoryId]?.name || '') : '—'}</span>`;
    d.addEventListener('click', () => {
      if (tradeSel.has(i)) tradeSel.delete(i);
      else { if (tradeSel.size >= 3) return; tradeSel.add(i); }
      renderTrade();
    });
    wrap.appendChild(d);
  });
  $('trade-hint').textContent = mustTradeCards(state)
    ? 'Sinulla on 5+ korttia – vaihto on pakollinen.'
    : 'Valitse kolme korttia: kolme samaa, yksi kutakin tai jokeri mukana.';
  const sel = [...tradeSel].map((i) => player.cards[i]);
  $('trade-do').disabled = !(sel.length === 3 && isValidSet(sel));
}
function doTradeSelected() {
  const idx = [...tradeSel];
  const res = tradeCards(state, idx);
  if (!res.ok) { toast(res.reason); return; }
  tradeSel.clear();
  toast(`+${res.bonus} armeijaa vaihdosta!`);
  if (state.players[state.current].cards.length >= 3 && mustTradeCards(state)) renderTrade();
  else { show('modal-trade', false); }
  render();
}
function autoTrade() {
  const player = state.players[state.current];
  // valitse ensimmäinen kelvollinen sarja
  const n = player.cards.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    if (isValidSet([player.cards[i], player.cards[j], player.cards[k]])) {
      tradeSel.clear(); tradeSel.add(i); tradeSel.add(j); tradeSel.add(k);
      doTradeSelected();
      return;
    }
  }
  toast('Ei kelvollista korttisarjaa.');
}

// ---------------------------------------------------------------------------
// Renderöinti
// ---------------------------------------------------------------------------

function render() {
  if (!state) return;
  updateMap(mapRefs, state, ui);
  renderHUD();
  renderPlayers();
  renderLog();
  renderControls();
}

function renderHUD() {
  const p = state.players[state.current];
  $('turn-badge').textContent = `Vuoro ${state.turnCount}`;
  $('phase-badge').textContent = PHASE_NAMES[state.phase];
  $('cp-name').textContent = p.name;
  $('cp-dot').style.background = p.color;
  const rb = $('reinforce-badge');
  if (state.phase === PHASES.REINFORCE) { rb.hidden = false; rb.textContent = `+${state.reinforcements}`; }
  else rb.hidden = true;
}

function renderPlayers() {
  const panel = $('players-panel');
  panel.innerHTML = '';
  const snap = snapshot(state);
  state.players.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (i === state.current ? ' active' : '') + (p.alive ? '' : ' dead');
    chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>` +
      `<span>${p.name}</span>` +
      `<span class="pc-stats">${snap[i].territories}⬢ ${snap[i].armies}⚔ ${snap[i].cards}🂠</span>`;
    panel.appendChild(chip);
  });
}

function renderLog() {
  const log = $('log');
  log.innerHTML = state.log.slice(-12).map((l) => `<div class="l-${l.type}">${l.msg}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function renderControls() {
  const c = $('controls');
  c.innerHTML = '';
  const me = state.players[state.current];
  if (me.isAI || ui.busy) {
    c.innerHTML = `<span class="hint-text">Tekoäly (${me.name}) pelaa…</span>`;
    return;
  }
  if (state.phase === PHASES.REINFORCE) {
    const canTrade = me.cards.length >= 3;
    addBtn(c, canTrade ? `Kortit (${me.cards.length})` : `Kortit (${me.cards.length})`, 'ghost', openTrade, me.cards.length < 3);
    addBtn(c, state.reinforcements > 0 ? `Sijoita armeijat (${state.reinforcements})` : 'Valmis →', 'primary',
      () => {
        const r = endReinforcement(state);
        if (!r.ok) { toast(r.reason); if (mustTradeCards(state)) openTrade(); return; }
        clearSelection(); render();
      }, state.reinforcements > 0);
  } else if (state.phase === PHASES.ATTACK) {
    const hint = ui.selected ? `Hyökkää: valitse punainen kohde` : `Valitse oma alue josta hyökätä`;
    const span = document.createElement('span'); span.className = 'hint-text'; span.textContent = hint;
    c.appendChild(span);
    if (ui.selected) addBtn(c, 'Peru valinta', 'ghost', () => { clearSelection(); render(); });
    addBtn(c, 'Lopeta hyökkäys →', 'primary', () => {
      const r = endAttack(state); if (!r.ok) { toast(r.reason); return; }
      clearSelection(); render();
    });
  } else if (state.phase === PHASES.FORTIFY) {
    const hint = ui.selected ? 'Valitse kohdealue' : 'Valitse alue josta siirtää (tai ohita)';
    const span = document.createElement('span'); span.className = 'hint-text'; span.textContent = hint;
    c.appendChild(span);
    if (ui.selected) addBtn(c, 'Peru', 'ghost', () => { clearSelection(); render(); });
    addBtn(c, 'Päätä vuoro', 'primary', () => { endTurn(state); afterHumanTurnEnd(); });
  }
}

function addBtn(parent, label, cls, onClick, disabled = false) {
  const b = document.createElement('button');
  b.className = cls; b.textContent = label; b.disabled = disabled;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}

// ---------------------------------------------------------------------------
// Bannerit & toastit
// ---------------------------------------------------------------------------

function showBattle(fromId, toId, res) {
  const b = $('battle-banner');
  const att = res.attackerDice.map((d) => `<span class="att">${'⚀⚁⚂⚃⚄⚅'[d - 1]}</span>`).join('');
  const def = res.defenderDice.map((d) => `<span class="def">${'⚀⚁⚂⚃⚄⚅'[d - 1]}</span>`).join('');
  b.innerHTML = `<div>${TERRITORIES[fromId].name} → ${TERRITORIES[toId].name}</div>` +
    `<div class="dice">${att} &nbsp;vs&nbsp; ${def}</div>` +
    `<div>Tappiot: hyökkääjä −${res.attackerLosses}, puolustaja −${res.defenderLosses}</div>`;
  b.hidden = false;
}
function hideBattle() { $('battle-banner').hidden = true; }

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

function flashNode(id) {
  const r = mapRefs[id];
  if (!r) return;
  r.circle.setAttribute('r', 24);
  setTimeout(() => r.circle.setAttribute('r', 21), 120);
}

function gameOver() {
  const w = state.players[state.winner];
  $('gameover-text').textContent = `${w.name} valloitti maailman!`;
  show('modal-gameover', true);
}

// ---------------------------------------------------------------------------
// Apuvälineet
// ---------------------------------------------------------------------------

function show(id, on) { $(id).hidden = !on; }
function anyModalOpen() {
  return ['modal-trade', 'modal-conquest', 'modal-fortify', 'modal-gameover', 'modal-setup']
    .some((id) => !$(id).hidden);
}

// ---------------------------------------------------------------------------
// Zoom & pan
// ---------------------------------------------------------------------------

const view = { scale: 1, tx: 0, ty: 0 };
function applyView() {
  const g = $('map').querySelector('#g-map');
  if (g) g.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.scale})`);
}
function resetView() { view.scale = 1; view.tx = 0; view.ty = 0; applyView(); }
function zoomBy(factor, cx = 500, cy = 350) {
  const ns = clamp(view.scale * factor, 0.6, 4);
  // zoomaa kohdistuspisteen ympäri
  view.tx = cx - (cx - view.tx) * (ns / view.scale);
  view.ty = cy - (cy - view.ty) * (ns / view.scale);
  view.scale = ns;
  applyView();
}

function setupZoom() {
  $('zoom-in').addEventListener('click', () => zoomBy(1.25));
  $('zoom-out').addEventListener('click', () => zoomBy(0.8));
  $('zoom-reset').addEventListener('click', resetView);

  const svg = $('map');
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, traveled = 0;
  let pinchDist = 0;

  const toSvg = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return { x: (clientX - rect.left) / rect.width * vb.width, y: (clientY - rect.top) / rect.height * vb.height };
  };

  svg.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY; traveled = 0;
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging || pinchDist) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    traveled += Math.abs(dx) + Math.abs(dy);
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    view.tx += dx / rect.width * vb.width;
    view.ty += dy / rect.height * vb.height;
    lastX = e.clientX; lastY = e.clientY;
    applyView();
  });
  const end = () => { dragging = false; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', end);

  // Estä napautus vain jos sormi/hiiri liikkui selvästi (= raahaus, ei napautus).
  svg.addEventListener('click', (e) => {
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist > 10 || traveled > 14) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // Hiiren rulla -zoom (työpöytä).
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toSvg(e.clientX, e.clientY);
    zoomBy(e.deltaY < 0 ? 1.12 : 0.89, p.x, p.y);
  }, { passive: false });

  // Kahden sormen pinch-zoom.
  const pts = new Map();
  svg.addEventListener('pointerdown', (e) => pts.set(e.pointerId, e));
  svg.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDist) {
        const mid = toSvg((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        zoomBy(d / pinchDist, mid.x, mid.y);
      }
      pinchDist = d;
      dragging = false;
    }
  });
  const clearPt = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinchDist = 0; };
  svg.addEventListener('pointerup', clearPt);
  svg.addEventListener('pointercancel', clearPt);
}

// ---------------------------------------------------------------------------
// Käynnistys + PWA
// ---------------------------------------------------------------------------

function boot() {
  refreshSetup();
  setupHandlers();
  // Kevyt debug-/testikoukku (e2e-testit lukevat tilan tästä).
  window.__risk = { getState: () => state, getUi: () => ui, adj: (id) => TERRITORIES[id].adj };
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

boot();
