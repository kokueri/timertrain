'use strict';
/* ===== TimerTrain core =====
* 設計メモ:
* - 時刻はタイムスタンプ差分で計算（バックグラウンドタブでも正確）
* - 音は WebAudio。開始ボタンのユーザー操作で AudioContext をアンロック（iOS Safari対策）
* - 実行中は Wake Lock で画面スリープを防止
* - 構成は URL (?t=color.secs.name,...&r=N|inf) と localStorage に保存
*/

/* ---------- 定数 ---------- */
const PALETTE = [
{ id: 'red', v: '#FF6B6B' },
{ id: 'orange', v: '#FF9F45' },
{ id: 'yellow', v: '#FFC94D' },
{ id: 'green', v: '#34C759' },
{ id: 'teal', v: '#32ADE6' },
{ id: 'blue', v: '#4C8DFF' },
{ id: 'purple', v: '#BF7AF0' },
{ id: 'pink', v: '#FF6BB5' },
{ id: 'gray', v: '#8E8E93' },
];
const colorOf = id => (PALETTE.find(c => c.id === id) || PALETTE[5]).v;
// DonutTimer の見た目（donut.js）を読み込んだページでは window.DT がある
const DT = window.DT || null;
const BRAND = DT ? DT.brand : 'TimerTrain';
const rowColor = id => DT ? DT.coat(id) : colorOf(id);
const nextColor = id => DT ? DT.next(id) : PALETTE[(PALETTE.findIndex(c => c.id === id) + 1) % PALETTE.length].id;
const MAX_SECS = 99 * 3600;
const LANG = ['en', 'es', 'ja'].includes(document.documentElement.lang) ? document.documentElement.lang : 'ja';
const STR = {
ja: {
work: '作業', brk: '休憩', defName: 'タイマー', namePh: 'タイマー名',
lastDel: '最後の1つは削除できません', copied: 'リンクをコピーしました',
copyPrompt: 'このURLをコピーしてください', done: '完了 🎉', doneTitle: '✅ 完了 — ' + (window.DT ? 'DonutTimer' : 'TimerTrain'),
reps: n => `${n}回`,
totalInf: one => `1周 ${one} × ∞`,
total: (t, one, n) => `合計 ${t}（${one} × ${n}周）`,
cycleInf: c => `${c}周目`,
cycle: (c, r) => `${c} / ${r}周`,
etaRun: t => `${t} に終了予定`, etaIdle: t => `今始めると ${t} に終了`, etaRound: t => `この周は ${t} まで`,
sound: '音', vol: '音量', snd: { chime: 'チャイム', bell: 'ベル', digital: 'デジタル', wood: '木の音', soft: 'やさしい音', none: '音なし' },
more: '詳しい設定', auto: '次のタイマーへ自動で進む', autoNote: 'オフにすると、1つ終わるごとに止まります', remind: '終わる前に知らせる', remindOff: 'しない', remindMin: n => `${n}分前`,
notify: 'ブラウザ通知', notifyNote: '別のタブやアプリを見ていても、区切りでお知らせします', notifyBlocked: 'ブラウザの設定で通知がブロックされています', pausedNext: n => `次は「${n}」。▶で開始`,
nNext: n => `次: ${n}`, nDone: 'すべて終わりました 🎉', nSoon: (n, m) => `${n} はあと${m}分です`,
},
en: {
work: 'Work', brk: 'Break', defName: 'Timer', namePh: 'Timer name',
lastDel: "You can't delete the last timer", copied: 'Link copied',
copyPrompt: 'Copy this URL', done: 'Done 🎉', doneTitle: '✅ Done — ' + (window.DT ? 'DonutTimer' : 'TimerTrain'),
reps: n => `×${n}`,
totalInf: one => `${one} per round × ∞`,
total: (t, one, n) => `Total ${t} (${one} × ${n} rounds)`,
cycleInf: c => `Round ${c}`,
cycle: (c, r) => `Round ${c} / ${r}`,
etaRun: t => `Ends at ${t}`, etaIdle: t => `Start now and finish at ${t}`, etaRound: t => `This round ends at ${t}`,
sound: 'Sound', vol: 'Volume', snd: { chime: 'Chime', bell: 'Bell', digital: 'Digital', wood: 'Wood', soft: 'Soft', none: 'Off' },
more: 'More settings', auto: 'Go to the next timer automatically', autoNote: 'When off, it stops after each timer', remind: 'Remind me before the end', remindOff: 'Off', remindMin: n => `${n} min before`,
notify: 'Browser notifications', notifyNote: 'Get notified at each switch, even in another tab or app', notifyBlocked: 'Notifications are blocked in your browser settings', pausedNext: n => `Next: ${n}. Press ▶ to start`,
nNext: n => `Next: ${n}`, nDone: 'All done 🎉', nSoon: (n, m) => `${n}: ${m} min left`,
},
es: {
work: 'Trabajo', brk: 'Descanso', defName: 'Temporizador', namePh: 'Nombre del temporizador',
lastDel: 'No puedes eliminar el último temporizador', copied: 'Enlace copiado',
copyPrompt: 'Copia esta URL', done: '¡Listo! 🎉', doneTitle: '✅ Listo — ' + (window.DT ? 'DonutTimer' : 'TimerTrain'),
reps: n => `×${n}`,
totalInf: one => `${one} por ronda × ∞`,
total: (t, one, n) => `Total ${t} (${one} × ${n} rondas)`,
cycleInf: c => `Ronda ${c}`,
cycle: (c, r) => `Ronda ${c} / ${r}`,
etaRun: t => `Termina: ${t}`, etaIdle: t => `Si empiezas ahora, termina: ${t}`, etaRound: t => `Esta ronda termina: ${t}`,
sound: 'Sonido', vol: 'Volumen', snd: { chime: 'Campanilla', bell: 'Campana', digital: 'Digital', wood: 'Madera', soft: 'Suave', none: 'Sin sonido' },
more: 'Más ajustes', auto: 'Pasar al siguiente temporizador automáticamente', autoNote: 'Si lo desactivas, se detiene al terminar cada temporizador', remind: 'Avisar antes del final', remindOff: 'No', remindMin: n => `${n} min antes`,
notify: 'Notificaciones del navegador', notifyNote: 'Te avisa en cada cambio, aunque estés en otra pestaña o app', notifyBlocked: 'Las notificaciones están bloqueadas en tu navegador', pausedNext: n => `Siguiente: ${n}. Pulsa ▶ para empezar`,
nNext: n => `Siguiente: ${n}`, nDone: '¡Todo listo! 🎉', nSoon: (n, m) => `${n}: quedan ${m} min`,
},
}[LANG];
const STORE_KEY = 'timertrain-v1:' + location.pathname;
const BASE_TITLE = document.title;

