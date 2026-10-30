'use strict';
/* Asistentes — botonera de actividades con cronómetro y grilla horaria del día.
   Los datos se guardan en el celular (localStorage). */

const KEY = 'asistentes.v1';
const COLORS = ['#7fa8d6', '#e3a27a', '#8fbf9f', '#b79ad1', '#e0929f', '#7cc0c4', '#e5c476', '#9aa5d9',
  '#c4a484', '#8cb4c8', '#d7a8c9', '#a9c27f', '#e0b49a', '#9fb3c8'];
const OLD_COLORS = ['#2f6fed', '#e8590c', '#2b8a3e', '#ae3ec9', '#d6336c', '#0c8599', '#f08c00', '#6741d9'];
const DAYN = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const GRID_FROM = 7;          // la grilla del día va de 7:00 ...
const GRID_TO = 24;           // ... a medianoche
const STREAK_MIN = 10;        // minutos mínimos en el día para sumar a la racha
const MIN_SESSION_MS = 3000;  // menos que esto se considera un toque accidental
const HOUR = 3600000;

/* ---------- utilidades ---------- */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const todayStr = () => dstr(new Date());
const mondayOf = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dstr(d); };
const dayStartMs = s => parseD(s).getTime();
const atTime = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = parseD(date); d.setHours(h, m, 0, 0); return d.getTime(); };
const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
const $ = sel => document.querySelector(sel);

function fmtHM(sec) {
  if (!sec) return '0 min';
  if (sec < 60) return 'menos de 1 min';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? (m ? h + ' h ' + m + ' min' : h + ' h') : m + ' min';
}
function fmtRun(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60);
}

/* ---------- datos ---------- */
function ensureCat(cats, name) {
  let c = cats.find(x => x.name === name);
  if (!c) { c = { id: uid(), name, color: COLORS[cats.length % COLORS.length] }; cats.push(c); }
  return c;
}
function newTask(o) {
  return Object.assign({ id: uid(), key: '', name: '', catId: '', type: 'recurring', days: [0, 1, 2, 3, 4, 5, 6], date: '', notes: '', priority: 'normal', parentId: '', sec: '', time: '', archived: false, createdDate: todayStr() }, o);
}
function starterTasks(cats) {
  return [['Meditación', 'Hábitos'], ['Ejercicio', 'Hábitos'], ['Saxo', 'Saxo'], ['Tai chi', 'Tai chi'], ['Vibralta', 'Vibralta']]
    .map(([name, cat]) => newTask({ name, catId: ensureCat(cats, cat).id }));
}
const EX_DEFAULT = [['Flexiones', 10], ['Hombros arriba', 20], ['Hombros lateral', 10], ['Hombros frontal', 10], ['Sentadillas', 10], ['Bíceps alternados', 30], ['Colgarse de la barra', 30]];
const isTrote = t => !!t && (t.key === 'a-trote' || t.name.toLowerCase() === 'trote');
/* Prepara la sección Ejercicio: series diarias, electrodos, y mueve las actividades que corresponden. */
function ensureEx(s) {
  if (s.exv === 1) return s;
  s.exv = 1;
  s.ex = s.ex || { list: EX_DEFAULT.map(([name, reps]) => ({ id: uid(), name, reps, sets: 4 })) };
  s.exlog = s.exlog || {};
  s.electro = s.electro || [];
  const by = n => s.tasks.find(t => t.type === 'recurring' && t.name.toLowerCase() === n.toLowerCase());
  const need = (name, cat, key) => {
    let t = by(name);
    if (!t) { t = newTask({ key, name, catId: ensureCat(s.categories, cat).id, days: [] }); s.tasks.push(t); }
    t.sec = 'ejercicio'; t.archived = false;
  };
  need('Meditación', 'Hábitos', 'a-meditación'); need('Estiramiento', 'Hábitos', 'a-estiramiento');
  need('Tai chi', 'Tai chi', 'a-tai-chi'); need('Trote', 'Hábitos', 'a-trote'); need('Boxeo', 'Ejercicio', 'a-boxeo');
  const old = by('Ejercicio'); if (old) old.archived = true;   // las series reemplazan al cronómetro de "Ejercicio"
  return s;
}
/* Ordena las recurrentes: Saxo martes/jueves, Perros lunes/miércoles, el resto todos los días; Acequia pasa a tarea suelta; Aprender Claude se quita. */
/* Categorías: Construcción y Patio juntas; Acequia pasa a Centro vecinal; Vehículos pasa a General (que siempre existe). */
function ensureCats(s) {
  const by = n => s.categories.find(c => c.name.toLowerCase() === n.toLowerCase());
  const move = (from, to) => { if (!from || !to || from === to) return; s.tasks.forEach(t => { if (t.catId === from.id) t.catId = to.id; }); s.categories = s.categories.filter(c => c !== from); };
  const co = by('Construcción'), pa = by('Patio');
  if (co) { co.name = 'Construcción y Patio'; move(pa, co); } else if (pa) pa.name = 'Construcción y Patio';
  const aq = by('Acequia'); if (aq) aq.name = 'Centro vecinal';
  const ad0 = by('Administrativo'), ge0 = by('General');
  if (ad0 && ge0) move(ad0, ge0); else if (ad0) ad0.name = 'General';
  const ve = by('Vehículos'), ad = by('General');
  if (ve && ad) move(ve, ad); else if (ve) ve.name = 'General';
  if (!by('General')) ensureCat(s.categories, 'General');
  if (!by('Compras')) ensureCat(s.categories, 'Compras');
  const ot = by('Otros'); if (ot) move(ot, by('General'));
  return s;
}
function ensureRec(s) {
  if (s.rv >= 12) return s;
  const first = !s.rv, v2 = s.rv >= 2, v3 = s.rv >= 3, v4 = s.rv >= 4;
  s.rv = 12;
  ensureCats(s);
  { const ej = s.tasks.find(t => t.type === 'recurring' && t.name.toLowerCase() === 'ejercicio');   // "Ejercicio" vuelve como actividad (cronómetro) en la pestaña Ejercicio
    if (ej) { ej.archived = false; ej.sec = 'ejercicio'; if (!ej.days || !ej.days.length) ej.days = [0, 1, 2, 3, 4, 5, 6]; }
    else s.tasks.push(newTask({ key: 'a-ejercicio', name: 'Ejercicio', catId: ensureCat(s.categories, 'Hábitos').id, sec: 'ejercicio' })); }
  if (!s.tasks.some(t => t.type === 'recurring' && t.name.toLowerCase() === 'recreo')) s.tasks.push(newTask({ key: 'a-recreo', name: 'Recreo', catId: ensureCat(s.categories, 'Recreo').id }));   // actividad diaria que va última
  s.tasks.forEach(t => { if (t.type === 'recurring' && /^(construcci[oó]n|patio)$/i.test(t.name)) t.archived = true; });   // Construcción y Patio pasan a ser solo una categoría de las tareas de una sola vez (su tiempo queda en la categoría)
  if (s.ex && s.ex.list) s.ex.list.forEach(x => { if (/^hombros? lateral$/i.test(x.name) && x.reps === 20) x.reps = 10; });   // Hombro lateral: 10 repeticiones
  if (s.ex && s.ex.list && !s.ex.list.some(x => /^hombros? frontal$/i.test(x.name))) {   // Hombros frontal: 10 repeticiones, después del lateral
    const k = s.ex.list.findIndex(x => /^hombros? lateral$/i.test(x.name));
    s.ex.list.splice(k >= 0 ? k + 1 : s.ex.list.length, 0, { id: uid(), name: 'Hombros frontal', reps: 10, sets: 4 });
  }
  if (v4) return s;
  // Series diarias: suma "Colgarse de la barra" (4 series; el número se cambia en Ajustes)
  if (s.ex && s.ex.list && !s.ex.list.some(x => /colgarse/i.test(x.name))) s.ex.list.push({ id: uid(), name: 'Colgarse de la barra', reps: 30, sets: 4 });
  if (v3) return s;
  // Ejercicio: Boxeo martes y jueves; el resto de las actividades de esa sección, todos los días (Trote es libre)
  s.tasks.filter(t => t.sec === 'ejercicio' && t.type === 'recurring' && !isTrote(t) && !(t.days || []).length).forEach(t => { t.days = [0, 1, 2, 3, 4, 5, 6]; });
  const bx = s.tasks.find(t => t.type === 'recurring' && !t.archived && t.name.toLowerCase() === 'boxeo'); if (bx) bx.days = [2, 4];
  if (v2) return s;
  const pr = s.tasks.find(t => !t.archived && (t.key === 't-presion' || /^medirme la presi/i.test(t.name)));
  if (pr) pr.archived = true;   // pasó a la Rutina del día, como botón de los miércoles
  if (!first) return s;
  const by = n => s.tasks.find(t => t.type === 'recurring' && !t.archived && t.name.toLowerCase() === n);
  const all = [0, 1, 2, 3, 4, 5, 6];
  const ac = by('acequia'); if (ac) { ac.type = 'once'; ac.days = all; ac.date = ''; ac.sec = ''; ac.priority = 'normal'; }
  const ap = by('aprender claude'); if (ap) ap.archived = true;
  const sx = by('saxo'); if (sx) sx.days = [2, 4];
  const pe = by('perros'); if (pe) pe.days = [1, 3];
  ['vibralta', 'canto', 'chino', 'inglés', 'charbonier', 'parapipou', 'orden digital', 'limpieza', 'construcción', 'patio'].forEach(n => { const t = by(n); if (t) t.days = all; });
  return s;
}
function fresh() {
  const cats = [];
  ['Saxo', 'Tai chi', 'Vibralta', 'Hábitos'].forEach(n => ensureCat(cats, n));
  return ensureRec(ensureEx({ v: 2, settings: { dailyGoalMin: 0 }, categories: cats, tasks: starterTasks(cats), sessions: [], done: {}, timers: [] }));
}
/* Pasa los datos de la primera versión (bloques de 25 min) al formato nuevo, sin perder nada. */
function migrate(o) {
  const n = { v: 2, settings: { dailyGoalMin: 0 }, categories: o.categories || [], tasks: [], sessions: o.sessions || [], done: o.done || {}, timers: [] };
  n.categories.forEach(c => { const i = OLD_COLORS.indexOf(c.color); if (i >= 0) c.color = COLORS[i]; });
  n.tasks = (o.tasks || []).map(t => newTask({ id: t.id, name: t.name, catId: t.catId, type: t.type, days: t.days || [0, 1, 2, 3, 4, 5, 6], date: t.date || '', notes: t.notes || '', priority: t.priority === 'high' ? 'high' : 'normal', parentId: t.parentId || '', archived: !!t.archived, createdDate: t.createdDate || todayStr() }));
  if (o.settings && o.settings.dailyGoal) n.settings.dailyGoalMin = o.settings.dailyGoal * (o.settings.blockMin || 25);
  if ((o.habits || []).length) {
    const hc = ensureCat(n.categories, 'Hábitos');
    o.habits.forEach(h => { if (!n.tasks.some(t => t.name === h.name)) n.tasks.push(newTask({ name: h.name, catId: hc.id })); });
  }
  if (!n.tasks.length) n.tasks = starterTasks(n.categories);
  return n;
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 2) return ensureRec(ensureEx(s));
    if (s && s.v === 1) return ensureRec(ensureEx(migrate(s)));
  } catch (e) { /* sin datos */ }
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin espacio */ } }

