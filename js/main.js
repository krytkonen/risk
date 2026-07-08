// Risk – käyttöliittymän ja pelilogiikan yhdistävä päämoduuli.
// Hoitaa ihmispelaajan napautukset, vaiheiden kulun, dialogit, tekoälyvuorojen
// animoinnin sekä kartan zoomauksen/raahaamisen.

import {
  createGame, PHASES, ownedBy, placeArmies, unplaceArmies, endReinforcement, tradeCards,
  mustTradeCards, canAttack, attack, resolveConquest, endAttack, fortify,
  areConnected, endTurn, calcReinforcements, snapshot, applyBlitzResult,
  isBlizzard, visibleTerritories, serializeGame, restoreGame, emptyStats,
  missionText, missionComplete,
} from './engine/game.js';
import { isValidSet, setValue } from './engine/cards.js';
import { runAITurn } from './engine/ai.js';
import { resolveBalancedBlitz, calcBlitzWinProb } from './engine/combat.js';
import { TERRITORIES, CONTINENTS, MAP_LIST, DEFAULT_MAP } from './data/territories.js';
import { SCENARIOS, SCENARIO_LIST } from './data/scenarios.js';
import { buildMap, updateMap, fireTracer, showAttackArrow, hideAttackArrow, PLAYER_COLORS } from './ui/render.js';

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Ääniefektit (Web Audio API, ei musiikkia)
// ---------------------------------------------------------------------------

let _audioCtx = null;
let _master = null;

// Pysyvät asetukset (mykistys, tekoälyn nopeus, grafiikkatila) localStoragessa.
const settings = {
  muted: readSetting('risk-muted') === '1',
  fastAI: readSetting('risk-fast-ai') === '1',
  liteGfx: detectLiteGfx(),
};

/**
 * Kevyt grafiikka: käyttäjän tallentama valinta, tai automaattitunnistus
 * ensimmäisellä kerralla — vähämuistinen tai -ytiminen laite saa kevyen
 * tilan oletuksena (deviceMemory puuttuu iOS:lla, silloin ydinmäärä ratkaisee).
 */
function detectLiteGfx() {
  const saved = readSetting('risk-lite-gfx');
  if (saved !== null) return saved === '1';
  const mem = navigator.deviceMemory || 0;
  const cores = navigator.hardwareConcurrency || 0;
  return (mem > 0 && mem <= 2) || (cores > 0 && cores <= 2);
}

/** Kytkee kevyen grafiikan päälle/pois: CSS hoitaa suodattimet ja animaatiot. */
function applyGfxMode() {
  document.body.classList.toggle('lite', settings.liteGfx);
  const picker = $('gfx-picker');
  if (picker) {
    picker.querySelectorAll('.mode-opt').forEach((b) => {
      b.classList.toggle('on', (b.dataset.gfx === 'lite') === settings.liteGfx);
    });
  }
}

function setLiteGfx(on) {
  settings.liteGfx = on;
  writeSetting('risk-lite-gfx', on ? '1' : '0');
  applyGfxMode();
}
function readSetting(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function writeSetting(key, val) {
  try { localStorage.setItem(key, val); } catch (_) {}
}
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Yksi master-gain kaikelle: estää kerrostuvan äänen klippaamisen.
    _master = _audioCtx.createGain();
    _master.gain.value = 0.45;
    _master.connect(_audioCtx.destination);
  }
  return _audioCtx;
}

/** Herättää AudioContextin ensimmäisellä käyttäjäeleellä (mobiilin autoplay-esto). */
function resumeAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) {}
}

/** Lyhyt suodatettu kohinapurske ("clash"). */
function noiseBurst(ctx, t, dur, freq, peak) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(_master);
  src.start(t); src.stop(t + dur);
}

function sfx(type) {
  if (settings.muted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const tone = (osc) => { osc.connect(osc._g); osc._g.connect(_master); };
    const mk = (wave) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave; osc._g = g; tone(osc);
      return { osc, g };
    };
    if (type === 'attack') {
      // Neliöaaltoglissando + lyhyt kohinapurske = metallinen "clash".
      const { osc, g } = mk('square');
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.18);
      noiseBurst(ctx, t, 0.09, 1200, 0.10);
    } else if (type === 'conquer') {
      // Kolmioarpeggio + detune-osc (+7 senttiä) + avautuva lowpass 800→4000.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(800, t);
      lp.frequency.exponentialRampToValueAtTime(4000, t + 0.35);
      lp.connect(_master);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.15, t);
      ag.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      ag.connect(lp);
      const o1 = ctx.createOscillator(); o1.type = 'triangle';
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.detune.value = 7;
      o1.frequency.setValueAtTime(330, t);
      o1.frequency.setValueAtTime(440, t + 0.1);
      o1.frequency.setValueAtTime(550, t + 0.2);
      o2.frequency.setValueAtTime(330, t);
      o2.frequency.setValueAtTime(440, t + 0.1);
      o2.frequency.setValueAtTime(550, t + 0.2);
      o1.connect(ag); o2.connect(ag);
      o1.start(t); o1.stop(t + 0.35);
      o2.start(t); o2.stop(t + 0.35);
    } else if (type === 'place') {
      // Perussävel + oktaavin ylempi naksahdus.
      const { osc, g } = mk('sine');
      osc.frequency.setValueAtTime(440, t);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.08);
      const { osc: o2, g: g2 } = mk('square');
      o2.frequency.setValueAtTime(880, t);
      g2.gain.setValueAtTime(0.04, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o2.start(t); o2.stop(t + 0.04);
    } else if (type === 'select') {
      const { osc, g } = mk('sine');
      osc.frequency.setValueAtTime(660, t);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t); osc.stop(t + 0.06);
    } else if (type === 'turn') {
      const { osc, g } = mk('triangle');
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.setValueAtTime(330, t + 0.12);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.28);
    }
  } catch (_) {}
}
const PHASE_NAMES = { reinforce: 'Vahvistus', attack: 'Hyökkäys', fortify: 'Linnoitus', gameover: 'Loppu' };
const CARD_ICONS = { infantry: '🪖', cavalry: '🐎', artillery: '🎯', wild: '⭐' };
/** Tekoälyn animaatioviive: normaali tai pikakelaus. */
const aiDelay = () => (settings.fastAI ? 90 : 600);

const SAVE_KEY = 'risk-save-v1';

let state = null;
let mapRefs = null;
let mapG = null;
const ui = { selected: null, attackTarget: null, validTargets: new Set(), busy: false, curtain: false };
/** Vahvistusvaiheen sijoitukset kumoamista varten: [{id, n}]. */
let placeStack = [];

// ---------------------------------------------------------------------------
// Automaattitallennus
// ---------------------------------------------------------------------------

let quotaWarned = false; // näytä muisti-täynnä-varoitus vain kerran per istunto

function saveGame() {
  if (!state || state.phase === PHASES.GAMEOVER) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeGame(state)));
  } catch (_) {
    // Automaattitallennus epäonnistui (yleensä kiintiö täynnä) → kerro
    // pelaajalle kerran, jottei etene väärässä uskossa että peli on turvassa.
    if (!quotaWarned) { quotaWarned = true; toast('⚠ Automaattitallennus epäonnistui – laitteen muisti voi olla täynnä.', 4000); }
  }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  refreshContinueButton();
}
function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function refreshContinueButton() {
  const b = $('btn-continue');
  if (b) b.hidden = !loadSavedGame();
}

// --- Nimetyt paikalliset tallennuspaikat (3 kpl) ---------------------------
// Erillään automaattitallennuksesta: pelaaja voi säilyttää useita tilanteita.
// Korvaussuoja: täyden paikan päälle tallennus vaatii toisen napautuksen.
const SLOT_KEYS = ['risk-slot-0', 'risk-slot-1', 'risk-slot-2'];
let slotConfirm = -1; // paikka joka odottaa korvausvahvistusta (-1 = ei mikään)

