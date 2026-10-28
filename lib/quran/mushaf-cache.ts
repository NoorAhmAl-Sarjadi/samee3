import type { RiwayaId } from './Samee3DataAdapter'

export const MUSHAF_PAGE_CACHE = 'samee3-mushaf-pages-v2'
export const pageDataUrl = (riwaya: RiwayaId, page: number) => `/api/quran?riwaya=${riwaya}&page=${page}&v=6`
export const pageSvgUrl = (riwaya: RiwayaId, page: number) => `/api/mushaf-svg?riwaya=${riwaya}&page=${page}&v=5`
export const pageImageUrl = (riwaya: RiwayaId, page: number) => `/api/mushaf-riwaya-image?riwaya=${riwaya}&page=${page}&v=5`
export const readingMapUrl = (riwaya: RiwayaId) => `/api/quran?riwaya=${riwaya}&mode=index&v=1`

const VERSIONS: Record<string, { version: string; part: number }> = {
  '/api/quran': { version: '6', part: 1 },
  '/api/mushaf-svg': { version: '5', part: 2 },
  '/api/mushaf-riwaya-image': { version: '5', part: 4 },
}
const RIWAYAT = new Set(['hafs', 'warsh', 'qalun', 'douri', 'shubah', 'sousi', 'bazzi'])

/** A previous schema or a different query is not a completed current page. */
export function cachedPagePart(value: string, origin: string): { riwaya: RiwayaId; page: number; part: number } | null {
  try {
    const url = new URL(value, origin)
    const definition = VERSIONS[url.pathname]
    const riwaya = url.searchParams.get('riwaya') || ''
    const page = Number(url.searchParams.get('page'))
    if (url.origin !== origin || !definition || !RIWAYAT.has(riwaya) ||
      url.searchParams.get('v') !== definition.version || url.searchParams.has('mode') ||
      !Number.isInteger(page) || page < 1 || page > 604) return null
    return { riwaya: riwaya as RiwayaId, page, part: definition.part }
  } catch { return null }
}

/** Bound SVG/text memory while retaining persistent downloads in Cache Storage. */
export function rememberPage<T>(cache: Map<string, T>, key: string, value: T, limit = 24): T {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > limit) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  return value
}

/** The timeout covers the body as well as response headers (including Safari). */
export async function fetchMushafJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, { cache: 'force-cache', ...init, signal: controller.signal,
      headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('تعذر تحميل بيانات المصحف. أعد المحاولة عند توفر الاتصال.')
    return await response.json()
  } finally { clearTimeout(timeout) }
}
