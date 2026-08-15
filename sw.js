/**
 * Cuentas claras — hace que la app abra sin internet.
 *
 * La regla es: con señal, siempre la versión más nueva; sin señal, la copia
 * guardada. Antes era al revés y por eso las actualizaciones tardaban días
 * en aparecer.
 */

var CACHE = 'cuentas-firebase-2026.08.14-J';
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

/** Guarda una copia de la respuesta para cuando no haya señal. */
function guardar(req, resp) {
  if (resp && (resp.ok || resp.type === 'opaque')) {
    var copia = resp.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copia); });
  }
  return resp;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;

  // Las escrituras nunca se guardan en caché.
  if (req.method !== 'GET') return;
  // Las tipografías sí se guardan; el tráfico de Firebase nunca.
  var esTipografia = req.url.indexOf('fonts.googleapis.com') > -1 ||
                     req.url.indexOf('fonts.gstatic.com') > -1 ||
                     req.url.indexOf('www.gstatic.com/firebasejs') > -1;

  if (!esTipografia && (req.url.indexOf('googleapis.com') > -1 ||
                        req.url.indexOf('firebaseio.com') > -1 ||
                        req.url.indexOf('firebaseapp.com') > -1)) return;

  var mismoOrigen = new URL(req.url).origin === self.location.origin;
  if (!mismoOrigen && !esTipografia) return;

  var esLaApp = req.mode === 'navigate' ||
                req.url.indexOf('index.html') > -1 ||
                req.url.replace(/[?#].*$/, '').endsWith(BASE);

  // La app misma: primero la red, para que una versión nueva se vea de una.
  // Si la red falla o tarda más de 4 segundos, entra la copia guardada.
  if (esLaApp) {
    e.respondWith(
      Promise.race([
        fetch(req).then(function (resp) { return guardar(req, resp); }),
        new Promise(function (resolver) {
          setTimeout(function () {
            caches.match(req).then(function (g) { if (g) resolver(g); });
          }, 4000);
        })
      ]).catch(function () {
        return caches.match(req).then(function (g) {
          return g || caches.match(BASE + 'index.html');
        });
      })
    );
    return;
  }

  // Lo demás (iconos, tipografías) casi nunca cambia: primero lo guardado.
  e.respondWith(
    caches.match(req).then(function (guardada) {
      var red = fetch(req)
        .then(function (resp) { return guardar(req, resp); })
        .catch(function () { return guardada || Response.error(); });
      return guardada || red;
    })
  );
});
