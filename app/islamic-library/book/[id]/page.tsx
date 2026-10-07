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

type ReaderSource = 'quranpedia' | 'external' | 'firestore'

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
  order: number
  embedUrl?: string | null
  provider: 'youtube' | 'vimeo' | 'file' | 'external'
}

interface PublicationInfo {
  publishYear?: string | number | null
  edition?: string | null
  publisher?: string | null
  parts?: number | null
}

interface ReaderBook {
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

  videos: LearningVideo[]

  publication?: PublicationInfo | null

  quranpediaBookId?: number | null
}

interface ReaderPayload {
  success?: boolean
  source: ReaderSource
  quranpediaBookId?: number | null
  book: ReaderBook
  contents?: ReaderSection[]
  message?: string | null
}

interface ReaderStorageState {
  fontScale?: number
  darkMode?: boolean
  notes?: string
  activeSection?: number
  selectedVideoId?: string | null
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(
  value: unknown,
  fallback = ''
): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(
  value: unknown
): string | null {
  return typeof value === 'string' && value.trim()
    ? value
    : null
}

function asNumber(
  value: unknown
): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getYouTubeId(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    }

    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube-nocookie.com')
    ) {
      const queryId = parsed.searchParams.get('v')

      if (
        queryId &&
        /^[A-Za-z0-9_-]{11}$/.test(queryId)
      ) {
        return queryId
      }

      const match = parsed.pathname.match(
        /\/(?:embed|shorts|live)\/([^/?#]+)/
      )

      const pathId = match?.[1] || null

      return pathId && /^[A-Za-z0-9_-]{11}$/.test(pathId)
        ? pathId
        : null
    }
  } catch {
    return null
  }

  return null
}

function getVimeoId(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (
      host === 'vimeo.com' ||
      host.endsWith('.vimeo.com')
    ) {
      const match = parsed.pathname.match(
        /\/(?:video\/)?([0-9]+)/
      )

      return match?.[1] || null
    }
  } catch {
    return null
  }

  return null
}

function isDirectVideoFile(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(url)
}

