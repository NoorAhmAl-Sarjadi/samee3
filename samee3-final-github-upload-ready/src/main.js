const API = {
  reciters: 'https://www.mp3quran.net/api/v3/reciters?language=ar',
  suwar: 'https://www.mp3quran.net/api/v3/suwar?language=ar',
};
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const state = {
  page: Number(localStorage.getItem('samee3_page') || 22),
  riwaya: localStorage.getItem('samee3_riwaya') || 'hafs',
  sura: Number(localStorage.getItem('samee3_sura') || 2),
  readerId: Number(localStorage.getItem('samee3_reader') || 259),
  fontSize: Number(localStorage.getItem('samee3_font') || 2),
  theme: localStorage.getItem('samee3_theme') || 'light',
  activeNav: localStorage.getItem('samee3_nav') || 'mushaf',
  pageLines: [],
  reciters: [],
  surahs: [],
  audio: new Audio(),
  audioInfo: null,
};

const riwayat = {
  hafs: {name:'حفص عن عاصم', short:'حفص', json:'/data/riwayat/hafs/data/hafsData_v18.json', font:'/data/riwayat/hafs/font/hafs.18.woff2'},
  warsh: {name:'ورش عن نافع', short:'ورش', json:'/data/riwayat/warsh/data/warshData_v10.json', font:'/data/riwayat/warsh/font/warsh.10.woff2'},
  qaloon:{name:'قالون عن نافع', short:'قالون', json:'/data/riwayat/qaloon/data/QaloonData_v10.json', font:'/data/riwayat/qaloon/font/qaloon.10.woff2'},
  doori:{name:'الدوري عن أبي عمرو', short:'الدوري', json:'/data/riwayat/doori/data/DooriData_v09.json', font:'/data/riwayat/doori/font/doori.9.woff2'},
  soosi:{name:'السوسي عن أبي عمرو', short:'السوسي', json:'/data/riwayat/soosi/data/SoosiData09.json', font:'/data/riwayat/soosi/font/soosi.9.woff2'},
  shouba:{name:'شعبة عن عاصم', short:'شعبة', json:'/data/riwayat/shouba/data/ShoubaData08.json', font:'/data/riwayat/shouba/font/shouba.8.woff2'},
};

let quranRows = null;
const cache = new Map();

function save(){ localStorage.setItem('samee3_page', state.page); localStorage.setItem('samee3_riwaya', state.riwaya); localStorage.setItem('samee3_sura', state.sura); localStorage.setItem('samee3_reader', state.readerId); localStorage.setItem('samee3_font', state.fontSize); localStorage.setItem('samee3_nav', state.activeNav); }
function arabicDigits(n){ return String(n).replace(/\d/g, d=>'٠١٢٣٤٥٦٧٨٩'[d]); }
function romanize(n){ return arabicDigits(n); }

