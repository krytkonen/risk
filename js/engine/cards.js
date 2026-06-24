// Risk-kortit. Kortteja on kolmea sotilastyyppiä (jalkaväki, ratsuväki,
// tykistö) sekä kaksi jokerikorttia. Kolmen kortin sarja vaihdetaan
// armeijoiksi: 3 samaa, 3 erilaista tai jokeri mukana.

export const CARD_TYPES = ['infantry', 'cavalry', 'artillery'];

// Vaihtosarjojen kasvava arvo (klassinen "escalating"): 4,6,8,10,12,15,
// sitten +5 jokaisesta seuraavasta.
export function setValue(setsTradedSoFar) {
  const seq = [4, 6, 8, 10, 12, 15];
  if (setsTradedSoFar < seq.length) return seq[setsTradedSoFar];
  return 15 + (setsTradedSoFar - seq.length + 1) * 5;
}

/** Onko kolmen kortin joukko kelvollinen vaihtosarja? */
export function isValidSet(cards) {
  if (!cards || cards.length !== 3) return false;
  const wilds = cards.filter((c) => c.type === 'wild').length;
  const types = cards.filter((c) => c.type !== 'wild').map((c) => c.type);
  if (wilds >= 1) return true; // jokeri täydentää aina
  const uniq = new Set(types);
  if (uniq.size === 1) return true; // kolme samaa
  if (uniq.size === 3) return true; // yksi kutakin
  return false;
}

/**
 * Etsii ensimmäisen kelvollisen kolmen kortin sarjan kädestä (käytetään
 * tekoälyssä ja "vaihda automaattisesti" -toiminnossa). Palauttaa korttien
 * indeksit tai null.
 */
export function findSet(hand) {
  const n = hand.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        if (isValidSet([hand[i], hand[j], hand[k]])) return [i, j, k];
      }
  return null;
}

/** Rakentaa pelin korttipakan. 42 aluekorttia + 2 jokeria. */
export function buildDeck(territoryIds) {
  const deck = territoryIds.map((territoryId, idx) => ({
    territoryId,
    type: CARD_TYPES[idx % 3],
  }));
  deck.push({ territoryId: null, type: 'wild' });
  deck.push({ territoryId: null, type: 'wild' });
  return deck;
}

/** Sekoittaa pakan paikallaan annetulla rng:llä (Fisher–Yates). */
export function shuffle(deck, rng) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
