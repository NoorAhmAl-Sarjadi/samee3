
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * SAMEE3 — Adhkar Audio Proxy
 * Path: app/api/adhkar-audio/route.ts
 *
 * Secure audio streaming for Adhkar pages.
 * Supports Range, HEAD, approved redirects,
 * streaming and connection cancellation.
 */

const MAX_URL_LENGTH = 4096
const MAX_REDIRECTS = 5
const HEADERS_TIMEOUT_MS = 15000

const SOURCE_HOSTS = [
  'download.tvquran.com',
  'd1.islamhouse.com',
  'cdn.jsdelivr.net',
  'archive.org',
  'www.archive.org',
]

function isTrustedHost(host: string): boolean {
  return (
    SOURCE_HOSTS.includes(host) ||
    /^ia\d+\.us\.archive\.org$/.test(host)
  )
}

function parseTrustedUrl(value: string): URL | null {
  if (!value || value.length > MAX_URL_LENGTH) {
    return null
  }

  try {
    const url = new URL(value)

    if (
      url.protocol !== 'https:' ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      url.hash !== '' ||
      !isTrustedHost(url.hostname.toLowerCase())
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

function isValidRange(value: string | null): boolean {
  if (value === null) return true
  if (value.length > 80) return false

  const match = /^bytes=(\d*)-(\d*)$/.exec(
    value.trim(),
  )

  if (!match || (!match[1] && !match[2])) {
    return false
  }

  const start = match[1] ? Number(match[1]) : null
  const end = match[2] ? Number(match[2]) : null

  return (
    (start === null || Number.isSafeInteger(start)) &&
    (end === null || Number.isSafeInteger(end)) &&
    (start === null || end === null || start <= end) &&
    !(start === null && end === 0)
  )
}

function looksLikeAudio(
  response: Response,
  url: URL,
): boolean {
  const raw = response.headers.get('content-type')

  const mime =
    raw?.split(';')[0].trim().toLowerCase() || ''

  if (mime.startsWith('audio/')) {
    return true
  }

  if (
    mime === 'video/mp4' ||
    mime === 'video/webm'
  ) {
    return true
  }

  const audioFile =
    /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm|mp4)$/i.test(
      url.pathname,
    )

  return (
    audioFile &&
    (
      !mime ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream'
    )
  )
}

function errorResponse(
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

function copyHeader(
  source: Headers,
  output: Headers,
  key: string,
): void {
  const value = source.get(key)

  if (value !== null) {
    output.set(key, value)
  }
}

function makeUpstreamHeaders(
  range: string | null,
): Headers {
  const headers = new Headers({
    Accept:
      'audio/*,application/octet-stream;q=0.9,*/*;q=0.2',
    'Accept-Encoding': 'identity',
  })

  if (range) {
    headers.set('Range', range)
  }

  return headers
}

async function closeResponse(
  response: Response,
): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // The connection may already be closed.
  }
}

type Upstream = {
  response: Response
  finalUrl: URL
  controller: AbortController
  cleanup: () => void
}

/**
 * Connect to approved media servers.
 * Every redirect is validated independently.
 * A timeout applies while waiting for headers,
 * not during playback of the full recording.
 */
async function connect(
  initial: URL,
  method: 'GET' | 'HEAD',
  range: string | null,
  clientSignal: AbortSignal,
): Promise<Upstream> {
  const controller = new AbortController()

  const onClientAbort = () => {
    controller.abort()
  }

  clientSignal.addEventListener(
    'abort',
    onClientAbort,
    { once: true },
  )

  const cleanup = () => {
    clientSignal.removeEventListener(
      'abort',
      onClientAbort,
    )
  }

  let current = initial
  const visited = new Set<string>()

  try {
    if (clientSignal.aborted) {
      controller.abort()
    }

    for (
      let hops = 0;
      hops <= MAX_REDIRECTS;
      hops += 1
    ) {
      if (visited.has(current.href)) {
        throw new Error('redirect-loop')
      }

      visited.add(current.href)

      let response: Response
      let timedOut = false

      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, HEADERS_TIMEOUT_MS)

      try {
        response = await fetch(current.href, {
          method,
          headers: makeUpstreamHeaders(range),
          redirect: 'manual',
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal,
        })
      } catch (error) {
        if (
          timedOut &&
          !clientSignal.aborted
        ) {
          throw new Error('upstream-timeout')
        }

        throw error
      } finally {
        clearTimeout(timeout)
      }

      if (
        [301, 302, 303, 307, 308].includes(
          response.status,
        )
      ) {
        const location =
          response.headers.get('location')

        await closeResponse(response)

        if (
          !location ||
          hops === MAX_REDIRECTS
        ) {
          throw new Error('redirect-limit')
        }

        let destination: URL | null = null

        try {
          destination = parseTrustedUrl(
            new URL(location, current).href,
          )
        } catch {
          destination = null
        }

        if (!destination) {
          throw new Error('redirect-untrusted')
        }

        current = destination
        continue
      }

      return {
        response,
        finalUrl: current,
        controller,
        cleanup,
      }
    }

    throw new Error('redirect-limit')
  } catch (error) {
    cleanup()
    controller.abort()
    throw error
  }
}

