'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Book,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  Database,
  Eye,
  FileText,
  Headphones,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import AdminGate from '@/components/AdminGate'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'


type Tab =
  | 'dashboard'
  | 'users'
  | 'messages'
  | 'content'
  | 'notifications'
  | 'activity'
  | 'settings'

type FirestoreUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  progress: number
  khatmaDays?: number
  khatmaStartDate?: string
  createdAt?: unknown
  lastLoginAt?: unknown
  updatedAt?: unknown
  lastReadPage?: number
  lastReadSurahName?: string
  lastReadJuz?: number
  lastReadReciterName?: string
  extraFields?: Array<{ key: string; value: string }>
}

type Conversation = {
  id: string
  userId: string
  userName: string
  userEmail: string
  lastMessage: string
  updatedAt?: Timestamp | null
  lastSenderId?: string
  unreadForAdmin?: boolean
}

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt?: Timestamp | null
  read?: boolean
}

const demoRecentActivity = [
  { user: 'النظام', action: 'لوحة الإدارة متصلة بـ Firestore', time: 'مباشر' },
  { user: '—', action: 'سيظهر النشاط الفعلي مع إضافة سجلات النشاط', time: '—' },
]

function valueToMillis(value: unknown) {
  if (!value) return 0

  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function formatDate(value: unknown, withTime = true) {
  const millis = valueToMillis(value)
  if (!millis) return 'غير متوفر'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(millis))
}

