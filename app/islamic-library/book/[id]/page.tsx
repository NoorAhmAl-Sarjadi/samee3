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
