"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ImageIcon,
  Loader2,
  Search,
  Share2,
  X,
} from 'lucide-react'

type HadithBook = {
  id: string
  name_ar: string
  name_en?: string
  category?: string
  hadithCount?: number
  author_ar?: string
  author_en?: string
}

type HadithChapter = {
  id: string | number
  name_ar?: string
  name_en?: string
  hadithCount?: number
  firstHadith?: number
  lastHadith?: number
}

type Hadith = {
  id: number
  idInBook?: number
  chapterId?: number
  bookId?: number
  arabic?: string
  english?: {
    narrator?: string
    text?: string
  }
}

type SelectedBook = HadithBook | null

type ResumeState = {
  bookId: string
  chapterId: string | number
  hadithId: number
  savedAt: number
}

const API_BASE = '/api/hadith'
const REMOTE_DOCS_URL = 'https://alfurqan.online/docs'
const FAVORITES_KEY = 'samee3_hadith_favorites'
const RESUME_KEY = 'samee3_hadith_resume'

const FALLBACK_BOOKS: HadithBook[] = [
  { id: 'bukhari', name_ar: 'صحيح البخاري', name_en: 'Sahih al-Bukhari', category: 'الكتب التسعة' },
  { id: 'muslim', name_ar: 'صحيح مسلم', name_en: 'Sahih Muslim', category: 'الكتب التسعة' },
  { id: 'abudawud', name_ar: 'سنن أبي داود', name_en: 'Sunan Abu Dawud', category: 'الكتب التسعة' },
  { id: 'nasai', name_ar: 'سنن النسائي', name_en: "Sunan an-Nasa'i", category: 'الكتب التسعة' },
  { id: 'tirmidhi', name_ar: 'جامع الترمذي', name_en: "Jami at-Tirmidhi", category: 'الكتب التسعة' },
  { id: 'ibnmajah', name_ar: 'سنن ابن ماجه', name_en: 'Sunan Ibn Majah', category: 'الكتب التسعة' },
  { id: 'malik', name_ar: 'موطأ مالك', name_en: 'Muwatta Malik', category: 'الكتب التسعة' },
  { id: 'darimi', name_ar: 'سنن الدارمي', name_en: 'Sunan ad-Darimi', category: 'الكتب التسعة' },
  { id: 'ahmed', name_ar: 'مسند أحمد', name_en: 'Musnad Ahmad', category: 'الكتب التسعة' },
  { id: 'nawawi40', name_ar: 'الأربعون النووية', name_en: "An-Nawawi's Forty Hadith", category: 'الأربعينات' },
  { id: 'qudsi40', name_ar: 'الأربعون حديثًا قدسيًا', name_en: 'Forty Hadith Qudsi', category: 'الأربعينات' },
  { id: 'shahwaliullah40', name_ar: 'أربعون الشاه ولي الله الدهلوي', name_en: "Shah Waliullah's Forty Hadith", category: 'الأربعينات' },
  { id: 'riyad_assalihin', name_ar: 'رياض الصالحين', name_en: 'Riyad as-Salihin', category: 'كتب أخرى' },
  { id: 'mishkat_almasabih', name_ar: 'مشكاة المصابيح', name_en: 'Mishkat al-Masabih', category: 'كتب أخرى' },
  { id: 'bulugh_almaram', name_ar: 'بلوغ المرام', name_en: 'Bulugh al-Maram', category: 'كتب أخرى' },
  { id: 'aladab_almufrad', name_ar: 'الأدب المفرد', name_en: 'Al-Adab Al-Mufrad', category: 'كتب أخرى' },
  { id: 'shamail_muhammadiyah', name_ar: 'الشمائل المحمدية', name_en: 'Shamail Muhammadiyah', category: 'كتب أخرى' },
]

const BOOK_CATEGORY_ORDER = ['الكتب التسعة', 'الأربعينات', 'كتب أخرى']

function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
}

function normalizeBookCategory(category: unknown) {
  const value = String(category || '').trim().toLowerCase()

  if (
    value === 'the_9_books' ||
    value === 'the 9 books' ||
    value === 'nine books' ||
    value === 'الكتب التسعة'
  ) {
    return 'الكتب التسعة'
  }

  if (
    value === 'forties' ||
    value === 'forty hadith' ||
    value === 'the forties' ||
    value === 'الأربعينات'
  ) {
    return 'الأربعينات'
  }

  return 'كتب أخرى'
}

function getBookDisplayCount(book: HadithBook) {
  if (!book.hadithCount || book.hadithCount < 1) return null
  return `${arabicDigits(book.hadithCount)} حديث`
}

function extractBooks(payload: unknown): HadithBook[] {
  const data = payload as any
  const source = data?.books || data?.data?.books || data?.collections || data?.data || []

  if (!Array.isArray(source)) return []

  return source
    .map((book: any) => ({
      id: String(book.id || book.bookId || book.slug || ''),
      name_ar: String(
        book.name_ar ||
          book.nameArabic ||
          book.arabicName ||
          book.arabic?.name ||
          book.name ||
          ''
      ),
      name_en:
        book.name_en ||
        book.nameEnglish ||
        book.englishName ||
        book.english?.name ||
        '',
      category: normalizeBookCategory(
        book.category || book.category_id || book.group || book.collection
      ),
      hadithCount: Number(
        book.hadithCount ??
          book.hadith_count ??
          book.numberOfHadith ??
          book.total_hadiths ??
          book.count ??
          0
      ),
      author_ar: book.author_ar || book.authorArabic || '',
      author_en: book.author_en || book.authorEnglish || '',
    }))
    .filter((book: HadithBook) => book.id && book.name_ar)
}

