'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  GraduationCap,
  Moon,
  Sun,
  Minus,
  Plus,
  Bookmark,
  Check,
  LibraryBig,
} from 'lucide-react'

import {
  SUNNI_LIBRARY_BOOKS,
  SUNNI_LIBRARY_CATEGORIES,
} from '@/lib/islamic/sunniLibrary'

const BOOKMARKS_KEY = 'samee3_islamic_bookmarks_v1'
const READING_KEY_PREFIX = 'samee3_islamic_reader_v1:'

export default function IslamicBookReaderPage() {
  const params = useParams<{ id: string }>()
  const rawId = params?.id || ''
  const bookId = decodeURIComponent(rawId)

  const book = useMemo(
    () => SUNNI_LIBRARY_BOOKS.find((item) => item.id === bookId) || null,
    [bookId]
  )

  const category = useMemo(
    () =>
      book
        ? SUNNI_LIBRARY_CATEGORIES.find(
            (item) => item.id === book.category
          )
        : null,
    [book]
  )

  const [fontScale, setFontScale] = useState(1)
  const [darkMode, setDarkMode] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notes, setNotes] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    if (!book) return

    try {
      const stored = JSON.parse(
        localStorage.getItem(BOOKMARKS_KEY) || '[]'
      )

      setSaved(stored.includes(book.id))

      const readerState = JSON.parse(
        localStorage.getItem(`${READING_KEY_PREFIX}${book.id}`) || '{}'
      )

      if (typeof readerState.fontScale === 'number') {
        setFontScale(
          Math.min(1.35, Math.max(0.85, readerState.fontScale))
        )
      }

      if (typeof readerState.darkMode === 'boolean') {
        setDarkMode(readerState.darkMode)
      }

      if (typeof readerState.notes === 'string') {
        setNotes(readerState.notes)
      }
    } catch {
      // القراءة تعمل حتى لو تعذر التخزين المحلي.
    }
  }, [book])

  useEffect(() => {
    if (!book) return

    try {
      localStorage.setItem(
        `${READING_KEY_PREFIX}${book.id}`,
        JSON.stringify({
          fontScale,
          darkMode,
          notes,
          updatedAt: Date.now(),
        })
      )
    } catch {
      // Ignore localStorage errors.
    }
  }, [book, fontScale, darkMode, notes])

  const toggleBookmark = () => {
    if (!book) return

    try {
      const current = JSON.parse(
        localStorage.getItem(BOOKMARKS_KEY) || '[]'
      ) as string[]

      if (saved) {
        localStorage.setItem(
          BOOKMARKS_KEY,
          JSON.stringify(current.filter((id) => id !== book.id))
        )
        setSaved(false)
      } else {
        localStorage.setItem(
          BOOKMARKS_KEY,
          JSON.stringify(Array.from(new Set([...current, book.id])))
        )
        setSaved(true)
      }
    } catch {
      setSaved((value) => !value)
    }
  }

  const changeFont = (delta: number) => {
    setFontScale((value) =>
      Math.min(1.35, Math.max(0.85, Number((value + delta).toFixed(2))))
    )
  }

  const saveNote = () => {
    setNoteSaved(true)
    window.setTimeout(() => setNoteSaved(false), 1800)
  }

  if (!book) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-mushaf-paper flex items-center justify-center px-4"
      >
        <section className="w-full max-w-xl rounded-[32px] bg-white border border-mushaf-border/20 shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center">
            <LibraryBig size={30} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-mushaf-dark">
            الكتاب غير موجود
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            لم يتم العثور على هذا الكتاب داخل قائمة المكتبة المعتمدة.
          </p>
          <Link
            href="/islamic-library"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal text-white px-5 py-3 text-sm font-black"
          >
            العودة للمكتبة
            <ArrowLeft size={17} />
          </Link>
        </section>
      </main>
    )
  }

  const surface = darkMode ? 'bg-[#121817]' : 'bg-[#FBF8F0]'
  const card = darkMode
    ? 'bg-[#1A2220] border-white/10'
    : 'bg-white border-mushaf-border/15'
  const mainText = darkMode ? 'text-[#F4EFE2]' : 'text-mushaf-dark'
  const muted = darkMode ? 'text-white/60' : 'text-gray-500'

  return (
    <main
      dir="rtl"
      className={`min-h-screen ${surface} pb-32 transition-colors duration-300`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/islamic-library"
              className={`w-11 h-11 rounded-2xl ${card} border shadow-sm ${
                darkMode ? 'text-white' : 'text-mushaf-teal'
              } flex items-center justify-center`}
              aria-label="العودة للمكتبة"
            >
              <ArrowRight size={20} />
            </Link>

            <div>
              <div className={`flex items-center gap-2 ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                <BookOpen size={21} />
                <span className="text-xs font-black">
                  {category?.label || 'المكتبة الشرعية'}
                </span>
              </div>
              <h1 className={`mt-1 text-xl sm:text-2xl font-black ${mainText}`}>
                {book.title}
              </h1>
              <p className={`mt-1 text-xs sm:text-sm ${muted}`}>
                {book.author}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => changeFont(-0.05)}
              className={`h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${
                darkMode ? 'text-white' : 'text-mushaf-teal'
              }`}
              title="تصغير الخط"
              aria-label="تصغير الخط"
            >
              <Minus size={18} />
            </button>

            <button
              type="button"
              onClick={() => changeFont(0.05)}
              className={`h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${
                darkMode ? 'text-white' : 'text-mushaf-teal'
              }`}
              title="تكبير الخط"
              aria-label="تكبير الخط"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl ${card} border text-xs font-black ${
                darkMode ? 'text-white' : 'text-mushaf-teal'
              }`}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              {darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs font-black ${
                saved
                  ? 'bg-mushaf-gold text-white border-mushaf-gold'
                  : `${card} ${darkMode ? 'text-white' : 'text-mushaf-teal'}`
              }`}
            >
              {saved ? <Check size={17} /> : <Bookmark size={17} />}
              {saved ? 'محفوظ' : 'حفظ الكتاب'}
            </button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <article className={`rounded-[32px] border shadow-sm overflow-hidden ${card}`}>
            <div className="p-5 sm:p-7 border-b border-current/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5 text-[11px] font-black">
                  {book.level}
                </span>
                <span className={`text-[11px] font-bold ${muted}`}>
                  {category?.short || 'مادة شرعية'}
                </span>
              </div>

              <p className={`mt-4 text-sm sm:text-base leading-8 ${mainText}`}>
                {book.description}
              </p>
            </div>

            <div className="p-5 sm:p-7">
              <div className="rounded-[26px] bg-mushaf-teal text-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] text-white/60">
                      غرفة القراءة
                    </p>
                    <h2 className="mt-1 text-lg font-black">
                      قراءة الكتاب من المصدر
                    </h2>
                  </div>
                  <BookOpen size={25} className="text-mushaf-gold" />
                </div>

                <p className="mt-3 text-xs sm:text-sm leading-6 text-white/75">
                  نعرض المصدر الأصلي الموثوق للكتاب، مع أدوات القراءة والحفظ
                  داخل مصحف سميع دون نسخ نص الكتاب إلى قاعدة بياناتنا.
                </p>
              </div>

              {book.readingUrl ? (
                <>
                  <div className="mt-5 rounded-[24px] overflow-hidden border border-mushaf-border/15 bg-black/5">
                    <iframe
                      title={`قراءة ${book.title}`}
                      src={book.readingUrl}
                      className="w-full h-[620px] bg-white"
                    />
                  </div>

                  <div className={`mt-4 rounded-2xl p-4 text-xs leading-6 ${
                    darkMode
                      ? 'bg-white/5 text-white/70'
                      : 'bg-mushaf-paper text-gray-600'
                  }`}>
                    ملاحظة: بعض المصادر الخارجية تمنع عرض الصفحة داخل إطار
                    في موقع آخر؛ عند حدوث ذلك استخدم «فتح المصدر الأصلي».
                  </div>

                  <a
                    href={book.readingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal text-white px-5 py-3 text-sm font-black"
                  >
                    فتح المصدر الأصلي
                    <ExternalLink size={16} />
                  </a>
                </>
              ) : (
                <div className={`mt-5 rounded-2xl border border-dashed p-6 text-center text-sm ${muted}`}>
                  لا يوجد رابط قراءة مسجل لهذا الكتاب حتى الآن.
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-5">
            <section className={`rounded-[28px] border shadow-sm p-5 ${card}`}>
              <div className={`flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                <GraduationCap size={18} />
                الشرح المعتمد في بطاقة الكتاب
              </div>

              <p className={`mt-4 text-sm leading-7 ${mainText}`}>
                {book.sharhTitle || 'لا يوجد شرح مسجل'}
              </p>

              {book.sharhAuthor && (
                <p className={`mt-1 text-xs ${muted}`}>
                  {book.sharhAuthor}
                </p>
              )}

              {book.sharhUrl && (
                <>
                  <a
                    href={book.sharhUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-mushaf-teal/20 text-mushaf-teal px-4 py-3 text-xs font-black hover:bg-mushaf-teal/5"
                  >
                    فتح مادة الشرح
                    <ExternalLink size={15} />
                  </a>
                  <p className={`mt-3 text-[11px] leading-5 ${muted}`}>
                    مصدر الشرح يُفتح من موقعه الأصلي. لا يتم دمج نصوص محمية
                    بحقوق النشر داخل التطبيق دون ترخيص.
                  </p>
                </>
              )}
            </section>

            <section className={`rounded-[28px] border shadow-sm p-5 ${card}`}>
              <div className={`flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                <Bookmark size={18} />
                ملاحظاتك
              </div>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="اكتب ملاحظاتك أثناء الدراسة..."
                className={`mt-4 w-full min-h-[150px] rounded-2xl border px-4 py-3 outline-none resize-y text-sm leading-7 ${
                  darkMode
                    ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                    : 'bg-mushaf-paper text-mushaf-dark border-gray-200 placeholder:text-gray-400'
                }`}
              />

              <button
                type="button"
                onClick={saveNote}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-mushaf-teal text-white px-4 py-2.5 text-xs font-black"
              >
                {noteSaved ? <Check size={15} /> : <Bookmark size={15} />}
                {noteSaved ? 'تم الحفظ' : 'حفظ الملاحظة'}
              </button>
            </section>

            <Link
              href="/islamic-library"
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-white'
                  : 'bg-white border-mushaf-border/20 text-mushaf-teal'
              }`}
            >
              استكشاف باقي الكتب
              <ArrowLeft size={16} />
            </Link>
          </aside>
        </section>
      </div>
    </main>
  )
}
