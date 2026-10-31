import { NextRequest, NextResponse } from 'next/server'

// YouTube oEmbed returns the original public video title without an API key.
// This route does NOT download or proxy the video itself.
const VALID_ID = /^[a-zA-Z0-9_-]{11}$/
const MAX_IDS = 8

type OEmbedResult = {
  title?: unknown
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('ids') || ''
  const ids = [...new Set(raw.split(',').map((id) => id.trim()))]

  if (
    !ids.length ||
    ids.length > MAX_IDS ||
    ids.some((id) => !VALID_ID.test(id))
  ) {
    return NextResponse.json(
      { error: 'Invalid video IDs' },
      { status: 400 },
    )
  }

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const videoUrl = `https://www.youtube.com/watch?v=${id}`
        const endpoint =
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`

        const response = await fetch(endpoint, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 60 * 60 * 24 },
          signal: AbortSignal.timeout(7000),
        })

        if (!response.ok) return [id, null] as const
        const payload = (await response.json()) as OEmbedResult
        const title =
          typeof payload.title === 'string'
            ? payload.title.trim().slice(0, 300)
            : ''

        return [id, title || null] as const
      } catch {
        return [id, null] as const
      }
    }),
  )

  return NextResponse.json(
    { titles: Object.fromEntries(results) },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
  )
}