export type HadithCategory =
  | 'الكتب التسعة'
  | 'الأربعينات'
  | 'كتب أخرى'

export type HadithDataOrigin =
  | 'network'
  | 'cache'
  | 'catalogue'

export interface HadithBook {
  id: string
  name_ar: string
  name_en?: string
  category: HadithCategory
  hadithCount?: number
  chapterCount?: number
  author_ar?: string
  author_en?: string
  introduction?: string
  description?: string
}

export interface HadithChapter {
  id: number
  name_ar: string
  name_en?: string
  hadithCount?: number
  firstHadith?: number
  lastHadith?: number
}

export interface HadithRecord {
  id: number
  idInBook: number
  chapterId: number
  bookId?: number
  arabic: string
  english?: {
    narrator?: string
    text?: string
  }
}

export interface HadithBooksResult {
  books: HadithBook[]
  origin: HadithDataOrigin
}

export interface HadithBookResult {
  book: HadithBook
  chapters: HadithChapter[]
  origin: Exclude<HadithDataOrigin, 'catalogue'>
}

export interface HadithChapterResult {
  bookId: string
  chapterId: number
  chapter: HadithChapter | null
  hadiths: HadithRecord[]
  origin: Exclude<HadithDataOrigin, 'catalogue'>
}

export interface HadithSingleResult {
  bookId: string
  hadith: HadithRecord
  origin: Exclude<HadithDataOrigin, 'catalogue'>
}

export interface HadithLoadOptions {
  signal?: AbortSignal
  refresh?: boolean
}

export const HADITH_SOURCE = {
  apiBase: '/api/hadith',
  documentation: 'https://alfurqan.online/docs',
  cacheName: 'samee3-hadith-content-v1',
} as const

export const HADITH_BOOKS: readonly HadithBook[] = [
  {
    id: 'bukhari',
    name_ar: 'صحيح البخاري',
    category: 'الكتب التسعة',
  },
  {
    id: 'muslim',
    name_ar: 'صحيح مسلم',
    category: 'الكتب التسعة',
  },
  {
    id: 'abudawud',
    name_ar: 'سنن أبي داود',
    category: 'الكتب التسعة',
  },
  {
    id: 'nasai',
    name_ar: 'سنن النسائي',
    category: 'الكتب التسعة',
  },
  {
    id: 'tirmidhi',
    name_ar: 'جامع الترمذي',
    category: 'الكتب التسعة',
  },
  {
    id: 'ibnmajah',
    name_ar: 'سنن ابن ماجه',
    category: 'الكتب التسعة',
  },
  {
    id: 'malik',
    name_ar: 'موطأ مالك',
    category: 'الكتب التسعة',
  },
  {
    id: 'darimi',
    name_ar: 'سنن الدارمي',
    category: 'الكتب التسعة',
  },
  {
    id: 'ahmed',
    name_ar: 'مسند أحمد',
    category: 'الكتب التسعة',
  },
  {
    id: 'nawawi40',
    name_ar: 'الأربعون النووية',
    category: 'الأربعينات',
  },
  {
    id: 'qudsi40',
    name_ar: 'الأربعون حديثًا قدسيًا',
    category: 'الأربعينات',
  },
  {
    id: 'shahwaliullah40',
    name_ar: 'الأربعون حديثًا لشاه ولي الله',
    category: 'الأربعينات',
  },
  {
    id: 'riyad_assalihin',
    name_ar: 'رياض الصالحين',
    category: 'كتب أخرى',
  },
  {
    id: 'mishkat_almasabih',
    name_ar: 'مشكاة المصابيح',
    category: 'كتب أخرى',
  },
  {
    id: 'bulugh_almaram',
    name_ar: 'بلوغ المرام',
    category: 'كتب أخرى',
  },
  {
    id: 'aladab_almufrad',
    name_ar: 'الأدب المفرد',
    category: 'كتب أخرى',
  },
  {
    id: 'shamail_muhammadiyah',
    name_ar: 'الشمائل المحمدية',
    category: 'كتب أخرى',
  },
]

