/** Browser-only clips: playback never requires an account or persistent storage. */
const DB = 'samee3-visual-clips-v1'
const STORE = 'videos'
const OPEN_TIMEOUT = 3000
const TRANSACTION_TIMEOUT = 5000
const sessionClips = new Map<string, Blob>()

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('التخزين المحلي غير متاح في هذا المتصفح.'))
      return
    }

    let settled = false
    const request = indexedDB.open(DB, 1)
    const timeout = setTimeout(() => {
      finish(new Error('انتهت مهلة فتح التخزين المحلي.'))
    }, OPEN_TIMEOUT)

    function finish(error?: Error, database?: IDBDatabase) {
      if (settled) {
        database?.close()
        return
      }

      settled = true
      clearTimeout(timeout)

      if (error) reject(error)
      else if (database) resolve(database)
    }

    request.onupgradeneeded = () => {
      if (settled) {
        request.transaction?.abort()
        return
      }

      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }

    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      finish(undefined, request.result)
    }

    request.onerror = () => {
      finish(request.error || new Error('تعذّر فتح التخزين المحلي.'))
    }

    request.onblocked = () => {
      finish(
        new Error(
          'التخزين مشغول في تبويب آخر؛ يمكنك استخدام الفيديو في الجلسة الحالية.'
        )
      )
    }
  })
}

async function useStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await open()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))

      let settled = false
      let value: T

      const timeout = setTimeout(() => {
        fail(new Error('انتهت مهلة الوصول إلى الفيديو المحفوظ.'))

        try {
          transaction.abort()
        } catch {}
      }, TRANSACTION_TIMEOUT)

      function fail(error: Error) {
        if (settled) return

        settled = true
        clearTimeout(timeout)
        reject(error)
      }

      request.onsuccess = () => {
        value = request.result
      }

      request.onerror = () => {
        fail(request.error || new Error('تعذّر الوصول إلى الفيديو المحفوظ.'))
      }

      transaction.oncomplete = () => {
        if (settled) return

        settled = true
        clearTimeout(timeout)
        resolve(value)
      }

      transaction.onerror = transaction.onabort = () => {
        fail(transaction.error || new Error('تعذّر إكمال عملية التخزين.'))
      }
    })
  } finally {
    database.close()
  }
}

export async function saveClip(id: string, blob: Blob): Promise<void> {
  if (!id || !(blob instanceof Blob) || !blob.size) {
    throw new Error('ملف الفيديو فارغ أو غير صالح.')
  }

  // Available immediately, even if IndexedDB is blocked or its quota is full.
  sessionClips.set(id, blob)

  await useStore('readwrite', (store) => store.put(blob, id))
}

export async function readClip(id: string): Promise<Blob | null> {
  const temporary = sessionClips.get(id)

  if (temporary) return temporary

  try {
    const value = await useStore('readonly', (store) => store.get(id))

    return value instanceof Blob && value.size > 0 ? value : null
  } catch {
    return null
  }
}

export async function clipKeys(): Promise<string[]> {
  let saved: string[] = []

  try {
    saved = (
      await useStore('readonly', (store) => store.getAllKeys())
    ).map(String)
  } catch {}

  return Array.from(new Set([...saved, ...sessionClips.keys()]))
}

export async function removeClip(id: string): Promise<void> {
  sessionClips.delete(id)

  await useStore('readwrite', (store) => store.delete(id))
}