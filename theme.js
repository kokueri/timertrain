/* 11/25: 背景とBGM（TimerTrain・ドーナツタイマー共通）
 * 無料: 背景「クリーム微炭酸」・BGM「カフェジャズ」。ほかはプレミアム。
 * 無料・ログイン前の人は、プレミアムのものを60秒ためせる（終わると元に戻して案内を出す）。
 * 選んだものは localStorage 'tt-look' に保存（{bg, bgm, vol}）。
 * BGM: 選ぶと流れ始め、画面を閉じても流れ続ける。止めるのは入口の横の ⏸ か「なし」。タイマーの ▶ でも流れ始める（11/26 えりなさん）
 * 素材は /media/bg/・/media/bgm/（Service Worker では扱わない。Range 読み込みのため）
 * 文言は textContent だけ。外から来る値は id の一覧と照らし合わせてから使う */
(function () {
  'use strict';
  if (window.__ttLook) return;
  var lang = document.documentElement.lang === 'en' ? 'en' : document.documentElement.lang === 'es' ? 'es' : 'ja';
  var DT = !!window.DT;
  var KEY = 'tt-look', TRIAL_SEC = 60;
  var now = new Date(), mo = now.getMonth(), day = now.getDate();
  var XMAS = (mo === 10 && day >= 15) || mo === 11; // 11/15〜12/31

  var T = {
    ja: { btn: '🎨 背景・BGM', title: '背景とBGM', bg: '背景', bgm: 'BGM', vol: '音量', none: 'なし', close: '閉じる',
      bgmNote: '選ぶと流れ始めます。止めるときは「🎨 背景・BGM」の横の ⏸ を押してください。タイマーの ▶ でも流れ始めます', play: 'BGMを流す', pause: 'BGMを止める', iosVol: '音量は端末の音量ボタンで調整してください',
      lockNote: '🔒 はプレミアムの機能です。押すと60秒ためせます', see: '有料プランを見る',
      trial: function (s) { return 'お試し中（あと' + s + '秒）'; },
      trialEnd: 'お試しが終わりました。プレミアムなら、いつでも使えます', season: '12月まで',
      songs: function (n) { return n + '曲'; } },
    en: { btn: '🎨 Background & music', title: 'Background & music', bg: 'Background', bgm: 'Music', vol: 'Volume', none: 'None', close: 'Close',
      bgmNote: 'Music starts when you pick it and keeps playing. Use ⏸ next to "🎨 Background & music" to stop it. Starting a timer also starts the music', play: 'Play music', pause: 'Pause music', iosVol: 'Use your device volume buttons to adjust the volume',
      lockNote: '🔒 is Premium. Tap to try it for 60 seconds', see: 'See Premium',
      trial: function (s) { return 'Trying it (' + s + 's left)'; },
      trialEnd: 'Your trial has ended. With Premium you can use it any time', season: 'Until Dec',
      songs: function (n) { return n + ' songs'; } },
    es: { btn: '🎨 Fondo y música', title: 'Fondo y música', bg: 'Fondo', bgm: 'Música', vol: 'Volumen', none: 'Ninguno', close: 'Cerrar',
      bgmNote: 'La música empieza al elegirla y sigue sonando. Para pararla, usa ⏸ junto a «🎨 Fondo y música». Al iniciar el temporizador también empieza', play: 'Poner música', pause: 'Pausar música', iosVol: 'Ajusta el volumen con los botones del dispositivo',
      lockNote: '🔒 es Premium. Tócalo para probarlo 60 segundos', see: 'Ver Premium',
      trial: function (s) { return 'Probando (quedan ' + s + ' s)'; },
      trialEnd: 'Terminó la prueba. Con Premium puedes usarlo siempre', season: 'Hasta dic.',
      songs: function (n) { return n + ' canciones'; } }
  }[lang];

  function nm(o) { return o[lang] || o.ja; }
  var BGS = [
    { id: 'none', free: 1, n: { ja: T.none, en: T.none, es: T.none } },
    { id: 'cream', free: 1, file: 'cream-soda', n: { ja: 'クリーム微炭酸', en: 'Cream soda', es: 'Soda de crema' } },
    { id: 'melon', file: 'melon-cream-soda', n: { ja: 'メロンクリームソーダ', en: 'Melon cream soda', es: 'Soda de melón' } },
    { id: 'peach', file: 'peach-soda', n: { ja: 'ピーチソーダ', en: 'Peach soda', es: 'Soda de durazno' } },
    { id: 'snow', file: 'christmas-snow', season: 1, n: { ja: '雪とサンタのそり', en: 'Snow & sleigh', es: 'Nieve y trineo' } }
  ].filter(function (b) { return !b.season || XMAS; });
  var BGMS = [
    { id: 'none', free: 1, n: { ja: T.none, en: T.none, es: T.none } },
    { id: 'cafe', free: 1, files: ['cafe-jazz'], n: { ja: 'カフェジャズ', en: 'Café jazz', es: 'Jazz de café' } },
    { id: 'donut', files: ['strawberry-milk-donut'], n: { ja: 'いちごミルクのドーナツ', en: 'Strawberry milk donut', es: 'Dona de fresa con leche' } },
    { id: 'winter', files: ['winter-afternoon'], n: { ja: '冬の午後', en: 'Winter afternoon', es: 'Tarde de invierno' } },
    { id: 'xmas', season: 1, files: ['xmas-cafe-jazz', 'xmas-cozy-cafe', 'xmas-sunlit', 'xmas-warm-motif'], n: { ja: 'クリスマスカフェ', en: 'Christmas café', es: 'Café navideño' } }
  ].filter(function (b) { return !b.season || XMAS; });
  function findIn(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function ev(name, p) { try { if (window.gtag) window.gtag('event', name, p || {}); } catch (e) {} }
  function signed() { try { return !!localStorage.getItem('sb-arsfocfjfwtlykfdkiea-auth-token'); } catch (e) { return false; } }
  var planNow = null; try { planNow = localStorage.getItem('tt-plan'); } catch (e) {}
  function prem() { return signed() && planNow === 'premium'; }
  function member() { return prem() ? 'premium' : signed() ? 'free' : 'guest'; }
  function pricingUrl() { return (lang === 'en' ? '/en-pricing' : lang === 'es' ? '/es-pricing' : '/pricing') + '#buy'; }

  // 保存している選択（id は一覧にあるものだけ）
  var saved = { bg: 'none', bgm: 'none', vol: 30 };
  try {
    var j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && typeof j === 'object') {
      if (typeof j.bg === 'string' && findIn(BGS, j.bg)) saved.bg = j.bg;
      if (typeof j.bgm === 'string' && findIn(BGMS, j.bgm)) saved.bgm = j.bgm;
      if (typeof j.vol === 'number' && j.vol >= 0 && j.vol <= 100) saved.vol = Math.round(j.vol);
    }
  } catch (e) {}
  function store() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} }
  // プレミアムでない間は、保存している有料のものの代わりに無料のものを使う（保存はそのまま。また契約したら戻る）
  function allowed(kind) {
    var it = findIn(kind === 'bg' ? BGS : BGMS, saved[kind]);
    if (!it || it.free || prem()) return saved[kind];
    return kind === 'bg' ? 'cream' : 'cafe';
  }
  var cur = { bg: allowed('bg'), bgm: allowed('bgm') }; // いま使っているもの（お試し中は保存と違う）
  var trial = null; // { kind, id, until, timer }

  /* ---------- 背景 ---------- */
  var reduce = false, saveData = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  var layer = null, vid = null;
  function applyBg() {
    var b = findIn(BGS, cur.bg);
    if (!b || !b.file) {
      document.documentElement.classList.remove('tt-look-on');
      if (layer) { if (vid) { try { vid.pause(); } catch (e) {} vid.removeAttribute('src'); try { vid.load(); } catch (e) {} } layer.remove(); layer = null; vid = null; }
      return;
    }
    var poster = '/media/bg/' + b.file + '-poster.jpg', src = '/media/bg/' + b.file + '.mp4';
    if (!layer) {
      layer = document.createElement('div'); layer.id = 'tt-look-bg'; layer.setAttribute('aria-hidden', 'true');
      var dim = document.createElement('div'); dim.className = 'tt-look-dim';
      layer.appendChild(dim);
      document.body.insertBefore(layer, document.body.firstChild);
    }
    layer.style.backgroundImage = 'url("' + poster + '")';
    if (reduce || saveData) { if (vid) { vid.remove(); vid = null; } }
    else {
      if (!vid) {
        vid = document.createElement('video');
        vid.muted = true; vid.defaultMuted = true; vid.loop = true; vid.playsInline = true; vid.autoplay = true;
        vid.setAttribute('muted', ''); vid.setAttribute('playsinline', ''); vid.setAttribute('preload', 'auto');
        vid.setAttribute('disablepictureinpicture', ''); vid.setAttribute('tabindex', '-1');
        layer.insertBefore(vid, layer.firstChild);
      }
      if (vid.getAttribute('src') !== src) { vid.poster = poster; vid.src = src; }
      if (!document.hidden) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
    }
    document.documentElement.classList.add('tt-look-on');
  }
  document.addEventListener('visibilitychange', function () {
    if (!vid) return;
    if (document.hidden) { try { vid.pause(); } catch (e) {} }
    else { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
  });

  /* ---------- BGM ---------- */
  var au = null, list = [], idx = 0, unlocked = false;
  var on = false, userOff = false, wasPlaying = false; // on: 流したい / userOff: このタイマーの間は ⏸ で止められた
  var volFixed = null; // iOS など、音量を変えられないブラウザ
  function audio() {
    if (au) return au;
    au = new Audio(); au.preload = 'none';
    au.addEventListener('play', paintToggle); au.addEventListener('pause', paintToggle);
    au.addEventListener('ended', function () { if (!list.length) return; idx = (idx + 1) % list.length; au.src = '/media/bgm/' + list[idx] + '.m4a'; tick(); });
    setVol();
    return au;
  }
  function setVol() {
    if (!au) return;
    var v = Math.max(0, Math.min(1, saved.vol / 100));
    try { au.volume = v; } catch (e) {}
    if (volFixed === null) { try { au.volume = 0.5; volFixed = au.volume !== 0.5; au.volume = v; } catch (e) { volFixed = true; } }
  }
  function applyBgm() {
    var m = findIn(BGMS, cur.bgm);
    var files = m && m.files ? m.files : [];
    if (files.join() === list.join()) { tick(); return; }
    list = files.slice(); idx = 0;
    if (!list.length) { if (au) { try { au.pause(); } catch (e) {} au.removeAttribute('src'); } return; }
    audio().src = '/media/bgm/' + list[0] + '.m4a';
    tick();
  }
  function playing() { try { return !!(window.__ttRunPlaying && window.__ttRunPlaying()); } catch (e) { return false; } }
  function runActive() { try { return !!(window.__ttRunActive && window.__ttRunActive()); } catch (e) { return false; } }
  function tick() {
    var pl = playing();
    if (pl && !wasPlaying && !userOff) on = true; // タイマーの ▶ で流し始める
    wasPlaying = pl;
    if (!runActive()) userOff = false;
    if (!au || !list.length) { paintToggle(); return; }
    if (on && au.paused) { var p = au.play(); if (p && p.catch) p.catch(function () { on = false; paintToggle(); }); }
    else if (!on && !au.paused) { try { au.pause(); } catch (e) {} }
    paintToggle();
  }
  function setOn(v, byUser) {
    on = !!v && cur.bgm !== 'none';
    if (byUser && !v && runActive()) userOff = true;
    if (byUser && v) userOff = false;
    tick();
  }
  setInterval(tick, 1000);
  // iOS: 最初に押されたときに音を出せる状態にしておく（タイマーの ▶ から1秒後に流すため）
  document.addEventListener('click', function () {
    if (unlocked || !list.length) return;
    unlocked = true;
    var a = audio(), p;
    try { p = a.play(); } catch (e) {}
    if (p && p.then) p.then(function () { setTimeout(function () { if (!on && !playing()) { try { a.pause(); } catch (e) {} } }, 60); }).catch(function () { unlocked = false; });
  }, true);

  /* ---------- お試し ---------- */
  function startTrial(kind, id) {
    endTrial(false);
    trial = { kind: kind, id: id, until: Date.now() + TRIAL_SEC * 1000 };
    trial.timer = setInterval(function () {
      var left = Math.ceil((trial.until - Date.now()) / 1000);
      if (left <= 0) { endTrial(true); return; }
      paintTrial(left);
    }, 500);
    paintTrial(TRIAL_SEC);
  }
  function endTrial(timeout) {
    if (!trial) return;
    clearInterval(trial.timer);
    var k = trial.kind, id = trial.id; trial = null;
    cur[k] = allowed(k);
    if (k === 'bg') applyBg(); else applyBgm();
    paintTrial(0); paintSheet();
    if (timeout) { ev('theme_trial_end', { kind: k, id: id, member: member() }); endNote(); }
  }
  function endNote() {
    var old = document.getElementById('tt-look-end'); if (old) old.remove();
    var box = document.createElement('div'); box.id = 'tt-look-end'; box.className = 'tt-look-end' + (DT ? ' dt' : ''); box.setAttribute('role', 'status');
    var p = document.createElement('p'); p.textContent = T.trialEnd; box.appendChild(p);
    var a = document.createElement('a'); a.href = pricingUrl(); a.textContent = T.see;
    a.addEventListener('click', function () { ev('theme_cta', { from: 'trial_end', member: member() }); });
    var x = document.createElement('button'); x.type = 'button'; x.className = 'tt-look-x'; x.setAttribute('aria-label', T.close); x.textContent = '×';
    x.addEventListener('click', function () { box.remove(); });
    box.appendChild(a); box.appendChild(x);
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.remove(); }, 15000);
  }

  /* ---------- 選ぶ画面 ---------- */
  var back = null, sheet = null, trialEl = null, lastFocus = null;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function paintTrial(left) {
    if (!trialEl) return;
    trialEl.hidden = !left;
    trialEl.textContent = left ? T.trial(left) : '';
  }
  function pick(kind, item) {
    var isPrem = prem();
    if (trial && trial.kind === kind) endTrial(false);
    if (item.free || isPrem) {
      cur[kind] = item.id; saved[kind] = item.id; store();
      ev('theme_pick', { kind: kind, id: item.id, trial: 0, member: member() });
    } else {
      cur[kind] = item.id;
      startTrial(kind, item.id);
      ev('theme_pick', { kind: kind, id: item.id, trial: 1, member: member() });
    }
    if (kind === 'bg') applyBg();
    else { on = cur.bgm !== 'none'; userOff = false; applyBgm(); }
    paintSheet();
  }
  function paintSheet() {
    if (!sheet) return;
    var isPrem = prem();
    [].forEach.call(sheet.querySelectorAll('[data-k]'), function (b) {
      var k = b.getAttribute('data-k'), id = b.getAttribute('data-id');
      var item = findIn(k === 'bg' ? BGS : BGMS, id);
      b.setAttribute('aria-pressed', cur[k] === id ? 'true' : 'false');
      var lk = b.querySelector('.tt-look-lock'); if (lk) lk.hidden = !!(item.free || isPrem);
    });
    var ln = sheet.querySelector('.tt-look-locknote'); if (ln) ln.hidden = isPrem;
  }
  function openSheet() {
    if (back) return;
    lastFocus = document.activeElement;
    ev('theme_open', { member: member() });
    back = el('div', 'tt-look-back' + (DT ? ' dt' : ''));
    sheet = el('div', 'tt-look-sheet'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'tt-look-h');
    var head = el('div', 'tt-look-head');
    var h = el('h2', null, T.title); h.id = 'tt-look-h';
    var x = el('button', 'tt-look-x', '×'); x.type = 'button'; x.setAttribute('aria-label', T.close); x.addEventListener('click', closeSheet);
    head.appendChild(h); head.appendChild(x); sheet.appendChild(head);
    trialEl = el('p', 'tt-look-trial'); trialEl.hidden = true; trialEl.setAttribute('role', 'status'); sheet.appendChild(trialEl);

    sheet.appendChild(el('h3', null, T.bg));
    var g = el('div', 'tt-look-grid');
    BGS.forEach(function (b) {
      var t = el('button', 'tt-look-tile'); t.type = 'button'; t.setAttribute('data-k', 'bg'); t.setAttribute('data-id', b.id);
      var sw = el('span', 'tt-look-sw');
      if (b.file) sw.style.backgroundImage = 'url("/media/bg/' + b.file + '-poster.jpg")'; else sw.classList.add('none');
      t.appendChild(sw);
      var lab = el('span', 'tt-look-lab', nm(b.n)); t.appendChild(lab);
      if (b.season) t.appendChild(el('span', 'tt-look-season', T.season));
      var lk = el('span', 'tt-look-lock', '🔒'); lk.setAttribute('aria-hidden', 'true'); t.appendChild(lk);
      t.addEventListener('click', function () { pick('bg', b); });
      g.appendChild(t);
    });
    sheet.appendChild(g);

    sheet.appendChild(el('h3', null, T.bgm));
    var ul = el('div', 'tt-look-list');
    BGMS.forEach(function (m) {
      var r = el('button', 'tt-look-row'); r.type = 'button'; r.setAttribute('data-k', 'bgm'); r.setAttribute('data-id', m.id);
      r.appendChild(el('span', 'tt-look-lab', (m.files ? '♪ ' : '') + nm(m.n)));
      if (m.files && m.files.length > 1) r.appendChild(el('span', 'tt-look-sub', T.songs(m.files.length)));
      if (m.season) r.appendChild(el('span', 'tt-look-season', T.season));
      var lk = el('span', 'tt-look-lock', '🔒'); lk.setAttribute('aria-hidden', 'true'); r.appendChild(lk);
      r.addEventListener('click', function () { pick('bgm', m); });
      ul.appendChild(r);
    });
    sheet.appendChild(ul);

    var vr = el('label', 'tt-look-vol');
    vr.appendChild(el('span', null, T.vol));
    var rg = document.createElement('input'); rg.type = 'range'; rg.min = '0'; rg.max = '100'; rg.step = '5'; rg.value = String(saved.vol);
    rg.addEventListener('input', function () { saved.vol = parseInt(rg.value, 10) || 0; store(); setVol(); });
    vr.appendChild(rg); sheet.appendChild(vr);
    audio(); // 音量を変えられるか確かめる
    var vn = el('p', 'tt-look-note', volFixed ? T.iosVol : ''); vn.hidden = !volFixed; sheet.appendChild(vn);
    if (volFixed) vr.hidden = true;
    sheet.appendChild(el('p', 'tt-look-note', T.bgmNote));

    var ln = el('p', 'tt-look-locknote');
    ln.appendChild(el('span', null, T.lockNote + ' '));
    var a = el('a', null, T.see); a.href = pricingUrl();
    a.addEventListener('click', function () { ev('theme_cta', { from: 'sheet', member: member() }); });
    ln.appendChild(a); sheet.appendChild(ln);

    back.appendChild(sheet);
    back.addEventListener('click', function (e) { if (e.target === back) closeSheet(); });
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      var f = [].filter.call(sheet.querySelectorAll('button, a[href], input'), function (n) { return !n.hidden && n.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    document.body.appendChild(back);
    paintSheet();
    if (trial) paintTrial(Math.ceil((trial.until - Date.now()) / 1000));
    x.focus();
  }
  function closeSheet() {
    if (!back) return;
    back.remove(); back = null; sheet = null; trialEl = null;
    tick();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- 入口（共有リンクの下） ---------- */
  var tg = null;
  function paintToggle() {
    if (!tg) return;
    var show = cur.bgm !== 'none';
    tg.hidden = !show;
    var playingNow = !!(au && !au.paused && list.length);
    tg.textContent = playingNow ? '⏸' : '▶';
    tg.setAttribute('aria-label', playingNow ? T.pause : T.play);
    tg.title = playingNow ? T.pause : T.play;
    tg.setAttribute('aria-pressed', playingNow ? 'true' : 'false');
  }
  function addEntry() {
    var sb = document.getElementById('share-btn');
    if (!sb || document.getElementById('tt-look-btn')) return;
    var w = el('div', 'tt-look-wrap');
    var b = el('button', 'tt-look-btn' + (DT ? ' dt' : ''), T.btn); b.type = 'button'; b.id = 'tt-look-btn';
    b.addEventListener('click', openSheet);
    tg = el('button', 'tt-look-tg' + (DT ? ' dt' : '')); tg.type = 'button'; tg.id = 'tt-look-tg'; tg.hidden = true;
    tg.addEventListener('click', function () {
      var playingNow = !!(au && !au.paused);
      setOn(!playingNow, true);
      ev('theme_bgm_toggle', { on: playingNow ? 0 : 1, id: cur.bgm, member: member() });
    });
    w.appendChild(b); w.appendChild(tg);
    sb.insertAdjacentElement('afterend', w);
    if (sb.parentNode) sb.parentNode.style.flexWrap = 'wrap';
  }

  window.__ttLook = {
    open: openSheet,
    plan: function (p) { planNow = p; ['bg', 'bgm'].forEach(function (k) { if (trial && trial.kind === k) return; var v = allowed(k); if (v !== cur[k]) { cur[k] = v; if (k === 'bg') applyBg(); else applyBgm(); } }); paintSheet(); }
  };
  addEntry();
  applyBg();
  applyBgm();
})();
