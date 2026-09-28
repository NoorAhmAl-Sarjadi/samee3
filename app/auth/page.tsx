'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { User, Lock, Mail, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isLogin) {
        // تسجيل دخول
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        // إنشاء حساب جديد
        await createUserWithEmailAndPassword(auth, email, password)
      }
      // بعد النجاح، التوجيه للصفحة الشخصية
      router.push('/profile')
    } catch (err: any) {
      console.error(err)
      // ترجمة رسائل الخطأ للعربية
      if (err.code === 'auth/invalid-credential') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      } else if (err.code === 'auth/email-already-in-use') {
        setError('البريد الإلكتروني مستخدم بالفعل')
      } else if (err.code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل')
      } else {
        setError('حدث خطأ، يرجى المحاولة مرة أخرى')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col items-center justify-center p-5 pb-28 md:pb-8">
      
      <div className="w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl border-2 border-mushaf-gold/20 relative overflow-hidden">
        {/* خلفية زخرفية */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-mushaf-teal opacity-5 rounded-full blur-3xl"></div>
        
        {/* زر العودة */}
        <Link href="/" className="absolute top-6 left-6 text-gray-400 hover:text-mushaf-teal transition">
          <ArrowRight size={24} />
        </Link>

        {/* الأيقونة والعنوان */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-mushaf-paper border border-mushaf-gold rounded-full flex items-center justify-center mb-4 shadow-sm">
            <User className="text-mushaf-teal" size={32} />
          </div>
          <h1 className="text-2xl font-bold font-cairo text-mushaf-dark">
            {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {isLogin ? 'مرحباً بعودتك لمصحف سميع' : 'انضم إلينا وابدأ رحلتك مع القرآن'}
          </p>
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div className="bg-red-50 text-red-500 text-sm p-3 rounded-xl mb-6 text-center border border-red-100 relative z-10">
            {error}
          </div>
        )}

        {/* نموذج التسجيل */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
          
          <div className="relative">
            <Mail className="absolute right-4 top-3.5 text-mushaf-gold/70" size={20} />
            <input 
              type="email" 
              placeholder="البريد الإلكتروني" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-mushaf-teal focus:bg-white transition text-left"
              dir="ltr"
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-4 top-3.5 text-mushaf-gold/70" size={20} />
            <input 
              type="password" 
              placeholder="كلمة المرور" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-mushaf-teal focus:bg-white transition text-left"
              dir="ltr"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-mushaf-teal text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-mushaf-teal/90 transition shadow-lg flex items-center justify-center disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : (isLogin ? 'دخول' : 'إنشاء حساب')}
          </button>

        </form>

        {/* زر التبديل بين الدخول والإنشاء */}
        <div className="mt-8 text-center text-sm relative z-10">
          <span className="text-gray-500">
            {isLogin ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
          </span>
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-mushaf-teal font-bold hover:underline"
          >
            {isLogin ? 'سجل الآن' : 'تسجيل الدخول'}
          </button>
        </div>

      </div>
    </div>
  )
}
