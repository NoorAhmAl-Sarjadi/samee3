import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

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

const ISLAMWAY_PAGE_COUNT = 3
const ISLAMWAY_MAX_KHUTBAHS = 900
const ISLAMWAY_REQUEST_TIMEOUT = 12000

/**
 * مكتبة الخطب والمحاضرات في سميع تعتمد هنا على مصادر الشيوخ في طريق الإسلام.
 * لا نعيد استضافة الصوت؛ نعيد رابط MP3 المنشور في المصدر نفسه.
 *
 * أضفنا مجموعة كبيرة من المشايخ الآن، بدل أرشيف خطب عام تابع لجهة واحدة.
 * المعرّفات الآتية هي معرّفات صفحات الشيوخ على طريق الإسلام.
 */
const ISLAMWAY_SCHOLARS = [
  {
    id: '39',
    name: 'عبد الحميد كشك',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/39`,
  },
  {
    id: '28',
    name: 'محمد حسان',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/28`,
  },
  {
    id: '32',
    name: 'أبو إسحاق الحويني',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/32`,
  },
  {
    id: '76',
    name: 'محمد حسين يعقوب',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/76`,
  },
  {
    id: '16',
    name: 'عبد العزيز بن باز',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/16`,
  },
  {
    id: '50',
    name: 'محمد بن صالح العثيمين',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/50`,
  },
  {
    id: '125',
    name: 'محمد بن عبد الرحمن العريفي',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/125`,
  },
  {
    id: '323',
    name: 'صالح بن عواد المغامسي',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/323`,
  },
  {
    id: '99',
    name: 'صالح بن فوزان الفوزان',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/99`,
  },
  {
    id: '114',
    name: 'محمود المصري',
    sourceUrl: `${ISLAMWAY_BASE}/lessons/scholar/114`,
  },
] as const

/*
 * تسجيلات رقية بشرية منشورة مباشرة من Quran TV.
 */
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
  subtitle: String(name),
  audioUrl: `https://quran.tv/mp3/roqya/files/${file}.mp3`,
  authorName: String(name),
  section: 'ruqyah',
  sourceName: 'Quran TV',
  sourceUrl: 'https://quran.tv/prs/roqya/',
  downloadable: true,
  isSynthetic: false,
}))

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim()
}

function normalizeArabicText(value: string) {
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

function normalizeAudioUrl(url: string) {
  return decodeHtml(url)
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, '')
}

function isAllowedAudioUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return false
  if (!/\.(?:mp3|m4a|ogg|wav|aac|opus)(?:\?|$)/i.test(url)) return false
  return /(?:islamway\.net|media\.islamway\.net|download\.media\.islamway\.net)/i.test(url)
}

function absoluteIslamwayUrl(value: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('/')) return `${ISLAMWAY_BASE}${value}`
  return `${ISLAMWAY_BASE}/${value}`
}

function inferLessonTitle(html: string, audioStart: number) {
  const before = html.slice(Math.max(0, audioStart - 18000), audioStart)

  const candidates = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
    /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    /<a[^>]+href=["'](?:https?:\/\/)?ar\.islamway\.net\/lesson\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]+href=["']\/lesson\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi,
  ]

  let best = ''

  for (const pattern of candidates) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(before))) {
      const text = stripHtml(match[1] || '')
      if (text && text.length >= 3 && text.length <= 240) best = text
    }
    if (best) break
  }

  if (!best) {
    const chunk = before.slice(Math.max(0, before.length - 4000))
    const strongMatches = Array.from(
      chunk.matchAll(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi)
    )
    for (const match of strongMatches) {
      const text = stripHtml(match[1] || '')
      if (text && text.length >= 3 && text.length <= 220) best = text
    }
  }

  return best
}

