
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ExternalLink, Headphones, Heart, Loader2, Moon, Search, Shield, Sun } from 'lucide-react'
import Link from 'next/link'

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

type AdhkarReciter = {
  id: string
  name: string
  sourceName: string
  mode: 'direct' | 'external'
  description: string
  coverage: string
  sourceUrl: string
  badge: string
  embedByType?: Partial<Record<AdhkarType, string>>
}

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'

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

function categoryIcon(name: string) {
  if (name.includes('الصباح')) return <Sun size={23} />
  if (name.includes('المساء')) return <Moon size={23} />
  if (name.includes('النوم')) return <Moon size={23} />
  if (name.includes('الاستيقاظ')) return <Sun size={23} />
  return <Shield size={23} />
}

function categoryTone(name: string) {
  if (name.includes('الصباح')) {
    return 'bg-orange-50 text-orange-500 group-hover:bg-orange-500'
  }

  if (name.includes('المساء')) {
    return 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500'
  }

  if (name.includes('النوم')) {
    return 'bg-violet-50 text-violet-500 group-hover:bg-violet-500'
  }

  return 'bg-mushaf-paper text-mushaf-teal group-hover:bg-mushaf-teal'
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function displayCategoryName(category: AdhkarCategory) {
  const name = String(category.category || '').trim()

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

  useEffect(() => {
    let ignore = false

    const loadCategories = async () => {
      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load adhkar')

        const json: unknown = await response.json()

        const data: AdhkarCategory[] = Array.isArray(json)
          ? json
          : Array.isArray((json as { data?: unknown })?.data)
            ? (json as { data: AdhkarCategory[] }).data
            : Array.isArray((json as { adhkar?: unknown })?.adhkar)
              ? (json as { adhkar: AdhkarCategory[] }).adhkar
              : []

        if (!ignore) setCategories(data)
      } catch (error) {
        console.error('Adhkar categories error:', error)
        if (!ignore) setCategories([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadCategories()

    return () => {
      ignore = true
    }
  }, [])

  const filteredCategories = useMemo(() => {
    const normalized = query.trim()

    if (!normalized) return categories

    return categories.filter((category) =>
      String(category.category).includes(normalized)
    )
  }, [categories, query])

  return (
    <div
      className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8"
      dir="rtl"
    >
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-white border border-mushaf-border/40 shadow-sm flex items-center justify-center">
            <Heart size={26} className="text-mushaf-teal" fill="currentColor" />
          </div>

          <div>
            <h1 className="text-2xl font-black font-cairo text-mushaf-teal">الأذكار</h1>
            <p className="text-xs text-gray-500 mt-1">أذكار الكتاب والسنة بأصوات ومصادر متعددة</p>
          </div>
        </div>

        <section className="mb-6">
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[2rem] p-6 sm:p-7 shadow-xl text-white relative overflow-hidden border border-mushaf-gold/20">
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-16 -right-12 w-48 h-48 bg-mushaf-gold/5 rounded-full blur-3xl" />

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <Heart size={28} className="text-mushaf-gold" fill="currentColor" />
              </div>

              <div>
                <h2 className="font-black text-xl">وردك اليومي</h2>
                <p className="text-white/70 text-sm mt-1">
                  نصوص الأذكار مع مكتبة أصوات حقيقية متعددة من مصادر منشورة.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-7 bg-white rounded-[2rem] p-4 sm:p-5 shadow-sm border border-mushaf-border/40">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-teal border border-mushaf-border/30 flex items-center justify-center shrink-0">
                <Headphones size={23} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-black text-mushaf-dark">أصوات الأذكار</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {arabicDigits(ADHKAR_RECITERS.length)} قارئين/مصادر مجانية متاحة من جهات منشورة
                </p>
              </div>
            </div>

            <span className="text-xs font-black text-mushaf-teal bg-mushaf-teal/10 px-3 py-2 rounded-xl shrink-0">
              {arabicDigits(ADHKAR_RECITERS.length)} مصادر
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ADHKAR_RECITERS.map((reader) => (
              <a
                key={reader.id}
                href={reader.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-mushaf-border/30 bg-mushaf-paper p-4 hover:border-mushaf-teal/50 hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-mushaf-teal border border-mushaf-border/30 flex items-center justify-center shrink-0 group-hover:bg-mushaf-teal group-hover:text-white transition">
                    <Headphones size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-sm text-mushaf-dark truncate">{reader.name}</p>
                      <ExternalLink size={15} className="text-mushaf-gold shrink-0" />
                    </div>

                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed line-clamp-2">
                      {reader.coverage}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[9px] px-2 py-1 rounded-full font-black ${
                          reader.mode === 'direct'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {reader.badge}
                      </span>

                      <span className="text-[9px] text-gray-400 truncate">
                        {reader.sourceName}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-mushaf-teal/15 bg-mushaf-teal/5 p-3 text-[11px] leading-relaxed text-mushaf-dark/70">
            بعض التسجيلات الخارجية تُفتح من المصدر الأصلي لأنها منشورة ككتاب صوتي أو كملفات أبواب، بينما التسجيل المرتبط مباشرة ببيانات الأذكار الحالية يمكن تشغيله داخل مصحف سميع.
          </div>
        </section>

        <section className="mb-7">
          <h2 className="text-lg font-black text-mushaf-dark mb-4">الأذكار اليومية</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/adhkar/read?type=morning"
              className="bg-white p-5 rounded-3xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition">
                  <Sun size={24} />
                </div>

                <div>
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">أذكار الصباح</span>
                  <span className="text-xs text-gray-400">ورد الصباح</span>
                </div>
              </div>

              <ChevronLeft className="text-mushaf-gold opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </Link>

            <Link
              href="/adhkar/read?type=evening"
              className="bg-white p-5 rounded-3xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition">
                  <Moon size={24} />
                </div>

                <div>
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">أذكار المساء</span>
                  <span className="text-xs text-gray-400">ورد المساء</span>
                </div>
              </div>

              <ChevronLeft className="text-mushaf-gold opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </Link>

            <Link
              href="/adhkar/read?type=sleep"
              className="bg-white p-5 rounded-3xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-violet-50 text-violet-500 rounded-2xl flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition">
                  <Moon size={24} />
                </div>

                <div>
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">أذكار النوم</span>
                  <span className="text-xs text-gray-400">ورد النوم</span>
                </div>
              </div>

              <ChevronLeft className="text-mushaf-gold opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </Link>

            <Link
              href="/adhkar/read?type=waking"
              className="bg-white p-5 rounded-3xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition">
                  <Sun size={24} />
                </div>

                <div>
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">أذكار الاستيقاظ</span>
                  <span className="text-xs text-gray-400">بعد الاستيقاظ من النوم</span>
                </div>
              </div>

              <ChevronLeft className="text-mushaf-gold opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </Link>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-mushaf-dark">جميع الأذكار</h2>
              <p className="text-xs text-gray-400 mt-1">كل الأقسام الموجودة في مصدر البيانات</p>
            </div>

            <span className="text-xs font-black text-mushaf-teal bg-mushaf-teal/10 px-3 py-2 rounded-xl">
              {arabicDigits(filteredCategories.length)} قسم
            </span>
          </div>

          <div className="relative mb-4">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في أقسام الأذكار..."
              className="w-full bg-white border border-mushaf-border/40 rounded-2xl pr-11 pl-4 py-3.5 text-sm font-bold text-mushaf-dark outline-none focus:ring-2 focus:ring-mushaf-teal/10"
            />
          </div>

          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-mushaf-teal">
              <Loader2 size={36} className="animate-spin" />
              <p className="font-bold text-sm">جاري تحميل جميع الأذكار...</p>
            </div>
          ) : filteredCategories.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCategories.map((category) => {
                const displayName = displayCategoryName(category)
                const tone = categoryTone(displayName)
                const audioCount = category.array?.filter((item) => item.audio).length ?? 0

                return (
                  <Link
                    key={category.id}
                    href={`/adhkar/read?categoryId=${category.id}`}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition group-hover:text-white ${tone}`}
                      >
                        {categoryIcon(category.category)}
                      </div>

                      <div className="min-w-0">
                        <span className="font-black text-mushaf-dark text-base group-hover:text-mushaf-teal transition block truncate">
                          {displayName}
                        </span>

                        <span className="text-[11px] text-gray-400 mt-1 block">
                          {arabicDigits(category.array?.length ?? 0)} أذكار
                          {audioCount > 0
                            ? ` • ${arabicDigits(audioCount)} صوتيًا`
                            : ' • قراءة فقط'}
                        </span>
                      </div>
                    </div>

                    <ChevronLeft className="text-mushaf-gold opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition shrink-0" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-mushaf-border/40 p-8 text-center text-gray-500">
              لا توجد أقسام مطابقة للبحث.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
