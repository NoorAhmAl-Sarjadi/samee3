const CACHE_NAME = 'samee3-audio-cache-v1';

// التفعيل الفوري بمجرد الدخول للموقع
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

// اعتراض أي محاولة لتشغيل ملف صوتي
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // إذا كان الملف المطلوب هو ملف صوتي للقرآن (mp3)
    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // 1. إذا وجدنا الصوت محفوظاً على الجهاز، نقوم بتشغيله فوراً (حتى لو لم يوجد إنترنت)
                if (cachedResponse) {
                    console.log('تشغيل السورة من الذاكرة المحلية (بدون نت)');
                    return cachedResponse;
                }
                
                // 2. إذا لم يكن محفوظاً (أول مرة يستمع لها)، نجلبه من الإنترنت
                return fetch(event.request).then(networkResponse => {
                    // نأخذ نسخة منه ونحفظها في الخلفية ليتم تشغيلها بدون نت في المرات القادمة
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(err => {
                    // في حال انقطاع النت ومحاولة تشغيل سورة لم يتم حفظها
                    console.error('أنت أوفلاين وهذه السورة لم يتم تحميلها بعد.');
                });
            })
        );
    }
});