function readSlot(i) {
  try { const raw = localStorage.getItem(SLOT_KEYS[i]); return raw ? JSON.parse(raw) : null; }
  catch (_) { return null; }
}
function mapNameOf(id) {
  const m = MAP_LIST.find((x) => x.id === id);
  return m ? m.name : id;
}
function slotLabel(saved) {
  if (!saved) return 'Tyhjä';
  return `${mapNameOf(saved.mapId)} · vuoro ${saved.turnCount || 1}`;
}
function saveToSlot(i) {
  if (!state || state.phase === PHASES.GAMEOVER) { toast('Ei aktiivista peliä tallennettavaksi.'); return; }
  try {
    localStorage.setItem(SLOT_KEYS[i], JSON.stringify(serializeGame(state)));
    toast(`Tallennettu paikkaan ${i + 1}.`);
  } catch (_) {
    toast('⚠ Tallennus epäonnistui – laitteen muisti voi olla täynnä.', 4000);
  }
  slotConfirm = -1;
  refreshSlots();
}
function loadFromSlot(i) {
  const saved = readSlot(i);
  if (!saved) { toast('Tyhjä tallennuspaikka.'); return; }
  try { state = restoreGame(saved); }
  catch (_) { toast('Tallennus ei kelvannut.'); return; }
  show('modal-slots', false); show('modal-menu', false);
  enterGame();
}
function deleteSlot(i) {
  try { localStorage.removeItem(SLOT_KEYS[i]); } catch (_) {}
  slotConfirm = -1;
  refreshSlots();
}
function refreshSlots() {
  const list = $('slots-list');
  if (!list) return;
  const hasGame = !!state && state.phase !== PHASES.GAMEOVER;
  list.innerHTML = '';
  for (let i = 0; i < SLOT_KEYS.length; i++) {
    const saved = readSlot(i);
    const row = document.createElement('div');
    row.className = 'slot-row';
    const label = document.createElement('span');
    label.className = 'slot-label';
    label.textContent = `${i + 1}. ${slotLabel(saved)}`;
    row.appendChild(label);

    const btns = document.createElement('div');
    btns.className = 'slot-btns';
    // Tallenna (korvaussuoja: täysi paikka vaatii vahvistuksen).
    const save = document.createElement('button');
    save.className = 'ghost small';
    const awaiting = slotConfirm === i;
    save.textContent = awaiting ? 'Korvaa?' : 'Tallenna';
    save.disabled = !hasGame;
    save.addEventListener('click', () => {
      if (saved && slotConfirm !== i) { slotConfirm = i; refreshSlots(); return; }
      saveToSlot(i);
    });
    btns.appendChild(save);
    // Lataa (vain jos paikassa on peli).
    if (saved) {
      const load = document.createElement('button');
      load.className = 'primary small';
      load.textContent = 'Lataa';
      load.addEventListener('click', () => loadFromSlot(i));
      btns.appendChild(load);
      const del = document.createElement('button');
      del.className = 'ghost small';
      del.textContent = '🗑';
      del.title = 'Tyhjennä paikka';
      del.addEventListener('click', () => deleteSlot(i));
      btns.appendChild(del);
    }
    row.appendChild(btns);
    list.appendChild(row);
  }
}
function openSlots() { slotConfirm = -1; refreshSlots(); show('modal-slots', true); }

// ---------------------------------------------------------------------------
// Pelin aloitus
// ---------------------------------------------------------------------------

const cfg = { players: 3, humans: 1, mapId: DEFAULT_MAP, fogOfWar: false, blizzard: false, fixedCards: false, missions: false, scenario: null, maxTurns: 50, difficulty: 'normaali' };

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
  buildScenarioPicker();
  // Pelimoodikytkimet (sumu, lumimyrsky).
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      cfg[key] = !cfg[key];
      btn.classList.toggle('on', cfg[key]);
      btn.setAttribute('aria-pressed', cfg[key] ? 'true' : 'false');
    });
  });
  $('btn-start').addEventListener('click', startGame);
  $('btn-continue').addEventListener('click', continueGame);
  $('gameover-new').addEventListener('click', () => { show('modal-gameover', false); show('modal-setup', true); refreshContinueButton(); });

  // Valikko
  $('btn-menu').addEventListener('click', () => { if (!$('modal-setup').hidden || !$('modal-curtain').hidden) return; refreshMenu(); show('modal-menu', true); });
  $('menu-resume').addEventListener('click', () => show('modal-menu', false));
  $('menu-new').addEventListener('click', () => { show('modal-menu', false); refreshContinueButton(); show('modal-setup', true); });
  $('menu-sound').addEventListener('click', () => {
    settings.muted = !settings.muted;
    writeSetting('risk-muted', settings.muted ? '1' : '0');
    refreshMenu();
    if (!settings.muted) sfx('select');
  });
  $('menu-speed').addEventListener('click', () => { toggleAISpeed(); refreshMenu(); });
  $('menu-gfx').addEventListener('click', () => { setLiteGfx(!settings.liteGfx); refreshMenu(); });
  $('menu-mission').addEventListener('click', () => {
    const m = humanMission();
    if (m) toast(`🎯 Tavoitteesi: ${m.text}`, 5000);
  });
  // Grafiikkavalitsin aloitusruudussa.
  document.querySelectorAll('#gfx-picker .mode-opt').forEach((btn) => {
    btn.addEventListener('click', () => setLiteGfx(btn.dataset.gfx === 'lite'));
  });
  // Pelin pituus: aseta vuororaja ja korosta valinta.
  document.querySelectorAll('#len-picker .mode-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      cfg.maxTurns = Number(btn.dataset.len);
      document.querySelectorAll('#len-picker .mode-opt').forEach((b) => b.classList.toggle('on', b === btn));
    });
  });
  document.querySelector('#len-picker .mode-opt[data-len="50"]')?.classList.add('on');
  // Tekoälyn vaikeustaso: aseta cfg ja korosta valinta.
  document.querySelectorAll('#diff-picker .mode-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      cfg.difficulty = btn.dataset.diff;
      document.querySelectorAll('#diff-picker .mode-opt').forEach((b) => b.classList.toggle('on', b === btn));
    });
  });
  document.querySelector('#diff-picker .mode-opt[data-diff="normaali"]')?.classList.add('on');
  $('menu-rules').addEventListener('click', () => { show('modal-menu', false); show('modal-rules', true); });
  $('rules-close').addEventListener('click', () => show('modal-rules', false));
  // Tallennuspaikat: avattavissa aloitusruudusta (lataus) ja valikosta (tallennus+lataus).
  $('btn-slots').addEventListener('click', openSlots);
  $('menu-slots').addEventListener('click', () => { show('modal-menu', false); openSlots(); });
  $('slots-close').addEventListener('click', () => show('modal-slots', false));

  // Kuumatuoliverho (sumu): paljasta kartta vasta kun pelaaja on valmis.
  $('curtain-ready').addEventListener('click', () => {
    ui.curtain = false;
    show('modal-curtain', false);
    humanTurnStart();
  });

  // Laajennettava loki
  $('log').addEventListener('click', () => {
    $('log').classList.toggle('expanded');
    if (state) renderLog();
  });

  // Korttidialogi
  $('trade-auto').addEventListener('click', autoTrade);
  $('trade-do').addEventListener('click', doTradeSelected);
  $('trade-close').addEventListener('click', () => { if (!mustTradeCards(state)) show('modal-trade', false); else toast('Sinun on vaihdettava (5+ korttia).'); });

  // Valloitusdialogi
  $('conquest-range').addEventListener('input', updateConquestInfo);
  $('conquest-min').addEventListener('click', () => { const r = $('conquest-range'); r.value = r.min; updateConquestInfo(); });
  $('conquest-max').addEventListener('click', () => { const r = $('conquest-range'); r.value = r.max; updateConquestInfo(); });
  $('conquest-confirm').addEventListener('click', confirmConquest);

  // Linnoitusdialogi
  $('fortify-range').addEventListener('input', (e) => { $('fortify-val').textContent = e.target.value; });
  $('fortify-confirm').addEventListener('click', confirmFortify);
  $('fortify-cancel').addEventListener('click', () => { show('modal-fortify', false); fortifyCtx = null; });

  setupZoom();
  setupLongPress();
}

