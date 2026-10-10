'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Database,
  Download,
  HardDrive,
  Headphones,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import {
  listOfflineTafsirs,
  removeOfflineTafsir,
  type OfflineBook,
} from '@/lib/tafsir-offline'

/**
 * SAMEE3 — Offline downloads dashboard
 * Path: app/offline/page.tsx
 *
 * - Reads existing Cache Storage and IndexedDB without clearing them.
 * - Deletes only one selected riwaya's Quran assets or one tafsir book,
 *   and only after explicit confirmation.
 * - Audio deletion stays in /offline/manage (the existing audio manager).
 * - Never clears application-shell caches, Firebase data or user notes.
 */

const PAGE_TOTAL = 604
const PAGE_CACHE = 'samee3-mushaf-pages-v2'
const LEGACY_IMAGE_CACHE = 'samee3-v3-riwaya-images'
const AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
]
const AUDIO_DB_NAME = 'samee-audio-library'
const AUDIO_DB_STORE = 'audio'

type RiwayaId =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'
  | 'sousi'
  | 'bazzi'

type AssetKind = 'text' | 'svg' | 'image'

type PageAsset = {
  riwaya: RiwayaId
  page: number
  kind: AssetKind
}

type RiwayaStorage = {
  complete: number
  assets: number
}

type OfflineStats = {
  cacheSupported: boolean
  workerActive: boolean
  riwayat: Record<RiwayaId, RiwayaStorage>
  allComplete: number
  cachedAudio: number
  indexedAudio: number | null
  tafsirBooks: OfflineBook[]
  tafsirAvailable: boolean
  used: number | null
  quota: number | null
  persistent: boolean | null
  warnings: string[]
  checkedAt: number
}

type DeleteTarget =
  | { kind: 'riwaya'; id: RiwayaId; label: string }
  | { kind: 'tafsir'; id: number; label: string }

const RIWAYAT: Array<{ id: RiwayaId; name: string }> = [
  { id: 'hafs', name: 'حفص عن عاصم' },
  { id: 'warsh', name: 'ورش عن نافع' },
  { id: 'qalun', name: 'قالون عن نافع' },
  { id: 'douri', name: 'الدوري عن أبي عمرو' },
  { id: 'shubah', name: 'شعبة عن عاصم' },
  { id: 'sousi', name: 'السوسي عن أبي عمرو' },
  { id: 'bazzi', name: 'البزي عن ابن كثير' },
]

const TAFSIR_NAMES: Record<number, string> = {
  2012: 'التفسير الميسر',
  136: 'تفسير ابن كثير',
  4: 'تفسير الطبري',
  2: 'تفسير البغوي',
  3: 'تفسير السعدي',
  1469: 'تفسير القرطبي',
  27796: 'أضواء البيان',
  54: 'أيسر التفاسير',
}

function formatNumber(value: number): string {
  return value.toLocaleString('ar-EG')
}

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return 'غير متاح'
  }

  if (value < 1024) return `${formatNumber(Math.round(value))} بايت`

  const units = ['كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت']
  let number = value
  let unit = -1

  do {
    number /= 1024
    unit += 1
  } while (number >= 1024 && unit < units.length - 1)

  return `${number.toLocaleString('ar-EG', {
    maximumFractionDigits: 1,
  })} ${units[unit]}`
}

function isPageCache(name: string): boolean {
  return (
    name === PAGE_CACHE ||
    name === LEGACY_IMAGE_CACHE ||
    /^samee3-offline-v\d+-riwaya-images$/.test(name)
  )
}

function parsePageAsset(urlString: string): PageAsset | null {
  try {
    const url = new URL(urlString, window.location.origin)
    if (url.origin !== window.location.origin) return null

    let kind: AssetKind
    if (url.pathname === '/api/quran') kind = 'text'
    else if (url.pathname === '/api/mushaf-svg') kind = 'svg'
    else if (url.pathname === '/api/mushaf-riwaya-image') kind = 'image'
    else return null

    const riwaya = url.searchParams.get('riwaya')
    const valid = RIWAYAT.find((item) => item.id === riwaya)
    if (!valid) return null

    const pageText = url.searchParams.get('page') || ''
    if (!/^\d{1,3}$/.test(pageText)) return null

    const page = Number(pageText)
    if (page < 1 || page > PAGE_TOTAL) return null

    return { riwaya: valid.id, page, kind }
  } catch {
    return null
  }
}

