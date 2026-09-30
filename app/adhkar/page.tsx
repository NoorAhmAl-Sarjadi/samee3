'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronLeft,
  Headphones,
  Heart,
  Loader2,
  Moon,
  Search,
  Shield,
  Sparkles,
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

type AdhkarType = 'morning' | 'evening' | 'sleep' | 'waking' | 'daynight'

type AudioTrack = {
  id: string
  type: AdhkarType | 'hisn'
  title: string
  subtitle: string
  audioUrl: string
}

type AdhkarReader = {
  id: string
  name: string
  tracks: AudioTrack[]
}

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const MAKKAH_AUDIO = 'https://archive.org/download/makkah-live.-net-athkar-01'

const ADHKAR_READERS: AdhkarReader[] = [
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    tracks: [
      {
        id: 'hamad-waking',
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        subtitle: 'الورد الصوتي المطابق',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlDuraihim/ar_002_Hisn_Almuslim_AlDuraihim.mp3',
      },
      {
        id: 'hamad-hisn',
        type: 'hisn',
        title: 'حصن المسلم كاملًا',
        subtitle: 'الكتاب الصوتي كاملًا',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlDuraihim/ar_Hisn_Almuslim_AlDuraihim.mp3',
      },
    ],
  },
  {
    id: 'sulaiman-al-shuhayhi',
    name: 'سليمان بن محمد الشويهي',
    tracks: [
      {
        id: 'sulaiman-waking',
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        subtitle: 'الورد الصوتي المطابق',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlShwehi/ar_003_Hisn_Almuslim_Alshwehi.mp3',
      },
      {
        id: 'sulaiman-hisn',
        type: 'hisn',
        title: 'حصن المسلم كاملًا',
        subtitle: 'الكتاب الصوتي كاملًا',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_AlShwehi/ar_Hisn_Almuslim_AlShwehi.mp3',
      },
    ],
  },
  {
    id: 'mishary-alafasy',
    name: 'مشاري بن راشد العفاسي',
    tracks: [
      {
        id: 'mishary-waking',
        type: 'waking',
        title: 'أذكار الاستيقاظ',
        subtitle: 'ورد الاستيقاظ',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_01.mp3`,
      },
      {
        id: 'mishary-daynight',
        type: 'daynight',
        title: 'أذكار اليوم والليلة',
        subtitle: 'ورد اليوم والليلة',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_02.mp3`,
      },
      {
        id: 'mishary-morning',
        type: 'morning',
        title: 'أذكار الصباح',
        subtitle: 'ورد الصباح',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_03.mp3`,
      },
      {
        id: 'mishary-evening',
        type: 'evening',
        title: 'أذكار المساء',
        subtitle: 'ورد المساء',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_04.mp3`,
      },
      {
        id: 'mishary-sleep',
        type: 'sleep',
        title: 'أذكار النوم',
        subtitle: 'ورد النوم',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_11.mp3`,
      },
    ],
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    tracks: [
      {
        id: 'faris-morning',
        type: 'morning',
        title: 'أذكار الصباح',
        subtitle: 'ورد الصباح',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_05.mp3`,
      },
      {
        id: 'faris-evening',
        type: 'evening',
        title: 'أذكار المساء',
        subtitle: 'ورد المساء',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_06.mp3`,
      },
      {
        id: 'faris-hisn',
        type: 'hisn',
        title: 'حصن المسلم — مختارات',
        subtitle: 'مختارات صوتية من حصن المسلم',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/Hisn_Almuslim/Hisn_Almuslim_Faris/ar_Hisn_Almuslim_Faris_Abbad.mp3',
      },
    ],
  },
  {
    id: 'mohamed-jibril',
    name: 'محمد جبريل',
    tracks: [
      {
        id: 'jibril-morning',
        type: 'morning',
        title: 'أذكار الصباح',
        subtitle: 'ورد الصباح',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_07.mp3`,
      },
      {
        id: 'jibril-evening',
        type: 'evening',
        title: 'أذكار المساء',
        subtitle: 'ورد المساء',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_08.mp3`,
      },
    ],
  },
  {
    id: 'nasser-alqatami',
    name: 'ناصر القطامي',
    tracks: [
      {
        id: 'nasser-daynight',
        type: 'daynight',
        title: 'أذكار اليوم والليلة',
        subtitle: 'ورد اليوم والليلة',
        audioUrl: `${MAKKAH_AUDIO}/MakkahLive.Net_athkar_02.mp3`,
      },
    ],
  },
  {
    id: 'walid-abu-ziyad',
    name: 'وليد أبو زياد',
    tracks: [
      {
        id: 'walid-hisn',
        type: 'hisn',
        title: 'حصن المسلم — مختارات',
        subtitle: 'مادة صوتية من أبواب حصن المسلم',
        audioUrl:
          'https://d1.islamhouse.com/data/ar/ih_sounds/single_01/ar_Hisn_Almuslim_AboZyad.mp3',
      },
    ],
  },
]

const DAILY_LINKS: Array<{
  type: AdhkarType
  title: string
  subtitle: string
  icon: typeof Sun
  tone: string
}> = [
  {
    type: 'morning',
    title: 'أذكار الصباح',
    subtitle: 'ورد الصباح',
    icon: Sun,
    tone: 'bg-orange-50 text-orange-500',
  },
  {
    type: 'evening',
    title: 'أذكار المساء',
    subtitle: 'ورد المساء',
    icon: Moon,
    tone: 'bg-indigo-50 text-indigo-500',
  },
  {
    type: 'sleep',
    title: 'أذكار النوم',
    subtitle: 'قبل النوم',
    icon: Moon,
    tone: 'bg-violet-50 text-violet-500',
  },
  {
    type: 'waking',
    title: 'أذكار الاستيقاظ',
    subtitle: 'بعد الاستيقاظ',
    icon: Sun,
    tone: 'bg-emerald-50 text-emerald-500',
  },
]

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeCategories(value: unknown): AdhkarCategory[] {
  const raw =
    Array.isArray(value)
      ? value
      : Array.isArray((value as { data?: unknown })?.data)
        ? (value as { data: unknown }).data
        : Array.isArray((value as { adhkar?: unknown })?.adhkar)
          ? (value as { adhkar: unknown }).adhkar
          : []

  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      id: Number(entry.id) || 0,
      category: String(entry.category || '').trim(),
      audio: typeof entry.audio === 'string' ? entry.audio : undefined,
      filename: typeof entry.filename === 'string' ? entry.filename : undefined,
      array: Array.isArray(entry.array)
        ? entry.array
            .filter(
              (item): item is Record<string, unknown> =>
                Boolean(item) && typeof item === 'object'
            )
            .map((item) => ({
              id: Number(item.id) || 0,
              text: String(item.text || '').trim(),
              count: Math.max(1, Number(item.count) || 1),
              audio: typeof item.audio === 'string' ? item.audio : undefined,
              filename: typeof item.filename === 'string' ? item.filename : undefined,
            }))
            .filter((item) => item.text)
        : [],
    }))
    .filter((category) => category.id > 0 && category.array.length > 0)
}

function categoryIcon(name: string) {
  if (name.includes('الصباح')) return <Sun size={23} />
  if (name.includes('المساء')) return <Moon size={23} />
  if (name.includes('النوم')) return <Moon size={23} />
  if (name.includes('الاستيقاظ')) return <Sun size={23} />
  return <Shield size={23} />
}

function categoryTone(name: string) {
  if (name.includes('الصباح')) return 'bg-orange-50 text-orange-500'
  if (name.includes('المساء')) return 'bg-indigo-50 text-indigo-500'
  if (name.includes('النوم')) return 'bg-violet-50 text-violet-500'
  if (name.includes('الاستيقاظ')) return 'bg-emerald-50 text-emerald-500'
  return 'bg-mushaf-paper text-mushaf-teal'
}

function displayCategoryName(category: AdhkarCategory) {
  const name = category.category
  if (name.includes('النوم')) return 'أذكار النوم'
  if (name.includes('الاستيقاظ')) return 'أذكار الاستيقاظ'
  if (name.includes('الصباح') && name.includes('المساء')) return 'أذكار الصباح والمساء'
  if (name.includes('الصباح')) return 'أذكار الصباح'
  if (name.includes('المساء')) return 'أذكار المساء'
  return 'أذكار متنوعة'
}

export default function AdhkarPage() {
  const [categories, setCategories] = useState<AdhkarCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [readerId, setReaderId] = useState('hamad-al-drehem')

  const selectedReader =
    ADHKAR_READERS.find((reader) => reader.id === readerId) ?? ADHKAR_READERS[0]

  useEffect(() => {
    try {
      const saved = localStorage.getItem('samee3_adhkar_reader')
      if (saved && ADHKAR_READERS.some((reader) => reader.id === saved)) {
        setReaderId(saved)
      }
    } catch {
      // localStorage may be unavailable.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('samee3_adhkar_reader', readerId)
    } catch {
      // localStorage may be unavailable.
    }
  }, [readerId])

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      setLoading(true)

      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const json = (await response.json()) as unknown
        const data = normalizeCategories(json)

        if (!cancelled) setCategories(data)
      } catch (error) {
        console.error('Adhkar load error:', error)
        if (!cancelled) setCategories([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return categories
    return categories.filter((category) =>
      category.category.toLowerCase().includes(normalized)
    )
  }, [categories, query])

  const availableDailyTracks = useMemo(
    () =>
      DAILY_LINKS.map((item) => ({
        ...item,
        track:
          selectedReader.tracks.find((track) => track.type === item.type) ?? null,
      })),
    [selectedReader]
  )

  return (
    <div className="min-h-screen bg-mushaf-paper pb-32" dir="rtl">
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-5 py-5">
        <header className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-mushaf-border/40 shadow-sm flex items-center justify-center">
            <Heart size={25} className="text-mushaf-teal" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-mushaf-teal">الأذكار</h1>
            <p className="text-xs text-gray-500 mt-1">وردك اليومي وأذكار الكتاب والسنة</p>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-[#175E67] via-[#11474E] to-[#0D383E] text-white shadow-xl border border-mushaf-gold/20 p-6 sm:p-8">
          <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -right-12 w-56 h-56 rounded-full bg-mushaf-gold/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <Sparkles size={27} className="text-mushaf-gold" />
            </div>
            <div>
              <h2 className="text-2xl font-black">وردك اليومي</h2>
              <p className="text-sm text-white/70 mt-1 leading-7">
                اختر القارئ أولًا، ثم استمع إلى الأذكار المتاحة له مباشرة داخل مصحف سميع.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 bg-white rounded-[2rem] p-5 shadow-sm border border-mushaf-border/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center">
              <Headphones size={22} />
            </div>
            <div>
              <h2 className="font-black text-lg text-mushaf-dark">اختر القارئ</h2>
              <p className="text-xs text-gray-400 mt-1">
                اختر الصوت الذي تريد الاستماع إليه.
              </p>
            </div>
          </div>

          <div className="relative">
            <select
              value={readerId}
              onChange={(event) => setReaderId(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-mushaf-border/50 bg-mushaf-paper px-4 py-4 pl-12 text-base font-black text-mushaf-dark outline-none transition focus:border-mushaf-teal focus:ring-4 focus:ring-mushaf-teal/10"
              aria-label="اختيار قارئ الأذكار"
            >
              {ADHKAR_READERS.map((reader) => (
                <option key={reader.id} value={reader.id}>
                  {reader.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mushaf-teal"
            />
          </div>

          <div className="mt-4 rounded-2xl bg-mushaf-teal/5 border border-mushaf-teal/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mushaf-teal text-white flex items-center justify-center shrink-0">
              <Volume2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-bold">القارئ المحدد</p>
              <p className="text-sm font-black text-mushaf-teal truncate">
                {selectedReader.name}
              </p>
            </div>
            <span className="mr-auto rounded-full bg-emerald-50 text-emerald-600 px-3 py-1.5 text-[10px] font-black">
              {arabicDigits(selectedReader.tracks.length)} تسجيل
            </span>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-4">
            <h2 className="text-xl font-black text-mushaf-dark">
              الأذكار المتاحة لـ {selectedReader.name}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              التسجيلات المتاحة لهذا القارئ تظهر هنا فقط.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedReader.tracks.map((track) => {
              const target =
                track.type === 'hisn'
                  ? `/adhkar/read?reader=${selectedReader.id}&track=${encodeURIComponent(track.id)}`
                  : `/adhkar/read?reader=${selectedReader.id}&type=${track.type}`

              return (
                <Link
                  key={track.id}
                  href={target}
                  className="group bg-white rounded-[1.7rem] border border-mushaf-border/40 p-4 shadow-sm hover:border-mushaf-teal/40 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-mushaf-teal text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Volume2 size={21} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-mushaf-dark truncate">
                          {track.title}
                        </h3>
                        <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-1 text-[9px] font-black shrink-0">
                          متاح
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 truncate">
                        {track.subtitle}
                      </p>
                    </div>
                    <ChevronLeft size={18} className="text-mushaf-gold shrink-0 group-hover:-translate-x-1 transition" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-black text-mushaf-dark">الأذكار اليومية</h2>
            <p className="text-xs text-gray-400 mt-1">
              القراءة والعد متاحان دائمًا، والصوت يظهر عند وجود تسجيل للنوع المحدد.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableDailyTracks.map((entry) => {
              const Icon = entry.icon
              return (
                <Link
                  key={entry.type}
                  href={`/adhkar/read?reader=${selectedReader.id}&type=${entry.type}`}
                  className="group bg-white rounded-[1.8rem] border border-mushaf-border/40 p-5 shadow-sm hover:border-mushaf-teal/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center ${entry.tone} group-hover:scale-105 transition`}>
                      <Icon size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-lg text-mushaf-dark group-hover:text-mushaf-teal transition">
                        {entry.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">{entry.subtitle}</p>
                      <div className="mt-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black ${
                            entry.track || selectedReader.itemAudio
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                          {entry.track || selectedReader.itemAudio ? 'صوت متاح' : 'قراءة فقط'}
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className="text-mushaf-gold shrink-0 group-hover:-translate-x-1 transition" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="mt-9">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-black text-mushaf-dark">جميع الأذكار</h2>
              <p className="text-xs text-gray-400 mt-1">
                مكتبة قراءة وعدّ منظمة تشمل جميع الأقسام المتاحة.
              </p>
            </div>
            <span className="rounded-xl bg-mushaf-teal/10 text-mushaf-teal px-3 py-2 text-xs font-black shrink-0">
              {arabicDigits(filteredCategories.length)} قسم
            </span>
          </div>

          <div className="relative mb-4">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في الأذكار..."
              className="w-full rounded-2xl bg-white border border-mushaf-border/40 pr-11 pl-4 py-4 text-sm font-bold text-mushaf-dark outline-none focus:ring-4 focus:ring-mushaf-teal/10 focus:border-mushaf-teal"
            />
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-mushaf-teal">
              <Loader2 size={38} className="animate-spin" />
              <p className="font-bold text-sm">جاري تحميل الأذكار...</p>
            </div>
          ) : filteredCategories.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCategories.map((category) => {
                const title = displayCategoryName(category)
                return (
                  <Link
                    key={category.id}
                    href={`/adhkar/read?reader=${selectedReader.id}&categoryId=${category.id}`}
                    className="group bg-white rounded-[1.7rem] border border-mushaf-border/40 p-5 shadow-sm hover:border-mushaf-teal/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${categoryTone(title)}`}>
                        {categoryIcon(category.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-base text-mushaf-dark group-hover:text-mushaf-teal transition truncate">
                          {title}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-gray-400">
                            {arabicDigits(category.array.length)} ذكر
                          </span>
                          <span className="rounded-full bg-gray-100 text-gray-400 px-2 py-1 text-[9px] font-black">
                            قراءة فقط
                          </span>
                        </div>
                      </div>
                      <ChevronLeft size={18} className="text-mushaf-gold shrink-0 group-hover:-translate-x-1 transition" />
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-mushaf-border/40 p-8 text-center text-gray-500">
              لا توجد أذكار مطابقة للبحث.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
