بالضبط، ولتنفيذ النظام الذي وصفته بشكل مرتب وقابل للإدارة من الأدمن، نحتاج هذه الملفات، وكل واحد له وظيفة محددة:

ملفات واجهة المكتبة
app/islamic-library/page.tsx

هذه الصفحة الرئيسية للمكتبة.

ستكون بالشكل:

المكتبة الشرعية

المرحلة التمهيدية
المرحلة المتوسطة
المرحلة المتقدمة

ثم عند اختيار المستوى:

العقيدة
الفقه
السيرة
أصول التفسير
أصول الفقه
أصول الحديث
...

ثم الكتب الموجودة داخل القسم.

app/islamic-library/book/[id]/page.tsx

هذه صفحة الكتاب نفسه.

وهي أهم صفحة بالنسبة للشكل الذي تريده؛ ستعرض:

اسم الكتاب كاملًا
المؤلف
المستوى
القسم

شرح الكتاب
[ مشاهدة الدروس ]

تحميل الكتاب
[ تحميل الكتاب ]

الدروس
1. الدرس الأول
2. الدرس الثاني
3. الدرس الثالث
...

وعند الضغط على مشاهدة الدروس تظهر قائمة الفيديوهات، وعند اختيار أي درس يفتح الفيديو داخل المنصة نفسها.

ملف بيانات الكتب
lib/islamic/sunniLibrary.ts

هذا حاليًا موجود عندك بالفعل، وهو يحتوي أصلًا على:

العقيدة
الفقه
السيرة
أصول التفسير
أصول الفقه
أصول الحديث

وسنطوره ليصبح كل كتاب فيه بيانات مثل:

{
  id: '...',
  category: 'fiqh',
  level: 'مبتدئ',
  title: 'اسم الكتاب كاملًا',
  author: 'اسم المؤلف',
  description: '...',
  downloadUrl: '...',
  videos: [
    {
      id: '...',
      title: 'الدرس الأول',
      url: '...'
    },
    {
      id: '...',
      title: 'الدرس الثاني',
      url: '...'
    }
  ]
}

وبالتالي اسم الكتاب الكامل سيظهر في كل مكان، وليس مجرد اسم مختصر.

API الخاصة ببيانات الكتاب

عندك أصلًا:

app/api/islamic-library/book/[id]/route.ts

وهذه سنعدلها لتعيد:

بيانات الكتاب
رابط التحميل
قائمة الدروس
روابط الفيديو
اسم كل درس
بيانات المؤلف والمستوى والقسم

بدل اعتماد الصفحة فقط على البيانات الثابتة.

ملف عرض المكتبة داخل المصحف

عندك:

components/IslamicLibrarySheet.tsx

وده موجود عندك بالفعل.

سنعدل الشكل بحيث لو دخل المستخدم للمكتبة من داخل المصحف يظل التنظيم نفسه:

المكتبة الشرعية
↓
تمهيدي | متوسط | متقدم
↓
العقيدة | الفقه | ...
↓
الكتب

مع زر الدخول إلى صفحة الكتاب.

ملفات الأدمن

أنت عندك لوحة الإدارة هنا:

app/admin/page.tsx

وهذا الملف سنضيف إليه قسم:

إدارة المكتبة الشرعية

ومن خلاله الأدمن يستطيع:

إضافة كتاب
تعديل كتاب
حذف كتاب

تحديد المستوى
تحديد القسم
كتابة اسم الكتاب كاملًا
كتابة اسم المؤلف
إضافة رابط تحميل الكتاب

إضافة درس
اسم الدرس
رابط الفيديو

تعديل الدرس
حذف الدرس
تغيير ترتيب الدروس
الأفضل: ملف مستقل لإدارة المكتبة

بدل ما نخلي app/admin/page.tsx ضخم جدًا، أنصح بإنشاء:

components/admin/IslamicLibraryAdmin.tsx

ويكون هو مسؤولًا فقط عن إدارة المكتبة.

وبذلك app/admin/page.tsx يستدعيه داخل تبويب:

المكتبة الشرعية

وده هيخلي الكود أنظف وأسهل في التطوير.

قاعدة البيانات

وبما أنك تريد الأدمن يضيف ويعدل ويحذف بنفسه، الأفضل أن بيانات المكتبة الإدارية لا تظل ثابتة داخل sunniLibrary.ts فقط.

سنستخدم Firestore:

islamicLibrary
 └── books
      └── bookId
           ├── title
           ├── author
           ├── level
           ├── category
           ├── description
           ├── downloadUrl
           └── videos

وكل فيديو:

videos
 └── videoId
      ├── title
      ├── url
      └── order

أو نجعل الفيديوهات Subcollection، وده أفضل مع كثرة الدروس.

قواعد Firestore

وسنعدل:

firestore.rules

بحيث:

المستخدم:

قراءة المكتبة ✅
مشاهدة الفيديو ✅
تحميل الكتاب ✅

الأدمن:

إضافة ✅
تعديل ✅
حذف ✅
إضافة فيديو ✅
تعديل فيديو ✅
حذف فيديو ✅

والمستخدم العادي لا يستطيع تعديل أي شيء.

إذن الملفات التي هنشتغل عليها
app/islamic-library/page.tsx
app/islamic-library/book/[id]/page.tsx
app/api/islamic-library/book/[id]/route.ts
lib/islamic/sunniLibrary.ts
components/IslamicLibrarySheet.tsx
app/admin/page.tsx
components/admin/IslamicLibraryAdmin.tsx
firestore.rules

وفيه ملف إضافي قد نحتاجه لاحقًا إذا أردنا API منفصل للإدارة:

app/api/admin/islamic-library/route.ts

