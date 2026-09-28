import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = 'https://mp3quran.net/api/v3/reciters'
const REQUEST_TIMEOUT = 12_000
const CACHE_TTL = 1000 * 60 * 60 * 12

type CacheItem = { at: number; payload: unknown }
const cache = new Map<string, CacheItem>()

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const language = sp.get('language') || 'ar'
  const reciter = sp.get('reciter') || ''
  const rewaya = sp.get('rewaya') || ''
  const sura = sp.get('sura') || ''

  const url = new URL(BASE_URL)
  url.searchParams.set('language', language)
  if (reciter) url.searchParams.set('reciter', reciter)
  if (rewaya) url.searchParams.set('rewaya', rewaya)
  if (sura) url.searchParams.set('sura', sura)

  const key = url.toString()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.payload, {
      headers: { 'Cache-Control': 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'force-cache',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SAMEE3/1.0 reciters client' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `MP3Quran HTTP ${response.status}`, reciters: [] },
        { status: 502 },
      )
    }

    const payload = await response.json()
    cache.set(key, { at: Date.now(), payload })
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400' },
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? 'انتهى وقت تحميل قائمة القراء.' : 'تعذر تحميل قائمة القراء.', reciters: [] },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
