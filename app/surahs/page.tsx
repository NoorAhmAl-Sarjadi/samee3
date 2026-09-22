'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Loader2,
  Mic2,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'

const LOGO_URL = 'https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png'

const surahsList = [
{ id: 1, name: 'الفاتحة', type: 'مكية', ayahs: 7, startPage: 1 },
  { id: 2, name: 'البقرة', type: 'مدنية', ayahs: 286, startPage: 2 },
  { id: 3, name: 'آل عمران', type: 'مدنية', ayahs: 200, startPage: 50 },
  { id: 4, name: 'النساء', type: 'مدنية', ayahs: 176, startPage: 77 },
  { id: 5, name: 'المائدة', type: 'مدنية', ayahs: 120, startPage: 106 },
  { id: 6, name: 'الأنعام', type: 'مكية', ayahs: 165, startPage: 128 },
  { id: 7, name: 'الأعراف', type: 'مكية', ayahs: 206, startPage: 151 },
  { id: 8, name: 'الأنفال', type: 'مدنية', ayahs: 75, startPage: 177 },
  { id: 9, name: 'التوبة', type: 'مدنية', ayahs: 129, startPage: 187 },
  { id: 10, name: 'يونس', type: 'مكية', ayahs: 109, startPage: 208 },
  { id: 11, name: 'هود', type: 'مكية', ayahs: 123, startPage: 221 },
  { id: 12, name: 'يوسف', type: 'مكية', ayahs: 111, startPage: 235 },
  { id: 13, name: 'الرعد', type: 'مدنية', ayahs: 43, startPage: 249 },
  { id: 14, name: 'إبراهيم', type: 'مكية', ayahs: 52, startPage: 255 },
  { id: 15, name: 'الحجر', type: 'مكية', ayahs: 99, startPage: 262 },
  { id: 16, name: 'النحل', type: 'مكية', ayahs: 128, startPage: 267 },
  { id: 17, name: 'الإسراء', type: 'مكية', ayahs: 111, startPage: 282 },
  { id: 18, name: 'الكهف', type: 'مكية', ayahs: 110, startPage: 293 },
  { id: 19, name: 'مريم', type: 'مكية', ayahs: 98, startPage: 305 },
  { id: 20, name: 'طه', type: 'مكية', ayahs: 135, startPage: 312 },
  { id: 21, name: 'الأنبياء', type: 'مكية', ayahs: 112, startPage: 322 },
  { id: 22, name: 'الحج', type: 'مدنية', ayahs: 78, startPage: 332 },
  { id: 23, name: 'المؤمنون', type: 'مكية', ayahs: 118, startPage: 342 },
  { id: 24, name: 'النور', type: 'مدنية', ayahs: 64, startPage: 350 },
  { id: 25, name: 'الفرقان', type: 'مكية', ayahs: 77, startPage: 359 },
  { id: 26, name: 'الشعراء', type: 'مكية', ayahs: 227, startPage: 367 },
  { id: 27, name: 'النمل', type: 'مكية', ayahs: 93, startPage: 377 },
  { id: 28, name: 'القصص', type: 'مكية', ayahs: 88, startPage: 385 },
  { id: 29, name: 'العنكبوت', type: 'مكية', ayahs: 69, startPage: 396 },
  { id: 30, name: 'الروم', type: 'مكية', ayahs: 60, startPage: 404 },
  { id: 31, name: 'لقمان', type: 'مكية', ayahs: 34, startPage: 411 },
  { id: 32, name: 'السجدة', type: 'مكية', ayahs: 30, startPage: 415 },
  { id: 33, name: 'الأحزاب', type: 'مدنية', ayahs: 73, startPage: 418 },
  { id: 34, name: 'سبأ', type: 'مكية', ayahs: 54, startPage: 428 },
  { id: 35, name: 'فاطر', type: 'مكية', ayahs: 45, startPage: 434 },
  { id: 36, name: 'يس', type: 'مكية', ayahs: 83, startPage: 440 },
  { id: 37, name: 'الصافات', type: 'مكية', ayahs: 182, startPage: 446 },
  { id: 38, name: 'ص', type: 'مكية', ayahs: 88, startPage: 453 },
  { id: 39, name: 'الزمر', type: 'مكية', ayahs: 75, startPage: 458 },
  { id: 40, name: 'غافر', type: 'مكية', ayahs: 85, startPage: 467 },
  { id: 41, name: 'فصلت', type: 'مكية', ayahs: 54, startPage: 477 },
  { id: 42, name: 'الشورى', type: 'مكية', ayahs: 53, startPage: 483 },
  { id: 43, name: 'الزخرف', type: 'مكية', ayahs: 89, startPage: 489 },
  { id: 44, name: 'الدخان', type: 'مكية', ayahs: 59, startPage: 496 },
  { id: 45, name: 'الجاثية', type: 'مكية', ayahs: 37, startPage: 499 },
  { id: 46, name: 'الأحقاف', type: 'مكية', ayahs: 35, startPage: 502 },
  { id: 47, name: 'محمد', type: 'مدنية', ayahs: 38, startPage: 507 },
  { id: 48, name: 'الفتح', type: 'مدنية', ayahs: 29, startPage: 511 },
  { id: 49, name: 'الحجرات', type: 'مدنية', ayahs: 18, startPage: 515 },
  { id: 50, name: 'ق', type: 'مكية', ayahs: 45, startPage: 518 },
  { id: 51, name: 'الذاريات', type: 'مكية', ayahs: 60, startPage: 520 },
  { id: 52, name: 'الطور', type: 'مكية', ayahs: 49, startPage: 523 },
  { id: 53, name: 'النجم', type: 'مكية', ayahs: 62, startPage: 526 },
  { id: 54, name: 'القمر', type: 'مكية', ayahs: 55, startPage: 528 },
  { id: 55, name: 'الرحمن', type: 'مدنية', ayahs: 78, startPage: 531 },
  { id: 56, name: 'الواقعة', type: 'مكية', ayahs: 96, startPage: 534 },
  { id: 57, name: 'الحديد', type: 'مدنية', ayahs: 29, startPage: 537 },
  { id: 58, name: 'المجادلة', type: 'مدنية', ayahs: 22, startPage: 542 },
  { id: 59, name: 'الحشر', type: 'مدنية', ayahs: 24, startPage: 545 },
  { id: 60, name: 'الممتحنة', type: 'مدنية', ayahs: 13, startPage: 549 },
  { id: 61, name: 'الصف', type: 'مدنية', ayahs: 14, startPage: 551 },
  { id: 62, name: 'الجمعة', type: 'مدنية', ayahs: 11, startPage: 553 },
  { id: 63, name: 'المنافقون', type: 'مدنية', ayahs: 11, startPage: 554 },
  { id: 64, name: 'التغابن', type: 'مدنية', ayahs: 18, startPage: 556 },
  { id: 65, name: 'الطلاق', type: 'مدنية', ayahs: 12, startPage: 558 },
  { id: 66, name: 'التحريم', type: 'مدنية', ayahs: 12, startPage: 560 },
  { id: 67, name: 'الملك', type: 'مكية', ayahs: 30, startPage: 562 },
  { id: 68, name: 'القلم', type: 'مكية', ayahs: 52, startPage: 564 },
  { id: 69, name: 'الحاقة', type: 'مكية', ayahs: 52, startPage: 566 },
  { id: 70, name: 'المعارج', type: 'مكية', ayahs: 44, startPage: 568 },
  { id: 71, name: 'نوح', type: 'مكية', ayahs: 28, startPage: 570 },
  { id: 72, name: 'الجن', type: 'مكية', ayahs: 28, startPage: 572 },
  { id: 73, name: 'المزمل', type: 'مكية', ayahs: 20, startPage: 574 },
  { id: 74, name: 'المدثر', type: 'مكية', ayahs: 56, startPage: 575 },
  { id: 75, name: 'القيامة', type: 'مكية', ayahs: 40, startPage: 577 },
  { id: 76, name: 'الإنسان', type: 'مدنية', ayahs: 31, startPage: 578 },
  { id: 77, name: 'المرسلات', type: 'مكية', ayahs: 50, startPage: 580 },
  { id: 78, name: 'النبأ', type: 'مكية', ayahs: 40, startPage: 582 },
  { id: 79, name: 'النازعات', type: 'مكية', ayahs: 46, startPage: 583 },
  { id: 80, name: 'عبس', type: 'مكية', ayahs: 42, startPage: 585 },
  { id: 81, name: 'التكوير', type: 'مكية', ayahs: 29, startPage: 586 },
  { id: 82, name: 'الانفطار', type: 'مكية', ayahs: 19, startPage: 587 },
  { id: 83, name: 'المطففين', type: 'مكية', ayahs: 36, startPage: 587 },
  { id: 84, name: 'الانشقاق', type: 'مكية', ayahs: 25, startPage: 589 },
  { id: 85, name: 'البروج', type: 'مكية', ayahs: 22, startPage: 590 },
  { id: 86, name: 'الطارق', type: 'مكية', ayahs: 17, startPage: 591 },
  { id: 87, name: 'الأعلى', type: 'مكية', ayahs: 19, startPage: 591 },
  { id: 88, name: 'الغاشية', type: 'مكية', ayahs: 26, startPage: 592 },
  { id: 89, name: 'الفجر', type: 'مكية', ayahs: 30, startPage: 593 },
  { id: 90, name: 'البلد', type: 'مكية', ayahs: 20, startPage: 594 },
  { id: 91, name: 'الشمس', type: 'مكية', ayahs: 15, startPage: 595 },
  { id: 92, name: 'الليل', type: 'مكية', ayahs: 21, startPage: 595 },
  { id: 93, name: 'الضحى', type: 'مكية', ayahs: 11, startPage: 596 },
  { id: 94, name: 'الشرح', type: 'مكية', ayahs: 8, startPage: 596 },
  { id: 95, name: 'التين', type: 'مكية', ayahs: 8, startPage: 597 },
  { id: 96, name: 'العلق', type: 'مكية', ayahs: 19, startPage: 597 },
  { id: 97, name: 'القدر', type: 'مكية', ayahs: 5, startPage: 598 },
  { id: 98, name: 'البينة', type: 'مدنية', ayahs: 8, startPage: 598 },
  { id: 99, name: 'الزلزلة', type: 'مدنية', ayahs: 8, startPage: 599 },
  { id: 100, name: 'العاديات', type: 'مكية', ayahs: 11, startPage: 599 },
  { id: 101, name: 'القارعة', type: 'مكية', ayahs: 11, startPage: 600 },
  { id: 102, name: 'التكاثر', type: 'مكية', ayahs: 8, startPage: 600 },
  { id: 103, name: 'العصر', type: 'مكية', ayahs: 3, startPage: 601 },
  { id: 104, name: 'الهمزة', type: 'مكية', ayahs: 9, startPage: 601 },
  { id: 105, name: 'الفيل', type: 'مكية', ayahs: 5, startPage: 601 },
  { id: 106, name: 'قريش', type: 'مكية', ayahs: 4, startPage: 602 },
  { id: 107, name: 'الماعون', type: 'مكية', ayahs: 7, startPage: 602 },
  { id: 108, name: 'الكوثر', type: 'مكية', ayahs: 3, startPage: 602 },
  { id: 109, name: 'الكافرون', type: 'مكية', ayahs: 6, startPage: 603 },
  { id: 110, name: 'النصر', type: 'مدنية', ayahs: 3, startPage: 603 },
  { id: 111, name: 'المسد', type: 'مكية', ayahs: 5, startPage: 603 },
  { id: 112, name: 'الإخلاص', type: 'مكية', ayahs: 4, startPage: 604 },
  { id: 113, name: 'الفلق', type: 'مكية', ayahs: 5, startPage: 604 },
  { id: 114, name: 'الناس', type: 'مكية', ayahs: 6, startPage: 604 }
]