let S = load();
const ui = { tab: 'hoy', weekStart: mondayOf(todayStr()), detailDate: todayStr(), sheet: null, open: {}, msg: '', bmsg: '', pending: '', month: '' };
/* Primera vez: carga sola las tareas iniciales (seed.js). Después no vuelve a tocar nada. */
if (typeof SEED !== 'undefined' && !S.seeded) { try { importData(SEED); } catch (e) { /* sin semilla */ } S.seeded = true; S.seededDates = true; save(); }
else if (typeof SEED !== 'undefined' && !S.seededDates) { try { importDates(SEED.dates); } catch (e) { /* sin fechas */ } S.seededDates = true; save(); }

/* ---------- actividades ---------- */
const taskById = id => S.tasks.find(t => t.id === id);
const catOf = t => (t && S.categories.find(c => c.id === t.catId)) || { name: 'Sin categoría', color: '#c5cbd3' };
const colorOf = id => catOf(taskById(id)).color;
const isDoneOn = (t, date) => !!(S.done[t.id] && S.done[t.id][date]);
const onceDoneDate = t => { const k = Object.keys(S.done[t.id] || {}); return k.length ? k[0] : null; };

function isScheduled(t, date) {
  if (t.archived) return false;
  if (t.type === 'once') return (onceDoneDate(t) || t.date) === date;
  if (date < t.createdDate) return false;
  return t.days.includes(parseD(date).getDay());
}
const recurring = () => S.tasks.filter(t => !t.archived && t.type === 'recurring' && t.sec !== 'ejercicio');
function onceList(date) {
  const today = todayStr();
  return S.tasks.filter(t => {
    if (t.archived || t.type !== 'once') return false;
    const d = onceDoneDate(t);
    if (d) return d === date;
    return date === today ? t.date <= date : t.date === date;
  });
}

/* Subtareas: una tarea suelta puede pertenecer a otra más grande. */
const kidsOf = id => S.tasks.filter(t => t.parentId === id && !t.archived);
function pendingTop(date) {
  const all = onceList(date), ids = new Set(all.map(t => t.id));
  return all.filter(t => !t.parentId || !ids.has(t.parentId));
}
/* Cuando se completan todas las subtareas, la tarea grande se marca sola (y se desmarca si se destilda una). */
function syncParent(pid, date) {
  if (!pid) return;
  const p = taskById(pid), kids = kidsOf(pid);
  if (!p || !kids.length) return;
  if (kids.every(k => onceDoneDate(k))) { if (!onceDoneDate(p)) (S.done[pid] = S.done[pid] || {})[date] = true; }
  else if (onceDoneDate(p)) S.done[pid] = {};
}

/* Importa un archivo con actividades y tareas sin pisar ni duplicar lo que ya hay. */
function importData(o) {
  if (!o || o.format !== 'asistentes-import-1') throw new Error('formato');
  const r = { cats: 0, acts: 0, tasks: 0, skipped: 0 };
  const catId = name => { const before = S.categories.length; const c = ensureCat(S.categories, name); if (S.categories.length > before) r.cats++; return c.id; };
  (o.categories || []).forEach(c => catId(c.name));
  (o.activities || []).forEach(a => {
    const ex = S.tasks.find(t => t.type === 'recurring' && ((a.key && t.key === a.key) || t.name.toLowerCase() === a.name.toLowerCase()));
    if (ex) { if (a.key && !ex.key) ex.key = a.key; r.skipped++; return; }
    S.tasks.push(newTask({ key: a.key || '', name: a.name, catId: catId(a.category), days: a.days || [0, 1, 2, 3, 4, 5, 6], notes: a.notes || '', sec: a.sec || '' }));
    r.acts++;
  });
  const addOnce = (t, parent) => {
    const ex = t.key && S.tasks.find(x => x.key === t.key);
    if (ex) { r.skipped++; return ex; }
    const nt = newTask({ key: t.key || '', name: t.name, type: 'once', date: t.date || '', notes: t.notes || '', priority: t.priority === 'high' ? 'high' : 'normal', parentId: parent ? parent.id : '', catId: parent ? parent.catId : catId(t.category) });
    S.tasks.push(nt); r.tasks++;
    return nt;
  };
  (o.tasks || []).forEach(t => { const p = addOnce(t, null); (t.subtasks || []).forEach(s => addOnce(s, p)); });
  importDates(o.dates);
  if (o.dailyGoalMin && !S.settings.dailyGoalMin) S.settings.dailyGoalMin = o.dailyGoalMin;
  return r;
}
function importText(text) {
  try {
    const r = importData(JSON.parse(text));
    ui.msg = 'Listo: se cargaron ' + r.acts + ' actividades y ' + r.tasks + ' tareas' + (r.cats ? ', con ' + r.cats + ' categorías nuevas' : '') + (r.skipped ? '. ' + r.skipped + ' ya estaban y no se tocaron' : '') + '.';
  } catch (e) { ui.msg = 'No pude leer ese contenido. Tiene que ser el archivo de tareas que te pasé.'; }
  commit();
}

/* ---------- tiempos ---------- */
function overlapSecs(a, b, date) {
  const ds = dayStartMs(date), de = dayStartMs(addDays(date, 1));
  const lo = Math.max(a, ds), hi = Math.min(b, de);
  return hi > lo ? Math.round((hi - lo) / 1000) : 0;
}
function secsOn(id, date) {
  let n = S.sessions.filter(s => s.taskId === id && s.date === date).reduce((a, s) => a + s.seconds, 0);
  const tm = timerOf(id); if (tm) n += overlapSecs(tm.start, Date.now(), date);
  return n;
}
function secsDay(date) {
  let n = S.sessions.filter(s => s.date === date).reduce((a, s) => a + s.seconds, 0);
  timers().forEach(tm => { n += overlapSecs(tm.start, Date.now(), date); });
  return n;
}
const secsTotal = id => S.sessions.filter(s => s.taskId === id).reduce((a, s) => a + s.seconds, 0);
const secsFam = (id, date) => secsOn(id, date) + kidsOf(id).reduce((a, k) => a + secsOn(k.id, date), 0);

function streak(t) {
  if (t.type !== 'recurring') return 0;
  const hit = d => secsOn(t.id, d) >= STREAK_MIN * 60;
  let cur = todayStr(), n = 0, guard = 0;
  if (isScheduled(t, cur) && !hit(cur)) cur = addDays(cur, -1);
  while (guard++ < 800) {
    if (cur < t.createdDate) break;
    if (isScheduled(t, cur)) { if (hit(cur)) n++; else break; }
    cur = addDays(cur, -1);
  }
  return n;
}

/* Guarda un tramo; si cruza la medianoche lo parte en dos, uno por día. */
function addSession(taskId, startMs, endMs, km) {
  let a = startMs, first = true;
  while (a < endMs) {
    const d = dstr(new Date(a));
    const b = Math.min(endMs, dayStartMs(addDays(d, 1)));
    const secs = Math.round((b - a) / 1000);
    if (secs >= 1) { S.sessions.push(Object.assign({ id: uid(), taskId: taskId || null, start: a, end: b, seconds: secs, date: d }, km != null && first ? { km } : {})); first = false; }
    a = b;
  }
}

/* ---------- cronómetro ---------- */
/* Se pueden contar varias actividades a la vez: cada una tiene su propio reloj. */
function timers() {
  if (S.timer) { (S.timers = S.timers || []).push(S.timer); S.timer = null; }   // datos de la versión de un solo reloj
  return S.timers || (S.timers = []);
}
const timerOf = id => timers().find(x => x.taskId === id);
function stopTimer(now, id) {
  const end = now || Date.now(), stop = timers().filter(x => !id || x.taskId === id);
  S.timers = timers().filter(x => !stop.includes(x));
  stop.forEach(tm => { if (end - tm.start >= MIN_SESSION_MS) addSession(tm.taskId, tm.start, end); });
}
function toggleTimer(taskId) {
  const now = Date.now();
  if (timerOf(taskId)) stopTimer(now, taskId); else timers().push({ taskId, start: now });
  commit();
}

/* Finalizar: corta el cronómetro si corría y deja la actividad hecha por hoy (sale de la lista de Hoy). */
function finishToday(id) {
  if (timerOf(id)) stopTimer(null, id);
  (S.done[id] = S.done[id] || {})[todayStr()] = true;
  commit();
}
/* Recurrentes de Hoy: las de hoy, ordenadas por horario (las sin horario al final); las ya finalizadas salen. */
function padsToday(list) {
  const today = todayStr(), run = timers().map(x => x.taskId);
  const open = (list || recurring()).filter(t => !isDoneOn(t, today));
  const key = t => t.time || (/^recreo$/i.test(t.name) ? '99:99z' : '99:99');   // Recreo siempre va última (si no tiene hora)
  const srt = a => a.map((t, i) => [t, i]).sort((x, y) => key(x[0]).localeCompare(key(y[0])) || x[1] - y[1]).map(x => x[0]);
  const hoy = srt(open.filter(t => isScheduled(t, today) || run.includes(t.id) || secsOn(t.id, today) > 0));
  return { hoy, otras: srt(open.filter(t => !hoy.includes(t))), hechas: (list || recurring()).filter(t => isDoneOn(t, today)) };
}

