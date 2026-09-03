// 1. تسجيل نظام الأوفلاين (Service Worker)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
    });
}

// 2. التحميل الخفي الصامت لنصوص القرآن كاملة
window.addEventListener('load', () => {
    // الانتظار 3 ثوانٍ حتى يفتح الموقع بالكامل ثم يبدأ التحميل في الخلفية
    setTimeout(silentlyCacheAllQuranText, 3000);
});

async function silentlyCacheAllQuranText() {
    const isCached = localStorage.getItem('quran_text_fully_cached_v2');
    if (isCached === 'true') return; // توقف إذا تم التحميل مسبقاً
    
    try {
        const editions = ['quran-uthmani', 'quran-simple'];
        for (let surah = 1; surah <= 114; surah++) {
            for (let edition of editions) {
                const url = `https://api.alquran.cloud/v1/surah/${surah}/${edition}`;
                // جلب صامت (عامل الخلفية سيلتقطه ويحفظه تلقائياً)
                await fetch(url).catch(() => {});
                // استراحة 200 جزء من الثانية لمنع اختناق الإنترنت
                await new Promise(r => setTimeout(r, 200));
            }
        }
        localStorage.setItem('quran_text_fully_cached_v2', 'true');
        console.log("تم تحميل المصحف المكتوب للعمل بدون إنترنت.");
    } catch (e) {}
}

// 3. حقن أزرار حفظ الصوت للمنصة (بدون لمس الـ HTML)
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
        const cache = await caches.open('samee3-cache-v5');
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
        const cache = await caches.open('samee3-cache-v5');
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
