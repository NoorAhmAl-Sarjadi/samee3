export async function getPrayerTimes(lat,lon,date=new Date()){
 const d=new Date(date); const dateStr=`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
 const r=await fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=4`); if(!r.ok)throw new Error('تعذر تحميل مواقيت الصلاة'); return r.json();
}
