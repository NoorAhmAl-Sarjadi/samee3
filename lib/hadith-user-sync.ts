'use client'

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export type HadithResume = {
  bookId: string
  chapterId: number
  hadithId: number
  savedAt: number
}

export type HadithSavedItem = {
  key: string
  bookId: string
  bookTitle: string
  chapterId: number
  number: number
  excerpt: string
}

export type HadithUserData = {
  favorites: string[]
  savedItems: HadithSavedItem[]
  notes: Record<string, string>
  resume: HadithResume | null
}

export type HadithUserChanges = Partial<HadithUserData>

export type HadithSyncResult = {
  data: HadithUserData
  status: 'synced' | 'offline' | 'signed-out' | 'permission-denied' | 'error'
  pending: boolean
}

type Versioned<T> = {
  value: T
  updatedAt: number
  device: string
}

type SyncDocument = {
  version: 1
  favorites: Record<string, Versioned<boolean>>
  savedItems: Record<string, Versioned<HadithSavedItem | null>>
  notes: Record<string, Versioned<string | null>>
  resume: Versioned<HadithResume | null> | null
}

const LOCAL_PREFIX = 'samee3_hadith_private_v1_'
const DEVICE_KEY = 'samee3_hadith_device_v1'
const FAV_KEY = 'samee3_hadith_favorites'
const SAVED_KEY = 'samee3_hadith_saved_v2'
const NOTES_KEY = 'samee3_hadith_notes_v1'
const RESUME_KEY = 'samee3_hadith_resume'

const MAX_FAVORITES = 650
const MAX_SAVED = 650
const MAX_NOTES = 150
const MAX_NOTE_LENGTH = 1400
const MAX_EXCERPT_LENGTH = 450
const MAX_TITLE_LENGTH = 180
const MAX_STORED_BYTES = 650000
const KEY_PATTERN = /^[a-z0-9_-]{1,64}:[1-9]\d{0,7}$/i
const BOOK_PATTERN = /^[a-z0-9_-]{1,64}$/i

function safeObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function emptyDocument(): SyncDocument {
  return { version: 1, favorites: {}, savedItems: {}, notes: {}, resume: null }
}

function assertUid(uid: string): void {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
    throw new Error('معرّف المستخدم غير صالح.')
  }
}

function isHadithKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

function validResume(raw: unknown): HadithResume | null {
  const item = safeObject(raw)
  if (!item || typeof item.bookId !== 'string' || !BOOK_PATTERN.test(item.bookId)) return null
  if (!Number.isSafeInteger(item.chapterId) || Number(item.chapterId) < 0) return null
  if (!Number.isSafeInteger(item.hadithId) || Number(item.hadithId) < 1) return null
  if (!Number.isFinite(item.savedAt) || Number(item.savedAt) < 0) return null
  return {
    bookId: item.bookId,
    chapterId: Number(item.chapterId),
    hadithId: Number(item.hadithId),
    savedAt: Number(item.savedAt),
  }
}

function validSavedItem(raw: unknown): HadithSavedItem | null {
  const item = safeObject(raw)
  if (!item || typeof item.key !== 'string' || !isHadithKey(item.key)) return null
  if (typeof item.bookId !== 'string' || !BOOK_PATTERN.test(item.bookId)) return null
  if (typeof item.bookTitle !== 'string' || item.bookTitle.length > MAX_TITLE_LENGTH) return null
  if (!Number.isSafeInteger(item.chapterId) || Number(item.chapterId) < 0) return null
  if (!Number.isSafeInteger(item.number) || Number(item.number) < 1) return null
  if (item.key !== `${item.bookId}:${item.number}`) return null
  if (typeof item.excerpt !== 'string' || item.excerpt.length > MAX_EXCERPT_LENGTH) return null
  return {
    key: item.key, bookId: item.bookId, bookTitle: item.bookTitle,
    chapterId: Number(item.chapterId), number: Number(item.number), excerpt: item.excerpt,
  }
}

function readJson(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text ? JSON.parse(text) as unknown : null
  } catch {
    return null
  }
}