/* ---------- vistas ---------- */
function gridHTML(date) {
  const ds = dayStartMs(date), de = dayStartMs(addDays(date, 1));
  const segs = S.sessions.filter(s => s.date === date).map(s => ({ taskId: s.taskId, a: s.start, b: s.end, sid: s.id }));
  timers().forEach(tm => {
    const a = Math.max(tm.start, ds), b = Math.min(Date.now(), de);
    if (b > a) segs.push({ taskId: tm.taskId, a, b, sid: null, live: true });
  });
  const rows = [];
  for (let h = GRID_FROM; h < GRID_TO; h++) {
    const hs = ds + h * HOUR, he = hs + HOUR;
    const inRow = segs.filter(s => s.b > hs && s.a < he).sort((x, y) => x.a - y.a), ends = [];
    inRow.forEach(s => { let l = ends.findIndex(e => e <= s.a); if (l < 0) l = ends.length; ends[l] = s.b; s.lane = l; });   // si se pisan, van en carriles
    const parts = inRow.map(s => {
      const a = Math.max(s.a, hs), b = Math.min(s.b, he), lanes = ends.length;
      const t = taskById(s.taskId);
      const tip = (t ? t.name : 'Sin actividad') + ' · ' + hhmm(s.a) + '–' + hhmm(s.b);
      return `<i class="seg${s.live ? ' live' : ''}" style="${lanes > 1 ? `top:${(s.lane * 100 / lanes).toFixed(1)}%;bottom:auto;height:${(100 / lanes).toFixed(1)}%;` : ''}left:${((a - hs) / 36000).toFixed(2)}%;width:${Math.max(0.9, (b - a) / 36000).toFixed(2)}%;background:${colorOf(s.taskId)}"${s.sid ? ` data-a="editSession" data-id="${s.sid}"` : ''} title="${esc(tip)}"></i>`;
    }).join('');
    rows.push(`<div class="hrow"><span class="hl">${pad(h)}</span><div class="track">${parts}</div></div>`);
  }
  const out = segs.reduce((a, s) => a + Math.round(((s.b - s.a) - (Math.max(0, Math.min(s.b, de) - Math.max(s.a, ds + GRID_FROM * HOUR)))) / 1000), 0);
  const note = out > 60 ? `<div class="note">${fmtHM(out)} fuera del horario de la grilla (se guardan igual).</div>` : '';
  return rows.join('') + note;
}

/* "Otras actividades" (las que hoy no tocan) y "Hechas hoy" (con Reabrir), debajo de los cuadros. */
function morePads(pt, k) {
  const today = todayStr(), oo = ui.open['otras' + k], oh = ui.open['hechas' + k];
  const bo = pt.otras.length ? `<button class="ghost morebtn" data-a="expand" data-id="otras${k}">${oo ? '▾' : '▸'} Otras actividades (${pt.otras.length})</button>` : '';
  const bh = pt.hechas.length ? `<button class="ghost morebtn" data-a="expand" data-id="hechas${k}">${oh ? '▾' : '▸'} Hechas hoy (${pt.hechas.length})</button>` : '';
  const po = oo && pt.otras.length ? `<div class="pads">${pt.otras.map(t => padHTML(t, true)).join('')}</div>` : '';
  const ph = oh && pt.hechas.length ? `<div class="hechas">${pt.hechas.map(t => `<div class="hecha"><span><i class="dot" style="background:${catOf(t).color}"></i>${esc(t.name)} · ${fmtHM(secsOn(t.id, today))}</span><button class="ghost" data-a="reopen" data-id="${t.id}">Reabrir</button></div>`).join('')}</div>` : '';
  return (bo || bh ? `<div class="morerow">${bo}${bh}</div>` : '') + po + ph;
}
function padHTML(t, fin) {
  const cat = catOf(t), running = !!timerOf(t.id), today = todayStr();
  const sec = secsOn(t.id, today), st = streak(t);
  const meta = [fmtHM(sec)];
  if (st > 0) meta.push('racha ' + st);
  if (fin && t.time && !running) meta.unshift(t.time);
  const acts = fin && (running || sec > 0) ? `<span class="pacts"><span class="pbtn" data-a="toggle" data-id="${t.id}">${running ? 'Detener' : 'Reanudar'}</span><span class="pbtn fin" data-a="finish" data-id="${t.id}">Finalizar</span></span>` : '';
  return `<button class="pad${running ? ' on' : ''}" data-a="toggle" data-id="${t.id}" style="--c:${cat.color};--t:${hexA(cat.color, 0.28)};--s:${hexA(cat.color, 0.5)}">
    <span class="more" data-a="edit" data-id="${t.id}" aria-label="Editar">⋯</span>
    <span class="pname">${esc(t.name)}</span>
    <span class="pcat">${running ? '● contando' : fin && sec > 0 ? '❚❚ en pausa' : esc(cat.name)}</span>
    <span class="ptime">${meta.join(' · ')}</span>${acts}
  </button>`;
}

/* Tiempo del día por categoría (suma las tareas de una sola vez y las actividades de cada categoría). */
function catTimes(date) {
  const m = {};
  S.tasks.forEach(t => { const sec = secsOn(t.id, date); if (sec > 0) { const c = catOf(t); (m[c.name] = m[c.name] || { name: c.name, color: c.color, secs: 0 }).secs += sec; } });
  return Object.values(m).sort((a, b) => b.secs - a.secs);
}
const catTimesHTML = (date, pad) => { const r = catTimes(date); return r.length ? `<h2 style="margin:10px 0 4px">Por categoría</h2>` + r.map(c => `<div class="stat"${pad ? ' style="padding-left:0;padding-right:0"' : ''}><span><span class="dot" style="background:${c.color}"></span> ${esc(c.name)}</span><span>${fmtHM(c.secs)}</span></div>`).join('') : ''; };
function onceRow(t, date, sub) {
  const cat = catOf(t), done = sub ? !!onceDoneDate(t) : isDoneOn(t, date), running = !!timerOf(t.id);
  const kids = sub ? [] : kidsOf(t.id), kd = kids.filter(k => onceDoneDate(k)).length, open = !!ui.open[t.id];
  const late = !done && t.date && t.date < date ? ' · pasó de ' + t.date.slice(8) + '/' + t.date.slice(5, 7) : '';
  const meta = [esc(cat.name), fmtHM(sub ? secsOn(t.id, date) : secsFam(t.id, date))];
  if (kids.length) meta.push(kd + ' de ' + kids.length + ' hechas');
  const row = `<div class="once${done ? ' done' : ''}${sub ? ' sub' : ''}${t.priority === 'high' && !done ? ' high' : ''}">
    <button class="check" data-a="done" data-id="${t.id}" data-date="${date}" aria-label="Marcar hecha">${done ? '✓' : ''}</button>
    <div class="body" data-a="edit" data-id="${t.id}"><div class="name"><span class="dot" style="background:${cat.color}"></span>${esc(t.name)}${t.priority === 'high' && !done ? '<span class="tag">Prioritaria</span>' : ''}</div>
      <div class="meta">${meta.join(' · ')}${late}</div>${t.priority === 'high' && !done && !sub ? `<button class="ghost unprio" data-a="unprio" data-id="${t.id}">Quitar de prioridad</button>` : ''}</div>
    ${kids.length ? `<button class="ghost exp" data-a="expand" data-id="${t.id}" aria-label="Ver subtareas">${open ? '▾' : '▸'}</button>` : ''}
    ${date === todayStr() && !done ? `<button class="mini${running ? ' on' : ''}" data-a="toggle" data-id="${t.id}" style="--c:${cat.color}">${running ? '■' : '▶'}</button>` : ''}
  </div>`;
  return row + (kids.length && open ? `<div class="subs">${kids.map(k => onceRow(k, date, true)).join('')}</div>` : '');
}
const byPrio = (a, b) => (b.priority === 'high') - (a.priority === 'high') || (a.date || '').localeCompare(b.date || '');

/* ---------- días sin fumar ---------- */
const smoke = () => S.smoke || (S.smoke = { days: [], base: 0, best: 0 });
const smokeCount = () => (smoke().base || 0) + smoke().days.length;
function smokeCard() {
  const today = todayStr(), n = smokeCount(), done = smoke().days.includes(today), best = Math.max(smoke().best || 0, n);
  return `<section class="smokecard"><div><div class="smk-n" id="smk-n">${n}</div>
      <div class="meta">${n === 1 ? 'día' : 'días'} sin fumar${best > n ? ' · récord ' + best : ''}</div></div>
    <button class="${done ? 'primary' : ''}" data-a="smoke">${done ? 'Hoy no fumé ✓' : 'Hoy no fumé'}</button></section>
    <div class="smk-links"><button class="ghost" data-a="smokeAdjust">Ajustar número</button><button class="ghost" data-a="smokeReset">Reiniciar</button></div>`;
}

/* ---------- sueño ---------- */
const sleepS = () => S.sleep || (S.sleep = { wake: '07:00', latency: 20, nights: {} });
const wakeMsOn = (date, e) => atTime(date, (e && e.wake) || sleepS().wake);
/* Horas de sueño = desde que te dormís (te acostás + lo que tardás en dormirte) hasta que te levantás. */
const sleepSecs = (date, e) => Math.max(0, Math.round((wakeMsOn(date, e) - (e.bed + sleepS().latency * 60000)) / 1000));
const nextWakeKey = () => { const t = todayStr(); return Date.now() < wakeMsOn(t) ? t : addDays(t, 1); };
const fmtH1 = sec => (Math.round(sec / 360) / 10).toFixed(1).replace('.', ',');

