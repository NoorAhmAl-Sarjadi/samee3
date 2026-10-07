'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Video,
  Download,
  Link as LinkIcon,
  Search,
  Layers3,
  GraduationCap,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  PlayCircle,
  UserRound,
  FileText,
} from 'lucide-react'

import { db } from '@/lib/firebase'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import {
  SUNNI_LIBRARY_BOOKS,
  SUNNI_LIBRARY_CATEGORIES,
  SUNNI_LIBRARY_LEVELS,
  type SunniLibraryBook,
  type SunniLibraryCategoryId,
  type SunniLibraryLevel,
} from '@/lib/islamic/sunniLibrary'

interface VideoLesson {
  id: string
  title: string
  url: string
  order: number
}

interface FirestoreBookData {
  id?: unknown
  title?: unknown
  author?: unknown
  category?: unknown
  level?: unknown
  description?: unknown
  readingUrl?: unknown
  readingLabel?: unknown
  sharhTitle?: unknown
  sharhAuthor?: unknown
  sharhUrl?: unknown
  sharhLabel?: unknown
  downloadUrl?: unknown
  quranpediaBookId?: unknown
  deleted?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

interface AdminBook extends SunniLibraryBook {
  isCustom: boolean
  deleted: boolean
}

type BookFormState = {
  title: string
  author: string
  category: SunniLibraryCategoryId
  level: SunniLibraryLevel
  description: string
  readingUrl: string
  readingLabel: string
  downloadUrl: string
  sharhTitle: string
  sharhAuthor: string
  sharhUrl: string
  sharhLabel: string
}

type VideoFormState = {
  title: string
  url: string
  order: string
}

const EMPTY_BOOK_FORM: BookFormState = {
  title: '',
  author: '',
  category: 'aqidah',
  level: 'مبتدئ',
  description: '',
  readingUrl: '',
  readingLabel: 'قراءة الكتاب',
  downloadUrl: '',
  sharhTitle: '',
  sharhAuthor: '',
  sharhUrl: '',
  sharhLabel: 'فتح الشرح',
}

const EMPTY_VIDEO_FORM: VideoFormState = {
  title: '',
  url: '',
  order: '1',
}

function stringValue(
  value: unknown,
  fallback = ''
): string {
  return typeof value === 'string'
    ? value
    : fallback
}

function isLevel(
  value: unknown
): value is SunniLibraryLevel {
  return (
    value === 'مبتدئ' ||
    value === 'متوسط' ||
    value === 'متقدم'
  )
}

function isCategory(
  value: unknown
): value is SunniLibraryCategoryId {
  return (
    value === 'aqidah' ||
    value === 'fiqh' ||
    value === 'seerah' ||
    value === 'usul-tafsir' ||
    value === 'usul-fiqh' ||
    value === 'usul-hadith'
  )
}

function createBookFromFirestore(
  id: string,
  data: FirestoreBookData,
  fallback?: SunniLibraryBook
): AdminBook | null {
  const title =
    stringValue(data.title) ||
    fallback?.title ||
    ''

  if (!title) {
    return null
  }

  const author =
    stringValue(data.author) ||
    fallback?.author ||
    'غير محدد'

  const category =
    isCategory(data.category)
      ? data.category
      : fallback?.category || 'aqidah'

  const level =
    isLevel(data.level)
      ? data.level
      : fallback?.level || 'مبتدئ'

  const description =
    stringValue(data.description) ||
    fallback?.description ||
    ''

  const readingUrl =
    stringValue(data.readingUrl) ||
    fallback?.readingUrl

  const readingLabel =
    stringValue(data.readingLabel) ||
    fallback?.readingLabel

  const sharhTitle =
    stringValue(data.sharhTitle) ||
    fallback?.sharhTitle

  const sharhAuthor =
    stringValue(data.sharhAuthor) ||
    fallback?.sharhAuthor

  const sharhUrl =
    stringValue(data.sharhUrl) ||
    fallback?.sharhUrl

  const sharhLabel =
    stringValue(data.sharhLabel) ||
    fallback?.sharhLabel

  const downloadUrl =
    stringValue(data.downloadUrl) ||
    fallback?.downloadUrl

  return {
    id,
    category,
    title,
    author,
    level,
    description,
    readingUrl,
    readingLabel,
    sharhTitle,
    sharhAuthor,
    sharhUrl,
    sharhLabel,
    downloadUrl,
    quranpediaBookId:
      typeof data.quranpediaBookId ===
      'number'
        ? data.quranpediaBookId
        : fallback?.quranpediaBookId,
    isCustom: !fallback,
    deleted: data.deleted === true,
  }
}

function buildBookForm(
  book: SunniLibraryBook
): BookFormState {
  return {
    title: book.title || '',
    author: book.author || '',
    category: book.category,
    level: book.level,
    description: book.description || '',
    readingUrl: book.readingUrl || '',
    readingLabel:
      book.readingLabel ||
      'قراءة الكتاب',
    downloadUrl:
      book.downloadUrl || '',
    sharhTitle:
      book.sharhTitle || '',
    sharhAuthor:
      book.sharhAuthor || '',
    sharhUrl:
      book.sharhUrl || '',
    sharhLabel:
      book.sharhLabel ||
      'فتح الشرح',
  }
}

function makeBookId(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s-]/gu,
      ''
    )
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const suffix =
    Math.random()
      .toString(36)
      .slice(2, 7)

  return `${normalized || 'book'}-${suffix}`
}

