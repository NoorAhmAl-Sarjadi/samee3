// =========================================================
// 1. تسجيل نظام الأوفلاين (Service Worker)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
    });
}

// =========================================================
// 2. التحميل الصامت لنصوص القرآن في الخلفية
// =========================================================
window.addEventListener('load', () => {
    setTimeout(silentlyCacheAllQuranText, 4000);
});

async function silentlyCacheAllQuranText() {
    if (localStorage.getItem('samee3_text_cached_v3') === 'true') return; 
    try {
        const editions = ['quran-uthmani', 'quran-simple'];
        for (let surah = 1; surah <= 114; surah++) {
            for (let edition of editions) {
                fetch(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`).catch(() => {});
                await new Promise(r => setTimeout(r, 150));
            }
        }
        localStorage.setItem('samee3_text_cached_v3', 'true');
    } catch (e) {}
}

// =========================================================
// 3. حقن الأزرار وإدارة التشغيل بسلاسة تامة بدون أي رسائل مزعجة
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
});

// --- التحكم الذكي بالزر السفلي (تشغيل فوراً عند عودة النت، وتنبيه ثابت لو مقطوع) ---
if (typeof window.togglePlayState === 'function') {
    const originalToggle = window.togglePlayState;
    window.togglePlayState = function() {
        const audio = document.getElementById('main-audio');
        if (audio) {
            // لو النت مش موجود والسورة مش محملة -> رسالة ثابتة واحدة فقط
            if (!navigator.onLine && (audio.error || audio.readyState === 0 || audio.paused)) {
                // فحص دقيق هل السورة مخزنة محلياً أم لا
                const currentUrl = audio.src;
                caches.match(currentUrl).then(cached => {
                    if (!cached) {
                        if(typeof window.isPlaying !== 'undefined') window.isPlaying = false;
                        const playBtn = document.getElementById('play-btn-sticky');
                        if (playBtn) playBtn.innerHTML = "⏵";
                        showToast("عذراً، السورة غير محملة ❌ يرجى الاتصال بالإنترنت.");
                    } else {
                        originalToggle(); // لو مخزنة محلياً تشتغل عادي جداً بدون نت
                    }
                }).catch(() => {
                    showToast("عذراً، السورة غير محملة ❌ يرجى الاتصال بالإنترنت.");
                });
                return;
            }
            
            // لو النت رجع وجاوب المشغل -> تنظيف حالة الخطأ والتشغيل فوراً بدون أي رسائل أو تأخير
            if (navigator.onLine && audio.error) {
                audio.removeAttribute('src'); // تفريغ الخطأ القديم
                if(typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                    audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                }
            }
        }
        originalToggle();
    };
}

// --- التحكم الذكي بزر الآيات (تشغيل فوري عند عودة النت) ---
if (typeof window.playSpecificAyahModal === 'function') {
    const originalPlayAyah = window.playSpecificAyahModal;
    window.playSpecificAyahModal = function() {
        const audio = document.getElementById('main-audio');
        if (audio) {
            if (!navigator.onLine && audio.error) {
                if(typeof closeModals === 'function') closeModals();
                return showToast("عذراً، السورة غير محملة ❌ يرجى الاتصال بالإنترنت.");
            }
            if (navigator.onLine && audio.error) {
                audio.removeAttribute('src');
                if(typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                    audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                }
            }
        }
        originalPlayAyah();
    };
}

// =========================================================
// 4. دوال التحميل للعمل بدون نت
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
