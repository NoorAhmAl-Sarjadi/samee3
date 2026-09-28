import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://mp3quran.net/api/v3/riwayat'
const REQUEST_TIMEOUT = 12_000
const CACHE_TTL = 1000 * 60 * 60 * 12

let cache: { at: number; payload: unknown } | null = null

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') || 'ar'
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.payload, {
      headers: { 'Cache-Control': 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400' },
    })
  }
  const url = new URL(BASE_URL)
  url.searchParams.set('language', language)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, { cache: 'force-cache', signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'SAMEE3/1.0 riwayat client' } })
    if (!response.ok) return NextResponse.json({ error: `MP3Quran HTTP ${response.status}`, riwayat: [] }, { status: 502 })
    const payload = await response.json()
    cache = { at: Date.now(), payload }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400' } })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json({ error: aborted ? 'انتهى وقت تحميل الروايات.' : 'تعذر تحميل الروايات.', riwayat: [] }, { status: 502 })
  } finally { clearTimeout(timeoutId) }
}
