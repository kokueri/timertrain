'use strict';
/* TimerTrain データの窓（ヘッダーの「データ」・ホームの ⏱📅🔥 を押したときだけ読み込む）
 * - ログイン前: 見本をぼかして表示し、ログインの案内
 * - ログイン中: sync.js と同じ接続（window.__ttSb）で、本人の記録だけを読む（RLS）
 * - 無料は直近30日（11/16 から。記録はずっと保存）。12か月・全期間・CSV はプレミアム
 * - 表示はすべて textContent（記録の名前をHTMLとして扱わない）
 */
(function () {
  if (window.__ttData) return;
  var lang = document.documentElement.lang;
  if (['ja', 'en', 'es'].indexOf(lang) < 0) lang = 'ja';
  var PRODUCT = 'timertrain';
  var BILLING_ON = true; // 2026-10-30 販売開始
  var ACCT = '/account?l=' + lang + (window.DT ? '&from=donut' : '');
  function ev(name, p) { try { if (window.gtag) gtag('event', name, p || {}); } catch (e) {} }

  var T = {
    ja: {
      title: 'データ', close: '閉じる', loading: '読み込み中…', err: 'つながりませんでした。時間をおいてもう一度お試しください。',
      periods: [['7d', '7日'], ['30d', '30日'], ['12m', '12か月'], ['all', '全期間']],
      pjAll: 'すべて', pjNone: 'プロジェクトなし', pjOther: 'マイタイマー以外', filter: '表示するプロジェクト',
      lblBtn: function (n) { return n ? 'ラベル：' + n + 'つ' : 'ラベル：すべて'; }, lblFilter: '表示するラベル（複数選べます）', lblClear: 'すべて表示', pieOf: function (t) { return t + 'の割合'; },
      work: '作業の時間', workSub: '休憩を除く', days: '使った日数', runs: '回数', streak: '連続',
      daysV: function (n, of) { return of ? n + ' / ' + of + '日' : n + '日'; }, runsV: function (n) { return n + '回'; }, streakV: function (n) { return '🔥 ' + n + '日'; },
      chart: function (p) { return p === '12m' || p === 'all' ? '月ごとの作業の時間' : '日ごとの作業の時間'; },
      byPj: 'プロジェクトごと', byLabel: 'ラベル（区切りの名前）ごと', byTimer: 'マイタイマーごと', detail: 'くわしい記録',
      noSeg: '区切りの記録なし', noLabel: '名前なし', other: 'その他', brk: '休憩', brkNote: '休憩は作業の時間に入れません。',
      toBreak: '休憩にする', toWork: '作業に戻す', more: 'もっと見る', done: '完了', total: '合計',
      empty: 'この期間の記録はまだありません。ログインした状態でタイマーを15秒以上動かすと、ここに記録されます。',
      lockTitle: '始めた日からの記録をぜんぶ見返すなら、プレミアム',
      lockLead: BILLING_ON ? '無料プランは直近30日間を見られます。記録はそれより前の分もずっと残っているので、プレミアムにすると最初からさかのぼって見られます。' : '無料プランは直近30日間を見られます。それより前の記録も残っています（プレミアムは準備中です）。',
      plans: 'プランを見る', csv: 'CSVで保存', csvLock: 'CSVで保存（プレミアム）',
      outTitle: 'ログインすると、あなたのデータが見られます',
      outLead: '無料ログインで、記録はずっと保存。直近30日間の作業の時間・使った日数・連続日数と、プロジェクトやラベルごとのグラフが見られます。',
      outBtn: 'Googleで無料ログイン', reBtn: 'もう一度ログイン', sample: '見本',
      dayFmt: function (d) { return (d.getMonth() + 1) + '/' + d.getDate(); },
      monFmt: function (d) { return (d.getMonth() + 1) + '月'; },
      timeFmt: function (d) { return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); },
      wd: ['日', '月', '火', '水', '木', '金', '土'],
      dur: function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + '時間' + (m % 60 ? (m % 60) + '分' : '') : m + '分'; },
      csvHead: ['日付', '開始時刻', 'マイタイマー', 'プロジェクト', 'ラベル', '秒', '分', '休憩'], yes: 'はい', no: '',
      tapHint: '棒を押すと、その日の内訳が出ます'
    },
    en: {
      title: 'Data', close: 'Close', loading: 'Loading…', err: 'Could not connect. Please try again later.',
      periods: [['7d', '7 days'], ['30d', '30 days'], ['12m', '12 months'], ['all', 'All time']],
      pjAll: 'All', pjNone: 'No project', pjOther: 'Not a saved timer', filter: 'Project to show',
      lblBtn: function (n) { return n ? 'Labels: ' + n : 'Labels: all'; }, lblFilter: 'Labels to show (choose any)', lblClear: 'Show all', pieOf: function (t) { return t + ' — share'; },
      work: 'Work time', workSub: 'excluding breaks', days: 'Days used', runs: 'Sessions', streak: 'Streak',
      daysV: function (n, of) { return of ? n + ' / ' + of : String(n); }, runsV: function (n) { return String(n); }, streakV: function (n) { return '🔥 ' + n; },
      chart: function (p) { return p === '12m' || p === 'all' ? 'Work time per month' : 'Work time per day'; },
      byPj: 'By project', byLabel: 'By label (segment name)', byTimer: 'By saved timer', detail: 'Sessions',
      noSeg: 'No segment record', noLabel: 'No name', other: 'Other', brk: 'Breaks', brkNote: 'Breaks are not counted as work time.',
      toBreak: 'Mark as break', toWork: 'Count as work', more: 'Show more', done: 'Done', total: 'Total',
      empty: 'No records in this period yet. Run a timer for 15 seconds or more while signed in and it will show up here.',
      lockTitle: 'Look back at everything since day one with Premium',
      lockLead: BILLING_ON ? 'The free plan shows the last 30 days. Older records are kept for good, so with Premium you can look back to day one.' : 'The free plan shows the last 30 days. Older records are kept (Premium is coming soon).',
      plans: 'See plans', csv: 'Save as CSV', csvLock: 'Save as CSV (Premium)',
      outTitle: 'Sign in to see your data',
      outLead: 'With a free account your records are kept for good, and you can see the last 30 days: work time, days used, your streak, and charts by project and label.',
      outBtn: 'Sign in free with Google', reBtn: 'Sign in again', sample: 'Sample',
      dayFmt: function (d) { return (d.getMonth() + 1) + '/' + d.getDate(); },
      monFmt: function (d) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]; },
      timeFmt: function (d) { return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); },
      wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      dur: function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + 'm'; },
      csvHead: ['date', 'start', 'saved_timer', 'project', 'label', 'seconds', 'minutes', 'break'], yes: 'yes', no: '',
      tapHint: 'Tap a bar to see that day'
    },
    es: {
      title: 'Datos', close: 'Cerrar', loading: 'Cargando…', err: 'No se pudo conectar. Inténtalo más tarde.',
      periods: [['7d', '7 días'], ['30d', '30 días'], ['12m', '12 meses'], ['all', 'Todo']],
      pjAll: 'Todos', pjNone: 'Sin proyecto', pjOther: 'Sin temporizador guardado', filter: 'Proyecto',
      lblBtn: function (n) { return n ? 'Etiquetas: ' + n : 'Etiquetas: todas'; }, lblFilter: 'Etiquetas a mostrar (puedes elegir varias)', lblClear: 'Mostrar todas', pieOf: function (t) { return t + ' — proporción'; },
      work: 'Tiempo de trabajo', workSub: 'sin descansos', days: 'Días de uso', runs: 'Sesiones', streak: 'Racha',
      daysV: function (n, of) { return of ? n + ' / ' + of : String(n); }, runsV: function (n) { return String(n); }, streakV: function (n) { return '🔥 ' + n; },
      chart: function (p) { return p === '12m' || p === 'all' ? 'Tiempo de trabajo por mes' : 'Tiempo de trabajo por día'; },
      byPj: 'Por proyecto', byLabel: 'Por etiqueta (nombre del tramo)', byTimer: 'Por temporizador guardado', detail: 'Sesiones',
      noSeg: 'Sin registro de tramos', noLabel: 'Sin nombre', other: 'Otros', brk: 'Descansos', brkNote: 'Los descansos no cuentan como trabajo.',
      toBreak: 'Marcar como descanso', toWork: 'Contar como trabajo', more: 'Ver más', done: 'Completado', total: 'Total',
      empty: 'Aún no hay registros en este periodo. Usa un temporizador 15 segundos o más con la sesión iniciada y aparecerá aquí.',
      lockTitle: 'Con Premium ves todo desde el primer día',
      lockLead: BILLING_ON ? 'El plan gratis muestra los últimos 30 días. Los registros anteriores se guardan siempre, así que con Premium puedes verlos desde el primer día.' : 'El plan gratis muestra los últimos 30 días. Los registros anteriores se guardan (Premium llegará pronto).',
      plans: 'Ver planes', csv: 'Guardar como CSV', csvLock: 'Guardar como CSV (Premium)',
      outTitle: 'Inicia sesión para ver tus datos',
      outLead: 'Con una cuenta gratis tus registros se guardan siempre y ves los últimos 30 días: tiempo de trabajo, días de uso, tu racha y gráficos por proyecto y etiqueta.',
      outBtn: 'Entrar gratis con Google', reBtn: 'Vuelve a iniciar sesión', sample: 'Ejemplo',
      dayFmt: function (d) { return d.getDate() + '/' + (d.getMonth() + 1); },
      monFmt: function (d) { return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]; },
      timeFmt: function (d) { return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); },
      wd: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      dur: function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; },
      csvHead: ['fecha', 'inicio', 'temporizador', 'proyecto', 'etiqueta', 'segundos', 'minutos', 'descanso'], yes: 'sí', no: '',
      tapHint: 'Toca una barra para ver ese día'
    }
  }[lang];
  /* 1日の流れ（ホームの「今日のログ」から開く）。無料で見られるのは今日を含めて FREE_DAYS 日 */
  var FREE_DAYS = 30; // 11/16: 7日→30日
  var TD = {
    ja: {
      views: [['day', '1日'], ['cal', 'カレンダー'], ['period', '期間']], today: '今日', yday: '昨日', prev: '前の日', next: '次の日',
      total: '休憩をのぞく合計', flow: '1日の流れ', now: 'いま', other: 'ほか', brk: '休憩',
      empty: 'この日の記録はありません。', emptyToday: 'まだ今日の記録はありません。ログインした状態でタイマーを15秒以上動かすと、ここに残ります。',
      lockT: 'それより前の日はプレミアム',
      lockL: function (n) { return '無料プランは直近' + n + '日間の1日の流れを見られます。記録はそれより前の分もずっと残っているので、プレミアムにすると最初からさかのぼって見られます。'; },
      note: function (n) { return '無料プランは直近' + n + '日間を見られます。'; },
      hours: ['0時', '6時', '12時', '18時', '24時'],
      cal: { month: function (d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'; }, prev: '前の月', next: '次の月', wd: ['日', '月', '火', '水', '木', '金', '土'], mon: false, total: '休憩をのぞく合計', days: function (n) { return '記録した日 ' + n + '日'; }, best: function (n) { return '最長 ' + n + '日連続'; }, short: '短い', long: '長い', lockT: 'それより前の月はプレミアム', open: function (d, v) { return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + v + '（1日の流れを開く）'; }, none: '記録なし', locked: 'プレミアムで見られます' },
      tinyShow: function (n) { return '1分未満の記録 ' + n + '件を表示'; }, tinyHide: '1分未満の記録をかくす',
      ed: { btn: '時間を変える', start: '始めた時刻', len: '分', sum: '合計', save: '保存', cancel: 'やめる', del: 'この記録を消す', delSure: 'もう一度押すと消えます', running: '動いている記録は、止めてから変えられます。', recent: 'ほかの画面で動いているかもしれません。止めてから1〜2分たってから変えてください。', saved: '記録を変えました', deleted: '記録を消しました', errEnd: '終わりが今より後になっています', errLen: '長さは合わせて1分〜12時間にしてください', errSave: '保存できませんでした。時間をおいてもう一度お試しください。', errDel: '消せませんでした。時間をおいてもう一度お試しください。' },
      date: function (d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + '日月火水木金土'.charAt(d.getDay()) + '）'; }
    },
    en: {
      views: [['day', 'Day'], ['cal', 'Calendar'], ['period', 'Period']], today: 'Today', yday: 'Yesterday', prev: 'Previous day', next: 'Next day',
      total: 'Total, excluding breaks', flow: 'Your day', now: 'Now', other: 'Others', brk: 'Break',
      empty: 'No records on this day.', emptyToday: 'No record yet today. Run a timer for 15 seconds or more while signed in and it shows up here.',
      lockT: 'Earlier days are Premium',
      lockL: function (n) { return 'The free plan shows your day for the last ' + n + ' days. Older records are kept for good, so with Premium you can look back to day one.'; },
      note: function (n) { return 'The free plan shows the last ' + n + ' days.'; },
      hours: ['0', '6', '12', '18', '24'],
      cal: { month: function (d) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] + ' ' + d.getFullYear(); }, prev: 'Previous month', next: 'Next month', wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], mon: false, total: 'Total, excluding breaks', days: function (n) { return n + ' day' + (n === 1 ? '' : 's') + ' recorded'; }, best: function (n) { return 'Longest streak ' + n + ' day' + (n === 1 ? '' : 's'); }, short: 'Short', long: 'Long', lockT: 'Earlier months are Premium', open: function (d, v) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate() + ', ' + v + ' (open your day)'; }, none: 'No record', locked: 'Available with Premium' },
      tinyShow: function (n) { return 'Show ' + n + ' record' + (n > 1 ? 's' : '') + ' under 1 min'; }, tinyHide: 'Hide records under 1 min',
      ed: { btn: 'Change times', start: 'Started at', len: 'min', sum: 'Total', save: 'Save', cancel: 'Cancel', del: 'Delete this record', delSure: 'Tap again to delete', running: 'Stop this record before changing it.', recent: 'This may still be running on another screen. Stop it, wait a minute or two, then change it.', saved: 'Record updated', deleted: 'Record deleted', errEnd: 'The end is later than now', errLen: 'Keep the total between 1 minute and 12 hours', errSave: 'Could not save. Please try again in a moment.', errDel: 'Could not delete. Please try again in a moment.' },
      date: function (d) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate(); }
    },
    es: {
      views: [['day', 'Día'], ['cal', 'Calendario'], ['period', 'Periodo']], today: 'Hoy', yday: 'Ayer', prev: 'Día anterior', next: 'Día siguiente',
      total: 'Total sin descansos', flow: 'Tu día', now: 'Ahora', other: 'Otros', brk: 'Descanso',
      empty: 'No hay registros este día.', emptyToday: 'Aún no hay registros hoy. Usa un temporizador 15 segundos o más con la sesión iniciada y aparecerá aquí.',
      lockT: 'Los días anteriores son Premium',
      lockL: function (n) { return 'El plan gratis muestra tu día de los últimos ' + n + ' días. Los registros anteriores se guardan siempre, así que con Premium puedes verlos desde el primer día.'; },
      note: function (n) { return 'El plan gratis muestra los últimos ' + n + ' días.'; },
      hours: ['0', '6', '12', '18', '24'],
      cal: { month: function (d) { return ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][d.getMonth()] + ' de ' + d.getFullYear(); }, prev: 'Mes anterior', next: 'Mes siguiente', wd: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], mon: true, total: 'Total sin descansos', days: function (n) { return n + ' día' + (n === 1 ? '' : 's') + ' con registro'; }, best: function (n) { return 'Racha más larga: ' + n + ' día' + (n === 1 ? '' : 's'); }, short: 'Poco', long: 'Mucho', lockT: 'Los meses anteriores son Premium', open: function (d, v) { return d.getDate() + ' de ' + ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][d.getMonth()] + ', ' + v + ' (abrir tu día)'; }, none: 'Sin registro', locked: 'Disponible con Premium' },
      tinyShow: function (n) { return 'Mostrar ' + n + ' registro' + (n > 1 ? 's' : '') + ' de menos de 1 min'; }, tinyHide: 'Ocultar registros de menos de 1 min',
      ed: { btn: 'Cambiar tiempos', start: 'Empezó a las', len: 'min', sum: 'Total', save: 'Guardar', cancel: 'Cancelar', del: 'Borrar este registro', delSure: 'Toca otra vez para borrar', running: 'Detén este registro antes de cambiarlo.', recent: 'Puede que siga en marcha en otra pantalla. Detenlo, espera uno o dos minutos y cámbialo.', saved: 'Registro cambiado', deleted: 'Registro borrado', errEnd: 'El final es posterior a ahora', errLen: 'El total debe estar entre 1 minuto y 12 horas', errSave: 'No se pudo guardar. Inténtalo de nuevo en un momento.', errDel: 'No se pudo borrar. Inténtalo de nuevo en un momento.' },
      date: function (d) { return ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()] + ' ' + d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]; }
    }
  }[lang];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // 11/15: ラベルの色（タイマー画面と同じ8色）。クラス lc0〜lc7
  function lcOf(l) { return l === '\u0000' ? 'g' : 'lc' + (window.__ttLabelColorIdx ? window.__ttLabelColorIdx(l) : 0); }
  /* ラベルの名前変更（settings.data.labelMap）。過去の記録は新しい名前で集計する */
  var LM = {};
  function setLM(sd) { LM = (sd && sd.labelMap && typeof sd.labelMap === 'object' && !Array.isArray(sd.labelMap)) ? sd.labelMap : {}; }
  function aliasL(l) { l = String(l == null ? '' : l); for (var i = 0; i < 5 && Object.prototype.hasOwnProperty.call(LM, l) && typeof LM[l] === 'string'; i++) l = LM[l].slice(0, 30); return l; }

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

  /* ---------- 窓 ---------- */
  var back = null, box = null, body = null, lastFocus = null;
  function build() {
    back = el('div', { cls: 'ttd-back', hidden: '' });
    box = el('div', { cls: 'ttd', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ttd-title' });
    var x = el('button', { type: 'button', cls: 'ttd-x', 'aria-label': T.close, text: '×' });
    x.addEventListener('click', close);
    box.appendChild(el('div', { cls: 'ttd-head' }, [el('h2', { id: 'ttd-title', text: T.title }), x]));
    body = el('div', { cls: 'ttd-body' });
    box.appendChild(body);
    back.appendChild(box);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function (e) {
      if (back.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') { // 窓の中でフォーカスを回す
        var f = box.querySelectorAll('button:not([disabled]), a[href], select, [tabindex="0"]');
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }, true);
    document.body.appendChild(back);
  }
  function open(src) {
    if (!back) build();
    lastFocus = document.activeElement;
    back.hidden = false;
    document.documentElement.classList.add('ttd-open');
    box.querySelector('.ttd-x').focus();
    S.dayEv = 0;
    S.view = src === 'today' ? 'day' : 'period';
    if (src === 'today') S.day = today0();
    S.from = src || '';
    ev('data_open', { from: src || '', member: member() });
    start();
  }
  function member() { return signedLocal() ? (window.__ttPremium ? 'premium' : 'free') : 'guest'; }
  function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function close() {
    if (!back || back.hidden) return;
    back.hidden = true;
    document.documentElement.classList.remove('ttd-open');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- 状態 ---------- */
  var S = { period: '7d', filter: 'all', labels: [], lblOpen: false, data: null, loadedFor: null, more: 10, sel: -1 };
  function signedLocal() { try { return !!localStorage.getItem('sb-arsfocfjfwtlykfdkiea-auth-token'); } catch (e) { return false; } }
  async function waitSb() {
    for (var i = 0; i < 60; i++) {
      if (window.__ttSb) return window.__ttSb;
      if (window.__ttSignedOut) return null;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    return window.__ttSb || null;
  }
  async function start() {
    if (!signedLocal()) { renderOut(false); return; }
    body.textContent = '';
    body.appendChild(el('p', { cls: 'ttd-msg', text: T.loading }));
    var sb = await waitSb();
    if (!sb) { renderOut(true); return; }
    S.sb = sb;
    if (!window.__ttPremium && S.period !== '7d' && S.period !== '30d') S.period = '7d';
    if (S.view === 'day') ev('day_view', { from: S.from, member: member() });
    await show();
  }
  /* いまの表示（1日／期間）を読み込んで描く */
  async function show() {
    try {
      if (S.view === 'day') await loadDay(S.sb); else if (S.view === 'cal') await loadCal(S.sb); else await load(S.sb);
    } catch (e) { body.textContent = ''; body.appendChild(el('p', { cls: 'ttd-msg err', role: 'status', text: T.err })); return; }
    if (S.view === 'day') renderDay(); else if (S.view === 'cal') renderCal(); else render(false);
  }

  /* ---------- 読み込み（1000件ずつ） ---------- */
  function periodStart(p) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    if (p === '7d') { d.setDate(d.getDate() - 6); return d; }
    if (p === '30d') { d.setDate(d.getDate() - 29); return d; }
    if (p === '12m') { d.setDate(1); d.setMonth(d.getMonth() - 11); return d; }
    return null; // 全期間
  }
  async function all(make, max) {
    var out = [];
    for (var i = 0; i < max; i += 1000) {
      var r = await make(i, i + 999);
      if (r.error) throw r.error;
      var rows = r.data || [];
      out = out.concat(rows);
      if (rows.length < 1000) break;
    }
    return out;
  }
  async function load(sb) {
    var key = S.period;
    if (S.data && S.loadedFor === key && Date.now() - S.data.at < 60000) return;
    var st = periodStart(S.period);
    var logs = await all(function (a, b) {
      var q = sb.from('usage_logs').select('id,started_at,total_secs,timer_id,completed,config').eq('product', PRODUCT);
      if (st) q = q.gte('started_at', st.toISOString());
      return q.order('started_at', { ascending: true }).range(a, b);
    }, 50000);
    var segs = await all(function (a, b) {
      var q = sb.from('usage_segments').select('log_id,seq,label,secs').eq('product', PRODUCT);
      if (st) q = q.gte('started_at', new Date(st.getTime() - 86400000).toISOString());
      return q.order('started_at', { ascending: true }).range(a, b);
    }, 200000);
    var rt = await sb.from('timers').select('id,name,project_id').eq('product', PRODUCT).limit(1000);
    var rp = await sb.from('projects').select('id,name,sort,created_at').eq('product', PRODUCT).order('sort').order('created_at').limit(100);
    var rset = await sb.from('settings').select('data').eq('product', PRODUCT).maybeSingle();
    var sd = (!rset.error && rset.data && rset.data.data) || {};
    setLM(sd);
    S.sb = sb;
    S.data = prepare(logs, segs, rt.error ? [] : rt.data || [], rp.error ? [] : rp.data || [], (sd.breaks && typeof sd.breaks === 'object') ? sd.breaks : {}, st);
    S.loadedFor = key;
    if (S.filter !== 'all' && !S.data.pjNames[S.filter]) S.filter = 'all';
  }

  /* ---------- 集計 ---------- */
  var BREAK_RE = /休憩|きゅうけい|やすみ|break|rest|descanso|pausa|recreo/i;
  function prepare(logs, segs, timers, projects, breaks, st) {
    var tmap = {}; timers.forEach(function (t) { tmap[t.id] = t; });
    var pjNames = {}; projects.forEach(function (p) { pjNames[p.id] = p.name; });
    pjNames.__none = T.pjNone; pjNames.__other = T.pjOther;
    var byLog = {}; segs.forEach(function (g) { (byLog[g.log_id] = byLog[g.log_id] || []).push(g); });
    var list = [];
    logs.forEach(function (l) {
      var t = new Date(l.started_at);
      if (isNaN(t) || (st && t < st)) return;
      var tm = l.timer_id && tmap[l.timer_id];
      var g = (byLog[l.id] || []).slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
      var parts = g.length ? g.map(function (x) { return { label: aliasL(x.label || ''), secs: Math.max(0, Number(x.secs) || 0), seg: true }; })
        : [{ label: '\u0000', secs: Math.max(0, Number(l.total_secs) || 0), seg: false }];
      var cfg = (l.config && typeof l.config === 'object') ? l.config : {};
      list.push({ id: l.id, t: t, timerId: tm ? tm.id : null, timerName: tm ? (tm.name || '') : (typeof cfg.name === 'string' ? cfg.name : ''),
        pj: tm ? (tm.project_id && pjNames[tm.project_id] ? tm.project_id : '__none') : '__other', parts: parts, done: !!l.completed });
    });
    return { at: Date.now(), list: list, projects: projects, pjNames: pjNames, tmap: tmap, breaks: breaks, start: st };
  }
  function isBreak(D, label) {
    if (label === '\u0000') return false;
    if (Object.prototype.hasOwnProperty.call(D.breaks, label)) return D.breaks[label] === 1;
    return BREAK_RE.test(label);
  }
  function buckets(D) {
    var out = [], now = new Date(), d;
    if (S.period === '7d' || S.period === '30d') {
      var n = S.period === '7d' ? 7 : 30;
      d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1));
      for (var i = 0; i < n; i++) { var x = new Date(d); x.setDate(d.getDate() + i); out.push({ d: x, month: false }); }
    } else {
      var first = S.period === '12m' ? periodStart('12m') : null;
      if (!first) {
        first = new Date(now.getFullYear(), now.getMonth(), 1);
        D.list.forEach(function (e) { var m = new Date(e.t.getFullYear(), e.t.getMonth(), 1); if (m < first) first = m; });
      }
      d = new Date(first.getFullYear(), first.getMonth(), 1);
      while (d <= now && out.length < 240) { out.push({ d: new Date(d), month: true }); d.setMonth(d.getMonth() + 1); }
    }
    return out;
  }
  function idxOf(B, t) {
    if (!B.length) return -1;
    if (B[0].month) { var k = (t.getFullYear() - B[0].d.getFullYear()) * 12 + t.getMonth() - B[0].d.getMonth(); return k >= 0 && k < B.length ? k : -1; }
    var day = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var i = Math.round((day - B[0].d) / 86400000); return i >= 0 && i < B.length ? i : -1;
  }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function compute(D) {
    var F = S.filter;
    // 11/15: ラベルでもしぼれる（複数）。選んだラベルの区切りだけを数える
    var LS = null;
    if (S.labels && S.labels.length) { LS = {}; S.labels.forEach(function (l) { LS[l] = 1; }); }
    var mode = (F === 'all' && D.projects.length && !LS) ? 'pj' : 'label';
    var rows = D.list.filter(function (e) {
      if (F !== 'all' && e.pj !== F) return false;
      return !LS || e.parts.some(function (p) { return LS[p.label]; });
    });
    var B = buckets(D);
    B.forEach(function (b) { b.v = {}; b.total = 0; });
    var tot = {}, labels = {}, brkL = {}, timers = {}, work = 0, brk = 0, days = {};
    rows.forEach(function (e) {
      var i = idxOf(B, e.t);
      days[dayKey(e.t)] = 1;
      e.work = 0; e.brk = 0;
      e.parts.forEach(function (p) {
        if (LS && !LS[p.label]) return;
        if (isBreak(D, p.label)) { e.brk += p.secs; brk += p.secs; brkL[p.label] = (brkL[p.label] || 0) + p.secs; return; }
        e.work += p.secs; work += p.secs;
        labels[p.label] = (labels[p.label] || 0) + p.secs;
        var k = mode === 'pj' ? e.pj : p.label;
        tot[k] = (tot[k] || 0) + p.secs;
        if (i >= 0) { B[i].v[k] = (B[i].v[k] || 0) + p.secs; B[i].total += p.secs; }
      });
      if (e.timerId) timers[e.timerId] = (timers[e.timerId] || 0) + e.work;
    });
    // 系列の順番と色: プロジェクトは並び順（色は名前ではなくプロジェクトに付く）、ラベルは多い順に7つ＋その他
    var series = [];
    if (mode === 'pj') {
      D.projects.forEach(function (p) { if (tot[p.id]) series.push({ k: p.id, name: p.name }); });
      ['__none', '__other'].forEach(function (k) { if (tot[k]) series.push({ k: k, name: D.pjNames[k] }); });
    } else {
      Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; }).forEach(function (k) {
        series.push({ k: k, name: k === '\u0000' ? T.noSeg : (k || T.noLabel) });
      });
    }
    var shown = series.slice(0, series.length > 8 ? 7 : 8);
    var rest = series.slice(shown.length);
    if (rest.length) {
      var restKeys = {}; rest.forEach(function (s) { restKeys[s.k] = 1; });
      var o = { k: '\u0001', name: T.other, gray: true };
      tot['\u0001'] = 0; rest.forEach(function (s) { tot['\u0001'] += tot[s.k]; });
      B.forEach(function (b) { var v = 0; for (var k in b.v) if (restKeys[k]) { v += b.v[k]; delete b.v[k]; } if (v) b.v['\u0001'] = v; });
      shown.push(o);
    }
    var slot = 0;
    shown.forEach(function (s) { if (s.gray || s.k === '\u0000' || s.k === '__other') s.cls = 'g'; else s.cls = mode === 'label' ? lcOf(s.k) : 's' + (++slot); });
    return { mode: mode, rows: rows, B: B, series: shown, tot: tot, labels: labels, brkL: brkL, timers: timers, work: work, brk: brk, days: Object.keys(days).length };
  }

  /* ---------- 表示 ---------- */
  function render(sample) {
    var D = S.data;
    body.textContent = '';
    if (!sample) { body.appendChild(viewTabs()); body.appendChild(controls(D)); }
    var C = compute(D);
    var wrap = el('div', { cls: 'ttd-main' });
    body.appendChild(wrap);
    // まとめ
    var nDays = S.period === '7d' ? 7 : S.period === '30d' ? 30 : 0;
    var streak = 0;
    try { var st = JSON.parse(sessionStorage.getItem('tt-stats3') || 'null'); if (st) streak = st.n || 0; } catch (e) {}
    if (sample) streak = 5;
    function tile(label, value, sub) { return el('div', { cls: 'ttd-tile' }, [el('p', { cls: 'ttd-tile-v', text: value }), el('p', { cls: 'ttd-tile-l', text: label }), sub ? el('p', { cls: 'ttd-tile-s', text: sub }) : null]); }
    wrap.appendChild(el('div', { cls: 'ttd-tiles' }, [
      tile(T.work, T.dur(C.work), T.workSub), tile(T.days, T.daysV(C.days, nDays)), tile(T.runs, T.runsV(C.rows.length)), tile(T.streak, T.streakV(streak))
    ]));
    if (!C.rows.length) { wrap.appendChild(el('p', { cls: 'ttd-msg', text: T.empty })); return; }
    // 積み上げ縦棒
    wrap.appendChild(chart(C));
    // 合計の表
    if (C.mode === 'pj') wrap.appendChild(pieTable(T.byPj, C.series.map(function (s) { return { name: s.name, cls: s.cls, secs: C.tot[s.k] }; }), C.work));
    var lrows = Object.keys(C.labels).sort(function (a, b) { return C.labels[b] - C.labels[a]; });
    var lsec = pieTable(T.byLabel, lrows.map(function (l) {
      var s = C.mode === 'label' ? C.series.filter(function (x) { return x.k === l; })[0] : null;
      return { name: l === '\u0000' ? T.noSeg : (l || T.noLabel), cls: s ? s.cls : (C.mode === 'label' ? 'g' : lcOf(l)), secs: C.labels[l], label: l, brk: false };
    }), C.work, sample);
    var bl = Object.keys(C.brkL).sort(function (a, b) { return C.brkL[b] - C.brkL[a]; });
    if (bl.length) {
      lsec.appendChild(el('p', { cls: 'ttd-sub', text: T.brk + ' ' + T.dur(C.brk) + '　' + T.brkNote }));
      lsec.appendChild(tableRows(bl.map(function (l) { return { name: l || T.noLabel, secs: C.brkL[l], label: l, brk: true }; }), 0, sample));
    }
    wrap.appendChild(lsec);
    var tids = Object.keys(C.timers).filter(function (id) { return D.tmap[id] && C.timers[id] > 0; }).sort(function (a, b) { return C.timers[b] - C.timers[a]; });
    if (tids.length) wrap.appendChild(pieTable(T.byTimer, tids.map(function (id) { return { name: D.tmap[id].name || '', secs: C.timers[id], sub: D.pjNames[D.tmap[id].project_id] || '' }; }), C.work));
    wrap.appendChild(details(C, D));
  }

  function controls(D) {
    var bar = el('div', { cls: 'ttd-ctl' });
    var tabs = el('div', { cls: 'ttd-tabs', role: 'group', 'aria-label': T.title });
    var prem = !!window.__ttPremium;
    T.periods.forEach(function (p) {
      var locked = !prem && p[0] !== '7d' && p[0] !== '30d';
      var b = el('button', { type: 'button', cls: 'ttd-tab' + (S.period === p[0] ? ' on' : '') + (locked ? ' lock' : ''), 'aria-pressed': S.period === p[0] ? 'true' : 'false', text: (locked ? '🔒 ' : '') + p[1] });
      b.addEventListener('click', async function () {
        if (locked) { showLock(); ev('data_locked', { period: p[0] }); return; }
        if (S.period === p[0]) return;
        S.period = p[0]; S.more = 10; S.sel = -1; ev('data_period', { period: p[0] });
        body.querySelectorAll('.ttd-tab').forEach(function (x) { x.disabled = true; });
        try { await load(S.sb); } catch (e) { body.appendChild(el('p', { cls: 'ttd-msg err', role: 'status', text: T.err })); return; }
        render(false);
      });
      tabs.appendChild(b);
    });
    bar.appendChild(tabs);
    var right = el('div', { cls: 'ttd-ctl-r' });
    var keys = ['all'].concat(D.projects.map(function (p) { return p.id; }));
    var used = {}; D.list.forEach(function (e) { used[e.pj] = 1; });
    ['__none', '__other'].forEach(function (k) { if (used[k] && D.projects.length) keys.push(k); });
    if (keys.length > 1) {
      var sel = el('select', { cls: 'ttd-sel', 'aria-label': T.filter });
      keys.forEach(function (k) { var o = el('option', { value: k, text: k === 'all' ? T.pjAll : D.pjNames[k] }); if (k === S.filter) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { S.filter = sel.value; S.more = 10; S.sel = -1; ev('data_filter'); render(false); var s2 = body.querySelector('.ttd-sel'); if (s2) s2.focus(); });
      right.appendChild(sel);
    }
    // 11/15: ラベルでしぼる（複数選べる）
    var lt = {}; D.list.forEach(function (e) { if (S.filter !== 'all' && e.pj !== S.filter) return; e.parts.forEach(function (p) { lt[p.label] = (lt[p.label] || 0) + p.secs; }); });
    S.labels.forEach(function (l) { if (!(l in lt)) lt[l] = 0; });
    var lopts = Object.keys(lt).sort(function (a, b) { return lt[b] - lt[a]; });
    var lpanel = null;
    if (lopts.length > 1) {
      var lb = el('button', { type: 'button', cls: 'ttd-csv ttd-lblbtn' + (S.labels.length ? ' on' : ''), 'aria-expanded': S.lblOpen ? 'true' : 'false', text: T.lblBtn(S.labels.length) + ' ▾' });
      lpanel = el('div', { cls: 'ttd-lblpanel', role: 'group', 'aria-label': T.lblFilter });
      if (!S.lblOpen) lpanel.hidden = true;
      lpanel.appendChild(el('p', { cls: 'ttd-lblpanel-t', text: T.lblFilter }));
      var chips = el('div', { cls: 'ttd-lblchips' });
      var allB = el('button', { type: 'button', cls: 'ttd-lchip' + (S.labels.length ? '' : ' on'), 'aria-pressed': S.labels.length ? 'false' : 'true', text: T.lblClear });
      allB.addEventListener('click', function () { S.labels = []; afterLbl(); });
      chips.appendChild(allB);
      lopts.forEach(function (l) {
        var on = S.labels.indexOf(l) >= 0;
        var c = el('button', { type: 'button', cls: 'ttd-lchip' + (on ? ' on' : '') + (isBreak(D, l) ? ' brk' : ''), 'aria-pressed': on ? 'true' : 'false', text: l === '\u0000' ? T.noSeg : (l || T.noLabel) });
        c.addEventListener('click', function () {
          var i = S.labels.indexOf(l);
          if (i >= 0) S.labels.splice(i, 1); else S.labels.push(l);
          afterLbl(l);
        });
        chips.appendChild(c);
      });
      lpanel.appendChild(chips);
      lb.addEventListener('click', function () { S.lblOpen = !S.lblOpen; lpanel.hidden = !S.lblOpen; lb.setAttribute('aria-expanded', S.lblOpen ? 'true' : 'false'); });
      right.appendChild(lb);
    }
    function afterLbl(focusLabel) {
      S.more = 10; S.sel = -1; ev('data_label_filter', { n: S.labels.length });
      render(false);
      var cs = body.querySelectorAll('.ttd-lchip'), idx = focusLabel === undefined ? 0 : lopts.indexOf(focusLabel) + 1;
      if (cs[idx]) cs[idx].focus();
    }
    var csv = el('button', { type: 'button', cls: 'ttd-csv' + (prem ? '' : ' lock'), text: prem ? T.csv : '🔒 ' + T.csvLock });
    csv.addEventListener('click', function () { if (!prem) { showLock(); ev('data_locked', { period: 'csv' }); return; } saveCsv(); });
    right.appendChild(csv);
    bar.appendChild(right);
    if (lpanel) bar.appendChild(lpanel);
    var lock = el('div', { cls: 'ttd-lock', hidden: '', role: 'status' });
    bar.appendChild(lock);
    return bar;
  }
  function showLock(title, lead) {
    var lock = body.querySelector('.ttd-lock');
    if (!lock) return;
    lock.textContent = '';
    var a = el('a', { cls: 'ttd-btn', href: ACCT + '#acct-plans', text: T.plans });
    a.addEventListener('click', function () { ev('data_see_plans', { view: S.view }); });
    lock.appendChild(el('p', { cls: 'ttd-lock-t', text: title || T.lockTitle }));
    lock.appendChild(el('p', { cls: 'ttd-lock-l', text: lead || T.lockLead }));
    lock.appendChild(a);
    lock.hidden = false;
  }

  async function ensureMeta(sb) {
    if (!S.meta || Date.now() - S.meta.at > 60000) {
      var rt = await sb.from('timers').select('id,name,project_id').eq('product', PRODUCT).limit(1000);
      var rp = await sb.from('projects').select('id,name,sort,created_at').eq('product', PRODUCT).order('sort').order('created_at').limit(100);
      var rset = await sb.from('settings').select('data').eq('product', PRODUCT).maybeSingle();
      var sd = (!rset.error && rset.data && rset.data.data) || {};
      setLM(sd);
      S.meta = { at: Date.now(), timers: rt.error ? [] : rt.data || [], projects: rp.error ? [] : rp.data || [], breaks: (sd.breaks && typeof sd.breaks === 'object') ? sd.breaks : {} };
    }
    if (S.data) S.meta.breaks = S.data.breaks; // データの窓で切り替えた休憩を反映
  }
  /* ---------- カレンダー（11/16）: 日ごとの作業時間を色の濃さで。押すとその日の1日の流れ ---------- */
  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function freeLimit() { return window.__ttPremium ? null : new Date(today0().getTime() - (FREE_DAYS - 1) * 86400000); }
  async function loadCal(sb) {
    if (!S.month) S.month = monthStart(new Date());
    var m0 = new Date(S.month), m1 = new Date(m0.getFullYear(), m0.getMonth() + 1, 1), key = m0.getTime();
    if (S.cd && S.cd.key === key && Date.now() - S.cd.at < 30000) return;
    var lim = freeLimit(), q0 = lim && lim > m0 ? lim : m0, days = {};
    function add(t, secs) { if (isNaN(t) || t < m0 || t >= m1 || !(secs > 0)) return; var k = t.getDate(); days[k] = (days[k] || 0) + secs; }
    if (q0 < m1) {
      var logs = await all(function (a, b) {
        return sb.from('usage_logs').select('id,started_at,total_secs').eq('product', PRODUCT).gte('started_at', q0.toISOString()).lt('started_at', m1.toISOString()).order('started_at', { ascending: true }).range(a, b);
      }, 20000);
      var segs = await all(function (a, b) {
        return sb.from('usage_segments').select('log_id,label,secs,started_at').eq('product', PRODUCT).gte('started_at', new Date(q0.getTime() - 86400000).toISOString()).lt('started_at', m1.toISOString()).order('started_at', { ascending: true }).range(a, b);
      }, 100000);
      await ensureMeta(sb);
      var D = { breaks: S.meta.breaks }, ids = {}, byLog = {};
      logs.forEach(function (l) { ids[l.id] = 1; });
      segs.forEach(function (g) { if (ids[g.log_id]) (byLog[g.log_id] = byLog[g.log_id] || []).push(g); });
      logs.forEach(function (l) {
        var g = byLog[l.id];
        if (g && g.length) g.forEach(function (x) {
          if (isBreak(D, aliasL(x.label || '').slice(0, 30))) return;
          var ms = Date.parse(x.started_at); if (!isFinite(ms)) ms = Date.parse(l.started_at);
          add(new Date(ms), Number(x.secs) || 0);
        });
        else add(new Date(l.started_at), Number(l.total_secs) || 0);
      });
    }
    S.cd = { key: key, at: Date.now(), days: days, lim: lim };
  }
  function shortDur(s) { var m = Math.round(s / 60); if (m < 60) return m + 'm'; var h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? (r < 10 ? '0' : '') + r : ''); }
  function heat(s) { return s < 60 ? 0 : s < 1800 ? 1 : s < 3600 ? 2 : s < 7200 ? 3 : 4; }
  function renderCal() {
    var C = TD.cal, cd = S.cd, m0 = new Date(S.month), y = m0.getFullYear(), mo = m0.getMonth();
    var nDays = new Date(y, mo + 1, 0).getDate(), t0 = today0(), thisMonth = monthStart(new Date()).getTime() === m0.getTime();
    body.textContent = '';
    body.appendChild(viewTabs());
    var nav = el('div', { cls: 'ttd-daynav' });
    var prev = el('button', { type: 'button', 'aria-label': C.prev, text: '‹' });
    var next = el('button', { type: 'button', 'aria-label': C.next, text: '›' });
    if (thisMonth) next.disabled = true;
    nav.appendChild(prev);
    nav.appendChild(el('p', { cls: 'ttd-daynav-d', 'aria-live': 'polite' }, [el('b', { text: C.month(m0) })]));
    nav.appendChild(next);
    function move(dir) {
      var nm = new Date(y, mo + dir, 1);
      if (dir > 0 && nm > monthStart(new Date())) return;
      var lim = freeLimit();
      if (dir < 0 && lim && new Date(y, mo, 1) <= lim) { showLock(C.lockT, TD.lockL(FREE_DAYS)); ev('data_locked', { period: 'cal' }); return; }
      S.month = nm; ev('cal_move', { dir: dir < 0 ? 'prev' : 'next' });
      nav.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
      show().then(function () { var b = body.querySelectorAll('.ttd-daynav button')[dir < 0 ? 0 : 1]; if (b && !b.disabled) b.focus(); });
    }
    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    body.appendChild(nav);
    body.appendChild(el('div', { cls: 'ttd-lock', hidden: '', role: 'status' }));
    var wrap = el('div', { cls: 'ttd-main' });
    body.appendChild(wrap);
    // 合計・記録した日・最長連続
    var total = 0, nRec = 0, best = 0, run = 0;
    for (var d = 1; d <= nDays; d++) {
      var v = cd.days[d] || 0; total += v;
      if (v >= 60) { nRec++; run++; if (run > best) best = run; } else run = 0;
    }
    var sec = el('section', { cls: 'ttd-sec' });
    sec.appendChild(el('div', { cls: 'ttd-dsum' }, [el('h3', { text: C.total }), el('p', { cls: 'ttd-dsum-v', text: T.dur(total) })]));
    sec.appendChild(el('p', { cls: 'ttd-cal-stat' }, [el('span', { text: C.days(nRec) }), best >= 2 ? el('span', { text: C.best(best) }) : null]));
    // 曜日と日付のマス
    var grid = el('div', { cls: 'ttd-cal', role: 'grid', 'aria-label': C.month(m0) });
    var head = el('div', { cls: 'ttd-cal-row ttd-cal-wd', role: 'row' });
    C.wd.forEach(function (w) { head.appendChild(el('span', { role: 'columnheader', text: w })); });
    grid.appendChild(head);
    var first = new Date(y, mo, 1).getDay(); if (C.mon) first = (first + 6) % 7;
    var row = el('div', { cls: 'ttd-cal-row', role: 'row' }), col = 0;
    for (var i = 0; i < first; i++) { row.appendChild(el('span', { cls: 'ttd-cal-c empty', role: 'gridcell' })); col++; }
    for (var dd = 1; dd <= nDays; dd++) {
      (function (day) {
        var date = new Date(y, mo, day), secs = cd.days[day] || 0, lv = heat(secs);
        var future = date > t0, locked = cd.lim && date < cd.lim;
        var cls = 'ttd-cal-c h' + lv + (date.getTime() === t0.getTime() ? ' today' : '') + (future ? ' future' : '') + (locked ? ' lock' : '');
        var kids = [el('span', { cls: 'ttd-cal-n', text: String(day) }), lv ? el('span', { cls: 'ttd-cal-v', text: shortDur(secs) }) : null];
        var c;
        if (future || locked) c = el('span', Object.assign({ cls: cls, role: 'gridcell' }, locked ? { title: C.locked } : {}), kids);
        else {
          c = el('button', { type: 'button', cls: cls, role: 'gridcell', 'aria-label': C.open(date, secs >= 60 ? T.dur(secs) : C.none) }, kids);
          c.addEventListener('click', function () {
            S.day = date; S.view = 'day'; S.more = 10; S.sel = -1;
            ev('cal_day', { back: daysBack(date), lv: lv }); ev('day_view', { from: 'cal', member: member() });
            show().then(function () { var f = body.querySelector('.ttd-view.on'); if (f) f.focus(); });
          });
        }
        row.appendChild(c);
      })(dd);
      col++;
      if (col === 7) { grid.appendChild(row); row = el('div', { cls: 'ttd-cal-row', role: 'row' }); col = 0; }
    }
    if (col) { while (col < 7) { row.appendChild(el('span', { cls: 'ttd-cal-c empty', role: 'gridcell' })); col++; } grid.appendChild(row); }
    sec.appendChild(grid);
    var lg = el('div', { cls: 'ttd-cal-lg', 'aria-hidden': 'true' }, [el('span', { text: C.short })]);
    [1, 2, 3, 4].forEach(function (k) { lg.appendChild(el('i', { cls: 'h' + k })); });
    lg.appendChild(el('span', { text: C.long }));
    sec.appendChild(lg);
    wrap.appendChild(sec);
    if (cd.lim) wrap.appendChild(el('p', { cls: 'ttd-hint', text: TD.note(FREE_DAYS) }));
  }

  /* ---------- 1日の流れ ---------- */
  function viewTabs() {
    var row = el('div', { cls: 'ttd-views-row' });
    var tabs = el('div', { cls: 'ttd-tabs ttd-views', role: 'group' });
    TD.views.forEach(function (v) {
      var on = S.view === v[0];
      var b = el('button', { type: 'button', cls: 'ttd-tab ttd-view' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', text: v[1] });
      b.addEventListener('click', function () {
        if (S.view === v[0]) return;
        S.view = v[0]; S.more = 10; S.sel = -1;
        if (v[0] === 'day') { if (!S.day) S.day = today0(); ev('day_view', { from: 'tab', member: member() }); }
        if (v[0] === 'cal') ev('cal_view', { member: member() });
        body.querySelectorAll('.ttd-tab, .ttd-daynav button').forEach(function (x) { x.disabled = true; });
        show().then(function () { var f = body.querySelector('.ttd-view.on'); if (f) f.focus(); });
      });
      tabs.appendChild(b);
    });
    row.appendChild(tabs);
    return row;
  }
  function daysBack(d) { return Math.round((today0() - d) / 86400000); }
  async function loadDay(sb) {
    var d0 = new Date(S.day), d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    var key = dayKey(d0);
    if (S.dd && S.dd.key === key && Date.now() - S.dd.at < 30000) return;
    var r = await sb.from('usage_logs').select('id,started_at,total_secs,timer_id,completed,config,ended_at').eq('product', PRODUCT)
      .gte('started_at', d0.toISOString()).lt('started_at', d1.toISOString()).order('started_at', { ascending: true }).limit(1000);
    if (r.error) throw r.error;
    var logs = r.data || [], segs = [];
    for (var i = 0; i < logs.length; i += 100) {
      var ids = logs.slice(i, i + 100).map(function (l) { return l.id; });
      var rs = await sb.from('usage_segments').select('log_id,seq,label,secs,started_at').eq('product', PRODUCT).in('log_id', ids).limit(5000);
      if (rs.error) throw rs.error;
      segs = segs.concat(rs.data || []);
    }
    await ensureMeta(sb);
    S.dd = { key: key, at: Date.now(), D: prepareDay(logs, segs, S.meta) };
  }
  function prepareDay(logs, segs, M) {
    var tmap = {}; M.timers.forEach(function (t) { tmap[t.id] = t; });
    var pjNames = {}; M.projects.forEach(function (p) { pjNames[p.id] = p.name; });
    var byLog = {}; segs.forEach(function (g) { (byLog[g.log_id] = byLog[g.log_id] || []).push(g); });
    var list = [];
    logs.forEach(function (l) {
      var t = new Date(l.started_at); if (isNaN(t)) return;
      var tm = l.timer_id && tmap[l.timer_id];
      var cfg = (l.config && typeof l.config === 'object') ? l.config : {};
      var g = (byLog[l.id] || []).slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
      var at = t.getTime(), parts;
      if (g.length) parts = g.map(function (x) {
        var secs = Math.max(0, Number(x.secs) || 0), s = Date.parse(x.started_at);
        if (!isFinite(s)) s = at;
        at = s + secs * 1000;
        return { label: aliasL(x.label || '').slice(0, 30), secs: secs, s: s, seq: x.seq };
      });
      else parts = [{ label: '', secs: Math.max(0, Number(l.total_secs) || 0), s: at }];
      list.push({ id: l.id, endedAt: l.ended_at || null, noSegs: !g.length, t: t, timerName: tm ? (tm.name || '') : (typeof cfg.name === 'string' ? cfg.name.slice(0, 40) : ''),
        pjName: tm && tm.project_id && pjNames[tm.project_id] ? pjNames[tm.project_id] : '', parts: parts, done: !!l.completed });
    });
    return { list: list, breaks: M.breaks };
  }
  function renderDay() {
    var D = S.dd.D, prem = !!window.__ttPremium, isToday = daysBack(S.day) === 0;
    body.textContent = '';
    body.appendChild(viewTabs());
    // 日付の切り替え
    var nav = el('div', { cls: 'ttd-daynav' });
    var prev = el('button', { type: 'button', 'aria-label': TD.prev, text: '‹' });
    var next = el('button', { type: 'button', 'aria-label': TD.next, text: '›' });
    if (isToday) next.disabled = true;
    var back = daysBack(S.day);
    var sub = back === 0 ? TD.today : back === 1 ? TD.yday : '';
    nav.appendChild(prev);
    nav.appendChild(el('p', { cls: 'ttd-daynav-d', 'aria-live': 'polite' }, [el('b', { text: TD.date(S.day) }), sub ? el('span', { text: sub }) : null]));
    nav.appendChild(next);
    function move(dir) {
      var nb = back + (dir < 0 ? 1 : -1);
      if (nb < 0) return;
      if (!prem && nb > FREE_DAYS - 1) { showLock(TD.lockT, TD.lockL(FREE_DAYS)); ev('data_locked', { period: 'day', back: nb }); return; }
      var d = new Date(S.day); d.setDate(d.getDate() + (dir < 0 ? -1 : 1)); S.day = d;
      ev('day_move', { dir: dir < 0 ? 'prev' : 'next', back: nb });
      nav.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
      show().then(function () { var f = body.querySelector('.ttd-daynav button:not([disabled])'); var want = body.querySelectorAll('.ttd-daynav button')[dir < 0 ? 0 : 1]; if (want && !want.disabled) want.focus(); else if (f) f.focus(); });
    }
    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    body.appendChild(nav);
    body.appendChild(el('div', { cls: 'ttd-lock', hidden: '', role: 'status' }));
    var wrap = el('div', { cls: 'ttd-main' });
    body.appendChild(wrap);
    if (S.flash) { wrap.appendChild(el('p', { cls: 'ttd-msg ttd-ok', role: 'status', text: S.flash })); S.flash = null; }
    // ラベルごとの作業時間 → 多い順に色（ホームのカードと同じ順番）。8つ目以降は「ほか」
    var tot = {}, work = 0;
    D.list.forEach(function (e) { e.work = 0; e.brk = 0; e.parts.forEach(function (p) { if (isBreak(D, p.label)) { e.brk += p.secs; return; } e.work += p.secs; work += p.secs; tot[p.label] = (tot[p.label] || 0) + p.secs; }); });
    var keys = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
    var cls = {}; keys.forEach(function (k, i) { cls[k] = i < 7 ? lcOf(k) : 'g'; });
    function nm(l) { return l || T.noLabel; }
    function clsOf(p) { return isBreak(D, p.label) ? 'b' : cls[p.label]; }
    if (!D.list.length) {
      wrap.appendChild(el('p', { cls: 'ttd-msg', text: isToday ? TD.emptyToday : TD.empty }));
    } else {
      // 合計と内訳
      var sum = el('section', { cls: 'ttd-sec' });
      sum.appendChild(el('div', { cls: 'ttd-dsum' }, [el('h3', { text: TD.total }), el('p', { cls: 'ttd-dsum-v', text: T.dur(work) })]));
      if (work) {
        var sbar = el('div', { cls: 'ttd-dbar', 'aria-hidden': 'true' });
        var other = 0;
        keys.forEach(function (k, i) { if (i >= 7) { other += tot[k]; return; } var s = el('span', { cls: cls[k] }); s.style.flexGrow = String(tot[k]); sbar.appendChild(s); });
        if (other) { var so = el('span', { cls: 'g' }); so.style.flexGrow = String(other); sbar.appendChild(so); }
        sum.appendChild(sbar);
        var rows = keys.slice(0, 7).map(function (k) { return { name: nm(k), cls: cls[k], secs: tot[k] }; });
        if (other) rows.push({ name: TD.other, cls: 'g', secs: other });
        sum.appendChild(tableRows(rows, work, true));
      }
      wrap.appendChild(sum);
      // 帯（6時〜24時。6時より前の記録がある日は0時から）
      var d0 = S.day.getTime(), d1 = d0 + 86400000;
      var first = d1; D.list.forEach(function (e) { e.parts.forEach(function (p) { if (p.s < first) first = p.s; }); });
      var startH = first < d0 + 6 * 3600000 ? 0 : 6, a = d0 + startH * 3600000, span = d1 - a;
      var flow = el('section', { cls: 'ttd-sec' });
      flow.appendChild(el('h3', { text: TD.flow }));
      var tl = el('div', { cls: 'ttd-tl', 'aria-hidden': 'true' });
      D.list.forEach(function (e) {
        e.parts.forEach(function (p) {
          var s = Math.max(p.s, a), en = Math.min(p.s + p.secs * 1000, d1);
          if (en <= s) return;
          var seg = el('span', { cls: clsOf(p) });
          seg.style.left = ((s - a) / span * 100).toFixed(2) + '%';
          seg.style.width = Math.max(0.5, (en - s) / span * 100).toFixed(2) + '%';
          tl.appendChild(seg);
        });
      });
      var now = Date.now();
      if (isToday && now > a) { var nw = el('span', { cls: 'now' }); nw.style.left = ((now - a) / span * 100).toFixed(2) + '%'; tl.appendChild(nw); }
      flow.appendChild(tl);
      flow.appendChild(el('div', { cls: 'ttd-tl-ax', 'aria-hidden': 'true' }, (startH ? TD.hours.slice(1) : TD.hours.filter(function (x, i) { return i % 2 === 0; })).map(function (h) { return el('span', { text: h }); })));
      // 1回ずつの流れ
      var ul = el('ul', { cls: 'ttd-flow' });
      // 11/16: 1分未満の記録（すぐ止めたもの）はふだん隠し、下のボタンで出す
      function tiny(e) { return e.work + e.brk < 60; }
      var tinyN = D.list.filter(tiny).length;
      D.list.filter(function (e) { return S.showTiny || !tiny(e); }).forEach(function (e) {
        var main = e.parts.filter(function (p) { return !isBreak(D, p.label); })[0] || e.parts[0];
        var title = e.pjName || e.timerName || nm(main.label);
        var subs = [];
        if (e.pjName && e.timerName && e.timerName !== title) subs.push(e.timerName);
        // 区切りが1つで名前が見出しと同じなら、内訳は出さない
        var seq = [];
        if (e.parts.length > 1 || (nm(e.parts[0].label) !== title && subs.indexOf(e.parts[0].label) < 0)) {
          seq = e.parts.slice(0, 6).map(function (p) { return (isBreak(D, p.label) ? (p.label || TD.brk) : nm(p.label)) + ' ' + T.dur(p.secs); });
          if (e.parts.length > 6) seq.push('…');
        }
        var desc = subs.concat(seq.length ? [seq.join(' → ')] : []).join('\n');
        // 11/16: 終わりの時刻も（最後の区切りの終わり）。鉛筆で時間を変える・消す
        var endMs = e.t.getTime(); e.parts.forEach(function (p) { endMs = Math.max(endMs, p.s + p.secs * 1000); });
        var endD = new Date(endMs);
        var edb = el('button', { type: 'button', cls: 'ttd-flow-e', 'aria-label': TD.ed.btn + '（' + hm(e.t) + '〜' + hm(endD) + ' ' + title + '）', title: TD.ed.btn, 'aria-expanded': 'false' });
        edb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
        var li = el('li', null, [
          el('span', { cls: 'ttd-flow-t' }, [el('span', { text: hm(e.t) }), el('span', { cls: 'ttd-flow-end', text: '〜' + hm(endD) })]),
          el('span', { cls: 'ttd-flow-c ' + clsOf(main), 'aria-hidden': 'true' }),
          el('span', { cls: 'ttd-flow-b' }, [el('span', { cls: 'ttd-flow-n', text: title }), el('span', { cls: 'ttd-flow-p', text: desc })]),
          el('span', { cls: 'ttd-flow-v' }, [el('span', { text: T.dur(e.work) + (e.done ? ' ✓' : '') }), edb])
        ]);
        edb.addEventListener('click', function () { toggleEdit(li, edb, e, D); });
        ul.appendChild(li);
      });
      if (tinyN) {
        var tb = el('button', { type: 'button', cls: 'ttd-flow-tiny', 'aria-expanded': S.showTiny ? 'true' : 'false', text: S.showTiny ? TD.tinyHide : TD.tinyShow(tinyN) });
        tb.addEventListener('click', function () { S.showTiny = !S.showTiny; ev('day_tiny', { show: S.showTiny ? 1 : 0, n: tinyN }); renderDay(); var f = body.querySelector('.ttd-flow-tiny'); if (f) f.focus(); });
        ul.appendChild(el('li', { cls: 'tiny' }, [tb]));
      }
      if (isToday) {
        var t = new Date();
        ul.appendChild(el('li', { cls: 'now' }, [el('span', { cls: 'ttd-flow-t', text: t.getHours() + ':' + pad(t.getMinutes()) }), el('span', { cls: 'ttd-flow-dot', 'aria-hidden': 'true' }), el('span', { cls: 'ttd-flow-n', text: TD.now })]));
      }
      flow.appendChild(ul);
      wrap.appendChild(flow);
    }
    if (!prem) wrap.appendChild(el('p', { cls: 'ttd-hint', text: TD.note(FREE_DAYS) }));
  }

  /* ---------- 1日の流れ: 記録の時間を変える・消す（11/16） ---------- */
  function hm(d) { return d.getHours() + ':' + pad(d.getMinutes()); }
  function closeEdits() {
    body.querySelectorAll('.ttd-edit').forEach(function (f) { f.remove(); });
    body.querySelectorAll('.ttd-flow-e[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  function toggleEdit(li, btn, e, D) {
    var open = btn.getAttribute('aria-expanded') === 'true';
    closeEdits();
    if (open) { btn.focus(); return; }
    btn.setAttribute('aria-expanded', 'true');
    var E = TD.ed, box = el('div', { cls: 'ttd-edit', role: 'group', 'aria-label': E.btn });
    li.appendChild(box);
    function msg(t) { var m = box.querySelector('.ttd-edit-m'); if (!m) { m = el('p', { cls: 'ttd-edit-m', role: 'alert' }); box.appendChild(m); } m.textContent = t; }
    // 動いている記録は変えない（保存のたびに上書きされるため）
    var act = window.__ttActiveLogs ? window.__ttActiveLogs() : [];
    if (act.indexOf(e.id) >= 0) { msg(E.running); return; }
    var endAt = e.endedAt ? Date.parse(e.endedAt) : NaN;
    var mine = window.__ttEndedHere ? window.__ttEndedHere() : [];
    if (!e.done && mine.indexOf(e.id) < 0 && (!isFinite(endAt) || Date.now() - endAt < 75000)) { msg(E.recent); return; }
    var stIn = el('input', { type: 'time', step: '60', value: pad(e.t.getHours()) + ':' + pad(e.t.getMinutes()), 'aria-label': E.start });
    box.appendChild(el('label', { cls: 'ttd-edit-st' }, [el('span', { text: E.start }), stIn]));
    var ins = [];
    var list = el('ul', { cls: 'ttd-edit-parts' });
    e.parts.forEach(function (p, i) {
      var nm = isBreak(D, p.label) ? (p.label || TD.brk) : (p.label || T.noLabel);
      var orig = Math.round(p.secs / 60);
      var inp = el('input', { type: 'number', min: '0', max: '720', step: '1', inputmode: 'numeric', value: String(orig), 'aria-label': nm + '（' + E.len + '）' });
      inp.dataset.orig = String(orig);
      ins.push(inp);
      list.appendChild(el('li', null, [el('span', { cls: 'ttd-edit-n', text: nm }), el('span', { cls: 'ttd-edit-v' }, [inp, el('span', { text: E.len })])]));
    });
    box.appendChild(list);
    var sumEl = el('p', { cls: 'ttd-edit-sum' });
    box.appendChild(sumEl);
    function secsOf(i) {
      var inp = ins[i], v = inp.value.trim();
      if (v === inp.dataset.orig) return e.parts[i].secs; // 変えていない区切りは秒まで元のまま
      var n = Math.round(Number(v));
      return isFinite(n) && n >= 0 && n <= 720 ? n * 60 : NaN;
    }
    function upd() { var t = 0; ins.forEach(function (x, i) { t += secsOf(i) || 0; }); sumEl.textContent = E.sum + ' ' + T.dur(t); }
    ins.forEach(function (x) { x.addEventListener('input', upd); });
    upd();
    var save = el('button', { type: 'button', cls: 'ttd-edit-save', text: E.save });
    var cancel = el('button', { type: 'button', cls: 'ttd-edit-cancel', text: E.cancel });
    var del = el('button', { type: 'button', cls: 'ttd-edit-del', text: E.del });
    box.appendChild(el('div', { cls: 'ttd-edit-btns' }, [save, cancel]));
    box.appendChild(del);
    cancel.addEventListener('click', function () { closeEdits(); btn.focus(); });
    save.addEventListener('click', async function () {
      var secs = e.parts.map(function (p, i) { return secsOf(i); });
      if (secs.some(function (x) { return !isFinite(x); })) { msg(E.errLen); return; }
      var total = secs.reduce(function (a, b) { return a + b; }, 0);
      if (total < 60 || total > 12 * 3600) { msg(E.errLen); return; }
      var m = /^(\d{1,2}):(\d{2})/.exec(stIn.value || '');
      if (!m) { msg(E.errSave); return; }
      var st = new Date(e.t);
      var moved = Number(m[1]) !== e.t.getHours() || Number(m[2]) !== e.t.getMinutes();
      if (moved) st.setHours(Number(m[1]), Number(m[2]), 0, 0);
      save.disabled = del.disabled = true;
      var r = await saveEdit(e, st.getTime(), secs);
      if (!r.ok) { save.disabled = del.disabled = false; msg(r.why === 'future' ? E.errEnd : E.errSave); return; }
      ev('log_edit', { parts: e.parts.length, moved: moved ? 1 : 0, back: daysBack(S.day) });
      afterEdit(E.saved);
    });
    var sure = false;
    del.addEventListener('click', async function () {
      if (!sure) { sure = true; del.textContent = E.delSure; del.classList.add('sure'); return; }
      save.disabled = del.disabled = true;
      var ok = await delRec(e);
      if (!ok) { save.disabled = del.disabled = false; msg(E.errDel); return; }
      ev('log_delete', { back: daysBack(S.day) });
      afterEdit(E.deleted);
    });
    stIn.focus();
  }
  function afterEdit(text) {
    S.dd = null; S.data = null; S.cd = null; S.flash = text;
    if (window.__ttStatsRefresh) window.__ttStatsRefresh();
    show().then(function () { var f = body.querySelector('.ttd-ok'); if (f) { f.setAttribute('tabindex', '-1'); f.focus(); } });
  }
  // 区切りの間のすき間（一時停止）はそのまま、始まりと長さだけ変える
  async function saveEdit(e, st, secs) {
    var sb = S.sb, cur = st, rows = [];
    e.parts.forEach(function (p, i) {
      var prevEnd = i === 0 ? e.t.getTime() : e.parts[i - 1].s + e.parts[i - 1].secs * 1000;
      var gap = Math.max(0, Math.min(p.s - prevEnd, 12 * 3600000));
      var s = cur + gap;
      rows.push({ p: p, s: s, secs: secs[i] });
      cur = s + secs[i] * 1000;
    });
    if (cur > Date.now() + 60000) return { ok: false, why: 'future' };
    try {
      if (!e.noSegs) {
        for (var i = 0; i < rows.length; i++) {
          var x = rows[i];
          if (x.secs === x.p.secs && x.s === x.p.s) continue;
          var q = x.secs > 0
            ? sb.from('usage_segments').update({ secs: x.secs, started_at: new Date(x.s).toISOString() })
            : sb.from('usage_segments').delete();
          var r = await q.eq('log_id', e.id).eq('seq', x.p.seq).select('log_id');
          if (r.error || !r.data || !r.data.length) return { ok: false, why: 'db' };
        }
      }
      var w = await sb.from('usage_logs').update({ started_at: new Date(st).toISOString(), total_secs: secs.reduce(function (a, b) { return a + b; }, 0), ended_at: new Date(cur).toISOString() })
        .eq('id', e.id).select('id');
      if (w.error || !w.data || !w.data.length) return { ok: false, why: 'db' };
      return { ok: true };
    } catch (err) { return { ok: false, why: 'net' }; }
  }
  // 利用記録を先に消す（消せなければ何も変えない）。区切りが残って消せないときは区切り→記録の順
  async function delRec(e) {
    var sb = S.sb;
    try {
      var r = await sb.from('usage_logs').delete().eq('id', e.id).select('id');
      if (!r.error && r.data && r.data.length) { await sb.from('usage_segments').delete().eq('log_id', e.id); return true; }
      if (!r.error) return false; // 権限がなく消えなかった
      var g = await sb.from('usage_segments').delete().eq('log_id', e.id).select('log_id');
      if (g.error) return false;
      var r2 = await sb.from('usage_logs').delete().eq('id', e.id).select('id');
      return !r2.error && r2.data && r2.data.length > 0;
    } catch (err) { return false; }
  }

  function chart(C) {
    var sec = el('section', { cls: 'ttd-sec' });
    sec.appendChild(el('h3', { text: T.chart(S.period) }));
    // 凡例（2つ以上のとき）
    if (C.series.length > 1) sec.appendChild(el('ul', { cls: 'ttd-legend' }, C.series.map(function (s) {
      return el('li', null, [el('span', { cls: 'ttd-sw ' + s.cls, 'aria-hidden': 'true' }), s.name]);
    })));
    var max = 0; C.B.forEach(function (b) { if (b.total > max) max = b.total; });
    max = max || 1;
    var many = C.B.length > 14;
    var grid = el('div', { cls: 'ttd-chart' + (many ? ' many' : '') });
    grid.appendChild(el('span', { cls: 'ttd-max', text: T.dur(max) }));
    var info = el('p', { cls: 'ttd-info', 'aria-live': 'polite' });
    var last = -1; C.B.forEach(function (b, i) { if (b.total) last = i; });
    if (S.sel < 0 || S.sel >= C.B.length) S.sel = last >= 0 ? last : C.B.length - 1;
    var cols = [];
    function lab(b) { return b.month ? T.monFmt(b.d) + (b.d.getMonth() === 0 || C.B.length <= 12 ? '' : '') : T.dayFmt(b.d); }
    function full(b) { return b.month ? (lang === 'ja' ? b.d.getFullYear() + '年' + T.monFmt(b.d) : T.monFmt(b.d) + ' ' + b.d.getFullYear()) : T.dayFmt(b.d) + (lang === 'ja' ? '（' + T.wd[b.d.getDay()] + '）' : ' ' + T.wd[b.d.getDay()]); }
    function say(i) {
      var b = C.B[i];
      info.textContent = '';
      info.appendChild(el('b', { text: full(b) + '  ' + T.total + ' ' + T.dur(b.total) }));
      C.series.forEach(function (s) { if (b.v[s.k]) info.appendChild(el('span', { cls: 'ttd-info-i' }, [el('span', { cls: 'ttd-sw ' + s.cls, 'aria-hidden': 'true' }), s.name + ' ' + T.dur(b.v[s.k])])); });
      cols.forEach(function (c, j) { c.classList.toggle('sel', j === i); c.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    }
    C.B.forEach(function (b, i) {
      var desc = full(b) + ' ' + T.dur(b.total) + C.series.filter(function (s) { return b.v[s.k]; }).map(function (s) { return '、' + s.name + ' ' + T.dur(b.v[s.k]); }).join('');
      var col = el('button', { type: 'button', cls: 'ttd-col', 'aria-label': desc });
      var stack = el('span', { cls: 'ttd-stack' });
      stack.style.height = (b.total ? Math.max(2, b.total / max * 100) : 0) + '%';
      C.series.slice().reverse().forEach(function (s) {
        var v = b.v[s.k]; if (!v) return;
        var seg = el('span', { cls: 'ttd-seg ' + s.cls }); seg.style.flexGrow = String(v); stack.appendChild(seg);
      });
      var track = el('span', { cls: 'ttd-track' }, [stack]);
      col.appendChild(track);
      var show = !many || i % 5 === (C.B.length - 1) % 5 || i === C.B.length - 1;
      if (C.B[0].month && C.B.length > 12) show = b.d.getMonth() % 3 === 0 || i === C.B.length - 1;
      col.appendChild(el('span', { cls: 'ttd-x-l' + (show ? '' : ' hide'), text: lab(b) }));
      if (S.period === '7d') col.appendChild(el('span', { cls: 'ttd-x-w', text: T.wd[b.d.getDay()] }));
      col.addEventListener('click', function () { S.sel = i; say(i); if (!S.dayEv) { S.dayEv = 1; ev('data_day_click', { period: S.period }); } });
      col.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { S.sel = i; say(i); } });
      cols.push(col); grid.appendChild(col);
    });
    var scroller = el('div', { cls: 'ttd-chart-wrap' }, [grid]);
    sec.appendChild(scroller);
    sec.appendChild(info);
    sec.appendChild(el('p', { cls: 'ttd-hint', text: T.tapHint }));
    say(S.sel);
    setTimeout(function () { scroller.scrollLeft = scroller.scrollWidth; }, 0);
    return sec;
  }

  function table(title, rows, total, sample) {
    var sec = el('section', { cls: 'ttd-sec' });
    sec.appendChild(el('h3', { text: title }));
    sec.appendChild(tableRows(rows, total, sample));
    return sec;
  }
  /* 11/15: 割合は円グラフ（ドーナツ型）＋表（時間と％はそのまま） */
  function pieTable(title, rows, total, sample, pieTotal) {
    var slot = 0;
    rows.forEach(function (r) { if (!r.cls) r.cls = slot < 7 ? 's' + (++slot) : 'g'; else if (/^s\d$/.test(r.cls)) slot = Math.max(slot, Number(r.cls.slice(1))); });
    var sec = el('section', { cls: 'ttd-sec' });
    sec.appendChild(el('h3', { text: title }));
    var box = el('div', { cls: 'ttd-piebox' });
    if (rows.length > 1) box.appendChild(pie(rows, pieTotal || total, title));
    box.appendChild(tableRows(rows, total, sample));
    sec.appendChild(box);
    return sec;
  }
  function pie(rows, total, title) {
    var NS = 'http://www.w3.org/2000/svg';
    function mk(tag, a) { var n = document.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); return n; }
    var R0 = 50, W = 20, CIRC = 2 * Math.PI * R0;
    var sum = 0; rows.forEach(function (r) { sum += r.secs; });
    var base = Math.max(total || 0, sum, 1); // 表の％と同じ分母（マイタイマーごとは、マイタイマー以外の分が薄い輪のまま残る）
    var svg = mk('svg', { viewBox: '0 0 140 140', class: 'ttd-pie', role: 'img' });
    var parts = [], gray = 0;
    rows.forEach(function (r) { if (r.cls === 'g') gray += r.secs; else parts.push({ cls: r.cls, secs: r.secs, name: r.name }); });
    if (gray) parts.push({ cls: 'g', secs: gray });
    svg.setAttribute('aria-label', T.pieOf(title) + ': ' + rows.slice(0, 8).map(function (r) { return r.name + ' ' + Math.round(r.secs / base * 100) + '%'; }).join('、'));
    svg.appendChild(mk('circle', { cx: 70, cy: 70, r: R0, class: 'ttd-pie-track', fill: 'none', 'stroke-width': W }));
    var off = 0, labels = [];
    parts.forEach(function (p) {
      var len = p.secs / base * CIRC;
      if (len <= 0) return;
      var gap = parts.length > 1 && len > 2 ? 1.2 : 0;
      svg.appendChild(mk('circle', { cx: 70, cy: 70, r: R0, fill: 'none', 'stroke-width': W, class: 'ttd-pie-s ' + p.cls,
        'stroke-dasharray': Math.max(0, len - gap) + ' ' + (CIRC - Math.max(0, len - gap)), 'stroke-dashoffset': String(-off), transform: 'rotate(-90 70 70)' }));
      // 10％以上の切れ目には％を直接書く（時間と％は右の表にも残す）
      var pct = Math.round(p.secs / base * 100);
      if (pct >= 10) {
        var ang = (off + len / 2) / CIRC * 2 * Math.PI - Math.PI / 2;
        var tx = mk('text', { x: (70 + R0 * Math.cos(ang)).toFixed(1), y: (70 + R0 * Math.sin(ang) + 3.5).toFixed(1), 'text-anchor': 'middle', class: 'ttd-pie-pct', 'aria-hidden': 'true' });
        tx.textContent = pct + '%';
        labels.push(tx);
      }
      off += len;
    });
    labels.forEach(function (t) { svg.appendChild(t); });
    var t1 = mk('text', { x: 70, y: 66, 'text-anchor': 'middle', class: 'ttd-pie-c1' }); t1.textContent = T.total;
    var t2 = mk('text', { x: 70, y: 84, 'text-anchor': 'middle', class: 'ttd-pie-c2' }); t2.textContent = T.dur(sum);
    svg.appendChild(t1); svg.appendChild(t2);
    return svg;
  }
  function tableRows(rows, total, sample) {
    var ul = el('ul', { cls: 'ttd-rows' });
    var max = 0; rows.forEach(function (r) { if (r.secs > max) max = r.secs; });
    rows.forEach(function (r) {
      var li = el('li', { cls: 'ttd-row' + (r.brk ? ' brk' : '') });
      var name = el('span', { cls: 'ttd-row-n' }, [r.cls ? el('span', { cls: 'ttd-sw ' + r.cls, 'aria-hidden': 'true' }) : null, el('span', { cls: 'ttd-row-t', text: r.name }), r.sub ? el('span', { cls: 'ttd-row-sub', text: r.sub }) : null]);
      var val = el('span', { cls: 'ttd-row-v', text: T.dur(r.secs) + (total && !r.brk ? '  ' + Math.round(r.secs / total * 100) + '%' : '') });
      var bar = el('span', { cls: 'ttd-row-bar', 'aria-hidden': 'true' }); var fill = el('span'); fill.style.width = (max ? r.secs / max * 100 : 0) + '%'; bar.appendChild(fill);
      li.appendChild(name); li.appendChild(val); li.appendChild(bar);
      if (!sample && typeof r.label === 'string' && r.label !== '\u0000' && S.sb) {
        var t = el('button', { type: 'button', cls: 'ttd-tog', text: r.brk ? T.toWork : T.toBreak });
        t.addEventListener('click', async function () {
          t.disabled = true;
          var ok = await saveBreak(r.label, r.brk ? 0 : 1);
          if (!ok) { t.disabled = false; li.appendChild(el('p', { cls: 'ttd-msg err', role: 'status', text: T.err })); return; }
          ev('label_break_toggle');
          if (window.__ttStatsRefresh) window.__ttStatsRefresh();
          render(false);
          var f = body.querySelector('.ttd-tog'); if (f) f.focus();
        });
        li.appendChild(t);
      }
      ul.appendChild(li);
    });
    return ul;
  }
  async function saveBreak(label, v) {
    var sb = S.sb;
    var r = await sb.from('settings').select('data').eq('product', PRODUCT).maybeSingle();
    if (r.error) return false;
    var data = (r.data && r.data.data && typeof r.data.data === 'object') ? r.data.data : {};
    var b = (data.breaks && typeof data.breaks === 'object') ? data.breaks : {};
    b[label] = v;
    var keys = Object.keys(b); if (keys.length > 200) delete b[keys[0]];
    data.breaks = b;
    var w = await sb.from('settings').upsert({ product: PRODUCT, data: data }, { onConflict: 'user_id,product' });
    if (w.error) return false;
    S.data.breaks = b;
    S.dd = null;
    return true;
  }

  function details(C, D) {
    var sec = el('section', { cls: 'ttd-sec' });
    sec.appendChild(el('h3', { text: T.detail }));
    var rows = C.rows.slice().sort(function (a, b) { return b.t - a.t; });
    var ul = el('ul', { cls: 'ttd-log' });
    rows.slice(0, S.more).forEach(function (e) {
      var name = e.timerName || T.pjOther;
      var pj = e.pj !== '__other' && e.pj !== '__none' ? D.pjNames[e.pj] : '';
      ul.appendChild(el('li', null, [
        el('span', { cls: 'ttd-log-t', text: T.timeFmt(e.t) }),
        el('span', { cls: 'ttd-log-n', text: name + (pj ? '（' + pj + '）' : '') }),
        el('span', { cls: 'ttd-log-v', text: T.dur(e.work) + (e.brk ? ' + ' + T.brk + ' ' + T.dur(e.brk) : '') + (e.done ? ' ✓' : '') })
      ]));
    });
    sec.appendChild(ul);
    if (rows.length > S.more) {
      var m = el('button', { type: 'button', cls: 'ttd-more', text: T.more + '（' + (rows.length - S.more) + '）' });
      m.addEventListener('click', function () { ev('data_more'); S.more += 20; var n = details(C, D); sec.replaceWith(n); var b = n.querySelector('.ttd-log li:nth-child(' + (S.more - 19) + ')'); if (b) b.scrollIntoView({ block: 'nearest' }); });
      sec.appendChild(m);
    }
    return sec;
  }

  /* ---------- CSV（プレミアム） ---------- */
  function cell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // 表計算ソフトで式として動かないように
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function saveCsv() {
    var D = S.data, F = S.filter;
    var lines = [T.csvHead.map(cell).join(',')];
    D.list.filter(function (e) { return F === 'all' || e.pj === F; }).forEach(function (e) {
      var date = e.t.getFullYear() + '-' + pad(e.t.getMonth() + 1) + '-' + pad(e.t.getDate());
      var time = pad(e.t.getHours()) + ':' + pad(e.t.getMinutes());
      var pj = e.pj === '__other' ? '' : e.pj === '__none' ? '' : D.pjNames[e.pj];
      e.parts.forEach(function (p) {
        lines.push([date, time, e.timerName || '', pj || '', p.label === '\u0000' ? '' : p.label, Math.round(p.secs), (p.secs / 60).toFixed(1), isBreak(D, p.label) ? T.yes : T.no].map(cell).join(','));
      });
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    var d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = (window.DT ? 'donuttimer' : 'timertrain') + '-data-' + S.period + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    ev('data_csv', { period: S.period, rows: lines.length - 1 });
  }

  /* ---------- ログイン前: 見本＋案内 ---------- */
  function sampleData() {
    var P = [{ id: 'p1', name: lang === 'ja' ? '📚 勉強' : lang === 'es' ? '📚 Estudio' : '📚 Study', sort: 0 }, { id: 'p2', name: lang === 'ja' ? '💪 筋トレ' : lang === 'es' ? '💪 Fuerza' : '💪 Workout', sort: 1 }];
    var L = lang === 'ja' ? ['国語', '数学', '社会', '休憩', 'スクワット'] : lang === 'es' ? ['Lengua', 'Mates', 'Historia', 'Descanso', 'Sentadillas'] : ['Reading', 'Math', 'History', 'Break', 'Squats'];
    var tm = { t1: { id: 't1', name: lang === 'ja' ? '平日' : lang === 'es' ? 'Entre semana' : 'Weekdays', project_id: 'p1' }, t2: { id: 't2', name: lang === 'ja' ? '朝トレ' : lang === 'es' ? 'Mañana' : 'Morning', project_id: 'p2' } };
    var mins = [[50, 25, 0, 10], [25, 50, 25, 10], [0, 0, 0, 0], [50, 25, 25, 15], [25, 25, 0, 10], [75, 50, 25, 20], [50, 25, 0, 10]];
    var list = [], d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - 6);
    mins.forEach(function (m, i) {
      if (!m[0] && !m[1]) return;
      var t = new Date(d0); t.setDate(d0.getDate() + i); t.setHours(19, 30);
      list.push({ id: 's' + i, t: t, timerId: 't1', timerName: tm.t1.name, pj: 'p1', done: true, parts: [{ label: L[0], secs: m[0] * 60 }, { label: L[3], secs: m[3] * 60 }, { label: L[1], secs: m[1] * 60 }, { label: L[2], secs: m[2] * 60 }].filter(function (p) { return p.secs; }) });
      if (i % 2 === 0) { var t2 = new Date(t); t2.setHours(7, 0); list.push({ id: 'w' + i, t: t2, timerId: 't2', timerName: tm.t2.name, pj: 'p2', done: true, parts: [{ label: L[4], secs: 900 }] }); }
    });
    var pjNames = { p1: P[0].name, p2: P[1].name, __none: T.pjNone, __other: T.pjOther };
    return { at: Date.now(), list: list, projects: P, pjNames: pjNames, tmap: tm, breaks: {}, start: d0 };
  }
  function renderOut(again) {
    S.period = '7d'; S.filter = 'all'; S.more = 5; S.sel = -1;
    var keep = S.data, keepSb = S.sb;
    S.data = sampleData(); S.sb = null;
    render(true);
    S.data = keep; S.sb = keepSb;
    var main = body.querySelector('.ttd-main');
    if (main) { main.classList.add('ttd-sample'); main.setAttribute('aria-hidden', 'true'); main.setAttribute('inert', ''); }
    var a = el('a', { cls: 'ttd-btn', href: ACCT, text: again ? T.reBtn : T.outBtn });
    a.addEventListener('click', function () { ev('data_login_cta', { again: again ? 1 : 0 }); });
    var card = el('div', { cls: 'ttd-out' }, [
      el('span', { cls: 'ttd-badge', text: T.sample }),
      el('p', { cls: 'ttd-out-t', text: T.outTitle }), el('p', { cls: 'ttd-out-l', text: T.outLead }), a
    ]);
    body.insertBefore(card, body.firstChild);
  }

  window.__ttData = { open: open, close: close };
})();
