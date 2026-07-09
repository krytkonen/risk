// Kartan piirto SVG:nä pelitilasta. Piirtää meren, mannerlaatikot,
// naapuruusviivat, aluenapit (armeijamäärä) ja korostukset valinnoille.
// Ei pelilogiikkaa – vain visualisointi + napautusten välitys.

import { TERRITORIES, TERRITORY_IDS, CONTINENTS, continentTerritories, activeMap } from '../data/territories.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const NODE_R = 21;

// Värisokeusturvallinen paletti (Okabe-Ito-johdannainen): pienin pareittainen
// ΔE kaikissa CVD-tiloissa ~16 vs. vanhan puna/vihreä-paletin ~6 (todennettu
// tools/cvd-sim.mjs:llä). Pipit (PIP_SHAPES) hoitavat silti pahimman tapauksen.
export const PLAYER_COLORS = ['#0072b2', '#d55e00', '#029e73', '#e6a000', '#cc79a7', '#56b4e9'];
export const PLAYER_COLORS_DARK = ['#00446b', '#803800', '#015f45', '#8a6000', '#7a4964', '#346c8c'];
// Vaaleammat keskisävyt napin radiaaligradientin keskelle (syvyysvaikutelma).
const PLAYER_COLORS_LIGHT = ['#80b9d9', '#eaaf80', '#81cfb9', '#f3d080', '#e6bcd3', '#abdaf4'];
const NEUTRAL_LIGHT = '#8a8a8a', NEUTRAL_MID = '#555', NEUTRAL_DARK = '#333';


// Omistajakohtainen VÄRISOKEUSVIHJE ilman meluisaa rengasta: pieni kiinteä
// muotomerkki (pip) tokenin oikeaan alakulmaan. Muoto vaihtuu pelaajaindeksin
// mukaan (ympyrä / neliö / kolmio / vinoneliö / viisikulmio / tähti), joten
// omistaja erottuu myös ilman väriä. Piirretään yksi <path>, jonka 'd' vaihtuu.
const PIP_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'star'];

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