// ---------------------------------------------------------------------------
// Pitkä painallus: aluetiedot-popover
// ---------------------------------------------------------------------------

/** HTML-erikoismerkkien escapointi (popoverin sisältö innerHTML:llä). */
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setupLongPress() {
  const svg = $('map');
  let timer = null, startX = 0, startY = 0, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };

  svg.addEventListener('pointerdown', (e) => {
    hideTerrPop();
    fired = false;
    if (!state || anyModalOpen()) return;
    const g = e.target.closest ? e.target.closest('.territory, .region') : null;
    const id = g?.dataset?.id;
    if (!id || !TERRITORIES[id]) return;
    startX = e.clientX; startY = e.clientY;
    cancel();
    timer = setTimeout(() => { fired = true; showTerrPop(id, startX, startY); }, 450);
  });
  // Raahaus peruu pitkän painalluksen (sama kynnys kuin napautuksen estossa).
  svg.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
  });
  svg.addEventListener('pointerup', cancel);
  svg.addEventListener('pointercancel', cancel);
  svg.addEventListener('pointerleave', cancel);
  // Pitkän painalluksen jälkeinen click ei saa laueta normaalina napautuksena.
  svg.addEventListener('click', (e) => {
    if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; }
  }, true);
}

function showTerrPop(id, clientX, clientY) {
  const t = TERRITORIES[id];
  const pop = $('terr-pop');
  const wrap = $('map-wrap');
  if (!pop || !wrap) return;
  const cont = CONTINENTS[t.continent];
  const terr = state.territories[id];
  const fogged = !!state.options?.fogOfWar && !visibleTerritories(state, fogViewer()).has(id);

  let body;
  if (fogged) {
    body = `<div class="tp-row">🌫 Sumun peitossa</div>`;
  } else if (isBlizzard(state, id)) {
    body = `<div class="tp-row">❄ Lumimyrskyn sulkema – ei pelattavissa</div>`;
  } else {
    const owner = terr.owner !== null ? state.players[terr.owner] : null;
    body =
      `<div class="tp-row">Omistaja: ${owner
        ? `<span class="tp-dot" style="background:${owner.color}"></span><strong>${escHtml(owner.name)}</strong>`
        : '—'}</div>` +
      `<div class="tp-row">Armeijat: <strong>${terr.armies}</strong></div>`;
  }
  const neighbors = t.adj.map((n) => TERRITORIES[n]?.name || n).join(', ');
  pop.innerHTML =
    `<div class="tp-title">${escHtml(t.name)}</div>` +
    `<div class="tp-row">${escHtml(cont?.name || t.continent)} (bonus +${cont?.bonus ?? 0})</div>` +
    body +
    `<div class="tp-row">Naapurit: ${escHtml(neighbors)}</div>`;
  pop.hidden = false;
  // Sijoita napautuksen viereen, mutta pysy karttalaatikon sisällä.
  const rect = wrap.getBoundingClientRect();
  let x = clientX - rect.left + 12;
  let y = clientY - rect.top + 12;
  pop.style.left = '0px';
  pop.style.top = '0px';
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  x = Math.max(8, Math.min(x, rect.width - pw - 8));
  y = Math.max(8, Math.min(y, rect.height - ph - 8));
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
}

function hideTerrPop() {
  const p = $('terr-pop');
  if (p) p.hidden = true;
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

/** Skenaariovalitsin: "Vapaa peli" + skenaariot. Skenaario lukitsee muut asetukset. */
function buildScenarioPicker() {
  const wrap = $('scenario-picker');
  if (!wrap) return;
  wrap.innerHTML = '';
  const options = [{ id: null, name: 'Vapaa peli', description: '' }, ...SCENARIO_LIST];
  options.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-opt' + ((s.id ?? null) === cfg.scenario ? ' sel' : '');
    // Nimen alussa oleva lippu-/kuvaemoji omaan spaniin → CSS näyttää sen isompana.
    const em = /^((?:[\u{1F1E6}-\u{1F1FF}]{2})|\p{Extended_Pictographic})\s*/u.exec(s.name);
    if (em) {
      const flag = document.createElement('span');
      flag.className = 'scn-flag';
      flag.textContent = em[1];
      b.appendChild(flag);
      b.appendChild(document.createTextNode(s.name.slice(em[0].length)));
    } else {
      b.textContent = s.name;
    }
    b.addEventListener('click', () => {
      cfg.scenario = s.id;
      wrap.querySelectorAll('.map-opt').forEach((el, i) => el.classList.toggle('sel', options[i].id === s.id));
      refreshScenarioLocks();
    });
    wrap.appendChild(b);
  });
  refreshScenarioLocks();
}

/** Skenaario määrää pelaajat, kartan ja estää lumimyrskyn → lukitse kentät. */
function refreshScenarioLocks() {
  const sc = cfg.scenario ? SCENARIOS[cfg.scenario] : null;
  const desc = $('scenario-desc');
  if (desc) {
    desc.hidden = !sc;
    if (sc) desc.textContent = sc.description;
  }
  const lock = (el, on) => { if (el) el.classList.toggle('locked', on); };
  lock($('field-players'), !!sc);
  lock($('field-humans'), !!sc);
  lock($('field-map'), !!sc);
  lock(document.querySelector('[data-toggle="blizzard"]'), !!sc);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function refreshSetup() { $('cfg-players').textContent = cfg.players; $('cfg-humans').textContent = cfg.humans; }

/** Päivittää valikon painikkeiden tekstit asetusten mukaan. */
function refreshMenu() {
  $('menu-sound').textContent = settings.muted ? 'Äänet: Pois' : 'Äänet: Päällä';
  $('menu-speed').textContent = settings.fastAI ? '🐢 Tekoäly: Nopea (palauta normaali)' : '⏩ Tekoäly: Normaali (nopeuta)';
  $('menu-gfx').textContent = settings.liteGfx ? 'Grafiikka: ⚡ Kevyt' : 'Grafiikka: ✨ Täysi';
  // Missiopelissä: näytä "Oma tavoite" -nappi (paljastaa aktiivisen ihmisen tavoitteen).
  $('menu-mission').hidden = !(state && state.options?.missions);
}

/** Aktiivisen (tai ensimmäisen) ihmispelaajan tavoiteteksti. */
function humanMission() {
  if (!state?.options?.missions) return null;
  const p = state.players[state.current];
  const who = (p && !p.isAI) ? p : state.players.find((x) => !x.isAI);
  return who ? { name: who.name, text: missionText(who.mission) } : null;
}

function toggleAISpeed() {
  settings.fastAI = !settings.fastAI;
  writeSetting('risk-fast-ai', settings.fastAI ? '1' : '0');
  // Päivitä nopeusnappi controls-rivillä jos tekoälyvuoro on käynnissä.
  if (state && (state.players[state.current].isAI || ui.busy)) renderControls();
}

function startGame() {
  clearSave();
  if (cfg.scenario && SCENARIOS[cfg.scenario]) {
    const sc = SCENARIOS[cfg.scenario];
    state = createGame({
      scenario: sc,
      options: { fogOfWar: cfg.fogOfWar, blizzard: false, fixedCards: cfg.fixedCards, maxTurns: cfg.maxTurns, difficulty: cfg.difficulty },
    });
    enterGame();
    if (sc.intro) toast(sc.intro);
    return;
  }
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
  state = createGame({
    players,
    mapId: cfg.mapId,
    options: { fogOfWar: cfg.fogOfWar, blizzard: cfg.blizzard, fixedCards: cfg.fixedCards, missions: cfg.missions, maxTurns: cfg.maxTurns, difficulty: cfg.difficulty },
  });
  enterGame();
}

/** Palauttaa tallennetun pelin ja jatkaa siitä mihin jäätiin. */
function continueGame() {
  const saved = loadSavedGame();
  if (!saved) { refreshContinueButton(); return; }
  try {
    state = restoreGame(saved);
  } catch (_) {
    clearSave();
    toast('Tallennus ei kelvannut – aloita uusi peli.');
    return;
  }
  enterGame();
}

/** Yhteinen aloitus uudelle ja palautetulle pelille: kartta, näkymä, vuoro. */
function enterGame() {
  ui.selected = null; ui.attackTarget = null; ui.validTargets = new Set(); ui.busy = false; ui.curtain = false;
  placeStack = [];
  hideTerrPop();
  const m = buildMap($('map'), onTerritoryTap);
  mapRefs = m.nodeRefs;
  mapG = m.gMap;
  resumeAudio();
  show('modal-setup', false);
  resetView();
  render();
  // Missiopeli: kerro ihmiselle oma salainen tavoite heti alussa.
  const mission = humanMission();
  if (mission) toast(`🎯 Salainen tavoitteesi: ${mission.text}`, 5500);
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
    placeStack = [];
    saveGame();
    refreshContinueButton();
    if (needsCurtain()) {
      // Kuumatuolisumu: piilota kartta kunnes uusi pelaaja on valmis.
      ui.curtain = true;
      render();
      $('curtain-text').textContent = `Anna laite pelaajalle ${p.name}`;
      show('modal-curtain', true);
      return;
    }
    humanTurnStart();
  }
}

