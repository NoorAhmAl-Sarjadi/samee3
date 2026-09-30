'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Headphones,
  Heart,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sun,
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

type AdhkarType = 'morning' | 'evening' | 'sleep' | 'waking' | 'daynight'

type AudioTrack = {
  id: string
  type: AdhkarType | 'hisn'
  title: string
  subtitle: string
  audioUrl: string
}

type AdhkarReader = {
  id: string
  name: string
  tracks: AudioTrack[]
  itemAudio: boolean
}

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const AUDIO_BASE_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main'
const MAKKAH_AUDIO = 'https://archive.org/download/makkah-live.-net-athkar-01'

const READERS: AdhkarReader[] = [
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    itemAudio: true,
    tracks: [
      {
        id: 'hamad-waking',
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        subtitle: 'ورد الاستيقاظ',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlDuraihim/ar_002_Hisn_Almuslim_AlDuraihim.mp3',
      },
      {
        id: 'hamad-hisn',
        type: 'hisn',
        title: 'حصن المسلم كاملًا',
        subtitle: 'الكتاب الصوتي كاملًا',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlDuraihim/ar_Hisn_Almuslim_AlDuraihim.mp3',
      },
    ],
  },
  {
    id: 'sulaiman-al-shuhayhi',
    name: 'سليمان بن محمد الشويهي',
    itemAudio: false,
    tracks: [
      {
        id: 'sulaiman-waking',
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        subtitle: 'ورد الاستيقاظ',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlShwehi/ar_003_Hisn_Almuslim_Alshwehi.mp3',
      },
      {
        id: 'sulaiman-hisn',
        type: 'hisn',
        title: 'حصن المسلم كاملًا',
        subtitle: 'الكتاب الصوتي كاملًا',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlShwehi/ar_Hisn_Almuslim_AlShwehi.mp3',
      },
    ],
  },
  {
    id: 'mishary-alafasy',
    name: 'مشاري بن راشد العفاسي',
    itemAudio: false,
    tracks: [
      {
        id: 'mishary-waking',
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        subtitle: 'ورد الاستيقاظ',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_01.mp3`,
      },
      {
        id: 'mishary-daynight',
        type: 'daynight',
        title: 'أذكار اليوم والليلة',
        subtitle: 'ورد اليوم والليلة',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_02.mp3`,
      },
      {
        id: 'mishary-morning',
        type: 'morning',
        title: 'أذكار الصباح',
        subtitle: 'ورد الصباح',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_03.mp3`,
      },
      {
        id: 'mishary-evening',
        type: 'evening',
        title: 'أذكار المساء',
        subtitle: 'ورد المساء',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_04.mp3`,
      },
      {
        id: 'mishary-sleep',
        type: 'sleep',
        title: 'أذكار النوم',
        subtitle: 'ورد النوم',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_11.mp3`,
      },
    ],
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    itemAudio: false,
    tracks: [
      {
        id: 'faris-morning',
        type: 'morning',
        title: 'أذكار الصباح',
        subtitle: 'ورد الصباح',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_05.mp3`,
      },
      {
        id: 'faris-evening',
        type: 'evening',
        title: 'أذكار المساء',
        subtitle: 'ورد المساء',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_06.mp3`,
      },
      {
        id: 'faris-hisn',
        type: 'hisn',
        title: 'حصن المسلم — مختارات',
        subtitle: 'مختارات صوتية',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_Faris/ar_Hisn_Almuslim_Faris_Abbad.mp3',
      },
    ],
  },
  {
    id: 'mohamed-jibril',
    name: 'محمد جبريل',
    itemAudio: false,
    tracks: [
      {
        id: 'jibril-morning',
        type: 'morning',
        title: 'أذكار الصباح',
        subtitle: 'ورد الصباح',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_07.mp3`,
      },
      {
        id: 'jibril-evening',
        type: 'evening',
        title: 'أذكار المساء',
        subtitle: 'ورد المساء',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_08.mp3`,
      },
    ],
  },
  {
    id: 'nasser-alqatami',
    name: 'ناصر القطامي',
    itemAudio: false,
    tracks: [
      {
        id: 'nasser-daynight',
        type: 'daynight',
        title: 'أذكار اليوم والليلة',
        subtitle: 'ورد اليوم والليلة',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_02.mp3`,
      },
    ],
  },
  {
    id: 'walid-abu-ziyad',
    name: 'وليد أبو زياد',
    itemAudio: false,
    tracks: [
      {
        id: 'walid-hisn',
        type: 'hisn',
        title: 'حصن المسلم — مختارات',
        subtitle: 'مادة صوتية',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/single_01/ar_Hisn_Almuslim_AboZyad.mp3',
      },
    ],
  },
]

