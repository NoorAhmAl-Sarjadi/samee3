import "./style.css";

const BASE = import.meta.env.BASE_URL || "./";
const path = (p) => `${BASE}${String(p).replace(/^\//, "")}`;
const AUDIO = "https://cdn.islamic.network/quran/audio-surah/128";
const AYAH_AUDIO = "https://cdn.islamic.network/quran/audio/128";

const RIWAYAT = {
  hafs: { label: "حفص عن عاصم", json: "data/riwayat/hafs/data/hafsData_v18.json", font: "data/riwayat/hafs/font/hafs.18.woff2" },
  warsh: { label: "ورش عن نافع", json: "data/riwayat/warsh/data/warshData_v10.json", font: "data/riwayat/warsh/font/warsh.10.woff2" },
  qaloon: { label: "قالون عن نافع", json: "data/riwayat/qaloon/data/QaloonData_v10.json", font: "data/riwayat/qaloon/font/qaloon.10.woff2" },
  doori: { label: "الدوري عن أبي عمرو", json: "data/riwayat/doori/data/DooriData_v09.json", font: "data/riwayat/doori/font/doori.9.woff2" },
  soosi: { label: "السوسي عن أبي عمرو", json: "data/riwayat/soosi/data/SoosiData09.json", font: "data/riwayat/soosi/font/soosi.9.woff2" },
  shouba: { label: "شعبة عن عاصم", json: "data/riwayat/shouba/data/ShoubaData08.json", font: "data/riwayat/shouba/font/shouba.8.woff2" }
};

const readers = [
  ["ar.alafasy", "مشاري راشد العفاسي"],
  ["ar.husary", "محمود خليل الحصري"],
  ["ar.minshawi", "محمد صديق المنشاوي"],
  ["ar.abdulbasitmurattal", "عبد الباسط عبد الصمد"],
  ["ar.saoodshuraym", "سعود الشريم"]
];

const fallbackContent = {
  brand: { name: "مصحف سميع", tagline: "اقرأ • استمع • تدبّر", description: "مصحف رقمي هادئ بواجهة عربية ذهبية مستوحاة من تجربة المصحف الورقي." },
  navigation: { home: "الرئيسية", quran: "المصحف", audio: "السمعية", bookmarks: "المحفوظات", tools: "أدوات المسلم", settings: "الإعدادات", admin: "الإدارة" },
  adhkar: [], hadith: []
};

const state = {
  content: fallbackContent,
  rows: [], chapters: [],
  edition: localStorage.getItem("samee3-riwayah") || "hafs",
  reader: localStorage.getItem("samee3-reader") || "ar.alafasy",
  view: localStorage.getItem("samee3-view") || "home",
  currentSurah: Number(localStorage.getItem("samee3-surah") || 2),
  currentAyah: Number(localStorage.getItem("samee3-ayah") || 1),
  pageIndex: Number(localStorage.getItem("samee3-page") || 0),
  query: "",
  fontSize: Number(localStorage.getItem("samee3-font-size") || 33),
  dark: localStorage.getItem("samee3-dark") === "true",
  bookmarks: JSON.parse(localStorage.getItem("samee3-bookmarks") || "[]"),
  lastRead: JSON.parse(localStorage.getItem("samee3-last-read") || "null"),
  admin: JSON.parse(localStorage.getItem("samee3-admin") || "{}"),
  notice: "",
  audio: null
};

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function save() {
  localStorage.setItem("samee3-riwayah", state.edition);
  localStorage.setItem("samee3-reader", state.reader);
  localStorage.setItem("samee3-view", state.view);
  localStorage.setItem("samee3-surah", String(state.currentSurah));
  localStorage.setItem("samee3-ayah", String(state.currentAyah));
  localStorage.setItem("samee3-page", String(state.pageIndex));
  localStorage.setItem("samee3-font-size", String(state.fontSize));
  localStorage.setItem("samee3-dark", String(state.dark));
  localStorage.setItem("samee3-bookmarks", JSON.stringify(state.bookmarks));
  localStorage.setItem("samee3-last-read", JSON.stringify(state.lastRead));
  localStorage.setItem("samee3-admin", JSON.stringify(state.admin));
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", state.dark);
  document.documentElement.style.setProperty("--ayah-size", `${state.fontSize}px`);
}

