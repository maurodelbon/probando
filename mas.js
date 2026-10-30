'use strict';
/* Más: copia de seguridad, rutina del día, salud, fechas y cumpleaños, notas,
   pendientes de la semana y resumen del mes. Se carga antes que app.js. */

const fmtKg = v => String(Math.round(v * 10) / 10).replace('.', ',');
const parseNum = s => parseFloat(String(s == null ? '' : s).replace(',', '.'));
const niceDate = d => { const x = parseD(d); return DAYN[x.getDay()] + ' ' + x.getDate() + '/' + (x.getMonth() + 1); };
const whenTxt = n => n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : 'en ' + n + ' días';
const daysTo = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);

/* ---------- datos (se crean solos si faltan) ---------- */
function HL() {
  const h = S.health || (S.health = { goalKg: 72 });
  h.weights = h.weights || []; h.bp = h.bp || []; h.labs = h.labs || [];
  if (!h.goalKg) h.goalKg = 72;
  return h;
}
function ML() {
  const x = S.meals || (S.meals = { list: [], log: [] });
  x.list = x.list || []; x.log = x.log || []; x.drinks = x.drinks || [];
  return x;
}
/* Comidas: botones ordenados por cuántas veces las registraste. */
function mealCounts() { const n = {}; ML().log.forEach(e => { n[e.name] = (n[e.name] || 0) + 1; }); return n; }
function mealsSorted() { const n = mealCounts(); return ML().list.slice().sort((a, b) => (n[b.name] || 0) - (n[a.name] || 0) || a.name.localeCompare(b.name, 'es')); }
function logMeal(name) {
  name = String(name || '').trim(); if (!name) return false;
  const e = { id: uid(), date: todayStr(), ts: Date.now(), name }, m = ML().list.find(q => q.name === name);
  if (m && m.ing && m.ing.length) e.ings = m.ing.map(i => i.n);   // sugiere los ingredientes de la última vez; después elegís cuáles repiten
  ML().log.push(e); return true;
}
/* Ingredientes: gramos aproximados por porción (sugeridos por la app). */
const ING_G = { arroz: 80, poroto: 60, lenteja: 60, garbanzo: 60, cebolla: 40, papa: 150, batata: 150, zanahoria: 60, zapallo: 100, tomate: 80, ajo: 5, carne: 120, pollo: 150, pescado: 150, huevo: 50, fideo: 80, harina: 50, queso: 30, pan: 50, lechuga: 40, morron: 40, choclo: 80, acelga: 80, espinaca: 50, verdura: 100, aceite: 10, chorizo: 60, panceta: 30, zucchini: 80, calabacin: 80, berenjena: 80, polenta: 60, quinoa: 70, avena: 40, sal: 2, limon: 10, aceituna: 20, aceitunagriega: 20, chucrut: 30, humus: 40, untable: 30, pimienta: 1, oregano: 1, perejil: 3, albahaca: 3, semilla: 15, nuez: 15, almendra: 15, azucar: 5, leche: 150, yogur: 120, manteca: 10, tofu: 80, seitan: 80, tahini: 15, miel: 10 };
function ingSug(n) { const k = String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/s$/, '').trim(); if (ING_G[k]) return ING_G[k]; const w = k.split(/[^a-z]+/).find(x => ING_G[x.replace(/s$/, '')]); return w ? ING_G[w.replace(/s$/, '')] : 50; }
/* Una porción pesa m.pg gramos (200 por defecto): los ingredientes elegidos se reparten ese peso, y siempre suman exacto. */
function ingShares(m, names) {
  const sel = m.ing.filter(i => names.includes(i.n)), tot = sel.reduce((a, i) => a + i.g, 0), out = {};
  if (!sel.length) return out;
  const raw = sel.map(i => ({ n: i.n, v: m.pg * i.g / tot })); raw.forEach(r => { out[r.n] = Math.floor(r.v); });
  let left = m.pg - Object.values(out).reduce((a, b) => a + b, 0);
  raw.slice().sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v))).forEach(r => { if (left > 0) { out[r.n]++; left--; } });
  return out;
}
function mealOf(name) { const m = ML().list.find(q => q.name === name); if (m) { m.ing = m.ing || []; if (!(m.pg >= 1)) m.pg = 200; } return m; }
function ingPanel(name) {
  const m = mealOf(name); if (!m) return '<div class="note">Guardá esta comida en la lista (botón de arriba) para agregarle ingredientes.</div>';
  const today = todayStr(), es = ML().log.filter(e => e.date === today && e.name === name), on = es.length && es[es.length - 1].ings ? es[es.length - 1].ings : [], edit = !!ui.open.mealEdit;
  const por = Math.max(1, es.length), sh = ingShares(m, on), chips = m.ing.map(i => `<span class="mealb"><button class="chip${on.includes(i.n) ? ' on' : ''}" data-a="ingTog" data-name="${esc(name)}" data-ing="${esc(i.n)}">${esc(i.n)}${sh[i.n] ? ` <small>≈${sh[i.n]} g · ${sh[i.n] * por} g total</small>` : ''}</button>${edit ? `<button class="ghost mealx" data-a="ingDel" data-name="${esc(name)}" data-ing="${esc(i.n)}" aria-label="Quitar ${esc(i.n)}">×</button>` : ''}</span>`).join('');
  return `<div class="ingpanel"><div class="goalrow waterrow"><span class="wcount">Una porción pesa ${m.pg} g</span><button class="ghost" data-a="ingPg" data-name="${esc(name)}" data-d="-10"${m.pg > 10 ? '' : ' disabled'}>− 10</button><button data-a="ingPg" data-name="${esc(name)}" data-d="10">+ 10</button></div>
    ${chips ? `<div class="rutina meals">${chips}</div><div class="note">Tocá los ingredientes que usaste hoy. Entre todos suman lo que pesa una porción (${m.pg} g por porción; hoy comiste ${por}: ${m.pg * por} g en total); si sacás uno, los demás se reparten ese peso. Cantidades aproximadas.</div>` : '<div class="note">Todavía no tiene ingredientes. Escribí el primero abajo.</div>'}
    <div class="goalrow"><input type="text" id="f-ing" placeholder="Ingrediente (ej. Arroz)" autocomplete="off"><button data-a="ingNew" data-name="${esc(name)}">Agregar</button></div></div>`;
}
function comidasCard() {
  const today = todayStr(), M = ML(), n = mealCounts(), edit = !!ui.open.mealEdit;
  const hoy = M.log.filter(e => e.date === today && e.name !== WATER && !e.d).sort((a, b) => a.ts - b.ts), vasos = waterOn(today).length;
  const btns = mealsSorted().map(x => `<span class="mealb"><button class="chip" data-a="mealAdd" data-id="${x.id}">${esc(x.name)}${n[x.name] ? ` <small>${n[x.name]}</small>` : ''}</button>${edit ? `<button class="ghost mealx" data-a="mealDelBtn" data-id="${x.id}" aria-label="Quitar ${esc(x.name)}">×</button>` : ''}</span>`).join('');
  const grupos = []; hoy.forEach(e => { let g = grupos.find(q => q.name === e.name); if (!g) grupos.push(g = { name: e.name, es: [] }); g.es.push(e); });
  const cnt = name => M.log.filter(e => e.date === today && e.name === name).length;
  const dn = name => M.log.filter(e => e.name === name).length;
  const drinks = M.drinks.slice().sort((x, y) => dn(y.name) - dn(x.name) || x.name.localeCompare(y.name, 'es'));
  const drow = x => { const c = cnt(x.name); return `<div class="goalrow waterrow"><span class="wcount">${esc(x.name)}: ${c} hoy</span>${edit ? `<button class="ghost mealx" data-a="drinkDel" data-id="${x.id}" aria-label="Quitar ${esc(x.name)}">×</button>` : ''}<button class="ghost" data-a="drinkLess" data-id="${x.id}"${c ? '' : ' disabled'}>− 1</button><button data-a="drinkAdd" data-id="${x.id}">+ 1</button></div>`; };
  return `<h2>Comidas</h2>
    ${btns ? `<div class="rutina meals">${btns}</div>` : '<div class="empty">Todavía no tenés comidas. Escribí la primera abajo.</div>'}
    <div class="goalrow"><input type="text" id="f-meal" placeholder="Comida nueva (ej. Milanesa)" autocomplete="off"><button data-a="mealNew">Agregar</button></div>
    ${grupos.length ? grupos.map(g => `<div class="goalrow waterrow mealrow"><span class="wcount">${esc(g.name)}: ${g.es.length} hoy<small class="meta"> · ${g.es.map(e => hhmm(e.ts)).join(', ')}${g.es[g.es.length - 1].ings && g.es[g.es.length - 1].ings.length ? '<br>Con: ' + g.es[g.es.length - 1].ings.map(esc).join(', ') : ''}</small></span><button class="ghost" data-a="ingOpen" data-name="${esc(g.name)}">Ingred.</button><button class="ghost" data-a="mealLess" data-name="${esc(g.name)}">− 1</button><button data-a="mealPlus" data-name="${esc(g.name)}">+ 1</button></div>${ui.open.ing === g.name ? ingPanel(g.name) : ''}`).join('') : '<div class="note">Hoy todavía no registraste comidas.</div>'}
    <h2>Bebidas</h2>
    <div class="goalrow waterrow"><span class="wcount">${vasos} ${vasos === 1 ? 'vaso' : 'vasos'} de agua hoy</span><button class="ghost" data-a="waterLess"${vasos ? '' : ' disabled'}>− 1</button><button data-a="waterAdd">+ Vaso de agua</button></div>
    ${drinks.map(drow).join('')}
    <div class="goalrow"><input type="text" id="f-drink" placeholder="Bebida nueva (ej. Mate)" autocomplete="off"><button data-a="drinkNew">Agregar</button></div>
    ${M.list.length || M.drinks.length ? `<div class="smk-links"><button class="ghost" data-a="mealEdit">${edit ? 'Listo' : 'Editar botones'}</button></div>` : ''}`;
}
function DL() { return S.dates || (S.dates = []); }
function NL() { return S.notes || (S.notes = []); }
function CK() {
  return S.checks || (S.checks = { items: ['Dientes', 'Lengua', 'Agua', 'Ajo en ayunas', 'Vitaminas (almuerzo)'].map(name => ({ id: uid(), name })), log: {} });
}

