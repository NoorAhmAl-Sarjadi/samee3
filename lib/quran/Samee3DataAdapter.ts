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
  mushafId: number
  available: boolean
  /**
   * اسم نسخة الـSVG المطبوعة من مستودع quran-svg.
   * تكون موجودة فقط للروايات الخمس التي لها صفحة مصحف مرئية جاهزة.
   */
  printedEdition?: PrintedMushafEdition
}

export type PrintedMushafEdition =
  | 'hafs-kfqc'
  | 'warsh-kfqc'
  | 'qalon-kfqc'
  | 'douri-kfqc'
  | 'shubah-kfqc'

export const PRINTED_MUSHAF_EDITIONS: Partial<
  Record<RiwayaId, PrintedMushafEdition>
> = {
  hafs: 'hafs-kfqc',
  warsh: 'warsh-kfqc',
  qalun: 'qalon-kfqc',
  douri: 'douri-kfqc',
  shubah: 'shubah-kfqc',
}

export const RIWAYAT: RiwayaDefinition[] = [
  {
    id: 'hafs',
    label: 'حفص عن عاصم',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 1,
    available: true,
    printedEdition: 'hafs-kfqc',
  },
  {
    id: 'warsh',
    label: 'ورش عن نافع',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 4,
    available: true,
    printedEdition: 'warsh-kfqc',
  },
  {
    id: 'qalun',
    label: 'قالون عن نافع',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 7,
    available: true,
    printedEdition: 'qalon-kfqc',
  },
  {
    id: 'douri',
    label: 'الدوري عن أبي عمرو',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 6,
    available: true,
    printedEdition: 'douri-kfqc',
  },
  {
    id: 'sousi',
    label: 'السوسي عن أبي عمرو',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 10,
    available: true,
  },
  {
    id: 'shubah',
    label: 'شعبة عن عاصم',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 9,
    available: true,
    printedEdition: 'shubah-kfqc',
  },
  {
    id: 'bazzi',
    label: 'البزي عن ابن كثير',
    source: 'Quranpedia',
    license: 'Quranpedia API',
    mushafId: 5,
    available: true,
  },
]

export function isSupportedRiwayaId(
  value: string
): value is RiwayaId {
  return RIWAYAT.some(
    (item) => item.id === value
  )
}

export function getRiwayaDefinition(
  riwayaId: RiwayaId
): RiwayaDefinition {
  const item = RIWAYAT.find(
    (entry) => entry.id === riwayaId
  )

  if (!item) {
    throw new Error(
      `الرواية غير معروفة: ${riwayaId}`
    )
  }

  return item
}

export function isPrintedMushafRiwaya(
  value: string
): value is RiwayaId {
  return (
    isSupportedRiwayaId(value) &&
    Boolean(PRINTED_MUSHAF_EDITIONS[value])
  )
}

export function getPrintedMushafEdition(
  riwayaId: RiwayaId
): PrintedMushafEdition | null {
  return (
    PRINTED_MUSHAF_EDITIONS[riwayaId] ||
    null
  )
}

type RemoteRiwaya = {
  riwayaId: RiwayaId
  mushafId: number
}

export async function loadRiwaya(
  riwayaId: RiwayaId
): Promise<RemoteRiwaya> {
  const item = RIWAYAT.find(
    (entry) => entry.id === riwayaId
  )

  if (!item || !item.available) {
    throw new Error(
      `الرواية غير متاحة حاليًا: ${riwayaId}`
    )
  }

  return {
    riwayaId,
    mushafId: item.mushafId,
  }
}

export const SURAH_NAMES_AR = [
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

/**
 * نطلب صفحة الرواية من API الداخلي للمشروع.
 * API الداخلي هو المسؤول عن الاتصال بـ Quranpedia
 * حتى لا نضع طلبات البيانات الثقيلة داخل Client Bundle.
 */
export async function getRiwayaPage(
  mushaf: RemoteRiwaya,
  pageNumber: number
) {
  const params = new URLSearchParams({
    riwaya: mushaf.riwayaId,
    page: String(pageNumber),
  })

  const response = await fetch(
    `/api/quran?${params.toString()}`,
    {
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    let details = ''

    try {
      const payload = await response.json()

      if (
        payload &&
        typeof payload.error === 'string'
      ) {
        details = payload.error
      }
    } catch {
      // تجاهل فشل قراءة الخطأ
    }

    throw new Error(
      details ||
        `تعذر تحميل صفحة الرواية: ${mushaf.riwayaId}`
    )
  }

  const payload = await response.json()

  if (!Array.isArray(payload?.ayahs)) {
    return []
  }

  return payload.ayahs
}