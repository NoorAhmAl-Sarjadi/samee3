'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileArchive,
  Headphones,
  Library,
  ListMusic,
  Loader2,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
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

type LibrarySection = 'ruqyah' | 'khutbah' | 'sunnah'

type LibraryAudio = {
  id: string
  title: string
  subtitle: string
  audioUrl: string
  sourceName: string
  sourceUrl: string
  authorName?: string
  section: LibrarySection
  duration?: number
  downloadable?: boolean
}

type PlayerItem = {
  kind: 'quran' | 'library'
  title: string
  subtitle: string
  audioUrl: string
  reciterName: string
  surahId?: number
  reciterId?: number
  riwayaId?: number
  libraryId?: string
  sourceName?: string
  sourceUrl?: string
}

type OfflineRecord = {
  key: string
  title: string
  subtitle: string
  blob: Blob
  savedAt: number
}

type TabKey = 'quran' | 'ruqyah' | 'khutbah' | 'sunnah'

type NonQuranTab = Exclude<TabKey, 'quran'>

const MP3QURAN_API = 'https://mp3quran.net/api/v3'
const AUDIO_LIBRARY_API = '/api/audio-library'

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
  return String(value).replace(
    /\d/g,
    (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]
  )
}

function formatDuration(seconds: number | undefined) {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return '٠٠:٠٠'
  }

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${arabicDigits(String(mins).padStart(2, '0'))}:${arabicDigits(
    String(secs).padStart(2, '0')
  )}`
}

function getMoshafForRiwaya(
  reciter: Reciter,
  riwayaName: string
) {
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

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', {
          keyPath: 'key',
        })
      }
    }

    request.onsuccess = () => resolve(request.result)

    request.onerror = () => reject(request.error)
  })
}

async function putOffline(record: OfflineRecord) {
  const db = await getOfflineDb()

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('audio', 'readwrite')

    transaction.objectStore('audio').put(record)

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }

    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

async function getOffline(key: string) {
  const db = await getOfflineDb()

  return new Promise<OfflineRecord | null>((resolve, reject) => {
    const transaction = db.transaction('audio', 'readonly')
    const request = transaction.objectStore('audio').get(key)

    request.onsuccess = () => {
      db.close()

      resolve(
        (request.result as OfflineRecord | undefined) || null
      )
    }

    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

async function deleteOffline(key: string) {
  const db = await getOfflineDb()

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('audio', 'readwrite')

    transaction.objectStore('audio').delete(key)

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }

    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

async function listOffline() {
  const db = await getOfflineDb()

  return new Promise<OfflineRecord[]>((resolve, reject) => {
    const transaction = db.transaction('audio', 'readonly')
    const request = transaction.objectStore('audio').getAll()

    request.onsuccess = () => {
      db.close()

      resolve(
        (request.result as OfflineRecord[]) || []
      )
    }

    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function AudioAvatar({
  size = 'md',
  playing = false,
}: {
  size?: 'sm' | 'md' | 'lg' | 'player'
  playing?: boolean
}) {
  const sizeClass = {
    sm: 'h-12 w-12 rounded-2xl',
    md: 'h-full w-full rounded-2xl',
    lg: 'h-28 w-28 rounded-full sm:h-36 sm:w-36',
    player: 'h-14 w-14 rounded-2xl sm:h-16 sm:w-16',
  }[size]

  const iconSize = {
    sm: 20,
    md: 32,
    lg: 42,
    player: 24,
  }[size]

  return (
    <div
      className={`${sizeClass} relative flex items-center justify-center overflow-hidden border border-mushaf-gold/30 bg-gradient-to-br from-[#1D6168] via-[#114B52] to-[#0A3036] shadow-lg`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.20),transparent_62%)]" />

      <div className="relative z-10 flex flex-col items-center justify-center gap-1">
        <Headphones
          size={iconSize}
          className="text-mushaf-gold"
          strokeWidth={1.7}
        />

        <div className="mt-1 flex h-4 items-end gap-[3px]">
          {[8, 13, 18, 11, 16, 9, 14].map(
            (height, index) => (
              <span
                key={index}
                className={`w-[3px] rounded-full bg-white/90 ${
                  playing ? 'animate-pulse' : ''
                }`}
                style={{
                  height: `${height}px`,
                  animationDelay: `${index * 80}ms`,
                }}
              />
            )
          )}
        </div>
      </div>

      {playing && (
        <div className="absolute inset-0 rounded-[inherit] ring-2 ring-mushaf-gold/50 animate-pulse" />
      )}
    </div>
  )
}

function SectionIcon({
  type,
}: {
  type: TabKey
}) {
  if (type === 'quran') {
    return <BookOpen size={19} />
  }

  if (type === 'ruqyah') {
    return <Sparkles size={19} />
  }

  if (type === 'khutbah') {
    return <Mic2 size={19} />
  }

  return <Library size={19} />
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
      className="inline-flex items-center gap-2 rounded-2xl border border-mushaf-border/40 bg-white px-3.5 py-2.5 text-xs font-black text-mushaf-dark shadow-sm transition hover:-translate-y-0.5 hover:border-mushaf-teal hover:text-mushaf-teal disabled:cursor-not-allowed disabled:opacity-40"
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">
        {label}
      </span>
    </button>
  )
}