const MAX_RESPONSE_BYTES = 20 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 20000
const MAX_HADITH_LENGTH = 150000

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(
  value: unknown,
): string | undefined {
  return typeof value === 'string' &&
    value.trim()
    ? value
    : undefined
}

function asInteger(
  value: unknown,
  allowZero = false,
): number | undefined {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return undefined
  }

  if (
    typeof value === 'string' &&
    !/^\d+$/.test(value)
  ) {
    return undefined
  }

  const number = Number(value)

  return Number.isSafeInteger(number) &&
    number >= (allowZero ? 0 : 1)
    ? number
    : undefined
}

function asArray(
  value: unknown,
): unknown[] {
  return Array.isArray(value) ? value : []
}

function firstArray(
  ...values: unknown[]
): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function normalizeCategory(
  value: unknown,
  fallback: HadithCategory,
): HadithCategory {
  const category =
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : ''

  if (
    [
      'the_9_books',
      'the 9 books',
      'nine books',
      'الكتب التسعة',
    ].includes(category)
  ) {
    return 'الكتب التسعة'
  }

  if (
    [
      'forties',
      'forty hadith',
      'the forties',
      'الأربعينات',
    ].includes(category)
  ) {
    return 'الأربعينات'
  }

  if (
    category === 'other' ||
    category === 'other books' ||
    category === 'كتب أخرى'
  ) {
    return 'كتب أخرى'
  }

  return fallback
}

export function findHadithBook(
  bookId: string,
): HadithBook | null {
  return (
    HADITH_BOOKS.find(
      (book) => book.id === bookId,
    ) || null
  )
}

function bookOrThrow(
  bookId: string,
): HadithBook {
  const book = findHadithBook(bookId)

  if (!book) {
    throw new Error(
      'هذا الكتاب غير موجود في فهرس مصادر الأحاديث.',
    )
  }

  return book
}

export function parseHadithBooks(
  payload: unknown,
): HadithBook[] {
  const data = asObject(payload)
  const wrapped = asObject(data?.data)

  const source = firstArray(
    data?.books,
    wrapped?.books,
    data?.collections,
    data?.data,
    payload,
  )

  if (!source.length) {
    throw new Error(
      'قائمة الكتب غير موجودة في الاستجابة.',
    )
  }

  const parsed =
    new Map<string, HadithBook>()

  for (const raw of source) {
    const item = asObject(raw)

    if (!item) {
      continue
    }

    const id = asString(
      item.id ??
        item.bookId ??
        item.slug,
    )

    const fallback = id
      ? findHadithBook(id)
      : null

    if (!fallback || !id) {
      continue
    }

    const arabic = asObject(item.arabic)
    const english = asObject(item.english)

    parsed.set(id, {
      ...fallback,

      name_ar:
        asString(
          item.name_ar ??
            item.nameArabic ??
            item.arabicName ??
            arabic?.name,
        ) || fallback.name_ar,

      name_en:
        asString(
          item.name_en ??
            item.nameEnglish ??
            english?.name,
        ) || fallback.name_en,

      category: normalizeCategory(
        item.category ?? item.group,
        fallback.category,
      ),

      hadithCount: asInteger(
        item.hadithCount ??
          item.hadith_count ??
          item.total_hadiths ??
          item.count,
      ),

      chapterCount: asInteger(
        item.chapterCount ??
          item.total_chapters,
      ),

      author_ar: asString(
        item.author_ar ??
          item.authorArabic,
      ),

      author_en: asString(
        item.author_en ??
          item.authorEnglish,
      ),

      introduction: asString(
        item.introduction_ar ??
          item.introduction ??
          item.intro,
      ),

      description: asString(
        item.description_ar ??
          item.description,
      ),
    })
  }

  if (!parsed.size) {
    throw new Error(
      'قائمة الكتب لا تحتوي على معرّفات معروفة.',
    )
  }

  return HADITH_BOOKS.map(
    (book) =>
      parsed.get(book.id) || { ...book },
  )
}

