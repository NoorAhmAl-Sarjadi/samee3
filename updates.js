// =========================================================
// 1. تسجيل نظام الأوفلاين (Service Worker)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
    });
}

// =========================================================
// 2. التحميل الصامت (القرآن + الأحاديث) في الخلفية
// =========================================================
window.addEventListener('load', () => {
    setTimeout(silentlyCacheAllQuranText, 4000);
    setTimeout(silentlyCacheHadithData, 6000); 
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

async function silentlyCacheHadithData() {
    if (localStorage.getItem('samee3_hadith_cached_v2') === 'true') return;
    try {
        const cache = await caches.open('samee3-hadith-cache-v1');
        const urls = [
            'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari.json',
            'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-muslim.json'
        ];
        for (let url of urls) {
            const existing = await cache.match(url);
            if (!existing) {
                const response = await fetch(url);
                if (response.ok) await cache.put(url, response.clone());
            }
        }
        localStorage.setItem('samee3_hadith_cached_v2', 'true');
    } catch (e) {}
}

// =========================================================
// 3. دالة تنسيق الحديث وفصل المتن عن السند 
// =========================================================
const hadithSeparators = [
    'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ :', 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ:', 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ',
    'صلى الله عليه وسلم :', 'صلى الله عليه وسلم:', 'صلى الله عليه وسلم',
    'ﷺ :', 'ﷺ:', 'ﷺ',
    'يَقُولُ :', 'يَقُولُ:', 'يقول :', 'يقول:',
    'قَالَ :', 'قَالَ:', 'قال :', 'قال:'
];

function formatHadithHtml(text, isExport) {
    const textColor = isExport ? '#FFFFFF' : '#0F172A'; 
    const borderColor = isExport ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    
    let splitIdx = -1;
    let sepLen = 0;

    for (let sep of hadithSeparators) {
        let idx = text.indexOf(sep);
        if (idx !== -1) {
            splitIdx = idx;
            sepLen = sep.length;
            break;
        }
    }

    if (splitIdx !== -1) {
        let cutoff = splitIdx + sepLen;
        let sanad = text.substring(0, cutoff).trim();
        let matn = text.substring(cutoff).trim();
        
        if(matn.length > 0) {
            return `
                <div style="color: ${textColor}; font-size: ${isExport ? '0.75em' : '0.85em'}; opacity: ${isExport ? '0.85' : '1'}; margin-bottom: ${isExport ? '25px' : '15px'}; border-bottom: 1px dashed ${borderColor}; padding-bottom: ${isExport ? '20px' : '15px'}; text-align: justify; text-align-last: center;">
                    ${sanad}
                </div>
                <div style="color: ${textColor}; font-weight: ${isExport ? 'normal' : 'bold'}; text-align: justify; text-align-last: center; text-shadow: ${isExport ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'};">
                    « ${matn} »
                </div>`;
        }
    }
    
    return `<div style="color: ${textColor}; text-align: justify; text-align-last: center; text-shadow: ${isExport ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'};">« ${text} »</div>`;
}

// استخراج أول كلمات من المتن مجردة من التشكيل وعلامات الترقيم للبحث في الدرر السنية
function getHadithMatnForSearch(text) {
    let splitIdx = -1;
    let sepLen = 0;
    
    for (let sep of hadithSeparators) {
        let idx = text.indexOf(sep);
        if (idx !== -1) {
            splitIdx = idx;
            sepLen = sep.length;
            break;
        }
    }

    let matn = text;
    if (splitIdx !== -1) {
        matn = text.substring(splitIdx + sepLen).trim();
    }
    
    // 1. إزالة كلمة قال/يقول لو كانت في البداية
    matn = matn.replace(/^(?:يَقُولُ|يقول|قَالَ|قال)\s*[:،-]?\s*/i, '');
    
    // 2. إزالة جميع حركات التشكيل والتطويل
    matn = matn.replace(/[\u0617-\u061A\u064B-\u065F\u0640]/g, "");
    
    // 3. إزالة جميع علامات الترقيم والأقواس
    matn = matn.replace(/[،؛,.:;"'«»()[\]{}؟?!\-]/g, " ");
    
    // 4. تنظيف المسافات الزائدة وأخذ أول 15 كلمة
    matn = matn.replace(/\s+/g, ' ').trim();
    
    return matn.split(/\s+/).slice(0, 15).join(' ');
}

// =========================================================
// 4. حقن الأزرار والتحكم في الواجهات وإخفاء المشغل
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
    
    const searchTypeSelect = document.getElementById('search-type');
    if(searchTypeSelect) {
        const hadithOption = document.createElement('option');
        hadithOption.value = 'hadith';
        hadithOption.text = 'بحث عن حديث';
        searchTypeSelect.appendChild(hadithOption);
    }
});

if (typeof window.switchTab === 'function') {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        originalSwitchTab(tabId);
        const hv = document.getElementById('hadith-view');
        if (hv) hv.style.display = (tabId === 'hadith-view') ? 'block' : 'none';
        
        const stickyPlayer = document.querySelector('.sticky-player');
        if (stickyPlayer) {
            if (tabId === 'hadith-view' || tabId === 'unified-login-view' || tabId === 'admin-view') {
                stickyPlayer.style.display = 'none';
            } else {
                stickyPlayer.style.display = 'flex';
            }
        }
    };
}

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
            if (navigator.onLine && audio.error && typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                audio.load();
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
            if (navigator.onLine && audio.error && typeof currentAudioServer !== 'undefined' && typeof currentSurahNumber !== 'undefined') {
                audio.src = currentAudioServer + padNumber(currentSurahNumber) + '.mp3';
                audio.load();
            }
        }
        originalPlayAyah();
    };
}

