const SHELL_CACHE = 'sonidos-shell-v3';
const BASE = new URL('./', self.location.href);
const SHELL = ['index.html', 'styles.css', 'app.js', 'catalog.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-192-maskable.png', 'icons/icon-512-maskable.png', 'icons/apple-touch-icon.png'].map((path) => new URL(path, BASE).href);
self.addEventListener('install', (event) => event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('sonidos-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(new URL('index.html', BASE).href, copy))); } return response; }).catch(() => caches.match(new URL('index.html', BASE).href)));
    return;
  }
  const isShell = SHELL.includes(url.href) || url.pathname === new URL('data.json', BASE).pathname;
  const isThumbnail = url.pathname.startsWith(new URL('thumbs/', BASE).pathname);
  if (!isShell && !isThumbnail) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))); }
    return response;
  }).catch(async () => (await caches.match(request)) || new Response('', { status: 503 })));
});