export function parseHadithChapters(
  payload: unknown,
): HadithChapter[] {
  const data = asObject(payload)
  const wrapped = asObject(data?.data)
  const book = asObject(data?.book)

  const source = firstArray(
    data?.chapters,
    wrapped?.chapters,
    book?.chapters,
  )

  const ids = new Set<number>()
  const chapters: HadithChapter[] = []

  for (const raw of source) {
    const item = asObject(raw)

    if (!item) {
      continue
    }

    const id = asInteger(
      item.id ??
        item.chapterId ??
        item.number,
      true,
    )

    const name = asString(
      item.name_ar ??
        item.nameArabic ??
        item.arabicName ??
        item.arabic ??
        item.name,
    )

    if (
      id === undefined ||
      !name ||
      ids.has(id)
    ) {
      continue
    }

    ids.add(id)

    const range = asArray(
      item.hadith_range,
    )

    const first = asInteger(
      item.firstHadith ??
        item.first_hadith ??
        item.start ??
        range[0],
    )

    const last = asInteger(
      item.lastHadith ??
        item.last_hadith ??
        item.end ??
        range[1],
    )

    chapters.push({
      id,
      name_ar: name,

      name_en: asString(
        item.name_en ??
          item.nameEnglish ??
          item.english,
      ),

      hadithCount: asInteger(
        item.hadithCount ??
          item.hadith_count ??
          item.count,
      ),

      firstHadith: first,
      lastHadith: last,
    })
  }

  return chapters
}

export function parseHadithRecord(
  raw: unknown,
): HadithRecord | null {
  const item = asObject(raw)

  if (!item) {
    return null
  }

  const id = asInteger(
    item.id ??
      item.idInBook ??
      item.number,
  )

  const idInBook = asInteger(
    item.idInBook ??
      item.number ??
      item.id,
  )

  const chapterId = asInteger(
    item.chapterId ??
      item.chapter_id,
    true,
  )

  const text = asString(
    item.arabic ??
      item.arab ??
      item.text_ar,
  )

  if (
    id === undefined ||
    idInBook === undefined ||
    !text ||
    text.length > MAX_HADITH_LENGTH
  ) {
    return null
  }

  const english = asObject(
    item.english,
  )

  const narrator = asString(
    english?.narrator ??
      item.narrator,
  )

  const translation = asString(
    english?.text ??
      item.text_en,
  )

  return {
    id,
    idInBook,
    chapterId: chapterId ?? 0,

    bookId: asInteger(
      item.bookId ??
        item.book_id,
    ),

    arabic: text,

    ...(narrator || translation
      ? {
          english: {
            narrator,
            text: translation,
          },
        }
      : {}),
  }
}

export function parseChapterHadiths(
  payload: unknown,
): HadithRecord[] {
  const data = asObject(payload)
  const wrapped = asObject(
    data?.data,
  )

  const source = firstArray(
    data?.hadiths,
    wrapped?.hadiths,
    data?.data,
    payload,
  )

  if (!source.length) {
    return []
  }

  const hadiths: HadithRecord[] = []
  const numbers = new Set<number>()

  for (const raw of source) {
    const hadith =
      parseHadithRecord(raw)

    if (
      !hadith ||
      numbers.has(
        hadith.idInBook,
      )
    ) {
      throw new Error(
        'وجدنا حديثًا ناقصًا أو رقمًا مكررًا؛ لم تُحفظ البيانات.',
      )
    }

    numbers.add(
      hadith.idInBook,
    )

    hadiths.push(hadith)
  }

  return hadiths
}

function requireChapterId(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 100000
  ) {
    throw new Error(
      'رقم باب الحديث غير صالح.',
    )
  }

  return value
}

