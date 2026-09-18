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
 * بيانات الروايات مصدرها حزم منفصلة وموثقة.
 * لا يتم تعديل نص حفص يدويًا لمحاكاة رواية أخرى.
 */
export const RIWAYAT: RiwayaDefinition[] = [
  {
    id: 'hafs',
    label: 'حفص عن عاصم',
    source: 'quran.ws / quran-text',
    license: 'CC-BY-4.0',
    dataUrl:
      'https://cdn.jsdelivr.net/npm/@quran.ws/text@0.1.0/data/mushaf/hafs.json',
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

export function isSupportedRiwayaId(value: string): value is RiwayaId {
  return RIWAYAT.some((item) => item.id === value)
}

type RemoteRiwaya = { riwayaId: RiwayaId }

export async function loadRiwaya(riwayaId: RiwayaId): Promise<RemoteRiwaya> {
  const item = RIWAYAT.find((entry) => entry.id === riwayaId)
  if (!item || !item.available) {
    throw new Error(`الرواية غير متاحة حاليًا: ${riwayaId}`)
  }
  return { riwayaId }
}

export const SURAH_NAMES_AR = [
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

/**
 * صفحة الرواية تُجلب من API Route على السيرفر، لأن حزمة quran.ws/text
 * تحتوي على استيراد Node (`node:fs/promises`) لا ينبغي إدخاله إلى Client Bundle.
 */
export async function getRiwayaPage(
  mushaf: RemoteRiwaya,
  pageNumber: number
) {
  const params = new URLSearchParams({
    riwaya: mushaf.riwayaId,
    page: String(pageNumber),
  })

  const response = await fetch(`/api/quran?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`تعذر تحميل صفحة الرواية: ${mushaf.riwayaId}`)
  }

  const payload = await response.json()
  return Array.isArray(payload?.ayahs) ? payload.ayahs : []
}
