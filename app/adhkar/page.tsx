'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Heart, Loader2, Moon, Search, Shield, Sun } from 'lucide-react'
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

const DATA_URL = 'https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json'

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

        const json = await response.json()

        const data: AdhkarCategory[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.adhkar)
              ? json.adhkar
              : []

        if (!ignore) setCategories(data)
      } catch (error) {
        console.error('Adhkar categories error:', error)
        if (!ignore) setCategories([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadCategories()

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
            <Heart
              size={26}
              className="text-mushaf-teal"
              fill="currentColor"
            />
          </div>

          <div>
            <h1 className="text-2xl font-black font-cairo text-mushaf-teal">
              الأذكار
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              أذكار الكتاب والسنة بصوت وقراءة
            </p>
          </div>
        </div>

        {/* وردك اليومي */}
        <section className="mb-6">
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[2rem] p-6 sm:p-7 shadow-xl text-white relative overflow-hidden border border-mushaf-gold/20">
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-16 -right-12 w-48 h-48 bg-mushaf-gold/5 rounded-full blur-3xl" />

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <Heart
                  size={28}
                  className="text-mushaf-gold"
                  fill="currentColor"
                />
              </div>

              <div>
                <h2 className="font-black text-xl">وردك اليومي</h2>
                <p className="text-white/70 text-sm mt-1">
                  اضغط على الذكر لتقرأه وتستمع للتسجيل المتاح، مع مكتبة أصوات حقيقية إضافية
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* اختصارات رئيسية */}
        <section className="mb-7">
          <h2 className="text-lg font-black text-mushaf-dark mb-4">
            الأذكار اليومية
          </h2>

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
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">
                    أذكار الصباح
                  </span>
                  <span className="text-xs text-gray-400">
                    ورد الصباح
                  </span>
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
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">
                    أذكار المساء
                  </span>
                  <span className="text-xs text-gray-400">
                    ورد المساء
                  </span>
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
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">
                    أذكار النوم
                  </span>
                  <span className="text-xs text-gray-400">
                    ورد النوم
                  </span>
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
                  <span className="font-black text-mushaf-dark text-lg group-hover:text-mushaf-teal transition block">
                    أذكار الاستيقاظ
                  </span>
                  <span className="text-xs text-gray-400">
                    بعد الاستيقاظ من النوم
                  </span>
                </div>
              </div>

              <ChevronLeft className="text-mushaf-gold opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </Link>
          </div>
        </section>

        {/* كل الأذكار */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-mushaf-dark">
                جميع الأذكار
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                كل الأقسام الموجودة في مصدر البيانات
              </p>
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
                          {displayCategoryName(category)}
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
