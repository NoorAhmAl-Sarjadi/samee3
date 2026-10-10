
'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Home,
  Loader2,
  LockKeyhole,
  LogIn,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

/**
 * SAMEE3 — Admin access gate
 * Path: components/AdminGate.tsx
 *
 * Uses the live, server-verified profile from AuthContext.
 * Does not read Firestore a second time or cache admin permissions.
 */

type GateState =
  | 'checking'
  | 'signed-out'
  | 'unavailable'
  | 'missing'
  | 'denied'

interface AdminGateProps {
  children: ReactNode
}

function GateScreen({
  state,
  disabledAccount,
}: {
  state: GateState
  disabledAccount: boolean
}) {
  const checking = state === 'checking'
  const signedOut = state === 'signed-out'
  const unavailable = state === 'unavailable'
  const missing = state === 'missing'

  const heading = checking
    ? 'جارٍ التحقق من صلاحيات الإدارة'
    : signedOut
      ? 'تسجيل الدخول مطلوب'
      : unavailable
        ? 'تعذر التحقق من الصلاحيات'
        : missing
          ? 'ملف الحساب غير مكتمل'
          : disabledAccount
            ? 'هذا الحساب غير مفعل'
            : 'الوصول إلى الإدارة غير مسموح'

  const description = checking
    ? 'نتأكد من حسابك وصلاحية الإدارة من بيانات Firebase الحالية.'
    : signedOut
      ? 'سجّل الدخول بحساب الإدارة أولًا لفتح لوحة التحكم.'
      : unavailable
        ? 'تعذر تأكيد صلاحية الإدارة من Firestore حاليًا. لا نسمح بالدخول اعتمادًا على بيانات قديمة محفوظة دون اتصال.'
        : missing
          ? 'حسابك موجود، لكن مستند المستخدم في Firestore غير موجود. راجع بيانات الحساب وصلاحياته.'
          : disabledAccount
            ? 'تم تعطيل الحساب من بيانات المستخدم. تواصل مع مسؤول المنصة إذا كان ذلك غير متوقع.'
            : 'الحساب الحالي لا يحمل دور admin معتمدًا في Firestore.'

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#f4f9fe] px-4 py-10 text-slate-900"
    >
      <section
        aria-live={checking ? 'polite' : undefined}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-[#e5d8be] bg-white shadow-[0_22px_65px_rgba(15,46,63,0.10)]"
      >
        <div className="bg-gradient-to-br from-[#103d4c] to-[#155b72] px-6 py-7 text-center text-white">
          <span className="text-xs font-bold tracking-wide text-[#e6ca96]">
            SAMEE3 · مصحف سميع
          </span>

          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-[#e8d09f]">
            {checking ? (
              <Loader2
                size={30}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : unavailable ? (
              <WifiOff
                size={30}
                aria-hidden="true"
              />
            ) : signedOut ? (
              <LogIn
                size={30}
                aria-hidden="true"
              />
            ) : missing ? (
              <ShieldAlert
                size={30}
                aria-hidden="true"
              />
            ) : (
              <LockKeyhole
                size={30}
                aria-hidden="true"
              />
            )}
          </div>

          <h1 className="mt-5 text-xl font-extrabold leading-8">
            {heading}
          </h1>
        </div>

        <div className="px-6 pb-7 pt-6 text-center">
          <p className="text-sm leading-8 text-slate-600">
            {description}
          </p>

          {!checking && (
            <div className="mt-6 grid gap-3">
              {signedOut ? (
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#145b72] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#0e485b]"
                >
                  <LogIn
                    size={18}
                    aria-hidden="true"
                  />
                  تسجيل الدخول
                </Link>
              ) : unavailable || missing ? (
                <button
                  type="button"
                  onClick={() =>
                    window.location.reload()
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#145b72] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#0e485b]"
                >
                  <RefreshCw
                    size={18}
                    aria-hidden="true"
                  />
                  إعادة التحقق
                </button>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-[#145b72] transition hover:bg-slate-50"
              >
                <Home
                  size={18}
                  aria-hidden="true"
                />
                العودة إلى التطبيق
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                />
              </Link>
            </div>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-xs leading-6 text-slate-500">
            <ShieldCheck
              size={16}
              className="shrink-0 text-[#b48b4a]"
              aria-hidden="true"
            />
            حماية البيانات الفعلية تتم من خلال قواعد Firestore.
          </p>
        </div>
      </section>
    </main>
  )
}

export default function AdminGate({
  children,
}: AdminGateProps) {
  const {
    user,
    profile,
    loading,
    isAdmin,
    profileStatus,
  } = useAuth()

  const router = useRouter()

  const checking =
    loading || profileStatus === 'loading'

  useEffect(() => {
    if (
      !checking &&
      !user &&
      profileStatus === 'signed-out'
    ) {
      router.replace('/auth')
    }
  }, [
    checking,
    user,
    profileStatus,
    router,
  ])

  // Revoke the admin UI immediately
  // whenever the live role changes.
  if (
    !checking &&
    user &&
    isAdmin &&
    profileStatus === 'ready'
  ) {
    return <>{children}</>
  }

  const state: GateState = checking
    ? 'checking'
    : profileStatus === 'unavailable'
      ? 'unavailable'
      : !user
        ? 'signed-out'
        : profileStatus === 'missing'
          ? 'missing'
          : 'denied'

  return (
    <GateScreen
      state={state}
      disabledAccount={
        profile?.status === 'disabled'
      }
    />
  )
}