// =========================================================
// 5. دوال تحميل الصوتيات للعمل بدون نت 
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
    const surahsToDownload = (typeof currentAvailableSurahs !== 'undefined' && currentAvailableSurahs.length > 0) ? currentAvailableSurahs : Array.from({length: 114}, (_, i) => i + 1);
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
// 6. نظام البحث الشامل المعدل (قرآن + قراء + أحاديث)
// =========================================================
const removeTashkeel = (text) => text.replace(/[\u0617-\u061A\u064B-\u0652]/g, "").replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ي/g, 'ى');

window.executeSearch = async function() {
    if (typeof searchTimeout !== 'undefined') clearTimeout(searchTimeout);
    const type = document.getElementById('search-type').value;
    const query = document.getElementById('search-input').value.trim();
    const resultsBox = document.getElementById('search-results');
    
    if(!query) { resultsBox.innerHTML = '<div style="text-align: center; color: #64748B; padding: 20px;">النتائج ستظهر هنا...</div>'; return; }

    if(type === 'reciter') {
        let matches = (typeof allMP3Reciters !== 'undefined' ? allMP3Reciters : []).filter(r => r.name.includes(query));
        resultsBox.innerHTML = matches.length > 0 ? matches.map(m => `<div class="search-result-item" onclick="selectReciterFromSearch('${m.riwayah}', '${m.server}')">🎤 ${m.name}</div>`).join('') : '<div style="text-align:center; padding:20px;">لم يتم العثور على قارئ.</div>';
    }
    else if(type === 'riwayah') {
        let matches = Array.from(document.getElementById('riwayah-select').options).filter(opt => opt.text.includes(query));
        resultsBox.innerHTML = matches.length > 0 ? matches.map(m => `<div class="search-result-item" onclick="selectRiwayahFromSearch('${m.value}')">📖 ${m.text}</div>`).join('') : '<div style="text-align:center; padding:20px;">لم يتم العثور على رواية.</div>';
    }
    else if (type === 'ayah') {
        resultsBox.innerHTML = '<div style="text-align:center; padding:20px; color: var(--royal-blue); font-weight: bold;">جاري البحث في المصحف... ⏳</div>';
        searchTimeout = setTimeout(async () => {
            try {
                let res = await fetch(`https://api.alquran.cloud/v1/search/${query}/all/quran-simple-clean`);
                let data = await res.json();
                if(data.code === 200 && data.data.matches.length > 0) {
                    resultsBox.innerHTML = data.data.matches.slice(0, 30).map(m => {
                        let cleanSurahName = m.surah.name.replace(/سورة\s*/g, '').replace(/سُورَةُ\s*/g, '').trim();
                        return `<div class="search-result-item" onclick="jumpToAyahFromSearch(${m.surah.number}, ${m.numberInSurah})"><span class="search-ayah-text">﴿ ${m.text} ﴾</span><small class="search-surah-info">سورة ${cleanSurahName} - آية ${m.numberInSurah}</small></div>`;
                    }).join('');
                } else resultsBox.innerHTML = '<div style="text-align:center; padding:20px; color: red;">لم يتم العثور على نتائج.</div>';
            } catch(e) { resultsBox.innerHTML = '<div style="text-align:center; padding:20px; color: red;">حدث خطأ.</div>'; }
        }, 800);
    }
    else if (type === 'hadith') {
        resultsBox.innerHTML = '<div style="text-align:center; padding:20px; color: #10B981; font-weight: bold;">جاري البحث بدقة في الأحاديث... ⏳</div>';
        searchTimeout = setTimeout(async () => {
            try {
                const cache = await caches.open('samee3-hadith-cache-v1');
                const bukhariUrl = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari.json';
                const muslimUrl = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-muslim.json';
                
                let bRes = await cache.match(bukhariUrl); if(!bRes) bRes = await fetch(bukhariUrl);
                let mRes = await cache.match(muslimUrl); if(!mRes) mRes = await fetch(muslimUrl);
                
                let bData = await bRes.json();
                let mData = await mRes.json();
                
                const normalizedQuery = removeTashkeel(query);
                let results = [];
                
                const searchInBook = (sourceData, sourceName, sourceKey) => {
                    for(let h of sourceData.hadiths) {
                        if(results.length >= 20) break; 
                        const cleanText = h.text.replace(/حدثنا/g, 'حَدَّثَنَا').replace(/رضي الله عنه/g, 'رَضِيَ اللَّهُ عَنْهُ');
                        const normText = removeTashkeel(cleanText);
                        
                        if(normText.includes(normalizedQuery)) {
                            let bookRef = h.reference ? h.reference.book : "1";
                            let arBookName = getArabicBookNameByID(sourceKey, String(bookRef));
                            
                            results.push({
                                sourceCode: sourceKey,
                                source: sourceName,
                                num: h.hadithnumber,
                                text: cleanText,
                                bookName: arBookName
                            });
                        }
                    }
                };
                
                searchInBook(bData, 'صحيح البخاري', 'bukhari');
                if(results.length < 20) searchInBook(mData, 'صحيح مسلم', 'muslim');
                
                if(results.length > 0) {
                    resultsBox.innerHTML = results.map((r, i) => {
                        let dorarQuery = getHadithMatnForSearch(r.text);
                        return `
                        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 15px; margin-bottom: 10px; border-radius: 10px; text-align: right; transition: 0.3s;">
                            <div style="cursor: pointer;" onclick="jumpToHadithFromSearch('${r.sourceCode}', ${r.num})" title="اضغط لفتح الحديث في بابه">
                                <div style="color: #10B981; font-weight: bold; margin-bottom: 15px; font-size: 14px;">${r.source} | رقم: ${r.num} | ${r.bookName}</div>
                                <div style="font-family: 'Amiri', serif; font-size: 18px; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #E2E8F0; transition: 0.3s;" onmouseover="this.style.borderColor='#10B981'" onmouseout="this.style.borderColor='#E2E8F0'">
                                    ${formatHadithHtml(r.text.substring(0, 250) + '...', false)}
                                    <div style="text-align: left; margin-top: 10px; color: #10B981; font-size: 13px; font-weight: bold;">👈 اضغط لفتح الحديث كاملاً داخل بابه</div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button onclick="window.open('https://dorar.net/hadith/search?q=' + encodeURIComponent(\`${dorarQuery}\`), '_blank')" style="background:#3B82F6; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:13px;">📖 التخريج (الدرر السنية)</button>
                                <button onclick="copyHadith(this, \`${r.text.replace(/"/g, "'")}\`, '${r.source}', ${r.num}, '${r.bookName}')" style="background:#E2E8F0; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:13px; color:#334155;">📋 نسخ</button>
                                <button onclick="exportHadithImage(\`${r.text.replace(/"/g, "'")}\`, '${r.source}', ${r.num}, '${r.bookName}')" style="background:#10B981; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:13px;">📤 صورة</button>
                            </div>
                        </div>
                        `;
                    }).join('');
                } else {
                    resultsBox.innerHTML = '<div style="text-align:center; padding:20px; color: red;">لم يتم العثور على أي حديث يطابق بحثك.</div>';
                }
            } catch(e) { 
                resultsBox.innerHTML = '<div style="text-align:center; padding:20px; color: red;">حدث خطأ أثناء البحث.</div>'; 
            }
        }, 1000);
    }
};

