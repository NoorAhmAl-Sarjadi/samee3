import { NextRequest, NextResponse } from 'next/server'
import { getHumanBookAudio } from '@/lib/hadith-human-audio'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const bookId = request.nextUrl.searchParams.get('book')?.trim() || ''

  if (!bookId) {
    return NextResponse.json(
      {
        error: 'معرّف الكتاب مطلوب.',
        example: '/api/hadith-audio?book=bukhari',
      },
      { status: 400 },
    )
  }

  const collection = getHumanBookAudio(bookId)

  if (!collection || collection.tracks.length === 0) {
    return NextResponse.json({
      bookId,
      available: false,
      kind: null,
      organization: null,
      label: '',
      sourceUrl: '',
      tracks: [],
    })
  }

  const tracks = collection.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    url: track.url,
    label: track.label || 'تسجيل بشري من المصدر الأصلي',
    sourceUrl: track.sourceUrl || collection.sourceUrl,
    isIntroduction: Boolean(track.isIntroduction),
    startSeconds: track.startSeconds,
    endSeconds: track.endSeconds,
  }))

  return NextResponse.json({
    bookId,
    available: true,
    kind: collection.kind,
    organization: collection.organization,
    label: collection.label,
    sourceUrl: collection.sourceUrl,
    tracks,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}