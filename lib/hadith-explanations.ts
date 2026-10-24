import type { HadithRecord } from './hadith-catalog'
import { findHadithBook } from './hadith-catalog'

/**
 * SAMEE3 — Curated hadith explanations.
 *
 * This module never invents explanations, narrator information, benefits,
 * or authenticity grades. It only displays entries explicitly reviewed
 * and included in /public/data/hadith-explanations.json.
 *
 * JSON format:
 * {
 *   "version": 1,
 *   "entries": [
 *     {
 *       "id": "unique-editorial-id",
 *       "bookId": "bukhari",
 *       "chapterId": 0,
 *       "hadithNumber": 1,
 *       "textAnchor": "an exact phrase from the matching Arabic hadith",
 *       "title": "Explanation title",
 *       "explanation": "Reviewed explanation (licensed or originally authored)",
 *       "vocabulary": [{ "word": "...", "meaning": "..." }],
 *       "benefits": ["..."],
 *       "source": {
 *         "title": "Source work",
 *         "author": "Scholar or author",
 *         "reference": "Page/volume/location in this work",
 *         "url": "https://..."
 *       },
 *       "editorial": {
 *         "status": "approved",
 *         "reviewedBy": "Reviewer",
 *         "reviewedAt": "2026-10-11",
 *         "rights": "licensed"
 *       }
 *     }
 *   ]
 * }
 *
 * Only publish content after manual bibliographical and rights checks.
 * A source link or editorial status is not itself proof of scholarly accuracy.
 */

export interface HadithExplanationVocabulary {
  word: string
  meaning: string
}

export interface HadithExplanationSource {
  title: string
  author?: string
  reference: string
  url: string
}

export interface HadithExplanationEditorial {
  status: 'approved'
  reviewedBy: string
  reviewedAt: string
  rights: 'licensed' | 'public-domain' | 'original'
}

export interface HadithExplanationEntry {
  id: string
  bookId: string
  chapterId: number
  hadithNumber: number
  textAnchor: string
  title: string
  explanation: string
  vocabulary: HadithExplanationVocabulary[]
  benefits: string[]
  source: HadithExplanationSource
  editorial: HadithExplanationEditorial
}

export type HadithExplanationOrigin = 'local' | 'cache' | 'memory' | 'none'

export interface HadithExplanationCatalog {
  version: 1
  entries: HadithExplanationEntry[]
  origin: HadithExplanationOrigin
}

export interface HadithExplanationResult {
  status: 'available' | 'not-found' | 'source-unavailable'
  explanation: HadithExplanationEntry | null
  origin: HadithExplanationOrigin
  message: string
  researchUrl: string
}

export interface HadithExplanationOptions {
  signal?: AbortSignal
  refresh?: boolean
}

export const HADITH_EXPLANATIONS_CONFIG = {
  localUrl: '/data/hadith-explanations.json',
  cacheName: 'samee3-hadith-explanations-v1',
  dorarSearchUrl: 'https://dorar.net/hadith/search',
  dorarApiInformation: 'https://dorar.net/index.php/api-services/hadith',
  maxBytes: 3 * 1024 * 1024,
  maxEntries: 8000,
  timeoutMs: 12000,
  memoryTtlMs: 5 * 60 * 1000,
} as const

const SAFE_ID = /^[a-zA-Z0-9_-]{4,100}$/
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

let memory: { catalog: HadithExplanationCatalog; savedAt: number } | null = null
let inflight: Promise<HadithExplanationCatalog | null> | null = null

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown, limit: number): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    return null
  }
  return value.trim()
}

function integer(value: unknown, allowZero = false): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= (allowZero ? 0 : 1) &&
    value <= 1000000
    ? value
    : null
}

function safeSourceUrl(value: unknown): string | null {
  const str = text(value, 2048)
  if (!str) return null
  try {
    const url = new URL(str)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hostname.toLowerCase() === 'localhost' ||
      url.hostname.endsWith('.local') ||
      !url.hostname.includes('.')
    ) return null
    return url.href
  } catch {
    return null
  }
}

