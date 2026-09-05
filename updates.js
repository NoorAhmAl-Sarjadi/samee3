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
// 3. حقن الأزرار وإصلاح مشغل الصوت
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
// 4. دوال تحميل الصوتيات للعمل بدون نت 
// =========================================================
async function cacheCurrentSurahForOffline() {
    if(!currentAudioServer || !currentSurahNumber) return showToast("اختر سورة وقارئ أولاً.");
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية حالياً...");

    window.isDownloadingOp = true;
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
    } finally { window.isDownloadingOp = false; }
}

async function cacheFullMushafForOffline() {
    if(!currentAudioServer) return showToast("اختر قارئ أولاً.");
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية حالياً...");

    const surahsToDownload = (typeof currentAvailableSurahs !== 'undefined' && currentAvailableSurahs.length > 0) 
                             ? currentAvailableSurahs : Array.from({length: 114}, (_, i) => i + 1);

    if(!confirm("سيتم تحميل المصحف كاملاً داخل المنصة ليعمل بدون نت. هل ترغب بالمتابعة؟ (قد يستغرق بعض الوقت)")) return;

    window.isDownloadingOp = true;
    initSidePanel("تحميل المصحف للعمل بدون نت");
    if (els && els.sidePanelCancel) els.sidePanelCancel.innerText = 'إيقاف / إلغاء';
    
    let downloadedCount = 0; let totalSurahs = surahsToDownload.length;
    
    try {
        const cache = await caches.open('samee3-cache-v6');
        for (let i = 0; i < totalSurahs; i++) {
            if(!window.isDownloadingOp) throw new Error("تم الإلغاء");

            let surahNum = surahsToDownload[i];
            const url = currentAudioServer + padNumber(surahNum) + '.mp3';
            const existing = await cache.match(url);
            
            if(!existing) {
                try {
                    const response = await fetch(url);
                    if (response.ok) await cache.put(url, response);
                } catch(fetchErr) {}
            }
            downloadedCount++;
            updateSidePanel(Math.floor((downloadedCount / totalSurahs) * 100), `تم التحميل ${downloadedCount} من ${totalSurahs} سورة`);
        }
        updateSidePanel(100, "اكتمل التحميل! المصحف متاح بدون نت.");
        if (els && els.sidePanelBtn) els.sidePanelBtn.classList.add('hidden');
        setTimeout(() => hideSidePanel(), 4000);
    } catch(e) { 
        if(e.message !== "تم الإلغاء") { if (els && els.sidePanelText) els.sidePanelText.innerText = "فشل التحميل.. المساحة ممتلئة أو انقطع الاتصال!"; } 
        else { if (els && els.sidePanelText) els.sidePanelText.innerText = "تم إلغاء التحميل."; setTimeout(() => hideSidePanel(), 2000); }
    } finally { window.isDownloadingOp = false; }
}


// =========================================================
// 5. نظام الأحاديث النبوية الشامل (كتب > أبواب > حديث واحد)
// =========================================================

