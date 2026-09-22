'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  ChevronLeft,
  Search,
  Moon,
  Sun,
  X,
  Mic2,
} from 'lucide-react'

const surahsList = [
  { id: 1, name: 'الفاتحة', type: 'مكية', ayahs: 7, startPage: 1 },
  { id: 2, name: 'البقرة', type: 'مدنية', ayahs: 286, startPage: 2 },
  { id: 3, name: 'آل عمران', type: 'مدنية', ayahs: 200, startPage: 50 },
  { id: 4, name: 'النساء', type: 'مدنية', ayahs: 176, startPage: 77 },
  { id: 5, name: 'المائدة', type: 'مدنية', ayahs: 120, startPage: 106 },
  { id: 6, name: 'الأنعام', type: 'مكية', ayahs: 165, startPage: 128 },
  { id: 7, name: 'الأعراف', type: 'مكية', ayahs: 206, startPage: 151 },
  { id: 8, name: 'الأنفال', type: 'مدنية', ayahs: 75, startPage: 177 },
  { id: 9, name: 'التوبة', type: 'مدنية', ayahs: 129, startPage: 187 },
  { id: 10, name: 'يونس', type: 'مكية', ayahs: 109, startPage: 208 },
  { id: 11, name: 'هود', type: 'مكية', ayahs: 123, startPage: 221 },
  { id: 12, name: 'يوسف', type: 'مكية', ayahs: 111, startPage: 235 },
  { id: 13, name: 'الرعد', type: 'مدنية', ayahs: 43, startPage: 249 },
  { id: 14, name: 'إبراهيم', type: 'مكية', ayahs: 52, startPage: 255 },
  { id: 15, name: 'الحجر', type: 'مكية', ayahs: 99, startPage: 262 },
  { id: 16, name: 'النحل', type: 'مكية', ayahs: 128, startPage: 267 },
  { id: 17, name: 'الإسراء', type: 'مكية', ayahs: 111, startPage: 282 },
  { id: 18, name: 'الكهف', type: 'مكية', ayahs: 110, startPage: 293 },
  { id: 19, name: 'مريم', type: 'مكية', ayahs: 98, startPage: 305 },
  { id: 20, name: 'طه', type: 'مكية', ayahs: 135, startPage: 312 },
  { id: 21, name: 'الأنبياء', type: 'مكية', ayahs: 112, startPage: 322 },
  { id: 22, name: 'الحج', type: 'مدنية', ayahs: 78, startPage: 332 },
  { id: 23, name: 'المؤمنون', type: 'مكية', ayahs: 118, startPage: 342 },
  { id: 24, name: 'النور', type: 'مدنية', ayahs: 64, startPage: 350 },
  { id: 25, name: 'الفرقان', type: 'مكية', ayahs: 77, startPage: 359 },
  { id: 26, name: 'الشعراء', type: 'مكية', ayahs: 227, startPage: 367 },
  { id: 27, name: 'النمل', type: 'مكية', ayahs: 93, startPage: 377 },
  { id: 28, name: 'القصص', type: 'مكية', ayahs: 88, startPage: 385 },
  { id: 29, name: 'العنكبوت', type: 'مكية', ayahs: 69, startPage: 396 },
  { id: 30, name: 'الروم', type: 'مكية', ayahs: 60, startPage: 404 },
  { id: 31, name: 'لقمان', type: 'مكية', ayahs: 34, startPage: 411 },
  { id: 32, name: 'السجدة', type: 'مكية', ayahs: 30, startPage: 415 },
  { id: 33, name: 'الأحزاب', type: 'مدنية', ayahs: 73, startPage: 418 },
  { id: 34, name: 'سبأ', type: 'مكية', ayahs: 54, startPage: 428 },
  { id: 35, name: 'فاطر', type: 'مكية', ayahs: 45, startPage: 434 },
  { id: 36, name: 'يس', type: 'مكية', ayahs: 83, startPage: 440 },
  { id: 37, name: 'الصافات', type: 'مكية', ayahs: 182, startPage: 446 },
  { id: 38, name: 'ص', type: 'مكية', ayahs: 88, startPage: 453 },
  { id: 39, name: 'الزمر', type: 'مكية', ayahs: 75, startPage: 458 },
  { id: 40, name: 'غافر', type: 'مكية', ayahs: 85, startPage: 467 },
  { id: 41, name: 'فصلت', type: 'مكية', ayahs: 54, startPage: 477 },
  { id: 42, name: 'الشورى', type: 'مكية', ayahs: 53, startPage: 483 },
  { id: 43, name: 'الزخرف', type: 'مكية', ayahs: 89, startPage: 489 },
  { id: 44, name: 'الدخان', type: 'مكية', ayahs: 59, startPage: 496 },
  { id: 45, name: 'الجاثية', type: 'مكية', ayahs: 37, startPage: 499 },
  { id: 46, name: 'الأحقاف', type: 'مكية', ayahs: 35, startPage: 502 },
  { id: 47, name: 'محمد', type: 'مدنية', ayahs: 38, startPage: 507 },
  { id: 48, name: 'الفتح', type: 'مدنية', ayahs: 29, startPage: 511 },
  { id: 49, name: 'الحجرات', type: 'مدنية', ayahs: 18, startPage: 515 },
  { id: 50, name: 'ق', type: 'مكية', ayahs: 45, startPage: 518 },
  { id: 51, name: 'الذاريات', type: 'مكية', ayahs: 60, startPage: 520 },
  { id: 52, name: 'الطور', type: 'مكية', ayahs: 49, startPage: 523 },
  { id: 53, name: 'النجم', type: 'مكية', ayahs: 62, startPage: 526 },
  { id: 54, name: 'القمر', type: 'مكية', ayahs: 55, startPage: 528 },
  { id: 55, name: 'الرحمن', type: 'مدنية', ayahs: 78, startPage: 531 },
  { id: 56, name: 'الواقعة', type: 'مكية', ayahs: 96, startPage: 534 },
  { id: 57, name: 'الحديد', type: 'مدنية', ayahs: 29, startPage: 537 },
  { id: 58, name: 'المجادلة', type: 'مدنية', ayahs: 22, startPage: 542 },
  { id: 59, name: 'الحشر', type: 'مدنية', ayahs: 24, startPage: 545 },
  { id: 60, name: 'الممتحنة', type: 'مدنية', ayahs: 13, startPage: 549 },
  { id: 61, name: 'الصف', type: 'مدنية', ayahs: 14, startPage: 551 },
  { id: 62, name: 'الجمعة', type: 'مدنية', ayahs: 11, startPage: 553 },
  { id: 63, name: 'المنافقون', type: 'مدنية', ayahs: 11, startPage: 554 },
  { id: 64, name: 'التغابن', type: 'مدنية', ayahs: 18, startPage: 556 },
  { id: 65, name: 'الطلاق', type: 'مدنية', ayahs: 12, startPage: 558 },
  { id: 66, name: 'التحريم', type: 'مدنية', ayahs: 12, startPage: 560 },
  { id: 67, name: 'الملك', type: 'مكية', ayahs: 30, startPage: 562 },
  { id: 68, name: 'القلم', type: 'مكية', ayahs: 52, startPage: 564 },
  { id: 69, name: 'الحاقة', type: 'مكية', ayahs: 52, startPage: 566 },
  { id: 70, name: 'المعارج', type: 'مكية', ayahs: 44, startPage: 568 },
  { id: 71, name: 'نوح', type: 'مكية', ayahs: 28, startPage: 570 },
  { id: 72, name: 'الجن', type: 'مكية', ayahs: 28, startPage: 572 },
  { id: 73, name: 'المزمل', type: 'مكية', ayahs: 20, startPage: 574 },
  { id: 74, name: 'المدثر', type: 'مكية', ayahs: 56, startPage: 575 },
  { id: 75, name: 'القيامة', type: 'مكية', ayahs: 40, startPage: 577 },
  { id: 76, name: 'الإنسان', type: 'مدنية', ayahs: 31, startPage: 578 },
  { id: 77, name: 'المرسلات', type: 'مكية', ayahs: 50, startPage: 580 },
  { id: 78, name: 'النبأ', type: 'مكية', ayahs: 40, startPage: 582 },
  { id: 79, name: 'النازعات', type: 'مكية', ayahs: 46, startPage: 583 },
  { id: 80, name: 'عبس', type: 'مكية', ayahs: 42, startPage: 585 },
  { id: 81, name: 'التكوير', type: 'مكية', ayahs: 29, startPage: 586 },
  { id: 82, name: 'الانفطار', type: 'مكية', ayahs: 19, startPage: 587 },
  { id: 83, name: 'المطففين', type: 'مكية', ayahs: 36, startPage: 587 },
  { id: 84, name: 'الانشقاق', type: 'مكية', ayahs: 25, startPage: 589 },
  { id: 85, name: 'البروج', type: 'مكية', ayahs: 22, startPage: 590 },
  { id: 86, name: 'الطارق', type: 'مكية', ayahs: 17, startPage: 591 },
  { id: 87, name: 'الأعلى', type: 'مكية', ayahs: 19, startPage: 591 },
  { id: 88, name: 'الغاشية', type: 'مكية', ayahs: 26, startPage: 592 },
  { id: 89, name: 'الفجر', type: 'مكية', ayahs: 30, startPage: 593 },
  { id: 90, name: 'البلد', type: 'مكية', ayahs: 20, startPage: 594 },
  { id: 91, name: 'الشمس', type: 'مكية', ayahs: 15, startPage: 595 },
  { id: 92, name: 'الليل', type: 'مكية', ayahs: 21, startPage: 595 },
  { id: 93, name: 'الضحى', type: 'مكية', ayahs: 11, startPage: 596 },
  { id: 94, name: 'الشرح', type: 'مكية', ayahs: 8, startPage: 596 },
  { id: 95, name: 'التين', type: 'مكية', ayahs: 8, startPage: 597 },
  { id: 96, name: 'العلق', type: 'مكية', ayahs: 19, startPage: 597 },
  { id: 97, name: 'القدر', type: 'مكية', ayahs: 5, startPage: 598 },
  { id: 98, name: 'البينة', type: 'مدنية', ayahs: 8, startPage: 598 },
  { id: 99, name: 'الزلزلة', type: 'مدنية', ayahs: 8, startPage: 599 },
  { id: 100, name: 'العاديات', type: 'مكية', ayahs: 11, startPage: 599 },
  { id: 101, name: 'القارعة', type: 'مكية', ayahs: 11, startPage: 600 },
  { id: 102, name: 'التكاثر', type: 'مكية', ayahs: 8, startPage: 600 },
  { id: 103, name: 'العصر', type: 'مكية', ayahs: 3, startPage: 601 },
  { id: 104, name: 'الهمزة', type: 'مكية', ayahs: 9, startPage: 601 },
  { id: 105, name: 'الفيل', type: 'مكية', ayahs: 5, startPage: 601 },
  { id: 106, name: 'قريش', type: 'مكية', ayahs: 4, startPage: 602 },
  { id: 107, name: 'الماعون', type: 'مكية', ayahs: 7, startPage: 602 },
  { id: 108, name: 'الكوثر', type: 'مكية', ayahs: 3, startPage: 602 },
  { id: 109, name: 'الكافرون', type: 'مكية', ayahs: 6, startPage: 603 },
  { id: 110, name: 'النصر', type: 'مدنية', ayahs: 3, startPage: 603 },
  { id: 111, name: 'المسد', type: 'مكية', ayahs: 5, startPage: 603 },
  { id: 112, name: 'الإخلاص', type: 'مكية', ayahs: 4, startPage: 604 },
  { id: 113, name: 'الفلق', type: 'مكية', ayahs: 5, startPage: 604 },
  { id: 114, name: 'الناس', type: 'مكية', ayahs: 6, startPage: 604 }
]

