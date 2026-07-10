// Service Worker: offline-tuki (sovelluskuori välimuistissa).
//
// Strategia:
// - Navigointipyynnöt (sivun avaus): verkko ensin, välimuisti varalla.
//   Näin asennettu sovellus saa aina tuoreimman version kun verkko toimii.
// - Muut saman originin GET-pyynnöt (JS/CSS/kuvat): välimuisti ensin ja
//   päivitys taustalla (stale-while-revalidate). Jos haku epäonnistuu eikä
//   välimuistissa ole mitään, palautetaan virhe — EI KOSKAAN index.html:ää
//   aliresurssina (HTML JavaScriptinä kaataisi koko sovelluksen).
// HUOM: kasvata versiota (risk-vN) aina kun sovelluslogiikka muuttuu → uusi SW
// asennetaan, esiväli­muisti haetaan tuoreena ja vanha välimuisti poistetaan,
// jotta myös asennettu PWA (esim. iOS) saa muutokset heti eikä vasta seuraavalla
// avauksella. Pidä ASSETS ajan tasalla (kaikki kartat mukana → offline-tuki).
const CACHE = 'risk-v33';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/map-theme.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/data/territories.js',
  './js/data/scenarios.js',
  './js/data/maps/_util.js',
  './js/data/geo/world-land.js',
  './js/data/geo/africa-land.js',
  './js/data/geo/europe-land.js',
  './js/data/geo/eu2025-land.js',
  './js/data/geo/antiquity-land.js',
  './js/data/geo/taru-land.js',
  './js/data/geo/asia-land.js',
  './js/data/maps/classic.js',
  './js/data/maps/europe.js',
  './js/data/maps/antiquity.js',
  './js/data/maps/nato.js',
  './js/data/maps/suurmaailma.js',
  './js/data/maps/taruvaltakunnat.js',
  './js/data/maps/africa.js',
  './js/data/maps/aasia.js',
  './js/engine/rng.js',
  './js/engine/combat.js',
  './js/engine/cards.js',
  './js/engine/game.js',
  './js/engine/ai.js',
  './js/ui/render.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Tallenna vastaus välimuistiin (vain onnistuneet perusvastaukset). */
function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ulkoiset menevät suoraan

  // Sivun avaus: verkko ensin (tuore versio), välimuisti varalla (offline).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { putInCache(req, res); return res; })
        .catch(() => caches.match('./index.html', { cacheName: CACHE }))
    );
    return;
  }

  // Aliresurssit: välimuisti heti, päivitys taustalla.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => { putInCache(req, res); return res; });
      if (cached) {
        // Päivitä taustalla; virheet taustapäivityksessä eivät haittaa.
        e.waitUntil(network.catch(() => {}));
        return cached;
      }
      // Ei välimuistissa: palauta verkon vastaus tai REHELLINEN virhe.
      // (Ei index.html-fallbackia aliresursseille!)
      return network.catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
