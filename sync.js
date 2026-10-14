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
    limit: 'You have reached the limit of saved timers.', signin: 'Sign in again'
  } : lang === 'es' ? {
    title: 'Mis temporizadores', save: 'Guardar configuración actual', namePh: 'Nombre', ok: 'Guardar', cancel: 'Cancelar',
    empty: 'Aún no hay temporizadores guardados. Guarda la configuración actual para usarla en cualquier dispositivo.',
    del: 'Eliminar', delQ: '¿Eliminar?', saved: 'Guardado', err: 'No se pudo conectar. Inténtalo más tarde.',
    limit: 'Has alcanzado el límite de temporizadores guardados.', signin: 'Vuelve a iniciar sesión'
  } : {
    title: 'マイタイマー', save: '今の編成を保存', namePh: '名前', ok: '保存', cancel: 'やめる',
    empty: 'まだ保存したタイマーはありません。今の編成を保存すると、どの端末からでも呼び出せます。',
    del: '削除', delQ: '削除する？', saved: '保存しました', err: 'つながりませんでした。時間をおいてもう一度お試しください。',
    limit: '保存できる数の上限に達しました。', signin: 'もう一度ログイン'
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
  box.appendChild(head); box.appendChild(form); box.appendChild(list); box.appendChild(note);
  setup.appendChild(box);

  var items = [];
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
    if (!items.length) { list.appendChild(el('p', { cls: 'tt-my-empty', text: T.empty })); return; }
    items.forEach(function (it) {
      var q = it.config && it.config.q;
      if (typeof q !== 'string' || !Q_RE.test(q)) return;
      var row = el('div', { cls: 'tt-my-item' });
      var a = el('a', { cls: 'tt-chip tt-my-chip', href: location.pathname + q, text: it.name });
      a.addEventListener('click', function () { ev('timer_load'); });
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
      render(); close(); setNote(T.saved);
      setTimeout(function () { if (note.textContent === T.saved) setNote(''); }, 2500);
    }
    ok.addEventListener('click', doSave);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doSave(); } });
    form.appendChild(input); form.appendChild(ok); form.appendChild(cancel);
    form.hidden = false; saveBtn.disabled = true;
    input.focus(); input.select();
  });

  (async function init() {
    var s = await sb.auth.getSession();
    if (!s.data || !s.data.session) {
      // セッション切れ: 入口の表示を「ログイン」に戻し、欄はログインの案内だけにする
      var link = document.querySelector('#acct-link span'); if (link) link.textContent = T.signin;
      head.removeChild(saveBtn);
      list.appendChild(el('a', { cls: 'tt-chip', href: acctHref, text: T.signin }));
      return;
    }
    var test = document.getElementById('tt-sync'); if (test) test.remove(); // ログイン中は「準備中」の需要テストを出さない
    await load();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') load(); });
  })().catch(function () { setNote(T.err, true); });
})();