/* ---------- 状態 ---------- */
let state = {
timers: [
{ id: uid(), name: STR.work, secs: 1500, color: 'red' },
{ id: uid(), name: STR.brk, secs: 300, color: 'blue' },
],
repeat: 4, // Infinityで無限
};
let run = { active: false, paused: false, finished: false, idx: 0, cycle: 1, endAt: 0, remainMs: 0, lastSec: -1 };
let tickId = null;
let wakeLock = null;
let audioCtx = null;
let masterGain = null;

function uid() { return Math.random().toString(36).slice(2, 9); }

/* ---------- 時間表記 ---------- */
function fmt(secs) {
secs = Math.max(0, Math.round(secs));
const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
const p = n => String(n).padStart(2, '0');
return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
function parseTime(str) {
str = String(str).trim().replace(/[：]/g, ':').replace(/[^\d:]/g, '');
if (!str) return null;
const parts = str.split(':').map(Number);
if (parts.some(isNaN)) return null;
let secs = 0;
if (parts.length === 1) secs = parts[0] * 60; // "25" → 25分
else if (parts.length === 2) secs = parts[0] * 60 + parts[1]; // "25:30"
else secs = parts[0] * 3600 + parts[1] * 60 + parts[2]; // "1:00:00"
return Math.min(Math.max(1, secs), MAX_SECS);
}

/* ---------- URL/保存 ---------- */
function serialize() {
const t = state.timers.map(x => `${x.color}.${x.secs}.${encodeURIComponent(x.name)}`).join(',');
const r = state.repeat === Infinity ? 'inf' : state.repeat;
return `?t=${t}&r=${r}`;
}
function persist() {
try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, repeat: state.repeat === Infinity ? 'inf' : state.repeat })); } catch (e) {}
// GA4の拡張計測は history.replaceState を包んで page_view を送るため、
// 設定変更のたびに表示回数が水増しされる。プロトタイプのネイティブ実装を直接呼んで回避。
History.prototype.replaceState.call(history, null, '', serialize());
configChanged();
}
function parseConfig(qs) {
try {
// URLSearchParams は %2C を , に戻してしまい名前内カンマと区別できないため、生のまま分割する
let tRaw = null, rRaw = '1';
for (const kv of (qs.startsWith('?') ? qs.slice(1) : qs).split('&')) {
const i = kv.indexOf('=');
if (i < 0) continue;
const k = kv.slice(0, i), v = kv.slice(i + 1);
if (k === 't') tRaw = v;
if (k === 'r') rRaw = v;
}
if (!tRaw) return null;
const timers = tRaw.split(',').map(item => {
const i1 = item.indexOf('.'), i2 = item.indexOf('.', i1 + 1);
if (i1 < 0 || i2 < 0) return null;
const color = item.slice(0, i1);
const secs = Math.min(Math.max(1, parseInt(item.slice(i1 + 1, i2), 10) || 60), MAX_SECS);
const name = decodeURIComponent(item.slice(i2 + 1)).slice(0, 30);
return { id: uid(), name, secs, color: PALETTE.some(c => c.id === color) ? color : 'blue' };
}).filter(Boolean);
if (!timers.length) return null;
const repeat = rRaw === 'inf' ? Infinity : Math.min(Math.max(1, parseInt(rRaw, 10) || 1), 99);
return { timers, repeat };
} catch (e) { return null; }
}
function load() {
// 優先順: URL > このページの保存状態 > ページプリセット > 既定値
const fromUrl = parseConfig(location.search);
if (fromUrl) { state = fromUrl; return; }
try {
const raw = localStorage.getItem(STORE_KEY);
if (raw) {
const s = JSON.parse(raw);
if (Array.isArray(s.timers) && s.timers.length) {
state = { timers: s.timers, repeat: s.repeat === 'inf' ? Infinity : (s.repeat || 1) };
return;
}
}
} catch (e) {}
const p = window.TT_PRESET;
if (p && Array.isArray(p.timers) && p.timers.length) {
state = {
timers: p.timers.map(t => ({
id: uid(),
name: String(t.name || STR.defName).slice(0, 30),
secs: Math.min(Math.max(1, t.secs | 0), MAX_SECS),
color: PALETTE.some(c => c.id === t.color) ? t.color : 'blue',
})),
repeat: p.repeat === 'inf' ? Infinity : Math.min(Math.max(1, p.repeat | 0), 99),
};
}
}

/* ---------- 音（iOS Safari 対応） ---------- */
function unlockAudio() {
if (!audioCtx) {
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
audioCtx = new AC();
}
if (audioCtx.state === 'suspended') audioCtx.resume();
// 無音バッファを鳴らしてアンロック
const buf = audioCtx.createBuffer(1, 1, 22050);
const src = audioCtx.createBufferSource();
src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
if (!masterGain) { masterGain = audioCtx.createGain(); masterGain.connect(audioCtx.destination); }
masterGain.gain.value = sound.v / 70;
}
function beep(freq, dur, at, vol, type) {
if (!audioCtx || !masterGain) return;
const t = audioCtx.currentTime + (at || 0);
const osc = audioCtx.createOscillator();
const g = audioCtx.createGain();
osc.type = type || 'sine'; osc.frequency.value = freq;
g.gain.setValueAtTime(0.0001, t);
g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
osc.connect(g); g.connect(masterGain);
osc.start(t); osc.stop(t + dur + 0.05);
}
/* 音の種類（すべて WebAudio で合成。音源ファイルは使わない） */
function bellTone(f, dur, at, vol) { beep(f, dur, at, vol); beep(f * 2.76, dur * 0.5, at, vol * 0.25); beep(f * 5.4, dur * 0.25, at, vol * 0.12); }
const SOUNDS = {
chime: {
seg() { beep(880, 0.15, 0, 0.35); beep(1175, 0.2, 0.18, 0.35); },
fin() { beep(880, 0.15, 0, 0.4); beep(1175, 0.15, 0.2, 0.4); beep(1568, 0.5, 0.4, 0.4); },
tick() { beep(700, 0.06, 0, 0.15); },
},
bell: {
seg() { bellTone(1046, 1.2, 0, 0.3); },
fin() { bellTone(1046, 1.3, 0, 0.3); bellTone(1318, 1.3, 0.35, 0.3); bellTone(1568, 1.8, 0.7, 0.3); },
tick() { beep(1046, 0.05, 0, 0.1); },
},
digital: {
seg() { beep(1200, 0.08, 0, 0.16, 'square'); beep(1200, 0.08, 0.15, 0.16, 'square'); },
fin() { for (let i = 0; i < 3; i++) { beep(1200, 0.08, i * 0.5, 0.16, 'square'); beep(1200, 0.08, i * 0.5 + 0.15, 0.16, 'square'); } },
tick() { beep(1200, 0.04, 0, 0.07, 'square'); },
},
wood: {
seg() { beep(520, 0.08, 0, 0.5, 'triangle'); beep(780, 0.08, 0.13, 0.5, 'triangle'); },
fin() { beep(520, 0.08, 0, 0.5, 'triangle'); beep(650, 0.08, 0.15, 0.5, 'triangle'); beep(780, 0.08, 0.3, 0.5, 'triangle'); beep(1040, 0.16, 0.5, 0.5, 'triangle'); },
tick() { beep(650, 0.04, 0, 0.25, 'triangle'); },
},
soft: {
seg() { beep(523, 0.6, 0, 0.22); beep(659, 0.8, 0.28, 0.22); },
fin() { beep(523, 0.7, 0, 0.22); beep(659, 0.7, 0.3, 0.22); beep(784, 1.4, 0.6, 0.22); },
tick() { beep(523, 0.08, 0, 0.07); },
},
none: { seg() {}, fin() {}, tick() {} },
};
const SOUND_KEY = 'tt-sound';
let sound = { s: 'chime', v: 70 };
try {
const sv = JSON.parse(localStorage.getItem(SOUND_KEY) || 'null');
if (sv && SOUNDS[sv.s]) sound.s = sv.s;
if (sv && Number.isFinite(sv.v)) sound.v = Math.min(100, Math.max(0, Math.round(sv.v)));
} catch (e) {}
function saveSound() {
try { localStorage.setItem(SOUND_KEY, JSON.stringify(sound)); } catch (e) {}
if (masterGain) masterGain.gain.value = sound.v / 70;
}
const soundSegment = () => SOUNDS[sound.s].seg();
const soundFinish = () => SOUNDS[sound.s].fin();
const soundTick = () => SOUNDS[sound.s].tick();

