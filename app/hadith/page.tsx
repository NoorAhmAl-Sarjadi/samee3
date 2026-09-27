"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  Pause,
  Play,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react"
import {
  getHumanBookAudio,
  getHumanChapterAudio,
  getHumanHadithAudio,
  type HumanAudioCollection,
  type HumanAudioTrack,
} from "@/lib/hadith-human-audio"

type HadithBook = {
  id: string
  name_ar: string
  name_en?: string
  category?: string
  hadithCount?: number
  author_ar?: string
  author_en?: string
  introduction?: string
  description?: string
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
  audioUrl?: string
  english?: {
    narrator?: string
    text?: string
  }
}

type ResumeState = {
  bookId: string
  chapterId: string | number
  hadithId: number
  savedAt: number
}

type AudioTarget = {
  kind: "book" | "chapter" | "hadith"
  label: string
  collection?: HumanAudioCollection
  tracks: HumanAudioTrack[]
}

const API_BASE = "/api/hadith"
const REMOTE_DOCS_URL = "https://alfurqan.online/docs"
const FAVORITES_KEY = "samee3_hadith_favorites"
const RESUME_KEY = "samee3_hadith_resume"

const FALLBACK_BOOKS: HadithBook[] = [
  { id: "bukhari", name_ar: "صحيح البخاري", name_en: "Sahih al-Bukhari", category: "الكتب التسعة" },
  { id: "muslim", name_ar: "صحيح مسلم", name_en: "Sahih Muslim", category: "الكتب التسعة" },
  { id: "abudawud", name_ar: "سنن أبي داود", name_en: "Sunan Abu Dawud", category: "الكتب التسعة" },
  { id: "nasai", name_ar: "سنن النسائي", name_en: "Sunan an-Nasa'i", category: "الكتب التسعة" },
  { id: "tirmidhi", name_ar: "جامع الترمذي", name_en: "Jami at-Tirmidhi", category: "الكتب التسعة" },
  { id: "ibnmajah", name_ar: "سنن ابن ماجه", name_en: "Sunan Ibn Majah", category: "الكتب التسعة" },
  { id: "malik", name_ar: "موطأ مالك", name_en: "Muwatta Malik", category: "الكتب التسعة" },
  { id: "darimi", name_ar: "سنن الدارمي", name_en: "Sunan ad-Darimi", category: "الكتب التسعة" },
  { id: "ahmed", name_ar: "مسند أحمد", name_en: "Musnad Ahmad", category: "الكتب التسعة" },
  { id: "nawawi40", name_ar: "الأربعون النووية", name_en: "An-Nawawi's Forty Hadith", category: "الأربعينات" },
  { id: "qudsi40", name_ar: "الأربعون حديثًا قدسيًا", name_en: "Forty Hadith Qudsi", category: "الأربعينات" },
  { id: "riyad_assalihin", name_ar: "رياض الصالحين", name_en: "Riyad as-Salihin", category: "كتب أخرى" },
  { id: "mishkat_almasabih", name_ar: "مشكاة المصابيح", name_en: "Mishkat al-Masabih", category: "كتب أخرى" },
  { id: "bulugh_almaram", name_ar: "بلوغ المرام", name_en: "Bulugh al-Maram", category: "كتب أخرى" },
  { id: "aladab_almufrad", name_ar: "الأدب المفرد", name_en: "Al-Adab Al-Mufrad", category: "كتب أخرى" },
  { id: "shamail_muhammadiyah", name_ar: "الشمائل المحمدية", name_en: "Shamail Muhammadiyah", category: "كتب أخرى" },
]

const BOOK_CATEGORY_ORDER = ["الكتب التسعة", "الأربعينات", "كتب أخرى"]

function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
}

function normalizeBookCategory(category: unknown) {
  const value = String(category || "").trim().toLowerCase()
  if (["the_9_books", "the 9 books", "nine books", "الكتب التسعة"].includes(value)) return "الكتب التسعة"
  if (["forties", "forty hadith", "the forties", "الأربعينات"].includes(value)) return "الأربعينات"
  return "كتب أخرى"
}

function getBookDisplayCount(book: HadithBook) {
  return book.hadithCount && book.hadithCount > 0 ? `${arabicDigits(book.hadithCount)} حديث` : null
}

function extractBooks(payload: unknown): HadithBook[] {
  const data = payload as any
  const source = data?.books || data?.data?.books || data?.collections || data?.data || []
  if (!Array.isArray(source)) return []

  return source
    .map((book: any) => ({
      id: String(book.id ?? book.bookId ?? book.slug ?? ""),
      name_ar: String(book.name_ar ?? book.nameArabic ?? book.arabicName ?? book.arabic?.name ?? book.name ?? ""),
      name_en: book.name_en ?? book.nameEnglish ?? book.englishName ?? book.english?.name ?? "",
      category: normalizeBookCategory(book.category ?? book.category_id ?? book.group ?? book.collection),
      hadithCount: Number(book.hadithCount ?? book.hadith_count ?? book.numberOfHadith ?? book.total_hadiths ?? book.count ?? 0),
      author_ar: book.author_ar ?? book.authorArabic ?? "",
      author_en: book.author_en ?? book.authorEnglish ?? "",
      introduction: book.introduction ?? book.intro ?? book.preface ?? book.preamble ?? "",
      description: book.description ?? book.summary ?? book.about ?? "",
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
        name_ar: chapter.name_ar ?? chapter.nameArabic ?? chapter.arabicName ?? chapter.arabic ?? chapter.name ?? "",
        name_en: chapter.name_en ?? chapter.nameEnglish ?? chapter.english ?? "",
        hadithCount: Number(chapter.hadithCount ?? chapter.hadith_count ?? chapter.count ?? 0),
        firstHadith: Number(chapter.firstHadith ?? chapter.first_hadith ?? chapter.start ?? chapter.startHadith ?? range[0] ?? 0),
        lastHadith: Number(chapter.lastHadith ?? chapter.last_hadith ?? chapter.end ?? chapter.endHadith ?? range[1] ?? 0),
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
      arabic: hadith.arabic ?? hadith.arab ?? hadith.text_ar ?? hadith.text ?? "",
      audioUrl:
        typeof hadith.audioUrl === "string"
          ? hadith.audioUrl
          : typeof hadith.audio_url === "string"
            ? hadith.audio_url
            : typeof hadith.audio === "string"
              ? hadith.audio
              : typeof hadith.audio?.url === "string"
                ? hadith.audio.url
                : "",
      english: {
        narrator: hadith.english?.narrator ?? hadith.narrator ?? "",
        text: hadith.english?.text ?? hadith.text_en ?? "",
      },
    }))
    .filter((hadith: Hadith) => hadith.id > 0)
}

