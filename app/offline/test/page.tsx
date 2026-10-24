'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
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
import {
  listOfflineTafsirs,
} from '@/lib/tafsir-offline'

/**
 * SAMEE3 — Offline Readiness Diagnostics
 *
 * Path: app/offline/test/page.tsx
 *
 * Read-only diagnostics.
 * No downloads, writes or deletions.
 */

const PAGE_TOTAL = 604

const PAGE_CACHES = [
  'samee3-mushaf-pages-v2',
  'samee3-v3-riwaya-images',
]

const AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
]

const SHELL_ROUTES = [
  '/',
  '/mushaf',
  '/offline',
  '/audio',
]

const AUDIO_DB_NAME = 'samee-audio-library'
const AUDIO_DB_STORE = 'audio'

const RIWAYAT = [
  {
    id: 'hafs',
    name: 'حفص عن عاصم',
    needsImage: false,
  },
  {
    id: 'warsh',
    name: 'ورش عن نافع',
    needsImage: false,
  },
  {
    id: 'qalun',
    name: 'قالون عن نافع',
    needsImage: false,
  },
  {
    id: 'douri',
    name: 'الدوري عن أبي عمرو',
    needsImage: false,
  },
  {
    id: 'shubah',
    name: 'شعبة عن عاصم',
    needsImage: false,
  },
  {
    id: 'sousi',
    name: 'السوسي عن أبي عمرو',
    needsImage: true,
  },
  {
    id: 'bazzi',
    name: 'البزي عن ابن كثير',
    needsImage: true,
  },
] as const

type RiwayaId =
  (typeof RIWAYAT)[number]['id']

type CheckStatus =
  | 'ok'
  | 'warning'
  | 'unknown'

type Check = {
  title: string
  status: CheckStatus
  detail: string
}

type PageIndex = Record<
  RiwayaId,
  Uint8Array
>

type PageSample = {
  riwaya: RiwayaId
  page: number
} | null

type Report = {
  checks: Check[]
  completed: Record<RiwayaId, number>
  audioCached: number
  audioIndexed: number | null
  tafsirBooks: number | null
  shellCached: number
  storageUsed: number | null
  storageQuota: number | null
  persistent: boolean | null
  scannedAt: number
}

function formatNumber(value: number): string {
  return value.toLocaleString('ar-EG')
}

function formatSize(
  value: number | null,
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 'غير متاح'
  }

  if (value < 1024) {
    return `${formatNumber(value)} بايت`
  }

  if (value < 1048576) {
    return `${(value / 1024).toFixed(1)} كيلوبايت`
  }

  if (value < 1073741824) {
    return `${(value / 1048576).toFixed(1)} ميجابايت`
  }

  return `${(value / 1073741824).toFixed(2)} جيجابايت`
}

function newIndex(): PageIndex {
  return {
    hafs: new Uint8Array(PAGE_TOTAL + 1),
    warsh: new Uint8Array(PAGE_TOTAL + 1),
    qalun: new Uint8Array(PAGE_TOTAL + 1),
    douri: new Uint8Array(PAGE_TOTAL + 1),
    shubah: new Uint8Array(PAGE_TOTAL + 1),
    sousi: new Uint8Array(PAGE_TOTAL + 1),
    bazzi: new Uint8Array(PAGE_TOTAL + 1),
  }
}

function isRiwaya(
  value: string | null,
): value is RiwayaId {
  return RIWAYAT.some(
    (item) => item.id === value,
  )
}

/**
 * Inspect the audio database without
 * modifying existing audio records.
 */
