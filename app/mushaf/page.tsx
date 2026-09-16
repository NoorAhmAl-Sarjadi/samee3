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

  const getAudioUrl = useCallback(
    (ayahNumber: number) => {
      const bitrate =
        selectedReciter.bitrate &&
        [192, 128, 64, 48, 40, 32].includes(
          Number(selectedReciter.bitrate)
        )
          ? Number(selectedReciter.bitrate)
          : 128

      return (
        `https://cdn.islamic.network/quran/audio/` +
        `${bitrate}/` +
        `${selectedReciter.identifier}/` +
        `${ayahNumber}.mp3`
      )
    },
    [selectedReciter]
  )

  // =========================================================
  // إيقاف الصوت بالكامل
  // =========================================================

  const stopAudio = useCallback(() => {
    const audio = audioRef.current

    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.oncanplay = null
      audio.pause()
      audio.currentTime = 0
      audio.removeAttribute('src')
      audio.load()
    }

    audioRef.current = null

    setIsPlaying(false)
    setIsLooping(false)
    setContinuousPlay(false)
    setPlayingAyahNumber(null)
  }, [])

  // =========================================================
  // تشغيل آية
  // =========================================================

  const playSingleAyah = useCallback(
    async (
      ayah: Ayah,
      loop: boolean,
      continuous: boolean
    ) => {
      try {
        if (audioRef.current) {
          const oldAudio = audioRef.current
          oldAudio.onended = null
          oldAudio.onerror = null
          oldAudio.oncanplay = null
          oldAudio.pause()
          oldAudio.currentTime = 0
          oldAudio.removeAttribute('src')
          oldAudio.load()
        }

        const audio = new Audio()
        audio.preload = 'auto'
        audio.src = getAudioUrl(ayah.number)

        audioRef.current = audio

        setPlayingAyahNumber(ayah.number)
        setIsPlaying(false)
        setIsLooping(loop)
        setContinuousPlay(continuous)

        audio.oncanplay = async () => {
          try {
            await audio.play()
            setIsPlaying(true)
          } catch (error) {
            console.error('Audio play blocked:', error)
            setIsPlaying(false)
          }
        }

        audio.onerror = () => {
          console.error('Audio file failed:', audio.src)
          setIsPlaying(false)
          setIsLooping(false)
          setContinuousPlay(false)
          setPlayingAyahNumber(null)
        }

        audio.onended = async () => {
          if (loop) {
            try {
              audio.currentTime = 0
              await audio.play()
              setIsPlaying(true)
            } catch (error) {
              console.error('Loop playback error:', error)
              setIsPlaying(false)
              setIsLooping(false)
              setPlayingAyahNumber(null)
            }
            return
          }

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
              await playSingleAyah(nextAyah, false, true)
              return
            }

            if (currentPage < 604) {
              try {
                const nextPageNumber = currentPage + 1
                const response = await fetch(
                  `https://api.alquran.cloud/v1/page/${nextPageNumber}/quran-uthmani`,
                  { cache: 'no-store' }
                )

                if (!response.ok) {
                  throw new Error('فشل تحميل الصفحة التالية')
                }

                const data = await response.json()
                const nextPageData = data?.data as PageData

                if (nextPageData?.ayahs?.length) {
                  setCurrentPage(nextPageNumber)
                  setPageData(nextPageData)
                  const firstAyah = nextPageData.ayahs[0]
                  await playSingleAyah(firstAyah, false, true)
                  return
                }
              } catch (error) {
                console.error('Next page audio error:', error)
              }
            }
          }

          setIsPlaying(false)
          setIsLooping(false)
          setContinuousPlay(false)
          setPlayingAyahNumber(null)
        }

        try {
          await audio.play()
          setIsPlaying(true)
        } catch {
          // سيبدأ التشغيل تلقائيًا من oncanplay
        }
      } catch (error) {
        console.error('Play ayah error:', error)
        setIsPlaying(false)
        setIsLooping(false)
        setContinuousPlay(false)
        setPlayingAyahNumber(null)
      }
    },
    [currentPage, getAudioUrl, pageData]
  )

  // =========================================================
  // تغيير القارئ
  // =========================================================

  const handleReciterChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIdentifier = event.target.value

    if (audioRef.current) {
      const audio = audioRef.current
      audio.onended = null
      audio.onerror = null
      audio.oncanplay = null
      audio.pause()
      audio.currentTime = 0
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }

    setIsPlaying(false)
    setIsLooping(false)
    setContinuousPlay(false)
    setPlayingAyahNumber(null)
    setSelectedReciterId(newIdentifier)
  }

  // =========================================================
  // استماع متتابع
  // =========================================================

  const handleListen = async () => {
    if (!selectedAyah) return

    const ayahToPlay = selectedAyah
    setSelectedAyah(null)

    await playSingleAyah(ayahToPlay, false, true)
  }

  // =========================================================
  // تكرار آية واحدة
  // =========================================================

  const handleRepeat = async () => {
    if (!selectedAyah) return

    const ayahToPlay = selectedAyah
    setSelectedAyah(null)

    await playSingleAyah(ayahToPlay, true, false)
  }

  // =========================================================
  // تشغيل / إيقاف المشغل
  // =========================================================

  const toggleFloatingPlayer = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (audio.paused) {
        await audio.play()
        setIsPlaying(true)
      } else {
        audio.pause()
        setIsPlaying(false)
      }
    } catch (error) {
      console.error('Floating player error:', error)
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
      className="min-h-screen bg-[#f6efdd] flex flex-col pb-44 relative overflow-x-hidden"
      dir="rtl"
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-30 bg-[#f6efdd]/95 backdrop-blur-md border-b border-[#b78945]/40 shadow-[0_4px_18px_rgba(91,59,20,0.08)]">
        <div className="relative mx-auto max-w-4xl px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="w-11 h-11 rounded-full border border-[#b78945]/50 bg-[#fffaf0] text-[#175e67] flex items-center justify-center shadow-sm"
              aria-label="العودة للرئيسية"
            >
              <ChevronRight size={22} />
            </Link>

            <div className="flex-1 text-center">
              <h1 className="font-bold text-[#5a3b1b] text-xl font-uthmani">
                المصحف الشريف
              </h1>
              <p className="text-[10px] font-bold text-[#175e67] mt-0.5 tracking-wide">
                مصحف سَميع
              </p>
            </div>

            <button
              type="button"
              className="w-11 h-11 rounded-full border border-[#b78945]/50 bg-[#fffaf0] text-[#b78945] flex items-center justify-center shadow-sm"
              aria-label="معلومات المصحف"
            >
              <Info size={21} />
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Mic2 size={15} className="text-[#b78945]" />
              <span className="text-xs font-bold text-[#175e67]">القارئ</span>
              {!isLoadingReciters && reciters.length > 0 && (
                <span className="text-[10px] text-[#8a7456]">
                  ({reciters.length} تلاوة)
                </span>
              )}
            </div>

            <div className="relative max-w-xl mx-auto">
              <select
                value={selectedReciterId}
                onChange={handleReciterChange}
                disabled={isLoadingReciters}
                className="w-full appearance-none bg-[#fffaf0] border-2 border-[#b78945]/35 text-[#175e67] font-bold text-sm rounded-2xl py-3 pr-4 pl-11 shadow-sm outline-none focus:border-[#175e67] focus:ring-2 focus:ring-[#175e67]/10 cursor-pointer disabled:opacity-60"
              >
                {isLoadingReciters ? (
                  <option>جاري تحميل القراء...</option>
                ) : (
                  reciters.map((reciter) => (
                    <option key={reciter.identifier} value={reciter.identifier}>
                      {reciter.name || reciter.englishName || reciter.identifier}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#b78945]" />
            </div>

            {recitersError && (
              <p className="text-[10px] text-red-500 mt-2 text-center">{recitersError}</p>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================
          المصحف
      ====================================================== */}

      <main className="flex-1 flex items-center justify-center px-2 py-4 sm:px-4 sm:py-6">
        <div className="w-full max-w-4xl">
          <div className="relative rounded-[34px] border-[4px] border-[#a97834] bg-[#efe3c7] p-2 shadow-[0_18px_50px_rgba(83,50,20,0.20)]">
            <div className="relative rounded-[28px] border-[2px] border-[#c59a53] bg-[#fffaf0] overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,rgba(183,137,69,.18),transparent_24%),radial-gradient(circle_at_80%_70%,rgba(23,94,103,.08),transparent_22%)]" />

              <div className="relative px-3 py-4 sm:px-7 sm:py-6">
                <div className="flex items-center gap-2 justify-between">
                  <div className="min-w-[92px] text-center rounded-2xl border border-[#b78945]/50 bg-[#f9eed7] px-3 py-2 shadow-sm">
                    <div className="text-[10px] font-bold text-[#8b6a3b]">الجزء</div>
                    <div className="text-lg font-uthmani font-bold text-[#5a3b1b]">
                      {currentJuz ? Number(currentJuz).toLocaleString('ar-EG') : '—'}
                    </div>
                  </div>

                  <div className="relative flex-1 text-center">
                    <div className="absolute left-1/2 -top-5 -translate-x-1/2 text-[#0f7080] text-2xl">✦</div>
                    <div className="inline-block rounded-[26px] border-2 border-[#b78945]/55 bg-[#f9eed7] px-6 py-2.5 shadow-inner">
                      <div className="font-uthmani text-xl sm:text-3xl font-bold text-[#3f2a13] leading-none">
                        {currentSurah}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[92px] text-center rounded-2xl border border-[#b78945]/50 bg-[#f9eed7] px-3 py-2 shadow-sm">
                    <div className="text-[10px] font-bold text-[#8b6a3b]">صفحة</div>
                    <div className="text-lg font-bold text-[#175e67]">
                      {currentPage.toLocaleString('ar-EG')}
                    </div>
                  </div>
                </div>

                <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#b78945]/60 to-transparent" />

                <div className="min-h-[62vh] sm:min-h-[70vh] flex items-center justify-center px-2 sm:px-7 py-3">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center text-[#175e67] gap-3 py-24">
                      <Loader2 className="animate-spin" size={42} />
                      <p className="font-bold">جاري تحميل الصفحة...</p>
                    </div>
                  ) : pageData?.ayahs?.length ? (
                    <p
                      className="font-uthmani text-[25px] sm:text-[33px] leading-[2.45] sm:leading-[2.55] text-[#171717] text-justify w-full"
                      style={{ textAlignLast: 'center' }}
                    >
                      {pageData.ayahs.map((ayah) => (
                        <span
                          key={ayah.number}
                          onClick={() => setSelectedAyah(ayah)}
                          className={`cursor-pointer transition-all duration-200 rounded-lg px-1 inline ${
                            selectedAyah?.number === ayah.number || playingAyahNumber === ayah.number
                              ? 'bg-[#c59a53]/20 shadow-sm'
                              : 'hover:bg-[#c59a53]/10'
                          }`}
                        >
                          {ayah.text}
                          <span
                            className={`text-[#b78945] mx-1 sm:mx-2 text-xl sm:text-2xl inline-flex items-center justify-center align-middle transition-transform ${
                              playingAyahNumber === ayah.number ? 'scale-125' : ''
                            }`}
                          >
                            ﴿{ayah.numberInSurah.toLocaleString('ar-EG')}﴾
                          </span>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <div className="text-center text-red-500 font-bold">تعذر تحميل الصفحة</div>
                  )}
                </div>

                <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#b78945]/60 to-transparent" />

                <div className="flex items-center justify-between text-[#b78945] text-sm font-bold">
                  <span>مصحف سَميع</span>
                  <span>{currentPage.toLocaleString('ar-EG')}</span>
                  <span>{currentSurah}</span>
                </div>
              </div>

              <div className="absolute top-2 left-2 text-3xl text-[#0f7080] opacity-80">❋</div>
              <div className="absolute top-2 right-2 text-3xl text-[#0f7080] opacity-80">❋</div>
              <div className="absolute bottom-2 left-2 text-3xl text-[#0f7080] opacity-80">❋</div>
              <div className="absolute bottom-2 right-2 text-3xl text-[#0f7080] opacity-80">❋</div>
            </div>
          </div>
        </div>
      </main>

      {/* =====================================================
          أزرار التقليب
      ====================================================== */}

      <div
        className="fixed bottom-6 left-0 w-full flex justify-center gap-10 sm:gap-16 px-4 z-30 pointer-events-none"
        dir="ltr"
      >
        <button
          type="button"
          onClick={nextPage}
          disabled={
            currentPage === 604
          }
          className="pointer-events-auto bg-[#fffaf0]/95 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-[#175e67] hover:bg-[#175e67] hover:text-white transition border border-[#b78945]/40 disabled:opacity-40"
        >
          <ChevronLeft size={28} />
        </button>

        <button
          type="button"
          onClick={prevPage}
          disabled={
            currentPage === 1
          }
          className="pointer-events-auto bg-[#fffaf0]/95 backdrop-blur-md shadow-lg p-3 sm:p-4 rounded-full text-[#175e67] hover:bg-[#175e67] hover:text-white transition border border-[#b78945]/40 disabled:opacity-40"
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
        <div className="fixed bottom-[92px] sm:bottom-[100px] left-3 right-3 z-[45]">
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
