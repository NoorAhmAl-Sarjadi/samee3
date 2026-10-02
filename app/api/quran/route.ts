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

const SUPPORTED_RIWAYAT = [
  'hafs',
  'warsh',
  'qalun',
  'douri',
  'shubah',
  'sousi',
  'bazzi',
] as const

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
] as const

const BASE_URL = 'https://api.quranpedia.net/v1'

const CACHE_TTL = 1000 * 60 * 60
const REQUEST_TIMEOUT = 15_000

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

type CachedMushaf = {
  loadedAt: number
  data: QuranpediaMushaf
}

const mushafCache = new Map<RiwayaId, CachedMushaf>()

/*
 * يمنع إرسال عدة طلبات لنفس الرواية في نفس اللحظة
 * عندما تفتح صفحة المصحف وتبدأ عملية prefetch في الوقت نفسه.
 */
const mushafPromiseCache = new Map<
  RiwayaId,
  Promise<QuranpediaMushaf>
>()

function isRiwaya(value: string): value is RiwayaId {
  return (
    Object.prototype.hasOwnProperty.call(
      RIWAYA_MUSHAF_IDS,
      value,
    )
  )
}

function toPositiveInteger(value: unknown): number {
  const number = Number(value)

  return Number.isInteger(number) && number > 0
    ? number
    : 0
}

function isValidPage(page: number): boolean {
  return (
    Number.isInteger(page) &&
    page >= 1 &&
    page <= 604
  )
}

