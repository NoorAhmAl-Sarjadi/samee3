import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AUDIO_FOLDERS: Record<string, string> = {
  husary: 'Husary_128kbps',
  afasy: 'Alafasy_128kbps',
  minshawy: 'Minshawy_Murattal_128kbps',
  basit: 'Abdul_Basit_Murattal_64kbps',
  maher: 'MaherAlMuaiqly128kbps',
  sudais: 'Abdurrahmaan_As-Sudais_192kbps',
}

type RemoteSurah = { number: number; name: string; numberOfAyahs: number }
type RemoteAyah = { numberInSurah: number; text: string }

const problem = (message: string, status = 502) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })

function numberInRange(value: string | null, min: number, max: number): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

async function quranAPI<T>(path: string): Promise<T> {
  const response = await fetch('https://api.alquran.cloud/v1/' + path, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('تعذّر الاتصال بخدمة الآيات القرآنية.')
  return response.json() as Promise<T>
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const kind = params.get('kind')

  try {
    if (kind === 'surahs') {
      const body = await quranAPI<{ data?: RemoteSurah[] }>('surah')
      if (!body.data || body.data.length !== 114) throw new Error('فهرس السور غير مكتمل.')
      return NextResponse.json({
        surahs: body.data.map(s => ({ id: s.number, name: s.name, count: s.numberOfAyahs })),
      })
    }

    if (kind === 'verses') {
      const surah = numberInRange(params.get('surah'), 1, 114)
      if (!surah) return problem('رقم السورة غير صحيح.', 400)
      const body = await quranAPI<{ data?: { ayahs?: RemoteAyah[] } }>(`surah/${surah}/quran-uthmani`)
      const list = body.data?.ayahs
      if (!list?.length || list.some((a, index) => a.numberInSurah !== index + 1)) {
        throw new Error('تعذّر التحقق من ترتيب الآيات.')
      }
      return NextResponse.json({
        ayahs: list.map(ayah => ({ number: ayah.numberInSurah, text: ayah.text })),
      })
    }

    if (kind === 'audio') {
      const surah = numberInRange(params.get('surah'), 1, 114)
      const ayah = numberInRange(params.get('ayah'), 1, 286)
      const folder = AUDIO_FOLDERS[params.get('reciter') ?? '']
      if (!surah || !ayah || !folder) return problem('اختيار الآية أو القارئ غير صحيح.', 400)
      const filename = `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`
      const response = await fetch(`https://everyayah.com/data/${folder}/${filename}`, {
        next: { revalidate: 604800 },
        signal: AbortSignal.timeout(22000),
      })
      if (!response.ok || !response.body) return problem('التلاوة غير متاحة. اختر قارئًا آخر.')
      const size = Number(response.headers.get('content-length') || '0')
      if (size > 12_000_000) return problem('ملف التلاوة أكبر من الحجم المسموح.', 413)
      return new Response(response.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (kind === 'demo') {
      // CC0 test asset from MDN, not a permanent hosted background library.
      const range = request.headers.get('range')
      const response = await fetch(
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        {
          headers: range ? { Range: range } : {},
          signal: AbortSignal.timeout(18000),
        },
      )
      if (!response.ok || !response.body) return problem('فشل تحميل خلفية التجربة.')
      const headers = new Headers({
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      })
      for (const field of ['content-range', 'content-length']) {
        const value = response.headers.get(field)
        if (value) headers.set(field, value)
      }
      return new Response(response.body, { status: response.status, headers })
    }

    return problem('نوع الطلب غير معروف.', 400)
  } catch (error) {
    return problem(error instanceof Error ? error.message : 'تعذّر تنفيذ الطلب.')
  }
}

export async function HEAD(request: NextRequest) {
  if (request.nextUrl.searchParams.get('kind') === 'demo') {
    return new Response(null, { headers: { 'Content-Type': 'video/mp4' } })
  }
  return new Response(null, { status: 404 })
}
