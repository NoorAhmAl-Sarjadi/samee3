
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
  surahIds: number[]
}

type TurnDirection = 'next' | 'prev' | null

type SearchResult = {
  id: string
  text: string
  page: number
  surah: number
  surahName: string
  ayah: number
}

type AyahTiming = {
  ayah?: number
  start_time?: number
  end_time?: number
}

type AudioRuntime = {
  activeJuzNumber: number
  activeJuzRange: {
    number: number
    start: QuranReference
    end: QuranReference
  } | null
  repeatAyahNumber: number | null
  availableSurahs: { id: number; name: string; page: number }[]
  selectedReciter: LocalReciter | null
  riwaya: Riwaya
  isDesktop: boolean
  desktopRightPage: number
  pageNumber: number
  findTimingStart: (
    timings: AyahTiming[],
    ayahNumber?: number,
  ) => number | null
  findTimingEnd: (
    timings: AyahTiming[],
    ayahNumber?: number,
  ) => number | null
  loadAudioForSurah: (
    surahNumber: number,
    shouldPlay: boolean,
    targetAyahNumber?: number,
    reciterOverride?: LocalReciter | null,
    fallbackStartSeconds?: number,
  ) => Promise<void>
  updatePlayingAyahFromTime: (
    currentTime: number,
  ) => void
  notifyJuzCompleted: (
    juzNumber: number,
  ) => void
  navigateTo: (
    page: number,
    extra?: {
      surah?: number
      ayah?: string
      clearJuz?: boolean
    },
    direction?: 'next' | 'prev',
  ) => void
  triggerToast: (
    message: string,
  ) => void
  updateRouteAudioSelection: (
    nextRiwaya: Riwaya,
    nextReciter?: LocalReciter | null,
    nextSurah?: number,
  ) => void
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

const RIWAYA_MUSHAF_IDS: Record<Riwaya, number> = {
  hafs: 1,
  bazzi: 5,
  douri: 6,
  qalun: 7,
  shubah: 9,
  sousi: 10,
  warsh: 4,
}

const RIWAYA_KEYWORDS: Record<Riwaya, string[]> = {
  // كلمة اسم الرواية وحدها هي معيار المطابقة؛ اسم الشيخ/الإمام قد يختلف في صياغة الـ API.
  hafs: ['حفص'],
  warsh: ['ورش'],
  qalun: ['قالون'],
  douri: ['الدوري'],
  shubah: ['شعبة', 'شعبه'],
  sousi: ['السوسي', 'سوسي'],
  bazzi: ['البزي', 'بزي'],
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


type PersistentAudioState = {
  networkUrl: string
  surah: number
  ayah: number | null
  currentTime: number
  playing: boolean
  riwaya: Riwaya
  reciterId: number
  reciterName: string
  moshafId: number | null
  page: number
  updatedAt: number
}

type Samee3AudioElement = HTMLAudioElement & {
  __samee3NetworkUrl?: string
  __samee3Surah?: number
  __samee3Riwaya?: Riwaya
  __samee3ReciterId?: number
  __samee3ReciterName?: string
  __samee3MoshafId?: number | null
  __samee3Page?: number
  __samee3LastPersist?: number
}

const SAMEE3_AUDIO_STORAGE_KEY = 'samee3_persistent_audio_v2'

function readPersistentAudioState(): PersistentAudioState | null {
  try {
    const raw = localStorage.getItem(SAMEE3_AUDIO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistentAudioState>
    if (!parsed.networkUrl || !Number.isFinite(Number(parsed.surah))) return null
    return {
      networkUrl: String(parsed.networkUrl),
      surah: Number(parsed.surah),
      ayah: Number.isFinite(Number(parsed.ayah)) && Number(parsed.ayah) > 0 ? Number(parsed.ayah) : null,
      currentTime: Number.isFinite(Number(parsed.currentTime)) ? Math.max(0, Number(parsed.currentTime)) : 0,
      playing: parsed.playing === true,
      riwaya: isRiwaya(parsed.riwaya == null ? null : String(parsed.riwaya)) ? String(parsed.riwaya) as Riwaya : 'hafs',
      reciterId: Number(parsed.reciterId || 0),
      reciterName: String(parsed.reciterName || ''),
      moshafId: Number.isFinite(Number(parsed.moshafId)) && Number(parsed.moshafId) > 0 ? Number(parsed.moshafId) : null,
      page: clampPage(Number(parsed.page || 1)),
      updatedAt: Number(parsed.updatedAt || Date.now()),
    }
  } catch { return null }
}

function writePersistentAudioState(state: PersistentAudioState) {
  try {
    localStorage.setItem(
      SAMEE3_AUDIO_STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: Date.now() }),
    )
  } catch {}
}

type PersistentReadingState = {
  page: number
  surah: number | null
  ayah: number | null
  riwaya: Riwaya
  reciterId: number
  reciterName: string
  moshafId: number | null
  updatedAt: number
}

const SAMEE3_READING_STORAGE_KEY = 'samee3_persistent_reading_v2'

function readPersistentReadingState(): PersistentReadingState | null {
  try {
    const raw = localStorage.getItem(SAMEE3_READING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistentReadingState>
    return {
      page: clampPage(Number(parsed.page || 1)),
      surah: Number.isFinite(Number(parsed.surah)) && Number(parsed.surah) > 0 ? Number(parsed.surah) : null,
      ayah: Number.isFinite(Number(parsed.ayah)) && Number(parsed.ayah) > 0 ? Number(parsed.ayah) : null,
      riwaya: isRiwaya(parsed.riwaya == null ? null : String(parsed.riwaya))
        ? String(parsed.riwaya) as Riwaya
        : 'hafs',
      reciterId: Number(parsed.reciterId || 0),
      reciterName: String(parsed.reciterName || ''),
      moshafId: Number.isFinite(Number(parsed.moshafId)) && Number(parsed.moshafId) > 0 ? Number(parsed.moshafId) : null,
      updatedAt: Number(parsed.updatedAt || Date.now()),
    }
  } catch {
    return null
  }
}

function writePersistentReadingState(state: PersistentReadingState) {
  try {
    localStorage.setItem(
      SAMEE3_READING_STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: Date.now() }),
    )
  } catch {}
}

function parseSurahList(value?: string) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 114)
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

type QuranReference = {
  surah: number
  ayah: number
}

function parseQuranReference(value: string | null): QuranReference | null {
  if (!value) return null
  const match = value.match(/^(\d{1,3})\s*:\s*(\d{1,3})$/)
  if (!match) return null

  const surah = Number(match[1])
  const ayah = Number(match[2])

  if (surah < 1 || surah > 114 || ayah < 1) return null
  return { surah, ayah }
}

