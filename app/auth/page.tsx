
'use client'

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

/**
 * SAMEE3 — Authentication
 * Path: app/auth/page.tsx
 *
 * Login never rewrites the user's Firestore
 * profile or admin role.
 *
 * Registration creates a non-admin profile.
 */

type PendingProfile = {
  uid: string
  name: string
  email: string
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function errorCode(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code ===
      'string'
  ) {
    return (error as { code: string }).code
  }

  return ''
}

function firebaseErrorMessage(
  code: string,
  isLogin: boolean,
): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحين.'

    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول أو استعادة كلمة المرور.'

    case 'auth/invalid-email':
      return 'اكتب عنوان بريد إلكتروني صحيحًا.'

    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة. استخدم كلمة أقوى تحتوي على 6 أحرف على الأقل.'

    case 'auth/too-many-requests':
      return 'هناك محاولات كثيرة على هذا الحساب. حاول لاحقًا.'

    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالإنترنت. تحقق من اتصالك وحاول مجددًا.'

    case 'auth/user-disabled':
      return 'هذا الحساب معطّل. تواصل مع إدارة المنصة.'

    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعل في Firebase.'

    case 'auth/unauthorized-domain':
      return 'نطاق الموقع غير مصرح به في إعدادات Firebase Authentication.'

    default:
      return isLogin
        ? 'تعذر تسجيل الدخول الآن. حاول مرة أخرى.'
        : 'تعذر إنشاء الحساب الآن. حاول مرة أخرى.'
  }
}

/**
 * Save a new profile without overwriting
 * an existing document or admin privileges.
 */
