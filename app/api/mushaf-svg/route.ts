import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PrintedRiwaya =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'

type TextRiwaya = 'sousi' | 'bazzi'
type Riwaya = PrintedRiwaya | TextRiwaya

const EDITIONS: Record<PrintedRiwaya, string> = {
  hafs: 'hafs-kfqc',
  warsh: 'warsh-kfqc',
  qalun: 'qalon-kfqc',
  douri: 'douri-kfqc',
  shubah: 'shubah-kfqc',
}

/**
 * الروايتان اللتان لا يملك لهما quran-svg الحالي صفحات SVG مطبوعة.
 * لا نستبدلهما بحفص/الدوري؛ نرجع بيانات الرواية الحقيقية من /api/quran
 * لكي يقوم قارئ المصحف بعرضها بخطها الصحيح في المرحلة التالية.
 */
const TEXT_RIWAYAT = new Set<TextRiwaya>(['sousi', 'bazzi'])

const BASE_URL = 'https://cdn.quran.ws/svg/pages/v1.1.1'
const REQUEST_TIMEOUT = 15_000

function isRiwaya(value: string): value is Riwaya {
  return value in EDITIONS || TEXT_RIWAYAT.has(value as TextRiwaya)
}

function isPrintedRiwaya(value: string): value is PrintedRiwaya {
  return value in EDITIONS
}

