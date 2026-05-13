const CACHE_NAME = 'worker-portal-v1';
const ASSETS_TO_CACHE = [
  '/worker-portal',
  '/worker-manifest.json',
  '/worker-icon-192.png',
  '/worker-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Simple cache-first strategy for assets, network-first for pages
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
