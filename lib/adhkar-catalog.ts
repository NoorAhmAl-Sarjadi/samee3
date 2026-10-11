export type AdhkarDailyType = 'morning' | 'evening' | 'sleep' | 'waking'
export type AdhkarTopic = AdhkarDailyType | 'other'
export type CatalogOrigin = 'cache' | 'primary' | 'backup'

export interface AdhkarItem {
  id: number
  text: string
  count: number
  audio?: string
  filename?: string
  source?: string
  reference?: string
  benefit?: string
}

export interface AdhkarCategory {
  id: number
  category: string
  audio?: string
  filename?: string
  array: AdhkarItem[]
}

export interface AdhkarCatalog {
  categories: AdhkarCategory[]
  origin: CatalogOrigin
  loadedAt: number
  categoryCount: number
  itemCount: number
}

export interface AdhkarSearchResult {
  categoryId: number
  categoryTitle: string
  item: AdhkarItem
  key: string
}

export interface AdhkarCitation {
  collectionTitle: string
  collectionAuthor: string
  collectionUrl: string
  status: 'item-reference' | 'collection-only'
  reference: string | null
  source: string | null
  benefit: string | null
  clarification: string
}

export const ADHKAR_CATALOG_SOURCE = {
  title: 'حصن المسلم من أذكار الكتاب والسنة',
  author: 'سعيد بن علي بن وهف القحطاني',
  projectUrl: 'https://github.com/rn0x/Adhkar-json',
  primaryUrl: 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json',
  backupUrl: 'https://raw.githubusercontent.com/rn0x/Adhkar-json/main/adhkar.json',
  audioBaseUrl: 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main',
  cacheName: 'samee3-adhkar-data-v1',
} as const

const MAX_TEXT_BYTES = 4 * 1024 * 1024
const MAX_CATEGORIES = 500
const MAX_ITEMS = 10000
const MIN_CATEGORIES = 5
const MIN_ITEMS = 20
const TIMEOUT_MS = 15000

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function positiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 100000
    ? numeric
    : fallback
}

function optionalText(value: unknown, limit = 2000): string | undefined {
  if (typeof value !== 'string') return undefined

  const result = value.trim()

  return result && result.length <= limit ? result : undefined
}

function recordingPath(value: unknown): string | undefined {
  const path = optionalText(value, 2048)

  if (!path) return undefined

  if (/^\/?audio\/[a-zA-Z0-9_./-]+\.mp3(?:\?.*)?$/i.test(path)) {
    if (path.includes('..')) return undefined
    return path
  }

  if (/^https:\/\//i.test(path)) {
    try {
      const url = new URL(path)

      if (url.username || url.password || url.port) {
        return undefined
      }

      if (!/\.mp3$/i.test(url.pathname)) {
        return undefined
      }

      if (
        url.hostname === 'cdn.jsdelivr.net' ||
        url.hostname === 'raw.githubusercontent.com'
      ) {
        return url.href
      }
    } catch {
      return undefined
    }
  }

  return undefined
}

function rawCategories(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []

  for (const key of ['data', 'adhkar', 'categories']) {
    if (Array.isArray(value[key])) {
      return value[key] as unknown[]
    }
  }

  return []
}

export function parseAdhkarCategories(data: unknown): AdhkarCategory[] {
  const source = rawCategories(data)

  if (
    source.length < MIN_CATEGORIES ||
    source.length > MAX_CATEGORIES
  ) {
    throw new Error('عدد أقسام الأذكار في المصدر غير صالح.')
  }

  const usedCategoryIds = new Set<number>()
  let totalItems = 0

  const categories: AdhkarCategory[] = source.map(
    (raw): AdhkarCategory => {
      if (!isRecord(raw)) {
        throw new Error('قسم غير صالح في بيانات الأذكار.')
      }

      const id = positiveInteger(raw.id, 0)
      const title = optionalText(raw.category, 180)

      if (
        !id ||
        !title ||
        usedCategoryIds.has(id) ||
        !Array.isArray(raw.array)
      ) {
        throw new Error('معرّف أو عنوان قسم غير صالح في مصدر الأذكار.')
      }

      usedCategoryIds.add(id)

      const usedItemIds = new Set<number>()

      const items: AdhkarItem[] = raw.array.map(
        (entry: unknown): AdhkarItem => {
          if (!isRecord(entry)) {
            throw new Error('ذكر غير صالح في المصدر.')
          }

          const itemId = positiveInteger(entry.id, 0)
          const text = optionalText(entry.text, 30000)
          const count = positiveInteger(entry.count, 1)

          if (
            !itemId ||
            !text ||
            usedItemIds.has(itemId) ||
            count > 1000
          ) {
            throw new Error('نص ذكر أو رقم أو عدد تكراره غير صالح.')
          }

          usedItemIds.add(itemId)

          return {
            id: itemId,
            text,
            count,
            ...(recordingPath(entry.audio)
              ? { audio: recordingPath(entry.audio) }
              : {}),
            ...(optionalText(entry.filename, 160)
              ? { filename: optionalText(entry.filename, 160) }
              : {}),
            ...(optionalText(entry.source, 2000)
              ? { source: optionalText(entry.source, 2000) }
              : {}),
            ...(optionalText(entry.reference, 2000)
              ? { reference: optionalText(entry.reference, 2000) }
              : {}),
            ...(optionalText(entry.benefit, 3000)
              ? { benefit: optionalText(entry.benefit, 3000) }
              : {}),
          }
        },
      )

      if (!items.length) {
        throw new Error('يوجد قسم أذكار فارغ.')
      }

      totalItems += items.length

      if (totalItems > MAX_ITEMS) {
        throw new Error('حجم فهرس الأذكار غير معتاد.')
      }

      return {
        id,
        category: title,
        array: items,
        ...(recordingPath(raw.audio)
          ? { audio: recordingPath(raw.audio) }
          : {}),
        ...(optionalText(raw.filename, 160)
          ? { filename: optionalText(raw.filename, 160) }
          : {}),
      }
    },
  )

  if (totalItems < MIN_ITEMS) {
    throw new Error('بيانات الأذكار ناقصة؛ لم تُقبل النسخة الجديدة.')
  }

  return categories
}

