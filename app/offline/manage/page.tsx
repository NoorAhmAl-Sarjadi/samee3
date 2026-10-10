
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  HardDrive,
  Headphones,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'

/**
 * SAMEE3 — Offline downloads manager.
 * Path: app/offline/manage/page.tsx
 *
 * Only known audio caches can be modified, and only after confirmation.
 * Mushaf pages, application files, and IndexedDB are read-only here.
 * Compatible with TypeScript target ES5: no for...of on Set/Map.
 */

const AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
]

const MUSHAF_CACHE = 'samee3-mushaf-pages-v2'
const LEGACY_IMAGE_CACHE = 'samee3-v3-riwaya-images'
const BATCH_SIZE = 25

type CacheGroup = 'audio' | 'mushaf'

type CacheDetail = {
  name: string
  kind: CacheGroup
  count: number
}

type AudioDownload = {
  id: string
  cacheName: string
  request: Request
  url: string
  title: string
  subtitle: string
}

type DownloadSnapshot = {
  supported: boolean
  audioCount: number
  mushafCount: number
  cacheDetails: CacheDetail[]
  audioItems: AudioDownload[]
  storageUsed: number | null
  storageQuota: number | null
  scannedAt: number
  warnings: string[]
}

function isAudioCache(name: string): boolean {
  return AUDIO_CACHES.indexOf(name) !== -1
}

function isMushafCache(name: string): boolean {
  return (
    name === MUSHAF_CACHE ||
    name === LEGACY_IMAGE_CACHE ||
    /^samee3-offline-v\d+-riwaya-images$/.test(name)
  )
}

function readableCacheName(name: string): string {
  if (name === 'samee3-audio-v2') return 'التلاوات الرئيسية'
  if (name === 'samee3-v2-audio') return 'تلاوات محفوظة قديمة'
  if (name === 'samee-audio-v2') return 'مكتبة صوتية قديمة'
  if (name === MUSHAF_CACHE) return 'بيانات صفحات المصحف'
  if (isMushafCache(name)) return 'صور صفحات الروايات'
  return name
}

function audioDetails(urlString: string): { title: string; subtitle: string } {
  try {
    const url = new URL(urlString)
    const segments = url.pathname.split('/').filter(Boolean)
    const file = segments.length ? segments[segments.length - 1] : 'audio'
    const directory = segments.length > 1 ? segments[segments.length - 2] : ''
    const match = /^(\d{3})\.(mp3|m4a|aac|ogg)$/i.exec(file)

    return {
      title: match ? `تلاوة رقم ${Number(match[1]).toLocaleString('ar-EG')}` : file,
      subtitle: directory ? `${url.hostname} / ${directory}` : url.hostname,
    }
  } catch {
    return { title: 'تسجيل صوتي محفوظ', subtitle: urlString }
  }
}

function formatNumber(number: number): string {
  return number.toLocaleString('ar-EG')
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'غير متاح'
  if (bytes < 1024) return `${formatNumber(Math.round(bytes))} بايت`

  const units = ['كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت']
  let n = bytes
  let unit = -1

  do {
    n /= 1024
    unit += 1
  } while (n >= 1024 && unit < units.length - 1)

  return `${n.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ${units[unit]}`
}

