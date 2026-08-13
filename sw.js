/**
 * Cuentas de papá — hace que la app abra sin internet.
 * Guarda una copia de la app en el teléfono la primera vez que se abre.
 */

var CACHE = 'cuentas-familia-v3';
var BASE = new URL('./', self.location).pathname;

var ARCHIVOS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'icono-192.png',
  BASE + 'icono-512.png',
  BASE + 'icono-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ARCHIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (llaves) {
        return Promise.all(llaves.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  // La sincronización con la hoja nunca se guarda en caché.
  if (req.method !== 'GET') return;
  if (req.url.indexOf('script.google.com') > -1 || req.url.indexOf('script.googleusercontent.com') > -1) return;

  var esTipografia = req.url.indexOf('fonts.googleapis.com') > -1 || req.url.indexOf('fonts.gstatic.com') > -1;
  var mismoOrigen = new URL(req.url).origin === self.location.origin;
  if (!mismoOrigen && !esTipografia) return;

  // Primero la copia guardada; en segundo plano se busca una versión nueva.
  e.respondWith(
    caches.match(req).then(function (guardada) {
      var red = fetch(req).then(function (resp) {
        if (resp && (resp.ok || resp.type === 'opaque')) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return resp;
      }).catch(function () {
        return guardada || (req.mode === 'navigate' ? caches.match(BASE + 'index.html') : Response.error());
      });
      return guardada || red;
    })
  );
});
