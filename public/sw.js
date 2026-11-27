/*
 * CIRERMS service worker. The server serves this file with the version and the file list filled in (src/pwa.js):
 * the version changes when any file of the app changes, which makes the browser see a new worker.
 *
 * Cached: only the app's own static files (the scripts, the stylesheet, the icon sprite, the images, the icons,
 * the manifest and the offline page), in a cache named for the version. A new version replaces the old cache.
 * Never cached: /api/ answers, PDFs, uploads, documents and photos. They hold personal data and always go to
 * the network. Only a path listed in PRECACHE is ever stored, so nothing else can end up here.
 * Pages (app.html, index.html): network first; with no network, offline.html.
 * A new worker waits until the person presses Reload in the banner (js/core/pwa.js); it then takes over.
 */
const VERSION = '__VERSION__';
const CACHE = 'cirerms-static-' + VERSION;
const PRECACHE = __PRECACHE__;
const OFFLINE = '/offline.html';
const NEVER = /^\/(api|uploads|documents|photos|storage)(\/|$)|\.pdf$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cirerms-static-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.test(url.pathname)) return; // straight to the network

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(url.pathname).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); }
        return res;
      }))
    );
  }
});