async function countIndexedAudio():
  Promise<number | null> {
  if (
    typeof indexedDB === 'undefined'
  ) {
    return null
  }

  if (
    typeof indexedDB.databases ===
    'function'
  ) {
    try {
      const databases =
        await indexedDB.databases()

      if (
        !databases.some(
          (item) =>
            item.name === AUDIO_DB_NAME,
        )
      ) {
        return 0
      }
    } catch {
      // Database enumeration may be unavailable.
    }
  }

  return new Promise<number | null>(
    (resolve) => {
      let finished = false
      let database: IDBDatabase | null = null

      const timer =
        window.setTimeout(
          () => done(null),
          6000,
        )

      function done(
        result: number | null,
      ) {
        if (finished) return

        finished = true

        window.clearTimeout(timer)
        database?.close()

        resolve(result)
      }

      try {
        const request =
          indexedDB.open(
            AUDIO_DB_NAME,
          )

        request.onupgradeneeded = () => {
          // Do not create an empty library
          // merely to perform diagnostics.
          request.transaction?.abort()
        }

        request.onerror = () =>
          done(null)

        request.onblocked = () =>
          done(null)

        request.onsuccess = () => {
          database = request.result

          if (finished) {
            database.close()
            return
          }

          if (
            !database.objectStoreNames.contains(
              AUDIO_DB_STORE,
            )
          ) {
            done(0)
            return
          }

          try {
            const tx =
              database.transaction(
                AUDIO_DB_STORE,
                'readonly',
              )

            const count =
              tx.objectStore(
                AUDIO_DB_STORE,
              ).count()

            count.onsuccess = () =>
              done(count.result)

            count.onerror = () =>
              done(null)

            tx.onabort = () =>
              done(null)
          } catch {
            done(null)
          }
        }
      } catch {
        done(null)
      }
    },
  )
}

/**
 * Verify real JSON and SVG data for
 * one sample page, without fetching.
 */
async function checkPageSample(
  sample: PageSample,
  presentCaches: string[],
): Promise<Check> {
  if (!sample) {
    return {
      title: 'فحص عينة من صفحات القرآن',
      status: 'warning',
      detail:
        'لم تتوفر عينة مناسبة لفحص النص ورسم الصفحة. عدادات التحميل وحدها لا تثبت سلامة المحتوى.',
    }
  }

  try {
    const cache = await caches.open(
      presentCaches[0],
    )

    const { riwaya, page } = sample

    const textUrl =
      `/api/quran?riwaya=${riwaya}&page=${page}`

    const svgUrl =
      `/api/mushaf-svg?riwaya=${riwaya}&page=${page}`

    const [
      textResponse,
      svgResponse,
    ] = await Promise.all([
      cache.match(textUrl),
      cache.match(svgUrl),
    ])

    if (
      !textResponse?.ok ||
      !svgResponse?.ok
    ) {
      return {
        title: 'فحص عينة من صفحات القرآن',
        status: 'warning',
        detail:
          `صفحة ${formatNumber(page)} من ${riwaya} موجودة في الفهرس، لكن بياناتها غير قابلة للقراءة من الكاش الرئيسي.`,
      }
    }

    const [
      textData,
      svgData,
    ] = await Promise.all([
      textResponse.clone().json(),
      svgResponse.clone().json(),
    ])

    const ayahs =
      Array.isArray(textData?.ayahs)
        ? textData.ayahs
        : Array.isArray(
            textData?.data?.ayahs,
          )
          ? textData.data.ayahs
          : []

    if (
      !ayahs.length ||
      svgData?.success !== true ||
      typeof svgData?.svg !== 'string' ||
      !svgData.svg.trim()
    ) {
      return {
        title: 'فحص عينة من صفحات القرآن',
        status: 'warning',
        detail:
          'العينة موجودة، لكن نص الآيات أو رسم الصفحة غير صالحين للعرض.',
      }
    }

    return {
      title: 'فحص عينة من صفحات القرآن',
      status: 'ok',
      detail:
        `تمت قراءة النص والرسم لصفحة ${formatNumber(page)} من رواية ${riwaya} من التخزين المحلي دون طلب الشبكة.`,
    }
  } catch {
    return {
      title: 'فحص عينة من صفحات القرآن',
      status: 'warning',
      detail:
        'تعذر قراءة بيانات الصفحة المختارة. قد تحتاج إلى إعادة تنزيلها.',
    }
  }
}

/**
 * Scan known offline storage.
 * Never fetch or mutate user content.
 */