// --- Alue-REGIONIEN täyttö: per-omistaja PYSTYGRADIENTTI (#region-grad-*) ---
// Litteä merensinellä tummennettu täyttö luki mutaisena; pystygradientti
// säilyttää syvyyden (vaalea ylhäällä → tumma alhaalla) mutta palauttaa
// kylläisyyden, joten omistus lukee kirkkaana. Gradientit luodaan kerran
// buildDefsissä ja viitataan url()-täyttönä updateMapissa.

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

  // --- Meri: syvä monipysäkkinen radiaaligradientti (rikkaampi "kulho"-syvyys).
  // Keskusta nostettu kirkkaammaksi, reunat painuvat tummiksi → lauta kaartuu. ---
  const sea = el('radialGradient', { id: 'sea', cx: '50%', cy: '36%', r: '90%' });
  sea.appendChild(el('stop', { offset: '0%', 'stop-color': mix(seaTop, '#ffffff', 0.12) }));
  sea.appendChild(el('stop', { offset: '18%', 'stop-color': mix(seaTop, '#ffffff', 0.04) }));
  sea.appendChild(el('stop', { offset: '38%', 'stop-color': seaTop }));
  sea.appendChild(el('stop', { offset: '60%', 'stop-color': mix(seaTop, seaMid, 0.7) }));
  sea.appendChild(el('stop', { offset: '80%', 'stop-color': seaMid }));
  sea.appendChild(el('stop', { offset: '100%', 'stop-color': mix(seaBot, '#000000', 0.35) }));
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
  // Kolmiportainen vinjetti antaa "kulhon" reunavarjon (syvyys), ei suodattimia.
  const vignette = el('radialGradient', { id: 'vignette', cx: '50%', cy: '48%', r: '75%' });
  vignette.appendChild(el('stop', { offset: '45%', 'stop-color': vigCol, 'stop-opacity': 0 }));
  vignette.appendChild(el('stop', { offset: '80%', 'stop-color': vigCol, 'stop-opacity': 0.3 }));
  vignette.appendChild(el('stop', { offset: '100%', 'stop-color': vigCol, 'stop-opacity': 0.68 }));
  defs.appendChild(vignette);

  // --- Koko laudan valaistuskiilto (staattinen): hyvin hienovarainen ylhäältä
  // tuleva valo, jotta lauta tuntuu valaistulta. Gradientti + yksi rect,
  // ei suodattimia. ---
  const boardSheen = el('linearGradient', { id: 'board-sheen', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  boardSheen.appendChild(el('stop', { offset: '0%', 'stop-color': '#eaf4ff', 'stop-opacity': 0.07 }));
  boardSheen.appendChild(el('stop', { offset: '38%', 'stop-color': '#eaf4ff', 'stop-opacity': 0 }));
  boardSheen.appendChild(el('stop', { offset: '100%', 'stop-color': '#02070d', 'stop-opacity': 0.12 }));
  defs.appendChild(boardSheen);

  // --- Suunnattu maavalaistus (aurinko luoteesta): VINO gradientti pelkälle
  // maalle → mantereet saavat suurmuotoista tilavuutta (valo NW → varjo SE).
  // Muut kiillot ovat pystysuoria, joten tämä lisää eri akselin. Ei suodatinta,
  // yksi gradientti + maskattu rect (halpa). Lämmin valo, viileä varjo.
  const landLight = el('linearGradient', { id: 'land-light', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
  landLight.appendChild(el('stop', { offset: '0%', 'stop-color': '#fdf4d6', 'stop-opacity': 0.13 }));
  landLight.appendChild(el('stop', { offset: '42%', 'stop-color': '#fdf4d6', 'stop-opacity': 0 }));
  landLight.appendChild(el('stop', { offset: '60%', 'stop-color': '#02060c', 'stop-opacity': 0 }));
  landLight.appendChild(el('stop', { offset: '100%', 'stop-color': '#02060c', 'stop-opacity': 0.17 }));
  defs.appendChild(landLight);

  // --- Reunusviiste alueille (fake-3D ilman suodattimia): pystysuora
  // lineaarigradientti reunusvedoksi. Ylhäältä vaalea (kohovalo), keskeltä
  // läpinäkyvä, alhaalta tumma (varjo) → reunat lukevat kohotettuina.
  // objectBoundingBox (oletus) → viiste suhteessa kunkin alueen omaan laatikkoon. ---
  const bevel = el('linearGradient', { id: 'bevel-stroke', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  bevel.appendChild(el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': 0.25 }));
  bevel.appendChild(el('stop', { offset: '45%', 'stop-color': '#ffffff', 'stop-opacity': 0 }));
  bevel.appendChild(el('stop', { offset: '58%', 'stop-color': '#000000', 'stop-opacity': 0 }));
  bevel.appendChild(el('stop', { offset: '100%', 'stop-color': '#000000', 'stop-opacity': 0.28 }));
  defs.appendChild(bevel);

  // --- Hienovarainen kohina meren päälle (syvyys/tekstuuri). ---
  // STAATTINEN, rasteroidaan kerran. EI <animate>-elementtiä: jatkuva
  // turbulenssin animointi rasteroisi koko kerroksen joka framella = lagi.
  const noise = el('filter', { id: 'sea-noise', x: '0%', y: '0%', width: '100%', height: '100%' });
  noise.appendChild(el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012 0.018', numOctaves: 2, seed: 7, result: 'n' }));
  const noiseCm = el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0' });
  noise.appendChild(noiseCm);
  defs.appendChild(noise);

  // --- Maan RELIEF-materiaali: kohotettu maasto (vaaleat huiput + tummat
  // rotkot) yhdestä fraktaalikohinasta. STAATTINEN, rasteroidaan kerran.
  // Kytketään pois panoroinnin (#map.interacting) ja kevyt-tilan (body.lite)
  // aikana CSS:llä, jotta suodatin ei rasteroidu joka framella. Maskataan
  // maamassaan (#land-mask) → meri jää koskematta. Antaa alueille
  // materiaalintunnun litteän väripaperin sijaan.
  const relief = el('filter', { id: 'land-relief', x: '0%', y: '0%', width: '100%', height: '100%' });
  relief.appendChild(el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.055 0.08', numOctaves: 4, seed: 11, result: 'n' }));
  // Tummat rotkot: vain kohinan yläpää → harva tumma pilkutus.
  relief.appendChild(el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.85 -0.32', result: 'dark' }));
  // Vaaleat huiput: käänteinen alfa → hento valkoinen kohokuvio.
  relief.appendChild(el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -0.8 0.42', result: 'lite' }));
  const reliefMerge = el('feMerge');
  reliefMerge.appendChild(el('feMergeNode', { in: 'lite' }));
  reliefMerge.appendChild(el('feMergeNode', { in: 'dark' }));
  relief.appendChild(reliefMerge);
  defs.appendChild(relief);

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

  // --- Sumun paljastusreunan pehmennys: yksi blur sumumaskin muodoille, jotta
  // reuna sumusta valoon myötäilee rannikkoa pehmeästi (ei kova leikkaus).
  // Vain sumumoodissa (kerros piilossa muuten), gated panoroinnin ajaksi. ---
  const fogFeather = el('filter', { id: 'fog-feather', x: '-6%', y: '-6%', width: '112%', height: '112%' });
  fogFeather.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 6 }));
  defs.appendChild(fogFeather);

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
    // Emaloitu metallilaatta: tiukka spekulaari (ei koko yläosaa puhki
    // palanut) → kirkas → rikas keskisävy → tumma reunus.
    g.appendChild(el('stop', { offset: '0%', 'stop-color': mix(PLAYER_COLORS_LIGHT[i], '#ffffff', 0.35) }));
    g.appendChild(el('stop', { offset: '22%', 'stop-color': PLAYER_COLORS_LIGHT[i] }));
    g.appendChild(el('stop', { offset: '62%', 'stop-color': PLAYER_COLORS[i] }));
    g.appendChild(el('stop', { offset: '100%', 'stop-color': mix(PLAYER_COLORS_DARK[i], '#000000', 0.18) }));
    defs.appendChild(g);
  }
  // Neutraali (omistamaton) alue.
  const ng = el('radialGradient', { id: 'node-grad-neutral', cx: '36%', cy: '30%', r: '66%' });
  ng.appendChild(el('stop', { offset: '0%', 'stop-color': NEUTRAL_LIGHT }));
  ng.appendChild(el('stop', { offset: '60%', 'stop-color': NEUTRAL_MID }));
  ng.appendChild(el('stop', { offset: '100%', 'stop-color': NEUTRAL_DARK }));
  defs.appendChild(ng);

  // Sumun peittämä (fog of war) alue: verhottu, sumuinen orbi — ei paljasta
  // omistajaa. Viileä sumusävy, hieman läpikuultava (asetetaan updateMapissa)
  // → tuntematon "häämöttää" sumussa eikä ole kiinteä musta pallo.
  const fg = el('radialGradient', { id: 'node-grad-fog', cx: '38%', cy: '28%', r: '72%' });
  fg.appendChild(el('stop', { offset: '0%', 'stop-color': '#5b7590' }));   // sumuinen valoisa ydin
  fg.appendChild(el('stop', { offset: '35%', 'stop-color': '#41566c' }));
  fg.appendChild(el('stop', { offset: '68%', 'stop-color': '#25313f' }));
  fg.appendChild(el('stop', { offset: '100%', 'stop-color': '#111922' }));
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

  // --- Per-omistaja aluetäytön pystygradientit (#region-grad-i): vaalea ylä →
  // tumma ala. Säilyttää "kulhosyvyyden" mutta palauttaa kylläisyyden (ei
  // mutaa). objectBoundingBox (oletus), pystysuunta. Luodaan kerran. ---
  for (let i = 0; i < PLAYER_COLORS.length; i++) {
    const c = PLAYER_COLORS[i];
    const rg = el('linearGradient', { id: `region-grad-${i}`, x1: '0', y1: '0', x2: '0', y2: '1' });
    rg.appendChild(el('stop', { offset: '0%', 'stop-color': mix(c, '#eaf4ff', 0.18) }));
    rg.appendChild(el('stop', { offset: '55%', 'stop-color': mix(c, '#0a1c2e', 0.15) }));
    rg.appendChild(el('stop', { offset: '100%', 'stop-color': mix(c, '#0a1c2e', 0.42) }));
    defs.appendChild(rg);
  }
  // Neutraali (omistamaton): kylläisyyden sijaan neutraali harmaa, sama syvyys.
  const rgN = el('linearGradient', { id: 'region-grad-neutral', x1: '0', y1: '0', x2: '0', y2: '1' });
  rgN.appendChild(el('stop', { offset: '0%', 'stop-color': mix('#8a97a3', '#eaf4ff', 0.16) }));
  rgN.appendChild(el('stop', { offset: '55%', 'stop-color': mix('#8a97a3', '#0a1c2e', 0.30) }));
  rgN.appendChild(el('stop', { offset: '100%', 'stop-color': mix('#8a97a3', '#0a1c2e', 0.55) }));
  defs.appendChild(rgN);
  // Sumu: tumma liuske, ei paljasta omistajaa.
  const rgF = el('linearGradient', { id: 'region-grad-fog', x1: '0', y1: '0', x2: '0', y2: '1' });
  rgF.appendChild(el('stop', { offset: '0%', 'stop-color': '#1a2530' }));
  rgF.appendChild(el('stop', { offset: '100%', 'stop-color': '#0d151d' }));
  defs.appendChild(rgF);
  // Lumimyrsky: kirkas jää — kylmä sinivalkoinen huippu → syvä jäätikkösini
  // pohja. Kylläisempi ja kylmempi kuin ennen (ei litteä harmaa) → lukee jäänä.
  const rgB = el('linearGradient', { id: 'region-grad-blizzard', x1: '0', y1: '0', x2: '0', y2: '1' });
  rgB.appendChild(el('stop', { offset: '0%', 'stop-color': mix('#c7e8f7', '#ffffff', 0.28) }));
  rgB.appendChild(el('stop', { offset: '52%', 'stop-color': '#8ec6e4' }));
  rgB.appendChild(el('stop', { offset: '100%', 'stop-color': mix('#3f7ba0', '#16303f', 0.28) }));
  defs.appendChild(rgB);

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
    // Monimittakaavainen rannikko: karkea aalto (niemet/lahdet, muuttuu ~4
    // pisteen välein) + hieno rosoisuus → uskottava rosoinen rannikko.
    const j = seededNoise(seed, i) * amp * 0.5                    // hieno detalji
            + seededNoise(seed + 91, Math.floor(i / 4)) * amp * 1.15; // karkeat niemet/lahdet
    const j2 = seededNoise(seed + 57, i) * amp * 0.3;            // kevyt tangentiaalinen huojunta
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
// Käsin piirretyt AIDOT rannikot (avain `${mapId}:${contId}`). Kun ääriviiva on
// annettu, se korvaa säde­pyyhkäisyn siluetin → tunnistettava mannermuoto. Solut
// tessellöidään konveksilla työpolygonilla ja LEIKATAAN tähän ääriviivaan, joten
// syvät lahdet eivät riko Voronoi-clippausta. PROTOTYYPPI: vain Etelä-Amerikka.
const REAL_OUTLINES = {
  'classic:north-america': [
    [48, 100], [70, 72], [120, 60], [175, 66], [240, 52], [300, 45], [345, 55],
    [352, 96], [325, 122], [300, 130], [315, 165], [300, 210], [268, 250],
    [240, 276], [210, 300], [195, 326], [178, 346], [160, 320], [150, 285],
    [135, 240], [120, 190], [110, 145], [90, 114],
  ],
  'classic:south-america': [
    [230, 372], [262, 366], [298, 375], [332, 398], [360, 442], [373, 485],
    [356, 528], [322, 562], [302, 592], [283, 626], [272, 648], [258, 618],
    [240, 572], [224, 520], [216, 468], [220, 424], [226, 392],
  ],
  'classic:europe': [
    [420, 95], [455, 78], [505, 72], [540, 82], [560, 115], [635, 128],
    [646, 160], [615, 192], [575, 235], [560, 268], [525, 262], [490, 282],
    [455, 276], [430, 240], [418, 195], [408, 150], [415, 115],
  ],
  'classic:africa': [
    [480, 385], [520, 366], [575, 360], [602, 378], [626, 420], [640, 456],
    [666, 530], [660, 562], [635, 560], [612, 546], [590, 582], [560, 602],
    [535, 576], [520, 520], [505, 470], [478, 424], [468, 400],
  ],
  'classic:asia': [
    [672, 250], [690, 195], [698, 150], [740, 112], [800, 85], [858, 68],
    [908, 78], [952, 108], [945, 155], [952, 212], [922, 240], [872, 250],
    [858, 295], [862, 332], [838, 352], [800, 340], [762, 352], [738, 335],
    [722, 300], [700, 322], [672, 315], [662, 285],
  ],
  'classic:australia': [
    [840, 435], [880, 428], [935, 445], [965, 458], [970, 520], [965, 575],
    [950, 605], [910, 600], [870, 585], [850, 555], [858, 500], [845, 465],
  ],

  // --- Suuri maailma (maailmankartta, 50 aluetta) ---
  'suurmaailma:pohjois-amerikka': [
    [58, 96], [82, 66], [130, 56], [180, 52], [248, 44], [305, 42], [350, 52],
    [356, 92], [332, 116], [315, 128], [330, 150], [312, 205], [280, 250],
    [250, 272], [212, 300], [195, 335], [178, 358], [160, 330], [148, 285],
    [135, 240], [120, 185], [108, 140], [92, 110],
  ],
  'suurmaailma:etela-amerikka': [
    [228, 415], [262, 405], [300, 412], [340, 438], [362, 485], [372, 522],
    [356, 566], [326, 600], [305, 628], [288, 660], [278, 682], [262, 652],
    [244, 606], [222, 552], [195, 500], [186, 465], [196, 430], [210, 418],
  ],
  'suurmaailma:eurooppa': [
    [395, 82], [435, 66], [490, 62], [525, 72], [548, 108], [625, 158],
    [632, 192], [600, 225], [565, 270], [548, 292], [512, 282], [478, 298],
    [440, 290], [412, 255], [398, 205], [388, 150], [392, 108],
  ],
  'suurmaailma:pohjois-aasia': [
    [655, 165], [675, 120], [720, 80], [790, 62], [860, 60], [915, 70],
    [965, 105], [958, 150], [905, 168], [850, 175], [800, 178], [740, 175],
    [695, 178], [665, 168],
  ],
  'suurmaailma:ita-aasia': [
    [790, 250], [820, 205], [860, 200], [900, 195], [945, 192], [978, 215],
    [970, 270], [945, 320], [955, 360], [930, 395], [895, 375], [860, 340],
    [820, 325], [790, 290],
  ],
  'suurmaailma:etela-aasia': [
    [660, 208], [715, 206], [765, 232], [810, 285], [848, 335], [848, 398],
    [822, 448], [790, 438], [765, 400], [748, 420], [725, 392], [700, 415],
    [675, 405], [630, 432], [600, 425], [598, 395], [610, 360], [628, 335],
    [622, 308], [648, 285], [655, 240],
  ],
  'suurmaailma:afrikka': [
    [495, 352], [540, 342], [588, 348], [610, 375], [600, 420], [625, 455],
    [650, 500], [678, 555], [672, 590], [648, 588], [625, 570], [600, 600],
    [572, 632], [548, 608], [535, 555], [512, 495], [492, 440], [485, 395],
  ],
  'suurmaailma:oseania': [
    [820, 470], [860, 462], [920, 460], [958, 472], [970, 520], [962, 560],
    [975, 600], [960, 635], [920, 648], [905, 685], [882, 672], [870, 620],
    [845, 600], [832, 555], [840, 510], [828, 485],
  ],
};

function continentOutline(contId, seed, pad = 50) {
  const ids = continentTerritories(contId);
  const points = ids.map((i) => ({ x: TERRITORIES[i].x, y: TERRITORIES[i].y }));
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  const real = REAL_OUTLINES[`${activeMap()?.id}:${contId}`];
  if (real && real.length >= 3) {
    const pts = densifyAndJitter(real.map(([x, y]) => ({ x, y })), seed * 13 + 3, 30, 4);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const q = 34; // konveksi työpolygoni (padattu bbox) tessellointia varten
    const workPts = [{ x: minX - q, y: minY - q }, { x: maxX + q, y: minY - q }, { x: maxX + q, y: maxY + q }, { x: minX - q, y: maxY + q }];
    const ox = pts.reduce((s, p) => s + p.x, 0) / pts.length, oy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { pts, workPts, cx: ox, cy: oy, real: true };
  }

  let base;
  if (points.length < 3) {
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
    // Kulmapyyhkäisy: ääriviiva MYÖTÄILEE alueita tiukasti → mantereen todellinen
    // muoto (niemekkeet, kannakset, lahdet) tulee esiin. Alueet ovat
    // maantieteellisesti aseteltuja, joten tiukka myötäily = tunnistettava manner.
    // - Rannikkoalueiden VÄLI: lineaari-interpolaatio (suora rannikko, ei
    //   valelahtia vierekkäisten alueiden väliin).
    // - AITO lahti vain isoon tyhjään sektoriin (iso kulmaväli = rannikko
    //   vetäytyy), syvyys kasvaa raon mukaan (sini-profiili).
    // Säde on radiaalinen keskipisteestä → polygoni pysyy yksinkertaisena
    // (ei pinch-pisteitä) → Voronoi-solut eivät riko vaikka konkaavius on syvä.
    const N = 60;
    const rad = new Array(N).fill(-1);
    const binOf = (a) => ((Math.round(((a + Math.PI) / (Math.PI * 2)) * N)) % N + N) % N;
    for (const p of points) {
      const a = Math.atan2(p.y - cy, p.x - cx);
      const d = Math.hypot(p.x - cx, p.y - cy);
      const bi = binOf(a);
      if (d > rad[bi]) rad[bi] = d;
      // Yksittäinen alue = pyöreä niemi, ei neula: levennä hieman viereisiin.
      const b1 = (bi + 1) % N, b2 = (bi - 1 + N) % N;
      rad[b1] = Math.max(rad[b1], d * 0.95);
      rad[b2] = Math.max(rad[b2], d * 0.95);
    }
    // MAASILLAT: mannerparit jotka ovat MAAYHTEYDESSÄ (kartan landBridges-data,
    // esim. Euraasia, Panama, Siinai) → ulota rannikko naapurialuetta kohti
    // (56 % → pieni limitys) niin että mantereet KOSKETTAVAT, ei merisaukkoa.
    // Merirajat (Atlantti, Välimeri, saaristot) EIVÄT ole listalla → jäävät auki.
    const landSet = new Set(activeMap()?.landBridges || []);
    if (landSet.size) {
      for (const id of ids) {
        const pt = TERRITORIES[id];
        for (const n of (pt.adj || [])) {
          const nb = TERRITORIES[n];
          if (!nb || nb.continent === contId) continue;
          const key = [contId, nb.continent].sort().join('|');
          if (!landSet.has(key)) continue; // vain aidot maayhteydet
          const mx = pt.x + (nb.x - pt.x) * 0.56, my = pt.y + (nb.y - pt.y) * 0.56;
          const a = Math.atan2(my - cy, mx - cx);
          const d = Math.hypot(mx - cx, my - cy);
          const bi = binOf(a);
          rad[bi] = Math.max(rad[bi], d);
          rad[(bi + 1) % N] = Math.max(rad[(bi + 1) % N], d * 0.96);
          rad[(bi - 1 + N) % N] = Math.max(rad[(bi - 1 + N) % N], d * 0.96);
        }
      }
    }
    const filledCount = rad.filter((v) => v >= 0).length;
    if (filledCount >= 2) {
      for (let k = 0; k < N; k++) {
        if (rad[k] >= 0) continue;
        let ld = 0, rd = 0, left = -1, right = -1;
        for (let s = 1; s <= N; s++) { const i = (k - s + N) % N; if (rad[i] >= 0) { left = rad[i]; ld = s; break; } }
        for (let s = 1; s <= N; s++) { const i = (k + s) % N; if (rad[i] >= 0) { right = rad[i]; rd = s; break; } }
        if (left < 0 || right < 0) continue;
        const gap = ld + rd;                       // tyhjän sektorin leveys (bineinä)
        const interp = left + (right - left) * (ld / gap); // lineaari rannikko
        // Lahtisyvyys: iso rako → syvempi sisennys keskellä (sini 0→1→0).
        const mid = Math.sin(Math.PI * (ld / gap));
        const bay = 1 - Math.min(0.55, (gap / N) * 1.9) * mid;
        rad[k] = interp * bay;
      }
    }
    const filled2 = rad.filter((v) => v >= 0);
    const avg = filled2.length ? filled2.reduce((s, v) => s + v, 0) / filled2.length : 60;
    const coastPad = 22;
    base = [];
    for (let k = 0; k < N; k++) {
      const r = (rad[k] >= 0 ? rad[k] : avg) + coastPad;
      const ang = (Math.PI * 2 * k) / N - Math.PI;
      base.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
  }
  return { pts: densifyAndJitter(base, seed * 13 + 3, 40, 8), workPts: null, cx, cy, real: false };
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

/** Kartan neljä kulmaa lajiteltuna tyhjyyden mukaan (tyhjin ensin). */
function cornerClearances() {
  const corners = [
    { x: 78, y: 92 }, { x: 922, y: 92 }, { x: 78, y: 608 }, { x: 922, y: 608 },
  ];
  return corners
    .map((c) => ({ ...c, d: minDistToTerritories(c.x, c.y) }))
    .sort((a, b) => b.d - a.d);
}

/** Proseduraalinen ORNAMENTTINEN kompassiruusu annettuun (tyhjimpään) kulmaan.
 * 8-sakarainen tähti, sisäkkäiset renkaat, ilmansuunnat N/E/S/W ja muutama
 * himmeä rhumb-viiva. Kaikki staattista, matalaopasiteettista mustetta. */
function buildCompassRose(corner) {
  const { x, y } = corner;
  const ink = '#9fc4e8';
  const g = el('g', { 'class': 'sea-deco compass-rose', 'pointer-events': 'none' });
  // Sisäkkäiset renkaat.
  g.appendChild(el('circle', { cx: x, cy: y, r: 30, fill: 'none', stroke: ink, 'stroke-opacity': 0.12, 'stroke-width': 0.75 }));
  g.appendChild(el('circle', { cx: x, cy: y, r: 26, fill: 'none', stroke: ink, 'stroke-opacity': 0.22, 'stroke-width': 1 }));
  g.appendChild(el('circle', { cx: x, cy: y, r: 21, fill: 'none', stroke: ink, 'stroke-opacity': 0.1, 'stroke-width': 0.75 }));
  g.appendChild(el('circle', { cx: x, cy: y, r: 12, fill: 'none', stroke: ink, 'stroke-opacity': 0.14, 'stroke-width': 0.75 }));
  // Himmeät rhumb-viivat (purjehduskartan säteet) diagonaaleihin, lyhyet.
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + (Math.PI / 2) * k;
    const c = Math.cos(ang), s = Math.sin(ang);
    g.appendChild(el('line', {
      x1: (x + c * 30).toFixed(1), y1: (y + s * 30).toFixed(1),
      x2: (x + c * 88).toFixed(1), y2: (y + s * 88).toFixed(1),
      stroke: ink, 'stroke-opacity': 0.07, 'stroke-width': 0.75,
    }));
  }
  // Diagonaalitähti (lyhyet sakarat) alle, pääilmansuunnat (pitkät) päälle.
  g.appendChild(el('path', { d: starPath(x, y, 12, 3.5, -Math.PI / 4), fill: ink, 'fill-opacity': 0.12, stroke: ink, 'stroke-opacity': 0.18, 'stroke-width': 0.75 }));
  g.appendChild(el('path', { d: starPath(x, y, 22, 4.5, -Math.PI / 2), fill: ink, 'fill-opacity': 0.18, stroke: ink, 'stroke-opacity': 0.32, 'stroke-width': 1 }));
  g.appendChild(el('circle', { cx: x, cy: y, r: 2, fill: ink, 'fill-opacity': 0.4 }));
  // Ilmansuunnat N/E/S/W.
  const letter = (ch, lx, ly, big) => {
    const t = el('text', {
      x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': big ? 11 : 9, 'font-weight': 700, fill: ink,
      'fill-opacity': big ? 0.45 : 0.32, 'letter-spacing': 0.5,
    });
    t.textContent = ch;
    g.appendChild(t);
  };
  letter('N', x, y - 34, true);
  letter('S', x, y + 34, false);
  letter('E', x + 34, y, false);
  letter('W', x - 34, y, false);
  return g;
}

/** Pieni pseudo-satunnainen "saareke"-blob-polku (8 kärkeä, seedattu). */
function islandBlob(cx, cy, r, seed) {
  const n = 8;
  let d = '';
  for (let k = 0; k < n; k++) {
    const ang = (Math.PI * 2 * k) / n;
    const rr = r * (0.72 + (seededNoise(seed, k) + 1) * 0.19);
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
    d += `${k === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + 'Z';
}

/** Sirottele 2–3 pientä tyyliteltyä saarta avomerelle (kauas alueista). */
function buildSeaIslands() {
  const g = el('g', { 'class': 'sea-deco sea-islands', 'pointer-events': 'none' });
  const spots = [];
  for (let x = 110; x <= 890; x += 90) {
    for (let y = 100; y <= 600; y += 90) {
      const d = minDistToTerritories(x, y);
      if (d > 135) spots.push({ x, y, d });
    }
  }
  spots.sort((a, b) => b.d - a.d);
  const chosen = [];
  for (const s of spots) {
    if (chosen.length >= 3) break;
    if (chosen.every((c) => Math.hypot(c.x - s.x, c.y - s.y) > 170)) chosen.push(s);
  }
  chosen.forEach((s, i) => {
    const ox = seededNoise(31, i) * 14, oy = seededNoise(43, i) * 10;
    const cx = s.x + ox, cy = s.y + oy;
    g.appendChild(el('path', {
      d: islandBlob(cx, cy, 9 + (i % 2) * 3, i * 7 + 1),
      fill: '#25506e', 'fill-opacity': 0.22, stroke: '#3a6d8e', 'stroke-opacity': 0.25,
      'stroke-width': 1, 'stroke-linejoin': 'round',
    }));
    g.appendChild(el('path', {
      d: islandBlob(cx, cy, 4, i * 7 + 3), fill: '#2f5f7e', 'fill-opacity': 0.18,
    }));
  });
  return g;
}

/** Kompakti mannerlegenda (väriläikkä + bonus) tyhjään kulmaan; ohitetaan
 * siististi jos yksikään kulma ei ole tarpeeksi vapaa (tiheät kartat). */
function buildContinentLegend(corners) {
  const conts = Object.values(CONTINENTS);
  if (!conts.length) return null;
  const rowH = 15, padB = 8, sw = 11;
  const boxW = 52, boxH = conts.length * rowH + padB * 2 - 4;
  for (let ci = 1; ci < corners.length; ci++) {
    const c = corners[ci];
    const bx = c.x < 500 ? 22 : 1000 - 22 - boxW;
    const by = c.y < 350 ? 22 : 700 - 22 - boxH;
    let clear = true;
    for (const id of TERRITORY_IDS) {
      const p = TERRITORIES[id];
      const qx = Math.max(bx, Math.min(p.x, bx + boxW));
      const qy = Math.max(by, Math.min(p.y, by + boxH));
      if (Math.hypot(p.x - qx, p.y - qy) < NODE_R + 10) { clear = false; break; }
    }
    if (!clear) continue;
    const g = el('g', { 'class': 'sea-deco cont-legend', 'pointer-events': 'none' });
    g.appendChild(el('rect', {
      x: bx, y: by, width: boxW, height: boxH, rx: 5, ry: 5,
      fill: '#04101c', 'fill-opacity': 0.4, stroke: '#9fc4e8', 'stroke-opacity': 0.18, 'stroke-width': 1,
    }));
    conts.forEach((cont, i) => {
      const ry = by + padB + i * rowH;
      g.appendChild(el('rect', {
        x: bx + 8, y: ry, width: sw, height: sw, rx: 2, ry: 2,
        fill: cont.color, 'fill-opacity': 0.78, stroke: '#02090f', 'stroke-opacity': 0.4, 'stroke-width': 0.75,
      }));
      const tx = el('text', {
        x: bx + 8 + sw + 6, y: ry + sw - 1.5, 'font-size': 10, 'font-weight': 700,
        fill: '#cfe0f0', 'fill-opacity': 0.72,
      });
      tx.textContent = `+${cont.bonus}`;
      g.appendChild(tx);
    });
    return g;
  }
  return null;
}

/**
 * Värisokeusvihjeen "pip"-merkki: pieni kiinteä muoto keskipisteessä (cx,cy)
 * säteellä r. Muoto valitaan pelaajaindeksin mukaan (PIP_SHAPES). Palauttaa
 * pelkän polkudatan (SVG 'd'), joka asetetaan attribuuttina updateMapissa –
 * ei uusia elementtejä, ei suodattimia.
 */
function pipPath(shape, cx, cy, r) {
  const f = (v) => v.toFixed(2);
  const poly = (angs, rad) => {
    let d = '';
    angs.forEach((a, k) => {
      d += `${k === 0 ? 'M' : 'L'} ${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)} `;
    });
    return d + 'Z';
  };
  const reg = (n, rot) => {
    const a = [];
    for (let k = 0; k < n; k++) a.push(rot + (Math.PI * 2 * k) / n);
    return poly(a, r);
  };
  switch (shape) {
    case 'square': {
      const s = r * 0.9;
      return `M ${f(cx - s)} ${f(cy - s)} L ${f(cx + s)} ${f(cy - s)} L ${f(cx + s)} ${f(cy + s)} L ${f(cx - s)} ${f(cy + s)} Z`;
    }
    case 'triangle': return reg(3, -Math.PI / 2);
    case 'diamond': return reg(4, -Math.PI / 2);
    case 'pentagon': return reg(5, -Math.PI / 2);
    case 'star': {
      let d = '';
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (Math.PI * k) / 5;
        const rad = k % 2 === 0 ? r * 1.1 : r * 0.48;
        d += `${k === 0 ? 'M' : 'L'} ${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)} `;
      }
      return d + 'Z';
    }
    case 'circle':
    default:
      return `M ${f(cx - r)} ${f(cy)} a ${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0 Z`;
  }
}

/** Rakentaa staattisen kartan kerran (mantereet + viivat + napit). */
export function buildMap(svg, onTap) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', '0 0 1000 700');

  const warmth = mapWarmth();
  svg.appendChild(buildDefs(warmth));

  // Bleed-meri: ulottuu reilusti viewBoxin yli, jotta pystyruudun letterbox-
  // kaistaleet (SVG:n meet-sovitus) täyttyvät syvällä merellä eikä litteää
  // taustaseinää näy. Ei transformoidu (svg:n lapsi, ei #g-map) → pysyy
  // ruudulla paikallaan. Yksi rect = halpa.
  svg.appendChild(el('rect', { x: -800, y: -900, width: 2600, height: 2500, fill: mix('#06121f', warmth > 0 ? '#0a1512' : '#050f1b', Math.abs(warmth) * 0.5), 'pointer-events': 'none' }));
  // Meri – kerroksittain: pohjagradientti, syvyyshehku, kohina, sävy, ruudukko, vinjetti.
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea)' }));
  // Syvyyshehku nostaa laudan tummasta taustasta.
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea-glow)', opacity: 0.5, 'pointer-events': 'none' }));
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, filter: 'url(#sea-noise)', opacity: 0.5, 'pointer-events': 'none' }));
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#sea-sheen)', 'pointer-events': 'none' }));
  // Koko laudan valaistuskiilto (meren päällä, maan alla).
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: 'url(#board-sheen)', 'pointer-events': 'none' }));

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

  // Kulmakoristeet (kulmahaat + pieni filigraani) – atlaksen neatline-tuntu.
  // Staattinen ryhmä suoraan svg:hen (ei panoroidu kartan mukana).
  const orn = el('g', { 'class': 'neatline-orn', 'pointer-events': 'none' });
  const brLen = 26;
  const corner = (x, y, sx, sy) => {
    orn.appendChild(el('path', {
      d: `M ${x} ${(y + sy * brLen).toFixed(1)} L ${x} ${y} L ${(x + sx * brLen).toFixed(1)} ${y}`,
      fill: 'none', stroke: frameCol, 'stroke-opacity': 0.5, 'stroke-width': 2, 'stroke-linecap': 'round',
    }));
    orn.appendChild(el('path', {
      d: `M ${(x + sx * 6).toFixed(1)} ${(y + sy * 6).toFixed(1)} l ${(sx * 8).toFixed(1)} ${(sy * 8).toFixed(1)}`,
      fill: 'none', stroke: frameCol, 'stroke-opacity': 0.28, 'stroke-width': 1.2, 'stroke-linecap': 'round',
    }));
    orn.appendChild(el('circle', { cx: (x + sx * 6).toFixed(1), cy: (y + sy * 6).toFixed(1), r: 1.6, fill: frameCol, 'fill-opacity': 0.4 }));
  };
  corner(22, 22, 1, 1); corner(978, 22, -1, 1); corner(22, 678, 1, -1); corner(978, 678, -1, -1);
  svg.appendChild(orn);

  const gMap = el('g', { id: 'g-map' });
  svg.appendChild(gMap);

  // Staattiset merikoristeet: aaltoglyyfit avomerellä + kompassiruusu
  // tyhjimmässä kulmassa. Molemmat matalan opasiteetin viivapiirroksia,
  // ei suodattimia, ei animaatioita.
  const corners = cornerClearances();
  gMap.appendChild(buildWaveGlyphs());
  gMap.appendChild(buildSeaIslands());
  gMap.appendChild(buildCompassRose(corners[0]));
  const legend = buildContinentLegend(corners);
  if (legend) gMap.appendChild(legend);

  // Mantereet maamassan muotoisina: rosoitettu orgaaninen "rantaviiva"
  // (tihennetty + seedattu jitter, pelkkää polkudataa), mannerjalusta
  // matalana vetenä alla. Maamassa TÄYTETÄÄN alueittain Voronoi-soluilla
  // (#g-regions) kuten oikeassa pelilaudassa: solut lasketaan KERRAN tässä
  // puolitasoleikkauksella samasta rosoisesta ääriviivasta, joten solujen
  // ulkoreuna ja rantaviiva osuvat täsmälleen yhteen. Ei uusia suodattimia.
  const gCont = el('g', { id: 'g-continents' });          // jalusta + vaahto
  const gPlinth = el('g', { id: 'g-plinth', 'pointer-events': 'none' }); // kohotettu laatta (fake-3D)
  const gRegions = el('g', { id: 'g-regions' });          // aluesolut (klikattavat)
  const gBevel = el('g', { id: 'g-bevel', 'pointer-events': 'none' }); // reunusviiste (fake-3D)
  const gCoast = el('g', { id: 'g-coasts', 'pointer-events': 'none' }); // rantaviiva + kartussit
  const gRidges = el('g', { id: 'g-ridges', 'pointer-events': 'none' }); // vuoristoharjanteet

  // Relief-maski: valkoiset mannerkopiot mustalla pohjalla → relief-tekstuuri
  // rajautuu tarkasti maamassaan (mereen ei kosketa). Täytetään loopissa.
  const landMask = el('mask', { id: 'land-mask', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1000, height: 700 });
  landMask.appendChild(el('rect', { x: 0, y: 0, width: 1000, height: 700, fill: '#000' }));
  // Säiliö aitojen rannikoiden clip-poluille (lisätään gMap:iin loopin jälkeen).
  const gClips = el('g', { 'pointer-events': 'none' });

  const regionEls = {};
  // Sijoitettujen mannerlabelien suorakaiteet → uudet labelit väistävät myös
  // toisiaan, eivät vain nappeja.
  const placedLabels = [];
  const contIds = Object.keys(CONTINENTS);
  contIds.forEach((contId, ci) => {
    const b = continentBounds(contId);
    const color = CONTINENTS[contId].color;
    const { pts, workPts, cx, cy, real } = continentOutline(contId, ci);
    const path = closedPolyPath(pts);
    const shelfPath = closedPolyPath(offsetRadial(pts, cx, cy, 10));
    // AITO rannikko: leikkaa alueet ääriviivaan (clip-path). Solut lasketaan
    // konveksilla työpolygonilla → näkyvä täyttö myötäilee todellista rannikkoa.
    let regionClip = null;
    if (real) {
      const clip = el('clipPath', { id: `cont-clip-${ci}`, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(el('path', { d: path }));
      gClips.appendChild(clip);
      regionClip = `url(#cont-clip-${ci})`;
    }

    // Relief-maskiin valkoinen mannerkopio (näyttää tekstuurin vain maalla).
    landMask.appendChild(el('path', { d: path, fill: '#fff' }));

    // Mannerjalustan EKSTRUUSIO (fake-3D): sama ääriviiva siirrettynä alas
    // (7 px tumma "seinä" + 4 px keskisävy) → maamassa kohoaa laattana merestä.
    // Piirretään alueiden ALLE; vain alareunan kaari jää näkyviin niiden takaa.
    gPlinth.appendChild(el('path', {
      d: closedPolyPath(pts.map((p) => ({ x: p.x, y: p.y + 7 }))),
      'class': 'cont-plinth', 'pointer-events': 'none', fill: mix(color, '#05101c', 0.7),
    }));
    gPlinth.appendChild(el('path', {
      d: closedPolyPath(pts.map((p) => ({ x: p.x, y: p.y + 4 }))),
      'class': 'cont-plinth', 'pointer-events': 'none', fill: mix(color, '#05101c', 0.5),
    }));

    // Syvän veden varjo: maamassa heittää varjon ympäröivään mereen → manner
    // lukee KOHOTETTUNA laattana. Leveät tummat vedot polusta, KAIKKEIN
    // ALIMMAISENA (leveä+haalea pohjalla, kapea+tumma rannan lähellä päällä).
    // Aluetäyttö peittää sisäpuoliskon → varjo näkyy vain vedessä. Ei suodatinta.
    const shadow = el('g', { 'class': 'cont-depth', 'pointer-events': 'none' });
    shadow.appendChild(el('path', { d: path, fill: 'none', stroke: '#020a13', 'stroke-opacity': 0.24, 'stroke-width': 30, 'stroke-linejoin': 'round' }));
    shadow.appendChild(el('path', { d: path, fill: 'none', stroke: '#03101d', 'stroke-opacity': 0.32, 'stroke-width': 20, 'stroke-linejoin': 'round' }));
    shadow.appendChild(el('path', { d: path, fill: 'none', stroke: '#04121f', 'stroke-opacity': 0.42, 'stroke-width': 12, 'stroke-linejoin': 'round' }));
    gCont.appendChild(shadow);

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
    const { cells, pairs } = continentCells(ids, workPts || pts);
    for (const tid of ids) {
      const regionAttrs = {
        d: closedPolyPath(cells[tid]), 'class': 'region', 'data-id': tid,
        fill: 'url(#region-grad-neutral)', 'fill-opacity': 0.95,
        stroke: '#0c1826', 'stroke-width': 1.6, 'stroke-linejoin': 'round',
      };
      if (regionClip) regionAttrs['clip-path'] = regionClip; // leikkaa aitoon rannikkoon
      const region = el('path', regionAttrs);
      region.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); onTap(tid); });
      gRegions.appendChild(region);
      regionEls[tid] = region;

      // Reunusviiste (fake-3D): sama alue ylimääräisenä gradienttiviivana
      // (ylhäältä vaalea, alhaalta tumma) → raja lukee kohotettuna reunana.
      // pointer-events:none → napautukset menevät alla olevaan regioniin.
      const bevelAttrs = {
        d: closedPolyPath(cells[tid]), 'class': 'region-bevel', 'pointer-events': 'none',
        fill: 'none', stroke: 'url(#bevel-stroke)', 'stroke-width': 1.5, 'stroke-linejoin': 'round',
      };
      if (regionClip) bevelAttrs['clip-path'] = regionClip;
      gBevel.appendChild(el('path', bevelAttrs));
    }

    // Rantaviiva alueiden PÄÄLLE mantereen värillä: ulkoreuna pysyy terävänä.
    gCoast.appendChild(el('path', {
      d: path, 'class': 'coastline', fill: 'none', stroke: color,
      'stroke-opacity': 0.85, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
    }));

    // Merisalmet: saman mantereen Voronoi-naapurit jotka EIVÄT ole pelinaapureita
    // erotetaan VEDELLÄ (ei vuorella): jaetun rajan päälle kaiverretaan kapea salmi
    // (syvä vesi + rantavaahto molemmin puolin) → alueet lukevat ERILLISINÄ
    // rannikkoina, eivät yhtenä maamassana. Selkein "ei yhteyttä" -signaali.
    for (const key of pairs) {
      const [i, j] = key.split('|');
      if (TERRITORIES[i].adj.includes(j)) continue;
      const seg = sharedBorder(cells[i], TERRITORIES[i], TERRITORIES[j]);
      if (!seg) continue;
      const a = seg.a, b = seg.b;
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
      if (L < 12) continue; // liian lyhyt salmeksi
      const ux = dx / L, uy = dy / L, px = -uy, py = ux;
      const ext = 3; // jatka hieman rannikkoon asti, ettei jää maakannasta päihin
      const a2 = { x: a.x - ux * ext, y: a.y - uy * ext }, b2 = { x: b.x + ux * ext, y: b.y + uy * ext };
      const line = (o) => `M ${(a2.x + px * o).toFixed(1)} ${(a2.y + py * o).toFixed(1)} L ${(b2.x + px * o).toFixed(1)} ${(b2.y + py * o).toFixed(1)}`;
      // Syvä vesi (leveä tumma) + salmen vesi (kapeampi hieman vaaleampi).
      gRidges.appendChild(el('path', { d: line(0), 'class': 'strait-deep', fill: 'none', stroke: '#040d16', 'stroke-opacity': 0.95, 'stroke-width': 11, 'stroke-linecap': 'round' }));
      gRidges.appendChild(el('path', { d: line(0), 'class': 'strait', fill: 'none', stroke: '#0a1a28', 'stroke-opacity': 0.95, 'stroke-width': 7, 'stroke-linecap': 'round' }));
      // Rantavaahto molemmin puolin → kaksi selvää rannikkoa.
      gRidges.appendChild(el('path', { d: line(4.2), 'class': 'strait-foam', fill: 'none', stroke: '#bfe6ef', 'stroke-opacity': 0.32, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
      gRidges.appendChild(el('path', { d: line(-4.2), 'class': 'strait-foam', fill: 'none', stroke: '#bfe6ef', 'stroke-opacity': 0.32, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
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
    // Pidä labelit neatline-kehyksen (x 16, y 16) sisällä → ei leikkaudu reunaan.
    const clampX = (v) => Math.max(18, Math.min(v, 1000 - lblW - 18));
    const clampY = (v) => Math.max(20, Math.min(v, 700 - lblH - 20));
    const cx0 = b.x + b.w / 2;
    // Ehdokaspaikat + prioriteettisakko: ensisijaisesti mereen mantereen ala-/
    // yläpuolelle (siellä ei nappeja); reunat/nappien lähelle vain jos parempaa
    // ei ole. `pri` painottaa: mereen-sijoittelu voittaa reunaan takertumisen.
    const cand = (x, y, pri) => {
      const px = x - lblW / 2, py = y;
      const cxx = clampX(px), cyy = clampY(py);
      // Lisäsakko jos klampatus siirsi labelia paljon (takertui kehykseen).
      const clampPen = (Math.abs(cxx - px) + Math.abs(cyy - py)) * 0.05;
      return { x: cxx, y: cyy, pri: pri + clampPen };
    };
    const candidates = [
      cand(cx0, b.y - lblH - 6, 0),                 // mereen yläpuolelle
      cand(cx0, b.y + b.h + 6, 0),                  // mereen alapuolelle
      cand(topT.x, topT.y - NODE_R - 16 - lblH, 1), // ylimmän napin yli
      cand(botT.x, botT.y + NODE_R + 18, 1),        // alimman napin ali
      cand(cx0, b.y + 4, 2),                        // bounds-yläreuna
      cand(b.x - lblW / 2 - 2, b.y + b.h / 2, 1),   // vasen reuna
      cand(b.x + b.w + lblW / 2 + 2, b.y + b.h / 2, 1), // oikea reuna
    ];
    // Sakko: nappipäällekkäisyys painava, label–label-päällekkäisyys erittäin
    // painava, + pieni etäisyyssakko mantereen keskeltä (pidä lähellä).
    const nodeHits = (c) => {
      let n = 0;
      for (const tid of TERRITORY_IDS) {
        const p = TERRITORIES[tid];
        const qx = Math.max(c.x, Math.min(p.x, c.x + lblW));
        const qy = Math.max(c.y, Math.min(p.y, c.y + lblH));
        if (Math.hypot(p.x - qx, p.y - qy) < NODE_R + 12) n++;
      }
      return n;
    };
    const labelHits = (c) => {
      let n = 0;
      for (const r of placedLabels) {
        if (c.x < r.x + r.w + 4 && c.x + lblW + 4 > r.x &&
            c.y < r.y + r.h + 3 && c.y + lblH + 3 > r.y) n++;
      }
      return n;
    };
    const score = (c) => nodeHits(c) * 10 + labelHits(c) * 100 + c.pri +
      Math.hypot(c.x + lblW / 2 - cx0, c.y + lblH / 2 - (b.y + b.h / 2)) * 0.008;
    let bestPos = candidates[0], bestS = score(candidates[0]);
    for (let k = 1; k < candidates.length; k++) {
      const s = score(candidates[k]);
      if (s < bestS) { bestS = s; bestPos = candidates[k]; }
    }
    const lx = bestPos.x, ly = bestPos.y;
    placedLabels.push({ x: lx, y: ly, w: lblW, h: lblH });
    labelG.appendChild(el('rect', {
      x: lx, y: ly, width: lblW, height: lblH, rx: 10.5, ry: 10.5,
      // Läpinäkymättömämpi pilleri (0.82) → nimi pysyy luettavana myös tiheillä
      // kartoilla (esim. Eurooppa 2025), joissa labelin on pakko osua napin päälle.
      fill: '#04101c', 'fill-opacity': 0.82, stroke: color, 'stroke-opacity': 0.7, 'stroke-width': 1,
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
  gMap.appendChild(gPlinth);
  gMap.appendChild(gRegions);
  // Relief-tekstuuri alueiden PÄÄLLE mutta viisteen/rantaviivan ALLE, jotta
  // reunat pysyvät terävinä. Yksi maskattu+suodatettu rect = halpa (kytketään
  // pois panoroinnin ja lite-tilan ajaksi CSS:llä).
  gMap.appendChild(landMask);
  gMap.appendChild(gClips);
  gMap.appendChild(el('rect', {
    x: 0, y: 0, width: 1000, height: 700, 'class': 'land-relief',
    filter: 'url(#land-relief)', mask: 'url(#land-mask)', opacity: 0.5, 'pointer-events': 'none',
  }));
  // Suunnattu maavalaistus (aurinko NW): suurmuotoinen tilavuus, maskattu maahan.
  gMap.appendChild(el('rect', {
    x: 0, y: 0, width: 1000, height: 700, 'class': 'land-light',
    fill: 'url(#land-light)', mask: 'url(#land-mask)', 'pointer-events': 'none',
  }));
  gMap.appendChild(gBevel);
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
          // Purjehdusreitti: pehmeä hehku + katkoviiva + pienet satamapisteet
          // päissä (reitti "kiinnittyy" maahan). Kolme kerrosta, ei suodatinta.
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
          gEdges.appendChild(el('circle', { cx: a.x, cy: a.y, r: 2.4, 'class': 'edge-port', fill: '#0a1a28', stroke: '#9fd0f0', 'stroke-opacity': 0.5, 'stroke-width': 1 }));
          gEdges.appendChild(el('circle', { cx: b.x, cy: b.y, r: 2.4, 'class': 'edge-port', fill: '#0a1a28', stroke: '#9fd0f0', 'stroke-opacity': 0.5, 'stroke-width': 1 }));
        } else {
          // Lyhyt mannerten välinen yhteys: "salmi/silta". Tumma kotelo +
          // vaalea ydin → reitti lukee syvyydellä eikä litteänä kirkkaana
          // palkkina joka halkoo alueita.
          gEdges.appendChild(el('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            'class': 'edge-land-casing', stroke: '#06131f', 'stroke-opacity': 0.55,
            'stroke-width': 4, 'stroke-linecap': 'round',
          }));
          gEdges.appendChild(el('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            'class': 'edge-land', stroke: '#d7e8f6', 'stroke-opacity': 0.6,
            'stroke-width': 1.6, 'stroke-linecap': 'round',
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
  // Paljastus alueen OMALLA muodolla (ei kiinteä ympyrä) → sumu myötäilee
  // rannikoita eikä näytä kuplilta. Leveä musta veto = pieni rannikkomarginaali
  // (näet rannan). Yhteinen blur-suodatin pehmentää sumun ja valon rajan.
  // Musta muoto = murk leikataan pois (paljastettu); opacity 0 = piilossa (sumu).
  const fogReveal = el('g', { filter: 'url(#fog-feather)' });
  for (const id of TERRITORY_IDS) {
    const d = regionEls[id]?.getAttribute('d') || '';
    const hole = el('path', {
      d, fill: '#000', stroke: '#000', 'stroke-width': 16, 'stroke-linejoin': 'round', opacity: 0,
    });
    fogReveal.appendChild(hole);
    fogHoles[id] = hole;
  }
  fogMask.appendChild(fogReveal);
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
    // Heittovarjo tokenin alle (fake-3D): staattinen tumma ellipsi napin
    // pohjan alapuolella → token "leijuu" laudan yllä. Alimpana g:ssä, ei
    // suodatinta, ei osoitintapahtumia.
    const tokenShadow = el('ellipse', {
      cx: t.x, cy: t.y + NODE_R + 2, rx: 16, ry: 4.5,
      fill: '#000', 'fill-opacity': 0.32, 'class': 'token-shadow', 'pointer-events': 'none',
    });
    g.appendChild(tokenShadow);
    // Pakkashehku jäätyneen napin taakse (näkyy vain .frozen-tilassa CSS:llä).
    const chill = el('circle', { cx: t.x, cy: t.y, r: 38, fill: 'url(#chill-glow)', 'class': 'chill', 'pointer-events': 'none', opacity: 0 });
    const halo = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 5, fill: 'none', 'stroke-width': 4, 'class': 'halo', 'stroke-opacity': 0, filter: 'url(#halo-glow)' });
    // Premium-token ("medaljonki") kerroksittain ILMAN uusia suodattimia:
    // tumma pohjarengas (bezel) erottaa laudasta, gradienttikiekko (filter
    // vain tässä – katettu .interacting-eskaappirulella), ohut vaalea
    // yläkulman kohovalokaari (metallin heijaste), tiukka spekulaarikiilto.
    const ringDark = el('circle', { cx: t.x, cy: t.y, r: NODE_R + 2, fill: 'none', stroke: '#081119', 'stroke-width': 3, 'stroke-opacity': 0.55, 'class': 'node-ring-dark', 'pointer-events': 'none' });
    const circle = el('circle', { cx: t.x, cy: t.y, r: NODE_R, 'stroke-width': 2.5, 'class': 'node', filter: 'url(#node-shadow)' });
    // Vaalea sisäkohovalokaari ylävasemmalle (ei koko rengasta): terävä
    // metallin heijaste. Kaari 165°→300° (vasen → yli yläreunan). Väri per
    // omistaja asetetaan updateMapissa.
    const arcR = NODE_R - 1.5;
    const aa = (deg) => (deg * Math.PI) / 180;
    const ap = (deg) => `${(t.x + Math.cos(aa(deg)) * arcR).toFixed(2)} ${(t.y + Math.sin(aa(deg)) * arcR).toFixed(2)}`;
    const ring = el('path', {
      d: `M ${ap(165)} A ${arcR} ${arcR} 0 0 1 ${ap(300)}`,
      fill: 'none', 'stroke-width': 1.5, stroke: '#eaf4ff', 'stroke-opacity': 0,
      'stroke-linecap': 'round', 'class': 'node-rim', 'pointer-events': 'none',
    });
    const glossCx = t.x - NODE_R * 0.3, glossCy = t.y - NODE_R * 0.4;
    const gloss = el('ellipse', {
      cx: glossCx, cy: glossCy, rx: NODE_R * 0.44, ry: NODE_R * 0.24,
      fill: '#ffffff', opacity: 0.15, 'class': 'node-gloss', 'pointer-events': 'none',
      transform: `rotate(-24 ${glossCx} ${glossCy})`,
    });
    // Värisokeusvihjeen pip: pieni kiinteä muotomerkki oikeaan alakulmaan.
    // Muoto/d, väri ja näkyvyys asetetaan updateMapissa (attribuutit).
    const pip = el('path', {
      d: '', fill: '#000', stroke: '#eaf4ff', 'stroke-width': 0.75,
      'stroke-linejoin': 'round', 'class': 'node-pip', 'pointer-events': 'none', opacity: 0,
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
    g.appendChild(ring); g.appendChild(gloss); g.appendChild(pip);
    g.appendChild(count); g.appendChild(name); g.appendChild(snow); g.appendChild(frost);
    const handler = (ev) => { ev.preventDefault(); ev.stopPropagation(); onTap(id); };
    g.addEventListener('click', handler);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handler(ev); });
    gNodes.appendChild(g);
    nodeRefs[id] = { g, halo, circle, count, name, frost, chill, snow, flakes, ring, gloss, pip, tokenShadow, region: regionEls[id] };
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

// --- Hyökkäysnuoli: kaareva nuoli hyökkääjältä kohteelle -------------------
// Yksi nuoli kerrallaan: elementti luodaan kerran ja sitä käytetään uudelleen
// (vain attribuutteja päivitetään). pointer-events: none, ei suodattimia.
let _arrowEl = null;

/**
 * Näyttää kaarevan hyökkäysnuolen (kvadraattinen polku + nuolenkärki)
 * hyökkääjältä kohteelle. Nuoli päättyy ~10 px ennen kumpaakin nappia
 * (r=21), jottei se peitä armeijalukuja. Kutsutaan renderissä – halpa:
 * koskee vain yhtä elementtiä.
 * @param {SVGGElement} gMap buildMapin palauttama kartan ryhmä
 * @param {{x:number,y:number}} from hyökkääjä (TERRITORIES[id])
 * @param {{x:number,y:number}} to kohde (TERRITORIES[id])
 */
export function showAttackArrow(gMap, from, to) {
  if (!gMap || !from || !to) return;
  // Jos kartta rakennettiin uudelleen, vanha nuoli jäi vanhaan puuhun.
  if (_arrowEl && _arrowEl.parentNode !== gMap) {
    _arrowEl.parentNode?.removeChild?.(_arrowEl);
    _arrowEl = null;
  }
  if (!_arrowEl) {
    _arrowEl = el('g', { id: 'attack-arrow', 'class': 'attack-arrow', 'pointer-events': 'none' });
    const line = el('path', {
      d: '', fill: 'none', stroke: '#ff5757', 'stroke-width': 3.5,
      'stroke-linecap': 'round', 'stroke-dasharray': '8 6', 'class': 'attack-arrow-line',
    });
    const head = el('polygon', { points: '', fill: '#ff5757', 'class': 'attack-arrow-head' });
    _arrowEl.appendChild(line);
    _arrowEl.appendChild(head);
    _arrowEl._line = line;
    _arrowEl._head = head;
    gMap.appendChild(_arrowEl);
  }
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const margin = NODE_R + 10; // ~10 px ennen nappia (r=21)
  if (dist <= margin * 2 + 6) { hideAttackArrow(gMap); return; }
  const ux = dx / dist, uy = dy / dist;
  const ax = from.x + ux * margin, ay = from.y + uy * margin;
  const bx = to.x - ux * margin, by = to.y - uy * margin;
  // Kohtisuora "jousi" ~25 px (lyhyillä väleillä loivempi).
  const bow = Math.min(25, dist * 0.2);
  const px = -uy, py = ux;
  const mx = (ax + bx) / 2 + px * bow, my = (ay + by) / 2 + py * bow;
  const f = (v) => v.toFixed(1);
  _arrowEl._line?.setAttribute?.('d', `M ${f(ax)} ${f(ay)} Q ${f(mx)} ${f(my)} ${f(bx)} ${f(by)}`);
  // Nuolenkärki: tangentti loppupisteessä = suunta ohjauspisteestä loppuun.
  let tx = bx - mx, ty = by - my;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl; ty /= tl;
  const hx = -ty, hy = tx;
  const hl = 11, hw = 5.5;
  _arrowEl._head?.setAttribute?.('points',
    `${f(bx)},${f(by)} ${f(bx - tx * hl + hx * hw)},${f(by - ty * hl + hy * hw)} ` +
    `${f(bx - tx * hl - hx * hw)},${f(by - ty * hl - hy * hw)}`);
  if (_arrowEl.style) _arrowEl.style.display = '';
}

/** Piilottaa hyökkäysnuolen (elementti säilyy uudelleenkäyttöä varten). */
export function hideAttackArrow(_gMap) {
  if (_arrowEl && _arrowEl.style) _arrowEl.style.display = 'none';
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
        if (hole) hole.setAttribute('opacity', fog.has(id) ? 1 : 0);
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

    // Tokenin ilme: kiekon täyttö + tumma metallireunus (circle.stroke) +
    // vaalea kohovalokaari (rim) + värisokeuspip (r.pip). Pip näkyy VAIN
    // omistetuilla alueilla; neutraali/sumu/lumimyrsky = ei pippiä.
    // Vain attribuutteja (mobiilisuorituskyky).
    const rim = r.ring || null;
    const pip = r.pip || null;
    if (blocked) {
      r.circle.setAttribute('fill', 'url(#node-grad-blizzard)');
      r.circle.setAttribute('stroke', '#6f9cb8');
      if (rim) { rim.setAttribute('stroke', '#eaf7ff'); rim.setAttribute('stroke-opacity', 0.55); }
      if (pip) pip.setAttribute('opacity', 0);
    } else if (hidden) {
      r.circle.setAttribute('fill', 'url(#node-grad-fog)');
      r.circle.setAttribute('stroke', '#243646');
      if (rim) { rim.setAttribute('stroke', '#5b7590'); rim.setAttribute('stroke-opacity', 0.45); }
      if (pip) pip.setAttribute('opacity', 0);
    } else if (owner == null) {
      r.circle.setAttribute('fill', 'url(#node-grad-neutral)');
      r.circle.setAttribute('stroke', NEUTRAL_DARK);
      if (rim) { rim.setAttribute('stroke', '#d7dee4'); rim.setAttribute('stroke-opacity', 0.5); }
      if (pip) pip.setAttribute('opacity', 0);
    } else {
      const idx = owner % PLAYER_COLORS.length;
      r.circle.setAttribute('fill', `url(#node-grad-${idx})`);
      r.circle.setAttribute('stroke', PLAYER_COLORS_DARK[idx]);
      if (rim) {
        rim.setAttribute('stroke', mix(PLAYER_COLORS_LIGHT[idx], '#ffffff', 0.4));
        rim.setAttribute('stroke-opacity', 0.75);
      }
      if (pip) {
        const t2 = TERRITORIES[id]; // kartan koordinaatit (ei pelitila)
        const px = t2.x + NODE_R * 0.62, py = t2.y + NODE_R * 0.62;
        pip.setAttribute('d', pipPath(PIP_SHAPES[idx % PIP_SHAPES.length], px, py, 4.2));
        pip.setAttribute('fill', PLAYER_COLORS_DARK[idx]);
        pip.setAttribute('opacity', 1);
      }
    }
    // Sumun peittämä nappula on hieman läpikuultava → häämöttää sumussa
    // "verhottuna" eikä ole kiinteä pallo. Muut täydellä peitolla.
    r.circle.setAttribute('fill-opacity', hidden ? 0.8 : 1);

    // Alue-region: täyttö omistajan mukaan per-omistaja pystygradientilla
    // (#region-grad-*), sama blocked/hidden/omistaja-logiikka kuin tokenilla,
    // + korostusluokat. Vain attribuutteja/luokkia.
    if (r.region) {
      let rf;
      if (blocked) rf = 'url(#region-grad-blizzard)';
      else if (hidden) rf = 'url(#region-grad-fog)';
      else if (owner == null) rf = 'url(#region-grad-neutral)';
      else rf = `url(#region-grad-${owner % PLAYER_COLORS.length})`;
      r.region.setAttribute('fill', rf);
      r.region.classList.toggle('region-selected', !blocked && id === selected);
      r.region.classList.toggle('region-target', !blocked && id === attackTarget);
      r.region.classList.toggle('region-valid',
        !blocked && id !== selected && id !== attackTarget && targets.has(id));
      // Vahvistusvaihe: omat alueet joihin voi sijoittaa saavat hillityn
      // "sijoitettava"-korostuksen → pelaaja näkee mihin napauttaa.
      r.region.classList.toggle('region-placeable',
        state.phase === 'reinforce' && state.reinforcements > 0 &&
        owner === state.current && !blocked && !hidden && id !== selected);
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
