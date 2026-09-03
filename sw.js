const CACHE_NAME = 'samee3-cache-v3';

self.addEventListener('install', event => { 
    self.skipWaiting(); 
});

self.addEventListener('activate', event => { 
    event.waitUntil(clients.claim()); 
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 1. تسريع فتح الصفحة وجلب بيانات السور والقراء (نصوص)
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
                }).catch(() => {
                    return cachedResponse; // إذا لم يوجد إنترنت، اعرض المحفوظ مسبقاً
                });
                
                // إذا كانت البيانات محفوظة، نعرضها في أجزاء من الثانية (تسريع خيالي) ونحدثها في الخلفية
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 2. التعامل مع ملفات الصوت
    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // إذا قام المستخدم بحفظ السورة من الزر الأخضر، ستعمل من الذاكرة (بدون نت)
                if (cachedResponse) {
                    return cachedResponse;
                }
                // إذا لم يحفظها، تشتغل من الإنترنت مباشرة بشكل طبيعي
                return fetch(event.request);
            })
        );
    }
});
