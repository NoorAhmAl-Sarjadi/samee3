'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  HardDrive,
  Headphones,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'

/**
 * SAMEE3 Offline Library — app/offline/page.tsx
 *
 * صفحة تشخيص واطلاع فقط. لا تمسح أي Cache أو IndexedDB ولا تبدأ
 * تنزيلات خفية. جميع الأرقام مأخوذة من مخازن الجهاز الحقيقية.
 *
 * أسماء المخازن متوافقة مع app/mushaf/page.tsx و app/audio/page.tsx.
 */
const PAGE_CACHE = 'samee3-mushaf-pages-v2'
const AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
] as const
const IMAGE_CACHES = ['samee3-v3-riwaya-images'] as const
const LIBRARY_DB = 'samee-audio-library'
const LIBRARY_STORE = 'audio'
const TOTAL_QURAN_PAGES = 604

const RIWAYAT = [
  { id: 'hafs', name: 'حفص عن عاصم' },
  { id: 'warsh', name: 'ورش عن نافع' },
  { id: 'qalun', name: 'قالون عن نافع' },
  { id: 'douri', name: 'الدوري عن أبي عمرو' },
  { id: 'shubah', name: 'شعبة عن عاصم' },
  { id: 'sousi', name: 'السوسي عن أبي عمرو' },
  { id: 'bazzi', name: 'البزي عن ابن كثير' },
] as const

type Riwaya = (typeof RIWAYAT)[number]['id']
type PageAssets = { text: Set<number>; svg: Set<number>; image: Set<number> }

type OfflineSummary = {
  supported: boolean
  pageFiles: number
  audioFiles: number
  indexedAudioFiles: number | null
  byRiwaya: Record<Riwaya, number>
  storageUsed: number | null
  storageQuota: number | null
  serviceWorkerReady: boolean
  lastChecked: number
}

function emptyAssets(): PageAssets {
  return { text: new Set<number>(), svg: new Set<number>(), image: new Set<number>() }
}

function countStoredIndexedAudio(): Promise<number | null> {
  // فتح قاعدة غير موجودة قد يُنشئ قاعدة فارغة؛ لذلك نوقف الترقية مباشرةً.
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    let db: IDBDatabase | null = null
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (db) db.close()
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), 6000)
    try {
      const request = indexedDB.open(LIBRARY_DB)
      request.onupgradeneeded = () => {
        // لا نغيّر قاعدة البيانات من صفحة الاستعراض.
        request.transaction?.abort()
      }
      request.onerror = () => finish(0)
      request.onblocked = () => finish(null)
      request.onsuccess = () => {
        db = request.result
        if (settled) {
          db.close()
          return
        }
        if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
          finish(0)
          return
        }
        try {
          const tx = db.transaction(LIBRARY_STORE, 'readonly')
          const count = tx.objectStore(LIBRARY_STORE).count()
          count.onsuccess = () => finish(count.result)
          count.onerror = () => finish(null)
          tx.onabort = () => finish(null)
        } catch {
          finish(null)
        }
      }
    } catch {
      finish(null)
    }
  })
}

function getPageIdentifier(requestUrl: string): {
  riwaya: Riwaya
  number: number
  kind: 'text' | 'svg' | 'image'
} | null {
  try {
    const url = new URL(requestUrl)
    if (url.origin !== window.location.origin) return null
    const path = url.pathname
    const kind = path === '/api/quran'
      ? 'text'
      : path === '/api/mushaf-svg'
        ? 'svg'
        : path === '/api/mushaf-riwaya-image'
          ? 'image'
          : null
    if (!kind) return null
    const name = url.searchParams.get('riwaya')
    const number = Number(url.searchParams.get('page'))
    const riwaya = RIWAYAT.find((entry) => entry.id === name)?.id
    if (!riwaya || !Number.isInteger(number) || number < 1 || number > TOTAL_QURAN_PAGES) {
      return null
    }
    return { riwaya, number, kind }
  } catch {
    return null
  }
}

async function getCacheKeys(name: string, existing: Set<string>): Promise<Request[]> {
  if (!existing.has(name)) return []
  try {
    const cache = await caches.open(name)
    return await cache.keys()
  } catch {
    return []
  }
}

