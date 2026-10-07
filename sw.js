const CACHE_VERSION = 'samee3-v2';
const APP_CACHE = `${CACHE_VERSION}-app`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const RIWAYA_IMAGE_CACHE = `${CACHE_VERSION}-riwaya-images`;

/*
 * هذا الكاش القديم ينشئه app/mushaf/page.tsx مباشرة عبر Cache Storage.
 * نحتفظ به عند تفعيل نسخة جديدة حتى لا تضيع صفحات المصحف المخزنة سابقًا.
 */
const APP_MANAGED_CACHES = new Set([
  'samee3-mushaf-pages-v2',
]);

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/mushaf',
];

const AUDIO_HOST_ALLOWLIST = new Set([
  'mp3quran.net',
]);

function isAllowedQuranAudioRequest(request) {
  if (!request || request.method !== 'GET') return false;

  try {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const isAllowedHost =
      AUDIO_HOST_ALLOWLIST.has(hostname) ||
      hostname.endsWith('.mp3quran.net');

    const isMp3 = /\.mp3(?:$|[?#])/i.test(url.pathname + url.search + url.hash);
    const isAudioDestination = request.destination === 'audio';

    return isAllowedHost && (isMp3 || isAudioDestination);
  } catch {
    return false;
  }
}

async function cacheAudioResponse(request) {
  const cache = await caches.open(AUDIO_CACHE);

  const cached = await cache.match(request.url);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  /*
   * لا نخزن استجابة 206 الجزئية الناتجة عن Range requests.
   * app/mushaf/page.tsx يقوم بتخزين نسخة 200 كاملة في الخلفية،
   * وعند وجودها يستطيع هذا الـService Worker تقديمها Offline.
   */
  if (response && (response.ok || response.type === 'opaque') && response.status !== 206) {
    try {
      await cache.put(request.url, response.clone());
    } catch (error) {
      console.warn('SAMEE3: تعذر حفظ ملف الصوت في كاش الـService Worker.', error);
    }
  }

  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              if (!cacheName.startsWith('samee3-')) return false;

              return (
                cacheName !== APP_CACHE &&
                cacheName !== PAGE_CACHE &&
                cacheName !== STATIC_CACHE &&
                cacheName !== AUDIO_CACHE &&
                cacheName !== RIWAYA_IMAGE_CACHE &&
                APP_MANAGED_CACHES.has(cacheName) === false
              );
            })
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function shouldIgnoreRequest(request) {
  const url = new URL(request.url);

  if (request.method !== 'GET') return true;
  if (!isSameOrigin(request)) return true;

  /*
   * الـAPI يتولى تخزينه التطبيق نفسه عبر Cache Storage.
   * لا نريد أن نحول كل استجابة API إلى Navigation cache.
   */
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/image')
  ) {
    return true;
  }

  return false;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

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

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) return cachedResponse;

    throw new Error('Offline and resource is not cached');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) return cachedResponse;

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


async function cacheRiwayaImageResponse(request) {
  const cache = await caches.open(RIWAYA_IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

function isRiwayaImageRequest(request) {
  if (!request || request.method !== 'GET' || !isSameOrigin(request)) return false;
  try {
    return new URL(request.url).pathname === '/api/mushaf-riwaya-image';
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  /*
   * أولًا: القرآن الصوتي الخارجي.
   * هذا يجب أن يأتي قبل isSameOrigin لأن MP3Quran مصدر خارجي.
   */
  if (isAllowedQuranAudioRequest(request)) {
    event.respondWith(
      cacheAudioResponse(request).catch(async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const cachedResponse = await cache.match(request.url);

        if (cachedResponse) return cachedResponse;

        throw new Error('Offline and Quran audio is not cached');
      })
    );

    return;
  }

  if (isRiwayaImageRequest(request)) {
    event.respondWith(cacheRiwayaImageResponse(request));
    return;
  }

  if (shouldIgnoreRequest(request)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      networkFirst(request, PAGE_CACHE).catch(async () => {
        const cache = await caches.open(APP_CACHE);

        return (
          await cache.match('/') ||
          new Response(
            `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>مصحف سميع</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fcfbf8;color:#0f172a;font-family:Arial,sans-serif;text-align:center;padding:24px}
.card{max-width:520px}
</style>
</head>
<body><div class="card"><h2>مصحف سميع</h2><p>المحتوى المطلوب غير محفوظ على الجهاز للعمل بدون إنترنت.</p></div></body>
</html>`,
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          )
        );
      })
    );

    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(
    networkFirst(request, STATIC_CACHE).catch(async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) return cachedResponse;

      throw new Error('Offline resource is not cached');
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (data.type === 'CLEAR_SAMEE3_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('samee3-'))
            .map((name) => caches.delete(name))
        );
      })
    );
    return;
  }

  /*
   * يسمح للتطبيق ببدء تخزين ملف صوت كامل في الخلفية.
   * نستخدم fetch بدون CORS حتى نتمكن من تخزين الاستجابة opaque
   * في الحالات التي لا يسمح فيها المصدر بقراءة الـbody من الصفحة.
   */
  if (data.type === 'CACHE_AUDIO_URL' && typeof data.url === 'string') {
    const url = data.url;

    event.waitUntil(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const existing = await cache.match(url);
        if (existing) return;

        try {
          const response = await fetch(url, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store',
          });

          if (response && (response.type === 'opaque' || response.ok) && response.status !== 206) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.warn('SAMEE3: background audio cache failed.', error);
        }
      })
    );
  }
});