// Service worker de El Snap: guarda la app para que funcione sin internet y se actualiza sola en segundo plano.
const VERSION = 'elsnap-v2';
const FONTS = 'elsnap-fonts';
const SHELL = [
    './',
    'index.html',
    'css/app.css',
    'js/app.js',
    'js/plays.js',
    'js/field.js',
    'js/game.js',
    'js/catalog.js',
    'js/nfl.js',
    'manifest.webmanifest',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/maskable-512.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Responde con lo guardado y actualiza en segundo plano (stale-while-revalidate)
const fresh = (cacheName, request) =>
    caches.open(cacheName).then(async (cache) => {
        const hit = await cache.match(request, { ignoreSearch: true });
        const net = fetch(request)
            .then((res) => {
                if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
                return res;
            })
            .catch(() => hit);
        return hit || net;
    });

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(fresh(FONTS, request));
        return;
    }
    if (url.origin !== self.location.origin) return;
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match('index.html')));
        return;
    }
    event.respondWith(fresh(VERSION, request));
});
