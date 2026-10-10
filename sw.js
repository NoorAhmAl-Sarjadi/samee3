const CACHE_VERSION = 'samee3-v3'

const APP_CACHE = `${CACHE_VERSION}-app`
const PAGE_CACHE = `${CACHE_VERSION}-pages`
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RIWAYA_IMAGE_CACHE = `${CACHE_VERSION}-riwaya-images`

/*
 * يجب أن يتطابق الاسم مع المخزن المستخدم في:
 * app/mushaf/page.tsx
 * app/audio/page.tsx
 *
 * لا تغيّر هذا الاسم دون تعديل الملفات التي تعتمد عليه.
 */
const AUDIO_CACHE = 'samee3-audio-v2'

/*
 * مخازن قديمة نحتفظ بها لتفادي حذف محتوى المستخدم المحفوظ.
 */
const LEGACY_AUDIO_CACHES = [
  'samee3-v2-audio',
]

const APP_MANAGED_CACHES = new Set([
  'samee3-mushaf-pages-v2',
  'samee3-audio-v2',
  'samee3-v2-audio',
])

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/mushaf',
]

const AUDIO_HOST_ALLOWLIST = new Set([
  'mp3quran.net',
])

function isAllowedAudioUrl(value) {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:') return false

    const hostname = url.hostname.toLowerCase()
    const allowedHost =
      AUDIO_HOST_ALLOWLIST.has(hostname) ||
      hostname.endsWith('.mp3quran.net')

    return allowedHost && /\.mp3$/i.test(url.pathname)
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

    const isMp3 = /\.mp3$/i.test(url.pathname)
    const isAudioDestination = request.destination === 'audio'

    return allowedHost && (isMp3 || isAudioDestination)
  } catch {
    return false
  }
}

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin
  } catch {
    return false
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
}

function isStaticAsset(request) {
  let pathname

  try {
    pathname = new URL(request.url).pathname
  } catch {
    return false
  }

  return (
    pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|ico)$/i.test(
      pathname,
    )
  )
}

function shouldIgnoreRequest(request) {
  if (!request || request.method !== 'GET') return true
  if (!isSameOrigin(request)) return true

  let pathname

  try {
    pathname = new URL(request.url).pathname
  } catch {
    return true
  }

  /*
   * تحتفظ صفحات المصحف بإجابات واجهات API داخل مخزنها الخاص.
   * لا نتدخل في طلبات API أو تحسين الصور الخاص بـ Next.js.
   */
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/image')
  ) {
    return true
  }

  return false
}

async function safeCachePut(cache, request, response) {
  if (!cache || !response || !response.ok) return false

  try {
    await cache.put(request, response.clone())
    return true
  } catch (error) {
    console.warn('SAMEE3: تعذر تخزين المورد مؤقتًا.', error)
    return false
  }
}

async function findCachedAudio(url) {
  const cacheNames = [
    AUDIO_CACHE,
    ...LEGACY_AUDIO_CACHES,
  ]

  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName)
      const response = await cache.match(url)

      if (response) return response
    } catch (error) {
      console.warn(
        `SAMEE3: تعذر فحص مخزن الصوت ${cacheName}.`,
        error,
      )
    }
  }

  return null
}

/*
 * سياسة الصوت:
 * 1. البحث عن النسخة المحفوظة في المخزن الحالي والمخازن القديمة.
 * 2. محاولة جلب الملف من المصدر عند الاتصال.
 * 3. تخزين الاستجابة الكاملة فقط، وعدم حفظ 206 كأنه ملف كامل.
 * 4. عند انقطاع الشبكة، إعادة الملف المحفوظ إن وجد.
 */
async function cacheAudioResponse(request) {
  const cached = await findCachedAudio(request.url)

  if (cached) return cached

  let response

  try {
    response = await fetch(request)
  } catch (error) {
    const offlineCopy = await findCachedAudio(request.url)

    if (offlineCopy) return offlineCopy

    throw error
  }

  if (
    response &&
    response.status !== 206 &&
    (response.ok || response.type === 'opaque')
  ) {
    try {
      const cache = await caches.open(AUDIO_CACHE)

      /*
       * نستخدم الرابط الأصلي مفتاحًا ثابتًا حتى لا تنشأ نسخة
       * مختلفة لكل طلب Range يرسله مشغل الصوت.
       */
      await cache.put(request.url, response.clone())
    } catch (error) {
      console.warn(
        'SAMEE3: تعذر حفظ الصوت في مخزن التطبيق.',
        error,
      )
    }
  }

  return response
}

/*
 * تثبيت مرن:
 * فشل تنزيل مورد واحد لا يمنع تثبيت Service Worker بأكمله.
 */
