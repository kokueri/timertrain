'use strict';
/* TimerTrain データの窓（ヘッダーの「データ」・ホームの ⏱📅🔥 を押したときだけ読み込む）
 * - ログイン前: 見本をぼかして表示し、ログインの案内
 * - ログイン中: sync.js と同じ接続（window.__ttSb）で、本人の記録だけを読む（RLS）
 * - 無料は直近7日。30日・12か月・全期間・CSV はプレミアム
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
      work: '作業の時間', workSub: '休憩を除く', days: '使った日数', runs: '回数', streak: '連続',
      daysV: function (n, of) { return of ? n + ' / ' + of + '日' : n + '日'; }, runsV: function (n) { return n + '回'; }, streakV: function (n) { return '🔥 ' + n + '日'; },
      chart: function (p) { return p === '12m' || p === 'all' ? '月ごとの作業の時間' : '日ごとの作業の時間'; },
      byPj: 'プロジェクトごと', byLabel: 'ラベル（区切りの名前）ごと', byTimer: 'マイタイマーごと', detail: 'くわしい記録',
      noSeg: '区切りの記録なし', noLabel: '名前なし', other: 'その他', brk: '休憩', brkNote: '休憩は作業の時間に入れません。',
      toBreak: '休憩にする', toWork: '作業に戻す', more: 'もっと見る', done: '完了', total: '合計',
      empty: 'この期間の記録はまだありません。ログインした状態でタイマーを15秒以上動かすと、ここに記録されます。',
      lockTitle: '30日・12か月・全期間のデータとCSVはプレミアム',
      lockLead: BILLING_ON ? '無料プランは直近7日間を見られます。それより前の記録も残っているので、プレミアムにするとすぐに見られます。' : '無料プランは直近7日間を見られます。それより前の記録も残っています（プレミアムは準備中です）。',
      plans: 'プランを見る', csv: 'CSVで保存', csvLock: 'CSVで保存（プレミアム）',
      outTitle: 'ログインすると、あなたのデータが見られます',
      outLead: '無料ログインで、直近7日間の作業の時間・使った日数・連続日数と、プロジェクトやラベルごとのグラフが見られます。',
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
      work: 'Work time', workSub: 'excluding breaks', days: 'Days used', runs: 'Sessions', streak: 'Streak',
      daysV: function (n, of) { return of ? n + ' / ' + of : String(n); }, runsV: function (n) { return String(n); }, streakV: function (n) { return '🔥 ' + n; },
      chart: function (p) { return p === '12m' || p === 'all' ? 'Work time per month' : 'Work time per day'; },
      byPj: 'By project', byLabel: 'By label (segment name)', byTimer: 'By saved timer', detail: 'Sessions',
      noSeg: 'No segment record', noLabel: 'No name', other: 'Other', brk: 'Breaks', brkNote: 'Breaks are not counted as work time.',
      toBreak: 'Mark as break', toWork: 'Count as work', more: 'Show more', done: 'Done', total: 'Total',
      empty: 'No records in this period yet. Run a timer for 15 seconds or more while signed in and it will show up here.',
      lockTitle: '30 days, 12 months, all time and CSV are Premium',
      lockLead: BILLING_ON ? 'The free plan shows the last 7 days. Older records are kept, so they appear as soon as you upgrade.' : 'The free plan shows the last 7 days. Older records are kept (Premium is coming soon).',
      plans: 'See plans', csv: 'Save as CSV', csvLock: 'Save as CSV (Premium)',
      outTitle: 'Sign in to see your data',
      outLead: 'With a free account you can see the last 7 days: work time, days used, your streak, and charts by project and label.',
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
      work: 'Tiempo de trabajo', workSub: 'sin descansos', days: 'Días de uso', runs: 'Sesiones', streak: 'Racha',
      daysV: function (n, of) { return of ? n + ' / ' + of : String(n); }, runsV: function (n) { return String(n); }, streakV: function (n) { return '🔥 ' + n; },
      chart: function (p) { return p === '12m' || p === 'all' ? 'Tiempo de trabajo por mes' : 'Tiempo de trabajo por día'; },
      byPj: 'Por proyecto', byLabel: 'Por etiqueta (nombre del tramo)', byTimer: 'Por temporizador guardado', detail: 'Sesiones',
      noSeg: 'Sin registro de tramos', noLabel: 'Sin nombre', other: 'Otros', brk: 'Descansos', brkNote: 'Los descansos no cuentan como trabajo.',
      toBreak: 'Marcar como descanso', toWork: 'Contar como trabajo', more: 'Ver más', done: 'Completado', total: 'Total',
      empty: 'Aún no hay registros en este periodo. Usa un temporizador 15 segundos o más con la sesión iniciada y aparecerá aquí.',
      lockTitle: '30 días, 12 meses, todo y CSV son Premium',
      lockLead: BILLING_ON ? 'El plan gratis muestra los últimos 7 días. Los registros anteriores se guardan y aparecen al pasar a Premium.' : 'El plan gratis muestra los últimos 7 días. Los registros anteriores se guardan (Premium llegará pronto).',
      plans: 'Ver planes', csv: 'Guardar como CSV', csvLock: 'Guardar como CSV (Premium)',
      outTitle: 'Inicia sesión para ver tus datos',
      outLead: 'Con una cuenta gratis ves los últimos 7 días: tiempo de trabajo, días de uso, tu racha y gráficos por proyecto y etiqueta.',
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
  var FREE_DAYS = 7;
  var TD = {
    ja: {
      views: [['day', '1日'], ['period', '期間']], today: '今日', yday: '昨日', prev: '前の日', next: '次の日',
      total: '休憩をのぞく合計', flow: '1日の流れ', now: 'いま', other: 'ほか', brk: '休憩',
      empty: 'この日の記録はありません。', emptyToday: 'まだ今日の記録はありません。ログインした状態でタイマーを15秒以上動かすと、ここに残ります。',
      lockT: 'それより前の日はプレミアム',
      lockL: function (n) { return '無料プランは直近' + n + '日間の1日の流れを見られます。それより前の記録も残っているので、プレミアムにするとすぐに見られます。'; },
      note: function (n) { return '無料プランは直近' + n + '日間を見られます。'; },
      hours: ['0時', '6時', '12時', '18時', '24時'],
      date: function (d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + '日月火水木金土'.charAt(d.getDay()) + '）'; }
    },
    en: {
      views: [['day', 'Day'], ['period', 'Period']], today: 'Today', yday: 'Yesterday', prev: 'Previous day', next: 'Next day',
      total: 'Total, excluding breaks', flow: 'Your day', now: 'Now', other: 'Others', brk: 'Break',
      empty: 'No records on this day.', emptyToday: 'No record yet today. Run a timer for 15 seconds or more while signed in and it shows up here.',
      lockT: 'Earlier days are Premium',
      lockL: function (n) { return 'The free plan shows your day for the last ' + n + ' days. Older records are kept, so they appear as soon as you upgrade.'; },
      note: function (n) { return 'The free plan shows the last ' + n + ' days.'; },
      hours: ['0', '6', '12', '18', '24'],
      date: function (d) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate(); }
    },
    es: {
      views: [['day', 'Día'], ['period', 'Periodo']], today: 'Hoy', yday: 'Ayer', prev: 'Día anterior', next: 'Día siguiente',
      total: 'Total sin descansos', flow: 'Tu día', now: 'Ahora', other: 'Otros', brk: 'Descanso',
      empty: 'No hay registros este día.', emptyToday: 'Aún no hay registros hoy. Usa un temporizador 15 segundos o más con la sesión iniciada y aparecerá aquí.',
      lockT: 'Los días anteriores son Premium',
      lockL: function (n) { return 'El plan gratis muestra tu día de los últimos ' + n + ' días. Los registros anteriores se guardan y aparecen en cuanto te pasas a Premium.'; },
      note: function (n) { return 'El plan gratis muestra los últimos ' + n + ' días.'; },
      hours: ['0', '6', '12', '18', '24'],
      date: function (d) { return ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()] + ' ' + d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]; }
    }
  }[lang];
  function pad(n) { return (n < 10 ? '0' : '') + n; }

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
  var S = { period: '7d', filter: 'all', data: null, loadedFor: null, more: 10, sel: -1 };
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
    if (!window.__ttPremium && S.period !== '7d') S.period = '7d';
    if (S.view === 'day') ev('day_view', { from: S.from, member: member() });
    await show();
  }
  /* いまの表示（1日／期間）を読み込んで描く */
  async function show() {
    try {
      if (S.view === 'day') await loadDay(S.sb); else await load(S.sb);
    } catch (e) { body.textContent = ''; body.appendChild(el('p', { cls: 'ttd-msg err', role: 'status', text: T.err })); return; }
    if (S.view === 'day') renderDay(); else render(false);
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
      var parts = g.length ? g.map(function (x) { return { label: String(x.label || ''), secs: Math.max(0, Number(x.secs) || 0), seg: true }; })
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
    var mode = (F === 'all' && D.projects.length) ? 'pj' : 'label';
    var rows = D.list.filter(function (e) { return F === 'all' || e.pj === F; });
    var B = buckets(D);
    B.forEach(function (b) { b.v = {}; b.total = 0; });
    var tot = {}, labels = {}, brkL = {}, timers = {}, work = 0, brk = 0, days = {};
    rows.forEach(function (e) {
      var i = idxOf(B, e.t);
      days[dayKey(e.t)] = 1;
      e.work = 0; e.brk = 0;
      e.parts.forEach(function (p) {
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
    shown.forEach(function (s) { if (s.gray || s.k === '\u0000' || s.k === '__other') s.cls = 'g'; else s.cls = 's' + (++slot); });
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
    if (C.mode === 'pj') wrap.appendChild(table(T.byPj, C.series.map(function (s) { return { name: s.name, cls: s.cls, secs: C.tot[s.k] }; }), C.work));
    var lrows = Object.keys(C.labels).sort(function (a, b) { return C.labels[b] - C.labels[a]; });
    var lsec = table(T.byLabel, lrows.map(function (l) {
      var s = C.mode === 'label' ? C.series.filter(function (x) { return x.k === l; })[0] : null;
      return { name: l === '\u0000' ? T.noSeg : (l || T.noLabel), cls: s ? s.cls : (C.mode === 'label' ? 'g' : ''), secs: C.labels[l], label: l, brk: false };
    }), C.work, sample);
    var bl = Object.keys(C.brkL).sort(function (a, b) { return C.brkL[b] - C.brkL[a]; });
    if (bl.length) {
      lsec.appendChild(el('p', { cls: 'ttd-sub', text: T.brk + ' ' + T.dur(C.brk) + '　' + T.brkNote }));
      lsec.appendChild(tableRows(bl.map(function (l) { return { name: l || T.noLabel, secs: C.brkL[l], label: l, brk: true }; }), 0, sample));
    }
    wrap.appendChild(lsec);
    var tids = Object.keys(C.timers).filter(function (id) { return D.tmap[id] && C.timers[id] > 0; }).sort(function (a, b) { return C.timers[b] - C.timers[a]; });
    if (tids.length) wrap.appendChild(table(T.byTimer, tids.map(function (id) { return { name: D.tmap[id].name || '', secs: C.timers[id], sub: D.pjNames[D.tmap[id].project_id] || '' }; }), C.work));
    wrap.appendChild(details(C, D));
  }

  function controls(D) {
    var bar = el('div', { cls: 'ttd-ctl' });
    var tabs = el('div', { cls: 'ttd-tabs', role: 'group', 'aria-label': T.title });
    var prem = !!window.__ttPremium;
    T.periods.forEach(function (p) {
      var locked = !prem && p[0] !== '7d';
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
    var csv = el('button', { type: 'button', cls: 'ttd-csv' + (prem ? '' : ' lock'), text: prem ? T.csv : '🔒 ' + T.csvLock });
    csv.addEventListener('click', function () { if (!prem) { showLock(); ev('data_locked', { period: 'csv' }); return; } saveCsv(); });
    right.appendChild(csv);
    bar.appendChild(right);
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
    var r = await sb.from('usage_logs').select('id,started_at,total_secs,timer_id,completed,config').eq('product', PRODUCT)
      .gte('started_at', d0.toISOString()).lt('started_at', d1.toISOString()).order('started_at', { ascending: true }).limit(1000);
    if (r.error) throw r.error;
    var logs = r.data || [], segs = [];
    for (var i = 0; i < logs.length; i += 100) {
      var ids = logs.slice(i, i + 100).map(function (l) { return l.id; });
      var rs = await sb.from('usage_segments').select('log_id,seq,label,secs,started_at').eq('product', PRODUCT).in('log_id', ids).limit(5000);
      if (rs.error) throw rs.error;
      segs = segs.concat(rs.data || []);
    }
    if (!S.meta || Date.now() - S.meta.at > 60000) {
      var rt = await sb.from('timers').select('id,name,project_id').eq('product', PRODUCT).limit(1000);
      var rp = await sb.from('projects').select('id,name,sort,created_at').eq('product', PRODUCT).order('sort').order('created_at').limit(100);
      var rset = await sb.from('settings').select('data').eq('product', PRODUCT).maybeSingle();
      var sd = (!rset.error && rset.data && rset.data.data) || {};
      S.meta = { at: Date.now(), timers: rt.error ? [] : rt.data || [], projects: rp.error ? [] : rp.data || [], breaks: (sd.breaks && typeof sd.breaks === 'object') ? sd.breaks : {} };
    }
    if (S.data) S.meta.breaks = S.data.breaks; // データの窓で切り替えた休憩を反映
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
        return { label: String(x.label || '').slice(0, 30), secs: secs, s: s };
      });
      else parts = [{ label: '', secs: Math.max(0, Number(l.total_secs) || 0), s: at }];
      list.push({ t: t, timerName: tm ? (tm.name || '') : (typeof cfg.name === 'string' ? cfg.name.slice(0, 40) : ''),
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
    // ラベルごとの作業時間 → 多い順に色（ホームのカードと同じ順番）。8つ目以降は「ほか」
    var tot = {}, work = 0;
    D.list.forEach(function (e) { e.work = 0; e.brk = 0; e.parts.forEach(function (p) { if (isBreak(D, p.label)) { e.brk += p.secs; return; } e.work += p.secs; work += p.secs; tot[p.label] = (tot[p.label] || 0) + p.secs; }); });
    var keys = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
    var cls = {}; keys.forEach(function (k, i) { cls[k] = i < 7 ? 's' + (i + 1) : 'g'; });
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
      D.list.forEach(function (e) {
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
        ul.appendChild(el('li', null, [
          el('span', { cls: 'ttd-flow-t', text: e.t.getHours() + ':' + pad(e.t.getMinutes()) }),
          el('span', { cls: 'ttd-flow-c ' + clsOf(main), 'aria-hidden': 'true' }),
          el('span', { cls: 'ttd-flow-b' }, [el('span', { cls: 'ttd-flow-n', text: title }), el('span', { cls: 'ttd-flow-p', text: desc })]),
          el('span', { cls: 'ttd-flow-v', text: T.dur(e.work) + (e.done ? ' ✓' : '') })
        ]));
      });
      if (isToday) {
        var t = new Date();
        ul.appendChild(el('li', { cls: 'now' }, [el('span', { cls: 'ttd-flow-t', text: t.getHours() + ':' + pad(t.getMinutes()) }), el('span', { cls: 'ttd-flow-dot', 'aria-hidden': 'true' }), el('span', { cls: 'ttd-flow-n', text: TD.now })]));
      }
      flow.appendChild(ul);
      wrap.appendChild(flow);
    }
    if (!prem) wrap.appendChild(el('p', { cls: 'ttd-hint', text: TD.note(FREE_DAYS) }));
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
