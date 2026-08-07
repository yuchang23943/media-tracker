// Service Worker：让网站可被"安装"为 PWA
// 策略：网络优先，离线时回退缓存（动态资源不缓存，避免 React/Babel CDN 变化出问题）
const CACHE = 'yuchang-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // 只处理同源 GET
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // API 请求不缓存
  if (req.url.includes('/api/')) return;

  e.respondWith(
    fetch(req)
      .then((resp) => {
        // 成功则更新缓存
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
  );
});
