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
// 3. حقن الأزرار وإصلاح مشغل الصوت بشكل احترافي وهادئ
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

// --- التحكم الذكي في زر التشغيل ---
if (typeof window.togglePlayState === 'function') {
    const originalToggle = window.togglePlayState;
    window.togglePlayState = function() {
        const audio = document.getElementById('main-audio');
        if (audio) {
            if (!navigator.onLine && (audio.error || audio.readyState === 0)) {
                if(typeof window.isPlaying !== 'undefined') window.isPlaying = false;
                const playBtn = document.getElementById('play-btn-sticky');
                if (playBtn) playBtn.innerHTML = "⏵";
                return showToast("السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً."); 
            }
            if (navigator.onLine && audio.error) {
                if(typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                    audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                    audio.load();
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
        if (audio) {
            if (!navigator.onLine && (audio.error || audio.readyState === 0)) {
                if(typeof closeModals === 'function') closeModals();
                return showToast("السورة غير محملة ❌ يرجى الاتصال بالإنترنت أولاً.");
            }
            if (navigator.onLine && audio.error) {
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
// 4. دوال تحميل الصوتيات للعمل بدون نت (تم إصلاحها وتطويرها)
// =========================================================
async function cacheCurrentSurahForOffline() {
    if(!currentAudioServer || !currentSurahNumber) return showToast("اختر سورة وقارئ أولاً.");
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية حالياً...");

    window.isDownloadingOp = true; // [إصلاح]: تفعيل حالة التحميل حتى لا يتم الإلغاء التلقائي
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
            if (els && els.sidePanelBtn) els.sidePanelBtn.classList.add('hidden'); 
            setTimeout(() => hideSidePanel(), 3500);
        } else { throw new Error("فشل"); }
    } catch(e) { 
        if (els && els.sidePanelText) els.sidePanelText.innerText = "فشل التحميل!"; 
    } finally {
        window.isDownloadingOp = false; // [إصلاح]: إنهاء حالة التحميل عند الانتهاء
    }
}

async function cacheFullMushafForOffline() {
    if(!currentAudioServer) return showToast("اختر قارئ أولاً.");
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية حالياً...");

    // [إصلاح]: تأمين مصفوفة السور في حال كانت فارغة، بحيث يتم تحميل 114 سورة بشكل افتراضي
    const surahsToDownload = (typeof currentAvailableSurahs !== 'undefined' && currentAvailableSurahs.length > 0) 
                             ? currentAvailableSurahs 
                             : Array.from({length: 114}, (_, i) => i + 1);

    const confirmMsg = "تنبيه: سيتم تحميل المصحف كاملاً داخل المنصة ليعمل بدون نت. هل ترغب بالمتابعة؟ (قد يستغرق بعض الوقت)";
    if(!confirm(confirmMsg)) return;

    window.isDownloadingOp = true; // [إصلاح]: تفعيل حالة التحميل لبدء الحلقة بنجاح
    initSidePanel("تحميل المصحف للعمل بدون نت");
    if (els && els.sidePanelCancel) els.sidePanelCancel.innerText = 'إيقاف / إلغاء';
    
    let downloadedCount = 0; 
    let totalSurahs = surahsToDownload.length;
    
    try {
        const cache = await caches.open('samee3-cache-v6');
        for (let i = 0; i < totalSurahs; i++) {
            if(!window.isDownloadingOp) throw new Error("تم الإلغاء"); // هذا السطر كان يوقف العملية سابقاً

            let surahNum = surahsToDownload[i];
            const url = currentAudioServer + padNumber(surahNum) + '.mp3';
            const existing = await cache.match(url);
            
            if(!existing) {
                try {
                    const response = await fetch(url);
                    if (response.ok) await cache.put(url, response);
                } catch(fetchErr) {
                    console.log("تخطي خطأ في السورة: " + surahNum);
                }
            }
            downloadedCount++;
            let percent = Math.floor((downloadedCount / totalSurahs) * 100);
            updateSidePanel(percent, `تم التحميل ${downloadedCount} من ${totalSurahs} سورة`);
        }
        updateSidePanel(100, "اكتمل التحميل! المصحف متاح بدون نت.");
        if (els && els.sidePanelBtn) els.sidePanelBtn.classList.add('hidden');
        setTimeout(() => hideSidePanel(), 4000);
    } catch(e) { 
        if(e.message !== "تم الإلغاء") {
            if (els && els.sidePanelText) els.sidePanelText.innerText = "فشل التحميل.. المساحة ممتلئة أو انقطع الاتصال!"; 
        } else {
            if (els && els.sidePanelText) els.sidePanelText.innerText = "تم إلغاء التحميل.";
            setTimeout(() => hideSidePanel(), 2000);
        }
    } finally {
        window.isDownloadingOp = false; // [إصلاح]: إنهاء حالة التحميل بعد الاكتمال أو الإلغاء
    }
}
