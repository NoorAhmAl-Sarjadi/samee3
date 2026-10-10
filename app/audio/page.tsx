'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileArchive,
  Headphones,
  Library,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react'
import JSZip from 'jszip'

type Riwaya = {
  id: number
  name: string
}

type Moshaf = {
  id: number
  name: string
  server: string
  surah_total: number
  moshaf_type: number
  surah_list: string
}

type Reciter = {
  id: number
  name: string
  letter?: string
  moshaf: Moshaf[]
}

type Surah = {
  id: number
  name: string
  start_page?: number
  end_page?: number
  makkia?: number
  type?: number
}

type RadioStation = {
  id: number
  name: string
  url: string
}

type SunnahBook = {
  id: string
  name: string
  records: number
  synthetic?: boolean
  source?: string
}

type LibraryAudio = {
  id: string
  title: string
  subtitle: string
  audioUrl: string
  sourceName: string
  authorName?: string
  section: 'ruqyah' | 'khutbah' | 'sunnah'
  duration?: number
  downloadable?: boolean
  isStream?: boolean
  sourceUrl?: string
  image?: string | null
  bookId?: string
  record?: number
  isSynthetic?: boolean
}

type PlayerItem = {
  kind: 'quran' | 'library'
  legacyOpaque?: boolean
  title: string
  subtitle: string
  audioUrl: string
  reciterName: string
  surahId?: number
  reciterId?: number
  riwayaId?: number
  libraryId?: string
  sourceName?: string
  isStream?: boolean
}

type OfflineRecord = {
  key: string
  title: string
  subtitle: string
  blob: Blob
  savedAt: number
  item?: PlayerItem
}

type TabKey = 'quran' | 'ruqyah' | 'khutbah' | 'sunnah'

const MP3QURAN_API = 'https://mp3quran.net/api/v3'
const AUDIO_LIBRARY_API = '/api/audio-library'

// نفس مخزن Cache Storage الذي يستخدمه مصحف سميع لحفظ تلاوات القرآن.
// بهذا الشكل لا يُعاد تنزيل السورة إذا كان المستخدم قد حفظها من المصحف.
const SAMEE3_QURAN_AUDIO_CACHE = 'samee3-audio-v2'

const FAVORITE_RECITER_NAMES = [
  'مشاري راشد العفاسي',
  'محمود خليل الحصري',
  'محمد صديق المنشاوي',
  'ماهر المعيقلي',
  'عبد الباسط عبد الصمد',
  'عبد الرحمن السديس',
  'ياسر الدوسري',
  'هزاع البلوشي',
  'سعد الغامدي',
]


/*
 * يمكن توسيعها يدويًا بأسماء المشايخ التي يريد مدير المنصة السماح
 * بمحتواهم في القسم العلمي. عندما تكون فارغة سيُعتمد تصنيف المصدر
 * نفسه بدل منع المواد.
 */
function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}


function pad3(value: number) {
  return String(value).padStart(3, '0')
}

