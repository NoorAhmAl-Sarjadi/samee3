
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react'
import Link from 'next/link'
import {
  ArrowRight,
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
 * SAMEE3 — Safe offline audio manager
 * Path: app/offline/manage/page.tsx
 *
 * Manages known audio caches and the
 * existing local audio library only.
 *
 * Never deletes mushaf pages, tafsir books,
 * application caches, notes or Firebase data.
 */

const AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
  'samee3-quran-audio-v1',
] as const

const AUDIO_DB = 'samee-audio-library'
const AUDIO_STORE = 'audio'
const CATALOG_KEY = 'samee3_audio_saved_catalog_v1'
const PAGE_SIZE = 24

type AudioEntry = {
  id: string
  source: 'cache' | 'indexeddb'
  sourceName: string
  key: string
  title: string
  subtitle: string
  url: string
  size: number | null
  verified: boolean
}

type StorageReport = {
  supported: boolean
  items: AudioEntry[]
  cacheCount: number
  databaseCount: number
  totalUsed: number | null
  totalQuota: number | null
  warnings: string[]
}

type SavedCatalogItem = {
  title?: string
  subtitle?: string
  audioUrl?: string
}

function numberAr(value: number): string {
  return value.toLocaleString('ar-EG')
}

function sizeLabel(bytes: number | null): string {
  if (
    bytes === null ||
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return 'الحجم غير معروف'
  }

  if (bytes < 1024) {
    return `${numberAr(bytes)} بايت`
  }

  const units = [
    'كيلوبايت',
    'ميجابايت',
    'جيجابايت',
    'تيرابايت',
  ]

  let result = bytes
  let index = -1

  do {
    result /= 1024
    index += 1
  } while (
    result >= 1024 &&
    index < units.length - 1
  )

  return `${result.toLocaleString('ar-EG', {
    maximumFractionDigits: 1,
  })} ${units[index]}`
}

function cacheLabel(name: string): string {
  if (name === 'samee3-audio-v2') {
    return 'تلاوات المصحف'
  }

  return name === 'samee3-v2-audio'
    ? 'كاش صوت سابق'
    : 'كاش صوت قديم'
}

function catalogItems(): SavedCatalogItem[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(CATALOG_KEY) || '[]',
    )

    return Array.isArray(data)
      ? data.filter(
          (item): item is SavedCatalogItem =>
            item !== null &&
            typeof item === 'object' &&
            !Array.isArray(item),
        )
      : []
  } catch {
    return []
  }
}

function displayFromUrl(
  value: string,
  catalog: SavedCatalogItem[],
): {
  title: string
  subtitle: string
} {
  const found = catalog.find(
    (item) => item.audioUrl === value,
  )

  if (found?.title) {
    return {
      title: found.title,
      subtitle: found.subtitle || 'تلاوة محفوظة',
    }
  }

  try {
    const url = new URL(value)

    const file = decodeURIComponent(
      url.pathname.split('/').pop() || 'audio',
    )

    const match =
      /^(\d{3})\.(?:mp3|m4a|aac|ogg)$/i.exec(file)

    const dir =
      url.pathname
        .split('/')
        .filter(Boolean)
        .slice(-2, -1)[0] || ''

    return {
      title: match
        ? `سورة رقم ${numberAr(Number(match[1]))}`
        : file.slice(0, 100),

      subtitle: dir
        ? `${url.hostname} / ${dir}`
        : url.hostname,
    }
  } catch {
    return {
      title: 'تسجيل صوتي',
      subtitle: value,
    }
  }
}

/**
 * Read an existing audio database.
 * Do not create a new database only to inspect it.
 */
async function openExistingAudioDB():
  Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return null
  }

  if (
    typeof indexedDB.databases === 'function'
  ) {
    try {
      const existing =
        await indexedDB.databases()

      if (
        !existing.some(
          (item) => item.name === AUDIO_DB,
        )
      ) {
        return null
      }
    } catch {
      // Older browsers may not support
      // database enumeration.
    }
  }

  return new Promise((resolve, reject) => {
    const request =
      indexedDB.open(AUDIO_DB)

    let completed = false

    const timeout = window.setTimeout(
      () =>
        finish(
          null,
          new Error(
            'انتهت مهلة فتح مكتبة الصوت.',
          ),
        ),
      7000,
    )

    function finish(
      db: IDBDatabase | null,
      error?: Error,
    ) {
      if (completed) {
        db?.close()
        return
      }

      completed = true
      window.clearTimeout(timeout)

      if (error) {
        reject(error)
      } else {
        resolve(db)
      }
    }

    request.onupgradeneeded = () => {
      // Database does not exist.
      // Abort creation.
      request.transaction?.abort()
    }

    request.onsuccess = () => {
      const db = request.result

      if (
        !db.objectStoreNames.contains(
          AUDIO_STORE,
        )
      ) {
        db.close()
        finish(null)
      } else {
        db.onversionchange = () => db.close()
        finish(db)
      }
    }

    request.onerror = () => {
      if (
        request.error?.name === 'AbortError'
      ) {
        finish(null)
      } else {
        finish(
          null,
          new Error(
            'تعذر فتح مكتبة الصوت المحلية.',
          ),
        )
      }
    }

    request.onblocked = () => {
      finish(
        null,
        new Error(
          'أغلق تبويبات التطبيق الأخرى وأعد المحاولة.',
        ),
      )
    }
  })
}

