import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UPSTREAM_BASE = 'https://alfurqan.online/api/v1/hadith'
const REQUEST_TIMEOUT_MS = 15_000

type RouteContext = {
  params: Promise<{
    path?: string[]
  }>
}

/**
 * GET /api/hadith/*
 *
 * هذا الملف يعمل كـ Proxy Server-Side بين صفحة الأحاديث
 * ومصدر بيانات الأحاديث الخارجي.
 *
 * أمثلة:
 *   /api/hadith/list
 *   /api/hadith/bukhari
 *   /api/hadith/bukhari/chapter/1
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const resolvedParams = await params
    const segments = resolvedParams.path ?? []

    if (!segments.length) {
      return NextResponse.json(
        {
          error: 'Hadith API path is missing',
        },
        { status: 400 },
      )
    }

    /**
     * نُشفّر كل جزء من المسار منفصلًا ثم نعيد تركيبه،
     * حتى لا نسمح بإدخال مسار غير صحيح إلى المصدر الخارجي.
     */
    const safePath = segments
      .filter((segment) => typeof segment === 'string' && segment.trim() !== '')
      .map((segment) => encodeURIComponent(segment))
      .join('/')

    if (!safePath) {
      return NextResponse.json(
        {
          error: 'Hadith API path is invalid',
        },
        { status: 400 },
      )
    }

    const incomingUrl = new URL(request.url)
    const queryString = incomingUrl.search

    const upstreamUrl = `${UPSTREAM_BASE}/${safePath}${queryString}`

    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    )

    let response: Response

    try {
      response = await fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const body = await response.text()

    const contentType =
      response.headers.get('content-type') ||
      'application/json; charset=utf-8'

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === 'AbortError'

    console.error('Hadith proxy error:', error)

    return NextResponse.json(
      {
        error: isTimeout
          ? 'انتهت مهلة الاتصال بمصدر الأحاديث.'
          : 'تعذر الاتصال بمصدر الأحاديث حاليًا.',
      },
      { status: 502 },
    )
  }
}