// =========================================================
// 1. تسريع فتح الصفحة بشكل صاروخي (حفظ نصوص القرآن والقراء)
// =========================================================
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const request = new Request(args[0], args[1]);
    const url = request.url;

    // استهداف روابط النصوص والبيانات فقط لتسريعها
    if (url.includes('api.alquran.cloud') || url.includes('mp3quran.net')) {
        try {
            const cache = await caches.open('samee3-data-cache-v1');
            const cachedResponse = await cache.match(request);
            
            if (cachedResponse) {
                // إذا كانت البيانات محفوظة، نعرضها فوراً بلمح البصر
                // ثم نحدثها في الخلفية بصمت للزيارات القادمة
                originalFetch(request).then(networkResponse => {
                    if (networkResponse.ok) cache.put(request, networkResponse.clone());
                }).catch(() => {});
                
                return cachedResponse;
            } else {
                // إذا كانت أول زيارة، نجلبها ونحفظها
                const networkResponse = await originalFetch(request);
                if (networkResponse.ok) cache.put(request, networkResponse.clone());
                return networkResponse;
            }
        } catch (e) {
            return originalFetch(...args);
        }
    }
    return originalFetch(...args);
};

// =========================================================
// 2. تفعيل مشغل الصوتيات بدون إنترنت (الربط مع Service Worker)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // نستدعي عامل الخلفية الذي سيقوم بتحميل الصوتيات
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ تم تفعيل وضع الأوفلاين بنجاح.'))
            .catch(err => console.log('❌ خطأ في تفعيل الأوفلاين:', err));
    });
    
    // إضافة رسالة تنبيه للمستخدم عندما ينقطع الإنترنت
    window.addEventListener('offline', () => {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.innerText = "أنت الآن بدون إنترنت. يمكنك تشغيل السور التي استمعت لها مسبقاً بحرية.";
            toast.className = "show";
            setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 4000);
        }
    });
}
