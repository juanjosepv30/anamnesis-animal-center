// Service worker: recibe el aviso desde la pantalla de sala y se lo reenvia a
// la(s) pestaña(s) de Spotify para que bajen o suban el volumen.
chrome.runtime.onMessage.addListener(function (msg) {
  if (!msg || msg.type !== 'ac-duck') return;
  chrome.tabs.query({ url: 'https://open.spotify.com/*' }, function (tabs) {
    (tabs || []).forEach(function (t) {
      chrome.tabs.sendMessage(t.id, { type: 'ac-duck', on: !!msg.on }, function () {
        // Ignoramos el error si esa pestaña todavia no tiene el content script.
        void chrome.runtime.lastError;
      });
    });
  });
});