/* その他の設定（自動で次へ・終了前のお知らせ・ブラウザ通知。端末に保存） */
const OPT_KEY = 'tt-opts';
let opts = { auto: true, remind: 0, notify: false };
try {
const ov = JSON.parse(localStorage.getItem(OPT_KEY) || 'null');
if (ov) {
if (typeof ov.auto === 'boolean') opts.auto = ov.auto;
if ([0, 1, 2, 5].includes(ov.remind)) opts.remind = ov.remind;
if (typeof ov.notify === 'boolean') opts.notify = ov.notify;
}
} catch (e) {}
function saveOpts() { try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {} }
const canNotify = () => 'Notification' in window;
function notify(body) {
if (!opts.notify || !canNotify() || Notification.permission !== 'granted') return;
if (document.visibilityState === 'visible') return; // 画面を見ているときは音と表示だけ
const title = typeof BRAND === 'string' ? BRAND : 'TimerTrain';
const o = { body: String(body), tag: 'timertrain', renotify: true, icon: '/icon-192.png' };
try {
if (navigator.serviceWorker && navigator.serviceWorker.controller) {
navigator.serviceWorker.ready.then(r => r.showNotification(title, o)).catch(() => {});
} else { new Notification(title, o); }
} catch (e) {}
}

/* ---------- Wake Lock ---------- */
async function acquireWakeLock() {
try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
if (document.visibilityState === 'visible' && run.active && !run.paused) acquireWakeLock();
});

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const listEl = $('timer-list'), setupEl = $('setup'), runEl = $('run');
const runName = $('run-name'), runTime = $('run-time'), runCycle = $('run-cycle');
const stationsEl = $('stations'), pauseBtn = $('pause-btn');
const ringFg = $('ring-fg');
const ICONS = {
play: '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
pause: '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
replay: '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
};
const RING_C = 2 * Math.PI * 46;
if (ringFg && !DT) ringFg.style.strokeDasharray = RING_C;
function setRing(frac, color) {
if (DT) {
const c = PALETTE.find(x => x.v === color);
DT.set(frac, c ? c.id : 'blue');
DT.fit(runTime);
return;
}
ringFg.style.strokeDashoffset = RING_C * (1 - Math.min(1, Math.max(0, frac)));
if (color) ringFg.style.stroke = color;
}
// 色の丸（DonutTimer ではミニドーナツ）を塗る
function paintDot(dot, id) {
if (DT) {
dot.textContent = '';
dot.appendChild(DT.mini(id));
dot.setAttribute('aria-label', DT.name(id));
} else {
dot.style.background = colorOf(id);
}
}

/* 終了予定時刻 */
const etaEl = document.createElement('p');
etaEl.id = 'run-eta'; etaEl.className = 'run-eta';
stationsEl.insertAdjacentElement('afterend', etaEl);
const LOCALE = LANG === 'ja' ? 'ja-JP' : LANG === 'es' ? 'es-ES' : ((navigator.language || '').startsWith('en') ? navigator.language : 'en-US');
function clockStr(ms) {
const d = new Date(Date.now() + ms), now = new Date();
const opt = { hour: 'numeric', minute: '2-digit' };
if (d.toDateString() !== now.toDateString()) opt.weekday = 'short';
try { return d.toLocaleString(LOCALE, opt); } catch (e) { return d.toLocaleTimeString(); }
}
function updateEta() {
if (run.finished || !state.timers.length) { etaEl.textContent = ''; return; }
const one = state.timers.reduce((a, t) => a + t.secs, 0) * 1000;
const inf = state.repeat === Infinity;
let ms;
if (!run.active) {
ms = inf ? one : one * state.repeat;
etaEl.textContent = inf ? STR.etaRound(clockStr(ms)) : STR.etaIdle(clockStr(ms));
return;
}
const cur = run.paused ? run.remainMs : Math.max(0, run.endAt - Date.now());
ms = cur;
for (let i = run.idx + 1; i < state.timers.length; i++) ms += state.timers[i].secs * 1000;
if (!inf) ms += (state.repeat - run.cycle) * one;
etaEl.textContent = inf ? STR.etaRound(clockStr(ms)) : STR.etaRun(clockStr(ms));
}
setInterval(() => { if (!run.active || run.paused) updateEta(); }, 15000);

function closeColorPop() { document.querySelectorAll('.color-pop').forEach(p => p.remove()); }
function openColorPop(li, t, dot) {
const existed = li.querySelector('.color-pop');
closeColorPop();
if (existed) return; // 同じ丸をもう一度押したら閉じるだけ
const pop = document.createElement('div');
pop.className = 'color-pop';
(DT ? DT.choices.map(id => ({ id })) : PALETTE).forEach(c => {
const b = document.createElement('button');
b.type = 'button';
paintDot(b, c.id);
if (!DT) b.setAttribute('aria-label', c.id);
if (DT ? DT.flavorOf(c.id) === DT.flavorOf(t.color) : c.id === t.color) b.classList.add('sel');
b.addEventListener('click', ev => {
ev.stopPropagation();
t.color = c.id;
paintDot(dot, c.id);
li.style.setProperty('--row-color', rowColor(c.id));
persist();
closeColorPop();
});
pop.appendChild(b);
});
li.appendChild(pop);
setTimeout(() => document.addEventListener('click', closeColorPop, { once: true }), 0);
}

