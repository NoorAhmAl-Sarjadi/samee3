export const RIWAYAT = {
  hafs:{label:'حفص عن عاصم',file:'hafs.json',font:'Hafs',rawi:'حفص'},
  warsh:{label:'ورش عن نافع',file:'warsh.json',font:'Warsh',rawi:'ورش'},
  qaloon:{label:'قالون عن نافع',file:'qaloon.json',font:'Qaloon',rawi:'قالون'},
  doori:{label:'الدوري عن أبي عمرو',file:'doori.json',font:'Doory',rawi:'الدوري'},
  soosi:{label:'السوسي عن أبي عمرو',file:'soosi.json',font:'Soosi',rawi:'السوسي'},
  shouba:{label:'شعبة عن عاصم',file:'shouba.json',font:'Shouba',rawi:'شعبة'}
};

const SURAH_NAMES = [
'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'];

export function normalizeRow(raw){
  return {
    ...raw,
    id:Number(raw.id),
    page:Number(raw.page),
    sora:Number(raw.sora ?? raw.sura_no),
    aya_no:Number(raw.aya_no),
    jozz:Number(raw.jozz),
    line_start:Number(raw.line_start??0),
    line_end:Number(raw.line_end??0),
    name:raw.sora_name_ar||SURAH_NAMES[(Number(raw.sora??raw.sura_no)||1)-1]||''
  };
}

export async function loadRiwayah(id){
  const cfg=RIWAYAT[id];
  const res=await fetch(`./public/data/riwayat/${cfg.file}`,{cache:'force-cache'});
  if(!res.ok) throw new Error(`تعذر تحميل ${cfg.label}`);
  const rows=(await res.json()).map(normalizeRow);
  const pages=new Map();
  const ayahById=new Map();
  const surahs=[];
  for(const row of rows){
    if(!pages.has(row.page)) pages.set(row.page,[]);
    pages.get(row.page).push(row);
    ayahById.set(row.id,row);
    if(!surahs.some(s=>s.id===row.sora)) surahs.push({id:row.sora,name:row.name,page:row.page,juz:row.jozz});
  }
  surahs.sort((a,b)=>a.id-b.id);
  return {rows,pages,ayahById,surahs};
}

export function arabicDigits(value){return String(value).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);}
export function stripPrefix(name=''){return name.replace(/^سورة\s*/,'').replace(/[ًٌٍَُِْـ]/g,'').trim();}
export function searchRows(rows,q){
  const normalized=(q||'').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').trim();
  if(!normalized) return [];
  return rows.filter(r=>(r.aya_text_emlaey||r.aya_text||'').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').includes(normalized)).slice(0,80);
}

export function juzStartPages(rows){
  const out=[]; for(let j=1;j<=30;j++){const r=rows.find(x=>x.jozz===j);out.push(r?{j,page:r.page}:null);} return out;
}
