// Path: proxy.ts — NEW. Place beside package.json, not inside app/ or public/.
// Next.js 16 discovers this file automatically. No existing file is modified.
// This adds a separate, server-rendered compatibility view for public content.
// It cannot add missing TLS, media codecs or video recording to an old device.

import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { RIWAYAT, SURAH_NAMES_AR, type RiwayaId } from '@/lib/quran/Samee3DataAdapter'
import { HAFS_JUZ_RANGES } from '@/lib/quran/juz-boundaries'
import { parseAdhkarCategories } from '@/lib/adhkar-catalog'
import { HADITH_BOOKS, parseHadithChapters, parseChapterHadiths } from '@/lib/hadith-catalog'
import { LEARNING_COURSES, LEARNING_LEVELS } from '@/lib/islamic/curriculum'
import { SUNNI_LIBRARY_CATEGORIES } from '@/lib/islamic/sunniLibrary'
import { safeIslamicLibraryLink } from '@/lib/islamic/safeLinks'
import { parsePrayerDay, PRAYERS, qiblaBearing } from '@/lib/prayer-times'

const MODE_COOKIE = 'samee3_compat'
const MODE_DAYS = 30 * 24 * 60 * 60
const FETCH_TIMEOUT = 12000
const MAX_JSON_BYTES = 4 * 1024 * 1024
const READING_IDS: Record<RiwayaId, number> = {
  hafs: 1,
  warsh: 2,
  qalun: 5,
  douri: 13,
  shubah: 15,
  sousi: 7,
  bazzi: 4,
}
const NAV = [
  ['/', 'الرئيسية'],
  ['/mushaf', 'المصحف'],
  ['/surahs', 'فهرس القرآن'],
  ['/audio', 'الصوتيات'],
  ['/adhkar', 'الأذكار'],
  ['/hadith', 'الحديث'],
  ['/prayer', 'الصلاة والقبلة'],
  ['/islamic-library', 'المكتبة'],
  ['/visual-ayahs', 'الآيات المرئية'],
] as const

type RecordValue = Record<string, unknown>
type Page = { title: string; html: string; status?: number }
type Verse = {
  text: string
  numberInSurah: number
  juz: number
  surah: { number: number; name: string }
  hafsNumbers?: number[]
}
type Location = { surah: number; ayah: number; page: number; hafsNumbers?: number[] }

function object(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {}
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
function escape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!
  )
}
function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback
}
function href(path: string, params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams({ compat: '1' })
  for (const [key, value] of Object.entries(params)) query.set(key, String(value))
  return `${path}?${query.toString()}`
}
function link(path: string, label: string, params: Record<string, string | number> = {}): string {
  return `<a class="button" href="${escape(href(path, params))}">${escape(label)}</a>`
}
function external(url: unknown, label: string): string {
  const safe = safeIslamicLibraryLink(url)
  return safe
    ? `<a class="button" href="${escape(safe)}" rel="noreferrer">${escape(label)}</a>`
    : ''
}
function selected(actual: unknown, expected: unknown): string {
  return String(actual) === String(expected) ? ' selected' : ''
}
function hidden(name: string, value: string | number): string {
  return `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`
}
function reading(request: NextRequest): RiwayaId {
  const id = request.nextUrl.searchParams.get('riwaya')
  return RIWAYAT.find((item) => item.id === id)?.id || 'hafs'
}
function readingSelect(id: RiwayaId): string {
  return `<label>الرواية <select name="riwaya">${RIWAYAT.map(
    (item) => `<option value="${item.id}"${selected(item.id, id)}>${escape(item.label)}</option>`
  ).join('')}</select></label>`
}
function surahSelect(surah: number): string {
  return `<label>السورة <select name="surah">${SURAH_NAMES_AR.map(
    (name, index) =>
      `<option value="${index + 1}"${selected(index + 1, surah)}>${index + 1}. ${escape(name)}</option>`
  ).join('')}</select></label>`
}
function form(path: string, content: string): string {
  return `<form method="get" action="${escape(path)}" class="panel controls">${hidden('compat', 1)}${content}<button type="submit">عرض</button></form>`
}
function pager(
  path: string,
  index: number,
  total: number,
  params: Record<string, string | number>,
  key = 'p'
): string {
  return `<div class="pager">${index > 1 ? link(path, 'السابق', { ...params, [key]: index - 1 }) : ''}
    <span dir="ltr"> ${index} / ${total} </span>
    ${index < total ? link(path, 'التالي', { ...params, [key]: index + 1 }) : ''}</div>`
}
function message(value: string): string {
  return `<p class="notice">${escape(value)}</p>`
}
function audio(url: string, title: string): string {
  return `<div class="panel"><h3>${escape(title)}</h3><audio controls preload="none" src="${escape(url)}">
    <a href="${escape(url)}">فتح التسجيل</a></audio><p><a href="${escape(url)}">فتح التسجيل مباشرة</a></p></div>`
}

