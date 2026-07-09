const CACHE_NAME = 'finapp-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/db.js',
  '/js/utils.js',
  '/js/ui/dashboard.js',
  '/js/ui/transactions.js',
  '/js/ui/budgets.js',
  '/js/ui/categories.js',
  '/js/ui/goals.js',
  '/js/ui/accounts.js',
  '/js/ui/loans.js',
  '/js/ui/recurring.js',
  '/js/ui/reports.js',
  '/js/ui/projection.js',
  '/js/ui/report-pdf.js',
  '/js/ui/notifications.js',
  '/js/ui/ai-chat.js',
  '/js/ui/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
