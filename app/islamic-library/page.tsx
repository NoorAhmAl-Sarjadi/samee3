'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Search,
  Download,
  PlayCircle,
  UserRound,
  Layers3,
  ChevronLeft,
  LibraryBig,
  RefreshCw,
  X,
} from 'lucide-react'
import { db } from '@/lib/firebase'
import {
  collection,
  getDocs,
} from 'firebase/firestore'

import {
  SUNNI_LIBRARY_BOOKS,
  SUNNI_LIBRARY_CATEGORIES,
  SUNNI_LIBRARY_LEVELS,
  type SunniLibraryBook,
  type SunniLibraryCategoryId,
  type SunniLibraryLevel,
} from '@/lib/islamic/sunniLibrary'

interface DynamicLibraryBook {
  id?: unknown
  category?: unknown
  title?: unknown
  author?: unknown
  level?: unknown
  description?: unknown
  readingUrl?: unknown
  readingLabel?: unknown
  sharhTitle?: unknown
  sharhAuthor?: unknown
  sharhUrl?: unknown
  sharhLabel?: unknown
  downloadUrl?: unknown
  quranpediaBookId?: unknown
}

type ViewState =
  | {
      kind: 'levels'
    }
  | {
      kind: 'categories'
      level: SunniLibraryLevel
    }
  | {
      kind: 'books'
      level: SunniLibraryLevel
      category: SunniLibraryCategoryId
    }

function isLibraryLevel(
  value: unknown
): value is SunniLibraryLevel {
  return (
    value === 'مبتدئ' ||
    value === 'متوسط' ||
    value === 'متقدم'
  )
}

function isLibraryCategory(
  value: unknown
): value is SunniLibraryCategoryId {
  return (
    value === 'aqidah' ||
    value === 'fiqh' ||
    value === 'seerah' ||
    value === 'usul-tafsir' ||
    value === 'usul-fiqh' ||
    value === 'usul-hadith'
  )
}

function toOptionalString(
  value: unknown
): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return undefined
  }

  return value.trim()
}

function normalizeDynamicBook(
  rawId: string,
  data: DynamicLibraryBook
): SunniLibraryBook | null {
  const title = toOptionalString(data.title)
  const author =
    toOptionalString(data.author) ||
    'غير محدد'

  const category = isLibraryCategory(
    data.category
  )
    ? data.category
    : null

  const level = isLibraryLevel(data.level)
    ? data.level
    : null

  if (
    !title ||
    !category ||
    !level
  ) {
    return null
  }

  const description =
    toOptionalString(data.description) ||
    'كتاب شرعي متاح ضمن مكتبة مصحف سميع.'

  const numericQuranpediaId = Number(
    data.quranpediaBookId
  )

  return {
    id:
      toOptionalString(data.id) ||
      rawId,

    category,
    title,
    author,
    level,
    description,

    readingUrl:
      toOptionalString(data.readingUrl),

    readingLabel:
      toOptionalString(data.readingLabel),

    sharhTitle:
      toOptionalString(data.sharhTitle),

    sharhAuthor:
      toOptionalString(data.sharhAuthor),

    sharhUrl:
      toOptionalString(data.sharhUrl),

    sharhLabel:
      toOptionalString(data.sharhLabel),

    downloadUrl:
      toOptionalString(data.downloadUrl),

    quranpediaBookId:
      Number.isFinite(numericQuranpediaId)
        ? numericQuranpediaId
        : undefined,
  }
}

function mergeLibraryBooks(
  staticBooks: SunniLibraryBook[],
  dynamicBooks: SunniLibraryBook[]
): SunniLibraryBook[] {
  const map = new Map<
    string,
    SunniLibraryBook
  >()

  for (const book of staticBooks) {
    map.set(book.id, book)
  }

  for (const book of dynamicBooks) {
    const previous = map.get(book.id)

    if (!previous) {
      map.set(book.id, book)
      continue
    }

    map.set(book.id, {
      ...previous,
      ...book,
      title:
        book.title || previous.title,
      author:
        book.author || previous.author,
      category:
        book.category || previous.category,
      level:
        book.level || previous.level,
      description:
        book.description ||
        previous.description,
    })
  }

  return Array.from(map.values())
}

