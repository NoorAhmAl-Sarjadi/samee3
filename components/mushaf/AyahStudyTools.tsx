
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  BookHeart,
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  NotebookPen,
  Pause,
  Play,
  RefreshCw,
  Scale,
  Trash2,
} from 'lucide-react'
import {
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  downloadOfflineTafsir,
  getOfflineTafsir,
  listOfflineTafsirs,
  removeOfflineTafsir,
  type OfflineBook,
} from '@/lib/tafsir-offline'

type Book = {
  id: number
  name: string
  short_name: string
  author: string
}

type StudyTab = 'memorize' | 'notes' | 'compare' | 'offline'

type StudyRecord = {
  note: string
  reviewCount: number
  memorized: boolean
}

const EMPTY_STUDY: StudyRecord = {
  note: '',
  reviewCount: 0,
  memorized: false,
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export default function AyahStudyTools({
  surah,
  ayah,
  verse,
  riwaya,
  books,
  onRepeat,
  onToast,
  onHideChange,
}: {
  surah: number
  ayah: number
  verse: string
  riwaya: string
  books: Book[]
  onRepeat: (times: number) => Promise<void>
  onToast: (message: string) => void
  onHideChange: (value: boolean) => void
}) {
  const { user } = useAuth()

  const [tab, setTab] = useState<StudyTab>('memorize')
  const [hidden, setHidden] = useState(false)
  const [repeatTimes, setRepeatTimes] = useState(3)
  const [study, setStudy] = useState<StudyRecord>(EMPTY_STUDY)
  const [noteDraft, setNoteDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const [selectedBooks, setSelectedBooks] =
    useState<[number, number]>([2012, 136])

  const [comparisons, setComparisons] =
    useState<Record<number, string>>({})

  const [compareLoading, setCompareLoading] = useState(false)

  const [offline, setOffline] = useState<OfflineBook[]>([])

  const [storageUsage, setStorageUsage] = useState<{
    usage: number
    quota: number
  } | null>(null)

  const [offlineBookId, setOfflineBookId] = useState(2012)
  const [downloading, setDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState('')

  const abortDownloadRef = useRef<AbortController | null>(null)
  const requestRef = useRef(0)

  const uid = user?.uid
  const id = `${surah}_${ayah}`

  const refreshOffline = useCallback(async () => {
    try {
      setOffline(await listOfflineTafsirs())
    } catch {
      setOffline([])
    }

    try {
      const estimate = await navigator.storage?.estimate?.()

      if (
        estimate?.quota &&
        typeof estimate.usage === 'number'
      ) {
        setStorageUsage({
          usage: estimate.usage,
          quota: estimate.quota,
        })
      }
    } catch {
      // Storage estimation is optional.
    }
  }, [])

  useEffect(() => {
    setHidden(false)
    onHideChange(false)
    setComparisons({})
    setStudy(EMPTY_STUDY)
    setNoteDraft('')

    if (!uid) return

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid, 'ayahStudy', id),
      (snapshot) => {
        const data = snapshot.data()

        const next = {
          note: cleanText(data?.note),
          reviewCount:
            typeof data?.reviewCount === 'number'
              ? data.reviewCount
              : 0,
          memorized: data?.memorized === true,
        }

        setStudy(next)
        setNoteDraft(next.note)
      },
      () => {
        onToast(
          'تعذر مزامنة الملاحظات. راجع صلاحيات Firestore.',
        )
      },
    )

    return () => unsubscribe()
  }, [uid, id, onToast, onHideChange])

  useEffect(() => {
    if (tab === 'offline') {
      void refreshOffline()
    }
  }, [tab, refreshOffline])

  useEffect(() => {
    return () => {
      abortDownloadRef.current?.abort()
    }
  }, [])

  const saveFields = async (
    fields: Record<string, unknown>,
  ) => {
    if (!uid) {
      onToast(
        'سجّل الدخول لحفظ مراجعاتك وملاحظاتك بين الأجهزة.',
      )
      return false
    }

    setSaving(true)

    try {
      await setDoc(
        doc(db, 'users', uid, 'ayahStudy', id),
        {
          ...fields,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      return true
    } catch (error) {
      console.error('SAMEE3 study sync:', error)

      onToast(
        'تعذر الحفظ في Firebase. تأكد من نشر قواعد الملاحظات.',
      )

      return false
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async () => {
    const note = noteDraft.trim()

    if (note.length > 4000) {
      onToast('الحد الأقصى للملاحظة 4000 حرف.')
      return
    }

    if (await saveFields({ note })) {
      onToast('تم حفظ الملاحظة في حسابك.')
    }
  }

  const completeReview = async () => {
    if (
      await saveFields({
        reviewCount: increment(1),
      })
    ) {
      onToast('أحسنت، سُجلت مراجعة جديدة.')
    }
  }

  const setMemorized = async () => {
    if (
      await saveFields({
        memorized: !study.memorized,
      })
    ) {
      onToast(
        study.memorized
          ? 'تم إلغاء علامة الحفظ.'
          : 'تم تسجيل الآية ضمن محفوظاتك.',
      )
    }
  }

  const compare = useCallback(async () => {
    const ticket = ++requestRef.current

    setComparisons({})
    setCompareLoading(true)

    const ids = Array.from(new Set(selectedBooks))

    try {
      const results = await Promise.all(
        ids.map(async (book) => {
          try {
            let body = await getOfflineTafsir(
              book,
              surah,
              ayah,
            )

            if (!body) {
              const response = await fetch(
                `/api/tafsir?mode=ayah&surah=${surah}&ayah=${ayah}&book=${book}`,
                { cache: 'no-store' },
              )

              const json = await response.json()

              if (
                !response.ok ||
                typeof json.text !== 'string' ||
                !json.text.trim()
              ) {
                throw new Error(
                  'التفسير غير متاح لهذه الآية.',
                )
              }

              body = json.text.trim()
            }

            return [
              book,
              body || 'لا يوجد تفسير محفوظ لهذه الآية.',
            ] as const
          } catch {
            return [
              book,
              'هذا التفسير غير متاح حاليًا. اتصل بالإنترنت أو نزّل الكتاب.',
            ] as const
          }
        }),
      )

      if (ticket === requestRef.current) {
        setComparisons(Object.fromEntries(results))
      }
    } finally {
      if (ticket === requestRef.current) {
        setCompareLoading(false)
      }
    }
  }, [selectedBooks, surah, ayah])

  useEffect(() => {
    if (tab === 'compare') {
      void compare()
    }
  }, [tab, compare])

  const downloadBook = async () => {
    if (downloading) return

    const controller = new AbortController()
    abortDownloadRef.current = controller

    setDownloading(true)
    setDownloadStatus('جارٍ تهيئة التنزيل…')

    try {
      const saved = await downloadOfflineTafsir(
        offlineBookId,
        controller.signal,
        setDownloadStatus,
      )

      await refreshOffline()

      setDownloadStatus(
        `تم حفظ ${saved.entries.toLocaleString('ar-EG')} تفسير آية على الجهاز.`,
      )

      onToast('الكتاب متاح الآن دون إنترنت.')
    } catch (error) {
      setDownloadStatus(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ الكتاب.',
      )
    } finally {
      abortDownloadRef.current = null
      setDownloading(false)
    }
  }

  const removeBook = async (book: number) => {
    try {
      await removeOfflineTafsir(book)
      await refreshOffline()

      setDownloadStatus('تم حذف الكتاب من هذا الجهاز.')
    } catch {
      setDownloadStatus('تعذر حذف الكتاب.')
    }
  }

  const bookName = (book: number) =>
    books.find((item) => item.id === book)?.short_name ||
    books.find((item) => item.id === book)?.name ||
    `كتاب ${book}`

  const optionBooks = books.filter((book) =>
    [
      2012, 136, 4, 2,
      3, 1469, 27796, 54,
    ].includes(book.id),
  )

  const viewBooks =
    optionBooks.length > 0
      ? optionBooks
      : [
          {
            id: 2012,
            name: 'التفسير الميسر',
            short_name: 'الميسر',
            author: '',
          },
          {
            id: 136,
            name: 'تفسير ابن كثير',
            short_name: 'ابن كثير',
            author: '',
          },
          {
            id: 4,
            name: 'تفسير الطبري',
            short_name: 'الطبري',
            author: '',
          },
          {
            id: 2,
            name: 'تفسير البغوي',
            short_name: 'البغوي',
            author: '',
          },
          {
            id: 3,
            name: 'تفسير السعدي',
            short_name: 'السعدي',
            author: '',
          },
          {
            id: 1469,
            name: 'تفسير القرطبي',
            short_name: 'القرطبي',
            author: '',
          },
          {
            id: 27796,
            name: 'أضواء البيان',
            short_name: 'أضواء البيان',
            author: '',
          },
          {
            id: 54,
            name: 'أيسر التفاسير',
            short_name: 'أيسر التفاسير',
            author: '',
          },
        ]

  return (
    <div
      dir="rtl"
      className="mt-5 overflow-hidden rounded-[22px] border border-[#d9c5a4] bg-[#fffefa] text-[#173e4b]"
    >
      <div className="border-b border-[#eee4d7] bg-[#f7f4ee] p-3">
        <p className="mb-3 text-xs font-black text-[#997744]">
          استوديو الآية · الحفظ والفهم
        </p>

        <div className="grid grid-cols-4 gap-1.5">
          {([
            ['memorize', 'الحفظ', BookHeart],
            ['notes', 'ملاحظاتي', NotebookPen],
            ['compare', 'مقارنة', Scale],
            ['offline', 'دون نت', HardDrive],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`flex min-h-[65px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold ${
                tab === value
                  ? 'bg-[#17586d] text-white shadow-sm'
                  : 'bg-white text-[#476978]'
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {tab === 'memorize' && (
          <>
            <p className="text-xs leading-6 text-slate-600">
              راجع الآية برواية {riwaya}، وأخفِ النص
              لاختبار حفظك. التسجيل على حسابك متاح
              عند تسجيل الدخول.
            </p>

            <div className="rounded-2xl border border-[#d9c9ad] bg-[#fcfaf4] p-4 text-center">
              {hidden ? (
                <p className="py-9 text-sm font-semibold text-[#9f834f]">
                  تم إخفاء الآية — تسميع من الذاكرة
                </p>
              ) : (
                <p className="whitespace-pre-wrap font-serif text-xl leading-[2.4] text-[#234650]">
                  {verse}
                </p>
              )}
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#bca377] bg-white p-3 text-xs font-bold"
              onClick={() => {
                setHidden(!hidden)
                onHideChange(!hidden)
              }}
            >
              {hidden ? (
                <Eye size={16} />
              ) : (
                <EyeOff size={16} />
              )}

              {hidden
                ? 'إظهار الآية للتحقق'
                : 'إخفاء الآية للاختبار'}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <label className="text-xs font-bold">
                عدد مرات التكرار

                <select
                  className="mr-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                  value={repeatTimes}
                  onChange={(event) =>
                    setRepeatTimes(
                      Number(event.target.value),
                    )
                  }
                >
                  {[1, 3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void onRepeat(repeatTimes)}
                className="flex items-center gap-2 rounded-xl bg-[#15586e] px-4 py-2.5 text-xs font-extrabold text-white"
              >
                <Play size={15} />
                تشغيل التكرار
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving || !uid}
                onClick={() => void completeReview()}
                className="rounded-xl bg-[#e8f3ed] p-3 text-xs font-extrabold text-[#24704b] disabled:opacity-50"
              >
                <CheckCircle2
                  size={17}
                  className="mb-1 inline"
                />
                تسجيل مراجعة ({study.reviewCount})
              </button>

              <button
                type="button"
                disabled={saving || !uid}
                onClick={() => void setMemorized()}
                className="rounded-xl bg-[#f9f0df] p-3 text-xs font-extrabold text-[#85672e] disabled:opacity-50"
              >
                <Check
                  size={17}
                  className="mb-1 inline"
                />
                {study.memorized
                  ? 'تم الحفظ ✓'
                  : 'أتممت حفظ الآية'}
              </button>
            </div>
          </>
        )}

        {tab === 'notes' && (
          <>
            <p className="text-xs leading-6 text-slate-600">
              اكتب ملاحظتك أو تأملك الشخصي.
              الملاحظة خاصة بحسابك ومزامنة بين
              أجهزتك عبر Firestore.
            </p>

            {!uid && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                للمزامنة والحفظ،{' '}
                <Link
                  href="/auth"
                  className="font-black underline"
                >
                  سجل الدخول
                </Link>
                .
              </p>
            )}

            <textarea
              rows={5}
              maxLength={4000}
              value={noteDraft}
              onChange={(event) =>
                setNoteDraft(event.target.value)
              }
              disabled={!uid}
              placeholder="اكتب ملاحظاتك عن الآية…"
              className="w-full resize-y rounded-xl border border-[#dccbb1] bg-white p-3 text-sm leading-7 outline-none focus:border-[#a98653] disabled:opacity-50"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                {noteDraft.length} / 4000
              </span>

              <button
                type="button"
                disabled={saving || !uid}
                onClick={() => void saveNote()}
                className="flex items-center gap-2 rounded-xl bg-[#15586e] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <NotebookPen size={16} />
                )}

                حفظ الملاحظة
              </button>
            </div>
          </>
        )}

        {tab === 'compare' && (
          <>
            <p className="text-xs leading-6 text-slate-600">
              قارن تفسيرين مستقلين لنفس الآية.
              المحتوى يُقرأ من النسخة المحفوظة
              أولًا عند توفرها.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {selectedBooks.map((selected, index) => (
                <select
                  key={index}
                  value={selected}
                  onChange={(event) =>
                    setSelectedBooks((current) =>
                      index === 0
                        ? [
                            Number(event.target.value),
                            current[1],
                          ]
                        : [
                            current[0],
                            Number(event.target.value),
                          ],
                    )
                  }
                  className="min-w-0 rounded-xl border border-[#d7c7ac] bg-white p-2.5 text-xs font-bold"
                >
                  {viewBooks.map((book) => (
                    <option
                      key={book.id}
                      value={book.id}
                    >
                      {book.short_name || book.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>

            <button
              type="button"
              disabled={compareLoading}
              onClick={() => void compare()}
              className="flex items-center gap-2 text-xs font-bold text-[#15586e]"
            >
              <RefreshCw size={15} />
              تحديث المقارنة
            </button>

            <div className="grid gap-3 sm:grid-cols-2">
              {selectedBooks.map((book, index) => (
                <article
                  key={`${book}-${index}`}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <h4 className="mb-3 border-b border-[#efe5d6] pb-2 text-xs font-black text-[#947046]">
                    {bookName(book)}
                  </h4>

                  <p className="whitespace-pre-wrap break-words font-serif text-[15px] leading-8 text-[#23414c]">
                    {compareLoading
                      ? 'جارٍ تحميل التفسير…'
                      : comparisons[book] ||
                        'اختر المصدر لعرض النص.'}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === 'offline' && (
          <>
            <p className="text-xs leading-6 text-slate-600">
              نزّل كتاب تفسير رسميًا مرة واحدة،
              ثم اقرأه أو قارنه دون نت. يُخزَّن
              على هذا الجهاز فقط، ويمكن حذفه
              لتحرير المساحة.
            </p>

            <select
              value={offlineBookId}
              onChange={(event) =>
                setOfflineBookId(
                  Number(event.target.value),
                )
              }
              disabled={downloading}
              className="w-full rounded-xl border border-[#d7c7ac] bg-white p-3 text-xs font-bold"
            >
              {viewBooks.map((book) => (
                <option
                  key={book.id}
                  value={book.id}
                >
                  {book.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={downloading}
                onClick={() => void downloadBook()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#15586e] p-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Download size={17} />
                )}

                تنزيل الكتاب كاملًا
              </button>

              {downloading && (
                <button
                  type="button"
                  onClick={() =>
                    abortDownloadRef.current?.abort()
                  }
                  aria-label="إيقاف التحميل"
                  className="rounded-xl border border-slate-200 bg-white px-3"
                >
                  <Pause size={17} />
                </button>
              )}
            </div>

            {downloadStatus && (
              <p
                role="status"
                className="rounded-xl bg-[#f6f2e9] p-3 text-xs leading-6"
              >
                {downloadStatus}
              </p>
            )}

            <p className="text-[11px] text-slate-500">
              عدد الكتب المحفوظة:{' '}
              {offline.length.toLocaleString('ar-EG')}
            </p>

            {storageUsage && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                مساحة تخزين الموقع على الجهاز
                (تشمل المصحف والصوت):{' '}
                {(
                  storageUsage.usage / 1048576
                ).toFixed(1)}{' '}
                م.ب من{' '}
                {(
                  storageUsage.quota / 1048576
                ).toFixed(0)}{' '}
                م.ب متاحة تقريبًا.
              </p>
            )}

            {offline.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold">
                    {bookName(item.id)}
                  </p>

                  <p className="text-[10px] text-slate-500">
                    {item.entries.toLocaleString('ar-EG')}{' '}
                    آية ·{' '}
                    {(
                      item.bytes / 1048576
                    ).toFixed(1)}{' '}
                    م.ب للتنزيل؛ الحجم بعد الفك أكبر
                  </p>
                </div>

                <button
                  type="button"
                  disabled={downloading}
                  aria-label="حذف الكتاب المحفوظ"
                  onClick={() =>
                    void removeBook(item.id)
                  }
                  className="rounded-lg bg-rose-50 p-2 text-rose-600 disabled:opacity-50"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}

            <p className="text-[11px] leading-5 text-[#977743]">
              ملفات الكتب من الموسوعة القرآنية
              Quranpedia.net؛ قد تُصحَّح النصوص
              في المصدر لاحقًا، ويُفضّل إعادة
              تنزيل الكتاب دوريًا.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
