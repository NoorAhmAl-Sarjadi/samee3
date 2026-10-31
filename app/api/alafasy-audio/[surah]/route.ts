
import { NextResponse } from 'next/server'
import catalog from '@/lib/alafasy-riwayat-manifest.json'

export const dynamic = 'force-dynamic'

type Entry = {
  key: string
  tracks?: Record<string, string>
}

type RouteParams = {
  mushaf: string
  file: string
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<RouteParams>
  }
): Promise<NextResponse> {
  // Next.js 16 requires awaiting route params
  const { mushaf, file } = await params

  // Validate the requested audio filename
  const match = /^(\d{3})\.mp3$/.exec(file)

  if (!match) {
    return new NextResponse('Not found', {
      status: 404,
    })
  }

  const surah = Number(match[1])

  // Only allow Quran surahs 1 through 114
  if (
    !Number.isInteger(surah) ||
    surah < 1 ||
    surah > 114
  ) {
    return new NextResponse('Not found', {
      status: 404,
    })
  }

  // Find the requested verified mushaf
  const entries = catalog.entries as Entry[]

  const entry = entries.find(
    (item) => item.key === mushaf
  )

  if (!entry) {
    return new NextResponse('Mushaf not found', {
      status: 404,
    })
  }

  // Find the exact surah audio URL
  const target = entry.tracks?.[match[1]]

  if (!target) {
    return new NextResponse('Audio not found', {
      status: 404,
    })
  }

  try {
    const url = new URL(target)

    // Allow only secure public HTTPS URLs
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error('Invalid audio URL')
    }

    // Redirect player to the verified audio source
    return NextResponse.redirect(
      url.toString(),
      {
        status: 307,
        headers: {
          'Cache-Control':
            'public, max-age=3600',
        },
      }
    )
  } catch {
    return new NextResponse(
      'Invalid audio source',
      {
        status: 502,
      }
    )
  }
}
