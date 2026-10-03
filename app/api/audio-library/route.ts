import { NextResponse } from 'next/server'

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

type Book = {
  id: string
  name: string
  records: number
  synthetic?: boolean
  source: string
}

const SERMONS_API = 'https://sermons.islamic.network/api'
const HADITH_API = 'https://api.hadith.to/v1'
const ISLAMHOUSE_API = 'https://api.islamhouse.com/v1'
const ISLAMHOUSE_API_KEY = process.env.ISLAMHOUSE_API_KEY || ''

const KHUTBAH_FIRST_YEAR = 2015
const KHUTBAH_MAX_ITEMS = 1200
const KHUTBAH_REQUEST_TIMEOUT = 12000
const ISLAMHOUSE_KHUTBAH_PAGES = 12

const ARABIC_KHUTBAH_TERMS = [
  'خطبة',
  'الجمعة',
  'خطب الجمعة',
  'خطبة الجمعة',
  'خطيب',
  'المنبر',
  'عيد الفطر',
  'عيد الاضحى',
]

/*
 * Quran TV يعرض حاليًا 10 تسجيلات للرقية الشرعية مع تشغيل وتنزيل من المصدر.
 * الروابط تستخدم الملفات المنشورة في المصدر نفسه ولا تعيد استضافة الصوت داخل سميع.
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
  timeoutMs = KHUTBAH_REQUEST_TIMEOUT
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

async function loadKhutbahs() {
  const currentYear = new Date().getUTCFullYear()
  const years = Array.from(
    { length: Math.max(0, currentYear - KHUTBAH_FIRST_YEAR + 1) },
    (_, index) => currentYear - index
  )

  const urls = years.map(
    (year) => `${SERMONS_API}/uae-awqaf/${year}/friday.json`
  )

  const responses = await Promise.allSettled(
    urls.map((url) =>
      fetchJson<unknown>(url, { next: { revalidate: 3600 } })
    )
  )

  const networkItems: LibraryItem[] = []

  responses.forEach((result) => {
    if (result.status === 'fulfilled') {
      walkSermons(result.value, '', '', networkItems)
    }
  })

  const islamHouseItems = await loadIslamHouseKhutbahs()

  return unique([...networkItems, ...islamHouseItems])
    .filter((item) => item.audioUrl && item.section === 'khutbah')
    .sort((a, b) => sermonTimestamp(b) - sermonTimestamp(a))
    .slice(0, KHUTBAH_MAX_ITEMS)
}

async function loadIslamHouseKhutbahs(): Promise<LibraryItem[]> {
  if (!ISLAMHOUSE_API_KEY) return []

  const pages = Array.from(
    { length: ISLAMHOUSE_KHUTBAH_PAGES },
    (_, index) => index + 1
  )

  const responses = await Promise.allSettled(
    pages.map((page) =>
      fetchJson<{ data?: unknown[] }>(
        `${ISLAMHOUSE_API}/${encodeURIComponent(ISLAMHOUSE_API_KEY)}/main/audios/ar/showall/${page}/50/json/`,
        { next: { revalidate: 3600 } }
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

      if (
        !ARABIC_KHUTBAH_TERMS.some((term) =>
          combined.includes(normalizeSearch(term))
        )
      ) {
        continue
      }

      const preparedBy = Array.isArray(raw.prepared_by)
        ? (raw.prepared_by as Array<Record<string, unknown>>)
        : []

      const author =
        textValue(preparedBy.find((entry) => entry.kind === 'author')?.title) ||
        textValue(preparedBy.find((entry) => entry.type === 'author')?.title) ||
        textValue(preparedBy[0]?.title) ||
        'إسلام هاوس'

      const attachments = Array.isArray(raw.attachments)
        ? (raw.attachments as Array<Record<string, unknown>>)
        : []

      attachments.forEach((attachment, index) => {
        const url = textValue(attachment.url)
        if (!/\.(mp3|m4a|ogg|wav|aac|opus)(\?|$)/i.test(url)) return

        items.push({
          id: `islamhouse-khutbah-${String(raw.id ?? 'item')}-${String(attachment.order ?? index + 1)}`,
          title: textValue(attachment.description) || title || 'خطبة جمعة',
          subtitle: 'خطبة جمعة',
          audioUrl: url,
          authorName: author,
          section: 'khutbah',
          sourceName: 'IslamHouse',
          sourceUrl:
            textValue(raw.api_url) ||
            'https://islamhouse.com/ar/category/144409/audios/',
          duration: Number(attachment.duration) || undefined,
          downloadable: true,
          isSynthetic: false,
        })
      })
    }
  }

  return unique(items)
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
        sources: {
          primary: {
            name: 'Sermons by Islamic Network — أوقاف الإمارات',
            url: 'https://sermons.islamic.network/uae-awqaf/',
            coverage: '2015–الحاضر',
          },
          secondary: ISLAMHOUSE_API_KEY
            ? {
                name: 'IslamHouse',
                url: 'https://islamhouse.com/ar/category/144409/audios/',
                enabled: true,
              }
            : {
                name: 'IslamHouse',
                url: 'https://islamhouse.com/ar/category/144409/audios/',
                enabled: false,
                reason: 'يتطلب مفتاح API خاصًا بالحساب.',
              },
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
