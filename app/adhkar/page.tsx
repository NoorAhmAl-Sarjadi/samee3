'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Headphones,
  Heart,
  Loader2,
  Moon,
  RefreshCw,
  Search,
  Shield,
  Sun,
  Volume2,
  WifiOff,
} from 'lucide-react'

/**
 * SAMEE3 — Adhkar library (listing)
 * Path: app/adhkar/page.tsx
 *
 * The original Arabic text is not rewritten or generated.
 * Reading URLs remain compatible with app/adhkar/read/page.tsx.
 * Adhkar JSON is saved in Cache Storage after a successful download.
 * This page never starts audio automatically.
 */

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
type DataState = 'loading' | 'fresh' | 'cached' | 'error'

type Reader = {
  id: string
  name: string
  /** Existing whole-section tracks configured in the reading page. */
  sections: AdhkarType[]
  /** Reader whose individual adhkar recordings are included in the JSON. */
  itemAudio?: boolean
}

const DATA_URL =
  'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'
const DATA_CACHE = 'samee3-adhkar-data-v1'
const RECITER_KEY = 'samee3_adhkar_reciter'

// IDs must stay synchronized with app/adhkar/read/page.tsx.
// These are configured recordings, not a guarantee that each external URL is live.
const READERS: Reader[] = [
  {
    id: 'mishary-alafasy',
    name: 'مشاري بن راشد العفاسي',
    sections: ['waking', 'morning', 'evening', 'sleep'],
  },
  {
    id: 'faris-abbad',
    name: 'فارس عباد',
    sections: ['morning', 'evening'],
  },
  {
    id: 'mohamed-jibril',
    name: 'محمد جبريل',
    sections: ['morning', 'evening'],
  },
  {
    id: 'nasser-alqatami',
    name: 'ناصر القطامي',
    sections: ['morning', 'evening'],
  },
  {
    id: 'hamad-al-drehem',
    name: 'حمد الدريهم',
    sections: ['waking'],
    itemAudio: true,
  },
  {
    id: 'sulaiman-al-shuhayhi',
    name: 'سليمان بن محمد الشويهي',
    sections: ['waking'],
  },
  {
    id: 'walid-abu-ziyad',
    name: 'وليد أبو زياد',
    sections: [],
  },
]

const DAILY: Array<{
  type: AdhkarType
  name: string
  subtitle: string
  icon: 'sun' | 'moon' | 'shield'
}> = [
  { type: 'morning', name: 'أذكار الصباح', subtitle: 'ابدأ يومك بذكر الله', icon: 'sun' },
  { type: 'evening', name: 'أذكار المساء', subtitle: 'سكينة المساء', icon: 'moon' },
  { type: 'sleep', name: 'أذكار النوم', subtitle: 'طمأنينة قبل النوم', icon: 'moon' },
  { type: 'waking', name: 'أذكار الاستيقاظ', subtitle: 'ذكر الله عند الاستيقاظ', icon: 'sun' },
]

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getCategories(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isObject(value)) return []
  if (Array.isArray(value.data)) return value.data
  if (Array.isArray(value.adhkar)) return value.adhkar
  if (Array.isArray(value.categories)) return value.categories
  return []
}

function positiveCount(value: unknown, fallback: number): number {
  const result = Number(value)
  return Number.isFinite(result) && result > 0
    ? Math.max(1, Math.floor(result))
    : fallback
}

function parseCategories(value: unknown): AdhkarCategory[] {
  return getCategories(value)
    .map((raw, categoryIndex): AdhkarCategory | null => {
      if (!isObject(raw) || typeof raw.category !== 'string') return null

      const name = raw.category.trim()
      if (!name || !Array.isArray(raw.array)) return null

      const array: AdhkarItem[] = raw.array
        .map((entry: unknown, index: number): AdhkarItem | null => {
          if (!isObject(entry) || typeof entry.text !== 'string') return null
          const text = entry.text.trim()
          if (!text) return null

          return {
            id: positiveCount(entry.id, index + 1),
            text,
            count: positiveCount(entry.count, 1),
            ...(typeof entry.audio === 'string' && entry.audio.trim()
              ? { audio: entry.audio.trim() }
              : {}),
            ...(typeof entry.filename === 'string' && entry.filename.trim()
              ? { filename: entry.filename.trim() }
              : {}),
          }
        })
        .filter((item: AdhkarItem | null): item is AdhkarItem => item !== null)

      if (!array.length) return null

      return {
        id: positiveCount(raw.id, categoryIndex + 1),
        category: name,
        array,
        ...(typeof raw.audio === 'string' && raw.audio.trim()
          ? { audio: raw.audio.trim() }
          : {}),
        ...(typeof raw.filename === 'string' && raw.filename.trim()
          ? { filename: raw.filename.trim() }
          : {}),
      }
    })
    .filter((entry): entry is AdhkarCategory => entry !== null)
}

