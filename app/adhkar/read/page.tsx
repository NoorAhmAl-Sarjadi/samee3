'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  Copy,
  Heart,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

type AdhkarItem = {
  id: number
  text: string
  count: number
  audio?: string
  filename?: string
}

type AdhkarCategory = {
  id: number
  category: string
  audio?: string
  filename?: string
  array: AdhkarItem[]
}

type AdhkarType = 'morning' | 'evening' | 'sleep' | 'waking'

type AudioTrack = {
  type: AdhkarType
  title: string
  url: string
}

type AdhkarReciter = {
  id: string
  name: string
  note: string
  itemAudio?: boolean
  tracks: Partial<Record<AdhkarType, AudioTrack>>
}

type PlayerMode = 'item' | 'section' | null

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const AUDIO_BASE_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main'
const ARCHIVE_AUDIO_BASE = 'https://archive.org/download/makkah-live.-net-athkar-01'

const ADHKAR_RECITERS: AdhkarReciter[] = [
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    note: 'تشغيل مفرد للذكر عند توفر الملف الصوتي في بيانات الأذكار، مع تكرار العدد والانتقال تلقائيًا.',
    itemAudio: true,
    tracks: {
      waking: {
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        url: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlDuraihim/ar_002_Hisn_Almuslim_AlDuraihim.mp3',
      },
    },
  },
  {
    id: 'sulaiman-al-shuhayhi',
    name: 'سليمان بن محمد الشويهي',
    note: 'تسجيل مباشر لأذكار الاستيقاظ من حصن المسلم داخل المشغل.',
    tracks: {
      waking: {
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        url: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlShwehi/ar_003_Hisn_Almuslim_Alshwehi.mp3',
      },
    },
  },
  {
    id: 'mishary-alafasy',
    name: 'مشاري بن راشد العفاسي',
    note: 'تسجيلات مباشرة للصباح والمساء والنوم والاستيقاظ.',
    tracks: {
      morning: { type: 'morning', title: 'أذكار الصباح', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_03.mp3` },
      evening: { type: 'evening', title: 'أذكار المساء', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_04.mp3` },
      sleep: { type: 'sleep', title: 'أذكار النوم', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_11.mp3` },
      waking: { type: 'waking', title: 'أذكار الاستيقاظ', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_01.mp3` },
    },
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    note: 'تسجيلات مباشرة للصباح والمساء.',
    tracks: {
      morning: { type: 'morning', title: 'أذكار الصباح', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_05.mp3` },
      evening: { type: 'evening', title: 'أذكار المساء', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_06.mp3` },
    },
  },
  {
    id: 'mohamed-jibril',
    name: 'محمد جبريل',
    note: 'تسجيلات مباشرة للصباح والمساء.',
    tracks: {
      morning: { type: 'morning', title: 'أذكار الصباح', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_07.mp3` },
      evening: { type: 'evening', title: 'أذكار المساء', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_08.mp3` },
    },
  },
  {
    id: 'nasser-alqatami',
    name: 'ناصر القطامي',
    note: 'تسجيل مباشر لأذكار اليوم والليلة، ويظهر في ورد الصباح والمساء.',
    tracks: {
      morning: { type: 'morning', title: 'أذكار اليوم والليلة', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_02.mp3` },
      evening: { type: 'evening', title: 'أذكار اليوم والليلة', url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_02.mp3` },
    },
  },
]

const TYPE_TITLES: Record<AdhkarType, string> = {
  morning: 'أذكار الصباح',
  evening: 'أذكار المساء',
  sleep: 'أذكار النوم',
  waking: 'أذكار الاستيقاظ',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  if (Array.isArray(value.data)) return value.data
  if (Array.isArray(value.adhkar)) return value.adhkar
  if (Array.isArray(value.categories)) return value.categories
  return []
}

