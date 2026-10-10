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
  Sun,
  Moon,
  Share2,
  X,
} from 'lucide-react'
import AyahStudyTools from '@/components/mushaf/AyahStudyTools'
import { getOfflineTafsir } from '@/lib/tafsir-offline'

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

type CardTheme = 'ivory' | 'night' | 'gold'
type CardFormat = 'auto' | 'square' | 'story'

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

/**
 * شاشة الاختيار الأولي لقراءة المصحف.
 * تراجع Cache Storage الخاص بالرواية المختارة، وتحمّل 604 صفحة
 * (النص + SVG + صورة الصفحة للسوسي والبزي) بناءً على موافقة المستخدم.
 * تحافظ على التنزيلات السابقة وتستكمل الناقص فقط.
 */
type MushafDownloadChoice = 'checking' | 'choose' | 'downloading' | 'ready'
type MushafDownloadMode = 'hafs' | 'single' | 'all'

type MushafCacheSummary = {
  completed: Record<Riwaya, Set<number>>
  supported: boolean
}

const MUSHAF_TOTAL_PAGES = 604
const MUSHAF_ONLINE_SESSION_PREFIX = 'samee3_mushaf_online_choice_v1:'

function emptyMushafCache(): Record<Riwaya, Set<number>> {
  return {
    hafs: new Set<number>(), warsh: new Set<number>(), qalun: new Set<number>(),
    douri: new Set<number>(), shubah: new Set<number>(),
    sousi: new Set<number>(), bazzi: new Set<number>(),
  }
}

// Read every relevant Cache Storage index once; 7 separate scans get expensive
// after thousands of pages have been downloaded.
async function inspectAllMushafCaches(): Promise<MushafCacheSummary> {
  const completed = emptyMushafCache()
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { completed, supported: false }
  }

  const flags: Record<Riwaya, Uint8Array> = {
    hafs: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
    warsh: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
    qalun: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
    douri: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
    shubah: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
    sousi: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
    bazzi: new Uint8Array(MUSHAF_TOTAL_PAGES + 1),
  }

  const names = await caches.keys()
  const matching = [SAMEE3_MUSHAF_PAGE_CACHE_NAME, 'samee3-v3-riwaya-images']
    .filter((name) => names.includes(name))

  await Promise.all(matching.map(async (name) => {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    keys.forEach((request) => {
      try {
        const url = new URL(request.url)
        if (url.origin !== location.origin) return
        const id = url.searchParams.get('riwaya')
        if (!isRiwaya(id)) return
        const page = Number(url.searchParams.get('page'))
        if (!Number.isInteger(page) || page < 1 || page > MUSHAF_TOTAL_PAGES) return
        if (url.pathname === '/api/quran') flags[id][page] |= 1
        else if (url.pathname === '/api/mushaf-svg') flags[id][page] |= 2
        else if (url.pathname === '/api/mushaf-riwaya-image') flags[id][page] |= 4
      } catch {
        // Ignore legacy cache entries with unexpected request keys.
      }
    })
  }))

  ALL_MUSHAF_RIWAYAT.forEach((id) => {
    const needed = id === 'sousi' || id === 'bazzi' ? 7 : 3
    for (let page = 1; page <= MUSHAF_TOTAL_PAGES; page += 1) {
      if ((flags[id][page] & needed) === needed) completed[id].add(page)
    }
  })

  return { completed, supported: true }
}

