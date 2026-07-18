// Corre en la pagina de la pantalla de sala. Escucha el evento 'ac-duck' que
// la pagina dispara al anunciar un turno, y se lo pasa al service worker.
window.addEventListener('ac-duck', function (e) {
  try {
    chrome.runtime.sendMessage({ type: 'ac-duck', on: !!(e.detail && e.detail.on) });
  } catch (_) {}
});