/** Kuumatuoliverho tarvitaan kun sumu on päällä ja ihmispelaajia on useita. */
function needsCurtain() {
  return !!state.options?.fogOfWar && state.players.filter((p) => !p.isAI && p.alive).length >= 2;
}

/** Ihmispelaajan vuoron varsinainen aloitus (verhon jälkeen tai suoraan). */
function humanTurnStart() {
  sfx('turn');
  if (state.phase === PHASES.REINFORCE && mustTradeCards(state)) openTrade();
  if (state.pendingConquest) openConquest();
  render();
}

async function runAI() {
  cameraFocusOut(); // varmista alkuperäinen näkymä ennen tekoälyn vuoroa
  ui.busy = true; ui.selected = null; ui.validTargets = new Set();
  render();
  await delay(aiDelay());
  await runAITurn(state, {
    afterReinforce: async () => { render(); await delay(aiDelay()); },
    afterAttack: async (a, res) => { showBattle(a.fromId, a.toId, res); render(); await delay(aiDelay()); },
    afterConquest: async () => { hideBattle(); render(); await delay(aiDelay() / 2); },
    afterFortify: async () => { render(); await delay(aiDelay() / 2); },
  });
  ui.busy = false;
  hideBattle();
  render();
  await delay(250);
  beginTurn();
}

function afterHumanTurnEnd() {
  cameraFocusOut();
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
  if (isBlizzard(state, id)) return toast('❄ Lumimyrskyn sulkema alue – ei pelattavissa.');
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
  const id = ui.selected;
  const r = placeArmies(state, id, amount);
  if (!r.ok) return toast(r.reason || 'Sijoitus ei onnistunut.');
  placeStack.push({ id, n: amount });
  sfx('place');
  flashNode(id);
  if (state.reinforcements === 0) ui.selected = null;
  saveGame();
  render();
}

