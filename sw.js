const CACHE_VERSION = 'samee3-v3'

const APP_CACHE = `${CACHE_VERSION}-app`
const PAGE_CACHE = `${CACHE_VERSION}-pages`
const STATIC_CACHE = `${CACHE_VERSION}-static`

/*
 * نفس أسماء الكاش المستخدمة داخل app/mushaf/page.tsx
 * حتى لا يحدث تكرار أو تضارب بين Service Worker والتطبيق.
 */
const MUSHAF_CACHE = 'samee3-mushaf-pages-v2'
const AUDIO_CACHE = 'samee3-audio-v2'

const MANAGED_CACHES = new Set([
  MUSHAF_CACHE,
  AUDIO_CACHE,
])

const PRECACHE_URLS = [
  '/',
  '/mushaf',
  '/manifest.json',
  '/icon.svg',
]

const AUDIO_HOST_ALLOWLIST = new Set([
  'mp3quran.net',
])

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin
  } catch {
    return false
  }
}

function isAllowedQuranAudioRequest(request) {
  if (!request || request.method !== 'GET') return false

  try {
    const url = new URL(request.url)
    const hostname = url.hostname.toLowerCase()

    const allowedHost =
      AUDIO_HOST_ALLOWLIST.has(hostname) ||
      hostname.endsWith('.mp3quran.net')

    const isMp3 =
      /\.mp3(?:$|[?#])/i.test(
        url.pathname + url.search + url.hash,
      )

    const isAudio =
      request.destination === 'audio'

    return allowedHost && (isMp3 || isAudio)
  } catch {
    return false
  }
}

function isMushafApiRequest(request) {
  if (!request || request.method !== 'GET') return false

  try {
    const url = new URL(request.url)

    return (
      isSameOrigin(request) &&
      (
        url.pathname === '/api/quran' ||
        url.pathname === '/api/mushaf-svg'
      )
    )
  } catch {
    return false
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
}

function isStaticAsset(request) {
  try {
    const url = new URL(request.url)

    return (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.ttf') ||
      url.pathname.endsWith('.otf') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.webp') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico')
    )
  } catch {
    return false
  }
}

async function safeCachePut(cacheName, request, response) {
  if (!response) return

  if (
    !response.ok &&
    response.type !== 'opaque'
  ) {
    return
  }

  if (response.status === 206) {
    return
  }

  try {
    const cache = await caches.open(cacheName)

    await cache.put(
      request,
      response.clone(),
    )
  } catch (error) {
    console.warn(
      'SAMEE3: cache put failed',
      cacheName,
      error,
    )
  }
}

async function cacheAudioResponse(request) {
  const cache = await caches.open(AUDIO_CACHE)

  const cached = await cache.match(request.url)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (
    response &&
    (response.ok || response.type === 'opaque') &&
    response.status !== 206
  ) {
    await safeCachePut(
      AUDIO_CACHE,
      request.url,
      response,
    )
  }

  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)

    if (response && response.ok) {
      await cache.put(
        request,
        response.clone(),
      )
    }

    return response
  } catch {
    const cached = await cache.match(request)

    if (cached) {
      return cached
    }

    throw new Error(
      'Offline and resource is not cached',
    )
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (response && response.ok) {
    await cache.put(
      request,
      response.clone(),
    )
  }

  return response
}

/*
 * APIs الخاصة بصفحات المصحف:
 * نستخدم كاش صفحات المصحف نفسه.
 * هذا مهم جدًا حتى تعمل الصفحات المحفوظة بدون نت.
 */
async function mushafApiFirst(request) {
  const cache = await caches.open(MUSHAF_CACHE)

  const cached = await cache.match(request)

  if (cached) {
    /*
     * عند وجود نسخة محفوظة نعيدها فورًا.
     * هذا يمنع تأخر فتح الصفحة بدون اتصال.
     *
     * وفي الخلفية نحاول تحديثها عند وجود الإنترنت.
     */
    if (self.navigator && self.navigator.onLine !== false) {
      eventLoopRefreshMushafRequest(
        request,
        cache,
      )
    }

    return cached
  }

  try {
    const response = await fetch(request)

    if (response && response.ok) {
      await cache.put(
        request,
        response.clone(),
      )
    }

    return response
  } catch {
    throw new Error(
      'Offline and Mushaf page is not cached',
    )
  }
}

function eventLoopRefreshMushafRequest(
  request,
  cache,
) {
  fetch(request, {
    cache: 'no-store',
  })
    .then((response) => {
      if (
        response &&
        response.ok
      ) {
        return cache.put(
          request,
          response.clone(),
        )
      }

      return null
    })
    .catch(() => {})
}

