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
  TURNO: 37, ESTADO: 38, AGENDADO: 39, HORA_CITA: 40, CONSULTORIO: 41,
  CALLED_AT: 42, CALLED_BY: 43
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

// ── Contador de versión de los datos ─────────────────────────
// Se incrementa con cada cambio. El dashboard lo consulta cada pocos
// segundos (es una lectura de un número, no de la hoja entera) y solo
// descarga los registros cuando de verdad cambió algo.
function bumpVersion() {
  try {
    var p = PropertiesService.getScriptProperties();
    var v = parseInt(p.getProperty('DATA_VERSION') || '0', 10) + 1;
    p.setProperty('DATA_VERSION', String(v));
    return v;
  } catch (e) { return 0; }
}

function getVersion() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('DATA_VERSION') || '0';
    return { ok: true, v: parseInt(v, 10) };
  } catch (e) { return { ok: true, v: 0 }; }
}

// ── GET router ───────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';

  // Consulta barata: ¿cambió algo? (no lee la hoja)
  if (action === 'version') {
    return json(getVersion());
  }

  if (action === 'records') {
    return json(getRecords());
  }

  if (action === 'medicos') {
    return json(getMedicos());
  }

  // Diagnóstico: ¿a quién se le avisaría por este paciente, ahora mismo?
  // Devuelve NOMBRES, nunca teléfonos. Sirve para entender por qué a
  // alguien le sonó (o no le sonó) el celular.
  if (action === 'quienAvisa') {
    return json(quienAvisa(e.parameter.service || '', e.parameter.specialty || ''));
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
      return json(updateTurno(body.rowIndex, body.estado, body.consultorio, body.medico));
    }

    // El médico marca que entra o sale de turno.
    if (action === 'setTurno') {
      return json(setTurno(body.medico, !!body.activo));
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

// Envía una plantilla de WhatsApp.
//   params        → llena las variables {{1}}, {{2}}... del cuerpo
//   urlBtnParam   → llena la variable del botón de URL (para el link directo)
// ── Modo prueba ──────────────────────────────────────────────
// Con el modo prueba encendido, TODOS los avisos se desvían a un solo
// teléfono. Sirve para probar el sistema sin hacerle vibrar el celular a
// los médicos de verdad.
// Se enciende y se apaga desde el editor de Apps Script, a propósito:
// no es un botón de la página para que nadie lo prenda sin querer.
function activarModoPrueba(telefono) {
  var tel = String(telefono || '').replace(/[^0-9]/g, '');
  if (tel.length < 10) {
    Logger.log('❌ Teléfono inválido. Usá el formato 573001234567 (con el 57).');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('TEL_PRUEBA', tel);
  bumpVersion();
  Logger.log('🧪 MODO PRUEBA ENCENDIDO. Todos los avisos van a ir SOLO a ' + tel + '.');
  Logger.log('   Los médicos NO van a recibir nada hasta que lo apagues.');
  Logger.log('   Para apagarlo, ejecutá: desactivarModoPrueba()');
}

function desactivarModoPrueba() {
  PropertiesService.getScriptProperties().deleteProperty('TEL_PRUEBA');
  bumpVersion();
  Logger.log('✅ MODO PRUEBA APAGADO. Los avisos vuelven a los médicos de verdad.');
}

function getTelPrueba() {
  try { return PropertiesService.getScriptProperties().getProperty('TEL_PRUEBA') || ''; }
  catch (e) { return ''; }
}

function waSendTemplate(to, templateName, langCode, params, urlBtnParam) {
  var cfg = waConfig();
  if (!cfg.token || !cfg.phoneId) {
    return { ok: false, error: 'Faltan WA_TOKEN o WA_PHONE_ID en Propiedades del script' };
  }
  // Modo prueba: se desvía acá, en el último punto antes de salir, para que
  // ningún camino pueda saltárselo por accidente.
  var prueba = getTelPrueba();
  if (prueba) to = prueba;
  var payload = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type: 'template',
    template: { name: templateName, language: { code: langCode || 'es' } }
  };
  var components = [];
  if (params && params.length) {
    components.push({
      type: 'body',
      parameters: params.map(function(v){ return { type: 'text', text: String(v) }; })
    });
  }
  if (urlBtnParam) {
    // Botón de URL dinámica: el sufijo se pega al final del link de la plantilla
    components.push({
      type: 'button', sub_type: 'url', index: '0',
      parameters: [{ type: 'text', text: String(urlBtnParam) }]
    });
  }
  if (components.length) payload.template.components = components;
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
      ['Dr. Freddy Vera',          'Viajero',           '', 'si'],
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

// Un especialista que también atiende consulta general necesita su fila
// "General" en la hoja. Esta función se la agrega copiando el teléfono que
// ya tiene, para no tipearlo de nuevo. Ejecutala desde el editor.
function agregarComoGeneral() {
  var MEDICOS = [
    'Dr. Jhoiner Barbosa',
    'Dra. Catherine Hernández',
    'Dra. Tatiana Rodríguez'
  ];
  var sh   = getMedicosSheet();
  var rows = sh.getDataRange().getValues();

  MEDICOS.forEach(function(nombre) {
    var tel = '', yaEsGeneral = false;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() !== nombre) continue;
      if (!tel) tel = String(rows[i][2] || '').trim();
      if (normEsp(rows[i][1]) === 'general') yaEsGeneral = true;
    }
    if (yaEsGeneral) { Logger.log('• ' + nombre + ': ya estaba como General, no toco nada.'); return; }
    if (!tel)        { Logger.log('⚠️ ' + nombre + ': no lo encontré en la hoja (¿el nombre está igual?).'); return; }
    sh.appendRow([nombre, 'General', tel, 'si']);
    Logger.log('✅ ' + nombre + ' → agregado como General.');
  });
  Logger.log('Listo. Revisá la pestaña Medicos.');
}

