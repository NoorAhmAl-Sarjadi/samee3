export const SAMEE3_AUDIO_CACHES = [
  'samee3-audio-v2',
  'samee3-v2-audio',
  'samee-audio-v2',
] as const

const LIBRARY_DB = 'samee-audio-library'
const LIBRARY_STORE = 'audio'
const MAX_AUDIO_BYTES = 180 * 1024 * 1024

export type OfflineAudioIdentity = {
  url: string
  /** Existing app/audio key, e.g. quran:reciter:riwaya:surah. */
  key?: string
  kind?: 'quran' | 'library'
}

export type OfflineAudioSource = {
  src: string
  objectUrl: string | null
  origin: 'cache' | 'indexeddb' | 'legacy-cache'
  /** False for opaque responses, whose bytes cannot be inspected. */
  verified: boolean
}

export type OfflineAudioRecord = {
  key: string
  title: string
  subtitle: string
  blob: Blob
  savedAt: number
  item?: unknown
}

function safeUrl(value: string): string | null {
  try {
    if (typeof location === 'undefined') return null
    const url = new URL(value, location.origin)
    if (url.protocol !== 'https:' && url.origin !== location.origin) {
      return null
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null
    }
    return url.href
  } catch {
    return null
  }
}

function isCompleteResponse(response: Response): boolean {
  const type = (response.headers.get('Content-Type') || '').toLowerCase()
  const length = response.headers.get('Content-Length')
  return response.ok && response.status === 200 &&
    response.type !== 'opaque' &&
    !response.headers.has('Content-Range') &&
    !/(?:text\/html|application\/(?:json|xml))/.test(type) &&
    length !== '0'
}

async function openExistingLibrary(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null

  if (typeof indexedDB.databases === 'function') {
    try {
      const databases = await indexedDB.databases()
      if (!databases.some((item) => item.name === LIBRARY_DB)) return null
    } catch {
      // Some browsers do not expose databases().
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DB)
    let settled = false
    const timeout = setTimeout(() => finish(null, new Error('انتهت مهلة فتح مخزن الصوت.')), 8000)

    function finish(database: IDBDatabase | null, error?: Error) {
      if (settled) {
        database?.close()
        return
      }
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(database)
    }

    request.onupgradeneeded = () => {
      // Do not create an empty database merely to search for saved audio.
      request.transaction?.abort()
    }
    request.onsuccess = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(LIBRARY_STORE)) {
        finish(null)
        database.close()
        return
      }
      database.onversionchange = () => database.close()
      finish(database)
    }
    request.onerror = () => {
      if (request.error?.name === 'AbortError') finish(null)
      else finish(null, request.error || new Error('تعذر فتح مخزن الصوت.'))
    }
    request.onblocked = () => finish(null, new Error('أغلق تبويبات التطبيق الأخرى وأعد المحاولة.'))
  })
}

/** Recover the original IndexedDB key from the existing audio catalog. */
function catalogKeyForUrl(url: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('samee3_audio_saved_catalog_v1')
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || item.audioUrl !== url) continue
      if (item.kind === 'quran') {
        return `quran:${item.reciterId}:${item.riwayaId}:${item.surahId}`
      }
      if (item.kind === 'library' && item.libraryId) {
        return `library:${item.libraryId}`
      }
    }
  } catch {
    // A malformed catalog must not break audio playback.
  }
  return null
}

async function readIndexedAudio(key: string): Promise<Blob | null> {
  if (!key) return null
  const database = await openExistingLibrary()
  if (!database) return null

  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = database.transaction(LIBRARY_STORE, 'readonly')
      const request = tx.objectStore(LIBRARY_STORE).get(key)
      let blob: Blob | null = null

      request.onsuccess = () => {
        const value = request.result as { blob?: unknown } | undefined
        blob = value?.blob instanceof Blob && value.blob.size > 0
          ? value.blob : null
      }
      tx.oncomplete = () => resolve(blob)
      tx.onerror = () => reject(tx.error || new Error('تعذر قراءة الصوت المحفوظ.'))
      tx.onabort = () => reject(tx.error || new Error('تعذر قراءة الصوت المحفوظ.'))
    })
  } finally {
    database.close()
  }
}

async function writeIndexedAudio(record: OfflineAudioRecord): Promise<void> {
  // app/audio/page.tsx already creates this database when needed.
  // If it doesn't exist yet, initialize its exact existing schema.
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB غير متاح.'))
      return
    }
    const request = indexedDB.open(LIBRARY_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LIBRARY_STORE)) {
        request.result.createObjectStore(LIBRARY_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('مخزن الصوت مفتوح في تبويب آخر.'))
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(LIBRARY_STORE, 'readwrite')
      tx.objectStore(LIBRARY_STORE).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('تعذر حفظ الصوت.'))
      tx.onabort = () => reject(tx.error || new Error('مساحة التخزين غير كافية.'))
    })
  } finally {
    database.close()
  }
}