function subHeader(title) {
  return `<header class="top sub"><button class="ghost back" data-a="tab" data-tab="hoy">‹ Volver</button><h1>${esc(title)}</h1></header>`;
}

/* ---------- copia de seguridad ---------- */
function backupDownload() {
  S.lastBackup = Date.now(); ui.bmsg = 'Copia guardada. Buscala en la carpeta Descargas del celular.';
  try {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'asistentes-copia-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) { /* nada */ } }, 3000);
  } catch (e) { S.lastBackup = 0; ui.bmsg = 'No pude guardar la copia en este navegador.'; }
  commit();
}
function backupAsk(text) {
  try {
    const o = JSON.parse(text);
    if (!o || o.v !== 2 || !Array.isArray(o.tasks) || !Array.isArray(o.sessions)) throw new Error('formato');
    ui.pending = text; ui.sheet = { type: 'restore', n: o.sessions.length, t: o.tasks.length };
  } catch (e) { ui.bmsg = 'Ese archivo no es una copia de Asistentes.'; }
  render();
}
function backupApply() {
  S = ensureEx(JSON.parse(ui.pending)); ui.pending = ''; ui.sheet = null; ui.bmsg = 'Copia restaurada.'; commit();
}
function backupNudge() {
  const last = S.lastBackup, days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if (!S.sessions.length && !last) return '';
  if (last && days < 7) return '';
  return `<div class="nudge">${last ? 'Hace ' + days + ' días que no' : 'Todavía no'} guardás una copia de seguridad. <button class="ghost" data-a="backup">Guardar copia</button></div>`;
}

