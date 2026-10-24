'use client'

export interface SavedHadith {
  id: string // Format: bookId:hadithId
  bookId: string
  bookName: string
  chapterName: string
  hadithNumber: number
  arabic: string
  narrator: string
  hasAudio: boolean
  savedAt: number
}

const DB_NAME = 'Samee3OfflineDB'
const DB_VERSION = 1
const STORE_HADITHS = 'hadiths'
const STORE_AUDIO = 'audio_blobs'

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('Not in browser')
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_HADITHS)) {
        db.createObjectStore(STORE_HADITHS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveHadithOffline(hadithData: SavedHadith, audioUrl?: string): Promise<void> {
  const db = await getDB()
  
  return new Promise(async (resolve, reject) => {
    try {
      let audioBlob: Blob | null = null
      if (audioUrl) {
        const response = await fetch(audioUrl)
        if (!response.ok) throw new Error('فشل تحميل الملف الصوتي')
        audioBlob = await response.blob()
      }

      const tx = db.transaction([STORE_HADITHS, STORE_AUDIO], 'readwrite')
      const hadithStore = tx.objectStore(STORE_HADITHS)
      const audioStore = tx.objectStore(STORE_AUDIO)

      const finalHadithData = { ...hadithData, hasAudio: !!audioBlob, savedAt: Date.now() }
      hadithStore.put(finalHadithData)

      if (audioBlob) {
        audioStore.put({ id: hadithData.id, blob: audioBlob })
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    } catch (error) {
      reject(error)
    }
  })
}

export async function removeHadithOffline(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_HADITHS, STORE_AUDIO], 'readwrite')
    tx.objectStore(STORE_HADITHS).delete(id)
    tx.objectStore(STORE_AUDIO).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAllOfflineData(): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_HADITHS, STORE_AUDIO], 'readwrite')
    tx.objectStore(STORE_HADITHS).clear()
    tx.objectStore(STORE_AUDIO).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getOfflineHadiths(): Promise<SavedHadith[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HADITHS, 'readonly')
    const request = tx.objectStore(STORE_HADITHS).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function getOfflineAudioBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readonly')
    const request = tx.objectStore(STORE_AUDIO).get(id)
    request.onsuccess = () => resolve(request.result?.blob || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getStorageStats(): Promise<{ hadithsCount: number; audioCount: number; sizeBytes: number }> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_HADITHS, STORE_AUDIO], 'readonly')
    const hadithStore = tx.objectStore(STORE_HADITHS)
    const audioStore = tx.objectStore(STORE_AUDIO)

    let hadithsCount = 0
    let audioCount = 0
    let sizeBytes = 0

    hadithStore.count().onsuccess = (e) => { hadithsCount = (e.target as IDBRequest).result }
    
    const audioRequest = audioStore.getAll()
    audioRequest.onsuccess = () => {
      const records = audioRequest.result || []
      audioCount = records.length
      sizeBytes = records.reduce((acc, curr) => acc + (curr.blob?.size || 0), 0)
      resolve({ hadithsCount, audioCount, sizeBytes })
    }
    audioRequest.onerror = () => reject(audioRequest.error)
  })
}
