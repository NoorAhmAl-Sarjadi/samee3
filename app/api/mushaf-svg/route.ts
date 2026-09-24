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
  const fontFamily =
    riwaya === 'sousi'
      ? 'KFGQPC Sousi Uthmanic Script'
      : 'KFGQPC Bazzi Uthmanic Script'

  const safeFontFile = fontFile?.trim() || ''

  const lines: Array<{
    text: string
    surah: string
    ayah: string
  }> = []

  // صفحة المصحف على الهاتف/سطح المكتب تحافظ على مظهر 15 سطرًا تقريبًا.
  // نكسر النص على حدود الكلمات، ولا نقطع الكلمة نفسها.
  const MAX_CHARS_PER_LINE = 46

  for (const item of ayahs) {
    const text = getAyahText(item)
    if (!text) continue

    const words = text.split(/\s+/).filter(Boolean)
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && candidate.length > MAX_CHARS_PER_LINE) {
        lines.push({
          text: current,
          surah: getSurahNumber(item),
          ayah: getAyahNumber(item),
        })
        current = word
      } else {
        current = candidate
      }
    }

    if (current) {
      lines.push({
        text: current,
        surah: getSurahNumber(item),
        ayah: getAyahNumber(item),
      })
    }
  }

  const visibleLines = lines
  const usableHeight = 1070
  const lineHeight = Math.max(42, Math.min(78, usableHeight / Math.max(visibleLines.length, 1)))
  const fontSize = Math.max(27, Math.min(46, lineHeight * 0.68))
  const startY = 165

  const textNodes = visibleLines
    .map((line, index) => {
      const y = startY + index * lineHeight
      const label =
        line.surah && line.ayah
          ? `${line.surah}:${line.ayah}`
          : ''

      return `
        <g data-ayah="${escapeXml(label)}" data-surah="${escapeXml(line.surah)}" data-ayah-number="${escapeXml(line.ayah)}">
          <text
            x="500"
            y="${y}"
            text-anchor="middle"
            direction="rtl"
            unicode-bidi="plaintext"
            class="samee3-quran-line"
          >${escapeXml(line.text)}</text>
        </g>`
    })
    .join('')

  const fontStyle = safeFontFile
    ? `
      @font-face {
        font-family: '${fontFamily}';
        src: url('${escapeXml(safeFontFile)}') format('truetype');
        font-display: swap;
      }
    `
    : ''

  return `
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 1000 1414"
     preserveAspectRatio="xMidYMid meet"
     role="img"
     aria-label="صفحة المصحف ${escapeXml(page)} — ${escapeXml(riwaya)}">
  <style>
    ${fontStyle}
    .samee3-page {
      fill: #fcfbf8;
      stroke: #c9b47a;
      stroke-width: 4;
    }
    .samee3-inner {
      fill: none;
      stroke: #dfcf9e;
      stroke-width: 2;
    }
    .samee3-quran-line {
      font-family: '${fontFamily}', 'Amiri Quran', 'Amiri', serif;
      font-size: ${fontSize}px;
      font-weight: 400;
      fill: #18202a;
      letter-spacing: 0;
    }
    .samee3-page-title {
      font-family: 'Aref Ruqaa', 'Amiri', serif;
      font-size: 30px;
      font-weight: 700;
      fill: #8b6227;
    }
    .samee3-page-number {
      font-family: 'Amiri', serif;
      font-size: 24px;
      font-weight: 700;
      fill: #8b6227;
    }
  </style>

  <rect class="samee3-page" x="10" y="10" width="980" height="1394" rx="18"/>
  <rect class="samee3-inner" x="28" y="28" width="944" height="1358" rx="12"/>

  <path d="M90 105 H910" stroke="#d8c48f" stroke-width="2"/>
  <text x="500" y="88" text-anchor="middle" class="samee3-page-title">
    ${riwaya === 'sousi' ? 'السوسي عن أبي عمرو' : 'البزي عن ابن كثير'}
  </text>

  <g>
    ${textNodes}
  </g>

  <path d="M90 1300 H910" stroke="#d8c48f" stroke-width="2"/>
  <text x="500" y="1345" text-anchor="middle" class="samee3-page-number">
    ${escapeXml(page.toLocaleString('ar-EG'))}
  </text>
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