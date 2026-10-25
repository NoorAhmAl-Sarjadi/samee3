import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const QARI: Record<string, string> = {
  husary: 'Husary_128kbps',
  afasy: 'Alafasy_128kbps',
  minshawy: 'Minshawy_Murattal_128kbps',
  basit: 'Abdul_Basit_Murattal_64kbps',
  maher: 'MaherAlMuaiqly128kbps',
  sudais: 'Abdurrahmaan_As-Sudais_192kbps',
}

const bad = (message: string, status = 400) =>
  NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  )

function num(
  value: string | null,
  min: number,
  max: number
): number | null {
  if (!value || !/^\d+$/.test(value)) return null

  const number = Number(value)

  return number >= min && number <= max
    ? number
    : null
}

type RemoteAyah = {
  numberInSurah: number
  text: string
}

async function getRemote<T>(
  url: string,
  timeout = 12000
): Promise<T> {
  const response = await fetch(url, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(timeout),
  })

  if (!response.ok) {
    throw Error(
      'الخدمة القرآنية غير متاحة حاليًا، حاول مجددًا.'
    )
  }

  return response.json() as Promise<T>
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const kind = q.get('kind')

  try {
    // فيديو زهور مجاني تجريبي من MDN
    if (kind === 'demo') {
      const range = req.headers.get('range')

      const remoteURL =
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

      const response = await fetch(remoteURL, {
        headers: range ? { Range: range } : {},
        cache: 'force-cache',
        signal: AbortSignal.timeout(18000),
      })

      if (!response.ok || !response.body) {
        return bad('تعذر تحميل فيديو الزهور التجريبي', 502)
      }

      const headers = new Headers({
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      })

      for (const name of [
        'content-length',
        'content-range',
      ]) {
        const value = response.headers.get(name)

        if (value) headers.set(name, value)
      }

      return new Response(response.body, {
        status: response.status,
        headers,
      })
    }

    // تحميل كل السور
    if (kind === 'surahs') {
      const json = await getRemote<{
        data?: Array<{
          number: number
          name: string
          numberOfAyahs: number
        }>
      }>('https://api.alquran.cloud/v1/surah')

      if (json.data?.length !== 114) {
        throw Error('فهرس السور غير مكتمل')
      }

      return NextResponse.json({
        surahs: json.data.map(s => ({
          id: s.number,
          name: s.name,
          count: s.numberOfAyahs,
        })),
      })
    }

    // تحميل السورة كاملة بالنص العثماني
    if (kind === 'verses') {
      const surah = num(q.get('surah'), 1, 114)

      if (!surah) return bad('السورة غير صحيحة')

      const json = await getRemote<{
        data?: { ayahs?: RemoteAyah[] }
      }>(
        `https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`
      )

      if (
        !Array.isArray(json.data?.ayahs) ||
        !json.data.ayahs.length
      ) {
        throw Error('تعذّر تحميل نص السورة')
      }

      const ayahs = json.data.ayahs.map(a => ({
        number: a.numberInSurah,
        text: a.text,
      }))

      if (
        ayahs.some((a, i) => a.number !== i + 1)
      ) {
        throw Error('ترتيب الآيات غير صالح')
      }

      return NextResponse.json({ ayahs })
    }

    // تحميل صوت آية محددة للقارئ
    if (kind === 'audio') {
      const surah = num(q.get('surah'), 1, 114)
      const ayah = num(q.get('ayah'), 1, 286)
      const folder = QARI[q.get('reciter') || '']

      if (!surah || !ayah || !folder) {
        return bad(
          'اختيار القارئ أو الآية غير صحيح'
        )
      }

      const file =
        String(surah).padStart(3, '0') +
        String(ayah).padStart(3, '0') +
        '.mp3'

      const remote = await fetch(
        `https://everyayah.com/data/${folder}/${file}`,
        {
          next: { revalidate: 604800 },
          signal: AbortSignal.timeout(20000),
        }
      )

      if (!remote.ok || !remote.body) {
        return bad(
          'التلاوة غير متاحة لهذا القارئ؛ جرّب قارئًا آخر',
          502
        )
      }

      const size = Number(
        remote.headers.get('content-length') || 0
      )

      if (size > 12_000_000) {
        return bad(
          'ملف التلاوة أكبر من الحجم المسموح',
          413
        )
      }

      return new Response(remote.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    return bad('طلب غير معروف', 404)
  } catch (error) {
    return bad(
      error instanceof Error
        ? error.message
        : 'فشل الاتصال بالمصدر القرآني',
      502
    )
  }
}

export async function HEAD(req: NextRequest) {
  if (
    req.nextUrl.searchParams.get('kind') !== 'demo'
  ) {
    return new Response(null, { status: 404 })
  }

  return new Response(null, {
    status: 200,
    headers: { 'Content-Type': 'video/mp4' },
  })
}
