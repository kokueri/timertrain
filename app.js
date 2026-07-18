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
  { id: 'red',    v: '#FF6B6B' },
  { id: 'orange', v: '#FF9F45' },
  { id: 'yellow', v: '#FFC94D' },
  { id: 'green',  v: '#34C759' },
  { id: 'teal',   v: '#32ADE6' },
  { id: 'blue',   v: '#4C8DFF' },
  { id: 'purple', v: '#BF7AF0' },
  { id: 'pink',   v: '#FF6BB5' },
  { id: 'gray',   v: '#8E8E93' },
];
const colorOf = id => (PALETTE.find(c => c.id === id) || PALETTE[5]).v;
const nextColor = id => PALETTE[(PALETTE.findIndex(c => c.id === id) + 1) % PALETTE.length].id;
const MAX_SECS = 99 * 3600;
const LANG = document.documentElement.lang === 'en' ? 'en' : 'ja';
const STR = {
  ja: {
    work: '作業', brk: '休憩', defName: 'タイマー', namePh: 'タイマー名',
    lastDel: '最後の1つは削除できません', copied: 'リンクをコピーしました',
    copyPrompt: 'このURLをコピーしてください', done: '完了 🎉', doneTitle: '✅ 完了 — TimerTrain',
    reps: n => `${n}回`,
    totalInf: one => `1周 ${one} × ∞`,
    total: (t, one, n) => `合計 ${t}（${one} × ${n}周）`,
    cycleInf: c => `${c}周目`,
    cycle: (c, r) => `${c} / ${r}周`,
  },
  en: {
    work: 'Work', brk: 'Break', defName: 'Timer', namePh: 'Timer name',
    lastDel: "You can't delete the last timer", copied: 'Link copied',
    copyPrompt: 'Copy this URL', done: 'Done 🎉', doneTitle: '✅ Done — TimerTrain',
    reps: n => `×${n}`,
    totalInf: one => `${one} per round × ∞`,
    total: (t, one, n) => `Total ${t} (${one} × ${n} rounds)`,
    cycleInf: c => `Round ${c}`,
    cycle: (c, r) => `Round ${c} / ${r}`,
  },
}[LANG];
const STORE_KEY = 'timertrain-v1';
const BASE_TITLE = document.title;

/* ---------- 状態 ---------- */
let state = {
  timers: [
    { id: uid(), name: STR.work, secs: 1500, color: 'red' },
    { id: uid(), name: STR.brk, secs: 300,  color: 'blue' },
  ],
  repeat: 4, // Infinityで無限
};
let run = { active: false, paused: false, finished: false, idx: 0, cycle: 1, endAt: 0, remainMs: 0, lastSec: -1 };
let tickId = null;
let wakeLock = null;
let audioCtx = null;

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
  if (parts.length === 1) secs = parts[0] * 60;            // "25" → 25分
  else if (parts.length === 2) secs = parts[0] * 60 + parts[1];  // "25:30"
  else secs = parts[0] * 3600 + parts[1] * 60 + parts[2];  // "1:00:00"
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
  history.replaceState(null, '', serialize());
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
  const fromUrl = parseConfig(location.search);
  if (fromUrl) { state = fromUrl; return; }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.timers) && s.timers.length) {
        state = { timers: s.timers, repeat: s.repeat === 'inf' ? Infinity : (s.repeat || 1) };
      }
    }
  } catch (e) {}
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
}
function beep(freq, dur, at, vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + (at || 0);
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}
const soundSegment = () => { beep(880, 0.15, 0, 0.35); beep(1175, 0.2, 0.18, 0.35); };
const soundFinish  = () => { beep(880, 0.15, 0, 0.4); beep(1175, 0.15, 0.2, 0.4); beep(1568, 0.5, 0.4, 0.4); };
const soundTick    = () => beep(700, 0.06, 0, 0.15);

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
  play:  '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  replay: '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
};
const RING_C = 2 * Math.PI * 46;
ringFg.style.strokeDasharray = RING_C;
function setRing(frac, color) {
  ringFg.style.strokeDashoffset = RING_C * (1 - Math.min(1, Math.max(0, frac)));
  if (color) ringFg.style.stroke = color;
}

function closeColorPop() { document.querySelectorAll('.color-pop').forEach(p => p.remove()); }
function openColorPop(li, t, dot) {
  const existed = li.querySelector('.color-pop');
  closeColorPop();
  if (existed) return; // 同じ丸をもう一度押したら閉じるだけ
  const pop = document.createElement('div');
  pop.className = 'color-pop';
  PALETTE.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = c.v;
    b.setAttribute('aria-label', c.id);
    if (c.id === t.color) b.classList.add('sel');
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      t.color = c.id;
      dot.style.background = c.v;
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

    const dot = document.createElement('button');
    dot.className = 'color-dot';
    dot.style.background = colorOf(t.color);
    dot.setAttribute('aria-label', '色を変更');
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
}

