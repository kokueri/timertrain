'use strict';
/* TimerTrain マイタイマー（ログイン中だけ読み込まれる）
 * - 今の編成（URLの ?t=...&r=... と同じ形）に名前を付けて Supabase に保存し、どの端末・どのページからでも呼び出す
 * - データは RLS で本人の行だけ。表示は textContent のみ
 * - app.js のグローバル（state, serialize）を読むだけで、タイマー本体には手を入れない
 */
(function () {
  var SB_URL = 'https://arsfocfjfwtlykfdkiea.supabase.co';
  var SB_KEY = 'sb_publishable_zw039kyiXe27oY4ITTcNnA_-B_FsG5H';
  var PRODUCT = 'timertrain';
  var Q_RE = /^\?t=[A-Za-z0-9.,%_\-~!*'()]{1,7000}&r=(?:inf|\d{1,2})$/;

  if (!window.supabase || typeof serialize !== 'function') return;
  var setup = document.getElementById('setup');
  if (!setup) return;

  var lang = document.documentElement.lang;
  var T = lang === 'en' ? {
    title: 'My timers', save: 'Save current setup', namePh: 'Name', ok: 'Save', cancel: 'Cancel',
    empty: 'No saved timers yet. Save the current setup to use it on any device.',
    del: 'Delete', delQ: 'Delete?', saved: 'Saved', err: 'Could not connect. Please try again later.',
    limit: 'You have reached the limit of saved timers.', signin: 'Sign in again',
    cur: 'In use', changed: 'edited', over: 'Save changes', asNew: 'Save as new', rename: 'Rename', renameQ: 'New name',
    overDone: 'Changes saved', renamed: 'Renamed', badge: 'My timer'
  } : lang === 'es' ? {
    title: 'Mis temporizadores', save: 'Guardar configuración actual', namePh: 'Nombre', ok: 'Guardar', cancel: 'Cancelar',
    empty: 'Aún no hay temporizadores guardados. Guarda la configuración actual para usarla en cualquier dispositivo.',
    del: 'Eliminar', delQ: '¿Eliminar?', saved: 'Guardado', err: 'No se pudo conectar. Inténtalo más tarde.',
    limit: 'Has alcanzado el límite de temporizadores guardados.', signin: 'Vuelve a iniciar sesión',
    cur: 'En uso', changed: 'con cambios', over: 'Guardar cambios', asNew: 'Guardar como nuevo', rename: 'Renombrar', renameQ: 'Nuevo nombre',
    overDone: 'Cambios guardados', renamed: 'Nombre cambiado', badge: 'Mi temporizador'
  } : {
    title: 'マイタイマー', save: '今の編成を保存', namePh: '名前', ok: '保存', cancel: 'やめる',
    empty: 'まだ保存したタイマーはありません。今の編成を保存すると、どの端末からでも呼び出せます。',
    del: '削除', delQ: '削除する？', saved: '保存しました', err: 'つながりませんでした。時間をおいてもう一度お試しください。',
    limit: '保存できる数の上限に達しました。', signin: 'もう一度ログイン',
    cur: '使用中', changed: '変更あり', over: '上書き保存', asNew: '別に保存', rename: '名前を変更', renameQ: '新しい名前',
    overDone: '上書き保存しました', renamed: '名前を変更しました', badge: 'マイタイマー'
  };
  var acctHref = '/account?l=' + (['en', 'es'].indexOf(lang) >= 0 ? lang : 'ja');
  function ev(name, p) { try { if (window.gtag) gtag('event', name, p || {}); } catch (e) {} }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'cls') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  var sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  var box = el('section', { id: 'tt-my', cls: 'tt-my', 'aria-label': T.title });
  var head = el('div', { cls: 'tt-my-head' });
  var title = el('h2', { cls: 'tt-my-title', text: T.title });
  var saveBtn = el('button', { type: 'button', cls: 'tt-my-save', text: '＋ ' + T.save });
  head.appendChild(title); head.appendChild(saveBtn);
  var form = el('div', { cls: 'tt-my-form', hidden: '' });
  var list = el('div', { cls: 'tt-my-list' });
  var note = el('p', { cls: 'tt-my-note', role: 'status' });
  var curRow = el('div', { cls: 'tt-my-cur', hidden: '' });
  box.appendChild(head); box.appendChild(curRow); box.appendChild(form); box.appendChild(list); box.appendChild(note);
  setup.appendChild(box);
  // タイマーの上に「マイタイマー：名前」
  var badge = el('p', { cls: 'tt-my-badge', hidden: '' });
  var runSec = document.getElementById('run');
  if (runSec) runSec.insertBefore(badge, runSec.firstChild);

  var items = [];
  /* ---------- 使用中のマイタイマー ----------
   * 呼び出したマイタイマーを、このタブで覚えておく（sessionStorage）。
   * 編成を変えたら「変更あり」→ 上書き保存できる。別の編成に切り替えたら使用中ではなくなる。 */
  var CUR_KEY = 'tt-my-cur';
  var curId = null;
  function curQ() { try { return serialize(); } catch (e) { return ''; } }
  function readCur() { try { return JSON.parse(sessionStorage.getItem(CUR_KEY) || 'null'); } catch (e) { return null; } }
  function writeCur() {
    try {
      if (curId) sessionStorage.setItem(CUR_KEY, JSON.stringify({ id: curId, path: location.pathname, q: curQ() }));
      else sessionStorage.removeItem(CUR_KEY);
    } catch (e) {}
  }
  function findItem(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null; }
  function itemQ(it) { return it && it.config && typeof it.config.q === 'string' ? it.config.q : ''; }
  function pickCur() {
    var q = curQ(), c = readCur();
    if (c && c.path === location.pathname && c.q === q && findItem(c.id)) { curId = c.id; return; }
    // 保存したものとまったく同じ編成なら、それを使用中とみなす
    curId = null;
    for (var i = 0; i < items.length; i++) if (itemQ(items[i]) === q) { curId = items[i].id; break; }
    writeCur();
  }
  function isDirty() { var it = findItem(curId); return !!it && itemQ(it) !== curQ(); }
  function renderCur() {
    var it = findItem(curId);
    curRow.textContent = '';
    saveBtn.textContent = '＋ ' + T.save;
    if (!it) { curRow.hidden = true; badge.hidden = true; return; }
    var dirty = isDirty();
    curRow.hidden = false;
    curRow.appendChild(el('span', { cls: 'tt-my-cur-label', text: T.cur }));
    curRow.appendChild(el('strong', { cls: 'tt-my-cur-name', text: it.name }));
    if (dirty) curRow.appendChild(el('span', { cls: 'tt-my-dirty', text: T.changed }));
    var acts = el('span', { cls: 'tt-my-cur-acts' });
    if (dirty) {
      var ov = el('button', { type: 'button', cls: 'tt-my-ok', text: T.over });
      ov.addEventListener('click', function () { overwrite(it, ov); });
      acts.appendChild(ov);
    }
    var rn = el('button', { type: 'button', cls: 'tt-my-save', text: T.rename });
    rn.addEventListener('click', function () { openRename(it); });
    acts.appendChild(rn);
    curRow.appendChild(acts);
    badge.hidden = false;
    badge.textContent = T.badge + '：' + it.name + (dirty ? '（' + T.changed + '）' : '');
    badge.classList.toggle('dirty', dirty);
    saveBtn.textContent = '＋ ' + (dirty ? T.asNew : T.save);
  }
  async function overwrite(it, btn) {
    var q = curQ();
    if (!Q_RE.test(q)) return;
    if (btn) btn.disabled = true;
    var r = await sb.from('timers').update({ config: { q: q, page: location.pathname } }).eq('id', it.id)
      .select('id,name,config,updated_at').single();
    if (btn) btn.disabled = false;
    if (r.error || !r.data) { setNote(T.err, true); return; }
    ev('timer_overwrite');
    items = [r.data].concat(items.filter(function (z) { return z.id !== it.id; }));
    writeCur(); render(); flash(T.overDone);
  }
  function openRename(it) {
    if (!form.hidden) return;
    form.textContent = '';
    var input = el('input', { type: 'text', cls: 'tt-my-input', maxlength: '60', placeholder: T.renameQ, 'aria-label': T.renameQ });
    input.value = it.name;
    var ok = el('button', { type: 'button', cls: 'tt-my-ok', text: T.ok });
    var cancel = el('button', { type: 'button', cls: 'tt-my-cancel', text: T.cancel });
    function close() { form.hidden = true; form.textContent = ''; saveBtn.disabled = false; }
    cancel.addEventListener('click', close);
    async function doRename() {
      var name = input.value.trim().slice(0, 60);
      if (!name) { input.focus(); return; }
      if (name === it.name) { close(); return; }
      ok.disabled = true;
      var r = await sb.from('timers').update({ name: name }).eq('id', it.id).select('id,name,config,updated_at').single();
      if (r.error || !r.data) { ok.disabled = false; setNote(T.err, true); return; }
      ev('timer_rename');
      items = items.map(function (z) { return z.id === it.id ? r.data : z; });
      close(); render(); flash(T.renamed);
    }
    ok.addEventListener('click', doRename);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doRename(); } });
    form.appendChild(input); form.appendChild(ok); form.appendChild(cancel);
    form.hidden = false; saveBtn.disabled = true;
    input.focus(); input.select();
  }
  function flash(t) { setNote(t); setTimeout(function () { if (note.textContent === t) setNote(''); }, 2500); }
  // 編成を変えたとき（app.js の persist から）
  var prevCfg = window.__ttOnConfig;
  window.__ttOnConfig = function () {
    if (prevCfg) { try { prevCfg(); } catch (e) {} }
    if (curId) writeCur();
    renderCur();
  };
  function setNote(t, isErr) { note.textContent = t || ''; note.classList.toggle('err', !!isErr); }

  function defaultName() {
    try {
      var names = state.timers.map(function (t) { return t.name || ''; }).filter(Boolean);
      var n = names.slice(0, 3).join(' · ');
      return (n || T.title).slice(0, 60);
    } catch (e) { return T.title; }
  }

  function render() {
    list.textContent = '';
    renderCur();
    if (!items.length) { list.appendChild(el('p', { cls: 'tt-my-empty', text: T.empty })); return; }
    items.forEach(function (it) {
      var q = it.config && it.config.q;
      if (typeof q !== 'string' || !Q_RE.test(q)) return;
      var row = el('div', { cls: 'tt-my-item' + (it.id === curId ? ' current' : '') });
      var a = el('a', { cls: 'tt-chip tt-my-chip', href: location.pathname + q, text: it.name });
      if (it.id === curId) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', function () {
        ev('timer_load');
        try { sessionStorage.setItem(CUR_KEY, JSON.stringify({ id: it.id, path: location.pathname, q: q })); } catch (e) {}
      });
      var x = el('button', { type: 'button', cls: 'tt-my-x', 'aria-label': T.del + ': ' + it.name, text: '×' });
      x.addEventListener('click', function () {
        if (row.classList.contains('confirm')) return;
        row.classList.add('confirm');
        var yes = el('button', { type: 'button', cls: 'tt-my-yes', text: T.delQ });
        var no = el('button', { type: 'button', cls: 'tt-my-no', text: T.cancel });
        no.addEventListener('click', function () { yes.remove(); no.remove(); row.classList.remove('confirm'); });
        yes.addEventListener('click', async function () {
          yes.disabled = true;
          var r = await sb.from('timers').delete().eq('id', it.id);
          if (r.error) { setNote(T.err, true); yes.disabled = false; return; }
          ev('timer_delete');
          items = items.filter(function (z) { return z.id !== it.id; });
          if (curId === it.id) { curId = null; writeCur(); }
          render();
        });
        row.appendChild(yes); row.appendChild(no);
      });
      row.appendChild(a); row.appendChild(x);
      list.appendChild(row);
    });
  }

  async function load() {
    var r = await sb.from('timers').select('id,name,config,updated_at')
      .eq('product', PRODUCT).order('updated_at', { ascending: false }).limit(100);
    if (r.error) { setNote(T.err, true); return; }
    items = r.data || [];
    pickCur();
    render();
  }

  saveBtn.addEventListener('click', function () {
    if (!form.hidden) return;
    form.textContent = '';
    var input = el('input', { type: 'text', cls: 'tt-my-input', maxlength: '60', placeholder: T.namePh, 'aria-label': T.namePh });
    input.value = defaultName();
    var ok = el('button', { type: 'button', cls: 'tt-my-ok', text: T.ok });
    var cancel = el('button', { type: 'button', cls: 'tt-my-cancel', text: T.cancel });
    function close() { form.hidden = true; form.textContent = ''; saveBtn.disabled = false; }
    cancel.addEventListener('click', close);
    async function doSave() {
      var name = input.value.trim().slice(0, 60);
      var q = serialize();
      if (!name || !Q_RE.test(q)) { input.focus(); return; }
      ok.disabled = true;
      var r = await sb.from('timers').insert({ product: PRODUCT, name: name, config: { q: q, page: location.pathname } })
        .select('id,name,config,updated_at').single();
      if (r.error) {
        ok.disabled = false;
        setNote(/limit/.test(r.error.message || '') ? T.limit : T.err, true);
        return;
      }
      ev('timer_save', { count: items.length + 1 });
      items.unshift(r.data);
      curId = r.data.id; writeCur();
      render(); close(); setNote(T.saved);
      setTimeout(function () { if (note.textContent === T.saved) setNote(''); }, 2500);
    }
    ok.addEventListener('click', doSave);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doSave(); } });
    form.appendChild(input); form.appendChild(ok); form.appendChild(cancel);
    form.hidden = false; saveBtn.disabled = true;
    input.focus(); input.select();
  });

  /* ---------- 利用記録 ----------
   * 開始で記録を用意し、実際に動いた秒数（一時停止中は数えない）を数える。
   * 15秒未満でやめたものは保存しない。保存は「15秒たったら作成 → 1分ごとに更新 → 完了/リセット/ページを閉じる時に確定」。
   */
  var log = null, logTick = null, last = 0;
  function isRunning() { try { return run.active && !run.paused && !run.finished; } catch (e) { return false; } }
  function step() {
    if (!log) return;
    var now = Date.now();
    if (isRunning()) log.secs += (now - last) / 1000;
    last = now;
    if (!log.id && !log.busy && log.secs >= 15) persistLog(log, false);
    else if (log.id && now - log.saved > 60000) persistLog(log, false);
  }
  /* ---------- 連続日数（マイページと同じ数え方: タイマーを15秒以上動かした日が続いた数） ---------- */
  var STREAK_KEY = 'tt-streak';
  var streakToday = false;
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function showStreak(n, today) { streakToday = !!today; if (window.__ttSetStreak) { try { window.__ttSetStreak(n, today); } catch (e) {} } }
  async function loadStreak(force) {
    try {
      var c = JSON.parse(sessionStorage.getItem(STREAK_KEY) || 'null');
      if (!force && c && c.day === dayKey(new Date()) && Date.now() - c.at < 600000) { showStreak(c.n, c.today); return; }
    } catch (e) {}
    try {
      var since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 120);
      var r = await sb.from('usage_logs').select('started_at')
        .eq('product', PRODUCT).gte('started_at', since.toISOString())
        .order('started_at', { ascending: false }).limit(5000);
      if (r.error || !r.data) return;
      var set = {};
      r.data.forEach(function (x) { set[dayKey(new Date(x.started_at))] = 1; });
      var d = new Date(); d.setHours(0, 0, 0, 0);
      var today = !!set[dayKey(d)];
      if (!today) d.setDate(d.getDate() - 1);
      var n = 0;
      while (set[dayKey(d)] && n < 121) { n++; d.setDate(d.getDate() - 1); }
      try { sessionStorage.setItem(STREAK_KEY, JSON.stringify({ n: n, today: today, day: dayKey(new Date()), at: Date.now() })); } catch (e) {}
      showStreak(n, today);
    } catch (e) {}
  }
  function persistLog(L, done) {
    L.chain = (L.chain || Promise.resolve()).then(async function () {
      var secs = Math.min(356400, Math.round(L.secs));
      if (!L.id) {
        if (secs < 15) return;
        L.busy = true;
        var r = await sb.from('usage_logs').insert({
          product: PRODUCT, started_at: L.startedAt, total_secs: secs, completed: !!done,
          ended_at: done ? new Date().toISOString() : null, config: L.timerName ? { q: L.q, name: L.timerName } : { q: L.q }, page: L.page,
          timer_id: L.timerId
        }).select('id').single();
        L.busy = false;
        if (!r.error && r.data) { L.id = r.data.id; if (!streakToday) loadStreak(true); } // 今日の1回目で🔥を更新
      } else {
        await sb.from('usage_logs').update({ total_secs: secs, completed: !!done, ended_at: new Date().toISOString() }).eq('id', L.id);
      }
      L.saved = Date.now();
    }).catch(function () {});
    return L.chain;
  }
  function endLog(done) {
    if (!log) return;
    step();
    clearInterval(logTick); logTick = null;
    var L = log; log = null;
    persistLog(L, done);
  }
  function startLog() {
    endLog(false);
    var q = ''; try { q = serialize(); } catch (e) {}
    var hit = findItem(curId);
    if (!hit) for (var i = 0; i < items.length; i++) { if (items[i].config && items[i].config.q === q) { hit = items[i]; break; } }
    log = { startedAt: new Date().toISOString(), secs: 0, q: Q_RE.test(q) ? q : null, page: location.pathname.slice(0, 100), id: null, saved: 0,
      timerId: hit ? hit.id : null, timerName: hit ? String(hit.name).slice(0, 60) : null };
    last = Date.now();
    logTick = setInterval(step, 5000);
  }
  function hookLogs() {
    var prevStart = window.__ttOnStart, prevFinish = window.__ttOnFinish, prevStop = window.__ttOnStop;
    window.__ttOnStart = function () { if (prevStart) { try { prevStart(); } catch (e) {} } startLog(); };
    window.__ttOnFinish = function () { if (prevFinish) { try { prevFinish(); } catch (e) {} } endLog(true); };
    window.__ttOnStop = function () { if (prevStop) { try { prevStop(); } catch (e) {} } endLog(false); };
    window.addEventListener('pagehide', function () { if (log) { step(); persistLog(log, false); } });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && log) { step(); persistLog(log, false); } });
  }

  /* ---------- 設定の同期（最近の編成・テーマ） ----------
   * 最近の編成: 端末とアカウントの両方を合わせて新しい順に6件
   * テーマ: 最後に切り替えた方（時刻で比較）を採用
   */
  var RECENTS_KEY = 'tt-recents';
  var P_RE = /^\/[a-z0-9\-]{0,40}$/;
  function cleanRecents(a) {
    if (!Array.isArray(a)) return [];
    return a.filter(function (e) {
      return e && typeof e.p === 'string' && P_RE.test(e.p) && typeof e.q === 'string' && e.q.length <= 1500 && Q_RE.test(e.q)
        && typeof e.l === 'string' && typeof e.t === 'number' && isFinite(e.t);
    }).map(function (e) { return { p: e.p, q: e.q, l: e.l.slice(0, 80), t: e.t }; });
  }
  function mergeRecents(a, b) {
    var map = {};
    cleanRecents(a).concat(cleanRecents(b)).forEach(function (e) {
      var k = e.p + e.q; if (!map[k] || map[k].t < e.t) map[k] = e;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) { return y.t - x.t; }).slice(0, 6);
  }
  function readLocal() {
    var r = [], th = null, at = 0;
    try { r = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); } catch (e) {}
    try { th = localStorage.getItem('tt-theme'); at = Number(localStorage.getItem('tt-theme-at')) || 0; } catch (e) {}
    return { recents: cleanRecents(r), theme: (th === 'dark' || th === 'light') ? th : null, themeAt: at };
  }
  var remoteData = null, pushTimer = null;
  function pushSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(pushSettings, 3000); }
  async function pushSettings() {
    var L = readLocal();
    var data = { recents: mergeRecents(L.recents, remoteData && remoteData.recents), theme: L.theme, themeAt: L.themeAt };
    if (remoteData && JSON.stringify(remoteData) === JSON.stringify(data)) return;
    var r = await sb.from('settings').upsert({ product: PRODUCT, data: data }, { onConflict: 'user_id,product' });
    if (!r.error) remoteData = data;
  }
  async function syncSettings() {
    var r = await sb.from('settings').select('data').eq('product', PRODUCT).maybeSingle();
    if (r.error) return;
    var remote = (r.data && r.data.data) || {};
    remoteData = { recents: cleanRecents(remote.recents), theme: (remote.theme === 'dark' || remote.theme === 'light') ? remote.theme : null, themeAt: Number(remote.themeAt) || 0 };
    var L = readLocal();
    if (remoteData.theme && remoteData.themeAt > L.themeAt && remoteData.theme !== L.theme && window.__ttApplyTheme) {
      window.__ttApplyTheme(remoteData.theme, remoteData.themeAt);
    }
    var merged = mergeRecents(L.recents, remoteData.recents);
    if (JSON.stringify(merged) !== JSON.stringify(L.recents)) {
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(merged)); } catch (e) {}
      if (window.__ttRenderRecents) { try { window.__ttRenderRecents(); } catch (e) {} }
    }
    pushSettings();
  }
  function hookSettings() {
    var prevTheme = window.__ttOnTheme;
    window.__ttOnTheme = function (t) { if (prevTheme) { try { prevTheme(t); } catch (e) {} } pushSoon(); };
    var prevStart2 = window.__ttOnStart;
    window.__ttOnStart = function () { if (prevStart2) { try { prevStart2(); } catch (e) {} } pushSoon(); };
  }

  (async function init() {
    var s = await sb.auth.getSession();
    if (!s.data || !s.data.session) {
      // セッション切れ: 入口の表示を「ログイン」に戻し、欄はログインの案内だけにする
      var link = document.querySelector('#acct-link span'); if (link) link.textContent = T.signin;
      try { sessionStorage.removeItem('tt-streak'); } catch (e) {}
      head.removeChild(saveBtn);
      list.appendChild(el('a', { cls: 'tt-chip', href: acctHref, text: T.signin }));
      return;
    }
    var test = document.getElementById('tt-sync'); if (test) test.remove(); // ログイン中は「準備中」の需要テストを出さない
    hookLogs();
    hookSettings();
    loadStreak(false);
    await load();
    syncSettings().catch(function () {});
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { load(); loadStreak(false); syncSettings().catch(function () {}); } });
  })().catch(function () { setNote(T.err, true); });
})();
