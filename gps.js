'use strict';
/* Trote con GPS: mide tiempo y distancia sin conexión.
   - En la app Android (Capacitor) sigue registrando con la pantalla apagada (servicio en segundo plano con aviso fijo).
   - En la web (PWA) solo registra con la pantalla encendida: se pide que no se apague. */
const GPS = { id: null, bg: null, wake: null, err: '' };
const GPS_MAX_ACC = 35;      // metros: se ignoran los puntos con peor precisión
const GPS_MAX_SPEED = 9;     // m/s: más que eso a pie es un salto del GPS
const gpsNative = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

/* En la app Android los módulos nativos están en Capacitor.Plugins (registerPlugin solo existe si se carga @capacitor/core). */
function gpsPlugin(name) {
  const C = window.Capacitor;
  if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
  return typeof C.registerPlugin === 'function' ? C.registerPlugin(name) : null;
}
function gpsDist(a, b) {   // metros entre dos puntos (Haversine)
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Recibe un punto {lat, lon, acc, t}; suma distancia solo si es confiable. */
function gpsAccept(p) {
  const g = S.gps;
  if (!g || !isFinite(p.lat) || !isFinite(p.lon)) return;
  g.acc = Math.round(p.acc || 0); g.fix = (g.fix || 0) + 1; GPS.err = '';   // llegó un punto: el GPS anda
  if (p.acc > GPS_MAX_ACC || p.t < g.start - 5000) { save(); return; }
  if (g.last) {
    const d = gpsDist(g.last, p), dt = (p.t - g.last.t) / 1000;
    if (dt <= 0) return;
    const minStep = Math.max(4, Math.min(15, (p.acc || 0) * 0.5));   // el temblor del GPS estando quieto no suma
    if (d < minStep || d / dt > GPS_MAX_SPEED) { save(); return; }
    g.m += d;
  }
  g.last = { lat: p.lat, lon: p.lon, t: p.t };
  save();
}

async function gpsAttach() {
  if (GPS.id != null || !S.gps) return;
  GPS.err = '';
  try {
    if (gpsNative()) {
      const C = window.Capacitor;
      try { await gpsPlugin('LocalNotifications').requestPermissions(); } catch (e) { /* sin permiso de avisos igual mide */ }
      const BG = GPS.bg = gpsPlugin('BackgroundGeolocation');
      if (!BG) throw new Error('falta el módulo de ubicación');
      GPS.id = await BG.addWatcher({ backgroundTitle: 'Registrando trote', backgroundMessage: 'Asistentes está midiendo tu recorrido.', requestPermissions: true, stale: false, distanceFilter: 3 },
        (loc, err) => {
          if (err) { GPS.err = err.code === 'NOT_AUTHORIZED' ? 'Falta el permiso de ubicación. Activalo en Ajustes del teléfono → Asistentes → Ubicación → Permitir todo el tiempo.' : gpsWaitMsg(err.code || err.message); return; }
          gpsAccept({ lat: loc.latitude, lon: loc.longitude, acc: loc.accuracy, t: loc.time });
        });
    } else if (navigator.geolocation) {
      GPS.id = navigator.geolocation.watchPosition(
        pos => gpsAccept({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, t: pos.timestamp }),
        err => { GPS.err = err.code === 1 ? 'Falta el permiso de ubicación. Activalo en los ajustes del sitio.' : err.code === 3 ? '' : gpsWaitMsg(err.code); },   // 3 = todavía buscando: no es un error
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
      gpsWake();
    } else { GPS.err = 'Este dispositivo no tiene GPS.'; }
  } catch (e) { GPS.err = 'No pude iniciar el GPS' + (e && e.message ? ' (' + e.message + ')' : '') + '. Revisá que la ubicación del teléfono esté encendida.'; }
}
const gpsWaitMsg = c => 'Todavía no hay señal de GPS' + (c ? ' (' + c + ')' : '') + '. Revisá que la ubicación del teléfono esté encendida y quedate a cielo abierto: sigo intentando.';
async function gpsWake() {   // en la web: que la pantalla no se apague mientras se registra
  try { if (S.gps && navigator.wakeLock && !GPS.wake) { GPS.wake = await navigator.wakeLock.request('screen'); GPS.wake.addEventListener && GPS.wake.addEventListener('release', () => { GPS.wake = null; }); } } catch (e) { GPS.wake = null; }
}
async function gpsDetach() {
  try {
    if (GPS.id != null) { if (gpsNative() && GPS.bg) await GPS.bg.removeWatcher({ id: GPS.id }); else if (navigator.geolocation) navigator.geolocation.clearWatch(GPS.id); }
    if (GPS.wake) await GPS.wake.release();
  } catch (e) { /* ya estaba suelto */ }
  GPS.id = null; GPS.wake = null;
}

const gpsKm = () => (S.gps ? S.gps.m / 1000 : 0);
function gpsCard() {
  const g = S.gps;
  if (!g) return `<div class="row-actions"><button class="primary" data-a="gpsStart">▶ Empezar trote con GPS</button></div>
    <div class="note">${gpsNative() ? 'Sigue midiendo con la pantalla apagada.' : 'En la web hay que dejar la pantalla encendida. En la app Android sigue con la pantalla apagada.'}</div>`;
  const km = gpsKm(), secs = Math.round((Date.now() - g.start) / 1000);
  const sig = g.acc == null ? 'buscando señal…' : g.acc <= GPS_MAX_ACC ? 'señal buena (±' + g.acc + ' m)' : 'señal floja (±' + g.acc + ' m)';
  return `<section class="gpscard">
    <div class="what"><span class="dot" style="background:#d9534f"></span>Trote en curso · desde las ${hhmm(g.start)}</div>
    <div class="clock" data-gps="t">${fmtRun(Date.now() - g.start)}</div>
    <div class="gpsrow"><span><b data-gps="km">${fmtKm(Math.round(km * 100) / 100)}</b> km</span><span><b data-gps="p">${km > 0.05 ? fmtPace(secs, km) : '–'}</b> /km</span></div>
    <div class="sub" data-gps="sig">${sig}</div>
    <div class="note warn" data-gps="err"${GPS.err ? '' : ' hidden'}>${esc(GPS.err)}</div>
    <div class="btns"><button class="primary" data-a="gpsFinish">■ Terminar</button><button data-a="gpsCancel">Descartar</button></div>
  </section>`;
}
/* Aviso corto en Hoy mientras hay un trote en curso. */
const gpsBanner = () => S.gps ? `<button class="gpsbar" data-a="tab" data-tab="ejercicio"><span class="dot" style="background:#d9534f"></span>Trote en curso · <b data-gps="t">${fmtRun(Date.now() - S.gps.start)}</b> · <b data-gps="km">${fmtKm(Math.round(gpsKm() * 100) / 100)}</b> km</button>` : '';
function gpsTick() {
  const g = S.gps; if (!g) return;
  const km = gpsKm(), secs = Math.round((Date.now() - g.start) / 1000);
  document.querySelectorAll('[data-gps]').forEach(e => {
    const k = e.dataset.gps;
    if (k === 't') e.textContent = fmtRun(Date.now() - g.start);
    else if (k === 'km') e.textContent = fmtKm(Math.round(km * 100) / 100);
    else if (k === 'p') e.textContent = km > 0.05 ? fmtPace(secs, km) : '–';
    else if (k === 'err') { e.textContent = GPS.err; e.hidden = !GPS.err; }
    else if (k === 'sig') e.textContent = g.acc == null ? 'buscando señal…' : g.acc <= GPS_MAX_ACC ? 'señal buena (±' + g.acc + ' m)' : 'señal floja (±' + g.acc + ' m)';
  });
}

function gpsClick(a, el, id) {
  switch (a) {
    case 'gpsStart':
      if (S.gps) return true;
      S.gps = { start: Date.now(), m: 0, last: null, fix: 0, acc: null }; save(); render(); gpsAttach().then(() => render());
      return true;
    case 'gpsFinish': {
      const g = S.gps; if (!g) return true;
      const end = Date.now(), km = Math.round(g.m / 10) / 100;
      gpsDetach(); S.gps = null;
      if (km >= 0.02 && end - g.start >= 15000) { addSession(troteTask().id, g.start, end, km); ui.bmsg = 'Trote guardado: ' + fmtKm(km) + ' km.'; }
      else ui.bmsg = 'El trote no registró distancia, así que no se guardó.';
      commit(); return true;
    }
    case 'gpsCancel':
      ui.sheet = { type: 'confirm', title: 'Descartar el trote', text: 'Se borra lo que se midió hasta ahora. No se guarda nada.', action: 'gpsCancelYes' }; render(); return true;
    case 'gpsCancelYes': gpsDetach(); S.gps = null; ui.sheet = null; commit(); return true;
  }
  return false;
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  // si la app se cerró en medio de un trote, retoma el registro
  setTimeout(() => { if (typeof S !== 'undefined' && S.gps) gpsAttach(); }, 0);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.gps && !gpsNative()) gpsWake(); });
}
