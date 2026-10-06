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

// MP3Quran: مشاري راشد العفاسي — القارئ الافتراضي للمصحف.
// المعرّف الحالي لمشاري راشد العفاسي في كتالوج MP3Quran هو 123، وصوت حفص الكامل مصدره مسار afs.
const DEFAULT_RECITER_API_ID = 123
const DEFAULT_RECITER_NAME = 'مشاري راشد العفاسي'

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

type SearchResult = {
  id: string
  text: string
  page: number
  surah: number
  surahName: string
  ayah: number
}

type TafsirBook = {
  id: number
  name: string
  short_name: string
  author: string
}

const FALLBACK_TAFSIR_BOOKS: TafsirBook[] = [
  { id: 2012, name: 'التفسير الميسر', short_name: 'الميسر', author: 'مجموعة من العلماء' },
  { id: 136, name: 'تفسير القرآن العظيم', short_name: 'ابن كثير', author: 'إسماعيل بن عمر ابن كثير' },
  { id: 4, name: 'جامع البيان في تأويل آي القرآن', short_name: 'الطبري', author: 'محمد بن جرير الطبري' },
  { id: 2, name: 'معالم التنزيل', short_name: 'البغوي', author: 'الحسين بن مسعود البغوي' },
  { id: 3, name: 'تيسير الكريم الرحمن', short_name: 'السعدي', author: 'عبد الرحمن بن ناصر السعدي' },
  { id: 1469, name: 'الجامع لأحكام القرآن', short_name: 'القرطبي', author: 'محمد بن أحمد القرطبي' },
  { id: 27796, name: 'أضواء البيان في إيضاح القرآن بالقرآن', short_name: 'أضواء البيان', author: 'محمد الأمين الشنقيطي' },
  { id: 54, name: 'أيسر التفاسير', short_name: 'أيسر التفاسير', author: 'أبو بكر الجزائري' },
]

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
  isAyahOnCurrentPage: (
    surahNumber: number,
    ayahNumber: number,
  ) => boolean
  resolveAyahPage: (
    targetRiwaya: Riwaya,
    surahNumber: number,
    ayahNumber: number,
  ) => Promise<number | null>
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

const ALL_MUSHAF_RIWAYAT: Riwaya[] = [
  'hafs',
  'warsh',
  'qalun',
  'douri',
  'shubah',
  'sousi',
  'bazzi',
]

const SAMEE3_MUSHAF_PAGE_CACHE_NAME = 'samee3-mushaf-pages-v2'
const SAMEE3_MUSHAF_WARMUP_STATE_KEY = 'samee3_mushaf_full_warmup_v2'

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

type JuzEntry = {
  number: number
  start: QuranReference
  end: QuranReference
}

// حدود الأجزاء القرآنية. الصفحة الفعلية لا تُحفظ هنا؛ يتم حلها من مصدر
// الرواية المختارة حتى يفتح الجزء في الصفحة الصحيحة لكل رواية.
const JUZ_LIST: JuzEntry[] = [
  { number: 1, start: { surah: 1, ayah: 1 }, end: { surah: 2, ayah: 141 } },
  { number: 2, start: { surah: 2, ayah: 142 }, end: { surah: 2, ayah: 252 } },
  { number: 3, start: { surah: 2, ayah: 253 }, end: { surah: 3, ayah: 92 } },
  { number: 4, start: { surah: 3, ayah: 93 }, end: { surah: 4, ayah: 23 } },
  { number: 5, start: { surah: 4, ayah: 24 }, end: { surah: 4, ayah: 147 } },
  { number: 6, start: { surah: 4, ayah: 148 }, end: { surah: 5, ayah: 81 } },
  { number: 7, start: { surah: 5, ayah: 82 }, end: { surah: 6, ayah: 110 } },
  { number: 8, start: { surah: 6, ayah: 111 }, end: { surah: 7, ayah: 87 } },
  { number: 9, start: { surah: 7, ayah: 88 }, end: { surah: 8, ayah: 40 } },
  { number: 10, start: { surah: 8, ayah: 41 }, end: { surah: 9, ayah: 93 } },
  { number: 11, start: { surah: 9, ayah: 94 }, end: { surah: 11, ayah: 5 } },
  { number: 12, start: { surah: 11, ayah: 6 }, end: { surah: 12, ayah: 52 } },
  { number: 13, start: { surah: 12, ayah: 53 }, end: { surah: 14, ayah: 52 } },
  { number: 14, start: { surah: 15, ayah: 1 }, end: { surah: 16, ayah: 128 } },
  { number: 15, start: { surah: 17, ayah: 1 }, end: { surah: 18, ayah: 74 } },
  { number: 16, start: { surah: 18, ayah: 75 }, end: { surah: 20, ayah: 135 } },
  { number: 17, start: { surah: 21, ayah: 1 }, end: { surah: 22, ayah: 78 } },
  { number: 18, start: { surah: 23, ayah: 1 }, end: { surah: 25, ayah: 20 } },
  { number: 19, start: { surah: 25, ayah: 21 }, end: { surah: 27, ayah: 55 } },
  { number: 20, start: { surah: 27, ayah: 56 }, end: { surah: 29, ayah: 45 } },
  { number: 21, start: { surah: 29, ayah: 46 }, end: { surah: 33, ayah: 30 } },
  { number: 22, start: { surah: 33, ayah: 31 }, end: { surah: 36, ayah: 27 } },
  { number: 23, start: { surah: 36, ayah: 28 }, end: { surah: 39, ayah: 31 } },
  { number: 24, start: { surah: 39, ayah: 32 }, end: { surah: 41, ayah: 46 } },
  { number: 25, start: { surah: 41, ayah: 47 }, end: { surah: 45, ayah: 37 } },
  { number: 26, start: { surah: 46, ayah: 1 }, end: { surah: 51, ayah: 30 } },
  { number: 27, start: { surah: 51, ayah: 31 }, end: { surah: 57, ayah: 29 } },
  { number: 28, start: { surah: 58, ayah: 1 }, end: { surah: 66, ayah: 12 } },
  { number: 29, start: { surah: 67, ayah: 1 }, end: { surah: 77, ayah: 50 } },
  { number: 30, start: { surah: 78, ayah: 1 }, end: { surah: 114, ayah: 6 } },
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
  __samee3CurrentAyah?: number | null
  __samee3Server?: string
  __samee3SurahIds?: number[]
  __samee3Timings?: AyahTiming[]
  __samee3LastPersist?: number
  __samee3PersistentHandlersInstalled?: boolean
  __samee3ObjectUrl?: string
}

const SAMEE3_AUDIO_STORAGE_KEY = 'samee3_persistent_audio_v2'
const SAMEE3_AUDIO_CACHE_NAME = 'samee3-audio-v2'
const SAMEE3_TIMINGS_STORAGE_PREFIX = 'samee3_ayah_timing_v2:'

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function timingStorageKey(surahNumber: number, readId: number) {
  return `${SAMEE3_TIMINGS_STORAGE_PREFIX}${readId}:${surahNumber}`
}

function readCachedAyahTimings(surahNumber: number, readId: number): AyahTiming[] {
  if (!surahNumber || !readId || typeof localStorage === 'undefined') return []

  try {
    const raw = localStorage.getItem(timingStorageKey(surahNumber, readId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item: unknown) => {
        const row = item as Record<string, unknown>
        return {
          ayah: Number(row?.ayah),
          start_time: Number(row?.start_time),
          end_time: Number(row?.end_time),
        } satisfies AyahTiming
      })
      .filter(
        (item: AyahTiming) =>
          Number.isFinite(Number(item.ayah)) &&
          Number(item.ayah) > 0 &&
          Number.isFinite(Number(item.start_time)),
      )
      .sort(
        (a: AyahTiming, b: AyahTiming) =>
          Number(a.start_time) - Number(b.start_time),
      )
  } catch {
    return []
  }
}

function writeCachedAyahTimings(
  surahNumber: number,
  readId: number,
  timings: AyahTiming[],
) {
  if (!surahNumber || !readId || !timings.length || typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(
      timingStorageKey(surahNumber, readId),
      JSON.stringify(timings),
    )
  } catch {
    // امتلاء localStorage لا يجب أن يمنع تشغيل التلاوة.
  }
}

async function getCachedAudioSource(
  networkUrl: string,
): Promise<{ src: string; objectUrl: string | null } | null> {
  if (!networkUrl || typeof caches === 'undefined') return null

  try {
    const cache = await caches.open(SAMEE3_AUDIO_CACHE_NAME)
    const cached = await cache.match(networkUrl)
    if (!cached) return null

    /*
     * إذا كانت الاستجابة قابلة للقراءة، نحولها إلى Blob URL.
     * هذا هو المسار الأقوى لأنه لا يعتمد على بقاء Service Worker حيًا.
     */
    if (cached.type !== 'opaque') {
      const blob = await cached.blob()
      if (blob.size > 0) {
        const objectUrl = URL.createObjectURL(blob)
        return { src: objectUrl, objectUrl }
      }
    }

    /*
     * الاستجابة opaque لا يمكن للصفحة قراءة body الخاص بها،
     * لكن Service Worker يستطيع تقديمها عند طلب networkUrl.
     */
    return { src: networkUrl, objectUrl: null }
  } catch {
    return null
  }
}

async function cacheAudioForOffline(networkUrl: string): Promise<boolean> {
  if (!networkUrl || /^blob:/i.test(networkUrl) || typeof caches === 'undefined') {
    return false
  }

  try {
    const cache = await caches.open(SAMEE3_AUDIO_CACHE_NAME)
    const existing = await cache.match(networkUrl)
    if (existing) return true

    /*
     * المسار الأول: استجابة CORS كاملة يمكن إعادة استخدامها كـBlob URL.
     */
    try {
      const corsResponse = await fetch(networkUrl, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit',
      })

      if (corsResponse.ok && corsResponse.status !== 206) {
        await cache.put(networkUrl, corsResponse.clone())
        return true
      }
    } catch {
      // ننتقل إلى المسار الاحتياطي عبر Service Worker.
    }

    /*
     * المسار الاحتياطي: opaque response. هذا مفيد للـService Worker
     * عندما لا يسمح خادم الصوت بقراءة body من JavaScript.
     */
    try {
      const opaqueResponse = await fetch(networkUrl, {
        method: 'GET',
        cache: 'no-store',
        mode: 'no-cors',
        credentials: 'omit',
      })

      if (opaqueResponse.type === 'opaque') {
        await cache.put(networkUrl, opaqueResponse)
        return true
      }
    } catch {
      // لا نكسر التشغيل الطبيعي بسبب تعذر التخزين المسبق.
    }
  } catch {
    return false
  }

  try {
    const controller = navigator.serviceWorker?.controller
    if (controller) {
      controller.postMessage({
        type: 'CACHE_AUDIO_URL',
        url: networkUrl,
      })
    }
  } catch {
    // Service Worker غير جاهز؛ التشغيل الشبكي يظل طبيعيًا.
  }

  return false
}

async function releaseCachedObjectUrl(
  audio: Samee3AudioElement | null,
) {
  const current = audio?.__samee3ObjectUrl
  if (!current) return

  try {
    URL.revokeObjectURL(current)
  } catch {
    // تجاهل تحرير URL في المتصفحات القديمة.
  }

  if (audio) audio.__samee3ObjectUrl = undefined
}

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

function getActiveAyahFromTimings(
  timings: AyahTiming[],
  currentTime: number,
): number | null {
  if (!timings.length || !Number.isFinite(currentTime)) return null

  for (let index = 0; index < timings.length; index += 1) {
    const current = timings[index]
    const start = Math.max(0, Number(current.start_time || 0)) / 1000
    const declaredEnd = Number(current.end_time)
    const nextStart =
      index < timings.length - 1
        ? Math.max(0, Number(timings[index + 1].start_time || 0)) / 1000
        : Number.POSITIVE_INFINITY
    const end = Number.isFinite(declaredEnd)
      ? Math.max(start, declaredEnd / 1000)
      : nextStart

    if (currentTime >= start && currentTime < Math.max(end, nextStart) + 0.08) {
      const ayah = Number(current.ayah || 0)
      return ayah > 0 ? ayah : null
    }
  }

  return null
}

function persistAudioSnapshotFromElement(
  audio: Samee3AudioElement,
  playingOverride?: boolean,
  pageOverride?: number,
) {
  const networkUrl =
    audio.__samee3NetworkUrl ||
    (audio.src && !audio.src.startsWith('blob:') ? audio.src : '')
  const surah = Number(audio.__samee3Surah || 0)
  if (!networkUrl || !surah) return

  const previous = readPersistentAudioState()
  const currentTime = Number.isFinite(audio.currentTime)
    ? Math.max(0, audio.currentTime)
    : previous?.currentTime ?? 0
  const activeAyah =
    getActiveAyahFromTimings(audio.__samee3Timings || [], currentTime) ??
    (Number(audio.__samee3CurrentAyah || 0) > 0
      ? Number(audio.__samee3CurrentAyah)
      : previous?.ayah ?? null)

  if (activeAyah) audio.__samee3CurrentAyah = activeAyah

  const page = clampPage(Number(pageOverride || audio.__samee3Page || previous?.page || 1))
  const playing = typeof playingOverride === 'boolean' ? playingOverride : !audio.paused
  const reciterId = Number(audio.__samee3ReciterId || previous?.reciterId || DEFAULT_RECITER_API_ID)
  const reciterName = audio.__samee3ReciterName || previous?.reciterName || DEFAULT_RECITER_NAME
  const riwaya = audio.__samee3Riwaya || previous?.riwaya || 'hafs'
  const moshafId = audio.__samee3MoshafId ?? previous?.moshafId ?? null

  writePersistentAudioState({
    networkUrl,
    surah,
    ayah: activeAyah,
    currentTime,
    playing,
    riwaya,
    reciterId,
    reciterName,
    moshafId,
    page,
    updatedAt: Date.now(),
  })

  writePersistentReadingState({
    page,
    surah,
    ayah: activeAyah,
    riwaya,
    reciterId,
    reciterName,
    moshafId,
    updatedAt: Date.now(),
  })
}