function renderList() {
listEl.innerHTML = '';
state.timers.forEach((t, i) => {
const li = document.createElement('li');
li.className = 'timer-row';
li.dataset.id = t.id;
li.style.setProperty('--row-color', rowColor(t.color));

const dot = document.createElement('button');
dot.className = 'color-dot';
paintDot(dot, t.color);
if (!DT) dot.setAttribute('aria-label', '色を変更');
dot.addEventListener('click', e => { e.stopPropagation(); openColorPop(li, t, dot); });

const name = document.createElement('input');
name.className = 'name-input';
name.value = t.name;
name.placeholder = STR.namePh;
name.maxLength = 30;
name.addEventListener('change', () => { t.name = name.value; persist(); });

const time = document.createElement('button');
time.className = 'time-btn';
time.textContent = fmt(t.secs);
time.setAttribute('aria-label', '時間を変更');
time.addEventListener('click', () => editTime(t, time));

const dup = document.createElement('button');
dup.className = 'dup-btn';
dup.textContent = '⧉';
dup.setAttribute('aria-label', '複製');
dup.addEventListener('click', () => {
const i = state.timers.findIndex(x => x.id === t.id);
state.timers.splice(i + 1, 0, { ...t, id: uid() });
persist(); renderList();
});

const del = document.createElement('button');
del.className = 'del-btn';
del.textContent = '✕';
del.setAttribute('aria-label', '削除');
del.addEventListener('click', () => {
if (state.timers.length <= 1) { toast(STR.lastDel); return; }
state.timers = state.timers.filter(x => x.id !== t.id);
persist(); renderList();
});

const handle = document.createElement('span');
handle.className = 'drag-handle';
handle.textContent = '≡';
enableDrag(handle, li);

li.append(dot, name, time, dup, del, handle);
listEl.appendChild(li);
});
updateTotal();
updateHighlight();
}

function editTime(t, btn) {
const wrap = document.createElement('span');
wrap.className = 'time-edit';
const mk = (val, aria, len) => {
const el = document.createElement('input');
el.className = 'time-field';
el.inputMode = 'numeric';
el.value = val;
el.maxLength = len;
el.setAttribute('aria-label', aria);
el.addEventListener('focus', () => el.select());
el.addEventListener('input', () => { el.value = el.value.replace(/[^0-9]/g, ''); });
return el;
};
const total = Math.max(0, Math.round(t.secs));
const mm = mk(String(Math.floor(total / 60)), LANG === 'en' ? 'minutes' : LANG === 'es' ? 'minutos' : '分', 3);
const colon = document.createElement('span');
colon.className = 'time-colon';
colon.textContent = ':';
const ss = mk(String(total % 60).padStart(2, '0'), LANG === 'en' ? 'seconds' : LANG === 'es' ? 'segundos' : '秒', 2);
wrap.append(mm, colon, ss);
btn.replaceWith(wrap);
mm.focus(); mm.select();
let done = false;
const commit = () => {
if (done) return; done = true;
const m = parseInt(mm.value || '0', 10) || 0;
const s = parseInt(ss.value || '0', 10) || 0;
t.secs = Math.min(Math.max(1, m * 60 + s), MAX_SECS);
persist(); renderList();
};
const cancel = () => { if (done) return; done = true; renderList(); };
wrap.addEventListener('keydown', e => {
if (e.key === 'Enter') { e.preventDefault(); commit(); }
else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
});
wrap.addEventListener('focusout', () => {
setTimeout(() => { if (!done && !wrap.contains(document.activeElement)) commit(); }, 0);
});
}

/* ドラッグ並び替え（ハンドルのみ・ポインタイベント） */
function enableDrag(handle, li) {
handle.addEventListener('pointerdown', e => {
e.preventDefault();
handle.setPointerCapture(e.pointerId);
// ドラッグ中はDOMを動かさず transform だけで表現し、離した時に一度だけ確定する
const rows = [...listEl.children];
const startIndex = rows.indexOf(li);
const stride = li.offsetHeight + 10; // 行の高さ + margin-bottom
const startY = e.clientY;
const others = rows.filter(r => r !== li);
let target = startIndex;
li.classList.add('dragging');
others.forEach(r => { r.style.transition = 'transform .16s ease'; });
const move = ev => {
const delta = ev.clientY - startY;
li.style.transform = `translateY(${delta}px) scale(1.02)`;
target = Math.min(rows.length - 1, Math.max(0, Math.round((startIndex * stride + delta) / stride)));
others.forEach((r, i) => {
const idx = i < startIndex ? i : i + 1; // r の元のインデックス
let shift = 0;
if (startIndex < target && idx > startIndex && idx <= target) shift = -stride;
else if (startIndex > target && idx >= target && idx < startIndex) shift = stride;
r.style.transform = shift ? `translateY(${shift}px)` : '';
});
};
const up = () => {
handle.removeEventListener('pointermove', move);
handle.removeEventListener('pointerup', up);
handle.removeEventListener('pointercancel', up);
li.classList.remove('dragging');
[...listEl.children].forEach(r => { r.style.transform = ''; r.style.transition = ''; });
if (target !== startIndex) {
const item = state.timers.splice(startIndex, 1)[0];
state.timers.splice(target, 0, item);
persist();
renderList();
}
};
handle.addEventListener('pointermove', move);
handle.addEventListener('pointerup', up);
handle.addEventListener('pointercancel', up);
});
}

function updateTotal() {
const one = state.timers.reduce((a, t) => a + t.secs, 0);
const label = state.repeat === Infinity
? STR.totalInf(fmt(one))
: STR.total(fmt(one * state.repeat), fmt(one), state.repeat);
$('total-label').textContent = label;
const repIn = document.getElementById('rep-input');
if (repIn) { if (document.activeElement !== repIn) repIn.value = state.repeat === Infinity ? '∞' : String(state.repeat); }
else $('rep-count').textContent = state.repeat === Infinity ? '∞' : STR.reps(state.repeat);
$('rep-inf').classList.toggle('active', state.repeat === Infinity);
}