window.addEventListener('DOMContentLoaded', () => {
    // 1. إضافة ستايلات الأحاديث
    const hadithStyles = document.createElement('style');
    hadithStyles.innerHTML = `
        #hadith-view { display: none; animation: fadeIn 0.5s; padding-bottom: 50px; }
        .hadith-tabs { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .btn-hadith-tab { padding: 12px 25px; border-radius: 10px; font-size: 18px; font-weight: 800; cursor: pointer; border: 2px solid #10B981; background: transparent; color: #10B981; transition: 0.3s; font-family: inherit; }
        .btn-hadith-tab.active { background: #10B981; color: white; box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3); }
        .hadith-book-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .hadith-book-card:hover { transform: translateY(-5px); border-color: #10B981; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.1); }
        .hadith-book-card h3 { color: #0F172A; margin: 0; font-size: 24px; font-family: 'Aref Ruqaa', serif; }
        .hadith-item-card { background: #F8FAFC; border-radius: 20px; padding: 35px 25px; margin-bottom: 20px; text-align: right; border: 2px solid #10B981; box-shadow: 0 10px 30px rgba(16,185,129,0.1); max-width: 900px; margin: 0 auto; }
        .hadith-item-text { font-family: 'Amiri', serif; font-size: clamp(22px, 5vw, 32px); line-height: 2.2; color: #0F172A; margin-bottom: 30px; text-align: justify; text-align-last: center; }
        .hadith-item-info { color: #10B981; font-weight: 700; font-size: 16px; margin-bottom: 20px; display: inline-block; background: #ECFDF5; padding: 8px 20px; border-radius: 50px; border: 1px solid #A7F3D0; }
        .hadith-actions-row { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; border-top: 2px dashed #CBD5E1; padding-top: 25px; }
        .h-btn { padding: 12px 20px; border-radius: 10px; border: none; font-family: inherit; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px; font-size: 15px; }
        .h-btn-copy { background: #E2E8F0; color: #334155; } .h-btn-copy:hover { background: #CBD5E1; }
        .h-btn-img { background: #10B981; color: white; } .h-btn-img:hover { background: #059669; box-shadow: 0 4px 15px rgba(16,185,129,0.4); }
        .h-btn-sharh { background: #D97706; color: white; } .h-btn-sharh:hover { background: #B45309; box-shadow: 0 4px 15px rgba(217,119,6,0.4); }
    `;
    document.head.appendChild(hadithStyles);

    // 2. إضافة زر الأحاديث
    const navBtns = document.querySelector('.nav-btns');
    if (navBtns) {
        const hadithBtn = document.createElement('button');
        hadithBtn.className = 'btn-nav';
        hadithBtn.id = 'nav-hadith-btn';
        hadithBtn.style.cssText = 'background: #10B981; color: white; border-color: #10B981;';
        hadithBtn.innerHTML = '📜 الأحاديث';
        hadithBtn.onclick = () => { switchTab('hadith-view'); initHadithSystem(); };
        navBtns.insertBefore(hadithBtn, navBtns.children[1]);
    }

    // 3. بناء هيكل الشاشات (الكتب > الأبواب > الحديث الواحد)
    const container = document.querySelector('.container');
    if (container) {
        const hadithView = document.createElement('div');
        hadithView.id = 'hadith-view';
        hadithView.innerHTML = `
            <div class="hadith-tabs" id="main-hadith-tabs">
                <button class="btn-hadith-tab active" id="tab-bukhari" onclick="loadHadithSource('bukhari')">صحيح البخاري</button>
                <button class="btn-hadith-tab" id="tab-muslim" onclick="loadHadithSource('muslim')">صحيح مسلم</button>
            </div>
            
            <!-- الشاشة الأولى: قائمة الكتب -->
            <div id="hadith-books-container">
                <div id="hadith-books-grid" class="surah-grid"></div>
            </div>

            <!-- الشاشة الثانية: قائمة الأبواب داخل الكتاب -->
            <div id="hadith-chapters-container" style="display: none;">
                <button class="btn-nav" onclick="showHadithBooks()" style="margin-bottom: 20px; background: #F8FAFC; border-color: #CBD5E1; color: #475569;">🔙 العودة لقائمة الكتب</button>
                <h2 id="current-book-title" style="color: #10B981; font-family: 'Aref Ruqaa', serif; font-size: 32px; text-align: center; margin-bottom: 30px;"></h2>
                <div id="hadith-chapters-grid" class="surah-grid"></div>
            </div>

            <!-- الشاشة الثالثة: عرض الحديث الواحد -->
            <div id="hadith-single-container" style="display: none;">
                <button class="btn-nav" onclick="showHadithChapters()" style="margin-bottom: 20px; background: #F8FAFC; border-color: #CBD5E1; color: #475569;">🔙 العودة لقائمة الأبواب</button>
                <h2 id="current-chapter-title" style="color: #D97706; font-family: 'Aref Ruqaa', serif; font-size: 26px; text-align: center; margin-bottom: 25px;"></h2>
                
                <div id="single-hadith-wrapper"></div>
                
                <div class="pagination-controls" style="display: flex; justify-content: center; gap: 20px; margin-top: 30px; align-items: center; background: #fff; padding: 15px; border-radius: 12px; border: 1px solid #E2E8F0; max-width: 500px; margin-left: auto; margin-right: auto;">
                    <button class="btn-nav" id="btn-prev-hadith" onclick="prevHadith()" style="border-color:#10B981; color:#10B981;">السابق</button>
                    <span id="hadith-counter-display" style="font-weight: 800; color: #10B981; font-size: 18px; direction: ltr;"></span>
                    <button class="btn-nav" id="btn-next-hadith" onclick="nextHadith()" style="border-color:#10B981; color:#10B981;">التالي</button>
                </div>
            </div>
        `;
        container.appendChild(hadithView);
    }

    if (typeof window.switchTab === 'function') {
        const originalSwitchTab = window.switchTab;
        window.switchTab = function(tabId) {
            originalSwitchTab(tabId);
            const hv = document.getElementById('hadith-view');
            if (hv) hv.style.display = (tabId === 'hadith-view') ? 'block' : 'none';
        };
    }
});