// =========================================================
// 7. القاموس الذكي لكتب الأحاديث والترجمة الدقيقة 
// =========================================================
const bukhariBooks = {
    "1": "بدء الوحي", "2": "الإيمان", "3": "العلم", "4": "الوضوء", "5": "الغسل", "6": "الحيض", "7": "التيمم", "8": "الصلاة", "9": "مواقيت الصلاة", "10": "الأذان",
    "11": "الجمعة", "12": "صلاة الخوف", "13": "العيدين", "14": "الوتر", "15": "الاستسقاء", "16": "الكسوف", "17": "سجود القرآن", "18": "تقصير الصلاة", "19": "التهجد", "20": "فضل الصلاة بمكة والمدينة",
    "21": "العمل في الصلاة", "22": "السهو", "23": "الجنائز", "24": "الزكاة", "25": "الحج", "26": "العمرة", "27": "المحصر", "28": "جزاء الصيد", "29": "فضائل المدينة", "30": "الصوم",
    "31": "صلاة التراويح", "32": "فضل ليلة القدر", "33": "الاعتكاف", "34": "البيوع", "35": "السلم", "36": "الشفعة", "37": "الإجارة", "38": "الحوالات", "39": "الكفالة", "40": "الوكالة",
    "41": "المزارعة", "42": "المساقاة", "43": "الاستقراض", "44": "الخصومات", "45": "اللقطة", "46": "المظالم", "47": "الشركة", "48": "الرهن", "49": "العتق", "50": "المكاتب",
    "51": "الهبة", "52": "الشهادات", "53": "الصلح", "54": "الشروط", "55": "الوصايا", "56": "الجهاد والسير", "57": "فرض الخمس", "58": "الجزية والموادعة", "59": "بدء الخلق", "60": "أحاديث الأنبياء",
    "61": "المناقب", "62": "فضائل أصحاب النبي", "63": "مناقب الأنصار", "64": "المغازي", "65": "التفسير", "66": "فضائل القرآن", "67": "النكاح", "68": "الطلاق", "69": "النفقات", "70": "الأطعمة",
    "71": "العقيقة", "72": "الذبائح والصيد", "73": "الأضاحي", "74": "الأشربة", "75": "المرضى", "76": "الطب", "77": "اللباس", "78": "الأدب", "79": "الاستئذان", "80": "الدعوات",
    "81": "الرقاق", "82": "القدر", "83": "الأيمان والنذور", "84": "كفارات الأيمان", "85": "الفرائض", "86": "الحدود", "87": "الديات", "88": "استتابة المرتدين", "89": "الإكراه", "90": "الحيل",
    "91": "التعبير", "92": "الفتن", "93": "الأحكام", "94": "التمني", "95": "أخبار الآحاد", "96": "الاعتصام بالكتاب والسنة", "97": "التوحيد"
};

