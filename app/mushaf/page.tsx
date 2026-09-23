
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Heart,
  Home,
  ImageIcon,
  List,
  Loader2,
  Mic2,
  Pause,
  Play,
  Search,
  Sparkles,
  Repeat,
  X,
} from 'lucide-react'

type Riwaya =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'
  | 'sousi'
  | 'bazzi'

type Ayah = {
  number: number
  key?: string
  text: string
  numberInSurah: number
  juz?: number
  page?: number
  audioNumber?: number
  surah?: {
    number: number
    name: string
    englishName?: string
  }
}

type PageData = {
  ayahs: Ayah[]
}

type ApiMoshaf = {
  id?: number
  name?: string
  server?: string
  surah_list?: string
}

type ApiReciter = {
  id: number
  name: string
  moshaf?: ApiMoshaf[]
}

type LocalReciter = {
  id: string
  apiId: number
  label: string
  moshafId: number | null
  server: string
}

type TurnDirection = 'next' | 'prev' | null

type SearchTarget = {
  page: number
  surah?: number
  ayah?: number
}

type AyahTiming = {
  ayah?: number
  start_time?: number
  end_time?: number
}

const PRINTED_RIWAYAT = new Set<Riwaya>([
  'hafs',
  'warsh',
  'qalun',
  'douri',
  'shubah',
])

const RIWAYA_NAMES: Record<Riwaya, string> = {
  hafs: 'حفص عن عاصم',
  warsh: 'ورش عن نافع',
  qalun: 'قالون عن نافع',
  douri: 'الدوري عن أبي عمرو',
  shubah: 'شعبة عن عاصم',
  sousi: 'السوسي عن أبي عمرو',
  bazzi: 'البزي عن ابن كثير',
}

const RIWAYA_REMOTE_IDS: Record<Riwaya, number> = {
  hafs: 1,
  bazzi: 5,
  douri: 6,
  qalun: 7,
  shubah: 9,
  sousi: 10,
  warsh: 4,
}

const RIWAYA_KEYWORDS: Record<Riwaya, string[]> = {
  hafs: ['حفص', 'عاصم'],
  warsh: ['ورش', 'نافع'],
  qalun: ['قالون', 'نافع'],
  douri: ['الدوري', 'أبي عمرو', 'ابي عمرو'],
  shubah: ['شعبة', 'شعبه', 'عاصم'],
  sousi: ['السوسي', 'أبي عمرو', 'ابي عمرو'],
  bazzi: ['البزي', 'ابن كثير'],
}

const SURAH_LIST = [
  {
    "id": 1,
    "name": "الفاتحة",
    "page": 1
  },
  {
    "id": 2,
    "name": "البقرة",
    "page": 2
  },
  {
    "id": 3,
    "name": "آل عمران",
    "page": 50
  },
  {
    "id": 4,
    "name": "النساء",
    "page": 77
  },
  {
    "id": 5,
    "name": "المائدة",
    "page": 106
  },
  {
    "id": 6,
    "name": "الأنعام",
    "page": 128
  },
  {
    "id": 7,
    "name": "الأعراف",
    "page": 151
  },
  {
    "id": 8,
    "name": "الأنفال",
    "page": 177
  },
  {
    "id": 9,
    "name": "التوبة",
    "page": 187
  },
  {
    "id": 10,
    "name": "يونس",
    "page": 208
  },
  {
    "id": 11,
    "name": "هود",
    "page": 221
  },
  {
    "id": 12,
    "name": "يوسف",
    "page": 235
  },
  {
    "id": 13,
    "name": "الرعد",
    "page": 249
  },
  {
    "id": 14,
    "name": "إبراهيم",
    "page": 255
  },
  {
    "id": 15,
    "name": "الحجر",
    "page": 262
  },
  {
    "id": 16,
    "name": "النحل",
    "page": 267
  },
  {
    "id": 17,
    "name": "الإسراء",
    "page": 282
  },
  {
    "id": 18,
    "name": "الكهف",
    "page": 293
  },
  {
    "id": 19,
    "name": "مريم",
    "page": 305
  },
  {
    "id": 20,
    "name": "طه",
    "page": 312
  },
  {
    "id": 21,
    "name": "الأنبياء",
    "page": 322
  },
  {
    "id": 22,
    "name": "الحج",
    "page": 332
  },
  {
    "id": 23,
    "name": "المؤمنون",
    "page": 342
  },
  {
    "id": 24,
    "name": "النور",
    "page": 350
  },
  {
    "id": 25,
    "name": "الفرقان",
    "page": 359
  },
  {
    "id": 26,
    "name": "الشعراء",
    "page": 367
  },
  {
    "id": 27,
    "name": "النمل",
    "page": 377
  },
  {
    "id": 28,
    "name": "القصص",
    "page": 385
  },
  {
    "id": 29,
    "name": "العنكبوت",
    "page": 396
  },
  {
    "id": 30,
    "name": "الروم",
    "page": 404
  },
  {
    "id": 31,
    "name": "لقمان",
    "page": 411
  },
  {
    "id": 32,
    "name": "السجدة",
    "page": 415
  },
  {
    "id": 33,
    "name": "الأحزاب",
    "page": 418
  },
  {
    "id": 34,
    "name": "سبأ",
    "page": 428
  },
  {
    "id": 35,
    "name": "فاطر",
    "page": 434
  },
  {
    "id": 36,
    "name": "يس",
    "page": 440
  },
  {
    "id": 37,
    "name": "الصافات",
    "page": 446
  },
  {
    "id": 38,
    "name": "ص",
    "page": 453
  },
  {
    "id": 39,
    "name": "الزمر",
    "page": 458
  },
  {
    "id": 40,
    "name": "غافر",
    "page": 467
  },
  {
    "id": 41,
    "name": "فصلت",
    "page": 477
  },
  {
    "id": 42,
    "name": "الشورى",
    "page": 483
  },
  {
    "id": 43,
    "name": "الزخرف",
    "page": 489
  },
  {
    "id": 44,
    "name": "الدخان",
    "page": 496
  },
  {
    "id": 45,
    "name": "الجاثية",
    "page": 499
  },
  {
    "id": 46,
    "name": "الأحقاف",
    "page": 502
  },
  {
    "id": 47,
    "name": "محمد",
    "page": 507
  },
  {
    "id": 48,
    "name": "الفتح",
    "page": 511
  },
  {
    "id": 49,
    "name": "الحجرات",
    "page": 515
  },
  {
    "id": 50,
    "name": "ق",
    "page": 518
  },
  {
    "id": 51,
    "name": "الذاريات",
    "page": 520
  },
  {
    "id": 52,
    "name": "الطور",
    "page": 523
  },
  {
    "id": 53,
    "name": "النجم",
    "page": 526
  },
  {
    "id": 54,
    "name": "القمر",
    "page": 528
  },
  {
    "id": 55,
    "name": "الرحمن",
    "page": 531
  },
  {
    "id": 56,
    "name": "الواقعة",
    "page": 534
  },
  {
    "id": 57,
    "name": "الحديد",
    "page": 537
  },
  {
    "id": 58,
    "name": "المجادلة",
    "page": 542
  },
  {
    "id": 59,
    "name": "الحشر",
    "page": 545
  },
  {
    "id": 60,
    "name": "الممتحنة",
    "page": 549
  },
  {
    "id": 61,
    "name": "الصف",
    "page": 551
  },
  {
    "id": 62,
    "name": "الجمعة",
    "page": 553
  },
  {
    "id": 63,
    "name": "المنافقون",
    "page": 554
  },
  {
    "id": 64,
    "name": "التغابن",
    "page": 556
  },
  {
    "id": 65,
    "name": "الطلاق",
    "page": 558
  },
  {
    "id": 66,
    "name": "التحريم",
    "page": 560
  },
  {
    "id": 67,
    "name": "الملك",
    "page": 562
  },
  {
    "id": 68,
    "name": "القلم",
    "page": 564
  },
  {
    "id": 69,
    "name": "الحاقة",
    "page": 566
  },
  {
    "id": 70,
    "name": "المعارج",
    "page": 568
  },
  {
    "id": 71,
    "name": "نوح",
    "page": 570
  },
  {
    "id": 72,
    "name": "الجن",
    "page": 572
  },
  {
    "id": 73,
    "name": "المزمل",
    "page": 574
  },
  {
    "id": 74,
    "name": "المدثر",
    "page": 575
  },
  {
    "id": 75,
    "name": "القيامة",
    "page": 577
  },
  {
    "id": 76,
    "name": "الإنسان",
    "page": 578
  },
  {
    "id": 77,
    "name": "المرسلات",
    "page": 580
  },
  {
    "id": 78,
    "name": "النبأ",
    "page": 582
  },
  {
    "id": 79,
    "name": "النازعات",
    "page": 583
  },
  {
    "id": 80,
    "name": "عبس",
    "page": 585
  },
  {
    "id": 81,
    "name": "التكوير",
    "page": 586
  },
  {
    "id": 82,
    "name": "الانفطار",
    "page": 587
  },
  {
    "id": 83,
    "name": "المطففين",
    "page": 587
  },
  {
    "id": 84,
    "name": "الانشقاق",
    "page": 589
  },
  {
    "id": 85,
    "name": "البروج",
    "page": 590
  },
  {
    "id": 86,
    "name": "الطارق",
    "page": 591
  },
  {
    "id": 87,
    "name": "الأعلى",
    "page": 591
  },
  {
    "id": 88,
    "name": "الغاشية",
    "page": 592
  },
  {
    "id": 89,
    "name": "الفجر",
    "page": 593
  },
  {
    "id": 90,
    "name": "البلد",
    "page": 594
  },
  {
    "id": 91,
    "name": "الشمس",
    "page": 595
  },
  {
    "id": 92,
    "name": "الليل",
    "page": 595
  },
  {
    "id": 93,
    "name": "الضحى",
    "page": 596
  },
  {
    "id": 94,
    "name": "الشرح",
    "page": 596
  },
  {
    "id": 95,
    "name": "التين",
    "page": 597
  },
  {
    "id": 96,
    "name": "العلق",
    "page": 597
  },
  {
    "id": 97,
    "name": "القدر",
    "page": 598
  },
  {
    "id": 98,
    "name": "البينة",
    "page": 598
  },
  {
    "id": 99,
    "name": "الزلزلة",
    "page": 599
  },
  {
    "id": 100,
    "name": "العاديات",
    "page": 599
  },
  {
    "id": 101,
    "name": "القارعة",
    "page": 600
  },
  {
    "id": 102,
    "name": "التكاثر",
    "page": 600
  },
  {
    "id": 103,
    "name": "العصر",
    "page": 601
  },
  {
    "id": 104,
    "name": "الهمزة",
    "page": 601
  },
  {
    "id": 105,
    "name": "الفيل",
    "page": 601
  },
  {
    "id": 106,
    "name": "قريش",
    "page": 602
  },
  {
    "id": 107,
    "name": "الماعون",
    "page": 602
  },
  {
    "id": 108,
    "name": "الكوثر",
    "page": 602
  },
  {
    "id": 109,
    "name": "الكافرون",
    "page": 603
  },
  {
    "id": 110,
    "name": "النصر",
    "page": 603
  },
  {
    "id": 111,
    "name": "المسد",
    "page": 603
  },
  {
    "id": 112,
    "name": "الإخلاص",
    "page": 604
  },
  {
    "id": 113,
    "name": "الفلق",
    "page": 604
  },
  {
    "id": 114,
    "name": "الناس",
    "page": 604
  }
]

