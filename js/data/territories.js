// Karttarekisteri. Pelissä on useita karttoja; yksi on kerrallaan aktiivinen.
// TERRITORIES / TERRITORY_IDS / CONTINENTS ovat "eläviä" vientejä (live
// bindings): setActiveMap() vaihtaa niiden arvon, ja kaikki moduulit jotka
// importtaavat ne näkevät uuden kartan ilman erillistä välitystä.
//
// Jaettu moduuli – toimii sekä selaimessa että Node-testeissä (ei DOM:ia).

/** @typedef {{id:string,name:string,gen:string,continent:string,x:number,y:number,adj:string[]}} Territory */

import classic from './maps/classic.js';
import europe from './maps/europe.js';
import antiquity from './maps/antiquity.js';

/** Kaikki saatavilla olevat kartat id:n mukaan. */
export const MAPS = {
  [classic.id]: classic,
  [europe.id]: europe,
  [antiquity.id]: antiquity,
};

/** Karttavalikko UI:lle: [{ id, name }]. */
export const MAP_LIST = Object.values(MAPS).map((m) => ({ id: m.id, name: m.name }));

export const DEFAULT_MAP = 'classic';

// Aktiivisen kartan elävät vienti­arvot. Oletuksena klassinen maailma, jotta
// suoraan TERRITORIES:iä importtaavat testit toimivat ilman setActiveMappia.
export let activeMapId = DEFAULT_MAP;
export let TERRITORIES = MAPS[DEFAULT_MAP].territories;
export let CONTINENTS = MAPS[DEFAULT_MAP].continents;
export let TERRITORY_IDS = Object.keys(TERRITORIES);

/**
 * Vaihtaa aktiivisen kartan. Palauttaa valitun kartan metatiedot.
 * @param {string} mapId
 */
export function setActiveMap(mapId) {
  const map = MAPS[mapId];
  if (!map) throw new Error(`Tuntematon kartta: ${mapId}`);
  activeMapId = mapId;
  TERRITORIES = map.territories;
  CONTINENTS = map.continents;
  TERRITORY_IDS = Object.keys(TERRITORIES);
  return map;
}

/** Aktiivisen kartan metatiedot. */
export function activeMap() {
  return MAPS[activeMapId];
}

/** Aakkoselliset id:t mantereittain (aktiivisesta kartasta). */
export function continentTerritories(continentId) {
  return TERRITORY_IDS.filter((id) => TERRITORIES[id].continent === continentId);
}

/** Tarkistaa että naapuruussuhteet ovat symmetrisiä – käytetään testeissä. */
export function adjacencyIsSymmetric(territories = TERRITORIES) {
  for (const id of Object.keys(territories)) {
    for (const n of territories[id].adj) {
      if (!territories[n]) return { ok: false, reason: `${id} viittaa tuntemattomaan alueeseen ${n}` };
      if (!territories[n].adj.includes(id)) {
        return { ok: false, reason: `${id} -> ${n} ei ole symmetrinen` };
      }
    }
  }
  return { ok: true };
}
