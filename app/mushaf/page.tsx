'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, ChevronLeft, Info, Loader2, Play, Pause, Copy, ImageIcon, FileText, Repeat, X, CheckCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

function MushafContent() {
  const searchParams = useSearchParams()
  const initialPage = Number(searchParams.get('page')) || 1 
  
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageData, setPageData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  // حالة تفاعل الآيات
  const [selectedAyah, setSelectedAyah] = useState<any>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [copied, setCopied] = useState(false)
  const [designMode, setDesignMode] = useState<'ayah' | 'tafsir' | null>(null)
  const [tafsirText, setTafsirText] = useState('')
  const [isFetchingTafsir, setIsFetchingTafsir] = useState(false)

  const currentSurah = pageData?.ayahs[0]?.surah?.name || 'سُورَةُ...'
  const currentJuz = pageData?.ayahs[0]?.juz || ''

  // جلب صفحة القرآن
  useEffect(() => {
    setIsLoading(true)
    if(audio) { audio.pause(); setIsPlaying(false); } // إيقاف الصوت لو قلبنا الصفحة
    setSelectedAyah(null) // إلغاء التحديد

    fetch(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`)
      .then(res => res.json())
      .then(data => { setPageData(data.data); setIsLoading(false) })
      .catch(err => { console.error(err); setIsLoading(false) })
  }, [currentPage])

  // حفظ التقدم في فايربيس
  useEffect(() => {
    if (user) {
      const saveProgress = async () => {
        try { await setDoc(doc(db, 'users', user.uid), { lastReadPage: currentPage }, { merge: true }) } 
        catch (error) { console.error(error) }
      }
      saveProgress()
    }
  }, [currentPage, user])

  // تنظيف ملف الصوت لما نخرج من الصفحة
  useEffect(() => {
    return () => { if (audio) { audio.pause(); audio.src = ""; } }
  }, [audio])

  // التقليب
  const nextPage = () => { if (currentPage < 604) setCurrentPage(prev => prev + 1) }
  const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1) }

  // ---------------- وظائف تفاعل الآية ----------------

  const toggleAudio = (loop = false) => {
    if (audio && isPlaying && isLooping === loop) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (audio) audio.pause();
    
    // تشغيل الآية بصوت العفاسي
    const newAudio = new Audio(`https://cdn.islamic.network/quran/audio/128/ar.alafasy/${selectedAyah.number}.mp3`);
    newAudio.loop = loop;
    newAudio.play();
    setAudio(newAudio);
    setIsPlaying(true);
    setIsLooping(loop);
    newAudio.onended = () => { if (!loop) setIsPlaying(false) };
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`${selectedAyah.text} ﴿${selectedAyah.numberInSurah}﴾\n[${currentSurah} - مصحف سميع]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const openDesign = async (type: 'ayah' | 'tafsir') => {
    if (type === 'tafsir') {
      setIsFetchingTafsir(true);
      setDesignMode('tafsir'); // نفتح الشاشة الأول عشان اليوزر يشوف التحميل
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${selectedAyah.number}/ar.muyassar`);
        const data = await res.json();
        setTafsirText(data.data.text);
      } catch (err) {
        setTafsirText('عذراً، لم نتمكن من جلب التفسير.');
      }
      setIsFetchingTafsir(false);
    } else {
      setDesignMode('ayah');
    }
  }

  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8 relative">
      
      {/* الهيدر */}
      <div className="flex justify-between items-center p-4 bg-mushaf-paper shadow-sm z-10 relative">
        <Link href="/" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg">المصحف الشريف</h1>
        <button className="text-mushaf-gold"><Info size={24} /></button>
      </div>

      {/* إطار المصحف */}
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
                    <span 
                      key={ayah.number}
                      onClick={() => setSelectedAyah(ayah)}
                      className={`cursor-pointer transition-all duration-300 rounded-lg px-1 ${selectedAyah?.number === ayah.number ? 'bg-mushaf-gold/20 shadow-sm' : 'hover:bg-gray-100'}`}
                    >
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

      {/* أزرار التقليب */}
      <div className="fixed bottom-24 md:bottom-8 left-0 w-full flex justify-center gap-10 sm:gap-16 px-4 z-30" dir="ltr">
        <button onClick={nextPage} disabled={currentPage === 604} className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20"><ChevronLeft size={28} /></button>
        <button onClick={prevPage} disabled={currentPage === 1} className="bg-white/90 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20"><ChevronRight size={28} /></button>
      </div>

      {/* قائمة خيارات الآية (Bottom Sheet) */}
      {selectedAyah && !designMode && (
        <div className="fixed bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-50 animate-[slideUp_0.3s_ease-out] border-t-4 border-mushaf-teal pb-6">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
            <div>
              <p className="font-bold text-mushaf-teal">{currentSurah} - آية {selectedAyah.numberInSurah}</p>
            </div>
            <button onClick={() => setSelectedAyah(null)} className="bg-gray-200 p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-500 transition">
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-5 gap-2 p-4 pt-6">
            <button onClick={() => toggleAudio(false)} className="flex flex-col items-center gap-2 group">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying && !isLooping ? 'bg-mushaf-teal text-white shadow-lg scale-110' : 'bg-mushaf-paper text-mushaf-teal group-hover:bg-mushaf-teal/10'}`}>
                {isPlaying && !isLooping ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}
              </div>
              <span className="text-xs font-bold text-gray-600">تشغيل</span>
            </button>

            <button onClick={() => toggleAudio(true)} className="flex flex-col items-center gap-2 group">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying && isLooping ? 'bg-mushaf-gold text-white shadow-lg scale-110' : 'bg-mushaf-paper text-mushaf-gold group-hover:bg-mushaf-gold/10'}`}>
                <Repeat size={24} />
              </div>
              <span className="text-xs font-bold text-gray-600">تكرار</span>
            </button>

            <button onClick={handleCopy} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-mushaf-paper text-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-all">
                {copied ? <CheckCheck size={24} /> : <Copy size={24} />}
              </div>
              <span className="text-xs font-bold text-gray-600">{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>

            <button onClick={() => openDesign('ayah')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-mushaf-paper text-purple-500 rounded-full flex items-center justify-center group-hover:bg-purple-50 transition-all">
                <ImageIcon size={24} />
              </div>
              <span className="text-xs font-bold text-gray-600">كصورة</span>
            </button>

            <button onClick={() => openDesign('tafsir')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-mushaf-paper text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-all relative">
                <FileText size={24} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
              </div>
              <span className="text-xs font-bold text-gray-600 text-center leading-tight">تفسير<br/>وصورة</span>
            </button>
          </div>
        </div>
      )}

      {/* شاشة تصميم الصورة (Overlay) */}
      {designMode && selectedAyah && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
          
          <div className="w-full max-w-sm flex justify-between items-center mb-4 px-2">
            <p className="text-white text-sm font-bold bg-white/20 px-4 py-1.5 rounded-full">التقط شاشة لمشاركة التصميم 📸</p>
            <button onClick={() => setDesignMode(null)} className="bg-white/20 p-2 rounded-full text-white hover:bg-red-500 transition">
              <X size={24} />
            </button>
          </div>

          {/* الكارت اللي هيتصور (Post Design) */}
          <div className="w-full max-w-sm bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-mushaf-gold/30 aspect-[4/5] flex flex-col justify-center text-center">
            
            {/* زخرفة الخلفية */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-mushaf-gold opacity-10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10 flex-1 flex flex-col justify-center">
              <p className="font-uthmani text-3xl leading-[2.2] text-white mb-6">
                {selectedAyah.text}
                <span className="text-mushaf-gold mx-2 text-2xl inline-block align-middle">﴿{selectedAyah.numberInSurah}﴾</span>
              </p>

              {designMode === 'tafsir' && (
                <div className="mt-4 pt-4 border-t border-white/20 text-white/90 text-sm leading-relaxed font-cairo">
                  {isFetchingTafsir ? (
                    <Loader2 className="animate-spin mx-auto my-2 text-mushaf-gold" size={24}/>
                  ) : (
                    <p className="text-justify line-clamp-4">{tafsirText}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center relative z-10">
              <div>
                <p className="text-mushaf-gold font-bold">{currentSurah}</p>
                <p className="text-white/50 text-xs mt-1">تطبيق مصحف سميع</p>
              </div>
              <div className="w-10 h-10 border border-mushaf-gold rounded-full flex items-center justify-center bg-white/10">
                <ImageIcon size={18} className="text-mushaf-gold"/>
              </div>
            </div>
          </div>

        </div>
      )}

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
