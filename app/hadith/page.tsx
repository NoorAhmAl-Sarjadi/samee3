"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  ImageIcon,
  Loader2,
  Search,
  Share2,
  X,
} from "lucide-react"

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

const API_BASE = "/api/hadith"
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

  const [designUrl, setDesignUrl] = useState<string | null>(null)
  const [designLoading, setDesignLoading] = useState(false)
  const [designError, setDesignError] = useState("")
  const [designFileName, setDesignFileName] = useState("samee3-hadith.png")

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
  }, [fetchJson, resumeState])

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
    setDesignError("")
    setSelectedBook(book)
    setBookSearch("")
    void loadBookChapters(book)
  }, [loadBookChapters])

  const selectChapter = useCallback((chapterId: string | number) => {
    setSelectedChapterId(chapterId)
    setHadithSearch("")
  }, [])

  const openHadith = useCallback((hadith: Hadith) => {
    if (!selectedBook || selectedChapterId === null) return
    setSelectedHadith(hadith)
    const nextResume: ResumeState = {
      bookId: selectedBook.id,
      chapterId: selectedChapterId,
      hadithId: getHadithNumber(hadith),
      savedAt: Date.now(),
    }
    setResumeState(nextResume)
    localStorage.setItem(RESUME_KEY, JSON.stringify(nextResume))
    setDesignError("")
  }, [selectedBook, selectedChapterId])

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

  const designHadithAsImage = useCallback(async () => {
    if (!selectedBook || !visibleHadith?.arabic) return

    setDesignLoading(true)
    setDesignError("")

    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready
      }

      // قالب اجتماعي فاخر: عرض 1080px وارتفاع ديناميكي حتى لا يُقص الحديث الطويل.
      const width = 1080
      const outer = 28
      const headerX = outer
      const headerY = outer
      const headerW = width - outer * 2
      const headerH = 290
      const cardX = 68
      const cardY = 348
      const cardWidth = width - cardX * 2
      const textMaxWidth = 760
      const footerHeight = 150

      const cleanText = visibleHadith.arabic
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()

      const narrator = visibleHadith.english?.narrator?.trim() || ""
      const chapterName = currentChapter?.name_ar?.trim() || ""
      const bookName = selectedBook.name_ar.trim()
      const hadithNumber = getHadithNumber(visibleHadith)

      const measureCanvas = document.createElement("canvas")
      const measureCtx = measureCanvas.getContext("2d")
      if (!measureCtx) throw new Error("Canvas unavailable")

      measureCtx.direction = "rtl"
      measureCtx.textAlign = "center"
      measureCtx.textBaseline = "alphabetic"

      const makeLines = (fontSize: number) => {
        measureCtx.font = `600 ${fontSize}px "Amiri Quran", "Amiri", "Noto Naskh Arabic", serif`

        const words = cleanText.split(/\s+/)
        const lines: string[] = []
        let current = ""

        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word

          if (measureCtx.measureText(candidate).width <= textMaxWidth) {
            current = candidate
            continue
          }

          if (current) lines.push(current)

          if (measureCtx.measureText(word).width <= textMaxWidth) {
            current = word
          } else {
            let chunk = ""
            for (const char of word) {
              const candidateChunk = chunk + char
              if (measureCtx.measureText(candidateChunk).width <= textMaxWidth) {
                chunk = candidateChunk
              } else {
                if (chunk) lines.push(chunk)
                chunk = char
              }
            }
            current = chunk
          }
        }

        if (current) lines.push(current)
        return lines
      }

      let fontSize = 58
      let lineHeight = 92
      let lines = makeLines(fontSize)

      while (lines.length > 15 && fontSize > 42) {
        fontSize -= 2
        lineHeight = Math.round(fontSize * 1.58)
        lines = makeLines(fontSize)
      }

      const textBlockHeight = Math.max(lineHeight, lines.length * lineHeight)
      const narratorBlock = narrator ? 82 : 0
      const cardHeight = Math.max(650, textBlockHeight + narratorBlock + 340)
      const footerY = cardY + cardHeight
      const height = footerY + footerHeight + outer

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unavailable")

      ctx.direction = "rtl"
      ctx.textAlign = "center"
      ctx.textBaseline = "alphabetic"
      ctx.imageSmoothingEnabled = true

      const roundedRectPath = (
        context: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
      ) => {
        const radius = Math.min(r, w / 2, h / 2)
        context.beginPath()
        context.moveTo(x + radius, y)
        context.lineTo(x + w - radius, y)
        context.quadraticCurveTo(x + w, y, x + w, y + radius)
        context.lineTo(x + w, y + h - radius)
        context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
        context.lineTo(x + radius, y + h)
        context.quadraticCurveTo(x, y + h, x, y + h - radius)
        context.lineTo(x, y + radius)
        context.quadraticCurveTo(x, y, x + radius, y)
        context.closePath()
      }

      const drawPill = (
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        fill: string,
        textColor: string,
        font: string,
      ) => {
        roundedRectPath(ctx, x, y, w, h, h / 2)
        ctx.fillStyle = fill
        ctx.fill()
        ctx.fillStyle = textColor
        ctx.font = font
        ctx.fillText(text, x + w / 2, y + h * 0.67)
      }

      const drawStar = (cx: number, cy: number, outerRadius: number, innerRadius: number) => {
        ctx.beginPath()
        for (let i = 0; i < 16; i += 1) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius
          const angle = -Math.PI / 2 + (i * Math.PI) / 8
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
      }

      // الخلفية
      const background = ctx.createLinearGradient(0, 0, width, height)
      background.addColorStop(0, "#F5F0E6")
      background.addColorStop(0.42, "#FFFDF8")
      background.addColorStop(1, "#E8DFCD")
      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)

      // زخرفة هندسية خافتة.
      ctx.save()
      ctx.globalAlpha = 0.035
      ctx.strokeStyle = "#164C53"
      ctx.lineWidth = 1.5
      for (let x = -80; x < width + 120; x += 120) {
        for (let y = -80; y < height + 120; y += 120) {
          drawStar(x + 60, y + 60, 34, 15)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(x + 60, y + 60, 7, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.restore()

      // الإطار الخارجي.
      ctx.strokeStyle = "#B7904E"
      ctx.lineWidth = 3
      ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2)
      ctx.strokeStyle = "rgba(183,144,78,0.34)"
      ctx.lineWidth = 1
      ctx.strokeRect(outer + 12, outer + 12, width - (outer + 12) * 2, height - (outer + 12) * 2)

      // الهيدر.
      const headerGradient = ctx.createLinearGradient(headerX, headerY, headerX + headerW, headerY + headerH)
      headerGradient.addColorStop(0, "#0A363B")
      headerGradient.addColorStop(0.55, "#124D54")
      headerGradient.addColorStop(1, "#1E666D")

      roundedRectPath(ctx, headerX, headerY, headerW, headerH, 34)
      ctx.fillStyle = headerGradient
      ctx.fill()

      const glowLeft = ctx.createRadialGradient(130, 100, 0, 130, 100, 220)
      glowLeft.addColorStop(0, "rgba(215,173,92,0.16)")
      glowLeft.addColorStop(1, "rgba(215,173,92,0)")
      ctx.fillStyle = glowLeft
      ctx.fillRect(headerX, headerY, headerW, headerH)

      const glowRight = ctx.createRadialGradient(width - 140, 180, 0, width - 140, 180, 230)
      glowRight.addColorStop(0, "rgba(255,255,255,0.08)")
      glowRight.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = glowRight
      ctx.fillRect(headerX, headerY, headerW, headerH)

      ctx.save()
      ctx.globalAlpha = 0.16
      ctx.strokeStyle = "#E2BE73"
      ctx.lineWidth = 2
      drawStar(108, 105, 42, 18)
      ctx.stroke()
      drawStar(width - 108, 105, 42, 18)
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = "#E7C984"
      ctx.font = '700 48px "Aref Ruqaa", "Amiri", serif'
      ctx.fillText("مصحف سَميع", width / 2, 102)

      ctx.fillStyle = "rgba(255,255,255,0.92)"
      ctx.font = '800 28px "Tajawal", Arial, sans-serif'
      ctx.fillText("بطاقة حديث", width / 2, 150)

      drawPill(
        "مكتبة الأحاديث",
        width / 2 - 148,
        180,
        296,
        44,
        "rgba(255,255,255,0.10)",
        "rgba(255,255,255,0.86)",
        '700 17px "Tajawal", Arial, sans-serif',
      )

      ctx.fillStyle = "rgba(255,255,255,0.65)"
      ctx.font = '500 17px "Tajawal", Arial, sans-serif'
      const headerContext = chapterName ? `${bookName}  •  ${chapterName}` : bookName
      ctx.fillText(headerContext, width / 2, 255)

      drawPill(
        `حديث ${arabicDigits(hadithNumber)}`,
        width / 2 - 118,
        274,
        236,
        50,
        "#D2AD62",
        "#153F44",
        '800 21px "Tajawal", Arial, sans-serif',
      )

      // البطاقة الرئيسية.
      ctx.save()
      ctx.shadowColor = "rgba(11,50,55,0.16)"
      ctx.shadowBlur = 34
      ctx.shadowOffsetY = 14
      roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, 38)
      ctx.fillStyle = "rgba(255,255,255,0.97)"
      ctx.fill()
      ctx.restore()

      roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, 38)
      ctx.fillStyle = "rgba(255,255,255,0.97)"
      ctx.fill()
      ctx.strokeStyle = "rgba(183,144,78,0.42)"
      ctx.lineWidth = 2
      ctx.stroke()

      roundedRectPath(ctx, cardX + 16, cardY + 16, cardWidth - 32, cardHeight - 32, 30)
      ctx.strokeStyle = "rgba(183,144,78,0.18)"
      ctx.lineWidth = 1
      ctx.stroke()

      // زخرفة أعلى البطاقة.
      ctx.fillStyle = "#C39A51"
      drawStar(width / 2, cardY + 58, 17, 7)
      ctx.fill()

      // علامات اقتباس زخرفية شفافة.
      ctx.fillStyle = "rgba(195,154,81,0.16)"
      ctx.font = '700 150px Georgia, serif'
      ctx.fillText("❞", cardX + 92, cardY + 172)

      ctx.fillStyle = "rgba(195,154,81,0.11)"
      ctx.font = '700 130px Georgia, serif'
      ctx.fillText("❝", width - cardX - 88, footerY - 78)

      // النص العربي.
      ctx.fillStyle = "#263B3D"
      ctx.font = `600 ${fontSize}px "Amiri Quran", "Amiri", "Noto Naskh Arabic", serif`
      ctx.textBaseline = "alphabetic"

      const textStartY =
        cardY + 150 + Math.max(0, (cardHeight - 390 - textBlockHeight - narratorBlock) / 2)

      let textY = textStartY
      for (const line of lines) {
        ctx.fillText(line, width / 2, textY)
        textY += lineHeight
      }

      const separatorY = textStartY + textBlockHeight + 38
      const separator = ctx.createLinearGradient(cardX + 180, 0, width - cardX - 180, 0)
      separator.addColorStop(0, "rgba(183,144,78,0)")
      separator.addColorStop(0.5, "rgba(183,144,78,0.58)")
      separator.addColorStop(1, "rgba(183,144,78,0)")
      ctx.strokeStyle = separator
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cardX + 180, separatorY)
      ctx.lineTo(width - cardX - 180, separatorY)
      ctx.stroke()

      if (narrator) {
        ctx.fillStyle = "#847660"
        ctx.font = '700 22px "Tajawal", Arial, sans-serif'
        ctx.fillText(`الراوي: ${narrator}`, width / 2, separatorY + 58)
      }

      // التذييل.
      const footerCenter = footerY + 83
      ctx.fillStyle = "#174F56"
      ctx.font = '800 22px "Tajawal", Arial, sans-serif'
      ctx.fillText("مصحف سَميع", width / 2, footerCenter)

      ctx.fillStyle = "#8A806F"
      ctx.font = '500 16px "Tajawal", Arial, sans-serif'
      const footerSource = chapterName
        ? `${bookName}  •  ${chapterName}  •  حديث ${arabicDigits(hadithNumber)}`
        : `${bookName}  •  حديث ${arabicDigits(hadithNumber)}`
      ctx.fillText(footerSource, width / 2, footerCenter + 32)

      ctx.fillStyle = "rgba(23,79,86,0.58)"
      ctx.font = '500 13px "Tajawal", Arial, sans-serif'
      ctx.fillText("بطاقة رقمية من مكتبة الأحاديث — مصحف سميع", width / 2, footerCenter + 57)

      ctx.fillStyle = "#C39A51"
      ctx.beginPath()
      ctx.arc(width / 2 - 72, footerCenter + 52, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(width / 2 + 72, footerCenter + 52, 3, 0, Math.PI * 2)
      ctx.fill()

      const dataUrl = canvas.toDataURL("image/png", 1)
      setDesignUrl(dataUrl)
      setDesignFileName(`samee3-hadith-${selectedBook.id}-${hadithNumber}-premium.png`)
    } catch (err) {
      console.error("Hadith design error:", err)
      setDesignError("تعذر إنشاء صورة الحديث على هذا الجهاز.")
    } finally {
      setDesignLoading(false)
    }
  }, [currentChapter, selectedBook, visibleHadith])

  const closeBook = useCallback(() => {
    setSelectedBook(null)
    setChapters([])
    setHadiths([])
    setSelectedChapterId(null)
    setSelectedHadith(null)
    setChapterSearch("")
    setHadithSearch("")
    setError("")
    setDesignError("")
  }, [])

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
            <p className="mt-1 text-xs font-medium text-slate-500">كتب الحديث، أبوابها، والأحاديث النبوية</p>
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
                  تصفح كتب الحديث وأبوابها وأحاديثها بسهولة، مع أدوات الحفظ والنسخ والمشاركة وتصميم الحديث كصورة عالية الدقة.
                </p>
              </div>
            </section>

            {resumeBook && resumeState && (
              <button onClick={() => selectBook(resumeBook)} className="mt-5 w-full rounded-3xl border border-[#C6A15A]/30 bg-white p-5 text-right shadow-sm transition hover:shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F7F3E9] text-[#B5904C]"><Bookmark size={22} fill="currentColor" /></div>
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
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {group.books.map((book) => {
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
                                    <p className="mt-3 rounded-xl bg-[#F7F3E9] px-3 py-2 text-[11px] font-bold leading-5 text-[#6D604D]">
                                      للاستماع إلى هذا الكتاب، قد يكون تسجيله متوفرًا في المكتبة الصوتية.
                                    </p>
                                  </div>
                                </div>
                              </button>
                            </div>
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
                </div>
                <div className="text-right lg:max-w-2xl">
                  <p className="text-xs font-bold text-slate-400">الكتاب المحدد</p>
                  <h2 className="mt-1 text-2xl font-black text-[#183F43]">{selectedBook.name_ar}</h2>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    {selectedBook.author_ar && <span className="rounded-full bg-[#F7F3E9] px-3 py-1 text-[11px] font-bold text-slate-500">{selectedBook.author_ar}</span>}
                    {selectedBook.hadithCount ? <span className="rounded-full bg-[#F7F3E9] px-3 py-1 text-[11px] font-bold text-[#185860]">{arabicDigits(selectedBook.hadithCount)} حديث</span> : null}
                  </div>
                  <p className="mt-4 max-w-xl text-right text-xs font-bold leading-6 text-[#6D604D]">
                    هذا القسم مخصص لقراءة الأحاديث فقط. إذا رغبت في الاستماع، فقد يكون التسجيل متوفرًا في المكتبة الصوتية.
                  </p>
                </div>
              </div>
            </section>

            {selectedBook.introduction && (
              <section className="mt-5 rounded-[2rem] border border-[#C6A15A]/25 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#B5904C]" /><h3 className="text-lg font-black text-[#183F43]">مقدمة الكتاب</h3></div>
                <p className="whitespace-pre-line text-sm leading-8 text-slate-600">{selectedBook.introduction}</p>
              </section>
            )}

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
                      return (
                        <div key={String(chapter.id)} className={`flex items-center gap-2 rounded-2xl border p-2 transition ${active ? "border-[#185860] bg-[#185860] text-white" : "border-slate-100 bg-white"}`}>
                          <button onClick={() => selectChapter(chapter.id)} className="min-w-0 flex-1 text-right">
                            <p className="truncate text-xs font-black">{chapter.name_ar || `الباب ${arabicDigits(chapter.id)}`}</p>
                            {chapter.hadithCount ? <p className={`mt-1 text-[10px] ${active ? "text-white/60" : "text-slate-400"}`}>{arabicDigits(chapter.hadithCount)} حديث</p> : null}
                          </button>
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

                      <div className="mt-5 grid gap-2 sm:grid-cols-3">
                        <button onClick={() => void copyHadith()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F3E9] py-3 text-sm font-black text-[#185860]">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "تم النسخ" : "نسخ"}</button>
                        <button onClick={() => void shareHadith()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F3E9] py-3 text-sm font-black text-[#185860]"><Share2 size={18} /> مشاركة</button>
                        <button onClick={toggleFavorite} className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black ${selectedIsFavorite ? "bg-[#B5904C] text-white" : "bg-[#F7F3E9] text-[#9A763B]"}`}><Bookmark size={18} fill={selectedIsFavorite ? "currentColor" : "none"} /> {selectedIsFavorite ? "محفوظ" : "حفظ"}</button>
                      </div>

                      <button onClick={() => void designHadithAsImage()} disabled={designLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#C6A15A]/30 bg-white py-3 text-sm font-black text-[#185860] disabled:opacity-50"><ImageIcon size={18} /> {designLoading ? "جاري تجهيز صورة كاملة..." : "تصميم الحديث كصورة عالية الدقة"}</button>

                      {designError && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-800">{designError}</div>}
                    </div>
                  </article>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {designUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setDesignUrl(null)}>
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-[#F7F3E9] shadow-2xl" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
              <div><p className="font-black text-[#183F43]">صورة الحديث</p><p className="mt-1 text-xs text-slate-400">صورة حديث منسقة بجودة عالية ويمكن تحميلها مباشرة.</p></div>
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
