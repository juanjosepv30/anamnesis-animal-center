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

self.addEventListener('fetch', function (e) {
  // GitHub Pages manda el HTML con "Cache-Control: max-age=600": el
  // navegador puede servir hasta 10 MINUTOS de código viejo. En un sistema
  // que decide a quién llamar y a quién avisar, eso no es aceptable — un
  // médico puede quedar corriendo reglas que ya cambiamos y no enterarse.
  //
  // Así que para las páginas pedimos siempre a la red, saltándonos ese
  // caché. Es lo contrario de lo que suele hacer un service worker, y es a
  // propósito: acá el enemigo es el código viejo, no la latencia.
  // Además del HTML, forzamos fresco NUESTRO JS/CSS (mismo origen): son código,
  // y cachearlos deja al médico corriendo lógica vieja igual que el HTML viejo.
  // (Las imágenes y la API siguen derecho a la red, sin que nos metamos.)
  var mismoOrigen = false;
  try { mismoOrigen = new URL(e.request.url).origin === self.location.origin; } catch (x) {}
  var esCodigo = e.request.destination === 'script' || e.request.destination === 'style';
  if (e.request.mode === 'navigate' || (mismoOrigen && esCodigo)) {
    e.respondWith(
      fetch(e.request, { cache: 'reload' })
        .catch(function () { return fetch(e.request); })   // sin red, lo que haya
    );
  }
});