function sleepCard() {
  const sl = sleepS(), key = nextWakeKey(), cur = sl.nights[key], today = todayStr(), last = sl.nights[today];
  let body, btns;
  if (cur) {
    const asleep = cur.bed + sl.latency * 60000;
    body = `<div class="smk-n small">${fmtHM(sleepSecs(key, cur))}</div>
      <div class="meta">Te acostaste a las ${hhmm(cur.bed)}, dormido ~${hhmm(asleep)} · hasta las ${(cur.wake || sl.wake)}</div>`;
    btns = `<button data-a="sleepEdit" data-key="${key}">Editar</button><button class="ghost danger" data-a="sleepCancel" data-key="${key}">Cancelar</button>`;
  } else {
    body = last && Date.now() >= wakeMsOn(today, last)
      ? `<div class="smk-n small">${fmtHM(sleepSecs(today, last))}</div><div class="meta">Anoche dormiste · ${hhmm(last.bed)} → ${(last.wake || sl.wake)}</div>`
      : '';
    btns = `<button class="primary" data-a="sleepGo">Me voy a dormir</button>`;
  }
  return `<h2>Sueño</h2><section class="smokecard sleepcard${body ? '' : ' solo'}">${body ? `<div>${body}</div>` : ''}<div class="sleepbtns">${btns}</div></section>
    <div class="smk-links">${last ? `<button class="ghost" data-a="sleepEdit" data-key="${today}">Corregir anoche</button>` : `<button class="ghost" data-a="sleepEdit" data-key="${today}" data-new="1">Cargar</button>`}</div>`;
}
function sleepSheet(sh) {
  const sl = sleepS(), e = sl.nights[sh.key];
  const bed = e ? hhmm(e.bed) : '23:00', wake = e ? (e.wake || sl.wake) : sl.wake;
  return `<h3>${e ? 'Editar sueño' : 'Cargar sueño'}</h3>
    <div class="field"><label>Me acosté a las</label><input type="time" id="f-bed" value="${bed}"></div>
    <div class="field"><label>Me levanté a las (${sl.wake} es lo normal)</label><input type="time" id="f-wakeh" value="${wake}"></div>
    <div class="note" style="padding:0 0 4px">Se descuentan ${sl.latency} min que tardás en dormirte. Si te levantaste más tarde, cambiá la hora de levantarte y se suman esas horas.</div>
    <div class="btns"><button class="primary" data-a="saveSleep" data-key="${sh.key}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>`;
}
function semanaSueno(days) {
  const sl = sleepS(), today = todayStr();
  const vals = days.map(d => { const e = sl.nights[d]; return e && Date.now() >= wakeMsOn(d, e) ? sleepSecs(d, e) : null; });
  const done = vals.filter(v => v != null), avg = done.length ? done.reduce((a, v) => a + v, 0) / done.length : 0;
  const cells = days.map((d, i) => vals[i] == null ? `<td><span class="sq ${d < today ? 'miss' : 'none'}"></span></td>` : `<td><span class="sq" style="background:${hexA('#9aa5d9', 0.45)}">${fmtH1(vals[i])}</span></td>`).join('');
  return `<h2>Sueño de la semana</h2>
    <table class="wgrid"><thead><tr><th></th>${days.map(d => `<th>${DAYN[parseD(d).getDay()]}</th>`).join('')}</tr></thead><tbody><tr><td class="nm">Horas</td>${cells}</tr></tbody></table>
    <div class="stat"><span>Promedio por noche</span><span>${done.length ? fmtHM(Math.round(avg)) : '–'}</span></div>`;
}

function clockCard() {
  const tms = timers(), total = secsDay(todayStr()), goal = S.settings.dailyGoalMin;
  const pct = goal ? Math.min(100, Math.round(total / (goal * 60) * 100)) : 0, tm = tms[0];
  const nm = x => { const t = taskById(x.taskId); return `<span class="dot" style="background:${colorOf(x.taskId)}"></span>${esc(t ? t.name : 'Actividad')}`; };
  const body = tms.length > 1
    ? `<div class="what">${tms.length} actividades a la vez</div>${tms.map(x => `<div class="clockrow"><span class="cn">${nm(x)}<small>desde las ${hhmm(x.start)}</small></span><span class="cv" data-clock="${x.start}">${fmtRun(Date.now() - x.start)}</span></div>`).join('')}`
    : `<div class="what">${tm ? nm(tm) : 'Tocá una actividad para empezar'}</div>
      <div class="clock${tm ? '' : ' idle'}" id="clock"${tm ? ` data-clock="${tm.start}"` : ''}>${tm ? fmtRun(Date.now() - tm.start) : '00:00'}</div>
      <div class="sub">${tm ? 'desde las ' + hhmm(tm.start) : '&nbsp;'}</div>`;
  return `<section class="clockcard">
      ${body}
      <div class="today" id="todaytxt">Hoy: ${fmtHM(total)}${goal ? ' · meta ' + fmtHM(goal * 60) : ''}</div>
      ${goal ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}
    </section>
`;
}

/* ---------- ejercicio ---------- */
const exCount = (date, x) => Math.min(x.sets, (S.exlog[date] && S.exlog[date][x.id]) || 0);
function exTotals(date) { let d = 0, t = 0; S.ex.list.forEach(x => { d += exCount(date, x); t += x.sets; }); return { d, t }; }
const dayComplete = date => { const x = exTotals(date); return x.t > 0 && x.d >= x.t; };
function exStreak() {
  let cur = todayStr(), n = 0;
  if (!dayComplete(cur)) cur = addDays(cur, -1);
  while (dayComplete(cur) && n < 800) { n++; cur = addDays(cur, -1); }
  return n;
}
const troteTask = () => S.tasks.find(isTrote);
const fmtKm = k => String(Math.round(k * 100) / 100).replace('.', ',');
const fmtPace = (sec, km) => { if (!km) return '–'; const p = Math.round(sec / km); return Math.floor(p / 60) + ':' + pad(p % 60); };
const electroWeek = ws => S.electro.filter(d => d >= ws && d <= addDays(ws, 6));

function ejercicioView() {
  const today = todayStr(), ws = mondayOf(today);
  const exAll = S.tasks.filter(t => !t.archived && t.type === 'recurring' && t.sec === 'ejercicio' && !isTrote(t));
  const pe = padsToday(exAll);
  const runs = S.sessions.filter(r => r.km != null).sort((a, b) => b.start - a.start);
  const wk = runs.filter(r => r.date >= ws && r.date <= addDays(ws, 6));
  const kmW = wk.reduce((a, r) => a + r.km, 0);
  const tot = exTotals(today), st = exStreak(), ew = electroWeek(ws).length, eToday = S.electro.includes(today);
  const runRows = runs.slice(0, 6).map(r => `<div class="stat runrow" data-a="editRun" data-id="${r.id}"><span>${parseD(r.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })} · ${hhmm(r.start)}</span><span>${fmtKm(r.km)} km · ${fmtRun(r.seconds * 1000)} · ${fmtPace(r.seconds, r.km)} /km</span></div>`).join('');
  const rowOf = x => {
    const c = exCount(today, x);
    return `<div class="exrow"><div class="exname"><b>${esc(x.name)}</b><span class="meta"> × ${x.reps}</span></div>
      <div class="sets">${Array.from({ length: x.sets }, (_, i) => `<button class="setb${i < c ? ' on' : ''}" data-a="set" data-id="${x.id}" data-n="${i + 1}" aria-label="Serie ${i + 1}">${i + 1}</button>`).join('')}</div></div>`;
  };
  const exPend = S.ex.list.filter(x => exCount(today, x) < x.sets), exFin = S.ex.list.filter(x => exCount(today, x) >= x.sets && x.sets > 0);
  const rows = exPend.map(rowOf).join('')
    + (exFin.length ? `<button class="ghost morebtn" data-a="expand" data-id="exFin">${ui.open.exFin ? '▾' : '▸'} Series completas (${exFin.length})</button>${ui.open.exFin ? exFin.map(rowOf).join('') : ''}` : '');
  return `<header class="top"><h1>Ejercicio</h1></header>
    ${clockCard()}
    <h2>Series de hoy</h2>
    <div class="exhead"><span>${tot.d} de ${tot.t} series</span>${tot.t && tot.d >= tot.t ? '<span class="tag ok">Ejercicio completo ✓</span>' : ''}${st ? `<span class="meta">racha ${st} ${st === 1 ? 'día' : 'días'}</span>` : ''}</div>
    ${S.ex.list.length ? (exPend.length ? '' : '<div class="empty">¡Series completas por hoy!</div>') : '<div class="empty">No hay ejercicios cargados. Agregalos en Ajustes.</div>'}
    ${rows}
    <h2>Actividades</h2>
    <div class="pads">${pe.hoy.map(t => padHTML(t, true)).join('')}</div>
    ${pe.hoy.length ? '' : '<div class="empty">¡Listo por hoy! No quedan actividades de ejercicio pendientes.</div>'}
    ${morePads(pe, 'Ej')}
    <h2>Trote</h2>
    <div class="stat"><span>Esta semana</span><span>${fmtKm(kmW)} km · ${wk.length} ${wk.length === 1 ? 'salida' : 'salidas'}</span></div>
    ${runRows || '<div class="empty">Todavía no cargaste ningún trote.</div>'}
    <div class="row-actions"><button data-a="newRun">+ Cargar trote</button></div>
    <h2>Electrodos</h2>
    <div class="ecard"><span>${ew} de 2 esta semana</span><button class="${eToday ? 'primary' : ''}" data-a="electro">${eToday ? 'Hecho hoy ✓' : 'Marcar hecho hoy'}</button></div>`;
}

function runSheet(sh) {
  const r = sh.id ? S.sessions.find(x => x.id === sh.id) : null, now = new Date();
  const date = r ? r.date : todayStr(), start = r ? hhmm(r.start) : pad(now.getHours()) + ':' + pad(now.getMinutes());
  const mm = r ? Math.floor(r.seconds / 60) : '', ss = r ? r.seconds % 60 : '';
  return `<h3>${r ? 'Editar trote' : 'Cargar trote'}</h3>
    <div class="field"><label>Día</label><input type="date" id="f-rdate" value="${date}"></div>
    <div class="field"><label>Hora de comienzo</label><input type="time" id="f-rstart" value="${start}"></div>
    <div class="field"><label>Tiempo</label><div class="goalrow"><input type="number" id="f-rmin" min="0" value="${mm}" placeholder="0"><span>min</span><input type="number" id="f-rsec" min="0" max="59" value="${ss}" placeholder="0"><span>seg</span></div></div>
    <div class="field"><label>Distancia (km)</label><input type="text" inputmode="decimal" id="f-rkm" value="${r ? fmtKm(r.km) : ''}" placeholder="1,9"></div>
    <div class="btns"><button class="primary" data-a="saveRun" data-id="${r ? r.id : ''}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>
    ${r ? `<div class="btns"><button class="danger" data-a="delRun" data-id="${r.id}">Borrar trote</button></div>` : ''}`;
}
function readRunForm() {
  const date = $('#f-rdate').value, a = $('#f-rstart').value;
  const secs = (parseInt($('#f-rmin').value, 10) || 0) * 60 + (parseInt($('#f-rsec').value, 10) || 0);
  const km = parseFloat(String($('#f-rkm').value).replace(',', '.'));
  if (!date || !a) { alert('Completá el día y la hora de comienzo.'); return null; }
  if (secs < 1) { alert('Poné cuánto tiempo corriste.'); return null; }
  if (!(km > 0)) { alert('Poné la distancia en kilómetros.'); return null; }
  const start = atTime(date, a);
  return { date, start, end: start + secs * 1000, seconds: secs, km };
}