async function inspectOfflineStorage(): Promise<OfflineSummary> {
  const supported = typeof window !== 'undefined' && 'caches' in window
  const byRiwaya = Object.fromEntries(
    RIWAYAT.map((item) => [item.id, 0]),
  ) as Record<Riwaya, number>

  const [indexedAudioFiles, estimate, serviceWorkerReady] = await Promise.all([
    countStoredIndexedAudio(),
    navigator.storage?.estimate?.().catch(() => null) ?? Promise.resolve(null),
    Promise.resolve(Boolean(navigator.serviceWorker?.controller)),
  ])

  if (!supported) {
    return {
      supported: false,
      pageFiles: 0,
      audioFiles: 0,
      indexedAudioFiles,
      byRiwaya,
      storageUsed: estimate?.usage ?? null,
      storageQuota: estimate?.quota ?? null,
      serviceWorkerReady,
      lastChecked: Date.now(),
    }
  }

  const existing = new Set(await caches.keys())
  const assets: Record<Riwaya, PageAssets> = Object.fromEntries(
    RIWAYAT.map((item) => [item.id, emptyAssets()]),
  ) as Record<Riwaya, PageAssets>

  const allPageRequests = await Promise.all(
    [PAGE_CACHE, ...IMAGE_CACHES].map((name) => getCacheKeys(name, existing)),
  )
  for (const requests of allPageRequests) {
    for (const request of requests) {
      const page = getPageIdentifier(request.url)
      if (page) assets[page.riwaya][page.kind].add(page.number)
    }
  }

  // نعدّ الصفحة جاهزة فقط حين تتوفر بيانات الآيات وصفحة SVG،
  // وكذلك الصورة الأصلية المطلوبة لروايتي السوسي والبزي.
  for (const item of RIWAYAT) {
    const stored = assets[item.id]
    let total = 0
    for (const page of stored.text) {
      const hasVisual = stored.svg.has(page)
      const needsImage = item.id === 'sousi' || item.id === 'bazzi'
      if (hasVisual && (!needsImage || stored.image.has(page))) total += 1
    }
    byRiwaya[item.id] = total
  }

  const audioUrls = new Set<string>()
  const allAudioRequests = await Promise.all(
    AUDIO_CACHES.map((name) => getCacheKeys(name, existing)),
  )
  for (const requests of allAudioRequests) {
    for (const request of requests) audioUrls.add(request.url)
  }

  return {
    supported: true,
    pageFiles: Object.values(byRiwaya).reduce((sum, value) => sum + value, 0),
    audioFiles: audioUrls.size,
    indexedAudioFiles,
    byRiwaya,
    storageUsed: estimate?.usage ?? null,
    storageQuota: estimate?.quota ?? null,
    serviceWorkerReady,
    lastChecked: Date.now(),
  }
}

function formatSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'غير متاح'
  if (bytes < 1024) return `${Math.round(bytes).toLocaleString('ar')} بايت`
  const units = ['كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < units.length - 1)
  return `${value.toLocaleString('ar', { maximumFractionDigits: 1 })} ${units[unit]}`
}

function formatCount(value: number): string {
  return value.toLocaleString('ar')
}

