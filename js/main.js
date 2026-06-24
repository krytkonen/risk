// Risk – käyttöliittymän ja pelilogiikan yhdistävä päämoduuli.
// Hoitaa ihmispelaajan napautukset, vaiheiden kulun, dialogit, tekoälyvuorojen
// animoinnin sekä kartan zoomauksen/raahaamisen.

import {
  createGame, PHASES, ownedBy, placeArmies, endReinforcement, tradeCards,
  mustTradeCards, canAttack, attack, resolveConquest, endAttack, fortify,
  areConnected, endTurn, calcReinforcements, snapshot, applyBlitzResult,
} from './engine/game.js';
import { isValidSet } from './engine/cards.js';
import { runAITurn } from './engine/ai.js';
import { resolveBalancedBlitz } from './engine/combat.js';
import { TERRITORIES, MAP_LIST, DEFAULT_MAP } from './data/territories.js';
import { buildMap, updateMap, PLAYER_COLORS } from './ui/render.js';

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Ääniefektit (Web Audio API, ei musiikkia)
// ---------------------------------------------------------------------------

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function sfx(type) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime;
    if (type === 'attack') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.18);
    } else if (type === 'conquer') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.setValueAtTime(440, t + 0.1);
      osc.frequency.setValueAtTime(550, t + 0.2);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t); osc.stop(t + 0.35);
    } else if (type === 'place') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.08);
    } else if (type === 'select') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t); osc.stop(t + 0.06);
    } else if (type === 'turn') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.setValueAtTime(330, t + 0.12);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.28);
    }
  } catch (_) {}
}
const PHASE_NAMES = { reinforce: 'Vahvistus', attack: 'Hyökkäys', fortify: 'Linnoitus', gameover: 'Loppu' };
const CARD_ICONS = { infantry: '🪖', cavalry: '🐎', artillery: '🎯', wild: '⭐' };
const AI_DELAY = 600;

let state = null;
let mapRefs = null;
const ui = { selected: null, attackTarget: null, validTargets: new Set(), busy: false };

// ---------------------------------------------------------------------------
// Pelin aloitus
// ---------------------------------------------------------------------------

const cfg = { players: 3, humans: 1, mapId: DEFAULT_MAP };

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
  buildMapPicker();
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

function buildMapPicker() {
  const wrap = $('map-picker');
  if (!wrap) return;
  wrap.innerHTML = '';
  MAP_LIST.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-opt' + (m.id === cfg.mapId ? ' sel' : '');
    b.textContent = m.name;
    b.dataset.map = m.id;
    b.addEventListener('click', () => {
      cfg.mapId = m.id;
      wrap.querySelectorAll('.map-opt').forEach((el) => el.classList.toggle('sel', el.dataset.map === m.id));
    });
    wrap.appendChild(b);
  });
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
  state = createGame({ players, mapId: cfg.mapId });
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
    sfx('turn');
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
  ui.selected = (ui.selected === id) ? null : id;
  if (ui.selected) sfx('select');
  render();
}

function addReinforcement(n) {
  if (!ui.selected) return toast('Valitse ensin alue.');
  const amount = Math.min(n, state.reinforcements);
  if (amount <= 0) return toast('Ei vahvistuksia jäljellä.');
  placeArmies(state, ui.selected, amount);
  sfx('place');
  flashNode(ui.selected);
  if (state.reinforcements === 0) ui.selected = null;
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
    ui.attackTarget = (ui.attackTarget === id) ? null : id;
    render();
    return;
  }
  if (t.owner === me && t.armies >= 2) { selectAttacker(id); return; }
  toast('Ei sallittu kohde.');
}

// ---------------------------------------------------------------------------
// Animaatiot
// ---------------------------------------------------------------------------

function animateAttack(fromId, toId) {
  const fr = mapRefs[fromId], tr = mapRefs[toId];
  if (fr) { fr.g.classList.add('attacking'); setTimeout(() => fr.g.classList.remove('attacking'), 350); }
  if (tr) { tr.g.classList.add('defending'); setTimeout(() => tr.g.classList.remove('defending'), 350); }
}

// ---------------------------------------------------------------------------
// Hyökkäyskomennot
// ---------------------------------------------------------------------------

function doSingleAttack() {
  const fromId = ui.selected, toId = ui.attackTarget;
  if (!fromId || !toId) return;
  animateAttack(fromId, toId);
  const res = attack(state, fromId, toId);
  if (!res.ok) { toast(res.reason || 'Hyökkäys ei onnistunut.'); return; }
  sfx('attack');
  showBattle(fromId, toId, res);
  if (state.pendingConquest) { openConquest(); return; }
  if (state.territories[fromId].armies < 2) clearSelection();
  else if (!canAttack(state, fromId, toId)) { ui.attackTarget = null; recomputeAttackTargets(); }
  render();
}

