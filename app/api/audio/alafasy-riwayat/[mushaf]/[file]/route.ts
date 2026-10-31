
import { NextResponse } from 'next/server'
import catalog from '@/lib/alafasy-riwayat-manifest.json'

export const dynamic = 'force-dynamic'

type Entry = {
  key?: string
  tracks?: Record<string, string>
}

type Context = {
  params: Promise<{
    mushaf: string
    file: string
  }>
}

export async function GET(
  _request: Request,
  { params }: Context
): Promise<Response> {
  const { mushaf, file } = await params

  const match = /^(\d{3})\.mp3$/.exec(file)

  if (!match) {
    return new NextResponse(
      'Invalid surah file',
      { status: 404 }
    )
  }

  const surah = Number(match[1])

  if (surah < 1 || surah > 114) {
    return new NextResponse(
      'Invalid surah file',
      { status: 404 }
    )
  }

  const items = catalog.entries as Entry[]

  const entry = items.find(
    (item) => item.key === mushaf
  )

  const target = entry?.tracks?.[match[1]]

  if (!target) {
    return new NextResponse(
      'Verified audio not available',
      { status: 404 }
    )
  }

  try {
    const destination = new URL(target)

    if (
      destination.protocol !== 'https:' ||
      destination.username ||
      destination.password
    ) {
      return new NextResponse(
        'Invalid audio source',
        { status: 502 }
      )
    }

    return NextResponse.redirect(destination, {
      status: 307,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse(
      'Invalid audio source',
      { status: 502 }
    )
  }
}
