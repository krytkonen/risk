// Värisokeus-simulaatio: arvioi paletin erottuvuus normaalina + 3 CVD-tyyppinä.
// Mittari: pienin pareittainen deltaE (CIE76) kaikissa neljässä näkötilassa.
// Suurempi minimi = paremmin erottuvat pelaajavärit. Pipit hoitavat pahimman
// tapauksen, mutta hyvä paletti vähentää sekaannusta jo ilman muotoja.

const CURRENT = ['#2f7bd6', '#d63b3b', '#3aa84a', '#e0a020', '#9b59c6', '#16a89a'];

// Okabe-Ito-johdannainen: siniturkoosi/vermillion-pohjainen, 6 hyvin erottuvaa.
const CAND = ['#0072b2', '#d55e00', '#029e73', '#e6a000', '#cc79a7', '#56b4e9'];
// Vaihtoehto B: pidä nykyinen sininen ja teal, korjaa vain puna/vihreä-pari.
const CANDB = ['#2f7bd6', '#d55e00', '#029e73', '#e6c229', '#b060c0', '#12b5b0'];

function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// sRGB -> lineaarinen
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function rgbToLab([r, g, b]) {
  r = lin(r); g = lin(g); b = lin(b);
  let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  x /= 0.95047; z /= 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function deltaE(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

// Brettel/Machado-tyyliset yksinkertaistetut CVD-matriisit (lineaarinen RGB).
const CVD = {
  normaali: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152, 1.053, -0.205], [0.115, 0.786, 0.099], [-0.004, -0.048, 1.052]],
  deuteranopia: [[0.367, 0.861, -0.228], [0.280, 0.673, 0.047], [-0.012, 0.043, 0.969]],
  tritanopia: [[1.256, -0.077, -0.179], [-0.078, 0.931, 0.148], [0.005, 0.691, 0.304]],
};
function applyCvd(rgb, m) {
  const [r, g, b] = rgb.map(lin);
  const out = m.map((row) => row[0] * r + row[1] * g + row[2] * b);
  const unlin = (c) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; };
  return out.map((c) => unlin(c) * 255);
}

function minDeltaE(palette) {
  let overallMin = Infinity;
  const perMode = {};
  for (const [name, m] of Object.entries(CVD)) {
    const labs = palette.map((hex) => rgbToLab(applyCvd(hexToRgb(hex), m)));
    let mn = Infinity;
    for (let i = 0; i < labs.length; i++)
      for (let j = i + 1; j < labs.length; j++)
        mn = Math.min(mn, deltaE(labs[i], labs[j]));
    perMode[name] = mn;
    overallMin = Math.min(overallMin, mn);
  }
  return { overallMin, perMode };
}

for (const [label, pal] of [['NYKYINEN', CURRENT], ['Okabe-Ito (A)', CAND], ['Korjaa-pari (B)', CANDB]]) {
  const r = minDeltaE(pal);
  console.log(`\n${label}: ${pal.join(' ')}`);
  console.log(`  min ΔE kaikissa tiloissa: ${r.overallMin.toFixed(1)}`);
  for (const [m, v] of Object.entries(r.perMode)) console.log(`    ${m}: ${v.toFixed(1)}`);
}