// Only fixed, public endpoints are requested here. Never forward auth or cookies.
// API/assets are excluded from the matcher, so these requests cannot recurse.
async function json(request: NextRequest, path: string): Promise<unknown> {
  const url = new URL(path, request.nextUrl.origin)
  if (
    url.origin !== request.nextUrl.origin &&
    !['https://mp3quran.net', 'https://api.aladhan.com'].includes(url.origin)
  ) {
    throw new Error('Unsupported source')
  }
  const controller = new AbortController()
  const cancel = () => controller.abort()
  request.signal.addEventListener('abort', cancel, { once: true })
  if (request.signal.aborted) cancel()
  const timer = setTimeout(cancel, FETCH_TIMEOUT)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-Samee3-Compat': '1' },
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
      await response.body?.cancel()
      throw new Error(`Source unavailable: ${response.status}`)
    }
    if (Number(response.headers.get('content-length')) > MAX_JSON_BYTES || !response.body) {
      await response.body?.cancel()
      throw new Error('Response too large or empty')
    }
    reader = response.body.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []
    let bytes = 0
    while (true) {
      const item = await reader.read()
      if (item.done) break
      bytes += item.value.byteLength
      if (bytes > MAX_JSON_BYTES) throw new Error('Response too large')
      chunks.push(decoder.decode(item.value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return JSON.parse(chunks.join('')) as unknown
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', cancel)
    await reader?.cancel().catch(() => {})
    controller.abort()
  }
}

function home(): Page {
  return {
    title: 'سميع للشاشات والأجهزة',
    html:
      message('نسخة خفيفة للقراءة والاستماع، بأزرار واضحة للشاشات والريموت ولوحة المفاتيح.') +
      `<div class="cards">${NAV.slice(1)
        .map(
          ([path, label]) =>
            `<a class="card" href="${escape(href(path))}"><strong>${escape(label)}</strong><span>فتح القسم</span></a>`
        )
        .join('')}</div>`,
  }
}

async function mushaf(request: NextRequest): Promise<Page> {
  const query = request.nextUrl.searchParams
  const id = reading(request)
  const page = integer(query.get('page'), 1, 1, 604)
  const image = query.get('view') === 'image'
  const size = integer(query.get('size'), 2, 1, 3)
  const params = { riwaya: id, view: image ? 'image' : 'text', size }
  const controls = form(
    '/mushaf',
    readingSelect(id) +
      `<label>الصفحة <input type="number" name="page" min="1" max="604" value="${page}"></label>
    <label>العرض <select name="view"><option value="text"${selected(image, false)}>نص مقروء</option><option value="image"${selected(image, true)}>صفحة المصحف</option></select></label>
    <label>حجم النص <select name="size">${[1, 2, 3]
      .map(
        (value) =>
          `<option value="${value}"${selected(value, size)}>${['عادي', 'كبير', 'أكبر'][value - 1]}</option>`
      )
      .join('')}</select></label>`
  )
  const navigation = pager('/mushaf', page, 604, params, 'page')
  const title = `${RIWAYAT.find((item) => item.id === id)!.label} — صفحة ${page}`
  if (image) {
    const endpoint = id === 'sousi' || id === 'bazzi' ? 'mushaf-riwaya-image' : 'mushaf-svg'
    return {
      title,
      html:
        controls +
        navigation +
        `<div class="paper"><img class="mushaf-image" src="/api/${endpoint}?riwaya=${id}&amp;page=${page}&amp;v=5" alt="صفحة ${page} — ${escape(title)}"></div>` +
        message('إذا لم تظهر صورة الصفحة، افتح العرض النصي من الزر التالي.') +
        link('/mushaf', 'فتح النص المقروء', { ...params, view: 'text', page }) +
        navigation,
    }
  }
  let payload: RecordValue
  try {
    payload = object(await json(request, `/api/quran?riwaya=${id}&page=${page}&v=6`))
  } catch {
    return {
      title,
      status: 503,
      html:
        controls +
        navigation +
        message('تعذر تحميل نص الصفحة حاليًا. أعد المحاولة أو افتح صفحة المصحف المصورة.') +
        link('/mushaf', 'إعادة المحاولة', { ...params, page }) +
        link('/mushaf', 'صفحة المصحف', { ...params, page, view: 'image' }),
    }
  }
  const verses = list(payload.ayahs) as Verse[]
  if (
    payload.success !== true ||
    payload.riwaya !== id ||
    payload.page !== page ||
    !verses.length ||
    verses.some(
      (item) =>
        !text(item.text).trim() ||
        !Number.isInteger(item.numberInSurah) ||
        !Number.isInteger(item.surah?.number) ||
        item.surah.number < 1 ||
        item.surah.number > 114
    )
  ) {
    throw new Error('Invalid Quran page')
  }
  let previousSurah = 0
  let body = ''
  for (const verse of verses) {
    if (verse.surah.number !== previousSurah) {
      body += `<h2 class="surah-title">سورة ${escape(SURAH_NAMES_AR[verse.surah.number - 1])}</h2>`
      if (
        verse.numberInSurah === 1 &&
        ![1, 9].includes(verse.surah.number) &&
        text(payload.bismillah)
      ) {
        body += `<p class="basmala">${escape(payload.bismillah)}</p>`
      }
      previousSurah = verse.surah.number
    }
    const reference = id === 'hafs' ? verse.numberInSurah : verse.hafsNumbers?.[0]
    const tafsir =
      Number.isInteger(reference) && Number(reference) > 0
        ? `<a class="tafsir-link" href="${escape(href('/mushaf', { ...params, page, tafsir: `${verse.surah.number}:${reference}` }))}">تفسير</a>`
        : ''
    body += `<span class="ayah">${escape(verse.text)} <span class="ayah-number">﴿${verse.numberInSurah}﴾</span>${tafsir}</span> `
  }
  const audioLinks = Array.from(new Set(verses.map((item) => item.surah.number)))
    .map((surah) => link('/audio', `استماع: ${SURAH_NAMES_AR[surah - 1]}`, { riwaya: id, surah }))
    .join('')
  let explanation = ''
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(query.get('tafsir') || '')
  if (
    match &&
    verses.some(
      (verse) =>
        verse.surah.number === Number(match[1]) &&
        (id === 'hafs'
          ? verse.numberInSurah === Number(match[2])
          : verse.hafsNumbers?.includes(Number(match[2])))
    )
  ) {
    try {
      const value = object(
        await json(request, `/api/tafsir?mode=ayah&surah=${match[1]}&ayah=${match[2]}&book=2012`)
      )
      if (value.success !== true || !text(value.text).trim()) throw new Error('No tafsir')
      explanation = `<section class="panel"><h2>التفسير الميسر</h2><p class="muted">${escape(SURAH_NAMES_AR[Number(match[1]) - 1])} — الآية ${Number(match[2])} حسب ترقيم حفص</p><p class="prose">${escape(value.text)}</p></section>`
    } catch {
      explanation = message(
        'الصفحة متاحة، لكن تعذر تحميل التفسير حاليًا. أعد فتح رابط التفسير للمحاولة.'
      )
    }
  }
  return {
    title,
    html:
      controls +
      navigation +
      `<article class="paper quran quran-${id} text-size-${size}">${body}</article>` +
      explanation +
      `<div class="panel">${audioLinks}</div>` +
      navigation,
  }
}

async function index(request: NextRequest): Promise<Page> {
  const id = reading(request)
  const payload = object(await json(request, `/api/quran?riwaya=${id}&mode=index&v=1`))
  const rows = list(payload.locations) as Location[]
  if (payload.success !== true || payload.riwaya !== id || !rows.length)
    throw new Error('No Quran index')
  const pages = new Map<number, number>()
  for (const row of rows) {
    if (
      Number.isInteger(row.surah) &&
      row.surah >= 1 &&
      row.surah <= 114 &&
      Number.isInteger(row.page) &&
      row.page >= 1 &&
      row.page <= 604
    ) {
      pages.set(row.surah, Math.min(pages.get(row.surah) || 604, row.page))
    }
  }
  const surahs = SURAH_NAMES_AR.map((name, at) =>
    pages.has(at + 1)
      ? `<a class="card" href="${escape(href('/mushaf', { riwaya: id, page: pages.get(at + 1)! }))}">${at + 1}. ${escape(name)} <small>صفحة ${pages.get(at + 1)}</small></a>`
      : ''
  ).join('')
  const juz = HAFS_JUZ_RANGES.map((range) => {
    const row = rows.find(
      (item) =>
        item.surah === range.start.surah &&
        (id === 'hafs'
          ? item.ayah === range.start.ayah
          : item.hafsNumbers?.includes(range.start.ayah))
    )
    return row ? link('/mushaf', `الجزء ${range.number}`, { riwaya: id, page: row.page }) : ''
  }).join('')
  return {
    title: 'فهرس القرآن',
    html:
      form('/surahs', readingSelect(id)) +
      `<h2>الأجزاء</h2><div class="panel">${juz}</div><h2>السور</h2><div class="cards">${surahs}</div>`,
  }
}

async function recordings(request: NextRequest): Promise<Page> {
  const query = request.nextUrl.searchParams
  const section = query.get('section') || 'quran'
  const tabs = `<div class="panel">${[
    ['quran', 'القرآن'],
    ['ruqyah', 'الرقية'],
    ['khutbah', 'الخطب'],
    ['sunnah', 'كتب السنة'],
  ]
    .map(([id, label]) => link('/audio', label, { section: id }))
    .join('')}</div>`
  if (section !== 'quran') {
    if (!['ruqyah', 'khutbah', 'sunnah'].includes(section)) throw new Error('Invalid audio section')
    const params = new URLSearchParams({ section })
    for (const key of ['scholar', 'book']) {
      const value = query.get(key)
      if (value && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) params.set(key, value)
    }
    const p = integer(query.get('p'), 1, 1, 200)
    if (section === 'khutbah') params.set('page', String(p))
    if (section === 'sunnah') {
      params.set('start', String((p - 1) * 10 + 1))
      params.set('limit', '10')
    }
    const payload = object(await json(request, `/api/audio-library?${params}`))
    if (payload.ok !== true) throw new Error('Audio source unavailable')
    const choices =
      list(payload.scholars)
        .map((raw) => {
          const item = object(raw)
          return link('/audio', text(item.name) || text(item.label) || text(item.id), {
            section,
            scholar: text(item.id),
          })
        })
        .join('') +
      list(payload.books)
        .map((raw) => {
          const item = object(raw)
          return link('/audio', text(item.name), { section, book: text(item.id) })
        })
        .join('')
    const items = [...list(payload.items), ...list(payload.extras)]
      .slice(0, 50)
      .map((raw) => {
        const item = object(raw)
        const url = safeIslamicLibraryLink(item.audioUrl)
        return url
          ? audio(
              `/api/audio-proxy?url=${encodeURIComponent(url)}`,
              `${text(item.title)} — ${text(item.subtitle)}`
            )
          : ''
      })
      .join('')
    const more =
      (p > 1
        ? link('/audio', 'السابق', {
            section,
            scholar: params.get('scholar') || '',
            book: params.get('book') || '',
            p: p - 1,
          })
        : '') +
      (payload.hasMore === true && p < 200
        ? link('/audio', 'التالي', {
            section,
            scholar: params.get('scholar') || '',
            book: params.get('book') || '',
            p: p + 1,
          })
        : '')
    return { title: 'المكتبة الصوتية', html: tabs + choices + items + more }
  }
  const id = reading(request)
  const surah = integer(query.get('surah'), 1, 1, 114)
  const payload = object(
    await json(
      request,
      `https://mp3quran.net/api/v3/reciters?language=ar&rewaya=${READING_IDS[id]}`
    )
  )
  const choices: { key: string; name: string; server: string; surahs: number[] }[] = []
  for (const raw of list(payload.reciters)) {
    const reciter = object(raw)
    for (const rawMoshaf of list(reciter.moshaf)) {
      const moshaf = object(rawMoshaf)
      if (Number(moshaf.rewaya_id) !== READING_IDS[id]) continue
      const server = safeIslamicLibraryLink(moshaf.server)
      if (!server) continue
      const host = new URL(server).hostname
      if (host !== 'mp3quran.net' && !host.endsWith('.mp3quran.net')) continue
      choices.push({
        key: `${Number(reciter.id)}-${Number(moshaf.id)}`,
        name: `${text(reciter.name)} — ${text(moshaf.name)}`,
        server,
        surahs: text(moshaf.surah_list)
          .split(',')
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 114),
      })
    }
  }
  const available = choices.filter((item) => item.surahs.includes(surah))
  const chosen = available.find((item) => item.key === query.get('reader')) || available[0]
  const controls = form(
    '/audio',
    readingSelect(id) +
      surahSelect(surah) +
      `<label>القارئ <select name="reader">${choices
        .map(
          (item) =>
            `<option value="${escape(item.key)}"${selected(item.key, chosen?.key)}>${escape(item.name)}</option>`
        )
        .join('')}</select></label>`
  )
  let player = message('لا توجد تلاوة متاحة لهذه السورة بالرواية المختارة في المصدر حاليًا.')
  if (chosen) {
    const url = `${chosen.server.replace(/\/+$/, '')}/${String(surah).padStart(3, '0')}.mp3`
    // Native media controls work without React, Web Audio or automatic playback.
    player = audio(url, `سورة ${SURAH_NAMES_AR[surah - 1]} — ${chosen.name}`)
  }
  return {
    title: 'تلاوات القرآن',
    html: tabs + controls + player + message('اضغط تشغيل في مشغل الصوت. لن يبدأ الصوت تلقائيًا.'),
  }
}

