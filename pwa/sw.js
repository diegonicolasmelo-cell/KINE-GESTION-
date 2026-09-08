// ============================================
// SERVICE WORKER — KinesioTurno UCI (envoltorio PWA)
// --------------------------------------------
// Cachea SOLO el envoltorio (shell, íconos, manifest) para que la
// app abra al instante y muestre una pantalla decente sin conexión.
//
// NUNCA cachea las peticiones a script.google.com: los turnos,
// permisos y licencias son datos vivos y compartidos — servir una
// copia vieja mostraría una planilla desactualizada, que en una UCI
// es peor que no mostrar nada.
//
// Al cambiar archivos del envoltorio, sube el número de VERSION
// para que los clientes descarten el caché anterior.
// ============================================

var VERSION = "kinesioturno-v1";

var SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./offline.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

// --- Instalación: precachea el envoltorio ---
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(VERSION)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

// --- Activación: borra cachés de versiones anteriores ---
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (claves) {
        return Promise.all(claves.map(function (k) {
          return k === VERSION ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// --- Fetch ---
self.addEventListener("fetch", function (evento) {
  var req = evento.request;

  // Solo GET: nada de interceptar envíos de formularios.
  if (req.method !== "GET") return;

  var url = new URL(req.url);

  // Todo lo que no sea de este origen (script.google.com,
  // googleusercontent.com, fuentes) va directo a la red, sin caché.
  if (url.origin !== self.location.origin) return;

  // Estrategia network-first para el envoltorio: si hay red, el usuario
  // recibe siempre la última versión; si no, tira del caché.
  evento.respondWith(
    fetch(req)
      .then(function (respuesta) {
        if (respuesta && respuesta.status === 200 && respuesta.type === "basic") {
          var copia = respuesta.clone();
          caches.open(VERSION).then(function (cache) { cache.put(req, copia); });
        }
        return respuesta;
      })
      .catch(function () {
        return caches.match(req).then(function (enCache) {
          if (enCache) return enCache;
          // Navegación sin conexión y sin copia → pantalla offline
          if (req.mode === "navigate") return caches.match("./offline.html");
          return new Response("", { status: 504, statusText: "Sin conexión" });
        });
      })
  );
});

// Permite que la página fuerce la activación de un SW nuevo.
self.addEventListener("message", function (evento) {
  if (evento.data === "skipWaiting") self.skipWaiting();
});