/* ---------- rutina del día (checklist) ---------- */
const WATER = 'Vaso de agua';
const isWaterItem = i => !!i && /^agua$/i.test(String(i.name).trim());
const waterOn = date => ML().log.filter(e => e.date === date && e.name === WATER);
const ckDone = (date, id) => !!(CK().log[date] && CK().log[date][id]);
const ckAll = date => CK().items.length > 0 && CK().items.every(i => ckDone(date, i.id));
function ckStreak() {
  let cur = todayStr(), n = 0;
  if (!ckAll(cur)) cur = addDays(cur, -1);
  while (ckAll(cur) && n < 800) { n++; cur = addDays(cur, -1); }
  return n;
}
/* Control semanal de presión y azúcar: aparece los miércoles desde las 9:00, queda hasta que lo cargues, y desde el segundo día se pone naranja. */
function bpDue() {
  const now = new Date(); let w = todayStr();
  while (parseD(w).getDay() !== 3) w = addDays(w, -1);
  if (w === todayStr() && now.getHours() < 9) w = addDays(w, -7);
  if (HL().bp.some(b => b.date >= w)) return null;
  return { since: w, late: todayStr() > w };
}
function rutinaCard() {
  const t = todayStr(), items = CK().items, d = items.filter(i => ckDone(t, i.id)).length, st = ckStreak(), bp = bpDue();
  if (!items.length && !bp) return '';
  const bpChip = bp ? `<button class="chip bp${bp.late ? ' late' : ''}" data-a="bpGo">Medir presión y azúcar${bp.late ? ' · pendiente' : ''}</button>` : '';
  const pend = items.filter(i => !ckDone(t, i.id)), hechas = items.filter(i => ckDone(t, i.id)), op = !!ui.open.ckHechas;
  return `<h2>Rutina del día</h2>
    ${pend.length || bp ? `<div class="rutina">${bpChip}${pend.map(i => `<button class="chip" data-a="ck" data-id="${i.id}">${esc(i.name)}</button>`).join('')}</div>` : '<div class="empty">¡Rutina completa por hoy!</div>'}
    ${hechas.length ? `<button class="ghost morebtn" data-a="expand" data-id="ckHechas">${op ? '▾' : '▸'} Hechas hoy (${hechas.length})</button>${op ? `<div class="rutina">${hechas.map(i => `<button class="chip on" data-a="ck" data-id="${i.id}">✓ ${esc(i.name)}</button>`).join('')}</div>` : ''}` : ''}
    <div class="note">${d} de ${items.length}${d === items.length ? ' · rutina completa' : ''}${st ? ' · racha ' + st + (st === 1 ? ' día' : ' días') : ''}</div>`;
}

/* ---------- pendientes de la semana ---------- */
function weekItems() {
  const ws = mondayOf(todayStr()), days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const actDays = name => { const t = S.tasks.find(x => x.type === 'recurring' && x.name.toLowerCase() === name); return t ? days.filter(d => secsOn(t.id, d) >= STREAK_MIN * 60).length : 0; };
  return [
    ['Electrodos', electroWeek(ws).length, 2],
    ['Presión y azúcar', HL().bp.filter(b => b.date >= ws && b.date <= days[6]).length, 1],
    ['Orden digital', actDays('orden digital'), 2],
    ['Perros (martes y viernes)', actDays('perros'), 2],
    ['Limpieza del baño', actDays('limpieza'), 1]
  ];
}
function semanalView() {
  const items = weekItems(), left = 7 - ((new Date().getDay() + 6) % 7), pend = items.filter(([, c, t]) => c < t);
  return subHeader('Pendientes de la semana') + `
    ${items.map(([n, c, t]) => `<div class="stat"><span>${c >= t ? '✓ ' : ''}${esc(n)}</span><span>${c} de ${t}</span></div>`).join('')}
    <div class="note">${pend.length ? 'Quedan ' + left + (left === 1 ? ' día' : ' días') + ' de la semana.' : 'Semana al día ✓'}</div>
    <div class="note">Electrodos y presión se marcan donde ya los cargás. Orden digital, perros y limpieza cuentan los días en que hiciste al menos ${STREAK_MIN} minutos.</div>`;
}