function installFont() {
  const font = RIWAYAT[state.edition]?.font;
  if (!font) return;
  const styleId = "samee3-quran-font-style";
  let tag = document.getElementById(styleId);
  if (!tag) { tag = document.createElement("style"); tag.id = styleId; document.head.appendChild(tag); }
  tag.textContent = `@font-face{font-family:Samee3Quran;src:url("${path(font)}") format("woff2");font-display:swap;}`;
}

const surahNo = r => Number(r.sura_no ?? r.sora ?? r.surah ?? 0);
const ayahNo = r => Number(r.aya_no ?? r.ayah_no ?? r.ayah ?? 0);
const textOf = r => String(r.aya_text ?? r.text ?? r.aya_text_emlaey ?? r.uthmani_text ?? "");
const nameAr = r => String(r.sura_name_ar ?? r.sorah_name_ar ?? r.surah_name_ar ?? "").trim();
const nameEn = r => String(r.sura_name_en ?? r.sorah_name_en ?? r.surah_name_en ?? "").trim();

function normalize(raw) {
  return raw.map((r, i) => ({
    ...r,
    _id: Number(r.id ?? i + 1),
    _surah: surahNo(r),
    _ayah: ayahNo(r),
    _text: textOf(r),
    _nameAr: nameAr(r),
    _nameEn: nameEn(r)
  })).filter(r => r._surah > 0 && r._ayah > 0 && r._text);
}

function buildChapters() {
  const map = new Map();
  for (const r of state.rows) {
    if (!map.has(r._surah)) map.set(r._surah, { number: r._surah, name: r._nameAr || `سورة ${r._surah}`, en: r._nameEn || "" });
  }
  state.chapters = [...map.values()].sort((a,b) => a.number - b.number);
}

async function getJSON(rel) {
  const res = await fetch(path(rel));
  if (!res.ok) throw new Error(`Failed to fetch ${rel}`);
  return res.json();
}

async function initData() {
  try { state.content = await getJSON("data/content.json"); } catch { state.content = fallbackContent; }
  await loadEdition(state.edition);
}

async function loadEdition(id) {
  const item = RIWAYAT[id] || RIWAYAT.hafs;
  const data = await getJSON(item.json);
  state.edition = id;
  state.rows = normalize(data);
  buildChapters();
  installFont();
  if (!state.chapters.some(s => s.number === state.currentSurah)) state.currentSurah = state.chapters[0]?.number || 1;
  state.pageIndex = 0;
  save();
}

function displayName(ch) { return ch?.name || `سورة ${state.currentSurah}`; }
function rowsForSurah(num = state.currentSurah) { return state.rows.filter(r => r._surah === Number(num)).sort((a,b)=>a._ayah-b._ayah); }
function pagesForSurah() {
  const rows = rowsForSurah();
  const chunk = window.innerWidth < 700 ? 7 : 10;
  const pages = [];
  for (let i=0;i<rows.length;i+=chunk) pages.push(rows.slice(i,i+chunk));
  return pages.length ? pages : [[]];
}
function currentPage() {
  const pages = pagesForSurah();
  state.pageIndex = Math.max(0, Math.min(state.pageIndex, pages.length - 1));
  return pages[state.pageIndex] || [];
}
function openView(view) { state.view = view; state.query = ""; save(); render(); }

