export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const MAX_AUDIO_BYTES = 180 * 1024 * 1024
const MAX_REDIRECTS = 4
const CONNECT_TIMEOUT_MS = 14000
const FIRST_BYTE_TIMEOUT_MS = 15000
const IDLE_TIMEOUT_MS = 25000
const MAX_ATTEMPTS = 2

const AUDIO_EXTENSION = /\.(?:mp3|m4a|aac|ogg|wav)$/i
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])
const REDIRECTS = new Set([301, 302, 303, 307, 308])

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/** Restrict to known Adhkar audio repositories, not arbitrary external URLs. */
function allowedAudioUrl(input: string): URL | null {
  if (!input || input.length > 1800) return null

  try {
    const url = new URL(input)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.search.length > 200 ||
      /%(?:2f|5c|00)/i.test(url.pathname) ||
      !AUDIO_EXTENSION.test(url.pathname)
    ) return null

    const host = url.hostname.toLowerCase()
    const path = url.pathname

    if (host === 'cdn.jsdelivr.net') {
      return /^\/gh\/rn0x\/Adhkar-json@(?:main|master|[a-f0-9]{7,40})\/audio\/[a-z0-9_./-]+\.(?:mp3|m4a|aac|ogg|wav)$/i.test(path) &&
        !path.includes('..') ? url : null
    }

    // Fallback for the same public Adhkar-json recordings.
    if (host === 'raw.githubusercontent.com') {
      return /^\/rn0x\/Adhkar-json\/(?:main|master|[a-f0-9]{7,40})\/audio\/[a-z0-9_./-]+\.(?:mp3|m4a|aac|ogg|wav)$/i.test(path) &&
        !path.includes('..') ? url : null
    }

    if (host === 'download.tvquran.com') {
      return /^\/download\/TvQuran\.com__Athkar\/[a-z0-9_.-]+\.mp3$/i.test(path) ? url : null
    }

    if (/^d\d+\.islamhouse\.com$/.test(host)) {
      return /^\/data\/ar\/ih_sounds\/[a-z0-9_./-]+\.mp3$/i.test(path) &&
        !path.includes('..') ? url : null
    }

    if (host === 'archive.org' || host === 'www.archive.org') {
      return /^\/download\/[a-z0-9_.-]+\/[a-z0-9_./%-]+\.mp3$/i.test(path) &&
        !path.includes('..') ? url : null
    }

    // Internet Archive's redirect targets for archive.org/download links.
    if (/^ia\d+\.us\.archive\.org$/.test(host)) {
      return /^\/\d+\/items\/[a-z0-9_./%-]+\.mp3$/i.test(path) &&
        !path.includes('..') ? url : null
    }

    return null
  } catch {
    return null
  }
}

function fallbackFor(url: URL): URL | null {
  if (url.hostname !== 'cdn.jsdelivr.net') return null
  const match = url.pathname.match(
    /^\/gh\/rn0x\/Adhkar-json@([^/]+)\/(audio\/.*)$/i,
  )
  if (!match) return null
  return allowedAudioUrl(
    `https://raw.githubusercontent.com/rn0x/Adhkar-json/${match[1]}/${match[2]}`,
  )
}

function validRange(value: string | null): boolean {
  return !value || /^bytes=(?:\d+-\d*|-\d+)$/i.test(value.trim())
}

function safeMime(value: string | null): string | null {
  if (!value) return 'audio/mpeg'
  const mime = value.toLowerCase().split(';')[0].trim()
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('html') ||
    mime.includes('xml') ||
    mime.includes('javascript') ||
    mime.includes('svg')
  ) return null

  if (
    mime.startsWith('audio/') ||
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream' ||
    mime === 'application/x-download' ||
    mime === 'application/force-download'
  ) return mime

  return null
}

/** Guard against upstream partial files that claim a different byte size. */
function consistentRange(
  requested: string,
  actual: string | null,
  length: number | null,
): boolean {
  const parsed = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(actual || '')
  if (!parsed) return false

  const start = Number(parsed[1])
  const end = Number(parsed[2])
  const total = parsed[3] === '*' ? null : Number(parsed[3])

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    (total !== null && (!Number.isSafeInteger(total) || end >= total)) ||
    (length !== null && end - start + 1 !== length)
  ) return false

  const client = /^bytes=(\d*)-(\d*)$/i.exec(requested.trim())
  if (!client) return false

  if (client[1]) {
    if (start !== Number(client[1])) return false
    if (client[2] && end > Number(client[2])) return false
  } else if (client[2]) {
    const suffix = Number(client[2])
    if (!suffix || end - start + 1 > suffix) return false
  }

  return true
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', interrupted)
      resolve()
    }, ms)
    const interrupted = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', interrupted)
      reject(new Error('Aborted'))
    }
    signal.addEventListener('abort', interrupted, { once: true })
  })
}

