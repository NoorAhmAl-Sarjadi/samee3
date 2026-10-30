'use client'

import {
  useEffect, useMemo, useRef, useState,
  type FormEvent, type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, CheckCheck, Inbox, Loader2, MessageCircle,
  RefreshCw, Search, Send, ShieldCheck, WifiOff,
} from 'lucide-react'
import { collection, onSnapshot, type Timestamp } from 'firebase/firestore'
import AdminGate from '@/components/AdminGate'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  recoverSupportConversations,
  sendSupportMessage,
  subscribeSupportMessages,
  supportMessageError,
  type SupportMessage,
} from '@/lib/support-messages'

type Conversation = {
  id: string
  userName: string
  userEmail: string
  lastMessage: string
  lastSenderId: string
  unreadForAdmin: boolean
  updatedAt: unknown
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function milliseconds(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const candidate = value as { toMillis?: unknown }
    if (typeof candidate.toMillis === 'function') {
      try { return (value as Timestamp).toMillis() } catch { return 0 }
    }
  }
  return 0
}

function dateLabel(value: unknown): string {
  const ms = milliseconds(value)
  if (!ms) return 'الآن'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(ms))
}

function AdministrationInbox() {
  const { user, isAdmin } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [inboxLoading, setInboxLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inboxError, setInboxError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [sending, setSending] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const [mobileChat, setMobileChat] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const sendingRef = useRef(false)
  const activeIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  activeIdRef.current = activeId

  useEffect(() => {
    if (!isAdmin || !user) return
    const unsubscribe = onSnapshot(
      collection(db, 'conversations'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const rows = snapshot.docs.map((item): Conversation => {
          const data = item.data() as Record<string, unknown>
          return {
            id: item.id,
            userName: asText(data.userName, 'مستخدم مصحف سميع'),
            userEmail: asText(data.userEmail),
            lastMessage: asText(data.lastMessage),
            lastSenderId: asText(data.lastSenderId),
            unreadForAdmin: data.unreadForAdmin === true,
            updatedAt: data.updatedAt,
          }
        })
        rows.sort((a, b) => milliseconds(b.updatedAt) - milliseconds(a.updatedAt))
        setConversations(rows)
        setActiveId((id) => id && rows.some((row) => row.id === id) ? id : rows[0]?.id ?? null)
        setFromCache(snapshot.metadata.fromCache)
        setInboxError('')
        setInboxLoading(false)
      },
      (error) => {
        console.error('SAMEE3 admin inbox:', error)
        setInboxError(supportMessageError(error, true))
        setInboxLoading(false)
      },
    )
    return unsubscribe
  }, [isAdmin, user?.uid, revision])

  useEffect(() => {
    setMessages([])
    setMessageError('')
    if (!isAdmin || !activeId) {
      setMessagesLoading(false)
      return
    }
    setMessagesLoading(true)
    return subscribeSupportMessages(
      db,
      activeId,
      (rows) => { setMessages(rows); setMessagesLoading(false) },
      (error) => {
        console.error('SAMEE3 admin thread:', error)
        setMessageError(supportMessageError(error, true))
        setMessagesLoading(false)
      },
      'admin',
    )
  }, [isAdmin, activeId, revision])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [activeId, messages.length])

  useEffect(() => () => abortRef.current?.abort(), [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return conversations
    return conversations.filter((item) =>
      `${item.userName} ${item.userEmail} ${item.id} ${item.lastMessage}`
        .toLocaleLowerCase().includes(term),
    )
  }, [conversations, search])
  const active = conversations.find((item) => item.id === activeId) ?? null
  const unreadCount = conversations.filter((item) => item.unreadForAdmin).length

  function openConversation(id: string) {
    setActiveId(id)
    setDraft('')
    setMobileChat(true)
  }

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const body = draft.trim()
    if (!user || !isAdmin || !active || !body || sendingRef.current) return
    if (body.length > 5000) {
      setMessageError('لا يمكن أن تتجاوز الرسالة 5000 حرف.')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setMessageError('الجهاز غير متصل بالإنترنت؛ حاول الإرسال بعد عودة الاتصال.')
      return
    }
    sendingRef.current = true
    setSending(true)
    setMessageError('')
    const threadId = active.id
    try {
      await sendSupportMessage(db, {
        threadId,
        senderId: user.uid,
        senderName: 'إدارة مصحف سميع',
        side: 'admin',
        body,
        userName: active.userName,
        userEmail: active.userEmail,
      })
      if (activeIdRef.current === threadId) {
        setDraft((current) => current.trim() === body ? '' : current)
      }
    } catch (error) {
      console.error('SAMEE3 admin reply:', error)
      setMessageError(supportMessageError(error, true))
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  function enterToSend(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  async function recoverHistory() {
    if (!isAdmin || recovering) return
    const controller = new AbortController()
    abortRef.current = controller
    setRecovering(true)
    setInboxError('')
    setRecoveryMessage('جارٍ مراجعة المحادثات القديمة…')
    try {
      const result = await recoverSupportConversations(db, (scanned, restored) => {
        if (!controller.signal.aborted) {
          setRecoveryMessage(`تم فحص ${scanned} رسالة واستعادة ${restored} محادثة.`)
        }
      }, controller.signal)
      if (!controller.signal.aborted) {
        setRecoveryMessage(`انتهت المراجعة: تم استعادة ${result.recovered} محادثة من ${result.scanned} رسالة.`)
      }
    } catch (error) {
      if (!controller.signal.aborted) setInboxError(supportMessageError(error, true))
    } finally {
      if (!controller.signal.aborted) setRecovering(false)
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f9fe] px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-[#103d4c] p-3 text-[#e9d5aa]"><ShieldCheck size={25} /></span>
            <div>
              <p className="text-xs font-bold text-[#9a7b48]">مصحف سميع · لوحة الإدارة</p>
              <h1 className="text-xl font-extrabold sm:text-2xl">صندوق رسائل المستخدمين</h1>
              <p className="text-xs text-slate-500">{conversations.length} محادثة · {unreadCount} غير مقروءة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRevision((v) => v + 1)} className="rounded-xl border border-slate-200 bg-white p-3 text-[#14596e]" title="تحديث المحادثات" aria-label="تحديث المحادثات"><RefreshCw size={19} /></button>
            <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#14596e]">لوحة التحكم</Link>
          </div>
        </header>

        {fromCache && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><WifiOff className="ml-2 inline" size={16} /> البيانات المعروضة من الذاكرة المؤقتة؛ يُفضَّل الاتصال بالخادم.</p>
        )}
        {inboxError && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{inboxError}</p>}
        {recoveryMessage && <p className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{recoveryMessage}</p>}

        <section className="grid h-[min(780px,calc(100dvh-155px))] min-h-[540px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${mobileChat ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-l border-slate-100`}>
            <div className="border-b border-slate-100 p-4">
              <div className="relative">
                <Search size={18} className="absolute right-3 top-3 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن مستخدم أو رسالة…" aria-label="البحث في المحادثات" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-10 text-sm outline-none focus:border-[#14596e]" />
              </div>
              <button type="button" disabled={recovering} onClick={() => void recoverHistory()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d9c49d] bg-[#fbf7ee] px-3 py-2.5 text-xs font-bold text-[#745b30] disabled:opacity-60">
                {recovering ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                استعادة المحادثات القديمة غير الظاهرة
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {inboxLoading ? (
                <p className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> جارٍ تحميل الرسائل…</p>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500"><Inbox size={30} className="mx-auto mb-3 text-slate-300" />{search ? 'لا توجد محادثات مطابقة للبحث.' : 'لا توجد محادثات ظاهرة. يمكن تجربة استعادة المحادثات القديمة.'}</div>
              ) : filtered.map((item) => (
                <button key={item.id} type="button" onClick={() => openConversation(item.id)} className={`w-full border-b border-slate-100 px-4 py-4 text-right transition hover:bg-slate-50 ${activeId === item.id ? 'bg-[#edf6f8]' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm">{item.userName}</strong>
                    {item.unreadForAdmin && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#b78539]" aria-label="رسائل غير مقروءة" />}
                  </div>
                  <p dir="auto" className="mt-1 truncate text-xs text-slate-500">{item.userEmail || 'بدون بريد محفوظ'}</p>
                  <p dir="auto" className="mt-2 truncate text-sm text-slate-600">{item.lastMessage || 'افتح المحادثة لعرض الرسائل'}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{dateLabel(item.updatedAt)}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className={`${mobileChat ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`}>
            {active ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-extrabold">{active.userName}</h2>
                    <p dir="auto" className="truncate text-xs text-slate-500">{active.userEmail || active.id}</p>
                  </div>
                  <button type="button" onClick={() => setMobileChat(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold md:hidden"><ArrowRight size={17} className="inline" /> المحادثات</button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafb] p-4 sm:p-6">
                  {messagesLoading ? <p className="text-center text-sm text-slate-500">جارٍ تحميل المحادثة…</p> : messages.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">لا توجد رسائل داخل هذه المحادثة.</p> : messages.map((item) => {
                    const mine = item.senderId !== active.id
                    return (
                      <div key={item.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${mine ? 'bg-[#15566a] text-white' : 'border border-slate-100 bg-white text-slate-900'}`}>
                          <p className={`mb-1 text-[11px] font-bold ${mine ? 'text-[#e9d5aa]' : 'text-[#976c35]'}`}>{mine ? 'إدارة مصحف سميع' : item.senderName || active.userName}</p>
                          <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">{item.text}</p>
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-slate-200' : 'text-slate-400'}`}>
                            {dateLabel(item.createdAt)} {mine && (item.read ? <CheckCheck size={13} /> : <Check size={13} />)}
                            {item.pending && ' · جارٍ المزامنة'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
                <form onSubmit={(event) => void send(event)} className="border-t border-slate-100 bg-white p-4">
                  {messageError && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{messageError}</p>}
                  <div className="flex items-end gap-2">
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={enterToSend} maxLength={5000} rows={2} disabled={sending} placeholder="اكتب رد الإدارة…" aria-label="رد الإدارة" className="max-h-40 min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#14596e] disabled:opacity-60" />
                    <button type="submit" disabled={!draft.trim() || sending} aria-label="إرسال الرد" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14596e] text-white disabled:opacity-50">{sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={19} />}</button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">Enter للإرسال · Shift + Enter لسطر جديد · {draft.length}/5000</p>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-500"><MessageCircle size={38} className="mb-3 text-[#b89a62]" /><p className="font-bold">اختر محادثة للقراءة والرد</p><Link href="/admin" className="mt-4 text-sm font-bold text-[#14596e]">العودة إلى لوحة الإدارة</Link></div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function AdminMessagesPage() {
  return <AdminGate><AdministrationInbox /></AdminGate>
}