/* ---------- 実行 ---------- */
function startRun() {
unlockAudio();
if (window.gtag) gtag('event', 'timer_start');
if (window.__ttOnStart) { try { window.__ttOnStart(); } catch (e) {} }
run = { active: true, paused: false, finished: false, idx: 0, cycle: 1,
endAt: Date.now() + state.timers[0].secs * 1000, remainMs: 0, lastSec: -1 };
acquireWakeLock();
pauseBtn.innerHTML = ICONS.pause;
runTime.classList.remove('finished');
renderStations();
updateHighlight();
clearInterval(tickId);
tickId = setInterval(tick, 200);
tick();
}
// 停止＝最初に戻る（待機状態: 1つ目のタイマーをリングにプレビュー）
function resetToIdle() {
if (window.__ttOnStop) { try { window.__ttOnStop(); } catch (e) {} }
clearInterval(tickId); tickId = null;
run = { active: false, paused: true, finished: false, idx: 0, cycle: 1, endAt: 0, remainMs: 0, lastSec: -1 };
releaseWakeLock();
document.title = BASE_TITLE;
pauseBtn.innerHTML = ICONS.play;
runTime.classList.remove('finished');
renderStations();
updateHighlight();
updateIdleView();
}
function updateIdleView() {
const t = state.timers[0];
if (!t) return;
if (DT) renderStations(); // DonutTimer は待機中もミニドーナツの並びを見せる
runName.textContent = t.name || STR.defName;
runTime.textContent = fmt(t.secs);
runCycle.textContent = '';
setRing(1, colorOf(t.color));
updateEta();
}
function updateHighlight() {
[...listEl.children].forEach((li, i) => {
li.classList.toggle('current', run.active && !run.finished && i === run.idx);
});
}
function configChanged() {
if (run.active) resetToIdle();
else updateIdleView();
}
function pauseToggle() {
if (!run.active || run.finished) return;
if (run.paused) {
run.endAt = Date.now() + run.remainMs;
run.paused = false;
pauseBtn.innerHTML = ICONS.pause;
acquireWakeLock();
} else {
run.remainMs = Math.max(0, run.endAt - Date.now());
run.paused = true;
pauseBtn.innerHTML = ICONS.play;
releaseWakeLock();
}
updateRunView();
updateEta();
}
function skip() {
if (!run.active || run.finished) return;
advance(false);
}
function resetRun() { resetToIdle(); }
function advance(withSound) {
const now = Date.now();
if (run.idx + 1 < state.timers.length) {
run.idx++;
} else if (state.repeat === Infinity || run.cycle < state.repeat) {
run.cycle++; run.idx = 0;
} else {
finish(); return;
}
if (withSound) {
soundSegment();
const nx = state.timers[run.idx];
notify(STR.nNext(nx.name || STR.defName));
if (!opts.auto && !run.paused) {
run.paused = true;
pauseBtn.innerHTML = ICONS.play;
releaseWakeLock();
toast(STR.pausedNext(nx.name || STR.defName));
}
}
run.lastSec = -1;
run.reminded = false;
if (run.paused) run.remainMs = state.timers[run.idx].secs * 1000;
else run.endAt = now + state.timers[run.idx].secs * 1000;
renderStations();
updateHighlight();
updateRunView();
}
function finish() {
soundFinish();
run.finished = true;
run.paused = true;
releaseWakeLock();
runTime.classList.add('finished');
runTime.textContent = STR.done;
runName.textContent = '';
runCycle.textContent = '';
pauseBtn.innerHTML = ICONS.replay;
if (DT) { DT.done(); DT.fit(runTime); } else setRing(1, '#34C759');
document.title = STR.doneTitle;
updateEta();
notify(STR.nDone);
if (window.__ttOnFinish) { try { window.__ttOnFinish(); } catch (e) {} }
}
function tick() {
if (!run.active || run.paused || run.finished) return;
const remain = run.endAt - Date.now();
if (remain <= 0) { advance(true); return; }
const sec = Math.ceil(remain / 1000);
if (sec !== run.lastSec) {
run.lastSec = sec;
if (sec <= 3) soundTick();
const t = state.timers[run.idx];
if (opts.remind && !run.reminded && t.secs > opts.remind * 60 + 5 && sec <= opts.remind * 60 && sec > 3) {
run.reminded = true;
soundTick(); setTimeout(soundTick, 250);
notify(STR.nSoon(t.name || STR.defName, opts.remind));
}
}
updateRunView();
}
function updateRunView() {
if (run.finished) return;
const t = state.timers[run.idx];
const remainMs = run.paused ? run.remainMs : Math.max(0, run.endAt - Date.now());
const sec = Math.ceil(remainMs / 1000);
const disp = fmt(sec);
runTime.textContent = disp;
runName.textContent = t.name || STR.defName;
runCycle.textContent = state.repeat === Infinity
? STR.cycleInf(run.cycle)
: STR.cycle(run.cycle, state.repeat);
setRing(remainMs / (t.secs * 1000), colorOf(t.color));
document.title = `${disp} ${t.name} — ${BRAND}`;
if (sec !== run.etaSec) { run.etaSec = sec; updateEta(); }
}
function renderStations() {
stationsEl.innerHTML = '';
// タイマー数が多いときは省略表示
if (state.timers.length > 12) return;
state.timers.forEach((t, i) => {
if (i > 0) {
const rail = document.createElement('span');
rail.className = 'rail';
stationsEl.appendChild(rail);
}
const s = document.createElement('span');
s.className = 'station' + (run.active ? (i < run.idx ? ' done' : i === run.idx ? ' now' : '') : '');
if (DT) s.appendChild(DT.mini(t.color)); else s.style.background = colorOf(t.color);
stationsEl.appendChild(s);
});
}

/* ---------- その他UI ---------- */
let toastId = null;
function toast(msg) {
const el = $('toast');
el.textContent = msg;
el.classList.add('show');
clearTimeout(toastId);
toastId = setTimeout(() => el.classList.remove('show'), 1800);
}