async function precacheAppShell() {
  const cache = await caches.open(APP_CACHE)

  await Promise.all(
    PRECACHE_URLS.map(async (path) => {
      try {
        const request = new Request(
          new URL(path, self.location.origin).href,
          { cache: 'reload' },
        )

        const response = await fetch(request)

        if (response && response.ok) {
          await cache.put(request, response.clone())
        } else {
          console.warn(
            `SAMEE3: لم يمكن تجهيز المورد ${path} مسبقًا.`,
          )
        }
      } catch (error) {
        console.warn(
          `SAMEE3: تعذر تجهيز المورد ${path}.`,
          error,
        )
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAppShell().then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()

      await Promise.all(
        cacheNames.map(async (cacheName) => {
          /*
           * نحذف مخازن إصدارات Service Worker القديمة فقط.
           * لا نحذف مخزن بيانات المصحف أو التنزيلات الصوتية.
           */
          if (
            cacheName.startsWith('samee3-v') &&
            cacheName !== APP_CACHE &&
            cacheName !== PAGE_CACHE &&
            cacheName !== STATIC_CACHE &&
            cacheName !== RIWAYA_IMAGE_CACHE &&
            !APP_MANAGED_CACHES.has(cacheName)
          ) {
            await caches.delete(cacheName)
          }
        }),
      )

      await self.clients.claim()
    })(),
  )
}

/*
 * استراتيجية الشبكة أولًا للصفحات:
 * عند نجاح الاتصال، نحدّث النسخة المحفوظة.
 * عند انقطاعه، نبحث عن الصفحة نفسها، ثم عن نسخة محفوظة
 * من المسار نفسه حتى لو اختلفت معاملات الرابط.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  let response

  try {
    response = await fetch(request)
  } catch {
    const exactMatch = await cache.match(request)

    if (exactMatch) return exactMatch

    const samePathMatch = await cache.match(request, {
      ignoreSearch: true,
    })

    if (samePathMatch) return samePathMatch

    throw new Error('Offline and resource is not cached')
  }

  if (response && response.ok) {
    await safeCachePut(cache, request, response)
  }

  return response
}

/*
 * استراتيجية الكاش أولًا للملفات الثابتة:
 * تستفيد من الملفات المخزنة فورًا، وتحمّل الملفات الجديدة
 * من الشبكة عند عدم وجود نسخة محفوظة.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) return cachedResponse

  let response

  try {
    response = await fetch(request)
  } catch (error) {
    throw error
  }

  if (response && response.ok) {
    await safeCachePut(cache, request, response)
  }

  return response
}

/*
 * يعالج الصور المحلية المستخدمة في بعض الروايات.
 * تظل صفحة المصحف قادرة على استخدام مخزنها الخاص أيضًا.
 */
async function cacheRiwayaImageResponse(request) {
  const cache = await caches.open(RIWAYA_IMAGE_CACHE)
  const cached = await cache.match(request)

  if (cached) return cached

  let response

  try {
    response = await fetch(request)
  } catch (error) {
    const fallback = await cache.match(request)

    if (fallback) return fallback

    throw error
  }

  if (response && response.ok) {
    await safeCachePut(cache, request, response)
  }

  return response
}

function isRiwayaImageRequest(request) {
  if (
    !request ||
    request.method !== 'GET' ||
    !isSameOrigin(request)
  ) {
    return false
  }

  try {
    return (
      new URL(request.url).pathname ===
      '/api/mushaf-riwaya-image'
    )
  } catch {
    return false
  }
}

/*
 * صفحة بديلة عند عدم وجود نسخة محفوظة من المسار المطلوب.
 * لا ندّعي أن المحتوى متاح Offline إذا لم يتم حفظه مسبقًا.
 */
function createOfflineFallback() {
  return new Response(
    `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0284C7">
<title>مصحف سميع — بدون اتصال</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  padding:24px;
  background:#F4F9FE;
  color:#0F172A;
  font-family:Tahoma,Arial,sans-serif;
  text-align:center
}
main{
  width:100%;
  max-width:460px;
  padding:32px 24px;
  border:1px solid #D9EAF5;
  border-radius:28px;
  background:#fff;
  box-shadow:0 16px 48px rgba(15,23,42,.07)
}
.symbol{
  display:grid;
  place-items:center;
  width:68px;
  height:68px;
  margin:0 auto 20px;
  border-radius:22px;
  background:#E8F5FC;
  color:#0284C7;
  font-size:32px
}
h1{margin:0 0 12px;font-size:25px}
p{color:#64748B;line-height:1.9;font-size:14px}
.actions{display:grid;gap:10px;margin-top:24px}
a,button{
  display:block;
  width:100%;
  padding:13px 16px;
  border:0;
  border-radius:14px;
  font:inherit;
  font-size:14px;
  font-weight:700;
  text-decoration:none;
  cursor:pointer
}
.primary{background:#0284C7;color:white}
.secondary{background:#F1F5F9;color:#334155}
</style>
</head>
<body>
<main>
<div class="symbol" aria-hidden="true">۞</div>
<h1>مصحف سميع</h1>
<p>
  لا يوجد اتصال بالإنترنت حاليًا، وهذه الصفحة لم تُحفظ على جهازك بعد.
  اتصل بالإنترنت وافتح القسم المطلوب مرة واحدة لتجهيزه للاستخدام دون اتصال.
</p>
<div class="actions">
<a class="primary" href="/">العودة إلى الرئيسية</a>
<button class="secondary" onclick="location.reload()">إعادة المحاولة</button>
</div>
</main>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

async function handleNavigation(request) {
  try {
    return await networkFirst(request, PAGE_CACHE)
  } catch {
    const pageCache = await caches.open(PAGE_CACHE)

    const exactMatch = await pageCache.match(request)
    if (exactMatch) return exactMatch

    /*
     * يسمح بإعادة استخدام نسخة المسار المحفوظة إذا تغيّر
     * page أو surah أو أي query parameter في الرابط.
     */
    const samePathMatch = await pageCache.match(request, {
      ignoreSearch: true,
    })

    if (samePathMatch) return samePathMatch

    const url = new URL(request.url)
    const pathname =
      url.pathname.length > 1
        ? url.pathname.replace(/\/+$/, '')
        : '/'

    const appCache = await caches.open(APP_CACHE)

    const appPathMatch =
      (pathname === '/' || pathname === '/mushaf')
        ? await appCache.match(pathname)
        : null

    if (appPathMatch) return appPathMatch

    const homeShell = await appCache.match('/')
    if (pathname === '/' && homeShell) return homeShell

    return createOfflineFallback()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (!request || request.method !== 'GET') return

  /*
   * الصوت الخارجي يُعالج قبل فحص same-origin.
   */
  if (isAllowedQuranAudioRequest(request)) {
    event.respondWith(cacheAudioResponse(request))
    return
  }

  if (isRiwayaImageRequest(request)) {
    event.respondWith(cacheRiwayaImageResponse(request))
    return
  }

  if (shouldIgnoreRequest(request)) return

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request))
    return
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  /*
   * للطلبات الأخرى من نفس النطاق، نحاول الشبكة أولًا ثم
   * نستخدم النسخة المخزنة إذا تعذّر الاتصال.
   */
  event.respondWith(
    networkFirst(request, STATIC_CACHE).catch(async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cachedResponse = await cache.match(request)

      if (cachedResponse) return cachedResponse

      throw new Error('Offline resource is not cached')
    }),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data

  if (!data || typeof data.type !== 'string') return

  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting())
    return
  }

  /*
   * مسح شامل للمخازن عند طلبه صراحةً من التطبيق.
   * تنبيه: هذا الأمر يمسح كذلك ملفات المصحف والصوت المحفوظة.
   */
  if (data.type === 'CLEAR_SAMEE3_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('samee3-'))
            .map((name) => caches.delete(name)),
        ),
      ),
    )
    return
  }

  /*
   * يسمح للمصحف ببدء حفظ ملف MP3 كامل من خلال Service Worker،
   * حتى إذا تعذّر على الصفحة قراءة الاستجابة بسبب CORS.
   */
  if (
    data.type === 'CACHE_AUDIO_URL' &&
    typeof data.url === 'string'
  ) {
    const url = data.url

    event.waitUntil(
      (async () => {
        let ok = false
        let errorMessage = ''

        if (!isAllowedAudioUrl(url)) {
          errorMessage = 'رابط الصوت غير مسموح به.'
        } else {
          try {
            const cache = await caches.open(AUDIO_CACHE)
            const existing = await cache.match(url)

            if (existing) {
              ok = true
            } else {
              /*
               * نجرب أولًا استجابة قابلة للقراءة.
               */
              try {
                const corsResponse = await fetch(url, {
                  method: 'GET',
                  mode: 'cors',
                  credentials: 'omit',
                  cache: 'no-store',
                })

                if (
                  corsResponse.ok &&
                  corsResponse.status !== 206
                ) {
                  await cache.put(url, corsResponse.clone())
                  ok = true
                }
              } catch {
                // ننتقل إلى الاستجابة opaque.
              }

              if (!ok) {
                const opaqueResponse = await fetch(url, {
                  method: 'GET',
                  mode: 'no-cors',
                  credentials: 'omit',
                  cache: 'no-store',
                })

                if (opaqueResponse.type === 'opaque') {
                  await cache.put(url, opaqueResponse.clone())
                  ok = true
                } else if (
                  opaqueResponse.ok &&
                  opaqueResponse.status !== 206
                ) {
                  await cache.put(url, opaqueResponse.clone())
                  ok = true
                }
              }
            }
          } catch (error) {
            errorMessage =
              error instanceof Error
                ? error.message
                : 'تعذر حفظ الصوت.'
          }
        }

        /*
         * نبلغ الصفحة بالنتيجة بدل الاعتماد فقط على مهلة زمنية.
         * يظل إرسال الرسالة اختياريًا حتى لا يتسبب غياب الصفحة
         * في فشل مهمة التخزين.
         */
        try {
          if (event.source && 'postMessage' in event.source) {
            event.source.postMessage({
              type: 'CACHE_AUDIO_URL_RESULT',
              url,
              ok,
              error: errorMessage || undefined,
            })
          }
        } catch {
          // قد تكون الصفحة قد أُغلقت قبل اكتمال الحفظ.
        }

        if (!ok) {
          console.warn(
            'SAMEE3: تعذر حفظ الملف الصوتي.',
            errorMessage,
          )
        }
      })(),
    )
  }
})