async function listIndexedAudio(
  catalog: SavedCatalogItem[],
): Promise<AudioEntry[]> {
  const db = await openExistingAudioDB()

  if (!db) return []

  try {
    return await new Promise<AudioEntry[]>(
      (resolve, reject) => {
        const result: AudioEntry[] = []

        const tx = db.transaction(
          AUDIO_STORE,
          'readonly',
        )

        const cursorRequest = tx
          .objectStore(AUDIO_STORE)
          .openCursor()

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result

          if (!cursor) return

          const value = cursor.value as {
            key?: unknown
            title?: unknown
            subtitle?: unknown
            blob?: unknown
            item?: {
              audioUrl?: unknown
              title?: unknown
              subtitle?: unknown
            }
          }

          // Keep metadata only.
          // Do not store audio blobs in React state.
          const key =
            typeof value.key === 'string'
              ? value.key
              : String(cursor.primaryKey)

          const url =
            typeof value.item?.audioUrl ===
            'string'
              ? value.item.audioUrl
              : ''

          const known = catalog.find(
            (item) => item.audioUrl === url,
          )

          const size =
            value.blob instanceof Blob
              ? value.blob.size
              : 0

          result.push({
            id: `idb:${key}`,
            source: 'indexeddb',
            sourceName: AUDIO_DB,
            key,
            url,

            title:
              typeof value.title === 'string' &&
              value.title.trim()
                ? value.title
                : known?.title ||
                  'تسجيل من المكتبة الصوتية',

            subtitle:
              typeof value.subtitle === 'string' &&
              value.subtitle.trim()
                ? value.subtitle
                : known?.subtitle ||
                  'نسخة محفوظة داخل التطبيق',

            size: size || null,
            verified: size > 0,
          })

          cursor.continue()
        }

        tx.oncomplete = () => resolve(result)

        tx.onerror = () =>
          reject(
            tx.error ||
              new Error(
                'تعذر قراءة مكتبة الصوت.',
              ),
          )

        tx.onabort = () =>
          reject(
            tx.error ||
              new Error(
                'تعذر قراءة مكتبة الصوت.',
              ),
          )
      },
    )
  } finally {
    db.close()
  }
}

async function listCachedAudio(
  catalog: SavedCatalogItem[],
): Promise<AudioEntry[]> {
  if (typeof caches === 'undefined') {
    return []
  }

  const names = await caches.keys()
  const result: AudioEntry[] = []

  for (
    let i = 0;
    i < AUDIO_CACHES.length;
    i += 1
  ) {
    const name = AUDIO_CACHES[i]

    if (names.indexOf(name) === -1) {
      continue
    }

    const cache = await caches.open(name)
    const requests = await cache.keys()

    for (
      let at = 0;
      at < requests.length;
      at += 1
    ) {
      const request = requests[at]

      const info = displayFromUrl(
        request.url,
        catalog,
      )

      const response =
        await cache.match(request)

      const lengthText =
        response?.headers.get(
          'Content-Length',
        ) || ''

      const length = /^\d+$/.test(lengthText)
        ? Number(lengthText)
        : 0

      const complete = Boolean(
        response &&
          (
            response.type === 'opaque' ||
            (
              response.status === 200 &&
              !response.headers.has(
                'Content-Range',
              )
            )
          ),
      )

      result.push({
        id: `cache:${name}:${request.url}`,
        source: 'cache',
        sourceName: name,
        key: request.url,
        url: request.url,

        title: info.title,
        subtitle: info.subtitle,

        size:
          length > 0
            ? length
            : null,

        verified:
          complete &&
          response?.type !== 'opaque',
      })
    }
  }

  return result
}

