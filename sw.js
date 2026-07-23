/* Admas University 2026 Yearbook - Service Worker
   Strategy:
   - App shell (html/css/js): cache-first, versioned cache name so a deploy
     with a bumped CACHE_VERSION cleanly replaces old assets.
   - Page/thumb images: stale-while-revalidate, with the runtime cache
     trimmed to MAX_IMAGE_ENTRIES so mobile storage doesn't grow unbounded
     across a 307-page magazine.
*/
const CACHE_VERSION = "v1";
const SHELL_CACHE = `admas-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `admas-images-${CACHE_VERSION}`;
const MAX_IMAGE_ENTRIES = 80;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // FIFO eviction - oldest requests fetched first are dropped first
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
  }
}

function isImageRequest(request) {
  return request.destination === "image" || /\/images\/(pages|thumbs)\//.test(request.url);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
              trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // App shell: cache-first, falling back to network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