function requireHadithNumber(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 200000
  ) {
    throw new Error(
      'رقم الحديث غير صالح.',
    )
  }

  return value
}

function toUrl(
  path: string,
): string {
  if (
    typeof window === 'undefined'
  ) {
    throw new Error(
      'قراءة كاش الأحاديث متاحة في المتصفح فقط.',
    )
  }

  return new URL(
    `${HADITH_SOURCE.apiBase}/${path}`,
    window.location.origin,
  ).href
}

async function cacheRead(
  path: string,
): Promise<unknown | null> {
  if (
    typeof caches === 'undefined'
  ) {
    return null
  }

  try {
    const names =
      await caches.keys()

    if (
      !names.includes(
        HADITH_SOURCE.cacheName,
      )
    ) {
      return null
    }

    const cache = await caches.open(
      HADITH_SOURCE.cacheName,
    )

    const response = await cache.match(
      toUrl(path),
    )

    if (!response?.ok) {
      return null
    }

    return (await response.json()) as unknown
  } catch {
    return null
  }
}

async function cacheWrite(
  path: string,
  raw: string,
): Promise<void> {
  if (
    typeof caches === 'undefined'
  ) {
    return
  }

  try {
    const cache = await caches.open(
      HADITH_SOURCE.cacheName,
    )

    await cache.put(
      toUrl(path),
      new Response(raw, {
        headers: {
          'Content-Type':
            'application/json; charset=utf-8',
        },
      }),
    )
  } catch {
    return
  }
}

async function readBoundedJson(
  response: Response,
  signal: AbortSignal,
): Promise<{
  raw: string
  value: unknown
}> {
  const contentType = (
    response.headers.get(
      'content-type',
    ) || ''
  ).toLowerCase()

  if (
    contentType.includes(
      'text/html',
    )
  ) {
    throw new Error(
      'مصدر الأحاديث أعاد صفحة بدل بيانات الكتاب.',
    )
  }

  const declared = Number(
    response.headers.get(
      'content-length',
    ) || '0',
  )

  if (
    declared > MAX_RESPONSE_BYTES
  ) {
    throw new Error(
      'حجم بيانات الأحاديث تجاوز الحد الآمن.',
    )
  }

  if (!response.body) {
    throw new Error(
      'استجابة مصدر الأحاديث فارغة.',
    )
  }

  const reader =
    response.body.getReader()

  const decoder = new TextDecoder(
    'utf-8',
    { fatal: true },
  )

  const parts: string[] = []

  let received = 0
  let doneNormally = false

  try {
    for (;;) {
      if (signal.aborted) {
        throw new Error(
          'تم إلغاء جلب الأحاديث.',
        )
      }

      const packet =
        await reader.read()

      if (packet.done) {
        doneNormally = true
        break
      }

      if (!packet.value) {
        continue
      }

      received +=
        packet.value.byteLength

      if (
        received >
        MAX_RESPONSE_BYTES
      ) {
        throw new Error(
          'حجم بيانات الأحاديث أكبر من الحد المسموح.',
        )
      }

      parts.push(
        decoder.decode(
          packet.value,
          { stream: true },
        ),
      )
    }

    parts.push(
      decoder.decode(),
    )

    const raw = parts.join('')

    return {
      raw,
      value: JSON.parse(raw) as unknown,
    }
  } finally {
    if (!doneNormally) {
      void reader.cancel().catch(
        () => undefined,
      )
    }

    reader.releaseLock()
  }
}