function emptyAssetIndex(): Record<
  RiwayaId,
  { text: Set<number>; svg: Set<number>; image: Set<number> }
> {
  const output = {} as Record<
    RiwayaId,
    { text: Set<number>; svg: Set<number>; image: Set<number> }
  >

  RIWAYAT.forEach(({ id }) => {
    output[id] = {
      text: new Set<number>(),
      svg: new Set<number>(),
      image: new Set<number>(),
    }
  })

  return output
}

/** Count existing audio records without creating an empty legacy DB. */
async function countIndexedAudio(): Promise<number | null> {
  if (typeof indexedDB === 'undefined') return null

  if (typeof indexedDB.databases === 'function') {
    try {
      const names = await indexedDB.databases()
      if (!names.some((entry) => entry.name === AUDIO_DB_NAME)) return 0
    } catch {
      // Older browsers may not support listing databases.
    }
  }

  return new Promise<number | null>((resolve) => {
    let done = false
    let database: IDBDatabase | null = null
    const timer = window.setTimeout(() => finish(null), 6500)

    function finish(count: number | null) {
      if (done) return
      done = true
      window.clearTimeout(timer)
      database?.close()
      resolve(count)
    }

    try {
      const request = indexedDB.open(AUDIO_DB_NAME)

      request.onupgradeneeded = () => {
        // If absent, abort rather than create a new database.
        request.transaction?.abort()
      }
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
      request.onsuccess = () => {
        database = request.result
        if (done) {
          database.close()
          return
        }

        if (!database.objectStoreNames.contains(AUDIO_DB_STORE)) {
          finish(0)
          return
        }

        try {
          const transaction = database.transaction(AUDIO_DB_STORE, 'readonly')
          const counter = transaction.objectStore(AUDIO_DB_STORE).count()
          counter.onsuccess = () => finish(counter.result)
          counter.onerror = () => finish(null)
          transaction.onabort = () => finish(null)
        } catch {
          finish(null)
        }
      }
    } catch {
      finish(null)
    }
  })
}

async function inspectOffline(): Promise<OfflineStats> {
  const index = emptyAssetIndex()
  const riwayat = {} as Record<RiwayaId, RiwayaStorage>
  const warnings: string[] = []

  const cacheSupported = typeof caches !== 'undefined'
  const workerActive = Boolean(navigator.serviceWorker?.controller)
  const indexedAudioPromise = countIndexedAudio()
  const tafsirPromise = listOfflineTafsirs()
    .then((books) => ({ books, available: true }))
    .catch(() => ({ books: [] as OfflineBook[], available: false }))

  let cachedAudio = 0
  let used: number | null = null
  let quota: number | null = null
  let persistent: boolean | null = null

  try {
    if (navigator.storage?.estimate) {
      const value = await navigator.storage.estimate()
      used = typeof value.usage === 'number' ? value.usage : null
      quota = typeof value.quota === 'number' ? value.quota : null
    }
    if (navigator.storage?.persisted) {
      persistent = await navigator.storage.persisted()
    }
  } catch {
    warnings.push('تعذر قراءة تفاصيل مساحة تخزين الموقع.')
  }

  if (cacheSupported) {
    try {
      const names = await caches.keys()
      const audioUrls = new Set<string>()

      // Read the cache keys only; do not fetch content or modify downloads.
      for (let i = 0; i < names.length; i += 1) {
        const name = names[i]
        if (!isPageCache(name) && AUDIO_CACHES.indexOf(name) === -1) continue

        try {
          const cache = await caches.open(name)
          const requests = await cache.keys()

          requests.forEach((request) => {
            if (AUDIO_CACHES.indexOf(name) !== -1) {
              audioUrls.add(request.url)
            } else {
              const asset = parsePageAsset(request.url)
              if (asset) index[asset.riwaya][asset.kind].add(asset.page)
            }
          })
        } catch {
          warnings.push(`تعذر فحص مخزن ${name}.`)
        }
      }

      cachedAudio = audioUrls.size
    } catch {
      warnings.push('تعذر فتح بعض ملفات Cache Storage.')
    }
  } else {
    warnings.push('هذا المتصفح لا يتيح فحص Cache Storage.')
  }

  let allComplete = 0

  RIWAYAT.forEach(({ id }) => {
    const record = index[id]
    const needImage = id === 'sousi' || id === 'bazzi'
    let complete = 0

    record.text.forEach((page) => {
      if (record.svg.has(page) && (!needImage || record.image.has(page))) {
        complete += 1
      }
    })

    riwayat[id] = {
      complete,
      assets: record.text.size + record.svg.size + record.image.size,
    }
    allComplete += complete
  })

  const tafsirResult = await tafsirPromise
  if (!tafsirResult.available) {
    warnings.push('تعذر فحص كتب التفسير المحفوظة حاليًا.')
  }

  return {
    cacheSupported,
    workerActive,
    riwayat,
    allComplete,
    cachedAudio,
    indexedAudio: await indexedAudioPromise,
    tafsirBooks: tafsirResult.books,
    tafsirAvailable: tafsirResult.available,
    used,
    quota,
    persistent,
    warnings,
    checkedAt: Date.now(),
  }
}

