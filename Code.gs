// ============================================================
//  ANIMAL CENTER — Anamnesis Pre-Consulta
//  Backend: Google Apps Script — JSON API
// ============================================================

const SHEET_NAME     = 'Anamnesis';
const DASHBOARD_PIN  = '2025';
const VETESOFT_TOKEN = '689b95ed-1feb-4efd-bccd-c23dac85ddf3';
const VETESOFT_BASE  = 'https://developers.vetesoft.org';
const TZ             = 'America/Bogota';   // zona horaria fija (día = medianoche en Colombia)

// Clave de día (yyyy-MM-dd) en hora de Colombia — para que el reseteo
// diario de turnos y el filtro "hoy" no dependan de la zona del servidor.
function dayKey(dt) {
  try { return Utilities.formatDate(dt, TZ, 'yyyy-MM-dd'); }
  catch (e) { return ''; }
}

const COL = {
  TIMESTAMP: 0, ID: 1, PET_NAME: 2, SPECIES: 3, BREED: 4,
  AGE: 5, SEX: 6, NEUTERED: 7, OWNER_NAME: 8, OWNER_PHONE: 9,
  SERVICE: 10, SPECIALTY: 11, COMPLAINT: 12, DURATION: 13,
  EVOLUTION: 14, APPETITE: 15, WATER: 16, VOMIT: 17,
  DIARRHEA: 18, ENERGY: 19, COUGH: 20, BREATHING: 21,
  URINE: 22, SKIN: 23, PAIN: 24, VACCINES: 25,
  DEWORMING: 26, MEDICATIONS: 27, HISTORY: 28,
  ALLERGIES: 29, DIET: 30, NOTES: 31, STATUS: 32,
  VETESOFT_ID: 33, VETESOFT_HC: 34, WEIGHT: 35, DETAIL: 36,
  TURNO: 37, ESTADO: 38, AGENDADO: 39, HORA_CITA: 40, CONSULTORIO: 41
};

// ── CORS helper ──────────────────────────────────────────────
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(MimeType.TEXT);
}

// ── GET router ───────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';

  if (action === 'records') {
    return json(getRecords());
  }

  if (action === 'search') {
    const petName   = e.parameter.petName   || '';
    const ownerName = e.parameter.ownerName || '';
    const cedula    = e.parameter.cedula    || '';
    return json(searchVetesoft(petName, ownerName, cedula));
  }

  if (action === 'debug') {
    const petName = e.parameter.petName || 'MILA';
    const term = 'paciente=' + encodeURIComponent(normalizeStr(petName).toUpperCase());
    const res = UrlFetchApp.fetch(VETESOFT_BASE + '/datosBasicos/?' + term, {
      headers: { 'Auth-Token': VETESOFT_TOKEN },
      muteHttpExceptions: true
    });
    return json({
      ok: true,
      status: res.getResponseCode(),
      body: res.getContentText().slice(0, 800)
    });
  }

  return json({ ok: false, error: 'Unknown action' });
}

// ── POST router ──────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || '';

    if (action === 'submit') {
      return json(submitForm(body.data));
    }

    if (action === 'markReviewed') {
      return json(markReviewed(body.rowIndex));
    }

    if (action === 'registerArrival') {
      return json(registerArrival(body.data));
    }

    if (action === 'updateTurno') {
      return json(updateTurno(body.rowIndex, body.estado, body.consultorio));
    }

    return json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ── WhatsApp (Cloud API) ─────────────────────────────────────
// Las credenciales NO van en el código: se guardan en
// Configuración del proyecto → Propiedades del script.
//   WA_TOKEN    → el token de acceso
//   WA_PHONE_ID → el identificador del número de teléfono
function waConfig() {
  var p = PropertiesService.getScriptProperties();
  return {
    token  : p.getProperty('WA_TOKEN')    || '',
    phoneId: p.getProperty('WA_PHONE_ID') || ''
  };
}

