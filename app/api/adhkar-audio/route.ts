import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_ORIGINS = [
  'https://download.tvquran.com',
  'https://d1.islamhouse.com',
  'https://cdn.jsdelivr.net',
  'https://archive.org',
]

function isAllowedUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_ORIGINS.includes(url.origin)
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const target = url.searchParams.get('url') || ''

  if (!target || !isAllowedUrl(target)) {
    return NextResponse.json({ ok: false, error: 'Invalid audio URL' }, { status: 400 })
  }

  try {
    const range = request.headers.get('range')
    const upstreamHeaders = new Headers({ Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5' })
    if (range) upstreamHeaders.set('Range', range)

    const response = await fetch(target, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!response.ok && response.status !== 206) {
      return NextResponse.json({ ok: false, error: `Upstream HTTP ${response.status}` }, { status: 502 })
    }

    const headers = new Headers()
    headers.set('Content-Type', response.headers.get('content-type') || 'audio/mpeg')
    headers.set('Accept-Ranges', response.headers.get('accept-ranges') || 'bytes')
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')

    for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
      const value = response.headers.get(name)
      if (value) headers.set(name, value)
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('adhkar-audio proxy error:', error)
    return NextResponse.json({ ok: false, error: 'Audio proxy failed' }, { status: 502 })
  }
}
