'use client'

import ShareCardDesigner from '@/components/ShareCardDesigner'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type TouchEvent } from 'react'
import Link from 'next/link'
import JSZip from 'jszip'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import {
  ArrowLeft, ArrowRight, BookOpen, BookMarked, Bookmark,
  ChevronLeft, ChevronRight, Copy, Download, Heart, ExternalLink, ClipboardCheck, Info,
  Image as ImageIcon, Library, List, Loader2, Menu, Moon, RefreshCw,
  Search, Share2, ShieldCheck, Sun, Type, WifiOff, X,
} from 'lucide-react'
import {
  HADITH_BOOKS,
  HADITH_SOURCE,
  getCachedHadithChapters,
  getHadithBook,
  getHadithBooks,
  getHadithChapter,
  parseChapterHadiths,
  normalizeHadithSearch,
  type HadithBook,
  type HadithChapter,
  type HadithRecord,
} from '@/lib/hadith-catalog'
import {
  getHadithExplanation,
  type HadithExplanationResult,
} from '@/lib/hadith-explanations'
import {
  importLegacyHadithData,
  readHadithUserData,
  saveHadithUserChanges,
  synchronizeHadithUserData,
  watchHadithLocalUpdates,
  type HadithUserData,
  type HadithSavedItem,
  type HadithResume,
  type HadithSyncResult,
} from '@/lib/hadith-user-sync'

const FAV_KEY = 'samee3_hadith_favorites'
const SAVED_KEY = 'samee3_hadith_saved_v2'
const RESUME_KEY = 'samee3_hadith_resume'
const SETTINGS_KEY = 'samee3_hadith_reader_settings_v2'
const NOTES_KEY = 'samee3_hadith_notes_v1'
const CATEGORIES = ['الكتب التسعة', 'الأربعينات', 'كتب أخرى'] as const

type Appearance = 'cream' | 'night'
type DesignStyle = 'gold' | 'emerald' | 'midnight'
type Screen = 'library' | 'reader' | 'favorites' | 'search'

type Resume = HadithResume
type SavedItem = HadithSavedItem
type CloudSyncStatus = 'guest' | 'idle' | 'syncing' | HadithSyncResult['status']
type DownloadState = { bookId: string; done: number; total: number; active: boolean; error: string; complete: boolean }
type RequestedPosition = { bookId: string; chapterId: number; hadithId?: number } | null

// البحث الشامل يقرأ الأبواب الموجودة مسبقًا في Cache Storage فقط.
// لا يبدأ تنزيل أي كتاب أو باب جديد أثناء البحث.
type GlobalHit = {
  key: string
  bookId: string
  chapterId: number
  idInBook: number
  excerpt: string
}
type GlobalProgress = {
  total: number
  checked: number
  skipped: number
  matches: number
}
type GlobalPhase = 'idle' | 'running' | 'complete' | 'cancelled' | 'error'
const GLOBAL_SEARCH_LIMIT = 160
const CACHE_JSON_LIMIT = 20 * 1024 * 1024
const EMPTY_GLOBAL_PROGRESS: GlobalProgress = { total: 0, checked: 0, skipped: 0, matches: 0 }

