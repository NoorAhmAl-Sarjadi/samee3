'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ChevronLeft, Download, ImagePlus, Loader2, Pause, Play, RotateCcw, Settings2, Share2, Sparkles, X } from 'lucide-react'

type Chapter = { id:number; name:string; count:number }
type Reader = { id:string; name:string }
type Font = { id:string; name:string }
type Choices = { surah:number; from:number; to:number; reciter:string; translation:string }
type Design = { template:string; color:string; accent:string; translationColor:string; size:number; darkness:number; font:string; signature:string; frame:boolean; gc1:string; gc2:string; ratio:string; quality:number }
type Ready = { duration:number; count:number; chapter:string; reciter:string }
type Result = { blob:Blob; name:string; url:string }
const PRESETS = [
 {id:'emerald',name:'زمرد',sub:'هادئ وأصيل',a:'#175344',b:'#071e18',gold:'#d6bb81',asset:'',frame:true},
 {id:'night',name:'مصحف ليلي',sub:'أناقة الأسود والذهب',a:'#252114',b:'#050604',gold:'#e0c17b',asset:'',frame:true},
 {id:'river',name:'نسيم النهر',sub:'طبيعة مطمئنة',a:'#234a43',b:'#0c1e1b',gold:'#e3ddc5',asset:'river',frame:false},
 {id:'flower',name:'زهر',sub:'خفيف وناعم',a:'#775f6a',b:'#232b29',gold:'#f2e4dc',asset:'flower',frame:false},
 {id:'sand',name:'دفء الرمال',sub:'ألوان دافئة',a:'#7f694c',b:'#2b2318',gold:'#eddbb1',asset:'',frame:true},
 {id:'dunes',name:'كثبان',sub:'خلفية متحركة',a:'#705334',b:'#1c1712',gold:'#efd4a0',asset:'dunes',frame:false},
 {id:'rain',name:'نافذة المطر',sub:'خلفية متحركة',a:'#48535b',b:'#111a20',gold:'#e6e3d7',asset:'rain',frame:false},
 {id:'snow',name:'سكون الثلج',sub:'هدوء الشتاء',a:'#3a414d',b:'#111522',gold:'#e0e4ed',asset:'snow',frame:true},
 {id:'blue',name:'أفق',sub:'أزرق عميق',a:'#17465a',b:'#061b29',gold:'#cde1de',asset:'',frame:false},
]
const INITIAL:Design={template:'emerald',color:'#fff9e9',accent:'#d6bb81',translationColor:'#eee8db',size:110,darkness:40,font:'amiri',signature:'مصحف سميع',frame:true,gc1:'#175344',gc2:'#071e18',ratio:'9:16',quality:720}
const SAMPLE='ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ'
const input='mt-2 min-h-12 w-full rounded-2xl border border-[#e3dccd] bg-white px-3 py-3 text-sm outline-none focus:border-[#35695b] disabled:opacity-50'
const action='inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40'
const primary=action+' bg-[#255348] text-white shadow-[0_5px_18px_#25534820]'
const secondary=action+' border border-[#e3dccd] bg-white text-[#255348]'
const ar=(n:number)=>n.toLocaleString('ar-EG',{useGrouping:false})
const clock=(n:number)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')

