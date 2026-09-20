'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  GraduationCap,
  LibraryBig,
  Search,
  Bookmark,
} from 'lucide-react'

import {
  SUNNI_LIBRARY_BOOKS,
  SUNNI_LIBRARY_CATEGORIES,
  type SunniLibraryCategoryId,
} from '@/lib/islamic/sunniLibrary'

export default function IslamicLibraryPage() {
  const [activeCategory, setActiveCategory] =
    useState<SunniLibraryCategoryId>('aqidah')
  const [query, setQuery] = useState('')

  const activeCategoryMeta = SUNNI_LIBRARY_CATEGORIES.find(
    (category) => category.id === activeCategory
  )

  const books = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return SUNNI_LIBRARY_BOOKS.filter((book) => {
      if (book.category !== activeCategory) return false
      if (!normalized) return true

      return [
        book.title,
        book.author,
        book.description,
        book.sharhTitle || '',
        book.sharhAuthor || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [activeCategory, query])

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-mushaf-paper px-4 sm:px-6 lg:px-8 pb-32"
    >
      <div className="mx-auto max-w-7xl pt-5 sm:pt-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-11 h-11 rounded-2xl bg-white border border-mushaf-gold/25 shadow-sm text-mushaf-teal flex items-center justify-center hover:bg-mushaf-teal hover:text-white transition"
              aria-label="العودة للرئيسية"
            >
              <ArrowRight size={20} />
            </Link>

            <div>
              <div className="flex items-center gap-2 text-mushaf-teal">
                <LibraryBig size={22} />
                <h1 className="text-xl sm:text-2xl font-black">
                  المكتبة الشرعية
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                كتب منتقاة في العلوم الشرعية مع التعريف بالكتاب ومصادر الشرح.
              </p>
            </div>
          </div>

          <Link
            href="/mushaf"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mushaf-teal text-white px-5 py-3 text-sm font-black shadow-sm hover:opacity-95"
          >
            العودة للمصحف
            <BookOpen size={17} />
          </Link>
        </header>

        <section className="mt-6 rounded-[30px] bg-gradient-to-br from-mushaf-teal to-[#11464D] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-24 -right-20 w-72 h-72 rounded-full bg-mushaf-gold/10 blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-black text-mushaf-gold">
              <GraduationCap size={15} />
              مكتبة منتقاة
            </div>
            <h2 className="mt-4 text-2xl sm:text-3xl font-black leading-tight">
              طريقك إلى القراءة المنهجية في العلوم الشرعية
            </h2>
            <p className="mt-3 text-sm sm:text-base leading-7 text-white/80">
              اختَر المجال، ثم تصفح الكتب والمواد المرتبطة بها. المكتبة تعتمد
              قائمة تحريرية محددة بدل جلب عناوين عشوائية من الإنترنت.
            </p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SUNNI_LIBRARY_CATEGORIES.map((category) => {
            const active = category.id === activeCategory
            const count = SUNNI_LIBRARY_BOOKS.filter(
              (book) => book.category === category.id
            ).length

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`text-right rounded-2xl border p-4 transition min-h-[110px] ${
                  active
                    ? 'bg-mushaf-teal text-white border-mushaf-teal shadow-lg'
                    : 'bg-white text-mushaf-dark border-mushaf-border/30 hover:border-mushaf-teal/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <BookOpen size={18} />
                  <span className={`text-[10px] font-black rounded-full px-2 py-1 ${active ? 'bg-white/15' : 'bg-mushaf-paper text-gray-500'}`}>
                    {count.toLocaleString('ar-EG')}
                  </span>
                </div>
                <div className="mt-5 text-sm font-black">{category.label}</div>
                <div className={`mt-1 text-[11px] leading-5 ${active ? 'text-white/70' : 'text-gray-500'}`}>
                  {category.short}
                </div>
              </button>
            )
          })}
        </section>

        <section className="mt-6 rounded-3xl border border-mushaf-border/20 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black text-mushaf-teal">
                {activeCategoryMeta?.label || 'المكتبة'}
              </p>
              <h3 className="text-xl font-black text-mushaf-dark mt-1">
                {books.length.toLocaleString('ar-EG')} كتاب/مادة
              </h3>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-mushaf-paper px-4 h-12 w-full lg:max-w-xl">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث باسم الكتاب أو المؤلف أو الشرح..."
                className="w-full outline-none bg-transparent text-sm text-gray-800"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {books.map((book) => (
            <article
              key={book.id}
              className="rounded-[28px] bg-white border border-mushaf-border/15 shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center shrink-0">
                      <BookOpen size={21} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base sm:text-lg font-black text-mushaf-dark">
                        {book.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {book.author}
                      </p>
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-[10px] font-black rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5">
                  {book.level}
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-gray-600">
                {book.description}
              </p>

              <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-mushaf-teal">
                <Bookmark size={14} />
                غرفة قراءة داخل مصحف سميع + المصدر الأصلي للكتاب والشرح
              </div>

              <div className="mt-5 rounded-2xl bg-mushaf-paper border border-mushaf-gold/15 p-4">
                <div className="flex items-center gap-2 text-mushaf-teal text-xs font-black">
                  <GraduationCap size={16} />
                  مادة الشرح
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  {book.sharhTitle || 'تتوفر مصادر شرح مرتبطة بالكتاب'}
                  {book.sharhAuthor ? ` — ${book.sharhAuthor}` : ''}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/islamic-library/book/${encodeURIComponent(book.id)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-mushaf-gold text-white px-4 py-2.5 text-xs font-black hover:opacity-90 shadow-sm"
                >
                  فتح غرفة القراءة
                  <ArrowLeft size={14} />
                </Link>

                {book.readingUrl && (
                  <a
                    href={book.readingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-mushaf-teal text-white px-4 py-2.5 text-xs font-black hover:opacity-90"
                  >
                    {book.readingLabel || 'فتح الكتاب'}
                    <ExternalLink size={14} />
                  </a>
                )}

                {book.sharhUrl && (
                  <a
                    href={book.sharhUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-mushaf-teal border border-mushaf-teal/20 px-4 py-2.5 text-xs font-black hover:bg-mushaf-teal/5"
                  >
                    {book.sharhLabel || 'فتح الشرح'}
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>

        {!books.length && (
          <section className="mt-5 rounded-3xl bg-white border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
            لا توجد نتائج داخل القسم المحدد.
          </section>
        )}
      </div>
    </main>
  )
}
