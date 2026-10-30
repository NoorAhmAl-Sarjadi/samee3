import { ALAFASY_COLLECTED_RELEASE } from '@/lib/quran/alafasy-collected'

/**
 * Read normalized, release-pinned timing files on the server.
 * Never fall back to MP3Quran timings for this independent recording.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ surah: string }> },
): Promise<Response> {
  const { surah: raw } = await context.params
  if (!/^\d{1,3}$/.test(raw)) {
    return Response.json({ error: 'Invalid surah' }, { status: 400 })
  }
  const number = Number(raw)
  if (!Number.isInteger(number) || number < 1 || number > 114) {
    return Response.json({ error: 'Invalid surah' }, { status: 400 })
  }

  const filename = `timings-${String(number).padStart(3, '0')}.json`
  const url = `${ALAFASY_COLLECTED_RELEASE}/${filename}`
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) {
      return Response.json({ error: 'Timing asset is not yet published' }, { status: 503 })
    }
    const data: unknown = await response.json()
    if (!Array.isArray(data) || data.length === 0) {
      return Response.json({ error: 'Timing asset format is invalid' }, { status: 502 })
    }
    let previousAyah = 0
    let previousStart = -1
    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return Response.json({ error: 'Malformed timing asset' }, { status: 502 })
      }
      const row = item as Record<string, unknown>
      const ayah = Number(row.ayah)
      const start = Number(row.start_time)
      const end = Number(row.end_time)
      if (!Number.isInteger(ayah) || ayah !== previousAyah + 1 ||
          !Number.isFinite(start) || !Number.isFinite(end) ||
          start < 0 || start < previousStart || end <= start) {
        return Response.json({ error: 'Malformed timing asset' }, { status: 502 })
      }
      previousAyah = ayah
      previousStart = start
    }
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch (error) {
    console.error('Alafasy collected timing request failed:', error)
    return Response.json({ error: 'Timing service temporarily unavailable' }, { status: 503 })
  }
}
