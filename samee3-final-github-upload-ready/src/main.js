import "./style.css";

const AUDIO = "https://cdn.islamic.network/quran/audio-surah/128";
const AYAH_AUDIO = "https://cdn.islamic.network/quran/audio/128";

const RIWAYAT_FILES = {
  hafs: { json: "/data/riwayat/hafs/data/hafsData_v18.json", font: "/data/riwayat/hafs/font/hafs.18.woff2" },
  warsh: { json: "/data/riwayat/warsh/data/warshData_v10.json", font: "/data/riwayat/warsh/font/warsh.10.woff2" },
  qaloon: { json: "/data/riwayat/qaloon/data/QaloonData_v10.json", font: "/data/riwayat/qaloon/font/qaloon.10.woff2" },
  doori: { json: "/data/riwayat/doori/data/DooriData_v09.json", font: "/data/riwayat/doori/font/doori.9.woff2" },
  soosi: { json: "/data/riwayat/soosi/data/SoosiData09.json", font: "/data/riwayat/soosi/font/soosi.9.woff2" },
  shouba: { json: "/data/riwayat/shouba/data/ShoubaData08.json", font: "/data/riwayat/shouba/font/shouba.8.woff2" }
};

const RIWAYAT_LABELS = {
  hafs: "حفص عن عاصم",
  warsh: "ورش عن نافع",
  qaloon: "قالون عن نافع",
  doori: "الدوري عن أبي عمرو",
  soosi: "السوسي عن أبي عمرو",
  shouba: "شعبة عن عاصم"
};

const state = {
  content: null,
  chapters: [],
  currentRows: [],
  currentSurah: null,
  currentEdition: localStorage.getItem("samee3-riwayah") || "hafs",
  currentReader: "ar.alafasy",
  query: "",
  tab: "home",
  dark: localStorage.getItem("samee3-dark") === "true",
  fontSize: Number(localStorage.getItem("samee3-font-size") || 29),
  bookmarks: JSON.parse(localStorage.getItem("samee3-bookmarks") || "[]"),
  lastRead: JSON.parse(localStorage.getItem("samee3-last-read") || "null"),
  settings: JSON.parse(localStorage.getItem("samee3-settings") || "{}")
};

const readers = [
  ["ar.alafasy", "مشاري العفاسي"],
  ["ar.husary", "محمود خليل الحصري"],
  ["ar.minshawi", "محمد صديق المنشاوي"],
  ["ar.abdulbasitmurattal", "عبد الباسط عبد الصمد"],
  ["ar.saoodshuraym", "سعود الشريم"]
];

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[c]));

function save() {
  localStorage.setItem("samee3-bookmarks", JSON.stringify(state.bookmarks));
  localStorage.setItem("samee3-last-read", JSON.stringify(state.lastRead));
  localStorage.setItem("samee3-settings", JSON.stringify(state.settings));
  localStorage.setItem("samee3-dark", String(state.dark));
  localStorage.setItem("samee3-font-size", String(state.fontSize));
  localStorage.setItem("samee3-riwayah", state.currentEdition);
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", state.dark);
  document.documentElement.style.setProperty("--ayah-size", `${state.fontSize}px`);
}

function rowSurahNo(row) {
  return Number(row.sura_no ?? row.sora ?? 0);
}

function rowAyahNo(row) {
  return Number(row.aya_no ?? row.ayah_no ?? 0);
}

function rowText(row) {
  return row.aya_text ?? row.text ?? row.aya_text_emlaey ?? "";
}

function rowNameAr(row) {
  return String(row.sura_name_ar ?? row.sorah_name_ar ?? "").trim();
}

function rowNameEn(row) {
  return String(row.sura_name_en ?? row.sorah_name_en ?? "").trim();
}

function normalizeRows(rows) {
  return rows.map((row, index) => ({
    ...row,
    _global: Number(row.id ?? index + 1),
    _surah: rowSurahNo(row),
    _ayah: rowAyahNo(row),
    _text: rowText(row),
    _nameAr: rowNameAr(row),
    _nameEn: rowNameEn(row)
  })).filter((row) => row._surah > 0 && row._ayah > 0);
}

