'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, ChevronLeft, Info, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

function MushafContent() {
  const searchParams = useSearchParams()
  const initialPage = Number(searchParams.get('page')) || 1 
  
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageData, setPageData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth() // استدعاء بيانات المستخدم

  // جلب الآيات من API
  useEffect(() => {
    setIsLoading(true)
    fetch(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        setPageData(data.data)
        setIsLoading(false)
      })
      .catch(err => {
        console.error(err)
        setIsLoading(false)
      })
  }, [currentPage])

  // السحر هنا: حفظ رقم الصفحة تلقائياً في قاعدة البيانات كلما تغيرت
  useEffect(() => {
    if (user) {
      const saveProgress = async () => {
        try {
          // دمج (merge: true) عشان لو فيه بيانات تانية للمستخدم متمسحش
          await setDoc(doc(db, 'users', user.uid), {
            lastReadPage: currentPage
          }, { merge: true })
        } catch (error) {
          console.error("خطأ في حفظ الصفحة:", error)
        }
      }
      saveProgress()
    }
  }, [currentPage, user])

  const nextPage = () => { if (currentPage < 604) setCurrentPage(prev => prev + 1) }
  const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1) }

  const currentSurah = pageData?.ayahs[0]?.surah?.name || 'سُورَةُ...'
  const currentJuz = pageData?.ayahs[0]?.juz || ''
  
  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8">
      <div className="flex justify-between items-center p-4 bg-mushaf-paper shadow-sm z-10 relative">
        <Link href="/" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg">المصحف الشريف</h1>
        <button className="text-mushaf-gold"><Info size={24} /></button>
      </div>

      <div className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-2xl bg-mushaf-paper border-[6px] border-mushaf-border p-1.5 rounded-sm shadow-2xl relative min-h-[60vh] flex flex-col">
          <div className="border-[2px] border-mushaf-gold p-4 sm:p-6 flex-1 flex flex-col relative bg-[#FEFCF8]">
            <div className="flex justify-between items-center border-b-2 border-mushaf-gold pb-3 mb-6 text-mushaf-gold font-bold text-xs sm:text-sm">
              <span>الجزء {currentJuz.toLocaleString('ar-EG')}</span>
              <span className="font-uthmani text-lg sm:text-2xl text-center">{currentSurah}</span>
              <span>صفحة {currentPage.toLocaleString('ar-EG')}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center text-mushaf-teal gap-3 py-20">
                  <Loader2 className="animate-spin" size={40} />
                  <p className="font-bold">جاري تحميل الصفحة...</p>
                </div>
              ) : (
                <p className="font-uthmani text-[24px] sm:text-[28px] leading-[2.4] sm:leading-[2.8] text-mushaf-dark text-justify w-full" dir="rtl" style={{ textAlignLast: 'center' }}>
                  {pageData?.ayahs.map((ayah: any) => (
                    <span key={ayah.number}>
                      {ayah.text}
                      <span className="text-mushaf-gold mx-1 sm:mx-2 text-xl sm:text-2xl inline-block align-middle">
                        ﴿{ayah.numberInSurah.toLocaleString('ar-EG')}﴾
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div className="flex justify-center items-center border-t-2 border-mushaf-gold pt-3 mt-6 text-mushaf-gold font-bold text-sm">
              <span className="text-lg">{currentPage.toLocaleString('ar-EG')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-24 md:bottom-8 left-0 w-full flex justify-center gap-10 sm:gap-16 px-4 z-40" dir="ltr">
        <button onClick={nextPage} disabled={currentPage === 604} className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20"><ChevronLeft size={28} /></button>
        <button onClick={prevPage} disabled={currentPage === 1} className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20"><ChevronRight size={28} /></button>
      </div>
    </div>
  )
}

export default function MushafPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-mushaf-teal" size={40}/></div>}>
      <MushafContent />
    </Suspense>
  )
}
