"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { getHumanHadithAudio, HumanHadithAudio } from '@/lib/hadith-human-audio'
import {
  saveHadithOffline,
  getOfflineHadiths,
  getOfflineAudioBlob,
  removeHadithOffline,
  clearAllOfflineData,
  getStorageStats,
  SavedHadith
} from '@/lib/offline-storage'
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  DownloadCloud,
  ExternalLink,
  HardDrive,
  Loader2,
  PauseCircle,
  Play,
  PlayCircle,
  Repeat,
  Search,
  Settings2,
  Share2,
  Trash2,
  Volume2,
  X,
  WifiOff
} from 'lucide-react'

// --- Types ---
type HadithBook = { id: string; name_ar: string; name_en?: string; category?: string; hadithCount?: number; author_ar?: string }
type HadithChapter = { id: string | number; name_ar?: string; hadithCount?: number }
type Hadith = { id: number; idInBook?: number; chapterId?: number; bookId?: number; arabic?: string; english?: { narrator?: string; text?: string } }
type SelectedBook = HadithBook | null
type ResumeState = { bookId: string; chapterId: string | number; hadithId: number; savedAt: number }

type AudioSettings = { speed: number; repeat: number; autoNext: boolean }

const API_BASE = '/api/hadith'
const FAVORITES_KEY = 'samee3_hadith_favorites'
const RESUME_KEY = 'samee3_hadith_resume'
const AUDIO_SETTINGS_KEY = 'samee3_hadith_settings'

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
]
const BOOK_CATEGORY_ORDER = ['الكتب التسعة', 'كتب أخرى']

