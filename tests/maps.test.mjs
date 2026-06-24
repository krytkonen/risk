import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, MAP_LIST, setActiveMap, adjacencyIsSymmetric, TERRITORIES, TERRITORY_IDS } from '../js/data/territories.js';

const mapIds = Object.keys(MAPS);

test('karttoja on vähintään kolme', () => {
  assert.ok(mapIds.length >= 3, `vain ${mapIds.length} karttaa`);
});

test('MAP_LIST vastaa MAPS-rekisteriä', () => {
  assert.equal(MAP_LIST.length, mapIds.length);
  for (const m of MAP_LIST) assert.ok(MAPS[m.id], `puuttuu ${m.id}`);
});

for (const id of mapIds) {
  const map = MAPS[id];
  const T = map.territories;
  const ids = Object.keys(T);

  test(`[${id}] naapuruudet ovat symmetrisiä`, () => {
    const r = adjacencyIsSymmetric(T);
    assert.equal(r.ok, true, r.reason);
  });

  test(`[${id}] kartta on yhtenäinen`, () => {
    const seen = new Set([ids[0]]);
    const q = [ids[0]];
    while (q.length) {
      const cur = q.shift();
      for (const n of T[cur].adj) if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
    assert.equal(seen.size, ids.length, 'kartta ei ole yhtenäinen');
  });

  test(`[${id}] jokaisella alueella on naapuri, gen ja kelvollinen manner`, () => {
    for (const t of ids) {
      assert.ok(T[t].adj.length >= 1, `${t} ilman naapureita`);
      assert.ok(T[t].gen, `${t} ilman gen-muotoa`);
      assert.ok(map.continents[T[t].continent], `${t} viittaa tuntemattomaan mantereeseen ${T[t].continent}`);
    }
  });

  test(`[${id}] jokaisella mantereella on vähintään yksi alue`, () => {
    for (const c of Object.keys(map.continents)) {
      const count = ids.filter((t) => T[t].continent === c).length;
      assert.ok(count >= 1, `manner ${c} on tyhjä`);
    }
  });
}

test('setActiveMap vaihtaa aktiivisen kartan ja palauttaa oletukseen', () => {
  setActiveMap('europe');
  assert.ok(TERRITORY_IDS.includes('finland'), 'Eurooppa-kartan pitäisi olla aktiivinen');
  assert.equal(TERRITORIES['finland'].gen, 'Suomen');
  // palauta oletus muille testeille
  setActiveMap('classic');
  assert.equal(TERRITORY_IDS.length, 42);
});