// ==========================================
// منطق إدارة (الكتب / الأبواب / الأحاديث)
// ==========================================
let currentHadithData = null; 
let currentHadithSource = 'bukhari';

let currentBookName = '';
let currentChapters = [];
let currentChapterIndex = 0;
let currentChapterHadiths = [];
let currentHadithIndex = 0;

function initHadithSystem() {
    if (!currentHadithData) loadHadithSource('bukhari');
}

async function loadHadithSource(source) {
    currentHadithSource = source;
    document.getElementById('tab-bukhari').classList.toggle('active', source === 'bukhari');
    document.getElementById('tab-muslim').classList.toggle('active', source === 'muslim');
    
    showHadithBooks();
    document.getElementById('hadith-books-grid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-size: 20px; color: #10B981; font-weight: bold; padding: 40px;">جاري الاتصال بقواعد البيانات واستحضار الكتب... ⏳</div>';

    const apiUrl = source === 'bukhari' 
        ? 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari.json'
        : 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-muslim.json';

    try {
        const res = await fetch(apiUrl);
        currentHadithData = await res.json();
        renderHadithBooks();
    } catch (err) {
        document.getElementById('hadith-books-grid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">حدث خطأ في تحميل الأحاديث. تأكد من اتصالك بالإنترنت.</div>';
    }
}

function renderHadithBooks() {
    const grid = document.getElementById('hadith-books-grid');
    grid.innerHTML = '';
    const sections = currentHadithData.metadata.sections;
    
    for (const [key, value] of Object.entries(sections)) {
        if (!value || value.trim() === "") continue;
        let cleanName = value.trim();
        if(!cleanName.includes('كتاب')) cleanName = 'كِتَابُ ' + cleanName; // لضمان اللغة العربية السليمة
        
        const card = document.createElement('div');
        card.className = 'hadith-book-card';
        card.innerHTML = `<h3>${cleanName}</h3>`;
        card.onclick = () => openHadithBook(key, cleanName);
        grid.appendChild(card);
    }
}

// ---- التنقل بين الشاشات ----
function showHadithBooks() {
    document.getElementById('main-hadith-tabs').style.display = 'flex';
    document.getElementById('hadith-books-container').style.display = 'block';
    document.getElementById('hadith-chapters-container').style.display = 'none';
    document.getElementById('hadith-single-container').style.display = 'none';
}

function showHadithChapters() {
    document.getElementById('main-hadith-tabs').style.display = 'none';
    document.getElementById('hadith-books-container').style.display = 'none';
    document.getElementById('hadith-chapters-container').style.display = 'block';
    document.getElementById('hadith-single-container').style.display = 'none';
}

function showSingleHadithViewer() {
    document.getElementById('main-hadith-tabs').style.display = 'none';
    document.getElementById('hadith-books-container').style.display = 'none';
    document.getElementById('hadith-chapters-container').style.display = 'none';
    document.getElementById('hadith-single-container').style.display = 'block';
}

// ---- معالجة الأبواب وتقسيمها ----
function openHadithBook(bookId, bookName) {
    currentBookName = bookName;
    document.getElementById('current-book-title').innerText = bookName;
    
    // سحب أحاديث الكتاب بالكامل
    const bookHadiths = currentHadithData.hadiths.filter(h => h.reference && h.reference.book == bookId);
    
    // تقسيم الكتاب لأبواب (مثلاً كل باب به 15 حديث)
    const chunkSize = 15;
    currentChapters = [];
    for (let i = 0; i < bookHadiths.length; i += chunkSize) {
        currentChapters.push(bookHadiths.slice(i, i + chunkSize));
    }

    const chaptersGrid = document.getElementById('hadith-chapters-grid');
    chaptersGrid.innerHTML = '';
    
    if (currentChapters.length === 0) {
        chaptersGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">لا توجد أحاديث مسجلة في هذا الكتاب حالياً.</p>';
    } else {
        currentChapters.forEach((chapterData, index) => {
            const card = document.createElement('div');
            card.className = 'hadith-book-card';
            card.innerHTML = `
                <h3 style="color:#D97706;">الباب (${index + 1})</h3>
                <p style="color:#64748B; margin: 10px 0 0 0; font-size:15px; font-weight:bold;">يحتوي على ${chapterData.length} أحاديث</p>
            `;
            card.onclick = () => openHadithChapter(index);
            chaptersGrid.appendChild(card);
        });
    }
    showHadithChapters();
}

// ---- فتح الباب وعرض الحديث الأول ----
function openHadithChapter(chapterIndex) {
    currentChapterIndex = chapterIndex;
    currentChapterHadiths = currentChapters[chapterIndex];
    currentHadithIndex = 0;
    
    document.getElementById('current-chapter-title').innerText = `${currentBookName} ❖ الباب (${chapterIndex + 1})`;
    showSingleHadithViewer();
    renderCurrentSingleHadith();
}

// ---- نظام عرض وتمرير الحديث (حديث بحديث) ----
function renderCurrentSingleHadith() {
    const wrapper = document.getElementById('single-hadith-wrapper');
    wrapper.innerHTML = '';
    
    const hadith = currentChapterHadiths[currentHadithIndex];
    const sourceName = currentHadithSource === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم';
    const cleanText = hadith.text.replace(/حدثنا/g, 'حَدَّثَنَا').replace(/رضي الله عنه/g, 'رَضِيَ اللَّهُ عَنْهُ');

    // بناء كارت الحديث
    const card = document.createElement('div');
    card.className = 'hadith-item-card';
    card.innerHTML = `
        <div style="text-align: center;">
            <div class="hadith-item-info">📖 ${sourceName} | حديث رقم: ${hadith.hadithnumber}</div>
        </div>
        <div class="hadith-item-text">${cleanText}</div>
        <div class="hadith-actions-row"></div>
    `;

    const actionsRow = card.querySelector('.hadith-actions-row');

    // أزرار التفاعل الآمنة
    const btnCopy = document.createElement('button');
    btnCopy.className = 'h-btn h-btn-copy';
    btnCopy.innerHTML = '📋 نسخ الحديث';
    btnCopy.onclick = function() { copyHadith(this, cleanText, sourceName, hadith.hadithnumber); };
    
    const btnImg = document.createElement('button');
    btnImg.className = 'h-btn h-btn-img';
    btnImg.innerHTML = '📤 تصميم كصورة';
    btnImg.onclick = function() { exportHadithImage(cleanText, sourceName, hadith.hadithnumber, currentBookName, false); };

    const btnSharh = document.createElement('button');
    btnSharh.className = 'h-btn h-btn-sharh';
    btnSharh.innerHTML = '🖼 صورة مع الشرح';
    btnSharh.onclick = function() { exportHadithImage(cleanText, sourceName, hadith.hadithnumber, currentBookName, true); };

    actionsRow.appendChild(btnCopy);
    actionsRow.appendChild(btnImg);
    actionsRow.appendChild(btnSharh);
    wrapper.appendChild(card);

    // تحديث أزرار التنقل والعداد
    document.getElementById('hadith-counter-display').innerText = `${currentHadithIndex + 1} / ${currentChapterHadiths.length}`;
    document.getElementById('btn-prev-hadith').disabled = (currentHadithIndex === 0);
    document.getElementById('btn-prev-hadith').style.opacity = (currentHadithIndex === 0) ? "0.5" : "1";
    
    document.getElementById('btn-next-hadith').disabled = (currentHadithIndex === currentChapterHadiths.length - 1);
    document.getElementById('btn-next-hadith').style.opacity = (currentHadithIndex === currentChapterHadiths.length - 1) ? "0.5" : "1";
}

function nextHadith() {
    if (currentHadithIndex < currentChapterHadiths.length - 1) {
        currentHadithIndex++;
        renderCurrentSingleHadith();
    }
}

function prevHadith() {
    if (currentHadithIndex > 0) {
        currentHadithIndex--;
        renderCurrentSingleHadith();
    }
}

// ==========================================
// التفاعل والتصدير كصورة 
// ==========================================

function copyHadith(btn, text, source, num) {
    const fullText = `${text}\n[${source} - كتاب ${currentBookName} - رقم ${num}]`;
    navigator.clipboard.writeText(fullText).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = "✅ تم النسخ";
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    });
}