async function doBlitz() {
  const fromId = ui.selected, toId = ui.attackTarget;
  if (!fromId || !toId) return;
  ui.busy = true; render();
  while (
    (state.territories[fromId]?.armies ?? 0) >= 2 &&
    (state.territories[toId]?.armies ?? 0) > 0 &&
    !state.pendingConquest
  ) {
    animateAttack(fromId, toId);
    const res = attack(state, fromId, toId);
    if (!res.ok) break;
    sfx('attack');
    showBattle(fromId, toId, res);
    render();
    await delay(220);
  }
  ui.busy = false;
  if (state.pendingConquest) { render(); openConquest(); return; }
  hideBattle();
  if ((state.territories[fromId]?.armies ?? 0) < 2) clearSelection();
  else { ui.attackTarget = null; recomputeAttackTargets(); }
  render();
}

async function doBalancedBlitz() {
  const fromId = ui.selected, toId = ui.attackTarget;
  if (!fromId || !toId) return;
  ui.busy = true; render();
  const fromA = state.territories[fromId].armies;
  const toA = state.territories[toId].armies;
  const result = resolveBalancedBlitz(fromA, toA, state.rng);
  // Näytä jokainen kierros animoituna
  for (const round of result.rounds) {
    animateAttack(fromId, toId);
    showBattle(fromId, toId, round);
    render();
    await delay(180);
  }
  applyBlitzResult(state, fromId, toId, result.finalAttacker, result.finalDefender);
  ui.busy = false;
  if (state.pendingConquest) { render(); openConquest(); return; }
  hideBattle();
  if ((state.territories[fromId]?.armies ?? 0) < 2) clearSelection();
  else { ui.attackTarget = null; recomputeAttackTargets(); }
  render();
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
  ui.selected = id; ui.attackTarget = null;
  recomputeAttackTargets();
  if (ui.validTargets.size === 0) { toast('Ei vihollisia naapurissa.'); clearSelection(); }
  render();
}
function recomputeAttackTargets() {
  const id = ui.selected;
  ui.validTargets = new Set(TERRITORIES[id].adj.filter((n) => canAttack(state, id, n)));
}
function clearSelection() { ui.selected = null; ui.attackTarget = null; ui.validTargets = new Set(); }

// ---------------------------------------------------------------------------
// Dialogit: valloitus & linnoitus
// ---------------------------------------------------------------------------

function openConquest() {
  const pc = state.pendingConquest;
  $('conquest-text').textContent =
    `Valtasit ${TERRITORIES[pc.toId].gen}! Siirrä ${pc.minMove}–${pc.maxMove} armeijaa alueelle.`;
  const r = $('conquest-range');
  r.min = pc.minMove; r.max = pc.maxMove; r.value = pc.minMove;
  $('conquest-val').textContent = pc.minMove;
  show('modal-conquest', true);
  render();
}
function confirmConquest() {
  const v = Number($('conquest-range').value);
  const conqueredId = state.pendingConquest?.toId;
  resolveConquest(state, v);
  show('modal-conquest', false);
  hideBattle();
  sfx('conquer');
  flashConquest(conqueredId);
  if (state.phase === PHASES.GAMEOVER) { render(); return gameOver(); }
  ui.attackTarget = null;
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
      `<span>${c.type === 'wild' ? 'Jokeri' : ({ infantry: 'Jalkaväki', cavalry: 'Ratsuväki', artillery: 'Tykistö' }[c.type])}</span>` +
      `<span class="card-terr">${c.territoryId ? (TERRITORIES[c.territoryId]?.name || '') : '—'}</span>`;
    d.addEventListener('click', () => {
      if (tradeSel.has(i)) tradeSel.delete(i);
      else { if (tradeSel.size >= 3) return; tradeSel.add(i); }
      renderTrade();
    });
    wrap.appendChild(d);
  });
  $('trade-hint').textContent = mustTradeCards(state)
    ? 'Sinulla on 5+ korttia – vaihto on pakollinen ennen hyökkäystä.'
    : 'Valitse 3 korttia: kolme samaa tyyppiä, yksi kutakin tai jokeri sarjassa.';
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
  toast('Ei sopivaa korttisarjaa.');
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

function canTradeNow() {
  if (state.phase !== PHASES.REINFORCE) return false;
  const cards = state.players[state.current].cards;
  const n = cards.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        if (isValidSet([cards[i], cards[j], cards[k]])) return true;
  return false;
}