function inferLessonPageUrl(html: string, audioStart: number) {
  const before = html.slice(Math.max(0, audioStart - 14000), audioStart)
  const matches = Array.from(
    before.matchAll(
      /href=["'](https?:\/\/ar\.islamway\.net\/lesson\/[^"'#]+|\/lesson\/[^"'#]+)["']/gi
    )
  )
  if (!matches.length) return ''
  return absoluteIslamwayUrl(matches[matches.length - 1][1])
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function parseIslamwayScholarPage(
  html: string,
  scholar: (typeof ISLAMWAY_SCHOLARS)[number],
  pageUrl: string
) {
  const items: LibraryItem[] = []
  const seen = new Set<string>()

  const urlPattern = /(?:https?:)?\/\/(?:download\.media\.islamway\.net|media\.islamway\.net)[^\s"'<>]+\.(?:mp3|m4a|ogg|wav|aac|opus)(?:\?[^\s"'<>]+)?/gi

  for (const match of html.matchAll(urlPattern)) {
    const raw = normalizeAudioUrl(match[0])
    if (!isAllowedAudioUrl(raw)) continue
    if (seen.has(raw)) continue
    seen.add(raw)

    const index = match.index ?? 0
    const title = inferLessonTitle(html, index)
    const lessonUrl = inferLessonPageUrl(html, index)

    items.push({
      id: `islamway-${scholar.id}-${hashString(raw)}`,
      title: title || `${scholar.name} — مادة صوتية`,
      subtitle: 'خطب ومحاضرات ودروس',
      audioUrl: raw,
      authorName: scholar.name,
      section: 'khutbah',
      sourceName: 'طريق الإسلام',
      sourceUrl: lessonUrl || pageUrl || scholar.sourceUrl,
      downloadable: true,
      isSynthetic: false,
    })
  }

  return items
}

function unique<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items))
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function truncateText(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    const normalized = value
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')

    return (
      normalized.match(
        /https?:\/\/[^\s"'<>]+\.(?:mp3|m4a|ogg|wav|aac|opus)(?:\?[^\s"'<>]*)?/gi
      ) || []
    )
  }
  if (Array.isArray(value)) return value.flatMap(extractStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(extractStrings)
  return []
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = ISLAMWAY_REQUEST_TIMEOUT
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SAMEE3 Audio Library)',
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        ...(options.headers || {}),
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchJson<T>(url: string, options?: RequestInit & { next?: { revalidate?: number } }, timeoutMs = ISLAMWAY_REQUEST_TIMEOUT): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      cache: options?.next?.revalidate ? 'force-cache' : 'no-store',
      next: options?.next,
    },
    timeoutMs
  )

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

async function fetchHtml(url: string) {
  const response = await fetchWithTimeout(
    url,
    { cache: 'force-cache', next: { revalidate: 3600 } } as RequestInit & {
      next?: { revalidate?: number }
    },
    ISLAMWAY_REQUEST_TIMEOUT
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function loadKhutbahScholars() {
  return ISLAMWAY_SCHOLARS.map((scholar) => ({
    id: scholar.id,
    name: scholar.name,
    sourceUrl: scholar.sourceUrl,
  }))
}

async function loadKhutbahsForScholar(scholar: (typeof ISLAMWAY_SCHOLARS)[number]) {
  const urls = [
    `${scholar.sourceUrl}`,
    ...Array.from(
      { length: ISLAMWAY_PAGE_COUNT - 1 },
      (_, index) => `${scholar.sourceUrl}?page=${index + 2}`
    ),
  ]

  const responses = await Promise.allSettled(
    urls.map((url) => fetchHtml(url))
  )

  const items: LibraryItem[] = []
  responses.forEach((result, index) => {
    if (result.status !== 'fulfilled') return
    items.push(...parseIslamwayScholarPage(result.value, scholar, urls[index]))
  })

  return unique(items)
}

async function loadKhutbahs() {
  const scholarResults = await Promise.allSettled(
    ISLAMWAY_SCHOLARS.map((scholar) => loadKhutbahsForScholar(scholar))
  )

  const items: LibraryItem[] = []
  scholarResults.forEach((result) => {
    if (result.status === 'fulfilled') items.push(...result.value)
  })

  return unique(items)
    .filter(
      (item) =>
        item.section === 'khutbah' &&
        item.audioUrl &&
        !item.isSynthetic
    )
    .slice(0, ISLAMWAY_MAX_KHUTBAHS)
}

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
  qudsi40: 'الأربعون حديثًا قدسيًا',
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

function unique<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    const normalized = value
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')

    return (
      normalized.match(
        /https?:\/\/[^\s\"'<>]+\.(?:mp3|m4a|ogg|wav|aac|opus)(?:\?[^\s\"'<>]*)?/gi
      ) || []
    )
  }

  if (Array.isArray(value)) return value.flatMap(extractStrings)

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(extractStrings)
  }

  return []
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getAudioFilename(url: string) {
  const clean = url.split('?')[0]
  const raw = clean.slice(clean.lastIndexOf('/') + 1)
  return decodeSafe(raw)
    .replace(/\.(?:mp3|m4a|ogg|wav|aac|opus)$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}-ar-/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function isArabicSermonAudio(url: string) {
  return (
    /(?:^|[-_\/])ar(?:[-_\/]|\.)/i.test(url) ||
    /\b-ar-/i.test(url)
  )
}

function walkSermons(
  node: unknown,
  currentTitle = '',
  currentUrl = '',
  out: LibraryItem[] = []
) {
  if (Array.isArray(node)) {
    node.forEach((child) => walkSermons(child, currentTitle, currentUrl, out))
    return out
  }

  if (!node || typeof node !== 'object') return out

  const object = node as Record<string, unknown>
  const title =
    ['title', 'name', 'subject', 'sermon_title', 'sermonTitle', 'heading']
      .map((key) => textValue(object[key]))
      .find(Boolean) || currentTitle

  const pageUrl =
    ['url', 'page_url', 'pageUrl', 'href', 'link', 'website']
      .map((key) => textValue(object[key]))
      .find((value) => /^https?:\/\//i.test(value)) || currentUrl

  for (const mp3 of uniqueStrings(extractStrings(object))) {
    const decoded = mp3.replace(/\\u0026/g, '&')
    if (!isArabicSermonAudio(decoded)) continue

    const fallback = getAudioFilename(decoded)
    out.push({
      id: `khutbah-${decoded}`,
      title: title || fallback || 'خطبة جمعة',
      subtitle: 'خطبة جمعة',
      audioUrl: decoded,
      authorName: 'الهيئة العامة للشؤون الإسلامية والأوقاف',
      section: 'khutbah',
      sourceName: 'Sermons by Islamic Network — أوقاف الإمارات',
      sourceUrl: pageUrl || 'https://sermons.islamic.network/uae-awqaf/',
      downloadable: true,
      isSynthetic: false,
    })
  }

  for (const [key, value] of Object.entries(object)) {
    if (['mp3', 'audio', 'audio_url', 'audioUrl', 'audio_file', 'audioFile'].includes(key)) continue
    walkSermons(value, title, pageUrl, out)
  }

  return out
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items))
}

function sermonTimestamp(item: LibraryItem) {
  const match = item.audioUrl.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (!match) return 0
  const timestamp = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
  return Number.isFinite(timestamp) ? timestamp : 0
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = ISLAMWAY_REQUEST_TIMEOUT
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      cache: options?.next?.revalidate ? 'force-cache' : 'no-store',
      next: options?.next,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
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

async function loadHadithItems(bookId: string, start: number, limit: number) {
  const bookName = HADITH_BOOK_NAMES[bookId]
  if (!bookName) throw new Error('Unknown hadith book')

  const requested = Math.max(1, Math.min(limit, 50))
  const indexes = Array.from({ length: requested }, (_, index) => start + index)

  const results = await Promise.allSettled(
    indexes.map((record) =>
      fetchJson<any>(
        `${HADITH_API}/hadith/${encodeURIComponent(bookId)}/${record}?include=timings`
      )
    )
  )

  const items: LibraryItem[] = []

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return

    const data = result.value
    if (!data?.media?.available || !data?.media?.audio) return

    const record = Number(data.record || indexes[index])
    const text = textValue(data.arabic)

    items.push({
      id: `sunnah-${bookId}-${record}`,
      title: `${bookName} — الحديث ${record}`,
      subtitle: text || 'حديث صوتي',
      audioUrl: String(data.media.audio),
      authorName: 'تسجيل صوتي',
      section: 'sunnah',
      sourceName: 'Hadith.to',
      sourceUrl: String(data.links?.website || `https://hadith.to/${bookId}/${record}`),
      duration: Number(data.wordTimings?.duration) || undefined,
      downloadable: true,
      bookId,
      record,
      isSynthetic: Boolean(data.media?.synthetic || data.synthetic),
    })
  })

  return items.sort((a, b) => (a.record || 0) - (b.record || 0))
}

