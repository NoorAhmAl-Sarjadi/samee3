const BASE='https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
const FALLBACK='https://raw.githubusercontent.com/fawazahmed0/hadith-api/1';
const cache=new Map();
let editionsCache=null;

async function fetchJson(path){
  const key=path;
  if(cache.has(key)) return cache.get(key);
  let last;
  for(const root of [BASE,FALLBACK]){
    try{const r=await fetch(`${root}/${path}`);if(!r.ok)throw new Error(`${r.status}`);const j=await r.json();cache.set(key,j);return j;}catch(e){last=e;}
  }
  throw last||new Error('تعذر تحميل بيانات الحديث');
}

export async function getArabicEditions(){
  if(editionsCache)return editionsCache;
  const data=await fetchJson('editions.json');
  const out=[];
  for(const [book,meta] of Object.entries(data||{})){
    const cols=Array.isArray(meta?.collection)?meta.collection:[];
    for(const item of cols){
      if(item?.language==='Arabic' && String(item.name||'').startsWith('ara-')){
        out.push({id:String(item.name).slice(4),edition:item.name,book,author:item.author||'',title:meta.name||book,link:item.link||null});
      }
    }
  }
  editionsCache=out;
  return out;
}

export async function getBook(bookId){
  return fetchJson(`editions/ara-${bookId}.json`);
}

export async function searchHadith(queryText,{book='all',limit=40}={}){
  const q=String(queryText||'').trim(); if(!q)return [];
  const editions=await getArabicEditions();
  const chosen=book==='all'?editions:editions.filter(x=>x.id===book||x.book===book).slice(0,1);
  const out=[];
  for(const meta of chosen){
    if(out.length>=limit)break;
    try{
      const data=await getBook(meta.id); const hs=Array.isArray(data?.hadiths)?data.hadiths:[];
      for(const h of hs){
        const text=String(h.text||'');
        if(text.includes(q)){
          out.push({bookId:meta.id,bookName:meta.title||meta.id,number:h.hadithnumber,text,reference:h.reference||null});
          if(out.length>=limit)break;
        }
      }
    }catch{}
  }
  return out;
}