/** Kumoaa viimeisimmän vahvistussijoituksen. */
function undoReinforcement() {
  const last = placeStack[placeStack.length - 1];
  if (!last) return;
  const r = unplaceArmies(state, last.id, last.n);
  if (!r.ok) { placeStack.pop(); return toast(r.reason || 'Kumoaminen ei onnistunut.'); }
  placeStack.pop();
  sfx('select');
  flashNode(last.id);
  saveGame();
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

function animateAttack(fromId, toId, blitz = false) {
  const fr = mapRefs[fromId], tr = mapRefs[toId];
  if (fr) { fr.g.classList.add('attacking'); setTimeout(() => fr.g.classList.remove('attacking'), 350); }
  if (tr) { tr.g.classList.add('defending'); setTimeout(() => tr.g.classList.remove('defending'), 350); }
  // Hohtava tracer hyökkääjältä kohteelle. Blitzissä lyhyempi/pienempi ettei se
  // jää roikkumaan 180ms kierrosvälin yli.
  if (mapG) {
    if (blitz) fireTracer(mapG, TERRITORIES[fromId], TERRITORIES[toId], { dur: 0.14, r: 3 });
    else fireTracer(mapG, TERRITORIES[fromId], TERRITORIES[toId]);
  }
}

/** Lyhyt värinäpalaute (haptiikka) – riippumaton äänimykistyksestä. */
function haptic(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

// --- Leijuvat vahinkoluvut ("−N" nappien yllä) ------------------------------
// Cap: max 2 elävää per alue, ettei blitz (kierros ~180 ms välein) kasaa
// elementtejä. Kirjanpito Mapissa – ei DOM-kyselyjä.
const dmgLive = new Map(); // alueId -> elävien lukumäärä

function spawnDamage(terrId, n, color, delayMs = 0) {
  if (!mapG || !n || n <= 0) return;
  const t = TERRITORIES[terrId];
  if (!t) return;
  if ((dmgLive.get(terrId) || 0) >= 2) return;
  dmgLive.set(terrId, (dmgLive.get(terrId) || 0) + 1);
  const release = () => dmgLive.set(terrId, Math.max(0, (dmgLive.get(terrId) || 1) - 1));
  setTimeout(() => {
    try {
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', t.x);
      txt.setAttribute('y', t.y - 28);
      txt.setAttribute('class', 'dmg-float');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', color);
      txt.setAttribute('pointer-events', 'none');
      txt.textContent = `−${n}`;
      mapG.appendChild(txt);
      // Kertaluontoinen CSS-animaatio (0.8 s) → poisto ajastimella.
      setTimeout(() => {
        if (txt.parentNode) txt.parentNode.removeChild(txt);
        release();
      }, 820);
    } catch (_) { release(); }
  }, delayMs);
}

// --- Vaihebanneri (vain ihmispelaajan vaiheen vaihtuessa) --------------------
const PHASE_BANNER_TEXTS = { reinforce: 'VAHVISTUS', attack: 'HYÖKKÄYS', fortify: 'LINNOITUS' };
let phaseBannerKey = null;
let phaseBannerTimer = null;

// Ensikerran valmentajaviestit: näytetään KERRAN per vaihe kun ihmispelaaja
// astuu siihen ensi kertaa. MITÄ + MIKSI, ohitus tallennetaan localStorageen,
// jottei kokenutta pelaajaa häiritä. (Ei erillistä opastusmoottoria — käytetään
// samaa toast-komponenttia.)
const COACH_TEXTS = {
  reinforce: '💡 Vahvistus: napauta omia alueitasi ja sijoita kaikki armeijat. '
    + 'Keskitä ne rajoille ja mantereisiin — koko mantereen hallinnasta saat bonusarmeijoita joka vuoro.',
  attack: '💡 Hyökkäys: napauta omaa aluetta (2+ joukkoa), sitten viereistä vihollisaluetta. '
    + '🎯 voitto-osuus kertoo onnistumistodennäköisyyden — vihreä on turvallinen, punainen riskialtis.',
  fortify: '💡 Linnoitus: siirrä lopuksi joukkoja yhdellä siirrolla sisämaasta rajalle. '
    + 'Vahvat rajat kestävät vihollisen hyökkäykset — tai ohita jos kaikki on jo hyvin.',
};

function maybeCoach(phase) {
  const text = COACH_TEXTS[phase];
  if (!text) return;
  const skey = `risk-coach-${phase}`;
  if (readSetting(skey) === '1') return; // jo nähty
  writeSetting(skey, '1');
  // Anna vaihebannerin pyyhkäistä ensin, sitten näytä pidempi valmennusvinkki.
  setTimeout(() => toast(text, 6000), 900);
}

function maybePhaseBanner() {
  // Avain sisältää vuoron + pelaajan + vaiheen: banneri näytetään kerran
  // per vaiheenvaihto, myös vuoron alussa.
  const key = `${state.turnCount}:${state.current}:${state.phase}`;
  if (key === phaseBannerKey) return;
  const p = state.players[state.current];
  if (!p || p.isAI) { phaseBannerKey = key; return; } // ei tekoälyvuoroilla
  // Verhon takana: älä kuluta avainta – banneri näytetään kun pelaaja on valmis.
  if (ui.curtain) return;
  phaseBannerKey = key;
  const text = PHASE_BANNER_TEXTS[state.phase];
  if (!text) return;
  const b = $('phase-banner');
  if (!b) return;
  b.textContent = text;
  b.style.setProperty('--pb-accent', p.color);
  b.hidden = false;
  // Käynnistä pyyhkäisyanimaatio uudelleen (reflow-pakotus).
  b.classList.remove('sweep');
  void b.offsetWidth;
  b.classList.add('sweep');
  clearTimeout(phaseBannerTimer);
  phaseBannerTimer = setTimeout(() => { b.hidden = true; b.classList.remove('sweep'); }, 1150);
  maybeCoach(state.phase); // ensikerran valmennus (kertaluontoinen)
}

// --- Voittokonfetti (vain kun ihmisen puoli voittaa) -------------------------
function burstConfetti() {
  if (document.body.classList.contains('lite')) return;
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
  const host = $('modal-gameover');
  if (!host) return;
  for (let i = 0; i < 24; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    // Deterministinen "satunnaisuus" indeksistä: sijainti, väri, viive, ajelehdinta.
    c.style.left = `${(i * 41 + 7) % 100}%`;
    c.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
    c.style.animationDelay = `${(i % 8) * 0.07}s`;
    c.style.setProperty('--cf-drift', `${((i * 29) % 60) - 30}px`);
    c.style.setProperty('--cf-spin', `${360 + (i * 53) % 360}deg`);
    host.appendChild(c);
    setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, 2400);
  }
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
  cameraFocusIn(fromId, toId);
  sfx('attack');
  haptic(15);
  showBattle(fromId, toId, res);
  saveGame();
  if (state.pendingConquest) { openConquest(); return; }
  if (state.territories[fromId].armies < 2) clearSelection();
  else if (!canAttack(state, fromId, toId)) { ui.attackTarget = null; recomputeAttackTargets(); }
  render();
}

async function doBalancedBlitz() {
  const fromId = ui.selected, toId = ui.attackTarget;
  if (!fromId || !toId) return;
  ui.busy = true; render();
  cameraFocusIn(fromId, toId, false); // blitz palauttaa kameran itse silmukan jälkeen
  const fromA = state.territories[fromId].armies;
  const toA = state.territories[toId].armies;
  const result = resolveBalancedBlitz(fromA, toA, state.rng);
  // Näytä jokainen kierros animoituna. Tracer kevyenä (blitz) ettei kasaudu.
  let first = true;
  for (const round of result.rounds) {
    animateAttack(fromId, toId, !first);
    first = false;
    showBattle(fromId, toId, round);
    render();
    await delay(180);
  }
  applyBlitzResult(state, fromId, toId, result.finalAttacker, result.finalDefender);
  ui.busy = false;
  saveGame();
  if (state.pendingConquest) { render(); openConquest(); return; }
  cameraFocusOut();
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
  if (!pc) return;
  clearTimeout(_camHold); // pidä kamera kohdistettuna dialogin ajan
  // Kun siirtomäärä on pakotettu (min === max), liukusäädin + Min/Max ovat
  // kuolleita kontrolleja → piilota ne ja kerro määrä suoraan.
  const forced = pc.minMove >= pc.maxMove;
  $('modal-conquest').classList.toggle('forced', forced);
  $('conquest-text').textContent = forced
    ? `Valtasit ${TERRITORIES[pc.toId].gen}! ${pc.maxMove} armeijaa siirtyy alueelle.`
    : `Valtasit ${TERRITORIES[pc.toId].gen}! Siirrä ${pc.minMove}–${pc.maxMove} armeijaa alueelle.`;
  const r = $('conquest-range');
  r.min = pc.minMove; r.max = pc.maxMove; r.value = pc.maxMove;
  updateConquestInfo();
  show('modal-conquest', true);
  render();
}
/** Päivittää valloitusdialogin lukeman ja "jää → siirtyy" -jaon. */
function updateConquestInfo() {
  const pc = state?.pendingConquest;
  if (!pc) return;
  const v = Number($('conquest-range').value);
  $('conquest-val').textContent = v;
  const stay = state.territories[pc.fromId].armies - v;
  $('conquest-split').textContent =
    `${TERRITORIES[pc.fromId].name} jää: ${stay} → ${TERRITORIES[pc.toId].name} siirtyy: ${v}`;
}
function confirmConquest() {
  const v = Number($('conquest-range').value);
  const conqueredId = state.pendingConquest?.toId;
  resolveConquest(state, v);
  show('modal-conquest', false);
  hideBattle();
  sfx('conquer');
  haptic(30);
  flashConquest(conqueredId);
  cameraFocusOut();
  saveGame();
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
  // Pakotettu määrä (max === 1) → piilota kuollut liukusäädin, kuten valloituksessa.
  const forced = max <= 1;
  $('modal-fortify').classList.toggle('forced', forced);
  $('fortify-text').textContent = forced
    ? `Siirrä 1 armeija: ${TERRITORIES[fromId].name} → ${TERRITORIES[toId].name}.`
    : `Siirrä joukkoja ${TERRITORIES[fromId].name} → ${TERRITORIES[toId].name}.`;
  const r = $('fortify-range');
  r.min = 1; r.max = max; r.value = max;
  $('fortify-val').textContent = max;
  show('modal-fortify', true);
}
function confirmFortify() {
  if (!fortifyCtx) return;
  const v = Number($('fortify-range').value);
  const fromId = fortifyCtx.fromId, toId = fortifyCtx.toId;
  const res = fortify(state, fromId, toId, v);
  show('modal-fortify', false);
  fortifyCtx = null;
  if (!res.ok) { toast(res.reason); return; }
  animateFortifyMove(fromId, toId, v);
  saveGame();
  afterHumanTurnEnd();
}

/**
 * Linnoitussiirron visualisointi: kultaiset "joukot" virtaavat lähteestä
 * kohteeseen porrastettuna (dialogi on jo kiinni → näkyy kartalla). Käyttää
 * samaa tracer-mekanismia kuin hyökkäys. Määrä katolla ettei kasaudu.
 */
function animateFortifyMove(fromId, toId, count) {
  if (!mapG) return;
  const n = Math.max(1, Math.min(count, 5));
  for (let i = 0; i < n; i++) {
    setTimeout(() => fireTracer(mapG, TERRITORIES[fromId], TERRITORIES[toId], { dur: 0.5, r: 5 }), i * 90);
  }
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
  const nextBonus = state.options?.fixedCards
    ? 'Kiinteät arvot: jalkaväki 4 · ratsuväki 6 · tykistö 8 · sekasarja/jokeri 10.'
    : `Seuraava sarja: +${setValue(state.setsTraded)} armeijaa.`;
  $('trade-hint').textContent = (mustTradeCards(state)
    ? 'Sinulla on 5+ korttia – vaihto on pakollinen ennen hyökkäystä. '
    : 'Valitse 3 korttia: kolme samaa tyyppiä, yksi kutakin tai jokeri sarjassa. ') + nextBonus;
  const sel = [...tradeSel].map((i) => player.cards[i]);
  $('trade-do').disabled = !(sel.length === 3 && isValidSet(sel));
}
function doTradeSelected() {
  const idx = [...tradeSel];
  const res = tradeCards(state, idx);
  if (!res.ok) { toast(res.reason); return; }
  tradeSel.clear();
  toast(`+${res.bonus} armeijaa vaihdosta!`);
  saveGame();
  if (state.players[state.current].cards.length >= 3 && mustTradeCards(state)) renderTrade();
  else { show('modal-trade', false); }
  render();
}
function autoTrade() {
  const player = state.players[state.current];
  // Suosi sarjaa, jonka jokin kortti on omalta alueelta (+2 aluebonus);
  // muuten ensimmäinen kelvollinen.
  const cards = player.cards;
  const n = cards.length;
  const ownsCardTerritory = (c) => c.territoryId && state.territories[c.territoryId]?.owner === state.current;
  let first = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const set = [cards[i], cards[j], cards[k]];
    if (!isValidSet(set)) continue;
    if (!first) first = [i, j, k];
    if (set.some(ownsCardTerritory)) {
      tradeSel.clear(); tradeSel.add(i); tradeSel.add(j); tradeSel.add(k);
      doTradeSelected();
      return;
    }
  }
  if (first) {
    tradeSel.clear(); first.forEach((i) => tradeSel.add(i));
    doTradeSelected();
    return;
  }
  toast('Ei sopivaa korttisarjaa.');
}

