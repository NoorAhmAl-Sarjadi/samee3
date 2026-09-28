'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Search,
  List,
  X,
  Copy,
  CheckCheck,
  Home,
} from 'lucide-react'

import {
  SUNNI_LIBRARY_BOOKS,
  SUNNI_LIBRARY_CATEGORIES,
} from '@/lib/islamic/sunniLibrary'

const BOOKMARKS_KEY = 'samee3_islamic_bookmarks_v1'
const READING_KEY_PREFIX = 'samee3_islamic_reader_v2:'

interface ReaderSection {
  text: string
  page?: number
  part?: number
  section?: string
}

interface ReaderPayload {
  source: 'quranpedia' | 'external'
  quranpediaBookId?: number
  book: {
    id: string
    title: string
    author: string
    category: string
    level: string
    description: string
    readingUrl?: string | null
    sharhUrl?: string | null
    sharhTitle?: string | null
    sharhAuthor?: string | null
    publication?: {
      publishYear?: string | number | null
      edition?: string | null
      publisher?: string | null
      parts?: number | null
    }
  }
  contents?: ReaderSection[]
  message?: string
}

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

  const [payload, setPayload] = useState<ReaderPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [fontScale, setFontScale] = useState(1)
  const [darkMode, setDarkMode] = useState(false)
  const [saved, setSaved] = useState(false)
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState(0)
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!book) return

    let cancelled = false
    const currentBook = book

    async function load() {
      try {
        setLoading(true)
        setLoadError('')

        const response = await fetch(
          `/api/islamic-library/book/${encodeURIComponent(currentBook.id)}`,
          { cache: 'no-store' }
        )
        const data = await response.json()

        if (!response.ok || !data?.success) {
          throw new Error('LOAD_FAILED')
        }

        if (!cancelled) setPayload(data as ReaderPayload)
      } catch {
        if (!cancelled) {
          setLoadError(
            'تعذر تحميل محتوى الكتاب حاليًا. يمكنك فتح المصدر الأصلي مباشرة.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    try {
      const bookmarks = JSON.parse(
        localStorage.getItem(BOOKMARKS_KEY) || '[]'
      )
      setSaved(Array.isArray(bookmarks) && bookmarks.includes(currentBook.id))

      const state = JSON.parse(
        localStorage.getItem(`${READING_KEY_PREFIX}${currentBook.id}`) || '{}'
      )

      if (typeof state.fontScale === 'number') {
        setFontScale(
          Math.min(1.45, Math.max(0.85, state.fontScale))
        )
      }

      if (typeof state.darkMode === 'boolean') {
        setDarkMode(state.darkMode)
      }

      if (typeof state.notes === 'string') {
        setNotes(state.notes)
      }

      if (typeof state.activeSection === 'number') {
        setActiveSection(Math.max(0, state.activeSection))
      }
    } catch {
      // ignore local storage failures
    }

    return () => {
      cancelled = true
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
          activeSection,
          updatedAt: Date.now(),
        })
      )
    } catch {
      // ignore local storage failures
    }
  }, [book, fontScale, darkMode, notes, activeSection])

  const contents = payload?.contents || []

  const filteredContents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return contents

    return contents.filter((item) =>
      [item.text, item.section || '', String(item.page || '')]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [contents, query])

  const currentItem =
    filteredContents[
      Math.min(activeSection, Math.max(0, filteredContents.length - 1))
    ]

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

  const copyCurrent = async () => {
    if (!currentItem?.text) return
    try {
      await navigator.clipboard.writeText(currentItem.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard may be blocked by browser permissions.
    }
  }

  if (!book) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-mushaf-paper flex items-center justify-center px-4"
      >
        <section className="w-full max-w-xl rounded-[32px] bg-white border border-mushaf-border/20 shadow-xl p-8 text-center">
          <BookOpen className="mx-auto text-mushaf-teal" size={34} />
          <h1 className="mt-5 text-2xl font-black">الكتاب غير موجود</h1>
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

  const surface = darkMode ? 'bg-[#101614]' : 'bg-[#FBF8F0]'
  const card = darkMode
    ? 'bg-[#18201D] border-white/10'
    : 'bg-white border-mushaf-border/15'
  const mainText = darkMode ? 'text-[#F4EFE2]' : 'text-mushaf-dark'
  const muted = darkMode ? 'text-white/60' : 'text-gray-500'

  return (
    <main dir="rtl" className={`min-h-screen ${surface} pb-32`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/islamic-library"
              className={`w-11 h-11 rounded-2xl ${card} border shadow-sm flex items-center justify-center ${mainText}`}
              aria-label="العودة للمكتبة"
            >
              <ArrowRight size={20} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-mushaf-teal text-xs font-black">
                <BookOpen size={17} />
                {category?.label || 'المكتبة الشرعية'}
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
              onClick={() => setFontScale((v) => Math.max(0.85, Number((v - 0.05).toFixed(2))))}
              className={`h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}`}
              title="تصغير الخط"
            >
              <Minus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setFontScale((v) => Math.min(1.45, Number((v + 0.05).toFixed(2))))}
              className={`h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}`}
              title="تكبير الخط"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl ${card} border text-xs font-black ${mainText}`}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              {darkMode ? 'نهاري' : 'ليلي'}
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs font-black ${
                saved
                  ? 'bg-mushaf-gold text-white border-mushaf-gold'
                  : `${card} ${mainText}`
              }`}
            >
              {saved ? <Check size={17} /> : <Bookmark size={17} />}
              {saved ? 'محفوظ' : 'حفظ'}
            </button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5">
          <aside className="space-y-5">
            <section className={`rounded-[28px] border shadow-sm p-5 ${card}`}>
              <div className={`flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                <List size={18} />
                فهرس القراءة
              </div>

              <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2">
                {(contents.length ? contents : [{ text: book.description, section: 'نبذة عن الكتاب' }]).map((item, index) => {
                  const active = index === activeSection
                  return (
                    <button
                      key={`${item.page || 'x'}-${index}`}
                      type="button"
                      onClick={() => {
                        setActiveSection(index)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={`w-full text-right rounded-2xl px-3 py-3 text-xs leading-5 transition border ${
                        active
                          ? 'bg-mushaf-teal text-white border-mushaf-teal'
                          : `${darkMode ? 'bg-white/5 text-white/75 border-white/10' : 'bg-mushaf-paper text-gray-700 border-gray-100 hover:border-mushaf-teal/20'}`
                      }`}
                    >
                      <div className="font-black">
                        {item.section || `موضع ${index + 1}`}
                      </div>
                      {item.page ? (
                        <div className={`mt-1 text-[10px] ${active ? 'text-white/65' : muted}`}>
                          الصفحة {item.page.toLocaleString('ar-EG')}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className={`rounded-[28px] border shadow-sm p-5 ${card}`}>
              <div className={`flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                <Search size={18} />
                بحث داخل الكتاب
              </div>

              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveSection(0)
                }}
                placeholder="ابحث عن كلمة أو عبارة..."
                className={`mt-4 w-full h-11 rounded-xl border px-3 text-sm outline-none ${
                  darkMode
                    ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                    : 'bg-mushaf-paper text-mushaf-dark border-gray-200'
                }`}
              />

              <p className={`mt-3 text-[11px] leading-5 ${muted}`}>
                {filteredContents.length.toLocaleString('ar-EG')} موضع متاح في نتيجة البحث.
              </p>
            </section>
          </aside>

          <article className={`rounded-[32px] border shadow-sm overflow-hidden ${card}`}>
            <div className="p-5 sm:p-7 border-b border-current/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5 text-[11px] font-black">
                  {book.level}
                </span>
                <span className={`text-xs font-bold ${muted}`}>
                  {category?.short || 'مادة شرعية'}
                </span>
                {payload?.source === 'quranpedia' && (
                  <span className="rounded-full bg-mushaf-teal/10 text-mushaf-teal px-3 py-1.5 text-[11px] font-black">
                    قراءة نصية داخل التطبيق
                  </span>
                )}
              </div>

              <p className={`mt-4 text-sm sm:text-base leading-8 ${mainText}`}>
                {book.description}
              </p>

              {payload?.book.publication && (
                <div className={`mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] ${muted}`}>
                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">الناشر</span>
                    <span>{payload.book.publication.publisher || '—'}</span>
                  </div>
                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">السنة</span>
                    <span>{payload.book.publication.publishYear || '—'}</span>
                  </div>
                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">الطبعة</span>
                    <span>{payload.book.publication.edition || '—'}</span>
                  </div>
                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">الأجزاء</span>
                    <span>{payload.book.publication.parts || '—'}</span>
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <div className={`p-12 text-center ${muted}`}>
                جارٍ تجهيز الكتاب للقراءة...
              </div>
            ) : loadError ? (
              <div className="p-8 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                  <X size={24} />
                </div>
                <p className={`mt-4 text-sm leading-6 ${mainText}`}>
                  {loadError}
                </p>
                {book.readingUrl && (
                  <a
                    href={book.readingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal text-white px-5 py-3 text-xs font-black"
                  >
                    فتح المصدر الأصلي
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            ) : payload?.source === 'quranpedia' && contents.length ? (
              <div className="p-6 sm:p-10">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <p className="text-[11px] font-black text-mushaf-teal">
                        موضع القراءة
                      </p>
                      <p className={`text-xs ${muted}`}>
                        {(currentItem?.page
                          ? `صفحة ${currentItem.page.toLocaleString('ar-EG')}`
                          : `الموضع ${(activeSection + 1).toLocaleString('ar-EG')}`)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void copyCurrent()}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                        darkMode
                          ? 'border-white/10 text-white'
                          : 'border-mushaf-teal/15 text-mushaf-teal'
                      }`}
                    >
                      {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                      {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>

                  <div className={`rounded-[28px] px-6 sm:px-10 py-8 sm:py-12 border ${
                    darkMode
                      ? 'bg-[#111715] border-white/10'
                      : 'bg-[#FFFDF8] border-mushaf-gold/15'
                  }`}>
                    {currentItem?.section && (
                      <h2 className={`text-center font-black text-lg sm:text-xl ${mainText}`}>
                        {currentItem.section}
                      </h2>
                    )}

                    <p
                      className={`mt-7 whitespace-pre-wrap leading-[2.35] sm:leading-[2.5] text-center ${
                        darkMode ? 'text-[#F4EFE2]' : 'text-[#27231D]'
                      }`}
                      style={{ fontSize: `${1.25 * fontScale}rem` }}
                    >
                      {currentItem?.text || book.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveSection((v) => Math.max(0, v - 1))}
                      disabled={activeSection <= 0}
                      className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal text-white px-4 py-3 text-xs font-black disabled:opacity-35"
                    >
                      <ArrowRight size={16} />
                      السابق
                    </button>

                    <span className={`text-xs font-bold ${muted}`}>
                      {Math.min(activeSection + 1, filteredContents.length).toLocaleString('ar-EG')}
                      {' / '}
                      {filteredContents.length.toLocaleString('ar-EG')}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSection((v) =>
                          Math.min(filteredContents.length - 1, v + 1)
                        )
                      }
                      disabled={activeSection >= filteredContents.length - 1}
                      className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal text-white px-4 py-3 text-xs font-black disabled:opacity-35"
                    >
                      التالي
                      <ArrowLeft size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 sm:p-10">
                <div className={`rounded-[28px] p-6 ${darkMode ? 'bg-white/5' : 'bg-mushaf-paper'}`}>
                  <div className="flex items-center gap-2 text-mushaf-teal font-black text-sm">
                    <BookOpen size={19} />
                    المصدر النصي غير متاح حاليًا داخل API
                  </div>
                  <p className={`mt-3 text-sm leading-7 ${muted}`}>
                    الكتاب موجود في مكتبة مصحف سميع، لكن مصدره الحالي لا يوفر
                    محتوى نصيًا موحدًا يمكن دمجه داخل القارئ بدون نسخ المحتوى
                    أو تجاوز شروط المصدر. استخدم المصدر الأصلي من الزر التالي.
                  </p>

                  {payload?.message && (
                    <p className={`mt-3 text-xs leading-6 ${muted}`}>
                      {payload.message}
                    </p>
                  )}

                  {book.readingUrl && (
                    <a
                      href={book.readingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal text-white px-5 py-3 text-xs font-black"
                    >
                      فتح الكتاب
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="p-5 sm:p-7 border-t border-current/10">
              <div className={`rounded-[24px] p-5 ${darkMode ? 'bg-white/5' : 'bg-mushaf-paper'}`}>
                <div className={`flex items-center gap-2 text-sm font-black ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                  <GraduationCap size={18} />
                  الشرح
                </div>
                <p className={`mt-3 text-sm leading-7 ${mainText}`}>
                  {book.sharhTitle || 'لم يتم تسجيل شرح مستقل لهذا الكتاب بعد.'}
                  {book.sharhAuthor ? ` — ${book.sharhAuthor}` : ''}
                </p>

                {book.sharhUrl && (
                  <a
                    href={book.sharhUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-mushaf-teal/20 text-mushaf-teal px-4 py-2.5 text-xs font-black"
                  >
                    فتح الشرح
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>

              <div className="mt-5">
                <div className={`flex items-center gap-2 text-sm font-black ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}`}>
                  <Bookmark size={18} />
                  ملاحظاتك
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="دوّن الفوائد أو الملاحظات هنا..."
                  className={`mt-3 w-full min-h-[120px] rounded-2xl border px-4 py-3 text-sm leading-7 outline-none ${
                    darkMode
                      ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                      : 'bg-mushaf-paper border-gray-200 text-mushaf-dark'
                  }`}
                />
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/islamic-library"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode ? 'border-white/10 text-white' : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }`}
          >
            <Home size={15} />
            المكتبة الشرعية
          </Link>

          <Link
            href="/"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode ? 'border-white/10 text-white' : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }`}
          >
            الرئيسية
            <Home size={15} />
          </Link>
        </div>
      </div>
    </main>
  )
}
