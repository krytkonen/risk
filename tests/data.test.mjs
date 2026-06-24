import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERRITORIES, TERRITORY_IDS, CONTINENTS, continentTerritories, adjacencyIsSymmetric } from '../js/data/territories.js';

test('kartalla on tasan 42 aluetta', () => {
  assert.equal(TERRITORY_IDS.length, 42);
});

test('kartalla on 6 mannerta', () => {
  assert.equal(Object.keys(CONTINENTS).length, 6);
});

test('naapuruussuhteet ovat symmetrisiä ja viittaavat olemassa oleviin alueisiin', () => {
  const r = adjacencyIsSymmetric();
  assert.equal(r.ok, true, r.reason);
});

test('jokaisella alueella on vähintään yksi naapuri', () => {
  for (const id of TERRITORY_IDS) {
    assert.ok(TERRITORIES[id].adj.length >= 1, `${id} ilman naapureita`);
  }
});

test('manneralueiden summa on 42', () => {
  const total = Object.keys(CONTINENTS).reduce((s, c) => s + continentTerritories(c).length, 0);
  assert.equal(total, 42);
});

test('koko kartta on yhtenäinen (kaikki saavutettavissa)', () => {
  const seen = new Set([TERRITORY_IDS[0]]);
  const q = [TERRITORY_IDS[0]];
  while (q.length) {
    const cur = q.shift();
    for (const n of TERRITORIES[cur].adj) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  assert.equal(seen.size, 42, 'kartta ei ole yhtenäinen');
});

test('mannerbonukset ovat klassiset', () => {
  assert.equal(CONTINENTS['north-america'].bonus, 5);
  assert.equal(CONTINENTS['south-america'].bonus, 2);
  assert.equal(CONTINENTS['europe'].bonus, 5);
  assert.equal(CONTINENTS['africa'].bonus, 3);
  assert.equal(CONTINENTS['asia'].bonus, 7);
  assert.equal(CONTINENTS['australia'].bonus, 2);
});
