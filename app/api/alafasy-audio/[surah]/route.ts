/**
 * SAMEE3: streaming relay for the *collected* Alafasy recording only.
 * Requests are restricted to the 114 numbered MP3 assets from the pinned release.
 * Forwards byte ranges needed by mobile/Safari audio players and streams data
 * rather than buffering the entire surah in a serverless function.
 */
import { ALAFASY_COLLECTED_RELEASE } from '@/lib/quran/alafasy-collected'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const ERROR_HEADERS = { 'Cache-Control': 'no-store' }

function parseSurah(raw: string): number | null {
  const match = /^(\d{1,3})(?:\.mp3)?$/i.exec(raw)
  if (!match) return null
  const number = Number(match[1])
  return Number.isInteger(number) && number >= 1 && number <= 114 ? number : null
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: ERROR_HEADERS })
}

type RouteContext = { params: { surah: string } | Promise<{ surah: string }> }

async function relay(request: Request, context: RouteContext): Promise<Response> {
  const { surah: raw } = await context.params
  const surah = parseSurah(raw)
  if (surah === null) return errorResponse('Invalid surah number', 400)

  const file = `${String(surah).padStart(3, '0')}.mp3`
  const upstreamUrl = `${ALAFASY_COLLECTED_RELEASE}/${file}`
  const incoming = new URL(request.url)
  const isDiagnostic = incoming.searchParams.get('check') === '1'
  const headers = new Headers()
  // A tiny Range request lets the diagnostic test real upstream streaming.
  if (isDiagnostic) {
    headers.set('Range', 'bytes=0-1')
  } else {
    const range = request.headers.get('range')
    if (range) {
      if (!/^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range) || range.includes(',')) {
        return errorResponse('Invalid or unsupported Range', 416)
      }
      headers.set('Range', range)
    }
    const ifRange = request.headers.get('if-range')
    if (ifRange) headers.set('If-Range', ifRange)
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      cache: 'no-store',
      signal: request.signal,
    })
  } catch (error) {
    console.error('Alafasy MP3 relay fetch failed', file, error)
    return errorResponse('Recording host could not be reached', 502)
  }

  const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase()
  const isHtml = upstreamType.includes('text/html')
  const validStatus = upstream.status === 200 || upstream.status === 206

  if (isDiagnostic) {
    // Do not download a full chapter when GitHub ignores Range.
    if (!validStatus || isHtml || upstream.status !== 206) {
      await upstream.body?.cancel().catch(() => undefined)
      return Response.json({
        ok: false,
        file,
        upstreamStatus: upstream.status,
        upstreamContentType: upstreamType,
        upstreamAcceptRanges: upstream.headers.get('accept-ranges'),
        upstreamContentRange: upstream.headers.get('content-range'),
        issue: !validStatus ? 'Asset is unavailable' : isHtml ? 'Expected MP3, received HTML' : 'Host did not honor byte range',
      }, { headers: ERROR_HEADERS })
    }
    const firstBytes = new Uint8Array(await upstream.arrayBuffer())
    return Response.json({
      ok: firstBytes.length === 2,
      file,
      upstreamStatus: upstream.status,
      upstreamContentType: upstreamType,
      upstreamContentRange: upstream.headers.get('content-range'),
      receivedBytes: firstBytes.length,
    }, { headers: ERROR_HEADERS })
  }

  if (!validStatus || isHtml || !upstream.body) {
    await upstream.body?.cancel().catch(() => undefined)
    return errorResponse(`Recording unavailable (upstream ${upstream.status})`, 502)
  }

  const responseHeaders = new Headers()
  responseHeaders.set('Content-Type', 'audio/mpeg')
  responseHeaders.set('Content-Disposition', `inline; filename="${file}"`)
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')
  for (const name of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  // Avoid falsely claiming byte-range support if the host ignored it.
  if (upstream.status === 206 && !responseHeaders.has('Accept-Ranges')) {
    responseHeaders.set('Accept-Ranges', 'bytes')
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return relay(request, context)
}