export default function VisualAyahsPage(){
 const frame=useRef<HTMLIFrameElement>(null),ids=useRef(0),pending=useRef(0),canceling=useRef(false),mounted=useRef(true),lock=useRef<{release:()=>Promise<void>}|null>(null)
 const [step,setStep]=useState(1),[loaded,setLoaded]=useState(false),[version,setVersion]=useState(0)
 const [chapters,setChapters]=useState<Chapter[]>([]),[readers,setReaders]=useState<Reader[]>([]),[fonts,setFonts]=useState<Font[]>([])
 const [choice,setChoice]=useState<Choices>({surah:13,from:28,to:28,reciter:'husary',translation:'none'})
 const [design,setDesign]=useState<Design>(INITIAL),[file,setFile]=useState<File|null>(null),[hydrated,setHydrated]=useState(false)
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState<Ready|null>(null)
 const [backgroundOk,setBackgroundOk]=useState(false)
 const [playing,setPlaying]=useState(false),[time,setTime]=useState(0),[progress,setProgress]=useState(0),[prepareText,setPrepareText]=useState(''),[result,setResult]=useState<Result|null>(null)
 const styleRef=useRef(design);styleRef.current=design
 const selected=PRESETS.find(p=>p.id===design.template)||PRESETS[0],chapter=chapters.find(c=>c.id===choice.surah)
 const locked=Boolean(busy),exporting=busy==='export'||busy==='cancel'
 const send=(action:string,data:unknown={},id?:number)=>frame.current?.contentWindow?.postMessage({channel:'samee3-visual-v2',action,data,id},location.origin)
 const unlock=()=>{const window=frame.current?.contentWindow as (Window&{samee3StudioUnlock?:()=>Promise<unknown>})|null;void window?.samee3StudioUnlock?.().catch(()=>{})}
 const release=()=>{const current=lock.current;lock.current=null;if(current)void current.release().catch(()=>{})}
 function update(value:Partial<Design>){setDesign(old=>({...old,...value}));setResult(null)}
 function invalidate(value:Partial<Choices>){pending.current=++ids.current;send('invalidate');setChoice(old=>({...old,...value}));setReady(null);setPlaying(false);setTime(0);setResult(null);setError('');setNotice('')}
 function selectPreset(id:string){const p=PRESETS.find(p=>p.id===id)!;setFile(null);update({template:id,gc1:p.a,gc2:p.b,accent:p.gold,frame:p.frame});setStep(2)}
 function retry(){release();pending.current=++ids.current;setLoaded(false);setBusy('');setReady(null);setResult(null);setError('');setVersion(v=>v+1)}

 useEffect(()=>{
  mounted.current=true
  try{const saved=JSON.parse(localStorage.getItem('samee3_visual_studio_v2')||'null');if(saved&&PRESETS.some(p=>p.id===saved.template)){const p=PRESETS.find(p=>p.id===saved.template)!;setDesign({...INITIAL,template:p.id,gc1:p.a,gc2:p.b,accent:/^#[0-9a-f]{6}$/i.test(saved.accent)?saved.accent:p.gold,color:/^#[0-9a-f]{6}$/i.test(saved.color)?saved.color:INITIAL.color,translationColor:/^#[0-9a-f]{6}$/i.test(saved.translationColor)?saved.translationColor:INITIAL.translationColor,size:Math.max(65,Math.min(145,Number(saved.size)||110)),darkness:Math.max(0,Math.min(80,Number.isFinite(Number(saved.darkness))?Number(saved.darkness):40)),font:typeof saved.font==='string'?saved.font:'amiri',signature:typeof saved.signature==='string'?saved.signature.slice(0,60):INITIAL.signature,frame:typeof saved.frame==='boolean'?saved.frame:p.frame,ratio:['9:16','1:1','16:9'].includes(saved.ratio)?saved.ratio:'9:16',quality:[720,1080].includes(saved.quality)?saved.quality:720})}}catch{}
  setHydrated(true)
  const onMessage=(e:MessageEvent)=>{
   if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.channel!=='samee3-visual-v2')return
   const {event,data,id}=e.data;if(id&&id!==pending.current)return
   if(event==='ready'){setLoaded(true);setChapters(data.chapters);setReaders(data.reciters);setFonts(data.fonts);send('style',styleRef.current)}
   if(event==='preparing')setPrepareText('تحميل التلاوة '+ar(data.current)+' من '+ar(data.total))
   if(event==='prepared'){setReady(data);setBusy('');setPrepareText('');setTime(0);setStep(3)}
   if(event==='background'){setBusy('');setPlaying(false);setBackgroundOk(true);setError('')}
   if(event==='playback'){setPlaying(Boolean(data.playing));setTime(Number(data.time)||0)}
   if(event==='invalidated'){setReady(null);setPlaying(false)}
   if(event==='progress')setProgress(Math.max(0,Math.min(1,Number(data.value)||0)))
   if(event==='result'){release();setBusy('');setProgress(1);setResult({blob:data.blob,name:data.name,url:URL.createObjectURL(data.blob)});setNotice('الفيديو جاهز للحفظ والمشاركة.')}
   if(event==='canceled'){release();setBusy('');setNotice('تم إلغاء الإنشاء؛ يمكنك المحاولة من جديد.')}
   if(event==='error'){release();setBusy('');setPlaying(false);setPrepareText('');setError(String(data.message||'تعذر إكمال العملية.'))}
  }
  window.addEventListener('message',onMessage)
  return()=>{mounted.current=false;send('cancel');release();window.removeEventListener('message',onMessage)}
 },[])
 useEffect(()=>{if(loaded)send('style',design)},[loaded,design])
 useEffect(()=>{if(step!==3){send('stop');setPlaying(false)}},[step])
 useEffect(()=>{if(!loaded)return;const id=++ids.current;pending.current=id;setBusy('background');setBackgroundOk(false);setError('');send('background',{asset:file?'':selected.asset,file},id);setPlaying(false)},[loaded,selected.asset,file])
 useEffect(()=>{if(!hydrated)return;const timer=setTimeout(()=>{try{localStorage.setItem('samee3_visual_studio_v2',JSON.stringify(design))}catch{}},400);return()=>clearTimeout(timer)},[design,hydrated])
 useEffect(()=>{if(!result)return;return()=>URL.revokeObjectURL(result.url)},[result])
 useEffect(()=>{if(loaded)return;send('hello');const ping=setInterval(()=>send('hello'),800);const timer=setTimeout(()=>setError('استغرق الاتصال بالمحرر وقتًا طويلًا. اضغط إعادة المحاولة.'),65000);return()=>{clearInterval(ping);clearTimeout(timer)}},[loaded,version])

 function prepare(){unlock();const id=++ids.current;pending.current=id;setBusy('prepare');setReady(null);setResult(null);setError('');setNotice('');setPrepareText('جارٍ تجهيز الآيات…');send('prepare',choice,id)}
 function quiet(){
  document.querySelectorAll<HTMLMediaElement>('audio,video').forEach(m=>m.pause())
  const audio=(window as Window&{__samee3PersistentAudio?:HTMLAudioElement&{__samee3Continue?:boolean}}).__samee3PersistentAudio
  if(audio){audio.__samee3Continue=false;audio.pause()}
 }
 async function exportVideo(){
  if(!ready||locked||!backgroundOk)return
  quiet();unlock()
  const id=++ids.current;pending.current=id;canceling.current=false;setBusy('export');setError('');setNotice('');setProgress(0);setResult(null);setPlaying(false)
  try{lock.current=await(navigator as Navigator&{wakeLock?:{request:(type:string)=>Promise<{release:()=>Promise<void>}>}}).wakeLock?.request('screen')||null}catch{}
  if(mounted.current&&!canceling.current)send('export',{},id);else{release();if(mounted.current){setBusy('');setNotice('تم إلغاء الإنشاء.')}}
 }
 async function share(){if(!result)return;try{const file=new File([result.blob],result.name,{type:result.blob.type});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'آيات مرئية — سميع'});else setNotice('نزّل الفيديو أولًا ثم شاركه من جهازك.')}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError('تعذرت المشاركة. استخدم زر تنزيل الفيديو.')}}

 return <main dir="rtl" translate="no" className="min-h-screen bg-[#f5f1e7] pb-36 text-[#263c33]">
  <header className="border-b border-[#e5ddcd] bg-[#faf7ee] px-4 py-5"><div className="mx-auto flex max-w-6xl items-center gap-3"><Link href="/" aria-label="العودة إلى الرئيسية" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e4dccd] bg-white"><ArrowRight size={20}/></Link><div className="flex-1"><h1 className="text-xl font-extrabold">آيات مرئية</h1><p className="mt-1 text-xs text-[#7a8176]">آيات تختارها… ومقطع يحمل أثرها</p></div><span className="rounded-2xl bg-[#e5ecdf] p-3 text-[#35695b]"><Sparkles size={21}/></span></div></header>
  <div className="mx-auto max-w-6xl px-4 py-6">
   <nav aria-label="خطوات إنشاء الفيديو" className="mb-6 grid grid-cols-3 gap-2">{['اختر القالب','الآيات والتلاوة','المعاينة والحفظ'].map((title,i)=><button key={title} type="button" disabled={locked||i===2&&!ready} onClick={()=>setStep(i+1)} aria-current={step===i+1?'step':undefined} className={'flex items-center justify-center gap-2 rounded-2xl px-2 py-3 text-xs font-bold transition '+(step===i+1?'bg-[#255348] text-white shadow-sm':'bg-[#eae6db] text-[#7a8176]')}><span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full '+(step===i+1?'bg-white/15':'bg-white/60')}>{step>i+1?<Check size={13}/>:ar(i+1)}</span>{title}</button>)}</nav>
   {error&&<div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800"><p className="flex-1">{error}</p><button aria-label="إغلاق التنبيه" onClick={()=>setError('')}><X size={18}/></button>{!loaded&&<button onClick={retry} className="shrink-0 underline">إعادة المحاولة</button>}</div>}
   {busy==='background'&&step!==3&&<p role="status" className="mb-4 flex items-center gap-2 text-xs text-[#6c7b6d]"><Loader2 size={14} className="animate-spin"/>جارٍ تحضير القالب…</p>}<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
    <section aria-hidden={step!==3} className={(step!==3?'max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:h-px max-lg:w-px max-lg:overflow-hidden max-lg:opacity-0 max-lg:pointer-events-none ':'')+'lg:order-2 lg:sticky lg:top-5'}>
     <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">{ready?'معاينة مقطعك':'معاينة القالب'}</h2><span className="text-xs text-[#818579]">{selected.name}</span></div>
     <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-[28px] bg-[#102b24] shadow-[0_12px_35px_#123a2420]" style={{aspectRatio:design.ratio.replace(':',' / '),maxHeight:'48dvh'}}>
      <iframe ref={frame} key={version} src="/api/gt-sqr/?engine=1&studio=2" title="معاينة فيديو الآيات" className="pointer-events-none absolute inset-0 h-full w-full border-0" allow="autoplay; screen-wake-lock" tabIndex={-1} onLoad={()=>send('hello')} />
      {!loaded&&<div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#173f34] px-6 text-center text-sm text-[#eee5d1]"><Loader2 size={25} className="animate-spin"/>جارٍ تجهيز المعاينة…</div>}
      {busy==='background'&&<div role="status" className="absolute inset-x-4 bottom-4 rounded-xl bg-black/65 px-3 py-2 text-center text-xs text-white">جارٍ تحميل الخلفية…</div>}
     </div>
     {ready?<div className="mx-auto mt-3 flex max-w-[340px] items-center gap-3 rounded-2xl border border-[#e4dccd] bg-white p-3"><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#255348] text-white disabled:opacity-40" disabled={locked} aria-label={playing?'إيقاف المعاينة':'تشغيل المعاينة'} onClick={()=>{quiet();unlock();send('play')}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><div className="flex-1"><progress value={Math.min(time,ready.duration)} max={ready.duration} className="h-1.5 w-full accent-[#35695b]"/><p className="mt-1 text-[11px] text-[#7a8176]" dir="ltr">{clock(time)} / {clock(ready.duration)}</p></div><button disabled={locked} aria-label="إعادة المعاينة من البداية" onClick={()=>send('restart')} className="p-2 text-[#6c7b6d]"><RotateCcw size={17}/></button></div>:<p className="mx-auto mt-3 max-w-xs text-center text-[11px] leading-6 text-[#818579]">المعروض مثال للقالب. جهّز الآيات لعرض اختيارك وتلاوته.</p>}
    </section>
    <section className="lg:order-1">
     {step===1&&<><div className="mb-5"><h2 className="text-2xl font-extrabold">ابدأ بما يلامس ذوقك</h2><p className="mt-2 text-sm leading-7 text-[#7a8176]">قوالب هادئة جاهزة، ويمكنك تخصيصها بعد اختيار الآيات.</p></div><div className="grid grid-cols-3 gap-3 sm:gap-4">{PRESETS.map(p=><button key={p.id} type="button" disabled={exporting||busy==='prepare'} onClick={()=>selectPreset(p.id)} aria-label={'اختيار قالب '+p.name} aria-pressed={selected.id===p.id} className="group text-center"><div className={'relative aspect-[3/4] overflow-hidden rounded-[20px] border-[3px] shadow-sm transition '+(selected.id===p.id?'border-[#35695b] ring-2 ring-[#35695b]/15':'border-transparent')} style={{background:'linear-gradient(150deg,'+p.a+','+p.b+')'}}>{p.asset&&<img src={'/api/gt-sqr/backgrounds/'+(p.asset==='dunes'?'dunes-poster':p.asset==='rain'?'rain-poster':p.asset)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-45"/>}{p.frame&&<div className="absolute inset-2 rounded-xl border opacity-50" style={{borderColor:p.gold}}/>}<span className="absolute inset-x-2 top-[12%] text-[8px] text-white/80">سورة الرعد</span><p className="absolute inset-x-3 top-[32%] text-[11px] leading-[1.8] text-[#fff9e9] sm:text-sm" style={{fontFamily:'"KFGQPC Uthmanic Script HAFS",serif'}}>{SAMPLE}</p>{selected.id===p.id&&<span className="absolute bottom-2 left-2 rounded-full bg-white p-1 text-[#35695b]"><Check size={13}/></span>}</div><span className="mt-2 block text-sm font-bold">{p.name}</span><span className="mt-1 block text-[10px] text-[#818579]">{p.sub}</span></button>)}</div><button className={primary+' mt-6 w-full'} disabled={locked||!backgroundOk} onClick={()=>setStep(2)}>اختيار الآيات والقارئ<ChevronLeft size={18}/></button></>}
     {step===2&&<div className="rounded-[28px] border border-[#e4dccd] bg-[#fcfaf4] p-5 sm:p-6"><h2 className="text-xl font-extrabold">أي الآيات تريد مشاركتها؟</h2><p className="mt-2 text-sm leading-7 text-[#7a8176]">اختر الآيات وصوت القارئ، وسنرتّب المقطع لك.</p><fieldset disabled={locked||!loaded} className="mt-5 space-y-4"><label className="block text-sm font-bold">السورة<select aria-label="السورة" className={input} value={choice.surah} onChange={e=>invalidate({surah:Number(e.target.value),from:1,to:1})}>{chapters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">من الآية<input aria-label="من الآية" className={input} type="number" min={1} max={chapter?.count||286} value={choice.from} onChange={e=>invalidate({from:Number(e.target.value)})}/></label><label className="text-sm font-bold">إلى الآية<input aria-label="إلى الآية" className={input} type="number" min={choice.from} max={chapter?.count||286} value={choice.to} onChange={e=>invalidate({to:Number(e.target.value)})}/></label></div><label className="block text-sm font-bold">القارئ<select aria-label="القارئ" className={input} value={choice.reciter} onChange={e=>invalidate({reciter:e.target.value})}>{readers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="block text-sm font-bold">إضافة ترجمة<select aria-label="الترجمة" className={input} value={choice.translation} onChange={e=>invalidate({translation:e.target.value})}><option value="none">بدون ترجمة</option><option value="en.sahih">الإنجليزية</option><option value="fr.hamidullah">الفرنسية</option></select></label><p className="text-xs leading-6 text-[#818579]">رواية حفص · حتى ١٠ آيات · ٩٠ ثانية · دون موسيقى</p></fieldset><button className={primary+' mt-5 w-full'} disabled={locked||!loaded} onClick={()=>ready?setStep(3):prepare()}>{busy==='prepare'?<><Loader2 className="animate-spin" size={18}/>{prepareText}</>:<>{ready?'متابعة إلى المعاينة':'تجهيز المعاينة'}<ChevronLeft size={18}/></>}</button>{busy==='prepare'&&<button className={secondary+' mt-3 w-full'} onClick={()=>{pending.current=++ids.current;send('cancel');setBusy('');setPrepareText('')}}>إلغاء التحميل</button>}</div>}
     {step===3&&ready&&<div className="space-y-4"><div className="rounded-[28px] border border-[#e4dccd] bg-[#fcfaf4] p-5 sm:p-6"><h2 className="text-2xl font-extrabold">مقطعك… بطابعك</h2><p className="mt-2 text-sm leading-7 text-[#7a8176]">استمع للمعاينة، ثم احفظ المقطع أو أضف لمستك.</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#e8ede2] px-3 py-2">{ready.chapter} · {ar(choice.from)}{choice.to!==choice.from?' — '+ar(choice.to):''}</span><span className="rounded-full bg-[#eee8db] px-3 py-2">{ready.reciter}</span><span className="rounded-full bg-[#eee8db] px-3 py-2">{clock(ready.duration)}</span></div></div>
      <details className="group rounded-[24px] border border-[#e4dccd] bg-white"><summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 font-bold"><Settings2 size={19} className="text-[#35695b]"/>تخصيص القالب<span className="mr-auto text-xs font-normal text-[#818579]">اختياري</span></summary><fieldset disabled={locked} className="space-y-5 border-t border-[#eee8db] p-5"><div className="grid grid-cols-3 gap-3">{[{key:'color',label:'الآيات'},{key:'accent',label:'العنوان والإطار'},{key:'translationColor',label:'الترجمة'}].map(c=><label key={c.key} className="text-xs font-bold">{c.label}<input aria-label={'لون '+c.label} type="color" value={design[c.key as 'color']} onChange={e=>update({[c.key]:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-[#e3dccd] bg-white p-1"/></label>)}</div><label className="block text-sm font-bold">خط الآيات<select aria-label="خط الآيات" className={input} value={design.font} onChange={e=>update({font:e.target.value})}>{fonts.map(f=><option key={f.id} value={f.id}>{f.name==='Uthmanic Hafs'?'الخط العثماني':f.name==='Amiri Quran'?'الأميري القرآني':'نسخ شهرزاد'}</option>)}</select></label><label className="block text-sm font-bold">حجم الآيات<input aria-label="حجم الآيات" type="range" min={65} max={145} value={design.size} onChange={e=>update({size:Number(e.target.value)})} className="mt-3 w-full accent-[#35695b]"/></label><label className="block text-sm font-bold">تعتيم الخلفية<input aria-label="تعتيم الخلفية" type="range" min={0} max={80} value={design.darkness} onChange={e=>update({darkness:Number(e.target.value)})} className="mt-3 w-full accent-[#35695b]"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.frame} onChange={e=>update({frame:e.target.checked})} className="accent-[#35695b]"/>إظهار الإطار</label><label className="block text-sm font-bold">التوقيع<input aria-label="التوقيع" className={input} value={design.signature} maxLength={60} onChange={e=>update({signature:e.target.value})}/></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">المقاس<select aria-label="المقاس" className={input} value={design.ratio} onChange={e=>update({ratio:e.target.value})}><option value="9:16">عمودي 9:16</option><option value="1:1">مربع 1:1</option><option value="16:9">أفقي 16:9</option></select></label><label className="text-sm font-bold">الجودة<select aria-label="الجودة" className={input} value={design.quality} onChange={e=>update({quality:Number(e.target.value)})}><option value={720}>720p</option><option value={1080}>1080p</option></select></label></div><label className={secondary+' w-full cursor-pointer'}><ImagePlus size={18}/>خلفية من جهازي<input aria-label="خلفية من جهازي" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>30*1024*1024){setError('اختر خلفية أصغر من ٣٠ ميجابايت.');return}setFile(f);setResult(null)}}/></label>{file&&<p className="text-xs text-[#818579]">{file.name}<button onClick={()=>setFile(null)} className="mr-3 underline">إزالة</button></p>}</fieldset></details>
      {exporting?<div role="status" className="rounded-[24px] border border-[#d7e1d1] bg-white p-5"><div className="flex items-center justify-between text-sm font-bold"><span>{busy==='cancel'?'جارٍ الإلغاء…':'جارٍ إنشاء الفيديو…'}</span><span>{ar(Math.round(progress*100))}٪</span></div><progress max={1} value={progress} className="mt-4 h-2 w-full accent-[#35695b]"/><p className="mt-3 text-xs leading-6 text-[#818579]">اترك الصفحة مفتوحة حتى يكتمل الفيديو.</p><button className={secondary+' mt-3 w-full'} disabled={busy==='cancel'} onClick={()=>{canceling.current=true;setBusy('cancel');send('cancel')}}>إلغاء الإنشاء</button></div>:<button className={primary+' w-full'} disabled={locked||!backgroundOk} onClick={()=>void exportVideo()}>{busy==='background'?<Loader2 size={18} className="animate-spin"/>:<Sparkles size={18}/>}إنشاء الفيديو</button>}
      {result&&<div className="rounded-[24px] border border-[#bfd3c3] bg-white p-5"><p className="mb-3 font-bold">تم إنشاء مقطعك <span className="mr-2 text-xs font-normal text-[#818579]">{result.blob.type.includes('mp4')?'MP4':'WebM'} · {(result.blob.size/1024/1024).toFixed(1)} MB</span></p><video src={result.url} onPlay={()=>{send('stop');setPlaying(false);const a=(window as Window&{__samee3PersistentAudio?:HTMLAudioElement}).__samee3PersistentAudio;a?.pause()}} controls playsInline className="max-h-80 w-full rounded-2xl bg-[#102b24]"/><div className="mt-4 flex gap-2"><a href={result.url} download={result.name} className={primary+' flex-1'}><Download size={18}/>تنزيل الفيديو</a><button className={secondary} onClick={()=>void share()}><Share2 size={18}/>مشاركة</button></div></div>}
      {notice&&<p role="status" className="rounded-2xl bg-[#e8ede2] p-3 text-sm leading-7 text-[#35695b]">{notice}</p>}
     </div>}
    </section>
   </div>
   <footer className="mt-8 text-center text-[10px] leading-7 text-[#8b8d80]">التلاوات من EveryAyah · بيانات الآيات من AlQuran.cloud · <a href="/api/gt-sqr/LICENSE" target="_blank" rel="noopener noreferrer" className="underline">ترخيص AGPL-3.0</a> · <a href="https://github.com/SalehGNUTUX/GT-SQR" target="_blank" rel="noopener noreferrer" className="underline">GT-SQR · SalehGNUTUX</a>{selected.asset&&!file&&<> · خلفيات <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline">Pexels</a></>}</footer>
  </div>
 </main>
}
// END OF SAMEE3 VISUAL STUDIO PAGE
