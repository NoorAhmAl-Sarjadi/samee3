   import { NextRequest, NextResponse } from 'next/server'

    const ISLAMHOUSE_API_KEY = process.env.ISLAMHOUSE_API_KEY || ''
    const ISLAMHOUSE_BASE = 'https://api.islamhouse.com/v1'

    export async function GET(request: NextRequest) {
      if (!ISLAMHOUSE_API_KEY) {
        return NextResponse.json(
          {
            error:
              'ISLAMHOUSE_API_KEY is not configured on the server.',
          },
          { status: 503 }
        )
      }

      const searchParams = request.nextUrl.searchParams
      const type = searchParams.get('type') || 'audios'
      const page = Math.max(1, Number(searchParams.get('page') || '1'))
      const limit = Math.min(
        50,
        Math.max(1, Number(searchParams.get('limit') || '50'))
      )

      /*
       * المصدر:
       * /main/{type}/{flang}/{slang}/{pageNum}/{limit}/{format}
       *
       * نطلب لغة الواجهة العربية وكل لغات المصدر، ثم نرشح المواد في الواجهة.
       */
      const url = `${ISLAMHOUSE_BASE}/${encodeURIComponent(
        ISLAMHOUSE_API_KEY
      )}/main/${encodeURIComponent(type)}/ar/showall/${page}/${limit}/json/`

      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'application/json',
          },
          next: {
            revalidate: 1800,
          },
        })

        const bodyText = await response.text()

        if (!response.ok) {
          return NextResponse.json(
            {
              error: `IslamHouse request failed: ${response.status}`,
              details: bodyText.slice(0, 1000),
            },
            { status: response.status }
          )
        }

        let data: unknown

        try {
          data = JSON.parse(bodyText)
        } catch {
          return NextResponse.json(
            {
              error: 'IslamHouse returned non-JSON content.',
              details: bodyText.slice(0, 500),
            },
            { status: 502 }
          )
        }

        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
          },
        })
      } catch (error) {
        console.error('IslamHouse proxy error:', error)

        return NextResponse.json(
          {
            error: 'Failed to reach IslamHouse.',
          },
          { status: 502 }
        )
      }
    }