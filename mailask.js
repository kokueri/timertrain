'use strict';
/* お知らせメールの確認（ログイン中だけ。app.js が sync.js の後に読み込む）2026-11-25
 * - まだ答えていない人に1回だけ、画面の下に小さく「受け取りますか？」を出す（初期は受け取らない）
 * - 出すのは「マイタイマーを保存した直後」か「登録から20時間以上たった人がタイマーを開いたとき」。タイマーが動いている間は出さない
 * - 「受け取る」「今はいい」はどちらも DB に記録（set_email_news）＝どの端末でも二度と出ない。× は7日後まで出さない（この端末だけ）
 * - 表示は textContent のみ。メールアドレスはログイン中の本人のものを表示するだけで、どこにも送らない
 */
(function () {
  var DONE = 'tt-mailask-done', SNOOZE = 'tt-mailask-snooze';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  if (ls(DONE) === '1') return;
  var sn = Number(ls(SNOOZE)) || 0;
  if (sn > Date.now()) return;

  var lang = document.documentElement.lang;
  if (['ja', 'en', 'es'].indexOf(lang) < 0) lang = 'ja';
  var T = {
    ja: {
      title: 'お知らせメールを受け取りますか？',
      body: function (e) { return '新しい機能や料金の変更を ' + e + ' にお送りします。多くても月に1〜2通、アカウントページでいつでも止められます。'; },
      yes: '受け取る', no: '今はいい', close: '閉じる',
      yesDone: '受け取る設定にしました。アカウントページでいつでも変えられます。',
      noDone: 'わかりました。受け取りたくなったら、アカウントページで設定できます。',
      err: '保存できませんでした。アカウントページからも設定できます。'
    },
    en: {
      title: 'Get email updates?',
      body: function (e) { return 'We will email ' + e + ' about new features and pricing changes. One or two a month at most, and you can turn it off on the account page at any time.'; },
      yes: 'Yes, email me', no: 'Not now', close: 'Close',
      yesDone: 'Done. You can change this on the account page at any time.',
      noDone: 'Got it. You can turn this on later on the account page.',
      err: 'Could not save. You can also set this on the account page.'
    },
    es: {
      title: '¿Quieres recibir correos de novedades?',
      body: function (e) { return 'Te escribiremos a ' + e + ' sobre nuevas funciones y cambios de precio. Como mucho uno o dos al mes, y puedes desactivarlo en la página de cuenta cuando quieras.'; },
      yes: 'Sí, quiero recibirlos', no: 'Ahora no', close: 'Cerrar',
      yesDone: 'Listo. Puedes cambiarlo en la página de cuenta cuando quieras.',
      noDone: 'Entendido. Puedes activarlo más tarde en la página de cuenta.',
      err: 'No se pudo guardar. También puedes configurarlo en la página de cuenta.'
    }
  }[lang];
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
  function running() { try { return !!(window.__ttRunActive && window.__ttRunActive()); } catch (e) { return false; } }

  var sb = null, email = '', state = 'wait'; // wait → ready（出してよい）→ shown → done
  var wantNow = false; // マイタイマーを保存した直後

  // マイタイマーの保存（sync.js が送る GA の timer_save）をきっかけにする
  var g0 = window.gtag;
  if (typeof g0 === 'function') {
    window.gtag = function () {
      try { if (arguments[0] === 'event' && arguments[1] === 'timer_save') { wantNow = true; setTimeout(tryShow, 1200); } } catch (e) {}
      return g0.apply(this, arguments);
    };
  }

  function tryShow() {
    if (state !== 'ready' && !(state === 'wait2' && wantNow)) return;
    if (running() || document.body.classList.contains('focus-mode') || document.visibilityState !== 'visible') return;
    // ほかの窓（新機能のお知らせ・データ・まとめカードなど）が開いている間は出さない
    if (document.querySelector('.tt-news, .tt-drop, .ttw-back:not([hidden]), [aria-modal="true"]:not([hidden])')) return;
    show();
  }

  function show() {
    state = 'shown';
    var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/mailask.css?v=1';
    document.head.appendChild(link);
    var yes = el('button', { type: 'button', cls: 'tt-mailask-yes', text: T.yes });
    var no = el('button', { type: 'button', cls: 'tt-mailask-no', text: T.no });
    var x = el('button', { type: 'button', cls: 'tt-mailask-x', 'aria-label': T.close, text: '×' });
    var msg = el('p', { cls: 'tt-mailask-msg', role: 'status' });
    var box = el('section', { cls: 'tt-mailask', role: 'dialog', 'aria-labelledby': 'tt-mailask-t' }, [
      x,
      el('p', { cls: 'tt-mailask-title', id: 'tt-mailask-t', text: T.title }),
      el('p', { cls: 'tt-mailask-body', text: T.body(email) }),
      el('div', { cls: 'tt-mailask-row' }, [yes, no]),
      msg
    ]);
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('on'); });
    ev('news_ask_view', { trigger: wantNow ? 'save' : 'visit' });
    function close(ms) { setTimeout(function () { box.classList.remove('on'); setTimeout(function () { box.remove(); }, 300); }, ms || 0); }
    async function answer(v) {
      yes.disabled = true; no.disabled = true;
      var r;
      try { r = await sb.rpc('set_email_news', { p_news: v, p_lang: lang, p_source: 'popup' }); } catch (e) { r = { error: e }; }
      if (r.error) {
        msg.textContent = T.err; yes.disabled = false; no.disabled = false;
        return;
      }
      ls(DONE, '1'); state = 'done';
      ev(v ? 'news_optin' : 'news_later', { source: 'popup' });
      box.querySelector('.tt-mailask-row').remove();
      msg.textContent = v ? T.yesDone : T.noDone;
      close(4000);
    }
    yes.addEventListener('click', function () { answer(true); });
    no.addEventListener('click', function () { answer(false); });
    x.addEventListener('click', function () {
      ls(SNOOZE, String(Date.now() + 7 * 864e5)); state = 'done';
      ev('news_close');
      close(0);
    });
  }

  (async function init() {
    // sync.js がログインを確かめて window.__ttSb を用意するのを待つ（最大20秒）
    for (var i = 0; i < 40 && !window.__ttSb && !window.__ttSignedOut; i++) await new Promise(function (r) { setTimeout(r, 500); });
    sb = window.__ttSb;
    if (!sb) return;
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user || !user.email) return;
    email = user.email;
    var r = await sb.from('email_prefs').select('news').maybeSingle();
    if (r.error) return; // 読めないときは何もしない
    if (r.data) { ls(DONE, '1'); return; } // もう答えている（アカウントページ含む）
    var age = Date.now() - new Date(user.created_at || Date.now()).getTime();
    if (age >= 20 * 3600 * 1000) {
      state = 'ready';
      setTimeout(tryShow, 4000);
      // タイマーが動いていたら、止まって画面に戻ったときに出す
      setInterval(tryShow, 5000);
    } else {
      state = 'wait2'; // 登録したばかりの人は、マイタイマーを保存したときだけ
      if (wantNow) setTimeout(tryShow, 1200);
      setInterval(tryShow, 5000);
    }
  })().catch(function () {});
})();