async function loadIslamHouseSunnahExtras(): Promise<LibraryItem[]> {
  if (!ISLAMHOUSE_API_KEY) return []

  const pageCount = 8
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
  const responses = await Promise.allSettled(
    pages.map((page) =>
      fetchJson<{ data?: unknown[] }>(
        `${ISLAMHOUSE_API}/${encodeURIComponent(ISLAMHOUSE_API_KEY)}/main/audios/ar/showall/${page}/50/json/`,
      )
    )
  )

  const items: LibraryItem[] = []

  for (const result of responses) {
    if (result.status !== 'fulfilled') continue
    const records = Array.isArray(result.value.data) ? result.value.data : []

    for (const raw of records as Array<Record<string, unknown>>) {
      const title = textValue(raw.title)
      const description = textValue(raw.description)
      const combined = normalizeSearch(`${title} ${description}`)

      if (!SUNNAH_SEARCH_TERMS.some((term) => combined.includes(normalizeSearch(term)))) continue

      const preparedBy = Array.isArray(raw.prepared_by) ? raw.prepared_by as Array<Record<string, unknown>> : []
      const author =
        textValue(preparedBy.find((entry) => entry.kind === 'author')?.title) ||
        textValue(preparedBy.find((entry) => entry.type === 'author')?.title) ||
        textValue(preparedBy[0]?.title) ||
        'دار الإسلام'

      const attachments = Array.isArray(raw.attachments) ? raw.attachments as Array<Record<string, unknown>> : []
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
      const items = await loadKhutbahs()
      return NextResponse.json({
        ok: true,
        section,
        items,
        total: items.length,
        scholars: ISLAMWAY_SCHOLARS.map((scholar) => ({
          id: scholar.id,
          name: scholar.name,
          sourceUrl: scholar.sourceUrl,
        })),
        source: {
          name: 'طريق الإسلام',
          url: ISLAMWAY_BASE,
          note: 'الملفات الصوتية تُستخدم من الروابط المنشورة في المصدر نفسه ولا تُعاد استضافتها داخل سميع.',
        },
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

    const start = Math.max(1, Number(searchParams.get('start') || '1'))
    const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || '50')))
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
      { status: 502 }
    )
  }
}
