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

  // Ambientkoriste: kreikkalainen meanteri-nauha ylänurkassa + kevyt
  // triremi-siluetti avomerellä. Molemmat matalan opasiteetin viivapiirrosta.
  deco({ el, mix }) {
    const g = el('g', { id: 'theme-deco-pergamentti' });
    const inkCol = '#d9b872';

    // Meanteri-nauha (kreikkalainen aaltokoriste), oikea yläkulma.
    const meander = el('g', { transform: 'translate(760,34)', opacity: 0.22 });
    let d = '';
    const step = 20, h = 12;
    for (let i = 0; i < 8; i++) {
      const x = i * step;
      d += `M${x},0 L${x},${h} L${x + step * 0.6},${h} L${x + step * 0.6},${h * 0.4} L${x + step * 0.15},${h * 0.4} `;
    }
    meander.appendChild(el('path', {
      d, fill: 'none', stroke: inkCol, 'stroke-width': 1.4, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square',
    }));
    g.appendChild(meander);

    // Pieni triremi-siluetti avomerellä (runko + masto + purje ääriviivana).
    const ship = el('g', { transform: 'translate(210,540) scale(1.0)', opacity: 0.16 });
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