function normalizeSearch(text: string): string {
  return text
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim()
}

function digit(value: number): string {
  return value.toLocaleString('ar-EG')
}

function iconFor(name: string) {
  if (name.includes('صباح') || name.includes('استيقاظ')) {
    return <Sun size={22} />
  }
  if (name.includes('مساء') || name.includes('نوم')) {
    return <Moon size={22} />
  }
  return <Shield size={22} />
}

function isReaderAudioForType(
  reader: Reader,
  type: AdhkarType,
  categories: AdhkarCategory[],
): boolean {
  if (reader.sections.includes(type)) return true
  if (!reader.itemAudio) return false

  const relevant = categories.find((category) => {
    if (type === 'sleep') return category.category.includes('النوم')
    if (type === 'waking') return category.category.includes('الاستيقاظ')
    return category.category.includes('الصباح') && category.category.includes('المساء')
  })

  return Boolean(relevant?.array.some((item) => item.audio))
}

async function readSavedData(): Promise<AdhkarCategory[]> {
  if (typeof caches === 'undefined') return []

  try {
    const cache = await caches.open(DATA_CACHE)
    const saved = await cache.match(DATA_URL)
    if (!saved) return []
    const json: unknown = await saved.json()
    return parseCategories(json)
  } catch {
    return []
  }
}

async function cacheValidatedData(response: Response): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(DATA_CACHE)
    await cache.put(DATA_URL, response)
  } catch {
    // Safari private mode and full storage may reject a cache write.
  }
}