const muslimBooks = {
    "1": "الإيمان", "2": "الطهارة", "3": "الحيض", "4": "الصلاة", "5": "المساجد ومواضع الصلاة", "6": "صلاة المسافرين وقصرها", "7": "الفضائل", "8": "الجمعة", "9": "صلاة العيدين", "10": "الاستسقاء",
    "11": "الكسوف", "12": "الجنائز", "13": "الزكاة", "14": "الصيام", "15": "الاعتكاف", "16": "الحج", "17": "النكاح", "18": "الرضاع", "19": "الطلاق", "20": "اللعان",
    "21": "العتق", "22": "البيوع", "23": "الفرائض", "24": "الهبات", "25": "الوصية", "26": "النذر", "27": "الأيمان", "28": "القسامة والمحاربين والديات", "29": "الحدود", "30": "الأقضية",
    "31": "اللقطة", "32": "الجهاد والسير", "33": "الإمارة", "34": "الصيد والذبائح", "35": "الأضاحي", "36": "الأشربة", "37": "اللباس والزينة", "38": "الآداب", "39": "السلام", "40": "الألفاظ من الأدب",
    "41": "الشعر", "42": "الرؤيا", "43": "الفضائل", "44": "فضائل الصحابة", "45": "البر والصلة والآداب", "46": "القدر", "47": "العلم", "48": "الذكر والدعاء", "49": "الرقاق", "50": "التوبة",
    "51": "صفة القيامة والجنة والنار", "52": "الجنة وصفة نعيمها وأهلها", "53": "الفتن وأشراط الساعة", "54": "الزهد والرقائق", "55": "التفسير", "56": "التفسير"
};

function getArabicBookNameByID(source, bookId) {
    if (bookId === "0" && source === 'bukhari') return "القسم التمهيدي";
    if (bookId === "0" && source === 'muslim') return "مقدمة الإمام مسلم";
    if (source === 'bukhari' && bukhariBooks[bookId]) return "كِتَابُ " + bukhariBooks[bookId];
    if (source === 'muslim' && muslimBooks[bookId]) return "كِتَابُ " + muslimBooks[bookId];
    return `كِتَابُ رقم (${bookId})`;
}

