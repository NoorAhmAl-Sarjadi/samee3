import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const REVISION = '437a56dfaa70faa1818c914033f7021f05b0f92c'

const SOURCE =
  `https://raw.githubusercontent.com/SalehGNUTUX/GT-SQR/${REVISION}/`

const ROOT_FILES = new Set([
  'index.html',
  'app.js',
  'export-engine-web.js',
  'platform-io.js',
  'fonts-data.js',
  'mp4-muxer.js',
  'mp4-muxer.mjs',
  'webm-muxer.js',
  'webm-muxer.mjs',
  'manifest.json',
  'gt-sqr-icon.png',
  'icon-192.png',
  'icon-512.png',
  'LICENSE',
  'README.md',
  'readme.md',
  'CHANGELOG.md',
])

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  ico: 'image/x-icon',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  md: 'text/plain; charset=utf-8',
}

function replaceOnce(
  source: string,
  before: string,
  after: string,
) {
  if (
    !source.includes(before) ||
    source.indexOf(before) !== source.lastIndexOf(before)
  ) {
    throw new Error('GT source does not match the pinned revision')
  }

  return source.replace(before, after)
}

function patchApp(source: string) {
  source = replaceOnce(
    source,
    '"use strict";',
    `"use strict";
// Samee3 integration: loading handshake and stale-request protection.
let samee3Ready = false, samee3VerseRequest = 0, samee3TranslationRequest = 0;

window.addEventListener('message', event => {
  if (
    event.origin === location.origin &&
    event.source === window.parent &&
    event.data?.type === 'samee3-gt-status' &&
    samee3Ready
  ) {
    window.parent.postMessage(
      { type: 'samee3-gt-ready' },
      location.origin
    );
  }
});`,
  )

  source = replaceOnce(
    source,
    '  initPwaInstall();',
    `  initPwaInstall();
  samee3Ready = true;
  window.parent.postMessage(
    { type: 'samee3-gt-ready' },
    location.origin
  );`,
  )

  source = replaceOnce(
    source,
    'navigator.serviceWorker.register("sw.js").catch(() => { });',
    '/* Samee3 manages the service worker; GT keeps its own data keys. */',
  )

  source = replaceOnce(
    source,
    'async function loadVerses() {',
    'async function loadVerses() {\n  const samee3Request = ++samee3VerseRequest;',
  )

  source = replaceOnce(
    source,
    '  verses = applyBasmalaSlice(verses, surahNum);',
    '  if (samee3Request !== samee3VerseRequest) return;\n  verses = applyBasmalaSlice(verses, surahNum);',
  )

  source = replaceOnce(
    source,
    'async function loadTranslations() {',
    'async function loadTranslations() {\n  const samee3Request = ++samee3TranslationRequest;',
  )

  source = replaceOnce(
    source,
    '  S.translations = allAyahs',
    '  if (samee3Request !== samee3TranslationRequest) return;\n  S.translations = allAyahs',
  )

  source = replaceOnce(
    source,
    '} catch (e) { S.translations = []; return; }',
    '} catch (e) { if (samee3Request === samee3TranslationRequest) S.translations = []; return; }',
  )

  source = replaceOnce(
    source,
    'folder: "abu_bakr_ash-shaatree_128kbps"',
    'folder: "Abu_Bakr_Ash-Shaatree_128kbps"',
  )

  source = replaceOnce(
    source,
    '{ id: "hussary_w",  name: "الحصري مرتل (ورش)",         flag: "🇪🇬", folder: "warsh/Husary_Murattal_warsh_128kbps" }',
    '{ id: "basit_w", name: "عبد الباسط (ورش)", flag: "🇪🇬", folder: "warsh/warsh_Abdul_Basit_128kbps" }',
  )

  const start = source.indexOf('async function loadLocalFonts(')
  const end = source.indexOf('\nfunction loadCustomFonts(', start)

  if (start < 0 || end < 0) {
    throw new Error('GT font loader not found')
  }

  let fonts = source.slice(start, end)

  fonts = replaceOnce(
    fonts,
    'for (const item of list) {',
    'await Promise.all(list.map(async item => {',
  )

  fonts = replaceOnce(
    fonts,
    'if (!item.name || !item.file) continue;',
    'if (!item.name || !item.file) return;',
  )

  fonts = replaceOnce(
    fonts,
    '    }\n    renderFontGrid();',
    '    }));\n    renderFontGrid();',
  )

  return source.slice(0, start) + fonts + source.slice(end)
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ asset?: string[] }>
  },
) {
  const { asset = [] } = await context.params
  const file = asset.join('/') || 'index.html'

  const valid =
    ROOT_FILES.has(file) ||
    /^fonts\/[\p{L}\p{N} _().-]+\.(json|ttf|otf|woff2?)$/u.test(file) ||
    /^GT-SQR-icons\/(all\/[0-9]+x[0-9]+|favicon)\/[A-Za-z0-9.-]+\.png$/.test(file)

  if (
    !valid ||
    asset.some(part =>
      !part ||
      part === '.' ||
      part === '..' ||
      /[\\/]/.test(part),
    )
  ) {
    return new NextResponse('Not found', {
      status: 404,
    })
  }

  try {
    const response = await fetch(
      SOURCE + file.split('/').map(encodeURIComponent).join('/'),
      {
        ...(
          file === 'fonts/Arslan Wessam.ttf'
            ? { cache: 'no-store' as const }
            : { next: { revalidate: 86400 } }
        ),
        signal: AbortSignal.timeout(25000),
        redirect: 'error',
      },
    )

    if (!response.ok) {
      throw new Error('GT source unavailable')
    }

    let body: Uint8Array<ArrayBuffer> =
      new Uint8Array(await response.arrayBuffer())

    if (body.byteLength > 3 * 1024 * 1024) {
      throw new Error('GT asset too large')
    }

    if (
      file === 'index.html' ||
      file === 'app.js' ||
      file === 'export-engine-web.js'
    ) {
      let text = new TextDecoder().decode(body)

      if (file === 'index.html') {
        text = replaceOnce(
          text,
          '<head>',
          '<head><base href="/api/gt-sqr/">',
        )
      } else if (file === 'app.js') {
        text = patchApp(text)
      } else {
        text = replaceOnce(
          text,
          'codec: pickedV.videoCodec,',
          'codec: fmt.muxer === "webm" ? "V_" + pickedV.videoCodec.toUpperCase() : pickedV.videoCodec,',
        )

        text = replaceOnce(
          text,
          'codec: pickedA.audioCodec,',
          'codec: fmt.muxer === "webm" ? "A_" + pickedA.audioCodec.toUpperCase() : pickedA.audioCodec,',
        )

        text =
          '// Modified for Samee3: correct WebM track codec identifiers. Original GT-SQR license and authorship retained.\n' +
          text
      }

      body = new TextEncoder().encode(text)
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type':
          TYPES[file.split('.').pop() || ''] ||
          'text/plain; charset=utf-8',
        'Cache-Control':
          'public, max-age=3600, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new NextResponse(
      'تعذر تحميل محرر GT-SQR. تحقق من الاتصال ثم أعد المحاولة.',
      {
        status: 502,
        headers