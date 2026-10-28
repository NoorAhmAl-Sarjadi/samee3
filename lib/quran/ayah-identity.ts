type AyahIdentity = {
  number: number
  numberInSurah: number
  surah?: { number: number }
}

/** Resolve the full surah:ayah key before considering any numeric fallback. */
export function ayahForElement<T extends AyahIdentity>(element: Element, ayahs: T[]): T | null {
  const raw = (element.getAttribute('data-ayah') || element.getAttribute('ayah') || '').trim()
  const pair = /^(\d{1,3}):(\d{1,3})$/.exec(raw)
  const surah = Number(pair?.[1] || element.getAttribute('data-surah') || element.getAttribute('surah') || 0)
  const local = Number(pair?.[2] || element.getAttribute('data-ayah-number') || element.getAttribute('data-local-ayah') || raw || 0)
  if (surah > 0 && local > 0) {
    // An explicit pair must never fall through to an unrelated global number.
    return ayahs.find((ayah) => ayah.surah?.number === surah && ayah.numberInSurah === local) || null
  }

  const global = Number(element.getAttribute('data-global-ayah') || element.getAttribute('data-ayah') || 0)
  if (global > 0) return ayahs.find((ayah) => ayah.number === global) || null
  return null
}

type BookmarkIdentity = { number?: unknown; key?: unknown; riwaya?: unknown }

/** Old bookmarks without a reading belong to Hafs, as in the original app. */
export function bookmarkIdentity(value: BookmarkIdentity): string {
  const riwaya = typeof value.riwaya === 'string' && value.riwaya ? value.riwaya : 'hafs'
  const key = typeof value.key === 'string' && /^\d{1,3}:\d{1,3}$/.test(value.key)
    ? value.key : String(value.number)
  return `${riwaya}:${key}`
}

export function matchesBookmark(value: BookmarkIdentity, ayah: AyahIdentity & { key?: string }, riwaya: string): boolean {
  if ((value.riwaya || 'hafs') !== riwaya) return false
  const key = ayah.key || `${ayah.surah?.number}:${ayah.numberInSurah}`
  return value.key ? value.key === key : Number(value.number) === ayah.number
}