/**
 * Streams media with backpressure.
 * Disconnects from the upstream server
 * when the client cancels the audio request.
 */
function forwardStream(
  upstream: Upstream,
): ReadableStream<Uint8Array> | null {
  if (!upstream.response.body) {
    upstream.cleanup()
    return null
  }

  const reader =
    upstream.response.body.getReader()

  let closed = false

  const finish = () => {
    if (closed) return

    closed = true
    upstream.cleanup()
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read()

        if (result.done) {
          finish()
          controller.close()
        } else {
          controller.enqueue(result.value)
        }
      } catch (error) {
        finish()
        controller.error(error)
      }
    },

    async cancel(reason) {
      finish()
      upstream.controller.abort()

      try {
        await reader.cancel(reason)
      } catch {
        // The network may already be closed.
      }
    },
  })
}

/**
 * Main HTTP request handler.
 * Compatible with existing:
 * /api/adhkar-audio?url=...
 */
async function handle(
  request: Request,
): Promise<Response> {
  const incomingUrl = new URL(request.url)

  const input =
    incomingUrl.searchParams.get('url') || ''

  const source = parseTrustedUrl(input)

  if (!source) {
    return errorResponse(
      'رابط الصوت غير صالح أو غير معتمد.',
      400,
    )
  }

  const range = request.headers.get('range')

  if (!isValidRange(range)) {
    return errorResponse(
      'صيغة Range غير صالحة.',
      416,
    )
  }

  const method =
    request.method === 'HEAD'
      ? 'HEAD'
      : 'GET'

  let upstream: Upstream

  try {
    upstream = await connect(
      source,
      method,
      range,
      request.signal,
    )
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : ''

    if (reason === 'redirect-untrusted') {
      return errorResponse(
        'تم رفض تحويل الصوت إلى مصدر غير معتمد.',
        502,
      )
    }

    if (
      reason === 'redirect-limit' ||
      reason === 'redirect-loop'
    ) {
      return errorResponse(
        'تعذر إكمال تحويلات مصدر الصوت.',
        502,
      )
    }

    if (reason === 'upstream-timeout') {
      return errorResponse(
        'انتهت مهلة الاتصال بمصدر الصوت.',
        504,
      )
    }

    if (request.signal.aborted) {
      return errorResponse(
        'أُلغِي طلب الصوت.',
        503,
      )
    }

    return errorResponse(
      'تعذر الاتصال بمصدر الصوت.',
      502,
    )
  }

  const {
    response,
    finalUrl,
    cleanup,
  } = upstream

  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
  })

  // Preserve HTTP Range Not Satisfiable.
  if (response.status === 416) {
    copyHeader(
      response.headers,
      headers,
      'Content-Range',
    )

    copyHeader(
      response.headers,
      headers,
      'Accept-Ranges',
    )

    await closeResponse(response)
    cleanup()

    return new Response(null, {
      status: 416,
      headers,
    })
  }

  if (
    response.status !== 200 &&
    response.status !== 206
  ) {
    const status =
      response.status === 404
        ? 404
        : 502

    await closeResponse(response)
    cleanup()

    return errorResponse(
      status === 404
        ? 'التسجيل غير موجود في المصدر.'
        : 'فشل المصدر في تقديم التسجيل الصوتي.',
      status,
    )
  }

  const encoding = response.headers
    .get('content-encoding')
    ?.toLowerCase()

  if (
    !looksLikeAudio(response, finalUrl) ||
    (encoding && encoding !== 'identity')
  ) {
    await closeResponse(response)
    cleanup()

    return errorResponse(
      'المصدر لم يرجع ملفًا صوتيًا صالحًا.',
      502,
    )
  }

  // Forward only playback-related headers.
  copyHeader(
    response.headers,
    headers,
    'Content-Type',
  )

  copyHeader(
    response.headers,
    headers,
    'Content-Length',
  )

  copyHeader(
    response.headers,
    headers,
    'Content-Range',
  )

  copyHeader(
    response.headers,
    headers,
    'Accept-Ranges',
  )

  copyHeader(
    response.headers,
    headers,
    'ETag',
  )

  copyHeader(
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

  // HEAD requests return metadata only.
  if (method === 'HEAD') {
    await closeResponse(response)
    cleanup()

    return new Response(null, {
      status: response.status,
      headers,
    })
  }

  if (!response.body) {
    cleanup()

    return errorResponse(
      'لم يرسل مصدر الصوت أي بيانات.',
      502,
    )
  }

  // Stream audio without buffering the full file.
  return new Response(
    forwardStream(upstream),
    {
      status: response.status,
      headers,
    },
  )
}

export async function GET(
  request: Request,
): Promise<Response> {
  return handle(request)
}

export async function HEAD(
  request: Request,
): Promise<Response> {
  return handle(request)
}
