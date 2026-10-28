import { RIWAYAT, type RiwayaId } from './Samee3DataAdapter'
import { cachedPagePart, MUSHAF_PAGE_CACHE } from './mushaf-cache'

export const DOWNLOADS_CHANGED = 'samee3-mushaf-downloads-changed'
export const TOTAL_MUSHAF_PAGES = 604
export type MushafCacheSummary = { completed: Record<RiwayaId, Set<number>>; supported: boolean }

export async function inspectMushafDownloads(): Promise<MushafCacheSummary> {
  const completed = Object.fromEntries(RIWAYAT.map((item) => [item.id, new Set<number>()])) as Record<RiwayaId, Set<number>>
  if (typeof window === 'undefined' || !('caches' in window)) return { completed, supported: false }
  const flags = Object.fromEntries(RIWAYAT.map((item) => [item.id, new Uint8Array(605)])) as Record<RiwayaId, Uint8Array>
  try {
    const names = await caches.keys()
    for (const name of [MUSHAF_PAGE_CACHE, 'samee3-v3-riwaya-images']) {
      if (!names.includes(name)) continue
      for (const request of await (await caches.open(name)).keys()) {
        const entry = cachedPagePart(request.url, location.origin)
        if (entry) flags[entry.riwaya][entry.page] |= entry.part
      }
    }
    for (const { id } of RIWAYAT) {
      const needed = id === 'sousi' || id === 'bazzi' ? 7 : 3
      for (let page = 1; page <= TOTAL_MUSHAF_PAGES; page += 1) {
        if ((flags[id][page] & needed) === needed) completed[id].add(page)
      }
    }
    return { completed, supported: true }
  } catch { return { completed, supported: false } }
}

export function currentMushafReading(): RiwayaId {
  const valid = (value: unknown): value is RiwayaId => RIWAYAT.some((item) => item.id === value)
  const query = new URLSearchParams(location.search).get('riwaya')
  if (valid(query)) return query
  try {
    const reading = JSON.parse(localStorage.getItem('samee3_persistent_reading_v2') || 'null')
    if (valid(reading?.riwaya)) return reading.riwaya
    const selected = localStorage.getItem('samee3_selected_riwaya_v2')
    if (valid(selected)) return selected
  } catch { /* Optional preferences never determine download completion. */ }
  return 'hafs'
}

export function announceMushafDownloadsChanged(): void {
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED))
}