async function adhkar(request: NextRequest): Promise<Page> {
  const categories = parseAdhkarCategories(await json(request, '/data/adhkar.json'))
  const query = request.nextUrl.searchParams
  const id = integer(query.get('category'), 0, 0, 10000)
  const category = categories.find((item) => item.id === id)
  if (!category) {
    const term = (query.get('q') || '').trim().slice(0, 100)
    const matched = categories.filter(
      (item) =>
        !term ||
        item.category.includes(term) ||
        item.array.some((entry) => entry.text.includes(term))
    )
    return {
      title: 'حصن المسلم',
      html:
        form(
          '/adhkar',
          `<label>البحث <input name="q" value="${escape(term)}" maxlength="100"></label>`
        ) +
        `<div class="cards">${matched
          .map(
            (item) =>
              `<a class="card" href="${escape(href('/adhkar/read', { category: item.id }))}">${escape(item.category)}<small>${item.array.length} من الأذكار</small></a>`
          )
          .join('')}</div>`,
    }
  }
  const p = integer(query.get('p'), 1, 1, Math.max(1, Math.ceil(category.array.length / 10)))
  const items = category.array
    .slice((p - 1) * 10, p * 10)
    .map((item) => {
      const source = item.audio
        ? safeIslamicLibraryLink(
            item.audio.startsWith('https://')
              ? item.audio
              : `https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/${item.audio.replace(/^\/+/, '')}`
          )
        : null
      return `<article class="panel"><p class="dhikr">${escape(item.text)}</p><p>التكرار: ${item.count}</p>
      ${item.reference ? `<p class="muted">${escape(item.reference)}</p>` : ''}
      ${source ? audio(`/api/adhkar-audio?url=${encodeURIComponent(source)}`, 'الاستماع للذكر') : ''}</article>`
    })
    .join('')
  return {
    title: category.category,
    html:
      link('/adhkar', 'كل الأذكار') +
      items +
      pager('/adhkar/read', p, Math.max(1, Math.ceil(category.array.length / 10)), {
        category: category.id,
      }),
  }
}

