// =========================================================
// 1. تسريع المنصة وإلغاء شاشة التحميل (السرعة الصاروخية)
// =========================================================
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    let requestUrl = typeof args[0] === 'string' ? args[0] : (args[0] ? args[0].url : '');

    // أ. تسريع القوائم الأساسية (أسماء السور والقراء) من LocalStorage
    if (requestUrl.includes('api.alquran.cloud/v1/meta') || requestUrl.includes('mp3quran.net/api/v3/reciters')) {
        const cacheKey = requestUrl.includes('meta') ? 'samee3_meta_data' : 'samee3_reciters_data';
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            originalFetch.apply(window, args).then(res => res.text()).then(text => localStorage.setItem(cacheKey, text)).catch(() => {});
            return new Response(cachedData, { status: 200, headers: { 'Content-Type': 'application/json' } });
        } else {
            const response = await originalFetch.apply(window, args);
            const clone = response.clone();
            clone.text().then(text => { try { localStorage.setItem(cacheKey, text); } catch(e) {} }).catch(() => {});
            return response;
        }
    }
    
    // ب. جلب نصوص السور من الذاكرة العميقة (إذا كانت محفوظة) لتفتح بدون نت
    if (requestUrl.includes('api.alquran.cloud/v1/surah/')) {
        try {
            const cache = await caches.open('samee3-text-cache-v1');
            const cachedResponse = await cache.match(requestUrl);
            if (cachedResponse) {
                return cachedResponse; // فتح السورة بلمح البصر من الجهاز
            } else {
                const response = await originalFetch.apply(window, args);
                if (response.ok) cache.put(requestUrl, response.clone());
                return response;
            }
        } catch(e) {
            return originalFetch.apply(window, args);
        }
    }

    return originalFetch.apply(window, args);
};

// =========================================================
// 2. التحميل الخفي لنصوص القرآن كاملة (Silent Background Fetch)
// =========================================================
window.addEventListener('load', () => {
    // تبدأ العملية بخفاء بعد 3 ثوانٍ من فتح الموقع حتى لا تؤثر على سرعة دخول المستخدم
    setTimeout(silentlyCacheAllQuranText, 3000);
});

async function silentlyCacheAllQuranText() {
    // التحقق مما إذا كان قد تم تحميل المصحف المكتوب مسبقاً
    const isCached = localStorage.getItem('quran_text_fully_cached_v1');
    if (isCached === 'true') return; // إذا كان محمولاً، توقف فوراً لعدم استهلاك النت
    
    try {
        const cache = await caches.open('samee3-text-cache-v1');
        // نحمل نوعين من النصوص لتغطية جميع الروايات (حفص وغيرها)
        const editions = ['quran-uthmani', 'quran-simple'];
        
        for (let surah = 1; surah <= 114; surah++) {
            for (let edition of editions) {
                const url = `https://api.alquran.cloud/v1/surah/${surah}/${edition}`;
                const exists = await cache.match(url);
                
                if (!exists) {
                    const res = await originalFetch(url); 
                    if (res.ok) await cache.put(url, res.clone());
                    
                    // استراحة قصيرة جداً (400 جزء من الثانية) بين كل سورة وأخرى 
                    // الهدف منها: ألا يلاحظ المستخدم أي بطء في جهازه أو في الإنترنت
                    await new Promise(r => setTimeout(r, 400));
                }
            }
        }
        
        // وضع علامة النجاح حتى لا يقوم بتحميلها مرة أخرى أبداً
        localStorage.setItem('quran_text_fully_cached_v1', 'true');
        console.log("✅ تمت عملية التحميل الخفي لنصوص القرآن بنجاح! يمكن قراءته الآن بدون إنترنت.");
    } catch (e) {
        console.log("تم إيقاف التحميل الخفي مؤقتاً، سيستكمل في الزيارة القادمة.");
    }
}

