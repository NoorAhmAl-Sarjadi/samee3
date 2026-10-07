import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// الصور الأصلية المستخدمة للروايتين السوسي والبزي من ملفات المصحف ذات الـ604 صفحات.
// نحصل على thumbnail للصفحة المطلوبة عبر MediaWiki API بدل التخمين بأسماء ملفات.
const WIKIMEDIA_FILES = {
  sousi: 'File:المصحف برواية السوسي عن أبي عمرو.pdf',
  bazzi: 'File:المصحف برواية البزي عن ابن كثير.pdf',
} as const

type TextRiwaya = keyof typeof WIKIMEDIA_FILES

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php'
const THUMB_WIDTH = 960
const REQUEST_TIMEOUT = 20_000

function isTextRiwaya(value: string | null): value is TextRiwaya {
  return value === 'sousi' || value === 'bazzi'
}

function clampPage(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(604, Math.max(1, Math.floor(value)))
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function resolveWikimediaThumbUrl(
  riwaya: TextRiwaya,
  page: number,
): Promise<string> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size|thumbmime',
    iiurlwidth: String(THUMB_WIDTH),
    iiurlparam: `page${page}`,
    titles: WIKIMEDIA_FILES[riwaya],
    format: 'json',
    origin: '*',
  })

  const response = await fetchWithTimeout(
    `${WIKIMEDIA_API}?${params.toString()}`,
    {
      method: 'GET',
      cache: 'force-cache',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SAMEE3 Quran Web App/1.0',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Wikimedia image API failed: ${response.status}`)
  }

  const payload = await response.json()
  const pages = payload?.query?.pages

  if (!pages || typeof pages !== 'object') {
    throw new Error('Wikimedia returned no page metadata.')
  }

  const pageRecord = Object.values(pages)[0] as {
    missing?: string
    imageinfo?: Array<{
      thumburl?: string
      url?: string
      thumbmime?: string
      width?: number
      height?: number
    }>
  } | undefined

  const imageInfo = pageRecord?.imageinfo?.[0]
  const thumbUrl = String(imageInfo?.thumburl || '').trim()
  const originalUrl = String(imageInfo?.url || '').trim()

  if (thumbUrl) return thumbUrl
  if (originalUrl && imageInfo?.thumbmime?.startsWith('image/')) return originalUrl

  throw new Error(
    pageRecord?.missing
      ? `Wikimedia file missing for ${riwaya}.`
      : `No thumbnail URL returned for ${riwaya} page ${page}.`,
  )
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const riwaya = searchParams.get('riwaya')
  const page = clampPage(Number(searchParams.get('page') || '1'))

  if (!isTextRiwaya(riwaya)) {
    return NextResponse.json(
      {
        error: 'هذه الرواية غير مدعومة لمسار صور المصحف.',
        supported: ['sousi', 'bazzi'],
      },
      { status: 400 },
    )
  }

  try {
    const imageUrl = await resolveWikimediaThumbUrl(riwaya, page)

    const imageResponse = await fetchWithTimeout(imageUrl, {
      method: 'GET',
      cache: 'force-cache',
      headers: {
        Accept: 'image/jpeg,image/webp,image/*;q=0.9,*/*;q=0.5',
      },
    })

    if (!imageResponse.ok) {
      throw new Error(`Wikimedia image fetch failed: ${imageResponse.status}`)
    }

    const contentType =
      imageResponse.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(imageResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
        'X-Samee3-Riwaya': riwaya,
        'X-Samee3-Page': String(page),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)

    console.error('SAMEE3 RIWAYA IMAGE ERROR:', {
      riwaya,
      page,
      message,
    })

    return NextResponse.json(
      {
        error: 'تعذر تحميل صورة صفحة الرواية الآن.',
        riwaya,
        page,
        details: message,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}