function normalizeItem(value: unknown, fallbackId: number): AdhkarItem | null {
  if (!isRecord(value)) return null
  const text = typeof value.text === 'string' ? value.text.trim() : ''
  if (!text) return null

  const id = Number(value.id)
  const count = Number(value.count)

  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    text,
    count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
    ...(typeof value.audio === 'string' && value.audio.trim() ? { audio: value.audio.trim() } : {}),
    ...(typeof value.filename === 'string' && value.filename.trim() ? { filename: value.filename.trim() } : {}),
  }
}

function normalizeCategory(value: unknown, fallbackId: number): AdhkarCategory | null {
  if (!isRecord(value)) return null
  const category = typeof value.category === 'string' ? value.category.trim() : ''
  if (!category) return null

  const array = (Array.isArray(value.array) ? value.array : [])
    .map((entry, index) => normalizeItem(entry, index + 1))
    .filter((entry): entry is AdhkarItem => entry !== null)

  if (!array.length) return null

  const id = Number(value.id)
  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    category,
    array,
    ...(typeof value.audio === 'string' && value.audio.trim() ? { audio: value.audio.trim() } : {}),
    ...(typeof value.filename === 'string' && value.filename.trim() ? { filename: value.filename.trim() } : {}),
  }
}

function normalizeCategories(value: unknown): AdhkarCategory[] {
  const raw: unknown[] = readArray(value)
  return raw
    .map((entry, index) => normalizeCategory(entry, index + 1))
    .filter((entry): entry is AdhkarCategory => entry !== null)
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function toAbsoluteAudioUrl(value?: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${AUDIO_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

function buildCounts(items: AdhkarItem[]) {
  const next: Record<number, number> = {}
  items.forEach((item) => {
    next[item.id] = Math.max(1, Number(item.count) || 1)
  })
  return next
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '٠٠:٠٠'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function displayCategoryName(category: AdhkarCategory) {
  const name = category.category
  if (name.includes('الصباح') && name.includes('المساء')) return 'أذكار الصباح والمساء'
  if (name.includes('الصباح')) return 'أذكار الصباح'
  if (name.includes('المساء')) return 'أذكار المساء'
  if (name.includes('النوم')) return 'أذكار النوم'
  if (name.includes('الاستيقاظ')) return 'أذكار الاستيقاظ'
  return 'أذكار متنوعة'
}

function ReaderSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <Headphones className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mushaf-teal" size={19} />
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        className="w-full appearance-none rounded-2xl border border-white/10 bg-white/10 px-11 py-3.5 text-sm font-black text-white outline-none backdrop-blur focus:ring-2 focus:ring-white/20"
        aria-label="اختر القارئ"
      >
        {ADHKAR_RECITERS.map((reader) => (
          <option key={reader.id} value={reader.id} className="bg-white text-mushaf-dark">
            {reader.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={17} />
    </div>
  )
}

function ReadAdhkarContent() {
  const searchParams = useSearchParams()
  const requestedCategoryId = Number(searchParams.get('categoryId') || 0)
  const requestedTypeRaw = searchParams.get('type')
  const requestedReciterId = searchParams.get('reciter') || ''

  const type: AdhkarType =
    requestedTypeRaw === 'evening' || requestedTypeRaw === 'sleep' || requestedTypeRaw === 'waking'
      ? requestedTypeRaw
      : 'morning'

  const [reciterId, setReciterId] = useState(
    ADHKAR_RECITERS.some((reader) => reader.id === requestedReciterId)
      ? requestedReciterId
      : ADHKAR_RECITERS[0].id,
  )
  const [items, setItems] = useState<AdhkarItem[]>([])
  const [pageTitle, setPageTitle] = useState(TYPE_TITLES[type])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [completedIds, setCompletedIds] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [playerMode, setPlayerMode] = useState<PlayerMode>(null)
  const [playerCurrent, setPlayerCurrent] = useState(0)
  const [playerDuration, setPlayerDuration] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playerTokenRef = useRef(0)
  const sequenceActiveRef = useRef(false)

  const selectedReciter =
    ADHKAR_RECITERS.find((reader) => reader.id === reciterId) ?? ADHKAR_RECITERS[0]

  const selectedTrack = selectedReciter.tracks[type]
  const hasItemAudio = Boolean(selectedReciter.itemAudio && items.some((item) => Boolean(item.audio)))
  const hasSectionAudio = Boolean(selectedTrack?.url)

  const activeIndex = useMemo(
    () => items.findIndex((item) => item.id === activeId),
    [items, activeId],
  )
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null

  const progress = items.length
    ? Math.round((completedIds.length / items.length) * 100)
    : 0

  const remaining = activeItem
    ? counts[activeItem.id] ?? activeItem.count
    : 0

  const stopAudio = useCallback(() => {
    playerTokenRef.current += 1
    sequenceActiveRef.current = false

    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.ontimeupdate = null
      audio.onloadedmetadata = null
      audio.onplay = null
      audio.onpause = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }

    setPlaying(false)
    setPlayerMode(null)
    setPlayerCurrent(0)
    setPlayerDuration(0)
  }, [])

  const markCompleted = useCallback((item: AdhkarItem) => {
    setCounts((previous) => ({ ...previous, [item.id]: 0 }))
    setCompletedIds((previous) =>
      previous.includes(item.id) ? previous : [...previous, item.id],
    )
  }, [])

  const findNextIncompleteIndex = useCallback(
    (startAt: number) => {
      for (let index = startAt; index < items.length; index += 1) {
        const item = items[index]
        const left = counts[item.id] ?? item.count
        if (left > 0) return index
      }
      return -1
    },
    [counts, items],
  )

  const playItemAt = useCallback(
    (index: number, repetition = 1) => {
      if (index < 0 || index >= items.length) return
      const item = items[index]
      const url = toAbsoluteAudioUrl(item.audio)
      if (!url) return

      playerTokenRef.current += 1
      const token = playerTokenRef.current
      sequenceActiveRef.current = true
      setPlayerMode('item')
      setActiveId(item.id)
      setPlaying(false)
      setPlayerCurrent(0)
      setPlayerDuration(0)

      const previous = audioRef.current
      if (previous) {
        previous.pause()
        previous.removeAttribute('src')
        previous.load()
      }

      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : 1
      audioRef.current = audio

      audio.onloadedmetadata = () => {
        if (token !== playerTokenRef.current) return
        setPlayerDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      }

      audio.ontimeupdate = () => {
        if (token !== playerTokenRef.current) return
        setPlayerCurrent(audio.currentTime)
      }

      audio.onplay = () => {
        if (token !== playerTokenRef.current) return
        setPlaying(true)
      }

      audio.onpause = () => {
        if (token !== playerTokenRef.current) return
        setPlaying(false)
      }

      audio.onerror = () => {
        if (token !== playerTokenRef.current) return
        sequenceActiveRef.current = false
        setPlaying(false)
        setPlayerMode(null)
        setErrorMessage('تعذر تشغيل التسجيل لهذا الذكر حاليًا، ويمكنك متابعة القراءة والعد بشكل طبيعي.')
      }

      audio.onended = () => {
        if (token !== playerTokenRef.current) return

        setPlayerCurrent(0)
        const total = Math.max(1, Number(item.count) || 1)
        const nextRemaining = Math.max(0, total - repetition)

        setCounts((previousCounts) => ({
          ...previousCounts,
          [item.id]: nextRemaining,
        }))

        if (repetition < total && sequenceActiveRef.current) {
          audio.currentTime = 0
          void audio.play().catch((error) => {
            console.error('Repeat playback error:', error)
            sequenceActiveRef.current = false
            setPlaying(false)
            setPlayerMode(null)
          })
          return
        }

        markCompleted(item)
        const nextIndex = findNextIncompleteIndex(index + 1)

        if (nextIndex >= 0 && sequenceActiveRef.current) {
          playItemAt(nextIndex, 1)
          return
        }

        sequenceActiveRef.current = false
        setPlaying(false)
        setPlayerMode(null)
        setActiveId(item.id)
      }

      void audio.play().catch((error) => {
        console.error('Adhkar playback error:', error)
        if (token !== playerTokenRef.current) return
        sequenceActiveRef.current = false
        setPlaying(false)
        setPlayerMode(null)
        setErrorMessage('لم يسمح المتصفح بتشغيل الصوت تلقائيًا. اضغط تشغيل مرة أخرى.')
      })
    },
    [counts, findNextIncompleteIndex, items, markCompleted, muted],
  )

  const playSelectedSection = useCallback(() => {
    if (!selectedTrack?.url) return

    playerTokenRef.current += 1
    const token = playerTokenRef.current
    sequenceActiveRef.current = false
    setPlayerMode('section')
    setActiveId(null)
    setPlaying(false)
    setPlayerCurrent(0)
    setPlayerDuration(0)

    const previous = audioRef.current
    if (previous) {
      previous.pause()
      previous.removeAttribute('src')
      previous.load()
    }

    const audio = new Audio(selectedTrack.url)
    audio.preload = 'metadata'
    audio.volume = muted ? 0 : 1
    audioRef.current = audio

    audio.onloadedmetadata = () => {
      if (token !== playerTokenRef.current) return
      setPlayerDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    audio.ontimeupdate = () => {
      if (token !== playerTokenRef.current) return
      setPlayerCurrent(audio.currentTime)
    }
    audio.onplay = () => {
      if (token !== playerTokenRef.current) return
      setPlaying(true)
    }
    audio.onpause = () => {
      if (token !== playerTokenRef.current) return
      setPlaying(false)
    }
    audio.onended = () => {
      if (token !== playerTokenRef.current) return
      setPlaying(false)
      setPlayerMode(null)
    }
    audio.onerror = () => {
      if (token !== playerTokenRef.current) return
      setPlaying(false)
      setPlayerMode(null)
      setErrorMessage('تعذر تشغيل هذا الورد الصوتي حاليًا، ويمكنك متابعة الأذكار قراءةً وعدًا.')
    }

    void audio.play().catch((error) => {
      console.error('Section playback error:', error)
      if (token !== playerTokenRef.current) return
      setPlaying(false)
      setPlayerMode(null)
      setErrorMessage('اضغط تشغيل مرة أخرى لبدء الورد الصوتي.')
    })
  }, [muted, selectedTrack])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('samee3_adhkar_reciter')
      if (!requestedReciterId && saved && ADHKAR_RECITERS.some((reader) => reader.id === saved)) {
        setReciterId(saved)
      }
    } catch {
      // Ignore storage failures.
    }
  }, [requestedReciterId])

  useEffect(() => {
    try {
      localStorage.setItem('samee3_adhkar_reciter', reciterId)
    } catch {
      // Ignore storage failures.
    }
  }, [reciterId])

  useEffect(() => {
    stopAudio()
  }, [reciterId, stopAudio])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setErrorMessage('')
      stopAudio()

      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const json: unknown = await response.json()
        const categories = normalizeCategories(json)
        const selected = requestedCategoryId
          ? categories.find((category) => category.id === requestedCategoryId)
          : categories.find((category) => {
              const name = category.category
              if (type === 'sleep') return name.includes('النوم')
              if (type === 'waking') return name.includes('الاستيقاظ')
              if (type === 'evening') return name.includes('المساء') && name.includes('الصباح')
              return name.includes('الصباح') && name.includes('المساء')
            })

        if (!selected) throw new Error('Category not found')

        if (!cancelled) {
          setItems(selected.array)
          setCounts(buildCounts(selected.array))
          setCompletedIds([])
          setActiveId(null)
          setPageTitle(requestedCategoryId ? displayCategoryName(selected) : TYPE_TITLES[type])
        }
      } catch (error) {
        console.error('Adhkar page load error:', error)
        if (!cancelled) {
          setItems([])
          setCounts({})
          setCompletedIds([])
          setActiveId(null)
          setErrorMessage('تعذر تحميل قسم الأذكار حاليًا. حاول تحديث الصفحة.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [requestedCategoryId, stopAudio, type])

  useEffect(() => {
    const key = `samee3_adhkar_favorites_${requestedCategoryId || type}`
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]')
      setFavoriteIds(Array.isArray(saved) ? saved.map(Number).filter(Number.isFinite) : [])
    } catch {
      setFavoriteIds([])
    }
  }, [requestedCategoryId, type])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : 1
    }
  }, [muted])

  const handleReaderChange = (value: string) => {
    if (!ADHKAR_RECITERS.some((reader) => reader.id === value)) return
    stopAudio()
    setReciterId(value)
  }

  const handleTap = (item: AdhkarItem) => {
    const current = counts[item.id] ?? item.count
    if (current <= 0) return

    if (activeId === item.id && playing && playerMode === 'item') {
      stopAudio()
    }

    setActiveId(item.id)
    const next = Math.max(0, current - 1)
    setCounts((previous) => ({ ...previous, [item.id]: next }))

    if (next === 0) {
      markCompleted(item)
    }
  }

  const startSelectedItem = (item: AdhkarItem) => {
    const index = items.findIndex((candidate) => candidate.id === item.id)
    if (index < 0 || !item.audio) return

    const total = Math.max(1, Number(item.count) || 1)
    const currentRemaining = counts[item.id] ?? total
    const startRepetition = currentRemaining > 0
      ? Math.max(1, total - currentRemaining + 1)
      : 1

    setErrorMessage('')
    setCompletedIds((previous) => previous.filter((id) => id !== item.id))
    setCounts((previous) => ({
      ...previous,
      [item.id]: currentRemaining > 0 ? currentRemaining : total,
    }))
    playItemAt(index, startRepetition)
  }

  const toggleMainPlayer = () => {
    const audio = audioRef.current

    if (!audio) {
      if (playerMode === 'section' && selectedTrack?.url) {
        playSelectedSection()
      } else if (activeItem?.audio) {
        startSelectedItem(activeItem)
      } else if (hasSectionAudio) {
        playSelectedSection()
      }
      return
    }

    if (playing) {
      sequenceActiveRef.current = false
      audio.pause()
      return
    }

    sequenceActiveRef.current = playerMode === 'item'
    void audio.play().catch((error) => {
      console.error('Resume playback error:', error)
      setErrorMessage('اضغط تشغيل مرة أخرى لبدء الصوت.')
    })
  }

  const resetItem = (item: AdhkarItem) => {
    stopAudio()
    setActiveId(item.id)
    setCompletedIds((previous) => previous.filter((id) => id !== item.id))
    setCounts((previous) => ({
      ...previous,
      [item.id]: Math.max(1, Number(item.count) || 1),
    }))
  }

  const resetAll = () => {
    stopAudio()
    setActiveId(null)
    setCompletedIds([])
    setCounts(buildCounts(items))
  }

  const copyItem = async (item: AdhkarItem) => {
    try {
      await navigator.clipboard.writeText(item.text)
      setCopiedId(item.id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const toggleFavorite = (item: AdhkarItem) => {
    const key = `samee3_adhkar_favorites_${requestedCategoryId || type}`
    setFavoriteIds((previous) => {
      const next = previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id]
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Ignore storage failures.
      }
      return next
    })
  }

  const displayPlayerTitle =
    playerMode === 'section'
      ? selectedTrack?.title ?? pageTitle
      : activeItem
        ? activeItem.text
        : pageTitle

  return (
    <div className="min-h-screen bg-mushaf-paper pb-32" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-mushaf-border/30 bg-mushaf-paper/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/adhkar"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-mushaf-border/20 bg-white text-mushaf-teal shadow-sm"
            aria-label="العودة إلى الأذكار"
          >
            <ChevronRight size={21} />
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-black text-mushaf-dark">{pageTitle}</h1>
            <p className="mt-0.5 text-[11px] text-gray-500">قراءة وعداد وصوت القارئ المحدد</p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((previous) => !previous)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-mushaf-border/20 bg-white text-mushaf-teal shadow-sm"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </div>

        <div className="mx-auto max-w-4xl px-5 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs font-black text-gray-500">
            <span>الإنجاز</span>
            <span className="text-mushaf-teal">{arabicDigits(progress)}٪</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mushaf-teal to-mushaf-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pt-5 sm:px-5">
        <section className="overflow-hidden rounded-[2rem] border border-mushaf-gold/20 bg-gradient-to-br from-[#175E67] via-[#11474E] to-[#0D383E] p-5 text-white shadow-xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Headphones size={25} className="text-mushaf-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-mushaf-gold">اختر القارئ</p>
              <h2 className="mt-1 text-xl font-black">{selectedReciter.name}</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">{selectedReciter.note}</p>
              <div className="mt-4">
                <ReaderSelect value={reciterId} onChange={handleReaderChange} />
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-900">
            {errorMessage}
          </div>
        )}

        <section className="mt-4 rounded-[2rem] border border-mushaf-border/40 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black text-mushaf-gold">مشغل الورد</p>
              <h2 className="mt-1 text-lg font-black text-mushaf-dark">{displayPlayerTitle}</h2>
            </div>
            <span className={`rounded-xl px-3 py-2 text-[10px] font-black ${hasItemAudio ? 'bg-emerald-50 text-emerald-600' : hasSectionAudio ? 'bg-mushaf-teal/10 text-mushaf-teal' : 'bg-gray-100 text-gray-500'}`}>
              {hasItemAudio ? 'تسجيلات مفردة' : hasSectionAudio ? 'ورد صوتي' : 'قراءة فقط'}
            </span>
          </div>

          <div className="rounded-[1.7rem] bg-gradient-to-br from-[#175E67] to-[#0D383E] p-4 text-white shadow-lg sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Headphones size={22} className="text-mushaf-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{selectedReciter.name}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-white/65">
                  {activeItem && playerMode === 'item' ? activeItem.text : hasSectionAudio ? selectedTrack?.title : 'لا يوجد تسجيل مطابق لكل ذكر لهذا القارئ في هذا القسم.'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleMainPlayer}
                disabled={!hasItemAudio && !hasSectionAudio && !activeItem?.audio}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mushaf-gold text-white shadow-md disabled:opacity-40"
                aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              {playing && (
                <button
                  type="button"
                  onClick={stopAudio}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"
                  aria-label="إيقاف"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-[10px] text-white/60">
                <span>{formatTime(playerCurrent)}</span>
                <span>{formatTime(playerDuration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(playerDuration, 1)}
                step={0.1}
                value={Math.min(playerCurrent, Math.max(playerDuration, 1))}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const next = Number(event.target.value)
                  if (audioRef.current) audioRef.current.currentTime = next
                  setPlayerCurrent(next)
                }}
                className="w-full accent-[rgb(217,119,6)]"
                aria-label="موضع التسجيل"
              />
            </div>

            {activeItem && playerMode === 'item' && (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-xs">
                <span className="text-white/65">المتبقي</span>
                <strong className="text-mushaf-gold">{arabicDigits(remaining)}</strong>
              </div>
            )}

            {hasSectionAudio && !hasItemAudio && (
              <button
                type="button"
                onClick={playSelectedSection}
                className="mt-3 w-full rounded-2xl bg-white py-3 text-sm font-black text-mushaf-teal"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Play size={17} fill="currentColor" />
                  تشغيل الورد بالكامل
                </span>
              </button>
            )}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-mushaf-dark">{pageTitle}</h2>
            <p className="mt-1 text-xs text-gray-400">اضغط على نص الذكر للعد — وعند اكتمال العدد يظهر «تم».</p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-gray-500 shadow-sm border border-mushaf-border/30"
          >
            <RotateCcw size={16} />
            إعادة الكل
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-mushaf-teal">
            <Loader2 size={40} className="animate-spin" />
            <p className="font-bold">جاري تجهيز الورد...</p>
          </div>
        ) : items.length ? (
          <div className="mt-4 flex flex-col gap-4">
            {items.map((item, index) => {
              const current = counts[item.id] ?? item.count
              const completed = completedIds.includes(item.id) || current === 0
              const active = activeId === item.id
              const favorite = favoriteIds.includes(item.id)
              const itemHasAudio = Boolean(item.audio && selectedReciter.itemAudio)

              return (
                <article
                  key={`${item.id}-${index}`}
                  className={`rounded-[2rem] border bg-white p-5 shadow-sm transition-all ${
                    completed
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : active
                        ? 'border-mushaf-teal/50 shadow-md ring-1 ring-mushaf-teal/10'
                        : 'border-mushaf-border/40'
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-black ${completed ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-mushaf-border/30 bg-mushaf-paper text-mushaf-teal'}`}>
                        {completed ? <Check size={19} /> : arabicDigits(index + 1)}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-400">العدد المطلوب</p>
                        <p className="mt-1 text-sm font-black text-mushaf-dark">{arabicDigits(item.count)} مرات</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(item)}
                      className={`rounded-xl p-2 transition ${favorite ? 'bg-red-50 text-red-500' : 'text-gray-300 hover:bg-red-50 hover:text-red-400'}`}
                      aria-label="المفضلة"
                    >
                      <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTap(item)}
                    disabled={completed}
                    className="w-full text-right disabled:cursor-default"
                    aria-label={`العد للذكر ${index + 1}`}
                  >
                    <p className={`font-uthmani text-2xl leading-[2.2] text-mushaf-dark ${completed ? 'opacity-70' : ''}`}>
                      {item.text}
                    </p>
                  </button>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {itemHasAudio && (
                      <button
                        type="button"
                        onClick={() => {
                          if (active && playing && playerMode === 'item') {
                            sequenceActiveRef.current = false
                            audioRef.current?.pause()
                            return
                          }
                          startSelectedItem(item)
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-teal px-4 py-2.5 text-sm font-black text-white"
                      >
                        {active && playing && playerMode === 'item' ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                        {active && playing && playerMode === 'item' ? 'إيقاف' : 'تشغيل الذكر'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void copyItem(item)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-mushaf-paper px-4 py-2.5 text-sm font-black text-mushaf-teal"
                    >
                      {copiedId === item.id ? <CheckCheck size={17} /> : <Copy size={17} />}
                      {copiedId === item.id ? 'تم النسخ' : 'نسخ'}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetItem(item)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-2.5 text-sm font-black text-gray-500"
                    >
                      <RotateCcw size={17} />
                      إعادة
                    </button>

                    <div className="mr-auto">
                      {completed ? (
                        <span className="inline-flex items-center gap-1 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-600">
                          <CheckCheck size={17} />
                          تم
                        </span>
                      ) : (
                        <div className="min-w-[86px] rounded-2xl border border-mushaf-border/30 bg-mushaf-paper px-3 py-2 text-center">
                          <span className="block text-[10px] font-bold text-gray-400">متبقي</span>
                          <span className="text-lg font-black text-mushaf-teal">{arabicDigits(current)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-mushaf-border/40 bg-white p-8 text-center">
            <p className="font-black text-mushaf-dark">لم يتم تحميل الأذكار.</p>
            <p className="mt-2 text-xs leading-6 text-gray-400">تحقق من الاتصال ثم أعد تحميل الصفحة.</p>
          </div>
        )}

        {progress === 100 && items.length > 0 && (
          <section className="mt-5 rounded-[2rem] border border-mushaf-gold/20 bg-gradient-to-br from-[#175E67] to-[#0D383E] p-7 text-center text-white shadow-xl">
            <CheckCheck size={44} className="mx-auto mb-3 text-mushaf-gold" />
            <h2 className="text-2xl font-black">أتممت الورد</h2>
            <p className="mt-2 text-sm text-white/70">أحسنت، تم إكمال جميع أذكار هذا القسم.</p>
            <Link href="/adhkar" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-mushaf-teal">
              <ChevronRight size={18} />
              العودة للأذكار
            </Link>
          </section>
        )}
      </main>
    </div>
  )
}

export default function ReadAdhkarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mushaf-paper text-mushaf-teal">
          <Loader2 size={40} className="animate-spin" />
          <p className="font-bold">جاري تحميل الأذكار...</p>
        </div>
      }
    >
      <ReadAdhkarContent />
    </Suspense>
  )
}