async function loadContent() {
  const response = await fetch("/data/content.json");
  if (!response.ok) throw new Error("content.json failed");
  state.content = await response.json();
}

async function loadRiwayah(id = state.currentEdition) {
  const entry = RIWAYAT_FILES[id] || RIWAYAT_FILES.hafs;
  const response = await fetch(entry.json);
  if (!response.ok) throw new Error(`riwayah ${id} failed`);
  const rows = normalizeRows(await response.json());
  state.currentEdition = id;
  state.currentRows = rows;
  state.chapters = buildChapters(rows);
  document.documentElement.style.setProperty("--quran-font", `"Samee3-${id}"`);
  save();
  return rows;
}

function buildChapters(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row._surah)) {
      map.set(row._surah, {
        number: row._surah,
        name: row._nameAr || `سورة ${row._surah}`,
        englishName: row._nameEn || ""
      });
    }
  }
  return [...map.values()].sort((a, b) => a.number - b.number);
}

function layout() {
  const brand = state.content?.brand || {};
  const nav = state.content?.navigation || {};
  $("#app").innerHTML = `
    <header class="topbar">
      <div class="brand" onclick="window.go('home')">
        <div class="brand-mark">س</div>
        <div><strong>${esc(brand.name || "مصحف سميع")}</strong><small>${esc(brand.tagline || "")}</small></div>
      </div>
      <button class="icon-btn" onclick="window.toggleTheme()" title="الوضع الليلي">◐</button>
    </header>
    <main class="shell">
      <section class="hero">
        <div>
          <span class="eyebrow">بسم الله الرحمن الرحيم</span>
          <h1>${esc(brand.name || "مصحف سميع")}</h1>
          <p>${esc(brand.description || "")}</p>
          <div class="hero-actions">
            <button class="primary" onclick="window.go('quran')">افتح المصحف</button>
            <button class="secondary" onclick="window.randomAyah()">آية عشوائية</button>
          </div>
        </div>
        <div class="hero-art">۞</div>
      </section>
      <nav class="tabs">
        <button class="${state.tab === "home" ? "active":""}" onclick="window.go('home')">${esc(nav.home || "الرئيسية")}</button>
        <button class="${state.tab === "quran" ? "active":""}" onclick="window.go('quran')">${esc(nav.quran || "المصحف")}</button>
        <button class="${state.tab === "adhkar" ? "active":""}" onclick="window.go('adhkar')">${esc(nav.adhkar || "الأذكار")}</button>
        <button class="${state.tab === "hadith" ? "active":""}" onclick="window.go('hadith')">${esc(nav.hadith || "الأحاديث")}</button>
        <button class="${state.tab === "settings" ? "active":""}" onclick="window.go('settings')">${esc(nav.settings || "الإعدادات")}</button>
        <button class="${state.tab === "admin" ? "active":""}" onclick="window.go('admin')">${esc(nav.admin || "الإدارة")}</button>
      </nav>
      <section id="view"></section>
    </main>
    <footer>مصحف سميع • اجعل القرآن ربيع قلبك</footer>
  `;
  renderView();
}

function renderView() {
  const view = $("#view");
  if (state.tab === "home") {
    view.innerHTML = `
      <div class="section-head"><h2>ابدأ رحلتك</h2><span>${esc(RIWAYAT_LABELS[state.currentEdition])}</span></div>
      <div class="cards">
        <article class="feature" onclick="window.go('quran')"><b>📖</b><h3>المصحف الشريف</h3><p>قراءة واستماع وحفظ آخر موضع.</p></article>
        <article class="feature" onclick="window.go('adhkar')"><b>🌿</b><h3>الأذكار</h3><p>أذكار مختارة مع مصادرها.</p></article>
        <article class="feature" onclick="window.go('hadith')"><b>📜</b><h3>الأحاديث</h3><p>مختارات حديثية مع التخريج.</p></article>
      </div>
      ${state.lastRead ? `<div class="resume"><div><small>آخر قراءة</small><h3>سورة ${esc(state.lastRead.name)}</h3><p>الآية ${state.lastRead.ayah || 1}</p></div><button class="primary" onclick="window.openSurah(${state.lastRead.number})">متابعة</button></div>` : ""}
    `;
  } else if (state.tab === "quran") renderQuran(view);
  else if (state.tab === "adhkar") renderList(view, "الأذكار", state.content.adhkar, "🌿");
  else if (state.tab === "hadith") renderList(view, "الأحاديث", state.content.hadith, "📜");
  else if (state.tab === "settings") renderSettings(view);
  else if (state.tab === "admin") renderAdmin(view);
  else if (state.tab === "reader") renderReader(view, state.chapters.find((s) => s.number === state.currentSurah));
}

