// Firebase Cloud Messaging im Service Worker: Compat-SDK per importScripts,
// weil dieser Service Worker als klassisches Skript (nicht als ES-Modul)
// registriert ist. Die Konfiguration ist dieselbe wie in js/firebase-config.js
// (oeffentlich, kein Geheimnis) - hier nochmal eingetragen, weil ein
// "import" aus einer ES-Modul-Datei hier nicht funktioniert.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCo3y-FyFMJ0UhzYXfjFmPDWoLpPgGUzrE",
  authDomain: "kickwatxh.firebaseapp.com",
  projectId: "kickwatxh",
  storageBucket: "kickwatxh.firebasestorage.app",
  messagingSenderId: "254019688686",
  appId: "1:254019688686:web:b84e3e9800d6a792857bff",
});

const messaging = firebase.messaging();

// Zeigt eine Benachrichtigung, wenn die App NICHT im Vordergrund ist
// (Tab geschlossen/im Hintergrund) und eine Push-Nachricht ankommt.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "KickWatch";
  const body = (payload.notification && payload.notification.body) || "";
  self.registration.showNotification(title, {
    body,
    icon: "icons/icon.svg",
  });
});

const CACHE_NAME = "kickwatch-shell-v20";
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
