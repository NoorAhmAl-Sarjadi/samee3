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
type PlaybackMode = 'item' | 'category'

type Reciter = {
  id: string
  name: string
  description: string
  mode: PlaybackMode
  islamHouseContentId?: number
}

type ApiObject = Record<string, unknown>

// Stable CDN for the existing Hisn Al-Muslim JSON corpus.
const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const HISN_API_BASE = 'https://www.hisnmuslim.com/api/ar'
const ADHKAR_AUDIO_CDN = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main'

// Public IslamHouse API key used in their published SDK examples.
// The key is for the public content API, not a private application secret.
const ISLAMHOUSE_API_BASE =
  'https://api3.islamhouse.com/v3/paV29H2gm56kvLPy'

const DEFAULT_RECITER_ID = 'hamad-al-drehem'

const RECITERS: Reciter[] = [
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    description: 'تسجيلات مجزأة على مستوى الذكر، مناسبة للتشغيل المتسلسل والتكرار.',
    mode: 'item',
  },
  {
    id: 'sulaiman-al-shuwaihi',
    name: 'سليمان الشويهي',
    description: 'تسجيلات أبواب حصن المسلم من مكتبة إسلام هاوس؛ التوفر يختلف حسب الباب.',
    mode: 'category',
    islamHouseContentId: 2799103,
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    description: 'تسجيلات أبواب حصن المسلم المتاحة من مكتبة إسلام هاوس.',
    mode: 'category',
    islamHouseContentId: 289563,
  },
  {
    id: 'walid-abu-ziyad',
    name: 'وليد أبو زياد',
    description: 'تسجيلات لبعض أبواب حصن المسلم من المصدر المفتوح.',
    mode: 'category',
    islamHouseContentId: 289179,
  },
]

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