async function scan(): Promise<Report> {
  const checks: Check[] = []
  const index = newIndex()

  const completed =
    {} as Record<RiwayaId, number>

  let audioCached = 0
  let shellCached = 0

  let sample: PageSample = null

  let used: number | null = null
  let quota: number | null = null
  let persistent: boolean | null = null

  const controlled =
    'serviceWorker' in navigator &&
    Boolean(
      navigator.serviceWorker.controller,
    )

  checks.push({
    title: 'تفعيل خدمة التطبيق',
    status:
      controlled
        ? 'ok'
        : 'warning',
    detail:
      controlled
        ? 'الصفحة تحت تحكم Service Worker.'
        : 'لم يتم تأكيد تفعيل Service Worker. افتح التطبيق أثناء الاتصال، ثم أعد تحميل الصفحة.',
  })

  const indexedPromise =
    countIndexedAudio()

  const tafsirPromise =
    listOfflineTafsirs()
      .then((books) => books.length)
      .catch(
        () => null as number | null,
      )

  try {
    const estimate =
      await navigator.storage
        ?.estimate?.()

    used =
      typeof estimate?.usage ===
      'number'
        ? estimate.usage
        : null

    quota =
      typeof estimate?.quota ===
      'number'
        ? estimate.quota
        : null

    persistent =
      typeof navigator.storage
        ?.persisted === 'function'
        ? await navigator.storage
            .persisted()
        : null
  } catch {
    // Storage estimate is optional.
  }

  if (
    typeof caches === 'undefined'
  ) {
    checks.push({
      title: 'تخزين الملفات',
      status: 'unknown',
      detail:
        'Cache Storage غير متاح في هذا المتصفح.',
    })
  } else {
    try {
      const names =
        await caches.keys()

      const pageNames =
        PAGE_CACHES.filter(
          (name) =>
            names.indexOf(name) !== -1,
        )

      const audioNames =
        AUDIO_CACHES.filter(
          (name) =>
            names.indexOf(name) !== -1,
        )

      const audioUrls =
        new Set<string>()

      const foundRoutes =
        new Set<string>()

      let staticFiles = 0

      for (const name of names) {
        const isPage =
          pageNames.indexOf(name) !== -1

        const isAudio =
          audioNames.indexOf(name) !== -1

        const isShell =
          /^samee3-sw-v\d+-(?:shell|navigation|assets)$/.test(
            name,
          )

        if (
          !isPage &&
          !isAudio &&
          !isShell
        ) {
          continue
        }

        try {
          const cache =
            await caches.open(name)

          const keys =
            await cache.keys()

          for (const request of keys) {
            let url: URL

            try {
              url = new URL(
                request.url,
              )
            } catch {
              continue
            }

            if (isPage) {
              if (
                url.origin !==
                location.origin
              ) {
                continue
              }

              const riwaya =
                url.searchParams.get(
                  'riwaya',
                )

              const page = Number(
                url.searchParams.get(
                  'page',
                ),
              )

              if (
                !isRiwaya(riwaya) ||
                !Number.isInteger(page) ||
                page < 1 ||
                page > PAGE_TOTAL
              ) {
                continue
              }

              if (
                url.pathname ===
                '/api/quran'
              ) {
                index[riwaya][page] |= 1
              }

              if (
                url.pathname ===
                '/api/mushaf-svg'
              ) {
                index[riwaya][page] |= 2
              }

              if (
                url.pathname ===
                '/api/mushaf-riwaya-image'
              ) {
                index[riwaya][page] |= 4
              }
            }

            if (isAudio) {
              audioUrls.add(
                request.url,
              )
            }

            if (
              isShell &&
              url.origin ===
                location.origin
            ) {
              if (
                SHELL_ROUTES.indexOf(
                  url.pathname,
                ) !== -1
              ) {
                foundRoutes.add(
                  url.pathname,
                )
              }

              if (
                url.pathname.startsWith(
                  '/_next/static/',
                )
              ) {
                staticFiles += 1
              }
            }
          }
        } catch {
          checks.push({
            title:
              `فحص مخزن ${name}`,
            status: 'warning',
            detail:
              'تعذر فحص هذا المخزن. لم تُغيّر بياناته.',
          })
        }
      }

      shellCached =
        foundRoutes.size

      audioCached =
        audioUrls.size

      for (const entry of RIWAYAT) {
        let ready = 0

        const required =
          entry.needsImage
            ? 7
            : 3

        for (
          let page = 1;
          page <= PAGE_TOTAL;
          page += 1
        ) {
          if (
            (
              index[entry.id][page] &
              required
            ) === required
          ) {
            ready += 1

            if (
              !sample &&
              !entry.needsImage &&
              pageNames[0] ===
                PAGE_CACHES[0]
            ) {
              sample = {
                riwaya: entry.id,
                page,
              }
            }
          }
        }

        completed[entry.id] =
          ready
      }

      const anyComplete =
        RIWAYAT.some(
          (item) =>
            completed[item.id] ===
            PAGE_TOTAL,
        )

      checks.push({
        title:
          'صفحات المصحف المحمّلة',
        status:
          anyComplete
            ? 'ok'
            : 'warning',
        detail:
          anyComplete
            ? 'توجد رواية واحدة على الأقل تظهر صفحاتها الـ604 بمواردها المطلوبة في الفهرس.'
            : 'لا توجد رواية مكتملة بحسب الفهرس. استكمل الصفحات الناقصة من مدير التنزيل داخل المصحف.',
      })

      checks.push(
        await checkPageSample(
          sample,
          pageNames,
        ),
      )

      checks.push({
        title:
          'تلاوات المصحف المحفوظة',
        status:
          audioCached > 0
            ? 'ok'
            : 'warning',
        detail:
          `${formatNumber(audioCached)} رابطًا صوتيًا في مخازن التلاوة المعروفة. وجود الملف لا يضمن سلامة تشغيله.`,
      })

      checks.push({
        title:
          'واجهة التطبيق المحفوظة',
        status:
          shellCached ===
            SHELL_ROUTES.length &&
          staticFiles > 0
            ? 'ok'
            : 'warning',
        detail:
          `تم العثور على ${formatNumber(shellCached)} من ${formatNumber(SHELL_ROUTES.length)} مسارات أساسية، و${formatNumber(staticFiles)} ملفًا ثابتًا. هذا لا يضمن وحده عمل تنقل Next.js دون إنترنت.`,
      })
    } catch {
      checks.push({
        title:
          'فحص كاش التطبيق',
        status: 'unknown',
        detail:
          'تعذر الوصول إلى بعض مخازن التطبيق.',
      })
    }
  }

  const [
    audioIndexed,
    tafsirBooks,
  ] = await Promise.all([
    indexedPromise,
    tafsirPromise,
  ])

  checks.push({
    title:
      'تسجيلات المكتبة الصوتية',
    status:
      audioIndexed === null
        ? 'unknown'
        : audioIndexed > 0
          ? 'ok'
          : 'warning',
    detail:
      audioIndexed === null
        ? 'تعذر فحص قاعدة التسجيلات الصوتية المحلية.'
        : `${formatNumber(audioIndexed)} تسجيل في IndexedDB، مستقل عن كاش تلاوات المصحف.`,
  })

  checks.push({
    title:
      'كتب التفسير دون إنترنت',
    status:
      tafsirBooks === null
        ? 'unknown'
        : tafsirBooks > 0
          ? 'ok'
          : 'warning',
    detail:
      tafsirBooks === null
        ? 'تعذر فحص بيانات التفاسير المحلية.'
        : `${formatNumber(tafsirBooks)} كتاب تفسير يظهر مكتمل السجلات وفق فحص التخزين المحلي.`,
  })

  const storageHealthy =
    used !== null &&
    quota !== null &&
    quota > 0

  checks.push({
    title:
      'مساحة التخزين',
    status:
      storageHealthy
        ? used! / quota! < 0.9
          ? 'ok'
          : 'warning'
        : 'unknown',
    detail:
      `${formatSize(used)} مستخدمة من ${formatSize(quota)} مقدّرة. ${
        persistent === true
          ? 'التخزين المستمر مسموح.'
          : persistent === false
            ? 'التخزين المستمر غير مضمون.'
            : 'سياسة الاحتفاظ بالملفات غير معروفة.'
      }`,
  })

  return {
    checks,
    completed,
    audioCached,
    audioIndexed,
    tafsirBooks,
    shellCached,
    storageUsed: used,
    storageQuota: quota,
    persistent,
    scannedAt: Date.now(),
  }
}

