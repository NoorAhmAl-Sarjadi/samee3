
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Headphones,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'

/**
 * SAMEE3 — فحص التنزيلات دون اتصال
 * Path: app/offline/test/page.tsx
 *
 * لا يجري أي fetch أو كتابة أو حذف للبيانات.
 * وجود ملف في الكاش لا يضمن تشغيل التطبيق كاملًا.
 */

const MUSHAF_CACHES = [
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
  '/audio',
  '/offline',
]

type Rating = 'ok' | 'warning' | 'unavailable'

type TestItem = {
  id: string
  title: string
  description: string
  result: Rating
  details: string
}

type CachedFile = {
  cacheName: string
  request: Request
}

type ScanResult = {
  checks: TestItem[]
  mushafFiles: number
  audioFiles: number
  cachedRoutes: number
  checkedAt: number
}

function countAr(count: number): string {
  return count.toLocaleString('ar-EG')
}

function makeCheck(
  id: string,
  title: string,
  description: string,
  result: Rating,
  details: string,
): TestItem {
  return {
    id,
    title,
    description,
    result,
    details,
  }
}

async function findFiles(
  names: string[],
  existing: string[],
): Promise<{
  total: number
  sample: CachedFile | null
  errors: number
}> {
  const groups = await Promise.all(
    names
      .filter(
        (name) => existing.indexOf(name) !== -1,
      )
      .map(async (name) => {
        try {
          const cache = await caches.open(name)

          const keys = Array.from(
            await cache.keys(),
          )

          return {
            name,
            keys,
            failed: false,
          }
        } catch {
          return {
            name,
            keys: [] as Request[],
            failed: true,
          }
        }
      }),
  )

  let total = 0
  let sample: CachedFile | null = null
  let errors = 0

  groups.forEach((group) => {
    if (group.failed) {
      errors += 1
    }

    total += group.keys.length

    if (!sample && group.keys.length > 0) {
      sample = {
        cacheName: group.name,
        request: group.keys[0],
      }
    }
  })

  return {
    total,
    sample,
    errors,
  }
}

/**
 * اختبار قراءة عينة صغيرة من مورد محفوظ.
 *
 * لا يستعمل fetch ولا يقوم بتنزيل الملفات.
 * بعض الاستجابات الخارجية opaque،
 * لذلك لا يستطيع المتصفح فحص محتواها.
 */

async function probeFile(
  file: CachedFile | null,
): Promise<{
  result: Rating
  message: string
}> {
  if (!file) {
    return {
      result: 'warning',
      message:
        'لا يوجد ملف محفوظ ضمن المخازن المعروفة لاختباره.',
    }
  }

  try {
    const cache = await caches.open(
      file.cacheName,
    )

    const response = await cache.match(
      file.request,
    )

    if (!response) {
      return {
        result: 'warning',
        message:
          'لم يعد الملف المحدد موجودًا داخل الكاش.',
      }
    }

    if (
      response.type === 'opaque' ||
      response.type === 'opaqueredirect'
    ) {
      return {
        result: 'warning',
        message:
          'الملف موجود، لكن المتصفح يمنع فحص محتواه لأنه استجابة خارجية محجوبة (opaque).',
      }
    }

    if (!response.ok) {
      return {
        result: 'warning',
        message:
          `الملف محفوظ، لكنه يحمل حالة HTTP ${response.status}.`,
      }
    }

    const stream = response.clone().body

    if (!stream) {
      return {
        result: 'warning',
        message:
          'الملف موجود، لكن المتصفح لا يتيح قراءة محتواه بهذه الطريقة.',
      }
    }

    const reader = stream.getReader()

    try {
      const part = await reader.read()

      if (
        part.done ||
        !part.value ||
        part.value.byteLength === 0
      ) {
        return {
          result: 'warning',
          message:
            'تم العثور على الملف، لكن عينة القراءة كانت فارغة.',
        }
      }

      return {
        result: 'ok',
        message:
          'تمت قراءة عينة من الملف المخزن محليًا بنجاح، دون استخدام الشبكة.',
      }
    } finally {
      // لا نقرأ بقية الملف لتقليل استهلاك الذاكرة.
      void reader.cancel().catch(
        () => undefined,
      )

      reader.releaseLock()
    }
  } catch {
    return {
      result: 'warning',
      message:
        'تعذر قراءة العينة من التخزين؛ جرّب إعادة الفحص لاحقًا.',
    }
  }
}