function hoyView() {
  const today = todayStr();
  const dateLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const pt = padsToday();
  const top = pendingTop(today).sort(byPrio);
  const prio = top.filter(x => x.priority === 'high' && !isDoneOn(x, today)), once = top.filter(x => !prio.includes(x));
  const sel = catSel(), pick = pickOnce(once, today, sel), pickedCats = pick.map(x => x.catId || '');
  return `<header class="top right"><h1>${esc(dateLabel)}</h1></header>
    ${fechasBanner()}
    ${prio.length ? `<section class="prio-block"><h2>Prioridad</h2>${prio.map(x => onceRow(x, today)).join('')}</section>` : ''}
    ${clockCard()}
    <div class="pads">${pt.hoy.map(t => padHTML(t, true)).join('')}<button class="pad add" data-a="newTask">+ Nueva actividad</button></div>
    ${pt.hoy.length ? '' : '<div class="empty">¡Listo por hoy! No quedan actividades pendientes.</div>'}
    ${morePads(pt, '')}
    ${rutinaCard()}
    <h2>Tareas de una sola vez</h2>
    <div class="row-actions two three"><button data-a="newOnce">+ Agregar tarea</button><button data-a="tab" data-tab="tareas">Ver todas${top.filter(x => !isDoneOn(x, today)).length ? ' (' + top.filter(x => !isDoneOn(x, today)).length + ')' : ''}</button><button data-a="newSession" data-date="${today}">+ Agregar tramo</button></div>
    ${pick.length ? pick.map(t2 => onceRow(t2, today)).join('') : `<div class="empty">${once.some(x => !isDoneOn(x, today)) ? 'No hay tareas pendientes en las categorías elegidas.' : 'No tenés tareas sueltas pendientes.'}</div>`}
    ${catPanel(once, pickedCats)}
    ${seccionesGrid()}
    ${sleepCard()}
    ${smokeCard()}
    <div class="row-actions two"><button data-a="cierre">Cierre del día</button><button data-a="syncGoogle">Sincronizar</button><button data-a="backup">Copia</button></div>
    ${ui.bmsg ? `<div class="note">${esc(ui.bmsg)}</div>` : ''}
    ${ui.open.syncMsg ? '<div class="note">La sincronización con Google todavía no está lista: es la próxima etapa. Por ahora tus datos quedan en este teléfono (podés hacer una copia en Ajustes).</div>' : ''}
    ${backupNudge()}`;
}

/* "Tareas de una sola vez" en Hoy: siempre 4 pendientes. Sin elegir nada, se llenan primero con las tareas de HOY y después con las sin fecha, siempre por orden: General, Charbonier, Parapipou y el resto.
   Si tocás categorías en el panel, se llenan solo con esas (en el mismo orden). Las hechas se sacan de la lista (siguen en "Ver todas", tachadas). */
const adminId = () => { const c = S.categories.find(x => x.name === 'General'); return c ? c.id : null; };
function catSel() {
  ui.catSel = (ui.catSel || []).filter(k => k === '' || S.categories.some(c => c.id === k));
  return ui.catSel;
}
function catRank(k) {
  if (!k) return 99;
  const c = S.categories.find(x => x.id === k), i = c ? ['General', 'Charbonier', 'Parapipou'].indexOf(c.name) : -1;
  return i >= 0 ? i : 10;
}
function pickOnce(once, today, sel) {
  const pend = once.filter(x => !isDoneOn(x, today) && (sel.length ? sel.includes(x.catId || '') : (x.date === today || !x.date)));   // sin categorías elegidas: las de hoy y, si faltan, las que no tienen fecha
  const nm = k => (S.categories.find(c => c.id === k) || { name: '' }).name;
  const dg = x => (x.date === today ? 0 : 1);   // primero las de hoy, después las sin fecha (en categorías elegidas a mano no se separa)
  return pend.map((x, n) => ({ x, n })).sort((a, b) => (sel.length ? 0 : dg(a.x) - dg(b.x)) || catRank(a.x.catId) - catRank(b.x.catId) || (catRank(a.x.catId) === 10 ? nm(a.x.catId).localeCompare(nm(b.x.catId), 'es') : 0) || a.n - b.n).map(o => o.x).slice(0, 4);
}
function catPanel(once, pickedCats) {
  const sel = catSel(), on = sel.length ? sel : pickedCats, ids = [];
  once.forEach(t => { const k = t.catId || ''; if (!ids.includes(k)) ids.push(k); });
  if (adminId() && !ids.includes(adminId())) ids.unshift(adminId());
  const name = k => k ? (S.categories.find(c => c.id === k) || { name: 'Sin categoría' }).name : 'Sin categoría';
  const cnt = k => once.filter(t => (t.catId || '') === k && !isDoneOn(t, todayStr())).length;
  const list = ids.sort((a, b) => catRank(a) - catRank(b) || name(a).localeCompare(name(b), 'es'));
  return `<div class="rutina catpanel">${list.map(k => `<button class="chip${on.includes(k) ? ' on' : ''}" data-a="catSel" data-cat="${k}">${esc(name(k))} <small>${cnt(k)}</small></button>`).join('')}</div>`;
}

function tareasView() {
  const today = todayStr(), top = pendingTop(today).sort(byPrio);
  return subHeader('Tareas de una sola vez') + `
    <div class="row-actions"><button data-a="newOnce">+ Agregar tarea</button></div>
    ${top.length ? top.map(t => onceRow(t, today)).join('') : '<div class="empty">No tenés tareas sueltas pendientes.</div>'}
    <div class="row-actions"><button class="ghost" data-a="tab" data-tab="hoy">‹ Volver</button></div>`;
}

function minLabel(m) { return m >= 100 ? (m / 60).toFixed(1).replace('.', ',') + 'h' : String(m); }

function semanaEjercicio(days) {
  const today = todayStr(), ws = days[0];
  const cell = (d, c, sets) => {
    if (c >= sets && sets > 0) return '<span class="sq" style="background:' + hexA('#8fbf9f', 0.6) + '">✓</span>';
    if (c > 0) return '<span class="sq" style="background:' + hexA('#8fbf9f', 0.22) + '">' + c + '/' + sets + '</span>';
    return '<span class="sq ' + (d < today ? 'miss' : 'none') + '"></span>';
  };
  const body = S.ex.list.map(x => `<tr><td class="nm">${esc(x.name)}</td>${days.map(d => `<td>${cell(d, exCount(d, x), x.sets)}</td>`).join('')}</tr>`).join('');
  const comp = `<tr><td class="nm tot">Ejercicio completo</td>${days.map(d => `<td class="tot">${dayComplete(d) ? '✓' : ''}</td>`).join('')}</tr>`;
  const km = S.sessions.filter(r => r.km != null && r.date >= ws && r.date <= days[6]);
  const kmT = km.reduce((a, r) => a + r.km, 0);
  return `<h2>Ejercicio de la semana</h2>
    <table class="wgrid"><thead><tr><th></th>${days.map(d => `<th>${DAYN[parseD(d).getDay()]}</th>`).join('')}</tr></thead><tbody>${body}${comp}</tbody></table>
    <div class="stat"><span>Trote</span><span>${fmtKm(kmT)} km · ${km.length} ${km.length === 1 ? 'salida' : 'salidas'}</span></div>
    <div class="stat"><span>Electrodos</span><span>${electroWeek(ws).length} de 2</span></div>`;
}

function semanaView() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(ui.weekStart, i));
  const today = todayStr();
  const rows = S.tasks.filter(t => !t.archived && (t.type === 'recurring' || days.some(d => isScheduled(t, d) || secsOn(t.id, d) > 0)));
  const head = days.map(d => `<th class="${d === ui.detailDate ? 'sel' : ''}"><button data-a="pickDay" data-date="${d}">${DAYN[parseD(d).getDay()]}<br>${+d.slice(8)}${d === today ? '·' : ''}</button></th>`).join('');
  const cell = (t, d) => {
    const m = Math.round(secsOn(t.id, d) / 60), color = catOf(t).color;
    if (m > 0) return `<span class="sq" style="background:${hexA(color, Math.min(1, 0.3 + m / 90))}">${minLabel(m)}</span>`;
    if (!isScheduled(t, d)) return '<span class="sq none"></span>';
    return `<span class="sq ${d < today ? 'miss' : 'pend'}"></span>`;
  };
  const body = rows.map(t => `<tr><td class="nm"><span class="dot" style="background:${catOf(t).color}"></span> ${esc(t.name)}</td>${days.map(d => `<td>${cell(t, d)}</td>`).join('')}</tr>`).join('');
  const totals = days.map(d => `<td class="tot">${minLabel(Math.round(secsDay(d) / 60))}</td>`).join('');
  const wsec = days.reduce((a, d) => a + secsDay(d), 0);
  const elapsedDays = Math.max(1, days.filter(d => d <= today).length);
  const label = parseD(days[0]).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) + ' – ' + parseD(days[6]).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const dd = ui.detailDate;
  const ddLabel = parseD(dd).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const per = S.tasks.filter(t => secsOn(t.id, dd) > 0).sort((a, b) => secsOn(b.id, dd) - secsOn(a.id, dd));
  return `<header class="top"><h1>Semana</h1></header>
    <div class="weekbar"><button class="ghost" data-a="wk" data-n="-7">‹</button><span class="label">${label}</span><button class="ghost" data-a="wk" data-n="7">›</button></div>
    <table class="wgrid"><thead><tr><th></th>${head}</tr></thead><tbody>${body}<tr><td class="nm tot">Total</td>${totals}</tr></tbody></table>
    <div class="stat"><span>Tiempo de la semana</span><span>${fmtHM(wsec)}</span></div>
    <div class="stat"><span>Promedio por día</span><span>${fmtHM(Math.round(wsec / elapsedDays))}</span></div>
    ${semanaEjercicio(days)}
    ${semanaSueno(days)}
    <h2 class="daytitle">${esc(ddLabel)}</h2>
    <div class="stat"><span>Total del día</span><span>${fmtHM(secsDay(dd))}</span></div>
    ${per.map(t => `<div class="stat"><span><span class="dot" style="background:${catOf(t).color}"></span> ${esc(t.name)}</span><span>${fmtHM(secsOn(t.id, dd))}</span></div>`).join('')}
    ${catTimesHTML(dd, false)}
    <div class="grid" id="grid" style="margin-top:12px">${gridHTML(dd)}</div>
    <div class="row-actions"><button data-a="newSession" data-date="${dd}">+ Agregar tramo a mano</button><button class="ghost" data-a="wkToday">Ir a hoy</button></div>`;
}