export function normalizeHadithExplanationText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseEntry(value: unknown): HadithExplanationEntry {
  const item = record(value)
  if (!item) throw new Error('Invalid explanation entry')

  const id = text(item.id, 100)
  const bookId = text(item.bookId, 100)
  const chapterId = integer(item.chapterId, true)
  const hadithNumber = integer(item.hadithNumber)
  const textAnchor = text(item.textAnchor, 280)
  const title = text(item.title, 180)
  const explanation = text(item.explanation, 35000)
  const source = record(item.source)
  const editorial = record(item.editorial)

  const sourceTitle = text(source?.title, 250)
  const sourceAuthor = source?.author === undefined ? null : text(source.author, 250)
  const sourceReference = text(source?.reference, 500)
  const sourceUrl = safeSourceUrl(source?.url)
  const reviewedBy = text(editorial?.reviewedBy, 180)
  const reviewedAt = text(editorial?.reviewedAt, 10)
  const rights = editorial?.rights

  if (
    !id || !SAFE_ID.test(id) ||
    !bookId || !findHadithBook(bookId) ||
    chapterId === null || hadithNumber === null ||
    !textAnchor || normalizeHadithExplanationText(textAnchor).length < 18 ||
    !title || !explanation ||
    !sourceTitle || !sourceReference || !sourceUrl ||
    editorial?.status !== 'approved' ||
    !reviewedBy || !reviewedAt || !ISO_DAY.test(reviewedAt) ||
    !Number.isFinite(Date.parse(`${reviewedAt}T00:00:00Z`)) ||
    !(['licensed', 'public-domain', 'original'] as unknown[]).includes(rights)
  ) {
    throw new Error(`Incomplete or unreviewed hadith explanation: ${id || 'unknown'}`)
  }

  if (source?.author !== undefined && !sourceAuthor) {
    throw new Error(`Invalid explanation author: ${id}`)
  }

  if (item.vocabulary !== undefined && !Array.isArray(item.vocabulary)) {
    throw new Error(`Invalid vocabulary: ${id}`)
  }
  const vocabulary: HadithExplanationVocabulary[] = []
  for (const word of (item.vocabulary as unknown[] | undefined) || []) {
    const pair = record(word)
    const label = text(pair?.word, 150)
    const meaning = text(pair?.meaning, 1200)
    if (!label || !meaning || vocabulary.length >= 80) {
      throw new Error(`Invalid word meaning: ${id}`)
    }
    vocabulary.push({ word: label, meaning })
  }

  if (item.benefits !== undefined && !Array.isArray(item.benefits)) {
    throw new Error(`Invalid explanation benefits: ${id}`)
  }
  const benefits: string[] = []
  for (const benefit of (item.benefits as unknown[] | undefined) || []) {
    const statement = text(benefit, 2500)
    if (!statement || benefits.length >= 50) {
      throw new Error(`Invalid explanation benefit: ${id}`)
    }
    benefits.push(statement)
  }

  return {
    id,
    bookId,
    chapterId,
    hadithNumber,
    textAnchor,
    title,
    explanation,
    vocabulary,
    benefits,
    source: {
      title: sourceTitle,
      ...(sourceAuthor ? { author: sourceAuthor } : {}),
      reference: sourceReference,
      url: sourceUrl,
    },
    editorial: {
      status: 'approved',
      reviewedBy,
      reviewedAt,
      rights: rights as HadithExplanationEditorial['rights'],
    },
  }
}

/** Reject the entire update if even one entry lacks reference or review data. */
export function parseHadithExplanations(value: unknown): HadithExplanationEntry[] {
  const root = record(value)
  if (!root || root.version !== 1 || !Array.isArray(root.entries)) {
    throw new Error('Invalid explanation dataset version')
  }
  if (root.entries.length > HADITH_EXPLANATIONS_CONFIG.maxEntries) {
    throw new Error('Hadith explanations dataset is too large')
  }

  const entries: HadithExplanationEntry[] = []
  const keys = new Set<string>()
  const ids = new Set<string>()
  for (const item of root.entries) {
    const entry = parseEntry(item)
    const key = `${entry.bookId}:${entry.chapterId}:${entry.hadithNumber}`
    if (ids.has(entry.id) || keys.has(key)) {
      throw new Error(`Duplicate hadith explanation: ${key}`)
    }
    ids.add(entry.id)
    keys.add(key)
    entries.push(entry)
  }
  return entries
}

