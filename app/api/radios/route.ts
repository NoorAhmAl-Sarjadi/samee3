import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://mp3quran.net/api/v3/radios'
const REQUEST_TIMEOUT = 12_000
const CACHE_TTL = 1000 * 60 * 60 * 6
const cache = new Map<string, { at: number; payload: unknown }>()

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') || 'ar'
  const key = language
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return NextResponse.json(hit.payload, { headers: { 'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=43200' } })
  const url = new URL(BASE_URL)
  url.searchParams.set('language', language)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, { cache: 'force-cache', signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'SAMEE3/1.0 radios client' } })
    if (!response.ok) return NextResponse.json({ error: `MP3Quran HTTP ${response.status}`, radios: [] }, { status: 502 })
    const payload = await response.json()
    cache.set(key, { at: Date.now(), payload })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=43200' } })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json({ error: aborted ? 'انتهى وقت تحميل الإذاعات.' : 'تعذر تحميل الإذاعات.', radios: [] }, { status: 502 })
  } finally { clearTimeout(timeoutId) }
}