function ajustesView() {
  const g = S.settings.dailyGoalMin;
  const cats = S.categories.map(c => `<div class="cat-row">
    <input type="color" value="${c.color}" data-ch="catColor" data-id="${c.id}">
    <input type="text" value="${esc(c.name)}" data-ch="catName" data-id="${c.id}">
    <button class="ghost danger" data-a="delCat" data-id="${c.id}">Borrar</button></div>`).join('');
  return subHeader('Ajustes') + `
    <h2>Meta diaria</h2>
    <div class="goalrow"><input type="number" id="f-gh" min="0" value="${Math.floor(g / 60) || ''}" placeholder="0"><span>h</span><input type="number" id="f-gm" min="0" max="59" value="${g % 60 || ''}" placeholder="0"><span>min</span><button data-a="saveGoal">Guardar</button></div>
    <div class="note">Una sola meta para todo el día. Los domingos, en el cierre del día, la podés cambiar para la semana que viene.</div>
    <h2>Sueño</h2>
    <div class="goalrow"><span>Me levanto a las</span><input type="time" id="f-wakecfg" value="${sleepS().wake}" style="width:120px"></div>
    <div class="goalrow" style="margin-top:8px"><span>Tardo en dormirme</span><input type="number" id="f-latcfg" min="0" max="120" value="${sleepS().latency}"><span>min</span><button data-a="saveSleepCfg">Guardar</button></div>
    <h2>Series diarias</h2>
    <div class="exset head"><span>Ejercicio</span><span>Repeticiones</span><span>Series</span><span></span></div>
    ${S.ex.list.map(x => `<div class="exset"><input type="text" value="${esc(x.name)}" data-ch="exName" data-id="${x.id}"><input type="number" min="1" value="${x.reps}" data-ch="exReps" data-id="${x.id}"><select data-ch="exSets" data-id="${x.id}">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === x.sets ? ' selected' : ''}>${n}</option>`).join('')}</select><button class="ghost danger" data-a="delEx" data-id="${x.id}">Quitar</button></div>`).join('')}
    <div class="row-actions"><button data-a="addEx">+ Agregar ejercicio</button></div>
    ${ajustesExtras()}
    <h2>Categorías</h2>${cats}
    <div class="row-actions"><button data-a="addCat">+ Nueva categoría</button></div>
    <h2>Cargar tareas desde un archivo</h2>
    <div class="note">Elegí el archivo de tareas (.json) que te pasé. Se suman a lo que ya tenés, sin borrar ni duplicar nada.</div>
    <div class="row-actions"><input type="file" id="f-file"></div>
    <div class="note">Si el celular no te deja elegir el archivo, abrilo, copiá todo su texto y pegalo acá:</div>
    <div class="field" style="padding:0 14px"><textarea id="f-paste" placeholder="Pegá acá el contenido del archivo"></textarea></div>
    <div class="row-actions"><button data-a="importPaste">Cargar lo pegado</button></div>
    ${ui.msg ? `<div class="note okmsg">${esc(ui.msg)}</div>` : ''}
    <h2>Planilla de Drive</h2>
    <div class="note">La sincronización con Google Sheets y la conexión con Google Calendar vienen en la próxima etapa. Por ahora todo se guarda en este celular.</div>`;
}

/* ---------- hojas (diálogos) ---------- */
function taskSheet(sh) {
  const t = sh.id ? taskById(sh.id) : null;
  const par0 = !t && sh.parent ? taskById(sh.parent) : null;
  const d = t || newTask({ catId: par0 ? par0.catId : (sh.once ? '' : (S.categories[0] ? S.categories[0].id : '')), type: sh.once ? 'once' : 'recurring', date: todayStr(), parentId: par0 ? par0.id : '' });
  const rep = d.type === 'once' ? 'once' : (d.days.length === 7 ? 'daily' : 'days');
  const cats = `<option value=""${!d.catId || !S.categories.some(c => c.id === d.catId) ? ' selected' : ''}>Sin categoría</option>` + S.categories.map(c => `<option value="${c.id}"${c.id === d.catId ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + '<option value="__new__">+ Nueva categoría…</option>';
  const dayBoxes = [1, 2, 3, 4, 5, 6, 0].map(n => `<label><input type="checkbox" data-day="${n}"${d.days.includes(n) ? ' checked' : ''}>${DAYN[n]}</label>`).join('');
  const kidsHere = t ? kidsOf(t.id) : [];
  return `<h3>${t ? (t.type === 'once' ? 'Editar tarea' : 'Editar actividad') : (sh.once ? (par0 ? 'Nueva subtarea' : 'Nueva tarea') : 'Nueva actividad')}</h3>
    <div class="field"><label>Nombre</label><input type="text" id="f-name" value="${esc(d.name)}"></div>
    <div class="field"><label>Categoría</label><select id="f-cat">${cats}</select></div>
    <div class="field hide" id="row-newcat"><label>Nombre de la nueva categoría</label><input type="text" id="f-newcat"></div>
    <div class="field"><label>Repetición</label><select id="f-rep">
      <option value="daily"${rep === 'daily' ? ' selected' : ''}>Todos los días</option>
      <option value="days"${rep === 'days' ? ' selected' : ''}>Algunos días de la semana</option>
      <option value="once"${rep === 'once' ? ' selected' : ''}>Tarea suelta, una sola vez</option></select></div>
    <div class="field${rep === 'days' ? '' : ' hide'}" id="row-days"><div class="days">${dayBoxes}</div></div>
    <div class="field${rep === 'once' ? '' : ' hide'}" id="row-date"><label>Día</label><input type="date" id="f-date" value="${d.date || todayStr()}"></div>
    <div class="field${rep === 'once' ? ' hide' : ''}" id="row-time"><label>Horario (opcional, ordena Hoy)</label><input type="time" id="f-time" value="${esc(d.time || '')}">${t && t.type === 'recurring' && habitual(t.id) ? `<div class="meta">${esc(habitual(t.id).txt)}</div>` : ''}</div>
    <div class="field${rep === 'once' ? ' hide' : ''}" id="row-sec"><label>Dónde aparece</label><select id="f-sec"><option value=""${d.sec !== 'ejercicio' ? ' selected' : ''}>En Hoy</option><option value="ejercicio"${d.sec === 'ejercicio' ? ' selected' : ''}>En Ejercicio</option></select></div>
    <div class="${rep === 'once' ? '' : 'hide'}" id="row-once">
      <label class="checkrow"><input type="checkbox" id="f-prio"${d.priority === 'high' ? ' checked' : ''}> Es prioritaria</label>
    </div>
    <div class="field"><label>Notas</label><textarea id="f-notes">${esc(d.notes)}</textarea></div>
    ${kidsHere.length ? `<div class="note" style="padding:0 0 8px">Subtareas: ${kidsHere.map(k => esc(k.name)).join(', ')}.</div>` : ''}
    ${t && t.type === 'once' && !t.parentId ? `<div class="btns"><button data-a="newSub" data-id="${t.id}">+ Agregar subtarea</button></div>` : ''}
    ${t ? `<div class="note" style="padding:0 0 8px">Total acumulado: ${fmtHM(secsTotal(t.id))}${streak(t) ? ' · racha ' + streak(t) : ''}</div>` : ''}
    <div class="btns"><button class="primary" data-a="saveTask" data-id="${t ? t.id : ''}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>
    ${t ? `<div class="btns"><button data-a="newSession" data-task="${t.id}" data-date="${todayStr()}">Agregar tramo</button><button data-a="archive" data-id="${t.id}">${t.archived ? 'Reactivar' : 'Archivar'}</button><button class="danger" data-a="delTask" data-id="${t.id}">Borrar</button></div>` : ''}`;
}

