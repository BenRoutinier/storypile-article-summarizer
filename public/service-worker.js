// =============================================================================
// StoryPile Service Worker
// Handles PWA installation and offline caching
// =============================================================================

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  pages: `storypile-pages-${CACHE_VERSION}`,
  assets: `storypile-assets-${CACHE_VERSION}`,
  images: `storypile-images-${CACHE_VERSION}`
};

// App shell - critical assets to cache immediately on install
const APP_SHELL = [
  '/offline/index.html',
  '/offline/show.html',
  '/offline/render_index.js',
  '/offline/render_show.js'
];

// External dependencies for offline shell pages
const EXTERNAL_DEPS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Patterns for routing decisions
const PATTERNS = {
  // Match /articles or /articles/
  articlesIndex: /^\/articles\/?$/,
  // Match /articles/123 but NOT /articles/123/card or /articles/123/anything
  articlesShow: /^\/articles\/(\d+)\/?$/,
  // Match /articles/123/card
  articlesCard: /^\/articles\/(\d+)\/card\/?$/,
  // Match asset files
  assets: /\.(css|js|woff2?|ttf|eot)(\?|$)/i,
  // Match images
  images: /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?|$)/i,
  // Match API calls
  api: /^\/api\//
};

// =============================================================================
// INSTALL EVENT
// Cache the app shell
// =============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache app shell pages
      caches.open(CACHE_NAMES.pages).then((cache) => {
        console.log('[SW] Caching app shell');
        return Promise.allSettled(
          APP_SHELL.map(url => 
            cache.add(url).catch(err => {
              console.log(`[SW] Could not cache ${url}:`, err.message);
            })
          )
        );
      }),
      // Cache external dependencies (Bootstrap, Font Awesome)
      caches.open(CACHE_NAMES.assets).then((cache) => {
        console.log('[SW] Caching external dependencies');
        return Promise.allSettled(
          EXTERNAL_DEPS.map(url =>
            fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(err => {
                console.log(`[SW] Could not cache ${url}:`, err.message);
              })
          )
        );
      })
    ]).then(() => {
      console.log('[SW] App shell cached, skipping waiting');
      return self.skipWaiting();
    })
  );
});

// =============================================================================
// ACTIVATE EVENT
// Clean up old caches
// =============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            const isCurrentCache = Object.values(CACHE_NAMES).includes(cacheName);
            if (!isCurrentCache) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// =============================================================================
// FETCH EVENT
// Route requests to appropriate caching strategies
// =============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Only handle same-origin requests (except for images)
  const isSameOrigin = url.origin === location.origin;
  
  // Determine the caching strategy based on the request
  if (isSameOrigin && PATTERNS.api.test(url.pathname)) {
    // API requests: Network only
    event.respondWith(networkOnly(request));
  }
  else if (isSameOrigin && PATTERNS.assets.test(url.pathname)) {
    // Assets: Cache first, then network
    event.respondWith(cacheFirst(request, CACHE_NAMES.assets));
  }
  else if (PATTERNS.images.test(url.pathname) || PATTERNS.images.test(url.href)) {
    // Images (including external): Cache first, then network
    event.respondWith(cacheFirstForImages(request));
  }
  else if (isSameOrigin && PATTERNS.articlesIndex.test(url.pathname)) {
    // Articles index: Network first, fallback to cache, then offline shell
    event.respondWith(networkFirstForArticles(request, url.pathname, '/offline/index.html'));
  }
  else if (isSameOrigin && PATTERNS.articlesShow.test(url.pathname)) {
    // Article show page: Network first, fallback to cache, then offline shell
    event.respondWith(networkFirstForArticles(request, url.pathname, '/offline/show.html'));
  }
  else if (isSameOrigin && PATTERNS.articlesCard.test(url.pathname)) {
    // Article card fragments: Network first, fallback to cache
    event.respondWith(networkFirstForArticles(request, url.pathname, null));
  }
  else if (isSameOrigin && request.mode === 'navigate') {
    // Other navigation requests: Network first with generic offline fallback
    event.respondWith(networkFirstNavigation(request));
  }
  else if (isSameOrigin) {
    // Other same-origin requests: Network first
    event.respondWith(networkFirst(request, CACHE_NAMES.assets));
  }
  // Let other requests (external, etc.) pass through normally
});

