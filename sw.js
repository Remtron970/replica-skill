// Parley service worker: makes the app installable and usable offline.
// Model weights are cached by WebLLM itself (Cache API); this only handles the app shell
// and the WebLLM engine script.
const VERSION = "parley-v1";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./vendor/marked.esm.js", "./vendor/purify.es.mjs",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon.svg",
];
const ENGINE_HOST = "cdn.jsdelivr.net";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("parley-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App shell: serve from cache instantly, refresh in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const key = req.mode === "navigate" ? "./index.html" : req;
        const cached = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
        const network = fetch(req)
          .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // The WebLLM engine script is versioned and immutable: cache it once.
  if (url.hostname === ENGINE_HOST) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
  }
  // Everything else (model downloads, Ollama) goes straight to the network.
});
