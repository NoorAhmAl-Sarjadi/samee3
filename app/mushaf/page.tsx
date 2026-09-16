'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronRight, ChevronLeft, Loader2, Play, Pause, 
  Copy, ImageIcon, FileText, Repeat, X, CheckCheck, Bookmark 
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db, auth } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

interface Ayah {
  number: number
  text: string
  numberInSurah: number
  juz: number
  page: number
}

interface Surah {
  number: number
  name: string
  englishName: string
  ayahs: Ayah[]
}

function MushafContent() {
  const searchParams = useSearchParams()
  const initialPage = parseInt(searchParams.get('page') || '1')

  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [pageAyahs, setPageAyahs] = useState<Ayah[]>([])
  const [currentSurah, setCurrentSurah] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isLooping, setIsLooping] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  const [tafsirModal, setTafsirModal] = useState<boolean>(false)
  const [tafsirText, setTafsirText] = useState<string>('')
  const [isFetchingTafsir, setIsFetchingTafsir] = useState<boolean>(false)

  const [isSaved, setIsSaved] = useState<boolean>(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { user } = useAuth()

  // جلب آيات الصفحة الحالية من API القرآن الكريم
  useEffect(() => {
    const fetchPageData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/page/${currentPage}/ar.alafasy`)
        const data = await res.json()
        if (data.code === 200) {
          const ayahs: Ayah[] = data.data.ayahs
          setPageAyahs(ayahs)
          if (ayahs.length > 0) {
            // جلب اسم السورة للآية الأولى في الصفحة
            const surahRes = await fetch(`https://api.alquran.cloud/v1/ayah/${ayahs[0].number}`)
            const surahData = await surahRes.json()
            if (surahData.code === 200) {
              setCurrentSurah(surahData.data.surah.name)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching page:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPageData()
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // حفظ آخر صفحة وصل لها المستخدم في Firebase
    if (user) {
      setDoc(doc(db, 'users', user.uid), { lastReadPage: currentPage }, { merge: true })
        .catch(err => console.log(err))
    }
  }, [currentPage, user])

  // التحقق هل الآية الحالية محفوظة في المفضلة أم لا
  useEffect(() => {
    if (selectedAyah) {
      const saved = JSON.parse(localStorage.getItem('samee3_bookmarks') || '[]')
      setIsSaved(saved.some((b: any) => b.number === selectedAyah.number))
    }
  }, [selectedAyah])

  // تبديل حالة الحفظ في المفضلة
  const toggleBookmark = () => {
    const saved = JSON.parse(localStorage.getItem('samee3_bookmarks') || '[]')
    if (isSaved) {
      const filtered = saved.filter((b: any) => b.number !== selectedAyah?.number)
      localStorage.setItem('samee3_bookmarks', JSON.stringify(filtered))
      setIsSaved(false)
    } else if (selectedAyah) {
      saved.push({
        number: selectedAyah.number,
        text: selectedAyah.text,
        numberInSurah: selectedAyah.numberInSurah,
        surahName: currentSurah,
        page: currentPage
      })
      localStorage.setItem('samee3_bookmarks', JSON.stringify(saved))
      setIsSaved(true)
    }
  }

  // تشغيل الصوت للآية
  const playAyahAudio = (ayahNumber: number) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayahNumber}.mp3`
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    audio.play()
    setIsPlaying(true)

    audio.onended = () => {
      if (isLooping) {
        audio.play()
      } else {
        setIsPlaying(false)
      }
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  // نسخ الآية
  const copyAyah = (text: string, surah: string, num: number) => {
    navigator.clipboard.writeText(`${text} [سُورَةُ ${surah} - آية ${num}]`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // جلب التفسير الميسر
  const fetchTafsir = async (ayahNumberInSurah: number, surahNumber: number) => {
    setIsFetchingTafsir(true)
    setTafsirModal(true)
    try {
      const res = await fetch(`https://api.quran.com/api/v4/verses/by_key/${surahNumber}:${ayahNumberInSurah}/tafsirs/168`)
      const data = await res.json()
      if (data.tafsir) {
        setTafsirText(data.tafsir.text)
      } else {
        setTafsirText('عذراً، لم يتوفر التفسير لهذه الآية حالياً.')
      }
    } catch (e) {
      setTafsirText('حدث خطأ أثناء جلب التفسير.')
    } finally {
      setIsFetchingTafsir(false)
    }
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-32">
      
      {/* الهيدر العلوي */}
      <div className="flex justify-between items-center px-6 py-4 bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-mushaf-border/30">
        <Link href="/" className="text-mushaf-teal bg-mushaf-paper p-2.5 rounded-full shadow-sm hover:bg-mushaf-teal hover:text-white transition">
          <ChevronRight size={22} />
        </Link>
        
        <div className="text-center">
          <h1 className="font-bold font-uthmani text-xl text-mushaf-dark">سُورَةُ {currentSurah}</h1>
          <span className="text-xs text-gray-500 font-mono">صفحة {currentPage}</span>
        </div>

        <Link href="/surahs" className="text-mushaf-teal bg-mushaf-paper p-2.5 rounded-full shadow-sm hover:bg-mushaf-teal hover:text-white transition">
          <ChevronLeft size={22} />
        </Link>
      </div>

      {/* محتوى المصحف */}
      <div className="flex-1 max-w-2xl w-full mx-auto p-6 sm:p-10 my-4 bg-white rounded-3xl shadow-xl border border-mushaf-border/40 relative">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-mushaf-teal" size={48} />
            <p className="text-mushaf-teal font-bold">جاري تحميل الصفحات...</p>
          </div>
        ) : (
          <div className="leading-[2.8] sm:leading-[3.2] text-center" dir="rtl">
            {pageAyahs.map((ayah) => (
              <span 
                key={ayah.number}
                onClick={() => { setSelectedAyah(ayah); stopAudio(); }}
                className="font-uthmani text-2xl sm:text-3xl text-mushaf-dark hover:bg-mushaf-gold/15 rounded px-1.5 py-0.5 cursor-pointer transition-colors duration-200 inline"
              >
                {ayah.text}{' '}
                <span className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 mx-1 text-base sm:text-lg font-bold text-mushaf-teal border-2 border-mushaf-gold/60 rounded-full bg-mushaf-paper shadow-inner select-none">
                  {ayah.numberInSurah}
                </span>{' '}
              </span>
            ))}
          </div>
        )}

      </div>

      {/* تنقل الصفحات السفلي */}
      <div className="fixed bottom-20 left-0 w-full px-6 flex justify-between items-center pointer-events-none z-10">
        <button 
          onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
          disabled={currentPage >= 604}
          className="pointer-events-auto bg-mushaf-teal text-white p-3.5 rounded-full shadow-lg hover:bg-[#11464D] disabled:opacity-30 transition"
        >
          <ChevronRight size={24} />
        </button>
        <span className="bg-white/90 backdrop-blur px-4 py-1.5 rounded-full shadow text-xs font-bold font-mono text-mushaf-dark border border-mushaf-border">
          {currentPage} / 604
        </span>
        <button 
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage <= 1}
          className="pointer-events-auto bg-mushaf-teal text-white p-3.5 rounded-full shadow-lg hover:bg-[#11464D] disabled:opacity-30 transition"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* قائمة خيارات الآية (البوتم شيت) */}
      {selectedAyah && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white w-full max-w-xl rounded-t-3xl p-6 shadow-2xl border-t border-mushaf-gold/30 animate-[slideUp_0.3s_ease-out]">
            
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <span className="text-xs font-bold text-mushaf-gold bg-mushaf-paper px-3 py-1 rounded-full">
                سُورَةُ {currentSurah} - آية {selectedAyah.numberInSurah}
              </span>
              <button onClick={() => { setSelectedAyah(null); stopAudio(); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            <p className="font-uthmani text-xl text-center text-mushaf-dark mb-6 line-clamp-2 px-4" dir="rtl">
              "{selectedAyah.text}"
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-4 gap-x-2 p-2">
              
              {/* تشغيل الصوت */}
              <button onClick={() => playAyahAudio(selectedAyah.number)} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-mushaf-paper text-mushaf-teal rounded-full flex items-center justify-center group-hover:bg-mushaf-teal group-hover:text-white transition shadow-sm">
                  <Play size={22} />
                </div>
                <span className="text-xs font-bold text-gray-600">استماع</span>
              </button>

              {/* التكرار */}
              <button onClick={() => setIsLooping(!isLooping)} className="flex flex-col items-center gap-2 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isLooping ? 'bg-mushaf-teal text-white shadow-md' : 'bg-mushaf-paper text-mushaf-teal group-hover:bg-mushaf-teal/10'}`}>
                  <Repeat size={22} />
                </div>
                <span className="text-xs font-bold text-gray-600">{isLooping ? 'مفعل' : 'تكرار'}</span>
              </button>

              {/* النسخ */}
              <button onClick={() => copyAyah(selectedAyah.text, currentSurah, selectedAyah.numberInSurah)} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-mushaf-paper text-mushaf-teal rounded-full flex items-center justify-center group-hover:bg-mushaf-teal group-hover:text-white transition shadow-sm">
                  {copied ? <CheckCheck size={22} className="text-green-600" /> : <Copy size={22} />}
                </div>
                <span className="text-xs font-bold text-gray-600">{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              {/* التفسير */}
              <button onClick={() => fetchTafsir(selectedAyah.numberInSurah, selectedAyah.juz)} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-mushaf-paper text-mushaf-teal rounded-full flex items-center justify-center group-hover:bg-mushaf-teal group-hover:text-white transition shadow-sm">
                  <FileText size={22} />
                </div>
                <span className="text-xs font-bold text-gray-600">التفسير</span>
              </button>

              {/* المفضلة (حفظ) */}
              <button onClick={toggleBookmark} className="flex flex-col items-center gap-2 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isSaved ? 'bg-mushaf-gold text-white shadow-md scale-105' : 'bg-mushaf-paper text-mushaf-gold group-hover:bg-mushaf-gold/10'}`}>
                  <Bookmark size={24} fill={isSaved ? 'currentColor' : 'none'} />
                </div>
                <span className="text-xs font-bold text-gray-600 text-center leading-tight">
                  {isSaved ? 'محفوظة' : 'حفظ'}
                </span>
              </button>

              {/* إغلاق القائمة */}
              <button onClick={() => setSelectedAyah(null)} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition shadow-sm">
                  <X size={22} />
                </div>
                <span className="text-xs font-bold text-red-500">إغلاق</span>
              </button>

            </div>

          </div>
        </div>
      )}

      {/* مودال التفسير */}
      {tafsirModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-mushaf-border max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-mushaf-teal">التفسير الميسر</h3>
              <button onClick={() => setTafsirModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {isFetchingTafsir ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-mushaf-teal" size={32} />
                </div>
              ) : (
                <p className="text-mushaf-dark leading-relaxed text-justify font-cairo" dir="rtl">
                  {tafsirText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function MushafPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-mushaf-paper">
        <Loader2 className="animate-spin text-mushaf-teal" size={40} />
      </div>
    }>
      <MushafContent />
    </Suspense>
  )
}
