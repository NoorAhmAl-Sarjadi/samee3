'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronDown,
  Heart,
  Headphones,
  Loader2,
  Moon,
  Search,
  Shield,
  Sun,
  Volume2,
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

type AudioTrack = {
  type: AdhkarType
  title: string
  url: string
}

type AdhkarReciter = {
  id: string
  name: string
  note: string
  itemAudio?: boolean
  tracks: Partial<Record<AdhkarType, AudioTrack>>
}

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const AUDIO_BASE_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main'
const AUDIO_PROXY_PATH = '/api/adhkar-audio'
const ARCHIVE_AUDIO_BASE = 'https://archive.org/download/makkah-live.-net-athkar-01'

const ADHKAR_RECITERS: AdhkarReciter[] = [
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    note: 'تسجيلات مفردة مرتبطة بنصوص الأذكار في قاعدة البيانات، مع تشغيل تلقائي للذكر والتكرار والانتقال للذكر التالي.',
    itemAudio: true,
    tracks: {
      waking: {
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        url: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlDuraihim/ar_002_Hisn_Almuslim_AlDuraihim.mp3',
      },
    },
  },
  {
    id: 'sulaiman-al-shuhayhi',
    name: 'سليمان بن محمد الشويهي',
    note: 'تسجيلات منشورة لحصن المسلم، مع ملف مباشر لأذكار الاستيقاظ داخل التجربة الصوتية.',
    tracks: {
      waking: {
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        url: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlShwehi/ar_003_Hisn_Almuslim_Alshwehi.mp3',
      },
    },
  },
  {
    id: 'mishary-alafasy',
    name: 'مشاري بن راشد العفاسي',
    note: 'ورد صوتي مباشر للصباح والمساء والنوم والاستيقاظ داخل التطبيق.',
    tracks: {
      morning: {
        type: 'morning',
        title: 'أذكار الصباح',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_03.mp3`,
      },
      evening: {
        type: 'evening',
        title: 'أذكار المساء',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_04.mp3`,
      },
      sleep: {
        type: 'sleep',
        title: 'أذكار النوم',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_11.mp3`,
      },
      waking: {
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_01.mp3`,
      },
    },
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    note: 'تسجيلات مباشرة لأذكار الصباح والمساء.',
    tracks: {
      morning: {
        type: 'morning',
        title: 'أذكار الصباح',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_05.mp3`,
      },
      evening: {
        type: 'evening',
        title: 'أذكار المساء',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_06.mp3`,
      },
    },
  },
  {
    id: 'mohamed-jibril',
    name: 'محمد جبريل',
    note: 'تسجيلات مباشرة لأذكار الصباح والمساء.',
    tracks: {
      morning: {
        type: 'morning',
        title: 'أذكار الصباح',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_07.mp3`,
      },
      evening: {
        type: 'evening',
        title: 'أذكار المساء',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_08.mp3`,
      },
    },
  },
  {
    id: 'nasser-alqatami',
    name: 'ناصر القطامي',
    note: 'تسجيل مباشر لأذكار اليوم والليلة، ويظهر ضمن ورد الصباح والمساء.',
    tracks: {
      morning: {
        type: 'morning',
        title: 'أذكار اليوم والليلة',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_02.mp3`,
      },
      evening: {
        type: 'evening',
        title: 'أذكار اليوم والليلة',
        url: `${ARCHIVE_AUDIO_BASE}/MakkahLive.Net_athkar_02.mp3`,
      },
    },
  },
]

const TYPE_CARDS: Array<{
  type: AdhkarType
  title: string
  subtitle: string
}> = [
  { type: 'morning', title: 'أذكار الصباح', subtitle: 'ورد الصباح' },
  { type: 'evening', title: 'أذكار المساء', subtitle: 'ورد المساء' },
  { type: 'sleep', title: 'أذكار النوم', subtitle: 'ورد النوم' },
  { type: 'waking', title: 'أذكار الاستيقاظ', subtitle: 'بعد الاستيقاظ من النوم' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  if (Array.isArray(value.data)) return value.data
  if (Array.isArray(value.adhkar)) return value.adhkar
  if (Array.isArray(value.categories)) return value.categories
  return []
}

function normalizeItem(value: unknown, fallbackId: number): AdhkarItem | null {
  if (!isRecord(value)) return null

  const text = typeof value.text === 'string' ? value.text.trim() : ''
  if (!text) return null

  const id = Number(value.id)
  const count = Number(value.count)

  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    text,
    count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
    ...(typeof value.audio === 'string' && value.audio.trim()
      ? { audio: value.audio.trim() }
      : {}),
    ...(typeof value.filename === 'string' && value.filename.trim()
      ? { filename: value.filename.trim() }
      : {}),
  }
}

function normalizeCategory(value: unknown, fallbackId: number): AdhkarCategory | null {
  if (!isRecord(value)) return null

  const category = typeof value.category === 'string' ? value.category.trim() : ''
  if (!category) return null

  const rawItems = Array.isArray(value.array) ? value.array : []
  const array = rawItems
    .map((item, index) => normalizeItem(item, index + 1))
    .filter((item): item is AdhkarItem => item !== null)

  if (!array.length) return null

  const id = Number(value.id)

  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    category,
    array,
    ...(typeof value.audio === 'string' && value.audio.trim()
      ? { audio: value.audio.trim() }
      : {}),
    ...(typeof value.filename === 'string' && value.filename.trim()
      ? { filename: value.filename.trim() }
      : {}),
  }
}

function normalizeCategories(value: unknown): AdhkarCategory[] {
  const raw: unknown[] = readArray(value)

  return raw
    .map((entry, index) => normalizeCategory(entry, index + 1))
    .filter((entry): entry is AdhkarCategory => entry !== null)
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function categoryIcon(title: string) {
  if (title.includes('الصباح')) return <Sun size={21} />
  if (title.includes('المساء')) return <Moon size={21} />
  if (title.includes('النوم')) return <Moon size={21} />
  if (title.includes('الاستيقاظ')) return <Sun size={21} />
  return <Shield size={21} />
}

function categoryTone(title: string) {
  if (title.includes('الصباح')) return 'bg-orange-50 text-orange-500'
  if (title.includes('المساء')) return 'bg-indigo-50 text-indigo-500'
  if (title.includes('النوم')) return 'bg-violet-50 text-violet-500'
  return 'bg-emerald-50 text-emerald-600'
}

function categoryMatchesType(category: AdhkarCategory, type: AdhkarType) {
  const name = category.category
  if (type === 'sleep') return name.includes('النوم')
  if (type === 'waking') return name.includes('الاستيقاظ')
  return name.includes('الصباح') && name.includes('المساء')
}

function selectedReaderHasType(
  reader: AdhkarReciter,
  type: AdhkarType,
  categories: AdhkarCategory[],
) {
  if (reader.tracks[type]) return true
  if (!reader.itemAudio) return false
  const category = categories.find((entry) => categoryMatchesType(entry, type))
  return Boolean(category?.array.some((item) => Boolean(item.audio)))
}

function displayCategoryName(category: AdhkarCategory) {
  const name = category.category
  if (name.includes('الصباح') && name.includes('المساء')) return 'أذكار الصباح والمساء'
  if (name.includes('الصباح')) return 'أذكار الصباح'
  if (name.includes('المساء')) return 'أذكار المساء'
  if (name.includes('النوم')) return 'أذكار النوم'
  if (name.includes('الاستيقاظ')) return 'أذكار الاستيقاظ'
  return 'أذكار متنوعة'
}

export default function AdhkarPage() {
  const [categories, setCategories] = useState<AdhkarCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedReciterId, setSelectedReciterId] = useState(ADHKAR_RECITERS[0].id)

  const selectedReciter =
    ADHKAR_RECITERS.find((reader) => reader.id === selectedReciterId) ?? ADHKAR_RECITERS[0]

  useEffect(() => {
    try {
      const saved = localStorage.getItem('samee3_adhkar_reciter')
      if (saved && ADHKAR_RECITERS.some((reader) => reader.id === saved)) {
        setSelectedReciterId(saved)
      }
    } catch {
      // localStorage unavailable; keep the default reader.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('samee3_adhkar_reciter', selectedReciterId)
    } catch {
      // Ignore storage failures.
    }
  }, [selectedReciterId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const json: unknown = await response.json()
        const next = normalizeCategories(json)

        if (!cancelled) setCategories(next)
      } catch (error) {
        console.error('Adhkar load error:', error)
        if (!cancelled) setCategories([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCategories = useMemo(() => {
    const normalized = query.trim()
    if (!normalized) return categories

    return categories.filter((category) =>
      `${category.category} ${displayCategoryName(category)}`.includes(normalized),
    )
  }, [categories, query])

  const availableTypes = TYPE_CARDS.filter(({ type }) => selectedReaderHasType(selectedReciter, type, categories))

  return (
    <div className="min-h-screen bg-mushaf-paper pb-28" dir="rtl">
      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] border border-mushaf-gold/20 bg-gradient-to-br from-[#175E67] via-[#11474E] to-[#0D383E] p-5 text-white shadow-xl sm:p-7">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Heart size={28} className="text-mushaf-gold" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-black text-mushaf-gold">المنصة القرآنية الشاملة</p>
              <h1 className="text-2xl font-black sm:text-3xl">وردك اليومي</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">
                اختر قارئ الأذكار من القائمة، ثم استمع فقط لما هو متوفر له، بينما تبقى جميع الأذكار الأخرى متاحة للقراءة والعد.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[2rem] border border-mushaf-border/40 bg-white p-4 shadow-sm sm:p-5">
          <label htmlFor="adhkar-reciter" className="mb-2 block text-xs font-black text-gray-500">
            اختر القارئ
          </label>
          <div className="relative">
            <Headphones className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mushaf-teal" size={20} />
            <select
              id="adhkar-reciter"
              value={selectedReciterId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedReciterId(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-mushaf-border/50 bg-mushaf-paper px-12 py-4 pl-12 text-base font-black text-mushaf-dark outline-none transition focus:border-mushaf-teal focus:ring-2 focus:ring-mushaf-teal/10"
            >
              {ADHKAR_RECITERS.map((reader) => (
                <option key={reader.id} value={reader.id}>
                  {reader.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <div className="mt-3 rounded-2xl bg-mushaf-paper px-4 py-3">
            <p className="text-sm font-black text-mushaf-dark">{selectedReciter.name}</p>
            <p className="mt-1 text-xs leading-6 text-gray-500">{selectedReciter.note}</p>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-mushaf-dark">الأذكار المتاحة للقارئ</h2>
              <p className="mt-1 text-xs text-gray-400">اختر الورد الصوتي الذي يملكه القارئ المحدد.</p>
            </div>
            <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
              {arabicDigits(availableTypes.length)} أوراد
            </span>
          </div>

          {availableTypes.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {availableTypes.map((card) => {
                const track = selectedReciter.tracks[card.type]
                return (
                  <Link
                    key={card.type}
                    href={`/adhkar/read?type=${card.type}&reciter=${selectedReciter.id}`}
                    className="group flex items-center justify-between rounded-3xl border border-mushaf-border/40 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-mushaf-teal/40 hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${categoryTone(card.title)}`}>
                        {categoryIcon(card.title)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-mushaf-dark group-hover:text-mushaf-teal">{track?.title ?? card.title}</h3>
                        <p className="mt-1 text-xs text-gray-400">{card.subtitle}</p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-mushaf-teal/10 px-2.5 py-1 text-[10px] font-black text-mushaf-teal">
                          <Volume2 size={13} /> صوت متاح
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className="shrink-0 text-mushaf-gold transition group-hover:-translate-x-1" size={21} />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-mushaf-border/50 bg-white p-6 text-center">
              <p className="font-black text-mushaf-dark">لا يوجد ورد صوتي مطابق لهذا القارئ في هذه الأقسام.</p>
              <p className="mt-1 text-xs text-gray-400">الأذكار النصية والعدادات تظل متاحة بالكامل بالأسفل.</p>
            </div>
          )}
        </section>

        <section className="mt-7">
          <div className="mb-4">
            <h2 className="text-lg font-black text-mushaf-dark">الأذكار اليومية</h2>
            <p className="mt-1 text-xs text-gray-400">الصباح والمساء والنوم والاستيقاظ — بالصوت عند توفره، وإلا فالقراءة والعد.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TYPE_CARDS.map((card) => {
              const hasAudio = selectedReaderHasType(selectedReciter, card.type, categories)
              return (
                <Link
                  key={card.type}
                  href={`/adhkar/read?type=${card.type}&reciter=${selectedReciter.id}`}
                  className="group flex items-center justify-between rounded-3xl border border-mushaf-border/40 bg-white p-5 shadow-sm transition hover:border-mushaf-teal/40 hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${categoryTone(card.title)}`}>
                      {categoryIcon(card.title)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-mushaf-dark group-hover:text-mushaf-teal">{card.title}</h3>
                      <p className="mt-1 text-xs text-gray-400">{card.subtitle}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${hasAudio ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {hasAudio ? <><Volume2 size={13} /> متاح بالصوت</> : 'قراءة وعداد'}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="shrink-0 text-mushaf-gold transition group-hover:-translate-x-1" size={21} />
                </Link>
              )
            })}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-mushaf-dark">جميع الأذكار</h2>
              <p className="mt-1 text-xs text-gray-400">قراءة وعداد لكل الأقسام الموجودة في ملف الأذكار.</p>
            </div>
            <span className="rounded-xl bg-mushaf-teal/10 px-3 py-2 text-xs font-black text-mushaf-teal">
              {arabicDigits(filteredCategories.length)} قسم
            </span>
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="ابحث في جميع الأذكار..."
              className="w-full rounded-2xl border border-mushaf-border/40 bg-white py-3.5 pr-11 pl-4 text-sm font-bold text-mushaf-dark outline-none focus:border-mushaf-teal focus:ring-2 focus:ring-mushaf-teal/10"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-mushaf-teal">
              <Loader2 size={36} className="animate-spin" />
              <p className="text-sm font-bold">جاري تحميل جميع الأذكار...</p>
            </div>
          ) : filteredCategories.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/adhkar/read?categoryId=${category.id}&reciter=${selectedReciter.id}`}
                  className="group flex items-center justify-between rounded-3xl border border-mushaf-border/40 bg-white p-5 shadow-sm transition hover:border-mushaf-teal/40 hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${categoryTone(displayCategoryName(category))}`}>
                      {categoryIcon(displayCategoryName(category))}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-mushaf-dark group-hover:text-mushaf-teal">
                        {displayCategoryName(category)}
                      </h3>
                      <p className="mt-1 text-xs text-gray-400">{arabicDigits(category.array.length)} أذكار</p>
                    </div>
                  </div>
                  <ChevronLeft className="shrink-0 text-mushaf-gold transition group-hover:-translate-x-1" size={21} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-mushaf-border/40 bg-white p-8 text-center text-sm font-bold text-gray-500">
              لا توجد أقسام مطابقة للبحث حاليًا.
            </div>
          )}
        </section>

        <p className="mt-7 text-center text-[11px] leading-6 text-gray-400">
          الأذكار التي لا يوجد لها تسجيل مطابق للقارئ المحدد تبقى متاحة كاملة للقراءة والعد داخل مصحف سميع.
        </p>
      </main>
    </div>
  )
}
