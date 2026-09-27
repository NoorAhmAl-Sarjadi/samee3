"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
// تم استخدام المسار المباشر لحل مشكلة الـ Build نهائياً
import { getHumanHadithAudio, HumanHadithAudio } from '../../lib/hadith-human-audio'
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
  Settings2,
  Repeat,
  Play,
  PlayCircle
} from 'lucide-react'

// --- Types ---
type HadithBook = { id: string; name_ar: string; name_en?: string; category?: string; hadithCount?: number; author_ar?: string; author_en?: string }
type HadithChapter = { id: string | number; name_ar?: string; name_en?: string; hadithCount?: number; firstHadith?: number; lastHadith?: number }
type Hadith = { id: number; idInBook?: number; chapterId?: number; bookId?: number; arabic?: string; audioUrl?: string; english?: { narrator?: string; text?: string } }
type SelectedBook = HadithBook | null
type ResumeState = { bookId: string; chapterId: string | number; hadithId: number; savedAt: number }

type AudioSettings = {
  voice: string
  speed: number
  repeat: number // 0 = none, 1, 2, 3, 5, 10
  autoNext: boolean
}

const API_BASE = '/api/hadith'
const REMOTE_DOCS_URL = 'https://alfurqan.online/docs'
const FAVORITES_KEY = 'samee3_hadith_favorites'
const RESUME_KEY = 'samee3_hadith_resume'
const AUDIO_SETTINGS_KEY = 'samee3_hadith_audio_settings'

const FALLBACK_BOOKS: HadithBook[] = [
  { id: 'bukhari', name_ar: 'صحيح البخاري', category: 'الكتب التسعة' },
  { id: 'muslim', name_ar: 'صحيح مسلم', category: 'الكتب التسعة' },
  { id: 'abudawud', name_ar: 'سنن أبي داود', category: 'الكتب التسعة' },
  { id: 'nasai', name_ar: 'سنن النسائي', category: 'الكتب التسعة' },
  { id: 'tirmidhi', name_ar: 'جامع الترمذي', category: 'الكتب التسعة' },
  { id: 'ibnmajah', name_ar: 'سنن ابن ماجه', category: 'الكتب التسعة' },
  { id: 'malik', name_ar: 'موطأ مالك', category: 'الكتب التسعة' },
  { id: 'darimi', name_ar: 'سنن الدارمي', category: 'الكتب التسعة' },
  { id: 'ahmed', name_ar: 'مسند أحمد', category: 'الكتب التسعة' },
  { id: 'nawawi40', name_ar: 'الأربعون النووية', category: 'الأربعينات' },
  { id: 'qudsi40', name_ar: 'الأربعون حديثًا قدسيًا', category: 'الأربعينات' },
]

const BOOK_CATEGORY_ORDER = ['الكتب التسعة', 'الأربعينات', 'كتب أخرى']

