// Cache version - increment this on each deployment
const CACHE_VERSION = 11;
const CACHE_NAME = `weekly-arcade-v${CACHE_VERSION}`;

// Core assets to pre-cache
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/leaderboard/',
  '/leaderboard/index.html',
  '/games/wordle/',
  '/games/wordle/index.html',
  '/games/memory-match/',
  '/games/memory-match/index.html',
  '/games/chaos-kitchen/',
  '/games/chaos-kitchen/index.html',
  '/games/snake/',
  '/games/snake/index.html',
  '/games/2048/',
  '/games/2048/index.html',
  '/games/lumble/',
  '/games/lumble/index.html',
  '/games/fieldstone/',
  '/games/fieldstone/index.html',
  '/games/solitaire-roguelite/',
  '/games/solitaire-roguelite/index.html',
  '/games/coin-cascade/',
  '/games/coin-cascade/index.html'
];

// Install - cache assets (don't skipWaiting automatically, let user decide)
self.addEventListener('install', (e) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith('weekly-arcade-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Listen for skip waiting message from client
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
});

// Fetch - Network-first for HTML, Cache-first for assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-first for HTML pages (ensures fresh content)
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Cache the fresh response
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline - serve from cache
          return caches.match(e.request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Cache-first for other assets (JS, CSS, images)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        // Return cache but also fetch fresh copy in background
        fetch(e.request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }

      // Not in cache - fetch from network
      return fetch(e.request).then((response) => {
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation
      if (e.request.mode === 'navigate') {
        return caches.match('/');
      }
    })
  );
});
