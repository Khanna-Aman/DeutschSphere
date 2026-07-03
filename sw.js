// sw.js — Service Worker for DeutschSphere (A1-B1 German)
// Strategy: Cache-first for static assets. All fonts/icons are now self-hosted
// (no third-party CDNs), so the app is genuinely offline-capable after first load.
// NOTE: This SW only activates on HTTPS origins (GitHub Pages). It cannot run on file://.

// CACHE_VERSION controls the app SHELL cache (HTML/CSS/JS/icons/fonts).
// Bump it whenever code or static assets change. DATA freshness (wordlist JSON) is
// handled independently by WORDLIST_CACHE_VERSION in app.js, which is appended as a
// ?v= query param so cache-first DATA_CACHE entries are bypassed on a data change —
// so a data-only update does NOT require bumping CACHE_VERSION, and vice versa.
const CACHE_VERSION = 'v7.5.4'; // v7.5.4: post-launch hardening — CSP tightening; a11y labels/alt; SW cleanup (drop dead CDN strategy, fix sw.js guard)
const STATIC_CACHE = `deutschsphere-static-${CACHE_VERSION}`;
const DATA_CACHE = `deutschsphere-data-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './index.css',
  './tailwind.css',
  './fonts/fontawesome.min.css',
  './fonts/google-fonts.css',
  './app.js',
  './js/foic-preinit.js',
  './js/state.js',
  './js/audio.js',
  './js/flashcards.js',
  './js/phonetics.js',
  './js/backup.js',
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
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
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
          .filter(name => (name.startsWith('german-master-') || name.startsWith('deutschsphere-')) && name !== STATIC_CACHE && name !== DATA_CACHE)
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

  // Skip cross-origin requests entirely — everything the app loads is self-hosted
  // (the only cross-origin call is the FormSubmit feedback POST, non-GET anyway).
  // Let the browser handle any stray cross-origin GET natively, uncached.
  if (url.origin !== location.origin) return;

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

  // Strategy 3: CACHE-FIRST for app shell files, NETWORK fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Never cache the SW script itself (endsWith: the app is served from a
        // subpath on GitHub Pages, so an absolute '/sw.js' compare never matches).
        if (response.ok && !url.pathname.endsWith('/sw.js')) {
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

