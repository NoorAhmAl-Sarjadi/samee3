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
    throw new Error(`HTTP ${response.status}`)
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
      `${QURANPEDIA_BASE}/book/${quranpediaId}`,
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