function formatMessageTime(value: unknown) {
  const millis = valueToMillis(value)
  if (!millis) return 'الآن'

  return new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(millis))
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function AdminDashboard() {
  const { user: authUser, profile, loading: authLoading, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<FirestoreUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null)
  const [refreshingUsers, setRefreshingUsers] = useState(false)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationError, setConversationError] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')

  const adminName = profile?.name?.trim() || authUser?.displayName?.trim() || 'إدارة مصحف سميع'

  const loadUsers = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setRefreshingUsers(true)
      } else {
        setLoadingUsers(true)
      }

      setUsersError('')
      const snapshot = await getDocs(collection(db, 'users'))

      const nextUsers: FirestoreUser[] = snapshot.docs
        .map((item) => {
          const data = item.data() as Record<string, unknown>
          const lastReadPage =
            typeof data.lastReadPage === 'number' ? data.lastReadPage : 0
          const progress = Math.max(
            0,
            Math.min(100, Math.round((lastReadPage / 604) * 100)),
          )

          const rawEmail = normalizeText(data.email)
          const rawName =
            normalizeText(data.name) ||
            normalizeText(data.displayName) ||
            rawEmail ||
            `مستخدم ${item.id.slice(0, 6)}`

          return {
            id: item.id,
            name: rawName,
            email: rawEmail || 'البريد غير محفوظ',
            role: normalizeText(data.role, 'user'),
            status:
              normalizeText(data.status).toLowerCase() === 'inactive' ||
              data.disabled === true
                ? 'غير نشط'
                : 'نشط',
            progress,
            khatmaDays:
              typeof data.khatmaDays === 'number'
                ? data.khatmaDays
                : undefined,
            khatmaStartDate:
              typeof data.khatmaStartDate === 'string'
                ? data.khatmaStartDate
                : undefined,
            createdAt: data.createdAt,
            lastLoginAt: data.lastLoginAt,
            updatedAt: data.updatedAt ?? data.createdAt,
            lastReadPage:
              typeof data.lastReadPage === 'number' ? data.lastReadPage : undefined,
            lastReadSurahName: normalizeText(data.lastReadSurahName),
            lastReadJuz:
              typeof data.lastReadJuz === 'number' ? data.lastReadJuz : undefined,
            lastReadReciterName: normalizeText(data.lastReadReciterName),
            extraFields: Object.entries(data)
              .filter(([key]) =>
                ![
                  'name',
                  'displayName',
                  'email',
                  'role',
                  'status',
                  'disabled',
                  'khatmaDays',
                  'khatmaStartDate',
                  'createdAt',
                  'lastLoginAt',
                  'updatedAt',
                  'lastReadPage',
                  'lastReadSurahName',
                  'lastReadJuz',
                  'lastReadReciterName',
                  'lastReadRiwayaId',
                  'lastReadSurahNumber',
                  'lastReadAyahKey',
                  'lastReadAyahNumber',
                  'lastReadReciterId',
                ].includes(key) &&
                !/(password|token|secret|apikey)/i.test(key),
              )
              .map(([key, value]) => ({
                key,
                value:
                  typeof value === 'string'
                    ? value
                    : typeof value === 'number' || typeof value === 'boolean'
                      ? String(value)
                      : value && typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value ?? ''),
              }))
              .filter((item) => item.value.length > 0)
              .map((item) => ({
                ...item,
                value: item.value.length > 500 ? `${item.value.slice(0, 500)}…` : item.value,
              })),
          }
        })
        .sort((a, b) => valueToMillis(b.createdAt) - valueToMillis(a.createdAt))

      setUsers(nextUsers)
    } catch (error) {
      console.error('Load users error:', error)
      setUsersError(
        'تعذر تحميل المستخدمين من Firestore. تأكد من نشر قواعد Firestore الجديدة.',
      )
    } finally {
      setLoadingUsers(false)
      setRefreshingUsers(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !authUser || !isAdmin) return
    void loadUsers()
  }, [authLoading, authUser, isAdmin, loadUsers])

  useEffect(() => {
    if (authLoading || !authUser || !isAdmin) return

    setConversationsLoading(true)
    setConversationError('')

    const unsubscribe = onSnapshot(
      collection(db, 'conversations'),
      (snapshot) => {
        const nextConversations: Conversation[] = snapshot.docs
          .map((item) => {
            const data = item.data() as Record<string, unknown>

            return {
              id: item.id,
              userId:
                typeof data.userId === 'string' ? data.userId : item.id,
              userName:
                normalizeText(data.userName) || 'مستخدم مصحف سميع',
              userEmail: normalizeText(data.userEmail),
              lastMessage: normalizeText(data.lastMessage),
              updatedAt: (data.updatedAt as Timestamp | null | undefined) ?? null,
              lastSenderId: normalizeText(data.lastSenderId),
              unreadForAdmin: data.unreadForAdmin === true,
            }
          })
          .sort(
            (a, b) => valueToMillis(b.updatedAt) - valueToMillis(a.updatedAt),
          )

        setConversations(nextConversations)
        setConversationsLoading(false)
      },
      (error) => {
        console.error('Conversations listener error:', error)
        setConversationError(
          'تعذر تحميل المحادثات. تأكد من نشر قواعد Firestore الخاصة بالمراسلة.',
        )
        setConversationsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [authLoading, authUser, isAdmin])

  useEffect(() => {
    if (!selectedConversationId || !authUser || !isAdmin) {
      setMessages([])
      setMessagesLoading(false)
      return
    }

    setMessagesLoading(true)
    setConversationError('')

    const messagesRef = collection(
      db,
      'conversations',
      selectedConversationId,
      'messages',
    )
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'))

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages: ChatMessage[] = snapshot.docs.map((item) => {
          const data = item.data() as Record<string, unknown>

          return {
            id: item.id,
            senderId: normalizeText(data.senderId),
            senderName: normalizeText(data.senderName) || 'مستخدم مصحف سميع',
            text: normalizeText(data.text),
            createdAt:
              (data.createdAt as Timestamp | null | undefined) ?? null,
            read: data.read === true,
          }
        })

        nextMessages.sort(
          (a, b) => valueToMillis(a.createdAt) - valueToMillis(b.createdAt),
        )

        setMessages(nextMessages)
        setMessagesLoading(false)

        const unread = nextMessages.filter(
          (message) => message.senderId !== authUser.uid && message.read !== true,
        )

        if (unread.length > 0) {
          const batch = writeBatch(db)
          unread.forEach((message) => {
            batch.update(doc(messagesRef, message.id), { read: true })
          })

          void batch.commit().catch((error) => {
            console.error('Mark admin messages read error:', error)
          })
        }

        void updateDoc(doc(db, 'conversations', selectedConversationId), {
          unreadForAdmin: false,
        }).catch((error) => {
          console.warn('Conversation read state update failed:', error)
        })
      },
      (error) => {
        console.error('Chat listener error:', error)
        setMessages([])
        setMessagesLoading(false)
        setConversationError(
          'تعذر تحميل رسائل هذه المحادثة. تحقق من قواعد Firestore.',
        )
      },
    )

    return () => unsubscribe()
  }, [authUser, isAdmin, selectedConversationId])

  const filteredUsers = useMemo(() => {
    const queryText = search.trim().toLowerCase()

    if (!queryText) return users

    return users.filter(
      (item) =>
        item.name.toLowerCase().includes(queryText) ||
        item.email.toLowerCase().includes(queryText) ||
        item.id.toLowerCase().includes(queryText),
    )
  }, [search, users])

  const filteredConversations = useMemo(() => {
    const queryText = messageSearch.trim().toLowerCase()

    if (!queryText) return conversations

    return conversations.filter(
      (item) =>
        item.userName.toLowerCase().includes(queryText) ||
        item.userEmail.toLowerCase().includes(queryText) ||
        item.lastMessage.toLowerCase().includes(queryText),
    )
  }, [conversations, messageSearch])

  const selectedConversation = useMemo(
    () =>
      conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  const selectedConversationUser = useMemo(() => {
    if (!selectedConversation) return null

    return (
      users.find((item) => item.id === selectedConversation.userId) ?? {
        id: selectedConversation.userId,
        name: selectedConversation.userName,
        email: selectedConversation.userEmail || 'البريد غير محفوظ',
        role: 'user',
        status: 'نشط',
        progress: 0,
      }
    )
  }, [selectedConversation, users])

  const openConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    setActiveTab('messages')
    setMessageDraft('')
    setSidebarOpen(false)
  }

  const openUserConversation = (userItem: FirestoreUser) => {
    setSelectedUser(null)
    setSelectedConversationId(userItem.id)
    setActiveTab('messages')
    setMessageDraft('')
    setSidebarOpen(false)
  }

  const sendAdminMessage = async () => {
    const text = messageDraft.trim()

    if (!authUser || !selectedConversationId || !text || sendingMessage) return

    if (text.length > 5000) {
      setConversationError('الرسالة طويلة جدًا. الحد الأقصى 5000 حرف.')
      return
    }

    setSendingMessage(true)
    setConversationError('')

    try {
      const conversationRef = doc(db, 'conversations', selectedConversationId)
      const messagesRef = collection(conversationRef, 'messages')

      const targetUser = selectedConversationUser

      await setDoc(
        conversationRef,
        {
          userId: selectedConversationId,
          userName: targetUser?.name || selectedConversation?.userName || 'مستخدم مصحف سميع',
          userEmail: targetUser?.email || selectedConversation?.userEmail || '',
          lastMessage: text,
          lastSenderId: authUser.uid,
          updatedAt: serverTimestamp(),
          unreadForAdmin: false,
          unreadForUser: true,
        },
        { merge: true },
      )

      await addDoc(messagesRef, {
        senderId: authUser.uid,
        senderName: adminName,
        text,
        createdAt: serverTimestamp(),
        read: false,
      })

      setMessageDraft('')
    } catch (error) {
      console.error('Send admin message error:', error)
      setConversationError(
        'تعذر إرسال الرد. تحقق من الاتصال وصلاحيات Firestore.',
      )
    } finally {
      setSendingMessage(false)
    }
  }

  const handleAdminMessageSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    await sendAdminMessage()
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      window.location.href = '/auth'
    } catch (error) {
      console.error('Admin logout error:', error)
    }
  }

  const menuItems = [
    { id: 'dashboard' as const, label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'users' as const, label: 'المستخدمون', icon: Users },
    { id: 'messages' as const, label: 'الرسائل', icon: MessageSquare },
    { id: 'content' as const, label: 'محتوى التطبيق', icon: Database },
    { id: 'notifications' as const, label: 'الإشعارات', icon: Bell },
    { id: 'activity' as const, label: 'النشاطات', icon: Activity },
    { id: 'settings' as const, label: 'الإعدادات', icon: Settings },
  ]

  const unreadConversationsCount = conversations.filter(
    (item) => item.unreadForAdmin,
  ).length

  const khatmaUsersCount = users.filter(
    (item) => item.khatmaDays && item.khatmaDays > 0,
  ).length

  const stats = [
    {
      label: 'إجمالي المستخدمين',
      value: loadingUsers ? '…' : users.length.toLocaleString('ar-EG'),
      icon: Users,
      note: 'من Firestore',
    },
    {
      label: 'خطط الختمة',
      value: loadingUsers ? '…' : khatmaUsersCount.toLocaleString('ar-EG'),
      icon: BookOpen,
      note: 'مستخدم لديه خطة',
    },
    {
      label: 'المحادثات',
      value: conversationsLoading
        ? '…'
        : conversations.length.toLocaleString('ar-EG'),
      icon: MessageSquare,
      note: `${unreadConversationsCount.toLocaleString('ar-EG')} غير مقروءة`,
    },
    {
      label: 'الرسائل الواردة',
      value: conversationsLoading ? '…' : 'مباشر',
      icon: MessageCircle,
      note: 'مزامنة لحظية',
    },
  ]

  const renderDashboard = () => (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#075640]/10">
                  <Icon size={22} className="text-[#075640]" />
                </div>
                <span className="text-[11px] font-bold text-gray-400">
                  {item.note}
                </span>
              </div>

              <p className="text-2xl font-black text-gray-900">{item.value}</p>
              <p className="mt-1 text-xs text-gray-500">{item.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">آخر المحادثات</h2>
              <p className="mt-1 text-xs text-gray-400">
                افتح أي محادثة للقراءة والرد مباشرة.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className="text-xs font-bold text-[#075640] hover:underline"
            >
              عرض الرسائل
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm font-bold text-gray-400">
              لا توجد محادثات حتى الآن.
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.slice(0, 5).map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 text-right transition hover:bg-gray-100"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-100">
                      <MessageCircle size={18} className="text-[#075640]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {conversation.userName}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {conversation.lastMessage || 'محادثة جديدة'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-left">
                    <span className="text-[10px] text-gray-400">
                      {formatMessageTime(conversation.updatedAt)}
                    </span>
                    {conversation.unreadForAdmin && (
                      <span className="mx-auto mt-1 block h-2.5 w-2.5 rounded-full bg-[#075640]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-[#075640] p-6 text-white shadow-sm">
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -right-14 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative z-10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck size={24} />
            </div>

            <h2 className="text-xl font-black">مساحة الإدارة</h2>
            <p className="mt-2 text-sm leading-7 text-white/75">
              تابع الحسابات والمحادثات والمحتوى من مكان واحد، مع حماية صلاحيات Firestore.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="w-full rounded-2xl bg-white py-3 font-black text-sm text-[#075640]"
              >
                إدارة المستخدمين
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 font-black text-sm"
              >
                فتح صندوق الرسائل
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  )

  const renderUsers = () => (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-gray-900">المستخدمون</h2>
          <p className="mt-1 text-xs text-gray-400">
            الاسم والبريد والرتبة والحالة وتاريخ التسجيل وآخر دخول والتقدم المحفوظ.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => void loadUsers(true)}
            disabled={refreshingUsers}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#075640] px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshingUsers ? 'animate-spin' : ''} />
            {refreshingUsers ? 'جاري التحديث...' : 'تحديث'}
          </button>

          <div className="relative w-full sm:w-80">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو البريد أو UID..."
              className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-4 pr-10 text-sm outline-none focus:border-[#075640]"
            />
          </div>
        </div>
      </div>

      {usersError && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {usersError}
        </div>
      )}

      {loadingUsers && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          جارٍ تحميل المستخدمين...
        </div>
      )}

      {!loadingUsers && !usersError && users.length === 0 && (
        <div className="mb-4 rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm font-bold text-gray-500">
          لا توجد مستندات مستخدمين في مجموعة users حتى الآن.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px]">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="pb-3 font-bold">المستخدم</th>
              <th className="pb-3 font-bold">الدور</th>
              <th className="pb-3 font-bold">التسجيل</th>
              <th className="pb-3 font-bold">آخر دخول</th>
              <th className="pb-3 font-bold">التقدم</th>
              <th className="pb-3 font-bold">الإجراء</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((userItem) => (
              <tr key={userItem.id} className="border-b border-gray-50 last:border-0">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#075640]/10">
                      <UserRound size={18} className="text-[#075640]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {userItem.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-400" dir="ltr">
                        {userItem.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                      userItem.role === 'admin'
                        ? 'bg-[#c6a15a]/15 text-[#9d7d41]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {userItem.role === 'admin' ? 'أدمن' : 'مستخدم'}
                  </span>
                </td>

                <td className="py-4 text-xs font-bold text-gray-500">
                  {formatDate(userItem.createdAt, false)}
                </td>

                <td className="py-4 text-xs font-bold text-gray-500">
                  {formatDate(userItem.lastLoginAt, true)}
                </td>

                <td className="py-4">
                  <div className="w-36">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">المصحف</span>
                      <span className="font-bold text-[#075640]">
                        {userItem.progress}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#075640]"
                        style={{ width: `${userItem.progress}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(userItem)}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-[#075640] hover:text-[#075640]"
                    >
                      <Eye size={14} />
                      البيانات
                    </button>

                    {userItem.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => openUserConversation(userItem)}
                        className="flex items-center gap-2 rounded-xl bg-[#075640] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#064b39]"
                      >
                        <MessageCircle size={14} />
                        رسالة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && !loadingUsers && (
          <div className="py-12 text-center text-sm text-gray-400">
            لا توجد نتائج مطابقة للبحث.
          </div>
        )}
      </div>
    </section>
  )

  const renderMessages = () => (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-gray-100 bg-slate-50 lg:border-b-0 lg:border-l">
          <div className="border-b border-gray-100 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-gray-900">المحادثات</h2>
                <p className="mt-1 text-[11px] text-gray-400">
                  {conversations.length.toLocaleString('ar-EG')} محادثة
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#075640]/10">
                <MessageSquare size={18} className="text-[#075640]" />
              </div>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="ابحث في المحادثات..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-9 text-xs outline-none focus:border-[#075640]"
              />
            </div>
          </div>

          <div className="max-h-[540px] overflow-y-auto p-2 lg:max-h-[570px]">
            {conversationsLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                جاري تحميل المحادثات...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold leading-6 text-gray-400">
                لا توجد محادثات مطابقة.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = selectedConversationId === conversation.id

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className={`mb-1 w-full rounded-2xl p-3 text-right transition ${
                      active ? 'bg-[#075640] text-white' : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          active ? 'bg-white/10' : 'bg-white border border-gray-100'
                        }`}
                      >
                        <UserRound
                          size={18}
                          className={active ? 'text-white' : 'text-[#075640]'}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-black">
                            {conversation.userName}
                          </p>
                          <span
                            className={`shrink-0 text-[9px] ${
                              active ? 'text-white/60' : 'text-gray-400'
                            }`}
                          >
                            {formatMessageTime(conversation.updatedAt)}
                          </span>
                        </div>
                        <p
                          className={`mt-1 truncate text-[10px] ${
                            active ? 'text-white/70' : 'text-gray-400'
                          }`}
                        >
                          {conversation.lastMessage || 'محادثة جديدة'}
                        </p>
                      </div>

                      {conversation.unreadForAdmin && !active && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#075640]" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="flex min-h-[620px] min-w-0 flex-col bg-[#f7fafc]">
          {selectedConversationId ? (
            <>
              <header className="flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#075640] text-white">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-gray-900 sm:text-base">
                      {selectedConversationUser?.name || 'مستخدم مصحف سميع'}
                    </h3>
                    <p className="mt-1 truncate text-[10px] text-gray-400" dir="ltr">
                      {selectedConversationUser?.email || selectedConversation?.userEmail || 'البريد غير محفوظ'}
                    </p>
                  </div>
                </div>

                <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-600 sm:inline-flex">
                  محادثة نصية
                </span>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {messagesLoading ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 text-xs font-bold text-gray-500 shadow-sm">
                      <Loader2 size={17} className="animate-spin text-[#075640]" />
                      جاري تحميل الرسائل...
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="max-w-sm rounded-3xl bg-white p-7 text-center shadow-sm border border-gray-100">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#075640]/10">
                        <MessageCircle size={25} className="text-[#075640]" />
                      </div>
                      <h4 className="text-lg font-black text-gray-900">لا توجد رسائل بعد</h4>
                      <p className="mt-2 text-xs leading-6 text-gray-400">
                        اكتب أول رد من أسفل الشاشة ليبدأ المستخدم المحادثة مع الإدارة.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-3">
                    {messages.map((message) => {
                      const mine = message.senderId === authUser?.uid

                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-[22px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                              mine
                                ? 'rounded-tl-md bg-[#075640] text-white'
                                : 'rounded-tr-md border border-gray-100 bg-white text-gray-800'
                            }`}
                          >
                            {!mine && (
                              <p className="mb-1.5 text-[10px] font-black text-[#075640]">
                                {message.senderName || selectedConversationUser?.name}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words text-sm leading-7">
                              {message.text}
                            </p>

                            <div
                              className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                                mine ? 'text-white/60' : 'text-gray-400'
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
                  </div>
                )}
              </div>

              {conversationError && (
                <div className="px-4 pb-2 sm:px-5">
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2.5 text-center text-xs font-bold text-red-600">
                    {conversationError}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleAdminMessageSubmit}
                className="border-t border-gray-200 bg-white p-3 sm:p-4"
              >
                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-gray-200 bg-gray-50 p-2 focus-within:border-[#075640] focus-within:bg-white transition">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendAdminMessage()
                      }
                    }}
                    rows={1}
                    maxLength={5000}
                    placeholder="اكتب رد الإدارة..."
                    className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400"
                  />

                  <button
                    type="submit"
                    disabled={!messageDraft.trim() || sendingMessage}
                    aria-label="إرسال الرد"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#075640] text-white shadow-sm transition hover:bg-[#064b39] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {sendingMessage ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} className="-rotate-180" />
                    )}
                  </button>
                </div>
                <p className="mx-auto mt-2 max-w-3xl px-2 text-[10px] text-gray-400">
                  Enter للإرسال · Shift + Enter لسطر جديد · 5000 حرف كحد أقصى
                </p>
              </form>
            </>
          ) : (
            <div className="flex min-h-full flex-1 items-center justify-center p-6">
              <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm border border-gray-100">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#075640]/10">
                  <MessageSquare size={28} className="text-[#075640]" />
                </div>
                <h3 className="text-xl font-black text-gray-900">صندوق رسائل الإدارة</h3>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  اختر محادثة من القائمة لمشاهدة الرسائل والرد على المستخدم مباشرة.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const renderContent = () => (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[
        { title: 'المصحف', text: 'إدارة الأقسام المرتبطة بالقراءة والفهرس.', icon: BookOpen },
        { title: 'التلاوات', text: 'متابعة قسم الصوتيات والقراء.', icon: Headphones },
        { title: 'الأحاديث', text: 'إدارة واجهة مكتبة الأحاديث.', icon: FileText },
        { title: 'الأذكار', text: 'إدارة واجهات الأذكار والعدادات.', icon: Moon },
      ].map((item) => {
        const Icon = item.icon

        return (
          <div key={item.title} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#075640]/10">
              <Icon size={23} className="text-[#075640]" />
            </div>
            <h3 className="font-black text-gray-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-gray-500">{item.text}</p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500"
            >
              إدارة القسم
            </button>
          </div>
        )
      })}
    </section>
  )

  const renderNotifications = () => (
    <section className="max-w-3xl rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c6a15a]/15">
          <Bell size={21} className="text-[#c6a15a]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">الإشعارات</h2>
          <p className="mt-1 text-xs text-gray-400">واجهة تجهيز إشعار جديد</p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          placeholder="عنوان الإشعار"
          className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-[#075640]"
        />
        <textarea
          rows={5}
          placeholder="اكتب نص الإشعار هنا..."
          className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none focus:border-[#075640]"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-2xl bg-[#075640] py-3.5 text-sm font-black text-white"
          >
            تجهيز الإشعار
          </button>
          <button
            type="button"
            className="rounded-2xl border border-gray-200 px-5 py-3.5 text-sm font-black text-gray-500"
          >
            حفظ كمسودة
          </button>
        </div>
        <p className="rounded-2xl bg-gray-50 p-4 text-xs leading-6 text-gray-400">
          هذه الواجهة إدارية فقط؛ الإرسال الفعلي لـ Push Notifications يحتاج ربط خدمة الإشعارات المناسبة.
        </p>
      </div>
    </section>
  )

  const renderActivity = () => (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#075640]/10">
          <Activity size={21} className="text-[#075640]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">سجل النشاطات</h2>
          <p className="mt-1 text-xs text-gray-400">النشاطات الإدارية الحالية</p>
        </div>
      </div>

      <div className="space-y-2">
        {demoRecentActivity.map((item, index) => (
          <div
            key={`${item.user}-${index}`}
            className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white">
                <Activity size={17} className="text-[#c6a15a]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">{item.user}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{item.action}</p>
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-gray-400">{item.time}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const renderSettings = () => (
    <section className="max-w-3xl rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#075640]/10">
          <Settings size={21} className="text-[#075640]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">إعدادات المنصة</h2>
          <p className="mt-1 text-xs text-gray-400">إعدادات أساسية لواجهة الإدارة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">اسم المنصة</span>
          <input
            defaultValue="مصحف سَميع"
            className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold outline-none focus:border-[#075640]"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">الرسالة الترحيبية</span>
          <input
            defaultValue="السلام عليكم ورحمة الله"
            className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold outline-none focus:border-[#075640]"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-bold text-gray-500">وصف المنصة</span>
        <textarea
          rows={4}
          defaultValue="مساحة هادئة للقراءة والتدبر والاستماع."
          className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none focus:border-[#075640]"
        />
      </label>

      <button
        type="button"
        className="mt-5 rounded-2xl bg-[#075640] px-6 py-3.5 text-sm font-black text-white"
      >
        حفظ الإعدادات
      </button>
    </section>
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'users':
        return renderUsers()
      case 'messages':
        return renderMessages()
      case 'content':
        return renderContent()
      case 'notifications':
        return renderNotifications()
      case 'activity':
        return renderActivity()
      case 'settings':
        return renderSettings()
      case 'dashboard':
      default:
        return renderDashboard()
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" dir="rtl">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm font-bold text-gray-500 shadow-sm">
          <Loader2 size={18} className="animate-spin text-[#075640]" />
          جاري التحقق من صلاحيات الإدارة...
        </div>
      </div>
    )
  }

  if (!authUser || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6" dir="rtl">
        <div className="w-full max-w-md rounded-[30px] border border-gray-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <ShieldCheck size={30} className="text-red-500" />
          </div>
          <h1 className="text-xl font-black text-gray-900">غير مصرح بالدخول</h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            هذه الصفحة مخصصة لحسابات الإدارة فقط.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#075640] px-6 py-3.5 text-sm font-black text-white"
          >
            العودة للموقع
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed bottom-0 right-0 top-0 z-50 w-[280px] bg-[#073f30] p-5 text-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white/50">لوحة الإدارة</p>
            <h1 className="mt-1 text-xl font-black">مصحف سَميع</h1>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = item.id === activeTab

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition ${
                  active
                    ? 'bg-white text-[#075640] shadow-sm'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={19} />
                <span className="flex-1 text-right">{item.label}</span>
                {item.id === 'messages' && unreadConversationsCount > 0 && (
                  <span
                    className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black ${
                      active ? 'bg-[#075640] text-white' : 'bg-white text-[#075640]'
                    }`}
                  >
                    {unreadConversationsCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 space-y-2">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            العودة للتطبيق
            <ChevronLeft size={15} />
          </Link>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:mr-[280px]">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-gray-50/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white text-[#075640] lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-400">الإدارة</p>
                <h2 className="truncate text-lg font-black text-gray-900">
                  {menuItems.find((item) => item.id === activeTab)?.label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 sm:flex">
                <ShieldCheck size={16} className="text-[#075640]" />
                <span className="text-xs font-bold text-gray-500">وضع الإدارة</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">{renderActiveTab()}</div>
      </main>

      {selectedUser && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-[#075640] p-6 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <UserRound size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white/60">بيانات المستخدم</p>
                    <h3 className="truncate text-xl font-black">{selectedUser.name}</h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">الاسم</p>
                  <p className="text-sm font-black text-gray-900">{selectedUser.name}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">البريد الإلكتروني</p>
                  <p className="break-all text-sm font-bold text-gray-900" dir="ltr">
                    {selectedUser.email}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">الدور</p>
                  <p className="text-sm font-black text-[#075640]">
                    {selectedUser.role === 'admin' ? 'أدمن' : 'مستخدم'}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">الحالة</p>
                  <p className="text-sm font-black text-[#075640]">{selectedUser.status}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">تاريخ التسجيل</p>
                  <p className="text-sm font-black text-gray-900">
                    {formatDate(selectedUser.createdAt, true)}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">آخر دخول</p>
                  <p className="text-sm font-black text-gray-900">
                    {formatDate(selectedUser.lastLoginAt, true)}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">تقدم المصحف</p>
                  <p className="text-sm font-black text-gray-900">{selectedUser.progress}%</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">خطة الختمة</p>
                  <p className="text-sm font-black text-gray-900">
                    {selectedUser.khatmaDays
                      ? `${selectedUser.khatmaDays} يوم`
                      : 'لا توجد خطة'}
                  </p>
                </div>
              </div>

              {selectedUser.khatmaStartDate && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="mb-1 text-xs font-bold text-gray-400">بداية الختمة</p>
                  <p className="text-sm font-black text-gray-900" dir="ltr">
                    {selectedUser.khatmaStartDate}
                  </p>
                </div>
              )}

              {(selectedUser.lastReadPage ||
                selectedUser.lastReadSurahName ||
                selectedUser.lastReadJuz ||
                selectedUser.lastReadReciterName) && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="mb-3 text-xs font-bold text-gray-400">آخر بيانات القراءة</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {typeof selectedUser.lastReadPage === 'number' && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر صفحة</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadPage}</p>
                      </div>
                    )}
                    {selectedUser.lastReadSurahName && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر سورة</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadSurahName}</p>
                      </div>
                    )}
                    {typeof selectedUser.lastReadJuz === 'number' && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر جزء</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadJuz}</p>
                      </div>
                    )}
                    {selectedUser.lastReadReciterName && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-gray-400">آخر قارئ</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{selectedUser.lastReadReciterName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedUser.extraFields && selectedUser.extraFields.length > 0 && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="mb-3 text-xs font-bold text-gray-400">بيانات أخرى محفوظة</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedUser.extraFields.map((field) => (
                      <div key={field.key} className="rounded-xl bg-gray-50 p-3">
                        <p className="break-all text-[10px] font-bold text-gray-400" dir="ltr">{field.key}</p>
                        <p className="mt-1 break-words text-xs font-bold text-gray-800">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                <p className="mb-1 text-xs font-bold text-gray-400">UID</p>
                <p className="break-all text-xs font-bold text-gray-600" dir="ltr">
                  {selectedUser.id}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                {selectedUser.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => openUserConversation(selectedUser)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#075640] px-5 py-3.5 text-sm font-black text-white"
                  >
                    <MessageCircle size={17} />
                    فتح المحادثة
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-2xl border border-gray-200 px-5 py-3.5 text-sm font-black text-gray-500"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  )
}