/** Remove only the targeted riwaya's known Quran page requests. */
async function deleteRiwayaFiles(id: RiwayaId): Promise<number> {
  if (typeof caches === 'undefined') {
    throw new Error('التخزين المحلي غير متاح.')
  }

  const names = await caches.keys()
  const selected = names.filter(isPageCache)
  let deleted = 0

  for (let i = 0; i < selected.length; i += 1) {
    const cache = await caches.open(selected[i])
    const requests = await cache.keys()
    const matched = requests.filter((request) => {
      const asset = parsePageAsset(request.url)
      return asset?.riwaya === id
    })

    // Bound concurrent Cache Storage operations on mobile browsers.
    for (let start = 0; start < matched.length; start += 15) {
      const batch = matched.slice(start, start + 15)
      const results = await Promise.all(batch.map((request) => cache.delete(request)))
      deleted += results.filter(Boolean).length
    }
  }

  return deleted
}

export default function OfflinePage() {
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [stats, setStats] = useState<OfflineStats | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<DeleteTarget | null>(null)
  const scanNumber = useRef(0)
  const lastScanned = useRef(0)

  const refresh = useCallback(async () => {
    const ticket = ++scanNumber.current
    setLoading(true)
    setError('')

    try {
      const result = await inspectOffline()
      if (ticket !== scanNumber.current) return
      setStats(result)
      lastScanned.current = Date.now()
    } catch (cause) {
      if (ticket !== scanNumber.current) return
      console.error('SAMEE3 offline inspection:', cause)
      setError('تعذر فحص التنزيلات. يمكنك إعادة المحاولة دون فقدان أي ملفات.')
    } finally {
      if (ticket === scanNumber.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const connectionChanged = () => setOnline(navigator.onLine)
    const checkOnReturn = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastScanned.current > 20000
      ) {
        void refresh()
      }
    }

    connectionChanged()
    void refresh()

    window.addEventListener('online', connectionChanged)
    window.addEventListener('offline', connectionChanged)
    window.addEventListener('focus', checkOnReturn)
    document.addEventListener('visibilitychange', checkOnReturn)

    return () => {
      scanNumber.current += 1
      window.removeEventListener('online', connectionChanged)
      window.removeEventListener('offline', connectionChanged)
      window.removeEventListener('focus', checkOnReturn)
      document.removeEventListener('visibilitychange', checkOnReturn)
    }
  }, [refresh])

  const deleteSelected = async () => {
    if (!confirm || working) return
    const target = confirm
    setWorking(true)
    setError('')
    setNotice('')

    try {
      if (target.kind === 'riwaya') {
        const count = await deleteRiwayaFiles(target.id)
        setNotice(
          `تم حذف ${formatNumber(count)} ملفًا من صفحات ${target.label} فقط. ` +
          'باقي الروايات والتفاسير والتلاوات لم تتغير.',
        )
      } else {
        await removeOfflineTafsir(target.id)
        setNotice(`تم حذف كتاب «${target.label}» من هذا الجهاز فقط.`)
      }
      setConfirm(null)
      await refresh()
    } catch (cause) {
      console.error('SAMEE3 offline deletion:', cause)
      setError('تعذر إتمام الحذف بالكامل. اضغط تحديث الفحص لمعرفة الملفات المتبقية.')
      setConfirm(null)
      await refresh()
    } finally {
      setWorking(false)
    }
  }

  const requestPersistence = async () => {
    try {
      if (!navigator.storage?.persist) {
        setNotice('هذا المتصفح لا يدعم طلب التخزين المستمر.')
        return
      }
      const granted = await navigator.storage.persist()
      setNotice(
        granted
          ? 'المتصفح وافق على طلب الاحتفاظ بالتنزيلات قدر الإمكان.'
          : 'المتصفح لم يمنح إذن التخزين المستمر. تظل الملفات المحفوظة متاحة وفق سياسة الجهاز.',
      )
      await refresh()
    } catch {
      setNotice('تعذر طلب التخزين المستمر من المتصفح.')
    }
  }

  const usedPercentage =
    stats?.used !== null &&
    stats?.used !== undefined &&
    stats?.quota !== null &&
    stats?.quota !== undefined &&
    stats.quota > 0
      ? Math.min(100, (stats.used / stats.quota) * 100)
      : 0

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f9fe] pb-28 text-[#163a4b]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7 sm:py-9">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-wide text-[#af874b]">SAMEE3 · مصحف سميع</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">مكتبتي دون إنترنت</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-500">
              مكان واحد لمعرفة الروايات والتلاوات والتفاسير المحفوظة على هذا الجهاز.
            </p>
          </div>
          <Link href="/" aria-label="العودة للرئيسية" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <ArrowRight size={20} />
          </Link>
        </header>

        <section className="rounded-[28px] bg-gradient-to-bl from-[#103c4d] via-[#145870] to-[#17677c] p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold">
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? 'الجهاز متصل بالشبكة' : 'الجهاز دون اتصال'}
            </span>
            <BookOpen size={28} className="text-[#f2d9a4]" />
          </div>
          <h2 className="mt-5 text-xl font-extrabold sm:text-2xl">القرآن معك أينما كنت</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-white/80">
            تظهر هنا الصفحات والكتب المحفوظة بالفعل. تنزيل محتوى جديد يتم باختيارك داخل المصحف، ولن يبدأ تلقائيًا من هذه الصفحة.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/mushaf" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ead09a] px-5 py-3 text-sm font-extrabold text-[#173c4c]">
              <Download size={18} /> فتح المصحف والتنزيل
            </Link>
            <Link href="/offline/manage" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white">
              <Headphones size={18} /> إدارة التلاوات
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs leading-6 text-white/75">
            <ShieldCheck size={16} className="shrink-0 text-[#ead09a]" />
            {stats?.workerActive
              ? 'خدمة التشغيل دون إنترنت مفعّلة لهذه الصفحة.'
              : 'افتح التطبيق مرة أثناء الاتصال للتأكد من تفعيل خدمة التشغيل دون إنترنت.'}
          </p>
        </section>

        <div className="my-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">الحالة تخص المتصفح الحالي فقط، وليست مزامنة بين الأجهزة.</p>
          <button type="button" disabled={loading || working} onClick={() => void refresh()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#145870] disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {loading ? 'جارٍ الفحص…' : 'تحديث الفحص'}
          </button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-2xl border border-[#d4e9de] bg-[#f2fbf5] p-4 text-sm leading-7 text-[#246446]">{notice}</p>}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'صفحة مصحف مكتملة', value: stats ? formatNumber(stats.allComplete) : '—', icon: BookOpen },
            { label: 'تسجيل في كاش الصوت', value: stats ? formatNumber(stats.cachedAudio) : '—', icon: Headphones },
            { label: 'كتاب تفسير محفوظ', value: stats?.tafsirAvailable ? formatNumber(stats.tafsirBooks.length) : '—', icon: Database },
            { label: 'ملف بمكتبة الصوت', value: stats?.indexedAudio == null ? '—' : formatNumber(stats.indexedAudio), icon: HardDrive },
          ].map((item) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <span className="mb-4 inline-flex rounded-xl bg-[#f8f2e6] p-2.5 text-[#ad8547]"><Icon size={20} /></span>
                <p className="text-2xl font-black tabular-nums text-[#14566e] sm:text-3xl">{item.value}</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">{item.label}</p>
              </article>
            )
          })}
        </div>

        <section className="mb-5 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-lg font-extrabold">صفحات الروايات السبع</h2>
              <p className="mt-1 text-xs text-slate-500">604 صفحات لكل رواية — تُحسب الصفحة بعد وجود النص والرسم والصورة عند الحاجة</p>
            </div>
            <Link href="/mushaf" className="text-sm font-bold text-[#176c85] hover:underline">فتح المصحف</Link>
          </div>

          <div className="divide-y divide-slate-100 px-5 sm:px-6">
            {RIWAYAT.map(({ id, name }) => {
              const count = stats?.riwayat[id]?.complete || 0
              const assets = stats?.riwayat[id]?.assets || 0
              const progress = Math.min(100, (count / PAGE_TOTAL) * 100)

              return (
                <div key={id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold">{name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {count === PAGE_TOTAL ? 'مكتملة بحسب مفاتيح التخزين' : count > 0 ? 'جزء منها محفوظ — يمكن استكمال الناقص' : 'غير محمّلة بالكامل'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#14566e]">{formatNumber(count)} / ٦٠٤</span>
                  </div>

                  <div role="progressbar" aria-label={`صفحات ${name}`} aria-valuemin={0} aria-valuemax={PAGE_TOTAL} aria-valuenow={count} className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-l from-[#b88946] to-[#e6ca98]" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Link href={`/mushaf?riwaya=${id}`} className="text-xs font-extrabold text-[#176c85] hover:underline">
                      {count ? 'فتح الرواية' : 'فتح وتحميل الرواية'}
                    </Link>
                    {assets > 0 && (
                      <button type="button" disabled={working} onClick={() => setConfirm({ kind: 'riwaya', id, label: name })} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                        <Trash2 size={14} /> حذف تنزيل الرواية
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="flex gap-2 border-t border-slate-100 bg-[#fafbfc] px-5 py-4 text-xs leading-6 text-slate-500 sm:px-6">
            <Info size={17} className="mt-1 shrink-0" />
            العداد يفحص مفاتيح الملفات الموجودة، وليس سلامة محتوى كل صفحة. قبل السفر جرّب صفحات مختلفة بعد فصل الإنترنت. حذف الرواية لا يحذف صوتياتها أو كتب التفسير.
          </p>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">كتب التفسير المحفوظة</h2>
              <p className="mt-1 text-xs text-slate-500">محفوظة في IndexedDB، منفصلة عن كاش المصحف والتلاوات</p>
            </div>
            <Database size={23} className="text-[#b88e4e]" />
          </div>

          {stats?.tafsirAvailable === false ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">تعذر فحص كتب التفسير المحفوظة حاليًا.</p>
          ) : stats && stats.tafsirBooks.length ? (
            <div className="space-y-2">
              {stats.tafsirBooks.map((book) => (
                <div key={book.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#fcfdfd] p-3 sm:p-4">
                  <div className="min-w-0">
                    <p className="font-extrabold">{TAFSIR_NAMES[book.id] || `كتاب رقم ${book.id}`}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      {formatNumber(book.entries)} آية مفهرسة · ملف التنزيل {formatBytes(book.bytes)}
                    </p>
                  </div>
                  <button type="button" disabled={working} onClick={() => setConfirm({ kind: 'tafsir', id: book.id, label: TAFSIR_NAMES[book.id] || `كتاب رقم ${book.id}` })} aria-label={`حذف ${TAFSIR_NAMES[book.id] || `كتاب رقم ${book.id}`}`} className="shrink-0 rounded-xl bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-[#f7f9fb] px-4 py-6 text-center text-sm leading-7 text-slate-500">
              لا توجد كتب تفسير كاملة محفوظة. افتح المصحف، ثم اختر آية ← دون نت لتنزيل الكتاب الذي تريده.
            </p>
          )}
          <Link href="/mushaf" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#166580] hover:underline"><BookOpen size={16} /> فتح التفسير داخل المصحف</Link>
        </section>

        <section className="mb-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold"><Headphones size={20} className="text-[#b88e4e]" /> التلاوات المحفوظة</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              يوجد {formatNumber(stats?.cachedAudio || 0)} عنوان ملف في كاش التلاوات، و{stats?.indexedAudio == null ? 'عدد غير متاح' : formatNumber(stats.indexedAudio)} ملف بمكتبة الصوت المحلية. وقد تتكرر بعض التسجيلات بينهما.
            </p>
            <Link href="/offline/manage" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#145870] px-4 py-3 text-sm font-bold text-white">
              إدارة وحذف التلاوات المحددة <ArrowRight size={16} />
            </Link>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold"><HardDrive size={20} className="text-[#b88e4e]" /> مساحة التخزين</h2>
            <p className="mt-3 text-lg font-extrabold text-[#145870]">{formatBytes(stats?.used ?? null)}</p>
            <p className="mt-1 text-xs text-slate-500">من حصة تقديرية: {formatBytes(stats?.quota ?? null)}</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#c8a062]" style={{ width: `${usedPercentage}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {stats?.persistent === true ? 'التخزين المستمر مسموح' : stats?.persistent === false ? 'التخزين المستمر غير مضمون' : 'حالة الاحتفاظ بالتنزيلات غير متاحة'}
              </p>
              {stats?.persistent === false && (
                <button type="button" onClick={() => void requestPersistence()} className="rounded-xl border border-[#d6c49f] px-3 py-2 text-xs font-bold text-[#896c37]">طلب الاحتفاظ بالتنزيلات</button>
              )}
            </div>
          </article>
        </section>

        {stats?.warnings.length ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle size={17} /> ملاحظات الفحص</p>
            {stats.warnings.map((warning, index) => <p key={`${index}-${warning}`} className="mt-2 text-xs leading-6 text-amber-800">{warning}</p>)}
          </div>
        ) : null}

        <footer className="rounded-2xl border border-[#dfebef] bg-white p-5 text-xs leading-7 text-slate-500">
          <p className="flex items-center gap-2 font-extrabold text-[#145870]"><ShieldCheck size={18} /> الخصوصية والتنزيلات</p>
          <p className="mt-2">لا نحذف محتوى تلقائيًا. الحذف المحدد يحتاج تأكيدك، ولا يلمس بيانات الحساب أو الملاحظات أو ملفات التطبيق الأساسية. الملفات المحلية قد يحذفها نظام التشغيل عند نقص المساحة بحسب سياسة المتصفح.</p>
          <p className="mt-2">{stats ? `آخر فحص: ${new Date(stats.checkedAt).toLocaleString('ar-EG')}` : loading ? 'جارٍ فحص الجهاز…' : 'لم يكتمل الفحص بعد'}</p>
        </footer>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onClick={() => { if (!working) setConfirm(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="samee3-delete-title" onClick={(event: { stopPropagation(): void }) => event.stopPropagation()} className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl">
            <span className="inline-flex rounded-2xl bg-rose-50 p-3 text-rose-600"><AlertTriangle size={26} /></span>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h2 id="samee3-delete-title" className="text-lg font-extrabold">تأكيد حذف تنزيل محدد</h2>
              <button type="button" disabled={working} onClick={() => setConfirm(null)} aria-label="إغلاق" className="rounded-lg p-2 text-slate-500 disabled:opacity-40"><X size={19} /></button>
            </div>
            <p className="mt-3 text-sm leading-8 text-slate-600">
              هل تريد حذف {confirm.kind === 'riwaya' ? 'صفحات رواية' : 'كتاب تفسير'} <strong className="text-[#145870]">{confirm.label}</strong> من هذا الجهاز؟
              {confirm.kind === 'riwaya' ? ' لن نحذف الروايات الأخرى أو الصوتيات أو التفاسير.' : ' لن نحذف كتب التفسير الأخرى أو صفحات المصحف.'}
            </p>
            <p className="mt-2 text-xs leading-6 text-amber-700">لو كان تنزيل هذه الملفات جاريًا في تبويب آخر، أوقف التنزيل أولًا حتى لا يعيد إنشاء الملفات المحذوفة.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={working} onClick={() => setConfirm(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50">إلغاء</button>
              <button type="button" disabled={working} onClick={() => void deleteSelected()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {working ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                {working ? 'جارٍ الحذف…' : 'حذف المحدد'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