function sessionSheet(sh) {
  const s = sh.id ? S.sessions.find(x => x.id === sh.id) : null;
  const date = s ? s.date : sh.date;
  let start, end;
  if (s) { start = hhmm(s.start); end = hhmm(s.end); }
  else if (date === todayStr()) { const e = new Date(); end = pad(e.getHours()) + ':' + pad(e.getMinutes()); const st = new Date(e.getTime() - 30 * 60000); start = st.getDate() === e.getDate() ? pad(st.getHours()) + ':' + pad(st.getMinutes()) : '00:00'; }
  else { start = '09:00'; end = '09:30'; }
  const sel = s ? s.taskId : (sh.task || '');
  const opts = '<option value="">Sin actividad</option>' + S.tasks.filter(t => !t.archived || t.id === sel).map(t => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
  return `<h3>${s ? 'Editar tramo' : 'Agregar tramo a mano'}</h3>
    <div class="field"><label>Actividad</label><select id="f-act">${opts}</select></div>
    <div class="field"><label>Día</label><input type="date" id="f-sdate" value="${date}"></div>
    <div class="field"><label>Desde</label><input type="time" id="f-start" value="${start}"></div>
    <div class="field"><label>Hasta</label><input type="time" id="f-end" value="${end}"></div>
    <div class="btns"><button class="primary" data-a="saveSession" data-id="${s ? s.id : ''}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>
    ${s ? `<div class="btns"><button class="danger" data-a="delSession" data-id="${s.id}">Borrar tramo</button></div>` : ''}`;
}

function cierreSheet() {
  const today = todayStr(), total = secsDay(today), goal = S.settings.dailyGoalMin;
  const per = S.tasks.filter(t => secsOn(t.id, today) > 0).sort((a, b) => secsOn(b.id, today) - secsOn(a.id, today));
  const diffSec = total - goal * 60;
  const verdict = !goal ? 'Sin meta definida.' : diffSec >= 0 ? (diffSec < 60 ? 'Cumpliste la meta justo.' : 'Superaste la meta por ' + fmtHM(diffSec) + '.') : 'Te faltaron ' + fmtHM(-diffSec) + ' para la meta.';
  const pendOnce = onceList(today).filter(t => !isDoneOn(t, today));
  const isSun = new Date().getDay() === 0;
  let week = '';
  if (isSun) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));
    const wsec = days.reduce((a, d) => a + secsDay(d), 0);
    week = `<h3 style="margin-top:18px">Informe de la semana</h3>
      <div class="stat" style="padding-left:0;padding-right:0"><span>Tiempo total</span><span>${fmtHM(wsec)}</span></div>
      <div class="stat" style="padding-left:0;padding-right:0"><span>Promedio por día</span><span>${fmtHM(Math.round(wsec / 7))}</span></div>
      <div class="field" style="margin-top:12px"><label>Meta diaria para la semana que viene</label>
        <div class="goalrow"><input type="number" id="f-gh" min="0" value="${Math.floor(goal / 60) || ''}" placeholder="0"><span>h</span><input type="number" id="f-gm" min="0" max="59" value="${goal % 60 || ''}" placeholder="0"><span>min</span></div></div>
      <div class="btns"><button data-a="saveGoal">Guardar meta</button></div>`;
  }
  const list = per.length ? per.map(t => `<div class="stat" style="padding-left:0;padding-right:0"><span><span class="dot" style="background:${catOf(t).color}"></span> ${esc(t.name)}</span><span>${fmtHM(secsOn(t.id, today))}</span></div>`).join('') : '<div class="meta">Todavía no registraste tiempo hoy.</div>';
  return `<h3>Cierre del día</h3>
    <div class="stat" style="padding-left:0;padding-right:0"><span>Tiempo total</span><span>${fmtHM(total)}</span></div>
    <div class="note" style="padding:6px 0 10px;color:var(--fg)">${verdict}</div>
    <h2 style="margin:10px 0 4px">Por actividad</h2>${list}
    ${catTimesHTML(today, true)}
    ${pendOnce.length ? `<div class="note" style="padding:12px 0 0">Tareas sueltas pendientes (pasan a mañana): ${pendOnce.map(t => esc(t.name)).join(', ')}.</div>` : ''}
    ${week}
    <div class="btns"><button data-a="closeSheet">Cerrar</button></div>`;
}

function sheetView() {
  const sh = ui.sheet;
  if (!sh) return '';
  let body = '';
  if (sh.type === 'task') body = taskSheet(sh);
  else if (sh.type === 'session') body = sessionSheet(sh);
  else if (sh.type === 'cierre') body = cierreSheet();
  else if (sh.type === 'run') body = runSheet(sh);
  else if (sh.type === 'sleep') body = sleepSheet(sh);
  else if (sh.type === 'smk') body = `<h3>Ajustar días sin fumar</h3><div class="note" style="padding:0 0 8px">Poné cuántos días llevás hoy. Desde ahí, cada vez que toques el botón se suma uno.</div>
      <div class="field"><input type="number" id="f-smk" min="0" value="${smokeCount()}"></div>
      <div class="btns"><button class="primary" data-a="saveSmoke">Guardar</button><button data-a="closeSheet">Cancelar</button></div>`;
  else if (['health', 'date', 'note', 'restore'].includes(sh.type)) body = masSheet(sh);
  else if (sh.type === 'smkreset') body = `<h3>Reiniciar el contador</h3><div class="note" style="padding:0 0 8px">El contador vuelve a 0. Tu récord (${Math.max(smoke().best || 0, smokeCount())} días) se conserva.</div>
      <div class="btns"><button class="danger" data-a="smokeResetYes">Sí, reiniciar</button><button data-a="closeSheet">Cancelar</button></div>`;
  else if (sh.type === 'delcat') {
    const c = S.categories.find(x => x.id === sh.id);
    const others = S.categories.filter(x => x.id !== sh.id).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    const n = S.tasks.filter(t => t.catId === sh.id).length;
    body = `<h3>Borrar “${esc(c ? c.name : '')}”</h3><div class="note" style="padding:0 0 8px">Tiene ${n} ${n === 1 ? 'actividad' : 'actividades'}.</div>
      ${others ? `<div class="field"><label>Mover las actividades a</label><select id="f-dest">${others}</select></div><div class="btns"><button class="primary" data-a="delCatMove" data-id="${sh.id}">Mover y borrar categoría</button></div>` : ''}
      <div class="btns"><button class="danger" data-a="delCatAll" data-id="${sh.id}">Borrar categoría y sus actividades</button><button data-a="closeSheet">Cancelar</button></div>`;
  } else if (sh.type === 'confirm') {
    body = `<h3>${esc(sh.title)}</h3><div class="note" style="padding:0 0 8px">${esc(sh.text || '')}</div>
      <div class="btns"><button class="danger" data-a="${sh.action}" data-id="${sh.id || ''}">Sí, borrar</button><button data-a="closeSheet">Cancelar</button></div>`;
  } else if (sh.type === 'text') {
    body = `<h3>${esc(sh.title)}</h3><div class="field"><input type="text" id="f-text"></div>
      <div class="btns"><button class="primary" data-a="${sh.action}">Agregar</button><button data-a="closeSheet">Cancelar</button></div>`;
  }
  return `<div class="sheet-bg" data-a="bg"><div class="sheet">${body}</div></div>`;
}

function mainView() {
  const tabs = [['hoy', 'Hoy'], ['ejercicio', 'Ejercicio'], ['comida', 'Comida'], ['semana', 'Semana']];
  const views = { hoy: hoyView, ejercicio: ejercicioView, comida: comidaView, semana: semanaView, tareas: tareasView, fechas: fechasView, salud: saludView, semanal: semanalView, notas: notasView, mes: mesView, ajustes: ajustesView };
  const view = (views[ui.tab] || hoyView)();
  const active = ['ejercicio', 'comida', 'semana'].includes(ui.tab) ? ui.tab : 'hoy';   // las páginas de abajo de Hoy cuelgan de Hoy
  return view + `<nav class="bottom">${tabs.map(([k, l]) => `<button class="${active === k ? 'on' : ''}" data-a="tab" data-tab="${k}">${l}</button>`).join('')}</nav>` + sheetView();
}

function render() {
  const app = $('#app');
  if (app) app.innerHTML = mainView();
}
function commit() { save(); render(); }

/* ---------- acciones ---------- */
function readTaskForm() {
  const name = $('#f-name').value.trim();
  if (!name) { alert('Ponele un nombre a la actividad.'); return null; }
  let catId = $('#f-cat').value;
  if (catId === '__new__') {
    const n = $('#f-newcat').value.trim();
    if (!n) { alert('Escribí el nombre de la nueva categoría.'); return null; }
    catId = ensureCat(S.categories, n).id;
  }
  const rep = $('#f-rep').value, sh0 = ui.sheet, exT = sh0 && sh0.id ? taskById(sh0.id) : null;
  let days = [0, 1, 2, 3, 4, 5, 6];
  if (rep === 'days') {
    days = [...document.querySelectorAll('[data-day]')].filter(x => x.checked).map(x => +x.dataset.day);
    if (!days.length) { alert('Elegí al menos un día.'); return null; }
  }
  const once = rep === 'once';
  return { name, catId, type: once ? 'once' : 'recurring', days, date: once ? ($('#f-date').value || todayStr()) : '', notes: $('#f-notes').value,
    priority: once && $('#f-prio').checked ? 'high' : 'normal', parentId: once ? (exT ? exT.parentId : (sh0 && sh0.parent) || '') : '',
    sec: !once && $('#f-sec').value === 'ejercicio' ? 'ejercicio' : '', time: !once ? ($('#f-time').value || '') : '' };
}

function readSessionForm() {
  const date = $('#f-sdate').value, a = $('#f-start').value, b = $('#f-end').value;
  if (!date || !a || !b) { alert('Completá el día y las dos horas.'); return null; }
  const start = atTime(date, a), end = atTime(date, b);
  if (end <= start) { alert('La hora de fin tiene que ser después de la de inicio.'); return null; }
  return { taskId: $('#f-act').value || null, date, start, end };
}

function goalFromForm() {
  const h = parseInt($('#f-gh').value, 10) || 0, m = parseInt($('#f-gm').value, 10) || 0;
  return Math.max(0, h * 60 + m);
}

