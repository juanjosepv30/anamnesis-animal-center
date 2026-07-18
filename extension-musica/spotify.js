// Corre en open.spotify.com. Baja el volumen del audio/video de Spotify
// mientras la voz anuncia el turno, y lo restaura al terminar.
(function () {
  var DUCK = 0.15;      // volumen mientras habla la voz (15%)
  var saved = null;     // volumenes previos, para restaurar exactamente igual
  var hold = null;      // reasegura el volumen bajo por si Spotify lo repone

  function medios() {
    return Array.prototype.slice.call(document.querySelectorAll('audio, video'));
  }

  function duck(on) {
    var els = medios();
    if (on) {
      if (saved === null) saved = els.map(function (el) { return el.volume; });
      els.forEach(function (el) { try { el.volume = DUCK; } catch (_) {} });
      clearInterval(hold);
      hold = setInterval(function () {
        medios().forEach(function (el) { if (el.volume > DUCK + 0.02) { try { el.volume = DUCK; } catch (_) {} } });
      }, 200);
    } else {
      clearInterval(hold); hold = null;
      var s = saved; saved = null;
      medios().forEach(function (el, i) {
        try { el.volume = (s && s[i] != null) ? s[i] : 1; } catch (_) {}
      });
    }
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'ac-duck') duck(!!msg.on);
  });
})();