function icon(name) {
  const icons = {
    search: "⌕", menu: "☰", settings: "⚙", play: "▶", pause: "Ⅱ", bookmark: "☆", bookmarkFill: "★", moon: "☾", sun: "☀", home: "⌂", quran: "▧", audio: "◖", saved: "☆", tools: "◫", close: "×", prev: "‹", next: "›", down: "⌄"
  };
  return icons[name] || "•";
}

function topbar() {
  const brand = state.content.brand || fallbackContent.brand;
  return `<header class="topbar">
    <button class="round-button" onclick="window.toggleMenu()" aria-label="القائمة">${icon("menu")}</button>
    <div class="top-search" onclick="window.focusSearch()"><span>${icon("search")}</span><span class="placeholder">بحث: الصفحة، السورة، القارئ...</span></div>
    <button class="round-button" onclick="window.toggleTheme()" aria-label="الوضع الليلي">${state.dark ? icon("sun") : icon("moon")}</button>
    <div class="top-brand"><span class="brand-dot">س</span><span><b>${esc(state.admin.name || brand.name)}</b><small>${esc(state.admin.tagline || brand.tagline)}</small></span></div>
  </header>`;
}

function miniPagePreview(rows) {
  return `<div class="mini-preview">${rows.slice(0,4).map(r => `<div>${esc(r._text.slice(0,55))}</div>`).join("")}</div>`;
}

function homeView() {
  const ch = state.chapters.find(s=>s.number===state.lastRead?.surah) || state.chapters[1] || state.chapters[0];
  return `<section class="home-view">
    <div class="gold-hero">
      <div class="hero-copy">
        <span class="eyebrow">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ</span>
        <h1>${esc(state.admin.name || state.content.brand?.name || "مصحف سميع")}</h1>
        <p>${esc(state.admin.description || state.content.brand?.description || "مصحف رقمي هادئ للقراءة والاستماع والتدبر.")}</p>
        <button class="gold-button" onclick="window.openReader(${ch?.number || 1})">متابعة القراءة <span>${icon("next")}</span></button>
      </div>
      <div class="ornament"><div>۞</div><small>${esc(RIWAYAT[state.edition].label)}</small></div>
    </div>
    <div class="quick-row">
      <button class="quick-card active" onclick="window.openReader(2)"><span class="q-icon">▧</span><b>المصحف</b><small>قراءة هادئة</small></button>
      <button class="quick-card" onclick="window.openView('audio')"><span class="q-icon">◖</span><b>المكتبة السمعية</b><small>القراء والتلاوات</small></button>
      <button class="quick-card" onclick="window.openView('saved')"><span class="q-icon">☆</span><b>المحفوظات</b><small>${state.bookmarks.length} علامة</small></button>
      <button class="quick-card" onclick="window.openView('tools')"><span class="q-icon">◫</span><b>أدوات المسلم</b><small>أذكار وأدعية</small></button>
    </div>
    <div class="section-title"><div><span>قراءة اليوم</span><h2>آخر موضع وصلت إليه</h2></div><button class="text-link" onclick="window.openView('quran')">كل السور</button></div>
    <div class="resume-card" onclick="window.openReader(${state.lastRead?.surah || ch?.number || 2})">
      <div class="resume-cover">۞</div>
      <div class="resume-body"><small>${esc(state.lastRead ? state.lastRead.name : displayName(ch))}</small><h3>الآية ${state.lastRead?.ayah || 1}</h3><div class="progress-track"><span style="width:${Math.max(8, Math.min(100, ((state.lastRead?.ayah || 1)/(rowsForSurah(state.lastRead?.surah || ch?.number || 2).length || 1))*100))}%"></span></div></div>
      ${miniPagePreview(rowsForSurah(state.lastRead?.surah || ch?.number || 2))}
    </div>
  </section>`;
}

