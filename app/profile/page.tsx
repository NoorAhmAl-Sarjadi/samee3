'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { LogOut, User, Bookmark, Trash2, ChevronRight, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [bookmarks, setBookmarks] = useState<any[]>([])

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('samee3_bookmarks') || '[]')
    setBookmarks(saved)
  }, [])

  const removeBookmark = (number: number) => {
    const filtered = bookmarks.filter(b => b.number !== number)
    setBookmarks(filtered)
    localStorage.setItem('samee3_bookmarks', JSON.stringify(filtered))
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/login')
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8">
      
      <div className="flex justify-between items-center p-4 bg-mushaf-paper shadow-sm z-10 sticky top-0">
        <Link href="/" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg flex items-center gap-2">
          <User size={20} className="text-mushaf-teal"/>
          حسابي والمفضلة
        </h1>
        <button onClick={handleLogout} className="text-red-500 bg-white p-2 rounded-full shadow-sm hover:bg-red-50 transition">
          <LogOut size={20} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-6">
        
        <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-3xl p-6 shadow-lg text-white flex items-center gap-4 relative overflow-hidden border border-mushaf-gold/20">
          <div className="w-16 h-16 bg-white/10 rounded-full border-2 border-mushaf-gold flex items-center justify-center">
            <User size={32} className="text-mushaf-gold" />
          </div>
          <div>
            <p className="text-sm text-mushaf-gold font-bold mb-1">مرحباً بك،</p>
            <h2 className="font-bold font-cairo text-xl truncate max-w-[200px]">
              {user?.email ? user.email.split('@')[0] : 'ضيف سميع'}
            </h2>
          </div>
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bookmark size={24} className="text-mushaf-teal" />
            <h3 className="text-lg font-bold text-mushaf-dark">الآيات المحفوظة ({bookmarks.length})</h3>
          </div>

          {bookmarks.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-300 text-center text-gray-400">
              <Bookmark size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-bold">لا توجد آيات محفوظة بعد</p>
              <p className="text-sm mt-1">اضغط على أي آية في المصحف لحفظها هنا</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookmarks.map((ayah, index) => (
                <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 hover:border-mushaf-teal transition group relative">
                  
                  <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                    <span className="text-mushaf-gold font-bold text-sm bg-mushaf-paper px-3 py-1 rounded-full">
                      سُورَةُ {ayah.surahName}
                    </span>
                    <button 
                      onClick={() => removeBookmark(ayah.number)}
                      className="text-gray-300 hover:text-red-500 transition p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <p className="font-uthmani text-xl leading-loose text-mushaf-dark text-justify" dir="rtl">
                    {ayah.text} <span className="text-mushaf-gold mx-1">﴿{ayah.numberInSurah}﴾</span>
                  </p>

                  <div className="mt-4 flex justify-end">
                    <Link 
                      href={`/mushaf?page=${ayah.page}`}
                      className="flex items-center gap-1 text-sm font-bold text-mushaf-teal bg-mushaf-teal/10 px-4 py-2 rounded-xl hover:bg-mushaf-teal hover:text-white transition"
                    >
                      <BookOpen size={16} />
                      الذهاب للصفحة
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
