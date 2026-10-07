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
