'use strict';
  var BRAND = window.DT ? window.DT.brand : 'TimerTrain'; // DonutTimer では donut.js が先に読み込まれる
/* TimerTrain アカウントページ
 * - 認証は Supabase Auth（Google, PKCE）。パスワードは扱わない
 * - ブラウザに置くのは公開キーだけ。データは RLS で本人の行しか読めない
 * - 画面に出す文字はすべて textContent（XSS対策）。innerHTML は使わない
 * - alert/confirm は使わない（退会の確認は画面内で「削除」と入力してもらう）
 */
(function () {
  var SB_URL = 'https://arsfocfjfwtlykfdkiea.supabase.co';
  var SB_KEY = 'sb_publishable_zw039kyiXe27oY4ITTcNnA_-B_FsG5H';
  var GA_ID = window.DT ? '' : 'G-GSFVNEDCGN'; // DonutTimer の計測は別プロパティを作ってから

  /* ---------- GA（インラインscriptを使わないためここで設定） ---------- */
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  if (GA_ID) {
  gtag('config', GA_ID);
  var ga = document.createElement('script');
  ga.async = true; ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(ga);
  }
  function ev(name, p) { try { gtag('event', name, p || {}); } catch (e) {} }

  /* ---------- 言語 ---------- */
  var params = new URLSearchParams(location.search);
  var lang = params.get('l');
  if (['ja', 'en', 'es'].indexOf(lang) < 0) {
    var nl = (navigator.language || 'ja').slice(0, 2);
    lang = nl === 'es' ? 'es' : nl === 'ja' ? 'ja' : 'en';
  }
  try { localStorage.setItem('tt-lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  var HOME = { ja: '/', en: '/en', es: '/es' }[lang];
  var PRIV = { ja: '/privacy', en: '/en-privacy', es: '/es-privacy' }[lang];
  var TERMS = { ja: '/terms', en: '/en-terms', es: '/es-terms' }[lang];
  var T = {
    ja: {
      title: 'アカウント', back: 'タイマーに戻る',
      leadOut: '無料でログインすると、名前を付けたマイタイマーの保存、スマホとPCの同期、直近7日間の利用記録が使えます。タイマーはこれまでどおりログインなしでも無料で使えます。',
      google: 'Google でログイン',
      agree1: 'ログインすると、', agreeP: 'プライバシーポリシー', agreeAnd: 'と', agreeT: '利用規約', agree2: 'に同意したものとみなします。',
      signedIn: 'ログイン中', logout: 'ログアウト',
      dangerTitle: 'アカウントの削除', dangerLead: 'アカウントと、保存したタイマー・利用記録をすべて削除します。元に戻せません。',
      dangerOpen: 'アカウントを削除する', dangerType: '確認のため「削除」と入力してください', dangerWord: '削除',
      dangerGo: '完全に削除する', cancel: 'やめる',
      deleted: 'アカウントを削除しました。ご利用ありがとうございました。',
      loading: '読み込み中…', errLogin: 'ログインできませんでした。時間をおいてもう一度お試しください。',
      errDelete: '削除できませんでした。時間をおいてもう一度お試しいただくか、お問い合わせください。',
      errConfig: '設定の読み込みに失敗しました。',
      usageTitle: 'この7日間', total: '合計時間', runs: '回数', done: '完了', days: '使った日',
      usageNote: '直近7日間の記録です。タイマーを15秒以上動かすと記録されます。', usageEmpty: 'まだ記録がありません。ログインした状態でタイマーを使うと、ここに表示されます。',
      chartLabel: '日ごとの利用時間（分）', min: '分', h: '時間', dayFmt: function (d) { return (d.getMonth() + 1) + '/' + d.getDate(); },
      wd: ['日', '月', '火', '水', '木', '金', '土'], times: '回',
      streak: function (n) { return '🔥 ' + n + '日連続で使っています'; },
      streakKeep: function (n) { return '🔥 ' + n + '日連続中。今日も使うと' + (n + 1) + '日になります'; }
    },
    en: {
      title: 'Account', back: 'Back to the timer',
      leadOut: 'Sign in for free to save named timers, sync them between your phone and computer, and see your last 7 days of usage. The timer stays free to use without an account.',
      google: 'Sign in with Google',
      agree1: 'By signing in, you agree to our ', agreeP: 'Privacy Policy', agreeAnd: ' and ', agreeT: 'Terms of Use', agree2: '.',
      signedIn: 'Signed in', logout: 'Sign out',
      dangerTitle: 'Delete account', dangerLead: 'This deletes your account and all saved timers and history. It cannot be undone.',
      dangerOpen: 'Delete my account', dangerType: 'Type DELETE to confirm', dangerWord: 'DELETE',
      dangerGo: 'Delete permanently', cancel: 'Cancel',
      deleted: 'Your account has been deleted. Thank you for using ' + BRAND + '.',
      loading: 'Loading…', errLogin: 'Could not sign in. Please try again later.',
      errDelete: 'Could not delete your account. Please try again later or contact us.',
      errConfig: 'Failed to load settings.',
      usageTitle: 'Last 7 days', total: 'Total time', runs: 'Sessions', done: 'Completed', days: 'Active days',
      usageNote: 'Your history for the last 7 days. A session is recorded once a timer runs for 15 seconds.', usageEmpty: 'No history yet. Use the timer while signed in and it will appear here.',
      chartLabel: 'Minutes per day', min: 'min', h: 'h', dayFmt: function (d) { return (d.getMonth() + 1) + '/' + d.getDate(); },
      wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], times: '',
      streak: function (n) { return '🔥 ' + n + '-day streak'; },
      streakKeep: function (n) { return '🔥 ' + n + '-day streak. Use it today to make it ' + (n + 1); }
    },
    es: {
      title: 'Cuenta', back: 'Volver al temporizador',
      leadOut: 'Inicia sesión gratis para guardar temporizadores con nombre, sincronizarlos entre el móvil y el ordenador y ver tu uso de los últimos 7 días. El temporizador sigue siendo gratis sin cuenta.',
      google: 'Iniciar sesión con Google',
      agree1: 'Al iniciar sesión, aceptas nuestra ', agreeP: 'Política de privacidad', agreeAnd: ' y los ', agreeT: 'Términos de uso', agree2: '.',
      signedIn: 'Sesión iniciada', logout: 'Cerrar sesión',
      dangerTitle: 'Eliminar cuenta', dangerLead: 'Se eliminarán tu cuenta y todos tus temporizadores e historial. No se puede deshacer.',
      dangerOpen: 'Eliminar mi cuenta', dangerType: 'Escribe ELIMINAR para confirmar', dangerWord: 'ELIMINAR',
      dangerGo: 'Eliminar definitivamente', cancel: 'Cancelar',
      deleted: 'Tu cuenta se ha eliminado. Gracias por usar ' + BRAND + '.',
      loading: 'Cargando…', errLogin: 'No se pudo iniciar sesión. Inténtalo más tarde.',
      errDelete: 'No se pudo eliminar la cuenta. Inténtalo más tarde o contáctanos.',
      errConfig: 'No se pudo cargar la configuración.',
      usageTitle: 'Últimos 7 días', total: 'Tiempo total', runs: 'Sesiones', done: 'Completadas', days: 'Días activos',
      usageNote: 'Tu historial de los últimos 7 días. Se registra una sesión cuando el temporizador funciona 15 segundos.', usageEmpty: 'Aún no hay historial. Usa el temporizador con la sesión iniciada y aparecerá aquí.',
      chartLabel: 'Minutos por día', min: 'min', h: 'h', dayFmt: function (d) { return d.getDate() + '/' + (d.getMonth() + 1); },
      wd: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], times: '',
      streak: function (n) { return '🔥 Racha de ' + n + (n === 1 ? ' día' : ' días'); },
      streakKeep: function (n) { return '🔥 Racha de ' + n + (n === 1 ? ' día' : ' días') + '. Úsalo hoy para llegar a ' + (n + 1); }
    }
  }[lang];

  /* ---------- 小さなDOMヘルパー（textContentのみ） ---------- */
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
  var root = document.getElementById('acct');
  function show(nodes) { root.textContent = ''; nodes.forEach(function (n) { root.appendChild(n); }); }
  function msg(text, cls) { return el('p', { cls: 'acct-msg ' + (cls || ''), role: 'status', text: text }); }

  document.title = T.title + ' - ' + BRAND;
  document.getElementById('acct-title').textContent = T.title;
  var logo = document.getElementById('acct-logo'); logo.href = HOME;
  var back = document.getElementById('acct-back'); back.href = HOME; back.textContent = T.back;
  show([msg(T.loading)]);

  if (!window.supabase || SB_KEY.indexOf('__') === 0) { show([msg(T.errConfig, 'err')]); return; }
  var sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  function cleanUrl() {
    History.prototype.replaceState.call(history, null, '', '/account?l=' + lang);
  }

  function renderSignedOut(errText) {
    var btn = el('button', { type: 'button', cls: 'acct-btn acct-google' }, [
      el('span', { cls: 'g', 'aria-hidden': 'true', text: 'G' }), T.google
    ]);
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      ev('login_start', { method: 'google' });
      var r = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + '/account?l=' + lang }
      });
      if (r.error) { btn.disabled = false; show([msg(T.errLogin, 'err')].concat(signedOutNodes(btn))); }
    });
    var nodes = signedOutNodes(btn);
    if (errText) nodes.unshift(msg(errText, 'err'));
    show(nodes);
  }
  function signedOutNodes(btn) {
    return [
      el('p', { cls: 'acct-lead', text: T.leadOut }),
      btn,
      el('p', { cls: 'acct-small' }, [
        T.agree1, el('a', { href: PRIV, text: T.agreeP }), T.agreeAnd,
        el('a', { href: TERMS, text: T.agreeT }), T.agree2
      ])
    ];
  }

  function renderSignedIn(user) {
    var meta = user.user_metadata || {};
    var who = el('div', { cls: 'acct-card' }, [
      el('p', { cls: 'acct-label', text: T.signedIn }),
      el('p', { cls: 'acct-name', text: meta.full_name || meta.name || '' }),
      el('p', { cls: 'acct-email', text: user.email || '' })
    ]);
    var out = el('button', { type: 'button', cls: 'acct-btn', text: T.logout });
    out.addEventListener('click', async function () {
      out.disabled = true;
      await sb.auth.signOut({ scope: 'local' });
      ev('logout');
      renderSignedOut();
    });

    /* 退会（2段階: ボタン → 単語入力で有効化） */
    var danger = el('section', { cls: 'acct-danger' }, [
      el('h2', { text: T.dangerTitle }), el('p', { cls: 'acct-small', text: T.dangerLead })
    ]);
    var open = el('button', { type: 'button', cls: 'acct-btn acct-btn-danger-outline', text: T.dangerOpen });
    danger.appendChild(open);
    open.addEventListener('click', function () {
      open.hidden = true;
      var input = el('input', { type: 'text', cls: 'acct-input', 'aria-label': T.dangerType, placeholder: T.dangerWord, autocomplete: 'off' });
      var go = el('button', { type: 'button', cls: 'acct-btn acct-btn-danger', text: T.dangerGo });
      var cancel = el('button', { type: 'button', cls: 'acct-btn', text: T.cancel });
      go.disabled = true;
      input.addEventListener('input', function () { go.disabled = input.value.trim() !== T.dangerWord; });
      cancel.addEventListener('click', function () { box.remove(); open.hidden = false; });
      go.addEventListener('click', async function () {
        go.disabled = true; cancel.disabled = true; input.disabled = true;
        var r = await sb.rpc('delete_my_account');
        if (r.error) {
          go.disabled = false; cancel.disabled = false; input.disabled = false;
          box.appendChild(msg(T.errDelete, 'err'));
          return;
        }
        ev('account_delete');
        try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
        show([msg(T.deleted)]);
      });
      var box = el('div', { cls: 'acct-confirm' }, [
        el('label', { cls: 'acct-small', text: T.dangerType }), input,
        el('div', { cls: 'acct-row' }, [go, cancel])
      ]);
      danger.appendChild(box);
      input.focus();
    });

    var usage = el('section', { cls: 'acct-usage', 'aria-label': T.usageTitle }, [el('h2', { text: T.usageTitle }), msg(T.loading)]);
    show([who, usage, el('div', { cls: 'acct-row' }, [out]), danger]);
    loadUsage(usage);
  }

  /* ---------- 直近7日の利用記録 ---------- */
  function fmtDur(sec) {
    var m = Math.round(sec / 60);
    if (m < 60) return m + T.min;
    return Math.floor(m / 60) + T.h + (lang === 'ja' ? '' : ' ') + (m % 60) + T.min;
  }
  async function loadUsage(box) {
    var start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    var r = await sb.from('usage_logs').select('started_at,total_secs,completed')
      .eq('product', 'timertrain').gte('started_at', start.toISOString())
      .order('started_at', { ascending: true }).limit(2100);
    box.textContent = '';
    box.appendChild(el('h2', { text: T.usageTitle }));
    if (r.error) { box.appendChild(msg(T.errLogin, 'err')); return; }
    var rows = r.data || [];
    if (!rows.length) { box.appendChild(el('p', { cls: 'acct-small', text: T.usageEmpty })); return; }
    var days = [];
    for (var i = 0; i < 7; i++) { var d = new Date(start); d.setDate(start.getDate() + i); days.push({ d: d, secs: 0, n: 0 }); }
    var total = 0, done = 0;
    rows.forEach(function (x) {
      var t = new Date(x.started_at); var idx = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - start) / 86400000);
      var s = Math.max(0, Number(x.total_secs) || 0);
      if (idx >= 0 && idx < 7) { days[idx].secs += s; days[idx].n++; }
      total += s; if (x.completed) done++;
    });
    var active = days.filter(function (d) { return d.n > 0; }).length;
    function tile(label, value) { return el('div', { cls: 'acct-tile' }, [el('p', { cls: 'acct-tile-v', text: value }), el('p', { cls: 'acct-tile-l', text: label })]); }
    var streakEl = el('p', { cls: 'acct-streak' });
    box.appendChild(streakEl);
    loadStreak(streakEl);
    box.appendChild(el('div', { cls: 'acct-tiles' }, [
      tile(T.total, fmtDur(total)), tile(T.runs, String(rows.length)), tile(T.done, String(done)), tile(T.days, active + '/7')
    ]));
    var max = Math.max.apply(null, days.map(function (d) { return d.secs; })) || 1;
    var chart = el('div', { cls: 'acct-chart', role: 'img', 'aria-label': T.chartLabel + ': ' + days.map(function (d) { return T.dayFmt(d.d) + ' ' + Math.round(d.secs / 60) + T.min; }).join(', ') });
    days.forEach(function (d, i) {
      var col = el('div', { cls: 'acct-bar-col' + (i === 6 ? ' today' : ''), title: T.dayFmt(d.d) + ' ' + fmtDur(d.secs) + (d.n ? ' · ' + d.n + (T.times || '×') : '') });
      var val = el('span', { cls: 'acct-bar-val', text: d.secs && (i === 6 || d.secs === max) ? String(Math.round(d.secs / 60)) : '' });
      var track = el('div', { cls: 'acct-bar-track' });
      var bar = el('div', { cls: 'acct-bar' });
      bar.style.height = (d.secs ? Math.max(3, Math.round(d.secs / max * 100)) : 0) + '%';
      track.appendChild(bar);
      col.appendChild(val); col.appendChild(track);
      col.appendChild(el('span', { cls: 'acct-bar-day', text: T.wd[d.d.getDay()] }));
      col.appendChild(el('span', { cls: 'acct-bar-date', text: T.dayFmt(d.d) }));
      chart.appendChild(col);
    });
    box.appendChild(el('p', { cls: 'acct-chart-title', text: T.chartLabel }));
    box.appendChild(chart);
    box.appendChild(el('p', { cls: 'acct-small', text: T.usageNote }));
    ev('usage_view', { sessions: rows.length });
  }

  /* ---------- 連続日数（今日か昨日までさかのぼって、続けて使った日数） ---------- */
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  async function loadStreak(p) {
    try {
      var since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 120);
      var r = await sb.from('usage_logs').select('started_at')
        .eq('product', 'timertrain').gte('started_at', since.toISOString())
        .order('started_at', { ascending: false }).limit(5000);
      if (r.error || !r.data) return;
      var set = {};
      r.data.forEach(function (x) { set[dayKey(new Date(x.started_at))] = 1; });
      var d = new Date(); d.setHours(0, 0, 0, 0);
      var today = !!set[dayKey(d)];
      if (!today) d.setDate(d.getDate() - 1);
      var n = 0;
      while (set[dayKey(d)] && n < 121) { n++; d.setDate(d.getDate() - 1); }
      if (n < 1) return;
      p.textContent = today ? T.streak(n) : T.streakKeep(n);
    } catch (e) {}
  }

  (async function init() {
    var urlErr = params.get('error_description') || params.get('error');
    var hadCode = params.has('code');
    var r = await sb.auth.getSession();
    if (hadCode || urlErr) cleanUrl();
    if (urlErr || r.error) { renderSignedOut(T.errLogin); return; }
    var session = r.data && r.data.session;
    if (session) {
      if (hadCode) ev('login_success', { method: 'google' });
      ev('account_view', { signed_in: 1 });
      renderSignedIn(session.user);
    } else {
      ev('account_view', { signed_in: 0 });
      renderSignedOut();
    }
    sb.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT') renderSignedOut();
    });
  })().catch(function () { renderSignedOut(T.errLogin); });
})();