async function fetchAndValidate<T>(
  path: string,
  parse: (value: unknown) => T,
  valid: (value: T) => boolean,
  options: HadithLoadOptions = {},
): Promise<{
  data: T
  origin: Exclude<
    HadithDataOrigin,
    'catalogue'
  >
}> {
  if (
    options.signal?.aborted
  ) {
    throw new Error(
      'تم إلغاء الطلب.',
    )
  }

  let cached: T | null = null

  const existing =
    await cacheRead(path)

  if (existing !== null) {
    try {
      const parsed =
        parse(existing)

      if (valid(parsed)) {
        cached = parsed
      }
    } catch {
      // Ignore invalid saved data.
    }
  }

  if (
    cached !== null &&
    !options.refresh
  ) {
    return {
      data: cached,
      origin: 'cache',
    }
  }

  const controller =
    new AbortController()

  const cancel = () =>
    controller.abort()

  const timeout = setTimeout(
    cancel,
    REQUEST_TIMEOUT_MS,
  )

  options.signal?.addEventListener(
    'abort',
    cancel,
    { once: true },
  )

  try {
    if (
      typeof navigator !==
        'undefined' &&
      navigator.onLine === false
    ) {
      throw new Error(
        'لا يوجد اتصال بالإنترنت، والبيانات المطلوبة غير محفوظة.',
      )
    }

    const response = await fetch(
      toUrl(path),
      {
        headers: {
          Accept:
            'application/json',
        },

        credentials:
          'same-origin',

        cache: 'no-store',

        signal:
          controller.signal,
      },
    )

    if (!response.ok) {
      throw new Error(
        `تعذر جلب الأحاديث (HTTP ${response.status}).`,
      )
    }

    const received =
      await readBoundedJson(
        response,
        controller.signal,
      )

    const parsed = parse(
      received.value,
    )

    if (!valid(parsed)) {
      throw new Error(
        'بيانات الأحاديث ناقصة أو غير صالحة.',
      )
    }

    await cacheWrite(
      path,
      received.raw,
    )

    return {
      data: parsed,
      origin: 'network',
    }
  } catch (error) {
    if (
      options.signal?.aborted
    ) {
      throw error
    }

    if (cached !== null) {
      return {
        data: cached,
        origin: 'cache',
      }
    }

    throw error
  } finally {
    clearTimeout(timeout)

    options.signal?.removeEventListener(
      'abort',
      cancel,
    )
  }
}

export async function getHadithBooks(
  options: HadithLoadOptions = {},
): Promise<HadithBooksResult> {
  try {
    const result =
      await fetchAndValidate(
        'list',

        parseHadithBooks,

        (books) =>
          books.length ===
          HADITH_BOOKS.length,

        options,
      )

    return {
      books: result.data,
      origin: result.origin,
    }
  } catch (error) {
    if (
      options.signal?.aborted
    ) {
      throw error
    }

    return {
      books: HADITH_BOOKS.map(
        (book) => ({
          ...book,
        }),
      ),

      origin: 'catalogue',
    }
  }
}

export async function getHadithBook(
  bookId: string,
  options: HadithLoadOptions = {},
): Promise<HadithBookResult> {
  const fallback =
    bookOrThrow(bookId)

  const result =
    await fetchAndValidate(
      bookId,

      (payload) => {
        const data =
          asObject(payload)

        const remote =
          asObject(data?.book)

        const chapters =
          parseHadithChapters(
            payload,
          )

        const book: HadithBook = {
          ...fallback,

          name_ar:
            asString(
              remote?.name_ar,
            ) ||
            fallback.name_ar,

          name_en:
            asString(
              remote?.name_en,
            ) ||
            fallback.name_en,

          author_ar: asString(
            remote?.author_ar,
          ),

          author_en: asString(
            remote?.author_en,
          ),

          introduction: asString(
            remote?.introduction_ar ??
              remote?.introduction,
          ),

          category:
            normalizeCategory(
              remote?.category,
              fallback.category,
            ),

          hadithCount: asInteger(
            data?.total_hadiths,
          ),

          chapterCount: asInteger(
            data?.total_chapters,
          ),
        }

        return {
          book,
          chapters,
        }
      },

      (data) =>
        data.chapters.length > 0,

      options,
    )

  return {
    ...result.data,
    origin: result.origin,
  }
}

