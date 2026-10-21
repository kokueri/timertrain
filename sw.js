/* TimerTrain service worker
- HTML: network-first （常に最新のページを配信し、オフライン時のみキャッシュ）
- 静的アセット: cache-first（style.css / app.js は ?v= 付きなので更新は自動で反映）
*/
const V = 'tt-v17';
const PRECACHE = ['/style.css?v=18', '/app.js?v=17', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
e.waitUntil(caches.open(V).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
e.waitUntil(
caches.keys()
.then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
.then(() => self.clients.claim())
);
});

self.addEventListener('fetch', e => {
const req = e.request;
if (req.method !== 'GET') return;
let url;
try { url = new URL(req.url); } catch (_) { return; }
if (url.origin !== self.location.origin) return; // GA など外部はそのまま

if (req.mode === 'navigate') {
e.respondWith(
fetch(req).then(res => {
const copy = res.clone();
caches.open(V).then(c => c.put(req, copy)).catch(() => {});
return res;
}).catch(() => caches.match(req).then(r => r || caches.match('/')))
);
return;
}

e.respondWith(
caches.match(req).then(hit => hit || fetch(req).then(res => {
if (res && res.ok) {
const copy = res.clone();
caches.open(V).then(c => c.put(req, copy)).catch(() => {});
}
return res;
}))
);
});

// 通知をタップしたら、開いているタイマーのタブに戻る（なければトップを開く）
self.addEventListener('notificationclick', e => {
e.notification.close();
e.waitUntil(
self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
for (const c of list) { if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus(); }
return self.clients.openWindow ? self.clients.openWindow('/') : null;
})
);
});
