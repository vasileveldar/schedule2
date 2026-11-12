'use strict';
const CACHE = 'teacher-schedule-24c351318c5d';
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/clock.js",
  "./js/app.js",
  "./data/schedule.json",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./assets/kiriki-squish.png",
  "./assets/kiriki-closeup.png",
  "./assets/dymka-portraits.png",
  "./assets/kiriki-yawn.png",
  "./assets/cat-meow.mp3"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
// Сначала сеть (всегда свежее расписание), без сети — копия из кэша.
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url), scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(
    fetch(request, { cache: 'no-cache' }).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(request, { ignoreSearch: true }).then(hit => hit || (request.mode === 'navigate' ? cache.match('./index.html') : undefined))))
  );
});