// =========================================================
// 8. نظام الأحاديث النبوية الشامل (واجهات العرض)
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    const hadithStyles = document.createElement('style');
    hadithStyles.innerHTML = `
        #hadith-view { display: none; animation: fadeIn 0.5s; padding-bottom: 50px; }
        .hadith-tabs { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .btn-hadith-tab { padding: 12px 25px; border-radius: 10px; font-size: 18px; font-weight: 800; cursor: pointer; border: 2px solid #10B981; background: transparent; color: #10B981; transition: 0.3s; font-family: inherit; }
        .btn-hadith-tab.active { background: #10B981; color: white; box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3); }
        .hadith-book-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .hadith-book-card:hover { transform: translateY(-5px); border-color: #10B981; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.1); }
        .hadith-book-card h3 { color: #0F172A; margin: 0; font-size: 24px; font-family: 'Aref Ruqaa', serif; line-height: 1.5; }
        .hadith-item-card { background: #F8FAFC; border-radius: 20px; padding: 35px 25px; margin-bottom: 20px; text-align: right; border: 2px solid #10B981; box-shadow: 0 10px 30px rgba(16,185,129,0.1); max-width: 900px; margin: 0 auto; }
        .hadith-item-text { font-family: 'Amiri', serif; font-size: clamp(22px, 5vw, 32px); color: #0F172A; margin-bottom: 30px; line-height: 2.1; text-align: justify; text-align-last: center; }
        .hadith-item-info { color: #10B981; font-weight: 700; font-size: 16px; margin-bottom: 20px; display: inline-block; background: #ECFDF5; padding: 8px 20px; border-radius: 50px; border: 1px solid #A7F3D0; }
        .hadith-actions-row { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; border-top: 2px dashed #CBD5E1; padding-top: 25px; }
        .h-btn { padding: 12px 20px; border-radius: 10px; border: none; font-family: inherit; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px; font-size: 15px; }
        .h-btn-copy { background: #E2E8F0; color: #334155; } .h-btn-copy:hover { background: #CBD5E1; }
        .h-btn-img { background: #10B981; color: white; } .h-btn-img:hover { background: #059669; box-shadow: 0 4px 15px rgba(16,185,129,0.4); }
        .h-btn-read { background: #3B82F6; color: white; } .h-btn-read:hover { background: #2563EB; box-shadow: 0 4px 15px rgba(59,130,246,0.4); }
    `;
    document.head.appendChild(hadithStyles);

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

    const container = document.querySelector('.container');
    if (container) {
        const hadithView = document.createElement('div');
        hadithView.id = 'hadith-view';
        hadithView.innerHTML = `
            <div class="hadith-tabs" id="main-hadith-tabs">
                <button class="btn-hadith-tab active" id="tab-bukhari" onclick="loadHadithSource('bukhari')">صحيح البخاري</button>
                <button class="btn-hadith-tab" id="tab-muslim" onclick="loadHadithSource('muslim')">صحيح مسلم</button>
            </div>
            <div id="hadith-books-container"><div id="hadith-books-grid" class="surah-grid"></div></div>
            <div id="hadith-chapters-container" style="display: none;">
                <button class="btn-nav" onclick="showHadithBooks()" style="margin-bottom: 20px; background: #F8FAFC; border-color: #CBD5E1; color: #475569;">🔙 العودة لقائمة الكتب</button>
                <h2 id="current-book-title" style="color: #10B981; font-family: 'Aref Ruqaa', serif; font-size: 32px; text-align: center; margin-bottom: 30px;"></h2>
                <div id="hadith-chapters-grid" class="surah-grid"></div>
            </div>
            <div id="hadith-single-container" style="display: none;">
                <button class="btn-nav" onclick="showHadithChapters()" style="margin-bottom: 20px; background: #F8FAFC; border-color: #CBD5E1; color: #475569;">🔙 العودة للأبواب</button>
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
});

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

    const apiUrl = source === 'bukhari' 
        ? 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari.json'
        : 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-muslim.json';

    try {
        const cache = await caches.open('samee3-hadith-cache-v1');
        let response = await cache.match(apiUrl);
        if (!response) {
            document.getElementById('hadith-books-grid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-size: 20px; color: #10B981; font-weight: bold; padding: 40px; line-height: 1.8;">جاري تحميل مكتبة الأحاديث لأول مرة... ⏳<br><small style="color:#64748B;">سيتم حفظها بجهازك لتفتح في لمح البصر المرة القادمة.</small></div>';
            response = await fetch(apiUrl);
            if (response.ok) await cache.put(apiUrl, response.clone());
        }
        currentHadithData = await response.json();
        renderHadithBooks();
    } catch (err) {
        document.getElementById('hadith-books-grid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">حدث خطأ في تحميل الأحاديث.</div>';
    }
}

function renderHadithBooks() {
    const grid = document.getElementById('hadith-books-grid');
    grid.innerHTML = '';
    const availableBookIds = new Set(currentHadithData.hadiths.map(h => h.reference ? String(h.reference.book) : null).filter(Boolean));
    const sections = currentHadithData.metadata.sections;
    
    for (const [key, value] of Object.entries(sections)) {
        if (!availableBookIds.has(String(key))) continue; 
        const arName = getArabicBookNameByID(currentHadithSource, key);
        const card = document.createElement('div');
        card.className = 'hadith-book-card';
        card.innerHTML = `<h3>${arName}</h3>`;
        card.onclick = () => openHadithBook(key, arName);
        grid.appendChild(card);
    }
}

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

function openHadithBook(bookId, bookName) {
    currentBookName = bookName;
    document.getElementById('current-book-title').innerText = bookName;
    const bookHadiths = currentHadithData.hadiths.filter(h => h.reference && h.reference.book == bookId);
    const chunkSize = 15;
    currentChapters = [];
    for (let i = 0; i < bookHadiths.length; i += chunkSize) {
        currentChapters.push(bookHadiths.slice(i, i + chunkSize));
    }
    const chaptersGrid = document.getElementById('hadith-chapters-grid');
    chaptersGrid.innerHTML = '';
    
    currentChapters.forEach((chapterData, index) => {
        const card = document.createElement('div');
        card.className = 'hadith-book-card';
        card.innerHTML = `<h3 style="color:#D97706;">الباب (${index + 1})</h3><p style="color:#64748B; margin: 10px 0 0 0; font-size:15px; font-weight:bold;">يحتوي على ${chapterData.length} أحاديث</p>`;
        card.onclick = () => openHadithChapter(index);
        chaptersGrid.appendChild(card);
    });
    
    showHadithChapters();
}

function openHadithChapter(chapterIndex) {
    currentChapterIndex = chapterIndex;
    currentChapterHadiths = currentChapters[chapterIndex];
    currentHadithIndex = 0;
    document.getElementById('current-chapter-title').innerText = `${currentBookName} ❖ الباب (${chapterIndex + 1})`;
    showSingleHadithViewer();
    renderCurrentSingleHadith();
}

function renderCurrentSingleHadith() {
    const wrapper = document.getElementById('single-hadith-wrapper');
    wrapper.innerHTML = '';
    const hadith = currentChapterHadiths[currentHadithIndex];
    const sourceName = currentHadithSource === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم';
    const cleanText = hadith.text.replace(/حدثنا/g, 'حَدَّثَنَا').replace(/رضي الله عنه/g, 'رَضِيَ اللَّهُ عَنْهُ');

    const card = document.createElement('div');
    card.className = 'hadith-item-card';
    card.innerHTML = `
        <div style="text-align: center;"><div class="hadith-item-info">📖 ${sourceName} | حديث رقم: ${hadith.hadithnumber}</div></div>
        <div style="font-family: 'Amiri', serif; font-size: 26px; color: #0F172A; margin-bottom: 30px;">
            ${formatHadithHtml(cleanText, false)}
        </div>
        <div class="hadith-actions-row"></div>
    `;

    const actionsRow = card.querySelector('.hadith-actions-row');
    
    const btnRead = document.createElement('button');
    btnRead.className = 'h-btn h-btn-read';
    btnRead.innerHTML = '📖 التخريج والشرح (الدرر السنية)';
    btnRead.onclick = function() {
        let dorarQuery = getHadithMatnForSearch(cleanText);
        window.open('https://dorar.net/hadith/search?q=' + encodeURIComponent(dorarQuery), '_blank');
    };

    const btnCopy = document.createElement('button');
    btnCopy.className = 'h-btn h-btn-copy';
    btnCopy.innerHTML = '📋 نسخ';
    btnCopy.onclick = function() { copyHadith(this, cleanText, sourceName, hadith.hadithnumber, currentBookName); };
    
    const btnImg = document.createElement('button');
    btnImg.className = 'h-btn h-btn-img';
    btnImg.innerHTML = '📤 تصميم صورة';
    btnImg.onclick = function() { exportHadithImage(cleanText, sourceName, hadith.hadithnumber, currentBookName); };

    actionsRow.appendChild(btnRead); 
    actionsRow.appendChild(btnCopy); 
    actionsRow.appendChild(btnImg); 
    wrapper.appendChild(card);

    document.getElementById('hadith-counter-display').innerText = `${currentHadithIndex + 1} / ${currentChapterHadiths.length}`;
    document.getElementById('btn-prev-hadith').disabled = (currentHadithIndex === 0);
    document.getElementById('btn-prev-hadith').style.opacity = (currentHadithIndex === 0) ? "0.5" : "1";
    document.getElementById('btn-next-hadith').disabled = (currentHadithIndex === currentChapterHadiths.length - 1);
    document.getElementById('btn-next-hadith').style.opacity = (currentHadithIndex === currentChapterHadiths.length - 1) ? "0.5" : "1";
}

function nextHadith() { if (currentHadithIndex < currentChapterHadiths.length - 1) { currentHadithIndex++; renderCurrentSingleHadith(); } }
function prevHadith() { if (currentHadithIndex > 0) { currentHadithIndex--; renderCurrentSingleHadith(); } }

// القفز الذكي للحديث من داخل البحث
window.jumpToHadithFromSearch = async function(source, hadithNumber) {
    if(typeof closeModals === 'function') closeModals();
    switchTab('hadith-view');
    
    if (currentHadithSource !== source || !currentHadithData) {
        document.getElementById('hadith-books-grid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-size: 20px; color: #10B981; font-weight: bold; padding: 40px;">جاري تجهيز الحديث... ⏳</div>';
        showHadithBooks();
        await loadHadithSource(source);
    }
    
    const targetHadith = currentHadithData.hadiths.find(h => h.hadithnumber == hadithNumber);
    if (!targetHadith) return showToast("عذراً، لم يتم العثور على الحديث.");
    
    const bookId = targetHadith.reference ? String(targetHadith.reference.book) : "1";
    const arBookName = getArabicBookNameByID(source, bookId);
    
    currentBookName = arBookName;
    document.getElementById('current-book-title').innerText = arBookName;
    
    const bookHadiths = currentHadithData.hadiths.filter(h => h.reference && h.reference.book == bookId);
    const chunkSize = 15;
    currentChapters = [];
    for (let i = 0; i < bookHadiths.length; i += chunkSize) {
        currentChapters.push(bookHadiths.slice(i, i + chunkSize));
    }
    
    let globalIndex = bookHadiths.findIndex(h => h.hadithnumber == hadithNumber);
    if (globalIndex === -1) globalIndex = 0;
    
    currentChapterIndex = Math.floor(globalIndex / chunkSize);
    currentHadithIndex = globalIndex % chunkSize;
    currentChapterHadiths = currentChapters[currentChapterIndex];
    
    document.getElementById('current-chapter-title').innerText = `${currentBookName} ❖ الباب (${currentChapterIndex + 1})`;
    showSingleHadithViewer();
    renderCurrentSingleHadith();
};

function copyHadith(btn, text, source, num, book) {
    let finalBook = book ? book : "";
    const fullText = `${text}\n[${source} ${finalBook ? "- " + finalBook : ""} - رقم ${num}]`;
    navigator.clipboard.writeText(fullText).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = "✅ تم النسخ";
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    });
}

function exportHadithImage(text, source, num, bookName) {
    if(window.isDownloadingOp) return showToast("عملية جارية بالفعل...");
    initSidePanel("تصميم صورة الحديث...");
    window.isDownloadingOp = true;

    let exportDiv = document.getElementById('export-hadith-canvas');
    if (exportDiv) exportDiv.remove();

    exportDiv = document.createElement('div');
    exportDiv.id = 'export-hadith-canvas';
    
    exportDiv.style.cssText = 'position: fixed; left: -3000px; top: 0; width: 1080px; min-height: 1080px; background: linear-gradient(135deg, #022c22 0%, #064e3b 100%); display: flex; flex-direction: column; padding: 40px; box-sizing: border-box; direction: rtl; z-index: -9999; color: #FFFFFF;';

    let dynamicFontSize = 65, dynamicLineHeight = 1.8;
    if (text.length > 700) { dynamicFontSize = 36; dynamicLineHeight = 1.6; } 
    else if (text.length > 500) { dynamicFontSize = 42; dynamicLineHeight = 1.6; } 
    else if (text.length > 350) { dynamicFontSize = 48; dynamicLineHeight = 1.6; } 
    else if (text.length > 200) { dynamicFontSize = 55; dynamicLineHeight = 1.7; } 
    else if (text.length > 100) { dynamicFontSize = 60; dynamicLineHeight = 1.7; }

    exportDiv.innerHTML = `
        <div style="flex: 1; width: 100%; border: 4px solid #10B981; border-radius: 30px; padding: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: rgba(2, 44, 34, 0.8); box-shadow: inset 0 0 50px rgba(0,0,0,0.5); box-sizing: border-box;">
            <div style="font-family: 'Aref Ruqaa', serif; font-size: 50px; color: #10B981; background: rgba(0, 0, 0, 0.4); padding: 15px 60px; border-radius: 50px; border: 1px solid #10B981; margin-bottom: 50px;">قَالَ رَسُولُ اللَّهِ ﷺ</div>
            
            <div style="font-family: 'Amiri', serif; font-size: ${dynamicFontSize}px; line-height: ${dynamicLineHeight}; width: 100%; margin: 0 0 50px 0;">
                ${formatHadithHtml(text, true)}
            </div>
            
            <div style="color: #67E8F9; font-size: 32px; font-weight: bold; margin-bottom: 20px; font-family: 'Tajawal', sans-serif; background: rgba(0,0,0,0.3); padding: 15px 40px; border-radius: 20px; border: 1px solid rgba(103, 232, 249, 0.3);">${source} ${bookName ? "❖ " + bookName : ""} (رقم: ${num})</div>
            
            <div style="font-family: 'Tajawal', sans-serif; font-size: 38px; font-weight: 800; color: #94A3B8; direction: rtl; display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: auto; padding-top: 40px;">
                <bdi style="color:#FFFFFF;">مصحف سَمِيع</bdi><span style="color:#10B981; margin:0 15px;">❖</span><bdi style="color:#FFFFFF;">قسم الأحاديث النبوية</bdi>
            </div>
        </div>
    `;
    
    document.body.appendChild(exportDiv);
    
    let spText = document.getElementById('side-panel-text');
    if(spText) spText.innerText = "جاري معالجة التصميم الإحترافي...";
    
    let spBar = document.getElementById('side-panel-bar');
    if(spBar) spBar.style.width = '40%';
    
    setTimeout(() => {
        if (typeof html2canvas !== 'undefined') {
            html2canvas(exportDiv, { scale: 2, useCORS: true, backgroundColor: '#022c22' }).then(canvas => {
                if(spBar) spBar.style.width = '80%';
                if(spText) spText.innerText = "تجهيز الصورة...";
                
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
                if(spText) spText.innerText = "فشل التصميم!"; 
                window.isDownloadingOp = false; 
                exportDiv.remove();
            });
        } else {
            showToast("مكتبة الصور غير متوفرة حالياً."); 
            window.isDownloadingOp = false; 
            exportDiv.remove();
        }
    }, 1200); 
}

// =========================================================
// 9. نظام الحفظ التلقائي الشامل (الاستئناف الكامل) - الحل الجذري
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    
    function saveAppFullState() {
        const riwayahSelect = document.getElementById('riwayah-select');
        const reciterSelect = document.getElementById('reciter-select') || document.getElementById('reciters-select');
        const surahSelect = document.getElementById('surah-select');
        const audioEl = document.getElementById('main-audio');
        const qContainer = document.getElementById('quran-text-container') || document.querySelector('.quran-text') || window;
        
        let currentScroll = qContainer.scrollTop || window.scrollY || document.documentElement.scrollTop;
        
        let sNum = (typeof window.currentSurahNumber !== 'undefined' && window.currentSurahNumber) 
                    ? window.currentSurahNumber 
                    : (surahSelect ? surahSelect.value : null);
        
        if (sNum) {
            const state = {
                surah: sNum,
                server: (typeof window.currentAudioServer !== 'undefined' && window.currentAudioServer) ? window.currentAudioServer : null,
                src: audioEl ? audioEl.src : null,
                time: (audioEl && !audioEl.paused) ? audioEl.currentTime : null,
                riwayah: riwayahSelect ? riwayahSelect.value : null,
                reciterValue: reciterSelect ? reciterSelect.value : null,
                scrollPos: currentScroll > 0 ? currentScroll : 0
            };
            localStorage.setItem('samee3_super_state', JSON.stringify(state));
        }
    }

    const scrollTarget = document.getElementById('quran-text-container') || document.querySelector('.quran-text') || window;
    let scrollTimer;
    scrollTarget.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(saveAppFullState, 500); 
    });

    const audioEl = document.getElementById('main-audio');
    if (audioEl) {
        audioEl.addEventListener('timeupdate', () => {
            if (Math.floor(audioEl.currentTime) % 3 === 0 && !audioEl.paused) {
                saveAppFullState();
            }
        });
    }
    
    const surahSelect = document.getElementById('surah-select');
    if (surahSelect) {
        surahSelect.addEventListener('change', () => {
            setTimeout(saveAppFullState, 1500); 
        });
    }

    setTimeout(() => {
        const savedStateStr = localStorage.getItem('samee3_super_state');
        if (savedStateStr) {
            try {
                const state = JSON.parse(savedStateStr);
                
                const riwayahSelect = document.getElementById('riwayah-select');
                const reciterSelect = document.getElementById('reciter-select') || document.getElementById('reciters-select'); 
                const surahSel = document.getElementById('surah-select');
                
                if (riwayahSelect && state.riwayah) {
                    riwayahSelect.value = state.riwayah;
                    riwayahSelect.dispatchEvent(new Event('change'));
                }
                
                setTimeout(() => {
                    if (reciterSelect && state.reciterValue) {
                        reciterSelect.value = state.reciterValue;
                        reciterSelect.dispatchEvent(new Event('change'));
                    }
                    
                    if (surahSel && state.surah) {
                        surahSel.value = state.surah;
                        surahSel.dispatchEvent(new Event('change'));
                        window.currentSurahNumber = state.surah;
                    }
                    
                    if (state.server) window.currentAudioServer = state.server;
                    
                    if (audioEl && state.src && state.time) {
                        audioEl.src = state.src;
                        audioEl.addEventListener('canplay', function resumePlay() {
                            if (Math.abs(audioEl.currentTime - state.time) > 2) { 
                                audioEl.currentTime = state.time; 
                            }
                            audioEl.removeEventListener('canplay', resumePlay);
                        });
                    }

                    if (state.scrollPos > 0) {
                        let attempts = 0;
                        const scrollInterval = setInterval(() => {
                            const qContainer = document.getElementById('quran-text-container') || document.querySelector('.quran-text') || window;
                            const currentHeight = qContainer.scrollHeight || document.documentElement.scrollHeight;
                            
                            if (currentHeight > state.scrollPos) {
                                qContainer.scrollTo({ top: state.scrollPos, behavior: 'auto' });
                                clearInterval(scrollInterval);
                            }
                            
                            attempts++;
                            if (attempts > 20) clearInterval(scrollInterval); 
                        }, 500);
                    }
                    
                }, 600); 
            } catch(e) { console.log('خطأ في استرجاع الحالة:', e); }
        }
    }, 1000); 
});

// =========================================================
// 10. دمج آيات القرآن مع شاشة القفل (Media Session API)
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    const audioEl = document.getElementById('main-audio');

    if ('mediaSession' in navigator && audioEl) {

        function updateLockScreenMetadata() {
            // 1. جلب اسم السورة من القائمة
            const surahSelect = document.getElementById('surah-select');
            let surahName = "مصحف سميع"; 
            if (surahSelect && surahSelect.options.length > 0 && surahSelect.selectedIndex >= 0) {
                surahName = surahSelect.options[surahSelect.selectedIndex].text;
            }

            // 2. جلب نص الآية الحالية التي يتم قراءتها
            // ملاحظة: تأكد من أن كلاس '.active' أو '.active-ayah' يطابق الكلاس المستخدم لتظليل الآيات لديك
            const activeAyahEl = document.querySelector('.active-ayah') ||
                                 document.querySelector('.active') ||
                                 document.querySelector('.playing-ayah') ||
                                 document.querySelector('.quran-text span.active');

            let currentAyahText = "جاري التلاوة...";
            if (activeAyahEl) {
                currentAyahText = activeAyahEl.innerText.replace(/[0-9٠-٩۝]/g, '').trim(); 
            } else {
                const reciterSelect = document.getElementById('reciter-select') || document.getElementById('reciters-select');
                if(reciterSelect) currentAyahText = reciterSelect.options[reciterSelect.selectedIndex].text;
            }

            // 3. حقن البيانات في شاشة القفل
            navigator.mediaSession.metadata = new MediaMetadata({
                title: surahName,         
                artist: currentAyahText,  
                album: "مصحف سميع",
                artwork: [
                    // يرجى تغيير 'logo.png' إلى مسار اللوجو الفعلي الخاص بمنصة مصحف سميع
                    { src: 'logo.png', sizes: '96x96', type: 'image/png' },
                    { src: 'logo.png', sizes: '128x128', type: 'image/png' },
                    { src: 'logo.png', sizes: '256x256', type: 'image/png' },
                    { src: 'logo.png', sizes: '512x512', type: 'image/png' }
                ]
            });
        }

        audioEl.addEventListener('play', updateLockScreenMetadata);
        
        audioEl.addEventListener('timeupdate', () => {
            if (Math.floor(audioEl.currentTime) % 1 === 0) {
                updateLockScreenMetadata();
            }
        });

        const surahSelect = document.getElementById('surah-select');
        if (surahSelect) {
            surahSelect.addEventListener('change', () => setTimeout(updateLockScreenMetadata, 1000));
        }
    }
});