const fallbackData: Record<AdhkarType, AdhkarCategory> = {
  morning: {
    id: 1,
    category: 'أذكار الصباح والمساء',
    array: [
      {
        id: 1,
        text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ.',
        count: 1,
      },
      {
        id: 2,
        text: 'قُلْ هُوَ اللَّهُ أَحَدٌ، اللَّهُ الصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ.',
        count: 3,
      },
      {
        id: 3,
        text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا.',
        count: 3,
      },
    ],
  },
  evening: {
    id: 1,
    category: 'أذكار الصباح والمساء',
    array: [
      {
        id: 1,
        text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ.',
        count: 1,
      },
      {
        id: 2,
        text: 'قُلْ هُوَ اللَّهُ أَحَدٌ، اللَّهُ الصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ.',
        count: 3,
      },
      {
        id: 3,
        text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا.',
        count: 3,
      },
    ],
  },
  sleep: {
    id: 2,
    category: 'أذكار النوم',
    array: [
      {
        id: 1,
        text: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ.',
        count: 1,
      },
      {
        id: 2,
        text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ.',
        count: 1,
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
        text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ.',
        count: 1,
      },
    ],
  },
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toAbsoluteAudioUrl(value?: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value

  if (value.startsWith('/audio/')) {
    return `${ADHKAR_AUDIO_CDN}${value}`
  }

  return `${HISN_API_BASE.replace(/\/api\/ar$/, '')}${value.startsWith('/') ? value : `/${value}`}`
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

function extractCategories(json: unknown): AdhkarCategory[] {
  if (Array.isArray(json)) return json as AdhkarCategory[]

  const object = json as ApiObject | null

  if (Array.isArray(object?.data)) return object.data as AdhkarCategory[]
  if (Array.isArray(object?.adhkar)) return object.adhkar as AdhkarCategory[]

  return []
}

function getCategoryFromPayload(json: unknown, config: { categoryNames: string[] }) {
  const categories = extractCategories(json)
  const wantedNames = config.categoryNames.map(normalizeArabic)

  return categories.find((category) => {
    const current = normalizeArabic(String(category.category || ''))
    return wantedNames.includes(current)
  })
}

function getNestedStrings(object: ApiObject, keys: string[]) {
  return keys
    .map((key) => object[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function collectAudioCandidates(value: unknown, result: Array<{ label: string; url: string }> = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectAudioCandidates(entry, result))
    return result
  }

  if (!value || typeof value !== 'object') return result

  const object = value as ApiObject
  const audio =
    object.file_url ??
    object.audio_url ??
    object.audioUrl ??
    object.download_url ??
    object.downloadUrl ??
    object.url

  if (typeof audio === 'string' && /(?:mp3|m4a|wav|ogg)(?:\?|$)/i.test(audio)) {
    const labels = getNestedStrings(object, [
      'title',
      'name',
      'file_name',
      'fileName',
      'label',
      'description',
    ])

    result.push({
      label: labels.join(' | '),
      url: audio,
    })
  }

  Object.values(object).forEach((child) => collectAudioCandidates(child, result))

  return result
}

function chooseCategoryAudio(
  candidates: Array<{ label: string; url: string }>,
  categoryName: string
) {
  const wanted = normalizeArabic(categoryName)

  if (!wanted) return ''

  const exact = candidates.find((candidate) => {
    const label = normalizeArabic(candidate.label)
    return label === wanted || label.includes(wanted) || wanted.includes(label)
  })

  if (exact?.url) return exact.url

  const usefulWords = wanted
    .split(' ')
    .filter((word) => word.length >= 4)

  if (!usefulWords.length) return ''

  const fuzzy = candidates.find((candidate) => {
    const label = normalizeArabic(candidate.label)
    const matches = usefulWords.filter((word) => label.includes(word)).length
    return matches >= Math.max(1, Math.ceil(usefulWords.length * 0.6))
  })

  return fuzzy?.url || ''
}

async function loadHisnApiItems(categoryId: number) {
  try {
    const response = await fetch(`${HISN_API_BASE}/${categoryId}.json`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return []

    const json: unknown = await response.json()
    const root = json as ApiObject | null
    const firstArray = root
      ? Object.values(root).find((value): value is unknown[] => Array.isArray(value))
      : null

    if (!Array.isArray(firstArray)) return []

    const parsedItems: Array<AdhkarItem | null> = firstArray.map((entry, index) => {
      const object = entry as ApiObject
      const text =
        object.ARABIC_TEXT ??
        object.arabic ??
        object.text ??
        object.Text
      const count = object.REPEAT ?? object.repeat ?? object.count
      const audio = object.AUDIO ?? object.audio ?? object.audio_url ?? object.audioUrl

      if (typeof text !== 'string') return null

      return {
        id: Number(object.ID ?? object.id ?? index + 1),
        text,
        count: Math.max(1, Number(count) || 1),
        ...(typeof audio === 'string' ? { audio } : {}),
      }
    })

    return parsedItems.filter((item): item is AdhkarItem => item !== null)
  } catch (error) {
    console.error('Hisn Muslim API items error:', error)
    return []
  }
}

async function loadIslamHouseCategoryAudio(
  contentId: number,
  categoryName: string
) {
  const endpoints = [
    `${ISLAMHOUSE_API_BASE}/main/get-item/${contentId}/ar/json`,
    `${ISLAMHOUSE_API_BASE}/main/check-attachment/${contentId}/json`,
  ]

  const allCandidates: Array<{ label: string; url: string }> = []

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) continue

      const json: unknown = await response.json()
      collectAudioCandidates(json, allCandidates)
    } catch (error) {
      console.error('IslamHouse audio source error:', error)
    }
  }

  const unique = Array.from(
    new Map(allCandidates.map((candidate) => [`${candidate.label}|${candidate.url}`, candidate])).values()
  )

  return toAbsoluteAudioUrl(chooseCategoryAudio(unique, categoryName))
}

function ReadAdhkarContent() {
  const searchParams = useSearchParams()
  const requestedCategoryId = Number(searchParams.get('categoryId') || 0)
  const type = normalizeType(searchParams.get('type'))
  const config = typeConfig[type]

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playTokenRef = useRef(0)
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
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER_ID)
  const [pageTitle, setPageTitle] = useState(config.title)
  const [categoryName, setCategoryName] = useState('')
  const [selectedReciterAudio, setSelectedReciterAudio] = useState('')
  const [reciterLoading, setReciterLoading] = useState(false)
  const [reciterError, setReciterError] = useState('')

  const selectedReciter = useMemo(
    () => RECITERS.find((reciter) => reciter.id === reciterId) ?? RECITERS[0],
    [reciterId]
  )

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
  const favoriteStorageKey = `samee3_adhkar_favorites_${requestedCategoryId ? `category-${requestedCategoryId}` : type}`

  const stopAudio = useCallback(() => {
    playTokenRef.current += 1
    autoPlayRef.current = false
    sequenceRef.current = null

    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.onplay = null
      audioRef.current.onpause = null
      audioRef.current.pause()
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

  const markAllCompleted = useCallback(() => {
    const nextCounts: Record<number, number> = {}

    items.forEach((item) => {
      nextCounts[item.id] = 0
    })

    setCounts(nextCounts)
    setCompletedIds(items.map((item) => item.id))
  }, [items])

  const playCategoryAudio = useCallback(
    async (url: string) => {
      if (!url || !items.length) return

      const token = ++playTokenRef.current
      autoPlayRef.current = true
      sequenceRef.current = null
      setActiveId(items[0]?.id ?? null)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }

      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : 1
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onplay = () => {
        if (token === playTokenRef.current) setPlaying(true)
      }

      audio.onpause = () => {
        if (token === playTokenRef.current && !autoPlayRef.current) {
          setPlaying(false)
        }
      }

      audio.onerror = () => {
        if (token !== playTokenRef.current) return

        console.error('Category audio error:', url)
        autoPlayRef.current = false
        setPlaying(false)
        setReciterError('تعذر تشغيل التسجيل من هذا المصدر لهذا القسم.')
      }

      audio.onended = () => {
        if (token !== playTokenRef.current) return

        markAllCompleted()
        autoPlayRef.current = false
        sequenceRef.current = null
        setPlaying(false)
      }

      try {
        await audio.play()
      } catch (error) {
        if (token !== playTokenRef.current) return
        console.error('Category playback blocked:', error)
        autoPlayRef.current = false
        setPlaying(false)
      }
    },
    [items, markAllCompleted, muted, rate]
  )

  const playSequenceFrom = useCallback(
    async (startIndex: number, firstRepetition = 1) => {
      if (!items.length || startIndex < 0 || startIndex >= items.length) return

      if (selectedReciter.mode === 'category') {
        if (!selectedReciterAudio) {
          setReciterError('لا يوجد تسجيل متوفر لهذا القارئ لهذا القسم حاليًا.')
          return
        }

        await playCategoryAudio(selectedReciterAudio)
        return
      }

      const item = items[startIndex]
      if (!item) return

      const token = ++playTokenRef.current

      autoPlayRef.current = true
      sequenceRef.current = {
        itemIndex: startIndex,
        repetition: firstRepetition,
      }
      setActiveId(item.id)

      const url = toAbsoluteAudioUrl(item.audio)

      if (!url) {
        markCompleted(item)

        const nextIndex = startIndex + 1
        if (nextIndex < items.length && token === playTokenRef.current && autoPlayRef.current) {
          await playSequenceFrom(nextIndex, 1)
          return
        }

        autoPlayRef.current = false
        sequenceRef.current = null
        setPlaying(false)
        return
      }

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }

      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : 1
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onplay = () => {
        if (token === playTokenRef.current) setPlaying(true)
      }

      audio.onpause = () => {
        if (token === playTokenRef.current && !autoPlayRef.current) {
          setPlaying(false)
        }
      }

      audio.onerror = async () => {
        if (token !== playTokenRef.current) return

        console.error('Adhkar item audio error:', url)
        markCompleted(item)

        const nextIndex = startIndex + 1
        if (nextIndex < items.length && autoPlayRef.current && token === playTokenRef.current) {
          await playSequenceFrom(nextIndex, 1)
          return
        }

        autoPlayRef.current = false
        sequenceRef.current = null
        setPlaying(false)
      }

      audio.onended = async () => {
        if (token !== playTokenRef.current) return

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
            if (token !== playTokenRef.current) return
            console.error('Adhkar repeat playback error:', error)
            markCompleted(item)
          }

          return
        }

        markCompleted(item)

        const nextIndex = startIndex + 1

        if (nextIndex < items.length && autoPlayRef.current && token === playTokenRef.current) {
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
        if (token !== playTokenRef.current) return
        console.error('Adhkar playback blocked:', error)
        autoPlayRef.current = false
        sequenceRef.current = null
        setPlaying(false)
      }
    },
    [
      items,
      markCompleted,
      muted,
      playCategoryAudio,
      rate,
      selectedReciter.mode,
      selectedReciterAudio,
    ]
  )

  const startAll = useCallback(() => {
    if (!items.length) return

    if (progress === 100) {
      setCompletedIds([])
      setCounts(buildCounts(items))
    }

    if (selectedReciter.mode === 'category') {
      if (!selectedReciterAudio) {
        setReciterError('لا يوجد تسجيل متوفر لهذا القارئ لهذا القسم حاليًا.')
        return
      }

      void playCategoryAudio(selectedReciterAudio)
      return
    }

    const firstIncompleteIndex = items.findIndex(
      (item) => !completedIds.includes(item.id) && (counts[item.id] ?? item.count) > 0
    )

    const startIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0
    void playSequenceFrom(startIndex, 1)
  }, [completedIds, counts, items, playCategoryAudio, playSequenceFrom, progress, selectedReciter.mode, selectedReciterAudio])

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

      if (selectedReciter.mode === 'category') {
        if (!selectedReciterAudio) {
          setReciterError('لا يوجد تسجيل متوفر لهذا القارئ لهذا القسم حاليًا.')
          return
        }

        void playCategoryAudio(selectedReciterAudio)
        return
      }

      void playSequenceFrom(index, 1)
    },
    [items, playCategoryAudio, playSequenceFrom, selectedReciter.mode, selectedReciterAudio, stopAudio]
  )

  const pauseResume = useCallback(() => {
    if (!audioRef.current) {
      if (selectedItem) playItem(selectedItem)
      else startAll()
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
      autoPlayRef.current = false
    })
  }, [playItem, playing, selectedItem, startAll])

  useEffect(() => {
    let ignore = false

    const loadData = async () => {
      setLoading(true)
      setDataError('')
      setReciterError('')
      stopAudio()

      try {
        let categories: AdhkarCategory[] = []

        try {
          const response = await fetch(DATA_URL, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          })

          if (response.ok) {
            categories = extractCategories(await response.json())
          }
        } catch (error) {
          console.error('Primary adhkar data error:', error)
        }

        let wanted = requestedCategoryId
          ? categories.find((category) => Number(category.id) === requestedCategoryId)
          : getCategoryFromPayload(await Promise.resolve(categories), config)

        if (!wanted && requestedCategoryId > 0) {
          const directItems = await loadHisnApiItems(requestedCategoryId)
          if (directItems.length) {
            wanted = {
              id: requestedCategoryId,
              category: directItems[0]?.filename || 'أذكار متنوعة',
              array: directItems,
            }
          }
        }

        if (!wanted?.array?.length) {
          throw new Error('Category not found')
        }

        if (!ignore) {
          setItems(wanted.array)
          setCounts(buildCounts(wanted.array))
          setCompletedIds([])
          setActiveId(null)
          setCategoryName(String(wanted.category || '').trim())
          setPageTitle(
            requestedCategoryId
              ? /الصباح|المساء|النوم|الاستيقاظ/.test(String(wanted.category))
                ? String(wanted.category)
                : 'أذكار متنوعة'
              : config.title
          )
        }
      } catch (error) {
        console.error('Adhkar data error:', error)

        const fallback = fallbackData[type]

        if (!ignore) {
          setDataError('تعذر تحميل المصدر الخارجي الآن، تم تشغيل النسخة الاحتياطية.')
          setItems(fallback.array)
          setCounts(buildCounts(fallback.array))
          setCompletedIds([])
          setActiveId(null)
          setCategoryName(String(fallback.category || '').trim())
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
  }, [config.categoryNames, config.title, requestedCategoryId, stopAudio, type])

  useEffect(() => {
    let cancelled = false

    const loadSelectedReciter = async () => {
      setReciterError('')
      setSelectedReciterAudio('')

      if (selectedReciter.mode === 'item') return
      if (!items.length) return
      if (!selectedReciter.islamHouseContentId) return

      setReciterLoading(true)

      const url = await loadIslamHouseCategoryAudio(
        selectedReciter.islamHouseContentId,
        categoryName || pageTitle
      )

      if (!cancelled) {
        setSelectedReciterAudio(url)

        if (!url) {
          setReciterError('هذا القارئ لا يملك تسجيلًا مطابقًا لهذا القسم في المصدر المتاح حاليًا.')
        }
      }

      if (!cancelled) setReciterLoading(false)
    }

    void loadSelectedReciter()

    return () => {
      cancelled = true
    }
  }, [categoryName, items.length, pageTitle, reciterId, selectedReciter])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]')
      if (Array.isArray(saved)) setFavoriteIds(saved)
      else setFavoriteIds([])
    } catch {
      setFavoriteIds([])
    }
  }, [favoriteStorageKey])

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

      localStorage.setItem(favoriteStorageKey, JSON.stringify(next))
      return next
    })
  }

  const handleMute = () => {
    setMuted((previous) => !previous)
  }

  const handleReciterChange = (nextId: string) => {
    stopAudio()
    setReciterError('')
    setReciterId(nextId)
  }

  const isSequencePlaying = playing && Boolean(audioRef.current) && autoPlayRef.current

  const displayTitle = requestedCategoryId
    ? pageTitle === config.title && !/الصباح|المساء|النوم|الاستيقاظ/.test(pageTitle)
      ? 'أذكار متنوعة'
      : pageTitle
    : config.title

  const categoryAudioReady = selectedReciter.mode === 'item' || Boolean(selectedReciterAudio)

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

          <div className="text-center min-w-0 px-3">
            <h1 className="font-black text-mushaf-dark text-lg truncate">{displayTitle}</h1>
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
                شغّل الورد وسيكمل تلقائيًا حتى ينتهي جميع الذكر في القسم
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
          <div className="flex flex-col gap-3">
            <div>
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
                  onChange={(event) => handleReciterChange(event.target.value)}
                  className="w-full appearance-none bg-mushaf-paper border border-mushaf-border/40 rounded-2xl pr-11 pl-4 py-3 text-sm font-black text-mushaf-dark outline-none focus:ring-2 focus:ring-mushaf-teal/15"
                  aria-label="اختيار القارئ"
                >
                  {RECITERS.map((reciter) => (
                    <option key={reciter.id} value={reciter.id}>
                      {reciter.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                {selectedReciter.description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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

              {reciterLoading && (
                <span className="inline-flex items-center gap-2 text-[11px] font-black text-mushaf-teal bg-mushaf-teal/5 rounded-2xl px-3 py-3 sm:mr-auto">
                  <Loader2 size={15} className="animate-spin" />
                  جاري البحث عن تسجيل هذا القسم...
                </span>
              )}

              {!reciterLoading && selectedReciter.mode === 'category' && selectedReciterAudio && (
                <span className="text-[11px] font-black text-green-600 bg-green-50 rounded-2xl px-3 py-3 sm:mr-auto">
                  تسجيل القسم متاح
                </span>
              )}
            </div>

            {reciterError && (
              <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl px-4 py-3 text-[11px] font-bold leading-relaxed">
                {reciterError}
              </div>
            )}

            <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[1.7rem] p-4 sm:p-5 text-white shadow-lg">
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
                      : `شغّل الورد وسيستمر تلقائيًا حتى نهاية ${displayTitle}`}
                  </p>

                  {selectedItem && currentRepetition > 0 && (
                    <p className="text-[10px] text-white/55 mt-2">
                      التكرار {arabicDigits(currentRepetition)} من{' '}
                      {arabicDigits(selectedItem.count)}
                    </p>
                  )}

                  {selectedReciter.mode === 'category' && selectedReciterAudio && (
                    <p className="text-[10px] text-white/55 mt-2">
                      القارئ المحدد: {selectedReciter.name} — التسجيل المتوفر يغطي القسم كاملًا.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={isSequencePlaying ? pauseResume : selectedItem ? pauseResume : startAll}
                  disabled={!items.length || !categoryAudioReady || reciterLoading}
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
                  disabled={!items.length || !categoryAudioReady || reciterLoading}
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
              const hasItemAudio = Boolean(item.audio) || selectedReciter.mode === 'category'

              return (
                <article
                  key={`${requestedCategoryId || type}-${item.id}-${index}`}
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
                        <span className="text-[11px] text-gray-400 font-bold block">العدد المطلوب</span>
                        <span className="text-sm font-black text-mushaf-dark">
                          {arabicDigits(item.count)} مرات
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {hasItemAudio ? (
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
                    {selectedReciter.mode === 'category' ? (
                      <button
                        type="button"
                        onClick={() => playItem(item)}
                        disabled={!selectedReciterAudio || reciterLoading}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition disabled:opacity-50 ${
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
                        {isActive && playing ? 'إيقاف' : 'تشغيل القسم'}
                      </button>
                    ) : item.audio ? (
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
                <p className="text-white/75 text-sm">أتممت {displayTitle} كاملًا.</p>

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