export default function IslamicLibraryAdmin() {
  const [books, setBooks] =
    useState<AdminBook[]>([])

  const [loadingBooks, setLoadingBooks] =
    useState(true)

  const [savingBook, setSavingBook] =
    useState(false)

  const [savingVideo, setSavingVideo] =
    useState(false)

  const [deletingBookId, setDeletingBookId] =
    useState<string | null>(null)

  const [deletingVideoId, setDeletingVideoId] =
    useState<string | null>(null)

  const [selectedBookId, setSelectedBookId] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [levelFilter, setLevelFilter] =
    useState<'الكل' | SunniLibraryLevel>(
      'الكل'
    )

  const [categoryFilter, setCategoryFilter] =
    useState<
      'الكل' | SunniLibraryCategoryId
    >('الكل')

  const [bookModalOpen, setBookModalOpen] =
    useState(false)

  const [videoModalOpen, setVideoModalOpen] =
    useState(false)

  const [editingBookId, setEditingBookId] =
    useState<string | null>(null)

  const [editingVideoId, setEditingVideoId] =
    useState<string | null>(null)

  const [bookForm, setBookForm] =
    useState<BookFormState>(
      EMPTY_BOOK_FORM
    )

  const [videoForm, setVideoForm] =
    useState<VideoFormState>(
      EMPTY_VIDEO_FORM
    )

  const [videos, setVideos] =
    useState<VideoLesson[]>([])

  const [loadingVideos, setLoadingVideos] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  const selectedBook = useMemo(
    () =>
      books.find(
        (book) =>
          book.id === selectedBookId
      ) || null,
    [books, selectedBookId]
  )

  const filteredBooks = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    return books.filter((book) => {
      const matchesSearch =
        !query ||
        [
          book.title,
          book.author,
          book.description,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesLevel =
        levelFilter === 'الكل' ||
        book.level === levelFilter

      const matchesCategory =
        categoryFilter === 'الكل' ||
        book.category === categoryFilter

      return (
        matchesSearch &&
        matchesLevel &&
        matchesCategory
      )
    })
  }, [
    books,
    search,
    levelFilter,
    categoryFilter,
  ])

  const visibleBooksCount =
    books.filter(
      (book) => !book.deleted
    ).length

  const hiddenBooksCount =
    books.filter(
      (book) => book.deleted
    ).length

  useEffect(() => {
    void loadBooks()
  }, [])

  useEffect(() => {
    if (!selectedBookId) {
      setVideos([])
      return
    }

    void loadVideos(selectedBookId)
  }, [selectedBookId])

  function notify(
    text: string
  ) {
    setMessage(text)
    setError('')

    window.setTimeout(() => {
      setMessage('')
    }, 3500)
  }

  function showError(
    text: string
  ) {
    setError(text)

    window.setTimeout(() => {
      setError('')
    }, 5000)
  }

  async function loadBooks() {
    try {
      setLoadingBooks(true)
      setError('')

      const snapshot = await getDocs(
        collection(
          db,
          'islamicLibraryBooks'
        )
      )

      const firestoreMap =
        new Map<
          string,
          FirestoreBookData
        >()

      snapshot.docs.forEach((item) => {
        firestoreMap.set(
          item.id,
          item.data() as FirestoreBookData
        )
      })

      const merged: AdminBook[] = []

      for (const staticBook of SUNNI_LIBRARY_BOOKS) {
        const override =
          firestoreMap.get(
            staticBook.id
          )

        if (override) {
          const mergedBook =
            createBookFromFirestore(
              staticBook.id,
              override,
              staticBook
            )

          if (mergedBook) {
            merged.push(
              mergedBook
            )
          }
        } else {
          merged.push({
            ...staticBook,
            isCustom: false,
            deleted: false,
          })
        }

        firestoreMap.delete(
          staticBook.id
        )
      }

      for (const [
        id,
        data,
      ] of firestoreMap.entries()) {
        const customBook =
          createBookFromFirestore(
            id,
            data
          )

        if (customBook) {
          merged.push(
            customBook
          )
        }
      }

      merged.sort((a, b) =>
        a.title.localeCompare(
          b.title,
          'ar'
        )
      )

      setBooks(merged)

      if (
        selectedBookId &&
        !merged.some(
          (book) =>
            book.id ===
            selectedBookId
        )
      ) {
        setSelectedBookId(null)
      }
    } catch (loadError) {
      console.error(
        'Islamic library admin load error:',
        loadError
      )

      showError(
        'تعذر تحميل كتب المكتبة من Firestore.'
      )
    } finally {
      setLoadingBooks(false)
    }
  }

  async function loadVideos(
    bookId: string
  ) {
    try {
      setLoadingVideos(true)

      const snapshot = await getDocs(
        collection(
          db,
          'islamicLibraryBooks',
          bookId,
          'videos'
        )
      )

      const nextVideos: VideoLesson[] =
        snapshot.docs
          .map((item, index) => {
            const data =
              item.data() as Record<
                string,
                unknown
              >

            const numericOrder =
              Number(data.order)

            return {
              id: item.id,
              title:
                stringValue(
                  data.title
                ) ||
                `الدرس ${index + 1}`,
              url:
                stringValue(
                  data.url
                ) ||
                '',
              order:
                Number.isFinite(
                  numericOrder
                )
                  ? numericOrder
                  : index + 1,
            }
          })
          .filter(
            (video) =>
              Boolean(
                video.url
              )
          )
          .sort(
            (a, b) =>
              a.order - b.order
          )

      setVideos(nextVideos)
    } catch (loadError) {
      console.error(
        'Islamic library videos load error:',
        loadError
      )

      setVideos([])
      showError(
        'تعذر تحميل دروس الكتاب.'
      )
    } finally {
      setLoadingVideos(false)
    }
  }

  function openCreateBook() {
    setEditingBookId(null)

    setBookForm({
      ...EMPTY_BOOK_FORM,
    })

    setBookModalOpen(true)
  }

  function openEditBook(
    book: AdminBook
  ) {
    setEditingBookId(book.id)

    setBookForm(
      buildBookForm(book)
    )

    setBookModalOpen(true)
  }

  function closeBookModal() {
    if (savingBook) {
      return
    }

    setBookModalOpen(false)
    setEditingBookId(null)
    setBookForm({
      ...EMPTY_BOOK_FORM,
    })
  }

  async function saveBook() {
    const title =
      bookForm.title.trim()

    const author =
      bookForm.author.trim()

    const description =
      bookForm.description.trim()

    if (!title) {
      showError(
        'اكتب اسم الكتاب كاملًا.'
      )
      return
    }

    if (!author) {
      showError(
        'اكتب اسم المؤلف.'
      )
      return
    }

    if (!description) {
      showError(
        'اكتب وصف الكتاب.'
      )
      return
    }

    try {
      setSavingBook(true)
      setError('')

      const bookId =
        editingBookId ||
        makeBookId(title)

      const existingBook =
        books.find(
          (book) =>
            book.id ===
            editingBookId
        )

      await setDoc(
        doc(
          db,
          'islamicLibraryBooks',
          bookId
        ),
        {
          id: bookId,
          title,
          author,
          category:
            bookForm.category,
          level:
            bookForm.level,
          description,

          readingUrl:
            bookForm.readingUrl.trim() ||
            null,

          readingLabel:
            bookForm.readingLabel.trim() ||
            null,

          downloadUrl:
            bookForm.downloadUrl.trim() ||
            null,

          sharhTitle:
            bookForm.sharhTitle.trim() ||
            null,

          sharhAuthor:
            bookForm.sharhAuthor.trim() ||
            null,

          sharhUrl:
            bookForm.sharhUrl.trim() ||
            null,

          sharhLabel:
            bookForm.sharhLabel.trim() ||
            null,

          deleted:
            existingBook?.deleted ||
            false,

          updatedAt:
            serverTimestamp(),

          ...(editingBookId
            ? {}
            : {
                createdAt:
                  serverTimestamp(),
              }),
        },
        {
          merge: true,
        }
      )

      await loadBooks()

      setSelectedBookId(
        bookId
      )

      closeBookModal()

      notify(
        editingBookId
          ? 'تم تحديث بيانات الكتاب بنجاح.'
          : 'تمت إضافة الكتاب بنجاح.'
      )
    } catch (saveError) {
      console.error(
        'Islamic library book save error:',
        saveError
      )

      showError(
        'تعذر حفظ الكتاب. تأكد من صلاحيات حساب الإدارة.'
      )
    } finally {
      setSavingBook(false)
    }
  }

  async function toggleBookVisibility(
    book: AdminBook
  ) {
    try {
      setDeletingBookId(
        book.id
      )
      setError('')

      await setDoc(
        doc(
          db,
          'islamicLibraryBooks',
          book.id
        ),
        {
          id: book.id,
          deleted:
            !book.deleted,
          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      )

      await loadBooks()

      notify(
        book.deleted
          ? 'تم إظهار الكتاب مرة أخرى.'
          : 'تم إخفاء الكتاب من المكتبة.'
      )
    } catch (toggleError) {
      console.error(
        'Islamic library visibility error:',
        toggleError
      )

      showError(
        'تعذر تغيير حالة ظهور الكتاب.'
      )
    } finally {
      setDeletingBookId(null)
    }
  }

  async function deleteCustomBook(
    book: AdminBook
  ) {
    if (!book.isCustom) {
      await toggleBookVisibility(
        book
      )
      return
    }

    const confirmed =
      window.confirm(
        `هل تريد حذف الكتاب نهائيًا؟\n\n${book.title}`
      )

    if (!confirmed) {
      return
    }

    try {
      setDeletingBookId(
        book.id
      )

      await deleteDoc(
        doc(
          db,
          'islamicLibraryBooks',
          book.id
        )
      )

      if (
        selectedBookId ===
        book.id
      ) {
        setSelectedBookId(null)
        setVideos([])
      }

      await loadBooks()

      notify(
        'تم حذف الكتاب المضاف من لوحة الإدارة.'
      )
    } catch (deleteError) {
      console.error(
        'Islamic library book delete error:',
        deleteError
      )

      showError(
        'تعذر حذف الكتاب.'
      )
    } finally {
      setDeletingBookId(null)
    }
  }

  function openCreateVideo() {
    if (!selectedBook) {
      showError(
        'اختر كتابًا أولًا لإضافة الدرس.'
      )
      return
    }

    setEditingVideoId(null)

    setVideoForm({
      title: '',
      url: '',
      order: String(
        videos.length + 1
      ),
    })

    setVideoModalOpen(true)
  }

  function openEditVideo(
    video: VideoLesson
  ) {
    setEditingVideoId(
      video.id
    )

    setVideoForm({
      title: video.title,
      url: video.url,
      order: String(
        video.order
      ),
    })

    setVideoModalOpen(true)
  }

  function closeVideoModal() {
    if (savingVideo) {
      return
    }

    setVideoModalOpen(false)
    setEditingVideoId(null)
    setVideoForm({
      ...EMPTY_VIDEO_FORM,
    })
  }

  async function saveVideo() {
    if (!selectedBook) {
      showError(
        'اختر الكتاب أولًا.'
      )
      return
    }

    const title =
      videoForm.title.trim()

    const url =
      videoForm.url.trim()

    const parsedOrder =
      Number(
        videoForm.order
      )

    if (!title) {
      showError(
        'اكتب اسم الدرس.'
      )
      return
    }

    if (!url) {
      showError(
        'أدخل رابط الفيديو.'
      )
      return
    }

    if (
      !Number.isFinite(
        parsedOrder
      ) ||
      parsedOrder < 1
    ) {
      showError(
        'رقم ترتيب الدرس غير صحيح.'
      )
      return
    }

    try {
      setSavingVideo(true)
      setError('')

      const videoId =
        editingVideoId ||
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`

      await setDoc(
        doc(
          db,
          'islamicLibraryBooks',
          selectedBook.id,
          'videos',
          videoId
        ),
        {
          id: videoId,
          title,
          url,
          order:
            Math.floor(
              parsedOrder
            ),
          updatedAt:
            serverTimestamp(),

          ...(editingVideoId
            ? {}
            : {
                createdAt:
                  serverTimestamp(),
              }),
        },
        {
          merge: true,
        }
      )

      await loadVideos(
        selectedBook.id
      )

      closeVideoModal()

      notify(
        editingVideoId
          ? 'تم تحديث الدرس بنجاح.'
          : 'تمت إضافة الدرس بنجاح.'
      )
    } catch (saveError) {
      console.error(
        'Islamic library video save error:',
        saveError
      )

      showError(
        'تعذر حفظ الدرس. تأكد من صلاحيات حساب الإدارة.'
      )
    } finally {
      setSavingVideo(false)
    }
  }

  async function deleteVideo(
    video: VideoLesson
  ) {
    if (!selectedBook) {
      return
    }

    const confirmed =
      window.confirm(
        `هل تريد حذف هذا الدرس؟\n\n${video.title}`
      )

    if (!confirmed) {
      return
    }

    try {
      setDeletingVideoId(
        video.id
      )

      await deleteDoc(
        doc(
          db,
          'islamicLibraryBooks',
          selectedBook.id,
          'videos',
          video.id
        )
      )

      await loadVideos(
        selectedBook.id
      )

      notify(
        'تم حذف الدرس بنجاح.'
      )
    } catch (deleteError) {
      console.error(
        'Islamic library video delete error:',
        deleteError
      )

      showError(
        'تعذر حذف الدرس.'
      )
    } finally {
      setDeletingVideoId(null)
    }
  }

  function getCategoryLabel(
    categoryId: SunniLibraryCategoryId
  ) {
    return (
      SUNNI_LIBRARY_CATEGORIES.find(
        (item) =>
          item.id === categoryId
      )?.label ||
      categoryId
    )
  }

  function getLevelLabel(
    level: SunniLibraryLevel
  ) {
    return (
      SUNNI_LIBRARY_LEVELS.find(
        (item) =>
          item.id === level
      )?.label ||
      level
    )
  }

  return (
    <section
      dir="rtl"
      className="mt-6 space-y-5"
    >
      <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700">
                <BookOpen size={14} />
                إدارة المكتبة الشرعية
              </span>

              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                {visibleBooksCount.toLocaleString(
                  'ar-EG'
                )}{' '}
                كتاب ظاهر
              </span>

              {hiddenBooksCount > 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-500">
                  {hiddenBooksCount.toLocaleString(
                    'ar-EG'
                  )}{' '}
                  مخفي
                </span>
              ) : null}
            </div>

            <h2 className="mt-3 text-2xl font-black text-slate-900">
              الكتب والدروس والشروحات
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
              من هنا تستطيع إضافة الكتب أو تعديل بياناتها، ووضع رابط
              التحميل، ثم إضافة جميع دروس الشرح الخاصة بكل كتاب مع
              ترتيبها. الروابط النصية فقط تكفي؛ الفيديو يفتح لاحقًا
              داخل المنصة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateBook}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-sky-600 px-5 text-xs font-black text-white transition hover:bg-sky-700"
            >
              <Plus size={17} />
              إضافة كتاب
            </button>

            <button
              type="button"
              onClick={() =>
                void loadBooks()
              }
              disabled={loadingBooks}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  loadingBooks
                    ? 'animate-spin'
                    : ''
                }
              />
              تحديث
            </button>
          </div>
        </div>

        {(message || error) ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-xs font-bold leading-6 ${
              error
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || message}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="ابحث باسم الكتاب أو المؤلف..."
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <select
                    value={levelFilter}
                    onChange={(event) =>
                      setLevelFilter(
                        event.target
                          .value as
                          | 'الكل'
                          | SunniLibraryLevel
                      )
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none"
                  >
                    <option value="الكل">
                      كل المستويات
                    </option>

                    {SUNNI_LIBRARY_LEVELS.map(
                      (level) => (
                        <option
                          key={level.id}
                          value={level.id}
                        >
                          {level.label}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={
                      categoryFilter
                    }
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target
                          .value as
                          | 'الكل'
                          | SunniLibraryCategoryId
                      )
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none"
                  >
                    <option value="الكل">
                      كل التصنيفات
                    </option>

                    {SUNNI_LIBRARY_CATEGORIES.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={
                            category.id
                          }
                        >
                          {category.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {loadingBooks ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sky-600">
                  <Loader2
                    size={34}
                    className="animate-spin"
                  />

                  <p className="text-sm font-black">
                    جاري تحميل كتب المكتبة...
                  </p>
                </div>
              ) : filteredBooks.length ===
                0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                    <Search size={27} />
                  </div>

                  <h3 className="mt-4 text-lg font-black text-slate-800">
                    لا توجد كتب مطابقة
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    غيّر كلمات البحث أو الفلاتر المستخدمة.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredBooks.map(
                    (book) => {
                      const active =
                        selectedBookId ===
                        book.id

                      return (
                        <article
                          key={book.id}
                          className={`group rounded-[26px] border p-5 transition ${
                            active
                              ? 'border-sky-300 bg-sky-50/50 shadow-md'
                              : 'border-slate-200 bg-white hover:border-sky-200 hover:shadow-md'
                          } ${
                            book.deleted
                              ? 'opacity-70'
                              : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedBookId(
                                  book.id
                                )
                              }
                              className="min-w-0 flex-1 text-right"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                                  <BookOpen
                                    size={23}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                                      {book.level}
                                    </span>

                                    {book.isCustom ? (
                                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                        مضاف من الإدارة
                                      </span>
                                    ) : null}

                                    {book.deleted ? (
                                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-500">
                                        مخفي
                                      </span>
                                    ) : null}
                                  </div>

                                  <h3 className="mt-2 line-clamp-2 text-base font-black leading-7 text-slate-900">
                                    {book.title}
                                  </h3>

                                  <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                    <UserRound
                                      size={13}
                                    />
                                    {book.author}
                                  </p>
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditBook(
                                  book
                                )
                              }
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-sky-200 hover:text-sky-600"
                              title="تعديل الكتاب"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>
                          </div>

                          <p className="mt-4 line-clamp-2 text-xs leading-6 text-slate-500">
                            {book.description}
                          </p>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBookId(
                                  book.id
                                )
                                openCreateVideoForBook(
                                  book
                                )
                              }}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-[11px] font-black text-slate-600 transition hover:bg-slate-100"
                            >
                              <Video
                                size={15}
                              />
                              إضافة درس
                            </button>

                            {book.downloadUrl ? (
                              <a
                                href={
                                  book.downloadUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <Download
                                  size={15}
                                />
                                التحميل
                              </a>
                            ) : (
                              <span className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-[11px] font-black text-slate-400">
                                <Download
                                  size={15}
                                />
                                لا يوجد تحميل
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <span className="text-[10px] font-bold text-slate-400">
                              {getCategoryLabel(
                                book.category
                              )}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedBookId(
                                    book.id
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-black text-sky-600 hover:bg-sky-50"
                              >
                                <Video
                                  size={13}
                                />
                                الدروس
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void toggleBookVisibility(
                                    book
                                  )
                                }
                                disabled={
                                  deletingBookId ===
                                  book.id
                                }
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-black ${
                                  book.deleted
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                                title={
                                  book.deleted
                                    ? 'إظهار'
                                    : 'إخفاء'
                                }
                              >
                                {book.deleted ? (
                                  <Eye
                                    size={13}
                                  />
                                ) : (
                                  <EyeOff
                                    size={13}
                                  />
                                )}

                                {book.deleted
                                  ? 'إظهار'
                                  : 'إخفاء'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void deleteCustomBook(
                                    book
                                  )
                                }
                                disabled={
                                  deletingBookId ===
                                  book.id
                                }
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-black text-red-500 hover:bg-red-50"
                              >
                                {deletingBookId ===
                                book.id ? (
                                  <Loader2
                                    size={13}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2
                                    size={13}
                                  />
                                )}

                                {book.isCustom
                                  ? 'حذف'
                                  : 'إخفاء'}
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="min-w-0">
          <div className="sticky top-5 rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black text-sky-600">
                    إدارة الدروس
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    الفيديوهات والشرح
                  </h3>
                </div>

                {selectedBook ? (
                  <button
                    type="button"
                    onClick={openCreateVideo}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white transition hover:bg-sky-700"
                    title="إضافة درس"
                  >
                    <Plus size={18} />
                  </button>
                ) : null}
              </div>

              {selectedBook ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black text-slate-400">
                    الكتاب المحدد
                  </p>

                  <p className="mt-1 text-sm font-black leading-6 text-slate-800">
                    {selectedBook.title}
                  </p>

                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {selectedBook.author}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center">
                  <Video
                    size={25}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-xs font-black text-slate-500">
                    اختر كتابًا من القائمة لإدارة دروسه.
                  </p>
                </div>
              )}
            </div>

            {selectedBook ? (
              <div className="p-5">
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-sky-50 p-3 text-center">
                    <div className="text-xl font-black text-sky-700">
                      {videos.length.toLocaleString(
                        'ar-EG'
                      )}
                    </div>

                    <div className="mt-1 text-[10px] font-black text-slate-500">
                      درس
                    </div>
                  </div>

                  <div className="rounded-2xl bg-amber-50 p-3 text-center">
                    <div className="text-sm font-black text-amber-700">
                      {getLevelLabel(
                        selectedBook.level
                      )}
                    </div>

                    <div className="mt-1 text-[10px] font-black text-slate-500">
                      المستوى
                    </div>
                  </div>
                </div>

                {loadingVideos ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-sky-600">
                    <Loader2
                      size={30}
                      className="animate-spin"
                    />

                    <p className="text-xs font-black">
                      جاري تحميل الدروس...
                    </p>
                  </div>
                ) : videos.length ===
                  0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                    <Video
                      size={27}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-black text-slate-700">
                      لا توجد دروس لهذا الكتاب
                    </p>

                    <p className="mt-2 text-xs leading-6 text-slate-400">
                      أضف اسم الدرس والرابط، وسيظهر للمستخدم داخل المنصة.
                    </p>

                    <button
                      type="button"
                      onClick={
                        openCreateVideo
                      }
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white"
                    >
                      <Plus size={15} />
                      إضافة أول درس
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {videos.map(
                      (
                        video,
                        index
                      ) => (
                        <article
                          key={video.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[11px] font-black text-sky-700">
                              {(
                                index +
                                1
                              ).toLocaleString(
                                'ar-EG'
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-black leading-6 text-slate-800">
                                {video.title}
                              </h4>

                              <p className="mt-1 break-all text-[10px] leading-5 text-slate-400">
                                {video.url}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <a
                              href={
                                video.url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-[10px] font-black text-slate-600 transition hover:bg-slate-100"
                            >
                              <ExternalLink
                                size={14}
                              />
                              اختبار الرابط
                            </a>

                            <button
                              type="button"
                              onClick={() =>
                                openEditVideo(
                                  video
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-200 hover:text-sky-600"
                              title="تعديل"
                            >
                              <Pencil
                                size={14}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void deleteVideo(
                                  video
                                )
                              }
                              disabled={
                                deletingVideoId ===
                                video.id
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-500 transition hover:bg-red-50"
                              title="حذف"
                            >
                              {deletingVideoId ===
                              video.id ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={14}
                                />
                              )}
                            </button>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {bookModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <p className="text-xs font-black text-sky-600">
                  {editingBookId
                    ? 'تعديل الكتاب'
                    : 'إضافة كتاب جديد'}
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-900">
                  بيانات الكتاب
                </h3>
              </div>

              <button
                type="button"
                onClick={
                  closeBookModal
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="اسم الكتاب كاملًا"
                  required
                  value={
                    bookForm.title
                  }
                  onChange={(value) =>
                    setBookForm(
                      (current) => ({
                        ...current,
                        title: value,
                      })
                    )
                  }
                  placeholder="مثال: العقيدة الواسطية"
                />

                <FormField
                  label="المؤلف"
                  required
                  value={
                    bookForm.author
                  }
                  onChange={(value) =>
                    setBookForm(
                      (current) => ({
                        ...current,
                        author: value,
                      })
                    )
                  }
                  placeholder="مثال: شيخ الإسلام ابن تيمية"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="المستوى"
                  value={
                    bookForm.level
                  }
                  onChange={(value) =>
                    setBookForm(
                      (current) => ({
                        ...current,
                        level:
                          value as SunniLibraryLevel,
                      })
                    )
                  }
                  options={SUNNI_LIBRARY_LEVELS.map(
                    (level) => ({
                      value: level.id,
                      label:
                        level.label,
                    })
                  )}
                />

                <SelectField
                  label="التصنيف"
                  value={
                    bookForm.category
                  }
                  onChange={(value) =>
                    setBookForm(
                      (current) => ({
                        ...current,
                        category:
                          value as SunniLibraryCategoryId,
                      })
                    )
                  }
                  options={SUNNI_LIBRARY_CATEGORIES.map(
                    (category) => ({
                      value:
                        category.id,
                      label:
                        category.label,
                    })
                  )}
                />
              </div>

              <TextAreaField
                label="وصف الكتاب"
                required
                value={
                  bookForm.description
                }
                onChange={(value) =>
                  setBookForm(
                    (current) => ({
                      ...current,
                      description:
                        value,
                    })
                  )
                }
                placeholder="اكتب وصفًا واضحًا ومختصرًا للكتاب..."
              />

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-sm font-black text-sky-700">
                  <Download size={17} />
                  روابط الكتاب
                </div>

                <div className="mt-4 space-y-4">
                  <FormField
                    label="رابط تحميل الكتاب"
                    value={
                      bookForm.downloadUrl
                    }
                    onChange={(value) =>
                      setBookForm(
                        (current) => ({
                          ...current,
                          downloadUrl:
                            value,
                        })
                      )
                    }
                    placeholder="https://..."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      label="رابط القراءة"
                      value={
                        bookForm.readingUrl
                      }
                      onChange={(value) =>
                        setBookForm(
                          (current) => ({
                            ...current,
                            readingUrl:
                              value,
                          })
                        )
                      }
                      placeholder="https://..."
                    />

                    <FormField
                      label="اسم زر القراءة"
                      value={
                        bookForm.readingLabel
                      }
                      onChange={(value) =>
                        setBookForm(
                          (current) => ({
                            ...current,
                            readingLabel:
                              value,
                          })
                        )
                      }
                      placeholder="قراءة الكتاب"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-sm font-black text-amber-700">
                  <GraduationCap
                    size={17}
                  />
                  بيانات الشرح
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField
                    label="اسم الشرح"
                    value={
                      bookForm.sharhTitle
                    }
                    onChange={(value) =>
                      setBookForm(
                        (current) => ({
                          ...current,
                          sharhTitle:
                            value,
                        })
                      )
                    }
                    placeholder="شرح الكتاب"
                  />

                  <FormField
                    label="شارح الكتاب"
                    value={
                      bookForm.sharhAuthor
                    }
                    onChange={(value) =>
                      setBookForm(
                        (current) => ({
                          ...current,
                          sharhAuthor:
                            value,
                        })
                      )
                    }
                    placeholder="اسم الشيخ أو المدرس"
                  />

                  <FormField
                    label="رابط الشرح"
                    value={
                      bookForm.sharhUrl
                    }
                    onChange={(value) =>
                      setBookForm(
                        (current) => ({
                          ...current,
                          sharhUrl:
                            value,
                        })
                      )
                    }
                    placeholder="https://..."
                  />

                  <FormField
                    label="اسم زر الشرح"
                    value={
                      bookForm.sharhLabel
                    }
                    onChange={(value) =>
                      setBookForm(
                        (current) => ({
                          ...current,
                          sharhLabel:
                            value,
                        })
                      )
                    }
                    placeholder="فتح الشرح"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeBookModal
                }
                disabled={savingBook}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-xs font-black text-slate-600"
              >
                <X size={16} />
                إلغاء
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveBook()
                }
                disabled={savingBook}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 text-xs font-black text-white disabled:opacity-60"
              >
                {savingBook ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={17}
                  />
                )}

                {editingBookId
                  ? 'حفظ التعديلات'
                  : 'إضافة الكتاب'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {videoModalOpen &&
      selectedBook ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-black text-sky-600">
                  {editingVideoId
                    ? 'تعديل الدرس'
                    : 'إضافة درس جديد'}
                </p>

                <h3 className="mt-1 line-clamp-2 text-lg font-black leading-7 text-slate-900">
                  {selectedBook.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={
                  closeVideoModal
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <FormField
                label="اسم الدرس"
                required
                value={
                  videoForm.title
                }
                onChange={(value) =>
                  setVideoForm(
                    (current) => ({
                      ...current,
                      title: value,
                    })
                  )
                }
                placeholder="مثال: الدرس الأول — مقدمة الكتاب"
              />

              <FormField
                label="رابط الفيديو"
                required
                value={
                  videoForm.url
                }
                onChange={(value) =>
                  setVideoForm(
                    (current) => ({
                      ...current,
                      url: value,
                    })
                  )
                }
                placeholder="رابط YouTube أو رابط ملف فيديو مباشر"
              />

              <FormField
                label="ترتيب الدرس"
                value={
                  videoForm.order
                }
                onChange={(value) =>
                  setVideoForm(
                    (current) => ({
                      ...current,
                      order: value,
                    })
                  )
                }
                placeholder="1"
                type="number"
              />

              <div className="rounded-2xl bg-sky-50 p-4 text-xs font-bold leading-6 text-sky-800">
                <div className="flex items-center gap-2 font-black">
                  <PlayCircle
                    size={16}
                  />
                  تنبيه
                </div>

                <p className="mt-2">
                  لا تحتاج إلى رفع الفيديو إلى
                  الموقع. أدخل الرابط فقط، وسيظهر
                  الدرس للمستخدم ليتم تشغيله داخل
                  المنصة.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeVideoModal
                }
                disabled={savingVideo}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-xs font-black text-slate-600"
              >
                <X size={16} />
                إلغاء
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveVideo()
                }
                disabled={savingVideo}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 text-xs font-black text-white disabled:opacity-60"
              >
                {savingVideo ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={17}
                  />
                )}

                {editingVideoId
                  ? 'حفظ التعديل'
                  : 'إضافة الدرس'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )

  function openCreateVideoForBook(
    book: AdminBook
  ) {
    setSelectedBookId(
      book.id
    )

    setEditingVideoId(null)

    setVideoForm({
      title: '',
      url: '',
      order: String(
        videos.length + 1
      ),
    })

    setVideoModalOpen(true)
  }
}

function FormField({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  required?: boolean
  value: string
  onChange: (
    value: string
  ) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-xs font-black text-slate-700">
        {label}

        {required ? (
          <span className="text-red-500">
            *
          </span>
        ) : null}
      </span>

      <div className="relative">
        {type === 'url' ? (
          <LinkIcon
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        ) : null}

        <input
          type={type}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          placeholder={placeholder}
          className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-400 ${
            type === 'url'
              ? 'pr-9'
              : ''
          }`}
          dir="rtl"
        />
      </div>
    </label>
  )
}

function TextAreaField({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (
    value: string
  ) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-xs font-black text-slate-700">
        <FileText
          size={14}
          className="text-sky-500"
        />

        {label}

        {required ? (
          <span className="text-red-500">
            *
          </span>
        ) : null}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold leading-7 text-slate-800 outline-none transition focus:border-sky-400"
        dir="rtl"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (
    value: string
  ) => void
  options: Array<{
    value: string
    label: string
  }>
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-xs font-black text-slate-700">
        <Layers3
          size={14}
          className="text-sky-500"
        />

        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-sky-400"
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </label>
  )
}