/* ---------- fechas importantes y cumpleaños ---------- */
function occurrence(d, from) {
  if (!d.yearly) return d.date >= from ? d.date : null;
  const m = +d.date.slice(5, 7), dd = +d.date.slice(8, 10), fy = +from.slice(0, 4);
  let c = dstr(new Date(fy, m - 1, dd));
  if (c < from) c = dstr(new Date(fy + 1, m - 1, dd));
  return c;
}
function upcoming(from, maxDays) {
  return DL().map(d => { const o = occurrence(d, from); return o ? { d, o, n: daysTo(from, o) } : null; })
    .filter(x => x && (maxDays == null || x.n <= maxDays))
    .sort((a, b) => a.n - b.n || a.d.name.localeCompare(b.d.name));
}
function dateLabel(x) {
  const d = x.d;
  if (d.kind !== 'birthday') return d.name;
  const age = d.age ? +x.o.slice(0, 4) - +d.date.slice(0, 4) : 0;
  return 'Cumpleaños de ' + d.name + (age > 0 ? ' · cumple ' + age : '');
}
function fechasBanner() {
  const up = upcoming(todayStr(), 3);
  if (!up.length) return '';
  const today = up.filter(x => x.n === 0), soon = up.filter(x => x.n > 0);
  return `<section class="datebanner" data-a="tab" data-tab="fechas">
    ${today.map(x => `<div class="dbtoday"><b>Hoy:</b> ${esc(dateLabel(x))}</div>`).join('')}
    ${soon.map(x => `<div class="dbsoon">${esc(dateLabel(x))} · ${whenTxt(x.n)}</div>`).join('')}</section>`;
}
function fechasView() {
  const t = todayStr(), up = upcoming(t), past = DL().filter(d => !occurrence(d, t)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const row = x => `<div class="stat daterow${x.n === 0 ? ' today' : ''}" data-a="editDate" data-id="${x.d.id}"><span>${esc(dateLabel(x))}</span><span>${whenTxt(x.n)} · ${x.o.slice(8)}/${x.o.slice(5, 7)}${x.o.slice(0, 4) !== t.slice(0, 4) ? '/' + x.o.slice(0, 4) : ''}</span></div>`;
  return subHeader('Fechas importantes') + `
    <h2>Próximas</h2>
    ${up.length ? up.map(row).join('') : '<div class="empty">No hay fechas cargadas.</div>'}
    <div class="row-actions"><button data-a="newDate">+ Agregar fecha o cumpleaños</button></div>
    ${past.length ? `<h2>Pasadas</h2>${past.map(d => `<div class="stat daterow past" data-a="editDate" data-id="${d.id}"><span>${esc(d.name)}</span><span>${d.date.slice(8)}/${d.date.slice(5, 7)}/${d.date.slice(0, 4)}</span></div>`).join('')}` : ''}
    <div class="note">La app te avisa en Hoy cuando es el día (y los 3 días anteriores). Solo se ve cuando la abrís.</div>`;
}
function dateSheet(sh) {
  const e = sh.id ? DL().find(x => x.id === sh.id) : null;
  const d = e || { name: '', kind: 'birthday', date: todayStr(), yearly: true, age: false, note: '' };
  return `<h3>${e ? 'Editar fecha' : 'Nueva fecha'}</h3>
    <div class="field"><label>Nombre</label><input type="text" id="f-dname" value="${esc(d.name)}"></div>
    <div class="field"><label>Tipo</label><select id="f-dkind"><option value="birthday"${d.kind === 'birthday' ? ' selected' : ''}>Cumpleaños</option><option value="event"${d.kind === 'event' ? ' selected' : ''}>Evento</option><option value="other"${d.kind === 'other' ? ' selected' : ''}>Otra fecha</option></select></div>
    <div class="field"><label>Fecha (en cumpleaños, la fecha de nacimiento)</label><input type="date" id="f-ddate" value="${d.date}"></div>
    <div class="field days"><label><input type="checkbox" id="f-dyear"${d.yearly ? ' checked' : ''}>Se repite todos los años</label><label><input type="checkbox" id="f-dage"${d.age ? ' checked' : ''}>Mostrar la edad</label></div>
    <div class="field"><label>Notas</label><textarea id="f-dnote">${esc(d.note)}</textarea></div>
    <div class="btns"><button class="primary" data-a="saveDate" data-id="${e ? e.id : ''}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>
    ${e ? `<div class="btns"><button class="danger" data-a="delDate" data-id="${e.id}">Borrar</button></div>` : ''}`;
}
/* Fechas que vienen en el archivo de partida; no pisa lo que ya hay. */
function importDates(list) {
  (list || []).forEach(x => {
    if (x.key && DL().some(d => d.key === x.key)) return;
    DL().push({ id: uid(), key: x.key || '', name: x.name, kind: x.kind || 'event', date: x.date, yearly: !!x.yearly, age: !!x.age, note: x.note || '' });
  });
}

/* ---------- salud: peso, presión y azúcar, análisis ---------- */
function weightChart(ws, goal) {
  if (ws.length < 2) return '';
  const pts = ws.slice(-30), xs = pts.map(p => parseD(p.date).getTime());
  const ys = pts.map(p => p.kg).concat([goal]), lo = Math.min(...ys) - 0.5, hi = Math.max(...ys) + 0.5;
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const X = t => 12 + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * 276, Y = v => 10 + (1 - (v - lo) / (hi - lo)) * 100;
  const line = pts.map((p, i) => X(xs[i]).toFixed(1) + ',' + Y(p.kg).toFixed(1)).join(' ');
  return `<svg class="wchart" viewBox="0 0 300 120" role="img" aria-label="Evolución del peso">
    <line x1="12" x2="288" y1="${Y(goal).toFixed(1)}" y2="${Y(goal).toFixed(1)}" stroke="#8fbf9f" stroke-width="1.5" stroke-dasharray="4 4"/>
    <polyline points="${line}" fill="none" stroke="#7fa8d6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="3.2" fill="#7fa8d6"/>`).join('')}</svg>
    <div class="note" style="padding-top:2px">Línea punteada: tu meta de ${fmtKg(goal)} kg.</div>`;
}
function saludView() {
  const H = HL(), ws = H.weights, last = ws[ws.length - 1], today = todayStr(), wk = mondayOf(today);
  const diff = last ? Math.round((last.kg - H.goalKg) * 10) / 10 : 0;
  const bpWeek = H.bp.some(b => b.date >= wk && b.date <= addDays(wk, 6));
  const bpTxt = b => [b.sys && b.dia ? b.sys + '/' + b.dia : '', b.sugar ? 'azúcar ' + fmtKg(b.sugar) : ''].filter(Boolean).join(' · ');
  return subHeader('Salud') + `
    <h2>Peso</h2>
    <div class="goalrow"><input type="text" inputmode="decimal" id="f-kg" placeholder="${last ? fmtKg(last.kg) : '74,9'}"><span>kg</span><button data-a="saveWeight">Guardar hoy</button></div>
    <div class="note">${last ? 'Último: ' + fmtKg(last.kg) + ' kg (' + niceDate(last.date) + ') · ' + (diff > 0 ? 'te faltan ' + fmtKg(diff) + ' kg para la meta' : 'meta alcanzada') : 'Todavía no cargaste tu peso.'}</div>
    <div class="goalrow"><span>Mi meta</span><input type="text" inputmode="decimal" value="${fmtKg(H.goalKg)}" data-ch="goalKg"><span>kg</span></div>
    ${weightChart(ws, H.goalKg)}
    ${ws.slice(-6).reverse().map(w => `<div class="stat daterow" data-a="editHealth" data-kind="weight" data-id="${w.id}"><span>${niceDate(w.date)}</span><span>${fmtKg(w.kg)} kg</span></div>`).join('')}
    <h2 id="bp-sec">Presión y azúcar</h2>
    <div class="note" style="padding-top:0">${bpWeek ? 'Esta semana ya la mediste ✓' : 'Esta semana todavía no la mediste.'}</div>
    ${H.bp.slice(-6).reverse().map(b => `<div class="stat daterow" data-a="editHealth" data-kind="bp" data-id="${b.id}"><span>${niceDate(b.date)}</span><span>${esc(bpTxt(b))}</span></div>`).join('')}
    <div class="row-actions"><button data-a="newHealth" data-kind="bp">+ Cargar medición</button></div>
    <h2>Análisis de sangre</h2>
    ${H.labs.length ? H.labs.slice().reverse().map(l => `<div class="stat daterow" data-a="editHealth" data-kind="lab" data-id="${l.id}"><span>${niceDate(l.date)}${l.date.slice(0, 4) !== today.slice(0, 4) ? '/' + l.date.slice(2, 4) : ''}</span><span class="clip">${esc(l.note || 'Sin notas')}</span></div>`).join('') : '<div class="empty">Todavía no cargaste ninguno. Es lo primero que tenés pendiente.</div>'}
    <div class="row-actions"><button data-a="newHealth" data-kind="lab">+ Cargar análisis</button></div>
    <div class="note">La app solo guarda tus valores; no los interpreta. Para eso, tu médico.</div>`;
}
const HKEY = { weight: 'weights', bp: 'bp', lab: 'labs' };
function healthSheet(sh) {
  const list = HL()[HKEY[sh.kind]], e = sh.id ? list.find(x => x.id === sh.id) : null, date = e ? e.date : todayStr();
  const title = { weight: 'peso', bp: 'presión y azúcar', lab: 'análisis de sangre' }[sh.kind];
  let fields = '';
  if (sh.kind === 'weight') fields = `<div class="field"><label>Peso (kg)</label><input type="text" inputmode="decimal" id="f-hkg" value="${e ? fmtKg(e.kg) : ''}"></div>`;
  else if (sh.kind === 'bp') fields = `<div class="field"><label>Presión: alta y baja</label><div class="goalrow"><input type="number" id="f-sys" value="${e && e.sys ? e.sys : ''}" placeholder="120"><span>/</span><input type="number" id="f-dia" value="${e && e.dia ? e.dia : ''}" placeholder="80"></div></div>
      <div class="field"><label>Azúcar (mg/dl)</label><input type="text" inputmode="decimal" id="f-sugar" value="${e && e.sugar ? fmtKg(e.sugar) : ''}"></div>`;
  else fields = `<div class="field"><label>Notas (resultados, médico, qué falta)</label><textarea id="f-hnote">${esc(e ? e.note : '')}</textarea></div>`;
  return `<h3>${e ? 'Editar' : 'Cargar'} ${title}</h3>
    <div class="field"><label>Día</label><input type="date" id="f-hdate" value="${date}"></div>${fields}
    <div class="btns"><button class="primary" data-a="saveHealth" data-kind="${sh.kind}" data-id="${e ? e.id : ''}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>
    ${e ? `<div class="btns"><button class="danger" data-a="delHealth" data-kind="${sh.kind}" data-id="${e.id}">Borrar</button></div>` : ''}`;
}

/* ---------- notas ---------- */
function notasView() {
  const list = NL().slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts);
  return subHeader('Notas') + `
    <div class="field" style="padding:0 14px"><textarea id="f-note" placeholder="Escribí una nota…"></textarea></div>
    <div class="row-actions"><button class="primary" data-a="addNote">Guardar nota</button></div>
    ${list.length ? list.map(n => `<div class="noterow" data-a="editNote" data-id="${n.id}"><div class="meta">${n.pin ? '📌 ' : ''}${niceDate(n.date)} · ${hhmm(n.ts)}</div><div class="ntext">${esc(n.text)}</div></div>`).join('') : '<div class="empty">Todavía no tenés notas.</div>'}`;
}
function noteSheet(sh) {
  const n = NL().find(x => x.id === sh.id);
  if (!n) return '';
  return `<h3>Nota</h3><div class="field"><textarea id="f-ntext" style="min-height:140px">${esc(n.text)}</textarea></div>
    <div class="field days"><label><input type="checkbox" id="f-npin"${n.pin ? ' checked' : ''}>Fijar arriba</label></div>
    <div class="btns"><button class="primary" data-a="saveNote" data-id="${n.id}">Guardar</button><button data-a="closeSheet">Cancelar</button></div>
    <div class="btns"><button class="danger" data-a="delNote" data-id="${n.id}">Borrar nota</button></div>`;
}

/* ---------- resumen del mes ---------- */
function horariosRows() {
  const rows = S.tasks.filter(t => !t.archived).map(t => [t, habitual(t.id)]).filter(x => x[1]).sort((a, b) => a[1].med - b[1].med);
  return rows.length ? rows.map(([t, h]) => `<div class="stat"><span>${esc(t.name)}</span><span>${h.hm} · ${h.franja}</span></div>`).join('') + '<div class="meta" style="padding:4px 18px">Hora típica de inicio según tus registros (todo el historial).</div>' : '<div class="empty">Todavía no hay registros. Se arma solo mientras usás los cronómetros.</div>';
}
/* Horarios reales: cuándo empezás cada actividad (primer tramo de cada día), con todo el historial. */
function habitual(id) {
  const first = {};
  S.sessions.filter(x => x.taskId === id).sort((a, b) => a.start - b.start).forEach(x => { if (!first[x.date]) first[x.date] = x.start; });
  const mins = Object.values(first).map(ms => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }).sort((a, b) => a - b);
  if (!mins.length) return null;
  const med = mins.length % 2 ? mins[(mins.length - 1) / 2] : Math.round((mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2);
  const mm = med => pad(Math.floor(med / 60)) + ':' + pad(med % 60);
  const mana = mins.filter(v => v < 720).length, tarde = mins.filter(v => v >= 720 && v < 1140).length, noche = mins.length - mana - tarde;
  const franja = [mana ? 'mañana ' + mana : '', tarde ? 'tarde ' + tarde : '', noche ? 'noche ' + noche : ''].filter(Boolean).join(' · ');
  return { med, n: mins.length, hm: mm(med), franja, txt: 'Suele empezar a las ' + mm(med) + ' (' + mins.length + (mins.length === 1 ? ' día' : ' días') + ': ' + franja + ')' };
}
function mesView() {
  const today = todayStr(), ym = ui.month || (ui.month = today.slice(0, 7));
  const [y, m] = ym.split('-').map(Number), nd = new Date(y, m, 0).getDate();
  const days = Array.from({ length: nd }, (_, i) => ym + '-' + pad(i + 1)), past = days.filter(d => d <= today);
  const ss = S.sessions.filter(s => s.date.startsWith(ym)), tot = ss.reduce((a, s) => a + s.seconds, 0);
  const perDay = {}; ss.forEach(s => { perDay[s.date] = (perDay[s.date] || 0) + s.seconds; });
  const bestD = Object.keys(perDay).sort((a, b) => perDay[b] - perDay[a])[0];
  const cats = {}; ss.forEach(s => { const c = catOf(taskById(s.taskId)); (cats[c.name] = cats[c.name] || { secs: 0, color: c.color }).secs += s.seconds; });
  const catRows = Object.entries(cats).sort((a, b) => b[1].secs - a[1].secs), maxC = catRows.length ? catRows[0][1].secs : 1;
  const acts = {}; ss.forEach(s => { const k = s.taskId || ''; acts[k] = (acts[k] || 0) + s.seconds; });
  const top = Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const runs = ss.filter(s => s.km != null), km = runs.reduce((a, s) => a + s.km, 0), runSecs = runs.reduce((a, s) => a + s.seconds, 0);
  const nights = days.map(d => { const e = sleepS().nights[d]; return e && Date.now() >= wakeMsOn(d, e) ? sleepSecs(d, e) : null; }).filter(v => v != null);
  const ws = HL().weights.filter(w => w.date.startsWith(ym));
  const st = (a, b) => `<div class="stat"><span>${a}</span><span>${b}</span></div>`;
  const label = parseD(ym + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  let peso = '–';
  if (ws.length === 1) peso = fmtKg(ws[0].kg) + ' kg';
  else if (ws.length > 1) { const d = Math.round((ws[ws.length - 1].kg - ws[0].kg) * 10) / 10; peso = fmtKg(ws[0].kg) + ' → ' + fmtKg(ws[ws.length - 1].kg) + ' kg (' + (d > 0 ? '+' : '') + fmtKg(d) + ')'; }
  return subHeader('Resumen del mes') + `
    <div class="weekbar"><button class="ghost" data-a="mn" data-n="-1">‹</button><span class="label monthlabel">${esc(label)}</span><button class="ghost" data-a="mn" data-n="1">›</button></div>
    ${st('Tiempo registrado', fmtHM(tot))}
    ${st('Promedio por día', past.length ? fmtHM(Math.round(tot / past.length)) : '–')}
    ${st('Mejor día', bestD ? niceDate(bestD) + ' · ' + fmtHM(perDay[bestD]) : '–')}
    <h2>Por categoría</h2>
    ${catRows.length ? catRows.map(([n, c]) => `<div class="catbar"><div class="catbar-h"><span>${esc(n)}</span><span>${fmtHM(c.secs)}</span></div><div class="catbar-t"><i style="width:${Math.max(3, Math.round(c.secs / maxC * 100))}%;background:${c.color}"></i></div></div>`).join('') : '<div class="empty">Sin tiempo registrado este mes.</div>'}
    ${top.length ? `<h2>Lo que más hiciste</h2>${top.map(([id, s]) => st(esc(id ? (taskById(id) || { name: 'Actividad borrada' }).name : 'Sin actividad'), fmtHM(s))).join('')}` : ''}
    <h2>¿A qué hora lo hacés?</h2>
    ${horariosRows()}
    <h2>Ejercicio y hábitos</h2>
    ${st('Días con ejercicio completo', past.filter(dayComplete).length + ' de ' + past.length)}
    ${st('Series hechas', past.reduce((a, d) => a + exTotals(d).d, 0))}
    ${st('Trote', fmtKg(km) + ' km · ' + runs.length + (runs.length === 1 ? ' salida' : ' salidas') + (km ? ' · ' + fmtPace(runSecs, km) + ' /km' : ''))}
    ${st('Electrodos', S.electro.filter(d => d.startsWith(ym)).length + ' veces')}
    ${st('Rutina del día completa', past.filter(ckAll).length + ' de ' + past.length + ' días')}
    <h2>Cuerpo</h2>
    ${st('Sueño promedio', nights.length ? fmtHM(Math.round(nights.reduce((a, v) => a + v, 0) / nights.length)) : '–')}
    ${st('Peso', peso)}
    ${smoke().days.filter(d => d.startsWith(ym)).length ? st('Días sin fumar marcados', smoke().days.filter(d => d.startsWith(ym)).length) : ''}`;
}

function comidaView() { return `<header class="top"><h1>Comida</h1></header>` + comidasCard(); }

/* ---------- botones de las secciones, al final de Hoy ---------- */
function seccionesGrid() {
  const next = upcoming(todayStr())[0], H = HL(), pend = weekItems().filter(([, c, t]) => c < t).length;
  const row = (tab, title, sub) => `<button class="menurow" data-a="tab" data-tab="${tab}"><b>${title}</b><span class="meta">${sub}</span></button>`;
  return `<h2>Secciones</h2><div class="menugrid">
    ${row('semanal', 'Pendientes de la semana', pend ? 'Te faltan ' + pend + (pend === 1 ? ' cosa' : ' cosas') : 'Semana al día ✓')}
    ${row('fechas', 'Fechas importantes', next ? esc(dateLabel(next)) + ' · ' + whenTxt(next.n) : 'Cumpleaños y eventos')}
    ${row('salud', 'Salud', H.weights.length ? 'Último peso: ' + fmtKg(H.weights[H.weights.length - 1].kg) + ' kg' : 'Peso, presión y análisis')}
    ${row('notas', 'Notas', NL().length + (NL().length === 1 ? ' nota' : ' notas'))}
    ${row('mes', 'Resumen del mes', 'Tiempo, ejercicio y sueño')}
    ${row('ajustes', 'Ajustes', 'Meta, rutina y copia')}</div>`;
}

/* ---------- ajustes: rutina y copia de seguridad ---------- */
function ajustesExtras() {
  return `<h2>Rutina del día</h2>
    ${CK().items.map(i => `<div class="cat-row"><input type="text" value="${esc(i.name)}" data-ch="ckName" data-id="${i.id}"><button class="ghost danger" data-a="ckDel" data-id="${i.id}">Quitar</button></div>`).join('')}
    <div class="row-actions"><button data-a="ckAdd">+ Agregar a la rutina</button></div>
    <h2>Copia de seguridad</h2>
    <div class="note">Tus datos están solo en este celular. Guardá una copia de vez en cuando: se descarga un archivo que después podés restaurar, por ejemplo en otro teléfono.${S.lastBackup ? ' Última copia: ' + new Date(S.lastBackup).toLocaleDateString('es-AR') + '.' : ''}</div>
    <div class="row-actions"><button class="primary" data-a="backup">Guardar copia</button></div>
    <div class="note">Para restaurar, elegí el archivo de la copia:</div>
    <div class="row-actions"><input type="file" id="f-restore"></div>
    <div class="field" style="padding:0 14px"><textarea id="f-rpaste" placeholder="Si no podés elegir el archivo, pegá acá su contenido"></textarea></div>
    <div class="row-actions"><button data-a="restorePaste">Restaurar lo pegado</button></div>
    ${ui.bmsg ? `<div class="note okmsg">${esc(ui.bmsg)}</div>` : ''}`;
}

/* ---------- hojas ---------- */
function masSheet(sh) {
  if (sh.type === 'health') return healthSheet(sh);
  if (sh.type === 'date') return dateSheet(sh);
  if (sh.type === 'note') return noteSheet(sh);
  if (sh.type === 'restore') return `<h3>Restaurar copia</h3><div class="note" style="padding:0 0 8px">La copia tiene ${sh.t} actividades y tareas, y ${sh.n} tramos. Al restaurar se reemplaza todo lo que hay ahora en este celular.</div>
    <div class="btns"><button class="danger" data-a="restoreYes">Sí, restaurar</button><button data-a="closeSheet">Cancelar</button></div>`;
  return '';
}

/* ---------- acciones (devuelve true si la manejó) ---------- */
function masClick(a, el, id) {
  const H = HL();
  switch (a) {
    case 'drinkNew': {
      const el3 = $('#f-drink'), name = el3 ? String(el3.value || '').trim().replace(/\s+/g, ' ') : '';
      if (!name) break;
      if (/^(agua|vaso de agua)$/i.test(name)) { logMeal(WATER); ML().log[ML().log.length - 1].d = 1; commit(); break; }
      let d = ML().drinks.find(q => q.name.toLowerCase() === name.toLowerCase());
      if (!d) { d = { id: uid(), name }; ML().drinks.push(d); }
      logMeal(d.name); ML().log[ML().log.length - 1].d = 1; commit(); break;
    }
    case 'drinkAdd': { const d = ML().drinks.find(q => q.id === id); if (d) { logMeal(d.name); ML().log[ML().log.length - 1].d = 1; } commit(); break; }
    case 'drinkLess': { const d = ML().drinks.find(q => q.id === id); if (d) { const w = ML().log.filter(e => e.date === todayStr() && e.name === d.name); if (w.length) ML().log = ML().log.filter(e => e.id !== w[w.length - 1].id); } commit(); break; }
    case 'drinkDel': ML().drinks = ML().drinks.filter(q => q.id !== id); commit(); break;
    case 'waterAdd': logMeal(WATER); commit(); break;
    case 'waterLess': { const w = waterOn(todayStr()); if (w.length) ML().log = ML().log.filter(e => e.id !== w[w.length - 1].id); commit(); break; }
    case 'mealAdd': { const x = ML().list.find(q => q.id === id); if (x) logMeal(x.name); commit(); break; }
    case 'mealNew': {
      const el2 = $('#f-meal'), name = el2 ? String(el2.value || '').trim().replace(/\s+/g, ' ') : '';
      if (!name) break;
      const ex = ML().list.find(q => q.name.toLowerCase() === name.toLowerCase());
      if (!ex) ML().list.push({ id: uid(), name }); logMeal(ex ? ex.name : name); commit(); break;
    }
    case 'ingOpen': { const n = el.dataset.name; ui.open.ing = ui.open.ing === n ? '' : n; render(); break; }
    case 'ingPg': { const m = mealOf(el.dataset.name); if (m) m.pg = Math.max(10, m.pg + Number(el.dataset.d)); commit(); break; }
    case 'ingNew': {
      const m = mealOf(el.dataset.name), i2 = $('#f-ing'), n = i2 ? String(i2.value || '').trim().replace(/\s+/g, ' ') : '';
      if (!m || !n) break;
      if (!m.ing.some(i => i.n.toLowerCase() === n.toLowerCase())) m.ing.push({ n, g: ingSug(n) });
      const nn = (m.ing.find(i => i.n.toLowerCase() === n.toLowerCase())).n;
      ML().log.filter(e => e.date === todayStr() && e.name === m.name).forEach(e => { e.ings = e.ings || []; if (!e.ings.includes(nn)) e.ings.push(nn); });
      commit(); break;
    }
    case 'ingTog': { const n = el.dataset.ing; ML().log.filter(e => e.date === todayStr() && e.name === el.dataset.name).forEach(e => { e.ings = e.ings || []; e.ings = e.ings.includes(n) ? e.ings.filter(x => x !== n) : e.ings.concat(n); }); commit(); break; }
    case 'ingDel': { const m = mealOf(el.dataset.name); if (m) m.ing = m.ing.filter(i => i.n !== el.dataset.ing); commit(); break; }
    case 'mealPlus': logMeal(el.dataset.name); commit(); break;
    case 'mealLess': { const w = ML().log.filter(e => e.date === todayStr() && e.name === el.dataset.name && !e.d); if (w.length) ML().log = ML().log.filter(e => e.id !== w[w.length - 1].id); commit(); break; }
    case 'mealDel': ML().log = ML().log.filter(e => e.id !== id); commit(); break;
    case 'mealDelBtn': ML().list = ML().list.filter(q => q.id !== id); commit(); break;
    case 'mealEdit': ui.open.mealEdit = !ui.open.mealEdit; render(); break;
    case 'bpGo': ui.tab = 'salud'; ui.sheet = null; render(); try { const e = document.getElementById('bp-sec'); if (e && e.scrollIntoView) e.scrollIntoView(); } catch (x) { /* sin scroll */ } break;
    case 'ck': {
      const t = todayStr(), log = CK().log[t] = CK().log[t] || {};
      const water = isWaterItem(CK().items.find(i => i.id === id));   // el "Agua" de la rutina es el vaso de la mañana: al marcarlo suma 1 vaso en Comida (no al revés)
      if (log[id]) { delete log[id]; if (water) { const k = ML().log.findIndex(e => e.date === t && e.src === 'ck'); if (k >= 0) ML().log.splice(k, 1); } }
      else { log[id] = true; if (water && !ML().log.some(e => e.date === t && e.src === 'ck')) { logMeal(WATER); ML().log[ML().log.length - 1].src = 'ck'; } }
      commit(); return true;
    }
    case 'ckAdd': CK().items.push({ id: uid(), name: 'Nuevo hábito' }); commit(); return true;
    case 'ckDel': CK().items = CK().items.filter(i => i.id !== id); commit(); return true;
    case 'backup': backupDownload(); return true;
    case 'restorePaste': backupAsk($('#f-rpaste').value); return true;
    case 'restoreYes': backupApply(); return true;
    case 'saveWeight': {
      const kg = parseNum($('#f-kg').value), t = todayStr();
      if (!(kg > 20 && kg < 400)) { alert('Poné tu peso en kilos, por ejemplo 74,9.'); return true; }
      const ex = H.weights.find(w => w.date === t);
      if (ex) ex.kg = kg; else H.weights.push({ id: uid(), date: t, kg });
      H.weights.sort((x, y) => x.date.localeCompare(y.date)); commit(); return true;
    }
    case 'newHealth': ui.sheet = { type: 'health', kind: el.dataset.kind, id: '' }; render(); return true;
    case 'editHealth': ui.sheet = { type: 'health', kind: el.dataset.kind, id }; render(); return true;
    case 'delHealth': { const k = HKEY[el.dataset.kind]; H[k] = H[k].filter(x => x.id !== id); ui.sheet = null; commit(); return true; }
    case 'saveHealth': {
      const kind = el.dataset.kind, date = $('#f-hdate').value;
      if (!date) { alert('Poné el día.'); return true; }
      let rec;
      if (kind === 'weight') {
        const kg = parseNum($('#f-hkg').value);
        if (!(kg > 20 && kg < 400)) { alert('Poné el peso en kilos, por ejemplo 74,9.'); return true; }
        rec = { date, kg };
      } else if (kind === 'bp') {
        const sys = parseInt($('#f-sys').value, 10) || 0, dia = parseInt($('#f-dia').value, 10) || 0, sugar = parseNum($('#f-sugar').value) || 0;
        if ((sys || dia) && !(sys && dia)) { alert('Poné las dos cifras de la presión, la alta y la baja.'); return true; }
        if (!sys && !sugar) { alert('Poné la presión o el azúcar.'); return true; }
        rec = { date, sys: sys || null, dia: dia || null, sugar: sugar || null };
      } else rec = { date, note: $('#f-hnote').value.trim() };
      const arr = H[HKEY[kind]];
      if (id) Object.assign(arr.find(x => x.id === id), rec); else arr.push(Object.assign({ id: uid() }, rec));
      arr.sort((x, y) => x.date.localeCompare(y.date)); ui.sheet = null; commit(); return true;
    }
    case 'newDate': ui.sheet = { type: 'date', id: '' }; render(); return true;
    case 'editDate': ui.sheet = { type: 'date', id }; render(); return true;
    case 'delDate': S.dates = DL().filter(d => d.id !== id); ui.sheet = null; commit(); return true;
    case 'saveDate': {
      const name = $('#f-dname').value.trim(), date = $('#f-ddate').value;
      if (!name) { alert('Poné un nombre.'); return true; }
      if (!date) { alert('Poné la fecha.'); return true; }
      const rec = { name, kind: $('#f-dkind').value, date, yearly: !!$('#f-dyear').checked, age: !!$('#f-dage').checked, note: $('#f-dnote').value };
      if (id) Object.assign(DL().find(d => d.id === id), rec); else DL().push(Object.assign({ id: uid(), key: '' }, rec));
      ui.sheet = null; commit(); return true;
    }
    case 'addNote': {
      const text = $('#f-note').value.trim();
      if (text) NL().push({ id: uid(), ts: Date.now(), date: todayStr(), text, pin: false });
      commit(); return true;
    }
    case 'editNote': ui.sheet = { type: 'note', id }; render(); return true;
    case 'saveNote': {
      const n = NL().find(x => x.id === id), text = $('#f-ntext').value.trim();
      if (!text) { alert('La nota no puede quedar vacía. Si querés sacarla, usá Borrar nota.'); return true; }
      n.text = text; n.pin = !!$('#f-npin').checked; ui.sheet = null; commit(); return true;
    }
    case 'delNote': S.notes = NL().filter(n => n.id !== id); ui.sheet = null; commit(); return true;
    case 'mn': {
      const [y, m] = (ui.month || todayStr().slice(0, 7)).split('-').map(Number), d = new Date(y, m - 1 + (+el.dataset.n), 1);
      ui.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); render(); return true;
    }
  }
  return false;
}
function masChange(t) {
  if (t.id === 'f-restore') {
    const f = t.files && t.files[0];
    if (f) { const r = new FileReader(); r.onload = () => backupAsk(String(r.result)); r.readAsText(f); }
    return true;
  }
  if (t.id === 'f-dkind') { const y = $('#f-dyear'); if (y) y.checked = t.value === 'birthday'; return true; }
  const ch = t.dataset && t.dataset.ch;
  if (ch === 'ckName') { const i = CK().items.find(x => x.id === t.dataset.id), v = t.value.trim(); if (i && v) { i.name = v; save(); } return true; }
  if (ch === 'goalKg') { const v = parseNum(t.value); if (v > 20 && v < 400) { HL().goalKg = v; commit(); } return true; }
  return false;
}
