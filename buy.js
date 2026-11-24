/* 料金ページから、その場で申し込む（2026-11-21）
 * - ログイン済みで無料プランの人だけ。「7日間無料で試す」を押すと、このページの中に申込み前の確認（特商法の最終確認の表示事項）と
 *   年額／月額のボタンを出し、押したら Stripe の決済画面へ進む（アカウントページを経由しない）
 * - 未ログイン・プレミアム・ログインの期限切れ・通信エラーのときは、これまでどおりアカウントページへ
 * - 文言は textContent のみ。トークンは Supabase（自分のプロジェクト）にだけ送る。移動先は stripe.com の URL だけ許可
 */
(function () {
  'use strict';
  var SB_URL = 'https://arsfocfjfwtlykfdkiea.supabase.co';
  var SB_KEY = 'sb_publishable_zw039kyiXe27oY4ITTcNnA_-B_FsG5H';
  var FN_URL = SB_URL + '/functions/v1/billing/';
  var TOKEN_KEY = 'sb-arsfocfjfwtlykfdkiea-auth-token';
  var lang = document.documentElement.lang;
  var l = ['en', 'es'].indexOf(lang) >= 0 ? lang : 'ja';
  // 料金ページの価格（data-tt）を今の期で埋める（tiers.js）
  if (window.TT_TIERS) window.TT_TIERS.ready(function () { window.TT_TIERS.paint(document, l); });
  var BACK = { ja: '/pricing', en: '/en-pricing', es: '/es-pricing' }[l];
  var ACCT = '/account?l=' + l + '#acct-plans';

  var T = {
    ja: {
      head: 'お申込み前にご確認ください',
      terms: function (trial) { return [
        ['料金', '年額プラン {y}／年、月額プラン {m}／月（税込）。創設メンバー価格（{stage}）で、契約が続くかぎりこの料金のままです。'],
        ['お支払い', trial ? '初めての方は最初の7日間は無料です。8日目に初回の料金を請求し、以後は解約するまで毎年（月額プランは毎月）同じ日に自動で更新・請求します。' : 'お申込みと同時に初回の料金を請求し、以後は解約するまで毎年（月額プランは毎月）同じ日に自動で更新・請求します。'],
        ['支払方法', 'クレジットカードなど（決済は Stripe／Link）'],
        ['ご利用開始', 'お申込み後すぐに使えます。'],
        ['解約', 'アカウントページの「お支払い・解約の管理」からいつでも解約できます。次の更新日からの請求が止まり、期間の終わりまで使えます。無料期間中に解約すれば料金はかかりません。解約料はありません。'],
        ['返金', 'お支払い後の返金は原則できません（法令や決済会社の規定による場合を除きます）。']
      ]; },
      yearly: '年額プランで始める（おトク）', monthly: '月額プランで始める',
      note: '金額はお住まいの地域の通貨で、次の画面（Stripe の決済画面）に表示されます。',
      going: '決済画面を開いています…', err: '決済画面を開けませんでした。時間をおいてもう一度お試しください。',
      already: 'すでにプレミアムです。反映まで少し時間がかかることがあります。', sep: '：'
    },
    en: {
      head: 'Please check before you subscribe',
      terms: function (trial) { return [
        ['Price', 'Yearly {y}/year or monthly {m}/month (founding member price, {stage}, kept for as long as you stay subscribed). The price in your local currency, with any tax, is shown on the next screen.'],
        ['Payment', trial ? 'New subscribers get the first 7 days free. You are charged on day 8, and the plan then renews and is charged automatically every year (monthly plan: every month) until you cancel.' : 'You are charged when you subscribe, and the plan then renews and is charged automatically every year (monthly plan: every month) until you cancel.'],
        ['Payment methods', 'Cards and more (processed by Stripe / Link)'],
        ['Access', 'Available right after you subscribe.'],
        ['Cancellation', 'Cancel any time in "Billing and cancellation" on your account page. You will not be charged again and keep Premium until the end of the period. No charge if you cancel during the trial. No cancellation fee.'],
        ['Refunds', 'Payments are non-refundable, except where required by law or the payment provider\'s rules.']
      ]; },
      yearly: 'Start yearly (best value)', monthly: 'Start monthly',
      note: 'The price is shown in your local currency on the next screen (Stripe checkout).',
      going: 'Opening checkout…', err: 'Could not open checkout. Please try again later.',
      already: 'You already have Premium. It can take a moment to show up.', sep: ': '
    },
    es: {
      head: 'Revisa antes de suscribirte',
      terms: function (trial) { return [
        ['Precio', 'Plan anual {usdy} al año o mensual {usdm} al mes (en México: {mxny} / {mxnm}). Precio fundador ({stage}), mientras sigas con la suscripción. El precio en tu moneda, con impuestos, se muestra en la siguiente pantalla.'],
        ['Pago', trial ? 'Si es tu primera vez, los primeros 7 días son gratis. El día 8 se hace el primer cobro y después se renueva y se cobra automáticamente cada año (plan mensual: cada mes) hasta que canceles.' : 'Se cobra al suscribirte y después se renueva y se cobra automáticamente cada año (plan mensual: cada mes) hasta que canceles.'],
        ['Formas de pago', 'Tarjetas y más (procesado por Stripe / Link)'],
        ['Acceso', 'Disponible en cuanto te suscribes.'],
        ['Cancelación', 'Cancela cuando quieras en "Pagos y cancelación" de tu página de cuenta. No se te vuelve a cobrar y mantienes Premium hasta el final del periodo. Sin cargo si cancelas durante la prueba. Sin penalización.'],
        ['Reembolsos', 'Los pagos no son reembolsables, salvo cuando lo exija la ley o el proveedor de pagos.']
      ]; },
      yearly: 'Empezar plan anual (mejor precio)', monthly: 'Empezar plan mensual',
      note: 'El precio se muestra en tu moneda en la siguiente pantalla (pago con Stripe).',
      going: 'Abriendo el pago…', err: 'No se pudo abrir el pago. Inténtalo más tarde.',
      already: 'Ya tienes Premium. Puede tardar un momento en aparecer.', sep: ': '
    }
  }[l];

  function session() {
    try {
      var s = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (!s || typeof s.access_token !== 'string') return null;
      // 期限が近い・切れているときは使わない（アカウントページで更新してもらう）
      if (s.expires_at && Number(s.expires_at) * 1000 < Date.now() + 60000) return null;
      return s.access_token;
    } catch (e) { return null; }
  }
  function cachedPlan() { try { return localStorage.getItem('tt-plan'); } catch (e) { return null; } }
  function ev(name, p) { try { if (window.gtag) gtag('event', name, p || {}); } catch (e) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var links = Array.prototype.slice.call(document.querySelectorAll('.plan-go a'));
  if (!links.length) return;
  links.forEach(function (a) { a.addEventListener('click', function () { ev('pricing_cta', { pos: a.closest('.plan-go-top') ? 'top' : 'bottom', signed: session() ? 1 : 0 }); }); });
  if (!session() || cachedPlan() === 'premium') return; // これまでどおりアカウントページへ

  var ent = null, entP = null;
  function loadEnt() {
    if (entP) return entP;
    var tok = session();
    if (!tok) return Promise.reject(new Error('nosession'));
    entP = fetch(SB_URL + '/rest/v1/entitlements?select=plan,status,current_period_end,trial_used', {
      headers: { apikey: SB_KEY, authorization: 'Bearer ' + tok }
    }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (rows) { ent = Array.isArray(rows) && rows[0] ? rows[0] : {}; return ent; });
    entP.catch(function () { entP = null; });
    return entP;
  }
  function isPrem(e) {
    return !!e && e.plan === 'premium' && ['active', 'trialing', 'past_due'].indexOf(e.status) >= 0 &&
      (!e.current_period_end || new Date(e.current_period_end).getTime() > Date.now() - 3 * 864e5);
  }
  function toAccount() { location.assign(ACCT); }

  async function checkout(plan, btns, err) {
    var tok = session();
    if (!tok) { toAccount(); return; }
    btns.forEach(function (b) { b.disabled = true; });
    var orig = btns.map(function (b) { return b.textContent; });
    btns[plan === 'yearly' ? 0 : 1].textContent = T.going;
    err.hidden = true;
    ev('checkout_start', { plan: plan, from: 'pricing' });
    try {
      var r = await fetch(FN_URL + 'checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok, apikey: SB_KEY },
        body: JSON.stringify({ plan: plan, lang: l, back: BACK })
      });
      var j = {}; try { j = await r.json(); } catch (e) {}
      if (r.status === 401) { toAccount(); return; }
      if (!r.ok) { var er = new Error(j.error || ('http ' + r.status)); er.code = j.error; throw er; }
      if (typeof j.url !== 'string' || !/^https:\/\/(checkout|billing)\.stripe\.com\//.test(j.url)) throw new Error('bad url');
      location.assign(j.url);
    } catch (e) {
      btns.forEach(function (b, i) { b.disabled = false; b.textContent = orig[i]; });
      err.textContent = e.code === 'already_premium' ? T.already : T.err;
      err.hidden = false;
    }
  }

  function panel(trial) {
    var box = el('section', 'buy-panel'); box.id = 'buy-panel'; box.tabIndex = -1; box.setAttribute('aria-label', T.head);
    box.appendChild(el('p', 'buy-head', T.head));
    var dl = el('dl', 'buy-terms');
    T.terms(trial).forEach(function (t) { dl.appendChild(el('dt', null, t[0])); dl.appendChild(el('dd', null, window.TT_TIERS ? window.TT_TIERS.fill(t[1], l) : t[1])); });
    box.appendChild(dl);
    var by = el('button', 'buy-btn buy-btn-main', T.yearly); by.type = 'button';
    var bm = el('button', 'buy-btn', T.monthly); bm.type = 'button';
    var err = el('p', 'buy-err'); err.setAttribute('role', 'status'); err.hidden = true;
    by.addEventListener('click', function () { checkout('yearly', [by, bm], err); });
    bm.addEventListener('click', function () { checkout('monthly', [by, bm], err); });
    var row = el('div', 'buy-row'); row.appendChild(by); row.appendChild(bm);
    box.appendChild(row);
    box.appendChild(el('p', 'buy-note', T.note));
    box.appendChild(err);
    return box;
  }

  async function open(after) {
    var cur = document.getElementById('buy-panel');
    if (cur) { cur.scrollIntoView({ behavior: 'smooth', block: 'start' }); try { cur.focus({ preventScroll: true }); } catch (e) {} return; }
    try { await loadEnt(); } catch (e) { toAccount(); return; }
    if (isPrem(ent)) { try { localStorage.setItem('tt-plan', 'premium'); } catch (e) {} toAccount(); return; }
    var p = panel(!(ent && ent.trial_used));
    after.parentNode.insertBefore(p, after.nextSibling);
    ev('see_plans', { from: 'pricing' });
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { p.focus({ preventScroll: true }); } catch (e) {}
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      open(a.closest('.plan-go') || a);
    });
  });
  loadEnt().catch(function () {}); // 先に読んでおく
  // 案内（30日より前の記録など）から #buy で来たら、上のボタンの下に開いておく
  if (location.hash === '#buy') open(links[0].closest('.plan-go') || links[0]);
})();
