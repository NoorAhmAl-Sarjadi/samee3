import Link from 'next/link'
import { ChevronRight, ChevronLeft, Info } from 'lucide-react'

// دالة لجلب النص القرآني من مصدر موثوق (API مجمع الملك فهد عبر alquran.cloud)
async function getQuranPage(pageNumber: number) {
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`, {
      next: { revalidate: 86400 } // تخزين مؤقت لتسريع الأداء
    })
    if (!res.ok) return null
    return res.json()
  } catch (error) {
    return null
  }
}

export default async function MushafPage() {
  const pageNumber = 42 // نفس الصفحة في صورتك المرجعية
  const pageData = await getQuranPage(pageNumber)

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8">
      
      {/* الشريط العلوي للتنقل */}
      <div className="flex justify-between items-center p-4 bg-mushaf-paper shadow-sm z-10 relative">
        <Link href="/" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg">المصحف الشريف</h1>
        <button className="text-mushaf-gold">
          <Info size={24} />
        </button>
      </div>

      {/* حاوية المصحف الورقي */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-2xl bg-mushaf-paper border-[6px] border-mushaf-border p-1.5 rounded-sm shadow-2xl relative">
          <div className="border-[2px] border-mushaf-gold p-4 sm:p-6 h-full flex flex-col relative bg-[#FEFCF8]">
            
            {/* رأس الصفحة (الهيدر الورقي) */}
            <div className="flex justify-between items-center border-b-2 border-mushaf-gold pb-3 mb-6 text-mushaf-gold font-bold text-sm sm:text-base">
              <span>البقرة</span>
              <span className="font-uthmani text-2xl">سُورَةُ البَقَرَةِ</span>
              <span>الجزء ٣</span>
            </div>

            {/* النص القرآني */}
            <div className="flex-1 flex flex-col justify-center">
              {pageData ? (
                <p 
                  className="font-uthmani text-[26px] sm:text-[32px] leading-[2.6] sm:leading-[2.8] text-mushaf-dark text-justify" 
                  dir="rtl"
                  style={{ textAlignLast: 'center' }}
                >
                  {pageData.data.ayahs.map((ayah: any) => (
                    <span key={ayah.number}>
                      {ayah.text}
                      <span className="text-mushaf-gold mx-2 text-2xl inline-block align-middle">
                        ﴿{ayah.numberInSurah.toLocaleString('ar-EG')}﴾
                      </span>
                    </span>
                  ))}
                </p>
              ) : (
                <div className="text-center text-mushaf-teal">جاري تحميل الآيات...</div>
              )}
            </div>

            {/* تذييل الصفحة (الفوتر الورقي) */}
            <div className="flex justify-between items-center border-t-2 border-mushaf-gold pt-3 mt-6 text-mushaf-gold font-bold text-sm">
              <span>الحزب ٥</span>
              <span className="text-lg">{pageNumber.toLocaleString('ar-EG')}</span>
              <span>الجزء ٤٢</span>
            </div>

          </div>
        </div>
      </div>

      {/* أزرار تقليب الصفحات */}
      <div className="fixed bottom-24 md:bottom-8 left-0 w-full flex justify-center gap-16 px-4 z-40">
        <button className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition transform hover:scale-105 border border-mushaf-teal/20">
          <ChevronLeft size={28} />
        </button>
        <button className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition transform hover:scale-105 border border-mushaf-teal/20">
          <ChevronRight size={28} />
        </button>
      </div>

    </div>
  )
}