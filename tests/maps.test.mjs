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

test('landBridges: avaimet viittaavat oikeisiin, VIEREKKÄISIIN mannerpareihin', () => {
  for (const id of mapIds) {
    const m = MAPS[id];
    const bridges = m.landBridges;
    if (!bridges) continue; // ei pakollinen
    const conts = m.continents;
    // Laske kaikki oikeasti vierekkäiset mannerparit kartalla.
    const adjacentPairs = new Set();
    for (const tid of Object.keys(m.territories)) {
      const t = m.territories[tid];
      for (const n of (t.adj || [])) {
        const nb = m.territories[n];
        if (!nb || t.continent === nb.continent) continue;
        adjacentPairs.add([t.continent, nb.continent].sort().join('|'));
      }
    }
    for (const key of bridges) {
      const [a, b] = key.split('|');
      // (a) molemmat mannerid:t ovat olemassa
      assert.ok(conts[a], `${id}: landBridge tuntematon manner '${a}' (${key})`);
      assert.ok(conts[b], `${id}: landBridge tuntematon manner '${b}' (${key})`);
      // (b) avain on aakkosjärjestyksessä (muuten set-vertailu ei osu)
      assert.equal(key, [a, b].sort().join('|'), `${id}: landBridge-avain ei aakkosjärjestyksessä: ${key}`);
      // (c) parit ovat oikeasti vierekkäisiä (muuten silta ei tee mitään)
      assert.ok(adjacentPairs.has(key), `${id}: landBridge '${key}' ei ole vierekkäinen mannerpari`);
    }
    // (d) ei duplikaatteja
    assert.equal(new Set(bridges).size, bridges.length, `${id}: landBridges sisältää duplikaatteja`);
  }
});