function isRiwaya(value: string | null): value is Riwaya {
  return (
    value === 'hafs' ||
    value === 'warsh' ||
    value === 'qalun' ||
    value === 'douri' ||
    value === 'shubah' ||
    value === 'sousi' ||
    value === 'bazzi'
  )
}

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

function clampPage(page: number) {
  if (!Number.isFinite(page)) return 1
  return Math.min(604, Math.max(1, Math.floor(page)))
}

function arabicNumber(value: number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function getSurahName(surahNumber?: number, data?: PageData | null) {
  if (data?.ayahs?.[0]?.surah?.name) return data.ayahs[0].surah.name
  if (surahNumber) return SURAH_LIST.find((item) => item.id === surahNumber)?.name || 'المصحف الشريف'
  return 'المصحف الشريف'
}

function getJuz(data?: PageData | null) {
  return data?.ayahs?.find((ayah) => Number.isFinite(ayah.juz))?.juz || 1
}

function getMoshafForRiwaya(reciter: ApiReciter, riwaya: Riwaya) {
  const list = Array.isArray(reciter.moshaf) ? reciter.moshaf : []
  const keywords = RIWAYA_KEYWORDS[riwaya]
  return (
    list.find((item) => {
      const name = normalizeArabic(String(item.name || ''))
      return keywords.every((keyword) => name.includes(normalizeArabic(keyword)))
    }) ||
    list.find((item) => {
      const name = normalizeArabic(String(item.name || ''))
      return keywords.some((keyword) => name.includes(normalizeArabic(keyword)))
    }) ||
    null
  )
}

export default function MushafPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const pageFromUrl = Number(searchParams.get('page') || '1')
  const pageNumber = clampPage(pageFromUrl)
  const ayahFromUrl = searchParams.get('ayah') || ''
  const riwayaFromUrl = searchParams.get('riwaya')
  const riwaya: Riwaya = isRiwaya(riwayaFromUrl) ? riwayaFromUrl : 'hafs'
  const requestedSurah = Number(searchParams.get('surah') || '0')
  const reciterApiId = Number(searchParams.get('reciterId') || '0')
  const requestedMoshafId = Number(searchParams.get('moshafId') || '0')
  const reciterName = searchParams.get('reciterName') || 'القارئ المختار'
  const autoplayRequested = searchParams.get('autoplay') === '1'

  const [isDesktop, setIsDesktop] = useState(false)
  const [showChrome, setShowChrome] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [rightPageData, setRightPageData] = useState<PageData | null>(null)
  const [leftPageData, setLeftPageData] = useState<PageData | null>(null)
  const [svg, setSvg] = useState('')
  const [leftSvg, setLeftSvg] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null)
  const [showAyahActions, setShowAyahActions] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [tafsirText, setTafsirText] = useState('')
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [toast, setToast] = useState('')

  const [reciters, setReciters] = useState<LocalReciter[]>([])
  const [recitersLoading, setRecitersLoading] = useState(false)
  const [selectedReciterId, setSelectedReciterId] = useState(reciterApiId)

  const [audioDisplayUrl, setAudioDisplayUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingAyahNumber, setPlayingAyahNumber] = useState<number | null>(null)
  const [repeatAyahNumber, setRepeatAyahNumber] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const ayahTimingsRef = useRef<AyahTiming[]>([])
  const repeatSeekGuardRef = useRef(false)
  const autoplayConsumedRef = useRef(false)
  const navigatingRef = useRef(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [turnDirection, setTurnDirection] = useState<TurnDirection>(null)
  const [turning, setTurning] = useState(false)

  const desktopRightPage = isDesktop && pageNumber % 2 === 0 ? pageNumber - 1 : pageNumber
  const desktopLeftPage = isDesktop ? Math.min(604, desktopRightPage + 1) : null

  const currentSurahNumber = pageData?.ayahs?.[0]?.surah?.number || requestedSurah || undefined
  const currentSurahName = getSurahName(currentSurahNumber, pageData)
  const currentJuz = getJuz(pageData)
  const leftSurahNumber = leftPageData?.ayahs?.[0]?.surah?.number

  const triggerToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const fetchPageData = useCallback(async (page: number) => {
    const response = await fetch(`/api/quran?riwaya=${encodeURIComponent(riwaya)}&page=${page}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`تعذر تحميل بيانات الصفحة ${page}`)
    const data = await response.json()
    return {
      ayahs: Array.isArray(data?.ayahs)
        ? data.ayahs
        : Array.isArray(data?.data?.ayahs)
          ? data.data.ayahs
          : [],
    } as PageData
  }, [riwaya])

  const fetchSvg = useCallback(async (page: number) => {
    if (!PRINTED_RIWAYAT.has(riwaya)) return ''
    const response = await fetch(`/api/mushaf-svg?riwaya=${encodeURIComponent(riwaya)}&page=${page}`, {
      cache: 'force-cache',
    })
    if (!response.ok) throw new Error(`تعذر تحميل صفحة المصحف ${page}`)
    const data = await response.json()
    if (!data?.success || !data?.svg) throw new Error(`لم يتم العثور على صفحة المصحف ${page}`)
    return String(data.svg)
  }, [riwaya])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    const rightPage = desktopRightPage
    const leftPage = desktopLeftPage

    ;(async () => {
      try {
        const mainData = await fetchPageData(pageNumber)
        if (cancelled) return
        setPageData(mainData)

        if (isDesktop) {
          if (rightPage === pageNumber) {
            setRightPageData(mainData)
          } else {
            const spreadRightData = await fetchPageData(rightPage)
            if (cancelled) return
            setRightPageData(spreadRightData)
          }

          if (leftPage && leftPage !== rightPage) {
            const extra = leftPage === pageNumber ? mainData : await fetchPageData(leftPage)
            if (!cancelled) setLeftPageData(extra)
          } else {
            setLeftPageData(null)
          }
        } else {
          setRightPageData(mainData)
          setLeftPageData(null)
        }

        if (PRINTED_RIWAYAT.has(riwaya)) {
          if (isDesktop && rightPage !== pageNumber) {
            const [rightSvg, extraSvg] = await Promise.all([
              fetchSvg(rightPage),
              leftPage && leftPage !== rightPage ? fetchSvg(leftPage) : Promise.resolve(''),
            ])
            if (!cancelled) {
              setSvg(rightSvg)
              setLeftSvg(extraSvg)
            }
          } else {
            const mainSvg = await fetchSvg(pageNumber)
            if (!cancelled) {
              setSvg(mainSvg)
              setLeftSvg('')
            }
          }
        } else {
          setSvg('')
          setLeftSvg('')
        }
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل المصحف')
          setSvg('')
          setLeftSvg('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [desktopLeftPage, desktopRightPage, fetchPageData, fetchSvg, isDesktop, pageNumber, riwaya])

  useEffect(() => {
    if (!ayahFromUrl) {
      setSelectedAyah(null)
      return
    }

    const [surahPart, ayahPart] = ayahFromUrl.split(':')
    const surah = Number(surahPart)
    const ayahNumber = Number(ayahPart)
    if (!Number.isFinite(surah) || !Number.isFinite(ayahNumber) || ayahNumber <= 0) return

    const sources = [pageData, rightPageData, leftPageData].filter(Boolean) as PageData[]
    const found = sources.flatMap((source) => source.ayahs).find((item) =>
      item.surah?.number === surah && item.numberInSurah === ayahNumber,
    )

    if (found) {
      setSelectedAyah(found)
    }
  }, [ayahFromUrl, leftPageData, pageData, rightPageData])

  const highlightSearchedAyah = useCallback(() => {
    const nodes = document.querySelectorAll(
      '.samee3-page-art .ayahPolygon, .samee3-page-art [data-ayah], .samee3-page-art [data-ayah-number], .samee3-page-art .samee3-text-ayah',
    )

    const visibleSources = [pageData, rightPageData, leftPageData].filter(Boolean) as PageData[]
    const visiblePlayingAyah =
      playingAyahNumber !== null
        ? visibleSources
            .flatMap((source) => source.ayahs)
            .find((item) => item.number === playingAyahNumber) || null
        : null

    nodes.forEach((node) => {
      node.classList.remove('samee3-selected-ayah', 'samee3-playing-ayah')

      const values = [
        node.getAttribute('data-ayah'),
        node.getAttribute('data-ayah-number'),
        node.getAttribute('id'),
      ].filter(Boolean) as string[]

      const numbers = values
        .map((value) => value.match(/\d+/))
        .filter(Boolean)
        .map((match) => Number(match![0]))

      const sheet = node.closest('.samee3-page-sheet') as HTMLElement | null
      const sheetSurah = Number(sheet?.dataset.surahNumber || 0)

      const selectedMatch =
        !!selectedAyah &&
        (
          numbers.some((number) => number === selectedAyah.number) ||
          (
            sheetSurah > 0 &&
            Number(selectedAyah.surah?.number) === sheetSurah &&
            numbers.some((number) => number === selectedAyah.numberInSurah)
          )
        )

      const playingMatch =
        !!visiblePlayingAyah &&
        (
          numbers.some((number) => number === visiblePlayingAyah.number) ||
          (
            sheetSurah > 0 &&
            Number(visiblePlayingAyah.surah?.number) === sheetSurah &&
            numbers.some((number) => number === visiblePlayingAyah.numberInSurah)
          )
        )

      if (selectedMatch) node.classList.add('samee3-selected-ayah')
      if (playingMatch) node.classList.add('samee3-playing-ayah')
    })
  }, [leftPageData, pageData, playingAyahNumber, rightPageData, selectedAyah])


  useEffect(() => {
    const timer = window.setTimeout(highlightSearchedAyah, 120)
    return () => window.clearTimeout(timer)
  }, [highlightSearchedAyah, svg, leftSvg, selectedAyah, playingAyahNumber])

  const mainDisplayedSvg = useMemo(() => {
    if (PRINTED_RIWAYAT.has(riwaya)) return svg
    const displayData = isDesktop ? rightPageData : pageData
    if (!displayData?.ayahs?.length) return ''

    const lines = displayData.ayahs.map((ayah) => {
      const selected = selectedAyah?.number === ayah.number
      const safe = String(ayah.text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      return `<span class="samee3-text-ayah ${selected ? 'samee3-text-selected' : ''}" data-ayah="${ayah.number}">${safe} <span class="samee3-ayah-number">﴿${ayah.numberInSurah}﴾</span></span> `
    }).join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"><foreignObject x="55" y="45" width="890" height="1310"><div xmlns="http://www.w3.org/1999/xhtml" class="samee3-text-page">${lines}</div></foreignObject></svg>`
  }, [isDesktop, pageData, rightPageData, riwaya, selectedAyah, svg])

  const leftDisplayedSvg = useMemo(() => {
    if (!isDesktop || !leftPageData) return ''
    if (PRINTED_RIWAYAT.has(riwaya)) return leftSvg

    const lines = leftPageData.ayahs.map((ayah) => {
      const selected = selectedAyah?.number === ayah.number
      const safe = String(ayah.text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      return `<span class="samee3-text-ayah ${selected ? 'samee3-text-selected' : ''}" data-ayah="${ayah.number}">${safe} <span class="samee3-ayah-number">﴿${ayah.numberInSurah}﴾</span></span> `
    }).join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"><foreignObject x="55" y="45" width="890" height="1310"><div xmlns="http://www.w3.org/1999/xhtml" class="samee3-text-page">${lines}</div></foreignObject></svg>`
  }, [isDesktop, leftPageData, leftSvg, riwaya, selectedAyah])

  const resolveSelectedAyahFromElement = useCallback((element: Element, sourceData: PageData | null) => {
    const values = [
      element.getAttribute('data-ayah'),
      element.getAttribute('data-ayah-number'),
      element.getAttribute('id'),
    ].filter(Boolean) as string[]

    for (const value of values) {
      const match = value.match(/\d+/)
      if (!match) continue
      const numeric = Number(match[0])
      const exact = sourceData?.ayahs?.find((ayah) => ayah.number === numeric)
      if (exact) return exact
      const byInSurah = sourceData?.ayahs?.find((ayah) => ayah.numberInSurah === numeric)
      if (byInSurah) return byInSurah
    }

    return null
  }, [])

  const handleAyahClick = useCallback((event: React.MouseEvent<HTMLElement>, sourceData: PageData | null) => {
    const target = event.target as Element | null
    if (!target) return
    const polygon = target.closest('.ayahPolygon, [data-ayah], [data-ayah-number], .samee3-text-ayah')
    if (!polygon) return

    event.stopPropagation()
    const found = resolveSelectedAyahFromElement(polygon, sourceData)
    if (!found) return

    setSelectedAyah(found)
    setShowAyahActions(true)
    try {
      const saved = JSON.parse(localStorage.getItem('samee3_bookmarks') || '[]')
      setIsSaved(Array.isArray(saved) && saved.some((item: { number?: number; surahName?: string }) => item?.number === found.number))
    } catch {
      setIsSaved(false)
    }
  }, [resolveSelectedAyahFromElement])

  const navigateTo = useCallback((page: number, extra?: { surah?: number; ayah?: string }, direction: 'next' | 'prev' = 'next') => {
    const nextPage = clampPage(page)
    if (navigatingRef.current) return
    if (nextPage === pageNumber && !extra?.ayah && !extra?.surah) return

    navigatingRef.current = true
    setTurnDirection(direction)
    setTurning(true)

    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage))
    if (extra?.surah) params.set('surah', String(extra.surah))
    if (extra?.ayah) params.set('ayah', extra.ayah)
    else params.delete('ayah')

    window.setTimeout(() => {
      router.push(`/mushaf?${params.toString()}`)
    }, 240)

    window.setTimeout(() => {
      navigatingRef.current = false
      setTurning(false)
      setTurnDirection(null)
    }, 560)
  }, [pageNumber, router, searchParams])

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!event.touches.length) return
    touchStartX.current = event.touches[0].clientX
    touchStartY.current = event.touches[0].clientY
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null || !event.changedTouches.length) return
    const endX = event.changedTouches[0].clientX
    const endY = event.changedTouches[0].clientY
    const deltaX = endX - touchStartX.current
    const deltaY = endY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 50) return

    const step = isDesktop ? 2 : 1
    if (deltaX > 0) {
      navigateTo(pageNumber + step, undefined, 'next')
    } else {
      navigateTo(pageNumber - step, undefined, 'prev')
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') navigateTo(pageNumber - (isDesktop ? 2 : 1), undefined, 'prev')
      if (event.key === 'ArrowLeft') navigateTo(pageNumber + (isDesktop ? 2 : 1), undefined, 'next')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDesktop, navigateTo, pageNumber])

  const fetchReciters = useCallback(async (riwayaId: Riwaya) => {
    setRecitersLoading(true)
    try {
      const response = await fetch(`https://mp3quran.net/api/v3/reciters?language=ar&rewaya=${RIWAYA_REMOTE_IDS[riwaya]}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('تعذر تحميل القراء')
      const payload = await response.json()
      const rawReciters = Array.isArray(payload?.reciters) ? payload.reciters as ApiReciter[] : []
      const mapped = rawReciters.flatMap((item) => {
        const moshaf = getMoshafForRiwaya(item, riwaya)
        if (!moshaf?.server) return []
        return [{
          id: `${item.id}-${moshaf.id ?? 'default'}`,
          apiId: Number(item.id),
          label: item.name,
          moshafId: moshaf.id ?? null,
          server: String(moshaf.server).replace(/\/$/, ''),
        }]
      })
      setReciters(mapped)
      return mapped
    } catch (error) {
      console.error(error)
      setReciters([])
      return []
    } finally {
      setRecitersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!showChrome) return
    void fetchReciters(riwaya)
  }, [fetchReciters, riwaya, showChrome])

  const selectedReciter = useMemo(() => {
    const current = reciters.find((item) => item.apiId === selectedReciterId && (requestedMoshafId <= 0 || item.moshafId === requestedMoshafId))
    return current || reciters.find((item) => item.apiId === selectedReciterId) || reciters[0] || null
  }, [reciters, requestedMoshafId, selectedReciterId])

  const updateRouteAudioSelection = useCallback((nextRiwaya: Riwaya, nextReciter?: LocalReciter | null, nextSurah?: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('riwaya', nextRiwaya)
    params.set('autoplay', '0')
    if (nextReciter) {
      params.set('reciterId', String(nextReciter.apiId))
      params.set('reciterName', nextReciter.label)
      if (nextReciter.moshafId != null) params.set('moshafId', String(nextReciter.moshafId))
    }
    if (nextSurah) {
      const info = SURAH_LIST.find((item) => item.id === nextSurah)
      params.set('surah', String(nextSurah))
      params.set('page', String(info?.page || pageNumber))
    }
    router.push(`/mushaf?${params.toString()}`)
  }, [pageNumber, router, searchParams])

  const handleRiwayaSelect = async (value: Riwaya) => {
    if (value === riwaya) return
    const loaded = await fetchReciters(value)
    const preferred = loaded.find((item) => item.apiId === selectedReciterId) || loaded[0] || null
    setSelectedReciterId(preferred?.apiId || 0)
    updateRouteAudioSelection(value, preferred)
  }

  const handleReciterSelect = async (id: number) => {
    const item = reciters.find((candidate) => candidate.apiId === id) || null
    if (!item) return

    const audio = audioRef.current
    const wasPlaying = !!audio && !audio.paused && !!audio.src
    const wasLoaded = !!audio && !!audio.src
    const preservedTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    const activeLocalAyah = selectedAyah?.numberInSurah || undefined
    const currentSurah = selectedAyah?.surah?.number || requestedSurah || currentSurahNumber

    setSelectedReciterId(id)
    updateRouteAudioSelection(riwaya, item)

    if (currentSurah && (wasPlaying || wasLoaded)) {
      await loadAudioForSurah(
        Number(currentSurah),
        wasPlaying,
        activeLocalAyah,
        item,
        activeLocalAyah ? undefined : preservedTime,
      )
    }

    triggerToast(wasPlaying ? `تم تبديل القارئ إلى ${item.label}` : `تم اختيار ${item.label}`)
  }

  const handleSurahSelect = (id: number) => {
    const info = SURAH_LIST.find((item) => item.id === id)
    if (!info) return
    updateRouteAudioSelection(riwaya, selectedReciter, id)
  }

  const parseSearchTarget = useCallback(async (term: string): Promise<SearchTarget | null> => {
    const normalized = normalizeArabic(term)
    const pageOnly = normalized.match(/^(?:صفحه\s*)?(\d{1,3})$/)
    if (pageOnly) {
      const page = Number(pageOnly[1])
      if (page >= 1 && page <= 604) return { page }
    }

    const directAyah = normalized.match(/(?:سوره\s*)?(\d{1,3})\s*[:/]\s*(\d{1,3})/)
    if (directAyah) {
      const surah = Number(directAyah[1])
      const ayah = Number(directAyah[2])
      if (surah >= 1 && surah <= 114 && ayah > 0) {
        try {
          const response = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`, { cache: 'no-store' })
          const payload = await response.json()
          if (response.ok && payload?.data?.page) {
            return { page: clampPage(Number(payload.data.page)), surah, ayah }
          }
        } catch {
          // fallback below
        }
      }
    }

    const surahMatch = SURAH_LIST.find((item) => {
      const name = normalizeArabic(item.name)
      return name === normalized || name.includes(normalized) || normalized.includes(name)
    })
    if (surahMatch) return { page: surahMatch.page, surah: surahMatch.id }

    if (normalized.length < 2) return null

    try {
      const response = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(term)}/all/quran-uthmani`, { cache: 'no-store' })
      const payload = await response.json()
      const match = Array.isArray(payload?.data?.matches) ? payload.data.matches[0] : null
      if (match?.page) {
        return {
          page: clampPage(Number(match.page)),
          surah: Number(match?.surah?.number) || undefined,
          ayah: Number(match?.numberInSurah) || undefined,
        }
      }
    } catch {
      return null
    }

    return null
  }, [])

  const executeSearch = async () => {
    const term = searchInput.trim()
    if (!term || searchLoading) return
    setSearchLoading(true)
    setSearchMessage('')
    try {
      const target = await parseSearchTarget(term)
      if (!target) {
        setSearchMessage('لم يتم العثور على النتيجة المطلوبة.')
        return
      }
      navigateTo(target.page, {
        surah: target.surah,
        ayah: target.ayah && target.surah ? `${target.surah}:${target.ayah}` : undefined,
      }, target.page >= pageNumber ? 'next' : 'prev')
    } catch (error) {
      console.error(error)
      setSearchMessage('حدث خطأ أثناء البحث.')
    } finally {
      setSearchLoading(false)
    }
  }

  const loadAyahTimings = useCallback(async (surahNumber: number, readId: number) => {
    if (!surahNumber || !readId) {
      ayahTimingsRef.current = []
      return [] as AyahTiming[]
    }

    try {
      const timingResponse = await fetch(
        `https://mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${encodeURIComponent(String(readId))}`,
        { cache: 'force-cache' },
      )

      if (!timingResponse.ok) {
        ayahTimingsRef.current = []
        return [] as AyahTiming[]
      }

      const payload = await timingResponse.json()
      const raw = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.ayat_timing)
          ? payload.ayat_timing
          : Array.isArray(payload?.data)
            ? payload.data
            : []

      const timings = raw
        .map((item: unknown) => {
          const row = item as Record<string, unknown>
          return {
            ayah: Number(row.ayah),
            start_time: Number(row.start_time),
            end_time: Number(row.end_time),
          } satisfies AyahTiming
        })
        .filter(
          (item: AyahTiming) =>
            Number.isFinite(Number(item.ayah)) &&
            Number(item.ayah) > 0 &&
            Number.isFinite(Number(item.start_time)),
        )
        .sort((a: AyahTiming, b: AyahTiming) => Number(a.start_time) - Number(b.start_time))

      ayahTimingsRef.current = timings
      return timings
    } catch {
      ayahTimingsRef.current = []
      return [] as AyahTiming[]
    }
  }, [])

  const findTimingStart = useCallback((timings: AyahTiming[], ayahNumber?: number) => {
    if (!ayahNumber) return null
    const target = timings.find((item) => Number(item.ayah) === ayahNumber)
    if (!target || !Number.isFinite(Number(target.start_time))) return null
    return Math.max(0, Number(target.start_time) / 1000)
  }, [])

  const updatePlayingAyahFromTime = useCallback((currentTime: number) => {
    const timings = ayahTimingsRef.current
    if (!timings.length) {
      setPlayingAyahNumber(null)
      return
    }

    let active: AyahTiming | null = null
    for (let index = 0; index < timings.length; index += 1) {
      const current = timings[index]
      const start = Number(current.start_time || 0) / 1000
      const nextStart =
        index < timings.length - 1
          ? Number(timings[index + 1].start_time || 0) / 1000
          : Number.POSITIVE_INFINITY

      if (currentTime >= start && currentTime < nextStart) {
        active = current
        break
      }
    }

    if (!active || !Number.isFinite(Number(active.ayah))) {
      return
    }

    const currentSurah = Number(
      requestedSurah ||
        currentSurahNumber ||
        0,
    )

    const visibleSources = [pageData, rightPageData, leftPageData].filter(Boolean) as PageData[]
    const visibleAyah = visibleSources
      .flatMap((source) => source.ayahs)
      .find(
        (item) =>
          Number(item.surah?.number) === currentSurah &&
          Number(item.numberInSurah) === Number(active?.ayah),
      )

    if (visibleAyah) {
      setPlayingAyahNumber(visibleAyah.number)
    }

    if (repeatAyahNumber !== null && !repeatSeekGuardRef.current) {
      const index = timings.findIndex(
        (item) => Number(item.ayah) === repeatAyahNumber,
      )
      const nextStart =
        index >= 0 && index < timings.length - 1
          ? Number(timings[index + 1].start_time || 0) / 1000
          : null
      const repeatStart = findTimingStart(timings, repeatAyahNumber)

      if (
        repeatStart !== null &&
        nextStart !== null &&
        currentTime >= nextStart - 0.05
      ) {
        repeatSeekGuardRef.current = true
        const audio = audioRef.current
        if (audio) {
          audio.currentTime = repeatStart
          void audio.play().catch(() => {})
        }
        window.setTimeout(() => {
          repeatSeekGuardRef.current = false
        }, 180)
      }
    }
  }, [
    currentSurahNumber,
    findTimingStart,
    leftPageData,
    pageData,
    repeatAyahNumber,
    requestedSurah,
    rightPageData,
  ])

  const loadAudioForSurah = useCallback(async (
    surahNumber: number,
    shouldPlay: boolean,
    targetAyahNumber?: number,
    reciterOverride?: LocalReciter | null,
    fallbackStartSeconds?: number,
  ) => {
    if (!surahNumber) {
      triggerToast('لم يتم تحديد السورة الحالية.')
      return
    }

    setAudioLoading(true)
    setAudioError('')

    try {
      let server = reciterOverride?.server || selectedReciter?.server || ''
      let activeReciter = reciterOverride || selectedReciter

      if (!server && reciterApiId) {
        const remote = await fetch(
          `https://mp3quran.net/api/v3/reciters?language=ar&reciter=${reciterApiId}`,
          { cache: 'no-store' },
        )
        const payload = await remote.json()
        const source = Array.isArray(payload?.reciters)
          ? (payload.reciters as ApiReciter[]).find(
              (item) => Number(item.id) === reciterApiId,
            )
          : null
        const moshaf = source ? getMoshafForRiwaya(source, riwaya) : null

        if (moshaf?.server) {
          server = String(moshaf.server).replace(/\/$/, '')
          activeReciter = {
            id: `${reciterApiId}-${moshaf.id ?? 'default'}`,
            apiId: reciterApiId,
            label: source?.name || reciterName,
            moshafId: moshaf.id ?? null,
            server,
          }
        }
      }

      if (!server) {
        throw new Error('لا يوجد رابط صوتي صالح للقارئ المختار.')
      }

      const networkUrl = `${server}/${String(surahNumber).padStart(3, '0')}.mp3`
      let finalUrl = networkUrl

      try {
        if ('caches' in window) {
          const cached = await caches.match(networkUrl)
          if (cached) {
            const blob = await cached.blob()

            if (audioObjectUrlRef.current) {
              URL.revokeObjectURL(audioObjectUrlRef.current)
            }

            const localUrl = URL.createObjectURL(blob)
            audioObjectUrlRef.current = localUrl
            finalUrl = localUrl
          }
        }
      } catch {
        // نستخدم المصدر الشبكي.
      }

      const audio = audioRef.current
      if (!audio) return

      const timings = await loadAyahTimings(
        surahNumber,
        activeReciter?.apiId || reciterApiId,
      )

      const targetStart =
        findTimingStart(timings, targetAyahNumber) ??
        fallbackStartSeconds ??
        0

      audio.pause()
      audio.src = finalUrl
      audio.preload = 'auto'
      audio.load()
      setAudioDisplayUrl(finalUrl)

      audio.currentTime = targetStart
      setPlayingAyahNumber(
        targetAyahNumber
          ? (
              [pageData, rightPageData, leftPageData]
                .filter(Boolean)
                .flatMap((source) => (source as PageData).ayahs)
                .find(
                  (item) =>
                    Number(item.surah?.number) === surahNumber &&
                    Number(item.numberInSurah) === targetAyahNumber,
                )?.number ?? null
            )
          : null,
      )

      if (shouldPlay) {
        await audio.play()
      }
    } catch (error) {
      console.error(error)
      setAudioError(
        error instanceof Error
          ? error.message
          : 'تعذر تشغيل التلاوة.',
      )
    } finally {
      setAudioLoading(false)
    }
  }, [
    findTimingStart,
    leftPageData,
    loadAyahTimings,
    pageData,
    reciterApiId,
    reciterName,
    requestedSurah,
    rightPageData,
    riwaya,
    selectedReciter,
    triggerToast,
  ])

  const loadAudioForCurrentSurah = useCallback(async (shouldPlay: boolean) => {
    const surahNumber = requestedSurah || currentSurahNumber

    if (!surahNumber) {
      setAudioError('رقم السورة غير متوفر.')
      return
    }

    await loadAudioForSurah(surahNumber, shouldPlay)
  }, [currentSurahNumber, loadAudioForSurah, requestedSurah])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      if (repeatAyahNumber !== null && ayahTimingsRef.current.length) {
        const repeatStart = findTimingStart(
          ayahTimingsRef.current,
          repeatAyahNumber,
        )

        if (repeatStart !== null) {
          audio.currentTime = repeatStart
          void audio.play().catch(() => {})
          return
        }
      }

      setIsPlaying(false)
      setPlayingAyahNumber(null)
    }

    const onTimeUpdate = () => {
      updatePlayingAyahFromTime(audio.currentTime)
    }

    const onLoadedMetadata = () => {
      if (audio.currentTime < 0) audio.currentTime = 0
    }

    const onError = () => {
      setIsPlaying(false)
      setAudioError('تعذر تشغيل ملف التلاوة.')
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('error', onError)

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('error', onError)
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current)
        audioObjectUrlRef.current = null
      }
    }
  }, [findTimingStart, repeatAyahNumber, updatePlayingAyahFromTime])

  useEffect(() => {
    autoplayConsumedRef.current = false
  }, [ayahFromUrl, pageNumber, reciterApiId, requestedSurah, riwaya])

  useEffect(() => {
    if (
      !autoplayRequested ||
      autoplayConsumedRef.current ||
      !pageData?.ayahs?.length ||
      !reciterApiId
    ) {
      return
    }

    autoplayConsumedRef.current = true
    const initialAyah = ayahFromUrl.includes(':')
      ? Number(ayahFromUrl.split(':')[1])
      : undefined

    void loadAudioForSurah(
      requestedSurah || currentSurahNumber || Number(ayahFromUrl.split(':')[0]) || 0,
      true,
      initialAyah,
    )
  }, [
    autoplayRequested,
    ayahFromUrl,
    currentSurahNumber,
    loadAudioForSurah,
    pageData,
    reciterApiId,
    requestedSurah,
  ])

  const toggleAudio = async () => {
    const audio = audioRef.current
    if (!audio || !audio.src) {
      await loadAudioForCurrentSurah(true)
      return
    }

    if (audio.paused) {
      await audio.play()
    } else {
      audio.pause()
    }
  }

  const playSelectedAyah = useCallback(async () => {
    if (!selectedAyah?.surah?.number) return
    setRepeatAyahNumber(null)
    repeatSeekGuardRef.current = false
    await loadAudioForSurah(
      Number(selectedAyah.surah.number),
      true,
      Number(selectedAyah.numberInSurah),
    )
    setShowAyahActions(false)
  }, [loadAudioForSurah, selectedAyah])

  const toggleRepeatSelectedAyah = useCallback(async () => {
    if (!selectedAyah?.surah?.number) return

    const localAyah = Number(selectedAyah.numberInSurah)

    if (
      repeatAyahNumber === selectedAyah.number ||
      repeatAyahNumber === localAyah
    ) {
      setRepeatAyahNumber(null)
      repeatSeekGuardRef.current = false
      triggerToast('تم إيقاف تكرار الآية.')
      return
    }

    setRepeatAyahNumber(localAyah)
    repeatSeekGuardRef.current = false

    await loadAudioForSurah(
      Number(selectedAyah.surah.number),
      true,
      localAyah,
    )
    setShowAyahActions(false)
  }, [loadAudioForSurah, repeatAyahNumber, selectedAyah, triggerToast])


  const fetchTafsir = async (ayah: Ayah): Promise<string> => {
    if (!ayah.surah?.number) return 'لم يتوفر التفسير الآن.'
    setTafsirLoading(true)
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.surah.number}:${ayah.numberInSurah}/editions/ar.muyassar`, { cache: 'no-store' })
      const payload = await response.json()
      const first = Array.isArray(payload?.data) ? payload.data[0] : payload?.data
      const text = String(first?.text || '').trim() || 'لم يتوفر التفسير الآن.'
      setTafsirText(text)
      return text
    } catch {
      const fallback = 'تعذر تحميل التفسير الآن.'
      setTafsirText(fallback)
      return fallback
    } finally {
      setTafsirLoading(false)
    }
  }

  const copyAyah = async () => {
    if (!selectedAyah) return
    await navigator.clipboard.writeText(`${selectedAyah.text}\n\nسورة ${getSurahName(selectedAyah.surah?.number)} — الآية ${arabicNumber(selectedAyah.numberInSurah)}`)
    triggerToast('تم نسخ الآية.')
  }

  const bookmarkAyah = () => {
    if (!selectedAyah) return
    try {
      const raw = JSON.parse(localStorage.getItem('samee3_bookmarks') || '[]')
      const saved = Array.isArray(raw) ? raw : []
      const exists = saved.some((item: { number?: number; surahName?: string }) => item?.number === selectedAyah.number)
      const next = exists
        ? saved.filter((item: { number?: number }) => item?.number !== selectedAyah.number)
        : [...saved, {
          number: selectedAyah.number,
          key: selectedAyah.key,
          text: selectedAyah.text,
          numberInSurah: selectedAyah.numberInSurah,
          surahName: getSurahName(selectedAyah.surah?.number),
          page: selectedAyah.page || pageNumber,
          riwaya,
        }]
      localStorage.setItem('samee3_bookmarks', JSON.stringify(next))
      setIsSaved(!exists)
      triggerToast(exists ? 'تم إلغاء حفظ الآية.' : 'تم حفظ الآية.')
    } catch {
      triggerToast('تعذر حفظ الآية.')
    }
  }

  const downloadAyahCard = async (withTafsir: boolean) => {
    if (!selectedAyah) return
    let interpretation = tafsirText
    if (withTafsir && !interpretation) {
      interpretation = await fetchTafsir(selectedAyah)
    }

    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = withTafsir ? 1050 : 820
    const context = canvas.getContext('2d')
    if (!context) return

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#fffaf0')
    gradient.addColorStop(1, '#edf8fa')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.strokeStyle = '#c7934f'
    context.lineWidth = 4
    context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56)

    context.textAlign = 'center'
    try { context.direction = 'rtl' } catch {}
    context.fillStyle = '#155e67'
    context.font = 'bold 54px serif'
    context.fillText(`سورة ${getSurahName(selectedAyah.surah?.number)}`, canvas.width / 2, 105)

    context.fillStyle = '#a56c2a'
    context.font = 'bold 34px serif'
    context.fillText(`الآية ${arabicNumber(selectedAyah.numberInSurah)} · مصحف سميع`, canvas.width / 2, 158)

    context.fillStyle = '#162033'
    context.font = '44px "Amiri Quran", "Amiri", serif'
    drawWrappedArabicText(context, selectedAyah.text, 1180, 250, 78, 70)

    if (withTafsir) {
      context.fillStyle = '#155e67'
      context.font = 'bold 34px serif'
      context.fillText('التفسير', canvas.width / 2, 670)
      context.fillStyle = '#4b5563'
      context.font = '30px "Amiri", serif'
      drawWrappedArabicText(context, interpretation || 'لم يتوفر التفسير الآن.', 1180, 735, 56, 54)
    }

    const link = document.createElement('a')
    link.download = `samee3-ayah-${selectedAyah.surah?.number || 0}-${selectedAyah.numberInSurah}${withTafsir ? '-tafsir' : ''}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    triggerToast(withTafsir ? 'تم تجهيز صورة الآية مع التفسير.' : 'تم تجهيز صورة الآية.')
  }

  const dismissChrome = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element | null
    if (!target) return
    if (target.closest('.samee3-ayah-interactive')) return
    setShowChrome((value) => !value)
  }

  const pageMeta = (data: PageData | null, page: number, fallbackSurah?: number) => ({
    surah: getSurahName(fallbackSurah, data),
    juz: getJuz(data),
    page,
  })

  const rightMeta = pageMeta(isDesktop ? rightPageData : pageData, desktopRightPage, (isDesktop ? rightPageData : pageData)?.ayahs?.[0]?.surah?.number || currentSurahNumber)
  const leftMeta = pageMeta(leftPageData, desktopLeftPage || pageNumber + 1, leftSurahNumber)

  return (
    <main
      dir="rtl"
      className="samee3-reader fixed inset-0 z-[40] overflow-hidden bg-[#f5f0e4]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="samee3-book-stage" onClick={dismissChrome}>
        {loading ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f5f0e4]/90 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3 text-[#776345]">
              <Loader2 size={30} className="animate-spin text-[#0e99d4]" />
              <span className="text-sm font-bold">جاري فتح المصحف...</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
            <div className="max-w-sm rounded-[26px] border border-[#dfd1b9] bg-[#fffdf7] p-6 text-center shadow-xl">
              <p className="text-sm font-bold leading-7 text-[#7c2d12]">{error}</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  window.location.reload()
                }}
                className="mt-4 rounded-2xl bg-[#0e99d4] px-5 py-2.5 text-sm font-black text-white"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        ) : null}

        <div className={`samee3-spread ${isDesktop ? 'is-desktop' : 'is-mobile'} ${turning ? `is-turning ${turnDirection}` : ''}`}>
          {isDesktop ? (
            <>
              <MushafPageSheet
                page={desktopLeftPage || pageNumber + 1}
                data={leftPageData}
                html={leftDisplayedSvg}
                side="left"
                meta={leftMeta}
                onAyahClick={handleAyahClick}
              />
              <MushafPageSheet
                page={desktopRightPage}
                data={rightPageData}
                html={mainDisplayedSvg}
                side="right"
                meta={rightMeta}
                onAyahClick={handleAyahClick}
              />
            </>
          ) : (
            <MushafPageSheet
              page={pageNumber}
              data={pageData}
              html={mainDisplayedSvg}
              side="single"
              meta={rightMeta}
              onAyahClick={handleAyahClick}
            />
          )}
        </div>

        <button
          type="button"
          aria-label={showChrome ? 'إغلاق خيارات المصحف' : 'إظهار خيارات المصحف'}
          aria-expanded={showChrome}
          onClick={(event) => {
            event.stopPropagation()
            setShowChrome((value) => !value)
          }}
          className="samee3-chrome-toggle"
        >
          <List size={22} strokeWidth={2.4} />
        </button>

        {showChrome ? (
          <>
            <div className="samee3-top-controls" onClick={(event) => event.stopPropagation()}>
              <div className="samee3-search-row">
                <div className="samee3-search-box">
                  <Search size={19} />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void executeSearch()
                    }}
                    placeholder="ابحث عن آية أو سورة أو صفحة"
                    inputMode="search"
                    dir="rtl"
                  />
                  {searchInput ? (
                    <button type="button" onClick={() => setSearchInput('')} aria-label="مسح البحث"><X size={16} /></button>
                  ) : null}
                </div>
                <button type="button" onClick={() => void executeSearch()} disabled={searchLoading} className="samee3-search-submit">
                  {searchLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
              {searchMessage ? <div className="samee3-search-message">{searchMessage}</div> : null}
            </div>

            <div className="samee3-bottom-shell" onClick={(event) => event.stopPropagation()}>
              <div className="samee3-audio-toolbar">
                <button type="button" onClick={() => void toggleAudio()} disabled={audioLoading} className="samee3-play-button">
                  {audioLoading ? <Loader2 size={20} className="animate-spin" /> : isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  <span>{isPlaying ? 'إيقاف السورة' : 'تشغيل السورة'}</span>
                </button>

                <div className="samee3-select-wrap">
                  <span>القارئ</span>
                  <select
                    value={selectedReciter?.apiId || selectedReciterId || ''}
                    onChange={(event) => handleReciterSelect(Number(event.target.value))}
                    disabled={recitersLoading || !reciters.length}
                  >
                    {!reciters.length ? <option value="">{recitersLoading ? 'جاري تحميل القراء...' : reciterName}</option> : null}
                    {reciters.map((item) => <option key={item.id} value={item.apiId}>{item.label}</option>)}
                  </select>
                  <ChevronDown size={15} />
                </div>

                <div className="samee3-select-wrap">
                  <span>الرواية</span>
                  <select value={riwaya} onChange={(event) => void handleRiwayaSelect(event.target.value as Riwaya)}>
                    {Object.entries(RIWAYA_NAMES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                  <ChevronDown size={15} />
                </div>

                <div className="samee3-select-wrap">
                  <span>السورة</span>
                  <select value={currentSurahNumber || requestedSurah || 1} onChange={(event) => handleSurahSelect(Number(event.target.value))}>
                    {SURAH_LIST.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <ChevronDown size={15} />
                </div>
              </div>

              {audioError ? <div className="samee3-audio-error">{audioError}</div> : null}

              <div className="samee3-bottom-nav">
                <button type="button" onClick={() => router.push('/')}><Home size={22} /><span>الرئيسية</span></button>
                <button type="button" className="active"><BookOpen size={22} /><span>المصحف</span></button>
                <button type="button" onClick={() => router.push('/adhkar')}><Sparkles size={22} /><span>الأذكار</span></button>
                <button type="button" onClick={() => router.push('/surahs')}><List size={22} /><span>الفهرس</span></button>
              </div>
            </div>
          </>
        ) : null}

      </div>

      {showAyahActions && selectedAyah ? (
        <div className="samee3-ayah-overlay" onClick={() => setShowAyahActions(false)}>
          <div className="samee3-ayah-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="samee3-ayah-sheet-head">
              <div>
                <span>سورة {getSurahName(selectedAyah.surah?.number)}</span>
                <strong>الآية {arabicNumber(selectedAyah.numberInSurah)}</strong>
              </div>
              <button type="button" onClick={() => setShowAyahActions(false)}><X size={19} /></button>
            </div>

            <div className="samee3-ayah-preview">{selectedAyah.text}</div>

            <div className="samee3-ayah-actions-grid">
              <button type="button" onClick={() => void playSelectedAyah()}><Play size={19} /><span>تشغيل</span></button>
              <button
                type="button"
                className={repeatAyahNumber === selectedAyah.number || repeatAyahNumber === selectedAyah.numberInSurah ? 'saved' : ''}
                onClick={() => void toggleRepeatSelectedAyah()}
              >
                <Repeat size={19} />
                <span>
                  {repeatAyahNumber === selectedAyah.number || repeatAyahNumber === selectedAyah.numberInSurah
                    ? 'إيقاف التكرار'
                    : 'تكرار'}
                </span>
              </button>
              <button type="button" onClick={() => void copyAyah()}><Copy size={19} /><span>نسخ</span></button>
              <button type="button" onClick={() => void downloadAyahCard(false)}><ImageIcon size={19} /><span>تصميم كصورة</span></button>
              <button type="button" onClick={() => void downloadAyahCard(true)}><FileText size={19} /><span>صورة مع التفسير</span></button>
              <button type="button" onClick={() => { setShowAyahActions(false); void fetchTafsir(selectedAyah) }}><Sparkles size={19} /><span>التفسير</span></button>
              <button type="button" className={isSaved ? 'saved' : ''} onClick={bookmarkAyah}><Bookmark size={19} /><span>{isSaved ? 'محفوظة' : 'الحفظ'}</span></button>
            </div>

            {tafsirLoading || tafsirText ? (
              <div className="samee3-tafsir-box">
                <div className="flex items-center gap-2 font-black text-[#155e67]">{tafsirLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} التفسير</div>
                <p>{tafsirLoading ? 'جاري تحميل التفسير...' : tafsirText}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? <div className="samee3-toast"><Check size={16} />{toast}</div> : null}

      <style jsx global>{`
        html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; }
        .samee3-reader { font-family: 'Tajawal', system-ui, sans-serif; color:#1a2534; }
        .samee3-book-stage { position:relative; width:100%; height:100dvh; overflow:hidden; perspective:1800px; background:#f5f0e4; }
        .samee3-spread { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:10px; padding:0; transform-style:preserve-3d; transition:transform .45s ease, filter .45s ease; }
        .samee3-spread.is-desktop { padding:18px 18px 24px; }
        .samee3-spread.is-mobile { padding:0; }
        .samee3-spread.is-turning.next { transform:rotateY(-8deg) translateX(-7px); filter:drop-shadow(0 16px 25px rgba(70,50,20,.13)); }
        .samee3-spread.is-turning.prev { transform:rotateY(8deg) translateX(7px); filter:drop-shadow(0 16px 25px rgba(70,50,20,.13)); }
        .samee3-page-sheet { position:relative; height:100%; aspect-ratio:1000/1400; overflow:hidden; background:#fffdf7; border:1px solid rgba(177,136,79,.38); box-shadow:0 10px 42px rgba(83,63,34,.11); isolation:isolate; }
        .is-desktop .samee3-page-sheet { height:min(calc(100dvh - 42px), 920px); max-width:calc(50vw - 32px); }
        .is-mobile .samee3-page-sheet { width:100%; height:100%; max-height:100%; border-left:0; border-right:0; box-shadow:none; }
        .samee3-page-sheet.left { order:1; }
        .samee3-page-sheet.right { order:2; }
        .samee3-page-sheet.single { order:1; }
        .samee3-page-meta { position:absolute; inset:0 0 auto; z-index:8; height:48px; display:flex; align-items:center; justify-content:space-between; padding:7px 13px 0; color:#91571d; font-family:'Tajawal',sans-serif; pointer-events:none; }
        .samee3-page-meta .meta-side { display:flex; align-items:center; gap:7px; font-weight:900; font-size:13px; }
        .samee3-page-meta .meta-badge { display:inline-flex; min-width:28px; height:28px; padding:0 8px; align-items:center; justify-content:center; border-radius:9px; border:1px solid rgba(184,137,71,.35); background:rgba(255,250,237,.88); }
        .samee3-surah-frame { position:absolute; left:8%; right:8%; top:47px; height:45px; z-index:8; display:flex; align-items:center; justify-content:center; pointer-events:none; }
        .samee3-surah-frame::before { content:""; position:absolute; inset:0; border:1.4px solid rgba(177,126,59,.9); border-radius:8px; background:linear-gradient(180deg, rgba(255,251,240,.92), rgba(245,232,205,.70)); box-shadow:inset 0 0 0 3px rgba(255,255,255,.48); }
        .samee3-surah-frame .ornament { position:relative; z-index:2; color:#a86e2e; font-size:18px; line-height:1; }
        .samee3-surah-frame strong { position:relative; z-index:2; min-width:180px; padding:0 18px; text-align:center; color:#392b1e; font-family:'Aref Ruqaa','Amiri',serif; font-size:22px; font-weight:700; }
        .samee3-page-art { position:absolute; inset:94px 7px 46px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .samee3-page-art > svg { width:100% !important; height:100% !important; max-width:100%; max-height:100%; display:block; object-fit:contain; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
        .samee3-page-art svg { user-select:none; }
        .samee3-page-footer { position:absolute; inset:auto 0 5px; z-index:8; height:36px; display:flex; align-items:center; justify-content:center; pointer-events:none; color:#9a662b; font-weight:900; font-size:15px; }
        .samee3-page-footer span { min-width:75px; height:28px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(177,126,59,.48); border-radius:999px; background:rgba(255,249,236,.88); box-shadow:0 2px 7px rgba(85,62,27,.08); }
        .samee3-text-page { width:100%; height:100%; box-sizing:border-box; overflow:hidden; padding:20px 26px; direction:rtl; background:#fcfbf7; color:#1c2736; font-family:'Amiri Quran','Amiri',serif; font-size:clamp(25px,2.25vw,39px); line-height:2.24; text-align:justify; }
        .samee3-text-ayah { display:inline; cursor:pointer; border-radius:9px; transition:background .16s ease; }
        .samee3-text-selected, .samee3-selected-ayah {
          background:rgba(196,143,65,.08) !important;
          border-radius:10px !important;
          box-shadow:0 2px 9px rgba(125,88,33,.10) !important;
          filter:drop-shadow(0 2px 5px rgba(125,88,33,.12));
        }
        .samee3-page-art .ayahPolygon.samee3-selected-ayah,
        .samee3-page-art [data-ayah].samee3-selected-ayah,
        .samee3-page-art [data-ayah-number].samee3-selected-ayah {
          opacity:1 !important;
          fill:rgba(196,143,65,.055) !important;
          stroke:#b98535 !important;
          stroke-width:1.7 !important;
          stroke-opacity:.48 !important;
          filter:drop-shadow(0 2px 5px rgba(125,88,33,.15)) !important;
        }
        .samee3-page-art .ayahPolygon.samee3-selected-ayah *,
        .samee3-page-art [data-ayah].samee3-selected-ayah *,
        .samee3-page-art [data-ayah-number].samee3-selected-ayah * {
          stroke:#b98535 !important;
          stroke-width:1.7 !important;
          stroke-opacity:.42 !important;
          filter:drop-shadow(0 2px 4px rgba(125,88,33,.12));
        }
        .samee3-playing-ayah {
          background:rgba(14,153,212,.08) !important;
          border-radius:10px !important;
          box-shadow:0 2px 10px rgba(14,119,164,.12) !important;
          filter:drop-shadow(0 2px 6px rgba(14,119,164,.13));
        }
        .samee3-page-art .ayahPolygon.samee3-playing-ayah,
        .samee3-page-art [data-ayah].samee3-playing-ayah,
        .samee3-page-art [data-ayah-number].samee3-playing-ayah {
          opacity:1 !important;
          fill:rgba(14,153,212,.045) !important;
          stroke:#0e99d4 !important;
          stroke-width:1.9 !important;
          stroke-opacity:.56 !important;
          filter:drop-shadow(0 2px 6px rgba(14,119,164,.18)) !important;
        }
        .samee3-page-art .ayahPolygon.samee3-playing-ayah *,
        .samee3-page-art [data-ayah].samee3-playing-ayah *,
        .samee3-page-art [data-ayah-number].samee3-playing-ayah * {
          stroke:#0e99d4 !important;
          stroke-width:1.9 !important;
          stroke-opacity:.48 !important;
          filter:drop-shadow(0 2px 5px rgba(14,119,164,.14));
        }
        .samee3-ayah-number { display:inline-block; margin:0 5px; color:#b78945; font-family:'Amiri',serif; font-size:.72em; }

        .samee3-chrome-toggle { position:absolute; z-index:88; right:max(14px,env(safe-area-inset-right)); bottom:max(20px,env(safe-area-inset-bottom)); width:46px; height:46px; border-radius:50%; border:1px solid rgba(169,200,216,.86); background:rgba(255,253,248,.96); color:#0e99d4; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 28px rgba(35,73,86,.18), 0 0 0 1px rgba(255,255,255,.7) inset; backdrop-filter:blur(14px); transition:transform .2s ease, box-shadow .2s ease, background .2s ease; }
        .samee3-chrome-toggle:hover { transform:translateY(-2px); box-shadow:0 14px 32px rgba(35,73,86,.22), 0 0 0 1px rgba(255,255,255,.75) inset; }
        .samee3-chrome-toggle:active { transform:scale(.94); }
        .samee3-top-controls { position:absolute; z-index:70; top:max(10px,env(safe-area-inset-top)); left:50%; transform:translateX(-50%); width:min(94vw,900px); padding:10px; border-radius:24px; background:rgba(255,253,248,.93); border:1px solid rgba(198,177,142,.55); box-shadow:0 14px 40px rgba(75,58,33,.17); backdrop-filter:blur(16px); }
        .samee3-search-row { display:flex; gap:8px; align-items:center; }
        .samee3-search-box { flex:1; height:46px; display:flex; align-items:center; gap:9px; padding:0 13px; border-radius:16px; border:1px solid #e4d8c1; background:#fff; color:#0e99d4; }
        .samee3-search-box input { flex:1; min-width:0; border:0; outline:0; background:transparent; font-size:14px; font-weight:800; color:#273447; }
        .samee3-search-box input::placeholder { color:#a8a1a0; }
        .samee3-search-box button { display:flex; align-items:center; justify-content:center; border:0; background:transparent; color:#7b8797; }
        .samee3-search-submit { width:46px; height:46px; border:0; border-radius:16px; background:#0e99d4; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 18px rgba(14,153,212,.22); }
        .samee3-search-submit:disabled { opacity:.65; }
        .samee3-search-message { margin-top:7px; text-align:center; font-size:11px; font-weight:800; color:#8b5f28; }

        .samee3-bottom-shell { position:absolute; z-index:75; left:50%; bottom:max(10px,env(safe-area-inset-bottom)); transform:translateX(-50%); width:min(96vw,1040px); padding:10px; border-radius:26px; background:rgba(255,253,248,.95); border:1px solid rgba(169,200,216,.8); box-shadow:0 18px 50px rgba(35,73,86,.20); backdrop-filter:blur(17px); }
        .samee3-audio-toolbar { display:grid; grid-template-columns:1.1fr 1fr 1fr 1fr; gap:8px; }
        .samee3-play-button { min-height:45px; border:0; border-radius:15px; background:linear-gradient(135deg,#d78a12,#c36f05); color:#fff; font-weight:900; display:flex; align-items:center; justify-content:center; gap:7px; box-shadow:0 8px 18px rgba(195,111,5,.19); }
        .samee3-select-wrap { position:relative; min-width:0; display:flex; flex-direction:column; justify-content:center; padding:4px 33px 3px 10px; border-radius:15px; border:1px solid #e3d9c7; background:#fff; }
        .samee3-select-wrap > span { font-size:8px; color:#a4947a; font-weight:900; }
        .samee3-select-wrap select { width:100%; border:0; outline:0; background:transparent; color:#263347; font-size:11px; font-weight:900; appearance:none; }
        .samee3-select-wrap > svg { position:absolute; right:10px; top:50%; transform:translateY(-30%); pointer-events:none; color:#d27b0a; }
        .samee3-audio-error { padding:6px 8px; text-align:center; color:#a63e28; font-size:10px; font-weight:800; }
        .samee3-bottom-nav { margin-top:8px; padding-top:8px; border-top:1px solid #ece4d7; display:grid; grid-template-columns:repeat(4,1fr); }
        .samee3-bottom-nav button { border:0; background:transparent; color:#91a3b8; display:flex; flex-direction:column; align-items:center; gap:3px; padding:3px 2px; font-weight:900; font-size:9px; }
        .samee3-bottom-nav button.active { color:#0e99d4; }

        .samee3-ayah-overlay { position:absolute; z-index:100; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:18px; background:rgba(31,35,38,.20); backdrop-filter:blur(4px); }
        .samee3-ayah-sheet { width:min(96vw,620px); max-height:min(78dvh,720px); overflow:auto; border-radius:28px 28px 20px 20px; background:#fffdf8; border:1px solid #e7dac4; box-shadow:0 24px 80px rgba(35,35,28,.25); padding:18px; }
        .samee3-ayah-sheet-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .samee3-ayah-sheet-head > div { display:flex; flex-direction:column; gap:4px; }
        .samee3-ayah-sheet-head span { color:#9b6a32; font-size:11px; font-weight:900; }
        .samee3-ayah-sheet-head strong { color:#1b2a3c; font-size:18px; font-weight:900; }
        .samee3-ayah-sheet-head button { width:34px; height:34px; border:0; border-radius:50%; background:#f2eee7; color:#718096; display:flex; align-items:center; justify-content:center; }
        .samee3-ayah-preview { margin-top:14px; padding:18px 16px; border-radius:20px; background:#fbf7ee; border:1px solid #eee3d0; color:#243042; font-family:'Amiri Quran','Amiri',serif; font-size:24px; line-height:2.05; text-align:right; }
        .samee3-ayah-actions-grid { margin-top:14px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .samee3-ayah-actions-grid button { min-height:62px; border:1px solid #e8dfd0; background:#fff; color:#314154; border-radius:17px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; font-weight:900; font-size:10px; }
        .samee3-ayah-actions-grid button:hover { border-color:#b9ddea; color:#0e87b8; }
        .samee3-ayah-actions-grid button.saved { background:#effaf7; border-color:#b8e2d1; color:#127457; }
        .samee3-tafsir-box { margin-top:14px; padding:14px; border-radius:18px; background:#f2fafc; border:1px solid #cfe8ef; color:#4c5968; font-size:12px; line-height:2; }
        .samee3-tafsir-box p { margin-top:8px; white-space:pre-wrap; }
        .samee3-toast { position:absolute; z-index:130; left:50%; bottom:calc(max(12px,env(safe-area-inset-bottom)) + 84px); transform:translateX(-50%); display:flex; align-items:center; gap:7px; padding:10px 14px; border-radius:999px; background:#173d45; color:#fff; font-size:11px; font-weight:900; box-shadow:0 10px 30px rgba(18,49,57,.25); }

        @media (max-width:767px) {
          .samee3-page-meta { height:44px; padding:5px 10px 0; }
          .samee3-page-meta .meta-side { font-size:12px; }
          .samee3-page-meta .meta-badge { height:26px; min-width:26px; }
          .samee3-surah-frame { top:43px; left:5.5%; right:5.5%; height:41px; }
          .samee3-surah-frame strong { min-width:140px; font-size:20px; }
          .samee3-page-art { inset:84px 2px 42px; }
          .samee3-chrome-toggle { right:12px; bottom:12px; width:44px; height:44px; }
          .samee3-top-controls { width:calc(100% - 20px); }
          .samee3-audio-toolbar { grid-template-columns:1fr 1fr; }
          .samee3-bottom-shell { width:calc(100% - 14px); }
          .samee3-ayah-actions-grid { grid-template-columns:repeat(2,1fr); }
          .samee3-ayah-preview { font-size:21px; }
        }

        @media (min-width:768px) {
          .samee3-page-art > svg { width:100% !important; height:100% !important; }
          .samee3-bottom-shell { bottom:14px; }
        }
      `}</style>
    </main>
  )
}

type MushafPageSheetProps = {
  page: number
  data: PageData | null
  html: string
  side: 'left' | 'right' | 'single'
  meta: { surah: string; juz: number; page: number }
  onAyahClick: (event: React.MouseEvent<HTMLElement>, sourceData: PageData | null) => void
}

function MushafPageSheet({ page, data, html, side, meta, onAyahClick }: MushafPageSheetProps) {
  return (
    <section
      className={`samee3-page-sheet ${side}`}
      data-surah-number={data?.ayahs?.[0]?.surah?.number || ''}
      onClick={(event) => onAyahClick(event, data)}
    >
      <div className="samee3-page-meta">
        <div className="meta-side">
          <span className="meta-badge">⌁</span>
          <span>الجزء {arabicNumber(meta.juz)}</span>
        </div>
        <div className="meta-side">
          <span>{meta.surah}</span>
          <span className="meta-badge">⌄</span>
        </div>
      </div>

      <div className="samee3-surah-frame">
        <span className="ornament">❧</span>
        <strong>سورة {meta.surah}</strong>
        <span className="ornament">☙</span>
      </div>

      <div className="samee3-page-art samee3-ayah-interactive" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="samee3-page-footer">
        <span>{arabicNumber(page)}</span>
      </div>
    </section>
  )
}

function drawWrappedArabicText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startY: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/)
  let line = ''
  let y = startY
  let count = 0

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line, 700, y)
      y += lineHeight
      count += 1
      if (count >= maxLines) break
      line = word
    } else {
      line = test
    }
  }

  if (count < maxLines && line) context.fillText(line, 700, y)
}
