const BASE='https://www.mp3quran.net/api/v3';
const cache=new Map();
async function get(url){if(cache.has(url))return cache.get(url);const r=await fetch(url);if(!r.ok)throw new Error(`MP3Quran ${r.status}`);const j=await r.json();cache.set(url,j);return j;}
export async function getReciters({rewaya,sura}={}){const p=new URLSearchParams({language:'ar'});if(rewaya)p.set('rewaya',rewaya);if(sura)p.set('sura',sura);const j=await get(`${BASE}/reciters?${p}`);return (j.reciters||[]).flatMap(r=>(r.moshaf||[]).map(m=>({reciterId:r.id,name:r.name,letter:r.letter,moshafId:m.id,moshafName:m.name,server:m.server,surahTotal:m.surah_total,surahList:String(m.surah_list||'').split(',').filter(Boolean).map(Number),moshafType:m.moshaf_type})));}
export async function getSuwar(){const j=await get(`${BASE}/suwar?language=ar`);return j.suwar||[];}
export async function getTimings(read,surah){const j=await get(`${BASE}/ayat_timing?read=${encodeURIComponent(read)}&surah=${surah}`);return Array.isArray(j)?j:[];}
export async function getTimingReads(){const j=await get(`${BASE}/ayat_timing/reads`);return Array.isArray(j)?j:[];}
export function audioUrl(server,surah){return `${server}${String(surah).padStart(3,'0')}.mp3`;}
export async function getRiwayat(){const j=await get(`${BASE}/riwayat?language=ar`);return j.riwayat||j.rewayat||[];}