function isValidPage(page: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= 604
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type QuranTextMushaf = {
  format?: string
  format_version?: string
  mushaf?: {
    key?: string
    word_count?: number
  }
  font?: {
    family?: string
    file?: string
  }
  words?: string[]
  ayah_starts?: number[]
  page_starts?: number[]
  line_starts?: number[]
  surahs?: Array<{
    number?: number
    first_ayah?: number
    ayah_count?: number
  }>
}

const QURAN_TEXT_RAW_BASE =
  'https://raw.githubusercontent.com/quran-ws/quran-text/main/data/mushaf'

const QURAN_TEXT_DOWNLOAD_BASE = 'https://text.quran.ws/download'
const QURAN_TEXT_CACHE_TTL = 60 * 60 * 1000

const quranTextCache = new Map<
  TextRiwaya,
  { loadedAt: number; data: QuranTextMushaf }
>()
const quranTextInFlight = new Map<TextRiwaya, Promise<QuranTextMushaf>>()

function binarySearchLastStart(starts: number[], position: number): number {
  let low = 0
  let high = starts.length - 1
  let answer = 0

  while (low <= high) {
    const mid = (low + high) >> 1
    const value = starts[mid]

    if (value <= position) {
      answer = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return answer
}

function normalizeQuranTextMushaf(value: unknown): QuranTextMushaf | null {
  if (!value || typeof value !== 'object') return null

  const data = value as Record<string, unknown>
  const record = data
  const words = Array.isArray(record.words)
    ? record.words.filter((word): word is string => typeof word === 'string')
    : []

  const ayahStarts = Array.isArray(record.ayah_starts)
    ? record.ayah_starts.filter((item): item is number => Number.isInteger(item))
    : []

  const pageStarts = Array.isArray(record.page_starts)
    ? record.page_starts.filter((item): item is number => Number.isInteger(item))
    : []

  const lineStarts = Array.isArray(record.line_starts)
    ? record.line_starts.filter((item): item is number => Number.isInteger(item))
    : []

  if (!words.length || !pageStarts.length || !lineStarts.length) {
    return null
  }

  return {
    format: typeof record.format === 'string' ? record.format : undefined,
    format_version:
      typeof record.format_version === 'string'
        ? record.format_version
        : undefined,
    mushaf:
      record.mushaf && typeof record.mushaf === 'object'
        ? (record.mushaf as QuranTextMushaf['mushaf'])
        : undefined,
    font:
      record.font && typeof record.font === 'object'
        ? (record.font as QuranTextMushaf['font'])
        : undefined,
    words,
    ayah_starts: ayahStarts,
    page_starts: pageStarts,
    line_starts: lineStarts,
    surahs: Array.isArray(record.surahs)
      ? (record.surahs as QuranTextMushaf['surahs'])
      : undefined,
  }
}

async function fetchQuranTextMushaf(
  riwaya: TextRiwaya,
): Promise<QuranTextMushaf> {
  const cached = quranTextCache.get(riwaya)
  if (cached && Date.now() - cached.loadedAt < QURAN_TEXT_CACHE_TTL) {
    return cached.data
  }

  const inFlight = quranTextInFlight.get(riwaya)
  if (inFlight) return inFlight

  const promise = (async () => {
    const rawUrl = `${QURAN_TEXT_RAW_BASE}/${riwaya}.json`

    const rawResponse = await fetch(rawUrl, {
      method: 'GET',
      cache: 'force-cache',
      headers: {
        Accept: 'application/json',
      },
    })

    if (rawResponse.ok) {
      const rawData = await rawResponse.json()
      const mushaf = normalizeQuranTextMushaf(rawData)

      if (mushaf) return mushaf
    }

    // fallback رسمي من نفس مشروع Quran Text، في حالة تعذر raw GitHub.
    const downloadUrl = new URL(QURAN_TEXT_DOWNLOAD_BASE)
    downloadUrl.searchParams.set('edition', riwaya)
    downloadUrl.searchParams.set('format', 'json')
    downloadUrl.searchParams.set('layout', 'lines')
    downloadUrl.searchParams.set('by', 'word')
    downloadUrl.searchParams.set('page', '1-604')

    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      cache: 'force-cache',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!downloadResponse.ok) {
      throw new Error(
        `Quran Text ${riwaya} download failed: ${downloadResponse.status}`,
      )
    }

    const downloadData = await downloadResponse.json()
    const mushaf = normalizeQuranTextMushaf(downloadData)

    if (!mushaf) {
      throw new Error(`Invalid Quran Text mushaf payload for ${riwaya}.`)
    }

    return mushaf
  })()

  quranTextInFlight.set(riwaya, promise)

  try {
    const data = await promise
    quranTextCache.set(riwaya, { loadedAt: Date.now(), data })
    return data
  } finally {
    quranTextInFlight.delete(riwaya)
  }
}


/**
 * مصدر صور صفحات المصاحف عالية الجودة للسوسي والبزي.
 * المستودع يعلن عن 606 صور لكل رواية، ونستخدم منه صفحات 1..604
 * المطابقة لواجهة المصحف الحالية.
 */
function buildTextMushafSvg(
  riwaya: TextRiwaya,
  page: number,
  mushaf: QuranTextMushaf,
  fontFile: string | null,
) {
  const fallbackFontFile =
    riwaya === 'sousi'
      ? 'https://text.quran.ws/data/fonts/UthmanicSousi-v-3.0.ttf'
      : 'https://text.quran.ws/data/fonts/UthmanicBazzi-v-3.0.ttf'

  const fontFamily =
    mushaf.font?.family?.trim() ||
    (riwaya === 'sousi'
      ? 'KFGQPC Sousi Uthmanic Script'
      : 'KFGQPC Bazzi Uthmanic Script')

  const requestedFontFile = fontFile?.trim() || mushaf.font?.file?.trim() || ''
  const safeFontFile =
    /^https?:\/\//i.test(requestedFontFile)
      ? requestedFontFile
      : requestedFontFile
        ? `https://text.quran.ws/data/fonts/${encodeURIComponent(requestedFontFile)}`
        : fallbackFontFile

  const words = mushaf.words ?? []
  const ayahStarts = mushaf.ayah_starts ?? []
  const pageStarts = mushaf.page_starts ?? []
  const lineStarts = mushaf.line_starts ?? []
  const surahs = mushaf.surahs ?? []

  const pageStart = pageStarts[page - 1]
  const pageEnd = pageStarts[page] ?? words.length

  if (!Number.isInteger(pageStart) || pageStart < 0) {
    throw new Error(`Missing page start for ${riwaya} page ${page}.`)
  }

  type RenderWord = {
    text: string
    surah: string
    ayah: string
    position: number
  }

  const getAyahIndexForPosition = (position: number) =>
    binarySearchLastStart(ayahStarts, position)

  const wordsWithMeta: RenderWord[] = []

  for (let position = pageStart; position < pageEnd; position += 1) {
    const text = words[position]
    if (!text) continue

    const ayahIndex = getAyahIndexForPosition(position)
    const ayahStart = ayahStarts[ayahIndex]
    const nextAyahStart = ayahStarts[ayahIndex + 1] ?? words.length

    // في السوسي والبزي توجد مواضع مطبوعة (مثل البسملة غير المرقمة)
    // قد تقع بين آيتين؛ لا ننسبها للآية السابقة.
    const hasAyah =
      ayahIndex >= 0 &&
      Number.isInteger(ayahStart) &&
      position >= ayahStart &&
      position < nextAyahStart

    const surahIndex = hasAyah
      ? (() => {
          let selected = -1
          for (let i = 0; i < surahs.length; i += 1) {
            const firstAyah = Number(surahs[i]?.first_ayah)
            if (Number.isInteger(firstAyah) && firstAyah <= ayahIndex) selected = i
            else if (Number.isInteger(firstAyah) && firstAyah > ayahIndex) break
          }
          return selected
        })()
      : -1

    const surah =
      hasAyah && surahIndex >= 0
        ? String(surahs[surahIndex]?.number ?? '')
        : ''

    const firstAyahInSurah =
      hasAyah && surahIndex >= 0
        ? Number(surahs[surahIndex]?.first_ayah ?? ayahIndex)
        : ayahIndex

    const ayah =
      hasAyah && surahIndex >= 0
        ? String(ayahIndex - firstAyahInSurah + 1)
        : ''

    wordsWithMeta.push({
      text,
      surah,
      ayah,
      position,
    })
  }

  const pageLineStarts = lineStarts
    .map((start, index) => ({ start, index }))
    .filter(({ start }) => start >= pageStart && start < pageEnd)

  const lineRanges: Array<{ start: number; end: number }> = []

  for (let i = 0; i < pageLineStarts.length; i += 1) {
    const start = pageLineStarts[i].start
    const end =
      pageLineStarts[i + 1]?.start ??
      pageEnd

    if (start < pageEnd && end > start) {
      lineRanges.push({
        start,
        end: Math.min(end, pageEnd),
      })
    }
  }

  // لو كانت بيانات line_starts لا تبدأ من نفس أول كلمة الصفحة،
  // نستخدم نطاق الصفحة كحل آمن بدل إسقاط النص.
  if (!lineRanges.length) {
    lineRanges.push({ start: pageStart, end: pageEnd })
  }

  const wordByPosition = new Map(
    wordsWithMeta.map((word) => [word.position, word]),
  )

  const toArabicDigits = (value: string) =>
    value.replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])

  const lineNodes = lineRanges.map((range, lineIndex) => {
    const lineWords: RenderWord[] = []

    for (let position = range.start; position < range.end; position += 1) {
      const word = wordByPosition.get(position)
      if (word) lineWords.push(word)
    }

    if (!lineWords.length) return ''

    const content = lineWords
      .map((word, wordIndex) => {
        const nextWord = lineWords[wordIndex + 1]
        const ayahEnded =
          word.ayah &&
          (!nextWord || nextWord.ayah !== word.ayah || nextWord.surah !== word.surah)

        const marker = ayahEnded
          ? ` <tspan class="samee3-ayah-marker">۝${toArabicDigits(word.ayah)}</tspan>`
          : ''

        const key =
          word.surah && word.ayah
            ? `${word.surah}:${word.ayah}`
            : `position:${word.position}`

        return `<tspan class="samee3-ayah" data-ayah="${escapeXml(key)}" data-surah="${escapeXml(word.surah)}" data-ayah-number="${escapeXml(word.ayah)}">${escapeXml(word.text)}${marker}</tspan>${wordIndex < lineWords.length - 1 ? ' ' : ''}`
      })
      .join('')

    return `<text x="50%" y="${lineIndex + 1}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" class="samee3-quran-line">${content}</text>`
  })

  const viewWidth = 382.68
  const viewHeight = 547.09
  const lineCount = Math.max(lineRanges.length, 1)
  const textTop = lineCount <= 10 ? 86 : 78
  const textBottom = lineCount <= 10 ? 495 : 508
  const lineHeight =
    lineCount === 1 ? 0 : (textBottom - textTop) / (lineCount - 1)

  const normalizedFontFile = safeFontFile.toLowerCase()
  const fontFormat = normalizedFontFile.includes('.woff2')
    ? 'woff2'
    : normalizedFontFile.includes('.woff')
      ? 'woff'
      : normalizedFontFile.includes('.otf')
        ? 'opentype'
        : 'truetype'

  const fontStyle = `
    @font-face {
      font-family: '${escapeXml(fontFamily)}';
      src: url('${escapeXml(safeFontFile)}') format('${fontFormat}');
      font-display: swap;
    }
  `

  const positionedLineNodes = lineNodes
    .map((raw, lineIndex) => {
      if (!raw) return ''
      const y =
        lineCount === 1
          ? (textTop + textBottom) / 2
          : textTop + lineIndex * lineHeight
      return raw.replace(/ y="[^"]*"/, ` y="${y.toFixed(2)}"`)
    })
    .join('')

  return `
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${viewWidth} ${viewHeight}"
     preserveAspectRatio="xMidYMid meet"
     role="img"
     aria-label="صفحة المصحف ${escapeXml(page)} من رواية ${escapeXml(riwaya)}">
  <style>
    ${fontStyle}
    .samee3-quran-line {
      font-family: '${escapeXml(fontFamily)}', serif;
      font-size: 18.6px;
      font-weight: 400;
      fill: #171717;
      letter-spacing: 0;
      word-spacing: 0;
      dominant-baseline: alphabetic;
    }
    .samee3-ayah { cursor: pointer; }
    .samee3-ayah-marker {
      font-family: '${escapeXml(fontFamily)}', serif;
      font-size: 0.62em;
      fill: #9a753e;
    }
  </style>
  <rect x="0" y="0" width="${viewWidth}" height="${viewHeight}" fill="#fffdf7"/>
  <g id="samee3-quran-content">${positionedLineNodes}</g>
</svg>`.trim()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const riwaya = (
    searchParams.get('riwaya') || 'hafs'
  ).toLowerCase()

  const page = Number(searchParams.get('page') || '1')

  // =========================================================
  // التحقق من الرواية
  // =========================================================

  if (!isRiwaya(riwaya)) {
    return NextResponse.json(
      {
        error: 'هذه الرواية غير مدعومة.',
        supported: [
          'hafs',
          'warsh',
          'qalun',
          'douri',
          'shubah',
          'sousi',
          'bazzi',
        ],
      },
      { status: 400 },
    )
  }

  // =========================================================
  // التحقق من رقم الصفحة
  // =========================================================

  if (!isValidPage(page)) {
    return NextResponse.json(
      {
        error: 'رقم الصفحة غير صحيح.',
        page,
      },
      { status: 400 },
    )
  }

  // =========================================================
  // الروايات الخمس المطبوعة: لا نغير مصدرها إطلاقًا.
  // =========================================================

  if (isPrintedRiwaya(riwaya)) {
    const edition = EDITIONS[riwaya]
    const filename = `${String(page).padStart(3, '0')}.svg`
    const url = `${BASE_URL}/${edition}/${filename}`

    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT,
    )

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'force-cache',
        signal: controller.signal,
        headers: {
          Accept: 'image/svg+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      })

      if (!response.ok) {
        return NextResponse.json(
          {
            error: 'تعذر تحميل صفحة المصحف من المصدر المرئي.',
            status: response.status,
            riwaya,
            edition,
            page,
          },
          { status: response.status },
        )
      }

      const svg = (await response.text()).trim()

      if (!svg || !svg.includes('<svg')) {
        return NextResponse.json(
          {
            error: 'المصدر لم يرجع SVG صالحًا.',
            riwaya,
            edition,
            page,
          },
          { status: 502 },
        )
      }

      return NextResponse.json(
        {
          success: true,
          mode: 'printed-svg',
          riwaya,
          edition,
          page,
          svg,
        },
        {
          headers: {
            'Cache-Control':
              'public, s-maxage=31536000, stale-while-revalidate=86400',
          },
        },
      )
    } catch (error) {
      const isAbort =
        error instanceof DOMException &&
        error.name === 'AbortError'

      console.error('MUSHAF SVG ERROR:', error)

      return NextResponse.json(
        {
          error: isAbort
            ? 'انتهى وقت تحميل صفحة المصحف. حاول مرة أخرى.'
            : 'حدث خطأ أثناء تحميل صفحة المصحف.',
          details:
            error instanceof Error ? error.message : String(error),
          riwaya,
          edition,
          page,
        },
        { status: 500 },
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // =========================================================
  // السوسي والبزي: نستخدم ملف Quran Text الخاص بالرواية نفسها.
  // الملف يحتوي على الكلمات + بداية الصفحات + بداية السطور + بيانات السور،
  // لذلك نرسم الصفحة مباشرة من مخطط الرواية بدل تخمين مصدر صور خارجي.
  // =========================================================

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT,
  )

  try {
    const apiUrl = new URL('/api/quran', request.url)
    apiUrl.searchParams.set('riwaya', riwaya)
    apiUrl.searchParams.set('page', String(page))

    const [quranResponse, mushaf] = await Promise.all([
      fetch(apiUrl, {
        method: 'GET',
        cache: 'force-cache',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      }),
      fetchQuranTextMushaf(riwaya),
    ])

    if (!quranResponse.ok) {
      const details = await quranResponse.text().catch(() => '')

      return NextResponse.json(
        {
          error: 'تعذر تحميل بيانات الآيات للرواية.',
          riwaya,
          page,
          status: quranResponse.status,
          details: details.slice(0, 1000),
        },
        { status: quranResponse.status },
      )
    }

    const data = await quranResponse.json()
    const ayahs = Array.isArray(data?.ayahs) ? data.ayahs : []
    const fontFile =
      typeof data?.fontFile === 'string' && data.fontFile.trim()
        ? data.fontFile.trim()
        : null

    if (!ayahs.length) {
      return NextResponse.json(
        {
          error: 'لم يتم العثور على آيات في هذه الصفحة.',
          riwaya,
          page,
        },
        { status: 404 },
      )
    }

    // الرواية النصية تُرسم مباشرة من بيانات الرواية المعتمدة.
    // لا نجري أي تخمين لأسماء ملفات صور خارجية ولا ننتظر HEAD متعددة.
    const svg = buildTextMushafSvg(
      riwaya,
      page,
      mushaf,
      fontFile,
    )

    return NextResponse.json(
      {
        success: true,
        mode: 'riwaya-text-svg',
        riwaya,
        page,
        ayahs,
        fontFile,
        mushafSource: 'quran-text',
        mushafEdition:
          mushaf.mushaf?.key ?? riwaya,
        svg,
        note:
          'يتم رسم صفحة الرواية من بيانات النص والكلمات وبدايات الصفحات والسطور الخاصة بالرواية نفسها دون اعتماد على أسماء ملفات صور غير ثابتة.',
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    )
  } catch (error) {
    const isAbort =
      error instanceof DOMException &&
      error.name === 'AbortError'

    console.error('MUSHAF RIWAYA TEXT ERROR:', error)

    return NextResponse.json(
      {
        error: isAbort
          ? 'انتهى وقت تحميل بيانات الرواية. حاول مرة أخرى.'
          : 'حدث خطأ أثناء تجهيز صفحة الرواية.',
        details:
          error instanceof Error ? error.message : String(error),
        riwaya,
        page,
      },
      { status: 500 },
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