// ¿Qué médicos están ocupados AHORA? Ocupado = tiene un paciente que él
// llamó y todavía no cerró. Cuando marca "atendido" queda libre otra vez.
// Nos sirve para no molestar al que ya está atendiendo: cuando termine va
// a mirar el dashboard igual. El aviso es para el que está desocupado.
function medicosOcupados() {
  try {
    var data = getSheet().getDataRange().getValues();
    var hoy = dayKey(new Date()), ocupados = {};
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL.ESTADO]) !== 'llamando') continue;
      var t = data[i][COL.TIMESTAMP];
      if (!t || dayKey(new Date(t)) !== hoy) continue;
      var med = String(data[i][COL.CALLED_BY] || '').trim();
      if (med) ocupados[med] = true;
    }
    return Object.keys(ocupados);
  } catch (e) { return []; }
}

// ── Turnos del día ───────────────────────────────────────────
// Quién está trabajando AHORA. Vive en ScriptProperties junto con el día:
// si el día no es hoy, la lista se ignora, así el turno se apaga solo cada
// medianoche y nadie amanece recibiendo mensajes de su día libre.
function getTurnos() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('TURNOS');
    if (!raw) return [];
    var t = JSON.parse(raw);
    if (t.dia !== dayKey(new Date())) return [];
    return t.medicos || [];
  } catch (e) { return []; }
}

