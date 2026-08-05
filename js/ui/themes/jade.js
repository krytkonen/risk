// jade — jade & posliini. Syvä jaden vihreä-turkoosi meri, jadenvihreä hehku,
// pehmeän kullan muste. Neutraali maa (Eurooppa/Afrikka) vaimeaa kivenharmaata.
// Himalajan harjanteiden huiput lumivalkoisia. Reitit vaaleankultaisia.
// Deco: himmeä seigaiha-aaltokuvio Intian valtameren tyhjässä nurkassa.
export default {
  id: 'jade',

  // Meri: syvä jade/teali, tummuu kohti pohjaa lähes mustanvihreäksi.
  seaTop: '#1f5b52',
  seaMid: '#123b38',
  seaBot: '#071815',
  seaGlowColor: '#2f8a6e',
  sheenTop: '#bfe8c9',

  vignetteColor: '#02100c',

  gridInk: '#e3c988',
  frameInk: '#eddba0',

  // Neutraali maa: vaimea kivenharmaa lämpimällä posliinisävyllä.
  landBase: '#4a4640',
  landStroke: '#171512',
  landLightColor: '#fff3d6',

  foam: '#dff3e6',
  foamBright: '#f2fbef',

  ridge: '#6b5a3e',
  ridgeBase: '#120e08',
  ridgeCap: '#fbfaf2',

  routeCore: '#f4dfa0',
  routeGlowCol: '#e0b465',
  portFill: '#12100a',

  deco({ el, mix }) {
    const g = el('g', { class: 'jade-deco' });

    // Seigaiha: yhteiskeskisten kaarien rivistö Intian valtameren avoimessa
    // kulmassa (kartan mantereet päättyvät Jemeniin n. y≈545; kanvaasi jatkuu
    // paljon alemmas merenä, joten kuvio istutetaan reilusti rannikon
    // eteläpuolelle jottei se törmää rantaviivaan tai mannerkartusseihin).
    const originX = 55, originY = 690;
    const cols = 5, rows = 3;
    const step = 52;
    const radii = [24, 17, 10];
    const strokeCol = '#f6e3a8';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = originX + col * step + (row % 2 ? step / 2 : 0);
        const cy = originY + row * step * 0.68;
        radii.forEach((r, ri) => {
          g.appendChild(el('path', {
            d: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`,
            fill: 'none',
            stroke: strokeCol,
            'stroke-width': 1.1,
            'stroke-opacity': 0.15 - ri * 0.025,
          }));
        });
      }
    }

    return g;
  },
};
