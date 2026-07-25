// ── Módulo de agenda (compartido) ────────────────────────────
// Se monta dentro de recepción y de médicos, no es una página aparte.
//   AgendaMod.mount(elemento, { medicoFijo:'Dra. X'|'', api:'...' })
//   - medicoFijo vacío  → recepción: elige el médico y ve su semana.
//   - medicoFijo puesto → médico: la agenda queda con su nombre.
//
// La vista principal es un CALENDARIO tipo Google Calendar: semana (o día),
// con las citas como bloques de color y los huecos libres clicables para
// agendar ahí mismo. Colores: cirugía morado, consulta/control rosado, verde
// cuando el paciente ya llegó, rojo cuando el médico no está disponible.
(function(){
  // Servicios AGENDABLES (los que van al desplegable de crear cita). Inyectología
  // y desparasitación NO se agendan (son por orden de llegada), así que no están.
  // "Certificado de viaje" es el nombre del antes llamado "Viajero".
  var SERVICIOS=['Consulta general','Consulta especializada','Control general','Control especializado','Cirugía','Terapia física','Vacunación','Rayos X y Ecografía','Ecocardiograma / Electrocardiograma','Certificado de viaje'];
  var DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  // Alto por minuto. En CELULAR se agranda 50% (1.35) para que la agenda se vea
  // más grande verticalmente (el ancho no puede crecer). En escritorio queda 0.9.
  var _agmMovil = !!(window.matchMedia && window.matchMedia('(max-width:640px)').matches);
  var H_INI=6*60, H_FIN=22*60, PXMIN=(_agmMovil?1.35:0.9);   // 06:00–22:00
  var Y0=10;                                        // margen arriba (para que 06:00 no pise el header)
  var ALTO=(H_FIN-H_INI)*PXMIN + Y0*2;             // alto total; la PÁGINA scrollea, no un cuadro interno

  var CSS=[
    '.agm{--ap:#8e3f9e;--apd:#6d2f7a;--apl:#f3e7f7;--abd:#e8daf0;--abg:#faf7ff;--atx:#1a0a2e;--atm:#6b5c7e;-webkit-user-select:none;user-select:none}',
    // Detalle de cita: datos copiables, duración, botón Actualizar (morado si
    // cambió), acciones Cancelar/Reprogramar en fila y Llegó grande.
    '.agm-infbox{display:flex;flex-direction:column;gap:5px;margin:9px 0}',
    '.agm-inf{display:flex;align-items:center;gap:8px;font-size:.86rem;padding:8px 10px;border-radius:9px;border:1px solid var(--abd);background:var(--abg);cursor:pointer}',
    '.agm-inf:hover{background:var(--apl)}',
    '.agm-inf-l{color:var(--atm);font-weight:800;font-size:.7rem;min-width:52px;text-transform:uppercase;letter-spacing:.3px}',
    '.agm-inf-v{color:var(--atx);font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.agm-inf-cp{font-size:.66rem;color:var(--apd);font-weight:800;opacity:.4}',
    '.agm-inf:hover .agm-inf-cp{opacity:.9}',
    '.agm-inf.copiado{background:#e7f6ec;border-color:#8fce9f}',
    '.agm-inf.copiado .agm-inf-cp{opacity:1;color:#15803d}',
    '.agm-durrow{display:flex;align-items:center;gap:10px;margin-top:4px}',
    '.agm-durnow{font-size:.85rem;color:var(--atm);font-weight:800;white-space:nowrap}',
    '.agm-durrow select{flex:1}',
    '.agm-actualizar{background:#f3eef7;border:1.5px solid var(--abd);color:var(--atm);font-weight:800;transition:all .15s}',
    '.agm-actualizar.on{background:var(--ap);border-color:var(--ap);color:#fff}',
    '.agm-mact2{display:flex;gap:8px;margin-top:12px}',
    '.agm-mact2 .agm-btn{flex:1}',
    '.agm-llego{width:100%;margin-top:8px;padding:15px;font-size:1.05rem;background:#3B6D11}',
    // Picker de servicios con color (igual que recepción): tarjetas con barra de
    // color; la elegida se pinta entera de su color.
    '.agm-svcpick{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:4px}',
    '.agm-svc{text-align:left;border:2px solid var(--abd);border-left:7px solid var(--sc);border-radius:10px;padding:9px 11px;background:#fff;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:800;color:var(--atx);line-height:1.15;transition:box-shadow .12s,border-color .12s}',
    '.agm-svc:hover{border-color:var(--sc);box-shadow:0 3px 10px rgba(58,33,64,.12)}',
    '.agm-svc.on{border-color:var(--sc);background:var(--sc);color:#fff}',
    '@media(min-width:560px){.agm-svcpick{grid-template-columns:repeat(3,1fr)}}',
    // No dejar seleccionar/copiar los textos de la UI (botones, tarjetas). El
    // "selector del mouse" que se activaba al arrastrar molestaba. En los campos
    // de texto SÍ se puede seleccionar, obvio.
    '.agm input,.agm textarea,.agm select{-webkit-user-select:text;user-select:text}',
    '.agm-tabs{display:flex;gap:8px;margin-bottom:14px}',
    '.agm-tab{flex:1;border:1.5px solid var(--abd);background:#fff;border-radius:11px;padding:10px;font-size:.88rem;font-weight:700;color:var(--atm);cursor:pointer;font-family:inherit}',
    '.agm-tab.on{background:var(--apl);color:var(--apd);border-color:var(--ap)}',
    '.agm-card{background:#fff;border:1px solid var(--abd);border-radius:14px;padding:16px}',
    '.agm-t{font-size:.92rem;font-weight:800;margin-bottom:2px;color:var(--atx)}',
    '.agm-sub{font-size:.79rem;color:var(--atm);margin-bottom:12px}',
    '.agm input,.agm select,.agm textarea{border:1.5px solid var(--abd);border-radius:9px;padding:10px 12px;font-size:.9rem;font-family:inherit;outline:none;background:var(--abg);color:var(--atx);width:100%}',
    '.agm input:focus,.agm select:focus,.agm textarea:focus{border-color:var(--ap);background:#fff}',
    '.agm-btn{border:none;border-radius:11px;padding:12px 16px;font-size:.94rem;font-weight:800;font-family:inherit;cursor:pointer;background:var(--ap);color:#fff}',
    '.agm-btn:active{transform:scale(.99)}',
    '.agm-btn-g{background:#fff;color:var(--apd);border:1.5px solid var(--abd)}',
    '.agm-block{width:100%}',
    '.agm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin-top:12px}',
    '@media(max-width:560px){.agm-row{grid-template-columns:1fr}}',
    '.agm label{display:block;font-size:.79rem;font-weight:700;color:var(--atm);margin-bottom:5px}',
    '.agm-res{margin-top:10px;display:flex;flex-direction:column;gap:7px}',
    '.agm-r{border:1.5px solid var(--abd);border-radius:10px;padding:10px 12px;cursor:pointer}',
    '.agm-r:hover{border-color:var(--ap);background:var(--apl)}',
    '.agm-rn{font-weight:700;font-size:.9rem}',
    '.agm-rm{font-size:.75rem;color:var(--atm);margin-top:2px}',
    '.agm-sel{background:var(--apl);border:1.5px solid var(--ap);border-radius:10px;padding:10px 12px;font-size:.87rem;font-weight:700;color:var(--apd);margin-top:10px;display:flex;justify-content:space-between;gap:8px}',
    '.agm-sel button{background:none;border:none;color:var(--apd);font-weight:800;cursor:pointer;font-family:inherit}',
    '.agm-nuevo{border:1.5px dashed var(--ap);background:var(--apl);color:var(--apd);border-radius:9px;padding:9px 14px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-top:8px}',
    '.agm-hint{font-size:.78rem;color:var(--atm);text-align:center;padding:8px}',
    '.agm-err{color:#c0392b;font-size:.82rem;margin-top:8px;min-height:16px}',
    '.agm-empty{color:#b0a4bf;text-align:center;padding:22px;font-size:.9rem}',
    '.agm-ok{text-align:center;padding:16px}',
    '.agm-ok .em{font-size:2.3rem;margin-bottom:8px}',
    '.agm-sp{width:24px;height:24px;border:3px solid var(--abd);border-top-color:var(--ap);border-radius:50%;animation:agmsp .8s linear infinite;margin:18px auto}',
    '@keyframes agmsp{to{transform:rotate(360deg)}}',
    '.agm-chk{display:flex;align-items:center;gap:8px;font-size:.85rem;font-weight:700;color:var(--atx);margin-top:12px;cursor:pointer}',
    '.agm-chk input{width:auto}',
    '.agm-days{display:flex;gap:5px;flex-wrap:wrap}',
    '.agm-daychip{border:1.5px solid var(--abd);background:#fff;border-radius:8px;padding:5px 9px;font-size:.78rem;font-weight:700;color:var(--atm);cursor:pointer;font-family:inherit}',
    '.agm-daychip.on{background:var(--apl);color:var(--apd);border-color:var(--ap)}',
    // ── Calendario ──
    '.agm-cal-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
    '.agm-cal-top select{width:auto;min-width:150px;flex:1}',
    '.agm-nav{display:flex;align-items:center;gap:4px}',
    '.agm-navb{border:1.5px solid var(--abd);background:#fff;border-radius:8px;padding:7px 10px;font-size:.9rem;font-weight:800;color:var(--apd);cursor:pointer;font-family:inherit;line-height:1}',
    '.agm-navlbl{font-size:.82rem;font-weight:800;color:var(--atx);min-width:120px;text-align:center}',
    '.agm-datewrap{position:relative;display:inline-block}',
    // Selector de fecha: se ve como BOTÓN (igual que ‹ › Hoy), no como texto
    // subrayado. Sigue abriendo el salto a otra fecha al tocarlo.
    '.agm-navlbl-pick{cursor:pointer;text-decoration:none;border:1.5px solid var(--abd);background:#fff;border-radius:8px;padding:6px 10px}',
    // input date transparente que cubre la etiqueta (tap = calendario nativo).
    '.agm-datewrap input[type=date]{position:absolute;top:-4px;left:-6px;right:-6px;bottom:-4px;opacity:0;cursor:pointer;border:0;padding:0;margin:0;background:transparent}',
    '.agm-seg{display:flex;border:1.5px solid var(--abd);border-radius:8px;overflow:hidden;flex-shrink:0}',
    '.agm-seg button{border:none;background:#fff;padding:5px 9px;font-size:.72rem;font-weight:700;color:var(--atm);cursor:pointer;font-family:inherit}',
    '.agm-seg button.on{background:var(--apl);color:var(--apd)}',
    // Controles bajo la navegación: primero los botones (Día/3días + Bloqueos)
    // a la derecha, y en su propio renglón la leyenda a todo el ancho para que
    // las 6 entren en UNA línea sin recortarse.
    '.agm-toolbtns{display:flex;align-items:center;gap:6px;justify-content:flex-start;margin-bottom:8px}',
    '.agm-leg{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;font-size:.64rem;color:var(--atm);margin-bottom:8px;-webkit-overflow-scrolling:touch}',
    '.agm-leg span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0}',
    '.agm-lnk{border:1px solid var(--abd);background:#fff;border-radius:8px;padding:4px 10px;font-size:.75rem;font-weight:700;color:#b45309;cursor:pointer;font-family:inherit}',
    '.agm-lnk:hover{background:#fff7ed}',
    '.agm-reprog{background:var(--apl);border:1.5px solid var(--ap);border-radius:10px;padding:9px 12px;font-size:.85rem;font-weight:700;color:var(--apd);margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.agm-dot{width:11px;height:11px;border-radius:3px;display:inline-block}',
    '.agm-scroll{overflow:visible;border:1px solid var(--abd);border-radius:12px;background:#fff}',
    // 3 días (celular): scroll HORIZONTAL dentro del cuadro. overflow-y:hidden
    // no recorta porque el alto del grid es exacto (ALTO), así la página sigue
    // scrolleando en vertical y solo lo horizontal queda dentro del cuadro.
    '.agm-hscroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}',
    '.agm-shint{font-size:.7rem;color:var(--atm);opacity:.65;text-align:center;font-weight:600;letter-spacing:.2px;padding:5px 4px}',
    '.agm-shint i{font-style:normal;opacity:.8;margin:0 4px}',
    '.agm-grid{display:grid;min-width:520px}',
    '.agm-grid.dia{min-width:auto}',
    '.agm-gcol{border-left:1px solid #e3d7ec;position:relative}',
    '.agm-gcol:first-child{border-left:none}',
    '.agm-gh{text-align:center;padding:8px 2px;font-size:.8rem;font-weight:800;color:var(--atx);border-bottom:1.5px solid var(--abd);background:#fff}',
    '.agm-gh small{display:block;font-weight:600;color:var(--atm);font-size:.68rem}',
    '.agm-gh.hoy{color:#fff;background:var(--ap)}',
    '.agm-gh.hoy small{color:#f3e7f7}',
    '.agm-guth{border-bottom:1.5px solid var(--abd)}',
    '.agm-body2{position:relative}',
    '.agm-hl{position:absolute;left:0;right:0;border-top:1px dashed #efe6f5}',
    '.agm-hl.hr{border-top:1px solid #d9c9e6}',
    '.agm-hlbl{position:absolute;left:0;right:0;text-align:right;padding-right:6px;font-size:.66rem;font-weight:700;color:#9c8bb0;transform:translateY(-6px)}',
    '.agm-hover{position:absolute;left:1px;right:1px;background:rgba(142,63,158,.16);border:1.5px solid var(--ap);border-radius:5px;pointer-events:none;z-index:4;display:flex;align-items:center;justify-content:flex-end;padding-right:5px;font-size:.66rem;font-weight:800;color:var(--apd)}',
    '.agm-ev{position:absolute;left:2px;right:2px;border-radius:6px;padding:2px 5px;font-size:.72rem;line-height:1.2;overflow:hidden;cursor:pointer;border-left:3px solid;z-index:2}',
    // Arrastrar/estirar citas. En táctil el scroll queda LIBRE (touch-action
    // auto): el arrastre se ARMA con una pulsación larga (~500ms), no con el
    // primer roce, para no mover citas sin querer al hacer scroll.
    '.agm-ev.agm-drag{cursor:grab}',
    '.agm-ev.agm-dragging{opacity:.35}',
    // Cita con el arrastre ARMADO tras la pulsación larga: se resalta para que
    // el dedo sepa que ya puede mover.
    '.agm-ev.agm-armed{outline:2px solid #6d2f7a;outline-offset:1px;box-shadow:0 4px 14px rgba(109,47,122,.4)}',
    '.agm-rz{position:absolute;left:0;right:0;bottom:0;height:10px;cursor:ns-resize;touch-action:none;display:flex;align-items:flex-end;justify-content:center}',
    '.agm-rz:after{content:"";width:26px;height:3px;margin-bottom:2px;border-radius:2px;background:rgba(0,0,0,.28)}',
    '.agm-ghost{position:fixed;z-index:9998;border-radius:6px;background:rgba(109,47,122,.94);color:#fff;font-size:.72rem;font-weight:700;padding:3px 6px;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.3);overflow:hidden;white-space:nowrap}',
    '.agm-ev b{font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    // El color de fondo/borde de cada cita se pone en línea según el servicio
    // (svcColor). "Llegó" NO cambia el color del servicio: agrega un anillo
    // verde para que se note que el paciente ya está en la clínica.
    '.agm-ev.lleg{box-shadow:inset 0 0 0 2px #16a34a}',
    '.agm-blk{position:absolute;left:2px;right:2px;border-radius:6px;background:repeating-linear-gradient(45deg,#F7C1C1,#F7C1C1 6px,#f4b4b4 6px,#f4b4b4 12px);border-left:3px solid #A32D2D;color:#501313;font-size:.7rem;font-weight:700;padding:2px 5px;overflow:hidden;cursor:pointer;z-index:2}',
    // Fuera de turno (según horario semanal): gris tenue, informativo, DEBAJO de
    // las citas (z-index 1) y sin capturar clicks (se puede agendar igual).
    '.agm-off{position:absolute;left:2px;right:2px;border-radius:4px;background:repeating-linear-gradient(45deg,rgba(148,163,184,.15),rgba(148,163,184,.15) 7px,rgba(148,163,184,.28) 7px,rgba(148,163,184,.28) 14px);color:#64748b;font-size:.6rem;font-weight:800;padding:2px 5px;overflow:hidden;pointer-events:none;z-index:1;letter-spacing:.4px}',
    // ── Modal ──
    '.agm-ov{position:fixed;inset:0;background:rgba(20,8,30,.45);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:24px 12px;overflow-y:auto}',
    '.agm-modal{background:#fff;border-radius:16px;padding:20px;max-width:460px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25)}',
    '.agm-mh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}',
    '.agm-mt{font-size:1.05rem;font-weight:800;color:var(--atx)}',
    '.agm-mx{border:none;background:none;font-size:1.4rem;cursor:pointer;color:var(--atm);line-height:1;font-family:inherit}',
    '.agm-when{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}',
    '.agm-wpill{font-size:.82rem;color:var(--apd);font-weight:800;background:var(--apl);border:1.5px solid var(--abd);border-radius:9px;padding:8px 11px;display:inline-flex;align-items:center;gap:6px}',
    '.agm-srch{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.agm-mlbl{font-size:.72rem;font-weight:800;color:var(--apd);text-transform:uppercase;letter-spacing:.4px;margin:16px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--abd)}',
    '.agm-modal .agm-row{margin-top:0}',
    '.agm-modal .agm-row>div{min-width:0}',
    '.agm-modal input:not([type=checkbox]),.agm-modal select,.agm-modal textarea{width:100%;box-sizing:border-box}',
    '.agm-modal .agm-chk{align-items:center}',
    '.agm-modal .agm-chk input[type=checkbox]{width:16px;height:16px;flex:0 0 auto;margin:0}',
    '.agm-mact{display:flex;gap:8px;margin-top:18px}',
    '.agm-warn{background:#fff4e6;border:1.5px solid #fed7aa;color:#b45309;border-radius:10px;padding:10px 12px;font-size:.82rem;font-weight:700;margin-bottom:12px;line-height:1.4}'
  ].join('\n');

  var cssInjected=false;
  function injectCSS(){ if(cssInjected)return; cssInjected=true; var s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function hoyISO(){return new Date().toLocaleDateString('en-CA');}
  function isoDe(d){ return d.toLocaleDateString('en-CA'); }
  function mkFecha(iso){ var p=iso.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function addDias(d,n){ var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
  function lunesDe(d){ var wd=d.getDay(); var off=(wd===0)?-6:(1-wd); return addDias(d,off); }   // lunes de esa semana
  function hm2min(hm){ var p=String(hm||'').split(':'); return (+p[0]||0)*60+(+p[1]||0); }
  function min2hm(m){ var h=Math.floor(m/60),mm=m%60; return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm; }
  // Segmentos FUERA de turno dentro de la ventana visible [H_INI,H_FIN], dado el
  // rango 'HH:MM-HH:MM' del médico ese día. null=sin horario (nada fuera);
  // ''=no atiende (todo fuera); rango con fin<=ini = nocturno (cruza medianoche).
  // Lunes ISO ('yyyy-mm-dd') de la semana de una fecha ISO.
  function _lunesIso(iso){ var d=new Date(iso+'T12:00:00'); var wd=d.getDay(); d.setDate(d.getDate()+(wd===0?-6:1-wd)); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function offSegsTurno(rng){
    if(rng==null||rng===undefined) return [];
    if(!rng) return [[H_INI,H_FIN]];
    var p=String(rng).split('-'); if(p.length!==2) return [];
    var ini=hm2min(p[0]), fin=hm2min(p[1]);
    var on = (fin>ini) ? [[ini,fin]] : [[ini,1440],[0,fin]];
    var onV = on.map(function(o){return [Math.max(o[0],H_INI),Math.min(o[1],H_FIN)];})
                .filter(function(o){return o[1]>o[0];}).sort(function(a,b){return a[0]-b[0];});
    var offs=[], cur=H_INI;
    onV.forEach(function(o){ if(o[0]>cur) offs.push([cur,o[0]]); cur=Math.max(cur,o[1]); });
    if(cur<H_FIN) offs.push([cur,H_FIN]);
    return offs;
  }
  function durServicio(svc){ var s=String(svc||'').toLowerCase(); if(s.indexOf('control')!==-1)return 30; if(s.indexOf('consulta')!==-1)return 60; if(s.indexOf('cirug')!==-1)return 60; if(s.indexOf('terapia')!==-1||s.indexOf('fisica')!==-1)return 60; return 30; }
  // Color del servicio = MISMOS colores de los turnos (ver serviceColor en
  // pantalla/index.html), para que la clínica maneje una sola paleta. Cirugía y
  // desparasitación no existen como turno, así que les damos un tono propio.
  function svcColor(s){ s=String(s||'').toLowerCase();
    if(s.indexOf('cardiograma')!==-1) return '#e11d48'; // ecocardio/electro (rojo)
    if(s.indexOf('control')!==-1)   return (s.indexOf('especial')!==-1) ? '#4f46e5' : '#2563eb'; // ctrl esp índigo / ctrl gral azul
    if(s.indexOf('cirug')!==-1)     return '#7c3aed'; // morado
    if(s.indexOf('desparasit')!==-1)return '#6b7280'; // gris (como inyectología)
    if(s.indexOf('especial')!==-1)  return '#f97316'; // naranja
    if(s.indexOf('vacun')!==-1)     return '#ec4899'; // rosado
    if(s.indexOf('inyect')!==-1)    return '#6b7280'; // gris
    if(s.indexOf('cardiograma')!==-1) return '#e11d48'; // rosa fuerte (cardio)
    if(s.indexOf('terapia')!==-1||s.indexOf('fisica')!==-1) return '#14b8a6'; // terapia física (teal)
    if(s.indexOf('rayos')!==-1||s.indexOf('ecograf')!==-1) return '#eab308'; // amarillo
    if(s.indexOf('viaje')!==-1)    return '#0891b2'; // cian
    if(s.indexOf('general')!==-1||s.indexOf('consulta')!==-1) return '#16a34a'; // verde
    return '#94a3b8';
  }
  var DIASEM=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  function diaChips(sel){ var s=String(sel||'').split(','); return DIASEM.map(function(n,i){ return '<button type="button" class="agm-daychip'+(s.indexOf(String(i))!==-1?' on':'')+'" data-d="'+i+'">'+n+'</button>'; }).join(''); }
  function diasSeleccionados(cont){ return cont?[].slice.call(cont.querySelectorAll('.agm-daychip.on')).map(function(b){return b.getAttribute('data-d');}).join(','):''; }
  function wireChips(cont){ if(!cont)return; cont.querySelectorAll('.agm-daychip').forEach(function(b){ b.onclick=function(){ b.classList.toggle('on'); }; }); }

  function diaSemanaDe(fecha){ return mkFecha(fecha).getDay(); }
  function bloqAplicaDia(b, fecha){ return !b.dias || String(b.dias).split(',').indexOf(String(diaSemanaDe(fecha)))!==-1; }
  // ¿Algún bloqueo cubre el slot (fecha, hora)? Espejo del backend.
  function bloqueoDe(bloqs, fecha, hhmm){
    for(var i=0;i<(bloqs||[]).length;i++){ var b=bloqs[i];
      if(fecha<b.desdeF||fecha>b.hastaF) continue;
      if(b.diario){ if(bloqAplicaDia(b,fecha)&&hhmm>=b.desdeH&&hhmm<b.hastaH) return b; continue; }
      if(b.todoDia) return b;
      var s=(fecha===b.desdeF)?b.desdeH:'00:00', e=(fecha===b.hastaF)?b.hastaH:'23:59';
      if(hhmm>=s&&hhmm<e) return b;
    }
    return null;
  }
  // Rango [ini,fin] en minutos que un bloqueo ocupa EN un día dado (clamp a la ventana visible).
  function bloqueoRangoDia(b, fecha){
    if(fecha<b.desdeF||fecha>b.hastaF) return null;
    if(b.diario&&!bloqAplicaDia(b,fecha)) return null;   // día de semana que no aplica
    var s,e;
    if(b.diario){ s=hm2min(b.desdeH); e=hm2min(b.hastaH); }
    else if(b.todoDia){ s=0; e=1440; }
    else { s=(fecha===b.desdeF ? hm2min(b.desdeH) : 0); e=(fecha===b.hastaF ? hm2min(b.hastaH) : 1440); }
    var ini=Math.max(s,H_INI), fin=Math.min(e,H_FIN);
    return (fin>ini) ? {ini:ini,fin:fin} : null;
  }

  function mount(el, opts){
    opts=opts||{};
    injectCSS();
    var api = opts.api || window.API_URL;
    var medicoFijo = opts.medicoFijo || '';
    var esMovil = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
    // vistaFija: si se pasa (recepción usa 'semana'), se fuerza esa vista y se
    // oculta el toggle Día/Semana; además Bloqueos sube al renglón de la fecha.
    var vistaFija = opts.vistaFija || '';
    var S = { medicos:[], sub:'cal', vista: vistaFija || (esMovil?'3dias':'semana'), ancla:new Date(), med:medicoFijo, selCliente:null, crear:null };

    // Sin tabs: el calendario ES la vista. "Bloqueos" queda como un botón chico
    // arriba (se usa poco), y desde ahí se vuelve. Así no repetimos "Agenda".
    el.innerHTML = '<div class="agm"><div class="agm-body"></div></div>';
    var body = el.querySelector('.agm-body');

    function cargarMedicos(cb){
      fetch(api+'?action=medicos').then(function(r){return r.json();}).then(function(res){
        // Fuera los auxiliares puros (solo especialidad "Apoyo"): no tienen agenda,
        // así que no van en el selector de médicos de la agenda.
        S.medicos = (res&&res.ok) ? (res.medicos||[]).filter(function(m){
          var e=(m.especialidades||[]).map(function(x){return String(x).toLowerCase();});
          return !(e.length>0 && e.every(function(x){return x==='apoyo';}));
        }).map(function(m){return m.medico;}) : [];
        var vis={}; S.medicos=S.medicos.filter(function(n){ if(vis[n])return false; vis[n]=true; return true; }).sort();
        if(!S.med && !medicoFijo && S.medicos.length) S.med=S.medicos[0];
        if(cb) cb();
      }).catch(function(){ if(cb) cb(); });
    }
    // Con médico fijo (doctores) NO hace falta la lista para dibujar: pintamos YA
    // (una sola llamada: citas+bloqueos) y traemos los médicos en segundo plano.
    // Sin médico fijo (recepción) sí necesitamos la lista para el selector.
    if(medicoFijo){ S.med=medicoFijo; pintar(); cargarMedicos(); }
    else { cargarMedicos(pintar); }

    function medOpts(sel){ return S.medicos.map(function(n){return '<option value="'+esc(n)+'"'+(n===sel?' selected':'')+'>'+esc(n)+'</option>';}).join(''); }
    function $(id){ return body.querySelector('#'+id); }
    function pintar(){ if(S.sub==='bloquear') pintarBloquear(); else if(S.sub==='interesados') pintarInteresados(); else pintarCal(); }

    // ══════════ CALENDARIO ══════════
    function diasVista(){
      var base=new Date(S.ancla.getFullYear(),S.ancla.getMonth(),S.ancla.getDate());
      if(S.vista==='dia') return [ base ];
      // '3dias' (celular): arranca en el DÍA ANCLA (hoy por defecto) y va HACIA
      // ADELANTE — los días que ya pasaron no importan. Muestra 6 días (se ven
      // ~3 a la vez y se recorren con scroll horizontal); las flechas avanzan 3.
      if(S.vista==='3dias'){ var out=[]; for(var i=0;i<6;i++) out.push(addDias(base,i)); return out; }
      // 'semana' (escritorio): Lun→Dom de la semana del ancla (domingo al final).
      var lun=lunesDe(S.ancla), outw=[]; for(var j=0;j<7;j++) outw.push(addDias(lun,j)); return outw;
    }
    function rangoVista(){ var d=diasVista(); return { desde:isoDe(d[0]), hasta:isoDe(d[d.length-1]) }; }
    function pasoVista(){ return S.vista==='dia'?1 : (S.vista==='3dias'?3:7); }
    function etiquetaRango(){
      var d=diasVista();
      if(S.vista==='dia') return DIAS[d[0].getDay()]+' '+d[0].getDate()+'/'+(d[0].getMonth()+1);
      var u=d[d.length-1];
      return d[0].getDate()+'/'+(d[0].getMonth()+1)+' – '+u.getDate()+'/'+(u.getMonth()+1);
    }

    function pintarCal(){
      body.innerHTML=
        '<div class="agm-cal-top">'+
          (medicoFijo?'<div class="agm-t" style="flex:1">'+esc(medicoFijo)+'</div>'
                     :'<select id="cMed">'+medOpts(S.med)+'</select>')+
          '<div class="agm-nav">'+
            '<button class="agm-navb" id="cPrev">‹</button>'+
            // La etiqueta de fecha y, ENCIMA, un input date transparente que la
            // cubre: tocarla abre el calendario nativo directo (funciona en
            // celular; showPicker() no es confiable ahí). Ver handler abajo.
            '<span class="agm-datewrap">'+
              '<span class="agm-navlbl agm-navlbl-pick" id="cLbl" title="Toca para saltar a otra fecha">'+esc(etiquetaRango())+'</span>'+
              '<input type="date" id="cPick" aria-label="Ir a una fecha">'+
            '</span>'+
            '<button class="agm-navb" id="cNext">›</button>'+
            '<button class="agm-navb" id="cHoy" style="font-size:.76rem">Hoy</button>'+
            // Con vista fija (recepción) Bloqueos e Interesados van acá, en el renglón de la fecha.
            (vistaFija ? '<button class="agm-lnk" id="cBloq" style="margin-left:8px">🚫 Bloqueos</button>'+
                         '<button class="agm-lnk" id="cInteres" style="margin-left:8px">📋 Interesados</button>' : '')+
          '</div>'+
        '</div>'+
        // Toggle Día/Semana + Bloqueos: solo cuando NO hay vista fija (doctores).
        (vistaFija ? '' :
        '<div class="agm-toolbtns">'+
          '<div class="agm-seg">'+
            '<button id="cDia" class="'+(S.vista==='dia'?'on':'')+'">Día</button>'+
            (esMovil
              ? '<button id="cSem" class="'+(S.vista==='3dias'?'on':'')+'">3 días</button>'
              : '<button id="cSem" class="'+(S.vista==='semana'?'on':'')+'">Semana</button>')+
          '</div>'+
          // Bloqueos + Interesados: recargados a la derecha (margin-left:auto en el primero).
          '<button class="agm-lnk" id="cBloq" style="margin-left:auto">🚫 Bloqueos</button>'+
          '<button class="agm-lnk" id="cInteres">📋 Interesados</button>'+
        '</div>')+
        '<div class="agm-leg">'+
          '<span><i class="agm-dot" style="background:#16a34a22;border:1px solid #16a34a"></i>Consulta</span>'+
          '<span><i class="agm-dot" style="background:#2563eb22;border:1px solid #2563eb"></i>Control</span>'+
          '<span><i class="agm-dot" style="background:#f9731622;border:1px solid #f97316"></i>Especial.</span>'+
          '<span><i class="agm-dot" style="background:#7c3aed22;border:1px solid #7c3aed"></i>Cirugía</span>'+
          '<span><i class="agm-dot" style="background:#fff;box-shadow:inset 0 0 0 2px #16a34a"></i>Llegó</span>'+
          '<span><i class="agm-dot" style="background:#F7C1C1;border:1px solid #A32D2D"></i>No disp.</span>'+
        '</div>'+
        (S.reprog?'<div class="agm-reprog">🔁 Reprogramando a <b>'+esc(S.reprog.pet)+'</b> — toca el nuevo horario. <button class="agm-lnk" id="cReprogX" style="color:var(--apd)">Cancelar</button></div>':'')+
        (S.vista==='3dias'?'<div class="agm-shint"><i>↔</i>Desliza para ver toda la semana</div>':'')+
        '<div id="cWrap" class="agm-scroll'+(S.vista==='3dias'?' agm-hscroll':'')+'"><div class="agm-sp"></div></div>';
      var sel=$('cMed'); if(sel) sel.onchange=function(){ S.med=sel.value; cargarCal(); };
      $('cBloq').onclick=function(){ S.sub='bloquear'; pintar(); };
      var ci=$('cInteres'); if(ci) ci.onclick=function(){ S.sub='interesados'; pintar(); };
      var rx=$('cReprogX'); if(rx) rx.onclick=function(){ S.reprog=null; pintarCal(); };
      $('cPrev').onclick=function(){ S.ancla=addDias(S.ancla, -pasoVista()); refrescarLbl(); cargarCal(); };
      $('cNext').onclick=function(){ S.ancla=addDias(S.ancla,  pasoVista()); refrescarLbl(); cargarCal(); };
      $('cHoy').onclick=function(){ S.ancla=new Date(); refrescarLbl(); cargarCal(); };
      var _cd=$('cDia'); if(_cd) _cd.onclick=function(){ S.vista='dia'; pintarCal(); };
      var _cs=$('cSem'); if(_cs) _cs.onclick=function(){ S.vista=esMovil?'3dias':'semana'; pintarCal(); };
      // Tocar la fecha abre el calendario nativo para saltar a un día lejano.
      // Al elegir, ese día pasa a ser el ANCLA: en 3 días arranca ahí; en día,
      // ese día; en semana, su semana.
      var pk=$('cPick');
      if(pk){
        pk.value=isoDe(S.ancla);
        pk.onfocus=function(){ if(!pk.value) pk.value=isoDe(S.ancla); };
        pk.onchange=function(){ if(pk.value){ S.ancla=mkFecha(pk.value); refrescarLbl(); cargarCal(); } };
      }
      cargarCal();
    }
    function refrescarLbl(){ var l=$('cLbl'); if(l) l.textContent=etiquetaRango(); }

    function cargarCal(){
      var med = medicoFijo || S.med;
      var W=$('cWrap'); if(!W) return;
      if(!med){ W.innerHTML='<div class="agm-empty">Elige un médico para ver su agenda.</div>'; return; }
      W.innerHTML='<div class="agm-sp"></div>';
      var r=rangoVista();
      Promise.all([
        fetch(api+'?action=citas&fecha='+r.desde+'&hasta='+r.hasta+'&medico='+encodeURIComponent(med)).then(function(x){return x.json();}),
        fetch(api+'?action=bloqueos&fecha='+r.desde+'&hasta='+r.hasta+'&medico='+encodeURIComponent(med)).then(function(x){return x.json();}),
        fetch(api+'?action=horarios&cb='+Date.now()).then(function(x){return x.json();})
      ]).then(function(rr){
        var citas=(rr[0]&&rr[0].citas)||[], bloqs=(rr[1]&&rr[1].bloqueos)||[];
        S.horarios=(rr[2]&&rr[2].horarios)||{};
        pintarGrid(W, med, citas, bloqs);
      }).catch(function(){ W.innerHTML='<div class="agm-empty">Error al cargar la agenda.</div>'; });
    }

    // Guarda una cita movida/estirada (editarCita revalida choque y bloqueo).
    // Si cae sobre un bloqueo, pregunta si mover igual (forzar). Si choca con
    // otra cita, avisa y no fuerza (dos citas encimadas no se permiten).
    function guardarMoverCita(c, fecha, hora, duracion, forzar){
      fetch(api,{method:'POST',body:JSON.stringify({action:'editarCita', id:c.id, data:{fecha:fecha, hora:hora, duracion:duracion, servicio:c.servicio, forzar:!!forzar}})})
        .then(function(r){return r.json();}).then(function(res){
          if(res&&res.ok){ cargarCal(); return; }
          if(res&&res.bloqueado){ if(confirm((res.error||'Hay un bloqueo en ese horario.')+' ¿Mover igual?')){ guardarMoverCita(c,fecha,hora,duracion,true); } else { cargarCal(); } return; }
          if(res&&res.fueraTurno){ if(confirm((res.error||'Ese horario está fuera del turno del médico.')+' ¿Mover igual?')){ guardarMoverCita(c,fecha,hora,duracion,true); } else { cargarCal(); } return; }
          alert((res&&res.error)||'No se pudo mover la cita.'); cargarCal();
        }).catch(function(){ alert('Error de conexión.'); cargarCal(); });
    }

    function pintarGrid(W, med, citas, bloqs){
      var dias=diasVista(), hoy=hoyISO();
      // '3dias' (celular): columnas fijas y angostas → se ven ~3 a la vez y la
      // semana entera se recorre con scroll horizontal. 'día' se ajusta al
      // ancho; 'semana' (escritorio) reparte a lo ancho.
      var cols = (S.vista==='3dias')
        ? '48px repeat('+dias.length+',105px)'
        : '60px repeat('+dias.length+',minmax(90px,1fr))';
      var h='<div class="agm-grid'+(S.vista==='dia'?' dia':'')+'" style="grid-template-columns:'+cols+'">';
      // encabezados
      h+='<div class="agm-guth"></div>';
      dias.forEach(function(d){ var iso=isoDe(d);
        h+='<div class="agm-gh'+(iso===hoy?' hoy':'')+'">'+DIAS[d.getDay()]+' <small>'+d.getDate()+'</small></div>';
      });
      var yOf=function(mn){ return Y0+(mn-H_INI)*PXMIN; };   // px del minuto, con margen arriba
      // columna de horas (gutter)
      h+='<div class="agm-gcol"><div class="agm-body2" style="height:'+ALTO+'px">';
      for(var m=H_INI;m<=H_FIN;m+=60){
        h+='<div class="agm-hlbl" style="top:'+yOf(m)+'px">'+min2hm(m)+'</div>';
      }
      h+='</div></div>';
      // columnas de días
      dias.forEach(function(d,di){ var iso=isoDe(d);
        h+='<div class="agm-gcol"><div class="agm-body2" data-iso="'+iso+'" style="height:'+ALTO+'px">';
        // líneas cada 30 min; las de en punto, más marcadas
        for(var mm=H_INI;mm<=H_FIN;mm+=30){ h+='<div class="agm-hl'+(mm%60===0?' hr':'')+'" style="top:'+yOf(mm)+'px"></div>'; }
        // Citas de ESE día (para abrirles hueco en el bloqueo). Se calcula una vez.
        var citasDia = citas.filter(function(c){return c.fecha===iso;}).map(function(c){
          var ci=hm2min(c.hora); return { ini:ci, fin:ci+(+c.duracion||durServicio(c.servicio)) };
        });
        // bloqueos (rojo) — clicables para editar. Se dibujan en SEGMENTOS: donde
        // cae una cita, el bloqueo deja un HUECO (no queda montado sobre la cita).
        bloqs.forEach(function(b){ var rg=bloqueoRangoDia(b,iso); if(!rg)return;
          // Huecos: las citas que caen dentro del rango del bloqueo, recortadas.
          var huecos = citasDia.filter(function(c){ return c.ini<rg.fin && c.fin>rg.ini; })
            .map(function(c){ return { ini:Math.max(c.ini,rg.ini), fin:Math.min(c.fin,rg.fin) }; })
            .sort(function(a,b){ return a.ini-b.ini; });
          // Segmentos del bloqueo = rango menos los huecos.
          var segs=[], cur=rg.ini;
          huecos.forEach(function(hc){ if(hc.ini>cur) segs.push({ini:cur,fin:hc.ini}); cur=Math.max(cur,hc.fin); });
          if(cur<rg.fin) segs.push({ini:cur,fin:rg.fin});
          segs.forEach(function(s,si){ if(s.fin-s.ini<5) return;   // no pintar rebanadas mínimas
            h+='<div class="agm-blk" data-bid="'+esc(b.id)+'" title="Toca para editar" style="top:'+yOf(s.ini)+'px;height:'+((s.fin-s.ini)*PXMIN-1)+'px">'+(si===0?'🚫 '+(b.motivo?esc(b.motivo):'No disponible'):'')+'</div>';
          });
        });
        // Fuera de turno: sombreado gris donde el médico NO atiende ese día según
        // su horario semanal (mañana/tarde/ambos/libre). Es informativo
        // (pointer-events:none): igual se puede agendar tocando y confirmando.
        var _medSem=(S.horarios||{})[med];
        if(_medSem){
          var _dias7=_medSem[_lunesIso(iso)];   // horario de ESA semana (o nada)
          if(_dias7){
            var _rng=_dias7[new Date(iso+'T12:00:00').getDay()];
            offSegsTurno(_rng).forEach(function(o){ var oi=Math.max(o[0],H_INI), of=Math.min(o[1],H_FIN); if(of-oi<5)return;
              h+='<div class="agm-off" style="top:'+yOf(oi)+'px;height:'+((of-oi)*PXMIN)+'px">Fuera de turno</div>';
            });
          }
        }
        // citas de ese día
        citas.filter(function(c){return c.fecha===iso;}).forEach(function(c){
          var ini=hm2min(c.hora), dur=+c.duracion||durServicio(c.servicio); var alt=Math.max(dur*PXMIN-1,18);
          var col=svcColor(c.servicio);
          // Las citas ya llegadas NO se arrastran ni estiran (editarCita las bloquea).
          var movible=!c.llego;
          h+='<div class="agm-ev'+(c.llego?' lleg':'')+(movible?' agm-drag':'')+'" data-id="'+esc(c.id)+'" style="top:'+yOf(ini)+'px;height:'+alt+'px;background:'+col+'22;border-left-color:'+col+';color:#1a0a2e">'+
             '<b>'+esc(c.hora)+' '+esc(c.petName||c.owner||'—')+(c.llego?' ✓':'')+(c.pagado?' 💵':'')+(c.comprobante?' 📎':'')+'</b>'+
             (alt>28?'<span>'+esc((c.servicio||'').replace(/ (general|especializado|especializada)/i,''))+'</span>':'')+
             (movible?'<div class="agm-rz" title="Estirar para cambiar la duración"></div>':'')+'</div>';
        });
        h+='</div></div>';
      });
      h+='</div>';
      W.innerHTML=h;
      // Rebote de scroll UNA vez: muestra que el cuadro se desliza (los médicos
      // no sabían que había más días a la derecha).
      if(S.vista==='3dias' && !S._hintDone){ S._hintDone=true;
        setTimeout(function(){ try{ W.scrollTo({left:90,behavior:'smooth'});
          setTimeout(function(){ try{ W.scrollTo({left:0,behavior:'smooth'}); }catch(e){} }, 550); }catch(e){} }, 450); }
      var slotY=function(bodyEl,clientY){ var rect=bodyEl.getBoundingClientRect(); var y=clientY-rect.top-Y0;
        var minuto=H_INI+Math.round((y/PXMIN)/30)*30; if(minuto<H_INI)minuto=H_INI; if(minuto>H_FIN-30)minuto=H_FIN-30; return minuto; };
      W.querySelectorAll('.agm-body2[data-iso]').forEach(function(bodyEl){
        var iso=bodyEl.getAttribute('data-iso');
        var hov=document.createElement('div'); hov.className='agm-hover'; hov.style.display='none';
        hov.style.height=(30*PXMIN-1)+'px'; bodyEl.appendChild(hov);
        // hover: resalta la franja de 30 min bajo el mouse y muestra la hora
        bodyEl.addEventListener('mousemove', function(ev){
          // Sobre una cita ya ocupada, no; sobre un BLOQUEO sí (se puede agendar
          // la excepción), así que el hover se ve igual y muestra la hora.
          if(ev.target.closest('.agm-ev')){ hov.style.display='none'; return; }
          var m=slotY(bodyEl,ev.clientY); hov.style.top=yOf(m)+'px'; hov.textContent=min2hm(m); hov.style.display='flex';
        });
        bodyEl.addEventListener('mouseleave', function(){ hov.style.display='none'; });
        // Tap en hueco vacío → agendar / reprogramar. Usamos pointerdown+pointerup
        // (NO 'click') porque en móvil, dentro de un contenedor con scroll táctil
        // (-webkit-overflow-scrolling:touch), el 'click' sintetizado tras el toque
        // a veces NO se dispara y el tap "no hacía nada" (bug clásico de iOS). Con
        // pointer events el toque es confiable; el umbral de movimiento distingue
        // el tap del scroll, y funciona igual con mouse en computador.
        var _tap=null;
        bodyEl.addEventListener('pointerdown', function(ev){
          if(ev.target.closest('.agm-ev')||ev.target.closest('.agm-blk')){ _tap=null; return; }
          _tap={ x:ev.clientX, y:ev.clientY, t:Date.now() };
        });
        bodyEl.addEventListener('pointercancel', function(){ _tap=null; });
        bodyEl.addEventListener('pointerup', function(ev){
          var s=_tap; _tap=null; if(!s) return;
          if(S._noClick) return;   // recién soltó un arrastre/estirón: no agendar
          if(ev.target.closest('.agm-ev')||ev.target.closest('.agm-blk')) return;
          if(Math.abs(ev.clientX-s.x)+Math.abs(ev.clientY-s.y)>12) return;  // se movió → fue scroll, no tap
          if(Date.now()-s.t>700) return;                                    // pulsación larga → no es tap
          var m=slotY(bodyEl,ev.clientY); var hm=min2hm(m);
          var b=bloqueoDe(bloqs,iso,hm), forz=false;
          if(b){ if(!confirm('Acá hay un bloqueo'+(b.motivo?' ('+b.motivo+')':'')+'. ¿'+(S.reprog?'Reprogramar':'Agendar una cita')+' igual en este horario?')) return; forz=true; }
          if(S.reprog) reprogramarA(iso,hm,med,forz);
          else abrirCrear(iso,hm,med,forz);
        });
      });
      // Columnas (para saber sobre qué DÍA se suelta al arrastrar entre días).
      var colsBody=[].slice.call(W.querySelectorAll('.agm-body2[data-iso]'));
      function colBajoX(x){ for(var i=0;i<colsBody.length;i++){ var r=colsBody[i].getBoundingClientRect(); if(x>=r.left&&x<=r.right) return colsBody[i]; } return null; }
      function minDesdeTop(col, topClientY){ var r=col.getBoundingClientRect(); var m=H_INI+Math.round((((topClientY-r.top)-Y0)/PXMIN)/30)*30; if(m<H_INI)m=H_INI; if(m>H_FIN-30)m=H_FIN-30; return m; }

      // Citas NO llegadas: arrastrar para MOVER, estirar (handle) para la DURACIÓN.
      // Ambas piden confirmación antes de guardar. Las llegadas solo abren detalle.
      W.querySelectorAll('.agm-ev').forEach(function(evEl){
        var id=evEl.getAttribute('data-id');
        var c=citas.filter(function(x){return String(x.id)===id;})[0];
        if(!c) return;
        if(!evEl.classList.contains('agm-drag')){   // llegada: solo abre detalle
          evEl.addEventListener('click', function(ev){ ev.stopPropagation(); abrirDetalle(c); });
          return;
        }
        // En CELULAR el arrastre es frágil (mueve citas sin querer y traba el
        // scroll). Lo desactivamos: tocar la cita abre el detalle y desde ahí
        // "🔁 Reprogramar" mueve el turno tocando el nuevo horario — flujo de
        // toques, fácil y sin accidentes. El arrastre para mover/estirar queda
        // solo en computador (mouse).
        if(esMovil){
          evEl.addEventListener('click', function(ev){ ev.stopPropagation(); abrirDetalle(c); });
          return;
        }
        var dur=+c.duracion||durServicio(c.servicio);
        // ── Estirar (handle inferior): cambia la duración ──
        var rz=evEl.querySelector('.agm-rz');
        if(rz) rz.addEventListener('pointerdown', function(ev){ ev.preventDefault(); ev.stopPropagation();
          var y0=ev.clientY, dur0=dur, nueva=dur0;
          evEl.classList.add('agm-rzing');
          function mv(e){ nueva=Math.max(30, Math.round((((dur0*PXMIN)+(e.clientY-y0))/PXMIN)/30)*30); evEl.style.height=Math.max(nueva*PXMIN-1,18)+'px'; }
          function up(){ document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up); evEl.classList.remove('agm-rzing'); S._noClick=true; setTimeout(function(){S._noClick=false;},350);
            if(nueva===dur0){ return; }
            if(!confirm('¿Cambiar la duración de la cita de '+(c.petName||c.owner||'')+' a '+nueva+' min?')){ cargarCal(); return; }
            guardarMoverCita(c, c.fecha, c.hora, nueva, false);
          }
          document.addEventListener('pointermove',mv); document.addEventListener('pointerup',up);
        });
        // ── Arrastrar el bloque: cambia día/hora ──
        evEl.addEventListener('pointerdown', function(ev){
          if(ev.target.closest('.agm-rz')) return;
          if(ev.button&&ev.button!==0) return;
          var esTactil = ev.pointerType==='touch';
          var x0=ev.clientX, y0=ev.clientY, grab=y0-evEl.getBoundingClientRect().top;
          var moviendo=false, tIso=c.fecha, tMin=hm2min(c.hora), ghost=null;
          // En táctil el arrastre se ARMA con pulsación larga; hasta entonces el
          // dedo puede hacer scroll libremente. En desktop arma de una (mouse).
          var armado = !esTactil, pressT=null;
          function armar(){ armado=true; evEl.classList.add('agm-armed');
            try{ evEl.setPointerCapture(ev.pointerId); }catch(e){}
            if(navigator.vibrate){ try{navigator.vibrate(25);}catch(e){} } }
          if(esTactil){ pressT=setTimeout(armar, 500); }
          function mv(e){ var dx=e.clientX-x0, dy=e.clientY-y0;
            // Táctil aún no armado: si el dedo se desplaza, es SCROLL → cancelar
            // el arme y soltar el gesto al navegador (no movemos la cita).
            if(!armado){ if(esTactil && Math.abs(dx)+Math.abs(dy)>10){ clearTimeout(pressT); fin(); } return; }
            if(esTactil) e.preventDefault();
            if(!moviendo){ if(Math.abs(dx)+Math.abs(dy)<6) return; moviendo=true; evEl.classList.add('agm-dragging'); }
            var col=colBajoX(e.clientX)||evEl.closest('.agm-body2[data-iso]'); if(!col) return;
            tIso=col.getAttribute('data-iso'); tMin=minDesdeTop(col, e.clientY-grab);
            if(!ghost){ ghost=document.createElement('div'); ghost.className='agm-ghost'; ghost.innerHTML='<b></b>'; document.body.appendChild(ghost); }
            var r=col.getBoundingClientRect();
            ghost.style.left=(r.left+2)+'px'; ghost.style.width=(r.width-4)+'px';
            ghost.style.top=(r.top+yOf(tMin))+'px'; ghost.style.height=Math.max(dur*PXMIN-1,18)+'px';
            ghost.firstChild.textContent=min2hm(tMin)+' '+(c.petName||c.owner||'');
          }
          function fin(){ document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up); document.removeEventListener('pointercancel',up);
            evEl.classList.remove('agm-dragging'); evEl.classList.remove('agm-armed'); if(ghost){ ghost.remove(); ghost=null; } }
          function up(e){ if(pressT) clearTimeout(pressT);
            var cancelado = e && e.type==='pointercancel';
            fin();
            if(!moviendo){
              // Sin arrastre: un toque/click normal abre el detalle. Un
              // pointercancel (el navegador tomó el gesto para hacer scroll) no.
              if(!cancelado) abrirDetalle(c);
              return;
            }
            S._noClick=true; setTimeout(function(){S._noClick=false;},350);
            var nHora=min2hm(tMin);
            if(tIso===c.fecha && nHora===c.hora){ return; }
            var d=mkFecha(tIso);
            if(!confirm('¿Mover la cita de '+(c.petName||c.owner||'')+' a '+DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1)+' a las '+nHora+'?')){ cargarCal(); return; }
            guardarMoverCita(c, tIso, nHora, dur, false);
          }
          document.addEventListener('pointermove',mv,{passive:false}); document.addEventListener('pointerup',up); document.addEventListener('pointercancel',up);
        });
      });
      W.querySelectorAll('.agm-blk').forEach(function(bk){
        bk.addEventListener('click', function(ev){ ev.stopPropagation();
          var id=bk.getAttribute('data-bid'); var b=bloqs.filter(function(x){return String(x.id)===id;})[0];
          if(!b) return;
          // Los bloqueos NO se editan desde el calendario (eso se hace en el panel
          // "Bloqueos"). Tocar un bloqueo acá es para AGENDAR una cita en ese
          // horario: se avisa que está bloqueado y, si confirman, arranca el alta
          // ya con `forzar` (para saltar el guard del bloqueo).
          var col=bk.closest('.agm-body2[data-iso]');
          var iso=col?col.getAttribute('data-iso'):b.desdeF;
          var hm=col?min2hm(slotY(col,ev.clientY)):(b.desdeH||'08:00');
          if(!confirm('Recordá que este horario tiene un BLOQUEO'+(b.motivo?' ('+esc(b.motivo)+')':'')+'.\n¿Seguro que querés agendar una cita a las '+hm+'?')) return;
          abrirCrear(iso, hm, med, true);
        });
      });
    }

    // ══════════ MODAL: crear cita ══════════
    function overlay(html){
      if(S._ov){ S._ov.remove(); S._ov=null; }   // un solo modal a la vez
      // La clase 'agm' es CLAVE: el overlay vive en <body>, fuera del contenedor
      // del módulo, así que sin ella los estilos scopeados (.agm input, .agm label…)
      // no lo alcanzan y los campos se ven crudos.
      var ov=document.createElement('div'); ov.className='agm agm-ov';
      ov.innerHTML='<div class="agm-modal">'+html+'</div>';
      ov.addEventListener('click', function(e){ if(e.target===ov) cerrarOv(); });
      document.body.appendChild(ov); S._ov=ov; return ov;
    }
    function cerrarOv(){ if(S._ov){ S._ov.remove(); S._ov=null; } S.selCliente=null; }

    function abrirCrear(iso, hora, med, forzar){
      S.crear={ fecha:iso, hora:hora, medico:med, forzar:!!forzar }; S.selCliente=null;
      try{ if(window.VetIndex) VetIndex.load(api); }catch(e){}   // precarga el índice

      var d=mkFecha(iso);
      overlay(
        '<div class="agm-mh"><div class="agm-mt">Agendar cita</div><button class="agm-mx" id="mX">×</button></div>'+
        '<div class="agm-when">'+
          '<span class="agm-wpill">📅 '+esc(DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1))+'</span>'+
          '<span class="agm-wpill">🕐 '+esc(hora)+'</span>'+
          '<span class="agm-wpill">🩺 '+esc(med)+'</span>'+
        '</div>'+
        (forzar?'<div class="agm-warn">⚠️ Este horario está bloqueado. Vas a agendar una cita igual, encima del bloqueo.</div>':'')+
        '<div class="agm-mlbl">Buscar paciente</div>'+
        '<input type="text" id="mQ" placeholder="Escribe cédula, mascota o dueño…" autocomplete="off">'+
        '<div class="agm-res" id="mRes"></div><div id="mForm"></div>'
      );
      $ov('mX').onclick=cerrarOv;
      var q=$ov('mQ');
      q.oninput=function(){ clearTimeout(S._deb); var v=q.value; S._deb=setTimeout(function(){ buscarModal(v); }, 350); };
      q.focus();
    }
    function $ov(id){ return S._ov ? S._ov.querySelector('#'+id) : null; }

    // Pinta la lista de resultados y cablea el click de cada uno.
    function _pintarRes(R, rows){
      var html='';
      rows.forEach(function(r,i){ S['_m'+i]=r;
        html+='<div class="agm-r" data-i="'+i+'"><div class="agm-rn">'+esc(r.petName||'(sin nombre)')+' — '+esc(r.owner||'')+(r.registro?' · HC '+esc(r.registro):'')+'</div>'+
          '<div class="agm-rm">'+esc(r.species||'')+(r.breed?' · '+esc(r.breed):'')+(r.documento?' · CC '+esc(r.documento):'')+(r.phone?' · 📞 '+esc(r.phone):'')+'</div></div>';
      });
      if(!rows.length) html='<div class="agm-hint">Sin resultados. Probá con la cédula, o cargá cliente nuevo.</div>';
      html+='<button class="agm-nuevo" id="mNuevo">+ Cliente nuevo (cargar a mano)</button>';
      R.innerHTML=html;
      R.querySelectorAll('.agm-r').forEach(function(dv){ dv.onclick=function(){ pickModal(+dv.getAttribute('data-i')); }; });
      var mn=$ov('mNuevo'); if(mn) mn.onclick=nuevoModal;
    }
    // Búsqueda en vivo LOCAL (índice de Vetesoft): por dueño, mascota, HC, cédula
    // o teléfono, parcial y multi-palabra, al instante. Además, si es número,
    // pregunta EN VIVO por cédula a Vetesoft (frescura: un paciente recién creado
    // aparece aunque el índice aún no lo tenga).
    function buscarModal(term){
      term=String(term||'').trim();
      var R=$ov('mRes'); if(!R) return;
      if(term.length<2){ R.innerHTML=''; return; }
      var miTerm=term; S._term=term; $ov('mForm').innerHTML='';
      function mostrar(){
        if(S._term!==miTerm) return;
        var rows=VetIndex.search(term, null, 25);
        _pintarRes(R, rows);
        // Fallback en vivo por cédula (número de 6+ dígitos): trae lo más actual.
        var num=term.replace(/\D/g,'');
        if(num.length>=6){
          fetch(api+'?action=search&cedula='+encodeURIComponent(num)+'&cb='+Date.now()).then(function(r){return r.json();}).then(function(res){
            if(S._term!==miTerm) return;
            var extra=((res&&res.results)||[]).filter(function(x){ return !rows.some(function(y){ return String(y.id)===String(x.id); }); });
            if(extra.length){ rows=extra.concat(rows); _pintarRes(R, rows); }
          }).catch(function(){});
        }
      }
      if(VetIndex.listo()){ mostrar(); }
      else { R.innerHTML='<div class="agm-hint">Cargando buscador…</div>'; VetIndex.load(api).then(function(x){ if(x) mostrar(); else { R.innerHTML='<div class="agm-hint">No se pudo cargar el buscador. Probá por cédula.</div>'; } }); }
    }
    function pickModal(i){ var r=S['_m'+i];
      var cedTerm=/^\d+$/.test(S._term||'')?S._term:'';
      S.selCliente={ petName:r.petName||'', owner:r.owner||'', cedula:r.documento||cedTerm, phone:r.phone||'', vetesoftId:r.id?String(r.id):'', vetesoftHc:r.registro||'' };
      $ov('mRes').innerHTML=''; formModal(false);
    }
    function nuevoModal(){ S.selCliente=null; $ov('mRes').innerHTML=''; formModal(true); }
    function formModal(manual){
      var cab = manual
        ? '<div class="agm-row"><div><label>Mascota</label><input id="fPet"></div><div><label>Dueño</label><input id="fOwn"></div>'+
          '<div><label>Cédula <span style="font-weight:400">(opcional)</span></label><input id="fCed" inputmode="numeric"></div>'+
          '<div><label>WhatsApp</label><input id="fTel" inputmode="numeric" placeholder="3001234567"></div></div>'
        : '<div class="agm-sel">✅ '+esc(S.selCliente.petName||'')+' — '+esc(S.selCliente.owner||'')+(S.selCliente.vetesoftHc?' · HC '+esc(S.selCliente.vetesoftHc):'')+'<button id="fReset">Cambiar</button></div>'+
          '<div style="margin-top:10px"><label>WhatsApp <span style="font-weight:400">(recordatorios)</span></label><input id="fTel" inputmode="numeric" value="'+esc(S.selCliente.phone||'')+'" placeholder="3001234567"></div>';
      $ov('mForm').innerHTML=
        cab+
        '<div class="agm-mlbl">Servicio — toca el color</div>'+
        '<div class="agm-svcpick" id="fSvcPick">'+
          SERVICIOS.map(function(s){ var sel=/consulta general/i.test(s);
            return '<button type="button" class="agm-svc'+(sel?' on':'')+'" data-v="'+esc(s)+'" style="--sc:'+svcColor(s)+'">'+esc(s)+'</button>'; }).join('')+
        '</div>'+
        '<input type="hidden" id="fSvc" value="Consulta general">'+
        '<div id="fDurWrap" style="margin-top:12px"><label>Duración</label><select id="fDur"></select></div>'+
        '<div style="margin-top:12px"><label>Notas <span style="font-weight:400">(opcional)</span></label><textarea id="fNot" rows="2" placeholder="Motivo, indicaciones…"></textarea></div>'+
        // Solo al forzar sobre un bloqueo: comprobante (foto de aprobación del Dr.).
        (S.crear.forzar
          ? '<div style="margin-top:12px"><label>📎 Comprobante <span style="font-weight:400">(foto de la aprobación del Dr.)</span></label>'+
            '<input type="file" id="fComp" accept="image/*" capture="environment"><div class="agm-hint" id="fCompHint" style="text-align:left;padding:4px 0"></div></div>'
          : '')+
        '<div class="agm-mact"><button class="agm-btn agm-btn-g" id="fCancel" style="flex:0 0 auto">Cancelar</button>'+
        '<button class="agm-btn agm-block" id="fGuardar">Agendar →</button></div>'+
        '<div class="agm-err" id="fErr"></div>';
      var rs=$ov('fReset'); if(rs) rs.onclick=function(){ S.selCliente=null; abrirCrear(S.crear.fecha,S.crear.hora,S.crear.medico,S.crear.forzar); };
      $ov('fCancel').onclick=cerrarOv;
      // Picker de servicios con color (como recepción): tocar una tarjeta la
      // marca, guarda el valor en #fSvc y recalcula la duración.
      if(S._ov) S._ov.querySelectorAll('.agm-svc').forEach(function(b){ b.onclick=function(){
        S._ov.querySelectorAll('.agm-svc').forEach(function(x){ x.classList.remove('on'); });
        b.classList.add('on'); $ov('fSvc').value=b.getAttribute('data-v'); syncDur();
      }; });
      syncDur();
      $ov('fGuardar').onclick=function(){ guardarCita(manual); };
    }
    // Duración: TODOS los servicios ofrecen 30 / 60 / 90 min. Arranca en el
    // default del servicio, pero recepción elige el que necesite.
    function syncDur(){
      $ov('fDur').innerHTML=durOpts(durServicio($ov('fSvc').value));
    }
    function guardarCita(manual){
      var err=$ov('fErr'); err.textContent='';
      var data={ fecha:S.crear.fecha, hora:S.crear.hora, medico:S.crear.medico,
        servicio:$ov('fSvc').value, duracion:+($ov('fDur').value||0), forzar:!!S.crear.forzar,
        notas:($ov('fNot')||{}).value?$ov('fNot').value.trim():'', phone:($ov('fTel')||{}).value||'' };
      if(S.selCliente){ data.petName=S.selCliente.petName; data.owner=S.selCliente.owner; data.cedula=S.selCliente.cedula; data.vetesoftId=S.selCliente.vetesoftId; data.vetesoftHc=S.selCliente.vetesoftHc; }
      else { data.petName=($ov('fPet')||{}).value||''; data.owner=($ov('fOwn')||{}).value||''; data.cedula=($ov('fCed')||{}).value||''; }
      if(!data.petName&&!data.owner){ err.textContent='Falta el paciente.'; return; }
      $ov('fGuardar').textContent='Guardando…'; $ov('fGuardar').disabled=true;
      // Si hay comprobante (foto), lo comprimimos y lo mandamos con la cita.
      var fc=$ov('fComp'), file=fc&&fc.files&&fc.files[0];
      function enviar(){
        fetch(api,{method:'POST',body:JSON.stringify({action:'crearCita',data:data})}).then(function(r){return r.json();}).then(function(res){
          if(res&&res.ok){ cerrarOv(); cargarCal(); return; }
          // Fuera del turno del médico: se puede agendar igual si recepción confirma.
          if(res&&res.fueraTurno&&!data.forzar){
            if(confirm((res.error||'Ese horario está fuera del turno del médico.')+' ¿Agendar igual?')){ data.forzar=true; enviar(); return; }
            var gg=$ov('fGuardar'); if(gg){gg.textContent='Agendar →';gg.disabled=false;} return;
          }
          var g=$ov('fGuardar'); if(g){g.textContent='Agendar →';g.disabled=false;} var e=$ov('fErr'); if(e) e.textContent=(res&&res.error)||'No se pudo agendar.';
        }).catch(function(){ var g=$ov('fGuardar'); if(g){g.textContent='Agendar →';g.disabled=false;} var e=$ov('fErr'); if(e) e.textContent='Error de conexión.'; });
      }
      if(S.crear.forzar && file){ comprimirImagen(file, function(du){ data.comprobante=du; enviar(); }); }
      else enviar();
    }
    // Achica y comprime la imagen en el CELULAR antes de subir (máx 1200px, JPEG
    // 0.7): la foto queda liviana y la plataforma no se pone pesada.
    function comprimirImagen(file, cb){
      try{
        var rd=new FileReader();
        rd.onload=function(){ var img=new Image();
          img.onload=function(){ var max=1200, w=img.width, h=img.height;
            if(w>max||h>max){ if(w>h){ h=Math.round(h*max/w); w=max; } else { w=Math.round(w*max/h); h=max; } }
            var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
            cv.getContext('2d').drawImage(img,0,0,w,h);
            try{ cb(cv.toDataURL('image/jpeg',0.7)); }catch(e){ cb(''); } };
          img.onerror=function(){ cb(''); }; img.src=rd.result; };
        rd.onerror=function(){ cb(''); }; rd.readAsDataURL(file);
      }catch(e){ cb(''); }
    }

    // ══════════ MODAL: detalle de cita (Llegó / Cancelar / Actualizar) ══════════
    function _copiaFallback(t){ try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }catch(e){} }
    function abrirDetalle(c){
      var d=mkFecha(c.fecha);
      var dur0=+c.duracion||durServicio(c.servicio);
      // Fila de dato COPIABLE (toca para copiar teléfono/cédula/nombre/HC).
      function inf(icon,label,val){ if(val==null||val==='')return '';
        return '<div class="agm-inf" data-copy="'+esc(String(val))+'"><span>'+icon+'</span>'+
          '<span class="agm-inf-l">'+label+'</span><span class="agm-inf-v">'+esc(String(val))+'</span>'+
          '<span class="agm-inf-cp">copiar</span></div>'; }
      overlay(
        '<div class="agm-mh"><div class="agm-mt">'+esc(c.petName||c.owner||'Cita')+'</div><button class="agm-mx" id="dX">×</button></div>'+
        '<div class="agm-when"><span class="agm-wpill">📅 '+esc(DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1))+'</span>'+
          '<span class="agm-wpill">🕐 '+esc(c.hora)+'</span><span class="agm-wpill">'+esc(c.servicio||'')+'</span></div>'+
        '<div class="agm-infbox">'+
          inf('👤','Dueño', c.owner)+
          inf('🪪','Cédula', c.cedula)+
          inf('🗂️','HC', c.vetesoftHc)+
          inf('📞','Teléfono', c.phone)+
        '</div>'+
        (c.comprobante?'<a href="'+esc(c.comprobante)+'" target="_blank" rel="noopener" style="color:#6d2f7a;font-weight:700;font-size:.82rem;display:inline-block;margin-top:2px">📎 Ver comprobante</a>':'')+
        (c.llego?'<div style="margin-top:6px"><b style="color:#3B6D11">✓ Ya llegó — turno '+esc(c.turno||'')+'</b></div>':'')+
        // Duración: la actual + desplegable para cambiarla (sin editar la hora).
        (c.llego?'':
          '<div class="agm-mlbl">Duración</div>'+
          '<div class="agm-durrow"><span class="agm-durnow">Actual: '+dur0+' min</span>'+
            '<select id="dDur">'+durOpts(dur0)+'</select></div>')+
        '<div class="agm-mlbl">Nota</div>'+
        '<textarea id="dNota" rows="2" placeholder="Nota para esta cita…">'+esc(c.notas||'')+'</textarea>'+
        '<label class="agm-chk"><input type="checkbox" id="dPago"'+(c.pagado?' checked':'')+'> 💵 El cliente ya pagó</label>'+
        '<div id="dPagoBox" style="margin-top:8px;'+(c.pagado?'':'display:none')+'">'+
          (c.compPago?'<a href="'+esc(c.compPago)+'" target="_blank" rel="noopener" style="color:#6d2f7a;font-weight:700;font-size:.82rem">📎 Ver comprobante</a><br>':'')+
          '<label style="font-size:.78rem;color:var(--atm)">Comprobante de pago '+(c.compPago?'(reemplazar, opcional)':'(obligatorio)')+'</label>'+
          '<input type="file" id="dCompPago" accept="image/*" capture="environment">'+
        '</div>'+
        // Actualizar: se pone MORADO solo si algo cambió (nota, pago o duración).
        (c.llego?'':'<button class="agm-btn agm-actualizar" id="dActualizar" style="width:100%;margin-top:12px">Actualizar</button>')+
        // Cancelar + Reprogramar ocupan el renglón; Llegó grande abajo.
        '<div class="agm-mact2">'+
          '<button class="agm-btn agm-btn-g" id="dCancel" style="color:#c0392b;border-color:#f1c0c0">Cancelar cita</button>'+
          (c.llego?'':'<button class="agm-btn agm-btn-g" id="dReprog">🔁 Reprogramar</button>')+
        '</div>'+
        (c.llego?'':'<button class="agm-btn agm-block agm-llego" id="dLlego" style="background:#3B6D11">✓ Llegó</button>')+
        '<div class="agm-err" id="dErr"></div>'
      );
      $ov('dX').onclick=cerrarOv;
      // Copiar al tocar un dato.
      if(S._ov) S._ov.querySelectorAll('.agm-inf').forEach(function(el){
        el.onclick=function(){ var t=el.getAttribute('data-copy'); var cp=el.querySelector('.agm-inf-cp');
          function done(){ el.classList.add('copiado'); if(cp)cp.textContent='✓ copiado'; setTimeout(function(){ el.classList.remove('copiado'); if(cp)cp.textContent='copiar'; },1200); }
          try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done,function(){_copiaFallback(t);done();}); } else { _copiaFallback(t); done(); } }catch(e){ _copiaFallback(t); done(); } };
      });
      $ov('dCancel').onclick=function(){ if(!confirm('¿Cancelar esta cita?'))return; accionCita('cancelarCita',{id:c.id}); };
      var lb=$ov('dLlego'); if(lb) lb.onclick=function(){ accionCita('llegoCita',{id:c.id}); };
      var rb=$ov('dReprog'); if(rb) rb.onclick=function(){ S.reprog={ id:c.id, pet:(c.petName||c.owner||'la cita') }; cerrarOv(); pintarCal(); };
      var pc=$ov('dPago'); if(pc) pc.onchange=function(){ var b=$ov('dPagoBox'); if(b) b.style.display=this.checked?'':'none'; marcarCambio(); };
      // Botón Actualizar: morado si cambió algo.
      function hayCambio(){
        var nota=($ov('dNota')||{}).value||''; var pagado=!!($ov('dPago')||{}).checked;
        var dur=parseInt(($ov('dDur')||{}).value,10)||dur0; var file=($ov('dCompPago')&&$ov('dCompPago').files&&$ov('dCompPago').files[0]);
        return nota!==(c.notas||'') || pagado!==!!c.pagado || dur!==dur0 || !!file;
      }
      function marcarCambio(){ var b=$ov('dActualizar'); if(b) b.classList.toggle('on', hayCambio()); }
      ['dNota','dDur','dCompPago'].forEach(function(id){ var el=$ov(id); if(el){ el.addEventListener('input',marcarCambio); el.addEventListener('change',marcarCambio); } });
      var ac=$ov('dActualizar'); if(ac) ac.onclick=function(){
        var e=$ov('dErr'); if(e)e.textContent='';
        if(!hayCambio()){ cerrarOv(); return; }
        var nota=($ov('dNota')||{}).value||''; var pagado=!!($ov('dPago')||{}).checked;
        var dur=parseInt(($ov('dDur')||{}).value,10)||dur0; var file=($ov('dCompPago')&&$ov('dCompPago').files&&$ov('dCompPago').files[0])||null;
        if(pagado && !file && !c.compPago){ if(e)e.textContent='Adjuntá el comprobante de pago.'; return; }
        ac.textContent='Guardando…'; ac.disabled=true;
        function falla(msg){ ac.textContent='Actualizar'; ac.disabled=false; if(e)e.textContent=msg||'No se pudo guardar.'; }
        function guardarPagoNota(cb){
          if(nota===(c.notas||'') && pagado===!!c.pagado && !file){ cb(); return; }
          function envia(comp){ var data={notas:nota,pagado:pagado}; if(comp)data.comprobante=comp;
            fetch(api,{method:'POST',body:JSON.stringify({action:'marcarPagoNota',id:c.id,data:data})}).then(function(r){return r.json();}).then(function(res){ if(res&&res.ok)cb(); else falla(res&&res.error); }).catch(function(){falla('Error de conexión.');}); }
          if(pagado && file){ comprimirImagen(file,function(du){envia(du);}); } else envia(''); }
        guardarPagoNota(function(){
          if(dur!==dur0){ cerrarOv(); guardarMoverCita(c, c.fecha, c.hora, dur, false); }  // recarga sola
          else { cerrarOv(); cargarCal(); }
        });
      };
    }
    function accionCita(action, payload){
      var e=$ov('dErr'); if(e)e.textContent='';
      payload.action=action;
      fetch(api,{method:'POST',body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(res){
        if(res&&res.ok){ cerrarOv(); cargarCal(); }
        else { if(e) e.textContent=(res&&res.error)||'No se pudo.'; }
      }).catch(function(){ if(e) e.textContent='Error de conexión.'; });
    }
    // Reprograma la cita en modo S.reprog al slot tocado.
    function reprogramarA(iso, hm, med, forzar){
      var rp=S.reprog; if(!rp) return;
      var d=mkFecha(iso);
      if(!confirm('¿Reprogramar a '+rp.pet+' para '+DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1)+' a las '+hm+' con '+med+'?')) return;
      fetch(api,{method:'POST',body:JSON.stringify({action:'editarCita',id:rp.id,data:{fecha:iso,hora:hm,medico:med,forzar:!!forzar}})})
        .then(function(r){return r.json();}).then(function(res){
          if(res&&res.ok){ S.reprog=null; pintarCal(); }
          else { alert((res&&res.error)||'No se pudo reprogramar.'); }
        }).catch(function(){ alert('Error de conexión.'); });
    }

    // ══════════ MODAL: editar bloqueo (desde el calendario) ══════════
    function abrirBloqueoModal(b, med, isoClic, hmClic){
      var d=mkFecha(b.desdeF);
      overlay(
        '<div class="agm-mh"><div class="agm-mt">🚫 Bloqueo</div><button class="agm-mx" id="eX">×</button></div>'+
        '<div class="agm-when"><span class="agm-wpill">🩺 '+esc(b.medico)+'</span>'+(b.diario?'<span class="agm-wpill">Todos los días</span>':'')+'</div>'+
        '<div class="agm-row">'+
          '<div><label>Desde (día)</label><input type="date" id="eDesF" value="'+esc(b.desdeF)+'"></div>'+
          '<div><label>Hasta (día)</label><input type="date" id="eHasF" value="'+esc(b.hastaF==='2099-12-31'?'':b.hastaF)+'"></div>'+
        '</div>'+
        '<label class="agm-chk"><input type="checkbox" id="eDiario"'+(b.diario?' checked':'')+'> Repetir todos los días (misma franja horaria)</label>'+
        '<div id="eDiasWrap" style="'+(b.diario?'':'display:none;')+'margin:6px 0 2px">'+
          '<label style="margin-bottom:6px">Solo estos días <span style="font-weight:400">(vacío = todos)</span></label>'+
          '<div class="agm-days">'+diaChips(b.dias||'')+'</div></div>'+
        '<label class="agm-chk"><input type="checkbox" id="eTodo"'+(b.todoDia?' checked':'')+'> Día(s) completo(s), sin horario</label>'+
        '<div class="agm-row" id="eHoras">'+
          '<div><label>Desde (hora)</label><select id="eDesH">'+horaOpts(b.desdeH)+'</select></div>'+
          '<div><label>Hasta (hora)</label><select id="eHasH">'+horaOpts(b.hastaH)+'</select></div>'+
        '</div>'+
        '<div style="margin-top:12px"><label>Motivo</label><input id="eMot" value="'+esc(b.motivo||'')+'" placeholder="Vacaciones, tema familiar…"></div>'+
        '<div class="agm-mact">'+
          '<button class="agm-btn agm-btn-g" id="eQuitar" style="color:#c0392b;border-color:#f1c0c0">Quitar</button>'+
          '<button class="agm-btn agm-block" id="eGuardar">Guardar cambios</button>'+
        '</div>'+
        '<button class="agm-nuevo" id="eAgendar" style="margin-top:10px">📅 Agendar una cita igual en este horario</button>'+
        '<div class="agm-err" id="eErr"></div>'
      );
      wireChips($ov('eDiasWrap'));
      var syncH=function(){ var todo=$ov('eTodo').checked && !$ov('eDiario').checked; $ov('eHoras').style.display=todo?'none':''; $ov('eDiasWrap').style.display=$ov('eDiario').checked?'':'none'; };
      $ov('eDiario').onchange=function(){ if(this.checked)$ov('eTodo').checked=false; syncH(); };
      $ov('eTodo').onchange=function(){ if(this.checked)$ov('eDiario').checked=false; syncH(); };
      syncH();
      $ov('eX').onclick=cerrarOv;
      $ov('eQuitar').onclick=function(){ if(!confirm('¿Quitar este bloqueo? El horario vuelve a quedar disponible.'))return; accionBloqueo('cancelarBloqueo',{id:b.id}); };
      $ov('eAgendar').onclick=function(){ abrirCrear(isoClic||b.desdeF, hmClic||(b.todoDia?'08:00':b.desdeH), med||b.medico, true); };
      $ov('eGuardar').onclick=function(){
        var diario=$ov('eDiario').checked, todo=$ov('eTodo').checked&&!diario;
        var data={ medico:b.medico, desdeF:$ov('eDesF').value, hastaF:$ov('eHasF').value, diario:diario, todoDia:todo,
          dias: diario ? diasSeleccionados($ov('eDiasWrap')) : '',
          desdeH:todo?'':$ov('eDesH').value, hastaH:todo?'':$ov('eHasH').value, motivo:$ov('eMot').value.trim() };
        accionBloqueo('editarBloqueo',{id:b.id,data:data});
      };
    }
    function accionBloqueo(action,payload){
      var e=$ov('eErr'); if(e)e.textContent='';
      payload.action=action;
      fetch(api,{method:'POST',body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(res){
        if(res&&res.ok){ cerrarOv(); cargarCal(); }
        else { if(e)e.textContent=(res&&res.error)||'No se pudo.'; }
      }).catch(function(){ if(e)e.textContent='Error de conexión.'; });
    }

    // ══════════ BLOQUEOS ══════════
    function horaOpts(sel){ var h='';for(var m=6*60;m<=20*60;m+=30){var v=min2hm(m);h+='<option value="'+v+'"'+(v===sel?' selected':'')+'>'+v+'</option>';}return h; }
    // Duración de un servicio: opciones fijas 30 / 60 / 90 min.
    function durOpts(sel){ sel=parseInt(sel,10)||60; if([30,60,90].indexOf(sel)===-1){ sel=[30,60,90].reduce(function(a,b){return Math.abs(b-sel)<Math.abs(a-sel)?b:a;}); } return [30,60,90].map(function(m){ return '<option value="'+m+'"'+(m===sel?' selected':'')+'>'+m+' min</option>'; }).join(''); }
    function pintarBloquear(){
      body.innerHTML=
        '<button class="agm-lnk" id="bVolver" style="margin-bottom:12px;color:var(--apd)">‹ Volver a la agenda</button>'+
        '<div class="agm-card"><div class="agm-t">Marcar no disponible</div>'+
        '<div class="agm-sub">'+(medicoFijo?'Bloquea tu agenda':'Bloquea la agenda de un médico')+' por vacaciones, un tema familiar, lo que sea. Recepción lo ve y no se puede agendar encima.</div>'+
        (medicoFijo?'':'<div style="margin-bottom:10px"><label>Médico</label><select id="bMed">'+medOpts(S.med)+'</select></div>')+
        '<div class="agm-row">'+
          '<div><label>Desde (día)</label><input type="date" id="bDesF" value="'+hoyISO()+'"></div>'+
          '<div><label>Hasta (día)</label><input type="date" id="bHasF" value="'+hoyISO()+'"></div>'+
        '</div>'+
        '<label class="agm-chk"><input type="checkbox" id="bDiario"> Repetir todos los días (ej. 7 a 9 cada día)</label>'+
        '<div id="bDiasWrap" style="display:none;margin:6px 0 2px">'+
          '<label style="margin-bottom:6px">Solo estos días <span style="font-weight:400">(vacío = todos)</span></label>'+
          '<div class="agm-days">'+diaChips('')+'</div></div>'+
        '<label class="agm-chk"><input type="checkbox" id="bTodo"> Día(s) completo(s) — sin horario</label>'+
        '<div class="agm-row" id="bHoras">'+
          '<div><label>Desde (hora)</label><select id="bDesH">'+horaOpts()+'</select></div>'+
          '<div><label>Hasta (hora)</label><select id="bHasH">'+horaOpts()+'</select></div>'+
        '</div>'+
        '<div class="agm-sub" id="bDiarioTip" style="display:none;margin-top:2px">Con "todos los días", dejá "Hasta (día)" vacío para que sea indefinido, o poné una fecha de fin.</div>'+
        '<div style="margin-top:12px"><label>Motivo <span style="font-weight:400">(opcional)</span></label><input id="bMot" placeholder="Vacaciones, tema familiar…"></div>'+
        '<button class="agm-btn agm-block" style="margin-top:14px" id="bGuardar">🚫 Guardar bloqueo</button>'+
        '<div class="agm-err" id="bErr"></div>'+
        '<div class="agm-t" style="margin-top:20px">Bloqueos activos</div>'+
        '<div id="bList"><div class="agm-sp"></div></div></div>';
      $('bVolver').onclick=function(){ S.sub='cal'; pintar(); };
      var bm=$('bMed'); if(bm) bm.onchange=function(){ cargarBloqueos(); };
      wireChips($('bDiasWrap'));
      var syncB=function(){ var todo=$('bTodo').checked&&!$('bDiario').checked; $('bHoras').style.display=todo?'none':''; $('bDiarioTip').style.display=$('bDiario').checked?'':'none'; $('bDiasWrap').style.display=$('bDiario').checked?'':'none'; };
      $('bDiario').onchange=function(){ if(this.checked)$('bTodo').checked=false; syncB(); };
      $('bTodo').onchange=function(){ if(this.checked)$('bDiario').checked=false; syncB(); };
      $('bGuardar').onclick=guardarBloqueo;
      cargarBloqueos();
    }
    function guardarBloqueo(){
      var err=$('bErr'); err.textContent='';
      var medico=medicoFijo || (($('bMed')||{}).value||'');
      if(!medico){ err.textContent='Elige el médico.'; return; }
      var diario=$('bDiario').checked, todo=$('bTodo').checked&&!diario;
      var data={ medico:medico, desdeF:$('bDesF').value, hastaF:$('bHasF').value, diario:diario,
        dias: diario ? diasSeleccionados($('bDiasWrap')) : '',
        todoDia:todo, desdeH:todo?'':$('bDesH').value, hastaH:todo?'':$('bHasH').value, motivo:$('bMot').value.trim() };
      if(!data.desdeF){ err.textContent='Pon el día de inicio.'; return; }
      $('bGuardar').textContent='Guardando…'; $('bGuardar').disabled=true;
      fetch(api,{method:'POST',body:JSON.stringify({action:'crearBloqueo',data:data})}).then(function(r){return r.json();}).then(function(res){
        var g=$('bGuardar'); if(g){ g.textContent='🚫 Guardar bloqueo'; g.disabled=false; }
        if(res&&res.ok){ $('bMot').value=''; cargarBloqueos(); }
        else { var e=$('bErr'); if(e) e.textContent=(res&&res.error)||'No se pudo guardar.'; }
      }).catch(function(){ var g=$('bGuardar'); if(g){ g.textContent='🚫 Guardar bloqueo'; g.disabled=false; } var e=$('bErr'); if(e) e.textContent='Error de conexión.'; });
    }
    function cargarBloqueos(){
      var L=$('bList'); if(!L) return; L.innerHTML='<div class="agm-sp"></div>';
      var med=medicoFijo || (($('bMed')||{}).value||'');
      fetch(api+'?action=bloqueos&medico='+encodeURIComponent(med)).then(function(r){return r.json();}).then(function(res){
        var bs=(res&&res.bloqueos)||[];
        if(!bs.length){ L.innerHTML='<div class="agm-empty">'+(med?'Sin bloqueos activos para este médico.':'Elige un médico para ver sus bloqueos.')+'</div>'; return; }
        L.innerHTML=bs.map(bloqHtml).join('');
        L.querySelectorAll('.agm-cx').forEach(function(b){ b.onclick=function(){ cancelarBloqueo(b.getAttribute('data-id'),b); }; });
      }).catch(function(){ L.innerHTML='<div class="agm-empty">Error de conexión.</div>'; });
    }
    function bloqRango(b){
      if(b.diario){
        var dd = b.dias ? b.dias.split(',').map(function(x){return DIASEM[+x];}).join(', ') : 'Todos los días';
        return dd+' '+b.desdeH+'–'+b.hastaH+(b.hastaF&&b.hastaF!=='2099-12-31'?' (hasta '+b.hastaF+')':'');
      }
      var dias=(b.desdeF===b.hastaF)?b.desdeF:(b.desdeF+' → '+b.hastaF);
      return dias+' · '+(b.todoDia?'todo el día':(b.desdeH+'–'+b.hastaH));
    }
    function bloqHtml(b){
      return '<div style="border:1px solid var(--abd);border-left:5px solid #b45309;border-radius:11px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">'+
        '<div style="color:#b45309;font-size:1.2rem">🚫</div><div style="flex:1;min-width:0">'+
        (medicoFijo?'':'<div style="font-weight:700;font-size:.88rem">'+esc(b.medico||'')+'</div>')+
        '<div style="font-weight:600;font-size:.82rem;color:var(--atx)">'+esc(bloqRango(b))+'</div>'+
        (b.motivo?'<div style="font-size:.75rem;color:var(--atm)">'+esc(b.motivo)+'</div>':'')+'</div>'+
        '<button class="agm-cx" data-id="'+esc(b.id)+'" style="border:none;background:none;color:#c0392b;font-weight:800;cursor:pointer;font-size:.74rem;font-family:inherit">Quitar</button></div>';
    }
    function cancelarBloqueo(id,btn){
      if(!confirm('¿Quitar este bloqueo? El horario vuelve a quedar disponible.')) return; btn.textContent='…';
      fetch(api,{method:'POST',body:JSON.stringify({action:'cancelarBloqueo',id:id})}).then(function(r){return r.json();}).then(function(){ cargarBloqueos(); }).catch(function(){ cargarBloqueos(); });
    }

    // ══════════ INTERESADOS (lista de espera POR MÉDICO) ══════════
    // Cada médico ve solo los suyos. En recepción, el selector de médico del panel
    // cambia la lista (igual que la agenda). Cada tarjeta muestra para cuándo quería
    // la cita el cliente y desde cuándo está esperando.
    function _intMedActual(){ return medicoFijo || (($('iMed')||{}).value) || S.med || ''; }
    function _fechaCortaISO(iso){ try{ var d=mkFecha(iso); return DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1); }catch(e){ return iso; } }
    function _fechaCreada(iso){ try{ var d=new Date(iso); if(isNaN(d)) return ''; return d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear(); }catch(e){ return ''; } }
    function _haceCuanto(iso){ try{ var t=new Date(iso).getTime(); if(isNaN(t)) return ''; var dias=Math.floor((Date.now()-t)/86400000); if(dias<=0) return 'hoy'; if(dias===1) return 'ayer'; return 'hace '+dias+' días'; }catch(e){ return ''; } }
    function pintarInteresados(){
      body.innerHTML=
        '<button class="agm-lnk" id="iVolver" style="margin-bottom:12px;color:var(--apd)">‹ Volver a la agenda</button>'+
        '<div class="agm-card"><div class="agm-t">📋 Interesados</div>'+
        '<div class="agm-sub">Gente que quería una cita y no había cupo. Cuando se libere un hueco, los contactás desde acá. La lista es <b>de cada médico</b>.</div>'+
        (medicoFijo?'':'<div style="margin-bottom:10px"><label>Médico</label><select id="iMed">'+medOpts(S.med)+'</select></div>')+
        // Buscador de Vetesoft: si el cliente ya tiene historia, lo encontrás acá y
        // se autocompleta el dueño y el teléfono. Si no aparece, se carga a mano abajo.
        '<div style="margin-bottom:6px"><label>Buscar en Vetesoft <span style="font-weight:400">(cédula, nombre o dueño)</span></label>'+
          '<input id="iBusca" type="text" autocomplete="off" placeholder="Escribí para buscar el cliente…"></div>'+
        '<div id="iBuscRes" style="margin-bottom:8px"></div>'+
        '<div class="agm-row">'+
          '<div><label>Nombre del dueño</label><input id="iNom" type="text" placeholder="Nombre"></div>'+
          '<div><label>WhatsApp</label><input id="iTel" type="tel" inputmode="numeric" maxlength="10" placeholder="3001234567"></div>'+
        '</div>'+
        '<div class="agm-row">'+
          '<div><label>Servicio</label><select id="iSvc"><option value="">— Servicio —</option>'+SERVICIOS.map(function(s){return '<option value="'+esc(s)+'">'+esc(s)+'</option>';}).join('')+'</select></div>'+
          '<div><label>¿Para cuándo la quería?</label><input type="date" id="iFec"></div>'+
        '</div>'+
        '<div class="agm-row">'+
          '<div><label>Hora aproximada</label><select id="iPer"><option value="">—</option>'+['Mañana','Mediodía','Primera hora de la tarde','Tarde','Fin de tarde','Noche'].map(function(p){return '<option>'+esc(p)+'</option>';}).join('')+'</select></div>'+
          '<div><label>Notas <span style="font-weight:400">(sugerido)</span></label><input id="iNot" type="text" placeholder="Ej: puede venir cualquier día que le avisen"></div>'+
        '</div>'+
        '<button class="agm-btn" style="margin-top:12px;background:#0d9488;color:#fff" id="iAdd">➕ Agregar a la lista</button>'+
        '<div class="agm-err" id="iErr"></div>'+
        '<div class="agm-t" style="margin-top:20px">En espera <span id="iMedLbl" style="font-weight:400;color:var(--atm);font-size:.8rem"></span></div>'+
        '<div id="iList"><div class="agm-sp"></div></div></div>';
      $('iVolver').onclick=function(){ S.sub='cal'; pintar(); };
      var im=$('iMed'); if(im) im.onchange=function(){ S.med=im.value; cargarInteres(); };
      $('iAdd').onclick=guardarInteres;
      // Precarga el índice para que el buscador sea instantáneo.
      try{ if(window.VetIndex) VetIndex.load(api); }catch(e){}
      var ib=$('iBusca'); if(ib){ var deb=null; ib.oninput=function(){ clearTimeout(deb); deb=setTimeout(function(){ buscarVetInteres(ib.value.trim()); }, 200); }; }
      cargarInteres();
    }
    // Busca el cliente en el índice de Vetesoft para autocompletar dueño + teléfono.
    function buscarVetInteres(term){
      var R=$('iBuscRes'); if(!R) return;
      if(term.length<2){ R.innerHTML=''; return; }
      var rows = window.VetIndex ? VetIndex.search(term, null, 8) : [];
      _pintarVetInteres(R, rows);
      // Frescura: si no hay nada local y es una cédula completa, pregunta en vivo.
      var num=term.replace(/\D/g,'');
      if(rows.length===0 && num.length>=6){
        fetch(api+'?action=search&cedula='+encodeURIComponent(num)+'&cb='+Date.now()).then(function(r){return r.json();}).then(function(res){
          var found=(res&&res.results)||[]; if(found.length) _pintarVetInteres(R, found);
        }).catch(function(){});
      }
    }
    function _pintarVetInteres(R, rows){
      if(!rows.length){ R.innerHTML='<div style="font-size:.75rem;color:var(--atm);padding:2px 1px">Sin coincidencias — cargalo a mano abajo.</div>'; return; }
      R.innerHTML=rows.map(function(r){
        return '<div class="agm-vres" style="border:1px solid var(--abd);border-radius:8px;padding:6px 9px;margin-bottom:4px;cursor:pointer;font-size:.78rem">'+
          '<b>'+esc(r.owner||r.petName||'—')+'</b>'+(r.registro?' · HC '+esc(r.registro):'')+(r.documento?' · CC '+esc(r.documento):'')+(r.phone?' · 📞 '+esc(r.phone):'')+'</div>';
      }).join('');
      var items=R.querySelectorAll('.agm-vres');
      rows.forEach(function(r,i){ if(items[i]) items[i].onclick=function(){ _pickVetInteres(r); }; });
    }
    function _pickVetInteres(r){
      var n=$('iNom'); if(n) n.value=r.owner||'';
      var t=$('iTel'); if(t) t.value=String(r.phone||'').replace(/\D/g,'').slice(-10);
      var R=$('iBuscRes'); if(R) R.innerHTML='<div style="font-size:.76rem;color:#0d9488;font-weight:700;padding:2px 1px">✓ '+esc(r.owner||'(sin nombre)')+(r.registro?' · HC '+esc(r.registro):'')+'</div>';
      var ib=$('iBusca'); if(ib) ib.value='';
    }
    function guardarInteres(){
      var err=$('iErr'); if(err) err.textContent='';
      var med=_intMedActual();
      if(!med){ if(err) err.textContent='Elegí el médico.'; return; }
      var nom=(($('iNom')||{}).value||'').trim();
      var tel=(($('iTel')||{}).value||'').trim();
      if(!nom && !tel){ if(err) err.textContent='Poné al menos un nombre o un teléfono.'; return; }
      var fec=(($('iFec')||{}).value||''); var per=(($('iPer')||{}).value||'');
      var deseada=[fec?_fechaCortaISO(fec):'', per].filter(Boolean).join(' · ');
      var data={ nombre:nom, tel:tel, medico:med, servicio:(($('iSvc')||{}).value||''),
                 notas:(($('iNot')||{}).value||''), deseada:deseada };
      var b=$('iAdd'); if(b){ b.textContent='Agregando…'; b.disabled=true; }
      fetch(api,{method:'POST',body:JSON.stringify({action:'agregarInteresado',data:data})}).then(function(r){return r.json();}).then(function(res){
        var g=$('iAdd'); if(g){ g.textContent='➕ Agregar a la lista'; g.disabled=false; }
        if(res&&res.ok){ ['iNom','iTel','iFec','iNot'].forEach(function(id){var e=$(id); if(e)e.value='';}); var sv=$('iSvc'); if(sv)sv.value=''; var pe=$('iPer'); if(pe)pe.value=''; cargarInteres(); }
        else { if(err) err.textContent=(res&&res.error)||'No se pudo agregar.'; }
      }).catch(function(){ var g=$('iAdd'); if(g){ g.textContent='➕ Agregar a la lista'; g.disabled=false; } if(err) err.textContent='Error de conexión.'; });
    }
    function cargarInteres(){
      var L=$('iList'); if(!L) return; L.innerHTML='<div class="agm-sp"></div>';
      var med=_intMedActual();
      var lbl=$('iMedLbl'); if(lbl) lbl.textContent=med?('· '+med):'';
      if(!med){ L.innerHTML='<div class="agm-empty">Elegí un médico para ver sus interesados.</div>'; return; }
      fetch(api+'?action=interesados&medico='+encodeURIComponent(med)+'&cb='+Date.now()).then(function(r){return r.json();}).then(function(res){
        var xs=(res&&res.interesados)||[];
        if(!xs.length){ L.innerHTML='<div class="agm-empty">Sin interesados en espera para este médico.</div>'; return; }
        L.innerHTML=xs.map(intHtml).join('');
        L.querySelectorAll('[data-iact]').forEach(function(b){ b.onclick=function(){ marcarInteres(b.getAttribute('data-id'), b.getAttribute('data-iact')); }; });
      }).catch(function(){ L.innerHTML='<div class="agm-empty">Error de conexión.</div>'; });
    }
    function intHtml(it){
      var tel=String(it.telefono||'').replace(/\D/g,'');
      var wa=tel?'<a class="agm-lnk" style="color:#128c3e;text-decoration:none" target="_blank" href="https://wa.me/57'+tel+'">💬 WhatsApp</a>':'';
      var badge=it.estado==='contactado'?'<span style="background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 7px;font-size:.68rem;font-weight:700;margin-left:6px">Contactado</span>':'';
      var det=[];
      if(it.servicio) det.push('🩺 '+esc(it.servicio));
      if(it.deseada)  det.push('🗓️ Quería: '+esc(it.deseada));
      var espera='⏳ Esperando desde '+esc(_fechaCreada(it.creada))+' ('+esc(_haceCuanto(it.creada))+')';
      return '<div style="border:1px solid var(--abd);border-left:5px solid #0d9488;border-radius:11px;padding:10px 12px;margin-bottom:8px">'+
        '<div style="font-weight:800;font-size:.9rem">'+esc(it.nombre||'(sin nombre)')+badge+'</div>'+
        (tel?'<div style="font-size:.8rem;color:var(--atx)">📞 '+esc(it.telefono)+'</div>':'')+
        (det.length?'<div style="font-size:.78rem;color:var(--atx);margin-top:2px">'+det.join(' · ')+'</div>':'')+
        '<div style="font-size:.76rem;color:var(--apd);font-weight:600;margin-top:2px">'+espera+'</div>'+
        (it.notas?'<div style="font-size:.75rem;color:var(--atm);margin-top:2px">📝 '+esc(it.notas)+'</div>':'')+
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;align-items:center">'+wa+
          '<button class="agm-lnk" data-iact="contactado" data-id="'+esc(it.id)+'">✓ Contactado</button>'+
          '<button class="agm-lnk" data-iact="agendo" data-id="'+esc(it.id)+'" style="color:#0d9488;font-weight:700">📅 Agendó</button>'+
          '<button class="agm-lnk" data-iact="descartado" data-id="'+esc(it.id)+'" style="color:#c0392b">✕ Descartar</button>'+
        '</div></div>';
    }
    function marcarInteres(id, estado){
      if((estado==='agendo'||estado==='descartado') && !confirm(estado==='agendo'?'¿Marcar como agendó? Sale de la lista.':'¿Descartar? Sale de la lista.')) return;
      fetch(api,{method:'POST',body:JSON.stringify({action:'actualizarInteresado',id:id,estado:estado})}).then(function(r){return r.json();}).then(function(){ cargarInteres(); }).catch(function(){ cargarInteres(); });
    }
  }

  window.AgendaMod = { mount: mount };

  // ── Índice local de pacientes de Vetesoft ───────────────────────────────
  // Baja el índice UNA vez (lo cachea en IndexedDB por versión) y busca LOCAL:
  // por dueño, mascota, HC, cédula o teléfono, parcial y multi-palabra, al
  // instante. La API de Vetesoft no permite buscar por dueño/HC/parcial; esto sí.
  window.VetIndex = (function(){
    var API=null, _mem=null, _loading=null;
    function _norm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }
    // IndexedDB mínimo (clave-valor) para persistir el índice entre recargas.
    function _idb(){ return new Promise(function(res,rej){ try{ var q=indexedDB.open('acvet',1);
      q.onupgradeneeded=function(){ try{ q.result.createObjectStore('kv'); }catch(e){} };
      q.onsuccess=function(){res(q.result);}; q.onerror=function(){rej(q.error);}; }catch(e){ rej(e); } }); }
    function _idbGet(k){ return _idb().then(function(db){ return new Promise(function(res){ try{ var t=db.transaction('kv','readonly').objectStore('kv').get(k); t.onsuccess=function(){res(t.result||null);}; t.onerror=function(){res(null);}; }catch(e){res(null);} }); }).catch(function(){return null;}); }
    function _idbPut(k,v){ return _idb().then(function(db){ return new Promise(function(res){ try{ var t=db.transaction('kv','readwrite').objectStore('kv').put(v,k); t.onsuccess=function(){res(true);}; t.onerror=function(){res(false);}; }catch(e){res(false);} }); }).catch(function(){return false;}); }
    // Precalcula una cadena buscable normalizada por fila (mascota+dueño+doc+tel+HC).
    function _prep(data){
      var P={}; (data.campos||[]).forEach(function(c,i){P[c]=i;});
      var f=data.f||[], s=new Array(f.length);
      for(var i=0;i<f.length;i++){ var r=f[i]; s[i]=_norm((r[P.pac]||'')+' '+(r[P.prop]||'')+' '+(r[P.doc]||'')+' '+(r[P.tel]||'')+' '+(r[P.reg]||'')); }
      return { v:data.v, P:P, f:f, s:s };
    }
    // Caché PRIMERO: activa el índice al instante desde IndexedDB (~50ms) y recién
    // después chequea si hay versión nueva, en segundo plano y sin bloquear. Apps
    // Script serializa las llamadas del usuario, así que NO podemos esperar al
    // chequeo de versión en el arranque: haría fila detrás de turnos/sala (10s+).
    function load(api){
      API=api||window.API_URL;
      if(_mem) return Promise.resolve(_mem);
      if(_loading) return _loading;
      _loading = _idbGet('vindex').then(function(cached){
        if(cached && cached.v){ _mem=_prep(cached); _verificarEnBg(cached.v); return _mem; }
        return _bajarCompleto();   // primera vez: no hay caché, hay que bajarlo
      }).catch(function(){ return _bajarCompleto(); });
      return _loading;
    }
    // Baja el índice completo del backend y lo persiste. Reemplaza _mem si llega.
    function _bajarCompleto(){
      return fetch(API+'?action=vetesoftIndex&cb='+Date.now()).then(function(r){return r.json();}).then(function(data){
        if(data && data.f){ try{ _idbPut('vindex',data); }catch(e){} _mem=_prep(data); }
        return _mem;
      }).catch(function(){ return _mem; });
    }
    // Chequea si el rebuild nocturno dejó una versión más nueva. Se retrasa unos
    // segundos para no competir con las llamadas críticas del arranque.
    function _verificarEnBg(verActual){
      setTimeout(function(){
        fetch(API+'?action=vetesoftIndexInfo&cb='+Date.now()).then(function(r){return r.json();}).then(function(info){
          if(info && info.version && info.version!==verActual){ _bajarCompleto(); }
        }).catch(function(){});
      }, 6000);
    }
    function _edad(nac){ try{ if(!nac)return''; var n=new Date(nac); if(isNaN(n))return''; var m=(new Date().getFullYear()-n.getFullYear())*12+(new Date().getMonth()-n.getMonth()); if(m<0)return''; if(m<1)return'Menos de 1 mes'; if(m<24)return m+(m===1?' mes':' meses'); var a=Math.floor(m/12),x=m%12; return a+' años'+(x?' y '+x+(x===1?' mes':' meses'):''); }catch(e){return'';} }
    function _map(r,P){ return { id:r[P.id], registro:r[P.reg]||(r[P.id]?String(r[P.id]):''), petName:r[P.pac]||'', owner:r[P.prop]||'', documento:r[P.doc]||'', phone:String(r[P.tel]||''), species:r[P.esp]||'', breed:r[P.raza]||'', sex:r[P.sexo]||'', age:_edad(r[P.nac]) }; }
    // Busca por texto libre. `campo` opcional ('prop','pac','doc','tel','reg') limita a ese campo.
    function search(q, campo, limit){
      limit=limit||25; if(!_mem) return [];
      var toks=_norm(q).split(/\s+/).filter(function(t){return t.length>=2;});
      if(!toks.length) return [];
      var P=_mem.P, f=_mem.f, s=_mem.s, hits=[];
      for(var i=0;i<f.length;i++){
        var base;
        if(campo){ base=_norm(f[i][P[campo]]); } else { base=s[i]; }
        var ok=true; for(var t=0;t<toks.length;t++){ if(base.indexOf(toks[t])===-1){ok=false;break;} }
        if(!ok) continue;
        // Puntaje: mejor si TODAS las palabras están en el MISMO campo (dueño o mascota).
        var prop=_norm(f[i][P.prop]), pac=_norm(f[i][P.pac]);
        var enProp=toks.every(function(t){return prop.indexOf(t)!==-1;});
        var enPac =toks.every(function(t){return pac.indexOf(t)!==-1;});
        var sc=(enProp||enPac)?2:1;
        if((enProp&&prop.indexOf(toks[0])===0)||(enPac&&pac.indexOf(toks[0])===0)) sc+=1;  // arranca con la 1a palabra
        hits.push({ r:f[i], sc:sc });
        if(hits.length>400) break;   // no barrer de más si hay muchísimos
      }
      hits.sort(function(a,b){ return b.sc-a.sc; });
      return hits.slice(0,limit).map(function(h){ return _map(h.r,P); });
    }
    return { load:load, search:search, listo:function(){return !!_mem;} };
  })();
})();
