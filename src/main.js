import './style.css';
import { watchAuth, login, register, resetPassword, logout, ensureUser, isAdmin, getSiteConfig, setSiteConfig, getUserSettings, setUserSettings, saveBookmark, removeBookmark, listBookmarks } from './firebase.js';

const RIWAYAT = {
  hafs: {label:'حفص عن عاصم', json:'/data/riwayat/hafs/data/hafsData_v18.json', font:'/data/riwayat/hafs/font/hafs.18.woff2'},
  warsh: {label:'ورش عن نافع', json:'/data/riwayat/warsh/data/warshData_v10.json', font:'/data/riwayat/warsh/font/warsh.10.woff2'},
  qaloon:{label:'قالون عن نافع', json:'/data/riwayat/qaloon/data/QaloonData_v10.json', font:'/data/riwayat/qaloon/font/qaloon.10.woff2'},
  doori: {label:'الدوري عن أبي عمرو', json:'/data/riwayat/doori/data/DooriData_v09.json', font:'/data/riwayat/doori/font/doori.9.woff2'},
  soosi: {label:'السوسي عن أبي عمرو', json:'/data/riwayat/soosi/data/SoosiData09.json', font:'/data/riwayat/soosi/font/soosi.9.woff2'},
  shouba:{label:'شعبة عن عاصم', json:'/data/riwayat/shouba/data/ShoubaData08.json', font:'/data/riwayat/shouba/font/shouba.8.woff2'}
};

const SURA_NAMES = ['الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'];
const JUZ_START = {1:[1,1],2:[2,142],3:[2,253],4:[3,93],5:[4,24],6:[4,148],7:[5,82],8:[6,111],9:[7,88],10:[8,41],11:[9,93],12:[11,6],13:[12,53],14:[15,1],15:[17,1],16:[18,75],17:[21,1],18:[23,1],19:[25,21],20:[27,56],21:[29,46],22:[33,31],23:[36,28],24:[39,32],25:[41,47],26:[46,1],27:[51,31],28:[58,1],29:[67,1],30:[78,1]};

const API = 'https://www.mp3quran.net/api/v3';
const HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
const TAFSIR_API = 'https://quranenc.com/api/v1';
const ADHKAR_URL = 'https://raw.githubusercontent.com/asellam/HisnElMuslim/main/hisn.json';

const state = {
  view: localStorage.getItem('s3.view') || 'mushaf',
  page: Number(localStorage.getItem('s3.page') || 1),
  riwaya: localStorage.getItem('s3.riwaya') || 'hafs',
  sura: Number(localStorage.getItem('s3.sura') || 1),
  fontSize: Number(localStorage.getItem('s3.fontSize') || 26),
  theme: localStorage.getItem('s3.theme') || 'paper',
  quranCache: new Map(),
  reciters: [],
  selected: null,
  timings: [],
  audio: new Audio(),
  playing: false,
  user: null,
  admin: false,
  config: {siteName:'مصحف سميع', tagline:'القرآن برواياته، بتلاوته، بتدبره'},
  modal: false,
  indexFilter: '',
  readerFilter: '',
  readerRiwaya: '',
  hadithBooks: [],
  hadithBook: 'all',
  adhkar: null,
  bookmarks: []
};

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar = n => String(n ?? '').replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const normalizeArabic = t => String(t||'').replace(/[\u064B-\u065F\u0670]/g,'').replace(/ٱ/g,'ا');

function saveLocal(){
  localStorage.setItem('s3.view',state.view);
  localStorage.setItem('s3.page',state.page);
  localStorage.setItem('s3.sura',state.sura);
  localStorage.setItem('s3.riwaya',state.riwaya);
  localStorage.setItem('s3.fontSize',state.fontSize);
  localStorage.setItem('s3.theme',state.theme);
  if(state.user) setUserSettings(state.user.uid,{page:state.page,sura:state.sura,riwaya:state.riwaya,fontSize:state.fontSize,theme:state.theme}).catch(()=>{});
}

function injectFont(){
  let style = $('#samee-quran-font');
  if(!style){style=document.createElement('style');style.id='samee-quran-font';document.head.appendChild(style);}
  style.textContent = `@font-face{font-family:SameeQuran;src:url('${RIWAYAT[state.riwaya].font}') format('woff2');font-display:swap;font-weight:400}.quran-page,.quran-page *{font-family:SameeQuran,serif}`;
}