// ---------------------------------------------------------------------------
// Renderöinti
// ---------------------------------------------------------------------------

/** Sumun katselijan indeksi: vuorossa oleva ihminen, muuten ensimmäinen ihminen. */
function fogViewer() {
  if (!state.players[state.current].isAI) return state.current;
  const h = state.players.find((p) => !p.isAI);
  return h ? h.index : state.current;
}

function render() {
  if (!state) return;
  const view = {
    selected: ui.selected,
    attackTarget: ui.attackTarget,
    validTargets: ui.validTargets,
    blizzards: state.options?.blizzard ? new Set(state.blizzards) : new Set(),
    // Verhon aikana ei paljasteta uuden pelaajan näkyvyyttä: tyhjä joukko
    // pitää koko kartan sumun peitossa kunnes pelaaja on valmis.
    visible: state.options?.fogOfWar ? (ui.curtain ? new Set() : visibleTerritories(state, fogViewer())) : null,
  };
  updateMap(mapRefs, state, view);
  // Hyökkäysnuoli: näkyy kun hyökkääjä JA kohde on valittu (halpa: yksi elementti).
  if (mapG) {
    if (state.phase === PHASES.ATTACK && ui.selected && ui.attackTarget && !ui.curtain) {
      showAttackArrow(mapG, TERRITORIES[ui.selected], TERRITORIES[ui.attackTarget]);
    } else {
      hideAttackArrow(mapG);
    }
  }
  maybePhaseBanner();
  renderHUD();
  renderPlayers();
  renderLog();
  renderControls();
}

function renderHUD() {
  const p = state.players[state.current];
  // Vuororaja käytössä → näytä eteneminen "Vuoro N/raja"; muuten pelkkä numero.
  const cap = state.options?.maxTurns || 0;
  $('turn-badge').textContent = cap > 0 ? `Vuoro ${state.turnCount}/${cap}` : `Vuoro ${state.turnCount}`;
  // Viimeisillä vuoroilla korosta lähestyvä raja.
  $('turn-badge').classList.toggle('hl', cap > 0 && state.turnCount > cap - 5);
  $('phase-badge').textContent = PHASE_NAMES[state.phase];
  $('cp-name').textContent = p.name;
  $('cp-dot').style.background = p.color;
  // Vuorossa olevan pelaajan väri teemavärinä: HUD-reuna + dot-hehku.
  $('hud').style.setProperty('--cp-glow', p.color);
  const rb = $('reinforce-badge');
  if (state.phase === PHASES.REINFORCE) {
    rb.hidden = false; rb.textContent = `+${state.reinforcements}`;
    rb.classList.add('hl');
  } else { rb.hidden = true; rb.classList.remove('hl'); }
}

