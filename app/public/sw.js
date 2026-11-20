// Choudo's service worker: lets the installed app open offline. Everything the app
// needs is static (the data is in the bundle; the user's data is in localStorage), so
// caching what it fetches is enough. Registered only by the production build
// (src/ui/registerServiceWorker.ts). Bump CACHE when this file's logic changes.
//
// - Page loads: network first, so a new deploy shows up on the next open; the cached
//   page when offline.
// - Hashed build files (assets/): cache first. A new deploy has new names.
// - Everything else from this site (icons, manifest, garment photos): the cached copy at
//   once, refreshed in the background.
// - Other sites: not touched.

const CACHE = 'choudo-v1';
const SHELL = ['./', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('choudo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Stores a good same-site response; passes it through either way. */
function keep(request, response) {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => keep(request, response))
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }

  const scope = new URL(self.registration.scope);
  if (url.pathname.startsWith(`${scope.pathname}assets/`)) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((response) => keep(request, response))));
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((response) => keep(request, response))
        .catch(() => hit);
      if (hit) {
        event.waitUntil(fresh);
        return hit;
      }
      return fresh;
    }),
  );
});
