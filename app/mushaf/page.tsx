'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Riwaya =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'
  | 'sousi'
  | 'bazzi'

type Ayah = {
  number: number
  key?: string
  text: string
  numberInSurah: number
  juz?: number
  page?: number
  audioNumber?: number
  surah?: {
    number: number
    name: string
    englishName?: string
  }
}

type PageData = {
  ayahs: Ayah[]
}

const PRINTED_RIWAYAT = new Set<Riwaya>([
  'hafs',
  'warsh',
  'qalun',
  'douri',
  'shubah',
])

const RIWAYA_NAMES: Record<Riwaya, string> = {
  hafs: 'حفص عن عاصم',
  warsh: 'ورش عن نافع',
  qalun: 'قالون عن نافع',
  douri: 'الدوري عن أبي عمرو',
  shubah: 'شعبة عن عاصم',
  sousi: 'السوسي عن أبي عمرو',
  bazzi: 'البزي عن ابن كثير',
}

function isRiwaya(value: string | null): value is Riwaya {
  return (
    value === 'hafs' ||
    value === 'warsh' ||
    value === 'qalun' ||
    value === 'douri' ||
    value === 'shubah' ||
    value === 'sousi' ||
    value === 'bazzi'
  )
}

function clampPage(page: number) {
  if (!Number.isFinite(page)) return 1
  return Math.min(604, Math.max(1, Math.floor(page)))
}