async function collectDownloads(): Promise<DownloadSnapshot> {
  const empty: DownloadSnapshot = {
    supported: false,
    audioCount: 0,
    mushafCount: 0,
    cacheDetails: [],
    audioItems: [],
    storageUsed: null,
    storageQuota: null,
    scannedAt: Date.now(),
    warnings: [],
  }

  if (typeof window === 'undefined' || !('caches' in window)) return empty

  const snapshot: DownloadSnapshot = { ...empty, supported: true }
  const names = await caches.keys()
  const selectedNames = names.filter(
    (name) => isAudioCache(name) || isMushafCache(name),
  )

  const groups = await Promise.all(
    selectedNames.map(async (name): Promise<{
      detail: CacheDetail
      requests: Request[]
    } | null> => {
      try {
        const cache = await caches.open(name)
        const requests = Array.from(await cache.keys())
        const kind: CacheGroup = isAudioCache(name) ? 'audio' : 'mushaf'

        return { detail: { name, kind, count: requests.length }, requests }
      } catch {
        snapshot.warnings.push(`تعذر فحص ${readableCacheName(name)}`)
        return null
      }
    }),
  )

  groups.forEach((group) => {
    if (!group) return

    snapshot.cacheDetails.push(group.detail)
    if (group.detail.kind === 'mushaf') {
      snapshot.mushafCount += group.detail.count
      return
    }

    snapshot.audioCount += group.detail.count

    group.requests.forEach((request) => {
      const url = request.url
      const description = audioDetails(url)

      snapshot.audioItems.push({
        id: `${group.detail.name}::${url}`,
        cacheName: group.detail.name,
        request,
        url,
        title: description.title,
        subtitle: description.subtitle,
      })
    })
  })

  snapshot.audioItems.sort((a, b) =>
    a.title.localeCompare(b.title, 'ar'),
  )

  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      snapshot.storageUsed = typeof estimate.usage === 'number' ? estimate.usage : null
      snapshot.storageQuota = typeof estimate.quota === 'number' ? estimate.quota : null
    }
  } catch {
    snapshot.warnings.push('تعذر تحديد مساحة التخزين على هذا المتصفح')
  }

  snapshot.scannedAt = Date.now()
  return snapshot
}

