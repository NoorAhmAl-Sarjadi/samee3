const CACHE_NAME = 'samee3-audio-v4';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // التدخل فقط لتشغيل ملفات الـ MP3 المحفوظة
    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // إذا تم حفظها بالزر الأخضر، تشتغل فوراً من الجهاز
                if (cachedResponse) {
                    return cachedResponse;
                }
                // إذا لم تُحفظ، تشتغل من الإنترنت بمرونة تامة
                return fetch(event.request);
            })
        );
    }
});