function renderPlayers() {
  const panel = $('players-panel');
  panel.innerHTML = '';
  const snap = snapshot(state);
  let activeChip = null;
  state.players.forEach((p, i) => {
    const chip = document.createElement('div');
    const isActive = i === state.current;
    chip.className = 'player-chip' + (isActive ? ' active' : '') + (p.alive ? '' : ' dead');
    // Vasen väripalkki + aktiivisen hehku pelaajan väristä.
    chip.style.borderLeft = `3px solid ${p.color}`;
    chip.style.setProperty('--chip-glow', p.color);
    chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>` +
      `<span>${p.name}</span>` +
      `<span class="pc-stats">${snap[i].territories}⬢ ${snap[i].armies}⚔️ ${snap[i].cards}🃏</span>`;
    panel.appendChild(chip);
    if (isActive) activeChip = chip;
  });
  if (activeChip && activeChip.scrollIntoView) {
    try { activeChip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (_) {}
  }
}

function renderLog() {
  const log = $('log');
  const count = log.classList.contains('expanded') ? 60 : 12;
  log.innerHTML = state.log.slice(-count).map((l) => `<div class="l-${l.type}">${l.msg}</div>`).join('');
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
    const row = addRow(c);
    addHint(row, me.isAI ? `Tekoäly (${me.name}) pelaa…` : 'Taistelu käynnissä…');
    if (me.isAI) {
      addBtn(row, settings.fastAI ? '🐢 Normaali' : '⏩ Nopeuta', 'ghost', toggleAISpeed);
    }
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
    const cardLabel = tradeable
      ? (state.options?.fixedCards
          ? `Kortit ★ (${me.cards.length})`
          : `Kortit ★ (${me.cards.length}) · +${setValue(state.setsTraded)}`)
      : `Kortit (${me.cards.length})`;
    addBtn(row2, cardLabel, tradeable ? 'ghost notify' : 'ghost', openTrade, me.cards.length < 3);
    if (sel && rem > 0) {
      addBtn(row2, '+1', '', () => addReinforcement(1));
      addBtn(row2, '+5', '', () => addReinforcement(5), rem < 5);
      addBtn(row2, `+${rem}`, 'primary', () => addReinforcement(rem));
    } else if (rem === 0) {
      addBtn(row2, 'Hyökkäykseen →', 'primary', () => {
        const r = endReinforcement(state);
        if (!r.ok) { toast(r.reason); if (mustTradeCards(state)) openTrade(); return; }
        placeStack = []; // kumoaminen ei ole enää mahdollista
        clearSelection(); saveGame(); render();
      });
    }
    // "Kumoa" pidetään AINA samassa paikassa (rivin lopussa) ja disabloidaan
    // kun ei ole kumottavaa. Näin +1/+5-napit eivät siirry sormen alta
    // sijoituksen jälkeen — nappi ei koskaan vaihda toimintoaan paikallaan.
    addBtn(row2, 'Kumoa', 'ghost', undoReinforcement, placeStack.length === 0);
  } else if (state.phase === PHASES.ATTACK) {
    // Kaksi riviä: (1) pelkkä tieto (vihje + voitto-osuus), (2) toiminnot.
    // Näin toistettavat hyökkäysnapit (Nopat/Blitz) eivät ahtaudu tiedon kanssa,
    // ja peruuttamaton "Lopeta →" saa oman erotellun paikkansa (ei vahinkoloppua).
    const info = addRow(c);
    const acts = addRow(c);
    if (!ui.selected) {
      addHint(info, 'Valitse oma alue josta hyökätä');
    } else if (!ui.attackTarget) {
      const a = state.territories[ui.selected].armies;
      addHint(info, `${TERRITORIES[ui.selected].name} (${a}⚔) — napauta kohdetta (punainen)`);
      addBtn(acts, 'Peru', 'ghost', () => { clearSelection(); render(); });
    } else {
      const fa = state.territories[ui.selected].armies;
      const ta = state.territories[ui.attackTarget].armies;
      addHint(info, `${TERRITORIES[ui.selected].name}(${fa}) → ${TERRITORIES[ui.attackTarget].name}(${ta})`);
      addWinProb(info, calcBlitzWinProb(fa, ta));
      addBtn(acts, 'Peru', 'ghost', () => { clearSelection(); render(); });
      addBtn(acts, 'Nopat', 'danger', doSingleAttack);
      addBtn(acts, 'Blitz ⚡', 'danger', doBalancedBlitz);
    }
    // Väli erottaa peruuttamattoman vaiheenlopetuksen toistettavista hyökkäys-
    // napeista, jottei "Blitz ⚡":n vieressä lopeta hyökkäysvaihetta vahingossa.
    const spacer = document.createElement('div');
    spacer.className = 'bar-spacer';
    acts.appendChild(spacer);
    addBtn(acts, 'Lopeta →', 'primary', () => {
      const r = endAttack(state); if (!r.ok) { toast(r.reason); return; }
      clearSelection(); saveGame(); render();
    });
  } else if (state.phase === PHASES.FORTIFY) {
    const row = addRow(c);
    addHint(row, ui.selected ? 'Valitse kohdealue' : 'Valitse alue josta siirtää (tai ohita)');
    if (ui.selected) addBtn(row, 'Peru', 'ghost', () => { clearSelection(); render(); });
    addBtn(row, 'Päätä vuoro', 'primary', () => { endTurn(state); saveGame(); afterHumanTurnEnd(); });
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

/**
 * Näyttää koko taistelun (blitz) voittotodennäköisyyden hyökkäyspaneelissa.
 * Väri koodaa riskin: ≥65 % suosiollinen, 40–65 % tasainen, <40 % riski.
 * Sama luku jota Blitz-ratkaisu käyttää → merkki on rehellinen ennuste.
 */
function addWinProb(parent, p) {
  const pct = Math.round(p * 100);
  const cls = pct >= 65 ? 'good' : (pct >= 40 ? 'even' : 'bad');
  const s = document.createElement('span');
  s.className = `win-prob ${cls}`;
  s.textContent = `🎯 ${pct}%`;
  s.title = 'Arvioitu todennäköisyys vallata alue (koko taistelu)';
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

/** Pieni CSS-noppa: 3×3-pistegridi, arvo luokalla die-1..die-6. */
function dieHtml(v, side) {
  let pips = '';
  for (let i = 1; i <= 9; i++) pips += `<i class="p p${i}"></i>`;
  return `<span class="die ${side} die-${clamp(v, 1, 6)}">${pips}</span>`;
}

function showBattle(fromId, toId, res) {
  const b = $('battle-banner');
  const att = res.attackerDice.map((d) => dieHtml(d, 'att')).join('');
  const def = res.defenderDice.map((d) => dieHtml(d, 'def')).join('');
  const fromA = state.territories[fromId]?.armies ?? '?';
  const toA = state.territories[toId]?.armies ?? '?';
  const attLost = res.attackerLosses > 0 ? ' lost' : '';
  const defLost = res.defenderLosses > 0 ? ' lost' : '';
  b.innerHTML =
    `<div><span class="att">${TERRITORIES[fromId].name}</span> → <span class="def">${TERRITORIES[toId].name}</span></div>` +
    `<div class="dice">${att} <span class="vs">vs</span> ${def}</div>` +
    `<div class="battle-losses">` +
    `<span class="att num${attLost}">−${res.attackerLosses} (jäljellä ${fromA})</span>` +
    ` &nbsp;·&nbsp; ` +
    `<span class="def num${defLost}">−${res.defenderLosses} (jäljellä ${toA})</span>` +
    `</div>`;
  // Spring-sisääntulo: nollaa luokka ja lisää uudelleen jotta animaatio toistuu.
  b.hidden = false;
  b.classList.remove('pop-in');
  void b.offsetWidth;
  b.classList.add('pop-in');
  // Leijuvat vahinkoluvut nappien ylle: punainen puolustajalle, kullanhohtoinen
  // hyökkääjälle (porrastus 80 ms, vain kun tappioita tuli).
  spawnDamage(toId, res.defenderLosses, '#ff6b6b', 0);
  spawnDamage(fromId, res.attackerLosses, '#ffd34d', 80);
}
function hideBattle() { $('battle-banner').hidden = true; }

let toastTimer = null;
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  t.classList.remove('pop-in');
  void t.offsetWidth;
  t.classList.add('pop-in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

function flashNode(id) {
  const r = mapRefs[id];
  if (!r) return;
  // "Leimasin": luku iskeytyy isona ja asettuu paikoilleen; nappi painuu hetkeksi.
  // Käynnistetään uudelleen reflow-pakotuksella (sama kuvio kuin count-pop).
  const restart = (node, cls) => {
    node.classList.remove(cls);
    try { void node.getBBox(); } catch (_) { /* getBBox voi heittää jos ei näkyvissä */ }
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), 360);
  };
  restart(r.count, 'stamp');
  restart(r.circle, 'press');
}

function flashConquest(id) {
  const r = id && mapRefs[id];
  if (!r) return;
  r.g.classList.add('just-conquered');
  // Toinen viivästetty rengas: kloonataan halo, animoidaan ja poistetaan ajastimella.
  let ring2 = null;
  try {
    ring2 = r.halo.cloneNode(false);
    ring2.classList.remove('halo-selected', 'halo-target', 'halo-valid');
    ring2.classList.add('conquer-ring2');
    ring2.setAttribute('stroke', '#ffe27a');
    ring2.setAttribute('stroke-opacity', 0.95);
    r.g.appendChild(ring2);
  } catch (_) {}
  setTimeout(() => {
    r.g.classList.remove('just-conquered');
    if (ring2 && ring2.parentNode) ring2.parentNode.removeChild(ring2);
  }, 600);
}

function gameOver() {
  clearSave();
  const w = state.players[state.winner];
  const humanCount = state.players.filter((p) => !p.isAI).length;
  let text;
  let humanWin = !w.isAI;
  if (state.winnerTeam && state.teamNames) {
    // Liittoumapeli (skenaario): kerro voitto pelaajan näkökulmasta.
    const teamName = state.teamNames[state.winnerTeam] || state.winnerTeam;
    const human = state.players.find((p) => !p.isAI);
    humanWin = !!(human && human.team === state.winnerTeam);
    if (human && human.team === state.winnerTeam) {
      text = human.alive
        ? `Voitto! ${teamName} torjui hyökkäyksen.`
        : `${teamName} voitti sodan — mutta ${human.name} ehti kaatua.`;
    } else {
      text = `${teamName} voitti sodan. Hävisit.`;
    }
  } else if (state.winByMission) {
    // Salainen tavoite täyttyi.
    text = (!w.isAI && humanCount === 1)
      ? 'Täytit salaisen tavoitteesi ja voitit!'
      : `${w.name} täytti salaisen tavoitteensa ja voitti!`;
  } else if (state.winByPoints) {
    // Pehmeä vuororaja täyttyi → voitto pisteillä (eniten alueita).
    text = (!w.isAI && humanCount === 1)
      ? 'Vuororaja täynnä — johdit pisteissä ja voitit!'
      : `Vuororaja täynnä — ${w.name} voitti pisteillä.`;
  } else {
    text = (!w.isAI && humanCount === 1)
      ? 'Sinä valloitit maailman!'
      : `${w.name} valloitti maailman!`;
  }
  $('gameover-text').textContent = text;
  renderGameOverStats();
  show('modal-gameover', true);
  if (humanWin) burstConfetti();
}

/** Loppuruudun tilastotaulukko: rivit pelaajat, sarakkeet tilastot. */
function renderGameOverStats() {
  const wrap = $('gameover-stats');
  const stats = state.stats || state.players.map(() => emptyStats());
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = state.players.map((p, i) => {
    const st = stats[i] || emptyStats();
    return `<tr class="${i === state.winner ? 'winner' : ''}">` +
      `<td><span class="st-dot" style="background:${p.color}"></span>${esc(p.name)}</td>` +
      `<td>${st.conquests}</td>` +
      `<td>${st.battlesWon}/${st.battlesLost}</td>` +
      `<td>${st.setsTraded}</td>` +
      `<td>${st.eliminations}</td>` +
      `</tr>`;
  }).join('');
  // Missiopelissä paljasta kaikkien salaiset tavoitteet ja täyttyikö ne.
  let missions = '';
  if (state.options?.missions) {
    const items = state.players.map((p, i) => {
      const done = missionComplete(state, i);
      return `<li class="${i === state.winner ? 'winner' : ''}">` +
        `<span class="st-dot" style="background:${p.color}"></span>` +
        `<strong>${esc(p.name)}:</strong> ${esc(missionText(p.mission))} ` +
        `<span class="mission-flag">${done ? '✓' : '✗'}</span></li>`;
    }).join('');
    missions = `<div class="mission-reveal"><h4>🎯 Salaiset tavoitteet</h4><ul>${items}</ul></div>`;
  }
  wrap.innerHTML =
    `<table class="stats-table">` +
    `<thead><tr><th>Pelaaja</th><th>Valloitukset</th><th>Taistelut V/H</th><th>Sarjat</th><th>Pudotukset</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<p class="stats-turns">Vuoroja pelattu: ${state.turnCount}</p>` +
    missions;
}

// ---------------------------------------------------------------------------
// Apuvälineet
// ---------------------------------------------------------------------------

function show(id, on) { $(id).hidden = !on; }
function anyModalOpen() {
  return ['modal-trade', 'modal-conquest', 'modal-fortify', 'modal-gameover', 'modal-setup',
    'modal-menu', 'modal-rules', 'modal-curtain']
    .some((id) => !$(id).hidden);
}

// ---------------------------------------------------------------------------
// Zoom & pan
// ---------------------------------------------------------------------------

const view = { scale: 1, tx: 0, ty: 0, rot: 0, rcx: 500, rcy: 350 };
let _interactTimer = null;
/**
 * Merkitsee kartan "interacting"-tilaan raahauksen/zoomauksen ajaksi ja
 * poistaa merkinnän ~180 ms viimeisen liikkeen jälkeen. CSS poistaa raskaat
 * SVG-suodattimet tämän tilan ajaksi → täysin sulava veto, suodattimet
 * palaavat kun kartta on paikallaan.
 */
function markInteracting() {
  const svg = $('map');
  if (!svg) return;
  svg.classList.add('interacting');
  clearTimeout(_interactTimer);
  _interactTimer = setTimeout(() => svg.classList.remove('interacting'), 180);
}
function applyView() {
  const g = $('map').querySelector('#g-map');
  if (g) {
    const rot = view.rot ? ` rotate(${view.rot.toFixed(3)} ${view.rcx.toFixed(1)} ${view.rcy.toFixed(1)})` : '';
    g.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.scale})${rot}`);
  }
  markInteracting();
}

