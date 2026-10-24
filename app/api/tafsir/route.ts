import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://api.quranpedia.net/v1'

/**
 * قائمة ثابتة للكتب المسموح بإظهارها داخل مصحف سَميع.
 * لا نعتمد على قائمة Quranpedia العامة حتى لا يدخل كتاب جديد إلى التطبيق تلقائيًا.
 * أرقام الكتب موثقة من صفحات/بيانات Quranpedia الحالية.
 */
const APPROVED_TAFSIR_BOOKS = [
  { id: 2012, name: 'التفسير الميسر', short_name: 'الميسر', author: 'مجموعة من العلماء' },
  { id: 136, name: 'تفسير القرآن العظيم', short_name: 'ابن كثير', author: 'إسماعيل بن عمر ابن كثير' },
  { id: 4, name: 'جامع البيان في تأويل آي القرآن', short_name: 'الطبري', author: 'محمد بن جرير الطبري' },
  { id: 2, name: 'معالم التنزيل', short_name: 'البغوي', author: 'الحسين بن مسعود البغوي' },
  { id: 3, name: 'تيسير الكريم الرحمن', short_name: 'السعدي', author: 'عبد الرحمن بن ناصر السعدي' },
  { id: 1469, name: 'الجامع لأحكام القرآن', short_name: 'القرطبي', author: 'محمد بن أحمد القرطبي' },
  { id: 27796, name: 'أضواء البيان في إيضاح القرآن بالقرآن', short_name: 'أضواء البيان', author: 'محمد الأمين الشنقيطي' },
  { id: 54, name: 'أيسر التفاسير', short_name: 'أيسر التفاسير', author: 'أبو بكر الجزائري' },
] as const

const APPROVED_TAFSIR_IDS = new Set<number>(
  APPROVED_TAFSIR_BOOKS.map((book) => book.id)
)

type QuranpediaTafsirBook = {
  id?: number
  name?: string
  short_name?: string
  author?: string | { ar_name?: string }
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function fetchWithTimeout(url: string, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function publicBook(book: (typeof APPROVED_TAFSIR_BOOKS)[number]) {
  return {
    id: book.id,
    name: book.name,
    short_name: book.short_name,
    author: book.author,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'books'
  const surah = Number(searchParams.get('surah'))

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return NextResponse.json(
      { success: false, error: 'رقم السورة غير صحيح.' },
      { status: 400 }
    )
  }

  try {
    if (mode === 'books') {
      return NextResponse.json(
        {
          success: true,
          surah,
          policy: 'approved-sunni-tafsir-allowlist',
          books: APPROVED_TAFSIR_BOOKS.map(publicBook),
        },
        { status: 200 }
      )
    }

    if (mode === 'ayah') {
      const ayah = Number(searchParams.get('ayah'))
      const book = Number(searchParams.get('book'))

      if (!Number.isInteger(ayah) || ayah < 1) {
        return NextResponse.json(
          { success: false, error: 'رقم الآية غير صحيح.' },
          { status: 400 }
        )
      }

      if (!Number.isInteger(book) || !APPROVED_TAFSIR_IDS.has(book)) {
        return NextResponse.json(
          {
            success: false,
            error: 'كتاب التفسير المطلوب غير موجود ضمن قائمة التفاسير المسموح بها.',
          },
          { status: 403 }
        )
      }

      const configuredBook = APPROVED_TAFSIR_BOOKS.find((item) => item.id === book)
      const response = await fetchWithTimeout(
        `${BASE_URL}/ayah/${surah}/${ayah}/book/${book}`
      )
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              typeof data?.error === 'string'
                ? data.error
                : `تعذر تحميل التفسير (${response.status}).`,
          },
          { status: response.status }
        )
      }

      const rawContent = Array.isArray(data?.content)
        ? data.content
            .map((part: { text?: unknown }) =>
              typeof part?.text === 'string' ? part.text : ''
            )
            .filter(Boolean)
            .join('\n\n')
        : ''

      const text = htmlToPlainText(rawContent)

      if (!text) {
        return NextResponse.json(
          {
            success: false,
            error: 'لا يوجد نص تفسير متاح لهذه الآية في هذا الكتاب حاليًا.',
          },
          { status: 404 }
        )
      }

      const remoteBook =
        data?.book && typeof data.book === 'object'
          ? (data.book as QuranpediaTafsirBook)
          : null

      return NextResponse.json(
        {
          success: true,
          surah,
          ayah,
          book,
          text,
          tafsirBook: {
            id: book,
            name:
              typeof remoteBook?.name === 'string' && remoteBook.name.trim()
                ? remoteBook.name.trim()
                : configuredBook?.name ?? '',
            short_name:
              typeof remoteBook?.short_name === 'string' && remoteBook.short_name.trim()
                ? remoteBook.short_name.trim()
                : configuredBook?.short_name ?? '',
            author:
              remoteBook?.author && typeof remoteBook.author === 'object'
                ? typeof remoteBook.author.ar_name === 'string'
                  ? remoteBook.author.ar_name.trim()
                  : configuredBook?.author ?? ''
                : typeof remoteBook?.author === 'string'
                  ? remoteBook.author.trim()
                  : configuredBook?.author ?? '',
          },
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'نوع طلب التفسير غير مدعوم.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Tafsir API error:', error)

    const isAbort = error instanceof Error && error.name === 'AbortError'

    return NextResponse.json(
      {
        success: false,
        error: isAbort
          ? 'انتهى وقت الاتصال بمصدر التفسير.'
          : 'تعذر الاتصال بمصدر كتاب التفسير حاليًا.',
      },
      { status: 502 }
    )
  }
}
