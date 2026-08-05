// taru — arkaaninen yö. Käytössä KAHDELLA fantasiakartalla (Taruvaltakunnat,
// Saaristomaailma), jotka molemmat piirtävät merikäärmeet automaattisesti.
// Meri: syvä indigonvioletti; hehku sekoittaa violettia ja syvänmerensinistä
// tealia ("mystinen"); muste hopeansininen; vaahto kalpea kuunvalo; reitit
// hopeiset; neutraali koristemaa pysyy vaimeana jottei kilpaile pelaajaväreille.
export default {
  id: 'taru',

  seaTop: '#2b255a',
  seaMid: '#1c1745',
  seaBot: '#0c0924',
  seaGlowColor: '#5b5aa0',
  sheenTop: '#a89bdb',
  vignetteColor: '#0a0620',

  gridInk: '#9fb0da',
  frameInk: '#c7d2f2',

  landBase: '#3a3550',
  landStroke: '#141024',
  landLightColor: '#e8e4f7',

  foam: '#d9d6f5',
  foamBright: '#efe9ff',

  ridgeBase: '#150f2c',
  ridge: '#4a4270',
  ridgeCap: '#e8e4f7',

  routeCore: '#cfd6f5',
  routeGlowCol: '#8f9fe0',
  portFill: '#12102a',

  // Harva staattinen tähtikenttä avomerellä. Pisteet on siroteltu reunoille
  // ja kulmiin niin että ne toimivat sekä maapainotteisella Taruvaltakunnat-
  // kartalla (vältetty keskialue x 300-650 / y 200-450) että avoimemmalla
  // Saaristomaailmalla. Ei animaatiota, ei suodattimia.
  deco({ el }) {
    const g = el('g', { class: 'taru-stars' });
    const stars = [
      [40, 60, 1.1, 0.28], [95, 540, 0.9, 0.22], [150, 120, 0.8, 0.18],
      [920, 80, 1.2, 0.3], [962, 300, 0.7, 0.2], [880, 610, 1.0, 0.25],
      [500, 38, 0.9, 0.22], [700, 655, 1.1, 0.27], [50, 350, 0.8, 0.19],
      [950, 500, 1.0, 0.24], [280, 660, 0.9, 0.2], [650, 55, 0.8, 0.17],
    ];
    for (const [x, y, r, o] of stars) {
      g.appendChild(el('circle', {
        cx: x, cy: y, r, fill: '#e8e4ff', 'fill-opacity': o,
      }));
    }
    return g;
  },
};
