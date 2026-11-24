/* TimerTrain 創設メンバー価格の段階 — 価格を変えるときはこのファイルだけ直す（決済の価格は Stripe の lookup_key と billing 関数の TIER_STEPS を合わせる）
 * 今の期は billing 関数 GET /billing/tier が Stripe の申込み数（解約した人を含む）から決める。取れないときは FALLBACK を使う。
 * s = 期, upto = この期の最後の人数（null = 上限なし）
 */
(function () {
  var TIERS = [
    { s: 1, upto: 10, jpy: [200, 1500], usd: [1.49, 11.99], eur: [1.49, 11.99], mxn: [22, 179] },
    { s: 2, upto: 20, jpy: [210, 1600], usd: [1.59, 12.99], eur: [1.59, 12.99], mxn: [23, 189] },
    { s: 3, upto: 30, jpy: [220, 1700], usd: [1.69, 13.49], eur: [1.69, 13.49], mxn: [24, 199] },
    { s: 4, upto: 40, jpy: [230, 1800], usd: [1.79, 14.49], eur: [1.79, 14.49], mxn: [26, 209] },
    { s: 5, upto: 50, jpy: [240, 1900], usd: [1.89, 14.99], eur: [1.89, 14.99], mxn: [27, 219] },
    { s: 6, upto: null, jpy: [250, 2000], usd: [1.99, 15.99], eur: [1.99, 15.99], mxn: [29, 229] }
  ];
  var FALLBACK = 1; // 関数に届かないときの期
  var API = 'https://arsfocfjfwtlykfdkiea.supabase.co/functions/v1/billing/tier';
  var KEY = 'tt-tier';

  function tier(s) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i].s === s) return TIERS[i]; return TIERS[0]; }
  function yen(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function usd(n) { return n.toFixed(2); }

  // lang: ja / en / es
  function view(s, lang) {
    var t = tier(s);
    var first = t.upto ? t.upto : null; // 先着◯名
    if (lang === 'en') return {
      s: t.s, upto: first, m: 'US$' + usd(t.usd[0]), y: 'US$' + usd(t.usd[1]), mNum: usd(t.usd[0]), mPre: 'US$', mSuf: '/mo',
      alt: '€' + usd(t.eur[0]) + '/month · €' + usd(t.eur[1]) + '/year, or ¥' + yen(t.jpy[0]) + '/month · ¥' + yen(t.jpy[1]) + '/year in Japan'
    };
    if (lang === 'es') return {
      s: t.s, upto: first, m: 'MXN ' + t.mxn[0], y: 'MXN ' + t.mxn[1], mNum: String(t.mxn[0]), mPre: 'MXN ', mSuf: '/mes',
      alt: 'US$' + usd(t.usd[0]) + '/mes · US$' + usd(t.usd[1]) + '/año o €' + usd(t.eur[0]) + '/mes · €' + usd(t.eur[1]) + '/año'
    };
    return { s: t.s, upto: first, m: yen(t.jpy[0]) + '円', y: yen(t.jpy[1]) + '円', mNum: String(t.jpy[0]), mPre: '月', mSuf: '円', alt: '' };
  }

  var cur = FALLBACK, waiters = [], done = false;
  try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.s && Date.now() - c.at < 30 * 60e3) { cur = c.s; done = true; } } catch (e) {}
  function finish(s) { if (typeof s === 'number' && s >= 1 && s <= TIERS[TIERS.length - 1].s) cur = s; done = true; var w = waiters; waiters = []; w.forEach(function (f) { try { f(cur); } catch (e) {} }); }
  if (!done) {
    try {
      fetch(API, { method: 'GET', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var s = j && Number(j.tier);
        if (s >= 1) { try { localStorage.setItem(KEY, JSON.stringify({ s: s, at: Date.now() })); } catch (e) {} }
        finish(s);
      }).catch(function () { finish(); });
    } catch (e) { finish(); }
  }

  // 文の中の {m} {y} {stage} {m12} {usdm} {usdy} {mxnm} {mxny} を今の期の価格に置きかえる
  function fill(str, lang, s) {
    if (typeof str !== 'string') return str;
    var t = tier(s == null ? cur : s), v = view(t.s, lang);
    var st = lang === 'en' ? (t.upto ? 'stage ' + t.s + ', first ' + t.upto : 'stage ' + t.s)
      : lang === 'es' ? (t.upto ? 'etapa ' + t.s + ', primeras ' + t.upto + ' personas' : 'etapa ' + t.s)
      : (t.upto ? '第' + t.s + '期・先着' + t.upto + '名' : '第' + t.s + '期');
    var m12 = lang === 'en' ? 'US$' + usd(Math.round(t.usd[0] * 1200) / 100) : lang === 'es' ? 'MXN ' + (t.mxn[0] * 12) : yen(t.jpy[0] * 12) + '円';
    return str.replace(/\{m\}/g, v.m).replace(/\{y\}/g, v.y).replace(/\{stage\}/g, st).replace(/\{m12\}/g, m12)
      .replace(/\{usdm\}/g, 'US$' + usd(t.usd[0])).replace(/\{usdy\}/g, 'US$' + usd(t.usd[1]))
      .replace(/\{mxnm\}/g, 'MXN ' + t.mxn[0]).replace(/\{mxny\}/g, 'MXN ' + t.mxn[1]).replace(/\{alt\}/g, v.alt);
  }
  // data-tt="..." を持つ要素の文を埋める（data-tt に元の文を入れておく）
  function paint(root, lang) {
    (root || document).querySelectorAll('[data-tt]').forEach(function (e) { e.textContent = fill(e.getAttribute('data-tt'), lang); });
  }

  window.TT_TIERS = {
    fill: fill,
    paint: paint,
    list: TIERS,
    now: function () { return cur; },
    view: view,
    // ready(fn): 今の期が分かったら fn(s) を呼ぶ（分かっていればすぐ）
    ready: function (fn) { if (done) fn(cur); else waiters.push(fn); }
  };
})();
