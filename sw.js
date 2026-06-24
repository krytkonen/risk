// Service Worker: offline-tuki (sovelluskuori välimuistissa). Mahdollistaa
// pelin asentamisen Android-puhelimeen ja pelaamisen ilman verkkoa.
const CACHE = 'risk-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/data/territories.js',
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
