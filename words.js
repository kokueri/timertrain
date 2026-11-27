/* 11/27: ことばでタイマーを作る（TimerTrain・ドーナツタイマー共通）
 * 「英単語25分、休憩5分を3回、最後に復習10分」→ タイマーの並びとくり返し回数にする。
 * AI は使わず、この端末の中だけで読み取る（入力はどこにも送らない）。
 * 入口は「タイマー設定」のボタンの中の右（入りきらないときは🎤だけ）。入れる前に中身を見せて、入れたあとは「元に戻す」ができる。 */
(function () {
  'use strict';
  var MAX_ITEMS = 40, MAX_SECS = 99 * 3600;
  var BREAK_RE = /(休憩|休み|やすみ|ブレイク|インターバル|break|rest|descanso|pausa)/i;
  var COLORS = ['red', 'teal', 'orange', 'purple', 'blue', 'pink', 'yellow'];
  var NUM = '(\\d+(?:\\.\\d+)?)';
  var NB = '(?![a-zà-ÿ])'; // 単位のあとに英字が続かない（"min" が "mint" に当たらないように）
  var RE_H = new RegExp(NUM + '\\s*(?:時間|hours?|hrs?|horas?|h)' + NB + '(半)?', 'gi');
  var RE_M = new RegExp(NUM + '\\s*(?:分|minutes?|mins?|minutos?|m)' + NB + '(半)?', 'gi');
  var RE_S = new RegExp(NUM + '\\s*(?:秒|seconds?|secs?|segundos?|s)' + NB, 'gi');
  var RE_CLOCK = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  var RE_REP = [
    /(?:を|×|x|\*)\s*(\d{1,2})\s*(?:回|セット|周|sets?|rounds?|times|veces|rondas|series)?/i,
    /(\d{1,2})\s*(?:回|セット|周)(?:\s*(?:くり返し|繰り返し|繰返し|くりかえし|リピート))?/,
    /(?:repeat|repetir|repite)\s*(?:x\s*)?(\d{1,2})/i,
    /(\d{1,2})\s*(?:rounds?|sets?|times|veces|rondas|series)/i
  ];
  var RE_INF = /(ずっと|エンドレス|無限|∞|forever|endless|infinite|sin fin|infinito)/i;
  var RE_JUNK = /^(?:間|ずつ|まず|最初に|はじめに|次に|つぎに|そのあと|それから|最後に|さいごに|first|then|next|finally|and|primero|luego|después|al final|y)\s*/i;
  var RE_TAIL = /(?:\s*(?:を|で|の|と|から|して|する|やる)|\s+(?:and|y|de))\s*$/i;

  // 漢数字（音声入力で「二十五分」「三回」となることがある）→ 数字
  var KD = { '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  function kan(k) {
    var n = 0, cur = 0;
    for (var i = 0; i < k.length; i++) {
      var c = k.charAt(i);
      if (c in KD) cur = cur * 10 + KD[c];
      else if (c === '十') { n += (cur || 1) * 10; cur = 0; }
      else if (c === '百') { n += (cur || 1) * 100; cur = 0; }
    }
    return n + cur;
  }
  function norm(s) {
    s = String(s || '');
    try { s = s.normalize('NFKC'); } catch (e) {}
    s = s.replace(/(?:かける|掛ける|かけ|✕|✖)\s*(?=[〇零一二三四五六七八九十百\d])/g, '×');
    s = s.replace(/[〇零一二三四五六七八九十百]+(?=\s*(?:時間|分|秒|回|セット|周))|(?<=×\s*)[〇零一二三四五六七八九十百]+/g, function (k) { return String(kan(k)); });
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
    // くり返し（「3回かける2」「×3 ×2」のように重なったら掛け算）
    for (var g = 0; g < 4; g++) {
      var found = false;
      for (var i = 0; i < RE_REP.length; i++) {
        var m = seg.match(RE_REP[i]);
        if (m) { var n = parseInt(m[1], 10); if (n >= 1 && n <= 99) { o.rep = Math.min(99, (o.rep || 1) * n); seg = seg.replace(m[0], ' '); found = true; break; } }
      }
      if (!found) break;
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
    // 音声入力は「、」が入らない（「英単語25分休憩5分を3回」）。時間のすぐあとに次の名前が来たら区切る
    if (/^\s*\d/.test(s)) {
      // 「25分勉強5分休憩」のように時間が先の書き方は、次の時間の前で区切る（「1時間30分」は区切らない）
      s = s.replace(/([^\s\d、,，;；\n→>＞を×x*.:間分秒半])\s*(?=\d+(?:\.\d+)?\s*(?:時間|分|秒)|\d{1,2}:\d{2})/g, '$1、');
    } else s = s.replace(/(\d\s*(?:時間|分|秒)半?)(?=\s*[^\s\d、,，;；\n→>＞をでのとずく繰リ回セ周半×x*間ほくぐ程])/g, '$1、')
      .replace(/(\d\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?|minutos?|segundos?|horas?))\s+(?!(?:x|times|sets?|rounds?|and|y|veces|rondas|series|repeat|repetir|de|of|each)\b)(?=[a-zà-ÿ])/gi, '$1、');
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
      // 「1時間30分 勉強」のように時間のあとに名前だけが来たら、その前のタイマーの名前にする
      else if (!o.hit && o.name && cur.length && !cur[cur.length - 1].name) cur[cur.length - 1].name = o.name;
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
    ja: { btn: '🎤 ことばで作る', title: 'ことばでタイマーを作る', ph: '例: 英単語25分、休憩5分を3回、最後に復習10分', apply: 'この並びにする', close: '閉じる',
      ex: ['英単語25分、休憩5分を3回、最後に復習10分', 'プランク30秒、休憩10秒を8回', '作業50分、休憩10分 ×2'], exL: '例を入れる',
      note: '「名前＋時間」を「、」で区切って書きます。「を3回」「×3」でくり返し。入力はこの端末の中だけで読み取ります', rep: function (n) { return n === Infinity ? 'ずっとくり返し' : n > 1 ? n + '回くり返し' : ''; },
      err: { empty: '', notime: '時間が見つかりませんでした。「休憩5分」のように、名前と時間を書いてください', many: 'タイマーが多すぎます（40個まで）' },
      running: 'タイマーを止めてから使えます', done: function (n) { return n + '個のタイマーにしました'; }, total: '合計', mic: '声で入力', micOn: '聞いています…（もう一度押すと止まります）', micErr: '音声入力が使えませんでした。マイクの許可を確かめてください', micNote: '🎤 の音声入力は、お使いのブラウザの機能を使います（Chrome では Google のサーバーで文字にされます）' },
    en: { btn: '🎤 Say or type it', title: 'Build a timer from words', ph: 'e.g. Vocab 25 min, break 5 min x 3, review 10 min', apply: 'Use this', close: 'Close',
      ex: ['Vocab 25 min, break 5 min x 3, review 10 min', 'Plank 30 sec, rest 10 sec, 8 rounds', 'Work 50 min, break 10 min x 2'], exL: 'Try an example',
      note: 'Write "name + time", separated by commas. Use "x 3" or "3 rounds" to repeat. It is read on this device only', rep: function (n) { return n === Infinity ? 'repeats forever' : n > 1 ? 'repeats ' + n + ' times' : ''; },
      err: { empty: '', notime: 'No time found. Write a name and a time, like "break 5 min"', many: 'Too many timers (up to 40)' },
      running: 'Stop the timer first', done: function (n) { return 'Set up ' + n + ' timers'; }, total: 'Total', mic: 'Speak', micOn: 'Listening… (tap again to stop)', micErr: 'Voice input did not work. Check the microphone permission', micNote: '🎤 voice input uses your browser\'s own speech feature (in Chrome, Google\'s servers turn speech into text)' },
    es: { btn: '🎤 Dilo o escríbelo', title: 'Crear un temporizador con palabras', ph: 'p. ej. Vocabulario 25 min, descanso 5 min x 3, repaso 10 min', apply: 'Usar esto', close: 'Cerrar',
      ex: ['Vocabulario 25 min, descanso 5 min x 3, repaso 10 min', 'Plancha 30 s, descanso 10 s, 8 rondas', 'Trabajo 50 min, descanso 10 min x 2'], exL: 'Probar un ejemplo',
      note: 'Escribe «nombre + tiempo», separados por comas. Usa «x 3» o «3 rondas» para repetir. Se lee solo en este dispositivo', rep: function (n) { return n === Infinity ? 'se repite siempre' : n > 1 ? 'se repite ' + n + ' veces' : ''; },
      err: { empty: '', notime: 'No se encontró ningún tiempo. Escribe un nombre y un tiempo, como «descanso 5 min»', many: 'Demasiados temporizadores (hasta 40)' },
      running: 'Detén el temporizador primero', done: function (n) { return n + ' temporizadores listos'; }, total: 'Total', mic: 'Hablar', micOn: 'Escuchando… (toca otra vez para parar)', micErr: 'No funcionó la entrada de voz. Revisa el permiso del micrófono', micNote: '🎤 la entrada de voz usa la función de tu navegador (en Chrome, los servidores de Google convierten la voz en texto)' }
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
    prev.textContent = ''; if (!(typeof rec !== 'undefined' && rec)) msg.textContent = '';
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
  // 🎤 音声入力（Web Speech API があるブラウザだけ）
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, micB = null, micNote = null;
  if (SR) {
    var row = el('div', 'tt-words-row'); box.insertBefore(row, null); row.appendChild(inp);
    micB = el('button', 'tt-words-mic', '🎤'); micB.type = 'button'; micB.setAttribute('aria-label', T.mic); micB.title = T.mic; micB.setAttribute('aria-pressed', 'false');
    row.appendChild(micB);
    micB.addEventListener('click', function () {
      if (rec) { try { rec.stop(); } catch (e) {} return; }
      try {
        rec = new SR(); rec.lang = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ja-JP';
        rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        var base = inp.value ? inp.value.replace(/\s*$/, '') + (lang === 'ja' ? '、' : ', ') : '';
        rec.onresult = function (e) {
          var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          inp.value = (base + t).slice(0, 300); preview();
        };
        rec.onerror = function () { msg.textContent = T.micErr; };
        rec.onend = function () { rec = null; micB.setAttribute('aria-pressed', 'false'); micB.classList.remove('on'); if (msg.textContent === T.micOn) msg.textContent = ''; preview(); };
        rec.start();
        micB.setAttribute('aria-pressed', 'true'); micB.classList.add('on'); msg.textContent = T.micOn;
        ev('words_mic', {});
      } catch (e) { rec = null; msg.textContent = T.micErr; }
    });
  } else box.appendChild(inp);
  var exs = el('div', 'tt-words-ex'); exs.appendChild(el('span', 'tt-words-exl', T.exL));
  T.ex.forEach(function (s) { var c = el('button', 'tt-words-chip', s); c.type = 'button'; c.addEventListener('click', function () { inp.value = s; preview(); ev('words_example', {}); }); exs.appendChild(c); });
  box.appendChild(exs);
  prev = el('div', 'tt-words-prev'); prev.setAttribute('aria-live', 'polite'); box.appendChild(prev);
  msg = el('p', 'tt-words-msg'); msg.setAttribute('role', 'status'); box.appendChild(msg);
  go = el('button', 'tt-words-go', T.apply); go.type = 'button'; go.disabled = true; go.addEventListener('click', apply); box.appendChild(go);
  box.appendChild(el('p', 'tt-words-note', T.note));
  if (SR) box.appendChild(el('p', 'tt-words-note', T.micNote));
  btn.addEventListener('click', function () { toggle(!opened); });
  add.insertAdjacentElement('afterend', box);
  // 入口は「タイマー設定」のボタンの中の右（11/27 えりなさん）。幅が狭いとき・見出しが無いページは「＋ タイマーを追加」の下
  var setup = document.getElementById('setup');
  function place() {
    var tgl = document.getElementById('setup-toggle');
    if (!tgl || !setup || !tgl.offsetWidth) {
      btn.classList.remove('in-head'); if (tgl) { var tx0 = tgl.querySelector('.st-txt'); if (tx0) tx0.style.marginRight = ''; }
      if (btn.previousElementSibling !== add) add.insertAdjacentElement('afterend', btn);
      btn.style.top = ''; return;
    }
    if (btn.parentNode !== setup || btn.previousElementSibling !== tgl) tgl.insertAdjacentElement('afterend', btn);
    if (getComputedStyle(setup).position === 'static') setup.style.position = 'relative';
    btn.classList.add('in-head');
    var tx = tgl.querySelector('.st-txt');
    // 入りきらないとき（設定を閉じたPCの細い列など）はマイクだけ
    btn.classList.remove('compact'); btn.textContent = T.btn; btn.removeAttribute('aria-label'); btn.title = '';
    if (tx) tx.style.marginRight = '';
    var tr = tgl.getBoundingClientRect(), txEnd = tr.left + 80;
    // 見出しの1行目（「タイマー設定」「設定」）の幅で決める。下の行（中身のまとめ）は折り返してよい
    var ttl = [].filter.call(tgl.querySelectorAll('.st-title, .st-short'), function (e) { return e.offsetWidth > 0; })[0] || tx;
    if (ttl) { try { var rg = document.createRange(); rg.selectNodeContents(ttl); txEnd = rg.getBoundingClientRect().right; } catch (e) {} }
    if (tr.right - txEnd - 46 - 16 < btn.offsetWidth) { btn.classList.add('compact'); btn.textContent = '🎤'; btn.setAttribute('aria-label', T.btn.replace(/^\S+\s*/, '')); btn.title = T.btn.replace(/^\S+\s*/, ''); }
    btn.style.top = (tgl.offsetTop + tgl.offsetHeight / 2) + 'px';
    if (tx) tx.style.marginRight = (btn.offsetWidth + 8) + 'px';
  }
  place();
  setTimeout(place, 300);
  window.addEventListener('resize', function () { clearTimeout(place._t); place._t = setTimeout(place, 150); });
  if (window.ResizeObserver) { var tglEl = document.getElementById('setup-toggle'); if (tglEl) new ResizeObserver(function () { place(); }).observe(tglEl); }
  // 見出しの中から押したときは、開いたあと入力欄まで見えるように
  var oldToggle = toggle;
  toggle = function (on) { oldToggle(on); if (on) setTimeout(function () { try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }, 60); };
})();
