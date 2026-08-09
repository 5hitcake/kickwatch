const CACHE_NAME = "kickwatch-shell-v14";
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/app.js",
  "js/auth.js",
  "js/favorites.js",
  "js/team-search.js",
  "js/firebase-config.js",
  "js/firebase-init.js",
  "icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Network-first UND am normalen HTTP-Cache des Browsers vorbei
// (cache: "no-store") - waehrend der aktiven Entwicklung soll wirklich
// immer die neueste Version vom Server kommen, nicht aus irgendeinem
// Zwischenspeicher. Nur wenn das Netzwerk gar nicht erreichbar ist,
// greift der Service-Worker-Cache als Offline-Fallback.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