function getVideoEmbedUrl(
  url: string
): {
  embedUrl: string | null
  provider: LearningVideo['provider']
} {
  const trimmed = url.trim()

  const youtubeId = getYouTubeId(trimmed)

  if (youtubeId) {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`,
      provider: 'youtube',
    }
  }

  const vimeoId = getVimeoId(trimmed)

  if (vimeoId) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      provider: 'vimeo',
    }
  }

  if (isDirectVideoFile(trimmed)) {
    return {
      embedUrl: trimmed,
      provider: 'file',
    }
  }

  return {
    embedUrl: null,
    provider: 'external',
  }
}

function normalizeVideo(
  value: unknown,
  index: number
): LearningVideo | null {
  if (!isRecord(value)) {
    return null
  }

  const url = asString(
    value.url ??
      value.videoUrl ??
      value.link ??
      value.href
  ).trim()

  if (!url) {
    return null
  }

  const title =
    asString(
      value.title ??
        value.name ??
        value.label,
      `الدرس ${index + 1}`
    ).trim() || `الدرس ${index + 1}`

  const order =
    asNumber(value.order) ??
    asNumber(value.position) ??
    index + 1

  const parsed = getVideoEmbedUrl(url)

  return {
    id:
      asString(value.id).trim() ||
      `video-${index + 1}`,
    title,
    url,
    order,
    embedUrl: parsed.embedUrl,
    provider: parsed.provider,
  }
}

function normalizeVideos(
  value: unknown
): LearningVideo[] {
  if (!Array.isArray(value)) {
    return []
  }

  const result: LearningVideo[] = []

  value.forEach((item, index) => {
    const normalized = normalizeVideo(item, index)

    if (normalized) {
      result.push(normalized)
    }
  })

  result.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order
    }

    return a.title.localeCompare(
      b.title,
      'ar'
    )
  })

  return result
}

function normalizePublication(
  value: unknown
): PublicationInfo | null {
  if (!isRecord(value)) {
    return null
  }

  const publishYear =
    value.publishYear ??
    value.year ??
    value.publicationYear ??
    null

  const edition = asNullableString(
    value.edition ??
      value.print ??
      value.editionName
  )

  const publisher = asNullableString(
    value.publisher ??
      value.publisherName
  )

  const parts = asNumber(
    value.parts ??
      value.volumes ??
      value.volumeCount
  )

  if (
    publishYear === null &&
    edition === null &&
    publisher === null &&
    parts === null
  ) {
    return null
  }

  return {
    publishYear:
      typeof publishYear === 'string' ||
      typeof publishYear === 'number'
        ? publishYear
        : null,
    edition,
    publisher,
    parts,
  }
}

function normalizeReaderBook(
  value: unknown,
  fallback: ReaderBook
): ReaderBook {
  if (!isRecord(value)) {
    return fallback
  }

  const videos = normalizeVideos(
    value.videos ??
      value.lessons ??
      value.learningVideos
  )

  return {
    id:
      asString(value.id).trim() ||
      fallback.id,

    title:
      asString(value.title).trim() ||
      fallback.title,

    author:
      asString(value.author).trim() ||
      fallback.author,

    category:
      asString(value.category).trim() ||
      fallback.category,

    level:
      asString(value.level).trim() ||
      fallback.level,

    description:
      asString(value.description).trim() ||
      fallback.description,

    readingUrl:
      asNullableString(
        value.readingUrl ??
          value.readUrl ??
          value.sourceUrl
      ) ?? fallback.readingUrl,

    readingLabel:
      asNullableString(
        value.readingLabel ??
          value.readLabel
      ) ?? fallback.readingLabel,

    downloadUrl:
      asNullableString(
        value.downloadUrl ??
          value.downloadLink ??
          value.fileUrl
      ) ?? fallback.downloadUrl,

    downloadLabel:
      asNullableString(
        value.downloadLabel ??
          value.downloadText
      ) ?? fallback.downloadLabel,

    sharhTitle:
      asNullableString(
        value.sharhTitle ??
          value.explanationTitle
      ) ?? fallback.sharhTitle,

    sharhAuthor:
      asNullableString(
        value.sharhAuthor ??
          value.explanationAuthor
      ) ?? fallback.sharhAuthor,

    sharhUrl:
      asNullableString(
        value.sharhUrl ??
          value.explanationUrl
      ) ?? fallback.sharhUrl,

    sharhLabel:
      asNullableString(
        value.sharhLabel ??
          value.explanationLabel
      ) ?? fallback.sharhLabel,

    videos:
      videos.length
        ? videos
        : fallback.videos,

    publication:
      normalizePublication(
        value.publication ??
          value.metadata ??
          value.bookInfo
      ) ?? fallback.publication,

    quranpediaBookId:
      asNumber(
        value.quranpediaBookId
      ) ?? fallback.quranpediaBookId,
  }
}

function normalizeStaticBook(
  value: (typeof SUNNI_LIBRARY_BOOKS)[number]
): ReaderBook {
  const raw = value as typeof value & {
    readingLabel?: string
    downloadUrl?: string
    downloadLabel?: string
    sharhLabel?: string
    videos?: unknown
    publication?: unknown
  }

  return {
    id: value.id,
    title: value.title,
    author: value.author,
    category: value.category,
    level: value.level,
    description: value.description,

    readingUrl: value.readingUrl ?? null,
    readingLabel:
      typeof raw.readingLabel === 'string'
        ? raw.readingLabel
        : 'قراءة الكتاب',

    downloadUrl:
      typeof raw.downloadUrl === 'string'
        ? raw.downloadUrl
        : null,

    downloadLabel:
      typeof raw.downloadLabel === 'string'
        ? raw.downloadLabel
        : 'تحميل الكتاب',

    sharhTitle: value.sharhTitle ?? null,
    sharhAuthor: value.sharhAuthor ?? null,
    sharhUrl: value.sharhUrl ?? null,

    sharhLabel:
      typeof raw.sharhLabel === 'string'
        ? raw.sharhLabel
        : 'فتح الشرح',

    videos: normalizeVideos(raw.videos),

    publication: normalizePublication(
      raw.publication
    ),

    quranpediaBookId:
      value.quranpediaBookId ?? null,
  }
}

function normalizeReaderContents(
  value: unknown
): ReaderSection[] {
  if (!Array.isArray(value)) {
    return []
  }

  const result: ReaderSection[] = []

  value.forEach((item) => {
    if (typeof item === 'string') {
      const text = item.trim()

      if (text) {
        result.push({ text })
      }

      return
    }

    if (!isRecord(item)) {
      return
    }

    const text = asString(
      item.text ??
        item.content ??
        item.body ??
        item.description
    ).trim()

    if (!text) {
      return
    }

    const page =
      asNumber(
        item.page ??
          item.pageNumber
      ) ?? undefined

    const part =
      asNumber(
        item.part ??
          item.juz ??
          item.volume
      ) ?? undefined

    const section =
      asNullableString(
        item.section ??
          item.heading ??
          item.title
      ) ?? undefined

    result.push({
      text,
      page,
      part,
      section,
    })
  })

  return result
}

export default function IslamicBookReaderPage() {
  const params = useParams<{ id: string }>()

  const rawId = params?.id || ''
  const bookId = safeDecode(rawId)

  const staticBook = useMemo<ReaderBook | null>(
    () => {
      const found = SUNNI_LIBRARY_BOOKS.find(
        (item) => item.id === bookId
      )

      return found
        ? normalizeStaticBook(found)
        : null
    },
    [bookId]
  )

  const [
    remoteBook,
    setRemoteBook,
  ] = useState<ReaderBook | null>(null)

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
    useState<string | null>(null)

  const [showVideoList, setShowVideoList] =
    useState(true)

  const book =
    remoteBook || staticBook

  const category = useMemo(
    () => {
      if (!book) {
        return null
      }

      return (
        SUNNI_LIBRARY_CATEGORIES.find(
          (item) => item.id === book.category
        ) || null
      )
    },
    [book]
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError('')

      try {
        if (!bookId) {
          throw new Error('INVALID_BOOK_ID')
        }

        const response = await fetch(
          `/api/islamic-library/book/${encodeURIComponent(bookId)}`,
          {
            cache: 'no-store',
          }
        )

        const data: unknown =
          await response.json()

        if (
          !response.ok ||
          !isRecord(data) ||
          data.success !== true
        ) {
          throw new Error('LOAD_FAILED')
        }

        const fallbackBook =
          staticBook ||
          ({
            id: bookId,
            title: 'كتاب شرعي',
            author: 'مكتبة مصحف سميع',
            category: 'other',
            level: 'غير محدد',
            description:
              'كتاب شرعي ضمن مكتبة مصحف سميع.',
            readingUrl: null,
            readingLabel: 'قراءة الكتاب',
            downloadUrl: null,
            downloadLabel: 'تحميل الكتاب',
            sharhTitle: null,
            sharhAuthor: null,
            sharhUrl: null,
            sharhLabel: 'فتح الشرح',
            videos: [],
            publication: null,
            quranpediaBookId: null,
          } satisfies ReaderBook)

        const rawBook =
          isRecord(data.book)
            ? data.book
            : null

        const normalizedBook =
          normalizeReaderBook(
            rawBook,
            fallbackBook
          )

        const source =
          data.source === 'quranpedia' ||
          data.source === 'firestore' ||
          data.source === 'external'
            ? data.source
            : 'external'

        const contents =
          normalizeReaderContents(
            data.contents
          )

        const normalizedPayload: ReaderPayload = {
          success: true,
          source,
          quranpediaBookId:
            asNumber(
              data.quranpediaBookId
            ) ?? normalizedBook.quranpediaBookId,
          book: normalizedBook,
          contents,
          message:
            asNullableString(
              data.message
            ),
        }

        if (!cancelled) {
          setRemoteBook(normalizedBook)
          setPayload(normalizedPayload)

          if (
            normalizedBook.videos.length
          ) {
            setSelectedVideoId(
              (current) =>
                current &&
                normalizedBook.videos.some(
                  (video) =>
                    video.id === current
                )
                  ? current
                  : normalizedBook.videos[0].id
            )
          } else {
            setSelectedVideoId(null)
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            'تعذر تحميل بيانات الكتاب حاليًا. يمكنك استخدام المصادر المتاحة أسفل الصفحة.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [bookId, staticBook])

  useEffect(() => {
    if (!bookId) {
      return
    }

    try {
      const bookmarksRaw =
        localStorage.getItem(
          BOOKMARKS_KEY
        )

      const bookmarks: unknown =
        bookmarksRaw
          ? JSON.parse(bookmarksRaw)
          : []

      setSaved(
        Array.isArray(bookmarks) &&
          bookmarks.includes(bookId)
      )

      const stateRaw =
        localStorage.getItem(
          `${READING_KEY_PREFIX}${bookId}`
        )

      if (stateRaw) {
        const state: unknown =
          JSON.parse(stateRaw)

        if (isRecord(state)) {
          const typedState =
            state as ReaderStorageState

          if (
            typeof typedState.fontScale ===
            'number'
          ) {
            setFontScale(
              Math.min(
                1.45,
                Math.max(
                  0.85,
                  typedState.fontScale
                )
              )
            )
          }

          if (
            typeof typedState.darkMode ===
            'boolean'
          ) {
            setDarkMode(
              typedState.darkMode
            )
          }

          if (
            typeof typedState.notes ===
            'string'
          ) {
            setNotes(typedState.notes)
          }

          if (
            typeof typedState.activeSection ===
            'number' &&
            typedState.activeSection >= 0
          ) {
            setActiveSection(
              Math.floor(
                typedState.activeSection
              )
            )
          }

          if (
            typeof typedState.selectedVideoId ===
            'string'
          ) {
            setSelectedVideoId(
              typedState.selectedVideoId
            )
          }
        }
      }
    } catch {
      // التخزين المحلي غير متاح أو يحتوي على بيانات غير صالحة.
    }
  }, [bookId])

  useEffect(() => {
    if (!bookId) {
      return
    }

    try {
      const state: ReaderStorageState = {
        fontScale,
        darkMode,
        notes,
        activeSection,
        selectedVideoId,
      }

      localStorage.setItem(
        `${READING_KEY_PREFIX}${bookId}`,
        JSON.stringify(state)
      )
    } catch {
      // تجاهل أخطاء التخزين المحلي.
    }
  }, [
    bookId,
    fontScale,
    darkMode,
    notes,
    activeSection,
    selectedVideoId,
  ])

  const contents =
    payload?.contents || []

  const filteredContents = useMemo(
    () => {
      const normalizedQuery =
        query.trim().toLowerCase()

      if (!normalizedQuery) {
        return contents
      }

      return contents.filter(
        (item) =>
          [
            item.text,
            item.section || '',
            item.page
              ? String(item.page)
              : '',
            item.part
              ? String(item.part)
              : '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(
              normalizedQuery
            )
      )
    },
    [contents, query]
  )

  useEffect(() => {
    if (!filteredContents.length) {
      setActiveSection(0)
      return
    }

    setActiveSection((current) =>
      Math.min(
        Math.max(current, 0),
        filteredContents.length - 1
      )
    )
  }, [filteredContents.length])

  const currentItem =
    filteredContents.length
      ? filteredContents[
          Math.min(
            activeSection,
            filteredContents.length - 1
          )
        ]
      : null

  const videos =
    book?.videos || []

  const selectedVideo =
    videos.find(
      (video) =>
        video.id === selectedVideoId
    ) || videos[0] || null

  const toggleBookmark = () => {
    if (!bookId) {
      return
    }

    try {
      const stored =
        localStorage.getItem(
          BOOKMARKS_KEY
        )

      const parsed: unknown =
        stored
          ? JSON.parse(stored)
          : []

      const current: string[] =
        Array.isArray(parsed)
          ? parsed.filter(
              (item): item is string =>
                typeof item === 'string'
            )
          : []

      if (saved) {
        localStorage.setItem(
          BOOKMARKS_KEY,
          JSON.stringify(
            current.filter(
              (id) => id !== bookId
            )
          )
        )

        setSaved(false)
        return
      }

      const next: string[] =
        current.includes(bookId)
          ? current
          : [...current, bookId]

      localStorage.setItem(
        BOOKMARKS_KEY,
        JSON.stringify(next)
      )

      setSaved(true)
    } catch {
      setSaved((value) => !value)
    }
  }

  const copyCurrent = async () => {
    if (!currentItem?.text) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        currentItem.text
      )

      setCopied(true)

      window.setTimeout(
        () => setCopied(false),
        1600
      )
    } catch {
      // صلاحيات الحافظة قد تكون محجوبة من المتصفح.
    }
  }

  const goToSection = (
    index: number
  ) => {
    if (!filteredContents.length) {
      return
    }

    const next = Math.min(
      Math.max(index, 0),
      filteredContents.length - 1
    )

    setActiveSection(next)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const openVideo = (
    videoId: string
  ) => {
    setSelectedVideoId(videoId)

    window.setTimeout(() => {
      const player =
        document.getElementById(
          'samee3-video-player'
        )

      if (player) {
        player.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }, 80)
  }

  if (!book) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-mushaf-paper flex items-center justify-center px-4"
      >
        <section className="w-full max-w-xl rounded-[32px] bg-white border border-mushaf-border/20 shadow-xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-mushaf-teal/10 text-mushaf-teal">
            <BookOpen size={32} />
          </div>

          <h1 className="mt-5 text-2xl font-black text-mushaf-dark">
            الكتاب غير موجود
          </h1>

          <p className="mt-3 text-sm leading-7 text-gray-500">
            لم يتم العثور على هذا الكتاب في مكتبة مصحف سميع.
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

  const darkInput =
    'bg-black/20 text-white border-white/10 placeholder:text-white/30'

  const lightInput =
    'bg-mushaf-paper text-mushaf-dark border-gray-200'

  const readerBackground =
    darkMode
      ? 'bg-[#111715] border-white/10'
      : 'bg-[#FFFDF8] border-mushaf-gold/15'

  const downloadLabel =
    book.downloadLabel ||
    payload?.book.downloadLabel ||
    'تحميل الكتاب'

  const readingLabel =
    book.readingLabel ||
    payload?.book.readingLabel ||
    'قراءة الكتاب'

  const sharhLabel =
    book.sharhLabel ||
    payload?.book.sharhLabel ||
    'فتح الشرح'

  return (
    <main
      dir="rtl"
      className={`min-h-screen ${surface} pb-32 transition-colors`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/islamic-library"
              aria-label="العودة للمكتبة"
              className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl ${card} border shadow-sm ${mainText}`}
            >
              <ArrowRight size={20} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-black text-mushaf-teal">
                <BookOpen size={17} />
                <span>
                  {category?.label ||
                    'المكتبة الشرعية'}
                </span>
              </div>

              <h1
                className={`mt-1 truncate text-xl sm:text-2xl font-black ${mainText}`}
              >
                {book.title}
              </h1>

              <p
                className={`mt-1 text-xs sm:text-sm ${muted}`}
              >
                {book.author}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setFontScale((value) =>
                  Math.max(
                    0.85,
                    Number(
                      (
                        value - 0.05
                      ).toFixed(2)
                    )
                  )
                )
              }
              className={`h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}`}
              title="تصغير الخط"
              aria-label="تصغير الخط"
            >
              <Minus size={18} />
            </button>

            <button
              type="button"
              onClick={() =>
                setFontScale((value) =>
                  Math.min(
                    1.45,
                    Number(
                      (
                        value + 0.05
                      ).toFixed(2)
                    )
                  )
                )
              }
              className={`h-11 w-11 rounded-xl ${card} border flex items-center justify-center ${mainText}`}
              title="تكبير الخط"
              aria-label="تكبير الخط"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              onClick={() =>
                setDarkMode(
                  (value) => !value
                )
              }
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl ${card} border text-xs font-black ${mainText}`}
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
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs font-black ${
                saved
                  ? 'bg-mushaf-gold text-white border-mushaf-gold'
                  : `${card} ${mainText}`
              }`}
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

        <div className="mt-6 flex flex-wrap gap-2">
          {book.readingUrl && (
            <a
              href={book.readingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal px-4 py-3 text-xs font-black text-white shadow-sm"
            >
              <BookOpen size={16} />
              {readingLabel}
              <ExternalLink size={14} />
            </a>
          )}

          {book.downloadUrl && (
            <a
              href={book.downloadUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center gap-2 rounded-2xl border border-mushaf-gold/20 bg-mushaf-gold/10 px-4 py-3 text-xs font-black text-mushaf-gold"
            >
              <Download size={16} />
              {downloadLabel}
            </a>
          )}

          {book.sharhUrl && (
            <a
              href={book.sharhUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
                darkMode
                  ? 'border-white/10 text-white'
                  : 'border-mushaf-teal/20 bg-white text-mushaf-teal'
              }`}
            >
              <GraduationCap size={16} />
              {sharhLabel}
            </a>
          )}
        </div>

        <section className="mt-6 grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5">
          <aside className="space-y-5">
            <section
              className={`rounded-[28px] border shadow-sm p-5 ${card}`}
            >
              <div
                className={`flex items-center gap-2 font-black text-sm ${
                  darkMode
                    ? 'text-mushaf-gold'
                    : 'text-mushaf-teal'
                }`}
              >
                <List size={18} />
                فهرس القراءة
              </div>

              <div className="mt-4 max-h-[52vh] overflow-y-auto space-y-2">
                {contents.length ? (
                  contents.map(
                    (item, index) => {
                      const active =
                        index === activeSection

                      return (
                        <button
                          key={`${item.page || 'x'}-${item.part || 'x'}-${index}`}
                          type="button"
                          onClick={() =>
                            goToSection(
                              index
                            )
                          }
                          className={`w-full text-right rounded-2xl px-3 py-3 text-xs leading-5 transition border ${
                            active
                              ? 'bg-mushaf-teal text-white border-mushaf-teal'
                              : darkMode
                              ? 'bg-white/5 text-white/75 border-white/10 hover:bg-white/10'
                              : 'bg-mushaf-paper text-gray-700 border-gray-100 hover:border-mushaf-teal/20'
                          }`}
                        >
                          <div className="font-black">
                            {item.section ||
                              `موضع ${(
                                index + 1
                              ).toLocaleString(
                                'ar-EG'
                              )}`}
                          </div>

                          <div
                            className={`mt-1 text-[10px] ${
                              active
                                ? 'text-white/65'
                                : muted
                            }`}
                          >
                            {item.page
                              ? `الصفحة ${item.page.toLocaleString('ar-EG')}`
                              : item.part
                              ? `الجزء ${item.part.toLocaleString('ar-EG')}`
                              : `الموضع ${(
                                  index + 1
                                ).toLocaleString(
                                  'ar-EG'
                                )}`}
                          </div>
                        </button>
                      )
                    }
                  )
                ) : (
                  <div
                    className={`rounded-2xl p-4 text-xs leading-6 ${muted} ${
                      darkMode
                        ? 'bg-white/5'
                        : 'bg-mushaf-paper'
                    }`}
                  >
                    لا يوجد فهرس نصي متاح لهذا الكتاب حاليًا.
                  </div>
                )}
              </div>
            </section>

            <section
              className={`rounded-[28px] border shadow-sm p-5 ${card}`}
            >
              <div
                className={`flex items-center gap-2 font-black text-sm ${
                  darkMode
                    ? 'text-mushaf-gold'
                    : 'text-mushaf-teal'
                }`}
              >
                <Search size={18} />
                بحث داخل الكتاب
              </div>

              <div className="relative mt-4">
                <Search
                  size={16}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    darkMode
                      ? 'text-white/35'
                      : 'text-gray-400'
                  }`}
                />

                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(
                      event.target.value
                    )
                    setActiveSection(0)
                  }}
                  placeholder="ابحث عن كلمة أو عبارة..."
                  className={`h-11 w-full rounded-xl border pr-9 pl-3 text-sm outline-none ${
                    darkMode
                      ? darkInput
                      : lightInput
                  }`}
                />

                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setActiveSection(0)
                    }}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 ${
                      darkMode
                        ? 'text-white/50'
                        : 'text-gray-400'
                    }`}
                    aria-label="مسح البحث"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <p
                className={`mt-3 text-[11px] leading-5 ${muted}`}
              >
                {filteredContents.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                موضع متاح في نتيجة البحث.
              </p>
            </section>

            {book.publication && (
              <section
                className={`rounded-[28px] border shadow-sm p-5 ${card}`}
              >
                <div
                  className={`flex items-center gap-2 font-black text-sm ${
                    darkMode
                      ? 'text-mushaf-gold'
                      : 'text-mushaf-teal'
                  }`}
                >
                  <BookOpen size={18} />
                  بيانات الكتاب
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  {book.publication.publisher && (
                    <div
                      className={`rounded-2xl px-3 py-3 ${
                        darkMode
                          ? 'bg-white/5'
                          : 'bg-mushaf-paper'
                      }`}
                    >
                      <span
                        className={`block font-black ${
                          darkMode
                            ? 'text-mushaf-gold'
                            : 'text-mushaf-teal'
                        }`}
                      >
                        الناشر
                      </span>
                      <span
                        className={`mt-1 block ${muted}`}
                      >
                        {book.publication.publisher}
                      </span>
                    </div>
                  )}

                  {book.publication.publishYear && (
                    <div
                      className={`rounded-2xl px-3 py-3 ${
                        darkMode
                          ? 'bg-white/5'
                          : 'bg-mushaf-paper'
                      }`}
                    >
                      <span
                        className={`block font-black ${
                          darkMode
                            ? 'text-mushaf-gold'
                            : 'text-mushaf-teal'
                        }`}
                      >
                        سنة النشر
                      </span>
                      <span
                        className={`mt-1 block ${muted}`}
                      >
                        {book.publication.publishYear}
                      </span>
                    </div>
                  )}

                  {book.publication.edition && (
                    <div
                      className={`rounded-2xl px-3 py-3 ${
                        darkMode
                          ? 'bg-white/5'
                          : 'bg-mushaf-paper'
                      }`}
                    >
                      <span
                        className={`block font-black ${
                          darkMode
                            ? 'text-mushaf-gold'
                            : 'text-mushaf-teal'
                        }`}
                      >
                        الطبعة
                      </span>
                      <span
                        className={`mt-1 block ${muted}`}
                      >
                        {book.publication.edition}
                      </span>
                    </div>
                  )}

                  {book.publication.parts && (
                    <div
                      className={`rounded-2xl px-3 py-3 ${
                        darkMode
                          ? 'bg-white/5'
                          : 'bg-mushaf-paper'
                      }`}
                    >
                      <span
                        className={`block font-black ${
                          darkMode
                            ? 'text-mushaf-gold'
                            : 'text-mushaf-teal'
                        }`}
                      >
                        عدد الأجزاء
                      </span>
                      <span
                        className={`mt-1 block ${muted}`}
                      >
                        {book.publication.parts.toLocaleString(
                          'ar-EG'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>

          <article
            className={`rounded-[32px] border shadow-sm overflow-hidden ${card}`}
          >
            <div className="p-5 sm:p-7 border-b border-current/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mushaf-gold/10 text-mushaf-gold px-3 py-1.5 text-[11px] font-black">
                  {book.level}
                </span>

                <span
                  className={`text-xs font-bold ${muted}`}
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

                {payload?.source ===
                  'firestore' && (
                  <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-3 py-1.5 text-[11px] font-black">
                    مضاف من إدارة المكتبة
                  </span>
                )}
              </div>

              <h2
                className={`mt-4 text-2xl sm:text-3xl font-black ${mainText}`}
              >
                {book.title}
              </h2>

              <p
                className={`mt-2 text-sm font-bold ${muted}`}
              >
                تأليف: {book.author}
              </p>

              <p
                className={`mt-5 text-sm sm:text-base leading-8 ${mainText}`}
              >
                {book.description}
              </p>
            </div>

            {videos.length > 0 && (
              <section className="border-b border-current/10">
                <button
                  type="button"
                  onClick={() =>
                    setShowVideoList(
                      (value) => !value
                    )
                  }
                  className={`flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-7 ${
                    darkMode
                      ? 'hover:bg-white/5'
                      : 'hover:bg-mushaf-paper'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mushaf-teal/10 text-mushaf-teal">
                      <Video size={20} />
                    </div>

                    <div className="text-right">
                      <h3
                        className={`text-sm font-black ${mainText}`}
                      >
                        دروس وشروحات الكتاب
                      </h3>

                      <p
                        className={`mt-1 text-[11px] ${muted}`}
                      >
                        {videos.length.toLocaleString(
                          'ar-EG'
                        )}{' '}
                        درس متاح
                      </p>
                    </div>
                  </div>

                  <ChevronDown
                    size={19}
                    className={`transition-transform ${
                      showVideoList
                        ? 'rotate-180'
                        : ''
                    } ${muted}`}
                  />
                </button>

                {showVideoList && (
                  <div className="px-5 pb-5 sm:px-7 sm:pb-7">
                    {selectedVideo && (
                      <div
                        id="samee3-video-player"
                        className={`overflow-hidden rounded-[26px] border ${
                          darkMode
                            ? 'bg-black/30 border-white/10'
                            : 'bg-black border-black/10'
                        }`}
                      >
                        {selectedVideo.provider ===
                          'youtube' &&
                          selectedVideo.embedUrl && (
                            <div className="aspect-video w-full">
                              <iframe
                                src={
                                  selectedVideo.embedUrl
                                }
                                title={
                                  selectedVideo.title
                                }
                                className="h-full w-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            </div>
                          )}

                        {selectedVideo.provider ===
                          'vimeo' &&
                          selectedVideo.embedUrl && (
                            <div className="aspect-video w-full">
                              <iframe
                                src={
                                  selectedVideo.embedUrl
                                }
                                title={
                                  selectedVideo.title
                                }
                                className="h-full w-full border-0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}

                        {selectedVideo.provider ===
                          'file' &&
                          selectedVideo.embedUrl && (
                            <video
                              className="block aspect-video w-full bg-black object-contain"
                              controls
                              playsInline
                              preload="metadata"
                              src={
                                selectedVideo.embedUrl
                              }
                            />
                          )}

                        {selectedVideo.provider ===
                          'external' && (
                          <div className="flex min-h-[280px] flex-col items-center justify-center bg-gradient-to-br from-[#102C2F] to-[#173F44] px-6 text-center text-white">
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
                              <Play size={28} />
                            </div>

                            <h4 className="mt-5 text-lg font-black">
                              {selectedVideo.title}
                            </h4>

                            <p className="mt-2 max-w-lg text-xs leading-6 text-white/65">
                              هذا الرابط لا يدعم العرض المضمّن داخل المنصة.
                            </p>

                            <a
                              href={
                                selectedVideo.url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-mushaf-teal"
                            >
                              فتح الدرس
                              <ExternalLink
                                size={15}
                              />
                            </a>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/80 text-white">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {
                                selectedVideo.title
                              }
                            </p>

                            <p className="mt-1 text-[10px] text-white/50">
                              الدرس{' '}
                              {selectedVideo.order.toLocaleString(
                                'ar-EG'
                              )}
                            </p>
                          </div>

                          <a
                            href={
                              selectedVideo.url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-white hover:bg-white/15"
                          >
                            المصدر
                            <ExternalLink
                              size={14}
                            />
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {videos.map(
                        (video, index) => {
                          const active =
                            video.id ===
                            selectedVideo?.id

                          return (
                            <button
                              key={video.id}
                              type="button"
                              onClick={() =>
                                openVideo(
                                  video.id
                                )
                              }
                              className={`flex items-center gap-3 rounded-2xl border p-3 text-right transition ${
                                active
                                  ? 'border-mushaf-teal bg-mushaf-teal text-white'
                                  : darkMode
                                  ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                                  : 'border-gray-100 bg-mushaf-paper text-gray-700 hover:border-mushaf-teal/20'
                              }`}
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  active
                                    ? 'bg-white/15'
                                    : 'bg-mushaf-teal/10 text-mushaf-teal'
                                }`}
                              >
                                <Play
                                  size={17}
                                  fill={
                                    active
                                      ? 'currentColor'
                                      : 'none'
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="font-black text-xs line-clamp-2">
                                  {video.title}
                                </div>

                                <div
                                  className={`mt-1 text-[10px] ${
                                    active
                                      ? 'text-white/60'
                                      : muted
                                  }`}
                                >
                                  الدرس{' '}
                                  {(
                                    video.order ||
                                    index + 1
                                  ).toLocaleString(
                                    'ar-EG'
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        }
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {loading ? (
              <div
                className={`flex min-h-[360px] items-center justify-center p-12 text-center ${muted}`}
              >
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-mushaf-teal/10 text-mushaf-teal">
                    <BookOpen
                      size={30}
                      className="animate-pulse"
                    />
                  </div>

                  <p className="mt-5 text-sm font-black">
                    جارٍ تجهيز الكتاب للقراءة...
                  </p>
                </div>
              </div>
            ) : loadError &&
              !contents.length ? (
              <div className="p-8 sm:p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <X size={24} />
                </div>

                <p
                  className={`mt-4 text-sm leading-7 ${mainText}`}
                >
                  {loadError}
                </p>

                {book.readingUrl && (
                  <a
                    href={
                      book.readingUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal px-5 py-3 text-xs font-black text-white"
                  >
                    فتح المصدر الأصلي
                    <ExternalLink
                      size={15}
                    />
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
                        className={`mt-1 text-xs ${muted}`}
                      >
                        {currentItem?.page
                          ? `صفحة ${currentItem.page.toLocaleString(
                              'ar-EG'
                            )}`
                          : `الموضع ${Math.min(
                              activeSection +
                                1,
                              filteredContents.length
                            ).toLocaleString(
                              'ar-EG'
                            )}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void copyCurrent()
                      }
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                        darkMode
                          ? 'border-white/10 text-white'
                          : 'border-mushaf-teal/15 text-mushaf-teal'
                      }`}
                    >
                      {copied ? (
                        <CheckCheck
                          size={15}
                        />
                      ) : (
                        <Copy size={15} />
                      )}

                      {copied
                        ? 'تم النسخ'
                        : 'نسخ'}
                    </button>
                  </div>

                  <div
                    className={`rounded-[30px] border px-6 py-9 sm:px-10 sm:py-12 ${readerBackground}`}
                  >
                    {currentItem?.section && (
                      <h3
                        className={`text-center text-lg sm:text-xl font-black ${mainText}`}
                      >
                        {
                          currentItem.section
                        }
                      </h3>
                    )}

                    {currentItem?.part && (
                      <div className="mt-3 text-center text-[11px] font-black text-mushaf-gold">
                        الجزء{' '}
                        {currentItem.part.toLocaleString(
                          'ar-EG'
                        )}
                      </div>
                    )}

                    <p
                      className={`mt-7 whitespace-pre-wrap text-center leading-[2.4] sm:leading-[2.55] ${
                        darkMode
                          ? 'text-[#F4EFE2]'
                          : 'text-[#27231D]'
                      }`}
                      style={{
                        fontSize: `${
                          1.24 *
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
                        goToSection(
                          activeSection - 1
                        )
                      }
                      disabled={
                        activeSection <= 0
                      }
                      className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal px-4 py-3 text-xs font-black text-white disabled:opacity-35"
                    >
                      <ArrowRight
                        size={16}
                      />
                      السابق
                    </button>

                    <span
                      className={`text-xs font-bold ${muted}`}
                    >
                      {Math.min(
                        activeSection + 1,
                        filteredContents.length
                      ).toLocaleString(
                        'ar-EG'
                      )}
                      {' / '}
                      {filteredContents.length.toLocaleString(
                        'ar-EG'
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        goToSection(
                          activeSection + 1
                        )
                      }
                      disabled={
                        activeSection >=
                        filteredContents.length -
                          1
                      }
                      className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal px-4 py-3 text-xs font-black text-white disabled:opacity-35"
                    >
                      التالي
                      <ArrowLeft
                        size={16}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 sm:p-10">
                <div
                  className={`rounded-[28px] p-6 ${
                    darkMode
                      ? 'bg-white/5'
                      : 'bg-mushaf-paper'
                  }`}
                >
                  <div className="flex items-center gap-2 text-mushaf-teal font-black text-sm">
                    <BookOpen size={19} />
                    الكتاب متاح عبر مصدر القراءة
                  </div>

                  <p
                    className={`mt-3 text-sm leading-7 ${muted}`}
                  >
                    لا يوفر المصدر الحالي محتوى نصيًا موحدًا للعرض الكامل داخل قارئ سميع. يمكنك استخدام زر القراءة أو التحميل أو الشرح المتاح لهذا الكتاب.
                  </p>

                  {payload?.message && (
                    <p
                      className={`mt-3 text-xs leading-6 ${muted}`}
                    >
                      {payload.message}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {book.readingUrl && (
                      <a
                        href={
                          book.readingUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal px-5 py-3 text-xs font-black text-white"
                      >
                        <BookOpen
                          size={15}
                        />
                        {readingLabel}
                        <ExternalLink
                          size={14}
                        />
                      </a>
                    )}

                    {book.downloadUrl && (
                      <a
                        href={
                          book.downloadUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-gold px-5 py-3 text-xs font-black text-white"
                      >
                        <Download
                          size={15}
                        />
                        {downloadLabel}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 sm:p-7 border-t border-current/10">
              <div
                className={`rounded-[24px] p-5 ${
                  darkMode
                    ? 'bg-white/5'
                    : 'bg-mushaf-paper'
                }`}
              >
                <div
                  className={`flex items-center gap-2 text-sm font-black ${
                    darkMode
                      ? 'text-mushaf-gold'
                      : 'text-mushaf-teal'
                  }`}
                >
                  <GraduationCap
                    size={18}
                  />
                  الشرح
                </div>

                <p
                  className={`mt-3 text-sm leading-7 ${mainText}`}
                >
                  {book.sharhTitle ||
                    'لم يتم تسجيل شرح مستقل لهذا الكتاب بعد.'}

                  {book.sharhAuthor
                    ? ` — ${book.sharhAuthor}`
                    : ''}
                </p>

                {book.sharhUrl && (
                  <a
                    href={
                      book.sharhUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-mushaf-teal/20 px-4 py-2.5 text-xs font-black text-mushaf-teal"
                  >
                    <GraduationCap
                      size={15}
                    />
                    {sharhLabel}
                    <ExternalLink
                      size={15}
                    />
                  </a>
                )}
              </div>

              <div className="mt-5">
                <div
                  className={`flex items-center gap-2 text-sm font-black ${
                    darkMode
                      ? 'text-mushaf-gold'
                      : 'text-mushaf-teal'
                  }`}
                >
                  <Bookmark size={18} />
                  ملاحظاتك
                </div>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="دوّن الفوائد أو الملاحظات هنا..."
                  className={`mt-3 min-h-[130px] w-full rounded-2xl border px-4 py-3 text-sm leading-7 outline-none ${
                    darkMode
                      ? darkInput
                      : lightInput
                  }`}
                />

                <p
                  className={`mt-2 text-[10px] ${muted}`}
                >
                  تحفظ الملاحظات تلقائيًا على هذا الجهاز.
                </p>
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/islamic-library"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode
                ? 'border-white/10 text-white'
                : 'bg-white border-mushaf-border/20 text-mushaf-teal'
            }`}
          >
            <ArrowRight size={15} />
            المكتبة الشرعية
          </Link>

          <Link
            href="/"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
              darkMode
                ? 'border-white/10 text-white'
                : 'bg-white border-mushaf-border/20 text-mushaf-teal'
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
