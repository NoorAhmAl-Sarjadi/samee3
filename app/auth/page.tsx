'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, Lock, Mail, UserRound } from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

function getArabicAuthError(code: string | undefined, isLogin: boolean) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة'

    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مستخدم بالفعل'

    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل'

    case 'auth/invalid-email':
      return 'يرجى كتابة بريد إلكتروني صحيح'

    case 'auth/too-many-requests':
      return 'تمت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى'

    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالإنترنت. تحقق من الاتصال ثم حاول مرة أخرى'

    case 'auth/user-disabled':
      return 'هذا الحساب غير نشط حاليًا'

    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعل في Firebase'

    default:
      return isLogin
        ? 'تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى'
        : 'تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى'
  }
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()

    if (!cleanEmail) {
      setError('اكتب البريد الإلكتروني')
      return
    }

    if (!isLogin) {
      if (cleanName.length < 2) {
        setError('اكتب اسمك بشكل صحيح')
        return
      }

      if (cleanName.length > 60) {
        setError('الاسم طويل جدًا، اجعله أقل من 60 حرفًا')
        return
      }
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }

    setIsLoading(true)

    try {
      if (isLogin) {
        /*
         * ============================================
         * تسجيل الدخول
         * ============================================
         */

        const credential = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        )

        const userRef = doc(db, 'users', credential.user.uid)

        const userSnap = await getDoc(userRef)

        const existing = userSnap.exists()
          ? (userSnap.data() as Record<string, unknown>)
          : null

        /*
         * لو الاسم موجود في Firestore نستخدمه،
         * ولو غير موجود نبحث في Firebase Auth،
         * ولو لا يوجد أي منهما نستخدم الجزء قبل @.
         */
        const existingName =
          typeof existing?.name === 'string' &&
          existing.name.trim()
            ? existing.name.trim()
            : credential.user.displayName?.trim() ||
              cleanEmail.split('@')[0]

        /*
         * ضمان وجود displayName في Firebase Auth
         */
        if (
          !credential.user.displayName &&
          existingName
        ) {
          try {
            await updateProfile(credential.user, {
              displayName: existingName,
            })
          } catch (profileError) {
            console.warn(
              'Auth displayName update failed:',
              profileError,
            )
          }
        }

        /*
         * تحديث بيانات المستخدم مع المحافظة على role
         */
        await setDoc(
          userRef,
          {
            name: existingName,
            displayName: existingName,
            email: cleanEmail,

            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            /*
             * لا نسمح بتحويل المستخدم إلى Admin
             * من واجهة تسجيل الدخول.
             *
             * لو كان Admin بالفعل نحافظ على الدور.
             */
            ...(existing?.role === 'admin'
              ? { role: 'admin' }
              : { role: 'user' }),
          },
          {
            merge: true,
          },
        )
      } else {
        /*
         * ============================================
         * إنشاء حساب جديد
         * ============================================
         */

        const credential =
          await createUserWithEmailAndPassword(
            auth,
            cleanEmail,
            password,
          )

        /*
         * حفظ الاسم في Firebase Authentication
         */
        try {
          await updateProfile(credential.user, {
            displayName: cleanName,
          })
        } catch (profileError) {
          console.warn(
            'Auth displayName update failed:',
            profileError,
          )
        }

        /*
         * إنشاء ملف المستخدم في Firestore
         *
         * users/{uid}
         */
        await setDoc(
          doc(db, 'users', credential.user.uid),
          {
            name: cleanName,
            displayName: cleanName,

            email: cleanEmail,

            /*
             * كل حساب جديد مستخدم عادي.
             * الأدمن يتم تعيينه من Firebase/Firestore
             * وليس من الصفحة.
             */
            role: 'user',

            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            status: 'active',
          },
        )
      }

      /*
       * بعد نجاح التسجيل أو تسجيل الدخول
       */
      router.replace('/profile')
      router.refresh()
    } catch (errorValue) {
      console.error(
        'Authentication error:',
        errorValue,
      )

      const code =
        typeof errorValue === 'object' &&
        errorValue !== null &&
        'code' in errorValue
          ? String(
              (
                errorValue as {
                  code?: unknown
                }
              ).code,
            )
          : undefined

      setError(
        getArabicAuthError(
          code,
          isLogin,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin((current) => !current)
    setError('')
  }

  return (
    <div
      className="
        min-h-screen
        bg-[var(--bg-main)]
        flex
        flex-col
        items-center
        justify-center
        px-5
        py-8
        pb-28
        md:pb-10
      "
      dir="rtl"
    >
      <div className="w-full max-w-md">

        {/* ============================================
            زر العودة
        ============================================ */}
        <div className="mb-4 text-center">
          <Link
            href="/"
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-white
              px-4
              py-2
              text-xs
              font-bold
              text-slate-500
              shadow-sm
              border
              border-slate-100
              hover:text-[var(--royal-blue)]
              transition
            "
          >
            العودة إلى مصحف سميع

            <ArrowRight size={15} />
          </Link>
        </div>

        {/* ============================================
            البطاقة الرئيسية
        ============================================ */}
        <div
          className="
            relative
            overflow-hidden
            rounded-[2rem]
            border
            border-[rgba(217,119,6,0.20)]
            bg-white
            p-7
            shadow-[0_24px_70px_rgba(15,23,42,0.10)]
            sm:p-8
          "
        >

          {/* خلفيات زخرفية */}
          <div
            className="
              pointer-events-none
              absolute
              -right-24
              -top-24
              h-56
              w-56
              rounded-full
              bg-[rgba(217,119,6,0.07)]
              blur-3xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-24
              -left-24
              h-56
              w-56
              rounded-full
              bg-[rgba(2,132,199,0.06)]
              blur-3xl
            "
          />

          {/* ============================================
              العنوان والأيقونة
          ============================================ */}
          <div
            className="
              relative
              z-10
              flex
              flex-col
              items-center
              text-center
            "
          >
            <div
              className="
                mb-4
                flex
                h-16
                w-16
                items-center
                justify-center
                rounded-[22px]
                border
                border-[rgba(217,119,6,0.35)]
                bg-[var(--mushaf-paper)]
                shadow-sm
              "
            >
              <UserRound
                size={30}
                className="text-[var(--gold-premium)]"
              />
            </div>

            <h1
              className="
                text-2xl
                font-black
                text-[var(--text-main)]
              "
            >
              {isLogin
                ? 'تسجيل الدخول'
                : 'إنشاء حساب جديد'}
            </h1>

            <p
              className="
                mt-2
                text-sm
                leading-7
                text-slate-500
              "
            >
              {isLogin
                ? 'مرحبًا بعودتك إلى مصحف سميع'
                : 'أنشئ حسابك واحفظ رحلتك القرآنية وبياناتك بأمان'}
            </p>
          </div>

          {/* ============================================
              رسالة الخطأ
          ============================================ */}
          {error && (
            <div
              className="
                relative
                z-10
                mt-6
                rounded-2xl
                border
                border-red-100
                bg-red-50
                px-4
                py-3
                text-center
                text-sm
                font-bold
                text-red-600
              "
            >
              {error}
            </div>
          )}

          {/* ============================================
              النموذج
          ============================================ */}
          <form
            onSubmit={handleSubmit}
            className="
              relative
              z-10
              mt-7
              flex
              flex-col
              gap-4
            "
          >

            {/* ============================================
                الاسم — يظهر عند إنشاء الحساب فقط
            ============================================ */}
            {!isLogin && (
              <div>
                <label
                  className="
                    mb-2
                    block
                    text-xs
                    font-extrabold
                    text-slate-600
                  "
                >
                  الاسم
                </label>

                <div className="relative">
                  <UserRound
                    size={19}
                    className="
                      absolute
                      right-4
                      top-1/2
                      -translate-y-1/2
                      text-[var(--gold-premium)]
                    "
                  />

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="اكتب اسمك"
                    autoComplete="name"
                    required
                    maxLength={60}
                    className="
                      w-full
                      rounded-2xl
                      border
                      border-slate-200
                      bg-slate-50
                      py-3.5
                      pr-12
                      pl-4
                      text-right
                      text-slate-800
                      placeholder:text-slate-400
                      outline-none
                      transition
                      focus:border-[var(--royal-blue)]
                      focus:bg-white
                      focus:ring-4
                      focus:ring-[rgba(2,132,199,0.08)]
                    "
                  />
                </div>
              </div>
            )}

            {/* ============================================
                البريد الإلكتروني
            ============================================ */}
            <div>
              <label
                className="
                  mb-2
                  block
                  text-xs
                  font-extrabold
                  text-slate-600
                "
              >
                البريد الإلكتروني
              </label>

              <div className="relative">
                <Mail
                  size={19}
                  className="
                    absolute
                    right-4
                    top-1/2
                    -translate-y-1/2
                    text-[var(--gold-premium)]
                  "
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="example@email.com"
                  autoComplete="email"
                  required
                  dir="ltr"
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    py-3.5
                    pr-12
                    pl-4
                    text-left
                    text-slate-800
                    placeholder:text-slate-400
                    outline-none
                    transition
                    focus:border-[var(--royal-blue)]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[rgba(2,132,199,0.08)]
                  "
                />
              </div>
            </div>

            {/* ============================================
                كلمة المرور
            ============================================ */}
            <div>
              <label
                className="
                  mb-2
                  block
                  text-xs
                  font-extrabold
                  text-slate-600
                "
              >
                كلمة المرور
              </label>

              <div className="relative">
                <Lock
                  size={19}
                  className="
                    absolute
                    right-4
                    top-1/2
                    -translate-y-1/2
                    text-[var(--gold-premium)]
                  "
                />

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="6 أحرف على الأقل"
                  autoComplete={
                    isLogin
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                  minLength={6}
                  dir="ltr"
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    py-3.5
                    pr-12
                    pl-4
                    text-left
                    text-slate-800
                    placeholder:text-slate-400
                    outline-none
                    transition
                    focus:border-[var(--royal-blue)]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[rgba(2,132,199,0.08)]
                  "
                />
              </div>
            </div>

            {/* ============================================
                زر الإرسال
            ============================================ */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                mt-2
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-2xl
                bg-[var(--royal-blue)]
                py-4
                font-black
                text-white
                shadow-[0_12px_30px_rgba(2,132,199,0.18)]
                transition
                hover:-translate-y-0.5
                hover:bg-[#036fa9]
                active:scale-[0.99]
                disabled:cursor-not-allowed
                disabled:opacity-65
              "
            >
              {isLoading ? (
                <Loader2
                  size={22}
                  className="animate-spin"
                />
              ) : isLogin ? (
                'دخول'
              ) : (
                'إنشاء حساب'
              )}
            </button>
          </form>

          {/* ============================================
              ملاحظة
          ============================================ */}
          <div
            className="
              relative
              z-10
              mt-7
              rounded-2xl
              bg-[var(--mushaf-paper)]
              px-4
              py-3
              text-center
              text-xs
              leading-6
              text-slate-500
            "
          >
            {isLogin
              ? 'تسجيل الدخول يعيد لك حسابك وبياناتك المحفوظة.'
              : 'اسمك سيظهر لك في الصفحة الرئيسية وفي حسابك، وسيظهر للأدمن ضمن بيانات المستخدمين.'}
          </div>

          {/* ============================================
              التبديل بين الدخول والتسجيل
          ============================================ */}
          <div
            className="
              relative
              z-10
              mt-5
              text-center
              text-sm
            "
          >
            <span className="text-slate-500">
              {isLogin
                ? 'ليس لديك حساب؟ '
                : 'لديك حساب بالفعل؟ '}
            </span>

            <button
              type="button"
              onClick={toggleMode}
              className="
                font-black
                text-[var(--royal-blue)]
                hover:underline
              "
            >
              {isLogin
                ? 'سجل الآن'
                : 'تسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
