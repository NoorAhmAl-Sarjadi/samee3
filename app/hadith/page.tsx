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
  Volume2,
  PauseCircle,
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
  { id: 'riyad_assalihin', name_ar: 'رياض الصالحين', name_en: 'Riyad as-Salihin', category: 'كتب أخرى' },
  { id: 'bulugh_almaram', name_ar: 'بلوغ المرام', name_en: 'Bulugh al-Maram', category: 'كتب أخرى' },
  { id: 'aladab_almufrad', name_ar: 'الأدب المفرد', name_en: 'Al-Adab Al-Mufrad', category: 'كتب أخرى' },
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
  if (value.includes('9') || value.includes('تسعة') || value.includes('the_9')) return 'الكتب التسعة'
  if (value.includes('40') || value.includes('أربعين') || value.includes('forties')) return 'الأربعينات'
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
  return source.map((book: any) => ({
    id: String(book.id || book.bookId || book.slug || ''),
    name_ar: String(book.name_ar || book.nameArabic || book.arabicName || book.arabic?.name || book.name || ''),
    name_en: book.name_en || book.nameEnglish || book.englishName || book.english?.name || '',
    category: normalizeBookCategory(book.category || book.category_id || book.group || book.collection),
    hadithCount: Number(book.hadithCount ?? book.hadith_count ?? book.numberOfHadith ?? book.total_hadiths ?? book.count ?? 0),
    author_ar: book.author_ar || book.authorArabic || '',
    author_en: book.author_en || book.authorEnglish || '',
  })).filter((book: HadithBook) => book.id && book.name_ar)
}

function extractChapters(payload: unknown): HadithChapter[] {
  const data = payload as any
  const source = data?.chapters || data?.data?.chapters || data?.book?.chapters || []
  if (!Array.isArray(source)) return []
  return source.map((chapter: any, index: number) => {
    const range = Array.isArray(chapter.hadith_range) ? chapter.hadith_range : []
    const id = chapter.id ?? chapter.chapterId ?? chapter.number ?? index + 1
    return {
      id,
      name_ar: chapter.name_ar || chapter.nameArabic || chapter.arabicName || chapter.arabic || chapter.name || '',
      name_en: chapter.name_en || chapter.nameEnglish || '',
      hadithCount: Number(chapter.hadithCount ?? chapter.hadith_count ?? chapter.count ?? 0),
      firstHadith: Number(chapter.firstHadith ?? chapter.first_hadith ?? chapter.start ?? range[0] ?? 0),
      lastHadith: Number(chapter.lastHadith ?? chapter.last_hadith ?? chapter.end ?? range[1] ?? 0),
    }
  }).filter((chapter: HadithChapter) => chapter.id !== undefined && chapter.id !== null)
}

function extractHadiths(payload: unknown): Hadith[] {
  const data = payload as any
  const source = data?.hadiths || data?.data?.hadiths || data?.data || []
  if (!Array.isArray(source)) return []
  return source.map((hadith: any) => ({
    id: Number(hadith.id ?? hadith.idInBook ?? hadith.number ?? 0),
    idInBook: Number(hadith.idInBook ?? hadith.number ?? hadith.id ?? 0),
    chapterId: Number(hadith.chapterId ?? hadith.chapter_id ?? 0),
    bookId: Number(hadith.bookId ?? hadith.book_id ?? 0),
    arabic: hadith.arabic || hadith.arab || hadith.text_ar || hadith.text || '',
    english: {
      narrator: hadith.english?.narrator || hadith.narrator || '',
      text: hadith.english?.text || hadith.text_en || '',
    },
  })).filter((hadith: Hadith) => hadith.id > 0)
}

function getShareText(book: HadithBook, hadith: Hadith) {
  const number = hadith.idInBook || hadith.id
  return `${hadith.arabic || ''}\n\n${book.name_ar} — حديث ${arabicDigits(number)}`
}

function getFavoriteKey(book: HadithBook, hadith: Hadith) {
  return `${book.id}:${hadith.idInBook || hadith.id}`
}

