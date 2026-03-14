// XIRI Dashboard — Minimal Service Worker for PWA install support
// This enables the browser's "Add to Home Screen" / "Install" prompt

const CACHE_NAME = 'xiri-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Network-first strategy — always fetch from network, no offline caching
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