/**
 * الفحص الرئيسي لموارد مصحف سميع.
 */

async function scanOffline(): Promise<ScanResult> {
  const checks: TestItem[] = []

  const swSupported =
    'serviceWorker' in navigator

  const isControlled =
    swSupported &&
    Boolean(
      navigator.serviceWorker.controller,
    )

  const cacheSupported =
    'caches' in window

  checks.push(
    makeCheck(
      'service-worker',
      'خدمة العمل دون إنترنت',
      'هل تتحكم خدمة التطبيق في الصفحة الحالية؟',
      isControlled ? 'ok' : 'warning',
      isControlled
        ? 'الصفحة تحت تحكم Service Worker حاليًا.'
        : swSupported
          ? 'الخدمة لا تتحكم في هذه الصفحة حاليًا؛ افتح الموقع أثناء الاتصال وأعد تحميله.'
          : 'المتصفح لا يدعم Service Worker.',
    ),
  )

  if (!cacheSupported) {
    checks.push(
      makeCheck(
        'cache-support',
        'تخزين الملفات',
        'دعم Cache Storage في المتصفح',
        'unavailable',
        'المتصفح لا يدعم فحص الملفات المخزنة بواسطة Cache Storage.',
      ),
    )

    return {
      checks,
      mushafFiles: 0,
      audioFiles: 0,
      cachedRoutes: 0,
      checkedAt: Date.now(),
    }
  }

  let existing: string[]

  try {
    existing = await caches.keys()
  } catch {
    checks.push(
      makeCheck(
        'cache-access',
        'الوصول إلى التخزين',
        'قراءة أسماء المخازن المحلية',
        'unavailable',
        'رفض المتصفح الوصول إلى كاش التطبيق.',
      ),
    )

    return {
      checks,
      mushafFiles: 0,
      audioFiles: 0,
      cachedRoutes: 0,
      checkedAt: Date.now(),
    }
  }

  const [mushaf, audio] = await Promise.all([
    findFiles(MUSHAF_CACHES, existing),
    findFiles(AUDIO_CACHES, existing),
  ])

  checks.push(
    makeCheck(
      'mushaf',
      'ملفات المصحف',
      'فحص مخازن صفحات القرآن المعروفة',
      mushaf.total > 0 ? 'ok' : 'warning',
      `${countAr(mushaf.total)} مورد محفوظ${
        mushaf.errors
          ? ' — تعذر فحص بعض المخازن'
          : ''
      }. هذا عدد الموارد، وليس عدد الصفحات المكتملة.`,
    ),
  )

  checks.push(
    makeCheck(
      'audio',
      'التلاوات المحفوظة',
      'فحص مخازن الصوت المعروفة',
      audio.total > 0 ? 'ok' : 'warning',
      `${countAr(audio.total)} تسجيل أو طلب صوتي محفوظ${
        audio.errors
          ? ' — تعذر فحص بعض المخازن'
          : ''
      }. لا يشمل قاعدة IndexedDB.`,
    ),
  )

  const [
    mushafProbe,
    audioProbe,
  ] = await Promise.all([
    probeFile(mushaf.sample),
    probeFile(audio.sample),
  ])

  checks.push(
    makeCheck(
      'mushaf-read',
      'سلامة عينة المصحف',
      'تجربة قراءة أول مورد محفوظ دون طلب شبكة',
      mushafProbe.result,
      mushafProbe.message,
    ),
  )

  checks.push(
    makeCheck(
      'audio-read',
      'سلامة عينة صوتية',
      'تجربة قراءة جزء صغير من ملف صوت محفوظ',
      audioProbe.result,
      audioProbe.message,
    ),
  )

  let cachedRoutes = 0

  try {
    // فحص الكاش الحالي دون إنشاء مخازن جديدة.
    const all = await Promise.all(
      existing.map(async (name) => {
        try {
          const cache = await caches.open(name)

          return Array.from(
            await cache.keys(),
          )
        } catch {
          return [] as Request[]
        }
      }),
    )

    const routes = new Set<string>()

    all.forEach((keys) => {
      keys.forEach((request) => {
        try {
          const url = new URL(request.url)

          if (
            url.origin ===
              window.location.origin &&
            SHELL_ROUTES.indexOf(
              url.pathname,
            ) !== -1
          ) {
            routes.add(url.pathname)
          }
        } catch {
          // تجاهل الروابط غير الصالحة.
        }
      })
    })

    cachedRoutes = routes.size
  } catch {
    cachedRoutes = 0
  }

  checks.push(
    makeCheck(
      'routes',
      'روابط صفحات التطبيق',
      'عدد روابط الصفحات الرئيسية الموجودة كمفاتيح في الكاش',
      cachedRoutes > 0
        ? 'ok'
        : 'warning',
      `تم العثور على ${countAr(
        cachedRoutes,
      )} من أصل ${countAr(
        SHELL_ROUTES.length,
      )} روابط. وجود الرابط وحده لا يؤكد إمكانية تشغيل واجهة Next.js دون اتصال.`,
    ),
  )

  return {
    checks,
    mushafFiles: mushaf.total,
    audioFiles: audio.total,
    cachedRoutes,
    checkedAt: Date.now(),
  }
}