export default function AdhkarPage() {
  const [categories, setCategories] = useState<AdhkarCategory[]>([])
  const [status, setStatus] = useState<DataState>('loading')
  const [retryIndex, setRetryIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [readerId, setReaderId] = useState(READERS[0].id)
  const [onlyAudio, setOnlyAudio] = useState(false)

  const selectedReader = READERS.find((reader) => reader.id === readerId) || READERS[0]

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECITER_KEY)
      if (saved && READERS.some((reader) => reader.id === saved)) {
        setReaderId(saved)
      }
    } catch {
      // Storage may be disabled.
    }
  }, [])

  const updateReader = (id: string) => {
    if (!READERS.some((reader) => reader.id === id)) return
    setReaderId(id)
    try {
      localStorage.setItem(RECITER_KEY, id)
    } catch {
      // Reader selection works for this session anyway.
    }
  }

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15000)

    const load = async () => {
      setStatus('loading')
      const saved = await readSavedData()
      if (cancelled) return

      if (saved.length) {
        setCategories(saved)
        setStatus('cached')
      }

      try {
        const response = await fetch(DATA_URL, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const copy = response.clone()
        const json: unknown = await response.json()
        const parsed = parseCategories(json)
        if (!parsed.length) throw new Error('Empty adhkar data')

        if (!cancelled) {
          setCategories(parsed)
          setStatus('fresh')
        }
        if (!cancelled) void cacheValidatedData(copy)
      } catch {
        if (!cancelled && !saved.length) {
          setStatus('error')
        }
      } finally {
        window.clearTimeout(timer)
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [retryIndex])

  const categoryCount = categories.length
  const itemCount = useMemo(
    () => categories.reduce((sum, category) => sum + category.array.length, 0),
    [categories],
  )

  const matches = useMemo(() => {
    const term = normalizeSearch(query)
    return categories.filter((category) => {
      if (onlyAudio && !category.audio && !category.array.some((item) => item.audio)) {
        return false
      }
      if (!term) return true
      if (normalizeSearch(category.category).includes(term)) return true
      return category.array.some((item) => normalizeSearch(item.text).includes(term))
    })
  }, [categories, query, onlyAudio])

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f5f0] pb-32 text-[#1d3c42]">
      <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 sm:pt-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-[#b08b4d]">مصحف سميع</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">الأذكار والأدعية</h1>
          </div>
          <Link
            href="/"
            aria-label="العودة للرئيسية"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8ddca] bg-white shadow-sm"
          >
            <ArrowRight size={21} />
          </Link>
        </header>

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#184f56] via-[#12444c] to-[#0b3039] p-6 text-white shadow-[0_20px_55px_rgba(13,52,59,0.17)] sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-4 h-64 w-64 rounded-full border border-[#d4b27a]/20" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/15 bg-white/10 text-[#ebcb96]">
              <Heart size={27} fill="currentColor" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#ebcb96]">وردك اليومي</p>
              <h2 className="mt-1 text-2xl font-black leading-relaxed sm:text-3xl">طمأنينة تُرافق يومك</h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-white/75">
                اقرأ أذكار الصباح والمساء والنوم والاستيقاظ، وتابع الأعداد واستمع للتسجيلات البشرية عند توفرها.
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
              {digit(categoryCount)} قسم
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
              {digit(itemCount)} ذكر ودعاء
            </span>
            {status === 'cached' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dcb976]/30 bg-[#dcb976]/15 px-3 py-1.5 text-xs font-bold text-[#f5dfa9]">
                <WifiOff size={13} /> عرض النسخة المحفوظة
              </span>
            ) : status === 'fresh' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-50/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
                <CheckCircle2 size={13} /> تم تحديث البيانات
              </span>
            ) : null}
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-[#ebe2d5] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8f0df] text-[#a78043]">
              <Headphones size={21} />
            </div>
            <div>
              <h2 className="text-base font-black">اختر القارئ</h2>
              <p className="mt-0.5 text-xs text-[#7b8587]">تسجيلات صوتية بشرية، وليست قراءة اصطناعية</p>
            </div>
          </div>

          <div className="relative">
            <select
              aria-label="اختيار قارئ الأذكار"
              value={readerId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => updateReader(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-[#e1d8c8] bg-[#fcfaf6] px-4 py-4 pl-11 text-sm font-bold text-[#174952] outline-none focus:border-[#b89a63] focus:ring-2 focus:ring-[#b89a63]/15"
            >
              {READERS.map((reader) => (
                <option value={reader.id} key={reader.id}>{reader.name}</option>
              ))}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9c8a72]" />
          </div>
          <p className="mt-3 text-xs leading-6 text-[#727e80]">
            اختيار القارئ لا يغيّر نصوص الأذكار. بعض القراء لديهم تسجيلات لأوراد محددة فقط، وقد تتطلب التسجيلات اتصالًا بالإنترنت.
          </p>
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-[#b08b4d]">القراءة اليومية</p>
              <h2 className="mt-1 text-xl font-black">أوراد اليوم والليلة</h2>
            </div>
            <BookOpen size={23} className="text-[#b08b4d]" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DAILY.map((entry) => {
              const audio = isReaderAudioForType(selectedReader, entry.type, categories)
              const Icon = entry.icon === 'sun' ? Sun : entry.icon === 'moon' ? Moon : Shield
              return (
                <Link
                  href={`/adhkar/read?type=${entry.type}&reciter=${selectedReader.id}`}
                  key={entry.type}
                  className="group flex items-center gap-4 rounded-[22px] border border-[#e9e0d2] bg-white p-4 shadow-sm transition hover:border-[#ceb78a] hover:shadow-md"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[#f7eee0] text-[#a47c40]">
                    <Icon size={25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-black">{entry.name}</span>
                    <span className="mt-1 block text-xs text-[#899092]">{entry.subtitle}</span>
                    <span className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold ${audio ? 'text-[#1d8073]' : 'text-[#9a8b70]'}`}>
                      {audio ? <><Volume2 size={13} /> تسجيل مضاف للقارئ</> : <><BookOpen size={13} /> قراءة وعداد</>}
                    </span>
                  </span>
                  <ChevronLeft size={21} className="shrink-0 text-[#bba071] transition-transform group-hover:-translate-x-1" />
                </Link>
              )
            })}
          </div>
        </section>

        {selectedReader.sections.length > 0 && (
          <section className="mt-7 rounded-[22px] border border-[#e5d6bc] bg-[#fdfaf3] p-5">
            <div className="flex items-start gap-3">
              <Volume2 size={21} className="mt-0.5 shrink-0 text-[#b08b4d]" />
              <div className="min-w-0 flex-1">
                <h2 className="font-black">أوراد مسجلة للقارئ المختار</h2>
                <p className="mt-1 text-xs leading-6 text-[#798285]">اضغط على الورد لفتحه في مشغّل الأذكار. توفر الرابط لا يضمن عمل المصدر الخارجي دائمًا.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedReader.sections.map((type) => {
                const title = DAILY.find((entry) => entry.type === type)?.name || 'أذكار'
                return (
                  <Link
                    key={type}
                    href={`/adhkar/read?type=${type}&reciter=${selectedReader.id}`}
                    className="rounded-xl border border-[#d9c49f] bg-white px-4 py-2.5 text-xs font-black text-[#6c552e] transition hover:bg-[#f8f0df]"
                  >
                    {title}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#b08b4d]">حصن المسلم</p>
              <h2 className="mt-1 text-xl font-black">جميع الأذكار والأدعية</h2>
              <p className="mt-1 text-xs text-[#879092]">ابحث في أسماء الأقسام ونصوص الأذكار نفسها.</p>
            </div>
            <span className="rounded-xl border border-[#e6d7be] bg-white px-3 py-2 text-xs font-black text-[#926f3b]">
              {digit(matches.length)} قسم
            </span>
          </div>

          <div className="relative">
            <Search size={19} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#aa8b59]" />
            <input
              type="search"
              aria-label="بحث في الأذكار"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="ابحث عن ذكر أو دعاء…"
              className="w-full rounded-[17px] border border-[#e4d8c6] bg-white py-4 pl-4 pr-12 text-sm text-[#24474c] outline-none shadow-sm placeholder:text-[#a0a5a5] focus:border-[#b99b69] focus:ring-2 focus:ring-[#b99b69]/15"
            />
          </div>

          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#687b7e]">
            <input
              type="checkbox"
              checked={onlyAudio}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setOnlyAudio(event.target.checked)}
              className="h-4 w-4 accent-[#bb975e]"
            />
            الأقسام التي تحتوي على تسجيلات فردية في البيانات
          </label>

          {status === 'loading' && !categories.length ? (
            <div className="mt-5 flex min-h-44 flex-col items-center justify-center gap-3 rounded-[24px] border border-[#e9dfd0] bg-white text-[#886b3c]">
              <Loader2 size={27} className="animate-spin" />
              <p className="text-sm font-bold">جارٍ تحميل الأذكار…</p>
            </div>
          ) : status === 'error' && !categories.length ? (
            <div className="mt-5 rounded-[24px] border border-amber-200 bg-white p-7 text-center">
              <WifiOff size={30} className="mx-auto text-[#a98348]" />
              <h3 className="mt-3 font-black">تعذر تحميل الأذكار</h3>
              <p className="mt-2 text-xs leading-7 text-[#777]">
                افتح القسم مرة أثناء اتصال الإنترنت لحفظ البيانات على الجهاز، ثم يمكن عرض قائمة الأذكار المحفوظة عند انقطاعه.
              </p>
              <button
                type="button"
                onClick={() => setRetryIndex((value) => value + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#17545b] px-5 py-3 text-sm font-bold text-white"
              >
                <RefreshCw size={17} /> إعادة المحاولة
              </button>
            </div>
          ) : matches.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matches.map((category) => {
                const isDaily = /الصباح|المساء|النوم|الاستيقاظ/.test(category.category)
                const audioItems = category.array.filter((item) => item.audio).length
                return (
                  <Link
                    key={category.id}
                    href={`/adhkar/read?categoryId=${category.id}&reciter=${selectedReader.id}`}
                    className="group flex items-center gap-3 rounded-[20px] border border-[#e9e1d5] bg-white p-4 shadow-sm transition hover:border-[#d3be99] hover:shadow-md"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-[#f6f0e7] text-[#b28c51]">
                      {iconFor(category.category)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-6">{category.category}</span>
                      {!isDaily && <span className="mt-0.5 block text-[10px] text-[#b08b4d]">أذكار متنوعة</span>}
                      <span className="mt-1 block text-[11px] text-[#879191]">
                        {digit(category.array.length)} ذكر ودعاء
                        {audioItems > 0 ? ` · ${digit(audioItems)} تسجيل فردي بالبيانات` : ''}
                      </span>
                    </span>
                    <ChevronLeft size={19} className="shrink-0 text-[#bd9c65]" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-[#e9dfd0] bg-white px-5 py-10 text-center text-sm text-[#768586]">
              لا توجد نتائج مطابقة. جرّب كلمة أخرى أو ألغِ تصفية الصوتيات.
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs leading-7 text-[#9c9a91]">
          نصوص الأذكار مأخوذة من مجموعة حصن المسلم. التلاوات البشرية تُشغّل فقط عند وجود تسجيل لها.
        </footer>
      </div>
    </main>
  )
}