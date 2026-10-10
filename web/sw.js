// Offline cache. Bump VERSION whenever any file below changes so phones pick up the update.
const VERSION = "phc-planner-v15";
const FILES = [
  "./", "index.html", "app.js", "engine.js", "logistics.js", "products.js", "manifest.webmanifest",
  "data/knowledge_base.json", "data/bases.json", "data/products.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first so the app opens instantly with no signal; updates arrive via a new VERSION.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
