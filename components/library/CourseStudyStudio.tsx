'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { loadYoutubePlayer, youtubeSource, type StudyPlayer } from '@/lib/islamic/youtube-player'
import type { LearningCourse } from '@/lib/islamic/curriculum'
import PdfBookReader from './PdfBookReader'

type Source = { key: string; label: string; url: string; list?: string; ids?: string[]; titles?: string[] }
function sourcesFor(book: LearningCourse): Source[] {
  const sources: Source[] = [], individual: { id: string; title: string }[] = []
  const seen = new Set<string>()
  for (const video of [...(book.videoUrl ? [{ title: book.videoAuthor ? `شرح ${book.videoAuthor}` : 'قائمة الشرح', url: book.videoUrl, order: -1 }] : []), ...(book.videos || []).slice().sort((a,b)=>(a.order||0)-(b.order||0))]) {
    const parsed = youtubeSource(video.url); if (!parsed) continue
    const key = parsed.list || parsed.video!; if (seen.has(key)) continue; seen.add(key)
    if (parsed.list) sources.push({key,label:video.title,url:video.url,list:parsed.list})
    else individual.push({id:parsed.video!,title:video.title})
  }
  if (individual.length) sources.push({key:'lessons-'+individual.map((video)=>video.id).join('-'),label:individual.length>1?'الدروس المرتبة':individual[0].title,url:`https://www.youtube.com/watch?v=${individual[0].id}`,ids:individual.map((video)=>video.id),titles:individual.map((video)=>video.title)})
  return sources
}
export default function CourseStudyStudio({ book }: { book: LearningCourse }) {
  const sources = useMemo(()=>sourcesFor(book),[book.videoUrl,book.videos,book.videoAuthor])
  const [selected, setSelected] = useState(''), [ids, setIds] = useState<string[]>([]), [index, setIndex] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0), [query, setQuery] = useState(''), [part, setPart] = useState(0)
  const host = useRef<HTMLDivElement>(null), player = useRef<StudyPlayer | null>(null)
  const source = sources.find((item)=>item.key===selected) || sources[0]
  const sourceSignature = JSON.stringify(source)
  const pdfParts = book.pdfParts?.length ? book.pdfParts : book.downloadUrl ? [{ label:'نسخة الكتاب', url:book.downloadUrl }] : []
  useEffect(()=>{
    let alive=true, current:StudyPlayer|null=null, interval:ReturnType<typeof setInterval>|undefined
    setReady(false);setError('');setIds([]);setIndex(0)
    if(!source || !host.current)return
    const memoryKey=`samee3_study_v1:${book.id}:${source.key}`
    let savedIndex=0,savedTime=0
    try{const saved=JSON.parse(localStorage.getItem(memoryKey)||'{}');savedIndex=Math.max(0,Math.floor(Number(saved.index)||0));savedTime=Math.max(0,Number(saved.time)||0)}catch{}
    let lastSave=0
    const sync=()=>{
      if(!alive||!current)return
      const list=current.getPlaylist() || source.ids || []
      if(list.length) {
        setIds((old)=>old.length===list.length&&old.every((id,i)=>id===list[i])?old:list)
        const at=Math.max(0,current.getPlaylistIndex());setIndex(at)
        if(Date.now()-lastSave>4000){lastSave=Date.now();try{localStorage.setItem(memoryKey,JSON.stringify({index:at,time:Math.floor(current.getCurrentTime()||0)}))}catch{}}
      }
    }
    void loadYoutubePlayer().then((api)=>{
      if(!alive||!host.current)return
      const target=document.createElement('div');host.current.replaceChildren(target)
      current=new api.Player(target,{width:'100%',height:'100%',host:'https://www.youtube-nocookie.com',playerVars:{origin:location.origin,playsinline:1,rel:0,autoplay:0},events:{
        onReady:(event)=>{
          if(!alive)return
          current=event.target;player.current=current;current.getIframe().title=`شرح ${book.title}`
          if(source.list)current.cuePlaylist({list:source.list,listType:'playlist',index:savedIndex,startSeconds:savedTime})
          else current.cuePlaylist(source.ids||[],Math.min(savedIndex,(source.ids?.length||1)-1),savedTime)
          setReady(true);sync();interval=setInterval(sync,1000)
        },
        onStateChange:()=>sync(),
        onError:(event)=>{if(alive)setError(event.data===101||event.data===150?'الناشر يمنع تضمين هذا الدرس. افتحه في YouTube أو اختر درسًا آخر.':'تعذر تشغيل هذا الدرس من YouTube. اختر درسًا آخر أو افتح المصدر.')},
      }})
    }).catch((e:unknown)=>{if(alive)setError(e instanceof Error?e.message:'تعذر تحميل المشغل.')})
    return ()=>{
      if(current){try{const at=Math.max(0,current.getPlaylistIndex());localStorage.setItem(memoryKey,JSON.stringify({index:at,time:Math.floor(current.getCurrentTime()||0)}))}catch{}}
      alive=false;clearInterval(interval);if(player.current===current)player.current=null;try{current?.destroy()}catch{}
    }
  // Source identity changes only when the selected playlist or its lesson sequence changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[book.id,sourceSignature,retry])
  const selectLesson=(at:number)=>{setError('');player.current?.playVideoAt(at);setIndex(at)}
  const activeUrl=source?.list?`${source.url}${source.url.includes('?')?'&':'?'}index=${index+1}`:ids[index]?`https://www.youtube.com/watch?v=${ids[index]}`:source?.url
  const button='inline-flex items-center justify-center gap-1 rounded-xl border border-[#d2c4a7] bg-white px-3 py-2 text-xs font-bold disabled:opacity-30'
  const lessons=ids.map((id,i)=>({id,index:i,title:source?.titles?.[i]||`الدرس ${i+1}`})).filter((lesson)=>`${lesson.title} ${lesson.index+1}`.includes(query.trim()))
  return <div className="space-y-4">
    {sources.length>1 && <label className="block text-xs font-bold">قوائم شروح الكتاب<select className="mt-2 w-full rounded-xl border bg-white p-3" value={source?.key||''} onChange={(event)=>{setSelected(event.target.value);setQuery('')}}>{sources.map((item)=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>}
    <section className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-[#ded3bd] bg-[#f7f2e7] shadow-sm">
      <div className="relative aspect-video max-h-[42dvh] w-full bg-[#102e32]">
        {!ready && source && !error && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white"><Loader2 size={20} className="animate-spin"/>جارٍ تحميل الشرح…</div>}
        {!source && <p className="p-5 text-sm leading-8 text-white">لم يُربط بهذا الكتاب شرح مرئي متحقق بعد. يمكنك القراءة وإضافة الشرح من إدارة المكتبة.</p>}
        <div ref={host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2 p-2"><button type="button" className={button} disabled={!ready||index<=0} onClick={()=>selectLesson(index-1)}><ChevronRight size={16}/>السابق</button><span aria-live="polite" className="ml-auto text-xs">{ids.length?`الدرس ${index+1} من ${ids.length}`:'الدروس المنشورة لدى الناشر'}</span><button type="button" className={button} disabled={!ready||!ids.length||index>=ids.length-1} onClick={()=>selectLesson(index+1)}>التالي<ChevronLeft size={16}/></button>{activeUrl&&<a className={button} href={activeUrl} target="_blank" rel="noopener noreferrer" aria-label="فتح الشرح في YouTube"><ExternalLink size={16}/></a>}</div>
    </section>
    {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs leading-7 text-amber-900">{error}<button type="button" onClick={()=>setRetry((value)=>value+1)} className="mr-2 inline-flex items-center gap-1 underline"><RotateCcw size={13}/>إعادة المحاولة</button></p>}
    <details className="rounded-2xl border bg-white p-3"><summary className="cursor-pointer text-sm font-bold">قائمة الدروس {ids.length?`(${ids.length})`:''}</summary><p className="my-2 text-xs leading-6 text-slate-500">تُحمّل قائمة الناشر بكل دروسها المتاحة، ويمكن الانتقال بينها من هنا أو من المشغل. دروس YouTube تحتاج اتصالًا بالإنترنت.</p><input aria-label="البحث برقم الدرس" placeholder="اذهب إلى رقم الدرس…" value={query} onChange={(event)=>setQuery(event.target.value)} className="mb-3 w-full rounded-xl border p-3 text-xs"/><div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">{lessons.map((lesson)=><button type="button" key={`${lesson.id}:${lesson.index}`} aria-current={index===lesson.index?'true':undefined} className={`${button} ${index===lesson.index?'!bg-[#1b5152] !text-white':''}`} onClick={()=>selectLesson(lesson.index)}>{lesson.title}</button>)}</div>{!ids.length&&<p className="p-2 text-xs text-slate-500">ابدأ تشغيل القائمة ليعرض YouTube الدروس المتاحة. يمكنك فتح قائمة الناشر من زر المصدر.</p>}</details>
    {pdfParts.length>1&&<label className="block text-xs font-bold">جزء الكتاب<select className="mt-2 w-full rounded-xl border bg-white p-3" value={part} onChange={(event)=>setPart(Number(event.target.value))}>{pdfParts.map((pdf,i)=><option key={pdf.url} value={i}>{pdf.label}</option>)}</select></label>}
    <PdfBookReader key={`${book.id}:${pdfParts[part]?.url||''}`} bookId={book.id} title={book.title} url={pdfParts[part]?.url} readingUrl={book.readingUrl}/>
  </div>
}