export default function IslamicLibraryPage() {
  const [view, setView] =
    useState<ViewState>({
      kind: 'levels',
    })

  const [books, setBooks] =
    useState<SunniLibraryBook[]>(
      SUNNI_LIBRARY_BOOKS
    )

  const [loadingBooks, setLoadingBooks] =
    useState(true)

  const [booksError, setBooksError] =
    useState('')

  const [search, setSearch] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDynamicBooks() {
      try {
        setLoadingBooks(true)
        setBooksError('')

        const snapshot = await getDocs(
          collection(
            db,
            'islamicLibraryBooks'
          )
        )

        if (cancelled) {
          return
        }

        const dynamicBooks: SunniLibraryBook[] =
          snapshot.docs
            .map((item) =>
              normalizeDynamicBook(
                item.id,
                item.data() as DynamicLibraryBook
              )
            )
            .filter(
              (
                item
              ): item is SunniLibraryBook =>
                Boolean(item)
            )

        setBooks(
          mergeLibraryBooks(
            SUNNI_LIBRARY_BOOKS,
            dynamicBooks
          )
        )
      } catch (error) {
        console.error(
          'Islamic library loading error:',
          error
        )

        if (!cancelled) {
          setBooksError(
            'تعذر تحديث الكتب المضافة من لوحة الإدارة، وسيتم عرض المكتبة الأساسية.'
          )

          setBooks(SUNNI_LIBRARY_BOOKS)
        }
      } finally {
        if (!cancelled) {
          setLoadingBooks(false)
        }
      }
    }

    void loadDynamicBooks()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedLevel =
    view.kind === 'categories' ||
    view.kind === 'books'
      ? view.level
      : null

  const selectedCategory =
    view.kind === 'books'
      ? SUNNI_LIBRARY_CATEGORIES.find(
          (item) =>
            item.id === view.category
        ) || null
      : null

  const selectedLevelInfo =
    selectedLevel
      ? SUNNI_LIBRARY_LEVELS.find(
          (item) =>
            item.id === selectedLevel
        ) || null
      : null

  const currentLevelBooks =
    selectedLevel
      ? books.filter(
          (book) =>
            book.level === selectedLevel
        )
      : []

  const categoriesInLevel =
    useMemo(() => {
      if (!selectedLevel) {
        return []
      }

      const existingCategories =
        new Set(
          currentLevelBooks.map(
            (book) => book.category
          )
        )

      return SUNNI_LIBRARY_CATEGORIES.filter(
        (category) =>
          existingCategories.has(category.id)
      )
    }, [
      currentLevelBooks,
      selectedLevel,
    ])

  const filteredCategories =
    useMemo(() => {
      const normalized =
        search.trim().toLowerCase()

      if (!normalized) {
        return categoriesInLevel
      }

      return categoriesInLevel.filter(
        (category) =>
          [
            category.label,
            category.short,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalized)
      )
    }, [
      categoriesInLevel,
      search,
    ])

  const categoryBooks = useMemo(() => {
    if (view.kind !== 'books') {
      return []
    }

    const normalized =
      search.trim().toLowerCase()

    const filtered = books.filter(
      (book) =>
        book.level === view.level &&
        book.category === view.category
    )

    if (!normalized) {
      return filtered
    }

    return filtered.filter((book) =>
      [
        book.title,
        book.author,
        book.description,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [
    books,
    search,
    view,
  ])

  const levelCounts = useMemo(() => {
    return SUNNI_LIBRARY_LEVELS.map(
      (level) => ({
        ...level,
        count: books.filter(
          (book) =>
            book.level === level.id
        ).length,
      })
    )
  }, [books])

  function openLevel(
    level: SunniLibraryLevel
  ) {
    setSearch('')

    setView({
      kind: 'categories',
      level,
    })
  }

  function openCategory(
    category: SunniLibraryCategoryId
  ) {
    if (view.kind !== 'categories') {
      return
    }

    setSearch('')

    setView({
      kind: 'books',
      level: view.level,
      category,
    })
  }

  function goBack() {
    if (view.kind === 'books') {
      setSearch('')

      setView({
        kind: 'categories',
        level: view.level,
      })

      return
    }

    if (view.kind === 'categories') {
      setSearch('')

      setView({
        kind: 'levels',
      })
    }
  }

  function refreshLibrary() {
    window.location.reload()
  }

  const currentTitle =
    view.kind === 'levels'
      ? 'المكتبة الشرعية'
      : view.kind === 'categories'
        ? selectedLevelInfo?.label ||
          'المستوى'
        : selectedCategory?.label ||
          'الكتب'

  const currentSubtitle =
    view.kind === 'levels'
      ? 'مناهج علمية مرتبة من التأسيس إلى التعمق'
      : view.kind === 'categories'
        ? selectedLevelInfo?.description ||
          ''
        : selectedCategory?.short ||
          ''

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[var(--bg-main)] pb-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="flex flex-col gap-4 rounded-[30px] border border-[rgba(14,165,233,0.12)] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                {view.kind !== 'levels' ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(2,132,199,0.15)] bg-[rgba(2,132,199,0.05)] text-[var(--royal-blue)] transition hover:bg-[rgba(2,132,199,0.1)]"
                    aria-label="العودة"
                  >
                    <ArrowRight size={20} />
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(2,132,199,0.15)] bg-[rgba(2,132,199,0.05)] text-[var(--royal-blue)] transition hover:bg-[rgba(2,132,199,0.1)]"
                    aria-label="الرئيسية"
                  >
                    <ArrowRight size={20} />
                  </Link>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(2,132,199,0.08)] px-3 py-1.5 text-[11px] font-black text-[var(--royal-blue)]">
                      <LibraryBig size={14} />
                      المكتبة الشرعية
                    </span>

                    {selectedLevel ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700">
                        {selectedLevel}
                      </span>
                    ) : null}

                    {selectedCategory ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                        {selectedCategory.label}
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-3 text-2xl font-black text-[var(--text-main)] sm:text-3xl">
                    {currentTitle}
                  </h1>

                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                    {currentSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {view.kind !== 'levels' ? (
                  <button
                    type="button"
                    onClick={() =>
                      setView({
                        kind: 'levels',
                      })
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-[rgba(2,132,199,0.15)] bg-white px-4 text-xs font-black text-[var(--royal-blue)] transition hover:bg-slate-50"
                  >
                    <Layers3 size={16} />
                    كل المستويات
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={refreshLibrary}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                >
                  <RefreshCw size={16} />
                  تحديث
                </button>
              </div>
            </div>

            {view.kind !== 'levels' ? (
              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder={
                    view.kind === 'categories'
                      ? 'ابحث عن تصنيف...'
                      : 'ابحث باسم الكتاب أو المؤلف...'
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 pl-12 text-sm font-bold text-slate-800 outline-none transition focus:border-[var(--royal-blue)] focus:bg-white"
                />

                {search ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch('')
                    }
                    className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700"
                    aria-label="مسح البحث"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}

            {booksError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-800">
                {booksError}
              </div>
            ) : null}
          </div>
        </header>

        {view.kind === 'levels' ? (
          <section>
            <div className="mb-5">
              <p className="text-xs font-black text-amber-600">
                منهج متدرج
              </p>

              <h2 className="mt-1 text-xl font-black text-[var(--text-main)] sm:text-2xl">
                اختر المستوى العلمي
              </h2>

              <p className="mt-2 text-sm leading-7 text-slate-500">
                ابدأ من المستوى المناسب لك، ثم اختر التخصص، وبعدها اختر الكتاب المطلوب.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {levelCounts.map(
                (level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() =>
                      openLevel(
                        level.id
                      )
                    }
                    className="group relative overflow-hidden rounded-[30px] border border-[rgba(14,165,233,0.12)] bg-white p-6 text-right shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[rgba(2,132,199,0.25)] hover:shadow-xl"
                  >
                    <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-[rgba(2,132,199,0.05)] transition duration-500 group-hover:scale-125" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(2,132,199,0.08)] text-[var(--royal-blue)]">
                          <GraduationCap size={28} />
                        </div>

                        <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-500">
                          {level.count.toLocaleString(
                            'ar-EG'
                          )}{' '}
                          كتاب
                        </span>
                      </div>

                      <p className="mt-7 text-xs font-black text-amber-600">
                        {level.id}
                      </p>

                      <h3 className="mt-1 text-2xl font-black text-[var(--text-main)]">
                        {level.label}
                      </h3>

                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        {level.description}
                      </p>

                      <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                        <span className="text-xs font-black text-slate-600">
                          استعراض التصنيفات
                        </span>

                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--royal-blue)] shadow-sm">
                          <ArrowLeft size={17} />
                        </span>
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          </section>
        ) : null}

        {view.kind === 'categories' ? (
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black text-amber-600">
                  {selectedLevel}
                </p>

                <h2 className="mt-1 text-xl font-black text-[var(--text-main)] sm:text-2xl">
                  اختر القسم الشرعي
                </h2>

                <p className="mt-2 text-sm leading-7 text-slate-500">
                  تظهر هنا التصنيفات التي تحتوي على كتب في المستوى المختار.
                </p>
              </div>

              <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm">
                {filteredCategories.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                تصنيفات
              </span>
            </div>

            {loadingBooks ? (
              <LibraryLoading />
            ) : filteredCategories.length === 0 ? (
              <EmptyState
                title="لا توجد تصنيفات مطابقة"
                description="جرّب تغيير كلمة البحث أو اختيار مستوى آخر."
                onClear={() =>
                  setSearch('')
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCategories.map(
                  (category) => {
                    const count =
                      currentLevelBooks.filter(
                        (book) =>
                          book.category ===
                          category.id
                      ).length

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          openCategory(
                            category.id
                          )
                        }
                        className="group rounded-[28px] border border-slate-200 bg-white p-5 text-right shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[rgba(2,132,199,0.2)] hover:shadow-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[rgba(2,132,199,0.08)] text-[var(--royal-blue)]">
                            <BookOpen size={25} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-black text-[var(--text-main)]">
                              {category.label}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              {category.short}
                            </p>
                          </div>

                          <ChevronLeft
                            size={19}
                            className="shrink-0 text-slate-300 transition group-hover:-translate-x-1 group-hover:text-[var(--royal-blue)]"
                          />
                        </div>

                        <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-xs font-bold text-slate-500">
                            الكتب المتاحة
                          </span>

                          <span className="text-sm font-black text-[var(--royal-blue)]">
                            {count.toLocaleString(
                              'ar-EG'
                            )}
                          </span>
                        </div>
                      </button>
                    )
                  }
                )}
              </div>
            )}
          </section>
        ) : null}

        {view.kind === 'books' ? (
          <section>
            <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-black text-amber-600">
                  {selectedLevel}
                  {' • '}
                  {selectedCategory?.label}
                </p>

                <h2 className="mt-1 text-xl font-black text-[var(--text-main)] sm:text-2xl">
                  كتب {selectedCategory?.label}
                </h2>

                <p className="mt-2 text-sm leading-7 text-slate-500">
                  اختر أي كتاب لفتح صفحته الكاملة ومحتواه وشروحه ودروسه.
                </p>
              </div>

              <div className="rounded-2xl bg-[rgba(2,132,199,0.06)] px-4 py-3 text-center">
                <div className="text-2xl font-black text-[var(--royal-blue)]">
                  {categoryBooks.length.toLocaleString(
                    'ar-EG'
                  )}
                </div>

                <div className="mt-1 text-[10px] font-black text-slate-500">
                  كتاب
                </div>
              </div>
            </div>

            {loadingBooks ? (
              <LibraryLoading />
            ) : categoryBooks.length === 0 ? (
              <EmptyState
                title="لا توجد كتب مطابقة"
                description="جرّب تغيير البحث أو العودة إلى الأقسام الأخرى."
                onClear={() =>
                  setSearch('')
                }
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {categoryBooks.map(
                  (book) => (
                    <LibraryBookCard
                      key={book.id}
                      book={book}
                    />
                  )
                )}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  )
}

function LibraryBookCard({
  book,
}: {
  book: SunniLibraryBook
}) {
  const categoryLabel =
    book.category === 'aqidah'
      ? 'العقيدة'
      : book.category === 'fiqh'
        ? 'الفقه'
        : book.category === 'seerah'
          ? 'السيرة'
          : book.category === 'usul-tafsir'
            ? 'أصول التفسير'
            : book.category === 'usul-fiqh'
              ? 'أصول الفقه'
              : 'أصول الحديث'

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[rgba(2,132,199,0.2)] hover:shadow-xl">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-[rgba(2,132,199,0.05)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(2,132,199,0.09)] text-[var(--royal-blue)] shadow-sm">
            <BookOpen size={30} />
          </div>

          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700">
            {book.level}
          </span>
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-black text-[var(--royal-blue)]">
            {categoryLabel}
          </p>

          <h3 className="mt-1 text-xl font-black leading-8 text-[var(--text-main)]">
            {book.title}
          </h3>

          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
            <UserRound
              size={15}
              className="text-[var(--royal-blue)]"
            />

            <span>
              {book.author}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-3 text-sm leading-7 text-slate-500">
          {book.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href={`/islamic-library/book/${encodeURIComponent(
              book.id
            )}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--royal-blue)] px-3 text-xs font-black text-white transition hover:opacity-90"
          >
            <BookOpen size={16} />
            فتح الكتاب
          </Link>

          {book.downloadUrl ? (
            <a
              href={book.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(2,132,199,0.15)] bg-[rgba(2,132,199,0.05)] px-3 text-xs font-black text-[var(--royal-blue)] transition hover:bg-[rgba(2,132,199,0.09)]"
            >
              <Download size={16} />
              تنزيل
            </a>
          ) : (
            <Link
              href={`/islamic-library/book/${encodeURIComponent(
                book.id
              )}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
            >
              <Layers3 size={16} />
              التفاصيل
            </Link>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={`/islamic-library/book/${encodeURIComponent(
              book.id
            )}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-100"
          >
            <PlayCircle size={15} />
            الشرح والدروس
          </Link>

          {book.readingUrl ? (
            <a
              href={book.readingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-100"
            >
              <ArrowLeft size={15} />
              المصدر
            </a>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-black text-slate-400">
              <Layers3 size={15} />
              قيد التجهيز
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function LibraryLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="h-14 w-14 rounded-2xl bg-slate-100" />

          <div className="mt-6 h-4 w-24 rounded bg-slate-100" />

          <div className="mt-3 h-7 w-3/4 rounded bg-slate-100" />

          <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />

          <div className="mt-6 h-20 rounded-2xl bg-slate-50" />

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-11 rounded-xl bg-slate-100" />
            <div className="h-11 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  title,
  description,
  onClear,
}: {
  title: string
  description: string
  onClear: () => void
}) {
  return (
    <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
        <Search size={28} />
      </div>

      <h3 className="mt-5 text-lg font-black text-[var(--text-main)]">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">
        {description}
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--royal-blue)] px-5 py-3 text-xs font-black text-white"
      >
        <RefreshCw size={15} />
        مسح البحث
      </button>
    </div>
  )
}
