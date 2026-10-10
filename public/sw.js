
/*
 * SAMEE3 — Service Worker
 * Path: public/sw.js
 *
 * Preserves existing Quran and audio downloads.
 * Supports offline pages, recitations and audio ranges.
 */

'use strict'

const WORKER_VERSION = 'samee3-sw-v4'

const APP_CACHE = `${WORKER_VERSION}-app`
const NAV_CACHE = `${WORKER_VERSION}-navigation`
const STATIC_CACHE = `${WORKER_VERSION}-static`

const MUSHAF_CACHE = 'samee3-mushaf-pages-v2'
const IMAGE_CACHE = 'samee3-v3-riwaya-images'
const AUDIO_CACHE = 'samee3-audio-v2'

// These names are used by existing application pages.
// Never delete them during worker updates.
const AUDIO_CACHES = [
  AUDIO_CACHE,
  'samee3-quran-audio-v1',
  'samee3-v2-audio',
  'samee-audio-v2',
]

const PRECACHE_PATHS = [
  '/',
  '/mushaf',
  '/audio',
  '/surahs',
  '/offline',
  '/offline/manage',
  '/offline/test',
  '/manifest.json',
  '/icon.svg',
]

const PROTECTED_PREFIXES = [
  '/auth',
  '/profile',
  '/admin',
  '/messages',
]

const MUSHAF_API_PATHS = [
  '/api/quran',
  '/api/mushaf-svg',
]

function pathnameOf(request) {
  try {
    return new URL(request.url).pathname
  } catch {
    return ''
  }
}

function sameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin
  } catch {
    return false
  }
}

