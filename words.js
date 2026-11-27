/* 11/27: ことばでタイマーを作る（TimerTrain・ドーナツタイマー共通）
 * 「英単語25分、休憩5分を3回、最後に復習10分」→ タイマーの並びとくり返し回数にする。
 * AI は使わず、この端末の中だけで読み取る（入力はどこにも送らない）。
 * 入口は「＋ タイマーを追加」の下。入れる前に中身を見せて、入れたあとは「元に戻す」ができる。 */
(function () {
  'use strict';
  var MAX_ITEMS = 40, MAX_SECS = 99 * 3600;
  var BREAK_RE = /(休憩|休み|やすみ|ブレイク|インターバル|break|rest|descanso|pausa)/i;
  var COLORS = ['red', 'teal', 'orange', 'purple', 'blue', 'pink', 'yellow'];
  var NUM = '(\\d+(?:\\.\\d+)?)';
  var NB = '(?![a-zà-ÿ])'; // 単位のあとに英字が続かない（"min" が "mint" に当たらないように）
  var RE_H = new RegExp(NUM + '\\s*(?:時間|hours?|hrs?|horas?|h' + NB + ')(半)?', 'gi');
  var RE_M = new RegExp(NUM + '\\s*(?:分|minutes?|mins?|minutos?|m' + NB + ')(半)?', 'gi');
  var RE_S = new RegExp(NUM + '\\s*(?:秒|seconds?|secs?|segundos?|s' + NB + ')', 'gi');
  var RE_CLOCK = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  var RE_REP = [
    /(?:を|×|x|\*)\s*(\d{1,2})\s*(?:回|セット|周|sets?|rounds?|times|veces|rondas|series)?/i,
    /(\d{1,2})\s*(?:回|セット|周)(?:\s*(?:くり返し|繰り返し|繰返し|くりかえし|リピート))?/,
    /(?:repeat|repetir|repite)\s*(?:x\s*)?(\d{1,2})/i,
    /(\d{1,2})\s*(?:rounds?|sets?|times|veces|rondas|series)/i
  ];
  var RE_INF = /(ずっと|エンドレス|無限|∞|forever|endless|infinite|sin fin|infinito)/i;
  var RE_JUNK = /^(?:まず|最初に|はじめに|次に|つぎに|そのあと|それから|最後に|さいごに|first|then|next|finally|and|primero|luego|después|al final|y)\s*/i;
  var RE_TAIL = /\s*(?:を|で|の|と|から|して|する|やる|and|y|de)\s*$/i;

  function norm(s) {
    s = String(s || '');
    try { s = s.normalize('NFKC'); } catch (e) {}
    return s.replace(/[＿_]/g, ' ').slice(0, 300);
  }
  function grab(seg, re, mult, out) {
    return seg.replace(re, function (m, n, half) { out.secs += parseFloat(n) * mult + (typeof half === 'string' && half ? mult / 2 : 0); out.hit = true; return ' '; });
  }
  // 1つの区切り（「休憩5分を3回」など）を読む
  function readSeg(seg) {
    var o = { secs: 0, hit: false, rep: 0, inf: false, name: '' };
    if (RE_INF.test(seg)) { o.inf = true; seg = seg.replace(RE_INF, ' ').replace(/(?:くり返し|繰り返し|リピート|repeat|repetir)/gi, ' '); }
    // 時刻の形（25:00）
    seg = seg.replace(RE_CLOCK, function (m, a, b, c) { o.hit = true; o.secs += c != null ? (+a * 3600 + +b * 60 + +c) : (+a * 60 + +b); return ' '; });
    seg = grab(seg, RE_H, 3600, o);
    seg = grab(seg, RE_M, 60, o);
    seg = grab(seg, RE_S, 1, o);
    for (var i = 0; i < RE_REP.length; i++) {
      var m = seg.match(RE_REP[i]);
      if (m) { var n = parseInt(m[1], 10); if (n >= 1 && n <= 99) { o.rep = n; seg = seg.replace(m[0], ' '); break; } }
    }
    var name = seg.replace(/[()（）「」『』【】\[\]"“”'。.!！?？:：・]/g, ' ').replace(/\s+/g, ' ').trim();
    for (var k = 0; k < 3; k++) name = name.replace(RE_JUNK, '').replace(RE_TAIL, '').trim();
    o.name = name.slice(0, 30);
    o.secs = Math.round(o.secs);
    return o;
  }
  /* 文章 → { timers:[{name,secs,color}], repeat, groups } か { error } */
  function parse(text, defName) {
    var s = norm(text);
    if (!s.trim()) return { error: 'empty' };
    // 「腹筋40秒と休憩20秒」の「と」も区切りにする（時間のすぐあとの と・and・y だけ）
    s = s.replace(/(分|秒|時間|半|\d\s*(?:min|mins|minutes?|sec|secs|seconds?|s|m|h|minutos?|segundos?))\s*(?:と|and|y)\s+/gi, '$1、').replace(/(分|秒|時間|半)\s*と/g, '$1、');
    // 「そのあと」「最後に」などは、くり返しの範囲の切れ目（§）。「まず」「最初に」はその1つだけで区切る（¶）
    s = s.replace(/そのあと|それから|のあと|次に|つぎに|最後に|さいごに|\bthen\b|\bnext\b|\bfinally\b|\by luego\b|\bluego\b|\bdespués\b|\bal final\b/gi, '、§')
      .replace(/まず|最初に|はじめに|\bfirst\b|\bprimero\b/gi, '、¶');
    var segs = s.split(/[、,，;；\n]+|→|->|＞|>/).map(function (x) { return x.trim(); }).filter(Boolean);
    var groups = [], cur = [], inf = false;
    var solo = false, mark = '';
    segs.forEach(function (seg) {
      if (seg === '§' || seg === '¶') { mark = seg; return; }
      if (seg.charAt(0) === '§' || seg.charAt(0) === '¶') { mark = seg.charAt(0); seg = seg.slice(1); }
      if (mark === '§' && cur.length) { groups.push({ items: cur, n: 1 }); cur = []; }
      if (mark === '¶' && cur.length) { groups.push({ items: cur, n: 1 }); cur = []; }
      solo = mark === '¶'; mark = '';
      var o = readSeg(seg);
      if (o.hit && o.secs >= 1) cur.push({ name: o.name, secs: Math.min(o.secs, MAX_SECS) });
      if (solo && !o.rep && !o.inf && cur.length) { groups.push({ items: cur, n: 1 }); cur = []; }
      if (o.inf) inf = true;
      if (o.rep || o.inf) { if (cur.length) { groups.push({ items: cur, n: o.inf ? Infinity : o.rep }); cur = []; } else if (groups.length) { groups[groups.length - 1].n = o.inf ? Infinity : o.rep; } }
    });
    if (cur.length) groups.push({ items: cur, n: 1 });
    if (!groups.length) return { error: 'notime' };
    var timers = [], repeat = 1;
    if (groups.length === 1) { timers = groups[0].items.slice(); repeat = groups[0].n; }
    else if (inf) { groups.forEach(function (g) { timers = timers.concat(g.items); }); repeat = Infinity; }
    else {
      groups.forEach(function (g) { for (var i = 0; i < g.n; i++) timers = timers.concat(g.items); });
      repeat = 1;
    }
    if (timers.length > MAX_ITEMS) return { error: 'many' };
    // 名前と色（同じ名前は同じ色、休憩は緑）
    var used = {}, ci = 0, dn = defName || 'Timer', num = 0;
    timers = timers.map(function (t) {
      var name = t.name || (dn + ' ' + (++num));
      var key = name.toLowerCase(), color;
      if (used[key]) color = used[key];
      else { color = BREAK_RE.test(name) ? 'green' : COLORS[ci++ % COLORS.length]; used[key] = color; }
      return { name: name, secs: t.secs, color: color };
    });
    return { timers: timers, repeat: repeat, groups: groups.length };
  }
  window.__ttWordsParse = parse;

  /* ---------- 画面 ---------- */
  var lang = document.documentElement.lang === 'en' ? 'en' : document.documentElement.lang === 'es' ? 'es' : 'ja';
  var T = {
    ja: { btn: '✍️ ことばで作る', title: 'ことばでタイマーを作る', ph: '例: 英単語25分、休憩5分を3回、最後に復習10分', apply: 'この並びにする', close: '閉じる',
      ex: ['英単語25分、休憩5分を3回、最後に復習10分', 'プランク30秒、休憩10秒を8回', '作業50分、休憩10分 ×2'], exL: '例を入れる',
      note: '「名前＋時間」を「、」で区切って書きます。「を3回」「×3」でくり返し。入力はこの端末の中だけで読み取ります', rep: function (n) { return n === Infinity ? 'ずっとくり返し' : n > 1 ? n + '回くり返し' : ''; },
      err: { empty: '', notime: '時間が見つかりませんでした。「休憩5分」のように、名前と時間を書いてください', many: 'タイマーが多すぎます（40個まで）' },
      running: 'タイマーを止めてから使えます', done: function (n) { return n + '個のタイマーにしました'; }, total: '合計' },
    en: { btn: '✍️ Type it in', title: 'Build a timer from words', ph: 'e.g. Vocab 25 min, break 5 min x 3, review 10 min', apply: 'Use this', close: 'Close',
      ex: ['Vocab 25 min, break 5 min x 3, review 10 min', 'Plank 30 sec, rest 10 sec, 8 rounds', 'Work 50 min, break 10 min x 2'], exL: 'Try an example',
      note: 'Write "name + time", separated by commas. Use "x 3" or "3 rounds" to repeat. It is read on this device only', rep: function (n) { return n === Infinity ? 'repeats forever' : n > 1 ? 'repeats ' + n + ' times' : ''; },
      err: { empty: '', notime: 'No time found. Write a name and a time, like "break 5 min"', many: 'Too many timers (up to 40)' },
      running: 'Stop the timer first', done: function (n) { return 'Set up ' + n + ' timers'; }, total: 'Total' },
    es: { btn: '✍️ Escríbelo', title: 'Crear un temporizador con palabras', ph: 'p. ej. Vocabulario 25 min, descanso 5 min x 3, repaso 10 min', apply: 'Usar esto', close: 'Cerrar',
      ex: ['Vocabulario 25 min, descanso 5 min x 3, repaso 10 min', 'Plancha 30 s, descanso 10 s, 8 rondas', 'Trabajo 50 min, descanso 10 min x 2'], exL: 'Probar un ejemplo',
      note: 'Escribe «nombre + tiempo», separados por comas. Usa «x 3» o «3 rondas» para repetir. Se lee solo en este dispositivo', rep: function (n) { return n === Infinity ? 'se repite siempre' : n > 1 ? 'se repite ' + n + ' veces' : ''; },
      err: { empty: '', notime: 'No se encontró ningún tiempo. Escribe un nombre y un tiempo, como «descanso 5 min»', many: 'Demasiados temporizadores (hasta 40)' },
      running: 'Detén el temporizador primero', done: function (n) { return n + ' temporizadores listos'; }, total: 'Total' }
  }[lang];
  var defName = lang === 'en' ? 'Timer' : lang === 'es' ? 'Temporizador' : 'タイマー';
  function ev(n, p) { try { if (window.gtag) window.gtag('event', n, p || {}); } catch (e) {} }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(s) {
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    if (lang === 'ja') return (h ? h + '時間' : '') + (m ? m + '分' : '') + (x ? x + '秒' : '') || '0秒';
    return (h ? h + 'h ' : '') + (m ? m + ' min ' : '') + (x ? x + ' s' : '').trim() || '0 s';
  }
  var box = null, inp = null, prev = null, msg = null, go = null, last = null, opened = false;
  function preview() {
    var r = parse(inp.value, defName);
    last = r.error ? null : r;
    prev.textContent = ''; msg.textContent = '';
    go.disabled = !last;
    if (r.error) { msg.textContent = T.err[r.error] || ''; return; }
    var ol = el('ol', 'tt-words-list');
    r.timers.slice(0, 12).forEach(function (t) {
      var li = el('li'); var dot = el('span', 'tt-words-dot'); dot.setAttribute('data-c', t.color); li.appendChild(dot);
      li.appendChild(el('span', 'tt-words-n', t.name)); li.appendChild(el('span', 'tt-words-t', fmt(t.secs))); ol.appendChild(li);
    });
    if (r.timers.length > 12) ol.appendChild(el('li', 'tt-words-more', '… +' + (r.timers.length - 12)));
    prev.appendChild(ol);
    var sum = r.timers.reduce(function (a, t) { return a + t.secs; }, 0);
    var rp = T.rep(r.repeat);
    prev.appendChild(el('p', 'tt-words-sum', (rp ? rp + ' · ' : '') + T.total + ' ' + (r.repeat === Infinity ? fmt(sum) + ' × ∞' : fmt(sum * r.repeat))));
    var busy = false; try { busy = !!(window.__ttRunActive && window.__ttRunActive()); } catch (e) {}
    if (busy) { msg.textContent = T.running; go.disabled = true; }
  }
  function apply() {
    if (!last || !window.__ttApplyConfig) return;
    var res = window.__ttApplyConfig({ timers: last.timers, repeat: last.repeat });
    if (res === 'running') { msg.textContent = T.running; return; }
    ev('words_apply', { n: last.timers.length, rep: last.repeat === Infinity ? 0 : last.repeat, groups: last.groups, len: inp.value.length });
    var n = last.timers.length;
    toggle(false);
    if (window.__ttUndoToast) window.__ttUndoToast(T.done(n), function () { window.__ttApplyConfig(res); ev('words_undo', {}); });
  }
  function toggle(on) {
    opened = on; box.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) {
      var st = document.getElementById('setup');
      if (st && st.classList.contains('collapsed')) { var tg = st.querySelector('.setup-toggle'); if (tg) tg.click(); }
      ev('words_open', {}); inp.focus(); preview();
    }
  }
  var add = document.getElementById('add-btn');
  if (!add || document.getElementById('tt-words-btn')) return;
  var btn = el('button', 'tt-words-btn', T.btn); btn.type = 'button'; btn.id = 'tt-words-btn'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'tt-words');
  box = el('div', 'tt-words'); box.id = 'tt-words'; box.hidden = true; box.setAttribute('role', 'group'); box.setAttribute('aria-label', T.title);
  var head = el('div', 'tt-words-head'); head.appendChild(el('strong', null, T.title));
  var x = el('button', 'tt-words-x', '×'); x.type = 'button'; x.setAttribute('aria-label', T.close); x.addEventListener('click', function () { toggle(false); btn.focus(); });
  head.appendChild(x); box.appendChild(head);
  inp = el('textarea', 'tt-words-in'); inp.rows = 2; inp.maxLength = 300; inp.placeholder = T.ph; inp.setAttribute('aria-label', T.title);
  inp.addEventListener('input', function () { clearTimeout(inp._t); inp._t = setTimeout(preview, 200); });
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); preview(); apply(); } if (e.key === 'Escape') { toggle(false); btn.focus(); } });
  box.appendChild(inp);
  var exs = el('div', 'tt-words-ex'); exs.appendChild(el('span', 'tt-words-exl', T.exL));
  T.ex.forEach(function (s) { var c = el('button', 'tt-words-chip', s); c.type = 'button'; c.addEventListener('click', function () { inp.value = s; preview(); ev('words_example', {}); }); exs.appendChild(c); });
  box.appendChild(exs);
  prev = el('div', 'tt-words-prev'); prev.setAttribute('aria-live', 'polite'); box.appendChild(prev);
  msg = el('p', 'tt-words-msg'); msg.setAttribute('role', 'status'); box.appendChild(msg);
  go = el('button', 'tt-words-go', T.apply); go.type = 'button'; go.disabled = true; go.addEventListener('click', apply); box.appendChild(go);
  box.appendChild(el('p', 'tt-words-note', T.note));
  btn.addEventListener('click', function () { toggle(!opened); });
  add.insertAdjacentElement('afterend', btn);
  btn.insertAdjacentElement('afterend', box);
})();
