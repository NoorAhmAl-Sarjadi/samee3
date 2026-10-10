
/**
 * SAMEE3 — Offline Tafsir Library
 * Path: lib/tafsir-offline.ts
 */

export const OFFLINE_TAFSIR_BOOKS = [
  2012, 136, 4, 2, 3, 1469, 27796, 54,
] as const

export type OfflineBook = {
  id: number
  entries: number
  bytes: number
  savedAt: number
}

type OfflineVerse = {
  key: string
  text: string
}

const DB_NAME = 'samee3-tafsir-library-v1'
const DB_VERSION = 1

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null
  }

  return value as Record<string, unknown>
}

function cleanHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .trim()
}

function unpackText(value: unknown): string {
  if (typeof value === 'string') {
    return cleanHtml(value)
  }

  if (Array.isArray(value)) {
    return value
      .map(unpackText)
      .filter(Boolean)
      .join('\n\n')
  }

  const data = asObject(value)

  if (!data) return ''

  if (typeof data.text === 'string') {
    return cleanHtml(data.text)
  }

  if (data.content) {
    return unpackText(data.content)
  }

  return ''
}

function asNumber(value: unknown): number {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return 0
  }

  const number = Number(value)

  return Number.isInteger(number) && number > 0
    ? number
    : 0
}

function parseOfficialDump(
  raw: unknown,
  book: number,
): OfflineVerse[] {
  const entries = new Map<string, string>()
  let visited = 0

  function visit(
    value: unknown,
    surahHint = 0,
    ayahHint = 0,
    depth = 0,
  ): void {
    visited += 1

    if (depth > 9 || visited > 350000) return

    if (typeof value === 'string') {
      if (
        surahHint >= 1 &&
        surahHint <= 114 &&
        ayahHint >= 1 &&
        ayahHint <= 286
      ) {
        const content = cleanHtml(value)

        if (content) {
          entries.set(
            `${book}:${surahHint}:${ayahHint}`,
            content,
          )
        }
      }

      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        visit(item, surahHint, ayahHint, depth + 1)
      })

      return
    }

    const data = asObject(value)
    if (!data) return

    const surah = asNumber(
      data.surah_id ??
      data.surah_number ??
      data.surah ??
      surahHint,
    )

    const ayah = asNumber(
      data.ayah_number ??
      data.ayah_id ??
      data.ayah ??
      data.number ??
      ayahHint,
    )

    const bookId = asNumber(
      data.book_id ?? data.book,
    )

    const content = unpackText(
      data.content ?? data.text ?? data.tafsir,
    )

    if (
      surah >= 1 &&
      surah <= 114 &&
      ayah >= 1 &&
      ayah <= 286 &&
      (!bookId || bookId === book) &&
      content
    ) {
      entries.set(
        `${book}:${surah}:${ayah}`,
        content,
      )
    }

    if (
      content &&
      !ayah &&
      typeof data.ayahs === 'string'
    ) {
      const single = data.ayahs.match(
        /^(\d{1,3}):(\d{1,3})$/,
      )

      if (single) {
        entries.set(
          `${book}:${Number(single[1])}:${Number(single[2])}`,
          content,
        )
      }

      const range = data.ayahs.match(
        /^(\d{1,3}):(\d{1,3})-(?:(\d{1,3}):)?(\d{1,3})$/,
      )

      if (range) {
        const firstSurah = Number(range[1])
        const lastSurah = range[3]
          ? Number(range[3])
          : firstSurah

        const start = Number(range[2])
        const end = Number(range[4])

        if (
          firstSurah === lastSurah &&
          firstSurah >= 1 &&
          firstSurah <= 114 &&
          start >= 1 &&
          end <= 286 &&
          end >= start &&
          end - start < 40
        ) {
          for (let n = start; n <= end; n += 1) {
            entries.set(
              `${book}:${firstSurah}:${n}`,
              content,
            )
          }
        }
      }
    }

    const nestedFields = [
      'data',
      'items',
      'records',
      'ayahs',
      'verses',
      'entries',
      'results',
      'payload',
      'response',
    ]

    nestedFields.forEach((field) => {
      if (data[field]) {
        visit(
          data[field],
          surah,
          0,
          depth + 1,
        )
      }
    })

    Object.keys(data).forEach((key) => {
      const apiPath = key.match(
        /\/ayah\/(\d{1,3})\/(\d{1,3})\/book\/(\d+)/,
      )

      if (
        apiPath &&
        Number(apiPath[3]) === book
      ) {
        visit(
          {
            surah: Number(apiPath[1]),
            ayah: Number(apiPath[2]),
            content: data[key],
          },
          0,
          0,
          depth + 1,
        )
      } else if (/^\d{1,3}:\d{1,3}$/.test(key)) {
        const numbers = key.split(':').map(Number)

        visit(
          {
            surah: numbers[0],
            ayah: numbers[1],
            content: data[key],
          },
          0,
          0,
          depth + 1,
        )
      } else if (/^\d{1,3}$/.test(key)) {
        const n = Number(key)

        if (surahHint === 0 && n <= 114) {
          visit(data[key], n, 0, depth + 1)
        } else if (surahHint > 0 && n <= 286) {
          visit(
            data[key],
            surahHint,
            n,
            depth + 1,
          )
        }
      }
    })
  }

  visit(raw)

  return Array.from(entries).map(
    ([key, value]) => ({
      key,
      text: value,
    }),
  )
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new Error('التخزين المحلي غير متاح.'),
      )
      return
    }

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION,
    )

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains('verses')) {
        database.createObjectStore('verses', {
          keyPath: 'key',
        })
      }

      if (!database.objectStoreNames.contains('books')) {
        database.createObjectStore('books', {
          keyPath: 'id',
        })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(
        request.error ||
        new Error('تعذر فتح المكتبة المحلية.'),
      )
    }
  })
}

