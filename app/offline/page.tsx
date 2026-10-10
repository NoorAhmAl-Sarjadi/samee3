
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Database,
  HardDrive,
  Headphones,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'

// مصحف سميع — لوحة الملفات المحفوظة دون اتصال.
// هذه الصفحة للقراءة فقط: لا تنشئ كاش ولا تحذف تنزيلات.
const PAGE_CACHES = [
  'samee3-mushaf-pages-v2',
  'samee3-v3-riwaya-images',
]

const AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
]

const DB_NAME = 'samee-audio-library'
const DB_STORE = 'audio'
const PAGE_TOTAL = 604

type RiwayaId =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'
  | 'sousi'
  | 'bazzi'

type AssetKind = 'text' | 'svg' | 'image'

type PageAssets = {
  text: Set<number>
  svg: Set<number>
  image: Set<number>
}

type OfflineStats = {
  cacheSupported: boolean
  serviceWorkerActive: boolean
  pageCount: number
  pagesByRiwaya: Record<RiwayaId, number>
  cachedAudioCount: number
  indexedAudioCount: number | null
  usedBytes: number | null
  quotaBytes: number | null
  checkedAt: number
}

const RIWAYAT: { id: RiwayaId; name: string }[] = [
  { id: 'hafs', name: 'حفص عن عاصم' },
  { id: 'warsh', name: 'ورش عن نافع' },
  { id: 'qalun', name: 'قالون عن نافع' },
  { id: 'douri', name: 'الدوري عن أبي عمرو' },
  { id: 'shubah', name: 'شعبة عن عاصم' },
  { id: 'sousi', name: 'السوسي عن أبي عمرو' },
  { id: 'bazzi', name: 'البزي عن ابن كثير' },
]

function buildAssetIndex(): Record<RiwayaId, PageAssets> {
  const index = {} as Record<RiwayaId, PageAssets>

  RIWAYAT.forEach(({ id }) => {
    index[id] = {
      text: new Set<number>(),
      svg: new Set<number>(),
      image: new Set<number>(),
    }
  })

  return index
}

function getPageAsset(
  urlString: string,
): {
  riwaya: RiwayaId
  page: number
  kind: AssetKind
} | null {
  try {
    const url = new URL(
      urlString,
      window.location.origin,
    )

    if (url.origin !== window.location.origin) {
      return null
    }

    let kind: AssetKind

    if (url.pathname === '/api/quran') {
      kind = 'text'
    } else if (url.pathname === '/api/mushaf-svg') {
      kind = 'svg'
    } else if (
      url.pathname === '/api/mushaf-riwaya-image'
    ) {
      kind = 'image'
    } else {
      return null
    }

    const riwayaString =
      url.searchParams.get('riwaya')

    const riwaya = RIWAYAT.find(
      (item) => item.id === riwayaString,
    )

    const pageString =
      url.searchParams.get('page')

    if (!riwaya || !pageString) {
      return null
    }

    const page = Number(pageString)

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > PAGE_TOTAL
    ) {
      return null
    }

    return {
      riwaya: riwaya.id,
      page,
      kind,
    }
  } catch {
    return null
  }
}

// Array.from يحوّل readonly Request[] إلى مصفوفة عادية.
// متوافق مع إعداد target: es5 في المشروع.
async function readCacheKeys(
  name: string,
  existingNames: string[],
): Promise<Request[]> {
  if (existingNames.indexOf(name) === -1) {
    return []
  }

  try {
    const cache = await caches.open(name)
    return Array.from(await cache.keys())
  } catch {
    return []
  }
}

