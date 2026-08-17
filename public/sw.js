const CACHE_NAME = 'safi-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache the core app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Audio streaming from R2/Cloudflare: bypass service worker (offline audio plays from IndexedDB Blob)
  if (url.hostname.includes('r2.dev') || url.hostname.includes('cloudflarestorage.com')) {
    return;
  }

  // 2. Next.js API routes & Supabase backend: network only (offline data is loaded from IndexedDB)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 3. Navigation requests (PWA launch / HTML page)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // If device is completely offline or Safari offline mode, return cached shell instantly with 0ms delay
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/', clone));
            return networkResponse;
          }
        } catch (err) {
          // Network failed or offline: fall back to cached app shell
        }

        const cached = await caches.match('/');
        if (cached) return cached;

        const cachedFallback = await caches.match(event.request);
        if (cachedFallback) return cachedFallback;

        return new Response('Offline - Open app while connected once to enable offline mode.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })()
    );
    return;
  }

  // 4. Static assets (_next/static chunks, CSS, JS, images, fonts): Cache-First with runtime caching
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return null/empty if static asset fetch fails
        return new Response('', { status: 408 });
      });
    })
  );
});
