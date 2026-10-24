
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCheck,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

/**
 * SAMEE3 — User and Administration Messaging
 * Path: app/messages/page.tsx
 *
 * Text-only private conversations.
 * Compatible with Next.js 14, React 18 and ES5 target.
 */

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  read: boolean
  createdAt: Timestamp | null
}

const MAX_MESSAGE_LENGTH = 5000
const READ_BATCH_SIZE = 350

function timeOf(value: unknown): number {
  if (
    value !== null &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as {
      toMillis?: unknown
    }).toMillis === 'function'
  ) {
    try {
      return (value as Timestamp).toMillis()
    } catch {
      return 0
    }
  }

  return 0
}

function timeLabel(value: unknown): string {
  const ms = timeOf(value)

  if (!ms) {
    return 'جارٍ الإرسال'
  }

  return new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

function safeString(
  value: unknown,
  fallback = '',
): string {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback
}

function sameTimestamp(
  a: unknown,
  b: unknown,
): boolean {
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  const left = a as {
    seconds?: unknown
    nanoseconds?: unknown
  }

  const right = b as {
    seconds?: unknown
    nanoseconds?: unknown
  }

  return (
    typeof left.seconds === 'number' &&
    typeof left.nanoseconds === 'number' &&
    left.seconds === right.seconds &&
    left.nanoseconds === right.nanoseconds
  )
}

export default function MessagesPage() {
  const {
    user,
    profile,
    loading,
  } = useAuth()

  const uid = user?.uid || null

  const [messages, setMessages] =
    useState<ChatMessage[]>([])

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messagesLoading, setMessagesLoading] =
    useState(true)

  const [error, setError] = useState('')
  const [online, setOnline] = useState(true)

  const bottomRef = useRef<HTMLDivElement | null>(
    null,
  )

  const markingRef = useRef<Set<string>>(
    new Set(),
  )

  const sendingRef = useRef(false)

  const userName = useMemo(() => {
    const candidate =
      safeString(profile?.name) ||
      safeString(user?.displayName) ||
      'مستخدم مصحف سميع'

    return candidate.slice(0, 100)
  }, [
    profile?.name,
    user?.displayName,
  ])

  // ==========================================
  // Connection
  // ==========================================

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine)
    }

    update()

    window.addEventListener(
      'online',
      update,
    )

    window.addEventListener(
      'offline',
      update,
    )

    return () => {
      window.removeEventListener(
        'online',
        update,
      )

      window.removeEventListener(
        'offline',
        update,
      )
    }
  }, [])

  // ==========================================
  // Realtime conversation
  // ==========================================

  useEffect(() => {
    markingRef.current.clear()
    setMessages([])
    setError('')

    if (!uid) {
      setMessagesLoading(false)
      return
    }

    setMessagesLoading(true)

    let active = true

    const conversationRef = doc(
      db,
      'conversations',
      uid,
    )

    const messagesRef = collection(
      conversationRef,
      'messages',
    )

    const feed = query(
      messagesRef,
      orderBy('createdAt', 'asc'),
    )

    const unsubscribe = onSnapshot(
      feed,

      (snapshot) => {
        if (!active) return

        const next: ChatMessage[] =
          snapshot.docs.map((item) => {
            const data =
              item.data() as Record<
                string,
                unknown
              >

            return {
              id: item.id,

              senderId: safeString(
                data.senderId,
              ),

              senderName: safeString(
                data.senderName,
                'مستخدم',
              ),

              text: safeString(data.text),

              read: data.read === true,

              createdAt:
                (data.createdAt as
                  | Timestamp
                  | null) || null,
            }
          })

        next.sort(
          (a, b) =>
            timeOf(a.createdAt) -
            timeOf(b.createdAt),
        )

        setMessages(next)
        setMessagesLoading(false)

        // Clear completed read markers.
        next
          .filter((item) => item.read)
          .forEach((item) => {
            markingRef.current.delete(
              item.id,
            )
          })

        // Only incoming administration messages.
        const unread = next.filter(
          (item) =>
            item.senderId.length > 0 &&
            item.senderId !== uid &&
            !item.read &&
            !markingRef.current.has(
              item.id,
            ),
        )

        if (unread.length === 0) {
          return
        }

        const subset = unread.slice(
          0,
          READ_BATCH_SIZE,
        )

        const batch = writeBatch(db)

        subset.forEach((item) => {
          markingRef.current.add(
            item.id,
          )

          batch.update(
            doc(messagesRef, item.id),
            { read: true },
          )
        })

        void batch
          .commit()
          .then(async () => {
            const lastVisible =
              next[next.length - 1]

            if (
              !lastVisible ||
              lastVisible.senderId === uid ||
              !lastVisible.createdAt
            ) {
              return
            }

            // Avoid clearing the conversation
            // badge if a newer reply arrived.
            try {
              await runTransaction(
                db,
                async (transaction) => {
                  const document =
                    await transaction.get(
                      conversationRef,
                    )

                  if (!document.exists()) {
                    return
                  }

                  const data =
                    document.data() as Record<
                      string,
                      unknown
                    >

                  if (
                    data.unreadForUser !==
                      true ||
                    data.lastSenderId !==
                      lastVisible.senderId ||
                    data.lastMessage !==
                      lastVisible.text ||
                    !sameTimestamp(
                      data.updatedAt,
                      lastVisible.createdAt,
                    )
                  ) {
                    return
                  }

                  transaction.update(
                    conversationRef,
                    {
                      unreadForUser: false,
                      updatedAt:
                        serverTimestamp(),
                    },
                  )
                },
              )
            } catch (receiptError) {
              console.warn(
                'SAMEE3 read summary:',
                receiptError,
              )
            }
          })
          .catch((receiptError) => {
            subset.forEach((item) => {
              markingRef.current.delete(
                item.id,
              )
            })

            console.error(
              'SAMEE3 mark read:',
              receiptError,
            )
          })
      },

      (listenerError) => {
        if (!active) return

        console.error(
          'SAMEE3 messages listener:',
          listenerError,
        )

        setMessagesLoading(false)

        setError(
          'تعذر قراءة المحادثة. تحقق من الاتصال وقواعد Firestore.',
        )
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [uid])

  // ==========================================
  // Scroll to newest message
  // ==========================================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    })
  }, [messages.length])

  // ==========================================
  // Send message
  // ==========================================

  const sendMessage = useCallback(
    async () => {
      const text = draft.trim()

      if (
        !uid ||
        !user ||
        !text ||
        sendingRef.current
      ) {
        return
      }

      if (!online) {
        setError(
          'الجهاز غير متصل بالشبكة. أعد المحاولة عند عودة الاتصال.',
        )
        return
      }

      if (
        text.length >
        MAX_MESSAGE_LENGTH
      ) {
        setError(
          'الحد الأقصى للرسالة 5000 حرف.',
        )
        return
      }

      sendingRef.current = true
      setSending(true)
      setError('')

      try {
        const conversationRef = doc(
          db,
          'conversations',
          uid,
        )

        const messageRef = doc(
          collection(
            conversationRef,
            'messages',
          ),
        )

        const batch = writeBatch(db)

        // Atomic update:
        // message + conversation summary.
        batch.set(
          conversationRef,
          {
            userId: uid,
            userName,

            userEmail:
              user.email || '',

            lastMessage: text,
            lastSenderId: uid,

            unreadForAdmin: true,
            unreadForUser: false,

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          },
        )

        batch.set(messageRef, {
          senderId: uid,
          senderName: userName,
          text,

          createdAt:
            serverTimestamp(),

          read: false,
        })

        await batch.commit()

        setDraft((current) =>
          current.trim() === text
            ? ''
            : current,
        )
      } catch (sendError) {
        console.error(
          'SAMEE3 send message:',
          sendError,
        )

        setError(
          'تعذر إرسال الرسالة. النص ما زال موجودًا؛ حاول مرة أخرى.',
        )
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [
      draft,
      uid,
      user,
      userName,
      online,
    ],
  )

  const submit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    void sendMessage()
  }

  const sendOnEnter = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      void sendMessage()
    }
  }

  // ==========================================
  // Loading
  // ==========================================

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f9fe] p-6"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-6 py-5 text-sm font-bold text-slate-600 shadow-sm">
          <Loader2
            size={19}
            className="animate-spin text-[#0284c7]"
          />

          جارٍ تجهيز حسابك…
        </div>
      </main>
    )
  }

  // ==========================================
  // Authentication required
  // ==========================================

  if (!user) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f9fe] p-5"
      >
        <section className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-7 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-[#0284c7]">
            <MessageCircle size={30} />
          </div>

          <h1 className="text-xl font-extrabold">
            تواصل مع إدارة مصحف سميع
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            سجّل الدخول لعرض رسائلك وإرسال
            استفساراتك إلى الإدارة بشكل خاص.
          </p>

          <Link
            href="/auth"
            className="mt-6 inline-flex rounded-2xl bg-[#0284c7] px-6 py-3 text-sm font-bold text-white"
          >
            تسجيل الدخول
          </Link>
        </section>
      </main>
    )
  }

  // ==========================================
  // Chat interface
  // ==========================================

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f9fe] px-3 pb-28 pt-4 sm:px-6 sm:pt-7"
    >
      <section className="mx-auto flex h-[min(780px,calc(100dvh-125px))] min-h-[480px] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_16px_60px_rgba(15,23,42,.09)]">

        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="العودة للرئيسية"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100"
            >
              <ArrowRight size={19} />
            </Link>

            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#145b73] text-[#f1d7a2]">
              <ShieldCheck size={23} />
            </span>

            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
                إدارة مصحف سميع
              </h1>

              <p className="truncate text-xs text-slate-500">
                محادثة نصية خاصة بينك وبين الإدارة
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold ${
              online
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {online
              ? 'متصل'
              : 'دون اتصال'}
          </span>
        </header>

        {/* Messages */}
        <div className="flex min-h-0 flex-1 flex-col bg-[#f8fafb]">
          <div
            className="flex-1 space-y-3 overflow-y-auto px-3 py-5 sm:px-6"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messagesLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2
                  size={18}
                  className="animate-spin"
                />

                جارٍ تحميل الرسائل…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                <div className="mb-4 rounded-2xl bg-sky-50 p-4 text-[#0284c7]">
                  <MessageCircle size={30} />
                </div>

                <h2 className="text-lg font-extrabold">
                  ابدأ محادثتك
                </h2>

                <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">
                  اكتب استفسارك في الأسفل.
                  ستظهر رسالتك للإدارة بمجرد
                  حفظها في Firestore.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const mine =
                  message.senderId === uid

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      mine
                        ? 'justify-start'
                        : 'justify-end'
                    }`}
                  >
                    <article
                      className={`max-w-[90%] rounded-[20px] px-4 py-3 shadow-sm sm:max-w-[75%] ${
                        mine
                          ? 'rounded-tr-sm bg-[#14617d] text-white'
                          : 'rounded-tl-sm border border-slate-100 bg-white text-slate-800'
                      }`}
                    >
                      {!mine && (
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[#b4884a]">
                          <ShieldCheck size={13} />
                          إدارة مصحف سميع
                        </p>
                      )}

                      <p className="whitespace-pre-wrap break-words text-sm leading-7">
                        {message.text}
                      </p>

                      <div
                        className={`mt-2 flex items-center justify-end gap-1 text-[10px] ${
                          mine
                            ? 'text-white/75'
                            : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {timeLabel(
                            message.createdAt,
                          )}
                        </span>

                        {mine &&
                          (
                            message.read ? (
                              <CheckCheck
                                size={14}
                                aria-label="مقروءة"
                              />
                            ) : (
                              <Check
                                size={14}
                                aria-label="أُرسلت"
                              />
                            )
                          )}
                      </div>
                    </article>
                  </div>
                )
              })
            )}

            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 pb-2 sm:px-6">
              <p
                role="alert"
                className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold leading-6 text-rose-700"
              >
                {error}
              </p>
            </div>
          )}

          {/* Offline indicator */}
          {!online && (
            <p className="flex items-center gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              <WifiOff size={15} />

              يمكنك قراءة الرسائل المحفوظة،
              لكن الإرسال يحتاج اتصالًا بالشبكة.
            </p>
          )}

          {/* Composer */}
          <form
            onSubmit={submit}
            className="border-t border-slate-100 bg-white p-3 sm:p-4"
          >
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-[#f7f9fb] p-2 focus-within:border-[#b58b4b]">
              <textarea
                value={draft}
                onChange={(
                  event: ChangeEvent<
                    HTMLTextAreaElement
                  >,
                ) =>
                  setDraft(
                    event.target.value,
                  )
                }
                onKeyDown={sendOnEnter}
                rows={2}
                maxLength={
                  MAX_MESSAGE_LENGTH
                }
                disabled={sending}
                placeholder="اكتب رسالتك للإدارة…"
                className="max-h-32 min-h-[46px] flex-1 resize-y bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-70"
              />

              <button
                type="submit"
                disabled={
                  sending ||
                  !online ||
                  !draft.trim()
                }
                aria-label="إرسال الرسالة"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#145b73] text-white transition hover:bg-[#0d465b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={19} />
                )}
              </button>
            </div>

            <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
              <span>
                Enter للإرسال · Shift + Enter لسطر جديد
              </span>

              <span>
                {draft.length.toLocaleString(
                  'ar-EG',
                )} / ٥٠٠٠
              </span>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