const RIWAYAT = [
  { id: 'hafs', label: 'حفص عن عاصم', keywords: ['حفص', 'عاصم'] },
  { id: 'warsh', label: 'ورش عن نافع', keywords: ['ورش', 'نافع'] },
  { id: 'qalun', label: 'قالون عن نافع', keywords: ['قالون', 'نافع'] },
  { id: 'douri', label: 'الدوري عن أبي عمرو', keywords: ['الدوري', 'أبي عمرو', 'ابي عمرو'] },
  { id: 'shubah', label: 'شعبة عن عاصم', keywords: ['شعبة', 'شعبه', 'عاصم'] },
  { id: 'sousi', label: 'السوسي عن أبي عمرو', keywords: ['السوسي', 'أبي عمرو', 'ابي عمرو'] },
  { id: 'bazzi', label: 'البزي عن ابن كثير', keywords: ['البزي', 'ابن كثير'] },
] as const

type RiwayaId = (typeof RIWAYAT)[number]['id']
type FilterType = 'all' | 'مكية' | 'مدنية'
type PanelType = 'surahs' | 'juz' | null

type ApiMoshaf = {
  id?: number
  name?: string
  server?: string
  surah_total?: number
  moshaf_type?: number
  surah_list?: string
}

type ApiReciter = {
  id: number
  name: string
  moshaf?: ApiMoshaf[]
}

