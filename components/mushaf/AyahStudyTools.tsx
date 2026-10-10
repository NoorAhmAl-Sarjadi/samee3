'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  BookHeart, Check, CheckCircle2, Cloud, CloudOff, Download, Eye,
  EyeOff, HardDrive, Loader2, NotebookPen, Pause, Play,
  RefreshCw, Scale, Trash2,
} from 'lucide-react'
import { doc, increment, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  downloadOfflineTafsir, getOfflineTafsir, listOfflineTafsirs,
  removeOfflineTafsir, type OfflineBook,
} from '@/lib/tafsir-offline'

type Book = { id: number; name: string; short_name: string; author: string }
type StudyTab = 'memorize' | 'notes' | 'compare' | 'offline'
type StudyRecord = { note: string; reviewCount: number; memorized: boolean }
type StoredStudy = StudyRecord & {
  pendingNote: boolean
  pendingMemorized: boolean
  pendingReviews: number
  syncedReviewCount: number
}
type StudyStore = Record<string, StoredStudy>
type SyncStatus = 'local' | 'syncing' | 'synced' | 'error'

const STORAGE_PREFIX = 'samee3_ayah_study_offline_v1_'
const MAX_NOTE_LENGTH = 4000
const MAX_REVIEWS = 100000
const SYNCING_USERS = new Set<string>()
const EMPTY: StoredStudy = {
  note: '', reviewCount: 0, memorized: false,
  pendingNote: false, pendingMemorized: false,
  pendingReviews: 0, syncedReviewCount: 0,
}
const FALLBACK_BOOKS: Book[] = [
  { id: 2012, name: 'التفسير الميسر', short_name: 'الميسر', author: '' },
  { id: 136, name: 'تفسير ابن كثير', short_name: 'ابن كثير', author: '' },
  { id: 4, name: 'تفسير الطبري', short_name: 'الطبري', author: '' },
  { id: 2, name: 'تفسير البغوي', short_name: 'البغوي', author: '' },
  { id: 3, name: 'تفسير السعدي', short_name: 'السعدي', author: '' },
  { id: 1469, name: 'تفسير القرطبي', short_name: 'القرطبي', author: '' },
  { id: 27796, name: 'أضواء البيان', short_name: 'أضواء البيان', author: '' },
  { id: 54, name: 'أيسر التفاسير', short_name: 'أيسر التفاسير', author: '' },
]

function integer(value: unknown, max = MAX_REVIEWS): number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? Math.max(0, Math.min(max, value)) : 0
}
function normalized(value: unknown): StoredStudy {
  const entry = value && typeof value === 'object' ? value as Partial<StoredStudy> : {}
  return {
    note: typeof entry.note === 'string' ? entry.note.slice(0, MAX_NOTE_LENGTH) : '',
    reviewCount: integer(entry.reviewCount),
    memorized: entry.memorized === true,
    pendingNote: entry.pendingNote === true,
    pendingMemorized: entry.pendingMemorized === true,
    pendingReviews: integer(entry.pendingReviews),
    syncedReviewCount: integer(entry.syncedReviewCount),
  }
}
function storageKey(uid: string): string { return `${STORAGE_PREFIX}${uid}` }
function readStore(uid: string): StudyStore {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(uid)) || '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const store: StudyStore = {}
    Object.keys(raw as Record<string, unknown>).forEach((key) => {
      if (/^\d{1,3}_\d{1,3}$/.test(key)) {
        store[key] = normalized((raw as Record<string, unknown>)[key])
      }
    })
    return store
  } catch { return {} }
}
function persistStore(uid: string, store: StudyStore): boolean {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(store))
    return true
  } catch { return false }
}
function hasPending(entry: StoredStudy): boolean {
  return entry.pendingNote || entry.pendingMemorized || entry.pendingReviews > 0
}
function pendingCount(uid: string): number {
  const saved = readStore(uid)
  return Object.keys(saved).filter((key) => hasPending(saved[key])).length
}

