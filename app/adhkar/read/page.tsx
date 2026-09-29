'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  Heart,
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

const DATA_URL = 'https://raw.githubusercontent.com/rn0x/Adhkar-json/main/adhkar.json'
const AUDIO_BASE_URL = 'https://raw.githubusercontent.com/rn0x/Adhkar-json/main'

/*
 * مصدر rn0x/Adhkar-json الحالي يحتوي على تسجيلات بشرية مقطعة على مستوى الذكر،
 * والـ README يعرّف القراءة الصوتية الحالية بأنها للمحاضر حمد الدريهم.
 *
 * تم بناء النظام هنا بطريقة قابلة لإضافة قراء آخرين عندما تتوفر ملفات صوتية
 * مقطعة لكل ذكر لنفس المجموعة. لا يتم اختراع روابط أو أسماء تسجيلات غير موجودة.
 */
const DEFAULT_RECITER = {
  id: 'hamad-al-drehem',
  name: 'حمد الدريهم',
  description: 'التسجيل المتوفر مع بيانات حصن المسلم',
}

const typeConfig: Record<AdhkarType, { title: string; categoryNames: string[] }> = {
  morning: {
    title: 'أذكار الصباح',
    categoryNames: ['أذكار الصباح والمساء'],
  },
  evening: {
    title: 'أذكار المساء',
    categoryNames: ['أذكار الصباح والمساء'],
  },
  sleep: {
    title: 'أذكار النوم',
    categoryNames: ['أذكار النوم'],
  },
  waking: {
    title: 'أذكار الاستيقاظ من النوم',
    categoryNames: ['أذكار الاستيقاظ من النوم'],
  },
}

const fallbackData: Record<string, AdhkarCategory> = {
  morning: {
    id: 1,
    category: 'أذكار الصباح والمساء',
    array: [
      {
        id: 1,
        text: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ وَلَا يَئُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ﴾.',
        count: 1,
      },
      {
        id: 2,
        text: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ﴾. بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ﴾. بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ﴾.',
        count: 3,
      },
      {
        id: 3,
        text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا.',
        count: 3,
      },
      {
        id: 4,
        text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.',
        count: 100,
      },
    ],
  },
  sleep: {
    id: 2,
    category: 'أذكار النوم',
    array: [
      {
        id: 1,
        text: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.',
        count: 1,
      },
      {
        id: 2,
        text: 'اللَّهُمَّ إِنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ.',
        count: 1,
      },
      {
        id: 3,
        text: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ.',
        count: 33,
      },
    ],
  },
  waking: {
    id: 3,
    category: 'أذكار الاستيقاظ من النوم',
    array: [
      {
        id: 1,
        text: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانِي بَعْدَ مَا أَمَاتَنِي وَإِلَيْهِ النُّشُورُ.',
        count: 1,
      },
      {
        id: 2,
        text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.',
        count: 1,
      },
    ],
  },
}

