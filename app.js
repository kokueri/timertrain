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
askNotify: '別のタブを見ているときや最小化中も、ポップアップでお知らせしますか？', askYes: 'オンにする', askNo: '今はしない',
restored: 'タイマーを続きから再開しました', caught: n => `見ていない間に ${n} 回切り替わりました`, tapSound: '音を鳴らすには画面をタップしてください',
keep: '裏でも止まりにくくする', keepNote: 'PCのブラウザは、音を出していないタブを省エネのために止めることがあります。オンにすると、動かしている間だけ聞こえないくらい小さな音を流して止まりにくくします（タブにスピーカーのマークが出ます）',
silent: 'マナーモードでも鳴らす', silentNote: 'iPhone・iPad はマナーモード中だと音が出ません。オンにすると鳴りますが、音楽アプリの再生が止まることがあります',
askSilent: 'iPhone はマナーモード中だと音が鳴りません。マナーモードでも鳴らしますか？（音楽アプリは止まることがあります）',
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
askNotify: 'Get a pop-up notification at each switch, even in another tab or when minimized?', askYes: 'Turn on', askNo: 'Not now',
restored: 'Timer resumed where it left off', caught: n => `${n} switch${n > 1 ? 'es' : ''} happened while you were away`, tapSound: 'Tap the screen to turn the sound back on',
keep: 'Keep running in the background', keepNote: 'Computer browsers may pause silent tabs to save energy. When on, a nearly inaudible sound plays while the timer runs so it keeps going (a speaker icon appears on the tab)',
silent: 'Play sound in silent mode', silentNote: 'iPhone and iPad stay quiet when the silent switch is on. Turn this on to hear the timer anyway (music apps may pause)',
askSilent: 'Your iPhone stays quiet in silent mode. Play the timer sound even in silent mode? (Music apps may pause)',
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
askNotify: '¿Quieres un aviso emergente en cada cambio, aunque estés en otra pestaña o la ventana esté minimizada?', askYes: 'Activar', askNo: 'Ahora no',
restored: 'El temporizador continúa donde se quedó', caught: n => `Hubo ${n} cambio${n > 1 ? 's' : ''} mientras no mirabas`, tapSound: 'Toca la pantalla para volver a activar el sonido',
keep: 'Seguir en segundo plano', keepNote: 'Los navegadores del ordenador pueden pausar las pestañas sin sonido para ahorrar energía. Al activarlo, suena un sonido casi inaudible mientras el temporizador corre para que no se detenga (aparece un altavoz en la pestaña)',
silent: 'Sonar en modo silencio', silentNote: 'El iPhone y el iPad no suenan en modo silencio. Actívalo para oír el temporizador (la música puede pausarse)',
askSilent: 'Tu iPhone no suena en modo silencio. ¿Quieres que el temporizador suene igualmente? (la música puede pausarse)',
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
let startVia = 'play'; // timer_start の via（play / key / quick_○○）
let lateAdvance = false; // 遅れて処理する区切り（音・通知を出さない）
let wakeLock = null;
let audioCtx = null;
let masterGain = null;
let schedOff = 0, schedNodes = [], wakeNode = null, bgSched = false; // 裏のタブ用の予約（下の「バックグラウンド」参照）