وأنا أنصح نبدأ من lib/islamic/sunniLibrary.ts أولًا لأنه هو الذي يحتوي أصلًا على الكتب والتصنيفات الحالية، ونضيف إليه بنية رابط التحميل + الدروس + روابط الفيديو + ترتيب الدروس + المستوى، ثم نبني عليه باقي الصفحات والأدمن. الملف الموجود عندك بالفعل يحتوي التصنيفات الستة وحقول الكتاب الأساسية، لذلك هذا هو أنظف نقطة بداية.

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
          /api/islamic-library/book/${encodeURIComponent(currentBook.id)},
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
        localStorage.getItem(${READING_KEY_PREFIX}${currentBook.id}) || '{}'
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
        ${READING_KEY_PREFIX}${book.id},
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
    <main dir="rtl" className={min-h-screen ${surface} pb-32}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/islamic-library"
              className={w-11 h-11 rounded-2xl ${card} border shadow-sm flex items-center justify-center ${mainText}}
              aria-label="العودة للمكتبة"
            >
              <ArrowRight size={20} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-mushaf-teal text-xs font-black">
                <BookOpen size={17} />
                {category?.label || 'المكتبة الشرعية'}
              </div>
              <h1 className={mt-1 text-xl sm:text-2xl font-black ${mainText}}>
                {book.title}
              </h1>
              <p className={mt-1 text-xs sm:text-sm ${muted}}>
                {book.author}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFontScale((v) => Math.max(0.85, Number((v - 0.05).toFixed(2))))}
              className={h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}}
              title="تصغير الخط"
            >
              <Minus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setFontScale((v) => Math.min(1.45, Number((v + 0.05).toFixed(2))))}
              className={h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}}
              title="تكبير الخط"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              className={inline-flex items-center gap-2 h-11 px-4 rounded-xl ${card} border text-xs font-black ${mainText}}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              {darkMode ? 'نهاري' : 'ليلي'}
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              className={inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs font-black ${
                saved
                  ? 'bg-mushaf-gold text-white border-mushaf-gold'
                  : ${card} ${mainText}
              }}
            >
              {saved ? <Check size={17} /> : <Bookmark size={17} />}
              {saved ? 'محفوظ' : 'حفظ'}
            </button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5">
          <aside className="space-y-5">
            <section className={rounded-[28px] border shadow-sm p-5 ${card}}>
              <div className={flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
                <List size={18} />
                فهرس القراءة
              </div>

              <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2">
                {(contents.length ? contents : [{ text: book.description, section: 'نبذة عن الكتاب' }]).map((item, index) => {
                  const active = index === activeSection
                  return (
                    <button
                      key={${item.page || 'x'}-${index}}
                      type="button"
                      onClick={() => {
                        setActiveSection(index)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={w-full text-right rounded-2xl px-3 py-3 text-xs leading-5 transition border ${
                        active
                          ? 'bg-mushaf-teal text-white border-mushaf-teal'
                          : ${darkMode ? 'bg-white/5 text-white/75 border-white/10' : 'bg-mushaf-paper text-gray-700 border-gray-100 hover:border-mushaf-teal/20'}
                      }}
                    >
                      <div className="font-black">
                        {item.section || موضع ${index + 1}}
                      </div>
                      {item.page ? (
                        <div className={mt-1 text-[10px] ${active ? 'text-white/65' : muted}}>
                          الصفحة {item.page.toLocaleString('ar-EG')}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className={rounded-[28px] border shadow-sm p-5 ${card}}>
              <div className={flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
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
                className={mt-4 w-full h-11 rounded-xl border px-3 text-sm outline-none ${
                  darkMode
                    ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                    : 'bg-mushaf-paper text-mushaf-dark border-gray-200'
                }}
              />

              <p className={mt-3 text-[11px] leading-5 ${muted}}>
                {filteredContents.length.toLocaleString('ar-EG')} موضع متاح في نتيجة البحث.
              </p>
            </section>
          </aside>

          <article className={rounded-[32px] border shadow-sm overflow-hidden ${card}}>
            <div className="p-5 sm:p-7 border-b border-current/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5 text-[11px] font-black">
                  {book.level}
                </span>
                <span className={text-xs font-bold ${muted}}>
                  {category?.short || 'مادة شرعية'}
                </span>
                {payload?.source === 'quranpedia' && (
                  <span className="rounded-full bg-mushaf-teal/10 text-mushaf-teal px-3 py-1.5 text-[11px] font-black">
                    قراءة نصية داخل التطبيق
                  </span>
                )}
              </div>

              <p className={mt-4 text-sm sm:text-base leading-8 ${mainText}}>
                {book.description}
              </p>

              {payload?.book.publication && (
                <div className={mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] ${muted}}>
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
              <div className={p-12 text-center ${muted}}>
                جارٍ تجهيز الكتاب للقراءة...
              </div>
            ) : loadError ? (
              <div className="p-8 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                  <X size={24} />
                </div>
                <p className={mt-4 text-sm leading-6 ${mainText}}>
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
                      <p className={text-xs ${muted}}>
                        {(currentItem?.page
                          ? صفحة ${currentItem.page.toLocaleString('ar-EG')}
                          : الموضع ${(activeSection + 1).toLocaleString('ar-EG')})}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void copyCurrent()}
                      className={inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                        darkMode
                          ? 'border-white/10 text-white'
                          : 'border-mushaf-teal/15 text-mushaf-teal'
                      }}
                    >
                      {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                      {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>

                  <div className={rounded-[28px] px-6 sm:px-10 py-8 sm:py-12 border ${
                    darkMode
                      ? 'bg-[#111715] border-white/10'
                      : 'bg-[#FFFDF8] border-mushaf-gold/15'
                  }}>
                    {currentItem?.section && (
                      <h2 className={text-center font-black text-lg sm:text-xl ${mainText}}>
                        {currentItem.section}
                      </h2>
                    )}

                    <p
                      className={mt-7 whitespace-pre-wrap leading-[2.35] sm:leading-[2.5] text-center ${
                        darkMode ? 'text-[#F4EFE2]' : 'text-[#27231D]'
                      }}
                      style={{ fontSize: ${1.25 * fontScale}rem }}
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

                    <span className={text-xs font-bold ${muted}}>
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
                <div className={rounded-[28px] p-6 ${darkMode ? 'bg-white/5' : 'bg-mushaf-paper'}}>
                  <div className="flex items-center gap-2 text-mushaf-teal font-black text-sm">
                    <BookOpen size={19} />
                    المصدر النصي غير متاح حاليًا داخل API
                  </div>
                  <p className={mt-3 text-sm leading-7 ${muted}}>
                    الكتاب موجود في مكتبة مصحف سميع، لكن مصدره الحالي لا يوفر
                    محتوى نصيًا موحدًا يمكن دمجه داخل القارئ بدون نسخ المحتوى
                    أو تجاوز شروط المصدر. استخدم المصدر الأصلي من الزر التالي.
                  </p>

                  {payload?.message && (
                    <p className={mt-3 text-xs leading-6 ${muted}}>
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
              <div className={rounded-[24px] p-5 ${darkMode ? 'bg-white/5' : 'bg-mushaf-paper'}}>
                <div className={flex items-center gap-2 text-sm font-black ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
                  <GraduationCap size={18} />
                  الشرح
                </div>
                <p className={mt-3 text-sm leading-7 ${mainText}}>
                  {book.sharhTitle || 'لم يتم تسجيل شرح مستقل لهذا الكتاب بعد.'}
                  {book.sharhAuthor ?  — ${book.sharhAuthor} : ''}
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
                <div className={flex items-center gap-2 text-sm font-black ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
                  <Bookmark size={18} />
                  ملاحظاتك
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="دوّن الفوائد أو الملاحظات هنا..."
                  className={mt-3 w-full min-h-[120px] rounded-2xl border px-4 py-3 text-sm leading-7 outline-none ${
                    darkMode
                      ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                      : 'bg-mushaf-paper border-gray-200 text-mushaf-dark'
                  }}
                />
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/islamic-library"
            className={inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode ? 'border-white/10 text-white' : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }}
          >
            <Home size={15} />
            المكتبة الشرعية
          </Link>

          <Link
            href="/"
            className={inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode ? 'border-white/10 text-white' : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }}
          >
            الرئيسية
            <Home size={15} />
          </Link>
        </div>
      </div>
    </main>
  )
}
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
          /api/islamic-library/book/${encodeURIComponent(currentBook.id)},
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
        localStorage.getItem(${READING_KEY_PREFIX}${currentBook.id}) || '{}'
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
        ${READING_KEY_PREFIX}${book.id},
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
    <main dir="rtl" className={min-h-screen ${surface} pb-32}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/islamic-library"
              className={w-11 h-11 rounded-2xl ${card} border shadow-sm flex items-center justify-center ${mainText}}
              aria-label="العودة للمكتبة"
            >
              <ArrowRight size={20} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-mushaf-teal text-xs font-black">
                <BookOpen size={17} />
                {category?.label || 'المكتبة الشرعية'}
              </div>
              <h1 className={mt-1 text-xl sm:text-2xl font-black ${mainText}}>
                {book.title}
              </h1>
              <p className={mt-1 text-xs sm:text-sm ${muted}}>
                {book.author}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFontScale((v) => Math.max(0.85, Number((v - 0.05).toFixed(2))))}
              className={h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}}
              title="تصغير الخط"
            >
              <Minus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setFontScale((v) => Math.min(1.45, Number((v + 0.05).toFixed(2))))}
              className={h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}}
              title="تكبير الخط"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              className={inline-flex items-center gap-2 h-11 px-4 rounded-xl ${card} border text-xs font-black ${mainText}}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              {darkMode ? 'نهاري' : 'ليلي'}
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              className={inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs font-black ${
                saved
                  ? 'bg-mushaf-gold text-white border-mushaf-gold'
                  : ${card} ${mainText}
              }}
            >
              {saved ? <Check size={17} /> : <Bookmark size={17} />}
              {saved ? 'محفوظ' : 'حفظ'}
            </button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5">
          <aside className="space-y-5">
            <section className={rounded-[28px] border shadow-sm p-5 ${card}}>
              <div className={flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
                <List size={18} />
                فهرس القراءة
              </div>

              <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2">
                {(contents.length ? contents : [{ text: book.description, section: 'نبذة عن الكتاب' }]).map((item, index) => {
                  const active = index === activeSection
                  return (
                    <button
                      key={${item.page || 'x'}-${index}}
                      type="button"
                      onClick={() => {
                        setActiveSection(index)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={w-full text-right rounded-2xl px-3 py-3 text-xs leading-5 transition border ${
                        active
                          ? 'bg-mushaf-teal text-white border-mushaf-teal'
                          : ${darkMode ? 'bg-white/5 text-white/75 border-white/10' : 'bg-mushaf-paper text-gray-700 border-gray-100 hover:border-mushaf-teal/20'}
                      }}
                    >
                      <div className="font-black">
                        {item.section || موضع ${index + 1}}
                      </div>
                      {item.page ? (
                        <div className={mt-1 text-[10px] ${active ? 'text-white/65' : muted}}>
                          الصفحة {item.page.toLocaleString('ar-EG')}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className={rounded-[28px] border shadow-sm p-5 ${card}}>
              <div className={flex items-center gap-2 font-black text-sm ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
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
                className={mt-4 w-full h-11 rounded-xl border px-3 text-sm outline-none ${
                  darkMode
                    ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                    : 'bg-mushaf-paper text-mushaf-dark border-gray-200'
                }}
              />

              <p className={mt-3 text-[11px] leading-5 ${muted}}>
                {filteredContents.length.toLocaleString('ar-EG')} موضع متاح في نتيجة البحث.
              </p>
            </section>
          </aside>

          <article className={rounded-[32px] border shadow-sm overflow-hidden ${card}}>
            <div className="p-5 sm:p-7 border-b border-current/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5 text-[11px] font-black">
                  {book.level}
                </span>
                <span className={text-xs font-bold ${muted}}>
                  {category?.short || 'مادة شرعية'}
                </span>
                {payload?.source === 'quranpedia' && (
                  <span className="rounded-full bg-mushaf-teal/10 text-mushaf-teal px-3 py-1.5 text-[11px] font-black">
                    قراءة نصية داخل التطبيق
                  </span>
                )}
              </div>

              <p className={mt-4 text-sm sm:text-base leading-8 ${mainText}}>
                {book.description}
              </p>

              {payload?.book.publication && (
                <div className={mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] ${muted}}>
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
              <div className={p-12 text-center ${muted}}>
                جارٍ تجهيز الكتاب للقراءة...
              </div>
            ) : loadError ? (
              <div className="p-8 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                  <X size={24} />
                </div>
                <p className={mt-4 text-sm leading-6 ${mainText}}>
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
                      <p className={text-xs ${muted}}>
                        {(currentItem?.page
                          ? صفحة ${currentItem.page.toLocaleString('ar-EG')}
                          : الموضع ${(activeSection + 1).toLocaleString('ar-EG')})}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void copyCurrent()}
                      className={inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                        darkMode
                          ? 'border-white/10 text-white'
                          : 'border-mushaf-teal/15 text-mushaf-teal'
                      }}
                    >
                      {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                      {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>

                  <div className={rounded-[28px] px-6 sm:px-10 py-8 sm:py-12 border ${
                    darkMode
                      ? 'bg-[#111715] border-white/10'
                      : 'bg-[#FFFDF8] border-mushaf-gold/15'
                  }}>
                    {currentItem?.section && (
                      <h2 className={text-center font-black text-lg sm:text-xl ${mainText}}>
                        {currentItem.section}
                      </h2>
                    )}

                    <p
                      className={mt-7 whitespace-pre-wrap leading-[2.35] sm:leading-[2.5] text-center ${
                        darkMode ? 'text-[#F4EFE2]' : 'text-[#27231D]'
                      }}
                      style={{ fontSize: ${1.25 * fontScale}rem }}
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

                    <span className={text-xs font-bold ${muted}}>
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
                <div className={rounded-[28px] p-6 ${darkMode ? 'bg-white/5' : 'bg-mushaf-paper'}}>
                  <div className="flex items-center gap-2 text-mushaf-teal font-black text-sm">
                    <BookOpen size={19} />
                    المصدر النصي غير متاح حاليًا داخل API
                  </div>
                  <p className={mt-3 text-sm leading-7 ${muted}}>
                    الكتاب موجود في مكتبة مصحف سميع، لكن مصدره الحالي لا يوفر
                    محتوى نصيًا موحدًا يمكن دمجه داخل القارئ بدون نسخ المحتوى
                    أو تجاوز شروط المصدر. استخدم المصدر الأصلي من الزر التالي.
                  </p>

                  {payload?.message && (
                    <p className={mt-3 text-xs leading-6 ${muted}}>
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
              <div className={rounded-[24px] p-5 ${darkMode ? 'bg-white/5' : 'bg-mushaf-paper'}}>
                <div className={flex items-center gap-2 text-sm font-black ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
                  <GraduationCap size={18} />
                  الشرح
                </div>
                <p className={mt-3 text-sm leading-7 ${mainText}}>
                  {book.sharhTitle || 'لم يتم تسجيل شرح مستقل لهذا الكتاب بعد.'}
                  {book.sharhAuthor ?  — ${book.sharhAuthor} : ''}
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
                <div className={flex items-center gap-2 text-sm font-black ${darkMode ? 'text-mushaf-gold' : 'text-mushaf-teal'}}>
                  <Bookmark size={18} />
                  ملاحظاتك
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="دوّن الفوائد أو الملاحظات هنا..."
                  className={mt-3 w-full min-h-[120px] rounded-2xl border px-4 py-3 text-sm leading-7 outline-none ${
                    darkMode
                      ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                      : 'bg-mushaf-paper border-gray-200 text-mushaf-dark'
                  }}
                />
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/islamic-library"
            className={inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode ? 'border-white/10 text-white' : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }}
          >
            <Home size={15} />
            المكتبة الشرعية
          </Link>

          <Link
            href="/"
            className={inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode ? 'border-white/10 text-white' : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }}
          >
            الرئيسية
            <Home size={15} />
          </Link>
        </div>
      </div>
    </main>
  )
}
import { NextRequest, NextResponse } from 'next/server'
import {
  SUNNI_LIBRARY_BOOKS,
  type SunniLibraryBook,
} from '@/lib/islamic/sunniLibrary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QURANPEDIA_BASE = 'https://api.quranpedia.net/v1'

function getQuranpediaId(book: SunniLibraryBook): number | null {
  if (Number.isFinite(book.quranpediaBookId)) {
    return Number(book.quranpediaBookId)
  }

  const candidates = [
    book.readingUrl || '',
    book.sharhUrl || '',
  ]

  for (const url of candidates) {
    const match = url.match(/quranpedia\.net\/book\/(\d+)/i)
    if (match) return Number(match[1])
  }

  return null
}

function collectText(value: unknown, output: Array<{ text: string; page?: number; part?: number; section?: string }>, context: { page?: number; part?: number; section?: string } = {}) {
  if (!value) return

  if (typeof value === 'string') {
    const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) output.push({ text, ...context })
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output, context)
    return
  }

  if (typeof value !== 'object') return

  const obj = value as Record<string, unknown>
  const next = {
    page: Number.isFinite(Number(obj.page)) && Number(obj.page) > 0 ? Number(obj.page) : context.page,
    part: Number.isFinite(Number(obj.part)) && Number(obj.part) > 0 ? Number(obj.part) : context.part,
    section:
      typeof obj.title === 'string'
        ? obj.title
        : typeof obj.section === 'string'
          ? obj.section
          : context.section,
  }

  const directKeys = ['text', 'content', 'body', 'description']
  for (const key of directKeys) {
    if (typeof obj[key] === 'string') {
      collectText(obj[key], output, next)
    }
  }

  for (const [key, child] of Object.entries(obj)) {
    if (directKeys.includes(key)) continue
    if (
      key === 'book' ||
      key === 'author' ||
      key === 'metadata' ||
      key === 'language' ||
      key === 'category'
    ) {
      continue
    }
    if (typeof child === 'object' && child !== null) {
      collectText(child, output, next)
    }
  }
}

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(HTTP ${response.status})
  }
  return response.json()
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const bookId = decodeURIComponent(context.params.id || '')
    const book = SUNNI_LIBRARY_BOOKS.find((item) => item.id === bookId)

    if (!book) {
      return NextResponse.json(
        { success: false, error: 'BOOK_NOT_FOUND' },
        { status: 404 }
      )
    }

    const quranpediaId = getQuranpediaId(book)

    if (!quranpediaId) {
      return NextResponse.json({
        success: true,
        source: 'external',
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          category: book.category,
          level: book.level,
          description: book.description,
          readingUrl: book.readingUrl || null,
          sharhUrl: book.sharhUrl || null,
          sharhTitle: book.sharhTitle || null,
          sharhAuthor: book.sharhAuthor || null,
        },
        message:
          'هذا الكتاب لا يملك حاليًا مصدرًا نصيًا موحدًا داخل API التطبيق، لذلك يُستخدم مصدر القراءة الأصلي.',
      })
    }

    const meta = await fetchJson(
      ${QURANPEDIA_BASE}/book/${quranpediaId},
      controller.signal
    )

    let rawContents: unknown = null
    const contentsUrl =
      typeof meta?.contents_url === 'string'
        ? meta.contents_url
        : ''

    if (contentsUrl) {
      try {
        rawContents = await fetchJson(contentsUrl, controller.signal)
      } catch {
        rawContents = null
      }
    }

    const sections: Array<{
      text: string
      page?: number
      part?: number
      section?: string
    }> = []

    collectText(rawContents ?? meta?.about ?? '', sections)

    const deduped = sections.filter((item, index) => {
      if (!item.text) return false
      const previous = sections[index - 1]
      return !previous || previous.text !== item.text || previous.page !== item.page
    })

    return NextResponse.json({
      success: true,
      source: 'quranpedia',
      quranpediaBookId: quranpediaId,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        level: book.level,
        description: book.description,
        readingUrl: book.readingUrl || null,
        sharhUrl: book.sharhUrl || null,
        sharhTitle: book.sharhTitle || null,
        sharhAuthor: book.sharhAuthor || null,
        publication: {
          publishYear: meta?.publish_year ?? null,
          edition: meta?.edition ?? null,
          publisher: meta?.nasher ?? null,
          parts: meta?.parts ?? null,
        },
      },
      contents: deduped,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'TIMEOUT'
            : 'LOAD_FAILED',
      },
      { status: 500 }
    )
  } finally {
    clearTimeout(timer)
  }
}
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Book,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  Database,
  Eye,
  FileText,
  Headphones,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import AdminGate from '@/components/AdminGate'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'


type Tab =
  | 'dashboard'
  | 'users'
  | 'messages'
  | 'content'
  | 'notifications'
  | 'activity'
  | 'settings'

type FirestoreUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  progress: number
  khatmaDays?: number
  khatmaStartDate?: string
  createdAt?: unknown
  lastLoginAt?: unknown
  updatedAt?: unknown
  lastReadPage?: number
  lastReadSurahName?: string
  lastReadJuz?: number
  lastReadReciterName?: string
  extraFields?: Array<{ key: string; value: string }>
}

type Conversation = {
  id: string
  userId: string
  userName: string
  userEmail: string
  lastMessage: string
  updatedAt?: Timestamp | null
  lastSenderId?: string
  unreadForAdmin?: boolean
}

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt?: Timestamp | null
  read?: boolean
}

const demoRecentActivity = [
  { user: 'النظام', action: 'لوحة الإدارة متصلة بـ Firestore', time: 'مباشر' },
  { user: '—', action: 'سيظهر النشاط الفعلي مع إضافة سجلات النشاط', time: '—' },
]

function valueToMillis(value: unknown) {
  if (!value) return 0

  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function formatDate(value: unknown, withTime = true) {
  const millis = valueToMillis(value)
  if (!millis) return 'غير متوفر'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(millis))
}

function formatMessageTime(value: unknown) {
  const millis = valueToMillis(value)
  if (!millis) return 'الآن'

  return new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(millis))
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function AdminDashboard() {
  const { user: authUser, profile, loading: authLoading, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<FirestoreUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null)
  const [refreshingUsers, setRefreshingUsers] = useState(false)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationError, setConversationError] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')

  const adminName = profile?.name?.trim() || authUser?.displayName?.trim() || 'إدارة مصحف سميع'

  const loadUsers = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setRefreshingUsers(true)
      } else {
        setLoadingUsers(true)
      }

      setUsersError('')
      const snapshot = await getDocs(collection(db, 'users'))

      const nextUsers: FirestoreUser[] = snapshot.docs
        .map((item) => {
          const data = item.data() as Record<string, unknown>
          const lastReadPage =
            typeof data.lastReadPage === 'number' ? data.lastReadPage : 0
          const progress = Math.max(
            0,
            Math.min(100, Math.round((lastReadPage / 604) * 100)),
          )

          const rawEmail = normalizeText(data.email)
          const rawName =
            normalizeText(data.name) ||
            normalizeText(data.displayName) ||
            rawEmail ||
            مستخدم ${item.id.slice(0, 6)}

          return {
            id: item.id,
            name: rawName,
            email: rawEmail || 'البريد غير محفوظ',
            role: normalizeText(data.role, 'user'),
            status:
              normalizeText(data.status).toLowerCase() === 'inactive' ||
              data.disabled === true
                ? 'غير نشط'
                : 'نشط',
            progress,
            khatmaDays:
              typeof data.khatmaDays === 'number'
                ? data.khatmaDays
                : undefined,
            khatmaStartDate:
              typeof data.khatmaStartDate === 'string'
                ? data.khatmaStartDate
                : undefined,
            createdAt: data.createdAt,
            lastLoginAt: data.lastLoginAt,
            updatedAt: data.updatedAt ?? data.createdAt,
            lastReadPage:
              typeof data.lastReadPage === 'number' ? data.lastReadPage : undefined,
            lastReadSurahName: normalizeText(data.lastReadSurahName),
            lastReadJuz:
              typeof data.lastReadJuz === 'number' ? data.lastReadJuz : undefined,
            lastReadReciterName: normalizeText(data.lastReadReciterName),
            extraFields: Object.entries(data)
              .filter(([key]) =>
                ![
                  'name',
                  'displayName',
                  'email',
                  'role',
                  'status',
                  'disabled',
                  'khatmaDays',
                  'khatmaStartDate',
                  'createdAt',
                  'lastLoginAt',
                  'updatedAt',
                  'lastReadPage',
                  'lastReadSurahName',
                  'lastReadJuz',
                  'lastReadReciterName',
                  'lastReadRiwayaId',
                  'lastReadSurahNumber',
                  'lastReadAyahKey',
                  'lastReadAyahNumber',
                  'lastReadReciterId',
                ].includes(key) &&
                !/(password|token|secret|apikey)/i.test(key),
              )
              .map(([key, value]) => ({
                key,
                value:
                  typeof value === 'string'
                    ? value
                    : typeof value === 'number' || typeof value === 'boolean'
                      ? String(value)
                      : value && typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value ?? ''),
              }))
              .filter((item) => item.value.length > 0)
              .map((item) => ({
                ...item,
                value: item.value.length > 500 ? ${item.value.slice(0, 500)}… : item.value,
              })),
          }
        })
        .sort((a, b) => valueToMillis(b.createdAt) - valueToMillis(a.createdAt))

      setUsers(nextUsers)
    } catch (error) {
      console.error('Load users error:', error)
      setUsersError(
        'تعذر تحميل المستخدمين من Firestore. تأكد من نشر قواعد Firestore الجديدة.',
      )
    } finally {
      setLoadingUsers(false)
      setRefreshingUsers(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !authUser || !isAdmin) return
    void loadUsers()
  }, [authLoading, authUser, isAdmin, loadUsers])

  useEffect(() => {
    if (authLoading || !authUser || !isAdmin) return

    setConversationsLoading(true)
    setConversationError('')

    const unsubscribe = onSnapshot(
      collection(db, 'conversations'),
      (snapshot) => {
        const nextConversations: Conversation[] = snapshot.docs
          .map((item) => {
            const data = item.data() as Record<string, unknown>

            return {
              id: item.id,
              userId:
                typeof data.userId === 'string' ? data.userId : item.id,
              userName:
                normalizeText(data.userName) || 'مستخدم مصحف سميع',
              userEmail: normalizeText(data.userEmail),
              lastMessage: normalizeText(data.lastMessage),
              updatedAt: (data.updatedAt as Timestamp | null | undefined) ?? null,
              lastSenderId: normalizeText(data.lastSenderId),
              unreadForAdmin: data.unreadForAdmin === true,
            }
          })
          .sort(
            (a, b) => valueToMillis(b.updatedAt) - valueToMillis(a.updatedAt),
          )

        setConversations(nextConversations)
        setConversationsLoading(false)
      },
      (error) => {
        console.error('Conversations listener error:', error)
        setConversationError(
          'تعذر تحميل المحادثات. تأكد من نشر قواعد Firestore الخاصة بالمراسلة.',
        )
        setConversationsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [authLoading, authUser, isAdmin])

  useEffect(() => {
    if (!selectedConversationId || !authUser || !isAdmin) {
      setMessages([])
      setMessagesLoading(false)
      return
    }

    setMessagesLoading(true)
    setConversationError('')

    const messagesRef = collection(
      db,
      'conversations',
      selectedConversationId,
      'messages',
    )
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'))

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages: ChatMessage[] = snapshot.docs.map((item) => {
          const data = item.data() as Record<string, unknown>

          return {
            id: item.id,
            senderId: normalizeText(data.senderId),
            senderName: normalizeText(data.senderName) || 'مستخدم مصحف سميع',
            text: normalizeText(data.text),
            createdAt:
              (data.createdAt as Timestamp | null | undefined) ?? null,
            read: data.read === true,
          }
        })

        nextMessages.sort(
          (a, b) => valueToMillis(a.createdAt) - valueToMillis(b.createdAt),
        )

        setMessages(nextMessages)
        setMessagesLoading(false)

        const unread = nextMessages.filter(
          (message) => message.senderId !== authUser.uid && message.read !== true,
        )

        if (unread.length > 0) {
          const batch = writeBatch(db)
          unread.forEach((message) => {
            batch.update(doc(messagesRef, message.id), { read: true })
          })

          void batch.commit().catch((error) => {
            console.error('Mark admin messages read error:', error)
          })
        }

        void updateDoc(doc(db, 'conversations', selectedConversationId), {
          unreadForAdmin: false,
        }).catch((error) => {
          console.warn('Conversation read state update failed:', error)
        })
      },
      (error) => {
        console.error('Chat listener error:', error)
        setMessages([])
        setMessagesLoading(false)
        setConversationError(
          'تعذر تحميل رسائل هذه المحادثة. تحقق من قواعد Firestore.',
        )
      },
    )

    return () => unsubscribe()
  }, [authUser, isAdmin, selectedConversationId])

  const filteredUsers = useMemo(() => {
    const queryText = search.trim().toLowerCase()

    if (!queryText) return users

    return users.filter(
      (item) =>
        item.name.toLowerCase().includes(queryText) ||
        item.email.toLowerCase().includes(queryText) ||
        item.id.toLowerCase().includes(queryText),
    )
  }, [search, users])

  const filteredConversations = useMemo(() => {
    const queryText = messageSearch.trim().toLowerCase()

    if (!queryText) return conversations

    return conversations.filter(
      (item) =>
        item.userName.toLowerCase().includes(queryText) ||
        item.userEmail.toLowerCase().includes(queryText) ||
        item.lastMessage.toLowerCase().includes(queryText),
    )
  }, [conversations, messageSearch])

  const selectedConversation = useMemo(
    () =>
      conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  const selectedConversationUser = useMemo(() => {
    if (!selectedConversation) return null

    return (
      users.find((item) => item.id === selectedConversation.userId) ?? {
        id: selectedConversation.userId,
        name: selectedConversation.userName,
        email: selectedConversation.userEmail || 'البريد غير محفوظ',
        role: 'user',
        status: 'نشط',
        progress: 0,
      }
    )
  }, [selectedConversation, users])

  const openConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    setActiveTab('messages')
    setMessageDraft('')
    setSidebarOpen(false)
  }

  const openUserConversation = (userItem: FirestoreUser) => {
    setSelectedUser(null)
    setSelectedConversationId(userItem.id)
    setActiveTab('messages')
    setMessageDraft('')
    setSidebarOpen(false)
  }

  const sendAdminMessage = async () => {
    const text = messageDraft.trim()

    if (!authUser || !selectedConversationId || !text || sendingMessage) return

    if (text.length > 5000) {
      setConversationError('الرسالة طويلة جدًا. الحد الأقصى 5000 حرف.')
      return
    }

    setSendingMessage(true)
    setConversationError('')

    try {
      const conversationRef = doc(db, 'conversations', selectedConversationId)
      const messagesRef = collection(conversationRef, 'messages')

      const targetUser = selectedConversationUser

      await setDoc(
        conversationRef,
        {
          userId: selectedConversationId,
          userName: targetUser?.name || selectedConversation?.userName || 'مستخدم مصحف سميع',
          userEmail: targetUser?.email || selectedConversation?.userEmail || '',
          lastMessage: text,
          lastSenderId: authUser.uid,
          updatedAt: serverTimestamp(),
          unreadForAdmin: false,
          unreadForUser: true,
        },
        { merge: true },
      )

      await addDoc(messagesRef, {
        senderId: authUser.uid,
        senderName: adminName,
        text,
        createdAt: serverTimestamp(),
        read: false,
      })

      setMessageDraft('')
    } catch (error) {
      console.error('Send admin message error:', error)
      setConversationError(
        'تعذر إرسال الرد. تحقق من الاتصال وصلاحيات Firestore.',
      )
    } finally {
      setSendingMessage(false)
    }
  }

  const handleAdminMessageSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    await sendAdminMessage()
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      window.location.href = '/auth'
    } catch (error) {
      console.error('Admin logout error:', error)
    }
  }

  const menuItems = [
    { id: 'dashboard' as const, label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'users' as const, label: 'المستخدمون', icon: Users },
    { id: 'messages' as const, label: 'الرسائل', icon: MessageSquare },
    { id: 'content' as const, label: 'محتوى التطبيق', icon: Database },
    { id: 'notifications' as const, label: 'الإشعارات', icon: Bell },
    { id: 'activity' as const, label: 'النشاطات', icon: Activity },
    { id: 'settings' as const, label: 'الإعدادات', icon: Settings },
  ]

  const unreadConversationsCount = conversations.filter(
    (item) => item.unreadForAdmin,
  ).length

  const khatmaUsersCount = users.filter(
    (item) => item.khatmaDays && item.khatmaDays > 0,
  ).length

  const stats = [
    {
      label: 'إجمالي المستخدمين',
      value: loadingUsers ? '…' : users.length.toLocaleString('ar-EG'),
      icon: Users,
      note: 'من Firestore',
    },
    {
      label: 'خطط الختمة',
      value: loadingUsers ? '…' : khatmaUsersCount.toLocaleString('ar-EG'),
      icon: BookOpen,
      note: 'مستخدم لديه خطة',
    },
    {
      label: 'المحادثات',
      value: conversationsLoading
        ? '…'
        : conversations.length.toLocaleString('ar-EG'),
      icon: MessageSquare,
      note: ${unreadConversationsCount.toLocaleString('ar-EG')} غير مقروءة,
    },
    {
      label: 'الرسائل الواردة',
      value: conversationsLoading ? '…' : 'مباشر',
      icon: MessageCircle,
      note: 'مزامنة لحظية',
    },
  ]

  const renderDashboard = () => (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#075640]/10">
                  <Icon size={22} className="text-[#075640]" />
                </div>
                <span className="text-[11px] font-bold text-gray-400">
                  {item.note}
                </span>
              </div>

              <p className="text-2xl font-black text-gray-900">{item.value}</p>
              <p className="mt-1 text-xs text-gray-500">{item.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">آخر المحادثات</h2>
              <p className="mt-1 text-xs text-gray-400">
                افتح أي محادثة للقراءة والرد مباشرة.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className="text-xs font-bold text-[#075640] hover:underline"
            >
              عرض الرسائل
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm font-bold text-gray-400">
              لا توجد محادثات حتى الآن.
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.slice(0, 5).map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 text-right transition hover:bg-gray-100"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-100">
                      <MessageCircle size={18} className="text-[#075640]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {conversation.userName}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {conversation.lastMessage || 'محادثة جديدة'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-left">
                    <span className="text-[10px] text-gray-400">
                      {formatMessageTime(conversation.updatedAt)}
                    </span>
                    {conversation.unreadForAdmin && (
                      <span className="mx-auto mt-1 block h-2.5 w-2.5 rounded-full bg-[#075640]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-[#075640] p-6 text-white shadow-sm">
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -right-14 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative z-10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck size={24} />
            </div>

            <h2 className="text-xl font-black">مساحة الإدارة</h2>
            <p className="mt-2 text-sm leading-7 text-white/75">
              تابع الحسابات والمحادثات والمحتوى من مكان واحد، مع حماية صلاحيات Firestore.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="w-full rounded-2xl bg-white py-3 font-black text-sm text-[#075640]"
              >
                إدارة المستخدمين
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 font-black text-sm"
              >
                فتح صندوق الرسائل
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  )

  const renderUsers = () => (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-gray-900">المستخدمون</h2>
          <p className="mt-1 text-xs text-gray-400">
            الاسم والبريد والرتبة والحالة وتاريخ التسجيل وآخر دخول والتقدم المحفوظ.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => void loadUsers(true)}
            disabled={refreshingUsers}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#075640] px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshingUsers ? 'animate-spin' : ''} />
            {refreshingUsers ? 'جاري التحديث...' : 'تحديث'}
          </button>

          <div className="relative w-full sm:w-80">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو البريد أو UID..."
              className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-4 pr-10 text-sm outline-none focus:border-[#075640]"
            />
          </div>
        </div>
      </div>

      {usersError && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {usersError}
        </div>
      )}

      {loadingUsers && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          جارٍ تحميل المستخدمين...
        </div>
      )}

      {!loadingUsers && !usersError && users.length === 0 && (
        <div className="mb-4 rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm font-bold text-gray-500">
          لا توجد مستندات مستخدمين في مجموعة users حتى الآن.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px]">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="pb-3 font-bold">المستخدم</th>
              <th className="pb-3 font-bold">الدور</th>
              <th className="pb-3 font-bold">التسجيل</th>
              <th className="pb-3 font-bold">آخر دخول</th>
              <th className="pb-3 font-bold">التقدم</th>
              <th className="pb-3 font-bold">الإجراء</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((userItem) => (
              <tr key={userItem.id} className="border-b border-gray-50 last:border-0">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#075640]/10">
                      <UserRound size={18} className="text-[#075640]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {userItem.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-400" dir="ltr">
                        {userItem.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="py-4">
                  <span
                    className={inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                      userItem.role === 'admin'
                        ? 'bg-[#c6a15a]/15 text-[#9d7d41]'
                        : 'bg-slate-100 text-slate-600'
                    }}
                  >
                    {userItem.role === 'admin' ? 'أدمن' : 'مستخدم'}
                  </span>
                </td>

                <td className="py-4 text-xs font-bold text-gray-500">
                  {formatDate(userItem.createdAt, false)}
                </td>

                <td className="py-4 text-xs font-bold text-gray-500">
                  {formatDate(userItem.lastLoginAt, true)}
                </td>

                <td className="py-4">
                  <div className="w-36">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">المصحف</span>
                      <span className="font-bold text-[#075640]">
                        {userItem.progress}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#075640]"
                        style={{ width: ${userItem.progress}% }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(userItem)}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-[#075640] hover:text-[#075640]"
                    >
                      <Eye size={14} />
                      البيانات
                    </button>

                    {userItem.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => openUserConversation(userItem)}
                        className="flex items-center gap-2 rounded-xl bg-[#075640] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#064b39]"
                      >
                        <MessageCircle size={14} />
                        رسالة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && !loadingUsers && (
          <div className="py-12 text-center text-sm text-gray-400">
            لا توجد نتائج مطابقة للبحث.
          </div>
        )}
      </div>
    </section>
  )

  const renderMessages = () => (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-gray-100 bg-slate-50 lg:border-b-0 lg:border-l">
          <div className="border-b border-gray-100 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-gray-900">المحادثات</h2>
                <p className="mt-1 text-[11px] text-gray-400">
                  {conversations.length.toLocaleString('ar-EG')} محادثة
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#075640]/10">
                <MessageSquare size={18} className="text-[#075640]" />
              </div>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="ابحث في المحادثات..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-9 text-xs outline-none focus:border-[#075640]"
              />
            </div>
          </div>

          <div className="max-h-[540px] overflow-y-auto p-2 lg:max-h-[570px]">
            {conversationsLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                جاري تحميل المحادثات...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold leading-6 text-gray-400">
                لا توجد محادثات مطابقة.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = selectedConversationId === conversation.id

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className={mb-1 w-full rounded-2xl p-3 text-right transition ${
                      active ? 'bg-[#075640] text-white' : 'hover:bg-white'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          active ? 'bg-white/10' : 'bg-white border border-gray-100'
                        }}
                      >
                        <UserRound
                          size={18}
                          className={active ? 'text-white' : 'text-[#075640]'}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-black">
                            {conversation.userName}
                          </p>
                          <span
                            className={shrink-0 text-[9px] ${
                              active ? 'text-white/60' : 'text-gray-400'
                            }}
                          >
                            {formatMessageTime(conversation.updatedAt)}
                          </span>
                        </div>
                        <p
                          className={mt-1 truncate text-[10px] ${
                            active ? 'text-white/70' : 'text-gray-400'
                          }}
                        >
                          {conversation.lastMessage || 'محادثة جديدة'}
                        </p>
                      </div>

                      {conversation.unreadForAdmin && !active && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#075640]" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="flex min-h-[620px] min-w-0 flex-col bg-[#f7fafc]">
          {selectedConversationId ? (
            <>
              <header className="flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#075640] text-white">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-gray-900 sm:text-base">
                      {selectedConversationUser?.name || 'مستخدم مصحف سميع'}
                    </h3>
                    <p className="mt-1 truncate text-[10px] text-gray-400" dir="ltr">
                      {selectedConversationUser?.email || selectedConversation?.userEmail || 'البريد غير محفوظ'}
                    </p>
                  </div>
                </div>

                <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-600 sm:inline-flex">
                  محادثة نصية
                </span>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {messagesLoading ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 text-xs font-bold text-gray-500 shadow-sm">
                      <Loader2 size={17} className="animate-spin text-[#075640]" />
                      جاري تحميل الرسائل...
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="max-w-sm rounded-3xl bg-white p-7 text-center shadow-sm border border-gray-100">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#075640]/10">
                        <MessageCircle size={25} className="text-[#075640]" />
                      </div>
                      <h4 className="text-lg font-black text-gray-900">لا توجد رسائل بعد</h4>
                      <p className="mt-2 text-xs leading-6 text-gray-400">
                        اكتب أول رد من أسفل الشاشة ليبدأ المستخدم المحادثة مع الإدارة.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-3">
                    {messages.map((message) => {
                      const mine = message.senderId === authUser?.uid

                      return (
                        <div
                          key={message.id}
                          className={flex ${mine ? 'justify-start' : 'justify-end'}}
                        >
                          <div
                            className={max-w-[88%] rounded-[22px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                              mine
                                ? 'rounded-tl-md bg-[#075640] text-white'
                                : 'rounded-tr-md border border-gray-100 bg-white text-gray-800'
                            }}
                          >
                            {!mine && (
                              <p className="mb-1.5 text-[10px] font-black text-[#075640]">
                                {message.senderName || selectedConversationUser?.name}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words text-sm leading-7">
                              {message.text}
                            </p>

                            <div
                              className={mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                                mine ? 'text-white/60' : 'text-gray-400'
                              }}
                            >
                              <span>{formatMessageTime(message.createdAt)}</span>
                              {mine &&
                                (message.read ? (
                                  <CheckCheck size={13} />
                                ) : (
                                  <Check size={13} />
                                ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {conversationError && (
                <div className="px-4 pb-2 sm:px-5">
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2.5 text-center text-xs font-bold text-red-600">
                    {conversationError}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleAdminMessageSubmit}
                className="border-t border-gray-200 bg-white p-3 sm:p-4"
              >
                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-gray-200 bg-gray-50 p-2 focus-within:border-[#075640] focus-within:bg-white transition">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendAdminMessage()
                      }
                    }}
                    rows={1}
                    maxLength={5000}
                    placeholder="اكتب رد الإدارة..."
                    className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400"
                  />

                  <button
                    type="submit"
                    disabled={!messageDraft.trim() || sendingMessage}
                    aria-label="إرسال الرد"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#075640] text-white shadow-sm transition hover:bg-[#064b39] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {sendingMessage ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} className="-rotate-180" />
                    )}
                  </button>
                </div>
                <p className="mx-auto mt-2 max-w-3xl px-2 text-[10px] text-gray-400">
                  Enter للإرسال · Shift + Enter لسطر جديد · 5000 حرف كحد أقصى
                </p>
              </form>
            </>
          ) : (
            <div className="flex min-h-full flex-1 items-center justify-center p-6">
              <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm border border-gray-100">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#075640]/10">
                  <MessageSquare size={28} className="text-[#075640]" />
                </div>
                <h3 className="text-xl font-black text-gray-900">صندوق رسائل الإدارة</h3>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  اختر محادثة من القائمة لمشاهدة الرسائل والرد على المستخدم مباشرة.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const renderContent = () => (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[
        { title: 'المصحف', text: 'إدارة الأقسام المرتبطة بالقراءة والفهرس.', icon: BookOpen },
        { title: 'التلاوات', text: 'متابعة قسم الصوتيات والقراء.', icon: Headphones },
        { title: 'الأحاديث', text: 'إدارة واجهة مكتبة الأحاديث.', icon: FileText },
        { title: 'الأذكار', text: 'إدارة واجهات الأذكار والعدادات.', icon: Moon },
      ].map((item) => {
        const Icon = item.icon

        return (
          <div key={item.title} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#075640]/10">
              <Icon size={23} className="text-[#075640]" />
            </div>
            <h3 className="font-black text-gray-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-gray-500">{item.text}</p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500"
            >
              إدارة القسم
            </button>
          </div>
        )
      })}
    </section>
  )

  const renderNotifications = () => (
    <section className="max-w-3xl rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c6a15a]/15">
          <Bell size={21} className="text-[#c6a15a]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">الإشعارات</h2>
          <p className="mt-1 text-xs text-gray-400">واجهة تجهيز إشعار جديد</p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          placeholder="عنوان الإشعار"
          className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-[#075640]"
        />
        <textarea
          rows={5}
          placeholder="اكتب نص الإشعار هنا..."
          className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none focus:border-[#075640]"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-2xl bg-[#075640] py-3.5 text-sm font-black text-white"
          >
            تجهيز الإشعار
          </button>
          <button
            type="button"
            className="rounded-2xl border border-gray-200 px-5 py-3.5 text-sm font-black text-gray-500"
          >
            حفظ كمسودة
          </button>
        </div>
        <p className="rounded-2xl bg-gray-50 p-4 text-xs leading-6 text-gray-400">
          هذه الواجهة إدارية فقط؛ الإرسال الفعلي لـ Push Notifications يحتاج ربط خدمة الإشعارات المناسبة.
        </p>
      </div>
    </section>
  )

  const renderActivity = () => (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#075640]/10">
          <Activity size={21} className="text-[#075640]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">سجل النشاطات</h2>
          <p className="mt-1 text-xs text-gray-400">النشاطات الإدارية الحالية</p>
        </div>
      </div>

      <div className="space-y-2">
        {demoRecentActivity.map((item, index) => (
          <div
            key={${item.user}-${index}}
            className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white">
                <Activity size={17} className="text-[#c6a15a]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">{item.user}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{item.action}</p>
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-gray-400">{item.time}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const renderSettings = () => (
    <section className="max-w-3xl rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#075640]/10">
          <Settings size={21} className="text-[#075640]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">إعدادات المنصة</h2>
          <p className="mt-1 text-xs text-gray-400">إعدادات أساسية لواجهة الإدارة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">اسم المنصة</span>
          <input
            defaultValue="مصحف سَميع"
            className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold outline-none focus:border-[#075640]"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">الرسالة الترحيبية</span>
          <input
            defaultValue="السلام عليكم ورحمة الله"
            className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold outline-none focus:border-[#075640]"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-bold text-gray-500">وصف المنصة</span>
        <textarea
          rows={4}
          defaultValue="مساحة هادئة للقراءة والتدبر والاستماع."
          className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none focus:border-[#075640]"
        />
      </label>

      <button
        type="button"
        className="mt-5 rounded-2xl bg-[#075640] px-6 py-3.5 text-sm font-black text-white"
      >
        حفظ الإعدادات
      </button>
    </section>
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'users':
        return renderUsers()
      case 'messages':
        return renderMessages()
      case 'content':
        return renderContent()
      case 'notifications':
        return renderNotifications()
      case 'activity':
        return renderActivity()
      case 'settings':
        return renderSettings()
      case 'dashboard':
      default:
        return renderDashboard()
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" dir="rtl">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm font-bold text-gray-500 shadow-sm">
          <Loader2 size={18} className="animate-spin text-[#075640]" />
          جاري التحقق من صلاحيات الإدارة...
        </div>
      </div>
    )
  }

  if (!authUser || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6" dir="rtl">
        <div className="w-full max-w-md rounded-[30px] border border-gray-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <ShieldCheck size={30} className="text-red-500" />
          </div>
          <h1 className="text-xl font-black text-gray-900">غير مصرح بالدخول</h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            هذه الصفحة مخصصة لحسابات الإدارة فقط.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#075640] px-6 py-3.5 text-sm font-black text-white"
          >
            العودة للموقع
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={fixed bottom-0 right-0 top-0 z-50 w-[280px] bg-[#073f30] p-5 text-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white/50">لوحة الإدارة</p>
            <h1 className="mt-1 text-xl font-black">مصحف سَميع</h1>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = item.id === activeTab

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition ${
                  active
                    ? 'bg-white text-[#075640] shadow-sm'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }}
              >
                <Icon size={19} />
                <span className="flex-1 text-right">{item.label}</span>
                {item.id === 'messages' && unreadConversationsCount > 0 && (
                  <span
                    className={min-w-6 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black ${
                      active ? 'bg-[#075640] text-white' : 'bg-white text-[#075640]'
                    }}
                  >
                    {unreadConversationsCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 space-y-2">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            العودة للتطبيق
            <ChevronLeft size={15} />
          </Link>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:mr-[280px]">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-gray-50/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white text-[#075640] lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-400">الإدارة</p>
                <h2 className="truncate text-lg font-black text-gray-900">
                  {menuItems.find((item) => item.id === activeTab)?.label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 sm:flex">
                <ShieldCheck size={16} className="text-[#075640]" />
                <span className="text-xs font-bold text-gray-500">وضع الإدارة</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">{renderActiveTab()}</div>
      </main>

      {selectedUser && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-[#075640] p-6 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <UserRound size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white/60">بيانات المستخدم</p>
                    <h3 className="truncate text-xl font-black">{selectedUser.name}</h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">الاسم</p>
                  <p className="text-sm font-black text-gray-900">{selectedUser.name}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">البريد الإلكتروني</p>
                  <p className="break-all text-sm font-bold text-gray-900" dir="ltr">
                    {selectedUser.email}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">الدور</p>
                  <p className="text-sm font-black text-[#075640]">
                    {selectedUser.role === 'admin' ? 'أدمن' : 'مستخدم'}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">الحالة</p>
                  <p className="text-sm font-black text-[#075640]">{selectedUser.status}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">تاريخ التسجيل</p>
                  <p className="text-sm font-black text-gray-900">
                    {formatDate(selectedUser.createdAt, true)}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">آخر دخول</p>
                  <p className="text-sm font-black text-gray-900">
                    {formatDate(selectedUser.lastLoginAt, true)}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">تقدم المصحف</p>
                  <p className="text-sm font-black text-gray-900">{selectedUser.progress}%</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">خطة الختمة</p>
                  <p className="text-sm font-black text-gray-900">
                    {selectedUser.khatmaDays
                      ? ${selectedUser.khatmaDays} يوم
                      : 'لا توجد خطة'}
                  </p>
                </div>
              </div>

              {selectedUser.khatmaStartDate && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">بداية الختمة</p>
                  <p className="text-sm font-black text-gray-900" dir="ltr">
                    {selectedUser.khatmaStartDate}
                  </p>
                </div>
              )}

              {(selectedUser.lastReadPage ||
                selectedUser.lastReadSurahName ||
                selectedUser.lastReadJuz ||
                selectedUser.lastReadReciterName) && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="mb-3 text-xs font-bold text-gray-400">آخر بيانات القراءة</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {typeof selectedUser.lastReadPage === 'number' && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر صفحة</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadPage}</p>
                      </div>
                    )}
                    {selectedUser.lastReadSurahName && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر سورة</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadSurahName}</p>
                      </div>
                    )}
                    {typeof selectedUser.lastReadJuz === 'number' && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر جزء</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadJuz}</p>
                      </div>
                    )}
                    {selectedUser.lastReadReciterName && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر قارئ</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadReciterName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedUser.extraFields && selectedUser.extraFields.length > 0 && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="mb-3 text-xs font-bold text-gray-400">بيانات أخرى محفوظة</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedUser.extraFields.map((field) => (
                      <div key={field.key} className="rounded-xl bg-gray-50 p-3">
                        <p className="break-all text-[10px] font-bold text-gray-400" dir="ltr">{field.key}</p>
                        <p className="mt-1 break-words text-xs font-bold text-gray-800">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                <p className="mb-1 text-xs font-bold text-gray-400">UID</p>
                <p className="break-all text-xs font-bold text-gray-600" dir="ltr">
                  {selectedUser.id}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                {selectedUser.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => openUserConversation(selectedUser)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#075640] px-5 py-3.5 text-sm font-black text-white"
                  >
                    <MessageCircle size={17} />
                    فتح المحادثة
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-2xl border border-gray-200 px-5 py-3.5 text-sm font-black text-gray-500"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  )
}
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    // حساب الإدارة يحدد فقط من خلال users/{uid}.role = "admin".
    // لا نعتمد على الواجهة وحدها؛ هذه القاعدة هي خط الحماية الفعلي للبيانات.
    function isAdmin() {
      return signedIn()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function validMessageText() {
      return request.resource.data.text is string
        && request.resource.data.text.size() > 0
        && request.resource.data.text.size() <= 5000;
    }

    match /users/{userId} {

      // المستخدم يرى ملفه فقط، والأدمن يرى جميع المستخدمين.
      allow read: if signedIn() && (request.auth.uid == userId || isAdmin());

      // إنشاء الملف بعد إنشاء حساب Firebase Auth.
      // لا يمكن للمستخدم إنشاء نفسه كأدمن من الواجهة.
      allow create: if signedIn()
        && request.auth.uid == userId
        && request.resource.data.name is string
        && request.resource.data.name.size() >= 2
        && request.resource.data.name.size() <= 60
        && request.resource.data.email is string
        && (
          !request.resource.data.keys().hasAny(['role'])
          || request.resource.data.role == 'user'
        );

      // المستخدم يعدل بياناته دون القدرة على تغيير role.
      // الأدمن يستطيع إدارة أي ملف مستخدم.
      allow update: if isAdmin()
        || (
          signedIn()
          && request.auth.uid == userId
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])
        );

      // الحذف للإدارة فقط.
      allow delete: if isAdmin();
    }

    // محادثة واحدة لكل مستخدم، ويرتبط مفتاحها مباشرة بـ UID المستخدم.
    match /conversations/{userId} {

      // المستخدم لا يرى إلا محادثته. الأدمن يرى كل المحادثات.
      allow read: if signedIn() && (request.auth.uid == userId || isAdmin());

      // المستخدم ينشئ محادثته بنفس UID فقط.
      allow create: if signedIn()
        && request.auth.uid == userId
        && request.resource.data.userId == userId;

      // المستخدم يستطيع تحديث بيانات المحادثة الخاصة به، والأدمن يستطيع إدارتها.
      allow update: if isAdmin()
        || (
          signedIn()
          && request.auth.uid == userId
          && request.resource.data.userId == userId
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
            'userName',
            'userEmail',
            'lastMessage',
            'lastSenderId',
            'updatedAt',
            'unreadForAdmin',
            'unreadForUser'
          ])
        );

      allow delete: if isAdmin();

      match /messages/{messageId} {

        // المستخدم والأدمن يقرآن الرسائل داخل المحادثة المسموح بها فقط.
        allow read: if signedIn() && (request.auth.uid == userId || isAdmin());

        // المستخدم يرسل لنفس محادثته فقط، والأدمن يستطيع إرسال رد للمستخدم.
        allow create: if signedIn()
          && validMessageText()
          && request.resource.data.senderId == request.auth.uid
          && (
            request.auth.uid == userId
            || isAdmin()
          );

        // الرسالة نفسها لا يمكن تعديل نصها بعد الإرسال؛ التعديل الوحيد هو read.
        allow update: if signedIn()
          && (request.auth.uid == userId || isAdmin())
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);

        allow delete: if isAdmin();
      }
    }

    // بقية مجموعات Firestore مغلقة حتى نضيف لها صلاحية صريحة لاحقًا.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}


أيوه، هظبطها صح من هنا. الملف ده لوحده فقط، ولن أضع معه أي ملف آخر.

المسار:

app/islamic-library/book/[id]/page.tsx

استبدل محتوى الملف بالكامل بهذا الكود:

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
  Play,
  Video,
  Download,
  ChevronDown,
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

interface LearningVideo {
  id: string
  title: string
  url: string
  order?: number
}

interface ReaderPayload {
  source: 'quranpedia' | 'external' | 'firestore'
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

    downloadUrl?: string | null

    videos?: LearningVideo[]

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

function getYouTubeId(url: string) {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id || null
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const queryId = parsed.searchParams.get('v')

      if (queryId) {
        return queryId
      }

      const match = parsed.pathname.match(
        /\/(?:embed|shorts|live)\/([^/?#]+)/i,
      )

      return match?.[1] || null
    }

    return null
  } catch {
    return null
  }
}

function getVimeoId(url: string) {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (!host.includes('vimeo.com')) {
      return null
    }

    const match = parsed.pathname.match(/\/(?:video\/)?(\d+)/)

    return match?.[1] || null
  } catch {
    return null
  }
}

function getVideoEmbedUrl(url: string) {
  const youtubeId = getYouTubeId(url)

  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`
  }

  const vimeoId = getVimeoId(url)

  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`
  }

  return null
}

function isDirectVideoFile(url: string) {
  return /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url.trim())
}

export default function IslamicBookReaderPage() {
  const params = useParams<{ id: string }>()

  const rawId = params?.id || ''
  const bookId = decodeURIComponent(rawId)

  const book = useMemo(
    () =>
      SUNNI_LIBRARY_BOOKS.find(
        (item) => item.id === bookId,
      ) || null,
    [bookId],
  )

  const category = useMemo(
    () =>
      book
        ? SUNNI_LIBRARY_CATEGORIES.find(
            (item) => item.id === book.category,
          )
        : null,
    [book],
  )

  const [payload, setPayload] =
    useState<ReaderPayload | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState('')

  const [fontScale, setFontScale] =
    useState(1)

  const [darkMode, setDarkMode] =
    useState(false)

  const [saved, setSaved] =
    useState(false)

  const [query, setQuery] =
    useState('')

  const [activeSection, setActiveSection] =
    useState(0)

  const [notes, setNotes] =
    useState('')

  const [copied, setCopied] =
    useState(false)

  const [selectedVideoId, setSelectedVideoId] =
    useState('')

  const [showVideoList, setShowVideoList] =
    useState(true)

  useEffect(() => {
    if (!book) return

    let cancelled = false

    const currentBook = book

    async function load() {
      try {
        setLoading(true)
        setLoadError('')

        const response = await fetch(
          `/api/islamic-library/book/${encodeURIComponent(
            currentBook.id,
          )}`,
          {
            cache: 'no-store',
          },
        )

        const data = await response.json()

        if (!response.ok || !data?.success) {
          throw new Error('LOAD_FAILED')
        }

        if (!cancelled) {
          setPayload(data as ReaderPayload)

          const videos =
            Array.isArray(data?.book?.videos)
              ? data.book.videos
              : []

          if (videos.length > 0) {
            setSelectedVideoId(
              String(videos[0]?.id || ''),
            )
          }
        }
      } catch (error) {
        console.error(
          'Islamic book load error:',
          error,
        )

        if (!cancelled) {
          setLoadError(
            'تعذر تحميل محتوى الكتاب حاليًا. يمكنك فتح المصدر الأصلي مباشرة.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    try {
      const bookmarks = JSON.parse(
        localStorage.getItem(
          BOOKMARKS_KEY,
        ) || '[]',
      )

      setSaved(
        Array.isArray(bookmarks) &&
          bookmarks.includes(
            currentBook.id,
          ),
      )

      const state = JSON.parse(
        localStorage.getItem(
          `${READING_KEY_PREFIX}${currentBook.id}`,
        ) || '{}',
      )

      if (
        typeof state.fontScale ===
        'number'
      ) {
        setFontScale(
          Math.min(
            1.45,
            Math.max(
              0.85,
              state.fontScale,
            ),
          ),
        )
      }

      if (
        typeof state.darkMode ===
        'boolean'
      ) {
        setDarkMode(
          state.darkMode,
        )
      }

      if (
        typeof state.notes ===
        'string'
      ) {
        setNotes(state.notes)
      }

      if (
        typeof state.activeSection ===
        'number'
      ) {
        setActiveSection(
          Math.max(
            0,
            state.activeSection,
          ),
        )
      }

      if (
        typeof state.selectedVideoId ===
        'string'
      ) {
        setSelectedVideoId(
          state.selectedVideoId,
        )
      }

      if (
        typeof state.showVideoList ===
        'boolean'
      ) {
        setShowVideoList(
          state.showVideoList,
        )
      }
    } catch {
      // تجاهل أخطاء التخزين المحلي
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
          selectedVideoId,
          showVideoList,
          updatedAt: Date.now(),
        }),
      )
    } catch {
      // تجاهل أخطاء التخزين المحلي
    }
  }, [
    book,
    fontScale,
    darkMode,
    notes,
    activeSection,
    selectedVideoId,
    showVideoList,
  ])

  const contents =
    payload?.contents || []

  const videos =
    useMemo(() => {
      const source =
        Array.isArray(payload?.book?.videos)
          ? payload.book.videos
          : []

      return [...source]
        .filter(
          (item) =>
            item &&
            typeof item.id ===
              'string' &&
            typeof item.title ===
              'string' &&
            typeof item.url ===
              'string' &&
            item.url.trim(),
        )
        .sort(
          (a, b) =>
            Number(a.order || 0) -
            Number(b.order || 0),
        )
    }, [payload])

  const selectedVideo =
    useMemo(
      () =>
        videos.find(
          (item) =>
            item.id ===
            selectedVideoId,
        ) || null,
      [
        videos,
        selectedVideoId,
      ],
    )

  const filteredContents =
    useMemo(() => {
      const normalized =
        query.trim().toLowerCase()

      if (!normalized) {
        return contents
      }

      return contents.filter(
        (item) =>
          [
            item.text,
            item.section || '',
            String(
              item.page || '',
            ),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalized),
      )
    }, [contents, query])

  const safeActiveSection =
    Math.min(
      Math.max(
        activeSection,
        0,
      ),
      Math.max(
        filteredContents.length - 1,
        0,
      ),
    )

  const currentItem =
    filteredContents[
      safeActiveSection
    ]

  const toggleBookmark =
    () => {
      if (!book) return

      try {
        const current =
          JSON.parse(
            localStorage.getItem(
              BOOKMARKS_KEY,
            ) || '[]',
          ) as string[]

        if (saved) {
          localStorage.setItem(
            BOOKMARKS_KEY,
            JSON.stringify(
              current.filter(
                (id) =>
                  id !== book.id,
              ),
            ),
          )

          setSaved(false)
        } else {
          localStorage.setItem(
            BOOKMARKS_KEY,
            JSON.stringify(
              Array.from(
                new Set([
                  ...current,
                  book.id,
                ]),
              ),
            ),
          )

          setSaved(true)
        }
      } catch {
        setSaved(
          (value) => !value,
        )
      }
    }

  const copyCurrent =
    async () => {
      if (!currentItem?.text) {
        return
      }

      try {
        await navigator.clipboard.writeText(
          currentItem.text,
        )

        setCopied(true)

        window.setTimeout(
          () => setCopied(false),
          1600,
        )
      } catch {
        // Clipboard may be blocked
      }
    }

  const downloadUrl =
    payload?.book?.downloadUrl ||
    null

  const openNextVideo =
    () => {
      if (!selectedVideo) return

      const index =
        videos.findIndex(
          (item) =>
            item.id ===
            selectedVideo.id,
        )

      if (
        index >= 0 &&
        index <
          videos.length - 1
      ) {
        setSelectedVideoId(
          videos[
            index + 1
          ].id,
        )
      }
    }

  const openPreviousVideo =
    () => {
      if (!selectedVideo) return

      const index =
        videos.findIndex(
          (item) =>
            item.id ===
            selectedVideo.id,
        )

      if (index > 0) {
        setSelectedVideoId(
          videos[
            index - 1
          ].id,
        )
      }
    }

  if (!book) {
    return (
      <main
        dir="rtl"
        className="
          min-h-screen
          bg-mushaf-paper
          flex
          items-center
          justify-center
          px-4
        "
      >
        <section
          className="
            w-full
            max-w-xl
            rounded-[32px]
            bg-white
            border
            border-mushaf-border/20
            shadow-xl
            p-8
            text-center
          "
        >
          <BookOpen
            className="mx-auto text-mushaf-teal"
            size={34}
          />

          <h1 className="mt-5 text-2xl font-black">
            الكتاب غير موجود
          </h1>

          <Link
            href="/islamic-library"
            className="
              mt-6
              inline-flex
              items-center
              gap-2
              rounded-2xl
              bg-mushaf-teal
              text-white
              px-5
              py-3
              text-sm
              font-black
            "
          >
            العودة للمكتبة
            <ArrowLeft size={17} />
          </Link>
        </section>
      </main>
    )
  }

  const surface =
    darkMode
      ? 'bg-[#101614]'
      : 'bg-[#FBF8F0]'

  const card =
    darkMode
      ? 'bg-[#18201D] border-white/10'
      : 'bg-white border-mushaf-border/15'

  const mainText =
    darkMode
      ? 'text-[#F4EFE2]'
      : 'text-mushaf-dark'

  const muted =
    darkMode
      ? 'text-white/60'
      : 'text-gray-500'

  const selectedVideoEmbed =
    selectedVideo
      ? getVideoEmbedUrl(
          selectedVideo.url,
        )
      : null

  const selectedVideoIsDirect =
    selectedVideo
      ? isDirectVideoFile(
          selectedVideo.url,
        )
      : false

  return (
    <main
      dir="rtl"
      className={`min-h-screen ${surface} pb-32`}
    >
      <div
        className="
          mx-auto
          max-w-7xl
          px-4
          sm:px-6
          lg:px-8
          pt-5
          sm:pt-8
        "
      >
        <header
          className="
            flex
            flex-col
            gap-4
            xl:flex-row
            xl:items-center
            xl:justify-between
          "
        >
          <div className="flex items-center gap-3">
            <Link
              href="/islamic-library"
              className={`
                w-11
                h-11
                rounded-2xl
                ${card}
                border
                shadow-sm
                flex
                items-center
                justify-center
                ${mainText}
              `}
              aria-label="العودة للمكتبة"
            >
              <ArrowRight size={20} />
            </Link>

            <div className="min-w-0">
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-mushaf-teal
                  text-xs
                  font-black
                "
              >
                <BookOpen size={17} />

                {category?.label ||
                  'المكتبة الشرعية'}
              </div>

              <h1
                className={`
                  mt-1
                  text-xl
                  sm:text-2xl
                  font-black
                  ${mainText}
                `}
              >
                {book.title}
              </h1>

              <p
                className={`
                  mt-1
                  text-xs
                  sm:text-sm
                  ${muted}
                `}
              >
                {book.author}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setFontScale(
                  (value) =>
                    Math.max(
                      0.85,
                      Number(
                        (
                          value -
                          0.05
                        ).toFixed(2),
                      ),
                    ),
                )
              }
              className={`
                h-11
                w-11
                rounded-xl
                ${card}
                border
                flex
                items-center
                justify-center
                ${mainText}
              `}
              title="تصغير الخط"
            >
              <Minus size={18} />
            </button>

            <button
              type="button"
              onClick={() =>
                setFontScale(
                  (value) =>
                    Math.min(
                      1.45,
                      Number(
                        (
                          value +
                          0.05
                        ).toFixed(2),
                      ),
                    ),
                )
              }
              className={`
                h-11
                w-11
                rounded-xl
                ${card}
                border
                flex
                items-center
                justify-center
                ${mainText}
              `}
              title="تكبير الخط"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={() =>
                setDarkMode(
                  (value) => !value,
                )
              }
              className={`
                inline-flex
                items-center
                gap-2
                h-11
                px-4
                rounded-xl
                ${card}
                border
                text-xs
                font-black
                ${mainText}
              `}
            >
              {darkMode ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}

              {darkMode
                ? 'نهاري'
                : 'ليلي'}
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              className={`
                inline-flex
                items-center
                gap-2
                h-11
                px-4
                rounded-xl
                border
                text-xs
                font-black
                ${
                  saved
                    ? 'bg-mushaf-gold text-white border-mushaf-gold'
                    : `${card} ${mainText}`
                }
              `}
            >
              {saved ? (
                <Check size={17} />
              ) : (
                <Bookmark size={17} />
              )}

              {saved
                ? 'محفوظ'
                : 'حفظ'}
            </button>
          </div>
        </header>

        <section
          className="
            mt-6
            grid
            grid-cols-1
            xl:grid-cols-[300px_1fr]
            gap-5
          "
        >
          <aside className="space-y-5">
            <section
              className={`
                rounded-[28px]
                border
                shadow-sm
                p-5
                ${card}
              `}
            >
              <div
                className={`
                  flex
                  items-center
                  gap-2
                  font-black
                  text-sm
                  ${
                    darkMode
                      ? 'text-mushaf-gold'
                      : 'text-mushaf-teal'
                  }
                `}
              >
                <List size={18} />
                فهرس القراءة
              </div>

              <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2">
                {(contents.length
                  ? contents
                  : [
                      {
                        text:
                          book.description,
                        section:
                          'نبذة عن الكتاب',
                      },
                    ]
                ).map(
                  (
                    item,
                    index,
                  ) => {
                    const active =
                      index ===
                      safeActiveSection

                    return (
                      <button
                        key={`${item.page || 'x'}-${index}`}
                        type="button"
                        onClick={() => {
                          setActiveSection(
                            index,
                          )

                          window.scrollTo(
                            {
                              top: 0,
                              behavior:
                                'smooth',
                            },
                          )
                        }}
                        className={`
                          w-full
                          text-right
                          rounded-2xl
                          px-3
                          py-3
                          text-xs
                          leading-5
                          transition
                          border
                          ${
                            active
                              ? 'bg-mushaf-teal text-white border-mushaf-teal'
                              : darkMode
                                ? 'bg-white/5 text-white/75 border-white/10'
                                : 'bg-mushaf-paper text-gray-700 border-gray-100 hover:border-mushaf-teal/20'
                          }
                        `}
                      >
                        <div className="font-black">
                          {item.section ||
                            `موضع ${index + 1}`}
                        </div>

                        {item.page ? (
                          <div
                            className={`
                              mt-1
                              text-[10px]
                              ${
                                active
                                  ? 'text-white/65'
                                  : muted
                              }
                            `}
                          >
                            الصفحة{' '}
                            {item.page.toLocaleString(
                              'ar-EG',
                            )}
                          </div>
                        ) : null}
                      </button>
                    )
                  },
                )}
              </div>
            </section>

            <section
              className={`
                rounded-[28px]
                border
                shadow-sm
                p-5
                ${card}
              `}
            >
              <div
                className={`
                  flex
                  items-center
                  gap-2
                  font-black
                  text-sm
                  ${
                    darkMode
                      ? 'text-mushaf-gold'
                      : 'text-mushaf-teal'
                  }
                `}
              >
                <Search size={18} />
                بحث داخل الكتاب
              </div>

              <input
                value={query}
                onChange={(event) => {
                  setQuery(
                    event.target.value,
                  )
                  setActiveSection(0)
                }}
                placeholder="ابحث عن كلمة أو عبارة..."
                className={`
                  mt-4
                  w-full
                  h-11
                  rounded-xl
                  border
                  px-3
                  text-sm
                  outline-none
                  ${
                    darkMode
                      ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                      : 'bg-mushaf-paper text-mushaf-dark border-gray-200'
                  }
                `}
              />

              <p
                className={`
                  mt-3
                  text-[11px]
                  leading-5
                  ${muted}
                `}
              >
                {filteredContents.length.toLocaleString(
                  'ar-EG',
                )}{' '}
                موضع متاح في نتيجة البحث.
              </p>
            </section>
          </aside>

          <article
            className={`
              rounded-[32px]
              border
              shadow-sm
              overflow-hidden
              ${card}
            `}
          >
            <div className="p-5 sm:p-7 border-b border-current/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5 text-[11px] font-black">
                  {book.level}
                </span>

                <span
                  className={`
                    text-xs
                    font-bold
                    ${muted}
                  `}
                >
                  {category?.short ||
                    'مادة شرعية'}
                </span>

                {payload?.source ===
                  'quranpedia' && (
                  <span className="rounded-full bg-mushaf-teal/10 text-mushaf-teal px-3 py-1.5 text-[11px] font-black">
                    قراءة نصية داخل التطبيق
                  </span>
                )}

                {videos.length > 0 && (
                  <span className="rounded-full bg-purple-50 text-purple-700 px-3 py-1.5 text-[11px] font-black">
                    {videos.length.toLocaleString(
                      'ar-EG',
                    )}{' '}
                    درس مرئي
                  </span>
                )}
              </div>

              <h2
                className={`
                  mt-5
                  text-2xl
                  sm:text-3xl
                  font-black
                  leading-relaxed
                  ${mainText}
                `}
              >
                {book.title}
              </h2>

              <p
                className={`
                  mt-2
                  text-sm
                  ${muted}
                `}
              >
                تأليف: {book.author}
              </p>

              <p
                className={`
                  mt-5
                  text-sm
                  sm:text-base
                  leading-8
                  ${mainText}
                `}
              >
                {book.description}
              </p>

              {downloadUrl && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-2xl
                      bg-mushaf-teal
                      text-white
                      px-5
                      py-3.5
                      text-sm
                      font-black
                      shadow-sm
                      transition
                      hover:-translate-y-0.5
                    "
                  >
                    <Download size={18} />
                    تحميل الكتاب
                  </a>
                </div>
              )}

              {payload?.book.publication && (
                <div
                  className={`
                    mt-5
                    grid
                    grid-cols-2
                    sm:grid-cols-4
                    gap-2
                    text-[11px]
                    ${muted}
                  `}
                >
                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">
                      الناشر
                    </span>
                    <span>
                      {payload.book.publication
                        .publisher ||
                        '—'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">
                      السنة
                    </span>
                    <span>
                      {payload.book.publication
                        .publishYear ||
                        '—'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">
                      الطبعة
                    </span>
                    <span>
                      {payload.book.publication
                        .edition ||
                        '—'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-mushaf-paper px-3 py-2">
                    <span className="block font-black text-mushaf-teal">
                      الأجزاء
                    </span>
                    <span>
                      {payload.book.publication
                        .parts ||
                        '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {videos.length > 0 && (
              <section className="border-b border-current/10 bg-black/[0.015] p-5 sm:p-7">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Video
                          size={20}
                          className="text-mushaf-gold"
                        />

                        <h2
                          className={`
                            text-lg
                            sm:text-xl
                            font-black
                            ${mainText}
                          `}
                        >
                          دروس شرح الكتاب
                        </h2>
                      </div>

                      <p
                        className={`
                          mt-1
                          text-xs
                          leading-6
                          ${muted}
                        `}
                      >
                        اختر أي درس وسيعمل الفيديو
                        داخل المنصة مباشرة.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowVideoList(
                          (value) => !value,
                        )
                      }
                      className={`
                        inline-flex
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        px-4
                        py-2.5
                        text-xs
                        font-black
                        ${
                          darkMode
                            ? 'border-white/10 text-white'
                            : 'border-mushaf-teal/15 text-mushaf-teal'
                        }
                      `}
                    >
                      {showVideoList
                        ? 'إخفاء الدروس'
                        : 'عرض الدروس'}

                      <ChevronDown
                        size={16}
                        className={
                          showVideoList
                            ? 'rotate-180 transition'
                            : 'transition'
                        }
                      />
                    </button>
                  </div>

                  {selectedVideo && (
                    <div className="overflow-hidden rounded-[28px] border border-black/5 bg-black">
                      <div className="aspect-video w-full">
                        {selectedVideoEmbed ? (
                          <iframe
                            src={
                              selectedVideoEmbed
                            }
                            title={
                              selectedVideo.title
                            }
                            className="h-full w-full"
                            loading="lazy"
                            allow="
                              accelerometer;
                              autoplay;
                              clipboard-write;
                              encrypted-media;
                              gyroscope;
                              picture-in-picture;
                              web-share
                            "
                            allowFullScreen
                          />
                        ) : selectedVideoIsDirect ? (
                          <video
                            key={
                              selectedVideo.url
                            }
                            src={
                              selectedVideo.url
                            }
                            controls
                            playsInline
                            className="h-full w-full bg-black object-contain"
                          >
                            متصفحك لا يدعم تشغيل الفيديو.
                          </video>
                        ) : (
                          <div className="flex h-full items-center justify-center p-8 text-center text-white">
                            <div>
                              <Video
                                size={35}
                                className="mx-auto mb-4 text-white/50"
                              />

                              <p className="text-sm font-bold">
                                لا يمكن تضمين هذا
                                الرابط داخل المنصة.
                              </p>

                              <a
                                href={
                                  selectedVideo.url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-gray-900"
                              >
                                فتح الفيديو
                                <ExternalLink size={14} />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedVideo && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className={`text-xs font-black ${muted}`}>
                          الدرس الحالي
                        </p>

                        <h3
                          className={`
                            mt-1
                            text-base
                            sm:text-lg
                            font-black
                            ${mainText}
                          `}
                        >
                          {selectedVideo.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={
                            openPreviousVideo
                          }
                          disabled={
                            videos.findIndex(
                              (item) =>
                                item.id ===
                                selectedVideo.id,
                            ) <= 0
                          }
                          className="
                            flex
                            items-center
                            gap-2
                            rounded-xl
                            border
                            border-gray-200
                            bg-white
                            px-3
                            py-2.5
                            text-xs
                            font-black
                            text-gray-600
                            disabled:opacity-35
                          "
                        >
                          <ArrowRight size={15} />
                          السابق
                        </button>

                        <button
                          type="button"
                          onClick={
                            openNextVideo
                          }
                          disabled={
                            videos.findIndex(
                              (item) =>
                                item.id ===
                                selectedVideo.id,
                            ) >=
                            videos.length - 1
                          }
                          className="
                            flex
                            items-center
                            gap-2
                            rounded-xl
                            bg-mushaf-teal
                            px-3
                            py-2.5
                            text-xs
                            font-black
                            text-white
                            disabled:opacity-35
                          "
                        >
                          التالي
                          <ArrowLeft size={15} />
                        </button>
                      </div>
                    </div>
                  )}

                  {showVideoList && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {videos.map(
                        (
                          video,
                          index,
                        ) => {
                          const active =
                            video.id ===
                            selectedVideoId

                          return (
                            <button
                              key={
                                video.id
                              }
                              type="button"
                              onClick={() =>
                                setSelectedVideoId(
                                  video.id,
                                )
                              }
                              className={`
                                group
                                flex
                                items-center
                                gap-3
                                rounded-2xl
                                border
                                p-3
                                text-right
                                transition
                                ${
                                  active
                                    ? 'border-mushaf-teal/30 bg-mushaf-teal/5'
                                    : 'border-gray-100 bg-white hover:border-mushaf-gold/20 hover:bg-mushaf-paper'
                                }
                              `}
                            >
                              <span
                                className={`
                                  flex
                                  h-11
                                  w-11
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-xl
                                  ${
                                    active
                                      ? 'bg-mushaf-teal text-white'
                                      : 'bg-mushaf-paper text-mushaf-teal'
                                  }
                                `}
                              >
                                {active ? (
                                  <Play
                                    size={16}
                                    fill="currentColor"
                                  />
                                ) : (
                                  <span className="text-xs font-black">
                                    {(
                                      index +
                                      1
                                    ).toLocaleString(
                                      'ar-EG',
                                    )}
                                  </span>
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span
                                  className={`
                                    block
                                    truncate
                                    text-sm
                                    font-black
                                    ${
                                      active
                                        ? 'text-mushaf-teal'
                                        : 'text-gray-800'
                                    }
                                  `}
                                >
                                  {video.title}
                                </span>

                                <span className="mt-1 block text-[10px] text-gray-400">
                                  درس رقم{' '}
                                  {(
                                    index +
                                    1
                                  ).toLocaleString(
                                    'ar-EG',
                                  )}
                                </span>
                              </span>

                              <Play
                                size={15}
                                className={`
                                  shrink-0
                                  ${
                                    active
                                      ? 'text-mushaf-teal'
                                      : 'text-gray-300 group-hover:text-mushaf-gold'
                                  }
                                `}
                              />
                            </button>
                          )
                        },
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {loading ? (
              <div
                className={`
                  p-12
                  text-center
                  ${muted}
                `}
              >
                جارٍ تجهيز الكتاب للقراءة...
              </div>
            ) : loadError ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <X size={24} />
                </div>

                <p
                  className={`
                    mt-4
                    text-sm
                    leading-6
                    ${mainText}
                  `}
                >
                  {loadError}
                </p>

                {book.readingUrl && (
                  <a
                    href={book.readingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      mt-5
                      inline-flex
                      items-center
                      gap-2
                      rounded-2xl
                      bg-mushaf-teal
                      text-white
                      px-5
                      py-3
                      text-xs
                      font-black
                    "
                  >
                    فتح المصدر الأصلي
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            ) : payload?.source ===
                'quranpedia' &&
              contents.length ? (
              <div className="p-6 sm:p-10">
                <div className="mx-auto max-w-4xl">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black text-mushaf-teal">
                        موضع القراءة
                      </p>

                      <p
                        className={`
                          text-xs
                          ${muted}
                        `}
                      >
                        {currentItem?.page
                          ? `صفحة ${currentItem.page.toLocaleString(
                              'ar-EG',
                            )}`
                          : `الموضع ${(
                              safeActiveSection +
                              1
                            ).toLocaleString(
                              'ar-EG',
                            )}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void copyCurrent()
                      }
                      className={`
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        border
                        px-3
                        py-2
                        text-xs
                        font-black
                        ${
                          darkMode
                            ? 'border-white/10 text-white'
                            : 'border-mushaf-teal/15 text-mushaf-teal'
                        }
                      `}
                    >
                      {copied ? (
                        <CheckCheck size={15} />
                      ) : (
                        <Copy size={15} />
                      )}

                      {copied
                        ? 'تم النسخ'
                        : 'نسخ'}
                    </button>
                  </div>

                  <div
                    className={`
                      rounded-[28px]
                      px-6
                      sm:px-10
                      py-8
                      sm:py-12
                      border
                      ${
                        darkMode
                          ? 'bg-[#111715] border-white/10'
                          : 'bg-[#FFFDF8] border-mushaf-gold/15'
                      }
                    `}
                  >
                    {currentItem?.section && (
                      <h2
                        className={`
                          text-center
                          font-black
                          text-lg
                          sm:text-xl
                          ${mainText}
                        `}
                      >
                        {currentItem.section}
                      </h2>
                    )}

                    <p
                      className={`
                        mt-7
                        whitespace-pre-wrap
                        leading-[2.35]
                        sm:leading-[2.5]
                        text-center
                        ${
                          darkMode
                            ? 'text-[#F4EFE2]'
                            : 'text-[#27231D]'
                        }
                      `}
                      style={{
                        fontSize: `${
                          1.25 *
                          fontScale
                        }rem`,
                      }}
                    >
                      {currentItem?.text ||
                        book.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSection(
                          (
                            value,
                          ) =>
                            Math.max(
                              0,
                              value -
                                1,
                            ),
                        )
                      }
                      disabled={
                        safeActiveSection <=
                        0
                      }
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-2xl
                        bg-mushaf-teal
                        text-white
                        px-4
                        py-3
                        text-xs
                        font-black
                        disabled:opacity-35
                      "
                    >
                      <ArrowRight size={16} />
                      السابق
                    </button>

                    <span
                      className={`
                        text-xs
                        font-bold
                        ${muted}
                      `}
                    >
                      {Math.min(
                        safeActiveSection +
                          1,
                        filteredContents.length,
                      ).toLocaleString(
                        'ar-EG',
                      )}

                      {' / '}

                      {filteredContents.length.toLocaleString(
                        'ar-EG',
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSection(
                          (
                            value,
                          ) =>
                            Math.min(
                              filteredContents.length -
                                1,
                              value +
                                1,
                            ),
                        )
                      }
                      disabled={
                        safeActiveSection >=
                        filteredContents.length -
                          1
                      }
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-2xl
                        bg-mushaf-teal
                        text-white
                        px-4
                        py-3
                        text-xs
                        font-black
                        disabled:opacity-35
                      "
                    >
                      التالي
                      <ArrowLeft size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 sm:p-10">
                <div
                  className={`
                    rounded-[28px]
                    p-6
                    ${
                      darkMode
                        ? 'bg-white/5'
                        : 'bg-mushaf-paper'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 text-mushaf-teal font-black text-sm">
                    <BookOpen size={19} />
                    المصدر النصي غير متاح حاليًا
                  </div>

                  <p
                    className={`
                      mt-3
                      text-sm
                      leading-7
                      ${muted}
                    `}
                  >
                    الكتاب موجود في مكتبة مصحف
                    سميع، لكن مصدره الحالي لا
                    يوفر محتوى نصيًا موحدًا يمكن
                    دمجه داخل القارئ.
                  </p>

                  {payload?.message && (
                    <p
                      className={`
                        mt-3
                        text-xs
                        leading-6
                        ${muted}
                      `}
                    >
                      {payload.message}
                    </p>
                  )}

                  {book.readingUrl && (
                    <a
                      href={book.readingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        mt-5
                        inline-flex
                        items-center
                        gap-2
                        rounded-2xl
                        bg-mushaf-teal
                        text-white
                        px-5
                        py-3
                        text-xs
                        font-black
                      "
                    >
                      فتح الكتاب
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="p-5 sm:p-7 border-t border-current/10">
              <div
                className={`
                  rounded-[24px]
                  p-5
                  ${
                    darkMode
                      ? 'bg-white/5'
                      : 'bg-mushaf-paper'
                  }
                `}
              >
                <div
                  className={`
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-black
                    ${
                      darkMode
                        ? 'text-mushaf-gold'
                        : 'text-mushaf-teal'
                    }
                  `}
                >
                  <GraduationCap size={18} />
                  الشرح
                </div>

                <p
                  className={`
                    mt-3
                    text-sm
                    leading-7
                    ${mainText}
                  `}
                >
                  {book.sharhTitle ||
                    'لم يتم تسجيل شرح مستقل لهذا الكتاب بعد.'}

                  {book.sharhAuthor
                    ? ` — ${book.sharhAuthor}`
                    : ''}
                </p>

                {book.sharhUrl && (
                  <a
                    href={book.sharhUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      mt-4
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      border
                      border-mushaf-teal/20
                      text-mushaf-teal
                      px-4
                      py-2.5
                      text-xs
                      font-black
                    "
                  >
                    فتح الشرح
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>

              <div className="mt-5">
                <div
                  className={`
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-black
                    ${
                      darkMode
                        ? 'text-mushaf-gold'
                        : 'text-mushaf-teal'
                    }
                  `}
                >
                  <Bookmark size={18} />
                  ملاحظاتك
                </div>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  placeholder="دوّن الفوائد أو الملاحظات هنا..."
                  className={`
                    mt-3
                    w-full
                    min-h-[120px]
                    rounded-2xl
                    border
                    px-4
                    py-3
                    text-sm
                    leading-7
                    outline-none
                    ${
                      darkMode
                        ? 'bg-black/20 text-white border-white/10 placeholder:text-white/30'
                        : 'bg-mushaf-paper border-gray-200 text-mushaf-dark'
                    }
                  `}
                />
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/islamic-library"
            className={`
              inline-flex
              items-center
              gap-2
              rounded-2xl
              border
              px-4
              py-3
              text-xs
              font-black
              ${
                darkMode
                  ? 'border-white/10 text-white'
                  : 'bg-white border-mushaf-border/20 text-mushaf-teal'
              }
            `}
          >
            <Home size={15} />
            المكتبة الشرعية
          </Link>

          <Link
            href="/"
            className={`
              inline-flex
              items-center
              gap-2
              rounded-2xl
              border
              px-4
              py-3
              text-xs
              font-black
              ${
                darkMode
                  ? 'border-white/10 text-white'
                  : 'bg-white border-mushaf-border/20 text-mushaf-teal'
              }
            `}
          >
            الرئيسية
            <Home size={15} />
          </Link>
        </div>
      </div>
    </main>
  )
}

مهم: هذا الملف أصبح جاهزًا لعرض:

اسم الكتاب كاملًا.
رابط تحميل الكتاب.
قسم دروس شرح الكتاب.
قائمة بكل الدروس.
تشغيل YouTube داخل المنصة.
تشغيل ملفات MP4 / WebM / OGG داخل المنصة.
أزرار السابق/التالي للدروس.
حفظ آخر درس شاهده المستخدم محليًا.

لكن لكي تظهر الفيديوهات فعلًا، الملف التالي الذي سنعدله هو:

app/api/islamic-library/book/[id]/route.ts

وبعده نعدل:

lib/islamic/sunniLibrary.ts

ثم ننشئ إدارة الأدمن التي تضيف وتعدل وتحذف اسم الدرس + رابط الفيديو + رابط تحميل الكتاب.

اللي بعده يلا 

تمام، ده الملف اللي بعده فقط.

المسار:
app/api/islamic-library/book/[id]/route.ts

استبدل محتوى الملف بالكامل بهذا:

import { NextRequest, NextResponse } from 'next/server'
import {
  SUNNI_LIBRARY_BOOKS,
  type SunniLibraryBook,
} from '@/lib/islamic/sunniLibrary'
import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QURANPEDIA_BASE = 'https://api.quranpedia.net/v1'

interface LearningVideo {
  id: string
  title: string
  url: string
  order: number
}

interface DynamicBookFields {
  id?: string
  title?: string
  author?: string
  category?: string
  level?: string
  description?: string
  readingUrl?: string | null
  readingLabel?: string | null
  sharhTitle?: string | null
  sharhAuthor?: string | null
  sharhUrl?: string | null
  sharhLabel?: string | null
  downloadUrl?: string | null
  quranpediaBookId?: number | null
  videos?: unknown
  publication?: {
    publishYear?: string | number | null
    edition?: string | null
    publisher?: string | null
    parts?: number | null
  } | null
}

function getQuranpediaId(
  book: SunniLibraryBook & DynamicBookFields
): number | null {
  if (Number.isFinite(book.quranpediaBookId)) {
    return Number(book.quranpediaBookId)
  }

  const candidates = [
    book.readingUrl || '',
    book.sharhUrl || '',
  ]

  for (const url of candidates) {
    const match = url.match(/quranpedia\.net\/book\/(\d+)/i)

    if (match) {
      return Number(match[1])
    }
  }

  return null
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectText(
  value: unknown,
  output: Array<{
    text: string
    page?: number
    part?: number
    section?: string
  }>,
  context: {
    page?: number
    part?: number
    section?: string
  } = {}
) {
  if (!value) {
    return
  }

  if (typeof value === 'string') {
    const text = cleanText(value)

    if (text) {
      output.push({
        text,
        ...context,
      })
    }

    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, output, context)
    }

    return
  }

  if (typeof value !== 'object') {
    return
  }

  const obj = value as Record<string, unknown>

  const numericPage = Number(obj.page)
  const numericPart = Number(obj.part)

  const nextContext = {
    page:
      Number.isFinite(numericPage) && numericPage > 0
        ? numericPage
        : context.page,

    part:
      Number.isFinite(numericPart) && numericPart > 0
        ? numericPart
        : context.part,

    section:
      typeof obj.title === 'string'
        ? cleanText(obj.title)
        : typeof obj.section === 'string'
          ? cleanText(obj.section)
          : context.section,
  }

  const directKeys = [
    'text',
    'content',
    'body',
    'description',
  ]

  for (const key of directKeys) {
    if (typeof obj[key] === 'string') {
      collectText(obj[key], output, nextContext)
    }
  }

  for (const [key, child] of Object.entries(obj)) {
    if (directKeys.includes(key)) {
      continue
    }

    if (
      key === 'book' ||
      key === 'author' ||
      key === 'metadata' ||
      key === 'language' ||
      key === 'category' ||
      key === 'contents_url' ||
      key === 'contentsUrl'
    ) {
      continue
    }

    if (
      typeof child === 'object' &&
      child !== null
    ) {
      collectText(child, output, nextContext)
    }
  }
}

async function fetchJson(
  url: string,
  signal: AbortSignal
): Promise<any> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

function normalizeVideo(
  value: unknown,
  fallbackId: string,
  fallbackOrder: number
): LearningVideo | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const item = value as Record<string, unknown>

  const id =
    typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : fallbackId

  const title =
    typeof item.title === 'string' && item.title.trim()
      ? item.title.trim()
      : 'درس بدون عنوان'

  const url =
    typeof item.url === 'string' && item.url.trim()
      ? item.url.trim()
      : typeof item.videoUrl === 'string' && item.videoUrl.trim()
        ? item.videoUrl.trim()
        : ''

  const numericOrder = Number(item.order)

  const order =
    Number.isFinite(numericOrder) && numericOrder >= 0
      ? numericOrder
      : fallbackOrder

  if (!url) {
    return null
  }

  return {
    id,
    title,
    url,
    order,
  }
}

function normalizeVideos(value: unknown): LearningVideo[] {
  if (!Array.isArray(value)) {
    return []
  }

  const result: LearningVideo[] = []

  value.forEach((item, index) => {
    const video = normalizeVideo(
      item,
      `video-${index + 1}`,
      index
    )

    if (video) {
      result.push(video)
    }
  })

  return result.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order
    }

    return a.title.localeCompare(
      b.title,
      'ar'
    )
  })
}

async function loadFirestoreBook(
  bookId: string
): Promise<{
  exists: boolean
  book: DynamicBookFields | null
  videos: LearningVideo[]
}> {
  try {
    const bookRef = doc(
      db,
      'islamicLibraryBooks',
      bookId
    )

    const snapshot = await getDoc(bookRef)

    if (!snapshot.exists()) {
      return {
        exists: false,
        book: null,
        videos: [],
      }
    }

    const data =
      snapshot.data() as DynamicBookFields

    const storedVideos = normalizeVideos(
      data.videos
    )

    let subcollectionVideos: LearningVideo[] = []

    try {
      const videosSnapshot = await getDocs(
        collection(
          db,
          'islamicLibraryBooks',
          bookId,
          'videos'
        )
      )

      subcollectionVideos = videosSnapshot.docs
        .map((item, index) =>
          normalizeVideo(
            {
              id: item.id,
              ...item.data(),
            },
            item.id,
            index
          )
        )
        .filter(
          (item): item is LearningVideo =>
            Boolean(item)
        )
    } catch {
      subcollectionVideos = []
    }

    const mergedMap = new Map<
      string,
      LearningVideo
    >()

    for (const video of storedVideos) {
      mergedMap.set(video.id, video)
    }

    for (const video of subcollectionVideos) {
      mergedMap.set(video.id, video)
    }

    const videos = Array.from(
      mergedMap.values()
    ).sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }

      return a.title.localeCompare(
        b.title,
        'ar'
      )
    })

    return {
      exists: true,
      book: {
        ...data,
        id: bookId,
      },
      videos,
    }
  } catch {
    return {
      exists: false,
      book: null,
      videos: [],
    }
  }
}

export async function GET(
  _request: NextRequest,
  context: {
    params: {
      id: string
    }
  }
) {
  const controller =
    new AbortController()

  const timer = setTimeout(
    () => controller.abort(),
    15000
  )

  try {
    const rawId =
      context.params?.id || ''

    const bookId =
      decodeURIComponent(rawId)

    const staticBook =
      SUNNI_LIBRARY_BOOKS.find(
        (item) => item.id === bookId
      )

    const firestoreResult =
      await loadFirestoreBook(bookId)

    if (
      !staticBook &&
      !firestoreResult.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'BOOK_NOT_FOUND',
        },
        {
          status: 404,
        }
      )
    }

    const staticRecord =
      (staticBook || {}) as SunniLibraryBook &
        DynamicBookFields

    const firestoreBook =
      firestoreResult.book || {}

    const mergedBook =
      {
        id:
          bookId ||
          staticRecord.id ||
          firestoreBook.id ||
          '',

        title:
          firestoreBook.title ||
          staticRecord.title ||
          'كتاب شرعي',

        author:
          firestoreBook.author ||
          staticRecord.author ||
          'غير محدد',

        category:
          firestoreBook.category ||
          staticRecord.category ||
          '',

        level:
          firestoreBook.level ||
          staticRecord.level ||
          'متوسط',

        description:
          firestoreBook.description ||
          staticRecord.description ||
          '',

        readingUrl:
          firestoreBook.readingUrl ??
          staticRecord.readingUrl ??
          null,

        readingLabel:
          firestoreBook.readingLabel ??
          staticRecord.readingLabel ??
          null,

        sharhUrl:
          firestoreBook.sharhUrl ??
          staticRecord.sharhUrl ??
          null,

        sharhLabel:
          firestoreBook.sharhLabel ??
          staticRecord.sharhLabel ??
          null,

        sharhTitle:
          firestoreBook.sharhTitle ??
          staticRecord.sharhTitle ??
          null,

        sharhAuthor:
          firestoreBook.sharhAuthor ??
          staticRecord.sharhAuthor ??
          null,

        downloadUrl:
          firestoreBook.downloadUrl ??
          staticRecord.downloadUrl ??
          null,

        quranpediaBookId:
          firestoreBook.quranpediaBookId ??
          staticRecord.quranpediaBookId ??
          null,

        publication:
          firestoreBook.publication ??
          null,
      }

    const videos =
      firestoreResult.videos.length
        ? firestoreResult.videos
        : normalizeVideos(
            firestoreBook.videos ??
              staticRecord.videos
          )

    const quranpediaId =
      getQuranpediaId(
        mergedBook as SunniLibraryBook &
          DynamicBookFields
      )

    if (!quranpediaId) {
      return NextResponse.json({
        success: true,
        source: 'external',

        book: {
          id: mergedBook.id,
          title: mergedBook.title,
          author: mergedBook.author,
          category: mergedBook.category,
          level: mergedBook.level,
          description:
            mergedBook.description,

          readingUrl:
            mergedBook.readingUrl,

          readingLabel:
            mergedBook.readingLabel,

          sharhUrl:
            mergedBook.sharhUrl,

          sharhLabel:
            mergedBook.sharhLabel,

          sharhTitle:
            mergedBook.sharhTitle,

          sharhAuthor:
            mergedBook.sharhAuthor,

          downloadUrl:
            mergedBook.downloadUrl,

          publication:
            mergedBook.publication,
        },

        videos,

        contents: [],

        message:
          'هذا الكتاب لا يملك حاليًا مصدرًا نصيًا موحدًا داخل API التطبيق، لكن يمكنك القراءة أو التحميل ومشاهدة الدروس من داخل المنصة.',
      })
    }

    const meta =
      await fetchJson(
        `${QURANPEDIA_BASE}/book/${quranpediaId}`,
        controller.signal
      )

    let rawContents: unknown = null

    const contentsUrl =
      typeof meta?.contents_url === 'string'
        ? meta.contents_url
        : typeof meta?.contentsUrl === 'string'
          ? meta.contentsUrl
          : ''

    if (contentsUrl) {
      try {
        rawContents =
          await fetchJson(
            contentsUrl,
            controller.signal
          )
      } catch {
        rawContents = null
      }
    }

    const sections: Array<{
      text: string
      page?: number
      part?: number
      section?: string
    }> = []

    collectText(
      rawContents ??
        meta?.about ??
        meta?.description ??
        '',
      sections
    )

    const deduped =
      sections.filter(
        (item, index) => {
          if (!item.text) {
            return false
          }

          const previous =
            sections[index - 1]

          return (
            !previous ||
            previous.text !== item.text ||
            previous.page !== item.page ||
            previous.part !== item.part
          )
        }
      )

    return NextResponse.json({
      success: true,
      source: 'quranpedia',

      quranpediaBookId:
        quranpediaId,

      book: {
        id: mergedBook.id,
        title: mergedBook.title,
        author: mergedBook.author,
        category: mergedBook.category,
        level: mergedBook.level,
        description:
          mergedBook.description,

        readingUrl:
          mergedBook.readingUrl,

        readingLabel:
          mergedBook.readingLabel,

        sharhUrl:
          mergedBook.sharhUrl,

        sharhLabel:
          mergedBook.sharhLabel,

        sharhTitle:
          mergedBook.sharhTitle,

        sharhAuthor:
          mergedBook.sharhAuthor,

        downloadUrl:
          mergedBook.downloadUrl,

        publication: {
          publishYear:
            meta?.publish_year ??
            meta?.publishYear ??
            mergedBook.publication
              ?.publishYear ??
            null,

          edition:
            meta?.edition ??
            mergedBook.publication
              ?.edition ??
            null,

          publisher:
            meta?.nasher ??
            meta?.publisher ??
            mergedBook.publication
              ?.publisher ??
            null,

          parts:
            meta?.parts ??
            mergedBook.publication
              ?.parts ??
            null,
        },
      },

      videos,

      contents: deduped,
    })
  } catch (error) {
    const isTimeout =
      error instanceof DOMException &&
      error.name === 'AbortError'

    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? 'TIMEOUT'
          : 'LOAD_FAILED',
      },
      {
        status: 500,
      }
    )
  } finally {
    clearTimeout(timer)
  }
}

ده ملف واحد فقط ومساره هو:

app/api/islamic-library/book/[id]/route.ts

والملف ده دلوقتي بيجهز الـ API بحيث يرجّع مع بيانات الكتاب:
downloadUrl + videos + يدعم الكتب الموجودة في القائمة الحالية والكتب التي ستضيفها من لوحة الإدارة.
