'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from 'react'
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
  Mic2,
  ChevronDown,
} from 'lucide-react'

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

interface AudioEdition {
  identifier: string
  language: string
  name: string
  englishName?: string
  format: string
  type: string
  direction?: string
  bitrate?: number
}

type DesignMode = 'ayah' | 'tafsir' | null

const DEFAULT_RECITER: AudioEdition = {
  identifier: 'ar.alafasy',
  language: 'ar',
  name: 'مشاري راشد العفاسي',
  englishName: 'Mishary Rashid Alafasy',
  format: 'audio',
  type: 'versebyverse',
}

function MushafContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const initialPage = Number(searchParams.get('page')) || 1

  const [currentPage, setCurrentPage] = useState<number>(
    Math.min(604, Math.max(1, initialPage))
  )

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // =========================================================
  // القراء / التلاوات
  // =========================================================

  const [reciters, setReciters] = useState<AudioEdition[]>([])
  const [selectedReciterId, setSelectedReciterId] =
    useState('ar.alafasy')
  const [isLoadingReciters, setIsLoadingReciters] = useState(true)
  const [recitersError, setRecitersError] = useState('')

  // =========================================================
  // تفاعل الآيات
  // =========================================================

  const [selectedAyah, setSelectedAyah] =
    useState<Ayah | null>(null)

  // =========================================================
  // الصوت
  // =========================================================

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [continuousPlay, setContinuousPlay] = useState(false)
  const [playingAyahNumber, setPlayingAyahNumber] =
    useState<number | null>(null)

  // =========================================================
  // النسخ
  // =========================================================

  const [copied, setCopied] = useState(false)

  // =========================================================
  // التصميم / التفسير
  // =========================================================

  const [designMode, setDesignMode] =
    useState<DesignMode>(null)

  const [tafsirText, setTafsirText] = useState('')
  const [isFetchingTafsir, setIsFetchingTafsir] =
    useState(false)

  // =========================================================
  // الحفظ
  // =========================================================

  const [isSaved, setIsSaved] = useState(false)

  // =========================================================
  // القارئ المحدد
  // =========================================================

  const selectedReciter = useMemo(() => {
    return (
      reciters.find(
        (reciter) =>
          reciter.identifier === selectedReciterId
      ) || DEFAULT_RECITER
    )
  }, [reciters, selectedReciterId])

  const currentReciterName =
    selectedReciter.name ||
    selectedReciter.englishName ||
    'مشاري راشد العفاسي'

  const currentSurah =
    pageData?.ayahs?.[0]?.surah?.name ||
    'المصحف الشريف'

  const currentJuz =
    pageData?.ayahs?.[0]?.juz || ''

  // =========================================================
  // تحميل القراء من Al Quran Cloud
  // =========================================================

  const loadReciters = useCallback(async () => {
    try {
      setIsLoadingReciters(true)
      setRecitersError('')

      const response = await fetch(
        'https://api.alquran.cloud/v1/edition/format/audio',
        {
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(
          'فشل تحميل قائمة القراء'
        )
      }

      const data = await response.json()

      const editions: AudioEdition[] =
        Array.isArray(data?.data)
          ? data.data
          : []

      // نأخذ التلاوات العربية الصوتية
      // ونستبعد أي edition ليست صوتًا عربيًا
      const arabicAudio = editions.filter(
        (edition) => {
          const language =
            String(edition.language || '')
              .trim()
              .toLowerCase()

          const format =
            String(edition.format || '')
              .trim()
              .toLowerCase()

          return (
            language === 'ar' &&
            format === 'audio'
          )
        }
      )

      // إزالة التكرارات بناءً على identifier
      const uniqueEditions =
        Array.from(
          new Map(
            arabicAudio.map(
              (edition) => [
                edition.identifier,
                edition,
              ]
            )
          ).values()
        )

      // العفاسي أولًا إن كان موجودًا
      uniqueEditions.sort(
        (a, b) => {
          if (
            a.identifier === 'ar.alafasy'
          ) {
            return -1
          }

          if (
            b.identifier === 'ar.alafasy'
          ) {
            return 1
          }

          return a.name.localeCompare(
            b.name,
            'ar'
          )
        }
      )

      setReciters(uniqueEditions)

      // لو العفاسي موجود نختاره افتراضيًا
      if (
        uniqueEditions.some(
          (edition) =>
            edition.identifier ===
            'ar.alafasy'
        )
      ) {
        setSelectedReciterId(
          'ar.alafasy'
        )
      } else if (
        uniqueEditions.length > 0
      ) {
        setSelectedReciterId(
          uniqueEditions[0].identifier
        )
      }
    } catch (error) {
      console.error(
        'Reciters loading error:',
        error
      )

      setRecitersError(
        'تعذر تحميل قائمة القراء حاليًا'
      )

      // fallback
      setReciters([
        DEFAULT_RECITER,
      ])
      setSelectedReciterId(
        DEFAULT_RECITER.identifier
      )
    } finally {
      setIsLoadingReciters(false)
    }
  }, [])

  useEffect(() => {
    loadReciters()
  }, [loadReciters])

  // =========================================================
  // تحميل صفحة المصحف
  // =========================================================

  const fetchPage = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true)

        const response = await fetch(
          `https://api.alquran.cloud/v1/page/${page}/quran-uthmani`,
          {
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          throw new Error(
            'فشل تحميل الصفحة'
          )
        }

        const data =
          await response.json()

        setPageData(data.data)
      } catch (error) {
        console.error(
          'Page loading error:',
          error
        )

        setPageData(null)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPage(currentPage)
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
          doc(
            db,
            'users',
            user.uid
          ),
          {
            lastReadPage:
              currentPage,
          },
          {
            merge: true,
          }
        )
      } catch (error) {
        console.error(
          'Progress save error:',
          error
        )
      }
    }

    saveProgress()
  }, [
    currentPage,
    user,
  ])

  // =========================================================
  // تنظيف الصوت عند مغادرة الصفحة
  // =========================================================

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  // =========================================================
  // فحص الحفظ
  // =========================================================

  useEffect(() => {
    if (!selectedAyah) {
      setIsSaved(false)
      return
    }

    try {
      const saved = JSON.parse(
        localStorage.getItem(
          'samee3_bookmarks'
        ) || '[]'
      )

      setIsSaved(
        saved.some(
          (item: Ayah) =>
            item.number ===
            selectedAyah.number
        )
      )
    } catch {
      setIsSaved(false)
    }
  }, [selectedAyah])

  // =========================================================
  // حفظ / إلغاء حفظ الآية
  // =========================================================

  const toggleBookmark = () => {
    if (!selectedAyah) return

    try {
      const saved = JSON.parse(
        localStorage.getItem(
          'samee3_bookmarks'
        ) || '[]'
      )

      if (isSaved) {
        const filtered =
          saved.filter(
            (item: Ayah) =>
              item.number !==
              selectedAyah.number
          )

        localStorage.setItem(
          'samee3_bookmarks',
          JSON.stringify(
            filtered
          )
        )

        setIsSaved(false)
      } else {
        saved.push({
          number:
            selectedAyah.number,
          text:
            selectedAyah.text,
          numberInSurah:
            selectedAyah.numberInSurah,
          surahName:
            currentSurah,
          page:
            currentPage,
        })

        localStorage.setItem(
          'samee3_bookmarks',
          JSON.stringify(
            saved
          )
        )

        setIsSaved(true)
      }
    } catch (error) {
      console.error(
        'Bookmark error:',
        error
      )
    }
  }

  // =========================================================
  // رابط الصوت من Al Quran Cloud
  // =========================================================

  const getAudioUrl = (
    ayahNumber: number
  ) => {
    return (
      `https://cdn.islamic.network/quran/audio/128/` +
      `${selectedReciter.identifier}/` +
      `${ayahNumber}.mp3`
    )
  }

  // =========================================================
  // إيقاف الصوت
  // =========================================================

  const stopAudio =
    useCallback(() => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.src = ''
      }

      audioRef.current =
        null

      setIsPlaying(false)
      setIsLooping(false)
      setContinuousPlay(false)
      setPlayingAyahNumber(null)
    }, [])

  // =========================================================
  // تشغيل آية
  // =========================================================

  const playSingleAyah =
    useCallback(
      async (
        ayah: Ayah,
        loop: boolean,
        continuous: boolean
      ) => {
        try {
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.src = ''
          }

          const audio =
            new Audio(
              getAudioUrl(
                ayah.number
              )
            )

          audioRef.current =
            audio

          setIsPlaying(true)
          setIsLooping(loop)
          setContinuousPlay(
            continuous
          )
          setPlayingAyahNumber(
            ayah.number
          )

          audio.onended =
            async () => {
              // ============================================
              // تكرار الآية نفسها
              // ============================================

              if (loop) {
                try {
                  audio.currentTime = 0
                  await audio.play()
                } catch (error) {
                  console.error(
                    error
                  )

                  setIsPlaying(
                    false
                  )

                  setPlayingAyahNumber(
                    null
                  )
                }

                return
              }

              // ============================================
              // تشغيل الآيات بشكل متتابع
              // ============================================

              if (continuous) {
                const currentIndex =
                  pageData?.ayahs.findIndex(
                    (item) =>
                      item.number ===
                      ayah.number
                  ) ?? -1

                const nextAyah =
                  currentIndex >= 0
                    ? pageData
                        ?.ayahs[
                        currentIndex +
                          1
                      ]
                    : undefined

                // آية تالية في نفس الصفحة
                if (nextAyah) {
                  setSelectedAyah(
                    nextAyah
                  )

                  await playSingleAyah(
                    nextAyah,
                    false,
                    true
                  )

                  return
                }

                // ==========================================
                // انتهت الصفحة
                // ننتقل للصفحة التالية
                // ==========================================

                if (
                  currentPage <
                  604
                ) {
                  setCurrentPage(
                    (previous) =>
                      previous + 1
                  )

                  return
                }
              }

              setIsPlaying(false)
              setIsLooping(false)
              setContinuousPlay(
                false
              )
              setPlayingAyahNumber(
                null
              )
            }

          audio.onerror = () => {
            console.error(
              'Audio playback error'
            )

            setIsPlaying(false)
            setIsLooping(false)
            setContinuousPlay(
              false
            )
            setPlayingAyahNumber(
              null
            )
          }

          await audio.play()
        } catch (error) {
          console.error(
            'Play error:',
            error
          )

          setIsPlaying(false)
          setIsLooping(false)
          setContinuousPlay(
            false
          )
          setPlayingAyahNumber(
            null
          )
        }
      },
      [
        pageData,
        currentPage,
        selectedReciter,
      ]
    )

  // =========================================================
  // تغيير القارئ
  // =========================================================

  const handleReciterChange =
    (
      event: React.ChangeEvent<HTMLSelectElement>
    ) => {
      const newIdentifier =
        event.target.value

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.src = ''
        audioRef.current = null
      }

      setIsPlaying(false)
      setIsLooping(false)
      setContinuousPlay(
        false
      )
      setPlayingAyahNumber(
        null
      )

      setSelectedReciterId(
        newIdentifier
      )
    }

  // =========================================================
  // استماع متتابع
  // =========================================================

  const handleListen =
    async () => {
      if (!selectedAyah)
        return

      await playSingleAyah(
        selectedAyah,
        false,
        true
      )

      setSelectedAyah(null)
    }

  // =========================================================
  // تكرار آية واحدة
  // =========================================================

  const handleRepeat =
    async () => {
      if (!selectedAyah)
        return

      await playSingleAyah(
        selectedAyah,
        true,
        false
      )

      setSelectedAyah(null)
    }

  // =========================================================
  // تشغيل / إيقاف المشغل
  // =========================================================

  const toggleFloatingPlayer =
    async () => {
      if (
        !audioRef.current
      ) {
        return
      }

      if (
        audioRef.current
          .paused
      ) {
        try {
          await audioRef.current.play()
          setIsPlaying(true)
        } catch (error) {
          console.error(
            error
          )
        }
      } else {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }

  // =========================================================
  // نسخ الآية
  // =========================================================

  const handleCopy = async () => {
    if (!selectedAyah)
      return

    try {
      const text =
        `${selectedAyah.text} ﴿${selectedAyah.numberInSurah}﴾\n` +
        `[سورة ${currentSurah} - الآية ${selectedAyah.numberInSurah}]\n` +
        `القارئ: ${currentReciterName}\n` +
        `مصحف سَميع`

      await navigator.clipboard.writeText(
        text
      )

      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error(
        'Copy error:',
        error
      )
    }
  }

  // =========================================================
  // جلب التفسير
  // =========================================================

  const fetchTafsir =
    async () => {
      if (!selectedAyah)
        return

      setDesignMode(
        'tafsir'
      )

      setIsFetchingTafsir(
        true
      )

      setTafsirText('')

      try {
        const response =
          await fetch(
            `https://api.alquran.cloud/v1/ayah/${selectedAyah.number}/ar.muyassar`,
            {
              cache: 'no-store',
            }
          )

        if (!response.ok) {
          throw new Error(
            'Failed to fetch tafsir'
          )
        }

        const data =
          await response.json()

        setTafsirText(
          data?.data?.text ||
            'عذرًا، لم يتوفر التفسير لهذه الآية حاليًا.'
        )
      } catch (error) {
        console.error(
          'Tafsir error:',
          error
        )

        setTafsirText(
          'عذرًا، لم نتمكن من جلب التفسير لهذه الآية حاليًا.'
        )
      } finally {
        setIsFetchingTafsir(
          false
        )
      }
    }

  // =========================================================
  // تصميم الآية
  // =========================================================

  const openAyahDesign =
    () => {
      setDesignMode('ayah')
    }

  const openTafsirDesign =
    () => {
      fetchTafsir()
    }

  // =========================================================
  // حجم خط التصميم حسب طول الآية
  // =========================================================

  const getAyahFontSize = (
    text: string
  ): number => {
    const length =
      text.length

    if (length <= 45)
      return 48

    if (length <= 80)
      return 43

    if (length <= 120)
      return 38

    if (length <= 170)
      return 33

    if (length <= 230)
      return 29

    if (length <= 300)
      return 25

    return 22
  }

  // =========================================================
  // تقسيم النص
  // =========================================================

  const wrapText = (
    text: string,
    maxChars: number
  ) => {
    const words =
      text.split(/\s+/)

    const lines: string[] =
      []

    let current = ''

    for (const word of words) {
      const test =
        current.length > 0
          ? `${current} ${word}`
          : word

      if (
        test.length >
        maxChars
      ) {
        if (current) {
          lines.push(
            current
          )
        }

        current = word
      } else {
        current = test
      }
    }

    if (current) {
      lines.push(current)
    }

    return lines
  }

  // =========================================================
  // تنظيف XML
  // =========================================================

  const escapeXml = (
    text: string
  ) => {
    return text
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&apos;'
      )
  }

  // =========================================================
  // إنشاء SVG للتصميم
  // =========================================================

  const createDesignSvg =
    (): string | null => {
      if (!selectedAyah)
        return null

      const isTafsir =
        designMode ===
        'tafsir'

      const width = 1200

      const ayahFontSize =
        getAyahFontSize(
          selectedAyah.text
        )

      const ayahLines =
        wrapText(
          selectedAyah.text,
          ayahFontSize <= 25
            ? 54
            : ayahFontSize <= 29
            ? 48
            : ayahFontSize <= 33
            ? 42
            : 38
        )

      const tafsirLines =
        isTafsir
          ? wrapText(
              tafsirText ||
                'جاري تحميل التفسير...',
              62
            )
          : []

      const ayahLineHeight =
        ayahFontSize * 1.8

      const tafsirFontSize =
        28

      const tafsirLineHeight =
        tafsirFontSize * 1.9

      let height = 900

      height +=
        ayahLines.length *
        ayahLineHeight

      if (isTafsir) {
        height += 120
        height +=
          tafsirLines.length *
          tafsirLineHeight
        height += 120
      } else {
        height += 120
      }

      const safeHeight =
        Math.max(
          900,
          height
        )

      const centerX =
        width / 2

      const ayahY =
        430

      const ayahSvgLines =
        ayahLines
          .map(
            (
              line,
              index
            ) => {
              const y =
                ayahY +
                index *
                  ayahLineHeight

              return `
                <text
                  x="${centerX}"
                  y="${y}"
                  text-anchor="middle"
                  direction="rtl"
                  unicode-bidi="bidi-override"
                  font-family="Arial, Tahoma, sans-serif"
                  font-size="${ayahFontSize}"
                  font-weight="700"
                  fill="#FFFFFF"
                >${escapeXml(
                  line
                )}</text>
              `
            }
          )
          .join('')

      let extraSvg = ''

      const ayahEndY =
        ayahY +
        (ayahLines.length -
          1) *
          ayahLineHeight

      if (isTafsir) {
        const dividerY =
          ayahEndY + 80

        extraSvg += `
          <line
            x1="130"
            y1="${dividerY}"
            x2="1070"
            y2="${dividerY}"
            stroke="#C59A53"
            stroke-opacity="0.35"
            stroke-width="2"
          />

          <text
            x="${centerX}"
            y="${dividerY + 55}"
            text-anchor="middle"
            direction="rtl"
            font-family="Arial, Tahoma, sans-serif"
            font-size="25"
            font-weight="700"
            fill="#C59A53"
          >التفسير</text>
        `

        tafsirLines.forEach(
          (
            line,
            index
          ) => {
            extraSvg += `
              <text
                x="${centerX}"
                y="${
                  dividerY +
                  110 +
                  index *
                    tafsirLineHeight
                }"
                text-anchor="middle"
                direction="rtl"
                font-family="Arial, Tahoma, sans-serif"
                font-size="${tafsirFontSize}"
                fill="#F4F4F4"
              >${escapeXml(
                line
              )}</text>
            `
          }
        )

        const sourceY =
          dividerY +
          120 +
          tafsirLines.length *
            tafsirLineHeight

        extraSvg += `
          <line
            x1="250"
            y1="${sourceY + 30}"
            x2="950"
            y2="${sourceY + 30}"
            stroke="#FFFFFF"
            stroke-opacity="0.12"
            stroke-width="2"
          />

          <text
            x="${centerX}"
            y="${sourceY + 80}"
            text-anchor="middle"
            direction="rtl"
            font-family="Arial, Tahoma, sans-serif"
            font-size="22"
            font-weight="700"
            fill="#C59A53"
          >المصدر: التفسير الميسر</text>
        `
      }

      const safeSurah =
        escapeXml(
          currentSurah
        )

      const safeAyah =
        escapeXml(
          selectedAyah.numberInSurah.toLocaleString(
            'ar-EG'
          )
        )

      return `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${width}"
          height="${safeHeight}"
          viewBox="0 0 ${width} ${safeHeight}"
        >
          <defs>
            <linearGradient
              id="background"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0%"
                stop-color="#175E67"
              />
              <stop
                offset="100%"
                stop-color="#0D383E"
              />
            </linearGradient>
          </defs>

          <rect
            x="0"
            y="0"
            width="${width}"
            height="${safeHeight}"
            rx="45"
            fill="url(#background)"
          />

          <circle
            cx="110"
            cy="100"
            r="190"
            fill="#FFFFFF"
            opacity="0.04"
          />

          <circle
            cx="1090"
            cy="${safeHeight - 80}"
            r="220"
            fill="#C59A53"
            opacity="0.07"
          />

          <rect
            x="22"
            y="22"
            width="${width - 44}"
            height="${safeHeight - 44}"
            rx="35"
            fill="none"
            stroke="#C59A53"
            stroke-width="3"
            opacity="0.7"
          />

          <text
            x="80"
            y="100"
            direction="rtl"
            text-anchor="start"
            font-family="Arial, Tahoma, sans-serif"
            font-size="28"
            font-weight="700"
            fill="#C59A53"
          >مصحف سَميع</text>

          <text
            x="80"
            y="138"
            direction="rtl"
            text-anchor="start"
            font-family="Arial, Tahoma, sans-serif"
            font-size="17"
            fill="#FFFFFF"
            opacity="0.55"
          >للقرآن الكريم</text>

          <rect
            x="430"
            y="180"
            width="340"
            height="70"
            rx="35"
            fill="#FFFFFF"
            opacity="0.08"
          />

          <text
            x="${centerX}"
            y="226"
            text-anchor="middle"
            direction="rtl"
            font-family="Arial, Tahoma, sans-serif"
            font-size="25"
            font-weight="700"
            fill="#C59A53"
          >سورة ${safeSurah}</text>

          ${ayahSvgLines}

          <text
            x="${centerX}"
            y="${ayahEndY + 50}"
            text-anchor="middle"
            direction="rtl"
            font-family="Arial, Tahoma, sans-serif"
            font-size="26"
            font-weight="700"
            fill="#C59A53"
          >﴿${safeAyah}﴾</text>

          ${extraSvg}

          <text
            x="${centerX}"
            y="${safeHeight - 90}"
            text-anchor="middle"
            direction="rtl"
            font-family="Arial, Tahoma, sans-serif"
            font-size="24"
            font-weight="700"
            fill="#FFFFFF"
          >مصحف سَميع</text>

          <text
            x="${centerX}"
            y="${safeHeight - 52}"
            text-anchor="middle"
            direction="rtl"
            font-family="Arial, Tahoma, sans-serif"
            font-size="16"
            fill="#C59A53"
          >سورة ${safeSurah} • الآية ${safeAyah}</text>
        </svg>
      `
    }

  // =========================================================
  // تحميل التصميم PNG
  // =========================================================

  const downloadDesign =
    async () => {
      if (!selectedAyah)
        return

      try {
        const svg =
          createDesignSvg()

        if (!svg) return

        const blob =
          new Blob(
            [svg],
            {
              type: 'image/svg+xml;charset=utf-8',
            }
          )

        const svgUrl =
          URL.createObjectURL(
            blob
          )

        const image =
          new Image()

        image.onload =
          () => {
            try {
              const canvas =
                document.createElement(
                  'canvas'
                )

              canvas.width =
                image.naturalWidth ||
                1200

              canvas.height =
                image.naturalHeight ||
                900

              const context =
                canvas.getContext(
                  '2d'
                )

              if (!context) {
                throw new Error(
                  'Canvas unavailable'
                )
              }

              context.fillStyle =
                '#0D383E'

              context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
              )

              context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height
              )

              const pngUrl =
                canvas.toDataURL(
                  'image/png',
                  1
                )

              const link =
                document.createElement(
                  'a'
                )

              const safeSurah =
                currentSurah
                  .replace(
                    /[^\u0600-\u06FFa-zA-Z0-9\s-]/g,
                    ''
                  )
                  .trim()
                  .replace(
                    /\s+/g,
                    '-'
                  )

              link.download =
                `مصحف-سميع-${safeSurah}-آية-${selectedAyah.numberInSurah}.png`

              link.href =
                pngUrl

              document.body.appendChild(
                link
              )

              link.click()

              link.remove()

              URL.revokeObjectURL(
                svgUrl
              )
            } catch (error) {
              console.error(
                error
              )

              alert(
                'حدث خطأ أثناء إنشاء الصورة.'
              )
            }
          }

        image.onerror =
          () => {
            URL.revokeObjectURL(
              svgUrl
            )

            alert(
              'تعذر إنشاء التصميم.'
            )
          }

        image.src =
          svgUrl
      } catch (error) {
        console.error(
          error
        )

        alert(
          'حدث خطأ أثناء تحميل التصميم.'
        )
      }
    }

  // =========================================================
  // تغيير الصفحة
  // =========================================================

  const nextPage = () => {
    if (currentPage < 604) {
      setCurrentPage(
        (previous) =>
          previous + 1
      )
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(
        (previous) =>
          previous - 1
      )
    }
  }

  // =========================================================
  // الآية الحالية في المشغل
  // =========================================================

  const playingAyah =
    pageData?.ayahs.find(
      (ayah) =>
        ayah.number ===
        playingAyahNumber
    ) || selectedAyah

  return (
    <div
      className="min-h-screen bg-mushaf-paper flex flex-col pb-40 relative"
      dir="rtl"
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-30 bg-mushaf-paper/95 backdrop-blur-md border-b border-mushaf-border/30 shadow-sm">
        <div className="flex items-center justify-between p-4">
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

            <p className="text-[11px] text-mushaf-teal font-bold mt-1">
              مصحف سَميع
            </p>
          </div>

          <button
            type="button"
            className="text-mushaf-gold bg-white p-2.5 rounded-full shadow-sm"
          >
            <Info size={22} />
          </button>
        </div>

        {/* ===================================================
            اختيار القارئ
        ==================================================== */}

        <div className="px-4 pb-4">
          <div className="w-full max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Mic2
                size={16}
                className="text-mushaf-gold"
              />

              <span className="text-xs font-bold text-mushaf-teal">
                القارئ
              </span>

              {!isLoadingReciters &&
                reciters.length > 0 && (
                  <span className="text-[10px] text-gray-400">
                    ({reciters.length} تلاوة متاحة)
                  </span>
                )}
            </div>

            <div className="relative">
              <select
                value={
                  selectedReciterId
                }
                onChange={
                  handleReciterChange
                }
                disabled={
                  isLoadingReciters
                }
                className="
                  w-full
                  appearance-none
                  bg-white
                  border
                  border-mushaf-gold/40
                  text-mushaf-teal
                  font-bold
                  text-sm
                  rounded-2xl
                  py-3
                  pr-4
                  pl-11
                  shadow-sm
                  outline-none
                  focus:ring-2
                  focus:ring-mushaf-teal/20
                  cursor-pointer
                  disabled:opacity-60
                "
              >
                {isLoadingReciters ? (
                  <option>
                    جاري تحميل القراء...
                  </option>
                ) : (
                  reciters.map(
                    (reciter) => (
                      <option
                        key={
                          reciter.identifier
                        }
                        value={
                          reciter.identifier
                        }
                      >
                        {reciter.name ||
                          reciter.englishName ||
                          reciter.identifier}
                      </option>
                    )
                  )
                )}
              </select>

              <ChevronDown
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-mushaf-gold"
              />
            </div>

            {recitersError && (
              <p className="text-[10px] text-red-500 mt-2 text-center">
                {recitersError}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================
          المصحف
      ====================================================== */}

      <main className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-3xl bg-mushaf-paper border-[6px] border-mushaf-border p-1.5 rounded-sm shadow-2xl">
          <div className="border-[2px] border-mushaf-gold bg-[#FEFCF8] p-4 sm:p-7 min-h-[70vh] flex flex-col">
            <div className="flex justify-between items-center border-b-2 border-mushaf-gold pb-3 mb-7 text-mushaf-gold font-bold text-xs sm:text-sm">
              <span>
                الجزء{' '}
                {currentJuz
                  ? Number(
                      currentJuz
                    ).toLocaleString(
                      'ar-EG'
                    )
                  : '—'}
              </span>

              <span className="font-uthmani text-lg sm:text-2xl text-center px-3">
                {currentSurah}
              </span>

              <span>
                صفحة{' '}
                {currentPage.toLocaleString(
                  'ar-EG'
                )}
              </span>
            </div>

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
              ) : pageData?.ayahs
                  ?.length ? (
                <p
                  className="font-uthmani text-[24px] sm:text-[29px] leading-[2.5] sm:leading-[2.8] text-mushaf-dark text-justify w-full"
                  style={{
                    textAlignLast:
                      'center',
                  }}
                >
                  {pageData.ayahs.map(
                    (ayah) => (
                      <span
                        key={
                          ayah.number
                        }
                        onClick={() =>
                          setSelectedAyah(
                            ayah
                          )
                        }
                        className={`
                          cursor-pointer
                          transition-all
                          duration-300
                          rounded-lg
                          px-1
                          inline
                          ${
                            selectedAyah?.number ===
                              ayah.number ||
                            playingAyahNumber ===
                              ayah.number
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
                              playingAyahNumber ===
                              ayah.number
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
                    )
                  )}
                </p>
              ) : (
                <div className="text-center text-red-500 font-bold">
                  تعذر تحميل الصفحة
                </div>
              )}
            </div>

            <div className="flex justify-center items-center border-t-2 border-mushaf-gold pt-3 mt-7 text-mushaf-gold font-bold text-sm">
              <span className="text-lg">
                {currentPage.toLocaleString(
                  'ar-EG'
                )}
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
          type="button"
          onClick={nextPage}
          disabled={
            currentPage === 604
          }
          className="bg-white/95 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20 disabled:opacity-40"
        >
          <ChevronLeft size={28} />
        </button>

        <button
          type="button"
          onClick={prevPage}
          disabled={
            currentPage === 1
          }
          className="bg-white/95 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-mushaf-teal hover:bg-mushaf-teal hover:text-white transition border border-mushaf-teal/20 disabled:opacity-40"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* =====================================================
          خيارات الآية
      ====================================================== */}

      {selectedAyah &&
        !designMode && (
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
                type="button"
                onClick={() =>
                  setSelectedAyah(
                    null
                  )
                }
                className="bg-gray-200 p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-500 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 p-5">
              {/* استماع */}

              <button
                type="button"
                onClick={
                  handleListen
                }
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
                type="button"
                onClick={
                  handleRepeat
                }
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
                type="button"
                onClick={
                  handleCopy
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 bg-mushaf-paper text-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-all">
                  {copied ? (
                    <CheckCheck
                      size={23}
                    />
                  ) : (
                    <Copy
                      size={23}
                    />
                  )}
                </div>

                <span className="text-xs font-bold text-gray-600">
                  {copied
                    ? 'تم النسخ'
                    : 'نسخ'}
                </span>
              </button>

              {/* صورة */}

              <button
                type="button"
                onClick={
                  openAyahDesign
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 bg-mushaf-paper text-purple-500 rounded-full flex items-center justify-center group-hover:bg-purple-50 transition-all">
                  <ImageIcon
                    size={23}
                  />
                </div>

                <span className="text-xs font-bold text-gray-600">
                  كصورة
                </span>
              </button>

              {/* تفسير وصورة */}

              <button
                type="button"
                onClick={
                  openTafsirDesign
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 bg-mushaf-paper text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-all">
                  <FileText
                    size={23}
                  />
                </div>

                <span className="text-xs font-bold text-gray-600 text-center leading-tight">
                  تفسير وصورة
                </span>
              </button>

              {/* حفظ */}

              <button
                type="button"
                onClick={
                  toggleBookmark
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`
                    w-12 h-12
                    rounded-full
                    flex
                    items-center
                    justify-center
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
                    fill={
                      isSaved
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                </div>

                <span className="text-xs font-bold text-gray-600">
                  {isSaved
                    ? 'محفوظة'
                    : 'حفظ'}
                </span>
              </button>
            </div>
          </div>
        )}

      {/* =====================================================
          شاشة التصميم
      ====================================================== */}

      {designMode &&
        selectedAyah && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-xl flex justify-between items-center mb-4 px-1">
              <div className="text-white">
                <p className="font-bold text-sm">
                  {designMode ===
                  'tafsir'
                    ? 'تصميم الآية مع التفسير'
                    : 'تصميم الآية'}
                </p>

                <p className="text-white/60 text-xs mt-1">
                  جاهز للمشاركة والتحميل
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDesignMode(
                    null
                  )
                }
                className="bg-white/15 p-2.5 rounded-full text-white hover:bg-red-500 transition"
              >
                <X size={22} />
              </button>
            </div>

            <div className="relative w-full max-w-xl rounded-[30px] overflow-hidden border border-mushaf-gold/50 shadow-2xl bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white">
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />

              <div className="absolute -bottom-28 -left-20 w-72 h-72 bg-mushaf-gold/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 p-7 sm:p-10">
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

                <div className="text-center mb-7">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-mushaf-gold text-xs font-bold">
                    سورة{' '}
                    {
                      currentSurah
                    }
                  </span>
                </div>

                <div
                  className="text-center"
                  dir="rtl"
                >
                  <p
                    className="font-uthmani text-white leading-[2.1] whitespace-normal break-words"
                    style={{
                      fontSize:
                        getAyahFontSize(
                          selectedAyah.text
                        ),
                    }}
                  >
                    {
                      selectedAyah.text
                    }

                    <span className="text-mushaf-gold mx-2 inline-flex items-center justify-center align-middle">
                      ﴿
                      {selectedAyah.numberInSurah.toLocaleString(
                        'ar-EG'
                      )}
                      ﴾
                    </span>
                  </p>
                </div>

                {designMode ===
                  'tafsir' && (
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
                          {
                            tafsirText
                          }
                        </p>

                        <div className="mt-6 pt-4 border-t border-white/10">
                          <p className="text-mushaf-gold text-xs font-bold text-right">
                            المصدر: التفسير الميسر
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

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
                      {
                        currentSurah
                      }
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="text-white/60 text-[10px]">
                      الصفحة
                    </p>

                    <p className="text-mushaf-gold font-bold text-sm mt-1">
                      {currentPage.toLocaleString(
                        'ar-EG'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={
                downloadDesign
              }
              disabled={
                isFetchingTafsir
              }
              className="mt-5 w-full max-w-xl bg-mushaf-gold text-white rounded-2xl py-4 px-6 font-bold flex items-center justify-center gap-3 shadow-xl hover:scale-[1.01] transition disabled:opacity-50"
            >
              <Download size={21} />
              تحميل التصميم
            </button>

            <button
              type="button"
              onClick={() =>
                setDesignMode(
                  null
                )
              }
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
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[24px] border border-mushaf-gold/30 shadow-[0_15px_50px_rgba(13,56,62,0.35)] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                <Volume2
                  size={21}
                  className={
                    isPlaying
                      ? 'text-mushaf-gold'
                      : 'text-white/60'
                  }
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-mushaf-gold text-xs font-bold truncate">
                  {
                    currentReciterName
                  }
                </p>

                <p className="text-white text-sm font-bold truncate mt-0.5">
                  {
                    currentSurah
                  }
                </p>

                <p className="text-white/50 text-[10px] mt-0.5">
                  آية{' '}
                  {playingAyah.numberInSurah.toLocaleString(
                    'ar-EG'
                  )}
                  {' • '}
                  {isLooping
                    ? 'تكرار الآية'
                    : continuousPlay
                    ? 'تشغيل متتابع'
                    : 'متوقف'}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  toggleFloatingPlayer
                }
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

              <button
                type="button"
                onClick={
                  stopAudio
                }
                className="w-10 h-10 shrink-0 rounded-full bg-white/10 text-white/75 flex items-center justify-center hover:bg-red-500 hover:text-white transition"
                title="إغلاق المشغل"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full bg-mushaf-gold transition-all ${
                  isPlaying
                    ? 'w-full animate-pulse'
                    : 'w-1/4'
                }`}
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
