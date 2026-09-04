const CACHE_NAME = 'samee3-cache-v6';

// أسماء ملفات واجهة الموقع عشان تفتح من غير نت 
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './updates.css', // ملفاتك الإضافية
    './updates.js'
];

self.addEventListener('install', event => { 
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); 
});

self.addEventListener('activate', event => { 
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && !key.startsWith('samee3-cache')).map(key => caches.delete(key))
            );
        }).then(() => clients.claim())
    ); 
});

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
        return;
    }

    // 3. التعامل مع باقي الملفات (واجهة الموقع HTML, CSS, JS) للعمل بدون إنترنت
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // تحديث الواجهة في الخلفية لو النت شغال
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            
            return fetch(event.request).catch(() => {
                if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
