import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || ''
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id))
    return NextResponse.json({ error: 'INVALID_VIDEO_ID' }, { status: 400 })
  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`)
  endpoint.searchParams.set('format', 'json')
  try {
    const response = await fetch(endpoint, {
      next: { revalidate: 86400 },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    })
    if (!response.ok) return NextResponse.json({ id, title: '', author: '', available: false })
    const data = await response.json()
    return NextResponse.json({
      id,
      title: typeof data.title === 'string' ? data.title.slice(0, 400) : '',
      author: typeof data.author_name === 'string' ? data.author_name.slice(0, 200) : '',
      available: true,
    })
  } catch {
    return NextResponse.json({ id, title: '', author: '', available: false })
  }
}
