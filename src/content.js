const QP='https://api.quranpedia.net/v1';
const QE='https://quranenc.com/api/v1';
const HA='https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';

export async function fetchTafsirBooks(surah=1){
  const r=await fetch(`${QP}/surah/tafsirs/${surah}`); if(!r.ok) throw new Error('تعذر تحميل التفاسير'); return r.json();
}
export async function fetchTafsir(surah,ayah,bookId=1){
  const r=await fetch(`${QP}/ayah/${surah}/${ayah}/book/${bookId}`); if(!r.ok) throw new Error('تعذر تحميل التفسير'); return r.json();
}
export async function fetchTopics(){const r=await fetch(`${QP}/topics`);if(!r.ok)throw new Error('تعذر تحميل الموضوعات');return r.json();}
export async function searchQuranpedia(q,type=''){const u=`${QP}/search/${encodeURIComponent(q)}${type?`/${type}`:''}`;const r=await fetch(u);if(!r.ok)throw new Error('تعذر تنفيذ البحث');return r.json();}
export async function fetchTranslations(){const r=await fetch(`${QE}/translations/list`);if(!r.ok)throw new Error('تعذر تحميل الترجمات');return r.json();}
export async function fetchHadithEdition(slug){
  const urls=[`${HA}/editions/${slug}.min.json`,`${HA}/editions/${slug}.json`,`https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${slug}.min.json`];
  for(const u of urls){try{const r=await fetch(u); if(r.ok)return r.json();}catch{} }
  throw new Error('تعذر تحميل الكتاب');
}
export const HADITH_BOOKS=[
 {slug:'ara-nawawi',name:'الأربعين النووية'},
 {slug:'ara-bukhari',name:'صحيح البخاري'},
 {slug:'ara-muslim',name:'صحيح مسلم'},
 {slug:'ara-abudawud',name:'سنن أبي داود'},
 {slug:'ara-tirmidhi',name:'جامع الترمذي'},
 {slug:'ara-nasai',name:'السنن الصغرى للنسائي'},
 {slug:'ara-ibnmajah',name:'سنن ابن ماجه'},
 {slug:'ara-malik',name:'موطأ الإمام مالك'},
 {slug:'ara-ahmad',name:'مسند الإمام أحمد بن حنبل',status:'requires-source'},
 {slug:'ara-darimi',name:'سنن الدارمي',status:'requires-source'}
];
