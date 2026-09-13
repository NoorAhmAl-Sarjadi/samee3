const BASE='https://quranenc.com/api/v1';
const KEY='arabic_moyassar';
const cache=new Map();
async function request(url){if(cache.has(url))return cache.get(url);const r=await fetch(url);if(!r.ok)throw new Error('تعذر تحميل التفسير');const j=await r.json();cache.set(url,j);return j;}
export async function tafsirAya(sura,aya){const j=await request(`${BASE}/translation/aya/${KEY}/${sura}/${aya}`);return Array.isArray(j)?j[0]:j;}
export async function tafsirSura(sura){return request(`${BASE}/translation/sura/${KEY}/${sura}`);}
export const TAFSIR_SOURCE='التفسير الميسر — QuranEnc / مجمع الملك فهد';
