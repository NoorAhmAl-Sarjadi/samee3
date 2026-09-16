'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, ChevronLeft, Info, Loader2 } from 'lucide-react'

function MushafContent() {
  const searchParams = useSearchParams()
  // بياخد رقم الصفحة من الرابط لو موجود، لو مش موجود بيبدأ من صفحة 1 (الفاتحة)
  const initialPage = Number(searchParams.get('page')) || 1 
  
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageData, setPageData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // جلب الآيات من الـ API كل ما رقم الصفحة يتغير
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

  // دالة التقليب للصفحة التالية (الزرار الشمال لأننا بالعربي)
  const nextPage = () => {
    if (currentPage < 604) setCurrentPage(prev => prev + 1)
  }

  // دالة التقليب للصفحة السابقة (الزرار اليمين)
  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1)
  }

  // استخراج البيانات من أول آية في الصفحة
  const currentSurah = pageData?.ayahs[0]?.surah?.name || 'سُورَةُ...'
  const currentJuz = pageData?.ayahs[0]?.juz || ''
  
  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex justify-between items-center p-4 bg-mushaf-paper shadow-sm z-10 relative">
        <Link href="/" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg">المصحف الشريف</h1>
        <button className="text-mushaf-gold">
          <Info size={24} />
        </button>
      </div>

      {/* إطار المصحف */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-2xl bg-mushaf-paper border-[6px] border-mushaf-border p-1.5 rounded-sm shadow-2xl relative min-h-[60vh] flex flex-col">
          <div className="border-[2px] border-mushaf-gold p-4 sm:p-6 flex-1 flex flex-col relative bg-[#FEFCF8]">
            
            {/* الترويسة العلوية (اسم السورة والجزء ورقم الصفحة) */}
            <div className="flex justify-between items-center border-b-2 border-mushaf-gold pb-3 mb-6 text-mushaf-gold font-bold text-xs sm:text-sm">
              <span>الجزء {currentJuz.toLocaleString('ar-EG')}</span>
              <span className="font-uthmani text-lg sm:text-2xl text-center">{currentSurah}</span>
              <span>صفحة {currentPage.toLocaleString('ar-EG')}</span>
            </div>

            {/* النص القرآني */}
            <div className="flex-1 flex flex-col justify-center items-center">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center text-mushaf-teal gap-3 py-20">
                  <Loader2 className="animate-spin" size={40} />
                  <p className="font-bold">جاري تحميل الصفحة...</p>
                </div>
              ) : (
                <p 
                  className="font-uthmani text-[24px] sm:text-[28px] leading-[2.4] sm:leading-[2.8] text-mushaf-dark text-justify w-full" 
                  dir="rtl"
                  style={{ textAlignLast: 'center' }}
                >
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

            {/* التذييل السفلي (رقم الصفحة) */}
            <div className="flex justify-center items-center border-t-2 border-mushaf-gold pt-3 mt-6 text-mushaf-gold font-bold text-sm">
              <span className="text-lg">{currentPage.toLocaleString('ar-EG')}</span>
            </div>

          </div>
        </div>
      </div>

      {/* أزرار التقليب العائمة */}
      <div className="fixed bottom-24 md:bottom-8 left-0 w-full flex justify-center gap-10 sm:gap-16 px-4 z-40" dir="ltr">
        <button 
          onClick={nextPage}
          disabled={currentPage === 604}
          className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition transform hover:scale-105 border border-mushaf-teal/20 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-white disabled:hover:text-mushaf-teal"
        >
          <ChevronLeft size={28} />
        </button>
        <button 
          onClick={prevPage}
          disabled={currentPage === 1}
          className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition transform hover:scale-105 border border-mushaf-teal/20 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-white disabled:hover:text-mushaf-teal"
        >
          <ChevronRight size={28} />
        </button>
      </div>

    </div>
  )
}

// تغليف الصفحة بـ Suspense عشان تتوافق مع نظام Next.js الجديد
export default function MushafPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-mushaf-paper flex flex-col justify-center items-center gap-4">
        <Loader2 className="animate-spin text-mushaf-teal" size={40}/>
        <p className="text-mushaf-teal font-bold">جاري فتح المصحف...</p>
      </div>
    }>
      <MushafContent />
    </Suspense>
  )
}
