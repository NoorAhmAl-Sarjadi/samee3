import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = 'https://mp3quran.net/api/v3/ayat_timing'
const REQUEST_TIMEOUT = 12_000
const CACHE_TTL = 1000 * 60 * 60 * 24

type TimingRow = {
  ayah: number
  start_time: number
  end_time: number
  polygon: string | null
  page: string | null
}

const memoryCache = new Map<string, { at: number; data: TimingRow[] }>()

function validPositiveInt(value: string | null) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0
}

function normalize(payload: unknown): TimingRow[] {
  const root = payload as Record<string, unknown> | null
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.ayat_timing)
      ? root.ayat_timing
      : Array.isArray(root?.data)
        ? root.data
        : []

  return rows
    .map((item): TimingRow => {
      const row = item as Record<string, unknown>
      return {
        ayah: Number(row.ayah),
        start_time: Number(row.start_time),
        end_time: Number(row.end_time),
        polygon: typeof row.polygon === 'string' ? row.polygon : null,
        page: typeof row.page === 'string' ? row.page : null,
      }
    })
    .filter(
      (item) =>
        Number.isInteger(item.ayah) &&
        item.ayah >= 0 &&
        Number.isFinite(item.start_time) &&
        item.start_time >= 0,
    )
    .sort((a, b) => a.start_time - b.start_time)
}

export async function GET(request: NextRequest) {
  const surah = request.nextUrl.searchParams.get('surah')
  const read = request.nextUrl.searchParams.get('read')

  if (!validPositiveInt(surah) || !validPositiveInt(read)) {
    return NextResponse.json(
      { error: 'surah و read يجب أن يكونا رقمين صحيحين موجبين.' },
      { status: 400 },
    )
  }

  const key = `${surah}:${read}`
  const cached = memoryCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(
      { success: true, available: cached.data.length > 0, timings: cached.data },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const url = new URL(BASE_URL)
    url.searchParams.set('surah', surah)
    url.searchParams.set('read', read)

    const response = await fetch(url, {
      method: 'GET',
      cache: 'force-cache',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SAMEE3/1.0 timing client',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, available: false, timings: [], error: `MP3Quran HTTP ${response.status}` },
        { status: 502 },
      )
    }

    const timings = normalize(await response.json())
    memoryCache.set(key, { at: Date.now(), data: timings })

    return NextResponse.json(
      { success: true, available: timings.length > 0, timings },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    )
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json(
      {
        success: false,
        available: false,
        timings: [],
        error: aborted ? 'انتهى وقت تحميل توقيتات الآيات.' : 'تعذر تحميل توقيتات الآيات.',
      },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