function isPrivateRoute(path) {
  return PROTECTED_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`),
  )
}

function isAudioFromTrustedHost(request) {
  if (request.method !== 'GET') {
    return false
  }

  try {
    const url = new URL(request.url)
    const host = url.hostname.toLowerCase()

    return (
      url.protocol === 'https:' &&
      (
        host === 'mp3quran.net' ||
        host.endsWith('.mp3quran.net')
      ) &&
      (
        /\.mp3$/i.test(url.pathname) ||
        request.destination === 'audio'
      )
    )
  } catch {
    return false
  }
}

function validDownloadUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()

    return (
      url.protocol === 'https:' &&
      (
        host === 'mp3quran.net' ||
        host.endsWith('.mp3quran.net')
      ) &&
      /\.mp3$/i.test(url.pathname)
    )
  } catch {
    return false
  }
}

function shouldStoreResponse(response, kind) {
  if (
    !response ||
    !response.ok ||
    response.status !== 200
  ) {
    return false
  }

  const cacheControl =
    response.headers.get('cache-control') || ''

  if (
    /\b(?:no-store|private)\b/i.test(cacheControl)
  ) {
    return false
  }

  if (response.headers.has('set-cookie')) {
    return false
  }

  if (kind === 'html') {
    const type =
      response.headers.get('content-type') || ''

    return /text\/html/i.test(type)
  }

  return true
}

async function storeIfSafe(
  cache,
  request,
  response,
  kind,
) {
  if (!shouldStoreResponse(response, kind)) {
    return
  }

  try {
    await cache.put(
      request,
      response.clone(),
    )
  } catch (error) {
    console.warn(
      'SAMEE3: cache write failed',
      error,
    )
  }
}

async function findInCaches(names, request) {
  const existing = await caches.keys()

  for (const name of names) {
    if (!existing.includes(name)) {
      continue
    }

    try {
      const cache = await caches.open(name)
      const result = await cache.match(request)

      if (result) {
        return result
      }
    } catch {
      // Failure in one cache must not block others.
    }
  }

  return null
}

// ----------------------------------------------------
// Installation
// ----------------------------------------------------

async function precacheApp() {
  const cache = await caches.open(APP_CACHE)

  await Promise.all(
    PRECACHE_PATHS.map(async (path) => {
      try {
        const url = new URL(
          path,
          self.location.origin,
        )

        const request = new Request(
          url.href,
          {
            method: 'GET',
            cache: 'reload',
            credentials: 'omit',
          },
        )

        const response = await fetch(request)

        const kind =
          path.endsWith('.json') ||
          path.endsWith('.svg')
            ? 'asset'
            : 'html'

        await storeIfSafe(
          cache,
          request,
          response,
          kind,
        )
      } catch (error) {
        console.warn(
          'SAMEE3: pre-cache unavailable',
          path,
          error,
        )
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheApp().then(
      () => self.skipWaiting(),
    ),
  )
})

// ----------------------------------------------------
// Activation
// ----------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()

      // Delete only older worker-owned shells.
      // Quran and audio download caches are protected.
      await Promise.all(
        names
          .filter(
            (name) =>
              /^samee3-sw-v\d+-(?:app|navigation|static)$/.test(
                name,
              ) &&
              name !== APP_CACHE &&
              name !== NAV_CACHE &&
              name !== STATIC_CACHE,
          )
          .map(
            (name) => caches.delete(name),
          ),
      )

      await self.clients.claim()
    })(),
  )
})

// ----------------------------------------------------
// Offline fallback
// ----------------------------------------------------

function offlinePage() {
  return new Response(
    `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#15566b">
<title>مصحف سميع — دون إنترنت</title>
<style>
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  background: #f4f9fe;
  color: #193949;
  font: 16px Tahoma, Arial, sans-serif;
  text-align: center;
}
main {
  max-width: 450px;
  width: 100%;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 28px;
  padding: 30px 22px;
  box-shadow: 0 16px 42px #11283c12;
}
.mark {
  font-size: 42px;
  color: #b58b4b;
}
h1 {
  font-size: 25px;
  margin: 12px 0;
}
p {
  line-height: 2;
  color: #64748b;
  font-size: 14px;
}
a, button {
  display: block;
  width: 100%;
  padding: 13px;
  border-radius: 14px;
  font: 700 14px Tahoma, Arial, sans-serif;
  text-decoration: none;
  margin-top: 12px;
  cursor: pointer;
  border: 0;
  background: #14566b;
  color: white;
}
button {
  background: #f1f5f9;
  color: #334155;
}
</style>
</head>
<body>
<main>
  <div class="mark">۞</div>
  <h1>مصحف سميع</h1>
  <p>
    القسم المطلوب غير محفوظ للاستخدام دون اتصال.
    اتصل بالإنترنت وافتح القسم المطلوب لتنزيل ملفاته،
    ثم اختبر تشغيله في وضع الطيران.
  </p>
  <a href="/offline">
    التنزيلات دون إنترنت
  </a>
  <a href="/">
    الرئيسية
  </a>
  <button onclick="location.reload()">
    إعادة المحاولة
  </button>
</main>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'Content-Type':
          'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

// ----------------------------------------------------
// Navigation
// ----------------------------------------------------

async function navigate(request) {
  const path = pathnameOf(request)

  // Never cache personal account pages.
  if (isPrivateRoute(path)) {
    try {
      return await fetch(request)
    } catch {
      return offlinePage()
    }
  }

  const pageCache =
    await caches.open(NAV_CACHE)

  try {
    const networkResponse =
      await fetch(request)

    await storeIfSafe(
      pageCache,
      request,
      networkResponse,
      'html',
    )

    return networkResponse
  } catch {
    const page =
      (await pageCache.match(request)) ||
      (await pageCache.match(
        request,
        { ignoreSearch: true },
      ))

    if (page) {
      return page
    }

    const appCache =
      await caches.open(APP_CACHE)

    const cachedAppPage =
      await appCache.match(
        new URL(
          path,
          self.location.origin,
        ).href,
      )

    return cachedAppPage || offlinePage()
  }
}

// ----------------------------------------------------
// Static resources
// ----------------------------------------------------

async function staticAsset(request) {
  const cache =
    await caches.open(STATIC_CACHE)

  const saved =
    (await cache.match(request)) ||
    (await findInCaches(
      [APP_CACHE],
      request,
    ))

  if (saved) {
    return saved
  }

  const response = await fetch(request)

  await storeIfSafe(
    cache,
    request,
    response,
    'asset',
  )

  return response
}