function getMoshafForRiwaya(
  reciter: ApiReciter,
  riwaya: Riwaya,
  allowEndpointFallback = false,
) {
  const list = Array.isArray(reciter.moshaf) ? reciter.moshaf : []
  if (!list.length) return null

  const keywords = RIWAYA_KEYWORDS[riwaya].map(normalizeArabic)

  const isValidMoshaf = (item: ApiMoshaf) =>
    !!item.server && !!item.surah_list

  const matches = (item: ApiMoshaf) => {
    if (!isValidMoshaf(item)) return false

    const name = normalizeArabic(
      String(item.name || ''),
    )

    return (
      keywords.length > 0 &&
      keywords.every((keyword) =>
        name.includes(keyword),
      )
    )
  }

  const exact = list.find(matches)

  if (exact) {
    return exact
  }

  /*
   * طلب /reciters?rewaya=... يعيد النتائج الخاصة بالرواية.
   * إذا لم يكن اسم الرواية ظاهرًا داخل اسم الـ moshaf،
   * نأخذ أول مصدر صالح من نفس الاستجابة المفلترة.
   */
  if (allowEndpointFallback) {
    return list.find(isValidMoshaf) || null
  }

  return null
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
  const activeJuzNumber = Number(searchParams.get('juz') || '0')
  const activeJuzStart = parseQuranReference(searchParams.get('juzStart'))
  const activeJuzEnd = parseQuranReference(searchParams.get('juzEnd'))

  const activeJuzRange = useMemo(() => {
    if (
      !activeJuzNumber ||
      !activeJuzStart ||
      !activeJuzEnd
    ) {
      return null
    }

    return {
      number: activeJuzNumber,
      start: activeJuzStart,
      end: activeJuzEnd,
    }
  }, [activeJuzEnd, activeJuzNumber, activeJuzStart])

  const [isDesktop, setIsDesktop] = useState(false)
  const [showChrome, setShowChrome] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [rightPageData, setRightPageData] = useState<PageData | null>(null)
  const [leftPageData, setLeftPageData] = useState<PageData | null>(null)
  const [svg, setSvg] = useState('')
  const [leftSvg, setLeftSvg] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null)
  const [pressedAyahNumber, setPressedAyahNumber] = useState<number | null>(null)
  const [showAyahActions, setShowAyahActions] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [tafsirText, setTafsirText] = useState('')
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [imageGenerating, setImageGenerating] = useState(false)
  const [imagePreview, setImagePreview] = useState<{
    url: string
    filename: string
    withTafsir: boolean
  } | null>(null)

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
  const audioSurahRef = useRef<number | null>(null)
  const ayahTimingsRef = useRef<AyahTiming[]>([])
  const repeatSeekGuardRef = useRef(false)
  const juzCompletedGuardRef = useRef(false)
  const autoplayConsumedRef = useRef(false)
  const startupNoticeShownRef = useRef(false)
  const navigatingRef = useRef(false)
  const autoPageTargetRef = useRef<number | null>(null)
  const pointerStartX = useRef<number | null>(null)
  const pointerStartY = useRef<number | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [turnDirection, setTurnDirection] = useState<TurnDirection>(null)
  const [turning, setTurning] = useState(false)
  const [openPicker, setOpenPicker] = useState<'riwaya' | 'reciter' | 'surah' | null>(null)
  const pageTurnAudioContextRef = useRef<AudioContext | null>(null)
  const audioRestoreAttemptedRef = useRef(false)
  const readingRestoreAttemptedRef = useRef(false)

  const pageMemoryCacheRef = useRef(new Map<string, PageData>())
  const svgMemoryCacheRef = useRef(new Map<string, string>())

  // على الكمبيوتر وشاشات العرض نستخدم صفحة واحدة كبيرة، مع الحفاظ على منطق
  // الشاشة الواسعة دون إجبار القارئ على فتح صفحتين متجاورتين.
  const desktopRightPage = pageNumber
  const desktopLeftPage = null

  const currentSurahNumber = pageData?.ayahs?.[0]?.surah?.number || requestedSurah || undefined
  const currentSurahName = getSurahName(currentSurahNumber, pageData)
  const currentJuz = getJuz(pageData)
  const leftSurahNumber = leftPageData?.ayahs?.[0]?.surah?.number

  const triggerToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => {
    if (startupNoticeShownRef.current) return
    startupNoticeShownRef.current = true

    try {
      const raw = localStorage.getItem('samee3_last_completed_juz')
      if (!raw) return

      const saved = JSON.parse(raw) as { number?: number }
      if (saved?.number) {
        triggerToast(`تم الانتهاء من الجزء ${arabicNumber(Number(saved.number))}`)
      }
      localStorage.removeItem('samee3_last_completed_juz')
    } catch {
      // لا نوقف فتح المصحف بسبب إشعار سابق.
    }
  }, [triggerToast])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const persistReadingPosition = useCallback((pageOverride?: number) => {
    const audio = audioRef.current as Samee3AudioElement | null
    const savedAudio = readPersistentAudioState()
    const page = clampPage(Number(pageOverride || pageNumber))
    const visibleAyahs = [pageData, rightPageData, leftPageData]
      .filter(Boolean)
      .flatMap((source) => (source as PageData).ayahs)

    const activeAyah =
      (audio && audio.__samee3Surah && playingAyahNumber !== null
        ? visibleAyahs.find(
            (ayah) =>
              Number(ayah.number) === Number(playingAyahNumber) &&
              Number(ayah.surah?.number) === Number(audio.__samee3Surah),
          )?.numberInSurah
        : undefined) ??
      selectedAyah?.numberInSurah ??
      savedAudio?.ayah ??
      null

    const activeSurah =
      Number(audio?.__samee3Surah || 0) ||
      selectedAyah?.surah?.number ||
      requestedSurah ||
      currentSurahNumber ||
      savedAudio?.surah ||
      null

    writePersistentReadingState({
      page,
      surah: activeSurah ? Number(activeSurah) : null,
      ayah: activeAyah ? Number(activeAyah) : null,
      riwaya: audio?.__samee3Riwaya || riwaya,
      reciterId: Number(audio?.__samee3ReciterId || selectedReciterId || savedAudio?.reciterId || 0),
      reciterName: audio?.__samee3ReciterName || reciterName || savedAudio?.reciterName || '',
      moshafId: audio?.__samee3MoshafId ?? savedAudio?.moshafId ?? (requestedMoshafId > 0 ? requestedMoshafId : null),
      updatedAt: Date.now(),
    })
  }, [
    currentSurahNumber,
    leftPageData,
    pageData,
    pageNumber,
    playingAyahNumber,
    reciterName,
    requestedMoshafId,
    requestedSurah,
    rightPageData,
    riwaya,
    selectedAyah,
    selectedReciterId,
  ])

  const fetchPageData = useCallback(async (page: number) => {
    const safePage = clampPage(page)
    const key = `${riwaya}:${safePage}`;
    const memoryHit = pageMemoryCacheRef.current.get(key)
    if (memoryHit) return memoryHit

    const url = `/api/quran?riwaya=${encodeURIComponent(riwaya)}&page=${safePage}`

    try {
      if ('caches' in window) {
        const cachedResponse = await caches.match(url)
        if (cachedResponse) {
          const data = await cachedResponse.json()
          const result = {
            ayahs: Array.isArray(data?.ayahs)
              ? data.ayahs
              : Array.isArray(data?.data?.ayahs)
                ? data.data.ayahs
                : [],
          } as PageData
          pageMemoryCacheRef.current.set(key, result)
          return result
        }
      }
    } catch {
      // ننتقل إلى الشبكة.
    }

    const response = await fetch(url, {
      cache: 'force-cache',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`تعذر تحميل بيانات الصفحة ${safePage}`)
    const data = await response.json()
    const result = {
      ayahs: Array.isArray(data?.ayahs)
        ? data.ayahs
        : Array.isArray(data?.data?.ayahs)
          ? data.data.ayahs
          : [],
    } as PageData

    pageMemoryCacheRef.current.set(key, result)

    try {
      if ('caches' in window) {
        const cache = await caches.open('samee3-mushaf-pages-v2')
        await cache.put(url, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        }))
      }
    } catch {
      // لا نوقف القراءة بسبب فشل التخزين المؤقت.
    }

    return result
  }, [riwaya])

  const fetchSvg = useCallback(async (page: number) => {
    // مسار SVG يدعم الآن الروايات السبع: الخمس ذات الصفحات المطبوعة،
    // والسوسي والبزي المرسومتين من نص الرواية الحقيقي وخطها الخاص.
    const safePage = clampPage(page)
    const key = `${riwaya}:${safePage}`;
    const memoryHit = svgMemoryCacheRef.current.get(key)
    if (memoryHit) return memoryHit

    const url = `/api/mushaf-svg?riwaya=${encodeURIComponent(riwaya)}&page=${safePage}`

    try {
      if ('caches' in window) {
        const cachedResponse = await caches.match(url)
        if (cachedResponse) {
          const data = await cachedResponse.json()
          if (data?.success && data?.svg) {
            const value = String(data.svg)
            svgMemoryCacheRef.current.set(key, value)
            return value
          }
        }
      }
    } catch {
      // ننتقل إلى الشبكة.
    }

    const response = await fetch(url, {
      cache: 'force-cache',
    })
    if (!response.ok) throw new Error(`تعذر تحميل صفحة المصحف ${safePage}`)
    const data = await response.json()
    if (!data?.success || !data?.svg) throw new Error(`لم يتم العثور على صفحة المصحف ${safePage}`)
    const value = String(data.svg)
    svgMemoryCacheRef.current.set(key, value)

    try {
      if ('caches' in window) {
        const cache = await caches.open('samee3-mushaf-pages-v2')
        await cache.put(url, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        }))
      }
    } catch {
      // لا نوقف القراءة بسبب فشل التخزين المؤقت.
    }

    return value
  }, [riwaya])

  const prefetchRiwayaPage = useCallback(async (targetRiwaya: Riwaya, page: number) => {
    const safePage = clampPage(page)
    const pageUrl = `/api/quran?riwaya=${encodeURIComponent(targetRiwaya)}&page=${safePage}`
    try {
      if ('caches' in window) {
        const existing = await caches.match(pageUrl)
        if (!existing) {
          const response = await fetch(pageUrl, {
            cache: 'force-cache',
            headers: { Accept: 'application/json' },
          })
          if (response.ok) {
            const data = await response.clone().json()
            pageMemoryCacheRef.current.set(`${targetRiwaya}:${safePage}`, {
              ayahs: Array.isArray(data?.ayahs)
                ? data.ayahs
                : Array.isArray(data?.data?.ayahs)
                  ? data.data.ayahs
                  : [],
            })
            const cache = await caches.open('samee3-mushaf-pages-v2')
            await cache.put(pageUrl, response)
          }
        }
      } else {
        await fetch(pageUrl, { cache: 'force-cache' })
      }

      // نُحمّل SVG لكل الروايات، بما فيها السوسي والبزي، حتى تكون
      // طبقة العرض واحدة ولا تعود الروايتان النصيتان إلى تصميم مختلف.
      const svgUrl = `/api/mushaf-svg?riwaya=${encodeURIComponent(targetRiwaya)}&page=${safePage}`
      const existingSvg = 'caches' in window ? await caches.match(svgUrl) : null
      if (!existingSvg) {
        const response = await fetch(svgUrl, { cache: 'force-cache' })
        if (response.ok) {
          const data = await response.clone().json()
          if (data?.success && data?.svg) {
            svgMemoryCacheRef.current.set(`${targetRiwaya}:${safePage}`, String(data.svg))
            if ('caches' in window) {
              const cache = await caches.open('samee3-mushaf-pages-v2')
              await cache.put(svgUrl, response)
            }
          }
        }
      }
    } catch {
      // التحميل المسبق اختياري ولا يعطل الصفحة الحالية.
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const nearby = Array.from(new Set([
        pageNumber,
        clampPage(pageNumber + 1),
        clampPage(pageNumber - 1),
        clampPage(pageNumber + 2),
        clampPage(pageNumber - 2),
      ]))

      // لا نضرب الشبكة بـ 7 روايات × عدة صفحات مرة واحدة.
      // نبدأ بالصفحة الحالية من كل الروايات، ثم نوسع التخزين للرواية المفتوحة.
      const riwayat = Object.keys(RIWAYA_NAMES) as Riwaya[]
      for (const target of riwayat) {
        if (cancelled) return
        void prefetchRiwayaPage(target, pageNumber)
        await new Promise((resolve) => window.setTimeout(resolve, 55))
      }

      for (const page of nearby) {
        if (cancelled) return
        if (page === pageNumber) continue
        void prefetchRiwayaPage(riwaya, page)
        await new Promise((resolve) => window.setTimeout(resolve, 45))
      }
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    let idleId: number | null = null
    let timeoutId: number | null = null

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(() => void run(), { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(() => void run(), 120)
    }

    return () => {
      cancelled = true
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [pageNumber, prefetchRiwayaPage, riwaya])

  useEffect(() => {
    let cancelled = false
    // لا نعرض طبقة تحميل فوق الصفحة في كل انتقال؛ الصفحة السابقة تبقى ظاهرة
    // حتى تكتمل الصفحة الجديدة، ومع الـ cache غالبًا ستكون فورية.
    setLoading(false)
    setError('')

    const rightPage = desktopRightPage
    const leftPage = desktopLeftPage

    ;(async () => {
      try {
        const dataPromises: Array<Promise<PageData>> = [
          fetchPageData(pageNumber),
        ]

        // الصفحة الحالية فقط مطلوبة على الكمبيوتر أيضًا؛ لا نحمّل صفحة ثانية.
        // هذا يقلل الطلبات ويمنع اختلاف ترتيب الصفحات على شاشة العرض.

        const dataResults = await Promise.all(dataPromises)
        if (cancelled) return

        const mainData = dataResults[0]
        setPageData(mainData)

        if (isDesktop) {
          setRightPageData(mainData)
          setLeftPageData(null)
        } else {
          setRightPageData(mainData)
          setLeftPageData(null)
        }

        // نفس طبقة SVG تُستخدم لكل الروايات.
        // للسوسي والبزي يأتي SVG من نص الرواية الحقيقي + الخط الخاص بها،
        // بينما الخمس الأخرى تأتي من صفحات المصحف المطبوعة الأصلية.
        const svgPromises: Array<Promise<string>> = [fetchSvg(pageNumber)]

        const svgResults = await Promise.all(svgPromises)
        if (cancelled) return

        setSvg(svgResults[0] || '')
        setLeftSvg('')
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل المصحف')
        }
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
      '.samee3-page-art .ayahPolygon, .samee3-page-art .samee3-text-ayah, .samee3-page-art .samee3-ayah',
    )

    const visibleSources = [pageData, rightPageData, leftPageData].filter(Boolean) as PageData[]
    const visiblePlayingAyah =
      playingAyahNumber !== null
        ? visibleSources
            .flatMap((source) => source.ayahs)
            .find((item) => item.number === playingAyahNumber) || null
        : null

    nodes.forEach((node) => {
      node.classList.remove('samee3-pressed-ayah', 'samee3-playing-ayah')

      const sheet = node.closest('.samee3-page-sheet') as HTMLElement | null
      const sheetSurah = Number(sheet?.dataset.surahNumber || 0)

      const nodeSurah = Number(
        node.getAttribute('surah') ||
          node.getAttribute('data-surah') ||
          sheetSurah ||
          0,
      )

      const nodeAyah = Number(
        node.getAttribute('ayah') ||
          node.getAttribute('data-ayah-number') ||
          node.getAttribute('data-ayah') ||
          0,
      )

      const playingMatch =
        !!visiblePlayingAyah &&
        nodeSurah === Number(visiblePlayingAyah.surah?.number) &&
        nodeAyah === Number(visiblePlayingAyah.numberInSurah)

      const pressedMatch =
        pressedAyahNumber !== null &&
        !!selectedAyah &&
        nodeSurah === Number(selectedAyah.surah?.number) &&
        nodeAyah === Number(selectedAyah.numberInSurah) &&
        nodeAyah === pressedAyahNumber

      if (playingMatch) node.classList.add('samee3-playing-ayah')
      if (pressedMatch) node.classList.add('samee3-pressed-ayah')
    })
  }, [leftPageData, pageData, playingAyahNumber, pressedAyahNumber, rightPageData, selectedAyah])

  useEffect(() => {
    const timer = window.setTimeout(highlightSearchedAyah, 120)
    return () => window.clearTimeout(timer)
  }, [highlightSearchedAyah, svg, leftSvg, selectedAyah, playingAyahNumber])

  const mainDisplayedSvg = useMemo(() => {
    // السوسي والبزي لا نعرض لهما الـSVG النصي القديم الذي كان يحتوي
    // على إطار داخلي وعنوان مكرر وتوزيعًا ضيقًا للنص. نرسمهما داخل
    // نفس مساحة طبقة الـSVG الخاصة بالمصحف، وبنفس مقاس صفحة القراءة.
    if ((riwaya === 'sousi' || riwaya === 'bazzi') && pageData?.ayahs?.length) {
      return buildTextMushafSvg(pageData, riwaya)
    }
    return svg
  }, [pageData, riwaya, svg])

  const leftDisplayedSvg = useMemo(() => {
    if (!isDesktop || !leftPageData) return ''
    if ((riwaya === 'sousi' || riwaya === 'bazzi') && leftPageData.ayahs?.length) {
      return buildTextMushafSvg(leftPageData, riwaya)
    }
    return leftSvg
  }, [isDesktop, leftPageData, leftSvg, riwaya])


  const resolveSelectedAyahFromElement = useCallback((element: Element, sourceData: PageData | null) => {
    const sourceAyahs = sourceData?.ayahs || []
    const svgSurah = Number(element.getAttribute('surah') || element.getAttribute('data-surah') || 0)
    const svgAyah = Number(element.getAttribute('ayah') || element.getAttribute('data-ayah') || element.getAttribute('data-ayah-number') || 0)

    // الـSVG المطبوع يضع السورة والآية على نفس عنصر ayahPolygon.
    if (svgSurah > 0 && svgAyah > 0) {
      const exact = sourceAyahs.find(
        (item) =>
          Number(item.surah?.number) === svgSurah &&
          (Number(item.numberInSurah) === svgAyah || Number(item.number) === svgAyah),
      )
      if (exact) return exact
    }

    // للروايات النصية نستخدم رقم الآية العامة/المحلية مع سورة الصفحة.
    const fallbackValues = [
      element.getAttribute('data-ayah'),
      element.getAttribute('data-ayah-number'),
      element.getAttribute('id'),
    ].filter(Boolean) as string[]

    const parentSheet = element.closest('.samee3-page-sheet') as HTMLElement | null
    const sheetSurah = Number(parentSheet?.dataset.surahNumber || 0)

    for (const value of fallbackValues) {
      const match = value.match(/\d+/)
      if (!match) continue
      const numeric = Number(match[0])

      const exactGlobal = sourceAyahs.find((ayah) => ayah.number === numeric)
      if (exactGlobal) return exactGlobal

      const exactLocal = sourceAyahs.find(
        (ayah) =>
          Number(ayah.numberInSurah) === numeric &&
          (!sheetSurah || Number(ayah.surah?.number) === sheetSurah),
      )
      if (exactLocal) return exactLocal
    }

    return null
  }, [])

  const handleAyahClick = useCallback((event: React.MouseEvent<HTMLElement>, sourceData: PageData | null) => {
    const target = event.target as Element | null
    if (!target) return
    const polygon = target.closest('.ayahPolygon, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah')
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

  const handleAyahPointerDown = useCallback((event: React.PointerEvent<HTMLElement>, sourceData: PageData | null) => {
    const target = event.target as Element | null
    if (!target) return
    const polygon = target.closest('.ayahPolygon, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah')
    if (!polygon) {
      setPressedAyahNumber(null)
      return
    }

    const found = resolveSelectedAyahFromElement(polygon, sourceData)
    setPressedAyahNumber(found?.numberInSurah || found?.number || null)
  }, [resolveSelectedAyahFromElement])

  const handleAyahPointerUp = useCallback(() => {
    setPressedAyahNumber(null)
  }, [])

  const playPageTurnSound = useCallback(() => {
    try {
      const win = window as Window & { webkitAudioContext?: typeof AudioContext }
      const ContextCtor = window.AudioContext || win.webkitAudioContext
      if (!ContextCtor) return

      const context = pageTurnAudioContextRef.current || new ContextCtor()
      pageTurnAudioContextRef.current = context
      if (context.state === 'suspended') void context.resume().catch(() => {})

      const now = context.currentTime
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.16), context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i += 1) {
        const envelope = Math.pow(1 - i / data.length, 2.2)
        data[i] = (Math.random() * 2 - 1) * envelope * 0.11
      }

      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      source.buffer = buffer
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1700, now)
      filter.Q.setValueAtTime(0.65, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)
      source.start(now)
      source.stop(now + 0.16)
    } catch {
      // صوت التقليب تجميلي ولا يوقف التقليب.
    }
  }, [])

  const navigateTo = useCallback((
    page: number,
    extra?: { surah?: number; ayah?: string; clearJuz?: boolean },
    direction: 'next' | 'prev' = 'next',
  ) => {
    const nextPage = clampPage(page)
    if (navigatingRef.current) return
    if (nextPage === pageNumber && !extra?.ayah && !extra?.surah) return

    // احفظ آخر موضع للصوت قبل تغيير الصفحة. عنصر Audio نفسه لا يتم إيقافه،
    // لذلك تبقى التلاوة مستمرة حتى أثناء تغيير مسار المصحف.
    const audio = audioRef.current as Samee3AudioElement | null
    if (audio?.__samee3NetworkUrl && audio.__samee3Surah) {
      const previous = readPersistentAudioState()
      writePersistentAudioState({
        networkUrl: audio.__samee3NetworkUrl,
        surah: Number(audio.__samee3Surah),
        ayah: previous?.ayah ?? null,
        currentTime: Number.isFinite(audio.currentTime)
          ? Math.max(0, audio.currentTime)
          : previous?.currentTime ?? 0,
        playing: !audio.paused,
        riwaya: audio.__samee3Riwaya || previous?.riwaya || 'hafs',
        reciterId: Number(audio.__samee3ReciterId || previous?.reciterId || 0),
        reciterName: audio.__samee3ReciterName || previous?.reciterName || '',
        moshafId: audio.__samee3MoshafId ?? previous?.moshafId ?? null,
        page: pageNumber,
        updatedAt: Date.now(),
      })
      audio.__samee3Page = pageNumber
    }

    navigatingRef.current = true
    setTurnDirection(direction)
    setTurning(true)
    playPageTurnSound()

    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage))
    if (extra?.surah) params.set('surah', String(extra.surah))
    if (extra?.ayah) params.set('ayah', extra.ayah)
    else params.delete('ayah')

    if (extra?.clearJuz) {
      params.delete('juz')
      params.delete('juzStart')
      params.delete('juzEnd')
    }

    // نعطي حركة الورقة لحظة تبدأ قبل تبديل المحتوى حتى لا يظهر تبديل مفاجئ.
    window.setTimeout(() => {
      router.push(`/mushaf?${params.toString()}`)
    }, 70)

    window.setTimeout(() => {
      navigatingRef.current = false
      setTurning(false)
      setTurnDirection(null)
    }, 540)
  }, [pageNumber, playPageTurnSound, router, searchParams])

  /*
   * التقليب بالماوس/اللمس باستخدام Pointer Events.
   * الاتجاه المطلوب:
   * يسار -> يمين = الصفحة التالية.
   * يمين -> يسار = الصفحة السابقة.
   */
  const beginPagePointer = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const target = event.target as Element | null
      if (!target) return

      if (
        target.closest(
          'button, select, input, textarea, a, .samee3-top-controls, .samee3-bottom-shell, .samee3-reader-toggle, .samee3-ayah-overlay, .samee3-image-preview-overlay',
        )
      ) {
        pointerStartX.current = null
        pointerStartY.current = null
        pointerIdRef.current = null
        return
      }

      pointerStartX.current = event.clientX
      pointerStartY.current = event.clientY
      pointerIdRef.current = event.pointerId

      try {
        event.currentTarget.setPointerCapture(
          event.pointerId,
        )
      } catch {
        // بعض المتصفحات قد لا تدعم pointer capture.
      }
    },
    [],
  )

  const finishPagePointer = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        pointerIdRef.current === null ||
        event.pointerId !== pointerIdRef.current ||
        pointerStartX.current === null ||
        pointerStartY.current === null
      ) {
        return
      }

      const deltaX =
        event.clientX - pointerStartX.current

      const deltaY =
        event.clientY - pointerStartY.current

      pointerStartX.current = null
      pointerStartY.current = null
      pointerIdRef.current = null

      if (
        Math.abs(deltaY) > Math.abs(deltaX) ||
        Math.abs(deltaX) < 45
      ) {
        return
      }

      const step = 1
      const basePage = isDesktop
        ? desktopRightPage
        : pageNumber

      if (deltaX > 0) {
        navigateTo(
          basePage + step,
          undefined,
          'next',
        )
      } else {
        navigateTo(
          basePage - step,
          undefined,
          'prev',
        )
      }
    },
    [
      desktopRightPage,
      isDesktop,
      navigateTo,
      pageNumber,
    ],
  )

  const cancelPagePointer = useCallback(
    (event?: React.PointerEvent<HTMLElement>) => {
      if (
        event &&
        pointerIdRef.current !== null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return
      }

      pointerStartX.current = null
      pointerStartY.current = null
      pointerIdRef.current = null
    },
    [],
  )


  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') navigateTo(pageNumber - 1, undefined, 'prev')
      if (event.key === 'ArrowLeft') navigateTo(pageNumber + 1, undefined, 'next')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDesktop, navigateTo, pageNumber])

  const recitersRequestRef = useRef(0)

  const fetchReciters = useCallback(async (riwayaId: Riwaya) => {
    const requestId = ++recitersRequestRef.current

    setRecitersLoading(true)

    try {
      const remoteRiwayaId = RIWAYA_REMOTE_IDS[riwayaId]

      /*
       * نستخدم قائمة جميع القراء أولًا حتى لا تختفي القراءات التي لا يملك
       * أصحابها المصحف كاملًا؛ فـ API قد يعيد هذه القراءات فقط عند طلب
       * rewaya مع أن بعض القراء لديهم سور محدودة. ثم ندمج معها استجابة
       * الرواية نفسها للاستفادة من الموشف الذي تؤكده الـ API للرواية المختارة.
       */
      const [allResponse, riwayaResponse] = await Promise.all([
        fetch(
          'https://mp3quran.net/api/v3/reciters?language=ar',
          { cache: 'no-store' },
        ),
        fetch(
          `https://mp3quran.net/api/v3/reciters?language=ar&rewaya=${remoteRiwayaId}`,
          { cache: 'no-store' },
        ),
      ])

      if (!allResponse.ok && !riwayaResponse.ok) {
        throw new Error('تعذر تحميل القراء')
      }

      const allPayload = allResponse.ok
        ? await allResponse.json()
        : null
      const riwayaPayload = riwayaResponse.ok
        ? await riwayaResponse.json()
        : null

      const allReciters = Array.isArray(allPayload?.reciters)
        ? (allPayload.reciters as ApiReciter[])
        : []
      const riwayaReciters = Array.isArray(riwayaPayload?.reciters)
        ? (riwayaPayload.reciters as ApiReciter[])
        : []

      const mergedById = new Map<number, ApiReciter>()
      for (const item of allReciters) {
        if (Number.isFinite(Number(item.id))) {
          mergedById.set(Number(item.id), item)
        }
      }
      for (const item of riwayaReciters) {
        if (Number.isFinite(Number(item.id))) {
          const previous = mergedById.get(Number(item.id))
          mergedById.set(Number(item.id), {
            ...previous,
            ...item,
            moshaf: [
              ...(Array.isArray(previous?.moshaf) ? previous.moshaf : []),
              ...(Array.isArray(item.moshaf) ? item.moshaf : []),
            ],
          })
        }
      }

      const rawReciters = Array.from(mergedById.values())
      const riwayaReciterById = new Map<number, ApiReciter>(
        riwayaReciters.map((item) => [Number(item.id), item]),
      )

      const mapped = rawReciters.flatMap((item) => {
        // نفضّل موشف استجابة الرواية نفسها؛ هذا يمنع أخذ مصحف حفص مثلًا
        // لقارئ لديه أكثر من رواية، ويُبقي حتى السور المحدودة الظاهرة في API.
        const riwayaSource = riwayaReciterById.get(Number(item.id))
        const moshaf =
          (riwayaSource
            ? getMoshafForRiwaya(riwayaSource, riwayaId, true)
            : null) ||
          getMoshafForRiwaya(item, riwayaId, false)

        if (!moshaf?.server || !moshaf.surah_list) {
          return []
        }

        const surahIds = parseSurahList(
          moshaf.surah_list,
        )

        if (!surahIds.length) {
          return []
        }

        return [
          {
            id: `${item.id}-${moshaf.id ?? 'default'}`,
            apiId: Number(item.id),
            label: item.name,
            moshafId: moshaf.id ?? null,
            server: String(moshaf.server).replace(/\/$/, ''),
            surahIds,
          },
        ]
      })

      const unique = Array.from(
        new Map(
          mapped.map((item) => [item.id, item]),
        ).values(),
      )

      if (requestId !== recitersRequestRef.current) {
        return unique
      }

      setReciters(unique)
      return unique
    } catch (error) {
      console.error(error)

      if (requestId === recitersRequestRef.current) {
        setReciters([])
      }

      return []
    } finally {
      if (requestId === recitersRequestRef.current) {
        setRecitersLoading(false)
      }
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
    const audio = audioRef.current as Samee3AudioElement | null
    if (audio?.__samee3NetworkUrl && audio.__samee3Surah) {
      const previous = readPersistentAudioState()
      writePersistentAudioState({
        networkUrl: audio.__samee3NetworkUrl,
        surah: Number(audio.__samee3Surah),
        ayah: previous?.ayah ?? null,
        currentTime: Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : previous?.currentTime ?? 0,
        playing: !audio.paused,
        riwaya: nextRiwaya || audio.__samee3Riwaya || previous?.riwaya || 'hafs',
        reciterId: Number(nextReciter?.apiId || audio.__samee3ReciterId || previous?.reciterId || 0),
        reciterName: nextReciter?.label || audio.__samee3ReciterName || previous?.reciterName || '',
        moshafId: nextReciter?.moshafId ?? audio.__samee3MoshafId ?? previous?.moshafId ?? null,
        page: clampPage(Number(audio.__samee3Page || pageNumber)),
        updatedAt: Date.now(),
      })
    }

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
      params.delete('juz')
      params.delete('juzStart')
      params.delete('juzEnd')
      params.delete('ayah')
    }
    router.push(`/mushaf?${params.toString()}`)
  }, [pageNumber, router, searchParams])

  const handleRiwayaSelect = async (value: Riwaya) => {
    if (value === riwaya) return

    const audio = audioRef.current
    const wasPlaying = !!audio && !audio.paused && !!audio.src
    const preservedTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    const visibleAyahs = [pageData, rightPageData, leftPageData]
      .filter(Boolean)
      .flatMap((source) => (source as PageData).ayahs)
    const currentSurah =
      audioSurahRef.current ||
      visibleAyahs.find((ayah) => ayah.number === playingAyahNumber)?.surah?.number ||
      selectedAyah?.surah?.number ||
      requestedSurah ||
      currentSurahNumber ||
      0
    const currentLocalAyah =
      visibleAyahs.find((ayah) => ayah.number === playingAyahNumber)?.numberInSurah ||
      selectedAyah?.numberInSurah ||
      undefined

    audio?.pause()
    setIsPlaying(false)
    setPlayingAyahNumber(null)
    setRepeatAyahNumber(null)
    setAudioError('')
    setShowChrome(true)

    const loaded = await fetchReciters(value)
    if (!loaded.length) {
      setSelectedReciterId(0)
      triggerToast(`لا يوجد قراء متاحون للرواية ${RIWAYA_NAMES[value]} حاليًا.`)
      return
    }

    const preferred = loaded.find((item) => item.apiId === selectedReciterId) || loaded[0] || null
    setReciters(loaded)
    setSelectedReciterId(preferred?.apiId || 0)
    updateRouteAudioSelection(value, preferred)

    if (currentSurah && preferred?.surahIds.includes(Number(currentSurah)) && (wasPlaying || preservedTime > 0 || !!currentLocalAyah)) {
      await loadAudioForSurah(
        Number(currentSurah),
        wasPlaying,
        currentLocalAyah,
        preferred,
        preservedTime,
      )
    }

    triggerToast(
      wasPlaying
        ? `تم تبديل الرواية إلى ${RIWAYA_NAMES[value]} والاستمرار من نفس الموضع.`
        : `تم اختيار ${RIWAYA_NAMES[value]}`,
    )
  }


  const handleReciterSelect = async (id: number) => {
    const item = reciters.find((candidate) => candidate.apiId === id) || null
    if (!item) return

    const currentTargetSurah =
      selectedAyah?.surah?.number ||
      requestedSurah ||
      currentSurahNumber ||
      0
    const currentSurahIsAvailable =
      currentTargetSurah > 0 && item.surahIds.includes(currentTargetSurah)

    if (item.surahIds.length < 114) {
      triggerToast(
        `تم اختيار ${item.label}. هذا القارئ متاح لـ ${arabicNumber(item.surahIds.length)} سورة فقط، اختر السورة من القائمة.`,
      )
    }

    const audio = audioRef.current
    const wasPlaying = !!audio && !audio.paused && !!audio.src
    const wasLoaded = !!audio && !!audio.src
    const preservedTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0

    const visibleAyahs = [pageData, rightPageData, leftPageData]
      .filter(Boolean)
      .flatMap((source) => (source as PageData).ayahs)

    const playingAyah = playingAyahNumber !== null
      ? visibleAyahs.find((ayah) => ayah.number === playingAyahNumber)
      : null

    const activeLocalAyah = playingAyah?.numberInSurah || selectedAyah?.numberInSurah || undefined
    const currentSurah =
      audioSurahRef.current ||
      playingAyah?.surah?.number ||
      selectedAyah?.surah?.number ||
      requestedSurah ||
      currentSurahNumber

    setSelectedReciterId(id)
    updateRouteAudioSelection(riwaya, item)

    if (currentSurah && currentSurahIsAvailable && (wasPlaying || wasLoaded)) {
      await loadAudioForSurah(
        Number(currentSurah),
        wasPlaying,
        activeLocalAyah,
        item,
        preservedTime,
      )
    }

    triggerToast(
      currentSurah && !currentSurahIsAvailable
        ? `تم اختيار ${item.label}. اختر السورة المتاحة من قائمة السور.`
        : wasPlaying
          ? `تم تبديل القارئ إلى ${item.label}`
          : `تم اختيار ${item.label}`,
    )
  }

  const availableSurahs = useMemo(() => {
    if (!selectedReciter) return []
    if (!selectedReciter.surahIds.length) return []
    const allowed = new Set(selectedReciter.surahIds)
    return SURAH_LIST.filter((item) => allowed.has(item.id))
  }, [selectedReciter])

  const handleSurahSelect = (id: number) => {
    const info = availableSurahs.find((item) => item.id === id)
    if (!info) return
    updateRouteAudioSelection(riwaya, selectedReciter, id)
  }


  const executeSearch = async () => {
    const term = searchInput.trim()
    if (!term || searchLoading) return

    setSearchLoading(true)
    setSearchMessage('')
    setSearchResults([])

    try {
      const normalizedTerm = term.replace(/[ًٌٍَُِّْـ]/g, '').trim()
      const response = await fetch(
        `https://api.alquran.cloud/v1/search/${encodeURIComponent(normalizedTerm)}/all/quran-uthmani`,
        { cache: 'no-store', headers: { Accept: 'application/json' } },
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.code !== 200) throw new Error('Search request failed')

      const matches = Array.isArray(payload?.data?.matches) ? payload.data.matches : []
      const mapped: SearchResult[] = matches
        .map((match: any, index: number) => ({
          id: `${match?.surah?.number || 0}:${match?.numberInSurah || 0}:${index}`,
          text: String(match?.text || '').trim(),
          page: clampPage(Number(match?.page || 1)),
          surah: Number(match?.surah?.number || 0),
          surahName: String(match?.surah?.name || 'سورة غير معروفة'),
          ayah: Number(match?.numberInSurah || 0),
        }))
        .filter((item: SearchResult) => item.text && item.surah > 0 && item.ayah > 0)
        .slice(0, 80)

      if (!mapped.length) {
        setSearchMessage('لا توجد آيات مطابقة لما كتبته.')
        setShowSearchResults(true)
        return
      }

      setSearchResults(mapped)
      setShowSearchResults(true)
      setSearchMessage(`تم العثور على ${arabicNumber(mapped.length)} آية مطابقة.`)
    } catch (error) {
      console.error(error)
      setSearchMessage('تعذر البحث في الآيات الآن. حاول مرة أخرى.')
      setShowSearchResults(true)
    } finally {
      setSearchLoading(false)
    }
  }

  const openSearchResult = useCallback(async (result: SearchResult) => {
    setSearchLoading(true)
    try {
      let exactPage = result.page

      // صفحة الآية تختلف أحيانًا بين الروايات؛ نعيد حلّها داخل المصحف
      // المختار قبل فتح النتيجة حتى لا نصل إلى صفحة حفص مثلًا أثناء قراءة ورش.
      try {
        const mushafId = RIWAYA_MUSHAF_IDS[riwaya]
        const response = await fetch(
          `https://api.quranpedia.net/v1/mushafs/${mushafId}/${result.surah}`,
          { cache: 'force-cache' },
        )
        if (response.ok) {
          const payload = await response.json()
          const ayahs = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.ayahs)
              ? payload.ayahs
              : []
          const found = ayahs.find((item: any) => Number(item?.number) === result.ayah)
          if (Number(found?.page_number) > 0) exactPage = clampPage(Number(found.page_number))
        }
      } catch {
        // نستخدم صفحة نتيجة البحث كخطة احتياطية.
      }

      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(exactPage))
      params.set('surah', String(result.surah))
      params.set('ayah', `${result.surah}:${result.ayah}`)
      params.set('autoplay', '1')
      params.delete('juz')
      params.delete('juzStart')
      params.delete('juzEnd')

      if (selectedReciter) {
        params.set('reciterId', String(selectedReciter.apiId))
        params.set('reciterName', selectedReciter.label)
        if (selectedReciter.moshafId != null) params.set('moshafId', String(selectedReciter.moshafId))
      }
      params.set('riwaya', riwaya)

      setShowSearchResults(false)
      setSearchResults([])
      setSearchMessage('')
      router.push(`/mushaf?${params.toString()}`)
    } finally {
      setSearchLoading(false)
    }
  }, [riwaya, router, searchParams, selectedReciter])

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

  const findTimingEnd = useCallback((timings: AyahTiming[], ayahNumber?: number) => {
    if (!ayahNumber) return null
    const index = timings.findIndex((item) => Number(item.ayah) === ayahNumber)
    if (index < 0) return null

    const target = timings[index]
    if (Number.isFinite(Number(target.end_time)) && Number(target.end_time) > 0) {
      return Number(target.end_time) / 1000
    }

    const next = timings[index + 1]
    if (next && Number.isFinite(Number(next.start_time))) {
      return Number(next.start_time) / 1000
    }

    return null
  }, [])

  const playCompletionTone = useCallback(() => {
    try {
      const win = window as Window & {
        webkitAudioContext?: typeof AudioContext
      }
      const ContextCtor = window.AudioContext || win.webkitAudioContext
      if (!ContextCtor) return

      const context = new ContextCtor()
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(660, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.16)

      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.24)

      window.setTimeout(() => {
        void context.close().catch(() => {})
      }, 320)
    } catch {
      // التنبيه الصوتي اختياري ولا يوقف التلاوة.
    }
  }, [])

  const notifyJuzCompleted = useCallback((juzNumber: number) => {
    if (!juzNumber || juzCompletedGuardRef.current) return
    juzCompletedGuardRef.current = true

    const message = `تم الانتهاء من الجزء ${arabicNumber(juzNumber)}`
    try {
      localStorage.setItem(
        'samee3_last_completed_juz',
        JSON.stringify({
          number: juzNumber,
          message,
          at: new Date().toISOString(),
        }),
      )
    } catch {}

    setRepeatAyahNumber(null)
    setPlayingAyahNumber(null)
    setIsPlaying(false)
    playCompletionTone()
    triggerToast(message)
  }, [playCompletionTone, triggerToast])

  useEffect(() => {
    juzCompletedGuardRef.current = false
  }, [activeJuzNumber])

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
      audioSurahRef.current ||
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

      if (activeReciter?.surahIds?.length && !activeReciter.surahIds.includes(surahNumber)) {
        triggerToast(`السورة ${SURAH_LIST.find((item) => item.id === surahNumber)?.name || ''} غير متاحة لهذا القارئ. اختر سورة متاحة من القائمة.`)
        setAudioLoading(false)
        return
      }

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
        const moshaf = source ? getMoshafForRiwaya(source, riwaya, true) : null

        if (moshaf?.server) {
          server = String(moshaf.server).replace(/\/$/, '')
          activeReciter = {
            id: `${reciterApiId}-${moshaf.id ?? 'default'}`,
            apiId: reciterApiId,
            label: source?.name || reciterName,
            moshafId: moshaf.id ?? null,
            server,
            surahIds: parseSurahList(moshaf.surah_list),
          }
        }
      }

      if (!server) {
        throw new Error('لا يوجد رابط صوتي صالح للقارئ المختار.')
      }

      const networkUrl = `${server}/${String(surahNumber).padStart(3, '0')}.mp3`
      audioSurahRef.current = surahNumber
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

      const audio = audioRef.current as Samee3AudioElement | null
      if (!audio) return

      audio.__samee3NetworkUrl = networkUrl
      audio.__samee3Surah = surahNumber
      audio.__samee3Riwaya = riwaya
      audio.__samee3ReciterId = activeReciter?.apiId || reciterApiId
      audio.__samee3ReciterName = activeReciter?.label || reciterName
      audio.__samee3MoshafId = activeReciter?.moshafId ?? null
      audio.__samee3Page = pageNumber

      const timings = await loadAyahTimings(
        surahNumber,
        activeReciter?.apiId || reciterApiId,
      )

      const targetStart =
        findTimingStart(timings, targetAyahNumber) ??
        (Number.isFinite(Number(fallbackStartSeconds)) ? Number(fallbackStartSeconds) : 0)

      audio.pause()
      audio.src = finalUrl
      audio.preload = 'auto'
      audio.load()
      setAudioDisplayUrl(finalUrl)

      /*
       * مهم: بعض المتصفحات تعيد currentTime إلى 0 أثناء
       * تحميل الملف. لذلك ننتظر metadata عندما نحتاج seek.
       */
      const seekToTarget = () => {
        try {
          audio.currentTime =
            Number.isFinite(targetStart) && targetStart > 0
              ? targetStart
              : 0
        } catch {
          // يبقى التشغيل من البداية إذا تعذر الـ seek.
        }
      }

      if (audio.readyState >= 1) {
        seekToTarget()
      } else {
        await new Promise<void>((resolve) => {
          let finished = false

          const done = () => {
            if (finished) return
            finished = true

            audio.removeEventListener(
              'loadedmetadata',
              done,
            )
            audio.removeEventListener(
              'error',
              done,
            )

            seekToTarget()
            resolve()
          }

          audio.addEventListener(
            'loadedmetadata',
            done,
            { once: true },
          )

          audio.addEventListener(
            'error',
            done,
            { once: true },
          )

          window.setTimeout(done, 2500)
        })
      }

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

      writePersistentAudioState({
        networkUrl,
        surah: surahNumber,
        ayah: targetAyahNumber ? Number(targetAyahNumber) : null,
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : targetStart,
        playing: shouldPlay,
        riwaya,
        reciterId: activeReciter?.apiId || reciterApiId,
        reciterName: activeReciter?.label || reciterName,
        moshafId: activeReciter?.moshafId ?? null,
        page: pageNumber,
        updatedAt: Date.now(),
      })

      if (shouldPlay) {
        await audio.play()
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : ''
      if (/not allowed|not supported|operation is not supported|user agent/i.test(message)) {
        setAudioError('')
        triggerToast('اضغط تشغيل لبدء التلاوة.')
      } else {
        setAudioError('تعذر تشغيل التلاوة حاليًا.')
      }
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

  /*
   * جميع القيم الديناميكية تمر من خلال ref حتى لا يتم إنشاء
   * عنصر Audio جديد كلما تغيّرت الصفحة أو الآية.
   * هذا يمنع انقطاع التلاوة أثناء التقليب التلقائي.
   */
  const audioRuntimeRef = useRef<AudioRuntime | null>(null)

  audioRuntimeRef.current = {
    activeJuzNumber,
    activeJuzRange,
    repeatAyahNumber,
    availableSurahs,
    selectedReciter,
    riwaya,
    isDesktop,
    desktopRightPage,
    pageNumber,
    findTimingStart,
    findTimingEnd,
    loadAudioForSurah,
    updatePlayingAyahFromTime,
    notifyJuzCompleted,
    navigateTo,
    triggerToast,
    updateRouteAudioSelection,
  }

  useEffect(() => {
    return () => {
      const context = pageTurnAudioContextRef.current
      pageTurnAudioContextRef.current = null
      if (context) void context.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const win = window as Window & { __samee3PersistentAudio?: Samee3AudioElement }
    const audio = (win.__samee3PersistentAudio || new Audio()) as Samee3AudioElement
    win.__samee3PersistentAudio = audio
    audioRef.current = audio
    audio.preload = 'auto'

    const getRuntime = () =>
      audioRuntimeRef.current

    const persistFromAudio = (playing: boolean) => {
      const networkUrl =
        audio.__samee3NetworkUrl ||
        (audio.src && !audio.src.startsWith('blob:') ? audio.src : '')

      if (!networkUrl || !audio.__samee3Surah) return

      const previous = readPersistentAudioState()
      const currentTime = Number.isFinite(audio.currentTime)
        ? Math.max(0, audio.currentTime)
        : previous?.currentTime ?? 0

      // استخرج الآية الحالية من التوقيت نفسه حتى لا نحفظ آية قديمة
      // عند إيقاف الصوت أو إغلاق الصفحة أثناء التلاوة.
      let activeAyah = previous?.ayah ?? null
      const timings = ayahTimingsRef.current
      if (timings.length) {
        for (let index = 0; index < timings.length; index += 1) {
          const current = timings[index]
          const start = Number(current.start_time || 0) / 1000
          const nextStart =
            index < timings.length - 1
              ? Number(timings[index + 1].start_time || 0) / 1000
              : Number.POSITIVE_INFINITY

          if (currentTime >= start && currentTime < nextStart) {
            const localAyah = Number(current.ayah || 0)
            if (localAyah > 0) activeAyah = localAyah
            break
          }
        }
      }

      writePersistentAudioState({
        networkUrl,
        surah: Number(audio.__samee3Surah),
        ayah: activeAyah,
        currentTime,
        playing,
        riwaya: audio.__samee3Riwaya || previous?.riwaya || 'hafs',
        reciterId: Number(audio.__samee3ReciterId || previous?.reciterId || 0),
        reciterName: audio.__samee3ReciterName || previous?.reciterName || '',
        moshafId: audio.__samee3MoshafId ?? previous?.moshafId ?? null,
        page: clampPage(Number(audio.__samee3Page || previous?.page || pageNumber)),
        updatedAt: Date.now(),
      })
    }

    const onPlay = () => { setIsPlaying(true); persistFromAudio(true) }
    const onPause = () => { setIsPlaying(false); persistFromAudio(false) }

    const onJuzEnd = () => {
      const runtime = getRuntime()

      if (
        !runtime?.activeJuzRange ||
        !runtime.activeJuzNumber
      ) {
        return false
      }

      const currentSurah = Number(
        audioSurahRef.current || 0,
      )

      if (
        currentSurah ===
        runtime.activeJuzRange.end.surah
      ) {
        runtime.notifyJuzCompleted(
          runtime.activeJuzNumber,
        )

        audio.pause()
        return true
      }

      if (
        currentSurah > 0 &&
        currentSurah <
          runtime.activeJuzRange.end.surah
      ) {
        const nextSurah =
          currentSurah + 1

        audio.pause()
        setPlayingAyahNumber(null)

        void runtime.loadAudioForSurah(
          nextSurah,
          true,
          undefined,
          runtime.selectedReciter,
        )

        return true
      }

      return false
    }

    const onEnded = () => {
      const runtime = getRuntime()
      persistFromAudio(false)

      if (!runtime) {
        setIsPlaying(false)
        setPlayingAyahNumber(null)
        return
      }

      if (
        runtime.repeatAyahNumber !== null &&
        ayahTimingsRef.current.length
      ) {
        const repeatStart =
          runtime.findTimingStart(
            ayahTimingsRef.current,
            runtime.repeatAyahNumber,
          )

        if (repeatStart !== null) {
          audio.currentTime =
            repeatStart

          void audio.play().catch(
            () => {},
          )

          return
        }
      }

      if (onJuzEnd()) {
        return
      }

      /*
       * تشغيل السورة التالية تلقائيًا.
       */
      const finishedSurah =
        Number(
          audioSurahRef.current ||
            0,
        )

      if (finishedSurah > 0) {
        const nextAvailable =
          runtime.availableSurahs.find(
            (item) =>
              item.id >
              finishedSurah,
          )

        const nextSurah =
          nextAvailable?.id ||
          SURAH_LIST.find(
            (item) =>
              item.id >
              finishedSurah,
          )?.id ||
          0

        if (nextSurah) {
          setPlayingAyahNumber(null)

          runtime.updateRouteAudioSelection(
            runtime.riwaya,
            runtime.selectedReciter,
            nextSurah,
          )

          void runtime.loadAudioForSurah(
            nextSurah,
            true,
            undefined,
            runtime.selectedReciter,
          )

          return
        }
      }

      setIsPlaying(false)
      setPlayingAyahNumber(null)
    }

    const onTimeUpdate = () => {
      const runtime = getRuntime()
      if (!runtime) return
      const now = Date.now()
      if (now - Number(audio.__samee3LastPersist || 0) >= 1000) {
        audio.__samee3LastPersist = now
        persistFromAudio(!audio.paused)
      }

      runtime.updatePlayingAyahFromTime(
        audio.currentTime,
      )

      /*
       * مزامنة الصفحة مع الآية التي يقرأها القارئ.
       */
      if (
        !audio.paused &&
        !navigatingRef.current &&
        ayahTimingsRef.current.length
      ) {
        const timings =
          ayahTimingsRef.current

        let activeTiming:
          AyahTiming | null =
          null

        for (
          let index = 0;
          index < timings.length;
          index += 1
        ) {
          const current =
            timings[index]

          const start =
            Number(
              current.start_time || 0,
            ) / 1000

          const nextStart =
            index <
            timings.length - 1
              ? Number(
                  timings[index + 1]
                    .start_time || 0,
                ) / 1000
              : Number.POSITIVE_INFINITY

          if (
            audio.currentTime >=
              start &&
            audio.currentTime <
              nextStart
          ) {
            activeTiming =
              current
            break
          }
        }

        const activeLocalAyah =
          Number(
            activeTiming?.ayah || 0,
          )

        const currentSurah =
          Number(
            audioSurahRef.current || 0,
          )

        if (
          activeLocalAyah > 0 &&
          currentSurah > 0
        ) {
          const currentVisibleSheets =
            document.querySelectorAll(
              '.samee3-page-sheet',
            )

          let minLocalAyah =
            Number.POSITIVE_INFINITY

          let maxLocalAyah =
            Number.NEGATIVE_INFINITY

          let hasCurrentSurah =
            false

          currentVisibleSheets.forEach(
            (sheet) => {
              const sheetSurah =
                Number(
                  (
                    sheet as HTMLElement
                  ).dataset
                    .surahNumber ||
                    0,
                )

              if (
                sheetSurah !==
                currentSurah
              ) {
                return
              }

              hasCurrentSurah = true

              const ayahNodes =
                sheet.querySelectorAll(
                  '.ayahPolygon, [data-ayah-number], .samee3-text-ayah',
                )

              ayahNodes.forEach(
                (node) => {
                  const local =
                    Number(
                      node.getAttribute(
                        'ayah',
                      ) ||
                        node.getAttribute(
                          'data-ayah-number',
                        ) ||
                        0,
                    )

                  if (
                    local > 0 &&
                    local <
                      minLocalAyah
                  ) {
                    minLocalAyah =
                      local
                  }

                  if (
                    local > 0 &&
                    local >
                      maxLocalAyah
                  ) {
                    maxLocalAyah =
                      local
                  }
                },
              )
            },
          )

          if (hasCurrentSurah) {
            const anchorPage =
              runtime.isDesktop
                ? runtime.desktopRightPage
                : runtime.pageNumber

            if (
              activeLocalAyah >
              maxLocalAyah
            ) {
              const targetPage =
                clampPage(
                  anchorPage +
                    (
                      runtime.isDesktop
                        ? 2
                        : 1
                    ),
                )

              if (
                targetPage !==
                  runtime.pageNumber &&
                targetPage !==
                  autoPageTargetRef.current &&
                targetPage <= 604
              ) {
                autoPageTargetRef.current =
                  targetPage

                runtime.navigateTo(
                  targetPage,
                  undefined,
                  'next',
                )
              }
            } else if (
              activeLocalAyah <
              minLocalAyah
            ) {
              const targetPage =
                clampPage(
                  anchorPage -
                    (
                      runtime.isDesktop
                        ? 2
                        : 1
                    ),
                )

              if (
                targetPage !==
                  runtime.pageNumber &&
                targetPage !==
                  autoPageTargetRef.current &&
                targetPage >= 1
              ) {
                autoPageTargetRef.current =
                  targetPage

                runtime.navigateTo(
                  targetPage,
                  undefined,
                  'prev',
                )
              }
            }
          }
        }
      }

      /*
       * نهاية الجزء.
       */
      if (
        !runtime.activeJuzRange ||
        !runtime.activeJuzNumber
      ) {
        return
      }

      const currentSurah =
        Number(
          audioSurahRef.current ||
            0,
        )

      if (
        currentSurah !==
        runtime.activeJuzRange.end.surah
      ) {
        return
      }

      const endTime =
        runtime.findTimingEnd(
          ayahTimingsRef.current,
          runtime.activeJuzRange.end.ayah,
        )

      const effectiveEnd =
        endTime ??
        (
          Number.isFinite(
            audio.duration,
          ) &&
          audio.duration > 0
            ? audio.duration
            : null
        )

      if (
        effectiveEnd !== null &&
        audio.currentTime >=
          Math.max(
            0,
            effectiveEnd - 0.08,
          )
      ) {
        onJuzEnd()
      }
    }

    const onLoadedMetadata = () => {
      if (audio.currentTime < 0) {
        audio.currentTime = 0
      }
    }

    const onError = () => {
      setIsPlaying(false)
      setAudioError('')

      const runtime = getRuntime()

      runtime?.triggerToast(
        'تعذر تحميل ملف التلاوة لهذا القارئ أو السورة.',
      )
    }

    audio.addEventListener(
      'play',
      onPlay,
    )

    audio.addEventListener(
      'pause',
      onPause,
    )

    audio.addEventListener(
      'ended',
      onEnded,
    )

    audio.addEventListener(
      'timeupdate',
      onTimeUpdate,
    )

    audio.addEventListener(
      'loadedmetadata',
      onLoadedMetadata,
    )

    audio.addEventListener(
      'error',
      onError,
    )

    const persistOnDocumentExit = () => {
      persistFromAudio(!audio.paused)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistFromAudio(!audio.paused)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', persistOnDocumentExit)
    window.addEventListener('beforeunload', persistOnDocumentExit)

    return () => {
      persistFromAudio(!audio.paused)
      audio.removeEventListener(
        'play',
        onPlay,
      )

      audio.removeEventListener(
        'pause',
        onPause,
      )

      audio.removeEventListener(
        'ended',
        onEnded,
      )

      audio.removeEventListener(
        'timeupdate',
        onTimeUpdate,
      )

      audio.removeEventListener(
        'loadedmetadata',
        onLoadedMetadata,
      )

      audio.removeEventListener(
        'error',
        onError,
      )

      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', persistOnDocumentExit)
      window.removeEventListener('beforeunload', persistOnDocumentExit)

      if (
        audioObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          audioObjectUrlRef.current,
        )

        audioObjectUrlRef.current =
          null
      }
    }
  }, [])


  useEffect(() => {
    if (readingRestoreAttemptedRef.current) return
    readingRestoreAttemptedRef.current = true

    const savedReading = readPersistentReadingState()
    const savedAudio = readPersistentAudioState()
    if (!savedReading && !savedAudio) return

    // الصوت له الأولوية لأنه يحتوي على وقت التشغيل الدقيق.
    if (savedAudio) return

    const shouldRestoreRoute = searchParams.get('autoplay') !== '1'
    if (!shouldRestoreRoute || !savedReading) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(savedReading.page))
    params.set('riwaya', savedReading.riwaya)
    if (savedReading.reciterId) params.set('reciterId', String(savedReading.reciterId))
    if (savedReading.reciterName) params.set('reciterName', savedReading.reciterName)
    if (savedReading.moshafId) params.set('moshafId', String(savedReading.moshafId))
    if (savedReading.surah) params.set('surah', String(savedReading.surah))
    if (savedReading.ayah && savedReading.surah) params.set('ayah', `${savedReading.surah}:${savedReading.ayah}`)
    else params.delete('ayah')
    params.set('autoplay', '0')

    const target = `/mushaf?${params.toString()}`
    const current = `/mushaf?${searchParams.toString()}`
    if (target !== current) router.replace(target)
  }, [router, searchParams])

  useEffect(() => {
    const audio = audioRef.current as Samee3AudioElement | null
    if (!audio || audioRestoreAttemptedRef.current) return
    audioRestoreAttemptedRef.current = true
    const saved = readPersistentAudioState()
    if (!saved) return

    // عند العودة إلى المصحف نعود دائمًا لآخر موضع محفوظ، حتى لو كان رابط
    // العودة نفسه يحتوي على page/surah من القسم الذي غادره المستخدم.
    // الاستثناء الوحيد هو autoplay=1، لأنه أمر صريح بفتح موضع جديد وتشغيله.
    const explicitNewPlayback = searchParams.get('autoplay') === '1'
    if (!explicitNewPlayback) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(saved.page))
      params.set('riwaya', saved.riwaya)
      if (saved.reciterId) params.set('reciterId', String(saved.reciterId))
      if (saved.reciterName) params.set('reciterName', saved.reciterName)
      if (saved.moshafId) params.set('moshafId', String(saved.moshafId))
      params.set('surah', String(saved.surah))
      if (saved.ayah) params.set('ayah', `${saved.surah}:${saved.ayah}`)
      params.set('autoplay', '0')

      const currentTarget = `/mushaf?${params.toString()}`
      const currentPath = `/mushaf?${searchParams.toString()}`
      if (currentPath !== currentTarget) {
        router.replace(currentTarget)
      }
    }

    audio.__samee3NetworkUrl = saved.networkUrl
    audio.__samee3Surah = saved.surah
    audio.__samee3Riwaya = saved.riwaya
    audio.__samee3ReciterId = saved.reciterId
    audio.__samee3ReciterName = saved.reciterName
    audio.__samee3MoshafId = saved.moshafId
    audio.__samee3Page = saved.page

    if (!audio.src || (!audio.src.startsWith('blob:') && audio.src !== saved.networkUrl)) {
      audio.src = saved.networkUrl
      audio.load()
    }
    const restorePosition = () => { try { if (saved.currentTime > 0) audio.currentTime = saved.currentTime } catch {} }
    if (audio.readyState >= 1) restorePosition()
    else audio.addEventListener('loadedmetadata', restorePosition, { once: true })

    setAudioDisplayUrl(saved.networkUrl)
    setSelectedReciterId((current) => current || saved.reciterId)
    setIsPlaying(!audio.paused)
    if (saved.playing && audio.paused) void audio.play().catch(() => {})
  }, [router, searchParams])

  useEffect(() => {
    const saved = readPersistentAudioState()
    if (!saved || !pageData?.ayahs?.length) return
    if (Number(audioRef.current?.__samee3Surah || 0) !== Number(saved.surah)) return
    if (!saved.ayah) return

    const matchingAyah = [pageData, rightPageData, leftPageData]
      .filter(Boolean)
      .flatMap((source) => (source as PageData).ayahs)
      .find(
        (item) =>
          Number(item.surah?.number) === Number(saved.surah) &&
          Number(item.numberInSurah) === Number(saved.ayah),
      )

    if (matchingAyah) {
      setPlayingAyahNumber(matchingAyah.number)
    }
  }, [leftPageData, pageData, rightPageData])

  useEffect(() => {
    const audio = audioRef.current as Samee3AudioElement | null
    if (!audio?.__samee3NetworkUrl || !audio.__samee3Surah) return
    audio.__samee3Page = pageNumber
    const saved = readPersistentAudioState()
    if (!saved) return
    writePersistentAudioState({ ...saved, page: pageNumber, currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : saved.currentTime, playing: !audio.paused, updatedAt: Date.now() })
    persistReadingPosition(pageNumber)
  }, [pageNumber, persistReadingPosition])

  useEffect(() => {
    // حتى بدون تشغيل الصوت، آخر صفحة يقرأها المستخدم تظل محفوظة.
    persistReadingPosition(pageNumber)
  }, [pageNumber, persistReadingPosition])

  useEffect(() => {
    autoplayConsumedRef.current = false
  }, [activeJuzNumber, ayahFromUrl, reciterApiId, requestedSurah, riwaya])

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
    const existingAudio = audioRef.current as Samee3AudioElement | null
    const persisted = readPersistentAudioState()
    if (existingAudio?.__samee3NetworkUrl && persisted?.networkUrl === existingAudio.__samee3NetworkUrl && !existingAudio.paused) return
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

    const selectedSurah =
      selectedAyah?.surah?.number
        ? Number(
            selectedAyah.surah.number,
          )
        : 0

    const selectedLocalAyah =
      selectedAyah?.numberInSurah
        ? Number(
            selectedAyah.numberInSurah,
          )
        : 0

    const selectedAyahGlobalNumber =
      selectedAyah?.number ?? null

    /*
     * وجود آية محددة يعني أن زر التشغيل يجب أن يبدأ من تلك الآية.
     */
    if (
      selectedSurah &&
      selectedLocalAyah
    ) {
      const loadedSurah =
        Number(
          audioSurahRef.current || 0,
        )

      const mustSeekToSelectedAyah =
        !audio ||
        !audio.src ||
        loadedSurah !== selectedSurah ||
        playingAyahNumber === null ||
        (
          selectedAyahGlobalNumber !== null &&
          playingAyahNumber !==
            selectedAyahGlobalNumber
        )

      if (
        mustSeekToSelectedAyah
      ) {
        await loadAudioForSurah(
          selectedSurah,
          true,
          selectedLocalAyah,
        )

        return
      }
    }

    if (
      !audio ||
      !audio.src
    ) {
      await loadAudioForCurrentSurah(
        true,
      )
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
    if (!selectedAyah || imageGenerating) return

    setImageGenerating(true)
    try {
      let interpretation = tafsirText
      if (withTafsir && !interpretation) {
        interpretation = await fetchTafsir(selectedAyah)
      }

      try {
        await document.fonts?.ready
      } catch {
        // بعض المتصفحات لا تدعم document.fonts.
      }

      const canvas = document.createElement('canvas')
      const width = 1400
      const contentWidth = 1160
      const centerX = width / 2
      const ayahText = selectedAyah.text.trim()

      const ayahLayout = fitArabicLines(
        canvas,
        ayahText,
        '"Amiri Quran", "Amiri", serif',
        88,
        42,
        contentWidth,
        withTafsir ? 7 : 10,
      )

      const tafsirLayout = withTafsir
        ? fitArabicLines(
            canvas,
            interpretation || 'لم يتوفر التفسير الآن.',
            '"Amiri", serif',
            38,
            24,
            contentWidth,
            9,
          )
        : null

      const ayahTop = 292
      const ayahHeight = ayahLayout.lines.length * ayahLayout.lineHeight
      const tafsirTop = ayahTop + ayahHeight + 94
      const tafsirHeight = tafsirLayout
        ? tafsirLayout.lines.length * tafsirLayout.lineHeight
        : 0

      const targetHeight = withTafsir
        ? Math.min(1820, Math.max(1080, tafsirTop + tafsirHeight + 150))
        : Math.min(1160, Math.max(820, ayahTop + ayahHeight + 125))

      canvas.width = width
      canvas.height = targetHeight

      const context = canvas.getContext('2d')
      if (!context) {
        triggerToast('تعذر إنشاء الصورة.')
        return
      }

      // خلفية فاخرة هادئة مستوحاة من ورق المصحف مع تدرج أخضر-عاجي.
      const gradient = context.createLinearGradient(0, 0, width, targetHeight)
      gradient.addColorStop(0, '#fffaf1')
      gradient.addColorStop(0.52, '#fbf8ef')
      gradient.addColorStop(1, '#eef8f8')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, targetHeight)

      // هالة خفيفة جدًا في الوسط.
      const glow = context.createRadialGradient(centerX, targetHeight * 0.42, 80, centerX, targetHeight * 0.42, 760)
      glow.addColorStop(0, 'rgba(255,255,255,.78)')
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = glow
      context.fillRect(0, 0, width, targetHeight)

      context.strokeStyle = '#bd8b48'
      context.lineWidth = 5
      context.strokeRect(30, 30, width - 60, targetHeight - 60)

      context.strokeStyle = 'rgba(189,139,72,.38)'
      context.lineWidth = 2
      context.strokeRect(54, 54, width - 108, targetHeight - 108)

      // زوايا زخرفية بسيطة بدل الزحمة البصرية.
      const drawCorner = (x: number, y: number, sx: number, sy: number) => {
        context.save()
        context.translate(x, y)
        context.scale(sx, sy)
        context.strokeStyle = 'rgba(21,94,103,.38)'
        context.lineWidth = 3
        context.beginPath()
        context.moveTo(0, 50)
        context.quadraticCurveTo(0, 0, 50, 0)
        context.stroke()
        context.beginPath()
        context.moveTo(16, 42)
        context.quadraticCurveTo(20, 20, 42, 16)
        context.stroke()
        context.restore()
      }
      drawCorner(64, 64, 1, 1)
      drawCorner(width - 64, 64, -1, 1)
      drawCorner(64, targetHeight - 64, 1, -1)
      drawCorner(width - 64, targetHeight - 64, -1, -1)

      context.textAlign = 'center'
      try { context.direction = 'rtl' } catch {}

      context.fillStyle = '#155e67'
      context.font = '700 62px "Aref Ruqaa", "Amiri", serif'
      context.fillText(`سورة ${getSurahName(selectedAyah.surah?.number)}`, centerX, 122)

      context.fillStyle = '#a66f2d'
      context.font = '700 29px "Tajawal", sans-serif'
      context.fillText(
        `الآية ${arabicNumber(selectedAyah.numberInSurah)}  •  مصحف سميع`,
        centerX,
        174,
      )

      // ميدالية رقم الآية.
      context.fillStyle = '#fffaf0'
      context.strokeStyle = '#c7934f'
      context.lineWidth = 3
      context.beginPath()
      context.arc(centerX, 231, 34, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.fillStyle = '#9a662b'
      context.font = '700 24px "Amiri", serif'
      context.fillText(arabicNumber(selectedAyah.numberInSurah), centerX, 239)

      drawFittedArabicLines(
        context,
        ayahLayout,
        centerX,
        ayahTop,
        '#172235',
      )

      if (tafsirLayout) {
        const dividerY = ayahTop + ayahHeight + 34
        context.strokeStyle = 'rgba(189,139,72,.32)'
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(260, dividerY)
        context.lineTo(width - 260, dividerY)
        context.stroke()

        context.fillStyle = '#155e67'
        context.font = '700 30px "Tajawal", sans-serif'
        context.fillText('التفسير الميسر', centerX, dividerY + 56)

        drawFittedArabicLines(
          context,
          tafsirLayout,
          centerX,
          tafsirTop,
          '#4c5563',
        )
      }

      context.fillStyle = 'rgba(21,94,103,.66)'
      context.font = '700 20px "Tajawal", sans-serif'
      context.fillText('مصحف سميع', centerX, targetHeight - 82)

      const filename = `samee3-ayah-${selectedAyah.surah?.number || 0}-${selectedAyah.numberInSurah}${withTafsir ? '-tafsir' : ''}.png`
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png', 1)
      })

      if (!blob) {
        triggerToast('تعذر إنشاء الصورة.')
        return
      }

      const url = URL.createObjectURL(blob)
      setImagePreview((previous) => {
        if (previous?.url) URL.revokeObjectURL(previous.url)
        return { url, filename, withTafsir }
      })
      setShowAyahActions(false)
    } catch (error) {
      console.error('Ayah image generation error:', error)
      triggerToast('تعذر تجهيز تصميم الصورة الآن.')
    } finally {
      setImageGenerating(false)
    }
  }

  const downloadImagePreview = useCallback(() => {
    if (!imagePreview) return
    const link = document.createElement('a')
    link.href = imagePreview.url
    link.download = imagePreview.filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    triggerToast('تم تحميل الصورة.')
  }, [imagePreview, triggerToast])

  useEffect(() => {
    return () => {
      if (imagePreview?.url) URL.revokeObjectURL(imagePreview.url)
    }
  }, [imagePreview?.url])

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
      onPointerDown={beginPagePointer}
      onPointerUp={finishPagePointer}
      onPointerCancel={cancelPagePointer}
    >
      <div className="samee3-book-stage" onClick={dismissChrome}>
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
          <MushafPageSheet
              page={pageNumber}
              data={pageData}
              html={mainDisplayedSvg}
              side="single"
              meta={rightMeta}
              onAyahClick={handleAyahClick}
              onAyahPointerDown={handleAyahPointerDown}
              onAyahPointerUp={handleAyahPointerUp}
            />
        </div>

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
                    placeholder="ابحث عن آية"
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

            {showSearchResults ? (
              <div className="samee3-search-results-overlay" onClick={(event) => event.stopPropagation()}>
                <div className="samee3-search-results-sheet">
                  <div className="samee3-search-results-head">
                    <div>
                      <span>نتائج البحث في القرآن الكريم</span>
                      <strong>{searchInput.trim() || 'بحث'}</strong>
                    </div>
                    <button type="button" onClick={() => setShowSearchResults(false)} aria-label="إغلاق نتائج البحث"><X size={20} /></button>
                  </div>
                  {searchResults.length ? (
                    <div className="samee3-search-results-list">
                      {searchResults.map((result) => (
                        <button key={result.id} type="button" className="samee3-search-result" onClick={() => openSearchResult(result)}>
                          <div className="samee3-search-result-meta">
                            <span>سورة {result.surahName}</span>
                            <span>الآية {arabicNumber(result.ayah)}</span>
                            <span>صفحة {arabicNumber(result.page)}</span>
                          </div>
                          <p>{result.text}</p>
                          <ChevronLeft size={17} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="samee3-search-empty">{searchMessage || 'لا توجد نتائج.'}</div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="samee3-bottom-shell" onClick={(event) => event.stopPropagation()}>
              <div className="samee3-audio-toolbar">
                <button type="button" onClick={() => void toggleAudio()} disabled={audioLoading} className="samee3-play-button">
                  {audioLoading ? <Loader2 size={20} className="animate-spin" /> : isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                </button>

                <div className={`samee3-picker ${openPicker === 'reciter' ? 'is-open' : ''}`}>
                  <button type="button" className="samee3-picker-trigger" onClick={() => setOpenPicker(openPicker === 'reciter' ? null : 'reciter')} disabled={recitersLoading || !reciters.length}>
                    <span>القارئ</span>
                    <strong>{selectedReciter?.label || (recitersLoading ? 'جاري التحميل...' : 'اختر القارئ')}</strong>
                    <ChevronDown size={16} />
                  </button>
                  {openPicker === 'reciter' ? (
                    <div className="samee3-picker-menu" onClick={(event) => event.stopPropagation()}>
                      {recitersLoading ? <div className="samee3-picker-empty"><Loader2 size={17} className="animate-spin" /> جاري تحميل القراء...</div> : null}
                      {!recitersLoading && reciters.map((item) => (
                        <button key={item.id} type="button" className={selectedReciter?.id === item.id ? 'is-selected' : ''} onClick={() => { setOpenPicker(null); void handleReciterSelect(item.apiId) }}>
                          <span>{item.label}</span>
                          <small>{item.surahIds.length < 114 ? `${arabicNumber(item.surahIds.length)} سورة` : 'المصحف كاملًا'}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className={`samee3-picker ${openPicker === 'riwaya' ? 'is-open' : ''}`}>
                  <button type="button" className="samee3-picker-trigger" onClick={() => setOpenPicker(openPicker === 'riwaya' ? null : 'riwaya')}>
                    <span>الرواية</span>
                    <strong>{RIWAYA_NAMES[riwaya]}</strong>
                    <ChevronDown size={16} />
                  </button>
                  {openPicker === 'riwaya' ? (
                    <div className="samee3-picker-menu" onClick={(event) => event.stopPropagation()}>
                      {Object.entries(RIWAYA_NAMES).map(([id, label]) => (
                        <button key={id} type="button" className={riwaya === id ? 'is-selected' : ''} onClick={() => { setOpenPicker(null); void handleRiwayaSelect(id as Riwaya) }}>
                          <span>{label}</span>
                          {riwaya === id ? <Check size={16} /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className={`samee3-picker ${openPicker === 'surah' ? 'is-open' : ''}`}>
                  <button type="button" className="samee3-picker-trigger" onClick={() => {
                    if (!availableSurahs.length) {
                      triggerToast(selectedReciter ? 'لا توجد سور متاحة لهذا القارئ.' : 'اختر القارئ أولًا.')
                      return
                    }
                    setOpenPicker(openPicker === 'surah' ? null : 'surah')
                  }} disabled={!availableSurahs.length}>
                    <span>السورة</span>
                    <strong>{availableSurahs.find((item) => item.id === (currentSurahNumber || requestedSurah))?.name || 'اختر السورة'}</strong>
                    <ChevronDown size={16} />
                  </button>
                  {openPicker === 'surah' ? (
                    <div className="samee3-picker-menu samee3-picker-menu-surahs" onClick={(event) => event.stopPropagation()}>
                      {availableSurahs.map((item) => (
                        <button key={item.id} type="button" className={(currentSurahNumber || requestedSurah) === item.id ? 'is-selected' : ''} onClick={() => { setOpenPicker(null); handleSurahSelect(item.id) }}>
                          <span>{item.name}</span><small>{arabicNumber(item.id)}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="samee3-bottom-nav">
                <button type="button" onClick={() => router.push('/')}><Home size={22} /><span>الرئيسية</span></button>
                <button type="button" className="active"><BookOpen size={22} /><span>المصحف</span></button>
                <button type="button" onClick={() => router.push('/adhkar')}><Sparkles size={22} /><span>الأذكار</span></button>
                <button type="button" onClick={() => router.push('/surahs')}><List size={22} /><span>الفهرس</span></button>
              </div>
            </div>
          </>
        ) : null}

        <div
          className="samee3-page-footer"
          aria-hidden="true"
        >
          <span>
            {arabicNumber(
              isDesktop
                ? desktopRightPage
                : pageNumber,
            )}
          </span>
        </div>

        <button
          type="button"
          aria-label={showChrome ? 'إخفاء خيارات المصحف' : 'إظهار خيارات المصحف'}
          aria-expanded={showChrome}
          onClick={(event) => {
            event.stopPropagation()
            setShowChrome((value) => !value)
          }}
          className={`samee3-reader-toggle ${showChrome ? 'is-open' : ''}`}
        >
          <List size={26} strokeWidth={2.35} />
        </button>

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
              <button type="button" disabled={imageGenerating} onClick={() => void downloadAyahCard(false)}><ImageIcon size={19} /><span>{imageGenerating ? 'جاري التجهيز...' : 'تصميم كصورة'}</span></button>
              <button type="button" disabled={imageGenerating} onClick={() => void downloadAyahCard(true)}><FileText size={19} /><span>{imageGenerating ? 'جاري التجهيز...' : 'صورة مع التفسير'}</span></button>
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

      {imagePreview ? (
        <div className="samee3-image-preview-overlay" onClick={() => setImagePreview(null)}>
          <div
            className="samee3-image-preview-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="samee3-image-preview-head">
              <div>
                <span>{imagePreview.withTafsir ? 'صورة الآية مع التفسير' : 'تصميم الآية'}</span>
                <strong>مصحف سميع</strong>
              </div>
              <button type="button" onClick={() => setImagePreview(null)} aria-label="إغلاق المعاينة">
                <X size={20} />
              </button>
            </div>

            <div className="samee3-image-preview-frame">
              <img
                src={imagePreview.url}
                alt={imagePreview.withTafsir ? 'صورة الآية مع التفسير' : 'تصميم الآية'}
              />
            </div>

            <button
              type="button"
              className="samee3-image-download-btn"
              onClick={downloadImagePreview}
            >
              <Download size={20} />
              <span>تحميل الصورة</span>
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <div className="samee3-toast"><Check size={16} />{toast}</div> : null}

      <style jsx global>{`
        html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; }
        .samee3-reader { font-family: 'Tajawal', system-ui, sans-serif; color:#1a2534; -webkit-text-size-adjust:100%; text-size-adjust:100%; }
        .samee3-book-stage { position:relative; width:100%; height:100dvh; overflow:hidden; perspective:1800px; background:#f5f0e4; touch-action:pan-y; }
        .samee3-spread { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:10px; padding:0; transform-style:preserve-3d; transition:transform .52s cubic-bezier(.22,.72,.18,1), filter .52s ease; will-change:transform, filter; transform-origin:center center; }
        .samee3-spread.is-desktop { padding:8px 14px 14px; }
        .samee3-spread.is-mobile { padding:0; }
        /* تقليب هادئ ونظيف بدون خط/شريط ظل في منتصف الصفحة */
        .samee3-spread.is-turning.next {
          transform:translate3d(-3px,0,0) rotateY(-2.5deg) scale(.998);
          filter:drop-shadow(-7px 5px 14px rgba(64,49,30,.075));
        }
        .samee3-spread.is-turning.prev {
          transform:translate3d(3px,0,0) rotateY(2.5deg) scale(.998);
          filter:drop-shadow(7px 5px 14px rgba(64,49,30,.075));
        }
        .samee3-page-sheet { position:relative; height:100%; aspect-ratio:1000/1400; overflow:hidden; background:#fffdf7; border:1px solid rgba(177,136,79,.38); box-shadow:0 10px 42px rgba(83,63,34,.11); isolation:isolate; }
        .is-desktop .samee3-page-sheet {
          height:min(calc(100dvh - 24px), 1020px);
          width:auto;
          max-width:min(calc(100vw - 28px), 760px);
          aspect-ratio:1239/1754;
          margin-inline:auto;
        }
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
        .samee3-page-art { position:absolute; inset:94px 7px 88px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .samee3-page-art > svg { width:100% !important; height:100% !important; max-width:100%; max-height:100%; display:block; object-fit:contain; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
        .samee3-page-art svg { user-select:none; }
        .samee3-page-footer {
          position:absolute;
          left:14px;
          bottom:calc(max(2px,env(safe-area-inset-bottom)) + 8px);
          z-index:88;
          height:26px;
          transform:none;
          display:flex;
          align-items:center;
          justify-content:center;
          pointer-events:none;
          color:#9a662b;
          font-weight:900;
          font-size:13px;
        }
        .samee3-page-footer span {
          min-width:66px;
          height:25px;
          display:flex;
          align-items:center;
          justify-content:center;
          border:1px solid rgba(177,126,59,.48);
          border-radius:999px;
          background:rgba(255,249,236,.92);
          box-shadow:0 2px 7px rgba(85,62,27,.08);
          backdrop-filter:blur(7px);
        }
        .samee3-text-page { width:100%; height:100%; box-sizing:border-box; overflow:hidden; padding:24px 28px 18px; direction:rtl; background:#fffdf7; color:#171b20; font-family:'Amiri Quran','Amiri',serif; display:flex; flex-direction:column; justify-content:space-evenly; gap:0; }
        .samee3-text-line { flex:1 1 0; min-height:0; display:flex; align-items:center; justify-content:center; direction:rtl; text-align:center; font-family:'Amiri Quran','Amiri',serif; font-size:clamp(22px,2.05vw,36px); line-height:1.15; white-space:nowrap; letter-spacing:0; }
        .samee3-text-line-svg { font-family:'Amiri Quran','Amiri',serif; font-size:36px; fill:#15191e; }
        .samee3-text-line-svg .samee3-ayah-number { fill:#b78945; }
        .samee3-text-ayah { display:inline; cursor:pointer; border-radius:8px; transition:background .12s ease, box-shadow .12s ease, filter .12s ease; }
        .samee3-text-ayah.samee3-pressed-ayah {
          background:transparent !important;
          box-shadow:inset 0 -0.34em 0 rgba(14,153,212,.16), 0 3px 7px rgba(14,153,212,.13) !important;
        }
        .samee3-text-ayah.samee3-playing-ayah {
          background:transparent !important;
          box-shadow:inset 0 -0.36em 0 rgba(199,147,79,.18), 0 3px 8px rgba(160,105,36,.12) !important;
        }
        .samee3-page-art .ayahPolygon.samee3-pressed-ayah {
          fill:#0e99d4 !important;
          fill-opacity:.10 !important;
          stroke:none !important;
          filter:drop-shadow(0 2px 4px rgba(14,153,212,.28));
        }
        .samee3-page-art .ayahPolygon.samee3-playing-ayah {
          fill:#c7934f !important;
          fill-opacity:.14 !important;
          stroke:none !important;
          filter:drop-shadow(0 2px 4px rgba(157,101,32,.22));
        }
        .samee3-page-art .ayahPolygon.samee3-pressed-ayah * {
          stroke:none !important;
          filter:drop-shadow(0 2px 4px rgba(14,153,212,.20));
        }
        .samee3-page-art .ayahPolygon.samee3-playing-ayah * {
          stroke:none !important;
          filter:drop-shadow(0 2px 4px rgba(157,101,32,.16));
        }
        .samee3-ayah-number { display:inline-block; margin:0 5px; color:#b78945; font-family:'Amiri',serif; font-size:.72em; }

        .samee3-top-controls { position:absolute; z-index:70; top:max(10px,env(safe-area-inset-top)); left:50%; transform:translateX(-50%); width:min(94vw,900px); padding:10px; border-radius:24px; background:rgba(255,253,248,.93); border:1px solid rgba(198,177,142,.55); box-shadow:0 14px 40px rgba(75,58,33,.17); backdrop-filter:blur(16px); }
        .samee3-search-row { display:flex; gap:8px; align-items:center; }
        .samee3-search-box { flex:1; height:46px; display:flex; align-items:center; gap:9px; padding:0 13px; border-radius:16px; border:1px solid #e4d8c1; background:#fff; color:#0e99d4; }
        .samee3-search-box input { flex:1; min-width:0; border:0; outline:0; background:transparent; font-size:16px; font-weight:800; color:#273447; }
        .samee3-search-box input::placeholder { color:#a8a1a0; }
        .samee3-search-box button { display:flex; align-items:center; justify-content:center; border:0; background:transparent; color:#7b8797; }
        .samee3-search-submit { width:46px; height:46px; border:0; border-radius:16px; background:#0e99d4; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 18px rgba(14,153,212,.22); }
        .samee3-search-submit:disabled { opacity:.65; }
        .samee3-search-message { margin-top:7px; text-align:center; font-size:11px; font-weight:800; color:#8b5f28; }
        .samee3-search-results-overlay { position:absolute; z-index:78; inset:0; padding:88px 12px 116px; display:flex; align-items:flex-start; justify-content:center; pointer-events:auto; background:rgba(245,240,228,.30); backdrop-filter:blur(5px); }
        .samee3-search-results-sheet { width:min(94vw,860px); max-height:calc(100dvh - 150px); overflow:hidden; border:1px solid rgba(177,126,59,.35); border-radius:26px; background:rgba(255,253,248,.98); box-shadow:0 24px 70px rgba(64,49,30,.20); }
        .samee3-search-results-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; border-bottom:1px solid #eee3d1; background:rgba(255,253,248,.97); }
        .samee3-search-results-head div { display:flex; flex-direction:column; gap:3px; min-width:0; }
        .samee3-search-results-head span { color:#a06b2e; font-size:11px; font-weight:900; }
        .samee3-search-results-head strong { color:#172235; font-size:18px; font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .samee3-search-results-head button { width:38px; height:38px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; border:1px solid #e4d8c1; border-radius:50%; background:#fff; color:#667485; }
        .samee3-search-results-list { max-height:calc(100dvh - 215px); overflow:auto; padding:10px; }
        .samee3-search-result { position:relative; width:100%; display:block; text-align:right; padding:14px 16px 14px 40px; margin-bottom:8px; border:1px solid #eee4d3; border-radius:18px; background:#fffefa; color:#1d2a38; cursor:pointer; }
        .samee3-search-result:hover { background:#fbf5e8; border-color:#d7bb8d; }
        .samee3-search-result:disabled { opacity:.58; }
        .samee3-search-result > svg { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#a46d2d; }
        .samee3-search-result-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:7px; color:#a06b2e; font-size:11px; font-weight:900; }
        .samee3-search-result-meta span { padding:4px 8px; border-radius:999px; background:#faf3e6; border:1px solid #eee0c8; }
        .samee3-search-result p { margin:0; color:#182330; font-family:'Amiri Quran','Amiri',serif; font-size:20px; line-height:1.9; }
        .samee3-search-empty { padding:50px 20px; text-align:center; color:#8b5f28; font-size:14px; font-weight:900; }

        .samee3-bottom-shell {
          position:absolute;
          z-index:75;
          left:50%;
          bottom:calc(max(4px,env(safe-area-inset-bottom)) + 61px);
          transform:translateX(-50%);
          transform-origin:bottom center;
          width:min(96vw,1040px);
          padding:10px;
          border-radius:26px;
          background:rgba(255,253,248,.97);
          border:1px solid rgba(169,200,216,.8);
          box-shadow:0 18px 50px rgba(35,73,86,.20);
          backdrop-filter:blur(17px);
          animation:samee3-bottom-in .24s cubic-bezier(.2,.8,.25,1) both;
        }

        @keyframes samee3-bottom-in {
          from {
            opacity:0;
            transform:
              translateX(-50%)
              translateY(20px)
              scale(.97);
          }
          to {
            opacity:1;
            transform:
              translateX(-50%)
              translateY(0)
              scale(1);
          }
        }

        .samee3-reader-toggle {
          position:absolute;
          z-index:95;
          left:50%;
          bottom:calc(max(2px,env(safe-area-inset-bottom)) + 2px);
          transform:translateX(-50%);
          width:52px;
          height:52px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          border:1.4px solid rgba(14,153,212,.34);
          background:rgba(255,253,248,.98);
          color:#0e99d4;
          box-shadow:0 8px 24px rgba(35,73,86,.17);
          backdrop-filter:blur(15px);
          transition:
            transform .24s ease,
            box-shadow .24s ease,
            background .24s ease,
            color .24s ease;
        }
        .samee3-reader-toggle:hover { transform:translateX(-50%) translateY(-2px) scale(1.02); box-shadow:0 14px 32px rgba(35,73,86,.20); }
        .samee3-reader-toggle:active { transform:translateX(-50%) scale(.94); }
        .samee3-reader-toggle.is-open { background:#0e99d4; color:#fff; transform:translateX(-50%) rotate(90deg) scale(1.03); box-shadow:0 12px 30px rgba(14,153,212,.28); }
        .samee3-bottom-shell { bottom:calc(max(3px,env(safe-area-inset-bottom)) + 58px); }
        .samee3-picker { position:relative; min-width:0; }
        .samee3-picker-trigger { width:100%; min-height:56px; padding:6px 38px 6px 12px; border:1px solid #e3d9c7; border-radius:15px; background:#fff; color:#263347; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; gap:2px; position:relative; text-align:right; touch-action:manipulation; }
        .samee3-picker-trigger > span { font-size:9px; color:#a4947a; font-weight:900; }
        .samee3-picker-trigger > strong { width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:13px; line-height:1.35; font-weight:900; }
        .samee3-picker-trigger > svg { position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#d27b0a; transition:transform .18s ease; }
        .samee3-picker.is-open .samee3-picker-trigger > svg { transform:translateY(-50%) rotate(180deg); }
        .samee3-picker-menu { position:absolute; z-index:240; left:0; right:0; bottom:calc(100% + 8px); max-height:min(48dvh,360px); overflow:auto; padding:7px; border:1px solid rgba(169,200,216,.85); border-radius:18px; background:rgba(255,253,248,.99); box-shadow:0 18px 46px rgba(35,73,86,.24); backdrop-filter:blur(16px); overscroll-behavior:contain; }
        .samee3-picker-menu button { width:100%; min-height:46px; padding:8px 10px; border:0; border-radius:12px; background:transparent; color:#29384a; display:flex; align-items:center; justify-content:space-between; gap:8px; text-align:right; font-weight:900; font-size:12px; }
        .samee3-picker-menu button:hover, .samee3-picker-menu button.is-selected { background:#eef9fc; color:#0b7ea7; }
        .samee3-picker-menu button small { color:#9b8a72; font-size:9px; font-weight:900; white-space:nowrap; }
        .samee3-picker-empty { min-height:54px; display:flex; align-items:center; justify-content:center; gap:7px; color:#7d8b9b; font-size:11px; font-weight:900; }
        .samee3-picker-menu-surahs { max-height:min(55dvh,430px); }
        .samee3-audio-toolbar { display:grid; grid-template-columns:1.1fr 1fr 1fr 1fr; gap:8px; }
        .samee3-play-button { min-height:45px; border:0; border-radius:15px; background:linear-gradient(135deg,#d78a12,#c36f05); color:#fff; font-weight:900; display:flex; align-items:center; justify-content:center; gap:7px; box-shadow:0 8px 18px rgba(195,111,5,.19); }
        .samee3-select-wrap { position:relative; min-width:0; min-height:56px; display:flex; flex-direction:column; justify-content:center; gap:2px; padding:5px 42px 5px 12px; border-radius:15px; border:1px solid #e3d9c7; background:#fff; cursor:pointer; touch-action:manipulation; }
        .samee3-select-wrap > span:first-child { font-size:9px; color:#a4947a; font-weight:900; pointer-events:none; }
        .samee3-select-wrap .samee3-select-value { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#263347; font-size:13px; line-height:1.35; font-weight:900; pointer-events:none; }
        .samee3-select-wrap select { position:absolute; inset:0; width:100%; height:100%; opacity:0.01; border:0; outline:0; background:transparent; appearance:auto; cursor:pointer; z-index:3; font-size:16px; }
        .samee3-select-wrap > svg { position:absolute; right:12px; top:50%; transform:translateY(-20%); pointer-events:none; color:#d27b0a; z-index:2; }
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
        .samee3-image-preview-overlay { position:absolute; z-index:150; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(25,34,39,.46); backdrop-filter:blur(8px); }
        .samee3-image-preview-sheet { width:min(94vw,620px); max-height:94dvh; overflow:auto; border-radius:28px; background:#fffdf8; border:1px solid rgba(189,139,72,.42); box-shadow:0 24px 90px rgba(22,35,40,.30); padding:14px; }
        .samee3-image-preview-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:6px 4px 12px; }
        .samee3-image-preview-head > div { display:flex; flex-direction:column; gap:3px; }
        .samee3-image-preview-head span { color:#9a662b; font-size:10px; font-weight:900; }
        .samee3-image-preview-head strong { color:#155e67; font-family:'Aref Ruqaa','Amiri',serif; font-size:22px; }
        .samee3-image-preview-head button { width:36px; height:36px; border:0; border-radius:50%; background:#f2eee7; color:#5d6b75; display:flex; align-items:center; justify-content:center; }
        .samee3-image-preview-frame { display:flex; align-items:center; justify-content:center; padding:10px; border-radius:22px; background:linear-gradient(180deg,#f7f1e6,#eef8f8); border:1px solid #e8decc; overflow:hidden; }
        .samee3-image-preview-frame img { display:block; width:100%; height:auto; max-height:72dvh; object-fit:contain; border-radius:14px; }
        .samee3-image-download-btn { width:100%; margin-top:12px; min-height:48px; border:0; border-radius:16px; background:linear-gradient(135deg,#d78a12,#c36f05); color:#fff; font-size:14px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 8px 20px rgba(195,111,5,.18); }
        .samee3-toast { position:absolute; z-index:130; left:50%; bottom:calc(max(12px,env(safe-area-inset-bottom)) + 84px); transform:translateX(-50%); display:flex; align-items:center; gap:7px; padding:10px 14px; border-radius:999px; background:#173d45; color:#fff; font-size:11px; font-weight:900; box-shadow:0 10px 30px rgba(18,49,57,.25); }

        @media (max-width:767px) {
          .samee3-page-meta { height:44px; padding:5px 10px 0; }
          .samee3-page-meta .meta-side { font-size:12px; }
          .samee3-page-meta .meta-badge { height:26px; min-width:26px; }
          .samee3-surah-frame { top:43px; left:5.5%; right:5.5%; height:41px; }
          .samee3-surah-frame strong { min-width:140px; font-size:20px; }
          .samee3-page-art { inset:84px 2px 78px; }
          .samee3-top-controls { width:calc(100% - 20px); }
          .samee3-audio-toolbar { grid-template-columns:1fr 1fr; }
          .samee3-bottom-shell {
            width:calc(100% - 14px);
            bottom:calc(max(3px,env(safe-area-inset-bottom)) + 58px);
          }
          .samee3-picker-menu { max-height:min(44dvh,330px); }
          .samee3-search-results-overlay { padding:72px 8px 110px; }
          .samee3-search-results-sheet { width:calc(100vw - 16px); max-height:calc(100dvh - 125px); border-radius:22px; }
          .samee3-search-results-list { max-height:calc(100dvh - 190px); padding:8px; }
          .samee3-search-result p { font-size:18px; line-height:1.85; }
          .samee3-text-line { font-size:clamp(18px,5vw,27px); }
          .samee3-text-line-svg { font-size:33px; }
          .samee3-page-footer { left:12px; bottom:calc(max(2px,env(safe-area-inset-bottom)) + 7px); }
          .samee3-ayah-actions-grid { grid-template-columns:repeat(2,1fr); }
          .samee3-ayah-preview { font-size:21px; }
          .samee3-image-preview-sheet { width:calc(100vw - 20px); max-height:94dvh; padding:10px; }
          .samee3-image-preview-frame img { max-height:64dvh; }
        }

        @media (min-width:768px) {
          .samee3-page-art > svg { width:100% !important; height:100% !important; }
          .samee3-bottom-shell { bottom:calc(max(3px,env(safe-area-inset-bottom)) + 58px); }
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
  onAyahPointerDown: (event: React.PointerEvent<HTMLElement>, sourceData: PageData | null) => void
  onAyahPointerUp: () => void
}

function buildTextMushafSvg(data: PageData | null, riwaya: 'sousi' | 'bazzi') {
  if (!data?.ayahs?.length) return ''

  const escapeXml = (value: string) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  const fontFamily = riwaya === 'sousi' ? 'soosi9' : 'bazzi7'
  const fontUrl = riwaya === 'sousi'
    ? 'https://cdn.jsdelivr.net/gh/thetruetruth/quran-data-kfgqpc@main/soosi/font/soosi.9.woff2'
    : 'https://cdn.jsdelivr.net/gh/thetruetruth/quran-data-kfgqpc@main/bazzi/font/bazzi.7.woff2'

  type Chunk = { ayah: Ayah; text: string; isNumber?: boolean }

  const cleanText = (value: string) => String(value || '').replace(/\s+/g, ' ').trim()

  // نجهز النص في وحدات صغيرة ثم نوزعه على 15 سطرًا تقريبًا،
  // حتى يظل شكل الصفحة قريبًا من صفحة المصحف بدل تجميع النص في المنتصف.
  const sourceWords: Array<{ ayah: Ayah; word: string }> = []
  for (const ayah of data.ayahs) {
    const clean = cleanText(ayah.text)
    if (!clean) continue
    for (const word of clean.split(' ')) {
      if (word) sourceWords.push({ ayah, word })
    }
  }

  const totalCharacters = sourceWords.reduce((sum, item) => sum + item.word.length + 1, 0)
  let maxChars = Math.max(38, Math.ceil(totalCharacters / 15) + 5)
  let lines: Chunk[][] = []

  const makeLines = (limit: number) => {
    const result: Chunk[][] = []
    let line: Chunk[] = []
    let length = 0

    const pushLine = () => {
      if (line.length) result.push(line)
      line = []
      length = 0
    }

    for (const item of sourceWords) {
      const nextLength = length + item.word.length + (line.length ? 1 : 0)
      if (line.length && nextLength > limit) pushLine()
      line.push({ ayah: item.ayah, text: item.word })
      length += item.word.length + (line.length > 1 ? 1 : 0)
    }

    pushLine()

    // رقم الآية يوضع في نهاية السطر الأقرب لنهاية الآية.
    for (const marker of data.ayahs) {
      const markerText = `۝ ${marker.numberInSurah}`
      let targetIndex = -1
      for (let i = result.length - 1; i >= 0; i -= 1) {
        if (result[i].some((item) => item.ayah.number === marker.number)) {
          targetIndex = i
          break
        }
      }
      if (targetIndex >= 0) {
        result[targetIndex].push({ ayah: marker, text: markerText, isNumber: true })
      }
    }

    return result
  }

  for (let guard = 0; guard < 12; guard += 1) {
    lines = makeLines(maxChars)
    if (lines.length <= 15) break
    maxChars += 4
  }

  const lineCount = Math.max(1, Math.min(15, lines.length))
  if (lines.length > 15) {
    lines = lines.slice(0, 15)
  }

  const fontSize = lineCount <= 12 ? 49 : lineCount <= 14 ? 46 : 43
  const topY = 78
  const bottomY = 1320
  const lineHeight = lineCount <= 1 ? 0 : (bottomY - topY) / (lineCount - 1)

  const lineMarkup = lines.map((items, index) => {
    // كل كلمة تحمل بيانات الآية، لذلك يبقى النقر والمزامنة يعملان حتى
    // عندما تنقسم الآية على أكثر من سطر.
    const content = items.map((item) => {
      const attrs = `class="samee3-text-ayah${item.isNumber ? ' samee3-ayah-number-svg' : ''}" data-ayah="${item.ayah.number}" data-ayah-number="${item.ayah.numberInSurah}" data-surah="${item.ayah.surah?.number || 0}"` 
      return `<tspan ${attrs}>${escapeXml(item.text)} </tspan>`
    }).join('')

    const y = lineCount === 1 ? 700 : topY + index * lineHeight
    return `<text x="500" y="${y.toFixed(1)}" class="samee3-riwaya-line" font-size="${fontSize}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext">${content}</text>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
    <defs>
      <style>
        @font-face { font-family:'${fontFamily}'; src:url('${fontUrl}') format('woff2'); font-display:swap; }
        .samee3-riwaya-line { font-family:'${fontFamily}','Amiri Quran','Amiri',serif; fill:#15191e; font-weight:400; }
        .samee3-text-ayah { cursor:pointer; }
        .samee3-ayah-number-svg { fill:#a97935; font-size:${Math.max(30, fontSize - 8)}px; }
      </style>
    </defs>
    ${lineMarkup}
  </svg>`
}

function MushafPageSheet({ page, data, html, side, meta, onAyahClick, onAyahPointerDown, onAyahPointerUp }: MushafPageSheetProps) {
  return (
    <section
      className={`samee3-page-sheet ${side}`}
      data-surah-number={data?.ayahs?.[0]?.surah?.number || ''}
      onClick={(event) => onAyahClick(event, data)}
      onPointerDown={(event) => onAyahPointerDown(event, data)}
      onPointerUp={onAyahPointerUp}
      onPointerCancel={onAyahPointerUp}
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

    </section>
  )
}


type ArabicTextLayout = {
  fontSize: number
  lineHeight: number
  lines: string[]
  fontFamily: string
}

function fitArabicLines(
  canvas: HTMLCanvasElement,
  text: string,
  fontFamily: string,
  maxFontSize: number,
  minFontSize: number,
  maxWidth: number,
  maxLines: number,
): ArabicTextLayout {
  const context = canvas.getContext('2d')
  if (!context) {
    return {
      fontSize: minFontSize,
      lineHeight: Math.round(minFontSize * 1.65),
      lines: [text],
      fontFamily,
    }
  }

  const clean = text.replace(/\s+/g, ' ').trim() || '—'

  for (let size = maxFontSize; size >= minFontSize; size -= 2) {
    context.font = `${size}px ${fontFamily}`
    const words = clean.split(' ')
    const lines: string[] = []
    let line = ''

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)

    if (lines.length <= maxLines) {
      return {
        fontSize: size,
        lineHeight: Math.round(size * 1.55),
        lines,
        fontFamily,
      }
    }
  }

  context.font = `${minFontSize}px ${fontFamily}`
  const lines: string[] = []
  let line = ''
  for (const word of clean.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)

  return {
    fontSize: minFontSize,
    lineHeight: Math.round(minFontSize * 1.55),
    lines,
    fontFamily,
  }
}

function drawFittedArabicLines(
  context: CanvasRenderingContext2D,
  layout: ArabicTextLayout,
  centerX: number,
  startY: number,
  color: string,
) {
  try { context.direction = 'rtl' } catch {}
  context.textAlign = 'center'
  context.fillStyle = color
  context.font = `${layout.fontSize}px ${layout.fontFamily}`

  layout.lines.forEach((line, index) => {
    context.fillText(line, centerX, startY + index * layout.lineHeight)
  })
}