export function matchHadithExplanation(
  entries: readonly HadithExplanationEntry[],
  bookId: string,
  hadith: Pick<HadithRecord, 'idInBook' | 'chapterId' | 'arabic'>,
): HadithExplanationEntry | null {
  if (!findHadithBook(bookId)) return null
  if (!Number.isSafeInteger(hadith.idInBook) || hadith.idInBook < 1) return null
  if (!Number.isSafeInteger(hadith.chapterId) || hadith.chapterId < 0) return null
  const actualText = normalizeHadithExplanationText(hadith.arabic)
  if (!actualText) return null

  return entries.find((entry) =>
    entry.bookId === bookId &&
    entry.hadithNumber === hadith.idInBook &&
    entry.chapterId === hadith.chapterId &&
    actualText.includes(normalizeHadithExplanationText(entry.textAnchor))
  ) || null
}

/** Search link only: its results are NOT automatically matched to this hadith. */
export function hadithExplanationResearchUrl(arabic: string): string {
  const words = normalizeHadithExplanationText(arabic).split(' ').filter(Boolean)
  const phrase = words.slice(0, 11).join(' ').slice(0, 160)
  const params = new URLSearchParams()
  if (phrase.length >= 2) params.set('q', phrase)
  const query = params.toString()
  return `${HADITH_EXPLANATIONS_CONFIG.dorarSearchUrl}${query ? `?${query}` : ''}`
}

function cacheSupported(): boolean {
  return typeof caches !== 'undefined' && typeof window !== 'undefined'
}

async function cachedCatalog(): Promise<HadithExplanationCatalog | null> {
  if (!cacheSupported()) return null
  try {
    const names = await caches.keys()
    if (!names.includes(HADITH_EXPLANATIONS_CONFIG.cacheName)) return null
    const cache = await caches.open(HADITH_EXPLANATIONS_CONFIG.cacheName)
    const response = await cache.match(HADITH_EXPLANATIONS_CONFIG.localUrl)
    if (!response?.ok) return null
    const raw = await boundedText(response, new AbortController().signal)
    return {
      version: 1,
      entries: parseHadithExplanations(JSON.parse(raw) as unknown),
      origin: 'cache',
    }
  } catch {
    return null
  }
}

