
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, ChevronLeft, Download, ImagePlus, Loader2,
  Pause, Play, RotateCcw, Settings2, Share2, Sparkles, X,
} from 'lucide-react'

type Chapter = { id: number; name: string; count: number }
type Reader = { id: string; name: string }
type QuranFont = { id: string; name: string }
type Choice = { surah: number; from: number; to: number; reciter: string; translation: string }
type Design = {
  template: string; color: string; accent: string; translationColor: string;
  size: number; darkness: number; speed: number; intensity: number;
  font: string; signature: string; frame: boolean; gc1: string; gc2: string;
  ratio: string; quality: number;
}
type Preset = { id: string; name: string; note: string; a: string; b: string; gold: string; frame: boolean }
type Ready = { duration: number; count: number; chapter: string; reciter: string }
type ResultFile = { blob: Blob; name: string; url: string }
type BridgeMessage = { channel?: string; event?: string; data?: Record<string, unknown>; id?: number }
type WakeLock = { release: () => Promise<void> }

const PRESETS: Preset[] = [
  { id: 'emerald', name: 'زمرد سميع', note: 'نور أخضر متحرك', a: '#175344', b: '#061c18', gold: '#dec28b', frame: true },
  { id: 'night', name: 'ليل المصحف', note: 'نجوم ووميض هادئ', a: '#22221e', b: '#030604', gold: '#e5c481', frame: true },
  { id: 'river', name: 'نسيم النهر', note: 'تموجات الماء', a: '#28615c', b: '#071c22', gold: '#d6e7dd', frame: false },
  { id: 'flower', name: 'أزهار', note: 'بتلات تتطاير', a: '#774866', b: '#171923', gold: '#f5d6df', frame: false },
  { id: 'sand', name: 'رمال ذهبية', note: 'تموجات دافئة', a: '#94754e', b: '#291c13', gold: '#f1dbb0', frame: true },
  { id: 'dunes', name: 'الكثبان', note: 'كثبان تتحرك', a: '#795938', b: '#191510', gold: '#efcf98', frame: false },
  { id: 'rain', name: 'نافذة المطر', note: 'أمطار متساقطة', a: '#3e5a66', b: '#0c1622', gold: '#dce8ef', frame: false },
  { id: 'snow', name: 'ندف الثلج', note: 'ثلوج هادئة', a: '#597188', b: '#101a2b', gold: '#e9f5fa', frame: true },
  { id: 'blue', name: 'عمق المحيط', note: 'أمواج زرقاء', a: '#07516b', b: '#071527', gold: '#bce9e9', frame: false },
  { id: 'aurora', name: 'الشفق', note: 'أضواء سماوية', a: '#25576c', b: '#081b32', gold: '#d3f5de', frame: false },
  { id: 'clouds', name: 'غيوم الفجر', note: 'سحب ناعمة', a: '#687c8b', b: '#182c43', gold: '#ecf1e4', frame: false },
  { id: 'sunrise', name: 'إشراق', note: 'ذهب الصباح', a: '#ae7d53', b: '#38232a', gold: '#ffe0a0', frame: true },
  { id: 'moonlight', name: 'ضوء القمر', note: 'قمر ونجيمات', a: '#253f60', b: '#090f27', gold: '#cbdcf5', frame: false },
  { id: 'stars', name: 'سماء النجوم', note: 'نجوم تلمع', a: '#1b3154', b: '#070c1f', gold: '#f0e3b3', frame: true },
  { id: 'lanterns', name: 'فوانيس النور', note: 'أنوار عائمة', a: '#795530', b: '#1d1917', gold: '#f8d6a2', frame: true },
  { id: 'olive', name: 'غصون الزيتون', note: 'موج أخضر', a: '#586e4d', b: '#16251c', gold: '#e3e4bf', frame: false },
  { id: 'pearl', name: 'لؤلؤ', note: 'أمواج لؤلؤية', a: '#477786', b: '#17363f', gold: '#f0ece0', frame: true },
  { id: 'rose', name: 'ورود المساء', note: 'بتلات وردية', a: '#8c5165', b: '#261923', gold: '#f4d4cd', frame: false },
  { id: 'mosque', name: 'هندسة إسلامية', note: 'زخارف متحركة', a: '#5e4b32', b: '#181d1d', gold: '#e9cc86', frame: true },
  { id: 'desert', name: 'مساء الصحراء', note: 'أفق رملي', a: '#985b45', b: '#251d2b', gold: '#f8cea8', frame: false },
  { id: 'waterfall', name: 'سكون الشلال', note: 'تيارات مضيئة', a: '#2b6577', b: '#0c2933', gold: '#d8eff3', frame: false },
  { id: 'bokeh', name: 'ومضات الضوء', note: 'أنوار متوهجة', a: '#6b4c61', b: '#1e1a2c', gold: '#ffe9c4', frame: false },
  { id: 'calligraphy', name: 'أشكال هندسية', note: 'خطوط تدور بهدوء', a: '#50477d', b: '#17172d', gold: '#ddd4fa', frame: true },
  { id: 'silk', name: 'حرير هادئ', note: 'انسياب ناعم', a: '#667077', b: '#1b282e', gold: '#e8e8dc', frame: false },
]

