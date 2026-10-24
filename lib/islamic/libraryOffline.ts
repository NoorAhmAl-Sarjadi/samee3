/** Safely cache publicly available book text. Do not cache notes, Firestore user data, or auth responses. */
export const LIBRARY_CACHE = 'samee3-islamic-text-v1'
const MAX_SECTIONS = 12000
const MAX_JSON_LENGTH = 15 * 1024 * 1024

function cacheRequest(bookId: string): Request {
  return new Request(`/api/islamic-library/book/${encodeURIComponent(bookId)}`, { method: 'GET' })
}

function eligible(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return data.success === true && Array.isArray(data.contents) && data.contents.length > 0 &&
    data.contents.length <= MAX_SECTIONS && data.contents.every((item: unknown) =>
      item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string')
}

export async function cacheLibraryBook(bookId: string, data: unknown): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !eligible(data)) return false
  try {
    const payload = JSON.stringify(data)
    if (payload.length > MAX_JSON_LENGTH) return false
    const cache = await caches.open(LIBRARY_CACHE)
    await cache.put(cacheRequest(bookId), new Response(payload, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }, status: 200,
    }))
    return true
  } catch { return false }
}

export async function readCachedLibraryBook(bookId: string): Promise<unknown | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null
  try {
    const cache = await caches.open(LIBRARY_CACHE)
    const response = await cache.match(cacheRequest(bookId))
    if (!response || !response.ok) return null
    const raw = await response.text()
    if (raw.length > MAX_JSON_LENGTH) return null
    const value: unknown = JSON.parse(raw)
    return eligible(value) ? value : null
  } catch { return null }
}

export async function removeCachedLibraryBook(bookId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false
  try { const cache = await caches.open(LIBRARY_CACHE); return cache.delete(cacheRequest(bookId)) }
  catch { return false }
}
