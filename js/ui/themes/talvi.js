// talvi — pohjoinen talviyö. Kylmä teräksen- ja jäänsininen meri, jää-valkoinen
// vaahto, huurteenhopea muste. Neutraali maa (Ruotsi/Norja/Venäjä) kylmän
// sinipohjaista harmaata. Merireitit vaaleanjäisiä. Deco: himmeä revontuli
// pohjoisessa merenselässä + muutama jäälautan ääriviiva Perämerellä.
export default {
  id: 'talvi',

  // Meri: teräksensininen → syvä jäätalvi. Hieman kylmempi ja kirkkaampi
  // yläosastaan kuin atlas, tummuu kohti pohjaa siniharmaaksi.
  seaTop: '#2e5f7f',
  seaMid: '#173f57',
  seaBot: '#081a26',
  seaGlowColor: '#2c6f86',
  sheenTop: '#bfe6f2',

  vignetteColor: '#020c14',

  gridInk: '#cfe6f2',
  frameInk: '#d8ecf5',

  // Neutraali maa: kylmä sinertävä kivenharmaa (naapurimaat, ei pelattavissa).
  landBase: '#39495a',
  landStroke: '#131e28',
  landLightColor: '#eaf6ff',

  foam: '#e8f7fc',
  foamBright: '#ffffff',

  ridge: '#5a7085',
  ridgeBase: '#0b1620',
  ridgeCap: '#f3fbff',

  routeCore: '#dff3fb',
  routeGlowCol: '#8fd6ec',
  portFill: '#0b1e2c',

  deco({ el, mix }) {
    const g = el('g', { class: 'talvi-deco' });

    // Revontulet: 3 loivaa, päällekkäistä nauhaa pohjoisessa (yläosa on
    // pohjoista päin karttaprojektiota), vihertävän turkoosin sävyissä,
    // hyvin matala opasiteetti ettei häiritse merilukua.
    const auroraPaths = [
      'M 60 60 Q 260 10 480 55 T 940 40',
      'M 40 95 Q 300 45 520 90 T 960 80',
      'M 90 130 Q 340 80 560 125 T 900 115',
    ];
    const auroraColors = ['#7be3c2', '#5fd0c9', '#8fe6d6'];
    auroraPaths.forEach((d, i) => {
      g.appendChild(el('path', {
        d,
        fill: 'none',
        stroke: auroraColors[i % auroraColors.length],
        'stroke-width': 10 - i * 1.5,
        'stroke-linecap': 'round',
        'stroke-opacity': 0.14 - i * 0.02,
      }));
    });

    // Jäälautat Perämerellä (x 150-400, y 350-500): pieniä epäsäännöllisiä
    // ääriviivoja, vaaleanjäisiä, hyvin himmeitä.
    const floes = [
      { cx: 190, cy: 380, r: 16 },
      { cx: 250, cy: 420, r: 22 },
      { cx: 210, cy: 460, r: 13 },
      { cx: 330, cy: 400, r: 18 },
      { cx: 300, cy: 470, r: 11 },
      { cx: 370, cy: 450, r: 15 },
    ];
    floes.forEach(({ cx, cy, r }, i) => {
      const wobble = i % 2 === 0 ? 1 : -1;
      const d = `M ${cx - r} ${cy} `
        + `Q ${cx - r * 0.5} ${cy - r * (1 + 0.2 * wobble)} ${cx} ${cy - r} `
        + `Q ${cx + r * 0.6} ${cy - r * 0.7} ${cx + r} ${cy} `
        + `Q ${cx + r * 0.5} ${cy + r * (1 - 0.15 * wobble)} ${cx} ${cy + r} `
        + `Q ${cx - r * 0.6} ${cy + r * 0.6} ${cx - r} ${cy} Z`;
      g.appendChild(el('path', {
        d,
        fill: '#dff2fa',
        'fill-opacity': 0.06,
        stroke: '#eef9ff',
        'stroke-opacity': 0.18,
        'stroke-width': 1,
      }));
    });

    return g;
  },
};
