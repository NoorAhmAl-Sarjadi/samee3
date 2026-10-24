
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, BookOpen, Bookmark, CalendarDays, CheckCircle2,
  ChevronLeft, CloudOff, Edit3, Loader2, LogOut, MessageCircle,
  Save, ShieldCheck, Target, Trash2, UserRound, X,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'

// SAMEE3 — Profile. Compatible with existing mushaf storage keys.
const TOTAL_PAGES = 604
const BOOKMARK_KEY = 'samee3_bookmarks'
const READING_KEY = 'samee3_persistent_reading_v2'
const RIWAYAT = ['hafs', 'warsh', 'qalun', 'douri', 'shubah', 'sousi', 'bazzi']
const PLAN_OPTIONS = [7, 10, 15, 20, 25, 30, 40, 50, 60, 90, 120, 180, 365]

type BookmarkItem = {
  number: number
  text: string
  numberInSurah: number
  surahName: string
  page: number | null
  riwaya: string | null
  key: string | null
}

type ReadingLocation = {
  page: number
  riwaya: string | null
  surah: number | null
  ayah: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function integer(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null

  const num = Number(value)
  return Number.isSafeInteger(num) && num >= min && num <= max ? num : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberAr(value: number): string {
  return value.toLocaleString('ar-EG')
}

function todayISO(): string {
  const date = new Date()

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function dateUTC(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null

  const parts = iso.split('-').map(Number)
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))

  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2]
  ) {
    return null
  }

  return date
}

function addDays(iso: string, days: number): string {
  const date = dateUTC(iso)
  if (!date) return ''

  date.setUTCDate(date.getUTCDate() + days)

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function elapsedDays(start: string, today: string): number {
  const first = dateUTC(start)
  const last = dateUTC(today)

  if (!first || !last) return 0

  return Math.max(
    0,
    Math.floor((last.getTime() - first.getTime()) / 86400000) + 1,
  )
}

function dateLabel(iso: string): string {
  const date = dateUTC(iso)

  return date
    ? new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date)
    : '—'
}

function readBookmarks(): BookmarkItem[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(BOOKMARK_KEY) || '[]',
    )

    if (!Array.isArray(parsed)) return []

    const seen = new Set<number>()
    const result: BookmarkItem[] = []

    parsed.forEach((entry: unknown) => {
      const data = asRecord(entry)
      if (!data) return

      const number = integer(data.number, 1, 10000)
      if (!number || seen.has(number)) return

      seen.add(number)

      result.push({
        number,
        text: text(data.text).slice(0, 5000),
        numberInSurah: integer(data.numberInSurah, 1, 286) || 1,
        surahName: text(data.surahName).slice(0, 100) || 'سورة غير محددة',
        page: integer(data.page, 1, TOTAL_PAGES),
        riwaya: RIWAYAT.includes(text(data.riwaya))
          ? text(data.riwaya)
          : null,
        key: /^\d{1,3}:\d{1,3}$/.test(text(data.key))
          ? text(data.key)
          : null,
      })
    })

    return result.reverse()
  } catch {
    return []
  }
}

function readLocalLocation(): ReadingLocation | null {
  try {
    const raw = localStorage.getItem(READING_KEY)
    const value = raw ? asRecord(JSON.parse(raw)) : null

    if (!value) return null

    const page = integer(value.page, 1, TOTAL_PAGES)
    if (!page) return null

    return {
      page,
      riwaya: RIWAYAT.includes(text(value.riwaya))
        ? text(value.riwaya)
        : null,
      surah: integer(value.surah, 1, 114),
      ayah: integer(value.ayah, 1, 286),
    }
  } catch {
    return null
  }
}

function readingHref(location: ReadingLocation | null): string {
  if (!location) return '/mushaf'

  const params = new URLSearchParams({
    page: String(location.page),
  })

  if (location.riwaya) params.set('riwaya', location.riwaya)
  if (location.surah) params.set('surah', String(location.surah))

  if (location.surah && location.ayah) {
    params.set('ayah', `${location.surah}:${location.ayah}`)
  }

  return `/mushaf?${params.toString()}`
}