function normalizeGlobalQuery(value: string): string {
  return normalizeHadithSearch(value)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesGlobalHadith(text: string, number: number, search: string): boolean {
  if (/^\d+$/.test(search)) return number === Number(search)
  const words = search.split(' ').filter(Boolean)
  const content = normalizeGlobalQuery(text)
  return words.length > 0 && words.every((word) => content.includes(word))
}

function globalSnippet(text: string, search: string): string {
  const word = search.split(' ')[0] || ''
  let position = 0
  if (word && !/^\d+$/.test(word)) {
    const positions: number[] = []
    let stripped = ''
    for (let i = 0; i < text.length; i++) {
      const value = normalizeGlobalQuery(text[i])
      for (const char of value) {
        positions.push(i)
        stripped += char
      }
    }
    const match = stripped.indexOf(word)
    if (match >= 0) position = positions[match] || 0
  }
  const from = Math.max(0, position - 62)
  const to = Math.min(text.length, Math.max(position + 200, 260))
  return `${from ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}

function markedGlobalExcerpt(text: string, search: string): ReactNode[] {
  const word = normalizeGlobalQuery(search).split(' ')[0] || ''
  if (!word || /^\d+$/.test(word)) return [text]
  let normalized = ''
  const positionMap: number[] = []
  for (let i = 0; i < text.length; i++) {
    const mapped = normalizeGlobalQuery(text[i])
    for (const char of mapped) { normalized += char; positionMap.push(i) }
  }
  const found = normalized.indexOf(word)
  if (found < 0) return [text]
  const from = positionMap[found]
  const to = (positionMap[found + word.length - 1] || from) + 1
  return [
    text.slice(0, from),
    <mark key="match" className="rounded-sm bg-[#d4ab63]/35 px-0.5 font-bold text-inherit">{text.slice(from, to)}</mark>,
    text.slice(to),
  ]
}

async function cachedJsonText(response: Response, signal: AbortSignal): Promise<string> {
  const claimed = Number(response.headers.get('content-length') || 0)
  if (claimed > CACHE_JSON_LIMIT) throw new Error('oversized-cache-entry')
  if (!response.body) throw new Error('empty-cache-entry')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const blocks: string[] = []
  let count = 0
  let complete = false
  try {
    while (true) {
      if (signal.aborted) throw new Error('search-cancelled')
      const packet = await reader.read()
      if (packet.done) { complete = true; break }
      if (!packet.value) continue
      count += packet.value.byteLength
      if (count > CACHE_JSON_LIMIT) throw new Error('oversized-cache-entry')
      blocks.push(decoder.decode(packet.value, { stream: true }))
    }
    if (signal.aborted) throw new Error('search-cancelled')
    blocks.push(decoder.decode())
    return blocks.join('')
  } finally {
    if (!complete) { try { await reader.cancel() } catch { /* ignore */ } }
    reader.releaseLock()
  }
}

async function searchCachedHadithCorpus(
  query: string,
  filterBook: string,
  signal: AbortSignal,
  onProgress: (progress: GlobalProgress, hits: readonly GlobalHit[]) => void,
): Promise<{ hits: GlobalHit[]; progress: GlobalProgress }> {
  const needle = normalizeGlobalQuery(query)
  if (!needle) return { hits: [], progress: { ...EMPTY_GLOBAL_PROGRESS } }
  if (typeof caches === 'undefined' || typeof window === 'undefined') {
    throw new Error('التخزين المحلي غير متاح في هذا المتصفح.')
  }
  const names = await caches.keys()
  if (signal.aborted) throw new Error('search-cancelled')
  if (!names.includes(HADITH_SOURCE.cacheName)) {
    return { hits: [], progress: { ...EMPTY_GLOBAL_PROGRESS } }
  }
  const cache = await caches.open(HADITH_SOURCE.cacheName)
  const requests = await cache.keys()
  if (signal.aborted) throw new Error('search-cancelled')
  const found = new Map<string, { request: Request; bookId: string; chapterId: number }>()
  for (const request of requests) {
    if (request.method !== 'GET') continue
    const url = new URL(request.url)
    if (url.origin !== window.location.origin || url.search || url.hash) continue
    const match = /^\/api\/hadith\/([a-z0-9_]+)\/chapter\/(0|[1-9]\d{0,5})$/.exec(url.pathname)
    if (!match) continue
    const bookId = match[1]
    const chapterId = Number(match[2])
    if (filterBook && filterBook !== bookId) continue
    if (!HADITH_BOOKS.some((book) => book.id === bookId)) continue
    const key = `${bookId}:${chapterId}`
    if (!found.has(key)) found.set(key, { request, bookId, chapterId })
  }
  const progress: GlobalProgress = { total: found.size, checked: 0, skipped: 0, matches: 0 }
  const hits: GlobalHit[] = []
  onProgress({ ...progress }, hits)
  for (const entry of Array.from(found.values())) {
    if (signal.aborted) throw new Error('search-cancelled')
    try {
      const response = await cache.match(entry.request)
      if (!response?.ok) throw new Error('invalid-response')
      const text = await cachedJsonText(response, signal)
      const parsed: unknown = JSON.parse(text) as unknown
      const hadiths = parseChapterHadiths(parsed)
      if (!hadiths.length || hadiths.some((hadith) => hadith.chapterId !== entry.chapterId)) {
        throw new Error('invalid-chapter-content')
      }
      for (const hadith of hadiths) {
        if (matchesGlobalHadith(hadith.arabic, hadith.idInBook, needle)) {
          progress.matches++
          if (hits.length < GLOBAL_SEARCH_LIMIT) {
            hits.push({
              key: `${entry.bookId}:${entry.chapterId}:${hadith.idInBook}`,
              bookId: entry.bookId,
              chapterId: entry.chapterId,
              idInBook: hadith.idInBook,
              excerpt: globalSnippet(hadith.arabic, needle),
            })
          }
        }
      }
    } catch (error) {
      if (signal.aborted) throw error
      progress.skipped++
    }
    progress.checked++
    if (progress.checked % 3 === 0 || progress.checked === progress.total) {
      onProgress({ ...progress }, [...hits])
      // لا نجمّد الرسم في Safari أثناء فحص كتب كبيرة محفوظة.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  if (signal.aborted) throw new Error('search-cancelled')
  return { hits, progress }
}

const digit = (value: string | number) => String(value).replace(/\d/g, (n) => '٠١٢٣٤٥٦٧٨٩'[Number(n)])
const favoriteKey = (bookId: string, number: number) => `${bookId}:${number}`

// البحث في الموسوعات الخارجية وسيلة للمراجعة البشرية، ولا يعتبر حكمًا على الحديث.
const HADITH_VERIFICATION_URL = 'https://dorar.net/hadith'
const HADITH_ALTERNATIVE_LIBRARY_URL = 'https://sunnah.com/'

function hadithVerificationPhrase(text: string): string {
  const collapsed = text.replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  const starts = [
    'قال رسول الله صلى الله عليه وسلم',
    'أن رسول الله صلى الله عليه وسلم',
    'عن رسول الله صلى الله عليه وسلم',
    'قال النبي صلى الله عليه وسلم',
    'أن النبي صلى الله عليه وسلم',
  ]
  let start = 0
  for (const cue of starts) {
    const found = collapsed.indexOf(cue)
    if (found >= 0) { start = found; break }
  }
  return collapsed.slice(start, start + 140).trim()
}

function hadithBibliographicReference(book: HadithBook, chapter: HadithChapter | null, hadith: HadithRecord): string {
  const chapterTitle = chapter?.name_ar || `الباب رقم ${hadith.chapterId}`
  return `${book.name_ar}، ${chapterTitle}، رقم الحديث في المصدر الرقمي: ${hadith.idInBook}.\nالبيانات النصية: Al Furqan Hadith API\n${HADITH_SOURCE.documentation}\nتنبيه: قد تختلف الترقيمات بين الطبعات.`
}
const within = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}
function saveStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
}
function readGuestHadithData(): HadithUserData {
  const favorites = readStorage<unknown>(FAV_KEY, [])
  const saved = readStorage<unknown>(SAVED_KEY, [])
  const rawNotes = readStorage<unknown>(NOTES_KEY, {})
  const notes: Record<string, string> = {}
  if (rawNotes && typeof rawNotes === 'object' && !Array.isArray(rawNotes)) {
    for (const [key, value] of Object.entries(rawNotes as Record<string, unknown>)) {
      if (typeof value === 'string' && /^[a-z0-9_-]{1,64}:[1-9]\d{0,7}$/i.test(key)) {
        notes[key] = value
      }
    }
  }
  return {
    favorites: Array.isArray(favorites)
      ? favorites.filter((key): key is string => typeof key === 'string' && /^[a-z0-9_-]{1,64}:[1-9]\d{0,7}$/i.test(key))
      : [],
    savedItems: Array.isArray(saved)
      ? saved.filter((item): item is SavedItem => !!item && typeof item.key === 'string' && typeof item.bookId === 'string' && Number.isSafeInteger(item.chapterId) && item.chapterId >= 0 && Number.isSafeInteger(item.number) && item.number > 0)
      : [],
    notes,
    resume: validResume(readStorage<unknown>(RESUME_KEY, null)),
  }
}

function hasGuestHadithData(): boolean {
  const old = readGuestHadithData()
  return old.favorites.length > 0 || old.savedItems.length > 0 ||
    Object.keys(old.notes).length > 0 || old.resume !== null
}

// لا نعرض زر الاستيراد بعد إتمامه لنفس نسخة بيانات الضيف.
// عند إضافة بيانات ضيف جديدة، يظهر الزر مرة أخرى لهذا الحساب فقط.
const GUEST_IMPORT_MARKER = 'samee3_hadith_guest_imported_v1_'
function guestDataFingerprint(): string {
  const data = JSON.stringify(readGuestHadithData())
  let hash = 2166136261
  for (let i = 0; i < data.length; i++) {
    hash = Math.imul(hash ^ data.charCodeAt(i), 16777619) >>> 0
  }
  return `${data.length}-${hash.toString(36)}`
}
function hasNewGuestDataFor(uid: string): boolean {
  if (!hasGuestHadithData()) return false
  try {
    return localStorage.getItem(`${GUEST_IMPORT_MARKER}${uid}`) !== guestDataFingerprint()
  } catch {
    return true
  }
}

function validResume(value: unknown): Resume | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const chapter = Number(raw.chapterId)
  const hadith = Number(raw.hadithId)
  if (typeof raw.bookId !== 'string' || !HADITH_BOOKS.some((b) => b.id === raw.bookId)) return null
  if (!Number.isSafeInteger(chapter) || chapter < 0 || !Number.isSafeInteger(hadith) || hadith < 1) return null
  return { bookId: raw.bookId, chapterId: chapter, hadithId: hadith, savedAt: Number(raw.savedAt) || Date.now() }
}
function hadithShareText(book: HadithBook, hadith: HadithRecord) {
  return `${hadith.arabic}\n\n${book.name_ar} — الحديث رقم ${digit(hadith.idInBook)}\nمصحف سميع`
}
function message(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && !/abort|cancel/i.test(error.message)) return error.message
  return fallback
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذر حفظ صورة الحديث.')), 'image/png')
  })
}
function breakText(ctx: CanvasRenderingContext2D, content: string, maxWidth: number): string[] {
  const rows: string[] = []
  for (const paragraph of content.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) { rows.push(''); continue }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue }
      if (line) rows.push(line)
      line = word
      if (ctx.measureText(line).width > maxWidth) {
        let part = ''
        for (const char of word) {
          if (ctx.measureText(part + char).width > maxWidth && part) { rows.push(part); part = char }
          else part += char
        }
        line = part
      }
    }
    if (line) rows.push(line)
  }
  return rows
}
export default function HadithPage() {
  const [books, setBooks] = useState<HadithBook[]>(() => HADITH_BOOKS.map((b) => ({ ...b })))
  const [booksSource, setBooksSource] = useState<'network' | 'cache' | 'catalogue'>('catalogue')
  const [screen, setScreen] = useState<Screen>('library')
  const [bookId, setBookId] = useState<string | null>(null)
  const [chapters, setChapters] = useState<HadithChapter[]>([])
  const [chapterId, setChapterId] = useState<number | null>(null)
  const [hadiths, setHadiths] = useState<HadithRecord[]>([])
  const [loadedChapterKey, setLoadedChapterKey] = useState('')
  const [hadithIndex, setHadithIndex] = useState(0)
  const [bookSearch, setBookSearch] = useState('')
  const [chapterSearch, setChapterSearch] = useState('')
  const [hadithSearch, setHadithSearch] = useState('')
  const [loadingBook, setLoadingBook] = useState(false)
  const [loadingChapter, setLoadingChapter] = useState(false)
  const [bookError, setBookError] = useState('')
  const [chapterError, setChapterError] = useState('')
  const [sectionOrigin, setSectionOrigin] = useState<'network' | 'cache'>('network')
  const [accountUid, setAccountUid] = useState<string | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('guest')
  const [syncPending, setSyncPending] = useState(false)
  const [syncNotice, setSyncNotice] = useState('')
  const [syncRevision, setSyncRevision] = useState(0)
  const [guestDataAvailable, setGuestDataAvailable] = useState(false)
  const activeUidRef = useRef<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [savedItems, setSavedItems] = useState<SavedItem[]>([])
  const [resume, setResume] = useState<Resume | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [showNotes, setShowNotes] = useState(false)
  const [showReferences, setShowReferences] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [explanationResult, setExplanationResult] = useState<HadithExplanationResult | null>(null)
  const [explanationRetry, setExplanationRetry] = useState(0)
  const [showChapters, setShowChapters] = useState(true)
  const [appearance, setAppearance] = useState<Appearance>('cream')
  const [fontSize, setFontSize] = useState(27)
  const [design, setDesign] = useState<DesignStyle>('gold')
  const [showDesigner, setShowDesigner] = useState(false)
  const [designBusy, setDesignBusy] = useState(false)
  const [designNotice, setDesignNotice] = useState('')
  const [feedback, setFeedback] = useState('')
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null)
  const [cachedCount, setCachedCount] = useState(0)
  const [ready, setReady] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [globalText, setGlobalText] = useState('')
  const [globalBook, setGlobalBook] = useState('')
  const [globalHits, setGlobalHits] = useState<GlobalHit[]>([])
  const [globalPhase, setGlobalPhase] = useState<GlobalPhase>('idle')
  const [globalProgress, setGlobalProgress] = useState<GlobalProgress>(EMPTY_GLOBAL_PROGRESS)
  const [globalError, setGlobalError] = useState('')
  const [lastGlobalQuery, setLastGlobalQuery] = useState('')

  const initialPosition = useRef<RequestedPosition>(null)
  const readerScroll = useRef<HTMLDivElement | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const downloadController = useRef<AbortController | null>(null)
  const globalController = useRef<AbortController | null>(null)
  const globalSession = useRef(0)
  const bookController = useRef<AbortController | null>(null)
  const chapterController = useRef<AbortController | null>(null)
  const savedResumeRef = useRef<Resume | null>(null)
  const mountedRef = useRef(true)
  const requestedFromEndRef = useRef(false)
  const [bookRetry, setBookRetry] = useState(0)
  const [chapterRetry, setChapterRetry] = useState(0)

  const selectedBook = useMemo(() => books.find((b) => b.id === bookId) || HADITH_BOOKS.find((b) => b.id === bookId) || null, [books, bookId])
  const currentChapter = useMemo(() => chapters.find((c) => c.id === chapterId) || null, [chapters, chapterId])
  const displayedHadiths = useMemo(() => loadedChapterKey === `${bookId}:${chapterId}` ? hadiths : [], [bookId, chapterId, hadiths, loadedChapterKey])
  const activeHadith = displayedHadiths[hadithIndex] || null
  const activeKey = selectedBook && activeHadith ? favoriteKey(selectedBook.id, activeHadith.idInBook) : ''
  const activeIsFavorite = favoriteIds.includes(activeKey)
  const verificationPhrase = useMemo(() => activeHadith ? hadithVerificationPhrase(activeHadith.arabic) : '', [activeHadith?.arabic])
  const bg = appearance === 'night'
  const baseColor = bg ? 'bg-[#101e22] text-[#eae5d8]' : 'bg-[#f7f3e9] text-[#243e40]'
  const surface = bg ? 'bg-[#192b2e] border-[#a58e60]/20' : 'bg-white border-[#d1b781]/20'
  const quiet = bg ? 'text-[#aebdb8]' : 'text-[#75817c]'
  const softSurface = bg ? 'bg-[#20383a]' : 'bg-[#f7f3e9]'

  const applyPersonalData = useCallback((data: HadithUserData) => {
    setFavoriteIds(data.favorites)
    setSavedItems(data.savedItems)
    setNotes(data.notes)
    setResume(data.resume)
    savedResumeRef.current = data.resume
  }, [])

  const scheduleCloudSync = useCallback(() => {
    setSyncPending(true)
    setSyncStatus(isOffline ? 'offline' : 'idle')
    setSyncRevision((value) => value + 1)
  }, [isOffline])

  const cloudStatusLabel = !authResolved ? 'جارٍ التحقق من الحساب...' : !accountUid
    ? 'حفظ محلي على هذا الجهاز'
    : syncStatus === 'synced' && !syncPending ? 'تمت المزامنة مع الحساب'
    : syncStatus === 'syncing' ? 'جارٍ مزامنة الأحاديث...'
    : syncStatus === 'offline' ? 'محفوظ محليًا — سيُعاد الاتصال لاحقًا'
    : syncStatus === 'permission-denied' ? 'المزامنة مرفوضة: راجع قواعد Firestore'
    : syncStatus === 'error' ? 'تعذرت المزامنة — البيانات محفوظة محليًا'
    : syncPending ? 'تغييرات محفوظة محليًا بانتظار المزامنة'
    : 'المزامنة جاهزة'


  useEffect(() => {
    mountedRef.current = true
    // عرض نسخة الضيف حتى يتم تحديد حالة تسجيل الدخول.
    // لن تنقل هذه البيانات تلقائيًا إلى أي حساب.
    applyPersonalData(readGuestHadithData())
    setGuestDataAvailable(hasGuestHadithData())
    const preferences = readStorage<{ appearance?: Appearance; fontSize?: number; design?: DesignStyle }>(SETTINGS_KEY, {})
    if (preferences.appearance === 'night') setAppearance('night')
    if (typeof preferences.fontSize === 'number') setFontSize(within(preferences.fontSize, 19, 38))
    if (preferences.design === 'emerald' || preferences.design === 'midnight') setDesign(preferences.design)
    const query = new URLSearchParams(window.location.search)
    const initialBook = query.get('book')
    const initialChapter = Number(query.get('chapter'))
    const initialHadith = Number(query.get('hadith'))
    if (initialBook && HADITH_BOOKS.some((b) => b.id === initialBook)) {
      initialPosition.current = query.has('chapter') && Number.isSafeInteger(initialChapter) && initialChapter >= 0
        ? { bookId: initialBook, chapterId: initialChapter, hadithId: initialHadith > 0 ? initialHadith : undefined }
        : null
      setBookId(initialBook)
      setScreen('reader')
    }
    const syncNetwork = () => setIsOffline(!navigator.onLine)
    syncNetwork()
    window.addEventListener('online', syncNetwork)
    window.addEventListener('offline', syncNetwork)
    setReady(true)
    return () => {
      mountedRef.current = false
      window.removeEventListener('online', syncNetwork)
      window.removeEventListener('offline', syncNetwork)
      bookController.current?.abort()
      chapterController.current?.abort()
      downloadController.current?.abort()
      globalController.current?.abort()
    }
  }, [applyPersonalData])

  // يفصل تمامًا بين بيانات الضيف وبيانات كل حساب Firebase.
  // لا يتم استيراد ملاحظات الضيف إلا بضغطة صريحة على زر الاستيراد.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!mountedRef.current) return
      const uid = user?.uid ?? null
      activeUidRef.current = uid
      setAuthResolved(false)
      setAccountUid(uid)
      setSyncNotice('')
      try {
        applyPersonalData(uid ? readHadithUserData(uid) : readGuestHadithData())
        setSyncStatus(uid ? 'idle' : 'guest')
        setSyncPending(Boolean(uid))
      } catch (error) {
        applyPersonalData({ favorites: [], savedItems: [], notes: {}, resume: null })
        setSyncStatus(uid ? 'error' : 'guest')
        setSyncPending(Boolean(uid))
        setSyncNotice(message(error, 'تعذر قراءة بيانات الحساب على هذا الجهاز.'))
      }
      setGuestDataAvailable(uid ? hasNewGuestDataFor(uid) : hasGuestHadithData())
      setAuthResolved(true)
      setSyncRevision((value) => value + 1)
    }, () => {
      if (!mountedRef.current) return
      activeUidRef.current = null
      setAccountUid(null)
      applyPersonalData(readGuestHadithData())
      setSyncStatus('guest')
      setAuthResolved(true)
      setSyncNotice('تعذر التحقق من حالة تسجيل الدخول؛ يتم استخدام الحفظ المحلي فقط.')
    })
    return () => unsubscribe()
  }, [applyPersonalData])

  // المزامنة عند فتح الصفحة، تعديل البيانات، أو عودة الاتصال.
  // التأخير يمنع إرسال طلب Firestore مع كل ضغطة حرف في الملاحظات.
  useEffect(() => {
    if (!authResolved || !accountUid) return
    if (isOffline) {
      setSyncStatus('offline')
      setSyncPending(true)
      return
    }
    const uid = accountUid
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (activeUidRef.current !== uid) return
      setSyncStatus('syncing')
      void synchronizeHadithUserData(uid).then((result) => {
        if (cancelled || activeUidRef.current !== uid) return
        applyPersonalData(readHadithUserData(uid))
        setSyncStatus(result.status)
        setSyncPending(result.status !== 'synced' || result.pending)
        if (result.status === 'synced' && result.pending) {
          setSyncRevision((value) => value + 1)
        }
      }).catch((error: unknown) => {
        if (cancelled || activeUidRef.current !== uid) return
        setSyncStatus('error')
        setSyncPending(true)
        setSyncNotice(message(error, 'تعذرت المزامنة؛ بياناتك محفوظة على الجهاز.'))
      })
    }, 1100)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [accountUid, authResolved, isOffline, syncRevision, applyPersonalData])

  // تحديث التبويبات المفتوحة على نفس الجهاز، بدون نقل معلومات حساب لآخر.
  useEffect(() => {
    if (!authResolved || !accountUid) return
    const uid = accountUid
    return watchHadithLocalUpdates(uid, (data) => {
      if (activeUidRef.current !== uid) return
      applyPersonalData(data)
      scheduleCloudSync()
    })
  }, [accountUid, authResolved, applyPersonalData, scheduleCloudSync])

  useEffect(() => {
    if (!ready) return
    saveStorage(SETTINGS_KEY, { appearance, fontSize, design })
  }, [appearance, fontSize, design, ready])

  useEffect(() => {
    const controller = new AbortController()
    void getHadithBooks({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      setBooks(result.books)
      setBooksSource(result.origin)
    }).catch(() => undefined)
    return () => controller.abort()
  }, [])

  const updateUrl = useCallback((nextBookId: string | null, nextChapterId?: number | null, nextHadith?: number) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.delete('book')
    url.searchParams.delete('chapter')
    url.searchParams.delete('hadith')
    if (nextBookId) url.searchParams.set('book', nextBookId)
    if (nextBookId && nextChapterId != null) url.searchParams.set('chapter', String(nextChapterId))
    if (nextHadith && nextChapterId != null) url.searchParams.set('hadith', String(nextHadith))
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])

  const stopDownload = useCallback(() => {
    downloadController.current?.abort()
    downloadController.current = null
    setDownloadState((prev) => prev?.active ? { ...prev, active: false, error: 'تم إيقاف التنزيل؛ الأبواب المحفوظة لن تُحذف.' } : prev)
  }, [])

  const chooseBook = useCallback((nextId: string, requested?: { chapterId: number; hadithId?: number }) => {
    stopDownload()
    globalController.current?.abort()
    setGlobalPhase((previous) => previous === 'running' ? 'cancelled' : previous)
    const progress = savedResumeRef.current
    initialPosition.current = requested
      ? { bookId: nextId, ...requested }
      : progress?.bookId === nextId
        ? { bookId: nextId, chapterId: progress.chapterId, hadithId: progress.hadithId }
        : null
    setBookId(nextId)
    setScreen('reader')
    setChapterId(null)
    setChapters([])
    setHadiths([])
    setLoadedChapterKey('')
    setHadithIndex(0)
    setBookError('')
    setChapterError('')
    setChapterSearch('')
    setHadithSearch('')
    setCachedCount(0)
    setFeedback('')
    setShowNotes(false)
    requestedFromEndRef.current = false
    setBookRetry((n) => n + 1)
    updateUrl(nextId)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [stopDownload, updateUrl])

  const goLibrary = useCallback(() => {
    stopDownload()
    globalController.current?.abort()
    setGlobalPhase((previous) => previous === 'running' ? 'cancelled' : previous)
    bookController.current?.abort()
    chapterController.current?.abort()
    initialPosition.current = null
    setBookId(null)
    setChapterId(null)
    setChapters([])
    setHadiths([])
    setLoadedChapterKey('')
    setScreen('library')
    updateUrl(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [stopDownload, updateUrl])

  useEffect(() => {
    if (!ready || !bookId) return
    bookController.current?.abort()
    const controller = new AbortController()
    bookController.current = controller
    setLoadingBook(true)
    setBookError('')
    setChapters([])
    setChapterId(null)
    setHadiths([])
    setLoadedChapterKey('')
    void getHadithBook(bookId, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted || !mountedRef.current) return
      const ordered = data.chapters
      setChapters(ordered)
      setBooks((prev) => prev.map((book) => book.id === bookId ? { ...book, ...data.book } : book))
      const requested = initialPosition.current
      const wantedChapter = requested?.bookId === bookId
        ? ordered.find((c) => c.id === requested.chapterId)
        : null
      const chosen = wantedChapter || ordered[0]
      setChapterId(chosen.id)
      updateUrl(bookId, chosen.id, wantedChapter ? requested?.hadithId : undefined)
      void getCachedHadithChapters(bookId).then((ids) => {
        if (!controller.signal.aborted) setCachedCount(ids.filter((id) => ordered.some((c) => c.id === id)).length)
      })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setBookError(message(error, 'تعذر تحميل أبواب الكتاب.'))
    }).finally(() => { if (!controller.signal.aborted) setLoadingBook(false) })
    return () => controller.abort()
  }, [bookId, ready, updateUrl, bookRetry])

  useEffect(() => {
    if (!ready || !bookId || chapterId === null) return
    chapterController.current?.abort()
    const controller = new AbortController()
    chapterController.current = controller
    setLoadingChapter(true)
    setChapterError('')
    setLoadedChapterKey('')
    setHadiths([])
    setHadithIndex(0)
    setHadithSearch('')
    setShowNotes(false)
    void getHadithChapter(bookId, chapterId, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted || !mountedRef.current) return
      const target = initialPosition.current
      const wanted = target?.bookId === bookId && target.chapterId === chapterId ? target.hadithId : undefined
      const nextIndex = wanted ? Math.max(0, data.hadiths.findIndex((hadith) => hadith.idInBook === wanted)) : requestedFromEndRef.current ? data.hadiths.length - 1 : 0
      requestedFromEndRef.current = false
      setHadiths(data.hadiths)
      setHadithIndex(nextIndex)
      setLoadedChapterKey(`${bookId}:${chapterId}`)
      setSectionOrigin(data.origin)
      initialPosition.current = null
      void getCachedHadithChapters(bookId).then((ids) => {
        if (!controller.signal.aborted) setCachedCount(ids.filter((id) => chapters.some((c) => c.id === id)).length)
      })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setChapterError(message(error, 'تعذر تحميل أحاديث الباب.'))
    }).finally(() => { if (!controller.signal.aborted) setLoadingChapter(false) })
    return () => controller.abort()
  }, [bookId, chapterId, ready, chapters, chapterRetry])

  useEffect(() => {
    if (!ready || !authResolved || !bookId || chapterId === null || !activeHadith) return
    const position: Resume = { bookId, chapterId, hadithId: activeHadith.idInBook, savedAt: Date.now() }
    if (accountUid) {
      try {
        const saved = saveHadithUserChanges(accountUid, { resume: position })
        savedResumeRef.current = saved.resume
        setResume(saved.resume)
        scheduleCloudSync()
      } catch (error) {
        setSyncNotice(message(error, 'تعذر حفظ موضع القراءة على الجهاز.'))
      }
    } else {
      savedResumeRef.current = position
      setResume(position)
      saveStorage(RESUME_KEY, position)
    }
    updateUrl(bookId, chapterId, activeHadith.idInBook)
  }, [bookId, chapterId, activeHadith?.idInBook, ready, authResolved, accountUid, updateUrl, scheduleCloudSync])

  const selectChapter = useCallback((id: number, fromEnd = false) => {
    if (!bookId) return
    if (id === chapterId && displayedHadiths.length) return
    initialPosition.current = { bookId, chapterId: id, hadithId: undefined }
    requestedFromEndRef.current = fromEnd
    setChapterId(id)
    setHadithIndex(fromEnd ? -1 : 0)
    setFeedback('')
    updateUrl(bookId, id)
    readerScroll.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [bookId, chapterId, displayedHadiths.length, updateUrl])

  const selectHadith = useCallback((index: number) => {
    if (index < 0 || index >= displayedHadiths.length) return
    setHadithIndex(index)
    setFeedback('')
    setShowNotes(false)
    readerScroll.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [displayedHadiths.length])

  const advance = useCallback((direction: -1 | 1) => {
    const next = hadithIndex + direction
    if (next >= 0 && next < displayedHadiths.length) { selectHadith(next); return }
    const chapterIndex = chapters.findIndex((c) => c.id === chapterId)
    const nextChapter = chapters[chapterIndex + direction]
    if (!nextChapter) return
    initialPosition.current = { bookId: bookId || '', chapterId: nextChapter.id, hadithId: undefined }
    requestedFromEndRef.current = direction === -1
    setChapterId(nextChapter.id)
    setHadithIndex(direction === -1 ? -1 : 0)
    updateUrl(bookId, nextChapter.id)
    readerScroll.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hadithIndex, displayedHadiths.length, selectHadith, chapters, chapterId, bookId, updateUrl])

  const filteredBooks = useMemo(() => {
    const q = normalizeHadithSearch(bookSearch)
    return q ? books.filter((b) => normalizeHadithSearch(`${b.name_ar} ${b.name_en || ''} ${b.author_ar || ''}`).includes(q)) : books
  }, [bookSearch, books])
  const filteredChapters = useMemo(() => {
    const q = normalizeHadithSearch(chapterSearch)
    return q ? chapters.filter((c) => normalizeHadithSearch(`${c.id} ${c.name_ar} ${c.name_en || ''}`).includes(q)) : chapters
  }, [chapters, chapterSearch])
  const matchedHadiths = useMemo(() => {
    const q = normalizeHadithSearch(hadithSearch)
    return q ? displayedHadiths.map((hadith, index) => ({ hadith, index })).filter(({ hadith }) => normalizeHadithSearch(`${hadith.idInBook} ${hadith.arabic}`).includes(q)) : []
  }, [displayedHadiths, hadithSearch])

  const toggleFavorite = useCallback(() => {
    if (!authResolved || !selectedBook || chapterId === null || !activeHadith) return
    const key = favoriteKey(selectedBook.id, activeHadith.idInBook)
    const exists = favoriteIds.includes(key)
    const nextFavorites = exists ? favoriteIds.filter((v) => v !== key) : [...favoriteIds, key]
    const nextItems: SavedItem[] = exists
      ? savedItems.filter((item) => item.key !== key)
      : [
          { key, bookId: selectedBook.id, bookTitle: selectedBook.name_ar, chapterId, number: activeHadith.idInBook, excerpt: activeHadith.arabic.slice(0, 240) },
          ...savedItems.filter((item) => item.key !== key),
        ]
    try {
      if (accountUid) {
        applyPersonalData(saveHadithUserChanges(accountUid, {
          favorites: nextFavorites,
          savedItems: nextItems,
        }))
        scheduleCloudSync()
      } else {
        setFavoriteIds(nextFavorites)
        setSavedItems(nextItems)
        saveStorage(FAV_KEY, nextFavorites)
        saveStorage(SAVED_KEY, nextItems)
        setGuestDataAvailable(true)
      }
      setFeedback(exists ? 'أزيل الحديث من المفضلة.' : 'تم حفظ الحديث في المفضلة.')
    } catch (error) {
      setFeedback(message(error, 'تعذر حفظ التعديل على الجهاز.'))
    }
  }, [authResolved, accountUid, selectedBook, chapterId, activeHadith, favoriteIds, savedItems, applyPersonalData, scheduleCloudSync])

  const copyHadith = useCallback(async () => {
    if (!selectedBook || !activeHadith) return
    const text = hadithShareText(selectedBook, activeHadith)
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
      else {
        const field = document.createElement('textarea')
        field.value = text
        field.style.position = 'fixed'
        field.style.opacity = '0'
        document.body.appendChild(field)
        field.select()
        const ok = document.execCommand('copy')
        field.remove()
        if (!ok) throw new Error('تعذّر النسخ.')
      }
      setFeedback('تم نسخ الحديث مع اسم الكتاب ورقمه.')
    } catch { setFeedback('تعذّر النسخ، حاول مجددًا.') }
  }, [selectedBook, activeHadith])

  const shareHadith = useCallback(async () => {
    if (!selectedBook || !activeHadith) return
    if (!navigator.share) { await copyHadith(); return }
    try {
      await navigator.share({ title: selectedBook.name_ar, text: hadithShareText(selectedBook, activeHadith) })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFeedback('تعذّرت المشاركة؛ يمكنك نسخ النص بدلًا منها.')
    }
  }, [selectedBook, activeHadith, copyHadith])

  const refreshCurrent = useCallback(() => {
    if (!bookId) return
    chooseBook(bookId, chapterId === null ? undefined : { chapterId, hadithId: activeHadith?.idInBook })
  }, [bookId, chapterId, activeHadith?.idInBook, chooseBook])

  const downloadWholeBook = useCallback(async () => {
    if (!bookId || !chapters.length || downloadController.current) return
    const controller = new AbortController()
    downloadController.current = controller
    const total = chapters.length
    setDownloadState({ bookId, done: 0, total, active: true, error: '', complete: false })
    try {
      const saved = new Set(await getCachedHadithChapters(bookId))
      let done = chapters.filter((c) => saved.has(c.id)).length
      setDownloadState({ bookId, done, total, active: true, error: '', complete: false })
      for (const chapter of chapters) {
        if (controller.signal.aborted) throw new Error('تم إيقاف التنزيل.')
        if (saved.has(chapter.id)) continue
        await getHadithChapter(bookId, chapter.id, { signal: controller.signal })
        if (controller.signal.aborted) throw new Error('تم إيقاف التنزيل.')
        const verified = await getCachedHadithChapters(bookId)
        if (!verified.includes(chapter.id)) throw new Error('المتصفح لم يحفظ أحد الأبواب؛ راجع مساحة تخزين الجهاز.')
        saved.add(chapter.id)
        done++
        if (mountedRef.current) {
          setCachedCount(done)
          setDownloadState({ bookId, done, total, active: true, error: '', complete: false })
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 750))
      }
      const final = await getCachedHadithChapters(bookId)
      const complete = chapters.every((chapter) => final.includes(chapter.id))
      if (mountedRef.current) {
        setCachedCount(chapters.filter((c) => final.includes(c.id)).length)
        setDownloadState({ bookId, done: chapters.filter((c) => final.includes(c.id)).length, total, active: false, complete, error: complete ? '' : 'لم تكتمل كل الأبواب في ذاكرة التخزين.' })
      }
    } catch (error) {
      if (mountedRef.current && !controller.signal.aborted) {
        const count = (await getCachedHadithChapters(bookId)).filter((id) => chapters.some((c) => c.id === id)).length
        setCachedCount(count)
        setDownloadState({ bookId, done: count, total, active: false, complete: false, error: message(error, 'تعذر إكمال تنزيل الكتاب؛ الأبواب المحفوظة باقية.') })
      }
    } finally { if (downloadController.current === controller) downloadController.current = null }
  }, [bookId, chapters])

  const stopGlobalSearch = useCallback(() => {
    globalSession.current++
    globalController.current?.abort()
    globalController.current = null
    setGlobalPhase((previous) => previous === 'running' ? 'cancelled' : previous)
  }, [])

  const beginGlobalSearch = useCallback((event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const search = normalizeGlobalQuery(globalText)
    if (!search) { setGlobalError('اكتب كلمة من الحديث أو رقمه أولًا.'); return }
    globalController.current?.abort()
    const controller = new AbortController()
    globalController.current = controller
    const session = ++globalSession.current
    setGlobalError('')
    setLastGlobalQuery(globalText.trim())
    setGlobalHits([])
    setGlobalProgress({ ...EMPTY_GLOBAL_PROGRESS })
    setGlobalPhase('running')
    void searchCachedHadithCorpus(
      search, globalBook, controller.signal,
      (progress, hits) => {
        if (!controller.signal.aborted && globalSession.current === session && mountedRef.current) {
          setGlobalProgress(progress)
          setGlobalHits([...hits])
        }
      },
    ).then(({ hits, progress }) => {
      if (!controller.signal.aborted && globalSession.current === session && mountedRef.current) {
        setGlobalHits(hits)
        setGlobalProgress(progress)
        setGlobalPhase('complete')
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted || globalSession.current !== session || !mountedRef.current) return
      setGlobalPhase('error')
      setGlobalError(message(error, 'تعذر البحث في الكتب المحفوظة.'))
    }).finally(() => {
      if (globalController.current === controller) globalController.current = null
    })
  }, [globalText, globalBook])

  const copyVerificationPhrase = useCallback(async () => {
    if (!verificationPhrase) return
    try {
      await navigator.clipboard.writeText(verificationPhrase)
      setFeedback('تم نسخ عبارة من نص الحديث للبحث في الموسوعة. يجب مطابقة النتيجة مع النص والمصدر.')
    } catch {
      try {
        window.prompt('انسخ عبارة البحث التالية:', verificationPhrase)
      } catch { /* The browser may block prompts. */ }
    }
  }, [verificationPhrase])

  const copyReferenceDetails = useCallback(async () => {
    if (!selectedBook || !activeHadith) return
    const reference = hadithBibliographicReference(selectedBook, currentChapter, activeHadith)
    try {
      await navigator.clipboard.writeText(reference)
      setFeedback('تم نسخ بيانات الكتاب والباب ورقم الحديث والمصدر الرقمي.')
    } catch {
      try {
        window.prompt('انسخ معلومات المصدر:', reference)
      } catch { /* The browser may block prompts. */ }
    }
  }, [selectedBook, currentChapter, activeHadith])

  // Return to the hadith text when advancing; never leave the previous
  // explanation visible over a different hadith.
  useEffect(() => {
    setShowReferences(false)
    setShowExplanation(false)
    setExplanationResult(null)
    setExplanationLoading(false)
  }, [bookId, chapterId, activeHadith?.idInBook, activeHadith?.arabic])

  // Fetch only when the visitor opens the explanation panel. The curated
  // explanation layer validates the book, chapter, hadith number and text anchor.
  useEffect(() => {
    if (!showExplanation || !bookId || chapterId === null || !activeHadith) return

    const controller = new AbortController()
    const record = {
      idInBook: activeHadith.idInBook,
      chapterId: activeHadith.chapterId,
      arabic: activeHadith.arabic,
    }

    setExplanationLoading(true)
    setExplanationResult(null)

    void getHadithExplanation(bookId, record, {
      signal: controller.signal,
      refresh: explanationRetry > 0,
    }).then((result) => {
      if (!controller.signal.aborted) setExplanationResult(result)
    }).catch(() => {
      if (!controller.signal.aborted) {
        setExplanationResult({
          status: 'source-unavailable',
          explanation: null,
          origin: 'none',
          message: 'تعذر فتح الشروح الآن. نص الحديث الأصلي متاح دون تغيير.',
          researchUrl: 'https://dorar.net/hadith',
        })
      }
    }).finally(() => {
      if (!controller.signal.aborted) setExplanationLoading(false)
    })

    return () => controller.abort()
  }, [showExplanation, bookId, chapterId, activeHadith?.idInBook, activeHadith?.chapterId, activeHadith?.arabic, explanationRetry])

  const copyExplanationCitation = useCallback(async () => {
    const entry = explanationResult?.explanation
    if (!entry || !selectedBook) return
    const citation = [
      `شرح الحديث: ${entry.title}`,
      `الحديث: ${selectedBook.name_ar}، رقم ${entry.hadithNumber}`,
      `مرجع الشرح: ${entry.source.title}`,
      entry.source.author ? `المؤلف: ${entry.source.author}` : '',
      `موضع النص: ${entry.source.reference}`,
      entry.source.url,
      'مصحف سميع — مادة محررة مع الرجوع إلى مرجع الشرح عند الاستشهاد.',
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(citation)
      setFeedback('تم نسخ مرجع الشرح وموضعه.')
    } catch {
      try { window.prompt('انسخ المرجع:', citation) } catch { /* blocked */ }
    }
  }, [explanationResult, selectedBook])

  const activeNote = activeKey ? notes[activeKey] || '' : ''
  const updateNote = (value: string) => {
    if (!activeKey || !authResolved) return
    if (value.length > 1400) {
      setFeedback('الحد الأقصى للملاحظة ١٤٠٠ حرف.')
      return
    }
    const updated = { ...notes }
    if (value.trim()) updated[activeKey] = value
    else delete updated[activeKey]
    try {
      if (accountUid) {
        applyPersonalData(saveHadithUserChanges(accountUid, { notes: updated }))
        scheduleCloudSync()
      } else {
        setNotes(updated)
        saveStorage(NOTES_KEY, updated)
        setGuestDataAvailable(true)
      }
    } catch (error) {
      setFeedback(message(error, 'تعذر حفظ الملاحظة على الجهاز.'))
    }
  }

  const importGuestToAccount = () => {
    if (!accountUid || !authResolved || activeUidRef.current !== accountUid) return
    const confirmed = window.confirm('هل تريد إضافة مفضلة وملاحظات هذا الجهاز إلى حسابك؟ ستبقى نسخة الضيف على الجهاز ولن تُحذف. لا تُجرِ الاستيراد إن كانت البيانات تخص مستخدمًا آخر.')
    if (!confirmed) return
    try {
      const merged = importLegacyHadithData(accountUid)
      applyPersonalData(merged)
      try {
        localStorage.setItem(`${GUEST_IMPORT_MARKER}${accountUid}`, guestDataFingerprint())
      } catch { /* Local storage may be restricted. */ }
      setGuestDataAvailable(false)
      setSyncNotice('تم استيراد بيانات الجهاز إلى حسابك وحفظها محليًا. ستُزامن عند توفر الاتصال.')
      scheduleCloudSync()
    } catch (error) {
      setSyncNotice(message(error, 'تعذّر استيراد بيانات الجهاز.'))
    }
  }

  const openSaved = (item: SavedItem) => chooseBook(item.bookId, { chapterId: item.chapterId, hadithId: item.number })
  const resumeBook = resume && books.find((b) => b.id === resume.bookId)

  return (
    <div dir="rtl" className={`min-h-screen pb-32 ${baseColor}`}>
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${bg ? 'border-white/10 bg-[#101e22]/95' : 'border-[#cbb078]/25 bg-[#f7f3e9]/95'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="الرئيسية" className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${surface}`}><ArrowRight size={20} /></Link>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-2 text-[#ae8a4a]"><BookOpen size={20} /><span className={`truncate text-lg font-black ${bg ? 'text-[#f6ecd2]' : 'text-[#23484a]'}`}>المكتبة الحديثية</span></div>
            <p className={`mt-0.5 text-[11px] ${quiet}`}>مصحف سميع · قراءة وتدبّر</p>
          </div>
          <button aria-label={bg ? 'الوضع الفاتح' : 'الوضع الليلي'} onClick={() => setAppearance(bg ? 'cream' : 'night')} className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${surface}`}>{bg ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className={`mb-5 rounded-2xl border p-4 ${surface}`} aria-label="حالة مزامنة الأحاديث">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">{accountUid ? 'مكتبتك الخاصة' : 'حفظ الأحاديث على الجهاز'}</p>
              <p role="status" className={`mt-1 text-xs leading-6 ${quiet}`}>{cloudStatusLabel}</p>
              {accountUid && <p className={`mt-1 text-[11px] ${quiet}`}>المفضلة والملاحظات وموضع القراءة لكل حساب على حدة.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {accountUid && (
                <button type="button" onClick={() => setSyncRevision((value) => value + 1)} disabled={!authResolved || syncStatus === 'syncing' || isOffline} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold disabled:opacity-45 ${surface}`}>
                  <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} /> مزامنة الآن
                </button>
              )}
              {!accountUid && <Link href="/auth" className="inline-flex items-center rounded-xl bg-[#1b5b60] px-4 py-2.5 text-xs font-bold text-white">تسجيل الدخول للمزامنة</Link>}
              {accountUid && guestDataAvailable && (
                <button type="button" onClick={importGuestToAccount} className="rounded-xl border border-[#b6965b]/50 px-3 py-2.5 text-xs font-bold text-[#b18b50]">استيراد مفضلة الجهاز إلى حسابي</button>
              )}
            </div>
          </div>
          {syncNotice && <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-6 ${softSurface}`}>{syncNotice}</p>}
        </section>
        {screen !== 'reader' && (
          <>
            <section className="relative overflow-hidden rounded-[30px] border border-[#af9255]/35 bg-gradient-to-br from-[#20616a] via-[#17464b] to-[#0b3034] p-6 text-white shadow-xl sm:p-9">
              <div className="pointer-events-none absolute -left-14 -top-20 h-72 w-72 rounded-full bg-[#d6af6c]/10 blur-3xl" />
              <div className="relative z-10">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#e4cb95]"><Library size={17} /> مكتبة السُّنة النبوية</div>
                <h1 className="font-serif text-3xl font-bold leading-relaxed sm:text-4xl">بين يديك كنوز الحديث النبوي</h1>
                <p className="mt-2 max-w-2xl text-sm leading-8 text-white/75">كتب الحديث وأبوابها ونصوصها الأصلية، في تجربة قراءة هادئة مع المفضلة واستكمال القراءة وحفظ الأبواب دون اتصال.</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">{digit(HADITH_BOOKS.length)} كتابًا في الفهرس</span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">بدون مشغّل صوتي</span>
                  {isOffline && <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-500/15 px-4 py-2"><WifiOff size={14} /> وضع عدم الاتصال</span>}
                </div>
              </div>
            </section>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => { stopGlobalSearch(); setScreen('library') }} className={`rounded-2xl px-5 py-3 text-sm font-black transition ${screen === 'library' ? 'bg-[#1b5a60] text-white' : `${surface} border`}`}><Library size={17} className="ml-2 inline" />كل الكتب</button>
              <button onClick={() => { stopGlobalSearch(); setScreen('favorites') }} className={`rounded-2xl px-5 py-3 text-sm font-black transition ${screen === 'favorites' ? 'bg-[#1b5a60] text-white' : `${surface} border`}`}><Heart size={17} className="ml-2 inline" />المفضلة ({digit(favoriteIds.length)})</button>
              <button onClick={() => setScreen('search')} className={`rounded-2xl px-5 py-3 text-sm font-black transition ${screen === 'search' ? 'bg-[#1b5a60] text-white' : `${surface} border`}`}><Search size={17} className="ml-2 inline" />البحث الشامل</button>
            </div>
          </>
        )}

        {screen === 'library' && (
          <div className="mt-6 space-y-7">
            {resumeBook && resume && <button onClick={() => chooseBook(resume.bookId, { chapterId: resume.chapterId, hadithId: resume.hadithId })} className={`flex w-full items-center gap-4 rounded-3xl border p-5 text-right shadow-sm transition hover:border-[#b99a5c] ${surface}`}>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#af8b50] ${softSurface}`}><Bookmark size={23} /></span>
              <span className="min-w-0 flex-1"><span className={`block text-[11px] ${quiet}`}>متابعة من آخر موضع</span><strong className="mt-1 block truncate text-base">{resumeBook.name_ar}</strong><span className={`mt-1 block text-xs ${quiet}`}>الحديث {digit(resume.hadithId)}</span></span>
              <ChevronLeft size={19} className="text-[#bb9959]" />
            </button>}
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-4 ${surface}`}><Search size={20} className="text-[#b18e51]" /><input aria-label="البحث عن كتاب" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="ابحث عن اسم كتاب أو مؤلف..." value={bookSearch} onChange={(e: ChangeEvent<HTMLInputElement>) => setBookSearch(e.target.value)} />{bookSearch && <button aria-label="مسح البحث" onClick={() => setBookSearch('')}><X size={18} /></button>}</div>
            <button onClick={() => setScreen('search')} className={`flex w-full items-center justify-between rounded-2xl border border-[#b99a5c]/40 bg-[#b99a5c]/10 px-5 py-4 text-right text-sm font-bold ${bg ? 'text-[#ecd8ae]' : 'text-[#48625c]'}`}><span className="flex items-center gap-3"><Search className="text-[#b18e51]" size={20} />ابحث داخل أحاديث جميع الكتب المحفوظة على جهازك</span><ChevronLeft size={18} /></button>
            {booksSource === 'catalogue' && <p className={`text-xs ${quiet}`}>تظهر أسماء الكتب من الفهرس، وقد تتطلب بعض الأبواب اتصالًا عند فتحها لأول مرة.</p>}
            {CATEGORIES.map((category) => {
              const group = filteredBooks.filter((b) => b.category === category)
              if (!group.length) return null
              return <section key={category}>
                <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">{category}</h2><span className={`text-xs ${quiet}`}>{digit(group.length)} كتب</span></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((book) => <button key={book.id} onClick={() => chooseBook(book.id)} className={`group flex min-h-[126px] items-center gap-3 rounded-[24px] border p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-[#b99a5c] hover:shadow-lg ${surface}`}>
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#bc9b60]/20 text-[#bd9859] ${softSurface}`}><BookMarked size={28} /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-base font-black leading-7">{book.name_ar}</strong>{book.author_ar && <span className={`mt-1 block truncate text-xs ${quiet}`}>{book.author_ar}</span>}{book.hadithCount != null && <span className={`mt-1 block text-xs ${quiet}`}>{digit(book.hadithCount)} حديث</span>}<span className="mt-2 block text-xs font-bold text-[#b48c4b]">قراءة الكتاب <ArrowLeft size={14} className="inline" /></span></span>
                  </button>)}
                </div>
              </section>
            })}
            {!filteredBooks.length && <div className={`rounded-3xl border p-8 text-center ${surface}`}>لا توجد كتب تطابق البحث.</div>}
            <p className={`text-center text-xs leading-6 ${quiet}`}>التسجيلات البشرية للكتب قد تكون متاحة بشكل مستقل في المكتبة الصوتية. لا يوجد تشغيل صوت داخل قسم الحديث.</p>
          </div>
        )}

        {screen === 'search' && (
          <section className={`mt-6 overflow-hidden rounded-[28px] border p-5 shadow-sm sm:p-7 ${surface}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#b99452] ${softSurface}`}><Search size={23} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black">بحث شامل في الأحاديث المحفوظة</h2>
                <p className={`mt-2 text-xs leading-7 ${quiet}`}>ابحث في جميع الكتب التي نزّلت أبوابها سابقًا. لا يحتاج البحث إلى الإنترنت، ولا يجلب أحاديث من الشبكة. دعم البحث بالتشكيل وبدونه، وبالراوي ضمن نص الحديث، وبرقم الحديث داخل كتابه.</p>
              </div>
            </div>
            <form onSubmit={beginGlobalSearch} className="mt-6 space-y-3">
              <label htmlFor="hadith-global-search" className="block text-sm font-bold">كلمة أو عبارة أو رقم حديث</label>
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${softSurface} ${bg ? 'border-white/10' : 'border-[#d2be94]/35'}`}>
                <Search size={20} className="shrink-0 text-[#b48e50]" />
                <input id="hadith-global-search" type="search" autoComplete="off" value={globalText} onChange={(event: ChangeEvent<HTMLInputElement>) => setGlobalText(event.target.value)} placeholder="مثال: إنما الأعمال بالنيات" className="w-full min-w-0 bg-transparent text-sm leading-7 outline-none" />
                {!!globalText && <button type="button" aria-label="مسح العبارة" onClick={() => { setGlobalText(''); setGlobalError('') }}><X size={17} /></button>}
              </div>
              <label htmlFor="hadith-global-book" className="block text-sm font-bold">نطاق البحث</label>
              <select id="hadith-global-book" value={globalBook} onChange={(event: ChangeEvent<HTMLSelectElement>) => setGlobalBook(event.target.value)} className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${bg ? 'border-white/10 bg-[#20383a]' : 'border-[#d2be94]/35 bg-[#fbf9f3]'}`}>
                <option value="">جميع الكتب المحفوظة</option>
                {books.map((book) => <option key={book.id} value={book.id}>{book.name_ar}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={globalPhase === 'running'} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1b5b60] px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">{globalPhase === 'running' ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}{globalPhase === 'running' ? 'جارٍ فحص المحفوظ...' : 'ابحث في الأحاديث'}</button>
                {globalPhase === 'running' && <button type="button" onClick={stopGlobalSearch} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${surface}`}>إيقاف</button>}
              </div>
            </form>
            {globalError && <p role="alert" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-300/10 p-4 text-xs leading-7 text-amber-600">{globalError}</p>}
            {globalPhase !== 'idle' && <div className={`mt-5 rounded-2xl p-4 ${softSurface}`} role="status" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
                <span>{globalPhase === 'running' ? 'جارٍ الفحص المحلي' : globalPhase === 'complete' ? 'اكتمل البحث' : globalPhase === 'cancelled' ? 'أُوقف البحث' : 'تعذر إكمال البحث'}</span>
                <span>{digit(globalProgress.checked)} / {digit(globalProgress.total)} باب</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#b99a5c]/20"><div className="h-full rounded-full bg-[#b99a5c] transition-all" style={{ width: `${globalProgress.total ? within(globalProgress.checked / globalProgress.total * 100, 0, 100) : 0}%` }} /></div>
              <p className={`mt-3 text-xs leading-6 ${quiet}`}>مطابقات: {digit(globalProgress.matches)} · أبواب تعذّر قراءتها: {digit(globalProgress.skipped)}{globalProgress.matches > GLOBAL_SEARCH_LIMIT ? ` · تُعرض أول ${digit(GLOBAL_SEARCH_LIMIT)} نتيجة` : ''}</p>
            </div>}
            {globalHits.length > 0 && <div className="mt-6 space-y-3">
              <h3 className="font-black">نتائج {lastGlobalQuery ? `«${lastGlobalQuery}»` : 'البحث'}</h3>
              {globalHits.map((hit) => {
                const foundBook = books.find((b) => b.id === hit.bookId) || HADITH_BOOKS.find((b) => b.id === hit.bookId)
                return <button key={hit.key} onClick={() => chooseBook(hit.bookId, { chapterId: hit.chapterId, hadithId: hit.idInBook })} className={`block w-full rounded-2xl border p-4 text-right transition hover:border-[#b99557] ${bg ? 'border-white/10 bg-white/5' : 'border-[#d6c2a1]/35 bg-[#fcfaf5]'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{foundBook?.name_ar || hit.bookId}</strong><span className="text-xs font-bold text-[#b18f50]">الحديث {digit(hit.idInBook)}</span></div>
                  <p className={`mt-1 text-[11px] ${quiet}`}>الباب {digit(hit.chapterId)}</p>
                  <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-8 ${quiet}`}>{markedGlobalExcerpt(hit.excerpt, lastGlobalQuery)}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#ae8951]">فتح الحديث <ChevronLeft size={14} /></span>
                </button>
              })}
            </div>}
            {globalPhase === 'complete' && globalProgress.total === 0 && <div className={`mt-5 rounded-2xl p-5 text-sm leading-8 ${softSurface}`}>لا توجد أبواب محفوظة ضمن نطاق البحث. افتح الكتاب أثناء الاتصال واضغط «تنزيل الأبواب» أولًا، ثم أعد البحث.</div>}
            {globalPhase === 'complete' && globalProgress.total > 0 && !globalHits.length && <div className={`mt-5 rounded-2xl p-5 text-sm leading-8 ${softSurface}`}>{globalProgress.skipped === globalProgress.total ? 'لم يمكن قراءة أي باب محفوظ؛ افتح أحد الكتب واتركه يُعيد حفظ الأبواب.' : 'لم يظهر حديث مطابق في الأبواب التي أمكن فحصها. جرّب كلمة أقل أو اختر نطاقًا أوسع.'}</div>}
            <p className={`mt-5 text-xs leading-7 ${quiet}`}>أسماء الكتب المعروضة في القائمة لا تعني أنها محفوظة. النتائج تغطي الأبواب الموجودة بالفعل في تخزين المتصفح فقط. إذا حذف الجهاز التخزين المحلي، يلزم تنزيل الأبواب مجددًا.</p>
          </section>
        )}

        {screen === 'favorites' && (
          <section className={`mt-6 rounded-3xl border p-5 sm:p-7 ${surface}`}>
            <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">الأحاديث المحفوظة</h2><span className={`text-xs ${quiet}`}>{digit(favoriteIds.length)} محفوظًا</span></div>
            {!favoriteIds.length ? <p className={`py-10 text-center text-sm ${quiet}`}>لم تحفظ أي حديث بعد. افتح حديثًا واضغط علامة المفضلة.</p> : (
              <div className="space-y-3">
                {savedItems.filter((item) => favoriteIds.includes(item.key)).map((item) => <button key={item.key} onClick={() => openSaved(item)} className={`w-full rounded-2xl border p-4 text-right ${bg ? 'border-white/10 bg-white/5' : 'border-[#d2bf9c]/30 bg-[#fbf9f3]'}`}>
                  <strong className="block text-sm">{item.bookTitle} — حديث {digit(item.number)}</strong>
                  <p className={`mt-2 line-clamp-2 text-sm leading-7 ${quiet}`}>{item.excerpt}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#b18b50]">فتح الحديث <ChevronLeft size={14} /></span>
                </button>)}
                {savedItems.filter((item) => favoriteIds.includes(item.key)).length < favoriteIds.length && <p className={`rounded-2xl p-3 text-xs leading-6 ${softSurface}`}>بعض مفضلات النسخة القديمة محفوظة برقم الحديث فقط؛ ستظهر تفاصيلها بعد فتحها مرة أخرى وحفظها من جديد.</p>}
              </div>
            )}
          </section>
        )}

        {screen === 'reader' && selectedBook && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button onClick={goLibrary} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${surface}`}><ArrowRight size={17} /> كل الكتب</button>
              <button onClick={refreshCurrent} disabled={loadingBook || loadingChapter} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold disabled:opacity-50 ${surface}`}><RefreshCw size={15} /> إعادة الفتح</button>
              {isOffline && <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#9d733a]/15 px-3 py-2 text-xs text-[#bd9b61]"><WifiOff size={15} /> دون اتصال</span>}
            </div>

            <section className={`rounded-[28px] border p-5 shadow-sm sm:p-7 ${surface}`}>
              <div className="flex items-start gap-3"><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[#b58e4f] ${softSurface}`}><BookOpen size={28} /></span><div className="flex-1"><p className={`text-xs ${quiet}`}>مكتبة الأحاديث النبوية</p><h1 className="mt-1 text-2xl font-black leading-snug">{selectedBook.name_ar}</h1><p className={`mt-2 text-xs ${quiet}`}>{chapters.length ? `${digit(chapters.length)} بابًا` : 'فهرس الأبواب'}{selectedBook.hadithCount ? ` · ${digit(selectedBook.hadithCount)} حديثًا` : ''}</p></div></div>
              {selectedBook.introduction && <details className={`mt-5 rounded-2xl p-4 text-sm ${softSurface}`}><summary className="cursor-pointer font-bold">مقدمة الكتاب</summary><p className="mt-3 whitespace-pre-line leading-8">{selectedBook.introduction}</p></details>}
              <div className={`mt-5 rounded-2xl p-4 ${softSurface}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-black">حفظ الكتاب دون إنترنت</h2><p className={`mt-1 text-xs ${quiet}`}>{digit(cachedCount)} من {digit(chapters.length)} باب محفوظ</p></div><div className="flex flex-wrap gap-2">
                  {downloadState?.active && downloadState.bookId === bookId ? <button onClick={stopDownload} className="rounded-xl border border-[#b28f58]/50 px-4 py-2.5 text-xs font-bold">إيقاف</button> : <button onClick={() => void downloadWholeBook()} disabled={!chapters.length || isOffline || cachedCount === chapters.length} className="inline-flex items-center gap-2 rounded-xl bg-[#1b5b60] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Download size={16} />{cachedCount === chapters.length && chapters.length ? 'مكتمل' : 'تنزيل الأبواب'}</button>}
                </div></div>
                {chapters.length > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#bca477]/20"><div className="h-full rounded-full bg-[#b5955b] transition-all" style={{ width: `${within((cachedCount / chapters.length) * 100, 0, 100)}%` }} /></div>}
                {downloadState?.bookId === bookId && <p className={`mt-2 text-xs ${downloadState.error ? 'text-amber-600' : quiet}`}>{downloadState.active ? `جارٍ الحفظ: ${digit(downloadState.done)} من ${digit(downloadState.total)}` : downloadState.complete ? 'اكتمل حفظ جميع أبواب الكتاب في ذاكرة المتصفح.' : downloadState.error || 'التنزيل متوقف.'}</p>}
                <p className={`mt-2 text-[11px] leading-6 ${quiet}`}>التنزيل إلى تخزين التطبيق، وليس ملفًا في مجلد التنزيلات. قد يحذف المتصفح النسخ المحفوظة عند نقص المساحة.</p>
              </div>
            </section>

            {bookError && <section className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-100/10 p-5 text-sm leading-7 text-amber-600">{bookError}<div className="mt-3"><button onClick={refreshCurrent} className="rounded-xl border border-amber-400/40 px-4 py-2">إعادة المحاولة</button></div></section>}
            {loadingBook && <div className={`mt-4 flex items-center gap-3 rounded-2xl border p-5 ${surface}`}><Loader2 size={19} className="animate-spin text-[#b3925b]" /> جارٍ فتح فهرس الكتاب...</div>}

            {chapters.length > 0 && <div className="mt-5 grid items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
              <aside className={`rounded-3xl border p-4 shadow-sm lg:sticky lg:top-24 ${surface}`}>
                <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><List size={19} className="text-[#b18b50]" /><h2 className="font-black">فهرس الأبواب</h2></div><button onClick={() => setShowChapters((v) => !v)} className={`rounded-xl p-2 ${softSurface}`} aria-label={showChapters ? 'إخفاء الأبواب' : 'عرض الأبواب'}><Menu size={18} /></button></div>
                {showChapters && <><div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 ${softSurface}`}><Search size={16} className="text-[#aa8850]" /><input aria-label="البحث في أسماء الأبواب" value={chapterSearch} onChange={(e: ChangeEvent<HTMLInputElement>) => setChapterSearch(e.target.value)} placeholder="ابحث في الأبواب..." className="w-full min-w-0 bg-transparent text-xs outline-none" /></div><div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto lg:max-h-[60vh]">
                  {filteredChapters.map((chapter) => <button key={chapter.id} onClick={() => selectChapter(chapter.id)} className={`w-full rounded-xl px-3 py-3 text-right text-xs font-bold leading-6 transition ${chapterId === chapter.id ? 'bg-[#1a5c60] text-white' : bg ? 'hover:bg-white/5' : 'hover:bg-[#f6f0e2]'}`}><span className="block">{chapter.name_ar}</span><span className={`mt-1 block text-[10px] ${chapterId === chapter.id ? 'text-white/70' : quiet}`}>باب {digit(chapter.id)}{chapter.hadithCount ? ` · ${digit(chapter.hadithCount)} حديث` : ''}</span></button>)}
                  {!filteredChapters.length && <p className={`py-4 text-center text-xs ${quiet}`}>لا توجد أبواب مطابقة.</p>}
                </div></>}
              </aside>

              <div className="min-w-0 space-y-4" ref={readerScroll}>
                <section className={`rounded-3xl border p-4 sm:p-5 ${surface}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className={`text-[11px] ${quiet}`}>الباب الحالي</p><h3 className="mt-1 text-lg font-black leading-8">{currentChapter?.name_ar || '—'}</h3></div><div className={`rounded-xl px-3 py-2 text-xs font-bold ${softSurface}`}>{displayedHadiths.length ? `حديث ${digit(hadithIndex + 1)} من ${digit(displayedHadiths.length)}` : '—'}</div></div>
                  <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-3 ${softSurface}`}><Search size={17} className="text-[#b48e50]" /><input aria-label="البحث داخل الباب" value={hadithSearch} onChange={(e: ChangeEvent<HTMLInputElement>) => setHadithSearch(e.target.value)} placeholder="ابحث في أحاديث هذا الباب..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{hadithSearch && <button aria-label="مسح البحث" onClick={() => setHadithSearch('')}><X size={17} /></button>}</div>
                  {hadithSearch && <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">{matchedHadiths.map(({ hadith, index }) => <button key={hadith.idInBook} onClick={() => { selectHadith(index); setHadithSearch('') }} className={`block w-full rounded-lg px-3 py-2 text-right text-xs ${softSurface}`}><strong>الحديث {digit(hadith.idInBook)}</strong><span className={`mt-1 block truncate ${quiet}`}>{hadith.arabic}</span></button>)}{!matchedHadiths.length && <p className={`py-3 text-center text-xs ${quiet}`}>لا يوجد حديث مطابق داخل هذا الباب.</p>}</div>}
                </section>

                {loadingChapter && <section className={`flex min-h-44 items-center justify-center gap-3 rounded-3xl border p-8 ${surface}`}><Loader2 className="animate-spin text-[#b18f53]" size={22} /><span className="text-sm">جارٍ فتح الباب...</span></section>}
                {chapterError && !loadingChapter && <section className="rounded-3xl border border-amber-400/40 bg-amber-100/10 p-5 text-sm leading-7 text-amber-600"><p>{chapterError}</p><p className="mt-2 text-xs">تُفتح الأبواب المحفوظة فقط عند انقطاع الاتصال.</p><button onClick={() => setChapterRetry((n) => n + 1)} className="mt-3 rounded-xl border border-amber-400/40 px-4 py-2">إعادة المحاولة</button></section>}

                {activeHadith && !loadingChapter && <>
                  <article
                    className={`overflow-hidden rounded-[28px] border shadow-sm ${surface}`}
                    onTouchStart={(event: TouchEvent<HTMLElement>) => {
                      const point = event.touches[0]
                      if (point) touchStart.current = { x: point.clientX, y: point.clientY }
                    }}
                    onTouchEnd={(event: TouchEvent<HTMLElement>) => {
                      const point = event.changedTouches[0]
                      const start = touchStart.current
                      touchStart.current = null
                      if (!point || !start || hadithSearch) return
                      const dx = point.clientX - start.x
                      const dy = point.clientY - start.y
                      if (Math.abs(dx) > 95 && Math.abs(dy) < 65) advance(dx < 0 ? 1 : -1)
                    }}
                    onTouchCancel={() => { touchStart.current = null }}
                  >
                    <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${bg ? 'border-white/10 bg-[#20383a]' : 'border-[#cbb078]/20 bg-[#f9f4e9]'}`}>
                      <div><p className={`text-[11px] ${quiet}`}>حديث نبوي · نص المصدر كما ورد</p><h2 className="mt-1 text-lg font-black text-[#b39359]">الحديث رقم {digit(activeHadith.idInBook)}</h2></div>
                      <button title={activeIsFavorite ? 'إزالة المفضلة' : 'حفظ بالمفضلة'} aria-label={activeIsFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} onClick={toggleFavorite} disabled={!authResolved} className={`flex h-11 w-11 items-center justify-center rounded-xl border ${bg ? 'border-white/10' : 'border-[#c9ad71]/25 bg-white'}`}><Heart size={21} className="text-[#b39359]" fill={activeIsFavorite ? 'currentColor' : 'none'} /></button>
                    </div>
                    <div className="px-5 py-7 sm:px-9 sm:py-10">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className={`text-xs ${quiet}`}>{sectionOrigin === 'cache' ? 'نص محفوظ على الجهاز' : 'نص مكتبة الحديث'}</span><div className="flex items-center gap-2"><Type size={16} className={quiet} /><button aria-label="تصغير الخط" onClick={() => setFontSize((n) => within(n - 2, 19, 38))} className={`flex h-9 w-9 items-center justify-center rounded-lg ${softSurface}`}>−</button><span className={`text-xs ${quiet}`}>{digit(fontSize)}</span><button aria-label="تكبير الخط" onClick={() => setFontSize((n) => within(n + 2, 19, 38))} className={`flex h-9 w-9 items-center justify-center rounded-lg ${softSurface}`}>+</button></div></div>
                      <p dir="rtl" lang="ar" className="whitespace-pre-line break-words font-serif font-medium leading-[2.15] selection:bg-[#cbaa6e]/35" style={{ fontSize: `${fontSize}px`, overflowWrap: 'anywhere' }}>{activeHadith.arabic}</p>
                      <div className={`mt-8 border-t pt-5 ${bg ? 'border-white/10' : 'border-[#bfa267]/20'}`}>
                        <button
                          type="button"
                          aria-expanded={showReferences}
                          aria-controls="hadith-scholarly-reference"
                          onClick={() => setShowReferences((value) => !value)}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-right transition ${bg ? 'border-white/10 bg-[#20373a]' : 'border-[#c2a66e]/25 bg-[#faf5ea]'}`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <ShieldCheck size={21} className="shrink-0 text-[#aa8950]" />
                            <span className="min-w-0">
                              <strong className="block text-sm font-black">المصدر والتخريج والمراجعة</strong>
                              <span className={`mt-1 block truncate text-xs ${quiet}`}>{selectedBook.name_ar} · حديث {digit(activeHadith.idInBook)}</span>
                            </span>
                          </span>
                          <ChevronLeft size={19} className={`shrink-0 text-[#aa8950] transition-transform ${showReferences ? '-rotate-90' : ''}`} />
                        </button>
                        {showReferences && (
                          <div id="hadith-scholarly-reference" className={`mt-3 overflow-hidden rounded-2xl border ${bg ? 'border-white/10' : 'border-[#c2a66e]/25'}`}>
                            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                              <div className={`rounded-xl p-3 ${softSurface}`}><p className={`text-[11px] ${quiet}`}>الكتاب</p><p className="mt-1 text-sm font-bold leading-7">{selectedBook.name_ar}</p></div>
                              <div className={`rounded-xl p-3 ${softSurface}`}><p className={`text-[11px] ${quiet}`}>الباب</p><p className="mt-1 text-sm font-bold leading-7">{currentChapter?.name_ar || `رقم ${digit(activeHadith.chapterId)}`}</p></div>
                              <div className={`rounded-xl p-3 ${softSurface}`}><p className={`text-[11px] ${quiet}`}>رقم الحديث داخل الكتاب</p><p className="mt-1 text-sm font-bold">{digit(activeHadith.idInBook)}</p></div>
                              <div className={`rounded-xl p-3 ${softSurface}`}><p className={`text-[11px] ${quiet}`}>رقم السجل في المصدر</p><p className="mt-1 text-sm font-bold">{digit(activeHadith.id)}</p></div>
                              {activeHadith.english?.narrator && (
                                <div className={`rounded-xl p-3 sm:col-span-2 ${softSurface}`}>
                                  <p className={`text-[11px] ${quiet}`}>الراوي بحسب البيانات الإنجليزية للمصدر</p>
                                  <p dir="auto" className="mt-1 text-sm font-medium leading-7">{activeHadith.english.narrator}</p>
                                </div>
                              )}
                            </div>
                            <div className={`border-t px-4 py-4 sm:px-5 ${bg ? 'border-white/10' : 'border-[#c2a66e]/25'}`}>
                              <p className="flex items-center gap-2 text-sm font-black"><Info size={17} className="text-[#aa8950]" /> معلومات التوثيق</p>
                              <p className={`mt-3 text-xs leading-8 ${quiet}`}>
                                <strong className="font-black">درجة الحديث:</strong> غير مذكورة في البيانات المتاحة لهذا الحديث. لا يُستنتج حكم خاص من مجرد وجوده في هذا الكتاب.
                              </p>
                              <p className={`mt-1 text-xs leading-8 ${quiet}`}>
                                <strong className="font-black">الشرح والتخريج التفصيلي:</strong> بيانات هذا المصدر لا تشمل تخريجًا تفصيليًا تلقائيًا. تظهر الشروح المعتمدة - إن وجدت - في لوحة شرح الحديث أدناه مع توثيق مستقل.
                              </p>
                              <p className={`mt-1 text-xs leading-8 ${quiet}`}>
                                <strong className="font-black">المصدر الرقمي:</strong> واجهة الفرقان للأحاديث. الأرقام تخص ترقيم المصدر الرقمي، وقد تختلف عن طبعات أخرى؛ والإسناد والمتن معروضان دون فصل تخميني.
                              </p>
                            </div>
                            <div className={`border-t p-4 sm:p-5 ${bg ? 'border-white/10' : 'border-[#c2a66e]/25'}`}>
                              <p className="text-sm font-black">التحقق من الحديث في المصادر العلمية</p>
                              <p className={`mt-2 text-xs leading-7 ${quiet}`}>
                                انسخ عبارة من الحديث، وافتح الموسوعة الحديثية ثم الصقها في البحث. طابق نص الحديث وراويه ومصدره قبل اعتماد أي حكم أو شرح؛ نتائج البحث ليست توثيقًا تلقائيًا للرواية الحالية.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => void copyVerificationPhrase()} disabled={!verificationPhrase} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-45 ${softSurface}`}>
                                  <Copy size={16} /> نسخ عبارة البحث
                                </button>
                                <a href={HADITH_VERIFICATION_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#1c5c60] px-3 py-2.5 text-xs font-bold text-white">
                                  <ExternalLink size={16} /> الموسوعة الحديثية
                                </a>
                                <a href={HADITH_ALTERNATIVE_LIBRARY_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${softSurface}`}>
                                  <ExternalLink size={16} /> مرجع إضافي
                                </a>
                                <a href={HADITH_SOURCE.documentation} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${softSurface}`}>
                                  <ExternalLink size={16} /> توثيق مصدر النص
                                </a>
                                <button type="button" onClick={() => void copyReferenceDetails()} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${softSurface}`}>
                                  <ClipboardCheck size={16} /> نسخ المرجع
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3">
                          <button
                            type="button"
                            aria-expanded={showExplanation}
                            aria-controls="hadith-reviewed-explanation"
                            onClick={() => setShowExplanation((value) => !value)}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-right transition ${bg ? 'border-white/10 bg-[#20373a]' : 'border-[#c2a66e]/25 bg-[#faf5ea]'}`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <BookMarked size={21} className="shrink-0 text-[#aa8950]" />
                              <span className="min-w-0">
                                <strong className="block text-sm font-black">شرح الحديث ومعاني الكلمات</strong>
                                <span className={`mt-1 block text-xs ${quiet}`}>شروح مراجعة مع ذكر المرجع فقط</span>
                              </span>
                            </span>
                            <ChevronLeft size={19} className={`shrink-0 text-[#aa8950] transition-transform ${showExplanation ? '-rotate-90' : ''}`} />
                          </button>

                          {showExplanation && (
                            <section
                              id="hadith-reviewed-explanation"
                              aria-label="شرح الحديث الموثق"
                              className={`mt-3 overflow-hidden rounded-2xl border ${bg ? 'border-white/10 bg-[#172c2f]' : 'border-[#c2a66e]/25 bg-[#fffdf8]'}`}
                            >
                              {explanationLoading ? (
                                <div className="flex items-center gap-3 p-5 text-sm" role="status">
                                  <Loader2 size={19} className="animate-spin text-[#b18f53]" />
                                  <span>جارٍ التحقق من وجود شرح مراجع لهذا الحديث...</span>
                                </div>
                              ) : explanationResult?.status === 'available' && explanationResult.explanation ? (
                                <div className="space-y-5 p-4 sm:p-6">
                                  <div className={`rounded-2xl border p-4 ${bg ? 'border-[#b99b59]/25 bg-[#283d3d]' : 'border-[#b99b59]/25 bg-[#f7f0e2]'}`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="flex items-center gap-2 text-xs font-black text-[#b19257]"><ShieldCheck size={16} /> شرح تحريري مسجّل بعد مراجعة</span>
                                      <span className={`text-[11px] ${quiet}`}>{explanationResult.origin === 'cache' || explanationResult.origin === 'memory' ? 'قد يكون محفوظًا على الجهاز' : 'بيانات الشروح المحلية'}</span>
                                    </div>
                                    <h3 className="mt-3 text-lg font-black leading-8">{explanationResult.explanation.title}</h3>
                                    <p className={`mt-2 text-xs leading-7 ${quiet}`}>هذا شرح منفصل عن لفظ الحديث النبوي؛ يُرجع إلى مصدره الأصلي قبل الاستشهاد.</p>
                                  </div>

                                  <div>
                                    <h4 className="mb-2 text-sm font-black">شرح الحديث</h4>
                                    <p dir="rtl" lang="ar" className="whitespace-pre-line break-words font-serif text-[19px] leading-[2.1]" style={{ overflowWrap: 'anywhere' }}>
                                      {explanationResult.explanation.explanation}
                                    </p>
                                  </div>

                                  {explanationResult.explanation.vocabulary.length > 0 && (
                                    <div>
                                      <h4 className="mb-3 text-sm font-black">معاني الكلمات</h4>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {explanationResult.explanation.vocabulary.map((entry, index) => (
                                          <div key={`${entry.word}-${index}`} className={`rounded-xl p-3 ${softSurface}`}>
                                            <strong className="block text-sm text-[#b49459]">{entry.word}</strong>
                                            <p className="mt-1 whitespace-pre-line text-sm leading-7">{entry.meaning}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {explanationResult.explanation.benefits.length > 0 && (
                                    <div>
                                      <h4 className="mb-3 text-sm font-black">الفوائد المذكورة في الشرح</h4>
                                      <ol className="space-y-2">
                                        {explanationResult.explanation.benefits.map((benefit, index) => (
                                          <li key={index} className={`flex items-start gap-3 rounded-xl p-3 text-sm leading-7 ${softSurface}`}>
                                            <span className="shrink-0 font-black text-[#b49459]">{digit(index + 1)}.</span>
                                            <span>{benefit}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}

                                  <div className={`rounded-2xl border p-4 ${bg ? 'border-white/10' : 'border-[#b99b59]/25'}`}>
                                    <h4 className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={17} className="text-[#b49459]" /> مرجع الشرح ومراجعته</h4>
                                    <dl className="mt-3 grid gap-3 text-xs leading-7 sm:grid-cols-2">
                                      <div><dt className={quiet}>المصدر</dt><dd className="font-bold">{explanationResult.explanation.source.title}</dd></div>
                                      {explanationResult.explanation.source.author && (
                                        <div><dt className={quiet}>صاحب المصدر</dt><dd className="font-bold">{explanationResult.explanation.source.author}</dd></div>
                                      )}
                                      <div><dt className={quiet}>موضع الشرح في المرجع</dt><dd className="font-bold">{explanationResult.explanation.source.reference}</dd></div>
                                      <div><dt className={quiet}>المراجع التحريري وتاريخه</dt><dd className="font-bold">{explanationResult.explanation.editorial.reviewedBy} · {explanationResult.explanation.editorial.reviewedAt}</dd></div>
                                    </dl>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <a
                                        href={explanationResult.explanation.source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#1c5c60] px-4 py-2.5 text-xs font-black text-white"
                                      ><ExternalLink size={16} /> فتح المرجع</a>
                                      <button type="button" onClick={() => void copyExplanationCitation()} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${softSurface}`}><Copy size={16} /> نسخ المرجع</button>
                                    </div>
                                    <p className={`mt-3 text-[11px] leading-6 ${quiet}`}>وصف «مراجع» يعني أن سجل الشرح يتضمن بيانات مراجعة تحريرية، ولا يُعد بديلًا عن التحقق العلمي من المرجع الأصلي.</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3 p-4 sm:p-6" role="status">
                                  <div className="flex items-start gap-3">
                                    <Info size={21} className="mt-0.5 shrink-0 text-[#b19257]" />
                                    <div>
                                      <h3 className="text-sm font-black">{explanationResult?.status === 'source-unavailable' ? 'تعذر تحميل الشرح' : 'لم يُضف شرح موثق لهذا الحديث بعد'}</h3>
                                      <p className={`mt-2 text-xs leading-8 ${quiet}`}>
                                        {explanationResult?.message || 'لم تتوفر بيانات الشروح حاليًا. لن نعرض شرحًا منسوبًا لمرجع دون تحقق.'}
                                      </p>
                                    </div>
                                  </div>
                                  <p className={`text-xs leading-7 ${quiet}`}>البحث الخارجي للمراجعة فقط؛ يجب مطابقة ألفاظ الحديث ورقمه ومصدره بنفسك، ولا يُثبت حكمًا تلقائيًا عليه.</p>
                                  <div className="flex flex-wrap gap-2">
                                    <a
                                      href={explanationResult?.researchUrl || HADITH_VERIFICATION_URL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-xl bg-[#1c5c60] px-4 py-2.5 text-xs font-black text-white"
                                    ><ExternalLink size={16} /> البحث في الموسوعة الحديثية</a>
                                    <button type="button" onClick={() => setExplanationRetry((value) => value + 1)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${softSurface}`}><RefreshCw size={16} /> إعادة التحقق</button>
                                  </div>
                                </div>
                              )}
                            </section>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`grid grid-cols-4 gap-2 border-t px-4 py-4 sm:px-7 ${bg ? 'border-white/10' : 'border-[#bfa267]/20'}`}>
                      <button onClick={() => void copyHadith()} className={`flex flex-col items-center gap-2 rounded-xl p-2 text-xs font-bold ${softSurface}`}><Copy size={19} /> نسخ</button>
                      <button onClick={() => void shareHadith()} className={`flex flex-col items-center gap-2 rounded-xl p-2 text-xs font-bold ${softSurface}`}><Share2 size={19} /> مشاركة</button>
                      <button onClick={toggleFavorite} className={`flex flex-col items-center gap-2 rounded-xl p-2 text-xs font-bold ${softSurface}`}><Bookmark size={19} fill={activeIsFavorite ? 'currentColor' : 'none'} /> {activeIsFavorite ? 'محفوظ' : 'حفظ'}</button>
                      <button onClick={() => setShowNotes((v) => !v)} className={`flex flex-col items-center gap-2 rounded-xl p-2 text-xs font-bold ${softSurface}`}><BookMarked size={19} /> ملاحظات</button>
                    </div>
                    {feedback && <div role="status" className={`px-5 pb-4 text-xs ${quiet}`}>{feedback}</div>}
                  </article>
                  {showNotes && <section className={`rounded-3xl border p-5 ${surface}`}><h3 className="font-black">ملاحظاتك الخاصة</h3><p className={`mt-1 text-xs ${quiet}`}>الملاحظات خاصة بك؛ تُحفظ على الجهاز وتُزامن مع حسابك عند تسجيل الدخول وتوفر الاتصال، ولا تغيّر نص الحديث.</p><textarea rows={4} value={activeNote} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateNote(e.target.value)} maxLength={1400} disabled={!authResolved} className={`mt-3 w-full resize-y rounded-xl border p-3 text-sm leading-7 outline-none ${bg ? 'border-white/10 bg-[#102326]' : 'border-[#cdb787]/30 bg-[#fcfaf5]'}`} placeholder="اكتب فوائدك وملاحظاتك هنا..." /></section>}
                  <section className={`rounded-3xl border p-5 ${surface}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-black"><ImageIcon size={20} className="text-[#b5904f]" /> الحديث كصورة</h3><span className={`text-xs ${quiet}`}>بدون قص النص الطويل</span></div>
                    <p className={`mt-2 text-xs leading-6 ${quiet}`}>قوالب وألوان وخطوط ومقاسات متعددة مع معاينة وتقسيم الأحاديث الطويلة.</p>
                    <button type="button" onClick={() => setShowDesigner(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1c5c60] px-5 py-3.5 text-sm font-black text-white"><ImageIcon size={18} />فتح استوديو التصميم</button>
                  </section>
                  <nav aria-label="التنقل بين الأحاديث" className="grid grid-cols-2 gap-3">
                    <button onClick={() => advance(-1)} disabled={hadithIndex === 0 && chapters.findIndex((c) => c.id === chapterId) <= 0} className={`inline-flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-black disabled:opacity-35 ${surface}`}><ChevronRight size={20} /> السابق</button>
                    <button onClick={() => advance(1)} disabled={hadithIndex >= displayedHadiths.length - 1 && chapters.findIndex((c) => c.id === chapterId) >= chapters.length - 1} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1b5b60] p-4 text-sm font-black text-white disabled:opacity-35">التالي <ChevronLeft size={20} /></button>
                  </nav>
                </>}
              </div>
            </div>}
          </>
        )}
        <footer className={`mx-auto mt-10 max-w-3xl text-center text-[11px] leading-7 ${quiet}`}>
          مصدر النصوص: <a href={HADITH_SOURCE.documentation} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">واجهة الفرقان للأحاديث</a>. جميع الحقوق ونسبة البيانات حسب المصدر الأصلي. يُرجى الرجوع للنسخ العلمية المحققة عند الحاجة إلى التوثيق التفصيلي.
        </footer>
      {showDesigner && activeHadith && selectedBook && <ShareCardDesigner content={{ kind: 'hadith', title: selectedBook.name_ar, text: activeHadith.arabic, reference: `${selectedBook.name_ar} · الحديث رقم ${digit(activeHadith.idInBook)}` }} onClose={() => setShowDesigner(false)} />}
      </main>
    </div>
  )
}