type FetchResult = {
  response: Response
  finalUrl: URL
}

/** Never automatically follow a redirect to an unapproved server. */
async function fetchApproved(
  initial: URL,
  headers: Headers,
  signal: AbortSignal,
): Promise<FetchResult> {
  let current = initial

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.href, {
      method: 'GET',
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal,
    })

    if (!REDIRECTS.has(response.status)) {
      return { response, finalUrl: current }
    }

    const location = response.headers.get('Location')
    await response.body?.cancel().catch(() => undefined)
    if (!location) throw new Error('Redirect without Location')

    const resolved = allowedAudioUrl(new URL(location, current.href).href)
    if (!resolved) throw new Error('Unapproved audio redirect')
    current = resolved
  }

  throw new Error('Too many redirects')
}

/** Stream with backpressure and an upper size bound. */
function limitedStream(
  upstream: ReadableStream<Uint8Array>,
  abort: AbortController,
  dispose: () => void,
  limit: number,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader()
  let total = 0
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    dispose()
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const idleTimer = setTimeout(() => abort.abort(), IDLE_TIMEOUT_MS)
        let chunk: ReadableStreamReadResult<Uint8Array>
        try {
          chunk = await reader.read()
        } finally {
          clearTimeout(idleTimer)
        }
        if (chunk.done) {
          finish()
          controller.close()
          return
        }
        total += chunk.value.byteLength
        if (total > limit) {
          abort.abort()
          finish()
          controller.error(new Error('Audio exceeds safety limit'))
          return
        }
        controller.enqueue(chunk.value)
      } catch (error) {
        finish()
        controller.error(error)
      }
    },
    async cancel(reason) {
      abort.abort()
      try {
        await reader.cancel(reason)
      } catch {
        // Already aborted by the requester.
      } finally {
        finish()
      }
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  const source = allowedAudioUrl(incoming.searchParams.get('url') || '')
  if (!source) {
    return jsonError('رابط التسجيل الصوتي غير مسموح أو غير صحيح.', 400)
  }

  const range = request.headers.get('Range')
  if (!validRange(range)) {
    return jsonError('طلب المدى الصوتي غير صالح.', 416)
  }

  const upstreamHeaders = new Headers({
    Accept: 'audio/mpeg,audio/*;q=0.9,application/octet-stream;q=0.8',
    'Accept-Encoding': 'identity',
  })
  if (range) upstreamHeaders.set('Range', range)
  const ifRange = request.headers.get('If-Range')
  if (range && ifRange && ifRange.length <= 200) {
    upstreamHeaders.set('If-Range', ifRange)
  }

  const choices = [source]
  const backup = fallbackFor(source)
  if (backup) choices.push(backup)

  let lastStatus = 502

  try {
    for (const candidate of choices) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (request.signal.aborted) {
          return jsonError('تم إلغاء طلب التسجيل.', 499)
        }

        // A fresh abort controller for every attempt: a timed-out
        // source must not prevent a retry or use of the backup CDN.
        const attemptAbort = new AbortController()
        const onClientAbort = () => attemptAbort.abort()
        request.signal.addEventListener('abort', onClientAbort, { once: true })
        let disposed = false
        const dispose = () => {
          if (disposed) return
          disposed = true
          request.signal.removeEventListener('abort', onClientAbort)
        }

        const connectTimer = setTimeout(
          () => attemptAbort.abort(),
          CONNECT_TIMEOUT_MS,
        )
        let result: FetchResult

        try {
          result = await fetchApproved(
            candidate,
            upstreamHeaders,
            attemptAbort.signal,
          )
        } catch {
          clearTimeout(connectTimer)
          dispose()
          if (request.signal.aborted) {
            return jsonError('تم إلغاء طلب التسجيل.', 499)
          }
          if (attempt + 1 < MAX_ATTEMPTS) {
            await wait(400 * (attempt + 1), request.signal)
          }
          continue
        }
        clearTimeout(connectTimer)

        const upstream = result.response
        lastStatus = upstream.status

        if (upstream.status === 416) {
          const responseHeaders = new Headers({
            'Cache-Control': 'no-store',
            'Accept-Ranges': 'bytes',
          })
          const contentRange = upstream.headers.get('Content-Range')
          if (contentRange) responseHeaders.set('Content-Range', contentRange)
          await upstream.body?.cancel().catch(() => undefined)
          dispose()
          return new Response(null, { status: 416, headers: responseHeaders })
        }

        if (upstream.status !== 200 && upstream.status !== 206) {
          await upstream.body?.cancel().catch(() => undefined)
          dispose()
          if (RETRYABLE.has(upstream.status) && attempt + 1 < MAX_ATTEMPTS) {
            const retryAfter = Number(upstream.headers.get('Retry-After'))
            const delay = Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 1800)
              : 450 * (attempt + 1)
            await wait(delay, request.signal)
            continue
          }
          break
        }

        const mime = safeMime(upstream.headers.get('Content-Type'))
        const stated = upstream.headers.get('Content-Length')
        const length = stated && /^\d+$/.test(stated) ? Number(stated) : null
        const contentRange = upstream.headers.get('Content-Range')

        // Reject errors disguised as MP3 and inconsistent range metadata.
        if (
          !mime ||
          !upstream.body ||
          (length !== null && (!Number.isSafeInteger(length) || length > MAX_AUDIO_BYTES)) ||
          (upstream.status === 206 && (!range || !consistentRange(range, contentRange, length))) ||
          (upstream.status === 200 && Boolean(contentRange))
        ) {
          await upstream.body?.cancel().catch(() => undefined)
          dispose()
          lastStatus = 502
          break
        }

        const responseHeaders = new Headers({
          'Content-Type': mime,
          'Content-Disposition': 'inline',
          'X-Content-Type-Options': 'nosniff',
          'Accept-Ranges': upstream.headers.get('Accept-Ranges') || (upstream.status === 206 ? 'bytes' : 'none'),
          'Cache-Control': upstream.status === 206 ? 'private, no-store' : 'public, max-age=3600',
          Vary: 'Range',
        })
        if (length !== null) responseHeaders.set('Content-Length', String(length))
        if (contentRange) responseHeaders.set('Content-Range', contentRange)
        for (const header of ['ETag', 'Last-Modified']) {
          const value = upstream.headers.get(header)
          if (value) responseHeaders.set(header, value)
        }

        // Stream without loading the MP3 into memory. Once bytes have
        // been sent, the client must retry using a fresh HTTP request.
        const firstByteTimer = setTimeout(
          () => attemptAbort.abort(),
          FIRST_BYTE_TIMEOUT_MS,
        )
        const stream = limitedStream(upstream.body, attemptAbort, dispose, MAX_AUDIO_BYTES)
        const reader = stream.getReader()
        try {
          // Wait for the first audio bytes before replying with HTTP 200.
          const first = await reader.read()
          clearTimeout(firstByteTimer)
          if (first.done || !first.value.byteLength) {
            await reader.cancel().catch(() => undefined)
            lastStatus = 502
            continue
          }

          const output = new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(first.value) },
            async pull(controller) {
              try {
                const next = await reader.read()
                if (next.done) controller.close()
                else controller.enqueue(next.value)
              } catch (error) {
                controller.error(error)
              }
            },
            async cancel(reason) {
              try { await reader.cancel(reason) } catch { /* already cancelled */ }
            },
          })
          return new Response(output, { status: upstream.status, headers: responseHeaders })
        } catch {
          clearTimeout(firstByteTimer)
          await reader.cancel().catch(() => undefined)
          if (request.signal.aborted) {
            return jsonError('تم إلغاء طلب التسجيل.', 499)
          }
          lastStatus = 502
        }
      }
    }

    if (request.signal.aborted) {
      return jsonError('تم إلغاء طلب التسجيل.', 499)
    }
    if (lastStatus === 404 || lastStatus === 410) {
      return jsonError('التسجيل غير موجود لدى المصدر الصوتي.', 404)
    }
    return jsonError('مصدر التسجيل غير متاح حاليًا. حاول مجددًا.', 502)
  } catch {
    return jsonError('تعذر الاتصال بمصدر التسجيل.', request.signal.aborted ? 499 : 502)
  }
}