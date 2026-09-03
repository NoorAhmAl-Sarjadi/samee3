const CACHE_NAME = 'samee3-cache-v5';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (url.includes('api.alquran.cloud') || url.includes('mp3quran.net')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // إذا تم الحفظ بالزر الأخضر، تعمل فورا بدون نت
                if (cachedResponse) return cachedResponse;
                
                // إذا لم تحفظ، اتركها للإنترنت (وإذا لم يكن هناك إنترنت ستفشل وسيلتقط المشغل الخطأ ويظهر الرسالة)
                return fetch(event.request);
            })
        );
    }
});