// --- Helpers ---
function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function normalizeArabic(value: string) {
  return value.toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '٠٠:٠٠'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${arabicDigits(m.toString().padStart(2, '0'))}:${arabicDigits(s.toString().padStart(2, '0'))}`
}

function extractBooks(payload: any): HadithBook[] {
  const source = payload?.books || payload?.data?.books || payload?.collections || payload?.data || []
  if (!Array.isArray(source)) return []
  return source.map((book: any) => ({
    id: String(book.id || book.bookId || book.slug || ''),
    name_ar: String(book.name_ar || book.nameArabic || book.arabicName || book.arabic?.name || book.name || ''),
    category: BOOK_CATEGORY_ORDER.find(c => String(book.category || '').includes(c === 'الأربعينات' ? '40' : '9')) || 'كتب أخرى',
    hadithCount: Number(book.hadithCount ?? book.hadith_count ?? book.total_hadiths ?? book.count ?? 0),
    author_ar: book.author_ar || '',
  })).filter((book: HadithBook) => book.id && book.name_ar)
}

function extractChapters(payload: any): HadithChapter[] {
  const source = payload?.chapters || payload?.data?.chapters || payload?.book?.chapters || []
  if (!Array.isArray(source)) return []
  return source.map((chapter: any, index: number) => ({
    id: chapter.id ?? chapter.chapterId ?? chapter.number ?? index + 1,
    name_ar: chapter.name_ar || chapter.nameArabic || chapter.arabicName || chapter.arabic || chapter.name || '',
    hadithCount: Number(chapter.hadithCount ?? chapter.hadith_count ?? chapter.count ?? 0),
  })).filter((chapter: HadithChapter) => chapter.id !== undefined && chapter.id !== null)
}

function extractHadiths(payload: any): Hadith[] {
  const source = payload?.hadiths || payload?.data?.hadiths || payload?.data || []
  if (!Array.isArray(source)) return []
  return source.map((hadith: any) => ({
    id: Number(hadith.id ?? hadith.idInBook ?? hadith.number ?? 0),
    idInBook: Number(hadith.idInBook ?? hadith.number ?? hadith.id ?? 0),
    chapterId: Number(hadith.chapterId ?? hadith.chapter_id ?? 0),
    bookId: Number(hadith.bookId ?? hadith.book_id ?? 0),
    arabic: hadith.arabic || hadith.arab || hadith.text_ar || hadith.text || '',
    audioUrl: typeof hadith.audioUrl === 'string' ? hadith.audioUrl : (typeof hadith.audio === 'string' ? hadith.audio : ''),
    english: { narrator: hadith.english?.narrator || hadith.narrator || '', text: hadith.english?.text || hadith.text_en || '' },
  })).filter((hadith: Hadith) => hadith.id > 0)
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

  const [copied, setCopied] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [designUrl, setDesignUrl] = useState<string | null>(null)
  const [designLoading, setDesignLoading] = useState(false)
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)

  // --- Audio State ---
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ voice: 'ar-SA-HamedNeural', speed: 1, repeat: 0, autoNext: false })
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [audioSource, setAudioSource] = useState<'human' | 'ai' | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [displayDuration, setDisplayDuration] = useState(0)
  const [audioError, setAudioError] = useState('')
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const ttsAbortControllerRef = useRef<AbortController | null>(null)
  const repeatCounterRef = useRef(0)
  const activeHumanAudioMeta = useRef<HumanHadithAudio | null>(null)
  const isComponentMounted = useRef(true)

  // --- Core Data Fetching ---
  const fetchJson = useCallback(async (url: string) => {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } })
    const text = await response.text()
    let payload = text ? JSON.parse(text) : null
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
    return payload
  }, [])

  const loadBooks = useCallback(async () => {
    setBooksLoading(true)
    try {
      const payload = await fetchJson(`${API_BASE}/list`)
      const remoteBooks = extractBooks(payload)
      if (remoteBooks.length) setBooks(remoteBooks)
    } catch (err) {
      // Keep fallback books
    } finally {
      if (isComponentMounted.current) setBooksLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    isComponentMounted.current = true
    loadBooks()
    try {
      const rawFavs = localStorage.getItem(FAVORITES_KEY)
      if (rawFavs) setFavoriteIds(JSON.parse(rawFavs))
      const rawResume = localStorage.getItem(RESUME_KEY)
      if (rawResume) setResumeState(JSON.parse(rawResume))
      const rawSettings = localStorage.getItem(AUDIO_SETTINGS_KEY)
      if (rawSettings) setAudioSettings(JSON.parse(rawSettings))
    } catch {}
    
    return () => { isComponentMounted.current = false }
  }, [loadBooks])

  const updateAudioSettings = (newSettings: Partial<AudioSettings>) => {
    setAudioSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(updated))
      if (audioRef.current) audioRef.current.playbackRate = updated.speed
      return updated
    })
  }

  // --- Audio Engine ---
  const cleanupAudio = useCallback(() => {
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort()
      ttsAbortControllerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current.onended = null
      audioRef.current.ontimeupdate = null
      audioRef.current.onloadedmetadata = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current)
      audioObjectUrlRef.current = null
    }
    setIsPlaying(false)
    setIsAudioLoading(false)
    setCurrentTime(0)
    setDisplayDuration(0)
    setAudioSource(null)
    setAudioError('')
    activeHumanAudioMeta.current = null
  }, [])

  // Track progress and bounds for Human Audio
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || !isPlaying) return
    const currentAudioTime = audioRef.current.currentTime
    const meta = activeHumanAudioMeta.current

    if (meta && meta.startSeconds !== undefined && meta.endSeconds !== undefined) {
      // Human Audio segmented
      if (currentAudioTime >= meta.endSeconds) {
         handlePlaybackEnd()
      } else {
         setCurrentTime(Math.max(0, currentAudioTime - meta.startSeconds))
      }
    } else {
      // AI Audio or full human audio
      setCurrentTime(currentAudioTime)
    }
  }, [isPlaying])

  const currentHadithIndex = useMemo(() => {
    if (!selectedHadith || !hadiths.length) return -1
    return hadiths.findIndex(h => (h.idInBook || h.id) === (selectedHadith.idInBook || selectedHadith.id))
  }, [selectedHadith, hadiths])

  const handlePlaybackEnd = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
    
    if (repeatCounterRef.current < audioSettings.repeat) {
      // Repeat
      repeatCounterRef.current++
      const meta = activeHumanAudioMeta.current
      if (meta && meta.startSeconds !== undefined) {
         audioRef.current.currentTime = meta.startSeconds
      } else {
         audioRef.current.currentTime = 0
      }
      audioRef.current.play().catch(console.error)
    } else {
      // Finished repeats
      repeatCounterRef.current = 0
      cleanupAudio()
      
      // Auto Next
      if (audioSettings.autoNext && currentHadithIndex !== -1 && currentHadithIndex < hadiths.length - 1) {
        const nextHadith = hadiths[currentHadithIndex + 1]
        openHadith(nextHadith, true) // Pass true to auto-play next
      }
    }
  }, [audioSettings.repeat, audioSettings.autoNext, currentHadithIndex, hadiths, cleanupAudio])

  const playAI = async (text: string) => {
    setAudioSource('ai')
    const controller = new AbortController()
    ttsAbortControllerRef.current = controller

    try {
      const response = await fetch('/api/hadith/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, voice: audioSettings.voice, rate: audioSettings.speed }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('تعذر إنشاء القراءة الذكية')
      
      const blob = await response.blob()
      if (!blob.size) throw new Error('ملف صوتي فارغ')

      const objectUrl = URL.createObjectURL(blob)
      audioObjectUrlRef.current = objectUrl
      
      const audio = new Audio(objectUrl)
      audioRef.current = audio
      audio.playbackRate = audioSettings.speed
      
      audio.onloadedmetadata = () => {
        setDisplayDuration(audio.duration || 0)
      }
      audio.ontimeupdate = handleTimeUpdate
      audio.onended = handlePlaybackEnd
      audio.onerror = () => { throw new Error('تعذر التشغيل') }

      await audio.play()
      setIsPlaying(true)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setAudioError(err.message || 'خطأ في التشغيل الذكي')
        cleanupAudio()
      }
    } finally {
      setIsAudioLoading(false)
    }
  }

  const handlePlayHadith = async (hadith: Hadith = selectedHadith!) => {
    if (!selectedBook || !hadith) return
    
    if (isPlaying) {
      cleanupAudio()
      return
    }

    cleanupAudio()
    setIsAudioLoading(true)
    setAudioError('')
    repeatCounterRef.current = 0

    const hadithNumber = hadith.idInBook || hadith.id
    const humanAudioMeta = getHumanHadithAudio(selectedBook.id, hadithNumber)

    if (humanAudioMeta && humanAudioMeta.url) {
      // 1. Try Human Audio
      setAudioSource('human')
      activeHumanAudioMeta.current = humanAudioMeta
      const audio = new Audio(humanAudioMeta.url)
      audioRef.current = audio
      audio.playbackRate = audioSettings.speed
      
      if (humanAudioMeta.startSeconds !== undefined && humanAudioMeta.endSeconds !== undefined) {
         setDisplayDuration(humanAudioMeta.endSeconds - humanAudioMeta.startSeconds)
      }

      audio.onloadedmetadata = () => {
         if (humanAudioMeta.startSeconds !== undefined) {
             audio.currentTime = humanAudioMeta.startSeconds
         }
         if (humanAudioMeta.startSeconds === undefined || humanAudioMeta.endSeconds === undefined) {
             setDisplayDuration(audio.duration || 0)
         }
      }
      audio.ontimeupdate = handleTimeUpdate
      audio.onended = handlePlaybackEnd
      
      audio.onerror = () => {
         // Fallback to AI if Human Audio fails
         console.warn('Human audio failed, falling back to AI')
         if (hadith.arabic) playAI(hadith.arabic)
         else {
             setAudioError('لا يتوفر نص عربي للقراءة الصوتية')
             cleanupAudio()
         }
      }

      try {
        await audio.play()
        setIsPlaying(true)
        setIsAudioLoading(false)
      } catch (err) {
        // Fallback to AI if play() fails (e.g. format not supported or network error)
        console.warn('Human audio play rejected, falling back to AI')
        if (hadith.arabic) playAI(hadith.arabic)
        else {
           setAudioError('تعذر التشغيل ولا يوجد نص للقراءة')
           cleanupAudio()
        }
      }
    } else {
      // 2. Direct AI Fallback
      if (hadith.arabic) await playAI(hadith.arabic)
      else {
        setAudioError('عذراً، هذا الحديث لا يحتوي على نص عربي لقرائته.')
        cleanupAudio()
      }
    }
  }

  // --- Data Loading & Navigation ---
  const loadBookChapters = useCallback(async (book: HadithBook) => {
    setChaptersLoading(true)
    cleanupAudio()
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
  }, [fetchJson, cleanupAudio])

  const loadChapterHadiths = useCallback(async (book: HadithBook, chapterId: string | number) => {
    setHadithsLoading(true)
    cleanupAudio()
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
  }, [fetchJson, cleanupAudio])

  useEffect(() => {
    if (selectedBook && selectedChapterId !== null) {
      loadChapterHadiths(selectedBook, selectedChapterId)
    }
  }, [selectedBook, selectedChapterId, loadChapterHadiths])

  const openHadith = useCallback((hadith: Hadith, autoPlay = false) => {
    if (!selectedBook || selectedChapterId === null) return
    cleanupAudio()
    setSelectedHadith(hadith)
    const resume = { bookId: selectedBook.id, chapterId: selectedChapterId, hadithId: hadith.idInBook || hadith.id, savedAt: Date.now() }
    setResumeState(resume)
    localStorage.setItem(RESUME_KEY, JSON.stringify(resume))
    
    if (autoPlay) {
       // Small delay to ensure state updates smoothly
       setTimeout(() => handlePlayHadith(hadith), 100)
    }
  }, [selectedBook, selectedChapterId, cleanupAudio])

  const goToHadith = (direction: -1 | 1) => {
    const target = hadiths[currentHadithIndex + direction]
    if (target) openHadith(target)
  }

  // --- Actions ---
  const toggleFavorite = () => {
    if (!selectedBook || !selectedHadith) return
    const key = `${selectedBook.id}:${selectedHadith.idInBook || selectedHadith.id}`
    const next = favoriteIds.includes(key) ? favoriteIds.filter(id => id !== key) : [...favoriteIds, key]
    setFavoriteIds(next)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }

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
          if (ctx!.measureText(testLine).width < maxW) currentLine = testLine
          else { lines.push(currentLine); currentLine = words[i] }
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
      canvas.width = width; canvas.height = height

      ctx.fillStyle = '#F4F9FE'; ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#0284C7'; ctx.fillRect(0, 0, width, 240)
      
      ctx.strokeStyle = '#D97706'; ctx.lineWidth = 4; ctx.strokeRect(30, 30, width - 60, height - 60)
      ctx.lineWidth = 1; ctx.strokeRect(45, 45, width - 90, height - 90)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#D97706'; ctx.font = 'bold 36px "Tajawal", sans-serif'
      ctx.fillText('مصحف سَميع', width / 2, 100)
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 28px "Tajawal", sans-serif'
      ctx.fillText(selectedBook.name_ar, width / 2, 160)

      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10
      ctx.beginPath(); ctx.roundRect(padding, cardStartY, maxWidth, cardHeight, 24); ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = 'rgba(217,119,6,0.3)'; ctx.lineWidth = 2; ctx.stroke()

      ctx.fillStyle = '#0284C7'
      ctx.beginPath(); ctx.roundRect((width / 2) - 110, cardStartY - 28, 220, 56, 28); ctx.fill()
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px "Tajawal", sans-serif'
      ctx.fillText(`حديث رقم ${arabicDigits(selectedHadith.idInBook || selectedHadith.id)}`, width / 2, cardStartY + 10)

      ctx.fillStyle = '#1A1A1A'; ctx.font = '600 40px "Amiri Quran", "Amiri", serif'
      let currentY = cardStartY + 115
      lines.forEach(line => { ctx!.fillText(line, width / 2, currentY); currentY += lineHeight })

      ctx.fillStyle = '#0284C7'; ctx.font = 'bold 24px "Tajawal", sans-serif'
      ctx.fillText('مكتبة الأحاديث الشريفة', width / 2, height - 90)

      const url = canvas.toDataURL('image/png')
      setDesignUrl(url)
      const link = document.createElement('a'); link.download = `hadith-${selectedHadith.id}.png`; link.href = url; link.click()
    } catch (error) { console.error(error) } finally { setDesignLoading(false) }
  }

  const shareHadith = async () => {
    if (!selectedBook || !selectedHadith) return
    const text = `${selectedHadith.arabic || ''}\n\n${selectedBook.name_ar} — حديث ${arabicDigits(selectedHadith.idInBook || selectedHadith.id)}`
    try {
      if (navigator.share) await navigator.share({ title: selectedBook.name_ar, text })
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch {}
  }

  // --- UI Renders ---
  const filteredBooks = useMemo(() => {
    const q = normalizeArabic(bookSearch)
    return q ? books.filter(b => normalizeArabic(`${b.name_ar} ${b.author_ar || ''}`).includes(q)) : books
  }, [bookSearch, books])

  const groupedBooks = useMemo(() => {
    return BOOK_CATEGORY_ORDER.map(cat => ({ category: cat, books: filteredBooks.filter(b => (b.category || 'كتب أخرى') === cat) })).filter(g => g.books.length)
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
  const selectedIsFavorite = selectedBook && selectedHadith && favoriteIds.includes(`${selectedBook.id}:${selectedHadith.idInBook || selectedHadith.id}`)
  const resumeBook = useMemo(() => resumeState ? books.find((b) => b.id === resumeState.bookId) || null : null, [books, resumeState])

  return (
    <div className="min-h-screen bg-[#F4F9FE] flex flex-col pb-32 font-sans" dir="rtl">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F4F9FE]/95 backdrop-blur-md border-b border-[#0284C7]/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-[#0284C7]">
            <ChevronRight size={24} />
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="text-[#D97706]" size={22} />
              <h1 className="font-bold text-xl text-slate-800">مكتبة الأحاديث</h1>
            </div>
          </div>
          <div className="w-11" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-6">
        {!selectedBook ? (
          // --- Books List View ---
          <>
            <section className="bg-gradient-to-br from-[#0284C7] to-[#016599] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <h2 className="font-uthmani text-3xl sm:text-4xl leading-relaxed relative z-10">
                مكتبة أحاديث صوتية متكاملة.<br/>استمع للحديث بصوت بشري أو بالذكاء الاصطناعي.
              </h2>
            </section>

            {resumeBook && resumeState && (
              <button onClick={() => loadBookChapters(resumeBook)} className="mt-5 w-full text-right bg-white rounded-3xl border border-[#D97706]/30 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F4F9FE] text-[#D97706] flex items-center justify-center shrink-0">
                    <Bookmark size={24} fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400">متابعة آخر قراءة</p>
                    <h3 className="font-bold text-slate-800 mt-1 truncate">{resumeBook.name_ar}</h3>
                    <p className="text-xs text-gray-500 mt-1">حديث {arabicDigits(resumeState.hadithId)}</p>
                  </div>
                  <ChevronLeft className="text-[#D97706]" size={22} />
                </div>
              </button>
            )}

            <div className="mt-6 bg-white rounded-2xl border border-[#0284C7]/20 px-4 py-3 flex items-center gap-3 shadow-sm">
              <Search size={20} className="text-[#0284C7]" />
              <input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="ابحث عن كتاب حديث..." className="w-full outline-none bg-transparent font-bold text-sm text-slate-800" />
            </div>

            <div className="mt-8 space-y-8">
              {booksLoading ? (
                <div className="py-16 flex justify-center text-[#0284C7]"><Loader2 className="animate-spin" size={36} /></div>
              ) : groupedBooks.map(group => (
                <div key={group.category}>
                  <h2 className="font-bold text-xl mb-4 text-slate-800 border-r-4 border-[#D97706] pr-3">{group.category}</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.books.map(book => (
                      <button key={book.id} onClick={() => loadBookChapters(book)} className="bg-white rounded-3xl p-5 border border-transparent text-right group hover:border-[#0284C7] shadow-sm transition">
                        <h3 className="font-bold text-lg group-hover:text-[#0284C7] transition text-slate-800">{book.name_ar}</h3>
                        {book.author_ar && <p className="text-xs text-gray-400 mt-1">{book.author_ar}</p>}
                        <p className="text-xs text-[#0284C7] font-semibold mt-2 bg-[#F4F9FE] inline-block px-3 py-1 rounded-full">{getBookDisplayCount(book)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          // --- Chapters & Hadiths View ---
          <>
            <button onClick={() => { setSelectedBook(null); cleanupAudio(); }} className="flex items-center gap-2 text-[#0284C7] font-bold mb-5 bg-white px-4 py-2 rounded-full shadow-sm border border-[#0284C7]/10 w-fit">
              <ArrowRight size={18} /> عودة لقائمة الكتب
            </button>

            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              
              {/* Chapters Sidebar */}
              <aside className="bg-white rounded-3xl border border-[#0284C7]/10 p-4 h-fit lg:sticky lg:top-24 shadow-sm flex flex-col max-h-[75vh]">
                <h3 className="font-bold text-slate-800 mb-3">الأبواب ({arabicDigits(chapters.length)})</h3>
                <div className="bg-[#F4F9FE] rounded-2xl px-3 py-2 flex items-center gap-2 mb-3">
                  <Search size={16} className="text-[#0284C7] shrink-0" />
                  <input value={chapterSearch} onChange={e => setChapterSearch(e.target.value)} placeholder="بحث في الأبواب..." className="w-full bg-transparent outline-none text-xs font-bold text-slate-800" />
                </div>
                <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                  {chaptersLoading ? <div className="p-5 text-center"><Loader2 className="animate-spin text-[#0284C7] mx-auto" size={24}/></div> :
                   filteredChapters.map(chapter => (
                    <button key={chapter.id} onClick={() => { cleanupAudio(); setSelectedChapterId(chapter.id) }} className={`w-full text-right p-3 rounded-2xl border transition ${String(selectedChapterId) === String(chapter.id) ? 'bg-[#0284C7] text-white border-[#0284C7]' : 'bg-[#F4F9FE] border-transparent hover:border-[#0284C7]/40 text-slate-700'}`}>
                      <p className="font-bold text-sm leading-relaxed">{chapter.name_ar || `الباب ${chapter.id}`}</p>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Hadith Content & Player */}
              <section className="min-w-0">
                <div className="bg-white rounded-3xl border border-[#0284C7]/10 p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm mb-5">
                  <div>
                    <p className="text-xs text-gray-400">الباب الحالي</p>
                    <h3 className="font-bold text-lg text-slate-800 mt-1">{currentChapter?.name_ar || 'جاري تحميل الباب...'}</h3>
                  </div>
                  <div className="bg-[#F4F9FE] rounded-full px-4 py-1.5 flex items-center gap-2">
                    <Search size={16} className="text-[#0284C7]" />
                    <input value={hadithSearch} onChange={e => setHadithSearch(e.target.value)} placeholder="بحث برقم أو نص الحديث..." className="outline-none bg-transparent text-sm font-bold w-48 text-slate-800" />
                  </div>
                </div>

                {hadithsLoading ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#0284C7]" size={36} /></div>
                ) : selectedHadith && (
                  <article className="bg-white rounded-[2rem] border border-[#0284C7]/10 shadow-lg p-5 sm:p-8 flex flex-col">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-[#F4F9FE] border border-[#D97706]/30 text-[#D97706] px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2">
                        <Bookmark size={14} fill="currentColor"/> حديث {arabicDigits(selectedHadith.idInBook || selectedHadith.id)}
                      </span>
                      <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">
                        {arabicDigits(currentHadithIndex + 1)} من {arabicDigits(hadiths.length)}
                      </span>
                    </div>

                    {/* Text */}
                    <div className="bg-[#F4F9FE] p-6 sm:p-8 rounded-3xl border border-[#0284C7]/10 flex-1 relative">
                       {selectedHadith.english?.narrator && (
                          <div className="text-xs font-bold text-[#D97706] mb-3">الراوي: {selectedHadith.english.narrator}</div>
                       )}
                      <p className="font-uthmani text-2xl sm:text-3xl leading-[2.25] text-slate-800 text-justify">
                        {selectedHadith.arabic}
                      </p>
                    </div>

                    {/* Elegant Mini Audio Player */}
                    <div className="mt-6 bg-slate-50 rounded-[1.5rem] border border-slate-200 p-4 sm:p-5 relative overflow-hidden shadow-inner">
                      
                      {/* Audio Error Banner */}
                      {audioError && <div className="mb-3 text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg text-center border border-red-100">{audioError}</div>}
                      
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        {/* Play/Pause Button */}
                        <button
                          onClick={() => handlePlayHadith(selectedHadith)}
                          className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center text-white shadow-md transition-all transform hover:scale-105 active:scale-95 ${isPlaying ? 'bg-[#D97706] animate-pulse-slow' : 'bg-[#0284C7]'}`}
                        >
                          {isAudioLoading ? <Loader2 size={28} className="animate-spin" /> : (isPlaying ? <PauseCircle size={32} /> : <Play size={32} className="ml-1" />)}
                        </button>

                        <div className="flex-1 w-full">
                           <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                {audioSource === 'human' ? <><span className="text-emerald-600">🎙</span> تسجيل بشري</> : (audioSource === 'ai' ? <><span className="text-[#0284C7]">🔊</span> قراءة ذكية</> : 'استماع للحديث')}
                              </span>
                              
                              <div className="text-xs text-slate-500 font-bold bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                {formatTime(currentTime)} / {formatTime(displayDuration)}
                              </div>
                           </div>
                           
                           {/* Custom Progress Bar */}
                           <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden relative">
                             <div 
                               className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0284C7] to-[#D97706] transition-all duration-300 ease-linear rounded-full"
                               style={{ width: `${displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0}%`, transformOrigin: 'right' }} 
                             />
                           </div>
                        </div>

                        {/* Player Tools */}
                        <div className="flex items-center gap-2 sm:border-r sm:border-slate-300 sm:pr-4">
                           <button onClick={() => setIsAudioSettingsOpen(!isAudioSettingsOpen)} className={`p-2.5 rounded-full transition ${isAudioSettingsOpen ? 'bg-[#0284C7] text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                              <Settings2 size={20} />
                           </button>
                           {audioSettings.repeat > 0 && (
                             <span className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold text-[#D97706] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                               <Repeat size={10}/> {arabicDigits(audioSettings.repeat)}
                             </span>
                           )}
                        </div>
                      </div>

                      {/* Settings Drawer */}
                      {isAudioSettingsOpen && (
                        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl shadow-sm">
                           <div>
                             <p className="text-[10px] text-slate-400 mb-1 font-bold">السرعة</p>
                             <select value={audioSettings.speed} onChange={e => updateAudioSettings({ speed: Number(e.target.value) })} className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-[#0284C7]">
                                <option value={0.75}>٠٫٧٥×</option><option value={1}>١×</option><option value={1.25}>١٫٢٥×</option><option value={1.5}>١٫٥×</option><option value={2}>٢×</option>
                             </select>
                           </div>
                           <div>
                             <p className="text-[10px] text-slate-400 mb-1 font-bold">التكرار</p>
                             <select value={audioSettings.repeat} onChange={e => updateAudioSettings({ repeat: Number(e.target.value) })} className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-[#0284C7]">
                                <option value={0}>بدون</option><option value={1}>مرة</option><option value={2}>مرتين</option><option value={3}>٣ مرات</option><option value={5}>٥ مرات</option><option value={10}>١٠ مرات</option>
                             </select>
                           </div>
                           <div className="col-span-2">
                             <p className="text-[10px] text-slate-400 mb-1 font-bold">صوت الذكاء الاصطناعي (عند غياب البشري)</p>
                             <select value={audioSettings.voice} onChange={e => updateAudioSettings({ voice: e.target.value })} className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-[#0284C7]">
                                <option value="ar-SA-HamedNeural">حامد (السعودية)</option><option value="ar-EG-ShakirNeural">شاكر (مصر)</option><option value="ar-OM-AbdullahNeural">عبدالله (عُمان)</option><option value="ar-AE-HamdanNeural">حمدان (الإمارات)</option>
                             </select>
                           </div>
                           <div className="col-span-2 sm:col-span-4 flex items-center justify-between bg-[#F4F9FE] p-2 rounded-lg mt-1">
                             <span className="text-xs font-bold text-slate-700">تشغيل الحديث التالي تلقائياً</span>
                             <button onClick={() => updateAudioSettings({ autoNext: !audioSettings.autoNext })} className={`w-10 h-5 rounded-full relative transition-colors ${audioSettings.autoNext ? 'bg-[#0284C7]' : 'bg-slate-300'}`}>
                                <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${audioSettings.autoNext ? 'translate-x-5' : 'translate-x-0'}`}/>
                             </button>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Actions & Navigation */}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button onClick={() => goToHadith(-1)} disabled={currentHadithIndex <= 0} className="flex-1 min-w-[100px] rounded-xl bg-[#F4F9FE] text-[#0284C7] py-3 font-bold text-sm border border-[#0284C7]/20 disabled:opacity-50 hover:bg-[#0284C7] hover:text-white transition">السابق</button>
                      <button onClick={() => goToHadith(1)} disabled={currentHadithIndex >= hadiths.length - 1} className="flex-1 min-w-[100px] rounded-xl bg-[#F4F9FE] text-[#0284C7] py-3 font-bold text-sm border border-[#0284C7]/20 disabled:opacity-50 hover:bg-[#0284C7] hover:text-white transition">التالي</button>
                      
                      <div className="flex gap-2 flex-wrap flex-1 min-w-[200px] justify-end">
                        <button onClick={copyHadith} title="نسخ النص" className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-[#0284C7] hover:text-white transition">
                          {copied ? <Check size={18}/> : <Copy size={18}/>}
                        </button>
                        <button onClick={shareHadith} title="مشاركة" className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-[#0284C7] hover:text-white transition">
                          <Share2 size={18}/>
                        </button>
                        <button onClick={toggleFavorite} title="حفظ بالمفضلة" className={`w-12 h-12 rounded-xl flex items-center justify-center border transition ${selectedIsFavorite ? 'bg-[#D97706] text-white border-[#D97706]' : 'bg-slate-50 text-[#D97706] border-slate-200 hover:bg-amber-50'}`}>
                          <Bookmark size={18} fill={selectedIsFavorite ? 'currentColor' : 'none'}/>
                        </button>
                        <button onClick={designHadithAsImage} disabled={designLoading} title="تصميم صورة" className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-[#0284C7] hover:text-white transition disabled:opacity-50">
                          {designLoading ? <Loader2 size={18} className="animate-spin"/> : <ImageIcon size={18}/>}
                        </button>
                      </div>
                    </div>
                  </article>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {/* Image Preview Modal */}
      {designUrl && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDesignUrl(null)}>
          <div className="relative max-w-lg w-full bg-white p-3 rounded-[2rem] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-2 py-1 mb-2">
              <p className="font-bold text-slate-800">معاينة وتنزيل الصورة</p>
              <button onClick={() => setDesignUrl(null)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500"><X size={18}/></button>
            </div>
            <img src={designUrl} alt="تصميم الحديث" className="w-full rounded-2xl block bg-[#F4F9FE]" />
            <p className="text-center text-xs font-bold text-emerald-600 mt-3 mb-1">تم حفظ الصورة بنجاح في جهازك ✓</p>
          </div>
        </div>
      )}
    </div>
  )
}