function setTurno(medico, activo) {
  medico = String(medico || '').trim();
  if (!medico) return { ok: false, error: 'Falta el médico' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) {}
  try {
    var lista = getTurnos();
    var i = lista.indexOf(medico);
    if (activo && i === -1) lista.push(medico);
    if (!activo && i !== -1) lista.splice(i, 1);
    PropertiesService.getScriptProperties()
      .setProperty('TURNOS', JSON.stringify({ dia: dayKey(new Date()), medicos: lista }));
    bumpVersion();
    return { ok: true, deTurno: lista };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// Directorio para el dashboard: quién es cada médico y qué atiende.
// Un médico puede cubrir varias especialidades (Wilmer Páez hace
// Cardiología y Ortopedia), así que agrupamos por nombre.
// OJO: acá NO va el teléfono. El dashboard es una página pública.
function getMedicos() {
  try {
    var rows = getMedicosSheet().getDataRange().getValues();
    var porNombre = {}, orden = [];
    for (var i = 1; i < rows.length; i++) {
      var nombre = String(rows[i][0] || '').trim();
      var esp    = String(rows[i][1] || '').trim();
      if (!nombre || !esp) continue;
      if (!porNombre[nombre]) { porNombre[nombre] = []; orden.push(nombre); }
      if (porNombre[nombre].indexOf(esp) === -1) porNombre[nombre].push(esp);
    }
    return {
      ok: true,
      medicos: orden.map(function(n){
        return { medico: n, especialidades: porNombre[n] };
      })
    };
  } catch (err) {
    return { ok: false, error: String(err), medicos: [] };
  }
}

// ¿Qué especialidades atienden a este paciente?
// ESPEJO de destinatarios() en dashboard.html. Si cambia una, cambia la
// otra: es la regla que hace que el médico vea en el dashboard exactamente
// los pacientes por los que se le avisa.
function destinatariosDe(service, specialty) {
  var s  = normEsp(service);
  var sp = normEsp(specialty);

  if (s.indexOf('especial') !== -1) return [sp];
  // Control CON especialidad → lo atiende ese especialista.
  // Control sin especialidad → es un control general.
  if (s.indexOf('control') !== -1) return sp ? [sp] : ['general'];
  // Vacunación e inyectología: avisan a vacunación Y a los generales.
  if (s.indexOf('vacun') !== -1 || s.indexOf('inyect') !== -1) return ['vacunacion', 'general'];
  // Viajero: avisa a los generales, pero también al Dr. Freddy,
  // que es el especialista en trámites de viaje (fila "Viajero").
  if (s.indexOf('viajer') !== -1) return ['viajero', 'general'];
  return ['general'];   // consulta general
}

// ¿A qué médicos hay que avisarle por este paciente, ahora mismo?
// Única fuente de verdad: getDoctorPhones y quienAvisa salen de acá, para
// que el aviso y el diagnóstico nunca puedan contradecirse.
function medicosQueAvisar(service, specialty) {
  var rows    = getMedicosSheet().getDataRange().getValues();
  var targets = destinatariosDe(service, specialty);

  var cand = [], seen = {};
  for (var i = 1; i < rows.length; i++) {
    var med    = String(rows[i][0] || '').trim();
    var esp    = normEsp(rows[i][1]);
    var tel    = String(rows[i][2] || '').replace(/[^0-9]/g, '');
    var avisar = normEsp(rows[i][3]);
    if (!tel || avisar !== 'si') continue;
    if (targets.indexOf(esp) === -1) continue;
    if (seen[tel]) continue;          // sin repetir si un médico calza dos veces
    seen[tel] = true;
    cand.push({ medico: med, tel: tel });
  }

  // Se filtra en dos escalones, y cada uno tiene su red de seguridad: si un
  // filtro dejaría a NADIE, no se aplica. Preferimos molestar de más que
  // dejar a un paciente esperando sin que nadie se entere. El sistema nunca
  // se queda mudo.

  // 1) Turno: solo los que marcaron entrada.
  var deTurno = getTurnos();
  var enTurno = cand.filter(function(c){ return deTurno.indexOf(c.medico) !== -1; });
  var porTurno = enTurno.length > 0;
  var elegidos = porTurno ? enTurno : cand;

  // 2) Libres: al que ya está atendiendo no lo molestamos — cuando cierre
  //    su paciente va a ver la cola en el dashboard.
  var ocupados = medicosOcupados();
  var libres = elegidos.filter(function(c){ return ocupados.indexOf(c.medico) === -1; });
  var porLibre = libres.length > 0 && libres.length < elegidos.length;
  if (libres.length) elegidos = libres;

  return {
    elegidos: elegidos, candidatos: cand,
    porTurno: porTurno, porLibre: porLibre,
    todosOcupados: libres.length === 0
  };
}

// ¿A qué teléfonos hay que avisarle por este paciente?
function getDoctorPhones(service, specialty) {
  try {
    return medicosQueAvisar(service, specialty).elegidos.map(function(c){ return c.tel; });
  } catch (err) {
    return [];
  }
}

// Diagnóstico legible: nombres, nunca teléfonos.
function quienAvisa(service, specialty) {
  try {
    var r = medicosQueAvisar(service, specialty);
    return {
      ok: true,
      service: service,
      specialty: specialty,
      especialidadesQueAtienden: destinatariosDe(service, specialty),
      deTurnoAhora: getTurnos(),
      ocupadosAhora: medicosOcupados(),
      modoPrueba: getTelPrueba() ? 'ENCENDIDO — nada llega a los médicos' : 'apagado',
      seLeAvisaA: r.elegidos.map(function(c){ return c.medico; }),
      motivo: [
        r.porTurno ? 'Solo los que marcaron turno.'
                   : 'Nadie marcó turno → se avisa a todos (red de seguridad).',
        r.todosOcupados ? 'Todos están ocupados → se les avisa igual (red de seguridad).'
                        : (r.porLibre ? 'Se excluyó a los que están atendiendo.' : 'Todos estaban libres.')
      ].join(' ')
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Aviso de paciente nuevo ──────────────────────────────────
// Nunca debe romper el envío del formulario: si falla, sigue de largo.
function notifyNewPatient(data, turno) {
  try {
    var phones = getDoctorPhones(data.service, data.specialty);
    if (!phones.length) return;

    // En modo prueba todos los avisos caen en el mismo teléfono: mandamos
    // uno solo, si no llegarían tantos mensajes repetidos como médicos.
    if (getTelPrueba()) phones = [phones[0]];

    var quien = data.petName || 'Paciente';
    var svc   = data.service || '';
    if (data.specialty) svc += ' · ' + data.specialty;
    var motivo = data.complaint ? String(data.complaint).slice(0, 120) : 'Aún sin anamnesis';

    // El idioma debe coincidir EXACTO con el de la plantilla en Meta.
    // La creaste como Spanish (COL) → código es_CO.
    // El último parámetro llena el botón "Ver paciente", que abre el
    // dashboard directo en la anamnesis de este turno.
    phones.forEach(function(tel) {
      waSendTemplate(tel, 'nuevo_paciente', 'es_CO',
                     [turno || '—', quien, svc || '—', motivo],
                     turno || '');
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
      'Turno','Estado Turno','Agendado','Hora Cita','Consultorio','Llamado a las','Llamado por'
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
      bumpVersion();
      return { ok: true, id: eid, turno: t, linked: true };
    }

    // Espontáneo: fila nueva.
    var id = Utilities.getUuid();
    var turno = assignTurno(sheet, data.service);
    var row = [now.toISOString(), id].concat(anamnesisValues(data))
              .concat([turno, 'esperando', 'no', '', '', '']);
    sheet.appendRow(row);
    bumpVersion();
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
      bumpVersion();
      return { ok: true, turno: tc.getValue(), linked: true };
    }

    // Nueva fila de recepción (sin anamnesis todavía).
    var id = Utilities.getUuid();
    var now = new Date();
    var turno = assignTurno(sheet, data.service);
    var row = new Array(44);
    for (var k = 0; k < 44; k++) row[k] = '';
    row[COL.TIMESTAMP] = now.toISOString(); row[COL.ID] = id;
    row[COL.PET_NAME] = data.petName || ''; row[COL.SPECIES] = data.species || '';
    row[COL.BREED] = data.breed || ''; row[COL.OWNER_NAME] = data.owner || data.ownerName || '';
    row[COL.SERVICE] = data.service || ''; row[COL.SPECIALTY] = data.specialty || '';
    row[COL.STATUS] = 'pendiente';
    row[COL.VETESOFT_ID] = vid; row[COL.VETESOFT_HC] = data.vetesoftHc || '';
    row[COL.TURNO] = turno; row[COL.ESTADO] = 'esperando'; row[COL.AGENDADO] = 'si';
    row[COL.HORA_CITA] = data.horaCita || ''; row[COL.CONSULTORIO] = '';
    sheet.appendRow(row);
    bumpVersion();
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
function updateTurno(rowIndex, estado, consultorio, medico) {
  try {
    var sheet = getSheet();
    if (estado) {
      sheet.getRange(rowIndex, COL.ESTADO + 1).setValue(estado);
      // Cada llamado (incluidos los repetidos) actualiza la hora: así la
      // pantalla sabe cuál es el turno actual y cuál el anterior.
      if (estado === 'llamando') {
        sheet.getRange(rowIndex, COL.CALLED_AT + 1).setValue(new Date().toISOString());
        // Quién lo llamó: con esto sabemos qué médico está ocupado y a
        // quién NO hay que molestar con el próximo aviso.
        if (medico) sheet.getRange(rowIndex, COL.CALLED_BY + 1).setValue(medico);
      }
      // "Atendido" cierra el caso: sale de la sala Y de anamnesis,
      // y pasa al módulo de Atendidas. Un solo estado, no dos.
      if (estado === 'atendido') {
        sheet.getRange(rowIndex, COL.STATUS + 1).setValue('revisado');
      }
    }
    if (consultorio !== undefined && consultorio !== null && consultorio !== '')
      sheet.getRange(rowIndex, COL.CONSULTORIO + 1).setValue(consultorio);
    bumpVersion();
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
    if (data.length <= 1) return { ok: true, records: [], deTurno: getTurnos(), modoPrueba: !!getTelPrueba() };

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
        consultorio: r[COL.CONSULTORIO] || '',
        calledAt   : r[COL.CALLED_AT] || ''
      });
    }
    // Viaja con los registros para no gastar una petición aparte.
    // modoPrueba va acá para que el dashboard lo grite: si queda encendido
    // sin querer, los médicos dejan de recibir avisos EN SILENCIO.
    return { ok: true, records: records, deTurno: getTurnos(), modoPrueba: !!getTelPrueba() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Mark reviewed ────────────────────────────────────────────
function markReviewed(rowIndex) {
  try {
    const sheet = getSheet();
    sheet.getRange(rowIndex, COL.STATUS + 1).setValue('revisado');
    bumpVersion();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
