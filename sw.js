// Service worker mínimo — Animal Center
//
// Existe por UNA sola razón: Android exige un service worker con manejador
// de 'fetch' para dejar instalar la página como app de verdad (con su ícono
// en el cajón de aplicaciones y sin la barra del navegador). Sin esto,
// Android solo ofrece un acceso directo.
//
// NO CACHEA NADA, y es a propósito.
//
// Un service worker que guarda la página haría que el médico siga viendo
// una versión vieja después de cada cambio, sin que nadie se entere. Este
// sistema decide a quién llamar y a quién avisarle: correr código viejo no
// es una molestia, es un riesgo. Preferimos depender del internet de la
// clínica —que siempre está, porque sin él tampoco hay datos que mostrar—
// antes que mostrar información desactualizada.
//
// Si algún día se quiere que funcione sin internet, hay que pensarlo en
// serio: al menos "red primero, caché solo si falla", nunca al revés.

self.addEventListener('install', function () {
  self.skipWaiting();          // la versión nueva manda de inmediato
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function () {
  // Sin respondWith: cada pedido va a la red como si no existiéramos.
  // Alcanza para que Android considere la página instalable.
});
