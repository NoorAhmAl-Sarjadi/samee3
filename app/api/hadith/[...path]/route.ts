import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UPSTREAM_BASE = 'https://alfurqan.online/api/v1/hadith'

type RouteContext = {
  params: {
    path?: string[]
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const segments = params.path ?? []

    if (!segments.length) {
      return NextResponse.json(
        {
          error: 'Hadith API path is missing',
        },
        { status: 400 }
      )
    }

    const safePath = segments
      .map((segment) => encodeURIComponent(segment))
      .join('/')

    const upstreamUrl = `${UPSTREAM_BASE}/${safePath}`

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const body = await response.text()

    const contentType =
      response.headers.get('content-type') || 'application/json; charset=utf-8'

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Hadith proxy error:', error)

    return NextResponse.json(
      {
        error: 'تعذر الاتصال بمصدر الأحاديث حاليًا.',
      },
      { status: 502 }
    )
  }
}