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
  var SERVICIOS=['Consulta general','Consulta especializada','Control general','Control especializado','Cirugía','Vacunación','Inyectología','Desparasitación','Rayos X y Ecografía','Ecocardiograma','Electrocardiograma','Viajero'];
  var DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var H_INI=6*60, H_FIN=22*60, PXMIN=0.9;          // 06:00–22:00; casillas cómodas
  var Y0=10;                                        // margen arriba (para que 06:00 no pise el header)
  var ALTO=(H_FIN-H_INI)*PXMIN + Y0*2;             // alto total; la PÁGINA scrollea, no un cuadro interno

  var CSS=[
    '.agm{--ap:#8e3f9e;--apd:#6d2f7a;--apl:#f3e7f7;--abd:#e8daf0;--abg:#faf7ff;--atx:#1a0a2e;--atm:#6b5c7e;-webkit-user-select:none;user-select:none}',
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
    '.agm-navlbl-pick{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}',
    // input date transparente que cubre la etiqueta (tap = calendario nativo).
    '.agm-datewrap input[type=date]{position:absolute;top:-4px;left:-6px;right:-6px;bottom:-4px;opacity:0;cursor:pointer;border:0;padding:0;margin:0;background:transparent}',
    '.agm-seg{display:flex;border:1.5px solid var(--abd);border-radius:9px;overflow:hidden}',
    '.agm-seg button{border:none;background:#fff;padding:7px 12px;font-size:.82rem;font-weight:700;color:var(--atm);cursor:pointer;font-family:inherit}',
    '.agm-seg button.on{background:var(--apl);color:var(--apd)}',
    '.agm-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:.72rem;color:var(--atm);margin-bottom:8px}',
    '.agm-leg span{display:inline-flex;align-items:center;gap:5px}',
    '.agm-lnk{border:1px solid var(--abd);background:#fff;border-radius:8px;padding:4px 10px;font-size:.75rem;font-weight:700;color:#b45309;cursor:pointer;font-family:inherit}',
    '.agm-lnk:hover{background:#fff7ed}',
    '.agm-reprog{background:var(--apl);border:1.5px solid var(--ap);border-radius:10px;padding:9px 12px;font-size:.85rem;font-weight:700;color:var(--apd);margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.agm-dot{width:11px;height:11px;border-radius:3px;display:inline-block}',
    '.agm-scroll{overflow:visible;border:1px solid var(--abd);border-radius:12px;background:#fff}',
    // 3 días (celular): scroll HORIZONTAL dentro del cuadro. overflow-y:hidden
    // no recorta porque el alto del grid es exacto (ALTO), así la página sigue
    // scrolleando en vertical y solo lo horizontal queda dentro del cuadro.
    '.agm-hscroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}',
    '.agm-shint{font-size:.74rem;color:var(--apd);text-align:center;font-weight:700;padding:6px 4px}',
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
    // Arrastrar/estirar citas. touch-action:none para poder arrastrar en celular.
    '.agm-ev.agm-drag{cursor:grab;touch-action:none}',
    '.agm-ev.agm-dragging{opacity:.35}',
    '.agm-rz{position:absolute;left:0;right:0;bottom:0;height:10px;cursor:ns-resize;touch-action:none;display:flex;align-items:flex-end;justify-content:center}',
    '.agm-rz:after{content:"";width:26px;height:3px;margin-bottom:2px;border-radius:2px;background:rgba(0,0,0,.28)}',
    '.agm-ghost{position:fixed;z-index:9998;border-radius:6px;background:rgba(109,47,122,.94);color:#fff;font-size:.72rem;font-weight:700;padding:3px 6px;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.3);overflow:hidden;white-space:nowrap}',
    '.agm-ev b{font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    // El color de fondo/borde de cada cita se pone en línea según el servicio
    // (svcColor). "Llegó" NO cambia el color del servicio: agrega un anillo
    // verde para que se note que el paciente ya está en la clínica.
    '.agm-ev.lleg{box-shadow:inset 0 0 0 2px #16a34a}',
    '.agm-blk{position:absolute;left:2px;right:2px;border-radius:6px;background:repeating-linear-gradient(45deg,#F7C1C1,#F7C1C1 6px,#f4b4b4 6px,#f4b4b4 12px);border-left:3px solid #A32D2D;color:#501313;font-size:.7rem;font-weight:700;padding:2px 5px;overflow:hidden;cursor:pointer;z-index:2}',
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
  function durServicio(svc){ var s=String(svc||'').toLowerCase(); if(s.indexOf('control')!==-1)return 30; if(s.indexOf('consulta')!==-1)return 60; if(s.indexOf('cirug')!==-1)return 60; return 30; }
  // Color del servicio = MISMOS colores de los turnos (ver serviceColor en
  // pantalla/index.html), para que la clínica maneje una sola paleta. Cirugía y
  // desparasitación no existen como turno, así que les damos un tono propio.
  function svcColor(s){ s=String(s||'').toLowerCase();
    if(s.indexOf('control')!==-1)   return '#2563eb'; // azul
    if(s.indexOf('cirug')!==-1)     return '#7c3aed'; // morado
    if(s.indexOf('desparasit')!==-1)return '#0d9488'; // verde azulado
    if(s.indexOf('especial')!==-1)  return '#f97316'; // naranja
    if(s.indexOf('vacun')!==-1)     return '#ec4899'; // rosado
    if(s.indexOf('inyect')!==-1)    return '#6b7280'; // gris
    if(s.indexOf('cardiograma')!==-1) return '#e11d48'; // rosa fuerte (cardio)
    if(s.indexOf('rayos')!==-1||s.indexOf('ecograf')!==-1) return '#be123c'; // rojo vino
    if(s.indexOf('viajer')!==-1)    return '#0891b2'; // cian
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
    var S = { medicos:[], sub:'cal', vista: esMovil?'3dias':'semana', ancla:new Date(), med:medicoFijo, selCliente:null, crear:null };

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
    function pintar(){ if(S.sub==='bloquear') pintarBloquear(); else pintarCal(); }

    // ══════════ CALENDARIO ══════════
    function diasVista(){
      var base=new Date(S.ancla.getFullYear(),S.ancla.getMonth(),S.ancla.getDate());
      if(S.vista==='dia') return [ base ];
      // '3dias' (celular): arranca en el DÍA ANCLA (hoy por defecto) y va HACIA
      // ADELANTE — los días que ya pasaron no importan. Muestra 6 días (se ven
      // ~3 a la vez y se recorren con scroll horizontal); las flechas avanzan 3.
      if(S.vista==='3dias'){ var out=[]; for(var i=0;i<6;i++) out.push(addDias(base,i)); return out; }
      // 'semana' (escritorio): Lun–Sáb de la semana del ancla.
      var lun=lunesDe(S.ancla), outw=[]; for(var j=0;j<6;j++) outw.push(addDias(lun,j)); return outw;
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
          '</div>'+
          '<div class="agm-seg">'+
            '<button id="cDia" class="'+(S.vista==='dia'?'on':'')+'">Día</button>'+
            (esMovil
              ? '<button id="cSem" class="'+(S.vista==='3dias'?'on':'')+'">3 días</button>'
              : '<button id="cSem" class="'+(S.vista==='semana'?'on':'')+'">Semana</button>')+
          '</div>'+
        '</div>'+
        '<div class="agm-leg">'+
          '<span><i class="agm-dot" style="background:#16a34a22;border:1px solid #16a34a"></i>Consulta</span>'+
          '<span><i class="agm-dot" style="background:#2563eb22;border:1px solid #2563eb"></i>Control</span>'+
          '<span><i class="agm-dot" style="background:#f9731622;border:1px solid #f97316"></i>Especializada</span>'+
          '<span><i class="agm-dot" style="background:#7c3aed22;border:1px solid #7c3aed"></i>Cirugía</span>'+
          '<span><i class="agm-dot" style="background:#fff;box-shadow:inset 0 0 0 2px #16a34a"></i>Llegó</span>'+
          '<span><i class="agm-dot" style="background:#F7C1C1;border:1px solid #A32D2D"></i>No disponible</span>'+
          '<button class="agm-lnk" id="cBloq" style="margin-left:auto">🚫 Bloqueos</button>'+
        '</div>'+
        (S.reprog?'<div class="agm-reprog">🔁 Reprogramando a <b>'+esc(S.reprog.pet)+'</b> — toca el nuevo horario. <button class="agm-lnk" id="cReprogX" style="color:var(--apd)">Cancelar</button></div>':'')+
        (S.vista==='3dias'?'<div class="agm-shint">👉 Desliza para ver toda la semana</div>':'')+
        '<div id="cWrap" class="agm-scroll'+(S.vista==='3dias'?' agm-hscroll':'')+'"><div class="agm-sp"></div></div>';
      var sel=$('cMed'); if(sel) sel.onchange=function(){ S.med=sel.value; cargarCal(); };
      $('cBloq').onclick=function(){ S.sub='bloquear'; pintar(); };
      var rx=$('cReprogX'); if(rx) rx.onclick=function(){ S.reprog=null; pintarCal(); };
      $('cPrev').onclick=function(){ S.ancla=addDias(S.ancla, -pasoVista()); refrescarLbl(); cargarCal(); };
      $('cNext').onclick=function(){ S.ancla=addDias(S.ancla,  pasoVista()); refrescarLbl(); cargarCal(); };
      $('cHoy').onclick=function(){ S.ancla=new Date(); refrescarLbl(); cargarCal(); };
      $('cDia').onclick=function(){ S.vista='dia'; pintarCal(); };
      $('cSem').onclick=function(){ S.vista=esMovil?'3dias':'semana'; pintarCal(); };
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
        fetch(api+'?action=bloqueos&fecha='+r.desde+'&hasta='+r.hasta+'&medico='+encodeURIComponent(med)).then(function(x){return x.json();})
      ]).then(function(rr){
        var citas=(rr[0]&&rr[0].citas)||[], bloqs=(rr[1]&&rr[1].bloqueos)||[];
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
        // click en hueco vacío → agendar (si cae sobre un bloqueo, avisa)
        bodyEl.addEventListener('click', function(ev){
          if(S._noClick) return;   // recién soltó un arrastre/estirón: no agendar
          if(ev.target.closest('.agm-ev')||ev.target.closest('.agm-blk')) return;
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
          var x0=ev.clientX, y0=ev.clientY, grab=y0-evEl.getBoundingClientRect().top;
          var moviendo=false, tIso=c.fecha, tMin=hm2min(c.hora), ghost=null;
          function mv(e){ var dx=e.clientX-x0, dy=e.clientY-y0;
            if(!moviendo){ if(Math.abs(dx)+Math.abs(dy)<6) return; moviendo=true; evEl.classList.add('agm-dragging'); }
            var col=colBajoX(e.clientX)||evEl.closest('.agm-body2[data-iso]'); if(!col) return;
            tIso=col.getAttribute('data-iso'); tMin=minDesdeTop(col, e.clientY-grab);
            if(!ghost){ ghost=document.createElement('div'); ghost.className='agm-ghost'; ghost.innerHTML='<b></b>'; document.body.appendChild(ghost); }
            var r=col.getBoundingClientRect();
            ghost.style.left=(r.left+2)+'px'; ghost.style.width=(r.width-4)+'px';
            ghost.style.top=(r.top+yOf(tMin))+'px'; ghost.style.height=Math.max(dur*PXMIN-1,18)+'px';
            ghost.firstChild.textContent=min2hm(tMin)+' '+(c.petName||c.owner||'');
          }
          function up(){ document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up);
            evEl.classList.remove('agm-dragging'); if(ghost) ghost.remove();
            if(!moviendo){ abrirDetalle(c); return; }
            S._noClick=true; setTimeout(function(){S._noClick=false;},350);
            var nHora=min2hm(tMin);
            if(tIso===c.fecha && nHora===c.hora){ return; }
            var d=mkFecha(tIso);
            if(!confirm('¿Mover la cita de '+(c.petName||c.owner||'')+' a '+DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1)+' a las '+nHora+'?')){ cargarCal(); return; }
            guardarMoverCita(c, tIso, nHora, dur, false);
          }
          document.addEventListener('pointermove',mv); document.addEventListener('pointerup',up);
        });
      });
      W.querySelectorAll('.agm-blk').forEach(function(bk){
        bk.addEventListener('click', function(ev){ ev.stopPropagation();
          var id=bk.getAttribute('data-bid'); var b=bloqs.filter(function(x){return String(x.id)===id;})[0];
          if(!b) return;
          // Capturamos el DÍA (columna) y la HORA (posición del click) reales,
          // para que "Agendar igual" use ESE horario y no el inicio del bloqueo.
          var col=bk.closest('.agm-body2[data-iso]');
          var iso=col?col.getAttribute('data-iso'):b.desdeF;
          var hm=col?min2hm(slotY(col,ev.clientY)):(b.desdeH||'08:00');
          abrirBloqueoModal(b, med, iso, hm);
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

    // Búsqueda en vivo: a medida que se escribe. Si es número, va por cédula;
    // si es texto, busca por mascota Y por dueño a la vez (une coincidencias),
    // así "cualquier palabra" encuentra sea nombre de la mascota o del cliente.
    function buscarModal(term){
      term=String(term||'').trim();
      var R=$ov('mRes'); if(!R) return;
      if(term.length<3 && !/^\d{4,}$/.test(term)){ R.innerHTML=''; return; }
      var esNum=/^\d+$/.test(term);
      var url = esNum
        ? api+'?action=search&cedula='+encodeURIComponent(term)
        : api+'?action=search&q='+encodeURIComponent(term);
      R.innerHTML='<div class="agm-sp"></div>'; $ov('mForm').innerHTML='';
      var miTerm=term; S._term=term;
      fetch(url).then(function(r){return r.json();}).then(function(res){
        if(S._term!==miTerm) return;   // llegó viejo, lo ignoramos
        var rows=(res&&res.results)||[]; var html='';
        rows.forEach(function(r,i){ S['_m'+i]=r;
          html+='<div class="agm-r" data-i="'+i+'"><div class="agm-rn">'+esc(r.petName||'(sin nombre)')+' — '+esc(r.owner||'')+(r.registro?' · HC '+esc(r.registro):'')+'</div>'+
            '<div class="agm-rm">'+esc(r.species||'')+(r.breed?' · '+esc(r.breed):'')+(r.phone?' · 📞 '+esc(r.phone):'')+'</div></div>';
        });
        if(!rows.length) html='<div class="agm-hint">Sin resultados. Probá con la cédula, o cargá cliente nuevo.</div>';
        html+='<button class="agm-nuevo" id="mNuevo">+ Cliente nuevo (cargar a mano)</button>';
        R.innerHTML=html;
        R.querySelectorAll('.agm-r').forEach(function(dv){ dv.onclick=function(){ pickModal(+dv.getAttribute('data-i')); }; });
        $ov('mNuevo').onclick=nuevoModal;
      }).catch(function(){ R.innerHTML='<div class="agm-hint">Error de conexión.</div>'; });
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
        '<div class="agm-mlbl">Datos de la cita</div>'+
        '<div class="agm-row"><div><label>Servicio</label><select id="fSvc">'+SERVICIOS.map(function(s){return '<option'+(/consulta general/i.test(s)?' selected':'')+'>'+esc(s)+'</option>';}).join('')+'</select></div>'+
          '<div id="fDurWrap"><label>Duración</label><select id="fDur"></select></div></div>'+
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
      $ov('fSvc').onchange=syncDur; syncDur();
      $ov('fGuardar').onclick=function(){ guardarCita(manual); };
    }
    // La duración se autollena por servicio; la consulta se puede bajar a 30 para meter un paciente.
    function syncDur(){
      var svc=$ov('fSvc').value, def=durServicio(svc), sel=$ov('fDur');
      var ops = /consulta/i.test(svc) ? [60,30] : [def];
      sel.innerHTML=ops.map(function(m){return '<option value="'+m+'">'+m+' min</option>';}).join('');
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
          if(res&&res.ok){ cerrarOv(); cargarCal(); }
          else { var g=$ov('fGuardar'); if(g){g.textContent='Agendar →';g.disabled=false;} var e=$ov('fErr'); if(e) e.textContent=(res&&res.error)||'No se pudo agendar.'; }
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

    // ══════════ MODAL: detalle de cita (Llegó / Cancelar) ══════════
    function abrirDetalle(c){
      var d=mkFecha(c.fecha);
      overlay(
        '<div class="agm-mh"><div class="agm-mt">'+esc(c.petName||c.owner||'Cita')+'</div><button class="agm-mx" id="dX">×</button></div>'+
        '<div class="agm-when"><span class="agm-wpill">📅 '+esc(DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1))+'</span>'+
          '<span class="agm-wpill">🕐 '+esc(c.hora)+'</span><span class="agm-wpill">'+esc(c.servicio||'')+'</span></div>'+
        '<div style="font-size:.85rem;color:var(--atm);line-height:1.6">'+
          (c.owner?'👤 '+esc(c.owner)+'<br>':'')+
          (c.vetesoftHc?'🗂️ HC '+esc(c.vetesoftHc)+'<br>':'')+
          (c.phone?'📞 '+esc(c.phone)+'<br>':'')+
          (c.comprobante?'<a href="'+esc(c.comprobante)+'" target="_blank" rel="noopener" style="color:#6d2f7a;font-weight:700">📎 Ver comprobante</a><br>':'')+
          (c.llego?'<b style="color:#3B6D11">✓ Ya llegó — turno '+esc(c.turno||'')+'</b>':'')+
        '</div>'+
        // Nota + marca de pago: editables acá mismo, sin reprogramar.
        '<div class="agm-mlbl">Nota y pago</div>'+
        '<textarea id="dNota" rows="2" placeholder="Nota para esta cita…">'+esc(c.notas||'')+'</textarea>'+
        '<label class="agm-chk"><input type="checkbox" id="dPago"'+(c.pagado?' checked':'')+'> 💵 El cliente ya pagó</label>'+
        '<button class="agm-btn agm-btn-g" id="dGuardarNota" style="width:100%;margin-top:10px">Guardar nota / pago</button>'+
        '<div class="agm-mact" style="flex-wrap:wrap;margin-top:14px">'+
          '<button class="agm-btn agm-btn-g" id="dCancel" style="color:#c0392b;border-color:#f1c0c0">Cancelar cita</button>'+
          (c.llego?'':'<button class="agm-btn agm-btn-g" id="dReprog">🔁 Reprogramar</button>')+
          (c.llego?'':'<button class="agm-btn agm-block" id="dLlego" style="background:#3B6D11">✓ Llegó</button>')+
        '</div>'+
        '<div class="agm-err" id="dErr"></div>'
      );
      $ov('dX').onclick=cerrarOv;
      $ov('dCancel').onclick=function(){ if(!confirm('¿Cancelar esta cita?'))return; accionCita('cancelarCita',{id:c.id}); };
      var lb=$ov('dLlego'); if(lb) lb.onclick=function(){ accionCita('llegoCita',{id:c.id}); };
      var rb=$ov('dReprog'); if(rb) rb.onclick=function(){ S.reprog={ id:c.id, pet:(c.petName||c.owner||'la cita') }; cerrarOv(); pintarCal(); };
      var gn=$ov('dGuardarNota'); if(gn) gn.onclick=function(){
        var e=$ov('dErr'); if(e)e.textContent='';
        gn.textContent='Guardando…'; gn.disabled=true;
        var payload={ id:c.id, data:{ notas:($ov('dNota')||{}).value||'', pagado:!!($ov('dPago')||{}).checked } };
        fetch(api,{method:'POST',body:JSON.stringify({action:'marcarPagoNota',id:payload.id,data:payload.data})})
          .then(function(r){return r.json();}).then(function(res){
            if(res&&res.ok){ cerrarOv(); cargarCal(); }
            else { gn.textContent='Guardar nota / pago'; gn.disabled=false; if(e) e.textContent=(res&&res.error)||'No se pudo guardar.'; }
          }).catch(function(){ gn.textContent='Guardar nota / pago'; gn.disabled=false; if(e) e.textContent='Error de conexión.'; });
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
  }

  window.AgendaMod = { mount: mount };
})();
