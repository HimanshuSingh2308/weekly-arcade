const CACHE_NAME = 'weekly-arcade-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/games/wordle/',
  '/games/wordle/index.html',
  '/games/memory-match/',
  '/games/memory-match/index.html',
  '/games/chaos-kitchen/',
  '/games/chaos-kitchen/index.html'
];

// Install - cache assets (don't skipWaiting automatically, let user decide)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Listen for skip waiting message from client
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        // Cache new requests
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (e.request.mode === 'navigate') {
        return caches.match('/');
      }
    })
  );
});