function MushafDownloadStartup({
  riwaya,
  prefetchPage,
  reopenCount,
}: {
  riwaya: Riwaya
  prefetchPage: (riwaya: Riwaya, page: number) => Promise<boolean>
  reopenCount: number
}) {
  const [choice, setChoice] = useState<MushafDownloadChoice>('checking')
  const [mode, setMode] = useState<MushafDownloadMode>('hafs')
  const [pickedRiwaya, setPickedRiwaya] = useState<Riwaya>(riwaya)
  const [counts, setCounts] = useState<Record<Riwaya, number>>({
    hafs: 0, warsh: 0, qalun: 0, douri: 0, shubah: 0, sousi: 0, bazzi: 0,
  })
  const [message, setMessage] = useState('')
  const [storageSupported, setStorageSupported] = useState(true)
  const [currentRiwaya, setCurrentRiwaya] = useState<Riwaya | null>(null)
  const [failedCount, setFailedCount] = useState(0)
  const generationRef = useRef(0)
  const runningRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const generation = ++generationRef.current
    runningRef.current = false
    setChoice('checking')
    setMode('hafs')
    setPickedRiwaya(riwaya)
    setMessage('')
    setFailedCount(0)

    void (async () => {
      try {
        const summary = await inspectAllMushafCaches()
        if (generation !== generationRef.current || !mountedRef.current) return
        setStorageSupported(summary.supported)
        const next = {} as Record<Riwaya, number>
        ALL_MUSHAF_RIWAYAT.forEach((id) => { next[id] = summary.completed[id].size })
        setCounts(next)
        let choseOnline = false
        try {
          choseOnline = sessionStorage.getItem(MUSHAF_ONLINE_SESSION_PREFIX + riwaya) === '1'
        } catch { /* Session Storage may be disabled. */ }
        setChoice(reopenCount === 0 && (next[riwaya] === MUSHAF_TOTAL_PAGES || choseOnline)
          ? 'ready' : 'choose')
      } catch {
        if (generation !== generationRef.current || !mountedRef.current) return
        setMessage('تعذر فحص الصفحات المحفوظة. يمكن القراءة عبر الإنترنت.')
        setChoice('choose')
      }
    })()

    return () => { generationRef.current += 1 }
  }, [riwaya, reopenCount])

  const targets: Riwaya[] = mode === 'all'
    ? ALL_MUSHAF_RIWAYAT
    : [mode === 'hafs' ? 'hafs' : pickedRiwaya]
  const alreadySaved = targets.reduce((sum, id) => sum + counts[id], 0)
  const total = targets.length * MUSHAF_TOTAL_PAGES
  const percent = Math.floor((alreadySaved / total) * 100)
  const everythingSaved = ALL_MUSHAF_RIWAYAT.every((id) => counts[id] === MUSHAF_TOTAL_PAGES)

  const finishSelection = () => {
    generationRef.current += 1
    runningRef.current = false
    setCurrentRiwaya(null)
    try { sessionStorage.setItem(MUSHAF_ONLINE_SESSION_PREFIX + riwaya, '1') } catch { /* fine */ }
    setChoice('ready')
  }

  const download = async () => {
    if (runningRef.current || !storageSupported) return
    if (!navigator.onLine) {
      setMessage('وصل الإنترنت أولًا لتحميل الصفحات الناقصة.')
      return
    }

    const generation = generationRef.current
    runningRef.current = true
    setChoice('downloading')
    setFailedCount(0)
    setMessage('جارٍ فحص الملفات السابقة؛ سيتم تنزيل الناقص فقط. اترك نافذة المصحف مفتوحة أثناء التحميل.')

    try {
      const summary = await inspectAllMushafCaches()
      if (generation !== generationRef.current) return
      if (!summary.supported) throw new Error('المتصفح لا يدعم حفظ الصفحات محليًا.')
      const latest = {} as Record<Riwaya, number>
      ALL_MUSHAF_RIWAYAT.forEach((id) => { latest[id] = summary.completed[id].size })
      setCounts(latest)
      const queue: Array<{ id: Riwaya; page: number }> = []
      targets.forEach((id) => {
        for (let page = 1; page <= MUSHAF_TOTAL_PAGES; page += 1) {
          if (!summary.completed[id].has(page)) queue.push({ id, page })
        }
      })

      if (queue.length && navigator.storage?.persist) {
        void navigator.storage.persist().catch(() => false)
      }

      let nextIndex = 0
      let failed = 0
      let failedInARow = 0
      let abortForFailures = false
      const worker = async () => {
        while (
          generation === generationRef.current &&
          !abortForFailures && navigator.onLine && nextIndex < queue.length
        ) {
          const task = queue[nextIndex]
          nextIndex += 1
          setCurrentRiwaya(task.id)
          let saved = false
          try { saved = await prefetchPage(task.id, task.page) } catch { saved = false }
          if (generation !== generationRef.current) return
          if (saved) {
            failedInARow = 0
            setCounts((previous) => ({ ...previous, [task.id]: Math.min(MUSHAF_TOTAL_PAGES, previous[task.id] + 1) }))
          } else {
            failed += 1
            failedInARow += 1
            setFailedCount(failed)
            // Avoid thousands of failed requests if source is temporarily unavailable.
            if (failedInARow >= 12) abortForFailures = true
          }
        }
      }
      await Promise.all([worker(), worker()])
      if (generation !== generationRef.current) return
      const verified = await inspectAllMushafCaches()
      if (generation !== generationRef.current) return
      const final = {} as Record<Riwaya, number>
      ALL_MUSHAF_RIWAYAT.forEach((id) => { final[id] = verified.completed[id].size })
      setCounts(final)
      const complete = targets.every((id) => final[id] === MUSHAF_TOTAL_PAGES)
      setChoice('choose')
      setCurrentRiwaya(null)
      setMessage(complete
        ? 'اكتمل حفظ اختيارك. يمكنك الآن القراءة من الصفحات المحفوظة، أو تنزيل رواية أخرى.'
        : navigator.onLine
          ? 'لم تكتمل بعض الصفحات؛ قد يكون السبب المصدر أو سعة التخزين. اضغط استكمال لاحقًا لتنزيل الناقص فقط.'
          : 'انقطع الاتصال. الصفحات التي اكتمل تنزيلها محفوظة؛ استكمل عند عودة الإنترنت.')
    } catch (error) {
      if (generation !== generationRef.current) return
      setChoice('choose')
      setMessage(error instanceof Error ? error.message : 'تعذر تحميل الصفحات.')
    } finally {
      if (generation === generationRef.current) runningRef.current = false
      if (generation === generationRef.current) setCurrentRiwaya(null)
    }
  }

  const pauseDownload = () => {
    generationRef.current += 1
    runningRef.current = false
    setChoice('choose')
    setCurrentRiwaya(null)
    setMessage('تم إيقاف متابعة التحميل. ستظل الصفحات المحفوظة كما هي، ويمكن استكمال الناقص في أي وقت.')
    // In-flight requests may still finish; rescan before resuming.
    void inspectAllMushafCaches().then((summary) => {
      const next = {} as Record<Riwaya, number>
      ALL_MUSHAF_RIWAYAT.forEach((id) => { next[id] = summary.completed[id].size })
      if (mountedRef.current) setCounts(next)
    }).catch(() => undefined)
  }

  if (choice === 'ready') return null

  return (
    <div role="presentation" className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-[#0b2535]/80 px-3 py-5 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}>
      <section role="dialog" aria-modal="true" aria-labelledby="samee3-download-title" dir="rtl"
        className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-[30px] border border-[#dac299] bg-[#fffdf8] p-5 text-right shadow-2xl sm:p-7">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5e8cf] text-[#98723c]"><BookOpen size={24} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#aa8144]">مصحف سميع · SAMEE3</p>
            <h2 id="samee3-download-title" className="mt-1 text-xl font-extrabold text-[#173c51]">تنزيل صفحات المصحف</h2>
          </div>
          {reopenCount > 0 && choice !== 'downloading' ? (
            <button type="button" onClick={finishSelection} aria-label="إغلاق مدير التنزيلات" className="rounded-xl p-2 text-[#15566b]"><X size={19}/></button>
          ) : null}
        </div>
        <p className="text-sm leading-7 text-slate-600">
          اختر تنزيل حفص، أو رواية معينة، أو الروايات السبع كاملة. تظل كلمات كل رواية ورسمها من مصادرها الأصلية؛ والتحميل للصفحات فقط دون تلاوات صوتية.
        </p>

        {choice === 'checking' ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm font-bold text-[#16546c]"><Loader2 size={19} className="animate-spin" /> جارٍ فحص الصفحات الموجودة…</div>
        ) : (
          <>
            <div className="mt-4 grid gap-2">
              {([
                { id: 'hafs' as MushafDownloadMode, title: 'تحميل حفص كاملة', detail: '٦٠٤ صفحات من رواية حفص عن عاصم' },
                { id: 'single' as MushafDownloadMode, title: 'اختيار رواية محددة', detail: 'حدد الرواية التي تريد تنزيلها' },
                { id: 'all' as MushafDownloadMode, title: 'تحميل الروايات السبع كاملة', detail: '٤٬٢٢٨ صفحة؛ قد يتطلب مساحة ووقتًا كبيرين' },
              ]).map((item) => (
                <button type="button" key={item.id} disabled={choice === 'downloading'} onClick={() => { setMode(item.id); setMessage('') }}
                  aria-pressed={mode === item.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-right transition disabled:opacity-60 ${mode === item.id ? 'border-[#c09a59] bg-[#fff5e5] text-[#173c51]' : 'border-[#e8dfd0] bg-white text-[#173c51]'}`}>
                  <span className="flex items-center gap-2 text-sm font-extrabold">{mode === item.id ? <Check size={17} className="text-[#a47a38]"/> : <BookOpen size={17} className="text-[#a47a38]"/>}{item.title}</span>
                  <span className="mt-1 block pr-6 text-xs leading-5 text-slate-500">{item.detail}</span>
                </button>
              ))}
              {mode === 'single' ? (
                <label className="mt-1 block text-xs font-bold text-[#15566b]">
                  الرواية
                  <select value={pickedRiwaya} disabled={choice === 'downloading'}
                    onChange={(event) => setPickedRiwaya(event.target.value as Riwaya)}
                    className="mt-2 w-full rounded-xl border border-[#e4d3b5] bg-white px-3 py-3 text-sm font-bold outline-none">
                    {ALL_MUSHAF_RIWAYAT.map((id) => <option value={id} key={id}>{RIWAYA_NAMES[id]}</option>)}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-[#e6d7bd] bg-white p-4">
              <div className="mb-2 flex justify-between gap-2 text-sm">
                <strong className="text-[#164b61]">الصفحات المحفوظة للاختيار</strong>
                <span className="font-extrabold tabular-nums text-[#a27b3e]">{alreadySaved.toLocaleString('ar-EG')} / {total.toLocaleString('ar-EG')}</span>
              </div>
              <div role="progressbar" aria-valuenow={alreadySaved} aria-valuemin={0} aria-valuemax={total}
                aria-label="تقدم تنزيل صفحات المصحف" className="h-2.5 overflow-hidden rounded-full bg-[#edf0f3]">
                <div className="h-full rounded-full bg-gradient-to-l from-[#c39a59] to-[#ead3a8] transition-all" style={{ width: `${percent}%` }}/>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {choice === 'downloading'
                  ? `جارٍ تنزيل ${currentRiwaya ? RIWAYA_NAMES[currentRiwaya] : 'الصفحات'} — ${percent}%${failedCount ? ` · تعذّر ${failedCount} طلب` : ''}`
                  : alreadySaved === total ? 'هذا الاختيار محفوظ بالكامل على الجهاز.' : `المتبقي ${(total - alreadySaved).toLocaleString('ar-EG')} صفحة.`}
              </p>
            </div>

            {mode === 'all' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ALL_MUSHAF_RIWAYAT.map((id) => (
                  <div key={id} className="rounded-xl border border-[#eee3cf] bg-white px-3 py-2">
                    <div className="truncate text-[11px] font-bold text-[#164b61]">{RIWAYA_NAMES[id]}</div>
                    <div className="mt-1 text-[11px] tabular-nums text-slate-500">{counts[id].toLocaleString('ar-EG')} / ٦٠٤</div>
                  </div>
                ))}
              </div>
            ) : null}

            {message ? <p role="status" className="mt-3 rounded-xl bg-[#fff5e5] p-3 text-xs leading-6 text-[#805d2b]">{message}</p> : null}
            {mode === 'all' && !everythingSaved ? (
              <p className="mt-3 text-xs leading-6 text-amber-800">تنزيل السبع روايات ينتج عنه آلاف الطلبات وقد تتجاوز الملفات مساحة التخزين المسموحة من المتصفح. التحميل قابل للاستكمال ولا يحذف ما سبق.</p>
            ) : null}

            <div className="mt-4 grid gap-2">
              {choice === 'downloading' ? (
                <button type="button" onClick={pauseDownload} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#cba465] bg-[#fff3df] px-5 py-3.5 text-sm font-extrabold text-[#805d2b]"><Pause size={18}/> إيقاف التحميل مؤقتًا</button>
              ) : (
                <button type="button" onClick={() => void download()} disabled={!storageSupported || alreadySaved === total}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15566b] px-5 py-3.5 text-sm font-extrabold text-white disabled:opacity-50">
                  {alreadySaved === total ? <Check size={19}/> : <Download size={19}/>} {alreadySaved === total ? 'الاختيار محفوظ بالكامل' : alreadySaved > 0 ? 'استكمال تحميل الصفحات الناقصة' : 'بدء تحميل الصفحات'}
                </button>
              )}
              <button type="button" onClick={finishSelection} className="w-full rounded-2xl border border-[#d9c49e] bg-white px-5 py-3.5 text-sm font-extrabold text-[#15566b]">
                {navigator.onLine ? 'القراءة الآن (أونلاين أو من المحفوظ)' : 'فتح الصفحات المحفوظة'}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-6 text-slate-500">
              لا يُحذف أي تنزيل سابق. الاحتفاظ الدائم بالصفحات يعتمد على مساحة جهازك وسياسة المتصفح. للتحقق من العمل دون اتصال جرّب صفحات متعددة في وضع الطيران.
            </p>
          </>
        )}
      </section>
    </div>
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
  const [memorizationHidden, setMemorizationHidden] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [tafsirText, setTafsirText] = useState('')
  const [tafsirError, setTafsirError] = useState('')
  const tafsirRequestRef = useRef(0)
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [tafsirBooks, setTafsirBooks] = useState<TafsirBook[]>(FALLBACK_TAFSIR_BOOKS)
  const [tafsirBooksLoading, setTafsirBooksLoading] = useState(false)
  const [selectedTafsirBookId, setSelectedTafsirBookId] = useState<number | null>(null)
  const [tafsirPickerOpen, setTafsirPickerOpen] = useState(false)
  const [selectedTafsirBook, setSelectedTafsirBook] = useState<TafsirBook | null>(null)
  const [toast, setToast] = useState('')
  const [imageGenerating, setImageGenerating] = useState(false)
  const [imageSharing, setImageSharing] = useState(false)
  const [cardTheme, setCardTheme] = useState<CardTheme>('ivory')
  const [cardFormat, setCardFormat] = useState<CardFormat>('auto')
  const [imagePreview, setImagePreview] = useState<{
    url: string
    filename: string
    withTafsir: boolean
    blob: Blob
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
  const repeatRemainingRef = useRef<number | null>(null)
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
  const turnPreviewCacheRef = useRef(new Map<string, {
    page: number
    data: PageData | null
    html: string
  }>())
  const pendingNavigationPageRef = useRef<number | null>(null)
  const pageTurnNavigationTokenRef = useRef(0)
  const [openPicker, setOpenPicker] = useState<'riwaya' | 'reciter' | 'surah' | 'juz' | null>(null)
  const [mushafDownloadOpenCount, setMushafDownloadOpenCount] = useState(0)
  const audioRestoreAttemptedRef = useRef(false)
  const readingRestoreAttemptedRef = useRef(false)
  const audioOperationRef = useRef(0)
  const audioToggleBusyRef = useRef(false)


  // Screen Wake Lock is a best-effort browser capability. It requires HTTPS
  // and can be released by iOS/Android, low battery, or when the page is hidden.
  // Always let the reader control it; never attempt to defeat OS restrictions.
  const [keepScreenAwake, setKeepScreenAwake] = useState(true)
  const [awakePreferenceReady, setAwakePreferenceReady] = useState(false)
  const [wakeLockStatus, setWakeLockStatus] = useState<
    'on' | 'off' | 'requesting' | 'unsupported' | 'blocked'
  >('off')
  const retryWakeLockRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    try {
      setKeepScreenAwake(localStorage.getItem('samee3_keep_screen_awake') !== '0')
    } catch {
      setKeepScreenAwake(true)
    }
    setAwakePreferenceReady(true)
  }, [])

  useEffect(() => {
    if (!awakePreferenceReady) return
    try {
      localStorage.setItem('samee3_keep_screen_awake', keepScreenAwake ? '1' : '0')
    } catch { /* Private browsing can block localStorage. */ }
  }, [awakePreferenceReady, keepScreenAwake])

  useEffect(() => {
    if (!awakePreferenceReady) return

    type WakeLockSentinel = {
      released: boolean
      release: () => Promise<void>
      addEventListener: (event: 'release', listener: () => void) => void
    }
    type WakeLockApi = {
      request: (type: 'screen') => Promise<WakeLockSentinel>
    }
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
    if (!keepScreenAwake) {
      setWakeLockStatus('off')
      retryWakeLockRef.current = null
      return
    }
    if (!api || !window.isSecureContext) {
      setWakeLockStatus('unsupported')
      retryWakeLockRef.current = null
      return
    }

    let cancelled = false
    let pending = false
    let sentinel: WakeLockSentinel | null = null

    const request = async () => {
      if (cancelled || pending || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      pending = true
      setWakeLockStatus('requesting')
      try {
        const lock = await api.request('screen')
        if (cancelled || document.visibilityState !== 'visible') {
          await lock.release().catch(() => undefined)
          return
        }
        sentinel = lock
        setWakeLockStatus('on')
        lock.addEventListener('release', () => {
          if (sentinel === lock) {
            sentinel = null
            if (!cancelled) setWakeLockStatus('blocked')
          }
        })
      } catch {
        if (!cancelled) setWakeLockStatus('blocked')
      } finally {
        pending = false
      }
    }

    const release = () => {
      const previous = sentinel
      sentinel = null
      if (previous && !previous.released) {
        void previous.release().catch(() => undefined)
      }
    }
    const visibility = () => {
      if (document.visibilityState === 'visible') void request()
      else {
        release()
        setWakeLockStatus('off')
      }
    }
    retryWakeLockRef.current = () => void request()
    document.addEventListener('visibilitychange', visibility)
    void request()

    return () => {
      cancelled = true
      retryWakeLockRef.current = null
      document.removeEventListener('visibilitychange', visibility)
      release()
    }
  }, [awakePreferenceReady, keepScreenAwake])

  const toggleKeepAwake = () => {
    if (!keepScreenAwake) {
      setKeepScreenAwake(true)
      triggerToast('سأحاول إبقاء الشاشة مضاءة أثناء القراءة.')
    } else {
      setKeepScreenAwake(false)
      triggerToast('سيعود قفل الشاشة إلى إعدادات جهازك.')
    }
  }

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

  // A single broken CDN request must not freeze a 604/4228-page download.
  const downloadFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 22000)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const prefetchRiwayaPage = useCallback(async (targetRiwaya: Riwaya, page: number) => {
    const safePage = clampPage(page)
    const cache = 'caches' in window
      ? await caches.open(SAMEE3_MUSHAF_PAGE_CACHE_NAME).catch(() => null)
      : null

    if (!cache) return false

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
            // تنزيل الصفحات إلى Cache Storage دون تحميلها جميعًا داخل ذاكرة React.
            pageOk = true
          }
        }
      }
    } catch {
      // نستمر إلى الشبكة.
    }

    if (!pageOk && navigator.onLine) {
      try {
        const response = await downloadFetch(pageUrl, {
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
          // تنزيل الصفحات إلى Cache Storage دون تحميلها جميعًا داخل ذاكرة React.
          pageOk = pageDataValue.ayahs.length > 0
          if (pageOk && cache) {
            try { await cache.put(pageUrl, response) } catch { pageOk = false }
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
            // تنزيل الصفحات إلى Cache Storage دون تحميلها جميعًا داخل ذاكرة React.
            svgOk = true
          }
        }
      }
    } catch {
      // نستمر إلى الشبكة.
    }

    if (!svgOk && navigator.onLine) {
      try {
        const response = await downloadFetch(svgUrl, { cache: 'force-cache' })
        if (response.ok) {
          const data = await response.clone().json()
          if (data?.success && data?.svg) {
            // تنزيل الصفحات إلى Cache Storage دون تحميلها جميعًا داخل ذاكرة React.
            svgOk = true
            if (cache) {
              try { await cache.put(svgUrl, response) } catch { svgOk = false }
            }
          }
        }
      } catch {
        // نترك الصفحة التي تم حفظها بالفعل بدون تعطيل بقية التسخين.
      }
    }

    // السوسي والبزي يستخدمان صورة صفحة فعلية عبر مسار SAMEE3 المحلي.
    // نحفظ الصورة أيضًا حتى تصبح الصفحة قابلة للفتح Offline، ولا نكتفي
    // بتخزين SVG الذي يحتوي على رابط الصورة فقط.
    let imageOk = true
    if (targetRiwaya === 'sousi' || targetRiwaya === 'bazzi') {
      imageOk = false
      const imageUrl = `/api/mushaf-riwaya-image?riwaya=${encodeURIComponent(targetRiwaya)}&page=${safePage}`

      try {
        if (cache) {
          const cachedImage = await cache.match(imageUrl)
          if (cachedImage && cachedImage.ok && (cachedImage.headers.get('content-type') || '').startsWith('image/')) imageOk = true
        }
      } catch {
        // ننتقل إلى الشبكة.
      }

      if (!imageOk && navigator.onLine) {
        try {
          const response = await downloadFetch(imageUrl, { cache: 'force-cache' })
          if (response.ok && (response.headers.get('content-type') || '').startsWith('image/')) {
            if (cache) {
              await cache.put(imageUrl, response).then(() => { imageOk = true }).catch(() => {})
            }
          }
        } catch {
          // محاولة التسخين التالية ستعيد المحاولة تلقائيًا.
        }
      }
    }

    return pageOk && svgOk && imageOk
  }, [downloadFetch])

  // تنزيل المصحف الكامل يتم فقط بطلب صريح من المستخدم عبر شاشة البدء.
  // لا نقوم بتسخين الروايات السبع تلقائيًا في الخلفية.

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
    ).filter((targetPage) => targetPage !== pageNumber)

    const warm = async () => {
      await Promise.all(
        nearby.map(async (targetPage) => {
          if (cancelled) return
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
    // لا نعيد بناء السوسي أو البزي داخل المتصفح. المسار /api/mushaf-svg
    // يرجع SVG الصفحة الفعلية، لذلك نعرضه كما هو دون أي تخطيط نصي بديل.
    return svg
  }, [svg])

  const leftDisplayedSvg = useMemo(() => {
    if (!isDesktop || !leftPageData) return ''
    return leftSvg
  }, [isDesktop, leftPageData, leftSvg])


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

    tafsirRequestRef.current += 1
    setTafsirLoading(false)
    setTafsirText('')
    setTafsirError('')
    setTafsirPickerOpen(false)
    setSelectedTafsirBook(null)
    setSelectedAyah(found)
    setMemorizationHidden(false)
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

  const getMemoryTurnPreview = useCallback((targetPage: number) => {
    const safePage = clampPage(targetPage)
    const key = `${riwaya}:${safePage}`
    const cachedPreview = turnPreviewCacheRef.current.get(key)
    if (cachedPreview?.html) return cachedPreview

    const data = pageMemoryCacheRef.current.get(key) || null
    const rawSvg = svgMemoryCacheRef.current.get(key) || ''

    if (!data?.ayahs?.length || !rawSvg) return null

    const html = rawSvg

    if (!html) return null

    const preview = { page: safePage, data, html }
    turnPreviewCacheRef.current.set(key, preview)
    return preview
  }, [riwaya])

  const prepareTurnPreview = useCallback(async (targetPage: number) => {
    const safePage = clampPage(targetPage)
    const cached = getMemoryTurnPreview(safePage)
    if (cached) {
      setTurnPreview(cached)
      return cached
    }

    const requestId = ++turnPreviewRequestRef.current

    try {
      const [data, rawSvg] = await Promise.all([
        fetchPageData(safePage),
        fetchSvg(safePage),
      ])

      if (requestId !== turnPreviewRequestRef.current) return null

      const html = rawSvg

      if (!html) return null

      const preview = {
        page: safePage,
        data,
        html,
      }

      turnPreviewCacheRef.current.set(`${riwaya}:${safePage}`, preview)
      setTurnPreview(preview)
      return preview
    } catch {
      return null
    }
  }, [fetchPageData, fetchSvg, getMemoryTurnPreview, riwaya])

  const resetPageTurnState = useCallback(() => {
    pageTurnNavigationTokenRef.current += 1
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

    const basePage = pageNumber
    const baseData = pageData
    const baseHtml = mainDisplayedSvg
    const token = ++pageTurnNavigationTokenRef.current

    const startTransition = (preview: {
      page: number
      data: PageData | null
      html: string
    } | null) => {
      if (!preview || preview.page !== nextPage) {
        if (token === pageTurnNavigationTokenRef.current) {
          resetPageTurnState()
        }
        return
      }

      if (token !== pageTurnNavigationTokenRef.current) return
      if (navigatingRef.current && pendingNavigationPageRef.current !== nextPage) return

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
          reciterId: Number(audio.__samee3ReciterId || previous?.reciterId || DEFAULT_RECITER_API_ID),
          reciterName: audio.__samee3ReciterName || previous?.reciterName || DEFAULT_RECITER_NAME,
          moshafId: audio.__samee3MoshafId ?? previous?.moshafId ?? null,
          page: basePage,
          updatedAt: Date.now(),
        })
        audio.__samee3Page = basePage
      }

      navigatingRef.current = true
      pendingNavigationPageRef.current = nextPage

      setPageTurnBase({
        page: basePage,
        data: baseData,
        html: baseHtml,
      })
      setTurnPreview(preview)
      setPageTurnDirection(direction)
      setPageTurnTarget(nextPage)
      setIsPageDragging(false)
      setPageDragX(0)
      setPageDragY(0)
      setPageSettleX(0)

      // التقليب هنا انتقال ثابت بعد اكتمال السحب فقط.
      // الصفحة لا تتحرك مع الإصبع أثناء السحب، ولا تبدأ الحركة إلا بعد
      // قبول السحبة؛ وبذلك لا يحدث رجوع للصفحة الحالية أو وميض بين الصفحات.
      const animationDuration = 260
      const currentProgress = 0
      setPageTurnProgress(currentProgress)
      setPageTurnPhase('committing')

      window.requestAnimationFrame(() => {
        if (token !== pageTurnNavigationTokenRef.current) return
        setPageTurnProgress(1)
      })

      const remaining = animationDuration

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

      window.setTimeout(() => {
        if (token !== pageTurnNavigationTokenRef.current) return
        if (pendingNavigationPageRef.current !== nextPage) return
        router.replace(`/mushaf?${params.toString()}`)
      }, remaining + 18)

      // حماية أخيرة فقط. عند وصول pageNumber الجديدة، useEffect الخاص بالصفحة يمسح الحالة فورًا.
      window.setTimeout(() => {
        if (token !== pageTurnNavigationTokenRef.current) return
        if (pageNumber === nextPage) return
        if (pendingNavigationPageRef.current !== nextPage) return
        resetPageTurnState()
      }, 1200)
    }

    // الأولوية دائمًا للنسخة الموجودة في الذاكرة حتى يبدأ التقليب من أول لمسة.
    const immediatePreview =
      turnPreview?.page === nextPage
        ? turnPreview
        : getMemoryTurnPreview(nextPage)

    if (immediatePreview) {
      startTransition(immediatePreview)
      return
    }

    navigatingRef.current = true
    pendingNavigationPageRef.current = nextPage

    // لو كانت الصفحة المجاورة لم تُجهّز بعد، نجلبها من الكاش/الشبكة ثم نكمل نفس الانتقال.
    void prepareTurnPreview(nextPage).then((preview) => {
      if (token !== pageTurnNavigationTokenRef.current) return
      startTransition(preview)
    })
  }, [
    getMemoryTurnPreview,
    mainDisplayedSvg,
    pageData,
    pageNumber,
    prepareTurnPreview,
    resetPageTurnState,
    router,
    searchParams,
    turnPreview,
  ])

  /*
   * التقليب المسطح الحقيقي باستخدام Pointer Events.
   * الاتجاهات ثابتة بصريًا:
   *  - الصفحة التالية: تدخل من اليسار إلى اليمين.
   *  - الصفحة السابقة: تدخل من اليمين إلى اليسار.
   * لا يوجد Page Curl ولا دوران ثلاثي الأبعاد ولا طبقات معكوسة.
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

      // نحافظ على حركة المؤشر حتى لو خرج قليلًا من حدود الصفحة.
      // وعند البدء فوق آية نؤجل الـcapture حتى نتأكد أنها سحبة وليست ضغطة.
      if (!ayahTarget) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
      }

      // الصفحتان المجاورتان يتم تسخينهما أصلًا في الخلفية؛ لا نغير واجهة القراءة هنا.
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

      if (!pointerMovedRef.current) {
        if (horizontal < 8 && vertical < 8) return
        pointerMovedRef.current = true
      }

      if (horizontal <= vertical + 6 || horizontal <= 8) return

      event.preventDefault()

      // بعد أن تتضح أنها سحبة أفقية، نأخذ pointer capture حتى لا تضيع الحركة فوق الـSVG أو خارج الصفحة.
      if (pointerStartedOnAyahRef.current) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
      }

      const basePage = pageNumber
      const rawTargetPage = deltaX > 0
        ? basePage + 1
        : basePage - 1

      // عند حدود المصحف لا نسمح للسحبة الأفقية أن تتحول إلى Back/Forward gesture.
      if (rawTargetPage < 1 || rawTargetPage > 604) {
        event.preventDefault()
        return
      }

      const targetPage = clampPage(rawTargetPage)

      // مهم: لا نحرك الصفحة بصريًا أثناء سحب الإصبع.
      // السحب هنا مجرد إشارة لاختيار الاتجاه، والحركة الفعلية تبدأ مرة واحدة
      // بعد رفع الإصبع واجتياز العتبة. هذا يمنع أي ذهاب وعودة أو تتبع مزعج.

      // تجهيز الصفحة المقصودة في الخلفية فقط؛ لا نعرض أي طبقة انتقال أثناء السحب.
      if (turnPreview?.page !== targetPage && !getMemoryTurnPreview(targetPage)) {
        if (turnPreviewPageRef.current !== targetPage) {
          turnPreviewPageRef.current = targetPage
          void prepareTurnPreview(targetPage)
        }
      }

      // لا setState هنا للحركة. الصفحة الحالية تظل ثابتة تمامًا حتى تكتمل السحبة.
    },
    [
      getMemoryTurnPreview,
      pageNumber,
      prepareTurnPreview,
      turnPreview,
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
      const basePage = pageNumber
      const horizontalDistance = Math.abs(deltaX)
      const verticalDistance = Math.abs(deltaY)
      const threshold = Math.min(112, Math.max(44, window.innerWidth * 0.105))
      const isHorizontalSwipe =
        horizontalDistance >= threshold &&
        horizontalDistance > verticalDistance * 1.08

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
      const rawTargetPage = deltaX > 0
        ? basePage + 1
        : basePage - 1

      // الصفحة الأولى/الأخيرة لا تسمح بأي انتقال خارج المصحف.
      // هذا يمنع سحبة اليمين ← اليسار في الصفحة الأولى من فتح الصفحة الرئيسية
      // عبر إيماءة رجوع من النظام/المتصفح.
      if (rawTargetPage < 1 || rawTargetPage > 604) {
        resetPageTurnState()
        return
      }

      navigateTo(clampPage(rawTargetPage), undefined, direction)
    },
    [navigateTo, pageNumber, resetPageTurnState],
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
      setPageTurnBase(null)
      navigatingRef.current = false
      pendingNavigationPageRef.current = null
      pageTurnNavigationTokenRef.current += 1
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
        const remaining = repeatRemainingRef.current
        if (remaining !== null && remaining <= 1) {
          repeatRemainingRef.current = null
          setRepeatAyahNumber(null)
          audio?.pause()
          setIsPlaying(false)
          triggerToast('اكتمل تكرار الآية بالعدد المحدد.')
        } else {
          if (remaining !== null) repeatRemainingRef.current = remaining - 1
          if (audio) {
            audio.currentTime = repeatStart
            void audio.play().catch(() => {})
          }
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
    triggerToast,
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
            const remaining = repeatRemainingRef.current
            if (remaining !== null && remaining <= 1) {
              repeatRemainingRef.current = null
              setRepeatAyahNumber(null)
              audio.pause()
              setIsPlaying(false)
              return
            }
            if (remaining !== null) repeatRemainingRef.current = remaining - 1
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
    repeatRemainingRef.current = null
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
      repeatRemainingRef.current = null
      repeatSeekGuardRef.current = false
      triggerToast('تم إيقاف تكرار الآية.')
      return
    }

    setRepeatAyahNumber(localAyah)
    repeatRemainingRef.current = null
    repeatSeekGuardRef.current = false

    await loadAudioForSurah(
      Number(selectedAyah.surah.number),
      true,
      localAyah,
    )
    setShowAyahActions(false)
  }, [loadAudioForSurah, repeatAyahNumber, selectedAyah, triggerToast])


  const repeatAyahForStudy = useCallback(async (times: number) => {
    if (!selectedAyah?.surah?.number) return
    if (!Number.isInteger(times) || times < 1 || times > 10) return
    repeatRemainingRef.current = times
    repeatSeekGuardRef.current = false
    setRepeatAyahNumber(selectedAyah.numberInSurah)
    await loadAudioForSurah(selectedAyah.surah.number, true, selectedAyah.numberInSurah)
    const hasTiming = ayahTimingsRef.current.some(
      (item) => Number(item.ayah) === selectedAyah.numberInSurah && Number.isFinite(Number(item.start_time)),
    )
    if (!hasTiming) {
      repeatRemainingRef.current = null
      setRepeatAyahNumber(null)
      audioRef.current?.pause()
      triggerToast('التكرار المحدد يحتاج توقيت آيات دقيقًا؛ اختر قارئًا يدعم التزامن.')
      return
    }
    triggerToast(`بدأ التكرار ${arabicNumber(times)} مرات.`)
  }, [loadAudioForSurah, selectedAyah, triggerToast])

  const loadTafsirBooks = useCallback(async (surahNumber: number) => {
    if (!surahNumber) return FALLBACK_TAFSIR_BOOKS
    setTafsirBooksLoading(true)
    try {
      const response = await fetch(
        `/api/tafsir?mode=books&surah=${encodeURIComponent(String(surahNumber))}`,
        { cache: 'no-store', headers: { Accept: 'application/json' } },
      )
      if (!response.ok) throw new Error('تعذر تحميل قائمة التفاسير.')
      const payload = await response.json().catch(() => null)
      const remoteBooks = Array.isArray(payload?.books)
        ? payload.books.map((book: Partial<TafsirBook>) => ({
            id: Number(book.id),
            name: String(book.name || '').trim(),
            short_name: String(book.short_name || '').trim(),
            author: String(book.author || '').trim(),
          })).filter((book: TafsirBook) =>
            Number.isInteger(book.id) && book.id > 0 && Boolean(book.name),
          )
        : []
      const books: TafsirBook[] = remoteBooks.length ? remoteBooks : FALLBACK_TAFSIR_BOOKS
      setTafsirBooks(books)
      return books
    } catch {
      setTafsirBooks(FALLBACK_TAFSIR_BOOKS)
      return FALLBACK_TAFSIR_BOOKS
    } finally {
      setTafsirBooksLoading(false)
    }
  }, [])

  const fetchTafsir = useCallback(async (ayah: Ayah, bookId: number): Promise<string> => {
    if (!ayah.surah?.number) {
      setTafsirError('تعذر تحديد السورة لهذه الآية.')
      return ''
    }
    const requestId = ++tafsirRequestRef.current
    setTafsirLoading(true)
    setTafsirText('')
    setTafsirError('')
    try {
      // Saved full-book tafsir takes priority, including while offline.
      let localText: string | null = null
      try {
        localText = await getOfflineTafsir(bookId, ayah.surah.number, ayah.numberInSurah)
      } catch { /* IndexedDB unavailable: fall back to live source. */ }
      let payload: Record<string, any> | null = null
      if (!localText) {
        const response = await fetch(
          `/api/tafsir?mode=ayah&surah=${encodeURIComponent(String(ayah.surah.number))}&ayah=${encodeURIComponent(String(ayah.numberInSurah))}&book=${encodeURIComponent(String(bookId))}`,
          { cache: 'no-store', headers: { Accept: 'application/json' } },
        )
        payload = await response.json().catch(() => null)
        if (!response.ok || payload?.success === false) {
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'لم يتوفر تفسير لهذه الآية من المصدر المختار.')
        }
      }
      const interpretation = (localText || (typeof payload?.text === 'string' ? payload.text : '')).trim()
      if (!interpretation) throw new Error('لم يتوفر تفسير لهذه الآية من المصدر المختار.')
      if (requestId !== tafsirRequestRef.current) return ''
      const remote = payload?.tafsirBook && typeof payload.tafsirBook === 'object' ? payload.tafsirBook : null
      const book: TafsirBook =
        tafsirBooks.find((item) => item.id === bookId) ||
        FALLBACK_TAFSIR_BOOKS.find((item) => item.id === bookId) || {
          id: bookId,
          name: String(remote?.name || 'التفسير'),
          short_name: String(remote?.short_name || ''),
          author: String(remote?.author || ''),
        }
      setSelectedTafsirBookId(bookId)
      setSelectedTafsirBook(book)
      setTafsirText(interpretation)
      return interpretation
    } catch (error) {
      if (requestId === tafsirRequestRef.current) {
        setTafsirError(error instanceof Error ? error.message : 'تعذر تحميل التفسير الآن.')
      }
      return ''
    } finally {
      if (requestId === tafsirRequestRef.current) setTafsirLoading(false)
    }
  }, [tafsirBooks])

  const openTafsirChooser = useCallback(async () => {
    if (!selectedAyah?.surah?.number) return
    setShowAyahActions(true)
    setTafsirPickerOpen(true)
    setTafsirError('')
    await loadTafsirBooks(selectedAyah.surah.number)
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
    try {
      await navigator.clipboard.writeText(`${selectedAyah.text}\n\nسورة ${getSurahName(selectedAyah.surah?.number)} — الآية ${arabicNumber(selectedAyah.numberInSurah)}\n${RIWAYA_NAMES[riwaya]}`)
      triggerToast('تم نسخ نص الآية.')
    } catch {
      triggerToast('تعذر النسخ من المتصفح؛ يمكنك تحديد الآية ونسخها يدويًا.')
    }
  }

  const copyTafsir = async () => {
    if (!selectedAyah || !tafsirText) return
    const source = selectedTafsirBook?.name || 'التفسير'
    try {
      await navigator.clipboard.writeText(
        `${selectedAyah.text}\n\n${source}\n${tafsirText}\n\nسورة ${getSurahName(selectedAyah.surah?.number)}، الآية ${arabicNumber(selectedAyah.numberInSurah)}`,
      )
      triggerToast('تم نسخ التفسير مع مرجع الآية.')
    } catch {
      triggerToast('تعذر نسخ التفسير من هذا المتصفح.')
    }
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
      let interpretation = ''
      const bookId = selectedTafsirBookId || 2012
      let imageBook: TafsirBook | null = null

      if (withTafsir) {
        // Always resolve the interpretation for the exact ayah + book.
        // A fetch error must never be rendered as if it were Quran commentary.
        interpretation = await fetchTafsir(selectedAyah, bookId)
        if (!interpretation) {
          triggerToast('تعذر تحميل التفسير؛ لم يتم إنشاء صورة ناقصة.')
          return
        }
        imageBook = tafsirBooks.find((book) => book.id === bookId) ||
          FALLBACK_TAFSIR_BOOKS.find((book) => book.id === bookId) ||
          selectedTafsirBook
      }

      // Canvas text metrics must be measured after the intended fonts load.
      if (document.fonts) {
        await Promise.all([
          document.fonts.load('48px "Amiri Quran"'),
          document.fonts.load('32px "Amiri"'),
          document.fonts.load('24px "Tajawal"'),
        ]).catch(() => undefined)
        await document.fonts.ready.catch(() => undefined)
      }

      const canvas = drawSamee3AyahCard({
        ayah: selectedAyah.text,
        surah: getSurahName(selectedAyah.surah?.number),
        ayahNumber: selectedAyah.numberInSurah,
        riwaya: RIWAYA_NAMES[riwaya],
        tafsir: interpretation,
        tafsirBook: imageBook,
        withTafsir,
        theme: cardTheme,
        format: cardFormat,
      })
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob) throw new Error('تعذر تحويل التصميم إلى صورة.')

      const filename = `samee3-ayah-${selectedAyah.surah?.number || 0}-${selectedAyah.numberInSurah}-${cardTheme}-${cardFormat}${withTafsir ? '-tafsir' : ''}.png`
      const url = URL.createObjectURL(blob)
      setImagePreview((previous) => {
        if (previous) URL.revokeObjectURL(previous.url)
        return { url, filename, withTafsir, blob }
      })
      setShowAyahActions(false)
    } catch (error) {
      console.error('SAMEE3 ayah card:', error)
      triggerToast(error instanceof Error ? error.message : 'تعذر تجهيز الصورة.')
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

  const shareImagePreview = async () => {
    if (!imagePreview || imageSharing) return
    const shareApi = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean
      share?: (data: ShareData) => Promise<void>
    }
    const file = new File([imagePreview.blob], imagePreview.filename, { type: 'image/png' })
    const data: ShareData = { files: [file], title: 'مصحف سميع' }
    if (!shareApi.share || (shareApi.canShare && !shareApi.canShare(data))) {
      triggerToast('مشاركة الصور غير متاحة في المتصفح؛ يمكنك تحميل الصورة.')
      return
    }
    setImageSharing(true)
    try {
      await shareApi.share(data)
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        triggerToast('لم تكتمل المشاركة؛ يمكنك تحميل الصورة.')
      }
    } finally {
      setImageSharing(false)
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview?.url) URL.revokeObjectURL(imagePreview.url)
    }
  }, [imagePreview?.url])

  useEffect(() => {
    if (!showAyahActions && !imagePreview) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (imagePreview) setImagePreview(null)
      else setShowAyahActions(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [showAyahActions, imagePreview])

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
      <MushafDownloadStartup riwaya={riwaya} prefetchPage={prefetchRiwayaPage} reopenCount={mushafDownloadOpenCount} />
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

        <div className={`samee3-spread ${isDesktop ? 'is-desktop' : 'is-mobile'}`}>
          <div className="samee3-turn-stack">
            {(() => {
              const hasPreview =
                pageTurnTarget !== null &&
                turnPreview?.page === pageTurnTarget &&
                Boolean(turnPreview?.html)

              const active =
                pageTurnPhase === 'committing' &&
                pageTurnDirection !== null &&
                pageTurnTarget !== null &&
                Boolean(pageTurnBase) &&
                hasPreview

              const progress = active
                ? Math.min(1, Math.max(0, pageTurnProgress))
                : 0
              const direction = pageTurnDirection || 'next'
              const isNext = direction === 'next'

              // next: الصفحة الجديدة تبدأ خارج الإطار من اليسار وتدخل نحو اليمين.
              // prev: الصفحة الجديدة تبدأ خارج الإطار من اليمين وتدخل نحو اليسار.
              // الصفحة الحالية ثابتة تمامًا. الصفحة المستهدفة وحدها تدخل من
              // الاتجاه المطلوب ثم تصبح الصفحة الحالية بعد تحديث الـroute.
              const currentX = 0
              const targetX = isNext ? -100 + progress * 100 : 100 - progress * 100
              const transition = 'transform 260ms cubic-bezier(.22,.8,.24,1)'

              const basePage = pageTurnBase?.page ?? pageNumber
              const baseData = pageTurnBase?.data ?? pageData
              const baseHtml = pageTurnBase?.html ?? mainDisplayedSvg
              const baseMeta = pageMeta(
                baseData,
                basePage,
                baseData?.ayahs?.[0]?.surah?.number || currentSurahNumber,
              )

              const targetPage = turnPreview?.page ?? pageTurnTarget ?? pageNumber
              const targetData = turnPreview?.data ?? null
              const targetHtml = turnPreview?.html ?? ''
              const targetMeta = pageMeta(
                targetData,
                targetPage,
                targetData?.ayahs?.[0]?.surah?.number || currentSurahNumber,
              )

              return (
                <div
                  className={`samee3-page-turn-layer ${active ? 'is-active' : ''}`}
                  aria-hidden={active ? 'true' : undefined}
                >
                  {active ? (
                    <div
                      className="samee3-turn-target"
                      aria-hidden="true"
                      style={{
                        transform: `translate3d(${targetX.toFixed(3)}%,0,0)`,
                        transition,
                        willChange: 'transform',
                        background: '#fcfbf8',
                      }}
                    >
                      <MushafPageSheet
                        page={targetPage}
                        data={targetData}
                        html={targetHtml}
                        side="single"
                        meta={targetMeta}
                        onAyahClick={() => undefined}
                        onAyahPointerDown={() => undefined}
                        onAyahPointerUp={() => undefined}
                      />
                    </div>
                  ) : null}

                  <div
                    className="samee3-turn-current"
                    style={{
                      pointerEvents: active ? 'none' : 'auto',
                      transform: 'translate3d(0,0,0)',
                      transition: 'none',
                      willChange: 'auto',
                    }}
                  >
                    <MushafPageSheet
                      page={basePage}
                      data={baseData}
                      html={baseHtml}
                      side="single"
                      meta={baseMeta}
                      onAyahClick={handleAyahClick}
                      onAyahPointerDown={handleAyahPointerDown}
                      onAyahPointerUp={handleAyahPointerUp}
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
                <button type="button" title="تنزيل صفحات المصحف وإدارة الروايات" aria-label="تنزيل صفحات المصحف" onClick={() => setMushafDownloadOpenCount((value) => value + 1)} className="samee3-download-shortcut"><Download size={19} /></button>
                <button
                  type="button"
                  onClick={toggleKeepAwake}
                  title={wakeLockStatus === 'on' ? 'الشاشة ستظل مضاءة أثناء القراءة' : wakeLockStatus === 'blocked' ? 'إعادة محاولة إبقاء الشاشة مضاءة' : 'التحكم في إضاءة الشاشة'}
                  aria-label={keepScreenAwake ? 'إيقاف إبقاء الشاشة مضاءة' : 'إبقاء الشاشة مضاءة أثناء القراءة'}
                  aria-pressed={wakeLockStatus === 'on'}
                  className={`samee3-awake-toggle ${wakeLockStatus === 'on' ? 'is-on' : ''}`}
                >
                  {wakeLockStatus === 'requesting' ? <Loader2 size={18} className="animate-spin" /> : keepScreenAwake ? <Sun size={19} /> : <Moon size={19} />}
                </button>
                <button type="button" onClick={() => void executeSearch()} disabled={searchLoading} className="samee3-search-submit">
                  {searchLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
              {searchMessage ? <div className="samee3-search-message">{searchMessage}</div> : null}
              {wakeLockStatus === 'blocked' && keepScreenAwake ? (
                <button type="button" className="samee3-awake-info" onClick={() => retryWakeLockRef.current?.()}>
                  المتصفح أوقف منع قفل الشاشة. اضغط للمحاولة مجددًا، أو استخدم زر الشمس لإيقاف الميزة.
                </button>
              ) : wakeLockStatus === 'unsupported' && keepScreenAwake ? (
                <p className="samee3-awake-info">إبقاء الشاشة مضاءة تلقائيًا غير مدعوم هنا؛ غيّر إعداد القفل من الجهاز.</p>
              ) : null}
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
        <div
          className="samee3-ayah-overlay"
          onClick={() => setShowAyahActions(false)}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`خيارات الآية ${arabicNumber(selectedAyah.numberInSurah)} من سورة ${getSurahName(selectedAyah.surah?.number)}`}
            className="samee3-ayah-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="samee3-ayah-sheet-handle" aria-hidden="true" />
            <div className="samee3-ayah-sheet-head">
              <div>
                <span>مصحف سميع · {RIWAYA_NAMES[riwaya]}</span>
                <strong>سورة {getSurahName(selectedAyah.surah?.number)} <i>•</i> الآية {arabicNumber(selectedAyah.numberInSurah)}</strong>
              </div>
              <button type="button" onClick={() => setShowAyahActions(false)} aria-label="إغلاق خيارات الآية"><X size={20} /></button>
            </div>

            <div className="samee3-ayah-preview">
              <span className="samee3-ayah-preview-ornament" aria-hidden="true">۞</span>
              <p dir="rtl">{memorizationHidden ? 'الآية مخفية أثناء اختبار الحفظ — افتح قسم الحفظ لإظهارها' : selectedAyah.text}</p>
              <span className="samee3-ayah-preview-number">﴿{arabicNumber(selectedAyah.numberInSurah)}﴾</span>
            </div>

            <p className="samee3-action-group-label">الاستماع والتفاعل</p>
            <div className="samee3-ayah-actions-grid">
              <button type="button" onClick={() => void playSelectedAyah()}><Play size={20} /><span>استماع</span></button>
              <button
                type="button"
                className={repeatAyahNumber === selectedAyah.number || repeatAyahNumber === selectedAyah.numberInSurah ? 'saved' : ''}
                onClick={() => void toggleRepeatSelectedAyah()}
              ><Repeat size={20} /><span>{repeatAyahNumber === selectedAyah.number || repeatAyahNumber === selectedAyah.numberInSurah ? 'إيقاف التكرار' : 'تكرار الآية'}</span></button>
              <button type="button" className={isSaved ? 'saved' : ''} onClick={bookmarkAyah}><Bookmark size={20} /><span>{isSaved ? 'محفوظة' : 'حفظ الآية'}</span></button>
              <button type="button" onClick={() => void copyAyah()}><Copy size={20} /><span>نسخ النص</span></button>
            </div>

            <p className="samee3-action-group-label">قوالب المشاركة القرآنية</p>
            <div className="samee3-card-customizer">
              <label>شكل البطاقة
                <select value={cardTheme} onChange={(event) => setCardTheme(event.target.value as CardTheme)}>
                  <option value="ivory">عاجي هادئ</option>
                  <option value="night">داكن فاخر</option>
                  <option value="gold">ذهبي راقٍ</option>
                </select>
              </label>
              <label>المقاس
                <select value={cardFormat} onChange={(event) => setCardFormat(event.target.value as CardFormat)}>
                  <option value="auto">تلقائي للنص الكامل</option>
                  <option value="square">مربع 1080×1080</option>
                  <option value="story">قصة 1080×1920</option>
                </select>
              </label>
            </div>
            <div className="samee3-image-actions">
              <button type="button" disabled={imageGenerating} onClick={() => void downloadAyahCard(false)}>
                <ImageIcon size={21} />
                <span><strong>صورة الآية</strong><small>بطاقة قرآنية أنيقة بالنص كاملًا</small></span>
                {imageGenerating ? <Loader2 size={18} className="animate-spin" /> : <ChevronLeft size={18} />}
              </button>
              <button type="button" disabled={imageGenerating} onClick={() => void downloadAyahCard(true)}>
                <FileText size={21} />
                <span><strong>صورة الآية مع التفسير</strong><small>الآية والتفسير المختار دون اختصار صامت</small></span>
                {imageGenerating ? <Loader2 size={18} className="animate-spin" /> : <ChevronLeft size={18} />}
              </button>
            </div>

            <div className="samee3-tafsir-section">
              <div className="samee3-tafsir-section-head">
                <div><span>فهم الآية</span><strong>التفسير</strong></div>
                <button type="button" onClick={() => void openTafsirChooser()}>
                  {tafsirBooksLoading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  {tafsirPickerOpen ? 'اختيار مصدر آخر' : selectedTafsirBook ? 'تغيير الكتاب' : 'اختر كتاب التفسير'}
                  <ChevronDown size={15} />
                </button>
              </div>

              {tafsirPickerOpen ? (
                <div className="samee3-tafsir-picker">
                  <p className="samee3-tafsir-picker-caption">اختر مصدرًا موثوقًا لقراءة تفسير الآية</p>
                  <div className="samee3-tafsir-books">
                    {tafsirBooks.map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        className={selectedTafsirBookId === book.id ? 'is-selected' : ''}
                        onClick={() => void chooseTafsirBook(book)}
                      >
                        <span>{book.short_name || book.name}</span>
                        <small>{book.author || book.name}</small>
                        {selectedTafsirBookId === book.id ? <Check size={16} /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {tafsirLoading ? (
                <div className="samee3-tafsir-feedback"><Loader2 size={18} className="animate-spin" /> جارٍ إحضار التفسير…</div>
              ) : tafsirError ? (
                <div className="samee3-tafsir-error">
                  <p>{tafsirError}</p>
                  <button type="button" onClick={() => void fetchTafsir(selectedAyah, selectedTafsirBookId || 2012)}>إعادة المحاولة</button>
                </div>
              ) : tafsirText ? (
                <article className="samee3-tafsir-box">
                  <header className="samee3-tafsir-title">
                    <div><span>من كتاب</span><strong>{selectedTafsirBook?.name || 'التفسير'}</strong></div>
                    {selectedTafsirBook?.author ? <small>{selectedTafsirBook.author}</small> : null}
                    <button type="button" onClick={() => void copyTafsir()} title="نسخ التفسير" aria-label="نسخ التفسير"><Copy size={17} /></button>
                  </header>
                  <p dir="rtl">{tafsirText}</p>
                  <footer>التفسير من المصدر المختار · رواية {RIWAYA_NAMES[riwaya]}</footer>
                </article>
              ) : !tafsirPickerOpen ? (
                <p className="samee3-tafsir-empty">اختر كتاب التفسير لقراءة معاني الآية داخل المصحف.</p>
              ) : null}
            </div>
            <AyahStudyTools
              key={`${selectedAyah.surah?.number || 0}_${selectedAyah.numberInSurah}`}
              surah={selectedAyah.surah?.number || 0}
              ayah={selectedAyah.numberInSurah}
              verse={selectedAyah.text}
              riwaya={RIWAYA_NAMES[riwaya]}
              books={tafsirBooks}
              onRepeat={repeatAyahForStudy}
              onToast={triggerToast}
              onHideChange={setMemorizationHidden}
            />
          </section>
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

            <div className="samee3-image-preview-actions">
              <button
                type="button"
                className="samee3-image-share-btn"
                onClick={() => void shareImagePreview()}
                disabled={imageSharing}
              >
                {imageSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={19} />}
                مشاركة
              </button>
              <button
                type="button"
                className="samee3-image-download-btn"
                onClick={downloadImagePreview}
              >
                <Download size={20} />
                تحميل الصورة
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="samee3-toast"><Check size={16} />{toast}</div> : null}

      <style jsx global>{`
        .samee3-card-customizer { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin:10px 0 15px; }
        .samee3-card-customizer label { display:flex; flex-direction:column; gap:6px; color:#987a4a; font-size:11px; font-weight:900; }
        .samee3-card-customizer select { width:100%; min-width:0; padding:11px 9px; border-radius:12px; background:#fffdf9; color:#234a51; border:1px solid #e4d6be; font-family:inherit; font-size:12px; }
        html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; }
        .samee3-reader { font-family: 'Tajawal', system-ui, sans-serif; color:#1a2534; -webkit-text-size-adjust:100%; text-size-adjust:100%; }
        .samee3-book-stage { position:relative; width:100%; height:100dvh; overflow:hidden; background:#f5f0e4; touch-action:none; overscroll-behavior:none; overscroll-behavior-x:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
        .samee3-book-stage { transform:none !important; filter:none !important; }
        .samee3-spread { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:10px; padding:0; transform:none !important; transition:none; will-change:auto; }
        .samee3-spread.is-desktop { padding:8px 14px 14px; }
        .samee3-spread.is-mobile { padding:0; }
        .samee3-spread.is-dragging { cursor:grabbing; user-select:none; }
        .samee3-turn-stack { position:relative; width:100%; height:100%; display:block; overflow:hidden; contain:paint; isolation:isolate; }
        .samee3-page-turn-layer { position:absolute; inset:0; z-index:4; display:block; overflow:hidden; pointer-events:none; transform:none !important; perspective:none !important; }
        .samee3-page-turn-layer.is-active { pointer-events:none; }
        .samee3-turn-target { position:absolute; inset:0; z-index:1; display:flex; align-items:center; justify-content:center; overflow:hidden; pointer-events:none; transform:translate3d(0,0,0); backface-visibility:visible; }
        .samee3-turn-current { position:absolute; inset:0; z-index:2; display:flex; align-items:center; justify-content:center; overflow:hidden; transform:translate3d(0,0,0); backface-visibility:visible; }
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
        .samee3-page-meta { position:absolute; inset:0 0 auto; z-index:80; height:48px; display:flex; align-items:center; justify-content:space-between; padding:6px 13px 0; color:#7f5a2b; font-family:'Tajawal',sans-serif; pointer-events:none; background:linear-gradient(180deg,rgba(255,251,241,.96) 0%,rgba(255,251,241,.78) 68%,rgba(255,251,241,0) 100%); }
        .samee3-page-meta .meta-side { display:flex; align-items:center; gap:7px; font-weight:900; font-size:12px; text-shadow:0 1px 0 rgba(255,255,255,.7); }
        .samee3-page-meta .meta-badge { display:inline-flex; min-width:26px; height:26px; padding:0 7px; align-items:center; justify-content:center; border-radius:8px; border:1px solid rgba(184,137,71,.32); background:rgba(255,250,237,.92); }
        .samee3-surah-frame { position:absolute; left:8%; right:8%; top:46px; height:41px; z-index:8; display:flex; align-items:center; justify-content:center; pointer-events:none; }
        .samee3-surah-frame::before { content:""; position:absolute; inset:0; border:1.4px solid rgba(177,126,59,.9); border-radius:8px; background:linear-gradient(180deg, rgba(255,251,240,.92), rgba(245,232,205,.70)); box-shadow:inset 0 0 0 3px rgba(255,255,255,.48); }
        .samee3-surah-frame .ornament { position:relative; z-index:2; color:#a86e2e; font-size:18px; line-height:1; }
        .samee3-surah-frame strong { position:relative; z-index:2; min-width:170px; padding:0 16px; text-align:center; color:#392b1e; font-family:'Aref Ruqaa','Amiri',serif; font-size:20px; font-weight:700; }
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
        .samee3-text-page { width:100%; height:100%; box-sizing:border-box; overflow:hidden; padding:22px 26px 16px; direction:rtl; background:#fffdf7; color:#171b20; font-family:'Amiri Quran','Amiri',serif; display:flex; flex-direction:column; justify-content:space-evenly; gap:0; }
        .samee3-text-line { flex:1 1 0; min-height:0; display:flex; align-items:center; justify-content:center; direction:rtl; text-align:center; font-family:'Amiri Quran','Amiri',serif; font-size:clamp(20px,1.82vw,32px); line-height:1.15; white-space:nowrap; letter-spacing:0; }
        .samee3-text-line-svg { font-family:'Amiri Quran','Amiri',serif; font-size:32px; fill:#15191e; }
        .samee3-text-line-svg .samee3-ayah-number { fill:#b78945; }
        .samee3-page-art { position:absolute; inset:90px 9px 74px; display:flex; align-items:center; justify-content:center; overflow:hidden; isolation:isolate; background:#fffdf7; }
        .samee3-page-art > svg { position:relative; z-index:2; width:100% !important; height:100% !important; max-width:100%; max-height:100%; display:block; object-fit:contain; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
        /* Preserve original riwaya scan and text while matching the SAMEE3 page frame. */
        .samee3-real-riwaya-page { background:#fffdf7; }
        .samee3-real-riwaya-page .samee3-surah-frame { display:none; }
        .samee3-real-riwaya-page .samee3-page-meta { display:flex; }
        .samee3-real-riwaya-page .samee3-page-footer { display:flex; }
        .samee3-real-riwaya-page .samee3-page-art {
          inset:53px 9px 52px;
          overflow:hidden;
          background:#fffdf7;
          border:1px solid rgba(183,140,79,.43);
          box-shadow: inset 0 0 0 3px rgba(244,230,199,.42);
        }
        .samee3-real-riwaya-page .samee3-page-art > svg {
          display:block;
          width:100% !important;
          height:100% !important;
          max-width:100%;
          max-height:100%;
          object-fit:contain;
          transform:none !important;
          flex:0 0 auto;
        }
        .samee3-real-riwaya-page .samee3-riwaya-image {
          filter:sepia(.06) contrast(1.03);
        }
        .samee3-real-riwaya-page .samee3-page-art::after {
          content:"";
          position:absolute;
          inset:0;
          z-index:3;
          border:4px double rgba(168,121,60,.24);
          pointer-events:none;
        }
        @media (max-width:767px) and (orientation:portrait) {
          .samee3-real-riwaya-page .samee3-page-art { inset:49px 5px 44px; }
          .samee3-real-riwaya-page .samee3-page-art > svg {
            width:100% !important; height:100% !important; max-width:100%; max-height:100%;
          }
        }
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
        .samee3-download-shortcut { width:46px; height:46px; flex:0 0 46px; display:flex; align-items:center; justify-content:center; border:1px solid #e4d3b5; border-radius:16px; background:#fff9eb; color:#956c36; cursor:pointer; }
        .samee3-download-shortcut:hover { background:#f4e5c9; }
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

        .samee3-awake-toggle { min-height:42px; min-width:42px; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:12px; border:1px solid #e3d8c3; background:#fffaf2; color:#9b7541; cursor:pointer; }
        .samee3-awake-toggle.is-on { background:#e7f5f3; color:#12605f; border-color:#a5d6cd; }
        .samee3-awake-info { display:block; width:100%; border:0; padding:8px 12px; border-radius:12px; background:#fff0db; color:#805526; font-size:11px; font-weight:800; line-height:1.8; text-align:center; }
        .samee3-ayah-overlay { position:absolute; z-index:100; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:0 12px max(8px,env(safe-area-inset-bottom)); background:rgba(8,24,33,.58); backdrop-filter:blur(7px); }
        .samee3-ayah-sheet { width:min(100%,680px); max-height:90dvh; overflow:auto; overscroll-behavior:contain; border-radius:28px; background:#fffefa; border:1px solid #e9dcc5; box-shadow:0 26px 100px rgba(8,24,33,.30); padding:18px 20px 22px; scrollbar-width:thin; }
        .samee3-ayah-sheet-handle { height:4px; width:52px; margin:0 auto 16px; background:#d9cfbe; border-radius:99px; }
        .samee3-ayah-sheet-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .samee3-ayah-sheet-head > div { display:flex; flex-direction:column; gap:5px; min-width:0; }
        .samee3-ayah-sheet-head span { color:#9a7850; font-size:11px; font-weight:700; }
        .samee3-ayah-sheet-head strong { color:#163b47; font-size:18px; font-weight:900; }
        .samee3-ayah-sheet-head strong i { color:#b28d57; font-style:normal; margin:0 5px; }
        .samee3-ayah-sheet-head button { width:40px; height:40px; min-width:40px; border:0; border-radius:13px; background:#f3eee6; color:#52636c; display:flex; align-items:center; justify-content:center; }
        .samee3-ayah-preview { margin-top:15px; padding:22px 20px; border-radius:20px; background:#fbf8f0; border:1px solid #e6d9be; color:#182e37; text-align:center; }
        .samee3-ayah-preview p { margin:5px 0 0; font-family:'Amiri Quran','Amiri',serif; font-size:clamp(21px,3.6vw,27px); line-height:2.15; white-space:pre-wrap; overflow-wrap:break-word; }
        .samee3-ayah-preview-ornament { display:block; margin:auto; color:#b48d4e; font-size:25px; line-height:1; }
        .samee3-ayah-preview-number { display:block; margin-top:8px; color:#9b7638; font-size:15px; font-weight:800; }
        .samee3-action-group-label { margin:20px 2px 9px; color:#607681; font-size:12px; font-weight:900; }
        .samee3-ayah-actions-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
        .samee3-ayah-actions-grid button { min-height:77px; border:1px solid #e8e0d3; background:#fff; color:#244855; border-radius:17px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; font-weight:800; font-size:11px; transition:background .15s,border-color .15s,transform .15s; }
        .samee3-ayah-actions-grid button svg { color:#a77f45; }
        .samee3-ayah-actions-grid button:hover { background:#f4fafb; border-color:#bfdadf; transform:translateY(-1px); }
        .samee3-ayah-actions-grid button.saved { background:#effaf5; border-color:#b7ddce; color:#147055; }
        .samee3-image-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
        .samee3-image-actions button { display:flex; align-items:center; gap:11px; min-width:0; padding:13px; border-radius:17px; border:1px solid #e4d4b9; color:#284653; background:linear-gradient(165deg,#fffdf8,#f6f5ef); text-align:right; }
        .samee3-image-actions button > svg:first-child { flex-shrink:0; color:#a77a3d; }
        .samee3-image-actions button > svg:last-child { flex-shrink:0; margin-right:auto; color:#a6b1b6; }
        .samee3-image-actions button span { display:flex; flex-direction:column; align-items:flex-start; gap:5px; flex:1; }
        .samee3-image-actions button strong { font-size:12px; font-weight:900; }
        .samee3-image-actions button small { font-size:10px; font-weight:600; color:#75848c; line-height:1.5; }
        .samee3-image-actions button:disabled { opacity:.55; cursor:wait; }
        .samee3-tafsir-section { margin-top:20px; padding:16px; border:1px solid #e7e1d6; border-radius:22px; background:#f9faf8; }
        .samee3-tafsir-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
        .samee3-tafsir-section-head > div { display:flex; flex-direction:column; gap:3px; }
        .samee3-tafsir-section-head > div span { color:#b08b53; font-weight:800; font-size:10px; }
        .samee3-tafsir-section-head > div strong { font-size:18px; font-weight:900; color:#193b44; }
        .samee3-tafsir-section-head > button { display:flex; align-items:center; gap:6px; border:1px solid #d7c9b1; background:#fff; padding:9px 11px; border-radius:12px; color:#33616b; font-size:11px; font-weight:800; }
        .samee3-tafsir-picker { margin-top:14px; padding:10px; border-radius:16px; background:#fffdf8; border:1px solid #e8dfd1; }
        .samee3-tafsir-picker-caption { font-size:11px; color:#879093; margin:2px 3px 9px; }
        .samee3-tafsir-books { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; max-height:36dvh; overflow:auto; overscroll-behavior:contain; }
        .samee3-tafsir-books button { position:relative; min-height:66px; padding:11px 12px; border:1px solid #e7e0d2; border-radius:13px; background:white; color:#29384a; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:4px; text-align:right; }
        .samee3-tafsir-books button:hover, .samee3-tafsir-books button.is-selected { border-color:#9fc9cf; background:#eef8fa; }
        .samee3-tafsir-books button > svg { position:absolute; left:9px; top:9px; color:#0d8095; }
        .samee3-tafsir-books button span { font-size:12px; font-weight:900; line-height:1.45; }
        .samee3-tafsir-books button small { color:#8a847a; font-size:10px; font-weight:650; line-height:1.45; }
        .samee3-tafsir-feedback { display:flex; align-items:center; gap:8px; padding:15px; font-size:12px; color:#53717a; }
        .samee3-tafsir-error { margin-top:12px; padding:12px; border:1px solid #f1c9bf; border-radius:13px; background:#fff5f2; font-size:12px; color:#a54333; line-height:1.85; }
        .samee3-tafsir-error button { margin-top:6px; border:0; background:#fff; border-radius:9px; padding:6px 12px; color:#a54333; font-weight:800; }
        .samee3-tafsir-empty { margin-top:12px; font-size:12px; line-height:1.9; color:#839092; }
        .samee3-tafsir-box { margin-top:13px; background:#fffefa; border:1px solid #e2d8c4; border-radius:16px; padding:18px; color:#384953; }
        .samee3-tafsir-title { display:flex; align-items:flex-start; justify-content:space-between; gap:9px; padding-bottom:12px; border-bottom:1px solid #eee5d8; }
        .samee3-tafsir-title > div { display:flex; flex-direction:column; gap:4px; }
        .samee3-tafsir-title > div span { color:#b38b4f; font-size:10px; font-weight:800; }
        .samee3-tafsir-title strong { font-size:14px; font-weight:900; color:#234a51; }
        .samee3-tafsir-title small { max-width:50%; color:#998a73; font-size:10px; font-weight:750; line-height:1.6; text-align:left; }
        .samee3-tafsir-title button { display:flex; align-items:center; justify-content:center; width:35px; height:35px; flex-shrink:0; border:1px solid #e5d8c3; border-radius:10px; background:#fffefa; color:#8d6b39; }
        .samee3-tafsir-box p { margin:13px 0 0; white-space:pre-wrap; font-family:'Amiri','Tajawal',serif; font-size:clamp(17px,2.8vw,20px); line-height:2.1; text-align:justify; overflow-wrap:break-word; }
        .samee3-tafsir-box footer { margin-top:14px; font-size:10px; color:#ac9b80; text-align:left; }
        .samee3-image-preview-overlay { position:absolute; z-index:150; inset:0; display:flex; align-items:center; justify-content:center; padding:12px; background:rgba(8,24,33,.70); backdrop-filter:blur(9px); }
        .samee3-image-preview-sheet { width:min(94vw,600px); max-height:94dvh; overflow:auto; border-radius:24px; background:#fffefa; border:1px solid #e0d1b5; box-shadow:0 24px 90px rgba(8,24,33,.34); padding:16px; }
        .samee3-image-preview-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:5px 3px 14px; }
        .samee3-image-preview-head > div { display:flex; flex-direction:column; gap:3px; }
        .samee3-image-preview-head span { color:#a47e47; font-size:11px; font-weight:800; }
        .samee3-image-preview-head strong { color:#194752; font-family:'Aref Ruqaa','Amiri',serif; font-size:22px; }
        .samee3-image-preview-head button { width:38px; height:38px; border:0; border-radius:12px; background:#f2eee7; color:#5d6b75; display:flex; align-items:center; justify-content:center; }
        .samee3-image-preview-frame { display:flex; align-items:center; justify-content:center; padding:12px; border-radius:18px; background:#efebe3; border:1px solid #e4d7c6; overflow:hidden; }
        .samee3-image-preview-frame img { display:block; width:100%; height:auto; max-height:65dvh; object-fit:contain; border-radius:10px; }
        .samee3-image-preview-actions { display:flex; gap:9px; margin-top:12px; }
        .samee3-image-preview-actions button { display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px; border-radius:13px; border:0; color:white; font-size:13px; font-weight:900; }
        .samee3-image-share-btn { flex:1; background:#2a6973; }
        .samee3-image-download-btn { flex:1.4; background:#b18447; }
        .samee3-image-preview-actions button:disabled { opacity:.5; }
        .samee3-toast { position:absolute; z-index:130; left:50%; bottom:calc(max(12px,env(safe-area-inset-bottom)) + 84px); transform:translateX(-50%); display:flex; align-items:center; gap:7px; padding:10px 14px; border-radius:999px; background:#173d45; color:#fff; font-size:11px; font-weight:900; box-shadow:0 10px 30px rgba(18,49,57,.25); }

        @media (prefers-reduced-motion: reduce) {
          .samee3-live-ayah-highlight { transition:none !important; }
        }

        @media (max-width:767px) {
          .samee3-page-meta { height:46px; padding:5px 10px 0; }
          .samee3-page-meta .meta-side { font-size:11px; }
          .samee3-page-meta .meta-badge { height:26px; min-width:26px; }
          .samee3-surah-frame { top:42px; left:6%; right:6%; height:39px; }
          .samee3-surah-frame strong { min-width:135px; font-size:18px; }
          .samee3-page-art { inset:82px 3px 72px; }
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
          .samee3-text-line { font-size:clamp(18px,4.6vw,25px); }
          .samee3-text-line-svg { font-size:30px; }
          .samee3-page-footer { left:12px; bottom:calc(max(2px,env(safe-area-inset-bottom)) + 7px); }
          .samee3-ayah-actions-grid { grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; }
          .samee3-ayah-actions-grid button { min-height:69px; font-size:10px; }
          .samee3-ayah-sheet { max-height:92dvh; padding:13px 12px 20px; border-radius:23px; }
          .samee3-image-actions { grid-template-columns:1fr; }
          .samee3-ayah-preview { padding:18px 12px; }
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
  const isRealRiwayaImagePage = html.includes('data-samee3-real-riwaya="true"')

  return (
    <section
      className={`samee3-page-sheet ${side} ${isRealRiwayaImagePage ? 'samee3-real-riwaya-page' : ''}`}
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


/**
 * Premium SAMEE3 image renderer. The Quran and commentary are measured
 * completely BEFORE choosing the canvas size. No implicit clipping/ellipsis.
 * If a commentary exceeds mobile canvas limits, fail with an explanation.
 */
function drawSamee3AyahCard({
  ayah,
  surah,
  ayahNumber,
  riwaya,
  tafsir,
  tafsirBook,
  withTafsir,
  theme,
  format,
}: {
  ayah: string
  surah: string
  ayahNumber: number
  riwaya: string
  tafsir: string
  tafsirBook: TafsirBook | null
  withTafsir: boolean
  theme: CardTheme
  format: CardFormat
}): HTMLCanvasElement {
  const width = 1080
  const canvas = document.createElement('canvas')
  const side = 95
  const innerWidth = width - side * 2
  const verseFont = '"Amiri Quran", "Amiri", serif'
  const tafsirFont = '"Amiri", "Tajawal", serif'

  const verse = fitArabicLines(canvas, ayah, verseFont, 70, 43, innerWidth - 76, 10000)
  const explanation = withTafsir
    ? fitArabicLines(canvas, tafsir, tafsirFont, 36, 29, innerWidth - 72, 10000)
    : null
  const verseSpace = verse.lines.length * verse.lineHeight
  const tafsirSpace = explanation ? explanation.lines.length * explanation.lineHeight : 0
  const headerSpace = 290
  const verseCardTop = headerSpace
  const verseCardHeight = Math.max(295, verseSpace + 126)
  const tafsirTop = verseCardTop + verseCardHeight + 55
  const tafsirCardHeight = explanation ? tafsirSpace + 195 : 0
  const footerTop = explanation ? tafsirTop + tafsirCardHeight + 74 : verseCardTop + verseCardHeight + 92
  const minimumHeight = format === 'square' ? 1080 : format === 'story' ? 1920 : 1030
  const requiredHeight = Math.max(1030, footerTop + 110)
  if (format !== 'auto' && requiredHeight > minimumHeight) {
    throw new Error('النص أطول من مقاس الصورة المختار. اختر «تلقائي للنص الكامل» لتجنب قص الآية أو التفسير.')
  }
  const height = Math.max(minimumHeight, requiredHeight)

  // Avoid mobile canvas allocation failures and never silently drop text.
  if (height > 7800 || width * height > 9000000) {
    throw new Error(withTafsir
      ? 'هذا التفسير طويل جدًا ليظهر كاملًا في صورة واحدة. اختر تفسيرًا مختصرًا، وسيظل النص كاملًا متاحًا داخل المصحف.'
      : 'هذه الآية طويلة جدًا لإخراجها بصورة واحدة على هذا الجهاز.')
  }

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('متصفحك لا يدعم إنشاء صور الآيات.')

  const rounded = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
  const ink = theme === 'night' ? '#f6f0e5' : '#1c3943'
  const gold = theme === 'gold' ? '#a8772b' : theme === 'night' ? '#dec08d' : '#b18b53'
  const muted = theme === 'night' ? '#cbbfae' : '#6c7b7c'
  const paper = theme === 'night' ? '#142a35' : theme === 'gold' ? '#f2e5c8' : '#f2eddf'
  const frame = theme === 'night' ? '#1e3b47' : theme === 'gold' ? '#fffbef' : '#fcfaf5'
  const versePaper = theme === 'night' ? '#244653' : '#fffefa'
  const tafsirPaper = theme === 'night' ? '#213944' : '#f7f5ee'

  // Background: warm ivory, thin manuscript frame, restrained accents.
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = frame
  rounded(24, 24, width - 48, height - 48, 35)
  ctx.fill()
  ctx.strokeStyle = '#d4bb91'
  ctx.lineWidth = 2
  rounded(44, 44, width - 88, height - 88, 25)
  ctx.stroke()
  ctx.strokeStyle = '#e7dac1'
  ctx.lineWidth = 1
  rounded(56, 56, width - 112, height - 112, 18)
  ctx.stroke()

  // Masthead. Make the riwaya explicit, rather than treating all texts as Hafs.
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.direction = 'rtl'
  ctx.font = '700 43px "Amiri", serif'
  ctx.fillText('مصحف سميع', width / 2, 126)
  ctx.fillStyle = gold
  ctx.font = '600 22px "Tajawal", sans-serif'
  ctx.fillText('القرآن الكريم', width / 2, 166)
  ctx.strokeStyle = '#c8a978'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(330, 188)
  ctx.lineTo(492, 188)
  ctx.moveTo(588, 188)
  ctx.lineTo(750, 188)
  ctx.stroke()
  ctx.font = '33px "Amiri", serif'
  ctx.fillText('۞', 540, 201)
  ctx.fillStyle = ink
  ctx.font = '700 38px "Amiri", serif'
  ctx.fillText(`سورة ${surah}`, 540, 247)
  ctx.fillStyle = muted
  ctx.font = '600 20px "Tajawal", sans-serif'
  ctx.fillText(`الآية ${arabicNumber(ayahNumber)}  •  ${riwaya}`, 540, 279)

  // Quran verse card.
  ctx.save()
  ctx.shadowColor = 'rgba(23,49,57,.11)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 9
  rounded(side, verseCardTop, innerWidth, verseCardHeight, 27)
  ctx.fillStyle = versePaper
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#ddc7a4'
  ctx.lineWidth = 1.8
  rounded(side, verseCardTop, innerWidth, verseCardHeight, 27)
  ctx.stroke()
  ctx.fillStyle = gold
  ctx.font = '29px "Amiri", serif'
  ctx.fillText('﴿', 155, verseCardTop + 53)
  ctx.fillText('﴾', 925, verseCardTop + 53)
  drawFittedArabicLines(ctx, verse, 540, verseCardTop + 90, ink)
  ctx.fillStyle = '#957548'
  ctx.font = '600 21px "Tajawal", sans-serif'
  ctx.fillText(`۞ ${arabicNumber(ayahNumber)} ۞`, 540, verseCardTop + verseCardHeight - 34)

  // Commentary is a separate reading panel, not small footnote text.
  if (explanation) {
    ctx.fillStyle = gold
    ctx.textAlign = 'right'
    ctx.font = '700 27px "Tajawal", sans-serif'
    ctx.fillText('تفسير الآية', width - side - 9, tafsirTop - 16)
    rounded(side, tafsirTop, innerWidth, tafsirCardHeight, 24)
    ctx.fillStyle = tafsirPaper
    ctx.fill()
    ctx.strokeStyle = '#e1d3b9'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.font = '700 28px "Tajawal", sans-serif'
    ctx.fillText(tafsirBook?.short_name || tafsirBook?.name || 'التفسير', width - side - 36, tafsirTop + 48)
    ctx.fillStyle = muted
    ctx.font = '500 17px "Tajawal", sans-serif'
    if (tafsirBook?.author) ctx.fillText(tafsirBook.author, width - side - 36, tafsirTop + 83)
    ctx.strokeStyle = '#e1d6c4'
    ctx.beginPath()
    ctx.moveTo(side + 33, tafsirTop + 103)
    ctx.lineTo(width - side - 33, tafsirTop + 103)
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.direction = 'rtl'
    ctx.font = `${explanation.fontSize}px ${explanation.fontFamily}`
    drawFittedArabicLines(ctx, explanation, 540, tafsirTop + 151, ink)
  }

  // Footer intentionally contains no links or claims about authentication.
  ctx.fillStyle = '#a48b64'
  ctx.textAlign = 'center'
  ctx.font = '700 22px "Tajawal", sans-serif'
  ctx.fillText('مصحف سميع  •  مشاركة آية من القرآن الكريم', 540, height - 88)
  ctx.fillStyle = muted
  ctx.font = '500 17px "Tajawal", sans-serif'
  ctx.fillText(withTafsir ? 'التفسير من المصدر المختار' : riwaya, 540, height - 59)
  return canvas
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
