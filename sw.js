// Offline cache. Bump VERSION whenever any file below changes so phones pick up the update.
const VERSION = "phc-planner-v27";
const FILES = [
  "./", "index.html", "app.js", "engine.js", "logistics.js", "products.js", "report.js", "sitemap.js", "photos.js", "zip.js", "geo.js", "gps.js", "mapview.js", "plans.js", "manifest.webmanifest",
  "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js",
  "data/knowledge_base.json", "data/bases.json", "data/products.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first so the app opens instantly with no signal; updates arrive via a new VERSION.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Satellite tiles go straight to the network and are never stored, so they can't fill the phone's storage.
  if (new URL(e.request.url).hostname === "server.arcgisonline.com") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
