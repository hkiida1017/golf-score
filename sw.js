/* 電波がなくても開けるように、アプリ本体をiPhoneの中に取っておく仕組み。
   電波があるときは毎回いちばん新しい版を取りに行き（3秒で返事がなければ取っておいた版）、
   電波がないときは取っておいた版で開く。 */
const CACHE = 'golf-score-v5';
const FILES = ['./index.html', './apple-touch-icon.png', './icon-512.png', './manifest.json'];

self.addEventListener('install', e => {
  // cache:'reload' … iPhoneが覚えている古い版を使わず、必ずサーバーから取る
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(FILES.map(f => fetch(f, { cache: 'reload' }).then(res => res.ok && c.put(f, res)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  const key = isPage ? './index.html' : req;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const fromNet = fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    });
    const fromCache = () => cache.match(key, { ignoreSearch: true });
    if (!isPage) return (await fromCache()) || fromNet;
    // 本体：新しい版を優先。3秒待っても来なければ（電波が弱い・ない）取っておいた版
    const timeout = new Promise(r => setTimeout(r, 3000));
    try {
      const res = await Promise.race([fromNet, timeout]);
      if (res) return res;
    } catch (err) {}
    return (await fromCache()) || fromNet;
  }));
});