async function hadith(request: NextRequest): Promise<Page> {
  const query = request.nextUrl.searchParams
  const book = HADITH_BOOKS.find((item) => item.id === query.get('book'))
  if (!book)
    return {
      title: 'مكتبة الحديث',
      html: `<div class="cards">${HADITH_BOOKS.map(
        (item) =>
          `<a class="card" href="${escape(href('/hadith', { book: item.id }))}">${escape(item.name_ar)}<small>${escape(item.category)}</small></a>`
      ).join('')}</div>`,
    }
  const rawChapter = query.get('chapter')
  if (rawChapter === null || !/^\d{1,6}$/.test(rawChapter)) {
    const chapters = parseHadithChapters(await json(request, `/api/hadith/${book.id}`))
    return {
      title: book.name_ar,
      html:
        link('/hadith', 'كل كتب الحديث') +
        (chapters.length
          ? `<div class="cards">${chapters
              .map(
                (item) =>
                  `<a class="card" href="${escape(href('/hadith', { book: book.id, chapter: item.id }))}">${escape(item.name_ar)}</a>`
              )
              .join('')}</div>`
          : message('لم تتوفر أبواب هذا الكتاب حاليًا. أعد المحاولة لاحقًا.')),
    }
  }
  const chapter = Number(rawChapter)
  const payload = await json(request, `/api/hadith/${book.id}/chapter/${chapter}`)
  const records = parseChapterHadiths(payload)
  const total = Math.max(1, Math.ceil(records.length / 10))
  const p = integer(query.get('p'), 1, 1, total)
  return {
    title: book.name_ar,
    html:
      link('/hadith', 'أبواب الكتاب', { book: book.id }) +
      (records.length
        ? records
            .slice((p - 1) * 10, p * 10)
            .map(
              (item) =>
                `<article class="panel"><h2>حديث ${item.idInBook}</h2><p class="dhikr">${escape(item.arabic)}</p></article>`
            )
            .join('')
        : message('لم تتوفر أحاديث هذا الباب حاليًا.')) +
      pager('/hadith', p, total, { book: book.id, chapter }),
  }
}

