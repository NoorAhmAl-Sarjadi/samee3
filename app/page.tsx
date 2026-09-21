'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  List,
  Heart,
  Book,
  Compass,
  ChevronLeft,
  Bell,
  Headphones,
  LibraryBig,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

interface ReadingProgress {
  lastReadPage?: number
  lastReadRiwayaId?: string
  lastReadSurahNumber?: number
  lastReadSurahName?: string
  lastReadJuz?: number
  lastReadAyahKey?: string
  lastReadAyahNumber?: number
  lastReadReciterId?: string
  lastReadReciterName?: string
}

export default function HomePage() {
  const { user, loading } = useAuth()

  const [lastPage, setLastPage] = useState(1)
  const [progress, setProgress] = useState<ReadingProgress | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setProgress(null)
      setLastPage(1)
      return
    }

    let cancelled = false

    const fetchProgress = async () => {
      setProgressLoading(true)

      try {
        const docRef = doc(db, 'users', user.uid)
        const docSnap = await getDoc(docRef)

        if (cancelled) return

        if (docSnap.exists()) {
          const data = docSnap.data() as ReadingProgress

          setProgress(data)

          if (
            typeof data.lastReadPage === 'number' &&
            data.lastReadPage >= 1
          ) {
            setLastPage(data.lastReadPage)
          }
        } else {
          setProgress(null)
          setLastPage(1)
        }
      } catch (error) {
        console.error('Progress load error:', error)
      } finally {
        if (!cancelled) {
          setProgressLoading(false)
        }
      }
    }

    fetchProgress()

    return () => {
      cancelled = true
    }
  }, [user])

  const displayName = user?.email
    ? user.email.split('@')[0]
    : 'يا باغي الخير'

  const hasReadingProgress =
    !!progress &&
    typeof progress.lastReadPage === 'number' &&
    progress.lastReadPage >= 1

  const continueHref = (() => {
    const params = new URLSearchParams()

    params.set('page', String(lastPage))

    if (progress?.lastReadRiwayaId) {
      params.set('riwaya', progress.lastReadRiwayaId)
    }

    if (progress?.lastReadReciterId) {
      params.set('reciter', progress.lastReadReciterId)
    }

    if (progress?.lastReadAyahKey) {
      params.set('ayah', progress.lastReadAyahKey)
    }

    return `/mushaf?${params.toString()}`
  })()

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 pb-32 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <header className="mb-7 flex items-center justify-between gap-4 pt-1">
          <div className="min-w-0">
            <p className="mb-1 text-sm font-medium text-slate-500">
              السلام عليكم،
            </p>

            <h1 className="truncate text-2xl font-extrabold tracking-tight text-[var(--text-main)]">
              {loading ? 'جاري التحميل...' : displayName}
            </h1>

            <p className="mt-1 text-xs font-medium text-slate-400">
              أهلاً بك في مصحف سميع
            </p>
          </div>

          <Link
            href="/profile"
            aria-label="فتح الحساب والإشعارات"
            className="
              flex h-12 w-12 shrink-0 items-center justify-center
              rounded-full border border-[rgba(2,132,199,0.16)]
              bg-white shadow-sm
              transition-all duration-200
              hover:-translate-y-0.5
              hover:border-[rgba(2,132,199,0.35)]
              hover:shadow-md
              active:scale-95
            "
          >
            <Bell
              size={22}
              strokeWidth={2}
              className="text-[var(--royal-blue)]"
            />
          </Link>
        </header>

        {/* Continue Reading */}
        <section className="relative mb-8 overflow-hidden">
          <div
            className="
              relative overflow-hidden rounded-[30px]
              border border-[rgba(14,165,233,0.18)]
              bg-gradient-to-br from-[var(--royal-blue)] to-[#0369A1]
              p-5 text-white
              shadow-[0_12px_35px_rgba(2,132,199,0.18)]
              sm:p-6
            "
          >
            {/* Decorative shapes */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none absolute -right-16 -top-16
                h-44 w-44 rounded-full
                bg-white/10 blur-2xl
              "
            />

            <div
              aria-hidden="true"
              className="
                pointer-events-none absolute -bottom-20 -left-10
                h-40 w-40 rounded-full
                bg-cyan-200/10 blur-3xl
              "
            />

            <div className="relative z-10">
              <div className="mb-5 flex items-center gap-2">
                <span
                  className="
                    flex h-9 w-9 items-center justify-center
                    rounded-full bg-white/10
                  "
                >
                  <BookOpen size={18} />
                </span>

                <span className="text-sm font-bold text-white/90">
                  متابعة القراءة
                </span>
              </div>

              <div className="mb-5">
                <h2 className="mb-2 font-uthmani text-3xl leading-relaxed sm:text-4xl">
                  {hasReadingProgress ? 'استكمال الورد' : 'ابدأ تلاوتك'}
                </h2>

                {hasReadingProgress ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                      الصفحة {lastPage}
                    </span>

                    {progress?.lastReadSurahName && (
                      <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                        سورة {progress.lastReadSurahName}
                      </span>
                    )}

                    {typeof progress?.lastReadJuz === 'number' && (
                      <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                        الجزء {progress.lastReadJuz}
                      </span>
                    )}

                    {progress?.lastReadReciterName && (
                      <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                        {progress.lastReadReciterName}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-7 text-white/85">
                    ابدأ رحلتك مع القرآن الكريم واختر السورة والرواية والقارئ
                    المناسب لك.
                  </p>
                )}
              </div>

              <Link
                href={continueHref}
                className="
                  flex w-full items-center justify-center gap-2
                  rounded-2xl bg-white
                  py-3.5
                  font-bold text-[var(--royal-blue)]
                  shadow-lg
                  transition-all duration-200
                  hover:-translate-y-0.5
                  hover:bg-slate-50
                  active:scale-[0.99]
                "
              >
                {progressLoading
                  ? 'جاري تحميل آخر موضع...'
                  : hasReadingProgress
                    ? 'أكمل التلاوة'
                    : 'فتح المصحف'}

                <ChevronLeft size={20} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Services */}
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-main)]">
                الخدمات السريعة
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-400">
                كل ما تحتاجه في مكان واحد
              </p>
            </div>

            <Link
              href="/surahs"
              className="
                text-xs font-bold
                text-[var(--royal-blue)]
                transition-colors
                hover:text-[#0369A1]
              "
            >
              فتح الفهرس
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <QuickServiceCard
              href="/surahs"
              icon={List}
              title="فهرس السور"
              description="السور والقراءات"
            />

            <QuickServiceCard
              href="/audio"
              icon={Headphones}
              title="المكتبة الصوتية"
              description="استمع للقرآن"
            />

            <QuickServiceCard
              href="/prayer"
              icon={Compass}
              title="مواقيت الصلاة"
              description="أوقات الصلاة"
            />

            <QuickServiceCard
              href="/hadith"
              icon={Book}
              title="الأحاديث النبوية"
              description="كتب الحديث"
            />

            <QuickServiceCard
              href="/adhkar"
              icon={Heart}
              title="الأذكار والتسبيح"
              description="أذكار المسلم"
            />

            <QuickServiceCard
              href="/islamic-library"
              icon={LibraryBig}
              title="المكتبة الشرعية"
              description="كتب ومراجع"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

interface QuickServiceCardProps {
  href: string
  icon: React.ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
  }>
  title: string
  description: string
}

function QuickServiceCard({
  href,
  icon: Icon,
  title,
  description,
}: QuickServiceCardProps) {
  return (
    <Link
      href={href}
      className="
        group relative overflow-hidden
        rounded-[22px]
        border border-[var(--border-light)]
        bg-white
        p-4
        shadow-sm
        transition-all duration-200
        hover:-translate-y-1
        hover:border-[rgba(14,165,233,0.35)]
        hover:shadow-md
        active:scale-[0.98]
      "
    >
      <div className="flex flex-col items-center text-center">
        <span
          className="
            mb-3 flex h-12 w-12 items-center justify-center
            rounded-2xl
            bg-[rgba(2,132,199,0.08)]
            transition-all duration-200
            group-hover:bg-[rgba(2,132,199,0.13)]
            group-hover:scale-105
          "
        >
          <Icon
            size={24}
            strokeWidth={2}
            className="text-[var(--royal-blue)]"
          />
        </span>

        <span className="text-sm font-extrabold text-[var(--text-main)]">
          {title}
        </span>

        <span className="mt-1 text-[10px] font-medium text-slate-400">
          {description}
        </span>
      </div>
    </Link>
  )
}
