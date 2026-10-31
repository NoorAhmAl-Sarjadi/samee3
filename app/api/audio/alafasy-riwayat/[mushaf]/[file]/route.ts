
import { NextResponse } from 'next/server'
import catalog from '@/lib/alafasy-riwayat-manifest.json'

export const dynamic = 'force-dynamic'

type Entry = {
  key: string
  tracks?: Record<string, string>
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: {
      mushaf: string
      file: string
    }
  }
) {
  const match = /^(\d{3})\.mp3$/.exec(params.file)

  if (!match) {
    return new NextResponse('Not found', {
      status: 404,
    })
  }

  const surah = Number(match[1])

  if (surah < 1 || surah > 114) {
    return new NextResponse('Not found', {
      status: 404,
    })
  }

  const entry = (catalog.entries as Entry[]).find(
    item => item.key === params.mushaf
  )

  const target = entry?.tracks?.[match[1]]

  if (!target) {
    return new NextResponse('Not found', {
      status: 404,
    })
  }

  try {
    const url = new URL(target)

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password
    ) {
      throw new Error('Unsafe URL')
    }

    return NextResponse.redirect(
      url.toString(),
      {
        status: 307,
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    )
  } catch {
    return new NextResponse(
      'Invalid audio source',
      { status: 502 }
    )
  }
}
