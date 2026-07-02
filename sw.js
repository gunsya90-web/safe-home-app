/* SAFE-HOME · sw.js — 대피 안내 화면이 오프라인/네트워크 불안정 상황에서도 열리도록 앱 셸을 캐시한다. */
var CACHE_NAME = 'safehome-shell-v2';
var SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/data.js',
  './js/ui.js',
  './js/store.js',
  './js/rules.js',
  './js/resident.js',
  './js/situation.js',
  './js/firefighter.js',
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
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
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
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
