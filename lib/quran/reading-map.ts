import { HAFS_JUZ_RANGES } from './juz-boundaries'

export type VerseLocation = {
  surah: number
  ayah: number
  page: number
  hafsNumbers: number[]
}

// Published juz boundaries use Hafs numbering. Other readings are resolved
// through the source's number_in_hafs mapping, including merged ayahs.
export function juzForAyah(surah: number, ayah: number, hafsNumbers: number[] = []): number {
  const reference = hafsNumbers[0] || ayah
  for (let index = HAFS_JUZ_RANGES.length - 1; index >= 0; index -= 1) {
    const { surah: startSurah, ayah: startAyah } = HAFS_JUZ_RANGES[index].start
    if (surah > startSurah || (surah === startSurah && reference >= startAyah)) return index + 1
  }
  return 1
}

export function readingReference(
  locations: VerseLocation[], surah: number, ayah: number, numbering: 'local' | 'hafs' = 'local',
): VerseLocation | null {
  return locations.find((row) => row.surah === surah && (numbering === 'hafs'
    ? row.hafsNumbers.includes(ayah) : row.ayah === ayah)) || null
}

export function parseReadingMap(value: unknown): VerseLocation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row: unknown): VerseLocation[] => {
    if (!row || typeof row !== 'object') return []
    const item = row as Record<string, unknown>
    const surah = Number(item.surah), ayah = Number(item.ayah), page = Number(item.page)
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 ||
      !Number.isInteger(ayah) || ayah < 1 || ayah > 300 ||
      !Number.isInteger(page) || page < 1 || page > 604) return []
    const hafsNumbers = Array.isArray(item.hafsNumbers)
      ? item.hafsNumbers.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 286) : []
    return [{ surah, ayah, page, hafsNumbers }]
  })
}
import type { RiwayaId } from './Samee3DataAdapter'
import { fetchMushafJson, MUSHAF_PAGE_CACHE, readingMapUrl } from './mushaf-cache'

const maps = new Map<RiwayaId, VerseLocation[]>()
const requests = new Map<RiwayaId, Promise<VerseLocation[]>>()

/** Shared by the index and reader, including when the network is unavailable. */
export async function loadReadingLocations(riwaya: RiwayaId): Promise<VerseLocation[]> {
  const saved = maps.get(riwaya)
  if (saved?.length) return saved
  const pending = requests.get(riwaya)
  if (pending) return pending
  const request = (async () => {
    const url = readingMapUrl(riwaya)
    let cache: Cache | undefined
    try {
      cache = await caches.open(MUSHAF_PAGE_CACHE)
      const response = await cache.match(url)
      if (response?.ok) {
        const payload = await response.json()
        const rows = parseReadingMap(payload.locations)
        if (payload.riwaya === riwaya && rows.length) { maps.set(riwaya, rows); return rows }
      }
    } catch { /* Storage is optional. */ }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return []
    try {
      const payload = await fetchMushafJson(url) as { success?: boolean; riwaya?: string; locations?: unknown }
      const rows = parseReadingMap(payload.locations)
      if (!payload.success || payload.riwaya !== riwaya || !rows.length) return []
      maps.set(riwaya, rows)
      if (cache) await cache.put(url, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } })).catch(() => undefined)
      return rows
    } catch { return [] }
  })().finally(() => requests.delete(riwaya))
  requests.set(riwaya, request)
  return request
}
