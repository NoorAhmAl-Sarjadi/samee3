// =========================================================
// 1. تسجيل نظام الأوفلاين (Service Worker)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
    });
}

// =========================================================
// 2. التحميل الصامت لنصوص القرآن (لكي يفتح بدون نت)
// =========================================================
window.addEventListener('load', () => {
    // تبدأ العملية بعد 4 ثوانٍ بهدوء تام
    setTimeout(silentlyCacheAllQuranText, 4000);
});

async function silentlyCacheAllQuranText() {
    if (localStorage.getItem('samee3_text_cached_v3') === 'true') return; 
    try {
        const editions = ['quran-uthmani', 'quran-simple'];
        for (let surah = 1; surah <= 114; surah++) {
            for (let edition of editions) {
                // هذا الطلب سيلتقطه sw.js ويحفظه في الذاكرة
                fetch(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`).catch(() => {});
                // استراحة خفيفة لمنع اختناق المتصفح
                await new Promise(r => setTimeout(r, 150));
            }
        }
        localStorage.setItem('samee3_text_cached_v3', 'true');
    } catch (e) {}
}

// =========================================================
// 3. حقن الأزرار وإصلاح مشغل الصوت باحترافية
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    const controlsContainer = document.querySelector('.player-controls');
    if(controlsContainer) {
        const saveSurahBtn = document.createElement('button');
        saveSurahBtn.className = 'action-btn-sm';
        saveSurahBtn.style.cssText = 'background: #10B981; color: white; border-color: #10B981; margin: 2px;';
        saveSurahBtn.innerHTML = '☁️ تحميل السورة (بدون نت)';
        saveSurahBtn.onclick = cacheCurrentSurahForOffline;
        
        const saveMushafBtn = document.createElement('button');
        saveMushafBtn.className = 'action-btn-sm';
        saveMushafBtn.style.cssText = 'background: #059669; color: white; border-color: #059669; margin: 2px;';
        saveMushafBtn.innerHTML = '☁️ تحميل المصحف (بدون نت)';
        saveMushafBtn.onclick = cacheFullMushafForOffline;
        
        controlsContainer.prepend(saveMushafBtn);
        controlsContainer.prepend(saveSurahBtn);
    }

    // مراقبة أخطاء المشغل (عند انقطاع النت)
    const mainAudio = document.getElementById('main-audio');
    if (mainAudio) {
        mainAudio.addEventListener('error', () => {
            if (!navigator.onLine || mainAudio.error) {
                showToast("عذراً، السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً.");
                if(typeof isPlaying !== 'undefined') window.isPlaying = false;
                const playBtn = document.getElementById('play-btn-sticky');
                if (playBtn) playBtn.innerHTML = "⏵";
            }
        });
    }
});

// --- الحل الجذري والاحترافي للتشغيل بعد عودة الإنترنت ---
if (typeof window.togglePlayState === 'function') {
    const originalToggle = window.togglePlayState;
    window.togglePlayState = function() {
        const audio = document.getElementById('main-audio');
        // إذا كان المشغل في حالة "خطأ" (بسبب انقطاع نت سابق)
        if (audio && audio.error) {
            if (!navigator.onLine) {
                return showToast("السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً.");
            } else {
                // مسح حالة الخطأ تماماً وبناء الاتصال من الصفر!
                if(typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                    audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                    audio.load(); // إعادة تهيئة المشغل
                }
            }
        }
        originalToggle();
    };
}

if (typeof window.playSpecificAyahModal === 'function') {
    const originalPlayAyah = window.playSpecificAyahModal;
    window.playSpecificAyahModal = function() {
        const audio = document.getElementById('main-audio');
        if (audio && audio.error) {
            if (!navigator.onLine) {
                if(typeof closeModals === 'function') closeModals();
                return showToast("السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً.");
            } else {
                // إعادة الاتصال من الصفر عند تشغيل آية بعد عودة النت
                if(typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                    audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                    audio.load();
                }
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
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية حالياً...");

    initSidePanel("تحميل السورة للعمل بدون نت");
    els.sidePanelCancel.innerText = 'إلغاء العملية';
    
    try {
        updateSidePanel(30, "جاري الحفظ داخل المنصة...");
        const url = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
        const cache = await caches.open('samee3-cache-v6');
        const response = await fetch(url);
        if(response.ok) {
            await cache.put(url, response);
            updateSidePanel(100, "تم التحميل! السورة تعمل الآن بدون نت.");
            els.sidePanelBtn.classList.add('hidden'); 
            setTimeout(() => hideSidePanel(), 3500);
        } else { throw new Error("فشل"); }
    } catch(e) { els.sidePanelText.innerText = "فشل التحميل!"; if(typeof window.isDownloadingOp !== 'undefined') window.isDownloadingOp = false; }
}

async function cacheFullMushafForOffline() {
    if(!currentAudioServer || currentAvailableSurahs.length === 0) return showToast("اختر قارئ أولاً.");
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية حالياً...");

    const confirmMsg = "تنبيه: سيتم تحميل المصحف كاملاً داخل المنصة ليعمل بدون نت. هل ترغب بالمتابعة؟";
    if(!confirm(confirmMsg)) return;

    initSidePanel("تحميل المصحف للعمل بدون نت");
    els.sidePanelCancel.innerText = 'إيقاف / إلغاء';
    
    let downloadedCount = 0; let totalSurahs = currentAvailableSurahs.length;
    try {
        const cache = await caches.open('samee3-cache-v6');
        for (let i = 0; i < totalSurahs; i++) {
            if(!window.isDownloadingOp) throw new Error("تم الإلغاء");
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
    } catch(e) { if(e.message !== "تم الإلغاء") els.sidePanelText.innerText = "فشل التحميل.. المساحة ممتلئة!"; }
}