export default function OfflineManagePage() {
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<DownloadSnapshot | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(BATCH_SIZE)
  const [pendingDelete, setPendingDelete] = useState<AudioDownload | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setSnapshot(await collectDownloads())
    } catch {
      setError('تعذر قراءة التنزيلات. تأكد من السماح للتطبيق باستخدام التخزين المحلي.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    updateConnection()

    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    void refresh()

    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [refresh])

  const matchedAudio = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    const items = snapshot?.audioItems ?? []
    if (!term) return items

    return items.filter((item) =>
      `${item.title} ${item.subtitle} ${item.url} ${readableCacheName(item.cacheName)}`
        .toLocaleLowerCase()
        .includes(term),
    )
  }, [snapshot, query])

  const shownAudio = matchedAudio.slice(0, visible)

  const percentage =
    snapshot?.storageUsed != null &&
    snapshot.storageQuota != null &&
    snapshot.storageQuota > 0
      ? Math.min(100, (snapshot.storageUsed / snapshot.storageQuota) * 100)
      : 0

  const confirmDelete = async () => {
    const item = pendingDelete
    if (!item || deleting) return

    if (!isAudioCache(item.cacheName)) {
      setPendingDelete(null)
      setError('لا يمكن حذف ملفات المصحف أو التطبيق من هذه الصفحة.')
      return
    }

    setDeleting(true)
    setError('')
    setSuccess('')

    try {
      const existingNames = await caches.keys()
      if (existingNames.indexOf(item.cacheName) === -1) {
        throw new Error('cache-missing')
      }

      const cache = await caches.open(item.cacheName)
      const removed = await cache.delete(item.request, { ignoreVary: true })
      if (!removed) throw new Error('entry-missing')

      setPendingDelete(null)
      await refresh()
      setSuccess('تم حذف التسجيل المحدد من كاش الصوت على هذا الجهاز.')
    } catch {
      setError('تعذر حذف التسجيل. ربما تغيّر محتوى الكاش؛ أعد الفحص ثم حاول مرة أخرى.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f9fe] pb-28 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold text-[#b58a4c]">مصحف سميع · SAMEE3</p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">إدارة التنزيلات</h1>
            <p className="mt-2 text-sm text-slate-500">راجع التلاوات المحفوظة على جهازك ونظّمها بأمان.</p>
          </div>
          <Link href="/offline" aria-label="العودة للتنزيلات" className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3 text-[#15566b] shadow-sm">
            <ArrowRight size={21} />
          </Link>
        </header>

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0d3d52] via-[#155c70] to-[#0d3548] p-6 text-white shadow-lg sm:p-8">
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              {online ? 'متصل بالإنترنت' : 'بدون اتصال بالإنترنت'}
            </span>
            <ShieldCheck size={25} className="text-[#e7cb99]" />
          </div>
          <h2 className="relative mt-5 text-xl font-extrabold">تنزيلاتك تحت سيطرتك</h2>
          <p className="relative mt-2 max-w-xl text-sm leading-7 text-white/80">
            تقدر تشوف ملفات التلاوات المحفوظة وتبحث عنها، وتحذف تسجيلًا بعينه بعد تأكيدك. صفحات القرآن وملفات تشغيل التطبيق محمية من الحذف هنا.
          </p>
        </section>

        <div className="my-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-6 text-slate-500">النتائج تخص هذا المتصفح والجهاز فقط.</p>
          <button type="button" onClick={() => void refresh()} disabled={loading || deleting} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#15566b] shadow-sm disabled:opacity-60">
            {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            {loading ? 'جارٍ الفحص' : 'تحديث الفحص'}
          </button>
        </div>

        {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</div>}
        {success && <div role="status" className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={19} className="mt-0.5 shrink-0" />{success}</div>}
        {!loading && snapshot && !snapshot.supported && <div role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">هذا المتصفح لا يدعم قراءة Cache Storage، ولذلك لا يمكن إدارة التلاوات من هنا.</div>}

        <div className="mb-5 grid grid-cols-2 gap-3">
          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-[#fff5e7] p-2.5 text-[#b58a4c]"><Headphones size={21} /></div>
            <p className="text-3xl font-extrabold tabular-nums">{snapshot ? formatNumber(snapshot.audioCount) : '—'}</p>
            <h3 className="mt-1 text-sm font-bold">تسجيل في كاش الصوت</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">قد توجد نسخ مكررة بين المخازن القديمة والجديدة.</p>
          </article>
          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-[#eaf5f9] p-2.5 text-[#1a647d]"><BookOpen size={21} /></div>
            <p className="text-3xl font-extrabold tabular-nums">{snapshot ? formatNumber(snapshot.mushafCount) : '—'}</p>
            <h3 className="mt-1 text-sm font-bold">مورد مصحف محفوظ</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">عدد الملفات، وليس عدد الصفحات المكتملة.</p>
          </article>
        </div>

        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[#eef3f9] p-2.5 text-[#1a647d]"><Database size={21} /></div>
            <div><h2 className="font-extrabold">تفاصيل المخازن</h2><p className="mt-1 text-xs text-slate-500">المخازن المعروفة لمصحف سميع فقط</p></div>
          </div>
          {snapshot?.cacheDetails.length ? (
            <div className="divide-y divide-slate-100">
              {snapshot.cacheDetails.map((detail) => (
                <div key={detail.name} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-700">{readableCacheName(detail.name)}</p>
                    <p dir="ltr" className="mt-1 truncate text-left text-[11px] text-slate-400">{detail.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 font-extrabold tabular-nums text-[#15566b]">{formatNumber(detail.count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-slate-500">{loading ? 'جارٍ قراءة المخازن...' : 'لا توجد مخازن معروفة محفوظة حاليًا.'}</p>
          )}
          {snapshot?.warnings.map((warning) => (
            <p key={warning} role="status" className="mt-2 flex items-center gap-2 text-xs text-amber-700"><AlertTriangle size={15} />{warning}</p>
          ))}
        </section>

        <section className="mb-5 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-extrabold">التلاوات المحفوظة</h2><p className="mt-1 text-xs text-slate-500">حذف تسجيل واحد لا يحذف باقي التلاوات.</p></div>
              <Headphones size={23} className="text-[#b58a4c]" />
            </div>
            <label className="relative mt-4 block">
              <span className="sr-only">ابحث في التلاوات المحفوظة</span>
              <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setVisible(BATCH_SIZE) }}
                placeholder="ابحث باسم التسجيل أو رابطه..."
                className="w-full rounded-xl border border-slate-200 bg-[#f9fbfd] py-3 pl-4 pr-10 text-sm outline-none transition focus:border-[#b58a4c] focus:ring-2 focus:ring-[#b58a4c]/15"
              />
            </label>
            <p className="mt-3 text-xs text-slate-500">نتائج البحث: {formatNumber(matchedAudio.length)}</p>
          </div>

          {shownAudio.length ? (
            <div className="divide-y divide-slate-100 px-4 sm:px-6">
              {shownAudio.map((item) => (
                <article key={item.id} className="flex items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-xl bg-[#fff6e9] p-2.5 text-[#b58a4c]"><Headphones size={18} /></div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold text-slate-800">{item.title}</h3>
                      <p dir="ltr" className="mt-1 truncate text-left text-xs text-slate-500">{item.subtitle}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-400">{readableCacheName(item.cacheName)}</p>
                    </div>
                  </div>
                  <button type="button" disabled={loading || deleting} onClick={() => { setPendingDelete(item); setSuccess('') }} aria-label={`حذف ${item.title}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                    <Trash2 size={15} /> حذف
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm leading-7 text-slate-500">
              {loading ? 'جارٍ تحميل القائمة...' : query.trim() ? 'لا توجد تسجيلات مطابقة للبحث.' : 'لا توجد تلاوات في مخازن الصوت المعروفة.'}
            </div>
          )}

          {matchedAudio.length > visible && (
            <div className="border-t border-slate-100 p-4 text-center">
              <button type="button" onClick={() => setVisible((count) => count + BATCH_SIZE)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-[#15566b]">عرض المزيد ({formatNumber(matchedAudio.length - visible)} متبقٍ)</button>
            </div>
          )}
        </section>

        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[#eaf5f9] p-2.5 text-[#1a647d]"><HardDrive size={20} /></div>
            <div><h2 className="font-extrabold">تخزين الموقع</h2><p className="mt-1 text-xs text-slate-500">تقدير شامل لتخزين الموقع، وليس للتلاوات فقط.</p></div>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <strong className="text-[#15566b]">{formatBytes(snapshot?.storageUsed ?? null)}</strong>
            <span className="text-slate-500">الحصة: {formatBytes(snapshot?.storageQuota ?? null)}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#c7a05f]" style={{ width: `${percentage}%` }} /></div>
        </section>

        <div className="rounded-2xl border border-[#dce7ee] bg-white p-5 text-sm leading-7 text-slate-600">
          <p className="mb-2 flex items-center gap-2 font-extrabold text-[#15566b]"><Info size={19} /> معلومات مهمة</p>
          هذه الصفحة تدير ملفات الصوت المحفوظة في Cache Storage فقط؛ لا تحذف صفحات القرآن أو ملفات التطبيق أو تسجيلات IndexedDB. قد تحتاج لاتصال بالإنترنت لإعادة تنزيل تسجيل حذفته.
          <p className="mt-2 text-xs text-slate-400">{snapshot ? `آخر فحص: ${new Date(snapshot.scannedAt).toLocaleString('ar-EG')}` : 'بانتظار الفحص'}</p>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-audio-delete" className="w-full max-w-md rounded-[26px] bg-white p-6 text-right shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-600"><AlertTriangle size={24} /></div>
              <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)} aria-label="إغلاق" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <h2 id="confirm-audio-delete" className="mt-4 text-xl font-extrabold">حذف التلاوة من الجهاز؟</h2>
            <p className="mt-3 break-words text-sm leading-7 text-slate-600">سيتم حذف <strong>{pendingDelete.title}</strong> من مخزن «{readableCacheName(pendingDelete.cacheName)}» فقط. يمكنك إعادة تنزيلها عند الاتصال بالإنترنت.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPendingDelete(null)} disabled={deleting} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">إلغاء</button>
              <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                {deleting ? 'جارٍ الحذف' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