export async function getOfflineTafsir(
  book: number,
  surah: number,
  ayah: number,
): Promise<string | null> {
  const database = await openLibrary()

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        'verses',
        'readonly',
      )

      const request = transaction
        .objectStore('verses')
        .get(`${book}:${surah}:${ayah}`)

      request.onsuccess = () => {
        resolve(
          typeof request.result?.text === 'string'
            ? request.result.text
            : null,
        )
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } finally {
    database.close()
  }
}

export async function listOfflineTafsirs(): Promise<
  OfflineBook[]
> {
  const database = await openLibrary()

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        'books',
        'readonly',
      )

      const request = transaction
        .objectStore('books')
        .getAll()

      request.onsuccess = () => {
        resolve(request.result as OfflineBook[])
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } finally {
    database.close()
  }
}

export async function removeOfflineTafsir(
  book: number,
): Promise<void> {
  const database = await openLibrary()

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ['books', 'verses'],
        'readwrite',
      )

      transaction
        .objectStore('books')
        .delete(book)

      const range = IDBKeyRange.bound(
        `${book}:`,
        `${book}:\uffff`,
      )

      const cursorRequest = transaction
        .objectStore('verses')
        .openCursor(range)

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result

        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error)
      transaction.onabort = () =>
        reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

export async function downloadOfflineTafsir(
  book: number,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<OfflineBook> {
  if (
    !OFFLINE_TAFSIR_BOOKS.includes(
      book as typeof OFFLINE_TAFSIR_BOOKS[number],
    )
  ) {
    throw new Error('كتاب التفسير غير مدعوم.')
  }

  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'متصفحك لا يدعم فك ضغط كتب التفسير.',
    )
  }

  onProgress('جارٍ تنزيل التفسير…')

  const response = await fetch(
    `/api/tafsir-download?book=${book}`,
    {
      signal,
      cache: 'no-store',
    },
  )

  if (!response.ok || !response.body) {
    throw new Error(
      'تعذر تنزيل التفسير من المصدر.',
    )
  }

  const expected = Number(
    response.headers.get('content-length') || 0,
  )

  const maximum = 30 * 1024 * 1024

  if (expected > maximum) {
    throw new Error('حجم الملف كبير جدًا.')
  }

  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()

  let received = 0

  for (;;) {
    if (signal.aborted) {
      throw new Error('تم إيقاف التنزيل.')
    }

    const result = await reader.read()

    if (result.done) break
    if (!result.value) continue

    received += result.value.byteLength

    if (received > maximum) {
      throw new Error(
        'حجم الملف تجاوز الحد المسموح.',
      )
    }

    chunks.push(result.value)

    onProgress(
      expected
        ? `جارٍ التنزيل: ${Math.min(
            100,
            Math.round(
              (received / expected) * 100,
            ),
          )}%`
        : `تم استقبال ${(
            received / 1048576
          ).toFixed(1)} ميجابايت`,
    )
  }

  onProgress('جارٍ معالجة كتاب التفسير…')

  const blob = new Blob(
    chunks as BlobPart[],
    { type: 'application/gzip' },
  )

  const signature = new Uint8Array(
    await blob.slice(0, 2).arrayBuffer(),
  )

  const text =
    signature[0] === 0x1f &&
    signature[1] === 0x8b
      ? await new Response(
          blob.stream().pipeThrough(
            new DecompressionStream('gzip'),
          ),
        ).text()
      : await blob.text()

  if (signal.aborted) {
    throw new Error('تم إيقاف التنزيل.')
  }

  const parsed: unknown = JSON.parse(text)
  const verses = parseOfficialDump(parsed, book)

  if (verses.length < 100) {
    throw new Error(
      'تعذر التعرف على تنسيق بيانات التفسير.',
    )
  }

  onProgress('جارٍ حفظ التفسير على الجهاز…')

  const database = await openLibrary()

  const metadata: OfflineBook = {
    id: book,
    entries: verses.length,
    bytes: received,
    savedAt: Date.now(),
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ['verses', 'books'],
        'readwrite',
      )

      const store = transaction.objectStore('verses')

      const cursorRequest = store.openCursor(
        IDBKeyRange.bound(
          `${book}:`,
          `${book}:\uffff`,
        ),
      )

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result

        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          verses.forEach((verse) => {
            store.put(verse)
          })

          transaction
            .objectStore('books')
            .put(metadata)
        }
      }

      transaction.oncomplete = () => resolve()

      transaction.onerror = () => {
        reject(
          transaction.error ||
          new Error('تعذر حفظ التفسير.'),
        )
      }

      transaction.onabort = () => {
        reject(
          transaction.error ||
          new Error('مساحة التخزين غير كافية.'),
        )
      }
    })

    return metadata
  } finally {
    database.close()
  }
}
