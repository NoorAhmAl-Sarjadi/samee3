const CACHE_NAME = 'samee3-audio-cache-v1';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

self.addEventListener('fetch', event => {
    const url = event.request.url;
    // اعتراض ملفات الصوت والنصوص لتعمل بدون نت
    if (url.endsWith('.mp3') || url.includes('api.alquran.cloud') || url.includes('mp3quran.net')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
    }
});
