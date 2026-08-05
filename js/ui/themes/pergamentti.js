// pergamentti — vanhentunut merenkulkukartta (Antiikin maailma). Meri pysyy
// TUMMANA (luettavuus säilyy) mutta kallistuu syvän seepian ja tumman
// teal-musteen suuntaan; kehys/ruudukko messinki-kultaisena, vaahto
// lämpimän hiekanvärisenä, neutraali maa lämpimän terrakotta-harmaana,
// merireitit haalistuneena kultamusteena. Koriste: hillitty kreikkalainen
// meanteri-nauha ja pieni triremi-siluetti avomerellä.
export default {
  id: 'pergamentti',

  // Meri: syvä seepia-umbra yläosassa vajoten tumman teal-musteeseen.
  seaTop: '#3a2c18',
  seaMid: '#26200f',
  seaBot: '#0f0c07',
  seaGlowColor: '#3c5850',
  sheenTop: '#7a6238',

  vignetteColor: '#1a1004',

  gridInk: '#c9a662',
  frameInk: '#e0be7c',

  landBase: '#4a3c2c',
  landStroke: '#241a10',
  landLightColor: '#f4e2b8',

  foam: '#e8d6a0',
  foamBright: '#f6ecc8',

  ridgeBase: '#1c140a',
  ridge: '#8a6a3e',
  ridgeCap: '#f2e0ae',

  routeCore: '#d9b872',
  routeGlowCol: '#c99a4a',
  portFill: '#14100a',

  // Ambientkoriste: pieni laakeriseppele-oksa avomeren taskussa (Persian
  // pohjoispuolella) + kevyt triremi-siluetti Egeanmeren avoveden taskussa
  // (Kreikan ja Egyptin välissä). Molemmat sijainnit on tarkistettu
  // isPointInFill-tarkistuksella todelliseen avomereen (eivät jää
  // maakerroksen alle) — kartan geo-maamassa peittää suurimman osan
  // 1000×700-kankaasta, joten koristeet EIVÄT voi olla kartan reunoissa.
  deco({ el, mix }) {
    const g = el('g', { id: 'theme-deco-pergamentti' });
    const inkCol = '#d9b872';

    // Pieni laakerinoksa (kaksi vastakkaista lehtiriviä varren ympärillä).
    const laurel = el('g', { transform: 'translate(828,245)', opacity: 0.24 });
    laurel.appendChild(el('path', { d: 'M-13,4 Q0,-6 13,4', fill: 'none', stroke: inkCol, 'stroke-width': 1.1, 'stroke-linecap': 'round' }));
    const leaf = (lx, ly, ang) => `M${lx},${ly} l${(4 * Math.cos(ang)).toFixed(1)},${(4 * Math.sin(ang)).toFixed(1)} l${(-1.6 * Math.sin(ang)).toFixed(1)},${(1.6 * Math.cos(ang)).toFixed(1)} z`;
    const pts = [[-11, 2.6, -0.5], [-6.5, -1.2, -0.7], [-1.5, -3, -1.0], [4, -3, -2.1], [9, -1, -2.4], [12.5, 2.4, -2.7]];
    for (const [lx, ly, ang] of pts) laurel.appendChild(el('path', { d: leaf(lx, ly, ang), fill: inkCol, stroke: 'none' }));
    g.appendChild(laurel);

    // Pieni triremi-siluetti avomerellä (runko + masto + purje ääriviivana).
    const ship = el('g', { transform: 'translate(545,480) scale(0.85)', opacity: 0.18 });
    ship.appendChild(el('path', {
      d: 'M-16,4 Q0,12 16,4 L12,7 Q0,10 -12,7 Z',
      fill: inkCol, stroke: 'none',
    }));
    ship.appendChild(el('path', {
      d: 'M0,4 L0,-14', fill: 'none', stroke: inkCol, 'stroke-width': 1,
    }));
    ship.appendChild(el('path', {
      d: 'M0,-13 L11,-3 L0,-1 Z', fill: inkCol, stroke: 'none',
    }));
    g.appendChild(ship);

    return g;
  },
};