const RIWAYAT = [
  { id: 'hafs', label: 'حفص عن عاصم' },
  { id: 'warsh', label: 'ورش عن نافع' },
  { id: 'qalun', label: 'قالون عن نافع' },
  { id: 'douri', label: 'الدوري عن أبي عمرو' },
  { id: 'shubah', label: 'شعبة عن عاصم' },
  { id: 'sousi', label: 'السوسي عن أبي عمرو' },
  { id: 'bazzi', label: 'البزي عن ابن كثير' },
] as const

type FilterType = 'all' | 'مكية' | 'مدنية'

type Reciter = {
  id: string
  label: string
  englishName?: string
  style?: string
}

const DEFAULT_RECITER: Reciter = {
  id: 'ar.alafasy',
  label: 'مشاري راشد العفاسي',
}

const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
  202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
]

const JUZ_LIST = JUZ_START_PAGES.map((startPage, index) => ({
  id: index + 1,
  startPage,
}))

function toArabicNumber(value: number) {
  return value.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeArabic(value: string) {
  return value
    .trim()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
}
export default function QuranIndexPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  const [riwaya, setRiwaya] = useState<(typeof RIWAYAT)[number]['id']>('hafs')
  const [riwayaSearch, setRiwayaSearch] = useState('')
  const [riwayaOpen, setRiwayaOpen] = useState(false)

  const [reciter, setReciter] = useState<Reciter>(DEFAULT_RECITER)
  const [reciters, setReciters] = useState<Reciter[]>([DEFAULT_RECITER])
  const [reciterSearch, setReciterSearch] = useState('')
  const [reciterOpen, setReciterOpen] = useState(false)
  const [recitersLoading, setRecitersLoading] = useState(true)

  const [showSurahs, setShowSurahs] = useState(false)
  const [showJuz, setShowJuz] = useState(false)

  useEffect(() => {
    try {
      const savedRiwaya = localStorage.getItem('samee3_selected_riwaya_v2')
      const savedReciter = localStorage.getItem('samee3_selected_reciter_v2')

      if (savedRiwaya && RIWAYAT.some((item) => item.id === savedRiwaya)) {
        setRiwaya(savedRiwaya as (typeof RIWAYAT)[number]['id'])
      }

      if (savedReciter) {
        const parsed = JSON.parse(savedReciter)
        if (parsed?.id && parsed?.label) {
          setReciter(parsed)
        }
      }
    } catch {
      // تجاهل أي خطأ من التخزين المحلي.
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadReciters = async () => {
      setRecitersLoading(true)

      try {
        const response = await fetch(
          'https://api.alquran.cloud/v1/edition/format/audio',
          {
            signal: controller.signal,
            cache: 'force-cache',
          },
        )

        if (!response.ok) {
          throw new Error('تعذر تحميل قائمة القراء')
        }

        const payload = await response.json()
        const editions = Array.isArray(payload?.data) ? payload.data : []
        const seen = new Set<string>()
        const available: Reciter[] = []

        for (const edition of editions) {
          if (
            !edition ||
            edition.format !== 'audio' ||
            edition.language !== 'ar' ||
            !edition.identifier ||
            seen.has(edition.identifier)
          ) {
            continue
          }

          // نستخدم التسجيلات التي يمكن تشغيلها آية بآية.
          if (edition.type && edition.type !== 'versebyverse') {
            continue
          }

          seen.add(String(edition.identifier))
          available.push({
            id: String(edition.identifier),
            label: String(
              edition.name || edition.englishName || edition.identifier,
            ),
            englishName: edition.englishName,
            style: edition.type,
          })
        }

        available.sort((a, b) => {
          if (a.id === 'ar.alafasy') return -1
          if (b.id === 'ar.alafasy') return 1
          return a.label.localeCompare(b.label, 'ar')
        })

        if (available.length) {
          setReciters(available)
          setReciter((current) => {
            return available.find((item) => item.id === current.id) || available[0]
          })
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Reciters load error:', error)
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecitersLoading(false)
        }
      }
    }

    void loadReciters()

    return () => controller.abort()
  }, [])

  const saveRiwaya = (value: (typeof RIWAYAT)[number]['id']) => {
    setRiwaya(value)
    setRiwayaOpen(false)
    setRiwayaSearch('')

    try {
      localStorage.setItem('samee3_selected_riwaya_v2', value)
    } catch {
      // تجاهل فشل التخزين.
    }
  }

  const saveReciter = (value: Reciter) => {
    setReciter(value)
    setReciterOpen(false)
    setReciterSearch('')

    try {
      localStorage.setItem('samee3_selected_reciter_v2', JSON.stringify(value))
    } catch {
      // تجاهل فشل التخزين.
    }
  }

  const filteredRiwayat = useMemo(() => {
    const normalized = normalizeArabic(riwayaSearch)
    if (!normalized) return [...RIWAYAT]

    return RIWAYAT.filter((item) => normalizeArabic(item.label).includes(normalized))
  }, [riwayaSearch])

  const filteredReciters = useMemo(() => {
    const normalized = normalizeArabic(reciterSearch)
    if (!normalized) return reciters

    return reciters.filter((item) => {
      return (
        normalizeArabic(item.label).includes(normalized) ||
        normalizeArabic(item.englishName || '').includes(normalized)
      )
    })
  }, [reciterSearch, reciters])

  const filteredSurahs = useMemo(() => {
    const normalized = normalizeArabic(query)
      .replace(/^سوره\s*/, '')
      .replace(/^سورة\s*/, '')

    return surahsList.filter((surah) => {
      const matchesQuery =
        !normalized ||
        normalizeArabic(surah.name).includes(normalized) ||
        String(surah.id).includes(normalized) ||
        String(surah.startPage).includes(normalized)

      const matchesFilter = filter === 'all' || surah.type === filter
      return matchesQuery && matchesFilter
    })
  }, [query, filter])

  const selectedRiwaya = RIWAYAT.find((item) => item.id === riwaya) || RIWAYAT[0]
  const makkiyaCount = surahsList.filter((s) => s.type === 'مكية').length
  const madaniyaCount = surahsList.filter((s) => s.type === 'مدنية').length

  const mushafHref = `/mushaf?page=1&riwaya=${encodeURIComponent(riwaya)}&reciter=${encodeURIComponent(reciter.id)}`

  return (
    <main
      className="min-h-screen bg-[#F7F4EC] pb-32 text-mushaf-dark"
      dir="rtl"
    >
      {/* =====================================================
          رأس الفهرس
      ====================================================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#123F44] via-[#175E67] to-[#0E3539] text-white">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-mushaf-gold/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 pb-7 pt-6 sm:px-6 sm:pb-9">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-mushaf-gold/35 bg-white/10 shadow-xl shadow-black/10 backdrop-blur">
              <img
                src="https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png"
                alt="شعار مصحف سميع"
                className="h-12 w-12 object-contain"
              />
            </div>

            <p className="text-xs font-black tracking-[0.18em] text-mushaf-gold">
              مُصْحَف سَميع
            </p>

            <h1 className="mt-1 text-3xl font-black sm:text-4xl">
              فهرس السور
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              اختر الرواية أولًا، ثم القارئ، وبعدها افتح السور أو الأجزاء للانتقال مباشرة إلى صفحة المصحف الفعلية.
            </p>
          </div>

          {/* =================================================
              اختيار الرواية
          ================================================== */}
          <div className="mx-auto mt-7 max-w-4xl rounded-[28px] border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <div className="flex items-center gap-2 text-sm font-black">
                <BookOpen size={19} className="text-mushaf-gold" />
                <span>الرواية</span>
              </div>
              <span className="text-[10px] font-bold text-white/45">
                {toArabicNumber(RIWAYAT.length)} روايات
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setRiwayaOpen((open) => !open)
                setReciterOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-right text-sm font-black text-[#175E67] shadow-sm transition hover:shadow-md"
            >
              <span>{selectedRiwaya.label}</span>
              <span className="text-[#D97706]">⌄</span>
            </button>

            {riwayaOpen && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-white p-2 text-[#175E67] shadow-xl">
                <div className="relative">
                  <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={riwayaSearch}
                    onChange={(event) => setRiwayaSearch(event.target.value)}
                    placeholder="ابحث عن الرواية..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-11 pl-4 text-sm font-bold outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#0284C7]/10"
                  />
                </div>

                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {filteredRiwayat.map((item) => {
                    const active = item.id === riwaya
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => saveRiwaya(item.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-right text-sm font-bold transition ${active ? 'bg-[#0284C7]/10 text-[#0284C7]' : 'hover:bg-slate-50'}`}
                      >
                        <span>{item.label}</span>
                        {active && <span className="text-xs">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* =================================================
                اختيار القارئ
            ================================================== */}
            <div className="mt-4 flex items-center justify-between gap-3 px-1 pb-2">
              <div className="flex items-center gap-2 text-sm font-black">
                <Mic2 size={19} className="text-mushaf-gold" />
                <span>القارئ</span>
              </div>
              <span className="text-[10px] font-bold text-white/45">
                آية بآية
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setReciterOpen((open) => !open)
                setRiwayaOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-right text-sm font-black text-[#175E67] shadow-sm transition hover:shadow-md"
            >
              <span className="truncate">{reciter.label}</span>
              <span className="ml-2 shrink-0 text-[#D97706]">⌄</span>
            </button>

            {reciterOpen && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-white p-2 text-[#175E67] shadow-xl">
                <div className="relative">
                  <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={reciterSearch}
                    onChange={(event) => setReciterSearch(event.target.value)}
                    placeholder="ابحث عن القارئ..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-11 pl-4 text-sm font-bold outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-[#0284C7]/10"
                  />
                </div>

                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {recitersLoading && reciters.length <= 1 ? (
                    <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                      جاري تحميل القراء...
                    </div>
                  ) : filteredReciters.length ? (
                    filteredReciters.map((item) => {
                      const active = item.id === reciter.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => saveReciter(item)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-right text-sm font-bold transition ${active ? 'bg-[#0284C7]/10 text-[#0284C7]' : 'hover:bg-slate-50'}`}
                        >
                          <span className="truncate">{item.label}</span>
                          {active && <span className="text-xs">✓</span>}
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                      لا يوجد قارئ مطابق للبحث.
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link
              href={mushafHref}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-mushaf-gold px-5 py-3.5 text-sm font-black text-[#173F43] shadow-lg transition hover:-translate-y-0.5"
            >
              <BookOpen size={20} />
              فتح المصحف بهذه الاختيارات
              <ChevronLeft size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          التحكم في السور والأجزاء
      ====================================================== */}
      <section className="mx-auto -mt-5 max-w-5xl px-4 sm:px-6">
        <div className="rounded-[28px] border border-black/5 bg-white p-4 shadow-xl shadow-black/5 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setShowSurahs((open) => !open)
                setShowJuz(false)
              }}
              className={`group flex items-center justify-between rounded-2xl border px-4 py-4 text-right transition ${showSurahs ? 'border-[#0284C7]/30 bg-[#0284C7]/[0.06]' : 'border-[#E8E1D4] bg-[#FCFBF8] hover:border-[#0284C7]/25'}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0284C7]/10 text-[#0284C7]">
                  <BookOpen size={23} />
                </span>
                <div>
                  <p className="text-base font-black text-mushaf-dark">السور</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">اضغط لإظهار السور المتاحة</p>
                </div>
              </div>
              <span className="text-xl text-[#0284C7]">{showSurahs ? '−' : '+'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowJuz((open) => !open)
                setShowSurahs(false)
              }}
              className={`group flex items-center justify-between rounded-2xl border px-4 py-4 text-right transition ${showJuz ? 'border-[#D97706]/35 bg-[#D97706]/[0.06]' : 'border-[#E8E1D4] bg-[#FCFBF8] hover:border-[#D97706]/30'}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D97706]/10 text-[#D97706]">
                  <BookOpen size={23} />
                </span>
                <div>
                  <p className="text-base font-black text-mushaf-dark">الأجزاء الثلاثون</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">افتح بداية الجزء الفعلية</p>
                </div>
              </div>
              <span className="text-xl text-[#D97706]">{showJuz ? '−' : '+'}</span>
            </button>
          </div>

          {/* =================================================
              السور
          ================================================== */}
          {showSurahs && (
            <div className="mt-5 rounded-[24px] border border-[#E6DED0] bg-[#FCFBF8] p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-mushaf-dark">السور المتاحة</h2>
                  <p className="mt-1 text-[11px] font-bold leading-6 text-slate-400">
                    الرواية: {selectedRiwaya.label} · القارئ: {reciter.label}
                  </p>
                </div>

                <div className="rounded-full bg-amber-50 px-3 py-2 text-[10px] font-bold leading-5 text-amber-700">
                  تنبيه: اضغط على اسم السورة للانتقال مباشرة إلى صفحة المصحف الفعلية بهذه الاختيارات.
                </div>
              </div>

              <div className="mb-3 rounded-2xl border border-white bg-white p-3 text-xs font-bold text-slate-500 shadow-sm">
                يتم عرض السور اعتمادًا على الفهرس والصفحات المعروفة للمصحف، أما توافر الصوت فيعتمد على التلاوة الصوتية المختارة.
              </div>

              <div className="relative">
                <Search size={19} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#0284C7]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث باسم السورة أو رقمها أو رقم الصفحة..."
                  className="w-full rounded-2xl border border-[#E5DED1] bg-white py-4 pr-11 pl-11 text-sm font-bold text-mushaf-dark outline-none transition placeholder:text-slate-400 focus:border-[#0284C7] focus:ring-4 focus:ring-[#0284C7]/10"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/5 text-slate-500"
                    aria-label="مسح البحث"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['all', 'كل السور', BookOpen],
                  ['مكية', `مكية • ${makkiyaCount}`, Sun],
                  ['مدنية', `مدنية • ${madaniyaCount}`, Moon],
                ].map(([value, label, Icon]) => {
                  const active = filter === value
                  const IconComponent = Icon as typeof BookOpen

                  return (
                    <button
                      key={value as string}
                      type="button"
                      onClick={() => setFilter(value as FilterType)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition ${active ? 'bg-[#0284C7] text-white shadow-md' : 'bg-[#F4F1E9] text-slate-500 hover:bg-[#0284C7]/10 hover:text-[#0284C7]'}`}
                    >
                      <IconComponent size={15} />
                      {label as string}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSurahs.map((surah) => (
                  <Link
                    key={surah.id}
                    href={`/mushaf?page=${surah.startPage}&riwaya=${encodeURIComponent(riwaya)}&reciter=${encodeURIComponent(reciter.id)}`}
                    className="group relative overflow-hidden rounded-2xl border border-[#E9E2D4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0284C7]/35 hover:shadow-md"
                  >
                    <div className="absolute inset-y-0 right-0 w-1 bg-[#D97706] opacity-70" />
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D97706]/20 bg-[#FCFBF8] text-lg font-black text-[#0284C7]">
                        {toArabicNumber(surah.id)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-black text-mushaf-dark group-hover:text-[#0284C7]">
                            سورة {surah.name}
                          </h3>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${surah.type === 'مكية' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {surah.type}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-slate-400">
                          <span>{toArabicNumber(surah.ayahs)} آية</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>صفحة {toArabicNumber(surah.startPage)}</span>
                        </div>
                      </div>

                      <ChevronLeft size={18} className="shrink-0 text-[#D97706] transition-transform group-hover:-translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>

              {filteredSurahs.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                  <Search size={28} className="mx-auto mb-3 text-slate-400" />
                  <p className="font-black text-mushaf-dark">لم نجد سورة مطابقة</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">جرّب اسمًا آخر أو رقم السورة أو الصفحة.</p>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              الأجزاء
          ================================================== */}
          {showJuz && (
            <div className="mt-5 rounded-[24px] border border-[#E6DED0] bg-[#FCFBF8] p-3 sm:p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-mushaf-dark">الأجزاء الثلاثون</h2>
                  <p className="mt-1 text-[11px] font-bold leading-6 text-slate-400">
                    اضغط على الجزء لفتح بداية الجزء الفعلية في المصحف.
                  </p>
                </div>

                <span className="rounded-full bg-[#D97706]/10 px-3 py-2 text-[10px] font-black text-[#8B5A0B]">
                  الرواية: {selectedRiwaya.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
                {JUZ_LIST.map((juz) => (
                  <Link
                    key={juz.id}
                    href={`/mushaf?page=${juz.startPage}&riwaya=${encodeURIComponent(riwaya)}&reciter=${encodeURIComponent(reciter.id)}`}
                    className="group rounded-2xl border border-[#E8DFCF] bg-white px-3 py-4 text-center transition hover:-translate-y-0.5 hover:border-[#D97706]/45 hover:bg-[#D97706]/[0.04] hover:shadow-sm"
                  >
                    <span className="block text-sm font-black text-[#0284C7]">
                      الجزء {toArabicNumber(juz.id)}
                    </span>
                    <span className="mt-1 block text-[9px] font-bold text-slate-400">
                      صفحة {toArabicNumber(juz.startPage)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          حالة الاختيار الحالية
      ====================================================== */}
      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <div className="rounded-[24px] border border-[#E8DFCF] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-400">اختياراتك الحالية</p>
              <p className="mt-1 text-sm font-black text-[#0284C7]">
                {selectedRiwaya.label} · {reciter.label}
              </p>
            </div>

            <Link
              href={mushafHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#0369A1]"
            >
              فتح المصحف
              <ChevronLeft size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