function uid() { return Math.random().toString(36).slice(2, 9); }
const RUN_KEY = 'tt-run:' + location.pathname;
function saveRun() {
try {
if (!run.active || run.finished) { sessionStorage.removeItem(RUN_KEY); return; }
sessionStorage.setItem(RUN_KEY, JSON.stringify({ q: serialize(), paused: run.paused, idx: run.idx, cycle: run.cycle,
endAt: run.endAt, remainMs: run.remainMs, reminded: !!run.reminded, at: Date.now() }));
} catch (e) {}
}

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
if (window.__ttOnConfig) { try { window.__ttOnConfig(); } catch (e) {} }
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
// YouTube等のリダイレクトを通るとカンマが %2C に変わる。次の「色.秒数.」の直前にある %2C も区切りとして扱う
const COLOR_RE = PALETTE.map(c => c.id).join('|');
const SPLIT_RE = new RegExp('%2C(?=(?:' + COLOR_RE + ')\\.\\d+\\.)', 'i');
const timers = tRaw.split(',').flatMap(x => x.split(SPLIT_RE)).map(item => {
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
// タイトル（TimerTrain）を押して来たときは、このページの基本の編成から始める
let fresh = false;
try { fresh = sessionStorage.getItem('tt-fresh') === location.pathname; if (fresh) sessionStorage.removeItem('tt-fresh'); } catch (e) {}
// 優先順: URL > このページの保存状態 > ページプリセット > 既定値
const fromUrl = fresh ? null : parseConfig(location.search);
if (fromUrl) { state = fromUrl; return; }
try {
const raw = fresh ? null : localStorage.getItem(STORE_KEY);
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

/* ---------- iPhone/iPad のマナーモード ----------
 * iOS の WebAudio は消音スイッチに従う（ambient）。メディア再生として扱わせると鳴るが、
 * 他のアプリの音楽は止まる。そのため設定でオンにした人だけ:
 *  1) Audio Session API があれば type='playback'
 *  2) なければ無音の <audio> を流しっぱなしにしてメディア扱いにする（実行中だけ） */
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const SILENT_SRC = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
let silentEl = null;
function applySilentMode(playing) {
if (!IS_IOS) return;
const want = !!opts.silent;
try { if (navigator.audioSession) navigator.audioSession.type = want && playing ? 'playback' : 'auto'; } catch (e) {}
if (want && playing) {
if (!silentEl) { silentEl = new Audio(SILENT_SRC); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01; }
try { const pr = silentEl.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
} else if (silentEl) { try { silentEl.pause(); } catch (e) {} }
}

/* ---------- 動作の記録（端末の中だけ。#ttdebug を付けて開くと表示） ----------
 * タイマー名などは残さない。区切りの番号・遅れ（ミリ秒）・画面の見え方・音の状態だけ。 */
var DIAG_KEY = 'tt-diag', diagBuf = null, diagT0 = Date.now(), diagC0 = 0;
function diag(ev, x) {
try {
if (!diagBuf) { try { diagBuf = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]'); } catch (e) { diagBuf = []; } if (!Array.isArray(diagBuf)) diagBuf = []; }
var row = [Date.now(), String(ev).slice(0, 24)];
if (x !== undefined) row.push(typeof x === 'number' ? Math.round(x) : String(x).slice(0, 40));
// 音の時計がどれだけ止まっていたか（壁の時計との差）
if (audioCtx) { if (!diagC0) { diagC0 = audioCtx.currentTime; diagT0 = Date.now(); } row.push('ac:' + audioCtx.state + ':' + Math.round((Date.now() - diagT0) - (audioCtx.currentTime - diagC0) * 1000)); }
row.push(document.visibilityState[0] + (document.hasFocus() ? 'f' : ''));
diagBuf.push(row);
if (diagBuf.length > 400) diagBuf = diagBuf.slice(-400);
localStorage.setItem(DIAG_KEY, JSON.stringify(diagBuf));
} catch (e) {}
}
['visibilitychange', 'freeze', 'resume', 'focus', 'blur', 'pageshow', 'pagehide'].forEach(function (n) {
(n === 'focus' || n === 'blur' || n === 'pageshow' || n === 'pagehide' ? window : document).addEventListener(n, function (e) { diag(n === 'visibilitychange' ? 'vis-' + document.visibilityState : n, e && e.persisted ? 'persisted' : undefined); });
});
if (/(^|[#&?])ttdebug\b/.test(location.hash + location.search)) {
window.addEventListener('load', function () {
var raw = []; try { raw = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]'); } catch (e) {}
var lines = raw.map(function (r) { var d = new Date(r[0]); return d.toLocaleString() + '.' + String(r[0] % 1000).padStart(3, '0') + '  ' + r.slice(1).join('  '); });
var box = document.createElement('div'); box.className = 'tt-diag';
var pre = document.createElement('pre'); pre.textContent = navigator.userAgent + '\n' + lines.join('\n');
var cp = document.createElement('button'); cp.type = 'button'; cp.textContent = 'Copy';
cp.addEventListener('click', function () { try { navigator.clipboard.writeText(pre.textContent); cp.textContent = 'Copied'; } catch (e) {} });
var clr = document.createElement('button'); clr.type = 'button'; clr.textContent = 'Clear';
clr.addEventListener('click', function () { try { localStorage.removeItem(DIAG_KEY); } catch (e) {} diagBuf = []; pre.textContent = ''; });
var x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.addEventListener('click', function () { box.remove(); });
box.append(x, cp, clr, pre); document.body.appendChild(box);
});
}

/* ---------- 裏でも止まりにくくする（PC） ----------
 * Chrome は「音を出さずに5分以上隠れている」タブを省エネで止めることがある（予約した音も止まる）。
 * 実行中だけ、聞こえないくらい小さく低い音（ブラウンノイズ、約 -60dBFS）を流して「音を出しているタブ」にする。
 * 完全な無音はブラウザに無音と判定されるので効かない。音量のつまみ・音なしの設定とは別（destination に直接）。 */
const KEEP_OK = !IS_IOS && !/Android/i.test(navigator.userAgent);
let keepNode = null;
function keepAlive(on) {
on = !!(on && KEEP_OK && opts.keep && audioCtx);
if (!on) { if (keepNode) { try { keepNode.stop(0); keepNode.disconnect(); } catch (e) {} keepNode = null; diag('keep-off'); } return; }
if (keepNode) return;
try {
const sr = audioCtx.sampleRate, len = sr * 4, buf = audioCtx.createBuffer(1, len, sr), d = buf.getChannelData(0);
let last = 0, sum = 0;
for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last; }
// つなぎ目で音が跳ねないよう、両端を少しずつ 0 に寄せる
const fade = Math.floor(sr * 0.05);
for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] *= k; }
for (let i = 0; i < len; i++) sum += d[i] * d[i];
const rms = Math.sqrt(sum / len) || 1, target = 0.001; // 約 -60dBFS
for (let i = 0; i < len; i++) d[i] *= target / rms;
const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
src.connect(lp); lp.connect(audioCtx.destination);
src.start();
keepNode = src;
diag('keep-on');
} catch (e) {}
}

/* ---------- 音（iOS Safari 対応） ---------- */
function unlockAudio() {
if (!audioCtx) {
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
audioCtx = new AC();
// 他のアプリ（音楽など）に音を取られて止まった後、戻ったら予約をし直す
audioCtx.onstatechange = () => {
diag('ac-state', audioCtx.state);
if (audioCtx.state === 'running') { if (run.active && !run.paused && !run.finished) { scheduleAhead(); keepAlive(true); } }
else if (run.active && !run.paused) { bgSched = false; try { audioCtx.resume(); } catch (e) {} }
};
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
if (audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) {} }
const t = audioCtx.currentTime + (at || 0) + schedOff;
const osc = audioCtx.createOscillator();
if (schedOff > 0) schedNodes.push({ o: osc, t, ev: audioCtx.currentTime + schedOff });
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
let opts = { auto: true, remind: 0, notify: true, silent: false, keep: true };
try {
const ov = JSON.parse(localStorage.getItem(OPT_KEY) || 'null');
if (ov) {
if (typeof ov.auto === 'boolean') opts.auto = ov.auto;
if ([0, 1, 2, 5].includes(ov.remind)) opts.remind = ov.remind;
if (typeof ov.notify === 'boolean') opts.notify = ov.notify;
if (typeof ov.silent === 'boolean') opts.silent = ov.silent;
if (typeof ov.keep === 'boolean') opts.keep = ov.keep;
}
} catch (e) {}
function saveOpts() { try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {} }
const canNotify = () => 'Notification' in window;
function notify(body, sticky) {
if (!opts.notify || !canNotify() || Notification.permission !== 'granted') return;
// 画面を見ているとき（表示中かつ操作中のウィンドウ）は音と表示だけ。裏の別ウィンドウ・最小化・別タブでは通知
if (document.visibilityState === 'visible' && document.hasFocus()) return;
const title = typeof BRAND === 'string' ? BRAND : 'TimerTrain';
const o = { body: String(body), tag: 'timertrain', renotify: true, icon: DT ? '/donut/icon-192.png' : '/icon-192.png',
requireInteraction: !!sticky, data: { url: location.pathname + location.search } };
try {
if (navigator.serviceWorker && navigator.serviceWorker.controller) {
navigator.serviceWorker.ready.then(r => r.showNotification(title, o)).catch(() => {});
} else { new Notification(title, o); }
} catch (e) {}
}

/* 通知の案内: 許可をまだ聞いていない人に、初めて開始したとき1回だけ */
const ASK_KEY = 'tt-notify-ask';
async function enableNotify() {
let p = Notification.permission;
if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
const sw = document.getElementById('opt-notify');
if (p !== 'granted') { opts.notify = false; saveOpts(); if (sw) sw.checked = false; if (p === 'denied') toast(STR.notifyBlocked); return false; }
opts.notify = true; saveOpts(); if (sw) sw.checked = true;
if (window.gtag) gtag('event', 'notify_on');
return true;
}
function askSilentOnce() {
const K = 'tt-silent-ask';
try { if (!IS_IOS || opts.silent || localStorage.getItem(K)) return; } catch (e) { return; }
if (document.getElementById('tt-ask')) return;
const box = document.createElement('div'); box.id = 'tt-ask'; box.className = 'tt-ask'; box.setAttribute('role', 'status');
const tx = document.createElement('p'); tx.textContent = STR.askSilent;
const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'tt-ask-yes'; yes.textContent = STR.askYes;
const no = document.createElement('button'); no.type = 'button'; no.className = 'tt-ask-no'; no.textContent = STR.askNo;
const close = v => { try { localStorage.setItem(K, v); } catch (e) {} box.remove(); };
yes.addEventListener('click', () => {
close('yes'); opts.silent = true; saveOpts();
const sw = document.getElementById('opt-silent'); if (sw) sw.checked = true;
applySilentMode(run.active && !run.paused && !run.finished); unlockAudio();
if (window.gtag) gtag('event', 'silent_on');
});
no.addEventListener('click', () => close('no'));
const btns = document.createElement('div'); btns.className = 'tt-ask-btns'; btns.append(yes, no);
box.append(tx, btns);
const ctr = document.querySelector('.run-controls');
if (ctr) ctr.insertAdjacentElement('afterend', box);
}
function askNotifyOnce() {
if (IS_IOS) { askSilentOnce(); if (document.getElementById('tt-ask')) return; }
try {
if (!canNotify() || Notification.permission !== 'default' || localStorage.getItem(ASK_KEY)) return;
} catch (e) { return; }
if (document.getElementById('tt-ask')) return;
// 通知は最初からオン: 初めて再生したとき（ボタンを押した流れのまま）、ブラウザの許可を直接たずねる
if (opts.notify) { try { localStorage.setItem(ASK_KEY, 'auto'); } catch (e) {} enableNotify(); return; }
const box = document.createElement('div'); box.id = 'tt-ask'; box.className = 'tt-ask'; box.setAttribute('role', 'status');
const tx = document.createElement('p'); tx.textContent = STR.askNotify;
const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'tt-ask-yes'; yes.textContent = STR.askYes;
const no = document.createElement('button'); no.type = 'button'; no.className = 'tt-ask-no'; no.textContent = STR.askNo;
const close = v => { try { localStorage.setItem(ASK_KEY, v); } catch (e) {} box.remove(); };
yes.addEventListener('click', async () => { close('yes'); await enableNotify(); });
no.addEventListener('click', () => { close('no'); if (window.gtag) gtag('event', 'notify_ask_no'); });
const btns = document.createElement('div'); btns.className = 'tt-ask-btns'; btns.append(yes, no);
box.append(tx, btns);
const ctr = document.querySelector('.run-controls');
if (ctr) ctr.insertAdjacentElement('afterend', box);
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
// 12時から時計回りに減る（ドーナツと同じ向き）: 残りは「端 → 12時」の部分
ringFg.style.strokeDashoffset = -RING_C * (1 - Math.min(1, Math.max(0, frac)));
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
name.autocomplete = 'off';
name.addEventListener('change', () => { t.name = name.value; persist(); });

// ラベルの選択肢（ログイン中。これまでのラベル＋鉛筆で名前変更・休憩・選択肢から消す）
const dd = document.createElement('button');
dd.type = 'button';
dd.className = 'lbl-dd';
dd.setAttribute('aria-label', LBL.open);
dd.setAttribute('aria-expanded', 'false');
dd.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
dd.hidden = !window.__ttLabels;
dd.addEventListener('click', e => { e.stopPropagation(); openLabelPop(li, t, name, dd); });

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

li.append(dot, name, dd, time, dup, del, handle);
listEl.appendChild(li);
});
updateTotal();
updateHighlight();
}

/* ---------- ラベルの選択肢（▾）と編集（鉛筆） ---------- */
const LBL = LANG === 'en' ? { open: 'Choose a label', edit: l => 'Edit ' + l, none: 'No labels yet. Labels you use with a timer or button appear here.', name: 'Name', note: 'Renaming also renames this label in your past records.', brk: 'Treat as a break (not counted in totals)', save: 'Save', cancel: 'Cancel', hide: 'Remove from this list (records are kept)', hideSure: 'Tap again to remove', err: 'Could not save. Please try again.' }
: LANG === 'es' ? { open: 'Elegir etiqueta', edit: l => 'Editar ' + l, none: 'Aún no hay etiquetas. Aquí aparecen las que uses en temporizadores o botones.', name: 'Nombre', note: 'Al cambiar el nombre, también cambia en tus registros anteriores.', brk: 'Tratar como descanso (no suma al total)', save: 'Guardar', cancel: 'Cancelar', hide: 'Quitar de esta lista (los registros se conservan)', hideSure: 'Toca otra vez para quitar', err: 'No se pudo guardar. Inténtalo de nuevo.' }
: { open: 'ラベルを選ぶ', edit: l => l + 'を編集', none: 'まだラベルはありません。タイマーやボタンで使った名前がここに並びます。', name: 'なまえ', note: '変えると、これまでの記録もこの名前で集計されます。', brk: '休憩として扱う（合計に入れない）', save: '保存', cancel: 'キャンセル', hide: '選択肢から消す（記録は残ります）', hideSure: 'もう一度押すと消します', err: '保存できませんでした。もう一度お試しください。' };
const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
function lblEl(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function lblKey(e) { if (e.key === 'Escape') { const p = document.querySelector('.lbl-pop'); const b = p && p.__dd; closeLabelPop(); if (b) b.focus(); } }
function lblOutside(e) { const p = document.querySelector('.lbl-pop'); if (p && !p.contains(e.target) && e.target !== p.__dd && !(p.__dd && p.__dd.contains(e.target))) closeLabelPop(); }
function closeLabelPop() {
const p = document.querySelector('.lbl-pop');
if (p) { if (p.__dd) p.__dd.setAttribute('aria-expanded', 'false'); p.remove(); }
document.removeEventListener('keydown', lblKey);
document.removeEventListener('click', lblOutside);
}
function openLabelPop(li, t, name, dd) {
const was = document.querySelector('.lbl-pop');
const same = was && was.__dd === dd;
closeLabelPop();
if (same || !window.__ttLabels) return;
const pop = lblEl('li', 'lbl-pop');
pop.__dd = dd;
dd.setAttribute('aria-expanded', 'true');
renderLabelList(pop, t, name);
li.after(pop);
document.addEventListener('keydown', lblKey);
setTimeout(() => document.addEventListener('click', lblOutside), 0);
}
function renderLabelList(pop, t, name) {
const L = window.__ttLabels;
pop.textContent = '';
const labels = L.list();
if (!labels.length) { pop.appendChild(lblEl('p', 'lbl-empty', LBL.none)); return; }
const ul = lblEl('ul', 'lbl-list');
ul.setAttribute('aria-label', LBL.open);
labels.forEach(l => {
const row = lblEl('li', 'lbl-row' + (l === name.value ? ' on' : ''));
const pick = lblEl('button', 'lbl-pick'); pick.type = 'button';
pick.appendChild(lblEl('span', 'lbl-sw' + (L.isBreak(l) ? ' b' : '')));
pick.appendChild(lblEl('span', 'lbl-name', l));
if (l === name.value) pick.setAttribute('aria-current', 'true');
pick.addEventListener('click', () => { name.value = l; t.name = l; persist(); closeLabelPop(); name.focus(); });
const ed = lblEl('button', 'lbl-edit'); ed.type = 'button';
ed.setAttribute('aria-label', LBL.edit(l));
ed.innerHTML = PENCIL;
ed.addEventListener('click', e => { e.stopPropagation(); renderLabelEdit(pop, t, name, l); });
row.append(pick, ed);
ul.appendChild(row);
});
pop.appendChild(ul);
}
function renderLabelEdit(pop, t, name, l) {
const L = window.__ttLabels;
pop.textContent = '';
const f = lblEl('div', 'lbl-form');
const lab = lblEl('label', 'lbl-l', LBL.name); lab.htmlFor = 'lbl-in';
const inp = lblEl('input', 'lbl-in'); inp.type = 'text'; inp.id = 'lbl-in'; inp.maxLength = 30; inp.value = l; inp.autocomplete = 'off';
const note = lblEl('p', 'lbl-note', LBL.note);
const cbl = lblEl('label', 'lbl-chk');
const cb = lblEl('input'); cb.type = 'checkbox'; cb.checked = L.isBreak(l);
cbl.append(cb, lblEl('span', '', LBL.brk));
const msg = lblEl('p', 'lbl-note'); msg.setAttribute('role', 'status');
const acts = lblEl('div', 'lbl-acts');
const ok = lblEl('button', 'lbl-btn pri', LBL.save); ok.type = 'button';
const cancel = lblEl('button', 'lbl-btn', LBL.cancel); cancel.type = 'button';
const hide = lblEl('button', 'lbl-hide', LBL.hide); hide.type = 'button';
cancel.addEventListener('click', e => { e.stopPropagation(); renderLabelList(pop, t, name); });
ok.addEventListener('click', async e => {
e.stopPropagation();
const v = inp.value.trim().slice(0, 30);
if (!v) { inp.focus(); return; }
const patch = { name: l };
if (v !== l) patch.rename = [l, v];
if (cb.checked !== L.isBreak(l)) patch.brk = cb.checked ? 1 : 0;
if (!patch.rename && patch.brk === undefined) { renderLabelList(pop, t, name); return; }
ok.disabled = true;
const r = await L.save(patch);
if (!r) { ok.disabled = false; msg.textContent = LBL.err; return; }
if (patch.rename) {
// いまの編成の中の同じ名前も変える
state.timers.forEach(x => { if (x.name === l) x.name = v; });
persist(); closeLabelPop(); renderList();
} else renderLabelList(pop, t, name);
});
let armed = false;
hide.addEventListener('click', async e => {
e.stopPropagation();
if (!armed) { armed = true; hide.textContent = LBL.hideSure; return; }
hide.disabled = true;
const r = await L.save({ hide: l });
if (!r) { hide.disabled = false; msg.textContent = LBL.err; return; }
renderLabelList(pop, t, name);
});
inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ok.click(); } });
acts.append(ok, cancel);
f.append(lab, inp, note, cbl, acts, hide, msg);
pop.appendChild(f);
setTimeout(() => { inp.focus(); inp.select(); }, 0);
}
window.__ttRerenderList = function () { closeLabelPop(); renderList(); };

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
closeLabelPop();
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
applySilentMode(true);
unlockAudio();
if (window.gtag) gtag('event', 'timer_start', { via: startVia });
startVia = 'play';
if (window.__ttOnStart) { try { window.__ttOnStart(); } catch (e) {} }
run = { active: true, paused: false, finished: false, idx: 0, cycle: 1,
endAt: Date.now() + state.timers[0].secs * 1000, remainMs: 0, lastSec: -1 };
snapRun();
acquireWakeLock();
pauseBtn.innerHTML = ICONS.pause;
runTime.classList.remove('finished');
renderStations();
updateHighlight();
clearInterval(tickId);
tickId = setInterval(tick, 200);
tick();
scheduleAhead();
keepAlive(true);
diag('start', state.timers.length);
saveRun();
askNotifyOnce();
}
// 停止＝最初に戻る（待機状態: 1つ目のタイマーをリングにプレビュー）
function resetToIdle() {
if (window.__ttOnStop) { try { window.__ttOnStop(); } catch (e) {} }
clearInterval(tickId); tickId = null;
cancelSched();
keepAlive(false);
diag('reset');
run = { active: false, paused: true, finished: false, idx: 0, cycle: 1, endAt: 0, remainMs: 0, lastSec: -1 };
saveRun();
applySilentMode(false);
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
/* 動いている途中で編成を変えても、止めずに続ける（2026-11-05）
 * いま動いているタイマーを id で追いかける。時間を変えたら経過分はそのままで残りを合わせる。
 * いまのタイマーを消したら次のタイマーへ。くり返し回数を減らしたら今の周を最後にする */
let runSnap = null; // 前回の編成（id → 秒数、並び順）
function snapRun() { runSnap = { ids: state.timers.map(t => t.id), secs: Object.fromEntries(state.timers.map(t => [t.id, t.secs])) }; }
function reconcileRun() {
const n = state.timers.length;
if (!n) { resetToIdle(); return; }
const snap = runSnap || { ids: [], secs: {} };
const curId = snap.ids[run.idx];
const now = Date.now();
const remainOf = () => run.paused ? run.remainMs : Math.max(0, run.endAt - now);
const setRemain = ms => { if (run.paused) run.remainMs = ms; else run.endAt = now + ms; };
let ni = curId ? state.timers.findIndex(t => t.id === curId) : -1;
if (ni >= 0) {
run.idx = ni;
const oldMs = (snap.secs[curId] || state.timers[ni].secs) * 1000, newMs = state.timers[ni].secs * 1000;
if (oldMs !== newMs) {
const left = newMs - (oldMs - remainOf());
if (left > 0) setRemain(left);
else setRemain(0); // もう過ぎた → 次の tick で次のタイマーへ（音あり）
run.lastSec = -1;
if (opts.remind && left > opts.remind * 60000) run.reminded = false;
}
} else {
// いまのタイマーが消えた → 同じ位置に来たタイマー（なければ次の周）を最初から
if (window.__ttOnSeg) { try { window.__ttOnSeg(); } catch (e) {} }
let i = Math.min(run.idx, n);
if (i >= n) {
if (state.repeat === Infinity || run.cycle < state.repeat) { run.cycle++; i = 0; }
else { snapRun(); finish(); return; }
}
run.idx = i; run.lastSec = -1; run.reminded = false;
setRemain(state.timers[i].secs * 1000);
}
if (state.repeat !== Infinity && run.cycle > state.repeat) run.cycle = state.repeat;
snapRun();
renderStations();
updateHighlight();
updateRunView();
updateEta();
if (!run.paused) scheduleAhead(1.5);
saveRun();
}
function configChanged() {
if (run.active && !run.finished) reconcileRun();
else if (run.active) resetToIdle();
else updateIdleView();
}
function pauseToggle() {
if (!run.active || run.finished) return;
// 一時停止・再開の直前に知らせる（利用記録が、止まっていた時間を数えないように）
if (window.__ttOnPause) { try { window.__ttOnPause(); } catch (e) {} }
if (run.paused) {
applySilentMode(true);
unlockAudio();
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
scheduleAhead();
keepAlive(!run.paused);
diag(run.paused ? 'pause' : 'resume');
saveRun();
}
function skip() {
if (!run.active || run.finished) return;
advance(false);
scheduleAhead();
saveRun();
}
function resetRun() { resetToIdle(); }
/* 細かい早送り・巻き戻し（いまの区切りの中だけ）。利用記録は実際に動いた時間で数えるので、ここでは変わらない */
function seekTo(remMs) {
if (!run.active || run.finished) return;
const full = state.timers[run.idx].secs * 1000;
if (remMs <= 0) { skip(); return; }
remMs = Math.min(full, remMs);
if (run.paused) run.remainMs = remMs; else run.endAt = Date.now() + remMs;
run.lastSec = -1;
if (opts.remind && remMs > opts.remind * 60000) run.reminded = false;
updateRunView();
updateEta();
if (!run.paused) scheduleAhead();
saveRun();
}
function curRemain() { return run.paused ? run.remainMs : Math.max(0, run.endAt - Date.now()); }
function seek(ms) {
if (!run.active || run.finished) return;
seekTo(curRemain() - ms);
diag('seek', ms);
}
function advance(withSound) {
// 区切りが変わる直前に知らせる（利用記録で区切りごとの時間を数えるため）
if (window.__ttOnSeg) { try { window.__ttOnSeg(); } catch (e) {} }
const now = Date.now();
// 時間切れで進むときは本来の区切り時刻から数える（裏のタブで処理が遅れても後ろにずれない）
const base = withSound && !run.paused && run.endAt > 0 ? Math.min(run.endAt, now) : now;
if (run.idx + 1 < state.timers.length) {
run.idx++;
} else if (state.repeat === Infinity || run.cycle < state.repeat) {
run.cycle++; run.idx = 0;
} else {
finish(); return;
}
if (withSound) {
const nx = state.timers[run.idx];
if (!lateAdvance) {
if (!bgSched) soundSegment();
notify(STR.nNext(nx.name || STR.defName));
}
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
else run.endAt = base + state.timers[run.idx].secs * 1000;
renderStations();
updateHighlight();
updateRunView();
// 音の予約を今の時刻に合わせ直す（鳴り始めた音は残す）
if (withSound && !run.paused) scheduleAhead(1.5);
saveRun();
}
function finish() {
diag('finish', Date.now() - run.endAt);
keepAlive(false);
if (!bgSched && !lateAdvance) soundFinish();
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
saveRun();
if (!lateAdvance) notify(STR.nDone, true);
setTimeout(() => { if (run.finished) applySilentMode(false); }, 4000);
if (window.__ttOnFinish) { try { window.__ttOnFinish(); } catch (e) {} }
if (window.__ttPromoFinish) setTimeout(function () { if (run.finished) { try { window.__ttPromoFinish(); } catch (e) {} } }, 800);
}
function tick() {
if (!run.active || run.paused || run.finished) return;
const remain = run.endAt - Date.now();
if (remain <= 0) {
let guard = 0, late = 0;
do {
// 区切りの時刻から2秒以上たってから気づいた（スマホで別のアプリを見ていて止められていた等）なら、音と通知は出さない
lateAdvance = Date.now() - run.endAt > 2000;
diag('seg', (run.idx + 1) + '/' + (Date.now() - run.endAt) + (bgSched ? ' sched' : ''));
if (lateAdvance) late++;
advance(true);
} while (run.active && !run.paused && !run.finished && run.endAt - Date.now() <= 0 && ++guard < 500);
lateAdvance = false;
if (late) { diag('caught', late); toast(STR.caught(late)); if (run.active && !run.paused && !run.finished) scheduleAhead(); }
return;
}
const sec = Math.ceil(remain / 1000);
if (sec !== run.lastSec) {
run.lastSec = sec;
if (sec <= 3 && !bgSched) soundTick();
const t = state.timers[run.idx];
if (opts.remind && !run.reminded && t.secs > opts.remind * 60 + 5 && sec <= opts.remind * 60 && sec > 3) {
run.reminded = true;
if (!bgSched) { soundTick(); setTimeout(soundTick, 250); }
notify(STR.nSoon(t.name || STR.defName, opts.remind));
}
}
updateRunView();
}
/* ---------- バックグラウンド（別のタブ・アプリを見ている間）----------
 * ブラウザは裏のタブの setInterval を間引く（5分以上で1分に1回程度まで）。
 * WebAudio の時計は間引かれないので、裏に回ったら
 *  1) 先の区切り・終了・カウントダウン・終了前のお知らせの音を、その時刻に鳴るよう予約しておく
 *  2) 次の区切りの時刻に終わる無音の音を鳴らし、その終了の合図で切り替えと通知を行う
 * 画面に戻ったら予約を取り消し、通常の動きに戻す。 */
function atAudio(secFromNow, fn) {
if (secFromNow < 0.05 || secFromNow <= schedKeep) return;
schedOff = secFromNow;
try { fn(); } finally { schedOff = 0; }
}
function cancelSched(keep) {
const now = audioCtx ? audioCtx.currentTime : 0;
const lim = now + (keep || 0.02);
// keep 秒以内に鳴り始める音（鳴っている途中の音を含む）は残す
const left = [];
schedNodes.forEach(n => {
if (n.ev > lim) { try { n.o.stop(0); n.o.disconnect(); } catch (e) {} }
else if (n.t > now - 2) left.push(n);
});
schedNodes = left;
if (wakeNode) { try { wakeNode.onended = null; wakeNode.stop(0); wakeNode.disconnect(); } catch (e) {} wakeNode = null; }
bgSched = false;
}
function remindAt(t, startMs, endMs, reminded) {
if (!opts.remind || reminded || t.secs <= opts.remind * 60 + 5) return null;
const at = endMs - opts.remind * 60000;
return at > startMs && at > 3000 ? at : null;
}
let schedKeep = 0;
function scheduleAhead(keep) {
keep = keep || 0;
cancelSched(keep);
if (!audioCtx || !masterGain || !run.active || run.paused || run.finished) return;
// 音が止まっている（ブラウザの制限・他のアプリに取られた）間は予約できないので、画面側で鳴らす
if (audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) {} return; }
bgSched = true;
schedKeep = keep;
const S = SOUNDS[sound.s];
const extras = (t, startMs, endMs, reminded) => {
[3, 2, 1].forEach(k => { const at = endMs - k * 1000; if (at > startMs) atAudio(at / 1000, () => S.tick()); });
const r = remindAt(t, startMs, endMs, reminded);
if (r !== null) { atAudio(r / 1000, () => S.tick()); atAudio(r / 1000 + 0.25, () => S.tick()); }
};
let endMs = Math.max(0, run.endAt - Date.now());
let idx = run.idx, cycle = run.cycle;
extras(state.timers[idx], 0, endMs, run.reminded);
for (let n = 0; n < 60 && endMs < 6 * 3600e3; n++) {
let ni = idx + 1, nc = cycle;
if (ni >= state.timers.length) {
if (state.repeat === Infinity || cycle < state.repeat) { ni = 0; nc = cycle + 1; }
else { atAudio(endMs / 1000, () => S.fin()); break; }
}
atAudio(endMs / 1000, () => S.seg());
if (!opts.auto) break; // 1つごとに止まる設定なら、次の区切りまで
idx = ni; cycle = nc;
const t = state.timers[idx], start = endMs;
endMs += t.secs * 1000;
extras(t, start, endMs, false);
}
schedKeep = 0;
scheduleWake();
}
// 次に処理が必要な時刻（区切り、または終了前のお知らせ）に終わる無音の音で、処理を起こす
function scheduleWake() {
if (wakeNode) { try { wakeNode.onended = null; wakeNode.stop(0); wakeNode.disconnect(); } catch (e) {} wakeNode = null; }
if (!bgSched || !run.active || run.paused || run.finished) return;
const remain = Math.max(0, run.endAt - Date.now());
let next = remain;
const r = remindAt(state.timers[run.idx], 0, remain, run.reminded);
if (r !== null && r < next) next = r;
try {
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
g.gain.value = 0;
o.connect(g); g.connect(audioCtx.destination);
o.onended = () => { if (wakeNode !== o) return; wakeNode = null; diag('wake', Date.now() - run.endAt); tick(); scheduleWake(); };
o.start();
o.stop(audioCtx.currentTime + next / 1000 + 0.03);
wakeNode = o;
} catch (e) {}
}
document.addEventListener('visibilitychange', () => {
if (document.visibilityState === 'visible') {
tick(); // 遅れていた切り替えを追いつかせる（音は予約済みなので重ねない）
if (run.active && !run.finished) { updateRunView(); updateEta(); }
if (run.active && !run.paused && !run.finished && !bgSched) scheduleAhead();
} else {
if (run.active && !run.paused && !run.finished && !bgSched) scheduleAhead();
saveRun();
}
});
// ブラウザがタブを一時停止（freeze）→再開したとき、bfcache から戻ったとき
document.addEventListener('freeze', saveRun);
document.addEventListener('resume', () => { tick(); if (run.active && !run.paused && !run.finished) scheduleAhead(1.5); });
window.addEventListener('pageshow', e => { if (e.persisted) { tick(); if (run.active && !run.paused && !run.finished) scheduleAhead(1.5); } });
window.addEventListener('pagehide', saveRun);
/* なめらかな表示: 画面を見ている間は毎フレーム、リング／ドーナツを残り時間どおりに描く（短いタイマーでもカクカクしない） */
let rafId = 0;
function frame() {
rafId = 0;
if (!run.active || run.paused || run.finished || document.visibilityState !== 'visible') { if (ringFg) ringFg.style.transition = ''; return; }
// 毎フレーム描くので、リングの遅れ（CSS の transition）はなくす
if (ringFg && !DT) ringFg.style.transition = 'stroke .3s ease';
const remain = run.endAt - Date.now();
if (remain <= 0) tick(); // 区切りはすぐに切り替える（200ms 待たない）
if (run.active && !run.paused && !run.finished) {
const t = state.timers[run.idx];
setRing(Math.max(0, run.endAt - Date.now()) / (t.secs * 1000), colorOf(t.color));
}
rafId = requestAnimationFrame(frame);
}
function startFrames() { if (!rafId && typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(frame); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') startFrames(); });
function updateRunView() {
if (run.finished) return;
if (!run.paused) startFrames();
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
window.__ttToast = toast;

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
sel.addEventListener('change', () => { sound.s = SOUNDS[sel.value] ? sel.value : 'chime'; saveSound(); paint(); preview(); if (run.active) scheduleAhead(); if (window.gtag) gtag('event', 'sound_change', { sound: sound.s }); });
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
autoSw.addEventListener('change', () => { opts.auto = autoSw.checked; saveOpts(); if (run.active) scheduleAhead(); });
mkRow(STR.auto, STR.autoNote, autoSw, 'opt-auto');
const rem = document.createElement('select'); rem.id = 'opt-remind'; rem.className = 'tt-select';
[0, 1, 2, 5].forEach(n => { const o = document.createElement('option'); o.value = String(n); o.textContent = n ? STR.remindMin(n) : STR.remindOff; rem.appendChild(o); });
rem.value = String(opts.remind);
rem.addEventListener('change', () => { opts.remind = parseInt(rem.value, 10) || 0; saveOpts(); if (run.active) scheduleAhead(); });
mkRow(STR.remind, '', rem, 'opt-remind');
if (KEEP_OK) {
const kSw = sw('opt-keep', opts.keep);
kSw.addEventListener('change', () => { opts.keep = kSw.checked; saveOpts(); keepAlive(run.active && !run.paused && !run.finished); if (window.gtag) gtag('event', kSw.checked ? 'keep_on' : 'keep_off'); });
mkRow(STR.keep, STR.keepNote, kSw, 'opt-keep');
}
if (IS_IOS) {
const sSw = sw('opt-silent', opts.silent);
sSw.addEventListener('change', () => {
opts.silent = sSw.checked; saveOpts();
try { localStorage.setItem('tt-silent-ask', 'set'); } catch (e) {}
applySilentMode(run.active && !run.paused && !run.finished); unlockAudio();
if (sSw.checked) { soundSegment(); if (window.gtag) gtag('event', 'silent_on'); }
});
mkRow(STR.silent, STR.silentNote, sSw, 'opt-silent');
}
if (canNotify()) {
const nSw = sw('opt-notify', opts.notify && Notification.permission === 'granted');
nSw.addEventListener('change', async () => {
if (!nSw.checked) { opts.notify = false; saveOpts(); return; }
try { localStorage.setItem(ASK_KEY, 'set'); } catch (e) {}
const a = document.getElementById('tt-ask'); if (a) a.remove();
await enableNotify();
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
/* すぐ始める（ページに #tt-quick があるときだけ）: 押すとその編成に切り替えて、そのまま開始 */
(function () {
const box = document.getElementById('tt-quick');
if (!box) return;
box.addEventListener('click', e => {
const a = e.target.closest && e.target.closest('a[data-q]');
if (!a) return;
const href = a.getAttribute('href') || '';
const i = href.indexOf('?');
const c = i < 0 ? null : parseConfig(href.slice(i));
if (!c) return; // 読めないときは普通のリンクとして開く
e.preventDefault();
if (run.active) resetToIdle();
state = c;
persist(); renderList();
startVia = 'quick_' + String(a.dataset.q || '').replace(/[^a-z0-9_]/gi, '').slice(0, 20);
startRun();
});
})();
$('skip-btn').addEventListener('click', skip);
$('reset-btn').addEventListener('click', resetRun);
function resetAndGo() { resetToIdle(); startRun(); }

let seekKeyed = false;
document.addEventListener('keydown', e => {
if (e.target.tagName === 'INPUT') return;
if (e.code === 'Space') {
e.preventDefault();
if (!run.active) { startVia = 'key'; startRun(); }
else if (run.finished) resetAndGo();
else pauseToggle();
}
if (!run.active) return;
if (e.key === 's' || e.key === 'S') skip();
if (e.key === 'r' || e.key === 'R') resetRun();
if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.metaKey && !e.ctrlKey && !e.altKey
&& !/^(SELECT|TEXTAREA)$/.test(e.target.tagName) && !e.target.isContentEditable && !document.documentElement.classList.contains('ttd-open')) {
e.preventDefault();
const step = (e.shiftKey ? 60000 : 10000) * (e.key === 'ArrowRight' ? 1 : -1);
seek(step);
if (window.gtag && !seekKeyed) { seekKeyed = true; gtag('event', 'seek_key'); }
}
if (e.key === 'Escape') resetToIdle();
});

/* ---------- リング／ドーナツの縁をドラッグして残り時間を合わせる ----------
 * リング・ドーナツとも、12時から時計回りに減っていく端 → 残り = 1 − 角度の割合
 * スマホは画面のスクロールと区別するため、縁を約0.35秒押してから動かす */
(function () {
const wrap = document.querySelector('.ring-wrap');
if (!wrap) return;
const SEEK_T = LANG === 'en' ? 'Drag the edge to adjust the time · ← → 10 s (Shift: 1 min)'
: LANG === 'es' ? 'Arrastra el borde para ajustar el tiempo · ← → 10 s (Mayús: 1 min)'
: '縁をドラッグで時間を調整 · ← → で10秒（Shift で1分）';
function live() { return run.active && !run.finished; }
function sync() { wrap.classList.toggle('seekable', live()); if (live()) wrap.title = SEEK_T; else wrap.removeAttribute('title'); }
setInterval(sync, 500);
function geo(x, y) {
const r = wrap.getBoundingClientRect();
const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
let a = Math.atan2(dx, -dy) / (2 * Math.PI); if (a < 0) a += 1; // 12時=0、時計回り
return { a: a, band: d > R * 0.66 && d < R * 1.12 };
}
let drag = null;
function begin(x, y) {
const g = geo(x, y);
if (!live() || !g.band) return false;
const t = state.timers[run.idx];
// いまの端の位置から始める（つかんだ場所に飛ばない）
const frac = curRemain() / (t.secs * 1000);
drag = { last: 1 - frac, moved: false };
wrap.classList.add('seeking');
return true;
}
function move(x, y) {
if (!drag || !live()) return;
let a = geo(x, y).a;
// 12時をまたいだら端で止める（一周回って反対側に飛ばない）
if (a - drag.last > 0.5) a = 0; else if (drag.last - a > 0.5) a = 1;
if (Math.abs(a - drag.last) < 0.0005) return;
drag.last = a; drag.moved = true;
const full = state.timers[run.idx].secs * 1000;
const frac = 1 - a;
// 1秒単位に丸める（最後は少しでも残す。0 にすると次へ進む）
let rem = Math.round(frac * full / 1000) * 1000;
if (frac >= 0.999) rem = full;
seekTo(Math.max(1000, rem));
}
function end() {
if (!drag) return;
if (drag.moved && window.gtag) gtag('event', 'seek_drag');
drag = null; wrap.classList.remove('seeking');
}
// マウス・ペン
wrap.addEventListener('pointerdown', e => {
if (e.pointerType === 'touch' || e.button !== 0) return;
if (!begin(e.clientX, e.clientY)) return;
e.preventDefault();
try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
});
wrap.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && drag) move(e.clientX, e.clientY); });
wrap.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') end(); });
wrap.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') end(); });
// タッチ: 長押しで開始し、そのあとはスクロールを止める
let hold = null, sx = 0, sy = 0;
wrap.addEventListener('touchstart', e => {
if (e.touches.length !== 1 || !live()) return;
const t0 = e.touches[0]; sx = t0.clientX; sy = t0.clientY;
if (!geo(sx, sy).band) return;
clearTimeout(hold);
hold = setTimeout(() => { hold = null; if (begin(sx, sy)) { try { navigator.vibrate && navigator.vibrate(10); } catch (err) {} } }, 350);
}, { passive: true });
wrap.addEventListener('touchmove', e => {
const t0 = e.touches[0];
if (drag) { e.preventDefault(); move(t0.clientX, t0.clientY); return; }
if (hold && Math.hypot(t0.clientX - sx, t0.clientY - sy) > 10) { clearTimeout(hold); hold = null; }
}, { passive: false });
wrap.addEventListener('touchend', () => { clearTimeout(hold); hold = null; end(); });
wrap.addEventListener('touchcancel', () => { clearTimeout(hold); hold = null; end(); });
wrap.addEventListener('contextmenu', e => { if (drag || hold) e.preventDefault(); });
})();

/* ---------- 起動 ---------- */
load();
renderList();
pauseBtn.innerHTML = ICONS.play;
persist(); // configChanged() 経由で待機ビュー（リングプレビュー）も描画される
restoreRun();
function restoreRun() {
let s = null;
try { s = JSON.parse(sessionStorage.getItem(RUN_KEY) || 'null'); } catch (e) {}
if (!s || s.q !== serialize()) return;
const n = state.timers.length;
if (!(s.idx >= 0 && s.idx < n) || !(s.cycle >= 1) || Date.now() - s.at > 12 * 3600e3) { try { sessionStorage.removeItem(RUN_KEY); } catch (e) {} return; }
run = { active: true, paused: !!s.paused, finished: false, idx: s.idx, cycle: s.cycle,
endAt: s.paused ? 0 : s.endAt, remainMs: s.paused ? Math.max(0, s.remainMs) : 0, lastSec: -1, reminded: !!s.reminded };
snapRun();
pauseBtn.innerHTML = run.paused ? ICONS.play : ICONS.pause;
renderStations(); updateHighlight();
// 閉じていた間に過ぎた区切りは音を鳴らさずに進める
let guard = 0;
lateAdvance = true;
while (!run.paused && !run.finished && run.endAt - Date.now() <= 0 && ++guard < 2000) advance(true);
lateAdvance = false;
if (run.finished) return;
updateRunView(); updateEta();
clearInterval(tickId); tickId = setInterval(tick, 200);
if (!run.paused) acquireWakeLock();
window.__ttRestored = true; // 利用記録（sync.js）が読み込まれたら記録を始め直す
toast(STR.restored);
// 音はブラウザの決まりで、画面を一度さわるまで鳴らせないことがある
unlockAudio();
const wake = () => { if (run.active && !run.paused && !run.finished) applySilentMode(true); unlockAudio(); if (run.active && !run.paused && !run.finished) scheduleAhead(); };
document.addEventListener('pointerdown', wake, { once: true });
document.addEventListener('keydown', wake, { once: true });
if (audioCtx && audioCtx.state !== 'running') setTimeout(() => { if (audioCtx && audioCtx.state !== 'running') toast(STR.tapSound); }, 2000);
else scheduleAhead();
}

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
var ctrls = runSec.querySelector('.run-controls');
(ctrls || runSec).appendChild(btn);

var hint = document.createElement('p');
hint.className = 'kbd-hint';
hint.innerHTML = lang === 'en'
? '<kbd>Space</kbd> start / pause · <kbd>S</kbd> skip · <kbd>←</kbd><kbd>→</kbd> 10 s (Shift: 1 min) · <kbd>R</kbd> reset · <kbd>F</kbd> focus mode'
: lang === 'es'
? '<kbd>Espacio</kbd> iniciar / pausar · <kbd>S</kbd> saltar · <kbd>←</kbd><kbd>→</kbd> 10 s (Mayús: 1 min) · <kbd>R</kbd> reiniciar · <kbd>F</kbd> concentración'
: '<kbd>Space</kbd> 開始・一時停止 · <kbd>S</kbd> スキップ · <kbd>←</kbd><kbd>→</kbd> 10秒（Shiftで1分） · <kbd>R</kbd> リセット · <kbd>F</kbd> 集中モード';
runSec.appendChild(hint);

function isOn() { return document.body.classList.contains('focus-mode'); }
function paint() {
var on = isOn();
btn.innerHTML = (on ? IC_OFF : IC_ON) + '<span>' + (on ? L.off : L.on) + '</span>';
btn.setAttribute('aria-pressed', on ? 'true' : 'false');
btn.setAttribute('aria-label', on ? L.off : L.on);
btn.title = on ? L.off : L.on;
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
a.href = '/account?l=' + (['en', 'es'].indexOf(lang) >= 0 ? lang : 'ja') + (window.DT ? '&from=donut' : '');
var ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
ic.setAttribute('viewBox', '0 0 24 24'); ic.setAttribute('aria-hidden', 'true');
var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
path.setAttribute('d', 'M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1a2 2 0 002 2h12a2 2 0 002-2v-1c0-2.8-3.6-5-8-5z');
ic.appendChild(path);
var sp = document.createElement('span'); sp.textContent = signed ? L.me : L.in;
a.appendChild(ic); a.appendChild(sp);
a.setAttribute('aria-label', signed ? L.me : L.in);
// 左上: マイページ（ログイン）＋データ
var tl = document.createElement('div'); tl.id = 'tt-topleft';
(document.querySelector('.header') || document.body).appendChild(tl);
tl.appendChild(a);
if (document.getElementById('setup')) {
var LD = lang === 'en' ? 'Data' : lang === 'es' ? 'Datos' : 'データ';
var db = document.createElement('button'); db.type = 'button'; db.id = 'data-btn'; db.setAttribute('aria-label', LD);
var ic2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
ic2.setAttribute('viewBox', '0 0 24 24'); ic2.setAttribute('aria-hidden', 'true');
[[4, 13, 4, 7], [10, 8, 4, 12], [16, 4, 4, 16]].forEach(function (r) {
var b = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
b.setAttribute('x', r[0]); b.setAttribute('y', r[1]); b.setAttribute('width', r[2]); b.setAttribute('height', r[3]); b.setAttribute('rx', '1.5'); ic2.appendChild(b);
});
var sp2 = document.createElement('span'); sp2.textContent = LD;
db.appendChild(ic2); db.appendChild(sp2);
db.addEventListener('click', function () { openData('button'); });
tl.appendChild(db);
}
/* データの窓は押したときだけ読み込む（data.js） */
var dataLoading = null;
function openData(src) {
if (window.__ttData) { window.__ttData.open(src); return; }
if (dataLoading) return;
dataLoading = document.createElement('script'); dataLoading.src = '/data.js?v=5';
dataLoading.onload = function () { if (window.__ttData) window.__ttData.open(src); };
dataLoading.onerror = function () { dataLoading = null; };
document.body.appendChild(dataLoading);
}
window.__ttOpenData = openData;
// マイページの「データを見る」から来たとき
try { if (sessionStorage.getItem('tt-open-data') && document.getElementById('setup')) { sessionStorage.removeItem('tt-open-data'); setTimeout(function () { openData('account'); }, 200); } } catch (e) {}
// ログイン中は、説明文の「無料ログインでできること」を出さない
if (signed) { var perks = document.getElementById('tt-perks'); if (perks) perks.hidden = true; }
// ログイン中だけ、同期用のライブラリとマイタイマーを読み込む（未ログインの人には何も増えない）
if (signed && document.getElementById('setup')) {
var s1 = document.createElement('script'); s1.src = '/vendor/supabase-2.116.0.js';
s1.onload = function () { var s2 = document.createElement('script'); s2.src = '/sync.js?v=15'; document.body.appendChild(s2); };
document.body.appendChild(s1);
}
/* ログイン中のホーム（11/13 v2）: 説明文と用途別リンクの代わりに「マイタイマー＋すぐ始める」を1行で。
 * マイタイマーのチップは sync.js が .mr-my に入れる。鉛筆でマイタイマーの編集欄を開く。 */
var hdr = document.querySelector('.header');
if (signed && hdr && document.getElementById('setup')) {
document.documentElement.classList.add('tt-in');
var LR = lang === 'en' ? { edit: 'Edit my timers', grp: 'My timers and quick start' }
: lang === 'es' ? { edit: 'Editar mis temporizadores', grp: 'Mis temporizadores e inicio rápido' }
: { edit: 'マイタイマーを編集', grp: 'マイタイマーとすぐ始める' };
var row = document.createElement('div'); row.id = 'tt-myrow'; row.className = 'tt-myrow';
row.setAttribute('role', 'group'); row.setAttribute('aria-label', LR.grp);
var sc = document.createElement('div'); sc.className = 'mr-scroll';
['mr-my', 'mr-rec', 'mr-quick'].forEach(function (c) { var d = document.createElement('div'); d.className = c; sc.appendChild(d); });
var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'mr-edit';
ed.setAttribute('aria-label', LR.edit); ed.title = LR.edit;
ed.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
ed.addEventListener('click', function () { if (window.__ttMyEdit) window.__ttMyEdit(); });
row.appendChild(sc); row.appendChild(ed);
hdr.insertAdjacentElement('afterend', row);
// すぐ始める: 再生ボタンの下のチップ（#tt-quick）を短い名前でこの行に。押したら元のチップと同じ動き（その場で開始）
var SHORT = { pomo: 'ポモドーロ', workout: '運動40/20', chain: '3つ連続' };
var qd = sc.querySelector('.mr-quick');
Array.prototype.forEach.call(document.querySelectorAll('#tt-quick a.tt-quick-chip'), function (a0) {
var full = (a0.textContent || '').replace(/^\s*▶\s*/, '').trim();
var a = document.createElement('a'); a.className = 'tt-chip mr-chip mr-q'; a.href = a0.getAttribute('href'); a.title = full;
var ic = document.createElement('span'); ic.className = 'mr-play'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = '▶';
a.appendChild(ic); a.appendChild(document.createTextNode((lang === 'ja' && SHORT[a0.dataset.q]) || full));
a.setAttribute('aria-label', full);
a.addEventListener('click', function (e) { e.preventDefault(); a0.click(); });
qd.appendChild(a);
});
}
})();

/* ---------- 兄弟サイトへのリンク（右上）／連続日数🔥（左上のマイページ） ---------- */
(function () {
var lang = document.documentElement.lang;
var header = document.querySelector('.header');
if (!header) return;
var isDT = !!window.DT;
// ドーナツ版は同じサイトの /donut/ に置く
var DONUT_PREFIX = '/donut';
// TimerTrain の各ページにもドーナツ版への切り替えを出す
var SHOW_DONUT_ON_TT = true;
// DonutTimer にあるページ（TimerTrain からはこのページだけ同じ用途のページへ飛ぶ。無ければその言語のトップへ）
var DT_PAGES = ['/', '/pomodoro', '/interval-timer', '/tabata', '/hiit', '/study', '/kitchen', '/multi-timer', '/repeat-timer', '/pomodoro-50-10',
'/en', '/en-pomodoro', '/en-interval-timer', '/en-tabata', '/en-hiit', '/en-kitchen', '/en-study', '/en-1-minute-timer', '/en-2-minute-timer', '/en-3-minute-timer', '/en-4-minute-timer', '/en-5-minute-timer', '/en-10-minute-timer', '/en-15-minute-timer', '/en-20-minute-timer', '/en-25-minute-timer', '/en-30-minute-timer',
'/es', '/es-pomodoro', '/es-intervalos', '/es-tabata'];
var DT_HOME = { ja: '/', en: '/en', es: '/es' };
var NS = 'http://www.w3.org/2000/svg';
function svg(view, parts) {
var e = document.createElementNS(NS, 'svg'); e.setAttribute('viewBox', view); e.setAttribute('aria-hidden', 'true'); e.setAttribute('class', 'sib-mark');
parts.forEach(function (p) { var n = document.createElementNS(NS, p[0]); for (var k in p[1]) n.setAttribute(k, p[1][k]); e.appendChild(n); });
return e;
}
// TimerTrain のアイコン（リング）と、DonutTimer のドーナツ
function ttMark() { return svg('0 0 24 24', [
['circle', { cx: 12, cy: 12, r: 8, fill: 'none', stroke: '#E8E1D8', 'stroke-width': 3.2 }],
['path', { d: 'M12 4a8 8 0 1 1-7.6 5.5', fill: 'none', stroke: '#FF6B6B', 'stroke-width': 3.2, 'stroke-linecap': 'round' }],
['circle', { cx: 12, cy: 4, r: 1.9, fill: '#FF6B6B' }], ['circle', { cx: 4.4, cy: 9.5, r: 1.9, fill: '#FF6B6B' }]]); }
function dtMark() { return svg('0 0 24 24', [
['circle', { cx: 12, cy: 12, r: 10, fill: '#DCA04E' }],
['path', { d: 'M12 3.2c1.6 0 2.4 1 3.7 1.4 1.4.4 2.9.3 3.6 1.6.8 1.3.1 2.6.4 4 .3 1.3 1.4 2.4.9 3.8-.5 1.3-2 1.6-2.8 2.7-.9 1.1-1.1 2.6-2.5 3.1-1.3.4-2.4-.6-3.3-.6s-2 1-3.3.6c-1.4-.5-1.6-2-2.5-3.1-.8-1.1-2.3-1.4-2.8-2.7-.5-1.4.6-2.5.9-3.8.3-1.4-.4-2.7.4-4 .7-1.3 2.2-1.2 3.6-1.6C9.6 4.2 10.4 3.2 12 3.2z', fill: '#F19DBA' }],
['circle', { cx: 12, cy: 12, r: 3.6, fill: 'var(--bg, #FFF9EF)' }],
['rect', { x: 7, y: 6.5, width: 3.2, height: 1.3, rx: .65, fill: '#F8DE7E', transform: 'rotate(-35 8.6 7.2)' }],
['rect', { x: 14.5, y: 7.4, width: 3.2, height: 1.3, rx: .65, fill: '#A5DDEB', transform: 'rotate(30 16.1 8)' }],
['rect', { x: 13.4, y: 16.2, width: 3.2, height: 1.3, rx: .65, fill: '#FFFDF5', transform: 'rotate(-20 15 16.8)' }],
['rect', { x: 6.2, y: 14.6, width: 3.2, height: 1.3, rx: .65, fill: '#C6B0E8', transform: 'rotate(50 7.8 15.2)' }]]); }

// 右上: 兄弟サイト ＋ テーマ切替をまとめる
var theme = document.getElementById('theme-btn');
var showSib = isDT || SHOW_DONUT_ON_TT;
if (theme && showSib) {
var box = document.createElement('div'); box.id = 'tt-topright';
header.appendChild(box);
var a = document.createElement('a'); a.id = 'sib-link';
var name = isDT ? 'TimerTrain' : 'DonutTimer';
var L = lang === 'en' ? 'Open this timer in ' : lang === 'es' ? 'Abrir este temporizador en ' : '';
a.setAttribute('aria-label', lang === 'ja' ? (isDT ? 'TimerTrainの見た目で同じタイマーを開く' : 'ドーナツの見た目で同じタイマーを開く') : L + name);
a.title = a.getAttribute('aria-label');
a.appendChild(isDT ? ttMark() : dtMark());
var sp = document.createElement('span'); sp.textContent = name; a.appendChild(sp);
function target() {
var path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
if (isDT) {
path = path.replace(/^\/donut(?=\/|$)/, '') || '/';
} else {
if (DT_PAGES.indexOf(path) < 0) path = DT_HOME[lang] || '/';
path = DONUT_PREFIX + (path === '/' ? '/' : path);
}
var q = ''; try { q = typeof serialize === 'function' ? serialize() : location.search; } catch (e) {}
return path + q;
}
a.href = target();
// 押した時点の編成を持っていく
a.addEventListener('pointerdown', function () { a.href = target(); });
a.addEventListener('focus', function () { a.href = target(); });
box.appendChild(a);
box.appendChild(theme);
}

// ホーム: ⏱ 今日 · 📅 7日中n日 · 🔥 n日連続（sync.js がログイン中に呼ぶ。押すとデータの窓）
window.__ttSetStats = function (st) {
// 11/13 v2: 帯（⏱今日・📅7日中・🔥連続）はやめて、左上のマイページのボタンに「🔥n」だけ。くわしくはマイページとデータの窓で
var acct = document.getElementById('acct-link');
var row = acct && acct.querySelector('.tt-streak');
if (!st) { if (row) row.remove(); renderToday(null); return; }
if (!acct) { renderToday(st); return; }
if (!row) {
row = document.createElement('span'); row.className = 'tt-streak'; row.setAttribute('aria-hidden', 'true');
acct.appendChild(row);
if (!acct.dataset.base) acct.dataset.base = acct.getAttribute('aria-label') || '';
}
var m = Math.floor((st.today || 0) / 60), h = Math.floor(m / 60), mm = m % 60;
var dur = lang === 'ja' ? (h ? h + '時間' + mm + '分' : m + '分') : lang === 'es' ? (h ? h + ' h ' + mm + ' min' : m + ' min') : (h ? h + 'h ' + mm + 'm' : m + 'm');
var n = st.streak || 0, d7 = st.days7 || 0;
var parts = lang === 'en' ? ['⏱ Today ' + dur, '📅 ' + d7 + ' of 7 days', '🔥 ' + n + '-day streak']
: lang === 'es' ? ['⏱ Hoy ' + dur, '📅 ' + d7 + ' de 7 días', '🔥 Racha de ' + n + (n === 1 ? ' día' : ' días')]
: ['⏱ 今日 ' + dur, '📅 7日中 ' + d7 + '日', '🔥 ' + n + '日連続'];
row.textContent = '🔥' + n;
row.classList.toggle('keep', n > 0 && !st.streakToday);
var hint =lang === 'en' ? (st.streakToday || !n ? '' : ' Use it today to make it ' + (n + 1) + '.') : lang === 'es' ? (st.streakToday || !n ? '' : ' Úsalo hoy para llegar a ' + (n + 1) + '.') : (st.streakToday || !n ? '' : '今日も使うと' + (n + 1) + '日になります。');
var base = acct.dataset.base;
acct.title = base + ' · ' + parts.join(' · ') + (hint ? ' — ' + hint : '');
acct.setAttribute('aria-label', lang === 'ja' ? base + '（' + parts.join('、') + '）' + hint : base + ' (' + parts.join(', ') + ')' + hint);
renderToday(st);
};

/* ホーム: 今日のログ（再生ボタンの下のカード。ログイン中だけ。押すとデータの窓）
 * blocks: sync.js が渡す区切りごとの { s: 開始ms, secs, label, brk }。名前は textContent でだけ表示する */
var TL = lang === 'en' ? { title: "Today's log", total: function (d) { return d; }, empty: 'No record yet today. Run a timer for 15 seconds or more and it shows up here.', more: 'See details', noName: 'No name', others: 'Others', hours: ['0', '6', '12', '18', '24'], aria: "Today's log. Open data",
cStop: 'Stop', cStartOf: function (l) { return 'Start timing ' + l; }, cStopOf: function (l) { return 'Stop timing ' + l; }, cEditOf: function (l) { return 'Edit ' + l; },
cFromLabels: 'From your labels', cAdd: 'Add a button', cAddShort: 'Add', cEdit: 'Edit', cDone: 'Done', cName: 'Name', cPh: 'e.g. Walk', cIcon: 'Icon', cSave: 'Save', cCancel: 'Cancel', cDel: 'Delete', cDelSure: 'Tap again to delete', cClose: 'Close',
cEmpty: 'Turn things you do often into buttons and time them with one tap (walk, chores, reading…).', cErr: 'Could not save. Please try again.',
cLimit: function (n) { return 'The free plan has up to ' + n + ' buttons. Premium allows up to 30.'; }, cPlans: 'See plans',
cIcons: { walk: 'Walk', book: 'Book', home: 'Home', child: 'Kids', cup: 'Cup', moon: 'Sleep', pc: 'Computer', gym: 'Workout', music: 'Music', pen: 'Writing', food: 'Meal', heart: 'Heart' } }
: lang === 'es' ? { title: 'Registro de hoy', total: function (d) { return d; }, empty: 'Aún no hay registros hoy. Usa un temporizador 15 segundos o más y aparecerá aquí.', more: 'Ver detalles', noName: 'Sin nombre', others: 'Otros', hours: ['0', '6', '12', '18', '24'], aria: 'Registro de hoy. Ver datos',
cStop: 'Parar', cStartOf: function (l) { return 'Empezar a contar ' + l; }, cStopOf: function (l) { return 'Parar ' + l; }, cEditOf: function (l) { return 'Editar ' + l; },
cFromLabels: 'De tus etiquetas', cAdd: 'Añadir un botón', cAddShort: 'Añadir', cEdit: 'Editar', cDone: 'Listo', cName: 'Nombre', cPh: 'p. ej. Paseo', cIcon: 'Icono', cSave: 'Guardar', cCancel: 'Cancelar', cDel: 'Eliminar', cDelSure: 'Toca otra vez para eliminar', cClose: 'Cerrar',
cEmpty: 'Convierte lo que haces a menudo en botones y mide el tiempo con un toque (paseo, tareas, lectura…).', cErr: 'No se pudo guardar. Inténtalo de nuevo.',
cLimit: function (n) { return 'El plan gratis permite hasta ' + n + ' botones. Premium, hasta 30.'; }, cPlans: 'Ver planes',
cIcons: { walk: 'Paseo', book: 'Libro', home: 'Casa', child: 'Niños', cup: 'Taza', moon: 'Dormir', pc: 'Ordenador', gym: 'Ejercicio', music: 'Música', pen: 'Escribir', food: 'Comida', heart: 'Corazón' } }
: { title: '今日のログ', total: function (d) { return '合計 ' + d; }, empty: 'まだ今日の記録はありません。タイマーを15秒以上動かすと、ここに残ります。', more: 'くわしく見る', noName: '名前なし', others: 'ほか', hours: ['0時', '6時', '12時', '18時', '24時'], aria: '今日のログ。データを見る',
cStop: '止める', cStartOf: function (l) { return l + 'を計りはじめる'; }, cStopOf: function (l) { return l + 'を止める'; }, cEditOf: function (l) { return l + 'を編集'; },
cFromLabels: 'これまでのラベルから', cAdd: 'ボタンを追加', cAddShort: '追加', cEdit: '編集', cDone: '完了', cName: 'なまえ', cPh: '例：散歩', cIcon: 'アイコン', cSave: '保存', cCancel: 'キャンセル', cDel: '削除', cDelSure: 'もう一度押すと削除', cClose: '閉じる',
cEmpty: 'よくやることをボタンにすると、1タップで時間を計れます（散歩・家事・読書など）。', cErr: '保存できませんでした。もう一度お試しください。',
cLimit: function (n) { return 'ボタンは無料プランで' + n + 'つまでです。プレミアムなら30個まで作れます。'; }, cPlans: 'プランを見る',
cIcons: { walk: '散歩', book: '本', home: '家', child: '子ども', cup: 'カップ', moon: '睡眠', pc: 'パソコン', gym: '運動', music: '音楽', pen: '書く', food: 'ごはん', heart: 'ハート' } };
var PRICING_URL = lang === 'en' ? '/en-pricing' : lang === 'es' ? '/es-pricing' : '/pricing';
function fmtDur(sec) {
var m = Math.round(sec / 60), h = Math.floor(m / 60), mm = m % 60;
if (lang === 'ja') return h ? h + '時間' + (mm ? mm + '分' : '') : m + '分';
if (lang === 'es') return h ? h + ' h' + (mm ? ' ' + mm + ' min' : '') : m + ' min';
return h ? h + 'h' + (mm ? ' ' + mm + 'm' : '') : m + 'm';
}
function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function renderToday(st) {
var card = document.getElementById('tt-today');
var ctr = document.querySelector('#run .run-controls');
if (!st || !ctr) { if (card) card.remove(); document.documentElement.classList.remove('tt-has-log'); stopTicker(); return; }
if (!card) {
card = mk('div', 'tt-today'); card.id = 'tt-today';
var open = mk('button', 'tt-today-open'); open.type = 'button';
open.addEventListener('click', openData);
var cnt = mk('div', 'tt-count');
var more = mk('button', 'tt-today-more'); more.type = 'button';
more.appendChild(mk('span', '', TL.more));
more.appendChild(svgIcon('M9 6l6 6-6 6'));
more.addEventListener('click', openData);
card.appendChild(open); card.appendChild(cnt); card.appendChild(more);
// 11/13 v2: タイマーの外の列に置く（スマホは今までどおり再生ボタンの下、PC の広い画面は左の列）
var col = document.getElementById('tt-logcol'), runSec = document.getElementById('run');
if (!col && runSec) {
col = document.createElement('section'); col.id = 'tt-logcol'; col.className = 'tt-logcol';
col.setAttribute('aria-label', TL.title || 'Today');
runSec.insertAdjacentElement('afterend', col);
}
if (col) { col.appendChild(card); document.documentElement.classList.add('tt-has-log'); }
else ctr.insertAdjacentElement('afterend', card);
}
renderTodayOpen(card.querySelector('.tt-today-open'), st);
renderCount(card.querySelector('.tt-count'), st.count);
}
function openData() { if (window.__ttOpenData) window.__ttOpenData('today'); }
function svgIcon(d, cls) {
var NS = 'http://www.w3.org/2000/svg';
var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p);
return s;
}
function renderTodayOpen(open, st) {
var day0 = new Date(); day0.setHours(0, 0, 0, 0);
var t0 = day0.getTime(), t1 = t0 + 86400000, now = Date.now();
var bl = (st.blocks || []).filter(function (b) { return b && b.s + b.secs * 1000 > t0 && b.s < t1 && b.secs >= 1; })
.sort(function (a, b) { return a.s - b.s; });
// ラベルごとの作業の秒数 → 多い順に色（上位4つ）。休憩は斜線、5つ目以降は「ほか」
var tot = {};
bl.forEach(function (b) { if (!b.brk) tot[b.label] = (tot[b.label] || 0) + b.secs; });
var keys = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
var cls = {}; keys.forEach(function (k, i) { cls[k] = i < 4 ? 's' + (i + 1) : 'o'; });
open.textContent = '';
open.setAttribute('aria-label', TL.aria + ': ' + fmtDur(st.today || 0));
var head = mk('span', 'tt-today-head');
head.appendChild(mk('span', 'tt-today-t', TL.title));
head.appendChild(mk('span', 'tt-today-sum', TL.total(fmtDur(st.today || 0))));
open.appendChild(head);
if (!bl.length) { open.appendChild(mk('span', 'tt-today-empty', TL.empty)); return; }
// 横軸: ふだんは6時〜24時。6時より前の記録がある日は0時から
var startH = bl[0].s < t0 + 6 * 3600000 ? 0 : 6;
var a = t0 + startH * 3600000, span = t1 - a;
var bar = mk('span', 'tt-today-bar'); bar.setAttribute('aria-hidden', 'true');
bl.forEach(function (b) {
var s = Math.max(b.s, a), e = Math.min(b.s + b.secs * 1000, t1);
if (e <= s) return;
var seg = mk('span', 'tt-today-seg ' + (b.brk ? 'b' : cls[b.label]));
seg.style.left = ((s - a) / span * 100).toFixed(2) + '%';
seg.style.width = Math.max(0.5, (e - s) / span * 100).toFixed(2) + '%';
bar.appendChild(seg);
});
if (now > a && now < t1) { var nw = mk('span', 'tt-today-now'); nw.style.left = ((now - a) / span * 100).toFixed(2) + '%'; bar.appendChild(nw); }
open.appendChild(bar);
var ax = mk('span', 'tt-today-axis'); ax.setAttribute('aria-hidden', 'true');
(startH ? TL.hours.slice(1) : TL.hours.filter(function (x, i) { return i % 2 === 0; })).forEach(function (hh) { ax.appendChild(mk('span', '', hh)); });
open.appendChild(ax);
var lg = mk('span', 'tt-today-legend');
var other = 0;
keys.forEach(function (k, i) {
if (i >= 4) { other += tot[k]; return; }
var it = mk('span', 'tt-today-item');
it.appendChild(mk('span', 'tt-today-dot ' + cls[k]));
it.appendChild(mk('span', 'tt-today-name', k || TL.noName));
it.appendChild(mk('span', 'tt-today-v', fmtDur(tot[k])));
lg.appendChild(it);
});
if (other) { var it2 = mk('span', 'tt-today-item'); it2.appendChild(mk('span', 'tt-today-dot o')); it2.appendChild(mk('span', 'tt-today-name', TL.others)); it2.appendChild(mk('span', 'tt-today-v', fmtDur(other))); lg.appendChild(it2); }
if (lg.childNodes.length) open.appendChild(lg);
}

/* ---- 1タップのカウントアップ（ログイン中。中身は sync.js の window.__ttCount） ---- */
var CI = { // アイコン（線だけ。用意した絵柄から選ぶ）
walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v4M8 12l3-4 4 2 2 3M7 21l3-6',
book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5V5.5M20 18v3H6.5',
home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
child: 'M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M5 21c1-4 4-6 7-6s6 2 7 6',
cup: 'M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9.5h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5v2.5M12 2.5v2.5',
moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
pc: 'M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 20h8M12 16v4',
gym: 'M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
music: 'M9 18V5l11-2v13M9 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M20 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
pen: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
food: 'M3 12h18a9 9 0 0 1-18 0zM8.5 8c0-2 2-2 2-4.5M13.5 8c0-2 2-2 2-4.5',
heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z'
};
var CU = { editing: false, form: null, icon: 'walk', key: '' };
var tick = null;
function stopTicker() { clearInterval(tick); tick = null; }
function clock(sec) { sec = Math.floor(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; }
function renderCount(box, cs) {
if (!cs || !window.__ttCount) { box.hidden = true; stopTicker(); return; }
box.hidden = false;
var key = JSON.stringify([cs.btns, cs.run && cs.run.id, cs.run && cs.run.start, cs.max, CU.editing, CU.form]);
if (CU.form && box.querySelector('.tt-cform')) return; // 入力中は作り直さない
if (key === CU.key && box.childNodes.length) return;
CU.key = key;
box.textContent = '';
// いま計っているもの
stopTicker();
if (cs.run) {
var run = mk('div', 'tt-crun'); run.setAttribute('role', 'status');
var ic = mk('span', 'tt-crun-ic'); ic.appendChild(svgIcon(CI[cs.run.icon] || CI.walk));
run.appendChild(ic);
run.appendChild(mk('span', 'tt-crun-n', cs.run.label));
var tt = mk('span', 'tt-crun-t', clock((Date.now() - cs.run.start) / 1000));
run.appendChild(tt);
var stop = mk('button', 'tt-crun-stop', TL.cStop); stop.type = 'button';
stop.addEventListener('click', function () { window.__ttCount.stop(); });
run.appendChild(stop);
box.appendChild(run);
var start = cs.run.start;
tick = setInterval(function () { if (!document.body.contains(tt)) { stopTicker(); return; } tt.textContent = clock(Math.min(43200, (Date.now() - start) / 1000)); }, 1000);
}
var row = mk('div', 'tt-crow');
cs.btns.forEach(function (b) {
var on = cs.run && cs.run.id === b.id;
var btn = mk('button', 'tt-cbtn' + (on ? ' on' : '') + (CU.editing ? ' edit' : '')); btn.type = 'button';
btn.setAttribute('aria-pressed', on ? 'true' : 'false');
btn.setAttribute('aria-label', CU.editing ? TL.cEditOf(b.label) : (on ? TL.cStopOf(b.label) : TL.cStartOf(b.label)));
var c = mk('span', 'tt-cbtn-c'); c.appendChild(svgIcon(CI[b.icon] || CI.walk));
btn.appendChild(c);
btn.appendChild(mk('span', 'tt-cbtn-l', b.label));
btn.addEventListener('click', function () {
if (CU.editing) { CU.form = b.id; CU.icon = b.icon; CU.key = ''; renderCount(box, window.__ttCount.state()); return; }
window.__ttCount.start(b.id);
});
row.appendChild(btn);
});
var full = cs.btns.length >= cs.max;
var add = mk('button', 'tt-cbtn add'); add.type = 'button'; add.setAttribute('aria-label', TL.cAdd);
var ac = mk('span', 'tt-cbtn-c'); ac.appendChild(svgIcon('M12 5v14M5 12h14')); add.appendChild(ac);
add.appendChild(mk('span', 'tt-cbtn-l', TL.cAddShort));
add.addEventListener('click', function () {
if (full) { CU.form = 'limit'; window.__ttCount.limitHit(); }
else { CU.form = 'new'; CU.icon = 'walk'; }
CU.key = ''; renderCount(box, window.__ttCount.state());
});
if (!CU.editing) row.appendChild(add);
box.appendChild(row);
if (!cs.btns.length && !CU.form) box.appendChild(mk('p', 'tt-cnote', TL.cEmpty));
if (cs.btns.length && !CU.form) {
var ed = mk('button', 'tt-cedit', CU.editing ? TL.cDone : TL.cEdit); ed.type = 'button';
ed.addEventListener('click', function () { CU.editing = !CU.editing; CU.key = ''; renderCount(box, window.__ttCount.state()); });
box.appendChild(ed);
}
if (CU.form === 'limit') {
var lim = mk('div', 'tt-cform');
lim.appendChild(mk('p', 'tt-cnote', TL.cLimit(cs.max)));
var la = mk('a', 'tt-cplans', TL.cPlans); la.href = PRICING_URL; lim.appendChild(la);
var lc = mk('button', 'tt-cbtn2', TL.cClose); lc.type = 'button';
lc.addEventListener('click', function () { CU.form = null; CU.key = ''; renderCount(box, window.__ttCount.state()); });
lim.appendChild(lc);
box.appendChild(lim);
} else if (CU.form) {
box.appendChild(countForm(box, cs));
}
}
function countForm(box, cs) {
var editing = CU.form !== 'new';
var cur = editing ? cs.btns.filter(function (b) { return b.id === CU.form; })[0] : null;
if (editing && !cur) { CU.form = null; return mk('span'); }
var f = mk('div', 'tt-cform');
var lab = mk('label', 'tt-cform-l', TL.cName);
var inp = mk('input', 'tt-cform-in'); inp.type = 'text'; inp.maxLength = 20; inp.id = 'tt-cform-in'; inp.placeholder = TL.cPh; inp.autocomplete = 'off';
if (cur) inp.value = cur.label;
if (document.getElementById('tt-labels')) inp.setAttribute('list', 'tt-labels');
lab.htmlFor = 'tt-cform-in';
f.appendChild(lab); f.appendChild(inp);
// これまでのラベル（タイマーの区切り名・カウントアップ）から選べる。すでにボタンにあるものは出さない
var have = {}; cs.btns.forEach(function (b) { have[b.label] = 1; });
var labs = (window.__ttCount.labels ? window.__ttCount.labels() : []).map(function (l) { return l.slice(0, 20); })
.filter(function (l, i, a) { return l && !have[l] && a.indexOf(l) === i; }).slice(0, 8);
if (labs.length) {
var lw = mk('div', 'tt-clabs'); lw.setAttribute('role', 'group'); lw.setAttribute('aria-label', TL.cFromLabels);
lw.appendChild(mk('span', 'tt-clabs-t', TL.cFromLabels));
labs.forEach(function (l) {
var c = mk('button', 'tt-clab', l); c.type = 'button';
c.addEventListener('click', function () { inp.value = l; lw.querySelectorAll('.tt-clab').forEach(function (x) { x.classList.toggle('on', x === c); }); });
lw.appendChild(c);
});
f.appendChild(lw);
}
f.appendChild(mk('span', 'tt-cform-l', TL.cIcon));
var ics = mk('div', 'tt-cform-ic'); ics.setAttribute('role', 'group'); ics.setAttribute('aria-label', TL.cIcon);
(window.__ttCount.icons || Object.keys(CI)).forEach(function (k) {
if (!CI[k]) return;
var ib = mk('button', 'tt-cform-ib' + (CU.icon === k ? ' on' : '')); ib.type = 'button';
ib.setAttribute('aria-pressed', CU.icon === k ? 'true' : 'false'); ib.setAttribute('aria-label', TL.cIcons[k] || k);
ib.appendChild(svgIcon(CI[k]));
ib.addEventListener('click', function () {
CU.icon = k;
ics.querySelectorAll('.tt-cform-ib').forEach(function (x) { var y = x === ib; x.classList.toggle('on', y); x.setAttribute('aria-pressed', y ? 'true' : 'false'); });
});
ics.appendChild(ib);
});
f.appendChild(ics);
var msg = mk('p', 'tt-cnote'); msg.setAttribute('role', 'status');
var acts = mk('div', 'tt-cform-a');
var ok = mk('button', 'tt-cbtn2 pri', TL.cSave); ok.type = 'button';
var cancel = mk('button', 'tt-cbtn2', TL.cCancel); cancel.type = 'button';
function close() { CU.form = null; CU.key = ''; renderCount(box, window.__ttCount.state()); }
cancel.addEventListener('click', close);
ok.addEventListener('click', function () {
var v = inp.value.trim();
if (!v) { inp.focus(); return; }
var list = window.__ttCount.state().btns;
if (cur) list = list.map(function (b) { return b.id === cur.id ? { id: b.id, label: v, icon: CU.icon } : b; });
else list.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label: v, icon: CU.icon });
ok.disabled = true;
window.__ttCount.save(list).then(function (r) { if (r === false) { msg.textContent = TL.cErr; ok.disabled = false; return; } CU.editing = false; close(); });
});
inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ok.click(); } });
acts.appendChild(ok); acts.appendChild(cancel);
if (cur) {
var del = mk('button', 'tt-cbtn2 del', TL.cDel); del.type = 'button';
var armed = false;
del.addEventListener('click', function () {
if (!armed) { armed = true; del.textContent = TL.cDelSure; return; } // 2回押しで削除（確認ダイアログは使わない）
if (window.__ttCount.state().run && window.__ttCount.state().run.id === cur.id) window.__ttCount.stop();
window.__ttCount.save(window.__ttCount.state().btns.filter(function (b) { return b.id !== cur.id; })).then(function () { CU.editing = false; close(); });
});
acts.appendChild(del);
}
f.appendChild(acts); f.appendChild(msg);
setTimeout(function () { try { inp.focus({ preventScroll: false }); } catch (e) {} }, 0);
return f;
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
// ログイン中は「マイタイマー＋すぐ始める」の行の中に（11/13 v2）
var mr = document.querySelector('#tt-myrow .mr-rec');
if (mr) {
mr.textContent = '';
list.slice(0, 2).forEach(function (e) {
var a = document.createElement('a'); a.className = 'tt-chip mr-chip mr-r'; a.href = e.p + e.q;
a.textContent = e.l; a.title = L.recent + ': ' + e.l; a.setAttribute('aria-label', L.recent + ': ' + e.l);
mr.appendChild(a);
});
return;
}
if (!list.length) return;
var wrap = document.createElement('div'); wrap.id = 'tt-recents'; wrap.className = 'tt-recents';
var lab = document.createElement('span'); lab.className = 'tt-recents-label'; lab.textContent = L.recent; wrap.appendChild(lab);
list.slice(0, 2).forEach(function (e) {
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

/* ---------- 設定のたたみ（PC: 右に収納 / スマホ: 上下に開閉）。初期は閉じる。開閉は端末ごとに記憶 ---------- */
(function () {
var setup = document.getElementById('setup');
if (!setup) return;
var KEY = 'tt-setup-open';
var L = LANG === 'en' ? { title: 'Timer settings', short: 'Settings', open: 'Open timer settings', close: 'Close timer settings', n: function (n, one) { return n + ' timers · ' + one + ' per round'; } }
: LANG === 'es' ? { title: 'Ajustes del temporizador', short: 'Ajustes', open: 'Abrir ajustes', close: 'Cerrar ajustes', n: function (n, one) { return n + ' temporizadores · ' + one + ' por ronda'; } }
: { title: 'タイマー設定', short: '設定', open: 'タイマー設定を開く', close: 'タイマー設定を閉じる', n: function (n, one) { return 'タイマー' + n + 'つ・1周 ' + one; } };
var GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';
var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';

var btn = document.createElement('button');
btn.type = 'button'; btn.className = 'setup-toggle'; btn.id = 'setup-toggle';
btn.setAttribute('aria-controls', 'setup');
btn.innerHTML = '<span class="st-ic">' + GEAR + '</span><span class="st-txt"><span class="st-title"></span><span class="st-sum"></span><span class="st-short"></span></span><span class="st-chev">' + CHEV + '</span>';
btn.querySelector('.st-title').textContent = L.title;
btn.querySelector('.st-short').textContent = L.short;
setup.insertBefore(btn, setup.firstChild);
var sum = btn.querySelector('.st-sum');

function summary() {
var ts = state.timers, one = ts.reduce(function (a, t) { return a + t.secs; }, 0);
var main = ts.length <= 3 ? ts.map(function (t) { return (t.name || STR.defName) + ' ' + fmt(t.secs); }).join(' → ') : L.n(ts.length, fmt(one));
var rep = state.repeat === Infinity ? ' × ∞' : state.repeat > 1 ? ' × ' + state.repeat : '';
sum.textContent = main + rep;
btn.title = main + rep;
}
var open = false;
try { open = localStorage.getItem(KEY) === '1'; } catch (e) {}
function paint() {
setup.classList.toggle('collapsed', !open);
document.body.classList.toggle('setup-closed', !open);
btn.setAttribute('aria-expanded', open ? 'true' : 'false');
btn.setAttribute('aria-label', (open ? L.close : L.open) + '（' + sum.textContent + '）');
}
btn.addEventListener('click', function () {
open = !open;
try { localStorage.setItem(KEY, open ? '1' : '0'); } catch (e) {}
paint();
try { if (window.gtag) gtag('event', 'setup_toggle', { open: open ? 1 : 0 }); } catch (e) {}
if (open) { var first = document.querySelector('#timer-list .name-input, #timer-list button'); if (first && window.matchMedia('(min-width: 900px)').matches) first.focus({ preventScroll: true }); }
});
summary(); paint();
/* 編集・並べ替え・くり返し変更のたびに要約を更新（どれも persist / updateTotal を通る） */
var _ut = updateTotal, _ps = persist;
updateTotal = function () { _ut(); summary(); paint(); };
persist = function () { _ps(); summary(); paint(); };
})();

/* 運営者のブラウザ（?tt_internal=1 で設定、?tt_internal=0 で解除）: GA4 では traffic_type=internal として除外。目印を小さく表示 */
(function () {
try { if (localStorage.getItem('tt-internal') !== '1') return; } catch (e) { return; }
var b = document.createElement('div');
b.className = 'tt-internal-badge';
b.textContent = 'GA除外中';
b.title = '?tt_internal=0 で解除';
document.body.appendChild(b);
})();

/* ---------- 自社の案内（プレミアム）：常設バナー・終了時の案内・ヘッダーのボタン（2026-11-05）
 * 外部の広告は読み込まない。中身はすべてこのファイルの文言（textContent のみ）。
 * プレミアムの人には出さない（tt-plan は sync.js / account.js が確認して保存する）。ドーナツ版には出さない */
(function () {
if (window.DT) return;
var lang = document.documentElement.lang;
var l = ['en', 'es'].indexOf(lang) >= 0 ? lang : 'ja';
var PRICING = { ja: '/pricing', en: '/en-pricing', es: '/es-pricing' }[l];
var ACCT = '/account?l=' + l;
function isSigned() { try { return !!localStorage.getItem('sb-arsfocfjfwtlykfdkiea-auth-token'); } catch (e) { return false; } }
function cachedPlan() { try { return localStorage.getItem('tt-plan'); } catch (e) { return null; } }
var plan = isSigned() ? cachedPlan() : null;
function isPremium() { return isSigned() && plan === 'premium'; }
function ev(name, p) { try { if (window.gtag) gtag('event', name, p || {}); } catch (e) {} }
// 訪問回数（このブラウザで何回目のセッションか）
var visits = 0;
try {
visits = Number(localStorage.getItem('tt-visits')) || 0;
if (!sessionStorage.getItem('tt-visit')) { visits++; localStorage.setItem('tt-visits', String(visits)); sessionStorage.setItem('tt-visit', '1'); }
} catch (e) {}

var T = {
ja: {
label: 'プレミアムのご案内', cta: '7日間無料で試す', k1: ['先着', '100', '名'], k2: '創設メンバー価格', pre: 'ずっと', price: ['月', '250', '円'], brand: 'TimerTrain プレミアム', go: ['', '7日間無料', 'で試す'], fmCard: ['今なら、ずっとこの価格。', '先着100名は、今後値上げしても契約が続くかぎり月250円（年2,000円）のまま。最初の7日間は無料です。', '7日間無料で試す'], close: '閉じる',
items: [['広告なし'], ['全期間の', '記録グラフ'], ['マイタイマー・', 'マイプロジェクト\u200b無制限'], ['記録を', 'CSVで保存']],
head: '広告なし・先着100名までずっと月250円', headShort: 'ずっと月250円', headAria: 'プレミアム：広告なし。先着100名まで、ずっと月250円', crown: 'プレミアム',
guest: [
['このタイマー、保存しておきませんか？', '無料ログインで、次からワンタップで呼び出せます。', '無料でログインして保存'],
['スマホでもPCでも、同じタイマーを。', '無料ログインで、作ったタイマーと記録が端末をまたいで同期されます。', '無料でログイン'],
['今日の集中、記録に残しませんか？', '無料ログインで、直近7日の時間と連続日数が見られます。', '無料で記録をはじめる']],
free: [
['続けてきた時間を、ぜんぶ見返そう。', 'プレミアムなら全期間の記録と月・年のグラフ。初めての方は最初の7日間無料です。', '7日間無料で試す'],
['お気に入りのタイマーを、好きなだけ。', 'プレミアムならマイタイマーもマイプロジェクトも上限なし。勉強・仕事・運動を分けて集計できます。', '7日間無料で試す'],
['画面を、もっとすっきり。', 'プレミアムは広告なし。タイマーと記録だけに集中できます。初めての方は最初の7日間無料です。', '7日間無料で試す']]
},
en: {
label: 'About Premium', cta: 'Try 7 days free', k1: ['First ', '100', ''], k2: 'Founding member price', pre: 'For good:', price: ['US$', '1.99', '/mo'], brand: 'TimerTrain Premium', go: ['Try', '7 days free', ''], fmCard: ['Lock in today’s price.', 'The first 100 subscribers keep US$1.99/month (US$15.99/year) for as long as they stay subscribed, even if prices go up. The first 7 days are free.', 'Try 7 days free'], close: 'Close',
items: [['No ads'], ['Full history', '& charts'], ['Unlimited timers', '& projects'], ['Export', 'to CSV']],
head: 'No ads · first 100 keep US$1.99/mo', headShort: 'US$1.99/mo for good', headAria: 'Premium: no ads. The first 100 subscribers keep US$1.99/month for good', crown: 'Premium',
guest: [
['Save this timer?', 'Sign in free and bring it back with one tap next time.', 'Sign in free to save'],
['Same timers on phone and computer.', 'Sign in free to sync your timers and history across devices.', 'Sign in free'],
['Keep a record of today’s focus?', 'Sign in free to see your last 7 days and your streak.', 'Start tracking free']],
free: [
['Look back on all the time you’ve put in.', 'Premium keeps your full history with monthly and yearly charts. 7 days free for new subscribers.', 'Try 7 days free'],
['Save as many timers as you like.', 'Premium removes the limits on timers and projects, so you can track study, work and workouts separately.', 'Try 7 days free'],
['A cleaner screen.', 'Premium has no ads — just your timer and your records. 7 days free for new subscribers.', 'Try 7 days free']]
},
es: {
label: 'Sobre Premium', cta: 'Prueba 7 días gratis', k1: ['Primeros ', '100', ''], k2: 'Precio fundador', pre: 'Siempre:', price: ['MXN ', '29', '/mes'], brand: 'TimerTrain Premium', go: ['Prueba', '7 días gratis', ''], fmCard: ['Asegura el precio de hoy.', 'Los primeros 100 suscriptores mantienen MXN 29 al mes (MXN 229 al año) mientras sigan suscritos, aunque el precio suba. Los primeros 7 días son gratis.', 'Prueba 7 días gratis'], close: 'Cerrar',
items: [['Sin anuncios'], ['Historial', 'y gráficos'], ['Temporizadores y', 'proyectos ilimitados'], ['Exportar', 'a CSV']],
head: 'Sin anuncios · primeros 100: MXN 29/mes', headShort: 'MXN 29/mes siempre', headAria: 'Premium: sin anuncios. Los primeros 100 mantienen MXN 29 al mes para siempre', crown: 'Premium',
guest: [
['¿Guardar este temporizador?', 'Inicia sesión gratis y recupéralo con un toque la próxima vez.', 'Iniciar sesión y guardar'],
['Los mismos temporizadores en el móvil y el ordenador.', 'Inicia sesión gratis para sincronizar tus temporizadores y tu historial.', 'Iniciar sesión gratis'],
['¿Guardar un registro de tu concentración de hoy?', 'Inicia sesión gratis para ver tus últimos 7 días y tu racha.', 'Empezar a registrar gratis']],
free: [
['Revisa todo el tiempo que has dedicado.', 'Premium guarda todo tu historial con gráficos mensuales y anuales. 7 días gratis si eres nuevo.', 'Prueba 7 días gratis'],
['Guarda todos los temporizadores que quieras.', 'Premium quita los límites de temporizadores y proyectos para que registres estudio, trabajo y ejercicio por separado.', 'Prueba 7 días gratis'],
['Una pantalla más limpia.', 'Premium no tiene anuncios: solo tu temporizador y tus registros. 7 días gratis si eres nuevo.', 'Prueba 7 días gratis']]
}
}[l];

var NS = 'http://www.w3.org/2000/svg';
function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function svg(d, opt) {
var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
if (opt && opt.cls) s.setAttribute('class', opt.cls);
d.forEach(function (x) {
var p = document.createElementNS(NS, x[0]);
Object.keys(x[1]).forEach(function (k) { p.setAttribute(k, x[1][k]); });
s.appendChild(p);
});
return s;
}
var CROWN = [['path', { d: 'M3 8l4.5 4 4.5-7 4.5 7L21 8l-2 11H5z' }]];
var ICONS = [
{ c: '#7C5CD6', d: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M5.6 5.6l12.8 12.8' }]] },
{ c: '#4A8FE7', d: [['path', { d: 'M5 20V11M12 20V5M19 20v-6' }]] },
{ c: '#FF6B6B', d: [['path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }]] },
{ c: '#2BA89A', d: [['path', { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }]] }
];

/* 1) 常設バナー（タイマー設定の下〜説明文の上。1ページに1つ） */
function addBanner() {
if (isPremium() || document.getElementById('tt-promo')) return;
var about = document.querySelector('.about');
if (!about || !document.getElementById('setup')) return;
var box = el('aside', 'tt-promo'); box.id = 'tt-promo'; box.setAttribute('aria-label', T.label);
var a = el('a', 'tt-promo-in'); a.href = PRICING;
var head = el('span', 'tt-promo-head');
var who = el('span', 'tt-promo-who'); var k1 = el('span', 'tt-promo-k1'); k1.appendChild(document.createTextNode(T.k1[0])); k1.appendChild(el('span', 'tt-promo-k1n', T.k1[1])); if (T.k1[2]) k1.appendChild(document.createTextNode(T.k1[2])); who.appendChild(el('span', 'tt-promo-k2', T.k2)); who.appendChild(k1);
var pr = el('span', 'tt-promo-price'); pr.appendChild(el('span', 'tt-promo-pre', T.pre));
pr.appendChild(el('span', 'tt-promo-u', T.price[0])); pr.appendChild(el('span', 'tt-promo-num', T.price[1])); pr.appendChild(el('span', 'tt-promo-u', T.price[2]));
head.appendChild(who); head.appendChild(pr);
var band = el('span', 'tt-promo-band');
var list = el('span', 'tt-promo-list');
T.items.forEach(function (lines, i) {
var it = el('span', 'tt-promo-item');
var ic = svg(ICONS[i].d, { cls: 'tt-promo-ic' }); ic.style.stroke = ICONS[i].c; it.appendChild(ic);
var tx = el('span', 'tt-promo-tx');
lines.forEach(function (ln) { tx.appendChild(el('span', 'tt-promo-ln', ln)); });
it.appendChild(tx); list.appendChild(it);
});
var cta = el('span', 'tt-promo-cta'); cta.appendChild(el('span', 'tt-promo-brand', T.brand));
var go = el('span', 'tt-promo-go');
if (T.go[0]) go.appendChild(el('span', 'tt-promo-sm', T.go[0]));
go.appendChild(el('span', 'tt-promo-big', T.go[1]));
if (T.go[2]) go.appendChild(el('span', 'tt-promo-sm', T.go[2]));
cta.appendChild(go);
band.appendChild(list); band.appendChild(cta);
a.appendChild(head); a.appendChild(band);
a.addEventListener('click', function () { ev('promo_click', { slot: 'banner', signed: isSigned() ? 1 : 0 }); });
box.appendChild(a);
about.parentNode.insertBefore(box, about);
}

/* 2) ヘッダー：無料ログインの人に「プレミアム（広告なし）」→ 料金ページ。プレミアムの人は王冠だけ */
function paintHeader() {
var tl = document.getElementById('tt-topleft');
var acct = document.getElementById('acct-link');
var old = document.getElementById('tt-prem-link'); if (old) old.remove();
var oldC = document.getElementById('tt-crown'); if (oldC) oldC.remove();
if (!tl || !acct || !isSigned()) return;
if (isPremium()) {
var c = svg(CROWN, { cls: 'tt-crown' }); c.id = 'tt-crown';
acct.insertBefore(c, acct.firstChild);
acct.setAttribute('aria-label', acct.getAttribute('aria-label') + ' · ' + T.crown);
return;
}
var b = el('a', 'tt-prem-link'); b.id = 'tt-prem-link'; b.href = PRICING; b.setAttribute('aria-label', T.headAria);
b.appendChild(svg(CROWN, { cls: 'tt-crown' }));
b.appendChild(el('span', 'tt-pl-full', T.head));
b.appendChild(el('span', 'tt-pl-short', T.headShort));
b.addEventListener('click', function () { ev('promo_click', { slot: 'header' }); });
tl.appendChild(b);
}

/* 3) 終了時の案内（未ログイン・無料の人。パターンはランダム。×で3日間出さない。1セッション1回） */
var HIDE_MS = 3 * 864e5;
function pick(n, key) {
var last = -1; try { last = Number(localStorage.getItem(key)); } catch (e) {}
var i = Math.floor(Math.random() * n);
if (n > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
try { localStorage.setItem(key, String(i)); } catch (e) {}
return i;
}
function closeCard() { var c = document.getElementById('tt-promo-card'); if (c) c.remove(); }
window.__ttPromoFinish = function () {
if (isPremium() || document.getElementById('tt-comeback') || document.getElementById('tt-promo-card')) return;
var signed = isSigned();
if (!signed && visits < 2) return; // はじめての人には出さない
try {
if (sessionStorage.getItem('tt-promo-shown')) return;
var x = Number(localStorage.getItem('tt-promo-x')) || 0;
if (x && Date.now() - x < HIDE_MS) return;
} catch (e) {}
// 最後の1つは創設メンバー価格（2026-11-07 追加。G4 / F4、リンク先は料金ページ）
var set = (signed ? T.free : T.guest).concat([T.fmCard]);
var FM = set.length - 1;
var i = pick(set.length, signed ? 'tt-promo-lastf' : 'tt-promo-lastg');
var v = (signed ? 'F' : 'G') + (i + 1);
var c = el('div', 'tt-promo-card'); c.id = 'tt-promo-card'; c.setAttribute('role', 'status');
var xb = el('button', 'tt-pc-x', '×'); xb.type = 'button'; xb.setAttribute('aria-label', T.close);
xb.addEventListener('click', function () { closeCard(); try { localStorage.setItem('tt-promo-x', String(Date.now())); } catch (e) {} ev('promo_close', { slot: 'finish', variant: v }); });
c.appendChild(xb);
if (v === 'F1') {
var bars = el('span', 'tt-pc-bars'); bars.setAttribute('aria-hidden', 'true');
[100, 60, 80, 45, 70, 55, 90].forEach(function (h, k) { var s = el('span', k < 3 ? 'old' : (k === 6 ? 'now' : '')); s.style.height = h + '%'; bars.appendChild(s); });
c.appendChild(bars);
}
if (i === FM) {
var fm = el('span', 'tt-pc-fm');
var fw = el('span', 'tt-pc-fm-who'); fw.appendChild(el('span', 'tt-pc-fm-k2', T.k2));
var fk = el('span', 'tt-pc-fm-k1'); fk.appendChild(document.createTextNode(T.k1[0])); fk.appendChild(el('span', 'tt-pc-fm-n1', T.k1[1])); if (T.k1[2]) fk.appendChild(document.createTextNode(T.k1[2])); fw.appendChild(fk);
var fp = el('span', 'tt-pc-fm-price'); fp.appendChild(el('span', 'tt-pc-fm-u', T.pre + ' ' + T.price[0])); fp.appendChild(el('span', 'tt-pc-fm-n', T.price[1])); fp.appendChild(el('span', 'tt-pc-fm-u', T.price[2]));
fm.appendChild(fw); fm.appendChild(fp); c.appendChild(fm);
// 白い部分は特典4つ（アイコン＋短い説明を2×2。スマホのバナーと同じ）
var fl = el('span', 'tt-pc-list');
T.items.forEach(function (lines, k) {
var it = el('span', 'tt-pc-item');
var ic = svg(ICONS[k].d, { cls: 'tt-promo-ic' }); ic.style.stroke = ICONS[k].c; it.appendChild(ic);
var tx = el('span', 'tt-promo-tx'); lines.forEach(function (ln) { tx.appendChild(el('span', 'tt-promo-ln', ln)); });
it.appendChild(tx); fl.appendChild(it);
});
c.appendChild(fl);
} else {
c.appendChild(el('p', 'tt-pc-t', set[i][0]));
c.appendChild(el('p', 'tt-pc-b', set[i][1]));
}
var go = el('a', i === FM ? 'tt-pc-go tt-pc-go-fm' : 'tt-pc-go', set[i][2]); go.href = (signed || i === FM) ? PRICING : ACCT;
go.addEventListener('click', function () { ev('promo_click', { slot: 'finish', variant: v }); });
c.appendChild(go);
document.body.appendChild(c);
try { sessionStorage.setItem('tt-promo-shown', '1'); } catch (e) {}
ev('promo_view', { slot: 'finish', variant: v });
};
// もう一度スタートしたら案内は閉じる
var pb = document.getElementById('pause-btn');
if (pb) pb.addEventListener('click', function () { setTimeout(function () { if (!document.querySelector('.run-time.finished')) closeCard(); }, 0); });

/* sync.js / account.js がプランを確認したら呼ぶ */
window.__ttSetPlan = function (p) {
try { if (p) localStorage.setItem('tt-plan', p); else localStorage.removeItem('tt-plan'); } catch (e) {}
plan = p;
if (isPremium()) { var b = document.getElementById('tt-promo'); if (b) b.remove(); closeCard(); }
else addBanner();
paintHeader();
};

addBanner();
paintHeader();
})();

/* ---------- タイトル（TimerTrain）を押すと、そのページの基本の編成へ（11/13） ---------- */
(function () {
document.querySelectorAll('.logo').forEach(function (el) {
var home;
if (el.tagName === 'A') {
try { var u = new URL(el.getAttribute('href') || '/', location.href); if (u.origin !== location.origin) return; home = u.pathname; } catch (e) { return; }
} else {
home = location.pathname;
var a = document.createElement('a');
a.href = home; a.className = 'logo-link'; a.textContent = el.textContent;
el.textContent = ''; el.appendChild(a);
el = a;
}
el.addEventListener('click', function () {
try { sessionStorage.setItem('tt-fresh', home); } catch (e) {}
try { if (window.gtag) gtag('event', 'logo_home', { same: home === location.pathname ? 1 : 0 }); } catch (e) {}
});
});
})();
