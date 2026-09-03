const CACHE_NAME = 'samee3-cache-v6';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 1. تسريع الملفات النصية (أسماء القراء والنصوص القرآنية)
    if (url.includes('api.alquran.cloud') || url.includes('mp3quran.net')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse.ok) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);
                
                // السرعة الصاروخية: إرجاع المحفوظ فوراً دون انتظار المتصفح
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 2. التعامل السلس مع الصوت (إما محفوظ في المنصة أو من النت مباشرة)
    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request);
            })
        );
    }
});