/** Flush all pending ayat for this account, not only the currently open ayah. */
async function flushStudies(
  uid: string,
  update: (key: string, record: StoredStudy) => void,
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.onLine) return false
  if (SYNCING_USERS.has(uid)) return true
  SYNCING_USERS.add(uid)
  let failed = false
  try {
    const keys = Object.keys(readStore(uid)).filter((key) => hasPending(readStore(uid)[key]))
    for (const key of keys) {
      if (!navigator.onLine) { failed = true; break }
      const before = readStore(uid)[key]
      if (!before || !hasPending(before)) continue
      const fields: Record<string, unknown> = { updatedAt: serverTimestamp() }
      if (before.pendingNote) fields.note = before.note
      if (before.pendingMemorized) fields.memorized = before.memorized
      if (before.pendingReviews) fields.reviewCount = increment(before.pendingReviews)
      try {
        const documentRef = doc(db, 'users', uid, 'ayahStudy', key)
        // A transaction fails offline instead of queuing a second increment in Firebase.
        // Our own local queue remains intact and is retried on reconnection.
        await runTransaction(db, async (transaction) => {
          await transaction.get(documentRef)
          transaction.set(documentRef, fields, { merge: true })
        })
        const latest = readStore(uid)
        const current = latest[key]
        if (!current) continue
        if (before.pendingNote && current.note === before.note) current.pendingNote = false
        if (before.pendingMemorized && current.memorized === before.memorized) {
          current.pendingMemorized = false
        }
        current.pendingReviews = Math.max(0, current.pendingReviews - before.pendingReviews)
        current.syncedReviewCount = Math.max(
          current.syncedReviewCount,
          before.syncedReviewCount + before.pendingReviews,
        )
        current.reviewCount = Math.max(
          current.reviewCount,
          current.syncedReviewCount + current.pendingReviews,
        )
        latest[key] = current
        if (!persistStore(uid, latest)) failed = true
        update(key, current)
      } catch (error) {
        failed = true
        console.warn('SAMEE3 ayah study sync failed:', error)
        // Retain local changes for a later retry.
      }
    }
  } finally {
    SYNCING_USERS.delete(uid)
  }
  return !failed
}

