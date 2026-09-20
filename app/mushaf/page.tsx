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
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  isSupportedRiwayaId,
  RIWAYAT,
  type RiwayaId,
} from '@/lib/quran/Samee3DataAdapter'

interface Ayah {
  number: number
  key: string
  text: string
  numberInSurah: number
  juz: number
  page: number
  audioNumber?: number
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

interface TafsirBook {
  id: number
  name: string
  short_name?: string
  author?: string
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


// =========================================================
// اتصال المصحف الآمن: الصفحة تعتمد على Route الداخلي فقط.
// يدعم أي صيغة استجابة حالية { ayahs } بدون ربط الصفحة
// بشكل مباشر بتفاصيل Adapter، ويمنع التحميل اللانهائي.
// =========================================================

async function fetchQuranPageDirect(
  page: number,
  riwayaId: RiwayaId,
  timeoutMs = 15000
): Promise<Ayah[]> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const params = new URLSearchParams({
      riwaya: riwayaId,
      page: String(page),
    })

    const response = await fetch(`/api/quran?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const apiMessage =
        typeof payload?.error === 'string'
          ? payload.error
          : `HTTP ${response.status}`
      throw new Error(apiMessage)
    }

    const ayahs = Array.isArray(payload?.ayahs)
      ? payload.ayahs
      : []

    return ayahs as Ayah[]
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function MushafContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const initialPage = Number(searchParams.get('page')) || 1
  const requestedRiwaya = searchParams.get('riwaya')
  const initialRiwaya: RiwayaId =
    requestedRiwaya && isSupportedRiwayaId(requestedRiwaya)
      ? requestedRiwaya
      : 'hafs'

  const [selectedRiwayaId, setSelectedRiwayaId] =
    useState<RiwayaId>(initialRiwaya)
  const [isLoadingRiwaya, setIsLoadingRiwaya] =
    useState(true)
  const [riwayaError, setRiwayaError] =
    useState('')

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
  const [playingAyahKey, setPlayingAyahKey] =
    useState<string | null>(null)

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
  const [isTafsirOpen, setIsTafsirOpen] =
    useState(false)
  const [tafsirError, setTafsirError] = useState('')
  const [tafsirCopied, setTafsirCopied] = useState(false)

  const [tafsirBooks, setTafsirBooks] = useState<TafsirBook[]>([])
  const [selectedTafsirBookId, setSelectedTafsirBookId] =
    useState<number | null>(null)
  const [isLoadingTafsirBooks, setIsLoadingTafsirBooks] =
    useState(false)
  const [tafsirBooksError, setTafsirBooksError] =
    useState('')

  const tafsirCacheRef = useRef<
    Map<string, { text: string; book: TafsirBook }>
  >(new Map())

  const tafsirBooksCacheRef = useRef<
    Map<number, TafsirBook[]>
  >(new Map())

  // =========================================================
  // الحفظ
  // =========================================================

  const [isSaved, setIsSaved] = useState(false)

  // =========================================================
  // حفظ واستعادة موضع القراءة المتقدم
  // =========================================================

  const hasExplicitPage = searchParams.has('page')
  const hasExplicitRiwaya = searchParams.has('riwaya')
  const [resumeReady, setResumeReady] = useState(false)
  const [lastReadAyah, setLastReadAyah] = useState<Ayah | null>(null)
  const pendingResumeAyahKeyRef = useRef<string | null>(null)
  const restoredReciterRef = useRef(false)

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

  const currentSurahNumber =
    pageData?.ayahs?.[0]?.surah?.number || ''

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

      // لو فيه قارئ محفوظ للمستخدم، لا نستبدله بالافتراضي.
      if (!restoredReciterRef.current) {
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
  // استعادة آخر موضع قراءة من Firebase
  // =========================================================

  useEffect(() => {
    let cancelled = false

    const restoreReadingState = async () => {
      if (!user) {
        setResumeReady(true)
        return
      }

      try {
        const snapshot = await getDoc(
          doc(db, 'users', user.uid)
        )

        if (cancelled) return

        if (snapshot.exists()) {
          const data = snapshot.data()

          const savedReciterId =
            typeof data?.lastReadReciterId === 'string'
              ? data.lastReadReciterId.trim()
              : ''

          if (savedReciterId) {
            restoredReciterRef.current = true
            setSelectedReciterId(savedReciterId)
          }

          const savedRiwayaId =
            typeof data?.lastReadRiwayaId === 'string'
              ? data.lastReadRiwayaId.trim()
              : ''

          if (
            !hasExplicitRiwaya &&
            savedRiwayaId &&
            isSupportedRiwayaId(savedRiwayaId)
          ) {
            setSelectedRiwayaId(savedRiwayaId)
          }

          // إذا كان الرابط يحتوي على page=... نحترم الصفحة المطلوبة.
          if (!hasExplicitPage) {
            const savedPage = Number(
              data?.lastReadPage || 1
            )

            const safePage = Number.isFinite(savedPage)
              ? Math.min(
                  604,
                  Math.max(1, savedPage)
                )
              : 1

            setCurrentPage(safePage)

            const savedAyahKey =
              typeof data?.lastReadAyahKey === 'string'
                ? data.lastReadAyahKey.trim()
                : ''

            const savedSurahNumber = Number(
              data?.lastReadSurahNumber || 0
            )

            const savedAyahNumber = Number(
              data?.lastReadAyahNumber || 0
            )

            const fallbackAyahKey =
              savedSurahNumber > 0 && savedAyahNumber > 0
                ? `${savedSurahNumber}:${savedAyahNumber}`
                : ''

            const savedStateBelongsToSelectedRiwaya =
              !hasExplicitRiwaya ||
              !savedRiwayaId ||
              savedRiwayaId === initialRiwaya

            pendingResumeAyahKeyRef.current =
              savedStateBelongsToSelectedRiwaya
                ? savedAyahKey || fallbackAyahKey || null
                : null
          }
        }
      } catch (error) {
        console.error(
          'Reading resume restore error:',
          error
        )
      } finally {
        if (!cancelled) {
          setResumeReady(true)
        }
      }
    }

    void restoreReadingState()

    return () => {
      cancelled = true
    }
  }, [
    user,
    hasExplicitPage,
    hasExplicitRiwaya,
  ])

  // =========================================================
  // تحميل صفحة المصحف حسب الرواية المختارة
  // =========================================================

  const fetchPage = useCallback(
    async (page: number, riwayaId: RiwayaId) => {
      try {
        setIsLoading(true)
        setIsLoadingRiwaya(true)
        setRiwayaError('')

        const ayahs = await fetchQuranPageDirect(page, riwayaId)

        if (!ayahs.length) {
          throw new Error(
            `لا توجد آيات مسجلة للصفحة ${page} في الرواية المختارة.`
          )
        }

        setPageData({
          number: page,
          ayahs,
        })
      } catch (error) {
        console.error(
          'Riwaya page loading error:',
          error
        )
        setPageData(null)

        setRiwayaError(
          error instanceof DOMException && error.name === 'AbortError'
            ? 'تأخر الاتصال بالخادم. اضغط إعادة المحاولة.'
            : 'تعذر تحميل نص هذه الرواية حاليًا. تأكد من اتصال الإنترنت ثم أعد المحاولة.'
        )
      } finally {
        setIsLoading(false)
        setIsLoadingRiwaya(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPage(
      currentPage,
      selectedRiwayaId
    )
    setSelectedAyah(null)
    setLastReadAyah(null)
  }, [
    currentPage,
    selectedRiwayaId,
    fetchPage,
  ])

  // =========================================================
  // استعادة الآية الأخيرة داخل الصفحة
  // =========================================================

  useEffect(() => {
    if (
      !resumeReady ||
      hasExplicitPage ||
      !pageData?.ayahs?.length
    ) {
      return
    }

    const targetAyahKey =
      pendingResumeAyahKeyRef.current

    if (!targetAyahKey) return

    const restoredAyah =
      pageData.ayahs.find(
        (ayah) =>
          ayah.key === targetAyahKey
      )

    if (restoredAyah) {
      setLastReadAyah(restoredAyah)
      pendingResumeAyahKeyRef.current = null
    }
  }, [
    pageData,
    resumeReady,
    hasExplicitPage,
  ])

  // حفظ آخر موضع قراءة
  // =========================================================

  useEffect(() => {
    if (
      !user ||
      !resumeReady ||
      !pageData?.ayahs?.length
    ) {
      return
    }

    const currentPlayingAyah =
      pageData.ayahs.find(
        (ayah) =>
          ayah.key ===
          playingAyahKey
      )

    const ayahToSave =
      lastReadAyah?.page === currentPage
        ? lastReadAyah
        : currentPlayingAyah || null

    const riwayaName =
      RIWAYAT.find(
        (item) =>
          item.id ===
          selectedRiwayaId
      )?.label || selectedRiwayaId

    const saveProgress = async () => {
      try {
        await setDoc(
          doc(
            db,
            'users',
            user.uid
          ),
          {
            lastReadPage: currentPage,
            lastReadRiwayaId: selectedRiwayaId,
            lastReadRiwayaName: riwayaName,
            lastReadSurahNumber: currentSurahNumber || null,
            lastReadSurahName:
              currentSurah !== 'المصحف الشريف'
                ? currentSurah
                : null,
            lastReadJuz: currentJuz || null,
            lastReadAyahKey: ayahToSave?.key || null,
            lastReadAyahGlobal: ayahToSave?.audioNumber || null,
            lastReadAyahNumber: ayahToSave?.numberInSurah || null,
            lastReadReciterId: selectedReciter.identifier,
            lastReadReciterName: currentReciterName,
            lastReadUpdatedAt: new Date().toISOString(),
            lastReadRoute:
              `/mushaf?page=${currentPage}&riwaya=${selectedRiwayaId}`,
          },
          { merge: true }
        )
      } catch (error) {
        console.error(
          'Progress save error:',
          error
        )
      }
    }

    void saveProgress()
  }, [
    currentPage,
    currentSurah,
    currentSurahNumber,
    currentJuz,
    selectedRiwayaId,
    selectedReciter.identifier,
    currentReciterName,
    lastReadAyah,
    playingAyahKey,
    pageData,
    user,
    resumeReady,
  ])

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
  // رابط الصوت من Al Quran Cloud — مستقل عن الرواية
  // =========================================================

  const getAudioUrl = useCallback(
    async (ayah: Ayah) => {
      try {
        const surahNumber = ayah.surah?.number

        if (!surahNumber) {
          throw new Error('رقم السورة غير متوفر')
        }

        const response = await fetch(
          `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayah.numberInSurah}/${selectedReciter.identifier}`,
          { cache: 'no-store' }
        )

        if (response.ok) {
          const data = await response.json()
          const remoteUrl = data?.data?.audio

          if (
            typeof remoteUrl === 'string' &&
            remoteUrl
          ) {
            return remoteUrl
          }
        }
      } catch (error) {
        console.error(
          'Audio URL lookup error:',
          error
        )
      }

      if (ayah.audioNumber) {
        const bitrate =
          selectedReciter.bitrate &&
          [192, 128, 64, 48, 40, 32].includes(
            Number(selectedReciter.bitrate)
          )
            ? Number(selectedReciter.bitrate)
            : 128

        return (
          `https://cdn.islamic.network/quran/audio/` +
          `${bitrate}/${selectedReciter.identifier}/` +
          `${ayah.audioNumber}.mp3`
        )
      }

      throw new Error(
        'تعذر العثور على ملف الصوت لهذه الآية.'
      )
    },
    [selectedReciter]
  )

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
    setPlayingAyahKey(null)
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
        audio.src = await getAudioUrl(ayah)

        audioRef.current = audio

        setLastReadAyah(ayah)
        setPlayingAyahKey(ayah.key)
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
          setPlayingAyahKey(null)
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
              setPlayingAyahKey(null)
            }
            return
          }

          if (continuous) {
            const currentIndex =
              pageData?.ayahs.findIndex(
                (item) => item.key === ayah.key
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

                const nextAyahs =
                  await fetchQuranPageDirect(
                    nextPageNumber,
                    selectedRiwayaId
                  )

                if (nextAyahs.length) {
                  const nextPageData: PageData = {
                    number: nextPageNumber,
                    ayahs: nextAyahs,
                  }

                  setCurrentPage(nextPageNumber)
                  setPageData(nextPageData)
                  const firstAyah =
                    nextPageData.ayahs[0]
                  await playSingleAyah(
                    firstAyah,
                    false,
                    true
                  )
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
          setPlayingAyahKey(null)
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
        setPlayingAyahKey(null)
      }
    },
    [
      currentPage,
      getAudioUrl,
      pageData,
      selectedRiwayaId,
    ]
  )

  // =========================================================
  // تغيير الرواية
  // =========================================================

  const handleRiwayaChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newRiwaya = event.target.value

    if (!isSupportedRiwayaId(newRiwaya)) {
      return
    }

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
    setPlayingAyahKey(null)
    setSelectedAyah(null)
    setLastReadAyah(null)
    setSelectedRiwayaId(newRiwaya)
  }

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
    setPlayingAyahKey(null)
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
  // كتب التفسير
  // =========================================================

  // قائمة ثابتة ثانية على الواجهة حتى لا تظهر أي كتب خارج القائمة المسموح بها.
  const APPROVED_SUNNI_TAFSIR_IDS = new Set<number>([
    4,     // جامع البيان - الطبري
    2,     // معالم التنزيل - البغوي
    136,   // تفسير القرآن العظيم - ابن كثير
    1469,  // الجامع لأحكام القرآن - القرطبي
    3,     // تيسير الكريم الرحمن - السعدي
    27796, // أضواء البيان في إيضاح القرآن بالقرآن - الشنقيطي
    2012,  // التفسير الميسر
    54,    // أيسر التفاسير
  ])

  const normalizeTafsirBooks = (
    input: unknown
  ): TafsirBook[] => {
    if (!Array.isArray(input)) return []

    return input
      .map((item) => {
        const row = item as Record<string, unknown>

        return {
          id: Number(row.id),
          name:
            typeof row.name === 'string'
              ? row.name.trim()
              : '',
          short_name:
            typeof row.short_name === 'string'
              ? row.short_name.trim()
              : '',
          author:
            typeof row.author === 'string'
              ? row.author.trim()
              : '',
        }
      })
      .filter(
        (book) =>
          Number.isFinite(book.id) &&
          APPROVED_SUNNI_TAFSIR_IDS.has(book.id) &&
          book.name
      )
  }

  const loadTafsirBooks = async (
    surahNumber: number
  ): Promise<TafsirBook[]> => {
    const cached =
      tafsirBooksCacheRef.current.get(
        surahNumber
      )

    if (cached?.length) {
      setTafsirBooks(cached)
      return cached
    }

    setIsLoadingTafsirBooks(true)
    setTafsirBooksError('')

    const controller =
      new AbortController()

    const timeoutId =
      window.setTimeout(
        () => controller.abort(),
        10000
      )

    try {
      const response =
        await fetch(
          `/api/tafsir?mode=books&surah=${surahNumber}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal:
              controller.signal,
            headers: {
              Accept:
                'application/json',
            },
          }
        )

      const data =
        await response.json().catch(
          () => null
        )

      if (!response.ok) {
        throw new Error(
          typeof data?.error ===
            'string'
            ? data.error
            : `HTTP ${response.status}`
        )
      }

      const books =
        normalizeTafsirBooks(
          data?.books
        )

      if (!books.length) {
        throw new Error(
          'NO_TAFSIR_BOOKS'
        )
      }

      tafsirBooksCacheRef.current.set(
        surahNumber,
        books
      )

      setTafsirBooks(books)

      return books
    } catch (error) {
      console.error(
        'Tafsir books error:',
        error
      )

      setTafsirBooks([])
      setTafsirBooksError(
        error instanceof DOMException &&
        error.name === 'AbortError'
          ? 'انتهى وقت تحميل كتب التفسير.'
          : 'تعذر تحميل كتب التفسير حاليًا.'
      )

      throw error
    } finally {
      window.clearTimeout(
        timeoutId
      )
      setIsLoadingTafsirBooks(
        false
      )
    }
  }

  const getDefaultTafsirBook = (
    books: TafsirBook[]
  ): TafsirBook | null => {
    if (!books.length) return null

    const preferred =
      books.find((book) =>
        /الميسر|الميسّر|المُيَسَّر/i.test(
          book.name
        )
      ) ||
      books.find((book) =>
        /ابن كثير|القرآن العظيم/i.test(
          book.name
        )
      ) ||
      books.find((book) =>
        /السعدي|الكريم الرحمن/i.test(
          book.name
        )
      )

    return preferred || books[0]
  }

  // =========================================================
  // جلب تفسير كتاب محدد لآية محددة
  // =========================================================

  const fetchTafsir = async (
    requestedBookId?: number,
    forDesign = false
  ) => {
    if (!selectedAyah) return

    const surahNumber =
      selectedAyah.surah?.number ||
      Number(
        selectedAyah.key.split(':')[0]
      )

    const ayahNumber =
      selectedAyah.numberInSurah

    if (
      !Number.isFinite(
        surahNumber
      ) ||
      !Number.isFinite(
        ayahNumber
      )
    ) {
      return
    }

    if (forDesign) {
      setDesignMode('tafsir')
      setIsTafsirOpen(false)
    } else {
      setIsTafsirOpen(true)
      setDesignMode(null)
    }

    setTafsirError('')
    setTafsirCopied(false)
    setTafsirBooksError('')

    let books: TafsirBook[] = []

    try {
      books =
        await loadTafsirBooks(
          surahNumber
        )
    } catch {
      setIsFetchingTafsir(false)
      return
    }

    const requestedBook =
      requestedBookId
        ? books.find(
            (book) =>
              book.id ===
              requestedBookId
          )
        : null

    const currentBook =
      selectedTafsirBookId
        ? books.find(
            (book) =>
              book.id ===
              selectedTafsirBookId
          )
        : null

    const book =
      requestedBook ||
      currentBook ||
      getDefaultTafsirBook(
        books
      )

    if (!book) {
      setTafsirError(
        'لا توجد كتب تفسير متاحة لهذه السورة حاليًا.'
      )
      setIsFetchingTafsir(false)
      return
    }

    setSelectedTafsirBookId(
      book.id
    )

    const cacheKey =
      `${book.id}:${surahNumber}:${ayahNumber}`

    const cached =
      tafsirCacheRef.current.get(
        cacheKey
      )

    if (cached) {
      setTafsirText(cached.text)
      setIsFetchingTafsir(false)
      return
    }

    setIsFetchingTafsir(true)
    setTafsirText('')

    const controller =
      new AbortController()

    const timeoutId =
      window.setTimeout(
        () => controller.abort(),
        12000
      )

    try {
      const params =
        new URLSearchParams({
          mode: 'ayah',
          surah: String(
            surahNumber
          ),
          ayah: String(
            ayahNumber
          ),
          book: String(
            book.id
          ),
        })

      const response =
        await fetch(
          `/api/tafsir?${params.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal:
              controller.signal,
            headers: {
              Accept:
                'application/json',
            },
          }
        )

      const data =
        await response.json().catch(
          () => null
        )

      if (!response.ok) {
        throw new Error(
          typeof data?.error ===
            'string'
            ? data.error
            : `HTTP ${response.status}`
        )
      }

      const text =
        typeof data?.text ===
        'string'
          ? data.text.trim()
          : ''

      if (!text) {
        throw new Error(
          'EMPTY_TAFSIR'
        )
      }

      const result = {
        text,
        book,
      }

      tafsirCacheRef.current.set(
        cacheKey,
        result
      )

      setTafsirText(text)
    } catch (error) {
      console.error(
        'Tafsir error:',
        error
      )

      setTafsirError(
        error instanceof DOMException &&
        error.name === 'AbortError'
          ? 'انتهى وقت الاتصال. اضغط إعادة المحاولة.'
          : 'تعذر جلب هذا التفسير حاليًا. تأكد من اتصال الإنترنت ثم أعد المحاولة.'
      )
    } finally {
      window.clearTimeout(
        timeoutId
      )
      setIsFetchingTafsir(
        false
      )
    }
  }

  const handleTafsirBookChange = (
    bookId: number
  ) => {
    setSelectedTafsirBookId(
      bookId
    )

    void fetchTafsir(
      bookId,
      false
    )
  }

  const getSelectedTafsirBookName =
    () => {
      if (
        selectedTafsirBookId ===
        null
      ) {
        return 'التفسير'
      }

      return (
        tafsirBooks.find(
          (book) =>
            book.id ===
            selectedTafsirBookId
        )?.name ||
        'التفسير'
      )
    }

  const closeTafsir = () => {
    setIsTafsirOpen(false)
    setTafsirError('')
    setTafsirCopied(false)
  }

  const copyTafsir = async () => {
    if (!tafsirText) return

    try {
      await navigator.clipboard.writeText(
        `سورة ${currentSurah} — الآية ${
          selectedAyah?.numberInSurah.toLocaleString(
            'ar-EG'
          ) || ''
        }\n\n${getSelectedTafsirBookName()}:\n${tafsirText}`
      )
      setTafsirCopied(
        true
      )
      window.setTimeout(
        () =>
          setTafsirCopied(
            false
          ),
        2000
      )
    } catch (error) {
      console.error(
        'Copy tafsir error:',
        error
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
      void fetchTafsir(
        undefined,
        true
      )
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
          >المصدر: ${escapeXml(
            getSelectedTafsirBookName()
          )}</text>
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
        ayah.key ===
        playingAyahKey
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
              <span className="text-sm font-black text-[#5a3b1b]">الرواية</span>
              <span className="text-[10px] text-[#8a7456]">نص قرآني مستقل</span>
            </div>

            <div className="relative max-w-xl mx-auto mb-3">
              <select
                value={selectedRiwayaId}
                onChange={handleRiwayaChange}
                disabled={isLoadingRiwaya}
                className="w-full appearance-none bg-[#fffaf0] border-2 border-[#b78945]/35 text-[#175e67] font-bold text-sm rounded-2xl py-3 pr-4 pl-11 shadow-sm outline-none focus:border-[#175e67] focus:ring-2 focus:ring-[#175e67]/10 cursor-pointer disabled:opacity-60"
              >
                {RIWAYAT.map((riwaya) => (
                  <option
                    key={riwaya.id}
                    value={riwaya.id}
                    disabled={!riwaya.available}
                  >
                    {riwaya.label}{!riwaya.available ? ' — غير متاحة بعد' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#b78945]" />
            </div>

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

            {riwayaError && (
              <p className="text-[10px] text-red-600 mt-2 text-center">{riwayaError}</p>
            )}

            {recitersError && (
              <p className="text-[10px] text-red-500 mt-2 text-center">{recitersError}</p>
            )}

            {resumeReady && user && (
              <p className="text-[10px] text-[#8a7456] mt-2 text-center">
                يتم حفظ آخر موضع قراءة تلقائيًا
              </p>
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
                          onClick={() => {
                            setSelectedAyah(ayah)
                            setLastReadAyah(ayah)
                            setIsTafsirOpen(false)
                            setTafsirError('')
                            setTafsirText('')
                            setTafsirCopied(false)
                          }}
                          className={`cursor-pointer transition-all duration-200 rounded-lg px-1 inline ${
                            selectedAyah?.key === ayah.key ||
                            playingAyahKey === ayah.key ||
                            lastReadAyah?.key === ayah.key
                              ? 'bg-[#c59a53]/20 shadow-sm'
                              : 'hover:bg-[#c59a53]/10'
                          }`}
                        >
                          {ayah.text}
                          <span
                            className={`text-[#b78945] mx-1 sm:mx-2 text-xl sm:text-2xl inline-flex items-center justify-center align-middle transition-transform ${
                              playingAyahKey === ayah.key ? 'scale-125' : ''
                            }`}
                          >
                            ﴿{ayah.numberInSurah.toLocaleString('ar-EG')}﴾
                          </span>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center gap-4 py-20">
                      <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 text-xl">
                        !
                      </div>
                      <div>
                        <p className="font-extrabold text-[#7f1d1d]">تعذر تحميل الصفحة</p>
                        <p className="text-xs text-[#8a7456] mt-1 max-w-md">
                          {riwayaError || 'حدث خطأ مؤقت أثناء تحميل بيانات المصحف.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchPage(currentPage, selectedRiwayaId)}
                        className="inline-flex items-center justify-center rounded-2xl bg-[#175e67] text-white px-5 py-2.5 text-sm font-bold shadow-sm hover:opacity-95 active:scale-[0.98] transition"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
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

              {/* تفسير */}

              <button
                type="button"
                onClick={() =>
                  void fetchTafsir()
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 bg-mushaf-paper text-emerald-700 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-all">
                  <FileText size={23} />
                </div>

                <span className="text-xs font-bold text-gray-600">
                  التفسير
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
          نافذة التفسير المتعدد
      ====================================================== */}

      {isTafsirOpen && selectedAyah && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="تفاسير الآية"
        >
          <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-hidden rounded-t-[30px] sm:rounded-[30px] bg-[#fffdf8] shadow-[0_25px_80px_rgba(0,0,0,0.28)] border border-[#b78945]/25">
            <div className="px-5 py-4 border-b border-[#eadfce] bg-gradient-to-l from-[#f5ecdc] to-[#fffdf8]">
              <div className="flex items-start justify-between gap-4">
                <div className="text-right min-w-0 flex-1">
                  <p className="text-[#175e67] font-extrabold text-lg">
                    تفاسير الآية
                  </p>

                  <p className="text-[#8a7456] text-xs mt-1">
                    سورة {currentSurah} · الآية{' '}
                    {selectedAyah.numberInSurah.toLocaleString(
                      'ar-EG'
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeTafsir}
                  className="w-10 h-10 shrink-0 rounded-full bg-white border border-[#eadfce] text-gray-500 hover:text-red-500 hover:border-red-200 transition flex items-center justify-center"
                  aria-label="إغلاق التفاسير"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="samee3-tafsir-book"
                  className="block text-right text-xs font-extrabold text-[#8a7456] mb-2"
                >
                  اختر كتاب التفسير
                </label>

                <div className="relative">
                  <select
                    id="samee3-tafsir-book"
                    value={
                      selectedTafsirBookId ??
                      ''
                    }
                    onChange={(event) =>
                      handleTafsirBookChange(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    disabled={
                      isLoadingTafsirBooks ||
                      !tafsirBooks.length
                    }
                    className="w-full appearance-none rounded-2xl border border-[#d9ccb9] bg-white px-4 py-3.5 pl-11 text-right text-sm font-bold text-[#175e67] outline-none transition focus:border-[#175e67] focus:ring-4 focus:ring-[#175e67]/10 disabled:opacity-60"
                    dir="rtl"
                  >
                    {isLoadingTafsirBooks ? (
                      <option value="">
                        جاري تحميل كتب التفسير...
                      </option>
                    ) : tafsirBooks.length ? (
                      tafsirBooks.map(
                        (book) => (
                          <option
                            key={
                              book.id
                            }
                            value={
                              book.id
                            }
                          >
                            {book.name}
                            {book.author
                              ? ` — ${book.author}`
                              : ''}
                          </option>
                        )
                      )
                    ) : (
                      <option value="">
                        لا توجد كتب متاحة
                      </option>
                    )}
                  </select>

                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a7456]"
                  />
                </div>

                {selectedTafsirBookId !==
                  null &&
                  !isLoadingTafsirBooks && (
                    <p className="mt-2 text-[11px] font-bold text-[#8a7456] text-right">
                      {getSelectedTafsirBookName()}
                      {tafsirBooks.length > 1
                        ? ` · متاح ${tafsirBooks.length.toLocaleString(
                            'ar-EG'
                          )} كتابًا لهذه السورة`
                        : ''}
                    </p>
                  )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(92vh-220px)] px-5 py-5 sm:px-7 sm:py-7">
              <div className="rounded-2xl border border-[#eadfce] bg-[#fcfbf8] p-4 sm:p-5">
                <p className="text-[#8a7456] text-xs font-bold mb-3">
                  نص الآية
                </p>

                <p
                  className="font-uthmani text-[#171717] text-[22px] sm:text-[27px] leading-[2.05] text-right"
                  dir="rtl"
                >
                  {selectedAyah.text}

                  <span className="text-[#b78945] mx-1.5">
                    ﴿
                    {selectedAyah.numberInSurah.toLocaleString(
                      'ar-EG'
                    )}
                    ﴾
                  </span>
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-[#dbe9e5] bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-[#eaf5f2] text-[#175e67] flex items-center justify-center">
                      <FileText size={18} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-extrabold text-[#175e67] truncate">
                        {getSelectedTafsirBookName()}
                      </h3>

                      <p className="text-[11px] text-[#8a7456] font-bold mt-0.5">
                        تفسير الآية المختارة
                      </p>
                    </div>
                  </div>

                  {isFetchingTafsir && (
                    <Loader2
                      className="animate-spin text-[#175e67] shrink-0"
                      size={22}
                    />
                  )}
                </div>

                {tafsirBooksError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center">
                    <p className="text-sm font-bold text-red-700">
                      {tafsirBooksError}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        void fetchTafsir()
                      }
                      className="mt-4 px-5 py-2.5 rounded-xl bg-[#175e67] text-white text-sm font-bold hover:opacity-90 transition"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : isFetchingTafsir ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <Loader2
                      className="animate-spin text-[#175e67]"
                      size={30}
                    />

                    <p className="text-sm text-gray-500 font-bold">
                      جاري تحميل {getSelectedTafsirBookName()}...
                    </p>
                  </div>
                ) : tafsirError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center">
                    <p className="text-sm font-bold text-red-700">
                      {tafsirError}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        void fetchTafsir(
                          selectedTafsirBookId ??
                            undefined
                        )
                      }
                      className="mt-4 px-5 py-2.5 rounded-xl bg-[#175e67] text-white text-sm font-bold hover:opacity-90 transition"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : (
                  <p
                    className="text-[#2f2f2f] text-[15px] sm:text-[17px] leading-[2.15] text-right whitespace-pre-wrap"
                    dir="rtl"
                  >
                    {tafsirText ||
                      'لم يتوفر نص لهذا الكتاب لهذه الآية حاليًا.'}
                  </p>
                )}
              </div>

              {!isFetchingTafsir &&
                !tafsirBooksError &&
                !tafsirError &&
                tafsirText && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#8a7456]">
                        المصدر
                      </p>

                      <p className="text-xs font-extrabold text-[#175e67] mt-1">
                        Quranpedia ·{' '}
                        {getSelectedTafsirBookName()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={copyTafsir}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#eadfce] bg-white px-4 py-2.5 text-xs font-bold text-[#175e67] hover:bg-[#f7f1e7] transition"
                    >
                      {tafsirCopied ? (
                        <CheckCheck
                          size={16}
                        />
                      ) : (
                        <Copy
                          size={16}
                        />
                      )}

                      {tafsirCopied
                        ? 'تم نسخ التفسير'
                        : 'نسخ التفسير'}
                    </button>
                  </div>
                )}
            </div>
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
                            المصدر: {getSelectedTafsirBookName()}
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
