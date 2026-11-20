// Choudo's service worker: lets the installed app open offline. Everything the app
// needs is static (the data is in the bundle; the user's data is in localStorage).
// Registered only by the production build (src/ui/registerServiceWorker.ts).
//
// The build replaces the BUILD line below (build/serviceWorker.ts) with this build's
// cache name and the files to precache: the page, manifest, icons, code and fonts. So
// the app opens offline from its first launch, and every deploy gets a new cache; the
// old ones are deleted when the new worker takes over.
//
// - Page loads: network first, so a new deploy shows up on the next open; the precached
//   page when offline.
// - Garment photos: network first (a re-cut photo must match the new landmarks in the
//   bundle), cached as they're viewed for offline.
// - Everything else from this site: this build's cache first, else the network.
// - Other sites: not touched.

const BUILD = { cache: 'choudo-dev', precache: ['./'] };

// Every file here is static, so a cached copy fits any request for its URL. Without
// ignoreVary a module script (sent with an Origin header) misses a copy cached without
// one whenever the server says "Vary: Origin".
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(BUILD.cache)
      .then((cache) => cache.addAll(BUILD.precache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('choudo-') && k !== BUILD.cache).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Fetches, and stores a good same-site response in this build's cache. */
function fetchAndKeep(request) {
  return fetch(request).then((response) => {
    if (response.status === 200 && response.type === 'basic') {
      const copy = response.clone();
      caches
        .open(BUILD.cache)
        .then((cache) => cache.put(request, copy))
        .catch(() => {}); // a full disk only costs the offline copy
    }
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./', { ...MATCH, cacheName: BUILD.cache })));
    return;
  }

  const scope = new URL(self.registration.scope);
  if (url.pathname.startsWith(`${scope.pathname}garments/`)) {
    event.respondWith(fetchAndKeep(request).catch(() => caches.match(request, MATCH)));
    return;
  }

  event.respondWith(caches.match(request, MATCH).then((hit) => hit ?? fetchAndKeep(request)));
});
