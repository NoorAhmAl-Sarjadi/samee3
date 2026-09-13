export async function getPrayerTimes(lat,lon,date=new Date()){
  const d=`${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${date.getFullYear()}`;
  const r=await fetch(`https://api.aladhan.com/v1/timings/${d}?latitude=${lat}&longitude=${lon}&method=4`);
  if(!r.ok) throw new Error('تعذر تحميل مواقيت الصلاة');
  return r.json();
}
export function nextPrayer(timings,now=new Date()){
  const order=[['Fajr','الفجر'],['Dhuhr','الظهر'],['Asr','العصر'],['Maghrib','المغرب'],['Isha','العشاء']];
  const minutes=now.getHours()*60+now.getMinutes();
  for(const [key,name] of order){const [h,m]=String(timings[key]||'00:00').split(':').map(Number);if(h*60+m>minutes)return {key,name,minutes:h*60+m};}
  const [h,m]=String(timings.Fajr||'00:00').split(':').map(Number);return {key:'Fajr',name:'الفجر',minutes:h*60+m+1440};
}
