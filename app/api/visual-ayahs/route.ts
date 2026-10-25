
import { NextRequest, NextResponse } from 'next/server'
import { VISUAL_SCENES } from '@/lib/samee3-visual-scenes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RECITERS: Record<string, string> = {
  husary: 'Husary_128kbps',
  afasy: 'Alafasy_128kbps',
  minshawy: 'Menshawi_16kbps',
  basit: 'Abdul_Basit_Murattal_64kbps',
  sudais: 'Abdurrahmaan_As-Sudais_192kbps',
  maher: 'MaherAlMuaiqly128kbps',
  hudhaify: 'Hudhaify_128kbps',
}

type WikiInfo = {
  mime?: string
  size?: number
  url?: string
  descriptionurl?: string
  extmetadata?: Record<string, { value?: string }>
}
type WikiPage = {
  imageinfo?: WikiInfo[]
  title?: string
}

function safeNum(
  input: string | null,
  min: number,
  max: number
): number | null {
  const value = Number(input)
  return input !== null &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max ? value : null
}

function failure(message: string, status = 502) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}

function flattenHTML(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .slice(0, 120)
}

async function stockClip(sceneId: string) {
  // استخدام Pexels اختياري.
  // في غياب المفتاح، تستخدم المنصة Wikimedia Commons تلقائيًا.
  const key = process.env.PEXELS_API_KEY
  const scene = VISUAL_SCENES.find(s => s.id === sceneId)

  if (!key || !scene) return null

  try {
    const url = new URL(
      'https://api.pexels.com/v1/videos/search'
    )
    url.searchParams.set('query', scene.search)
    url.searchParams.set('per_page', '12')
    url.searchParams.set('size', 'medium')

    const response = await fetch(url.toString(), {
      headers: { Authorization: key },
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) return null

    const data = await response.json() as {
      videos?: Array<{
        url: string
        user?: { name: string }
        video_files?: Array<{
          link: string
          file_type?: string
          file_size?: number
          width?: number
          height?: number
        }>
      }>
    }

    for (const video of data.videos || []) {
      const file = (video.video_files || [])
        .filter(f =>
          f.file_type === 'video/mp4' &&
          Number(f.width) >= 640 &&
          Number(f.file_size) < 16000000 &&
          Number(f.file_size) > 50000
        )
        .sort((a, b) =>
          Number(b.width) - Number(a.width)
        )[0]

      if (!file) continue

      const host = new URL(file.link).hostname
      if (
        host !== 'videos.pexels.com' &&
        host !== 'player.vimeo.com'
      ) continue

      return {
        url: file.link,
        mime: 'video/mp4',
        license: 'Pexels License',
        artist: video.user?.name || 'Pexels',
        title: scene.name,
        source: video.url,
        size: Number(file.file_size) || 0,
        provider: 'Pexels',
      }
    }
    return null
  } catch {
    return null
  }
}

async function wikiClip(sceneId: string) {
  const scene = VISUAL_SCENES.find(
    s => s.id === sceneId
  )
  if (!scene) {
    throw new Error('قالب غير موجود')
  }

  const api = new URL(
    'https://commons.wikimedia.org/w/api.php'
  )

  const params = {
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch:
      `filetype:video ${scene.search} filesize:<16000`,
    gsrlimit: '16',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
  }

  for (const [key, value] of Object.entries(params)) {
    api.searchParams.set(key, value)
  }

  const response = await fetch(api.toString(), {
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(16000),
  })

  if (!response.ok) {
    throw new Error(
      'مكتبة الفيديوهات غير متاحة حاليًا'
    )
  }

  const json = await response.json() as {
    query?: {
      pages?: Record<string, WikiPage>
    }
  }

  const matches = Object.values(
    json.query?.pages || {}
  )
    .flatMap(p =>
      (p.imageinfo || []).map(info => ({ p, info }))
    )
    .filter(({ info }) =>
      Boolean(
        info.url &&
        ['video/webm', 'video/mp4'].includes(
          info.mime || ''
        ) &&
        (info.size || 0) >= 50000 &&
        (info.size || 0) <= 16000000
      )
    )

  const candidate = matches.sort(
    (a, b) =>
      Number(b.info.mime === 'video/mp4') -
      Number(a.info.mime === 'video/mp4')
  )[0]

  if (!candidate) {
    throw new Error(
      'لم يُعثر على فيديو مناسب لهذا المشهد. يمكنك رفع مقطع من جهازك.'
    )
  }

  const info = candidate.info
  const url = new URL(info.url!)

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'upload.wikimedia.org'
  ) {
    throw new Error('رابط الخلفية غير آمن')
  }

  const license = flattenHTML(
    info.extmetadata?.LicenseShortName?.value ||
    'الترخيص موضح في المصدر'
  )

  const artist = flattenHTML(
    info.extmetadata?.Artist?.value ||
    'Wikimedia Commons'
  )

  return {
    url: url.toString(),
    mime: info.mime!,
    license,
    artist,
    title: candidate.p.title || scene.name,
    source: info.descriptionurl ||
      'https://commons.wikimedia.org/',
    size: info.size || 0,
    provider: 'Wikimedia Commons',
  }
}

