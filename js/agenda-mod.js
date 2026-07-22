// ── Módulo de agenda (compartido) ────────────────────────────
// Se monta dentro de recepción y de médicos, no es una página aparte.
//   AgendaMod.mount(elemento, { medicoFijo:'Dra. X'|'', api:'...' })
//   - medicoFijo vacío  → recepción: elige médico y ve la agenda de todos.
//   - medicoFijo puesto → médico: agenda queda con su nombre y ve SU agenda.
(function(){
  var SERVICIOS=['Consulta general','Consulta especializada','Control general','Control especializado','Vacunación','Inyectología','Rayos X y Ecografía','Viajero'];
  var CSS=[
    '.agm{--ap:#8e3f9e;--apd:#6d2f7a;--apl:#f3e7f7;--abd:#e8daf0;--abg:#faf7ff;--atx:#1a0a2e;--atm:#6b5c7e}',
    '.agm-tabs{display:flex;gap:8px;margin-bottom:14px}',
    '.agm-tab{flex:1;border:1.5px solid var(--abd);background:#fff;border-radius:11px;padding:10px;font-size:.88rem;font-weight:700;color:var(--atm);cursor:pointer;font-family:inherit}',
    '.agm-tab.on{background:var(--apl);color:var(--apd);border-color:var(--ap)}',
    '.agm-card{background:#fff;border:1px solid var(--abd);border-radius:14px;padding:16px}',
    '.agm-t{font-size:.92rem;font-weight:800;margin-bottom:2px;color:var(--atx)}',
    '.agm-sub{font-size:.79rem;color:var(--atm);margin-bottom:12px}',
    '.agm-srch{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}',
    '@media(max-width:560px){.agm-srch{grid-template-columns:1fr}}',
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
    '.agm-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px}',
    '.agm-filtros>div{flex:1;min-width:120px}',
    '.agm-cita{border:1px solid var(--abd);border-left:5px solid var(--ap);border-radius:11px;padding:11px 13px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start}',
    '.agm-ch{font-size:1.05rem;font-weight:800;min-width:52px;color:var(--ap);font-variant-numeric:tabular-nums}',
    '.agm-ci{flex:1;min-width:0}',
    '.agm-cn{font-weight:700;font-size:.9rem}',
    '.agm-cm{font-size:.75rem;color:var(--atm);margin-top:2px}',
    '.agm-cx{border:none;background:none;color:#c0392b;font-weight:800;cursor:pointer;font-size:.74rem;font-family:inherit}',
    '.agm-empty{color:#b0a4bf;text-align:center;padding:22px;font-size:.9rem}',
    '.agm-grp{font-size:.77rem;font-weight:800;color:var(--apd);text-transform:uppercase;letter-spacing:.3px;margin:12px 0 6px}',
    '.agm-ok{text-align:center;padding:16px}',
    '.agm-ok .em{font-size:2.3rem;margin-bottom:8px}',
    '.agm-err{color:#c0392b;font-size:.82rem;margin-top:8px;min-height:16px}',
    '.agm-sp{width:24px;height:24px;border:3px solid var(--abd);border-top-color:var(--ap);border-radius:50%;animation:agmsp .8s linear infinite;margin:18px auto}',
    '@keyframes agmsp{to{transform:rotate(360deg)}}',
    '.agm-day{border:1.5px solid var(--abd);border-radius:11px;max-height:340px;overflow-y:auto;margin-top:6px}',
    '.agm-slot{display:flex;align-items:center;gap:10px;padding:8px 11px;border-bottom:1px solid #f0e8f5;font-size:.85rem}',
    '.agm-slot:last-child{border-bottom:none}',
    '.agm-sh{font-weight:800;color:var(--atm);min-width:46px;font-variant-numeric:tabular-nums}',
    '.agm-free{flex:1;background:none;border:1px dashed #cdbcda;color:var(--apd);border-radius:8px;padding:6px 10px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;text-align:left}',
    '.agm-free:hover{background:var(--apl)}',
    '.agm-free.pick{background:var(--ap);color:#fff;border-color:var(--ap)}',
    '.agm-busy{flex:1;background:#fdecef;color:#a01b34;border-radius:8px;padding:6px 10px;font-size:.8rem;font-weight:700}',
    '.agm-off{flex:1;background:#fff4e6;color:#b45309;border:1px solid #fed7aa;border-radius:8px;padding:6px 10px;font-size:.8rem;font-weight:700}',
    '.agm-offbar{background:#fff4e6;color:#b45309;border:1px solid #fed7aa;border-radius:9px;padding:8px 12px;font-size:.82rem;font-weight:700;margin-bottom:8px}',
    '.agm-chk{display:flex;align-items:center;gap:8px;font-size:.85rem;font-weight:700;color:var(--atx);margin-top:12px;cursor:pointer}',
    '.agm-chk input{width:auto}',
    '.agm-daymsg{color:#b0a4bf;font-size:.85rem;text-align:center;padding:14px}'
  ].join('\n');
  var cssInjected=false;
  function injectCSS(){ if(cssInjected)return; cssInjected=true; var s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function hoyISO(){return new Date().toLocaleDateString('en-CA');}
  // ¿Algún bloqueo cubre el slot (fecha, hora)? Espejo de _bloqueoCubre del backend.
  function bloqueoDe(bloqs, fecha, hhmm){
    for(var i=0;i<(bloqs||[]).length;i++){
      var b=bloqs[i];
      if(fecha<b.desdeF||fecha>b.hastaF) continue;
      if(b.todoDia) return b;
      var s=(fecha===b.desdeF)?b.desdeH:'00:00';
      var e=(fecha===b.hastaF)?b.hastaH:'23:59';
      if(hhmm>=s&&hhmm<e) return b;
    }
    return null;
  }

  function mount(el, opts){
    opts=opts||{};
    injectCSS();
    var api = opts.api || window.API_URL;
    var medicoFijo = opts.medicoFijo || '';
    var S = { medicos:[], sub:'agendar', selCliente:null };

    el.innerHTML =
      '<div class="agm">'+
        '<div class="agm-tabs">'+
          '<button class="agm-tab on" data-s="agendar">➕ Agendar</button>'+
          '<button class="agm-tab" data-s="ver">📅 '+(medicoFijo?'Mi agenda':'Ver agenda')+'</button>'+
          '<button class="agm-tab" data-s="bloquear">🚫 Bloqueos</button>'+
        '</div>'+
        '<div class="agm-body"></div>'+
      '</div>';
    var body = el.querySelector('.agm-body');
    var tabs = el.querySelectorAll('.agm-tab');
    tabs.forEach(function(t){ t.onclick=function(){ S.sub=t.getAttribute('data-s'); tabs.forEach(function(x){x.classList.toggle('on',x===t);}); pintar(); }; });

    fetch(api+'?action=medicos').then(function(r){return r.json();}).then(function(res){
      S.medicos = (res&&res.ok) ? (res.medicos||[]).map(function(m){return m.medico;}).sort() : [];
      pintar();
    }).catch(function(){ pintar(); });

    function medOpts(sel){ return '<option value="">— Elegí el médico —</option>'+S.medicos.map(function(n){return '<option value="'+esc(n)+'"'+(n===sel?' selected':'')+'>'+esc(n)+'</option>';}).join(''); }
    function svcOpts(){ return SERVICIOS.map(function(s){return '<option value="'+esc(s)+'">'+esc(s)+'</option>';}).join(''); }
    function horaOpts(){ var h='';for(var m=6*60;m<=20*60;m+=30){var hh=Math.floor(m/60),mm=m%60;var v=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');h+='<option value="'+v+'">'+v+'</option>';}return h; }
    function $(id){ return body.querySelector('#'+id); }

    function pintar(){ if(S.sub==='agendar') pintarAgendar(); else if(S.sub==='bloquear') pintarBloquear(); else pintarVer(); }

    // ── Agendar ──
    function pintarAgendar(){
      body.innerHTML=
        '<div class="agm-card"><div class="agm-t">Buscar al paciente</div>'+
        '<div class="agm-sub">Buscalo en Vetesoft para no re-teclear. Si es nuevo, cargalo a mano.</div>'+
        '<div class="agm-srch">'+
          '<input type="number" id="aCed" placeholder="Cédula">'+
          '<input type="text" id="aPet" placeholder="Mascota (opcional)">'+
          '<input type="text" id="aOwn" placeholder="Dueño (opcional)">'+
        '</div>'+
        '<button class="agm-btn agm-block" style="margin-top:10px" id="aBuscar">🔍 Buscar</button>'+
        '<div class="agm-res" id="aRes"></div><div id="aForm"></div></div>';
      $('aBuscar').onclick=buscar;
      ['aCed','aPet','aOwn'].forEach(function(id){ $(id).onkeydown=function(e){ if(e.key==='Enter')buscar(); }; });
      S.selCliente=null;
    }
    function buscar(){
      var ced=$('aCed').value.trim(), pet=$('aPet').value.trim(), own=$('aOwn').value.trim();
      if(!ced&&!pet&&!own) return;
      var R=$('aRes'); R.innerHTML='<div class="agm-sp"></div>'; $('aForm').innerHTML='';
      fetch(api+'?action=search&cedula='+encodeURIComponent(ced)+'&petName='+encodeURIComponent(pet)+'&ownerName='+encodeURIComponent(own))
        .then(function(r){return r.json();}).then(function(res){
          var rows=(res&&res.results)||[]; var html='';
          rows.forEach(function(r,i){ S['_r'+i]=r;
            html+='<div class="agm-r" data-i="'+i+'"><div class="agm-rn">'+esc(r.petName||'(sin nombre)')+' — '+esc(r.owner||'')+(r.registro?' · HC '+esc(r.registro):'')+'</div>'+
              '<div class="agm-rm">'+esc(r.species||'')+(r.breed?' · '+esc(r.breed):'')+(r.phone?' · 📞 '+esc(r.phone):'')+'</div></div>';
          });
          if(!rows.length) html='<div class="agm-hint">Sin resultados en Vetesoft.</div>';
          html+='<button class="agm-nuevo" id="aNuevo">+ Cliente nuevo (cargar a mano)</button>';
          R.innerHTML=html;
          R.querySelectorAll('.agm-r').forEach(function(d){ d.onclick=function(){ pick(+d.getAttribute('data-i')); }; });
          $('aNuevo').onclick=nuevo;
        }).catch(function(){ R.innerHTML='<div class="agm-hint">Error de conexión.</div><button class="agm-nuevo" id="aNuevo">+ Cliente nuevo</button>'; var n=$('aNuevo'); if(n)n.onclick=nuevo; });
    }
    function pick(i){
      var r=S['_r'+i];
      S.selCliente={ petName:r.petName||'', owner:r.owner||'', cedula:r.documento||$('aCed').value.trim(), phone:r.phone||'', vetesoftId:r.id?String(r.id):'', vetesoftHc:r.registro||'' };
      $('aRes').innerHTML=''; abrirForm(false);
    }
    function nuevo(){ S.selCliente=null; $('aRes').innerHTML=''; abrirForm(true); }
    function abrirForm(manual){
      var cab = manual
        ? '<div class="agm-row"><div><label>Mascota</label><input id="fPet"></div><div><label>Dueño</label><input id="fOwn"></div>'+
          '<div><label>Cédula <span style="font-weight:400">(opcional)</span></label><input id="fCed" inputmode="numeric"></div>'+
          '<div><label>WhatsApp <span style="font-weight:400">(recordatorios)</span></label><input id="fTel" inputmode="numeric" placeholder="3001234567"></div></div>'
        : '<div class="agm-sel">✅ '+esc(S.selCliente.petName||'')+' — '+esc(S.selCliente.owner||'')+(S.selCliente.vetesoftHc?' · HC '+esc(S.selCliente.vetesoftHc):'')+'<button id="fReset">Cambiar</button></div>'+
          '<div style="margin-top:10px"><label>WhatsApp <span style="font-weight:400">(recordatorios)</span></label><input id="fTel" inputmode="numeric" placeholder="3001234567" value="'+esc(S.selCliente.phone||'')+'"></div>';
      $('aForm').innerHTML=
        cab+
        '<div class="agm-row">'+
          '<div><label>Médico</label><select id="fMed">'+medOpts(medicoFijo)+'</select></div>'+
          '<div><label>Servicio</label><select id="fSvc">'+svcOpts()+'</select></div>'+
          '<div><label>Fecha</label><input type="date" id="fFec" value="'+hoyISO()+'"></div>'+
        '</div>'+
        '<div style="margin-top:12px"><label>Horario <span style="font-weight:400" id="fHsel">(elegí un espacio libre)</span></label>'+
          '<div class="agm-day" id="fDay"><div class="agm-daymsg">Elegí médico y fecha para ver los horarios.</div></div></div>'+
        '<div style="margin-top:12px"><label>Notas <span style="font-weight:400">(opcional)</span></label><textarea id="fNot" rows="2" placeholder="Motivo, indicaciones…"></textarea></div>'+
        '<button class="agm-btn agm-block" style="margin-top:14px" id="fGuardar">Agendar cita →</button>'+
        '<div class="agm-err" id="fErr"></div>';
      var rs=$('fReset'); if(rs) rs.onclick=function(){ S.selCliente=null; S.horaSel=''; $('aForm').innerHTML=''; };
      S.horaSel='';
      $('fMed').onchange=refrescarDia; $('fFec').onchange=refrescarDia;
      $('fGuardar').onclick=function(){ guardar(manual); };
      if(medicoFijo) refrescarDia();   // ya sabemos el médico → mostramos el día
    }
    // Muestra el día del médico como una línea de tiempo (libre / ocupado), tipo
    // agenda. Los espacios libres se tocan para elegir la hora.
    function refrescarDia(){
      var med=$('fMed').value, fec=$('fFec').value;
      var D=$('fDay'); if(!D) return;
      S.horaSel=''; $('fHsel').textContent='(elegí un espacio libre)';
      if(!med||!fec){ D.innerHTML='<div class="agm-daymsg">Elegí médico y fecha para ver los horarios.</div>'; return; }
      D.innerHTML='<div class="agm-sp"></div>';
      Promise.all([
        fetch(api+'?action=citas&fecha='+encodeURIComponent(fec)+'&medico='+encodeURIComponent(med)).then(function(r){return r.json();}),
        fetch(api+'?action=bloqueos&fecha='+encodeURIComponent(fec)+'&medico='+encodeURIComponent(med)).then(function(r){return r.json();})
      ]).then(function(rr){
        var ocup={}; ((rr[0]&&rr[0].citas)||[]).forEach(function(c){ ocup[c.hora]=c; });
        var bloqs=(rr[1]&&rr[1].bloqueos)||[];
        var html='';
        for(var m=6*60;m<=20*60;m+=30){
          var hh=Math.floor(m/60),mm=m%60; var v=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
          var c=ocup[v], b=bloqueoDe(bloqs,fec,v);
          html+='<div class="agm-slot"><span class="agm-sh">'+v+'</span>'+
            (b ? '<span class="agm-off">🚫 No disponible'+(b.motivo?' · '+esc(b.motivo):'')+'</span>'
             : c ? '<span class="agm-busy">🔴 '+esc(c.petName||c.owner||'Ocupado')+(c.servicio?' · '+esc(c.servicio):'')+'</span>'
               : '<button class="agm-free" data-h="'+v+'">Libre — tocá para elegir</button>')+'</div>';
        }
        D.innerHTML=html;
        D.querySelectorAll('.agm-free').forEach(function(b){ b.onclick=function(){ elegirHora(b.getAttribute('data-h')); }; });
      }).catch(function(){ D.innerHTML='<div class="agm-daymsg">Error al cargar los horarios.</div>'; });
    }
    function elegirHora(h){
      S.horaSel=h;
      var D=$('fDay'); D.querySelectorAll('.agm-free').forEach(function(b){ b.classList.toggle('pick', b.getAttribute('data-h')===h); if(b.getAttribute('data-h')===h) b.textContent='✓ '+h+' elegido'; else b.textContent='Libre — tocá para elegir'; });
      $('fHsel').textContent='→ '+h;
    }
    function guardar(manual){
      var medico=$('fMed').value, err=$('fErr');
      if(!medico){ err.textContent='Elegí el médico.'; return; }
      if(!S.horaSel){ err.textContent='Elegí un horario libre en la agenda del día.'; return; }
      var data={ fecha:$('fFec').value, hora:S.horaSel, medico:medico, servicio:$('fSvc').value, notas:$('fNot').value.trim(), phone:($('fTel')||{}).value||'' };
      if(S.selCliente){ data.petName=S.selCliente.petName; data.owner=S.selCliente.owner; data.cedula=S.selCliente.cedula; data.vetesoftId=S.selCliente.vetesoftId; data.vetesoftHc=S.selCliente.vetesoftHc; }
      else { data.petName=($('fPet')||{}).value||''; data.owner=($('fOwn')||{}).value||''; data.cedula=($('fCed')||{}).value||''; }
      if(!data.petName&&!data.owner){ err.textContent='Falta el paciente.'; return; }
      err.textContent=''; $('aForm').innerHTML='<div class="agm-sp"></div>';
      fetch(api,{method:'POST',body:JSON.stringify({action:'crearCita',data:data})}).then(function(r){return r.json();}).then(function(res){
        if(res&&res.ok){
          $('aForm').innerHTML='<div class="agm-ok"><div class="em">📅</div><b>¡Cita agendada!</b><br>'+esc(data.petName||data.owner)+' con '+esc(data.medico)+'<br>'+esc(data.fecha)+' a las '+esc(data.hora)+'</div><button class="agm-btn agm-btn-g agm-block" id="aOtra">Agendar otra</button>';
          $('aCed').value='';$('aPet').value='';$('aOwn').value='';
          $('aOtra').onclick=function(){ pintarAgendar(); };
        } else { abrirForm(manual); $('fErr').textContent=(res&&res.error)||'No se pudo agendar.'; }
      }).catch(function(){ abrirForm(manual); var e=$('fErr'); if(e)e.textContent='Error de conexión.'; });
    }

    // ── Ver agenda ──
    function pintarVer(){
      body.innerHTML=
        '<div class="agm-card"><div class="agm-t">'+(medicoFijo?'Mi agenda':'Agenda')+'</div>'+
        '<div class="agm-filtros">'+
          '<div><label>Día</label><input type="date" id="vFec" value="'+hoyISO()+'"></div>'+
          (medicoFijo?'':'<div><label>Médico</label><select id="vMed"><option value="">Todos</option>'+S.medicos.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>';}).join('')+'</select></div>')+
          '<button class="agm-btn agm-btn-g" id="vHoy">Hoy</button>'+
        '</div><div id="vList"><div class="agm-sp"></div></div></div>';
      $('vFec').onchange=cargar; var vm=$('vMed'); if(vm) vm.onchange=cargar;
      $('vHoy').onclick=function(){ $('vFec').value=hoyISO(); cargar(); };
      cargar();
    }
    function cargar(){
      var f=$('vFec').value||hoyISO();
      var m=medicoFijo || (($('vMed')||{}).value||'');
      var L=$('vList'); L.innerHTML='<div class="agm-sp"></div>';
      Promise.all([
        fetch(api+'?action=citas&fecha='+encodeURIComponent(f)+'&medico='+encodeURIComponent(m)).then(function(r){return r.json();}),
        fetch(api+'?action=bloqueos&fecha='+encodeURIComponent(f)+'&medico='+encodeURIComponent(m)).then(function(r){return r.json();})
      ]).then(function(rr){
        var res=rr[0]; var bloqs=(rr[1]&&rr[1].bloqueos)||[];
        var citas=(res&&res.citas)||[];
        var banner=bloqs.map(function(b){ return '<div class="agm-offbar">🚫 '+esc(b.medico)+' no disponible · '+esc(bloqRango(b))+(b.motivo?' · '+esc(b.motivo):'')+'</div>'; }).join('');
        if(!citas.length){ L.innerHTML=banner+'<div class="agm-empty">Sin citas para ese día.</div>'; return; }
        var html=banner;
        if(!m){
          var porMed={},orden=[]; citas.forEach(function(c){var k=c.medico||'—';if(!porMed[k]){porMed[k]=[];orden.push(k);}porMed[k].push(c);}); orden.sort();
          orden.forEach(function(k){ html+='<div class="agm-grp">🩺 '+esc(k)+'</div>'+porMed[k].map(citaHtml).join(''); });
        } else html+=citas.map(citaHtml).join('');
        L.innerHTML=html;
        L.querySelectorAll('.agm-cx').forEach(function(b){ b.onclick=function(){ cancelar(b.getAttribute('data-id'),b); }; });
      }).catch(function(){ L.innerHTML='<div class="agm-empty">Error de conexión.</div>'; });
    }
    function citaHtml(c){
      return '<div class="agm-cita"><div class="agm-ch">'+esc(c.hora||'')+'</div><div class="agm-ci">'+
        '<div class="agm-cn">'+esc(c.petName||'')+(c.owner?' <span style="font-weight:400;color:#6b5c7e">· '+esc(c.owner)+'</span>':'')+(c.vetesoftHc?' <span style="font-size:.72rem;background:#8e3f9e22;color:#6d2f7a;border-radius:6px;padding:1px 6px;font-weight:700">HC '+esc(c.vetesoftHc)+'</span>':'')+'</div>'+
        '<div class="agm-cm">'+esc(c.servicio||'')+(c.phone?' · 📞 '+esc(c.phone):'')+(c.notas?' · '+esc(c.notas):'')+'</div></div>'+
        '<button class="agm-cx" data-id="'+esc(c.id)+'">Cancelar</button></div>';
    }
    function cancelar(id,btn){
      if(!confirm('¿Cancelar esta cita?')) return; btn.textContent='…';
      fetch(api,{method:'POST',body:JSON.stringify({action:'cancelarCita',id:id})}).then(function(r){return r.json();}).then(function(){ cargar(); }).catch(function(){ cargar(); });
    }

    // ── Bloqueos (no disponibilidad) ──
    function pintarBloquear(){
      body.innerHTML=
        '<div class="agm-card"><div class="agm-t">Marcar no disponible</div>'+
        '<div class="agm-sub">'+(medicoFijo?'Bloqueá tu agenda':'Bloqueá la agenda de un médico')+' por vacaciones, un tema familiar, lo que sea. Recepción lo ve y no se puede agendar encima.</div>'+
        (medicoFijo?'':'<div style="margin-bottom:10px"><label>Médico</label><select id="bMed">'+medOpts('')+'</select></div>')+
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
        todoDia:todo, desdeH:todo?'':$('bDesH').value, hastaH:todo?'':$('bHasH').value,
        motivo:$('bMot').value.trim() };
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
    function bloqRango(b){
      var dias = (b.desdeF===b.hastaF) ? b.desdeF : (b.desdeF+' → '+b.hastaF);
      var horas = b.todoDia ? 'todo el día' : (b.desdeH+'–'+b.hastaH);
      return dias+' · '+horas;
    }
    function bloqHtml(b){
      return '<div class="agm-cita" style="border-left-color:#b45309"><div class="agm-ch" style="color:#b45309;font-size:1.2rem">🚫</div><div class="agm-ci">'+
        (medicoFijo?'':'<div class="agm-cn">'+esc(b.medico||'')+'</div>')+
        '<div class="agm-cn'+(medicoFijo?'':'" style="font-weight:600;font-size:.82rem"')+'">'+esc(bloqRango(b))+'</div>'+
        (b.motivo?'<div class="agm-cm">'+esc(b.motivo)+'</div>':'')+'</div>'+
        '<button class="agm-cx" data-id="'+esc(b.id)+'">Quitar</button></div>';
    }
    function cancelarBloqueo(id,btn){
      if(!confirm('¿Quitar este bloqueo? El horario vuelve a quedar disponible.')) return; btn.textContent='…';
      fetch(api,{method:'POST',body:JSON.stringify({action:'cancelarBloqueo',id:id})}).then(function(r){return r.json();}).then(function(){ cargarBloqueos(); }).catch(function(){ cargarBloqueos(); });
    }
  }

  window.AgendaMod = { mount: mount };
})();