// دالة جلب رابط الصوت البشري المعتمد من المصادر المفتوحة الموثوقة للأبواب والكتب
function getTrustedChapterAudioUrl(bookId: string, chapterId: string | number) {
  // يمكنك ربط هذه القاعدة بأي CDN أو مصدر موثوق تعتمد عليه المنصة (مثل أرشيف الصوت الإسلامي)
  // مثال على هيكل روابط موثوقة:
  return `https://ia800900.us.archive.org/15/items/samee3-hadith-audio-${bookId}/${String(chapterId).padStart(3, '0')}.mp3`
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
  const [designUrl, setDesignUrl] = useState<string | null>(null)
  const [designLoading, setDesignLoading] = useState(false)
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // حالة مشغل الصوت البشري للباب
  const [isPlayingChapter, setIsPlayingChapter] = useState(false)
  const [chapterAudioLoading, setChapterAudioLoading] = useState(false)
  const chapterAudioRef = useRef<HTMLAudioElement | null>(null)

  const fetchJson = useCallback(async (url: string) => {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } })
    const text = await response.text()
    let payload: any = null
    try { payload = text ? JSON.parse(text) : null } catch { throw new Error('استجابة غير صالحة.') }
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
    return payload
  }, [])

  const loadBooks = useCallback(async () => {
    setBooksLoading(true)
    setBookError('')
    try {
      const payload = await fetchJson(`${API_BASE}/list`)
      const remoteBooks = extractBooks(payload)
      if (remoteBooks.length) setBooks(remoteBooks)
    } catch (err) {
      setBookError('تم استخدام القائمة الاحتياطية لعدم توفر الاتصال.')
    } finally {
      setBooksLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    loadBooks()
    try {
      const rawFavs = localStorage.getItem(FAVORITES_KEY)
      if (rawFavs) setFavoriteIds(JSON.parse(rawFavs))
      const rawResume = localStorage.getItem(RESUME_KEY)
      if (rawResume) setResumeState(JSON.parse(rawResume))
    } catch {}
  }, [loadBooks])

  const stopChapterAudio = useCallback(() => {
    if (chapterAudioRef.current) {
      chapterAudioRef.current.pause()
      chapterAudioRef.current.src = ''
      chapterAudioRef.current = null
    }
    setIsPlayingChapter(false)
    setChapterAudioLoading(false)
  }, [])

  const toggleChapterAudio = async () => {
    if (isPlayingChapter) {
      stopChapterAudio()
      return
    }

    if (!selectedBook || !selectedChapterId) return

    setChapterAudioLoading(true)
    try {
      const audioUrl = getTrustedChapterAudioUrl(selectedBook.id, selectedChapterId)
      const audio = new Audio(audioUrl)
      chapterAudioRef.current = audio
      
      audio.onended = () => setIsPlayingChapter(false)
      audio.onerror = () => {
        setIsPlayingChapter(false)
        setChapterAudioLoading(false)
        alert('تعذر تشغيل التسجيل الصوتي لهذا الباب، يرجى المحاولة لاحقاً.')
      }
      
      await audio.play()
      setIsPlayingChapter(true)
    } catch (err) {
      console.error('Audio playback error:', err)
      setIsPlayingChapter(false)
    } finally {
      setChapterAudioLoading(false)
    }
  }

  const loadBookChapters = useCallback(async (book: HadithBook) => {
    setChaptersLoading(true)
    stopChapterAudio()
    setError('')
    try {
      const payload = await fetchJson(`${API_BASE}/${encodeURIComponent(book.id)}`)
      const nextChapters = extractChapters(payload)
      setChapters(nextChapters)
      setSelectedBook(book)
      setSelectedChapterId(nextChapters[0]?.id || null)
    } catch (err) {
      setError('تعذر تحميل أبواب هذا الكتاب.')
    } finally {
      setChaptersLoading(false)
    }
  }, [fetchJson, stopChapterAudio])

  const loadChapterHadiths = useCallback(async (book: HadithBook, chapterId: string | number) => {
    setHadithsLoading(true)
    setError('')
    try {
      const payload = await fetchJson(`${API_BASE}/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(String(chapterId))}`)
      const nextHadiths = extractHadiths(payload)
      setHadiths(nextHadiths)
      setSelectedHadith(nextHadiths[0] || null)
    } catch (err) {
      setError('تعذر تحميل أحاديث الباب.')
    } finally {
      setHadithsLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    if (selectedBook && selectedChapterId !== null) {
      loadChapterHadiths(selectedBook, selectedChapterId)
    }
  }, [selectedBook, selectedChapterId, loadChapterHadiths])

  const filteredBooks = useMemo(() => {
    const q = normalizeArabic(bookSearch)
    return q ? books.filter(b => normalizeArabic(`${b.name_ar} ${b.author_ar || ''}`).includes(q)) : books
  }, [bookSearch, books])

  const groupedBooks = useMemo(() => {
    return BOOK_CATEGORY_ORDER.map(cat => ({
      category: cat,
      books: filteredBooks.filter(b => (b.category || 'كتب أخرى') === cat)
    })).filter(g => g.books.length)
  }, [filteredBooks])

  const filteredChapters = useMemo(() => {
    const q = normalizeArabic(chapterSearch)
    return q ? chapters.filter(c => normalizeArabic(c.name_ar || '').includes(q)) : chapters
  }, [chapterSearch, chapters])

  const filteredHadiths = useMemo(() => {
    const q = normalizeArabic(hadithSearch)
    return q ? hadiths.filter(h => normalizeArabic(`${h.arabic || ''} ${h.idInBook || h.id}`).includes(q)) : hadiths
  }, [hadithSearch, hadiths])

  const currentChapter = useMemo(() => chapters.find(c => String(c.id) === String(selectedChapterId)), [chapters, selectedChapterId])
  
  const currentDisplayHadith = useMemo(() => {
    if (selectedHadith) {
      const match = filteredHadiths.find(h => (h.idInBook || h.id) === (selectedHadith.idInBook || selectedHadith.id))
      if (match) return match
    }
    return filteredHadiths[0] || null
  }, [filteredHadiths, selectedHadith])

  const currentHadithIndex = useMemo(() => currentDisplayHadith ? hadiths.findIndex(h => (h.idInBook || h.id) === (currentDisplayHadith.idInBook || currentDisplayHadith.id)) : -1, [currentDisplayHadith, hadiths])

  const openHadith = useCallback((hadith: Hadith) => {
    if (!selectedBook || selectedChapterId === null) return
    setSelectedHadith(hadith)
    const resume = { bookId: selectedBook.id, chapterId: selectedChapterId, hadithId: hadith.idInBook || hadith.id, savedAt: Date.now() }
    setResumeState(resume)
    localStorage.setItem(RESUME_KEY, JSON.stringify(resume))
  }, [selectedBook, selectedChapterId])

  const goToHadith = (direction: -1 | 1) => {
    const target = hadiths[currentHadithIndex + direction]
    if (target) openHadith(target)
  }

  const toggleFavorite = () => {
    if (!selectedBook || !selectedHadith) return
    const key = getFavoriteKey(selectedBook, selectedHadith)
    const next = favoriteIds.includes(key) ? favoriteIds.filter(id => id !== key) : [...favoriteIds, key]
    setFavoriteIds(next)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }

  const selectedIsFavorite = selectedBook && selectedHadith && favoriteIds.includes(getFavoriteKey(selectedBook, selectedHadith))

  // كود تصميم الصورة (Canvas) المصحح تماماً لمنع أي تقطيع أو أخطاء
  const designHadithAsImage = async () => {
    if (!selectedBook || !selectedHadith?.arabic) return
    setDesignLoading(true)

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')

      await document.fonts?.ready

      const width = 1080
      const padding = 80
      const maxWidth = width - (padding * 2)
      
      const cleanText = selectedHadith.arabic.replace(/\s+/g, ' ').trim()
      ctx.font = '600 40px "Amiri Quran", "Amiri", serif'
      
      const wrapText = (text: string, maxW: number) => {
        const words = text.split(' ')
        const lines = []
        let currentLine = words[0]
        for (let i = 1; i < words.length; i++) {
          const testLine = currentLine + ' ' + words[i]
          if (ctx!.measureText(testLine).width < maxW) {
            currentLine = testLine
          } else {
            lines.push(currentLine)
            currentLine = words[i]
          }
        }
        lines.push(currentLine)
        return lines
      }

      const lines = wrapText(cleanText, maxWidth)
      const lineHeight = 70
      const textHeight = lines.length * lineHeight
      const cardStartY = 330
      const cardHeight = Math.max(550, textHeight + 180)
      const height = cardStartY + cardHeight + 180

      canvas.width = width
      canvas.height = height

      // الخلفية العاجية الفاخرة
      ctx.fillStyle = '#FDFBF7'
      ctx.fillRect(0, 0, width, height)

      // الجزء العلوي والخلفية الزخرفية
      ctx.fillStyle = '#175E67'
      ctx.fillRect(0, 0, width, 240)
      
      ctx.strokeStyle = '#C4A15D'
      ctx.lineWidth = 4
      ctx.strokeRect(30, 30, width - 60, height - 60)
      ctx.lineWidth = 1
      ctx.strokeRect(45, 45, width - 90, height - 90)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#C4A15D'
      ctx.font = 'bold 36px "Tajawal", sans-serif'
      ctx.fillText('مصحف سَميع', width / 2, 100)

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 28px "Tajawal", sans-serif'
      ctx.fillText(selectedBook.name_ar, width / 2, 160)

      // البطاقة البيضاء للحديث
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(0,0,0,0.08)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 10
      ctx.beginPath()
      ctx.roundRect(padding, cardStartY, maxWidth, cardHeight, 24)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      
      ctx.strokeStyle = 'rgba(196,161,93,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()

      // شارة رقم الحديث
      ctx.fillStyle = '#175E67'
      ctx.beginPath()
      ctx.roundRect((width / 2) - 110, cardStartY - 28, 220, 56, 28)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 22px "Tajawal", sans-serif'
      ctx.fillText(`حديث رقم ${arabicDigits(selectedHadith.idInBook || selectedHadith.id)}`, width / 2, cardStartY + 10)

      // كتابة الأسطر بوسطية دقيقة تمنع أي انقطاع
      ctx.fillStyle = '#1A1A1A'
      ctx.font = '600 40px "Amiri Quran", "Amiri", serif'
      let currentY = cardStartY + 115
      lines.forEach(line => {
        ctx!.fillText(line, width / 2, currentY)
        currentY += lineHeight
      })

      ctx.fillStyle = '#175E67'
      ctx.font = 'bold 24px "Tajawal", sans-serif'
      ctx.fillText('مكتبة الأحاديث الشريفة', width / 2, height - 90)

      const url = canvas.toDataURL('image/png')
      setDesignUrl(url)
      
      const link = document.createElement('a')
      link.download = `samee3-hadith-${selectedHadith.id}.png`
      link.href = url
      link.click()

    } catch (error) {
      console.error('Canvas error:', error)
    } finally {
      setDesignLoading(false)
    }
  }

  const shareHadith = async () => {
    if (!selectedBook || !selectedHadith) return
    const text = getShareText(selectedBook, selectedHadith)
    try {
      if (navigator.share) await navigator.share({ title: selectedBook.name_ar, text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }

  const copyHadith = async () => {
    if (!selectedBook || !selectedHadith) return
    await navigator.clipboard.writeText(getShareText(selectedBook, selectedHadith))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resumeBook = useMemo(() => {
    if (!resumeState) return null
    return books.find((b) => b.id === resumeState.bookId) || null
  }, [books, resumeState])

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-32" dir="rtl">
      <header className="sticky top-0 z-30 bg-mushaf-paper/95 backdrop-blur-md border-b border-mushaf-border/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-mushaf-teal">
            <ChevronRight size={24} />
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="text-mushaf-gold" size={22} />
              <h1 className="font-bold text-xl text-mushaf-dark">مكتبة الأحاديث</h1>
            </div>
          </div>
          <div className="w-11" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-6">
        {!selectedBook ? (
          <>
            <section className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <h2 className="font-uthmani text-3xl sm:text-4xl leading-relaxed relative z-10">
                تصفح كتب الحديث، ثم انتقل إلى الباب والحديث مباشرة.
              </h2>
            </section>

            {resumeBook && resumeState && (
              <button
                onClick={() => loadBookChapters(resumeBook)}
                className="mt-5 w-full text-right bg-white rounded-3xl border border-mushaf-gold/30 shadow-sm p-5 hover:shadow-md transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-mushaf-paper text-mushaf-gold flex items-center justify-center shrink-0">
                    <Bookmark size={24} fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400">متابعة آخر قراءة</p>
                    <h3 className="font-bold text-mushaf-dark mt-1 truncate">{resumeBook.name_ar}</h3>
                    <p className="text-xs text-gray-500 mt-1">حديث {arabicDigits(resumeState.hadithId)}</p>
                  </div>
                  <ChevronLeft className="text-mushaf-gold" size={22} />
                </div>
              </button>
            )}

            <div className="mt-6 bg-white rounded-2xl border border-mushaf-border/40 px-4 py-3 flex items-center gap-3 shadow-sm">
              <Search size={20} className="text-mushaf-teal" />
              <input
                value={bookSearch} 
                onChange={e => setBookSearch(e.target.value)}
                placeholder="ابحث عن كتاب حديث..."
                className="w-full outline-none bg-transparent font-bold text-sm text-mushaf-dark"
              />
            </div>

            {bookError && (
              <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl p-4 text-sm font-bold">
                {bookError}
              </div>
            )}

            <div className="mt-8 space-y-8">
              {booksLoading ? (
                <div className="py-16 flex justify-center text-mushaf-teal"><Loader2 className="animate-spin" size={36} /></div>
              ) : groupedBooks.map(group => (
                <div key={group.category}>
                  <h2 className="font-bold text-xl mb-4 text-mushaf-dark">{group.category}</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.books.map(book => (
                      <button 
                        key={book.id} 
                        onClick={() => loadBookChapters(book)} 
                        className="bg-white rounded-3xl p-5 border text-right group hover:border-mushaf-teal shadow-sm transition"
                      >
                        <h3 className="font-bold text-lg group-hover:text-mushaf-teal transition">{book.name_ar}</h3>
                        {book.author_ar && <p className="text-xs text-gray-400 mt-1">{book.author_ar}</p>}
                        <p className="text-xs text-gray-500 mt-1">{getBookDisplayCount(book)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setSelectedBook(null); stopChapterAudio(); }} className="flex items-center gap-2 text-mushaf-teal font-bold mb-5">
              <ArrowRight size={18} /> عودة لقائمة الكتب
            </button>

            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              <aside className="bg-white rounded-3xl border border-mushaf-border/40 p-4 h-fit lg:sticky lg:top-24 shadow-sm">
                <h3 className="font-bold text-mushaf-dark mb-3">الأبواب ({arabicDigits(chapters.length)})</h3>
                <div className="max-h-[65vh] overflow-y-auto space-y-2 pr-1">
                  {chapters.map(chapter => (
                    <button
                      key={chapter.id}
                      onClick={() => { stopChapterAudio(); setSelectedChapterId(chapter.id) }}
                      className={`w-full text-right p-3 rounded-2xl border transition ${
                        String(selectedChapterId) === String(chapter.id) ? 'bg-mushaf-teal text-white border-mushaf-teal' : 'bg-mushaf-paper border-transparent hover:border-mushaf-teal/40'
                      }`}
                    >
                      <p className="font-bold text-sm leading-relaxed">{chapter.name_ar || `الباب ${chapter.id}`}</p>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="min-w-0">
                <div className="bg-white rounded-3xl border border-mushaf-border/40 p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                  <div>
                    <p className="text-xs text-gray-400">الباب الحالي</p>
                    <h3 className="font-bold text-lg text-mushaf-dark mt-1">
                      {currentChapter?.name_ar || 'جاري تحميل الباب...'}
                    </h3>
                  </div>
                  
                  {/* زر تشغيل الباب الصوتي البشري من المصادر المعتمدة */}
                  <button
                    onClick={toggleChapterAudio}
                    disabled={chapterAudioLoading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                      isPlayingChapter 
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-mushaf-teal text-white hover:bg-[#124b52]'
                    }`}
                  >
                    {chapterAudioLoading ? <Loader2 size={18} className="animate-spin" /> : (isPlayingChapter ? <PauseCircle size={18} /> : <Volume2 size={18} />)}
                    {chapterAudioLoading ? 'جاري الاتصال بالمصدر...' : (isPlayingChapter ? 'إيقاف قراءة الباب' : 'استماع للباب كامل (صوت بشري)')}
                  </button>
                </div>

                {hadithsLoading ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-mushaf-teal" size={36} /></div>
                ) : error ? (
                  <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-center font-bold text-sm">
                    {error}
                  </div>
                ) : currentDisplayHadith && (
                  <article className="mt-5 bg-white rounded-[2rem] border border-mushaf-border/30 shadow-md p-6 sm:p-8">
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-mushaf-paper text-mushaf-gold px-4 py-1.5 rounded-full text-sm font-black">
                        حديث {arabicDigits(currentDisplayHadith.idInBook || currentDisplayHadith.id)}
                      </span>
                      <span className="text-xs text-gray-400 font-bold">
                        {arabicDigits(currentHadithIndex + 1)} من {arabicDigits(hadiths.length)}
                      </span>
                    </div>

                    <div className="bg-mushaf-paper p-6 sm:p-8 rounded-3xl border border-mushaf-gold/20">
                      <p className="font-uthmani text-2xl sm:text-3xl leading-[2.25] text-mushaf-dark text-justify">
                        {currentDisplayHadith.arabic}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <button onClick={() => goToHadith(-1)} disabled={currentHadithIndex <= 0} className="flex-1 min-w-[120px] rounded-xl bg-mushaf-paper text-mushaf-teal py-3 font-bold text-sm disabled:opacity-40">السابق</button>
                      <button onClick={() => goToHadith(1)} disabled={currentHadithIndex >= hadiths.length - 1} className="flex-1 min-w-[120px] rounded-xl bg-mushaf-paper text-mushaf-teal py-3 font-bold text-sm disabled:opacity-40">التالي</button>
                      <button onClick={() => setIsDetailsOpen(true)} className="flex-1 min-w-[150px] rounded-xl bg-mushaf-teal text-white py-3 font-bold text-sm">خيارات الحديث والتصميم</button>
                    </div>
                  </article>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {/* نافذة خيارات الحديث */}
      {selectedHadith && isDetailsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsDetailsOpen(false)}>
          <div className="bg-white w-full max-w-2xl rounded-[2rem] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl text-mushaf-dark">خيارات الحديث رقم {arabicDigits(selectedHadith.idInBook || selectedHadith.id)}</h2>
              <button onClick={() => setIsDetailsOpen(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500"><X size={20} /></button>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <button onClick={copyHadith} className="bg-mushaf-paper text-mushaf-teal rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2">
                {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'تم النسخ' : 'نسخ النص'}
              </button>
              <button onClick={shareHadith} className="bg-mushaf-paper text-mushaf-teal rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2">
                <Share2 size={18} /> مشاركة
              </button>
              <button onClick={toggleFavorite} className={`rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 ${selectedIsFavorite ? 'bg-mushaf-gold text-white' : 'bg-mushaf-paper text-mushaf-gold'}`}>
                <Bookmark size={18} fill={selectedIsFavorite ? 'currentColor' : 'none'} /> {selectedIsFavorite ? 'محفوظ في المفضلة' : 'حفظ في المفضلة'}
              </button>
              <button onClick={designHadithAsImage} disabled={designLoading} className="bg-mushaf-teal text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {designLoading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />} {designLoading ? 'جاري التصميم...' : 'تصميم الحديث كصورة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة معاينة الصورة المصممة */}
      {designUrl && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDesignUrl(null)}>
          <div className="relative max-w-lg w-full bg-white p-3 rounded-[2rem] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-2 py-1 mb-2">
              <p className="font-bold text-mushaf-dark">معاينة وتنزيل الصورة</p>
              <button onClick={() => setDesignUrl(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={18}/></button>
            </div>
            <img src={designUrl} alt="تصميم الحديث" className="w-full rounded-2xl block bg-mushaf-paper" />
            <p className="text-center text-xs font-bold text-emerald-700 mt-3 mb-1">تم حفظ الصورة تلقائياً على جهازك بنجاح</p>
          </div>
        </div>
      )}
    </div>
  )
}
