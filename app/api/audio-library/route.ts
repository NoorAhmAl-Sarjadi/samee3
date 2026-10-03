import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Section = 'ruqyah' | 'khutbah' | 'sunnah'

type LibraryItem = {
  id: string
  title: string
  subtitle: string
  audioUrl: string
  authorName?: string
  section: Section
  sourceName: string
  sourceUrl: string
  duration?: number
  downloadable: boolean
  bookId?: string
  record?: number
  isSynthetic?: boolean
}

type KhutbahScholar = {
  id: string
  name: string
  sourceUrl: string
}

type Book = {
  id: string
  name: string
  records: number
  synthetic?: boolean
  source: string
}

const ISLAMWAY_BASE = 'https://ar.islamway.net'
const HADITH_API = 'https://api.hadith.to/v1'
const ISLAMHOUSE_API = 'https://api.islamhouse.com/v1'
const ISLAMHOUSE_API_KEY = process.env.ISLAMHOUSE_API_KEY || ''

const REQUEST_TIMEOUT_MS = 15000
const SCHOLAR_PAGE_COUNT = 4
const MAX_KHUTBAH_ITEMS = 1200

/**
 * المصادر المعتمدة هنا هي صفحات المشايخ في طريق الإسلام.
 * نعيد روابط الملفات المنشورة في المصدر ولا نعيد استضافة الصوت داخل سميع.
 */
const ISLAMWAY_SCHOLARS: readonly KhutbahScholar[] = [
  { id: '39', name: 'عبد الحميد كشك', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/39` },
  { id: '28', name: 'محمد حسان', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/28` },
  { id: '32', name: 'أبو إسحاق الحويني', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/32` },
  { id: '76', name: 'محمد حسين يعقوب', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/76` },
  { id: '16', name: 'عبد العزيز بن باز', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/16` },
  { id: '50', name: 'محمد بن صالح العثيمين', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/50` },
  { id: '125', name: 'محمد بن عبد الرحمن العريفي', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/125` },
  { id: '323', name: 'صالح بن عواد المغامسي', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/323` },
  { id: '99', name: 'صالح بن فوزان الفوزان', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/99` },
  { id: '114', name: 'محمود المصري', sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/114` },
] as const

const RUQYAH_ITEMS: LibraryItem[] = [
  ['011', 'إدريس أبكر'],
  ['010', 'ماهر المعيقلي'],
  ['009', 'فارس عباد'],
  ['008', 'ناصر القطامي'],
  ['007', 'ياسر سلامة'],
  ['005', 'مشاري العفاسي'],
  ['004', 'سعد الغامدي'],
  ['003', 'خالد القحطاني'],
  ['002', 'أحمد العجمي'],
  ['001', 'ياسر الدوسري'],
].map(([file, name]) => ({
  id: `ruqyah-${file}`,
  title: 'الرُّقية الشرعية',
  subtitle: name,
  audioUrl: `https://quran.tv/mp3/roqya/files/${file}.mp3`,
  authorName: name,
  section: 'ruqyah' as const,
  sourceName: 'Quran TV',
  sourceUrl: 'https://quran.tv/prs/roqya/',
  downloadable: true,
  isSynthetic: false,
}))

const HADITH_BOOK_NAMES: Record<string, string> = {
  bukhari: 'صحيح البخاري',
  muslim: 'صحيح مسلم',
  tirmidhi: 'جامع الترمذي',
  nasai: 'سنن النسائي',
  abudawud: 'سنن أبي داود',
  ibnmajah: 'سنن ابن ماجه',
  malik: 'موطأ مالك',
  riyad: 'رياض الصالحين',
  'musnad-ahmad': 'مسند أحمد',
  nawawi40: 'الأربعون النووية',
  qudsi40: 'الأربعون حديثًا القدسية',
  shahwaliullah40: 'الأربعون حديثًا للشاه ولي الله',
}

const SUNNAH_SEARCH_TERMS = [
  'صحيح البخاري',
  'صحيح مسلم',
  'سنن أبي داود',
  'سنن النسائي',
  'سنن الترمذي',
  'جامع الترمذي',
  'سنن ابن ماجه',
  'موطأ مالك',
  'رياض الصالحين',
  'الشمائل المحمدية',
  'مشكاة المصابيح',
  'بلوغ المرام',
  'الأدب المفرد',
  'مسند أحمد',
  'عمدة الأحكام',
  'مصطلح الحديث',
  'شرح الحديث',
  'شرح السنة',
  'كتاب السنة',
]