function getDeviceId(): string {
  let value: string | null = null
  try { value = localStorage.getItem(DEVICE_KEY) } catch { /* unavailable */ }
  if (value && /^[a-zA-Z0-9_-]{8,100}$/.test(value)) return value
  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  try { localStorage.setItem(DEVICE_KEY, generated) } catch { /* unavailable */ }
  return generated
}

function stamp<T>(value: T): Versioned<T> {
  return { value, updatedAt: Date.now(), device: getDeviceId() }
}

function parseVersioned<T>(value: unknown, parser: (x: unknown) => T | undefined): Versioned<T> | null {
  const entry = safeObject(value)
  if (!entry || !Number.isSafeInteger(entry.updatedAt) || Number(entry.updatedAt) < 0) return null
  if (typeof entry.device !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(entry.device)) return null
  const parsed = parser(entry.value)
  if (parsed === undefined) return null
  return { value: parsed, updatedAt: Number(entry.updatedAt), device: entry.device }
}

function parseDocument(value: unknown): SyncDocument {
  if (value == null) return emptyDocument()
  const raw = safeObject(value)
  if (!raw || raw.version !== 1) throw new Error('إصدار بيانات المزامنة غير مدعوم.')
  const result = emptyDocument()

  const parseMap = <T>(
    source: unknown,
    destination: Record<string, Versioned<T>>,
    maximum: number,
    parser: (value: unknown) => T | undefined,
  ): void => {
    const entries = Object.entries(safeObject(source) || {})
    if (entries.length > maximum) throw new Error('حجم بيانات المزامنة أكبر من المسموح.')
    for (const [key, rawEntry] of entries) {
      if (!isHadithKey(key)) throw new Error('معرّف حديث غير صالح داخل بيانات المزامنة.')
      const parsed = parseVersioned(rawEntry, parser)
      if (!parsed) throw new Error('بيانات مزامنة غير صالحة.')
      destination[key] = parsed
    }
  }

  parseMap(raw.favorites, result.favorites, MAX_FAVORITES, (x) =>
    typeof x === 'boolean' ? x : undefined)
  parseMap(raw.savedItems, result.savedItems, MAX_SAVED, (x) => {
    if (x === null) return null
    return validSavedItem(x) || undefined
  })
  parseMap(raw.notes, result.notes, MAX_NOTES, (x) => {
    if (x === null) return null
    return typeof x === 'string' && x.length <= MAX_NOTE_LENGTH ? x : undefined
  })
  if (raw.resume !== null && raw.resume !== undefined) {
    const parsed = parseVersioned(raw.resume, (x) =>
      x === null ? null : validResume(x) || undefined)
    if (!parsed) throw new Error('بيانات آخر قراءة غير صالحة.')
    result.resume = parsed
  }
  return result
}

function loadLocal(uid: string): SyncDocument {
  assertUid(uid)
  if (typeof localStorage === 'undefined') return emptyDocument()
  const raw = readJson(`${LOCAL_PREFIX}${uid}`)
  return parseDocument(raw)
}

