// Firebase Cloud Messaging for push notifications
// Wrapped in try-catch so FCM failures don't kill the entire service worker
try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: 'AIzaSyAFA4KwOaQpa0A-v2auCulStCrOgScrz-g',
    projectId: 'loyal-curve-425715-h6',
    messagingSenderId: '5171085645',
    appId: '1:5171085645:web:b01fbc558d626f649e3704',
  });

  const messaging = firebase.messaging();

  // Handle background push messages (when app is not in focus)
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const notification = payload.notification || {};

    self.registration.showNotification(notification.title || 'Weekly Arcade', {
      body: notification.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.type || 'default',
      data: data,
      sound: '/sounds/notification.wav',
    });
  });
} catch (e) {
  console.warn('[SW] Firebase messaging setup failed:', e);
}

// Handle notification clicks — route to relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  let url = '/';
  if (data.type === 'new_game' && data.gameId) {
    url = `/games/${data.gameId}/`;
  } else if (data.type === 'leaderboard_update') {
    url = '/leaderboard/';
  } else if (data.type === 'achievement_unlocked') {
    url = '/profile/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Cache version - increment this on each deployment
const CACHE_VERSION = 36;
const CACHE_NAME = `weekly-arcade-v${CACHE_VERSION}`;

// Core assets to pre-cache
const ASSETS = [
  // Shell
  '/',
  '/index.html',
  '/manifest.json',

  // Shared JS
  '/js/api-client.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/game-cloud.js',
  '/js/game-header.js',
  '/js/notification-manager.js',
  '/js/multiplayer-client.js',
  '/js/multiplayer-ui.js',

  // Pages
  '/leaderboard/',
  '/leaderboard/index.html',

  // Games — pages
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
  '/games/voidbreak/',
  '/games/voidbreak/index.html',
  '/games/stack-tower/',
  '/games/stack-tower/index.html',
  '/games/solitaire-roguelite/',
  '/games/solitaire-roguelite/index.html',
  '/games/coin-cascade/',
  '/games/coin-cascade/index.html',
  '/games/tiny-tycoon/',
  '/games/tiny-tycoon/index.html',
  '/games/cricket-blitz/',
  '/games/cricket-blitz/index.html',
  '/games/chess-3d/',
  '/games/chess-3d/index.html',

  // Chess 3D assets (heavy — loaded separately)
  '/games/chess-3d/game.js',
  '/games/chess-3d/styles.css',
  '/games/chess-3d/themes.js',
  '/games/chess-3d/skins.js',
  '/games/chess-3d/puzzles.js',
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

  // Only handle http/https requests — skip chrome-extension://, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

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