$('add-btn').addEventListener('click', () => {
const last = state.timers[state.timers.length - 1];
state.timers.push({ id: uid(), name: STR.defName, secs: 300, color: nextColor(last ? last.color : 'gray') });
persist(); renderList();
});
/* くり返し回数の直接入力（1〜99。全角数字も可。空・範囲外は元に戻す） */
(function () {
const box = $('rep-count');
if (!box) return;
const inp = document.createElement('input');
inp.id = 'rep-input'; inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
inp.maxLength = 2; inp.className = 'rep-input';
inp.setAttribute('aria-label', LANG === 'en' ? 'Repeat count' : LANG === 'es' ? 'Número de repeticiones' : 'くり返し回数');
const unit = document.createElement('span'); unit.className = 'rep-unit';
box.textContent = '';
if (LANG === 'ja') { unit.textContent = '回'; box.appendChild(inp); box.appendChild(unit); }
else { unit.textContent = '×'; box.appendChild(unit); box.appendChild(inp); }
function commit() {
const v = inp.value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).trim();
const n = parseInt(v, 10);
if (/^\d{1,2}$/.test(v) && n >= 1 && n <= 99 && n !== state.repeat) { state.repeat = n; persist(); }
inp.value = state.repeat === Infinity ? '∞' : String(state.repeat);
updateTotal();
}
inp.addEventListener('focus', () => { setTimeout(() => inp.select(), 0); });
inp.addEventListener('change', commit);
inp.addEventListener('blur', commit);
inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); inp.blur(); } e.stopPropagation(); });
updateTotal();
})();
/* 音の設定（種類・音量。端末に保存） */
(function () {
const rr = document.querySelector('.repeat-row');
if (!rr) return;
const row = document.createElement('div'); row.className = 'sound-row';
const lab = document.createElement('label'); lab.className = 'repeat-label'; lab.htmlFor = 'snd-type'; lab.textContent = STR.sound;
const ctrl = document.createElement('div'); ctrl.className = 'sound-ctrl';
const sel = document.createElement('select'); sel.id = 'snd-type';
Object.keys(SOUNDS).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = STR.snd[k]; sel.appendChild(o); });
sel.value = sound.s;
const vol = document.createElement('input'); vol.type = 'range'; vol.id = 'snd-vol'; vol.min = '0'; vol.max = '100'; vol.step = '5';
vol.value = String(sound.v); vol.setAttribute('aria-label', STR.vol);
const paint = () => { vol.disabled = sound.s === 'none'; vol.style.setProperty('--p', sound.v + '%'); };
const preview = () => { unlockAudio(); soundSegment(); };
sel.addEventListener('change', () => { sound.s = SOUNDS[sel.value] ? sel.value : 'chime'; saveSound(); paint(); preview(); if (window.gtag) gtag('event', 'sound_change', { sound: sound.s }); });
vol.addEventListener('input', () => { sound.v = Math.min(100, Math.max(0, parseInt(vol.value, 10) || 0)); saveSound(); paint(); });
vol.addEventListener('change', preview);
ctrl.append(sel, vol); row.append(lab, ctrl);
rr.insertAdjacentElement('afterend', row);
paint();

const det = document.createElement('details'); det.className = 'more-set';
const sum = document.createElement('summary'); sum.textContent = STR.more; det.appendChild(sum);
const mkRow = (labelText, note, control, id) => {
const r = document.createElement('div'); r.className = 'opt-row';
const tx = document.createElement('div'); tx.className = 'opt-text';
const l = document.createElement('label'); l.htmlFor = id; l.textContent = labelText; tx.appendChild(l);
if (note) { const n = document.createElement('p'); n.className = 'opt-note'; n.textContent = note; tx.appendChild(n); }
r.append(tx, control); det.appendChild(r); return r;
};
const sw = (id, on) => { const c = document.createElement('input'); c.type = 'checkbox'; c.id = id; c.className = 'tt-switch'; c.checked = on; c.setAttribute('role', 'switch'); return c; };
const autoSw = sw('opt-auto', opts.auto);
autoSw.addEventListener('change', () => { opts.auto = autoSw.checked; saveOpts(); });
mkRow(STR.auto, STR.autoNote, autoSw, 'opt-auto');
const rem = document.createElement('select'); rem.id = 'opt-remind'; rem.className = 'tt-select';
[0, 1, 2, 5].forEach(n => { const o = document.createElement('option'); o.value = String(n); o.textContent = n ? STR.remindMin(n) : STR.remindOff; rem.appendChild(o); });
rem.value = String(opts.remind);
rem.addEventListener('change', () => { opts.remind = parseInt(rem.value, 10) || 0; saveOpts(); });
mkRow(STR.remind, '', rem, 'opt-remind');
if (canNotify()) {
const nSw = sw('opt-notify', opts.notify && Notification.permission === 'granted');
nSw.addEventListener('change', async () => {
if (!nSw.checked) { opts.notify = false; saveOpts(); return; }
let p = Notification.permission;
if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
if (p !== 'granted') { nSw.checked = false; opts.notify = false; saveOpts(); if (p === 'denied') toast(STR.notifyBlocked); return; }
opts.notify = true; saveOpts();
if (window.gtag) gtag('event', 'notify_on');
});
mkRow(STR.notify, STR.notifyNote, nSw, 'opt-notify');
}
row.insertAdjacentElement('afterend', det);
})();
$('rep-minus').addEventListener('click', () => {
state.repeat = state.repeat === Infinity ? 99 : Math.max(1, state.repeat - 1);
persist(); updateTotal();
});
$('rep-plus').addEventListener('click', () => {
state.repeat = state.repeat === Infinity ? 1 : Math.min(99, state.repeat + 1);
persist(); updateTotal();
});
$('rep-inf').addEventListener('click', () => {
state.repeat = state.repeat === Infinity ? 1 : Infinity;
persist(); updateTotal();
});
$('share-btn').addEventListener('click', async () => {
if (window.gtag) gtag('event', 'share_click');
const url = location.origin + location.pathname + serialize();
try {
await navigator.clipboard.writeText(url);
toast(STR.copied);
} catch (e) {
prompt(STR.copyPrompt, url);
}
});
$('pause-btn').addEventListener('click', () => { if (run.finished) resetAndGo(); else if (run.active) pauseToggle(); else startRun(); });
$('skip-btn').addEventListener('click', skip);
$('reset-btn').addEventListener('click', resetRun);
function resetAndGo() { resetToIdle(); startRun(); }

document.addEventListener('keydown', e => {
if (e.target.tagName === 'INPUT') return;
if (e.code === 'Space') {
e.preventDefault();
if (!run.active) startRun();
else if (run.finished) resetAndGo();
else pauseToggle();
}
if (!run.active) return;
if (e.key === 's' || e.key === 'S') skip();
if (e.key === 'r' || e.key === 'R') resetRun();
if (e.key === 'Escape') resetToIdle();
});

/* ---------- 起動 ---------- */
load();
renderList();
pauseBtn.innerHTML = ICONS.play;
persist(); // configChanged() 経由で待機ビュー（リングプレビュー）も描画される

