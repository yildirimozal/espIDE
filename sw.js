// sw.js — Service Worker: cevrimdisi destek + cache-busting.
// GUNCELLEME YAYINLARKEN: APP_VERSION'i artir -> eski cache silinir, yeni varliklar cekilir.
const APP_VERSION = 'v1.3.0';
const CACHE = 'esp32ide-' + APP_VERSION;

// Uygulama kabugu + bagimliliklar + firmware (cevrimdisi flashing icin)
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/serial.js', './js/flash.js', './js/boards.js',
  './js/pinout.js', './js/editor.js', './js/terminal.js', './js/files.js', './js/plotter.js', './js/i18n.js', './js/wireless.js',
  './vendor/codemirror/codemirror.min.js', './vendor/codemirror/codemirror.min.css',
  './vendor/codemirror/python.min.js', './vendor/codemirror/material-darker.min.css',
  './vendor/codemirror/matchbrackets.min.js',
  './vendor/xterm/xterm.min.js', './vendor/xterm/xterm.min.css', './vendor/xterm/xterm-addon-fit.min.js',
  './vendor/esptool-js/bundle.js',
  './icons/icon-192.png', './icons/icon-512.png',
  './firmware/ESP32_GENERIC-v1.28.0.bin',
  './firmware/ESP32_GENERIC_S3-v1.28.0.bin',
  './firmware/ESP32_GENERIC_C3-v1.28.0.bin',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Tek bir varlik 404 olsa bile kurulum patlamasin
      Promise.allSettled(ASSETS.map((u) => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: hizli (cache) + arka planda guncelle (yeni surum sonraki yuklemede gelir)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // sadece kendi originimiz
  // Surum-sabit, buyuk ve degismeyen firmware imajlari: cache-first, arka planda
  // yeniden indirme YOK (her flash'ta ~1.7MB israfini onler). Surum degisirse
  // APP_VERSION artirilir; activate eski cache'i silip yenisini ceker.
  if (url.pathname.endsWith('.bin')) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then((cached) =>
          cached || fetch(e.request).then((resp) => { if (resp && resp.ok) cache.put(e.request, resp.clone()); return resp; })
        )
      )
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((resp) => { if (resp && resp.ok) cache.put(e.request, resp.clone()); return resp; })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});

// Sayfadan "hemen guncelle" mesaji
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
