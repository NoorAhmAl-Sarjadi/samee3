import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type LibrarySection = 'ruqyah' | 'khutbah' | 'sunnah'

type LibraryAudio = {
  id: string
  title: string
  subtitle: string
  audioUrl: string
  sourceName: string
  sourceUrl: string
  authorName?: string
  section: LibrarySection
  downloadable: boolean
  duration?: number
}

const RUQYAH_SOURCE_URL = 'https://islamicapi.com/doc/ruqyah/'

const RUQYAH_ITEMS: LibraryAudio[] = [
  {
    id: 'ruqyah-brief',
    title: 'الرُّقية الشرعية المختصرة',
    subtitle: 'برنامج رقية شرعية كامل — ملف MP3',
    audioUrl:
      'https://islamicapi.com/audio/ruqyah/total_brief_ruqyah.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-medium',
    title: 'الرُّقية الشرعية المتوسطة',
    subtitle: 'برنامج رقية شرعية كامل — ملف MP3',
    audioUrl:
      'https://islamicapi.com/audio/ruqyah/total_med_ruqyah.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-long',
    title: 'الرُّقية الشرعية المطولة',
    subtitle: 'برنامج رقية شرعية كامل — ملف MP3',
    audioUrl:
      'https://islamicapi.com/audio/ruqyah/total_long_ruqyah.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-fatiha',
    title: 'سورة الفاتحة — رقية',
    subtitle: 'تسجيل صوتي من ملفات الرقية',
    audioUrl: 'https://islamicapi.com/audio/ruqyah/1.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-baqarah',
    title: 'سورة البقرة — رقية',
    subtitle: 'تسجيل صوتي من ملفات الرقية',
    audioUrl: 'https://islamicapi.com/audio/ruqyah/2.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-ayatul-kursi',
    title: 'آية الكرسي',
    subtitle: 'تسجيل صوتي من ملفات الرقية',
    audioUrl:
      'https://islamicapi.com/audio/ruqyah/Ayatul%20Kursi.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-ikhlas',
    title: 'سورة الإخلاص — رقية',
    subtitle: 'تسجيل صوتي من ملفات الرقية',
    audioUrl: 'https://islamicapi.com/audio/ruqyah/112.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-falaq',
    title: 'سورة الفلق — رقية',
    subtitle: 'تسجيل صوتي من ملفات الرقية',
    audioUrl: 'https://islamicapi.com/audio/ruqyah/113.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
  {
    id: 'ruqyah-nas',
    title: 'سورة الناس — رقية',
    subtitle: 'تسجيل صوتي من ملفات الرقية',
    audioUrl: 'https://islamicapi.com/audio/ruqyah/114.mp3',
    sourceName: 'IslamicAPI',
    sourceUrl: RUQYAH_SOURCE_URL,
    authorName: 'IslamicAPI',
    section: 'ruqyah',
    downloadable: true,
  },
]

const KHUTBAH_FALLBACK: LibraryAudio[] = [
  {
    id: 'khutbah-2026-08-21',
    title: 'مالك بن أنس',
    subtitle: 'خطبة جمعة — 21 أغسطس 2026',
    audioUrl:
      'https://cdn.islamic.network/sermons/uae-awqaf/mp3/2026-08-21-ar-Malik_bin_Anas.mp3',
    sourceName: 'Sermons by Islamic Network',
    sourceUrl:
      'https://sermons.islamic.network/uae-awqaf/2026/08/21-malik-bin-anas/',
    authorName: 'أوقاف الإمارات',
    section: 'khutbah',
    downloadable: true,
  },
  {
    id: 'khutbah-2026-07-31',
    title: 'التواضع من أجلِّ أعمال العبادة',
    subtitle: 'خطبة جمعة — 31 يوليو 2026',
    audioUrl:
      'https://cdn.islamic.network/sermons/uae-awqaf/mp3/2026-07-31-ar-Humility_Is_Among_the_Finest_Acts_of_Worship.mp3',
    sourceName: 'Sermons by Islamic Network',
    sourceUrl:
      'https://sermons.islamic.network/uae-awqaf/2026/07/31-humility-is-among-the-finest-acts-of-worship/',
    authorName: 'أوقاف الإمارات',
    section: 'khutbah',
    downloadable: true,
  },
]

const SUNNAH_SOURCE_PAGE =
  'https://alfiqh.net/%D9%82%D8%B1%D8%A7%D8%A1%D8%A9-%D8%B5%D9%88%D8%AA%D9%8A%D8%A9-%D8%B1%D9%8A%D8%A7%D8%B6-%D8%A7%D9%84%D8%B5%D8%A7%D9%84%D8%AD%D9%8A%D9%86-%D8%AD%D9%85%D8%AF-%D8%A7%D9%84%D8%AF%D8%B1%D9%8A%D9%87%D9%85/'

const ARCHIVE_IDENTIFIER = 'Riad_Alsalheen__AlDuraihim'

function uniqueItems(items: LibraryAudio[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = `${item.id}|${item.audioUrl}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function decodeFileName(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function prettifyFileName(value: string) {
  const cleaned = decodeFileName(value)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^\d{1,4}[-_ ]*/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'مادة صوتية'
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

function stringFromObject(
  value: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const candidate = value[key]

    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

function dateFromObject(value: Record<string, unknown>) {
  const candidate = stringFromObject(value, [
    'date',
    'published_at',
    'publishedAt',
    'publication_date',
    'published',
  ])

  if (candidate) {
    const match = candidate.match(/\d{4}-\d{2}-\d{2}/)

    if (match) {
      return match[0]
    }
  }

  return ''
}

function extractMp3Strings(value: unknown): string[] {
  if (typeof value === 'string') {
    return /\.mp3(?:[?#].*)?$/i.test(value) ? [value] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractMp3Strings(item))
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) =>
      extractMp3Strings(item)
    )
  }

  return []
}

type SermonContext = {
  title?: string
  pageUrl?: string
  date?: string
}

function walkSermonJson(
  node: unknown,
  context: SermonContext,
  result: LibraryAudio[]
) {
  if (Array.isArray(node)) {
    node.forEach((item) => {
      walkSermonJson(item, context, result)
    })

    return
  }

  if (!node || typeof node !== 'object') {
    return
  }

  const object = node as Record<string, unknown>

  const title =
    stringFromObject(object, [
      'title',
      'name',
      'subject',
      'sermon_title',
      'sermonTitle',
      'label',
    ]) || context.title

  const pageUrl =
    stringFromObject(object, [
      'url',
      'page_url',
      'pageUrl',
      'href',
      'link',
    ]) || context.pageUrl

  const date = dateFromObject(object) || context.date

  const mp3s = extractMp3Strings(object)

  if (mp3s.length > 0) {
    const preferred =
      mp3s.find((url) => /[-_]ar[-_]/i.test(url)) || mp3s[0]

    const filename = decodeFileName(
      preferred.split('/').pop()?.split('?')[0] || ''
    )

    const fallbackTitle = prettifyFileName(filename)

    result.push({
      id: `khutbah-${preferred}`,
      title: title || fallbackTitle,
      subtitle: date
        ? `خطبة جمعة — ${date}`
        : 'خطبة صوتية كاملة',
      audioUrl: preferred,
      sourceName: 'Sermons by Islamic Network',
      sourceUrl:
        pageUrl ||
        'https://sermons.islamic.network/uae-awqaf/',
      authorName: 'أوقاف الإمارات',
      section: 'khutbah',
      downloadable: true,
    })
  }

  for (const [key, child] of Object.entries(object)) {
    if (
      key === 'audio' ||
      key === 'audio_url' ||
      key === 'audioUrl' ||
      key === 'mp3'
    ) {
      continue
    }

    walkSermonJson(
      child,
      {
        title,
        pageUrl,
        date,
      },
      result
    )
  }
}

async function loadKhutbahs() {
  const urls = [
    'https://sermons.islamic.network/api/uae-awqaf/2026/friday.json',
    'https://sermons.islamic.network/api/uae-awqaf/2025/friday.json',
  ]

  const settled = await Promise.allSettled(
    urls.map((url) => fetchJson(url))
  )

  const parsed: LibraryAudio[] = []

  for (const item of settled) {
    if (item.status !== 'fulfilled') {
      continue
    }

    walkSermonJson(item.value, {}, parsed)
  }

  const merged = uniqueItems([
    ...parsed,
    ...KHUTBAH_FALLBACK,
  ])

  return merged.slice(0, 80)
}

async function loadSunnah() {
  try {
    const metadata = (await fetchJson(
      `https://archive.org/metadata/${ARCHIVE_IDENTIFIER}`
    )) as {
      files?: Array<{
        name?: string
        format?: string
        size?: string
      }>
    }

    const files = Array.isArray(metadata.files)
      ? metadata.files
          .filter((file) => {
            const name = String(file?.name || '')
            return /\.mp3$/i.test(name)
          })
          .sort((a, b) =>
            String(a.name || '').localeCompare(
              String(b.name || ''),
              undefined,
              {
                numeric: true,
                sensitivity: 'base',
              }
            )
          )
      : []

    return files.slice(0, 120).map((file, index) => {
      const rawName = String(file.name || `${index + 1}.mp3`)
      const filename = rawName.split('/').pop() || rawName

      return {
        id: `sunnah-riyad-${index + 1}`,
        title: `رياض الصالحين — الدرس ${index + 1}`,
        subtitle: 'قراءة صوتية لكتاب رياض الصالحين',
        audioUrl:
          `https://archive.org/download/${ARCHIVE_IDENTIFIER}/${encodeURIComponent(
            filename
          )}`,
        sourceName: 'Archive.org',
        sourceUrl: SUNNAH_SOURCE_PAGE,
        authorName: 'حمد الدريهم',
        section: 'sunnah' as const,
        downloadable: true,
      }
    })
  } catch (error) {
    console.error('Sunnah source error:', error)

    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const section = searchParams.get('section') as
    | LibrarySection
    | null

  if (!section || !['ruqyah', 'khutbah', 'sunnah'].includes(section)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'section must be one of: ruqyah, khutbah, sunnah',
      },
      { status: 400 }
    )
  }

  try {
    let items: LibraryAudio[] = []

    if (section === 'ruqyah') {
      items = RUQYAH_ITEMS
    }

    if (section === 'khutbah') {
      items = await loadKhutbahs()
    }

    if (section === 'sunnah') {
      items = await loadSunnah()
    }

    return NextResponse.json(
      {
        ok: true,
        section,
        sourceType: 'on-demand',
        items: uniqueItems(items),
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error('Audio library route error:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'تعذر تحميل المصدر الصوتي حاليًا.',
      },
      { status: 502 }
    )
  }
}