function renderQuran(view) {
  const filtered = state.chapters.filter((s) => `${s.name} ${s.englishName}`.includes(state.query));
  view.innerHTML = `
    <div class="section-head"><h2>سور القرآن الكريم</h2><span>114 سورة • ${esc(RIWAYAT_LABELS[state.currentEdition])}</span></div>
    <input class="search" placeholder="ابحث عن سورة..." value="${esc(state.query)}" oninput="window.searchChapters(this.value)" />
    <div class="chapter-grid">
      ${filtered.map(s => `
        <button class="chapter" onclick="window.openSurah(${s.number})">
          <span class="number">${s.number}</span><span><strong>${esc(s.name)}</strong><small>${esc(s.englishName)}</small></span><i>۞</i>
        </button>
      `).join("")}
    </div>
  `;
}

async function openSurah(number) {
  state.currentSurah = number;
  state.tab = "reader";
  layout();
  const view = $("#view");
  view.innerHTML = `<div class="loading">جاري تحميل السورة...</div>`;
  try {
    const rows = state.currentRows.filter((row) => row._surah === Number(number));
    if (!rows.length) throw new Error("surah not found");
    state.lastRead = { number, name: rows[0]._nameAr || `سورة ${number}`, ayah: 1 };
    save();
    renderReader(view, state.chapters.find((s) => s.number === number));
  } catch (error) {
    view.innerHTML = `<div class="error">تعذر تحميل السورة من البيانات المحلية.</div>`;
    console.error(error);
  }
}