async function prayer(request: NextRequest): Promise<Page> {
  const query = request.nextUrl.searchParams
  const city = (query.get('city') || '').trim().slice(0, 100)
  const country = (query.get('country') || '').trim().slice(0, 100)
  const date = query.get('date') || ''
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  const method = integer(query.get('method'), 4, 0, 23)
  const controls = form(
    '/prayer',
    `<label>المدينة <input name="city" required maxlength="100" value="${escape(city)}" placeholder="مثال: مسقط"></label>
    <label>الدولة <input name="country" required maxlength="100" value="${escape(country)}" placeholder="مثال: Oman"></label>
    <label>التاريخ <input type="date" name="date" value="${validDate ? date : ''}"></label>
    <label>طريقة الحساب <select name="method">${[
      [4, 'أم القرى'],
      [8, 'الخليج'],
      [10, 'قطر'],
      [23, 'عُمان'],
      [5, 'الهيئة المصرية'],
      [3, 'رابطة العالم الإسلامي'],
      [2, 'ISNA'],
      [1, 'كراتشي'],
    ]
      .map(
        ([id, label]) => `<option value="${id}"${selected(id, method)}>${escape(label)}</option>`
      )
      .join('')}</select></label>`
  )
  if (!city || !country)
    return {
      title: 'مواقيت الصلاة والقبلة',
      html:
        controls + message('اكتب مدينتك ودولتك لعرض مواقيتهما. اختر طريقة الحساب المعتمدة عندك.'),
    }
  const params = new URLSearchParams({ city, country, method: String(method) })
  const suffix = validDate ? `/${date.split('-').reverse().join('-')}` : ''
  const payload = await json(request, `https://api.aladhan.com/v1/timingsByCity${suffix}?${params}`)
  const day = parsePrayerDay(payload)
  const meta = object(object(object(payload).data).meta)
  const latitude = Number(meta.latitude),
    longitude = Number(meta.longitude)
  const direction =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
      ? `<p>اتجاه القبلة: ${qiblaBearing(latitude, longitude).toFixed(1)}° من الشمال الحقيقي باتجاه عقارب الساعة.</p>`
      : ''
  return {
    title: `مواقيت الصلاة — ${city}`,
    html:
      controls +
      `<section class="panel"><h2>${escape(day.gregorian)}</h2><p>${escape(day.hijri)}</p><p>المنطقة الزمنية: ${escape(day.timezone)}</p>
    <table><tbody>${[PRAYERS[0], { id: 'Sunrise', name: 'الشروق' }, ...PRAYERS.slice(1)]
      .map((item) => `<tr><th>${item.name}</th><td>${escape(day.timings[item.id])}</td></tr>`)
      .join('')}</tbody></table>${direction}
    <p class="muted">المصدر: AlAdhan. راجع التقويم المحلي عند اختلاف طريقة الحساب.</p></section>`,
  }
}