function extractChapters(payload: unknown): HadithChapter[] {
  const data = payload as any
  const source = data?.chapters || data?.data?.chapters || data?.book?.chapters || []

  if (!Array.isArray(source)) return []

  return source
    .map((chapter: any, index: number) => {
      const range = Array.isArray(chapter.hadith_range) ? chapter.hadith_range : []
      const id = chapter.id ?? chapter.chapterId ?? chapter.number ?? index + 1

      return {
        id,
        name_ar:
          chapter.name_ar ||
          chapter.nameArabic ||
          chapter.arabicName ||
          chapter.arabic ||
          chapter.name ||
          '',
        name_en:
          chapter.name_en ||
          chapter.nameEnglish ||
          chapter.english ||
          '',
        hadithCount: Number(
          chapter.hadithCount ?? chapter.hadith_count ?? chapter.count ?? 0
        ),
        firstHadith: Number(
          chapter.firstHadith ??
            chapter.first_hadith ??
            chapter.start ??
            chapter.startHadith ??
            range[0] ??
            0
        ),
        lastHadith: Number(
          chapter.lastHadith ??
            chapter.last_hadith ??
            chapter.end ??
            chapter.endHadith ??
            range[1] ??
            0
        ),
      }
    })
    .filter((chapter: HadithChapter) => chapter.id !== undefined && chapter.id !== null)
}

function extractHadiths(payload: unknown): Hadith[] {
  const data = payload as any
  const source = data?.hadiths || data?.data?.hadiths || data?.data || []

  if (!Array.isArray(source)) return []

  return source
    .map((hadith: any) => ({
      id: Number(hadith.id ?? hadith.idInBook ?? hadith.number ?? 0),
      idInBook: Number(hadith.idInBook ?? hadith.number ?? hadith.id ?? 0),
      chapterId: Number(hadith.chapterId ?? hadith.chapter_id ?? 0),
      bookId: Number(hadith.bookId ?? hadith.book_id ?? 0),
      arabic: hadith.arabic || hadith.arab || hadith.text_ar || hadith.text || '',
      english: {
        narrator: hadith.english?.narrator || hadith.narrator || '',
        text: hadith.english?.text || hadith.text_en || '',
      },
    }))
    .filter((hadith: Hadith) => hadith.id > 0)
}

function getShareText(book: HadithBook, hadith: Hadith) {
  const number = hadith.idInBook || hadith.id
  return `${hadith.arabic || ''}\n\n${book.name_ar} — حديث ${arabicDigits(number)}`
}

function getFavoriteKey(book: HadithBook, hadith: Hadith) {
  return `${book.id}:${hadith.idInBook || hadith.id}`
}

function VolumeIcon() {
  return <span className="text-lg leading-none">🔊</span>
}

function PauseIcon() {
  return <span className="text-base font-black tracking-[2px]">Ⅱ</span>
}

