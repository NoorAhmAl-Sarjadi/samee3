import { Mushaf } from '@quran.ws/text'

export type RiwayaId =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'sousi'
  | 'shubah'
  | 'bazzi'

export interface RiwayaDefinition {
  id: RiwayaId
  label: string
  source: string
  license: string
  dataUrl?: string
  available: boolean
}

/**
 * مصدر نصي مستقل لكل رواية.
 * لا نقوم بتعديل نص حفص لمحاكاة رواية أخرى.
 */
export const RIWAYAT: RiwayaDefinition[] = [
  {
    id: 'hafs',
    label: 'حفص عن عاصم',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    available: true,
  },
  {
    id: 'warsh',
    label: 'ورش عن نافع',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/warsh.json',
    available: true,
  },
  {
    id: 'qalun',
    label: 'قالون عن نافع',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/qalun.json',
    available: true,
  },
  {
    id: 'douri',
    label: 'الدوري عن أبي عمرو',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/douri.json',
    available: true,
  },
  {
    id: 'sousi',
    label: 'السوسي عن أبي عمرو',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/sousi.json',
    available: true,
  },
  {
    id: 'shubah',
    label: 'شعبة عن عاصم',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/shuba.json',
    available: true,
  },
  {
    id: 'bazzi',
    label: 'البزي عن ابن كثير',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/bazzi.json',
    available: true,
  },
]

export function isSupportedRiwayaId(
  value: string
): value is RiwayaId {
  return RIWAYAT.some((item) => item.id === value)
}

const mushafCache = new Map<RiwayaId, any>()

export async function loadRiwaya(
  riwayaId: RiwayaId
) {
  const cached = mushafCache.get(riwayaId)
  if (cached) return cached

  const item = RIWAYAT.find(
    (entry) => entry.id === riwayaId
  )

  if (!item || !item.available) {
    throw new Error(
      `الرواية غير متاحة حاليًا: ${riwayaId}`
    )
  }

  let mushaf: any

  if (riwayaId === 'hafs') {
    mushaf = await Mushaf.hafs()
  } else if (item.dataUrl) {
    const response = await fetch(item.dataUrl, {
      cache: 'force-cache',
    })

    if (!response.ok) {
      throw new Error(
        `تعذر تحميل حزمة الرواية: ${riwayaId}`
      )
    }

    const json = await response.json()
    mushaf = Mushaf.fromJson(json)
  } else {
    throw new Error(
      `لا توجد حزمة بيانات للرواية: ${riwayaId}`
    )
  }

  mushafCache.set(riwayaId, mushaf)
  return mushaf
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

function getNumberFromKey(
  key: string | undefined,
  fallbackSurah: number,
  fallbackAyah: number
) {
  if (!key) {
    return {
      surahNumber: fallbackSurah,
      ayahNumber: fallbackAyah,
    }
  }

  const [surah, ayah] = key.split(':').map(Number)

  return {
    surahNumber:
      Number.isInteger(surah) && surah > 0
        ? surah
        : fallbackSurah,
    ayahNumber:
      Number.isInteger(ayah) && ayah > 0
        ? ayah
        : fallbackAyah,
  }
}

/**
 * يحول كائن الصفحة من quran.ws إلى الشكل الذي تستخدمه شاشة المصحف الحالية.
 */
export function getRiwayaPage(
  mushaf: any,
  pageNumber: number
) {
  const page = mushaf.page(pageNumber)
  const sourceAyahs = Array.isArray(page?.ayahs)
    ? page.ayahs
    : []

  return sourceAyahs.map((sourceAyah: any, index: number) => {
    const rawKey =
      typeof sourceAyah?.key === 'string'
        ? sourceAyah.key
        : ''

    const rawSurah = Number(
      sourceAyah?.surah?.number ??
        sourceAyah?.surahNumber ??
        0
    )

    const rawAyah = Number(
      sourceAyah?.numberInSurah ??
        sourceAyah?.ayahNumber ??
        0
    )

    const { surahNumber, ayahNumber } =
      getNumberFromKey(
        rawKey,
        rawSurah || 1,
        rawAyah || index + 1
      )

    const key =
      rawKey || `${surahNumber}:${ayahNumber}`

    const text =
      typeof sourceAyah?.text === 'string'
        ? sourceAyah.text
        : typeof sourceAyah?.render === 'function'
          ? String(
              sourceAyah.render({
                marks: true,
                ayahMarks: false,
              }) || ''
            )
          : ''

    const stableNumber =
      surahNumber * 1000 + ayahNumber

    return {
      number: stableNumber,
      key,
      text,
      numberInSurah: ayahNumber,
      juz: Number(sourceAyah?.juz ?? 0),
      page: pageNumber,
      surah: {
        number: surahNumber,
        name:
          SURAH_NAMES_AR[surahNumber - 1] ||
          `السورة ${surahNumber}`,
        englishName: '',
      },
    }
  })
}