function renderReader(view, surah) {
  const rows = state.currentRows.filter((row) => row._surah === Number(state.currentSurah));
  view.innerHTML = `
    <div class="reader-head">
      <button class="secondary" onclick="window.go('quran')">← السور</button>
      <div><h2>${esc(surah?.name || "")}</h2><span>${esc(surah?.englishName || "")}</span></div>
      <button class="icon-btn" onclick="window.playSurah(${state.currentSurah})">▶</button>
    </div>
    <div class="reader-tools">
      <select onchange="window.changeReader(this.value)">${readers.map(r => `<option value="${r[0]}" ${r[0]===state.currentReader?"selected":""}>${esc(r[1])}</option>`).join("")}</select>
      <select onchange="window.setEdition(this.value)">${Object.entries(RIWAYAT_LABELS).map(([id,label]) => `<option value="${id}" ${id===state.currentEdition?"selected":""}>${esc(label)}</option>`).join("")}</select>
      <button class="secondary" onclick="window.changeFont(-2)">A−</button>
      <button class="secondary" onclick="window.changeFont(2)">A+</button>
    </div>
    <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
    <div class="ayah-list">
      ${rows.map(a => `
        <article class="ayah" id="ayah-${a._ayah}">
          <div class="ayah-meta"><span>${a._ayah}</span>
            <div><button onclick="window.playAyah(${a._global})">▶</button><button onclick="window.bookmark(${a._global}, ${a._ayah})">☆</button></div>
          </div>
          <p>${esc(a._text)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderList(view, title, items, icon) {
  view.innerHTML = `
    <div class="section-head"><h2>${title}</h2><span>${items.length} عناصر</span></div>
    <div class="content-list">
      ${items.map(item => `<article class="content-card"><div class="content-icon">${icon}</div><div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><small>${esc(item.source)}</small></div></article>`).join("")}
    </div>
  `;
}

function renderSettings(view) {
  view.innerHTML = `
    <div class="section-head"><h2>الإعدادات</h2></div>
    <div class="settings-card">
      <label>حجم الخط</label>
      <input type="range" min="20" max="48" value="${state.fontSize}" oninput="window.setFont(this.value)" />
      <label>الرواية</label>
      <select onchange="window.setEdition(this.value)">${Object.entries(RIWAYAT_LABELS).map(([id,label]) => `<option value="${id}" ${id===state.currentEdition?"selected":""}>${esc(label)}</option>`).join("")}</select>
      <p class="notice">بيانات الروايات الأساسية مدمجة محليًا داخل المشروع، مع خط WOFF2 محلي لكل رواية.</p>
    </div>
  `;
}

function renderAdmin(view) {
  const brand = state.content.brand;
  view.innerHTML = `
    <div class="section-head"><h2>لوحة الإدارة المحلية</h2><span>تعديلات هذا المتصفح فقط</span></div>
    <div class="settings-card">
      <label>اسم المنصة</label><input id="admin-name" value="${esc(brand.name)}" />
      <label>الشعار المختصر</label><input id="admin-tagline" value="${esc(brand.tagline)}" />
      <label>الوصف</label><textarea id="admin-description">${esc(brand.description)}</textarea>
      <button class="primary" onclick="window.saveAdmin()">حفظ التعديلات</button>
      <p class="notice">هذه لوحة إدارة محلية للتجربة. الإدارة الحقيقية متعددة المستخدمين تحتاج Backend وقاعدة بيانات.</p>
    </div>
  `;
}

function saveAdmin() {
  state.content.brand.name = $("#admin-name").value;
  state.content.brand.tagline = $("#admin-tagline").value;
  state.content.brand.description = $("#admin-description").value;
  state.settings.brand = state.content.brand;
  save();
  layout();
}

function go(tab) { state.tab = tab; state.query = ""; layout(); }
function searchChapters(value) { state.query = value; renderView(); }
function toggleTheme() { state.dark = !state.dark; applyTheme(); save(); }
function changeFont(delta) { state.fontSize = Math.max(20, Math.min(48, state.fontSize + delta)); applyTheme(); save(); if (state.tab === "reader") renderReader($("#view"), state.chapters.find(s => s.number === state.currentSurah)); }
function setFont(value) { state.fontSize = Number(value); applyTheme(); save(); }
function changeReader(value) { state.currentReader = value; }

async function setEdition(value) {
  if (!RIWAYAT_FILES[value]) return;
  const previousTab = state.tab;
  const previousSurah = state.currentSurah;
  try {
    await loadRiwayah(value);
    if (previousTab === "reader" && previousSurah) {
      state.tab = "reader";
      layout();
      return;
    }
    state.tab = previousTab === "reader" ? "quran" : previousTab;
    layout();
  } catch (error) {
    console.error(error);
    alert("تعذر تبديل الرواية من الملفات المحلية.");
  }
}

function bookmark(globalAyah) {
  if (state.bookmarks.includes(globalAyah)) state.bookmarks = state.bookmarks.filter(x => x !== globalAyah);
  else state.bookmarks.push(globalAyah);
  save();
}
function playSurah(number) { new Audio(`${AUDIO}/${state.currentReader}/${number}.mp3`).play().catch(console.error); }
function playAyah(number) { new Audio(`${AYAH_AUDIO}/${state.currentReader}/${number}.mp3`).play().catch(console.error); }
function randomAyah() {
  if (!state.chapters.length) return;
  const chapter = state.chapters[Math.floor(Math.random() * state.chapters.length)];
  openSurah(chapter.number);
}

window.go = go;
window.openSurah = openSurah;
window.searchChapters = searchChapters;
window.toggleTheme = toggleTheme;
window.changeFont = changeFont;
window.setFont = setFont;
window.changeReader = changeReader;
window.setEdition = setEdition;
window.bookmark = bookmark;
window.playSurah = playSurah;
window.playAyah = playAyah;
window.randomAyah = randomAyah;
window.saveAdmin = saveAdmin;

(async function init() {
  applyTheme();
  try {
    await loadContent();
    await loadRiwayah(state.currentEdition);
    layout();
  } catch (error) {
    $("#app").innerHTML = `<div class="fatal">تعذر تشغيل التطبيق. تأكد من تشغيله عبر Vite وليس بفتح index.html مباشرة.</div>`;
    console.error(error);
  }
})();
