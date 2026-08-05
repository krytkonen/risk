// laguuni — trooppinen laguuni hämärässä (Tyynimeri). Meri: syvä turkoosi,
// selvästi kylläisempi/syaanimpi kuin atlas mutta yhä tumma; hehku kirkas
// syaani; muste vaalea merenvaahto; vaahto lämmin korallinvalkoinen; reitit
// kirkkaan syaanivalkoiset. Neutraali maa (Etelä-Kiina) lämmin harmaa.
export default {
  id: 'laguuni',

  seaTop: '#0f6068',
  seaMid: '#0a4650',
  seaBot: '#052a33',
  seaGlowColor: '#1fb8c4',
  sheenTop: '#7fe8e0',
  vignetteColor: '#031b1e',

  gridInk: '#a8e6d9',
  frameInk: '#cdf5e8',

  landBase: '#5a5148',
  landStroke: '#241f1a',
  landLightColor: '#ffe9c2',

  foam: '#ffdcc9',
  foamBright: '#fff1e6',

  ridgeBase: '#1c1310',
  ridge: '#6b5a44',
  ridgeCap: '#fff1e0',

  routeCore: '#c8fbf5',
  routeGlowCol: '#4dd9e8',
  portFill: '#062a2e',

  // Muutama harva riuttahiekan pilkku kaukaisilla avomerialueilla —
  // minimaalinen kosketus, ei kilpaile pelaajavärien kanssa.
  deco({ el }) {
    const g = el('g', { class: 'laguuni-atolls' });
    const flecks = [
      [55, 90, 1.0, 0.2], [935, 70, 0.9, 0.18], [70, 610, 1.1, 0.22],
      [945, 590, 0.8, 0.16], [500, 40, 0.8, 0.15],
    ];
    for (const [x, y, r, o] of flecks) {
      g.appendChild(el('circle', {
        cx: x, cy: y, r, fill: '#fff1e6', 'fill-opacity': o,
      }));
    }
    return g;
  },
};