async function saveNewUserProfile(
  profile: PendingProfile,
): Promise<void> {
  const userRef = doc(db, 'users', profile.uid)

  const existing = await getDoc(userRef)

  // Important when retrying a previous write.
  if (existing.exists()) {
    return
  }

  await setDoc(userRef, {
    name: profile.name,
    displayName: profile.name,
    email: profile.email,
    role: 'user',
    status: 'active',
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [showPassword, setShowPassword] =
    useState(false)

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false)

  const [isLoading, setIsLoading] =
    useState(false)

  const [isResetting, setIsResetting] =
    useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [pendingProfile, setPendingProfile] =
    useState<PendingProfile | null>(null)

  const busyRef = useRef(false)

  /**
   * Reload AuthContext after the account
   * profile has been saved to Firestore.
   */
  const navigateToProfile = () => {
    window.location.replace('/profile')
  }

  // ===========================================
  // Login and registration
  // ===========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (busyRef.current || pendingProfile) {
      return
    }

    setError('')
    setNotice('')

    const cleanEmail = normalizeEmail(email)
    const cleanName = normalizeName(name)

    if (!validEmail(cleanEmail)) {
      setError('يرجى كتابة بريد إلكتروني صحيح.')
      return
    }

    if (
      !isLogin &&
      (
        cleanName.length < 2 ||
        cleanName.length > 60
      )
    ) {
      setError(
        'الاسم يجب أن يكون بين حرفين و60 حرفًا.',
      )
      return
    }

    if (password.length < 6) {
      setError(
        'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
      )
      return
    }

    if (
      !isLogin &&
      password !== confirmPassword
    ) {
      setError('تأكيد كلمة المرور غير مطابق.')
      return
    }

    busyRef.current = true
    setIsLoading(true)

    try {
      // ---------------------------------------
      // Existing account
      // ---------------------------------------

      if (isLogin) {
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        )

        // Do not rewrite role, status or name.
        // AuthContext reads the stored profile.
        navigateToProfile()
        return
      }

      // ---------------------------------------
      // New account
      // ---------------------------------------

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        )

      const newProfile: PendingProfile = {
        uid: credential.user.uid,
        name: cleanName,
        email:
          credential.user.email ||
          cleanEmail,
      }

      // Save the name in Firebase Auth.
      try {
        await updateProfile(
          credential.user,
          {
            displayName: cleanName,
          },
        )
      } catch (profileError) {
        console.warn(
          'SAMEE3: Auth displayName update failed',
          profileError,
        )
      }

      // ---------------------------------------
      // Save Firestore profile
      // ---------------------------------------

      try {
        await saveNewUserProfile(newProfile)

        setPassword('')
        setConfirmPassword('')

        navigateToProfile()
      } catch (firestoreError) {
        console.error(
          'SAMEE3: new profile save failed',
          firestoreError,
        )

        setPendingProfile(newProfile)
        setPassword('')
        setConfirmPassword('')

        setError(
          'تم إنشاء حسابك، لكن تعذر حفظ بياناته في Firestore. اضغط «إعادة حفظ البيانات» بعد التأكد من اتصال الإنترنت وصلاحيات القواعد. لا تنشئ حسابًا جديدًا.',
        )
      }
    } catch (authError) {
      console.error(
        'SAMEE3: authentication failed',
        errorCode(authError),
      )

      setError(
        firebaseErrorMessage(
          errorCode(authError),
          isLogin,
        ),
      )
    } finally {
      busyRef.current = false
      setIsLoading(false)
    }
  }

  // ===========================================
  // Recover incomplete account profile
  // ===========================================

  const retryProfileSave = async () => {
    if (
      !pendingProfile ||
      busyRef.current
    ) {
      return
    }

    if (
      auth.currentUser?.uid !== pendingProfile.uid
    ) {
      setPendingProfile(null)

      setError(
        'انتهت جلسة إنشاء الحساب. سجّل الدخول إلى حسابك ثم حاول مرة أخرى.',
      )

      setIsLogin(true)
      return
    }

    busyRef.current = true
    setIsLoading(true)
    setError('')

    try {
      await saveNewUserProfile(pendingProfile)

      setPendingProfile(null)

      navigateToProfile()
    } catch (saveError) {
      console.error(
        'SAMEE3: profile retry failed',
        saveError,
      )

      setError(
        'تعذر حفظ البيانات مجددًا. تحقق من اتصال الإنترنت ومن قواعد Firestore المنشورة؛ حساب تسجيل الدخول موجود بالفعل.',
      )
    } finally {
      busyRef.current = false
      setIsLoading(false)
    }
  }

  // ===========================================
  // Password recovery
  // ===========================================

  const handleResetPassword = async () => {
    if (
      busyRef.current ||
      isLoading ||
      isResetting
    ) {
      return
    }

    setError('')
    setNotice('')

    const cleanEmail = normalizeEmail(email)

    if (!validEmail(cleanEmail)) {
      setError(
        'اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟».',
      )
      return
    }

    setIsResetting(true)

    try {
      await sendPasswordResetEmail(
        auth,
        cleanEmail,
      )

      setNotice(
        'إذا كان هذا البريد مرتبطًا بحساب، فستصلك رسالة لإعادة تعيين كلمة المرور. افحص البريد غير المرغوب فيه أيضًا.',
      )
    } catch (resetError) {
      const code = errorCode(resetError)

      if (
        code === 'auth/network-request-failed' ||
        code === 'auth/too-many-requests'
      ) {
        setError(
          firebaseErrorMessage(code, true),
        )
      } else {
        setNotice(
          'إذا كان هذا البريد مرتبطًا بحساب، فستصلك تعليمات إعادة تعيين كلمة المرور عند توفر الخدمة.',
        )
      }
    } finally {
      setIsResetting(false)
    }
  }

  // ===========================================
  // Switch authentication mode
  // ===========================================

  const toggleMode = () => {
    if (isLoading || isResetting) {
      return
    }

    setIsLogin((current) => !current)

    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')

    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const busy = isLoading || isResetting

  const fieldClass =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-sm text-slate-800 outline-none transition focus:border-[#0284c7] focus:bg-white focus:ring-4 focus:ring-[#0284c7]/10 disabled:opacity-60'

  // ===========================================
  // User interface
  // ===========================================

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center bg-[#f4f9fe] px-4 pb-28 pt-8 sm:px-6 sm:pb-10"
    >
      <div className="w-full max-w-md">

        {/* Back button */}
        <div className="mb-5 flex items-center justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:text-[#0284c7]"
          >
            <ArrowRight
              size={16}
              aria-hidden="true"
            />

            العودة إلى مصحف سميع
          </Link>
        </div>

        {/* Auth card */}
        <section className="relative overflow-hidden rounded-[30px] border border-[#e9d8b7] bg-white p-6 shadow-[0_22px_70px_rgba(16,49,69,0.10)] sm:p-8">

          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-[#d5b177]/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-sky-100 blur-3xl" />

          {/* Brand */}
          <div className="relative text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#dfc99f] bg-[#fcfbf8] text-[#b68b4b] shadow-sm">
              <UserRound
                size={29}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            <p className="text-[11px] font-bold tracking-wide text-[#ac8548]">
              SAMEE3 · مصحف سميع
            </p>

            <h1 className="mt-2 text-2xl font-black text-[#17354a]">
              {isLogin
                ? 'تسجيل الدخول'
                : 'إنشاء حساب جديد'}
            </h1>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              {isLogin
                ? 'مرحبًا بعودتك. أكمل رحلتك القرآنية من حيث توقفت.'
                : 'أنشئ حسابًا لحفظ اسمك وتقدم قراءتك وخطة الختمة.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="relative mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold leading-7 text-rose-800"
            >
              {error}
            </p>
          )}

          {/* Notice */}
          {notice && (
            <p
              role="status"
              className="relative mt-5 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold leading-7 text-emerald-800"
            >
              <CheckCircle2
                size={19}
                className="mt-1 shrink-0"
                aria-hidden="true"
              />

              {notice}
            </p>
          )}

          {/* Recover incomplete registration */}
          {pendingProfile ? (
            <div className="relative mt-6 space-y-3">

              <p className="rounded-2xl bg-[#f7f9fb] p-4 text-sm leading-7 text-slate-600">
                الحساب باسم{' '}
                <strong>
                  {pendingProfile.name}
                </strong>{' '}
                موجود في Firebase Authentication،
                لكن ملف البيانات ما زال يحتاج حفظًا.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void retryProfileSave()
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0284c7] px-5 py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <ShieldCheck size={19} />
                )}

                إعادة حفظ البيانات
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingProfile(null)
                  setIsLogin(true)
                  setError('')
                  setNotice('')
                }}
                className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700"
              >
                العودة إلى تسجيل الدخول
              </button>
            </div>
          ) : (

            /* Registration / Login form */
            <form
              onSubmit={(
                event: FormEvent<HTMLFormElement>,
              ) => void handleSubmit(event)}
              className="relative mt-7 space-y-4"
            >

              {/* Name */}
              {!isLogin && (
                <div>
                  <label
                    htmlFor="samee3-name"
                    className="mb-2 block text-xs font-extrabold text-slate-600"
                  >
                    الاسم
                  </label>

                  <div className="relative">
                    <UserRound
                      size={19}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#b68b4b]"
                      aria-hidden="true"
                    />

                    <input
                      id="samee3-name"
                      type="text"
                      value={name}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setName(event.target.value)
                      }
                      autoComplete="name"
                      placeholder="الاسم الذي تريد ظهوره في التطبيق"
                      minLength={2}
                      maxLength={60}
                      required
                      disabled={busy}
                      className={fieldClass}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="samee3-email"
                  className="mb-2 block text-xs font-extrabold text-slate-600"
                >
                  البريد الإلكتروني
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#b68b4b]"
                    aria-hidden="true"
                  />

                  <input
                    id="samee3-email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setEmail(event.target.value)
                    }
                    autoComplete="email"
                    placeholder="example@email.com"
                    required
                    disabled={busy}
                    className={`${fieldClass} text-left`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label
                    htmlFor="samee3-password"
                    className="text-xs font-extrabold text-slate-600"
                  >
                    كلمة المرور
                  </label>

                  {isLogin && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleResetPassword()
                      }
                      className="text-xs font-extrabold text-[#0284c7] hover:underline disabled:opacity-50"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  )}
                </div>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#b68b4b]"
                    aria-hidden="true"
                  />

                  <input
                    id="samee3-password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    dir="ltr"
                    value={password}
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setPassword(event.target.value)
                    }
                    autoComplete={
                      isLogin
                        ? 'current-password'
                        : 'new-password'
                    }
                    placeholder="6 أحرف على الأقل"
                    minLength={6}
                    required
                    disabled={busy}
                    className={`${fieldClass} pr-12 pl-12 text-left`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value,
                      )
                    }
                    disabled={busy}
                    aria-label={
                      showPassword
                        ? 'إخفاء كلمة المرور'
                        : 'إظهار كلمة المرور'
                    }
                    aria-pressed={showPassword}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              {!isLogin && (
                <div>
                  <label
                    htmlFor="samee3-confirm"
                    className="mb-2 block text-xs font-extrabold text-slate-600"
                  >
                    تأكيد كلمة المرور
                  </label>

                  <div className="relative">
                    <KeyRound
                      size={19}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#b68b4b]"
                      aria-hidden="true"
                    />

                    <input
                      id="samee3-confirm"
                      type={
                        showConfirmPassword
                          ? 'text'
                          : 'password'
                      }
                      dir="ltr"
                      value={confirmPassword}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setConfirmPassword(
                          event.target.value,
                        )
                      }
                      autoComplete="new-password"
                      minLength={6}
                      required
                      disabled={busy}
                      placeholder="أعد كتابة كلمة المرور"
                      className={`${fieldClass} pr-12 pl-12 text-left`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (value) => !value,
                        )
                      }
                      disabled={busy}
                      aria-label={
                        showConfirmPassword
                          ? 'إخفاء تأكيد كلمة المرور'
                          : 'إظهار تأكيد كلمة المرور'
                      }
                      aria-pressed={
                        showConfirmPassword
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0284c7] px-4 py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(2,132,199,0.18)] transition hover:bg-[#036fa9] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2
                    size={20}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck
                    size={19}
                    aria-hidden="true"
                  />
                )}

                {isLoading
                  ? 'جارٍ التنفيذ…'
                  : isLogin
                    ? 'دخول'
                    : 'إنشاء حساب'}
              </button>
            </form>
          )}

          {/* Switch mode */}
          {!pendingProfile && (
            <div className="relative mt-6 text-center text-sm">
              <span className="text-slate-500">
                {isLogin
                  ? 'ليس لديك حساب؟ '
                  : 'لديك حساب بالفعل؟ '}
              </span>

              <button
                type="button"
                onClick={toggleMode}
                disabled={busy}
                className="font-extrabold text-[#0284c7] hover:underline disabled:opacity-50"
              >
                {isLogin
                  ? 'إنشاء حساب جديد'
                  : 'تسجيل الدخول'}
              </button>
            </div>
          )}

          {/* Security information */}
          <div className="relative mt-6 flex items-start gap-2 rounded-2xl bg-[#fcfbf8] px-4 py-3 text-xs leading-6 text-slate-500">
            <ShieldCheck
              size={17}
              className="mt-1 shrink-0 text-[#b68b4b]"
              aria-hidden="true"
            />

            <p>
              بياناتك مرتبطة بحساب Firebase
              الخاص بك، ولا تُحفظ كلمة المرور
              في ملف المستخدم على Firestore.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