// قراءة عدد الملفات من IndexedDB دون إنشاء قاعدة جديدة
// أو تعديل قاعدة البيانات الموجودة.
async function countIndexedAudio(): Promise<number | null> {
  if (typeof indexedDB === 'undefined') {
    return null
  }

  if (typeof indexedDB.databases === 'function') {
    try {
      const databases = await indexedDB.databases()

      if (
        !databases.some(
          (db) => db.name === DB_NAME,
        )
      ) {
        return 0
      }
    } catch {
      // نستخدم محاولة فتح آمنة عند عدم توفر القائمة.
    }
  }

  return new Promise<number | null>((resolve) => {
    let finished = false
    let database: IDBDatabase | null = null

    const timer = window.setTimeout(
      () => finish(null),
      7000,
    )

    function finish(value: number | null) {
      if (finished) return

      finished = true
      window.clearTimeout(timer)

      if (database) {
        database.close()
      }

      resolve(value)
    }

    try {
      const request = indexedDB.open(DB_NAME)

      request.onupgradeneeded = () => {
        // منع إنشاء قاعدة غير موجودة.
        request.transaction?.abort()
      }

      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)

      request.onsuccess = () => {
        database = request.result

        if (finished) {
          database.close()
          return
        }

        if (
          !database.objectStoreNames.contains(DB_STORE)
        ) {
          finish(0)
          return
        }

        try {
          const transaction = database.transaction(
            DB_STORE,
            'readonly',
          )

          const counter = transaction
            .objectStore(DB_STORE)
            .count()

          counter.onsuccess = () => {
            finish(counter.result)
          }

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

async function inspectStorage(): Promise<OfflineStats> {
  const index = buildAssetIndex()

  const pagesByRiwaya =
    {} as Record<RiwayaId, number>

  const cacheSupported =
    typeof caches !== 'undefined'

  const serviceWorkerActive = Boolean(
    navigator.serviceWorker?.controller,
  )

  let usedBytes: number | null = null
  let quotaBytes: number | null = null
  let cachedAudioCount = 0

  const indexedAudioPromise = countIndexedAudio()

  try {
    if (
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      const estimate =
        await navigator.storage.estimate()

      usedBytes =
        typeof estimate.usage === 'number'
          ? estimate.usage
          : null

      quotaBytes =
        typeof estimate.quota === 'number'
          ? estimate.quota
          : null
    }
  } catch {
    // بعض المتصفحات تمنع عرض تقديرات المساحة.
  }

  if (cacheSupported) {
    const existingNames = await caches.keys()

    const pageLists = await Promise.all(
      PAGE_CACHES.map((name) =>
        readCacheKeys(name, existingNames),
      ),
    )

    pageLists.forEach((requests) => {
      requests.forEach((request) => {
        const asset = getPageAsset(request.url)

        if (asset) {
          index[asset.riwaya][asset.kind].add(
            asset.page,
          )
        }
      })
    })

    const audioLists = await Promise.all(
      AUDIO_CACHES.map((name) =>
        readCacheKeys(name, existingNames),
      ),
    )

    const audioUrls = new Set<string>()

    audioLists.forEach((requests) => {
      requests.forEach((request) => {
        audioUrls.add(request.url)
      })
    })

    cachedAudioCount = audioUrls.size
  }

  let pageCount = 0

  RIWAYAT.forEach(({ id }) => {
    const entry = index[id]

    const requiresImage =
      id === 'sousi' || id === 'bazzi'

    let complete = 0

    // Set.forEach بدلاً من for...of للتوافق مع ES5.
    entry.text.forEach((page) => {
      if (
        entry.svg.has(page) &&
        (!requiresImage || entry.image.has(page))
      ) {
        complete += 1
      }
    })

    pagesByRiwaya[id] = complete
    pageCount += complete
  })

  return {
    cacheSupported,
    serviceWorkerActive,
    pageCount,
    pagesByRiwaya,
    cachedAudioCount,
    indexedAudioCount: await indexedAudioPromise,
    usedBytes,
    quotaBytes,
    checkedAt: Date.now(),
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString('ar-EG')
}

function formatBytes(value: number | null): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 'غير متاح'
  }

  if (value < 1024) {
    return `${formatNumber(value)} بايت`
  }

  const units = [
    'كيلوبايت',
    'ميجابايت',
    'جيجابايت',
    'تيرابايت',
  ]

  let amount = value
  let unit = -1

  do {
    amount /= 1024
    unit += 1
  } while (
    amount >= 1024 &&
    unit < units.length - 1
  )

  return `${amount.toLocaleString('ar-EG', {
    maximumFractionDigits: 1,
  })} ${units[unit]}`
}

export default function OfflinePage() {
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] =
    useState<OfflineStats | null>(null)

  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await inspectStorage()
      setStats(result)
    } catch {
      setError(
        'تعذر فحص بعض البيانات المحفوظة على هذا الجهاز. حاول مرة أخرى.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const updateConnection = () => {
      setOnline(navigator.onLine)
    }

    updateConnection()

    window.addEventListener(
      'online',
      updateConnection,
    )

    window.addEventListener(
      'offline',
      updateConnection,
    )

    void refresh()

    return () => {
      window.removeEventListener(
        'online',
        updateConnection,
      )

      window.removeEventListener(
        'offline',
        updateConnection,
      )
    }
  }, [refresh])

  const percentage =
    stats?.usedBytes != null &&
    stats.quotaBytes != null &&
    stats.quotaBytes > 0
      ? Math.min(
          100,
          (stats.usedBytes / stats.quotaBytes) * 100,
        )
      : 0

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f9fe] pb-28 text-slate-900"
    >
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">

        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#bc924e]">
              مصحف سميع · SAMEE3
            </p>

            <h1 className="mt-2 text-2xl font-extrabold">
              التنزيلات دون إنترنت
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              ملفات القرآن والتلاوات الموجودة على جهازك
            </p>
          </div>

          <Link
            href="/"
            aria-label="العودة للرئيسية"
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <ArrowLeft size={20} />
          </Link>
        </header>

        {/* Hero */}
        <section className="rounded-[28px] bg-gradient-to-br from-[#0c3b59] via-[#11516c] to-[#16374c] p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              {online ? (
                <Wifi size={15} />
              ) : (
                <WifiOff size={15} />
              )}

              {online
                ? 'متصل بالإنترنت'
                : 'بدون اتصال بالإنترنت'}
            </span>

            <BookOpen
              size={27}
              className="text-[#e3c58e]"
            />
          </div>

          <h2 className="mt-5 text-xl font-extrabold sm:text-2xl">
            مصحفك معك أينما كنت
          </h2>

          <p className="mt-2 max-w-lg text-sm leading-7 text-white/80">
            اعرف ما تم حفظه بالفعل من صفحات المصحف
            والتسجيلات الصوتية، دون تعديل أو حذف
            أي تنزيلات.
          </p>

          <p className="mt-4 flex items-center gap-2 text-xs text-white/75">
            <ShieldCheck
              size={16}
              className="shrink-0 text-[#e3c58e]"
            />

            {stats?.serviceWorkerActive
              ? 'خدمة التطبيق تعمل لهذه الصفحة'
              : 'قد تحتاج إلى فتح التطبيق مرة أثناء الاتصال لتفعيل العمل دون إنترنت'}
          </p>
        </section>

        {/* Refresh */}
        <div className="my-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-6 text-slate-500">
            الأرقام تخص هذا المتصفح والجهاز فقط.
          </p>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#0d5776] shadow-sm disabled:opacity-60"
          >
            {loading ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={17} />
            )}

            {loading
              ? 'جارٍ الفحص'
              : 'تحديث الفحص'}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        {/* Statistics */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
          <article className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-3 inline-flex rounded-xl bg-[#edf7f2] p-2.5 text-[#26795a]">
              <BookOpen size={21} />
            </div>

            <p className="text-3xl font-extrabold tabular-nums">
              {stats
                ? formatNumber(stats.pageCount)
                : '—'}
            </p>

            <h3 className="mt-1 text-sm font-bold">
              صفحة مصحف مكتملة
            </h3>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              حسب الملفات الموجودة في التخزين المحلي
            </p>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-3 inline-flex rounded-xl bg-[#fff6e7] p-2.5 text-[#b48a49]">
              <Headphones size={21} />
            </div>

            <p className="text-3xl font-extrabold tabular-nums">
              {stats
                ? formatNumber(
                    stats.cachedAudioCount,
                  )
                : '—'}
            </p>

            <h3 className="mt-1 text-sm font-bold">
              تسجيل بكاش الصوت
            </h3>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              قد تتكرر هذه الملفات مع المكتبة الصوتية
            </p>
          </article>
        </div>

        {/* Quran pages */}
        <section className="mb-5 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#eaf3fa] p-2.5 text-[#17678b]">
                <BookOpen size={20} />
              </div>

              <div>
                <h2 className="font-extrabold">
                  صفحات المصحف المحفوظة
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  الصفحات المكتملة من أصل ٦٠٤ لكل رواية
                </p>
              </div>
            </div>

            <Link
              href="/mushaf"
              className="text-sm font-bold text-[#17678b] hover:underline"
            >
              فتح المصحف
            </Link>
          </div>

          <div className="divide-y divide-slate-100 px-5 sm:px-6">
            {RIWAYAT.map(({ id, name }) => {
              const count =
                stats?.pagesByRiwaya[id] ?? 0

              const width = Math.max(
                0,
                Math.min(
                  100,
                  (count / PAGE_TOTAL) * 100,
                ),
              )

              return (
                <div
                  key={id}
                  className="py-4"
                >
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="font-bold text-slate-700">
                      {name}
                    </span>

                    <span className="shrink-0 font-extrabold tabular-nums text-[#11516c]">
                      {formatNumber(count)} / ٦٠٤
                    </span>
                  </div>

                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`صفحات ${name}`}
                    aria-valuemin={0}
                    aria-valuemax={PAGE_TOTAL}
                    aria-valuenow={count}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#bd9150] to-[#e5c48a]"
                      style={{
                        width: `${width}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="flex items-start gap-2 border-t border-slate-100 bg-[#fafbfc] px-5 py-4 text-xs leading-6 text-slate-500 sm:px-6">
            <Info
              size={16}
              className="mt-1 shrink-0"
            />

            تُحتسب الصفحة عند وجود بياناتها
            ورسمها، وكذلك صورتها في روايتي السوسي
            والبزي. هذا فحص لمفاتيح التخزين وليس
            اختبارًا لفتح كل صفحة.
          </p>
        </section>

        {/* IndexedDB audio */}
        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-[#fff6e7] p-2.5 text-[#b48a49]">
              <Database size={20} />
            </div>

            <div>
              <h2 className="font-extrabold">
                تسجيلات المكتبة الصوتية
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                نسخ محفوظة داخل قاعدة بيانات المتصفح
              </p>
            </div>
          </div>

          <p className="text-2xl font-extrabold tabular-nums text-[#11516c]">
            {stats?.indexedAudioCount == null
              ? 'غير متاح'
              : formatNumber(
                  stats.indexedAudioCount,
                )}
          </p>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            نعرضها منفصلة عن كاش الصوت حتى لا
            نجمع النسخة نفسها مرتين.
          </p>

          <Link
            href="/audio"
            className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#17678b] hover:underline"
          >
            <Headphones size={17} />
            فتح المكتبة الصوتية
          </Link>
        </section>

        {/* Storage */}
        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[#eaf3fa] p-2.5 text-[#17678b]">
              <HardDrive size={20} />
            </div>

            <div>
              <h2 className="font-extrabold">
                مساحة التخزين
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                تقدير الاستخدام الكلي لبيانات هذا الموقع
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-lg text-[#11516c]">
              {formatBytes(
                stats?.usedBytes ?? null,
              )}
            </strong>

            <span className="text-xs text-slate-500">
              الحصة المتاحة:{' '}
              {formatBytes(
                stats?.quotaBytes ?? null,
              )}
            </span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#c9a05e]"
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>
        </section>

        {/* Browser support */}
        {!loading &&
          stats &&
          !stats.cacheSupported && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              هذا المتصفح لا يدعم Cache Storage،
              لذلك تعذر فحص صفحات المصحف
              والتسجيلات المخزنة فيه.
            </div>
          )}

        {/* Safety information */}
        <div className="rounded-2xl border border-[#dbe6ef] bg-white p-5 text-sm leading-7 text-slate-600">
          <div className="mb-2 flex items-center gap-2 font-extrabold text-[#11516c]">
            <ShieldCheck size={18} />
            خصوصية وأمان التنزيلات
          </div>

          الصفحة تقرأ حالة التخزين فقط ولا
          تحذف أي ملفات أو تنزّل محتوى تلقائيًا.
          قبل السفر، احفظ الرواية والتلاوات المطلوبة
          ثم اختبر فتحها في وضع الطيران على جهازك.

          <p className="mt-2 text-xs text-slate-400">
            {stats
              ? `آخر فحص: ${new Date(
                  stats.checkedAt,
                ).toLocaleString('ar-EG')}`
              : 'لم يكتمل الفحص بعد'}
          </p>
        </div>
      </div>
    </main>
  )
}