type ApiRiwaya = {
  id: number
  name: string
}

type Reciter = {
  id: string
  apiId: number
  label: string
  moshaf: ApiMoshaf
}

type SearchMatch = {
  number: number
  numberInSurah: number
  text: string
  page?: number
  juz?: number
  surah?: { number: number; name: string }
}

const JUZ_LIST = [
  { number: 1, page: 1, surah: 1, ayah: 1 },
  { number: 2, page: 22, surah: 2, ayah: 142 },
  { number: 3, page: 42, surah: 2, ayah: 253 },
  { number: 4, page: 62, surah: 3, ayah: 92 },
  { number: 5, page: 82, surah: 4, ayah: 24 },
  { number: 6, page: 102, surah: 5, ayah: 83 },
  { number: 7, page: 122, surah: 6, ayah: 111 },
  { number: 8, page: 142, surah: 7, ayah: 88 },
  { number: 9, page: 162, surah: 8, ayah: 41 },
  { number: 10, page: 182, surah: 9, ayah: 93 },
  { number: 11, page: 202, surah: 10, ayah: 26 },
  { number: 12, page: 222, surah: 11, ayah: 6 },
  { number: 13, page: 242, surah: 12, ayah: 53 },
  { number: 14, page: 262, surah: 15, ayah: 1 },
  { number: 15, page: 282, surah: 17, ayah: 1 },
  { number: 16, page: 302, surah: 18, ayah: 75 },
  { number: 17, page: 322, surah: 21, ayah: 1 },
  { number: 18, page: 342, surah: 23, ayah: 1 },
  { number: 19, page: 362, surah: 25, ayah: 21 },
  { number: 20, page: 382, surah: 27, ayah: 56 },
  { number: 21, page: 402, surah: 29, ayah: 45 },
  { number: 22, page: 422, surah: 33, ayah: 31 },
  { number: 23, page: 442, surah: 36, ayah: 28 },
  { number: 24, page: 462, surah: 39, ayah: 32 },
  { number: 25, page: 482, surah: 41, ayah: 47 },
  { number: 26, page: 502, surah: 46, ayah: 1 },
  { number: 27, page: 522, surah: 51, ayah: 31 },
  { number: 28, page: 542, surah: 58, ayah: 1 },
  { number: 29, page: 562, surah: 67, ayah: 1 },
  { number: 30, page: 582, surah: 78, ayah: 1 },
] as const

