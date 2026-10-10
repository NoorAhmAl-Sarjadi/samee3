
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * SAMEE3 audio proxy
 * Path: app/api/audio-proxy/route.ts
 *
 * Streams approved audio sources without downloading
 * files into server RAM.
 *
 * Every redirect is validated before the next request.
 */

const TRUSTED_HOSTS = new Set([
  'd1.islamhouse.com',
  'archive.org',
  'www.archive.org',
  'server03.quran-uni.com',
])

const MAX_REDIRECTS = 4
const CONNECT_TIMEOUT_MS = 15000
const MAX_URL_LENGTH = 4096

const AUDIO_MIME_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
  'application/ogg',
  'video/mp4',
  'video/webm',
])

function validSource(value: string): URL | null {
  if (!value || value.length > MAX_URL_LENGTH) {
    return null
  }

  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()

    if (
      url.protocol !== 'https:' ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      url.hash !== '' ||
      hostname.endsWith('.')
    ) {
      return null
    }

    if (
      !TRUSTED_HOSTS.has(hostname) &&
      !/^ia\d+\.us\.archive\.org$/.test(hostname)
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

function validRange(value: string | null): boolean {
  if (!value) return true
  if (value.length > 100) return false

  const match = /^bytes=(\d*)-(\d*)$/.exec(
    value.trim(),
  )

  return Boolean(
    match && (match[1] || match[2]),
  )
}

function isAudioResponse(
  response: Response,
  url: URL,
): boolean {
  const type = (
    response.headers.get('content-type') || ''
  )
    .split(';')[0]
    .trim()
    .toLowerCase()

  if (type) {
    return (
      type.startsWith('audio/') ||
      AUDIO_MIME_TYPES.has(type)
    )
  }

  // Some providers omit Content-Type.
  // Only then, use the file extension.
  return /\.(?:mp3|m4a|aac|ogg|opus|wav|flac|webm|mp4)$/i.test(
    url.pathname,
  )
}

function copyResponseHeader(
  source: Headers,
  target: Headers,
  name: string,
): void {
  const value = source.get(name)

  if (value !== null) {
    target.set(name, value)
  }
}

function upstreamRequestHeaders(
  url: URL,
  range: string | null,
): Headers {
  const headers = new Headers({
    Accept:
      'audio/*,application/octet-stream;q=0.9,*/*;q=0.3',
    'Accept-Encoding': 'identity',
    'User-Agent': 'SAMEE3/1.0 audio proxy',
  })

  if (range) {
    headers.set('Range', range)
  }

  if (url.hostname === 'd1.islamhouse.com') {
    headers.set(
      'Referer',
      'https://islamhouse.com/',
    )
    headers.set(
      'Origin',
      'https://islamhouse.com',
    )
  }

  return headers
}

/**
 * Limits the time required to receive response headers.
 * Does not impose a short timeout on the entire MP3 stream.
 */
async function fetchHeaders(
  url: URL,
  method: 'GET' | 'HEAD',
  range: string | null,
  requestSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()

  const abortFromClient = () => {
    controller.abort()
  }

  const timeout = setTimeout(
    () => controller.abort(),
    CONNECT_TIMEOUT_MS,
  )

  requestSignal.addEventListener(
    'abort',
    abortFromClient,
    { once: true },
  )

  try {
    if (requestSignal.aborted) {
      controller.abort()
    }

    return await fetch(url.href, {
      method,
      headers: upstreamRequestHeaders(
        url,
        range,
      ),
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)

    requestSignal.removeEventListener(
      'abort',
      abortFromClient,
    )
  }
}

/**
 * Close an unused response body.
 * Important when rejecting redirects and error responses.
 */
async function discard(
  response: Response,
): Promise<void> {
  try {
    if (response.body) {
      await response.body.cancel()
    }
  } catch {
    // The upstream connection may already be closed.
  }
}

type UpstreamResult =
  | {
      ok: true
      response: Response
      url: URL
    }
  | {
      ok: false
      status: number
      error: string
    }

/**
 * Follows only explicitly approved redirects.
 *
 * No redirect is fetched until its URL passes
 * the same source validation as the original URL.
 */
async function connectToAudio(
  initialUrl: URL,
  method: 'GET' | 'HEAD',
  range: string | null,
  requestSignal: AbortSignal,
): Promise<UpstreamResult> {
  let current = initialUrl

  const visited = new Set<string>()

  for (
    let hop = 0;
    hop <= MAX_REDIRECTS;
    hop += 1
  ) {
    if (visited.has(current.href)) {
      return {
        ok: false,
        status: 502,
        error:
          'تم اكتشاف حلقة تحويل في رابط الصوت.',
      }
    }

    visited.add(current.href)

    const response = await fetchHeaders(
      current,
      method,
      range,
      requestSignal,
    )

    const redirectStatuses = [
      301,
      302,
      303,
      307,
      308,
    ]

    if (
      redirectStatuses.includes(response.status)
    ) {
      const location =
        response.headers.get('location')

      await discard(response)

      if (
        !location ||
        hop === MAX_REDIRECTS
      ) {
        return {
          ok: false,
          status: 502,
          error:
            'عدد تحويلات مصدر الصوت أكبر من المسموح.',
        }
      }

      let next: URL | null = null

      try {
        next = validSource(
          new URL(location, current).href,
        )
      } catch {
        next = null
      }

      if (!next) {
        return {
          ok: false,
          status: 502,
          error:
            'حوّل مصدر الصوت الطلب إلى عنوان غير مسموح.',
        }
      }

      current = next
      continue
    }

    return {
      ok: true,
      response,
      url: current,
    }
  }

  return {
    ok: false,
    status: 502,
    error:
      'تعذر الوصول إلى ملف الصوت.',
  }
}

/**
 * Shared handler for GET and HEAD.
 *
 * Streams the upstream response to the client
 * without loading the entire audio file into RAM.
 */
async function proxyAudio(
  request: NextRequest,
): Promise<NextResponse> {
  const raw =
    request.nextUrl.searchParams
      .get('url')
      ?.trim() || ''

  const source = validSource(raw)

  if (!source) {
    return NextResponse.json(
      {
        error: raw
          ? 'رابط الصوت غير مسموح أو غير صالح.'
          : 'رابط الصوت مطلوب.',
      },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const range = request.headers.get('range')

  if (!validRange(range)) {
    return NextResponse.json(
      {
        error:
          'صيغة طلب الجزء الصوتي Range غير صالحة.',
      },
      {
        status: 416,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const method: 'GET' | 'HEAD' =
    request.method === 'HEAD'
      ? 'HEAD'
      : 'GET'

  try {
    const upstream = await connectToAudio(
      source,
      method,
      range,
      request.signal,
    )

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: upstream.error,
        },
        {
          status: upstream.status,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const { response, url } = upstream

    // Preserve a valid HTTP 416 response.
    if (response.status === 416) {
      const headers = new Headers({
        'Cache-Control': 'no-store',
      })

      copyResponseHeader(
        response.headers,
        headers,
        'Content-Range',
      )

      copyResponseHeader(
        response.headers,
        headers,
        'Accept-Ranges',
      )

      await discard(response)

      return new NextResponse(null, {
        status: 416,
        headers,
      })
    }

    // Only completed or partial audio responses are accepted.
    if (
      response.status !== 200 &&
      response.status !== 206
    ) {
      const notFound =
        response.status === 404

      await discard(response)

      return NextResponse.json(
        {
          error: notFound
            ? 'التسجيل الصوتي غير موجود في المصدر.'
            : 'تعذر جلب التسجيل الصوتي من المصدر.',
        },
        {
          status: notFound ? 404 : 502,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const contentEncoding = (
      response.headers.get(
        'content-encoding',
      ) || 'identity'
    ).toLowerCase()

    if (
      !isAudioResponse(response, url) ||
      contentEncoding !== 'identity'
    ) {
      await discard(response)

      return NextResponse.json(
        {
          error:
            'الاستجابة ليست ملفًا صوتيًا صالحًا للتشغيل.',
        },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const headers = new Headers({
      'Cache-Control':
        'private, no-store',

      'X-Content-Type-Options':
        'nosniff',

      'Cross-Origin-Resource-Policy':
        'same-origin',
    })

    // Forward only headers required for audio playback.
    copyResponseHeader(
      response.headers,
      headers,
      'Content-Type',
    )

    copyResponseHeader(
      response.headers,
      headers,
      'Content-Length',
    )

    copyResponseHeader(
      response.headers,
      headers,
      'Content-Range',
    )

    copyResponseHeader(
      response.headers,
      headers,
      'Accept-Ranges',
    )

    copyResponseHeader(
      response.headers,
      headers,
      'ETag',
    )

    copyResponseHeader(
      response.headers,
      headers,
      'Last-Modified',
    )

    if (!headers.has('Content-Type')) {
      headers.set(
        'Content-Type',
        'audio/mpeg',
      )
    }

    // Metadata-only requests.
    if (method === 'HEAD') {
      await discard(response)

      return new NextResponse(null, {
        status: response.status,
        headers,
      })
    }

    // Stream the audio without buffering the complete file.
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    const interrupted =
      error instanceof Error &&
      error.name === 'AbortError'

    return NextResponse.json(
      {
        error: interrupted
          ? 'انتهت مهلة الاتصال بمصدر الصوت أو أُلغي الطلب.'
          : 'حدث خطأ أثناء الاتصال بمصدر الصوت.',
      },
      {
        status: interrupted ? 504 : 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  return proxyAudio(request)
}

export async function HEAD(
  request: NextRequest,
): Promise<NextResponse> {
  return proxyAudio(request)
}