function unique<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items))
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;|&#47;/gi, '/')
    .replace(/&nbsp;/gi, ' ')
}

function stripHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getFilenameTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const file = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1))
    return file
      .replace(/\.(mp3|m4a|ogg|wav|aac|opus)$/i, '')
      .replace(/^\d{4}-\d{2}-\d{2}-ar-/i, '')
      .replace(/^ar[-_]/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return 'مادة صوتية'
  }
}

function extractAudioUrls(value: string): string[] {
  const normalized = decodeHtml(value)
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')

  const urls = normalized.match(
    /https?:\/\/[^\s"'<>\\]+?\.(?:mp3|m4a|ogg|wav|aac|opus)(?:\?[^\s"'<>\\]*)?/gi,
  ) || []

  return uniqueStrings(urls.map((url) => url.replace(/[),.;]+$/g, '')))
}

function extractLessonLinks(html: string): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = []
  const anchorRegex = /<a\b[^>]*href=["']([^"']*\/lesson\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi

  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html)) !== null) {
    const rawUrl = decodeHtml(match[1])
    const title = stripHtml(match[2])
    if (!title) continue

    const absolute = rawUrl.startsWith('http')
      ? rawUrl
      : `${ISLAMWAY_BASE}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`

    results.push({ url: absolute, title })
  }

  return unique(results)
}

function getNearbyTitle(html: string, audioUrl: string): string {
  const index = html.indexOf(audioUrl)
  if (index < 0) return getFilenameTitle(audioUrl)

  const before = html.slice(Math.max(0, index - 5000), index)
  const headings = Array.from(before.matchAll(/<(?:h2|h3|h4|a)\b[^>]*>([\s\S]*?)<\/(?:h2|h3|h4|a)>/gi))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)

  return headings.at(-1) || getFilenameTitle(audioUrl)
}

function parseIslamwayScholarPage(
  html: string,
  scholar: KhutbahScholar,
  pageUrl: string,
): LibraryItem[] {
  const items: LibraryItem[] = []
  const pageLinks = extractLessonLinks(html)
  const pageAudioUrls = extractAudioUrls(html)

  const titleByLessonUrl = new Map(pageLinks.map((item) => [item.url, item.title]))

  for (const audioUrl of pageAudioUrls) {
    const surrounding = html.slice(Math.max(0, html.indexOf(audioUrl) - 7000), Math.min(html.length, html.indexOf(audioUrl) + 2500))
    const lessonHref = surrounding.match(/href=["']([^"']*\/lesson\/\d+[^"']*)["']/i)?.[1]
    const absoluteLessonUrl = lessonHref
      ? lessonHref.startsWith('http')
        ? decodeHtml(lessonHref)
        : `${ISLAMWAY_BASE}${lessonHref.startsWith('/') ? '' : '/'}${decodeHtml(lessonHref)}`
      : ''

    const lessonTitle = (absoluteLessonUrl && titleByLessonUrl.get(absoluteLessonUrl)) || getNearbyTitle(html, audioUrl)
    const cleanTitle = lessonTitle || 'محاضرة أو درس صوتي'

    items.push({
      id: `khutbah-${scholar.id}-${Buffer.from(audioUrl).toString('base64url')}`,
      title: cleanTitle,
      subtitle: 'خطب ومحاضرات ودروس',
      audioUrl,
      authorName: scholar.name,
      section: 'khutbah',
      sourceName: 'طريق الإسلام',
      sourceUrl: absoluteLessonUrl || pageUrl,
      downloadable: true,
      isSynthetic: false,
    })
  }

  return unique(items)
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; SAMEE3 Audio Library)',
        ...(init.headers || {}),
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, {
    cache: 'force-cache',
    next: { revalidate: 1800 },
  } as RequestInit & { next?: { revalidate?: number }})

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...init,
    cache: 'no-store',
  }, timeoutMs)

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

