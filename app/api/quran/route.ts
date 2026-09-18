import { NextRequest, NextResponse } from 'next/server'
import { Mushaf } from '@quran.ws/text'

export const runtime = 'nodejs'

type SupportedRiwaya =
  | 'hafs'
  | 'shubah'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'sousi'
  | 'bazzi'

const SURAH_NAMES_AR = [
  'الفاتحة',
  'البقرة',
  'آل عمران',
  'النساء',
  'المائدة',
  'الأنعام',
  'الأعراف',
  'الأنفال',
  'التوبة',
  'يونس',
  'هود',
  'يوسف',
  'الرعد',
  'إبراهيم',
  'الحجر',
  'النحل',
  'الإسراء',
  'الكهف',
  'مريم',
  'طه',
  'الأنبياء',
  'الحج',
  'المؤمنون',
  'النور',
  'الفرقان',
  'الشعراء',
  'النمل',
  'القصص',
  'العنكبوت',
  'الروم',
  'لقمان',
  'السجدة',
  'الأحزاب',
  'سبأ',
  'فاطر',
  'يس',
  'الصافات',
  'ص',
  'الزمر',
  'غافر',
  'فصلت',
  'الشورى',
  'الزخرف',
  'الدخان',
  'الجاثية',
  'الأحقاف',
  'محمد',
  'الفتح',
  'الحجرات',
  'ق',
  'الذاريات',
  'الطور',
  'النجم',
  'القمر',
  'الرحمن',
  'الواقعة',
  'الحديد',
  'المجادلة',
  'الحشر',
  'الممتحنة',
  'الصف',
  'الجمعة',
  'المنافقون',
  'التغابن',
  'الطلاق',
  'التحريم',
  'الملك',
  'القلم',
  'الحاقة',
  'المعارج',
  'نوح',
  'الجن',
  'المزمل',
  'المدثر',
  'القيامة',
  'الإنسان',
  'المرسلات',
  'النبأ',
  'النازعات',
  'عبس',
  'التكوير',
  'الانفطار',
  'المطففين',
  'الانشقاق',
  'البروج',
  'الطارق',
  'الأعلى',
  'الغاشية',
  'الفجر',
  'البلد',
  'الشمس',
  'الليل',
  'الضحى',
  'الشرح',
  'التين',
  'العلق',
  'القدر',
  'البينة',
  'الزلزلة',
  'العاديات',
  'القارعة',
  'التكاثر',
  'العصر',
  'الهمزة',
  'الفيل',
  'قريش',
  'الماعون',
  'الكوثر',
  'الكافرون',
  'النصر',
  'المسد',
  'الإخلاص',
  'الفلق',
  'الناس',
]

const RIWAYA_DATA_URLS: Record<Exclude<SupportedRiwaya, 'hafs'>, string> = {
  shubah:
    'https://text.quran.ws/data/shubah.json',
  warsh:
    'https://text.quran.ws/data/warsh.json',
  qalun:
    'https://text.quran.ws/data/qalun.json',
  douri:
    'https://text.quran.ws/data/douri.json',
  sousi:
    'https://text.quran.ws/data/sousi.json',
  bazzi:
    'https://text.quran.ws/data/bazzi.json',
}

const mushafCache = new Map<string, any>()

function isSupportedRiwaya(
  value: string
): value is SupportedRiwaya {
  return [
    'hafs',
    'shubah',
    'warsh',
    'qalun',
    'douri',
    'sousi',
    'bazzi',
  ].includes(value)
}

async function loadMushaf(
  riwaya: SupportedRiwaya
) {
  const cached = mushafCache.get(riwaya)

  if (cached) {
    return cached
  }

  if (riwaya === 'hafs') {
    const mushaf = await Mushaf.hafs()
    mushafCache.set(riwaya, mushaf)
    return mushaf
  }

  const url = RIWAYA_DATA_URLS[riwaya]

  const response = await fetch(url, {
    cache: 'force-cache',
  })

  if (!response.ok) {
    throw new Error(
      `تعذر تحميل ملف الرواية ${riwaya}: ${response.status}`
    )
  }

  const json = await response.json()
  const mushaf = Mushaf.fromJson(json)

  mushafCache.set(riwaya, mushaf)

  return mushaf
}

function serializePage(
  mushaf: any,
  pageNumber: number
) {
  const page = mushaf.page(pageNumber)
  const sourceAyahs = Array.isArray(page?.ayahs)
    ? page.ayahs
    : []

  return sourceAyahs.map(
    (ayah: any, index: number) => {
      const key =
        typeof ayah?.key === 'string'
          ? ayah.key
          : ''

      const rawSurah = Number(
        ayah?.surah?.number ??
          ayah?.surahNumber ??
          0
      )

      const rawAyah = Number(
        ayah?.numberInSurah ??
          ayah?.ayahNumber ??
          0
      )

      let surahNumber = rawSurah
      let ayahNumber = rawAyah

      if (key.includes(':')) {
        const [s, a] = key
          .split(':')
          .map(Number)

        if (Number.isInteger(s) && s > 0) {
          surahNumber = s
        }

        if (Number.isInteger(a) && a > 0) {
          ayahNumber = a
        }
      }

      if (!surahNumber) {
        surahNumber = 1
      }

      if (!ayahNumber) {
        ayahNumber = index + 1
      }

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

      let juz: number | null = null

      try {
        if (
          Number.isInteger(
            Number(ayah?.juz)
          )
        ) {
          const value = Number(
            ayah?.juz
          )

          if (value > 0) {
            juz = value
          }
        }
      } catch {
        juz = null
      }

      return {
        number:
          surahNumber * 1000 +
          ayahNumber,

        key:
          key ||
          `${surahNumber}:${ayahNumber}`,

        text,

        numberInSurah:
          ayahNumber,

        juz,

        page: pageNumber,

        surah: {
          number: surahNumber,
          name:
            SURAH_NAMES_AR[
              surahNumber - 1
            ] ||
            `السورة ${surahNumber}`,
          englishName: '',
        },
      }
    }
  )
}

export async function GET(
  request: NextRequest
) {
  try {
    const riwayaParam =
      request.nextUrl.searchParams.get(
        'riwaya'
      ) || 'hafs'

    const pageParam =
      request.nextUrl.searchParams.get(
        'page'
      ) || '1'

    const page = Number(pageParam)

    if (
      !isSupportedRiwaya(
        riwayaParam
      )
    ) {
      return NextResponse.json(
        {
          error:
            'الرواية غير مدعومة حاليًا',
        },
        { status: 400 }
      )
    }

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 604
    ) {
      return NextResponse.json(
        {
          error:
            'رقم الصفحة غير صحيح',
        },
        { status: 400 }
      )
    }

    const mushaf =
      await loadMushaf(
        riwayaParam
      )

    const ayahs =
      serializePage(
        mushaf,
        page
      )

    return NextResponse.json(
      {
        riwaya:
          riwayaParam,
        page,
        ayahs,
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error(
      'Quran API route error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'تعذر تحميل بيانات المصحف حاليًا',
      },
      { status: 500 }
    )
  }
}
