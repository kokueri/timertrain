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
  // ドーナツ版から来た人は戻り先をドーナツ版に（Googleログインで行って戻っても同じタブなら覚えている）
  try { if (params.get('from') === 'donut') sessionStorage.setItem('tt-from', 'donut'); } catch (e) {}
  try { if (sessionStorage.getItem('tt-from') === 'donut') HOME = { ja: '/donut/', en: '/donut/en', es: '/donut/es' }[lang] || HOME; } catch (e) {}
  var PRIV = { ja: '/privacy', en: '/en-privacy', es: '/es-privacy' }[lang];
  var TERMS = { ja: '/terms', en: '/en-terms', es: '/es-terms' }[lang];
  var T = {
    ja: {
      title: 'アカウント', back: 'タイマーに戻る',
      leadOut: 'タイマーはこれまでどおり、ログインしなくても無料で使えます。Googleで無料ログインすると、次のことができるようになります。',
      perksTitle: '無料ログインでできること',
      perks: [
        ['マイタイマー', '「勉強」「HIIT」など、よく使う編成に名前を付けて2つまで保存。ワンタップで呼び出せます'],
        ['スマホとPCで同じ設定', '同じGoogleアカウントでログインすれば、PCで保存したマイタイマーをスマホでもそのまま使えます。「最近の編成」とライト／ダークの設定も、どちらの端末にも反映されます'],
        ['7日間の利用記録', 'タイマーを動かした時間を自動で記録。合計時間・回数・日ごとのグラフで振り返れます（一時停止中は数えません）'],
        ['連続日数', '何日続けて使っているかが分かります'],
        ['いつでも退会', 'アカウントと保存したデータは、このページからいつでも削除できます']
      ],
      pjTitle: 'プロジェクト（この7日間）', pjNew: '＋ プロジェクトを作る', pjNamePh: 'プロジェクト名（例: 勉強）', pjOk: '作る', pjNone: 'プロジェクトなし',
      pjEmpty: 'マイタイマーをプロジェクトにまとめると、ここにプロジェクトごと・区切り（ラベル）ごとの時間が出ます。下の「マイタイマー」で、それぞれのプロジェクトを選んでください。',
      pjOther: 'マイタイマー以外', pjNoSeg: '（区切りの記録なし）', pjNoLabel: '（名前なし）', pjBreak: '休憩（合計に入れない）',
      pjToBreak: '休憩にする', pjToWork: '合計に入れる', pjRename: '名前を変更', pjDel: '削除', pjDelQ: '削除する？（マイタイマーは残ります）', pjSave: '保存',
      pjSel: 'プロジェクト', pjNewOpt: '＋ 新しいプロジェクト…', pjTotal: '合計', pjNote: '「休憩」「Break」などの名前は自動で休憩として合計から外します。違うときは「合計に入れる」を押してください。区切りごとの記録は 2026/10/25 から始まりました。',
      pjErr: '保存できませんでした。時間をおいてもう一度お試しください。',
      pjFull: '無料プランで作れるプロジェクトは1つまでです。名前を変えて使うか、削除してから作り直せます。プレミアム（準備中）では無制限になります。',
      myTitle: 'マイタイマー', myEmpty: 'まだ保存したタイマーはありません。タイマーの画面で「今の編成を保存」を押すと、ここに並びます。',
      start: 'スタート', data: 'データ', soon: '近日公開',
      myNote: '「データ」では、マイタイマーごとの利用時間を見られるようにする予定です（準備中）。',
      sum: function (n, t, r) { return 'タイマー' + n + 'つ・1周 ' + t + (r === 'inf' ? '・くり返し∞' : '・' + r + '周'); },
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
      leadOut: 'The timer stays free to use without an account. Sign in with Google for free and you also get:',
      perksTitle: 'What a free account adds',
      perks: [
        ['My timers', 'Save up to 2 setups you use often, like "Study" or "HIIT", under a name and open them in one tap'],
        ['Same setups on phone and computer', 'Sign in with the same Google account and the timers you saved on your computer are ready on your phone too. Recent setups and the light/dark theme follow you as well'],
        ['7-day history', 'The time your timer runs is logged automatically: total time, sessions and a daily chart (paused time is not counted)'],
        ['Streaks', 'See how many days in a row you have used it'],
        ['Leave any time', 'Delete your account and everything you saved from this page whenever you like']
      ],
      pjTitle: 'Projects (last 7 days)', pjNew: '+ New project', pjNamePh: 'Project name (e.g. Study)', pjOk: 'Create', pjNone: 'No project',
      pjEmpty: 'Group your saved timers into projects to see time per project and per segment (label) here. Pick a project for each timer under "My timers" below.',
      pjOther: 'Not a saved timer', pjNoSeg: '(no segment data)', pjNoLabel: '(no name)', pjBreak: 'Breaks (not counted)',
      pjToBreak: 'Mark as break', pjToWork: 'Count it', pjRename: 'Rename', pjDel: 'Delete', pjDelQ: 'Delete? (Timers are kept)', pjSave: 'Save',
      pjSel: 'Project', pjNewOpt: '+ New project…', pjTotal: 'Total', pjNote: 'Names like "Break" or "Rest" are treated as breaks and left out of the totals. If that is wrong, press "Count it". Segment data started on 2026-10-25.',
      pjErr: 'Could not save. Please try again later.',
      pjFull: 'The free plan has 1 project. Rename it, or delete it and make a new one. Unlimited with Premium (coming soon).',
      myTitle: 'My timers', myEmpty: 'No saved timers yet. On the timer screen, press "Save current setup" and they will appear here.',
      start: 'Start', data: 'Data', soon: 'Coming soon',
      myNote: '"Data" will show how much you used each saved timer (in preparation).',
      sum: function (n, t, r) { return n + (n === 1 ? ' timer' : ' timers') + ' · ' + t + ' per round' + (r === 'inf' ? ' · repeats ∞' : ' · ' + r + (r === '1' ? ' round' : ' rounds')); },
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
      leadOut: 'El temporizador sigue siendo gratis sin cuenta. Si inicias sesión gratis con Google, además puedes:',
      perksTitle: 'Lo que añade una cuenta gratis',
      perks: [
        ['Mis temporizadores', 'Guarda con nombre hasta 2 configuraciones que más usas, como «Estudio» o «HIIT», y ábrelas con un toque'],
        ['Lo mismo en el móvil y el ordenador', 'Con la misma cuenta de Google, los temporizadores que guardes en el ordenador estarán listos en el móvil. Las configuraciones recientes y el tema claro/oscuro también se sincronizan'],
        ['Historial de 7 días', 'Se registra automáticamente el tiempo de uso: tiempo total, sesiones y un gráfico por día (las pausas no cuentan)'],
        ['Rachas', 'Mira cuántos días seguidos lo has usado'],
        ['Baja cuando quieras', 'Puedes eliminar tu cuenta y todo lo guardado desde esta página en cualquier momento']
      ],
      pjTitle: 'Proyectos (últimos 7 días)', pjNew: '+ Nuevo proyecto', pjNamePh: 'Nombre del proyecto (p. ej. Estudio)', pjOk: 'Crear', pjNone: 'Sin proyecto',
      pjEmpty: 'Agrupa tus temporizadores en proyectos para ver aquí el tiempo por proyecto y por etapa (etiqueta). Elige un proyecto para cada temporizador en «Mis temporizadores».',
      pjOther: 'No es un temporizador guardado', pjNoSeg: '(sin datos por etapa)', pjNoLabel: '(sin nombre)', pjBreak: 'Descansos (no cuentan)',
      pjToBreak: 'Marcar como descanso', pjToWork: 'Contarlo', pjRename: 'Renombrar', pjDel: 'Eliminar', pjDelQ: '¿Eliminar? (los temporizadores se conservan)', pjSave: 'Guardar',
      pjSel: 'Proyecto', pjNewOpt: '+ Nuevo proyecto…', pjTotal: 'Total', pjNote: 'Los nombres como «Descanso» o «Break» se toman como descansos y no cuentan en el total. Si no es así, pulsa «Contarlo». Los datos por etapa empezaron el 25/10/2026.',
      pjErr: 'No se pudo guardar. Inténtalo más tarde.',
      pjFull: 'El plan gratis tiene 1 proyecto. Cámbiale el nombre o elimínalo y crea otro. Ilimitados con Premium (próximamente).',
      myTitle: 'Mis temporizadores', myEmpty: 'Aún no hay temporizadores guardados. En la pantalla del temporizador, pulsa «Guardar configuración actual» y aparecerán aquí.',
      start: 'Empezar', data: 'Datos', soon: 'Próximamente',
      myNote: 'En «Datos» podrás ver cuánto has usado cada temporizador guardado (en preparación).',
      sum: function (n, t, r) { return n + (n === 1 ? ' temporizador' : ' temporizadores') + ' · ' + t + ' por ronda' + (r === 'inf' ? ' · repetir ∞' : ' · ' + r + (r === '1' ? ' ronda' : ' rondas')); },
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

  /* ---------- プランの比較（無料ログイン／プレミアム準備中） ---------- */
  var FREE_MAX = 2;
  var P = {
    ja: {
      title: 'プランの比較', cols: ['ログイン\nなし', '無料\nログイン', 'プレミアム'], soon: '準備中', now: '無料プラン',
      yes: 'あり', no: 'なし',
      rows: [
        ['タイマーを使う（並べる・くり返し・共有）', true, true, true],
        ['マイタイマーの保存', false, '2つ', '無制限'],
        ['スマホとPCで同じ設定', false, true, true],
        ['利用記録', false, '7日間', '全期間・月／年のグラフ'],
        ['連続日数', false, true, true],
        ['マイプロジェクト（勉強・仕事などに分けて集計）', false, '1つ', '無制限'],
        ['記録のCSVダウンロード', false, false, true],
        ['ミニプレーヤー（小窓で表示）', false, false, true]
      ],
      note: 'プレミアムは準備中です。料金や開始時期は、決まりしだいこのページでお知らせします。今あるタイマーの機能は、これからもログインなしで無料で使えます。',
      quota: function (n) { return n > FREE_MAX ? '保存中のマイタイマー ' + n + '個（無料プランで新しく保存できるのは2つまで）' : 'マイタイマー ' + n + ' / ' + FREE_MAX + '（プレミアムで無制限・準備中）'; }
    },
    en: {
      title: 'Compare plans', cols: ['No\naccount', 'Free\naccount', 'Premium'], soon: 'Coming soon', now: 'Free plan',
      yes: 'Included', no: 'Not included',
      rows: [
        ['Use the timer (chain, repeat, share)', true, true, true],
        ['Saved timers', false, '2', 'No limit'],
        ['Same setups on phone and computer', false, true, true],
        ['History', false, '7 days', 'All time + charts'],
        ['Streaks', false, true, true],
        ['Projects (track study, work, etc. separately)', false, '1', 'No limit'],
        ['Download history as CSV', false, false, true],
        ['Mini player (small floating window)', false, false, true]
      ],
      note: 'Premium is in preparation. We will announce the price and launch date on this page. Everything the timer does today stays free without an account.',
      quota: function (n) { return n > FREE_MAX ? n + ' saved timers (the free plan can save new ones up to 2)' : 'Saved timers ' + n + ' / ' + FREE_MAX + ' (unlimited with Premium, coming soon)'; }
    },
    es: {
      title: 'Comparar planes', cols: ['Sin\ncuenta', 'Cuenta\ngratis', 'Premium'], soon: 'Próximamente', now: 'Plan gratis',
      yes: 'Incluido', no: 'No incluido',
      rows: [
        ['Usar el temporizador (encadenar, repetir, compartir)', true, true, true],
        ['Temporizadores guardados', false, '2', 'Sin límite'],
        ['Lo mismo en el móvil y el ordenador', false, true, true],
        ['Historial', false, '7 días', 'Todo + gráficos'],
        ['Rachas', false, true, true],
        ['Proyectos (estudio, trabajo, etc. por separado)', false, '1', 'Sin límite'],
        ['Descargar el historial en CSV', false, false, true],
        ['Minirreproductor (ventana flotante)', false, false, true]
      ],
      note: 'Premium está en preparación. Anunciaremos el precio y la fecha en esta página. Todo lo que hace el temporizador hoy sigue siendo gratis sin cuenta.',
      quota: function (n) { return n > FREE_MAX ? n + ' temporizadores guardados (el plan gratis permite guardar nuevos hasta 2)' : 'Temporizadores ' + n + ' / ' + FREE_MAX + ' (ilimitados con Premium, próximamente)'; }
    }
  }[lang];
  // cur: 強調する列（1=無料ログイン。ログイン前は「おすすめ」、ログイン中は「今のプラン」）
  function planTable(cur) {
    var head = el('tr', null, [el('td', { cls: 'acct-plans-blank' })].concat(P.cols.map(function (c, i) {
      return el('th', { scope: 'col', cls: i === cur ? 'cur' : '' }, [c, i === 2 ? el('span', { cls: 'acct-soon', text: P.soon }) : null]);
    })));
    var body = P.rows.map(function (r) {
      var th = el('th', { scope: 'row' }, [r[0], r[4] ? el('span', { cls: 'acct-soon', text: P.soon }) : null]);
      return el('tr', null, [th].concat(r.slice(1, 4).map(function (v, i) {
        var cls = (i === cur ? 'cur ' : '') + (v === true ? 'yes' : v === false ? 'no' : 'val');
        var a = { cls: cls, text: v === true ? '✓' : v === false ? '—' : v };
        if (typeof v === 'boolean') a['aria-label'] = v ? P.yes : P.no;
        return el('td', a);
      })));
    });
    return el('section', { cls: 'acct-plans', 'aria-label': P.title }, [
      el('h2', { text: P.title }),
      el('div', { cls: 'acct-plans-wrap' }, [el('table', { cls: 'acct-plans-t' }, [el('colgroup', null, [el('col', { cls: 'c0' }), el('col'), el('col'), el('col')]), el('thead', null, [head]), el('tbody', null, body)])]),
      el('p', { cls: 'acct-small', text: P.note })
    ]);
  }

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
      el('section', { cls: 'acct-perks', 'aria-label': T.perksTitle }, [
        el('h2', { text: T.perksTitle }),
        el('ul', { cls: 'acct-checklist' }, T.perks.map(function (p) {
          return el('li', null, [el('span', { cls: 'acct-check', 'aria-hidden': 'true', text: '✓' }),
            el('div', null, [el('p', { cls: 'acct-perk-t', text: p[0] }), el('p', { cls: 'acct-perk-d', text: p[1] })])]);
        }))
      ]),
      btn,
      el('p', { cls: 'acct-small' }, [
        T.agree1, el('a', { href: PRIV, text: T.agreeP }), T.agreeAnd,
        el('a', { href: TERMS, text: T.agreeT }), T.agree2
      ]),
      planTable(1)
    ];
  }

  function renderSignedIn(user) {
    var meta = user.user_metadata || {};
    var who = el('div', { cls: 'acct-card' }, [
      el('p', { cls: 'acct-label', text: T.signedIn }),
      el('p', { cls: 'acct-name', text: meta.full_name || meta.name || '' }),
      el('p', { cls: 'acct-email', text: user.email || '' }),
      el('p', { cls: 'acct-plan-now', text: P.now })
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
    var mine = el('section', { cls: 'acct-usage acct-my', 'aria-label': T.myTitle }, [el('h2', { text: T.myTitle }), msg(T.loading)]);
    var pj = el('section', { cls: 'acct-usage acct-pj', 'aria-label': T.pjTitle }, [el('h2', { text: T.pjTitle }), msg(T.loading)]);
    show([who, pj, mine, usage, planTable(1), el('div', { cls: 'acct-row' }, [out]), danger]);
    loadAll(pj, mine);
    loadUsage(usage);
  }

  /* ---------- マイタイマーの一覧（スタート＝そのページで開く、データ＝準備中） ---------- */
  var Q_RE = /^\?t=[A-Za-z0-9.,%_\-~!*'()]{1,7000}&r=(?:inf|\d{1,2})$/;
  var PAGE_RE = /^\/(?:donut\/)?[a-z0-9-]{0,40}$/;
  function fmtClock(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, p = function (n) { return (n < 10 ? '0' : '') + n; };
    return h ? h + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
  }
  function summary(q) {
    var mt = q.match(/^\?t=([^&]*)&r=(inf|\d{1,2})$/);
    if (!mt) return '';
    var items = mt[1].split(','), secs = 0;
    items.forEach(function (it) { var a = it.split('.'); secs += Math.max(0, parseInt(a[1], 10) || 0); });
    return T.sum(items.length, fmtClock(secs), mt[2]);
  }
  /* ---------- プロジェクト ----------
   * timers.project_id でマイタイマーをまとめ、usage_segments（区切りごとの秒数）をラベル＝区切りの名前ごとに合計する。
   * 「休憩」などの名前は自動で合計から外す。切り替えは settings.data.breaks（{ラベル: 1=休憩 / 0=合計に入れる}）に保存 */
  var DATA = { timers: [], projects: [], breaks: {} };
  var BREAK_RE = /休憩|きゅうけい|やすみ|break|rest|descanso|pausa|recreo/i;
  function isBreak(label) {
    if (Object.prototype.hasOwnProperty.call(DATA.breaks, label)) return DATA.breaks[label] === 1;
    return BREAK_RE.test(label);
  }
  async function saveBreak(label, v) {
    var r = await sb.from('settings').select('data').eq('product', 'timertrain').maybeSingle();
    if (r.error) return false;
    var data = (r.data && r.data.data && typeof r.data.data === 'object') ? r.data.data : {};
    var b = (data.breaks && typeof data.breaks === 'object') ? data.breaks : {};
    b[label] = v;
    var keys = Object.keys(b); if (keys.length > 200) delete b[keys[0]];
    data.breaks = b;
    var w = await sb.from('settings').upsert({ product: 'timertrain', data: data }, { onConflict: 'user_id,product' });
    if (w.error) return false;
    DATA.breaks = b; return true;
  }
  async function loadAll(pjBox, mineBox) {
    var r1 = await sb.from('timers').select('id,name,config,updated_at,project_id').eq('product', 'timertrain')
      .order('updated_at', { ascending: false }).limit(100);
    var r2 = await sb.from('projects').select('id,name,sort,created_at').eq('product', 'timertrain').order('sort').order('created_at').limit(100);
    var r3 = await sb.from('settings').select('data').eq('product', 'timertrain').maybeSingle();
    DATA.timers = r1.error ? [] : (r1.data || []);
    DATA.projects = r2.error ? [] : (r2.data || []);
    var sd = (!r3.error && r3.data && r3.data.data) || {};
    DATA.breaks = (sd.breaks && typeof sd.breaks === 'object') ? sd.breaks : {};
    renderMine(mineBox, r1.error);
    loadProjects(pjBox, mineBox, r2.error);
  }
  function projectSelect(cur, onPick) {
    var s = el('select', { cls: 'acct-select', 'aria-label': T.pjSel });
    s.appendChild(el('option', { value: '', text: T.pjNone }));
    DATA.projects.forEach(function (p) { var o = el('option', { value: p.id, text: p.name }); if (p.id === cur) o.selected = true; s.appendChild(o); });
    if (DATA.projects.length < PJ_FREE) s.appendChild(el('option', { value: '__new', text: T.pjNewOpt }));
    s.addEventListener('change', function () { onPick(s.value, s); });
    return s;
  }
  var PJ_FREE = 1; // 無料プランのプロジェクト数（サーバー側の制限は決済と一緒に入れる）
  async function createProject(name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) return null;
    if (DATA.projects.length >= PJ_FREE) { ev('project_limit'); return null; }
    var r = await sb.from('projects').insert({ product: 'timertrain', name: name, sort: DATA.projects.length }).select('id,name,sort,created_at').single();
    if (r.error || !r.data) return null;
    DATA.projects.push(r.data); ev('project_create', { count: DATA.projects.length });
    return r.data;
  }
  function nameForm(box, ph, init, okText, onOk) {
    var input = el('input', { type: 'text', cls: 'acct-input', maxlength: '40', placeholder: ph, 'aria-label': ph });
    input.value = init || '';
    var ok = el('button', { type: 'button', cls: 'acct-btn acct-btn-sm acct-btn-primary', text: okText });
    var no = el('button', { type: 'button', cls: 'acct-btn acct-btn-sm', text: T.cancel });
    var f = el('div', { cls: 'acct-pj-form' }, [input, ok, no]);
    no.addEventListener('click', function () { f.remove(); });
    async function go() { var v = input.value.trim(); if (!v) { input.focus(); return; } ok.disabled = true; var done = await onOk(v); if (done === false) { ok.disabled = false; box.appendChild(msg(T.pjErr, 'err')); } else f.remove(); }
    ok.addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(); } });
    box.appendChild(f); input.focus();
    return f;
  }
  function renderMine(box, err) {
    box.textContent = '';
    box.appendChild(el('h2', { text: T.myTitle }));
    if (err) { box.appendChild(msg(T.errLogin, 'err')); return; }
    var rows = DATA.timers.filter(function (x) { return x.config && typeof x.config.q === 'string' && Q_RE.test(x.config.q); });
    if (!rows.length) { box.appendChild(el('p', { cls: 'acct-small', text: T.myEmpty })); }
    else {
      var ul = el('ul', { cls: 'acct-mylist' });
      rows.forEach(function (x) {
        var page = (typeof x.config.page === 'string' && PAGE_RE.test(x.config.page)) ? x.config.page : HOME;
        var go = el('a', { cls: 'acct-btn acct-btn-sm acct-btn-primary', href: page + x.config.q, text: T.start });
        go.addEventListener('click', function () { ev('mytimer_start_from_account'); });
        var li = el('li');
        var sel = projectSelect(x.project_id || '', async function (v, s) {
          if (v === '__new') {
            s.value = x.project_id || '';
            nameForm(li, T.pjNamePh, '', T.pjOk, async function (name) {
              var p = await createProject(name); if (!p) return false;
              return await assign(p.id);
            });
            return;
          }
          await assign(v || null);
        });
        async function assign(pid) {
          var r = await sb.from('timers').update({ project_id: pid }).eq('id', x.id).select('id').single();
          if (r.error) { li.appendChild(msg(T.pjErr, 'err')); return false; }
          x.project_id = pid; ev('project_assign');
          refresh(); return true;
        }
        li.appendChild(el('div', { cls: 'acct-my-info' }, [el('p', { cls: 'acct-my-name', text: x.name || '' }), el('p', { cls: 'acct-my-sum', text: summary(x.config.q) })]));
        li.appendChild(el('div', { cls: 'acct-my-actions' }, [sel, go]));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    box.appendChild(el('p', { cls: 'acct-small acct-quota', text: P.quota(rows.length) }));
  }
  var refresh = function () {};
  async function loadProjects(box, mineBox, err) {
    refresh = function () { renderMine(mineBox, false); loadProjects(box, mineBox, false); };
    var start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    var rl = await sb.from('usage_logs').select('id,started_at,total_secs,timer_id').eq('product', 'timertrain')
      .gte('started_at', start.toISOString()).limit(2100);
    var rs = await sb.from('usage_segments').select('log_id,label,secs').eq('product', 'timertrain')
      .gte('started_at', new Date(start.getTime() - 86400000).toISOString()).limit(10000);
    box.textContent = '';
    box.appendChild(el('h2', { text: T.pjTitle }));
    if (err || rl.error) { box.appendChild(msg(T.errLogin, 'err')); return; }
    var segsByLog = {};
    (rs.error ? [] : rs.data || []).forEach(function (s) { (segsByLog[s.log_id] = segsByLog[s.log_id] || []).push(s); });
    var tmap = {}; DATA.timers.forEach(function (t) { tmap[t.id] = t; });
    // プロジェクトごと → ラベルごとの秒数
    var buckets = {};
    function bucket(key) { return buckets[key] = buckets[key] || { labels: {}, total: 0, brk: 0 }; }
    (rl.data || []).forEach(function (l) {
      var t = l.timer_id && tmap[l.timer_id];
      var key = t ? (t.project_id || '__none') : '__other';
      var b = bucket(key);
      var segs = segsByLog[l.id];
      var list = segs && segs.length ? segs.map(function (s) { return { label: s.label || '', secs: s.secs, seg: true }; })
        : [{ label: '\u0000', secs: Math.max(0, Number(l.total_secs) || 0), seg: false }];
      list.forEach(function (s) {
        b.labels[s.label] = (b.labels[s.label] || 0) + s.secs;
        if (s.label !== '\u0000' && isBreak(s.label)) b.brk += s.secs; else b.total += s.secs;
      });
    });
    var order = DATA.projects.map(function (p) { return { key: p.id, name: p.name, p: p }; });
    order.push({ key: '__none', name: T.pjNone }, { key: '__other', name: T.pjOther });
    var max = 1; order.forEach(function (o) { if (buckets[o.key]) max = Math.max(max, buckets[o.key].total); });
    var anyProject = DATA.projects.length > 0;
    if (!anyProject) box.appendChild(el('p', { cls: 'acct-small', text: T.pjEmpty }));
    var list = el('div', { cls: 'acct-pj-list' });
    order.forEach(function (o) {
      var b = buckets[o.key];
      if (!o.p && !b) return; // 使っていない「なし」「以外」は出さない
      if (!anyProject && o.key !== '__none' && o.key !== '__other') return;
      b = b || { labels: {}, total: 0, brk: 0 };
      var card = el('div', { cls: 'acct-pj' });
      var head = el('div', { cls: 'acct-pj-head' }, [el('p', { cls: 'acct-pj-name', text: o.name }), el('p', { cls: 'acct-pj-total', text: fmtDur(b.total) })]);
      card.appendChild(head);
      var bar = el('div', { cls: 'acct-pj-bar' }); var fill = el('div', { cls: 'acct-pj-fill' }); fill.style.width = Math.round(b.total / max * 100) + '%'; bar.appendChild(fill); card.appendChild(bar);
      var labels = Object.keys(b.labels).sort(function (a, c) { return b.labels[c] - b.labels[a]; });
      var work = labels.filter(function (l) { return l === '\u0000' || !isBreak(l); }), brk = labels.filter(function (l) { return l !== '\u0000' && isBreak(l); });
      function row(l, isB) {
        var name = l === '\u0000' ? T.pjNoSeg : (l || T.pjNoLabel);
        var r = el('li', { cls: 'acct-pj-row' + (isB ? ' brk' : '') }, [el('span', { cls: 'acct-pj-lab', text: name }), el('span', { cls: 'acct-pj-sec', text: fmtDur(b.labels[l]) })]);
        if (l !== '\u0000') {
          var t = el('button', { type: 'button', cls: 'acct-pj-tog', text: isB ? T.pjToWork : T.pjToBreak });
          t.addEventListener('click', async function () { t.disabled = true; var ok = await saveBreak(l, isB ? 0 : 1); if (!ok) { t.disabled = false; card.appendChild(msg(T.pjErr, 'err')); return; } ev('label_break_toggle'); refresh(); });
          r.appendChild(t);
        }
        return r;
      }
      if (work.length) card.appendChild(el('ul', { cls: 'acct-pj-rows' }, work.map(function (l) { return row(l, false); })));
      if (brk.length) {
        card.appendChild(el('p', { cls: 'acct-pj-sub', text: T.pjBreak + ' ' + fmtDur(b.brk) }));
        card.appendChild(el('ul', { cls: 'acct-pj-rows' }, brk.map(function (l) { return row(l, true); })));
      }
      if (o.p) {
        var acts = el('div', { cls: 'acct-pj-acts' });
        var rn = el('button', { type: 'button', cls: 'acct-pj-tog', text: T.pjRename });
        rn.addEventListener('click', function () {
          nameForm(card, T.pjNamePh, o.p.name, T.pjSave, async function (name) {
            var r = await sb.from('projects').update({ name: name.slice(0, 40) }).eq('id', o.p.id).select('id').single();
            if (r.error) return false; o.p.name = name.slice(0, 40); refresh(); return true;
          });
        });
        var del = el('button', { type: 'button', cls: 'acct-pj-tog', text: T.pjDel });
        del.addEventListener('click', function () {
          if (acts.querySelector('.acct-pj-yes')) return;
          var yes = el('button', { type: 'button', cls: 'acct-pj-tog acct-pj-yes', text: T.pjDelQ });
          yes.addEventListener('click', async function () {
            yes.disabled = true;
            var r = await sb.from('projects').delete().eq('id', o.p.id);
            if (r.error) { yes.disabled = false; card.appendChild(msg(T.pjErr, 'err')); return; }
            DATA.projects = DATA.projects.filter(function (p) { return p.id !== o.p.id; });
            DATA.timers.forEach(function (t) { if (t.project_id === o.p.id) t.project_id = null; });
            ev('project_delete'); refresh();
          });
          acts.appendChild(yes);
        });
        acts.appendChild(rn); acts.appendChild(del);
        card.appendChild(acts);
      }
      list.appendChild(card);
    });
    box.appendChild(list);
    if (DATA.projects.length >= PJ_FREE) { box.appendChild(el('p', { cls: 'acct-small acct-quota', text: T.pjFull })); box.appendChild(el('p', { cls: 'acct-small', text: T.pjNote })); return; }
    var add = el('button', { type: 'button', cls: 'acct-btn acct-btn-sm', text: T.pjNew });
    add.addEventListener('click', function () {
      nameForm(box, T.pjNamePh, '', T.pjOk, async function (name) { var p = await createProject(name); if (!p) return false; refresh(); return true; });
    });
    box.appendChild(add);
    box.appendChild(el('p', { cls: 'acct-small', text: T.pjNote }));
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
