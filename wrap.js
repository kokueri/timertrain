'use strict';
/* TimerTrain / DonutTimer 1年のふりかえりカード（2026-11-23）
 * - ホームのボタン・#wrap から開く（押したときだけ読み込む）
 * - ログイン前: 見本のカード＋無料ログインの案内（記録は何も読まない）
 * - 無料: 「まとめ」カード1枚（1年分の合計など）を画像で保存・シェアできる
 * - プレミアム: 「1年カレンダー」「ラベルと時間帯」のカードとデザイン3種
 * - 記録は sync.js と同じ接続（window.__ttSb、RLS で本人の分だけ）。外へは何も送らない
 * - 名前は canvas の fillText と textContent でだけ表示する（HTMLとして扱わない）
 */
(function () {
  if (window.__ttWrap) return;
  var lang = document.documentElement.lang;
  if (['ja', 'en', 'es'].indexOf(lang) < 0) lang = 'ja';
  var DT = !!window.DT;
  var PRODUCT = 'timertrain';
  var PRICING = ({ ja: '/pricing', en: '/en-pricing', es: '/es-pricing' })[lang] + '#buy';
  var ACCT = '/account?l=' + lang + (DT ? '&from=donut' : '');
  var SITE = DT ? 'timertrain.com/donut' : 'timertrain.com';
  var SHARE_URL = 'https://timertrain.com' + (DT ? '/donut/' + (lang === 'ja' ? '' : lang) : '/' + (lang === 'ja' ? '' : lang));
  var BREAK_RE = /休憩|きゅうけい|やすみ|break|rest|descanso|pausa|recreo/i;
  function ev(name, p) { try { if (window.gtag) gtag('event', name, p || {}); } catch (e) {} }
  function signed() { try { return !!localStorage.getItem('sb-arsfocfjfwtlykfdkiea-auth-token'); } catch (e) { return false; } }
  function now() { return new Date(); }
  // 12月はその年、1月は前の年をふりかえる
  function wrapYear() { var d = now(); return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(); }

  /* ---------- 文言 ---------- */
  var T = ({
    ja: {
      title: function (y) { return y + '年のふりかえり'; },
      close: '閉じる', loading: '1年分の記録を集めています…', err: '読み込めませんでした。少し待ってからもう一度開いてください。',
      empty: function (y) { return y + '年の記録がまだありません。タイマーを使うと、ここに1年のまとめができます。'; },
      pages: ['まとめ', '1年カレンダー', 'ラベルと時間帯'],
      designs: ['クリーム', 'ナイト', 'ソーダ'], design: 'デザイン',
      showLabels: 'ラベル名を入れる', share: 'シェア', save: '画像を保存', saved: '画像を保存しました',
      lockT: 'プレミアムのカード', lockL: '1年カレンダーと、ラベル・時間帯のカード、デザインの切り替えはプレミアムで使えます。記録はそのまま保存されているので、申し込むとすぐに作れます。',
      lockBtn: 'プレミアムを7日間無料で試す', designLock: 'デザインの切り替えはプレミアム',
      sample: '見本', outT: '無料ログインで、あなたの1年のカードが作れます',
      outL: 'タイマーを使った時間が自動で記録され、年末にこんなカードになります。',
      outBtn: '無料でログインする', note: '画像は自分の端末で作っています。記録が外に送られることはありません。',
      shareText: function (y) { return y + '年の集中ふりかえり ' + (DT ? '#DonutTimer' : '#TimerTrain'); },
      // カードの中
      cHead: function (y) { return y + ' MY YEAR'; }, cTitle: 'わたしの集中の1年',
      hours: function (h, m) { return h >= 1 ? [String(h), '時間'] : [String(m), '分']; },
      daysL: '記録した日', daysV: function (n) { return n + '日'; },
      streakL: 'いちばん長い連続', streakV: function (n) { return n + '日'; },
      unitL: DT ? 'ドーナツ換算' : 'ポモドーロ換算', unitV: function (n) { return (DT ? '🍩 ' : '🍅 ') + n.toLocaleString('ja-JP') + (DT ? '個' : '回'); },
      unitNote: '（25分で1つ）',
      types: [['☀️', '朝活タイプ'], ['📚', '午前の集中タイプ'], ['☕', '午後のコツコツタイプ'], ['🌙', '夜の集中タイプ'], ['🦉', '深夜のひらめきタイプ']],
      peak: function (h) { return h + '時台がいちばん集中'; },
      bestM: function (m) { return (m + 1) + '月がいちばん'; },
      monthsL: '月ごとの時間', mon: function (m) { return String(m + 1); },
      topL: 'よく使ったラベル', calL: '毎日の記録', calSub: function (n) { return n + '日記録しました'; },
      hourL: '時間帯（1日のどこで集中したか）', labL: 'ラベル別の時間', bestD: function (d, s) { return 'いちばん集中した日　' + (d.getMonth() + 1) + '/' + d.getDate() + '（' + s + '）'; },
      less: '少ない', more: '多い', other: 'ほか', noLabel: 'ラベルなし',
      dur: function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + '時間' + (m % 60 ? (m % 60) + '分' : '') : m + '分'; },
      wk: ['日', '月', '火', '水', '木', '金', '土']
    },
    en: {
      title: function (y) { return 'Your ' + y + ' in review'; },
      close: 'Close', loading: 'Gathering your year…', err: 'Could not load. Please wait a moment and open it again.',
      empty: function (y) { return 'No records for ' + y + ' yet. Use the timer and your year card will appear here.'; },
      pages: ['Summary', 'Year calendar', 'Labels & hours'],
      designs: ['Cream', 'Night', 'Soda'], design: 'Design',
      showLabels: 'Show label names', share: 'Share', save: 'Save image', saved: 'Image saved',
      lockT: 'Premium cards', lockL: 'The year calendar card, the labels & hours card and extra designs are part of Premium. Your records are already saved, so you can make them right after you subscribe.',
      lockBtn: 'Try Premium free for 7 days', designLock: 'Designs are a Premium feature',
      sample: 'Example', outT: 'Sign in free to make your own year card',
      outL: 'Your timer time is logged automatically and becomes a card like this at the end of the year.',
      outBtn: 'Sign in free', note: 'The image is made on your device. Your records are never sent anywhere.',
      shareText: function (y) { return 'My ' + y + ' focus year ' + (DT ? '#DonutTimer' : '#TimerTrain'); },
      cHead: function (y) { return y + ' MY YEAR'; }, cTitle: 'My year of focus',
      hours: function (h, m) { return h >= 1 ? [h.toLocaleString('en-US'), 'hours'] : [String(m), 'min']; },
      daysL: 'Days logged', daysV: function (n) { return n + ' days'; },
      streakL: 'Longest streak', streakV: function (n) { return n + ' days'; },
      unitL: DT ? 'In donuts' : 'In pomodoros', unitV: function (n) { return (DT ? '🍩 ' : '🍅 ') + n.toLocaleString('en-US'); },
      unitNote: '(25 min each)',
      types: [['☀️', 'Early bird'], ['📚', 'Morning focuser'], ['☕', 'Steady afternoon worker'], ['🌙', 'Evening focuser'], ['🦉', 'Night owl']],
      peak: function (h) { return 'Most focused at ' + (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); },
      bestM: function (m) { return 'Best month: ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]; },
      monthsL: 'Time by month', mon: function (m) { return 'JFMAMJJASOND'[m]; },
      topL: 'Top labels', calL: 'Every day of the year', calSub: function (n) { return n + ' days logged'; },
      hourL: 'Time of day you focused', labL: 'Time by label', bestD: function (d, s) { return 'Best day  ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate() + ' (' + s + ')'; },
      less: 'Less', more: 'More', other: 'Others', noLabel: 'No label',
      dur: function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + 'm'; },
      wk: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    },
    es: {
      title: function (y) { return 'Tu ' + y + ' en resumen'; },
      close: 'Cerrar', loading: 'Reuniendo tu año…', err: 'No se pudo cargar. Espera un momento y vuelve a abrirlo.',
      empty: function (y) { return 'Aún no hay registros de ' + y + '. Usa el temporizador y aquí aparecerá tu tarjeta del año.'; },
      pages: ['Resumen', 'Calendario anual', 'Etiquetas y horas'],
      designs: ['Crema', 'Noche', 'Soda'], design: 'Diseño',
      showLabels: 'Mostrar etiquetas', share: 'Compartir', save: 'Guardar imagen', saved: 'Imagen guardada',
      lockT: 'Tarjetas Premium', lockL: 'La tarjeta del calendario anual, la de etiquetas y horas y los diseños extra son parte de Premium. Tus registros ya están guardados, así que puedes crearlas en cuanto te suscribas.',
      lockBtn: 'Prueba Premium gratis 7 días', designLock: 'Los diseños son de Premium',
      sample: 'Ejemplo', outT: 'Inicia sesión gratis para crear tu tarjeta del año',
      outL: 'El tiempo del temporizador se registra solo y al final del año se convierte en una tarjeta como esta.',
      outBtn: 'Iniciar sesión gratis', note: 'La imagen se crea en tu dispositivo. Tus registros nunca se envían a ningún sitio.',
      shareText: function (y) { return 'Mi año de concentración ' + y + ' ' + (DT ? '#DonutTimer' : '#TimerTrain'); },
      cHead: function (y) { return y + ' MI AÑO'; }, cTitle: 'Mi año de concentración',
      hours: function (h, m) { return h >= 1 ? [h.toLocaleString('es-ES'), 'horas'] : [String(m), 'min']; },
      daysL: 'Días registrados', daysV: function (n) { return n + ' días'; },
      streakL: 'Racha más larga', streakV: function (n) { return n + ' días'; },
      unitL: DT ? 'En donas' : 'En pomodoros', unitV: function (n) { return (DT ? '🍩 ' : '🍅 ') + n.toLocaleString('es-ES'); },
      unitNote: '(25 min cada uno)',
      types: [['☀️', 'Madrugador'], ['📚', 'Concentración matutina'], ['☕', 'Constante por la tarde'], ['🌙', 'Concentración nocturna'], ['🦉', 'Búho nocturno']],
      peak: function (h) { return 'Más concentración a las ' + h + ' h'; },
      bestM: function (m) { return 'Mejor mes: ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m]; },
      monthsL: 'Tiempo por mes', mon: function (m) { return 'EFMAMJJASOND'[m]; },
      topL: 'Etiquetas principales', calL: 'Cada día del año', calSub: function (n) { return n + ' días registrados'; },
      hourL: 'Hora del día en que te concentraste', labL: 'Tiempo por etiqueta', bestD: function (d, s) { return 'Mejor día  ' + d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()] + ' (' + s + ')'; },
      less: 'Menos', more: 'Más', other: 'Otras', noLabel: 'Sin etiqueta',
      dur: function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; },
      wk: ['D', 'L', 'M', 'X', 'J', 'V', 'S']
    }
  })[lang];

  /* ---------- デザイン（カードの色。画面のテーマとは別） ---------- */
  var THEMES = DT ? [
    { bg: '#FDE7EE', bg2: '#FFF6F0', card: '#FFFFFF', text: '#5A3A2A', sub: '#8A6A5A', acc: '#C03868', bar: '#E58FAE', h: ['#F6DCE2', '#F7B9CC', '#EE8DAE', '#D9628C', '#B03E69'] },
    { bg: '#2B1D24', bg2: '#3A2830', card: '#40303A', text: '#FFF1F4', sub: '#D9BFC8', acc: '#FF8FB6', bar: '#FF8FB6', h: ['#4A3842', '#7A4A5E', '#B05A7D', '#E0709C', '#FF9EC0'] },
    { bg: '#D9F2E6', bg2: '#F3FFF8', card: '#FFFFFF', text: '#24433A', sub: '#5E7F74', acc: '#1F8A5F', bar: '#7FCBA5', h: ['#E2F2EA', '#B5E3CB', '#7FCBA5', '#43A87C', '#1F7E56'] }
  ] : [
    { bg: '#FFF9EE', bg2: '#FFFFFF', card: '#FFFFFF', text: '#1C1C1E', sub: '#6B6B70', acc: '#D04A0A', bar: '#2A6FC4', h: ['#EFE8DA', '#C6DAF1', '#8DB6E6', '#4D86CF', '#1E5AA8'] },
    { bg: '#111113', bg2: '#1C1C1E', card: '#232326', text: '#F2F2F7', sub: '#A1A1AA', acc: '#FF8A4C', bar: '#6EA8F0', h: ['#2A2A2E', '#25466E', '#2F6BB0', '#4F95E8', '#9CC8FF'] },
    { bg: '#DDF3F8', bg2: '#F5FDFF', card: '#FFFFFF', text: '#173A47', sub: '#56737E', acc: '#0E7FA0', bar: '#3FA9C8', h: ['#E4F2F5', '#B6E2EE', '#7CCADF', '#3AA6C6', '#167C9C'] }
  ];

  /* ---------- 見本のデータ（ログイン前。固定の例） ---------- */
  function sample(y) {
    var days = {}, d = new Date(y, 0, 1), i = 0, seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (; d.getFullYear() === y && i < 400; d = new Date(y, d.getMonth(), d.getDate() + 1), i++) {
      if (d > now()) break;
      var r = rnd(); if (r < 0.28) continue;
      days[key(d)] = Math.round((20 + rnd() * 160) * 60);
    }
    var hours = [0, 0, 0, 0, 0, 1, 3, 6, 5, 9, 12, 8, 4, 6, 10, 9, 6, 4, 5, 8, 14, 18, 11, 3].map(function (v) { return v * 3600; });
    var labs = ({ ja: ['勉強', '仕事', '読書', '家事', '運動'], en: ['Study', 'Work', 'Reading', 'Chores', 'Workout'], es: ['Estudio', 'Trabajo', 'Lectura', 'Tareas', 'Ejercicio'] })[lang];
    var C = ['#2A6FC4', '#C4521C', '#12825C', '#A86F00', '#B8457A'];
    return finish(y, days, hours, labs.map(function (n, i) { return { n: n, s: [180, 120, 60, 35, 20][i] * 3600, c: C[i] }; }), true);
  }

  /* ---------- 読み込み ---------- */
  function key(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  async function waitSb() {
    for (var i = 0; i < 80; i++) {
      if (window.__ttSb) return window.__ttSb;
      if (window.__ttSignedOut) return null;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    return window.__ttSb || null;
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
  async function load(sb, y) {
    var q0 = new Date(y, 0, 1), q1 = new Date(y + 1, 0, 1);
    var logs = await all(function (a, b) {
      return sb.from('usage_logs').select('id,started_at,total_secs').eq('product', PRODUCT).gte('started_at', q0.toISOString()).lt('started_at', q1.toISOString()).order('started_at', { ascending: true }).range(a, b);
    }, 30000);
    var segs = await all(function (a, b) {
      return sb.from('usage_segments').select('log_id,label,secs,started_at').eq('product', PRODUCT).gte('started_at', new Date(q0.getTime() - 86400000).toISOString()).lt('started_at', q1.toISOString()).order('started_at', { ascending: true }).range(a, b);
    }, 150000);
    var rs = await sb.from('settings').select('data').eq('product', PRODUCT).maybeSingle();
    var sd = (!rs.error && rs.data && rs.data.data) || {};
    var LM = (sd.labelMap && typeof sd.labelMap === 'object' && !Array.isArray(sd.labelMap)) ? sd.labelMap : {};
    var BR = (sd.breaks && typeof sd.breaks === 'object') ? sd.breaks : {};
    function alias(l) { l = String(l == null ? '' : l); for (var i = 0; i < 5 && Object.prototype.hasOwnProperty.call(LM, l) && typeof LM[l] === 'string'; i++) l = LM[l]; return l.slice(0, 30); }
    function isBrk(l) { if (!l) return false; if (Object.prototype.hasOwnProperty.call(BR, l)) return BR[l] === 1; return BREAK_RE.test(l); }
    var ids = {}, byLog = {};
    logs.forEach(function (l) { ids[l.id] = 1; });
    segs.forEach(function (g) { if (ids[g.log_id]) (byLog[g.log_id] = byLog[g.log_id] || []).push(g); });
    var days = {}, hours = [], labT = {};
    for (var h = 0; h < 24; h++) hours.push(0);
    function put(t, secs, lb) {
      if (isNaN(t) || t < q0 || t >= q1 || !(secs > 0) || secs > 86400) return;
      if (isBrk(lb)) return;
      days[key(t)] = (days[key(t)] || 0) + secs;
      hours[t.getHours()] += secs;
      labT[lb] = (labT[lb] || 0) + secs;
    }
    logs.forEach(function (l) {
      var g = byLog[l.id];
      if (g && g.length) g.forEach(function (x) {
        var ms = Date.parse(x.started_at); if (!isFinite(ms)) ms = Date.parse(l.started_at);
        put(new Date(ms), Number(x.secs) || 0, alias(x.label || ''));
      });
      else put(new Date(l.started_at), Number(l.total_secs) || 0, '');
    });
    var color = window.__ttLabelColor || function () { return '#2A6FC4'; };
    var labs = Object.keys(labT).sort(function (a, b) { return labT[b] - labT[a]; }).map(function (n) {
      return { n: n ? n.slice(0, 16) : T.noLabel, s: labT[n], c: n ? color(n) : '#8E8E93' };
    });
    return finish(y, days, hours, labs, false);
  }
  function finish(y, days, hours, labs, isSample) {
    var total = 0, nDays = 0, best = 0, run = 0, months = [], bestDay = null, bestDayS = 0, end = new Date(y, 11, 31);
    for (var m = 0; m < 12; m++) months.push(0);
    for (var d = new Date(y, 0, 1); d <= end; d = new Date(y, d.getMonth(), d.getDate() + 1)) {
      var v = days[key(d)] || 0;
      total += v; months[d.getMonth()] += v;
      if (v >= 60) { nDays++; run++; if (run > best) best = run; } else run = 0;
      if (v > bestDayS) { bestDayS = v; bestDay = new Date(d); }
    }
    // 時間帯: 2時間の幅でいちばん多いところ
    var pk = 0, pv = -1;
    for (var h = 0; h < 24; h++) { var s = hours[h] + hours[(h + 1) % 24]; if (s > pv) { pv = s; pk = h; } }
    var peakH = hours[pk] >= hours[(pk + 1) % 24] ? pk : (pk + 1) % 24;
    var type = peakH >= 5 && peakH < 9 ? 0 : peakH >= 9 && peakH < 12 ? 1 : peakH >= 12 && peakH < 17 ? 2 : peakH >= 17 && peakH < 23 ? 3 : 4;
    var bm = 0; months.forEach(function (v, i) { if (v > months[bm]) bm = i; });
    return { y: y, days: days, hours: hours, labs: labs, total: total, nDays: nDays, streak: best, months: months, bestM: bm, peakH: peakH, type: type, bestDay: bestDay, bestDayS: bestDayS, sample: isSample };
  }

  /* ---------- カードを描く（1080×1350） ---------- */
  var W = 1080, H = 1350;
  var FONT = DT ? "'M PLUS Rounded 1c', 'Nunito', -apple-system, 'Hiragino Sans', sans-serif" : "'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', 'Segoe UI', sans-serif";
  function f(px, w) { return (w || 700) + ' ' + px + 'px ' + FONT; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // 幅に収まるまで文字を小さくする
  function fit(c, text, x, y, maxW, px, w, align) {
    var p = px; c.font = f(p, w);
    while (p > 14 && c.measureText(text).width > maxW) { p -= 2; c.font = f(p, w); }
    c.textAlign = align || 'left'; c.fillText(text, x, y); return p;
  }
  function frame(c, th, St, title) {
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.bg); g.addColorStop(1, th.bg2);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // ドーナツ版は端に小さなスプリンクル、TimerTrain は線路のような点線
    if (DT) {
      var sp = ['#A5DDEB', '#F8DE7E', '#C6B0E8', '#F1A9BD', '#FFFFFF'], seed = 3;
      for (var i = 0; i < 26; i++) {
        seed = (seed * 9301 + 49297) % 233280; var a = seed / 233280; seed = (seed * 9301 + 49297) % 233280; var b = seed / 233280;
        var x = a * W, yy = b < 0.5 ? b * 110 + 14 : H - 34 + (b - 0.5) * 40;
        c.save(); c.translate(x, yy); c.rotate(a * 6.28); c.fillStyle = sp[i % sp.length]; rr(c, -14, -4, 28, 8, 4); c.fill(); c.restore();
      }
    } else {
      c.strokeStyle = th.sub; c.globalAlpha = 0.25; c.lineWidth = 4; c.setLineDash([22, 16]);
      c.beginPath(); c.moveTo(60, 1236); c.lineTo(W - 60, 1236); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    c.fillStyle = th.acc; c.textBaseline = 'alphabetic';
    fit(c, T.cHead(St.y), 72, 118, 600, 34, 800);
    c.fillStyle = th.text; fit(c, title, 72, 186, W - 144, 58, 800);
    // 下: サイト名
    c.fillStyle = th.text; c.font = f(34, 800); c.textAlign = 'left';
    c.fillText(DT ? 'DonutTimer' : 'TimerTrain', 72, 1296);
    c.fillStyle = th.sub; c.font = f(28, 700); c.textAlign = 'right';
    c.fillText(SITE, W - 72, 1296);
    if (St.sample) { // 見本のしるし
      c.save(); c.translate(W - 150, 120); c.rotate(0.18); c.fillStyle = th.acc; rr(c, -110, -36, 220, 72, 36); c.fill();
      c.fillStyle = '#FFFFFF'; c.font = f(36, 800); c.textAlign = 'center'; c.fillText(T.sample, 0, 13); c.restore();
    }
  }
  function tileBox(c, th, x, y, w, h, label, value, note) {
    c.fillStyle = th.card; rr(c, x, y, w, h, 28); c.fill();
    c.fillStyle = th.sub; fit(c, label, x + w / 2, y + 52, w - 32, 26, 700, 'center');
    c.fillStyle = th.text; fit(c, value, x + w / 2, y + 118, w - 32, 50, 800, 'center');
    if (note) { c.fillStyle = th.sub; fit(c, note, x + w / 2, y + 156, w - 32, 20, 700, 'center'); }
  }
  function monthBars(c, th, St, x, y, w, h, label) {
    c.fillStyle = th.sub; c.font = f(28, 700); c.textAlign = 'left'; c.fillText(label, x, y);
    var max = Math.max.apply(null, St.months) || 1, bw = w / 12, top = y + 24, bh = h - 70;
    for (var m = 0; m < 12; m++) {
      var v = St.months[m], hh = Math.max(v > 0 ? 8 : 4, Math.round(v / max * bh));
      c.fillStyle = m === St.bestM && v > 0 ? th.acc : th.bar; c.globalAlpha = v > 0 ? 1 : 0.25;
      rr(c, x + m * bw + bw * 0.18, top + bh - hh, bw * 0.64, hh, Math.min(10, hh / 2)); c.fill(); c.globalAlpha = 1;
      c.fillStyle = th.sub; c.font = f(24, 700); c.textAlign = 'center'; c.fillText(T.mon(m), x + m * bw + bw / 2, top + bh + 36);
    }
  }
  function drawSummary(c, th, St, showL) {
    frame(c, th, St, T.cTitle);
    var h = Math.floor(St.total / 3600), mm = Math.round(St.total / 60);
    var big = T.hours(h, mm);
    c.fillStyle = th.text; c.textAlign = 'left'; c.font = f(190, 800);
    var bw = c.measureText(big[0]).width;
    if (bw > 700) { c.font = f(150, 800); bw = c.measureText(big[0]).width; }
    c.fillText(big[0], 72, 410);
    c.fillStyle = th.sub; c.font = f(54, 800); c.fillText(big[1], 72 + bw + 18, 410);
    // タイプ
    var ty = T.types[St.type];
    c.fillStyle = th.card; rr(c, 72, 456, W - 144, 104, 52); c.fill();
    c.font = f(40, 800); var tw0 = Math.min(c.measureText(ty[0] + ' ' + ty[1]).width, W - 224);
    c.font = f(28, 700); var pw = c.measureText(T.peak(St.peakH)).width;
    if (tw0 + pw + 40 <= W - 224) { // 1行に並べる
      c.fillStyle = th.acc; fit(c, ty[0] + ' ' + ty[1], 112, 524, W - 224, 40, 800);
      c.fillStyle = th.sub; fit(c, T.peak(St.peakH), W - 112, 522, W - 224 - tw0 - 40, 28, 700, 'right');
    } else { // 長いときは2行
      c.fillStyle = th.acc; fit(c, ty[0] + ' ' + ty[1], 112, 504, W - 224, 36, 800);
      c.fillStyle = th.sub; fit(c, T.peak(St.peakH), 112, 543, W - 224, 24, 700);
    }
    // 3つの数字
    var tw = (W - 144 - 40) / 3;
    tileBox(c, th, 72, 596, tw, 176, T.daysL, T.daysV(St.nDays));
    tileBox(c, th, 72 + tw + 20, 596, tw, 176, T.streakL, T.streakV(St.streak));
    tileBox(c, th, 72 + (tw + 20) * 2, 596, tw, 176, T.unitL, T.unitV(Math.floor(St.total / 1500)), T.unitNote);
    // 月ごと
    var labs = (St.labs || []).filter(function (l) { return l.s >= 60; });
    if (showL && labs.length) {
      monthBars(c, th, St, 72, 836, 540, 330, T.monthsL);
      c.fillStyle = th.sub; c.font = f(28, 700); c.textAlign = 'left'; c.fillText(T.topL, 650, 836);
      labs.slice(0, 3).forEach(function (l, i) {
        var yy = 880 + i * 92;
        c.fillStyle = th.card; rr(c, 650, yy, W - 72 - 650, 76, 22); c.fill();
        c.fillStyle = l.c; c.beginPath(); c.arc(684, yy + 38, 12, 0, 6.29); c.fill();
        c.fillStyle = th.text; fit(c, l.n, 708, yy + 48, 150, 30, 800);
        c.fillStyle = th.sub; c.font = f(22, 700); c.textAlign = 'right'; c.fillText(T.dur(l.s).replace(/(\d+時間)\d+分$/, '$1'), W - 96, yy + 47);
      });
    } else monthBars(c, th, St, 72, 836, W - 144, 330, T.monthsL);
    c.fillStyle = th.sub; c.textAlign = 'left'; fit(c, T.bestM(St.bestM), 72, 1200, W - 144, 26, 700);
  }
  var MN = lang === 'ja' ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] : lang === 'es' ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function drawCalendar(c, th, St) {
    frame(c, th, St, T.calL);
    c.fillStyle = th.sub; fit(c, T.calSub(St.nDays) + '　·　' + T.dur(St.total), 72, 244, W - 144, 30, 700);
    // 12か月を 3列×4段（各月は週の行×7列の小さなマス）
    var cols = 3, cw = (W - 144 - 40) / cols, ch = 228, cell = 24, gap = 5;
    for (var m = 0; m < 12; m++) {
      var cx = 72 + (m % cols) * (cw + 20), cy = 290 + Math.floor(m / cols) * ch;
      c.fillStyle = th.card; rr(c, cx, cy, cw, ch - 18, 22); c.fill();
      c.fillStyle = th.text; c.font = f(24, 800); c.textAlign = 'left';
      c.fillText(MN[m], cx + 18, cy + 36);
      var gx = cx + (cw - (7 * cell + 6 * gap)) / 2, gy = cy + 50, first = new Date(St.y, m, 1).getDay(), nd = new Date(St.y, m + 1, 0).getDate();
      for (var dd = 1; dd <= nd; dd++) {
        var idx = first + dd - 1, r = Math.floor(idx / 7), col = idx % 7, secs = St.days[St.y + '-' + (m + 1) + '-' + dd] || 0;
        var lv = secs < 60 ? 0 : secs < 1800 ? 1 : secs < 3600 ? 2 : secs < 7200 ? 3 : 4;
        c.fillStyle = th.h[lv]; rr(c, gx + col * (cell + gap), gy + r * (cell + gap - 3), cell, cell - 2, 6); c.fill();
      }
    }
    // 凡例（右下）
    c.font = f(22, 700); var mw = c.measureText(T.more).width, lx = W - 72 - mw - 10 - 5 * 32;
    c.fillStyle = th.sub; c.textAlign = 'right'; c.fillText(T.less, lx - 10, 1222);
    for (var k = 0; k < 5; k++) { c.fillStyle = th.h[k]; rr(c, lx + k * 32, 1200, 26, 26, 6); c.fill(); }
    c.fillStyle = th.sub; c.textAlign = 'left'; c.fillText(T.more, lx + 5 * 32 + 4, 1222);
    if (St.bestDay && St.bestDayS >= 60) { c.fillStyle = th.text; fit(c, T.bestD(St.bestDay, T.dur(St.bestDayS)), 72, 1222, 600, 26, 800); }
  }
  function drawLabels(c, th, St, showL) {
    frame(c, th, St, T.labL);
    var labs = (St.labs || []).filter(function (l) { return l.s >= 60; });
    var top = labs.slice(0, 5), rest = labs.slice(5).reduce(function (a, l) { return a + l.s; }, 0);
    if (rest > 0) top.push({ n: T.other, s: rest, c: '#9A9AA0' });
    var tot = top.reduce(function (a, l) { return a + l.s; }, 0) || 1;
    // 左にドーナツ型の円グラフ
    var cx = 260, cy = 470, R = 170, a0 = -Math.PI / 2;
    top.forEach(function (l) {
      var a1 = a0 + l.s / tot * Math.PI * 2;
      c.beginPath(); c.arc(cx, cy, R, a0, a1); c.strokeStyle = l.c; c.lineWidth = 92; c.stroke(); a0 = a1;
    });
    if (!top.length) { c.beginPath(); c.arc(cx, cy, R, 0, 6.29); c.strokeStyle = th.h[0]; c.lineWidth = 92; c.stroke(); }
    c.fillStyle = th.text; fit(c, T.dur(St.total), cx, cy + 14, 220, 40, 800, 'center');
    top.forEach(function (l, i) {
      var yy = 290 + i * 66;
      c.fillStyle = l.c; c.beginPath(); c.arc(530, yy + 22, 13, 0, 6.29); c.fill();
      c.fillStyle = th.text; fit(c, showL || l.n === T.other ? l.n : '••••', 556, yy + 33, 270, 32, 800);
      c.fillStyle = th.sub; fit(c, Math.round(l.s / tot * 100) + '%', W - 72, yy + 33, 110, 28, 700, 'right');
    });
    // 時間帯（24本の棒）
    var x = 72, y = 760, w = W - 144, h = 360;
    c.fillStyle = th.card; rr(c, x, y, w, h + 60, 28); c.fill();
    c.fillStyle = th.sub; c.font = f(26, 700); c.textAlign = 'left'; c.fillText(T.hourL, x + 32, y + 52);
    var max = Math.max.apply(null, St.hours) || 1, bw = (w - 64) / 24, base = y + h - 10;
    for (var hr = 0; hr < 24; hr++) {
      var v = St.hours[hr], hh = Math.max(4, Math.round(v / max * (h - 120)));
      c.fillStyle = hr === St.peakH ? th.acc : th.bar; c.globalAlpha = v > 0 ? 1 : 0.25;
      rr(c, x + 32 + hr * bw + bw * 0.15, base - hh, bw * 0.7, hh, Math.min(6, hh / 2)); c.fill(); c.globalAlpha = 1;
      if (hr % 6 === 0) { c.fillStyle = th.sub; c.font = f(22, 700); c.textAlign = 'center'; c.fillText(String(hr), x + 32 + hr * bw + bw / 2, base + 36); }
    }
    var ty = T.types[St.type];
    c.fillStyle = th.acc; fit(c, ty[0] + ' ' + ty[1] + '　' + T.peak(St.peakH), 72, 1214, W - 144, 32, 800);
  }
  function draw(cv, St, page, th, showL) {
    var c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    if (page === 1) drawCalendar(c, th, St); else if (page === 2) drawLabels(c, th, St, showL); else drawSummary(c, th, St, showL);
  }

  /* ---------- 窓 ---------- */
  var back, box, body, lastFocus, S = { page: 0, theme: 0, showL: true, St: null, y: 0 };
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'text') n.textContent = attrs[k]; else if (k === 'cls') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (x) { if (x) n.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return n;
  }
  function prem() { return signed() && !!window.__ttPremium; }
  function member() { return signed() ? (window.__ttPremium ? 'premium' : 'free') : 'guest'; }
  function build() {
    if (!document.getElementById('ttw-css')) {
      var lk = document.createElement('link'); lk.id = 'ttw-css'; lk.rel = 'stylesheet'; lk.href = '/wrap.css?v=1'; document.head.appendChild(lk);
    }
    back = el('div', { cls: 'ttw-back' + (DT ? ' dt' : ''), hidden: '' });
    box = el('div', { cls: 'ttw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ttw-title' });
    var x = el('button', { type: 'button', cls: 'ttw-x', 'aria-label': T.close, text: '×' });
    x.addEventListener('click', close);
    box.appendChild(el('div', { cls: 'ttw-head' }, [el('h2', { id: 'ttw-title', text: T.title(wrapYear()) }), x]));
    body = el('div', { cls: 'ttw-body' });
    box.appendChild(body); back.appendChild(box);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function (e) {
      if (back.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        var fs = box.querySelectorAll('button:not([disabled]), a[href], input');
        if (!fs.length) return;
        if (e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
      }
    }, true);
    document.body.appendChild(back);
  }
  function close() {
    if (!back || back.hidden) return;
    back.hidden = true; document.documentElement.classList.remove('ttw-open');
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  async function open(from) {
    if (!back) build();
    lastFocus = document.activeElement;
    back.hidden = false; document.documentElement.classList.add('ttw-open');
    box.querySelector('.ttw-x').focus();
    S.y = wrapYear(); S.page = 0;
    ev('wrap_open', { from: from || '', member: member(), year: S.y });
    try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load(f(40, 800)), new Promise(function (r) { setTimeout(r, 1200); })]); } catch (e) {}
    if (!signed()) { S.St = sample(S.y); render(); return; }
    body.textContent = ''; body.appendChild(el('p', { cls: 'ttw-msg', role: 'status', text: T.loading }));
    var sb = await waitSb();
    if (!sb) { S.St = sample(S.y); render(); return; }
    try { if (!S.St || S.St.sample || S.St.y !== S.y || Date.now() - (S.at || 0) > 120000) { S.St = await load(sb, S.y); S.at = Date.now(); } }
    catch (e) { body.textContent = ''; body.appendChild(el('p', { cls: 'ttw-msg err', role: 'status', text: T.err })); return; }
    if (!prem()) S.theme = 0;
    render();
  }
  function render() {
    var St = S.St, guest = St.sample, P = prem();
    body.textContent = '';
    if (!guest && St.total < 60) { body.appendChild(el('p', { cls: 'ttw-msg', text: T.empty(St.y) })); return; }
    if (guest) {
      var a = el('a', { cls: 'ttw-btn', href: ACCT, text: T.outBtn });
      a.addEventListener('click', function () { ev('wrap_cta', { to: 'login' }); });
      body.appendChild(el('div', { cls: 'ttw-out' }, [el('p', { cls: 'ttw-out-t', text: T.outT }), el('p', { cls: 'ttw-out-l', text: T.outL }), a]));
    }
    // ページの切り替え
    var tabs = el('div', { cls: 'ttw-tabs', role: 'group' });
    T.pages.forEach(function (name, i) {
      var lock = i > 0 && !P && !guest;
      var b = el('button', { type: 'button', cls: 'ttw-tab' + (S.page === i ? ' on' : ''), 'aria-pressed': S.page === i ? 'true' : 'false', text: (lock ? '🔒 ' : '') + name });
      b.addEventListener('click', function () { if (S.page === i) return; S.page = i; ev('wrap_page', { page: i, member: member() }); render(); var t = body.querySelectorAll('.ttw-tab')[i]; if (t) t.focus(); });
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
    var locked = S.page > 0 && !P && !guest;
    var cv = el('canvas', { cls: 'ttw-cv' + (locked ? ' locked' : ''), width: String(W), height: String(H), role: 'img', 'aria-label': T.pages[S.page] });
    var stage = el('div', { cls: 'ttw-stage' }, [cv]);
    body.appendChild(stage);
    draw(cv, St, S.page, THEMES[P ? S.theme : 0], S.showL);
    if (locked) {
      var go = el('a', { cls: 'ttw-btn', href: PRICING, text: T.lockBtn });
      go.addEventListener('click', function () { ev('wrap_cta', { to: 'pricing', page: S.page }); });
      stage.appendChild(el('div', { cls: 'ttw-lock' }, [el('p', { cls: 'ttw-lock-t', text: '🔒 ' + T.lockT }), el('p', { cls: 'ttw-lock-l', text: T.lockL }), go]));
      ev('wrap_lock', { page: S.page });
    }
    if (guest) { body.appendChild(el('p', { cls: 'ttw-note', text: T.note })); return; }
    // デザイン・ラベル名
    var opts = el('div', { cls: 'ttw-opts' });
    var ds = el('div', { cls: 'ttw-designs', role: 'group', 'aria-label': T.design });
    THEMES.forEach(function (th, i) {
      var dl = i > 0 && !P;
      var b = el('button', { type: 'button', cls: 'ttw-sw' + ((P ? S.theme : 0) === i ? ' on' : ''), 'aria-pressed': (P ? S.theme : 0) === i ? 'true' : 'false', 'aria-label': T.designs[i] + (dl ? ' 🔒' : ''), title: dl ? T.designLock : T.designs[i] });
      b.style.background = 'linear-gradient(135deg,' + th.bg + ' 0 50%,' + th.acc + ' 50% 100%)';
      if (dl) b.appendChild(el('span', { cls: 'ttw-sw-lock', 'aria-hidden': 'true', text: '🔒' }));
      b.addEventListener('click', function () {
        if (dl) { ev('wrap_lock', { page: 'design' }); var n = body.querySelector('.ttw-dnote'); if (n) n.hidden = false; return; }
        S.theme = i; ev('wrap_design', { d: i }); render(); var t = body.querySelectorAll('.ttw-sw')[i]; if (t) t.focus();
      });
      ds.appendChild(b);
    });
    opts.appendChild(el('div', { cls: 'ttw-opt' }, [el('span', { cls: 'ttw-opt-l', text: T.design }), ds]));
    if (S.page !== 1) {
      var cb = el('input', { type: 'checkbox', id: 'ttw-showl' }); cb.checked = S.showL;
      cb.addEventListener('change', function () { S.showL = cb.checked; ev('wrap_labels', { on: cb.checked ? 1 : 0 }); render(); var t = document.getElementById('ttw-showl'); if (t) t.focus(); });
      opts.appendChild(el('label', { cls: 'ttw-chk', for: 'ttw-showl' }, [cb, el('span', { text: T.showLabels })]));
    }
    body.appendChild(opts);
    if (!P) {
      var dn = el('p', { cls: 'ttw-dnote', hidden: '' }, [T.designLock + ' — ']);
      var dl2 = el('a', { href: PRICING, text: T.lockBtn }); dl2.addEventListener('click', function () { ev('wrap_cta', { to: 'pricing', page: 'design' }); });
      dn.appendChild(dl2); body.appendChild(dn);
    }
    if (!locked) {
      var row = el('div', { cls: 'ttw-acts' });
      var canFile = false;
      try { canFile = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'a.png', { type: 'image/png' })] })); } catch (e) {}
      if (canFile) {
        var sh = el('button', { type: 'button', cls: 'ttw-btn', text: T.share });
        sh.addEventListener('click', function () { out(cv, 'share'); });
        row.appendChild(sh);
      }
      var sv = el('button', { type: 'button', cls: 'ttw-btn' + (canFile ? ' sub' : ''), text: T.save });
      sv.addEventListener('click', function () { out(cv, 'save'); });
      row.appendChild(sv);
      body.appendChild(row);
    }
    body.appendChild(el('p', { cls: 'ttw-note', text: T.note }));
  }
  function fname() { return (DT ? 'donuttimer' : 'timertrain') + '-' + S.y + '-' + ['summary', 'calendar', 'labels'][S.page] + '.png'; }
  function out(cv, how) {
    cv.toBlob(async function (blob) {
      if (!blob) return;
      ev('wrap_save', { how: how, page: S.page, member: member(), d: prem() ? S.theme : 0 });
      if (how === 'share') {
        try {
          var file = new File([blob], fname(), { type: 'image/png' });
          await navigator.share({ files: [file], text: T.shareText(S.y) + ' ' + SHARE_URL + '?utm_source=wrap&utm_medium=share&utm_campaign=wrap' + S.y });
          return;
        } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = fname();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      var n = body.querySelector('.ttw-saved');
      if (!n) { n = el('p', { cls: 'ttw-saved', role: 'status' }); body.appendChild(n); }
      n.textContent = T.saved;
    }, 'image/png');
  }

  window.__ttWrap = { open: open, close: close, _draw: draw, _sample: sample, _finish: finish, _themes: THEMES };
})();
