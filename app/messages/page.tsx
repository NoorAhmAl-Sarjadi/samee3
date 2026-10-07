'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCheck,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt?: Timestamp | null
  read?: boolean
}

function timestampToMillis(value: unknown) {
  if (!value) return 0

  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis()
  }

  return 0
}

function formatMessageTime(value: unknown) {
  const millis = timestampToMillis(value)
  if (!millis) return 'الآن'

  return new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(millis))
}

export default function MessagesPage() {
  const { user, profile, loading } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const userName = useMemo(
    () => profile?.name?.trim() || user?.displayName?.trim() || 'مستخدم مصحف سميع',
    [profile?.name, user?.displayName],
  )

  useEffect(() => {
    if (!user) {
      setMessages([])
      setMessagesLoading(false)
      return
    }

    setMessagesLoading(true)

    const messagesRef = collection(db, 'conversations', user.uid, 'messages')
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'))

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages: ChatMessage[] = snapshot.docs.map((item) => {
          const data = item.data() as Record<string, unknown>

          return {
            id: item.id,
            senderId:
              typeof data.senderId === 'string' ? data.senderId : '',
            senderName:
              typeof data.senderName === 'string'
                ? data.senderName
                : 'إدارة مصحف سميع',
            text: typeof data.text === 'string' ? data.text : '',
            createdAt: (data.createdAt as Timestamp | null | undefined) ?? null,
            read: data.read === true,
          }
        })

        nextMessages.sort(
          (a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt),
        )

        setMessages(nextMessages)
        setMessagesLoading(false)
        setError('')

        const unreadAdminMessages = nextMessages.filter(
          (message) => message.senderId !== user.uid && message.read !== true,
        )

        if (unreadAdminMessages.length > 0) {
          const batch = writeBatch(db)

          unreadAdminMessages.forEach((message) => {
            batch.update(doc(messagesRef, message.id), { read: true })
          })

          void batch.commit().catch((markReadError) => {
            console.error('Mark messages as read error:', markReadError)
          })
        }

        window.setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }, 50)
      },
      (listenerError) => {
        console.error('Messages listener error:', listenerError)
        setMessagesLoading(false)
        setError('تعذر تحميل الرسائل. تأكد من نشر قواعد Firestore الجديدة.')
      },
    )

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    if (!user) return

    const conversationRef = doc(db, 'conversations', user.uid)

    void setDoc(
      conversationRef,
      {
        userId: user.uid,
        userName,
        userEmail: user.email || '',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch((conversationError) => {
      console.error('Conversation profile sync error:', conversationError)
    })
  }, [user, userName])

  const sendMessage = async () => {
    const text = draft.trim()

    if (!user || !text || sending) return

    if (text.length > 5000) {
      setError('الرسالة طويلة جدًا. الحد الأقصى 5000 حرف.')
      return
    }

    setSending(true)
    setError('')

    try {
      const conversationRef = doc(db, 'conversations', user.uid)
      const messagesRef = collection(conversationRef, 'messages')

      await setDoc(
        conversationRef,
        {
          userId: user.uid,
          userName,
          userEmail: user.email || '',
          lastMessage: text,
          lastSenderId: user.uid,
          updatedAt: serverTimestamp(),
          unreadForAdmin: true,
          unreadForUser: false,
        },
        { merge: true },
      )

      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: userName,
        text,
        createdAt: serverTimestamp(),
        read: false,
      })

      setDraft('')

      window.setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 50)
    } catch (sendError) {
      console.error('Send message error:', sendError)
      setError('تعذر إرسال الرسالة. تحقق من الاتصال وصلاحيات Firestore.')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendMessage()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6" dir="rtl">
        <div className="rounded-3xl bg-white px-6 py-5 shadow-sm border border-slate-100 flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-[var(--royal-blue)]" />
          <span className="text-sm font-bold text-slate-600">جاري تجهيز المحادثة...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] border border-slate-100">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(2,132,199,0.08)]">
            <MessageCircle size={30} className="text-[var(--royal-blue)]" />
          </div>
          <h1 className="text-xl font-black text-slate-900">تواصل مع الإدارة</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            يجب تسجيل الدخول أولًا حتى تتمكن من إرسال الرسائل إلى إدارة مصحف سميع.
          </p>
          <Link
            href="/auth"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[var(--royal-blue)] px-6 py-3.5 text-sm font-black text-white"
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] p-3 sm:p-5 md:p-8" dir="rtl">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:min-h-[calc(100vh-40px)] md:min-h-[calc(100vh-64px)]">
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="العودة للرئيسية"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-slate-100"
            >
              <ArrowRight size={19} />
            </Link>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--royal-blue)] text-white shadow-sm">
              <ShieldCheck size={21} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-base font-black text-slate-900 sm:text-lg">
                إدارة مصحف سميع
              </h1>
              <p className="truncate text-[11px] font-medium text-slate-400 sm:text-xs">
                محادثة نصية مباشرة مع الإدارة
              </p>
            </div>
          </div>

          <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 sm:inline-flex">
            رسائل نصية فقط
          </span>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-[#f7fafc]">
          <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-6">
            {messagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100">
                  <Loader2 size={18} className="animate-spin text-[var(--royal-blue)]" />
                  <span className="text-sm font-bold text-slate-500">جاري تحميل المحادثة...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[55vh] items-center justify-center">
                <div className="max-w-md rounded-[28px] bg-white px-6 py-8 text-center shadow-sm border border-slate-100">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(2,132,199,0.08)]">
                    <MessageCircle size={25} className="text-[var(--royal-blue)]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">ابدأ محادثتك</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    اكتب رسالتك في الأسفل وسيراها فريق إدارة مصحف سميع داخل لوحة الإدارة.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-3">
                {messages.map((message) => {
                  const mine = message.senderId === user.uid

                  return (
                    <div
                      key={message.id}
                      className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-[22px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                          mine
                            ? 'rounded-tl-md bg-[var(--royal-blue)] text-white'
                            : 'rounded-tr-md border border-slate-100 bg-white text-slate-800'
                        }`}
                      >
                        {!mine && (
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black text-[var(--gold-premium)]">
                            <ShieldCheck size={12} />
                            إدارة مصحف سميع
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words text-sm leading-7">
                          {message.text}
                        </p>

                        <div
                          className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                            mine ? 'text-white/65' : 'text-slate-400'
                          }`}
                        >
                          <span>{formatMessageTime(message.createdAt)}</span>
                          {mine &&
                            (message.read ? (
                              <CheckCheck size={13} />
                            ) : (
                              <Check size={13} />
                            ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 pb-2 sm:px-6">
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2.5 text-center text-xs font-bold text-red-600">
                {error}
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-3 sm:p-4"
          >
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2 focus-within:border-[var(--royal-blue)] focus-within:bg-white transition">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                rows={1}
                maxLength={5000}
                placeholder="اكتب رسالتك للإدارة..."
                className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="إرسال الرسالة"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--royal-blue)] text-white shadow-sm transition hover:bg-[#036fa9] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} className="-rotate-180" />
                )}
              </button>
            </div>

            <p className="mx-auto mt-2 max-w-3xl px-2 text-[10px] font-medium text-slate-400">
              Enter للإرسال · Shift + Enter لسطر جديد · الحد الأقصى 5000 حرف
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
