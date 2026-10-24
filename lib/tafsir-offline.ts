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

const MAX_TRANSFER_BYTES = 30 * 1024 * 1024
const MAX_DECOMPRESSED_BYTES = 120 * 1024 * 1024
const MIN_IMPORTED_ENTRIES = 100
const MAX_VISITED_NODES = 500000
const MAX_TEXT_LENGTH = 300000

function objectOf(
  value: unknown,
): Record<string, unknown> | null {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : null
}

function positiveInteger(value: unknown): number {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return 0
  }

  if (
    typeof value === 'string' &&
    !/^\d+$/.test(value)
  ) {
    return 0
  }

  const number = Number(value)

  return Number.isSafeInteger(number) && number > 0
    ? number
    : 0
}

function textOnly(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/(?:p|div|li|blockquote)>/gi,
      '\n',
    )
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .trim()
}

function contentText(value: unknown): string {
  if (typeof value === 'string') {
    return textOnly(value)
  }

  if (Array.isArray(value)) {
    return value
      .map(contentText)
      .filter(Boolean)
      .join('\n\n')
  }

  const item = objectOf(value)

  if (!item) return ''

  return contentText(
    item.text ??
    item.content ??
    item.tafsir,
  )
}

function parseBookDump(
  source: unknown,
  bookId: number,
): OfflineVerse[] {
  const output = new Map<string, string>()
  const endpointKeys = new Set<string>()

  let visited = 0

  const store = (
    surah: number,
    ayah: number,
    text: string,
  ) => {
    if (
      surah < 1 ||
      surah > 114 ||
      ayah < 1 ||
      ayah > 286 ||
      !text
    ) {
      return
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return
    }

    output.set(
      `${bookId}:${surah}:${ayah}`,
      text,
    )
  }

  const storeRange = (
    range: unknown,
    text: string,
  ) => {
    if (
      typeof range !== 'string' ||
      !text
    ) {
      return
    }

    const match = range.match(
      /^(\d{1,3}):(\d{1,3})(?:-(?:(\d{1,3}):)?(\d{1,3}))?$/,
    )

    if (!match) return

    const surah = Number(match[1])

    const lastSurah = match[3]
      ? Number(match[3])
      : surah

    const start = Number(match[2])

    const end = match[4]
      ? Number(match[4])
      : start

    if (
      surah !== lastSurah ||
      start > end ||
      end - start > 285
    ) {
      return
    }

    for (
      let ayah = start;
      ayah <= end;
      ayah += 1
    ) {
      store(surah, ayah, text)
    }
  }

  const visit = (
    node: unknown,
    surahHint = 0,
    ayahHint = 0,
    depth = 0,
  ): void => {
    visited += 1

    if (
      depth > 16 ||
      visited > MAX_VISITED_NODES
    ) {
      return
    }

    if (typeof node === 'string') {
      store(
        surahHint,
        ayahHint,
        textOnly(node),
      )
      return
    }

    if (Array.isArray(node)) {
      node.forEach((entry) => {
        visit(
          entry,
          surahHint,
          ayahHint,
          depth + 1,
        )
      })
      return
    }

    const item = objectOf(node)

    if (!item) return

    const surah = positiveInteger(
      item.surah_id ??
      item.surah_number ??
      item.surah ??
      surahHint,
    )

    const ayah = positiveInteger(
      item.ayah_number ??
      item.ayah_id ??
      item.ayah ??
      item.number ??
      ayahHint,
    )

    const rawBook = objectOf(item.book)

    const itemBook = positiveInteger(
      item.book_id ??
      rawBook?.id ??
      item.book,
    )

    const value = contentText(
      item.content ??
      item.text ??
      item.tafsir,
    )

    if (
      !itemBook ||
      itemBook === bookId
    ) {
      store(surah, ayah, value)
      storeRange(item.ayahs, value)
    }

    if (Array.isArray(item.content)) {
      item.content.forEach((part) => {
        const data = objectOf(part)

        if (data) {
          storeRange(
            data.ayahs,
            contentText(
              data.text ?? data.content,
            ),
          )
        }
      })
    }

    const nested = [
      'data',
      'items',
      'records',
      'verses',
      'entries',
      'results',
      'payload',
      'response',
      'ayahs',
    ]

    nested.forEach((key) => {
      const child = item[key]

      if (
        child &&
        typeof child === 'object'
      ) {
        visit(
          child,
          surah,
          0,
          depth + 1,
        )
      }
    })

    Object.keys(item).forEach((key) => {
      const endpoint = key.match(
        /(?:^|\/)ayah\/(\d{1,3})\/(\d{1,3})\/book\/(\d+)/,
      )

      if (endpoint) {
        if (
          Number(endpoint[3]) !== bookId
        ) {
          return
        }

        endpointKeys.add(key)

        visit(
          item[key],
          Number(endpoint[1]),
          Number(endpoint[2]),
          depth + 1,
        )

        return
      }

      const pair = key.match(
        /^(\d{1,3}):(\d{1,3})$/,
      )

      if (pair) {
        visit(
          item[key],
          Number(pair[1]),
          Number(pair[2]),
          depth + 1,
        )
        return
      }

      if (/^\d{1,3}$/.test(key)) {
        const number = Number(key)

        if (
          !surahHint &&
          number <= 114
        ) {
          visit(
            item[key],
            number,
            0,
            depth + 1,
          )
        } else if (
          surahHint &&
          number <= 286
        ) {
          visit(
            item[key],
            surahHint,
            number,
            depth + 1,
          )
        }
      }
    })
  }

  visit(source)

  const result = Array.from(
    output.entries(),
  ).map(([key, text]) => ({
    key,
    text,
  }))

  if (
    visited > MAX_VISITED_NODES ||
    result.length < MIN_IMPORTED_ENTRIES
  ) {
    throw new Error(
      'الملف لا يحتوي على بيانات تفسير كافية؛ لم يتم تغيير الكتاب المحفوظ.',
    )
  }

  if (
    endpointKeys.size >= 500 &&
    result.length <
      Math.floor(endpointKeys.size * 0.5)
  ) {
    throw new Error(
      'تعذر فهرسة معظم محتوى الكتاب؛ لم يتم تغيير النسخة السابقة.',
    )
  }

  return result
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (
      typeof indexedDB === 'undefined'
    ) {
      reject(
        new Error(
          'التخزين المحلي غير متاح في هذا المتصفح.',
        ),
      )
      return
    }

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION,
    )

    request.onupgradeneeded = () => {
      const db = request.result

      if (
        !db.objectStoreNames.contains(
          'verses',
        )
      ) {
        db.createObjectStore('verses', {
          keyPath: 'key',
        })
      }

      if (
        !db.objectStoreNames.contains(
          'books',
        )
      ) {
        db.createObjectStore('books', {
          keyPath: 'id',
        })
      }
    }

    request.onblocked = () => {
      reject(
        new Error(
          'أغلق تبويبات مصحف سميع الأخرى وأعد المحاولة.',
        ),
      )
    }

    request.onerror = () => {
      reject(
        request.error ||
        new Error(
          'تعذر فتح التخزين المحلي.',
        ),
      )
    }

    request.onsuccess = () => {
      const db = request.result

      db.onversionchange = () => {
        db.close()
      }

      resolve(db)
    }
  })
}