function toArabicNumber(value: number) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
}

function getRiwaya(id: RiwayaId) {
  return RIWAYAT.find((item) => item.id === id) || RIWAYAT[0]
}

function matchesRemoteRiwaya(remoteName: string, local: typeof RIWAYAT[number]) {
  const name = normalizeArabic(remoteName)
  const first = normalizeArabic(local.keywords[0])

  if (local.id === 'hafs' || local.id === 'shubah') {
    return name.includes(first) && name.includes(normalizeArabic('عاصم'))
  }

  if (local.id === 'warsh' || local.id === 'qalun') {
    return name.includes(first) && name.includes(normalizeArabic('نافع'))
  }

  if (local.id === 'douri' || local.id === 'sousi') {
    return name.includes(first)
  }

  if (local.id === 'bazzi') {
    return name.includes(first)
  }

  return name.includes(first)
}

function getMoshaf(reciter: ApiReciter, local: typeof RIWAYAT[number]) {
  const list = Array.isArray(reciter.moshaf) ? reciter.moshaf : []
  return (
    list.find((item) => {
      const name = normalizeArabic(String(item.name || ''))
      return local.keywords.some((keyword) => name.includes(normalizeArabic(keyword)))
    }) || list[0] || null
  )
}

function parseSurahList(value?: string) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 114)
}

