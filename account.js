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
        ['マイタイマー', '「勉強」「HIIT」など、よく使う編成に名前を付けて2つまで保存。スマホでもPCでも、ワンタップで呼び出せます'],
        ['7日間のデータ（グラフ）', 'タイマーを動かした時間を自動で記録。合計時間・回数・日ごとのグラフで振り返れます（一時停止中は数えません）'],
        ['連続日数', '何日続けて使っているかが分かります'],
        ['いつでも退会', 'アカウントと保存したデータは、このページからいつでも削除できます']
      ],
      pjTitle: 'プロジェクト（この7日間）', pjNew: '＋ プロジェクトを作る', pjNamePh: 'プロジェクト名（例: 勉強）', pjOk: '作る', pjNone: 'プロジェクトなし',
      pjEmpty: 'マイタイマーをプロジェクトにまとめると、ここにプロジェクトごと・区切り（ラベル）ごとの時間が出ます。下の「マイタイマー」で、それぞれのプロジェクトを選んでください。',
      pjOther: 'マイタイマー以外', pjByTimer: 'マイタイマーごと: ', pjNoSeg: '（区切りの記録なし）', pjNoLabel: '（名前なし）', pjBreak: '休憩（合計に入れない）',
      pjToBreak: '休憩にする', pjToWork: '合計に入れる', pjRename: '名前を変更', pjDel: '削除', pjDelQ: '削除する？（マイタイマーは残ります）', pjSave: '保存',
      pjSel: 'プロジェクト', pjNewOpt: '＋ 新しいプロジェクト…', pjTotal: '合計', pjNote: '「休憩」「Break」などの名前は自動で休憩として合計から外します。違うときは「合計に入れる」を押してください。区切りごとの記録は 2026/10/25 から始まりました。',
      pjErr: '保存できませんでした。時間をおいてもう一度お試しください。',
      pjFull: '無料プランで作れるプロジェクトは1つまでです。名前を変えて使うか、削除してから作り直せます。プレミアムでは無制限になります。',
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
        ['My timers', 'Save up to 2 setups you use often, like "Study" or "HIIT", under a name and open them in one tap on any device'],
        ['7-day stats and charts', 'The time your timer runs is logged automatically: total time, sessions and a daily chart (paused time is not counted)'],
        ['Streaks', 'See how many days in a row you have used it'],
        ['Leave any time', 'Delete your account and everything you saved from this page whenever you like']
      ],
      pjTitle: 'Projects (last 7 days)', pjNew: '+ New project', pjNamePh: 'Project name (e.g. Study)', pjOk: 'Create', pjNone: 'No project',
      pjEmpty: 'Group your saved timers into projects to see time per project and per segment (label) here. Pick a project for each timer under "My timers" below.',
      pjOther: 'Not a saved timer', pjByTimer: 'Per saved timer: ', pjNoSeg: '(no segment data)', pjNoLabel: '(no name)', pjBreak: 'Breaks (not counted)',
      pjToBreak: 'Mark as break', pjToWork: 'Count it', pjRename: 'Rename', pjDel: 'Delete', pjDelQ: 'Delete? (Timers are kept)', pjSave: 'Save',
      pjSel: 'Project', pjNewOpt: '+ New project…', pjTotal: 'Total', pjNote: 'Names like "Break" or "Rest" are treated as breaks and left out of the totals. If that is wrong, press "Count it". Segment data started on 2026-10-25.',
      pjErr: 'Could not save. Please try again later.',
      pjFull: 'The free plan has 1 project. Rename it, or delete it and make a new one. Unlimited with Premium.',
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
        ['Mis temporizadores', 'Guarda con nombre hasta 2 configuraciones que más usas, como «Estudio» o «HIIT», y ábrelas con un toque en cualquier dispositivo'],
        ['Datos y gráficos de 7 días', 'Se registra automáticamente el tiempo de uso: tiempo total, sesiones y un gráfico por día (las pausas no cuentan)'],
        ['Rachas', 'Mira cuántos días seguidos lo has usado'],
        ['Baja cuando quieras', 'Puedes eliminar tu cuenta y todo lo guardado desde esta página en cualquier momento']
      ],
      pjTitle: 'Proyectos (últimos 7 días)', pjNew: '+ Nuevo proyecto', pjNamePh: 'Nombre del proyecto (p. ej. Estudio)', pjOk: 'Crear', pjNone: 'Sin proyecto',
      pjEmpty: 'Agrupa tus temporizadores en proyectos para ver aquí el tiempo por proyecto y por etapa (etiqueta). Elige un proyecto para cada temporizador en «Mis temporizadores».',
      pjOther: 'No es un temporizador guardado', pjByTimer: 'Por temporizador: ', pjNoSeg: '(sin datos por etapa)', pjNoLabel: '(sin nombre)', pjBreak: 'Descansos (no cuentan)',
      pjToBreak: 'Marcar como descanso', pjToWork: 'Contarlo', pjRename: 'Renombrar', pjDel: 'Eliminar', pjDelQ: '¿Eliminar? (los temporizadores se conservan)', pjSave: 'Guardar',
      pjSel: 'Proyecto', pjNewOpt: '+ Nuevo proyecto…', pjTotal: 'Total', pjNote: 'Los nombres como «Descanso» o «Break» se toman como descansos y no cuentan en el total. Si no es así, pulsa «Contarlo». Los datos por etapa empezaron el 25/10/2026.',
      pjErr: 'No se pudo guardar. Inténtalo más tarde.',
      pjFull: 'El plan gratis tiene 1 proyecto. Cámbiale el nombre o elimínalo y crea otro. Ilimitados con Premium.',
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


  /* ---------- 使い方の例（プロジェクト → マイタイマー → ラベル） ---------- */
  var D2 = {
    ja: { pjTitle: 'プロジェクト', pjEmpty: 'マイタイマーをプロジェクトにまとめると、「データ」でプロジェクトごと・ラベル（区切りの名前）ごとの時間が見られます。下の「使い方の例」も参考にしてください。',
      pjTimers: 'マイタイマー: ', pjNoTimers: 'まだマイタイマーが入っていません（上の「マイタイマー」でプロジェクトを選べます）', pjNote: '「休憩」などの名前は自動で休憩として作業の時間から外します。切り替えは「データ」のラベルごとの表でできます。',
      dataTitle: 'データ（記録とグラフ）', dataLead: 'タイマー画面の「データ」で、作業の時間・使った日数・🔥連続日数と、プロジェクトやラベルごとのグラフが見られます。無料プランは直近7日間です。', dataBtn: 'データを見る' },
    en: { pjTitle: 'Projects', pjEmpty: 'Group your saved timers into projects to see time per project and per label (segment name) in Data. See "How it works" below for an example.',
      pjTimers: 'Saved timers: ', pjNoTimers: 'No saved timers in it yet (pick a project for a timer under "My timers" above)', pjNote: 'Names like "Break" are left out of work time automatically. You can change this in the label table in Data.',
      dataTitle: 'Data (history and charts)', dataLead: 'Open "Data" on the timer screen to see work time, days used, your 🔥 streak, and charts by project and label. The free plan shows the last 7 days.', dataBtn: 'Open Data' },
    es: { pjTitle: 'Proyectos', pjEmpty: 'Agrupa tus temporizadores en proyectos para ver en Datos el tiempo por proyecto y por etiqueta (nombre del tramo). Mira el ejemplo de abajo.',
      pjTimers: 'Temporizadores: ', pjNoTimers: 'Aún no tiene temporizadores (elige un proyecto para cada uno en «Mis temporizadores»)', pjNote: 'Los nombres como «Descanso» no cuentan como trabajo. Puedes cambiarlo en la tabla de etiquetas de Datos.',
      dataTitle: 'Datos (historial y gráficos)', dataLead: 'Abre «Datos» en la pantalla del temporizador para ver el tiempo de trabajo, los días de uso, tu racha 🔥 y gráficos por proyecto y etiqueta. El plan gratis muestra los últimos 7 días.', dataBtn: 'Ver datos' }
  }[lang];
  var HOW = {
    ja: {
      title: '使い方の例（プロジェクト・マイタイマー・ラベル）',
      lead: '「プロジェクト」の中に「マイタイマー」を入れます。マイタイマーの中の区切りの名前（国語・数学など）が「ラベル」です。それぞれの単位で、使った時間を集計できます。',
      kP: 'プロジェクト', kM: 'マイタイマー',
      tree: [['📚 勉強', [['平日', '国語 25分 → 休憩 5分 → 数学 25分'], ['休日', '国語 25分 → 休憩 5分 → 社会 25分']]],
             ['💪 筋トレ', [['朝トレ', 'スクワット 1分 → 休憩 30秒 → 腕立て 1分（×3回）']]]],
      resT: '1週間使うと、たとえば「勉強」はこう見えます',
      res: [['プロジェクトの合計', '勉強 6時間40分'], ['マイタイマーごと', '平日 4時間10分 ／ 休日 2時間30分'], ['ラベルごと', '国語 3時間20分 ・ 数学 2時間05分 ・ 社会 1時間15分']],
      resNote: '平日と休日の「国語」は、同じ名前なので合わせて数えます。「休憩」は自動で合計から外します。',
      plan: '無料ログインは、プロジェクト1つ・マイタイマー2つまで（この例なら「勉強」の平日と休日）。プレミアムでは、いくつでも作れます。'
    },
    en: {
      title: 'How it fits together (projects, timers, labels)',
      lead: 'Put your saved timers into a project. The name of each segment inside a timer (Math, Reading…) is its label. Time is totaled at every level.',
      kP: 'Project', kM: 'Saved timer',
      tree: [['📚 Study', [['Weekdays', 'Reading 25 min → Break 5 min → Math 25 min'], ['Weekend', 'Reading 25 min → Break 5 min → Science 25 min']]],
             ['💪 Workout', [['Morning', 'Squats 1 min → Break 30 s → Push-ups 1 min (×3)']]]],
      resT: 'After a week, "Study" might look like this',
      res: [['Project total', 'Study 6 h 40 min'], ['Per saved timer', 'Weekdays 4 h 10 min / Weekend 2 h 30 min'], ['Per label', 'Reading 3 h 20 min · Math 2 h 05 min · Science 1 h 15 min']],
      resNote: '"Reading" from both timers is counted together because the name is the same. Breaks are left out of the total automatically.',
      plan: 'A free account includes 1 project and 2 saved timers (here: Study with Weekdays and Weekend). Premium has no limit.'
    },
    es: {
      title: 'Cómo se organiza (proyectos, temporizadores, etiquetas)',
      lead: 'Agrupa tus temporizadores guardados en un proyecto. El nombre de cada etapa dentro de un temporizador (Lectura, Matemáticas…) es su etiqueta. El tiempo se suma en cada nivel.',
      kP: 'Proyecto', kM: 'Temporizador guardado',
      tree: [['📚 Estudio', [['Entre semana', 'Lectura 25 min → Descanso 5 min → Matemáticas 25 min'], ['Fin de semana', 'Lectura 25 min → Descanso 5 min → Ciencias 25 min']]],
             ['💪 Ejercicio', [['Mañana', 'Sentadillas 1 min → Descanso 30 s → Flexiones 1 min (×3)']]]],
      resT: 'Después de una semana, «Estudio» se vería así',
      res: [['Total del proyecto', 'Estudio 6 h 40 min'], ['Por temporizador', 'Entre semana 4 h 10 min / Fin de semana 2 h 30 min'], ['Por etiqueta', 'Lectura 3 h 20 min · Matemáticas 2 h 05 min · Ciencias 1 h 15 min']],
      resNote: '«Lectura» de los dos temporizadores se suma junta porque tiene el mismo nombre. Los descansos se quitan del total automáticamente.',
      plan: 'La cuenta gratis incluye 1 proyecto y 2 temporizadores guardados (aquí: Estudio con Entre semana y Fin de semana). Premium no tiene límite.'
    }
  }[lang];
  function howTo(open) {
    var d = el('details', { cls: 'acct-howto' });
    if (open) d.open = true;
    d.appendChild(el('summary', { text: HOW.title }));
    d.appendChild(el('p', { cls: 'acct-small', text: HOW.lead }));
    var ul = el('ul', { cls: 'acct-howto-tree' });
    HOW.tree.forEach(function (pj) {
      var li = el('li', { cls: 'acct-howto-pj' }, [el('span', { cls: 'acct-howto-name', text: pj[0] }), el('span', { cls: 'acct-howto-kind', text: HOW.kP })]);
      li.appendChild(el('ul', null, pj[1].map(function (m) {
        return el('li', { cls: 'acct-howto-my' }, [el('span', { cls: 'acct-howto-name', text: m[0] }), el('span', { cls: 'acct-howto-kind', text: HOW.kM }), el('p', { cls: 'acct-howto-segs', text: m[1] })]);
      })));
      ul.appendChild(li);
    });
    d.appendChild(ul);
    d.appendChild(el('p', { cls: 'acct-howto-rt', text: HOW.resT }));
    d.appendChild(el('dl', { cls: 'acct-howto-res' }, [].concat.apply([], HOW.res.map(function (r) { return [el('dt', { text: r[0] }), el('dd', { text: r[1] })]; }))));
    d.appendChild(el('p', { cls: 'acct-small', text: HOW.resNote }));
    d.appendChild(el('p', { cls: 'acct-small acct-howto-plan', text: HOW.plan }));
    d.addEventListener('toggle', function () { if (d.open) ev('howto_open'); });
    return d;
  }

  /* ---------- プランの比較（無料ログイン／プレミアム準備中） ---------- */
  var FREE_MAX = 2;
  var P = {
    ja: {
      title: 'プランの比較', cols: ['ログイン\nなし', '無料\nログイン', 'プレミアム'], soon: '', now: '無料プラン',
      yes: 'あり', no: 'なし',
      rows: [
        ['タイマーを使う（並べる・くり返し・共有）', true, true, true],
        ['マイタイマーの保存', false, '2つ', '無制限'],
        ['利用記録・グラフ（データ）', false, '7日間', '全期間・月／年のグラフ'],
        ['連続日数', false, true, true],
        ['マイプロジェクト（勉強・仕事などに分けて集計）', false, '1つ', '無制限'],
        ['記録のCSVダウンロード', false, false, true]
      ],
      note: 'プレミアムは月額250円・年額2,000円（税込）。初めての方は最初の7日間が無料で、いつでも解約できます。今あるタイマーの機能は、これからもログインなしで無料で使えます。', more: '料金と詳しい条件', href: '/pricing',
      quota: function (n) { return n > FREE_MAX ? '保存中のマイタイマー ' + n + '個（無料プランで新しく保存できるのは2つまで）' : 'マイタイマー ' + n + ' / ' + FREE_MAX + '（プレミアムで無制限）'; }
    },
    en: {
      title: 'Compare plans', cols: ['No\naccount', 'Free\naccount', 'Premium'], soon: '', now: 'Free plan',
      yes: 'Included', no: 'Not included',
      rows: [
        ['Use the timer (chain, repeat, share)', true, true, true],
        ['Saved timers', false, '2', 'No limit'],
        ['History and charts', false, '7 days', 'All time + charts'],
        ['Streaks', false, true, true],
        ['Projects (track study, work, etc. separately)', false, '1', 'No limit'],
        ['Download history as CSV', false, false, true]
      ],
      note: 'Premium is US$1.99/month or US$15.99/year (your local currency is shown at checkout). New subscribers get 7 days free, and you can cancel any time. Everything the timer does today stays free without an account.', more: 'Pricing and terms', href: '/en-pricing',
      quota: function (n) { return n > FREE_MAX ? n + ' saved timers (the free plan can save new ones up to 2)' : 'Saved timers ' + n + ' / ' + FREE_MAX + ' (unlimited with Premium)'; }
    },
    es: {
      title: 'Comparar planes', cols: ['Sin\ncuenta', 'Cuenta\ngratis', 'Premium'], soon: '', now: 'Plan gratis',
      yes: 'Incluido', no: 'No incluido',
      rows: [
        ['Usar el temporizador (encadenar, repetir, compartir)', true, true, true],
        ['Temporizadores guardados', false, '2', 'Sin límite'],
        ['Historial y gráficos', false, '7 días', 'Todo + gráficos'],
        ['Rachas', false, true, true],
        ['Proyectos (estudio, trabajo, etc. por separado)', false, '1', 'Sin límite'],
        ['Descargar el historial en CSV', false, false, true]
      ],
      note: 'Premium cuesta MXN 29 o US$1.99 al mes (tu moneda se muestra al pagar). Si es tu primera vez, los primeros 7 días son gratis y puedes cancelar cuando quieras. Todo lo que hace el temporizador hoy sigue siendo gratis sin cuenta.', more: 'Precios y condiciones', href: '/es-pricing',
      quota: function (n) { return n > FREE_MAX ? n + ' temporizadores guardados (el plan gratis permite guardar nuevos hasta 2)' : 'Temporizadores ' + n + ' / ' + FREE_MAX + ' (ilimitados con Premium)'; }
    }
  }[lang];
  // cur: 強調する列（1=無料ログイン。ログイン前は「おすすめ」、ログイン中は「今のプラン」）
  function planTable(cur) {
    var head = el('tr', null, [el('td', { cls: 'acct-plans-blank' })].concat(P.cols.map(function (c, i) {
      return el('th', { scope: 'col', cls: i === cur ? 'cur' : '' }, [c, i === 2 && P.soon ? el('span', { cls: 'acct-soon', text: P.soon }) : null]);
    })));
    var body = P.rows.map(function (r) {
      var th = el('th', { scope: 'row' }, [r[0], r[4] && P.soon ? el('span', { cls: 'acct-soon', text: P.soon }) : null]);
      return el('tr', null, [th].concat(r.slice(1, 4).map(function (v, i) {
        var cls = (i === cur ? 'cur ' : '') + (v === true ? 'yes' : v === false ? 'no' : 'val');
        var a = { cls: cls, text: v === true ? '✓' : v === false ? '—' : v };
        if (typeof v === 'boolean') a['aria-label'] = v ? P.yes : P.no;
        return el('td', a);
      })));
    });
    return el('section', { cls: 'acct-plans', id: 'acct-plans', tabindex: '-1', 'aria-label': P.title }, [
      el('h2', { text: P.title }),
      el('div', { cls: 'acct-plans-wrap' }, [el('table', { cls: 'acct-plans-t' }, [el('colgroup', null, [el('col', { cls: 'c0' }), el('col'), el('col'), el('col')]), el('thead', null, [head]), el('tbody', null, body)])]),
      el('p', { cls: 'acct-small' }, [P.note, ' ', el('a', { href: P.href, text: P.more })])
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
  // PC では2列（左: 本人の操作、右: 比較・説明）。スマホは今までどおり縦に1列
  function cols(left, right) {
    return el('div', { cls: 'acct-cols' }, [el('div', { cls: 'acct-col' }, left.filter(Boolean)), el('div', { cls: 'acct-col acct-side' }, right.filter(Boolean))]);
  }
  function signedOutNodes(btn) {
    return [cols([
      btn,
      el('p', { cls: 'acct-small acct-agree' }, [
        T.agree1, el('a', { href: PRIV, text: T.agreeP }), T.agreeAnd,
        el('a', { href: TERMS, text: T.agreeT }), T.agree2
      ]),
      el('p', { cls: 'acct-lead', text: T.leadOut }),
      el('section', { cls: 'acct-perks', 'aria-label': T.perksTitle }, [
        el('h2', { text: T.perksTitle }),
        el('ul', { cls: 'acct-checklist' }, T.perks.map(function (p) {
          return el('li', null, [el('span', { cls: 'acct-check', 'aria-hidden': 'true', text: '✓' }),
            el('div', null, [el('p', { cls: 'acct-perk-t', text: p[0] }), el('p', { cls: 'acct-perk-d', text: p[1] })])]);
        }))
      ]),
      planTable(1)], [
      howTo(true)
    ])];
  }

  /* ---------- プレミアム（Stripe）----------
   * 購入ボタンは試し用の環境だけに出す（本番の決済を始めるまで）。
   * 有料かどうかは entitlements（本人は読むだけ。書けるのは決済の通知を受けたサーバーだけ） */
  var IS_TEST_SITE = /^login-preview\./.test(location.hostname) || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  // 2026-10-30 販売開始: 本番でも購入ボタンを出す（本番サイトは本番の決済、試し用サイトはテスト決済）
  var BILLING_ON = true;
  var FN_URL = SB_URL + '/functions/v1/billing/';
  var ENT = null;
  var B = {
    ja: {
      title: 'プレミアムにする', titleOn: 'プレミアム', seePlans: 'プランを確認する', soonTitle: 'プレミアム（準備中）', soonLead: 'マイタイマーとプロジェクトが無制限になり、全期間の記録・月／年のグラフ・CSVが使えるようになります。月額250円・年額2,000円、最初の7日間は無料の予定です。', badge: 'プレミアム',
      termsHead: 'お申込み前にご確認ください',
      terms: function (trial) { return [
        ['料金', '年額プラン 2,000円／年、月額プラン 250円／月（税込）'],
        ['お支払い', trial ? '初めての方は最初の7日間は無料です。8日目に初回の料金を請求し、以後は解約するまで毎年（月額プランは毎月）同じ日に自動で更新・請求します。' : 'お申込みと同時に初回の料金を請求し、以後は解約するまで毎年（月額プランは毎月）同じ日に自動で更新・請求します。'],
        ['支払方法', 'クレジットカードなど（決済は Stripe／Link）'],
        ['ご利用開始', 'お申込み後すぐに使えます。'],
        ['解約', 'このページの「お支払い・解約の管理」からいつでも解約できます。次の更新日からの請求が止まり、期間の終わりまで使えます。無料期間中に解約すれば料金はかかりません。解約料はありません。'],
        ['返金', 'お支払い後の返金は原則できません（法令や決済会社の規定による場合を除きます）。']
      ]; },
      lead: '初めての方は、最初の7日間は無料です。マイタイマーとプロジェクトが無制限になり、全期間の記録などが使えるようになります。',
      leadNoTrial: 'マイタイマーとプロジェクトが無制限になり、全期間の記録などが使えるようになります。',
      monthly: '月額プランで始める', yearly: '年額プランで始める（おトク）',
      note: '金額はお住まいの地域の通貨で、次の画面（Stripe の決済画面）に表示されます。いつでも解約できます。', more: '料金と条件',
      test: '試し用の環境です。テスト用のカードでだけ購入できます。',
      going: '決済画面を開いています…', err: '決済画面を開けませんでした。時間をおいてもう一度お試しください。',
      already: 'すでにプレミアムです。反映まで少し時間がかかることがあります。',
      trial: function (d) { return '無料期間中です（' + d + 'まで）。' + d + 'に初回の料金を請求します。'; },
      trialEnd: function (d) { return '無料期間の終わり（' + d + '）で終了します。料金はかかりません。'; },
      active: function (d) { return '次の更新日: ' + d; },
      ending: function (d) { return d + 'で終了します（自動更新はオフです）。'; },
      pastDue: 'お支払いを確認できませんでした。「お支払い・解約の管理」からカードを更新してください。',
      plan: { premium_monthly: '月額プラン', premium_yearly: '年額プラン' },
      manage: 'お支払い・解約の管理', manageErr: '管理画面を開けませんでした。時間をおいてもう一度お試しください。',
      thanks: 'お申込みありがとうございます。反映まで数秒かかることがあります。',
      slow: '反映に時間がかかっています。少したってから、このページを開き直してください。',
      canceled: 'お申込みは完了していません。',
      quota: function (n) { return 'マイタイマー ' + n + '（プレミアム: 無制限）'; },
      delSub: '有料プランが自動更新される状態のままでは削除できません。先に「お支払い・解約の管理」から解約してください。'
    },
    en: {
      title: 'Go Premium', titleOn: 'Premium', seePlans: 'See plans', soonTitle: 'Premium (coming soon)', soonLead: 'Unlimited saved timers and projects, all-time history, monthly/yearly charts and CSV. Planned at US$1.99/month or US$15.99/year, with 7 days free.', badge: 'Premium',
      termsHead: 'Please check before you subscribe',
      terms: function (trial) { return [
        ['Price', 'Yearly US$15.99/year or monthly US$1.99/month. The price in your local currency, with any tax, is shown on the next screen.'],
        ['Payment', trial ? 'New subscribers get the first 7 days free. You are charged on day 8, and the plan then renews and is charged automatically every year (monthly plan: every month) until you cancel.' : 'You are charged when you subscribe, and the plan then renews and is charged automatically every year (monthly plan: every month) until you cancel.'],
        ['Payment methods', 'Cards and more (processed by Stripe / Link)'],
        ['Access', 'Available right after you subscribe.'],
        ['Cancellation', 'Cancel any time in "Billing and cancellation" on this page. You will not be charged again and keep Premium until the end of the period. No charge if you cancel during the trial. No cancellation fee.'],
        ['Refunds', 'Payments are non-refundable, except where required by law or the payment provider\'s rules.']
      ]; },
      lead: 'New subscribers get the first 7 days free. Unlimited saved timers and projects, full history and more.',
      leadNoTrial: 'Unlimited saved timers and projects, full history and more.',
      monthly: 'Start monthly', yearly: 'Start yearly (best value)',
      note: 'The price is shown in your local currency on the next screen (Stripe checkout). Cancel any time.', more: 'Pricing and terms',
      test: 'This is the test site. Only test cards can be used.',
      going: 'Opening checkout…', err: 'Could not open checkout. Please try again later.',
      already: 'You already have Premium. It can take a moment to show up.',
      trial: function (d) { return 'Free trial until ' + d + '. Your first charge is on ' + d + '.'; },
      trialEnd: function (d) { return 'Ends when the trial ends (' + d + '). You will not be charged.'; },
      active: function (d) { return 'Next renewal: ' + d; },
      ending: function (d) { return 'Ends on ' + d + ' (auto-renew is off).'; },
      pastDue: 'We could not confirm your payment. Update your card in "Billing and cancellation".',
      plan: { premium_monthly: 'Monthly plan', premium_yearly: 'Yearly plan' },
      manage: 'Billing and cancellation', manageErr: 'Could not open billing. Please try again later.',
      thanks: 'Thank you for subscribing. It can take a few seconds to show up.',
      slow: 'This is taking longer than usual. Please reopen this page in a moment.',
      canceled: 'Your subscription was not completed.',
      quota: function (n) { return 'Saved timers ' + n + ' (Premium: no limit)'; },
      delSub: 'You cannot delete your account while a paid plan is set to renew. Please cancel it first in "Billing and cancellation".'
    },
    es: {
      title: 'Hazte Premium', titleOn: 'Premium', seePlans: 'Ver planes', soonTitle: 'Premium (próximamente)', soonLead: 'Temporizadores y proyectos ilimitados, historial completo, gráficos mensuales/anuales y CSV. Previsto: US$1.99 o MXN 29 al mes, con 7 días gratis.', badge: 'Premium',
      termsHead: 'Revisa antes de suscribirte',
      terms: function (trial) { return [
        ['Precio', 'Plan anual US$15.99 al año o mensual US$1.99 al mes (en México: MXN 229 / MXN 29). El precio en tu moneda, con impuestos, se muestra en la siguiente pantalla.'],
        ['Pago', trial ? 'Si es tu primera vez, los primeros 7 días son gratis. El día 8 se hace el primer cobro y después se renueva y se cobra automáticamente cada año (plan mensual: cada mes) hasta que canceles.' : 'Se cobra al suscribirte y después se renueva y se cobra automáticamente cada año (plan mensual: cada mes) hasta que canceles.'],
        ['Formas de pago', 'Tarjetas y más (procesado por Stripe / Link)'],
        ['Acceso', 'Disponible en cuanto te suscribes.'],
        ['Cancelación', 'Cancela cuando quieras en "Pagos y cancelación" de esta página. No se te vuelve a cobrar y mantienes Premium hasta el final del periodo. Sin cargo si cancelas durante la prueba. Sin penalización.'],
        ['Reembolsos', 'Los pagos no son reembolsables, salvo cuando lo exija la ley o el proveedor de pagos.']
      ]; },
      lead: 'Si es tu primera vez, los primeros 7 días son gratis. Temporizadores y proyectos sin límite, historial completo y más.',
      leadNoTrial: 'Temporizadores y proyectos sin límite, historial completo y más.',
      monthly: 'Empezar plan mensual', yearly: 'Empezar plan anual (mejor precio)',
      note: 'El precio se muestra en tu moneda en la siguiente pantalla (pago con Stripe). Cancela cuando quieras.', more: 'Precios y condiciones',
      test: 'Este es el sitio de prueba. Solo se pueden usar tarjetas de prueba.',
      going: 'Abriendo el pago…', err: 'No se pudo abrir el pago. Inténtalo más tarde.',
      already: 'Ya tienes Premium. Puede tardar un momento en aparecer.',
      trial: function (d) { return 'Prueba gratis hasta el ' + d + '. El primer cobro es el ' + d + '.'; },
      trialEnd: function (d) { return 'Termina al final de la prueba (' + d + '). No se te cobrará.'; },
      active: function (d) { return 'Próxima renovación: ' + d; },
      ending: function (d) { return 'Termina el ' + d + ' (renovación automática desactivada).'; },
      pastDue: 'No pudimos confirmar tu pago. Actualiza tu tarjeta en "Pagos y cancelación".',
      plan: { premium_monthly: 'Plan mensual', premium_yearly: 'Plan anual' },
      manage: 'Pagos y cancelación', manageErr: 'No se pudo abrir la gestión de pagos. Inténtalo más tarde.',
      thanks: 'Gracias por suscribirte. Puede tardar unos segundos en aparecer.',
      slow: 'Está tardando más de lo normal. Vuelve a abrir esta página en un momento.',
      canceled: 'La suscripción no se completó.',
      quota: function (n) { return 'Temporizadores ' + n + ' (Premium: sin límite)'; },
      delSub: 'No puedes eliminar la cuenta mientras un plan de pago se renueva. Cancélalo primero en "Pagos y cancelación".'
    }
  }[lang];
  var PRICING = { ja: '/pricing', en: '/en-pricing', es: '/es-pricing' }[lang];
  var CHECKOUT = params.get('checkout');
  function isPrem(e) {
    return !!e && e.plan === 'premium' && ['active', 'trialing', 'past_due'].indexOf(e.status) >= 0 &&
      (!e.current_period_end || new Date(e.current_period_end).getTime() > Date.now() - 3 * 864e5);
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : lang, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; }
  }
  async function loadEnt() {
    var r = await sb.from('entitlements').select('plan,status,current_period_end,cancel_at_period_end,trial_end,trial_used,price_lookup_key').maybeSingle();
    ENT = r.error ? null : r.data;
    if (isPrem(ENT)) { FREE_MAX = 100; PJ_FREE = 50; }
    return ENT;
  }
  async function callBilling(route, body) {
    var s = await sb.auth.getSession();
    var tok = s.data && s.data.session && s.data.session.access_token;
    if (!tok) throw new Error('nosession');
    var r = await fetch(FN_URL + route, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok, apikey: SB_KEY },
      body: JSON.stringify(body)
    });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var er = new Error(j.error || ('http ' + r.status)); er.code = j.error; throw er; }
    if (typeof j.url !== 'string' || !/^https:\/\/(checkout|billing)\.stripe\.com\//.test(j.url)) throw new Error('bad url');
    return j;
  }
  function fillBilling(box, badge, note) {
    box.textContent = '';
    var prem = isPrem(ENT);
    var pl = prem && ENT.price_lookup_key && B.plan[ENT.price_lookup_key];
    badge.textContent = prem ? B.badge + (pl ? (lang === 'ja' ? '（' + pl + '）' : ' (' + pl + ')') : '') : P.now;
    function seePlans() {
      var b = el('button', { type: 'button', cls: 'acct-btn acct-btn-sm acct-see-plans', text: B.seePlans });
      b.addEventListener('click', function () {
        var t = document.getElementById('acct-plans'); if (!t) return;
        t.scrollIntoView({ behavior: 'smooth', block: 'start' }); try { t.focus({ preventScroll: true }); } catch (e) {}
        ev('see_plans');
      });
      return b;
    }
    if (!prem && !BILLING_ON) {
      // 決済を始めるまでは「準備中」の案内と、比較へ移動するボタンだけ
      box.hidden = false;
      box.appendChild(el('h2', { text: B.soonTitle }));
      box.appendChild(el('p', { cls: 'acct-small', text: B.soonLead }));
      box.appendChild(el('div', { cls: 'acct-row' }, [seePlans()]));
      return;
    }
    box.hidden = false;
    box.appendChild(el('h2', { text: prem ? B.titleOn : B.title }));
    if (note) box.appendChild(msg(note));
    if (!prem && note === B.thanks) return; // 反映待ちの間はボタンを出さない
    var err = el('p', { cls: 'acct-msg err', role: 'status' }); err.hidden = true;
    function fail(t) { err.textContent = t; err.hidden = false; }
    if (prem) {
      var end = ENT.trial_end && ENT.status === 'trialing' ? ENT.trial_end : ENT.current_period_end;
      var d = end ? fmtDate(end) : '';
      var line = ENT.status === 'past_due' ? B.pastDue
        : ENT.status === 'trialing' ? (ENT.cancel_at_period_end ? B.trialEnd(d) : B.trial(d))
        : (ENT.cancel_at_period_end ? B.ending(d) : B.active(d));
      box.appendChild(el('p', { cls: 'acct-small', text: line }));
      var mg = el('button', { type: 'button', cls: 'acct-btn', text: B.manage });
      mg.addEventListener('click', async function () {
        mg.disabled = true; err.hidden = true;
        try { var j = await callBilling('portal', { lang: lang }); ev('billing_portal'); location.assign(j.url); }
        catch (e) { mg.disabled = false; fail(B.manageErr); }
      });
      box.appendChild(el('div', { cls: 'acct-row' }, [mg]));
    } else {
      var hasTrial = !(ENT && ENT.trial_used);
      box.appendChild(el('p', { cls: 'acct-small', text: hasTrial ? B.lead : B.leadNoTrial }));
      // 申込み前の確認（特商法の最終確認画面の表示事項。Stripe の決済画面には独自の文章を載せられないため、ここに出す）
      var terms = el('div', { cls: 'acct-terms', id: 'acct-terms' });
      terms.appendChild(el('p', { cls: 'acct-small' }, [el('strong', { text: B.termsHead })]));
      B.terms(hasTrial).forEach(function (t) {
        terms.appendChild(el('p', { cls: 'acct-small' }, [el('strong', { text: t[0] + (lang === 'ja' ? '：' : ': ') }), t[1]]));
      });
      var bm = el('button', { type: 'button', cls: 'acct-btn', text: B.monthly });
      var by = el('button', { type: 'button', cls: 'acct-btn acct-btn-primary', text: B.yearly });
      [[bm, 'monthly'], [by, 'yearly']].forEach(function (x) {
        x[0].addEventListener('click', async function () {
          bm.disabled = true; by.disabled = true; err.hidden = true;
          x[0].textContent = B.going;
          ev('checkout_start', { plan: x[1] });
          try { var j = await callBilling('checkout', { plan: x[1], lang: lang, back: '/account' }); location.assign(j.url); }
          catch (e) {
            bm.disabled = false; by.disabled = false; bm.textContent = B.monthly; by.textContent = B.yearly;
            fail(e.code === 'already_premium' ? B.already : B.err);
          }
        });
      });
      box.appendChild(terms);
      box.appendChild(el('div', { cls: 'acct-row' }, [by, bm]));
      box.appendChild(el('div', { cls: 'acct-row' }, [seePlans()]));
      box.appendChild(el('p', { cls: 'acct-small' }, [B.note, ' ', el('a', { href: PRICING, text: B.more })]));
      if (IS_TEST_SITE) box.appendChild(el('p', { cls: 'acct-small', text: B.test }));
    }
    box.appendChild(err);
  }
  async function startBilling(box, badge) {
    try { await loadEnt(); } catch (e) {}
    var note = CHECKOUT === 'success' ? B.thanks : CHECKOUT === 'cancel' ? B.canceled : '';
    fillBilling(box, badge, note);
    if (CHECKOUT === 'success' && !isPrem(ENT)) {
      for (var i = 0; i < 8 && !isPrem(ENT); i++) {
        await new Promise(function (r) { setTimeout(r, 2500); });
        try { await loadEnt(); } catch (e) {}
      }
      if (isPrem(ENT)) { ev('checkout_done'); location.reload(); return; }
      fillBilling(box, badge, B.slow);
    } else if (CHECKOUT === 'success') ev('checkout_done');
    CHECKOUT = null;
  }

  function renderSignedIn(user) {
    var meta = user.user_metadata || {};
    var badge = el('p', { cls: 'acct-plan-now', text: P.now });
    var bill = el('section', { cls: 'acct-usage acct-billing', 'aria-label': B.title }); bill.hidden = true;
    var who = el('div', { cls: 'acct-card' }, [
      el('p', { cls: 'acct-label', text: T.signedIn }),
      el('p', { cls: 'acct-name', text: meta.full_name || meta.name || '' }),
      el('p', { cls: 'acct-email', text: user.email || '' }),
      badge
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
          box.appendChild(msg(/active subscription/.test((r.error && r.error.message) || '') ? B.delSub : T.errDelete, 'err'));
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

    var mine = el('section', { cls: 'acct-usage acct-my', 'aria-label': T.myTitle }, [el('h2', { text: T.myTitle }), msg(T.loading)]);
    var pj = el('section', { cls: 'acct-usage acct-pj', 'aria-label': D2.pjTitle }, [el('h2', { text: D2.pjTitle }), msg(T.loading)]);
    var openData = el('button', { type: 'button', cls: 'acct-btn acct-btn-sm', text: D2.dataBtn });
    openData.addEventListener('click', function () {
      try { sessionStorage.setItem('tt-open-data', '1'); } catch (e) {}
      ev('data_from_account');
      location.href = HOME;
    });
    var data = el('section', { cls: 'acct-usage acct-data', 'aria-label': D2.dataTitle }, [el('h2', { text: D2.dataTitle }), el('p', { cls: 'acct-small', text: D2.dataLead }), openData]);
    howBox = el('div', { cls: 'acct-how-box' });
    show([cols([who, bill, mine, pj, data, planTable(1), howBox, el('div', { cls: 'acct-row' }, [out]), danger], [])]);
    if (location.hash === '#acct-plans') setTimeout(function () { var t = document.getElementById('acct-plans'); if (t) t.scrollIntoView({ block: 'start' }); }, 300);
    startBilling(bill, badge).catch(function () {}).then(function () { loadAll(pj, mine); });
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
    box.appendChild(el('p', { cls: 'acct-small acct-quota', text: isPrem(ENT) ? B.quota(rows.length) : P.quota(rows.length) }));
  }
  var refresh = function () {};
  var howBox = null;
  /* プロジェクトの管理: 作る・名前を変える・削除。時間の集計は「データ」の窓（data.js）で見る */
  async function loadProjects(box, mineBox, err) {
    refresh = function () { renderMine(mineBox, false); loadProjects(box, mineBox, false); };
    box.textContent = '';
    box.appendChild(el('h2', { text: D2.pjTitle }));
    var anyProject = DATA.projects.length > 0;
    if (howBox) { howBox.textContent = ''; howBox.appendChild(howTo(!anyProject)); }
    if (err) { box.appendChild(msg(T.errLogin, 'err')); return; }
    if (!anyProject) box.appendChild(el('p', { cls: 'acct-small', text: D2.pjEmpty }));
    var list = el('div', { cls: 'acct-pj-list' });
    DATA.projects.forEach(function (p) {
      var card = el('div', { cls: 'acct-pj' });
      card.appendChild(el('div', { cls: 'acct-pj-head' }, [el('p', { cls: 'acct-pj-name', text: p.name })]));
      var names = DATA.timers.filter(function (t) { return t.project_id === p.id; }).map(function (t) { return t.name || ''; });
      card.appendChild(el('p', { cls: 'acct-pj-timers' }, names.length ? [el('span', { cls: 'acct-pj-timers-k', text: D2.pjTimers }), names.join(lang === 'ja' ? '・' : ', ')] : [D2.pjNoTimers]));
      var acts = el('div', { cls: 'acct-pj-acts' });
      var rn = el('button', { type: 'button', cls: 'acct-pj-tog', text: T.pjRename });
      rn.addEventListener('click', function () {
        nameForm(card, T.pjNamePh, p.name, T.pjSave, async function (name) {
          var r = await sb.from('projects').update({ name: name.slice(0, 40) }).eq('id', p.id).select('id').single();
          if (r.error) return false; p.name = name.slice(0, 40); refresh(); return true;
        });
      });
      var del = el('button', { type: 'button', cls: 'acct-pj-tog', text: T.pjDel });
      del.addEventListener('click', function () {
        if (acts.querySelector('.acct-pj-yes')) return;
        var yes = el('button', { type: 'button', cls: 'acct-pj-tog acct-pj-yes', text: T.pjDelQ });
        yes.addEventListener('click', async function () {
          yes.disabled = true;
          var r = await sb.from('projects').delete().eq('id', p.id);
          if (r.error) { yes.disabled = false; card.appendChild(msg(T.pjErr, 'err')); return; }
          DATA.projects = DATA.projects.filter(function (x) { return x.id !== p.id; });
          DATA.timers.forEach(function (t) { if (t.project_id === p.id) t.project_id = null; });
          ev('project_delete'); refresh();
        });
        acts.appendChild(yes);
      });
      acts.appendChild(rn); acts.appendChild(del);
      card.appendChild(acts);
      list.appendChild(card);
    });
    box.appendChild(list);
    var full = DATA.projects.length >= PJ_FREE;
    if (full) box.appendChild(el('p', { cls: 'acct-small acct-quota', text: T.pjFull }));
    else {
      var add = el('button', { type: 'button', cls: 'acct-btn acct-btn-sm', text: T.pjNew });
      add.addEventListener('click', function () {
        nameForm(box, T.pjNamePh, '', T.pjOk, async function (name) { var p = await createProject(name); if (!p) return false; refresh(); return true; });
      });
      box.appendChild(add);
    }
    box.appendChild(el('p', { cls: 'acct-small', text: D2.pjNote }));
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
