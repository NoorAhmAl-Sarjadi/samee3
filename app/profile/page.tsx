'use client'

import { Target, Bookmark, Heart, Award, ChevronLeft, BookOpen, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // دالة تسجيل الخروج
  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth')
    } catch (error) {
      console.error('خطأ في تسجيل الخروج:', error)
    }
  }

  // شاشة تحميل بسيطة لحد ما فايربيس يتأكد من حالة المستخدم
  if (loading) {
    return <div className="min-h-screen bg-mushaf-paper flex items-center justify-center text-mushaf-teal font-bold font-cairo">جاري التحميل...</div>
  }

  // لو المستخدم مش مسجل دخول، هنرجعه لصفحة التسجيل
  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">حسابي وإنجازي</h1>
        <div className="flex gap-4">
          <button className="text-mushaf-gold hover:text-mushaf-teal transition" title="الإعدادات">
            <Settings size={24} />
          </button>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-600 transition" title="تسجيل الخروج">
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {/* بطاقة المستخدم (ببيانات فايربيس الحقيقية) */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-mushaf-border/40 flex items-center gap-5 mb-8">
        <div className="w-16 h-16 bg-mushaf-teal text-white rounded-full flex items-center justify-center text-2xl font-bold border-2 border-mushaf-gold shadow-md">
          {user.email ? user.email.charAt(0).toUpperCase() : 'م'}
        </div>
        <div className="overflow-hidden">
          <h2 className="text-lg font-bold text-mushaf-dark mb-1 truncate" dir="ltr">{user.email}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Award size={16} className="text-mushaf-gold" />
            عضو في مصحف سميع
          </p>
        </div>
      </section>

      {/* خطة ختم القرآن */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark flex items-center gap-2">
            <Target className="text-mushaf-teal" size={24} />
            خطة الختمة الحالية
          </h3>
          <span className="text-xs font-bold bg-mushaf-gold/20 text-mushaf-gold px-3 py-1 rounded-full">
            مستمر
          </span>
        </div>

        <div className="bg-gradient-to-br from-mushaf-teal to-[#11464D] rounded-3xl p-6 shadow-lg text-white relative overflow-hidden border border-mushaf-gold/20">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
          
          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <p className="text-mushaf-gold text-sm font-bold mb-1">الورد اليومي</p>
              <p className="text-2xl font-bold">صفحة 42</p>
              <p className="text-xs opacity-80 mt-1">سورة البقرة</p>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold mb-1">الإنجاز</p>
              <p className="text-3xl font-mono text-mushaf-gold">7%</p>
            </div>
          </div>

          <div className="w-full h-2 bg-white/20 rounded-full mb-4 relative z-10">
            <div className="h-full bg-mushaf-gold rounded-full w-[7%] shadow-[0_0_10px_rgba(197,154,83,0.8)]"></div>
          </div>

          <Link href="/mushaf" className="w-full bg-white text-mushaf-teal font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-mushaf-paper transition relative z-10 shadow-md">
            <BookOpen size={20} />
            متابعة الورد اليومي
          </Link>
        </div>
      </section>
    </div>
  )
}