function rangeForBook(
  book: number,
): IDBKeyRange {
  return IDBKeyRange.bound(
    `${book}:`,
    `${book}:\uffff`,
  )
}

export async function getOfflineTafsir(
  book: number,
  surah: number,
  ayah: number,
): Promise<string | null> {
  const db = await openLibrary()

  try {
    return await new Promise<
      string | null
    >((resolve, reject) => {
      const tx = db.transaction(
        ['books', 'verses'],
        'readonly',
      )

      let metadata:
        | OfflineBook
        | undefined

      let verse:
        | OfflineVerse
        | undefined

      const bookRequest = tx
        .objectStore('books')
        .get(book)

      const verseRequest = tx
        .objectStore('verses')
        .get(
          `${book}:${surah}:${ayah}`,
        )

      bookRequest.onsuccess = () => {
        metadata = bookRequest.result as
          | OfflineBook
          | undefined
      }

      verseRequest.onsuccess = () => {
        verse = verseRequest.result as
          | OfflineVerse
          | undefined
      }

      tx.oncomplete = () => {
        resolve(
          metadata &&
          metadata.entries >=
            MIN_IMPORTED_ENTRIES &&
          typeof verse?.text === 'string'
            ? verse.text
            : null,
        )
      }

      tx.onerror = () => {
        reject(
          tx.error ||
          new Error(
            'تعذر قراءة التفسير المحفوظ.',
          ),
        )
      }

      tx.onabort = () => {
        reject(
          tx.error ||
          new Error(
            'تعذر قراءة التفسير المحفوظ.',
          ),
        )
      }
    })
  } finally {
    db.close()
  }
}

