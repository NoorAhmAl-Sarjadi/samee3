'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Download,
  ExternalLink,
  GraduationCap,
  Loader2,
  PlayCircle,
  Search,
  X,
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

interface IslamicLibrarySheetProps {
  open: boolean
  onClose: () => void
  ayah?: {
    text: string
    surahName: string
    surahNumber: number
    ayahNumber: number
  } | null
}

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

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

function normalizeLevel(value?: string | null) {
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

function normalizeVideos(
  videos?: DynamicLibraryVideo[]
) {
  if (!Array.isArray(videos)) {
    return []
  }

  const normalized = videos
    .map((video, index) => ({
      id:
        typeof video?.id === 'string' &&
        video.id.trim()
          ? video.id.trim()
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

  normalized.sort(
    (a, b) =>
      a.order - b.order
  )

  return normalized
}

export default function IslamicLibrarySheet({
  open,
  onClose,
  ayah,
}: IslamicLibrarySheetProps) {
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
    useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function loadFirestoreBooks() {
      try {
        setLoadingBooks(true)

        const snapshot = await getDocs(
          collection(
            db,
            'islamicLibraryBooks'
          )
        )

        const result: LibraryBook[] = []

        snapshot.forEach((docSnapshot) => {
          const data =
            docSnapshot.data() as FirestoreLibraryBook

          if (
            data.deleted === true
          ) {
            return
          }

          const title =
            typeof data.title === 'string'
              ? data.title.trim()
              : ''

          if (!title) {
            return
          }

          result.push({
            id:
              typeof data.id === 'string' &&
              data.id.trim()
                ? data.id.trim()
                : docSnapshot.id,

            title,

            author:
              typeof data.author === 'string' &&
              data.author.trim()
                ? data.author.trim()
                : 'غير محدد',

            category:
              typeof data.category === 'string'
                ? data.category.trim()
                : '',

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
              normalizeVideos(
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
          setFirestoreBooks([])
        }
      } finally {
        if (!cancelled) {
          setLoadingBooks(false)
        }
      }
    }

    void loadFirestoreBooks()

    return () => {
      cancelled = true
    }
  }, [open])

  const allBooks =
    useMemo<LibraryBook[]>(
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

        const firestoreIds =
          new Set(
            firestoreBooks.map(
              (book) => book.id
            )
          )

        return [
          ...staticBooks.filter(
            (book) =>
              !firestoreIds.has(
                book.id
              )
          ),
          ...firestoreBooks,
        ]
      },
      [firestoreBooks]
    )

  const books =
    useMemo(
      () => {
        const normalizedQuery =
          normalizeText(query)

        return allBooks.filter(
          (book) => {
            if (
              book.category !==
              activeCategory
            ) {
              return false
            }

            if (!normalizedQuery) {
              return true
            }

            const searchable =
              normalizeText(
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
        allBooks,
        query,
      ]
    )

  const quranpediaAyahUrl =
    ayah
      ? `https://api.quranpedia.net/embed?surah=${ayah.surahNumber}&ayah=${ayah.ayahNumber}&type=tafsir`
      : 'https://quranpedia.net/'

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5">
      <div className="w-full sm:max-w-6xl h-[94vh] sm:h-[88vh] bg-[#FBF8F0] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-mushaf-gold/25 flex flex-col">

        <div className="px-5 py-4 border-b border-mushaf-border/20 bg-white/95 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-mushaf-teal">
              <BookOpen size={21} />

              <h2 className="font-black text-base sm:text-lg">
                المكتبة الشرعية
              </h2>

              {loadingBooks && (
                <Loader2
                  size={15}
                  className="animate-spin text-mushaf-gold"
                />
              )}
            </div>

            <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">
              كتب منتقاة في العلوم الشرعية مع الشرح
              والدروس وملفات التحميل
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center justify-center shrink-0 transition"
            aria-label="إغلاق المكتبة"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <div className="rounded-2xl border border-mushaf-gold/20 bg-mushaf-paper px-4 py-3 text-xs leading-6 text-gray-700">
            <span className="font-black text-mushaf-teal">
              المكتبة داخل المصحف:
            </span>{' '}
            يمكنك الوصول إلى الكتب والشرح من نفس
            المنصة، والكتب التي تتم إضافتها من لوحة
            الإدارة تظهر هنا تلقائيًا.
          </div>
        </div>

        {ayah && (
          <div className="px-5 pt-3 shrink-0">
            <div className="rounded-2xl bg-mushaf-teal text-white p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-white/65">
                    مرتبط بالآية الحالية
                  </p>

                  <p className="font-black mt-1">
                    سورة {ayah.surahName} • الآية{' '}
                    {ayah.ayahNumber.toLocaleString(
                      'ar-EG'
                    )}
                  </p>
                </div>

                <a
                  href={quranpediaAyahUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20 shrink-0"
                >
                  موسوعة الآية
                  <ExternalLink
                    size={14}
                  />
                </a>
              </div>

              <p className="mt-3 text-sm leading-7 text-white/90 line-clamp-2">
                {ayah.text}
              </p>
            </div>
          </div>
        )}

        <div className="px-5 pt-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {SUNNI_LIBRARY_CATEGORIES.map(
            (category) => {
              const active =
                category.id ===
                activeCategory

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setActiveCategory(
                      category.id
                    )
                  }
                  className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-black border transition ${
                    active
                      ? 'bg-mushaf-teal text-white border-mushaf-teal shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-mushaf-teal/30'
                  }`}
                >
                  {category.label}
                </button>
              )
            }
          )}
        </div>

        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 h-12">
            <Search
              size={18}
              className="text-gray-400 shrink-0"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value
                )
              }
              placeholder="ابحث باسم الكتاب أو المؤلف أو الشرح..."
              className="w-full outline-none bg-transparent text-sm text-gray-800"
            />
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {books.map(
              (book) => {
                const hasVideos =
                  book.videos.length >
                  0

                return (
                  <article
                    key={book.id}
                    className="rounded-[26px] bg-white border border-mushaf-border/15 shadow-sm p-5 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center shrink-0">
                          <BookOpen
                            size={19}
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-black text-mushaf-dark text-sm sm:text-base leading-6">
                            {book.title}
                          </h3>

                          <p className="text-xs text-gray-500 mt-1">
                            {book.author}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-black rounded-full bg-mushaf-gold/10 text-mushaf-gold px-2.5 py-1 shrink-0">
                        {book.level}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-600 leading-6 mt-4">
                      {book.description ||
                        'كتاب شرعي ضمن مكتبة مصحف سميع.'}
                    </p>

                    <div className="mt-4 rounded-2xl bg-mushaf-paper border border-mushaf-gold/15 p-3">
                      <div className="flex items-center gap-2 text-mushaf-teal text-xs font-black">
                        <GraduationCap
                          size={16}
                        />

                        <span>
                          الشرح والدروس
                        </span>
                      </div>

                      <p className="text-xs text-gray-700 mt-2 leading-5">
                        {book.sharhTitle ||
                          'شرح متاح من المصدر أو من الدروس المرتبطة بالكتاب'}
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

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Link
                        href={`/islamic-library/book/${encodeURIComponent(
                          book.id
                        )}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-2 rounded-xl bg-mushaf-teal text-white px-3.5 py-2.5 text-xs font-black hover:opacity-90"
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
                          className="inline-flex items-center gap-2 rounded-xl bg-mushaf-gold text-white px-3.5 py-2.5 text-xs font-black hover:opacity-90"
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
                          className="inline-flex items-center gap-2 rounded-xl bg-white text-mushaf-teal border border-mushaf-teal/20 px-3.5 py-2.5 text-xs font-bold hover:bg-mushaf-teal/5"
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
                          className="inline-flex items-center gap-2 rounded-xl bg-mushaf-paper text-mushaf-teal border border-mushaf-teal/20 px-3.5 py-2.5 text-xs font-bold hover:bg-mushaf-teal/5"
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
                          onClick={onClose}
                          className="inline-flex items-center gap-2 rounded-xl bg-white text-mushaf-teal border border-mushaf-border/20 px-3.5 py-2.5 text-xs font-bold hover:border-mushaf-teal/40"
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
          </div>

          {!books.length && (
            <div className="py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-mushaf-border/15 text-mushaf-teal flex items-center justify-center">
                <Search size={23} />
              </div>

              <p className="mt-4 text-sm font-black text-mushaf-dark">
                لا توجد نتيجة مطابقة
              </p>

              <p className="mt-2 text-xs leading-6 text-gray-500">
                جرّب البحث بكلمة أخرى أو اختر مجالًا
                مختلفًا.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
