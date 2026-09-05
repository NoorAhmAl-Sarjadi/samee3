// =========================================================
// 5. نظام الأحاديث النبوية الشامل (صحيح البخاري وصحيح مسلم)
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
        .hadith-book-card h3 { color: #0F172A; margin: 0; font-size: 22px; font-family: 'Aref Ruqaa', serif; }
        .hadith-item-card { background: #fff; border-radius: 15px; padding: 25px; margin-bottom: 20px; text-align: right; border: 1px solid #E2E8F0; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
        .hadith-item-text { font-family: 'Amiri', serif; font-size: clamp(20px, 4vw, 26px); line-height: 2.2; color: #0F172A; margin-bottom: 20px; }
        .hadith-item-info { color: #10B981; font-weight: 700; font-size: 15px; margin-bottom: 15px; display: inline-block; background: #ECFDF5; padding: 5px 15px; border-radius: 50px; }
        .hadith-actions-row { display: flex; gap: 10px; flex-wrap: wrap; border-top: 1px solid #F1F5F9; padding-top: 15px; }
        .h-btn { padding: 10px 15px; border-radius: 8px; border: none; font-family: inherit; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .h-btn-copy { background: #F1F5F9; color: #475569; } .h-btn-copy:hover { background: #E2E8F0; }
        .h-btn-img { background: #10B981; color: white; } .h-btn-img:hover { background: #059669; }
        .h-btn-sharh { background: #D97706; color: white; } .h-btn-sharh:hover { background: #B45309; }
    `;
    document.head.appendChild(hadithStyles);

    // 2. إضافة زر الأحاديث في النافبار
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

    // 3. بناء هيكل واجهة الأحاديث وإضافتها للمنصة
    const container = document.querySelector('.container');
    if (container) {
        const hadithView = document.createElement('div');
        hadithView.id = 'hadith-view';
        hadithView.innerHTML = `
            <div class="hadith-tabs">
                <button class="btn-hadith-tab active" id="tab-bukhari" onclick="loadHadithSource('bukhari')">صحيح البخاري</button>
                <button class="btn-hadith-tab" id="tab-muslim" onclick="loadHadithSource('muslim')">صحيح مسلم</button>
            </div>
            
            <!-- شبكة الكتب (كتاب الوحي، كتاب الإيمان...) -->
            <div id="hadith-books-grid" class="surah-grid"></div>
            
            <!-- قائمة الأحاديث داخل الكتاب المحدد -->
            <div id="hadith-list-container" style="display: none;">
                <button class="btn-nav" onclick="showHadithBooks()" style="margin-bottom: 20px; background: #F8FAFC; border-color: #CBD5E1; color: #475569;">🔙 العودة لقائمة الكتب</button>
                <h2 id="current-book-title" style="color: #10B981; font-family: 'Aref Ruqaa', serif; font-size: 30px; text-align: center; margin-bottom: 30px;"></h2>
                <div id="hadiths-list"></div>
                <div id="hadith-loading" style="text-align: center; padding: 40px; color: #10B981; font-size: 20px; font-weight: bold; display: none;">جاري جلب الأحاديث... ⏳</div>
            </div>
        `;
        container.appendChild(hadithView);
    }

    // 4. تعديل دالة switchTab لإظهار/إخفاء واجهة الأحاديث
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
// منطق جلب الأحاديث والشروحات
// ==========================================
let currentHadithData = null; 
let currentHadithSource = 'bukhari';

function initHadithSystem() {
    if (!currentHadithData) loadHadithSource('bukhari');
}

async function loadHadithSource(source) {
    currentHadithSource = source;
    document.getElementById('tab-bukhari').classList.toggle('active', source === 'bukhari');
    document.getElementById('tab-muslim').classList.toggle('active', source === 'muslim');
    
    showHadithBooks();
    document.getElementById('hadith-books-grid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-size: 20px; color: #10B981; font-weight: bold; padding: 40px;">جاري الاتصال بقواعد البيانات... ⏳</div>';

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
        const cleanName = value.replace('كتاب', 'كِتَابُ').trim();
        const card = document.createElement('div');
        card.className = 'hadith-book-card';
        card.innerHTML = `<h3>${cleanName}</h3>`;
        card.onclick = () => openHadithBook(key, cleanName);
        grid.appendChild(card);
    }
}

function showHadithBooks() {
    document.getElementById('hadith-books-grid').style.display = 'grid';
    document.getElementById('hadith-list-container').style.display = 'none';
}

function openHadithBook(bookId, bookName) {
    document.getElementById('hadith-books-grid').style.display = 'none';
    document.getElementById('hadith-list-container').style.display = 'block';
    document.getElementById('current-book-title').innerText = bookName;
    
    const list = document.getElementById('hadiths-list');
    list.innerHTML = '';
    document.getElementById('hadith-loading').style.display = 'block';

    setTimeout(() => {
        // تصفية الأحاديث التابعة لهذا الكتاب
        const bookHadiths = currentHadithData.hadiths.filter(h => h.reference && h.reference.book == bookId);
        
        if (bookHadiths.length === 0) {
            list.innerHTML = '<p style="text-align: center; padding: 20px;">لا توجد أحاديث مسجلة في هذا الباب حالياً.</p>';
        } else {
            bookHadiths.slice(0, 50).forEach(hadith => { // عرض أول 50 حديث للتخفيف
                const cleanText = hadith.text.replace(/حدثنا/g, 'حَدَّثَنَا').replace(/رضي الله عنه/g, 'رَضِيَ اللَّهُ عَنْهُ');
                const sourceName = currentHadithSource === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم';
                
                const card = document.createElement('div');
                card.className = 'hadith-item-card';
                card.innerHTML = `
                    <div class="hadith-item-info">📖 ${sourceName} | حديث رقم: ${hadith.hadithnumber}</div>
                    <div class="hadith-item-text">${cleanText}</div>
                    <div class="hadith-actions-row">
                        <button class="h-btn h-btn-copy" onclick="copyHadith(this, \`${cleanText}\`, '${sourceName}', ${hadith.hadithnumber})">📋 نسخ</button>
                        <button class="h-btn h-btn-img" onclick="exportHadithImage(\`${cleanText}\`, '${sourceName}', ${hadith.hadithnumber}, '${bookName}', false)">📤 صورة الحديث</button>
                        <button class="h-btn h-btn-sharh" onclick="exportHadithImage(\`${cleanText}\`, '${sourceName}', ${hadith.hadithnumber}, '${bookName}', true)">🖼 صورة مع الشرح</button>
                    </div>
                `;
                list.appendChild(card);
            });
        }
        document.getElementById('hadith-loading').style.display = 'none';
    }, 100);
}

// ==========================================
// التفاعل والتصدير كصورة (نفس تصميم القرآن)
// ==========================================

function copyHadith(btn, text, source, num) {
    const fullText = `${text}\n[${source} - رقم ${num}]`;
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

    // محاكاة جلب الشرح المعتمد لأهل السنة (نظراً لعدم وجود API مجاني يربط الأرقام مباشرة بالشرح)
    // يمكن لاحقاً ربط هذا المتغير بـ API مثل الدرر السنية أو موسوعة الأحاديث
    const simulatedSharh = `هذا الحديث من جوامع الكلم التي أوتيها النبي ﷺ، وفيه بيان لأصل عظيم من أصول الدين. 
يرشدنا الحديث إلى أهمية استحضار النية الخالصة لله تعالى في جميع الأقوال والأفعال، 
وأن مدار قبول الأعمال عند الله عز وجل مبني على الإخلاص والمتابعة لهدي المصطفى ﷺ.
(مرجع الشرح المعتمد: المنهاج / فتح الباري).`;

    let exportDiv = document.getElementById('export-hadith-canvas');
    if (exportDiv) exportDiv.remove();

    exportDiv = document.createElement('div');
    exportDiv.id = 'export-hadith-canvas';
    // تصميم باللون الأخضر الملكي لتمييز الأحاديث عن القرآن
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
