const DB = 'samee3-visual-clips-v1'
const STORE = 'videos'

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(
        Error('التخزين المحلي غير متاح')
      )
    }

    const request = indexedDB.open(DB, 1)

    request.onupgradeneeded = () => {
      if (
        !request.result.objectStoreNames.contains(STORE)
      ) {
        request.result.createObjectStore(STORE)
      }
    }

    request.onsuccess = () =>
      resolve(request.result)

    request.onerror = () =>
      reject(
        request.error ||
        Error('تعذّر فتح التخزين')
      )
  })

export async function saveClip(
  id: string,
  blob: Blob
): Promise<void> {
  const db = await open()

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        STORE,
        'readwrite'
      )

      tx.objectStore(STORE).put(blob, id)

      tx.oncomplete = () => resolve()

      tx.onerror = () =>
        reject(
          tx.error ||
          Error('تعذّر حفظ الفيديو')
        )
    })
  } finally {
    db.close()
  }
}

export async function readClip(
  id: string
): Promise<Blob | null> {
  const db = await open()

  try {
    return await new Promise(
      (resolve, reject) => {
        const tx = db.transaction(
          STORE,
          'readonly'
        )

        const request =
          tx.objectStore(STORE).get(id)

        request.onsuccess = () =>
          resolve(
            request.result instanceof Blob
              ? request.result
              : null
          )

        request.onerror = () =>
          reject(
            request.error ||
            Error('تعذّر قراءة الفيديو')
          )
      }
    )
  } finally {
    db.close()
  }
}

export async function clipKeys(): Promise<string[]> {
  const db = await open()

  try {
    return await new Promise(
      (resolve, reject) => {
        const request = db.transaction(
          STORE,
          'readonly'
        ).objectStore(STORE).getAllKeys()

        request.onsuccess = () =>
          resolve(request.result.map(String))

        request.onerror = () =>
          reject(
            request.error ||
            Error('تعذّر استعراض القوالب')
          )
      }
    )
  } finally {
    db.close()
  }
}

export async function removeClip(
  id: string
): Promise<void> {
  const db = await open()

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        STORE,
        'readwrite'
      )

      tx.objectStore(STORE).delete(id)

      tx.oncomplete = () => resolve()

      tx.onerror = () =>
        reject(
          tx.error ||
          Error('تعذّر الحذف')
        )
    })
  } finally {
    db.close()
  }
}