function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function formatDuration(seconds: number | undefined) {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '٠٠:٠٠'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${arabicDigits(String(mins).padStart(2, '0'))}:${arabicDigits(
    String(secs).padStart(2, '0')
  )}`
}

function getMoshafForRiwaya(reciter: Reciter, riwayaName: string) {
  const normalized = normalizeArabic(riwayaName)
  return (
    reciter.moshaf.find((moshaf) =>
      normalizeArabic(moshaf.name).includes(normalized)
    ) || reciter.moshaf[0]
  )
}

function detectFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i)
    return match?.[1]?.toLowerCase() || 'mp3'
  } catch {
    return 'mp3'
  }
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

function getOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('samee-audio-library', 1)
    let expired = false
    const timer = window.setTimeout(() => {
      expired = true
      reject(new Error('تعذر فتح مخزن الصوت على الجهاز.'))
    }, 8000)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('audio')) {
        request.result.createObjectStore('audio', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      window.clearTimeout(timer)
      if (expired) { request.result.close(); return }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => {
      window.clearTimeout(timer)
      reject(request.error || new Error('تعذر فتح مخزن الصوت.'))
    }
  })
}

async function offlineRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await getOfflineDb()
  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction('audio', mode)
      const request = action(tx.objectStore('audio'))
      tx.oncomplete = () => { db.close(); resolve(request.result) }
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('تعذر إتمام حفظ الصوت.')) }
    } catch (error) { db.close(); reject(error) }
  })
}

async function putOffline(record: OfflineRecord) {
  await offlineRequest('readwrite', (store) => store.put(record))
}

async function getOffline(key: string): Promise<OfflineRecord | null> {
  return (await offlineRequest<OfflineRecord | undefined>('readonly', (store) => store.get(key))) || null
}

async function deleteOffline(key: string) {
  await offlineRequest('readwrite', (store) => store.delete(key))
}

async function listOffline(): Promise<OfflineRecord[]> {
  // القراءة بالمؤشر تمنع تحميل كل ملفات الصوت الكبيرة إلى الذاكرة دفعة واحدة.
  const db = await getOfflineDb()
  return new Promise((resolve, reject) => {
    const rows: OfflineRecord[] = []
    try {
      const tx = db.transaction('audio', 'readonly')
      const request = tx.objectStore('audio').openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        const row = cursor.value as OfflineRecord
        if (row.blob instanceof Blob && row.blob.size > 0) {
          // لا نحتفظ بالصوت داخل قائمة الواجهة.
          rows.push({ ...row, blob: new Blob() })
        }
        cursor.continue()
      }
      tx.oncomplete = () => { db.close(); resolve(rows) }
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error) }
    } catch (error) { db.close(); reject(error) }
  })
}

const AUDIO_CATALOG_KEY = 'samee3_audio_saved_catalog_v1'
const API_CATALOG_PREFIX = 'samee3_audio_api_v1:'
const AUDIO_CACHE_NAMES = [SAMEE3_QURAN_AUDIO_CACHE, 'samee3-v2-audio', 'samee-audio-v2']

function offlineKeyFor(item: PlayerItem) {
  return item.kind === 'quran'
    ? `quran:${item.reciterId}:${item.riwayaId}:${item.surahId}`
    : `library:${item.libraryId}`
}

function isPlayerItem(value: unknown): value is PlayerItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PlayerItem>
  return (item.kind === 'quran' || item.kind === 'library') &&
    typeof item.title === 'string' && typeof item.subtitle === 'string' &&
    typeof item.reciterName === 'string' && typeof item.audioUrl === 'string'
}

function readAudioCatalog(): PlayerItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(AUDIO_CATALOG_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isPlayerItem) : []
  } catch { return [] }
}

function rememberAudio(item: PlayerItem, remove = false) {
  try {
    const entries = readAudioCatalog().filter((entry) =>
      item.audioUrl ? entry.audioUrl !== item.audioUrl : offlineKeyFor(entry) !== offlineKeyFor(item))
    if (!remove) entries.push(item)
    localStorage.setItem(AUDIO_CATALOG_KEY, JSON.stringify(entries))
  } catch { /* الصوت نفسه يظل محفوظًا إذا امتلأ مخزن البيانات النصية. */ }
}

function recordPlayer(record: OfflineRecord): PlayerItem {
  if (isPlayerItem(record.item)) return record.item
  const parts = record.key.split(':')
  const catalog = readAudioCatalog().find((item) => offlineKeyFor(item) === record.key)
  if (catalog) return catalog
  return {
    kind: parts[0] === 'quran' ? 'quran' : 'library',
    title: record.title || 'تسجيل محفوظ', subtitle: record.subtitle || '',
    audioUrl: '', reciterName: 'تسجيل محفوظ على الجهاز',
    ...(parts[0] === 'quran'
      ? { reciterId: Number(parts[1]), riwayaId: Number(parts[2]), surahId: Number(parts[3]) }
      : { libraryId: parts.slice(1).join(':') }),
  }
}

function isCompleteAudio(response: Response): boolean {
  const type = response.headers.get('content-type') || ''
  return response.status === 200 && !response.headers.has('content-range') &&
    !/text\/|json|xml/i.test(type) && response.headers.get('content-length') !== '0'
}

async function findCachedAudio(url: string): Promise<Response | null> {
  if (!url || typeof caches === 'undefined') return null
  try {
    const existing = await caches.keys()
    for (const name of AUDIO_CACHE_NAMES) {
      if (!existing.includes(name)) continue
      const cache = await caches.open(name)
      const response = await cache.match(url)
      if (response && isCompleteAudio(response)) return response
    }
  } catch { /* يمكن تجربة IndexedDB أو الشبكة. */ }
  return null
}

async function hasLegacyOpaque(url: string): Promise<boolean> {
  if (!url || typeof caches === 'undefined' || !navigator.serviceWorker?.controller) return false
  try {
    const names = await caches.keys()
    for (const name of AUDIO_CACHE_NAMES.filter((entry) => names.includes(entry))) {
      if ((await (await caches.open(name)).match(url))?.type === 'opaque') return true
    }
  } catch {}
  return false
}

async function getSavedBlob(item: PlayerItem): Promise<Blob | null> {
  if (item.kind === 'quran') {
    const cached = await findCachedAudio(item.audioUrl)
    if (cached) {
      try { const blob = await cached.blob(); if (blob.size) return blob } catch {}
    }
  }
  try {
    const record = await getOffline(offlineKeyFor(item))
    return record?.blob instanceof Blob && record.blob.size ? record.blob : null
  } catch { return null }
}

async function fetchAudioBlob(url: string): Promise<Blob> {
  if (!url || navigator.onLine === false) throw new Error('لا توجد نسخة كاملة محفوظة لهذا الصوت.')
  const controller = new AbortController()
  // يمتد الحد للتحميل كاملًا، وليس لاستلام الترويسات فقط.
  const timer = window.setTimeout(() => controller.abort(), 300000)
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal })
    if (!isCompleteAudio(response)) throw new Error('لم يرجع المصدر ملف صوت كاملًا.')
    const blob = await response.blob()
    if (!blob.size) throw new Error('الملف الصوتي فارغ.')
    return blob
  } finally { window.clearTimeout(timer) }
}

async function storeAudio(item: PlayerItem): Promise<void> {
  if (item.isStream) throw new Error('البث المباشر لا يمكن حفظه.')
  const blob = await getSavedBlob(item) ?? await fetchAudioBlob(item.audioUrl)
  if (item.kind === 'quran' && item.audioUrl && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(SAMEE3_QURAN_AUDIO_CACHE)
      await cache.put(item.audioUrl, new Response(blob, {
        status: 200, headers: { 'Content-Type': blob.type || 'audio/mpeg', 'Content-Length': String(blob.size) },
      }))
      // نحتفظ بالنسخ القديمة ولا نحذفها أثناء الترحيل.
      rememberAudio(item)
      return
    } catch { /* نخزن في IndexedDB إذا تعذر Cache Storage. */ }
  }
  await putOffline({ key: offlineKeyFor(item), title: item.title, subtitle: item.subtitle, blob, savedAt: Date.now(), item })
  rememberAudio(item)
}

async function fetchJson<T>(url: string): Promise<T> {
  let cached: T | undefined
  try {
    const raw = localStorage.getItem(`${API_CATALOG_PREFIX}${url}`)
    if (raw) cached = JSON.parse(raw) as T
  } catch {}
  if (navigator.onLine === false) {
    if (cached !== undefined) return cached
    throw new Error('هذه القائمة لم تُحفظ على الجهاز بعد.')
  }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    const data = await response.json() as T
    if (data && typeof data === 'object' && 'ok' in data && data.ok === false) throw new Error('تعذر تحميل القائمة.')
    try { localStorage.setItem(`${API_CATALOG_PREFIX}${url}`, JSON.stringify(data)) } catch {}
    return data
  } catch (error) {
    if (cached !== undefined) return cached
    throw error
  } finally { window.clearTimeout(timer) }
}

function AudioAvatar({
  size = 'md',
  playing = false,
}: {
  size?: 'sm' | 'md' | 'lg' | 'player'
  playing?: boolean
}) {
  const sizeClass = {
    sm: 'w-12 h-12 rounded-2xl',
    md: 'w-full h-full rounded-2xl',
    lg: 'w-28 h-28 sm:w-36 sm:h-36 rounded-full',
    player: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
  }[size]

  const iconSize = {
    sm: 20,
    md: 32,
    lg: 42,
    player: 24,
  }[size]

  return (
    <div
      className={`${sizeClass} relative overflow-hidden bg-gradient-to-br from-[#175E67] via-[#11474E] to-[#0D383E] border border-mushaf-gold/30 shadow-lg flex items-center justify-center`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.18),transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-1">
        <Headphones
          size={iconSize}
          className="text-mushaf-gold"
          strokeWidth={1.7}
        />
        <div className="flex items-end gap-[3px] h-4 mt-1">
          {[8, 13, 18, 11, 16, 9, 14].map((height, index) => (
            <span
              key={index}
              className={`w-[3px] rounded-full bg-white/90 ${
                playing ? 'animate-pulse' : ''
              }`}
              style={{ height: `${height}px`, animationDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
      </div>
      {playing && (
        <div className="absolute inset-0 rounded-[inherit] ring-2 ring-mushaf-gold/50 animate-pulse" />
      )}
    </div>
  )
}

function SectionIcon({ type }: { type: TabKey }) {
  if (type === 'quran') return <BookOpen size={20} />
  if (type === 'ruqyah') return <Sparkles size={20} />
  if (type === 'khutbah') return <Radio size={20} />
  return <Library size={20} />
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl border border-mushaf-border/40 bg-white px-3 py-2 text-xs font-bold text-mushaf-dark transition hover:border-mushaf-teal hover:text-mushaf-teal disabled:cursor-not-allowed disabled:opacity-45"
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export default function AudioPage() {
  const [riwayat, setRiwayat] = useState<Riwaya[]>([])
  const [reciters, setReciters] = useState<Reciter[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [radios, setRadios] = useState<RadioStation[]>([])

  const [libraryItems, setLibraryItems] = useState<LibraryAudio[]>([])
  const [sunnahBooks, setSunnahBooks] = useState<SunnahBook[]>([])
  const [sunnahExtras, setSunnahExtras] = useState<LibraryAudio[]>([])
  const [selectedSunnahBookId, setSelectedSunnahBookId] = useState<string | null>(null)
  const [sunnahHasMore, setSunnahHasMore] = useState(false)
  const [sunnahNextStart, setSunnahNextStart] = useState(1)
  const [selectedRuqyahId, setSelectedRuqyahId] = useState<string | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryUnavailable, setLibraryUnavailable] = useState(false)
  const [libraryError, setLibraryError] = useState('')

  const [selectedRiwaya, setSelectedRiwaya] = useState<Riwaya | null>(null)
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null)
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('quran')
  const [search, setSearch] = useState('')
  const [riwayaSearch, setRiwayaSearch] = useState('')
  const [surahSearch, setSurahSearch] = useState('')
  const [showRiwayat, setShowRiwayat] = useState(false)
  const [showReciters, setShowReciters] = useState(false)
  const [showSurahs, setShowSurahs] = useState(false)
  const [showMorePlayer, setShowMorePlayer] = useState(false)

  const [loading, setLoading] = useState(true)
  const [recitersLoading, setRecitersLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [player, setPlayer] = useState<PlayerItem | null>(null)
  const [queue, setQueue] = useState<PlayerItem[]>([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off')

  const [offlineKeys, setOfflineKeys] = useState<Set<string>>(new Set())
  const [sharedQuranUrls, setSharedQuranUrls] = useState<Set<string>>(new Set())
  const [savedItems, setSavedItems] = useState<PlayerItem[]>([])
  const [isOffline, setIsOffline] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const operationBusyRef = useRef(false)
  const indexRequestRef = useRef(0)
  const libraryRequestRef = useRef(0)
  const [offlineBusyKey, setOfflineBusyKey] = useState<string | null>(null)
  const [zipBusy, setZipBusy] = useState(false)

  const [quranZipProgress, setQuranZipProgress] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const pendingPlayRef = useRef(false)

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const loadOfflineIndex = useCallback(async () => {
    const requestId = ++indexRequestRef.current
    const records = await listOffline().catch(() => [] as OfflineRecord[])
    const items = new Map<string, PlayerItem>()
    const urls = new Set<string>()
    const catalog = readAudioCatalog()
    for (const record of records) {
      const item = recordPlayer(record)
      items.set(item.audioUrl || offlineKeyFor(item), item)
    }
    if (typeof caches !== 'undefined') {
      try {
        const names = await caches.keys()
        for (const name of AUDIO_CACHE_NAMES.filter((entry) => names.includes(entry))) {
          const cache = await caches.open(name)
          for (const request of await cache.keys()) {
            if (!/\.mp3(?:$|\?)/i.test(request.url)) continue
            const response = await cache.match(request)
            if (!response || (!isCompleteAudio(response) && response.type !== 'opaque')) continue
            if (isCompleteAudio(response)) urls.add(request.url)
            // النسخ القديمة غير القابلة للفحص تظهر منفصلة عن الملفات المؤكدة.
            if (items.has(request.url) && !items.get(request.url)?.legacyOpaque) continue
            const known = catalog.find((item) => item.audioUrl === request.url)
            const match = new URL(request.url).pathname.match(/\/(\d{3})\.mp3$/i)
            const surahId = match ? Number(match[1]) : undefined
            items.set(request.url, { ...(known || {
              kind: 'quran', title: surahId ? `سورة رقم ${arabicDigits(surahId)}` : 'تلاوة محفوظة',
              subtitle: 'محفوظة من المصحف', audioUrl: request.url,
              reciterName: 'تلاوة محفوظة على الجهاز', surahId,
            }), legacyOpaque: response.type === 'opaque' })
          }
        }
      } catch { /* تظل ملفات IndexedDB ظاهرة عند تعذر كاش المتصفح. */ }
    }
    if (requestId !== indexRequestRef.current) return
    setOfflineKeys(new Set(records.map((record) => record.key)))
    setSharedQuranUrls(urls)
    setSavedItems(Array.from(items.values()))
  }, [])

  const loadBaseLibrary = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [riwayatData, surahsData, radiosData] = await Promise.all([
        fetchJson<{ riwayat: Riwaya[] }>(
          `${MP3QURAN_API}/riwayat?language=ar`
        ),
        fetchJson<{ suwar: Surah[] }>(
          `${MP3QURAN_API}/suwar?language=ar`
        ),
        fetchJson<{ radios: RadioStation[] }>(
          `${MP3QURAN_API}/radios?language=ar`
        ).catch(() => ({ radios: [] })),
      ])

      const nextRiwayat = Array.isArray(riwayatData.riwayat)
        ? riwayatData.riwayat
        : []

      const nextSurahs = Array.isArray(surahsData.suwar)
        ? surahsData.suwar
        : []

      const radioList = Array.isArray(radiosData.radios)
        ? radiosData.radios
        : []

      const preferredRiwaya =
        nextRiwayat.find((item) =>
          normalizeArabic(item.name).includes(normalizeArabic('حفص'))
        ) ||
        nextRiwayat[0] ||
        null

      setRiwayat(nextRiwayat)
      setSurahs(nextSurahs)
      setRadios(radioList)
      setSelectedRiwaya((current) => nextRiwayat.find((entry) => entry.id === current?.id) || preferredRiwaya)
    } catch (err) {
      console.error('Audio base library error:', err)
      setError('تعذر تحميل مكتبة القرآن حاليًا.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLibraryContent = useCallback(
    async (
      tab: Exclude<TabKey, 'quran'>,
      bookId?: string,
      start = 1,
      append = false
    ) => {
      const requestId = ++libraryRequestRef.current
      setLibraryLoading(true)
      setLibraryUnavailable(false)
      setLibraryError('')

      try {
        const params = new URLSearchParams({ section: tab })
        if (bookId) params.set('book', bookId)
        if (bookId && tab === 'sunnah') {
          params.set('start', String(start))
          params.set('limit', '50')
        }

        const result = await fetchJson<{
          ok?: boolean
          items?: LibraryAudio[]
          books?: SunnahBook[]
          extras?: LibraryAudio[]
          error?: string
          hasMore?: boolean
          nextStart?: number
        }>(`${AUDIO_LIBRARY_API}?${params.toString()}`)

        if (requestId !== libraryRequestRef.current) return
        if (result.ok === false) {
          throw new Error(result.error || 'Library request failed')
        }

        if (tab === 'sunnah' && !bookId) {
          const books = Array.isArray(result.books) ? result.books : []
          setSunnahBooks(books)
          setSunnahExtras(Array.isArray(result.extras) ? result.extras : [])
          setSelectedSunnahBookId(null)
          setLibraryItems([])
          setSunnahHasMore(false)
          setSunnahNextStart(1)
        } else {
          const items = Array.isArray(result.items) ? result.items : []
          setLibraryItems((previous) => append ? [...previous, ...items.filter((item) => !previous.some((old) => old.id === item.id))] : items)
          if (tab === 'ruqyah') {
            setSelectedRuqyahId(items[0]?.id || null)
          }
          if (tab === 'sunnah' && bookId) {
            setSunnahHasMore(Boolean(result.hasMore))
            setSunnahNextStart(Number(result.nextStart || start + 50))
          }
        }
      } catch (err) {
        if (requestId !== libraryRequestRef.current) return
        console.error('Audio library content error:', err)
        if (!append) setLibraryItems([])
        setLibraryUnavailable(true)
        setLibraryError(
          tab === 'sunnah'
            ? 'تعذر تحميل كتب السنة الصوتية حاليًا.'
            : tab === 'khutbah'
              ? 'تعذر تحميل أرشيف الخطب الصوتية حاليًا.'
              : 'تعذر تحميل مكتبة الرقية الصوتية حاليًا.'
        )
      } finally {
        if (requestId === libraryRequestRef.current) setLibraryLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadBaseLibrary()
    void loadOfflineIndex()
  }, [loadBaseLibrary, loadOfflineIndex])

  useEffect(() => {
    const update = () => {
      const offline = navigator.onLine === false
      setIsOffline(offline)
      if (offline) setShowSaved(true)
      void loadOfflineIndex()
    }
    const visible = () => { if (document.visibilityState === 'visible') update() }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', visible)
      indexRequestRef.current += 1
      libraryRequestRef.current += 1
    }
  }, [loadOfflineIndex])

  useEffect(() => {
    if (!selectedRiwaya) return
    const activeRiwaya = selectedRiwaya!

    let cancelled = false

    async function loadReciters() {
      setRecitersLoading(true)
      setError('')

      try {
        const result = await fetchJson<{ reciters: Reciter[] }>(
          `${MP3QURAN_API}/reciters?language=ar&rewaya=${encodeURIComponent(
            activeRiwaya.id
          )}`
        )

        if (cancelled) return

        const nextReciters: Reciter[] = Array.isArray(result.reciters)
          ? result.reciters
              .filter(
                (reciter: Reciter) =>
                  Array.isArray(reciter.moshaf) && reciter.moshaf.length > 0
              )
              .map((reciter: Reciter) => ({
                ...reciter,
                moshaf: reciter.moshaf.filter(
                  (moshaf) =>
                    typeof moshaf.server === 'string' &&
                    typeof moshaf.surah_list === 'string' &&
                    moshaf.surah_list.length > 0
                ),
              }))
              .filter((reciter: Reciter) => reciter.moshaf.length > 0)
          : []

        nextReciters.sort((a, b) => {
          const aIndex = FAVORITE_RECITER_NAMES.findIndex((name) =>
            normalizeArabic(a.name).includes(normalizeArabic(name))
          )
          const bIndex = FAVORITE_RECITER_NAMES.findIndex((name) =>
            normalizeArabic(b.name).includes(normalizeArabic(name))
          )

          if (aIndex !== -1 && bIndex === -1) return -1
          if (aIndex === -1 && bIndex !== -1) return 1
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
          return a.name.localeCompare(b.name, 'ar')
        })

        setReciters(nextReciters)
      } catch (err) {
        if (cancelled) return
        console.error('Reciters request error:', err)
        setReciters([])
        setError('تعذر تحميل قراء الرواية المحددة.')
      } finally {
        if (!cancelled) setRecitersLoading(false)
      }
    }

    void loadReciters()

    return () => {
      cancelled = true
    }
  }, [selectedRiwaya])

  const supportedSurahIds = useMemo(() => {
    if (!selectedMoshaf?.surah_list) return new Set<number>()

    return new Set(
      selectedMoshaf.surah_list
        .split(',')
        .map((item) => Number(item.trim()))
        .filter(Boolean)
    )
  }, [selectedMoshaf])

  const availableSurahs = useMemo(
    () => surahs.filter((surah) => supportedSurahIds.has(surah.id)),
    [surahs, supportedSurahIds]
  )

  const visibleReciters = useMemo(() => {
    const query = normalizeArabic(search)
    if (!query) return reciters
    return reciters.filter((reciter) =>
      normalizeArabic(reciter.name).includes(query)
    )
  }, [reciters, search])

  const filteredRiwayat = useMemo(() => {
    const query = normalizeArabic(riwayaSearch)
    if (!query) return riwayat
    return riwayat.filter((item) => normalizeArabic(item.name).includes(query))
  }, [riwayat, riwayaSearch])

  const visibleSurahs = useMemo(() => {
    const query = normalizeArabic(surahSearch)
    if (!query) return availableSurahs

    return availableSurahs.filter(
      (surah) =>
        normalizeArabic(surah.name).includes(query) ||
        String(surah.id).includes(query)
    )
  }, [availableSurahs, surahSearch])

  const filteredLibraryItems = useMemo(() => {
    const query = normalizeArabic(search)

    const bySection = libraryItems.filter((item) => {
      if (activeTab === 'ruqyah') return item.section === 'ruqyah'
      if (activeTab === 'khutbah') return item.section === 'khutbah'
      if (activeTab === 'sunnah') return item.section === 'sunnah'
      return false
    })

    if (!query) return bySection

    return bySection.filter((item) =>
      normalizeArabic(
        `${item.title} ${item.subtitle} ${item.authorName || ''}`
      ).includes(query)
    )
  }, [activeTab, libraryItems, search])

  const quranQueue = useMemo<PlayerItem[]>(() => {
    if (!selectedRiwaya || !selectedReciter || !selectedMoshaf) return []

    return availableSurahs.map((surah) => ({
      kind: 'quran',
      title: surah.name,
      subtitle: selectedRiwaya.name,
      audioUrl: `${selectedMoshaf.server.replace(/\/?$/, "/")}${pad3(surah.id)}.mp3`,
      reciterName: selectedReciter.name,
      surahId: surah.id,
      reciterId: selectedReciter.id,
      riwayaId: selectedRiwaya.id,
      isStream: false,
    }))
  }, [
    availableSurahs,
    selectedMoshaf,
    selectedReciter,
    selectedRiwaya,
  ])

  const libraryQueue = useMemo<PlayerItem[]>(() => {
    return filteredLibraryItems.map((item) => ({
      kind: 'library',
      title: item.title,
      subtitle: item.subtitle,
      audioUrl: item.audioUrl,
      reciterName: item.authorName || item.subtitle,
      libraryId: item.id,
      sourceName: item.sourceName,
      isStream: item.isStream,
    }))
  }, [filteredLibraryItems])

  const selectedAudioQueue = activeTab === 'quran' ? quranQueue : libraryQueue

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const startPlayer = useCallback(
    async (
      item: PlayerItem,
      nextQueue: PlayerItem[],
      nextIndex: number,
      autoplay = true
    ) => {
      const audio = audioRef.current
      if (!audio) return
      pendingPlayRef.current = autoplay
      setQueue(nextQueue)
      setQueueIndex(nextIndex)
      setPlayer(item)
      setProgress(0)
      setDuration(0)
    },
    []
  )

  useEffect(() => {
    if (!audioRef.current || !player) return

    const currentAudio = audioRef.current
    const currentPlayer = player
    let disposed = false
    let playListener: (() => void) | null = null
    let ownedObjectUrl: string | null = null

    async function prepare() {
      try {
        const savedBlob = await getSavedBlob(currentPlayer)
        if (disposed || audioRef.current !== currentAudio) return
        let source = currentPlayer.audioUrl
        if (savedBlob) {
          ownedObjectUrl = URL.createObjectURL(savedBlob)
          objectUrlRef.current = ownedObjectUrl
          source = ownedObjectUrl
        } else if (!source || navigator.onLine === false) {
          // بعض التنزيلات القديمة لا تُقرأ كـ Blob؛ يقدّمها Service Worker من رابطها.
          const legacyAvailable = await hasLegacyOpaque(source)
          if (disposed || audioRef.current !== currentAudio) return
          if (!legacyAvailable) throw new Error('هذا الملف غير محفوظ كاملًا. اتصل بالإنترنت واحفظه أولًا.')
        }

        /*
         * مهم: تغيير مستوى الصوت أو سرعة التشغيل لا يعيد تحميل الملف.
         * إعادة src/load هنا كانت سبب توقف التلاوة وتهنيج المشغل عند
         * تحريك شريط الصوت. هذه الـeffect تعمل فقط عند تغيير الملف نفسه.
         */
        currentAudio.pause()
        currentAudio.src = source
        currentAudio.load()

        const playNow = async () => {
          playListener = null
          if (!pendingPlayRef.current || disposed) return
          pendingPlayRef.current = false

          try {
            await currentAudio.play()
          } catch (err) {
            console.error('Audio play failed:', err)
            setIsPlaying(false)
            notify('اضغط تشغيل من المشغل لبدء التلاوة.')
          }
        }

        if (currentAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          await playNow()
        } else {
          playListener = playNow
          currentAudio.addEventListener('canplay', playNow, { once: true })
        }
      } catch (err) {
        if (disposed) return
        console.error('Player prepare error:', err)
        setIsPlaying(false)
        notify(err instanceof Error ? err.message : 'تعذر تجهيز الملف الصوتي.')
      }
    }

    void prepare()

    return () => {
      disposed = true
      currentAudio.pause()
      currentAudio.removeAttribute('src')
      currentAudio.load()
      if (ownedObjectUrl) {
        URL.revokeObjectURL(ownedObjectUrl)
        if (objectUrlRef.current === ownedObjectUrl) objectUrlRef.current = null
      }
      if (playListener) {
        currentAudio.removeEventListener('canplay', playListener)
        playListener = null
      }
    }
  }, [notify, player])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setProgress(audio.currentTime || 0)
    const handleLoadedMetadata = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)

      if (repeatMode === 'one') {
        audio.currentTime = 0
        void audio.play().catch(() => {})
        return
      }

      const nextIndex = queueIndex + 1

      if (nextIndex < queue.length) {
        pendingPlayRef.current = true
        setQueueIndex(nextIndex)
        setPlayer(queue[nextIndex])
        return
      }

      if (repeatMode === 'all' && queue.length > 0) {
        pendingPlayRef.current = true
        setQueueIndex(0)
        setPlayer(queue[0])
        return
      }

      setProgress(0)
    }

    const handleError = () => {
      setIsPlaying(false)
      notify('تعذر تشغيل هذا الملف. جرّب مصدرًا آخر.')
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [notify, queue, queueIndex, repeatMode])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [isMuted, volume])

  useEffect(() => {
    return () => revokeObjectUrl()
  }, [revokeObjectUrl])

  const selectRiwaya = (riwaya: Riwaya) => {
    if (audioRef.current) audioRef.current.pause()

    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)
    setSelectedRiwaya(riwaya)
    setSelectedReciter(null)
    setSelectedMoshaf(null)
    setSelectedSurah(null)
    setSearch('')
    setRiwayaSearch('')
    setShowRiwayat(false)
    setShowReciters(true)
    setShowSurahs(false)
  }

  const selectReciter = (reciter: Reciter) => {
    if (!selectedRiwaya) return

    if (audioRef.current) audioRef.current.pause()

    const moshaf = getMoshafForRiwaya(reciter, selectedRiwaya.name)

    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)
    setSelectedReciter(reciter)
    setSelectedMoshaf(moshaf || null)
    setSelectedSurah(null)
    setSearch('')
    setShowReciters(false)
    setShowSurahs(true)
  }

  const playSurah = async (surah: Surah) => {
    if (!selectedRiwaya || !selectedReciter || !selectedMoshaf) return

    const index = quranQueue.findIndex((item) => item.surahId === surah.id)
    const item = quranQueue[index]
    if (!item) return

    setSelectedSurah(surah)

    if (
      player?.kind === 'quran' &&
      player.surahId === surah.id &&
      player.reciterId === selectedReciter.id &&
      audioRef.current
    ) {
      if (audioRef.current.paused) {
        await audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
      return
    }

    await startPlayer(item, quranQueue, index, true)
  }

  const playLibraryItem = async (item: LibraryAudio) => {
    const queueItems = filteredLibraryItems.map((entry) => ({
      kind: 'library' as const,
      title: entry.title,
      subtitle: entry.subtitle,
      audioUrl: entry.audioUrl,
      reciterName: entry.authorName || entry.subtitle,
      libraryId: entry.id,
      sourceName: entry.sourceName,
      isStream: entry.isStream,
    }))

    let index = queueItems.findIndex((entry) => entry.libraryId === item.id)
    if (index === -1) {
      queueItems.push({ kind: 'library', title: item.title, subtitle: item.subtitle,
        audioUrl: item.audioUrl, reciterName: item.authorName || item.subtitle,
        libraryId: item.id, sourceName: item.sourceName, isStream: item.isStream })
      index = queueItems.length - 1
    }

    if (player?.kind === 'library' && player.libraryId === item.id) {
      await togglePlayer()
      return
    }

    await startPlayer(queueItems[index], queueItems, index, true)
  }

  const togglePlayer = async () => {
    const audio = audioRef.current
    if (!audio || !player) return

    if (audio.paused) {
      await audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  const closePlayer = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    pendingPlayRef.current = false
    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)
  }

  const seekTo = (value: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = value
    setProgress(value)
  }

  const goQueue = async (offset: number) => {
    if (!queue.length) return
    const nextIndex = queueIndex + offset

    if (nextIndex < 0 || nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        const wrapped = nextIndex < 0 ? queue.length - 1 : 0
        pendingPlayRef.current = true
        setQueueIndex(wrapped)
        setPlayer(queue[wrapped])
      }
      return
    }

    pendingPlayRef.current = true
    setQueueIndex(nextIndex)
    setPlayer(queue[nextIndex])

    if (queue[nextIndex].kind === 'quran' && queue[nextIndex].surahId) {
      const surah = availableSurahs.find(
        (entry) => entry.id === queue[nextIndex].surahId
      )
      if (surah) setSelectedSurah(surah)
    }
  }

  const downloadDirect = async (url: string, suggestedName: string, isStream = false) => {
    if (isStream) { notify('البث المباشر ليس ملفًا ثابتًا للتنزيل.'); return }
    try {
      const known = savedItems.find((item) => item.audioUrl === url)
      const cached = await findCachedAudio(url)
      const blob = (known ? await getSavedBlob(known) : null) ??
        (cached ? await cached.blob() : await fetchAudioBlob(url))
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${safeFileName(suggestedName)}.${detectFileExtension(url)}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000)
    } catch {
      if (url && navigator.onLine !== false) {
        window.open(url, '_blank', 'noopener,noreferrer')
        notify('تعذر تنزيل الملف برمجيًا. يمكنك تنزيله من رابط المصدر إن سمح المتصفح.')
      } else notify('لا توجد نسخة متاحة للتنزيل دون اتصال.')
    }
  }

  const saveOfflinePlayer = async (item: PlayerItem) => {
    if (operationBusyRef.current) { notify('انتظر انتهاء العملية الحالية.'); return }
    if (item.isStream) { notify('البث المباشر لا يمكن حفظه.'); return }
    operationBusyRef.current = true
    setOfflineBusyKey(offlineKeyFor(item))
    try {
      await storeAudio(item)
      await loadOfflineIndex()
      notify('اكتمل حفظ الصوت للاستماع دون إنترنت.')
    } catch (error) {
      console.warn('Offline save failed:', error)
      notify('لم يكتمل الحفظ. تحقق من الاتصال والمساحة؛ وقد يمنع المصدر تنزيل الصوت.')
    } finally { setOfflineBusyKey(null); operationBusyRef.current = false }
  }

  const removeOfflinePlayer = async (item: PlayerItem) => {
    if (operationBusyRef.current) { notify('انتظر انتهاء العملية الحالية.'); return }
    operationBusyRef.current = true
    setOfflineBusyKey(offlineKeyFor(item))
    try {
      if (item.kind === 'quran' && item.audioUrl && typeof caches !== 'undefined') {
        const names = await caches.keys()
        for (const name of AUDIO_CACHE_NAMES.filter((entry) => names.includes(entry))) {
          await (await caches.open(name)).delete(item.audioUrl)
        }
      }
      const legacy = await getOffline(offlineKeyFor(item)).catch(() => null)
      if (legacy) await deleteOffline(offlineKeyFor(item))
      rememberAudio(item, true)
      await loadOfflineIndex()
      notify('تم حذف النسخة المحفوظة.')
    } catch {
      await loadOfflineIndex()
      notify('تعذر إتمام الحذف. حاول مرة أخرى.')
    } finally { setOfflineBusyKey(null); operationBusyRef.current = false }
  }

  const downloadQuranZip = async () => {
    if (operationBusyRef.current) { notify('انتظر انتهاء العملية الحالية.'); return }
    if (!selectedReciter || !selectedRiwaya || !quranQueue.length) {
      notify('اختر القارئ والرواية أولًا.'); return
    }
    operationBusyRef.current = true
    setZipBusy(true)
    setQuranZipProgress(0)
    try {
      const zip = new JSZip()
      const total = quranQueue.length
      const failed: string[] = []
      let added = 0
      for (let index = 0; index < total; index += 1) {
        const item = quranQueue[index]
        try {
          const blob = await getSavedBlob(item) ?? await fetchAudioBlob(item.audioUrl)
          zip.file(`${pad3(item.surahId || index + 1)} - ${safeFileName(item.title)}.mp3`, blob)
          added += 1
        } catch { failed.push(item.title) }
        setQuranZipProgress(Math.round(((index + 1) / total) * 90))
      }
      if (!added) throw new Error('لم يمكن تجهيز أي سورة.')
      if (failed.length) zip.file('السور-غير-المضمنة.txt', failed.join('\n'))
      const content = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true },
        (metadata) => setQuranZipProgress(90 + Math.round(metadata.percent / 10)))
      const blobUrl = URL.createObjectURL(content)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `${safeFileName(`تلاوات ${selectedReciter.name} - ${selectedRiwaya.name} - ${added} سورة`)}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      notify(failed.length ? `تم تجهيز ${arabicDigits(added)} سورة؛ تعذر تضمين ${arabicDigits(failed.length)} سورة.` : `تم تجهيز جميع السور المختارة (${arabicDigits(added)}) في ZIP.`)
    } catch { notify('تعذر إنشاء ZIP. تحقق من الاتصال والمساحة المتاحة.') }
    finally { setZipBusy(false); setQuranZipProgress(0); operationBusyRef.current = false }
  }

  const saveWholeQuranOffline = async () => {
    if (operationBusyRef.current) { notify('انتظر انتهاء العملية الحالية.'); return }
    if (!quranQueue.length) { notify('اختر القارئ والرواية أولًا.'); return }
    operationBusyRef.current = true
    setZipBusy(true)
    setQuranZipProgress(0)
    let saved = 0
    let failed = 0
    try {
      for (let index = 0; index < quranQueue.length; index += 1) {
        try { await storeAudio(quranQueue[index]); saved += 1 }
        catch { failed += 1 }
        setQuranZipProgress(Math.round(((index + 1) / quranQueue.length) * 100))
      }
      await loadOfflineIndex()
      notify(failed ? `المحفوظ ${arabicDigits(saved)} من ${arabicDigits(quranQueue.length)} سورة. تعذر حفظ ${arabicDigits(failed)}؛ يمكنك إعادة المحاولة.` : `اكتمل حفظ جميع السور المختارة (${arabicDigits(saved)}) دون إنترنت.`)
    } finally { setZipBusy(false); setQuranZipProgress(0); operationBusyRef.current = false }
  }

  const resetSelection = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }
    revokeObjectUrl()

    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)
    setSelectedReciter(null)
    setSelectedMoshaf(null)
    setSelectedSurah(null)
    setShowRiwayat(false)
    setShowReciters(false)
    setShowSurahs(false)
  }

  const tabTitle: Record<TabKey, string> = {
    quran: 'القرآن الكريم',
    ruqyah: 'الرُّقية الشرعية',
    khutbah: 'الخطب والدروس',
    sunnah: 'كتب السنة الصوتية',
  }

  const tabDescription: Record<TabKey, string> = {
    quran: 'تلاوات كاملة مع تشغيل وتنزيل وحفظ للاستماع دون إنترنت.',
    ruqyah: 'مصادر الرقية المتاحة صوتيًا مع مشغل موحّد للمكتبة.',
    khutbah: 'الخطب والدروس الصوتية التي يعيدها مصدر المكتبة المتاح.',
    sunnah: 'كتب الحديث والشروح والسلاسل الصوتية المتاحة في المصدر.',
  }

  const currentOffline = player
    ? player.kind === 'quran'
      ? offlineKeys.has(offlineKeyFor(player)) || sharedQuranUrls.has(player.audioUrl)
      : offlineKeys.has(offlineKeyFor(player))
    : false

  return (
    <div
      className="min-h-screen bg-mushaf-paper pb-44"
      dir="rtl"
    >
      <audio ref={audioRef} preload="metadata" />

      <header className="sticky top-0 z-40 border-b border-mushaf-border/25 bg-mushaf-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-mushaf-teal shadow-sm"
            aria-label="العودة للرئيسية"
          >
            <ChevronRight size={23} />
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <Headphones className="text-mushaf-gold" size={22} />
              <h1 className="truncate text-xl font-black text-mushaf-dark">
                المكتبة الصوتية
              </h1>
            </div>
            <p className="mt-1 text-xs font-medium text-gray-500">
              مكتبة سميع — القرآن والرقية وكتب الحديث والخطب
            </p>
          </div>

          <button
            type="button"
            onClick={resetSelection}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-mushaf-teal shadow-sm transition hover:bg-mushaf-paper"
            title="إعادة الاختيار"
            aria-label="إعادة الاختيار"
          >
            <RotateCcw size={19} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {(
          <>
            {loading && <p role="status" className="mb-4 text-center text-sm font-bold text-mushaf-teal">جاري تحميل القوائم...</p>}
            {isOffline && <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">أنت دون اتصال. افتح «المحفوظ على الجهاز» للاستماع إلى الملفات المحفوظة على هذا الجهاز.</p>}
            <section className="relative overflow-hidden rounded-[2rem] border border-mushaf-gold/20 bg-gradient-to-br from-[#175E67] via-[#124A51] to-[#0D383E] p-5 text-white shadow-[0_20px_60px_rgba(13,56,62,0.18)] sm:p-7">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-mushaf-gold/10 blur-3xl" />

              <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
                <div className="flex justify-center">
                  <div className="rounded-full border-4 border-mushaf-gold/80 p-1 shadow-2xl">
                    <AudioAvatar size="lg" playing={isPlaying} />
                  </div>
                </div>

                <div className="min-w-0 text-center lg:text-right">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-mushaf-gold">
                    {player ? 'الاستماع الآن' : 'مكتبة سميع'}
                  </p>

                  <h2 className="truncate text-2xl font-black sm:text-3xl">
                    {player?.reciterName ||
                      selectedReciter?.name ||
                      'مكتبة التلاوات والصوتيات'}
                  </h2>

                  <p className="mt-2 truncate text-lg font-bold text-white/80">
                    {player?.title || tabTitle[activeTab]}
                  </p>

                  <p className="mt-2 text-sm leading-7 text-white/60">
                    {player?.subtitle || tabDescription[activeTab]}
                  </p>

                  {player?.sourceName && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold">
                      <Radio size={15} className="text-mushaf-gold" />
                      {player.sourceName}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/50">القراء</p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(reciters.length)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/50">السور المتاحة</p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(availableSurahs.length)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/50">دون نت</p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(savedItems.length)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/50">الإذاعات</p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(radios.length)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-3xl border border-mushaf-border/30 bg-white p-4 shadow-sm">
              <button type="button" onClick={() => { setShowSaved((value) => !value); void loadOfflineIndex() }} className="flex w-full items-center justify-between gap-3 text-right font-black text-mushaf-teal" aria-expanded={showSaved}>
                <span className="flex items-center gap-2"><WifiOff size={20} /> المحفوظ على الجهاز ({arabicDigits(savedItems.length)})</span>
                <ChevronDown size={19} className={showSaved ? 'rotate-180' : ''} />
              </button>
              {showSaved && (savedItems.length ? (
                <div className="mt-4 grid max-h-[32rem] gap-3 overflow-y-auto sm:grid-cols-2">
                  {savedItems.map((item) => {
                    const identity = item.audioUrl || offlineKeyFor(item)
                    const active = player && (player.audioUrl || offlineKeyFor(player)) === identity
                    return <article key={identity} className="flex items-center gap-3 rounded-2xl bg-mushaf-paper p-3">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-mushaf-dark">{item.title}</p><p className="mt-1 truncate text-xs text-gray-500">{item.reciterName} · {item.subtitle}</p>{item.legacyOpaque && <p className="mt-1 text-[10px] text-amber-700">نسخة قديمة؛ إن تعذر تشغيلها أعد حفظها أثناء الاتصال.</p>}</div>
                      <button type="button" aria-label={`تشغيل ${item.title}`} onClick={() => active ? void togglePlayer() : void startPlayer(item, savedItems, savedItems.indexOf(item), true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mushaf-teal text-white">{active && isPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
                      <button type="button" aria-label={`حذف النسخة المحفوظة من ${item.title}`} disabled={zipBusy || offlineBusyKey !== null} onClick={() => void removeOfflinePlayer(item)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-mushaf-gold disabled:opacity-40"><Trash2 size={16} /></button>
                    </article>
                  })}
                </div>
              ) : <p className="mt-4 text-sm leading-7 text-gray-500">لا توجد ملفات ظاهرة في المخزن. اتصل بالإنترنت، واختر تسجيلًا ثم اضغط «حفظ دون نت». النسخ القديمة لم تُحذف.</p>)}
            </section>

      {player && (
        <div className="sticky top-[4.75rem] z-40 mt-5">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-mushaf-gold/30 bg-gradient-to-br from-[#175E67] via-[#124A51] to-[#0D383E] text-white shadow-[0_24px_80px_rgba(13,56,62,0.42)]">
            <div className="border-b border-white/10 px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                  <ListMusic size={14} />
                  <span>
                    {queue.length
                      ? `${arabicDigits(queueIndex + 1)} من ${arabicDigits(
                          queue.length
                        )}`
                      : 'المشغل'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentOffline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mushaf-gold/15 px-2 py-1 text-[10px] font-black text-mushaf-gold">
                      <WifiOff size={12} />
                      دون إنترنت
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowMorePlayer((value) => !value)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                    aria-label="خيارات المشغل"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={closePlayer}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                    aria-label="إغلاق المشغل"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <AudioAvatar size="player" playing={isPlaying} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-mushaf-gold">
                    {player.reciterName}
                  </p>
                  <p className="mt-1 truncate text-base font-black sm:text-lg">
                    {player.title}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-white/50">
                    {player.subtitle}
                  </p>
                </div>

                <div className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => void goQueue(-1)}
                    disabled={!queue.length}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
                    title="السابق"
                  >
                    <SkipBack size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void togglePlayer()}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-mushaf-teal shadow-lg"
                    title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  >
                    {isPlaying ? (
                      <Pause size={21} fill="currentColor" />
                    ) : (
                      <Play size={21} fill="currentColor" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void goQueue(1)}
                    disabled={!queue.length}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
                    title="التالي"
                  >
                    <SkipForward size={17} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void togglePlayer()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-mushaf-teal shadow-lg sm:hidden"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                >
                  {isPlaying ? (
                    <Pause size={21} fill="currentColor" />
                  ) : (
                    <Play size={21} fill="currentColor" />
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="w-12 text-center text-[10px] font-bold text-white/50">
                  {formatDuration(progress)}
                </span>

                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(progress, duration || 0)}
                  onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => seekTo(Number(event.target.value))}
                  disabled={!duration}
                  className="w-full accent-[var(--mushaf-gold,#D97706)]"
                  aria-label="تقدم الملف"
                />

                <span className="w-12 text-center text-[10px] font-bold text-white/50">
                  {formatDuration(duration)}
                </span>
              </div>

              {showMorePlayer && (
                <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      سرعة التشغيل
                    </p>
                    <select
                      value={playbackRate}
                      onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
                        setPlaybackRate(Number(event.target.value))
                      }
                      className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-black text-white outline-none"
                    >
                      {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <option key={rate} value={rate} className="text-black">
                          {rate}x
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      التكرار
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setRepeatMode((current) =>
                          current === 'off'
                            ? 'one'
                            : current === 'one'
                              ? 'all'
                              : 'off'
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black"
                    >
                      {repeatMode === 'off'
                        ? 'بدون تكرار'
                        : repeatMode === 'one'
                          ? 'تكرار الملف'
                          : 'تكرار القائمة'}
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      الصوت
                    </p>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2">
                      <button
                        type="button"
                        onClick={() => setIsMuted((value) => !value)}
                        className="flex h-9 w-9 items-center justify-center"
                        aria-label="كتم الصوت"
                      >
                        {isMuted ? (
                          <VolumeX size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
                          setVolume(Number(event.target.value))
                          setIsMuted(false)
                        }}
                        className="w-full accent-[var(--mushaf-gold,#D97706)]"
                        aria-label="مستوى الصوت"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      دون إنترنت
                    </p>
                    <button
                      type="button"
                      disabled={!!player.isStream || zipBusy || offlineBusyKey !== null}
                      onClick={() =>
                        currentOffline
                          ? void removeOfflinePlayer(player)
                          : void saveOfflinePlayer(player)
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black disabled:opacity-35"
                    >
                      {offlineBusyKey === offlineKeyFor(player) ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : currentOffline ? (
                        <Trash2 size={15} />
                      ) : (
                        <WifiOff size={15} />
                      )}

                      {currentOffline ? 'حذف النسخة' : 'حفظ دون نت'}
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      تنزيل
                    </p>
                    <button
                      type="button"
                      disabled={!!player.isStream}
                      onClick={() =>
                        void downloadDirect(
                          player.audioUrl,
                          `${player.title} - ${player.reciterName}`,
                          !!player.isStream
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black disabled:opacity-35"
                    >
                      <ArrowDownToLine size={15} />
                      تنزيل الملف
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

            <section className="mt-6">
              <div className="grid gap-2 rounded-3xl border border-mushaf-border/35 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ['quran', 'القرآن الكريم'],
                    ['ruqyah', 'الرُّقية الشرعية'],
                    ['khutbah', 'الخطب والدروس'],
                    ['sunnah', 'كتب السنة'],
                  ] as Array<[TabKey, string]>
                ).map(([tab, label]) => {
                  const active = activeTab === tab

                  return (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => {
                        libraryRequestRef.current += 1
                        setLibraryLoading(false)
                        setActiveTab(tab)
                        setSearch('')
                        setShowRiwayat(false)
                        setShowReciters(false)
                        setShowSurahs(false)

                        if (tab !== 'quran') {
                          setSelectedSunnahBookId(null)
                          setLibraryItems([])
                          void loadLibraryContent(tab)
                        }
                      }}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                        active
                          ? 'bg-mushaf-teal text-white shadow-md'
                          : 'text-mushaf-dark hover:bg-mushaf-paper'
                      }`}
                    >
                      <SectionIcon type={tab} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </section>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
                {error}
                <button type="button" onClick={() => void loadBaseLibrary()} className="mr-3 underline">إعادة تحميل القوائم</button>
              </div>
            )}

            {activeTab === 'quran' ? (
              <>
                <section className="mt-7 rounded-3xl border border-mushaf-border/35 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-mushaf-dark">
                        القرآن الكريم
                      </h2>
                      <p className="mt-1 text-xs text-gray-500">
                        اختر الرواية ← القارئ ← السورة، ثم اختر التشغيل أو التنزيل أو الحفظ دون إنترنت.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        icon={
                          zipBusy ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <FileArchive size={16} />
                          )
                        }
                        label={
                          zipBusy
                            ? `جاري التجهيز ${arabicDigits(
                                quranZipProgress
                              )}%`
                            : 'تحميل المصحف ZIP'
                        }
                        onClick={downloadQuranZip}
                        disabled={
                          zipBusy ||
                          !selectedReciter ||
                          !selectedMoshaf ||
                          !availableSurahs.length
                        }
                      />
                      <ActionButton
                        icon={<WifiOff size={16} />}
                        label="حفظ المصحف دون نت"
                        onClick={saveWholeQuranOffline}
                        disabled={
                          zipBusy ||
                          !selectedReciter ||
                          !selectedMoshaf ||
                          !availableSurahs.length
                        }
                      />
                    </div>
                  </div>

                  {zipBusy && quranZipProgress > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
                        <span>تجهيز ملفات الصوت</span>
                        <span>{arabicDigits(quranZipProgress)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-mushaf-paper">
                        <div
                          className="h-full rounded-full bg-mushaf-gold transition-all"
                          style={{ width: `${quranZipProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mushaf-teal font-black text-white">
                        ١
                      </div>
                      <div>
                        <h2 className="font-black text-mushaf-dark">اختر الرواية</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          الروايات المتاحة في المصدر الصوتي
                        </p>
                      </div>
                    </div>

                    {selectedRiwaya && (
                      <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
                        {selectedRiwaya.name}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRiwayat((value) => !value)
                      setShowReciters(false)
                      setShowSurahs(false)
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-right shadow-sm transition ${
                      showRiwayat
                        ? 'border-mushaf-teal ring-2 ring-mushaf-teal/10'
                        : 'border-mushaf-border/40 hover:border-mushaf-teal'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mushaf-gold/20 bg-mushaf-paper text-mushaf-gold">
                        <BookOpen size={23} />
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-bold text-gray-400">الرواية</p>
                        <p className="truncate font-black text-mushaf-dark">
                          {selectedRiwaya?.name || 'اختر الرواية'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={21}
                      className={`text-mushaf-teal transition ${
                        showRiwayat ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showRiwayat && (
                    <div className="mt-3 rounded-3xl border border-mushaf-border/40 bg-white p-3 shadow-lg">
                      <div className="relative mb-3">
                        <Search
                          size={18}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          value={riwayaSearch}
                          onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setRiwayaSearch(event.target.value)}
                          placeholder="ابحث عن رواية..."
                          className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none"
                        />
                      </div>

                      <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                        {filteredRiwayat.map((riwaya) => {
                          const active = selectedRiwaya?.id === riwaya.id

                          return (
                            <button
                              type="button"
                              key={riwaya.id}
                              onClick={() => selectRiwaya(riwaya)}
                              className={`flex items-center justify-between gap-2 rounded-2xl border p-3 text-right transition ${
                                active
                                  ? 'border-mushaf-teal bg-mushaf-teal text-white shadow-md'
                                  : 'border-mushaf-border/30 bg-white text-mushaf-dark hover:border-mushaf-teal hover:bg-mushaf-teal/5'
                              }`}
                            >
                              <span className="text-sm font-bold leading-relaxed">
                                {riwaya.name}
                              </span>
                              {active && <Check size={18} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>

                <section className="mt-7">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black ${
                          selectedRiwaya
                            ? 'bg-mushaf-gold text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        ٢
                      </div>
                      <div>
                        <h2 className="font-black text-mushaf-dark">اختر القارئ</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          يتم عرض القراء الذين لديهم تسجيل فعلي لهذه الرواية
                        </p>
                      </div>
                    </div>

                    {selectedReciter && (
                      <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
                        {arabicDigits(reciters.length)} قارئ
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedRiwaya || recitersLoading}
                    onClick={() => {
                      setShowReciters((value) => !value)
                      setShowRiwayat(false)
                      setShowSurahs(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mushaf-border/40 bg-white p-4 text-right shadow-sm transition hover:border-mushaf-teal disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-12 shrink-0">
                        <AudioAvatar size="sm" playing={isPlaying} />
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-bold text-gray-400">القارئ</p>
                        <p className="truncate font-black text-mushaf-dark">
                          {recitersLoading
                            ? 'جاري تحميل القراء...'
                            : selectedReciter?.name || 'اختر القارئ'}
                        </p>
                      </div>
                    </div>

                    {recitersLoading ? (
                      <Loader2 className="animate-spin text-mushaf-teal" size={20} />
                    ) : (
                      <ChevronDown
                        size={21}
                        className={`text-mushaf-teal transition ${
                          showReciters ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>

                  {showReciters && selectedRiwaya && (
                    <div className="mt-3 rounded-3xl border border-mushaf-border/40 bg-white p-3 shadow-lg">
                      <div className="relative mb-3">
                        <Search
                          size={18}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          value={search}
                          onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSearch(event.target.value)}
                          placeholder="ابحث باسم الشيخ..."
                          className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none"
                        />
                      </div>

                      <div className="grid max-h-[560px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
                        {visibleReciters.map((reciter) => {
                          const active = selectedReciter?.id === reciter.id

                          return (
                            <div
                              key={reciter.id}
                              className={`rounded-3xl border bg-white p-3 transition-all ${
                                active
                                  ? 'border-mushaf-gold shadow-lg ring-2 ring-mushaf-gold/10'
                                  : 'border-mushaf-border/30 hover:border-mushaf-teal hover:shadow-md'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => selectReciter(reciter)}
                                className="w-full text-right"
                              >
                                <div className="relative aspect-square overflow-hidden rounded-2xl bg-mushaf-paper">
                                  <AudioAvatar
                                    playing={active && isPlaying}
                                    size="md"
                                  />
                                  {active && (
                                    <div className="absolute inset-0 flex items-end justify-start bg-mushaf-teal/15 p-2">
                                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mushaf-teal text-white shadow-lg">
                                        <Check size={18} />
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <p className="mt-3 line-clamp-2 font-black text-sm text-mushaf-dark">
                                  {reciter.name}
                                </p>
                              </button>
                            </div>
                          )
                        })}
                      </div>

                      {visibleReciters.length === 0 && (
                        <div className="py-10 text-center font-bold text-gray-400">
                          لا يوجد قارئ بهذا الاسم.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="mt-7">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black ${
                          selectedReciter
                            ? 'bg-mushaf-teal text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        ٣
                      </div>
                      <div>
                        <h2 className="font-black text-mushaf-dark">السور</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          تشغيل • تنزيل • حفظ دون إنترنت
                        </p>
                      </div>
                    </div>

                    {selectedMoshaf && (
                      <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
                        {arabicDigits(availableSurahs.length)} سورة
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedReciter || !selectedMoshaf}
                    onClick={() => {
                      setShowSurahs((value) => !value)
                      setShowReciters(false)
                      setShowRiwayat(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mushaf-border/40 bg-white p-4 text-right shadow-sm transition hover:border-mushaf-teal disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mushaf-gold/20 bg-mushaf-paper text-mushaf-gold">
                        <BookOpen size={23} />
                      </div>

                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-bold text-gray-400">السورة</p>
                        <p className="truncate font-black text-mushaf-dark">
                          {selectedSurah?.name || 'اختر السورة'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={21}
                      className={`text-mushaf-teal transition ${
                        showSurahs ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showSurahs && selectedReciter && selectedMoshaf && (
                    <div className="mt-3 rounded-3xl border border-mushaf-border/40 bg-white p-3 shadow-lg">
                      <div className="relative mb-3">
                        <Search
                          size={18}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          value={surahSearch}
                          onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSurahSearch(event.target.value)}
                          placeholder="ابحث باسم السورة..."
                          className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleSurahs.map((surah) => {
                          const active = selectedSurah?.id === surah.id
                          const playing =
                            player?.kind === 'quran' &&
                            player.surahId === surah.id &&
                            player.reciterId === selectedReciter.id

                          const currentItem = quranQueue.find(
                            (entry) => entry.surahId === surah.id
                          )

                          const currentKey = currentItem
                            ? offlineKeyFor(currentItem)
                            : ''

                          const saved = !!currentKey && (offlineKeys.has(currentKey) || sharedQuranUrls.has(currentItem?.audioUrl || ''))
                          const busy = offlineBusyKey === currentKey

                          return (
                            <div
                              key={surah.id}
                              className={`rounded-2xl border p-3 transition ${
                                active
                                  ? 'border-mushaf-gold bg-mushaf-gold/5 shadow-md'
                                  : 'border-mushaf-border/30 bg-white hover:border-mushaf-teal'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => void playSurah(surah)}
                                  className="flex min-w-0 flex-1 items-center gap-3 text-right"
                                >
                                  <div
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                      active
                                        ? 'bg-mushaf-gold text-white'
                                        : 'bg-mushaf-paper text-mushaf-teal'
                                    }`}
                                  >
                                    {arabicDigits(surah.id)}
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate font-black text-mushaf-dark">
                                      {surah.name}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-400">
                                      {surah.makkia ? 'مكية' : 'مدنية'}
                                    </p>
                                  </div>
                                </button>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void playSurah(surah)}
                                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                      playing && isPlaying
                                        ? 'bg-mushaf-teal text-white'
                                        : 'bg-mushaf-paper text-mushaf-teal'
                                    }`}
                                    title="تشغيل"
                                  >
                                    {playing && isPlaying ? (
                                      <Pause size={17} fill="currentColor" />
                                    ) : (
                                      <Play size={17} fill="currentColor" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!currentItem) return
                                      void downloadDirect(
                                        currentItem.audioUrl,
                                        `${surah.name} - ${selectedReciter?.name}`
                                      )
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-mushaf-paper text-mushaf-gold"
                                    title="تنزيل على الجهاز"
                                  >
                                    <Download size={17} />
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy || zipBusy || offlineBusyKey !== null}
                                    onClick={() => {
                                      if (!currentItem) return

                                      if (saved) {
                                        void removeOfflinePlayer(currentItem)
                                      } else {
                                        void saveOfflinePlayer(currentItem)
                                      }
                                    }}
                                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                      saved
                                        ? 'bg-mushaf-gold text-white'
                                        : 'bg-mushaf-paper text-mushaf-teal'
                                    }`}
                                    title={saved ? 'محفوظ دون إنترنت' : 'حفظ دون إنترنت'}
                                  >
                                    {busy ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : saved ? (
                                      <Check size={16} />
                                    ) : (
                                      <WifiOff size={16} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                {activeTab === 'ruqyah' && (
                  <section className="mt-7">
                    <div className="rounded-[2rem] border border-mushaf-gold/20 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs font-black text-mushaf-gold">مكتبة الرُّقية الشرعية</p>
                          <h2 className="mt-1 text-2xl font-black text-mushaf-dark">اختر قارئ الرقية</h2>
                          <p className="mt-2 text-sm leading-7 text-gray-500">
                            تسجيلات بشرية منشورة مجانًا من مصدر Quran TV، مع اختيار قارئ مستقل وتشغيله مباشرة من مشغل سميع العلوي.
                          </p>
                        </div>
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-mushaf-paper text-mushaf-gold">
                          <Sparkles size={30} />
                        </div>
                      </div>
                    </div>

                    {libraryLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-mushaf-teal">
                        <Loader2 size={36} className="animate-spin" />
                        <p className="font-black">جاري تحميل القراء...</p>
                      </div>
                    ) : libraryUnavailable ? (
                      <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-7 text-center">
                        <p className="font-black text-amber-800">{libraryError || 'تعذر تحميل الرقية حاليًا.'}</p>
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {libraryItems.filter((item) => item.section === 'ruqyah').map((item) => {
                          const active = selectedRuqyahId === item.id
                          const playing = player?.kind === 'library' && player.libraryId === item.id
                          return (
                            <article
                              key={item.id}
                              className={`group overflow-hidden rounded-[1.8rem] border bg-white p-4 shadow-sm transition ${
                                active ? 'border-mushaf-gold ring-2 ring-mushaf-gold/10' : 'border-mushaf-border/30 hover:border-mushaf-teal'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedRuqyahId(item.id)}
                                className="w-full text-right"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-16 w-16 shrink-0">
                                    <AudioAvatar size="player" playing={playing && isPlaying} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-mushaf-gold">رقية شرعية</p>
                                    <h3 className="mt-1 truncate text-base font-black text-mushaf-dark">{item.authorName || item.subtitle}</h3>
                                    <p className="mt-1 text-[11px] text-gray-400">تسجيل مجاني منشور</p>
                                  </div>
                                </div>
                              </button>
                              <div className="mt-4 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void playLibraryItem(item)}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-mushaf-teal py-3 text-xs font-black text-white"
                                >
                                  {playing && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                  {playing && isPlaying ? 'إيقاف' : 'تشغيل الرقية'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void downloadDirect(item.audioUrl, `الرقية الشرعية - ${item.authorName || item.subtitle}`)}
                                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mushaf-paper text-mushaf-gold"
                                  title="تنزيل"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}

                    {!libraryLoading && !libraryUnavailable && selectedRuqyahId && (
                      <div className="mt-4 rounded-2xl border border-mushaf-teal/10 bg-mushaf-teal/5 px-4 py-3 text-xs font-bold text-mushaf-teal">
                        القارئ المحدد: {libraryItems.find((item) => item.id === selectedRuqyahId)?.authorName || '—'} — اضغط تشغيل لبدء الرقية.
                      </div>
                    )}
                  </section>
                )}

                {activeTab === 'sunnah' && (
                  <section className="mt-7">
                    <div className="rounded-[2rem] border border-mushaf-gold/20 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-xs font-black text-mushaf-gold">موسوعة السنة الصوتية</p>
                          <h2 className="mt-1 text-2xl font-black text-mushaf-dark">كتب الحديث المتاحة صوتيًا</h2>
                          <p className="mt-2 text-sm leading-7 text-gray-500">
                            تضم المكتبة مجموعات حديثية مجانية متاحة عبر Hadith.to، ومعها مواد صوتية إضافية من المصادر المفتوحة عندما تكون متوفرة.
                          </p>
                        </div>
                        {selectedSunnahBookId && (
                          <button
                            type="button"
                            onClick={() => { libraryRequestRef.current += 1; setLibraryLoading(false); setSelectedSunnahBookId(null); setLibraryItems([]); setSunnahHasMore(false); setSunnahNextStart(1) }}
                            className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-paper px-4 py-3 text-xs font-black text-mushaf-teal"
                          >
                            <ArrowRight size={16} /> كل الكتب
                          </button>
                        )}
                      </div>
                    </div>

                    {libraryLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-mushaf-teal">
                        <Loader2 size={36} className="animate-spin" />
                        <p className="font-black">جاري تجهيز المكتبة الصوتية...</p>
                      </div>
                    ) : libraryUnavailable ? (
                      <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-7 text-center">
                        <p className="font-black text-amber-800">{libraryError || 'تعذر تحميل كتب السنة.'}</p>
                      </div>
                    ) : !selectedSunnahBookId ? (
                      <>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sunnahBooks.map((book) => (
                          <button
                            key={book.id}
                            type="button"
                            onClick={() => { setSelectedSunnahBookId(book.id); setSearch(''); setSunnahNextStart(1); setSunnahHasMore(false); void loadLibraryContent('sunnah', book.id, 1, false) }}
                            className="rounded-[1.8rem] border border-mushaf-border/30 bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-mushaf-teal hover:shadow-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mushaf-paper text-mushaf-gold">
                                <BookOpen size={25} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-black text-mushaf-dark">{book.name}</h3>
                                <p className="mt-1 text-[11px] text-gray-400">{book.records ? `${arabicDigits(book.records)} حديث` : 'مجموعة حديثية'}</p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full bg-mushaf-teal/10 px-2.5 py-1 text-[10px] font-black text-mushaf-teal">مصدر مجاني</span>
                              {book.synthetic && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">صوت مُولَّد</span>}
                            </div>
                          </button>
                        ))}
                      </div>

                      {sunnahExtras.length > 0 && (
                        <div className="mt-7">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-mushaf-gold">مصادر إضافية</p>
                              <h3 className="mt-1 font-black text-mushaf-dark">سلاسل وقراءات حديثية مجانية</h3>
                            </div>
                            <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">{arabicDigits(sunnahExtras.length)} مادة</span>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            {sunnahExtras.slice(0, 60).map((item) => (
                              <div key={item.id} className="rounded-3xl border border-mushaf-border/30 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="h-14 w-14 shrink-0"><AudioAvatar size="player" playing={player?.kind === 'library' && player.libraryId === item.id && isPlaying} /></div>
                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 font-black text-mushaf-dark">{item.title}</p>
                                    <p className="mt-1 truncate text-xs text-mushaf-teal">{item.authorName || item.subtitle}</p>
                                  </div>
                                  <button type="button" onClick={() => void playLibraryItem(item)} className="flex h-11 w-11 items-center justify-center rounded-full bg-mushaf-teal text-white"><Play size={17} fill="currentColor" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      </>
                    ) : (
                      <>
                        <div className="mt-5">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-400">الكتاب المحدد</p>
                            <h3 className="mt-1 text-xl font-black text-mushaf-dark">{sunnahBooks.find((book) => book.id === selectedSunnahBookId)?.name || selectedSunnahBookId}</h3>
                          </div>
                          <div className="relative w-full sm:max-w-sm">
                            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSearch(event.target.value)} placeholder="ابحث في الأحاديث الصوتية..." className="w-full rounded-2xl bg-white py-3 pl-4 pr-11 text-sm font-bold outline-none border border-mushaf-border/30" />
                          </div>
                        </div>

                        {filteredLibraryItems.length === 0 ? (
                          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
                            <Headphones size={30} className="mx-auto text-mushaf-teal" />
                            <p className="mt-3 font-black text-mushaf-dark">لا يوجد صوت مستقل متاح في هذه المجموعة حاليًا.</p>
                            <p className="mt-2 text-xs leading-6 text-gray-400">يمكنك فتح المجموعة الأخرى والعودة إلى قائمة الكتب.</p>
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-3 lg:grid-cols-2">
                            {filteredLibraryItems.map((item) => {
                              const playing = player?.kind === 'library' && player.libraryId === item.id
                              const libraryPlayer: PlayerItem = { kind: 'library', title: item.title, subtitle: item.subtitle, audioUrl: item.audioUrl, reciterName: item.authorName || 'رواية صوتية', libraryId: item.id, sourceName: item.sourceName, isStream: false }
                              const saved = offlineKeys.has(offlineKeyFor(libraryPlayer))
                              const busy = offlineBusyKey === offlineKeyFor(libraryPlayer)
                              return (
                                <article key={item.id} className={`rounded-3xl border bg-white p-4 shadow-sm transition ${playing ? 'border-mushaf-gold ring-2 ring-mushaf-gold/10' : 'border-mushaf-border/30'}`}>
                                  <div className="flex items-center gap-3">
                                    <div className="h-14 w-14 shrink-0"><AudioAvatar size="player" playing={playing && isPlaying} /></div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="line-clamp-2 font-black text-mushaf-dark">{item.title}</h4>
                                      <p className="mt-1 text-xs font-bold text-mushaf-teal">حديث {arabicDigits(item.record || 0)}</p>
                                    </div>
                                    <button type="button" onClick={() => void playLibraryItem(item)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mushaf-teal text-white">{playing && isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
                                  </div>
                                  <div className="mt-3 flex gap-2">
                                    <button type="button" onClick={() => void downloadDirect(item.audioUrl, item.title)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-mushaf-paper py-2.5 text-xs font-black text-mushaf-gold"><Download size={15} /> تنزيل</button>
                                    <button type="button" disabled={busy || zipBusy || offlineBusyKey !== null} onClick={() => saved ? void removeOfflinePlayer(libraryPlayer) : void saveOfflinePlayer(libraryPlayer)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black ${saved ? 'bg-mushaf-gold text-white' : 'bg-mushaf-paper text-mushaf-teal'}`}><WifiOff size={15} /> {saved ? 'محفوظ دون نت' : 'حفظ دون نت'}</button>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                            {sunnahHasMore && (
                              <button
                              type="button"
                              onClick={() => void loadLibraryContent('sunnah', selectedSunnahBookId || undefined, sunnahNextStart, true)}
                              disabled={libraryLoading}
                              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-mushaf-border/30 bg-white py-3 text-sm font-black text-mushaf-teal disabled:opacity-50"
                            >
                              {libraryLoading ? <Loader2 size={17} className="animate-spin" /> : <ChevronDown size={17} />}
                              {libraryLoading ? 'جاري تحميل المزيد...' : 'تحميل ٥٠ حديثًا إضافيًا'}
                              </button>
                            )}
                          </>
                        )}
                        </div>
                      </>
                    )}
                  </section>
                )}

                {activeTab === 'khutbah' && (
                  <section className="mt-7">
                    <div className="rounded-[2rem] border border-mushaf-gold/20 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-xs font-black text-mushaf-gold">أرشيف الخطب</p>
                          <h2 className="mt-1 text-2xl font-black text-mushaf-dark">مكتبة الخطب والدروس الصوتية</h2>
                          <p className="mt-2 text-sm leading-7 text-gray-500">
                            أرشيف واسع من خطب الجمعة مع ملفات MP3 عربية متاحة مجانًا عبر المصادر المفتوحة، مع الاحتفاظ برابط المصدر لكل مادة.
                          </p>
                        </div>
                        <div className="relative w-full lg:max-w-sm">
                          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={search} onChange={(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSearch(event.target.value)} placeholder="ابحث بعنوان الخطبة..." className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none" />
                        </div>
                      </div>
                    </div>

                    {libraryLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-mushaf-teal">
                        <Loader2 size={36} className="animate-spin" />
                        <p className="font-black">جاري تحميل أرشيف الخطب...</p>
                      </div>
                    ) : libraryUnavailable ? (
                      <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-7 text-center">
                        <p className="font-black text-amber-800">{libraryError || 'تعذر تحميل الخطب حاليًا.'}</p>
                      </div>
                    ) : filteredLibraryItems.length === 0 ? (
                      <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
                        <Headphones size={30} className="mx-auto text-mushaf-teal" />
                        <p className="mt-3 font-black text-mushaf-dark">لا توجد خطب مطابقة للبحث.</p>
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3 lg:grid-cols-2">
                        {filteredLibraryItems.map((item) => {
                          const libraryPlayer: PlayerItem = { kind: 'library', title: item.title, subtitle: item.subtitle, audioUrl: item.audioUrl, reciterName: item.authorName || 'تسجيل صوتي', libraryId: item.id, sourceName: item.sourceName, isStream: false }
                          const playing = player?.kind === 'library' && player.libraryId === item.id
                          const saved = offlineKeys.has(offlineKeyFor(libraryPlayer))
                          const busy = offlineBusyKey === offlineKeyFor(libraryPlayer)
                          return (
                            <article key={item.id} className={`rounded-3xl border bg-white p-4 shadow-sm ${playing ? 'border-mushaf-gold ring-2 ring-mushaf-gold/10' : 'border-mushaf-border/30'}`}>
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 shrink-0"><AudioAvatar size="player" playing={playing && isPlaying} /></div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="line-clamp-2 font-black text-mushaf-dark">{item.title}</h3>
                                  <p className="mt-1 truncate text-xs font-bold text-mushaf-teal">{item.authorName || item.subtitle}</p>
                                  <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400"><Clock3 size={12} />{formatDuration(item.duration)}<span>•</span>{item.sourceName}</div>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-4 gap-2">
                                <button type="button" onClick={() => void playLibraryItem(item)} className="flex items-center justify-center gap-1 rounded-xl bg-mushaf-teal py-2.5 text-white text-xs font-black col-span-2">{playing && isPlaying ? <Pause size={15} /> : <Play size={15} />} تشغيل</button>
                                <button type="button" onClick={() => void downloadDirect(item.audioUrl, item.title)} className="flex items-center justify-center rounded-xl bg-mushaf-paper text-mushaf-gold" title="تنزيل"><Download size={15} /></button>
                                <button type="button" disabled={busy || zipBusy || offlineBusyKey !== null} onClick={() => saved ? void removeOfflinePlayer(libraryPlayer) : void saveOfflinePlayer(libraryPlayer)} className={`flex items-center justify-center rounded-xl ${saved ? 'bg-mushaf-gold text-white' : 'bg-mushaf-paper text-mushaf-teal'}`} title={saved ? 'حذف النسخة' : 'حفظ دون إنترنت'}>{saved ? <Check size={15} /> : <WifiOff size={15} />}</button>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-mushaf-gold/20 bg-[#0D383E] px-5 py-3 text-center text-sm font-black text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}