/**
 * Resolves a saved full audio file WITHOUT a network request.
 * Caller must revoke the objectUrl when replacing/stopping playback.
 */
export async function resolveOfflineAudio(
  identity: OfflineAudioIdentity,
): Promise<OfflineAudioSource | null> {
  const url = safeUrl(identity.url)
  let opaqueFound = false

  if (url && typeof caches !== 'undefined') {
    try {
      const existing = await caches.keys()
      for (const name of SAMEE3_AUDIO_CACHES) {
        if (!existing.includes(name)) continue
        const response = await (await caches.open(name)).match(url)
        if (!response) continue
        if (response.type === 'opaque') {
          opaqueFound = true
          continue
        }
        if (!isCompleteResponse(response)) continue
        const blob = await response.blob()
        if (blob.size === 0 || blob.size > MAX_AUDIO_BYTES) continue
        const objectUrl = URL.createObjectURL(blob)
        return { src: objectUrl, objectUrl, origin: 'cache', verified: true }
      }
    } catch {
      // IndexedDB is a separate fallback.
    }
  }

  const indexedKey = identity.key || (url ? catalogKeyForUrl(url) : null)
  if (indexedKey) {
    try {
      const blob = await readIndexedAudio(indexedKey)
      if (blob && blob.size <= MAX_AUDIO_BYTES) {
        const objectUrl = URL.createObjectURL(blob)
        return { src: objectUrl, objectUrl, origin: 'indexeddb', verified: true }
      }
    } catch {
      // An unreadable record should not stop the online player.
    }
  }

  // Legacy opaque MP3s can only be served by an active Service Worker.
  // Never mark them verified: JavaScript cannot inspect their body.
  if (
    opaqueFound && url &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.serviceWorker?.controller)
  ) {
    return { src: url, objectUrl: null, origin: 'legacy-cache', verified: false }
  }

  return null
}

export function releaseOfflineAudio(source: OfflineAudioSource | null): void {
  if (source?.objectUrl) {
    URL.revokeObjectURL(source.objectUrl)
  }
}

/**
 * Downloads the complete response; never caches partial HTTP 206 audio.
 * A failed download does not overwrite a previously saved copy.
 */
export async function saveOfflineAudio(
  identity: OfflineAudioIdentity,
  options?: {
    title?: string
    subtitle?: string
    signal?: AbortSignal
    onProgress?: (receivedBytes: number, totalBytes: number | null) => void
  },
): Promise<{ bytes: number; savedTo: 'cache' | 'indexeddb' }> {
  const url = safeUrl(identity.url)
  if (!url) throw new Error('رابط الصوت غير صالح.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('التنزيل يحتاج إلى اتصال بالإنترنت.')
  }

  const response = await fetch(url, {
    method: 'GET',
    mode: new URL(url).origin === location.origin ? 'same-origin' : 'cors',
    credentials: 'omit',
    cache: 'no-store',
    signal: options?.signal,
  })
  if (!isCompleteResponse(response) || !response.body) {
    throw new Error('المصدر لم يُرجع ملفًا صوتيًا كاملًا قابلًا للحفظ.')
  }

  const declared = response.headers.get('Content-Length')
  const expected = declared && /^\d+$/.test(declared) ? Number(declared) : null
  if (expected !== null && expected > MAX_AUDIO_BYTES) {
    throw new Error('حجم التسجيل يتجاوز الحد المسموح.')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  try {
    for (;;) {
      if (options?.signal?.aborted) throw new Error('تم إيقاف التنزيل.')
      const chunk = await reader.read()
      if (chunk.done) break
      if (!chunk.value) continue
      received += chunk.value.byteLength
      if (received > MAX_AUDIO_BYTES) {
        throw new Error('حجم التسجيل يتجاوز الحد المسموح.')
      }
      chunks.push(chunk.value)
      options?.onProgress?.(received, expected)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  if (received === 0 || (expected !== null && expected !== received)) {
    throw new Error('تحميل التسجيل لم يكتمل، ولم تُغيّر النسخة السابقة.')
  }

  const type = response.headers.get('Content-Type') || 'audio/mpeg'
  const blob = new Blob(chunks as BlobPart[], { type })

  if (identity.kind !== 'library' && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(SAMEE3_AUDIO_CACHES[0])
      await cache.put(url, new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Content-Length': String(blob.size),
        },
      }))
      return { bytes: blob.size, savedTo: 'cache' }
    } catch {
      // Cache quota failure: fall back to IndexedDB when a key is provided.
    }
  }

  if (!identity.key) {
    throw new Error('تعذر حفظ الصوت بالكاش؛ يلزم مفتاح تسجيل للتخزين البديل.')
  }

  await writeIndexedAudio({
    key: identity.key,
    title: options?.title || 'تلاوة محفوظة',
    subtitle: options?.subtitle || '',
    blob,
    savedAt: Date.now(),
  })
  return { bytes: blob.size, savedTo: 'indexeddb' }
}