function editTime(t, btn) {
  const input = document.createElement('input');
  input.className = 'time-input';
  input.value = fmt(t.secs);
  input.inputMode = 'numeric';
  btn.replaceWith(input);
  input.focus(); input.select();
  const commit = () => {
    const v = parseTime(input.value);
    if (v) t.secs = v;
    persist(); renderList();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = fmt(t.secs); input.blur(); }
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
  $('rep-count').textContent = state.repeat === Infinity ? '∞' : STR.reps(state.repeat);
  $('rep-inf').classList.toggle('active', state.repeat === Infinity);
}

/* ---------- 実行 ---------- */
function startRun() {
  unlockAudio();
  run = { active: true, paused: false, finished: false, idx: 0, cycle: 1,
          endAt: Date.now() + state.timers[0].secs * 1000, remainMs: 0, lastSec: -1 };
  setupEl.classList.add('hidden');
  runEl.classList.remove('hidden');
  acquireWakeLock();
  pauseBtn.innerHTML = ICONS.pause;
  renderStations();
  tickId = setInterval(tick, 200);
  tick();
}
function stopRun() {
  clearInterval(tickId); tickId = null;
  run.active = false;
  releaseWakeLock();
  document.title = BASE_TITLE;
  runEl.classList.add('hidden');
  setupEl.classList.remove('hidden');
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
}
function skip() {
  if (!run.active || run.finished) return;
  advance(false);
}
function resetRun() {
  if (!run.active) return;
  run.idx = 0; run.cycle = 1; run.finished = false;
  run.paused = true;
  run.remainMs = state.timers[0].secs * 1000;
  run.lastSec = -1;
  pauseBtn.innerHTML = ICONS.play;
  runTime.classList.remove('finished');
  renderStations();
  updateRunView();
}
function advance(withSound) {
  const now = Date.now();
  if (run.idx + 1 < state.timers.length) {
    run.idx++;
  } else if (state.repeat === Infinity || run.cycle < state.repeat) {
    run.cycle++; run.idx = 0;
  } else {
    finish(); return;
  }
  if (withSound) soundSegment();
  run.lastSec = -1;
  if (run.paused) run.remainMs = state.timers[run.idx].secs * 1000;
  else run.endAt = now + state.timers[run.idx].secs * 1000;
  renderStations();
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
  setRing(1, '#34C759');
  document.title = STR.doneTitle;
}
function tick() {
  if (!run.active || run.paused || run.finished) return;
  const remain = run.endAt - Date.now();
  if (remain <= 0) { advance(true); return; }
  const sec = Math.ceil(remain / 1000);
  if (sec !== run.lastSec) {
    run.lastSec = sec;
    if (sec <= 3) soundTick();
  }
  updateRunView();
}
function updateRunView() {
  if (run.finished) return;
  const t = state.timers[run.idx];
  const remainMs = run.paused ? run.remainMs : Math.max(0, run.endAt - Date.now());
  const disp = fmt(Math.ceil(remainMs / 1000));
  runTime.textContent = disp;
  runName.textContent = t.name || STR.defName;
  runCycle.textContent = state.repeat === Infinity
    ? STR.cycleInf(run.cycle)
    : STR.cycle(run.cycle, state.repeat);
  setRing(remainMs / (t.secs * 1000), colorOf(t.color));
  document.title = `${disp} ${t.name} — TimerTrain`;
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
    s.className = 'station' + (i < run.idx ? ' done' : i === run.idx ? ' now' : '');
    s.style.background = colorOf(t.color);
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
  const url = location.origin + location.pathname + serialize();
  try {
    await navigator.clipboard.writeText(url);
    toast(STR.copied);
  } catch (e) {
    prompt(STR.copyPrompt, url);
  }
});
$('start-btn').addEventListener('click', startRun);
$('pause-btn').addEventListener('click', () => { run.finished ? resetAndGo() : pauseToggle(); });
$('skip-btn').addEventListener('click', skip);
$('reset-btn').addEventListener('click', resetRun);
$('close-btn').addEventListener('click', stopRun);
function resetAndGo() { resetRun(); pauseToggle(); }

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
  if (e.key === 'Escape') stopRun();
});

/* ---------- 起動 ---------- */
load();
renderList();
persist();
