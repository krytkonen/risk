import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSet, setValue, findSet, buildDeck, shuffle, CARD_TYPES } from '../js/engine/cards.js';
import { makeRng } from '../js/engine/rng.js';
import { TERRITORY_IDS } from '../js/data/territories.js';

const c = (type, territoryId = 't') => ({ type, territoryId });

test('kolme samaa on kelvollinen sarja', () => {
  assert.equal(isValidSet([c('infantry'), c('infantry'), c('infantry')]), true);
});

test('yksi kutakin on kelvollinen sarja', () => {
  assert.equal(isValidSet([c('infantry'), c('cavalry'), c('artillery')]), true);
});

test('jokeri täydentää sarjan', () => {
  assert.equal(isValidSet([c('wild'), c('infantry'), c('cavalry')]), true);
});

test('kaksi samaa + yksi eri ei kelpaa', () => {
  assert.equal(isValidSet([c('infantry'), c('infantry'), c('cavalry')]), false);
});

test('kasvava vaihtoarvo', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(setValue), [4, 6, 8, 10, 12, 15]);
  assert.equal(setValue(6), 20);
  assert.equal(setValue(7), 25);
});

test('findSet löytää kelvollisen sarjan', () => {
  const hand = [c('infantry'), c('cavalry'), c('infantry'), c('artillery')];
  const set = findSet(hand);
  assert.ok(set);
  assert.equal(set.length, 3);
  assert.equal(isValidSet(set.map((i) => hand[i])), true);
});

test('findSet palauttaa null kun sarjaa ei ole', () => {
  const hand = [c('infantry'), c('infantry')];
  assert.equal(findSet(hand), null);
});

test('pakassa on 44 korttia (42 aluetta + 2 jokeria)', () => {
  const deck = buildDeck(TERRITORY_IDS);
  assert.equal(deck.length, 44);
  assert.equal(deck.filter((x) => x.type === 'wild').length, 2);
});

test('sekoitus säilyttää kaikki kortit', () => {
  const deck = buildDeck(TERRITORY_IDS);
  const before = deck.length;
  shuffle(deck, makeRng(7));
  assert.equal(deck.length, before);
});