export async function listOfflineTafsirs():
  Promise<OfflineBook[]> {
  const db = await openLibrary()

  try {
    return await new Promise<
      OfflineBook[]
    >((resolve, reject) => {
      const tx = db.transaction(
        ['books', 'verses'],
        'readonly',
      )

      const books = tx
        .objectStore('books')
        .getAll()

      const checked: OfflineBook[] = []

      books.onsuccess = () => {
        const values =
          books.result as OfflineBook[]

        values.forEach((item) => {
          if (
            !item ||
            !Number.isInteger(item.id) ||
            item.entries <
              MIN_IMPORTED_ENTRIES
          ) {
            return
          }

          const count = tx
            .objectStore('verses')
            .count(
              rangeForBook(item.id),
            )

          count.onsuccess = () => {
            if (
              count.result === item.entries
            ) {
              checked.push(item)
            }
          }
        })
      }

      tx.oncomplete = () => {
        resolve(
          checked.sort(
            (a, b) => a.id - b.id,
          ),
        )
      }

      tx.onerror = () => {
        reject(
          tx.error ||
          new Error(
            'تعذر فحص الكتب المحفوظة.',
          ),
        )
      }

      tx.onabort = () => {
        reject(
          tx.error ||
          new Error(
            'تعذر فحص الكتب المحفوظة.',
          ),
        )
      }
    })
  } finally {
    db.close()
  }
}

export async function removeOfflineTafsir(
  book: number,
): Promise<void> {
  const db = await openLibrary()

  try {
    await new Promise<void>(
      (resolve, reject) => {
        const tx = db.transaction(
          ['books', 'verses'],
          'readwrite',
        )

        const cursorRequest = tx
          .objectStore('verses')
          .openCursor(
            rangeForBook(book),
          )

        cursorRequest.onsuccess = () => {
          const cursor =
            cursorRequest.result

          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            tx
              .objectStore('books')
              .delete(book)
          }
        }

        tx.oncomplete = () => {
          resolve()
        }

        tx.onerror = () => {
          reject(
            tx.error ||
            new Error(
              'تعذر حذف الكتاب.',
            ),
          )
        }

        tx.onabort = () => {
          reject(
            tx.error ||
            new Error(
              'تعذر حذف الكتاب.',
            ),
          )
        }
      },
    )
  } finally {
    db.close()
  }
}

async function readStreamAsText(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const reader = stream.getReader()

  const decoder = new TextDecoder(
    'utf-8',
    { fatal: true },
  )

  const parts: string[] = []

  let size = 0

  try {
    for (;;) {
      if (signal.aborted) {
        throw new Error(
          'تم إيقاف التنزيل.',
        )
      }

      const chunk = await reader.read()

      if (chunk.done) break
      if (!chunk.value) continue

      size += chunk.value.byteLength

      if (size > maxBytes) {
        throw new Error(
          'الكتاب أكبر من سعة المعالجة الآمنة لهذا الجهاز.',
        )
      }

      parts.push(
        decoder.decode(
          chunk.value,
          { stream: true },
        ),
      )
    }

    parts.push(
      decoder.decode(),
    )

    return parts.join('')
  } finally {
    if (
      signal.aborted ||
      size > maxBytes
    ) {
      void reader
        .cancel()
        .catch(() => undefined)
    }

    reader.releaseLock()
  }
}

async function decodeDownload(
  blob: Blob,
  signal: AbortSignal,
): Promise<string> {
  const signature = new Uint8Array(
    await blob
      .slice(0, 2)
      .arrayBuffer(),
  )

  const gzipped =
    signature[0] === 0x1f &&
    signature[1] === 0x8b

  if (gzipped) {
    if (
      typeof DecompressionStream ===
      'undefined'
    ) {
      throw new Error(
        'المتصفح لا يدعم فك ضغط التفسير. جرّب تحديث المتصفح.',
      )
    }

    return readStreamAsText(
      blob
        .stream()
        .pipeThrough(
          new DecompressionStream(
            'gzip',
          ),
        ),
      MAX_DECOMPRESSED_BYTES,
      signal,
    )
  }

  return readStreamAsText(
    blob.stream(),
    MAX_DECOMPRESSED_BYTES,
    signal,
  )
}

