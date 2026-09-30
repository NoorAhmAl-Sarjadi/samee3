'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  ExternalLink,
  Headphones,
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
type ReaderMode = 'direct' | 'external'

type AdhkarReciter = {
  id: string
  name: string
  sourceName: string
  mode: ReaderMode
  description: string
  coverage: string
  sourceUrl: string
  badge: string
  embedByType?: Partial<Record<AdhkarType, string>>
}

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const AUDIO_BASE_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main'

/*
 * مكتبة الأصوات الإضافية مبنية على صفحات صوتية منشورة فعلًا.
 * لا نستخدم أصوات قراء القرآن على أنها أصوات أذكار إلا عندما يوجد لهم
 * تسجيل أذكار منشور مستقلًا.
 *
 * mode=direct:
 *   التسجيلات الموجودة في بيانات rn0x/Adhkar-json مرتبطة بالذكر نفسه،
 *   لذلك يمكن للمشغل الداخلي تشغيل الذكر مباشرة.
 *
 * mode=external:
 *   المصدر لديه تسجيل أذكار حقيقي، لكن المصدر المنشور لا يعطي لنا
 *   ملفًا مباشرًا مضمونًا مطابقًا لكل عنصر في JSON؛ لذلك نفتح المصدر
 *   الأصلي بدل اختلاق روابط أو ربط ذكر بملف غير مطابق.
 */
const ADHKAR_RECITERS: AdhkarReciter[] = [
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    sourceName: 'IslamHouse',
    mode: 'direct',
    description: 'حصن المسلم كاملًا مع نسخة مقسمة على أبواب الكتاب.',
    coverage: 'حصن المسلم كاملًا + تقسيم على الأبواب',
    sourceUrl: 'https://islamhouse.com/ar/audios/263352/',
    badge: 'تشغيل مباشر',
  },
  {
    id: 'sulaiman-al-shuhayhi',
    name: 'سليمان بن محمد الشويهي',
    sourceName: 'IslamHouse',
    mode: 'external',
    description: 'قراءة صوتية كاملة لحصن المسلم، مع نسخة مقسمة على الأبواب.',
    coverage: 'حصن المسلم كاملًا + تقسيم على الأبواب',
    sourceUrl: 'https://islamhouse.com/ar/audios/2799103/',
    badge: 'مكتبة كاملة',
  },
  {
    id: 'mishary-alafasy',
    name: 'مشاري بن راشد العفاسي',
    sourceName: 'TVQuran / IslamHouse',
    mode: 'external',
    description: 'تسجيلات منشورة لأذكار الصباح والمساء والنوم والاستيقاظ.',
    coverage: 'الصباح + المساء + النوم + الاستيقاظ',
    sourceUrl: 'https://www.tvquran.com/ar/scholar/85/profile/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A-%D8%A7%D9%84%D8%B9%D9%81%D8%A7%D8%B3%D9%8A',
    badge: 'عدة أذكار',
    embedByType: {
      morning: 'https://www.tvquran.com/ar/selection/3/embeddable',
      evening: 'https://www.tvquran.com/ar/selection/4/embeddable',
      sleep: 'https://www.tvquran.com/ar/selection/11/embeddable',
      waking: 'https://www.tvquran.com/ar/selection/1/embeddable',
    },
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    sourceName: 'TVQuran / IslamHouse',
    mode: 'external',
    description: 'أذكار الصباح والمساء، إضافة إلى تسجيلات لبعض أبواب حصن المسلم.',
    coverage: 'الصباح + المساء + بعض أبواب حصن المسلم',
    sourceUrl: 'https://www.tvquran.com/ar/scholar/64/profile/%D9%81%D8%A7%D8%B1%D8%B3-%D8%B9%D8%A8%D8%A7%D8%AF',
    badge: 'عدة تسجيلات',
    embedByType: {
      morning: 'https://www.tvquran.com/ar/selection/5/embeddable',
      evening: 'https://www.tvquran.com/ar/selection/6/embeddable',
    },
  },
  {
    id: 'mohamed-jibril',
    name: 'محمد جبريل',
    sourceName: 'TVQuran',
    mode: 'external',
    description: 'تسجيلات منشورة لأذكار الصباح والمساء.',
    coverage: 'الصباح + المساء',
    sourceUrl: 'https://www.tvquran.com/ar/scholar/76/profile/%D9%85%D8%AD%D9%85%D8%AF-%D8%AC%D8%A8%D8%B1%D9%8A%D9%84',
    badge: 'الصباح والمساء',
    embedByType: {
      morning: 'https://www.tvquran.com/ar/selection/7/embeddable',
      evening: 'https://www.tvquran.com/ar/selection/8/embeddable',
    },
  },
  {
    id: 'nasser-alqatami',
    name: 'ناصر القطامي',
    sourceName: 'TVQuran',
    mode: 'external',
    description: 'تسجيل منشور ضمن قسم أذكار اليوم والليلة.',
    coverage: 'أذكار اليوم والليلة',
    sourceUrl: 'https://www.tvquran.com/ar/scholar/90/profile/%D9%86%D8%A7%D8%B5%D8%B1-%D8%A7%D9%84%D9%82%D8%B7%D8%A7%D9%85%D9%8A',
    badge: 'أذكار اليوم والليلة',
    embedByType: {
      morning: 'https://www.tvquran.com/ar/selection/2/embeddable',
      evening: 'https://www.tvquran.com/ar/selection/2/embeddable',
    },
  },
  {
    id: 'walid-abu-ziyad',
    name: 'وليد أبو زياد',
    sourceName: 'IslamHouse',
    mode: 'external',
    description: 'تسجيلات صوتية لبعض أبواب حصن المسلم بصيغة MP3.',
    coverage: 'بعض أبواب حصن المسلم',
    sourceUrl: 'https://islamhouse.com/ar/audios/289179/',
    badge: 'أبواب متعددة',
  },
  {
    id: 'abu-alhasan-alhadramy',
    name: 'أبو الحسن الحضرمي',
    sourceName: 'IslamHouse',
    mode: 'external',
    description: 'تسجيلات عربية لأذكار الصباح والمساء منشورة ضمن مادة صوتية.',
    coverage: 'الصباح + المساء',
    sourceUrl: 'https://islamhouse.com/ar/audios/194307/',
    badge: 'الصباح والمساء',
  },
  {
    id: 'saad-alghamdi',
    name: 'سعد الغامدي',
    sourceName: 'Duaa-MP3',
    mode: 'external',
    description: 'مكتبة خارجية تضم عددًا كبيرًا من الأدعية والأذكار بصيغة MP3.',
    coverage: 'مكتبة أدعية وأذكار متعددة',
    sourceUrl: 'https://duaa-mp3.blogspot.com/p/blog-page_54.html',
    badge: 'مكتبة كبيرة',
  },
]