function renderControls() {
  const c = $('controls');
  c.innerHTML = '';
  const me = state.players[state.current];
  if (me.isAI || ui.busy) {
    const msg = me.isAI ? `Tekoäly (${me.name}) pelaa…` : 'Blitz käynnissä…';
    c.innerHTML = `<span class="hint-text">${msg}</span>`;
    return;
  }
  const tradeable = canTradeNow();

  if (state.phase === PHASES.REINFORCE) {
    const rem = state.reinforcements;
    const sel = ui.selected;
    const row1 = addRow(c);
    const hintText = rem > 0
      ? (sel
          ? `${TERRITORIES[sel].name}: ${state.territories[sel].armies} armeijaa`
          : `${rem} armeijaa sijoitettavana — napauta aluetta`)
      : (tradeable ? 'Kaikki sijoitettu. Vaihda kortit?' : 'Kaikki armeijat sijoitettu.');
    addHint(row1, hintText);

    const row2 = addRow(c);
    addBtn(row2, tradeable ? `Kortit ★ (${me.cards.length})` : `Kortit (${me.cards.length})`,
      tradeable ? 'ghost notify' : 'ghost', openTrade, me.cards.length < 3);
    if (sel && rem > 0) {
      addBtn(row2, '+1', '', () => addReinforcement(1));
      addBtn(row2, '+5', '', () => addReinforcement(5), rem < 5);
      addBtn(row2, `+${rem}`, 'primary', () => addReinforcement(rem));
    } else if (rem === 0) {
      addBtn(row2, 'Hyökkäykseen →', 'primary', () => {
        const r = endReinforcement(state);
        if (!r.ok) { toast(r.reason); if (mustTradeCards(state)) openTrade(); return; }
        clearSelection(); render();
      });
    }
  } else if (state.phase === PHASES.ATTACK) {
    const row = addRow(c);
    if (!ui.selected) {
      addHint(row, 'Valitse oma alue josta hyökätä');
    } else if (!ui.attackTarget) {
      const a = state.territories[ui.selected].armies;
      addHint(row, `${TERRITORIES[ui.selected].name} (${a}⚔) — napauta kohdetta (punainen)`);
      addBtn(row, 'Peru', 'ghost', () => { clearSelection(); render(); });
    } else {
      const fa = state.territories[ui.selected].armies;
      const ta = state.territories[ui.attackTarget].armies;
      addHint(row, `${TERRITORIES[ui.selected].name}(${fa}) → ${TERRITORIES[ui.attackTarget].name}(${ta})`);
      addBtn(row, 'Peru', 'ghost', () => { clearSelection(); render(); });
      addBtn(row, 'Hyökkää', 'danger', doSingleAttack);
      addBtn(row, 'Blitz!', 'danger', doBlitz);
      addBtn(row, 'Tasapainotettu Blitz', 'danger', doBalancedBlitz);
    }
    addBtn(row, 'Lopeta →', 'primary', () => {
      const r = endAttack(state); if (!r.ok) { toast(r.reason); return; }
      clearSelection(); render();
    });
  } else if (state.phase === PHASES.FORTIFY) {
    const row = addRow(c);
    addHint(row, ui.selected ? 'Valitse kohdealue' : 'Valitse alue josta siirtää (tai ohita)');
    if (ui.selected) addBtn(row, 'Peru', 'ghost', () => { clearSelection(); render(); });
    addBtn(row, 'Päätä vuoro', 'primary', () => { endTurn(state); afterHumanTurnEnd(); });
  }
}

function addRow(parent) {
  const row = document.createElement('div');
  row.className = 'controls-row';
  parent.appendChild(row);
  return row;
}

function addHint(parent, text) {
  const s = document.createElement('span');
  s.className = 'hint-text';
  s.textContent = text;
  parent.appendChild(s);
  return s;
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
  const att = res.attackerDice.map((d) => `<span class="att">${'⚀⚁⚂⚃⚄⚅'[d - 1]}</span>`).join(' ');
  const def = res.defenderDice.map((d) => `<span class="def">${'⚀⚁⚂⚃⚄⚅'[d - 1]}</span>`).join(' ');
  const fromA = state.territories[fromId]?.armies ?? '?';
  const toA = state.territories[toId]?.armies ?? '?';
  b.innerHTML =
    `<div><span class="att">${TERRITORIES[fromId].name}</span> → <span class="def">${TERRITORIES[toId].name}</span></div>` +
    `<div class="dice">${att} &nbsp;vs&nbsp; ${def}</div>` +
    `<div class="battle-losses">` +
    `<span class="att">−${res.attackerLosses} (jäljellä ${fromA})</span>` +
    ` &nbsp;·&nbsp; ` +
    `<span class="def">−${res.defenderLosses} (jäljellä ${toA})</span>` +
    `</div>`;
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

function flashConquest(id) {
  const r = id && mapRefs[id];
  if (!r) return;
  r.g.classList.add('just-conquered');
  setTimeout(() => r.g.classList.remove('just-conquered'), 600);
}

function gameOver() {
  const w = state.players[state.winner];
  const text = (!w.isAI && cfg.humans === 1)
    ? 'Sinä valloitit maailman!'
    : `${w.name} valloitti maailman!`;
  $('gameover-text').textContent = text;
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
  svg.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, e);
    if (pts.size >= 2) dragging = false;
  });
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