async function loadQuran(rid=state.riwaya){
  if(cache.has(rid)) return cache.get(rid);
  const res = await fetch(riwayat[rid].json, {cache:'force-cache'});
  if(!res.ok) throw new Error('تعذر تحميل بيانات الرواية');
  const data = await res.json();
  cache.set(rid,data);
  return data;
}
function normalizeRow(r){
  return {
    page:parseInt(String(r.page ?? 1), 10) || 1,
    sura:Number(r.sora ?? r.sura_no ?? r.sura),
    suraName:r.sora_name_ar ?? r.sura_name_ar ?? '',
    ayah:Number(r.aya_no ?? r.ayah_no ?? r.aya ?? r.ayah),
    text:r.aya_text ?? r.ayah_text ?? '',
    lineStart:Number(r.line_start || 1),
    lineEnd:Number(r.line_end || r.line_start || 1),
    juz:Number(r.jozz ?? r.juz ?? 1),
  };
}
async function getPage(page){
  const rows = (await loadQuran(state.riwaya)).map(normalizeRow);
  const found = rows.filter(x=>x.page===page);
  // fallback to nearest populated page
  if(found.length) return found;
  return rows.filter(x=>x.page === Math.max(1, Math.min(604,page)));
}
function pageGroups(rows){
  const groups = [];
  const by = new Map();
  for(const r of rows){
    const key = r.lineStart;
    if(!by.has(key)) by.set(key, []);
    by.get(key).push(r);
  }
  [...by.keys()].sort((a,b)=>a-b).forEach(k=>{
    groups.push({line:k, text:by.get(k).map(r=>r.text).join(' ')});
  });
  return groups;
}
function applyFont(){
  let el = $('#quran-font-style');
  if(!el){ el=document.createElement('style'); el.id='quran-font-style'; document.head.appendChild(el); }
  const r=riwayat[state.riwaya];
  el.textContent = `@font-face{font-family:'SameeQuran';src:url('${r.font}') format('woff2');font-display:swap} .quran-lines{font-family:'SameeQuran', serif}`;
  document.documentElement.style.setProperty('--quran-scale', String(0.96 + state.fontSize*0.07));
}
function renderPage(){
  const rows = state.pageRows || [];
  const lines = pageGroups(rows);
  state.pageLines=lines;
  const paper=$('#mushaf-paper');
  if(!paper) return;
  const first=rows[0]||{};
  const last=rows[rows.length-1]||{};
  const title=first.suraName || 'المصحف الشريف';
  paper.innerHTML = `
    <div class="page-ornament top"></div>
    <header class="page-head"><span>${title}</span><span>${arabicDigits(state.page)}</span><span>${arabicDigits(first.juz||1)} الجزء</span></header>
    <div class="quran-lines" aria-label="صفحة القرآن">
      ${lines.map(x=>`<div class="q-line">${x.text}</div>`).join('')}
    </div>
    <div class="page-number">${arabicDigits(state.page)}</div>
    <div class="page-ornament bottom"></div>
  `;
  $('#page-display').textContent=arabicDigits(state.page);
  $('#surah-display').textContent=title;
  $('#juz-display').textContent=`الجزء ${arabicDigits(first.juz||1)}`;
  const title2 = riwayat[state.riwaya]?.name || '';
  $('#riwaya-display').textContent=title2;
  $('#thumb-page').textContent=arabicDigits(state.page);
  $('#prev-page').disabled=state.page<=1;
  $('#next-page').disabled=state.page>=604;
  $('.quran-lines').style.fontSize = `${1.02*Number(getComputedStyle(document.documentElement).getPropertyValue('--quran-scale')||1)}rem`;
  save();
}
async function setPage(page){
  state.page=Math.max(1,Math.min(604,Number(page)||1));
  try{
    state.pageRows=await getPage(state.page);
    state.sura=state.pageRows[0]?.sura || state.sura;
    applyFont(); renderPage(); renderReaderBar();
  }catch(e){ toast('تعذر فتح الصفحة'); console.error(e); }
}
async function setRiwaya(id){
  if(!riwayat[id]) return;
  state.riwaya=id;
  state.pageRows=await getPage(state.page);
  applyFont(); renderPage(); closeSheet(); toast(`تم اختيار ${riwayat[id].name}`); save();
  renderReciterUI();
}
function openSheet(name){
  const s=$('#sheet');
  s.classList.add('open');
  document.body.classList.add('sheet-open');
  $$('.sheet-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.sheet!==name));
}
function closeSheet(){ $('#sheet')?.classList.remove('open'); document.body.classList.remove('sheet-open'); }
function toast(t){ const x=$('#toast'); x.textContent=t; x.classList.add('show'); setTimeout(()=>x.classList.remove('show'),1800); }

function renderReaderBar(){
  const current = state.reciters.find(r=>r.id===state.readerId);
  $('#current-reader').textContent = current?.name || 'اختر القارئ';
  $('#current-riwaya').textContent = riwayat[state.riwaya].short;
}
function normalizeReciters(payload){
  return (payload.reciters||[]).map(r=>({...r,moshaf:(r.moshaf||[])})).filter(r=>r.moshaf?.length);
}
function readerHasRiwaya(r){
  const n=(r.moshaf||[]).map(m=>m.name).join(' ');
  const k=riwayat[state.riwaya].name;
  return n.includes(k.split(' عن ')[0]) || n.includes(riwayat[state.riwaya].short);
}
function moshafForReader(r){
  const list=r.moshaf||[];
  return list.find(m=>readerHasMos(m)) || list.find(m=>/حفص/.test(m.name)) || list[0];
}
function readerHasMos(m){
  const n=m?.name||'';
  const names={hafs:['حفص'],warsh:['ورش'],qaloon:['قالون'],doori:['الدوري'],soosi:['السوسي'],shouba:['شعبة']};
  return (names[state.riwaya]||[]).some(x=>n.includes(x));
}
function renderReciterUI(filter=''){
  const wraps=$$('#reciters-list'); if(!wraps.length) return;
  let arr=state.reciters.filter(readerHasRiwaya);
  const q=filter.trim();
  if(q) arr=arr.filter(r=>r.name.includes(q));
  $('#reciter-count').textContent=arabicDigits(arr.length);
  const markup=arr.map(r=>{
    const selected=r.id===state.readerId;
    const mos=moshafForReader(r);
    return `<button class="reader-row ${selected?'selected':''}" data-reader="${r.id}">
      <span class="avatar">${(r.name||'?').slice(0,1)}</span>
      <span class="reader-copy"><b>${r.name}</b><small>${mos?.name||riwayat[state.riwaya].name}</small></span>
      <span class="chev">‹</span>
    </button>`
  }).join('') || `<div class="empty">لا توجد نتائج لهذه الرواية.</div>`;
  wraps.forEach(w=>w.innerHTML=markup);
  $$('.reader-row').forEach(b=>b.addEventListener('click',()=>{
    state.readerId=Number(b.dataset.reader); save();
    renderReciterUI($('#reciter-search')?.value||''); renderReaderBar(); closeSheet(); toast('تم اختيار القارئ');
  }));
}
function buildReciterSections(){
  const counts={};
  for(const r of state.reciters){
    (r.moshaf||[]).forEach(m=>{
      const n=m.name||'';
      for(const key of Object.keys(riwayat)) if(n.includes(riwayat[key].short)) counts[key]=(counts[key]||0)+1;
    });
  }
  $('#riwaya-summary').innerHTML=Object.entries(riwayat).map(([k,v])=>`<button class="chip ${k===state.riwaya?'active':''}" data-riwaya="${k}">${v.short}</button>`).join('');
  $$('.chip').forEach(x=>x.onclick=()=>{setRiwaya(x.dataset.riwaya);});
  $('#stat-readers').textContent=arabicDigits(state.reciters.length);
}
function audioUrl(){
  const r=state.reciters.find(x=>x.id===state.readerId);
  if(!r) return null;
  const m=moshafForReader(r);
  if(!m?.server) return null;
  const nums=String(state.sura).padStart(3,'0');
  return `${m.server}${nums}.mp3`;
}
function playCurrent(){
  const url=audioUrl();
  if(!url){toast('اختر قارئًا يملك هذه الرواية'); return;}
  state.audio.src=url;
  state.audio.play().then(()=>{ $('#play').textContent='❚❚'; }).catch(()=>toast('تعذر تشغيل التلاوة من المصدر'));
}
function toggleAudio(){
  if(!state.audio.src || state.audio.ended){ playCurrent(); return; }
  if(state.audio.paused){state.audio.play(); $('#play').textContent='❚❚';}
  else {state.audio.pause(); $('#play').textContent='▶';}
}
function wire(){
  $('#prev-page').onclick=()=>setPage(state.page-1);
  $('#next-page').onclick=()=>setPage(state.page+1);
  $('#play').onclick=toggleAudio;
  $('#riwaya-btn').onclick=()=>openSheet('riwayat');
  $('#reader-btn').onclick=()=>openSheet('readers');
  $('#settings-btn').onclick=()=>openSheet('settings');
  $('#index-btn').onclick=()=>openSheet('index');
  $('#close-sheet').onclick=closeSheet;
  $('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet') closeSheet();});
  $('#search').addEventListener('input',e=>{
    const q=e.target.value.trim();
    if(q && /^\d+$/.test(q)) setPage(Number(q));
  });
  $('#font-sm').onclick=()=>{state.fontSize=Math.max(0,state.fontSize-1);save();renderPage();};
  $('#font-lg').onclick=()=>{state.fontSize=Math.min(5,state.fontSize+1);save();renderPage();};
  $('#day-mode').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';localStorage.setItem('samee3_theme',state.theme);applyTheme();};
  $('#go-page').onclick=()=>{ const p=prompt('رقم الصفحة من 1 إلى 604'); if(p) setPage(p); };
  $('#surah-picker').onclick=()=>openSheet('index');
  $('#reciter-search').addEventListener('input',e=>renderReciterUI(e.target.value));
  $('#surah-search').addEventListener('input',e=>renderIndex(e.target.value));
  $('#riwaya-select').addEventListener('change',e=>setRiwaya(e.target.value));
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>{
    state.activeNav=b.dataset.nav; save();
    $$('.nav-item').forEach(x=>x.classList.toggle('active',x===b));
    showView(state.activeNav);
  }));
  $('#home-btn').onclick=()=>{state.activeNav='mushaf';save();showView('mushaf');};
  $('#back-mushaf').onclick=()=>{state.activeNav='mushaf';save();showView('mushaf');};
}
function applyTheme(){
  document.documentElement.dataset.theme=state.theme;
  $('#theme-status').textContent=state.theme==='dark'?'الوضع الليلي':'الوضع النهاري';
}
function showView(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.nav===view));
  if(view==='audio') renderReciterUI($('#reciter-search')?.value||'');
  if(view==='index') renderIndex();
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderIndex(q=''){
  const list=$('#surah-list'); if(!list) return;
  const arr=state.surahs.filter(s=>!q||s.name.includes(q));
  list.innerHTML=arr.map(s=>`<button class="surah-row" data-sura="${s.id}"><span class="surah-num">${arabicDigits(s.id)}</span><span><b>${s.name}</b><small>${s.makkiah?'مكية':'مدنية'} • ${arabicDigits(s.ayahs)} آية</small></span><span class="chev">‹</span></button>`).join('');
  $$('.surah-row').forEach(b=>b.onclick=async()=>{
    state.sura=Number(b.dataset.sura);
    const rows=await loadQuran(state.riwaya); const norm=rows.map(normalizeRow); const first=norm.find(x=>x.sura===state.sura); if(first) await setPage(first.page); closeSheet(); showView('mushaf');
  });
}
async function boot(){
  applyTheme(); applyFont(); wire();
  try{
    const [sres,rres]=await Promise.all([fetch(API.suwar),fetch(API.reciters)]);
    const sjson=await sres.json(); const rjson=await rres.json();
    state.surahs=(sjson.suwar||[]).map(s=>({id:Number(s.id),name:s.name||s.name_ar||'',ayahs:Number(s.ayahs||s.ayahs_count||0),makkiah: s.type ? /مكي/i.test(s.type) : false, page:Number(s.start_page||1)}));
    state.reciters=normalizeReciters(rjson);
  }catch(e){
    console.warn(e); toast('تعذر تحميل مكتبة القراء الآن');
  }
  $('#riwaya-select').innerHTML=Object.entries(riwayat).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
  $('#riwaya-select').value=state.riwaya;
  buildReciterSections(); renderReciterUI(); renderReaderBar(); renderIndex();
  await setPage(state.page);
  // Bottom player
  state.audio.addEventListener('ended',()=>{$('#play').textContent='▶';});
}
boot();
