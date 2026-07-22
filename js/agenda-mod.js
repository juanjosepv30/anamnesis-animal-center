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
  var SERVICIOS=['Consulta general','Consulta especializada','Control general','Control especializado','Cirugía','Vacunación','Inyectología','Desparasitación','Rayos X y Ecografía','Viajero'];
  var DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var H_INI=7*60, H_FIN=19*60, PXMIN=0.72;        // 07:00–19:00, 0.72px por minuto
  var ALTO=(H_FIN-H_INI)*PXMIN;                    // alto total del día

  var CSS=[
    '.agm{--ap:#8e3f9e;--apd:#6d2f7a;--apl:#f3e7f7;--abd:#e8daf0;--abg:#faf7ff;--atx:#1a0a2e;--atm:#6b5c7e}',
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
    // ── Calendario ──
    '.agm-cal-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
    '.agm-cal-top select{width:auto;min-width:150px;flex:1}',
    '.agm-nav{display:flex;align-items:center;gap:4px}',
    '.agm-navb{border:1.5px solid var(--abd);background:#fff;border-radius:8px;padding:7px 10px;font-size:.9rem;font-weight:800;color:var(--apd);cursor:pointer;font-family:inherit;line-height:1}',
    '.agm-navlbl{font-size:.82rem;font-weight:800;color:var(--atx);min-width:120px;text-align:center}',
    '.agm-seg{display:flex;border:1.5px solid var(--abd);border-radius:9px;overflow:hidden}',
    '.agm-seg button{border:none;background:#fff;padding:7px 12px;font-size:.82rem;font-weight:700;color:var(--atm);cursor:pointer;font-family:inherit}',
    '.agm-seg button.on{background:var(--apl);color:var(--apd)}',
    '.agm-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:.72rem;color:var(--atm);margin-bottom:8px}',
    '.agm-leg span{display:inline-flex;align-items:center;gap:5px}',
    '.agm-dot{width:11px;height:11px;border-radius:3px;display:inline-block}',
    '.agm-scroll{overflow-x:auto;border:1px solid var(--abd);border-radius:12px}',
    '.agm-grid{display:grid;min-width:520px}',
    '.agm-grid.dia{min-width:auto}',
    '.agm-gcol{border-left:1px solid #efe7f4;position:relative}',
    '.agm-gcol:first-child{border-left:none}',
    '.agm-gh{text-align:center;padding:7px 2px;font-size:.76rem;font-weight:800;color:var(--atx);border-bottom:1px solid var(--abd);position:sticky;top:0;background:#fff;z-index:2}',
    '.agm-gh small{display:block;font-weight:600;color:var(--atm);font-size:.68rem}',
    '.agm-gh.hoy{color:#fff;background:var(--ap)}',
    '.agm-gh.hoy small{color:#f3e7f7}',
    '.agm-guth{border-bottom:1px solid var(--abd)}',
    '.agm-body2{position:relative}',
    '.agm-hl{position:absolute;left:0;right:0;border-top:1px solid #f3edf7}',
    '.agm-hlbl{position:absolute;left:0;right:0;text-align:right;padding-right:5px;font-size:.64rem;color:#b0a4bf;transform:translateY(-6px)}',
    '.agm-ev{position:absolute;left:2px;right:2px;border-radius:6px;padding:2px 5px;font-size:.72rem;line-height:1.2;overflow:hidden;cursor:pointer;border-left:3px solid}',
    '.agm-ev b{font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.agm-ev.cir{background:#CECBF6;border-color:#534AB7;color:#26215C}',
    '.agm-ev.con{background:#F4C0D1;border-color:#993556;color:#4B1528}',
    '.agm-ev.lleg{background:#C0DD97;border-color:#3B6D11;color:#173404}',
    '.agm-blk{position:absolute;left:2px;right:2px;border-radius:6px;background:#F7C1C1;border-left:3px solid #A32D2D;color:#501313;font-size:.7rem;padding:2px 5px;overflow:hidden}',
    '.agm-slotfree{position:absolute;left:0;right:0;cursor:pointer}',
    '.agm-slotfree:hover{background:rgba(142,63,158,.06)}',
    // ── Modal ──
    '.agm-ov{position:fixed;inset:0;background:rgba(20,8,30,.45);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:24px 12px;overflow-y:auto}',
    '.agm-modal{background:#fff;border-radius:16px;padding:18px;max-width:440px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25)}',
    '.agm-mh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:4px}',
    '.agm-mt{font-size:1rem;font-weight:800;color:var(--atx)}',
    '.agm-mx{border:none;background:none;font-size:1.3rem;cursor:pointer;color:var(--atm);line-height:1;font-family:inherit}',
    '.agm-mwhen{font-size:.82rem;color:var(--apd);font-weight:700;background:var(--apl);border-radius:8px;padding:6px 10px;margin-bottom:12px;display:inline-block}',
    '.agm-srch{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.agm-mact{display:flex;gap:8px;margin-top:14px}'
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
  function claseCita(c){ if(c.llego) return 'lleg'; if(/cirug/i.test(c.servicio||'')) return 'cir'; return 'con'; }

  // ¿Algún bloqueo cubre el slot (fecha, hora)? Espejo del backend.
  function bloqueoDe(bloqs, fecha, hhmm){
    for(var i=0;i<(bloqs||[]).length;i++){ var b=bloqs[i];
      if(fecha<b.desdeF||fecha>b.hastaF) continue;
      if(b.todoDia) return b;
      var s=(fecha===b.desdeF)?b.desdeH:'00:00', e=(fecha===b.hastaF)?b.hastaH:'23:59';
      if(hhmm>=s&&hhmm<e) return b;
    }
    return null;
  }
  // Rango [ini,fin] en minutos que un bloqueo ocupa EN un día dado (clamp a la ventana visible).
  function bloqueoRangoDia(b, fecha){
    if(fecha<b.desdeF||fecha>b.hastaF) return null;
    var s = b.todoDia ? 0    : (fecha===b.desdeF ? hm2min(b.desdeH) : 0);
    var e = b.todoDia ? 1440 : (fecha===b.hastaF ? hm2min(b.hastaH) : 1440);
    var ini=Math.max(s,H_INI), fin=Math.min(e,H_FIN);
    return (fin>ini) ? {ini:ini,fin:fin} : null;
  }

  function mount(el, opts){
    opts=opts||{};
    injectCSS();
    var api = opts.api || window.API_URL;
    var medicoFijo = opts.medicoFijo || '';
    var esMovil = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
    var S = { medicos:[], sub:'cal', vista: esMovil?'dia':'semana', ancla:new Date(), med:medicoFijo, selCliente:null, crear:null };

    el.innerHTML =
      '<div class="agm">'+
        '<div class="agm-tabs">'+
          '<button class="agm-tab on" data-s="cal">📅 Agenda</button>'+
          '<button class="agm-tab" data-s="bloquear">🚫 Bloqueos</button>'+
        '</div>'+
        '<div class="agm-body"></div>'+
      '</div>';
    var body = el.querySelector('.agm-body');
    var tabs = el.querySelectorAll('.agm-tab');
    tabs.forEach(function(t){ t.onclick=function(){ S.sub=t.getAttribute('data-s'); tabs.forEach(function(x){x.classList.toggle('on',x===t);}); pintar(); }; });

    fetch(api+'?action=medicos').then(function(r){return r.json();}).then(function(res){
      S.medicos = (res&&res.ok) ? (res.medicos||[]).map(function(m){return m.medico;}) : [];
      // sin duplicar (un médico puede tener varias especialidades)
      var vis={}; S.medicos=S.medicos.filter(function(n){ if(vis[n])return false; vis[n]=true; return true; }).sort();
      if(!S.med && !medicoFijo && S.medicos.length) S.med=S.medicos[0];
      pintar();
    }).catch(function(){ pintar(); });

    function medOpts(sel){ return S.medicos.map(function(n){return '<option value="'+esc(n)+'"'+(n===sel?' selected':'')+'>'+esc(n)+'</option>';}).join(''); }
    function $(id){ return body.querySelector('#'+id); }
    function pintar(){ if(S.sub==='bloquear') pintarBloquear(); else pintarCal(); }

    // ══════════ CALENDARIO ══════════
    function diasVista(){
      if(S.vista==='dia') return [ new Date(S.ancla.getFullYear(),S.ancla.getMonth(),S.ancla.getDate()) ];
      var lun=lunesDe(S.ancla), out=[]; for(var i=0;i<6;i++) out.push(addDias(lun,i)); return out;   // Lun–Sáb
    }
    function rangoVista(){ var d=diasVista(); return { desde:isoDe(d[0]), hasta:isoDe(d[d.length-1]) }; }
    function etiquetaRango(){
      var d=diasVista();
      if(S.vista==='dia') return DIAS[d[0].getDay()]+' '+d[0].getDate()+'/'+(d[0].getMonth()+1);
      return d[0].getDate()+'/'+(d[0].getMonth()+1)+' – '+d[5].getDate()+'/'+(d[5].getMonth()+1);
    }

    function pintarCal(){
      body.innerHTML=
        '<div class="agm-cal-top">'+
          (medicoFijo?'<div class="agm-t" style="flex:1">'+esc(medicoFijo)+'</div>'
                     :'<select id="cMed">'+medOpts(S.med)+'</select>')+
          '<div class="agm-nav">'+
            '<button class="agm-navb" id="cPrev">‹</button>'+
            '<span class="agm-navlbl" id="cLbl">'+esc(etiquetaRango())+'</span>'+
            '<button class="agm-navb" id="cNext">›</button>'+
            '<button class="agm-navb" id="cHoy" style="font-size:.76rem">Hoy</button>'+
          '</div>'+
          '<div class="agm-seg">'+
            '<button id="cDia" class="'+(S.vista==='dia'?'on':'')+'">Día</button>'+
            '<button id="cSem" class="'+(S.vista==='semana'?'on':'')+'">Semana</button>'+
          '</div>'+
        '</div>'+
        '<div class="agm-leg">'+
          '<span><i class="agm-dot" style="background:#CECBF6;border:1px solid #534AB7"></i>Cirugía</span>'+
          '<span><i class="agm-dot" style="background:#F4C0D1;border:1px solid #993556"></i>Consulta/control</span>'+
          '<span><i class="agm-dot" style="background:#C0DD97;border:1px solid #3B6D11"></i>Llegó</span>'+
          '<span><i class="agm-dot" style="background:#F7C1C1;border:1px solid #A32D2D"></i>No disponible</span>'+
        '</div>'+
        '<div id="cWrap" class="agm-scroll"><div class="agm-sp"></div></div>';
      var sel=$('cMed'); if(sel) sel.onchange=function(){ S.med=sel.value; cargarCal(); };
      $('cPrev').onclick=function(){ S.ancla=addDias(S.ancla, S.vista==='dia'?-1:-7); refrescarLbl(); cargarCal(); };
      $('cNext').onclick=function(){ S.ancla=addDias(S.ancla, S.vista==='dia'? 1: 7); refrescarLbl(); cargarCal(); };
      $('cHoy').onclick=function(){ S.ancla=new Date(); refrescarLbl(); cargarCal(); };
      $('cDia').onclick=function(){ S.vista='dia'; pintarCal(); };
      $('cSem').onclick=function(){ S.vista='semana'; pintarCal(); };
      cargarCal();
    }
    function refrescarLbl(){ var l=$('cLbl'); if(l) l.textContent=etiquetaRango(); }

    function cargarCal(){
      var med = medicoFijo || S.med;
      var W=$('cWrap'); if(!W) return;
      if(!med){ W.innerHTML='<div class="agm-empty">Elegí un médico para ver su agenda.</div>'; return; }
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

    function pintarGrid(W, med, citas, bloqs){
      var dias=diasVista(), hoy=hoyISO();
      var cols='60px repeat('+dias.length+',minmax(90px,1fr))';
      var h='<div class="agm-grid'+(S.vista==='dia'?' dia':'')+'" style="grid-template-columns:'+cols+'">';
      // encabezados
      h+='<div class="agm-guth"></div>';
      dias.forEach(function(d){ var iso=isoDe(d);
        h+='<div class="agm-gh'+(iso===hoy?' hoy':'')+'">'+DIAS[d.getDay()]+' <small>'+d.getDate()+'</small></div>';
      });
      // columna de horas (gutter)
      h+='<div class="agm-gcol"><div class="agm-body2" style="height:'+ALTO+'px">';
      for(var m=H_INI;m<=H_FIN;m+=60){ var top=(m-H_INI)*PXMIN;
        h+='<div class="agm-hlbl" style="top:'+top+'px">'+min2hm(m)+'</div>';
      }
      h+='</div></div>';
      // columnas de días
      dias.forEach(function(d,di){ var iso=isoDe(d);
        h+='<div class="agm-gcol"><div class="agm-body2" data-iso="'+iso+'" style="height:'+ALTO+'px">';
        for(var mm=H_INI;mm<=H_FIN;mm+=60){ h+='<div class="agm-hl" style="top:'+((mm-H_INI)*PXMIN)+'px"></div>'; }
        // bloqueos (rojo) al fondo
        bloqs.forEach(function(b){ var rg=bloqueoRangoDia(b,iso); if(!rg)return;
          h+='<div class="agm-blk" style="top:'+((rg.ini-H_INI)*PXMIN)+'px;height:'+((rg.fin-rg.ini)*PXMIN-1)+'px">🚫 '+(b.motivo?esc(b.motivo):'No disponible')+'</div>';
        });
        // citas de ese día
        citas.filter(function(c){return c.fecha===iso;}).forEach(function(c){
          var ini=hm2min(c.hora), dur=+c.duracion||durServicio(c.servicio); var top=(ini-H_INI)*PXMIN, alt=Math.max(dur*PXMIN-1,15);
          h+='<div class="agm-ev '+claseCita(c)+'" data-id="'+esc(c.id)+'" style="top:'+top+'px;height:'+alt+'px">'+
             '<b>'+esc(c.hora)+' '+esc(c.petName||c.owner||'—')+(c.llego?' ✓':'')+'</b>'+
             (alt>28?'<span>'+esc((c.servicio||'').replace(/ (general|especializado|especializada)/i,''))+'</span>':'')+'</div>';
        });
        h+='</div></div>';
      });
      h+='</div>';
      W.innerHTML=h;
      // click en hueco vacío → agendar
      W.querySelectorAll('.agm-body2[data-iso]').forEach(function(bodyEl){
        bodyEl.addEventListener('click', function(ev){
          if(ev.target.closest('.agm-ev')||ev.target.closest('.agm-blk')) return;
          var rect=bodyEl.getBoundingClientRect(); var y=ev.clientY-rect.top;
          var minuto=H_INI+Math.round((y/PXMIN)/30)*30; if(minuto<H_INI)minuto=H_INI; if(minuto>H_FIN-30)minuto=H_FIN-30;
          abrirCrear(bodyEl.getAttribute('data-iso'), min2hm(minuto), med);
        });
      });
      // click en cita → detalle
      W.querySelectorAll('.agm-ev').forEach(function(evEl){
        evEl.addEventListener('click', function(ev){ ev.stopPropagation();
          var id=evEl.getAttribute('data-id'); var c=citas.filter(function(x){return String(x.id)===id;})[0];
          if(c) abrirDetalle(c);
        });
      });
    }

    // ══════════ MODAL: crear cita ══════════
    function overlay(html){
      var ov=document.createElement('div'); ov.className='agm-ov';
      ov.innerHTML='<div class="agm-modal">'+html+'</div>';
      ov.addEventListener('click', function(e){ if(e.target===ov) cerrarOv(); });
      document.body.appendChild(ov); S._ov=ov; return ov;
    }
    function cerrarOv(){ if(S._ov){ S._ov.remove(); S._ov=null; } S.selCliente=null; }

    function abrirCrear(iso, hora, med){
      S.crear={ fecha:iso, hora:hora, medico:med }; S.selCliente=null;
      var d=mkFecha(iso);
      overlay(
        '<div class="agm-mh"><div class="agm-mt">Agendar cita</div><button class="agm-mx" id="mX">×</button></div>'+
        '<div class="agm-mwhen">'+esc(DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1))+' · '+esc(hora)+' · '+esc(med)+'</div>'+
        '<div class="agm-srch">'+
          '<input type="number" id="mCed" placeholder="Cédula">'+
          '<input type="text" id="mPet" placeholder="Mascota">'+
        '</div>'+
        '<input type="text" id="mOwn" placeholder="Dueño (opcional)" style="margin-top:8px">'+
        '<button class="agm-btn agm-block" style="margin-top:10px" id="mBuscar">🔍 Buscar en Vetesoft</button>'+
        '<div class="agm-res" id="mRes"></div><div id="mForm"></div>'
      );
      $ov('mX').onclick=cerrarOv;
      $ov('mBuscar').onclick=buscarModal;
      ['mCed','mPet','mOwn'].forEach(function(id){ $ov(id).onkeydown=function(e){ if(e.key==='Enter')buscarModal(); }; });
    }
    function $ov(id){ return S._ov ? S._ov.querySelector('#'+id) : null; }

    function buscarModal(){
      var ced=$ov('mCed').value.trim(), pet=$ov('mPet').value.trim(), own=$ov('mOwn').value.trim();
      if(!ced&&!pet&&!own) return;
      var R=$ov('mRes'); R.innerHTML='<div class="agm-sp"></div>'; $ov('mForm').innerHTML='';
      fetch(api+'?action=search&cedula='+encodeURIComponent(ced)+'&petName='+encodeURIComponent(pet)+'&ownerName='+encodeURIComponent(own))
        .then(function(r){return r.json();}).then(function(res){
          var rows=(res&&res.results)||[]; var html='';
          rows.forEach(function(r,i){ S['_m'+i]=r;
            html+='<div class="agm-r" data-i="'+i+'"><div class="agm-rn">'+esc(r.petName||'(sin nombre)')+' — '+esc(r.owner||'')+(r.registro?' · HC '+esc(r.registro):'')+'</div>'+
              '<div class="agm-rm">'+esc(r.species||'')+(r.breed?' · '+esc(r.breed):'')+(r.phone?' · 📞 '+esc(r.phone):'')+'</div></div>';
          });
          if(!rows.length) html='<div class="agm-hint">Sin resultados en Vetesoft.</div>';
          html+='<button class="agm-nuevo" id="mNuevo">+ Cliente nuevo (cargar a mano)</button>';
          R.innerHTML=html;
          R.querySelectorAll('.agm-r').forEach(function(dv){ dv.onclick=function(){ pickModal(+dv.getAttribute('data-i')); }; });
          $ov('mNuevo').onclick=nuevoModal;
        }).catch(function(){ R.innerHTML='<div class="agm-hint">Error de conexión.</div>'; });
    }
    function pickModal(i){ var r=S['_m'+i];
      S.selCliente={ petName:r.petName||'', owner:r.owner||'', cedula:r.documento||$ov('mCed').value.trim(), phone:r.phone||'', vetesoftId:r.id?String(r.id):'', vetesoftHc:r.registro||'' };
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
        '<div class="agm-row"><div><label>Servicio</label><select id="fSvc">'+SERVICIOS.map(function(s){return '<option'+(/consulta general/i.test(s)?' selected':'')+'>'+esc(s)+'</option>';}).join('')+'</select></div>'+
          '<div id="fDurWrap"><label>Duración</label><select id="fDur"></select></div></div>'+
        '<div style="margin-top:12px"><label>Notas <span style="font-weight:400">(opcional)</span></label><textarea id="fNot" rows="2" placeholder="Motivo, indicaciones…"></textarea></div>'+
        '<div class="agm-mact"><button class="agm-btn agm-btn-g" id="fCancel" style="flex:0 0 auto">Cancelar</button>'+
        '<button class="agm-btn agm-block" id="fGuardar">Agendar →</button></div>'+
        '<div class="agm-err" id="fErr"></div>';
      var rs=$ov('fReset'); if(rs) rs.onclick=function(){ S.selCliente=null; abrirCrear(S.crear.fecha,S.crear.hora,S.crear.medico); };
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
        servicio:$ov('fSvc').value, duracion:+($ov('fDur').value||0),
        notas:($ov('fNot')||{}).value?$ov('fNot').value.trim():'', phone:($ov('fTel')||{}).value||'' };
      if(S.selCliente){ data.petName=S.selCliente.petName; data.owner=S.selCliente.owner; data.cedula=S.selCliente.cedula; data.vetesoftId=S.selCliente.vetesoftId; data.vetesoftHc=S.selCliente.vetesoftHc; }
      else { data.petName=($ov('fPet')||{}).value||''; data.owner=($ov('fOwn')||{}).value||''; data.cedula=($ov('fCed')||{}).value||''; }
      if(!data.petName&&!data.owner){ err.textContent='Falta el paciente.'; return; }
      $ov('fGuardar').textContent='Guardando…'; $ov('fGuardar').disabled=true;
      fetch(api,{method:'POST',body:JSON.stringify({action:'crearCita',data:data})}).then(function(r){return r.json();}).then(function(res){
        if(res&&res.ok){ cerrarOv(); cargarCal(); }
        else { var g=$ov('fGuardar'); if(g){g.textContent='Agendar →';g.disabled=false;} var e=$ov('fErr'); if(e) e.textContent=(res&&res.error)||'No se pudo agendar.'; }
      }).catch(function(){ var g=$ov('fGuardar'); if(g){g.textContent='Agendar →';g.disabled=false;} var e=$ov('fErr'); if(e) e.textContent='Error de conexión.'; });
    }

    // ══════════ MODAL: detalle de cita (Llegó / Cancelar) ══════════
    function abrirDetalle(c){
      var d=mkFecha(c.fecha);
      overlay(
        '<div class="agm-mh"><div class="agm-mt">'+esc(c.petName||c.owner||'Cita')+'</div><button class="agm-mx" id="dX">×</button></div>'+
        '<div class="agm-mwhen">'+esc(DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1))+' · '+esc(c.hora)+' · '+esc(c.servicio||'')+'</div>'+
        '<div style="font-size:.85rem;color:var(--atm);line-height:1.6">'+
          (c.owner?'👤 '+esc(c.owner)+'<br>':'')+
          (c.vetesoftHc?'🗂️ HC '+esc(c.vetesoftHc)+'<br>':'')+
          (c.phone?'📞 '+esc(c.phone)+'<br>':'')+
          (c.notas?'📝 '+esc(c.notas)+'<br>':'')+
          (c.llego?'<b style="color:#3B6D11">✓ Ya llegó — turno '+esc(c.turno||'')+'</b>':'')+
        '</div>'+
        '<div class="agm-mact">'+
          '<button class="agm-btn agm-btn-g" id="dCancel" style="color:#c0392b;border-color:#f1c0c0">Cancelar cita</button>'+
          (c.llego?'':'<button class="agm-btn agm-block" id="dLlego" style="background:#3B6D11">✓ Llegó</button>')+
        '</div>'+
        '<div class="agm-err" id="dErr"></div>'
      );
      $ov('dX').onclick=cerrarOv;
      $ov('dCancel').onclick=function(){ if(!confirm('¿Cancelar esta cita?'))return; accionCita('cancelarCita',{id:c.id}); };
      var lb=$ov('dLlego'); if(lb) lb.onclick=function(){ accionCita('llegoCita',{id:c.id}); };
    }
    function accionCita(action, payload){
      var e=$ov('dErr'); if(e)e.textContent='';
      payload.action=action;
      fetch(api,{method:'POST',body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(res){
        if(res&&res.ok){ cerrarOv(); cargarCal(); }
        else { if(e) e.textContent=(res&&res.error)||'No se pudo.'; }
      }).catch(function(){ if(e) e.textContent='Error de conexión.'; });
    }

    // ══════════ BLOQUEOS ══════════
    function horaOpts(){ var h='';for(var m=6*60;m<=20*60;m+=30){var v=min2hm(m);h+='<option value="'+v+'">'+v+'</option>';}return h; }
    function pintarBloquear(){
      body.innerHTML=
        '<div class="agm-card"><div class="agm-t">Marcar no disponible</div>'+
        '<div class="agm-sub">'+(medicoFijo?'Bloqueá tu agenda':'Bloqueá la agenda de un médico')+' por vacaciones, un tema familiar, lo que sea. Recepción lo ve y no se puede agendar encima.</div>'+
        (medicoFijo?'':'<div style="margin-bottom:10px"><label>Médico</label><select id="bMed"><option value="">— Elegí el médico —</option>'+medOpts('')+'</select></div>')+
        '<div class="agm-row">'+
          '<div><label>Desde (día)</label><input type="date" id="bDesF" value="'+hoyISO()+'"></div>'+
          '<div><label>Hasta (día)</label><input type="date" id="bHasF" value="'+hoyISO()+'"></div>'+
        '</div>'+
        '<label class="agm-chk"><input type="checkbox" id="bTodo"> Día(s) completo(s) — sin horario</label>'+
        '<div class="agm-row" id="bHoras">'+
          '<div><label>Desde (hora)</label><select id="bDesH">'+horaOpts()+'</select></div>'+
          '<div><label>Hasta (hora)</label><select id="bHasH">'+horaOpts()+'</select></div>'+
        '</div>'+
        '<div style="margin-top:12px"><label>Motivo <span style="font-weight:400">(opcional)</span></label><input id="bMot" placeholder="Vacaciones, tema familiar…"></div>'+
        '<button class="agm-btn agm-block" style="margin-top:14px" id="bGuardar">🚫 Guardar bloqueo</button>'+
        '<div class="agm-err" id="bErr"></div>'+
        '<div class="agm-t" style="margin-top:20px">Bloqueos activos</div>'+
        '<div id="bList"><div class="agm-sp"></div></div></div>';
      $('bTodo').onchange=function(){ $('bHoras').style.display=this.checked?'none':''; };
      $('bGuardar').onclick=guardarBloqueo;
      cargarBloqueos();
    }
    function guardarBloqueo(){
      var err=$('bErr'); err.textContent='';
      var medico=medicoFijo || (($('bMed')||{}).value||'');
      if(!medico){ err.textContent='Elegí el médico.'; return; }
      var todo=$('bTodo').checked;
      var data={ medico:medico, desdeF:$('bDesF').value, hastaF:$('bHasF').value,
        todoDia:todo, desdeH:todo?'':$('bDesH').value, hastaH:todo?'':$('bHasH').value, motivo:$('bMot').value.trim() };
      if(!data.desdeF){ err.textContent='Poné el día de inicio.'; return; }
      $('bGuardar').textContent='Guardando…'; $('bGuardar').disabled=true;
      fetch(api,{method:'POST',body:JSON.stringify({action:'crearBloqueo',data:data})}).then(function(r){return r.json();}).then(function(res){
        var g=$('bGuardar'); if(g){ g.textContent='🚫 Guardar bloqueo'; g.disabled=false; }
        if(res&&res.ok){ $('bMot').value=''; cargarBloqueos(); }
        else { var e=$('bErr'); if(e) e.textContent=(res&&res.error)||'No se pudo guardar.'; }
      }).catch(function(){ var g=$('bGuardar'); if(g){ g.textContent='🚫 Guardar bloqueo'; g.disabled=false; } var e=$('bErr'); if(e) e.textContent='Error de conexión.'; });
    }
    function cargarBloqueos(){
      var L=$('bList'); if(!L) return; L.innerHTML='<div class="agm-sp"></div>';
      fetch(api+'?action=bloqueos&medico='+encodeURIComponent(medicoFijo||'')).then(function(r){return r.json();}).then(function(res){
        var bs=(res&&res.bloqueos)||[];
        if(!bs.length){ L.innerHTML='<div class="agm-empty">Sin bloqueos activos.</div>'; return; }
        L.innerHTML=bs.map(bloqHtml).join('');
        L.querySelectorAll('.agm-cx').forEach(function(b){ b.onclick=function(){ cancelarBloqueo(b.getAttribute('data-id'),b); }; });
      }).catch(function(){ L.innerHTML='<div class="agm-empty">Error de conexión.</div>'; });
    }
    function bloqRango(b){ var dias=(b.desdeF===b.hastaF)?b.desdeF:(b.desdeF+' → '+b.hastaF); return dias+' · '+(b.todoDia?'todo el día':(b.desdeH+'–'+b.hastaH)); }
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