async function readReport():
  Promise<StorageReport> {
  const warnings: string[] = []
  const catalog = catalogItems()

  let cacheItems: AudioEntry[] = []
  let indexedItems: AudioEntry[] = []

  let used: number | null = null
  let quota: number | null = null

  try {
    cacheItems =
      await listCachedAudio(catalog)
  } catch {
    warnings.push(
      'تعذر فحص بعض ملفات الصوت في Cache Storage.',
    )
  }

  try {
    indexedItems =
      await listIndexedAudio(catalog)
  } catch {
    warnings.push(
      'تعذر فحص بعض تسجيلات IndexedDB.',
    )
  }

  try {
    if (navigator.storage?.estimate) {
      const estimate =
        await navigator.storage.estimate()

      used =
        typeof estimate.usage === 'number'
          ? estimate.usage
          : null

      quota =
        typeof estimate.quota === 'number'
          ? estimate.quota
          : null
    }
  } catch {
    warnings.push(
      'مساحة التخزين غير متاحة حاليًا.',
    )
  }

  const items =
    cacheItems.concat(indexedItems)

  items.sort((a, b) =>
    a.title.localeCompare(b.title, 'ar'),
  )

  return {
    supported:
      typeof caches !== 'undefined' ||
      typeof indexedDB !== 'undefined',

    items,
    cacheCount: cacheItems.length,
    databaseCount: indexedItems.length,
    totalUsed: used,
    totalQuota: quota,
    warnings,
  }
}

/**
 * Delete only one selected audio record.
 * Never touch Quran pages, tafsir or notes.
 */
async function deleteAudioEntry(
  item: AudioEntry,
): Promise<void> {
  if (item.source === 'cache') {
    if (
      AUDIO_CACHES.indexOf(
        item.sourceName as
          typeof AUDIO_CACHES[number],
      ) === -1
    ) {
      throw new Error(
        'مخزن غير مسموح.',
      )
    }

    const names = await caches.keys()

    if (
      names.indexOf(item.sourceName) === -1
    ) {
      throw new Error(
        'المخزن غير موجود.',
      )
    }

    const cache =
      await caches.open(item.sourceName)

    const removed = await cache.delete(
      item.key,
      { ignoreVary: true },
    )

    if (!removed) {
      throw new Error(
        'الملف غير موجود بالفعل.',
      )
    }

    return
  }

  if (
    item.source !== 'indexeddb' ||
    item.sourceName !== AUDIO_DB
  ) {
    throw new Error(
      'مصدر غير مسموح.',
    )
  }

  const db = await openExistingAudioDB()

  if (!db) {
    throw new Error(
      'مكتبة الصوت غير موجودة.',
    )
  }

  try {
    await new Promise<void>(
      (resolve, reject) => {
        const tx = db.transaction(
          AUDIO_STORE,
          'readwrite',
        )

        const store =
          tx.objectStore(AUDIO_STORE)

        const check =
          store.getKey(item.key)

        let found = false

        check.onsuccess = () => {
          found =
            check.result !== undefined

          if (found) {
            store.delete(item.key)
          }
        }

        tx.oncomplete = () => {
          if (found) {
            resolve()
          } else {
            reject(
              new Error(
                'لم يعد التسجيل موجودًا.',
              ),
            )
          }
        }

        tx.onerror = () =>
          reject(
            tx.error ||
              new Error(
                'تعذر حذف التسجيل.',
              ),
          )

        tx.onabort = () =>
          reject(
            tx.error ||
              new Error(
                'تعذر حذف التسجيل.',
              ),
          )
      },
    )
  } finally {
    db.close()
  }
}

