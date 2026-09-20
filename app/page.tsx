'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, List, Heart, Book, Compass, ChevronLeft, Bell, Headphones, LibraryBig, GraduationCap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function HomePage() {
  const { user, loading } = useAuth()
  const [lastPage, setLastPage] = useState(1)

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
          console.error('Progress load error:', error)
        }
      }
      fetchProgress()
    }
  }, [user])

  const displayName = user?.email ? user.email.split('@')[0] : 'يا باغي الخير'

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28">
      
      <header className="flex justify-between items-center mb-8 pt-2">
        <div>
          <p className="text-gray-500 text-sm mb-1">السلام عليكم،</p>
          <h1 className="text-2xl font-bold font-cairo text-mushaf-dark truncate max-w-[200px]">
            {loading ? 'جاري التحميل...' : displayName}
          </h1>
        </div>
        <Link href="/profile" className="w-12 h-12 bg-white border border-mushaf-gold/30 rounded-full flex items-center justify-center shadow-sm hover:border-mushaf-teal transition">
          <Bell className="text-mushaf-teal" size={24} />
        </Link>
      </header>

      <section className="mb-8 relative group">
        <div className="bg-gradient-to-br from-mushaf-teal to-[#11464D] rounded-3xl p-6 shadow-xl text-white relative overflow-hidden border border-mushaf-gold/20">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2 text-mushaf-gold">
              <BookOpen size={20} />
              <span className="font-bold text-sm">متابعة القراءة</span>
            </div>
          </div>

          <div className="mb-6 relative z-10">
            <h2 className="font-uthmani text-3xl mb-2">استكمال الورد</h2>
            <p className="text-sm opacity-90 font-bold bg-white/20 inline-block px-3 py-1 rounded-full">
              توقفت عند صفحة: {lastPage}
            </p>
          </div>

          <Link href={`/mushaf?page=${lastPage}`} className="w-full bg-white text-mushaf-teal font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-mushaf-paper transition relative z-10 shadow-md">
            أكمل التلاوة
            <ChevronLeft size={20} />
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-bold text-mushaf-dark mb-4">الخدمات السريعة</h3>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/surahs" className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition"><List size={28} className="text-mushaf-gold" /></div>
            <span className="font-bold text-mushaf-dark text-sm">فهرس السور</span>
          </Link>
          <Link href="/audio" className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition"><Headphones size={28} className="text-mushaf-gold" /></div>
            <span className="font-bold text-mushaf-dark text-sm">المكتبة الصوتية</span>
          </Link>
          <Link href="/prayer" className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition"><Compass size={28} className="text-mushaf-gold" /></div>
            <span className="font-bold text-mushaf-dark text-sm">مواقيت الصلاة</span>
          </Link>
          <Link href="/hadith" className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition"><Book size={28} className="text-mushaf-gold" /></div>
            <span className="font-bold text-mushaf-dark text-sm">الأحاديث النبوية</span>
          </Link>
          <Link href="/adhkar" className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition"><Heart size={28} className="text-mushaf-gold" /></div>
            <span className="font-bold text-mushaf-dark text-sm">الأذكار والتسبيح</span>
          </Link>
          <Link href="/islamic-library" className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition"><LibraryBig size={28} className="text-mushaf-gold" /></div>
            <span className="font-bold text-mushaf-dark text-sm">المكتبة الشرعية</span>
          </Link>
        </div>
      </section>

    </div>
  )
}
