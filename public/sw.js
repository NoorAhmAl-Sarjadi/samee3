/* =========================================================
   SAMEE3 Quran - Service Worker
   Offline / PWA Cache
   ========================================================= */

const CACHE_VERSION = 'samee3-v4';
const APP_CACHE = `${CACHE_VERSION}-app`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

/*
 * ملفات أساسية يمكن تشغيلها Offline.
 * لا نضع هنا ملفات خارجية أو API responses.
 */
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

/*
 * أثناء التحديث:
 * نحذف إصدارات الكاش القديمة.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/*
 * السيطرة على الصفحات المفتوحة فورًا بعد التفعيل.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName.startsWith('samee3-') &&
                cacheName !== APP_CACHE &&
                cacheName !== PAGE_CACHE &&
                cacheName !== STATIC_CACHE
              );
            })
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

/*
 * التحقق من أن الطلب من نفس الموقع.
 */
function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

/*
 * استبعاد الأشياء التي لا نريد Service Worker
 * أن يتدخل فيها.
 */
function shouldIgnoreRequest(request) {
  const url = new URL(request.url);

  /*
   * لا نتعامل مع POST / PUT / PATCH / DELETE.
   * الكاش مخصص لطلبات GET فقط.
   */
  if (request.method !== 'GET') {
    return true;
  }

  /*
   * لا نتدخل في المواقع الخارجية.
   * مثل YouTube أو أي CDN خارجي.
   */
  if (!isSameOrigin(request)) {
    return true;
  }

  /*
   * لا نخزن طلبات Next الداخلية الديناميكية كصفحات عادية.
   * ملفات JS/CSS والصور يمكن تخزينها.
   */
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/image')
  ) {
    return true;
  }

  return false;
}

/*
 * هل الطلب عبارة عن navigation لصفحة؟
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

/*
 * هل الملف من ملفات Next.js الثابتة؟
 */
function isStaticAsset(request) {
  const url = new URL(request.url);

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
  );
}

/*
 * Network First:
 * نحاول الحصول على أحدث نسخة من الإنترنت.
 * عند انقطاع الإنترنت نستخدم النسخة المحفوظة.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);

    /*
     * نحفظ فقط الاستجابات السليمة.
     */
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error('Offline and resource is not cached');
  }
}

/*
 * Cache First:
 * مناسب للملفات الثابتة التي تحمل باسم version/hash.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    throw new Error('Offline and static resource is not cached');
  }
}

/*
 * التعامل مع كل الطلبات.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  /*
   * Service Worker يتدخل في GET من نفس الموقع فقط.
   */
  if (shouldIgnoreRequest(request)) {
    return;
  }

  /*
   * صفحات التطبيق:
   * Network First ثم الكاش عند عدم وجود الإنترنت.
   */
  if (isNavigationRequest(request)) {
    event.respondWith(
      networkFirst(request, PAGE_CACHE).catch(async () => {
        /*
         * في حال لم نجد الصفحة نفسها في الكاش،
         * نحاول استخدام الصفحة الرئيسية المحفوظة
         * بدل عرض صفحة متصفح مكسورة.
         */
        const cache = await caches.open(APP_CACHE);

        return (
          await cache.match('/') ||
          new Response(
            `
              <!doctype html>
              <html lang="ar" dir="rtl">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width,initial-scale=1">
                  <title>مصحف سميع</title>
                  <style>
                    body {
                      margin: 0;
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      background: #fcfbf8;
                      color: #0f172a;
                      font-family: Arial, sans-serif;
                      text-align: center;
                      padding: 24px;
                    }
                  </style>
                </head>
                <body>
                  <div>
                    <h2>مصحف سميع</h2>
                    <p>هذه الصفحة غير محفوظة على الجهاز للعمل بدون إنترنت.</p>
                  </div>
                </body>
              </html>
            `,
            {
              status: 503,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
              },
            }
          )
        );
      })
    );

    return;
  }

  /*
   * ملفات Next.js والملفات الثابتة:
   * Cache First.
   */
  if (isStaticAsset(request)) {
    event.respondWith(
      cacheFirst(request, STATIC_CACHE)
    );

    return;
  }

  /*
   * باقي ملفات الموقع:
   * Network First مع الاحتفاظ بما تم تحميله سابقًا.
   */
  event.respondWith(
    networkFirst(request, STATIC_CACHE).catch(async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      throw new Error('Offline resource is not cached');
    })
  );
});

/*
 * رسالة اختيارية من التطبيق لمسح الكاش عند الحاجة.
 */
self.addEventListener('message', (event) => {
  if (!event.data) {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_SAMEE3_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('samee3-'))
            .map((name) => caches.delete(name))
        );
      })
    );
  }
});