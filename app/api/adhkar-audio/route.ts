import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_AUDIO_HOSTS = new Set([
  'archive.org',
  'www.archive.org',
  'd1.islamhouse.com',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com',
])

function isAllowedAudioUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_AUDIO_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name)
  if (value) target.set(name, value)
}

async function handleAudio(request: Request) {
  const { searchParams } = new URL(request.url)
  const encodedUrl = searchParams.get('url')

  if (!encodedUrl || !isAllowedAudioUrl(encodedUrl)) {
    return NextResponse.json(
      { ok: false, error: 'رابط صوت غير مسموح.' },
      { status: 400 },
    )
  }

  let upstream: Response

  try {
    const requestHeaders = new Headers()
    const range = request.headers.get('range')
    const ifRange = request.headers.get('if-range')

    if (range) requestHeaders.set('Range', range)
    if (ifRange) requestHeaders.set('If-Range', ifRange)
    requestHeaders.set('Accept', 'audio/mpeg,audio/*;q=0.9,*/*;q=0.1')
    requestHeaders.set('User-Agent', 'SAMEE3-adhkar-audio/1.0')

    upstream = await fetch(encodedUrl, {
      method: 'GET',
      headers: requestHeaders,
      redirect: 'follow',
      cache: 'no-store',
    })
  } catch (error) {
    console.error('Adhkar audio upstream error:', error)
    return NextResponse.json(
      { ok: false, error: 'تعذر الوصول إلى الملف الصوتي.' },
      { status: 502 },
    )
  }

  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
    return NextResponse.json(
      { ok: false, error: `الملف الصوتي أعاد الحالة ${upstream.status}.` },
      { status: 502 },
    )
  }

  if (!upstream.body) {
    return NextResponse.json(
      { ok: false, error: 'لم يرجع الخادم محتوى صوتيًا.' },
      { status: 502 },
    )
  }

  const headers = new Headers()
  copyHeader(upstream.headers, headers, 'content-type')
  copyHeader(upstream.headers, headers, 'content-length')
  copyHeader(upstream.headers, headers, 'content-range')
  copyHeader(upstream.headers, headers, 'accept-ranges')
  copyHeader(upstream.headers, headers, 'etag')
  copyHeader(upstream.headers, headers, 'last-modified')
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  headers.set('Content-Disposition', 'inline')

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}

export async function GET(request: Request) {
  return handleAudio(request)
}