export default function AyahStudyTools({
  surah, ayah, verse, riwaya, books, onRepeat, onToast, onHideChange,
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
  const uid = user?.uid || ''
  const id = `${surah}_${ayah}`
  const [tab, setTab] = useState<StudyTab>('memorize')
  const [hidden, setHidden] = useState(false)
  const [repeatTimes, setRepeatTimes] = useState(3)
  const [study, setStudy] = useState<StoredStudy>({ ...EMPTY })
  const [noteDraft, setNoteDraft] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [remaining, setRemaining] = useState(0)
  const [selectedBooks, setSelectedBooks] = useState<[number, number]>([2012, 136])
  const [comparisons, setComparisons] = useState<Record<number, string>>({})
  const [compareLoading, setCompareLoading] = useState(false)
  const [offline, setOffline] = useState<OfflineBook[]>([])
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [offlineBookId, setOfflineBookId] = useState(2012)
  const [downloading, setDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState('')
  const abortDownloadRef = useRef<AbortController | null>(null)
  const requestRef = useRef(0)
  const draftDirtyRef = useRef(false)
  const onToastRef = useRef(onToast)
  const onHideRef = useRef(onHideChange)
  const activeRef = useRef({ uid, id })
  onToastRef.current = onToast
  onHideRef.current = onHideChange
  activeRef.current = { uid, id }

  const refreshLocal = useCallback(() => {
    if (!uid) { setRemaining(0); return }
    const saved = readStore(uid)
    const item = saved[id] || { ...EMPTY }
    setStudy(item)
    if (!draftDirtyRef.current) setNoteDraft(item.note)
    setRemaining(Object.keys(saved).filter((key) => hasPending(saved[key])).length)
    setSyncStatus(hasPending(item) ? 'local' : 'synced')
  }, [uid, id])

  const syncNow = useCallback(async () => {
    if (!uid || typeof navigator === 'undefined' || !navigator.onLine) return
    if (SYNCING_USERS.has(uid)) return
    setSyncStatus('syncing')
    const ok = await flushStudies(uid, (key, item) => {
      if (activeRef.current.uid === uid && activeRef.current.id === key) {
        setStudy(item)
        if (!draftDirtyRef.current) setNoteDraft(item.note)
      }
    })
    if (activeRef.current.uid === uid) {
      const saved = readStore(uid)
      setRemaining(Object.keys(saved).filter((key) => hasPending(saved[key])).length)
      setSyncStatus(!ok ? 'error' : Object.keys(saved).some((key) => hasPending(saved[key])) ? 'local' : 'synced')
    }
  }, [uid])

  useEffect(() => {
    draftDirtyRef.current = false
    setHidden(false)
    onHideRef.current(false)
    setComparisons({})
    refreshLocal()
    if (!uid) return

    const remote = doc(db, 'users', uid, 'ayahStudy', id)
    const unsubscribe = onSnapshot(remote, { includeMetadataChanges: true },
      (snapshot) => {
        // Cache-only or optimistic writes cannot replace unsynced local edits.
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return
        const data = snapshot.data()
        const saved = readStore(uid)
        const local = saved[id] || { ...EMPTY }
        const cloudCount = integer(data?.reviewCount)
        const merged: StoredStudy = {
          ...local,
          note: local.pendingNote ? local.note : (typeof data?.note === 'string' ? data.note : ''),
          memorized: local.pendingMemorized ? local.memorized : data?.memorized === true,
          reviewCount: local.pendingReviews
            ? Math.max(local.reviewCount, cloudCount)
            : cloudCount,
          syncedReviewCount: local.pendingReviews ? local.syncedReviewCount : cloudCount,
        }
        saved[id] = merged
        if (!persistStore(uid, saved)) {
          onToastRef.current('المساحة المحلية ممتلئة؛ تعذر تحديث نسخة الآية المحلية.')
        }
        if (activeRef.current.uid === uid && activeRef.current.id === id) {
          setStudy(merged)
          if (!draftDirtyRef.current) setNoteDraft(merged.note)
        }
      },
      () => { // The local copy remains available even if rules/network block Firestore.
        setSyncStatus('error')
      },
    )
    void syncNow()
    return () => unsubscribe()
  }, [uid, id, refreshLocal, syncNow])

  useEffect(() => {
    if (!uid) return
    const retry = () => { refreshLocal(); void syncNow() }
    const onVisible = () => {
      if (document.visibilityState === 'visible') retry()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(uid)) retry()
    }
    window.addEventListener('online', retry)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(() => {
      if (navigator.onLine && pendingCount(uid) > 0) void syncNow()
    }, 30000)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [uid, refreshLocal, syncNow])

  const saveLocal = (change: (value: StoredStudy) => StoredStudy): boolean => {
    if (!uid) { onToastRef.current('سجل الدخول لحفظ المراجعات والملاحظات.'); return false }
    const saved = readStore(uid)
    const updated = change({ ...(saved[id] || study) })
    saved[id] = updated
    if (!persistStore(uid, saved)) {
      onToastRef.current('تعذر الحفظ المحلي. تحقق من مساحة التخزين أو وضع التصفح الخاص.')
      return false
    }
    setStudy(updated)
    setRemaining(Object.keys(saved).filter((key) => hasPending(saved[key])).length)
    setSyncStatus('local')
    void syncNow()
    return true
  }

  const saveNote = () => {
    const note = noteDraft.trim()
    if (note.length > MAX_NOTE_LENGTH) return onToastRef.current('الحد الأقصى للملاحظة 4000 حرف.')
    if (saveLocal((old) => ({ ...old, note, pendingNote: true }))) {
      draftDirtyRef.current = false
      onToastRef.current('حُفظت الملاحظة على جهازك، وستُزامن مع حسابك عند توفر الاتصال.')
    }
  }
  const completeReview = () => {
    if (study.reviewCount >= MAX_REVIEWS) return onToastRef.current('تم بلوغ الحد الأقصى للمراجعات.')
    if (saveLocal((old) => ({
      ...old,
      reviewCount: Math.min(MAX_REVIEWS, old.reviewCount + 1),
      pendingReviews: old.pendingReviews + 1,
    }))) onToastRef.current('تم تسجيل المراجعة على الجهاز.')
  }
  const toggleMemorized = () => {
    if (saveLocal((old) => ({
      ...old, memorized: !old.memorized, pendingMemorized: true,
    }))) onToastRef.current('تم حفظ حالة الآية محليًا.')
  }

  const refreshOffline = useCallback(async () => {
    try { setOffline(await listOfflineTafsirs()) } catch { setOffline([]) }
    try {
      const estimate = await navigator.storage?.estimate?.()
      if (estimate?.quota && typeof estimate.usage === 'number') {
        setStorageUsage({ usage: estimate.usage, quota: estimate.quota })
      }
    } catch { /* Optional browser API */ }
  }, [])
  useEffect(() => { if (tab === 'offline') void refreshOffline() }, [tab, refreshOffline])
  useEffect(() => () => { abortDownloadRef.current?.abort() }, [])

  const compare = useCallback(async () => {
    const ticket = ++requestRef.current
    setComparisons({})
    setCompareLoading(true)
    const results: Record<number, string> = {}
    try {
      await Promise.all(Array.from(new Set(selectedBooks)).map(async (book) => {
        try {
          let body = await getOfflineTafsir(book, surah, ayah)
          if (!body) {
            const response = await fetch(
              `/api/tafsir?mode=ayah&surah=${surah}&ayah=${ayah}&book=${book}`,
              { cache: 'no-store' },
            )
            if (!response.ok) throw new Error('Tafsir unavailable')
            const json: unknown = await response.json()
            const data = json && typeof json === 'object' ? json as Record<string, unknown> : {}
            if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('No text')
            body = data.text.trim()
          }
          results[book] = body || 'لا يوجد نص تفسير لهذه الآية.'
        } catch {
          results[book] = 'التفسير غير متاح الآن. نزّل الكتاب أولًا للقراءة دون نت.'
        }
      }))
      if (ticket === requestRef.current) setComparisons(results)
    } finally {
      if (ticket === requestRef.current) setCompareLoading(false)
    }
  }, [selectedBooks, surah, ayah])
  useEffect(() => { if (tab === 'compare') void compare() }, [tab, compare])

  const downloadBook = async () => {
    if (downloading) return
    const controller = new AbortController()
    abortDownloadRef.current = controller
    setDownloading(true)
    setDownloadStatus('جارٍ تهيئة التنزيل…')
    try {
      const saved = await downloadOfflineTafsir(offlineBookId, controller.signal, setDownloadStatus)
      await refreshOffline()
      setDownloadStatus(`تم حفظ ${saved.entries.toLocaleString('ar-EG')} مدخل تفسير على الجهاز.`)
      onToastRef.current('الكتاب متاح الآن دون إنترنت.')
    } catch (error) {
      setDownloadStatus(error instanceof Error ? error.message : 'تعذر حفظ الكتاب.')
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
    } catch { setDownloadStatus('تعذر حذف الكتاب.') }
  }
  const viewBooks = FALLBACK_BOOKS.map((fallback) => {
    const actual = books.find((item) => item.id === fallback.id)
    return actual || fallback
  })
  const bookName = (book: number) => viewBooks.find((item) => item.id === book)?.short_name ||
    viewBooks.find((item) => item.id === book)?.name || `كتاب ${book}`

  return (
    <div dir="rtl" className="mt-5 overflow-hidden rounded-[22px] border border-[#d9c5a4] bg-[#fffefa] text-[#173e4b]">
      <div className="border-b border-[#eee4d7] bg-[#f7f4ee] p-3">
        <p className="mb-3 text-xs font-black text-[#997744]">استوديو الآية · الحفظ والفهم</p>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            ['memorize', 'الحفظ', BookHeart],
            ['notes', 'ملاحظاتي', NotebookPen],
            ['compare', 'مقارنة', Scale],
            ['offline', 'دون نت', HardDrive],
          ] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => setTab(value)}
              className={`flex min-h-[65px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold ${tab === value ? 'bg-[#17586d] text-white shadow-sm' : 'bg-white text-[#476978]'}`}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {(tab === 'notes' || tab === 'memorize') && uid && (
        <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f2f6f4] px-3 py-2 text-[11px] text-[#356050]">
          <span className="flex items-center gap-1.5">
            {syncStatus === 'syncing' ? <Loader2 size={14} className="animate-spin" /> :
              syncStatus === 'synced' && remaining === 0 ? <Cloud size={14}/> : <CloudOff size={14}/>}
            {syncStatus === 'syncing' ? 'جارٍ مزامنة حسابك…' :
              syncStatus === 'error' ? 'المزامنة متعثرة؛ نسخة الجهاز محفوظة' :
              remaining > 0 ? `${remaining} آية تنتظر المزامنة` : 'محفوظ ومتزامن'}
          </span>
          {(remaining > 0 || syncStatus === 'error') && (
            <button type="button" onClick={() => void syncNow()} className="flex items-center gap-1 font-bold text-[#15586e]">
              <RefreshCw size={13}/> إعادة المزامنة
            </button>
          )}
        </div>
      )}

      <div className="space-y-3 p-4">
        {tab === 'memorize' && <>
          <p className="text-xs leading-6 text-slate-600">راجع الآية برواية {riwaya}، وأخفِ النص للتسميع. تُسجَّل المراجعات على الجهاز أولًا ثم تُزامن بحسابك.</p>
          <div className="rounded-2xl border border-[#d9c9ad] bg-[#fcfaf4] p-4 text-center">
            {hidden ? <p className="py-9 text-sm font-semibold text-[#9f834f]">تم إخفاء الآية — سمّع من الذاكرة</p> :
              <p className="whitespace-pre-wrap font-serif text-xl leading-[2.4] text-[#234650]">{verse}</p>}
          </div>
          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#bca377] bg-white p-3 text-xs font-bold"
            onClick={() => { setHidden(!hidden); onHideRef.current(!hidden) }}>
            {hidden ? <Eye size={16}/> : <EyeOff size={16}/>}
            {hidden ? 'إظهار الآية للتحقق' : 'إخفاء الآية للاختبار'}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
            <label className="text-xs font-bold">عدد مرات التكرار
              <select className="mr-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5" value={repeatTimes}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setRepeatTimes(Number(event.target.value))}>
                {[1, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void onRepeat(repeatTimes)} className="flex items-center gap-2 rounded-xl bg-[#15586e] px-4 py-2.5 text-xs font-extrabold text-white">
              <Play size={15}/> تشغيل التكرار
            </button>
          </div>
          {!uid && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">سجّل الدخول لحفظ المراجعات بين الأجهزة.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!uid} onClick={completeReview} className="rounded-xl bg-[#e8f3ed] p-3 text-xs font-extrabold text-[#24704b] disabled:opacity-50">
              <CheckCircle2 size={17} className="mb-1 inline"/> تسجيل مراجعة ({study.reviewCount})
            </button>
            <button type="button" disabled={!uid} onClick={toggleMemorized} className="rounded-xl bg-[#f9f0df] p-3 text-xs font-extrabold text-[#85672e] disabled:opacity-50">
              <Check size={17} className="mb-1 inline"/> {study.memorized ? 'تم الحفظ ✓' : 'أتممت حفظ الآية'}
            </button>
          </div>
        </>}

        {tab === 'notes' && <>
          <p className="text-xs leading-6 text-slate-600">اكتب ملاحظتك الخاصة. تُحفظ على الجهاز فور الضغط على حفظ، ثم تُزامن عبر Firebase عند توفر الاتصال وفتح المصحف.</p>
          {!uid && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">للحفظ والمزامنة <Link href="/auth" className="font-black underline">سجّل الدخول</Link>.</p>}
          <textarea rows={5} maxLength={MAX_NOTE_LENGTH} value={noteDraft}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { draftDirtyRef.current = true; setNoteDraft(event.target.value) }}
            disabled={!uid} placeholder="اكتب ملاحظاتك عن الآية…"
            className="w-full resize-y rounded-xl border border-[#dccbb1] bg-white p-3 text-sm leading-7 outline-none focus:border-[#a98653] disabled:opacity-50"/>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">{noteDraft.length} / 4000</span>
            <button type="button" disabled={!uid} onClick={saveNote}
              className="flex items-center gap-2 rounded-xl bg-[#15586e] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              <NotebookPen size={16}/> حفظ الملاحظة
            </button>
          </div>
          <p className="text-[11px] leading-5 text-slate-500">البيانات المحلية مرتبطة بالحساب على هذا الجهاز؛ لا تُحفظ مشفرة في تخزين المتصفح، لذلك تجنّب كتابة معلومات حساسة على جهاز مشترك.</p>
        </>}

        {tab === 'compare' && <>
          <p className="text-xs leading-6 text-slate-600">قارن تفسيرين للآية. نقرأ النسخة المحفوظة على الجهاز أولًا، ثم نحاول الإنترنت عند عدم توفرها.</p>
          <div className="grid grid-cols-2 gap-2">
            {selectedBooks.map((selected, index) => (
              <select key={index} value={selected}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedBooks((old) => index === 0 ? [Number(event.target.value), old[1]] : [old[0], Number(event.target.value)])}
                className="min-w-0 rounded-xl border border-[#d7c7ac] bg-white p-2.5 text-xs font-bold">
                {viewBooks.map((book) => <option key={book.id} value={book.id}>{book.short_name || book.name}</option>)}
              </select>
            ))}
          </div>
          <button type="button" disabled={compareLoading} onClick={() => void compare()}
            className="flex items-center gap-2 text-xs font-bold text-[#15586e]"><RefreshCw size={15}/> تحديث المقارنة</button>
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedBooks.map((book, index) => (
              <article key={`${book}-${index}`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="mb-3 border-b border-[#efe5d6] pb-2 text-xs font-black text-[#947046]">{bookName(book)}</h4>
                <p className="whitespace-pre-wrap break-words font-serif text-[15px] leading-8 text-[#23414c]">
                  {compareLoading ? 'جارٍ تحميل التفسير…' : comparisons[book] || 'اختر المصدر لعرض النص.'}
                </p>
              </article>
            ))}
          </div>
        </>}

        {tab === 'offline' && <>
          <p className="text-xs leading-6 text-slate-600">نزّل كتاب تفسير مرة واحدة لقراءته دون نت. يُحفظ في IndexedDB على الجهاز ولا يؤثر حذفه على صفحات المصحف المحمّلة.</p>
          <select value={offlineBookId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOfflineBookId(Number(event.target.value))} disabled={downloading}
            className="w-full rounded-xl border border-[#d7c7ac] bg-white p-3 text-xs font-bold">
            {viewBooks.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="button" disabled={downloading} onClick={() => void downloadBook()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#15586e] p-3 text-xs font-bold text-white disabled:opacity-50">
              {downloading ? <Loader2 size={17} className="animate-spin"/> : <Download size={17}/>}
              تنزيل الكتاب كاملًا
            </button>
            {downloading && <button type="button" onClick={() => abortDownloadRef.current?.abort()}
              aria-label="إيقاف تحميل الكتاب" className="rounded-xl border border-slate-200 bg-white px-3"><Pause size={17}/></button>}
          </div>
          {downloadStatus && <p role="status" className="rounded-xl bg-[#f6f2e9] p-3 text-xs leading-6">{downloadStatus}</p>}
          <p className="text-[11px] text-slate-500">عدد الكتب المحفوظة: {offline.length.toLocaleString('ar-EG')}</p>
          {storageUsage && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
            تخزين الموقع الإجمالي (يتضمن المصحف والصوت): {(storageUsage.usage / 1048576).toFixed(1)} م.ب من {(storageUsage.quota / 1048576).toFixed(0)} م.ب تقريبًا.
          </p>}
          {offline.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-0"><p className="truncate text-xs font-extrabold">{bookName(item.id)}</p>
              <p className="text-[10px] text-slate-500">{item.entries.toLocaleString('ar-EG')} مدخل · {(item.bytes / 1048576).toFixed(1)} م.ب نقل، والحجم بعد الفك أكبر</p></div>
            <button type="button" disabled={downloading} aria-label={`حذف ${bookName(item.id)}`} onClick={() => void removeBook(item.id)}
              className="rounded-lg bg-rose-50 p-2 text-rose-600 disabled:opacity-50"><Trash2 size={17}/></button>
          </div>)}
        </>}
      </div>
    </div>
  )
}