export default function HadithPage() {
  const [books, setBooks] = useState<HadithBook[]>(FALLBACK_BOOKS)
  const [selectedBook, setSelectedBook] = useState<SelectedBook>(null)
  const [chapters, setChapters] = useState<HadithChapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string | number | null>(null)
  const [hadiths, setHadiths] = useState<Hadith[]>([])
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null)

  const [bookSearch, setBookSearch] = useState('')
  const [chapterSearch, setChapterSearch] = useState('')
  const [hadithSearch, setHadithSearch] = useState('')

  const [booksLoading, setBooksLoading] = useState(true)
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [hadithsLoading, setHadithsLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookError, setBookError] = useState('')

  const [copied, setCopied] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [isReadingAudio, setIsReadingAudio] = useState(false)
  const [audioRate, setAudioRate] = useState(1)
  const [designUrl, setDesignUrl] = useState<string | null>(null)
  const [designLoading, setDesignLoading] = useState(false)
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)

  const audioUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const fetchJson = useCallback(async (url: string) => {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    const text = await response.text()
    let payload: any = null

    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      throw new Error('استجابة غير صالحة من مصدر الأحاديث.')
    }

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`)
    }

    return payload
  }, [])

  const loadBooks = useCallback(async () => {
    setBooksLoading(true)
    setBookError('')

    try {
      const payload = await fetchJson(`${API_BASE}/list`)
      const remoteBooks = extractBooks(payload)

      if (remoteBooks.length) {
        setBooks(remoteBooks)
      } else {
        setBookError('تعذر قراءة قائمة الكتب من مصدر البيانات؛ تم استخدام القائمة الاحتياطية.')
      }
    } catch (err) {
      console.error('Hadith books error:', err)
      setBookError('تعذر الاتصال بمصدر كتب الحديث حاليًا؛ تظهر لك القائمة الاحتياطية.')
    } finally {
      setBooksLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    loadBooks()

    try {
      const rawFavorites = localStorage.getItem(FAVORITES_KEY)
      const parsedFavorites = rawFavorites ? JSON.parse(rawFavorites) : []
      if (Array.isArray(parsedFavorites)) setFavoriteIds(parsedFavorites)
    } catch {
      setFavoriteIds([])
    }

    try {
      const rawResume = localStorage.getItem(RESUME_KEY)
      const parsedResume = rawResume ? JSON.parse(rawResume) : null
      if (
        parsedResume &&
        typeof parsedResume === 'object' &&
        parsedResume.bookId &&
        parsedResume.chapterId !== undefined &&
        parsedResume.hadithId
      ) {
        setResumeState(parsedResume as ResumeState)
      }
    } catch {
      setResumeState(null)
    }
  }, [loadBooks])

  const loadBookChapters = useCallback(async (book: HadithBook) => {
    setChaptersLoading(true)
    setHadithsLoading(false)
    setError('')
    setBookError('')
    setChapters([])
    setHadiths([])
    setSelectedChapterId(null)
    setSelectedHadith(null)
    setChapterSearch('')
    setHadithSearch('')

    try {
      const payload = await fetchJson(`${API_BASE}/${encodeURIComponent(book.id)}`)
      const nextChapters = extractChapters(payload)
      const totalHadiths = Number(payload?.total_hadiths ?? payload?.book?.total_hadiths ?? 0)

      if (!nextChapters.length) {
        throw new Error('No chapters found')
      }

      const updatedBook: HadithBook = {
        ...book,
        hadithCount:
          book.hadithCount && book.hadithCount > 0
            ? book.hadithCount
            : totalHadiths > 0
              ? totalHadiths
              : book.hadithCount,
        name_ar: payload?.book?.name_ar || book.name_ar,
        name_en: payload?.book?.name_en || book.name_en,
        category: normalizeBookCategory(payload?.book?.category || book.category),
        author_ar: payload?.book?.author_ar || book.author_ar,
        author_en: payload?.book?.author_en || book.author_en,
      }

      setSelectedBook(updatedBook)
      setBooks((current) =>
        current.map((item) => (item.id === updatedBook.id ? updatedBook : item))
      )
      setChapters(nextChapters)

      const savedChapter = resumeState?.bookId === book.id ? resumeState.chapterId : null
      const chapterToOpen =
        savedChapter !== null &&
        nextChapters.some((chapter) => String(chapter.id) === String(savedChapter))
          ? savedChapter
          : nextChapters[0].id

      setSelectedChapterId(chapterToOpen)
    } catch (err) {
      console.error('Hadith chapters error:', err)
      setError('تعذر تحميل أبواب هذا الكتاب حاليًا.')
    } finally {
      setChaptersLoading(false)
    }
  }, [fetchJson, resumeState])

  const loadChapterHadiths = useCallback(
    async (book: HadithBook, chapterId: string | number) => {
      setHadithsLoading(true)
      setError('')
      setHadiths([])
      setSelectedHadith(null)

      try {
        const payload = await fetchJson(
          `${API_BASE}/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(String(chapterId))}`
        )
        const nextHadiths = extractHadiths(payload)
        setHadiths(nextHadiths)

        if (!nextHadiths.length) {
          setError('لم يتم العثور على أحاديث في هذا الباب.')
          return
        }

        const savedHadithId =
          resumeState?.bookId === book.id &&
          String(resumeState.chapterId) === String(chapterId)
            ? resumeState.hadithId
            : null

        if (savedHadithId) {
          const savedHadith = nextHadiths.find(
            (hadith) => (hadith.idInBook || hadith.id) === savedHadithId
          )
          if (savedHadith) {
            setSelectedHadith(savedHadith)
          }
        }
      } catch (err) {
        console.error('Hadith chapter error:', err)
        setError('تعذر تحميل أحاديث الباب حاليًا.')
      } finally {
        setHadithsLoading(false)
      }
    },
    [fetchJson, resumeState]
  )

  useEffect(() => {
    if (selectedBook && selectedChapterId !== null) {
      loadChapterHadiths(selectedBook, selectedChapterId)
    }
  }, [selectedBook, selectedChapterId, loadChapterHadiths])

  const filteredBooks = useMemo(() => {
    const query = normalizeArabic(bookSearch.trim())
    if (!query) return books

    return books.filter((book) =>
      normalizeArabic(`${book.name_ar} ${book.name_en || ''} ${book.author_ar || ''}`).includes(query)
    )
  }, [bookSearch, books])

  const groupedBooks = useMemo(() => {
    const knownGroups = BOOK_CATEGORY_ORDER.map((category) => ({
      category,
      books: filteredBooks.filter((book) => (book.category || 'كتب أخرى') === category),
    })).filter((group) => group.books.length)

    const uncategorized = filteredBooks.filter(
      (book) => !BOOK_CATEGORY_ORDER.includes(book.category || '')
    )

    if (uncategorized.length) {
      knownGroups.push({ category: 'كتب أخرى', books: uncategorized })
    }

    return knownGroups
  }, [filteredBooks])

  const filteredChapters = useMemo(() => {
    const query = normalizeArabic(chapterSearch.trim())
    if (!query) return chapters

    return chapters.filter((chapter) =>
      normalizeArabic(`${chapter.name_ar || ''} ${chapter.name_en || ''} ${chapter.id}`).includes(query)
    )
  }, [chapterSearch, chapters])

  const filteredHadiths = useMemo(() => {
    const query = normalizeArabic(hadithSearch.trim())
    if (!query) return hadiths

    return hadiths.filter((hadith) =>
      normalizeArabic(
        `${hadith.arabic || ''} ${hadith.english?.narrator || ''} ${hadith.english?.text || ''} ${hadith.idInBook || hadith.id}`
      ).includes(query)
    )
  }, [hadithSearch, hadiths])

  const currentChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)),
    [chapters, selectedChapterId]
  )

  const currentHadithIndex = useMemo(() => {
    if (!selectedHadith) return -1
    const number = selectedHadith.idInBook || selectedHadith.id
    return hadiths.findIndex((hadith) => (hadith.idInBook || hadith.id) === number)
  }, [hadiths, selectedHadith])

  const openHadith = useCallback(
    (hadith: Hadith) => {
      if (!selectedBook || selectedChapterId === null) return
      const key = getFavoriteKey(selectedBook, hadith)
      setSelectedHadith(hadith)

      const nextResume: ResumeState = {
        bookId: selectedBook.id,
        chapterId: selectedChapterId,
        hadithId: hadith.idInBook || hadith.id,
        savedAt: Date.now(),
      }

      setResumeState(nextResume)
      localStorage.setItem(RESUME_KEY, JSON.stringify(nextResume))

      if (favoriteIds.includes(key)) {
        setFavoriteIds((current) => current)
      }
    },
    [favoriteIds, selectedBook, selectedChapterId]
  )

  const selectBook = (book: HadithBook) => {
    setSelectedBook(book)
    setBookSearch('')
    loadBookChapters(book)
  }

  const selectChapter = (chapterId: string | number) => {
    stopHadithAudio()
    setSelectedChapterId(chapterId)
    setHadithSearch('')
  }

  const goToHadith = (direction: -1 | 1) => {
    if (currentHadithIndex < 0) return
    const target = hadiths[currentHadithIndex + direction]
    if (target) openHadith(target)
  }

  const copyHadith = async () => {
    if (!selectedBook || !selectedHadith) return

    try {
      await navigator.clipboard.writeText(getShareText(selectedBook, selectedHadith))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error('Copy hadith error:', err)
    }
  }

  const shareHadith = async () => {
    if (!selectedBook || !selectedHadith) return

    const text = getShareText(selectedBook, selectedHadith)

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedBook.name_ar,
          text,
        })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      }
    } catch (err) {
      console.error('Share hadith error:', err)
    }
  }

  const toggleFavorite = () => {
    if (!selectedBook || !selectedHadith) return

    const key = getFavoriteKey(selectedBook, selectedHadith)
    const exists = favoriteIds.includes(key)
    const next = exists
      ? favoriteIds.filter((item) => item !== key)
      : [...favoriteIds, key]

    setFavoriteIds(next)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }

  const selectedIsFavorite =
    selectedBook && selectedHadith
      ? favoriteIds.includes(getFavoriteKey(selectedBook, selectedHadith))
      : false

  const stopHadithAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    audioUtteranceRef.current = null
    setIsReadingAudio(false)
  }

  const speakHadith = () => {
    if (
      !selectedHadith?.arabic ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return
    }

    if (isReadingAudio) {
      stopHadithAudio()
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(selectedHadith.arabic)
    utterance.lang = 'ar-SA'
    utterance.rate = audioRate
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => {
      setIsReadingAudio(true)
    }
    utterance.onend = () => {
      audioUtteranceRef.current = null
      setIsReadingAudio(false)
    }
    utterance.onerror = () => {
      audioUtteranceRef.current = null
      setIsReadingAudio(false)
    }

    audioUtteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const designHadithAsImage = async () => {
    if (!selectedBook || !selectedHadith?.arabic) return

    setDesignLoading(true)

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')

      const width = 1080
      const padding = 90
      const maxTextWidth = width - padding * 2
      const text = selectedHadith.arabic.replace(/\s+/g, ' ').trim()

      ctx.direction = 'rtl'
      ctx.textAlign = 'center'
      ctx.font = 'bold 52px serif'

      const words = text.split(' ')
      const lines: string[] = []
      let current = ''

      for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (ctx.measureText(test).width <= maxTextWidth) {
          current = test
        } else {
          if (current) lines.push(current)
          current = word
        }
      }
      if (current) lines.push(current)

      const lineHeight = 88
      const height = Math.max(900, 260 + lines.length * lineHeight + 220)
      canvas.width = width
      canvas.height = height

      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#0D383E')
      bg.addColorStop(0.55, '#175E67')
      bg.addColorStop(1, '#102F33')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      const glow = ctx.createRadialGradient(150, 130, 10, 150, 130, 330)
      glow.addColorStop(0, 'rgba(217,119,6,0.24)')
      glow.addColorStop(1, 'rgba(217,119,6,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = 'rgba(217,119,6,0.55)'
      ctx.lineWidth = 3
      ctx.strokeRect(38, 38, width - 76, height - 76)

      ctx.fillStyle = '#D97706'
      ctx.font = 'bold 34px Arial'
      ctx.fillText('مصحف سَميع', width / 2, 95)

      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.font = 'bold 25px Arial'
      ctx.fillText(selectedBook.name_ar, width / 2, 145)

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 52px serif'
      const startY = 245
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight)
      })

      const dividerY = startY + lines.length * lineHeight + 40
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(padding, dividerY)
      ctx.lineTo(width - padding, dividerY)
      ctx.stroke()

      ctx.fillStyle = '#D97706'
      ctx.font = 'bold 25px Arial'
      ctx.fillText(
        `حديث ${selectedHadith.idInBook || selectedHadith.id}`,
        width / 2,
        dividerY + 55
      )

      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.font = '20px Arial'
      ctx.fillText('تصميم حديث بواسطة مصحف سَميع', width / 2, dividerY + 100)

      const url = canvas.toDataURL('image/png')
      setDesignUrl(url)

      const link = document.createElement('a')
      link.download = `samee3-hadith-${selectedBook.id}-${selectedHadith.idInBook || selectedHadith.id}.png`
      link.href = url
      link.click()
    } catch (error) {
      console.error('Hadith image design error:', error)
    } finally {
      setDesignLoading(false)
    }
  }

  const closeBook = () => {
    stopHadithAudio()
    setSelectedBook(null)
    setChapters([])
    setHadiths([])
    setSelectedChapterId(null)
    setSelectedHadith(null)
    setChapterSearch('')
    setHadithSearch('')
    setError('')
  }

  const resumeBook = useMemo(() => {
    if (!resumeState) return null
    return books.find((book) => book.id === resumeState.bookId) || null
  }, [books, resumeState])

  const resumeLabel = resumeState
    ? `حديث ${arabicDigits(resumeState.hadithId)}`
    : ''

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-32" dir="rtl">
      <header className="sticky top-0 z-30 bg-mushaf-paper/95 backdrop-blur-md border-b border-mushaf-border/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-mushaf-teal"
            aria-label="العودة للرئيسية"
          >
            <ChevronRight size={24} />
          </Link>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="text-mushaf-gold" size={22} />
              <h1 className="font-bold text-xl text-mushaf-dark">مكتبة الأحاديث</h1>
            </div>
            <p className="text-xs text-gray-500 mt-1">كتب الحديث وتصفح الأبواب والأحاديث في مكان واحد</p>
          </div>

          <div className="w-11" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-6">
        {!selectedBook ? (
          <>
            <section className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl border border-mushaf-gold/20 relative overflow-hidden">
              <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute -bottom-20 -right-10 w-60 h-60 rounded-full bg-mushaf-gold/5 blur-3xl" />

              <div className="relative z-10 max-w-3xl">
                <p className="text-mushaf-gold font-bold text-sm mb-2">موسوعة الحديث</p>
                <h2 className="font-uthmani text-3xl sm:text-4xl leading-relaxed">
                  تصفح كتب الحديث، ثم انتقل إلى الباب والحديث مباشرة.
                </h2>
                <p className="text-white/70 text-sm leading-relaxed mt-4">
                  يتم تحميل الكتاب والباب عند الحاجة حتى تبقى الصفحة خفيفة، مع الاحتفاظ بالمفضلة وآخر موضع قراءة على جهازك.
                </p>
              </div>
            </section>

            {resumeBook && (
              <button
                onClick={() => selectBook(resumeBook)}
                className="mt-5 w-full text-right bg-white rounded-3xl border border-mushaf-gold/30 shadow-sm p-5 hover:shadow-md transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-gold flex items-center justify-center shrink-0">
                    <Bookmark size={24} fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400">متابعة آخر قراءة</p>
                    <h3 className="font-bold text-mushaf-dark mt-1 truncate">{resumeBook.name_ar}</h3>
                    <p className="text-xs text-gray-500 mt-1">{resumeLabel}</p>
                  </div>
                  <ChevronLeft className="text-mushaf-gold" size={22} />
                </div>
              </button>
            )}

            <section className="mt-6">
              <div className="bg-white rounded-2xl border border-mushaf-border/40 shadow-sm px-4 py-3 flex items-center gap-3">
                <Search size={20} className="text-mushaf-teal shrink-0" />
                <input
                  value={bookSearch}
                  onChange={(event) => setBookSearch(event.target.value)}
                  placeholder="ابحث عن كتاب حديث..."
                  className="w-full outline-none bg-transparent text-sm font-bold text-mushaf-dark placeholder:text-gray-400"
                />
                {bookSearch && (
                  <button onClick={() => setBookSearch('')} className="text-gray-400 hover:text-mushaf-teal" aria-label="مسح البحث">
                    <X size={18} />
                  </button>
                )}
              </div>
            </section>

            {bookError && (
              <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl p-4 text-sm font-bold">
                {bookError}
              </div>
            )}

            <section className="mt-8">
              {booksLoading ? (
                <div className="py-16 flex flex-col items-center gap-3 text-mushaf-teal">
                  <Loader2 className="animate-spin" size={34} />
                  <span className="font-bold">جاري تحميل كتب الحديث...</span>
                </div>
              ) : groupedBooks.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-gray-300 py-14 text-center text-gray-400 font-bold">
                  لا يوجد كتاب مطابق للبحث
                </div>
              ) : (
                <div className="space-y-8">
                  {groupedBooks.map((group) => (
                    <div key={group.category}>
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <h2 className="font-bold text-xl text-mushaf-dark">{group.category}</h2>
                          <p className="text-xs text-gray-500 mt-1">{arabicDigits(group.books.length)} كتب</p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.books.map((book) => (
                          <button
                            key={book.id}
                            onClick={() => selectBook(book)}
                            className="bg-white rounded-3xl p-5 border border-mushaf-border/30 shadow-sm hover:border-mushaf-teal hover:shadow-md transition-all text-right group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-mushaf-paper border border-mushaf-gold/30 text-mushaf-gold flex items-center justify-center shrink-0">
                                <BookOpen size={28} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-mushaf-dark text-lg group-hover:text-mushaf-teal transition">
                                  {book.name_ar}
                                </h3>
                                {book.author_ar && (
                                  <p className="text-xs text-gray-400 mt-1 truncate">{book.author_ar}</p>
                                )}
                                {getBookDisplayCount(book) && (
                                  <p className="text-xs text-gray-500 mt-1">{getBookDisplayCount(book)}</p>
                                )}
                              </div>

                              <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 transition" size={22} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="bg-white rounded-[2rem] border border-mushaf-border/40 shadow-sm p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <button onClick={closeBook} className="flex items-center gap-2 text-mushaf-teal font-bold text-sm">
                  <ArrowRight size={18} />
                  كل الكتب
                </button>

                <div className="text-right">
                  <p className="text-xs text-gray-400">الكتاب المحدد</p>
                  <h2 className="font-bold text-xl text-mushaf-dark">{selectedBook.name_ar}</h2>
                  <div className="flex flex-wrap gap-2 mt-2 justify-end">
                    {selectedBook.author_ar && (
                      <span className="bg-mushaf-paper text-gray-500 rounded-full px-3 py-1 text-[11px] font-bold">{selectedBook.author_ar}</span>
                    )}
                    {selectedBook.hadithCount ? (
                      <span className="bg-mushaf-paper text-mushaf-teal rounded-full px-3 py-1 text-[11px] font-bold">{arabicDigits(selectedBook.hadithCount)} حديث</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid lg:grid-cols-[300px_1fr] gap-5 mt-5">
              <aside className="bg-white rounded-3xl border border-mushaf-border/40 shadow-sm p-4 h-fit lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-mushaf-dark">الأبواب</h3>
                    <p className="text-[11px] text-gray-400">{arabicDigits(chapters.length)} باب</p>
                  </div>
                </div>

                <div className="bg-mushaf-paper rounded-2xl px-3 py-2 flex items-center gap-2 mb-3">
                  <Search size={16} className="text-mushaf-teal shrink-0" />
                  <input
                    value={chapterSearch}
                    onChange={(event) => setChapterSearch(event.target.value)}
                    placeholder="ابحث في الأبواب..."
                    className="w-full bg-transparent outline-none text-xs font-bold text-mushaf-dark placeholder:text-gray-400"
                  />
                </div>

                {chaptersLoading ? (
                  <div className="py-10 flex justify-center text-mushaf-teal">
                    <Loader2 className="animate-spin" size={28} />
                  </div>
                ) : filteredChapters.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs font-bold">لا يوجد باب مطابق</div>
                ) : (
                  <div className="max-h-[65vh] overflow-y-auto space-y-2 pr-1">
                    {filteredChapters.map((chapter) => {
                      const active = String(selectedChapterId) === String(chapter.id)

                      return (
                        <button
                          key={String(chapter.id)}
                          onClick={() => selectChapter(chapter.id)}
                          className={`w-full text-right p-3 rounded-2xl border transition ${
                            active
                              ? 'bg-mushaf-teal text-white border-mushaf-teal shadow-sm'
                              : 'bg-white text-mushaf-dark border-gray-100 hover:border-mushaf-teal/40 hover:bg-mushaf-paper'
                          }`}
                        >
                          <p className="font-bold text-sm leading-relaxed">
                            {chapter.name_ar || `الباب ${arabicDigits(chapter.id)}`}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {chapter.hadithCount ? (
                              <p className={`text-[10px] ${active ? 'text-white/70' : 'text-gray-400'}`}>
                                {arabicDigits(chapter.hadithCount)} حديث
                              </p>
                            ) : null}
                            {chapter.firstHadith && chapter.lastHadith ? (
                              <p className={`text-[10px] ${active ? 'text-white/50' : 'text-gray-300'}`}>
                                {arabicDigits(chapter.firstHadith)}–{arabicDigits(chapter.lastHadith)}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </aside>

              <section className="min-w-0">
                <div className="bg-white rounded-3xl border border-mushaf-border/40 shadow-sm p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">الباب الحالي</p>
                      <h3 className="font-bold text-lg text-mushaf-dark mt-1">
                        {currentChapter?.name_ar || `الباب ${arabicDigits(selectedChapterId || 1)}`}
                      </h3>
                    </div>

                    <div className="bg-mushaf-paper text-mushaf-teal rounded-xl px-3 py-2 text-xs font-bold">
                      {arabicDigits(filteredHadiths.length)} حديث ظاهر
                    </div>
                  </div>

                  <div className="mt-4 bg-mushaf-paper rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Search size={19} className="text-mushaf-teal shrink-0" />
                    <input
                      value={hadithSearch}
                      onChange={(event) => setHadithSearch(event.target.value)}
                      placeholder="ابحث في أحاديث الباب أو برقم الحديث..."
                      className="w-full outline-none bg-transparent text-sm font-bold text-mushaf-dark placeholder:text-gray-400"
                    />
                    {hadithSearch && (
                      <button onClick={() => setHadithSearch('')} className="text-gray-400 hover:text-mushaf-teal" aria-label="مسح البحث">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {hadithsLoading ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-mushaf-teal">
                    <Loader2 className="animate-spin" size={36} />
                    <p className="font-bold">جاري تحميل الأحاديث...</p>
                  </div>
                ) : error ? (
                  <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-center font-bold text-sm">
                    {error}
                  </div>
                ) : filteredHadiths.length === 0 ? (
                  <div className="mt-4 bg-white rounded-3xl border border-dashed border-gray-300 py-14 text-center text-gray-400 font-bold">
                    لا توجد نتائج مطابقة
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {filteredHadiths.map((hadith) => {
                      const number = hadith.idInBook || hadith.id
                      const isFavorite = selectedBook
                        ? favoriteIds.includes(getFavoriteKey(selectedBook, hadith))
                        : false

                      return (
                        <article
                          key={`${selectedBook.id}-${number}`}
                          className="bg-white rounded-3xl border border-mushaf-border/30 shadow-sm p-5 sm:p-6 hover:border-mushaf-gold/50 transition"
                        >
                          <div className="flex items-center justify-between gap-3 mb-5">
                            <span className="bg-mushaf-paper text-mushaf-gold px-3 py-1.5 rounded-full text-xs font-black">
                              حديث {arabicDigits(number)}
                            </span>

                            <div className="flex items-center gap-2">
                              {isFavorite && (
                                <span className="w-9 h-9 rounded-xl bg-mushaf-gold/10 text-mushaf-gold flex items-center justify-center" title="محفوظ">
                                  <Bookmark size={16} fill="currentColor" />
                                </span>
                              )}
                              <button
                                onClick={() => openHadith(hadith)}
                                className="text-mushaf-teal bg-mushaf-teal/5 hover:bg-mushaf-teal/10 rounded-xl px-3 py-2 text-xs font-bold"
                              >
                                عرض كامل
                              </button>
                            </div>
                          </div>

                          <p className="font-uthmani text-2xl leading-[2.1] text-mushaf-dark text-justify" dir="rtl">
                            {hadith.arabic || 'لم يتوفر النص العربي لهذا الحديث.'}
                          </p>

                          {hadith.english?.narrator && (
                            <p className="mt-4 text-xs text-gray-500 font-bold">
                              الراوي: {hadith.english.narrator}
                            </p>
                          )}

                          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                            <button
                              onClick={() => openHadith(hadith)}
                              className="px-4 py-2.5 rounded-xl bg-mushaf-teal text-white text-xs font-bold"
                            >
                              تفاصيل الحديث
                            </button>
                            <button
                              onClick={async () => {
                                if (!selectedBook) return
                                try {
                                  await navigator.clipboard.writeText(getShareText(selectedBook, hadith))
                                } catch (copyError) {
                                  console.error(copyError)
                                }
                              }}
                              className="px-4 py-2.5 rounded-xl bg-mushaf-paper text-mushaf-teal text-xs font-bold"
                            >
                              نسخ
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {selectedHadith && selectedBook && (
        <div
          className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            stopHadithAudio()
            setSelectedHadith(null)
          }}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl border border-mushaf-gold/20 flex flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-mushaf-gold font-bold mb-1">{selectedBook.name_ar}</p>
                <h2 className="font-bold text-lg text-mushaf-dark">
                  حديث {arabicDigits(selectedHadith.idInBook || selectedHadith.id)}
                </h2>
                {currentChapter?.name_ar && (
                  <p className="text-xs text-gray-400 mt-1">{currentChapter.name_ar}</p>
                )}
              </div>

              <button
                onClick={() => {
                  stopHadithAudio()
                  setSelectedHadith(null)
                }}
                className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="rounded-[1.5rem] bg-mushaf-paper border border-mushaf-gold/20 p-5 sm:p-7">
                <p className="font-uthmani text-2xl leading-[2.25] text-mushaf-dark text-justify" dir="rtl">
                  {selectedHadith.arabic || 'لم يتوفر النص العربي لهذا الحديث.'}
                </p>
              </div>

              {selectedHadith.english?.narrator && (
                <div className="mt-5 p-4 rounded-2xl bg-white border border-gray-100 text-sm text-gray-600 leading-relaxed">
                  <span className="font-bold text-mushaf-dark">الراوي: </span>
                  {selectedHadith.english.narrator}
                </div>
              )}

              {selectedHadith.english?.text && (
                <details className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <summary className="cursor-pointer font-bold text-sm text-mushaf-dark">الترجمة الإنجليزية</summary>
                  <p className="mt-3 text-sm text-gray-600 leading-7" dir="ltr">
                    {selectedHadith.english.text}
                  </p>
                </details>
              )}

              <div className="grid sm:grid-cols-3 gap-3 mt-5">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400">رقم الحديث</p>
                  <p className="font-bold text-sm text-mushaf-dark mt-1">{arabicDigits(selectedHadith.idInBook || selectedHadith.id)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400">الباب</p>
                  <p className="font-bold text-sm text-mushaf-dark mt-1 truncate">{currentChapter?.name_ar || '—'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400">الكتاب</p>
                  <p className="font-bold text-sm text-mushaf-dark mt-1 truncate">{selectedBook.name_ar}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  disabled={currentHadithIndex <= 0}
                  onClick={() => goToHadith(-1)}
                  className="flex-1 rounded-xl bg-mushaf-paper text-mushaf-teal py-3 font-bold text-xs disabled:opacity-40"
                >
                  <ChevronRight size={16} className="inline-block align-middle ml-1" />
                  السابق
                </button>
                <button
                  disabled={currentHadithIndex < 0 || currentHadithIndex >= hadiths.length - 1}
                  onClick={() => goToHadith(1)}
                  className="flex-1 rounded-xl bg-mushaf-paper text-mushaf-teal py-3 font-bold text-xs disabled:opacity-40"
                >
                  التالي
                  <ChevronLeft size={16} className="inline-block align-middle mr-1" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={speakHadith}
                  className={`flex-1 min-w-[150px] rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 ${
                    isReadingAudio
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : 'bg-mushaf-teal text-white'
                  }`}
                >
                  {isReadingAudio ? <PauseIcon /> : <VolumeIcon />}
                  {isReadingAudio ? 'إيقاف القراءة' : 'قراءة صوتية'}
                </button>

                <select
                  value={audioRate}
                  onChange={(event) => setAudioRate(Number(event.target.value))}
                  className="rounded-xl bg-mushaf-paper border border-mushaf-border/30 px-3 py-3 text-xs font-bold text-mushaf-teal outline-none"
                  aria-label="سرعة القراءة الصوتية"
                >
                  <option value={0.75}>٠٫٧٥×</option>
                  <option value={1}>١×</option>
                  <option value={1.15}>١٫١٥×</option>
                  <option value={1.35}>١٫٣٥×</option>
                </select>

                <button
                  onClick={copyHadith}
                  className="flex-1 min-w-[120px] bg-mushaf-paper text-mushaf-teal rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'تم النسخ' : 'نسخ'}
                </button>

                <button
                  onClick={shareHadith}
                  className="flex-1 min-w-[120px] bg-mushaf-paper text-mushaf-teal rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Share2 size={18} />
                  مشاركة
                </button>

                <button
                  onClick={toggleFavorite}
                  className={`flex-1 min-w-[120px] rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 ${
                    selectedIsFavorite
                      ? 'bg-mushaf-gold text-white'
                      : 'bg-mushaf-paper text-mushaf-gold'
                  }`}
                >
                  <Bookmark size={18} fill={selectedIsFavorite ? 'currentColor' : 'none'} />
                  {selectedIsFavorite ? 'محفوظ' : 'حفظ'}
                </button>

                <button
                  onClick={designHadithAsImage}
                  disabled={designLoading}
                  className="flex-1 min-w-[150px] bg-mushaf-paper text-mushaf-teal rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {designLoading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                  {designLoading ? 'جاري التصميم...' : 'تصميم كصورة'}
                </button>

                <button
                  onClick={() => {
                    window.open(REMOTE_DOCS_URL, '_blank', 'noopener,noreferrer')
                  }}
                  className="w-12 h-12 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center"
                  title="مصدر البيانات"
                  aria-label="مصدر البيانات"
                >
                  <ExternalLink size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {designUrl && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDesignUrl(null)}
        >
          <div
            className="bg-white rounded-[2rem] p-3 shadow-2xl w-full max-w-xl max-h-[92vh] overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <div>
                <p className="font-bold text-mushaf-dark">تصميم الحديث</p>
                <p className="text-xs text-gray-400 mt-1">تم إنشاء الصورة بنجاح</p>
              </div>
              <button
                onClick={() => setDesignUrl(null)}
                className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center"
                aria-label="إغلاق التصميم"
              >
                <X size={19} />
              </button>
            </div>
            <img src={designUrl} alt="تصميم الحديث" className="w-full h-auto rounded-2xl block mt-2" />
          </div>
        </div>
      )}
    </div>
  )
}