// ----------------------------------------------------
// Quran page APIs
// ----------------------------------------------------

async function quranApi(request) {
  // Shared with app/mushaf/page.tsx.
  const cache =
    await caches.open(MUSHAF_CACHE)

  const cached =
    await cache.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  const contentType =
    response.headers.get('content-type') || ''

  if (/application\/json/i.test(contentType)) {
    await storeIfSafe(
      cache,
      request,
      response,
      'asset',
    )
  }

  return response
}

// ----------------------------------------------------
// Riwaya images
// ----------------------------------------------------

async function riwayaImage(request) {
  // Images downloaded by the mushaf may be stored
  // in the main mushaf cache, not only IMAGE_CACHE.
  const existing = await findInCaches(
    [IMAGE_CACHE, MUSHAF_CACHE],
    request,
  )

  if (existing) {
    return existing
  }

  const response = await fetch(request)

  const contentType =
    response.headers.get('content-type') || ''

  if (/^image\//i.test(contentType)) {
    const cache =
      await caches.open(IMAGE_CACHE)

    await storeIfSafe(
      cache,
      request,
      response,
      'asset',
    )
  }

  return response
}

// ----------------------------------------------------
// Quran audio
// ----------------------------------------------------

async function cachedAudio(url) {
  return findInCaches(
    AUDIO_CACHES,
    url,
  )
}

/*
 * Serve HTTP byte ranges from a complete cached MP3.
 *
 * Important for seeking and playback on mobile browsers.
 * Opaque responses cannot be inspected or sliced.
 */

async function applyRange(response, request) {
  const range =
    request.headers.get('range')

  if (
    !range ||
    response.type === 'opaque' ||
    response.type === 'opaqueredirect'
  ) {
    return response
  }

  const match =
    /^bytes=(\d*)-(\d*)$/i.exec(
      range.trim(),
    )

  if (
    !match ||
    (!match[1] && !match[2])
  ) {
    return response
  }

  try {
    const blob =
      await response.clone().blob()

    const length = blob.size

    if (!length) {
      return response
    }

    let first = match[1]
      ? Number(match[1])
      : 0

    let last = match[2]
      ? Number(match[2])
      : length - 1

    if (!match[1]) {
      // Suffix example: bytes=-512.
      const suffix = Number(match[2])

      first = Math.max(
        0,
        length - suffix,
      )

      last = length - 1
    }

    if (
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first >= length ||
      first < 0 ||
      last < first
    ) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range':
            `bytes */${length}`,
          'Accept-Ranges': 'bytes',
        },
      })
    }

    last = Math.min(
      last,
      length - 1,
    )

    return new Response(
      blob.slice(
        first,
        last + 1,
      ),
      {
        status: 206,
        headers: {
          'Content-Type':
            response.headers.get(
              'content-type',
            ) || 'audio/mpeg',

          'Content-Range':
            `bytes ${first}-${last}/${length}`,

          'Content-Length':
            String(last - first + 1),

          'Accept-Ranges': 'bytes',

          'Cache-Control': 'no-store',
        },
      },
    )
  } catch {
    return response
  }
}

async function serveAudio(request) {
  const saved =
    await cachedAudio(request.url)

  if (saved) {
    return applyRange(
      saved,
      request,
    )
  }

  /*
   * Do not cache a partial 206 response as
   * though it were a complete MP3 file.
   */
  const response = await fetch(request)

  if (
    !request.headers.has('range') &&
    (
      (
        response.ok &&
        response.status === 200
      ) ||
      response.type === 'opaque'
    )
  ) {
    try {
      const cache =
        await caches.open(AUDIO_CACHE)

      await cache.put(
        request.url,
        response.clone(),
      )
    } catch (error) {
      console.warn(
        'SAMEE3: audio save failed',
        error,
      )
    }
  }

  return response
}