export default function AudioPage() {
  const [riwayat, setRiwayat] = useState<Riwaya[]>([])
  const [reciters, setReciters] = useState<Reciter[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])

  const [libraryItems, setLibraryItems] =
    useState<LibraryAudio[]>([])

  const [libraryLoaded, setLibraryLoaded] =
    useState<Record<NonQuranTab, boolean>>({
      ruqyah: false,
      khutbah: false,
      sunnah: false,
    })

  const [libraryLoading, setLibraryLoading] =
    useState<Record<NonQuranTab, boolean>>({
      ruqyah: false,
      khutbah: false,
      sunnah: false,
    })

  const [libraryError, setLibraryError] =
    useState<Record<NonQuranTab, string>>({
      ruqyah: '',
      khutbah: '',
      sunnah: '',
    })

  const [selectedRiwaya, setSelectedRiwaya] =
    useState<Riwaya | null>(null)

  const [selectedReciter, setSelectedReciter] =
    useState<Reciter | null>(null)

  const [selectedMoshaf, setSelectedMoshaf] =
    useState<Moshaf | null>(null)

  const [selectedSurah, setSelectedSurah] =
    useState<Surah | null>(null)

  const [activeTab, setActiveTab] =
    useState<TabKey>('quran')

  const [search, setSearch] = useState('')
  const [riwayaSearch, setRiwayaSearch] =
    useState('')
  const [surahSearch, setSurahSearch] =
    useState('')

  const [showRiwayat, setShowRiwayat] =
    useState(false)

  const [showReciters, setShowReciters] =
    useState(false)

  const [showSurahs, setShowSurahs] =
    useState(false)

  const [showMorePlayer, setShowMorePlayer] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [recitersLoading, setRecitersLoading] =
    useState(false)

  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [player, setPlayer] =
    useState<PlayerItem | null>(null)

  const [queue, setQueue] =
    useState<PlayerItem[]>([])

  const [queueIndex, setQueueIndex] =
    useState(-1)

  const [isPlaying, setIsPlaying] =
    useState(false)

  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const [playbackRate, setPlaybackRate] =
    useState(1)

  const [volume, setVolume] =
    useState(1)

  const [isMuted, setIsMuted] =
    useState(false)

  const [repeatMode, setRepeatMode] =
    useState<'off' | 'one' | 'all'>('off')

  const [offlineKeys, setOfflineKeys] =
    useState<Set<string>>(new Set())

  const [offlineBusyKey, setOfflineBusyKey] =
    useState<string | null>(null)

  const [zipBusy, setZipBusy] =
    useState(false)

  const [quranZipProgress, setQuranZipProgress] =
    useState(0)

  const audioRef =
    useRef<HTMLAudioElement | null>(null)

  const objectUrlRef =
    useRef<string | null>(null)

  const pendingPlayRef =
    useRef(false)

  const notify = useCallback(
    (message: string) => {
      setToast(message)

      window.setTimeout(
        () => setToast(''),
        2800
      )
    },
    []
  )

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(
        objectUrlRef.current
      )

      objectUrlRef.current = null
    }
  }, [])

  const loadOfflineIndex =
    useCallback(async () => {
      try {
        const records =
          await listOffline()

        setOfflineKeys(
          new Set(
            records.map(
              (record) => record.key
            )
          )
        )
      } catch (err) {
        console.warn(
          'Offline index load failed:',
          err
        )
      }
    }, [])

  const loadBaseLibrary =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const [
          riwayatData,
          surahsData,
        ] = await Promise.all([
          fetchJson<{ riwayat: Riwaya[] }>(
            `${MP3QURAN_API}/riwayat?language=ar`
          ),
          fetchJson<{ suwar: Surah[] }>(
            `${MP3QURAN_API}/suwar?language=ar`
          ),
        ])

        const nextRiwayat =
          Array.isArray(
            riwayatData.riwayat
          )
            ? riwayatData.riwayat
            : []

        const nextSurahs =
          Array.isArray(surahsData.suwar)
            ? surahsData.suwar
            : []

        const preferredRiwaya =
          nextRiwayat.find((item) =>
            normalizeArabic(
              item.name
            ).includes(
              normalizeArabic('حفص')
            )
          ) ||
          nextRiwayat[0] ||
          null

        setRiwayat(nextRiwayat)
        setSurahs(nextSurahs)
        setSelectedRiwaya(
          preferredRiwaya
        )
      } catch (err) {
        console.error(
          'Audio base library error:',
          err
        )

        setError(
          'تعذر تحميل مكتبة القرآن حاليًا.'
        )
      } finally {
        setLoading(false)
      }
    }, [])

  const loadLibraryContent =
    useCallback(
      async (tab: NonQuranTab) => {
        if (libraryLoaded[tab]) {
          return
        }

        setLibraryLoading(
          (current) => ({
            ...current,
            [tab]: true,
          })
        )

        setLibraryError(
          (current) => ({
            ...current,
            [tab]: '',
          })
        )

        try {
          const result =
            await fetchJson<{
              ok: boolean
              items?: LibraryAudio[]
              error?: string
            }>(
              `${AUDIO_LIBRARY_API}?section=${tab}`
            )

          if (!result.ok) {
            throw new Error(
              result.error ||
                'تعذر تحميل المصدر'
            )
          }

          const items = Array.isArray(
            result.items
          )
            ? result.items.filter(
                (item) =>
                  typeof item?.audioUrl ===
                    'string' &&
                  item.audioUrl
              )
            : []

          setLibraryItems((current) => {
            const merged = [
              ...current,
              ...items,
            ]

            const seen =
              new Set<string>()

            return merged.filter(
              (item) => {
                if (
                  seen.has(
                    item.id
                  )
                ) {
                  return false
                }

                seen.add(item.id)
                return true
              }
            )
          })

          setLibraryLoaded(
            (current) => ({
              ...current,
              [tab]: true,
            })
          )
        } catch (err) {
          console.error(
            `Library ${tab} error:`,
            err
          )

          setLibraryError(
            (current) => ({
              ...current,
              [tab]:
                'تعذر تحميل هذا المصدر حاليًا.',
            })
          )
        } finally {
          setLibraryLoading(
            (current) => ({
              ...current,
              [tab]: false,
            })
          )
        }
      },
      [libraryLoaded]
    )

  useEffect(() => {
    void loadBaseLibrary()
    void loadOfflineIndex()
  }, [
    loadBaseLibrary,
    loadOfflineIndex,
  ])

  useEffect(() => {
    if (!selectedRiwaya) {
      return
    }

    const riwayaId =
      selectedRiwaya.id

    let cancelled = false

    async function loadReciters() {
      setRecitersLoading(true)
      setError('')

      try {
        const result =
          await fetchJson<{
            reciters: Reciter[]
          }>(
            `${MP3QURAN_API}/reciters?language=ar&rewaya=${encodeURIComponent(
              riwayaId
            )}`
          )

        if (cancelled) {
          return
        }

        const nextReciters: Reciter[] =
          Array.isArray(
            result.reciters
          )
            ? result.reciters
                .filter(
                  (reciter) =>
                    Array.isArray(
                      reciter.moshaf
                    ) &&
                    reciter
                      .moshaf.length > 0
                )
                .map(
                  (
                    reciter
                  ) => ({
                    ...reciter,
                    moshaf:
                      reciter.moshaf.filter(
                        (moshaf) =>
                          typeof moshaf.server ===
                            'string' &&
                          typeof moshaf.surah_list ===
                            'string' &&
                          moshaf
                            .surah_list
                            .length > 0
                      ),
                  })
                )
                .filter(
                  (reciter) =>
                    reciter.moshaf
                      .length > 0
                )
            : []

        nextReciters.sort(
          (a, b) => {
            const aIndex =
              FAVORITE_RECITER_NAMES.findIndex(
                (name) =>
                  normalizeArabic(
                    a.name
                  ).includes(
                    normalizeArabic(
                      name
                    )
                  )
              )

            const bIndex =
              FAVORITE_RECITER_NAMES.findIndex(
                (name) =>
                  normalizeArabic(
                    b.name
                  ).includes(
                    normalizeArabic(
                      name
                    )
                  )
              )

            if (
              aIndex !== -1 &&
              bIndex === -1
            ) {
              return -1
            }

            if (
              aIndex === -1 &&
              bIndex !== -1
            ) {
              return 1
            }

            if (
              aIndex !== -1 &&
              bIndex !== -1
            ) {
              return (
                aIndex - bIndex
              )
            }

            return a.name.localeCompare(
              b.name,
              'ar'
            )
          }
        )

        setReciters(
          nextReciters
        )
      } catch (err) {
        console.error(
          'Reciters request error:',
          err
        )

        setReciters([])
        setError(
          'تعذر تحميل قراء الرواية المحددة.'
        )
      } finally {
        if (!cancelled) {
          setRecitersLoading(
            false
          )
        }
      }
    }

    void loadReciters()

    return () => {
      cancelled = true
    }
  }, [selectedRiwaya])

  useEffect(() => {
    if (
      activeTab === 'quran'
    ) {
      return
    }

    void loadLibraryContent(
      activeTab
    )
  }, [
    activeTab,
    loadLibraryContent,
  ])

  const supportedSurahIds =
    useMemo(() => {
      if (
        !selectedMoshaf?.surah_list
      ) {
        return new Set<number>()
      }

      return new Set(
        selectedMoshaf.surah_list
          .split(',')
          .map((item) =>
            Number(item.trim())
          )
          .filter(Boolean)
      )
    }, [selectedMoshaf])

  const availableSurahs =
    useMemo(
      () =>
        surahs.filter((surah) =>
          supportedSurahIds.has(
            surah.id
          )
        ),
      [
        surahs,
        supportedSurahIds,
      ]
    )

  const visibleReciters =
    useMemo(() => {
      const query =
        normalizeArabic(search)

      if (!query) {
        return reciters
      }

      return reciters.filter(
        (reciter) =>
          normalizeArabic(
            reciter.name
          ).includes(query)
      )
    }, [reciters, search])

  const filteredRiwayat =
    useMemo(() => {
      const query =
        normalizeArabic(
          riwayaSearch
        )

      if (!query) {
        return riwayat
      }

      return riwayat.filter(
        (item) =>
          normalizeArabic(
            item.name
          ).includes(query)
      )
    }, [riwayat, riwayaSearch])

  const visibleSurahs =
    useMemo(() => {
      const query =
        normalizeArabic(
          surahSearch
        )

      if (!query) {
        return availableSurahs
      }

      return availableSurahs.filter(
        (surah) =>
          normalizeArabic(
            surah.name
          ).includes(query) ||
          String(
            surah.id
          ).includes(query)
      )
    }, [
      availableSurahs,
      surahSearch,
    ])

  const filteredLibraryItems =
    useMemo(() => {
      const query =
        normalizeArabic(search)

      const sectionItems =
        libraryItems.filter(
          (item) =>
            item.section ===
            activeTab
        )

      if (!query) {
        return sectionItems
      }

      return sectionItems.filter(
        (item) =>
          normalizeArabic(
            `${item.title} ${item.subtitle} ${
              item.authorName || ''
            } ${item.sourceName}`
          ).includes(query)
      )
    }, [
      activeTab,
      libraryItems,
      search,
    ])

  const quranQueue =
    useMemo<PlayerItem[]>(() => {
      if (
        !selectedRiwaya ||
        !selectedReciter ||
        !selectedMoshaf
      ) {
        return []
      }

      return availableSurahs.map(
        (surah) => ({
          kind: 'quran',
          title: surah.name,
          subtitle:
            selectedRiwaya.name,
          audioUrl: `${selectedMoshaf.server}${pad3(
            surah.id
          )}.mp3`,
          reciterName:
            selectedReciter.name,
          surahId: surah.id,
          reciterId:
            selectedReciter.id,
          riwayaId:
            selectedRiwaya.id,
        })
      )
    }, [
      availableSurahs,
      selectedMoshaf,
      selectedReciter,
      selectedRiwaya,
    ])

  const libraryQueue =
    useMemo<PlayerItem[]>(
      () =>
        filteredLibraryItems.map(
          (item) => ({
            kind: 'library',
            title: item.title,
            subtitle:
              item.subtitle,
            audioUrl:
              item.audioUrl,
            reciterName:
              item.authorName ||
              item.subtitle,
            libraryId:
              item.id,
            sourceName:
              item.sourceName,
            sourceUrl:
              item.sourceUrl,
          })
        ),
      [filteredLibraryItems]
    )

  const selectedAudioQueue =
    activeTab === 'quran'
      ? quranQueue
      : libraryQueue

  const loadOfflineAudioUrl =
    useCallback(
      async (item: PlayerItem) => {
        if (
          !item.libraryId &&
          !item.surahId
        ) {
          return null
        }

        const key =
          item.kind === 'quran'
            ? `quran:${item.reciterId}:${item.riwayaId}:${item.surahId}`
            : `library:${item.libraryId}`

        const offline =
          await getOffline(key)

        if (!offline) {
          return null
        }

        revokeObjectUrl()

        const objectUrl =
          URL.createObjectURL(
            offline.blob
          )

        objectUrlRef.current =
          objectUrl

        return objectUrl
      },
      [revokeObjectUrl]
    )

  const startPlayer =
    useCallback(
      (
        item: PlayerItem,
        nextQueue: PlayerItem[],
        nextIndex: number,
        autoplay = true
      ) => {
        const currentAudio: HTMLAudioElement | null =
          audioRef.current

        if (!currentAudio) {
          return
        }

        setQueue(nextQueue)
        setQueueIndex(
          nextIndex
        )
        setPlayer(item)
        setProgress(0)
        setDuration(0)

        pendingPlayRef.current =
          autoplay
      },
      []
    )

  useEffect(() => {
    if (!player) {
      return
    }

    const currentPlayer =
      player

    let disposed = false

    async function prepare() {
      const currentAudio: HTMLAudioElement | null =
        audioRef.current

      if (!currentAudio) {
        return
      }

      try {
        let source =
          currentPlayer.audioUrl

        const offlineSource =
          await loadOfflineAudioUrl(
            currentPlayer
          )

        if (offlineSource) {
          source =
            offlineSource
        }

        if (disposed) {
          return
        }

        currentAudio.src =
          source

        currentAudio.playbackRate =
          playbackRate

        currentAudio.volume =
          isMuted ? 0 : volume

        currentAudio.load()

        const playNow =
          async () => {
            if (
              !pendingPlayRef.current ||
              disposed
            ) {
              return
            }

            pendingPlayRef.current =
              false

            try {
              await currentAudio.play()
            } catch (err) {
              console.error(
                'Audio play failed:',
                err
              )

              setIsPlaying(false)

              notify(
                'اضغط تشغيل من المشغل لبدء الملف الصوتي.'
              )
            }
          }

        if (
          currentAudio.readyState >=
          3
        ) {
          await playNow()
        } else {
          currentAudio.addEventListener(
            'canplay',
            playNow,
            {
              once: true,
            }
          )
        }
      } catch (err) {
        console.error(
          'Player prepare error:',
          err
        )

        notify(
          'تعذر تجهيز الملف الصوتي.'
        )
      }
    }

    void prepare()

    return () => {
      disposed = true
    }
  }, [
    isMuted,
    loadOfflineAudioUrl,
    notify,
    playbackRate,
    player,
    volume,
  ])

  useEffect(() => {
    const currentAudio: HTMLAudioElement | null =
      audioRef.current

    if (!currentAudio) {
      return
    }

    const handleTimeUpdate =
      () =>
        setProgress(
          currentAudio.currentTime ||
            0
        )

    const handleLoadedMetadata =
      () =>
        setDuration(
          Number.isFinite(
            currentAudio.duration
          )
            ? currentAudio.duration
            : 0
        )

    const handlePlay =
      () =>
        setIsPlaying(true)

    const handlePause =
      () =>
        setIsPlaying(false)

    const handleEnded =
      () => {
        setIsPlaying(false)

        if (
          repeatMode === 'one'
        ) {
          currentAudio.currentTime = 0
          void currentAudio
            .play()
            .catch(() => {})

          return
        }

        const nextIndex =
          queueIndex + 1

        if (
          nextIndex <
          queue.length
        ) {
          pendingPlayRef.current =
            true

          setQueueIndex(
            nextIndex
          )

          setPlayer(
            queue[nextIndex]
          )

          return
        }

        if (
          repeatMode === 'all' &&
          queue.length > 0
        ) {
          pendingPlayRef.current =
            true

          setQueueIndex(0)

          setPlayer(
            queue[0]
          )

          return
        }

        setProgress(0)
      }

    const handleError =
      () => {
        setIsPlaying(false)

        notify(
          'تعذر تشغيل هذا الملف. افتح المصدر الأصلي للتأكد من توفره.'
        )
      }

    currentAudio.addEventListener(
      'timeupdate',
      handleTimeUpdate
    )

    currentAudio.addEventListener(
      'loadedmetadata',
      handleLoadedMetadata
    )

    currentAudio.addEventListener(
      'play',
      handlePlay
    )

    currentAudio.addEventListener(
      'pause',
      handlePause
    )

    currentAudio.addEventListener(
      'ended',
      handleEnded
    )

    currentAudio.addEventListener(
      'error',
      handleError
    )

    return () => {
      currentAudio.removeEventListener(
        'timeupdate',
        handleTimeUpdate
      )

      currentAudio.removeEventListener(
        'loadedmetadata',
        handleLoadedMetadata
      )

      currentAudio.removeEventListener(
        'play',
        handlePlay
      )

      currentAudio.removeEventListener(
        'pause',
        handlePause
      )

      currentAudio.removeEventListener(
        'ended',
        handleEnded
      )

      currentAudio.removeEventListener(
        'error',
        handleError
      )
    }
  }, [
    notify,
    queue,
    queueIndex,
    repeatMode,
  ])

  useEffect(() => {
    const currentAudio: HTMLAudioElement | null =
      audioRef.current

    if (!currentAudio) {
      return
    }

    currentAudio.playbackRate =
      playbackRate
  }, [playbackRate])

  useEffect(() => {
    const currentAudio: HTMLAudioElement | null =
      audioRef.current

    if (!currentAudio) {
      return
    }

    currentAudio.volume =
      isMuted ? 0 : volume
  }, [isMuted, volume])

  useEffect(() => {
    return () => revokeObjectUrl()
  }, [revokeObjectUrl])

  const selectRiwaya = (
    riwaya: Riwaya
  ) => {
    audioRef.current?.pause()

    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)

    setSelectedRiwaya(
      riwaya
    )

    setSelectedReciter(null)
    setSelectedMoshaf(null)
    setSelectedSurah(null)

    setSearch('')
    setRiwayaSearch('')

    setShowRiwayat(false)
    setShowReciters(true)
    setShowSurahs(false)
  }

  const selectReciter = (
    reciter: Reciter
  ) => {
    if (!selectedRiwaya) {
      return
    }

    audioRef.current?.pause()

    const moshaf =
      getMoshafForRiwaya(
        reciter,
        selectedRiwaya.name
      )

    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)

    setSelectedReciter(
      reciter
    )

    setSelectedMoshaf(
      moshaf || null
    )

    setSelectedSurah(null)

    setSearch('')

    setShowReciters(false)
    setShowSurahs(true)
  }

  const playSurah = async (
    surah: Surah
  ) => {
    if (
      !selectedRiwaya ||
      !selectedReciter ||
      !selectedMoshaf
    ) {
      return
    }

    const index =
      quranQueue.findIndex(
        (item) =>
          item.surahId ===
          surah.id
      )

    const item =
      quranQueue[index]

    if (!item) {
      return
    }

    setSelectedSurah(
      surah
    )

    if (
      player?.kind ===
        'quran' &&
      player.surahId ===
        surah.id &&
      player.reciterId ===
        selectedReciter.id &&
      audioRef.current
    ) {
      if (
        audioRef.current.paused
      ) {
        await audioRef.current
          .play()
          .catch(() => {})
      } else {
        audioRef.current.pause()
      }

      return
    }

    startPlayer(
      item,
      quranQueue,
      index,
      true
    )
  }

  const playLibraryItem =
    async (item: LibraryAudio) => {
      const nextQueue =
        filteredLibraryItems.map(
          (entry) => ({
            kind: 'library' as const,
            title: entry.title,
            subtitle:
              entry.subtitle,
            audioUrl:
              entry.audioUrl,
            reciterName:
              entry.authorName ||
              entry.subtitle,
            libraryId:
              entry.id,
            sourceName:
              entry.sourceName,
            sourceUrl:
              entry.sourceUrl,
          })
        )

      const index =
        nextQueue.findIndex(
          (entry) =>
            entry.libraryId ===
            item.id
        )

      if (index === -1) {
        return
      }

      if (
        player?.kind ===
          'library' &&
        player.libraryId ===
          item.id
      ) {
        await togglePlayer()
        return
      }

      startPlayer(
        nextQueue[index],
        nextQueue,
        index,
        true
      )
    }

  const togglePlayer =
    async () => {
      const currentAudio: HTMLAudioElement | null =
        audioRef.current

      if (
        !currentAudio ||
        !player
      ) {
        return
      }

      if (
        currentAudio.paused
      ) {
        await currentAudio
          .play()
          .catch(() => {})
      } else {
        currentAudio.pause()
      }
    }

  const closePlayer = () => {
    const currentAudio: HTMLAudioElement | null =
      audioRef.current

    if (currentAudio) {
      currentAudio.pause()
      currentAudio.removeAttribute(
        'src'
      )
      currentAudio.load()
    }

    pendingPlayRef.current =
      false

    revokeObjectUrl()

    setPlayer(null)
    setQueue([])
    setQueueIndex(-1)
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)
  }

  const seekTo = (
    value: number
  ) => {
    const currentAudio: HTMLAudioElement | null =
      audioRef.current

    if (
      !currentAudio ||
      !Number.isFinite(
        currentAudio.duration
      )
    ) {
      return
    }

    currentAudio.currentTime =
      value

    setProgress(value)
  }

  const goQueue =
    (offset: number) => {
      if (!queue.length) {
        return
      }

      const nextIndex =
        queueIndex + offset

      if (
        nextIndex < 0 ||
        nextIndex >= queue.length
      ) {
        if (
          repeatMode ===
          'all'
        ) {
          const wrapped =
            nextIndex < 0
              ? queue.length - 1
              : 0

          pendingPlayRef.current =
            true

          setQueueIndex(
            wrapped
          )

          setPlayer(
            queue[wrapped]
          )
        }

        return
      }

      pendingPlayRef.current =
        true

      setQueueIndex(
        nextIndex
      )

      setPlayer(
        queue[nextIndex]
      )

      if (
        queue[nextIndex]
          .kind === 'quran' &&
        queue[nextIndex]
          .surahId
      ) {
        const surah =
          availableSurahs.find(
            (entry) =>
              entry.id ===
              queue[
                nextIndex
              ].surahId
          )

        if (surah) {
          setSelectedSurah(
            surah
          )
        }
      }
    }

  function offlineKeyFor(
    item: PlayerItem
  ) {
    if (
      item.kind === 'quran'
    ) {
      return `quran:${item.reciterId}:${item.riwayaId}:${item.surahId}`
    }

    return `library:${item.libraryId}`
  }

  const downloadDirect =
    async (
      url: string,
      suggestedName: string
    ) => {
      try {
        const response =
          await fetch(url, {
            mode: 'cors',
          })

        if (!response.ok) {
          throw new Error(
            'download failed'
          )
        }

        const blob =
          await response.blob()

        const extension =
          blob.type.split('/')[1] ||
          detectFileExtension(url) ||
          'mp3'

        const downloadUrl =
          URL.createObjectURL(
            blob
          )

        const anchor =
          document.createElement(
            'a'
          )

        anchor.href =
          downloadUrl

        anchor.download = `${safeFileName(
          suggestedName
        )}.${extension}`

        document.body.appendChild(
          anchor
        )

        anchor.click()
        anchor.remove()

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              downloadUrl
            ),
          2500
        )
      } catch (err) {
        console.error(
          'Direct download failed:',
          err
        )

        window.open(
          url,
          '_blank',
          'noopener,noreferrer'
        )

        notify(
          'فتحنا ملف المصدر الأصلي لأن الخادم منع التنزيل البرمجي.'
        )
      }
    }

  const saveOfflinePlayer =
    async (
      item: PlayerItem
    ) => {
      const key =
        offlineKeyFor(item)

      setOfflineBusyKey(key)

      try {
        const response =
          await fetch(
            item.audioUrl,
            {
              mode: 'cors',
            }
          )

        if (!response.ok) {
          throw new Error(
            'offline fetch failed'
          )
        }

        const blob =
          await response.blob()

        await putOffline({
          key,
          title: item.title,
          subtitle:
            item.subtitle,
          blob,
          savedAt:
            Date.now(),
        })

        await loadOfflineIndex()

        notify(
          'تم حفظ الصوت على الجهاز للاستماع بدون إنترنت.'
        )
      } catch (err) {
        console.error(
          'Offline save failed:',
          err
        )

        notify(
          'المصدر يسمح بالتشغيل، لكنه لا يسمح للمتصفح بقراءة الملف للحفظ المحلي.'
        )
      } finally {
        setOfflineBusyKey(
          null
        )
      }
    }

  const removeOfflinePlayer =
    async (
      item: PlayerItem
    ) => {
      const key =
        offlineKeyFor(item)

      try {
        await deleteOffline(
          key
        )

        await loadOfflineIndex()

        notify(
          'تم حذف النسخة المحفوظة من الجهاز.'
        )
      } catch (err) {
        console.error(
          'Offline delete failed:',
          err
        )

        notify(
          'تعذر حذف النسخة المحفوظة.'
        )
      }
    }

  const downloadQuranZip =
    async () => {
      if (
        !selectedReciter ||
        !selectedMoshaf ||
        !selectedRiwaya
      ) {
        notify(
          'اختر القارئ والرواية أولًا.'
        )

        return
      }

      setZipBusy(true)
      setQuranZipProgress(0)

      try {
        const zip =
          new JSZip()

        const folder =
          zip.folder(
            safeFileName(
              `مصحف ${selectedReciter.name} - ${selectedRiwaya.name}`
            )
          )

        if (!folder) {
          throw new Error(
            'ZIP folder failed'
          )
        }

        const total =
          availableSurahs.length

        let completed = 0

        for (const surah of availableSurahs) {
          const url = `${selectedMoshaf.server}${pad3(
            surah.id
          )}.mp3`

          const response =
            await fetch(url, {
              mode: 'cors',
            })

          if (!response.ok) {
            completed += 1

            setQuranZipProgress(
              Math.round(
                (completed /
                  total) *
                  100
              )
            )

            continue
          }

          const blob =
            await response.blob()

          folder.file(
            `${String(
              surah.id
            ).padStart(
              3,
              '0'
            )} - ${safeFileName(
              surah.name
            )}.mp3`,
            blob
          )

          completed += 1

          setQuranZipProgress(
            Math.round(
              (completed /
                total) *
                100
            )
          )
        }

        const content =
          await zip.generateAsync(
            {
              type: 'blob',
              compression:
                'STORE',
              streamFiles:
                true,
            },
            (metadata) => {
              const stage =
                95 +
                Math.round(
                  metadata.percent *
                    0.05
                )

              setQuranZipProgress(
                Math.min(
                  100,
                  stage
                )
              )
            }
          )

        const blobUrl =
          URL.createObjectURL(
            content
          )

        const anchor =
          document.createElement(
            'a'
          )

        anchor.href =
          blobUrl

        anchor.download =
          safeFileName(
            `مصحف كامل - ${selectedReciter.name} - ${selectedRiwaya.name}.zip`
          )

        document.body.appendChild(
          anchor
        )

        anchor.click()
        anchor.remove()

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              blobUrl
            ),
          5000
        )

        notify(
          'تم تجهيز ملف ZIP للمصحف كاملًا.'
        )
      } catch (err) {
        console.error(
          'Quran ZIP error:',
          err
        )

        notify(
          'تعذر إنشاء ZIP من المتصفح.'
        )
      } finally {
        setZipBusy(false)

        window.setTimeout(
          () =>
            setQuranZipProgress(
              0
            ),
          1500
        )
      }
    }

  const saveWholeQuranOffline =
    async () => {
      if (
        !selectedReciter ||
        !selectedMoshaf ||
        !selectedRiwaya
      ) {
        notify(
          'اختر القارئ والرواية أولًا.'
        )

        return
      }

      setZipBusy(true)
      setQuranZipProgress(0)

      try {
        const total =
          availableSurahs.length

        let completed = 0

        for (const surah of availableSurahs) {
          const key = `quran:${selectedReciter.id}:${selectedRiwaya.id}:${surah.id}`

          if (
            offlineKeys.has(key)
          ) {
            completed += 1

            setQuranZipProgress(
              Math.round(
                (completed /
                  total) *
                  100
              )
            )

            continue
          }

          const url = `${selectedMoshaf.server}${pad3(
            surah.id
          )}.mp3`

          const response =
            await fetch(url, {
              mode: 'cors',
            })

          if (response.ok) {
            const blob =
              await response.blob()

            await putOffline({
              key,
              title:
                surah.name,
              subtitle: `${selectedReciter.name} — ${selectedRiwaya.name}`,
              blob,
              savedAt:
                Date.now(),
            })
          }

          completed += 1

          setQuranZipProgress(
            Math.round(
              (completed /
                total) *
                100
            )
          )
        }

        await loadOfflineIndex()

        notify(
          'تم حفظ السور المتاحة على الجهاز.'
        )
      } catch (err) {
        console.error(
          'Whole Quran offline error:',
          err
        )

        notify(
          'تعذر حفظ المصحف كاملًا.'
        )
      } finally {
        setZipBusy(false)

        window.setTimeout(
          () =>
            setQuranZipProgress(
              0
            ),
          1500
        )
      }
    }

  const resetSelection =
    () => {
      audioRef.current?.pause()

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

  const tabTitle: Record<
    TabKey,
    string
  > = {
    quran: 'القرآن الكريم',
    ruqyah: 'الرُّقية الشرعية',
    khutbah: 'الخطب والدروس',
    sunnah:
      'كتب السنة الصوتية',
  }

  const tabDescription: Record<
    TabKey,
    string
  > = {
    quran:
      'تلاوات كاملة مع التشغيل والتنزيل والحفظ على الجهاز.',
    ruqyah:
      'ملفات رقية شرعية صوتية ثابتة من مصدر موثّق، بدون بث مباشر.',
    khutbah:
      'خطب جمعة مسجلة بصيغة MP3 مع رابط المصدر الأصلي.',
    sunnah:
      'سلاسل مسموعة من كتب السنة والحديث مع روابط الملفات الأصلية.',
  }

  const currentOffline =
    player
      ? offlineKeys.has(
          offlineKeyFor(
            player
          )
        )
      : false

  const sourceCount =
    new Set(
      libraryItems.map(
        (item) =>
          item.sourceName
      )
    ).size

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top,#fffdf8_0%,#fcfbf8_42%,#f3f7f8_100%)] pb-44"
      dir="rtl"
    >
      <audio
        ref={audioRef}
        preload="metadata"
      />

      <header className="sticky top-0 z-40 border-b border-mushaf-border/20 bg-[#FCFBF8]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-mushaf-border/20 bg-white text-mushaf-teal shadow-sm transition hover:-translate-y-0.5"
            aria-label="العودة للرئيسية"
          >
            <ChevronRight
              size={22}
            />
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mushaf-teal text-white shadow-sm">
                <Headphones
                  size={18}
                />
              </div>

              <h1 className="truncate text-xl font-black tracking-tight text-mushaf-dark">
                مكتبة سميع الصوتية
              </h1>
            </div>

            <p className="mt-1 text-[11px] font-bold text-gray-500">
              القرآن • الرُّقية • الخطب • السنة
            </p>
          </div>

          <button
            type="button"
            onClick={
              resetSelection
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-mushaf-border/20 bg-white text-mushaf-teal shadow-sm transition hover:-translate-y-0.5"
            title="إعادة الاختيار"
            aria-label="إعادة الاختيار"
          >
            <RotateCcw
              size={18}
            />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:py-7">
        {loading ? (
          <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 text-mushaf-teal">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-mushaf-border/20 bg-white shadow-sm">
              <Loader2
                className="animate-spin"
                size={36}
              />
            </div>

            <p className="font-black">
              جاري تجهيز مكتبة سميع...
            </p>
          </div>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[2rem] border border-mushaf-gold/20 bg-gradient-to-br from-[#165A61] via-[#11474E] to-[#0B343A] p-5 text-white shadow-[0_24px_80px_rgba(13,56,62,0.15)] sm:p-7">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-mushaf-gold/10 blur-3xl" />

              <div className="relative z-10 grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                <div className="flex justify-center">
                  <div className="rounded-full border-4 border-mushaf-gold/70 p-1.5 shadow-2xl">
                    <AudioAvatar
                      size="lg"
                      playing={
                        isPlaying
                      }
                    />
                  </div>
                </div>

                <div className="min-w-0 text-center lg:text-right">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black text-white/75">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    ملفات صوتية عند الطلب — بدون بث مباشر
                  </div>

                  <h2 className="truncate text-2xl font-black sm:text-3xl">
                    {player
                      ? player.title
                      : tabTitle[
                          activeTab
                        ]}
                  </h2>

                  <p className="mt-2 truncate text-base font-bold text-white/75">
                    {player
                      ? player.reciterName
                      : tabDescription[
                          activeTab
                        ]}
                  </p>

                  {player?.sourceName && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          player.sourceUrl
                        ) {
                          window.open(
                            player.sourceUrl,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-mushaf-gold/25 bg-mushaf-gold/10 px-4 py-2 text-xs font-black text-mushaf-gold transition hover:bg-mushaf-gold/20"
                    >
                      المصدر:
                      {player.sourceName}
                      <ExternalLink
                        size={14}
                      />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/45">
                      القراء
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(
                        reciters.length
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/45">
                      السور
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(
                        availableSurahs.length
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/45">
                      دون نت
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(
                        offlineKeys.size
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-[10px] text-white/45">
                      مصادر
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {arabicDigits(
                        sourceCount
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5">
              <div className="grid gap-2 rounded-[1.5rem] border border-mushaf-border/25 bg-white/85 p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    [
                      'quran',
                      'القرآن الكريم',
                    ],
                    [
                      'ruqyah',
                      'الرُّقية',
                    ],
                    [
                      'khutbah',
                      'الخطب',
                    ],
                    [
                      'sunnah',
                      'كتب السنة',
                    ],
                  ] as Array<
                    [TabKey, string]
                  >
                ).map(
                  ([
                    tab,
                    label,
                  ]) => {
                    const active =
                      activeTab ===
                      tab

                    return (
                      <button
                        type="button"
                        key={tab}
                        onClick={() => {
                          setActiveTab(
                            tab
                          )
                          setSearch('')
                          setShowRiwayat(
                            false
                          )
                          setShowReciters(
                            false
                          )
                          setShowSurahs(
                            false
                          )
                        }}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black transition ${
                          active
                            ? 'bg-mushaf-teal text-white shadow-md'
                            : 'text-mushaf-dark hover:bg-mushaf-paper'
                        }`}
                      >
                        <SectionIcon
                          type={
                            tab
                          }
                        />

                        {label}
                      </button>
                    )
                  }
                )}
              </div>
            </section>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            {activeTab ===
            'quran' ? (
              <>
                <section className="mt-6 rounded-[1.75rem] border border-mushaf-border/25 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-mushaf-paper px-3 py-1.5 text-[10px] font-black text-mushaf-teal">
                        المصدر الحالي للقرآن: MP3Quran
                      </div>

                      <h2 className="mt-3 text-lg font-black text-mushaf-dark">
                        إعداد التلاوة
                      </h2>

                      <p className="mt-1 text-xs leading-6 text-gray-500">
                        الرواية ← القارئ ← السورة
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        icon={
                          zipBusy ? (
                            <Loader2
                              className="animate-spin"
                              size={
                                16
                              }
                            />
                          ) : (
                            <FileArchive
                              size={
                                16
                              }
                            />
                          )
                        }
                        label={
                          zipBusy
                            ? `جاري التجهيز ${arabicDigits(
                                quranZipProgress
                              )}%`
                            : 'تحميل المصحف ZIP'
                        }
                        onClick={
                          downloadQuranZip
                        }
                        disabled={
                          zipBusy ||
                          !selectedReciter ||
                          !selectedMoshaf ||
                          !availableSurahs.length
                        }
                      />

                      <ActionButton
                        icon={
                          <WifiOff
                            size={
                              16
                            }
                          />
                        }
                        label="حفظ المصحف دون نت"
                        onClick={
                          saveWholeQuranOffline
                        }
                        disabled={
                          zipBusy ||
                          !selectedReciter ||
                          !selectedMoshaf ||
                          !availableSurahs.length
                        }
                      />
                    </div>
                  </div>

                  {zipBusy &&
                    quranZipProgress >
                      0 && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
                          <span>
                            تجهيز الملفات
                          </span>

                          <span>
                            {arabicDigits(
                              quranZipProgress
                            )}
                            %
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-mushaf-paper">
                          <div
                            className="h-full rounded-full bg-mushaf-gold transition-all"
                            style={{
                              width: `${quranZipProgress}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mushaf-teal text-sm font-black text-white">
                        ١
                      </div>

                      <div>
                        <h2 className="font-black text-mushaf-dark">
                          اختر الرواية
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                          الروايات التي يوفرها مصدر القرآن الحالي
                        </p>
                      </div>
                    </div>

                    {selectedRiwaya && (
                      <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
                        {
                          selectedRiwaya.name
                        }
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRiwayat(
                        (value) =>
                          !value
                      )
                      setShowReciters(
                        false
                      )
                      setShowSurahs(
                        false
                      )
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mushaf-border/30 bg-white p-4 text-right shadow-sm transition hover:border-mushaf-teal"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mushaf-gold/20 bg-mushaf-paper text-mushaf-gold">
                        <BookOpen
                          size={
                            23
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-bold text-gray-400">
                          الرواية
                        </p>

                        <p className="truncate font-black text-mushaf-dark">
                          {selectedRiwaya?.name ||
                            'اختر الرواية'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={
                        21
                      }
                      className={`text-mushaf-teal transition ${
                        showRiwayat
                          ? 'rotate-180'
                          : ''
                      }`}
                    />
                  </button>

                  {showRiwayat && (
                    <div className="mt-3 rounded-3xl border border-mushaf-border/30 bg-white p-3 shadow-lg">
                      <div className="relative mb-3">
                        <Search
                          size={
                            18
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />

                        <input
                          value={
                            riwayaSearch
                          }
                          onChange={(
                            event
                          ) =>
                            setRiwayaSearch(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="ابحث عن رواية..."
                          className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none"
                        />
                      </div>

                      <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                        {filteredRiwayat.map(
                          (
                            riwaya
                          ) => {
                            const active =
                              selectedRiwaya?.id ===
                              riwaya.id

                            return (
                              <button
                                type="button"
                                key={
                                  riwaya.id
                                }
                                onClick={() =>
                                  selectRiwaya(
                                    riwaya
                                  )
                                }
                                className={`flex items-center justify-between gap-2 rounded-2xl border p-3 text-right transition ${
                                  active
                                    ? 'border-mushaf-teal bg-mushaf-teal text-white shadow-md'
                                    : 'border-mushaf-border/30 bg-white text-mushaf-dark hover:border-mushaf-teal'
                                }`}
                              >
                                <span className="text-sm font-bold leading-relaxed">
                                  {
                                    riwaya.name
                                  }
                                </span>

                                {active && (
                                  <Check
                                    size={
                                      18
                                    }
                                  />
                                )}
                              </button>
                            )
                          }
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${
                          selectedRiwaya
                            ? 'bg-mushaf-gold text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        ٢
                      </div>

                      <div>
                        <h2 className="font-black text-mushaf-dark">
                          اختر القارئ
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                          القراء المتاحون فعليًا للرواية المختارة
                        </p>
                      </div>
                    </div>

                    {selectedReciter && (
                      <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
                        {arabicDigits(
                          reciters.length
                        )}{' '}
                        قارئ
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      !selectedRiwaya ||
                      recitersLoading
                    }
                    onClick={() => {
                      setShowReciters(
                        (value) =>
                          !value
                      )
                      setShowRiwayat(
                        false
                      )
                      setShowSurahs(
                        false
                      )
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mushaf-border/30 bg-white p-4 text-right shadow-sm transition hover:border-mushaf-teal disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-12 shrink-0">
                        <AudioAvatar
                          size="sm"
                          playing={
                            isPlaying
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-bold text-gray-400">
                          القارئ
                        </p>

                        <p className="truncate font-black text-mushaf-dark">
                          {recitersLoading
                            ? 'جاري تحميل القراء...'
                            : selectedReciter?.name ||
                              'اختر القارئ'}
                        </p>
                      </div>
                    </div>

                    {recitersLoading ? (
                      <Loader2
                        className="animate-spin text-mushaf-teal"
                        size={
                          20
                        }
                      />
                    ) : (
                      <ChevronDown
                        size={
                          21
                        }
                        className={`text-mushaf-teal transition ${
                          showReciters
                            ? 'rotate-180'
                            : ''
                        }`}
                      />
                    )}
                  </button>

                  {showReciters &&
                    selectedRiwaya && (
                      <div className="mt-3 rounded-3xl border border-mushaf-border/30 bg-white p-3 shadow-lg">
                        <div className="relative mb-3">
                          <Search
                            size={
                              18
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                          />

                          <input
                            value={
                              search
                            }
                            onChange={(
                              event
                            ) =>
                              setSearch(
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="ابحث باسم القارئ..."
                            className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none"
                          />
                        </div>

                        <div className="grid max-h-[560px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
                          {visibleReciters.map(
                            (
                              reciter
                            ) => {
                              const active =
                                selectedReciter?.id ===
                                reciter.id

                              return (
                                <div
                                  key={
                                    reciter.id
                                  }
                                  className={`rounded-3xl border bg-white p-3 transition ${
                                    active
                                      ? 'border-mushaf-gold shadow-lg ring-2 ring-mushaf-gold/10'
                                      : 'border-mushaf-border/30 hover:border-mushaf-teal hover:shadow-md'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectReciter(
                                        reciter
                                      )
                                    }
                                    className="w-full text-right"
                                  >
                                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-mushaf-paper">
                                      <AudioAvatar
                                        playing={
                                          active &&
                                          isPlaying
                                        }
                                        size="md"
                                      />

                                      {active && (
                                        <div className="absolute inset-0 flex items-end justify-start bg-mushaf-teal/15 p-2">
                                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mushaf-teal text-white shadow-lg">
                                            <Check
                                              size={
                                                18
                                              }
                                            />
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    <p className="mt-3 line-clamp-2 text-sm font-black text-mushaf-dark">
                                      {
                                        reciter.name
                                      }
                                    </p>
                                  </button>
                                </div>
                              )
                            }
                          )}
                        </div>

                        {visibleReciters.length ===
                          0 && (
                          <div className="py-10 text-center font-bold text-gray-400">
                            لا يوجد قارئ بهذا الاسم.
                          </div>
                        )}
                      </div>
                    )}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${
                          selectedReciter
                            ? 'bg-mushaf-teal text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        ٣
                      </div>

                      <div>
                        <h2 className="font-black text-mushaf-dark">
                          السور
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                          تشغيل • تنزيل • حفظ على الجهاز
                        </p>
                      </div>
                    </div>

                    {selectedMoshaf && (
                      <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
                        {arabicDigits(
                          availableSurahs.length
                        )}{' '}
                        سورة
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      !selectedReciter ||
                      !selectedMoshaf
                    }
                    onClick={() => {
                      setShowSurahs(
                        (value) =>
                          !value
                      )
                      setShowReciters(
                        false
                      )
                      setShowRiwayat(
                        false
                      )
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mushaf-border/30 bg-white p-4 text-right shadow-sm transition hover:border-mushaf-teal disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mushaf-gold/20 bg-mushaf-paper text-mushaf-gold">
                        <BookOpen
                          size={
                            23
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-bold text-gray-400">
                          السورة
                        </p>

                        <p className="truncate font-black text-mushaf-dark">
                          {selectedSurah?.name ||
                            'اختر السورة'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={
                        21
                      }
                      className={`text-mushaf-teal transition ${
                        showSurahs
                          ? 'rotate-180'
                          : ''
                      }`}
                    />
                  </button>

                  {showSurahs &&
                    selectedReciter &&
                    selectedMoshaf && (
                      <div className="mt-3 rounded-3xl border border-mushaf-border/30 bg-white p-3 shadow-lg">
                        <div className="relative mb-3">
                          <Search
                            size={
                              18
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                          />

                          <input
                            value={
                              surahSearch
                            }
                            onChange={(
                              event
                            ) =>
                              setSurahSearch(
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="ابحث باسم السورة..."
                            className="w-full rounded-2xl bg-mushaf-paper py-3 pl-4 pr-11 text-sm font-bold outline-none"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {visibleSurahs.map(
                            (
                              surah
                            ) => {
                              const active =
                                selectedSurah?.id ===
                                surah.id

                              const playing =
                                player?.kind ===
                                  'quran' &&
                                player.surahId ===
                                  surah.id &&
                                player.reciterId ===
                                  selectedReciter.id

                              const currentItem =
                                quranQueue.find(
                                  (
                                    entry
                                  ) =>
                                    entry.surahId ===
                                    surah.id
                                )

                              const currentKey =
                                currentItem
                                  ? offlineKeyFor(
                                      currentItem
                                    )
                                  : ''

                              const saved =
                                !!currentKey &&
                                offlineKeys.has(
                                  currentKey
                                )

                              const busy =
                                offlineBusyKey ===
                                currentKey

                              return (
                                <div
                                  key={
                                    surah.id
                                  }
                                  className={`rounded-2xl border p-3 transition ${
                                    active
                                      ? 'border-mushaf-gold bg-mushaf-gold/5 shadow-md'
                                      : 'border-mushaf-border/25 bg-white hover:border-mushaf-teal'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void playSurah(
                                          surah
                                        )
                                      }
                                      className="flex min-w-0 flex-1 items-center gap-3 text-right"
                                    >
                                      <div
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                          active
                                            ? 'bg-mushaf-gold text-white'
                                            : 'bg-mushaf-paper text-mushaf-teal'
                                        }`}
                                      >
                                        {arabicDigits(
                                          surah.id
                                        )}
                                      </div>

                                      <div className="min-w-0">
                                        <p className="truncate font-black text-mushaf-dark">
                                          {
                                            surah.name
                                          }
                                        </p>

                                        <p className="mt-1 text-[11px] text-gray-400">
                                          {surah.makkia
                                            ? 'مكية'
                                            : 'مدنية'}
                                        </p>
                                      </div>
                                    </button>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void playSurah(
                                            surah
                                          )
                                        }
                                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                          playing &&
                                          isPlaying
                                            ? 'bg-mushaf-teal text-white'
                                            : 'bg-mushaf-paper text-mushaf-teal'
                                        }`}
                                        title="تشغيل"
                                      >
                                        {playing &&
                                        isPlaying ? (
                                          <Pause
                                            size={
                                              17
                                            }
                                            fill="currentColor"
                                          />
                                        ) : (
                                          <Play
                                            size={
                                              17
                                            }
                                            fill="currentColor"
                                          />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            !currentItem
                                          ) {
                                            return
                                          }

                                          void downloadDirect(
                                            currentItem.audioUrl,
                                            `${surah.name} - ${selectedReciter?.name}`
                                          )
                                        }}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-mushaf-paper text-mushaf-gold"
                                        title="تنزيل"
                                      >
                                        <Download
                                          size={
                                            17
                                          }
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        disabled={
                                          busy
                                        }
                                        onClick={() => {
                                          if (
                                            !currentItem
                                          ) {
                                            return
                                          }

                                          if (
                                            saved
                                          ) {
                                            void removeOfflinePlayer(
                                              currentItem
                                            )
                                          } else {
                                            void saveOfflinePlayer(
                                              currentItem
                                            )
                                          }
                                        }}
                                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                          saved
                                            ? 'bg-mushaf-gold text-white'
                                            : 'bg-mushaf-paper text-mushaf-teal'
                                        }`}
                                        title={
                                          saved
                                            ? 'محفوظ دون إنترنت'
                                            : 'حفظ دون إنترنت'
                                        }
                                      >
                                        {busy ? (
                                          <Loader2
                                            size={
                                              16
                                            }
                                            className="animate-spin"
                                          />
                                        ) : saved ? (
                                          <Check
                                            size={
                                              16
                                            }
                                          />
                                        ) : (
                                          <WifiOff
                                            size={
                                              16
                                            }
                                          />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                          )}
                        </div>
                      </div>
                    )}
                </section>
              </>
            ) : (
              <section className="mt-6">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-mushaf-border/25 bg-white p-5 shadow-sm sm:p-6">
                  <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-mushaf-gold/5 blur-3xl" />

                  <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full bg-mushaf-paper px-3 py-1.5 text-[10px] font-black text-mushaf-teal">
                        <span className="h-1.5 w-1.5 rounded-full bg-mushaf-gold" />
                        ملفات صوتية فعلية — بدون بث مباشر
                      </div>

                      <h2 className="mt-3 text-2xl font-black text-mushaf-dark">
                        {
                          tabTitle[
                            activeTab
                          ]
                        }
                      </h2>

                      <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-500">
                        {
                          tabDescription[
                            activeTab
                          ]
                        }
                      </p>
                    </div>

                    <div className="relative w-full lg:max-w-sm">
                      <Search
                        size={
                          18
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        value={
                          search
                        }
                        onChange={(
                          event
                        ) =>
                          setSearch(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="ابحث في الصوتيات..."
                        className="w-full rounded-2xl border border-mushaf-border/20 bg-mushaf-paper py-3.5 pl-4 pr-11 text-sm font-bold outline-none transition focus:border-mushaf-teal"
                      />
                    </div>
                  </div>
                </div>

                {libraryLoading[
                  activeTab
                ] ? (
                  <div className="mt-5 flex min-h-[35vh] flex-col items-center justify-center gap-3 rounded-3xl border border-mushaf-border/20 bg-white">
                    <Loader2
                      size={
                        32
                      }
                      className="animate-spin text-mushaf-teal"
                    />

                    <p className="text-sm font-black text-mushaf-dark">
                      جاري تحميل الملفات الصوتية...
                    </p>
                  </div>
                ) : libraryError[
                    activeTab
                  ] ? (
                  <div className="mt-5 rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
                    <p className="font-black text-red-700">
                      {
                        libraryError[
                          activeTab
                        ]
                      }
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setLibraryLoaded(
                          (current) => ({
                            ...current,
                            [activeTab]:
                              false,
                          })
                        )

                        void loadLibraryContent(
                          activeTab
                        )
                      }}
                      className="mt-4 rounded-2xl bg-mushaf-teal px-5 py-3 text-sm font-black text-white"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : filteredLibraryItems.length ===
                  0 ? (
                  <div className="mt-5 rounded-3xl border border-mushaf-border/20 bg-white p-10 text-center shadow-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mushaf-paper text-mushaf-teal">
                      <Headphones
                        size={
                          27
                        }
                      />
                    </div>

                    <p className="mt-4 font-black text-mushaf-dark">
                      لا توجد ملفات مطابقة حاليًا
                    </p>

                    <p className="mt-2 text-sm leading-7 text-gray-500">
                      جرّب كلمة بحث أخرى أو انتظر تحديث المصدر.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {filteredLibraryItems.map(
                        (
                          item,
                          index
                        ) => {
                          const libraryPlayer: PlayerItem =
                            {
                              kind: 'library',
                              title:
                                item.title,
                              subtitle:
                                item.subtitle,
                              audioUrl:
                                item.audioUrl,
                              reciterName:
                                item.authorName ||
                                item.subtitle,
                              libraryId:
                                item.id,
                              sourceName:
                                item.sourceName,
                              sourceUrl:
                                item.sourceUrl,
                            }

                          const key =
                            offlineKeyFor(
                              libraryPlayer
                            )

                          const saved =
                            offlineKeys.has(
                              key
                            )

                          const busy =
                            offlineBusyKey ===
                            key

                          const playing =
                            player?.kind ===
                              'library' &&
                            player.libraryId ===
                              item.id

                          return (
                            <article
                              key={
                                item.id
                              }
                              className={`group relative overflow-hidden rounded-[1.65rem] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${
                                playing
                                  ? 'border-mushaf-gold ring-2 ring-mushaf-gold/10'
                                  : 'border-mushaf-border/20'
                              }`}
                            >
                              <div className="flex gap-4">
                                <div className="h-20 w-20 shrink-0">
                                  <AudioAvatar
                                    size="player"
                                    playing={
                                      playing &&
                                      isPlaying
                                    }
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-mushaf-teal/10 bg-mushaf-teal/5 px-2.5 py-1 text-[9px] font-black text-mushaf-teal">
                                        <span className="h-1.5 w-1.5 rounded-full bg-mushaf-teal" />
                                        ملف MP3 فعلي
                                      </div>

                                      <h3 className="line-clamp-2 text-base font-black leading-7 text-mushaf-dark">
                                        {
                                          item.title
                                        }
                                      </h3>
                                    </div>

                                    <span className="shrink-0 text-xs font-black text-gray-300">
                                      {arabicDigits(
                                        index +
                                          1
                                      )}
                                    </span>
                                  </div>

                                  <p className="mt-1 line-clamp-2 text-xs font-bold leading-6 text-mushaf-teal">
                                    {item.authorName ||
                                      item.subtitle}
                                  </p>

                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-400">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock3
                                        size={
                                          12
                                        }
                                      />
                                      {formatDuration(
                                        item.duration
                                      )}
                                    </span>

                                    <span>
                                      •
                                    </span>

                                    <span>
                                      المصدر:{' '}
                                      {
                                        item.sourceName
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 border-t border-mushaf-border/15 pt-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void playLibraryItem(
                                      item
                                    )
                                  }
                                  className="flex min-w-[115px] flex-1 items-center justify-center gap-2 rounded-2xl bg-mushaf-teal px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-[#0e555d]"
                                >
                                  {playing &&
                                  isPlaying ? (
                                    <>
                                      <Pause
                                        size={
                                          16
                                        }
                                        fill="currentColor"
                                      />
                                      إيقاف
                                    </>
                                  ) : (
                                    <>
                                      <Play
                                        size={
                                          16
                                        }
                                        fill="currentColor"
                                      />
                                      تشغيل
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void downloadDirect(
                                      item.audioUrl,
                                      `${item.title} - ${
                                        item.authorName ||
                                        ''
                                      }`
                                    )
                                  }
                                  disabled={
                                    item.downloadable ===
                                    false
                                  }
                                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-mushaf-gold/20 bg-mushaf-gold/5 px-4 text-xs font-black text-mushaf-gold transition hover:bg-mushaf-gold/10 disabled:opacity-35"
                                  title="تنزيل الملف"
                                >
                                  <Download
                                    size={
                                      16
                                    }
                                  />
                                  <span className="hidden sm:inline">
                                    تنزيل
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() => {
                                    if (
                                      saved
                                    ) {
                                      void removeOfflinePlayer(
                                        libraryPlayer
                                      )
                                    } else {
                                      void saveOfflinePlayer(
                                        libraryPlayer
                                      )
                                    }
                                  }}
                                  className={`flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-black ${
                                    saved
                                      ? 'bg-mushaf-gold text-white'
                                      : 'border border-mushaf-teal/15 bg-mushaf-teal/5 text-mushaf-teal'
                                  } disabled:opacity-40`}
                                  title={
                                    saved
                                      ? 'حذف النسخة'
                                      : 'حفظ دون إنترنت'
                                  }
                                >
                                  {busy ? (
                                    <Loader2
                                      size={
                                        16
                                      }
                                      className="animate-spin"
                                    />
                                  ) : saved ? (
                                    <Trash2
                                      size={
                                        16
                                      }
                                    />
                                  ) : (
                                    <WifiOff
                                      size={
                                        16
                                      }
                                    />
                                  )}

                                  <span className="hidden sm:inline">
                                    {saved
                                      ? 'محفوظ'
                                      : 'دون نت'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(
                                      item.sourceUrl,
                                      '_blank',
                                      'noopener,noreferrer'
                                    )
                                  }
                                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-mushaf-border/20 bg-mushaf-paper px-4 text-xs font-black text-mushaf-dark transition hover:border-mushaf-teal hover:text-mushaf-teal"
                                  title="فتح المصدر"
                                >
                                  <ExternalLink
                                    size={
                                      16
                                    }
                                  />

                                  <span className="hidden sm:inline">
                                    المصدر
                                  </span>
                                </button>
                              </div>
                            </article>
                          )
                        }
                      )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-mushaf-border/15 bg-white/70 p-4 text-xs leading-7 text-gray-500">
                      <span className="font-black text-mushaf-dark">
                        توضيح المصدر:
                      </span>{' '}
                      كل بطاقة هنا مرتبطة برابط ملف صوتي فعلي،
                      مع اسم المصدر ورابط المادة الأصلية. لا يتم
                      عرض أي إذاعة أو بث مباشر داخل هذه الأقسام.
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {player && (
        <div className="fixed inset-x-3 bottom-5 z-50 sm:bottom-7">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.8rem] border border-mushaf-gold/25 bg-gradient-to-br from-[#155861] via-[#11474E] to-[#0B343A] text-white shadow-[0_25px_90px_rgba(13,56,62,0.40)]">
            <div className="border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/55">
                  <ListMusic
                    size={
                      14
                    }
                  />

                  <span>
                    {queue.length
                      ? `${arabicDigits(
                          queueIndex +
                            1
                        )} من ${arabicDigits(
                          queue.length
                        )}`
                      : 'المشغل'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentOffline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mushaf-gold/15 px-2 py-1 text-[10px] font-black text-mushaf-gold">
                      <WifiOff
                        size={
                          11
                        }
                      />
                      دون نت
                    </span>
                  )}

                  {player.sourceName && (
                    <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-white/60 sm:inline-flex">
                      {player.sourceName}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setShowMorePlayer(
                        (value) =>
                          !value
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                    aria-label="خيارات المشغل"
                  >
                    <MoreHorizontal
                      size={
                        16
                      }
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      closePlayer
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                    aria-label="إغلاق المشغل"
                  >
                    <X
                      size={
                        16
                      }
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <AudioAvatar
                  size="player"
                  playing={
                    isPlaying
                  }
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-black text-mushaf-gold">
                    {
                      player.reciterName
                    }
                  </p>

                  <p className="mt-1 truncate text-base font-black">
                    {
                      player.title
                    }
                  </p>

                  <p className="mt-1 truncate text-[11px] text-white/45">
                    {
                      player.subtitle
                    }
                  </p>
                </div>

                <div className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() =>
                      goQueue(-1)
                    }
                    disabled={
                      !queue.length
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
                    title="السابق"
                  >
                    <SkipBack
                      size={
                        17
                      }
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void togglePlayer()
                    }
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-mushaf-teal shadow-lg"
                    title={
                      isPlaying
                        ? 'إيقاف مؤقت'
                        : 'تشغيل'
                    }
                  >
                    {isPlaying ? (
                      <Pause
                        size={
                          21
                        }
                        fill="currentColor"
                      />
                    ) : (
                      <Play
                        size={
                          21
                        }
                        fill="currentColor"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      goQueue(1)
                    }
                    disabled={
                      !queue.length
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
                    title="التالي"
                  >
                    <SkipForward
                      size={
                        17
                      }
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void togglePlayer()
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-mushaf-teal shadow-lg sm:hidden"
                  title={
                    isPlaying
                      ? 'إيقاف مؤقت'
                      : 'تشغيل'
                  }
                >
                  {isPlaying ? (
                    <Pause
                      size={
                        21
                      }
                      fill="currentColor"
                    />
                  ) : (
                    <Play
                      size={
                        21
                      }
                      fill="currentColor"
                    />
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="w-12 text-center text-[10px] font-bold text-white/50">
                  {formatDuration(
                    progress
                  )}
                </span>

                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(
                    progress,
                    duration ||
                      0
                  )}
                  onChange={(
                    event
                  ) =>
                    seekTo(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  disabled={
                    !duration
                  }
                  className="w-full accent-[var(--mushaf-gold,#D97706)]"
                  aria-label="تقدم الملف"
                />

                <span className="w-12 text-center text-[10px] font-bold text-white/50">
                  {formatDuration(
                    duration
                  )}
                </span>
              </div>

              {showMorePlayer && (
                <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      سرعة التشغيل
                    </p>

                    <select
                      value={
                        playbackRate
                      }
                      onChange={(
                        event
                      ) =>
                        setPlaybackRate(
                          Number(
                            event
                              .target
                              .value
                          )
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-black text-white outline-none"
                    >
                      {[
                        0.75,
                        1,
                        1.25,
                        1.5,
                        1.75,
                        2,
                      ].map(
                        (
                          rate
                        ) => (
                          <option
                            key={
                              rate
                            }
                            value={
                              rate
                            }
                            className="text-black"
                          >
                            {rate}x
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      التكرار
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setRepeatMode(
                          (
                            current
                          ) =>
                            current ===
                            'off'
                              ? 'one'
                              : current ===
                                  'one'
                                ? 'all'
                                : 'off'
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black"
                    >
                      {repeatMode ===
                      'off'
                        ? 'بدون تكرار'
                        : repeatMode ===
                            'one'
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
                        onClick={() =>
                          setIsMuted(
                            (
                              value
                            ) =>
                              !value
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center"
                        aria-label="كتم الصوت"
                      >
                        {isMuted ? (
                          <VolumeX
                            size={
                              16
                            }
                          />
                        ) : (
                          <Volume2
                            size={
                              16
                            }
                          />
                        )}
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={
                          isMuted
                            ? 0
                            : volume
                        }
                        onChange={(
                          event
                        ) => {
                          setVolume(
                            Number(
                              event
                                .target
                                .value
                            )
                          )

                          setIsMuted(
                            false
                          )
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
                      disabled={
                        offlineBusyKey !==
                        null
                      }
                      onClick={() =>
                        currentOffline
                          ? void removeOfflinePlayer(
                              player
                            )
                          : void saveOfflinePlayer(
                              player
                            )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black disabled:opacity-35"
                    >
                      {offlineBusyKey ===
                      offlineKeyFor(
                        player
                      ) ? (
                        <Loader2
                          size={
                            15
                          }
                          className="animate-spin"
                        />
                      ) : currentOffline ? (
                        <Trash2
                          size={
                            15
                          }
                        />
                      ) : (
                        <WifiOff
                          size={
                            15
                          }
                        />
                      )}

                      {currentOffline
                        ? 'حذف النسخة'
                        : 'حفظ دون نت'}
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold text-white/45">
                      المصدر
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          player.sourceUrl
                        ) {
                          window.open(
                            player.sourceUrl,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      }}
                      disabled={
                        !player.sourceUrl
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black disabled:opacity-30"
                    >
                      <ExternalLink
                        size={
                          15
                        }
                      />
                      فتح المصدر
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-mushaf-gold/20 bg-[#0D383E] px-5 py-3 text-center text-sm font-black text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}