export async function getHadithChapter(
  bookId: string,
  chapterId: number,
  options: HadithLoadOptions = {},
): Promise<HadithChapterResult> {
  bookOrThrow(bookId)
  requireChapterId(chapterId)

  const path =
    `${bookId}/chapter/${chapterId}`

  const result =
    await fetchAndValidate(
      path,

      (payload) => {
        const data =
          asObject(payload)

        const rawChapter =
          asObject(
            data?.chapter,
          )

        const chapter:
          HadithChapter | null =
          rawChapter
            ? {
                id:
                  asInteger(
                    rawChapter.id,
                    true,
                  ) ??
                  chapterId,

                name_ar:
                  asString(
                    rawChapter.arabic ??
                      rawChapter.name_ar,
                  ) ||
                  'باب الحديث',

                name_en:
                  asString(
                    rawChapter.english ??
                      rawChapter.name_en,
                  ),
              }
            : null

        const hadiths =
          parseChapterHadiths(
            payload,
          )

        return {
          bookId,
          chapterId,
          chapter,
          hadiths,
        }
      },

      (data) =>
        data.hadiths.length > 0 &&
        data.hadiths.every(
          (hadith) =>
            hadith.chapterId ===
            chapterId,
        ),

      options,
    )

  return {
    ...result.data,
    origin: result.origin,
  }
}

export async function getHadithByNumber(
  bookId: string,
  number: number,
  options: HadithLoadOptions = {},
): Promise<HadithSingleResult> {
  bookOrThrow(bookId)
  requireHadithNumber(number)

  const result =
    await fetchAndValidate(
      `${bookId}/hadith/${number}`,

      (payload) => {
        const data =
          asObject(payload)

        return parseHadithRecord(
          data?.hadith ??
            asObject(
              data?.data,
            )?.hadith,
        )
      },

      (hadith) =>
        hadith !== null &&
        hadith.idInBook === number,

      options,
    )

  if (!result.data) {
    throw new Error(
      'هذا الحديث غير موجود في المصدر.',
    )
  }

  return {
    bookId,
    hadith: result.data,
    origin: result.origin,
  }
}

export async function getCachedHadithChapters(
  bookId: string,
): Promise<number[]> {
  bookOrThrow(bookId)

  if (
    typeof caches === 'undefined'
  ) {
    return []
  }

  try {
    const names =
      await caches.keys()

    if (
      !names.includes(
        HADITH_SOURCE.cacheName,
      )
    ) {
      return []
    }

    const cache =
      await caches.open(
        HADITH_SOURCE.cacheName,
      )

    const requests =
      await cache.keys()

    const prefix =
      `/api/hadith/${bookId}/chapter/`

    const ids =
      requests.reduce<number[]>(
        (result, request) => {
          const url =
            new URL(request.url)

          if (
            url.pathname.startsWith(
              prefix,
            )
          ) {
            const id = Number(
              url.pathname.slice(
                prefix.length,
              ),
            )

            if (
              Number.isSafeInteger(id) &&
              id >= 0
            ) {
              result.push(id)
            }
          }

          return result
        },
        [],
      )

    return Array.from(
      new Set(ids),
    ).sort(
      (a, b) => a - b,
    )
  } catch {
    return []
  }
}

export function normalizeHadithSearch(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(
      /[\u064B-\u065F\u0670\u0640]/g,
      '',
    )
    .replace(
      /[أإآٱ]/g,
      'ا',
    )
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
}

export function searchHadithInChapter(
  hadiths: readonly HadithRecord[],
  query: string,
): HadithRecord[] {
  const target =
    normalizeHadithSearch(
      query,
    )

  if (!target) {
    return [...hadiths]
  }

  return hadiths.filter(
    (hadith) =>
      normalizeHadithSearch(
        `${hadith.idInBook} ${hadith.arabic}`,
      ).includes(target),
  )
}
