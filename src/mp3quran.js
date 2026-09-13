const API='https://www.mp3quran.net/api/v3';
let cache=null;
export async function loadReciters(){
  if(cache) return cache;
  const res=await fetch(`${API}/reciters?language=ar`);
  if(!res.ok) throw new Error('تعذر تحميل القراء من MP3Quran');
  const data=await res.json();
  cache=(data.reciters||[]).flatMap(rec=>(rec.moshaf||[]).map(m=>({id:`${rec.id}:${m.id||m.name}`,reciterId:rec.id,name:rec.name,moshafId:m.id,nameMoshaf:m.name,server:m.server,surahList:String(m.surah_list||'').split(',').map(Number).filter(Boolean),rawi:detectRawi(m.name),type:detectType(m.name)})));
  return cache;
}
function detectRawi(name=''){
  for(const x of ['حفص','ورش','قالون','شعبة','الدوري','السوسي','خلف','البزي','قنبل','أبو الحارث','الدوري']) if(name.includes(x)) return x;
  return 'حفص';
}
function detectType(name=''){
  if(name.includes('مجود')) return 'مجود';
  if(name.includes('حدر')) return 'حدر';
  if(name.includes('تعليمي')||name.includes('معلم')) return 'تعليمي';
  if(name.includes('مترجم')) return 'مترجم';
  return 'مرتل';
}
export function rawiMatches(audioRawi,riwayah){
  if(riwayah==='hafs') return !['ورش','قالون','شعبة','الدوري','السوسي','خلف','البزي','قنبل','أبو الحارث'].includes(audioRawi);
  return audioRawi==={warsh:'ورش',qaloon:'قالون',doori:'الدوري',soosi:'السوسي',shouba:'شعبة'}[riwayah];
}
export function recitationsForRiwayah(all,riwayah){return all.filter(x=>rawiMatches(x.rawi,riwayah));}
export function audioUrl(rec, surah){return `${rec.server}${String(surah).padStart(3,'0')}.mp3`;}
export function directReciterSearch(all,q){
  const n=(q||'').trim(); if(!n) return all;
  return all.filter(x=>x.name.includes(n)||x.nameMoshaf.includes(n));
}
