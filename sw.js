const SHELL_CACHE = 'sonidos-shell-v1-device-install-20260923';
const BASE = new URL('./', self.location.href);
const SHELL = ['index.html', 'install/index.html', 'branding/caceta-de-golira.webp', 'styles.css', 'app.js', 'installer.js', 'installer.css', 'catalog.js', 'manifest.webmanifest', 'icons/icon-192.png?v=logo-20260921', 'icons/icon-512.png?v=logo-20260921', 'icons/icon-192-maskable.png?v=logo-20260921', 'icons/icon-512-maskable.png?v=logo-20260921', 'icons/apple-touch-icon.png?v=logo-20260921'].map((path) => new URL(path, BASE).href);
self.addEventListener('install', (event) => event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('sonidos-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (url.pathname.endsWith('.mobileconfig')) return;
  if (request.mode === 'navigate') {
    const rootIndex = new URL('index.html', BASE).href;
    const installPath = new URL('install/', BASE).pathname;
    const cacheKey = url.pathname === BASE.pathname || url.pathname === new URL('index.html', BASE).pathname
      ? rootIndex
      : url.pathname === installPath || url.pathname === installPath + 'index.html'
        ? new URL('install/index.html', BASE).href
        : new URL(url.pathname, BASE.origin).href;
    event.respondWith(fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(cacheKey, copy))); } return response; }).catch(async () => (await caches.match(cacheKey)) || (await caches.match(rootIndex))));
    return;
  }
  const isShell = SHELL.includes(url.href) || url.pathname === new URL('data.json', BASE).pathname;
  const isThumbnail = ['thumbs/', 'thumbnails/'].some((path) => url.pathname.startsWith(new URL(path, BASE).pathname));
  if (!isShell && !isThumbnail) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))); }
    return response;
  }).catch(async () => (await caches.match(request)) || new Response('', { status: 503 })));
});
