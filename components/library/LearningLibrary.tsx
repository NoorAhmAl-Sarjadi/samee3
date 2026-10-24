'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronLeft, Download, ExternalLink, GraduationCap, Headphones, Loader2, PlayCircle, Search, Share2, X } from 'lucide-react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { SUNNI_LIBRARY_CATEGORIES } from '@/lib/islamic/sunniLibrary'
import { LEARNING_COURSES, LEARNING_LEVELS, completedInLevel, courseById, coursesInLevel, normalizeLearningName, youtubeEmbed, type LearningCourse, type LevelId } from '@/lib/islamic/curriculum'
import { useLearningProgress, type LearningCertificate } from '@/lib/islamic/learning-progress'
import { safeIslamicLibraryLink } from '@/lib/islamic/safeLinks'
import Modal from '@/components/Modal'
import { cardBlob, downloadBlob, wrapCardText } from '@/lib/share-card'

const ar = (n: number) => n.toLocaleString('ar-EG')
const button = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d9ccb5] bg-white px-4 py-3 text-sm font-bold transition hover:border-[#a47a3e] disabled:opacity-50'
function Shell({ back, backLabel, eyebrow, title, children }: { back: string; backLabel: string; eyebrow: string; title: string; children: ReactNode }) {
  return <div dir="rtl" className="min-h-screen bg-[#f7f5ee] pb-28 text-[#203f43]"><div className="h-1 bg-gradient-to-l from-[#98713c] via-[#d9c39b] to-[#175759]" /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-10">
    <Link href={back} className="mb-7 inline-flex items-center gap-2 text-sm text-[#687b79]"><ArrowRight size={17} />{backLabel}</Link>
    <header className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold tracking-wide text-[#a47a3e]">{eyebrow}</p><h1 className="text-3xl font-black sm:text-4xl">{title}</h1></div><GraduationCap className="shrink-0 text-[#ad8b54]" size={38} /></header>{children}
  </main></div>
}
function Progress({ count, total, title = 'تقدمك في المستوى' }: { count: number; total: number; title?: string }) {
  const percent = total ? Math.round(count / total * 100) : 0
  return <div><div className="mb-2 flex justify-between gap-4 text-xs"><span>{title}</span><span>{ar(count)} من {ar(total)} · {ar(percent)}٪</span></div><div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={total} aria-valuenow={count} className="h-2 overflow-hidden rounded-full bg-[#dedbd0]"><div className="h-full rounded-full bg-gradient-to-l from-[#b08a4e] to-[#20706a] transition-all" style={{ width: `${percent}%` }} /></div></div>
}
function Status({ progress }: { progress: ReturnType<typeof useLearningProgress> }) {
  return <div className="my-5 text-xs leading-7 text-[#78857f]">{!progress.ready ? 'جارٍ استعادة تقدمك…' : !progress.user ? <>تقدمك محفوظ على هذا الجهاز. <Link href="/auth?next=/islamic-library" className="font-bold text-[#8e6935] underline">سجّل الدخول</Link> لحفظه في حسابك وإصدار شهادتك.</> : progress.pending ? 'توجد تغييرات محفوظة على الجهاز تنتظر المزامنة.' : 'تقدمك مرتبط بحسابك.'}{progress.user && progress.guestAvailable && <button type="button" disabled={progress.busy} onClick={() => void progress.importGuest()} className="mr-3 font-bold text-[#8e6935] underline">استيراد تقدم هذا الجهاز إلى حسابي</button>}{progress.error && <p role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900">{progress.error}</p>}</div>
}

export function LibraryHome() {
  const progress = useLearningProgress()
  return <Shell back="/" backLabel="الرئيسية" eyebrow="مكتبة سميع الشرعية" title="رحلتك في طلب العلم">
    <p className="mb-8 max-w-xl text-sm leading-8 text-[#6c7d77]">ثلاثة مستويات، وثمانية مجالات في كل مستوى. اقرأ الكتاب، تابع الشرح، وسجّل إتمام دراسته لتتابع رحلتك وتحصل على شهادة إتمام ذاتي باسمك.</p>
    <div className="grid gap-5 md:grid-cols-3">{LEARNING_LEVELS.map((level) => {
      const books = coursesInLevel(level.id), count = completedInLevel(level.id, progress.completed)
      return <Link key={level.id} href={`/islamic-library/level/${level.id}`} className="group relative overflow-hidden rounded-[28px] border border-[#dfd5c3] bg-[#fffefa] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-7">
        <span className="absolute left-5 top-1 font-serif text-8xl text-[#eee8d9]">{level.number}</span><div className="relative mb-14 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0e6d5] text-[#a47a3e]"><BookOpen size={25} /></div>
        <div className="relative"><p className="mb-2 text-xs text-[#9d8052]">ثمانية مجالات · {ar(books.length)} كتب</p><h2 className="mb-3 text-2xl font-black">{level.name}</h2><p className="mb-6 min-h-12 text-sm leading-7 text-[#76827b]">{level.description}</p><Progress count={count} total={books.length} /><span className="mt-6 flex items-center justify-between text-sm font-bold">{count > 0 ? 'تابع رحلتك' : 'اكتشف المستوى'}{progress.certificates[level.id] ? <Award size={20} className="text-[#ad8444]" /> : <ChevronLeft size={20} />}</span></div>
      </Link>
    })}</div><Status progress={progress} />
  </Shell>
}

export function LevelView({ levelId }: { levelId: LevelId }) {
  const progress = useLearningProgress(), level = LEARNING_LEVELS.find((item) => item.id === levelId)!
  const [certificateOpen, setCertificateOpen] = useState(false)
  const books = coursesInLevel(levelId), count = completedInLevel(levelId, progress.completed)
  return <Shell back="/islamic-library" backLabel="المستويات الثلاثة" eyebrow="اختر المجال، ثم اختر كتابك" title={level.name}>
    <section className="mb-7 rounded-3xl border border-[#cfc3a8] bg-[#163f43] p-5 text-[#f8f3e8] sm:p-7"><div className="grid items-center gap-5 sm:grid-cols-[1fr_auto]"><div><h2 className="mb-4 font-bold">خطوة جديدة في كل كتاب</h2><Progress count={count} total={books.length} /></div><button type="button" disabled={!progress.ready || (!progress.certificates[levelId] && count !== books.length)} onClick={() => setCertificateOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#bca16e] px-5 py-3 text-sm font-bold disabled:opacity-40"><Award size={21} />{progress.certificates[levelId] ? 'شهادتك المحفوظة' : 'شهادة المستوى'}</button></div><p className="mt-3 text-xs leading-6 text-[#b5cbc6]">تُتاح شهادة الإتمام الذاتي بعد دراسة كتب المستوى الثمانية. إصدار واحد لكل حساب ومستوى، مع الاحتفاظ بالشهادة نفسها.</p></section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SUNNI_LIBRARY_CATEGORIES.map((category, i) => {
      const related = books.filter((book) => book.category === category.id), done = related.filter((book) => progress.completed.includes(book.id)).length
      return <Link key={category.id} href={`/islamic-library/level/${levelId}/${category.id}`} className="rounded-3xl border border-[#e0d8c7] bg-white p-5 transition hover:border-[#ac894f]"><div className="mb-5 flex justify-between"><span className="text-xs text-[#a68d61]">{ar(i + 1).padStart(2, '٠')}</span>{done === related.length && done > 0 ? <CheckCircle2 size={23} className="text-[#2b7863]" /> : <BookOpen size={23} className="text-[#b39763]" />}</div><h2 className="text-lg font-black">{category.label}</h2><p className="mb-5 mt-2 text-xs text-[#7d8981]">{category.short}</p><Progress count={done} total={related.length} title="الكتب المكتملة" /></Link>
    })}</div><Status progress={progress} />
    {certificateOpen && <CertificateDialog levelId={levelId} existing={progress.certificates[levelId]} defaultName={progress.profile?.name || progress.user?.displayName || ''} signedIn={!!progress.user} issue={progress.issue} onClose={() => setCertificateOpen(false)} />}
  </Shell>
}

export function CategoryView({ levelId, categoryId }: { levelId: LevelId; categoryId: string }) {
  const progress = useLearningProgress(), [query, setQuery] = useState('')
  const category = SUNNI_LIBRARY_CATEGORIES.find((item) => item.id === categoryId)!, level = LEARNING_LEVELS.find((item) => item.id === levelId)!
  const books = coursesInLevel(levelId).filter((book) => book.category === categoryId)
  const filtered = books.filter((book) => `${book.title} ${book.author}`.includes(query.trim()))
  return <Shell back={`/islamic-library/level/${levelId}`} backLabel={level.name} eyebrow={`${level.name} / ${category.label}`} title={category.label}>
    <label className="mb-6 flex max-w-xl items-center gap-3 rounded-2xl border border-[#ddd2bc] bg-white px-4 py-3"><Search size={18} className="text-[#a88b54]" /><input aria-label="البحث في كتب المجال" placeholder="ابحث باسم الكتاب أو المؤلف" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" /></label>
    <div className="grid gap-4 sm:grid-cols-2">{filtered.map((book) => <Link key={book.id} href={`/islamic-library/book/${book.id}`} className="group flex gap-5 rounded-3xl border border-[#ded5c5] bg-white p-5 transition hover:shadow-md"><div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-l-2xl rounded-r-sm border-r-4 border-[#aa8143] bg-[#1b4849] text-[#d4b57a]"><BookOpen size={30} /></div><div className="flex min-w-0 flex-1 flex-col justify-center"><h2 className="mb-2 text-lg font-black">{book.title}</h2><p className="mb-4 text-xs text-[#7c877f]">{book.author}</p><span className="flex items-center gap-2 text-xs font-bold text-[#96703c]">{progress.completed.includes(book.id) ? <><CheckCircle2 size={17} />أتممت دراسة الكتاب</> : <>افتح الكتاب والشرح<ChevronLeft size={17} /></>}</span></div></Link>)}</div>
    {!filtered.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">لا توجد نتائج مطابقة.</p>}<Status progress={progress} />
  </Shell>
}

function useBookResources(source: LearningCourse) {
  const [book, setBook] = useState(source)
  useEffect(() => {
    setBook(source)
    let overrides: Partial<LearningCourse> = {}, lessonUrl = ''
    const publish = () => setBook({ ...source, ...overrides, ...(lessonUrl ? { videoUrl: lessonUrl } : {}) })
    const stopBook = onSnapshot(doc(db, 'islamicLibraryBooks', source.id), (snapshot) => {
      if (!snapshot.exists()) return
      const data = snapshot.data(), updates: Partial<LearningCourse> = {}
      for (const key of ['downloadUrl', 'readingUrl', 'sharhUrl', 'videoUrl', 'audioUrl', 'audioSourceUrl', 'videoDownloadUrl'] as const) {
        const link = safeIslamicLibraryLink(data[key]); if (link) updates[key] = link
      }
      if (Array.isArray(data.videos)) {
        const first = data.videos.find((video: { url?: string }) => youtubeEmbed(video?.url))
        if (first) updates.videoUrl = first.url
      }
      overrides = updates
      publish()
    }, () => { /* The verified bundled catalog remains usable if Firestore is unavailable. */ })
    const stopLessons = onSnapshot(collection(db, 'islamicLibraryBooks', source.id, 'videos'), (snapshot) => {
      const lessons = snapshot.docs.map((item) => item.data()).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      lessonUrl = lessons.find((lesson) => youtubeEmbed(lesson.url))?.url || ''
      publish()
    }, () => {})
    return () => { stopBook(); stopLessons() }
  }, [source.id])
  return book
}

export function BookStudyView({ bookId }: { bookId: string }) {
  const source = courseById(bookId)!, book = useBookResources(source), progress = useLearningProgress()
  const [mode, setMode] = useState<'video' | 'audio' | null>(null), [notice, setNotice] = useState('')
  const level = LEARNING_LEVELS.find((item) => item.id === book.levelId)!, category = SUNNI_LIBRARY_CATEGORIES.find((item) => item.id === book.category)!
  const embedded = youtubeEmbed(book.videoUrl), completed = progress.completed.includes(book.id)
  const share = async () => {
    const url = `${location.origin}/islamic-library/book/${book.id}`
    try { if (navigator.share) await navigator.share({ title: book.title, url }); else { await navigator.clipboard.writeText(url); setNotice('تم نسخ رابط الكتاب.') } }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setNotice('تعذرت المشاركة؛ يمكنك نسخ الرابط من شريط العنوان.') }
  }
  const resource = (url: string | undefined, label: string, icon: ReactNode) => url && <a className={button} href={safeIslamicLibraryLink(url) || undefined} target="_blank" rel="noopener noreferrer">{icon}{label}<ExternalLink size={14} /></a>
  return <Shell back={`/islamic-library/level/${book.levelId}/${book.category}`} backLabel={category.label} eyebrow={`${level.name} / ${category.label}`} title={book.title}>
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]"><div>
      <section className="rounded-3xl border border-[#ded3bd] bg-white p-6 sm:p-8"><p className="mb-4 text-sm font-bold text-[#a17b43]">تأليف {book.author}</p><p className="text-sm leading-8 text-[#6a7c77]">{book.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link className={button} href={`/islamic-library/book/${book.id}/read`}><BookOpen size={20} />قراءة الكتاب</Link>
        {embedded && <button className={`${button} !bg-[#1c5152] !text-white`} type="button" onClick={() => setMode('video')}><PlayCircle size={20} />تشغيل الشرح</button>}
        {resource(book.downloadUrl || book.readingUrl, book.downloadUrl ? 'تحميل الكتاب PDF' : 'مصدر الكتاب', <Download size={20} />)}
        {(book.audioUrl || book.audioSourceUrl) && <button type="button" className={button} onClick={() => setMode('audio')}><Headphones size={20} />الشرح الصوتي</button>}
        <button className={button} type="button" onClick={() => void share()}><Share2 size={19} />مشاركة رابط الكتاب</button>
      </div>{notice && <p role="status" className="mt-3 text-xs text-[#718079]">{notice}</p>}</section>
      <section className="mt-5 rounded-3xl border border-[#dfd7c7] bg-[#fffefa] p-6"><h2 className="mb-3 font-black">مواد الكتاب</h2><p className="mb-4 text-xs leading-7 text-[#72817a]">الكتاب والشروح من المصادر الموضحة أدناه. قد تكون بعض السلاسل مقسمة على قوائم متعددة لدى الناشر.</p><div className="flex flex-wrap gap-2">{resource(book.sharhUrl, book.sharhLabel || 'قراءة الشرح', <BookOpen size={17} />)}{resource(book.videoUrl, 'فتح في YouTube', <PlayCircle size={17} />)}{resource(book.audioSourceUrl, 'مصدر الصوت وتنزيلاته', <Headphones size={17} />)}{resource(book.videoDownloadUrl, 'تحميل الفيديو من الناشر', <Download size={17} />)}</div>
        {book.videoUrl && !book.videoDownloadUrl && <p className="mt-4 text-xs leading-7 text-[#8d7b5c]">تنزيل فيديو YouTube متاح من تطبيق YouTube عندما يتيحه الناشر والخدمة. لا يتوفر لهذا الشرح ملف فيديو مباشر من الناشر.</p>}
        {book.resourceNote && <p className="mt-4 rounded-xl bg-[#f2ecdf] p-3 text-xs leading-7 text-[#7d6e53]">{book.resourceNote}</p>}
      </section>
    </div><aside><section className="rounded-3xl bg-[#163f43] p-6 text-[#f6f0e1]"><GraduationCap className="mb-5 text-[#d3b77d]" size={32} /><h2 className="font-black">دراستك لهذا الكتاب</h2><p className="my-4 text-xs leading-7 text-[#bacbc6]">سجّل الإتمام بعد إنهاء الكتاب وشرحه. الشهادة توثق متابعة دراستك الذاتية، ولا تمثل إجازة علمية.</p><button type="button" disabled={!progress.ready || progress.busy} onClick={() => void progress.toggle(book.id)} className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3.5 text-sm font-bold disabled:opacity-50 ${completed ? 'bg-[#e8d8b4] text-[#294b45]' : 'bg-white text-[#214b4a]'}`}>{progress.busy ? <Loader2 size={18} className="animate-spin" /> : completed ? <CheckCircle2 size={18} /> : <Check size={18} />}{completed ? 'أتممت الدراسة · تراجع' : 'أتممت دراسة الكتاب'}</button><div className="mt-6"><Progress count={completedInLevel(book.levelId, progress.completed)} total={coursesInLevel(book.levelId).length} /></div><Link href={`/islamic-library/level/${book.levelId}`} className="mt-5 inline-flex items-center gap-2 text-xs text-[#d9c28f]">عودة إلى المستوى<ChevronLeft size={16} /></Link></section><Status progress={progress} /></aside></div>
    {mode && <Modal title={mode === 'video' ? 'شرح الكتاب' : 'الشرح الصوتي'} onClose={() => setMode(null)} wide><div className="mb-4 flex items-center justify-between"><h2 className="font-black">{book.title}</h2><button aria-label="إغلاق الشرح" type="button" className="p-2" onClick={() => setMode(null)}><X /></button></div>{mode === 'video' && embedded ? <><iframe title={`شرح ${book.title}`} src={embedded} className="aspect-video w-full rounded-2xl bg-black" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><div className="mt-4 flex flex-wrap gap-2">{resource(book.videoUrl, 'افتح الشرح في YouTube', <ExternalLink size={17} />)}{resource(book.videoDownloadUrl, 'تحميل الفيديو', <Download size={17} />)}</div></> : <div className="space-y-4">{book.audioUrl && <audio controls preload="none" src={safeIslamicLibraryLink(book.audioUrl) || undefined} className="w-full" />}{resource(book.audioSourceUrl || book.audioUrl, 'الاستماع وتحميل الصوت من المصدر', <Headphones size={20} />)}<p className="text-sm leading-7 text-slate-500">افتح مصدر الشرح لاختيار الدرس المطلوب وتنزيل تسجيلاته.</p></div>}</Modal>}
  </Shell>
}

function certificateCanvas(certificate: LearningCertificate, title: string): Promise<HTMLCanvasElement> {
  return Promise.all([document.fonts.load('bold 86px "Amiri"'), document.fonts.load('bold 28px "Tajawal"'), document.fonts.load('32px "Tajawal"')]).then(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1273
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('تعذر رسم الشهادة.')
    ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 0, 1800, 1273)
    ctx.fillStyle = '#16494b'; ctx.fillRect(0, 0, 35, 1273); ctx.fillRect(1765, 0, 35, 1273)
    ctx.strokeStyle = '#b28a49'; ctx.lineWidth = 3; ctx.strokeRect(65, 65, 1670, 1143); ctx.lineWidth = 1; ctx.strokeRect(81, 81, 1638, 1111)
    for (const [x,y] of [[95,95],[1705,95],[95,1178],[1705,1178]]) { ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4); ctx.fillStyle='#b28a49';ctx.fillRect(-12,-12,24,24);ctx.restore() }
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.fillStyle = '#a47a3e'; ctx.font = 'bold 28px "Tajawal",sans-serif'; ctx.fillText('مُصْحَف سَمِيع  |  المكتبة الشرعية',900,190)
    ctx.fillStyle='#17494b';ctx.font='bold 86px "Amiri",serif';ctx.fillText('شهادة إتمام دراسة ذاتية',900,330)
    ctx.font='32px "Tajawal",sans-serif';ctx.fillStyle='#7c8072';ctx.fillText('تُمنح هذه الشهادة إلى',900,430)
    ctx.fillStyle='#a17a40';let nameSize=70;let lines: string[]=[];do{ctx.font=`bold ${nameSize}px "Amiri",serif`;lines=wrapCardText(ctx,certificate.name,1420);nameSize-=2}while(lines.length>2&&nameSize>34);lines.forEach((line,i)=>ctx.fillText(line,900,550+i*80))
    const shift=(lines.length-1)*60
    ctx.fillStyle='#244d4c';ctx.font='34px "Tajawal",sans-serif';ctx.fillText(`لإتمام متابعة كتب ${title} في مكتبة سميع الشرعية`,900,695+shift)
    ctx.font='29px "Tajawal",sans-serif';ctx.fillStyle='#7a8176';ctx.fillText('العقيدة • الفقه • السيرة • أصول التفسير',900,780+shift);ctx.fillText('أصول الفقه • أصول الحديث • التفسير • كتب السنة',900,830+shift)
    ctx.strokeStyle='#c4aa75';ctx.beginPath();ctx.moveTo(400,930+shift);ctx.lineTo(1400,930+shift);ctx.stroke()
    ctx.font='25px "Tajawal",sans-serif';ctx.fillStyle='#64776f';ctx.fillText(`تاريخ الإصدار: ${certificate.issuedAt?.toDate?.().toISOString().slice(0,10) || certificate.issuedDate || ''}     •     ثمانية كتب`,900,1000+shift)
    ctx.direction='ltr';ctx.font='23px sans-serif';ctx.fillText(certificate.serial,900,1060+shift)
    ctx.direction='rtl';ctx.font='20px "Tajawal",sans-serif';ctx.fillText('شهادة متابعة ذاتية وفق سجل صاحب الحساب، وليست اعتمادًا أو إجازة علمية.',900,1150)
    return canvas
  })
}
function CertificateDialog({ levelId, existing, defaultName, signedIn, issue, onClose }: {
  levelId: LevelId; existing?: LearningCertificate; defaultName: string; signedIn: boolean; issue: (level: LevelId, name: string) => Promise<LearningCertificate>; onClose: () => void
}) {
  const [name, setName] = useState(defaultName), [certificate, setCertificate] = useState(existing), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState('')
  const title = LEARNING_LEVELS.find((item) => item.id === levelId)!.name
  useEffect(() => { if (existing) setCertificate(existing) }, [existing])
  useEffect(() => {
    let alive = true, url = ''
    if (certificate) void certificateCanvas(certificate, title).then(cardBlob).then((blob) => { if (alive) { url=URL.createObjectURL(blob);setPreview(url) } }).catch(() => { if (alive) setError('تعذرت معاينة الشهادة.') })
    return () => { alive=false;if(url)URL.revokeObjectURL(url) }
  }, [certificate, title])
  const create = async () => { if(busy)return;setBusy(true);setError('');try{setCertificate(await issue(levelId,name))}catch(e){setError(e instanceof Error?e.message:'تعذر إصدار الشهادة.')}finally{setBusy(false)} }
  const save = async () => { if(!certificate)return;setBusy(true);try{downloadBlob(await cardBlob(await certificateCanvas(certificate,title)),`${certificate.serial}.png`)}catch(e){setError(e instanceof Error?e.message:'تعذر حفظ الشهادة.')}finally{setBusy(false)} }
  const print = () => {
    if(!preview)return
    const page=window.open('','_blank');if(!page){setError('اسمح بفتح نافذة الطباعة لهذا الموقع.');return}
    // Only a generated local blob URL is inserted; names are already drawn on the canvas.
    page.document.write(`<!doctype html><html lang="ar"><head><title>شهادة سميع</title><style>@page{size:A4 landscape;margin:0}body{margin:0;background:white}img{width:100%;height:100vh;object-fit:contain}@media print{img{height:209mm;width:296mm}}</style></head><body><img alt="شهادة سميع" src="${preview}"></body></html>`);page.document.close()
    const image=page.document.querySelector('img');if(image)image.onload=()=>{page.focus();page.print()}
  }
  return <Modal title="شهادة إتمام المستوى" onClose={() => {if(!busy)onClose()}} wide><div className="mb-5 flex justify-between"><h2 className="flex items-center gap-2 text-lg font-black"><Award className="text-[#b18b4f]" />شهادة {title}</h2><button type="button" aria-label="إغلاق" disabled={busy} onClick={onClose}><X /></button></div>
    {!signedIn ? <div className="rounded-2xl bg-white p-6 text-sm leading-8">سجّل الدخول ليُحفظ إصدار الشهادة في حسابك.<Link className={`${button} mt-4`} href={`/auth?next=/islamic-library/level/${levelId}`}>تسجيل الدخول</Link></div> : certificate ? <><p className="mb-4 text-xs text-[#7d826e]">صدرت هذه الشهادة باسم ثابت. يمكنك حفظ نسختها الأصلية مرة أخرى.</p>{preview ? <img src={preview} alt={`شهادة ${certificate.name}`} className="w-full rounded-xl border border-[#dcc9a4]" /> : <Loader2 className="mx-auto my-10 animate-spin" />}<div className="mt-5 flex flex-wrap gap-2"><button type="button" className={button} disabled={busy||!preview} onClick={() => void save()}><Download size={18} />حفظ صورة الشهادة</button><button type="button" className={button} disabled={!preview} onClick={print}>طباعة / حفظ PDF</button></div></> : <div className="mx-auto max-w-lg space-y-4 rounded-2xl bg-white p-6"><p className="text-sm leading-8">أتممت كتب المستوى. اكتب الاسم كما تريد ظهوره؛ لا يمكن تغييره أو إصدار شهادة ثانية لهذا المستوى.</p><label className="block text-sm font-bold">الاسم في الشهادة<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="name" className="mt-2 w-full rounded-xl border border-[#cdbb99] p-3" /></label><button type="button" disabled={busy||normalizeLearningName(name).length<2} onClick={() => void create()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5555] p-4 font-bold text-white disabled:opacity-50">{busy?<Loader2 size={19} className="animate-spin" />:<Award size={19}/>}إصدار الشهادة بهذا الاسم</button></div>}{error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </Modal>
}
