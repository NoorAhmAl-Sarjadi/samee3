'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Play,
  Pause,
  Headphones,
  Search,
  Loader2,
  Volume2,
  Radio,
  X,
  SkipBack,
  SkipForward,
  BookOpen,
  ChevronDown,
  Check,
  RotateCcw,
} from 'lucide-react'

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

type PlayerItem = {
  kind: 'surah' | 'radio'
  title: string
  subtitle: string
  audioUrl: string
  imageUrl: string
  reciterName: string
  surahId?: number
  reciterId?: number
  riwayaId?: number
}

const reciterPhotoMap: Array<{ match: string[]; url: string }> = [
  {
    match: ['مشاري', 'العفاسي', 'Mishary', 'Alafasi'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mishary%20Rashid%20Alafasy.jpg',
  },
  {
    match: ['ماهر', 'المعيقلي', 'Maher', 'Meaqli'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Maher%20Al-Muaiqly.jpg',
  },
  {
    match: ['محمود خليل الحصري', 'الحصري', 'Husary', 'Hussary'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mahmoud%20Khalil%20Al-Husary.jpg',
  },
  {
    match: ['محمد صديق المنشاوي', 'المنشاوي', 'Minshawi'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mohamed%20Siddiq%20El-Minshawi.jpg',
  },
  {
    match: ['عبد الباسط', 'Abdul Basit', 'Abdulbasit'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Abdul_Basit_Abd_us-Samad.jpg',
  },
  {
    match: ['عبد الرحمن السديس', 'السديس', 'Sudais'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Abdul_Rahman_Al-Sudais.jpg',
  },
  {
    match: ['سعود الشريم', 'الشريم', 'Shuraim'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Saud%20Al-Shuraim.jpg',
  },
  {
    match: ['ياسر الدوسري', 'الدوسري', 'Yasser Al-Dosari'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Yasser%20Al-Dosari.jpg',
  },
  {
    match: ['هزاع البلوشي', 'البلوشي', 'Hazza', 'Balushi'],
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hazza%20Al-Balushi.jpg',
  },
]

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=300&q=80'

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

const normalizeArabic = (value: string) =>
  value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')

function reciterPhoto(name: string) {
  const found = reciterPhotoMap.find(({ match }) =>
    match.some((item) => normalizeArabic(name).includes(normalizeArabic(item)))
  )

  return found?.url || DEFAULT_AVATAR
}

function pad3(value: number) {
  return String(value).padStart(3, '0')
}

function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function getMoshafForRiwaya(reciter: Reciter, riwayaName: string) {
  const normalized = normalizeArabic(riwayaName)
  return (
    reciter.moshaf.find((moshaf) =>
      normalizeArabic(moshaf.name).includes(normalized)
    ) || reciter.moshaf[0]
  )
}

export default function AudioPage() {
  const [riwayat, setRiwayat] = useState<Riwaya[]>([])
  const [reciters, setReciters] = useState<Reciter[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [ruqyah, setRuqyah] = useState<RadioStation | null>(null)

  const [selectedRiwaya, setSelectedRiwaya] = useState<Riwaya | null>(null)
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null)
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null)

  const [search, setSearch] = useState('')
  const [riwayaSearch, setRiwayaSearch] = useState('')
  const [surahSearch, setSurahSearch] = useState('')
  const [showRiwayat, setShowRiwayat] = useState(false)
  const [showReciters, setShowReciters] = useState(false)
  const [showSurahs, setShowSurahs] = useState(false)

  const [loading, setLoading] = useState(true)
  const [recitersLoading, setRecitersLoading] = useState(false)
  const [error, setError] = useState('')

  const [player, setPlayer] = useState<PlayerItem | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pendingPlayRef = useRef(false)

  const loadBaseLibrary = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [riwayatRes, surahsRes, radiosRes] = await Promise.all([
        fetch('https://mp3quran.net/api/v3/riwayat?language=ar', {
          cache: 'no-store',
        }),
        fetch('https://mp3quran.net/api/v3/suwar?language=ar', {
          cache: 'no-store',
        }),
        fetch('https://mp3quran.net/api/v3/radios?language=ar', {
          cache: 'no-store',
        }),
      ])

      if (!riwayatRes.ok || !surahsRes.ok || !radiosRes.ok) {
        throw new Error('Base library request failed')
      }

      const [riwayatData, surahsData, radiosData] = await Promise.all([
        riwayatRes.json(),
        surahsRes.json(),
        radiosRes.json(),
      ])

      const nextRiwayat: Riwaya[] = Array.isArray(riwayatData.riwayat)
        ? riwayatData.riwayat
        : []

      const nextSurahs: Surah[] = Array.isArray(surahsData.suwar)
        ? surahsData.suwar
        : []

      const radioList: RadioStation[] = Array.isArray(radiosData.radios)
        ? radiosData.radios
        : []

      const ruqyahStation =
        radioList.find((station) =>
          normalizeArabic(station.name).includes(
            normalizeArabic('الرقية الشرعية')
          )
        ) || null

      const preferredRiwaya =
        nextRiwayat.find((item) =>
          normalizeArabic(item.name).includes(normalizeArabic('حفص'))
        ) || nextRiwayat[0] || null

      setRiwayat(nextRiwayat)
      setSurahs(nextSurahs)
      setRuqyah(ruqyahStation)
      setSelectedRiwaya(preferredRiwaya)
    } catch (err) {
      console.error('Audio base library error:', err)
      setError('تعذر تحميل الروايات والمكتبة الصوتية حاليًا.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRecitersForRiwaya = useCallback(
    async (riwaya: Riwaya, preferredReciterName = '') => {
      setRecitersLoading(true)
      setError('')
      setSelectedReciter(null)
      setSelectedMoshaf(null)
      setSelectedSurah(null)
      setShowReciters(true)
      setShowSurahs(false)

      try {
        const response = await fetch(
          `https://mp3quran.net/api/v3/reciters?language=ar&rewaya=${encodeURIComponent(
            riwaya.id
          )}`,
          { cache: 'no-store' }
        )

        if (!response.ok) throw new Error('Reciters request failed')

        const result = await response.json()

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

        // لا نختار قارئًا تلقائيًا بعد تغيير الرواية؛ المستخدم يختار القارئ أولًا،
        // وبعد اختياره فقط تظهر السور المسجلة له في هذه الرواية.
        if (preferredReciterName) {
          const preferred = nextReciters.find((reciter) =>
            normalizeArabic(reciter.name).includes(
              normalizeArabic(preferredReciterName)
            )
          )
          if (preferred) {
            setSelectedReciter(preferred)
            setSelectedMoshaf(getMoshafForRiwaya(preferred, riwaya.name) || null)
            setShowSurahs(true)
          }
        }
      } catch (err) {
        console.error('Reciters by riwaya error:', err)
        setReciters([])
        setError('تعذر تحميل قراء هذه الرواية حاليًا.')
      } finally {
        setRecitersLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    loadBaseLibrary()
  }, [loadBaseLibrary])

  useEffect(() => {
    if (!selectedRiwaya) return
    loadRecitersForRiwaya(selectedRiwaya)
  }, [selectedRiwaya, loadRecitersForRiwaya])

  const selectRiwaya = (riwaya: Riwaya) => {
    if (audioRef.current) audioRef.current.pause()
    setIsPlaying(false)
    setPlayer(null)
    setProgress(0)
    setDuration(0)
    setSelectedRiwaya(riwaya)
    setRiwayaSearch('')
    setShowRiwayat(false)
  }

  const selectReciter = (reciter: Reciter) => {
    if (!selectedRiwaya) return

    if (audioRef.current) audioRef.current.pause()
    setIsPlaying(false)
    setPlayer(null)
    setProgress(0)
    setDuration(0)
    setSelectedReciter(reciter)
    setSelectedMoshaf(getMoshafForRiwaya(reciter, selectedRiwaya.name) || null)
    setSelectedSurah(null)
    setSearch('')
    setShowReciters(false)
    setShowSurahs(true)
  }

  const visibleReciters = useMemo(() => {
    const query = normalizeArabic(search.trim())
    if (!query) return reciters
    return reciters.filter((reciter) =>
      normalizeArabic(reciter.name).includes(query)
    )
  }, [reciters, search])

  const filteredRiwayat = useMemo(() => {
    const query = normalizeArabic(riwayaSearch.trim())
    if (!query) return riwayat
    return riwayat.filter((item) =>
      normalizeArabic(item.name).includes(query)
    )
  }, [riwayat, riwayaSearch])

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

  const visibleSurahs = useMemo(() => {
    const query = normalizeArabic(surahSearch.trim())
    if (!query) return availableSurahs

    return availableSurahs.filter(
      (surah) =>
        normalizeArabic(surah.name).includes(query) ||
        String(surah.id).includes(query)
    )
  }, [availableSurahs, surahSearch])

  const playSurah = async (surah: Surah) => {
    if (!selectedRiwaya || !selectedReciter || !selectedMoshaf) return

    const audioUrl = `${selectedMoshaf.server}${pad3(surah.id)}.mp3`

    const nextPlayer: PlayerItem = {
      kind: 'surah',
      title: surah.name,
      subtitle: selectedRiwaya.name,
      audioUrl,
      imageUrl: reciterPhoto(selectedReciter.name),
      reciterName: selectedReciter.name,
      surahId: surah.id,
      reciterId: selectedReciter.id,
      riwayaId: selectedRiwaya.id,
    }

    setSelectedSurah(surah)
    pendingPlayRef.current = true

    if (
      player?.kind === 'surah' &&
      player.surahId === surah.id &&
      player.reciterId === selectedReciter.id &&
      player.riwayaId === selectedRiwaya.id &&
      audioRef.current
    ) {
      if (audioRef.current.paused) {
        await audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
      return
    }

    setPlayer(nextPlayer)
    setProgress(0)
    setDuration(0)
  }

  const playRuqyah = async () => {
    if (!ruqyah) return

    const nextPlayer: PlayerItem = {
      kind: 'radio',
      title: 'الرُقية الشرعية',
      subtitle: 'استماع مباشر',
      audioUrl: ruqyah.url,
      imageUrl: DEFAULT_AVATAR,
      reciterName: 'الرُقية الشرعية',
    }

    pendingPlayRef.current = true
    setPlayer(nextPlayer)
    setProgress(0)
    setDuration(0)
    setSelectedSurah(null)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !player) return

    audio.src = player.audioUrl
    audio.load()

    const playAfterLoad = async () => {
      if (!pendingPlayRef.current) return
      pendingPlayRef.current = false

      try {
        await audio.play()
      } catch (err) {
        console.error('Audio play error:', err)
        setIsPlaying(false)
      }
    }

    if (audio.readyState >= 3) {
      playAfterLoad()
    } else {
      audio.addEventListener('canplay', playAfterLoad, { once: true })
    }

    return () => {
      audio.removeEventListener('canplay', playAfterLoad)
    }
  }, [player])

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
      setProgress(0)
    }
    const handleError = () => setIsPlaying(false)

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
  }, [])

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

  const changeSurah = (offset: number) => {
    if (!player || player.kind !== 'surah' || player.surahId == null) return

    const currentIndex = availableSurahs.findIndex(
      (surah) => surah.id === player.surahId
    )
    if (currentIndex === -1) return

    const nextSurah = availableSurahs[currentIndex + offset]
    if (nextSurah) {
      playSurah(nextSurah)
    }
  }

  const resetSelection = () => {
    if (audioRef.current) audioRef.current.pause()
    setPlayer(null)
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)
    setSelectedSurah(null)
    setSelectedReciter(null)
    setSelectedMoshaf(null)
    setShowReciters(false)
    setShowSurahs(false)
  }

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '٠٠:٠٠'

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    return `${arabicDigits(String(mins).padStart(2, '0'))}:${arabicDigits(
      String(secs).padStart(2, '0')
    )}`
  }

  return (
    <div
      className="min-h-screen bg-mushaf-paper flex flex-col pb-40 md:pb-32"
      dir="rtl"
    >
      <audio ref={audioRef} preload="metadata" />

      <header className="sticky top-0 z-30 bg-mushaf-paper/95 backdrop-blur border-b border-mushaf-border/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-mushaf-teal"
            aria-label="العودة للرئيسية"
          >
            <ChevronRight size={24} />
          </Link>

          <div className="text-center flex-1">
            <div className="flex justify-center items-center gap-2">
              <Headphones className="text-mushaf-gold" size={22} />
              <h1 className="font-bold text-xl text-mushaf-dark">
                مكتبة التلاوات
              </h1>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              اختر الرواية ثم القارئ ثم السورة
            </p>
          </div>

          <button
            onClick={resetSelection}
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-mushaf-teal hover:bg-mushaf-paper transition"
            title="إعادة الاختيار"
            aria-label="إعادة الاختيار"
          >
            <RotateCcw size={19} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-6">
        {loading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-mushaf-teal">
            <div className="w-20 h-20 rounded-3xl bg-white shadow-sm border border-mushaf-border/30 flex items-center justify-center">
              <Loader2 className="animate-spin" size={38} />
            </div>
            <p className="font-bold">جاري تحميل الروايات والتلاوات...</p>
          </div>
        ) : error && riwayat.length === 0 ? (
          <div className="bg-white rounded-3xl border border-red-100 shadow-sm p-8 text-center">
            <p className="font-bold text-red-600 mb-4">{error}</p>
            <button
              onClick={loadBaseLibrary}
              className="bg-mushaf-teal text-white px-6 py-3 rounded-2xl font-bold"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 text-sm font-bold text-center">
                {error}
              </div>
            )}

            {/* Current selection hero */}
            <section className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[2rem] p-5 sm:p-7 shadow-xl border border-mushaf-gold/20 text-white overflow-hidden relative">
              <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute -bottom-20 -right-10 w-60 h-60 rounded-full bg-mushaf-gold/5 blur-3xl" />

              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-mushaf-gold/80 shadow-2xl bg-white/10">
                    <img
                      src={
                        selectedReciter
                          ? reciterPhoto(selectedReciter.name)
                          : DEFAULT_AVATAR
                      }
                      alt={selectedReciter?.name || 'القارئ'}
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR
                      }}
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-11 h-11 rounded-full bg-white text-mushaf-teal flex items-center justify-center shadow-lg">
                    {isPlaying ? <Volume2 size={21} /> : <Headphones size={21} />}
                  </div>
                </div>

                <div className="flex-1 text-center lg:text-right min-w-0">
                  <p className="text-mushaf-gold text-xs font-bold mb-2">
                    {player?.kind === 'radio' ? 'الاستماع الحالي' : 'اختيارك الحالي'}
                  </p>
                  <h2 className="font-bold text-2xl sm:text-3xl truncate">
                    {selectedReciter?.name || 'اختر القارئ'}
                  </h2>
                  <p className="font-uthmani text-xl sm:text-2xl text-white/90 mt-2 truncate">
                    {selectedRiwaya?.name || 'اختر الرواية'}
                  </p>
                  {selectedSurah && (
                    <div className="inline-flex items-center gap-2 mt-4 bg-white/10 px-4 py-2 rounded-full text-sm font-bold">
                      <BookOpen size={16} className="text-mushaf-gold" />
                      {selectedSurah.name}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Step 1: Riwaya */}
            <section className="mt-7">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-mushaf-teal text-white flex items-center justify-center font-black">
                    ١
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-mushaf-dark">اختر الرواية</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      الروايات المتاحة في المكتبة الصوتية
                    </p>
                  </div>
                </div>
                {selectedRiwaya && (
                  <span className="text-xs font-bold text-mushaf-teal bg-mushaf-teal/10 px-3 py-2 rounded-xl">
                    {selectedRiwaya.name}
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setShowRiwayat(!showRiwayat)
                  setShowReciters(false)
                  setShowSurahs(false)
                }}
                className={`w-full bg-white rounded-2xl border p-4 flex items-center justify-between gap-3 text-right shadow-sm transition ${
                  showRiwayat
                    ? 'border-mushaf-teal ring-2 ring-mushaf-teal/10'
                    : 'border-mushaf-border/40 hover:border-mushaf-teal'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-gold flex items-center justify-center border border-mushaf-gold/20">
                    <BookOpen size={23} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-bold mb-1">الرواية</p>
                    <p className="font-bold text-mushaf-dark truncate">
                      {selectedRiwaya?.name || 'اضغط لاختيار الرواية'}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={21}
                  className={`text-mushaf-teal transition ${showRiwayat ? 'rotate-180' : ''}`}
                />
              </button>

              {showRiwayat && (
                <div className="mt-3 bg-white rounded-3xl border border-mushaf-border/40 shadow-lg p-3">
                  <div className="relative mb-3">
                    <Search
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={riwayaSearch}
                      onChange={(event) => setRiwayaSearch(event.target.value)}
                      placeholder="ابحث عن رواية..."
                      className="w-full bg-mushaf-paper rounded-2xl py-3 pr-11 pl-4 outline-none text-sm font-bold"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                    {filteredRiwayat.map((riwaya) => {
                      const active = selectedRiwaya?.id === riwaya.id

                      return (
                        <button
                          key={riwaya.id}
                          onClick={() => selectRiwaya(riwaya)}
                          className={`p-3 rounded-2xl border text-right flex items-center justify-between gap-2 transition ${
                            active
                              ? 'bg-mushaf-teal text-white border-mushaf-teal shadow-md'
                              : 'bg-white text-mushaf-dark border-mushaf-border/30 hover:border-mushaf-teal hover:bg-mushaf-teal/5'
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

            {/* Step 2: Reciter */}
            <section className="mt-7">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      selectedRiwaya
                        ? 'bg-mushaf-gold text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    ٢
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-mushaf-dark">اختر القارئ</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      سيظهر هنا القراء الذين لديهم هذه الرواية
                    </p>
                  </div>
                </div>
                {selectedReciter && (
                  <span className="text-xs font-bold text-mushaf-teal bg-mushaf-teal/10 px-3 py-2 rounded-xl">
                    {arabicDigits(reciters.length)} قارئ
                  </span>
                )}
              </div>

              <button
                disabled={!selectedRiwaya || recitersLoading}
                onClick={() => {
                  setShowReciters(!showReciters)
                  setShowRiwayat(false)
                  setShowSurahs(false)
                }}
                className="w-full bg-white rounded-2xl border border-mushaf-border/40 p-4 flex items-center justify-between gap-3 text-right shadow-sm hover:border-mushaf-teal transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-mushaf-paper shrink-0">
                    <img
                      src={
                        selectedReciter
                          ? reciterPhoto(selectedReciter.name)
                          : DEFAULT_AVATAR
                      }
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-bold mb-1">القارئ</p>
                    <p className="font-bold text-mushaf-dark truncate">
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
                    className={`text-mushaf-teal transition ${showReciters ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {showReciters && selectedRiwaya && (
                <div className="mt-3 bg-white rounded-3xl border border-mushaf-border/40 shadow-lg p-3">
                  <div className="relative mb-3">
                    <Search
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="ابحث عن اسم الشيخ..."
                      className="w-full bg-mushaf-paper rounded-2xl py-3 pr-11 pl-4 outline-none text-sm font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[520px] overflow-y-auto">
                    {visibleReciters.map((reciter) => {
                      const active = selectedReciter?.id === reciter.id

                      return (
                        <button
                          key={reciter.id}
                          onClick={() => selectReciter(reciter)}
                          className={`text-right bg-white rounded-3xl p-3 border transition-all ${
                            active
                              ? 'border-mushaf-gold shadow-lg ring-2 ring-mushaf-gold/10'
                              : 'border-mushaf-border/30 hover:border-mushaf-teal hover:shadow-md'
                          }`}
                        >
                          <div className="relative aspect-square rounded-2xl overflow-hidden bg-mushaf-paper">
                            <img
                              src={reciterPhoto(reciter.name)}
                              alt={reciter.name}
                              className="w-full h-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = DEFAULT_AVATAR
                              }}
                            />
                            {active && (
                              <div className="absolute inset-0 bg-mushaf-teal/15 flex items-end justify-start p-2">
                                <span className="w-9 h-9 rounded-full bg-mushaf-teal text-white flex items-center justify-center shadow-lg">
                                  <Check size={18} />
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="font-bold text-sm text-mushaf-dark mt-3 line-clamp-2">
                            {reciter.name}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  {visibleReciters.length === 0 && !recitersLoading && (
                    <div className="py-10 text-center text-gray-400 font-bold">
                      لا يوجد قراء متاحون لهذه الرواية.
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 3: Surah */}
            <section className="mt-7">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      selectedReciter
                        ? 'bg-mushaf-teal text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    ٣
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-mushaf-dark">اختر السورة</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      تظهر فقط السور المسجلة فعليًا للقارئ المحدد
                    </p>
                  </div>
                </div>
                {selectedMoshaf && (
                  <span className="text-xs font-bold text-mushaf-teal bg-mushaf-teal/10 px-3 py-2 rounded-xl">
                    {arabicDigits(availableSurahs.length)} سورة
                  </span>
                )}
              </div>

              <button
                disabled={!selectedReciter || !selectedMoshaf}
                onClick={() => {
                  setShowSurahs(!showSurahs)
                  setShowReciters(false)
                  setShowRiwayat(false)
                }}
                className="w-full bg-white rounded-2xl border border-mushaf-border/40 p-4 flex items-center justify-between gap-3 text-right shadow-sm hover:border-mushaf-teal transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-gold flex items-center justify-center border border-mushaf-gold/20">
                    <BookOpen size={23} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-bold mb-1">السورة</p>
                    <p className="font-bold text-mushaf-dark truncate">
                      {selectedSurah?.name || 'اختر السورة التي تريد تشغيلها'}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={21}
                  className={`text-mushaf-teal transition ${showSurahs ? 'rotate-180' : ''}`}
                />
              </button>

              {showSurahs && selectedReciter && selectedMoshaf && (
                <div className="mt-3 bg-white rounded-3xl border border-mushaf-border/40 shadow-lg p-3">
                  <div className="relative mb-3">
                    <Search
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={surahSearch}
                      onChange={(event) => setSurahSearch(event.target.value)}
                      placeholder="ابحث باسم السورة..."
                      className="w-full bg-mushaf-paper rounded-2xl py-3 pr-11 pl-4 outline-none text-sm font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[520px] overflow-y-auto">
                    {visibleSurahs.map((surah) => {
                      const active = selectedSurah?.id === surah.id
                      const playing =
                        player?.kind === 'surah' && player.surahId === surah.id

                      return (
                        <button
                          key={surah.id}
                          onClick={() => playSurah(surah)}
                          className={`group bg-white rounded-2xl p-4 border flex items-center justify-between gap-3 text-right transition ${
                            active
                              ? 'border-mushaf-gold bg-mushaf-gold/5 shadow-md'
                              : 'border-mushaf-border/30 hover:border-mushaf-teal hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                                active
                                  ? 'bg-mushaf-gold text-white'
                                  : 'bg-mushaf-paper text-mushaf-teal'
                              }`}
                            >
                              {arabicDigits(surah.id)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-mushaf-dark truncate">
                                {surah.name}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-1">
                                {surah.makkia ? 'مكية' : 'مدنية'}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition ${
                              playing && isPlaying
                                ? 'bg-mushaf-teal text-white'
                                : active
                                  ? 'bg-mushaf-gold text-white'
                                  : 'bg-mushaf-paper text-mushaf-teal group-hover:bg-mushaf-teal group-hover:text-white'
                            }`}
                          >
                            {playing && isPlaying ? (
                              <Pause size={17} fill="currentColor" />
                            ) : (
                              <Play size={17} fill="currentColor" className="mr-0.5" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {visibleSurahs.length === 0 && (
                    <div className="py-10 text-center text-gray-400 font-bold">
                      لا توجد سورة مسجلة بهذا الاسم.
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Ruqyah */}
            <section className="mt-8">
              <button
                onClick={playRuqyah}
                disabled={!ruqyah}
                className="w-full bg-white rounded-3xl border border-mushaf-gold/30 shadow-sm p-5 flex items-center justify-between gap-4 hover:border-mushaf-teal hover:shadow-md transition disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-mushaf-paper text-mushaf-gold flex items-center justify-center border border-mushaf-gold/30">
                    <Radio size={27} />
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-mushaf-dark">الرُقية الشرعية</p>
                    <p className="text-xs text-gray-500 mt-1">استماع مباشر</p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-mushaf-teal text-white flex items-center justify-center shadow-md">
                  <Play size={20} fill="currentColor" />
                </div>
              </button>
            </section>

            {/* Small informational footer */}
            <div className="mt-6 text-center text-[11px] text-gray-400 leading-relaxed px-4">
              القارئ يعرض فقط عندما توجد له تلاوة مسجلة بالرواية المختارة، والسور
              المعروضة مأخوذة من قائمة التسجيلات الفعلية لكل قارئ.
            </div>
          </>
        )}
      </main>

      {/* Floating player */}
      {player && (
        <div className="fixed bottom-24 md:bottom-20 left-3 right-3 z-50">
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-3xl p-3 sm:p-4 shadow-[0_18px_60px_rgba(13,56,62,0.35)] border border-mushaf-gold/30 text-white">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white/10 border border-white/10 shrink-0">
                <img
                  src={player.imageUrl}
                  alt={player.reciterName}
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_AVATAR
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-mushaf-gold text-xs font-bold truncate">
                  {player.reciterName}
                </p>
                <p className="font-bold text-base sm:text-lg truncate mt-0.5">
                  {player.title}
                </p>
                <p className="text-[11px] text-white/60 truncate mt-0.5">
                  {player.subtitle}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-10 text-center">
                    {formatDuration(progress)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(progress, duration || 0)}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    disabled={!duration}
                    className="w-full accent-[var(--mushaf-gold,#D97706)]"
                    aria-label="تقدم التلاوة"
                  />
                  <span className="text-[10px] text-white/50 w-10 text-center">
                    {formatDuration(duration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {player.kind === 'surah' && (
                  <>
                    <button
                      onClick={() => changeSurah(-1)}
                      className="hidden sm:flex w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center"
                      aria-label="السورة السابقة"
                    >
                      <SkipBack size={18} />
                    </button>
                    <button
                      onClick={() => changeSurah(1)}
                      className="hidden sm:flex w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center"
                      aria-label="السورة التالية"
                    >
                      <SkipForward size={18} />
                    </button>
                  </>
                )}

                <button
                  onClick={togglePlayer}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white text-mushaf-teal flex items-center justify-center shadow-lg hover:scale-105 transition"
                  aria-label={isPlaying ? 'إيقاف' : 'تشغيل'}
                >
                  {isPlaying ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" className="mr-0.5" />
                  )}
                </button>

                <button
                  onClick={closePlayer}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  aria-label="إغلاق المشغل"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
