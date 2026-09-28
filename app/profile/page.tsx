'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User,
  Target,
  Bookmark,
  BookOpen,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Play,
  Library,
  CheckCircle2,
  CalendarDays,
  Save,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'

interface BookmarkItem {
  number: number
  text: string
  numberInSurah: number
  surahName?: string
  page?: number
}

interface KhatmaPlan {
  days: number
  startDate: string
}

const TOTAL_PAGES = 604

function formatArabicNumber(value: number) {
  return value.toLocaleString('ar-EG')
}

function formatDateArabic(dateString: string) {
  if (!dateString) return '—'

  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function getTodayString() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000)
  return diff + 1
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [lastPage, setLastPage] = useState(1)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [deletingBookmark, setDeletingBookmark] = useState<number | null>(null)

  // =========================================================
  // خطة الختمة
  // =========================================================
  const [khatmaDays, setKhatmaDays] = useState(30)
  const [khatmaStartDate, setKhatmaStartDate] = useState(getTodayString())
  const [hasKhatmaPlan, setHasKhatmaPlan] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [planMessage, setPlanMessage] = useState('')

  // =========================================================
  // تحميل بيانات المستخدم والتقدم + خطة الختمة
  // =========================================================
  useEffect(() => {
    if (!user) {
      setIsLoadingProfile(false)
      return
    }

    const loadProfile = async () => {
      setIsLoadingProfile(true)

      try {
        const userRef = doc(db, 'users', user.uid)
        const snapshot = await getDoc(userRef)

        if (snapshot.exists()) {
          const data = snapshot.data()

          const savedPage = Number(data?.lastReadPage || 1)

          if (Number.isFinite(savedPage)) {
            setLastPage(Math.min(TOTAL_PAGES, Math.max(1, savedPage)))
          }

          const savedDays = Number(data?.khatmaDays || 0)
          const savedStartDate =
            typeof data?.khatmaStartDate === 'string'
              ? data.khatmaStartDate
              : ''

          if (Number.isFinite(savedDays) && savedDays >= 1 && savedDays <= 365) {
            setKhatmaDays(savedDays)

            if (savedStartDate) {
              setKhatmaStartDate(savedStartDate)
            }

            setHasKhatmaPlan(true)
          }
        }
      } catch (error) {
        console.error('Profile loading error:', error)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    void loadProfile()
  }, [user])

  // =========================================================
  // تحميل الآيات المحفوظة من localStorage
  // =========================================================
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('samee3_bookmarks') || '[]'
      )

      setBookmarks(Array.isArray(saved) ? saved : [])
    } catch (error) {
      console.error('Bookmarks loading error:', error)
      setBookmarks([])
    }
  }, [])

  // =========================================================
  // تسجيل الخروج
  // =========================================================
  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // =========================================================
  // حذف آية محفوظة
  // =========================================================
  const removeBookmark = (number: number) => {
    try {
      setDeletingBookmark(number)

      const nextBookmarks = bookmarks.filter(
        (item) => item.number !== number
      )

      localStorage.setItem(
        'samee3_bookmarks',
        JSON.stringify(nextBookmarks)
      )

      setBookmarks(nextBookmarks)
    } catch (error) {
      console.error('Bookmark delete error:', error)
    } finally {
      setTimeout(() => {
        setDeletingBookmark(null)
      }, 250)
    }
  }

  // =========================================================
  // نسبة الختمة الحالية
  // =========================================================
  const percentage = useMemo(() => {
    const value = Math.round((lastPage / TOTAL_PAGES) * 100)
    return Math.min(100, Math.max(0, value))
  }, [lastPage])

  const continueReadingUrl = `/mushaf?page=${lastPage}`

  // =========================================================
  // حسابات خطة الختمة
  // =========================================================
  const safeKhatmaDays = Math.min(365, Math.max(1, Number(khatmaDays) || 1))

  const pagesPerDay = useMemo(() => {
    return Math.ceil(TOTAL_PAGES / safeKhatmaDays)
  }, [safeKhatmaDays])

  const khatmaEndDate = useMemo(() => {
    if (!khatmaStartDate) return ''
    return addDays(khatmaStartDate, safeKhatmaDays - 1)
  }, [khatmaStartDate, safeKhatmaDays])

  const planDaysPassed = useMemo(() => {
    if (!hasKhatmaPlan || !khatmaStartDate) return 0

    const today = getTodayString()
    const rawDays = diffDaysInclusive(khatmaStartDate, today)

    return Math.max(0, Math.min(safeKhatmaDays, rawDays))
  }, [hasKhatmaPlan, khatmaStartDate, safeKhatmaDays])

  const plannedPagesByToday = useMemo(() => {
    if (!hasKhatmaPlan || planDaysPassed <= 0) return 0
    return Math.min(
      TOTAL_PAGES,
      planDaysPassed * pagesPerDay
    )
  }, [hasKhatmaPlan, planDaysPassed, pagesPerDay])

  const remainingToday = useMemo(() => {
    if (!hasKhatmaPlan) return 0
    return Math.max(0, plannedPagesByToday - lastPage)
  }, [hasKhatmaPlan, plannedPagesByToday, lastPage])

  const planProgress = useMemo(() => {
    if (!hasKhatmaPlan) return 0
    return Math.min(
      100,
      Math.max(0, Math.round((lastPage / TOTAL_PAGES) * 100))
    )
  }, [hasKhatmaPlan, lastPage])

  const planStatus = useMemo(() => {
    if (!hasKhatmaPlan) return 'لم يتم إنشاء خطة بعد'
    if (lastPage >= TOTAL_PAGES) return 'تم إكمال الختمة'
    if (planDaysPassed === 0) return 'الخطة لم تبدأ بعد'
    if (planDaysPassed >= safeKhatmaDays) return 'انتهى موعد الخطة'
    if (remainingToday === 0) return 'أنجزت المطلوب لهذا اليوم'
    return `متبقي عليك ${formatArabicNumber(remainingToday)} صفحة اليوم`
  }, [
    hasKhatmaPlan,
    lastPage,
    planDaysPassed,
    safeKhatmaDays,
    remainingToday,
  ])

  const handleSavePlan = async () => {
    if (!user) return

    const numericDays = Math.min(
      365,
      Math.max(1, Number(khatmaDays) || 1)
    )

    if (!khatmaStartDate) {
      setPlanMessage('اختار تاريخ بداية الختمة أولًا')
      return
    }

    setIsSavingPlan(true)
    setPlanMessage('')

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          khatmaDays: numericDays,
          khatmaStartDate,
          khatmaPagesPerDay: Math.ceil(TOTAL_PAGES / numericDays),
        },
        { merge: true }
      )

      setKhatmaDays(numericDays)
      setHasKhatmaPlan(true)
      setPlanMessage('تم حفظ خطة الختمة بنجاح')
    } catch (error) {
      console.error('Khatma plan save error:', error)
      setPlanMessage('تعذر حفظ خطة الختمة حاليًا')
    } finally {
      setIsSavingPlan(false)
      setTimeout(() => setPlanMessage(''), 3000)
    }
  }

  const resetPlanForm = () => {
    setKhatmaDays(30)
    setKhatmaStartDate(getTodayString())
    setPlanMessage('')
  }

  // =========================================================
  // حالة تحميل المصادقة
  // =========================================================
  if (loading || isLoadingProfile) {
    return (
      <div
        className="
          min-h-screen
          bg-mushaf-paper
          flex
          items-center
          justify-center
          text-mushaf-teal
          font-bold
          font-cairo
        "
        dir="rtl"
      >
        جاري تحميل حسابك...
      </div>
    )
  }

  // =========================================================
  // المستخدم غير مسجل
  // =========================================================
  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <div
      className="
        min-h-screen
        bg-mushaf-paper
        flex
        flex-col
        p-4
        sm:p-5
        pb-32
        md:pb-8
      "
      dir="rtl"
    >
      {/* =====================================================
          الهيدر
      ====================================================== */}
      <header className="flex items-center justify-between mb-6 pt-2">
        <Link
          href="/"
          className="
            text-mushaf-teal
            bg-white
            p-2.5
            rounded-full
            shadow-sm
            hover:bg-mushaf-paper
            transition
          "
          aria-label="الرئيسية"
        >
          <ChevronRight size={24} />
        </Link>

        <h1 className="font-bold text-mushaf-dark text-lg flex items-center gap-2">
          <User
            size={20}
            className="text-mushaf-teal"
          />
          حسابي وإنجازي
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="
              text-mushaf-gold
              bg-white
              p-2.5
              rounded-full
              shadow-sm
              hover:bg-mushaf-paper
              transition
            "
            title="الإعدادات"
            aria-label="الإعدادات"
          >
            <Settings size={20} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="
              text-red-500
              bg-white
              p-2.5
              rounded-full
              shadow-sm
              hover:bg-red-50
              transition
            "
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* =====================================================
          بطاقة المستخدم
      ====================================================== */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-mushaf-border/40 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="
              w-16
              h-16
              shrink-0
              bg-mushaf-teal
              text-white
              rounded-2xl
              flex
              items-center
              justify-center
              shadow-md
            "
          >
            <User size={30} />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-bold mb-1">
              مرحبًا بك في
            </p>

            <h2 className="font-bold text-mushaf-dark text-xl truncate">
              مصحف سَميع
            </h2>

            <p
              className="
                text-xs
                text-mushaf-teal
                font-semibold
                mt-1
                truncate
                dir-ltr
                text-right
              "
            >
              {user.email || 'حساب المستخدم'}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          بطاقة متابعة الختمة
      ====================================================== */}
      <section className="mb-7">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark flex items-center gap-2">
            <Target
              className="text-mushaf-teal"
              size={24}
            />
            متابعة الختمة
          </h3>

          <span
            className="
              text-xs
              font-bold
              bg-mushaf-gold/15
              text-mushaf-gold
              px-3
              py-1
              rounded-full
            "
          >
            {percentage}% مكتمل
          </span>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-mushaf-border/40">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400 font-semibold">
                آخر صفحة وصلت إليها
              </p>

              <p className="text-2xl font-bold text-mushaf-teal mt-1">
                الصفحة {formatArabicNumber(lastPage)}
              </p>
            </div>

            <p className="text-xs text-gray-400">
              من {formatArabicNumber(TOTAL_PAGES)}
            </p>
          </div>

          <div className="w-full h-3 bg-mushaf-paper rounded-full overflow-hidden border border-mushaf-gold/15">
            <div
              className="h-full bg-mushaf-teal rounded-full transition-all duration-700"
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>بداية القرآن</span>
            <span>{percentage}%</span>
            <span>ختم القرآن</span>
          </div>

          <Link
            href={continueReadingUrl}
            className="
              mt-5
              w-full
              bg-mushaf-teal
              text-white
              rounded-2xl
              py-3.5
              font-bold
              flex
              items-center
              justify-center
              gap-2
              shadow-lg
              hover:opacity-95
              transition
            "
          >
            <BookOpen size={20} />
            متابعة القراءة
          </Link>
        </div>
      </section>

      {/* =====================================================
          مخطط الختمة
      ====================================================== */}
      <section className="mb-7">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark flex items-center gap-2">
            <CalendarDays
              className="text-mushaf-teal"
              size={23}
            />
            مخطط الختمة
          </h3>

          {hasKhatmaPlan && (
            <span className="text-xs font-bold bg-mushaf-teal/10 text-mushaf-teal px-3 py-1 rounded-full">
              خطة نشطة
            </span>
          )}
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-mushaf-border/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-bold text-mushaf-dark mb-2">
                عدد أيام الختمة
              </span>

              <select
                value={khatmaDays}
                onChange={(event) => setKhatmaDays(Number(event.target.value))}
                className="
                  w-full
                  h-12
                  rounded-2xl
                  border
                  border-mushaf-border/60
                  bg-mushaf-paper
                  px-4
                  text-mushaf-dark
                  font-bold
                  outline-none
                  focus:border-mushaf-teal
                "
              >
                {[7, 10, 15, 20, 25, 30, 40, 50, 60, 90, 120, 180, 365].map(
                  (days) => (
                    <option key={days} value={days}>
                      {formatArabicNumber(days)} يوم
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-mushaf-dark mb-2">
                تاريخ بداية الختمة
              </span>

              <input
                type="date"
                value={khatmaStartDate}
                onChange={(event) => setKhatmaStartDate(event.target.value)}
                className="
                  w-full
                  h-12
                  rounded-2xl
                  border
                  border-mushaf-border/60
                  bg-mushaf-paper
                  px-4
                  text-mushaf-dark
                  font-bold
                  outline-none
                  focus:border-mushaf-teal
                "
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-mushaf-paper border border-mushaf-gold/20 p-4">
              <p className="text-xs text-gray-400 font-bold mb-1">
                الصفحات يوميًا
              </p>
              <p className="text-xl font-bold text-mushaf-teal">
                {formatArabicNumber(pagesPerDay)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                صفحة في اليوم
              </p>
            </div>

            <div className="rounded-2xl bg-mushaf-paper border border-mushaf-gold/20 p-4">
              <p className="text-xs text-gray-400 font-bold mb-1">
                تاريخ الإتمام المتوقع
              </p>
              <p className="text-sm font-bold text-mushaf-teal leading-6">
                {formatDateArabic(khatmaEndDate)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePlan}
            disabled={isSavingPlan}
            className="
              mt-5
              w-full
              bg-mushaf-teal
              text-white
              rounded-2xl
              py-3.5
              font-bold
              flex
              items-center
              justify-center
              gap-2
              shadow-lg
              hover:opacity-95
              transition
              disabled:opacity-60
              disabled:cursor-not-allowed
            "
          >
            <Save size={19} />
            {isSavingPlan ? 'جاري حفظ الخطة...' : 'حفظ خطة الختمة'}
          </button>

          {planMessage && (
            <p className="text-center text-xs font-bold text-mushaf-teal mt-3">
              {planMessage}
            </p>
          )}

          <button
            type="button"
            onClick={resetPlanForm}
            className="
              mt-3
              w-full
              rounded-2xl
              py-2.5
              text-xs
              font-bold
              text-gray-400
              hover:text-mushaf-teal
              transition
              flex
              items-center
              justify-center
              gap-2
            "
          >
            <RotateCcw size={15} />
            إعادة اختيار الخطة
          </button>

          <div className="mt-5 rounded-2xl border border-mushaf-teal/10 bg-mushaf-teal/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 font-bold mb-1">
                  حالة الخطة
                </p>
                <p className="text-sm font-bold text-mushaf-dark">
                  {planStatus}
                </p>
              </div>

              <div className="text-left">
                <p className="text-xs text-gray-400 font-bold mb-1">
                  إنجاز الخطة
                </p>
                <p className="text-lg font-bold text-mushaf-teal">
                  {planProgress}%
                </p>
              </div>
            </div>

            {hasKhatmaPlan && (
              <>
                <div className="w-full h-2.5 bg-white rounded-full overflow-hidden mt-4">
                  <div
                    className="h-full bg-mushaf-teal rounded-full transition-all duration-700"
                    style={{ width: `${planProgress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white rounded-2xl p-4">
                    <p className="text-[11px] text-gray-400 font-bold mb-1">
                      أيام الخطة
                    </p>
                    <p className="font-bold text-mushaf-dark">
                      {formatArabicNumber(safeKhatmaDays)} يوم
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4">
                    <p className="text-[11px] text-gray-400 font-bold mb-1">
                      مرّ من الخطة
                    </p>
                    <p className="font-bold text-mushaf-dark">
                      {formatArabicNumber(planDaysPassed)} يوم
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4">
                    <p className="text-[11px] text-gray-400 font-bold mb-1">
                      المستهدف حتى اليوم
                    </p>
                    <p className="font-bold text-mushaf-dark">
                      {formatArabicNumber(plannedPagesByToday)} صفحة
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4">
                    <p className="text-[11px] text-gray-400 font-bold mb-1">
                      المتبقي اليوم
                    </p>
                    <p className="font-bold text-mushaf-teal">
                      {formatArabicNumber(remainingToday)} صفحة
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 leading-6 mt-4">
                  تبدأ الخطة في {formatDateArabic(khatmaStartDate)}،
                  وتنتهي في {formatDateArabic(khatmaEndDate)}.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          إحصائيات سريعة
      ====================================================== */}
      <section className="grid grid-cols-2 gap-3 mb-7">
        <div className="bg-white rounded-2xl p-4 border border-mushaf-border/40 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Library
              size={22}
              className="text-mushaf-gold"
            />
            <span className="text-xs text-gray-400 font-bold">
              المفضلة
            </span>
          </div>

          <p className="text-2xl font-bold text-mushaf-dark">
            {formatArabicNumber(bookmarks.length)}
          </p>

          <p className="text-xs text-gray-400 mt-1">
            آية محفوظة
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-mushaf-border/40 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2
              size={22}
              className="text-mushaf-teal"
            />
            <span className="text-xs text-gray-400 font-bold">
              التقدم
            </span>
          </div>

          <p className="text-2xl font-bold text-mushaf-dark">
            {formatArabicNumber(lastPage)}
          </p>

          <p className="text-xs text-gray-400 mt-1">
            صفحة مقروءة/وصلت إليها
          </p>
        </div>
      </section>

      {/* =====================================================
          الآيات المحفوظة
      ====================================================== */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark flex items-center gap-2">
            <Bookmark
              size={23}
              className="text-mushaf-teal"
            />
            الآيات المحفوظة
          </h3>

          <span className="text-xs text-gray-400 font-semibold">
            {formatArabicNumber(bookmarks.length)} آية
          </span>
        </div>

        {bookmarks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-mushaf-border/40 shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-mushaf-paper flex items-center justify-center mb-4">
              <Bookmark
                size={30}
                className="text-mushaf-gold"
              />
            </div>

            <h4 className="font-bold text-mushaf-dark text-lg">
              لا توجد آيات محفوظة بعد
            </h4>

            <p className="text-sm text-gray-400 mt-2 leading-7">
              افتح المصحف واضغط على أي آية، ثم اختر حفظ
              لتظهر هنا.
            </p>

            <Link
              href="/mushaf"
              className="
                inline-flex
                items-center
                gap-2
                mt-5
                bg-mushaf-teal
                text-white
                rounded-xl
                px-5
                py-3
                text-sm
                font-bold
              "
            >
              فتح المصحف
              <ChevronLeft size={17} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bookmarks.map((bookmark) => (
              <article
                key={bookmark.number}
                className="
                  bg-white
                  rounded-3xl
                  border
                  border-mushaf-border/40
                  shadow-sm
                  p-5
                "
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-mushaf-teal font-bold text-sm truncate">
                      {bookmark.surahName || 'سورة غير محددة'}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      الآية{' '}
                      {formatArabicNumber(
                        Number(bookmark.numberInSurah || 0)
                      )}
                      {bookmark.page
                        ? ` • الصفحة ${formatArabicNumber(
                            Number(bookmark.page)
                          )}`
                        : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeBookmark(bookmark.number)}
                    disabled={deletingBookmark === bookmark.number}
                    className="
                      shrink-0
                      w-10
                      h-10
                      rounded-xl
                      bg-red-50
                      text-red-500
                      flex
                      items-center
                      justify-center
                      hover:bg-red-100
                      transition
                      disabled:opacity-50
                    "
                    title="حذف من المحفوظات"
                    aria-label="حذف الآية"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <p className="font-uthmani text-lg sm:text-xl leading-[2.1] text-mushaf-dark">
                  {bookmark.text}
                  <span className="text-mushaf-gold mx-2">
                    ﴿
                    {formatArabicNumber(
                      Number(bookmark.numberInSurah || 0)
                    )}
                    ﴾
                  </span>
                </p>

                <div className="flex items-center justify-end mt-5 pt-4 border-t border-gray-100">
                  <Link
                    href={
                      bookmark.page
                        ? `/mushaf?page=${bookmark.page}`
                        : '/mushaf'
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      bg-mushaf-paper
                      text-mushaf-teal
                      border
                      border-mushaf-gold/30
                      rounded-xl
                      px-4
                      py-2.5
                      text-xs
                      font-bold
                      hover:bg-mushaf-teal
                      hover:text-white
                      transition
                    "
                  >
                    <Play
                      size={16}
                      fill="currentColor"
                    />
                    الذهاب للآية
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================
          ملاحظة عن مزامنة التقدم
      ====================================================== */}
      <div className="mt-auto bg-mushaf-teal/5 border border-mushaf-teal/10 rounded-2xl p-4 text-center">
        <p className="text-xs text-mushaf-teal font-semibold leading-6">
          يتم حفظ آخر صفحة وصلت إليها في حسابك عبر Firebase،
          بينما الآيات المحفوظة محفوظة محليًا على جهازك،
          وخطة الختمة محفوظة داخل حسابك.
        </p>
      </div>
    </div>
  )
}