export default function OfflinePage() {
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<OfflineSummary | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await inspectOfflineStorage()
      setSummary(next)
    } catch {
      setError('تعذر قراءة بعض الملفات المحفوظة. جرّب تحديث الفحص.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOnline)
    void refresh()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOnline)
    }
  }, [refresh])

  const audioCount = (summary?.audioFiles ?? 0) + (summary?.indexedAudioFiles ?? 0)
  const storagePercent = summary?.storageUsed != null && summary.storageQuota != null && summary.storageQuota > 0
    ? Math.min(100, (summary.storageUsed / summary.storageQuota) * 100)
    : null

  return (
    <main dir="rtl" className="min-h-screen bg-[#F5F8FB] pb-28 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold tracking-wide text-[#B48A49]">مصحف سميع</p>
            <h1 className="text-2xl font-extrabold sm:text-3xl">التنزيلات دون إنترنت</h1>
          </div>
          <Link href="/" aria-label="العودة للرئيسية" className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:bg-slate-50">
            <ArrowLeft size={21} />
          </Link>
        </header>

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#123C4B] via-[#15566B] to-[#0C3446] p-6 text-white shadow-xl sm:p-8">
          <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-[#D9B878]/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                {online ? <Wifi size={15} /> : <WifiOff size={15} />}
                {online ? 'متصل بالإنترنت' : 'تستخدم التطبيق دون اتصال'}
              </span>
              <h2 className="mt-5 text-xl font-extrabold leading-relaxed sm:text-2xl">القرآن معك أينما كنت</h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-white/75">
                تابع ما حُفظ بالفعل على جهازك، واعرف الصفحات والتلاوات المتاحة للاستخدام دون إنترنت.
              </p>
            </div>
            <div className="hidden h-16 w-16 shrink-0 place-items-center rounded-2xl border border-[#D9B878]/30 bg-[#D9B878]/10 text-[#F1D39A] sm:grid">
              <Download size={32} strokeWidth={1.6} />
            </div>
          </div>
          <div className="relative mt-5 flex items-center gap-2 text-xs text-white/75">
            {summary?.serviceWorkerReady ? <ShieldCheck size={15} className="text-[#D9B878]" /> : <Info size={15} />}
            <span>{summary?.serviceWorkerReady ? 'خدمة العمل دون إنترنت نشطة لهذه الصفحة' : 'لتشغيل الملفات دون إنترنت، افتح التطبيق مرة على الأقل أثناء الاتصال وتأكد من تفعيل خدمة التطبيق.'}</span>
          </div>
        </section>

        <div className="my-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">البيانات المعروضة تخص هذا المتصفح وهذا الجهاز فقط.</p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#15566B] shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            تحديث الفحص
          </button>
        </div>

        {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-[#EDF7F4] p-2.5 text-[#23745F]"><BookOpen size={21} /></div>
            <p className="text-3xl font-extrabold tabular-nums">{loading && !summary ? '—' : formatCount(summary?.pageFiles ?? 0)}</p>
            <p className="mt-1 text-sm font-bold text-slate-700">صفحة مصحف محفوظة</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">صفحات مكتملة العناصر اللازمة للعرض</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-[#FFF6E9] p-2.5 text-[#B48A49]"><Headphones size={21} /></div>
            <p className="text-3xl font-extrabold tabular-nums">{loading && !summary ? '—' : formatCount(audioCount)}</p>
            <p className="mt-1 text-sm font-bold text-slate-700">ملف صوت محفوظ</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">يشمل كاش التلاوات ومكتبة التسجيلات</p>
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#EDF5FA] p-2 text-[#17678B]"><BookOpen size={20} /></div>
              <div>
                <h2 className="font-extrabold">صفحات القرآن المحفوظة</h2>
                <p className="mt-1 text-xs text-slate-500">عدد الصفحات المكتملة لكل رواية من أصل ٦٠٤ صفحات</p>
              </div>
            </div>
            <Link href="/mushaf" className="text-xs font-extrabold text-[#17678B] hover:underline">فتح المصحف</Link>
          </div>
          <div className="divide-y divide-slate-100 px-5 sm:px-6">
            {RIWAYAT.map((item) => {
              const count = summary?.byRiwaya[item.id] ?? 0
              const percent = (count / TOTAL_QURAN_PAGES) * 100
              return (
                <div key={item.id} className="py-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-slate-700">{item.name}</span>
                    <span className="font-extrabold text-[#15566B] tabular-nums">{formatCount(count)} / ٦٠٤</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`صفحات ${item.name}`} aria-valuenow={count} aria-valuemin={0} aria-valuemax={TOTAL_QURAN_PAGES}>
                    <div className="h-full rounded-full bg-gradient-to-l from-[#C69B5B] to-[#E6CB98] transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-start gap-2 border-t border-slate-100 bg-[#FAFBFC] px-5 py-4 text-xs leading-6 text-slate-500 sm:px-6">
            <Info size={17} className="mt-0.5 shrink-0" />
            قد توجد موارد مخزنة جزئيًا؛ لا تُحتسب الصفحة مكتملة إلا عند وجود النص والرسم، وصورة الصفحة للروايات التي تحتاجها.
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[#FFF6E9] p-2 text-[#B48A49]"><HardDrive size={20} /></div>
            <div>
              <h2 className="font-extrabold">مساحة التخزين</h2>
              <p className="mt-1 text-xs text-slate-500">تقدير المتصفح لمساحة هذا الموقع، وليس تنزيلات سميع وحدها</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-extrabold text-[#15566B]">{formatSize(summary?.storageUsed ?? null)}</span>
            <span className="text-xs text-slate-500">المتاح للموقع: {formatSize(summary?.storageQuota ?? null)}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#C69B5B] transition-all" style={{ width: `${storagePercent ?? 0}%` }} />
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-slate-500">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#23745F]" />
            هذه الصفحة لا تحذف أي ملفات أو تسجيلات محفوظة. الحفظ الكامل يتم من داخل المصحف والمكتبة الصوتية.
          </p>
        </section>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Link href="/mushaf" className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-[#D9B878]">
            <span className="flex items-center gap-3 font-bold"><BookOpen size={19} className="text-[#17678B]" /> تنزيل صفحات المصحف</span>
            <ArrowLeft size={17} className="text-slate-400 transition group-hover:-translate-x-1" />
          </Link>
          <Link href="/audio" className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-[#D9B878]">
            <span className="flex items-center gap-3 font-bold"><Headphones size={19} className="text-[#B48A49]" /> تنزيل التلاوات والصوتيات</span>
            <ArrowLeft size={17} className="text-slate-400 transition group-hover:-translate-x-1" />
          </Link>
        </div>

        <div className="rounded-2xl border border-[#DCE8EE] bg-[#EDF5FA] p-4 text-sm leading-7 text-[#31576A]">
          <div className="mb-1 flex items-center gap-2 font-extrabold">
            {online ? <Database size={17} /> : <CloudOff size={17} />}
            مهم قبل السفر أو انقطاع الاتصال
          </div>
          نزّل الرواية والتلاوات التي تحتاجها وأنت متصل بالإنترنت، ثم اختبر فتح المصحف وتشغيل الصوت دون اتصال على نفس الجهاز.
        </div>
        {!summary?.supported && !loading && (
          <div role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            المتصفح الحالي لا يدعم واجهة Cache Storage، وبالتالي لا يمكن فحص صفحات المصحف المخزنة من هنا.
          </div>
        )}
      </div>
    </main>
  )
}