// ---------------------------------------------------------------------------
// Hyökkäyskamera: pieni kääntö + zoom hyökkäyksen ajaksi, paluu jälkeen.
// Kääntösuunta riippuu hyökättävän alueen sijainnista kartan x-puoliväliin
// nähden. Zoom vain jos alkuperäinen näkymä on riittävän kaukana. Puhdas
// transform-animaatio (ei suodattimia) → kevyt myös vanhoilla laitteilla;
// ohitetaan jos käyttäjä on valinnut vähennetyn liikkeen (reduced motion).
// ---------------------------------------------------------------------------

const CAM = { ZOOM_THRESHOLD: 1.7, ZOOM_FACTOR: 2.4, ANGLE: 4, HOLD_MS: 850, IN_MS: 260, OUT_MS: 340 };
let _camRaf = null, _camHold = null, _camBase = null, _camActive = false;

function cameraEnabled() {
  try { return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (_) { return true; }
}
const _easeOut = (k) => 1 - Math.pow(1 - k, 3);
const _easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function _tweenView(target, dur, ease, done) {
  if (_camRaf) cancelAnimationFrame(_camRaf);
  const from = { scale: view.scale, tx: view.tx, ty: view.ty, rot: view.rot };
  view.rcx = target.rcx; view.rcy = target.rcy; // pivot suoraan (ei tweenata)
  const start = performance.now();
  const step = (now) => {
    const k = ease(Math.min(1, (now - start) / dur));
    view.scale = from.scale + (target.scale - from.scale) * k;
    view.tx = from.tx + (target.tx - from.tx) * k;
    view.ty = from.ty + (target.ty - from.ty) * k;
    view.rot = from.rot + (target.rot - from.rot) * k;
    applyView();
    if (k < 1) _camRaf = requestAnimationFrame(step);
    else { _camRaf = null; if (done) done(); }
  };
  _camRaf = requestAnimationFrame(step);
}

/** Kohdista kamera hyökkäykseen. hold=true palauttaa itsestään pienen viiveen jälkeen. */
function cameraFocusIn(fromId, toId, hold = true) {
  if (!cameraEnabled()) return;
  const a = TERRITORIES[fromId], b = TERRITORIES[toId];
  const vb = $('map')?.viewBox?.baseVal;
  if (!a || !b || !vb) return;
  if (!_camActive) { _camBase = { scale: view.scale, tx: view.tx, ty: view.ty }; _camActive = true; }
  clearTimeout(_camHold);
  const midX = vb.width / 2, midY = vb.height / 2;
  const fx = (a.x + b.x) / 2, fy = (a.y + b.y) / 2;       // fokus taistelun keskelle
  const doZoom = _camBase.scale <= CAM.ZOOM_THRESHOLD;    // zoom vain jos kaukana
  const scaleT = doZoom ? clamp(_camBase.scale * CAM.ZOOM_FACTOR, 0.6, 4) : _camBase.scale;
  const rotT = (b.x < vb.width / 2) ? CAM.ANGLE : -CAM.ANGLE; // suunta x-puolivälistä
  const txT = doZoom ? midX - scaleT * fx : _camBase.tx;
  const tyT = doZoom ? midY - scaleT * fy : _camBase.ty;
  _tweenView({ scale: scaleT, tx: txT, ty: tyT, rot: rotT, rcx: fx, rcy: fy }, CAM.IN_MS, _easeOut);
  if (hold) _camHold = setTimeout(cameraFocusOut, CAM.HOLD_MS);
}

/** Palauttaa kameran käyttäjän alkuperäiseen näkymään. */
function cameraFocusOut() {
  clearTimeout(_camHold);
  if (!_camActive || !_camBase) return;
  const base = _camBase;
  _tweenView({ scale: base.scale, tx: base.tx, ty: base.ty, rot: 0, rcx: view.rcx, rcy: view.rcy },
    CAM.OUT_MS, _easeInOut, () => {
      view.scale = base.scale; view.tx = base.tx; view.ty = base.ty; view.rot = 0;
      applyView();
      _camActive = false; _camBase = null;
    });
}

/** Peruu kameran (käyttäjän oma pan/zoom ottaa vallan; ei palauteta vanhaa). */
function cancelCamera() {
  clearTimeout(_camHold);
  if (_camRaf) { cancelAnimationFrame(_camRaf); _camRaf = null; }
  view.rot = 0;
  _camActive = false; _camBase = null;
}
/** Sovittaa näkymän alueiden rajaamaan laatikkoon (padding ~40). */
function resetView() {
  cancelCamera();
  const svg = $('map');
  const vb = svg?.viewBox?.baseVal;
  const ids = Object.keys(TERRITORIES);
  if (!vb || !vb.width || !ids.length) { view.scale = 1; view.tx = 0; view.ty = 0; view.rot = 0; applyView(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    const t = TERRITORIES[id];
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }
  const pad = 40;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = clamp(Math.min(vb.width / w, vb.height / h), 0.6, 4);
  view.scale = scale;
  view.tx = (vb.width - w * scale) / 2 - minX * scale;
  view.ty = (vb.height - h * scale) / 2 - minY * scale;
  applyView();
}
function zoomBy(factor, cx = 500, cy = 350) {
  cancelCamera(); // käyttäjän zoom ottaa vallan hyökkäyskameralta
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
    if (_camActive) cancelCamera(); // raahaus ottaa vallan hyökkäyskameralta
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
  // Merkitse että sovelluslogiikka on latautunut ja käynnistynyt: index.html:n
  // virhepalkki käyttää tätä erottamaan aidon latausvirheen ohimenevästä
  // väärästä hälytyksestä (SW:n taustapäivitys / iOS-moduulikummajainen).
  window.__riskBooted = true;
  refreshSetup();
  setupHandlers();
  applyGfxMode(); // kevyt grafiikka päälle heti (tallennettu valinta tai autotunnistus)
  refreshContinueButton(); // näytä "Jatka peliä" jos tallennus on olemassa
  // Herätä audio ensimmäisellä käyttäjäeleellä (mobiilin autoplay-esto).
  const wake = () => { resumeAudio(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  // Kevyt debug-/testikoukku (e2e-testit lukevat tilan tästä).
  window.__risk = { getState: () => state, getUi: () => ui, adj: (id) => TERRITORIES[id].adj };
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

boot();
