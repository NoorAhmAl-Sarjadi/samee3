'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Database,
  Bell,
  Settings,
  LogOut,
  Activity,
  FileText,
  ShieldCheck,
  BookOpen,
  Headphones,
  Moon,
  ChevronLeft,
  Search,
  Menu,
  X,
  BarChart3,
  MessageSquare,
  Eye,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import AdminGate from '@/components/AdminGate'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

type Tab =
  | 'dashboard'
  | 'users'
  | 'content'
  | 'notifications'
  | 'activity'
  | 'settings'

type FirestoreUser = {
  id: string
  name: string
  email: string
  status: string
  progress: number
  khatmaDays?: number
  khatmaStartDate?: string
  updatedAt?: unknown
}


function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<FirestoreUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null)
  const [refreshingUsers, setRefreshingUsers] = useState(false)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationBody, setNotificationBody] = useState('')
  const [notificationDraftSaved, setNotificationDraftSaved] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const loadUsers = useCallback(async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshingUsers(true)
        } else {
          setLoadingUsers(true)
        }

        setUsersError('')
        const snapshot = await getDocs(collection(db, 'users'))

        const nextUsers: FirestoreUser[] = snapshot.docs.map((item) => {
          const data = item.data() as Record<string, unknown>
          const lastReadPage = typeof data.lastReadPage === 'number' ? data.lastReadPage : 0
          const progress = Math.max(0, Math.min(100, Math.round((lastReadPage / 604) * 100)))
          const rawName = typeof data.name === 'string' ? data.name : typeof data.displayName === 'string' ? data.displayName : ''
          const rawEmail = typeof data.email === 'string' ? data.email : ''
          return {
            id: item.id,
            name: rawName || rawEmail || `مستخدم ${item.id.slice(0, 6)}`,
            email: rawEmail || 'البريد غير محفوظ',
            status: data.disabled === true ? 'غير نشط' : 'نشط',
            progress,
            khatmaDays: typeof data.khatmaDays === 'number' ? data.khatmaDays : undefined,
            khatmaStartDate: typeof data.khatmaStartDate === 'string' ? data.khatmaStartDate : undefined,
            updatedAt: data.updatedAt ?? data.createdAt,
          }
        })
        setUsers(nextUsers)
      } catch (error) {
        console.error(error)
        setUsersError('تعذر تحميل المستخدمين من Firestore. تأكد من صلاحيات القراءة في مجموعة users.')
      } finally {
        setLoadingUsers(false)
        setRefreshingUsers(false)
      }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return users

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    )
  }, [search, users])

  const menuItems = [
    {
      id: 'dashboard' as const,
      label: 'لوحة التحكم',
      icon: LayoutDashboard,
    },
    {
      id: 'users' as const,
      label: 'المستخدمون',
      icon: Users,
    },
    {
      id: 'content' as const,
      label: 'محتوى التطبيق',
      icon: Database,
    },
    {
      id: 'notifications' as const,
      label: 'الإشعارات',
      icon: Bell,
    },
    {
      id: 'activity' as const,
      label: 'النشاطات',
      icon: Activity,
    },
    {
      id: 'settings' as const,
      label: 'الإعدادات',
      icon: Settings,
    },
  ]

  const khatmaUsersCount = users.filter((user) => user.khatmaDays && user.khatmaDays > 0).length

  const stats = [
    { label: 'إجمالي المستخدمين', value: loadingUsers ? '…' : users.length.toLocaleString('ar-EG'), icon: Users, note: 'من Firestore' },
    { label: 'خطط الختمة', value: loadingUsers ? '…' : khatmaUsersCount.toLocaleString('ar-EG'), icon: BookOpen, note: 'مستخدم لديه خطة' },
    { label: 'جلسات الاستماع', value: 'غير متاح', icon: Headphones, note: 'لا يوجد مصدر بيانات في Firestore' },
    { label: 'النشاط اليوم', value: 'غير متاح', icon: BarChart3, note: 'لا يوجد سجل نشاط في Firestore' },
  ]

  const renderDashboard = () => (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {stats.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="
                bg-white
                rounded-3xl
                border border-gray-100
                shadow-sm
                p-5
              "
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#075640]/10 flex items-center justify-center">
                  <Icon size={22} className="text-[#075640]" />
                </div>

                <span className="text-[11px] font-bold text-gray-400">
                  {item.note}
                </span>
              </div>

              <p className="text-2xl font-black text-gray-900">
                {item.value}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                {item.label}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-gray-900 text-lg">
                آخر النشاطات
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                نظرة سريعة على آخر عمليات المنصة
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className="text-xs font-bold text-[#075640] hover:underline"
            >
              عرض الكل
            </button>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl bg-gray-50 p-5 text-sm leading-7 text-gray-500">لا توجد بيانات نشاط فعلية في قاعدة البيانات الحالية، لذلك لا يتم عرض بيانات تجريبية.</div>
          </div>
        </section>

        <section className="bg-[#075640] rounded-3xl shadow-sm p-6 text-white relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -right-14 w-48 h-48 rounded-full bg-white/5" />

          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-5">
              <ShieldCheck size={24} />
            </div>

            <h2 className="text-xl font-black">
              مساحة الإدارة
            </h2>

            <p className="text-sm text-white/75 leading-7 mt-2">
              من هنا تتابع المستخدمين والمحتوى والنشاطات
              والإشعارات وإعدادات المنصة.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="w-full rounded-2xl bg-white text-[#075640] py-3 font-black text-sm"
              >
                إدارة المستخدمين
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 font-black text-sm"
              >
                إرسال إشعار
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  )

  const renderUsers = () => (
    <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="font-black text-gray-900 text-lg">
            المستخدمون
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            المستخدمون المسجلون في مجموعة users داخل Firestore
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => void loadUsers(true)}
            disabled={refreshingUsers}
            className="h-11 px-4 rounded-2xl bg-[#075640] text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshingUsers ? 'animate-spin' : ''} />
            {refreshingUsers ? 'جاري التحديث...' : 'تحديث'}
          </button>

          <div className="relative w-full sm:w-72">
          <Search
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو البريد..."
            className="w-full h-11 rounded-2xl border border-gray-200 bg-gray-50 pr-10 pl-4 text-sm outline-none focus:border-[#075640]"
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
        <div className="mb-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500">
          جارٍ تحميل المستخدمين...
        </div>
      )}

      {!loadingUsers && !usersError && users.length === 0 && (
        <div className="mb-4 rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm font-bold text-gray-500">
          لا توجد مستندات مستخدمين في مجموعة users حتى الآن.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="text-right text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-3 font-bold">المستخدم</th>
              <th className="pb-3 font-bold">الحالة</th>
              <th className="pb-3 font-bold">التقدم</th>
              <th className="pb-3 font-bold">الإجراء</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="py-4">
                  <div>
                    <p className="font-bold text-sm text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 dir-ltr text-right">
                      {user.email}
                    </p>
                  </div>
                </td>

                <td className="py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                      user.status === 'نشط'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user.status}
                  </span>
                </td>

                <td className="py-4">
                  <div className="w-36">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-gray-400">الختمة</span>
                      <span className="font-bold text-[#075640]">
                        {user.progress}%
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#075640]"
                        style={{ width: `${user.progress}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-4">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-bold text-gray-600 hover:border-[#075640] hover:text-[#075640] transition flex items-center gap-2"
                  >
                    <Eye size={14} />
                    عرض الحساب
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            لا توجد نتائج مطابقة للبحث.
          </div>
        )}
      </div>
    </section>
  )

  const renderContent = () => (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        {
          title: 'المصحف',
          text: 'إدارة الأقسام المرتبطة بالقراءة والفهرس.',
          icon: BookOpen,
        },
        {
          title: 'التلاوات',
          text: 'متابعة قسم الصوتيات والقراء.',
          icon: Headphones,
        },
        {
          title: 'الأحاديث',
          text: 'إدارة واجهة مكتبة الأحاديث.',
          icon: FileText,
        },
        {
          title: 'الأذكار',
          text: 'إدارة واجهات الأذكار والعدادات.',
          icon: Moon,
        },
      ].map((item) => {
        const Icon = item.icon

        return (
          <div
            key={item.title}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#075640]/10 flex items-center justify-center mb-4">
              <Icon size={23} className="text-[#075640]" />
            </div>

            <h3 className="font-black text-gray-900">
              {item.title}
            </h3>

            <p className="text-sm text-gray-500 leading-7 mt-2">
              {item.text}
            </p>

            <Link
              href={
                item.title === 'المصحف'
                  ? '/mushaf'
                  : item.title === 'التلاوات'
                    ? '/audio'
                    : item.title === 'الأحاديث'
                      ? '/hadith'
                      : '/adhkar'
              }
              className="mt-5 inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:border-[#075640] hover:text-[#075640]"
            >
              فتح القسم
            </Link>
          </div>
        )
      })}
    </section>
  )

  const renderNotifications = () => (
    <section className="max-w-3xl bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-[#c6a15a]/15 flex items-center justify-center">
          <Bell size={21} className="text-[#c6a15a]" />
        </div>

        <div>
          <h2 className="font-black text-gray-900 text-lg">
            الإشعارات
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            تجهيز واجهة إنشاء إشعار جديد
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          value={notificationTitle}
          onChange={(event) => { setNotificationDraftSaved(false); setNotificationTitle(event.target.value) }}
          placeholder="عنوان الإشعار"
          className="w-full h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-[#075640]"
        />

        <textarea
          rows={5}
          value={notificationBody}
          onChange={(event) => { setNotificationDraftSaved(false); setNotificationBody(event.target.value) }}
          placeholder="اكتب نص الإشعار هنا..."
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none resize-none focus:border-[#075640]"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem('samee3_admin_notification_draft', JSON.stringify({ title: notificationTitle.trim(), body: notificationBody.trim(), savedAt: Date.now() }))
              setNotificationDraftSaved(true)
            }}
            className="flex-1 rounded-2xl bg-[#075640] text-white py-3.5 font-black text-sm"
          >
            حفظ المسودة
          </button>

          <button
            type="button"
            onClick={() => {
              setNotificationTitle('')
              setNotificationBody('')
              setNotificationDraftSaved(false)
              window.localStorage.removeItem('samee3_admin_notification_draft')
            }}
            className="rounded-2xl border border-gray-200 px-5 py-3.5 font-black text-sm text-gray-500"
          >
            مسح المسودة
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-6 bg-gray-50 rounded-2xl p-4">
          هذه الشاشة تحفظ مسودة الإشعار محليًا. لا يتم الادعاء بإرسال Push حقيقي من المتصفح من دون خدمة إرسال خادمية مهيأة.
          {notificationDraftSaved ? ' تم حفظ المسودة على هذا الجهاز.' : ''}
        </p>
      </div>
    </section>
  )

  const renderActivity = () => (
    <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-[#075640]/10 flex items-center justify-center">
          <Activity size={21} className="text-[#075640]" />
        </div>

        <div>
          <h2 className="font-black text-gray-900 text-lg">
            سجل النشاطات
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            آخر النشاطات المعروضة في لوحة الإدارة
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="rounded-2xl bg-gray-50 p-5 text-sm leading-7 text-gray-500">لا توجد بيانات نشاط فعلية في قاعدة البيانات الحالية، لذلك لا يتم عرض بيانات تجريبية.</div>
      </div>
    </section>
  )

  const renderSettings = () => (
    <section className="max-w-3xl bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-[#075640]/10 flex items-center justify-center">
          <Settings size={21} className="text-[#075640]" />
        </div>

        <div>
          <h2 className="font-black text-gray-900 text-lg">
            إعدادات المنصة
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            إعدادات أساسية لواجهة الإدارة
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-bold text-gray-500 mb-2 block">
            اسم المنصة
          </span>
          <input
            defaultValue="مصحف سَميع"
            className="w-full h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold outline-none focus:border-[#075640]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-gray-500 mb-2 block">
            الرسالة الترحيبية
          </span>
          <input
            defaultValue="السلام عليكم ورحمة الله"
            className="w-full h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold outline-none focus:border-[#075640]"
          />
        </label>
      </div>

      <label className="block mt-4">
        <span className="text-xs font-bold text-gray-500 mb-2 block">
          وصف المنصة
        </span>
        <textarea
          rows={4}
          defaultValue="مساحة هادئة للقراءة والتدبر والاستماع."
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none resize-none focus:border-[#075640]"
        />
      </label>

      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem('samee3_admin_settings_saved_at', String(Date.now()))
          setSettingsSaved(true)
        }}
        className="mt-5 rounded-2xl bg-[#075640] text-white px-6 py-3.5 font-black text-sm"
      >
        حفظ الإعدادات
      </button>
      {settingsSaved && (
        <p className="mt-3 text-xs font-bold text-[#075640]">تم حفظ إعدادات الواجهة على هذا الجهاز.</p>
      )}
    </section>
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'users':
        return renderUsers()
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

  return (
    <div
      className="min-h-screen bg-gray-50 text-gray-900"
      dir="rtl"
    >
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 right-0 bottom-0 z-50
          w-[280px]
          bg-[#073f30]
          text-white
          p-5
          transition-transform duration-300
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs text-white/50 font-bold">
              لوحة الإدارة
            </p>
            <h1 className="text-xl font-black mt-1">
              مصحف سَميع
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`
                  w-full
                  flex
                  items-center
                  gap-3
                  rounded-2xl
                  px-4
                  py-3.5
                  text-sm
                  font-bold
                  transition
                  ${
                    active
                      ? 'bg-white text-[#075640] shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon size={19} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 space-y-2">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            العودة للتطبيق
            <ChevronLeft size={15} />
          </Link>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-xs font-bold text-white/60"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:mr-[280px] min-h-screen">
        <header className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur border-b border-gray-100">
          <div className="px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-[#075640]"
                aria-label="فتح القائمة"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <p className="text-xs text-gray-400 font-bold">
                  الإدارة
                </p>
                <h2 className="font-black text-gray-900 text-lg truncate">
                  {menuItems.find((item) => item.id === activeTab)?.label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-2.5">
                <ShieldCheck size={16} className="text-[#075640]" />
                <span className="text-xs font-bold text-gray-500">
                  وضع الإدارة
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          {renderActiveTab()}
        </div>
      </main>

      {selectedUser && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
            dir="rtl"
          >
            <div className="bg-[#075640] text-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                    <UserRound size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/60 font-bold">بيانات المستخدم</p>
                    <h3 className="font-black text-xl truncate">{selectedUser.name}</h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-400 font-bold mb-1">البريد الإلكتروني</p>
                  <p className="text-sm font-bold text-gray-900 break-all" dir="ltr">
                    {selectedUser.email}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-400 font-bold mb-1">الحالة</p>
                  <p className="text-sm font-black text-[#075640]">{selectedUser.status}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-400 font-bold mb-1">تقدم المصحف</p>
                  <p className="text-sm font-black text-gray-900">{selectedUser.progress}%</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-400 font-bold mb-1">خطة الختمة</p>
                  <p className="text-sm font-black text-gray-900">
                    {selectedUser.khatmaDays ? `${selectedUser.khatmaDays} يوم` : 'لا توجد خطة'}
                  </p>
                </div>
              </div>

              {selectedUser.khatmaStartDate && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 font-bold mb-1">بداية الختمة</p>
                  <p className="text-sm font-black text-gray-900" dir="ltr">
                    {selectedUser.khatmaStartDate}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs text-gray-400">
                  UID: <span dir="ltr">{selectedUser.id}</span>
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-2xl bg-[#075640] text-white px-5 py-3 text-sm font-black"
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
