'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Play,
  Pause,
  Copy,
  ImageIcon,
  FileText,
  Repeat,
  X,
  CheckCheck,
  Bookmark,
  Download,
  Volume2,
  Info,
} from 'lucide-react'
import { toPng } from 'html-to-image'

import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

interface Ayah {
  number: number
  text: string
  numberInSurah: number
  juz: number
  page: number
  surah?: {
    number: number
    name: string
    englishName: string
  }
}

interface PageData {
  number: number
  ayahs: Ayah[]
}

type DesignMode = 'ayah' | 'tafsir' | null

function MushafContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const initialPage = Number(searchParams.get('page')) || 1

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageData, setPageData] = useState<PageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null)

  const [selectedReciter] = useState('ar.alafasy')

  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)

  // التشغيل المتتابع
  const [continuousPlay, setContinuousPlay] = useState(false)

  const [playingAyahNumber, setPlayingAyahNumber] = useState<number | null>(null)

  const [copied, setCopied] = useState(false)

  const [designMode, setDesignMode] = useState<DesignMode>(null)

  const [tafsirText, setTafsirText] = useState('')
  const [isFetchingTafsir, setIsFetchingTafsir] = useState(false)

  const [isSaved, setIsSaved] = useState(false)

  // المرجع الخاص بتصميم الصورة
  const designCardRef = useRef<HTMLDivElement | null>(null)

  const currentSurah =
    pageData?.ayahs?.[0]?.surah?.name ||
    pageData?.ayahs?.[0]?.surah?.englishName ||
    'المصحف الشريف'

  const currentJuz = pageData?.ayahs?.[0]?.juz || ''

  // =========================================================
  // تحميل صفحة المصحف
  // =========================================================

  const fetchPage = useCallback(async (page: number) => {
    try {
      setIsLoading(true)

      const res = await fetch(
        `https://api.alquran.cloud/v1/page/${page}/quran-uthmani`,
        {
          cache: 'no-store',
        }
      )

      if (!res.ok) {
        throw new Error('تعذر تحميل الصفحة')
      }

      const data = await res.json()

      setPageData(data.data)
    } catch (error) {
      console.error(error)
      setPageData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(currentPage)

    // عند تغيير الصفحة فقط نغلق اختيار الآية،
    // لكن لا نوقف الصوت إذا كان التشغيل المتتابع فعالًا.
    setSelectedAyah(null)
  }, [currentPage, fetchPage])

  // =========================================================
  // حفظ آخر صفحة
  // =========================================================

  useEffect(() => {
    if (!user) return

    const saveProgress = async () => {
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            lastReadPage: currentPage,
          },
          {
            merge: true,
          }
        )
      } catch (error) {
        console.error('خطأ حفظ التقدم:', error)
      }
    }

    saveProgress()
  }, [currentPage, user])

  // =========================================================
  // تنظيف الصوت عند مغادرة الصفحة بالكامل
  // =========================================================

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  // =========================================================
  // المفضلة
  // =========================================================

  useEffect(() => {
    if (!selectedAyah) {
      setIsSaved(false)
      return
    }

    try {
      const saved = JSON.parse(
        localStorage.getItem('samee3_bookmarks') || '[]'
      )

      setIsSaved(
        saved.some((item: Ayah) => item.number === selectedAyah.number)
      )
    } catch {
      setIsSaved(false)
    }
  }, [selectedAyah])

  const toggleBookmark = () => {
    if (!selectedAyah) return

    try {
      const saved = JSON.parse(
        localStorage.getItem('samee3_bookmarks') || '[]'
      )

      if (isSaved) {
        const filtered = saved.filter(
          (item: Ayah) => item.number !== selectedAyah.number
        )

        localStorage.setItem(
          'samee3_bookmarks',
          JSON.stringify(filtered)
        )

        setIsSaved(false)
        return
      }

      saved.push({
        number: selectedAyah.number,
        text: selectedAyah.text,
        numberInSurah: selectedAyah.numberInSurah,
        surahName: currentSurah,
        page: currentPage,
      })

      localStorage.setItem(
        'samee3_bookmarks',
        JSON.stringify(saved)
      )

      setIsSaved(true)
    } catch (error) {
      console.error('خطأ حفظ الآية:', error)
    }
  }

  // =========================================================
  // الحصول على رابط صوت الآية
  // =========================================================

  const getAudioUrl = (ayahNumber: number) => {
    return `https://cdn.islamic.network/quran/audio/128/${selectedReciter}/${ayahNumber}.mp3`
  }

  // =========================================================
  // إيقاف الصوت
  // =========================================================

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.src = ''
    }

    audioRef.current = null
    setAudio(null)
    setIsPlaying(false)
    setIsLooping(false)
    setContinuousPlay(false)
    setPlayingAyahNumber(null)
  }

  // =========================================================
  // تشغيل الآية
  // =========================================================

  const playAyah = useCallback(
    async (
      ayah: Ayah,
      options?: {
        loop?: boolean
        continuous?: boolean
      }
    ) => {
      const loop = options?.loop ?? false
      const continuous = options?.continuous ?? true

      try {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.src = ''
        }

        const newAudio = new Audio(getAudioUrl(ayah.number))

        audioRef.current = newAudio
        setAudio(newAudio)

        setIsPlaying(true)
        setIsLooping(loop)
        setContinuousPlay(continuous)
        setPlayingAyahNumber(ayah.number)

        newAudio.onended = async () => {
          // التكرار = نفس الآية فقط
          if (loop) {
            try {
              newAudio.currentTime = 0
              await newAudio.play()
              return
            } catch (error) {
              console.error(error)
            }
          }

          // التشغيل العادي = الآية التالية
          if (continuous) {
            const currentIndex =
              pageData?.ayahs.findIndex(
                (item) => item.number === ayah.number
              ) ?? -1

            const nextAyah =
              currentIndex >= 0
                ? pageData?.ayahs[currentIndex + 1]
                : undefined

            if (nextAyah) {
              setSelectedAyah(nextAyah)

              // إعادة تشغيل الآية التالية
              await playAyah(nextAyah, {
                loop: false,
                continuous: true,
              })

              return
            }

            // لو انتهت آيات الصفحة:
            // ننتقل للصفحة التالية ونكمل.
            if (currentPage < 604) {
              setCurrentPage((prev) => prev + 1)
              return
            }
          }

          setIsPlaying(false)
          setIsLooping(false)
          setContinuousPlay(false)
          setPlayingAyahNumber(null)
        }

        newAudio.onerror = () => {
          console.error('حدث خطأ أثناء تشغيل الصوت')
          setIsPlaying(false)
          setPlayingAyahNumber(null)
        }

        await newAudio.play()
      } catch (error) {
        console.error('خطأ تشغيل الآية:', error)
        setIsPlaying(false)
        setPlayingAyahNumber(null)
      }
    },
    [currentPage, pageData, selectedReciter]
  )

  // =========================================================
  // تشغيل / إيقاف المشغل العائم
  // =========================================================

  const toggleFloatingPlayer = async () => {
    if (!audioRef.current || playingAyahNumber === null) return

    if (audioRef.current.paused) {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (error) {
        console.error(error)
      }
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  // =========================================================
  // استماع
  // يبدأ من الآية المحددة ويكمل إلى الآيات التالية
  // =========================================================

  const handleListen = async () => {
    if (!selectedAyah) return

    await playAyah(selectedAyah, {
      loop: false,
      continuous: true,
    })

    setSelectedAyah(null)
  }

  // =========================================================
  // تكرار الآية فقط
  // =========================================================

  const handleRepeat = async () => {
    if (!selectedAyah) return

    await playAyah(selectedAyah, {
      loop: true,
      continuous: false,
    })

    setSelectedAyah(null)
  }

  // =========================================================
  // نسخ الآية
  // =========================================================

  const handleCopy = async () => {
    if (!selectedAyah) return

    try {
      await navigator.clipboard.writeText(
        `${selectedAyah.text} ﴿${selectedAyah.numberInSurah}﴾\n` +
          `[سورة ${currentSurah} - الآية ${selectedAyah.numberInSurah}]\n` +
          `مصحف سَميع`
      )

      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('خطأ النسخ:', error)
    }
  }

  // =========================================================
  // جلب التفسير
  // =========================================================

  const fetchTafsir = async () => {
    if (!selectedAyah) return

    setDesignMode('tafsir')
    setIsFetchingTafsir(true)
    setTafsirText('')

    try {
      const res = await fetch(
        `https://api.alquran.cloud/v1/ayah/${selectedAyah.number}/ar.muyassar`,
        {
          cache: 'no-store',
        }
      )

      if (!res.ok) {
        throw new Error('فشل جلب التفسير')
      }

      const data = await res.json()

      setTafsirText(
        data?.data?.text ||
          'عذرًا، لم يتوفر التفسير لهذه الآية حاليًا.'
      )
    } catch (error) {
      console.error(error)

      setTafsirText(
        'عذرًا، لم نتمكن من جلب التفسير لهذه الآية حاليًا.'
      )
    } finally {
      setIsFetchingTafsir(false)
    }
  }

  // =========================================================
  // فتح تصميم الآية
  // =========================================================

  const openAyahDesign = () => {
    setDesignMode('ayah')
  }

  // =========================================================
  // فتح تصميم الآية + التفسير
  // =========================================================

  const openTafsirDesign = () => {
    fetchTafsir()
  }

  // =========================================================
  // حساب حجم خط الآية داخل التصميم
  // لا نقص النص مهما كان طوله
  // =========================================================

  const getAyahFontSize = (text: string) => {
    const length = text.length

    if (length <= 45) return 'clamp(30px, 7vw, 42px)'
    if (length <= 80) return 'clamp(27px, 6.2vw, 38px)'
    if (length <= 120) return 'clamp(24px, 5.6vw, 34px)'
    if (length <= 170) return 'clamp(21px, 5vw, 30px)'
    if (length <= 230) return 'clamp(19px, 4.5vw, 27px)'

    return 'clamp(17px, 4vw, 24px)'
  }

  // =========================================================
  // تحميل التصميم كصورة PNG
  // =========================================================

  const downloadDesign = async () => {
    if (!designCardRef.current || !selectedAyah) return

    try {
      const dataUrl = await toPng(designCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0D383E',
        skipFonts: false,
      })

      const link = document.createElement('a')

      const safeSurah = currentSurah.replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, '')
      const fileName =
        `مصحف-سميع-${safeSurah}-آية-${selectedAyah.numberInSurah}.png`

      link.download = fileName
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('خطأ تحميل التصميم:', error)
      alert('حدث خطأ أثناء إنشاء الصورة. حاول مرة أخرى.')
    }
  }

  // =========================================================
  // الانتقال بين الصفحات
  // =========================================================

  const nextPage = () => {
    if (currentPage < 604) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1)
    }
  }

  // =========================================================
  // الآية الحالية أثناء التشغيل
  // =========================================================

  const playingAyah =
    pageData?.ayahs.find(
      (ayah) => ayah.number === playingAyahNumber
    ) || selectedAyah

  return (
    <div
      className="min-h-screen bg-mushaf-paper flex flex-col pb-36 relative"
      dir="rtl"
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-mushaf-paper/95 backdrop-blur-md border-b border-mushaf-border/30 shadow-sm">
        <Link
          href="/"
          className="text-mushaf-teal bg-white p-2.5 rounded-full shadow-sm hover:bg-mushaf-paper transition"
        >
          <ChevronRight size={24} />
        </Link>

        <div className="text-center">
          <h1 className="font-bold text-mushaf-dark text-lg">
            المصحف الشريف
          </h1>

          <p className="text-[11px] text-mushaf-teal mt-0.5 font-bold">
            مصحف سَميع
          </p>
        </div>

        <button className="text-mushaf-gold bg-white p-2.5 rounded-full shadow-sm">
          <Info size={22} />
        </button>
      </header>

      {/* =====================================================
          MUSHAF
      ====================================================== */}

      <main className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-3xl bg-mushaf-paper border-[6px] border-mushaf-border p-1.5 rounded-sm shadow-2xl">
          <div className="border-[2px] border-mushaf-gold bg-[#FEFCF8] p-4 sm:p-7 min-h-[70vh] flex flex-col">
            {/* رأس الصفحة */}

            <div className="flex justify-between items-center border-b-2 border-mushaf-gold pb-3 mb-7 text-mushaf-gold font-bold text-xs sm:text-sm">
              <span>
                الجزء{' '}
                {currentJuz
                  ? Number(currentJuz).toLocaleString('ar-EG')
                  : '—'}
              </span>

              <span className="font-uthmani text-lg sm:text-2xl text-center px-3">
                {currentSurah}
              </span>

              <span>
                صفحة{' '}
                {currentPage.toLocaleString('ar-EG')}
              </span>
            </div>

            {/* المحتوى */}

            <div className="flex-1 flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center text-mushaf-teal gap-3 py-20">
                  <Loader2
                    className="animate-spin"
                    size={40}
                  />

                  <p className="font-bold">
                    جاري تحميل الصفحة...
                  </p>
                </div>
              ) : pageData?.ayahs?.length ? (
                <p
                  className="font-uthmani text-[24px] sm:text-[29px] leading-[2.5] sm:leading-[2.8] text-mushaf-dark text-justify w-full"
                  style={{
                    textAlignLast: 'center',
                  }}
                >
                  {pageData.ayahs.map((ayah) => (
                    <span
                      key={ayah.number}
                      onClick={() => setSelectedAyah(ayah)}
                      className={`
                        cursor-pointer
                        transition-all
                        duration-300
                        rounded-lg
                        px-1
                        inline
                        ${
                          selectedAyah?.number === ayah.number ||
                          playingAyahNumber === ayah.number
                            ? 'bg-mushaf-gold/20 shadow-sm'
                            : 'hover:bg-mushaf-gold/10'
                        }
                      `}
                    >
                      {ayah.text}

                      <span
                        className={`
                          text-mushaf-gold
                          mx-1
                          sm:mx-2
                          text-xl
                          sm:text-2xl
                          inline-flex
                          items-center
                          justify-center
                          align-middle
                          transition-transform
                          ${
                            playingAyahNumber === ayah.number
                              ? 'scale-125'
                              : ''
                          }
                        `}
                      >
                        ﴿
                        {ayah.numberInSurah.toLocaleString(
                          'ar-EG'
                        )}
                        ﴾
                      </span>
                    </span>
                  ))}
                </p>
              ) : (
                <div className="text-center text-red-500 font-bold">
                  تعذر تحميل الصفحة
                </div>
              )}
            </div>

            {/* رقم الصفحة */}

            <div className="flex justify-center items-center border-t-2 border-mushaf-gold pt-3 mt-7 text-mushaf-gold font-bold text-sm">
              <span className="text-lg">
                {currentPage.toLocaleString('ar-EG')}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* =====================================================
          أزرار التقليب
      ====================================================== */}

      <div
        className="fixed bottom-28 md:bottom-8 left-0 w-full flex justify-center gap-10 sm:gap-16 px-4 z-30"
        dir="ltr"
      >
        <button
          onClick={nextPage}
          disabled={currentPage === 604}
          className="bg-white/95 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20 disabled:opacity-40"
        >
          <ChevronLeft size={28} />
        </button>

        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          className="bg-white/95 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20 disabled:opacity-40"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* =====================================================
          قائمة خيارات الآية
      ====================================================== */}

      {selectedAyah && !designMode && (
        <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.18)] z-50 border-t-4 border-mushaf-teal pb-7">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-[30px]">
            <div>
              <p className="font-bold text-mushaf-teal">
                {currentSurah}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                الآية{' '}
                {selectedAyah.numberInSurah.toLocaleString(
                  'ar-EG'
                )}
              </p>
            </div>

            <button
              onClick={() => setSelectedAyah(null)}
              className="bg-gray-200 p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-500 transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 p-5">
            {/* استماع */}

            <button
              onClick={handleListen}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-mushaf-paper text-mushaf-teal rounded-full flex items-center justify-center group-hover:bg-mushaf-teal group-hover:text-white transition-all">
                <Play
                  size={23}
                  fill="currentColor"
                />
              </div>

              <span className="text-xs font-bold text-gray-600">
                استماع
              </span>
            </button>

            {/* تكرار */}

            <button
              onClick={handleRepeat}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-mushaf-paper text-mushaf-gold rounded-full flex items-center justify-center group-hover:bg-mushaf-gold group-hover:text-white transition-all">
                <Repeat size={23} />
              </div>

              <span className="text-xs font-bold text-gray-600">
                تكرار
              </span>
            </button>

            {/* نسخ */}

            <button
              onClick={handleCopy}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-mushaf-paper text-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-all">
                {copied ? (
                  <CheckCheck size={23} />
                ) : (
                  <Copy size={23} />
                )}
              </div>

              <span className="text-xs font-bold text-gray-600">
                {copied ? 'تم النسخ' : 'نسخ'}
              </span>
            </button>

            {/* تصميم الآية */}

            <button
              onClick={openAyahDesign}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-mushaf-paper text-purple-500 rounded-full flex items-center justify-center group-hover:bg-purple-50 transition-all">
                <ImageIcon size={23} />
              </div>

              <span className="text-xs font-bold text-gray-600">
                كصورة
              </span>
            </button>

            {/* تصميم + تفسير */}

            <button
              onClick={openTafsirDesign}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-mushaf-paper text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-all">
                <FileText size={23} />
              </div>

              <span className="text-xs font-bold text-gray-600 text-center leading-tight">
                تفسير وصورة
              </span>
            </button>

            {/* حفظ */}

            <button
              onClick={toggleBookmark}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className={`
                  w-12 h-12 rounded-full
                  flex items-center justify-center
                  transition-all
                  ${
                    isSaved
                      ? 'bg-mushaf-gold text-white shadow-md scale-105'
                      : 'bg-mushaf-paper text-mushaf-gold group-hover:bg-mushaf-gold/10'
                  }
                `}
              >
                <Bookmark
                  size={23}
                  fill={isSaved ? 'currentColor' : 'none'}
                />
              </div>

              <span className="text-xs font-bold text-gray-600">
                {isSaved ? 'محفوظة' : 'حفظ'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          التصميم كصورة
      ====================================================== */}

      {designMode && selectedAyah && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          {/* العنوان */}

          <div className="w-full max-w-xl flex justify-between items-center mb-4 px-1">
            <div className="text-white">
              <p className="font-bold text-sm">
                تصميم الآية
              </p>

              <p className="text-white/60 text-xs mt-1">
                جاهز للمشاركة والتحميل
              </p>
            </div>

            <button
              onClick={() => setDesignMode(null)}
              className="bg-white/15 p-2.5 rounded-full text-white hover:bg-red-500 transition"
            >
              <X size={22} />
            </button>
          </div>

          {/* =================================================
              البطاقة المراد تحويلها إلى صورة
          ================================================== */}

          <div
            ref={designCardRef}
            className="
              relative
              w-full
              max-w-xl
              rounded-[30px]
              overflow-hidden
              border
              border-mushaf-gold/50
              shadow-2xl
              bg-gradient-to-br
              from-[#175E67]
              to-[#0D383E]
              text-white
            "
            style={{
              minHeight:
                designMode === 'tafsir'
                  ? '520px'
                  : '430px',
            }}
          >
            {/* زخارف */}

            <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/5 rounded-full blur-3xl" />

            <div className="absolute -bottom-28 -left-20 w-72 h-72 bg-mushaf-gold/10 rounded-full blur-3xl" />

            <div className="relative z-10 p-7 sm:p-10 flex flex-col">
              {/* الهوية */}

              <div className="flex justify-between items-center mb-8">
                <div className="text-right">
                  <p className="font-bold text-mushaf-gold text-sm">
                    مصحف سَميع
                  </p>

                  <p className="text-white/55 text-[10px] mt-1">
                    للقرآن الكريم
                  </p>
                </div>

                <div className="w-11 h-11 rounded-full border border-mushaf-gold/70 bg-white/10 flex items-center justify-center">
                  <ImageIcon
                    size={18}
                    className="text-mushaf-gold"
                  />
                </div>
              </div>

              {/* اسم السورة */}

              <div className="text-center mb-7">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-mushaf-gold text-xs font-bold">
                  سورة {currentSurah}
                </span>
              </div>

              {/* الآية */}

              <div
                className="text-center"
                dir="rtl"
              >
                <p
                  className="font-uthmani text-white leading-[2.1] whitespace-normal break-words"
                  style={{
                    fontSize: getAyahFontSize(
                      selectedAyah.text
                    ),
                  }}
                >
                  {selectedAyah.text}

                  <span className="text-mushaf-gold mx-2 inline-flex items-center justify-center align-middle text-[0.75em]">
                    ﴿
                    {selectedAyah.numberInSurah.toLocaleString(
                      'ar-EG'
                    )}
                    ﴾
                  </span>
                </p>
              </div>

              {/* التفسير */}

              {designMode === 'tafsir' && (
                <div className="mt-8 pt-6 border-t border-white/15">
                  {isFetchingTafsir ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <Loader2
                        className="animate-spin text-mushaf-gold"
                        size={28}
                      />

                      <p className="text-white/65 text-xs">
                        جاري تحميل التفسير...
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-white/90 font-cairo text-sm sm:text-[15px] leading-[2] text-right whitespace-normal break-words">
                        {tafsirText}
                      </p>

                      {/* المرجع */}

                      <div className="mt-6 pt-4 border-t border-white/10">
                        <p className="text-mushaf-gold text-xs font-bold text-right">
                          المصدر: التفسير الميسر
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* رقم الآية والسورة */}

              <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between">
                <div className="text-right">
                  <p className="text-white/60 text-[10px]">
                    رقم الآية
                  </p>

                  <p className="text-mushaf-gold font-bold text-sm mt-1">
                    {selectedAyah.numberInSurah.toLocaleString(
                      'ar-EG'
                    )}
                  </p>
                </div>

                <div className="text-center">
                  <p className="font-bold text-white text-sm">
                    مصحف سَميع
                  </p>

                  <p className="text-white/45 text-[10px] mt-1">
                    {currentSurah}
                  </p>
                </div>

                <div className="text-left">
                  <p className="text-white/60 text-[10px]">
                    الصفحة
                  </p>

                  <p className="text-mushaf-gold font-bold text-sm mt-1">
                    {currentPage.toLocaleString('ar-EG')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================
              زر التحميل
          ================================================== */}

          <button
            onClick={downloadDesign}
            disabled={isFetchingTafsir}
            className="mt-5 w-full max-w-xl bg-mushaf-gold text-white rounded-2xl py-4 px-6 font-bold flex items-center justify-center gap-3 shadow-xl hover:scale-[1.01] transition disabled:opacity-50"
          >
            <Download size={21} />
            تحميل التصميم
          </button>

          <button
            onClick={() => setDesignMode(null)}
            className="mt-3 text-white/65 text-sm hover:text-white transition"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* =====================================================
          المشغل العائم
      ====================================================== */}

      {playingAyah && (
        <div className="fixed bottom-[92px] sm:bottom-[96px] left-3 right-3 z-[45]">
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[24px] border border-mushaf-gold/30 shadow-[0_15px_50px_rgba(13,56,62,0.35)] px-4 py-3 text-white backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* أيقونة */}

              <div className="w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                {isPlaying ? (
                  <Volume2
                    size={21}
                    className="text-mushaf-gold"
                  />
                ) : (
                  <Volume2
                    size={21}
                    className="text-white/60"
                  />
                )}
              </div>

              {/* المعلومات */}

              <div className="flex-1 min-w-0">
                <p className="text-mushaf-gold text-xs font-bold truncate">
                  {currentSurah}
                </p>

                <p className="text-white text-sm font-bold truncate mt-0.5">
                  آية{' '}
                  {playingAyah.numberInSurah.toLocaleString(
                    'ar-EG'
                  )}
                  {continuousPlay
                    ? ' • تشغيل متتابع'
                    : ' • تكرار'}
                </p>
              </div>

              {/* تشغيل / إيقاف */}

              <button
                onClick={toggleFloatingPlayer}
                className="w-12 h-12 shrink-0 bg-white text-mushaf-teal rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition"
              >
                {isPlaying ? (
                  <Pause
                    size={23}
                    fill="currentColor"
                  />
                ) : (
                  <Play
                    size={23}
                    fill="currentColor"
                    className="ml-0.5"
                  />
                )}
              </button>

              {/* إغلاق */}

              <button
                onClick={stopAudio}
                className="w-10 h-10 shrink-0 rounded-full bg-white/10 text-white/75 flex items-center justify-center hover:bg-red-500 hover:text-white transition"
                title="إغلاق المشغل"
              >
                <X size={20} />
              </button>
            </div>

            {/* شريط حالة بسيط */}

            <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`
                  h-full rounded-full bg-mushaf-gold transition-all
                  ${isPlaying ? 'w-full animate-pulse' : 'w-1/4'}
                `}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===========================================================
// Suspense
// ===========================================================

export default function MushafPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mushaf-paper flex flex-col justify-center items-center gap-4">
          <Loader2
            className="animate-spin text-mushaf-teal"
            size={40}
          />

          <p className="text-mushaf-teal font-bold">
            جاري فتح المصحف...
          </p>
        </div>
      }
    >
      <MushafContent />
    </Suspense>
  )
}
