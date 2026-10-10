
import { NextRequest, NextResponse } from 'next/server'

/**
 * SAMEE3 — Download a complete tafsir book for offline use.
 * GitHub path: app/api/tafsir-download/route.ts
 * This API never writes to Firebase or to the server's disk.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED_BOOKS = new Set<number>([
  2012, 136, 4, 2, 3, 1469, 27796, 54,
])

const MAX_TRANSFER_BYTES = 30 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 45000
const ALLOWED_HOSTS = new Set([
  'api.quranpedia.net',
  'quranpedia.net',
])

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('book') ?? ''

  if (!/^[0-9]{1,6}$/.test(raw)) {
    return failure('رقم كتاب التفسير غير صالح.', 400)
  }

  const book = Number(raw)

  if (!ALLOWED_BOOKS.has(book)) {
    return failure('هذا الكتاب غير متاح للتنزيل.', 400)
  }

  if (request.signal.aborted) {
    return failure('تم إلغاء الطلب.', 499)
  }

  const abortController = new AbortController()
  const onClientAbort = () => abortController.abort()
  const timer = setTimeout(
    () => abortController.abort(),
    UPSTREAM_TIMEOUT_MS,
  )

  request.signal.addEventListener('abort', onClientAbort, {
    once: true,
  })

  const cleanup = () => {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', onClientAbort)
  }

  try {
    const remote = await fetch(
      `https://api.quranpedia.net/dumps/tafsir-book-${book}.json.gz`,
      {
        method: 'GET',
        signal: abortController.signal,
        cache: 'no-store',
        redirect: 'follow',
        headers: {
          Accept: 'application/gzip, application/octet-stream',
          'Accept-Encoding': 'identity',
        },
      },
    )

    const finalUrl = new URL(remote.url)

    if (
      finalUrl.protocol !== 'https:' ||
      !ALLOWED_HOSTS.has(finalUrl.hostname)
    ) {
      abortController.abort()
      cleanup()
      return failure('تم رفض إعادة توجيه غير آمنة.', 502)
    }

    if (!remote.ok || !remote.body) {
      cleanup()
      return failure(
        remote.status === 404
          ? 'ملف الكتاب غير موجود في المصدر.'
          : 'مصدر التفسير غير متاح حاليًا.',
        502,
      )
    }

    const mime = remote.headers.get('content-type') || ''
    if (mime.includes('text/html')) {
      abortController.abort()
      cleanup()
      return failure('المصدر أعاد صفحة بدل ملف التفسير.', 502)
    }

    const declaredLength = Number(
      remote.headers.get('content-length') ?? 0,
    )

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_TRANSFER_BYTES
    ) {
      abortController.abort()
      cleanup()
      return failure('حجم ملف التفسير يتجاوز الحد المسموح.', 413)
    }

    const reader = remote.body.getReader()
    let transferred = 0

    const output = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read()

          if (chunk.done) {
            cleanup()
            controller.close()
            return
          }

          transferred += chunk.value.byteLength

          if (transferred > MAX_TRANSFER_BYTES) {
            abortController.abort()
            cleanup()
            controller.error(
              new Error('تجاوز ملف التفسير الحد المسموح.'),
            )
            return
          }

          controller.enqueue(chunk.value)
        } catch (error) {
          cleanup()
          controller.error(error)
        }
      },

      cancel() {
        cleanup()
        abortController.abort()
        void reader.cancel().catch(() => undefined)
      },
    })

    // Fetch may transparently decompress an HTTP Content-Encoding.
    // Do not forward Content-Encoding or upstream Content-Length.
    // The client checks the gzip signature and accepts either
    // raw gzip bytes or an already-decoded JSON payload.
    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="tafsir-book-${book}.json.gz"`,
      },
    })
  } catch (error) {
    cleanup()
    const timeout =
      error instanceof Error && error.name === 'AbortError'

    return failure(
      timeout
        ? 'انتهت مهلة تنزيل التفسير أو أُلغي الطلب.'
        : 'تعذر الاتصال بمصدر كتاب التفسير.',
      502,
    )
  }
}