export function normalizeAdhkarSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
    .trim()
}

export function getAdhkarTopics(
  category: AdhkarCategory,
): AdhkarTopic[] {
  const title = normalizeAdhkarSearch(category.category)
  const topics: AdhkarDailyType[] = []

  if (title.includes('الصباح')) {
    topics.push('morning')
  }

  if (title.includes('المساء')) {
    topics.push('evening')
  }

  if (
    title.includes('النوم') &&
    !title.includes('الاستيقاظ')
  ) {
    topics.push('sleep')
  }

  if (title.includes('الاستيقاظ')) {
    topics.push('waking')
  }

  return topics.length ? topics : ['other']
}

export function findAdhkarCategory(
  categories: AdhkarCategory[],
  type: AdhkarDailyType,
): AdhkarCategory | null {
  return (
    categories.find((category) =>
      getAdhkarTopics(category).includes(type),
    ) || null
  )
}

export function adhkarEntryKey(
  categoryId: number,
  itemId: number,
): string {
  return `${categoryId}:${itemId}`
}

export function adhkarProgressKey(
  categoryId: number | null,
  type: AdhkarDailyType,
): string {
  return `samee3_adhkar_progress_v2_${categoryId || type}`
}

export function adhkarFavoritesKey(
  categoryId: number | null,
  type: AdhkarDailyType,
): string {
  return `samee3_adhkar_favorites_${categoryId || type}`
}

export function searchAdhkar(
  categories: AdhkarCategory[],
  phrase: string,
  options: {
    categoryId?: number
    limit?: number
  } = {},
): AdhkarSearchResult[] {
  const query = normalizeAdhkarSearch(phrase)

  if (!query) return []

  const limit = Math.max(
    1,
    Math.min(options.limit ?? 80, 500),
  )

  const results: AdhkarSearchResult[] = []

  for (const category of categories) {
    if (
      options.categoryId &&
      options.categoryId !== category.id
    ) {
      continue
    }

    const titleMatches = normalizeAdhkarSearch(
      category.category,
    ).includes(query)

    for (const item of category.array) {
      if (
        titleMatches ||
        normalizeAdhkarSearch(item.text).includes(query) ||
        normalizeAdhkarSearch(item.reference || '').includes(query)
      ) {
        results.push({
          categoryId: category.id,
          categoryTitle: category.category,
          item,
          key: adhkarEntryKey(category.id, item.id),
        })

        if (results.length >= limit) {
          return results
        }
      }
    }
  }

  return results
}

export function adhkarCitation(
  item: AdhkarItem,
): AdhkarCitation {
  const reference = optionalText(item.reference)
  const source = optionalText(item.source)
  const benefit = optionalText(item.benefit, 3000)

  const explicit = Boolean(reference || source)

  return {
    collectionTitle: ADHKAR_CATALOG_SOURCE.title,
    collectionAuthor: ADHKAR_CATALOG_SOURCE.author,
    collectionUrl: ADHKAR_CATALOG_SOURCE.projectUrl,
    status: explicit
      ? 'item-reference'
      : 'collection-only',
    reference: reference || null,
    source: source || null,
    benefit: benefit || null,
    clarification: explicit
      ? 'المرجع معروض كما ورد في بيانات المصدر، ولم يُراجع تخريجه آليًا.'
      : 'المصدر يذكر نسبة المجموعة إلى حصن المسلم، لكنه لا يورد تخريجًا مستقلًا لهذا الذكر.',
  }
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'AbortError'
  )
}

export async function readCachedAdhkar():
  Promise<AdhkarCategory[] | null> {
  if (typeof caches === 'undefined') {
    return null
  }

  try {
    const existing = await caches.keys()

    if (
      !existing.includes(
        ADHKAR_CATALOG_SOURCE.cacheName,
      )
    ) {
      return null
    }

    const cache = await caches.open(
      ADHKAR_CATALOG_SOURCE.cacheName,
    )

    const response = await cache.match(
      ADHKAR_CATALOG_SOURCE.primaryUrl,
    )

    if (!response || !response.ok) {
      return null
    }

    return parseAdhkarCategories(
      (await response.json()) as unknown,
    )
  } catch {
    return null
  }
}