const DEFAULT_RECITER = ADHKAR_RECITERS[0]

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

function displayCategoryName(category: AdhkarCategory) {
  const name = String(category.category || '').trim()
  if (
    name.includes('الصباح') ||
    name.includes('المساء') ||
    name.includes('النوم') ||
    name.includes('الاستيقاظ')
  ) {
    return name
  }
  return 'أذكار متنوعة'
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

function getCategoryFromPayload(
  json: unknown,
  config: { categoryNames: string[] }
) {
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

function ReaderMiniCard({ reader, selected, onSelect }: {
  reader: AdhkarReciter
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-right rounded-2xl border p-3 transition-all ${
        selected
          ? 'border-mushaf-teal bg-mushaf-teal/5 shadow-sm ring-1 ring-mushaf-teal/10'
          : 'border-mushaf-border/30 bg-white hover:border-mushaf-teal/40 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            selected
              ? 'bg-mushaf-teal text-white'
              : 'bg-mushaf-paper text-mushaf-teal border border-mushaf-border/20'
          }`}
        >
          <Headphones size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-black text-sm text-mushaf-dark truncate">{reader.name}</p>
            <span
              className={`text-[9px] px-2 py-1 rounded-full shrink-0 font-black ${
                reader.mode === 'direct'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {reader.badge}
            </span>
          </div>

          <p className="text-[10px] text-gray-400 mt-1 leading-relaxed line-clamp-2">
            {reader.coverage}
          </p>
        </div>
      </div>
    </button>
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
  const playbackTokenRef = useRef(0)

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

  const selectedReciter =
    ADHKAR_RECITERS.find((reader) => reader.id === reciterId) ?? DEFAULT_RECITER

  const selectedEmbedUrl = selectedReciter.embedByType?.[type] ?? ''
  const hasEmbeddedPlayer = selectedReciter.mode === 'external' && Boolean(selectedEmbedUrl)

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
    playbackTokenRef.current += 1
    autoPlayRef.current = false
    sequenceRef.current = null

    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.onplay = null
      audioRef.current.onpause = null
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
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

      const token = ++playbackTokenRef.current
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

        if (nextIndex < items.length && autoPlayRef.current && token === playbackTokenRef.current) {
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
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }

      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : 1
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onplay = () => {
        if (token === playbackTokenRef.current) setPlaying(true)
      }

      audio.onpause = () => {
        if (token === playbackTokenRef.current && !autoPlayRef.current) {
          setPlaying(false)
        }
      }

      audio.onerror = async () => {
        if (token !== playbackTokenRef.current) return

        console.error('Adhkar audio error:', url)
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
        if (token !== playbackTokenRef.current) return

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
            autoPlayRef.current = false
            sequenceRef.current = null
            setPlaying(false)
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
        if (token === playbackTokenRef.current) {
          autoPlayRef.current = false
          sequenceRef.current = null
          setPlaying(false)
        }
      }
    },
    [items, markCompleted, muted, rate]
  )

  const openSelectedReciter = useCallback(() => {
    window.open(selectedReciter.sourceUrl, '_blank', 'noopener,noreferrer')
  }, [selectedReciter.sourceUrl])

  const startAll = useCallback(() => {
    if (!items.length) return

    if (selectedReciter.mode === 'external') {
      if (!hasEmbeddedPlayer) openSelectedReciter()
      return
    }

    const firstIncompleteIndex = items.findIndex(
      (item) => !completedIds.includes(item.id) && Number(item.count) > 0
    )

    const startIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0

    if (startIndex === 0 && completedIds.length === items.length) {
      setCompletedIds([])
      setCounts(buildCounts(items))
    }

    void playSequenceFrom(startIndex, 1)
  }, [completedIds, hasEmbeddedPlayer, items, openSelectedReciter, playSequenceFrom, selectedReciter.mode])

  const playItem = useCallback(
    (item: AdhkarItem) => {
      setActiveId(item.id)

      if (selectedReciter.mode === 'external') {
        openSelectedReciter()
        return
      }

      const index = items.findIndex((candidate) => candidate.id === item.id)
      if (index < 0) return

      stopAudio()
      setCompletedIds((previous) => previous.filter((id) => id !== item.id))
      setCounts((previous) => ({
        ...previous,
        [item.id]: Math.max(1, Number(item.count) || 1),
      }))

      void playSequenceFrom(index, 1)
    },
    [hasEmbeddedPlayer, items, openSelectedReciter, playSequenceFrom, selectedReciter.mode, stopAudio]
  )

  const pauseResume = useCallback(() => {
    if (selectedReciter.mode === 'external') {
      if (!hasEmbeddedPlayer) openSelectedReciter()
      return
    }

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
  }, [hasEmbeddedPlayer, openSelectedReciter, playItem, playing, selectedItem, selectedReciter.mode])

  useEffect(() => {
    let ignore = false

    const loadData = async () => {
      setLoading(true)
      setDataError('')
      stopAudio()

      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to fetch adhkar')

        const json: unknown = await response.json()
        const categories: AdhkarCategory[] = Array.isArray(json)
          ? json
          : Array.isArray((json as { data?: unknown })?.data)
            ? (json as { data: AdhkarCategory[] }).data
            : Array.isArray((json as { adhkar?: unknown })?.adhkar)
              ? (json as { adhkar: AdhkarCategory[] }).adhkar
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
            requestedCategoryId ? displayCategoryName(wanted) : config.title
          )
        }
      } catch (error) {
        console.error('Adhkar data error:', error)

        const fallback = fallbackData[type]

        if (!ignore) {
          setDataError(
            'تعذر تحميل البيانات الخارجية الآن، تم تشغيل النسخة الاحتياطية. التسجيل المباشر يعتمد على توفر بيانات الصوت الخارجية.'
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

    void loadData()

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
    playing && Boolean(audioRef.current) && autoPlayRef.current && selectedReciter.mode === 'direct'

  const showDirectAudio = selectedReciter.mode === 'direct'

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
              {pageTitle}
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
                اختر من مكتبة أصوات الأذكار المتاحة، واستمع للنص المربوط مباشرة عندما يتوفر تسجيل مطابق للذكر.
              </p>
            </div>
          </div>

          {dataError && (
            <div className="relative z-10 mt-4 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-xs leading-relaxed text-white/80">
              {dataError}
            </div>
          )}
        </section>

        <section className="mt-4 bg-white rounded-[2rem] p-4 sm:p-5 shadow-sm border border-mushaf-border/40">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-black text-mushaf-dark text-base">مكتبة قراء الأذكار</h2>
              <p className="text-xs text-gray-400 mt-1">
                {arabicDigits(ADHKAR_RECITERS.length)} أصوات/مصادر أذكار تم التحقق من وجود تسجيلات لها
              </p>
            </div>

            <a
              href={selectedReciter.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-mushaf-paper text-mushaf-teal border border-mushaf-border/30 font-black text-[11px] shrink-0"
            >
              المصدر
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ADHKAR_RECITERS.map((reader) => (
              <ReaderMiniCard
                key={reader.id}
                reader={reader}
                selected={reader.id === selectedReciter.id}
                onSelect={() => {
                  stopAudio()
                  setReciterId(reader.id)
                }}
              />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-[11px] leading-relaxed text-amber-900/80">
            <strong>مهم:</strong> ليس كل مصدر خارجي يوفر ملفًا منفصلًا لكل ذكر داخل التطبيق. عند اختيار مصدر خارجي سيُفتح التسجيل الأصلي من الجهة الناشرة بدل ربط ذكر بملف غير مطابق.
          </div>
        </section>

        {hasEmbeddedPlayer && (
          <section className="mt-4 bg-white rounded-[2rem] p-4 sm:p-5 shadow-sm border border-mushaf-border/40">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-black text-mushaf-dark text-base">مشغل {selectedReciter.name}</h2>
                <p className="text-xs text-gray-400 mt-1">تسجيل منشور للنوع الحالي من الذكر.</p>
              </div>
              <a
                href={selectedReciter.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-mushaf-paper text-mushaf-teal border border-mushaf-border/30 font-black text-[11px]"
              >
                المصدر
                <ExternalLink size={14} />
              </a>
            </div>
            <div className="overflow-hidden rounded-2xl border border-mushaf-border/20 bg-black/5">
              <iframe
                src={selectedEmbedUrl}
                title={`تسجيل أذكار ${selectedReciter.name}`}
                className="w-full h-[280px] border-0"
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">المشغل مقدم من الجهة الناشرة، وقد يكون التسجيل وردًا صوتيًا مستقلًا وليس ملفًا منفصلًا لكل ذكر.</p>
          </section>
        )}

        <section className="mt-4 bg-white rounded-[2rem] p-4 sm:p-5 shadow-sm border border-mushaf-border/40">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-black block mb-2">
                القارئ المحدد
              </label>

              <div className="rounded-2xl bg-mushaf-paper border border-mushaf-border/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mushaf-teal text-white flex items-center justify-center shrink-0">
                    <Headphones size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-mushaf-dark">{selectedReciter.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                      {selectedReciter.sourceName} — {selectedReciter.coverage}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] rounded-full px-2.5 py-1 font-black shrink-0 ${
                      selectedReciter.mode === 'direct'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {selectedReciter.mode === 'direct' ? 'تشغيل داخل الصفحة' : hasEmbeddedPlayer ? 'مشغل داخل الصفحة' : 'فتح المصدر'}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                {selectedReciter.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-black">السرعة</label>
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
                  {selectedItem
                    ? selectedReciter.mode === 'direct'
                      ? `تشغيل مباشر — ${selectedReciter.name}`
                      : `مكتبة خارجية — ${selectedReciter.name}`
                    : `مشغل ${selectedReciter.name}`}
                </p>

                <p className="text-sm font-bold line-clamp-2 leading-relaxed">
                  {selectedItem
                    ? selectedItem.text
                    : 'شغّل الورد ليبدأ من أول ذكر غير مكتمل، أو افتح مكتبة القارئ المحدد.'}
                </p>

                {selectedItem && showDirectAudio && (
                  <p className="text-[10px] text-white/55 mt-2">
                    التكرار {arabicDigits(currentRepetition)} من {arabicDigits(selectedItem.count)}
                    {' — المتبقي '}{arabicDigits(currentRemaining)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={
                  selectedReciter.mode === 'external'
                    ? hasEmbeddedPlayer
                      ? () => undefined
                      : openSelectedReciter
                    : isSequencePlaying
                      ? pauseResume
                      : selectedItem
                        ? pauseResume
                        : startAll
                }
                disabled={!items.length}
                className="w-12 h-12 rounded-2xl bg-mushaf-gold text-white flex items-center justify-center shadow-md disabled:opacity-50 shrink-0"
                aria-label={
                  selectedReciter.mode === 'external'
                    ? hasEmbeddedPlayer
                      ? 'المشغل المضمّن بالأعلى'
                      : 'فتح تسجيل القارئ'
                    : isSequencePlaying
                      ? 'إيقاف مؤقت'
                      : 'تشغيل الورد'
                }
              >
                {selectedReciter.mode === 'external' ? (
                  <ExternalLink size={21} />
                ) : isSequencePlaying ? (
                  <Pause size={21} fill="currentColor" />
                ) : (
                  <Play size={21} fill="currentColor" />
                )}
              </button>

              {selectedItem && selectedReciter.mode === 'direct' && (
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
                  {selectedReciter.mode === 'external' ? (
                    <ExternalLink size={17} />
                  ) : (
                    <Play size={17} fill="currentColor" />
                  )}
                  {selectedReciter.mode === 'external'
                    ? hasEmbeddedPlayer
                      ? 'المشغل بالأعلى'
                      : 'فتح تسجيل القارئ'
                    : 'تشغيل الورد كاملًا'}
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
              const hasDirectAudio = Boolean(item.audio) && selectedReciter.mode === 'direct'

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
                      {hasDirectAudio ? (
                        <span className="text-[10px] bg-mushaf-teal/10 text-mushaf-teal rounded-full px-2.5 py-1 font-black">
                          صوت مباشر
                        </span>
                      ) : selectedReciter.mode === 'external' ? (
                        <span className="text-[10px] bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 font-black">
                          من المكتبة
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
                        <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
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
                    <button
                      type="button"
                      onClick={() => playItem(item)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition ${
                        selectedReciter.mode === 'external'
                          ? 'bg-amber-500 text-white hover:opacity-90'
                          : isActive && playing
                            ? 'bg-mushaf-gold text-white shadow-md'
                            : 'bg-mushaf-teal text-white hover:opacity-90'
                      }`}
                    >
                      {selectedReciter.mode === 'external' ? (
                        <ExternalLink size={18} />
                      ) : isActive && playing ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" />
                      )}
                      {selectedReciter.mode === 'external'
                        ? 'فتح تسجيل القارئ'
                        : isActive && playing
                          ? 'إيقاف'
                          : 'تشغيل الذكر'}
                    </button>

                    <button
                      type="button"
                      onClick={() => copyItem(item)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mushaf-paper text-mushaf-teal font-black text-sm hover:bg-mushaf-teal/10 transition"
                    >
                      {copiedId === item.id ? <CheckCheck size={18} /> : <Copy size={18} />}
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
                          <span className="text-[10px] text-gray-400 font-bold block">متبقي</span>
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
                <CheckCheck size={46} className="mx-auto text-mushaf-gold mb-3" />
                <h2 className="font-black text-2xl mb-2">تقبّل الله طاعتكم</h2>
                <p className="text-white/75 text-sm">أتممت {pageTitle} كاملًا.</p>

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