export default function OfflineManagePage() {
  const [online, setOnline] =
    useState(true)

  const [loading, setLoading] =
    useState(true)

  const [deleting, setDeleting] =
    useState(false)

  const [report, setReport] =
    useState<StorageReport | null>(null)

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<'all' | 'cache' | 'indexeddb'>(
      'all',
    )

  const [visible, setVisible] =
    useState(PAGE_SIZE)

  const [selected, setSelected] =
    useState<AudioEntry | null>(null)

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const scanId = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++scanId.current

    setLoading(true)

    try {
      const next = await readReport()

      if (current !== scanId.current) {
        return
      }

      setReport(next)
      setError('')
    } catch {
      if (current === scanId.current) {
        setError(
          'تعذر قراءة التنزيلات من هذا الجهاز.',
        )
      }
    } finally {
      if (current === scanId.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const connectionChanged = () =>
      setOnline(navigator.onLine)

    connectionChanged()

    window.addEventListener(
      'online',
      connectionChanged,
    )

    window.addEventListener(
      'offline',
      connectionChanged,
    )

    void refresh()

    return () => {
      scanId.current += 1

      window.removeEventListener(
        'online',
        connectionChanged,
      )

      window.removeEventListener(
        'offline',
        connectionChanged,
      )
    }
  }, [refresh])

  const shown = useMemo(() => {
    const term = search
      .trim()
      .toLocaleLowerCase()

    return (report?.items || []).filter(
      (item) =>
        (
          filter === 'all' ||
          item.source === filter
        ) &&
        (
          !term ||
          `${item.title} ${item.subtitle} ${item.url} ${item.key}`
            .toLocaleLowerCase()
            .includes(term)
        ),
    )
  }, [report, search, filter])

  const remove = async () => {
    if (
      !selected ||
      deleting
    ) {
      return
    }

    setDeleting(true)
    setNotice('')
    setError('')

    try {
      await deleteAudioEntry(selected)

      setSelected(null)

      setNotice(
        'تم حذف هذه النسخة الصوتية فقط. صفحات المصحف والتفاسير والملاحظات لم تتغير.',
      )

      await refresh()
    } catch {
      setSelected(null)

      setError(
        'تعذر حذف التسجيل أو تغيّر موقعه. افحص القائمة من جديد.',
      )

      await refresh()
    } finally {
      setDeleting(false)
    }
  }

  const percent =
    report?.totalUsed != null &&
    report.totalQuota != null &&
    report.totalQuota > 0
      ? Math.min(
          100,
          (
            report.totalUsed /
            report.totalQuota
          ) * 100,
        )
      : 0

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f9fe] px-4 pb-28 pt-6 text-[#163748] sm:px-6"
    >
      <div className="mx-auto max-w-4xl space-y-5">

        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-wide text-[#b28b52]">
              SAMEE3 · مصحف سميع
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              إدارة التلاوات المحفوظة
            </h1>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              إدارة آمنة للتسجيلات الصوتية
              الموجودة على جهازك.
            </p>
          </div>

          <Link
            href="/offline"
            aria-label="العودة إلى التنزيلات"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-[#15566b] shadow-sm"
          >
            <ArrowRight size={20} />
          </Link>
        </header>

        {/* Overview */}
        <section className="rounded-[28px] bg-gradient-to-br from-[#103d4c] to-[#16657b] p-6 text-white shadow-lg sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              {online ? (
                <Wifi size={16} />
              ) : (
                <WifiOff size={16} />
              )}

              {online
                ? 'متصل بالإنترنت'
                : 'دون اتصال'}
            </span>

            <ShieldCheck
              size={24}
              className="text-[#e6c48b]"
            />
          </div>

          <h2 className="mt-4 text-xl font-extrabold">
            تنزيلات صوتية بدون المساس بالمصحف
          </h2>

          <p className="mt-2 text-sm leading-7 text-white/80">
            يعرض الملفات المحفوظة داخل
            كاش التلاوات ومكتبة الصوت المحلية.
            الحذف يخص نسخة صوتية واحدة فقط،
            ولا يمس صفحات الروايات أو التفسير
            أو بيانات Firebase أو ملاحظاتك.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            النتائج من تخزين هذا المتصفح فقط،
            وليست تنزيلات كل أجهزتك.
          </p>

          <button
            type="button"
            disabled={loading || deleting}
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {loading ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={17} />
            )}

            تحديث الفحص
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800"
          >
            <CheckCircle2
              size={19}
              className="mt-1 shrink-0"
            />

            {notice}
          </p>
        )}

        {report?.warnings.map((warning) => (
          <p
            key={warning}
            className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900"
          >
            {warning}
          </p>
        ))}

        {report && !report.supported && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm">
            هذا المتصفح لا يدعم إدارة التخزين المحلي.
          </p>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <Headphones
              size={22}
              className="mb-3 text-[#b28b52]"
            />

            <p className="text-3xl font-black tabular-nums">
              {report
                ? numberAr(report.cacheCount)
                : '—'}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              نسخة في كاش التلاوات
            </p>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <Database
              size={22}
              className="mb-3 text-[#155f77]"
            />

            <p className="text-3xl font-black tabular-nums">
              {report
                ? numberAr(
                    report.databaseCount,
                  )
                : '—'}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              تسجيل في المكتبة الصوتية
            </p>
          </article>
        </div>

        {/* Storage */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <HardDrive
              size={21}
              className="text-[#155f77]"
            />

            <h2 className="font-extrabold">
              مساحة الجهاز المستخدمة للموقع
            </h2>
          </div>

          <p className="mt-3 text-sm font-bold">
            {sizeLabel(report?.totalUsed ?? null)}
            {' '}من{' '}
            {sizeLabel(report?.totalQuota ?? null)}
          </p>

          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="نسبة مساحة الموقع المستخدمة"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[#b28b52]"
              style={{
                width: `${percent}%`,
              }}
            />
          </div>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            ده تقدير لمساحة الموقع بالكامل؛
            يشمل المصحف والتفاسير وأجزاء أخرى،
            وليس الصوت فقط.
          </p>
        </section>

        {/* Audio list */}
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="space-y-3 border-b border-slate-100 p-5">
            <h2 className="text-lg font-extrabold">
              ملفات الصوت
            </h2>

            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) => {
                  setSearch(event.target.value)
                  setVisible(PAGE_SIZE)
                }}
                placeholder="ابحث باسم القارئ أو السورة أو التسجيل"
                aria-label="البحث في التلاوات"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-10 text-sm outline-none focus:border-[#b28b52]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'الكل'],
                ['cache', 'تلاوات المصحف'],
                ['indexeddb', 'المكتبة الصوتية'],
              ] as const).map(([id, title]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => {
                    setFilter(id)
                    setVisible(PAGE_SIZE)
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-bold ${
                    filter === id
                      ? 'bg-[#15566b] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              {numberAr(shown.length)} نسخة مطابقة.
              قد يظهر التسجيل مرتين إذا حُفظ
              في مخزنين.
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {loading
                ? 'جارٍ الفحص…'
                : 'لا توجد تسجيلات تطابق البحث.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 px-4 sm:px-5">
              {shown
                .slice(0, visible)
                .map((item) => (
                  <article
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">
                        {item.title}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {item.subtitle}
                      </p>

                      <p className="mt-1 text-[11px] text-[#937244]">
                        {item.source === 'cache'
                          ? cacheLabel(
                              item.sourceName,
                            )
                          : 'المكتبة الصوتية'}
                        {' · '}
                        {sizeLabel(item.size)}
                      </p>

                      {!item.verified && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          اكتمال هذا الملف غير مؤكد؛
                          يُفضّل اختباره دون نت.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={loading || deleting}
                      onClick={() => {
                        setSelected(item)
                        setNotice('')
                      }}
                      aria-label={`حذف ${item.title}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      حذف
                    </button>
                  </article>
                ))}
            </div>
          )}

          {shown.length > visible && (
            <div className="border-t border-slate-100 p-4 text-center">
              <button
                type="button"
                onClick={() =>
                  setVisible(
                    (count) => count + PAGE_SIZE,
                  )
                }
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold"
              >
                عرض المزيد (
                {numberAr(
                  shown.length - visible,
                )}
                )
              </button>
            </div>
          )}
        </section>

        {/* Safety note */}
        <p className="flex items-start gap-2 rounded-2xl border border-[#e7d5b4] bg-[#fffaf1] p-4 text-xs leading-7 text-[#856739]">
          <Info
            size={18}
            className="mt-1 shrink-0"
          />

          حذف تسجيل من كاش الصوت لا يحذف
          نسخة ثانية منه موجودة في IndexedDB
          أو في كاش قديم. ويمكنك إعادة تنزيله
          عند توفر الإنترنت.
        </p>

        <Link
          href="/offline"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#15566b]"
        >
          <ArrowRight size={18} />
          العودة إلى لوحة التنزيلات
        </Link>
      </div>

      {/* Delete confirmation */}
      {selected && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() =>
            !deleting && setSelected(null)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="audio-delete-heading"
            onClick={(
              event: MouseEvent<HTMLElement>,
            ) => event.stopPropagation()}
            className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="audio-delete-heading"
                className="text-lg font-extrabold"
              >
                تأكيد حذف التسجيل
              </h2>

              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setSelected(null)
                }
                aria-label="إغلاق"
                className="rounded-lg p-1 text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-3 break-words text-sm font-bold text-[#15566b]">
              {selected.title}
            </p>

            <p className="mt-2 text-sm leading-7 text-slate-600">
              سيُحذف هذا التسجيل من{' '}
              {selected.source === 'cache'
                ? cacheLabel(
                    selected.sourceName,
                  )
                : 'المكتبة الصوتية'}
              {' '}فقط على هذا الجهاز.
              لا يمكن التراجع عن الحذف
              دون إعادة تنزيله.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setSelected(null)
                }
                className="flex-1 rounded-xl bg-slate-100 p-3 text-sm font-bold disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  void remove()
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 p-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={17} />
                )}

                تأكيد الحذف
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}