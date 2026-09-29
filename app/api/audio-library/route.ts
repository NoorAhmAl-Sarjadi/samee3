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
  sourceUrl: string
  duration?: number
  downloadable: boolean
  bookId?: string
  record?: number
}

type Book = {
  id: string
  name: string
  records: number
  synthetic?: boolean
}

const SERMONS_API = 'https://sermons.islamic.network/api'
const HADITH_API = 'https://api.hadith.to/v1'

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
}

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
    return value.match(/https?:\/\/[^\s"']+\.mp3(?:\?[^\s"']*)?/gi) || []
  }
  if (Array.isArray(value)) return value.flatMap(extractStrings)
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(extractStrings)
  }
  return []
}

function walkSermons(node: unknown, currentTitle = '', currentUrl = '', out: LibraryItem[] = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => walkSermons(child, currentTitle, currentUrl, out))
    return out
  }

  if (!node || typeof node !== 'object') return out

  const object = node as Record<string, unknown>
  const titleKeys = ['title', 'name', 'subject', 'sermon_title', 'sermonTitle']
  const urlKeys = ['url', 'page_url', 'pageUrl', 'href', 'link']

  const title =
    titleKeys
      .map((key) => object[key])
      .find((value) => typeof value === 'string' && value.trim())?.toString().trim() ||
    currentTitle

  const pageUrl =
    urlKeys
      .map((key) => object[key])
      .find((value) => typeof value === 'string' && value.startsWith('http'))?.toString() ||
    currentUrl

  for (const mp3 of extractStrings(object)) {
    const decoded = mp3.replace(/\\u0026/g, '&')
    const filename = decodeURIComponent(decoded.split('/').pop()?.split('?')[0] || '')
    const fallback = filename
      .replace(/\.(mp3)$/i, '')
      .replace(/^\d{4}-\d{2}-\d{2}-ar-/, '')
      .replace(/[_-]+/g, ' ')
      .trim()

    out.push({
      id: `khutbah-${decoded}`,
      title: title || fallback || 'خطبة جمعة',
      subtitle: 'خطبة جمعة',
      audioUrl: decoded,
      authorName: 'أوقاف الإمارات',
      section: 'khutbah',
      sourceUrl: pageUrl || 'https://sermons.islamic.network/uae-awqaf/',
      downloadable: true,
    })
  }

  for (const [key, value] of Object.entries(object)) {
    if (['mp3', 'audio', 'audio_url', 'audioUrl'].includes(key)) continue
    walkSermons(value, title, pageUrl, out)
  }

  return out
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

async function loadKhutbahs() {
  const urls: string[] = []
  for (let year = 2026; year >= 2015; year -= 1) {
    urls.push(`${SERMONS_API}/uae-awqaf/${year}/friday.json`)
  }

  const responses = await Promise.allSettled(urls.map((url) => fetchJson<unknown>(url)))
  const items: LibraryItem[] = []

  responses.forEach((result) => {
    if (result.status === 'fulfilled') walkSermons(result.value, '', '', items)
  })

  return unique(
    items.filter((item) => /\/ar[-_]/i.test(item.audioUrl))
  ).slice(0, 500)
}

async function loadHadithBooks(): Promise<Book[]> {
  const result = await fetchJson<{ collections?: Book[] }>(`${HADITH_API}/collections`)
  const collections = Array.isArray(result.collections) ? result.collections : []

  return collections
    .filter((book) => !book.synthetic && HADITH_BOOK_NAMES[book.id])
    .map((book) => ({
      ...book,
      name: HADITH_BOOK_NAMES[book.id] || book.name,
    }))
}

async function loadHadithItems(bookId: string, start: number, limit: number) {
  const bookName = HADITH_BOOK_NAMES[bookId]
  if (!bookName) throw new Error('Unknown hadith book')

  const indexes = Array.from(
    { length: Math.max(1, Math.min(limit, 30)) },
    (_, i) => start + i
  )

  const results = await Promise.allSettled(
    indexes.map((record) =>
      fetchJson<any>(`${HADITH_API}/hadith/${encodeURIComponent(bookId)}/${record}`)
    )
  )

  const items: LibraryItem[] = []

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return

    const data = result.value
    if (!data?.media?.available || !data?.media?.audio) return

    const record = Number(data.record || indexes[index])
    const text = String(data.arabic || '').trim()

    items.push({
      id: `sunnah-${bookId}-${record}`,
      title: `${bookName} — الحديث ${record}`,
      subtitle: text || 'حديث صوتي',
      audioUrl: String(data.media.audio),
      authorName: 'رواية صوتية',
      section: 'sunnah',
      sourceUrl: String(data.links?.website || 'https://hadith.to/'),
      duration: Number(data.wordTimings?.duration) || undefined,
      downloadable: true,
      bookId,
      record,
    })
  })

  return items.sort((a, b) => (a.record || 0) - (b.record || 0))
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
      })
    }

    if (section === 'khutbah') {
      const items = await loadKhutbahs()
      return NextResponse.json({ ok: true, section, items })
    }

    const bookId = searchParams.get('book')

    if (!bookId) {
      const books = await loadHadithBooks()
      return NextResponse.json({ ok: true, section, books })
    }

    const start = Math.max(1, Number(searchParams.get('start') || '1'))
    const limit = Math.max(1, Math.min(30, Number(searchParams.get('limit') || '20')))
    const items = await loadHadithItems(bookId, start, limit)

    return NextResponse.json({
      ok: true,
      section,
      bookId,
      items,
    })
  } catch (error) {
    console.error('audio-library error', error)
    return NextResponse.json(
      { ok: false, error: 'تعذر تحميل المكتبة الصوتية حاليًا.' },
      { status: 502 }
    )
  }
}