async function saveCatalog(raw: string): Promise<void> {
  if (!cacheSupported()) return
  try {
    const cache = await caches.open(HADITH_EXPLANATIONS_CONFIG.cacheName)
    await cache.put(
      HADITH_EXPLANATIONS_CONFIG.localUrl,
      new Response(raw, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    )
  } catch {
    // Cache Storage is optional on browsers with restricted storage.
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

async function boundedText(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) throw new Error('Empty explanation response')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const blocks: string[] = []
  let bytes = 0
  let finished = false
  try {
    for (;;) {
      assertNotAborted(signal)
      const packet = await reader.read()
      if (packet.done) { finished = true; break }
      if (!packet.value) continue
      bytes += packet.value.byteLength
      if (bytes > HADITH_EXPLANATIONS_CONFIG.maxBytes) {
        throw new Error('Hadith explanation response too large')
      }
      blocks.push(decoder.decode(packet.value, { stream: true }))
    }
    assertNotAborted(signal)
    blocks.push(decoder.decode())
    return blocks.join('')
  } finally {
    if (!finished) {
      try { await reader.cancel() } catch { /* canceled or errored */ }
    }
    reader.releaseLock()
  }
}

async function fetchLocalCatalog(
  signal?: AbortSignal,
): Promise<'not-installed' | HadithExplanationCatalog> {
  assertNotAborted(signal)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  const timeout = setTimeout(cancel, HADITH_EXPLANATIONS_CONFIG.timeoutMs)
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    assertNotAborted(signal)
    const response = await fetch(HADITH_EXPLANATIONS_CONFIG.localUrl, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (response.status === 404) return 'not-installed'
    if (!response.ok) throw new Error(`Explanation source returned ${response.status}`)
    const type = (response.headers.get('content-type') || '').toLowerCase()
    if (type.includes('text/html')) throw new Error('Expected JSON, received HTML')
    const raw = await boundedText(response, controller.signal)
    assertNotAborted(signal)
    const entries = parseHadithExplanations(JSON.parse(raw) as unknown)
    await saveCatalog(raw)
    return { version: 1, entries, origin: 'local' }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

/**
 * Local first, validated offline cache second.
 * Missing JSON is supported: the UI can show the manual research link.
 */
export async function loadHadithExplanations(
  options: HadithExplanationOptions = {},
): Promise<HadithExplanationCatalog | null> {
  assertNotAborted(options.signal)

  if (
    !options.refresh && memory &&
    Date.now() - memory.savedAt < HADITH_EXPLANATIONS_CONFIG.memoryTtlMs
  ) {
    return { ...memory.catalog, origin: 'memory' }
  }

  // Only share non-cancellable requests; caller-specific aborts remain isolated.
  if (!options.signal && !options.refresh && inflight) return inflight

  const run = async (): Promise<HadithExplanationCatalog | null> => {
    const cached = await cachedCatalog()
    assertNotAborted(options.signal)

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (cached) memory = { catalog: cached, savedAt: Date.now() }
      return cached
    }

    try {
      const local = await fetchLocalCatalog(options.signal)
      assertNotAborted(options.signal)
      if (local !== 'not-installed') {
        memory = { catalog: local, savedAt: Date.now() }
        return local
      }
      // Treat 404 as a missing optional dataset, not a verified empty result.
      if (cached) memory = { catalog: cached, savedAt: Date.now() }
      return cached
    } catch (error) {
      assertNotAborted(options.signal)
      if (cached) {
        memory = { catalog: cached, savedAt: Date.now() }
        return cached
      }
      throw error
    }
  }

  if (options.signal || options.refresh) return run()
  const request = run()
  inflight = request
  try {
    return await request
  } finally {
    if (inflight === request) inflight = null
  }
}

export async function getHadithExplanation(
  bookId: string,
  hadith: Pick<HadithRecord, 'idInBook' | 'chapterId' | 'arabic'>,
  options: HadithExplanationOptions = {},
): Promise<HadithExplanationResult> {
  const researchUrl = hadithExplanationResearchUrl(hadith.arabic)
  const emptyResult: HadithExplanationResult = {
    status: 'not-found',
    explanation: null,
    origin: 'none',
    message: 'لا يتوفر شرح مراجع لهذا الحديث في مكتبة سميع حاليًا. يمكنك البحث عنه في الموسوعة الحديثية ومطابقة النص والمرجع يدويًا.',
    researchUrl,
  }

  if (!findHadithBook(bookId)) return emptyResult
  assertNotAborted(options.signal)

  try {
    const catalog = await loadHadithExplanations(options)
    assertNotAborted(options.signal)
    if (!catalog) return emptyResult
    const explanation = matchHadithExplanation(catalog.entries, bookId, hadith)
    if (!explanation) return { ...emptyResult, origin: catalog.origin }
    return {
      status: 'available',
      explanation,
      origin: catalog.origin,
      message: 'شرح من سجل أُضيف بعد مراجعة تحريرية؛ يُرجى مراجعة المرجع الأصلي عند الاستشهاد.',
      researchUrl,
    }
  } catch (error) {
    assertNotAborted(options.signal)
    return {
      status: 'source-unavailable',
      explanation: null,
      origin: 'none',
      message: 'تعذر الوصول إلى الشروح المحفوظة حاليًا. نص الحديث الأصلي لم يتأثر.',
      researchUrl,
    }
  }
}