function onClick(e) {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a, id = el.dataset.id, date = el.dataset.date;
  if (a === 'bg') { if (e.target === el) { ui.sheet = null; render(); } return; }
  switch (a) {
    case 'tab': ui.tab = el.dataset.tab; ui.sheet = null; ui.msg = ''; ui.bmsg = ''; window.scrollTo && window.scrollTo(0, 0); render(); break;
    case 'toggle': toggleTimer(id); break;
    case 'finish': finishToday(id); break;
    case 'reopen': if (S.done[id]) delete S.done[id][todayStr()]; commit(); break;
    case 'done': {
      const t = taskById(id);
      if (onceDoneDate(t)) S.done[id] = {};
      else {
        (S.done[id] = S.done[id] || {})[date] = true;
        kidsOf(id).forEach(k => { if (!onceDoneDate(k)) (S.done[k.id] = S.done[k.id] || {})[date] = true; });   // al cerrar la grande, cierran las chicas
      }
      syncParent(t.parentId, date);
      commit(); break;
    }
    case 'set': {
      const day = todayStr(), x = S.ex.list.find(e => e.id === id), n = +el.dataset.n;
      const log = S.exlog[day] = S.exlog[day] || {};
      log[id] = exCount(day, x) >= n ? n - 1 : n;   // tocar la última hecha la desmarca
      commit(); break;
    }
    case 'electro': {
      const day = todayStr();
      S.electro = S.electro.includes(day) ? S.electro.filter(d => d !== day) : S.electro.concat(day);
      commit(); break;
    }
    case 'newRun': ui.sheet = { type: 'run', id: null }; render(); break;
    case 'editRun': ui.sheet = { type: 'run', id }; render(); break;
    case 'saveRun': {
      const f = readRunForm();
      if (!f) break;
      const r = id ? S.sessions.find(x => x.id === id) : null;
      if (r) Object.assign(r, f);
      else addSession(troteTask().id, f.start, f.end, f.km);
      ui.sheet = null; commit(); break;
    }
    case 'delRun': S.sessions = S.sessions.filter(x => x.id !== id); ui.sheet = null; commit(); break;
    case 'addEx': S.ex.list.push({ id: uid(), name: 'Nuevo ejercicio', reps: 10, sets: 4 }); commit(); break;
    case 'delEx': ui.sheet = { type: 'confirm', title: 'Quitar “' + S.ex.list.find(x => x.id === id).name + '”', text: 'Se saca de la lista de series. Lo que ya registraste de días anteriores no se muestra más.', action: 'delExYes', id }; render(); break;
    case 'delExYes': S.ex.list = S.ex.list.filter(x => x.id !== id); ui.sheet = null; commit(); break;
    case 'smoke': {
      const day = todayStr(), sm = smoke();
      sm.days = sm.days.includes(day) ? sm.days.filter(d => d !== day) : sm.days.concat(day);
      sm.best = Math.max(sm.best || 0, smokeCount());
      commit(); break;
    }
    case 'smokeAdjust': ui.sheet = { type: 'smk' }; render(); break;
    case 'saveSmoke': {
      const v = Math.max(0, parseInt($('#f-smk').value, 10) || 0), sm = smoke();
      sm.base = v - sm.days.length; if (sm.base < 0) { sm.days = sm.days.slice(0, v); sm.base = 0; }
      sm.best = Math.max(sm.best || 0, smokeCount());
      ui.sheet = null; commit(); break;
    }
    case 'smokeReset': ui.sheet = { type: 'smkreset' }; render(); break;
    case 'smokeResetYes': { const sm = smoke(); sm.best = Math.max(sm.best || 0, smokeCount()); sm.days = []; sm.base = 0; ui.sheet = null; commit(); break; }
    case 'sleepGo': { const k = nextWakeKey(); sleepS().nights[k] = { bed: Date.now(), wake: '' }; commit(); break; }
    case 'sleepCancel': delete sleepS().nights[el.dataset.key]; commit(); break;
    case 'sleepEdit': ui.sheet = { type: 'sleep', key: el.dataset.key }; render(); break;
    case 'saveSleep': {
      const key = el.dataset.key, sl = sleepS(), b = $('#f-bed').value, w = $('#f-wakeh').value;
      if (!b || !w) { alert('Completá las dos horas.'); break; }
      const bed = atTime(b >= '12:00' ? addDays(key, -1) : key, b);
      const e = { bed, wake: w === sl.wake ? '' : w };
      if (wakeMsOn(key, e) <= bed + sl.latency * 60000) { alert('Te levantaste antes de dormirte: revisá las horas.'); break; }
      sl.nights[key] = e; ui.sheet = null; commit(); break;
    }
    case 'saveSleepCfg': {
      const w = $('#f-wakecfg').value, l = parseInt($('#f-latcfg').value, 10);
      if (w) sleepS().wake = w;
      if (l >= 0) sleepS().latency = Math.min(120, l);
      commit(); break;
    }
    case 'unprio': taskById(id).priority = 'normal'; commit(); break;
    case 'expand': ui.open[id] = !ui.open[id]; render(); break;
    case 'newSub': ui.sheet = { type: 'task', id: null, once: true, parent: id }; render(); break;
    case 'importPaste': importText($('#f-paste').value); break;
    case 'newTask': ui.sheet = { type: 'task', id: null }; render(); break;
    case 'newOnce': ui.sheet = { type: 'task', id: null, once: true }; render(); break;
    case 'edit': ui.sheet = { type: 'task', id }; render(); break;
    case 'closeSheet': ui.sheet = null; render(); break;
    case 'saveTask': {
      const f = readTaskForm();
      if (!f) break;
      const ex = id ? taskById(id) : null;
      if (ex) Object.assign(ex, f); else S.tasks.push(newTask(f));
      ui.sheet = null; commit(); break;
    }
    case 'archive': {
      const t = taskById(id);
      if (!t.archived && timerOf(id)) stopTimer(null, id);
      t.archived = !t.archived; ui.sheet = null; commit(); break;
    }
    case 'delTask': ui.sheet = { type: 'confirm', title: 'Borrar “' + taskById(id).name + '”', text: 'Los tramos ya registrados se conservan en el historial.', action: 'delTaskYes', id }; render(); break;
    case 'delTaskYes':
      if (timerOf(id)) stopTimer(null, id);
      S.tasks.forEach(t => { if (t.parentId === id) t.parentId = ''; });
      S.tasks = S.tasks.filter(t => t.id !== id); delete S.done[id]; ui.sheet = null; commit(); break;
    case 'newSession': ui.sheet = { type: 'session', id: null, date: date || todayStr(), task: el.dataset.task || '' }; render(); break;
    case 'editSession': ui.sheet = { type: 'session', id }; render(); break;
    case 'saveSession': {
      const f = readSessionForm();
      if (!f) break;
      const s = id ? S.sessions.find(x => x.id === id) : null;
      if (s) Object.assign(s, { taskId: f.taskId, start: f.start, end: f.end, date: f.date, seconds: Math.round((f.end - f.start) / 1000) });
      else addSession(f.taskId, f.start, f.end);
      ui.sheet = null; commit(); break;
    }
    case 'delSession': S.sessions = S.sessions.filter(s => s.id !== id); ui.sheet = null; commit(); break;
    case 'catSel': { const k = el.dataset.cat || ''; const cur = catSel().slice(); ui.catSel = cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k); render(); break; }
    case 'syncGoogle': ui.open.syncMsg = !ui.open.syncMsg; render(); break;
    case 'cierre': ui.sheet = { type: 'cierre' }; render(); break;
    case 'saveGoal': S.settings.dailyGoalMin = goalFromForm(); ui.sheet = null; commit(); break;
    case 'wk': ui.weekStart = addDays(ui.weekStart, +el.dataset.n); render(); break;
    case 'wkToday': ui.weekStart = mondayOf(todayStr()); ui.detailDate = todayStr(); render(); break;
    case 'pickDay': ui.detailDate = date; render(); break;
    case 'addCat': ui.sheet = { type: 'text', title: 'Nueva categoría', action: 'addCatYes' }; render(); break;
    case 'addCatYes': { const n = $('#f-text').value.trim(); if (n) ensureCat(S.categories, n); ui.sheet = null; commit(); break; }
    case 'delCat': ui.sheet = { type: 'delcat', id }; render(); break;
    case 'delCatMove': {
      const dest = $('#f-dest').value;
      S.tasks.forEach(t => { if (t.catId === id) t.catId = dest; });
      S.categories = S.categories.filter(c => c.id !== id); ui.sheet = null; commit(); break;
    }
    case 'delCatAll': {
      const gone = S.tasks.filter(t => t.catId === id).map(t => t.id);
      gone.forEach(g => { if (timerOf(g)) stopTimer(null, g); });
      S.tasks = S.tasks.filter(t => t.catId !== id);
      gone.forEach(g => delete S.done[g]);
      S.categories = S.categories.filter(c => c.id !== id); ui.sheet = null; commit(); break;
    }
    default: masClick(a, el, id);
  }
}

function onChange(e) {
  const t = e.target;
  if (masChange(t)) return;
  if (t.id === 'f-rep') {
    $('#row-days').classList.toggle('hide', t.value !== 'days');
    $('#row-date').classList.toggle('hide', t.value !== 'once');
    $('#row-once').classList.toggle('hide', t.value !== 'once');
    $('#row-sec').classList.toggle('hide', t.value === 'once');
    $('#row-time').classList.toggle('hide', t.value === 'once');
  } else if (t.id === 'f-file') {
    const f = t.files && t.files[0];
    if (f) { const r = new FileReader(); r.onload = () => importText(String(r.result)); r.readAsText(f); }
  } else if (t.id === 'f-cat') {
    $('#row-newcat').classList.toggle('hide', t.value !== '__new__');
  } else if (t.dataset && t.dataset.ch) {
    const id = t.dataset.id;
    if (t.dataset.ch === 'exName' || t.dataset.ch === 'exReps' || t.dataset.ch === 'exSets') {
      const x = S.ex.list.find(e => e.id === id);
      if (x) {
        if (t.dataset.ch === 'exName') { const v = t.value.trim(); if (v) x.name = v; }
        else if (t.dataset.ch === 'exReps') { const v = parseInt(t.value, 10); if (v > 0) x.reps = v; }
        else x.sets = Math.min(4, Math.max(1, parseInt(t.value, 10) || 4));
        save();
      }
    } else if (t.dataset.ch === 'catColor') { S.categories.find(c => c.id === id).color = t.value; save(); }
    else if (t.dataset.ch === 'catName') { const v = t.value.trim(); if (v) { S.categories.find(c => c.id === id).name = v; save(); } }
  }
}

/* ---------- arranque ---------- */
let ticks = 0;
function tick() {
  if (!timers().length) { ticks = 0; return; }
  ticks++;
  if (ticks % 20 === 0 && !ui.sheet) { render(); return; }   // refresca grilla y totales
  document.querySelectorAll('[data-clock]').forEach(c => { c.textContent = fmtRun(Date.now() - (+c.dataset.clock)); });
  const tt = $('#todaytxt');
  if (tt) { const g = S.settings.dailyGoalMin; tt.textContent = 'Hoy: ' + fmtHM(secsDay(todayStr())) + (g ? ' · meta ' + fmtHM(g * 60) : ''); }
}

function init() {
  render();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !ui.sheet) render(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (typeof document !== 'undefined' && document.getElementById('app')) init();