function bookmarkHref(item: BookmarkItem): string {
  const params = new URLSearchParams()

  if (item.page) params.set('page', String(item.page))
  if (item.riwaya) params.set('riwaya', item.riwaya)
  if (item.key) params.set('ayah', item.key)

  return params.toString()
    ? `/mushaf?${params.toString()}`
    : '/mushaf'
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading, profileStatus, isAdmin } = useAuth()

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [deviceLocation, setDeviceLocation] =
    useState<ReadingLocation | null>(null)

  const [days, setDays] = useState(30)
  const [startDate, setStartDate] = useState(todayISO)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planNotice, setPlanNotice] = useState('')

  const [nameDraft, setNameDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameNotice, setNameNotice] = useState('')

  const [bookmarkNotice, setBookmarkNotice] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const syncedPlanRef = useRef('')

  const uid = user?.uid || null
  const canSave = Boolean(uid && profileStatus === 'ready')

  const reloadLocal = useCallback(() => {
    setBookmarks(readBookmarks())
    setDeviceLocation(readLocalLocation())
  }, [])

  useEffect(() => {
    reloadLocal()

    const onStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === BOOKMARK_KEY ||
        event.key === READING_KEY
      ) {
        reloadLocal()
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reloadLocal()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', reloadLocal)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', reloadLocal)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reloadLocal])

  useEffect(() => {
    if (!editingName) {
      setNameDraft(profile?.name || user?.displayName || '')
    }
  }, [profile?.name, user?.displayName, editingName])

  const savedDays = integer(profile?.khatmaDays, 1, 365)
  const savedStart = text(profile?.khatmaStartDate)

  const hasSavedPlan =
    savedDays !== null && dateUTC(savedStart) !== null

  useEffect(() => {
    const fingerprint = `${uid || ''}:${savedDays || 0}:${savedStart}`

    if (syncedPlanRef.current === fingerprint) return

    syncedPlanRef.current = fingerprint
    setDays(savedDays || 30)
    setStartDate(dateUTC(savedStart) ? savedStart : todayISO())
  }, [uid, savedDays, savedStart])

  const cloudPage = integer(
    profile?.lastReadPage,
    1,
    TOTAL_PAGES,
  )

  const cloudLocation: ReadingLocation | null = cloudPage
    ? {
        page: cloudPage,
        riwaya: RIWAYAT.includes(text(profile?.lastReadRiwayaId))
          ? text(profile?.lastReadRiwayaId)
          : null,
        surah: integer(profile?.lastReadSurahNumber, 1, 114),
        ayah: integer(profile?.lastReadAyahNumber, 1, 286),
      }
    : null

  const location = deviceLocation || cloudLocation

  const readingSource = deviceLocation
    ? 'هذا الجهاز'
    : cloudLocation
      ? 'الحساب'
      : 'غير متاح'

  const currentPage = location?.page || 1

  const locationPercent = Math.round(
    ((currentPage - 1) / (TOTAL_PAGES - 1)) * 100,
  )

  const planPagesPerDay = Math.ceil(TOTAL_PAGES / days)

  const endDate = useMemo(
    () => addDays(startDate, days - 1),
    [startDate, days],
  )

  const elapsed = hasSavedPlan
    ? Math.min(savedDays || 0, elapsedDays(savedStart, todayISO()))
    : 0

  const expectedPages = hasSavedPlan
    ? Math.min(
        TOTAL_PAGES,
        elapsed * Math.ceil(TOTAL_PAGES / (savedDays || 30)),
      )
    : 0

  const approximateBehind = Math.max(
    0,
    expectedPages - (currentPage - 1),
  )

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!uid || !canSave || savingName) return

    const name = nameDraft.replace(/\s+/g, ' ').trim()

    if (name.length < 2 || name.length > 60) {
      setNameNotice('الاسم يجب أن يكون بين حرفين و60 حرفًا.')
      return
    }

    setSavingName(true)
    setNameNotice('')

    try {
      await updateDoc(doc(db, 'users', uid), {
        name,
        displayName: name,
        updatedAt: serverTimestamp(),
      })

      setEditingName(false)
      setNameNotice('تم حفظ الاسم في حسابك.')
    } catch (error) {
      console.error('SAMEE3 profile name:', error)

      setNameNotice(
        'تعذر حفظ الاسم. تحقق من الاتصال وصلاحيات Firestore.',
      )
    } finally {
      setSavingName(false)
    }
  }

  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!uid || !canSave || savingPlan) return

    if (
      !Number.isInteger(days) ||
      days < 1 ||
      days > 365 ||
      !dateUTC(startDate)
    ) {
      setPlanNotice('حدد عدد أيام وتاريخ بداية صالحين.')
      return
    }

    setSavingPlan(true)
    setPlanNotice('')

    try {
      await updateDoc(doc(db, 'users', uid), {
        khatmaDays: days,
        khatmaStartDate: startDate,
        khatmaPagesPerDay: planPagesPerDay,
        updatedAt: serverTimestamp(),
      })

      setPlanNotice('تم حفظ خطة الختمة في حسابك بنجاح.')
    } catch (error) {
      console.error('SAMEE3 khatma:', error)

      setPlanNotice(
        'تعذر حفظ الخطة. تحقق من الاتصال وصلاحيات Firestore.',
      )
    } finally {
      setSavingPlan(false)
    }
  }

  const removeBookmark = (number: number) => {
    setBookmarkNotice('')

    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem(BOOKMARK_KEY) || '[]',
      )

      if (!Array.isArray(parsed)) {
        throw new Error('Invalid bookmarks')
      }

      const next = parsed.filter(
        (entry: unknown) => asRecord(entry)?.number !== number,
      )

      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next))
      reloadLocal()

      setBookmarkNotice(
        'تمت إزالة الآية المحددة من محفوظات هذا الجهاز.',
      )
    } catch {
      setBookmarkNotice(
        'تعذر حذف الآية. لم يتم تغيير المحفوظات.',
      )
    }
  }

  const logout = async () => {
    if (signingOut) return

    setSigningOut(true)
    setLogoutError('')

    try {
      await signOut(auth)
      router.replace('/auth')
    } catch {
      setLogoutError('تعذر تسجيل الخروج. حاول مرة أخرى.')
    } finally {
      setSigningOut(false)
    }
  }

  if (loading || profileStatus === 'loading') {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f9fe] text-[#15566b]"
      >
        <Loader2 className="ml-2 animate-spin" size={22} />
        جارٍ تحميل حسابك…
      </main>
    )
  }

  if (!user) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f9fe] p-4"
      >
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto text-[#b58b4b]" size={36} />

          <h1 className="mt-3 text-xl font-extrabold">
            حسابي في مصحف سميع
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            سجّل الدخول لحفظ خطة الختمة والاطلاع على بيانات حسابك.
          </p>

          <Link
            href="/auth"
            className="mt-5 inline-flex rounded-2xl bg-[#15566b] px-6 py-3 text-sm font-bold text-white"
          >
            تسجيل الدخول
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f9fe] pb-32 pt-6 text-[#132f40]"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6">

        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#a87d3e]">
              SAMEE3 · مصحف سميع
            </p>

            <h1 className="mt-1 text-2xl font-extrabold">
              حسابي وإنجازي
            </h1>
          </div>

          <Link
            href="/"
            aria-label="العودة للرئيسية"
            className="rounded-xl border border-slate-200 bg-white p-3 text-[#15566b]"
          >
            <ArrowRight size={20} />
          </Link>
        </header>

        {profileStatus !== 'ready' && (
          <div
            role="status"
            className="mb-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900"
          >
            <CloudOff className="mt-1 shrink-0" size={19} />

            {profileStatus === 'missing'
              ? 'بيانات حسابك في Firestore غير مكتملة. لا يمكن حفظ تعديلات الحساب قبل استكمال ملف المستخدم.'
              : 'تعذر التحقق من بيانات حسابك الحالية. يمكنك الاطلاع على المحتوى المحلي، لكن حفظ تغييرات الحساب يتطلب اتصالًا وتحققًا ناجحًا.'}
          </div>
        )}

        {/* Profile card */}
        <section className="mb-5 rounded-[28px] bg-gradient-to-br from-[#103d4c] via-[#15566b] to-[#17485b] p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#e7c890]">
                <UserRound size={27} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-white/65">
                  مرحبًا بك في مصحف سميع
                </p>

                <h2 className="mt-1 truncate text-xl font-extrabold">
                  {profile?.name || user.displayName || 'يا باغي الخير'}
                </h2>

                <p
                  dir="ltr"
                  className="mt-1 truncate text-left text-xs text-white/75"
                >
                  {user.email || ''}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5c68c]/30 bg-[#e5c68c]/10 px-3 py-1.5 text-xs font-bold text-[#f3d6a3]">
              <ShieldCheck size={15} />
              {isAdmin ? 'حساب إدارة' : 'حساب مستخدم'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingName(true)
                setNameNotice('')
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"
            >
              <Edit3 size={16} />
              تعديل الاسم
            </button>

            <Link
              href="/messages"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"
            >
              <MessageCircle size={16} />
              مراسلة الإدارة
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-xl border border-[#e5c68c]/30 bg-[#e5c68c]/15 px-4 py-2.5 text-sm font-bold"
              >
                <ShieldCheck size={16} />
                لوحة الإدارة
              </Link>
            )}
          </div>
        </section>

        {/* Edit name */}
        {editingName && (
          <form
            onSubmit={(event) => void saveName(event)}
            className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold">
                تعديل الاسم الظاهر
              </h3>

              <button
                type="button"
                aria-label="إغلاق تعديل الاسم"
                onClick={() => setEditingName(false)}
                className="rounded-lg p-2 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <label
              htmlFor="profile-name"
              className="mt-3 block text-xs font-bold text-slate-500"
            >
              اسمك
            </label>

            <input
              id="profile-name"
              value={nameDraft}
              maxLength={60}
              onChange={(event) => setNameDraft(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#b58b4b]"
            />

            <button
              type="submit"
              disabled={!canSave || savingName}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#15566b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {savingName ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              حفظ الاسم
            </button>
          </form>
        )}

        {nameNotice && (
          <p
            role="status"
            className="mb-5 rounded-xl bg-white p-3 text-sm text-[#15566b]"
          >
            {nameNotice}
          </p>
        )}

        {/* Reading progress */}
        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <BookOpen size={22} className="text-[#b58b4b]" />
              متابعة القراءة
            </h2>

            <span className="rounded-full bg-[#fff6e8] px-3 py-1.5 text-xs font-bold text-[#90682f]">
              المصدر: {readingSource}
            </span>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">
                آخر موضع معروف
              </p>

              <p className="mt-1 text-3xl font-extrabold text-[#15566b]">
                الصفحة {numberAr(currentPage)}
              </p>
            </div>

            <p className="text-xs text-slate-500">
              من {numberAr(TOTAL_PAGES)}
            </p>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#bc9153] to-[#e6c994]"
              style={{
                width: `${locationPercent}%`,
              }}
            />
          </div>

          <p className="mt-3 text-xs leading-6 text-slate-500">
            المؤشر يوضح موضعك داخل المصحف، وليس نسبة الآيات
            التي أتممت قراءتها فعليًا.
          </p>

          <Link
            href={readingHref(location)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15566b] px-5 py-3.5 text-sm font-extrabold text-white"
          >
            <BookOpen size={18} />
            متابعة القراءة
            <ChevronLeft size={17} />
          </Link>

          {cloudLocation &&
            deviceLocation &&
            cloudLocation.page !== deviceLocation.page && (
              <p className="mt-3 text-xs leading-6 text-amber-700">
                موضع هذا الجهاز مختلف عن آخر موضع محفوظ في
                الحساب (صفحة {numberAr(cloudLocation.page)}).
                لم تتم مزامنتهما تلقائيًا.
              </p>
            )}
        </section>

        {/* Khatma plan */}
        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <CalendarDays className="text-[#b58b4b]" size={22} />
            خطة الختمة
          </h2>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            حدد مدة الختمة وتاريخ بدايتها. تُحفظ الخطة في حساب Firebase.
          </p>

          <form
            className="mt-5"
            onSubmit={(event) => void savePlan(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-600">
                  عدد أيام الختمة
                </span>

                <select
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#b58b4b]"
                >
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {numberAr(option)} يوم
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-600">
                  تاريخ البداية
                </span>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#b58b4b]"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f4f9fe] p-4">
                <p className="text-xs text-slate-500">
                  الصفحات يوميًا
                </p>

                <p className="mt-2 text-xl font-extrabold text-[#15566b]">
                  {numberAr(planPagesPerDay)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fff9ef] p-4">
                <p className="text-xs text-slate-500">
                  تاريخ الإتمام المتوقع
                </p>

                <p className="mt-2 text-sm font-extrabold leading-7 text-[#90682f]">
                  {dateLabel(endDate)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSave || savingPlan}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15566b] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {savingPlan ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}

              {savingPlan
                ? 'جارٍ الحفظ…'
                : 'حفظ خطة الختمة'}
            </button>

            {planNotice && (
              <p
                role="status"
                className="mt-3 text-sm font-bold text-[#15566b]"
              >
                {planNotice}
              </p>
            )}
          </form>

          {hasSavedPlan ? (
            <div className="mt-5 rounded-2xl border border-[#e7d6b9] bg-[#fffaf2] p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-[#90682f]">
                <CheckCircle2 size={18} />
                الخطة المحفوظة
              </p>

              <p className="mt-2 text-sm leading-7 text-slate-700">
                {numberAr(savedDays || 30)} يوم،
                تبدأ {dateLabel(savedStart)} وتنتهي{' '}
                {dateLabel(addDays(savedStart, (savedDays || 30) - 1))}.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs leading-6 text-slate-600">
                <span>
                  أيام الخطة حتى اليوم:
                  <strong> {numberAr(elapsed)}</strong>
                </span>

                <span>
                  المستهدف التقريبي:
                  <strong> {numberAr(expectedPages)} صفحة</strong>
                </span>
              </div>

              <p className="mt-2 text-xs leading-6 text-slate-500">
                {approximateBehind > 0
                  ? `المسافة التقديرية بين موضعك والمستهدف: ${numberAr(approximateBehind)} صفحة.`
                  : 'موضعك الحالي بلغ المستهدف التقريبي أو تجاوزه.'}

                {' '}هذا تقدير بحسب رقم الصفحة، وليس إثباتًا لإنجاز القراءة.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              لا توجد خطة ختمة محفوظة بعد.
            </p>
          )}
        </section>

        {/* Saved ayahs */}
        <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <Bookmark className="text-[#b58b4b]" size={22} />
              الآيات المحفوظة
            </h2>

            <span className="text-sm font-bold text-[#15566b]">
              {numberAr(bookmarks.length)}
            </span>
          </div>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            هذه المحفوظات مخزّنة على الجهاز الحالي وليست مزامنة بحساب Firebase.
          </p>

          {bookmarkNotice && (
            <p
              role="status"
              className="mt-3 rounded-xl bg-[#f4f9fe] p-3 text-xs font-bold text-[#15566b]"
            >
              {bookmarkNotice}
            </p>
          )}

          {!bookmarks.length ? (
            <div className="py-10 text-center">
              <Bookmark
                className="mx-auto text-[#d0ab73]"
                size={30}
              />

              <p className="mt-3 text-sm text-slate-500">
                لم تحفظ آيات بعد. افتح المصحف واضغط على آية لحفظها.
              </p>

              <Link
                href="/mushaf"
                className="mt-4 inline-flex rounded-xl bg-[#15566b] px-5 py-2.5 text-sm font-bold text-white"
              >
                فتح المصحف
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {bookmarks.map((item) => (
                <article
                  key={item.number}
                  className="rounded-2xl border border-slate-100 bg-[#fbfcfd] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-[#15566b]">
                        {item.surahName}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        الآية {numberAr(item.numberInSurah)}
                        {item.page
                          ? ` · صفحة ${numberAr(item.page)}`
                          : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBookmark(item.number)}
                      aria-label={`إزالة الآية ${numberAr(item.numberInSurah)} من المحفوظات`}
                      className="rounded-xl bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-lg leading-[2.2] text-slate-800">
                    {item.text}
                  </p>

                  <Link
                    href={bookmarkHref(item)}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#15566b]"
                  >
                    <BookOpen size={16} />
                    الانتقال إلى الآية
                    <ChevronLeft size={15} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Logout */}
        <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-5">
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-700 disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogOut size={18} />
            )}
            تسجيل الخروج
          </button>

          {logoutError && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {logoutError}
            </p>
          )}
        </div>

        <p className="pb-3 text-center text-xs leading-6 text-slate-500">
          <Target
            size={15}
            className="ml-1 inline text-[#b58b4b]"
          />
          آخر موضع محفوظ ليس سجلًا لعدد الصفحات المقروءة.
          سنربط مزامنة تقدم القراءة بين الأجهزة مع ملف المصحف لاحقًا.
        </p>
      </div>
    </main>
  )
}
