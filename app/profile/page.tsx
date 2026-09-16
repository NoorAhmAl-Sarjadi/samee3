'use client'

import { useEffect, useState } from 'react'
import { Target, Bookmark, Heart, Award, BookOpen, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [lastPage, setLastPage] = useState(1)

  // جلب آخر صفحة قرأها المستخدم لحساب الإنجاز
  useEffect(() => {
    if (user) {
      const fetchProgress = async () => {
        try {
          const docRef = doc(db, 'users', user.uid)
          const docSnap = await getDoc(docRef)
          
          if (docSnap.exists() && docSnap.data().lastReadPage) {
            setLastPage(docSnap.data().lastReadPage)
          }
        } catch (error) {
          console.error("خطأ في جلب البيانات:", error)
        }
      }
      fetchProgress()
    }
  }, [user])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth')
    } catch (error) {
      console.error('خطأ في تسجيل الخروج:', error)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-mushaf-paper flex items-center justify-center text-mushaf-teal font-bold font-cairo">جاري التحميل...</div>
  }

  if (!user) {
    router.push('/auth')
    return null
  }

  // السحر هنا: حساب النسبة المئوية للختمة بناءً على 604 صفحة
  const percentage = Math.round((lastPage / 604) * 100)

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
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
              <p className="text-mushaf-gold text-sm font-bold mb-1">توقفت عند</p>
              <p className="text-2xl font-bold">صفحة {lastPage}</p>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold mb-1">الإنجاز</p>
              <p className="text-3xl font-mono text-mushaf-gold">{percentage}%</p>
            </div>
          </div>

          {/* شريط التقدم الديناميكي */}
          <div className="w-full h-2 bg-white/20 rounded-full mb-4 relative z-10 overflow-hidden">
            <div 
              className="h-full bg-mushaf-gold rounded-full shadow-[0_0_10px_rgba(197,154,83,0.8)] transition-all duration-1000 ease-out"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>

          <Link href={`/mushaf?page=${lastPage}`} className="w-full bg-white text-mushaf-teal font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-mushaf-paper transition relative z-10 shadow-md">
            <BookOpen size={20} />
            متابعة الورد
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-bold text-mushaf-dark mb-4 flex items-center gap-2">
          <Bookmark className="text-mushaf-teal" size={24} />
          المحفوظات والعلامات
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition">
              <Bookmark size={28} className="text-mushaf-gold" />
            </div>
            <div className="text-center">
              <span className="font-bold text-mushaf-dark block">الفواصل</span>
              <span className="text-xs text-gray-500">يتم الحفظ تلقائياً</span>
            </div>
          </button>

          <button className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition">
              <Heart size={28} className="text-mushaf-gold" />
            </div>
            <div className="text-center">
              <span className="font-bold text-mushaf-dark block">المفضلة</span>
              <span className="text-xs text-gray-500">قريباً</span>
            </div>
          </button>
        </div>
      </section>

    </div>
  )
}