/* ---------- 集中モード（PCのみ表示。リングと時間だけの全画面） ---------- */
(function () {
var runSec = document.getElementById('run');
if (!runSec) return;
var lang = document.documentElement.lang;
var L = lang === 'en' ? { on: 'Focus mode', off: 'Exit' }
: lang === 'es' ? { on: 'Modo concentración', off: 'Salir' }
: { on: '集中モード', off: '解除' };
var IC_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
var IC_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';

var btn = document.createElement('button');
btn.id = 'focus-btn';
btn.type = 'button';
runSec.appendChild(btn);

var hint = document.createElement('p');
hint.className = 'kbd-hint';
hint.innerHTML = lang === 'en'
? '<kbd>Space</kbd> start / pause · <kbd>S</kbd> skip · <kbd>R</kbd> reset · <kbd>F</kbd> focus mode'
: lang === 'es'
? '<kbd>Espacio</kbd> iniciar / pausar · <kbd>S</kbd> saltar · <kbd>R</kbd> reiniciar · <kbd>F</kbd> concentración'
: '<kbd>Space</kbd> 開始・一時停止 · <kbd>S</kbd> スキップ · <kbd>R</kbd> リセット · <kbd>F</kbd> 集中モード';
runSec.appendChild(hint);

function isOn() { return document.body.classList.contains('focus-mode'); }
function paint() {
var on = isOn();
btn.innerHTML = (on ? IC_OFF : IC_ON) + '<span>' + (on ? L.off : L.on) + '</span>';
btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
function setFocus(on) {
document.body.classList.toggle('focus-mode', on);
paint();
try {
if (on) {
if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
} else if (document.fullscreenElement && document.exitFullscreen) {
document.exitFullscreen().catch(function () {});
}
} catch (e) {}
}
paint();
btn.addEventListener('click', function () { setFocus(!isOn()); });
document.addEventListener('fullscreenchange', function () {
if (!document.fullscreenElement && isOn()) setFocus(false);
});
/* Esc は既存のリセット動作より先に受け取り、集中モード中は解除だけ行う */
document.addEventListener('keydown', function (e) {
if (e.key === 'Escape' && isOn()) {
e.stopImmediatePropagation();
e.preventDefault();
setFocus(false);
return;
}
if ((e.key === 'f' || e.key === 'F') && e.target.tagName !== 'INPUT'
&& !e.metaKey && !e.ctrlKey && !e.altKey) {
e.preventDefault();
setFocus(!isOn());
}
}, true);
})();

/* ---------- テーマ切替（ライト/ダーク手動トグル。未設定時はOS準拠） ---------- */
(function () {
var KEY = 'tt-theme';
var root = document.documentElement;
var saved = null;
try { saved = localStorage.getItem(KEY); } catch (e) {}
if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);

function osDark() { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
function effective() {
var dt = root.getAttribute('data-theme');
return dt ? dt : (osDark() ? 'dark' : 'light');
}

var lang = root.lang;
var L = lang === 'en' ? { dark: 'Dark', light: 'Light' }
: lang === 'es' ? { dark: 'Oscuro', light: 'Claro' }
: { dark: 'ダーク', light: 'ライト' };
var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-6a1 1 0 011 1v1a1 1 0 11-2 0V2a1 1 0 011-1zm0 18a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM3.5 4.9a1 1 0 011.4 0l.7.7A1 1 0 114.2 7l-.7-.7a1 1 0 010-1.4zm14.2 14.2a1 1 0 011.4 0l.7.7a1 1 0 11-1.4 1.4l-.7-.7a1 1 0 010-1.4zM1 12a1 1 0 011-1h1a1 1 0 110 2H2a1 1 0 01-1-1zm19 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM4.9 20.5a1 1 0 010-1.4l.7-.7A1 1 0 117 19.8l-.7.7a1 1 0 01-1.4 0zM18.3 6.4a1 1 0 010-1.4l.7-.7a1 1 0 111.4 1.4l-.7.7a1 1 0 01-1.4 0z"/></svg>';
var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';

var btn = document.createElement('button');
btn.id = 'theme-btn';
btn.type = 'button';
(document.querySelector('.header') || document.body).appendChild(btn);

function paint() {
var eff = effective();
btn.innerHTML = (eff === 'dark' ? MOON : SUN) + '<span>' + (eff === 'dark' ? L.dark : L.light) + '</span>';
btn.setAttribute('aria-label', eff === 'dark' ? L.dark : L.light);
btn.setAttribute('aria-pressed', eff === 'dark' ? 'true' : 'false');
}
paint();
btn.addEventListener('click', function () {
var next = effective() === 'dark' ? 'light' : 'dark';
root.setAttribute('data-theme', next);
try { localStorage.setItem(KEY, next); localStorage.setItem('tt-theme-at', String(Date.now())); } catch (e) {}
paint();
if (window.__ttOnTheme) { try { window.__ttOnTheme(next); } catch (e) {} }
});
// 同期（ログイン中のみ sync.js が使う）: 他の端末で選んだテーマを反映
window.__ttApplyTheme = function (t, at) {
if (t !== 'dark' && t !== 'light') return;
root.setAttribute('data-theme', t);
try { localStorage.setItem(KEY, t); localStorage.setItem('tt-theme-at', String(at || Date.now())); } catch (e) {}
paint();
};
})();

/* ---------- アカウント入口（ログイン/マイページ）。ここでは認証ライブラリを読み込まない ---------- */
(function () {
var lang = document.documentElement.lang;
var signed = false;
try { signed = !!localStorage.getItem('sb-arsfocfjfwtlykfdkiea-auth-token'); } catch (e) {}
var L = lang === 'en' ? { in: 'Sign in', me: 'Account' }
: lang === 'es' ? { in: 'Iniciar sesión', me: 'Cuenta' }
: { in: 'ログイン', me: 'マイページ' };
var a = document.createElement('a');
a.id = 'acct-link';
a.href = '/account?l=' + (['en', 'es'].indexOf(lang) >= 0 ? lang : 'ja');
var ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
ic.setAttribute('viewBox', '0 0 24 24'); ic.setAttribute('aria-hidden', 'true');
var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
path.setAttribute('d', 'M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1a2 2 0 002 2h12a2 2 0 002-2v-1c0-2.8-3.6-5-8-5z');
ic.appendChild(path);
var sp = document.createElement('span'); sp.textContent = signed ? L.me : L.in;
a.appendChild(ic); a.appendChild(sp);
a.setAttribute('aria-label', signed ? L.me : L.in);
(document.querySelector('.header') || document.body).appendChild(a);
// ログイン中だけ、同期用のライブラリとマイタイマーを読み込む（未ログインの人には何も増えない）
if (signed && document.getElementById('setup')) {
var s1 = document.createElement('script'); s1.src = '/vendor/supabase-2.116.0.js';
s1.onload = function () { var s2 = document.createElement('script'); s2.src = '/sync.js?v=3'; document.body.appendChild(s2); };
document.body.appendChild(s1);
}
})();

/* ---------- リテンション: 最近の編成 / ホーム画面追加 / 再訪ヒント ---------- */
(function () {
var lang = document.documentElement.lang;
var L = (lang === 'en') ? {
recent: 'Recent', install: 'Add to home screen',
comeback: 'Add ' + (window.DT ? 'DonutTimer' : 'TimerTrain') + ' to your home screen to reopen it in one tap.',
bookmark: 'Bookmark this page (Ctrl/Cmd+D) so you can come back tomorrow.', dismiss: 'Close'
} : (lang === 'es') ? {
recent: 'Recientes', install: 'Añadir a la pantalla de inicio',
comeback: 'Añade ' + (window.DT ? 'DonutTimer' : 'TimerTrain') + ' a tu pantalla de inicio para volver con un toque.',
bookmark: 'Guarda esta página (Ctrl/Cmd+D) para volver mañana.', dismiss: 'Cerrar'
} : {
recent: '最近の編成', install: 'ホーム画面に追加',
comeback: 'ホーム画面に追加すると、次回ワンタップで開けます。',
bookmark: 'このページをブックマーク（Ctrl/Cmd+D）すると、また明日使えます。', dismiss: '閉じる'
};
var RECENTS_KEY = 'tt-recents';
var app = document.querySelector('.app');
var header = document.querySelector('.header');

function readRecents() { try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); } catch (e) { return []; } }
function writeRecents(a) { try { localStorage.setItem(RECENTS_KEY, JSON.stringify(a.slice(0, 6))); } catch (e) {} }
function curQuery() { try { return serialize(); } catch (e) { return ''; } }
function labelFor() {
try {
var names = state.timers.map(function (t) { return t.name || ''; }).filter(Boolean);
var lbl = names.slice(0, 3).join(' · ');
if (names.length > 3) lbl += '…';
var r = (state.repeat === Infinity) ? '∞' : ('×' + state.repeat);
return (lbl || 'Timer') + ' ' + r;
} catch (e) { return 'Timer'; }
}

// 開始時に「最近の編成」として記録
window.__ttOnStart = function () {
try {
var entry = { p: location.pathname, q: curQuery(), l: labelFor(), t: Date.now() };
if (!entry.q) return;
var list = readRecents().filter(function (e) { return !(e.p === entry.p && e.q === entry.q); });
list.unshift(entry);
writeRecents(list);
} catch (e) {}
};

// 「最近の編成」チップを表示（今と同一構成は除外）
function renderRecents() {
if (!app || !header) return;
var old = document.getElementById('tt-recents'); if (old) old.remove();
var cq = curQuery();
var list = readRecents().filter(function (e) { return !(e.p === location.pathname && e.q === cq); });
if (!list.length) return;
var wrap = document.createElement('div'); wrap.id = 'tt-recents'; wrap.className = 'tt-recents';
var lab = document.createElement('span'); lab.className = 'tt-recents-label'; lab.textContent = L.recent; wrap.appendChild(lab);
list.slice(0, 4).forEach(function (e) {
var a = document.createElement('a'); a.className = 'tt-chip'; a.href = e.p + e.q; a.textContent = e.l; wrap.appendChild(a);
});
header.insertAdjacentElement('afterend', wrap);
}

// PWA: ホーム画面に追加
var deferred = null;
function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
function showInstallBtn() {
if (document.getElementById('tt-install') || isStandalone()) return;
try { if (localStorage.getItem('tt-install-dismissed') === '1') return; } catch (e) {}
var b = document.createElement('button'); b.id = 'tt-install'; b.type = 'button';
b.innerHTML = '<span class="ic" aria-hidden="true">➕</span><span class="tt-install-t">' + L.install + '</span><span class="x" aria-hidden="true">✕</span>';
document.body.appendChild(b);
b.addEventListener('click', function (ev) {
if (ev.target && ev.target.classList.contains('x')) { b.remove(); try { localStorage.setItem('tt-install-dismissed', '1'); } catch (e) {} return; }
if (deferred) { deferred.prompt(); if (deferred.userChoice) deferred.userChoice.finally(function () { deferred = null; b.remove(); }); }
});
}
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; showInstallBtn(); });
window.addEventListener('appinstalled', function () { var b = document.getElementById('tt-install'); if (b) b.remove(); });