// =============================================================================
// CACHING STRATEGIES
// =============================================================================

/**
 * Network only - don't cache, just fetch
 */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('[SW] Network only failed:', request.url);
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Cache first - try cache, then network (for static assets)
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache first failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Cache first for images - handles external images with no-cors
 */
async function cacheFirstForImages(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const url = new URL(request.url);
    const isSameOrigin = url.origin === location.origin;
    
    const fetchOptions = isSameOrigin ? {} : { mode: 'no-cors' };
    const networkResponse = await fetch(request, fetchOptions);
    
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      const cache = await caches.open(CACHE_NAMES.images);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Image fetch failed:', request.url);
    return new Response('', { status: 404 });
  }
}

/**
 * Network first for articles - with explicit cache URL matching
 * This fixes the issue where sync controller caches with URL strings
 * but the service worker was matching with Request objects
 */
async function networkFirstForArticles(request, pathname, fallbackUrl) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.pages);
      // Cache with the pathname to ensure consistent matching
      cache.put(pathname, networkResponse.clone());
      console.log('[SW] Cached from network:', pathname);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for:', pathname);
    
    // Network failed, try to find in cache
    // Open the specific cache and search by pathname
    const cache = await caches.open(CACHE_NAMES.pages);
    
    // Try exact pathname match first
    let cachedResponse = await cache.match(pathname);
    
    // If not found, try with the full URL
    if (!cachedResponse) {
      cachedResponse = await cache.match(request.url);
    }
    
    // If still not found, try with ignoreSearch option
    if (!cachedResponse) {
      cachedResponse = await cache.match(request, { ignoreSearch: true });
    }
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', pathname);
      return cachedResponse;
    }
    
    // No cached version found
    console.log('[SW] No cache found for:', pathname);
    
    // If we have a fallback URL, serve that
    if (fallbackUrl) {
      console.log('[SW] Serving offline shell:', fallbackUrl);
      const fallbackResponse = await cache.match(fallbackUrl);
      
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    
    // Last resort
    return new Response(
      '<html><body><h1>Offline</h1><p>This page is not available offline.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Network first - try network, then cache (for dynamic content)
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] Network first failed, no cache:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network first for navigation - generic pages
 */
async function networkFirstNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.pages);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const offlinePage = await caches.match('/offline/index.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    return new Response(
      '<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// =============================================================================
// MESSAGE HANDLER
// For communication with main thread
// =============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_URLS') {
    const { urls, cacheName } = event.data;
    
    event.waitUntil(
      caches.open(cacheName || CACHE_NAMES.pages)
        .then(cache => {
          return Promise.allSettled(
            urls.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok || response.type === 'opaque') {
                    return cache.put(url, response);
                  }
                })
                .catch(err => {
                  console.log(`[SW] Failed to cache ${url}:`, err.message);
                });
            })
          );
        })
        .then(() => {
          event.source.postMessage({ type: 'CACHE_COMPLETE', urls });
        })
    );
  }
  
  if (event.data && event.data.type === 'DELETE_CACHED_URL') {
    const { url, cacheName } = event.data;
    
    event.waitUntil(
      caches.open(cacheName || CACHE_NAMES.pages)
        .then(cache => cache.delete(url))
        .then(deleted => {
          event.source.postMessage({ type: 'DELETE_COMPLETE', url, deleted });
        })
    );
  }
  
  // Debug helper: list all cached URLs
  if (event.data && event.data.type === 'LIST_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAMES.pages)
        .then(cache => cache.keys())
        .then(requests => {
          const urls = requests.map(r => r.url);
          console.log('[SW] Cached URLs:', urls);
          event.source.postMessage({ type: 'CACHE_LIST', urls });
        })
    );
  }
});

console.log('[SW] Service worker loaded');