function quranView() {
  const q = state.query.trim();
  const list = state.chapters.filter(s => !q || `${s.number} ${s.name} ${s.en}`.includes(q));
  return `<section class="list-view">
    <div class="list-toolbar"><div><span>المصحف الشريف</span><h2>السور القرآنية</h2></div><div class="edition-chip">${esc(RIWAYAT[state.edition].label)}</div></div>
    <div class="gold-search"><span>${icon("search")}</span><input id="surahSearch" value="${esc(state.query)}" oninput="window.searchSurahs(this.value)" placeholder="ابحث عن السورة..." /></div>
    <div class="surah-grid">${list.map(s => `<button class="surah-card" onclick="window.openReader(${s.number})"><span class="surah-no">${s.number}</span><span class="surah-info"><b>${esc(s.name)}</b><small>${esc(s.en || "")}</small></span><span class="surah-mark">۞</span></button>`).join("")}</div>
  </section>`;
}

function readerView() {
  const surah = state.chapters.find(s=>s.number===state.currentSurah) || {name:""};
  const page = currentPage();
  const pages = pagesForSurah();
  const displayPage = state.pageIndex + 1;
  return `<section class="mushaf-view">
    <div class="mushaf-toolbar">
      <button class="soft-button" onclick="window.openView('quran')">السور</button>
      <div class="reader-title"><strong>${esc(surah.name)}</strong><small>${esc(RIWAYAT[state.edition].label)}</small></div>
      <div class="toolbar-actions"><button class="soft-button" onclick="window.openSettings()">${icon("settings")}</button><button class="soft-button" onclick="window.playCurrentSurah()">${icon("play")}</button></div>
    </div>
    <div class="reading-paper" id="readingPaper">
      <div class="paper-topline"><span>${displayPage === 1 ? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" : ""}</span><span>${displayName(surah)}</span></div>
      <div class="surah-ribbon"><span>سورة ${esc(surah.name)}</span><small>الجزء ${Math.floor((state.currentSurah - 1) / 10) + 1}</small></div>
      ${state.currentSurah !== 1 && state.pageIndex === 0 ? `<div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : ""}
      <div class="page-text">${page.map(a => `<p class="q-ayah ${a._ayah===state.currentAyah?'focused':''}" id="ayah-${a._ayah}" onclick="window.selectAyah(${a._ayah})">${esc(a._text)} <span class="ayah-badge">${a._ayah}</span></p>`).join("")}</div>
      <div class="paper-footer"><span>مصحف سميع</span><strong>صفحة العرض ${displayPage} / ${pages.length}</strong><span>برواية ${esc(RIWAYAT[state.edition].label)}</span></div>
    </div>
    <div class="reader-controls">
      <button class="control-button" onclick="window.prevPage()">${icon("prev")}</button>
      <div class="page-status"><b>صفحة ${displayPage}</b><div class="dots">${pages.map((_,i)=>`<span class="dot ${i===state.pageIndex?'active':''}"></span>`).join("")}</div></div>
      <button class="control-button" onclick="window.nextPage()">${icon("next")}</button>
    </div>
    <div class="reader-bottom-row"><div><b>${esc(surah.name)}</b><span>${esc(readers.find(r=>r[0]===state.reader)?.[1] || "")}</span></div><div class="reader-mini-actions"><button onclick="window.toggleBookmarkCurrent()">${state.bookmarks.some(b=>b.surah===state.currentSurah && b.ayah===state.currentAyah)?icon("bookmarkFill"):icon("bookmark")}</button><button onclick="window.changeFont(-2)">A−</button><button onclick="window.changeFont(2)">A+</button></div></div>
  </section>`;
}

function audioView() {
  return `<section class="list-view"><div class="list-toolbar"><div><span>المكتبة السمعية</span><h2>القراء والتلاوات</h2></div></div><div class="reader-selector">${readers.map(r => `<button class="reader-card ${state.reader===r[0]?'selected':''}" onclick="window.setReader('${r[0]}')"><span class="avatar">◖</span><span><b>${esc(r[1])}</b><small>تشغيل سور القرآن</small></span></button>`).join("")}</div><div class="notice-box">الصوتيات تُشغّل من مصدر التلاوات الخارجي، بينما نصوص الروايات والخطوط محفوظة محليًا داخل المشروع.</div></section>`;
}

function savedView() {
  const items = state.bookmarks.map(b=>({...b, name: state.chapters.find(s=>s.number===b.surah)?.name || `سورة ${b.surah}`}));
  return `<section class="list-view"><div class="list-toolbar"><div><span>المحفوظات</span><h2>علاماتي المرجعية</h2></div></div>${items.length ? `<div class="saved-list">${items.map(b=>`<button class="saved-row" onclick="window.openReader(${b.surah},${b.ayah})"><span class="bookmark-gold">★</span><span><b>${esc(b.name)}</b><small>الآية ${b.ayah}</small></span><span>›</span></button>`).join("")}</div>` : `<div class="empty-state"><span>☆</span><h3>لا توجد علامات بعد</h3><p>اضغط على النجمة أسفل المصحف لحفظ الموضع الحالي.</p></div>`}</section>`;
}

function toolsView() {
  const adhkar = state.content.adhkar || [];
  const hadith = state.content.hadith || [];
  return `<section class="list-view"><div class="list-toolbar"><div><span>أدوات المسلم</span><h2>الأذكار والأحاديث</h2></div></div><div class="tools-tabs"><button class="selected">الأذكار</button><button>الأحاديث</button></div><div class="content-list">${(adhkar.length ? adhkar : [{title:"ذكر الصباح",text:"اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور.",source:""}]).map(item=>`<article class="gold-content"><span class="content-symbol">۞</span><div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><small>${esc(item.source || "")}</small></div></article>`).join("")}</div><div class="content-list muted-content">${hadith.slice(0,3).map(item=>`<article class="gold-content"><span class="content-symbol">📜</span><div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><small>${esc(item.source || "")}</small></div></article>`).join("")}</div></section>`;
}

function settingsView() {
  return `<section class="list-view"><div class="list-toolbar"><div><span>الإعدادات</span><h2>تخصيص تجربة المصحف</h2></div></div><div class="settings-grid"><div class="setting-card"><b>الرواية</b><select onchange="window.setEdition(this.value)">${Object.entries(RIWAYAT).map(([id,v])=>`<option value="${id}" ${id===state.edition?'selected':''}>${esc(v.label)}</option>`).join("")}</select></div><div class="setting-card"><b>القارئ</b><select onchange="window.setReader(this.value)">${readers.map(r=>`<option value="${r[0]}" ${r[0]===state.reader?'selected':''}>${esc(r[1])}</option>`).join("")}</select></div><div class="setting-card"><b>حجم الخط</b><input type="range" min="24" max="46" value="${state.fontSize}" oninput="window.setFont(this.value)"/><span>${state.fontSize}px</span></div><div class="setting-card"><b>المظهر</b><button class="soft-button wide" onclick="window.toggleTheme()">${state.dark?'وضع نهاري':'وضع ليلي'}</button></div></div></section>`;
}

function adminView() {
  const b = state.content.brand || fallbackContent.brand;
  const nav = state.content.navigation || fallbackContent.navigation;
  return `<section class="list-view"><div class="list-toolbar"><div><span>الإدارة</span><h2>تخصيص المنصة</h2></div><div class="admin-status">محلي على هذا المتصفح</div></div><div class="admin-panel"><label>اسم المنصة<input id="adminName" value="${esc(state.admin.name || b.name)}"></label><label>الشعار المختصر<input id="adminTagline" value="${esc(state.admin.tagline || b.tagline)}"></label><label>الوصف<textarea id="adminDescription">${esc(state.admin.description || b.description)}</textarea></label><label>اسم قسم المصحف<input id="navQuran" value="${esc(nav.quran || 'المصحف')}"></label><label>اسم أدوات المسلم<input id="navTools" value="${esc(nav.tools || 'أدوات المسلم')}"></label><button class="gold-button" onclick="window.saveAdminPanel()">حفظ التعديلات</button><div class="notice-box">هذه النسخة تجعل إعدادات الهوية والنصوص محلية. الإدارة متعددة المستخدمين والصلاحيات تحتاج Backend وقاعدة بيانات.</div></div></section>`;
}

function sideNav() {
  return `<nav class="side-nav" id="sideNav"><button onclick="window.openView('home')" class="${state.view==='home'?'active':''}">${icon('home')}<span>الرئيسية</span></button><button onclick="window.openView('quran')" class="${['quran','reader'].includes(state.view)?'active':''}">${icon('quran')}<span>${esc(state.content.navigation?.quran || 'المصحف')}</span></button><button onclick="window.openView('audio')" class="${state.view==='audio'?'active':''}">${icon('audio')}<span>المكتبة السمعية</span></button><button onclick="window.openView('saved')" class="${state.view==='saved'?'active':''}">${icon('saved')}<span>المحفوظات</span></button><button onclick="window.openView('tools')" class="${state.view==='tools'?'active':''}">${icon('tools')}<span>${esc(state.content.navigation?.tools || 'أدوات المسلم')}</span></button><button onclick="window.openView('settings')" class="${state.view==='settings'?'active':''}">${icon('settings')}<span>الإعدادات</span></button><button onclick="window.openView('admin')" class="${state.view==='admin'?'active':''}">${icon('settings')}<span>الإدارة</span></button></nav>`;
}

function bottomNav() {
  return `<nav class="bottom-nav"><button onclick="window.openView('home')" class="${state.view==='home'?'active':''}">${icon('home')}<span>الرئيسية</span></button><button onclick="window.openView('quran')" class="${['quran','reader'].includes(state.view)?'active':''}">${icon('quran')}<span>المصحف الذهبي</span></button><button onclick="window.openView('audio')" class="${state.view==='audio'?'active':''}">${icon('audio')}<span>المكتبة السمعية</span></button><button onclick="window.openView('tools')" class="${state.view==='tools'?'active':''}">${icon('tools')}<span>أدوات المسلم</span></button><button onclick="window.openView('saved')" class="${state.view==='saved'?'active':''}">${icon('saved')}<span>المحفوظات</span></button></nav>`;
}

function render() {
  applyTheme();
  installFont();
  const content = state.view === 'home' ? homeView() : state.view === 'quran' ? quranView() : state.view === 'reader' ? readerView() : state.view === 'audio' ? audioView() : state.view === 'saved' ? savedView() : state.view === 'tools' ? toolsView() : state.view === 'settings' ? settingsView() : adminView();
  $("#app").innerHTML = `${topbar()}${sideNav()}<main class="app-shell"><div class="mobile-spacer"></div>${content}</main>${bottomNav()}<div id="toast" class="toast">${esc(state.notice)}</div>`;
  if (state.notice) { setTimeout(()=>{state.notice=""; const t=$("#toast"); if(t)t.classList.remove('show')},2500); const t=$("#toast"); if(t)t.classList.add('show'); }
}

function focusSearch() {
  state.view = 'quran';
  render();
  setTimeout(()=>$("#surahSearch")?.focus(),50);
}
function searchSurahs(q) { state.query = q; render(); setTimeout(()=>{const x=$("#surahSearch"); if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},0); }
async function openReader(surah, ayah=1) { state.currentSurah=Number(surah); state.currentAyah=Number(ayah); state.view='reader'; state.pageIndex=0; state.lastRead={surah:state.currentSurah,ayah:state.currentAyah,name:displayName(state.chapters.find(s=>s.number===state.currentSurah))}; save(); render(); setTimeout(()=>$("#ayah-"+state.currentAyah)?.scrollIntoView({block:'center',behavior:'smooth'}),100); }
function selectAyah(a) { state.currentAyah=a; state.lastRead={surah:state.currentSurah,ayah:a,name:displayName(state.chapters.find(s=>s.number===state.currentSurah))}; save(); render(); }
function nextPage(){const p=pagesForSurah(); if(state.pageIndex<p.length-1){state.pageIndex++;selectPageState();render();}}
function prevPage(){if(state.pageIndex>0){state.pageIndex--;selectPageState();render();}}
function selectPageState(){const p=currentPage(); if(p[0]){state.currentAyah=p[0]._ayah;state.lastRead={surah:state.currentSurah,ayah:state.currentAyah,name:displayName(state.chapters.find(s=>s.number===state.currentSurah))};save();}}
function toggleBookmarkCurrent(){const i=state.bookmarks.findIndex(b=>b.surah===state.currentSurah&&b.ayah===state.currentAyah); if(i>=0) state.bookmarks.splice(i,1); else state.bookmarks.push({surah:state.currentSurah,ayah:state.currentAyah}); state.notice=i>=0?'تم حذف العلامة':'تم حفظ الموضع'; save(); render();}
function setFont(v){state.fontSize=Number(v);save();applyTheme();if(state.view==='reader')render();}
function changeFont(d){state.fontSize=Math.max(24,Math.min(46,state.fontSize+d));save();applyTheme();if(state.view==='reader')render();}
function toggleTheme(){state.dark=!state.dark;save();render();}
async function setEdition(id){try{await loadEdition(id);state.notice=`تم التبديل إلى ${RIWAYAT[id].label}`;render();}catch(e){console.error(e);state.notice='تعذر تحميل الرواية';render();}}
function setReader(id){state.reader=id;save();state.notice='تم اختيار القارئ';render();}
function playCurrentSurah(){ stopAudio(); const url=`${AUDIO}/${state.reader}/${state.currentSurah}.mp3`; state.audio=new Audio(url); state.audio.play().catch(()=>{state.notice='تعذر تشغيل التلاوة من المصدر الحالي';render();}); }
function playAyah(){ stopAudio(); const row=rowsForSurah().find(r=>r._ayah===state.currentAyah); if(!row)return; state.audio=new Audio(`${AYAH_AUDIO}/${state.reader}/${row._id}.mp3`); state.audio.play().catch(()=>{state.notice='تعذر تشغيل الآية';render();}); }
function stopAudio(){if(state.audio){state.audio.pause();state.audio.currentTime=0;state.audio=null;}}
function openSettings(){openView('settings');}
function toggleMenu(){document.querySelector('.side-nav')?.classList.toggle('open');}
function saveAdminPanel(){state.admin.name=$("#adminName").value.trim();state.admin.tagline=$("#adminTagline").value.trim();state.admin.description=$("#adminDescription").value.trim();state.content.navigation.quran=$("#navQuran").value.trim()||'المصحف';state.content.navigation.tools=$("#navTools").value.trim()||'أدوات المسلم';save();state.notice='تم حفظ إعدادات المنصة على هذا المتصفح';render();}

window.openView=openView;window.openReader=openReader;window.searchSurahs=searchSurahs;window.focusSearch=focusSearch;window.prevPage=prevPage;window.nextPage=nextPage;window.selectAyah=selectAyah;window.toggleBookmarkCurrent=toggleBookmarkCurrent;window.setFont=setFont;window.changeFont=changeFont;window.toggleTheme=toggleTheme;window.setEdition=setEdition;window.setReader=setReader;window.playCurrentSurah=playCurrentSurah;window.playAyah=playAyah;window.openSettings=openSettings;window.toggleMenu=toggleMenu;window.saveAdminPanel=saveAdminPanel;

window.addEventListener('resize',()=>{ if(state.view==='reader') render(); });

(async()=>{ try { await initData(); render(); } catch(e) { console.error(e); $("#app").innerHTML=`<div class="fatal">تعذر تشغيل البيانات المحلية للمصحف.</div>`; } })();