export default function MushafPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const pageFromUrl = Number(searchParams.get('page') || '1')
  const ayahFromUrl = searchParams.get('ayah') || ''
  const riwayaFromUrl = searchParams.get('riwaya')

  const pageNumber = clampPage(pageFromUrl)

  const riwaya: Riwaya = isRiwaya(riwayaFromUrl)
    ? riwayaFromUrl
    : 'hafs'

  const [svg, setSvg] = useState('')
  const [pageData, setPageData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const navigatingRef = useRef(false)

  /*
   * قراءة بيانات الصفحة من API المصحف
   * تستخدم خصوصًا للروايات التي لا يوجد لها SVG مطبوع.
   */
  const loadPageData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/quran?riwaya=${encodeURIComponent(
          riwaya
        )}&page=${pageNumber}`,
        {
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error('تعذر تحميل بيانات الصفحة')
      }

      const data = await response.json()

      setPageData({
        ayahs: Array.isArray(data?.ayahs)
          ? data.ayahs
          : Array.isArray(data?.data?.ayahs)
            ? data.data.ayahs
            : [],
      })
    } catch (err) {
      console.error(err)
      setPageData({ ayahs: [] })
    }
  }, [pageNumber, riwaya])

  /*
   * تحميل SVG الأصلي للروايات المطبوعة.
   *
   * Hafs / Warsh / Qalun / Douri / Shubah
   * يتم عرضها كما تأتي من مصدر SVG
   * بدون إعادة رسم الآيات كنص.
   */
  const loadSvg = useCallback(async () => {
    if (!PRINTED_RIWAYAT.has(riwaya)) {
      setSvg('')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/mushaf-svg?riwaya=${encodeURIComponent(
          riwaya
        )}&page=${pageNumber}`,
        {
          cache: 'force-cache',
        }
      )

      if (!response.ok) {
        throw new Error('تعذر تحميل صفحة المصحف')
      }

      const data = await response.json()

      if (!data?.success || !data?.svg) {
        throw new Error('لم يتم العثور على SVG للصفحة')
      }

      setSvg(data.svg)
    } catch (err) {
      console.error(err)
      setSvg('')
      setError('تعذر تحميل صفحة المصحف')
    } finally {
      setLoading(false)
    }
  }, [pageNumber, riwaya])

  useEffect(() => {
    loadPageData()
  }, [loadPageData])

  useEffect(() => {
    loadSvg()
  }, [loadSvg])

  /*
   * عند وجود ?ayah=2:255 مثلًا
   * نحاول تحديد الآية داخل بيانات الصفحة.
   */
  useEffect(() => {
    if (!ayahFromUrl || !pageData?.ayahs?.length) {
      setSelectedAyah(null)
      return
    }

    const parts = ayahFromUrl.split(':')

    if (parts.length !== 2) return

    const surahNumber = Number(parts[0])
    const ayahNumber = Number(parts[1])

    if (!Number.isFinite(surahNumber) || !Number.isFinite(ayahNumber)) {
      return
    }

    const found = pageData.ayahs.find(
      (ayah) =>
        ayah.surah?.number === surahNumber &&
        ayah.numberInSurah === ayahNumber
    )

    if (found) {
      setSelectedAyah(found.number)
    }
  }, [ayahFromUrl, pageData])

  /*
   * الانتقال بين صفحات المصحف.
   */
  const goToPage = useCallback(
    (page: number) => {
      const nextPage = clampPage(page)

      if (nextPage === pageNumber) return

      if (navigatingRef.current) return

      navigatingRef.current = true

      const params = new URLSearchParams(searchParams.toString())

      params.set('page', String(nextPage))

      router.push(`/mushaf?${params.toString()}`)

      window.setTimeout(() => {
        navigatingRef.current = false
      }, 250)
    },
    [pageNumber, router, searchParams]
  )

  /*
   * الضغط على الآية في SVG.
   *
   * مصدر SVG يحتوي على عناصر ayahPolygon.
   * نحاول أخذ رقم الآية من البيانات الموجودة
   * في العنصر نفسه.
   */
  const handleSvgClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement | null

      if (!target) return

      const polygon =
        target.closest('.ayahPolygon') ||
        target.closest('[data-ayah]') ||
        target.closest('[data-ayah-number]')

      if (!polygon) return

      const element = polygon as HTMLElement

      const possibleValues = [
        element.dataset.ayah,
        element.dataset.ayahNumber,
        element.getAttribute('data-ayah'),
        element.getAttribute('data-ayah-number'),
        element.getAttribute('id'),
      ]

      let ayahNumber: number | null = null

      for (const value of possibleValues) {
        if (!value) continue

        const match = value.match(/\d+/)

        if (match) {
          const number = Number(match[0])

          if (Number.isFinite(number)) {
            ayahNumber = number
            break
          }
        }
      }

      if (ayahNumber !== null) {
        setSelectedAyah(ayahNumber)

        const selectedElement =
          document.querySelectorAll('.ayahPolygon')

        selectedElement.forEach((item) => {
          item.classList.remove('samee3-selected-ayah')
        })

        element.classList.add('samee3-selected-ayah')
      }
    },
    []
  )

  /*
   * ربط الضغط على SVG.
   */
  useEffect(() => {
    if (!svg) return

    const container = document.getElementById('mushaf-svg-container')

    if (!container) return

    container.addEventListener('click', handleSvgClick)

    return () => {
      container.removeEventListener('click', handleSvgClick)
    }
  }, [svg, handleSvgClick])

  /*
   * السحب يمين / يسار للتنقل بين الصفحات.
   *
   * سحب من اليمين لليسار = الصفحة التالية
   * سحب من اليسار لليمين = الصفحة السابقة
   */
  const handleTouchStart = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    if (!event.touches.length) return

    touchStartX.current = event.touches[0].clientX
    touchStartY.current = event.touches[0].clientY
  }

  const handleTouchEnd = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null
    ) {
      return
    }

    if (!event.changedTouches.length) return

    const endX = event.changedTouches[0].clientX
    const endY = event.changedTouches[0].clientY

    const deltaX = endX - touchStartX.current
    const deltaY = endY - touchStartY.current

    touchStartX.current = null
    touchStartY.current = null

    /*
     * إذا كانت الحركة عمودية أكثر من أفقية
     * نتركها للتمرير الطبيعي.
     */
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    /*
     * الحد الأدنى للسحب.
     */
    if (Math.abs(deltaX) < 45) {
      return
    }

    if (deltaX < 0) {
      goToPage(pageNumber + 1)
    } else {
      goToPage(pageNumber - 1)
    }
  }

  /*
   * لوحة المفاتيح للكمبيوتر.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPage(pageNumber + 1)
      }

      if (event.key === 'ArrowRight') {
        goToPage(pageNumber - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goToPage, pageNumber])

  /*
   * بناء نسخة نصية بسيطة للروايات التي لا تملك SVG مطبوعًا
   * حاليًا: السوسي والبزي.
   */
  const textFallbackSvg = (() => {
    if (PRINTED_RIWAYAT.has(riwaya)) {
      return ''
    }

    if (!pageData?.ayahs?.length) {
      return ''
    }

    const lines = pageData.ayahs
      .map((ayah) => {
        const selected =
          selectedAyah !== null &&
          ayah.number === selectedAyah

        const safeText = String(ayah.text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')

        return `
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            class="samee3-text-ayah ${
              selected ? 'samee3-text-selected' : ''
            }"
            data-ayah="${ayah.number}"
          >
            ${safeText}
            <span class="samee3-ayah-number">
              ۝ ${ayah.numberInSurah}
            </span>
          </div>
        `
      })
      .join('')

    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1400"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
      >
        <foreignObject
          x="70"
          y="70"
          width="860"
          height="1260"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            class="samee3-text-page"
          >
            ${lines}
          </div>
        </foreignObject>
      </svg>
    `
  })()

  const displayedSvg = PRINTED_RIWAYAT.has(riwaya)
    ? svg
    : textFallbackSvg

  return (
    <main
      dir="rtl"
      className="fixed inset-0 z-[40] overflow-hidden bg-[#f4f1e8]"
    >
      <div
        className="relative h-[100dvh] w-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* المصحف */}
        <section className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {loading && PRINTED_RIWAYAT.has(riwaya) ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f4f1e8]">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />

                <span className="text-sm text-slate-500">
                  جاري تحميل الصفحة...
                </span>
              </div>
            </div>
          ) : null}

          {error && PRINTED_RIWAYAT.has(riwaya) ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f4f1e8] px-6">
              <div className="rounded-2xl bg-white p-6 text-center shadow-lg">
                <p className="mb-4 text-sm text-red-600">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    loadSvg()
                  }}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-bold text-white"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          ) : null}

          {displayedSvg ? (
            <div
              id="mushaf-svg-container"
              className="samee3-mushaf-container h-full w-full select-none"
              dangerouslySetInnerHTML={{
                __html: displayedSvg,
              }}
            />
          ) : (
            !loading && (
              <div className="flex items-center justify-center px-6 text-center text-slate-500">
                لا توجد بيانات لهذه الصفحة.
              </div>
            )
          )}
        </section>

        {/* زر القائمة الصغير */}
        <button
          type="button"
          aria-label="إظهار القائمة"
          onClick={() => setShowMenu((value) => !value)}
          className={[
            'absolute bottom-[max(18px,env(safe-area-inset-bottom))]',
            'left-1/2 z-50 -translate-x-1/2',
            'flex h-10 w-10 items-center justify-center',
            'rounded-full border border-slate-200/80',
            'bg-white/90 shadow-lg backdrop-blur-md',
            'transition-all duration-200',
          ].join(' ')}
        >
          <span
            className={[
              'text-lg leading-none text-slate-700 transition-transform',
              showMenu ? 'rotate-180' : '',
            ].join(' ')}
          >
            ↑
          </span>
        </button>

        {/* لوحة المعلومات */}
        {showMenu ? (
          <div
            className={[
              'absolute bottom-[max(68px,calc(env(safe-area-inset-bottom)+55px))]',
              'left-1/2 z-50 w-[min(92vw,430px)]',
              '-translate-x-1/2',
              'rounded-2xl border border-slate-200/80',
              'bg-white/95 p-3 shadow-2xl backdrop-blur-xl',
            ].join(' ')}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">
                  صفحة المصحف
                </div>

                <div className="text-base font-bold text-slate-800">
                  {pageNumber} / 604
                </div>
              </div>

              <div className="text-left">
                <div className="text-xs text-slate-400">
                  الرواية
                </div>

                <div className="text-sm font-bold text-slate-800">
                  {RIWAYA_NAMES[riwaya]}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => goToPage(pageNumber - 1)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                الصفحة السابقة
              </button>

              <button
                type="button"
                onClick={() => setShowMenu(false)}
                className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white"
              >
                إخفاء
              </button>

              <button
                type="button"
                disabled={pageNumber >= 604}
                onClick={() => goToPage(pageNumber + 1)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                الصفحة التالية
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        #mushaf-svg-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          touch-action: pan-y;
        }

        #mushaf-svg-container > svg {
          display: block;
          width: 100% !important;
          height: 100% !important;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }

        /*
         * الحفاظ على رسم المصحف الأصلي.
         * لا نعيد رسم النص الموجود داخل SVG.
         */
        #mushaf-svg-container svg {
          user-select: none;
          -webkit-user-select: none;
        }

        /*
         * تمييز الآية عند الضغط عليها.
         */
        #mushaf-svg-container
          .ayahPolygon.samee3-selected-ayah {
          opacity: 0.72;
          filter: brightness(0.96);
        }

        /*
         * الروايات التي لا يوجد لها SVG مطبوع.
         */
        .samee3-text-page {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          overflow: hidden;
          padding: 30px 20px;
          direction: rtl;
          background: #fcfbf8;
          color: #1e293b;
          font-family:
            'Amiri Quran',
            'Amiri',
            serif;
          font-size: clamp(22px, 3.2vw, 34px);
          line-height: 2.25;
          text-align: justify;
          border: 1px solid rgba(120, 113, 108, 0.18);
        }

        .samee3-text-ayah {
          display: inline;
          cursor: pointer;
          transition:
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        .samee3-text-selected {
          background: rgba(14, 165, 233, 0.14);
          border-radius: 8px;
        }

        .samee3-ayah-number {
          display: inline-block;
          margin: 0 5px;
          font-family: 'Amiri', serif;
          font-size: 0.75em;
          color: #64748b;
        }

        @media (min-width: 768px) {
          #mushaf-svg-container > svg {
            width: auto !important;
            height: 100% !important;
            max-width: 100%;
          }
        }

        @media (max-width: 767px) {
          #mushaf-svg-container > svg {
            width: 100% !important;
            height: 100% !important;
          }
        }

        @supports (height: 100dvh) {
          #mushaf-svg-container {
            height: 100dvh;
          }
        }
      `}</style>
    </main>
  )
}