async function library(request: NextRequest): Promise<Page> {
  const query = request.nextUrl.searchParams
  const segments = request.nextUrl.pathname.split('/')
  const routeBook = segments[2] === 'book' ? segments[3] : undefined
  const id = query.get('book') || routeBook
  const course = LEARNING_COURSES.find((item) => item.id === id)
  if (!course) {
    const level = query.get('level') || (segments[2] === 'level' ? segments[3] : '')
    const category = query.get('category') || (segments[2] === 'level' ? segments[4] : '')
    const courses = LEARNING_COURSES.filter(
      (item) => (!level || item.levelId === level) && (!category || item.category === category)
    )
    const controls = form(
      '/islamic-library',
      `<label>المستوى <select name="level"><option value="">الكل</option>${LEARNING_LEVELS.map(
        (item) =>
          `<option value="${item.id}"${selected(item.id, level)}>${escape(item.name)}</option>`
      ).join('')}</select></label>
      <label>التخصص <select name="category"><option value="">الكل</option>${SUNNI_LIBRARY_CATEGORIES.map(
        (item) =>
          `<option value="${item.id}"${selected(item.id, category)}>${escape(item.label)}</option>`
      ).join('')}</select></label>`
    )
    return {
      title: 'المكتبة الإسلامية',
      html:
        controls +
        `<div class="cards">${courses
          .map(
            (item) =>
              `<a class="card" href="${escape(href('/islamic-library', { book: item.id }))}">${escape(item.title)}<small>${escape(item.author)}</small></a>`
          )
          .join('')}</div>`,
    }
  }
  // Reuse the API so deleted books and administrator-edited resources are respected.
  const payload = object(
    await json(request, `/api/islamic-library/book/${encodeURIComponent(course.id)}`)
  )
  if (payload.success !== true) throw new Error('Book unavailable')
  const book = object(payload.book)
  const resources = `<div class="panel">${external(book.readingUrl, 'قراءة الكتاب من المصدر')}${external(book.sharhUrl, text(book.sharhLabel) || 'قراءة الشرح')}
    ${external(book.downloadUrl, 'ملف الكتاب')}${external(course.videoUrl, 'الشروح المرئية')}${external(course.audioSourceUrl, 'الشروح الصوتية')}</div>`
  const contents = list(payload.contents)
    .map(object)
    .filter((item) => text(item.text).trim())
  const total = Math.max(1, Math.ceil(contents.length / 10))
  const p = integer(query.get('p'), 1, 1, total)
  return {
    title: text(book.title) || course.title,
    html:
      link('/islamic-library', 'كل الكتب') +
      `<section class="panel"><h2>${escape(book.author || course.author)}</h2><p>${escape(book.description || course.description)}</p></section>` +
      resources +
      (contents.length
        ? contents
            .slice((p - 1) * 10, p * 10)
            .map(
              (item) =>
                `<article class="panel"><h3>${escape(item.section || '')}${item.page ? ` — صفحة ${escape(item.page)}` : ''}</h3><p class="prose">${escape(item.text)}</p></article>`
            )
            .join('') + pager('/islamic-library', p, total, { book: course.id })
        : message(
            'النص الكامل غير متاح للقراءة داخل سميع حاليًا. استخدم رابط الكتاب أو ملفه المتاح من المصدر.'
          )),
  }
}

function visual(request: NextRequest): Page {
  const full = request.nextUrl.clone()
  full.searchParams.set('compat', '0')
  return {
    title: 'الآيات المرئية',
    html:
      `<div class="panel"><video controls playsinline preload="none" poster="/logo.png" src="/api/visual-ayahs?kind=demo">
    <a href="/api/visual-ayahs?kind=demo">فتح الفيديو</a></video></div>` +
      message(
        'يمكن تشغيل الفيديو على الأجهزة التي تدعم MP4. تصميم وتصدير فيديو جديد يحتاجان متصفحًا يدعم أدوات التسجيل؛ افتح النسخة الكاملة لاستخدامهما.'
      ) +
      `<a class="button" href="${escape(full.pathname + full.search)}">فتح محرر الآيات المرئية الكامل</a>`,
  }
}

function oldBrowser(agent: string): boolean {
  if (!agent || /bot\b|crawler|spider|slurp|bingpreview|facebookexternalhit/i.test(agent))
    return false
  if (
    /smart[- ]?tv|tizen|web[0o]s|netcast|hbbtv|viera|bravia|googletv|appletv|opera tv|aft[a-z0-9]|crkey|playstation|xbox/i.test(
      agent
    )
  )
    return true
  if (/MSIE\s|Trident\/|Opera Mini|UCBrowser\/|SamsungBrowser\/(?:[1-9]|1\d)\./i.test(agent))
    return true
  // Every iOS browser uses the installed WebKit engine, including Chrome.
  const ios = /(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)[_.](\d+)/.exec(agent)
  if (ios) return Number(ios[1]) < 16 || (Number(ios[1]) === 16 && Number(ios[2]) < 4)
  const chromium = /(?:Chrome|Chromium|Edg|OPR|CriOS)\/(\d+)/.exec(agent)
  if (chromium && Number(chromium[1]) < 111) return true
  const firefox = /(?:Firefox|FxiOS)\/(\d+)/.exec(agent)
  if (firefox && !/iP(?:hone|ad|od)/.test(agent) && Number(firefox[1]) < 111) return true
  const safari = /Version\/(\d+)\.(\d+).*Safari\//.exec(agent)
  if (safari && !chromium && !/Android/.test(agent)) {
    return Number(safari[1]) < 16 || (Number(safari[1]) === 16 && Number(safari[2]) < 4)
  }
  return /Android/.test(agent) && !chromium && !firefox
}

