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

    // Revontulet: 3 loivaa, päällekkäistä nauhaa aivan pohjoisreunalla
    // (Lapin maamassa peittää keskiosan — nauhat jäävät näkyviin sivuilla
    // avoveden kaistaleella), vihertävän turkoosin sävyissä, matala opasiteetti.
    const auroraPaths = [
      'M 30 22 Q 260 -6 480 18 T 970 14',
      'M 20 40 Q 300 12 520 36 T 980 30',
      'M 35 56 Q 340 30 560 52 T 950 46',
    ];
    const auroraColors = ['#7be3c2', '#5fd0c9', '#8fe6d6'];
    auroraPaths.forEach((d, i) => {
      g.appendChild(el('path', {
        d,
        fill: 'none',
        stroke: auroraColors[i % auroraColors.length],
        'stroke-width': 7 - i,
        'stroke-linecap': 'round',
        'stroke-opacity': 0.26 - i * 0.04,
      }));
    });

    // Jäälautat Perämerellä: avoveden kaistale Pohjanmaan rannikon
    // länsipuolella (x < ~150, todellisen Suomi-kartan länsirannikko kulkee
    // noin x 210-500 kohdalla), pieniä epäsäännöllisiä ääriviivoja.
    const floes = [
      { cx: 90, cy: 400, r: 15 },
      { cx: 130, cy: 440, r: 20 },
      { cx: 95, cy: 480, r: 12 },
      { cx: 150, cy: 510, r: 16 },
      { cx: 115, cy: 545, r: 10 },
      { cx: 70, cy: 460, r: 13 },
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
        'fill-opacity': 0.09,
        stroke: '#eef9ff',
        'stroke-opacity': 0.3,
        'stroke-width': 1.2,
      }));
    });

    return g;
  },
};
