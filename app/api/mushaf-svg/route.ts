import { NextRequest, NextResponse } from 'next/server'
import index from '@/data/mushaf/index.json'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type PrintedRiwaya = 'hafs' | 'warsh' | 'qalun' | 'douri' | 'shubah'
type TextRiwaya = 'sousi' | 'bazzi'
type Riwaya = PrintedRiwaya | TextRiwaya
type PrintedEdition = 'hafs-kfqc' | 'warsh-kfqc' | 'qalon-kfqc' | 'douri-kfqc' | 'shubah-kfqc'
const EDITIONS: Record<PrintedRiwaya, PrintedEdition> = { hafs: 'hafs-kfqc', warsh: 'warsh-kfqc', qalun: 'qalon-kfqc', douri: 'douri-kfqc', shubah: 'shubah-kfqc' }
const BASE_URL = 'https://cdn.quran.ws/svg/pages/v1.1.1'
const REQUEST_TIMEOUT = 15000
function escapeXml(value: string | number) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function isPrintedRiwaya(value: string): value is PrintedRiwaya { return Object.hasOwn(EDITIONS, value) }
function isRiwaya(value: string): value is Riwaya { return isPrintedRiwaya(value) || value === 'sousi' || value === 'bazzi' }
function isValidPage(page: number) { return Number.isInteger(page) && page >= 1 && page <= 604 }
function preparePrintedMushafSvg(
  rawSvg: string,
  edition: PrintedEdition,
  page: number,
): string {
  let svg = rawSvg
    .replace(/^\s*<\?xml[^>]*\?>/i, '')
    .replace(/^\s*<!DOCTYPE[^>]*>/i, '')
    .trim()

  const openingSvgMatch = svg.match(/<svg\b[^>]*>/i)
  if (!openingSvgMatch) {
    throw new Error('المصدر المرئي لا يحتوي على عنصر SVG رئيسي صالح.')
  }

  const openingSvg = openingSvgMatch[0]
  const hasMushafAttr = /\bdata-mushaf=\"/i.test(openingSvg)
  const hasPageAttr = /\bdata-page=\"/i.test(openingSvg)

  let normalizedOpeningSvg = openingSvg

  if (!hasMushafAttr) {
    normalizedOpeningSvg = normalizedOpeningSvg.replace(
      /<svg\b/i,
      `<svg data-mushaf=\"${escapeXml(edition)}\"`,
    )
  }

  if (!hasPageAttr) {
    normalizedOpeningSvg = normalizedOpeningSvg.replace(
      /<svg\b/i,
      `<svg data-page=\"${escapeXml(page)}\"`,
    )
  }

  const interactionStyle = `
<style id=\"samee3-mushaf-interaction\">
  /*
   * Quran SVG يأتي وفيه مسار دقيق لكل آية.
   * في بعض الروايات تكون طبقة الحروف أعلى من طبقة الآيات،
   * لذلك نعطل pointer-events عن محتوى الرسم ونُبقيها للـayahPolygon فقط.
   */
  #content,
  #content *,
  #ayah_markers,
  #ayah_markers * {
    pointer-events: none !important;
  }

  .ayahPolygon {
    pointer-events: all !important;
    cursor: pointer;
    fill: #c7934f !important;
    fill-opacity: 0 !important;
    stroke: none;
  }

  .ayahPolygon.samee3-pressed-ayah {
    fill: #c7934f !important;
    fill-opacity: .10 !important;
    stroke: none !important;
  }

  .ayahPolygon.samee3-playing-ayah {
    fill: #c7934f !important;
    fill-opacity: .20 !important;
    stroke: #c7934f !important;
    stroke-opacity: .26 !important;
    stroke-width: 2px !important;
  }
</style>`

  svg = svg.replace(openingSvg, normalizedOpeningSvg)

  if (/<\/svg>\s*$/i.test(svg)) {
    svg = svg.replace(/<\/svg>\s*$/i, `${interactionStyle}\n</svg>`)
  } else {
    svg += interactionStyle
  }

  return svg.trim()
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

      const rawSvg = (await response.text()).trim()

      if (!rawSvg || !rawSvg.includes('<svg')) {
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

      const svg = preparePrintedMushafSvg(
        rawSvg,
        edition,
        page,
      )

      return NextResponse.json(
        {
          success: true,
          mode: 'printed-svg',
          riwaya,
          edition,
          page,
          svg,
          interaction: {
            ayahLayer: 'ayahPolygon',
            geometry: 'per-ayah-polygon',
          },
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


  const size = index[riwaya][page - 1]
  const imageUrl = `/api/mushaf-riwaya-image?riwaya=${riwaya}&page=${page}&v=5`
  // Original glyph outlines, with no guessed ayah hit regions. Exact selection is
  // provided by the responsive text view using the riwaya's own ayah metadata.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" data-samee3-real-riwaya="true" data-samee3-riwaya="${riwaya}"><image href="${imageUrl.replace(/&/g, '&amp;')}" width="${size.width}" height="${size.height}" /></svg>`
  return NextResponse.json({ success: true, mode: 'local-original-page', riwaya, page, svg, imageUrl, interaction: { geometry: 'text-view' } }, { headers: { 'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400' } })
}