// ES5 only. Navigation and reading still work if this enhancement is blocked.
const REMOTE_SCRIPT = `(function(){
  if(!document.addEventListener||!document.querySelectorAll)return;
  document.addEventListener('keydown',function(e){
    var key=e.keyCode||e.which;
    if(key<37||key>40||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
    var active=document.activeElement,tag=active&&active.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='AUDIO'||tag==='VIDEO'||(active&&active.isContentEditable))return;
    var nodes=document.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]'),items=[],i,rect;
    for(i=0;i<nodes.length;i++){
      if(nodes[i].disabled||nodes[i].getAttribute('aria-hidden')==='true')continue;
      rect=nodes[i].getBoundingClientRect();
      if(rect.width>0&&rect.height>0)items.push(nodes[i]);
    }
    if(!items.length)return;
    if(!active||active===document.body||!active.getBoundingClientRect){items[0].focus();e.preventDefault();return;}
    var from=active.getBoundingClientRect(),x=from.left+from.width/2,y=from.top+from.height/2,best=null,score=Infinity;
    for(i=0;i<items.length;i++){
      if(items[i]===active)continue;
      rect=items[i].getBoundingClientRect();
      var dx=rect.left+rect.width/2-x,dy=rect.top+rect.height/2-y;
      var forward=key===37?-dx:key===39?dx:key===38?-dy:dy;
      if(forward<=2)continue;
      var side=(key===37||key===39)?Math.abs(dy):Math.abs(dx),value=forward+side*3;
      if(value<score){score=value;best=items[i];}
    }
    if(best){e.preventDefault();best.focus();rect=best.getBoundingClientRect();if(rect.top<0||rect.bottom>window.innerHeight)best.scrollIntoView(false);}
  },false);
  document.addEventListener('play',function(e){
    if(!e.target||!e.target.tagName||!/^AUDIO$|^VIDEO$/.test(e.target.tagName))return;
    var media=document.querySelectorAll('audio,video');
    for(var i=0;i<media.length;i++)if(media[i]!==e.target)media[i].pause();
  },true);
})();`

const STYLES = `
*{box-sizing:border-box}html{direction:rtl;background:#faf8f3;color:#24201b}
body{margin:0;font:20px/1.7 Tahoma,Arial,sans-serif;overflow-wrap:break-word}
header,main,footer{width:92%;max-width:1500px;margin:0 auto;padding:20px 0}
header{border-bottom:2px solid #ad8851}header strong{font-size:1.5em;color:#79531c}
h1,h2,h3{line-height:1.6}h1{font-size:1.8em}h2{font-size:1.4em}h3{font-size:1.15em}
a{color:#68440d}a:focus,button:focus,input:focus,select:focus{outline:4px solid #bd7d11;outline-offset:3px;background-color:#fff3cc}
.button,button{display:inline-block;border:1px solid #bda77f;border-radius:8px;padding:10px 17px;margin:5px;background:#fff;color:#583a0e;text-decoration:none;font:inherit;cursor:pointer;vertical-align:middle;min-height:48px}
nav a[aria-current="page"]{background:#7f5b28;color:#fff}.muted,small{color:#665f53}small,.card span{display:block;font-size:.8em;margin-top:7px}
.panel,.paper,.notice{background:#fff;border:1px solid #ded4c2;border-radius:10px;padding:20px;margin:18px 0}
.notice{background:#fff4dd}.cards{font-size:0}.card{font-size:20px;display:inline-block;vertical-align:top;width:31.5%;margin:1% .8%;padding:20px;border:1px solid #ded4c2;border-radius:10px;background:#fff;text-decoration:none}
.card strong{display:block}.card:focus{background:#fff3cc}.controls label{display:inline-block;margin:6px;vertical-align:bottom}
input,select{display:block;max-width:100%;min-height:48px;padding:8px;border:1px solid #aaa;border-radius:6px;background:white;color:#24201b;font:inherit}
input[type=number]{width:7em}.pager{text-align:center;margin:16px 0}.paper{padding:28px}.mushaf-image{display:block;width:100%;max-width:960px;height:auto;margin:auto}
.quran{font-family:Samee3Hafs,"Times New Roman",serif;font-size:2.1em;line-height:2.4;text-align:justify}
.quran-sousi{font-family:Samee3Sousi,"Times New Roman",serif}.quran-bazzi{font-family:Samee3Bazzi,"Times New Roman",serif}
.text-size-1{font-size:1.6em}.text-size-3{font-size:2.7em}.surah-title,.basmala{text-align:center;font-size:.8em}.ayah{display:inline}.ayah-number{font-family:Tahoma,Arial,sans-serif;font-size:.65em;white-space:nowrap;color:#79531c}.tafsir-link{font:.3em/1.5 Tahoma,Arial,sans-serif;margin:0 8px;display:inline-block}
.dhikr{font:1.45em/2.1 "Times New Roman",serif;white-space:pre-wrap}.prose{white-space:pre-wrap;line-height:2}
audio,video{display:block;width:100%;max-width:100%;margin:16px auto}video{max-height:65vh;background:#17130e}
table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:right}
footer{border-top:1px solid #ded4c2;margin-top:28px}.skip{position:absolute;top:-200px}.skip:focus{top:10px;background:white;padding:10px;z-index:2}
@font-face{font-family:Samee3Hafs;src:url('/fonts/UthmanicHafs-v-3.0.ttf') format('truetype');font-display:swap}
@font-face{font-family:Samee3Sousi;src:url('/fonts/sousi-source.ttf') format('truetype');font-display:swap}
@font-face{font-family:Samee3Bazzi;src:url('/fonts/bazzi-source.otf') format('opentype');font-display:swap}
@media(max-width:760px){body{font-size:17px}.card{width:48%;font-size:17px;padding:14px}.paper{padding:15px}.controls label{display:block}input,select{width:100%}.quran{font-size:1.8em}.text-size-1{font-size:1.4em}.text-size-3{font-size:2.2em}}
@media(max-width:420px){.card{width:98%}.button,button{padding:9px 12px;margin:4px}}
@media(min-width:1800px){body{font-size:27px}header,main,footer{max-width:2000px}.card{font-size:27px}.quran{font-size:2.2em}.text-size-1{font-size:1.7em}.text-size-3{font-size:2.8em}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
@media print{nav,.controls,.pager,footer,.tafsir-link{display:none}.paper{border:0}}
`