export async function downloadOfflineTafsir(
  book: number,
  signal: AbortSignal,
  onProgress: (
    message: string,
  ) => void,
): Promise<OfflineBook> {
  if (
    !OFFLINE_TAFSIR_BOOKS.includes(
      book as typeof OFFLINE_TAFSIR_BOOKS[number],
    )
  ) {
    throw new Error(
      'هذا الكتاب غير متاح للتنزيل.',
    )
  }

  if (signal.aborted) {
    throw new Error(
      'تم إيقاف التنزيل.',
    )
  }

  onProgress(
    'جارٍ تنزيل كتاب التفسير…',
  )

  const response = await fetch(
    `/api/tafsir-download?book=${book}`,
    {
      signal,
      cache: 'no-store',
    },
  )

  if (
    !response.ok ||
    !response.body
  ) {
    throw new Error(
      'تعذر تنزيل كتاب التفسير. تحقق من اتصال الإنترنت ومسار التنزيل.',
    )
  }

  const declared = Number(
    response.headers.get(
      'content-length',
    ) || 0,
  )

  if (
    declared >
    MAX_TRANSFER_BYTES
  ) {
    throw new Error(
      'حجم الملف تجاوز الحد المسموح.',
    )
  }

  const reader =
    response.body.getReader()

  const chunks: Uint8Array[] = []

  let received = 0

  try {
    for (;;) {
      if (signal.aborted) {
        throw new Error(
          'تم إيقاف التنزيل.',
        )
      }

      const packet =
        await reader.read()

      if (packet.done) break
      if (!packet.value) continue

      received +=
        packet.value.byteLength

      if (
        received >
        MAX_TRANSFER_BYTES
      ) {
        throw new Error(
          'الملف أكبر من الحد المسموح.',
        )
      }

      chunks.push(packet.value)

      onProgress(
        declared
          ? `جارٍ التنزيل: ${Math.min(
              100,
              Math.floor(
                (received / declared) *
                  100,
              ),
            )}%`
          : `تم استقبال ${(
              received / 1048576
            ).toFixed(1)} م.ب`,
      )
    }
  } catch (error) {
    void reader
      .cancel()
      .catch(() => undefined)

    throw error
  } finally {
    reader.releaseLock()
  }

  if (
    !received ||
    signal.aborted
  ) {
    throw new Error(
      'لم يكتمل تنزيل الكتاب.',
    )
  }

  if (
    declared &&
    received !== declared
  ) {
    throw new Error(
      'انقطع التنزيل قبل اكتمال الملف. الكتاب السابق لم يتغير.',
    )
  }

  onProgress(
    'جارٍ فك الضغط والتحقق من بيانات الكتاب…',
  )

  const archive = new Blob(
    chunks as BlobPart[],
    {
      type:
        'application/octet-stream',
    },
  )

  const text = await decodeDownload(
    archive,
    signal,
  )

  if (signal.aborted) {
    throw new Error(
      'تم إيقاف التنزيل.',
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(
      text,
    ) as unknown
  } catch {
    throw new Error(
      'ملف التفسير غير صالح أو غير مكتمل؛ لم يتم تغيير النسخة السابقة.',
    )
  }

  const verses = parseBookDump(
    parsed,
    book,
  )

  if (signal.aborted) {
    throw new Error(
      'تم إيقاف التنزيل.',
    )
  }

  onProgress(
    `جارٍ حفظ ${verses.length.toLocaleString(
      'ar-EG',
    )} تفسير آية…`,
  )

  const db = await openLibrary()

  const metadata: OfflineBook = {
    id: book,
    entries: verses.length,
    bytes: received,
    savedAt: Date.now(),
  }

  try {
    await new Promise<void>(
      (resolve, reject) => {
        const tx = db.transaction(
          ['verses', 'books'],
          'readwrite',
        )

        const versesStore =
          tx.objectStore(
            'verses',
          )

        const oldCursor =
          versesStore.openCursor(
            rangeForBook(book),
          )

        oldCursor.onsuccess = () => {
          const cursor =
            oldCursor.result

          if (cursor) {
            cursor.delete()
            cursor.continue()
            return
          }

          // One atomic transaction.
          verses.forEach((verse) => {
            versesStore.put(
              verse,
            )
          })

          tx
            .objectStore('books')
            .put(metadata)
        }

        tx.oncomplete = () => {
          resolve()
        }

        tx.onerror = () => {
          reject(
            tx.error ||
            new Error(
              'تعذر حفظ التفسير.',
            ),
          )
        }

        tx.onabort = () => {
          reject(
            tx.error ||
            new Error(
              'تعذر الحفظ؛ ربما امتلأت مساحة التخزين.',
            ),
          )
        }

        if (signal.aborted) {
          tx.abort()
        }
      },
    )

    onProgress(
      'تم حفظ كتاب التفسير بنجاح وهو جاهز للقراءة دون نت.',
    )

    return metadata
  } finally {
    db.close()
  }
}
