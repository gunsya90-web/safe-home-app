/* SAFE-HOME · sw.js — 대피 안내 화면이 오프라인/네트워크 불안정 상황에서도 열리도록 앱 셸을 캐시한다. */
var CACHE_NAME = 'safehome-shell-v5-board-zoom-7';
var SHELL_FILES = [
  './js/board-zoom.js',
  './css/board-zoom.css',
  './',
  './index.html',
  './resident.html',
  './css/resident-design.css',
  './css/resident-bright.css',
  './js/resident-config.js',
  './js/resident-design.js',
  './js/facility-guide.js',
  './manifest.webmanifest',
  './css/styles.css',
  './css/review.css',
  './css/workspace-refresh.css',
  './js/workspace-refresh.js',
  './js/data.js',
  './js/complex-info.js',
  './js/complex-directory.js',
  './css/complex-info.css',
  './js/csv.js',
  './js/ui.js',
  './js/store.js',
  './js/rules.js',
  './js/resident.js',
  './js/situation.js',
  './js/firefighter.js',
  './js/admin.js',
  './js/facility.js',
  './js/app.js',
  './icons/icon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL_FILES); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('safehome-shell-') === 0 && k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// 네트워크 우선(network-first) 전략: 화재 대응 앱이므로 온라인일 때는 항상 최신 대피 로직을 받아야 한다.
// 오프라인이거나 요청이 실패할 때만 캐시된 이전 버전으로 대체한다(마지막 수단으로서의 오프라인 지원).
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('오프라인에서 파일을 찾을 수 없습니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
    })
  );
});
