import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PrintedRiwaya =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'

const EDITIONS: Record<PrintedRiwaya, string> = {
  hafs: 'hafs-kfqc',
  warsh: 'warsh-kfqc',
  qalun: 'qalon-kfqc',
  douri: 'douri-kfqc',
  shubah: 'shubah-kfqc',
}

const BASE_URL = 'https://cdn.quran.ws/svg/pages/v1.1.1'

const REQUEST_TIMEOUT = 15_000

function isPrintedRiwaya(
  value: string
): value is PrintedRiwaya {
  return value in EDITIONS
}

function isValidPage(
  page: number
): boolean {
  return (
    Number.isInteger(page) &&
    page >= 1 &&
    page <= 604
  )
}

export async function GET(
  request: NextRequest
) {
  const searchParams =
    request.nextUrl.searchParams

  const riwaya = (
    searchParams.get('riwaya') ||
    'hafs'
  ).toLowerCase()

  const page = Number(
    searchParams.get('page') || '1'
  )

  // =========================================================
  // التحقق من الرواية
  // =========================================================

  if (!isPrintedRiwaya(riwaya)) {
    return NextResponse.json(
      {
        error:
          'هذه الرواية لا تملك صفحة مصحف مرئية في المصدر الحالي.',
        supported:
          Object.keys(EDITIONS),
      },
      {
        status: 400,
      }
    )
  }

  // =========================================================
  // التحقق من رقم الصفحة
  // =========================================================

  if (!isValidPage(page)) {
    return NextResponse.json(
      {
        error:
          'رقم الصفحة غير صحيح.',
        page,
      },
      {
        status: 400,
      }
    )
  }

  const edition =
    EDITIONS[riwaya]

  const filename =
    `${String(page).padStart(3, '0')}.svg`

  const url =
    `${BASE_URL}/${edition}/${filename}`

  // =========================================================
  // تحميل صفحة المصحف
  // =========================================================

  const controller =
    new AbortController()

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    )

  try {
    const response =
      await fetch(
        url,
        {
          method: 'GET',
          cache: 'force-cache',
          signal: controller.signal,
          headers: {
            Accept:
              'image/svg+xml,text/plain;q=0.9,*/*;q=0.8',
          },
        }
      )

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            'تعذر تحميل صفحة المصحف من المصدر المرئي.',
          status:
            response.status,
          riwaya,
          edition,
          page,
        },
        {
          status:
            response.status,
        }
      )
    }

    const svg =
      await response.text()

    // =========================================================
    // التحقق من صحة SVG
    // =========================================================

    const trimmedSvg =
      svg.trim()

    if (
      !trimmedSvg ||
      !trimmedSvg.includes('<svg')
    ) {
      return NextResponse.json(
        {
          error:
            'المصدر لم يرجع SVG صالحًا.',
          riwaya,
          edition,
          page,
        },
        {
          status: 502,
        }
      )
    }

    // =========================================================
    // إعادة الصفحة إلى Client
    // =========================================================

    return NextResponse.json(
      {
        success: true,
        riwaya,
        edition,
        page,
        svg: trimmedSvg,
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=31536000, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    const isAbort =
      error instanceof DOMException &&
      error.name === 'AbortError'

    console.error(
      'MUSHAF SVG ERROR:',
      error
    )

    return NextResponse.json(
      {
        error: isAbort
          ? 'انتهى وقت تحميل صفحة المصحف. حاول مرة أخرى.'
          : 'حدث خطأ أثناء تحميل صفحة المصحف.',
        details:
          error instanceof Error
            ? error.message
            : String(error),
        riwaya,
        edition,
        page,
      },
      {
        status: 500,
      }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
