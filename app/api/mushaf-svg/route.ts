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

function getAyahText(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const value = item as Record<string, unknown>
  return String(
    value.text ??
      value.ayah_text ??
      value.ayahText ??
      value.content ??
      '',
  ).trim()
}

function getAyahNumber(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const value = item as Record<string, unknown>
  return String(
    value.numberInSurah ??
      value.ayah ??
      value.ayahNumber ??
      value.number ??
      '',
  )
}

function getSurahNumber(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const value = item as Record<string, unknown>
  const surah = value.surah

  if (surah && typeof surah === 'object') {
    const record = surah as Record<string, unknown>
    return String(record.number ?? record.id ?? '')
  }

  return String(
    value.surahNumber ??
      value.surah_id ??
      value.surahId ??
      '',
  )
}

/**
 * SVG احتياطي أنيق للروايتين السوسي والبزي.
 * النص نفسه يأتي من /api/quran الخاص بالرواية، وليس من حفص.
 * هذا يحافظ على هوية الرواية إلى أن تُستخدم طبقة العرض النصية في page.tsx.
 */
function buildTextMushafSvg(
  riwaya: TextRiwaya,
  page: number,
  ayahs: unknown[],
  fontFile: string | null,
) {
  const fallbackFontFile =
    riwaya === 'sousi'
      ? 'https://cdn.jsdelivr.net/gh/thetruetruth/quran-data-kfgqpc@main/soosi/font/soosi.9.woff2'
      : 'https://cdn.jsdelivr.net/gh/thetruetruth/quran-data-kfgqpc@main/bazzi/font/bazzi.7.woff2'

  const fontFamily = riwaya === 'sousi' ? 'soosi9' : 'bazzi7'
  const safeFontFile = fontFile?.trim() || fallbackFontFile

  type Token = {
    text: string
    surah: string
    ayah: string
    isEnd: boolean
  }

  const tokens: Token[] = []

  for (const item of ayahs) {
    const text = getAyahText(item)
    if (!text) continue

    const surah = getSurahNumber(item)
    const ayah = getAyahNumber(item)
    const words = text.split(/\s+/).filter(Boolean)

    words.forEach((word, index) => {
      tokens.push({
        text: word,
        surah,
        ayah,
        isEnd: index === words.length - 1,
      })
    })
  }

  // الصفحة المصحفية المرئية للسوسي والبزي تكون 15 سطرًا مثل صفحات
  // المصحف المطبوعة، مع الحفاظ على النص الحقيقي للرواية وعدم استبداله.
  const targetLines = 15
  const totalChars = tokens.reduce((sum, token) => sum + token.text.length + 1, 0)
  const targetCharsPerLine = Math.max(24, Math.ceil(totalChars / targetLines))

  type Line = { tokens: Token[]; chars: number }
  const lines: Line[] = []
  let current: Line = { tokens: [], chars: 0 }

  for (const token of tokens) {
    const nextChars = current.chars + token.text.length + (current.tokens.length ? 1 : 0)

    if (current.tokens.length && nextChars > targetCharsPerLine && lines.length < targetLines - 1) {
      lines.push(current)
      current = { tokens: [], chars: 0 }
    }

    current.tokens.push(token)
    current.chars += token.text.length + (current.tokens.length > 1 ? 1 : 0)
  }

  if (current.tokens.length) lines.push(current)

  while (lines.length > targetLines) {
    let mergeIndex = 0
    let smallest = Number.POSITIVE_INFINITY

    for (let i = 0; i < lines.length - 1; i += 1) {
      const combined = lines[i].chars + lines[i + 1].chars
      if (combined < smallest) {
        smallest = combined
        mergeIndex = i
      }
    }

    const mergedTokens = [
      ...lines[mergeIndex].tokens,
      ...lines[mergeIndex + 1].tokens,
    ]
    const chars = mergedTokens.reduce(
      (sum, token, index) => sum + token.text.length + (index ? 1 : 0),
      0,
    )

    lines.splice(mergeIndex, 2, { tokens: mergedTokens, chars })
  }

  // لو حصل تكديس بسبب اختلاف أطوال الآيات، نعيد توزيع السطور الأخيرة
  // بحيث تظل الصفحة هادئة ومتوازنة بدل أن تصغر الكتابة فجأة.
  while (lines.length < targetLines) {
    const largestIndex = lines.reduce(
      (best, line, index, arr) => line.chars > arr[best].chars ? index : best,
      0,
    )
    const largest = lines[largestIndex]
    if (largest.tokens.length < 3) break

    const splitAt = Math.ceil(largest.tokens.length / 2)
    const firstTokens = largest.tokens.slice(0, splitAt)
    const secondTokens = largest.tokens.slice(splitAt)
    const calcChars = (items: Token[]) => items.reduce((sum, token, i) => sum + token.text.length + (i ? 1 : 0), 0)

    lines.splice(
      largestIndex,
      1,
      { tokens: firstTokens, chars: calcChars(firstTokens) },
      { tokens: secondTokens, chars: calcChars(secondTokens) },
    )
  }

  const viewWidth = 382.68
  const viewHeight = 547.09
  const textTop = 92
  const textBottom = 505
  const lineHeight = (textBottom - textTop) / Math.max(targetLines - 1, 1)
  const fontSize = 18.8

  const textNodes = lines.slice(0, targetLines).map((line, index) => {
    const y = textTop + index * lineHeight
    const content = line.tokens.map((token, tokenIndex) => {
      const marker = token.isEnd
        ? ` <tspan class="samee3-ayah-marker">۝${escapeXml(token.ayah)}</tspan>`
        : ''
      const key = `${token.surah}:${token.ayah}`
      return `<tspan class="samee3-ayah" data-ayah="${escapeXml(key)}" data-surah="${escapeXml(token.surah)}" data-ayah-number="${escapeXml(token.ayah)}">${escapeXml(token.text)}${marker}</tspan>${tokenIndex < line.tokens.length - 1 ? ' ' : ''}`
    }).join('')

    return `<text x="${viewWidth / 2}" y="${y.toFixed(2)}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" class="samee3-quran-line">${content}</text>`
  }).join('')

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
      font-family: '${fontFamily}';
      src: url('${escapeXml(safeFontFile)}') format('${fontFormat}');
      font-display: swap;
    }
  `

  return `
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${viewWidth} ${viewHeight}"
     preserveAspectRatio="xMidYMid meet"
     role="img"
     aria-label="صفحة المصحف ${escapeXml(page)}">
  <style>
    ${fontStyle}
    .samee3-quran-line {
      font-family: '${fontFamily}', 'Amiri Quran', 'Amiri', serif;
      font-size: ${fontSize}px;
      font-weight: 400;
      fill: #171717;
      letter-spacing: 0;
      word-spacing: 0;
    }
    .samee3-ayah { cursor:pointer; }
    .samee3-ayah-marker {
      font-family: '${fontFamily}', 'Amiri Quran', 'Amiri', serif;
      font-size: 0.62em;
      fill: #9a753e;
    }
  </style>
  <rect x="0" y="0" width="${viewWidth}" height="${viewHeight}" fill="#fffdf7"/>
  <g id="samee3-quran-content">${textNodes}</g>
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
  // السوسي والبزي: نستخدم بيانات الرواية الحقيقية من /api/quran.
  // لا نستخدم صفحة حفص أو الدوري كبديل.
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

    const response = await fetch(apiUrl, {
      method: 'GET',
      cache: 'force-cache',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')

      return NextResponse.json(
        {
          error: 'تعذر تحميل بيانات الرواية.',
          riwaya,
          page,
          status: response.status,
          details: details.slice(0, 1000),
        },
        { status: response.status },
      )
    }

    const data = await response.json()
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

    const svg = buildTextMushafSvg(
      riwaya,
      page,
      ayahs,
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
        svg,
        source: '/api/quran',
        note:
          'هذه صفحة مرسومة من نص الرواية الحقيقي وخطها، وليست نسخة من مصحف رواية أخرى.',
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