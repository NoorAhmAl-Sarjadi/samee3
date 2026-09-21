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

function isPrintedRiwaya(value: string): value is PrintedRiwaya {
  return value in EDITIONS
}

export async function GET(request: NextRequest) {
  const riwaya = (request.nextUrl.searchParams.get('riwaya') || 'hafs').toLowerCase()
  const page = Number(request.nextUrl.searchParams.get('page') || '1')

  if (!isPrintedRiwaya(riwaya)) {
    return NextResponse.json(
      {
        error: 'هذه الرواية لا تملك صفحة مصحف مرئية في المستودع الحالي.',
        supported: Object.keys(EDITIONS),
      },
      { status: 400 }
    )
  }

  if (!Number.isInteger(page) || page < 1 || page > 604) {
    return NextResponse.json(
      { error: 'رقم الصفحة غير صحيح.', page },
      { status: 400 }
    )
  }

  try {
    const edition = EDITIONS[riwaya]
    const url = `${BASE_URL}/${edition}/${String(page).padStart(3, '0')}.svg`

    const response = await fetch(url, {
      cache: 'force-cache',
      headers: {
        Accept: 'image/svg+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'تعذر تحميل صفحة المصحف من المصدر المرئي.',
          status: response.status,
        },
        { status: response.status }
      )
    }

    const svg = await response.text()

    if (!svg.includes('<svg')) {
      return NextResponse.json(
        { error: 'المصدر لم يرجع SVG صالحًا.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        riwaya,
        edition,
        page,
        svg,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error('MUSHAF SVG ERROR:', error)

    return NextResponse.json(
      {
        error: 'حدث خطأ أثناء تحميل صفحة المصحف.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