// 完了時の「また来てね」ヒント（1セッション1回・ダイアログは軽く）
var shownComeback = false;
window.__ttOnFinish = function () {
if (shownComeback || isStandalone()) return;
try { if (localStorage.getItem('tt-comeback-dismissed') === '1') return; } catch (e) {}
shownComeback = true;
var d = document.createElement('div'); d.id = 'tt-comeback'; d.className = 'tt-comeback';
var msg = document.createElement('span'); msg.textContent = '★ ' + (deferred ? L.comeback : L.bookmark); d.appendChild(msg);
var actions = document.createElement('div'); actions.className = 'tt-cb-actions';
if (deferred) {
var ib = document.createElement('button'); ib.type = 'button'; ib.className = 'tt-cb-install'; ib.textContent = L.install;
ib.addEventListener('click', function () { deferred.prompt(); if (deferred.userChoice) deferred.userChoice.finally(function () { deferred = null; d.remove(); }); });
actions.appendChild(ib);
}
var xb = document.createElement('button'); xb.type = 'button'; xb.className = 'tt-cb-x'; xb.textContent = L.dismiss;
xb.addEventListener('click', function () { d.remove(); try { localStorage.setItem('tt-comeback-dismissed', '1'); } catch (e) {} });
actions.appendChild(xb);
d.appendChild(actions);
document.body.appendChild(d);
};

renderRecents();
window.__ttRenderRecents = renderRecents;
})();

/* ---------- 未ログインの人向け: 保存・同期の入口（ログイン中は sync.js が消す） ---------- */
(function () {
var row = document.querySelector('.action-row');
if (!row) return;
try { if (localStorage.getItem('sb-arsfocfjfwtlykfdkiea-auth-token')) return; } catch (e) {}
var lang = document.documentElement.lang;
var l = ['en', 'es'].indexOf(lang) >= 0 ? lang : 'ja';
var txt = l === 'en' ? 'Save timers & sync across devices (free sign-in)'
: l === 'es' ? 'Guarda y sincroniza entre dispositivos (inicio de sesión gratis)'
: '保存して別の端末でも使う（無料ログイン）';
var wrap = document.createElement('div'); wrap.id = 'tt-sync'; wrap.className = 'tt-sync';
var a = document.createElement('a'); a.href = '/account?l=' + l; a.textContent = txt; a.className = 'tt-sync-link';
a.addEventListener('click', function () { try { if (window.gtag) gtag('event', 'login_cta_click', { page: location.pathname }); } catch (e) {} });
wrap.appendChild(a);
row.insertAdjacentElement('afterend', wrap);
})();
