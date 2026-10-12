// Include chunks requested before the worker controlled the first visit.
importScripts('/offline-assets.js');

const CACHE_NAME = `safi-offline-${self.SAFI_BUILD_ID}`;
const STATIC_ASSETS = [
  '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png',
  ...self.SAFI_OFFLINE_ASSETS,
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shell = await fetch('/', { cache: 'reload' });
    if (!shell.ok || !shell.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Could not download the SAFI app shell');
    }
    // Keep the previous worker if any required file fails during an update.
    await cache.addAll(STATIC_ASSETS);
    await cache.put('/', shell);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      (name.startsWith('safi-offline-') || /^safi-v\d+$/.test(name)) && name !== CACHE_NAME
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Audio stays in IndexedDB. APIs and RSC responses must never become HTML.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || request.headers.get('RSC') === '1' ||
      url.searchParams.has('_rsc')) return;

  if (request.mode === 'navigate') {
    // SAFI's views all live at /. Only use that shell for the home route.
    if (url.pathname !== '/') return;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match('/');
      // Opening the app never waits for a slow/unavailable connection. Updates
      // install a complete shell + asset set through the worker lifecycle.
      if (shell) return shell;
      try { return await fetch(request); } catch {
        return new Response('Open SAFI online once to enable offline listening.', {
          status: 503, headers: { 'Content-Type': 'text/plain' },
        });
      }
    })());
    return;
  }

  const isAsset = url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json' ||
    request.destination === 'image' || request.destination === 'font';
  if (!isAsset) return;

  const response = (async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const network = await fetch(request);
    if (network.ok) await cache.put(request, network.clone());
    return network;
  })();
  event.respondWith(response);
  // Finish cache writes even if the page closes.
  event.waitUntil(response.then(() => {}).catch(() => {}));
});