const INITIAL: Design = {
  template: 'emerald', color: '#fff9e9', accent: '#dec28b', translationColor: '#eee8db',
  size: 110, darkness: 40, speed: 1, intensity: 55, font: 'amiri', signature: 'مصحف سميع',
  frame: true, gc1: '#175344', gc2: '#061c18', ratio: '9:16', quality: 720,
}
const SAMPLE = 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ'
const card = 'rounded-[25px] border border-[#e7dfcf] bg-white p-5 shadow-[0_8px_30px_#162e2007]'
const field = 'mt-2 min-h-12 w-full rounded-2xl border border-[#e2d8c5] bg-white px-3 py-3 text-sm outline-none focus:border-[#a78c53] focus:ring-2 focus:ring-[#d8bc8050] disabled:opacity-50'
const btn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40'
const primary = `${btn} bg-[#224d40] text-white shadow-[0_8px_25px_#224d4029]`
const secondary = `${btn} border border-[#e2d8c5] bg-white text-[#244f43]`
const ar = (value: number) => value.toLocaleString('ar-EG', { useGrouping: false })
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

function storedDesign(): Design {
  try {
    const saved = JSON.parse(localStorage.getItem('samee3_visual_studio_v2') || 'null') as Partial<Design> | null
    const preset = PRESETS.find(p => p.id === saved?.template) || PRESETS[0]
    return {
      ...INITIAL, template: preset.id, gc1: preset.a, gc2: preset.b, frame: typeof saved?.frame === 'boolean' ? saved.frame : preset.frame,
      color: isHex(saved?.color) ? saved.color : INITIAL.color,
      accent: isHex(saved?.accent) ? saved.accent : preset.gold,
      translationColor: isHex(saved?.translationColor) ? saved.translationColor : INITIAL.translationColor,
      size: Math.max(65, Math.min(145, Number(saved?.size) || 110)),
      darkness: Math.max(0, Math.min(80, Number.isFinite(Number(saved?.darkness)) ? Number(saved?.darkness) : 40)),
      speed: Math.max(.25, Math.min(2, Number(saved?.speed) || 1)),
      intensity: Math.max(0, Math.min(100, Number.isFinite(Number(saved?.intensity)) ? Number(saved?.intensity) : 55)),
      font: typeof saved?.font === 'string' ? saved.font : INITIAL.font,
      signature: typeof saved?.signature === 'string' ? saved.signature.slice(0, 60) : INITIAL.signature,
      ratio: ['9:16', '1:1', '16:9'].includes(saved?.ratio || '') ? saved!.ratio! : INITIAL.ratio,
      quality: [720, 1080].includes(Number(saved?.quality)) ? Number(saved?.quality) : 720,
    }
  } catch { return INITIAL }
}