// Envía una plantilla de WhatsApp. `params` llena las variables {{1}}, {{2}}...
function waSendTemplate(to, templateName, langCode, params) {
  var cfg = waConfig();
  if (!cfg.token || !cfg.phoneId) {
    return { ok: false, error: 'Faltan WA_TOKEN o WA_PHONE_ID en Propiedades del script' };
  }
  var payload = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type: 'template',
    template: { name: templateName, language: { code: langCode || 'es' } }
  };
  if (params && params.length) {
    payload.template.components = [{
      type: 'body',
      parameters: params.map(function(v){ return { type: 'text', text: String(v) }; })
    }];
  }
  try {
    var res = UrlFetchApp.fetch(
      'https://graph.facebook.com/v21.0/' + cfg.phoneId + '/messages', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + cfg.token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    var code = res.getResponseCode();
    return { ok: code === 200, status: code, body: res.getContentText().slice(0, 600) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── PRUEBA: cambiá el número por el tuyo y ejecutá esta función ──
// Formato: código de país + número, sin + ni espacios. Ej: 573001234567
function testWhatsApp() {
  var MI_NUMERO = '573001234567';   // ← PONÉ TU NÚMERO ACÁ
  var r = waSendTemplate(MI_NUMERO, 'hello_world', 'en_US');
  Logger.log(JSON.stringify(r, null, 2));
}

// ── Crear la plantilla de WhatsApp (ejecutar UNA sola vez) ───
// Requiere una propiedad más: WA_WABA_ID → el ID de la cuenta de
// WhatsApp Business (el número largo que aparece junto a
// "Test WhatsApp Business Account" en el panel de Meta).
function crearPlantilla() {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('WA_TOKEN');
  var waba  = p.getProperty('WA_WABA_ID');
  if (!token || !waba) {
    Logger.log('❌ Falta WA_TOKEN o WA_WABA_ID en Propiedades del script');
    return;
  }

  var payload = {
    name: 'nuevo_paciente',
    language: 'es',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '🔔 Turno {{1}} — {{2}}\nServicio: {{3}}\nMotivo: {{4}}\n\nYa está en la sala de espera.',
      example: {
        body_text: [[
          'E-04',
          'MILA',
          'Consulta especializada · Cardiología',
          'Tose de noche hace 3 días'
        ]]
      }
    }]
  };

  var res = UrlFetchApp.fetch(
    'https://graph.facebook.com/v21.0/' + waba + '/message_templates', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  Logger.log('Código: ' + res.getResponseCode());
  Logger.log(res.getContentText());
}

// Consultar en qué estado quedó la plantilla (APPROVED / PENDING / REJECTED)
function verPlantillas() {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('WA_TOKEN');
  var waba  = p.getProperty('WA_WABA_ID');
  if (!token || !waba) { Logger.log('❌ Falta WA_TOKEN o WA_WABA_ID'); return; }
  var res = UrlFetchApp.fetch(
    'https://graph.facebook.com/v21.0/' + waba + '/message_templates?fields=name,status,language,category',
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  Logger.log(res.getContentText());
}

// ── DIAGNÓSTICO: revisa toda la cadena y muestra dónde falla ──
// Ejecutá esta función y mirá el registro de ejecución.
function diagnosticoWhatsApp() {
  var p = PropertiesService.getScriptProperties();
  var token   = p.getProperty('WA_TOKEN')    || '';
  var phoneId = p.getProperty('WA_PHONE_ID') || '';

  Logger.log('══════ DIAGNÓSTICO WHATSAPP ══════');
  Logger.log('1) WA_TOKEN: ' + (token ? '✅ presente (' + token.length + ' caracteres)' : '❌ FALTA'));
  Logger.log('2) WA_PHONE_ID: ' + (phoneId ? '✅ ' + phoneId : '❌ FALTA'));

  if (!token || !phoneId) {
    Logger.log('>>> Cargá las propiedades en ⚙️ Configuración del proyecto → Propiedades del script');
    return;
  }

  var phones = getDoctorPhones('Consulta especializada', 'Cardiología');
  Logger.log('3) Teléfonos encontrados para Cardiología: ' + JSON.stringify(phones));
  if (!phones.length) {
    Logger.log('>>> ❌ La hoja "Medicos" no tiene teléfono en Cardiología, o "Avisar" no dice exactamente: si');
    return;
  }

  Logger.log('4) Enviando plantilla a ' + phones[0] + ' ...');
  var r = waSendTemplate(phones[0], 'nuevo_paciente', 'es_CO',
                         ['E-99', 'PRUEBA', 'Cardiología', 'Prueba de diagnóstico']);
  Logger.log('5) Respuesta de Meta:');
  Logger.log(JSON.stringify(r, null, 2));

  if (r.ok) Logger.log('✅ Meta aceptó el mensaje. Revisá tu celular.');
  else      Logger.log('❌ Meta rechazó el mensaje. El motivo está arriba, en "body".');
}

// ── Directorio de médicos ────────────────────────────────────
// Vive en la pestaña "Medicos" de la misma hoja, para que puedas
// cambiar teléfonos o apagar avisos SIN tocar el código.
const MEDICOS_SHEET = 'Medicos';

function getMedicosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(MEDICOS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(MEDICOS_SHEET);
    sh.appendRow(['Médico', 'Especialidad', 'Teléfono (57...)', 'Avisar (si/no)']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 4).setBackground('#5b2580').setFontColor('#ffffff').setFontWeight('bold');
    // Filas base: llená los teléfonos y poné "si" para activar el aviso.
    [
      ['Dr. Wilmer Páez',          'Cardiología',       '', 'si'],
      ['Dra. Marisol Villamizar',  'Dermatología',      '', 'si'],
      ['Dra. Estefanía Tenorio',   'Medicina Felina',   '', 'si'],
      ['Dra. Tatiana Rodríguez',   'Gastroenterología', '', 'si'],
      ['Dra. Catherine Hernández', 'Endocrinología',    '', 'si'],
      ['Dra. Catherine Hernández', 'Neonatología',      '', 'si'],
      ['Dr. Freddy Vera',          'Nutrición',         '', 'si'],
      ['Dr. Alberto Amaya',        'Oftalmología',      '', 'si'],
      ['Dra. Angie Valero',        'Imagenología',      '', 'si'],
      ['Dra. Milena Rodríguez',    'Terapia Física',    '', 'si'],
      ['Dr. Wilmer Rodríguez',     'Nefrología',        '', 'si'],
      ['Dr. Wilmer Páez',          'Ortopedia',         '', 'si'],
      ['Dr. Jhoiner Barbosa',      'Oncología',         '', 'si'],
      ['Médico general 1',         'General',           '', 'si'],
      ['Médico general 2',         'General',           '', 'si'],
      ['Vacunación',               'Vacunación',        '', 'si']
    ].forEach(function(r){ sh.appendRow(r); });
    sh.autoResizeColumns(1, 4);
  }
  return sh;
}

// Normaliza para comparar sin depender de acentos ni mayúsculas
// ("Vacunación" y "vacunacion" tienen que coincidir igual).
function normEsp(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// ¿A qué teléfonos hay que avisarle por este paciente?
function getDoctorPhones(service, specialty) {
  try {
    var rows = getMedicosSheet().getDataRange().getValues();
    var s = normEsp(service);
    var targets;

    if (s.indexOf('especial') !== -1) {
      targets = [normEsp(specialty)];
    } else if (s.indexOf('vacun') !== -1) {
      // Las vacunas avisan a vacunación Y a los médicos generales.
      targets = ['vacunacion', 'general'];
    } else if (s.indexOf('inyect') !== -1) {
      targets = ['vacunacion'];
    } else {
      targets = ['general'];   // consulta general, control sin cita, viajero
    }

    var phones = [], seen = {};
    for (var i = 1; i < rows.length; i++) {
      var esp    = normEsp(rows[i][1]);
      var tel    = String(rows[i][2] || '').replace(/[^0-9]/g, '');
      var avisar = normEsp(rows[i][3]);
      if (!tel || avisar !== 'si') continue;
      if (targets.indexOf(esp) === -1) continue;
      if (seen[tel]) continue;          // sin repetir si un médico calza dos veces
      seen[tel] = true;
      phones.push(tel);
    }
    return phones;
  } catch (err) {
    return [];
  }
}

// ── Aviso de paciente nuevo ──────────────────────────────────
// Nunca debe romper el envío del formulario: si falla, sigue de largo.
function notifyNewPatient(data, turno) {
  try {
    var phones = getDoctorPhones(data.service, data.specialty);
    if (!phones.length) return;

    var quien = data.petName || 'Paciente';
    var svc   = data.service || '';
    if (data.specialty) svc += ' · ' + data.specialty;
    var motivo = data.complaint ? String(data.complaint).slice(0, 120) : 'Aún sin anamnesis';

    // El idioma debe coincidir EXACTO con el de la plantilla en Meta.
    // La creaste como Spanish (COL) → código es_CO.
    phones.forEach(function(tel) {
      waSendTemplate(tel, 'nuevo_paciente', 'es_CO', [turno || '—', quien, svc || '—', motivo]);
    });
  } catch (err) {
    // Silencioso a propósito: un fallo de WhatsApp no puede tumbar la anamnesis.
  }
}

// ── Google Sheet ─────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'Timestamp','ID','Nombre Mascota','Especie','Raza','Edad','Sexo',
      'Castrado','Propietario','Teléfono','Servicio','Especialidad',
      'Motivo Principal','Duración','Evolución','Apetito','Agua',
      'Vómito','Diarrea','Energía','Tos/Estornudos','Dif. Respiratoria',
      'Orina','Piel/Pelo','Dolor','Vacunas','Desparasitado',
      'Medicamentos','Enf/Cirugías','Alergias','Alimentación',
      'Notas','Estado','Vetesoft ID','HC Vetesoft','Peso (kg)','Detalle Consulta',
      'Turno','Estado Turno','Agendado','Hora Cita','Consultorio'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#5b2580').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sheet;
}

// ── Fuzzy search helpers ─────────────────────────────────────
function normalizeStr(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

function fuzzyMatch(text, query) {
  if (!text || !query) return false;
  const t = normalizeStr(text);
  const q = normalizeStr(query);
  if (!t || !q) return false;
  if (t.indexOf(q) !== -1 || q.indexOf(t) !== -1) return true;

  // Coincidencia por palabras: cada palabra de la consulta debe
  // aparecer (exacta, parcial o con 1-2 typos) en alguna palabra del texto.
  // Así "juan paez" reconoce a "juan jose paez" (falta el 2do nombre).
  var tw = t.split(/\s+/);
  var qw = q.split(/\s+/);
  var matchedWords = 0, requiredWords = 0;
  for (var i = 0; i < qw.length; i++) {
    var w = qw[i];
    if (w.length < 2) continue;
    requiredWords++;
    for (var j = 0; j < tw.length; j++) {
      var tj = tw[j];
      if (tj === w || tj.indexOf(w) !== -1 || w.indexOf(tj) !== -1 ||
          (w.length >= 4 && levenshtein(tj, w) <= 2)) {
        matchedWords++;
        break;
      }
    }
  }
  return requiredWords > 0 && matchedWords === requiredWords;
}

function levenshtein(a, b) {
  var m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  var prev = [], curr = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    for (var j = 1; j <= n; j++) {
      curr[j] = a[i-1] === b[j-1] ? prev[j-1] :
        1 + Math.min(prev[j], curr[j-1], prev[j-1]);
    }
    prev = curr.slice();
  }
  return prev[n];
}

// ── Vetesoft lookup ──────────────────────────────────────────
function searchVetesoft(petName, ownerName, cedula) {
  try {
    // Normalize cedula: strip dots, dashes, spaces
    var cleanCedula = cedula ? String(cedula).replace(/[.\-\s]/g, '').trim() : '';

    // Union de coincidencias por CADA campo (no exige que combinen).
    // Se busca por cédula, por mascota y por propietario de forma
    // independiente, y se juntan los resultados sin duplicar.
    var results = [];
    var seen = {};
    function addAll(list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r && r.id_animal != null && !seen[r.id_animal]) {
          seen[r.id_animal] = true;
          results.push(r);
        }
      }
    }

    // 1. Combinada mascota + propietario (la más precisa: Vetesoft filtra
    //    del lado de ellos y evita el tope de ~5 resultados por nombre).
    if (petName && ownerName) {
      var rc = fetchVetesoft(
        'paciente=' + encodeURIComponent(normalizeStr(petName).toUpperCase()) +
        '&propietario=' + encodeURIComponent(normalizeStr(ownerName).toUpperCase())
      );
      addAll(rc.filter(function(r) {
        return fuzzyMatch(r.paciente, petName) && fuzzyMatch(r.propietario, ownerName);
      }));
    }

    // 2. Por cédula (coincidencia exacta del documento)
    if (cleanCedula) {
      addAll(fetchVetesoft('documento=' + encodeURIComponent(cleanCedula)));
    }

    // 3. Por nombre de mascota (fuzzy sobre el nombre del paciente)
    if (petName) {
      var rp = fetchVetesoft('paciente=' + encodeURIComponent(normalizeStr(petName).toUpperCase()));
      addAll(rp.filter(function(r) { return fuzzyMatch(r.paciente, petName); }));
    }

    // 4. Por nombre de propietario (fuzzy sobre el propietario)
    if (ownerName) {
      var ro = fetchVetesoft('propietario=' + encodeURIComponent(normalizeStr(ownerName).toUpperCase()));
      addAll(ro.filter(function(r) { return fuzzyMatch(r.propietario, ownerName); }));
    }

    return {
      ok: true,
      results: results.slice(0, 15).map(function(r) { return {
        id       : r.id_animal,
        registro : r.registro || (r.id_animal ? String(r.id_animal) : ''),
        petName  : r.paciente    || '',
        species  : r.especie     || '',
        breed    : r.raza        || '',
        owner    : r.propietario || '',
        phone    : r.telefono    || '',
        sex      : r.sexo        || '',
        documento: r.documento   || ''
      };})
    };
  } catch (err) {
    return { ok: false, error: err.message, results: [] };
  }
}

