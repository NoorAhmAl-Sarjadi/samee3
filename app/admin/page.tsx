'use client'

import { useState } from 'react'
import { LayoutDashboard, Users, Database, Bell, Settings, LogOut, Activity, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex relative z-[100]" dir="rtl">
      
      {/* القائمة الجانبية (Sidebar) */}
      <aside className="w-20 md:w-64 bg-mushaf-dark text-white flex flex-col transition-all duration-300 shadow-2xl z-20">
        <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-center md:justify-start gap-3">
          <ShieldCheck className="text-mushaf-gold" size={32} />
          <h1 className="font-bold text-xl hidden md:block">لوحة الإدارة</h1>
        </div>
        
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          <SidebarItem icon={LayoutDashboard} label="الرئيسية" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Users} label="المستخدمين" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <SidebarItem icon={Database} label="إدارة المحتوى" active={activeTab === 'content'} onClick={() => setActiveTab('content')} />
          <SidebarItem icon={Bell} label="الإشعارات" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          <SidebarItem icon={Settings} label="الإعدادات" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-4 border-t border-white/10">
          <button className="flex items-center justify-center md:justify-start gap-3 text-gray-400 hover:text-red-400 transition w-full p-2 rounded-xl hover:bg-white/5">
            <LogOut size={20} />
            <span className="hidden md:block">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto pb-28 md:pb-10">
        <header className="flex justify-between items-center mb-10 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">مرحباً بك، مدير النظام</h2>
            <p className="text-sm text-gray-500 mt-1">نظرة عامة على أداء تطبيق مصحف سميع</p>
          </div>
          <Link href="/" className="bg-mushaf-teal text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-mushaf-teal/90 transition flex items-center gap-2">
            العودة للتطبيق
          </Link>
        </header>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard icon={Users} title="إجمالي المستخدمين" value="1,245" trend="+12% هذا الأسبوع" color="text-blue-500" bg="bg-blue-50" />
          <StatCard icon={Activity} title="التلاوات المستمعة" value="8,430" trend="+5% هذا الأسبوع" color="text-mushaf-teal" bg="bg-teal-50" />
          <StatCard icon={FileText} title="الختمات المكتملة" value="312" trend="+22% هذا الشهر" color="text-mushaf-gold" bg="bg-yellow-50" />
        </div>

        {/* قسم النشاطات الأخيرة */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-4">أحدث النشاطات</h3>
          <div className="space-y-4">
            <ActivityRow user="أحمد محمود" action="أكمل ختمة القرآن الكريم" time="منذ ساعتين" />
            <ActivityRow user="سارة علي" action="أضافت 5 آيات للمفضلة" time="منذ 3 ساعات" />
            <ActivityRow user="مدير النظام" action="تحديث قاعدة بيانات الأحاديث" time="منذ 5 ساعات" />
            <ActivityRow user="عمر خالد" action="أنشأ حساباً جديداً" time="منذ يوم" />
          </div>
        </section>
      </main>
    </div>
  )
}

// مكونات فرعية للمساعدة في نظافة الكود
function SidebarItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center md:justify-start gap-3 w-full p-3 rounded-xl transition-all ${
        active ? 'bg-mushaf-teal text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={20} />
      <span className="hidden md:block font-semibold text-sm">{label}</span>
    </button>
  )
}

function StatCard({ icon: Icon, title, value, trend, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-2xl ${bg}`}>
          <Icon size={24} className={color} />
        </div>
        <h4 className="font-bold text-gray-600">{title}</h4>
      </div>
      <div className="text-3xl font-bold text-gray-800 mb-2">{value}</div>
      <div className="text-xs text-green-500 font-semibold">{trend}</div>
    </div>
  )
}

function ActivityRow({ user, action, time }: any) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition border border-transparent hover:border-gray-100 cursor-default">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-mushaf-paper border border-mushaf-gold/30 rounded-full flex items-center justify-center font-bold text-mushaf-teal">
          {user.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-sm text-gray-800">{user}</p>
          <p className="text-xs text-gray-500 mt-1">{action}</p>
        </div>
      </div>
      <span className="text-xs text-gray-400 font-mono">{time}</span>
    </div>
  )
}
