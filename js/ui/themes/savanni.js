// savanni — lämmin illan hämärä savannin yllä (Afrikka). Meri pysyy TUMMANA
// (luettavuus säilyy) mutta kallistuu syvän lämpimän umbra-sinisen
// hämärän suuntaan; hehku meripihkanvärinen, muste lämmin hiekka, vaahto
// vaalea hiekka, neutraali maa (Madagaskar/Arabia) lämpimän harmaanruskea.
// Koriste: hyvin himmeä auringonkiekko meren nurkassa.
export default {
  id: 'savanni',

  // Meri: lämmin tumma umbra-sininen hämärä, vajoten lähes mustaan syvyyteen.
  seaTop: '#3e2c1a',
  seaMid: '#241c22',
  seaBot: '#0d0d16',
  seaGlowColor: '#7a4a2a',
  sheenTop: '#a8703a',

  vignetteColor: '#1c0e04',

  gridInk: '#d9a86a',
  frameInk: '#e8bd7e',

  landBase: '#4a3c30',
  landStroke: '#241a12',
  landLightColor: '#ffdfa0',

  foam: '#eaddb6',
  foamBright: '#f8ecd0',

  ridgeBase: '#1a120a',
  ridge: '#7a5636',
  ridgeCap: '#f2ddab',

  routeCore: '#e0b06a',
  routeGlowCol: '#d68a3c',
  portFill: '#140f0a',

  // Ambientkoriste: hyvin himmeä laskeva auringonkiekko avomeren kulmassa,
  // yksi ympyrä + pari sädeviivaa. Halpaa, ei animaatioita.
  deco({ el, mix }) {
    const g = el('g', { id: 'theme-deco-savanni', opacity: 0.16 });
    const sunCol = '#ffb15c';
    const cx = 860, cy = 560;
    g.appendChild(el('circle', { cx, cy, r: 46, fill: sunCol, 'fill-opacity': 0.5 }));
    g.appendChild(el('circle', { cx, cy, r: 46, fill: 'none', stroke: sunCol, 'stroke-opacity': 0.6, 'stroke-width': 1.2 }));
    for (const a of [-30, 0, 30]) {
      const rad = (a * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * 58, y1 = cy + Math.sin(rad) * 58;
      const x2 = cx + Math.cos(rad) * 78, y2 = cy + Math.sin(rad) * 78;
      g.appendChild(el('path', { d: `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, stroke: sunCol, 'stroke-width': 1.2, 'stroke-linecap': 'round' }));
    }
    return g;
  },
};