async function loadKhutbahsForScholar(scholar: KhutbahScholar): Promise<LibraryItem[]> {
  const urls = Array.from({ length: SCHOLAR_PAGE_COUNT }, (_, index) =>
    index === 0 ? scholar.sourceUrl : `${scholar.sourceUrl}?page=${index + 1}`,
  )

  const responses = await Promise.allSettled(urls.map(fetchHtml))
  const items: LibraryItem[] = []

  responses.forEach((result, index) => {
    if (result.status !== 'fulfilled') return
    items.push(...parseIslamwayScholarPage(result.value, scholar, urls[index]))
  })

  return unique(items)
}

async function loadKhutbahs(): Promise<LibraryItem[]> {
  const results = await Promise.allSettled(
    ISLAMWAY_SCHOLARS.map((scholar) => loadKhutbahsForScholar(scholar)),
  )

  const items: LibraryItem[] = []
  results.forEach((result) => {
    if (result.status === 'fulfilled') items.push(...result.value)
  })

  return unique(items)
    .filter((item) => Boolean(item.audioUrl) && item.section === 'khutbah' && !item.isSynthetic)
    .slice(0, MAX_KHUTBAH_ITEMS)
}

async function loadHadithBooks(): Promise<Book[]> {
  const result = await fetchJson<{ collections?: Array<Record<string, unknown>> }>(`${HADITH_API}/collections`)
  const collections = Array.isArray(result.collections) ? result.collections : []

  return collections
    .filter((book) => HADITH_BOOK_NAMES[String(book.id)] && !Boolean(book.synthetic))
    .map((book) => ({
      id: String(book.id),
      name: HADITH_BOOK_NAMES[String(book.id)],
      records: Number(book.records ?? book.count ?? book.total ?? 0),
      synthetic: false,
      source: 'Hadith.to',
    }))
    .sort((a, b) => {
      const order = Object.keys(HADITH_BOOK_NAMES)
      return order.indexOf(a.id) - order.indexOf(b.id)
    })
}

async function loadHadithItems(bookId: string, start: number, limit: number): Promise<LibraryItem[]> {
  const bookName = HADITH_BOOK_NAMES[bookId]
  if (!bookName) throw new Error('UNKNOWN_HADITH_BOOK')

  const requested = Math.max(1, Math.min(limit, 50))
  const indexes = Array.from({ length: requested }, (_, index) => start + index)

  const results = await Promise.allSettled(
    indexes.map((record) =>
      fetchJson<Record<string, any>>(
        `${HADITH_API}/hadith/${encodeURIComponent(bookId)}/${record}?include=timings`,
      ),
    ),
  )

  const items: LibraryItem[] = []

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return

    const data = result.value
    if (!data?.media?.available || !data.media.audio) return
    if (Boolean(data.media.synthetic || data.synthetic)) return

    const record = Number(data.record || indexes[index])
    const text = textValue(data.arabic)

    items.push({
      id: `sunnah-${bookId}-${record}`,
      title: `${bookName} — الحديث ${record}`,
      subtitle: text || 'حديث صوتي',
      audioUrl: String(data.media.audio),
      authorName: 'رواية صوتية',
      section: 'sunnah',
      sourceName: 'Hadith.to',
      sourceUrl: String(data.links?.website || `https://hadith.to/${bookId}/${record}`),
      duration: Number(data.wordTimings?.duration ?? data.media?.duration) || undefined,
      downloadable: true,
      bookId,
      record,
      isSynthetic: false,
    })
  })

  return items.sort((a, b) => (a.record || 0) - (b.record || 0))
}