const TYPE_CONFIG: Record<
  AdhkarType,
  { title: string; icon: typeof Sun; categoryMatch: string[] }
> = {
  morning: {
    title: 'أذكار الصباح',
    icon: Sun,
    categoryMatch: ['الصباح والمساء'],
  },
  evening: {
    title: 'أذكار المساء',
    icon: Sun,
    categoryMatch: ['الصباح والمساء'],
  },
  sleep: {
    title: 'أذكار النوم',
    icon: Volume2,
    categoryMatch: ['النوم'],
  },
  waking: {
    title: 'أذكار الاستيقاظ',
    icon: Sun,
    categoryMatch: ['الاستيقاظ'],
  },
  daynight: {
    title: 'أذكار اليوم والليلة',
    icon: Sun,
    categoryMatch: ['الصباح والمساء'],
  },
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '٠٠:٠٠'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`.replace(
    /\d/g,
    (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]
  )
}

function absoluteAudioUrl(value?: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${AUDIO_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

function normalizeCategories(value: unknown): AdhkarCategory[] {
  const raw =
    Array.isArray(value)
      ? value
      : Array.isArray((value as { data?: unknown })?.data)
        ? (value as { data: unknown }).data
        : Array.isArray((value as { adhkar?: unknown })?.adhkar)
          ? (value as { adhkar: unknown }).adhkar
          : []

  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object'
    )
    .map((entry) => ({
      id: Number(entry.id) || 0,
      category: String(entry.category || '').trim(),
      audio: typeof entry.audio === 'string' ? entry.audio : undefined,
      filename: typeof entry.filename === 'string' ? entry.filename : undefined,
      array: Array.isArray(entry.array)
        ? entry.array
            .filter(
              (item): item is Record<string, unknown> =>
                Boolean(item) && typeof item === 'object'
            )
            .map((item) => ({
              id: Number(item.id) || 0,
              text: String(item.text || '').trim(),
              count: Math.max(1, Number(item.count) || 1),
              audio: typeof item.audio === 'string' ? item.audio : undefined,
              filename:
                typeof item.filename === 'string' ? item.filename : undefined,
            }))
            .filter((item) => item.id > 0 && item.text)
        : [],
    }))
    .filter((category) => category.id > 0 && category.array.length > 0)
}

function findCategory(
  categories: AdhkarCategory[],
  type: AdhkarType,
  categoryId: number
) {
  if (categoryId > 0) {
    return categories.find((category) => category.id === categoryId) ?? null
  }

  const matches = TYPE_CONFIG[type]?.categoryMatch ?? []
  return (
    categories.find((category) =>
      matches.some((token) => category.category.includes(token))
    ) ?? null
  )
}

function buildInitialCounts(items: AdhkarItem[]) {
  return items.reduce<Record<number, number>>((result, item) => {
    result[item.id] = Math.max(1, Number(item.count) || 1)
    return result
  }, {})
}

function scrollToItem(id: number) {
  window.setTimeout(() => {
    const element = document.getElementById(`adhkar-item-${id}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 160)
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
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none bg-mushaf-paper border border-mushaf-border/50 rounded-2xl px-4 py-3.5 pl-11 font-black text-sm text-mushaf-dark outline-none focus:border-mushaf-teal focus:ring-4 focus:ring-mushaf-teal/10"
        aria-label="اختر قارئ الأذكار"
      >
        {READERS.map((reader) => (
          <option key={reader.id} value={reader.id}>
            {reader.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-mushaf-teal"
      />
    </div>
  )
}

function AudioPlayer({
  track,
  playing,
  currentTime,
  duration,
  muted,
  rate,
  onToggle,
  onSeek,
  onMute,
  onRate,
  onStop,
}: {
  track: AudioTrack | null
  playing: boolean
  currentTime: number
  duration: number
  muted: boolean
  rate: number
  onToggle: () => void
  onSeek: (value: number) => void
  onMute: () => void
  onRate: (value: number) => void
  onStop: () => void
}) {
  if (!track) {
    return (
      <div className="bg-white rounded-[2rem] border border-mushaf-border/40 shadow-sm p-5">
        <div className="rounded-3xl bg-mushaf-paper border border-mushaf-border/30 p-5 text-center">
          <Headphones size={30} className="mx-auto text-mushaf-teal mb-2" />
          <p className="font-black text-mushaf-dark">لا يوجد تسجيل صوتي مطابق لهذا القسم</p>
          <p className="text-xs text-gray-400 mt-1">
            يمكنك قراءة الأذكار والعد عليها بشكل طبيعي.
          </p>
        </div>
      </div>
    )
  }

  const safeDuration = duration > 0 ? duration : 0
  const percentage =
    safeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100)) : 0

  return (
    <section className="bg-gradient-to-br from-[#175E67] via-[#11474E] to-[#0D383E] rounded-[2rem] p-5 sm:p-6 text-white shadow-xl border border-mushaf-gold/20">
      <div className="flex items-center gap-3">
        <div className="w-13 h-13 w-[52px] h-[52px] rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
          <Volume2 size={23} className="text-mushaf-gold" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-mushaf-gold text-[11px] font-black">التشغيل داخل التطبيق</p>
          <h2 className="text-base sm:text-lg font-black truncate mt-1">{track.title}</h2>
          <p className="text-xs text-white/60 mt-1 truncate">{track.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onStop}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center shrink-0"
          aria-label="إيقاف الصوت"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={Math.min(currentTime, safeDuration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="w-full accent-[#D97706] cursor-pointer"
          aria-label="تقدم الصوت"
        />

        <div className="mt-1 flex items-center justify-between text-[10px] text-white/55 font-bold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, currentTime - 10))}
          className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center"
          aria-label="رجوع عشر ثوان"
        >
          <SkipBack size={18} />
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="w-14 h-14 rounded-2xl bg-mushaf-gold text-white flex items-center justify-center shadow-lg hover:scale-105 transition"
          aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>

        <button
          type="button"
          onClick={() => onSeek(Math.min(safeDuration, currentTime + 10))}
          className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center"
          aria-label="تقدم عشر ثوان"
        >
          <SkipForward size={18} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onMute}
          className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
          aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <select
          value={rate}
          onChange={(event) => onRate(Number(event.target.value))}
          className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black text-white outline-none"
          aria-label="سرعة التشغيل"
        >
          <option value={0.8} className="text-black">٠٫٨×</option>
          <option value={1} className="text-black">١×</option>
          <option value={1.15} className="text-black">١٫١٥×</option>
        </select>
      </div>
    </section>
  )
}

function ReadAdhkarContent() {
  const searchParams = useSearchParams()
  const requestedCategoryId = Number(searchParams.get('categoryId') || 0)
  const requestedType = searchParams.get('type')
  const trackId = searchParams.get('track') || ''
  const initialType: AdhkarType =
    requestedType === 'evening' ||
    requestedType === 'sleep' ||
    requestedType === 'waking' ||
    requestedType === 'daynight'
      ? requestedType
      : 'morning'

  const [readerId, setReaderId] = useState(
    READERS.some((reader) => reader.id === searchParams.get('reader'))
      ? String(searchParams.get('reader'))
      : 'hamad-al-drehem'
  )
  const [categories, setCategories] = useState<AdhkarCategory[]>([])
  const [items, setItems] = useState<AdhkarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [completedIds, setCompletedIds] = useState<number[]>([])
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [playerTrack, setPlayerTrack] = useState<AudioTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentItemIndexRef = useRef<number | null>(null)
  const currentRepeatRef = useRef(0)
  const cancelledRef = useRef(false)

  const selectedReader =
    READERS.find((reader) => reader.id === readerId) ?? READERS[0]

  const pageTypeTitle = trackId
    ? selectedReader.tracks.find((track) => track.id === trackId)?.title ?? 'حصن المسلم'
    : TYPE_CONFIG[initialType].title

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.onloadedmetadata = null
      audio.ontimeupdate = null
      audio.onplay = null
      audio.onpause = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    audioRef.current = null
    currentItemIndexRef.current = null
    currentRepeatRef.current = 0
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const saveProgress = useCallback(
    (nextCounts: Record<number, number>, nextCompleted: number[]) => {
      if (!items.length) return
      const key = `samee3_adhkar_progress_${requestedCategoryId || initialType}`
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            readerId,
            counts: nextCounts,
            completedIds: nextCompleted,
            savedAt: Date.now(),
          })
        )
      } catch {
        // Ignore storage errors.
      }
    },
    [initialType, items.length, readerId, requestedCategoryId]
  )

  const markItemCompleted = useCallback(
    (item: AdhkarItem) => {
      setCounts((previous) => {
        const next = { ...previous, [item.id]: 0 }
        setCompletedIds((completedPrevious) => {
          const nextCompleted = completedPrevious.includes(item.id)
            ? completedPrevious
            : [...completedPrevious, item.id]
          saveProgress(next, nextCompleted)
          return nextCompleted
        })
        return next
      })
    },
    [saveProgress]
  )

  const playItemWithHamad = useCallback(
    async (index: number, repetition = 1) => {
      if (!selectedReader.itemAudio) return
      const item = items[index]
      if (!item?.audio) return

      stopAudio()

      currentItemIndexRef.current = index
      currentRepeatRef.current = repetition
      setActiveId(item.id)

      const url = absoluteAudioUrl(item.audio)
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : 1
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onloadedmetadata = () => {
        if (audioRef.current === audio) setDuration(audio.duration || 0)
      }

      audio.ontimeupdate = () => {
        if (audioRef.current === audio) setCurrentTime(audio.currentTime || 0)
      }

      audio.onplay = () => {
        if (audioRef.current === audio) setPlaying(true)
      }

      audio.onpause = () => {
        if (audioRef.current === audio) setPlaying(false)
      }

      audio.onerror = () => {
        if (audioRef.current !== audio) return
        setPlaying(false)
        setError('تعذر تشغيل التسجيل الحالي.')
      }

      audio.onended = async () => {
        if (audioRef.current !== audio) return

        const total = Math.max(1, Number(item.count) || 1)

        if (repetition < total) {
          const nextRemaining = Math.max(0, total - repetition)
          setCounts((previous) => ({
            ...previous,
            [item.id]: nextRemaining,
          }))
          await playItemWithHamad(index, repetition + 1)
          return
        }

        setCounts((previous) => {
          const nextCounts = {
            ...previous,
            [item.id]: 0,
          }

          setCompletedIds((previousCompleted) => {
            const nextCompleted = previousCompleted.includes(item.id)
              ? previousCompleted
              : [...previousCompleted, item.id]

            saveProgress(nextCounts, nextCompleted)
            return nextCompleted
          })

          return nextCounts
        })

        const nextIndex = index + 1
        if (nextIndex < items.length && !cancelledRef.current) {
          setActiveId(items[nextIndex].id)
          scrollToItem(items[nextIndex].id)
          stopAudio()
        } else {
          stopAudio()
        }
      }

      try {
        await audio.play()
      } catch (playError) {
        console.error('Hamad adhkar playback error:', playError)
        if (audioRef.current === audio) {
          setPlaying(false)
          setError('لم يبدأ الصوت. اضغط تشغيل مرة أخرى.')
        }
      }
    },
    [
      completedIds,
      counts,
      items,
      muted,
      rate,
      saveProgress,
      selectedReader.itemAudio,
      stopAudio,
    ]
  )

  const toggleCategoryAudio = useCallback(async () => {
    if (!playerTrack) return

    if (!audioRef.current) {
      const audio = new Audio(playerTrack.audioUrl)
      audio.preload = 'metadata'
      audio.volume = muted ? 0 : 1
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onloadedmetadata = () => setDuration(audio.duration || 0)
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime || 0)
      audio.onplay = () => setPlaying(true)
      audio.onpause = () => setPlaying(false)
      audio.onended = () => {
        setPlaying(false)
        setCurrentTime(0)
      }
      audio.onerror = () => {
        setPlaying(false)
        setError('تعذر تشغيل التسجيل الحالي.')
      }

      try {
        await audio.play()
      } catch (playError) {
        console.error('Category audio error:', playError)
        setPlaying(false)
      }
      return
    }

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }

    try {
      await audioRef.current.play()
    } catch (playError) {
      console.error('Resume category audio error:', playError)
    }
  }, [muted, playerTrack, playing, rate])

  const handleSeek = useCallback((value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, value)
      setCurrentTime(Math.max(0, value))
    }
  }, [])

  const handleTap = useCallback(
    (item: AdhkarItem) => {
      const remaining = counts[item.id] ?? Math.max(1, Number(item.count) || 1)
      if (remaining <= 0) return

      const nextRemaining = remaining - 1
      setActiveId(item.id)

      const nextCounts = {
        ...counts,
        [item.id]: nextRemaining,
      }

      const nextCompleted = nextRemaining === 0
        ? completedIds.includes(item.id)
          ? completedIds
          : [...completedIds, item.id]
        : completedIds

      setCounts(nextCounts)
      setCompletedIds(nextCompleted)
      saveProgress(nextCounts, nextCompleted)

      if (nextRemaining === 0) {
        const currentIndex = items.findIndex((candidate) => candidate.id === item.id)
        const nextItem = items
          .slice(currentIndex + 1)
          .find((candidate) => (counts[candidate.id] ?? candidate.count) > 0)

        if (nextItem) {
          setActiveId(nextItem.id)
          scrollToItem(nextItem.id)
        }
      }
    },
    [completedIds, counts, items, saveProgress]
  )

  const resetItem = useCallback(
    (item: AdhkarItem) => {
      const nextCounts = {
        ...counts,
        [item.id]: Math.max(1, Number(item.count) || 1),
      }
      const nextCompleted = completedIds.filter((id) => id !== item.id)

      setCounts(nextCounts)
      setCompletedIds(nextCompleted)
      setActiveId(item.id)
      saveProgress(nextCounts, nextCompleted)
      stopAudio()
    },
    [completedIds, counts, saveProgress, stopAudio]
  )

  const resetAll = useCallback(() => {
    const nextCounts = buildInitialCounts(items)
    setCounts(nextCounts)
    setCompletedIds([])
    setActiveId(null)
    saveProgress(nextCounts, [])
    stopAudio()
  }, [items, saveProgress, stopAudio])

  const copyItem = useCallback(async (item: AdhkarItem) => {
    try {
      await navigator.clipboard.writeText(item.text)
      setCopiedId(item.id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch (copyError) {
      console.error('Copy adhkar error:', copyError)
    }
  }, [])

  const toggleFavorite = useCallback(
    (item: AdhkarItem) => {
      setFavoriteIds((previous) => {
        const next = previous.includes(item.id)
          ? previous.filter((id) => id !== item.id)
          : [...previous, item.id]

        try {
          localStorage.setItem(
            `samee3_adhkar_favorites_${requestedCategoryId || initialType}`,
            JSON.stringify(next)
          )
        } catch {
          // Ignore storage errors.
        }

        return next
      })
    },
    [initialType, requestedCategoryId]
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem('samee3_adhkar_reader')
      if (saved && READERS.some((reader) => reader.id === saved)) {
        setReaderId(saved)
      }
    } catch {
      // Ignore storage errors.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('samee3_adhkar_reader', readerId)
    } catch {
      // Ignore storage errors.
    }
  }, [readerId])

  useEffect(() => {
    let cancelled = false
    cancelledRef.current = false

    const load = async () => {
      setLoading(true)
      setError('')
      stopAudio()

      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const json = (await response.json()) as unknown
        const nextCategories = normalizeCategories(json)

        if (cancelled) return
        setCategories(nextCategories)

        const category = findCategory(
          nextCategories,
          initialType,
          requestedCategoryId
        )

        if (category) {
          setItems(category.array)

          const savedKey = `samee3_adhkar_progress_${requestedCategoryId || initialType}`
          let restoredCounts: Record<number, number> | null = null
          let restoredCompleted: number[] = []

          try {
            const saved = JSON.parse(localStorage.getItem(savedKey) || 'null')
            if (saved?.counts && typeof saved.counts === 'object') {
              restoredCounts = saved.counts as Record<number, number>
            }
            if (Array.isArray(saved?.completedIds)) {
              restoredCompleted = saved.completedIds.filter(
                (value: unknown): value is number => typeof value === 'number'
              )
            }
          } catch {
            restoredCounts = null
            restoredCompleted = []
          }

          const nextCounts = restoredCounts
            ? category.array.reduce<Record<number, number>>((result, item) => {
                const savedValue = Number(restoredCounts?.[item.id])
                result[item.id] = Number.isFinite(savedValue)
                  ? Math.max(0, Math.min(item.count, savedValue))
                  : Math.max(1, Number(item.count) || 1)
                return result
              }, {})
            : buildInitialCounts(category.array)

          const validCompleted = restoredCompleted.filter((id) =>
            category.array.some((item) => item.id === id)
          )

          setCounts(nextCounts)
          setCompletedIds(validCompleted)
          setActiveId(
            category.array.find((item) => !validCompleted.includes(item.id))?.id ??
              category.array[0]?.id ??
              null
          )

          try {
            const favoriteValue = JSON.parse(
              localStorage.getItem(
                `samee3_adhkar_favorites_${requestedCategoryId || initialType}`
              ) || '[]'
            )
            setFavoriteIds(
              Array.isArray(favoriteValue)
                ? favoriteValue.filter(
                    (value: unknown): value is number => typeof value === 'number'
                  )
                : []
            )
          } catch {
            setFavoriteIds([])
          }
        } else {
          setItems([])
          setCounts({})
          setCompletedIds([])
          setActiveId(null)
          setError('تعذر العثور على هذا القسم من الأذكار.')
        }

        const selectedTrack =
          trackId
            ? selectedReader.tracks.find((track) => track.id === trackId) ?? null
            : selectedReader.tracks.find((track) => track.type === initialType) ?? null

        setPlayerTrack(selectedTrack)
      } catch (loadError) {
        console.error('Adhkar reader load error:', loadError)
        setCategories([])
        setItems([])
        setCounts({})
        setCompletedIds([])
        setActiveId(null)
        setPlayerTrack(null)
        setError('تعذر تحميل الأذكار حاليًا. حاول فتح الصفحة مرة أخرى.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      cancelledRef.current = true
      stopAudio()
    }
  }, [
    initialType,
    requestedCategoryId,
    selectedReader,
    stopAudio,
    trackId,
  ])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = muted ? 0 : 1
    audioRef.current.playbackRate = rate
  }, [muted, rate])

  const completedCount = completedIds.length
  const progress = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0

  const remainingTotal = useMemo(
    () =>
      items.reduce(
        (total, item) => total + (counts[item.id] ?? Math.max(1, item.count)),
        0
      ),
    [counts, items]
  )

  const categoryTitle =
    trackId && playerTrack ? playerTrack.title : TYPE_CONFIG[initialType].title

  const availableTracksForReader = selectedReader.tracks.filter(
    (track) => track.type !== 'hisn'
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-mushaf-paper flex flex-col items-center justify-center gap-4 text-mushaf-teal" dir="rtl">
        <Loader2 size={42} className="animate-spin" />
        <p className="font-black">جاري تجهيز الورد...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mushaf-paper pb-32" dir="rtl">
      <header className="sticky top-0 z-50 bg-mushaf-paper/95 backdrop-blur-xl border-b border-mushaf-border/30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/adhkar"
            className="w-11 h-11 rounded-2xl bg-white border border-mushaf-border/30 text-mushaf-teal flex items-center justify-center shadow-sm shrink-0"
            aria-label="العودة للأذكار"
          >
            <ChevronRight size={21} />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-black text-mushaf-dark text-lg truncate">
              {categoryTitle}
            </h1>
            <p className="text-[10px] text-gray-400 mt-1">
              {selectedReader.name}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMuted((previous) => !previous)}
            className="w-11 h-11 rounded-2xl bg-white border border-mushaf-border/30 text-mushaf-teal flex items-center justify-center shadow-sm shrink-0"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-5 pb-3">
          <div className="flex items-center justify-between text-[11px] font-black text-gray-500 mb-2">
            <span>الإنجاز</span>
            <span className="text-mushaf-teal">{arabicDigits(progress)}٪</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-mushaf-teal to-mushaf-gold rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-5 pt-5">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#175E67] via-[#11474E] to-[#0D383E] rounded-[2.2rem] p-5 sm:p-7 text-white shadow-xl border border-mushaf-gold/20">
          <div className="absolute -top-14 -left-14 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -right-8 w-52 h-52 rounded-full bg-mushaf-gold/10 blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                <Heart size={28} className="text-mushaf-gold" fill="currentColor" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-xl sm:text-2xl">{categoryTitle}</h2>
                <p className="text-white/65 text-sm mt-1 leading-7">
                  اختر القارئ من القائمة، واستمع للصوت المتاح له، واقرأ بقية الأذكار واضغط عليها للعد.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-xs text-white/80 leading-6">
                {error}
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 bg-white rounded-[2rem] border border-mushaf-border/40 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center">
              <Headphones size={21} />
            </div>
            <div>
              <h2 className="font-black text-base text-mushaf-dark">اختر القارئ</h2>
              <p className="text-[10px] text-gray-400 mt-1">غيّر القارئ في أي وقت</p>
            </div>
          </div>

          <ReaderSelect
            value={readerId}
            onChange={(value) => {
              stopAudio()
              setReaderId(value)
            }}
          />

          <div className="mt-3 rounded-2xl bg-mushaf-teal/5 border border-mushaf-teal/10 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-mushaf-teal text-white flex items-center justify-center">
              <Volume2 size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gray-400 font-bold">القارئ الحالي</p>
              <p className="text-sm font-black text-mushaf-teal truncate">{selectedReader.name}</p>
            </div>
            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1 shrink-0">
              {arabicDigits(selectedReader.tracks.length)} تسجيل
            </span>
          </div>
        </section>

        {availableTracksForReader.length > 1 && !trackId && (
          <section className="mt-4 bg-white rounded-[2rem] border border-mushaf-border/40 shadow-sm p-5">
            <h2 className="font-black text-base text-mushaf-dark mb-3">
              الأذكار المتاحة لهذا القارئ
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableTracksForReader.map((track) => (
                <Link
                  key={track.id}
                  href={`/adhkar/read?reader=${selectedReader.id}&type=${track.type}`}
                  className={`rounded-2xl border p-3 transition ${
                    playerTrack?.id === track.id
                      ? 'border-mushaf-teal bg-mushaf-teal/5'
                      : 'border-mushaf-border/30 bg-mushaf-paper hover:border-mushaf-teal/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-mushaf-teal text-white flex items-center justify-center shrink-0">
                      <Volume2 size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-mushaf-dark truncate">{track.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1 truncate">{track.subtitle}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-4">
          <AudioPlayer
            track={playerTrack}
            playing={playing}
            currentTime={currentTime}
            duration={duration}
            muted={muted}
            rate={rate}
            onToggle={() => {
              if (selectedReader.itemAudio && activeId !== null && !playerTrack) {
                const index = items.findIndex((item) => item.id === activeId)
                if (index >= 0) void playItemWithHamad(index, currentRepeatRef.current || 1)
                return
              }
              void toggleCategoryAudio()
            }}
            onSeek={handleSeek}
            onMute={() => setMuted((previous) => !previous)}
            onRate={(value) => setRate(value)}
            onStop={stopAudio}
          />
        </div>

        {items.length ? (
          <>
            <section className="mt-4 bg-white rounded-[2rem] border border-mushaf-border/40 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-lg text-mushaf-dark">الأذكار</h2>
                  <p className="text-[10px] text-gray-400 mt-1">
                    اضغط على نص الذكر للعد — المتبقي {arabicDigits(remainingTotal)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-mushaf-paper text-mushaf-teal px-3 py-2 text-[10px] font-black"
                >
                  <RotateCcw size={15} />
                  إعادة الكل
                </button>
              </div>
            </section>

            <div className="mt-4 flex flex-col gap-4">
              {items.map((item, index) => {
                const remaining = counts[item.id] ?? Math.max(1, item.count)
                const completed = completedIds.includes(item.id) || remaining === 0
                const active = activeId === item.id

                return (
                  <article
                    id={`adhkar-item-${item.id}`}
                    key={`${item.id}-${index}`}
                    className={`bg-white rounded-[2rem] border shadow-sm p-5 transition-all duration-300 ${
                      completed
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : active
                          ? 'border-mushaf-teal/50 shadow-lg ring-2 ring-mushaf-teal/5'
                          : 'border-mushaf-border/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 border ${
                          completed
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-mushaf-paper text-mushaf-teal border-mushaf-border/30'
                        }`}>
                          {completed ? <Check size={19} /> : arabicDigits(index + 1)}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-gray-400">العدد</p>
                          <p className="text-sm font-black text-mushaf-dark">
                            {arabicDigits(item.count)} مرات
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(item)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            favoriteIds.includes(item.id)
                              ? 'bg-red-50 text-red-500'
                              : 'bg-mushaf-paper text-gray-300 hover:text-red-400'
                          }`}
                          aria-label="إضافة للمفضلة"
                        >
                          <Heart size={18} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} />
                        </button>

                        <button
                          type="button"
                          onClick={() => copyItem(item)}
                          className="w-10 h-10 rounded-xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center"
                          aria-label="نسخ الذكر"
                        >
                          {copiedId === item.id ? <CheckCheck size={17} /> : <Copy size={17} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTap(item)}
                      disabled={completed}
                      className="w-full text-right"
                    >
                      <p
                        className={`font-uthmani text-[1.55rem] sm:text-[1.75rem] leading-[2.25] ${
                          completed ? 'text-emerald-900/70' : 'text-mushaf-dark'
                        }`}
                      >
                        {item.text}
                      </p>
                    </button>

                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleTap(item)}
                        disabled={completed}
                        className={`w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center border-4 transition shrink-0 ${
                          completed
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                            : 'bg-mushaf-teal text-white border-mushaf-teal/15 hover:scale-105'
                        }`}
                        aria-label={`العد ${index + 1}`}
                      >
                        {completed ? (
                          <CheckCheck size={22} />
                        ) : (
                          <>
                            <span className="text-[10px] opacity-75">متبقي</span>
                            <span className="text-2xl font-black leading-none mt-1">
                              {arabicDigits(remaining)}
                            </span>
                          </>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-black ${completed ? 'text-emerald-600' : 'text-mushaf-teal'}`}>
                            {completed ? 'تم الذكر' : 'اضغط للعد'}
                          </span>

                          {completed && (
                            <button
                              type="button"
                              onClick={() => resetItem(item)}
                              className="inline-flex items-center gap-1 rounded-xl bg-gray-50 text-gray-500 px-3 py-2 text-[10px] font-black"
                            >
                              <RotateCcw size={14} />
                              إعادة
                            </button>
                          )}
                        </div>

                        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-mushaf-teal to-mushaf-gold rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  ((item.count - remaining) / Math.max(1, item.count)) * 100
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        {selectedReader.itemAudio && item.audio && (
                          <button
                            type="button"
                            onClick={() => {
                              const indexOfItem = items.findIndex(
                                (candidate) => candidate.id === item.id
                              )

                              if (activeId === item.id && playing) {
                                if (audioRef.current) {
                                  audioRef.current.pause()
                                  setPlaying(false)
                                }
                              } else if (indexOfItem >= 0) {
                                void playItemWithHamad(indexOfItem, 1)
                              }
                            }}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-mushaf-paper text-mushaf-teal border border-mushaf-border/30 px-3 py-2 text-[10px] font-black"
                          >
                            {activeId === item.id && playing ? (
                              <Pause size={14} />
                            ) : (
                              <Play size={14} fill="currentColor" />
                            )}
                            تشغيل صوت الذكر
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {progress === 100 && (
              <section className="mt-5 rounded-[2rem] bg-gradient-to-br from-[#175E67] to-[#0D383E] p-7 text-center text-white shadow-xl border border-mushaf-gold/20">
                <CheckCheck size={48} className="mx-auto text-mushaf-gold mb-3" />
                <h2 className="font-black text-2xl">تم إكمال الورد</h2>
                <p className="text-white/65 text-sm mt-2">
                  أتممت {pageTypeTitle} كاملًا.
                </p>

                <div className="mt-5 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white text-mushaf-teal px-5 py-3 text-sm font-black"
                  >
                    <RotateCcw size={17} />
                    بدء الورد من جديد
                  </button>

                  <Link
                    href="/adhkar"
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black"
                  >
                    <ChevronRight size={17} />
                    الأذكار
                  </Link>
                </div>
              </section>
            )}
          </>
        ) : trackId ? (
          <section className="mt-5 bg-white rounded-[2rem] border border-mushaf-border/40 shadow-sm p-5">
            <div className="rounded-3xl bg-mushaf-paper p-5 border border-mushaf-border/30 text-center">
              <Headphones size={33} className="mx-auto text-mushaf-teal mb-3" />
              <h2 className="font-black text-lg text-mushaf-dark">المكتبة الصوتية</h2>
              <p className="text-xs text-gray-400 mt-2 leading-6">
                شغّل التسجيل من المشغل بالأعلى، ثم اختر أي قسم من الأذكار النصية للقراءة والعد.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/adhkar/read?reader=${selectedReader.id}&categoryId=${category.id}`}
                  className="rounded-2xl border border-mushaf-border/30 bg-white p-4 hover:border-mushaf-teal/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-sm text-mushaf-dark">{category.category}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {arabicDigits(category.array.length)} ذكر
                      </p>
                    </div>
                    <ChevronRight size={17} className="text-mushaf-gold" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default function ReadAdhkarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mushaf-paper flex flex-col items-center justify-center gap-4 text-mushaf-teal" dir="rtl">
          <Loader2 size={42} className="animate-spin" />
          <p className="font-black">جاري تحميل الأذكار...</p>
        </div>
      }
    >
      <ReadAdhkarContent />
    </Suspense>
  )
}
