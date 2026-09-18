import { NextRequest, NextResponse } from 'next/server'
import { Mushaf } from '@quran.ws/text'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RIWAYA_URLS: Record<string, string> = {
  hafs:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/hafs.json',
  warsh:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/warsh.json',
  qalun:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/qalun.json',
  douri:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/douri.json',
  sousi:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/sousi.json',
  shubah:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/shuba.json',
  bazzi:
    'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/bazzi.json',
}

const SURAH_NAMES_AR = [
  'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام',
  'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد',
  'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه',
  'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء',
  'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب',
  'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى',
  'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات',
  'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة',
  'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون',
  'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
  'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات',
  'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق',
  'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس',
  'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة',
  'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش',
  'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس',
]

type MushafLike = {
  page: (pageNumber: number) => any
}

const cache = new Map<string, MushafLike>()

async function loadServerMushaf(riwayaId: string): Promise<MushafLike> {
  const cached = cache.get(riwayaId)
  if (cached) return cached

  if (riwayaId === 'hafs') {
    const mushaf = (await Mushaf.hafs()) as MushafLike
    cache.set(riwayaId, mushaf)
    return mushaf
  }

  const url = RIWAYA_URLS[riwayaId]
  if (!url) throw new Error('الرواية غير معروفة')

  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error('تعذر تحميل حزمة الرواية')

  const json = await response.json()
  const mushaf = Mushaf.fromJson(json) as MushafLike
  cache.set(riwayaId, mushaf)
  return mushaf
}

function numberFromKey(key: unknown, fallbackSurah: number, fallbackAyah: number) {
  if (typeof key !== 'string') {
    return { surahNumber: fallbackSurah, ayahNumber: fallbackAyah }
  }

  const [s, a] = key.split(':').map(Number)
  return {
    surahNumber: Number.isInteger(s) && s > 0 ? s : fallbackSurah,
    ayahNumber: Number.isInteger(a) && a > 0 ? a : fallbackAyah,
  }
}

function serializePage(mushaf: MushafLike, pageNumber: number) {
  const page = mushaf.page(pageNumber)
  const sourceAyahs = Array.isArray(page?.ayahs) ? page.ayahs : []

  return sourceAyahs.map((ayah: any, index: number) => {
    const key = typeof ayah?.key === 'string' ? ayah.key : ''
    const rawSurah = Number(ayah?.surah?.number ?? ayah?.surahNumber ?? 0)
    const rawAyah = Number(ayah?.numberInSurah ?? ayah?.ayahNumber ?? 0)
    const { surahNumber, ayahNumber } = numberFromKey(
      key,
      rawSurah || 1,
      rawAyah || index + 1
    )

    const text =
      typeof ayah?.text === 'string'
        ? ayah.text
        : typeof ayah?.render === 'function'
          ? String(
              ayah.render({
                marks: true,
                ayahMarks: false,
              }) || ''
            )
          : ''

    return {
      number: surahNumber * 1000 + ayahNumber,
      key: key || `${surahNumber}:${ayahNumber}`,
      text,
      numberInSurah: ayahNumber,
      juz: Number(ayah?.juz ?? 0),
      page: pageNumber,
      surah: {
        number: surahNumber,
        name: SURAH_NAMES_AR[surahNumber - 1] || `السورة ${surahNumber}`,
        englishName: '',
      },
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const riwaya = request.nextUrl.searchParams.get('riwaya') || 'hafs'
    const page = Number(request.nextUrl.searchParams.get('page') || 1)

    if (!Object.prototype.hasOwnProperty.call(RIWAYA_URLS, riwaya)) {
      return NextResponse.json(
        { error: 'الرواية غير مدعومة' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(page) || page < 1 || page > 604) {
      return NextResponse.json(
        { error: 'رقم الصفحة غير صحيح' },
        { status: 400 }
      )
    }

    const mushaf = await loadServerMushaf(riwaya)
    return NextResponse.json(
      { riwaya, page, ayahs: serializePage(mushaf, page) },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=3600',
        },
      }
    )
  } catch (error) {
    console.error('Quran API route error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل بيانات المصحف حاليًا' },
      { status: 500 }
    )
  }
}