// --- Utils ---
function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}
function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '٠٠:٠٠'
  const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60)
  return `${arabicDigits(m.toString().padStart(2, '0'))}:${arabicDigits(s.toString().padStart(2, '0'))}`
}
function formatBytes(bytes: number) {
  if (bytes === 0) return '٠ ميغابايت'
  const mb = (bytes / (1024 * 1024)).toFixed(2)
  return `${arabicDigits(mb)} ميغابايت`
}
function extractBooks(payload: any): HadithBook[] {
  const src = payload?.books || payload?.data?.books || payload?.collections || payload?.data || []
  if (!Array.isArray(src)) return []
  return src.map((b: any) => ({
    id: String(b.id || b.bookId || b.slug || ''),
    name_ar: String(b.name_ar || b.nameArabic || b.name || ''),
    category: BOOK_CATEGORY_ORDER.find(c => String(b.category || '').includes(c === 'الكتب التسعة' ? '9' : '')) || 'كتب أخرى',
    hadithCount: Number(b.hadithCount ?? b.total_hadiths ?? b.count ?? 0),
    author_ar: b.author_ar || '',
  })).filter((b: HadithBook) => b.id && b.name_ar)
}
function extractChapters(payload: any): HadithChapter[] {
  const src = payload?.chapters || payload?.data?.chapters || payload?.book?.chapters || []
  if (!Array.isArray(src)) return []
  return src.map((c: any, i: number) => ({
    id: c.id ?? c.chapterId ?? c.number ?? i + 1,
    name_ar: c.name_ar || c.nameArabic || c.name || '',
    hadithCount: Number(c.hadithCount ?? c.count ?? 0),
  })).filter((c: HadithChapter) => c.id !== undefined && c.id !== null)
}
function extractHadiths(payload: any): Hadith[] {
  const src = payload?.hadiths || payload?.data?.hadiths || payload?.data || []
  if (!Array.isArray(src)) return []
  return src.map((h: any) => ({
    id: Number(h.id ?? h.idInBook ?? h.number ?? 0),
    idInBook: Number(h.idInBook ?? h.number ?? h.id ?? 0),
    chapterId: Number(h.chapterId ?? h.chapter_id ?? 0),
    bookId: Number(h.bookId ?? h.book_id ?? 0),
    arabic: h.arabic || h.arab || h.text_ar || h.text || '',
    english: { narrator: h.english?.narrator || h.narrator || '' },
  })).filter((h: Hadith) => h.id > 0)
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
  
  const [copied, setCopied] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)

  // Audio Player State
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ speed: 1, repeat: 0, autoNext: false })
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [displayDuration, setDisplayDuration] = useState(0)
  
  // Offline / Downloads State
  const [isDownloadsModalOpen, setIsDownloadsModalOpen] = useState(false)
  const [offlineHadiths, setOfflineHadiths] = useState<SavedHadith[]>([])
  const [storageStats, setStorageStats] = useState({ hadithsCount: 0, audioCount: 0, sizeBytes: 0 })
  const [isSavingOffline, setIsSavingOffline] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false) // Triggered if fetch fails

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const activeHumanMeta = useRef<HumanHadithAudio | null>(null)
  const repeatCounterRef = useRef(0)
  const isComponentMounted = useRef(true)

  // --- Initial Load ---
  useEffect(() => {
    isComponentMounted.current = true
    loadBooks()
    refreshOfflineData()
    try {
      if (localStorage.getItem(FAVORITES_KEY)) setFavoriteIds(JSON.parse(localStorage.getItem(FAVORITES_KEY)!))
      if (localStorage.getItem(RESUME_KEY)) setResumeState(JSON.parse(localStorage.getItem(RESUME_KEY)!))
      if (localStorage.getItem(AUDIO_SETTINGS_KEY)) setAudioSettings(JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY)!))
    } catch {}
    return () => { isComponentMounted.current = false; cleanupAudio() }
  }, [])

  const refreshOfflineData = async () => {
    try {
      const data = await getOfflineHadiths()
      const stats = await getStorageStats()
      setOfflineHadiths(data)
      setStorageStats(stats)
    } catch (err) { console.error('Failed to load offline data', err) }
  }

  const loadBooks = useCallback(async () => {
    setBooksLoading(true)
    try {
      const res = await fetch(`${API_BASE}/list`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const payload = await res.json()
      const remoteBooks = extractBooks(payload)
      if (remoteBooks.length) setBooks(remoteBooks)
      setIsOfflineMode(false)
    } catch (err) {
      setIsOfflineMode(true) // Switch to offline gracefully
    } finally {
      if (isComponentMounted.current) setBooksLoading(false)
    }
  }, [])

  // --- Core Audio Engine (Mapping & Bounds) ---
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current.onended = null; audioRef.current.ontimeupdate = null; audioRef.current.onloadedmetadata = null; audioRef.current.onerror = null
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
    activeHumanMeta.current = null
  }, [])

  const updateAudioSettings = (newSettings: Partial<AudioSettings>) => {
    setAudioSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(updated))
      if (audioRef.current) audioRef.current.playbackRate = updated.speed
      return updated
    })
  }

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || !isPlaying || !activeHumanMeta.current) return
    const currentAudioTime = audioRef.current.currentTime
    const meta = activeHumanMeta.current

    if (currentAudioTime >= meta.endSeconds) {
      handlePlaybackEnd()
    } else {
      setCurrentTime(Math.max(0, currentAudioTime - meta.startSeconds))
    }
  }, [isPlaying])

  const currentHadithIndex = useMemo(() => {
    if (!selectedHadith || !hadiths.length) return -1
    return hadiths.findIndex(h => (h.idInBook || h.id) === (selectedHadith.idInBook || selectedHadith.id))
  }, [selectedHadith, hadiths])

  const handlePlaybackEnd = useCallback(() => {
    if (!audioRef.current || !activeHumanMeta.current) return
    audioRef.current.pause()
    
    if (repeatCounterRef.current < audioSettings.repeat) {
      repeatCounterRef.current++
      audioRef.current.currentTime = activeHumanMeta.current.startSeconds
      audioRef.current.play().catch(() => cleanupAudio())
    } else {
      repeatCounterRef.current = 0
      cleanupAudio()
      
      // Auto Next ONLY if the next hadith has human audio available
      if (audioSettings.autoNext && selectedBook && currentHadithIndex !== -1 && currentHadithIndex < hadiths.length - 1) {
        const nextHadith = hadiths[currentHadithIndex + 1]
        const nextMeta = getHumanHadithAudio(selectedBook.id, nextHadith.idInBook || nextHadith.id)
        
        openHadith(nextHadith, !!nextMeta) // Autoplay if next has audio
      }
    }
  }, [audioSettings.repeat, audioSettings.autoNext, currentHadithIndex, hadiths, selectedBook, cleanupAudio])

  const handlePlayHadith = async (hadith: Hadith = selectedHadith!) => {
    if (!selectedBook || !hadith) return
    if (isPlaying) { cleanupAudio(); return }

    cleanupAudio()
    setIsAudioLoading(true)
    repeatCounterRef.current = 0

    const hadithNumber = hadith.idInBook || hadith.id
    const meta = getHumanHadithAudio(selectedBook.id, hadithNumber)
    const hadithIdStr = `${selectedBook.id}:${hadithNumber}`

    if (!meta) { setIsAudioLoading(false); return }

    try {
      let finalAudioUrl = meta.url
      // Check offline storage first
      const offlineBlob = await getOfflineAudioBlob(hadithIdStr)
      if (offlineBlob) {
        const objectUrl = URL.createObjectURL(offlineBlob)
        audioObjectUrlRef.current = objectUrl
        finalAudioUrl = objectUrl
      }

      activeHumanMeta.current = meta
      const audio = new Audio(finalAudioUrl)
      audioRef.current = audio
      audio.playbackRate = audioSettings.speed
      
      setDisplayDuration(meta.endSeconds - meta.startSeconds)

      audio.onloadedmetadata = () => { audio.currentTime = meta.startSeconds }
      audio.ontimeupdate = handleTimeUpdate
      audio.onended = handlePlaybackEnd
      audio.onerror = () => { cleanupAudio(); alert('تعذر تشغيل التسجيل الصوتي. يرجى التحقق من اتصالك بالإنترنت.') }

      await audio.play()
      setIsPlaying(true)
    } catch (err) {
      cleanupAudio()
    } finally {
      setIsAudioLoading(false)
    }
  }

  // --- Data Loading ---
  const loadBookChapters = useCallback(async (book: HadithBook) => {
    setChaptersLoading(true); cleanupAudio(); setSelectedChapterId(null); setHadiths([])
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(book.id)}`)
      if (!res.ok) throw new Error()
      const payload = await res.json()
      const nextChapters = extractChapters(payload)
      setChapters(nextChapters)
      setSelectedBook(book)
      setSelectedChapterId(nextChapters[0]?.id || null)
    } catch (err) {
      alert('تعذر تحميل الأبواب، ربما لعدم توفر إنترنت.')
    } finally { setChaptersLoading(false) }
  }, [cleanupAudio])

  const loadChapterHadiths = useCallback(async (book: HadithBook, chapterId: string | number) => {
    setHadithsLoading(true); cleanupAudio()
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(String(chapterId))}`)
      if (!res.ok) throw new Error()
      const payload = await res.json()
      const nextHadiths = extractHadiths(payload)
      setHadiths(nextHadiths)
      setSelectedHadith(nextHadiths[0] || null)
    } catch (err) {
      // Offline fallback? We can load from IndexedDB if we built an index, but currently offline saves exact hadiths.
    } finally { setHadithsLoading(false) }
  }, [cleanupAudio])

  useEffect(() => {
    if (selectedBook && selectedChapterId !== null) loadChapterHadiths(selectedBook, selectedChapterId)
  }, [selectedBook, selectedChapterId, loadChapterHadiths])

  const openHadith = useCallback((hadith: Hadith, autoPlay = false) => {
    if (!selectedBook || selectedChapterId === null) return
    cleanupAudio()
    setSelectedHadith(hadith)
    const resume = { bookId: selectedBook.id, chapterId: selectedChapterId, hadithId: hadith.idInBook || hadith.id, savedAt: Date.now() }
    setResumeState(resume)
    localStorage.setItem(RESUME_KEY, JSON.stringify(resume))
    if (autoPlay) setTimeout(() => handlePlayHadith(hadith), 100)
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

  const copyHadith = async () => {
    if (!selectedBook || !selectedHadith) return
    const text = `${selectedHadith.arabic}\n\nالراوي: ${selectedHadith.english?.narrator || '-'}\nالمصدر: ${selectedBook.name_ar} (رقم ${selectedHadith.idInBook || selectedHadith.id})`
    await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const shareHadith = async () => {
    if (!selectedBook || !selectedHadith) return
    const text = `${selectedHadith.arabic}\nالمصدر: ${selectedBook.name_ar} (رقم ${selectedHadith.idInBook || selectedHadith.id})`
    try { if (navigator.share) await navigator.share({ text }); else await copyHadith() } catch {}
  }

  const handleSaveOffline = async () => {
    if (!selectedBook || !selectedHadith || !currentChapter) return
    setIsSavingOffline(true)
    const hadithNumber = selectedHadith.idInBook || selectedHadith.id
    const meta = getHumanHadithAudio(selectedBook.id, hadithNumber)
    
    const data: SavedHadith = {
      id: `${selectedBook.id}:${hadithNumber}`,
      bookId: selectedBook.id,
      bookName: selectedBook.name_ar,
      chapterName: currentChapter.name_ar || '',
      hadithNumber: hadithNumber,
      arabic: selectedHadith.arabic || '',
      narrator: selectedHadith.english?.narrator || '',
      hasAudio: false,
      savedAt: Date.now()
    }

    try {
      await saveHadithOffline(data, meta?.url)
      await refreshOfflineData()
      alert('تم حفظ الحديث بنجاح للاستماع والقراءة بدون إنترنت ✓')
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ. تأكد من اتصالك أو مساحة التخزين.')
    } finally {
      setIsSavingOffline(false)
    }
  }

  const handleDeleteOffline = async (id: string) => {
    await removeHadithOffline(id)
    await refreshOfflineData()
  }

  // --- Rendering Variables ---
  const currentHadithNumber = selectedHadith ? (selectedHadith.idInBook || selectedHadith.id) : 0
  const humanAudioMeta = selectedBook ? getHumanHadithAudio(selectedBook.id, currentHadithNumber) : null
  const isCurrentlySavedOffline = offlineHadiths.some(h => h.id === `${selectedBook?.id}:${currentHadithNumber}`)

  const filteredBooks = books.filter(b => b.name_ar.includes(bookSearch))
  const groupedBooks = BOOK_CATEGORY_ORDER.map(c => ({ category: c, books: filteredBooks.filter(b => (b.category || 'كتب أخرى') === c) })).filter(g => g.books.length)
  const filteredChapters = chapters.filter(c => (c.name_ar || '').includes(chapterSearch))
  const resumeBook = resumeState ? books.find((b) => b.id === resumeState.bookId) || null : null

  return (
    <div className="min-h-screen bg-[#F4F9FE] flex flex-col pb-32 font-sans" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F4F9FE]/95 backdrop-blur-md border-b border-[#0284C7]/15 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#0284C7] hover:bg-[#0284C7] hover:text-white transition">
            <ChevronRight size={22} />
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="text-[#D97706]" size={22} />
              <h1 className="font-bold text-lg text-slate-800">مكتبة الأحاديث</h1>
            </div>
            {isOfflineMode && <div className="text-[10px] font-bold text-red-500 mt-0.5 flex items-center justify-center gap-1"><WifiOff size={10}/> وضع عدم الاتصال</div>}
          </div>
          <button onClick={() => setIsDownloadsModalOpen(true)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#0284C7] hover:bg-[#0284C7] hover:text-white transition relative">
            <HardDrive size={20} />
            {storageStats.hadithsCount > 0 && <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{arabicDigits(storageStats.hadithsCount)}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-6">
        {!selectedBook ? (
          // --- Books List ---
          <div className="space-y-6">
            <section className="bg-gradient-to-bl from-[#0284C7] to-[#015f8f] rounded-[2rem] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="font-uthmani text-3xl leading-relaxed">
                  مكتبة حديث رقمية متكاملة.<br/>استمع للتسجيلات الموثوقة واحفظها بدون إنترنت.
                </h2>
              </div>
            </section>

            {resumeBook && resumeState && !isOfflineMode && (
              <button onClick={() => loadBookChapters(resumeBook)} className="w-full text-right bg-white rounded-3xl border border-[#D97706]/30 shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F4F9FE] text-[#D97706] flex items-center justify-center shrink-0"><Bookmark size={24} fill="currentColor" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 font-bold">متابعة القراءة</p>
                    <h3 className="font-bold text-slate-800 mt-0.5 truncate">{resumeBook.name_ar}</h3>
                    <p className="text-xs text-[#0284C7] font-bold mt-1">حديث {arabicDigits(resumeState.hadithId)}</p>
                  </div>
                  <ChevronLeft className="text-[#D97706]" size={22} />
                </div>
              </button>
            )}

            {!isOfflineMode && (
              <div className="bg-white rounded-2xl border border-[#0284C7]/20 px-4 py-3 flex items-center gap-3 shadow-sm">
                <Search size={20} className="text-[#0284C7]" />
                <input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="ابحث عن كتاب..." className="w-full outline-none bg-transparent font-bold text-sm text-slate-800" />
              </div>
            )}

            {booksLoading ? (
              <div className="py-16 flex justify-center text-[#0284C7]"><Loader2 className="animate-spin" size={36} /></div>
            ) : groupedBooks.map(group => (
              <div key={group.category}>
                <h2 className="font-bold text-lg mb-4 text-slate-800 border-r-4 border-[#D97706] pr-3">{group.category}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.books.map(book => (
                    <button key={book.id} onClick={() => loadBookChapters(book)} className="bg-white rounded-3xl p-5 border border-transparent text-right group hover:border-[#0284C7]/30 shadow-sm transition">
                      <h3 className="font-bold text-lg text-slate-800">{book.name_ar}</h3>
                      <p className="text-xs text-[#0284C7] font-semibold mt-2 bg-[#F4F9FE] inline-block px-3 py-1 rounded-full">{arabicDigits(book.hadithCount || 0)} حديث</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // --- Book / Chapters / Hadith ---
          <div className="space-y-5">
            <button onClick={() => { setSelectedBook(null); cleanupAudio() }} className="flex items-center gap-2 text-[#0284C7] font-bold bg-white px-4 py-2 rounded-full shadow-sm border border-[#0284C7]/10 w-fit">
              <ArrowRight size={18} /> عودة للكتب
            </button>

            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              {/* Sidebar: Chapters */}
              <aside className="bg-white rounded-3xl border border-[#0284C7]/10 p-4 h-fit lg:sticky lg:top-24 shadow-sm flex flex-col max-h-[75vh]">
                <h3 className="font-bold text-slate-800 mb-3">الأبواب ({arabicDigits(chapters.length)})</h3>
                <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                  {chaptersLoading ? <div className="p-5 text-center"><Loader2 className="animate-spin text-[#0284C7] mx-auto" size={24}/></div> :
                   filteredChapters.map(chapter => (
                    <button key={chapter.id} onClick={() => { cleanupAudio(); setSelectedChapterId(chapter.id) }} className={`w-full text-right p-3 rounded-2xl border transition ${String(selectedChapterId) === String(chapter.id) ? 'bg-[#0284C7] text-white' : 'bg-[#F4F9FE] text-slate-700 hover:border-[#0284C7]/30'}`}>
                      <p className="font-bold text-sm leading-relaxed">{chapter.name_ar}</p>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Main: Hadith View */}
              <section className="min-w-0">
                {hadithsLoading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#0284C7]" size={36} /></div> : 
                 selectedHadith && (
                  <article className="bg-white rounded-[2rem] border border-[#0284C7]/10 shadow-lg p-5 sm:p-7 flex flex-col">
                    {/* Headers */}
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold mb-1">{selectedBook.name_ar} • {currentChapter?.name_ar}</p>
                        <span className="bg-[#F4F9FE] border border-[#D97706]/30 text-[#D97706] px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 w-fit">
                          <Bookmark size={14} fill="currentColor"/> حديث {arabicDigits(currentHadithNumber)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full">
                        {arabicDigits(currentHadithIndex + 1)} من {arabicDigits(hadiths.length)}
                      </span>
                    </div>

                    {/* Text content */}
                    <div className="bg-[#FCFBF8] p-6 sm:p-8 rounded-3xl border border-slate-200 flex-1 relative mb-6">
                      {selectedHadith.english?.narrator && (
                        <div className="text-xs font-bold text-[#D97706] mb-4 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#D97706]" /> الراوي: {selectedHadith.english.narrator}
                        </div>
                      )}
                      <p className="font-uthmani text-2xl sm:text-3xl leading-[2.25] text-[#0F172A] text-justify">
                        {selectedHadith.arabic}
                      </p>
                    </div>

                    {/* Elegant Audio Player (Render only if Human Audio Exists) */}
                    {humanAudioMeta ? (
                      <div className="bg-slate-50 rounded-[1.5rem] border border-slate-200 p-4 sm:p-5 mb-6 relative overflow-hidden shadow-sm">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <button onClick={() => handlePlayHadith(selectedHadith)} className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-white shadow-md transition-all ${isPlaying ? 'bg-[#D97706] animate-pulse-slow' : 'bg-[#0284C7] hover:scale-105'}`}>
                            {isAudioLoading ? <Loader2 size={24} className="animate-spin" /> : (isPlaying ? <PauseCircle size={28} /> : <Play size={28} className="ml-1" />)}
                          </button>
                          <div className="flex-1 w-full">
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                                🎙 استماع للحديث (تسجيل بشري)
                              </span>
                              <div className="text-xs text-slate-500 font-bold bg-white px-2 py-1 rounded border border-slate-200">
                                {formatTime(currentTime)} / {formatTime(displayDuration)}
                              </div>
                            </div>
                            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden relative">
                              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0284C7] to-[#D97706] transition-all duration-300 ease-linear" style={{ width: `${displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0}%`, transformOrigin: 'right' }} />
                            </div>
                          </div>
                          {/* Tools */}
                          <div className="flex items-center gap-2 sm:border-r sm:border-slate-300 sm:pr-4">
                            <button onClick={() => setIsAudioSettingsOpen(!isAudioSettingsOpen)} className={`p-2 rounded-full transition ${isAudioSettingsOpen ? 'bg-[#0284C7] text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><Settings2 size={18} /></button>
                          </div>
                        </div>

                        {/* Settings Drawer */}
                        {isAudioSettingsOpen && (
                          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 bg-white p-3 rounded-xl shadow-sm">
                            <div>
                              <p className="text-[10px] text-slate-400 mb-1 font-bold">السرعة</p>
                              <select value={audioSettings.speed} onChange={e => updateAudioSettings({ speed: Number(e.target.value) })} className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-[#0284C7]">
                                <option value={0.75}>٠٫٧٥×</option><option value={1}>١×</option><option value={1.25}>١٫٢٥×</option><option value={1.5}>١٫٥×</option><option value={2}>٢×</option>
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 mb-1 font-bold">التكرار</p>
                              <select value={audioSettings.repeat} onChange={e => updateAudioSettings({ repeat: Number(e.target.value) })} className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-[#0284C7]">
                                <option value={0}>بدون</option><option value={1}>مرة</option><option value={2}>مرتين</option><option value={5}>٥ مرات</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex items-center justify-between bg-[#F4F9FE] p-2.5 rounded-lg mt-1">
                              <span className="text-xs font-bold text-slate-700">تشغيل الحديث التالي تلقائياً</span>
                              <button onClick={() => updateAudioSettings({ autoNext: !audioSettings.autoNext })} className={`w-10 h-5 rounded-full relative transition-colors ${audioSettings.autoNext ? 'bg-[#0284C7]' : 'bg-slate-300'}`}>
                                <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${audioSettings.autoNext ? 'translate-x-5' : 'translate-x-0'}`}/>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center mb-6">
                        <p className="text-sm font-bold text-slate-500">لا يتوفر تسجيل صوتي لهذا الحديث حاليًا</p>
                      </div>
                    )}

                    {/* Actions bar */}
                    <div className="flex flex-wrap gap-3 mt-auto">
                      <button onClick={() => goToHadith(-1)} disabled={currentHadithIndex <= 0} className="flex-1 min-w-[90px] rounded-xl bg-[#F4F9FE] text-[#0284C7] py-3 font-bold text-sm border border-[#0284C7]/20 disabled:opacity-40 hover:bg-[#0284C7] hover:text-white transition">السابق</button>
                      <button onClick={() => goToHadith(1)} disabled={currentHadithIndex >= hadiths.length - 1} className="flex-1 min-w-[90px] rounded-xl bg-[#F4F9FE] text-[#0284C7] py-3 font-bold text-sm border border-[#0284C7]/20 disabled:opacity-40 hover:bg-[#0284C7] hover:text-white transition">التالي</button>
                      
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button onClick={copyHadith} title="نسخ النص" className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-[#0284C7] hover:text-white transition">
                          {copied ? <Check size={18}/> : <Copy size={18}/>}
                        </button>
                        <button onClick={shareHadith} title="مشاركة" className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-[#0284C7] hover:text-white transition">
                          <Share2 size={18}/>
                        </button>
                        <button onClick={handleSaveOffline} disabled={isSavingOffline || isCurrentlySavedOffline} title={isCurrentlySavedOffline ? "تم الحفظ" : "حفظ بدون إنترنت"} className={`flex items-center gap-2 px-4 h-12 rounded-xl border font-bold text-sm transition ${isCurrentlySavedOffline ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-[#0284C7] hover:text-white'}`}>
                          {isSavingOffline ? <Loader2 size={18} className="animate-spin" /> : (isCurrentlySavedOffline ? <Check size={18}/> : <DownloadCloud size={18}/>)}
                          <span className="hidden sm:inline">{isCurrentlySavedOffline ? 'محفوظ' : 'حفظ Offline'}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Offline Management Modal */}
      {isDownloadsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsDownloadsModalOpen(false)}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2"><HardDrive className="text-[#0284C7]"/> إدارة التنزيلات</h2>
                <p className="text-xs text-gray-400 mt-1">الأحاديث المحفوظة للعمل بدون إنترنت</p>
              </div>
              <button onClick={() => setIsDownloadsModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-500 transition"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#F4F9FE] p-3 rounded-2xl text-center border border-[#0284C7]/10">
                <p className="text-[10px] font-bold text-slate-500">الأحاديث</p>
                <p className="font-black text-[#0284C7] text-lg">{arabicDigits(storageStats.hadithsCount)}</p>
              </div>
              <div className="bg-[#F4F9FE] p-3 rounded-2xl text-center border border-[#0284C7]/10">
                <p className="text-[10px] font-bold text-slate-500">التسجيلات</p>
                <p className="font-black text-[#0284C7] text-lg">{arabicDigits(storageStats.audioCount)}</p>
              </div>
              <div className="bg-[#F4F9FE] p-3 rounded-2xl text-center border border-[#0284C7]/10">
                <p className="text-[10px] font-bold text-slate-500">المساحة</p>
                <p className="font-black text-[#0284C7] text-sm mt-1">{formatBytes(storageStats.sizeBytes)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {offlineHadiths.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-bold text-sm">لا توجد أحاديث محفوظة حاليًا.</div>
              ) : (
                offlineHadiths.map(h => (
                  <div key={h.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#D97706] mb-0.5 truncate">{h.bookName}</p>
                      <p className="font-bold text-sm text-slate-800">حديث {arabicDigits(h.hadithNumber)}</p>
                      {h.hasAudio && <p className="text-[10px] text-emerald-600 font-bold mt-1">يحتوي تسجيل صوتي</p>}
                    </div>
                    <button onClick={() => handleDeleteOffline(h.id)} className="w-9 h-9 rounded-full bg-white border border-slate-200 text-red-500 flex items-center justify-center shrink-0 hover:bg-red-50">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))
              )}
            </div>

            {offlineHadiths.length > 0 && (
              <button onClick={async () => { if(confirm('هل أنت متأكد من حذف جميع التنزيلات؟')) { await clearAllOfflineData(); refreshOfflineData(); } }} className="mt-5 w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition">
                حذف جميع التنزيلات
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