// ----------------------------------------------------
// Fetch routing
// ----------------------------------------------------

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (
    !request ||
    request.method !== 'GET'
  ) {
    return
  }

  // External Quran audio must be checked first.
  if (isAudioFromTrustedHost(request)) {
    event.respondWith(
      serveAudio(request),
    )
    return
  }

  if (!sameOrigin(request)) {
    return
  }

  const path = pathnameOf(request)

  if (request.mode === 'navigate') {
    event.respondWith(
      navigate(request),
    )
    return
  }

  // Avoid caching private and Next.js image requests.
  if (
    isPrivateRoute(path) ||
    path === '/_next/image'
  ) {
    return
  }

  if (
    path === '/api/mushaf-riwaya-image'
  ) {
    event.respondWith(
      riwayaImage(request),
    )
    return
  }

  if (
    MUSHAF_API_PATHS.includes(path)
  ) {
    event.respondWith(
      quranApi(request),
    )
    return
  }

  // Other APIs and React Server Component data
  // are not cached by this worker.
  if (
    path.startsWith('/api/') ||
    new URL(request.url)
      .searchParams.has('_rsc')
  ) {
    return
  }

  if (
    path.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|ico)$/i.test(
      path,
    ) ||
    path === '/manifest.json'
  ) {
    event.respondWith(
      staticAsset(request),
    )
  }
})

// ----------------------------------------------------
// Explicit full-audio download
// ----------------------------------------------------

async function downloadWholeAudio(url) {
  if (!validDownloadUrl(url)) {
    return {
      ok: false,
      error: 'رابط الصوت غير مسموح به.',
    }
  }

  try {
    const old = await cachedAudio(url)

    if (old) {
      return { ok: true }
    }

    const cache =
      await caches.open(AUDIO_CACHE)

    let response = null

    try {
      const cors = await fetch(
        url,
        {
          method: 'GET',
          credentials: 'omit',
          mode: 'cors',
          cache: 'no-store',
        },
      )

      if (
        cors.ok &&
        cors.status === 200
      ) {
        response = cors
      }
    } catch {
      // Some audio hosts do not support CORS.
    }

    if (!response) {
      const opaque = await fetch(
        url,
        {
          method: 'GET',
          credentials: 'omit',
          mode: 'no-cors',
          cache: 'no-store',
        },
      )

      if (
        opaque.type === 'opaque' ||
        (
          opaque.ok &&
          opaque.status === 200
        )
      ) {
        response = opaque
      }
    }

    if (!response) {
      throw new Error(
        'تعذر الحصول على الملف الصوتي كاملًا.',
      )
    }

    await cache.put(
      url,
      response,
    )

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'تعذر حفظ التلاوة.',
    }
  }
}

// ----------------------------------------------------
// Messages from application pages
// ----------------------------------------------------

self.addEventListener('message', (event) => {
  const data = event.data

  if (
    !data ||
    typeof data.type !== 'string'
  ) {
    return
  }

  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(
      self.skipWaiting(),
    )
    return
  }

  /*
   * Disable the destructive legacy command.
   * This prevents accidental deletion of
   * downloaded Quran pages and recordings.
   */
  if (
    data.type === 'CLEAR_SAMEE3_CACHE'
  ) {
    try {
      if (
        event.source &&
        event.source.postMessage
      ) {
        event.source.postMessage({
          type: 'CLEAR_SAMEE3_CACHE_RESULT',
          ok: false,
          error:
            'حذف جميع التنزيلات غير مسموح من خدمة التطبيق.',
        })
      }
    } catch {
      // The requesting tab may have closed.
    }

    return
  }

  if (
    data.type === 'CACHE_AUDIO_URL' &&
    typeof data.url === 'string'
  ) {
    const url = data.url

    event.waitUntil(
      (async () => {
        const result =
          await downloadWholeAudio(url)

        try {
          if (
            event.source &&
            event.source.postMessage
          ) {
            event.source.postMessage({
              type: 'CACHE_AUDIO_URL_RESULT',
              url,
              ok: result.ok,
              error: result.error,
            })
          }
        } catch {
          // Tab closed before completion.
        }
      })(),
    )
  }
})
