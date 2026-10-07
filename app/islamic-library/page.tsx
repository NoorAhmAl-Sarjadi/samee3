'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Download,
  ExternalLink,
  GraduationCap,
  LibraryBig,
  Loader2,
  PlayCircle,
  Search,
} from 'lucide-react'
import {
  collection,
  getDocs,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'

import {
  SUNNI_LIBRARY_BOOKS,
  SUNNI_LIBRARY_CATEGORIES,
  type SunniLibraryCategoryId,
} from '@/lib/islamic/sunniLibrary'

type LibraryLevel =
  | 'الكل'
  | 'مبتدئ'
  | 'متوسط'
  | 'متقدم'

type DynamicLibraryVideo = {
  id?: string
  title?: string
  url?: string
  order?: number
}

type FirestoreLibraryBook = {
  id?: string
  title?: string
  author?: string
  category?: string
  level?: string
  description?: string

  readingUrl?: string | null
  readingLabel?: string | null

  downloadUrl?: string | null
  downloadLabel?: string | null

  sharhTitle?: string | null
  sharhAuthor?: string | null
  sharhUrl?: string | null
  sharhLabel?: string | null

  deleted?: boolean

  videos?: DynamicLibraryVideo[]
}

type LibraryBook = {
  id: string
  title: string
  author: string
  category: string
  level: string
  description: string

  readingUrl?: string | null
  readingLabel?: string | null

  downloadUrl?: string | null
  downloadLabel?: string | null

  sharhTitle?: string | null
  sharhAuthor?: string | null
  sharhUrl?: string | null
  sharhLabel?: string | null

  videos: DynamicLibraryVideo[]

  source: 'static' | 'firestore'
}

const LEVELS: Array<{
  id: LibraryLevel
  label: string
  short: string
}> = [
  {
    id: 'الكل',
    label: 'جميع المستويات',
    short: 'كل الكتب والمواد',
  },
  {
    id: 'مبتدئ',
    label: 'المستوى التمهيدي',
    short: 'بداية التدرج العلمي',
  },
  {
    id: 'متوسط',
    label: 'المستوى المتوسط',
    short: 'بناء العلم والتوسع',
  },
  {
    id: 'متقدم',
    label: 'المستوى المتقدم',
    short: 'الدراسة والتخصص',
  },
]

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

function normalizeLevel(value?: string | null): string {
  const text = (value || '').trim()

  if (
    text === 'مبتدئ' ||
    text === 'المستوى التمهيدي'
  ) {
    return 'مبتدئ'
  }

  if (
    text === 'متوسط' ||
    text === 'المستوى المتوسط'
  ) {
    return 'متوسط'
  }

  if (
    text === 'متقدم' ||
    text === 'المستوى المتقدم'
  ) {
    return 'متقدم'
  }

  return text || 'مبتدئ'
}

function normalizeCategory(
  value?: string | null
): string {
  return (value || '').trim()
}

function normalizeDynamicVideos(
  value?: DynamicLibraryVideo[]
): DynamicLibraryVideo[] {
  if (!Array.isArray(value)) return []

  const videos = value
    .map((video, index) => ({
      id:
        typeof video?.id === 'string' &&
        video.id.trim()
          ? video.id
          : `video-${index + 1}`,
      title:
        typeof video?.title === 'string'
          ? video.title.trim()
          : '',
      url:
        typeof video?.url === 'string'
          ? video.url.trim()
          : '',
      order:
        typeof video?.order === 'number'
          ? video.order
          : index,
    }))
    .filter(
      (video) =>
        video.title.length > 0 &&
        video.url.length > 0
    )

  videos.sort((a, b) => {
    const aOrder =
      typeof a.order === 'number'
        ? a.order
        : 0

    const bOrder =
      typeof b.order === 'number'
        ? b.order
        : 0

    return aOrder - bOrder
  })

  return videos
}

function getCategoryMeta(
  categoryId: string
) {
  return SUNNI_LIBRARY_CATEGORIES.find(
    (category) =>
      category.id === categoryId
  )
}

export default function IslamicLibraryPage() {
  const [activeLevel, setActiveLevel] =
    useState<LibraryLevel>('الكل')

  const [
    activeCategory,
    setActiveCategory,
  ] =
    useState<SunniLibraryCategoryId>('aqidah')

  const [query, setQuery] =
    useState('')

  const [firestoreBooks, setFirestoreBooks] =
    useState<LibraryBook[]>([])

  const [loadingBooks, setLoadingBooks] =
    useState(true)

  const [loadError, setLoadError] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function loadBooks() {
      try {
        setLoadingBooks(true)
        setLoadError('')

        const snapshot = await getDocs(
          collection(
            db,
            'islamicLibraryBooks'
          )
        )

        const result: LibraryBook[] = []

        snapshot.forEach((item) => {
          const data =
            item.data() as FirestoreLibraryBook

          /*
           * الكتاب المحذوف/المخفي لا يظهر للمستخدم.
           */
          if (data.deleted === true) {
            return
          }

          const title =
            typeof data.title === 'string'
              ? data.title.trim()
              : ''

          if (!title) {
            return
          }

          const id =
            typeof data.id === 'string' &&
            data.id.trim()
              ? data.id.trim()
              : item.id

          result.push({
            id,
            title,
            author:
              typeof data.author === 'string' &&
              data.author.trim()
                ? data.author.trim()
                : 'غير محدد',

            category:
              normalizeCategory(
                data.category
              ),

            level:
              normalizeLevel(
                data.level
              ),

            description:
              typeof data.description === 'string'
                ? data.description.trim()
                : '',

            readingUrl:
              typeof data.readingUrl === 'string' &&
              data.readingUrl.trim()
                ? data.readingUrl.trim()
                : null,

            readingLabel:
              typeof data.readingLabel === 'string' &&
              data.readingLabel.trim()
                ? data.readingLabel.trim()
                : null,

            downloadUrl:
              typeof data.downloadUrl === 'string' &&
              data.downloadUrl.trim()
                ? data.downloadUrl.trim()
                : null,

            downloadLabel:
              typeof data.downloadLabel === 'string' &&
              data.downloadLabel.trim()
                ? data.downloadLabel.trim()
                : null,

            sharhTitle:
              typeof data.sharhTitle === 'string' &&
              data.sharhTitle.trim()
                ? data.sharhTitle.trim()
                : null,

            sharhAuthor:
              typeof data.sharhAuthor === 'string' &&
              data.sharhAuthor.trim()
                ? data.sharhAuthor.trim()
                : null,

            sharhUrl:
              typeof data.sharhUrl === 'string' &&
              data.sharhUrl.trim()
                ? data.sharhUrl.trim()
                : null,

            sharhLabel:
              typeof data.sharhLabel === 'string' &&
              data.sharhLabel.trim()
                ? data.sharhLabel.trim()
                : null,

            videos:
              normalizeDynamicVideos(
                data.videos
              ),

            source: 'firestore',
          })
        })

        if (!cancelled) {
          setFirestoreBooks(result)
        }
      } catch {
        if (!cancelled) {
          /*
           * الكتب الثابتة ستستمر في الظهور حتى
           * إذا تعذر تحميل Firestore.
           */
          setLoadError(
            'تعذر تحديث الكتب المضافة من لوحة الإدارة حاليًا، وتم عرض المكتبة الأساسية.'
          )
          setFirestoreBooks([])
        }
      } finally {
        if (!cancelled) {
          setLoadingBooks(false)
        }
      }
    }

    void loadBooks()

    return () => {
      cancelled = true
    }
  }, [])

  const allBooks = useMemo<LibraryBook[]>(
    () => {
      const staticBooks: LibraryBook[] =
        SUNNI_LIBRARY_BOOKS.map(
          (book) => ({
            id: book.id,
            title: book.title,
            author: book.author,
            category: book.category,
            level:
              normalizeLevel(
                book.level
              ),
            description:
              book.description,

            readingUrl:
              book.readingUrl ||
              null,

            readingLabel:
              book.readingLabel ||
              null,

            downloadUrl: null,
            downloadLabel: null,

            sharhTitle:
              book.sharhTitle ||
              null,

            sharhAuthor:
              book.sharhAuthor ||
              null,

            sharhUrl:
              book.sharhUrl ||
              null,

            sharhLabel:
              book.sharhLabel ||
              null,

            videos: [],

            source: 'static',
          })
        )

      /*
       * Firestore له الأولوية عند تكرار الـ id.
       * بهذه الطريقة يستطيع الأدمن تعديل بيانات
       * كتاب معروف بدون ظهور نسخة مكررة.
       */
      const firestoreIds =
        new Set(
          firestoreBooks.map(
            (book) => book.id
          )
        )

      const merged = [
        ...staticBooks.filter(
          (book) =>
            !firestoreIds.has(
              book.id
            )
        ),
        ...firestoreBooks,
      ]

      return merged
    },
    [firestoreBooks]
  )

  const categoryCounts = useMemo(
    () => {
      const counts: Record<
        string,
        number
      > = {}

      SUNNI_LIBRARY_CATEGORIES.forEach(
        (category) => {
          counts[category.id] = 0
        }
      )

      allBooks.forEach((book) => {
        const key =
          normalizeCategory(
            book.category
          )

        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            key
          )
        ) {
          counts[key] += 1
        }
      })

      return counts
    },
    [allBooks]
  )

  const levelCounts = useMemo(
    () => ({
      مبتدئ: allBooks.filter(
        (book) =>
          normalizeLevel(
            book.level
          ) === 'مبتدئ'
      ).length,

      متوسط: allBooks.filter(
        (book) =>
          normalizeLevel(
            book.level
          ) === 'متوسط'
      ).length,

      متقدم: allBooks.filter(
        (book) =>
          normalizeLevel(
            book.level
          ) === 'متقدم'
      ).length,

      الكل: allBooks.length,
    }),
    [allBooks]
  )

  const visibleCategories =
    useMemo(
      () =>
        SUNNI_LIBRARY_CATEGORIES.filter(
          (category) => {
            if (
              activeLevel ===
              'الكل'
            ) {
              return true
            }

            return allBooks.some(
              (book) =>
                normalizeLevel(
                  book.level
                ) === activeLevel &&
                book.category ===
                  category.id
            )
          }
        ),
      [activeLevel, allBooks]
    )

  useEffect(() => {
    const stillVisible =
      visibleCategories.some(
        (category) =>
          category.id ===
          activeCategory
      )

    if (!stillVisible) {
      const first =
        visibleCategories[0]

      if (first) {
        setActiveCategory(
          first.id
        )
      }
    }
  }, [
    activeCategory,
    visibleCategories,
  ])

  const activeCategoryMeta =
    SUNNI_LIBRARY_CATEGORIES.find(
      (category) =>
        category.id ===
        activeCategory
    )

  const books = useMemo(
    () => {
      const normalizedQuery =
        normalizeText(query)

      return allBooks.filter(
        (book) => {
          if (
            activeLevel !==
              'الكل' &&
            normalizeLevel(
              book.level
            ) !== activeLevel
          ) {
            return false
          }

          if (
            book.category !==
            activeCategory
          ) {
            return false
          }

          if (!normalizedQuery) {
            return true
          }

          const searchable = normalizeText(
            [
              book.title,
              book.author,
              book.description,
              book.category,
              book.sharhTitle ||
                '',
              book.sharhAuthor ||
                '',
              book.sharhLabel ||
                '',
            ].join(' ')
          )

          return searchable.includes(
            normalizedQuery
          )
        }
      )
    },
    [
      activeCategory,
      activeLevel,
      allBooks,
      query,
    ]
  )

  const currentLevelMeta =
    LEVELS.find(
      (level) =>
        level.id ===
        activeLevel
    )

  const allCategoriesCount =
    useMemo(
      () =>
        visibleCategories.reduce(
          (sum, category) =>
            sum +
            (
              activeLevel ===
              'الكل'
                ? categoryCounts[
                    category.id
                  ] || 0
                : allBooks.filter(
                    (book) =>
                      normalizeLevel(
                        book.level
                      ) ===
                        activeLevel &&
                      book.category ===
                        category.id
                  ).length
            ),
          0
        ),
      [
        activeLevel,
        allBooks,
        categoryCounts,
        visibleCategories,
      ]
    )

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-mushaf-paper px-4 sm:px-6 lg:px-8 pb-32"
    >
      <div className="mx-auto max-w-7xl pt-5 sm:pt-8">

        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-11 h-11 rounded-2xl bg-white border border-mushaf-gold/25 shadow-sm text-mushaf-teal flex items-center justify-center hover:bg-mushaf-teal hover:text-white transition"
              aria-label="العودة للرئيسية"
            >
              <ArrowRight size={20} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-mushaf-teal">
                <LibraryBig
                  size={22}
                />

                <h1 className="text-xl sm:text-2xl font-black">
                  المكتبة الشرعية
                </h1>
              </div>

              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                مكتبة منظمة للعلوم الشرعية مع
                الكتب والشرح والدروس المرئية.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/mushaf"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mushaf-teal text-white px-5 py-3 text-sm font-black shadow-sm hover:opacity-95"
            >
              العودة للمصحف
              <BookOpen size={17} />
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-[30px] bg-gradient-to-br from-mushaf-teal to-[#11464D] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-white/5 blur-2xl" />

          <div className="absolute -bottom-24 -right-20 w-72 h-72 rounded-full bg-mushaf-gold/10 blur-3xl" />

          <div className="relative z-10 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-black text-mushaf-gold">
              <GraduationCap
                size={15}
              />
              المنصة القرآنية الشاملة
            </div>

            <h2 className="mt-4 text-2xl sm:text-3xl font-black leading-tight">
              طريقك إلى القراءة المنهجية في العلوم الشرعية
            </h2>

            <p className="mt-3 text-sm sm:text-base leading-7 text-white/80 max-w-3xl">
              اختر المستوى ثم المجال، وتصفح الكتب
              والمواد التعليمية. كل كتاب يعرض عنوانه
              الكامل ومؤلفه ومصادر القراءة والتحميل
              والشرح والدروس المتاحة داخل المنصة.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 border border-white/10 px-3 py-2 text-[11px] font-black">
                {allBooks.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                كتاب ومادة
              </span>

              <span className="rounded-full bg-white/10 border border-white/10 px-3 py-2 text-[11px] font-black">
                {levelCounts.مبتدئ.toLocaleString(
                  'ar-EG'
                )}{' '}
                تمهيدي
              </span>

              <span className="rounded-full bg-white/10 border border-white/10 px-3 py-2 text-[11px] font-black">
                {levelCounts.متوسط.toLocaleString(
                  'ar-EG'
                )}{' '}
                متوسط
              </span>

              <span className="rounded-full bg-white/10 border border-white/10 px-3 py-2 text-[11px] font-black">
                {levelCounts.متقدم.toLocaleString(
                  'ar-EG'
                )}{' '}
                متقدم
              </span>
            </div>
          </div>
        </section>

        {loadError && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            {loadError}
          </div>
        )}

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black text-mushaf-teal">
                المسار العلمي
              </p>

              <h3 className="mt-1 text-xl sm:text-2xl font-black text-mushaf-dark">
                مستويات التعلم
              </h3>
            </div>

            {loadingBooks && (
              <div className="inline-flex items-center gap-2 text-xs font-bold text-gray-500">
                <Loader2
                  size={15}
                  className="animate-spin"
                />
                تحديث المكتبة
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {LEVELS.map(
              (level) => {
                const active =
                  level.id ===
                  activeLevel

                const count =
                  levelCounts[
                    level.id
                  ]

                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() =>
                      setActiveLevel(
                        level.id
                      )}
                    className={`text-right rounded-[24px] border p-4 sm:p-5 transition min-h-[118px] ${
                      active
                        ? 'bg-mushaf-teal text-white border-mushaf-teal shadow-lg'
                        : 'bg-white text-mushaf-dark border-mushaf-border/30 hover:border-mushaf-teal/40 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          active
                            ? 'bg-white/10'
                            : 'bg-mushaf-paper text-mushaf-teal'
                        }`}
                      >
                        <GraduationCap
                          size={19}
                        />
                      </div>

                      <span
                        className={`text-[10px] font-black rounded-full px-2.5 py-1.5 ${
                          active
                            ? 'bg-white/10'
                            : 'bg-mushaf-paper text-gray-500'
                        }`}
                      >
                        {count.toLocaleString(
                          'ar-EG'
                        )}
                      </span>
                    </div>

                    <div className="mt-4 text-sm font-black">
                      {level.label}
                    </div>

                    <div
                      className={`mt-1 text-[11px] leading-5 ${
                        active
                          ? 'text-white/70'
                          : 'text-gray-500'
                      }`}
                    >
                      {level.short}
                    </div>
                  </button>
                )
              }
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black text-mushaf-teal">
                {currentLevelMeta?.label ||
                  'المكتبة'}
              </p>

              <h3 className="text-xl font-black text-mushaf-dark mt-1">
                المجالات العلمية
              </h3>
            </div>

            <p className="text-xs text-gray-500">
              {allCategoriesCount.toLocaleString(
                'ar-EG'
              )}{' '}
              مادة ضمن المستوى المحدد
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {visibleCategories.map(
              (category) => {
                const active =
                  category.id ===
                  activeCategory

                const count =
                  activeLevel ===
                  'الكل'
                    ? categoryCounts[
                        category.id
                      ] || 0
                    : allBooks.filter(
                        (book) =>
                          normalizeLevel(
                            book.level
                          ) ===
                            activeLevel &&
                          book.category ===
                            category.id
                      ).length

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setActiveCategory(
                        category.id
                      )}
                    className={`text-right rounded-2xl border p-4 transition min-h-[112px] ${
                      active
                        ? 'bg-mushaf-teal text-white border-mushaf-teal shadow-lg'
                        : 'bg-white text-mushaf-dark border-mushaf-border/30 hover:border-mushaf-teal/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <BookOpen
                        size={18}
                      />

                      <span
                        className={`text-[10px] font-black rounded-full px-2 py-1 ${
                          active
                            ? 'bg-white/15'
                            : 'bg-mushaf-paper text-gray-500'
                        }`}
                      >
                        {count.toLocaleString(
                          'ar-EG'
                        )}
                      </span>
                    </div>

                    <div className="mt-5 text-sm font-black">
                      {category.label}
                    </div>

                    <div
                      className={`mt-1 text-[11px] leading-5 ${
                        active
                          ? 'text-white/70'
                          : 'text-gray-500'
                      }`}
                    >
                      {category.short}
                    </div>
                  </button>
                )
              }
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-mushaf-border/20 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-mushaf-teal">
                {activeCategoryMeta?.label ||
                  'المكتبة'}
              </p>

              <h3 className="text-xl font-black text-mushaf-dark mt-1">
                {books.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                كتاب/مادة
              </h3>

              <p className="mt-1 text-[11px] text-gray-500">
                {activeLevel ===
                'الكل'
                  ? 'جميع المستويات'
                  : currentLevelMeta?.label}
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-mushaf-paper px-4 h-12 w-full lg:max-w-xl">
              <Search
                size={18}
                className="text-gray-400 shrink-0"
              />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target
                      .value
                  )
                }
                placeholder="ابحث باسم الكتاب أو المؤلف أو الشرح..."
                className="w-full outline-none bg-transparent text-sm text-gray-800"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {books.map(
            (book) => {
              const category =
                getCategoryMeta(
                  book.category
                )

              const hasVideos =
                book.videos.length >
                0

              return (
                <article
                  key={book.id}
                  className="rounded-[28px] bg-white border border-mushaf-border/15 shadow-sm p-5 sm:p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center shrink-0">
                        <BookOpen
                          size={21}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-base sm:text-lg font-black text-mushaf-dark leading-7">
                          {book.title}
                        </h4>

                        <p className="text-xs text-gray-500 mt-1">
                          المؤلف:{' '}
                          {book.author}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-mushaf-gold/10 text-mushaf-gold px-2.5 py-1 text-[10px] font-black">
                            {book.level}
                          </span>

                          {category && (
                            <span className="inline-flex items-center rounded-full bg-mushaf-teal/10 text-mushaf-teal px-2.5 py-1 text-[10px] font-black">
                              {category.label}
                            </span>
                          )}

                          {book.source ===
                            'firestore' && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-black">
                              مضاف من الإدارة
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-7 text-gray-600">
                    {book.description ||
                      'كتاب علمي ضمن المكتبة الشرعية في مصحف سميع.'}
                  </p>

                  <div className="mt-5 rounded-2xl bg-mushaf-paper border border-mushaf-gold/15 p-4">
                    <div className="flex items-center gap-2 text-mushaf-teal text-xs font-black">
                      <GraduationCap
                        size={16}
                      />
                      الشرح والدروس
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-700">
                      {book.sharhTitle ||
                        'تتوفر مصادر شرح مرتبطة بالكتاب'}
                      {book.sharhAuthor
                        ? ` — ${book.sharhAuthor}`
                        : ''}
                    </p>

                    {hasVideos && (
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mushaf-teal/10 text-mushaf-teal px-3 py-1.5 text-[10px] font-black">
                        <PlayCircle
                          size={14}
                        />
                        {book.videos.length.toLocaleString(
                          'ar-EG'
                        )}{' '}
                        درس مرئي
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/islamic-library/book/${encodeURIComponent(
                        book.id
                      )}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-mushaf-teal text-white px-4 py-2.5 text-xs font-black hover:opacity-90"
                    >
                      قراءة الكتاب
                      <BookOpen
                        size={14}
                      />
                    </Link>

                    {book.downloadUrl && (
                      <a
                        href={
                          book.downloadUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-2 rounded-xl bg-mushaf-gold text-white px-4 py-2.5 text-xs font-black hover:opacity-90"
                      >
                        {book.downloadLabel ||
                          'تحميل الكتاب'}
                        <Download
                          size={14}
                        />
                      </a>
                    )}

                    {book.readingUrl && (
                      <a
                        href={
                          book.readingUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-white text-mushaf-teal border border-mushaf-teal/20 px-4 py-2.5 text-xs font-black hover:bg-mushaf-teal/5"
                      >
                        {book.readingLabel ||
                          'المصدر'}
                        <ExternalLink
                          size={14}
                        />
                      </a>
                    )}

                    {book.sharhUrl && (
                      <a
                        href={
                          book.sharhUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-white text-mushaf-teal border border-mushaf-teal/20 px-4 py-2.5 text-xs font-black hover:bg-mushaf-teal/5"
                      >
                        {book.sharhLabel ||
                          'فتح الشرح'}
                        <GraduationCap
                          size={14}
                        />
                      </a>
                    )}

                    {hasVideos && (
                      <Link
                        href={`/islamic-library/book/${encodeURIComponent(
                          book.id
                        )}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-mushaf-paper text-mushaf-teal border border-mushaf-border/20 px-4 py-2.5 text-xs font-black hover:border-mushaf-teal/40"
                      >
                        مشاهدة الدروس
                        <PlayCircle
                          size={14}
                        />
                      </Link>
                    )}
                  </div>
                </article>
              )
            }
          )}
        </section>

        {!books.length && (
          <section className="mt-5 rounded-[28px] bg-white border border-dashed border-gray-300 py-16 px-6 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center">
              <Search size={24} />
            </div>

            <h3 className="mt-5 text-lg font-black text-mushaf-dark">
              لا توجد نتائج
            </h3>

            <p className="mt-2 text-sm leading-7 text-gray-500">
              لا توجد كتب مطابقة للبحث داخل
              المجال والمستوى المحددين حاليًا.
            </p>

            {query && (
              <button
                type="button"
                onClick={() =>
                  setQuery('')
                }
                className="mt-4 inline-flex items-center rounded-xl bg-mushaf-teal text-white px-4 py-2.5 text-xs font-black"
              >
                إلغاء البحث
              </button>
            )}
          </section>
        )}

        <section className="mt-6 rounded-[28px] border border-mushaf-border/15 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-mushaf-teal">
                <LibraryBig
                  size={19}
                />

                <h3 className="text-sm font-black">
                  عن المكتبة الشرعية
                </h3>
              </div>

              <p className="mt-2 text-xs leading-6 text-gray-500 max-w-3xl">
                المكتبة تجمع المواد الشرعية في مستويات
                متدرجة، وتدعم الكتب الأساسية والكتب التي
                تتم إضافتها من لوحة الإدارة، مع إمكانية
                ربط الشرح والدروس وملفات التحميل بكل كتاب.
              </p>
            </div>

            <div className="shrink-0">
              <Link
                href="/admin?tab=library"
                className="inline-flex items-center gap-2 rounded-xl border border-mushaf-gold/20 bg-mushaf-gold/5 text-mushaf-gold px-4 py-2.5 text-xs font-black"
              >
                إدارة المكتبة
                <GraduationCap
                  size={14}
                />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
