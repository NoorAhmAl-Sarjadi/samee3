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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

interface BookmarkItem {
  number: number
  text: string
  numberInSurah: number
  surahName?: string
  page?: number
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [lastPage, setLastPage] = useState(1)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [deletingBookmark, setDeletingBookmark] = useState<number | null>(null)

  // =========================================================
  // تحميل بيانات المستخدم والتقدم
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
            setLastPage(
              Math.min(604, Math.max(1, savedPage))
            )
          }
        }
      } catch (error) {
        console.error('Profile loading error:', error)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [user])

  // =========================================================
  // تحميل الآيات المحفوظة من localStorage
  // =========================================================

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('samee3_bookmarks') || '[]'
      )

      setBookmarks(
        Array.isArray(saved) ? saved : []
      )
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
  // نسبة الختمة
  // =========================================================

  const percentage = useMemo(() => {
    const value = Math.round(
      (lastPage / 604) * 100
    )

    return Math.min(100, Math.max(0, value))
  }, [lastPage])

  // =========================================================
  // صفحة البداية للمتابعة
  // =========================================================

  const continueReadingUrl = `/mushaf?page=${lastPage}`

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
                الصفحة {lastPage.toLocaleString('ar-EG')}
              </p>
            </div>

            <p className="text-xs text-gray-400">
              من 604
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
            {bookmarks.length.toLocaleString('ar-EG')}
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
            {lastPage.toLocaleString('ar-EG')}
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
            {bookmarks.length.toLocaleString('ar-EG')} آية
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
                      {Number(
                        bookmark.numberInSurah || 0
                      ).toLocaleString('ar-EG')}
                      {bookmark.page
                        ? ` • الصفحة ${Number(
                            bookmark.page
                          ).toLocaleString('ar-EG')}`
                        : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeBookmark(
                        bookmark.number
                      )
                    }
                    disabled={
                      deletingBookmark ===
                      bookmark.number
                    }
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
                    {Number(
                      bookmark.numberInSurah || 0
                    ).toLocaleString('ar-EG')}
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
          بينما الآيات المحفوظة محفوظة محليًا على جهازك.
        </p>
      </div>
    </div>
  )
}
