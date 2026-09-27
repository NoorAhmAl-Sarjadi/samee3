import { NextRequest, NextResponse } from 'next/server'
import { HUMAN_AUDIO_SOURCES } from '@/lib/hadith-human-audio'

type Track = {
  id: string
  title: string
  url: string
  label: string
  sourceUrl: string
  isIntroduction?: boolean
}

function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&nbsp;/gi, ' ')
}

function resolveUrl(value: string, baseUrl: string) {
  const decoded = decodeHtml(value.trim())
  if (!decoded) return ''
  try {
    return new URL(decoded, baseUrl).toString()
  } catch {
    return ''
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^A-Za-z0-9\u0600-\u06FF]+/g, ' ')
    .trim()
}

function extensionIsAudio(url: string) {
  try {
    const pathname = new URL(url).pathname
    return /\.(mp3|m4a|aac|ogg|oga|wav|webm)$/i.test(pathname)
  } catch {
    return false
  }
}

function inferOrganization(titles: string[]): 'attachments' | 'books' | 'chapters' {
  const normalized = titles.map(normalize)
  if (normalized.some((x) => x.startsWith('كتاب ') || x.startsWith('مقدمه ') || x.startsWith('المقدمه ') || x.startsWith('ابواب '))) {
    return 'books'
  }
  if (normalized.some((x) => x.includes('باب '))) return 'chapters'
  return 'attachments'
}

function fallbackTitle(url: string, index: number) {
  try {
    const parsed = new URL(url)
    const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '')
    return filename.replace(/\.(mp3|m4a|aac|ogg|oga|wav|webm)$/i, '').replace(/[_-]+/g, ' ') || `تسجيل ${index + 1}`
  } catch {
    return `تسجيل ${index + 1}`
  }
}

function pushTrack(tracks: Track[], seen: Set<string>, url: string, title: string, sourceUrl: string) {
  if (!url || !extensionIsAudio(url) || seen.has(url)) return

  const cleanTitle = cleanText(title) || fallbackTitle(url, tracks.length)
  seen.add(url)
  tracks.push({
    id: `source:${tracks.length + 1}`,
    title: cleanTitle,
    url,
    label: 'تسجيل بشري من المصدر الأصلي',
    sourceUrl,
    isIntroduction: /مقدم/i.test(cleanTitle),
  })
}

function parseAudioSources(html: string, sourceUrl: string): Track[] {
  const tracks: Track[] = []
  const seen = new Set<string>()

  // روابط MP3/M4A وغيرها داخل <a href="...">.
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let anchorMatch: RegExpExecArray | null
  while ((anchorMatch = anchorRe.exec(html)) !== null) {
    const url = resolveUrl(anchorMatch[1], sourceUrl)
    if (!extensionIsAudio(url)) continue
    pushTrack(tracks, seen, url, anchorMatch[2], sourceUrl)
  }

  // مصادر الصوت داخل <audio src>, <source src>, والخصائص المؤجلة مثل data-src.
  const mediaRe = /<(?:audio|source)\b[^>]*?(?:src|data-src|data-audio|data-url)=["']([^"']+)["'][^>]*>/gi
  let mediaMatch: RegExpExecArray | null
  while ((mediaMatch = mediaRe.exec(html)) !== null) {
    const url = resolveUrl(mediaMatch[1], sourceUrl)
    if (!extensionIsAudio(url)) continue

    const index = mediaMatch.index || 0
    const before = html.slice(Math.max(0, index - 900), index)
    const after = html.slice(index, Math.min(html.length, index + 900))
    const nearby = `${before} ${after}`
    const textMatch = nearby.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<span[^>]*>([\s\S]*?)<\/span>|<p[^>]*>([\s\S]*?)<\/p>/i)
    const title = textMatch ? (textMatch[1] || textMatch[2] || textMatch[3] || '') : ''
    pushTrack(tracks, seen, url, title, sourceUrl)
  }

  return tracks
}

export async function GET(request: NextRequest) {
  const bookId = request.nextUrl.searchParams.get('book') || ''
  const source = HUMAN_AUDIO_SOURCES[bookId]

  if (!source) {
    return NextResponse.json(
      { tracks: [], error: 'لا يوجد مصدر صوتي موثق لهذا الكتاب.' },
      { status: 404 },
    )
  }

  try {
    const response = await fetch(source.sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SAMEE3/1.0; +https://samee3.vercel.app)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.8',
      },
      cache: 'no-store',
      redirect: 'follow',
    })

    const html = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const tracks = parseAudioSources(html, source.sourceUrl)
    const organization = inferOrganization(tracks.map((item) => item.title))

    return NextResponse.json(
      {
        bookId,
        label: source.label,
        sourceUrl: source.sourceUrl,
        kind: 'book',
        organization,
        tracks,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    )
  } catch (error) {
    console.error('Hadith audio catalog error:', error)
    return NextResponse.json(
      {
        bookId,
        label: source.label,
        sourceUrl: source.sourceUrl,
        kind: 'book',
        organization: 'attachments',
        tracks: [],
        error: 'تعذر تحميل فهرس التسجيلات من المصدر الآن.',
      },
      { status: 502 },
    )
  }
}