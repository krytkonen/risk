// Siemennettävä satunnaislukugeneraattori (mulberry32). Mahdollistaa
// determinististen testien ja toistettavat pelit. Ei käytä Math.randomia
// suoraan, jotta nopanheitot voidaan testata.

export function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9; // vältä jumiutuminen nollaan
  // Kutsulaskuri (rng.calls) mahdollistaa tallennetun pelin palautuksen:
  // sama siemen + sama määrä "poltettuja" arvontoja = identtinen jatko.
  const rng = function next() {
    rng.calls++;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.calls = 0;
  return rng;
}

/** Heittää nopan 1..6 annetulla rng-funktiolla. */
export function rollDie(rng) {
  return 1 + Math.floor(rng() * 6);
}

/** Luo satunnaisen siemenen ympäristöstä riippumatta. */
export function randomSeed() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}
