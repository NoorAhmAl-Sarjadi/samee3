'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Info, Play, Pause } from 'lucide-react'

const MIN_PAGE = 1
const MAX_PAGE = 604

interface Ayah {
  number: number
  key: string
  text: string
  numberInSurah: number
  juz: number
  page: number
  audioNumber?: number
  surah: {
    number: number
    name: string
    englishName: string
  }
}

interface QuranResponse {
  success?: boolean
  page?: number
  ayahs?: Ayah[]
  error?: string
}

export default function MushafPage() {
  const [pageNumber, setPageNumber] = useState(42)
  const [ayahs, setAyahs] = useState<Ayah[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAyah, setSelectedAyah] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const touchStartX = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/quran?riwaya=hafs&page=${pageNumber}`, {
          cache: 'no-store',
        })

        const data = (await response.json()) as QuranResponse

        if (!response.ok || !Array.isArray(data.ayahs)) {
          throw new Error(data.error || 'تعذر تحميل صفحة المصحف')
        }

        if (!cancelled) {
          setAyahs(data.ayahs)
          setSelectedAyah(null)
        }
      } catch (err) {
        if (!cancelled) {
          setAyahs([])
          setError(err instanceof Error ? err.message : 'تعذر تحميل الصفحة')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPage()

    return () => {
      cancelled = true
    }
  }, [pageNumber])

  function goToPage(nextPage: number) {
    if (nextPage < MIN_PAGE || nextPage > MAX_PAGE) return
    setPageNumber(nextPage)
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current
    const distance = endX - touchStartX.current
    touchStartX.current = null

    if (Math.abs(distance) < 55) return

    // في RTL: السحب لليسار = الصفحة التالية، والسحب لليمين = السابقة.
    if (distance < 0) goToPage(pageNumber + 1)
    else goToPage(pageNumber - 1)
  }

  function toggleAyah(ayah: Ayah) {
    setSelectedAyah((current) => (current === ayah.key ? null : ayah.key))
  }

  function toggleAudio() {
    if (!audioRef.current) return

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const firstAyah = ayahs[0]
  const surahName = firstAyah?.surah?.name || 'المصحف الشريف'
  const juzNumber = firstAyah?.juz || 1

  return (
    <main
      dir="rtl"
      className="min-h-[100dvh] bg-[#F4F9FE] text-[#0F172A] overflow-hidden select-none"
    >
      {/* واجهة خفيفة جدًا فوق المصحف */}
      <div
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2">
          <Link
            href="/"
            aria-label="العودة للرئيسية"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#0284C7] shadow-md backdrop-blur-md"
          >
            <ChevronRight size={19} />
          </Link>

          <div className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-[#0F172A] shadow-md backdrop-blur-md">
            {surahName}
          </div>

          <button
            type="button"
            aria-label="معلومات المصحف"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#D97706] shadow-md backdrop-blur-md"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* الصفحة نفسها: أكبر مساحة ممكنة + السحب باليد */}
      <section
        className="flex min-h-[100dvh] w-full items-center justify-center px-1 py-2 sm:px-3 sm:py-4 md:px-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={() => setShowControls((value) => !value)}
      >
        <div className="relative flex h-[calc(100dvh-1rem)] w-full max-w-3xl items-center justify-center sm:h-[calc(100dvh-2rem)]">
          <div className="relative flex h-full w-full overflow-hidden rounded-[4px] border border-[#0EA5E9]/60 bg-[#FCFBF8] shadow-[0_12px_45px_rgba(15,23,42,0.14)]">
            <div className="absolute inset-[5px] pointer-events-none rounded-[2px] border border-[#D97706]/45" />

            <div className="flex h-full w-full flex-col px-3 py-5 sm:px-8 sm:py-7 md:px-12 md:py-8">
              <header className="mb-2 flex shrink-0 items-center justify-between border-b border-[#D97706]/50 pb-2 text-[#8A5A13]">
                <span className="text-xs font-bold sm:text-sm">{surahName}</span>
                <span className="font-uthmani text-lg sm:text-2xl">سُورَةُ {surahName}</span>
                <span className="text-xs font-bold sm:text-sm">الجزء {juzNumber.toLocaleString('ar-EG')}</span>
              </header>

              <div className="min-h-0 flex-1 overflow-hidden py-1">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#0284C7]">
                    جاري فتح صفحة المصحف...
                  </div>
                ) : error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      type="button"
                      onClick={() => setPageNumber((value) => value)}
                      className="rounded-full bg-[#0284C7] px-4 py-2 text-sm font-bold text-white"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : (
                  <div
                    className="h-full overflow-hidden text-center font-uthmani text-[23px] leading-[2.15] text-[#0F172A] sm:text-[27px] sm:leading-[2.25] md:text-[31px] md:leading-[2.35]"
                    dir="rtl"
                  >
                    {ayahs.map((ayah) => (
                      <span
                        key={ayah.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleAyah(ayah)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') toggleAyah(ayah)
                        }}
                        className={`cursor-pointer rounded-md px-0.5 transition-colors duration-150 ${
                          selectedAyah === ayah.key
                            ? 'bg-[#D97706]/20 text-[#7C4A03]'
                            : 'hover:bg-[#0284C7]/10'
                        }`}
                      >
                        {ayah.text}
                        <span className="mx-1 inline-block align-middle font-sans text-[13px] font-bold text-[#D97706] sm:text-[15px]">
                          ﴿{ayah.numberInSurah.toLocaleString('ar-EG')}﴾
                        </span>{' '}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <footer className="mt-2 flex shrink-0 items-center justify-between border-t border-[#D97706]/50 pt-2 text-xs font-bold text-[#8A5A13] sm:text-sm">
                <span>الحزب</span>
                <span>{pageNumber.toLocaleString('ar-EG')}</span>
                <span>الجزء {juzNumber.toLocaleString('ar-EG')}</span>
              </footer>
            </div>
          </div>
        </div>
      </section>

      {/* مشغل صغير جدًا حتى لا يغطي الآيات */}
      <div
        className={`fixed inset-x-0 bottom-2 z-50 flex justify-center px-3 transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-[#0EA5E9]/20 bg-[#0F172A]/90 px-3 py-1.5 text-white shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={toggleAudio}
            aria-label={playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة'}
            className="grid h-7 w-7 place-items-center rounded-full bg-[#D97706]"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span className="max-w-[180px] truncate text-[11px] font-bold">تشغيل التلاوة</span>
          <audio
            ref={audioRef}
            src="https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3"
            preload="none"
            onEnded={() => setPlaying(false)}
          />
        </div>
      </div>

      {/* تقليب الصفحات بالضغط فقط عند الحاجة؛ لا توجد أسهم ثابتة على الصفحة */}
      <button
        type="button"
        onClick={() => goToPage(pageNumber - 1)}
        aria-label="الصفحة السابقة"
        className="fixed right-1/2 top-1/2 z-30 hidden h-12 w-5 -translate-y-1/2 translate-x-1/2 opacity-0 md:block"
      />
      <button
        type="button"
        onClick={() => goToPage(pageNumber + 1)}
        aria-label="الصفحة التالية"
        className="fixed left-1/2 top-1/2 z-30 hidden h-12 w-5 -translate-y-1/2 -translate-x-1/2 opacity-0 md:block"
      />
    </main>
  )
}