/**
 * هندسها | HANDASHA - Service Worker
 * Handles caching, offline support, and app shell management.
 */

const CACHE_NAME = 'handasha-v4';

// App shell files to cache on install
const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  // CSS
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  // Core JS & DB
  './js/app.js',
  './js/router.js',
  './js/db/database.js',
  './js/db/migrations.js',
  // Modules
  './js/modules/dashboard.js',
  './js/modules/subjects.js',
  './js/modules/files.js',
  './js/modules/schedule.js',
  './js/modules/tasks.js',
  './js/modules/exams.js',
  './js/modules/calendar.js',
  './js/modules/more.js',
  './js/modules/notes.js',
  './js/modules/focus-timer.js',
  './js/modules/flashcards.js',
  './js/modules/quizzes.js',
  './js/modules/mindmaps.js',
  './js/modules/calculator.js',
  './js/modules/statistics.js',
  './js/modules/backup.js',
  './js/modules/settings.js',
  './js/modules/notifications.js',
  './js/modules/onboarding.js',
  // Utils
  './js/utils/dates.js',
  './js/utils/validation.js',
  './js/utils/formatting.js',
  './js/utils/icons.js',
  './js/utils/ui.js',
  './js/utils/theme.js',
  // Assets
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/images/splash.svg'
];

// ──────────────────────────────────────────────
// Install: cache the app shell
// ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Use addAll for critical files; if any fail, install fails
        // We catch individual failures so missing optional assets don't block install
        return Promise.allSettled(
          APP_SHELL_FILES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
      })
  );
  // Force the waiting service worker to become the active one
  self.skipWaiting();
});

// ──────────────────────────────────────────────
// Activate: clean up old caches
// ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name.startsWith('handasha-'))
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated and claimed clients');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// ──────────────────────────────────────────────
// Fetch: network-first for navigation, cache-first for assets
// ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests (POST, PUT, etc.)
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // All other requests (CSS, JS, images, icons): cache-first
  event.respondWith(cacheFirstAssets(request));
});

/**
 * Network-first strategy for navigation requests.
 * Falls back to cached index.html for offline support.
 */
async function networkFirstNavigation(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    // If successful, update the cache
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Fall back to cached index.html for SPA routing
    const fallback = await caches.match('./index.html');
    if (fallback) {
      return fallback;
    }
    // Last resort: return a basic offline page
    return new Response(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>غير متصل</title></head>' +
      '<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#F5F7FB;color:#28449F;">' +
      '<div style="text-align:center"><h1>📡 غير متصل بالإنترنت</h1><p>يرجى التحقق من اتصالك بالإنترنت</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Cache-first strategy for static assets.
 * Falls back to network if not in cache, then caches the response.
 */
async function cacheFirstAssets(request) {
  // Check cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Not in cache, try network
  try {
    const networkResponse = await fetch(request);
    // Cache successful responses for future use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Both cache and network failed
    console.warn(`[SW] Fetch failed for: ${request.url}`, error);
    // Return a transparent pixel for images
    if (request.destination === 'image') {
      return new Response(
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    // Return empty response for other assets
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

// ──────────────────────────────────────────────
// Message handler for skip waiting trigger
// ──────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
