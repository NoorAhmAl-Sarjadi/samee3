'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  ChevronLeft,
  Search,
  MapPin,
  Moon,
  Sun,
  Sparkles,
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

const RECITERS = [
  { id: 'ar.alafasy', label: 'مشاري راشد العفاسي' },
  { id: 'ar.husary', label: 'محمود خليل الحصري' },
  { id: 'ar.minshawi', label: 'محمد صديق المنشاوي' },
  { id: 'ar.abdulbasitmurattal', label: 'عبد الباسط عبد الصمد' },
  { id: 'ar.saoodshuraym', label: 'سعود الشريم' },
] as const

type FilterType = 'all' | 'مكية' | 'مدنية'

function toArabicNumber(value: number) {
  return value.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

export default function QuranIndexPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [riwaya, setRiwaya] = useState<(typeof RIWAYAT)[number]['id']>('hafs')
  const [reciter, setReciter] = useState<(typeof RECITERS)[number]['id']>('ar.alafasy')

  const filteredSurahs = useMemo(() => {
    const normalized = query.trim().replace(/^سورة\s*/i, '')

    return surahsList.filter((surah) => {
      const matchesQuery =
        !normalized ||
        surah.name.includes(normalized) ||
        String(surah.id).includes(normalized) ||
        String(surah.startPage).includes(normalized)

      const matchesFilter = filter === 'all' || surah.type === filter

      return matchesQuery && matchesFilter
    })
  }, [query, filter])

  const makkiyaCount = surahsList.filter((s) => s.type === 'مكية').length
  const madaniyaCount = surahsList.filter((s) => s.type === 'مدنية').length

  return (
    <main
      className="min-h-screen bg-[#F7F4EC] text-mushaf-dark pb-28"
      dir="rtl"
    >
      <section className="relative overflow-hidden bg-gradient-to-br from-[#123F44] via-[#175E67] to-[#0F3438] text-white">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-mushaf-gold/15 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-7 sm:px-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15"
              aria-label="العودة للرئيسية"
            >
              <ChevronLeft size={20} className="rotate-180" />
            </Link>

            <div className="text-center">
              <p className="text-xs font-bold tracking-[0.18em] text-mushaf-gold">
                مُصْحَف سَميع
              </p>
              <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                فهرس السور
              </h1>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <BookOpen size={21} className="text-mushaf-gold" />
            </div>
          </div>

          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm leading-7 text-white/75 sm:text-base">
              اختر الرواية والقارئ أولًا، ثم افتح السورة لتنتقل إلى صفحة المصحف
              المطبوعة المناسبة.
            </p>
          </div>

          <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
              <span className="mb-2 flex items-center gap-2 text-[11px] font-black text-white/75">
                <BookOpen size={15} className="text-mushaf-gold" />
                الرواية
              </span>
              <select
                value={riwaya}
                onChange={(event) =>
                  setRiwaya(event.target.value as (typeof RIWAYAT)[number]['id'])
                }
                className="w-full rounded-xl border border-white/15 bg-white/95 px-3 py-3 text-sm font-black text-[#175E67] outline-none"
              >
                {RIWAYAT.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
              <span className="mb-2 flex items-center gap-2 text-[11px] font-black text-white/75">
                <Mic2 size={15} className="text-mushaf-gold" />
                القارئ
              </span>
              <select
                value={reciter}
                onChange={(event) =>
                  setReciter(event.target.value as (typeof RECITERS)[number]['id'])
                }
                className="w-full rounded-xl border border-white/15 bg-white/95 px-3 py-3 text-sm font-black text-[#175E67] outline-none"
              >
                {RECITERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-5 max-w-6xl px-5 sm:px-8">
        <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-xl shadow-black/5 sm:p-5">
          <div className="relative">
            <Search
              size={20}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mushaf-teal"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم السورة أو رقمها أو رقم الصفحة..."
              className="w-full rounded-2xl border border-[#E6E0D2] bg-[#FCFBF8] py-4 pr-12 pl-12 text-sm font-bold text-mushaf-dark outline-none transition placeholder:text-gray-400 focus:border-mushaf-teal focus:ring-4 focus:ring-mushaf-teal/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/5 text-gray-500 hover:bg-black/10"
                aria-label="مسح البحث"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition ${
                    active
                      ? 'bg-mushaf-teal text-white shadow-md'
                      : 'bg-[#F7F4EC] text-gray-500 hover:bg-mushaf-teal/10 hover:text-mushaf-teal'
                  }`}
                >
                  <IconComponent size={15} />
                  {label as string}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-7 sm:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={18} className="text-mushaf-gold" />
              <h2 className="text-xl font-black text-mushaf-dark">
                السور المتاحة
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              عرض {toArabicNumber(filteredSurahs.length)} من أصل ١١٤ سورة
            </p>
          </div>

          <div className="rounded-full bg-mushaf-teal/8 px-4 py-2 text-xs font-bold text-mushaf-teal">
            {RIWAYAT.find((item) => item.id === riwaya)?.label} ·{' '}
            {RECITERS.find((item) => item.id === reciter)?.label}
          </div>
        </div>

        {filteredSurahs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mushaf-paper text-mushaf-teal">
              <Search size={26} />
            </div>
            <h3 className="font-black text-mushaf-dark">
              لم نجد سورة مطابقة
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              جرّب البحث باسم السورة أو رقمها.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSurahs.map((surah) => (
              <Link
                key={surah.id}
                href={`/mushaf?page=${surah.startPage}&riwaya=${encodeURIComponent(riwaya)}&reciter=${encodeURIComponent(reciter)}`}
                className="group relative overflow-hidden rounded-3xl border border-[#E9E2D4] bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-mushaf-teal/35 hover:shadow-lg"
              >
                <div className="absolute inset-y-0 right-0 w-1 bg-mushaf-gold opacity-70" />

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-mushaf-gold/25 bg-mushaf-paper text-xl font-black text-mushaf-teal">
                    {toArabicNumber(surah.id)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-black text-mushaf-dark group-hover:text-mushaf-teal">
                        سورة {surah.name}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                          surah.type === 'مكية'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {surah.type}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-gray-400">
                      <span>آيات {toArabicNumber(surah.ayahs)}</span>
                      <span className="h-1 w-1 rounded-full bg-gray-300" />
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} />
                        صفحة {toArabicNumber(surah.startPage)}
                      </span>
                    </div>
                  </div>

                  <ChevronLeft
                    size={20}
                    className="shrink-0 text-mushaf-gold transition-transform group-hover:-translate-x-1"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
