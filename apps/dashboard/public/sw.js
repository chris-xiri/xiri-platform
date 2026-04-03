// XIRI Dashboard — Minimal Service Worker for PWA install support
// This enables the browser's "Add to Home Screen" / "Install" prompt

const CACHE_NAME = 'xiri-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Network-first strategy — only intercept same-origin navigation/resource requests
self.addEventListener('fetch', (event) => {
  // Skip non-HTTP(S) requests (e.g. chrome-extension://) and cross-origin
  if (!event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(fetch(event.request));
});