function toAbsoluteAudioUrl(value?: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${AUDIO_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeType(value: string | null): AdhkarType {
  if (value === 'evening' || value === 'sleep' || value === 'waking') return value
  return 'morning'
}

function buildCounts(items: AdhkarItem[]) {
  const result: Record<number, number> = {}
  items.forEach((item) => {
    result[item.id] = Math.max(0, Number(item.count) || 1)
  })
  return result
}

function getCategoryFromPayload(json: unknown, config: { categoryNames: string[] }) {
  const categories: AdhkarCategory[] = Array.isArray(json)
    ? json
    : Array.isArray((json as { data?: unknown })?.data)
      ? (json as { data: AdhkarCategory[] }).data
      : Array.isArray((json as { adhkar?: unknown })?.adhkar)
        ? (json as { adhkar: AdhkarCategory[] }).adhkar
        : []

  return categories.find((category) =>
    config.categoryNames.includes(String(category.category).trim())
  )
}

function ReadAdhkarContent() {
  const searchParams = useSearchParams()
  const requestedCategoryId = Number(searchParams.get('categoryId') || 0)
  const type = normalizeType(searchParams.get('type'))
  const config = typeConfig[type]

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoPlayRef = useRef(false)
  const sequenceRef = useRef<{
    itemIndex: number
    repetition: number
  } | null>(null)

  const [items, setItems] = useState<AdhkarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [completedIds, setCompletedIds] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER.id)
  const [pageTitle, setPageTitle] = useState(config.title)

  const activeIndex = useMemo(
    () => items.findIndex((item) => item.id === activeId),
    [items, activeId]
  )

  const selectedItem = activeIndex >= 0 ? items[activeIndex] : null

  const completedCount = completedIds.length
  const progress = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0

  const currentRemaining = selectedItem
    ? counts[selectedItem.id] ?? selectedItem.count
    : 0

  const currentRepetition = sequenceRef.current?.repetition ?? 0

  const stopAudio = useCallback(() => {
    autoPlayRef.current = false
    sequenceRef.current = null

    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.onplay = null
      audioRef.current.onpause = null
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }

    setPlaying(false)
  }, [])

  const markCompleted = useCallback((item: AdhkarItem) => {
    setCounts((previous) => ({
      ...previous,
      [item.id]: 0,
    }))

    setCompletedIds((previous) =>
      previous.includes(item.id) ? previous : [...previous, item.id]
    )
  }, [])

  const playSequenceFrom = useCallback(
    async (startIndex: number, firstRepetition = 1) => {
      if (!items.length || startIndex < 0 || startIndex >= items.length) return

      autoPlayRef.current = true
      sequenceRef.current = {
        itemIndex: startIndex,
        repetition: firstRepetition,
      }

      const item = items[startIndex]
      setActiveId(item.id)

      const url = toAbsoluteAudioUrl(item.audio)

      if (!url) {
        markCompleted(item)
        const nextIndex = startIndex + 1

        if (nextIndex < items.length) {
          await playSequenceFrom(nextIndex, 1)
        } else {
          autoPlayRef.current = false
          sequenceRef.current = null
          setPlaying(false)
        }

        return
      }

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : 1
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onplay = () => setPlaying(true)
      audio.onpause = () => {
        if (!autoPlayRef.current) setPlaying(false)
      }

      audio.onerror = async () => {
        console.error('Adhkar audio error:', url)

        // لا ننتقل إلى قراءة اصطناعية.
        // إذا تعذر التسجيل، نتعامل معه كنص فقط ونكمل التسلسل.
        markCompleted(item)

        const nextIndex = startIndex + 1
        if (autoPlayRef.current && nextIndex < items.length) {
          await playSequenceFrom(nextIndex, 1)
        } else {
          autoPlayRef.current = false
          sequenceRef.current = null
          setPlaying(false)
        }
      }

      audio.onended = async () => {
        const total = Math.max(1, Number(item.count) || 1)
        const repetition = sequenceRef.current?.repetition ?? 1

        setCounts((previous) => ({
          ...previous,
          [item.id]: Math.max(0, total - repetition),
        }))

        if (repetition < total && autoPlayRef.current) {
          sequenceRef.current = {
            itemIndex: startIndex,
            repetition: repetition + 1,
          }

          audio.currentTime = 0

          try {
            await audio.play()
          } catch (error) {
            console.error('Adhkar repeat playback error:', error)
            markCompleted(item)
          }

          return
        }

        markCompleted(item)

        const nextIndex = startIndex + 1

        if (nextIndex < items.length && autoPlayRef.current) {
          await playSequenceFrom(nextIndex, 1)
          return
        }

        autoPlayRef.current = false
        sequenceRef.current = null
        setPlaying(false)
      }

      try {
        await audio.play()
      } catch (error) {
        console.error('Adhkar playback blocked:', error)
        autoPlayRef.current = false
        sequenceRef.current = null
        setPlaying(false)
      }
    },
    [items, markCompleted, muted, rate]
  )

  const startAll = useCallback(() => {
    if (!items.length) return

    const firstIncompleteIndex = items.findIndex(
      (item) => !completedIds.includes(item.id) && Number(item.count) > 0
    )

    const startIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0

    if (startIndex === 0 && completedIds.length === items.length) {
      setCompletedIds([])
      setCounts(buildCounts(items))
    }

    playSequenceFrom(startIndex, 1)
  }, [completedIds, items, playSequenceFrom])

  const playItem = useCallback(
    (item: AdhkarItem) => {
      const index = items.findIndex((candidate) => candidate.id === item.id)
      if (index < 0) return

      stopAudio()
      setCompletedIds((previous) => previous.filter((id) => id !== item.id))
      setCounts((previous) => ({
        ...previous,
        [item.id]: Math.max(1, Number(item.count) || 1),
      }))

      playSequenceFrom(index, 1)
    },
    [items, playSequenceFrom, stopAudio]
  )

  const pauseResume = useCallback(() => {
    if (!audioRef.current) {
      if (selectedItem) playItem(selectedItem)
      return
    }

    if (playing) {
      autoPlayRef.current = false
      audioRef.current.pause()
      setPlaying(false)
      return
    }

    autoPlayRef.current = true
    audioRef.current.play().catch((error) => {
      console.error('Resume playback error:', error)
    })
  }, [playItem, playing, selectedItem])

  useEffect(() => {
    let ignore = false

    const loadData = async () => {
      setLoading(true)
      setDataError('')
      stopAudio()

      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to fetch adhkar')

        const json = await response.json()

        const categories: AdhkarCategory[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.adhkar)
              ? json.adhkar
              : []

        const wanted = requestedCategoryId
          ? categories.find((category) => Number(category.id) === requestedCategoryId)
          : getCategoryFromPayload(json, config)

        if (!wanted?.array?.length) {
          throw new Error('Category not found')
        }

        if (!ignore) {
          setItems(wanted.array)
          setCounts(buildCounts(wanted.array))
          setCompletedIds([])
          setActiveId(null)
          setPageTitle(
            requestedCategoryId
              ? String(wanted.category)
              : config.title
          )
        }
      } catch (error) {
        console.error('Adhkar data error:', error)

        const fallback = fallbackData[type]

        if (!ignore) {
          setDataError(
            'تعذر تحميل البيانات الخارجية الآن، تم تشغيل النسخة الاحتياطية. التسجيلات الخارجية لا تتوفر في النسخة الاحتياطية.'
          )
          setItems(fallback.array)
          setCounts(buildCounts(fallback.array))
          setCompletedIds([])
          setActiveId(null)
          setPageTitle(config.title)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()

    return () => {
      ignore = true
      stopAudio()
    }
  }, [config.categoryNames, requestedCategoryId, stopAudio, type])

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`samee3_adhkar_favorites_${type}`) || '[]'
      )

      if (Array.isArray(saved)) setFavoriteIds(saved)
    } catch {
      setFavoriteIds([])
    }
  }, [type])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : 1
      audioRef.current.playbackRate = rate
    }
  }, [muted, rate])

  const handleTap = (item: AdhkarItem) => {
    const remaining = counts[item.id] ?? item.count

    if (remaining <= 0) return

    setActiveId(item.id)

    const nextRemaining = Math.max(0, remaining - 1)

    setCounts((previous) => ({
      ...previous,
      [item.id]: nextRemaining,
    }))

    if (nextRemaining === 0) {
      setCompletedIds((previous) =>
        previous.includes(item.id) ? previous : [...previous, item.id]
      )
    }
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
    setCompletedIds([])
    setCounts(buildCounts(items))
    setActiveId(null)
  }

  const copyItem = async (item: AdhkarItem) => {
    try {
      await navigator.clipboard.writeText(item.text)
      setCopiedId(item.id)
      window.setTimeout(() => setCopiedId(null), 1800)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const toggleFavorite = (item: AdhkarItem) => {
    setFavoriteIds((previous) => {
      const next = previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id]

      localStorage.setItem(
        `samee3_adhkar_favorites_${type}`,
        JSON.stringify(next)
      )

      return next
    })
  }

  const handleMute = () => {
    setMuted((previous) => !previous)
  }

  const isSequencePlaying =
    playing && Boolean(audioRef.current) && autoPlayRef.current

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-32" dir="rtl">
      <header className="sticky top-0 z-50 bg-mushaf-paper/95 backdrop-blur-xl border-b border-mushaf-border/30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/adhkar"
            className="w-11 h-11 flex items-center justify-center text-mushaf-teal bg-white rounded-2xl shadow-sm border border-mushaf-border/20 hover:bg-mushaf-teal hover:text-white transition"
            aria-label="العودة للأذكار"
          >
            <ChevronRight size={22} />
          </Link>

          <div className="text-center min-w-0">
            <h1 className="font-black text-mushaf-dark text-lg truncate">
              {config.title}
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              حصن المسلم من أذكار الكتاب والسنة
            </p>
          </div>

          <button
            type="button"
            onClick={handleMute}
            className="w-11 h-11 flex items-center justify-center text-mushaf-teal bg-white rounded-2xl shadow-sm border border-mushaf-border/20 hover:bg-mushaf-paper transition"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-5 pb-3">
          <div className="flex items-center justify-between text-xs font-black text-gray-500 mb-2">
            <span>الإنجاز</span>
            <span className="text-mushaf-teal">{arabicDigits(progress)}٪</span>
          </div>

          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-mushaf-teal to-mushaf-gold rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-5 pt-5">
        <section className="bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white rounded-[2rem] p-5 sm:p-6 shadow-xl border border-mushaf-gold/20 relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -right-12 w-48 h-48 bg-mushaf-gold/5 rounded-full blur-3xl" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <Heart size={28} className="text-mushaf-gold" fill="currentColor" />
            </div>

            <div className="min-w-0">
              <h2 className="font-black text-xl">وردك اليومي</h2>
              <p className="text-white/70 text-sm mt-1">
                اضغط على الذكر لتسمع صوته
              </p>
            </div>
          </div>

          {dataError && (
            <div className="relative z-10 mt-4 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-xs leading-relaxed text-white/80">
              {dataError}
            </div>
          )}
        </section>

        {/* اختيار القارئ + المشغل الرئيسي في أعلى المحتوى */}
        <section className="mt-4 bg-white rounded-[2rem] p-4 sm:p-5 shadow-sm border border-mushaf-border/40">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-black block mb-2">
                اختر القارئ
              </label>

              <div className="relative">
                <Volume2
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-mushaf-teal pointer-events-none"
                />

                <select
                  value={reciterId}
                  onChange={(event) => {
                    setReciterId(event.target.value)
                    stopAudio()
                  }}
                  className="w-full appearance-none bg-mushaf-paper border border-mushaf-border/40 rounded-2xl pr-11 pl-4 py-3 text-sm font-black text-mushaf-dark outline-none focus:ring-2 focus:ring-mushaf-teal/15"
                  aria-label="اختيار القارئ"
                >
                  <option value={DEFAULT_RECITER.id}>
                    {DEFAULT_RECITER.name}
                  </option>
                </select>
              </div>

              <p className="text-[10px] text-gray-400 mt-2">
                {DEFAULT_RECITER.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-black">
                السرعة
              </label>

              <select
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                className="bg-mushaf-paper border border-mushaf-border/40 rounded-2xl px-3 py-3 text-xs font-black text-mushaf-dark outline-none"
                aria-label="سرعة الصوت"
              >
                <option value={0.8}>بطيء</option>
                <option value={1}>طبيعي</option>
                <option value={1.15}>سريع</option>
              </select>
            </div>
          </div>

          <div className="mt-4 bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[1.7rem] p-4 sm:p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Volume2 size={23} className="text-mushaf-gold" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-mushaf-gold text-xs font-black mb-1">
                  {selectedItem ? 'يتم تشغيل الذكر' : 'مشغل الورد اليومي'}
                </p>

                <p className="text-sm font-bold line-clamp-2 leading-relaxed">
                  {selectedItem
                    ? selectedItem.text
                    : 'شغّل الورد ليتم تشغيل الأذكار بالترتيب حتى النهاية'}
                </p>

                {selectedItem && selectedItem.audio && (
                  <p className="text-[10px] text-white/55 mt-2">
                    التكرار {arabicDigits(currentRepetition)} من{' '}
                    {arabicDigits(selectedItem.count)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={
                  isSequencePlaying
                    ? pauseResume
                    : selectedItem
                      ? pauseResume
                      : startAll
                }
                disabled={!items.length}
                className="w-12 h-12 rounded-2xl bg-mushaf-gold text-white flex items-center justify-center shadow-md disabled:opacity-50 shrink-0"
                aria-label={isSequencePlaying ? 'إيقاف مؤقت' : 'تشغيل الورد'}
              >
                {isSequencePlaying ? (
                  <Pause size={21} fill="currentColor" />
                ) : (
                  <Play size={21} fill="currentColor" />
                )}
              </button>

              {selectedItem && (
                <button
                  type="button"
                  onClick={stopAudio}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-red-500/20 flex items-center justify-center shrink-0"
                  aria-label="إيقاف المشغل"
                >
                  <X size={19} />
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={startAll}
                disabled={!items.length}
                className="flex-1 bg-white text-mushaf-teal rounded-2xl py-3 font-black text-sm disabled:opacity-50"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Play size={17} fill="currentColor" />
                  تشغيل الورد كاملًا
                </span>
              </button>

              <button
                type="button"
                onClick={resetAll}
                className="px-4 py-3 bg-white/10 text-white rounded-2xl font-black text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw size={16} />
                  إعادة
                </span>
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-mushaf-teal">
            <Loader2 size={42} className="animate-spin" />
            <p className="font-bold">جاري تحميل الأذكار...</p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {items.map((item, index) => {
              const remaining = counts[item.id] ?? item.count
              const completed = completedIds.includes(item.id) || remaining === 0
              const isActive = activeId === item.id
              const isFavorite = favoriteIds.includes(item.id)
              const hasAudio = Boolean(item.audio)

              return (
                <article
                  key={`${type}-${item.id}-${index}`}
                  className={`bg-white rounded-[2rem] p-5 shadow-sm border transition-all duration-300 ${
                    completed
                      ? 'border-green-200 bg-green-50/30'
                      : isActive
                        ? 'border-mushaf-teal/50 shadow-lg ring-1 ring-mushaf-teal/10'
                        : 'border-mushaf-border/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl font-black flex items-center justify-center border ${
                          completed
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-mushaf-paper text-mushaf-teal border-mushaf-border/30'
                        }`}
                      >
                        {completed ? <Check size={20} /> : arabicDigits(index + 1)}
                      </div>

                      <div>
                        <span className="text-[11px] text-gray-400 font-bold block">
                          العدد المطلوب
                        </span>
                        <span className="text-sm font-black text-mushaf-dark">
                          {arabicDigits(item.count)} مرات
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {hasAudio ? (
                        <span className="text-[10px] bg-mushaf-teal/10 text-mushaf-teal rounded-full px-2.5 py-1 font-black">
                          صوت
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-400 rounded-full px-2.5 py-1 font-black">
                          قراءة
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleFavorite(item)}
                        className={`p-2 rounded-xl transition ${
                          isFavorite
                            ? 'text-red-500 bg-red-50'
                            : 'text-gray-300 hover:text-red-400 hover:bg-red-50'
                        }`}
                        aria-label="إضافة للمفضلة"
                      >
                        <Heart
                          size={18}
                          fill={isFavorite ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTap(item)}
                    disabled={completed}
                    className="w-full text-right"
                    aria-label={`تكرار الذكر ${index + 1}`}
                  >
                    <p
                      className={`font-uthmani text-2xl leading-[2.15] text-mushaf-dark ${
                        completed ? 'text-green-900/70' : ''
                      }`}
                    >
                      {item.text}
                    </p>
                  </button>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {hasAudio ? (
                      <button
                        type="button"
                        onClick={() => playItem(item)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition ${
                          isActive && playing
                            ? 'bg-mushaf-gold text-white shadow-md'
                            : 'bg-mushaf-teal text-white hover:opacity-90'
                        }`}
                      >
                        {isActive && playing ? (
                          <Pause size={18} fill="currentColor" />
                        ) : (
                          <Play size={18} fill="currentColor" />
                        )}
                        {isActive && playing ? 'إيقاف' : 'تشغيل الذكر'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-500 font-black text-sm">
                        قراءة فقط
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => copyItem(item)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mushaf-paper text-mushaf-teal font-black text-sm hover:bg-mushaf-teal/10 transition"
                    >
                      {copiedId === item.id ? (
                        <CheckCheck size={18} />
                      ) : (
                        <Copy size={18} />
                      )}
                      {copiedId === item.id ? 'تم النسخ' : 'نسخ'}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetItem(item)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 text-gray-500 font-black text-sm hover:bg-gray-100 transition"
                    >
                      <RotateCcw size={18} />
                      إعادة
                    </button>

                    <div className="mr-auto min-w-[100px] text-left">
                      {completed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-black text-sm">
                          <CheckCheck size={18} />
                          تم
                        </span>
                      ) : (
                        <div className="bg-mushaf-paper rounded-2xl px-4 py-2 border border-mushaf-border/30 text-center">
                          <span className="text-[10px] text-gray-400 font-bold block">
                            متبقي
                          </span>
                          <span className="text-lg font-black text-mushaf-teal">
                            {arabicDigits(remaining)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {progress === 100 && (
              <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white rounded-[2rem] p-7 text-center shadow-xl border border-mushaf-gold/20">
                <CheckCheck
                  size={46}
                  className="mx-auto text-mushaf-gold mb-3"
                />
                <h2 className="font-black text-2xl mb-2">
                  تقبّل الله طاعتكم
                </h2>
                <p className="text-white/75 text-sm">
                  أتممت {pageTitle} كاملًا.
                </p>

                <Link
                  href="/adhkar"
                  className="inline-flex items-center gap-2 mt-5 bg-white text-mushaf-teal px-6 py-3 rounded-2xl font-black text-sm shadow-md"
                >
                  <ChevronRight size={18} />
                  العودة للأذكار
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ReadAdhkarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mushaf-paper flex flex-col items-center justify-center gap-4 text-mushaf-teal">
          <Loader2 size={42} className="animate-spin" />
          <p className="font-bold">جاري تحميل الأذكار...</p>
        </div>
      }
    >
      <ReadAdhkarContent />
    </Suspense>
  )
}