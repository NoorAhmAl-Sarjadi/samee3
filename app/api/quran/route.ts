import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RiwayaId =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'sousi'
  | 'shubah'
  | 'bazzi'

type MushafId = 1 | 4 | 5 | 6 | 7 | 9 | 10

const RIWAYA_MUSHAF_IDS: Record<RiwayaId, MushafId> = {
  hafs: 1,
  warsh: 4,
  bazzi: 5,
  douri: 6,
  qalun: 7,
  shubah: 9,
  sousi: 10,
}

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

const BASE_URL = 'https://api.quranpedia.net/v1'

type QuranpediaAyah = {
  id?: number
  number?: number
  surah?: number
  page_number?: number
  text?: string
  marker?: string
  number_in_hafs?: number[]
  juz?: number
}

type QuranpediaSurah = {
  id?: number
  name?: string
  ayahs?: QuranpediaAyah[]
}

type QuranpediaMushaf = {
  id?: number
  name?: string
  surahs?: QuranpediaSurah[]
}

const mushafCache = new Map<
  RiwayaId,
  {
    loadedAt: number
    data: QuranpediaMushaf
  }
>()

const CACHE_TTL = 1000 * 60 * 60

function isRiwaya(value: string): value is RiwayaId {
  return value in RIWAYA_MUSHAF_IDS
}

async function loadMushaf(
  riwaya: RiwayaId
): Promise<QuranpediaMushaf> {
  const cached = mushafCache.get(riwaya)

  if (
    cached &&
    Date.now() - cached.loadedAt < CACHE_TTL
  ) {
    return cached.data
  }

  const mushafId = RIWAYA_MUSHAF_IDS[riwaya]

  const response = await fetch(
    `${BASE_URL}/mushafs/${mushafId}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')

    throw new Error(
      `Quranpedia HTTP ${response.status}: ${body.slice(
        0,
        300
      )}`
    )
  }

  const data =
    (await response.json()) as QuranpediaMushaf

  if (
    !data ||
    !Array.isArray(data.surahs)
  ) {
    throw new Error(
      `بيانات المصحف غير صالحة للرواية: ${riwaya}`
    )
  }

  mushafCache.set(riwaya, {
    loadedAt: Date.now(),
    data,
  })

  return data
}

function serializePage(
  mushaf: QuranpediaMushaf,
  pageNumber: number
) {
  const result: Array<{
    number: number
    key: string
    text: string
    numberInSurah: number
    juz: number
    page: number
    audioNumber?: number
    surah: {
      number: number
      name: string
      englishName: string
    }
  }> = []

  for (const surah of mushaf.surahs || []) {
    const surahNumber = Number(surah.id || 0)

    for (const ayah of surah.ayahs || []) {
      const ayahPage = Number(
        ayah.page_number || 0
      )

      if (ayahPage !== pageNumber) {
        continue
      }

      const ayahNumber = Number(
        ayah.number || 0
      )

      if (
        !surahNumber ||
        !ayahNumber ||
        typeof ayah.text !== 'string'
      ) {
        continue
      }

      const audioNumber =
        Array.isArray(ayah.number_in_hafs) &&
        ayah.number_in_hafs.length > 0
          ? Number(ayah.number_in_hafs[0])
          : undefined

      result.push({
        number:
          Number(ayah.id) ||
          surahNumber * 1000 + ayahNumber,
        key: `${surahNumber}:${ayahNumber}`,
        text: ayah.text,
        numberInSurah: ayahNumber,
        juz: Number(ayah.juz || 0),
        page: pageNumber,
        ...(audioNumber
          ? { audioNumber }
          : {}),
        surah: {
          number: surahNumber,
          name:
            SURAH_NAMES_AR[surahNumber - 1] ||
            `السورة ${surahNumber}`,
          englishName: '',
        },
      })
    }
  }

  return result.sort(
    (a, b) => a.number - b.number
  )
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl.searchParams

    const riwayaParam = (
      searchParams.get('riwaya') ||
      'hafs'
    ).toLowerCase()

    const page = Number(
      searchParams.get('page') || '1'
    )

    if (!isRiwaya(riwayaParam)) {
      return NextResponse.json(
        {
          error: 'الرواية غير مدعومة',
          supported: Object.keys(
            RIWAYA_MUSHAF_IDS
          ),
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
          error: 'رقم الصفحة غير صحيح',
          page,
        },
        { status: 400 }
      )
    }

    const mushaf =
      await loadMushaf(riwayaParam)

    const ayahs = serializePage(
      mushaf,
      page
    )

    if (!ayahs.length) {
      return NextResponse.json(
        {
          error:
            'لم يتم العثور على آيات في هذه الصفحة',
          riwaya: riwayaParam,
          page,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      riwaya: riwayaParam,
      mushafId:
        RIWAYA_MUSHAF_IDS[riwayaParam],
      page,
      ayahs,
    })
  } catch (error) {
    console.error(
      'QURAN API ERROR:',
      error
    )

    return NextResponse.json(
      {
        error:
          'تعذر تحميل بيانات المصحف حاليًا',
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    )
  }
}