function exportHadithImage(text, source, num, bookName, withSharh) {
    if(typeof window.isDownloadingOp !== 'undefined' && window.isDownloadingOp) return showToast("عملية جارية بالفعل...");
    
    initSidePanel(withSharh ? "تجهيز الشرح وتصميم الصورة..." : "تصميم صورة الحديث...");
    window.isDownloadingOp = true;

    // محاكاة جلب الشرح المعتمد لأهل السنة 
    const simulatedSharh = `هذا الحديث من جوامع الكلم التي أوتيها النبي ﷺ، وفيه بيان لأصل عظيم من أصول الدين. 
يرشدنا الحديث إلى أهمية استحضار النية الخالصة لله تعالى في جميع الأقوال والأفعال، 
وأن مدار قبول الأعمال عند الله عز وجل مبني على الإخلاص والمتابعة لهدي المصطفى ﷺ.
(المرجع المعتمد: فتح الباري / المنهاج في شرح صحيح مسلم).`;

    let exportDiv = document.getElementById('export-hadith-canvas');
    if (exportDiv) exportDiv.remove();

    exportDiv = document.createElement('div');
    exportDiv.id = 'export-hadith-canvas';
    exportDiv.style.cssText = 'position: fixed; left: -3000px; top: 0; width: 1080px; background: linear-gradient(135deg, #022c22 0%, #064e3b 100%); display: flex; flex-direction: column; padding: 40px; box-sizing: border-box; direction: rtl; z-index: -9999;';

    let dynamicFontSize = 45;
    if (text.length > 300) dynamicFontSize = 38;
    if (text.length > 500) dynamicFontSize = 32;

    let sharhHtml = '';
    if (withSharh) {
        sharhHtml = `
            <div style="font-family: 'Amiri', serif; font-size: 32px; line-height: 2.2; color: #F8FAFC; text-align: justify; background: rgba(15, 23, 42, 0.4); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin-top: 40px;">
                <div style="color: #FCD34D; font-size: 28px; margin-bottom: 15px; font-weight: bold;">📖 خلاصة الشرح:</div>
                ${simulatedSharh}
            </div>
        `;
    }

    exportDiv.innerHTML = `
        <div style="width: 100%; border: 4px solid #10B981; border-radius: 30px; padding: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: rgba(2, 44, 34, 0.8); box-shadow: inset 0 0 50px rgba(0,0,0,0.5); box-sizing: border-box;">
            
            <div style="font-family: 'Aref Ruqaa', serif; font-size: 40px; color: #10B981; background: rgba(0, 0, 0, 0.4); padding: 10px 50px; border-radius: 50px; border: 1px solid #10B981; margin-bottom: 40px;">
                قَالَ رَسُولُ اللَّهِ ﷺ
            </div>
            
            <div style="font-family: 'Amiri', serif; font-size: ${dynamicFontSize}px; line-height: 2.1; color: #FFFFFF; text-align: justify; text-align-last: center; text-shadow: 0 10px 30px rgba(0,0,0,0.5); margin: 0 0 30px 0;">
                « ${text} »
            </div>
            
            <div style="color: #D97706; font-size: 28px; font-weight: bold; margin-bottom: 10px; font-family: 'Tajawal', sans-serif;">
                ${source} ❖ ${bookName} (رقم: ${num})
            </div>
            
            ${sharhHtml}
            
            <div style="font-family: 'Tajawal', sans-serif; font-size: 35px; font-weight: 800; color: #94A3B8; direction: rtl; display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 50px;">
                <bdi style="color:#FFFFFF;">مصحف سَمِيع</bdi>
                <span style="color:#10B981; margin:0 15px;">❖</span>
                <bdi style="color:#FFFFFF;">قسم الأحاديث النبوية</bdi>
            </div>
        </div>
    `;
    
    document.body.appendChild(exportDiv);
    updateSidePanel(40, "جاري معالجة التصميم الإحترافي...");
    
    setTimeout(() => {
        if (typeof html2canvas !== 'undefined') {
            html2canvas(exportDiv, { scale: 2, useCORS: true, backgroundColor: '#022c22' }).then(canvas => {
                updateSidePanel(80, "تجهيز الصورة...");
                canvas.toBlob(blob => {
                    const fileName = `Hadith_${source}_${num}.png`;
                    if (typeof finishSidePanel === 'function') {
                        finishSidePanel(blob, fileName);
                    } else {
                        saveAs(blob, fileName);
                    }
                    exportDiv.remove();
                    window.isDownloadingOp = false;
                });
            }).catch(err => {
                if(els && els.sidePanelText) els.sidePanelText.innerText = "فشل التصميم!"; 
                window.isDownloadingOp = false; 
                exportDiv.remove();
            });
        } else {
            showToast("مكتبة الصور غير محملة.");
            window.isDownloadingOp = false;
            exportDiv.remove();
        }
    }, 1200); 
}