async function offlineNavigationFallback(request) {
  const appCache = await caches.open(APP_CACHE)

  const exact = await appCache.match(request)

  if (exact) {
    return exact
  }

  const mushaf = await appCache.match('/mushaf')

  if (mushaf) {
    return mushaf
  }

  const root = await appCache.match('/')

  if (root) {
    return root
  }

  return new Response(
    `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
/>
<title>مصحف سميع</title>
<style>
html,body{
  margin:0;
  min-height:100%;
}
body{
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  box-sizing:border-box;
  background:#fcfbf8;
  color:#0f172a;
  font-family:Arial,sans-serif;
  text-align:center;
}
.card{
  width:min(520px,100%);
}
</style>
</head>
<body>
  <div class="card">
    <h2>مصحف سميع</h2>
    <p>
      تم فتح التطبيق بدون إنترنت،
      لكن هذه الصفحة لم يتم حفظها بعد على الجهاز.
    </p>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'Content-Type':
          'text/html; charset=utf-8',
      },
    },
  )
}

self.addEventListener(
  'install',
  (event) => {
    event.waitUntil(
      caches.open(APP_CACHE)
        .then(async (cache) => {
          for (
            const url of PRECACHE_URLS
          ) {
            try {
              const response =
                await fetch(url, {
                  cache: 'no-store',
                })

              if (
                response &&
                response.ok
              ) {
                await cache.put(
                  url,
                  response.clone(),
                )
              }
            } catch (error) {
              console.warn(
                'SAMEE3: precache skipped',
                url,
                error,
              )
            }
          }
        })
        .then(() =>
          self.skipWaiting(),
        ),
    )
  },
)

self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((name) => {
                if (!name.startsWith('samee3-')) {
                  return false
                }

                /*
                 * لا نحذف كاش المصحف أو الصوت
                 * الذي تديره الصفحة مباشرة.
                 */
                if (
                  MANAGED_CACHES.has(name)
                ) {
                  return false
                }

                return (
                  name !== APP_CACHE &&
                  name !== PAGE_CACHE &&
                  name !== STATIC_CACHE
                )
              })
              .map((name) =>
                caches.delete(name),
              ),
          ),
        )
        .then(() =>
          self.clients.claim(),
        ),
    )
  },
)

self.addEventListener(
  'fetch',
  (event) => {
    const { request } = event

    if (
      !request ||
      request.method !== 'GET'
    ) {
      return
    }

    /*
     * ==========================================
     * قرآن صوتي خارجي
     * ==========================================
     */
    if (
      isAllowedQuranAudioRequest(request)
    ) {
      event.respondWith(
        cacheAudioResponse(
          request,
        ).catch(async () => {
          const cache =
            await caches.open(
              AUDIO_CACHE,
            )

          const cached =
            await cache.match(
              request.url,
            )

          if (cached) {
            return cached
          }

          throw new Error(
            'Offline and Quran audio is not cached',
          )
        }),
      )

      return
    }

    /*
     * ==========================================
     * صفحات المصحف:
     * /api/quran
     * /api/mushaf-svg
     * ==========================================
     */
    if (
      isMushafApiRequest(request)
    ) {
      event.respondWith(
        mushafApiFirst(request),
      )

      return
    }

    /*
     * لا نعترض الطلبات الخارجية العادية.
     */
    if (!isSameOrigin(request)) {
      return
    }

    /*
     * ==========================================
     * فتح الصفحات بدون إنترنت
     * ==========================================
     */
    if (
      isNavigationRequest(request)
    ) {
      event.respondWith(
        networkFirst(
          request,
          PAGE_CACHE,
        ).catch(() =>
          offlineNavigationFallback(
            request,
          ),
        ),
      )

      return
    }

    /*
     * ==========================================
     * ملفات Next.js والملفات الثابتة
     * ==========================================
     */
    if (isStaticAsset(request)) {
      event.respondWith(
        cacheFirst(
          request,
          STATIC_CACHE,
        ).catch(async () => {
          const cache =
            await caches.open(
              STATIC_CACHE,
            )

          const cached =
            await cache.match(
              request,
            )

          if (cached) {
            return cached
          }

          throw new Error(
            'Offline static resource is not cached',
          )
        }),
      )

      return
    }

    /*
     * الطلبات المحلية الأخرى:
     * Network First مع الرجوع للكاش.
     */
    event.respondWith(
      networkFirst(
        request,
        STATIC_CACHE,
      ).catch(async () => {
        const cache =
          await caches.open(
            STATIC_CACHE,
          )

        const cached =
          await cache.match(
            request,
          )

        if (cached) {
          return cached
        }

        throw new Error(
          'Offline resource is not cached',
        )
      }),
    )
  },
)

self.addEventListener(
  'message',
  (event) => {
    const data = event.data

    if (!data) return

    /*
     * تحديث Service Worker فورًا.
     */
    if (
      data.type ===
      'SKIP_WAITING'
    ) {
      event.waitUntil(
        self.skipWaiting(),
      )

      return
    }

    /*
     * حذف كاش SAMEE3 بالكامل.
     */
    if (
      data.type ===
      'CLEAR_SAMEE3_CACHE'
    ) {
      event.waitUntil(
        caches.keys()
          .then((cacheNames) =>
            Promise.all(
              cacheNames
                .filter((name) =>
                  name.startsWith(
                    'samee3-',
                  ),
                )
                .map((name) =>
                  caches.delete(
                    name,
                  ),
                ),
            ),
          ),
      )

      return
    }

    /*
     * حفظ ملف صوت كامل في الخلفية.
     *
     * مهم:
     * نستخدم نفس AUDIO_CACHE الذي تستخدمه صفحة
     * المصحف: samee3-audio-v2
     */
    if (
      data.type ===
        'CACHE_AUDIO_URL' &&
      typeof data.url ===
        'string'
    ) {
      const url = data.url

      event.waitUntil(
        caches
          .open(AUDIO_CACHE)
          .then(async (cache) => {
            const existing =
              await cache.match(
                url,
              )

            if (existing) {
              return
            }

            try {
              const response =
                await fetch(url, {
                  method: 'GET',
                  mode: 'no-cors',
                  cache: 'no-store',
                })

              if (
                response &&
                (
                  response.type ===
                    'opaque' ||
                  response.ok
                ) &&
                response.status !== 206
              ) {
                await cache.put(
                  url,
                  response,
                )
              }
            } catch (error) {
              console.warn(
                'SAMEE3: background audio cache failed.',
                error,
              )
            }
          }),
      )
    }
  },
)