export default function QuranIndexPage() {
  const [riwaya, setRiwaya] = useState<RiwayaId>('hafs')
  const [riwayaSearch, setRiwayaSearch] = useState('')
  const [reciterSearch, setReciterSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [panel, setPanel] = useState<PanelType>(null)

  const [apiRiwayat, setApiRiwayat] = useState<ApiRiwaya[]>([])
  const [reciters, setReciters] = useState<Reciter[]>([])
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null)
  const [recitersLoading, setRecitersLoading] = useState(false)
  const [recitersError, setRecitersError] = useState('')
  const selectedReciterApiIdRef = useRef<number | null>(null)

  const [ayahResults, setAyahResults] = useState<SearchMatch[]>([])
  const [ayahSearching, setAyahSearching] = useState(false)

  useEffect(() => {
    try {
      const savedRiwaya = localStorage.getItem('samee3_selected_riwaya_v2') as RiwayaId | null
      const savedReciter = localStorage.getItem('samee3_selected_reciter_v2')

      if (savedRiwaya && RIWAYAT.some((item) => item.id === savedRiwaya)) {
        setRiwaya(savedRiwaya)
      }

      if (savedReciter) {
        const parsed = JSON.parse(savedReciter) as Partial<Reciter>
        if (parsed?.apiId) {
          selectedReciterApiIdRef.current = Number(parsed.apiId)
        }
      }
    } catch {
      // تجاهل أخطاء التخزين المحلي
    }
  }, [])

  const loadRiwayat = useCallback(async () => {
    try {
      const response = await fetch('https://mp3quran.net/api/v3/riwayat?language=ar', {
        cache: 'no-store',
      })

      if (!response.ok) throw new Error('Failed to load riwayat')

      const payload = await response.json()
      setApiRiwayat(Array.isArray(payload?.riwayat) ? payload.riwayat : [])
    } catch (error) {
      console.error('Riwayat load error:', error)
      setApiRiwayat([])
      setRecitersError('تعذر الاتصال بمصدر الروايات الصوتية الآن.')
    }
  }, [])

  useEffect(() => {
    void loadRiwayat()
  }, [loadRiwayat])

  const loadRecitersForRiwaya = useCallback(async (riwayaId: RiwayaId) => {
    if (!apiRiwayat.length) return

    const localRiwaya = getRiwaya(riwayaId)
    const remoteRiwaya = apiRiwayat.find((item) => matchesRemoteRiwaya(item.name, localRiwaya))

    setRecitersLoading(true)
    setRecitersError('')
    setReciters([])
    setSelectedReciter(null)
    setPanel(null)
    setReciterSearch('')

    try {
      if (!remoteRiwaya) {
        throw new Error(`No source rewaya id for ${localRiwaya.label}`)
      }

      const response = await fetch(
        `https://mp3quran.net/api/v3/reciters?language=ar&rewaya=${remoteRiwaya.id}`,
        { cache: 'no-store' },
      )

      if (!response.ok) throw new Error('Failed to load reciters for rewaya')

      const payload = await response.json()
      const sourceReciters: ApiReciter[] = Array.isArray(payload?.reciters)
        ? payload.reciters
        : []

      const nextReciters = sourceReciters
        .map((item) => {
          const moshaf = getMoshaf(item, localRiwaya)
          if (!moshaf?.server || !moshaf?.surah_list) return null

          const reciter: Reciter = {
            id: `mp3quran-${item.id}-${moshaf.id ?? riwayaId}`,
            apiId: Number(item.id),
            label: String(item.name || `قارئ ${item.id}`),
            moshaf,
          }

          return reciter
        })
        .filter((item): item is Reciter => item !== null)

      const uniqueReciters = Array.from(
        new Map(nextReciters.map((item) => [`${item.apiId}-${item.moshaf.id ?? riwayaId}`, item])).values(),
      )

      uniqueReciters.sort((a, b) => {
        const priority = [
          'مشاري',
          'العفاسي',
          'الحصري',
          'المنشاوي',
          'ماهر',
          'عبد الباسط',
          'السديس',
          'الدوسري',
          'الشريم',
        ]

        const ai = priority.findIndex((name) => normalizeArabic(a.label).includes(normalizeArabic(name)))
        const bi = priority.findIndex((name) => normalizeArabic(b.label).includes(normalizeArabic(name)))

        if (ai !== -1 && bi === -1) return -1
        if (ai === -1 && bi !== -1) return 1
        if (ai !== -1 && bi !== -1 && ai !== bi) return ai - bi

        return a.label.localeCompare(b.label, 'ar')
      })

      setReciters(uniqueReciters)

      if (uniqueReciters.length) {
        const restored = selectedReciterApiIdRef.current != null
          ? uniqueReciters.find((item) => item.apiId === selectedReciterApiIdRef.current)
          : undefined

        const initial = restored || uniqueReciters[0]
        setSelectedReciter(initial)
        selectedReciterApiIdRef.current = initial.apiId

        try {
          localStorage.setItem('samee3_selected_reciter_v2', JSON.stringify(initial))
        } catch {}
      } else {
        setRecitersError('لا توجد تسجيلات لهذه الرواية في المصدر حاليًا.')
      }
    } catch (error) {
      console.error('Reciters by riwaya error:', error)
      setRecitersError('تعذر تحميل القراء الخاصين بهذه الرواية حاليًا.')
    } finally {
      setRecitersLoading(false)
    }
  }, [apiRiwayat])

  useEffect(() => {
    if (apiRiwayat.length) void loadRecitersForRiwaya(riwaya)
  }, [apiRiwayat, loadRecitersForRiwaya, riwaya])

  const handleRiwayaChange = (value: RiwayaId) => {
    setRiwaya(value)
    setPanel(null)
    try {
      localStorage.setItem('samee3_selected_riwaya_v2', value)
    } catch {}
  }

  const handleReciterChange = (value: Reciter) => {
    selectedReciterApiIdRef.current = value.apiId
    setSelectedReciter(value)
    try {
      localStorage.setItem('samee3_selected_reciter_v2', JSON.stringify(value))
    } catch {}
  }

  const filteredRiwayat = useMemo(() => {
    const term = normalizeArabic(riwayaSearch)
    const result = RIWAYAT.filter((item) => !term || normalizeArabic(item.label).includes(term))
    const current = result.find((item) => item.id === riwaya)
    return current ? [current, ...result.filter((item) => item.id !== riwaya)] : result
  }, [riwaya, riwayaSearch])

  const filteredReciters = useMemo(() => {
    const term = normalizeArabic(reciterSearch)
    const result = reciters.filter((item) => !term || normalizeArabic(item.label).includes(term))
    if (selectedReciter && !result.some((item) => item.id === selectedReciter.id)) {
      return [selectedReciter, ...result]
    }
    return result
  }, [reciterSearch, reciters, selectedReciter])

  const availableSurahIds = useMemo(() =>
    selectedReciter ? parseSurahList(selectedReciter.moshaf.surah_list) : [],
    [selectedReciter],
  )

  const filteredSurahs = useMemo(() => {
    const term = normalizeArabic(query).replace(/^سوره/, '')

    return surahsList.filter((surah) => {
      const isAvailable = availableSurahIds.includes(surah.id)
      const matchesQuery = !term ||
        normalizeArabic(surah.name).includes(term) ||
        String(surah.id).includes(term) ||
        String(surah.startPage).includes(term)
      const matchesFilter = filter === 'all' || surah.type === filter

      return isAvailable && matchesQuery && matchesFilter
    })
  }, [availableSurahIds, filter, query])

  useEffect(() => {
    const term = query.trim()

    if (term.length < 2) {
      setAyahResults([])
      setAyahSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setAyahSearching(true)

      try {
        const response = await fetch(
          `https://api.alquran.cloud/v1/search/${encodeURIComponent(term)}/all/ar`,
          { signal: controller.signal },
        )

        if (!response.ok) throw new Error('Ayah search failed')

        const payload = await response.json()
        setAyahResults(
          Array.isArray(payload?.data?.matches)
            ? payload.data.matches.slice(0, 30)
            : [],
        )
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Ayah search error:', error)
        }
      } finally {
        if (!controller.signal.aborted) setAyahSearching(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const openMushaf = (page: number, surahId: number, ayah?: number) => {
    if (!selectedReciter) return

    const params = new URLSearchParams({
      page: String(page),
      riwaya,
      surah: String(surahId),
      reciter: selectedReciter.id,
      reciterName: selectedReciter.label,
      reciterSource: 'mp3quran',
      reciterId: String(selectedReciter.apiId),
    })

    if (selectedReciter.moshaf.id != null) {
      params.set('moshafId', String(selectedReciter.moshaf.id))
    }

    if (ayah) params.set('ayah', String(ayah))

    window.location.href = `/mushaf?${params.toString()}`
  }

  const makkiyaCount = surahsList.filter((item) => item.type === 'مكية').length
  const madaniyaCount = surahsList.filter((item) => item.type === 'مدنية').length

  return (
    <main dir="rtl" className="min-h-screen bg-[#F7F4EC] pb-32 text-[#0F172A]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F525A] via-[#176F78] to-[#0A3940] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#D97706]/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 pb-5 pt-3 sm:px-7 sm:pb-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="الرئيسية"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/8 text-white backdrop-blur-xl transition hover:bg-white/12"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex flex-col items-center">
              <img
                src={LOGO_URL}
                alt="مصحف سميع"
                className="h-24 w-24 object-cover object-center [clip-path:circle(44%_at_50%_50%)] drop-shadow-[0_8px_18px_rgba(0,0,0,0.14)] sm:h-28 sm:w-28"
              />
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">فهرس السور</h1>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/8 text-[#F59E0B]">
              <BookOpen size={20} />
            </div>
          </div>

          <p className="mx-auto mt-2 max-w-2xl text-center text-xs font-medium leading-6 text-white/70 sm:text-sm">
            اختر الرواية ثم القارئ، وبعدها اضغط السور أو الأجزاء للانتقال مباشرة إلى موضع المصحف الفعلي.
          </p>

          <div className="mx-auto mt-3 grid max-w-4xl gap-2.5 md:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.07] p-2.5 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black">
                  <BookOpen size={16} className="text-[#F59E0B]" />
                  الرواية
                </span>
                <span className="text-[10px] font-bold text-white/40">بحث واختيار</span>
              </div>

              <div className="relative">
                <select
                  value={riwaya}
                  onChange={(event) => handleRiwayaChange(event.target.value as RiwayaId)}
                  className="w-full appearance-none rounded-2xl border border-white/15 bg-white px-4 py-2.5 text-sm font-black text-[#175E67] outline-none focus:ring-2 focus:ring-[#F59E0B]/10"
                >
                  {filteredRiwayat.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#D97706]" />
              </div>

              <div className="relative mt-2">
                <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0284C7]" />
                <input
                  value={riwayaSearch}
                  onChange={(event) => setRiwayaSearch(event.target.value)}
                  placeholder="ابحث عن الرواية"
                  className="w-full rounded-xl border border-white/10 bg-white/90 py-2.5 pr-9 text-xs font-bold text-[#175E67] outline-none placeholder:text-slate-400 focus:border-[#F59E0B]/40 focus:ring-2 focus:ring-[#F59E0B]/10"
                />
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.07] p-2.5 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black">
                  <Mic2 size={16} className="text-[#F59E0B]" />
                  القارئ
                </span>
                <span className="text-[10px] font-bold text-white/40">
                  {reciters.length ? `${toArabicNumber(reciters.length)} متاح` : 'حسب الرواية'}
                </span>
              </div>

              <div className="relative">
                <select
                  value={selectedReciter?.id || ''}
                  onChange={(event) => {
                    const next = reciters.find((item) => item.id === event.target.value)
                    if (next) handleReciterChange(next)
                  }}
                  disabled={recitersLoading || !filteredReciters.length}
                  className="w-full appearance-none rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-black text-[#175E67] outline-none disabled:opacity-60"
                >
                  {filteredReciters.length ? (
                    filteredReciters.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))
                  ) : (
                    <option value="">{recitersLoading ? 'جاري تحميل القراء...' : 'لا توجد تسجيلات متاحة'}</option>
                  )}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#D97706]" />
              </div>

              <div className="relative mt-2">
                <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0284C7]" />
                <input
                  value={reciterSearch}
                  onChange={(event) => setReciterSearch(event.target.value)}
                  placeholder="ابحث عن القارئ"
                  className="w-full rounded-xl border border-white/10 bg-white/90 py-2.5 pr-9 text-xs font-bold text-[#175E67] outline-none placeholder:text-slate-400 focus:border-[#F59E0B]/40 focus:ring-2 focus:ring-[#F59E0B]/10"
                />
              </div>
            </div>
          </div>

          {recitersLoading && (
            <div className="mx-auto mt-3 flex max-w-4xl items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/7 px-4 py-2.5 text-xs font-bold text-white/75">
              <Loader2 size={15} className="animate-spin" />
              جاري جلب القراء المتوفرين لهذه الرواية...
            </div>
          )}

          {recitersError && (
            <div className="mx-auto mt-3 max-w-4xl rounded-2xl border border-red-200/20 bg-red-500/10 px-4 py-2.5 text-center text-xs font-bold text-white/85">
              {recitersError}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto -mt-3 max-w-6xl px-4 sm:px-7">
        <div className="rounded-[28px] border border-[#E9E2D4] bg-white p-3 shadow-[0_12px_45px_rgba(56,40,20,0.10)] sm:p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPanel(panel === 'surahs' ? null : 'surahs')}
              className={`flex items-center justify-between rounded-[20px] border px-4 py-4 text-right transition ${panel === 'surahs' ? 'border-[#0284C7]/30 bg-[#EAF7FB]' : 'border-[#ECE4D5] bg-[#FCFBF8] hover:border-[#0284C7]/20'}`}
            >
              <div>
                <p className="text-lg font-black">السور</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">اضغط لإظهار السور المتاحة</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F5F9] text-[#0284C7]"><BookOpen size={24} /></span>
            </button>

            <button
              type="button"
              onClick={() => setPanel(panel === 'juz' ? null : 'juz')}
              className={`flex items-center justify-between rounded-[20px] border px-4 py-4 text-right transition ${panel === 'juz' ? 'border-[#D97706]/30 bg-[#FFF7E8]' : 'border-[#ECE4D5] bg-[#FCFBF8] hover:border-[#D97706]/20'}`}
            >
              <div>
                <p className="text-lg font-black">الأجزاء الثلاثون</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">اضغط لإظهار الأجزاء</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0D9] text-[#D97706]"><BookOpen size={24} /></span>
            </button>
          </div>

          {panel === 'surahs' && (
            <div className="mt-3 overflow-hidden rounded-[22px] border border-[#E9E2D4] bg-[#FCFBF8]">
              <div className="border-b border-[#EEE7DA] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">السور المتاحة للقارئ</h3>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                      {selectedReciter ? `تم تحميل السور المسجلة فعليًا لـ ${selectedReciter.label}` : 'اختر الرواية والقارئ أولًا'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-slate-500"><X size={15} /></button>
                </div>
                <div className="mt-3 rounded-xl border border-[#D8EAF0] bg-[#F0FAFD] px-3 py-2 text-[11px] font-bold leading-6 text-[#25636B]">
                  اختر الرواية والقارئ أولًا، ثم اضغط على السورة للانتقال مباشرة إلى صفحة المصحف الفعلية.
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto p-3">
                {selectedReciter ? (
                  filteredSurahs.length ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {filteredSurahs.map((surah) => (
                        <button key={surah.id} type="button" onClick={() => openMushaf(surah.startPage, surah.id)} className="group flex items-center justify-between rounded-2xl border border-[#E9E2D4] bg-white px-3 py-3 text-right transition hover:-translate-y-0.5 hover:border-[#0284C7]/35 hover:shadow-sm">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F9FE] text-sm font-black text-[#0284C7]">{toArabicNumber(surah.id)}</span>
                            <span className="min-w-0"><span className="block truncate text-sm font-black">سورة {surah.name}</span><span className="mt-1 block text-[9px] font-bold text-slate-400">{surah.type} · صفحة {toArabicNumber(surah.startPage)}</span></span>
                          </div>
                          <ChevronLeft size={16} className="shrink-0 text-[#D97706]" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm font-bold text-slate-400">لا توجد سور مطابقة للبحث أو الفلتر.</div>
                  )
                ) : (
                  <div className="py-10 text-center text-sm font-bold text-slate-400">اختر الرواية والقارئ لعرض السور الفعلية المتاحة له.</div>
                )}
              </div>
            </div>
          )}

          {panel === 'juz' && (
            <div className="mt-3 overflow-hidden rounded-[22px] border border-[#E9E2D4] bg-[#FCFBF8]">
              <div className="border-b border-[#EEE7DA] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="font-black">الأجزاء الثلاثون</h3><p className="mt-1 text-[10px] font-bold text-slate-400">اضغط على الجزء لفتح بدايته الفعلية</p></div>
                  <button type="button" onClick={() => setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-slate-500"><X size={15} /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10">
                {JUZ_LIST.map((juz) => (
                  <button key={juz.number} type="button" onClick={() => openMushaf(juz.page, juz.surah, juz.ayah)} className="rounded-2xl border border-[#E9E2D4] bg-white px-2 py-3 text-center transition hover:border-[#D97706]/35 hover:bg-[#FFF9EF]">
                    <span className="block text-sm font-black text-[#D97706]">الجزء {toArabicNumber(juz.number)}</span>
                    <span className="mt-1 block text-[9px] font-bold text-slate-400">صفحة {toArabicNumber(juz.page)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-5 sm:px-7">
        <div className="rounded-[26px] border border-[#E9E2D4] bg-white p-3 shadow-sm">
          <div className="relative">
            <Search size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#0284C7]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم السورة أو رقمها أو الصفحة أو كلمة من الآية..." className="w-full rounded-2xl border border-[#E6E0D2] bg-[#FCFBF8] py-4 pr-12 pl-12 text-sm font-bold outline-none focus:border-[#0284C7]/40 focus:ring-4 focus:ring-[#0284C7]/8" />
            {query && <button type="button" onClick={() => setQuery('')} className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/5 text-slate-500"><X size={15} /></button>}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              ['all', 'كل السور', BookOpen],
              ['مكية', `مكية • ${makkiyaCount}`, Sun],
              ['مدنية', `مدنية • ${madaniyaCount}`, Moon],
            ].map(([value, label, Icon]) => {
              const active = filter === value
              const IconComponent = Icon as typeof BookOpen
              return (
                <button key={String(value)} type="button" onClick={() => setFilter(value as FilterType)} className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition ${active ? 'bg-[#0284C7] text-white shadow-sm' : 'bg-[#F7F4EC] text-slate-500 hover:bg-[#EAF7FB] hover:text-[#0284C7]'}`}>
                  <IconComponent size={15} />
                  {String(label)}
                </button>
              )
            })}
          </div>

          {ayahSearching && <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F0FAFD] px-3 py-2 text-xs font-bold text-[#0284C7]"><Loader2 size={15} className="animate-spin" /> جاري البحث داخل الآيات...</div>}

          {!ayahSearching && ayahResults.length > 0 && (
            <div className="mt-3 rounded-2xl border border-[#D8EAF0] bg-[#F5FCFE] p-3">
              <div className="mb-2 text-xs font-black">نتائج البحث داخل الآيات</div>
              <div className="grid gap-2 md:grid-cols-2">
                {ayahResults.map((match) => (
                  <Link key={`${match.number}-${match.numberInSurah}`} href={`/mushaf?page=${match.page || 1}&riwaya=${encodeURIComponent(riwaya)}&reciter=${encodeURIComponent(selectedReciter?.id || '')}&ayah=${encodeURIComponent(`${match.surah?.number || ''}:${match.numberInSurah}`)}`} className="rounded-xl border border-white bg-white p-3 transition hover:shadow-sm">
                    <div className="text-[10px] font-black text-[#0284C7]">{match.surah?.name || 'القرآن الكريم'} · الآية {toArabicNumber(match.numberInSurah)} · الصفحة {toArabicNumber(match.page || 1)}</div>
                    <p className="mt-1 line-clamp-2 text-sm leading-7">{match.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-7">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Sparkles size={18} className="text-[#D97706]" /><h2 className="text-xl font-black">السور المتاحة</h2></div>
            <p className="mt-1 text-xs font-bold text-slate-400">{selectedReciter ? `${toArabicNumber(filteredSurahs.length)} سورة متاحة للقارئ ${selectedReciter.label}` : 'اختر الرواية والقارئ لعرض السور'}</p>
          </div>
          {selectedReciter && <span className="rounded-full bg-[#EAF7FB] px-3 py-2 text-[10px] font-black text-[#0284C7]">{getRiwaya(riwaya).label}</span>}
        </div>

        {!selectedReciter ? (
          <div className="rounded-3xl border border-dashed border-[#DCCFB8] bg-white px-5 py-16 text-center"><BookOpen size={30} className="mx-auto mb-3 text-[#D97706]" /><p className="text-lg font-black">اختر الرواية ثم القارئ</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">بعد اختيار القارئ ستظهر هنا السور الموجودة فعليًا في تسجيلاته لهذه الرواية.</p></div>
        ) : filteredSurahs.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSurahs.map((surah) => (
              <button key={surah.id} type="button" onClick={() => openMushaf(surah.startPage, surah.id)} className="group relative overflow-hidden rounded-3xl border border-[#E9E2D4] bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-[#0284C7]/25 hover:shadow-md">
                <div className="absolute inset-y-0 right-0 w-1 bg-[#D97706]/70" />
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4F9FE] text-lg font-black text-[#0284C7]">{toArabicNumber(surah.id)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><h3 className="truncate text-base font-black group-hover:text-[#0284C7]">سورة {surah.name}</h3><span className="shrink-0 rounded-full bg-[#F7F4EC] px-2 py-1 text-[9px] font-black text-slate-500">{surah.type}</span></div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-400"><span>آيات {toArabicNumber(surah.ayahs)}</span><span>•</span><span>صفحة {toArabicNumber(surah.startPage)}</span></div>
                  </div>
                  <ChevronLeft size={19} className="shrink-0 text-[#D97706] transition-transform group-hover:-translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#DCCFB8] bg-white px-5 py-14 text-center"><Search size={28} className="mx-auto mb-3 text-[#D97706]" /><p className="font-black">لا توجد سور مطابقة</p><p className="mt-2 text-sm font-bold text-slate-400">جرّب تغيير البحث أو الفلتر.</p></div>
        )}
      </section>
    </main>
  )
}