function saveLocal(uid: string, state: SyncDocument): void {
  assertUid(uid)
  const serialized = JSON.stringify(state)
  if (new TextEncoder().encode(serialized).byteLength > MAX_STORED_BYTES) {
    throw new Error('بيانات الحفظ تجاوزت المساحة المسموح بها؛ اختصر الملاحظات.')
  }
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${uid}`, serialized)
  } catch {
    throw new Error('تعذر حفظ التغييرات على هذا الجهاز؛ تحقق من مساحة التخزين.')
  }
}

function compareVersion(a: Versioned<unknown>, b: Versioned<unknown>): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt
  const deviceOrder = a.device.localeCompare(b.device)
  if (deviceOrder !== 0) return deviceOrder
  return JSON.stringify(a.value).localeCompare(JSON.stringify(b.value))
}

function mergeMap<T>(
  local: Record<string, Versioned<T>>,
  remote: Record<string, Versioned<T>>,
): Record<string, Versioned<T>> {
  const merged = { ...remote }
  for (const [key, value] of Object.entries(local)) {
    if (!merged[key] || compareVersion(value, merged[key]) > 0) merged[key] = value
  }
  return merged
}

export function mergeHadithSyncDocuments(left: unknown, right: unknown): SyncDocument {
  const a = parseDocument(left)
  const b = parseDocument(right)
  const result: SyncDocument = {
    version: 1,
    favorites: mergeMap(a.favorites, b.favorites),
    savedItems: mergeMap(a.savedItems, b.savedItems),
    notes: mergeMap(a.notes, b.notes),
    resume: !a.resume ? b.resume : !b.resume ? a.resume
      : compareVersion(a.resume, b.resume) > 0 ? a.resume : b.resume,
  }
  return parseDocument(result)
}

function project(state: SyncDocument): HadithUserData {
  const favorites = Object.entries(state.favorites)
    .filter(([, entry]) => entry.value)
    .map(([key]) => key)
    .sort()
  const savedItems = Object.values(state.savedItems)
    .filter((entry) => entry.value !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((entry) => entry.value as HadithSavedItem)
  const notes: Record<string, string> = {}
  for (const [key, item] of Object.entries(state.notes)) {
    if (item.value !== null && item.value !== '') notes[key] = item.value
  }
  return { favorites, savedItems, notes, resume: state.resume?.value ?? null }
}

export function readHadithUserData(uid: string): HadithUserData {
  return project(loadLocal(uid))
}

function updateMap<T>(
  current: Record<string, Versioned<T | null>>,
  next: Record<string, T>,
): Record<string, Versioned<T | null>> {
  const result = { ...current }
  for (const key of Object.keys(current)) {
    if (current[key].value !== null && !(key in next)) result[key] = stamp(null)
  }
  for (const [key, value] of Object.entries(next)) {
    const old = result[key]?.value
    if (old === null || JSON.stringify(old) !== JSON.stringify(value)) result[key] = stamp(value)
  }
  return result
}

export function saveHadithUserChanges(uid: string, changes: HadithUserChanges): HadithUserData {
  const data = loadLocal(uid)
  if (changes.favorites !== undefined) {
    if (!Array.isArray(changes.favorites) || changes.favorites.length > MAX_FAVORITES) {
      throw new Error('عدد الأحاديث في المفضلة تجاوز الحد المسموح.')
    }
    const next: Record<string, boolean> = {}
    for (const key of changes.favorites) {
      if (!isHadithKey(key)) throw new Error('معرّف حديث غير صالح في المفضلة.')
      next[key] = true
    }
    const updated = { ...data.favorites }
    for (const key of Object.keys(updated)) {
      if (updated[key].value && !(key in next)) updated[key] = stamp(false)
    }
    for (const key of Object.keys(next)) {
      if (!updated[key] || !updated[key].value) updated[key] = stamp(true)
    }
    data.favorites = updated
  }
  if (changes.savedItems !== undefined) {
    if (!Array.isArray(changes.savedItems) || changes.savedItems.length > MAX_SAVED) {
      throw new Error('عدد الأحاديث المحفوظة تجاوز الحد المسموح.')
    }
    const next: Record<string, HadithSavedItem> = {}
    for (const input of changes.savedItems) {
      const item = validSavedItem(input)
      if (!item) throw new Error('بيانات حديث محفوظ غير صالحة.')
      next[item.key] = item
    }
    data.savedItems = updateMap(data.savedItems, next)
  }
  if (changes.notes !== undefined) {
    const source = safeObject(changes.notes)
    if (!source || Object.keys(source).length > MAX_NOTES) throw new Error('عدد الملاحظات كبير جدًا.')
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(source)) {
      if (!isHadithKey(key) || typeof value !== 'string' || value.length > MAX_NOTE_LENGTH) {
        throw new Error('ملاحظة غير صالحة أو تجاوزت الحد المسموح.')
      }
      if (value.trim()) next[key] = value
    }
    data.notes = updateMap(data.notes, next)
  }
  if (changes.resume !== undefined) {
    const next = changes.resume === null ? null : validResume(changes.resume)
    if (changes.resume !== null && !next) throw new Error('آخر موضع قراءة غير صالح.')
    if (JSON.stringify(data.resume?.value ?? null) !== JSON.stringify(next)) data.resume = stamp(next)
  }
  const validated = parseDocument(data)
  saveLocal(uid, validated)
  return project(validated)
}

export function importLegacyHadithData(uid: string): HadithUserData {
  const current = readHadithUserData(uid)
  const oldFavorites = readJson(FAV_KEY)
  const oldSaved = readJson(SAVED_KEY)
  const oldNotes = readJson(NOTES_KEY)
  const oldResume = readJson(RESUME_KEY)

  const favorites = new Set(current.favorites)
  if (Array.isArray(oldFavorites)) {
    for (const key of oldFavorites) {
      if (typeof key === 'string' && isHadithKey(key)) favorites.add(key)
    }
  }

  const savedByKey = new Map(current.savedItems.map((item) => [item.key, item]))
  if (Array.isArray(oldSaved)) {
    for (const input of oldSaved) {
      const item = validSavedItem(input)
      if (item && !savedByKey.has(item.key)) savedByKey.set(item.key, item)
    }
  }

  const notes = { ...current.notes }
  const guestNotes = safeObject(oldNotes)
  if (guestNotes) {
    for (const [key, value] of Object.entries(guestNotes)) {
      if (isHadithKey(key) && typeof value === 'string' && value.length <= MAX_NOTE_LENGTH && !(key in notes)) {
        notes[key] = value
      }
    }
  }

  return saveHadithUserChanges(uid, {
    favorites: Array.from(favorites),
    savedItems: Array.from(savedByKey.values()),
    notes,
    resume: current.resume ?? validResume(oldResume),
  })
}

export async function synchronizeHadithUserData(uid: string): Promise<HadithSyncResult> {
  assertUid(uid)
  const local = loadLocal(uid)
  const fallback = (status: HadithSyncResult['status']): HadithSyncResult => ({
    data: readHadithUserData(uid), status, pending: true,
  })
  if (auth.currentUser?.uid !== uid) return fallback('signed-out')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallback('offline')

  try {
    const reference = doc(db, 'users', uid, 'hadithData', 'state')
    const result = await runTransaction(db, async (transaction): Promise<SyncDocument> => {
      const snapshot = await transaction.get(reference)
      const cloud = snapshot.exists() ? snapshot.data() : null
      if (cloud && (cloud.version !== 1 || !cloud.snapshot)) {
        throw new Error('بنية البيانات المحفوظة على Firebase غير متوافقة.')
      }
      const remote = cloud ? parseDocument(cloud.snapshot) : emptyDocument()
      const merged = mergeHadithSyncDocuments(local, remote)
      if (!snapshot.exists() || JSON.stringify(merged) !== JSON.stringify(remote)) {
        transaction.set(reference, {
          version: 1,
          snapshot: merged,
          updatedAt: serverTimestamp(),
        })
      }
      return merged
    })

    if (auth.currentUser?.uid !== uid) return fallback('signed-out')
    const latestLocal = loadLocal(uid)
    const latestMerged = mergeHadithSyncDocuments(latestLocal, result)
    saveLocal(uid, latestMerged)
    return {
      data: project(latestMerged), status: 'synced',
      pending: JSON.stringify(latestMerged) !== JSON.stringify(result),
    }
  } catch (error) {
    const code = safeObject(error)?.code
    if (code === 'permission-denied') return fallback('permission-denied')
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallback('offline')
    return fallback('error')
  }
}

export function watchHadithLocalUpdates(
  uid: string,
  onChange: (data: HadithUserData) => void,
): () => void {
  assertUid(uid)
  if (typeof window === 'undefined') return () => {}
  const listen = (event: StorageEvent) => {
    if (event.key === `${LOCAL_PREFIX}${uid}`) onChange(readHadithUserData(uid))
  }
  window.addEventListener('storage', listen)
  return () => window.removeEventListener('storage', listen)
}