function documentHtml(request: NextRequest, page: Page, nonce: string): string {
  const full = request.nextUrl.clone()
  full.searchParams.set('compat', '0')
  const pathname = request.nextUrl.pathname
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#7f5b28">
  <meta name="robots" content="noindex,follow"><title>${escape(page.title)} | سميع</title>
  <link rel="icon" href="/icon-192.png"><style>${STYLES}</style></head><body>
  <a class="skip" href="#content">انتقل إلى المحتوى</a>
  <header><strong>سميع</strong><span> — وضع الشاشات والأجهزة</span><nav aria-label="الأقسام">${NAV.map(
    ([path, label]) =>
      `<a class="button" href="${escape(href(path))}"${pathname === path ? ' aria-current="page"' : ''}>${escape(label)}</a>`
  ).join('')}</nav></header><main id="content"><h1>${escape(page.title)}</h1>${page.html}</main>
  <footer><p>القراءة والتنقل متاحان في هذا الوضع دون JavaScript. يلزم اتصال لتحميل الصفحات والمحتوى.</p>
  <a class="button" href="${escape(full.pathname + full.search)}">فتح النسخة الكاملة على هذا الجهاز</a>
  <p class="muted">للتنقل: استخدم الأزرار أو Tab أو أسهم الريموت، ثم Enter للاختيار.</p></footer>
  <script nonce="${nonce}">${REMOTE_SCRIPT}</script></body></html>`
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Never replace API responses, mutations, Server Actions or RSC payloads with HTML.
  if (
    !['GET', 'HEAD'].includes(request.method) ||
    request.headers.has('rsc') ||
    request.headers.get('accept')?.includes('text/x-component') ||
    request.nextUrl.searchParams.has('_rsc') ||
    request.headers.has('next-router-prefetch')
  ) {
    return NextResponse.next()
  }
  const forced = request.nextUrl.searchParams.get('compat')
  const preference =
    forced === '1' || forced === '0' ? forced : request.cookies.get(MODE_COOKIE)?.value
  const enabled =
    preference === '1' ||
    (preference !== '0' && oldBrowser(request.headers.get('user-agent') || ''))
  if (!enabled) {
    const response = NextResponse.next()
    // Keep the normal application's own cache policy on supported browsers.
    // Compatibility responses below are private and are never cached by the CDN/SW.
    if (forced === '0')
      response.cookies.set(MODE_COOKIE, '0', {
        path: '/',
        maxAge: MODE_DAYS,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        httpOnly: true,
      })
    return response
  }
  const nonce = randomBytes(16).toString('base64')
  let page: Page
  try {
    const path = request.nextUrl.pathname.replace(/\/+$/, '') || '/'
    if (path === '/') page = home()
    else if (path === '/mushaf') page = await mushaf(request)
    else if (path === '/surahs') page = await index(request)
    else if (path === '/audio') page = await recordings(request)
    else if (path === '/adhkar' || path === '/adhkar/read') page = await adhkar(request)
    else if (path === '/hadith') page = await hadith(request)
    else if (path === '/prayer') page = await prayer(request)
    else if (path.startsWith('/islamic-library')) page = await library(request)
    else if (path === '/visual-ayahs') page = visual(request)
    else
      page = {
        title: 'الحفظ دون اتصال',
        html: message(
          'هذا الوضع الخفيف يحتاج اتصالًا لجلب المحتوى. لإدارة التنزيلات والمحتوى المحفوظ افتح النسخة الكاملة على متصفح حديث.'
        ),
      }
  } catch {
    const path = request.nextUrl.pathname
    const params: Record<string, string> = {}
    for (const [key, value] of request.nextUrl.searchParams) {
      if (key !== 'compat' && key.length < 40 && value.length < 200) params[key] = value
    }
    page = {
      title: 'تعذر تحميل هذا المحتوى حاليًا',
      status: 503,
      html:
        message(
          'الصفحة تعمل، لكن مصدر المحتوى لم يستجب أو أعاد بيانات غير مكتملة. تحقق من الاتصال وأعد المحاولة.'
        ) +
        link(path, 'إعادة المحاولة', params) +
        link('/', 'العودة للرئيسية'),
    }
  }
  const response = new NextResponse(
    request.method === 'HEAD' ? null : documentHtml(request, page, nonce),
    {
      // The HTML view itself is usable even when a content source is unavailable.
      // Existing sw.js replaces HTTP 5xx navigations with an old cached React shell.
      // Keep this document visible, with the dependency status in a separate header.
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Language': 'ar',
        'Cache-Control': 'private, no-store',
        Vary: 'User-Agent, Cookie',
        'X-Samee3-Mode': 'compat-v1',
        'X-Samee3-Content-Status': String(page.status || 200),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'`,
      },
    }
  )
  if (forced === '1')
    response.cookies.set(MODE_COOKIE, '1', {
      path: '/',
      maxAge: MODE_DAYS,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      httpOnly: true,
    })
  if (page.status === 503) response.headers.set('Retry-After', '10')
  return response
}

export const config = {
  matcher: [
    '/',
    '/mushaf',
    '/surahs',
    '/audio',
    '/adhkar',
    '/adhkar/read',
    '/hadith',
    '/prayer',
    '/islamic-library/:path*',
    '/visual-ayahs',
    '/offline/:path*',
  ],
}