function getHadithNumber(hadith: Hadith) {
  return hadith.idInBook || hadith.id
}

function getFavoriteKey(book: HadithBook, hadith: Hadith) {
  return `${book.id}:${getHadithNumber(hadith)}`
}

function getShareText(book: HadithBook, hadith: Hadith) {
  return `${hadith.arabic || ""}\n\n${book.name_ar} — حديث ${arabicDigits(getHadithNumber(hadith))}`
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "٠٠:٠٠"
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])
}

export default function HadithPage() {
  const [books, setBooks] = useState<HadithBook[]>(FALLBACK_BOOKS)
  const [selectedBook, setSelectedBook] = useState<HadithBook | null>(null)
  const [chapters, setChapters] = useState<HadithChapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string | number | null>(null)
  const [hadiths, setHadiths] = useState<Hadith[]>([])
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null)

  const [bookSearch, setBookSearch] = useState("")
  const [chapterSearch, setChapterSearch] = useState("")
  const [hadithSearch, setHadithSearch] = useState("")

  const [booksLoading, setBooksLoading] = useState(true)
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [hadithsLoading, setHadithsLoading] = useState(false)
  const [error, setError] = useState("")
  const [bookError, setBookError] = useState("")

  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)

  const [isReadingAudio, setIsReadingAudio] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState("")
  const [audioRate, setAudioRate] = useState(1)
  const [audioTarget, setAudioTarget] = useState<AudioTarget | null>(null)
  const [audioTrackIndex, setAudioTrackIndex] = useState(0)
  const [audioSourceLabel, setAudioSourceLabel] = useState("")
  const [currentTime, setCurrentTime] = useState(0)
  const [displayDuration, setDisplayDuration] = useState(0)

  const [designUrl, setDesignUrl] = useState<string | null>(null)
  const [designLoading, setDesignLoading] = useState(false)
  const [designFileName, setDesignFileName] = useState("samee3-hadith.png")

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioQueueRef = useRef<HumanAudioTrack[]>([])
  const audioTrackIndexRef = useRef(0)

  const fetchJson = useCallback(async (url: string) => {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    const text = await response.text()
    let payload: any = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      throw new Error("استجابة غير صالحة من مصدر الأحاديث.")
    }

    if (!response.ok) throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`)
    return payload
  }, [])

  const clearAudioElement = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
      audio.ontimeupdate = null
      audio.onloadedmetadata = null
      audio.onloadeddata = null
    }
    audioRef.current = null
  }, [])

  const stopHadithAudio = useCallback(() => {
    clearAudioElement()
    audioQueueRef.current = []
    audioTrackIndexRef.current = 0
    setAudioTrackIndex(0)
    setAudioTarget(null)
    setIsReadingAudio(false)
    setAudioLoading(false)
    setAudioSourceLabel("")
    setCurrentTime(0)
    setDisplayDuration(0)
  }, [clearAudioElement])

  const currentChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)) || null,
    [chapters, selectedChapterId],
  )

  const filteredBooks = useMemo(() => {
    const query = normalizeArabic(bookSearch.trim())
    if (!query) return books
    return books.filter((book) => normalizeArabic(`${book.name_ar} ${book.name_en || ""} ${book.author_ar || ""}`).includes(query))
  }, [books, bookSearch])

  const groupedBooks = useMemo(() => {
    const groups = BOOK_CATEGORY_ORDER.map((category) => ({
      category,
      books: filteredBooks.filter((book) => (book.category || "كتب أخرى") === category),
    })).filter((group) => group.books.length)

    const unknown = filteredBooks.filter((book) => !BOOK_CATEGORY_ORDER.includes(book.category || ""))
    if (unknown.length) groups.push({ category: "كتب أخرى", books: unknown })
    return groups
  }, [filteredBooks])

  const filteredChapters = useMemo(() => {
    const query = normalizeArabic(chapterSearch.trim())
    if (!query) return chapters
    return chapters.filter((chapter) => normalizeArabic(`${chapter.name_ar || ""} ${chapter.name_en || ""} ${chapter.id}`).includes(query))
  }, [chapterSearch, chapters])

  const filteredHadiths = useMemo(() => {
    const query = normalizeArabic(hadithSearch.trim())
    if (!query) return hadiths
    return hadiths.filter((hadith) => normalizeArabic(`${hadith.arabic || ""} ${hadith.english?.narrator || ""} ${hadith.english?.text || ""} ${getHadithNumber(hadith)}`).includes(query))
  }, [hadithSearch, hadiths])

  const visibleHadith = useMemo(() => {
    if (!filteredHadiths.length) return null
    if (selectedHadith) {
      const same = filteredHadiths.find((hadith) => getHadithNumber(hadith) === getHadithNumber(selectedHadith))
      if (same) return same
    }
    return filteredHadiths[0]
  }, [filteredHadiths, selectedHadith])

  const currentHadithIndex = useMemo(() => {
    if (!visibleHadith) return -1
    return filteredHadiths.findIndex((hadith) => getHadithNumber(hadith) === getHadithNumber(visibleHadith))
  }, [filteredHadiths, visibleHadith])

  const bookAudio = useMemo(
    () => (selectedBook ? getHumanBookAudio(selectedBook.id) : null),
    [selectedBook],
  )

  const chapterAudio = useMemo(
    () => (selectedBook && currentChapter ? getHumanChapterAudio(selectedBook.id, currentChapter.id, currentChapter.name_ar) : null),
    [currentChapter, selectedBook],
  )

  const hadithAudio = useMemo(
    () => (selectedBook && visibleHadith ? getHumanHadithAudio(selectedBook.id, getHadithNumber(visibleHadith)) : null),
    [selectedBook, visibleHadith],
  )

  const selectedIsFavorite = Boolean(
    selectedBook && visibleHadith && favoriteIds.includes(getFavoriteKey(selectedBook, visibleHadith)),
  )

  const loadBooks = useCallback(async () => {
    setBooksLoading(true)
    setBookError("")
    try {
      const payload = await fetchJson(`${API_BASE}/list`)
      const remoteBooks = extractBooks(payload)
      if (remoteBooks.length) setBooks(remoteBooks)
      else setBookError("تعذر قراءة قائمة الكتب من مصدر البيانات؛ تم استخدام القائمة الاحتياطية.")
    } catch (err) {
      console.error(err)
      setBookError("تعذر الاتصال بمصدر كتب الحديث حاليًا؛ تظهر لك القائمة الاحتياطية.")
    } finally {
      setBooksLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    void loadBooks()

    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      setFavoriteIds(Array.isArray(parsed) ? parsed : [])
    } catch {
      setFavoriteIds([])
    }

    try {
      const raw = localStorage.getItem(RESUME_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed?.bookId && parsed?.chapterId !== undefined && parsed?.hadithId) setResumeState(parsed as ResumeState)
    } catch {
      setResumeState(null)
    }
  }, [loadBooks])

  const loadBookChapters = useCallback(async (book: HadithBook) => {
    setChaptersLoading(true)
    setError("")
    stopHadithAudio()
    setChapters([])
    setHadiths([])
    setSelectedHadith(null)
    setSelectedChapterId(null)
    setChapterSearch("")
    setHadithSearch("")

    try {
      const payload = await fetchJson(`${API_BASE}/${encodeURIComponent(book.id)}`)
      const nextChapters = extractChapters(payload)
      if (!nextChapters.length) throw new Error("No chapters found")

      const payloadBook = payload?.book || payload?.data?.book || payload?.data || {}
      const updatedBook: HadithBook = {
        ...book,
        name_ar: payloadBook?.name_ar || book.name_ar,
        name_en: payloadBook?.name_en || book.name_en,
        category: normalizeBookCategory(payloadBook?.category || book.category),
        hadithCount: Number(payloadBook?.total_hadiths ?? payload?.total_hadiths ?? book.hadithCount ?? 0),
        author_ar: payloadBook?.author_ar || book.author_ar,
        author_en: payloadBook?.author_en || book.author_en,
        introduction: payloadBook?.introduction ?? payloadBook?.intro ?? payloadBook?.preface ?? payloadBook?.preamble ?? book.introduction ?? "",
        description: payloadBook?.description ?? payloadBook?.summary ?? book.description ?? "",
      }

      setSelectedBook(updatedBook)
      setBooks((current) => current.map((item) => (item.id === updatedBook.id ? updatedBook : item)))
      setChapters(nextChapters)

      const savedChapter = resumeState?.bookId === book.id ? resumeState.chapterId : null
      const chapterToOpen = savedChapter !== null && nextChapters.some((chapter) => String(chapter.id) === String(savedChapter))
        ? savedChapter
        : nextChapters[0].id
      setSelectedChapterId(chapterToOpen)
    } catch (err) {
      console.error(err)
      setError("تعذر تحميل أبواب هذا الكتاب حاليًا.")
    } finally {
      setChaptersLoading(false)
    }
  }, [fetchJson, resumeState, stopHadithAudio])

  const loadChapterHadiths = useCallback(async (book: HadithBook, chapterId: string | number) => {
    setHadithsLoading(true)
    setError("")
    setHadiths([])
    setSelectedHadith(null)
    try {
      const payload = await fetchJson(`${API_BASE}/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(String(chapterId))}`)
      const nextHadiths = extractHadiths(payload)
      setHadiths(nextHadiths)

      if (!nextHadiths.length) {
        setError("لم يتم العثور على أحاديث في هذا الباب.")
        return
      }

      const savedHadithId = resumeState?.bookId === book.id && String(resumeState.chapterId) === String(chapterId)
        ? resumeState.hadithId
        : null

      const saved = savedHadithId
        ? nextHadiths.find((hadith) => getHadithNumber(hadith) === savedHadithId)
        : null
      setSelectedHadith(saved || nextHadiths[0])
    } catch (err) {
      console.error(err)
      setError("تعذر تحميل أحاديث الباب حاليًا.")
    } finally {
      setHadithsLoading(false)
    }
  }, [fetchJson, resumeState])

  useEffect(() => {
    if (selectedBook && selectedChapterId !== null) void loadChapterHadiths(selectedBook, selectedChapterId)
  }, [loadChapterHadiths, selectedBook, selectedChapterId])

  const selectBook = useCallback((book: HadithBook) => {
    stopHadithAudio()
    setSelectedBook(book)
    setBookSearch("")
    void loadBookChapters(book)
  }, [loadBookChapters, stopHadithAudio])

  const selectChapter = useCallback((chapterId: string | number) => {
    stopHadithAudio()
    setSelectedChapterId(chapterId)
    setHadithSearch("")
  }, [stopHadithAudio])

  const openHadith = useCallback((hadith: Hadith) => {
    if (!selectedBook || selectedChapterId === null) return
    stopHadithAudio()
    setSelectedHadith(hadith)
    const nextResume: ResumeState = {
      bookId: selectedBook.id,
      chapterId: selectedChapterId,
      hadithId: getHadithNumber(hadith),
      savedAt: Date.now(),
    }
    setResumeState(nextResume)
    localStorage.setItem(RESUME_KEY, JSON.stringify(nextResume))
    setAudioError("")
  }, [selectedBook, selectedChapterId, stopHadithAudio])

  const goToHadith = useCallback((direction: -1 | 1) => {
    if (currentHadithIndex < 0) return
    const target = filteredHadiths[currentHadithIndex + direction]
    if (target) openHadith(target)
  }, [currentHadithIndex, filteredHadiths, openHadith])

  const copyHadith = useCallback(async () => {
    if (!selectedBook || !visibleHadith) return
    const text = getShareText(selectedBook, visibleHadith)
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
      else {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        textarea.remove()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error(err)
    }
  }, [selectedBook, visibleHadith])

  const shareHadith = useCallback(async () => {
    if (!selectedBook || !visibleHadith) return
    const text = getShareText(selectedBook, visibleHadith)
    try {
      if (navigator.share) await navigator.share({ title: selectedBook.name_ar, text })
      else await copyHadith()
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") console.error(err)
    }
  }, [copyHadith, selectedBook, visibleHadith])

  const toggleFavorite = useCallback(() => {
    if (!selectedBook || !visibleHadith) return
    const key = getFavoriteKey(selectedBook, visibleHadith)
    const next = favoriteIds.includes(key)
      ? favoriteIds.filter((item) => item !== key)
      : [...favoriteIds, key]
    setFavoriteIds(next)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }, [favoriteIds, selectedBook, visibleHadith])

  const getBookTarget = useCallback((book: HadithBook): AudioTarget | null => {
    const collection = getHumanBookAudio(book.id)
    if (!collection?.tracks.length) return null
    return { kind: "book", label: book.name_ar, collection, tracks: collection.tracks }
  }, [])

  const getChapterTarget = useCallback((book: HadithBook, chapter: HadithChapter | null): AudioTarget | null => {
    if (!chapter) return null
    const collection = getHumanChapterAudio(book.id, chapter.id, chapter.name_ar)
    if (!collection?.tracks.length) return null
    return { kind: "chapter", label: `${book.name_ar} — ${chapter.name_ar || "الباب"}`, collection, tracks: collection.tracks }
  }, [])

  const getHadithTarget = useCallback((book: HadithBook, hadith: Hadith | null): AudioTarget | null => {
    if (!hadith) return null
    const track = getHumanHadithAudio(book.id, getHadithNumber(hadith))
    if (!track?.url) return null
    return {
      kind: "hadith",
      label: `${book.name_ar} — حديث ${arabicDigits(getHadithNumber(hadith))}`,
      tracks: [{
        id: `${book.id}:hadith:${getHadithNumber(hadith)}`,
        title: `حديث ${arabicDigits(getHadithNumber(hadith))}`,
        url: track.url,
        label: track.label || "تسجيل بشري",
        sourceUrl: track.sourceUrl,
        startSeconds: track.startSeconds,
        endSeconds: track.endSeconds,
        isIntroduction: false,
      }],
    }
  }, [])

  const playQueueTrack = useCallback(async (track: HumanAudioTrack, index: number) => {
    if (!track.url || !/^https?:\/\//i.test(track.url)) throw new Error("رابط التسجيل الصوتي غير صالح.")

    clearAudioElement()
    const audio = new Audio(track.url)
    audio.preload = "metadata"
    audio.playbackRate = audioRate
    audioQueueRef.current = audioQueueRef.current.length ? audioQueueRef.current : [track]
    audioTrackIndexRef.current = index
    audioRef.current = audio
    setAudioTrackIndex(index)
    setAudioSourceLabel(track.label || "تسجيل بشري")
    setAudioLoading(true)
    setAudioError("")
    setCurrentTime(0)
    setDisplayDuration(0)

    audio.onloadedmetadata = () => {
      setDisplayDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      if (track.startSeconds !== undefined && track.startSeconds > 0) {
        try { audio.currentTime = track.startSeconds } catch { /* noop */ }
      }
    }

    audio.ontimeupdate = () => {
      const start = Math.max(0, Number(track.startSeconds || 0))
      const end = track.endSeconds !== undefined && Number(track.endSeconds) > start ? Number(track.endSeconds) : undefined
      setCurrentTime(Math.max(0, audio.currentTime - start))
      if (end !== undefined && audio.currentTime >= end) {
        audio.pause()
        const nextIndex = index + 1
        if (nextIndex < audioQueueRef.current.length) void playQueueTrack(audioQueueRef.current[nextIndex], nextIndex)
        else {
          setIsReadingAudio(false)
          setAudioLoading(false)
          setAudioSourceLabel("")
          audioRef.current = null
        }
      }
    }

    audio.onended = () => {
      const nextIndex = index + 1
      if (nextIndex < audioQueueRef.current.length) void playQueueTrack(audioQueueRef.current[nextIndex], nextIndex)
      else {
        setIsReadingAudio(false)
        setAudioLoading(false)
        setAudioSourceLabel("")
        audioRef.current = null
      }
    }

    audio.onerror = () => {
      setIsReadingAudio(false)
      setAudioLoading(false)
      setAudioSourceLabel("")
      audioRef.current = null
      setAudioError("تعذر تشغيل التسجيل البشري من المصدر الحالي. يمكنك فتح صفحة المصدر للتحقق من الملف.")
    }

    await audio.play()
    setAudioLoading(false)
    setIsReadingAudio(true)
  }, [audioRate, clearAudioElement])

  const playAudioTarget = useCallback(async (target: AudioTarget, startIndex = 0) => {
    const safeIndex = Math.min(Math.max(startIndex, 0), target.tracks.length - 1)
    if (safeIndex < 0 || !target.tracks.length) return
    audioQueueRef.current = target.tracks
    setAudioTarget(target)
    setAudioTrackIndex(safeIndex)
    audioTrackIndexRef.current = safeIndex
    try {
      await playQueueTrack(target.tracks[safeIndex], safeIndex)
    } catch (err) {
      console.error(err)
      setIsReadingAudio(false)
      setAudioLoading(false)
      setAudioError(err instanceof Error ? err.message : "تعذر تشغيل التسجيل البشري حاليًا.")
    }
  }, [playQueueTrack])

  const toggleMainAudio = useCallback(async () => {
    if (!selectedBook || !visibleHadith) return

    const exactHadith = getHadithTarget(selectedBook, visibleHadith)
    const exactChapter = getChapterTarget(selectedBook, currentChapter)

    if (!exactHadith && !exactChapter) {
      setAudioError("لا يوجد تسجيل بشري مطابق لهذا الحديث أو لهذا الباب، لذلك لا يظهر تشغيل صوتي للحديث.")
      return
    }

    if (isReadingAudio) {
      const audio = audioRef.current
      if (audio) audio.pause()
      setIsReadingAudio(false)
      return
    }

    if (exactHadith) await playAudioTarget(exactHadith)
    else if (exactChapter) await playAudioTarget(exactChapter)
  }, [currentChapter, getChapterTarget, getHadithTarget, isReadingAudio, playAudioTarget, selectedBook, visibleHadith])

  const playBookAudio = useCallback((book: HadithBook, index = 0) => {
    const target = getBookTarget(book)
    if (target) void playAudioTarget(target, index)
  }, [getBookTarget, playAudioTarget])

  const playChapterAudio = useCallback((book: HadithBook, chapter: HadithChapter, index = 0) => {
    const target = getChapterTarget(book, chapter)
    if (target) void playAudioTarget(target, index)
  }, [getChapterTarget, playAudioTarget])

  const seekAudio = useCallback((value: number) => {
    const audio = audioRef.current
    if (!audio) return
    const track = audioQueueRef.current[audioTrackIndexRef.current]
    const start = Math.max(0, Number(track?.startSeconds || 0))
    try {
      audio.currentTime = start + value
      setCurrentTime(value)
    } catch { /* noop */ }
  }, [])

  const skipAudio = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.max(0, (audio.currentTime || 0) + seconds)
    try { audio.currentTime = next } catch { /* noop */ }
  }, [])

  const previousAudioTrack = useCallback(() => {
    const next = audioTrackIndexRef.current - 1
    if (next < 0 || !audioQueueRef.current.length) return
    const target = audioTarget
    if (target) void playAudioTarget(target, next)
  }, [audioTarget, playAudioTarget])

  const nextAudioTrack = useCallback(() => {
    const next = audioTrackIndexRef.current + 1
    if (next >= audioQueueRef.current.length) return
    const target = audioTarget
    if (target) void playAudioTarget(target, next)
  }, [audioTarget, playAudioTarget])

  const designHadithAsImage = useCallback(async () => {
    if (!selectedBook || !visibleHadith?.arabic) return
    setDesignLoading(true)

    try {
      const width = 1440
      const outer = 54
      const headerHeight = 310
      const footerHeight = 190
      const cardX = 90
      const cardY = headerHeight + 60
      const cardWidth = width - cardX * 2
      const lineHeight = 92
      const textMaxWidth = cardWidth - 170
      const cleanText = visibleHadith.arabic.replace(/\s+/g, " ").trim()

      const measureCanvas = document.createElement("canvas")
      const measureCtx = measureCanvas.getContext("2d")
      if (!measureCtx) throw new Error("Canvas unavailable")
      measureCtx.direction = "rtl"
      measureCtx.textAlign = "center"
      measureCtx.font = '600 58px "Amiri Quran", "Amiri", serif'

      const words = cleanText.split(" ")
      const lines: string[] = []
      let line = ""
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word
        if (measureCtx.measureText(candidate).width <= textMaxWidth) line = candidate
        else {
          if (line) lines.push(line)
          line = word
        }
      }
      if (line) lines.push(line)

      const narratorLine = visibleHadith.english?.narrator ? 52 : 0
      const textBlockHeight = Math.max(lineHeight, lines.length * lineHeight)
      const cardHeight = Math.max(760, textBlockHeight + 300 + narratorLine)
      const height = cardY + cardHeight + footerHeight

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unavailable")
      ctx.direction = "rtl"
      ctx.textAlign = "center"

      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, "#F8F4EA")
      bg.addColorStop(0.52, "#FFFDF8")
      bg.addColorStop(1, "#EEE6D5")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.globalAlpha = 0.055
      ctx.strokeStyle = "#16616A"
      ctx.lineWidth = 2
      for (let x = -120; x < width + 160; x += 140) {
        for (let y = -40; y < height + 160; y += 140) {
          ctx.beginPath()
          ctx.moveTo(x + 70, y)
          ctx.lineTo(x + 140, y + 70)
          ctx.lineTo(x + 70, y + 140)
          ctx.lineTo(x, y + 70)
          ctx.closePath()
          ctx.stroke()
        }
      }
      ctx.restore()

      const header = ctx.createLinearGradient(0, 0, width, headerHeight)
      header.addColorStop(0, "#0F474E")
      header.addColorStop(1, "#1F6870")
      ctx.fillStyle = header
      ctx.fillRect(0, 0, width, headerHeight)

      ctx.strokeStyle = "#C6A15A"
      ctx.lineWidth = 4
      ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2)
      ctx.lineWidth = 1
      ctx.strokeStyle = "rgba(198,161,90,0.45)"
      ctx.strokeRect(outer + 16, outer + 16, width - (outer + 16) * 2, height - (outer + 16) * 2)

      ctx.fillStyle = "#E9D39A"
      ctx.font = '700 46px "Aref Ruqaa", "Amiri", serif'
      ctx.fillText("مصحف سَميع", width / 2, 92)

      ctx.fillStyle = "#FFFFFF"
      ctx.font = '700 34px "Tajawal", Arial, sans-serif'
      ctx.fillText(selectedBook.name_ar, width / 2, 145)

      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.font = '500 22px "Tajawal", Arial, sans-serif'
      ctx.fillText(currentChapter?.name_ar || "مكتبة الأحاديث", width / 2, 190)

      const badgeWidth = 300
      const badgeHeight = 62
      const badgeX = (width - badgeWidth) / 2
      const badgeY = 225
      const radius = 31
      ctx.beginPath()
      ctx.moveTo(badgeX + radius, badgeY)
      ctx.arcTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeHeight, radius)
      ctx.arcTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX, badgeY + badgeHeight, radius)
      ctx.arcTo(badgeX, badgeY + badgeHeight, badgeX, badgeY, radius)
      ctx.arcTo(badgeX, badgeY, badgeX + badgeWidth, badgeY, radius)
      ctx.closePath()
      ctx.fillStyle = "#C6A15A"
      ctx.fill()
      ctx.fillStyle = "#173B3F"
      ctx.font = '700 24px "Tajawal", Arial, sans-serif'
      ctx.fillText(`حديث ${arabicDigits(getHadithNumber(visibleHadith))}`, width / 2, badgeY + 40)

      ctx.save()
      ctx.shadowColor = "rgba(20,55,59,0.16)"
      ctx.shadowBlur = 34
      ctx.shadowOffsetY = 14
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 38)
      ctx.fillStyle = "rgba(255,255,255,0.88)"
      ctx.fill()
      ctx.restore()

      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 38)
      ctx.strokeStyle = "rgba(198,161,90,0.42)"
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = "#B5904C"
      ctx.beginPath()
      ctx.arc(width / 2, cardY + 55, 8, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = "#1F3336"
      ctx.font = '600 58px "Amiri Quran", "Amiri", serif'
      let textY = cardY + 150 + Math.max(0, (cardHeight - 230 - textBlockHeight - narratorLine) / 2)
      for (const currentLine of lines) {
        ctx.fillText(currentLine, width / 2, textY)
        textY += lineHeight
      }

      if (visibleHadith.english?.narrator) {
        ctx.fillStyle = "#7A705F"
        ctx.font = '600 22px "Tajawal", Arial, sans-serif'
        ctx.fillText(`الراوي: ${visibleHadith.english.narrator}`, width / 2, cardY + cardHeight - 115)
      }

      const footerY = height - 112
      const divider = ctx.createLinearGradient(220, 0, width - 220, 0)
      divider.addColorStop(0, "rgba(181,144,76,0)")
      divider.addColorStop(0.5, "#B5904C")
      divider.addColorStop(1, "rgba(181,144,76,0)")
      ctx.strokeStyle = divider
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(220, footerY - 30)
      ctx.lineTo(width - 220, footerY - 30)
      ctx.stroke()

      ctx.fillStyle = "#174F56"
      ctx.font = '700 24px "Tajawal", Arial, sans-serif'
      ctx.fillText("مصحف سَميع • مكتبة الأحاديث", width / 2, footerY + 10)
      ctx.fillStyle = "#8B816F"
      ctx.font = '500 18px "Tajawal", Arial, sans-serif'
      ctx.fillText(`${selectedBook.name_ar} — حديث ${arabicDigits(getHadithNumber(visibleHadith))}`, width / 2, footerY + 48)

      const dataUrl = canvas.toDataURL("image/png", 1)
      setDesignUrl(dataUrl)
      setDesignFileName(`samee3-hadith-${selectedBook.id}-${getHadithNumber(visibleHadith)}.png`)
    } catch (err) {
      console.error("Hadith design error:", err)
      setAudioError("تعذر إنشاء صورة الحديث على هذا الجهاز.")
    } finally {
      setDesignLoading(false)
    }
  }, [currentChapter, selectedBook, visibleHadith])

  useEffect(() => () => stopHadithAudio(), [stopHadithAudio])

  const closeBook = useCallback(() => {
    stopHadithAudio()
    setSelectedBook(null)
    setChapters([])
    setHadiths([])
    setSelectedChapterId(null)
    setSelectedHadith(null)
    setChapterSearch("")
    setHadithSearch("")
    setError("")
  }, [stopHadithAudio])

  const resumeBook = useMemo(
    () => (resumeState ? books.find((book) => book.id === resumeState.bookId) || null : null),
    [books, resumeState],
  )

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F3E9] text-slate-800 pb-32">
      <header className="sticky top-0 z-40 border-b border-[#C6A15A]/20 bg-[#F7F3E9]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#185860] shadow-sm" aria-label="العودة للرئيسية">
            <ChevronRight size={22} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <BookOpen size={21} className="text-[#B5904C]" />
              <h1 className="text-xl font-black text-[#183F43]">مكتبة الأحاديث</h1>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">كتب الحديث، أبوابها، الأحاديث، والمصادر الصوتية البشرية</p>
          </div>
          <div className="w-11 shrink-0" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {!selectedBook ? (
          <>
            <section className="relative overflow-hidden rounded-[2rem] border border-[#C6A15A]/30 bg-gradient-to-br from-[#175A63] via-[#124950] to-[#0B3338] p-7 text-white shadow-xl sm:p-9">
              <div className="absolute -left-12 -top-16 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-[#C6A15A]/10 blur-3xl" />
              <div className="relative z-10 max-w-4xl">
                <p className="mb-2 text-sm font-black text-[#E8CF93]">موسوعة الحديث</p>
                <h2 className="font-uthmani text-3xl leading-[1.75] sm:text-4xl">تصفح الكتاب، ثم الباب، ثم حديثًا واحدًا في كل مرة.</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
                  الصوت لا يُنسب إلى الحديث إلا عند وجود تسجيل بشري مطابق له أو للباب. أما التسجيلات التي ينشرها المصدر على مستوى الكتاب أو مقاطعه فتظهر في قسم المصدر الصوتي للكتاب فقط.
                </p>
              </div>
            </section>

            {resumeBook && resumeState && (
              <button onClick={() => selectBook(resumeBook)} className="mt-5 w-full rounded-3xl border border-[#C6A15A]/30 bg-white p-5 text-right shadow-sm transition hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F7F3E9] text-[#B5904C]"><Bookmark size={22} fill="currentColor" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-400">متابعة آخر موضع</p>
                    <h3 className="mt-1 truncate font-black text-[#183F43]">{resumeBook.name_ar}</h3>
                    <p className="mt-1 text-xs text-slate-500">حديث {arabicDigits(resumeState.hadithId)}</p>
                  </div>
                  <ChevronLeft className="shrink-0 text-[#B5904C]" size={22} />
                </div>
              </button>
            )}

            <div className="mt-6 rounded-2xl border border-[#185860]/10 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Search size={20} className="text-[#185860]" />
                <input value={bookSearch} onChange={(e: any) => setBookSearch(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="ابحث عن كتاب حديث..." />
                {bookSearch && <button onClick={() => setBookSearch("")} className="text-slate-400"><X size={18} /></button>}
              </div>
            </div>

            {bookError && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{bookError}</div>}

            {booksLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#185860]"><Loader2 size={35} className="animate-spin" /><span className="font-bold">جاري تحميل كتب الحديث...</span></div>
            ) : (
              <div className="mt-8 space-y-9">
                {groupedBooks.map((group) => (
                  <section key={group.category}>
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <h2 className="text-xl font-black text-[#183F43]">{group.category}</h2>
                        <p className="mt-1 text-xs text-slate-400">{arabicDigits(group.books.length)} كتب</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.books.map((book) => {
                        const audio = getHumanBookAudio(book.id)
                        return (
                          <article key={book.id} className="rounded-3xl border border-[#185860]/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C6A15A]/40 hover:shadow-md">
                            <div className="flex items-start gap-3">
                              <button onClick={() => selectBook(book)} className="min-w-0 flex-1 text-right">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#C6A15A]/30 bg-[#F7F3E9] text-[#B5904C]"><BookOpen size={28} /></div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-lg font-black text-[#183F43]">{book.name_ar}</h3>
                                    {book.author_ar && <p className="mt-1 truncate text-xs text-slate-400">{book.author_ar}</p>}
                                    {getBookDisplayCount(book) && <p className="mt-1 text-xs text-slate-500">{getBookDisplayCount(book)}</p>}
                                  </div>
                                </div>
                              </button>
                              {audio?.tracks.length ? (
                                <button onClick={() => playBookAudio(book)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#185860] text-white shadow-sm" title="تشغيل مصدر الكتاب" aria-label={`تشغيل مصدر ${book.name_ar}`}>
                                  <Play size={18} fill="currentColor" />
                                </button>
                              ) : null}
                            </div>
                            {audio?.tracks.length ? <p className="mt-4 text-[11px] font-bold text-emerald-700">يتوفر مصدر صوتي بشري • {arabicDigits(audio.tracks.length)} مقطع/مقاطع</p> : <p className="mt-4 text-[11px] text-slate-400">لا يوجد مصدر صوتي بشري مضاف لهذا الكتاب حاليًا</p>}
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <section className="rounded-[2rem] border border-[#C6A15A]/25 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={closeBook} className="inline-flex items-center gap-2 rounded-xl bg-[#F7F3E9] px-3 py-2 text-sm font-black text-[#185860]"><ArrowRight size={18} /> كل الكتب</button>
                  {bookAudio?.tracks.length ? (
                    <button onClick={() => playBookAudio(selectedBook)} className="inline-flex items-center gap-2 rounded-xl bg-[#185860] px-3 py-2 text-xs font-black text-white"><Play size={15} fill="currentColor" /> تشغيل المصدر الصوتي</button>
                  ) : null}
                  {bookAudio?.sourceUrl ? (
                    <a href={bookAudio.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><ExternalLink size={15} /> المصدر</a>
                  ) : null}
                </div>
                <div className="text-right lg:max-w-2xl">
                  <p className="text-xs font-bold text-slate-400">الكتاب المحدد</p>
                  <h2 className="mt-1 text-2xl font-black text-[#183F43]">{selectedBook.name_ar}</h2>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    {selectedBook.author_ar && <span className="rounded-full bg-[#F7F3E9] px-3 py-1 text-[11px] font-bold text-slate-500">{selectedBook.author_ar}</span>}
                    {selectedBook.hadithCount ? <span className="rounded-full bg-[#F7F3E9] px-3 py-1 text-[11px] font-bold text-[#185860]">{arabicDigits(selectedBook.hadithCount)} حديث</span> : null}
                  </div>
                </div>
              </div>
            </section>

            {selectedBook.introduction && (
              <section className="mt-5 rounded-[2rem] border border-[#C6A15A]/25 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#B5904C]" /><h3 className="text-lg font-black text-[#183F43]">مقدمة الكتاب</h3></div>
                <p className="whitespace-pre-line text-sm leading-8 text-slate-600">{selectedBook.introduction}</p>
              </section>
            )}

            {bookAudio?.tracks.length ? (
              <section className="mt-5 rounded-[2rem] border border-[#185860]/10 bg-[#102F33] p-5 text-white shadow-lg sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#E8CF93]">المصدر الصوتي كما هو منشور</p>
                    <h3 className="mt-1 text-lg font-black">{bookAudio.label}</h3>
                    <p className="mt-1 text-xs leading-6 text-white/60">زر التشغيل هنا مرتبط بالمقطع الصوتي نفسه، وليس بكل حديث داخله.</p>
                  </div>
                  {bookAudio.sourceUrl && <a href={bookAudio.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white"><ExternalLink size={15} /> صفحة المصدر</a>}
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {bookAudio.tracks.map((track, index) => {
                    const active = audioTarget?.kind === "book" && audioTarget.tracks[audioTrackIndex]?.id === track.id
                    return (
                      <button key={track.id} onClick={() => playBookAudio(selectedBook, index)} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-right transition ${active ? "border-[#C6A15A]/70 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C6A15A] text-[#143F44]"><Play size={16} fill="currentColor" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{track.title}</span><span className="mt-1 block truncate text-[10px] text-white/45">{track.isIntroduction ? "مقدمة" : track.label || "تسجيل بشري"}</span></span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
              <aside className="h-fit rounded-3xl border border-[#185860]/10 bg-white p-4 shadow-sm lg:sticky lg:top-24">
                <div className="mb-3">
                  <h3 className="font-black text-[#183F43]">الأبواب</h3>
                  <p className="mt-1 text-[11px] text-slate-400">{arabicDigits(chapters.length)} باب</p>
                </div>
                <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#F7F3E9] px-3 py-2">
                  <Search size={16} className="text-[#185860]" />
                  <input value={chapterSearch} onChange={(e: any) => setChapterSearch(e.target.value)} className="w-full bg-transparent text-xs font-bold outline-none" placeholder="ابحث في الأبواب..." />
                </div>
                {chaptersLoading ? <div className="flex justify-center py-10 text-[#185860]"><Loader2 size={28} className="animate-spin" /></div> : (
                  <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                    {filteredChapters.map((chapter) => {
                      const active = String(selectedChapterId) === String(chapter.id)
                      const chapterHasAudio = Boolean(getHumanChapterAudio(selectedBook.id, chapter.id, chapter.name_ar)?.tracks.length)
                      return (
                        <div key={String(chapter.id)} className={`flex items-center gap-2 rounded-2xl border p-2 transition ${active ? "border-[#185860] bg-[#185860] text-white" : "border-slate-100 bg-white"}`}>
                          <button onClick={() => selectChapter(chapter.id)} className="min-w-0 flex-1 text-right">
                            <p className="truncate text-xs font-black">{chapter.name_ar || `الباب ${arabicDigits(chapter.id)}`}</p>
                            {chapter.hadithCount ? <p className={`mt-1 text-[10px] ${active ? "text-white/60" : "text-slate-400"}`}>{arabicDigits(chapter.hadithCount)} حديث</p> : null}
                          </button>
                          {chapterHasAudio ? <button onClick={() => playChapterAudio(selectedBook, chapter)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/15" : "bg-[#F7F3E9] text-[#185860]"}`} title="تشغيل تسجيل الباب"><Play size={14} fill="currentColor" /></button> : null}
                        </div>
                      )
                    })}
                    {!filteredChapters.length && <p className="py-8 text-center text-xs font-bold text-slate-400">لا يوجد باب مطابق</p>}
                  </div>
                )}
              </aside>

              <section className="min-w-0">
                <div className="rounded-[2rem] border border-[#185860]/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400">الباب الحالي</p>
                      <h3 className="mt-1 text-lg font-black text-[#183F43]">{currentChapter?.name_ar || "—"}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {chapterAudio?.tracks.length ? <button onClick={() => currentChapter && playChapterAudio(selectedBook, currentChapter)} className="inline-flex items-center gap-2 rounded-xl bg-[#185860] px-3 py-2 text-xs font-black text-white"><Play size={14} fill="currentColor" /> تشغيل الباب</button> : null}
                      <span className="rounded-xl bg-[#F7F3E9] px-3 py-2 text-xs font-bold text-[#185860]">حديث {currentHadithIndex >= 0 ? arabicDigits(currentHadithIndex + 1) : "—"} من {arabicDigits(filteredHadiths.length)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F7F3E9] px-4 py-3">
                    <Search size={19} className="text-[#185860]" />
                    <input value={hadithSearch} onChange={(e: any) => setHadithSearch(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="ابحث في أحاديث الباب أو برقم الحديث..." />
                    {hadithSearch && <button onClick={() => setHadithSearch("")} className="text-slate-400"><X size={18} /></button>}
                  </div>
                </div>

                {hadithsLoading ? (
                  <div className="flex flex-col items-center gap-3 py-20 text-[#185860]"><Loader2 size={36} className="animate-spin" /><p className="font-bold">جاري تحميل الأحاديث...</p></div>
                ) : error ? (
                  <div className="mt-4 rounded-3xl border border-red-100 bg-red-50 p-5 text-center text-sm font-bold text-red-700">{error}</div>
                ) : !visibleHadith ? (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm font-bold text-slate-400">لا توجد نتائج مطابقة</div>
                ) : (
                  <article className="mt-4 overflow-hidden rounded-[2rem] border border-[#C6A15A]/25 bg-white shadow-lg">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#FCFAF4] p-5 sm:p-6">
                      <span className="rounded-full bg-[#F2E8D3] px-4 py-2 text-xs font-black text-[#9A763B]">حديث {arabicDigits(getHadithNumber(visibleHadith))}</span>
                      <span className="text-xs font-bold text-slate-400">{arabicDigits(currentHadithIndex + 1)} من {arabicDigits(filteredHadiths.length)}</span>
                    </div>

                    <div className="p-5 sm:p-8">
                      <div className="rounded-[1.75rem] border border-[#185860]/10 bg-gradient-to-br from-[#FFFEFB] to-[#F8F4EA] p-6 sm:p-9">
                        <p className="font-uthmani text-2xl leading-[2.35] text-[#23383B] sm:text-[1.8rem]" dir="rtl">{visibleHadith.arabic || "لم يتوفر النص العربي لهذا الحديث."}</p>
                        {visibleHadith.english?.narrator && <p className="mt-6 border-t border-[#C6A15A]/20 pt-4 text-xs font-bold text-[#7A705F]">الراوي: {visibleHadith.english.narrator}</p>}
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <button disabled={currentHadithIndex <= 0} onClick={() => goToHadith(-1)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F7F3E9] py-3 text-sm font-black text-[#185860] disabled:opacity-35"><ChevronRight size={18} /> السابق</button>
                        <button disabled={currentHadithIndex < 0 || currentHadithIndex >= filteredHadiths.length - 1} onClick={() => goToHadith(1)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F7F3E9] py-3 text-sm font-black text-[#185860] disabled:opacity-35">التالي <ChevronLeft size={18} /></button>
                      </div>

                      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {filteredHadiths.slice(0, 80).map((hadith) => {
                          const active = getHadithNumber(hadith) === getHadithNumber(visibleHadith)
                          return <button key={getHadithNumber(hadith)} onClick={() => openHadith(hadith)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${active ? "bg-[#185860] text-white" : "bg-[#F7F3E9] text-[#185860]"}`}>#{arabicDigits(getHadithNumber(hadith))}</button>
                        })}
                      </div>

                      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {hadithAudio ? (
                          <button onClick={() => void toggleMainAudio()} disabled={audioLoading} className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black disabled:opacity-50 ${isReadingAudio ? "bg-red-50 text-red-600" : "bg-[#185860] text-white"}`}>
                            {audioLoading ? <Loader2 size={18} className="animate-spin" /> : isReadingAudio ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                            {isReadingAudio ? "إيقاف صوت الحديث" : "استماع للحديث"}
                          </button>
                        ) : chapterAudio ? (
                          <button onClick={() => void toggleMainAudio()} disabled={audioLoading} className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black disabled:opacity-50 ${isReadingAudio ? "bg-red-50 text-red-600" : "bg-[#185860] text-white"}`}>
                            {audioLoading ? <Loader2 size={18} className="animate-spin" /> : isReadingAudio ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                            {isReadingAudio ? "إيقاف صوت الباب" : "استماع للباب"}
                          </button>
                        ) : null}
                        <button onClick={() => void copyHadith()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F3E9] py-3 text-sm font-black text-[#185860]">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "تم النسخ" : "نسخ"}</button>
                        <button onClick={() => void shareHadith()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F3E9] py-3 text-sm font-black text-[#185860]"><Share2 size={18} /> مشاركة</button>
                        <button onClick={toggleFavorite} className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black ${selectedIsFavorite ? "bg-[#B5904C] text-white" : "bg-[#F7F3E9] text-[#9A763B]"}`}><Bookmark size={18} fill={selectedIsFavorite ? "currentColor" : "none"} /> {selectedIsFavorite ? "محفوظ" : "حفظ"}</button>
                      </div>

                      <button onClick={() => void designHadithAsImage()} disabled={designLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#C6A15A]/30 bg-white py-3 text-sm font-black text-[#185860] disabled:opacity-50"><ImageIcon size={18} /> {designLoading ? "جاري تجهيز صورة كاملة..." : "تصميم الحديث كصورة عالية الدقة"}</button>

                      {audioError && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-800">{audioError}</div>}
                      {!hadithAudio && !chapterAudio && <p className="mt-4 text-center text-[11px] font-bold text-slate-400">لا يوجد زر صوت بجانب هذا الحديث لأن المصدر لا يحتوي على تسجيل بشري مطابق له أو لبابه.</p>}
                    </div>
                  </article>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {audioTarget && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-[#112E32]/95 p-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{audioTarget.tracks[audioTrackIndex]?.title || audioTarget.label}</p>
              <p className="mt-1 truncate text-[10px] text-white/50">{audioSourceLabel || audioTarget.collection?.label || "تسجيل بشري"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => previousAudioTrack()} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" title="المقطع السابق"><SkipBack size={16} /></button>
              <button onClick={() => {
                const audio = audioRef.current
                if (!audio) return
                if (isReadingAudio) { audio.pause(); setIsReadingAudio(false) }
                else { void audio.play().then(() => setIsReadingAudio(true)).catch(() => setAudioError("تعذر استئناف التشغيل.")) }
              }} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C6A15A] text-[#163C40]" title={isReadingAudio ? "إيقاف" : "تشغيل"}>
                {isReadingAudio ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
              </button>
              <button onClick={() => nextAudioTrack()} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" title="المقطع التالي"><SkipForward size={16} /></button>
            </div>
            <div className="flex min-w-[220px] items-center gap-2">
              <span className="font-mono text-[10px] text-white/60">{formatTime(currentTime)}</span>
              <input type="range" min={0} max={Math.max(displayDuration, 1)} step={0.1} value={Math.min(currentTime, Math.max(displayDuration, 1))} onChange={(e: any) => seekAudio(Number(e.target.value))} className="w-full accent-[#C6A15A]" />
              <span className="font-mono text-[10px] text-white/60">{displayDuration ? formatTime(displayDuration) : "--:--"}</span>
            </div>
            <select value={audioRate} onChange={(e: any) => setAudioRate(Number(e.target.value))} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-bold text-white outline-none">
              <option value={0.75}>٠٫٧٥×</option>
              <option value={1}>١×</option>
              <option value={1.15}>١٫١٥×</option>
              <option value={1.25}>١٫٢٥×</option>
              <option value={1.5}>١٫٥×</option>
            </select>
            <button onClick={stopHadithAudio} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10" title="إغلاق المشغل"><X size={18} /></button>
          </div>
        </div>
      )}

      {designUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setDesignUrl(null)}>
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-[#F7F3E9] shadow-2xl" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
              <div><p className="font-black text-[#183F43]">صورة الحديث</p><p className="mt-1 text-xs text-slate-400">الصورة كاملة وبجودة عالية ويمكن تحميلها مباشرة.</p></div>
              <div className="flex items-center gap-2">
                <a href={designUrl} download={designFileName} className="inline-flex items-center gap-2 rounded-xl bg-[#185860] px-4 py-3 text-xs font-black text-white"><Download size={16} /> تحميل الصورة</a>
                <button onClick={() => setDesignUrl(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={18} /></button>
              </div>
            </div>
            <div className="min-h-0 overflow-auto bg-[#D9D2C3] p-3 sm:p-5">
              <img src={designUrl} alt="تصميم الحديث" className="mx-auto block h-auto w-full max-w-3xl rounded-xl shadow-2xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}