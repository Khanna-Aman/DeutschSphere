// sw.js — Service Worker for DeutschSphere (A1-B1 German)
// Strategy: Cache-first for static assets, stale-while-revalidate for CDN resources.
// NOTE: This SW only activates on HTTPS origins (GitHub Pages). It cannot run on file://.

// CACHE_VERSION controls the app SHELL + CDN caches (HTML/CSS/JS/icons/fonts).
// Bump it whenever code or static assets change. DATA freshness (wordlist JSON) is
// handled independently by WORDLIST_CACHE_VERSION in app.js, which is appended as a
// ?v= query param so cache-first DATA_CACHE entries are bypassed on a data change —
// so a data-only update does NOT require bumping CACHE_VERSION, and vice versa.
const CACHE_VERSION = 'v7.2.1'; // v7.2.1: removed the now-dead console.warn override that suppressed the Tailwind CDN advisory
const STATIC_CACHE = `deutschsphere-static-${CACHE_VERSION}`;
const DATA_CACHE = `deutschsphere-data-${CACHE_VERSION}`;
const CDN_CACHE = `deutschsphere-cdn-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './index.css',
  './tailwind.css',
  './app.js',
  './js/foic-preinit.js',
  './js/state.js',
  './js/audio.js',
  './js/flashcards.js',
  './js/quiz.js',
  './js/fsrs.js',
  './js/nlp.js',
  './js/immersion.js',
  './js/idb-keyval.js',
  './js/telemetry.js',
  './js/events.js',
  './js/router.js',
  './js/search.js',
  './js/phoneme_guides.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: precache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => (name.startsWith('german-master-') || name.startsWith('deutschsphere-')) && name !== STATIC_CACHE && name !== DATA_CACHE && name !== CDN_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
      .then(() => {
        // Broadcast to all open tabs that a new version is now active
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION }));
        });
      })
  );
});

// Fetch: route requests to appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Strategy 1: CACHE-FIRST for vocabulary JSON data files (rarely change)
  if (url.pathname.endsWith('.json') && (url.pathname.includes('/a1/') || url.pathname.includes('/a2/') || url.pathname.includes('/b1/'))) {
    event.respondWith(
      caches.open(DATA_CACHE).then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Strategy 2: CACHE-FIRST for SVG/image assets (Twemoji, WebP illustrations)
  if (url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.webp')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => new Response('', { status: 404 }));
        });
      })
    );
    return;
  }

  // Strategy 3: STALE-WHILE-REVALIDATE for CDN resources (Tailwind, FontAwesome, Google Fonts)
  if (url.hostname !== location.hostname) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache => {
        return cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 4: CACHE-FIRST for app shell files, NETWORK fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && url.pathname !== '/sw.js') {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback: serve index.html for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('Offline', { status: 503 });
    })
  );
});

// Dynamic background pre-caching message router & skip waiting listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'PRECACHE_RESOURCES') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(DATA_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            const cached = await cache.match(url);
            if (!cached) {
              await cache.add(url);
              // Small yield of 50ms to keep network and main thread smooth
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (err) {
            console.warn('[SW] Dynamic background precache failed for URL:', url, err);
          }
        }
      })
    );
  }
});