function createJsonHeaders(
  maxAge = 3600,
): HeadersInit {
  return {
    'Cache-Control':
      `public, s-maxage=${maxAge}, stale-while-revalidate=${Math.min(
        maxAge * 2,
        86400,
      )}`,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
}

async function fetchMushafFromSource(
  riwaya: RiwayaId,
): Promise<QuranpediaMushaf> {
  const mushafId = RIWAYA_MUSHAF_IDS[riwaya]

  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT)

  try {
    const response = await fetch(
      `${BASE_URL}/mushafs/${mushafId}`,
      {
        method: 'GET',
        cache: 'force-cache',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      },
    )

    if (!response.ok) {
      const body = await response
        .text()
        .catch(() => '')

      throw new Error(
        `Quranpedia HTTP ${response.status}: ${body.slice(
          0,
          300,
        )}`,
      )
    }

    const rawData =
      (await response.json()) as unknown

    /*
     * المصدر قد يعيد البيانات مباشرة داخل surahs،
     * أو يعيد كائنًا يحتوي عليها.
     */
    const data = normalizeMushafPayload(
      rawData,
      mushafId,
    )

    if (!data || !Array.isArray(data.surahs)) {
      throw new Error(
        `بيانات المصحف غير صالحة للرواية: ${riwaya}`,
      )
    }

    if (!data.surahs.length) {
      throw new Error(
        `لم يتم العثور على سور في بيانات الرواية: ${riwaya}`,
      )
    }

    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeMushafPayload(
  payload: unknown,
  mushafId: MushafId,
): QuranpediaMushaf | null {
  /*
   * الشكل المتوقع:
   * {
   *   id,
   *   name,
   *   surahs: [...]
   * }
   */
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(
      (payload as { surahs?: unknown }).surahs,
    )
  ) {
    const objectPayload =
      payload as QuranpediaMushaf

    return {
      id:
        toPositiveInteger(objectPayload.id) ||
        mushafId,
      name:
        typeof objectPayload.name === 'string'
          ? objectPayload.name
          : undefined,
      surahs:
        Array.isArray(objectPayload.surahs)
          ? objectPayload.surahs
          : [],
    }
  }

  /*
   * احتياط إضافي لو أعاد المصدر مصفوفة السور مباشرة.
   */
  if (Array.isArray(payload)) {
    return {
      id: mushafId,
      surahs: payload as QuranpediaSurah[],
    }
  }

  /*
   * بعض الـ APIs قد تغلف البيانات داخل data.
   */
  if (
    payload &&
    typeof payload === 'object'
  ) {
    const data =
      (payload as {
        data?: unknown
      }).data

    if (
      data &&
      typeof data === 'object' &&
      Array.isArray(
        (data as { surahs?: unknown }).surahs,
      )
    ) {
      const nested =
        data as QuranpediaMushaf

      return {
        id:
          toPositiveInteger(nested.id) ||
          mushafId,
        name:
          typeof nested.name === 'string'
            ? nested.name
            : undefined,
        surahs:
          Array.isArray(nested.surahs)
            ? nested.surahs
            : [],
      }
    }

    if (Array.isArray(data)) {
      return {
        id: mushafId,
        surahs: data as QuranpediaSurah[],
      }
    }
  }

  return null
}

async function loadMushaf(
  riwaya: RiwayaId,
): Promise<QuranpediaMushaf> {
  const cached = mushafCache.get(riwaya)

  if (
    cached &&
    Date.now() - cached.loadedAt < CACHE_TTL
  ) {
    return cached.data
  }

  const runningRequest =
    mushafPromiseCache.get(riwaya)

  if (runningRequest) {
    return runningRequest
  }

  const request = fetchMushafFromSource(
    riwaya,
  )
    .then((data) => {
      mushafCache.set(riwaya, {
        loadedAt: Date.now(),
        data,
      })

      return data
    })
    .finally(() => {
      mushafPromiseCache.delete(riwaya)
    })

  mushafPromiseCache.set(
    riwaya,
    request,
  )

  return request
}

function serializePage(
  mushaf: QuranpediaMushaf,
  pageNumber: number,
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

  const surahs = Array.isArray(
    mushaf.surahs,
  )
    ? mushaf.surahs
    : []

  for (const surah of surahs) {
    const surahNumber =
      toPositiveInteger(surah?.id)

    if (
      surahNumber < 1 ||
      surahNumber > 114
    ) {
      continue
    }

    const surahAyahs =
      Array.isArray(surah?.ayahs)
        ? surah.ayahs
        : []

    for (const ayah of surahAyahs) {
      if (!ayah || typeof ayah !== 'object') {
        continue
      }

      const ayahPage =
        toPositiveInteger(
          ayah.page_number,
        )

      if (
        ayahPage !== pageNumber
      ) {
        continue
      }

      const ayahNumber =
        toPositiveInteger(
          ayah.number,
        )

      const text =
        typeof ayah.text === 'string'
          ? ayah.text.trim()
          : ''

      if (
        !ayahNumber ||
        !text
      ) {
        continue
      }

      /*
       * number_in_hafs يحتفظ بالرقم العالمي المقابل
       * للآية في حفص، وهو مفيد جدًا للمسار الصوتي
       * حتى عند عرض رواية أخرى.
       */
      const audioNumber =
        Array.isArray(
          ayah.number_in_hafs,
        ) &&
        ayah.number_in_hafs.length > 0
          ? toPositiveInteger(
              ayah.number_in_hafs[0],
            )
          : 0

      /*
       * نضمن رقمًا ثابتًا لكل آية.
       * key هو المعرف الأهم للتعامل مع:
       * السورة + رقم الآية
       * داخل صفحة المصحف.
       */
      const globalNumber =
        toPositiveInteger(ayah.id) ||
        surahNumber * 1000 +
          ayahNumber

      const arabicSurahName =
        SURAH_NAMES_AR[
          surahNumber - 1
        ] ||
        (typeof surah.name === 'string'
          ? surah.name
          : `السورة ${surahNumber}`)

      result.push({
        number: globalNumber,

        key: `${surahNumber}:${ayahNumber}`,

        text,

        numberInSurah: ayahNumber,

        juz: toPositiveInteger(ayah.juz),

        page: pageNumber,

        ...(audioNumber > 0
          ? {
              audioNumber,
            }
          : {}),

        surah: {
          number: surahNumber,
          name: arabicSurahName,
          englishName: '',
        },
      })
    }
  }

  /*
   * الترتيب هنا مهم جدًا:
   * صفحة المصحف يجب أن تُرجع الآيات بنفس تسلسلها
   * القرآني، حتى يطابق التظليل حركة التلاوة.
   */
  return result.sort(
    (a, b) => {
      if (a.number !== b.number) {
        return a.number - b.number
      }

      return (
        a.numberInSurah -
        b.numberInSurah
      )
    },
  )
}

function errorMessage(
  error: unknown,
): string {
  if (error instanceof DOMException) {
    if (error.name === 'AbortError') {
      return 'انتهى وقت تحميل بيانات المصحف. حاول مرة أخرى.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export async function GET(
  request: NextRequest,
) {
  const searchParams =
    request.nextUrl.searchParams

  const riwayaParam = (
    searchParams.get('riwaya') ||
    'hafs'
  )
    .trim()
    .toLowerCase()

  const rawPage =
    searchParams.get('page') || '1'

  const page = Number(rawPage)

  /*
   * -----------------------------
   * التحقق من الرواية
   * -----------------------------
   */
  if (!isRiwaya(riwayaParam)) {
    return NextResponse.json(
      {
        success: false,
        error: 'الرواية غير مدعومة.',
        supported:
          SUPPORTED_RIWAYAT,
      },
      {
        status: 400,
        headers: createJsonHeaders(60),
      },
    )
  }

  /*
   * -----------------------------
   * التحقق من الصفحة
   * -----------------------------
   */
  if (!isValidPage(page)) {
    return NextResponse.json(
      {
        success: false,
        error: 'رقم الصفحة غير صحيح.',
        page,
        range: {
          min: 1,
          max: 604,
        },
      },
      {
        status: 400,
        headers: createJsonHeaders(60),
      },
    )
  }

  try {
    const mushaf =
      await loadMushaf(
        riwayaParam,
      )

    const ayahs =
      serializePage(
        mushaf,
        page,
      )

    /*
     * الصفحة بدون آيات تعني أن المصدر أو بيانات
     * الرواية لم تُقرأ بالشكل المتوقع.
     */
    if (!ayahs.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            'لم يتم العثور على آيات في هذه الصفحة.',
          riwaya: riwayaParam,
          mushafId:
            RIWAYA_MUSHAF_IDS[
              riwayaParam
            ],
          page,
          ayahs: [],
        },
        {
          status: 404,
          headers: createJsonHeaders(300),
        },
      )
    }

    return NextResponse.json(
      {
        success: true,

        riwaya: riwayaParam,

        mushafId:
          RIWAYA_MUSHAF_IDS[
            riwayaParam
          ],

        page,

        ayahs,
      },
      {
        status: 200,
        headers:
          createJsonHeaders(3600),
      },
    )
  } catch (error) {
    console.error(
      'QURAN API ERROR:',
      error,
    )

    const message =
      errorMessage(error)

    return NextResponse.json(
      {
        success: false,
        error:
          'تعذر تحميل بيانات المصحف حاليًا.',
        details:
          process.env.NODE_ENV ===
          'development'
            ? message
            : undefined,
        riwaya: riwayaParam,
        page,
      },
      {
        status: 500,
        headers: createJsonHeaders(60),
      },
    )
  }
}