export default function OfflineTestPage() {
  const [online, setOnline] =
    useState(true)

  const [scanning, setScanning] =
    useState(true)

  const [report, setReport] =
    useState<Report | null>(null)

  const [error, setError] =
    useState('')

  const runScan =
    useCallback(async () => {
      setScanning(true)
      setError('')

      try {
        const next =
          await scan()

        setReport(next)
      } catch (cause) {
        console.error(
          'SAMEE3 offline diagnostics:',
          cause,
        )

        setError(
          'تعذر إكمال الفحص. لم يتم حذف أو تغيير أي بيانات.',
        )
      } finally {
        setScanning(false)
      }
    }, [])

  useEffect(() => {
    const update = () =>
      setOnline(
        navigator.onLine,
      )

    update()

    window.addEventListener(
      'online',
      update,
    )

    window.addEventListener(
      'offline',
      update,
    )

    void runScan()

    return () => {
      window.removeEventListener(
        'online',
        update,
      )

      window.removeEventListener(
        'offline',
        update,
      )
    }
  }, [runScan])

  const successes =
    report?.checks.filter(
      (item) =>
        item.status === 'ok',
    ).length || 0

  const completeRiwayat =
    report
      ? RIWAYAT.filter(
          (item) =>
            report.completed[
              item.id
            ] === PAGE_TOTAL,
        ).length
      : 0

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f9fe] px-4 pb-28 pt-6 text-[#15384a] sm:px-6"
    >
      <div className="mx-auto max-w-4xl space-y-5">

        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold text-[#b18a4a]">
              SAMEE3 · مصحف سميع
            </p>

            <h1 className="mt-1 text-2xl font-black">
              اختبار التشغيل دون إنترنت
            </h1>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              فحص للصفحات والتلاوات والتفاسير المحفوظة على هذا الجهاز، دون تعديل بياناتك.
            </p>
          </div>

          <Link
            href="/offline"
            aria-label="العودة للتنزيلات"
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <ArrowRight size={20} />
          </Link>
        </header>

        <section className="rounded-[28px] bg-gradient-to-br from-[#103d4c] to-[#17647b] p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold">
              {online ? (
                <Wifi size={16} />
              ) : (
                <WifiOff size={16} />
              )}

              {online
                ? 'الشبكة متاحة حسب الجهاز'
                : 'الجهاز يبلغ عن انقطاع الاتصال'}
            </span>

            <ClipboardCheck
              size={28}
              className="text-[#ead09f]"
            />
          </div>

          <p className="mt-5 text-sm text-white/75">
            مؤشرات الفحص الجيدة
          </p>

          <p className="mt-1 text-3xl font-extrabold">
            {report
              ? `${formatNumber(successes)} / ${formatNumber(report.checks.length)}`
              : '—'}
          </p>

          <p className="mt-3 text-xs leading-6 text-white/75">
            النتائج مؤشرات أولية، وليست ضمانًا لتشغيل التطبيق بالكامل دون اتصال.
          </p>
        </section>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            الفحص لا ينزّل أو يحذف أي ملف.
          </p>

          <button
            type="button"
            disabled={scanning}
            onClick={() =>
              void runScan()
            }
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#15566b] shadow-sm disabled:opacity-50"
          >
            {scanning ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={17} />
            )}

            {scanning
              ? 'جارٍ الفحص'
              : 'إعادة الفحص'}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              title: 'روايات مكتملة',
              value: completeRiwayat,
              icon: BookOpen,
            },
            {
              title: 'تلاوات بالكاش',
              value: report?.audioCached,
              icon: Headphones,
            },
            {
              title: 'كتب تفسير',
              value: report?.tafsirBooks,
              icon: Database,
            },
            {
              title: 'تسجيلات محلية',
              value: report?.audioIndexed,
              icon: HardDrive,
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <Icon
                  size={20}
                  className="text-[#b18a4a]"
                />

                <p className="mt-3 text-2xl font-extrabold">
                  {item.value === null ||
                  item.value === undefined
                    ? '—'
                    : formatNumber(
                        item.value,
                      )}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {item.title}
                </p>
              </div>
            )
          })}
        </div>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <BookOpen
              size={20}
              className="text-[#b18a4a]"
            />
            حالة الروايات السبع
          </h2>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            العدد يعتمد على وجود النص ورسم الصفحة، بالإضافة إلى الصورة الأصلية في السوسي والبزي.
          </p>

          <div className="mt-4 space-y-4">
            {RIWAYAT.map((riwaya) => {
              const count =
                report?.completed[
                  riwaya.id
                ] || 0

              return (
                <div key={riwaya.id}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold">
                      {riwaya.name}
                    </span>

                    <span className="text-xs text-slate-500">
                      {formatNumber(count)}
                      {' / '}
                      {formatNumber(
                        PAGE_TOTAL,
                      )}
                    </span>
                  </div>

                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`تخزين ${riwaya.name}`}
                    aria-valuemin={0}
                    aria-valuemax={
                      PAGE_TOTAL
                    }
                    aria-valuenow={count}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#c29b5d] to-[#15617a]"
                      style={{
                        width:
                          `${(count / PAGE_TOTAL) * 100}%`,
                      }}
                    />
                  </div>

                  {count === PAGE_TOTAL && (
                    <p className="mt-1 text-[11px] font-bold text-emerald-700">
                      جميع موارد الصفحات ظاهرة في فهرس التخزين
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5">
            <ShieldCheck
              size={21}
              className="text-[#b18a4a]"
            />

            <h2 className="text-lg font-extrabold">
              نتائج الفحص التفصيلية
            </h2>
          </div>

          {report ? (
            <div className="divide-y divide-slate-100 px-5">
              {report.checks.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 py-4"
                >
                  <div
                    className={`mt-1 rounded-xl p-2 ${
                      item.status === 'ok'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {item.status === 'ok' ? (
                      <CheckCircle2
                        size={19}
                      />
                    ) : (
                      <AlertTriangle
                        size={19}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs leading-6 text-slate-600">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">
              {scanning
                ? 'جارٍ فحص المخازن المحلية…'
                : 'لا توجد نتائج.'}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-[#e6d2ad] bg-[#fffbf4] p-5 text-sm leading-8 text-[#775b30]">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Info size={19} />
            الاختبار الحقيقي: وضع الطيران
          </h2>

          <p className="mt-2">
            افتح المصحف أثناء اتصال الإنترنت، وحمّل الرواية والتلاوة والتفسير المطلوبين. بعد اكتمال التحميل، فعّل وضع الطيران، وأغلق التطبيق ثم افتحه مجددًا، وانتقل بين صفحات متباعدة، وشغّل تلاوة محفوظة، وافتح تفسير آية. نجاح هذه العمليات هو الدليل العملي على توفر المحتوى المختبر دون إنترنت.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/mushaf"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#15566b] px-5 py-4 text-sm font-bold text-white"
          >
            <BookOpen size={18} />
            فتح المصحف
          </Link>

          <Link
            href="/offline/manage"
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold"
          >
            <Headphones size={18} />
            إدارة التلاوات
          </Link>

          <Link
            href="/offline"
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold sm:col-span-2"
          >
            <ArrowRight size={18} />
            لوحة التنزيلات
          </Link>
        </div>

        {report && (
          <p className="pb-3 text-center text-[11px] text-slate-400">
            آخر فحص:{' '}
            {new Date(
              report.scannedAt,
            ).toLocaleString('ar-EG')}
          </p>
        )}
      </div>
    </main>
  )
}