async function downloadCorpus(
  url: string,
  signal?: AbortSignal,
): Promise<{
  categories: AdhkarCategory[]
  raw: string
}> {
  const timeout = new AbortController()

  const timeoutId = setTimeout(
    () => timeout.abort(),
    TIMEOUT_MS,
  )

  const cancel = () => timeout.abort()

  signal?.addEventListener('abort', cancel, {
    once: true,
  })

  try {
    if (signal?.aborted) {
      throw new DOMException(
        'Aborted',
        'AbortError',
      )
    }

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: timeout.signal,
    })

    if (!response.ok) {
      throw new Error(
        `Adhkar source HTTP ${response.status}`,
      )
    }

    const declared = Number(
      response.headers.get('Content-Length') || '0',
    )

    if (declared > MAX_TEXT_BYTES) {
      throw new Error(
        'ملف الأذكار كبير على نحو غير متوقع.',
      )
    }

    if (!response.body) {
      throw new Error(
        'المصدر لم يرجع محتوى.',
      )
    }

    const reader = response.body.getReader()
    const buffers: Uint8Array[] = []

    let size = 0

    try {
      for (;;) {
        if (signal?.aborted) {
          throw new DOMException(
            'Aborted',
            'AbortError',
          )
        }

        const { value, done } = await reader.read()

        if (done) break
        if (!value) continue

        size += value.byteLength

        if (size > MAX_TEXT_BYTES) {
          throw new Error(
            'حجم بيانات الأذكار يتجاوز الحد الآمن.',
          )
        }

        buffers.push(value)
      }
    } catch (error) {
      void reader.cancel().catch(
        () => undefined,
      )

      throw error
    } finally {
      reader.releaseLock()
    }

    const bytes = new Uint8Array(size)

    let offset = 0

    for (const buffer of buffers) {
      bytes.set(buffer, offset)
      offset += buffer.byteLength
    }

    const raw = new TextDecoder('utf-8', {
      fatal: true,
    }).decode(bytes)

    const json: unknown = JSON.parse(raw) as unknown

    return {
      categories: parseAdhkarCategories(json),
      raw,
    }
  } finally {
    clearTimeout(timeoutId)

    signal?.removeEventListener(
      'abort',
      cancel,
    )
  }
}

async function writeCachedAdhkar(
  raw: string,
): Promise<void> {
  if (typeof caches === 'undefined') {
    return
  }

  try {
    const cache = await caches.open(
      ADHKAR_CATALOG_SOURCE.cacheName,
    )

    await cache.put(
      ADHKAR_CATALOG_SOURCE.primaryUrl,
      new Response(raw, {
        status: 200,
        headers: {
          'Content-Type':
            'application/json; charset=utf-8',
        },
      }),
    )
  } catch {
    // Cache storage can be unavailable or full.
  }
}

export async function loadAdhkarCatalog(
  options: {
    signal?: AbortSignal
    refresh?: boolean
  } = {},
): Promise<AdhkarCatalog> {
  const cached = await readCachedAdhkar()

  if (options.signal?.aborted) {
    throw new DOMException(
      'Aborted',
      'AbortError',
    )
  }

  if (cached && !options.refresh) {
    return {
      categories: cached,
      origin: 'cache',
      loadedAt: Date.now(),
      categoryCount: cached.length,
      itemCount: cached.reduce(
        (sum, category) =>
          sum + category.array.length,
        0,
      ),
    }
  }

  for (const entry of [
    {
      origin: 'primary' as const,
      url: ADHKAR_CATALOG_SOURCE.primaryUrl,
    },
    {
      origin: 'backup' as const,
      url: ADHKAR_CATALOG_SOURCE.backupUrl,
    },
  ]) {
    if (options.signal?.aborted) {
      throw new DOMException(
        'Aborted',
        'AbortError',
      )
    }

    try {
      const result = await downloadCorpus(
        entry.url,
        options.signal,
      )

      await writeCachedAdhkar(
        result.raw,
      )

      return {
        categories: result.categories,
        origin: entry.origin,
        loadedAt: Date.now(),
        categoryCount: result.categories.length,
        itemCount: result.categories.reduce(
          (sum, category) =>
            sum + category.array.length,
          0,
        ),
      }
    } catch (error) {
      if (
        options.signal?.aborted ||
        (
          isAbort(error) &&
          options.signal?.aborted
        )
      ) {
        throw error
      }
    }
  }

  if (cached) {
    return {
      categories: cached,
      origin: 'cache',
      loadedAt: Date.now(),
      categoryCount: cached.length,
      itemCount: cached.reduce(
        (sum, category) =>
          sum + category.array.length,
        0,
      ),
    }
  }

  throw new Error(
    'تعذر فتح بيانات الأذكار. افتح القسم مرة أثناء الاتصال لحفظ نصوصه على الجهاز.',
  )
}
