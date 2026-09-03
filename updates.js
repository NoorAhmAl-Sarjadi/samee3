// =========================================================
// 1. تسجيل نظام الأوفلاين (Service Worker)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
    });
}

// =========================================================
// 2. التحميل الخفي الصامت لنصوص القرآن كاملة
// =========================================================
window.addEventListener('load', () => {
    setTimeout(silentlyCacheAllQuranText, 3000);
});

async function silentlyCacheAllQuranText() {
    const isCached = localStorage.getItem('quran_text_fully_cached_v2');
    if (isCached === 'true') return; 
    
    try {
        const editions = ['quran-uthmani', 'quran-simple'];
        for (let surah = 1; surah <= 114; surah++) {
            for (let edition of editions) {
                const url = `https://api.alquran.cloud/v1/surah/${surah}/${edition}`;
                await fetch(url).catch(() => {});
                await new Promise(r => setTimeout(r, 200));
            }
        }
        localStorage.setItem('quran_text_fully_cached_v2', 'true');
    } catch (e) {}
}

// =========================================================
// 3. حقن أزرار التحميل (للعمل بدون نت) وتصليح خلل انقطاع النت
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    const controlsContainer = document.querySelector('.player-controls');
    if(controlsContainer) {
        // زر تحميل السورة (باسم جديد ومميز)
        const saveSurahBtn = document.createElement('button');
        saveSurahBtn.className = 'action-btn-sm';
        saveSurahBtn.style.cssText = 'background: #10B981; color: white; border-color: #10B981; margin: 2px;';
        saveSurahBtn.innerHTML = '☁️ تحميل السورة (بدون نت)';
        saveSurahBtn.onclick = cacheCurrentSurahForOffline;
        
        // زر تحميل المصحف (باسم جديد ومميز)
        const saveMushafBtn = document.createElement('button');
        saveMushafBtn.className = 'action-btn-sm';
        saveMushafBtn.style.cssText = 'background: #059669; color: white; border-color: #059669; margin: 2px;';
        saveMushafBtn.innerHTML = '☁️ تحميل المصحف (بدون نت)';
        saveMushafBtn.onclick = cacheFullMushafForOffline;
        
        controlsContainer.prepend(saveMushafBtn);
        controlsContainer.prepend(saveSurahBtn);
    }

    // --- الحل الجذري لمشكلة التشغيل بدون إنترنت ---
    const mainAudio = document.getElementById('main-audio');
    if (mainAudio) {
        mainAudio.addEventListener('error', () => {
            if (!navigator.onLine) {
                showToast("عذراً، السورة غير محملة ❌ يرجى الاتصال بالإنترنت لتحميلها أولاً.");
                if(typeof isPlaying !== 'undefined') window.isPlaying = false;
                const playBtn = document.getElementById('play-btn-sticky');
                if (playBtn) playBtn.innerHTML = "⏵";
            }
        });
    }
});

// --- تصليح خلل (جاري تجهيز المقطع) عند عودة الإنترنت ---
// نقوم بتعديل دوال التشغيل الأساسية لتنعش نفسها تلقائياً
if (typeof window.togglePlayState === 'function') {
    const originalToggle = window.togglePlayState;
    window.togglePlayState = function() {
        const audio = document.getElementById('main-audio');
        // إذا كان هناك خطأ بسبب انقطاع سابق، أو المقطع معلق
        if (audio && (audio.error || audio.readyState === 0) && audio.src) {
            if (!navigator.onLine) {
                return showToast("السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً.");
            } else {
                audio.load(); // إنعاش المشغل لتنظيف الخطأ وبدء التحميل من جديد
            }
        }
        originalToggle();
    };
}

if (typeof window.playSpecificAyahModal === 'function') {
    const originalPlayAyah = window.playSpecificAyahModal;
    window.playSpecificAyahModal = function() {
        const audio = document.getElementById('main-audio');
        if (audio && (audio.error || audio.readyState === 0) && audio.src) {
            if (!navigator.onLine) {
                if(typeof closeModals === 'function') closeModals();
                return showToast("السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً.");
            } else {
                audio.load(); // إنعاش المشغل
            }
        }
        originalPlayAyah();
    };
}

// =========================================================
// 4. دوال تحميل الصوتيات للعمل بدون نت 
// =========================================================
async function cacheCurrentSurahForOffline() {
    if(!currentAudioServer || !currentSurahNumber) return showToast("اختر سورة وقارئ أولاً.");
    if(isDownloadingOp) return showToast("عملية جارية حالياً...");

    initSidePanel("تحميل السورة للعمل بدون نت");
    els.sidePanelCancel.innerText = 'إلغاء العملية';
    
    try {
        updateSidePanel(30, "جاري الحفظ داخل المنصة...");
        const url = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
        const cache = await caches.open('samee3-cache-v5');
        const response = await fetch(url);
        if(response.ok) {
            await cache.put(url, response);
            updateSidePanel(100, "تم التحميل! السورة تعمل الآن بدون نت.");
            els.sidePanelBtn.classList.add('hidden'); 
            setTimeout(() => hideSidePanel(), 3500);
        } else { throw new Error("فشل"); }
    } catch(e) { els.sidePanelText.innerText = "فشل التحميل!"; isDownloadingOp = false; }
}

async function cacheFullMushafForOffline() {
    if(!currentAudioServer || currentAvailableSurahs.length === 0) return showToast("اختر قارئ أولاً.");
    if(isDownloadingOp) return showToast("عملية جارية حالياً...");

    const confirmMsg = "تنبيه: سيتم تحميل المصحف كاملاً داخل المنصة ليعمل بدون نت. هل ترغب بالمتابعة؟";
    if(!confirm(confirmMsg)) return;

    initSidePanel("تحميل المصحف للعمل بدون نت");
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
            updateSidePanel(percent, `تم التحميل ${downloadedCount} من ${totalSurahs} سورة`);
        }
        updateSidePanel(100, "اكتمل التحميل! المصحف متاح بدون نت.");
        els.sidePanelBtn.classList.add('hidden');
        setTimeout(() => hideSidePanel(), 4000);
    } catch(e) { if(e.message !== "تم الإلغاء") els.sidePanelText.innerText = "فشل التحميل.. قد تكون المساحة ممتلئة!"; }
}
