// Fantasiasaarten sommittelija: saarispekseistä (keskipiste, säteet, kierto,
// rosoisuus, seed) orgaanisia maapolygoneja geo-muodossa (LAND). Muoto on
// matalataajuista seedattua kohinaa säteessä → uskottavan epäsäännöllinen
// mutta sommiteltavissa. Käyttö moduulina: composeLand(specs) → polygonit.
//
// Spec: { cx, cy, rx, ry, rot=0, wobble=0.35, seed=1, n=36 }
//  - wobble 0.15 = sileä dyynirannikko, 0.5 = rikkonainen vuono-/tulivuorisaari.

function rnd(seed) {
  // Deterministinen LCG → vaiheet kohinatermeille.
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function islandPoly({ cx, cy, rx, ry, rot = 0, wobble = 0.35, seed = 1, n = 36 }) {
  const r = rnd(seed);
  const p = [r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283];
  const a2 = 0.5 + r() * 0.3, a3 = 0.3 + r() * 0.25, a5 = 0.15 + r() * 0.15, a8 = 0.08, a13 = 0.05;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const th = (Math.PI * 2 * k) / n;
    const noise = a2 * Math.sin(2 * th + p[0]) + a3 * Math.sin(3 * th + p[1])
      + a5 * Math.sin(5 * th + p[2]) + a8 * Math.sin(8 * th + p[3]) + a13 * Math.sin(13 * th + p[4]);
    const f = Math.max(0.35, 1 + wobble * noise);
    const ex = Math.cos(th) * rx * f, ey = Math.sin(th) * ry * f;
    pts.push([
      Math.round((cx + ex * cosR - ey * sinR) * 10) / 10,
      Math.round((cy + ex * sinR + ey * cosR) * 10) / 10,
    ]);
  }
  return pts;
}

export function composeLand(specs) {
  return specs.map(islandPoly);
}
