const CACHE_NAME = 'samee3-cache-v6';

// [الجديد]: أضف هنا أسماء ملفات واجهة الموقع (HTML, CSS, JS) عشان الموقع يفتح من غير نت كأنه تطبيق
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    // ملاحظة هامة: لو عندك ملفات CSS أو JS أساسية أو صور للوجو، امسح الشرطتين واكتب اسمهم هنا، مثال:
    // './style.css', 
    // './main.js'
];

self.addEventListener('install', event => { 
    // [الجديد]: تخزين ملفات الواجهة الأساسية أثناء تثبيت الـ Service Worker
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); 
});

self.addEventListener('activate', event => { 
    // [الجديد]: تنظيف أي كاش قديم لو قمت بتغيير اسم CACHE_NAME في المستقبل
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => clients.claim())
    ); 
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 1. تسريع الملفات النصية (أسماء القراء والنصوص القرآنية) [الكود الخاص بك - لم يتغير]
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
        return; // إنهاء التنفيذ هنا حتى لا يكمل للأسفل
    }

    // 2. التعامل السلس مع الصوت (إما محفوظ في المنصة أو من النت مباشرة) [الكود الخاص بك - لم يتغير]
    if (url.endsWith('.mp3')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request);
            })
        );
        return; // إنهاء التنفيذ هنا
    }

    // 3. [الجديد]: التعامل مع باقي الملفات (واجهة الموقع HTML, CSS, JS) للعمل بدون إنترنت
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // لو الملف موجود في الكاش، رجعه عشان الموقع يفتح أوفلاين
            if (cachedResponse) {
                // تحديث الواجهة في الخلفية (عشان لو عدلت أي حاجة في الكود تظهر للمستخدمين لما يفتحوا النت)
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
                    }
                }).catch(() => {}); // لو مفيش نت تجاهل الخطأ
                
                return cachedResponse;
            }
            
            // لو مش في الكاش، جيبه من النت
            return fetch(event.request).catch(() => {
                // لو النت فاصل تماماً والمستخدم بيعمل ريفريش، افتحله الواجهة الأساسية بدل شاشة الخطأ
                if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