export default function VisualAyahsPage() {
  const frame = useRef<HTMLIFrameElement>(null)
  const ticket = useRef(0)
  const jobs = useRef({ background: 0, prepare: 0, export: 0 })
  const wakeLock = useRef<WakeLock | null>(null)
  const canceled = useRef(false)
  const exportStarted = useRef(false)
  const mounted = useRef(false)
  const [frameKey, setFrameKey] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState(1)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [readers, setReaders] = useState<Reader[]>([])
  const [fonts, setFonts] = useState<QuranFont[]>([])
  const [choice, setChoice] = useState<Choice>({ surah: 13, from: 28, to: 28, reciter: 'husary', translation: 'none' })
  const [design, setDesign] = useState<Design>(INITIAL)
  const [upload, setUpload] = useState<File | null>(null)
  const [backgroundBusy, setBackgroundBusy] = useState(false)
  const [backgroundOk, setBackgroundOk] = useState(false)
  const [work, setWork] = useState<'idle' | 'prepare' | 'export' | 'cancel'>('idle')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ready, setReady] = useState<Ready | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [progress, setProgress] = useState(0)
  const [prepareText, setPrepareText] = useState('')
  const [result, setResult] = useState<ResultFile | null>(null)
  const currentDesign = useRef(design)
  currentDesign.current = design
  const selected = PRESETS.find(p => p.id === design.template) || PRESETS[0]
  const chapter = chapters.find(c => c.id === choice.surah)
  const locked = work !== 'idle'
  const exporting = work === 'export' || work === 'cancel'
  const canAdvance = !locked && !backgroundBusy && backgroundOk && loaded

  const send = useCallback((action: string, data: unknown = {}, id?: number) => {
    frame.current?.contentWindow?.postMessage({ channel: 'samee3-visual-v2', action, data, id }, location.origin)
  }, [])
  const releaseLock = useCallback(() => {
    const held = wakeLock.current
    wakeLock.current = null
    if (held) void held.release().catch(() => {})
  }, [])
  const unlock = () => {
    const player = frame.current?.contentWindow as (Window & { samee3StudioUnlock?: () => Promise<unknown> }) | null
    void player?.samee3StudioUnlock?.().catch(() => {})
  }
  const silence = () => {
    document.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media => media.pause())
    const root = window as Window & { __samee3PersistentAudio?: HTMLAudioElement & { __samee3Continue?: boolean } }
    if (root.__samee3PersistentAudio) { root.__samee3PersistentAudio.__samee3Continue = false; root.__samee3PersistentAudio.pause() }
  }
  const clearPreview = () => { setReady(null); setPlaying(false); setTime(0); setResult(null); setError(''); setNotice('') }
  const changeDesign = (change: Partial<Design>) => { setDesign(d => ({ ...d, ...change })); setResult(null) }
  const invalidate = (change: Partial<Choice>) => {
    jobs.current.prepare = ++ticket.current
    send('invalidate')
    setChoice(old => ({ ...old, ...change }))
    clearPreview()
  }
  const selectPreset = (preset: Preset, openChoices = true) => {
    if (locked) return
    setUpload(null)
    changeDesign({ template: preset.id, gc1: preset.a, gc2: preset.b, accent: preset.gold, frame: preset.frame })
    setError('')
    if (openChoices) setStep(2)
  }
  const retry = () => {
    if (exporting) return
    releaseLock()
    jobs.current = { background: ++ticket.current, prepare: ++ticket.current, export: ++ticket.current }
    setLoaded(false); setBackgroundBusy(false); setBackgroundOk(false); setWork('idle')
    clearPreview()
    setFrameKey(x => x + 1)
  }

  useEffect(() => {
    mounted.current = true
    setDesign(storedDesign())
    setHydrated(true)
    const onMessage = (event: MessageEvent<BridgeMessage>) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== 'samee3-visual-v2') return
      const { event: type, data = {}, id } = event.data
      if (type === 'ready') {
        setLoaded(true)
        setChapters(Array.isArray(data.chapters) ? data.chapters as Chapter[] : [])
        setReaders(Array.isArray(data.reciters) ? data.reciters as Reader[] : [])
        setFonts(Array.isArray(data.fonts) ? data.fonts as QuranFont[] : [])
        send('style', currentDesign.current)
        return
      }
      if (type === 'background') {
        if (id !== jobs.current.background) return
        setBackgroundBusy(false); setBackgroundOk(true); setError('')
        return
      }
      if (type === 'preparing' || type === 'prepared') {
        if (id !== jobs.current.prepare) return
        if (type === 'preparing') setPrepareText(`تحميل التلاوة ${ar(Number(data.current) || 0)} من ${ar(Number(data.total) || 0)}`)
        else {
          setReady(data as Ready); setWork('idle'); setPlaying(false); setTime(0)
          setPrepareText(''); setStep(3)
        }
        return
      }
      if (type === 'playback') { setPlaying(Boolean(data.playing)); setTime(Number(data.time) || 0); return }
      if (type === 'progress' || type === 'result' || type === 'canceled') {
        if (id !== jobs.current.export) return
        if (type === 'progress') setProgress(Math.max(0, Math.min(1, Number(data.value) || 0)))
        if (type === 'result') {
          releaseLock(); setWork('idle'); setProgress(1)
          if (data.blob instanceof Blob && typeof data.name === 'string' && data.blob.size > 1000) {
            setResult({ blob: data.blob, name: data.name, url: URL.createObjectURL(data.blob) })
            setNotice('الفيديو جاهز للحفظ أو المشاركة.')
          } else setError('الملف الناتج غير صالح. جرّب جودة 720p.')
        }
        if (type === 'canceled') { releaseLock(); setWork('idle'); setNotice('تم إلغاء إنشاء الفيديو.') }
        return
      }
      if (type === 'error') {
        if (id !== undefined && id !== jobs.current.prepare && id !== jobs.current.background && id !== jobs.current.export) return
        releaseLock(); setWork('idle'); setBackgroundBusy(false); setPlaying(false); setPrepareText('')
        if (id === jobs.current.background) setBackgroundOk(false)
        setError(typeof data.message === 'string' ? data.message : 'تعذر إكمال العملية. حاول مجددًا.')
      }
    }
    const onHide = () => { send('cancel'); releaseLock() }
    window.addEventListener('message', onMessage)
    window.addEventListener('pagehide', onHide)
    return () => {
      mounted.current = false
      send('cancel'); releaseLock()
      window.removeEventListener('message', onMessage)
      window.removeEventListener('pagehide', onHide)
    }
  }, [send, releaseLock])

  useEffect(() => { if (loaded) send('style', design) }, [loaded, design, send])
  useEffect(() => { if (step !== 3) { send('stop'); setPlaying(false) } }, [step, send])
  useEffect(() => {
    if (!loaded) return
    const id = ++ticket.current
    jobs.current.background = id
    setBackgroundBusy(true); setBackgroundOk(false); setError('')
    send('background', { file: upload }, id)
  }, [loaded, upload, send])
  useEffect(() => {
    if (!hydrated) return
    const task = setTimeout(() => {
      try { localStorage.setItem('samee3_visual_studio_v2', JSON.stringify(design)) } catch {}
    }, 450)
    return () => clearTimeout(task)
  }, [hydrated, design])
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url) }, [result])
  useEffect(() => {
    if (loaded) return
    const ping = setInterval(() => send('hello'), 850)
    const timeout = setTimeout(() => setError('المحرر لا يستجيب. اضغط إعادة المحاولة.'), 35000)
    send('hello')
    return () => { clearInterval(ping); clearTimeout(timeout) }
  }, [loaded, frameKey, send])

  const prepare = () => {
    if (!canAdvance) return
    const max = chapter?.count || 0
    if (!Number.isInteger(choice.from) || !Number.isInteger(choice.to) || choice.from < 1 || choice.from > max || choice.to < choice.from || choice.to > max || choice.to - choice.from >= 10) {
      setError('اختر من آية إلى عشر آيات متتابعة ضمن حدود السورة.')
      return
    }
    silence(); unlock()
    const id = ++ticket.current
    jobs.current.prepare = id
    setWork('prepare'); setPrepareText('جارٍ تجهيز الآيات والتلاوة…'); clearPreview()
    send('prepare', choice, id)
  }
  const cancelPrepare = () => {
    jobs.current.prepare = ++ticket.current
    send('cancel'); setWork('idle'); setPrepareText(''); setNotice('تم إيقاف تحميل التلاوة.')
  }
  const exportVideo = async () => {
    if (!ready || !canAdvance) return
    silence(); unlock()
    const id = ++ticket.current
    jobs.current.export = id
    canceled.current = false
    exportStarted.current = false
    setWork('export'); setProgress(0); setResult(null); setError(''); setNotice(''); setPlaying(false)
    try {
      const api = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLock> } }
      wakeLock.current = await api.wakeLock?.request('screen') || null
    } catch {}
    if (mounted.current && !canceled.current) { exportStarted.current = true; send('export', {}, id) }
    else { releaseLock(); setWork('idle') }
  }
  const cancelExport = () => {
    canceled.current = true
    if (!exportStarted.current) { releaseLock(); setWork('idle'); setNotice('تم إلغاء الإنشاء.'); return }
    setWork('cancel')
    send('cancel')
  }
  const share = async () => {
    if (!result) return
    try {
      const media = new File([result.blob], result.name, { type: result.blob.type })
      if (navigator.canShare?.({ files: [media] })) await navigator.share({ files: [media], title: 'آيات مرئية — مصحف سميع' })
      else setNotice('تنزيل المقطع متاح، ثم يمكنك مشاركته من الهاتف.')
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setError('المشاركة غير متاحة. استخدم تنزيل الفيديو.')
    }
  }

  return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f8f5ed] pb-36 text-[#28372f]">
    <style>{`
      @keyframes samee3FloatA{0%{transform:translate3d(-13%,10%,0) scale(.9)}50%{transform:translate3d(14%,-10%,0) scale(1.3)}100%{transform:translate3d(-13%,10%,0) scale(.9)}}
      @keyframes samee3FloatB{0%{transform:translate3d(10%,-10%,0) rotate(0deg)}50%{transform:translate3d(-8%,17%,0) rotate(19deg)}100%{transform:translate3d(10%,-10%,0) rotate(0deg)}}
      @keyframes samee3Wave{0%{transform:translateX(-16%) rotate(-8deg)}50%{transform:translateX(12%) rotate(8deg)}100%{transform:translateX(-16%) rotate(-8deg)}}
      .samee3-orb-a{animation:samee3FloatA 6s ease-in-out infinite alternate}.samee3-orb-b{animation:samee3FloatB 8s ease-in-out infinite alternate}.samee3-wave{animation:samee3Wave 7s ease-in-out infinite}
      @media (prefers-reduced-motion:reduce){.samee3-orb-a,.samee3-orb-b,.samee3-wave{animation:none}}
    `}</style>
    <header className="border-b border-[#e9e0ce] bg-[#fffcf5] px-4 py-5">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Link href="/" aria-label="العودة للرئيسية" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e6dac3] bg-white"><ArrowRight size={20} /></Link>
        <div className="flex-1"><h1 className="text-xl font-extrabold">آيات مرئية</h1><p className="mt-1 text-xs text-[#798077]">استوديو سميع · فيديوهات قرآن متحركة بلا موسيقى</p></div>
        <span className="rounded-2xl bg-[#ede8d8] p-3 text-[#957436]"><Sparkles size={21} /></span>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="خطوات إنشاء الفيديو" className="mb-6 grid grid-cols-3 gap-2">
        {['اختر القالب', 'الآيات والتلاوة', 'المعاينة والحفظ'].map((name, i) =>
          <button key={name} type="button" disabled={locked || (i === 2 && !ready)} onClick={() => setStep(i + 1)}
            aria-current={step === i + 1 ? 'step' : undefined}
            className={`flex items-center justify-center gap-2 rounded-2xl px-1 py-3 text-[11px] font-bold sm:text-xs ${step === i + 1 ? 'bg-[#234d41] text-white' : 'bg-[#eee8dc] text-[#6f796f]'}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step === i + 1 ? 'bg-white/20' : 'bg-white/70'}`}>{step > i + 1 ? <Check size={13} /> : ar(i + 1)}</span>{name}
          </button>)}
      </nav>
      {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800"><p className="flex-1">{error}</p><button aria-label="إغلاق التنبيه" onClick={() => setError('')}><X size={18} /></button>{!loaded && <button onClick={retry} className="underline">إعادة المحاولة</button>}</div>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section className={`${step !== 3 ? 'max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:h-px max-lg:w-px max-lg:overflow-hidden max-lg:opacity-0 max-lg:pointer-events-none ' : ''}lg:order-2 lg:sticky lg:top-5`} aria-hidden={step !== 3}>
          <div className="mb-3 flex items-center justify-between text-sm font-bold"><span>{ready ? 'معاينة فيديو الآيات' : 'معاينة القالب المتحرك'}</span><span className="font-normal text-[#758078]">{selected.name}</span></div>
          <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-[25px] bg-[#102b24] shadow-xl" style={{ aspectRatio: design.ratio.replace(':', ' / '), maxHeight: '53dvh' }}>
            <iframe ref={frame} key={frameKey} src="/api/gt-sqr/?engine=1&studio=2" title="معاينة فيديو الآيات" className="pointer-events-none absolute inset-0 h-full w-full border-0" allow="autoplay; screen-wake-lock" tabIndex={-1} onLoad={() => send('hello')} />
            {!loaded && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#173f34] px-6 text-center text-sm text-[#efe2be]"><Loader2 size={24} className="animate-spin" />جارٍ تشغيل محرّك الفيديو…</div>}
            {backgroundBusy && <div role="status" className="absolute inset-x-4 bottom-4 rounded-xl bg-black/70 p-3 text-center text-xs text-white">جارٍ تجهيز الخلفية…</div>}
          </div>
          {ready ? <div className="mx-auto mt-3 flex max-w-[340px] items-center gap-3 rounded-2xl border border-[#e4dccd] bg-white p-3">
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#224d40] text-white disabled:opacity-40" disabled={locked || backgroundBusy} aria-label={playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة'} onClick={() => { silence(); unlock(); send('play') }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <div className="flex-1"><progress className="h-1.5 w-full accent-[#9e844c]" max={ready.duration} value={Math.min(time, ready.duration)} /><p dir="ltr" className="mt-1 text-center text-[11px] text-[#778076]">{clock(time)} / {clock(ready.duration)}</p></div>
            <button disabled={locked} aria-label="إعادة المعاينة" onClick={() => send('restart')} className="p-2 text-[#5a7766]"><RotateCcw size={17} /></button>
          </div> : <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-6 text-[#778076]">القالب متحرك بالفعل. اختر السورة والقارئ لمعاينة الآيات مع التلاوة.</p>}
        </section>
        <section className="lg:order-1">
          {step === 1 && <>
            <div className="mb-5"><h2 className="text-2xl font-extrabold">اختر المشهد المناسب</h2><p className="mt-2 text-sm leading-7 text-[#718077]">{ar(PRESETS.length)} قالبًا متحركًا بتأثيرات مختلفة. جميعها تُصدّر بالحركة الفعلية.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {PRESETS.map(p => <button key={p.id} type="button" disabled={locked} onClick={() => selectPreset(p)} aria-label={`اختيار قالب ${p.name}`} aria-pressed={selected.id === p.id} className="group text-center disabled:opacity-60">
                <div className={`relative aspect-[3/4] overflow-hidden rounded-[22px] border-[3px] shadow-sm transition group-hover:shadow-lg ${selected.id === p.id ? 'border-[#b08a40] ring-2 ring-[#d0b47944]' : 'border-transparent'}`} style={{ background: `linear-gradient(145deg,${p.a},${p.b})` }}>
                  <div className="samee3-orb-a absolute -right-9 -top-12 h-36 w-36 rounded-full opacity-40 blur-2xl" style={{ backgroundColor: p.gold }} />
                  <div className="samee3-orb-b absolute -bottom-12 -left-8 h-40 w-40 rounded-full opacity-25 blur-2xl" style={{ backgroundColor: p.gold }} />
                  <div className="samee3-wave absolute inset-x-[-35%] bottom-[8%] h-[24%] rounded-[50%] border-t" style={{ borderColor: p.gold, opacity: .35 }} />
                  {p.frame && <div className="absolute inset-[7%] rounded-2xl border opacity-70" style={{ borderColor: p.gold }} />}
                  <p className="absolute inset-x-2 top-[13%] text-[10px]" style={{ color: p.gold }}>سورة الرعد</p>
                  <p dir="rtl" className="absolute inset-x-[9%] top-[37%] text-sm leading-8 text-[#fffaf0]" style={{ fontFamily: '"Amiri Quran", Amiri, serif' }}>{SAMPLE}</p>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/35 px-2 py-1 text-[10px] text-white">متحرك</span>
                  {selected.id === p.id && <span className="absolute bottom-2 left-2 rounded-full bg-white p-1 text-[#34604e]"><Check size={14} /></span>}
                </div>
                <span className="mt-2 block text-sm font-bold">{p.name}</span><span className="mt-1 block text-[11px] text-[#7f837a]">{p.note}</span>
              </button>)}
            </div>
            <button className={`${primary} mt-6 w-full`} disabled={locked} onClick={() => setStep(2)}>اختيار الآيات والقارئ <ChevronLeft size={18} /></button>
          </>}
          {step === 2 && <div className={card}>
            <h2 className="text-xl font-extrabold">حدد الآيات والتلاوة</h2><p className="mt-2 text-sm leading-7 text-[#788076]">النص القرآني الأصلي والتلاوة يتزامنان داخل الفيديو.</p>
            <fieldset disabled={locked || !loaded} className="mt-5 space-y-4">
              <label className="block text-sm font-bold">السورة<select className={field} aria-label="السورة" value={choice.surah} onChange={e => invalidate({ surah: Number(e.target.value), from: 1, to: 1 })}>{chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-bold">من الآية<input className={field} aria-label="من الآية" type="number" min={1} max={chapter?.count || 286} value={choice.from} onChange={e => { const from = Number(e.target.value); invalidate({ from, to: Math.max(from, choice.to) }) }} /></label>
                <label className="block text-sm font-bold">إلى الآية<input className={field} aria-label="إلى الآية" type="number" min={choice.from} max={chapter?.count || 286} value={choice.to} onChange={e => invalidate({ to: Number(e.target.value) })} /></label>
              </div>
              <label className="block text-sm font-bold">القارئ<select className={field} aria-label="القارئ" value={choice.reciter} onChange={e => invalidate({ reciter: e.target.value })}>{readers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <label className="block text-sm font-bold">الترجمة المصاحبة<select className={field} aria-label="الترجمة" value={choice.translation} onChange={e => invalidate({ translation: e.target.value })}><option value="none">بدون ترجمة</option><option value="en.sahih">الإنجليزية</option><option value="fr.hamidullah">الفرنسية</option></select></label>
              <p className="text-xs leading-6 text-[#82877e]">رواية حفص · حتى عشر آيات · أقل من 90 ثانية · من غير موسيقى</p>
            </fieldset>
            <button className={`${primary} mt-5 w-full`} disabled={!canAdvance} onClick={prepare}>{work === 'prepare' ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}{work === 'prepare' ? prepareText : 'تجهيز معاينة الآيات'}<ChevronLeft size={17} /></button>
            {work === 'prepare' && <button className={`${secondary} mt-3 w-full`} onClick={cancelPrepare}>إلغاء التحميل</button>}
            {backgroundBusy && <p className="mt-3 text-xs text-[#7d806f]">جارٍ تحميل الخلفية المرفوعة…</p>}
          </div>}
          {step === 3 && ready && <div className="space-y-4">
            <div className={card}><h2 className="text-xl font-extrabold">المشهد جاهز للمعاينة</h2><p className="mt-2 text-sm leading-7 text-[#768075]">استمع للتلاوة وخصص ألوان القالب وحركته قبل التنزيل.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#e7eee5] px-3 py-2">{ready.chapter} · {ar(choice.from)}{choice.from !== choice.to ? `–${ar(choice.to)}` : ''}</span><span className="rounded-full bg-[#f1eadc] px-3 py-2">{ready.reciter}</span><span className="rounded-full bg-[#f1eadc] px-3 py-2">{clock(ready.duration)}</span></div>
            </div>
            <details className="rounded-[23px] border border-[#e7dfcf] bg-white"><summary className="flex min-h-16 cursor-pointer items-center gap-3 px-5 font-bold"><Settings2 size={19} className="text-[#ac8742]" />تخصيص التصميم والحركة<span className="mr-auto text-xs font-normal text-[#7e8277]">اختياري</span></summary>
              <fieldset disabled={locked} className="space-y-5 border-t border-[#eee8dc] p-5">
                <label className="block text-sm font-bold">القالب المتحرك<select className={field} value={design.template} onChange={e => { const p = PRESETS.find(x => x.id === e.target.value); if (p) selectPreset(p, false) }}>{PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <div className="grid grid-cols-3 gap-3">{([['color', 'الآيات'], ['accent', 'الإطار'], ['translationColor', 'الترجمة']] as const).map(([key, title]) => <label key={key} className="text-xs font-bold">{title}<input type="color" aria-label={`لون ${title}`} value={design[key]} onChange={e => changeDesign({ [key]: e.target.value })} className="mt-2 h-12 w-full rounded-xl border border-[#e4dac7] bg-white p-1" /></label>)}</div>
                <label className="block text-sm font-bold">خط القرآن<select className={field} value={design.font} onChange={e => changeDesign({ font: e.target.value })}>{fonts.map(f => <option key={f.id} value={f.id}>{f.name === 'Amiri Quran' ? 'الأميري القرآني' : f.name === 'Uthmanic Hafs' ? 'العثماني' : 'نسخ شهرزاد'}</option>)}</select></label>
                <label className="block text-sm font-bold">حجم الآيات <span className="text-xs font-normal">{ar(design.size)}٪</span><input aria-label="حجم الآيات" type="range" min={65} max={145} value={design.size} onChange={e => changeDesign({ size: Number(e.target.value) })} className="mt-3 w-full accent-[#ad8d4d]" /></label>
                <label className="block text-sm font-bold">سرعة الحركة <span className="text-xs font-normal">{design.speed.toFixed(2)}×</span><input aria-label="سرعة الحركة" type="range" min={.25} max={2} step={.05} value={design.speed} onChange={e => changeDesign({ speed: Number(e.target.value) })} className="mt-3 w-full accent-[#ad8d4d]" /></label>
                <label className="block text-sm font-bold">قوة الحركة <span className="text-xs font-normal">{ar(design.intensity)}٪</span><input aria-label="قوة الحركة" type="range" min={0} max={100} value={design.intensity} onChange={e => changeDesign({ intensity: Number(e.target.value) })} className="mt-3 w-full accent-[#ad8d4d]" /></label>
                <label className="block text-sm font-bold">تعتيم الخلفية <span className="text-xs font-normal">{ar(design.darkness)}٪</span><input aria-label="تعتيم الخلفية" type="range" min={0} max={80} value={design.darkness} onChange={e => changeDesign({ darkness: Number(e.target.value) })} className="mt-3 w-full accent-[#ad8d4d]" /></label>
                <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={design.frame} onChange={e => changeDesign({ frame: e.target.checked })} className="accent-[#ad8d4d]" />إظهار الإطار الذهبي</label>
                <label className="block text-sm font-bold">توقيع أسفل الفيديو<input className={field} maxLength={60} value={design.signature} onChange={e => changeDesign({ signature: e.target.value })} /></label>
                <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">المقاس<select className={field} value={design.ratio} onChange={e => changeDesign({ ratio: e.target.value })}><option value="9:16">عمودي 9:16</option><option value="1:1">مربع 1:1</option><option value="16:9">أفقي 16:9</option></select></label><label className="text-sm font-bold">الجودة<select className={field} value={design.quality} onChange={e => changeDesign({ quality: Number(e.target.value) })}><option value={720}>720p</option><option value={1080}>1080p</option></select></label></div>
                <label className={`${secondary} w-full cursor-pointer`}><ImagePlus size={18} />خلفية من جهازك (صورة أو فيديو)<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 30 * 1024 * 1024) { setError('حجم الخلفية يجب ألا يتجاوز 30 ميجابايت.'); return } setUpload(f); setResult(null); setError('') }} /></label>
                {upload && <p className="text-xs text-[#7e8278]">الخلفية: {upload.name} <button className="mr-3 underline" onClick={() => setUpload(null)}>الرجوع للقالب المتحرك</button></p>}
                <p className="text-xs leading-6 text-[#8b8677]">عند رفع صورة ستظهر بحركة تقريب ناعمة، وعند رفع فيديو تُستخدم حركته الأصلية. الحركة المدمجة تظهر عند اختيار قالب سميع.</p>
              </fieldset>
            </details>
            {exporting ? <div className={card} role="status"><div className="flex items-center justify-between text-sm font-bold"><span>{work === 'cancel' ? 'جارٍ الإلغاء…' : 'جارٍ إنشاء فيديو الآيات…'}</span><span>{ar(Math.round(progress * 100))}٪</span></div><progress className="mt-4 h-2 w-full accent-[#aa8d4e]" max={1} value={progress} /><p className="mt-3 text-xs text-[#7a8278]">اترك الصفحة مفتوحة حتى تنتهي عملية التصدير.</p><button className={`${secondary} mt-4 w-full`} disabled={work === 'cancel'} onClick={cancelExport}>إلغاء الإنشاء</button></div>
              : <button className={`${primary} w-full`} disabled={!canAdvance || !ready} onClick={() => void exportVideo()}><Sparkles size={19} />إنشاء الفيديو المتحرك</button>}
            {result && <div className={card}><p className="mb-3 font-bold">تم إنشاء المقطع <span className="mr-2 text-xs font-normal text-[#7e8277]">{result.blob.type.includes('mp4') ? 'MP4' : 'WebM'} · {(result.blob.size / 1048576).toFixed(1)} MB</span></p><video src={result.url} controls playsInline className="max-h-80 w-full rounded-2xl bg-[#102b24]" onPlay={() => { send('stop'); setPlaying(false); silence() }} /><div className="mt-4 flex gap-2"><a className={`${primary} flex-1`} href={result.url} download={result.name}><Download size={17} />تنزيل الفيديو</a><button className={secondary} onClick={() => void share()}><Share2 size={17} />مشاركة</button></div></div>}
            {notice && <p role="status" className="rounded-2xl bg-[#e6ecdf] p-4 text-sm text-[#355b45]">{notice}</p>}
          </div>}
        </section>
      </div>
      <footer className="mt-8 text-center text-xs leading-7 text-[#898a7f]">تلاوات EveryAyah · نصوص AlQuran.cloud · محرّك <a href="https://github.com/SalehGNUTUX/GT-SQR" target="_blank" rel="noopener noreferrer" className="underline">GT-SQR</a> وفق <a href="/api/gt-sqr/LICENSE" target="_blank" rel="noopener noreferrer" className="underline">الترخيص المفتوح للمحرّك</a> · لا موسيقى في المقاطع</footer>
    </div>
  </main>
}