// =========================================================
// 3. نظام الأوفلاين للصوت وأزرار الحفظ 
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
    });
}

window.addEventListener('DOMContentLoaded', () => {
    const controlsContainer = document.querySelector('.player-controls');
    
    if(controlsContainer) {
        const saveSurahBtn = document.createElement('button');
        saveSurahBtn.className = 'action-btn-sm';
        saveSurahBtn.style.cssText = 'background: #10B981; color: white; border-color: #10B981; margin: 2px;';
        saveSurahBtn.innerHTML = '☁️ حفظ السورة للمنصة';
        saveSurahBtn.onclick = cacheCurrentSurahForOffline;
        
        const saveMushafBtn = document.createElement('button');
        saveMushafBtn.className = 'action-btn-sm';
        saveMushafBtn.style.cssText = 'background: #059669; color: white; border-color: #059669; margin: 2px;';
        saveMushafBtn.innerHTML = '☁️ حفظ المصحف للمنصة';
        saveMushafBtn.onclick = cacheFullMushafForOffline;
        
        controlsContainer.prepend(saveMushafBtn);
        controlsContainer.prepend(saveSurahBtn);
    }
});

async function cacheCurrentSurahForOffline() {
    if(!currentAudioServer || !currentSurahNumber) return showToast("اختر سورة وقارئ أولاً.");
    if(isDownloadingOp) return showToast("عملية جارية حالياً...");
    initSidePanel("حفظ السورة للاستماع بدون نت");
    els.sidePanelCancel.innerText = 'إلغاء العملية';
    try {
        updateSidePanel(30, "جاري الحفظ داخل المنصة...");
        const url = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
        const cache = await caches.open('samee3-audio-v4');
        const response = await fetch(url);
        if(response.ok) {
            await cache.put(url, response);
            updateSidePanel(100, "تم الحفظ بنجاح! السورة تعمل الآن بدون نت.");
            els.sidePanelBtn.classList.add('hidden'); 
            setTimeout(() => hideSidePanel(), 3500);
        } else { throw new Error("فشل"); }
    } catch(e) { els.sidePanelText.innerText = "فشل الحفظ!"; isDownloadingOp = false; }
}

async function cacheFullMushafForOffline() {
    if(!currentAudioServer || currentAvailableSurahs.length === 0) return showToast("اختر قارئ أولاً.");
    if(isDownloadingOp) return showToast("عملية جارية حالياً...");
    const confirmMsg = "تنبيه: سيتم حفظ المصحف كاملاً داخل المنصة ليعمل بدون نت. هل ترغب بالمتابعة؟";
    if(!confirm(confirmMsg)) return;
    initSidePanel("حفظ المصحف للعمل بدون نت");
    els.sidePanelCancel.innerText = 'إيقاف / إلغاء';
    let downloadedCount = 0; let totalSurahs = currentAvailableSurahs.length;
    try {
        const cache = await caches.open('samee3-audio-v4');
        for (let i = 0; i < totalSurahs; i++) {
            if(!isDownloadingOp) throw new Error("تم الإلغاء");
            let surahNum = currentAvailableSurahs[i];
            const url = currentAudioServer + padNumber(surahNum) + '.mp3';
            const existing = await cache.match(url);
            if(!existing) {
                const response = await fetch(url);
                if (response.ok) await cache.put(url, response);
            }
            downloadedCount++;
            let percent = Math.floor((downloadedCount / totalSurahs) * 100);
            updateSidePanel(percent, `تم حفظ ${downloadedCount} من ${totalSurahs} سورة`);
        }
        updateSidePanel(100, "اكتمل الحفظ! المصحف متاح بدون نت.");
        els.sidePanelBtn.classList.add('hidden');
        setTimeout(() => hideSidePanel(), 4000);
    } catch(e) { if(e.message !== "تم الإلغاء") els.sidePanelText.innerText = "فشل الحفظ.. قد تكون المساحة ممتلئة!"; }
}
