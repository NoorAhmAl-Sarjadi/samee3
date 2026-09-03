const CACHE_NAME = 'samee3-audio-cache-v2'; // قمنا بتغيير الإصدار لتحديث النظام فوراً

// التفعيل الفوري
self.addEventListener('install', event => { 
    self.skipWaiting(); 
});

self.addEventListener('activate', event => { 
    event.waitUntil(clients.claim()); 
});

// اعتراض الطلبات بشكل آمن
self.addEventListener('fetch', event => {
    // 1. التعامل مع ملفات الصوت
    if (event.request.url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // إذا قام المستخدم بحفظ السورة من الزر الأخضر، شغلها من الذاكرة (بدون نت)
                if (cachedResponse) {
                    return cachedResponse;
                }
                // إذا لم يحفظها، دع المشغل يتصل بالإنترنت بشكل طبيعي جداً للتدفق السريع
                return fetch(event.request);
            }).catch(() => {
                // في حالة فشل الاتصال وعدم وجود نت
                return fetch(event.request);
            })
        );
    }
});