async function findClip(sceneId: string) {
  return (await stockClip(sceneId)) ||
    wikiClip(sceneId)
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const kind = q.get('kind')

  try {
    if (kind === 'surahs') {
      const response = await fetch(
        'https://api.alquran.cloud/v1/surah',
        {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(12000),
        }
      )

      if (!response.ok) {
        throw Error('تعذّر تحميل فهرس السور')
      }

      const json = await response.json() as {
        data?: Array<{
          number: number
          name: string
          numberOfAyahs: number
        }>
      }

      if (
        !Array.isArray(json.data) ||
        json.data.length !== 114
      ) {
        throw Error('فهرس السور غير مكتمل')
      }

      return NextResponse.json({
        surahs: json.data.map(x => ({
          id: x.number,
          name: x.name,
          count: x.numberOfAyahs,
        })),
      })
    }

    if (kind === 'ayahs') {
      const surah = safeNum(q.get('surah'), 1, 114)
      const from = safeNum(q.get('from'), 1, 286)
      const to = safeNum(q.get('to'), 1, 286)

      if (
        !surah || !from || !to ||
        to < from ||
        to - from > 9
      ) {
        return failure(
          'اختر من آية إلى عشر آيات داخل السورة.',
          400
        )
      }

      const edition = q.get('translation') || 'none'
      if (![
        'none', 'en.sahih', 'fr.hamidullah',
      ].includes(edition)) {
        return failure('ترجمة غير متاحة', 400)
      }

      const base =
        'https://api.alquran.cloud/v1/surah/' +
        surah + '/'

      const read = async (id: string) => {
        const r = await fetch(base + id, {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(15000),
        })

        if (!r.ok) {
          throw Error(
            'تعذّر تحميل الآيات. حاول مرة أخرى.'
          )
        }

        const json = await r.json() as {
          data?: {
            ayahs?: Array<{
              numberInSurah: number
              text: string
            }>
          }
        }

        if (!Array.isArray(json.data?.ayahs)) {
          throw Error(
            'الاستجابة القرآنية غير مكتملة'
          )
        }
        return json.data!.ayahs!
      }

      const [arabic, translated] = await Promise.all([
        read('quran-uthmani'),
        edition === 'none'
          ? Promise.resolve([])
          : read(edition),
      ])

      const ayahs = arabic
        .filter(a =>
          a.numberInSurah >= from &&
          a.numberInSurah <= to
        )
        .map(a => ({
          number: a.numberInSurah,
          text: a.text,
          translation: translated.find(
            t => t.numberInSurah === a.numberInSurah
          )?.text || '',
        }))

      if (
        ayahs.length !== to - from + 1 ||
        ayahs.some((a, i) => a.number !== from + i)
      ) {
        return failure(
          'تعذّر التحقق من ترتيب الآيات'
        )
      }

      return NextResponse.json({ ayahs })
    }

    if (kind === 'audio') {
      const surah = safeNum(q.get('surah'), 1, 114)
      const ayah = safeNum(q.get('ayah'), 1, 286)
      const folder = RECITERS[q.get('reciter') || '']

      if (!surah || !ayah || !folder) {
        return failure('تلاوة غير صحيحة', 400)
      }

      const key =
        String(surah).padStart(3, '0') +
        String(ayah).padStart(3, '0')

      const remote =
        'https://everyayah.com/data/' +
        folder + '/' + key + '.mp3'

      const r = await fetch(remote, {
        next: { revalidate: 604800 },
        signal: AbortSignal.timeout(20000),
      })

      if (!r.ok) {
        throw Error(
          'التلاوة غير متاحة لهذا القارئ أو هذه الآية'
        )
      }

      if (
        Number(
          r.headers.get('content-length') || 0
        ) > 12000000
      ) {
        throw Error('التلاوة كبيرة جدًا')
      }

      return new NextResponse(r.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control':
            'public, max-age=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (kind === 'scene' || kind === 'clip') {
      const id = q.get('id') || ''

      if (!VISUAL_SCENES.some(s => s.id === id)) {
        return failure('مشهد غير موجود', 404)
      }

      const clip = await findClip(id)

      if (kind === 'scene') {
        return NextResponse.json(
          {
            clip: { ...clip, url: undefined },
            available: true,
          },
          {
            headers: {
              'Cache-Control':
                'public, max-age=3600',
            },
          }
        )
      }

      const remote = await fetch(clip.url, {
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      })

      if (!remote.ok) {
        throw Error('تعذّر تنزيل مقطع الطبيعة')
      }

      return new NextResponse(remote.body, {
        headers: {
          'Content-Type': clip.mime,
          'Cache-Control':
            'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    return failure('طلب غير معروف', 400)
  } catch (e) {
    return failure(
      e instanceof Error
        ? e.message
        : 'حدث خطأ في الخادم'
    )
  }
}