async function fetchJSON(url,opts={}){
  const res = await fetch(url,opts);
  if(!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function normAyah(row){
  return {
    id: row.id,
    page: Number(row.page || 1),
    sura: Number(row.sora ?? row.sura_no ?? row.sura),
    ayah: Number(row.aya_no ?? row.ayah_no ?? row.aya ?? row.ayah),
    text: row.aya_text ?? row.ayah_text ?? '',
    lineStart: Number(row.line_start ?? row.line ?? 1),
    lineEnd: Number(row.line_end ?? row.line_start ?? row.line ?? 1),
    juz: Number(row.jozz ?? row.juz ?? 1)
  };
}

async function loadRiwaya(){
  if(state.quranCache.has(state.riwaya)) return state.quranCache.get(state.riwaya);
  const raw = await fetchJSON(RIWAYAT[state.riwaya].json);
  const rows = Array.isArray(raw) ? raw.map(normAyah) : [];
  state.quranCache.set(state.riwaya,rows);
  injectFont();
  return rows;
}

async function pageRows(page){
  const rows=await loadRiwaya();
  return rows.filter(x=>x.page===page);
}

function groupPage(rows){
  const groups = new Map();
  for(const row of rows){
    const key=row.lineStart || 1;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([line,items])=>({line,items}));
}

function surahFirstPage(sura){
  const positions = {1:1,2:2,3:50,4:77,5:106,6:128,7:151,8:177,9:187,10:208,11:221,12:235,13:249,14:255,15:262,16:267,17:282,18:293,19:305,20:312,21:322,22:332,23:342,24:350,25:359,26:367,27:377,28:385,29:396,30:404,31:411,32:415,33:418,34:428,35:434,36:440,37:446,38:453,39:458,40:467,41:477,42:483,43:489,44:496,45:499,46:502,47:507,48:511,49:515,50:518,51:520,52:523,53:526,54:528,55:531,56:534,57:537,58:542,59:545,60:548,61:551,62:553,63:554,64:556,65:558,66:560,67:562,68:564,69:566,70:568,71:570,72:572,73:574,74:575,75:577,76:578,77:580,78:582,79:583,80:585,81:586,82:587,83:588,84:589,85:590,86:591,87:592,88:593,89:594,90:595,91:595,92:596,93:597,94:597,95:598,96:598,97:599,98:599,99:600,100:600,101:600,102:601,103:601,104:601,105:602,106:602,107:602,108:603,109:603,110:603,111:603,112:604,113:604,114:604};
  return positions[sura]||1;
}

function layout(){
  const navItems=[['mushaf','المصحف'],['index','الفهرس'],['library','المكتبة السمعية'],['tafsir','التفسير'],['hadith','الأحاديث'],['adhkar','الأذكار'],['tools','أدوات المسلم'],['settings','الإعدادات']];
  document.title=state.config.siteName || 'مصحف سميع';
  $('#app').innerHTML=`
  <div class="shell" data-theme="${esc(state.theme)}">
    <header class="topbar">
      <button class="round-btn" id="menuBtn" aria-label="القائمة">☰</button>
      <div class="top-title"><img src="/assets/samee3-logo.png" alt=""/><div><b>${esc(state.config.siteName)}</b><small>${esc(state.config.tagline)}</small></div></div>
      <button class="round-btn" id="searchBtn" aria-label="البحث">⌕</button>
    </header>
    <div id="searchPanel" class="search-panel"><div class="search-box"><span>⌕</span><input id="globalSearch" placeholder="بحث: الصفحة، السورة، القارئ، الحديث أو التفسير"/></div><div id="globalSearchResults"></div></div>
    <main id="content"></main>
    <nav class="bottom-nav">${navItems.map(([v,l])=>`<button data-nav="${v}" class="${state.view===v?'active':''}"><span class="nav-icon">${navIcon(v)}</span><span>${l}</span></button>`).join('')}${state.admin?`<button data-nav="admin" class="${state.view==='admin'?'active':''}"><span class="nav-icon">⚙</span><span>الإدارة</span></button>`:''}</nav>
    <div id="modal" class="modal"></div><div id="toast" class="toast"></div>
  </div>`;
  $('#menuBtn').onclick=openMenu;
  $('#searchBtn').onclick=()=>$('#searchPanel').classList.toggle('open');
  $('#globalSearch').oninput=e=>globalSearch(e.target.value);
  $$('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
}
function navIcon(v){return ({mushaf:'▤',index:'☷',library:'◉',tafsir:'✎',hadith:'▱',adhkar:'✧',tools:'▦',settings:'⚙',admin:'⚙'})[v]||'•';}
function navigate(v){state.view=v;saveLocal();render();}

async function render(){
  layout();
  injectFont();
  document.documentElement.style.setProperty('--q-size',state.fontSize+'px');
  const content=$('#content');
  try{
    if(state.view==='mushaf') await renderMushaf(content);
    else if(state.view==='index') await renderIndex(content);
    else if(state.view==='library') await renderLibrary(content);
    else if(state.view==='tafsir') await renderTafsirPage(content);
    else if(state.view==='hadith') await renderHadith(content);
    else if(state.view==='adhkar') await renderAdhkar(content);
    else if(state.view==='tools') renderTools(content);
    else if(state.view==='settings') renderSettings(content);
    else if(state.view==='admin') await renderAdmin(content);
    else await renderMushaf(content);
  }catch(err){
    content.innerHTML=`<section class="section"><div class="error-card"><b>حدث خطأ في تحميل هذه الصفحة.</b><p>${esc(err.message)}</p><button class="gold-btn" onclick="location.reload()">إعادة المحاولة</button></div></section>`;
  }
}

async function renderMushaf(root){
  let rows=[];
  try{rows=await pageRows(state.page);}catch(err){
    root.innerHTML=`<section class="section centered"><img class="error-logo" src="/assets/samee3-logo.png"/><h2>تعذر تحميل صفحة المصحف</h2><p>تأكد من رفع ملفات الروايات داخل public/data/riwayat.</p><button class="gold-btn" onclick="location.reload()">إعادة المحاولة</button></section>`;return;
  }
  if(rows.length){state.sura=rows[0].sura;saveLocal();}
  const first=rows[0]||{juz:1,sura:state.sura};
  const grouped=groupPage(rows);
  root.innerHTML=`<section class="mushaf-screen">
    <div class="mushaf-toolbar">
      <button class="toolbar-side" data-reader="surah">${esc(SURA_NAMES[state.sura-1]||'المصحف')} <span>‹</span></button>
      <button class="toolbar-grid" data-reader="index">▦</button>
      <button class="toolbar-side" data-reader="juz">الجزء ${ar(first.juz||1)} <span>›</span></button>
    </div>
    <div class="mushaf-page-wrap">
      <div class="mushaf-page">
        <div class="page-border"></div>
        <div class="page-meta"><span>${esc(SURA_NAMES[state.sura-1]||'')}</span><span>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span><span>${ar(state.page)}</span></div>
        <div class="quran-page" id="quranPage">${grouped.map(g=>`<div class="qline">${g.items.map(r=>`<span class="ayah" data-id="${r.id}" data-ayah="${r.ayah}" data-sura="${r.sura}">${esc(r.text)}</span>`).join(' ')}</div>`).join('')}</div>
        <div class="page-footer"><span>الجزء ${ar(first.juz||1)}</span><span class="page-no">${ar(state.page)}</span><span>${esc(RIWAYAT[state.riwaya].label)}</span></div>
      </div>
    </div>
    <div class="mushaf-control-row">
      <button data-action="prev" ${state.page<=1?'disabled':''}>‹</button>
      <button data-action="bookmark">☆</button>
      <button class="play-main" data-action="play">${state.playing?'Ⅱ':'▶'}</button>
      <button data-action="font">A</button>
      <button data-action="next" ${state.page>=604?'disabled':''}>›</button>
    </div>
    <div class="reader-status"><span>${esc(RIWAYAT[state.riwaya].label)}</span><b>صفحة ${ar(state.page)}</b><span>${state.selected?esc(state.selected.name):'اختر قارئًا من المكتبة'}</span></div>
  </section>`;
  $('#content').onclick=async e=>{
    const ayah=e.target.closest('.ayah');
    if(ayah){const row=rows.find(x=>String(x.id)===ayah.dataset.id);if(row)openAyahSheet(row);return;}
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='prev') return setPage(state.page-1);
    if(action==='next') return setPage(state.page+1);
    if(action==='play') return toggleSurahAudio();
    if(action==='bookmark') return bookmarkCurrentPage();
    if(action==='font') return openDisplaySettings();
    const r=e.target.closest('[data-reader]')?.dataset.reader;
    if(r==='index')return navigate('index');
    if(r==='surah')return openJump('surah');
    if(r==='juz')return openJump('juz');
  };
  bindSwipe($('#quranPage'));
}
function bindSwipe(el){if(!el)return;let x=0;el.addEventListener('pointerdown',e=>x=e.clientX);el.addEventListener('pointerup',e=>{const dx=e.clientX-x;if(Math.abs(dx)>60)setPage(state.page+(dx<0?1:-1));});}
async function setPage(page){state.page=Math.max(1,Math.min(604,Number(page)||1));state.view='mushaf';saveLocal();await render();window.scrollTo({top:0,behavior:'smooth'});}

function openJump(kind='surah'){
  const surahOptions=SURA_NAMES.map((n,i)=>`<option value="${i+1}" ${i+1===state.sura?'selected':''}>${ar(i+1)} — ${n}</option>`).join('');
  const juzOptions=Object.keys(JUZ_START).map(j=>`<option value="${j}">الجزء ${ar(j)}</option>`).join('');
  openModal(`<div class="modal-title">الانتقال</div><div class="segmented"><button data-jump-tab="surah" class="${kind==='surah'?'active':''}">السورة</button><button data-jump-tab="page" class="${kind==='page'?'active':''}">الصفحة</button><button data-jump-tab="juz" class="${kind==='juz'?'active':''}">الجزء</button></div><div id="jump-body">${kind==='page'?`<label>رقم الصفحة<input id="jump-page" type="number" min="1" max="604" value="${state.page}"/></label>`:kind==='juz'?`<label>الجزء<select id="jump-juz">${juzOptions}</select></label>`:`<label>السورة<select id="jump-sura">${surahOptions}</select></label>`}<button id="jumpGo" class="gold-btn wide">فتح</button></div>`);
  $$('[data-jump-tab]').forEach(b=>b.onclick=()=>openJump(b.dataset.jumpTab));
  $('#jumpGo').onclick=()=>{if($('#jump-page'))return closeModal(),setPage(Number($('#jump-page').value));if($('#jump-sura')){const s=Number($('#jump-sura').value);state.sura=s;return closeModal(),setPage(surahFirstPage(s));}const j=Number($('#jump-juz').value);const [s]=JUZ_START[j];state.sura=s;closeModal();setPage(surahFirstPage(s));};
}
function openDisplaySettings(){
  openModal(`<div class="modal-title">خيارات القراءة</div><label>حجم الخط<input id="fontSlider" type="range" min="18" max="38" value="${state.fontSize}"></label><div class="range-value">${ar(state.fontSize)}px</div><label>الرواية<select id="riwayaSelect">${Object.entries(RIWAYAT).map(([k,v])=>`<option value="${k}" ${k===state.riwaya?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label><label>المظهر<select id="themeSelect"><option value="paper">ورقي دافئ</option><option value="light">فاتح</option><option value="dark">ليلي</option></select></label>`);
  $('#fontSlider').oninput=e=>{state.fontSize=Number(e.target.value);document.documentElement.style.setProperty('--q-size',state.fontSize+'px');$('.range-value').textContent=ar(state.fontSize)+'px';saveLocal();};
  $('#riwayaSelect').onchange=async e=>{state.riwaya=e.target.value;state.quranCache.delete(state.riwaya);injectFont();saveLocal();closeModal();await render();};
  $('#themeSelect').value=state.theme;$('#themeSelect').onchange=e=>{state.theme=e.target.value;saveLocal();closeModal();render();};
}

async function openAyahSheet(row){
  openModal(`<div class="ayah-sheet"><div class="sheet-kicker">${esc(SURA_NAMES[row.sura-1])} · آية ${ar(row.ayah)}</div><div class="sheet-text">${esc(row.text)}</div><div class="sheet-actions"><button data-sheet="copy">نسخ</button><button data-sheet="share">مشاركة</button><button data-sheet="image">تصميم صورة</button><button data-sheet="image-tafsir">صورة + تفسير</button><button data-sheet="tafsir">التفسير</button><button data-sheet="repeat">تكرار الآية</button><button data-sheet="play">استماع</button><button data-sheet="bookmark">حفظ</button></div><div id="sheetResult"></div></div>`);
  $('#modal').onclick=async e=>{
    const action=e.target.closest('[data-sheet]')?.dataset.sheet;if(!action)return;
    if(action==='copy'){await copyText(row.text);toast('تم نسخ الآية');}
    if(action==='share'){await shareText(`سورة ${SURA_NAMES[row.sura-1]} — آية ${row.ayah}\n${row.text}`);}
    if(action==='tafsir'){await showAyahTafsir(row);}
    if(action==='repeat'){openRepeat(row);}
    if(action==='play'){await playAyah(row);}
    if(action==='bookmark'){if(!state.user){return openAuth();}await saveBookmark(state.user.uid,{id:`ayah-${state.riwaya}-${row.sura}-${row.ayah}`,type:'ayah',sura:row.sura,ayah:row.ayah,page:row.page,text:row.text,riwaya:state.riwaya});toast('تم حفظ الآية');}
    if(action==='image'||action==='image-tafsir'){await renderAyahCard(row,action==='image-tafsir');}
  };
}
async function copyText(text){if(navigator.clipboard)await navigator.clipboard.writeText(text);else toast('النسخ غير متاح في هذا المتصفح');}
async function shareText(text){if(navigator.share){try{await navigator.share({title:'مصحف سميع',text});return;}catch{}}await copyText(text);toast('تم نسخ المحتوى للمشاركة');}
async function showAyahTafsir(row){const box=$('#sheetResult');box.innerHTML='<div class="loading">جاري تحميل التفسير الميسر…</div>';try{const d=await fetchJSON(`${TAFSIR_API}/translation/aya/arabic_moyassar/${row.sura}/${row.ayah}`);const x=Array.isArray(d)?d[0]:d;box.innerHTML=`<article class="tafsir-box"><h3>التفسير الميسر</h3><p>${esc(x?.translation||x?.text||'لا يوجد نص')}</p><small>المصدر: QuranEnc — التفسير الميسر</small></article>`;}catch{box.innerHTML='<div class="error-card">تعذر تحميل التفسير حاليًا.</div>';}}
function openRepeat(row){openModal(`<div class="modal-title">تكرار الآية</div><div class="repeat-grid">${[1,2,3,5,10,20].map(n=>`<button data-repeat="${n}">${ar(n)} ×</button>`).join('')}</div><label>عدد التكرارات<input id="repeatCustom" type="number" min="1" value="3"></label><button class="gold-btn wide" id="repeatStart">بدء التكرار</button>`);$$('[data-repeat]').forEach(b=>b.onclick=()=>{$('#repeatCustom').value=b.dataset.repeat;});$('#repeatStart').onclick=async()=>{const n=Math.max(1,Number($('#repeatCustom').value)||1);closeModal();await playAyah(row,n);};}
async function playAyah(row,count=1){
  if(!state.selected){toast('اختر قارئًا من المكتبة السمعية أولًا');state.view='library';await render();return;}
  const a=state.audio;a.src=audioUrl(state.selected.server,row.sura);state.playing=true;try{await a.play();}catch{toast('تعذر تشغيل الصوت');return;}
  if(count>1){let i=0;const original=a.onended;a.onended=async()=>{i++;if(i<count){a.currentTime=0;try{await a.play();}catch{} } else {a.onended=original;state.playing=false;}};}
  toast(count>1?`بدأ تكرار الآية ${ar(count)} مرات`:'بدأت التلاوة');
}
function audioUrl(server,sura){return `${server}${String(sura).padStart(3,'0')}.mp3`;}
async function toggleSurahAudio(){if(!state.selected){state.view='library';await render();toast('اختر قارئًا أولًا');return;}if(state.audio.paused){state.audio.src=audioUrl(state.selected.server,state.sura);try{await state.audio.play();state.playing=true;}catch{toast('تعذر تشغيل الصوت');}}else{state.audio.pause();state.playing=false;}render();}
function bookmarkCurrentPage(){if(!state.user){openAuth();return;}saveBookmark(state.user.uid,{id:`page-${state.page}-${state.riwaya}`,type:'page',page:state.page,riwaya:state.riwaya,sura:state.sura}).then(()=>toast('تم حفظ الصفحة')).catch(()=>toast('تعذر الحفظ الآن'));}

async function renderIndex(root){
  const q=state.indexFilter;
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>المصحف الشريف</span><h1>الفهرس</h1><p>السور والأجزاء والمواضع المحفوظة</p></div><button class="small-gold" data-open-jump>انتقال</button></div><div class="search-box large"><span>⌕</span><input id="surahSearch" placeholder="بحث في أسماء السور" value="${esc(q)}"></div><div class="juz-strip">${Object.keys(JUZ_START).map(j=>`<button data-juz="${j}">${ar(j)}</button>`).join('')}</div><div class="surah-list">${SURA_NAMES.map((name,i)=>({name,id:i+1})).filter(s=>!q||normalizeArabic(s.name).includes(normalizeArabic(q))).map(s=>`<button class="surah-item" data-sura="${s.id}"><span class="number-badge">${ar(s.id)}</span><span><b>${esc(s.name)}</b><small>رقمها ${ar(s.id)} · ${s.id<=86?'مكية':'مدنية'}</small></span><span class="chev">‹</span></button>`).join('')}</div></section>`;
  $('#surahSearch').oninput=e=>{state.indexFilter=e.target.value;renderIndex(root);};
  $('#content').onclick=e=>{const b=e.target.closest('[data-sura]');if(b){const s=Number(b.dataset.sura);state.sura=s;return setPage(surahFirstPage(s));}const j=e.target.closest('[data-juz]');if(j){const [s]=JUZ_START[j.dataset.juz];state.sura=s;return setPage(surahFirstPage(s));}if(e.target.closest('[data-open-jump]'))openJump('surah');};
}

async function loadReciters(){
  try{const d=await fetchJSON(`${API}/reciters?language=ar`);state.reciters=(d.reciters||[]).flatMap(r=>(r.moshaf||[]).map(m=>({reciterId:r.id,name:r.name,letter:r.letter,moshafId:m.id,moshafName:m.name,server:m.server,surahTotal:m.surah_total,surahList:String(m.surah_list||'').split(',').filter(Boolean).map(Number),type:m.moshaf_type||'',rewaya:detectRiwaya(m.name)})));}
  catch{state.reciters=[];}
}
function detectRiwaya(name){const n=String(name||'');if(n.includes('ورش'))return 'warsh';if(n.includes('قالون'))return 'qaloon';if(n.includes('الدوري'))return 'doori';if(n.includes('السوسي'))return 'soosi';if(n.includes('شعبة'))return 'shouba';return 'hafs';}
async function renderLibrary(root){
  if(!state.reciters.length)await loadReciters();
  const list=state.reciters.filter(r=>(!state.readerFilter||`${r.name} ${r.moshafName}`.includes(state.readerFilter))&&(!state.readerRiwaya||r.rewaya===state.readerRiwaya));
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>مكتبة صوت القرآن</span><h1>المكتبة السمعية</h1><p>القراء والتلاوات من MP3Quran</p></div><div class="live-dot">● مباشر</div></div><div class="search-box large"><span>⌕</span><input id="readerSearch" placeholder="ابحث عن القارئ أو التلاوة" value="${esc(state.readerFilter)}"></div><div class="chips"><button class="${!state.readerRiwaya?'active':''}" data-r="">الكل</button>${Object.entries(RIWAYAT).map(([k,v])=>`<button class="${state.readerRiwaya===k?'active':''}" data-r="${k}">${esc(v.label.split(' ')[0])}</button>`).join('')}</div><div class="reader-list">${list.slice(0,400).map((r,i)=>`<button class="reader-item" data-ri="${i}"><span class="avatar">${esc((r.name||'ق').slice(0,1))}</span><span class="reader-copy"><b>${esc(r.name)}</b><small>${esc(r.moshafName)} · ${ar(r.surahTotal||0)} سورة</small></span><span class="play-mini">▶</span></button>`).join('')||`<div class="empty-card">تعذر جلب قائمة القراء الآن. أعد المحاولة لاحقًا.</div>`}</div><div class="source-note">المصدر: MP3Quran.net — يتم جلب البيانات مباشرة من الواجهة البرمجية للموقع.</div></section>`;
  $('#readerSearch').oninput=e=>{state.readerFilter=e.target.value;renderLibrary(root);};
  $$('.chips [data-r]').forEach(b=>b.onclick=()=>{state.readerRiwaya=b.dataset.r;renderLibrary(root);});
  $$('.reader-list [data-ri]').forEach(b=>b.onclick=async()=>{const idx=Number(b.dataset.ri);state.selected=list.slice(0,400)[idx];try{const t=await fetchJSON(`${API}/ayat_timing/reads`);void t;}catch{}toast(`تم اختيار ${state.selected.name}`);navigate('mushaf');});
}

async function renderTafsirPage(root){
  const sura=state.sura;root.innerHTML=`<section class="section"><div class="section-title"><div><span>التفسير الميسر</span><h1>${esc(SURA_NAMES[sura-1])}</h1><p>تفسير الآيات من المصدر المتاح عبر QuranEnc</p></div><button class="small-gold" data-back="mushaf">المصحف</button></div><div class="search-box large"><span>⌕</span><input id="tafsirAyahSearch" type="number" min="1" placeholder="رقم الآية"></div><div id="tafsirList" class="tafsir-list"><div class="loading">جاري تحميل التفسير…</div></div></section>`;
  const list=$('#tafsirList');try{const d=await fetchJSON(`${TAFSIR_API}/translation/sura/arabic_moyassar/${sura}`);const arr=Array.isArray(d)?d:(d?.result||d?.data||[]);list.innerHTML=arr.slice(0,400).map((x,i)=>`<article class="tafsir-row"><div class="tafsir-number">${ar(x.aya||x.ayah||x.id||i+1)}</div><p>${esc(x.translation||x.text||x.aya_text||'')}</p></article>`).join('')||'<div class="empty-card">لا توجد بيانات تفسير.</div>';}catch{list.innerHTML='<div class="error-card">تعذر تحميل التفسير الميسر حاليًا.</div>';}
  $('#tafsirAyahSearch').onchange=e=>{const n=Number(e.target.value);if(n){state.view='mushaf';render().then(()=>openAyahSheet({id:`manual-${sura}-${n}`,page:state.page,sura,ayah:n,text:`آية ${n}`}));}};
  $('[data-back]').onclick=()=>navigate('mushaf');
}

async function loadHadithBooks(){
  if(state.hadithBooks.length)return state.hadithBooks;
  try{const d=await fetchJSON(`${HADITH_API}/editions.json`);const out=[];for(const [k,meta] of Object.entries(d||{})){for(const item of (Array.isArray(meta?.collection)?meta.collection:[])){if(item?.language==='Arabic'&&String(item.name||'').startsWith('ara-'))out.push({id:String(item.name).slice(4),title:meta.name||k,author:item.author||''});}}state.hadithBooks=out;}
  catch{state.hadithBooks=[];}
  return state.hadithBooks;
}
async function renderHadith(root){
  const books=await loadHadithBooks();
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>السنة النبوية</span><h1>كتب الحديث</h1><p>اختر الكتاب وابحث في نصوصه مع المرجع المتاح من المصدر.</p></div></div><div class="hadith-tools"><select id="hadithBook"><option value="all">كل الكتب</option>${books.map(b=>`<option value="${esc(b.id)}" ${state.hadithBook===b.id?'selected':''}>${esc(b.title)}</option>`).join('')}</select><div class="search-box"><span>⌕</span><input id="hadithSearch" placeholder="ابحث في الحديث"></div><button class="gold-btn" id="hadithGo">بحث</button></div><div id="hadithResults" class="hadith-results"><div class="info-card">اختر كتابًا وابحث عن كلمة أو عبارة.</div></div><div class="source-note">مصدر البيانات الحالي: Hadith API المفتوح، مع الاحتفاظ باسم الكتاب والرقم والمرجع عند توفره.</div></section>`;
  $('#hadithGo').onclick=async()=>{const q=$('#hadithSearch').value.trim();state.hadithBook=$('#hadithBook').value;if(!q)return;$('#hadithResults').innerHTML='<div class="loading">جاري البحث…</div>';const chosen=state.hadithBook==='all'?books.slice(0,8):books.filter(b=>b.id===state.hadithBook);const results=[];for(const b of chosen){try{const d=await fetchJSON(`${HADITH_API}/editions/ara-${b.id}.json`);for(const h of (d.hadiths||[])){if(normalizeArabic(h.text).includes(normalizeArabic(q))){results.push({book:b.title,id:b.id,n:h.hadithnumber,text:h.text,reference:h.reference});if(results.length>=50)break;}}}catch{}if(results.length>=50)break;}$('#hadithResults').innerHTML=results.length?results.map(x=>`<article class="hadith-card"><b>${esc(x.book)}</b><p>${esc(x.text)}</p><small>رقم الحديث: ${esc(x.n)} ${x.reference?` · المرجع: ${esc(JSON.stringify(x.reference))}`:''}</small></article>`).join(''):'<div class="empty-card">لا توجد نتائج.</div>';};
}

async function renderAdhkar(root){
  if(!state.adhkar)try{state.adhkar=await fetchJSON(ADHKAR_URL);}catch{state.adhkar=[];}
  const arr=Array.isArray(state.adhkar)?state.adhkar:(state.adhkar?.content||state.adhkar?.adhkar||[]);
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>حصن المسلم</span><h1>الأذكار</h1><p>أذكار الصباح والمساء والأذكار اليومية.</p></div></div><div class="adhkar-tabs"><button class="active" data-cat="all">الكل</button><button data-cat="الصباح">الصباح</button><button data-cat="المساء">المساء</button><button data-cat="النوم">النوم</button></div><div class="adhkar-list">${arr.slice(0,300).map((x,i)=>{const text=typeof x==='string'?x:(x.text||x.zekr||x.content||'');const title=typeof x==='string'?`ذكر ${i+1}`:(x.title||x.category||`ذكر ${i+1}`);const count=x.count||x.repeat||1;return `<article class="dhikr-card"><div class="count">${ar(count)}×</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${x.reference?`<small>${esc(x.reference)}</small>`:''}<button data-count="${ar(count)}">تم</button></article>`}).join('')||'<div class="empty-card">تعذر تحميل الأذكار الآن.</div>'}</div></section>`;
  $$('.dhikr-card button').forEach(b=>b.onclick=()=>{b.textContent='✓';b.disabled=true;b.closest('.dhikr-card').classList.add('done');});
}

function renderTools(root){
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>خدمات يومية</span><h1>أدوات المسلم</h1><p>العبادة اليومية في مكان واحد.</p></div></div><div class="tool-hero"><div><span>الوقت المحلي</span><b id="clockNow">--:--</b><small>مصحف سميع</small></div><button class="gold-circle" id="locPrayer">صلاة</button></div><div class="tools-grid"><button data-tool="prayer"><b>مواقيت الصلاة</b><small>الفجر · الظهر · العصر · المغرب · العشاء</small></button><button data-tool="qibla"><b>القبلة</b><small>اتجاه القبلة من موقعك</small></button><button data-tool="adhkar"><b>الأذكار</b><small>حصن المسلم</small></button><button data-tool="tafsir"><b>التفسير</b><small>التفسير الميسر</small></button><button data-tool="stats"><b>إحصائيات القراءة</b><small>تقدمك اليومي</small></button><button data-tool="khatma"><b>الختمة</b><small>متابعة وردك</small></button></div><div id="toolResult"></div></section>`;
  const tick=()=>{const d=new Date();$('#clockNow').textContent=d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});};tick();setInterval(tick,1000);
  $$('.tools-grid [data-tool]').forEach(b=>b.onclick=()=>handleTool(b.dataset.tool));$('#locPrayer').onclick=()=>handleTool('prayer');
}
async function handleTool(type){const box=$('#toolResult');if(type==='adhkar')return navigate('adhkar');if(type==='tafsir')return navigate('tafsir');if(type==='stats'){box.innerHTML=`<div class="stats-card"><b>صفحتك الحالية</b><strong>${ar(state.page)}</strong><small>من 604 صفحة</small><div class="progress"><i style="width:${Math.max(1,state.page/604*100)}%"></i></div></div>`;return;}if(type==='khatma'){box.innerHTML=`<div class="stats-card"><b>الختمة</b><p>ابدأ من صفحتك الحالية وحدد وردًا يوميًا من الإعدادات.</p></div>`;return;}if(type==='qibla'){box.innerHTML=`<div class="qibla-card"><div class="compass">✦</div><b>اتجاه القبلة</b><p>السهم الدقيق يحتاج إذن الموقع واتجاه الجهاز من المتصفح.</p></div>`;return;}if(type==='prayer'){box.innerHTML='<div class="loading">جاري طلب الموقع…</div>';navigator.geolocation?.getCurrentPosition(async pos=>{try{const d=new Date();const ds=`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;const data=await fetchJSON(`https://api.aladhan.com/v1/timings/${ds}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=4`);const t=data.data?.timings||{};box.innerHTML=`<div class="prayer-card"><div class="prayer-head"><b>مواقيت اليوم</b><span>${esc(data.data?.date?.readable||'')}</span></div><div class="prayer-times">${[['الفجر',t.Fajr],['الشروق',t.Sunrise],['الظهر',t.Dhuhr],['العصر',t.Asr],['المغرب',t.Maghrib],['العشاء',t.Isha]].map(([n,v])=>`<div><span>${n}</span><b>${esc(v||'—')}</b></div>`).join('')}</div></div>`;}catch{box.innerHTML='<div class="error-card">تعذر جلب مواقيت الصلاة.</div>'; }},()=>box.innerHTML='<div class="error-card">لم يتم السماح بالموقع.</div>');}}

function renderSettings(root){
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>تخصيص التجربة</span><h1>الإعدادات</h1><p>إعدادات القراءة والحساب.</p></div></div><div class="settings-panel"><label>حجم خط المصحف<input id="settingsFont" type="range" min="18" max="38" value="${state.fontSize}"><output>${ar(state.fontSize)}</output></label><label>الرواية<select id="settingsRiwaya">${Object.entries(RIWAYAT).map(([k,v])=>`<option value="${k}" ${k===state.riwaya?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label><label>المظهر<select id="settingsTheme"><option value="paper">ورقي دافئ</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label>${state.user?`<div class="account-row"><span>${esc(state.user.email||'')}</span><button class="outline-btn" id="logout">تسجيل الخروج</button></div>`:`<button class="gold-btn wide" id="login">تسجيل الدخول</button>`}</div></section>`;
  $('#settingsTheme').value=state.theme;$('#settingsFont').oninput=e=>{state.fontSize=Number(e.target.value);e.target.nextElementSibling.value=ar(state.fontSize);document.documentElement.style.setProperty('--q-size',state.fontSize+'px');saveLocal();};$('#settingsRiwaya').onchange=e=>{state.riwaya=e.target.value;state.quranCache.delete(state.riwaya);saveLocal();render();};$('#settingsTheme').onchange=e=>{state.theme=e.target.value;saveLocal();render();};$('#logout')?.addEventListener('click',logout);$('#login')?.addEventListener('click',openAuth);}

async function renderAdmin(root){
  if(!state.admin){root.innerHTML='<section class="section"><div class="error-card"><b>لوحة الإدارة محمية.</b><p>سجّل الدخول بحساب المدير.</p><button class="gold-btn" id="adminLogin">تسجيل الدخول</button></div></section>';$('#adminLogin').onclick=openAuth;return;}
  root.innerHTML=`<section class="section"><div class="section-title"><div><span>إدارة مصحف سميع</span><h1>لوحة التحكم</h1><p>المرحلة الأولى: هوية المنصة ومحتوى الإعدادات.</p></div></div><div class="admin-panel"><label>اسم المنصة<input id="siteName" value="${esc(state.config.siteName)}"></label><label>الوصف<textarea id="siteTag">${esc(state.config.tagline||'')}</textarea></label><button class="gold-btn wide" id="saveSite">حفظ</button><div class="admin-info">المدير الحالي: ${esc(state.user?.email||'')}</div><div class="admin-grid"><div>الروايات المحلية<br><b>6</b></div><div>المصدر الصوتي<br><b>MP3Quran</b></div><div>Firestore<br><b>متصل</b></div></div></div></section>`;
  $('#saveSite').onclick=async()=>{state.config.siteName=$('#siteName').value.trim()||'مصحف سميع';state.config.tagline=$('#siteTag').value.trim();try{await setSiteConfig(state.user.uid,state.config);toast('تم حفظ إعدادات المنصة');render();}catch{toast('تعذر الحفظ — راجع قواعد Firestore');}};
}

function openAuth(){
  openModal(`<div class="modal-title">الحساب</div><div class="auth-tabs"><button class="active" data-auth="login">دخول</button><button data-auth="register">حساب جديد</button><button data-auth="reset">استعادة</button></div><div id="authBody"></div>`);renderAuthBody('login');$$('[data-auth]').forEach(b=>b.onclick=()=>{ $$('.auth-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderAuthBody(b.dataset.auth);});
}
function renderAuthBody(mode){const body=$('#authBody');if(mode==='reset'){body.innerHTML=`<label>البريد الإلكتروني<input id="authEmail" type="email"></label><button class="gold-btn wide" id="resetBtn">إرسال رابط الاستعادة</button>`;$('#resetBtn').onclick=async()=>{try{await resetPassword($('#authEmail').value.trim());toast('تم إرسال رابط الاستعادة');closeModal();}catch{toast('تعذر إرسال رابط الاستعادة');}};return;}body.innerHTML=`${mode==='register'?`<label>الاسم<input id="authName"></label>`:''}<label>البريد الإلكتروني<input id="authEmail" type="email"></label><label>كلمة المرور<input id="authPass" type="password" minlength="6"></label><button class="gold-btn wide" id="authGo">${mode==='register'?'إنشاء الحساب':'دخول'}</button><div id="authError" class="form-error"></div>`;$('#authGo').onclick=async()=>{try{if(mode==='register')await register($('#authEmail').value.trim(),$('#authPass').value,$('#authName').value.trim());else await login($('#authEmail').value.trim(),$('#authPass').value);closeModal();}catch(e){$('#authError').textContent=e.code||'تعذر تنفيذ العملية';}};}

function openMenu(){openModal(`<div class="modal-title">القائمة</div><div class="menu-list"><button data-menu="mushaf">المصحف</button><button data-menu="index">الفهرس</button><button data-menu="library">المكتبة السمعية</button><button data-menu="tafsir">التفسير</button><button data-menu="hadith">الأحاديث</button><button data-menu="adhkar">الأذكار</button><button data-menu="tools">أدوات المسلم</button><button data-menu="settings">الإعدادات</button>${state.admin?'<button data-menu="admin">لوحة الإدارة</button>':''}${state.user?`<div class="account-mini">${esc(state.user.displayName||state.user.email||'')}</div>`:'<button data-menu="login">تسجيل الدخول</button>'}</div>`);$$('[data-menu]').forEach(b=>b.onclick=()=>{if(b.dataset.menu==='login'){closeModal();openAuth();}else{closeModal();navigate(b.dataset.menu);}});}

async function globalSearch(q){const box=$('#globalSearchResults');const term=q.trim();if(term.length<2){box.innerHTML='';return;}const hits=SURA_NAMES.map((n,i)=>normalizeArabic(n).includes(normalizeArabic(term))?{t:`سورة ${n}`,s:i+1}:null).filter(Boolean);box.innerHTML=hits.length?hits.map(h=>`<button class="search-hit" data-search-sura="${h.s}">${esc(h.t)}</button>`).join(''):`<div class="search-empty">ابحث باسم سورة أو افتح قسم القراء/الأحاديث للبحث المتخصص.</div>`;$$('[data-search-sura]').forEach(b=>b.onclick=()=>{closeSearch();state.sura=Number(b.dataset.searchSura);setPage(surahFirstPage(state.sura));});}
function closeSearch(){$('#searchPanel')?.classList.remove('open');}

function renderAyahCard(row,withTafsir){const result=$('#sheetResult');result.innerHTML=`<div class="share-card" id="shareCard"><img src="/assets/samee3-logo.png"/><div class="share-brand">مصحف سميع</div><div class="share-ayah">${esc(row.text)}</div><div class="share-ref">سورة ${esc(SURA_NAMES[row.sura-1])} · آية ${ar(row.ayah)}</div>${withTafsir?'<div id="shareTafsir" class="share-tafsir">جاري تحميل التفسير…</div>':''}</div><button class="gold-btn wide" id="copyCard">نسخ نص البطاقة</button>`;$('#copyCard').onclick=()=>copyText(`${row.text}\nسورة ${SURA_NAMES[row.sura-1]} — آية ${row.ayah}`);if(withTafsir)showAyahTafsir(row);}
function openModal(html){const m=$('#modal');m.classList.add('open');m.innerHTML=`<div class="modal-sheet"><button class="close-modal" data-close>×</button>${html}</div>`;m.onclick=e=>{if(e.target.closest('[data-close]'))closeModal();};}
function closeModal(){$('#modal')?.classList.remove('open');}
function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200);}

state.audio.preload='metadata';state.audio.addEventListener('timeupdate',()=>syncHighlight());state.audio.addEventListener('play',()=>{state.playing=true;syncHighlight();});state.audio.addEventListener('pause',()=>{state.playing=false;});state.audio.addEventListener('ended',()=>{state.playing=false;syncHighlight();});
function syncHighlight(){const page=$('#quranPage');if(!page)return;for(const el of $$('.ayah',page))el.classList.remove('active-ayah');if(!state.selected||!state.timings.length||state.audio.paused)return;const ms=state.audio.currentTime*1000;const t=state.timings.find(x=>ms>=Number(x.start_time||0)&&ms<Number(x.end_time||Infinity));if(!t)return;const el=$(`.ayah[data-ayah="${Number(t.ayah)}"]`,page);el?.classList.add('active-ayah');el?.scrollIntoView({block:'center',behavior:'smooth'});}

watchAuth(async user=>{state.user=user||null;state.admin=false;if(user){await ensureUser(user).catch(()=>{});state.admin=await isAdmin(user.uid);const s=await getUserSettings(user.uid);if(s){state.page=Number(s.page||state.page);state.sura=Number(s.sura||state.sura);state.riwaya=s.riwaya||state.riwaya;state.fontSize=Number(s.fontSize||state.fontSize);state.theme=s.theme||state.theme;}state.bookmarks=await listBookmarks(user.uid);}state.config=await getSiteConfig()||state.config;saveLocal();render();});

window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')setPage(state.page+1);if(e.key==='ArrowRight')setPage(state.page-1);if(e.key==='Escape')closeModal();});

render();
