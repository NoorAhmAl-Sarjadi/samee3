'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck, WifiOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

/**
 * The public /messages address opens the personal chat for regular users.
 * An authenticated admin is sent to the separate administration inbox.
 * Never guess an admin role using an email or localStorage.
 */
export default function MessagesLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading, isAdmin, profileStatus } = useAuth()

  useEffect(() => {
    if (!loading && isAdmin) {
      router.replace('/admin/messages')
    }
  }, [loading, isAdmin, router])

  // Do not briefly mount the user chat while an admin role is being verified.
  if (loading || isAdmin || (user && profileStatus === 'loading')) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f9fe] p-6">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 text-sm font-bold text-[#14596e] shadow-sm">
          {isAdmin ? <ShieldCheck size={22} /> : <Loader2 size={22} className="animate-spin" />}
          {isAdmin ? 'جارٍ فتح صندوق رسائل الإدارة…' : 'جارٍ التحقق من نوع الحساب…'}
        </div>
      </main>
    )
  }

  // If Firestore cannot verify the profile, don't silently treat an admin as a user.
  if (user && profileStatus === 'unavailable') {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f9fe] p-6">
        <section className="max-w-md rounded-3xl border border-amber-100 bg-white p-7 text-center shadow-sm">
          <WifiOff className="mx-auto mb-3 text-amber-600" size={30} />
          <h1 className="text-lg font-extrabold">تعذر التحقق من صلاحيات الحساب</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">اتصل بالإنترنت وأعد فتح صفحة الرسائل حتى نتمكن من تحديد واجهة حسابك بشكل آمن.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#14596e] px-5 py-3 text-sm font-bold text-white">إعادة المحاولة</button>
        </section>
      </main>
    )
  }

  return <>{children}</>
}