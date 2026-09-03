const CACHE_NAME = 'samee3-cache-v5';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 1. تسريع بيانات الموقع (قوائم القراء والنصوص المكتوبة)
    if (url.includes('api.alquran.cloud') || url.includes('mp3quran.net')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // محاولة جلب النسخة الأحدث من الإنترنت وحفظها في الخلفية
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return cachedResponse; // إذا انقطع النت، اعرض المحفوظ
                });
                
                // إذا وجدها في الذاكرة سيعرضها فوراً بلمح البصر، وإلا سينتظر الإنترنت
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 2. التعامل السلس مع الصوتيات (بدون تعطيل المشغل)
    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse; // تشغيل بدون نت إذا كانت محفوظة
                return fetch(event.request); // جلب من الإنترنت بشكل طبيعي
            })
        );
    }
});