async function loadIslamHouseSunnahExtras(): Promise<LibraryItem[]> {
  if (!ISLAMHOUSE_API_KEY) return []

  const pageCount = 8
  const responses = await Promise.allSettled(
    Array.from({ length: pageCount }, (_, index) =>
      fetchJson<{ data?: unknown[] }>(
        `${ISLAMHOUSE_API}/${encodeURIComponent(ISLAMHOUSE_API_KEY)}/main/audios/ar/showall/${index + 1}/50/json/`,
      ),
    ),
  )

  const items: LibraryItem[] = []

  for (const result of responses) {
    if (result.status !== 'fulfilled') continue

    const records = Array.isArray(result.value.data) ? result.value.data : []
    for (const raw of records as Array<Record<string, unknown>>) {
      const title = textValue(raw.title)
      const description = textValue(raw.description)
      const haystack = normalizeSearch(`${title} ${description}`)

      if (!SUNNAH_SEARCH_TERMS.some((term) => haystack.includes(normalizeSearch(term)))) continue

      const preparedBy = Array.isArray(raw.prepared_by)
        ? raw.prepared_by as Array<Record<string, unknown>>
        : []
      const author =
        textValue(preparedBy.find((entry) => entry.kind === 'author')?.title) ||
        textValue(preparedBy.find((entry) => entry.type === 'author')?.title) ||
        textValue(preparedBy[0]?.title) ||
        'دار الإسلام'

      const attachments = Array.isArray(raw.attachments)
        ? raw.attachments as Array<Record<string, unknown>>
        : []

      attachments.forEach((attachment, index) => {
        const url = textValue(attachment.url)
        if (!/\.(mp3|m4a|ogg|wav|aac|opus)(\?|$)/i.test(url)) return

        items.push({
          id: `islamhouse-sunnah-${String(raw.id ?? 'item')}-${String(attachment.order ?? index + 1)}`,
          title: textValue(attachment.description) || title || 'مادة حديثية صوتية',
          subtitle: author,
          audioUrl: url,
          authorName: author,
          section: 'sunnah',
          sourceName: 'IslamHouse',
          sourceUrl: textValue(raw.api_url) || 'https://islamhouse.com/ar/category/144409/audios/',
          duration: Number(attachment.duration) || undefined,
          downloadable: true,
          isSynthetic: false,
        })
      })
    }
  }

  return unique(items)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section') as Section | null

  if (!section || !['ruqyah', 'khutbah', 'sunnah'].includes(section)) {
    return NextResponse.json({ ok: false, error: 'Invalid section' }, { status: 400 })
  }

  try {
    if (section === 'ruqyah') {
      return NextResponse.json({
        ok: true,
        section,
        items: RUQYAH_ITEMS,
        total: RUQYAH_ITEMS.length,
      })
    }

    if (section === 'khutbah') {
      const scholarId = searchParams.get('scholar')

      if (!scholarId) {
        return NextResponse.json({
          ok: true,
          section,
          scholars: ISLAMWAY_SCHOLARS,
          items: [],
          totalScholars: ISLAMWAY_SCHOLARS.length,
          total: 0,
        })
      }

      const scholar = ISLAMWAY_SCHOLARS.find((item) => item.id === scholarId)
      if (!scholar) {
        return NextResponse.json({ ok: false, error: 'Unknown scholar' }, { status: 404 })
      }

      const items = await loadKhutbahsForScholar(scholar)

      return NextResponse.json({
        ok: true,
        section,
        scholar: { id: scholar.id, name: scholar.name, sourceUrl: scholar.sourceUrl },
        items,
        total: items.length,
      })
    }

    const bookId = searchParams.get('book')

    if (!bookId) {
      const [books, extras] = await Promise.all([
        loadHadithBooks(),
        loadIslamHouseSunnahExtras(),
      ])

      return NextResponse.json({
        ok: true,
        section,
        books,
        extras,
        totalBooks: books.length,
        totalExtras: extras.length,
      })
    }

    const requestedStart = Number(searchParams.get('start') || '1')
    const requestedLimit = Number(searchParams.get('limit') || '50')
    const start = Number.isFinite(requestedStart) ? Math.max(1, Math.floor(requestedStart)) : 1
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.floor(requestedLimit))) : 50

    const items = await loadHadithItems(bookId, start, limit)
    const bookRecords = (await loadHadithBooks()).find((book) => book.id === bookId)?.records || 0
    const nextStart = start + limit

    return NextResponse.json({
      ok: true,
      section,
      bookId,
      items,
      hasMore: bookRecords > 0 ? nextStart <= bookRecords : items.length === limit,
      nextStart,
      records: bookRecords,
    })
  } catch (error) {
    console.error('audio-library error', error)
    return NextResponse.json(
      { ok: false, error: 'تعذر تحميل المكتبة الصوتية حاليًا.' },
      { status: 502 },
    )
  }
}
