// Karttateemat: kullakin kartalla oma visuaalinen tunnelma (meri, muste,
// vaahto, reitit, ambientkoristeet). Teema on TOKEN-OLIO jonka render.js
// lukee — puuttuva token putoaa nykyiseen atlas-oletukseen, joten teema voi
// ylikirjoittaa vain haluamansa. Ei uusia SVG-suodattimia eikä jatkuvia
// animaatioita teemissä (lite-tila ja suorituskyky säilyvät).
//
// Tokenit (kaikki valinnaisia):
//   seaTop/seaMid/seaBot  meren gradientin pysäkit (tummuus kasvaa)
//   seaGlowColor          syvyyshehkun väri laudan keskellä
//   sheenTop              pinnan kiillon yläväri
//   vignetteColor         reunavinjentin väri
//   gridInk / frameInk    pituuspiirien ja neatline-kehyksen muste
//   landBase / landStroke ei-pelattavan maan täyttö ja ääriviiva (GEO)
//   landLightColor        suunnatun maavalon väri (aurinko luoteesta)
//   foam / foamBright     rantavaahdon sävyt
//   ridge/ridgeBase/ridgeCap  vuoristorajojen värit
//   routeCore/routeGlowCol/portFill  merireittien katkoviiva/hehku/satamat
//   deco({ el, mix })     valinn. ambientkoristeryhmä gMappiin (maailman
//                         koordinaatit 0..1000×0..700; halpaa viivapiirrosta,
//                         matala opasiteetti; saa sea-deco-luokan → lite piilottaa)

import atlas from './atlas.js';
import pergamentti from './pergamentti.js';
import savanni from './savanni.js';
import talvi from './talvi.js';
import jade from './jade.js';
import taru from './taru.js';
import laguuni from './laguuni.js';

const THEMES = { atlas, pergamentti, savanni, talvi, jade, taru, laguuni };

// Kartta → teema. Puuttuva merkintä = atlas (nykyinen ilme).
const MAP_THEMES = {
  antiquity: 'pergamentti',
  africa: 'savanni',
  suomi: 'talvi',
  aasia: 'jade',
  taruvaltakunnat: 'taru',
  saaristomaailma: 'taru',
  tyynimeri: 'laguuni',
};

/** Palauttaa kartan teeman tokenit (atlas-pohjan päälle sulautettuna). */
export function themeFor(mapId) {
  const t = THEMES[MAP_THEMES[mapId]] || atlas;
  return { ...atlas, ...t };
}
