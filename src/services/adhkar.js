const URL='https://raw.githubusercontent.com/asellam/HisnElMuslim/main/hisn.json';
let cache=null;
export async function getAdhkar(){
  if(cache)return cache;
  const r=await fetch(URL);if(!r.ok)throw new Error('تعذر تحميل الأذكار');
  cache=await r.json();return cache;
}
export const ADHKAR_SOURCE='حصن المسلم — سعيد بن علي بن وهف القحطاني؛ بيانات JSON في مستودع مفتوح مرخص MIT. راجع الترخيص والمصدر قبل أي إعادة توزيع.';
