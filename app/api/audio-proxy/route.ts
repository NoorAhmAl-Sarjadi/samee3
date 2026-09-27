import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * مصادر الصوت المسموح بها داخل البروكسي.
 * لا يسمح المسار بتمرير روابط عشوائية لتقليل مخاطر SSRF.
 */
const ALLOWED_HOSTS = new Set([
  'd1.islamhouse.com',
  'archive.org',
  'www.archive.org',
  'server03.quran-uni.com',
])

function isAllowedAudioUrl(value: string) {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:') return false

    return (
      ALLOWED_HOSTS.has(url.hostname) ||
      /^ia\d+\.us\.archive\.org$/i.test(url.hostname)
    )
  } catch {
    return false
  }
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name)
  if (value) target.set(name, value)
}

async function handleAudio(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('url')?.trim() || ''

  if (!source) {
    return NextResponse.json(
      { error: 'رابط الصوت مطلوب.' },
      { status: 400 },
    )
  }

  if (!isAllowedAudioUrl(source)) {
    return NextResponse.json(
      { error: 'مصدر الصوت غير مسموح به داخل البروكسي.' },
      { status: 400 },
    )
  }

  const sourceUrl = new URL(source)
  const upstreamHeaders = new Headers({
    Accept: 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/*;q=0.9,*/*;q=0.5',
    'Accept-Encoding': 'identity',
    'User-Agent': 'SAMEE3/1.0 audio proxy',
  })

  if (sourceUrl.hostname.endsWith('islamhouse.com')) {
    upstreamHeaders.set('Referer', 'https://islamhouse.com/')
    upstreamHeaders.set('Origin', 'https://islamhouse.com')
  }

  const range = request.headers.get('range')
  if (range) upstreamHeaders.set('Range', range)

  try {
    const upstream = await fetch(sourceUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        {
          error: 'تعذر جلب الملف الصوتي من المصدر.',
          status: upstream.status,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      )
    }

    const responseHeaders = new Headers()
    copyHeader(upstream.headers, responseHeaders, 'Content-Type')
    copyHeader(upstream.headers, responseHeaders, 'Content-Length')
    copyHeader(upstream.headers, responseHeaders, 'Content-Range')
    copyHeader(upstream.headers, responseHeaders, 'Accept-Ranges')
    copyHeader(upstream.headers, responseHeaders, 'Content-Disposition')
    copyHeader(upstream.headers, responseHeaders, 'ETag')
    copyHeader(upstream.headers, responseHeaders, 'Last-Modified')

    if (!responseHeaders.has('Content-Type')) {
      responseHeaders.set('Content-Type', 'audio/mpeg')
    }

    responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin')

    if (request.method === 'HEAD') {
      return new NextResponse(null, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('SAMEE3 audio proxy error:', error)

    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاتصال بمصدر الصوت.' },
      { status: 502 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handleAudio(request)
}

export async function HEAD(request: NextRequest) {
  return handleAudio(request)
}