function resultLabel(
  result: Rating,
): string {
  if (result === 'ok') {
    return 'مؤشر جيد'
  }

  if (result === 'warning') {
    return 'يحتاج مراجعة'
  }

  return 'غير متاح'
}

export default function OfflineTestPage() {
  const [online, setOnline] =
    useState(true)

  const [scanning, setScanning] =
    useState(true)

  const [data, setData] =
    useState<ScanResult | null>(null)

  const [error, setError] =
    useState('')

  const runScan = useCallback(async () => {
    setScanning(true)
    setError('')

    try {
      setData(await scanOffline())
    } catch {
      setError(
        'تعذر إكمال الفحص. يمكنك إعادة المحاولة دون حذف أي بيانات.',
      )
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    const syncNetwork = () => {
      setOnline(navigator.onLine)
    }

    syncNetwork()

    window.addEventListener(
      'online',
      syncNetwork,
    )

    window.addEventListener(
      'offline',
      syncNetwork,
    )

    void runScan()

    return () => {
      window.removeEventListener(
        'online',
        syncNetwork,
      )

      window.removeEventListener(
        'offline',
        syncNetwork,
      )
    }
  }, [runScan])

  const passed = data
    ? data.checks.filter(
        (item) => item.result === 'ok',
      ).length
    : 0

  const total =
    data?.checks.length ?? 0

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f9fe] pb-28 text-slate-900"
    >
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">

        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#b58b4b]">
              مصحف سميع · SAMEE3
            </p>

            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              اختبار العمل دون إنترنت
            </h1>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              فحص غير مدمر للملفات المحفوظة على جهازك.
            </p>
          </div>

          <Link
            href="/offline"
            aria-label="العودة للتنزيلات"
            className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3 text-[#15566b] shadow-sm"
          >
            <ArrowRight size={21} />
          </Link>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0d3d53] via-[#16596d] to-[#103749] p-6 text-white shadow-xl sm:p-8">

          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              {online ? (
                <Wifi size={15} />
              ) : (
                <WifiOff size={15} />
              )}

              {online
                ? 'متصل بالإنترنت'
                : 'وضع عدم الاتصال'}
            </span>

            <ClipboardCheck
              size={29}
              className="text-[#e2c58d]"
            />
          </div>

          <h2 className="mt-5 text-xl font-extrabold">
            اطمئن إلى ما تم حفظه
          </h2>

          <p className="mt-2 text-sm leading-7 text-white/80">
            الفحص يقرأ المفاتيح وعينة صغيرة من
            الملفات المخزنة، من غير تنزيل أو حذف
            أي محتوى أو إرسال طلب للشبكة.
          </p>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 p-4">
            <div>
              <p className="text-xs text-white/75">
                المؤشرات الجيدة
              </p>

              <strong className="mt-1 block text-2xl tabular-nums">
                {data
                  ? `${countAr(passed)} / ${countAr(total)}`
                  : '—'}
              </strong>
            </div>

            <ShieldCheck
              size={30}
              className="text-[#e2c58d]"
            />
          </div>
        </section>

        {/* Refresh */}
        <div className="my-5 flex items-center justify-between gap-3">
          <p className="text-xs leading-6 text-slate-500">
            النتيجة تخص الجهاز والمتصفح الحاليين.
          </p>

          <button
            type="button"
            onClick={() => void runScan()}
            disabled={scanning}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-[#15566b] shadow-sm disabled:opacity-60"
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
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        {/* Statistics */}
        <div className="mb-5 grid grid-cols-2 gap-3">

          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-[#eaf6f0] p-2.5 text-[#227252]">
              <BookOpen size={21} />
            </div>

            <p className="text-2xl font-extrabold tabular-nums">
              {data
                ? countAr(data.mushafFiles)
                : '—'}
            </p>

            <p className="mt-1 text-sm font-bold">
              مورد مصحف محفوظ
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-[#fff6e8] p-2.5 text-[#b58b4b]">
              <Headphones size={21} />
            </div>

            <p className="text-2xl font-extrabold tabular-nums">
              {data
                ? countAr(data.audioFiles)
                : '—'}
            </p>

            <p className="mt-1 text-sm font-bold">
              مورد صوتي محفوظ
            </p>
          </div>
        </div>

        {/* Results */}
        <section className="mb-5 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">

          <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:px-6">

            <div className="rounded-xl bg-[#edf4f9] p-2.5 text-[#17688a]">
              <Database size={21} />
            </div>

            <div>
              <h2 className="font-extrabold">
                نتائج الاختبار
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                مؤشرات واقعية، وليست ضمانًا كاملًا
                للعمل دون شبكة
              </p>
            </div>
          </div>

          {data ? (
            <div className="divide-y divide-slate-100 px-5 sm:px-6">

              {data.checks.map((item) => (
                <article
                  key={item.id}
                  className="py-5"
                >
                  <div className="flex items-start gap-3">

                    <div
                      className={`mt-0.5 shrink-0 rounded-xl p-2 ${
                        item.result === 'ok'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.result === 'warning'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.result === 'ok' ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <AlertCircle size={18} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center justify-between gap-2">

                        <h3 className="text-sm font-extrabold">
                          {item.title}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            item.result === 'ok'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.result === 'warning'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {resultLabel(item.result)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.description}
                      </p>

                      <p className="mt-2 text-xs leading-6 text-slate-700">
                        {item.details}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-500">
              {scanning
                ? 'جارٍ فحص البيانات المحلية…'
                : 'لا توجد نتائج بعد.'}
            </p>
          )}
        </section>

        {/* Final test */}
        <section className="mb-5 rounded-3xl border border-[#e6d5b8] bg-[#fffbf4] p-5 text-sm leading-8 text-[#75592e]">

          <h2 className="flex items-center gap-2 font-extrabold">
            <Info size={18} />
            الاختبار النهائي قبل السفر
          </h2>

          <p className="mt-2">
            بعد تنزيل صفحات المصحف والتلاوات،
            فعّل وضع الطيران على الجهاز وافتح
            الصفحات المطلوبة وشغّل تسجيلًا محفوظًا.
            هذا هو الاختبار الفعلي، لأن قراءة ملف
            من الكاش لا تؤكد أن كل أجزاء التطبيق
            تعمل دون إنترنت.
          </p>
        </section>

        {/* Navigation */}
        <div className="grid gap-3 sm:grid-cols-2">

          <Link
            href="/offline/manage"
            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-sm font-extrabold text-[#15566b] shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Database size={18} />
              إدارة التنزيلات
            </span>

            <ArrowRight size={18} />
          </Link>

          <Link
            href="/mushaf"
            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-sm font-extrabold text-[#15566b] shadow-sm"
          >
            <span className="flex items-center gap-2">
              <BookOpen size={18} />
              فتح المصحف
            </span>

            <ArrowRight size={18} />
          </Link>
        </div>

        {/* Security */}
        <p className="mt-5 flex items-center gap-2 text-xs leading-6 text-slate-500">
          <ShieldCheck
            size={17}
            className="shrink-0 text-[#b58b4b]"
          />

          هذه الصفحة لا تنشئ ملفات ولا تغيّر أو
          تحذف أي تنزيلات.
        </p>

        {data && (
          <p className="mt-1 text-[11px] text-slate-400">
            آخر فحص:{' '}
            {new Date(
              data.checkedAt,
            ).toLocaleString('ar-EG')}
          </p>
        )}
      </div>
    </main>
  )
}
