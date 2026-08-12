const CACHE_NAME = 'safi-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Audio from R2 → Network first (stream directly, no full cache)
// - App shell → Cache first with network fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // R2 audio: always network (streaming requires byte-range requests)
  if (url.hostname.includes('r2.dev') || url.hostname.includes('cloudflarestorage.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests: network first, fall back to cached index
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then(r => r ?? new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached ?? fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
    )
  );
});