function fetchVetesoft(searchTerm) {
  try {
    const res = UrlFetchApp.fetch(VETESOFT_BASE + '/datosBasicos/?' + searchTerm, {
      headers: { 'Auth-Token': VETESOFT_TOKEN },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return [];
    const data = JSON.parse(res.getContentText());
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// ── Turnos ───────────────────────────────────────────────────
// Prefijo del turno según el servicio.
function servicePrefix(service) {
  var s = (service || '').toLowerCase();
  if (s.indexOf('viajer')  !== -1) return 'VJ';
  if (s.indexOf('especial') !== -1) return 'E';
  if (s.indexOf('control')  !== -1) return 'C';
  if (s.indexOf('vacun')    !== -1) return 'V';
  if (s.indexOf('inyect')   !== -1) return 'I';
  return 'G';
}

// Fila (grupo de consultorios) según el servicio.
function serviceFila(service) {
  var s = (service || '').toLowerCase();
  if (s.indexOf('vacun') !== -1 || s.indexOf('inyect') !== -1) return 'rapidos';
  if (s.indexOf('especial') !== -1) return 'especializados';
  if (s.indexOf('control') !== -1) return 'especializados';
  return 'generales';   // incluye consulta general y viajero
}

// Genera el turno del día para ese servicio: prefijo + secuencia diaria.
function assignTurno(sheet, service) {
  var prefix = servicePrefix(service);
  var data = sheet.getDataRange().getValues();
  var todayK = dayKey(new Date());
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var ts = new Date(data[i][COL.TIMESTAMP]);
    if (isNaN(ts)) continue;
    if (dayKey(ts) !== todayK) continue;
    if (servicePrefix(data[i][COL.SERVICE]) === prefix) count++;
  }
  var seq = count + 1;
  return prefix + '-' + (seq < 10 ? '0' + seq : String(seq));
}

// ── Helpers de fila ──────────────────────────────────────────
// Valores de la anamnesis (columnas 2..36 de la fila).
function anamnesisValues(data) {
  return [
    data.petName||'', data.species||'', data.breed||'', data.age||'', data.sex||'',
    data.neutered||'', data.ownerName||'', data.ownerPhone||'', data.service||'',
    data.specialty||'', data.complaint||'', data.duration||'', data.evolution||'',
    data.appetite||'', data.water||'', data.vomit||'', data.diarrhea||'', data.energy||'',
    data.cough||'', data.breathing||'', data.urine||'', data.skin||'', data.pain||'',
    data.vaccines||'', data.deworming||'', data.medications||'', data.history||'',
    data.allergies||'', data.diet||'', data.notes||'', 'pendiente',
    data.vetesoftId||'', data.vetesoftHc||'', data.weight||'', data.detail||''
  ];
}

// Fila de HOY con ese id_animal (cualquiera).
function findTodayRowAny(sheet, vid) {
  if (!vid) return -1;
  var data = sheet.getDataRange().getValues();
  var todayK = dayKey(new Date());
  for (var i = data.length - 1; i >= 1; i--) {
    var ts = new Date(data[i][COL.TIMESTAMP]); if (isNaN(ts)) continue;
    if (dayKey(ts) !== todayK) continue;
    if (String(data[i][COL.VETESOFT_ID]) === String(vid)) return i + 1;
  }
  return -1;
}

// Fila abierta por recepción HOY (agendado, sin anamnesis todavía).
function findReceptionRow(sheet, vid) {
  if (!vid) return -1;
  var data = sheet.getDataRange().getValues();
  var todayK = dayKey(new Date());
  for (var i = data.length - 1; i >= 1; i--) {
    var ts = new Date(data[i][COL.TIMESTAMP]); if (isNaN(ts)) continue;
    if (dayKey(ts) !== todayK) continue;
    if (String(data[i][COL.VETESOFT_ID]) !== String(vid)) continue;
    if (!data[i][COL.COMPLAINT] && !data[i][COL.DETAIL]) return i + 1; // sin anamnesis
  }
  return -1;
}

// ── Submit form (anamnesis del cliente) ──────────────────────
function submitForm(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(10000);
    var sheet = getSheet();
    var vid = data.vetesoftId || '';
    var now = new Date();

    // ¿Recepción ya abrió la fila de este agendado? → completar, no duplicar.
    var existing = findReceptionRow(sheet, vid);
    if (existing > 0) {
      var vals = anamnesisValues(data);
      sheet.getRange(existing, COL.PET_NAME + 1, 1, vals.length).setValues([vals]);
      var t   = sheet.getRange(existing, COL.TURNO + 1).getValue();
      var eid = sheet.getRange(existing, COL.ID + 1).getValue();
      return { ok: true, id: eid, turno: t, linked: true };
    }

    // Espontáneo: fila nueva.
    var id = Utilities.getUuid();
    var turno = assignTurno(sheet, data.service);
    var row = [now.toISOString(), id].concat(anamnesisValues(data))
              .concat([turno, 'esperando', 'no', '', '']);
    sheet.appendRow(row);
    // Espontáneo: recepción no lo reportó, así que este es el primer aviso.
    notifyNewPatient(data, turno);
    return { ok: true, id: id, turno: turno, linked: false };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ── Registrar llegada de agendado (recepción) ────────────────
function registerArrival(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(10000);
    var sheet = getSheet();
    var vid = data.vetesoftId || '';

    // Si ya hay fila hoy (el cliente llenó la anamnesis primero), marcarla agendada.
    var existing = findTodayRowAny(sheet, vid);
    if (existing > 0) {
      sheet.getRange(existing, COL.AGENDADO + 1).setValue('si');
      if (data.horaCita)  sheet.getRange(existing, COL.HORA_CITA + 1).setValue(data.horaCita);
      if (data.service)   sheet.getRange(existing, COL.SERVICE + 1).setValue(data.service);
      if (data.specialty) sheet.getRange(existing, COL.SPECIALTY + 1).setValue(data.specialty);
      var tc = sheet.getRange(existing, COL.TURNO + 1);
      if (!tc.getValue()) tc.setValue(assignTurno(sheet, data.service));
      return { ok: true, turno: tc.getValue(), linked: true };
    }

    // Nueva fila de recepción (sin anamnesis todavía).
    var id = Utilities.getUuid();
    var now = new Date();
    var turno = assignTurno(sheet, data.service);
    var row = new Array(42);
    for (var k = 0; k < 42; k++) row[k] = '';
    row[COL.TIMESTAMP] = now.toISOString(); row[COL.ID] = id;
    row[COL.PET_NAME] = data.petName || ''; row[COL.SPECIES] = data.species || '';
    row[COL.BREED] = data.breed || ''; row[COL.OWNER_NAME] = data.owner || data.ownerName || '';
    row[COL.SERVICE] = data.service || ''; row[COL.SPECIALTY] = data.specialty || '';
    row[COL.STATUS] = 'pendiente';
    row[COL.VETESOFT_ID] = vid; row[COL.VETESOFT_HC] = data.vetesoftHc || '';
    row[COL.TURNO] = turno; row[COL.ESTADO] = 'esperando'; row[COL.AGENDADO] = 'si';
    row[COL.HORA_CITA] = data.horaCita || ''; row[COL.CONSULTORIO] = '';
    sheet.appendRow(row);
    // Recepción confirmó un agendado: avisamos al médico de una vez.
    notifyNewPatient(data, turno);
    return { ok: true, turno: turno, linked: false };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ── Actualizar estado/consultorio de un turno ────────────────
function updateTurno(rowIndex, estado, consultorio) {
  try {
    var sheet = getSheet();
    if (estado) sheet.getRange(rowIndex, COL.ESTADO + 1).setValue(estado);
    if (consultorio !== undefined && consultorio !== null && consultorio !== '')
      sheet.getRange(rowIndex, COL.CONSULTORIO + 1).setValue(consultorio);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Get records ──────────────────────────────────────────────
function getRecords() {
  try {
    const sheet = getSheet();
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return { ok: true, records: [] };

    const records = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const r = data[i];
      records.push({
        rowIndex   : i + 1,
        id         : r[COL.ID],
        timestamp  : r[COL.TIMESTAMP],
        petName    : r[COL.PET_NAME],
        species    : r[COL.SPECIES],
        breed      : r[COL.BREED],
        age        : r[COL.AGE],
        sex        : r[COL.SEX],
        neutered   : r[COL.NEUTERED],
        ownerName  : r[COL.OWNER_NAME],
        ownerPhone : r[COL.OWNER_PHONE],
        service    : r[COL.SERVICE],
        specialty  : r[COL.SPECIALTY],
        complaint  : r[COL.COMPLAINT],
        duration   : r[COL.DURATION],
        evolution  : r[COL.EVOLUTION],
        appetite   : r[COL.APPETITE],
        water      : r[COL.WATER],
        vomit      : r[COL.VOMIT],
        diarrhea   : r[COL.DIARRHEA],
        energy     : r[COL.ENERGY],
        cough      : r[COL.COUGH],
        breathing  : r[COL.BREATHING],
        urine      : r[COL.URINE],
        skin       : r[COL.SKIN],
        pain       : r[COL.PAIN],
        vaccines   : r[COL.VACCINES],
        deworming  : r[COL.DEWORMING],
        medications: r[COL.MEDICATIONS],
        history    : r[COL.HISTORY],
        allergies  : r[COL.ALLERGIES],
        diet       : r[COL.DIET],
        notes      : r[COL.NOTES],
        status     : r[COL.STATUS],
        vetesoftId : r[COL.VETESOFT_ID] || '',
        vetesoftHc : r[COL.VETESOFT_HC] || '',
        weight     : r[COL.WEIGHT] || '',
        detail     : r[COL.DETAIL] || '',
        turno      : r[COL.TURNO] || '',
        estadoTurno: r[COL.ESTADO] || '',
        agendado   : r[COL.AGENDADO] || '',
        horaCita   : r[COL.HORA_CITA] || '',
        consultorio: r[COL.CONSULTORIO] || ''
      });
    }
    return { ok: true, records: records };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Mark reviewed ────────────────────────────────────────────
function markReviewed(rowIndex) {
  try {
    const sheet = getSheet();
    sheet.getRange(rowIndex, COL.STATUS + 1).setValue('revisado');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