function nextContinuousSurah(currentSurah: number, preferredIds?: number[]): number {
  const source = (preferredIds?.length ? preferredIds : SURAH_LIST.map((item) => item.id))
    .filter((value, index, array) => Number.isInteger(value) && value >= 1 && value <= 114 && array.indexOf(value) === index)
    .sort((a, b) => a - b)

  if (!source.length) return 1
  return source.find((surah) => surah > currentSurah) ?? source[0] ?? 1
}

function extractServerFromNetworkUrl(networkUrl: string): string {
  return networkUrl.replace(/\/\d{3}\.mp3(?:[?#].*)?$/i, '')
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
  const reciterApiId = Number(searchParams.get('reciterId') || '0') || DEFAULT_RECITER_API_ID
  const requestedMoshafId = Number(searchParams.get('moshafId') || '0')
  const reciterName = searchParams.get('reciterName') || DEFAULT_RECITER_NAME
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
  const [tafsirBooks, setTafsirBooks] = useState<TafsirBook[]>(FALLBACK_TAFSIR_BOOKS)
  const [tafsirBooksLoading, setTafsirBooksLoading] = useState(false)
  const [selectedTafsirBookId, setSelectedTafsirBookId] = useState<number | null>(null)
  const [tafsirPickerOpen, setTafsirPickerOpen] = useState(false)
  const [selectedTafsirBook, setSelectedTafsirBook] = useState<TafsirBook | null>(null)
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
  const pointerStartedOnAyahRef = useRef(false)
  const pointerMovedRef = useRef(false)
  const suppressNextAyahClickRef = useRef(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [pageSettleX, setPageSettleX] = useState(0)
  const [pageDragX, setPageDragX] = useState(0)
  const [pageDragY, setPageDragY] = useState(0)
  const [isPageDragging, setIsPageDragging] = useState(false)
  const [pageTurnPhase, setPageTurnPhase] = useState<'idle' | 'dragging' | 'committing'>('idle')
  const [pageTurnProgress, setPageTurnProgress] = useState(0)
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev' | null>(null)
  const [pageTurnTarget, setPageTurnTarget] = useState<number | null>(null)
  const [turnPreview, setTurnPreview] = useState<{
    page: number
    data: PageData | null
    html: string
  } | null>(null)
  const [pageTurnBase, setPageTurnBase] = useState<{
    page: number
    data: PageData | null
    html: string
  } | null>(null)
  const turnPreviewRequestRef = useRef(0)
  const turnPreviewPageRef = useRef<number | null>(null)
  const pendingNavigationPageRef = useRef<number | null>(null)
  const [openPicker, setOpenPicker] = useState<'riwaya' | 'reciter' | 'surah' | 'juz' | null>(null)
  const pageTurnAudioContextRef = useRef<AudioContext | null>(null)
  const audioRestoreAttemptedRef = useRef(false)
  const readingRestoreAttemptedRef = useRef(false)
  const audioOperationRef = useRef(0)
  const audioToggleBusyRef = useRef(false)
  const mushafWarmupRunningRef = useRef(false)

  const pageMemoryCacheRef = useRef(new Map<string, PageData>())
  const svgMemoryCacheRef = useRef(new Map<string, string>())
  const ayahPageCacheRef = useRef(new Map<string, number>())
  const pageSyncInFlightRef = useRef(false)
  const lastPageSyncAyahRef = useRef('')

  // على الكمبيوتر وشاشات العرض نستخدم صفحة واحدة كبيرة فقط.
  // لا يوجد spread من صفحتين: الصفحة الحالية هي الصفحة الوحيدة المعروضة.
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
        const cache = await caches.open(SAMEE3_MUSHAF_PAGE_CACHE_NAME)
        await cache.put(url, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        }))
      }
    } catch {
      // لا نوقف القراءة بسبب فشل التخزين المؤقت.
    }

    return result
  }, [riwaya])

  const isAyahOnCurrentPage = useCallback((surahNumber: number, ayahNumber: number) => {
    if (!surahNumber || !ayahNumber || !pageData?.ayahs?.length) return false
    return pageData.ayahs.some(
      (item) =>
        Number(item.surah?.number) === Number(surahNumber) &&
        Number(item.numberInSurah) === Number(ayahNumber),
    )
  }, [pageData])

  const resolveAyahPage = useCallback(async (targetRiwaya: Riwaya, surahNumber: number, ayahNumber: number) => {
    if (!targetRiwaya || !surahNumber || !ayahNumber) return null

    const cacheKey = `${targetRiwaya}:${surahNumber}:${ayahNumber}`
    const cached = ayahPageCacheRef.current.get(cacheKey)
    if (cached) return cached

    if (targetRiwaya === riwaya) {
      const nearbyPages = Array.from(
        new Set([
          pageNumber,
          clampPage(pageNumber + 1),
          clampPage(pageNumber - 1),
          clampPage(pageNumber + 2),
          clampPage(pageNumber - 2),
        ]),
      )

      for (const candidatePage of nearbyPages) {
        try {
          const candidateData = await fetchPageData(candidatePage)
          const found = candidateData.ayahs.some(
            (item) =>
              Number(item.surah?.number) === Number(surahNumber) &&
              Number(item.numberInSurah) === Number(ayahNumber),
          )
          if (found) {
            ayahPageCacheRef.current.set(cacheKey, candidatePage)
            return candidatePage
          }
        } catch {
          // ننتقل للمصدر الدقيق.
        }
      }
    }

    try {
      const mushafId = RIWAYA_MUSHAF_IDS[targetRiwaya]
      const response = await fetch(
        `https://api.quranpedia.net/v1/mushafs/${mushafId}/${surahNumber}`,
        { cache: 'force-cache', headers: { Accept: 'application/json' } },
      )

      if (response.ok) {
        const payload = await response.json()
        const ayahs = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.ayahs)
            ? payload.ayahs
            : Array.isArray(payload?.data)
              ? payload.data
              : []

        const found =
          ayahs.find((item: any) =>
            Number(
              item?.numberInSurah ??
                item?.number_in_surah ??
                item?.ayah_number ??
                item?.ayah,
            ) === Number(ayahNumber),
          ) ||
          ayahs.find((item: any) => Number(item?.number) === Number(ayahNumber))

        const exactPage = Number(
          found?.page_number ??
            found?.page ??
            found?.pageNumber ??
            0,
        )

        if (exactPage > 0) {
          const safePage = clampPage(exactPage)
          ayahPageCacheRef.current.set(cacheKey, safePage)
          return safePage
        }
      }
    } catch {
      // عدم توفر المصدر الدقيق لا يجب أن يوقف الصوت.
    }

    return null
  }, [fetchPageData, pageData, pageNumber, riwaya])

  useEffect(() => {
    if (autoPageTargetRef.current === pageNumber) {
      autoPageTargetRef.current = null
    } else if (autoPageTargetRef.current !== null && !navigatingRef.current) {
      autoPageTargetRef.current = null
    }
  }, [pageNumber])

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
        const cache = await caches.open(SAMEE3_MUSHAF_PAGE_CACHE_NAME)
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
    const cache = 'caches' in window
      ? await caches.open(SAMEE3_MUSHAF_PAGE_CACHE_NAME).catch(() => null)
      : null

    let pageOk = false
    const pageUrl = `/api/quran?riwaya=${encodeURIComponent(targetRiwaya)}&page=${safePage}`

    try {
      if (cache) {
        const cached = await cache.match(pageUrl)
        if (cached) {
          const data = await cached.clone().json()
          const pageDataValue = {
            ayahs: Array.isArray(data?.ayahs)
              ? data.ayahs
              : Array.isArray(data?.data?.ayahs)
                ? data.data.ayahs
                : [],
          } as PageData
          if (pageDataValue.ayahs.length) {
            pageMemoryCacheRef.current.set(`${targetRiwaya}:${safePage}`, pageDataValue)
            pageOk = true
          }
        }
      }
    } catch {
      // نستمر إلى الشبكة.
    }

    if (!pageOk && navigator.onLine) {
      try {
        const response = await fetch(pageUrl, {
          cache: 'force-cache',
          headers: { Accept: 'application/json' },
        })
        if (response.ok) {
          const data = await response.clone().json()
          const pageDataValue = {
            ayahs: Array.isArray(data?.ayahs)
              ? data.ayahs
              : Array.isArray(data?.data?.ayahs)
                ? data.data.ayahs
                : [],
          } as PageData
          pageMemoryCacheRef.current.set(`${targetRiwaya}:${safePage}`, pageDataValue)
          pageOk = pageDataValue.ayahs.length > 0
          if (pageOk && cache) {
            await cache.put(pageUrl, response).catch(() => {})
          }
        }
      } catch {
        // الصفحة قد تكون محفوظة جزئيًا فقط؛ لا نوقف بقية التسخين.
      }
    }

    let svgOk = false
    const svgUrl = `/api/mushaf-svg?riwaya=${encodeURIComponent(targetRiwaya)}&page=${safePage}`

    try {
      if (cache) {
        const cachedSvg = await cache.match(svgUrl)
        if (cachedSvg) {
          const data = await cachedSvg.clone().json()
          if (data?.success && data?.svg) {
            svgMemoryCacheRef.current.set(`${targetRiwaya}:${safePage}`, String(data.svg))
            svgOk = true
          }
        }
      }
    } catch {
      // نستمر إلى الشبكة.
    }

    if (!svgOk && navigator.onLine) {
      try {
        const response = await fetch(svgUrl, { cache: 'force-cache' })
        if (response.ok) {
          const data = await response.clone().json()
          if (data?.success && data?.svg) {
            svgMemoryCacheRef.current.set(`${targetRiwaya}:${safePage}`, String(data.svg))
            svgOk = true
            if (cache) {
              await cache.put(svgUrl, response).catch(() => {})
            }
          }
        }
      } catch {
        // نترك الصفحة التي تم حفظها بالفعل بدون تعطيل بقية التسخين.
      }
    }

    return pageOk && svgOk
  }, [])

  // ============================================================
  // تسخين كامل للمصحف في الخلفية: 604 صفحة × كل الروايات
  // ============================================================
  // لا ننتظر هذه العملية قبل فتح الصفحة، ولا نعرض واجهة تحميل لها.
  // التخزين يتم في Cache Storage، والتقدم محفوظ لاستئناف العملية لاحقًا.
  useEffect(() => {
    let cancelled = false
    let resumeTimer: number | null = null

    const readWarmupState = (): Set<number> => {
      try {
        const raw = localStorage.getItem(SAMEE3_MUSHAF_WARMUP_STATE_KEY)
        if (!raw) return new Set<number>()
        const parsed = JSON.parse(raw) as { version?: number; completed?: unknown }
        if (parsed?.version !== 2 || !Array.isArray(parsed.completed)) {
          return new Set<number>()
        }
        return new Set(
          parsed.completed
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0),
        )
      } catch {
        return new Set<number>()
      }
    }

    const saveWarmupState = (completed: Set<number>, done = false) => {
      try {
        localStorage.setItem(
          SAMEE3_MUSHAF_WARMUP_STATE_KEY,
          JSON.stringify({
            version: 2,
            done,
            completed: Array.from(completed).sort((a, b) => a - b),
            updatedAt: Date.now(),
          }),
        )
      } catch {
        // Cache Storage هو المصدر الأساسي، فلا نوقف التحميل بسبب localStorage.
      }
    }

    const runWarmup = async () => {
      if (cancelled || !navigator.onLine || !('caches' in window) || mushafWarmupRunningRef.current) return
      mushafWarmupRunningRef.current = true

      const tasks: Array<{ riwaya: Riwaya; page: number }> = []
      for (const targetRiwaya of ALL_MUSHAF_RIWAYAT) {
        for (let page = 1; page <= 604; page += 1) {
          tasks.push({ riwaya: targetRiwaya, page })
        }
      }

      const completed = readWarmupState()
      if (completed.size >= tasks.length) {
        mushafWarmupRunningRef.current = false
        return
      }

      try {
        if (navigator.storage?.persist) {
          void navigator.storage.persist().catch(() => false)
        }
      } catch {
        // بعض المتصفحات لا تدعم persistent storage.
      }

      let cursor = 0
      let successfulSinceSave = 0
      const workerCount = Math.min(2, tasks.length)

      const worker = async () => {
        while (!cancelled && navigator.onLine) {
          let taskIndex = -1

          while (cursor < tasks.length) {
            const candidate = cursor
            cursor += 1
            if (!completed.has(candidate)) {
              taskIndex = candidate
              break
            }
          }

          if (taskIndex < 0) return

          const task = tasks[taskIndex]
          const ok = await prefetchRiwayaPage(task.riwaya, task.page)

          if (!ok) {
            if (navigator.onLine) {
              await new Promise((resolve) => window.setTimeout(resolve, 1500))
            }
            return
          }

          completed.add(taskIndex)
          successfulSinceSave += 1

          if (successfulSinceSave >= 4) {
            successfulSinceSave = 0
            saveWarmupState(completed)
          }

          // Yield قصير جدًا حتى لا يشعر المستخدم بأن المصحف أو الصوت يتجمّد.
          if (completed.size % 4 === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 0))
          }
        }
      }

      await Promise.all(Array.from({ length: workerCount }, () => worker()))
      saveWarmupState(completed, completed.size >= tasks.length)
      mushafWarmupRunningRef.current = false

      if (!cancelled && completed.size < tasks.length && navigator.onLine) {
        resumeTimer = window.setTimeout(() => {
          void runWarmup()
        }, 7000)
      }
    }

    const start = () => {
      if (cancelled) return
      window.setTimeout(() => void runWarmup(), 80)
    }

    window.addEventListener('online', start)
    start()

    return () => {
      cancelled = true
      mushafWarmupRunningRef.current = false
      if (resumeTimer !== null) window.clearTimeout(resumeTimer)
      window.removeEventListener('online', start)
    }
  }, [prefetchRiwayaPage])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const nearby = Array.from(new Set([
        pageNumber,
        clampPage(pageNumber + 1),
        clampPage(pageNumber - 1),
      ]))

      for (const page of nearby) {
        if (cancelled) return
        void prefetchRiwayaPage(riwaya, page)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [pageNumber, prefetchRiwayaPage, riwaya])

  useEffect(() => {
    if (!navigatingRef.current) return

    const pendingPage = pendingNavigationPageRef.current
    if (!pendingPage || pendingPage !== pageNumber) return
    if (!pageData?.ayahs?.length) return
    if (!svg && !(riwaya === 'sousi' || riwaya === 'bazzi')) return

    // الصفحة الجديدة أصبحت جاهزة فعلًا. نُدخلها مكان الصفحة المنتهية
    // في نفس الإطار ونزيل الصفحة السفلية بعدها، بدون رجوع للصفحة القديمة.
    const id = window.requestAnimationFrame(() => {
      setPageSettleX(0)
      setPageDragX(0)
      setPageDragY(0)
      setPageTurnPhase('idle')
      setPageTurnProgress(0)
      setPageTurnDirection(null)
      setPageTurnTarget(null)
      setTurnPreview(null)
      setPageTurnBase(null)
      turnPreviewPageRef.current = null
      pendingNavigationPageRef.current = null
      autoPageTargetRef.current = null
      navigatingRef.current = false
    })

    return () => window.cancelAnimationFrame(id)
  }, [pageData, pageNumber, riwaya, svg])

  useEffect(() => {
    let cancelled = false
    // لا نترك شاشة بيضاء أثناء انتظار بيانات الصفحة أو SVG، خصوصًا على
    // شاشات العرض/المتصفحات الأبطأ. الصفحة السابقة تبقى في الذاكرة أثناء
    // الانتقال، لكن عند أول فتح نعرض حالة تحميل واضحة بدل الفراغ.
    setLoading(true)
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
        if (!cancelled) setLoading(false)
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          setLoading(false)
          setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل المصحف')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [desktopLeftPage, desktopRightPage, fetchPageData, fetchSvg, isDesktop, pageNumber, riwaya])

  useEffect(() => {
    let cancelled = false
    const nearby = Array.from(
      new Set([clampPage(pageNumber + 1), clampPage(pageNumber - 1)]),
    )

    const warm = async () => {
      await Promise.all(
        nearby.map(async (targetPage) => {
          if (cancelled || targetPage === pageNumber) return
          await Promise.all([
            fetchPageData(targetPage).catch(() => null),
            fetchSvg(targetPage).catch(() => ''),
          ])
        }),
      )
    }

    void warm()

    return () => {
      cancelled = true
    }
  }, [fetchPageData, fetchSvg, pageNumber, riwaya])

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

  useEffect(() => {
    const sources = [pageData, rightPageData, leftPageData].filter(Boolean) as PageData[]
    const allAyahs = sources.flatMap((source) => source.ayahs)

    if (ayahFromUrl) {
      const parsed = parseQuranReference(ayahFromUrl)
      if (parsed) {
        const match = allAyahs.find(
          (item) =>
            Number(item.surah?.number) === Number(parsed.surah) &&
            Number(item.numberInSurah) === Number(parsed.ayah),
        )
        if (match) setPlayingAyahNumber(match.number)
      }
      return
    }

    // فتح السورة من الفهرس بدون آية محددة يعني بدء التلاوة من أول آية،
    // ولا نسمح للـHighlight القديم بالبقاء أثناء تحميل الصوت الجديد.
    if (autoplayRequested && requestedSurah) {
      setPlayingAyahNumber(null)
    }
  }, [ayahFromUrl, autoplayRequested, leftPageData, pageData, requestedSurah, rightPageData])

  const highlightSearchedAyah = useCallback(() => {
    const artContainers = Array.from(
      document.querySelectorAll<HTMLElement>('.samee3-page-art'),
    )

    const visibleSources = [pageData, rightPageData, leftPageData].filter(Boolean) as PageData[]
    const targetNumber = playingAyahNumber

    const visiblePlayingAyah =
      targetNumber !== null
        ? visibleSources
            .flatMap((source) => source.ayahs)
            .find((item) => Number(item.number) === Number(targetNumber)) || null
        : null

    const getNodeAyahInfo = (node: Element, sheetSurah: number) => {
      const rawKey = String(
        node.getAttribute('data-ayah') ||
          node.getAttribute('ayah') ||
          '',
      ).trim()

      let keySurah = 0
      let keyAyah = 0
      if (rawKey.includes(':')) {
        const [a, b] = rawKey.split(':')
        keySurah = Number(a) || 0
        keyAyah = Number(b) || 0
      } else if (/^\d+$/.test(rawKey)) {
        keyAyah = Number(rawKey)
      }

      const nodeSurah = Number(
        node.getAttribute('surah') ||
          node.getAttribute('data-surah') ||
          keySurah ||
          sheetSurah ||
          0,
      )

      const nodeGlobalAyah = Number(
        node.getAttribute('data-global-ayah') || 0,
      )

      const nodeLocalAyah = Number(
        node.getAttribute('data-ayah-number') ||
          node.getAttribute('data-local-ayah') ||
          keyAyah ||
          0,
      )

      return { nodeSurah, nodeGlobalAyah, nodeLocalAyah }
    }

    artContainers.forEach((art) => {
      const nodes = Array.from(
        art.querySelectorAll<SVGElement>(
          '.ayahPolygon, .samee3-text-ayah, .samee3-ayah, .samee3-ayah-hit, [data-ayah], [data-ayah-number]',
        ),
      )

      nodes.forEach((node) => {
        node.classList.remove(
          'samee3-pressed-ayah',
          'samee3-playing-ayah',
        )

        node.style.removeProperty('fill')
        node.style.removeProperty('fill-opacity')
        node.style.removeProperty('stroke')
        node.style.removeProperty('stroke-opacity')
        node.style.removeProperty('stroke-width')
        node.style.removeProperty('filter')
        node.style.removeProperty('background')
        node.style.removeProperty('box-shadow')

        const sheet = node.closest('.samee3-page-sheet') as HTMLElement | null
        const sheetSurah = Number(sheet?.dataset.surahNumber || 0)
        const { nodeSurah, nodeGlobalAyah, nodeLocalAyah } = getNodeAyahInfo(
          node,
          sheetSurah,
        )

        const matchesAyah = (item: Ayah | null | undefined) => {
          if (!item) return false
          const itemSurah = Number(item.surah?.number || 0)
          const itemGlobal = Number(item.number || 0)
          const itemLocal = Number(item.numberInSurah || 0)
          const surahMatches = !nodeSurah || nodeSurah === itemSurah

          return (
            surahMatches &&
            ((nodeGlobalAyah > 0 && nodeGlobalAyah === itemGlobal) ||
              (nodeLocalAyah > 0 && nodeLocalAyah === itemLocal))
          )
        }

        const playingMatch = Boolean(
          playingAyahNumber !== null &&
            matchesAyah(visiblePlayingAyah),
        )

        const pressedMatch =
          pressedAyahNumber !== null &&
          Boolean(selectedAyah) &&
          Number(selectedAyah?.numberInSurah) === Number(pressedAyahNumber) &&
          matchesAyah(selectedAyah)

        if (pressedMatch) {
          node.classList.add('samee3-pressed-ayah')
        }

        if (!playingMatch || !visiblePlayingAyah) return

        node.classList.add('samee3-playing-ayah')

        // التظليل البصري للـSVG المطبوع يتم على مسار الآية نفسه.
        // لا نضيف مستطيلاً خارجيًا ولا shadow أسفل السطر.
        if (node.classList.contains('ayahPolygon') || node.classList.contains('samee3-ayah')) {
          node.style.setProperty('fill', '#c5a36a', 'important')
          node.style.setProperty('fill-opacity', '0.14', 'important')
          node.style.setProperty('stroke', '#c5a36a', 'important')
          node.style.setProperty('stroke-opacity', '0.08', 'important')
          node.style.setProperty('stroke-width', '0.8', 'important')
        } else if (node.tagName.toLowerCase() === 'tspan') {
          node.style.setProperty('fill', '#765f3f', 'important')
          node.style.setProperty('fill-opacity', '1', 'important')
        }
      })
    })
  }, [leftPageData, pageData, playingAyahNumber, pressedAyahNumber, rightPageData, selectedAyah])

  useEffect(() => {
    const timer = window.setTimeout(highlightSearchedAyah, 40)
    const onLayout = () => highlightSearchedAyah()
    window.addEventListener('resize', onLayout, { passive: true })
    window.addEventListener('scroll', onLayout, { passive: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout)
    }
  }, [highlightSearchedAyah, svg, leftSvg, selectedAyah, playingAyahNumber, pageNumber])



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
    // لو كان هذا click ناتجًا عن سحب صفحة، لا نفتحه كاختيار آية.
    if (suppressNextAyahClickRef.current) {
      suppressNextAyahClickRef.current = false
      return
    }

    const target = event.target as Element | null
    if (!target) return

    let ayahElement: Element | null = target.closest(
      '.ayahPolygon, .samee3-ayah-hit, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah',
    )

    // بعض متصفحات شاشات العرض قد ترجع عنصر SVG الجذر بدل مسار الآية،
    // خصوصًا مع <image> داخل SVG. لذلك نحدد الآية أسفل مؤشر الماوس
    // من bounding boxes لمسارات الآيات كخطة احتياطية.
    if (!ayahElement) {
      const current = event.currentTarget as HTMLElement
      const x = event.clientX
      const y = event.clientY
      const candidates = Array.from(
        current.querySelectorAll<SVGElement>(
          '.ayahPolygon, .samee3-ayah-hit, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah',
        ),
      )

      let best: SVGElement | null = null
      let bestArea = Number.POSITIVE_INFINITY

      for (const candidate of candidates) {
        const rect = candidate.getBoundingClientRect()
        if (rect.width <= 1 || rect.height <= 1) continue
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue

        const area = rect.width * rect.height
        if (area < bestArea) {
          best = candidate
          bestArea = area
        }
      }

      ayahElement = best
    }

    if (!ayahElement) return

    event.stopPropagation()
    const found = resolveSelectedAyahFromElement(ayahElement, sourceData)
    if (!found) return

    setSelectedAyah(found)
    setShowAyahActions(true)

    try {
      const saved = JSON.parse(localStorage.getItem('samee3_bookmarks') || '[]')
      setIsSaved(
        Array.isArray(saved) &&
          saved.some(
            (item: { number?: number }) =>
              item?.number === found.number,
          ),
      )
    } catch {
      setIsSaved(false)
    }
  }, [resolveSelectedAyahFromElement])

  const handleAyahPointerDown = useCallback((event: React.PointerEvent<HTMLElement>, sourceData: PageData | null) => {
    const target = event.target as Element | null
    if (!target) return

    let ayahElement: Element | null = target.closest(
      '.ayahPolygon, .samee3-ayah-hit, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah',
    )

    if (!ayahElement) {
      const current = event.currentTarget as HTMLElement
      const x = event.clientX
      const y = event.clientY
      let best: SVGElement | null = null
      let bestArea = Number.POSITIVE_INFINITY

      const candidates = Array.from(
        current.querySelectorAll<SVGElement>(
          '.ayahPolygon, .samee3-ayah-hit, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah',
        ),
      )

      for (const candidate of candidates) {
        const rect = candidate.getBoundingClientRect()
        if (rect.width <= 1 || rect.height <= 1) continue
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
        const area = rect.width * rect.height
        if (area < bestArea) {
          best = candidate
          bestArea = area
        }
      }

      ayahElement = best
    }

    if (!ayahElement) {
      setPressedAyahNumber(null)
      return
    }

    const found = resolveSelectedAyahFromElement(ayahElement, sourceData)
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

  const prepareTurnPreview = useCallback(async (targetPage: number) => {
    const safePage = clampPage(targetPage)
    const requestId = ++turnPreviewRequestRef.current

    try {
      const [data, rawSvg] = await Promise.all([
        fetchPageData(safePage),
        fetchSvg(safePage),
      ])

      if (requestId !== turnPreviewRequestRef.current) return null

      const html =
        (riwaya === 'sousi' || riwaya === 'bazzi') && data?.ayahs?.length
          ? buildTextMushafSvg(data, riwaya)
          : rawSvg

      if (!html) return null

      const preview = {
        page: safePage,
        data,
        html,
      }

      setTurnPreview(preview)
      return preview
    } catch {
      return null
    }
  }, [fetchPageData, fetchSvg, riwaya])

  const resetPageTurnState = useCallback(() => {
    setPageSettleX(0)
    setPageDragX(0)
    setPageDragY(0)
    setIsPageDragging(false)
    setPageTurnPhase('idle')
    setPageTurnProgress(0)
    setPageTurnDirection(null)
    setPageTurnTarget(null)
    setTurnPreview(null)
    setPageTurnBase(null)
    turnPreviewPageRef.current = null
    pendingNavigationPageRef.current = null
    navigatingRef.current = false
  }, [])

  const navigateTo = useCallback((
    page: number,
    extra?: { surah?: number; ayah?: string; clearJuz?: boolean },
    direction: 'next' | 'prev' = 'next',
  ) => {
    const nextPage = clampPage(page)

    if (navigatingRef.current) return

    if (
      nextPage === pageNumber &&
      !extra?.ayah &&
      !extra?.surah
    ) {
      return
    }

    const run = async () => {
      const audio = audioRef.current as Samee3AudioElement | null

      if (
        audio?.__samee3NetworkUrl &&
        audio.__samee3Surah
      ) {
        const previous = readPersistentAudioState()

        writePersistentAudioState({
          networkUrl: audio.__samee3NetworkUrl,
          surah: Number(audio.__samee3Surah),
          ayah: previous?.ayah ?? null,
          currentTime: Number.isFinite(audio.currentTime)
            ? Math.max(0, audio.currentTime)
            : previous?.currentTime ?? 0,
          playing: !audio.paused,
          riwaya:
            audio.__samee3Riwaya ||
            previous?.riwaya ||
            'hafs',
          reciterId: Number(
            audio.__samee3ReciterId ||
            previous?.reciterId ||
            DEFAULT_RECITER_API_ID,
          ),
          reciterName:
            audio.__samee3ReciterName ||
            previous?.reciterName ||
            DEFAULT_RECITER_NAME,
          moshafId:
            audio.__samee3MoshafId ??
            previous?.moshafId ??
            null,
          page: pageNumber,
          updatedAt: Date.now(),
        })

        audio.__samee3Page = pageNumber
      }

      navigatingRef.current = true
      pendingNavigationPageRef.current = nextPage

      /*
       * نأخذ لقطة ثابتة من الصفحة الحالية قبل أي تغيير في الـURL.
       * هذه النقطة تمنع ظهور:
       * الصفحة التالية ← الصفحة الحالية ← الصفحة التالية
       * لأن طبقة التقليب لن تعتمد بعد ذلك على pageNumber المتغير.
       */
      setPageTurnBase({
        page: pageNumber,
        data: pageData,
        html: mainDisplayedSvg,
      })

      const existingPreview =
        turnPreview?.page === nextPage
          ? turnPreview
          : null

      const preview =
        existingPreview ||
        await prepareTurnPreview(nextPage)

      if (
        !preview ||
        preview.page !== nextPage
      ) {
        resetPageTurnState()
        return
      }

      setTurnPreview(preview)
      setPageTurnDirection(direction)
      setPageTurnTarget(nextPage)
      setPageTurnPhase('committing')

      const committedStartProgress = Math.max(
        0,
        Math.min(0.94, pageTurnProgress),
      )

      setPageTurnProgress(
        committedStartProgress,
      )
      setIsPageDragging(false)
      setPageDragX(0)
      setPageDragY(0)
      setPageSettleX(0)

      /*
       * تكملة الحركة من نفس مكان إصبع المستخدم.
       * لا يوجد رجوع للصفحة الحالية ولا إعادة ظهور لها.
       */
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setPageTurnProgress(1)
        })
      })

      const params = new URLSearchParams(
        searchParams.toString(),
      )

      params.set(
        'page',
        String(nextPage),
      )

      if (extra?.surah) {
        params.set(
          'surah',
          String(extra.surah),
        )
      }

      if (extra?.ayah) {
        params.set(
          'ayah',
          extra.ayah,
        )
      } else {
        params.delete('ayah')
      }

      if (extra?.clearJuz) {
        params.delete('juz')
        params.delete('juzStart')
        params.delete('juzEnd')
      }

      /*
       * نغيّر الـURL بعد اكتمال حركة الصورة،
       * وليس أثناءها، حتى لا تدخل صفحة Next.js الجديدة
       * في منتصف الأنيميشن.
       */
      const remaining =
        Math.max(
          260,
          Math.round(
            380 * (1 - committedStartProgress),
          ),
        )

      window.setTimeout(() => {
        if (
          pendingNavigationPageRef.current !==
          nextPage
        ) {
          return
        }

        router.replace(
          `/mushaf?${params.toString()}`,
        )
      }, remaining + 20)

      /*
       * لا نمسح اللقطة القديمة إلا عندما تصبح الصفحة
       * الجديدة فعلًا هي pageData/svg الحالية.
       * هذا يمنع أي فلاش أو رجوع للصفحة السابقة.
       */
      window.setTimeout(() => {
        if (
          pendingNavigationPageRef.current !==
          nextPage
        ) {
          return
        }

        if (pageNumber === nextPage) {
          return
        }

        /*
         * في حالة لم يتم تحديث الـURL بسبب تنقل خارجي،
         * لا نترك حالة تقليب معلقة.
         */
        resetPageTurnState()
      }, 1500)
    }

    void run()
  }, [
    mainDisplayedSvg,
    pageData,
    pageNumber,
    pageTurnProgress,
    prepareTurnPreview,
    resetPageTurnState,
    router,
    searchParams,
    turnPreview,
  ])

  /*
   * التقليب بالماوس/اللمس باستخدام Pointer Events.
   * الاتجاه البصري الجديد: التقليب من اليسار إلى اليمين.
   * سحب لليمين = الصفحة التالية.
   * سحب لليسار = الصفحة السابقة.
   * الحركة صفحة كاملة وبسيطة، والصفحة الهدف تكون أسفلها أثناء الحركة.
   */
  const beginPagePointer = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const target = event.target as Element | null
      if (!target) return

      if (
        target.closest(
          'button, select, input, textarea, a, .samee3-top-controls, .samee3-bottom-shell, .samee3-reader-toggle, .samee3-ayah-overlay, .samee3-image-preview-overlay, .samee3-picker-menu, .samee3-search-results-overlay',
        )
      ) {
        pointerStartX.current = null
        pointerStartY.current = null
        pointerIdRef.current = null
        pointerStartedOnAyahRef.current = false
        pointerMovedRef.current = false
        setIsPageDragging(false)
        return
      }

      const ayahTarget = target.closest(
        '.ayahPolygon, .samee3-ayah-hit, [data-ayah], [data-ayah-number], .samee3-text-ayah, .samee3-ayah',
      )

      pointerStartedOnAyahRef.current = Boolean(ayahTarget)
      pointerMovedRef.current = false
      suppressNextAyahClickRef.current = false

      pointerStartX.current = event.clientX
      pointerStartY.current = event.clientY
      pointerIdRef.current = event.pointerId
      setIsPageDragging(false)
      setPageDragX(0)
      setPageDragY(0)
      setPageSettleX(0)

      /*
       * لا نستخدم pointer capture عندما يبدأ اللمس فوق آية.
       * هذا يحافظ على click/tap الطبيعي للآية حتى تظهر لوحة الخيارات،
       * وفي الوقت نفسه نستطيع اكتشاف السحب إذا تجاوز المستخدم حد الحركة.
       */
      if (!ayahTarget) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
      }
    },
    [],
  )

  const movePagePointer = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        pointerIdRef.current === null ||
        event.pointerId !== pointerIdRef.current ||
        pointerStartX.current === null ||
        pointerStartY.current === null
      ) {
        return
      }

      const deltaX = event.clientX - pointerStartX.current
      const deltaY = event.clientY - pointerStartY.current
      const horizontal = Math.abs(deltaX)
      const vertical = Math.abs(deltaY)

      // مسافة صغيرة جدًا = tap، وليس سحبًا.
      if (!pointerMovedRef.current) {
        if (horizontal < 10 && vertical < 10) return
        pointerMovedRef.current = true
      }

      if (horizontal > vertical + 6 && horizontal > 10) {
        event.preventDefault()

        const maxDrag = Math.min(window.innerWidth * 0.98, 900)
        const limitedX = Math.max(-maxDrag, Math.min(maxDrag, deltaX))

        const basePage = isDesktop ? desktopRightPage : pageNumber
        const targetPage = deltaX > 0
          ? clampPage(basePage + 1)
          : clampPage(basePage - 1)
        const turnProgress = Math.min(1, Math.max(0, Math.abs(limitedX) / Math.max(1, window.innerWidth * 0.78)))
        const turnDirection = deltaX > 0 ? 'next' : 'prev'

        setIsPageDragging(true)
        setPageTurnPhase('dragging')
        setPageDragX(limitedX)
        setPageDragY(0)
        setPageTurnProgress(turnProgress)
        setPageTurnDirection(turnDirection)
        setPageTurnTarget(targetPage)

        /*
         * لقطة ثابتة للصفحة الحالية.
         * أهم شيء أن هذه اللقطة لا تتغير عندما يتغير الـURL.
         */
        if (!pageTurnBase) {
          setPageTurnBase({
            page: basePage,
            data: pageData,
            html: mainDisplayedSvg,
          })
        }

        if (
          targetPage !== basePage &&
          turnPreviewPageRef.current !== targetPage
        ) {
          turnPreviewPageRef.current = targetPage
          void prepareTurnPreview(targetPage)
        }
      }
    },
    [
      desktopRightPage,
      isDesktop,
      mainDisplayedSvg,
      pageData,
      pageNumber,
      pageTurnBase,
      prepareTurnPreview,
    ],
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

      const deltaX = event.clientX - pointerStartX.current
      const deltaY = event.clientY - pointerStartY.current
      const basePage = isDesktop ? desktopRightPage : pageNumber

      const horizontalDistance = Math.abs(deltaX)
      const verticalDistance = Math.abs(deltaY)
      const threshold = Math.min(120, Math.max(48, window.innerWidth * 0.12))
      const isHorizontalSwipe =
        horizontalDistance >= threshold &&
        horizontalDistance > verticalDistance * 1.12

      const pointerWasAyah = pointerStartedOnAyahRef.current
      const pointerMoved = pointerMovedRef.current

      pointerStartX.current = null
      pointerStartY.current = null
      pointerIdRef.current = null
      pointerStartedOnAyahRef.current = false
      pointerMovedRef.current = false

      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {}

      if (!isHorizontalSwipe) {
        resetPageTurnState()
        return
      }

      suppressNextAyahClickRef.current = pointerWasAyah && pointerMoved

      const direction = deltaX > 0 ? 'next' : 'prev'
      const targetPage = deltaX > 0
        ? clampPage(basePage + 1)
        : clampPage(basePage - 1)

      if (targetPage === basePage) {
        setPageDragX(0)
        setIsPageDragging(false)
        setPageTurnPhase('idle')
        setPageTurnProgress(0)
        setPageTurnDirection(null)
        setPageTurnTarget(null)
        return
      }

      navigateTo(
        targetPage,
        undefined,
        direction,
      )
    },
    [
      desktopRightPage,
      isDesktop,
      navigateTo,
      pageNumber,
      resetPageTurnState,
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
      pointerStartedOnAyahRef.current = false
      pointerMovedRef.current = false
      suppressNextAyahClickRef.current = false
      setIsPageDragging(false)
      setPageDragX(0)
      setPageDragY(0)
      setPageSettleX(0)
      setPageTurnPhase('idle')
      setPageTurnProgress(0)
      setPageTurnDirection(null)
      setPageTurnTarget(null)
      setTurnPreview(null)
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
    const explicit = reciters.find((item) => item.apiId === selectedReciterId)
    const defaultReciter = reciters.find((item) => item.apiId === DEFAULT_RECITER_API_ID)
    return current || explicit || defaultReciter || reciters[0] || null
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

    const preferred =
      loaded.find((item) => item.apiId === DEFAULT_RECITER_API_ID) ||
      loaded.find((item) => item.apiId === selectedReciterId) ||
      loaded[0] ||
      null
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

  const handleJuzSelect = async (juzNumber: number) => {
    const juz = JUZ_LIST.find((item) => item.number === juzNumber)
    if (!juz) return

    setOpenPicker(null)
    setRepeatAyahNumber(null)
    setAudioError('')

    let activeReciter = selectedReciter

    if (!activeReciter) {
      const loaded = await fetchReciters(riwaya)
      activeReciter =
        loaded.find((item) => item.apiId === selectedReciterId) ||
        loaded.find((item) => item.apiId === DEFAULT_RECITER_API_ID) ||
        loaded[0] ||
        null

      if (activeReciter) {
        setReciters(loaded)
        setSelectedReciterId(activeReciter.apiId)
      }
    }

    if (!activeReciter) {
      triggerToast('تعذر تحديد القارئ المختار الآن.')
      return
    }

    if (activeReciter.surahIds.length > 0 && !activeReciter.surahIds.includes(juz.start.surah)) {
      triggerToast(
        `القارئ ${activeReciter.label} لا يملك سورة ${SURAH_LIST.find((item) => item.id === juz.start.surah)?.name || ''} ضمن الملفات المتاحة.`,
      )
      return
    }

    triggerToast(`جاري فتح الجزء ${arabicNumber(juz.number)}...`)

    const exactPage = await resolveAyahPage(
      riwaya,
      juz.start.surah,
      juz.start.ayah,
    )

    const fallbackPage =
      SURAH_LIST.find((item) => item.id === juz.start.surah)?.page || 1
    const targetPage = exactPage || fallbackPage

    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(targetPage))
    params.set('surah', String(juz.start.surah))
    params.set('ayah', `${juz.start.surah}:${juz.start.ayah}`)
    params.set('juz', String(juz.number))
    params.set('juzStart', `${juz.start.surah}:${juz.start.ayah}`)
    params.set('juzEnd', `${juz.end.surah}:${juz.end.ayah}`)
    params.set('riwaya', riwaya)
    params.set('reciterId', String(activeReciter.apiId))
    params.set('reciterName', activeReciter.label)
    if (activeReciter.moshafId != null) {
      params.set('moshafId', String(activeReciter.moshafId))
    } else {
      params.delete('moshafId')
    }
    params.set('autoplay', '1')

    router.push(`/mushaf?${params.toString()}`)

    await loadAudioForSurah(
      juz.start.surah,
      true,
      juz.start.ayah,
      activeReciter,
    )
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

    const cachedTimings = readCachedAyahTimings(surahNumber, readId)
    if (cachedTimings.length) {
      ayahTimingsRef.current = cachedTimings
    }

    if (isBrowserOffline()) {
      return cachedTimings
    }

    try {
      const timingResponse = await fetch(
        `https://mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${encodeURIComponent(String(readId))}`,
        { cache: 'no-store' },
      )

      if (!timingResponse.ok) {
        return cachedTimings
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

      if (timings.length) {
        writeCachedAyahTimings(surahNumber, readId, timings)
        ayahTimingsRef.current = timings
        return timings
      }

      return cachedTimings
    } catch {
      return cachedTimings
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

    playCompletionTone()
    triggerToast(message)
  }, [playCompletionTone, triggerToast])

  useEffect(() => {
    juzCompletedGuardRef.current = false
  }, [activeJuzNumber])

  const updatePlayingAyahFromTime = useCallback((currentTime: number) => {
    const timings = ayahTimingsRef.current
    if (!timings.length) {
      setPlayingAyahNumber((previous) => (previous === null ? previous : null))
      return
    }

    let active: AyahTiming | null = null
    for (let index = 0; index < timings.length; index += 1) {
      const current = timings[index]
      const start = Math.max(0, Number(current.start_time || 0)) / 1000
      const declaredEnd = Number(current.end_time)
      const nextStart =
        index < timings.length - 1
          ? Math.max(0, Number(timings[index + 1].start_time || 0)) / 1000
          : Number.POSITIVE_INFINITY
      const end = Number.isFinite(declaredEnd)
        ? Math.max(start, declaredEnd / 1000)
        : nextStart

      // نستخدم نهاية التوقيت إن وجدت، وإلا بداية الآية التالية.
      // هامش 80ms يمنع اختفاء التظليل في الفواصل الصغيرة بين المقاطع.
      const effectiveEnd = Math.max(end, nextStart)
      if (currentTime >= start && currentTime < effectiveEnd + 0.08) {
        active = current
        break
      }
    }

    if (!active || !Number.isFinite(Number(active.ayah))) {
      return
    }

    const audio = audioRef.current as Samee3AudioElement | null
    if (audio) {
      audio.__samee3CurrentAyah = Number(active.ayah)
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
      setPlayingAyahNumber((previous) =>
        previous === visibleAyah.number ? previous : visibleAyah.number,
      )
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

    const operationId = ++audioOperationRef.current
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

      const audio = audioRef.current as Samee3AudioElement | null
      if (!audio) return

      const cachedSource = await getCachedAudioSource(networkUrl)
      if (operationId !== audioOperationRef.current) return

      if (cachedSource) {
        await releaseCachedObjectUrl(audio)
        finalUrl = cachedSource.src
        audio.__samee3ObjectUrl = cachedSource.objectUrl || undefined
      } else if (isBrowserOffline()) {
        setAudioError('السورة غير محفوظة للاستماع بدون إنترنت. شغّلها مرة واحدة أثناء الاتصال لحفظها تلقائيًا.')
        triggerToast('هذه السورة غير محفوظة بعد للاستماع بدون إنترنت.')
        setAudioLoading(false)
        return
      }

      audio.__samee3NetworkUrl = networkUrl
      audio.__samee3Surah = surahNumber
      audio.__samee3Riwaya = riwaya
      audio.__samee3ReciterId = activeReciter?.apiId || reciterApiId
      audio.__samee3ReciterName = activeReciter?.label || reciterName
      audio.__samee3MoshafId = activeReciter?.moshafId ?? null
      audio.__samee3Page = pageNumber
      audio.__samee3Server = String(server).replace(/\/$/, '')
      audio.__samee3SurahIds = Array.isArray(activeReciter?.surahIds)
        ? [...activeReciter.surahIds]
        : []

      const timingsPromise = loadAyahTimings(
        surahNumber,
        activeReciter?.apiId || reciterApiId,
      )

      const immediateCachedTimings = readCachedAyahTimings(
        surahNumber,
        activeReciter?.apiId || reciterApiId,
      )

      const timings: AyahTiming[] = immediateCachedTimings.length
        ? immediateCachedTimings
        : await Promise.race([
            timingsPromise,
            new Promise<AyahTiming[]>((resolve) =>
              window.setTimeout(() => resolve([]), 900),
            ),
          ])

      if (operationId !== audioOperationRef.current) return

      const fallbackFirstAyah = timings.find(
        (item: AyahTiming) => Number(item.ayah) > 0,
      )?.ayah
      const effectiveTargetAyah =
        targetAyahNumber ||
        (shouldPlay && Number(fallbackFirstAyah) > 0 ? Number(fallbackFirstAyah) : undefined)

      const targetStart =
        findTimingStart(timings, effectiveTargetAyah) ??
        (Number.isFinite(Number(fallbackStartSeconds)) ? Number(fallbackStartSeconds) : 0)

      if (operationId !== audioOperationRef.current) return

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

          window.setTimeout(done, 1800)
        })
      }

      if (operationId !== audioOperationRef.current) return

      audio.__samee3Timings = timings
      audio.__samee3CurrentAyah = effectiveTargetAyah

      setPlayingAyahNumber(
        effectiveTargetAyah
          ? (
              [pageData, rightPageData, leftPageData]
                .filter(Boolean)
                .flatMap((source) => (source as PageData).ayahs)
                .find(
                  (item) =>
                    Number(item.surah?.number) === surahNumber &&
                    Number(item.numberInSurah) === Number(effectiveTargetAyah),
                )?.number ?? null
            )
          : null,
      )

      writePersistentAudioState({
        networkUrl,
        surah: surahNumber,
        ayah: effectiveTargetAyah ? Number(effectiveTargetAyah) : null,
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
        try {
          await audio.play()
        } catch (playError) {
          if (operationId !== audioOperationRef.current) return
          console.error(playError)
          setIsPlaying(false)
          const message = playError instanceof Error ? playError.message : ''
          if (/not allowed|not supported|user agent/i.test(message)) {
            setAudioError('')
            triggerToast('اضغط تشغيل لبدء التلاوة.')
          } else {
            setAudioError('تعذر بدء التلاوة. اضغط تشغيل مرة أخرى.')
          }
        }
      }

      // لا نؤخر بداية التلاوة بسبب التحميل إلى Offline cache.
      // التخزين يتم في الخلفية بعد بدء التشغيل.
      if (!cachedSource) {
        void cacheAudioForOffline(networkUrl)
      }

      // نجهز السورة التالية مسبقًا حتى تستمر التلاوة حتى بدون إنترنت.
      const preferredIds = activeReciter?.surahIds?.length
        ? activeReciter.surahIds
        : SURAH_LIST.map((item) => item.id)
      const nextSurah = nextContinuousSurah(surahNumber, preferredIds)
      if (nextSurah !== surahNumber) {
        const nextUrl = `${String(server).replace(/\/$/, '')}/${String(nextSurah).padStart(3, '0')}.mp3`
        void cacheAudioForOffline(nextUrl)
      }
    } catch (error) {
      if (operationId !== audioOperationRef.current) return
      console.error(error)
      const message = error instanceof Error ? error.message : ''
      if (/not allowed|not supported|operation is not supported|user agent/i.test(message)) {
        setAudioError('')
        triggerToast('اضغط تشغيل لبدء التلاوة.')
      } else {
        setAudioError('تعذر تشغيل التلاوة حاليًا.')
      }
    } finally {
      if (operationId === audioOperationRef.current) {
        setAudioLoading(false)
      }
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
    isAyahOnCurrentPage,
    resolveAyahPage,
    notifyJuzCompleted,
    navigateTo,
    triggerToast,
    updateRouteAudioSelection,
  }

  useEffect(() => {
    const win = window as Window & {
      __samee3AudioRuntimeRef?: { current: AudioRuntime | null }
    }
    win.__samee3AudioRuntimeRef = audioRuntimeRef
    return () => {
      if (win.__samee3AudioRuntimeRef === audioRuntimeRef) {
        win.__samee3AudioRuntimeRef = undefined
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      const context = pageTurnAudioContextRef.current
      pageTurnAudioContextRef.current = null
      if (context) void context.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const win = window as Window & {
      __samee3PersistentAudio?: Samee3AudioElement
      __samee3AudioRuntimeRef?: { current: AudioRuntime | null }
    }

    const audio = (win.__samee3PersistentAudio || new Audio()) as Samee3AudioElement
    win.__samee3PersistentAudio = audio
    audioRef.current = audio
    audio.preload = 'auto'

    const getRuntime = () => win.__samee3AudioRuntimeRef?.current || null

    /*
     * هذه الأحداث تتثبت مرة واحدة على عنصر الصوت العام، ولا نحذفها عند
     * مغادرة /mushaf. لذلك تبقى التلاوة حية خارج المصحف، ويحترم الصوت
     * أزرار التشغيل والإيقاف في مشغل الهاتف، وتنتقل السورة تلقائيًا.
     */
    if (!audio.__samee3PersistentHandlersInstalled) {
      const persistentPlay = () => {
        persistAudioSnapshotFromElement(audio, true)
        const networkUrl = audio.__samee3NetworkUrl || ''
        if (networkUrl) void cacheAudioForOffline(networkUrl)
      }

      const persistentPause = () => {
        persistAudioSnapshotFromElement(audio, false)
      }

      const persistentTimeUpdate = () => {
        const now = Date.now()
        if (now - Number(audio.__samee3LastPersist || 0) < 900) return
        audio.__samee3LastPersist = now
        const activeAyah = getActiveAyahFromTimings(
          audio.__samee3Timings || [],
          audio.currentTime,
        )
        if (activeAyah) audio.__samee3CurrentAyah = activeAyah
        persistAudioSnapshotFromElement(audio, !audio.paused)
      }

      const persistentEnded = () => {
        const runtime = getRuntime()

        // التكرار الصريح للآية يظل أعلى أولوية.
        if (runtime && runtime.repeatAyahNumber !== null && ayahTimingsRef.current.length) {
          const repeatStart = runtime.findTimingStart(
            ayahTimingsRef.current,
            runtime.repeatAyahNumber,
          )
          if (repeatStart !== null) {
            audio.currentTime = repeatStart
            audio.__samee3CurrentAyah = runtime.repeatAyahNumber
            persistAudioSnapshotFromElement(audio, true)
            void audio.play().catch(() => {})
            return
          }
        }

        const finishedSurah = Number(audio.__samee3Surah || 0)
        if (!finishedSurah) return

        const fallbackReciter: LocalReciter | null = audio.__samee3ReciterId
          ? {
              id: `${audio.__samee3ReciterId}-${audio.__samee3MoshafId ?? 'default'}`,
              apiId: Number(audio.__samee3ReciterId),
              label: audio.__samee3ReciterName || DEFAULT_RECITER_NAME,
              moshafId: audio.__samee3MoshafId ?? null,
              server: audio.__samee3Server || extractServerFromNetworkUrl(audio.__samee3NetworkUrl || ''),
              surahIds: audio.__samee3SurahIds || [],
            }
          : null

        const activeReciter = runtime?.selectedReciter || fallbackReciter
        const runtimeIds = runtime?.availableSurahs.map((item) => item.id) || []
        const preferredIds = runtimeIds.length
          ? runtimeIds
          : (audio.__samee3SurahIds || [])
        const nextSurah = nextContinuousSurah(finishedSurah, preferredIds)
        const nextPage = SURAH_LIST.find((item) => item.id === nextSurah)?.page || 1

        if (runtime) {
          setPlayingAyahNumber(null)
          runtime.updateRouteAudioSelection(
            runtime.riwaya,
            activeReciter,
            nextSurah,
          )
          void runtime.loadAudioForSurah(
            nextSurah,
            true,
            undefined,
            activeReciter,
          )
          return
        }

        // وضع التشغيل المستمر خارج المصحف: لا توجد حاجة لوجود React.
        const server =
          audio.__samee3Server ||
          extractServerFromNetworkUrl(audio.__samee3NetworkUrl || audio.src || '')
        if (!server) return

        const nextUrl = `${server.replace(/\/$/, '')}/${String(nextSurah).padStart(3, '0')}.mp3`
        audio.pause()
        audio.__samee3NetworkUrl = nextUrl
        audio.__samee3Surah = nextSurah
        audio.__samee3Page = nextPage
        audio.__samee3CurrentAyah = 1
        audio.__samee3Server = server.replace(/\/$/, '')
        audio.__samee3Timings = []

        const playNextCached = async () => {
          const cachedSource = await getCachedAudioSource(nextUrl)

          if (!cachedSource && isBrowserOffline()) {
            persistAudioSnapshotFromElement(audio, false, nextPage)
            return
          }

          await releaseCachedObjectUrl(audio)

          const sourceUrl = cachedSource?.src || nextUrl
          audio.__samee3ObjectUrl = cachedSource?.objectUrl || undefined
          audio.src = sourceUrl
          audio.preload = 'auto'
          audio.load()
          persistAudioSnapshotFromElement(audio, true, nextPage)

          const cachedTimings = readCachedAyahTimings(
            nextSurah,
            Number(audio.__samee3ReciterId || DEFAULT_RECITER_API_ID),
          )
          if (cachedTimings.length) {
            audio.__samee3Timings = cachedTimings
          }

          void cacheAudioForOffline(nextUrl)
          void audio.play().catch(() => {})

          if (!isBrowserOffline()) {
            void fetch(
              `https://mp3quran.net/api/v3/ayat_timing?surah=${nextSurah}&read=${encodeURIComponent(String(audio.__samee3ReciterId || DEFAULT_RECITER_API_ID))}`,
              { cache: 'no-store' },
            ).then(async (response) => {
              if (!response.ok) return
              const payload = await response.json()
              const raw = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.ayat_timing)
                  ? payload.ayat_timing
                  : Array.isArray(payload?.data)
                    ? payload.data
                    : []
              const timings = raw
                .map((item: any) => ({
                  ayah: Number(item?.ayah ?? item?.ayah_number ?? item?.number ?? 0),
                  start_time: Number(item?.start_time ?? item?.start ?? 0),
                  end_time: Number(item?.end_time ?? item?.end ?? 0),
                }))
                .filter(
                  (item: AyahTiming) =>
                    Number(item.ayah) > 0 &&
                    Number.isFinite(Number(item.start_time)),
                )
                .sort(
                  (a: AyahTiming, b: AyahTiming) =>
                    Number(a.start_time) - Number(b.start_time),
                )
              if (timings.length) {
                writeCachedAyahTimings(
                  nextSurah,
                  Number(audio.__samee3ReciterId || DEFAULT_RECITER_API_ID),
                  timings,
                )
                audio.__samee3Timings = timings
              }
            }).catch(() => {})
          }
        }

        void playNextCached()
      }

      audio.addEventListener('play', persistentPlay)
      audio.addEventListener('pause', persistentPause)
      audio.addEventListener('timeupdate', persistentTimeUpdate)
      audio.addEventListener('ended', persistentEnded)
      audio.__samee3PersistentHandlersInstalled = true
    }

    const onPlay = () => {
      setIsPlaying(true)
    }

    const onPause = () => {
      setIsPlaying(false)
    }

    const onTimeUpdate = () => {
      const runtime = getRuntime()
      if (!runtime) return

      runtime.updatePlayingAyahFromTime(audio.currentTime)

      /*
       * لا نستخدم عناصر الصفحة المرئية هنا. الصفحة التالية تكون موجودة
       * تحت الحالية في أنيميشن التقليب، ولذلك كان فحص الـDOM القديم يمنع
       * الانتقال أحيانًا. المصدر الآن هو بيانات الصفحة الحالية + mapping
       * دقيق للسورة والآية.
       */
      if (
        !audio.paused &&
        !navigatingRef.current &&
        ayahTimingsRef.current.length
      ) {
        const activeLocalAyah = getActiveAyahFromTimings(
          ayahTimingsRef.current,
          audio.currentTime,
        )
        const currentSurah = Number(audioSurahRef.current || 0)

        if (activeLocalAyah && currentSurah) {
          audio.__samee3CurrentAyah = activeLocalAyah

          const activeKey = `${runtime.riwaya}:${currentSurah}:${activeLocalAyah}`
          const onCurrentPage = runtime.isAyahOnCurrentPage(
            currentSurah,
            activeLocalAyah,
          )

          if (onCurrentPage) {
            lastPageSyncAyahRef.current = ''
            if (audio.__samee3Page !== runtime.pageNumber) {
              audio.__samee3Page = runtime.pageNumber
              persistAudioSnapshotFromElement(audio, true, runtime.pageNumber)
            }
          } else if (
            !pageSyncInFlightRef.current &&
            lastPageSyncAyahRef.current !== activeKey
          ) {
            lastPageSyncAyahRef.current = activeKey
            pageSyncInFlightRef.current = true

            void runtime.resolveAyahPage(
              runtime.riwaya,
              currentSurah,
              activeLocalAyah,
            ).then((targetPage) => {
              const currentRuntime = getRuntime()
              if (!currentRuntime || !targetPage) {
                lastPageSyncAyahRef.current = ''
                return
              }

              const stillCurrentAyah =
                getActiveAyahFromTimings(
                  ayahTimingsRef.current,
                  audio.currentTime,
                ) === activeLocalAyah &&
                Number(audioSurahRef.current || 0) === currentSurah

              if (!stillCurrentAyah) {
                lastPageSyncAyahRef.current = ''
                return
              }

              if (targetPage === currentRuntime.pageNumber) {
                lastPageSyncAyahRef.current = ''
                return
              }

              const direction = targetPage > currentRuntime.pageNumber ? 'next' : 'prev'
              autoPageTargetRef.current = targetPage
              audio.__samee3Page = targetPage
              audio.__samee3CurrentAyah = activeLocalAyah
              persistAudioSnapshotFromElement(audio, true, targetPage)

              currentRuntime.navigateTo(
                targetPage,
                undefined,
                direction,
              )
            }).finally(() => {
              pageSyncInFlightRef.current = false
            })
          }
        }
      }
    }

    const onLoadedMetadata = () => {
      if (audio.currentTime < 0) audio.currentTime = 0
    }

    const onError = () => {
      setIsPlaying(false)
      setAudioError('')
      getRuntime()?.triggerToast(
        'تعذر تحميل ملف التلاوة لهذا القارئ أو السورة.',
      )
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('error', onError)

    const persistOnDocumentExit = () => {
      persistAudioSnapshotFromElement(audio, !audio.paused)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistAudioSnapshotFromElement(audio, !audio.paused)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', persistOnDocumentExit)
    window.addEventListener('beforeunload', persistOnDocumentExit)

    setIsPlaying(!audio.paused)

    return () => {
      persistAudioSnapshotFromElement(audio, !audio.paused)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('error', onError)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', persistOnDocumentExit)
      window.removeEventListener('beforeunload', persistOnDocumentExit)

      // لا نُوقف الصوت ولا نحذف الـpersistent listeners ولا نلغي blob URL؛
      // عنصر Audio نفسه يعيش على window ويكمل التلاوة خارج المصحف.
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

    const explicitNewPlayback = searchParams.get('autoplay') === '1'
    const sameLoadedAudio =
      audio.__samee3NetworkUrl === saved.networkUrl &&
      !!audio.src

    audio.__samee3NetworkUrl = saved.networkUrl
    audio.__samee3Surah = saved.surah
    audio.__samee3Riwaya = saved.riwaya
    audio.__samee3ReciterId = saved.reciterId || DEFAULT_RECITER_API_ID
    audio.__samee3ReciterName = saved.reciterName || DEFAULT_RECITER_NAME
    audio.__samee3MoshafId = saved.moshafId
    audio.__samee3Page = saved.page
    audio.__samee3CurrentAyah = saved.ayah
    audio.__samee3Server = extractServerFromNetworkUrl(saved.networkUrl)

    const restoreAudioSource = async () => {
      if (sameLoadedAudio) return true

      const cachedSource = await getCachedAudioSource(saved.networkUrl)
      if (!cachedSource && isBrowserOffline()) {
        setAudioError('التلاوة المحفوظة غير متاحة بالكامل بدون اتصال على هذا الجهاز.')
        setAudioDisplayUrl(saved.networkUrl)
        return false
      }

      await releaseCachedObjectUrl(audio)
      const sourceUrl = cachedSource?.src || saved.networkUrl
      audio.__samee3ObjectUrl = cachedSource?.objectUrl || undefined
      audio.src = sourceUrl
      audio.load()
      return true
    }

    const restorePosition = () => {
      try {
        if (!sameLoadedAudio && saved.currentTime > 0) {
          audio.currentTime = saved.currentTime
        }
      } catch {
        // نبقي الموضع الذي استطاع المتصفح استعادته.
      }
    }

    const restorePromise = restoreAudioSource()

    if (audio.readyState >= 1) restorePosition()
    else if (!sameLoadedAudio) {
      audio.addEventListener('loadedmetadata', restorePosition, { once: true })
    }

    setAudioDisplayUrl(saved.networkUrl)
    setSelectedReciterId(
      searchParams.get('reciterId')
        ? reciterApiId
        : saved.reciterId || DEFAULT_RECITER_API_ID,
    )

    void loadAyahTimings(
      saved.surah,
      saved.reciterId || DEFAULT_RECITER_API_ID,
    ).then(async (timings: AyahTiming[]) => {
      audio.__samee3Timings = timings

      const liveAyah = sameLoadedAudio && !audio.paused
        ? getActiveAyahFromTimings(timings, audio.currentTime)
        : null
      const targetAyah = liveAyah || saved.ayah || null

      if (targetAyah) {
        audio.__samee3CurrentAyah = Number(targetAyah)
        const visible = [pageData, rightPageData, leftPageData]
          .filter(Boolean)
          .flatMap((source) => (source as PageData).ayahs)
        const match = visible.find(
          (item) =>
            Number(item.surah?.number) === Number(saved.surah) &&
            Number(item.numberInSurah) === Number(targetAyah),
        )
        if (match) setPlayingAyahNumber(match.number)
      }

      if (!explicitNewPlayback && targetAyah) {
        const exactPage = await resolveAyahPage(
          saved.riwaya,
          saved.surah,
          Number(targetAyah),
        )

        if (exactPage) {
          audio.__samee3Page = exactPage
          persistAudioSnapshotFromElement(audio, !audio.paused, exactPage)

          const params = new URLSearchParams(searchParams.toString())
          params.set('page', String(exactPage))
          params.set('riwaya', saved.riwaya)
          if (saved.reciterId) params.set('reciterId', String(saved.reciterId))
          if (saved.reciterName) params.set('reciterName', saved.reciterName)
          if (saved.moshafId) params.set('moshafId', String(saved.moshafId))
          params.set('surah', String(saved.surah))
          params.set('ayah', `${saved.surah}:${targetAyah}`)
          params.set('autoplay', '0')

          const currentTarget = `/mushaf?${params.toString()}`
          const currentPath = `/mushaf?${searchParams.toString()}`
          if (currentPath !== currentTarget) router.replace(currentTarget)
        }
      }
    }).catch(() => {})

    // حالة عنصر Audio الحالية أهم من localStorage عند العودة لنفس العنصر.
    // هذا يمنع الضغط على إيقاف من مشغل الهاتف من التحول إلى تشغيل تلقائي قديم.
    setIsPlaying(!audio.paused)
    void restorePromise.then((ready) => {
      if (!ready) return
      setAudioDisplayUrl(saved.networkUrl)
      if (saved.playing && audio.paused && !sameLoadedAudio) {
        void audio.play().catch(() => {})
      }
    })
  }, [
    leftPageData,
    loadAyahTimings,
    pageData,
    reciterApiId,
    resolveAyahPage,
    rightPageData,
    router,
    searchParams,
  ])


  useEffect(() => {
    const saved = readPersistentAudioState()
    if (!saved || !pageData?.ayahs?.length) return

    // audioRef يحمل HTMLAudioElement افتراضيًا، لذلك نستخدم النوع الموسع
    // الذي يحتوي على بيانات المصحف المحفوظة على عنصر الصوت نفسه.
    const audio = audioRef.current as Samee3AudioElement | null
    if (Number(audio?.__samee3Surah || 0) !== Number(saved.surah)) return
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
    if (!audio?.__samee3NetworkUrl || !audio.__samee3Surah) {
      persistReadingPosition(pageNumber)
      return
    }

    const liveAyah = Number(audio.__samee3CurrentAyah || 0)
    const liveSurah = Number(audio.__samee3Surah || 0)
    const audioBelongsToThisPage =
      liveSurah > 0 &&
      liveAyah > 0 &&
      isAyahOnCurrentPage(liveSurah, liveAyah)

    if (audioBelongsToThisPage) {
      audio.__samee3Page = pageNumber
      persistAudioSnapshotFromElement(audio, !audio.paused, pageNumber)
    } else if (!audio.paused) {
      // أثناء التشغيل تظل صفحة القارئ الحقيقية هي المرجع؛ لا نستبدلها
      // بصفحة انتقل إليها المستخدم يدويًا بعيدًا عن الآية الحالية.
      persistAudioSnapshotFromElement(audio, true, audio.__samee3Page)
    } else {
      persistReadingPosition(pageNumber)
    }
  }, [isAyahOnCurrentPage, pageNumber, persistReadingPosition])

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
    if (audioToggleBusyRef.current) return
    audioToggleBusyRef.current = true

    try {
      const audio = audioRef.current

      const selectedSurah = selectedAyah?.surah?.number
        ? Number(selectedAyah.surah.number)
        : 0

      const selectedLocalAyah = selectedAyah?.numberInSurah
        ? Number(selectedAyah.numberInSurah)
        : 0

      const selectedAyahGlobalNumber = selectedAyah?.number ?? null

      if (selectedSurah && selectedLocalAyah) {
        const loadedSurah = Number(audioSurahRef.current || 0)
        const mustSeekToSelectedAyah =
          !audio ||
          !audio.src ||
          loadedSurah !== selectedSurah ||
          playingAyahNumber === null ||
          (selectedAyahGlobalNumber !== null && playingAyahNumber !== selectedAyahGlobalNumber)

        if (mustSeekToSelectedAyah) {
          await loadAudioForSurah(
            selectedSurah,
            true,
            selectedLocalAyah,
          )
          return
        }
      }

      if (!audio || !audio.src) {
        await loadAudioForCurrentSurah(true)
        return
      }

      if (audio.paused) {
        try {
          await audio.play()
        } catch (error) {
          console.error(error)
          setIsPlaying(false)
          setAudioError('تعذر بدء التلاوة. اضغط تشغيل مرة أخرى.')
        }
      } else {
        audio.pause()
      }
    } finally {
      audioToggleBusyRef.current = false
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


  const loadTafsirBooks = useCallback(async (surahNumber: number) => {
    if (!surahNumber) return FALLBACK_TAFSIR_BOOKS

    setTafsirBooksLoading(true)
    try {
      const response = await fetch(
        `/api/tafsir?mode=books&surah=${encodeURIComponent(String(surahNumber))}`,
        { cache: 'no-store', headers: { Accept: 'application/json' } },
      )

      const payload = await response.json().catch(() => null)
      const remoteBooks = Array.isArray(payload?.books)
        ? payload.books
            .map((book: Partial<TafsirBook>) => ({
              id: Number(book.id),
              name: String(book.name || '').trim(),
              short_name: String(book.short_name || '').trim(),
              author: String(book.author || '').trim(),
            }))
            .filter(
              (book: TafsirBook) =>
                Number.isInteger(book.id) &&
                book.id > 0 &&
                book.name,
            )
        : []

      const books = remoteBooks.length ? remoteBooks : FALLBACK_TAFSIR_BOOKS
      setTafsirBooks(books)
      return books
    } catch {
      setTafsirBooks(FALLBACK_TAFSIR_BOOKS)
      return FALLBACK_TAFSIR_BOOKS
    } finally {
      setTafsirBooksLoading(false)
    }
  }, [])

  const fetchTafsir = useCallback(async (ayah: Ayah, bookId?: number): Promise<string> => {
    if (!ayah.surah?.number) return 'لم يتوفر التفسير الآن.'

    const resolvedBookId =
      Number.isInteger(bookId) && Number(bookId) > 0
        ? Number(bookId)
        : Number(selectedTafsirBookId || 2012)

    setTafsirLoading(true)
    setTafsirText('')

    try {
      const response = await fetch(
        `/api/tafsir?mode=ayah&surah=${encodeURIComponent(String(ayah.surah.number))}&ayah=${encodeURIComponent(String(ayah.numberInSurah))}&book=${encodeURIComponent(String(resolvedBookId))}`,
        { cache: 'no-store', headers: { Accept: 'application/json' } },
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.success === false || !String(payload?.text || '').trim()) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'تعذر تحميل التفسير.',
        )
      }

      const text = String(payload.text).trim()
      const remoteBook = payload?.tafsirBook && typeof payload.tafsirBook === 'object'
        ? payload.tafsirBook
        : null
      const book =
        tafsirBooks.find((item) => item.id === resolvedBookId) ||
        (remoteBook
          ? {
              id: resolvedBookId,
              name: String(remoteBook.name || 'التفسير'),
              short_name: String(remoteBook.short_name || ''),
              author: String(remoteBook.author || ''),
            }
          : null)

      setSelectedTafsirBookId(resolvedBookId)
      if (book) setSelectedTafsirBook(book)
      setTafsirText(text)
      return text
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تحميل التفسير الآن.'
      setTafsirText(message || 'تعذر تحميل التفسير الآن.')
      return message || 'تعذر تحميل التفسير الآن.'
    } finally {
      setTafsirLoading(false)
    }
  }, [selectedTafsirBookId, tafsirBooks])

  const openTafsirChooser = useCallback(async () => {
    if (!selectedAyah?.surah?.number) return

    setShowAyahActions(true)
    setTafsirPickerOpen(true)
    setTafsirText('')
    setSelectedTafsirBook(null)
    await loadTafsirBooks(Number(selectedAyah.surah.number))
  }, [loadTafsirBooks, selectedAyah])

  const chooseTafsirBook = useCallback(async (book: TafsirBook) => {
    if (!selectedAyah?.surah?.number) return
    setSelectedTafsirBookId(book.id)
    setSelectedTafsirBook(book)
    setTafsirPickerOpen(false)
    await fetchTafsir(selectedAyah, book.id)
  }, [fetchTafsir, selectedAyah])


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
      let imageTafsirBook: TafsirBook | null = selectedTafsirBook

      if (withTafsir) {
        const requestedBookId = selectedTafsirBookId || 2012
        if (!interpretation || selectedTafsirBookId !== requestedBookId) {
          interpretation = await fetchTafsir(selectedAyah, requestedBookId)
        }

        imageTafsirBook =
          tafsirBooks.find((book) => book.id === requestedBookId) ||
          FALLBACK_TAFSIR_BOOKS.find((book) => book.id === requestedBookId) ||
          selectedTafsirBook ||
          null
      }

      try {
        await document.fonts?.ready
      } catch {
        // بعض المتصفحات لا تدعم document.fonts.
      }

      const canvas = document.createElement('canvas')
      const width = 1440
      const outerX = 52
      const cardX = 78
      const cardWidth = width - cardX * 2
      const contentWidth = 1120
      const centerX = width / 2
      const ayahText = selectedAyah.text.trim()

      /*
       * تصميمان متناسقان:
       * 1) الآية فقط: بطاقة تحريرية هادئة وراقية قابلة للمشاركة.
       * 2) الآية + التفسير: صفحة قراءة مصغرة بتدرج هرمي واضح للنص.
       */
      const ayahLayout = fitArabicLines(
        canvas,
        ayahText,
        '"Amiri Quran", "Amiri", serif',
        withTafsir ? 82 : 96,
        withTafsir ? 40 : 46,
        contentWidth,
        withTafsir ? 8 : 9,
      )

      const tafsirLayout = withTafsir
        ? fitArabicLines(
            canvas,
            interpretation || 'لم يتوفر التفسير الآن.',
            '"Amiri", "Tajawal", sans-serif',
            39,
            24,
            contentWidth,
            11,
          )
        : null

      const ayahHeight = ayahLayout.lines.length * ayahLayout.lineHeight
      const tafsirHeight = tafsirLayout
        ? tafsirLayout.lines.length * tafsirLayout.lineHeight
        : 0

      const ayahBlockTop = withTafsir ? 360 : 350
      const tafsirBlockTop = ayahBlockTop + ayahHeight + (withTafsir ? 110 : 0)
      const tafsirBottom = tafsirLayout
        ? tafsirBlockTop + tafsirHeight + 156
        : 0

      const targetHeight = withTafsir
        ? Math.min(2500, Math.max(1420, tafsirBottom))
        : Math.min(1360, Math.max(980, ayahBlockTop + ayahHeight + 250))

      canvas.width = width
      canvas.height = targetHeight

      const context = canvas.getContext('2d')
      if (!context) {
        triggerToast('تعذر إنشاء الصورة.')
        return
      }

      const palette = {
        ink: '#17202b',
        muted: '#6f7884',
        gold: '#b98a45',
        goldSoft: '#d6b77a',
        cream: '#fbf8f0',
        cream2: '#f4efe5',
        navy: '#0d1722',
        navy2: '#172536',
        white: '#fffdfa',
      }

      const roundedRect = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
      ) => {
        const radius = Math.min(r, w / 2, h / 2)
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.arcTo(x + w, y, x + w, y + h, radius)
        ctx.arcTo(x + w, y + h, x, y + h, radius)
        ctx.arcTo(x, y + h, x, y, radius)
        ctx.arcTo(x, y, x + w, y, radius)
        ctx.closePath()
      }

      const drawDiamond = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        fill: string,
        stroke: string,
      ) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = fill
        ctx.strokeStyle = stroke
        ctx.lineWidth = 2
        roundedRect(ctx, -size / 2, -size / 2, size, size, 5)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }

      // =========================
      // خلفية حديثة داكنة
      // =========================
      const background = context.createLinearGradient(0, 0, width, targetHeight)
      background.addColorStop(0, palette.navy)
      background.addColorStop(0.45, '#101e2d')
      background.addColorStop(1, '#0a121c')
      context.fillStyle = background
      context.fillRect(0, 0, width, targetHeight)

      const topGlow = context.createRadialGradient(centerX, 120, 30, centerX, 120, 620)
      topGlow.addColorStop(0, 'rgba(214,183,122,.20)')
      topGlow.addColorStop(0.42, 'rgba(185,138,69,.07)')
      topGlow.addColorStop(1, 'rgba(185,138,69,0)')
      context.fillStyle = topGlow
      context.fillRect(0, 0, width, 360)

      const bottomGlow = context.createRadialGradient(centerX, targetHeight - 60, 10, centerX, targetHeight - 60, 520)
      bottomGlow.addColorStop(0, 'rgba(255,255,255,.06)')
      bottomGlow.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = bottomGlow
      context.fillRect(0, targetHeight - 260, width, 260)

      // إطار خارجي فائق الخفة.
      context.strokeStyle = 'rgba(214,183,122,.30)'
      context.lineWidth = 1.5
      roundedRect(context, outerX, outerX, width - outerX * 2, targetHeight - outerX * 2, 38)
      context.stroke()

      // =========================
      // رأس التصميم
      // =========================
      context.textAlign = 'center'
      try { context.direction = 'rtl' } catch {}

      context.fillStyle = 'rgba(251,248,240,.74)'
      context.font = '600 22px "Tajawal", sans-serif'
      context.fillText('مَصْحَف سَمِيع', centerX, 108)

      context.fillStyle = palette.goldSoft
      context.font = '500 17px "Tajawal", sans-serif'
      context.fillText('القرآن الكريم', centerX, 138)

      // فاصل زخرفي صغير بدل الإطار التقليدي.
      context.strokeStyle = 'rgba(214,183,122,.36)'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(centerX - 190, 178)
      context.lineTo(centerX - 26, 178)
      context.moveTo(centerX + 26, 178)
      context.lineTo(centerX + 190, 178)
      context.stroke()
      drawDiamond(context, centerX, 178, 15, '#b98a45', '#e0c797')

      // عنوان السورة والمرجع.
      context.fillStyle = palette.white
      context.font = '700 62px "Aref Ruqaa", "Amiri", serif'
      context.fillText(`سورة ${getSurahName(selectedAyah.surah?.number)}`, centerX, 246)

      const referenceText = `الآية ${arabicNumber(selectedAyah.numberInSurah)}`
      context.font = '600 22px "Tajawal", sans-serif'
      context.fillStyle = 'rgba(255,253,250,.74)'
      context.fillText(referenceText, centerX, 286)

      // =========================
      // بطاقة الآية
      // =========================
      context.save()
      context.shadowColor = 'rgba(0,0,0,.28)'
      context.shadowBlur = 38
      context.shadowOffsetY = 16
      roundedRect(context, cardX, 318, cardWidth, withTafsir ? ayahHeight + 92 : ayahHeight + 118, 34)
      context.fillStyle = palette.cream
      context.fill()
      context.restore()

      context.strokeStyle = 'rgba(185,138,69,.28)'
      context.lineWidth = 1.5
      roundedRect(context, cardX, 318, cardWidth, withTafsir ? ayahHeight + 92 : ayahHeight + 118, 34)
      context.stroke()

      // شريط ذهبي دقيق على حافة البطاقة.
      context.fillStyle = palette.gold
      roundedRect(context, cardX + 32, 342, 4, withTafsir ? ayahHeight + 44 : ayahHeight + 70, 2)
      context.fill()

      // رقم الآية داخل كبسولة حديثة.
      const badgeWidth = 106
      const badgeX = centerX - badgeWidth / 2
      roundedRect(context, badgeX, 346, badgeWidth, 42, 21)
      context.fillStyle = 'rgba(185,138,69,.11)'
      context.fill()
      context.strokeStyle = 'rgba(185,138,69,.36)'
      context.lineWidth = 1
      context.stroke()
      context.fillStyle = '#86652f'
      context.font = '700 22px "Tajawal", sans-serif'
      context.fillText(referenceText, centerX, 374)

      drawFittedArabicLines(
        context,
        ayahLayout,
        centerX,
        ayahBlockTop,
        palette.ink,
      )

      if (tafsirLayout) {
        // =========================
        // قسم التفسير — تصميم تحريري حديث
        // =========================
        const tafsirHeaderY = ayahBlockTop + ayahHeight + 78
        const tafsirCardTop = tafsirHeaderY + 52
        const tafsirCardHeight = tafsirHeight + 86

        context.strokeStyle = 'rgba(185,138,69,.26)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(cardX + 76, tafsirHeaderY)
        context.lineTo(width - cardX - 76, tafsirHeaderY)
        context.stroke()

        context.fillStyle = palette.goldSoft
        context.font = '700 24px "Tajawal", sans-serif'
        context.fillText('التفسير', centerX, tafsirHeaderY + 34)

        context.save()
        context.shadowColor = 'rgba(0,0,0,.24)'
        context.shadowBlur = 26
        context.shadowOffsetY = 10
        roundedRect(context, cardX, tafsirCardTop, cardWidth, tafsirCardHeight, 30)
        context.fillStyle = 'rgba(251,248,240,.975)'
        context.fill()
        context.restore()

        context.strokeStyle = 'rgba(185,138,69,.22)'
        context.lineWidth = 1.2
        roundedRect(context, cardX, tafsirCardTop, cardWidth, tafsirCardHeight, 30)
        context.stroke()

        const tafsirLabel =
          imageTafsirBook?.short_name ||
          imageTafsirBook?.name ||
          'التفسير الميسر'
        const tafsirAuthor = imageTafsirBook?.author || ''

        context.textAlign = 'right'
        context.fillStyle = '#69512d'
        context.font = '700 28px "Tajawal", sans-serif'
        context.fillText(tafsirLabel, width - cardX - 58, tafsirCardTop + 52)

        if (tafsirAuthor) {
          context.fillStyle = '#8a9097'
          context.font = '500 17px "Tajawal", sans-serif'
          context.fillText(tafsirAuthor, width - cardX - 58, tafsirCardTop + 80)
        }

        context.textAlign = 'center'
        drawFittedArabicLines(
          context,
          tafsirLayout,
          centerX,
          tafsirCardTop + 122,
          '#47515d',
        )
      }

      // =========================
      // التوقيع السفلي
      // =========================
      const footerY = targetHeight - 78
      context.textAlign = 'center'
      context.fillStyle = 'rgba(251,248,240,.62)'
      context.font = '500 17px "Tajawal", sans-serif'
      context.fillText(
        `مصحف سميع  •  ${getSurahName(selectedAyah.surah?.number)}  •  ${referenceText}`,
        centerX,
        footerY,
      )

      context.fillStyle = 'rgba(214,183,122,.56)'
      context.font = '500 14px "Tajawal", sans-serif'
      context.fillText(
        withTafsir
          ? `نص الآية مع ${imageTafsirBook?.short_name || imageTafsirBook?.name || 'التفسير'}`
          : 'مشاركة الآية من مصحف سميع',
        centerX,
        footerY + 26,
      )

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
      onPointerMove={movePagePointer}
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

        <div className={`samee3-spread ${isDesktop ? 'is-desktop' : 'is-mobile'} ${isPageDragging ? 'is-dragging' : ''}`}>
          <div className="samee3-turn-stack">
            {(() => {
              const hasPreview =
                pageTurnTarget !== null &&
                turnPreview?.page === pageTurnTarget

              const active =
                pageTurnPhase !== 'idle' &&
                pageTurnDirection !== null &&
                pageTurnTarget !== null &&
                !!pageTurnBase &&
                hasPreview

              const progress = active
                ? Math.min(
                    1,
                    Math.max(
                      0,
                      pageTurnProgress,
                    ),
                  )
                : 0

              const direction =
                pageTurnDirection || 'next'

              /*
               * الاتجاه المطلوب:
               * سحب لليمين = الصفحة التالية.
               * لذلك الصفحة الحالية تخرج لليمين،
               * وتظل الصفحة التالية ثابتة أسفلها.
               */
              const isNext =
                direction === 'next'

              const currentX =
                isNext
                  ? 100 * progress
                  : -100 * progress

              const transition =
                pageTurnPhase === 'dragging'
                  ? 'none'
                  : 'transform 380ms cubic-bezier(.22,.75,.22,1)'

              const basePage =
                pageTurnBase?.page ??
                pageNumber

              const baseData =
                pageTurnBase?.data ??
                pageData

              const baseHtml =
                pageTurnBase?.html ??
                mainDisplayedSvg

              const baseMeta =
                pageMeta(
                  baseData,
                  basePage,
                  baseData?.ayahs?.[0]?.surah?.number ||
                    currentSurahNumber,
                )

              return (
                <div
                  className={`samee3-page-turn-layer ${
                    active
                      ? 'is-active'
                      : ''
                  }`}
                  aria-hidden={
                    active
                      ? 'true'
                      : undefined
                  }
                >
                  {active ? (
                    <div
                      className="samee3-turn-target"
                      aria-hidden="true"
                    >
                      <MushafPageSheet
                        page={
                          turnPreview?.page ||
                          pageTurnTarget ||
                          pageNumber
                        }
                        data={
                          turnPreview?.data ||
                          null
                        }
                        html={
                          turnPreview?.html ||
                          ''
                        }
                        side="single"
                        meta={pageMeta(
                          turnPreview?.data ||
                            null,
                          turnPreview?.page ||
                            pageTurnTarget ||
                            pageNumber,
                        )}
                        onAyahClick={() =>
                          undefined
                        }
                        onAyahPointerDown={() =>
                          undefined
                        }
                        onAyahPointerUp={() =>
                          undefined
                        }
                      />
                    </div>
                  ) : null}

                  <div
                    className="samee3-turn-current"
                    style={{
                      pointerEvents:
                        active
                          ? 'none'
                          : 'auto',
                      transform:
                        active
                          ? `translate3d(${currentX.toFixed(
                              3,
                            )}%,0,0)`
                          : 'translate3d(0,0,0)',
                      transition,
                      willChange:
                        active
                          ? 'transform'
                          : 'auto',
                    }}
                  >
                    <MushafPageSheet
                      page={basePage}
                      data={baseData}
                      html={baseHtml}
                      side="single"
                      meta={baseMeta}
                      onAyahClick={
                        handleAyahClick
                      }
                      onAyahPointerDown={
                        handleAyahPointerDown
                      }
                      onAyahPointerUp={
                        handleAyahPointerUp
                      }
                    />
                  </div>
                </div>
              )
            })()}
          </div>
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
                    <strong>{selectedReciter?.label || reciterName || DEFAULT_RECITER_NAME}</strong>
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

                <div className={`samee3-picker ${openPicker === 'juz' ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="samee3-picker-trigger"
                    onClick={() => setOpenPicker(openPicker === 'juz' ? null : 'juz')}
                  >
                    <span>الجزء</span>
                    <strong>
                      {activeJuzNumber
                        ? `الجزء ${arabicNumber(activeJuzNumber)}`
                        : currentJuz
                          ? `الجزء ${arabicNumber(currentJuz)}`
                          : 'اختر الجزء'}
                    </strong>
                    <ChevronDown size={16} />
                  </button>
                  {openPicker === 'juz' ? (
                    <div
                      className="samee3-picker-menu samee3-picker-menu-juz"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {JUZ_LIST.map((item) => (
                        <button
                          key={item.number}
                          type="button"
                          className={
                            (activeJuzNumber || currentJuz) === item.number
                              ? 'is-selected'
                              : ''
                          }
                          onClick={() => void handleJuzSelect(item.number)}
                        >
                          <span>الجزء {arabicNumber(item.number)}</span>
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
              <button type="button" className={tafsirPickerOpen || tafsirLoading || tafsirText ? 'saved' : ''} onClick={() => void openTafsirChooser()}><Sparkles size={19} /><span>التفسير</span></button>
              <button type="button" className={isSaved ? 'saved' : ''} onClick={bookmarkAyah}><Bookmark size={19} /><span>{isSaved ? 'محفوظة' : 'الحفظ'}</span></button>
            </div>

            {tafsirPickerOpen ? (
              <div className="samee3-tafsir-picker">
                <div className="samee3-tafsir-picker-head">
                  <div>
                    <span>اختر كتاب التفسير</span>
                    <strong>{selectedTafsirBook ? selectedTafsirBook.short_name || selectedTafsirBook.name : 'مصادر التفسير المتاحة'}</strong>
                  </div>
                  {tafsirBooksLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                </div>

                {tafsirBooksLoading && !tafsirBooks.length ? (
                  <div className="samee3-tafsir-loading">جاري تحميل كتب التفسير...</div>
                ) : (
                  <div className="samee3-tafsir-books">
                    {tafsirBooks.map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        className={selectedTafsirBookId === book.id ? 'is-selected' : ''}
                        onClick={() => void chooseTafsirBook(book)}
                      >
                        <span>{book.short_name || book.name}</span>
                        <small>{book.author}</small>
                        {selectedTafsirBookId === book.id ? <Check size={16} /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {tafsirLoading || tafsirText ? (
              <div className="samee3-tafsir-box">
                <div className="samee3-tafsir-title">
                  <span className="flex items-center gap-2 font-black text-[#155e67]">{tafsirLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} {selectedTafsirBook?.name || 'التفسير'}</span>
                  {selectedTafsirBook?.author ? <small>{selectedTafsirBook.author}</small> : null}
                </div>
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
        .samee3-book-stage { position:relative; width:100%; height:100dvh; overflow:hidden; background:#f5f0e4; touch-action:pan-y; overscroll-behavior:none; }
        .samee3-book-stage { transform:none !important; filter:none !important; }
        .samee3-spread { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:10px; padding:0; transform:none !important; transition:none; will-change:auto; }
        .samee3-spread.is-desktop { padding:8px 14px 14px; }
        .samee3-spread.is-mobile { padding:0; }
        .samee3-spread.is-dragging { cursor:grabbing; user-select:none; }
        .samee3-turn-stack { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; perspective:none; }
        .samee3-page-turn-layer { position:absolute; inset:0; z-index:4; display:flex; align-items:center; justify-content:center; overflow:hidden; isolation:isolate; }
        .samee3-page-turn-layer.is-active { pointer-events:none; }
        .samee3-turn-target { position:absolute; inset:0; z-index:1; display:flex; align-items:center; justify-content:center; overflow:hidden; pointer-events:none; }
        .samee3-turn-current { position:absolute; inset:0; z-index:2; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .samee3-page-sheet { position:relative; height:100%; aspect-ratio:1000/1400; overflow:hidden; background:#fffdf7; border:1px solid rgba(177,136,79,.38); box-shadow:0 4px 16px rgba(83,63,34,.07); isolation:isolate; }
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
        .samee3-page-art { position:absolute; inset:94px 7px 88px; display:flex; align-items:center; justify-content:center; overflow:hidden; isolation:isolate; }
        .samee3-page-art > svg { position:relative; z-index:2; width:100% !important; height:100% !important; max-width:100%; max-height:100%; display:block; object-fit:contain; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
        .samee3-live-ayah-highlight {
          position:absolute;
          z-index:3;
          display:block;
          pointer-events:none !important;
          border-radius:999px;
          background:rgba(199,147,79,.09);
          border:0;
          box-shadow:none !important;
          mix-blend-mode:normal;
          opacity:.92;
        }
        .samee3-text-ayah { display:inline; cursor:pointer; border-radius:8px; transition:background .12s ease, box-shadow .12s ease, filter .12s ease, color .12s ease; }
        .samee3-text-ayah.samee3-pressed-ayah {
          background:transparent !important;
          box-shadow:inset 0 -0.34em 0 rgba(14,153,212,.16), 0 3px 7px rgba(14,153,212,.13) !important;
        }
        .samee3-text-ayah.samee3-playing-ayah {
          background:transparent !important;
          box-shadow:none !important;
          text-shadow:none !important;
          filter:none !important;
          fill:#6f5a3b !important;
          fill-opacity:.88 !important;
        }
        .samee3-page-art .ayahPolygon.samee3-pressed-ayah {
          fill:#0e99d4 !important;
          fill-opacity:.055 !important;
          stroke:none !important;
          filter:none !important;
        }
        .samee3-page-art .ayahPolygon.samee3-playing-ayah {
          fill:#c5a36a !important;
          fill-opacity:.14 !important;
          stroke:#c5a36a !important;
          stroke-opacity:.08 !important;
          stroke-width:.8px !important;
          filter:none !important;
        }
        .samee3-page-art .samee3-ayah.samee3-playing-ayah {
          fill:#c39a59 !important;
          fill-opacity:.10 !important;
          stroke:none !important;
          filter:none !important;
        }
        .samee3-page-art .ayahPolygon.samee3-playing-ayah *,
        .samee3-page-art .samee3-ayah.samee3-playing-ayah *,
        .samee3-page-art .ayahPolygon.samee3-pressed-ayah *,
        .samee3-page-art .samee3-ayah.samee3-pressed-ayah * {
          filter:none !important;
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
        .samee3-picker-menu-juz { max-height:min(58dvh,430px); }
        .samee3-audio-toolbar { display:grid; grid-template-columns:1.1fr repeat(4,minmax(0,1fr)); gap:8px; }
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
        .samee3-tafsir-picker { margin-top:14px; padding:12px; border-radius:20px; background:linear-gradient(180deg,#fffdf8,#f7fbfc); border:1px solid #d9e7ea; }
        .samee3-tafsir-picker-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:2px 2px 10px; color:#155e67; }
        .samee3-tafsir-picker-head > div { display:flex; flex-direction:column; gap:3px; }
        .samee3-tafsir-picker-head span { color:#9b6a32; font-size:10px; font-weight:900; }
        .samee3-tafsir-picker-head strong { color:#1b2a3c; font-size:14px; font-weight:900; }
        .samee3-tafsir-books { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; max-height:34dvh; overflow:auto; overscroll-behavior:contain; }
        .samee3-tafsir-books button { position:relative; min-height:62px; padding:8px 34px 8px 9px; border:1px solid #e7e0d2; border-radius:14px; background:#fff; color:#29384a; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:3px; text-align:right; font-weight:900; }
        .samee3-tafsir-books button:hover, .samee3-tafsir-books button.is-selected { border-color:#b9ddea; background:#eef9fc; color:#0b7ea7; }
        .samee3-tafsir-books button > svg { position:absolute; left:9px; top:9px; color:#0e87b8; }
        .samee3-tafsir-books button span { font-size:12px; line-height:1.35; }
        .samee3-tafsir-books button small { color:#8d806e; font-size:9px; font-weight:800; line-height:1.35; }
        .samee3-tafsir-loading { min-height:60px; display:flex; align-items:center; justify-content:center; color:#738394; font-size:11px; font-weight:900; }
        .samee3-tafsir-title { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .samee3-tafsir-title small { color:#9b8a72; font-size:9px; font-weight:900; line-height:1.6; text-align:left; }
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

        @media (prefers-reduced-motion: reduce) {
          .samee3-live-ayah-highlight { transition:none !important; }
        }

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
          .samee3-tafsir-books { grid-template-columns:1fr; max-height:31dvh; }
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