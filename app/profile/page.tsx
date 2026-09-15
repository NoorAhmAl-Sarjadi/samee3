'use client'

import { User, Target, Bookmark, Heart, Award, ChevronLeft, BookOpen, Settings } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <div className="flex items-center gap-3">
          <User size={28} className="text-mushaf-teal" />
          <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">حسابي وإنجازي</h1>
        </div>
        <button className="text-mushaf-gold hover:text-mushaf-teal transition">
          <Settings size={24} />
        </button>
      </div>

      {/* بطاقة المستخدم */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-mushaf-border/40 flex items-center gap-5 mb-8">
        <div className="w-16 h-16 bg-mushaf-teal text-white rounded-full flex items-center justify-center text-2xl font-bold border-2 border-mushaf-gold shadow-md">
          م
        </div>
        <div>
          <h2 className="text-xl font-bold text-mushaf-dark mb-1">مسلم</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Award size={16} className="text-mushaf-gold" />
            حافظ لـ 3 أجزاء
          </p>
        </div>
      </section>

      {/* خطة ختم القرآن */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark flex items-center gap-2">
            <Target className="text-mushaf-teal" size={24} />
            خطة الختمة الحالية
          </h3>
          <span className="text-xs font-bold bg-mushaf-gold/20 text-mushaf-gold px-3 py-1 rounded-full">
            مستمر
          </span>
        </div>

        <div className="bg-gradient-to-br from-mushaf-teal to-[#11464D] rounded-3xl p-6 shadow-lg text-white relative overflow-hidden border border-mushaf-gold/20">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
          
          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <p className="text-mushaf-gold text-sm font-bold mb-1">الورد اليومي</p>
              <p className="text-2xl font-bold">صفحة 42</p>
              <p className="text-xs opacity-80 mt-1">سورة البقرة</p>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold mb-1">الإنجاز</p>
              <p className="text-3xl font-mono text-mushaf-gold">7%</p>
            </div>
          </div>

          {/* شريط التقدم */}
          <div className="w-full h-2 bg-white/20 rounded-full mb-4 relative z-10">
            <div className="h-full bg-mushaf-gold rounded-full w-[7%] shadow-[0_0_10px_rgba(197,154,83,0.8)]"></div>
          </div>

          <Link href="/mushaf" className="w-full bg-white text-mushaf-teal font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-mushaf-paper transition relative z-10 shadow-md">
            <BookOpen size={20} />
            متابعة الورد اليومي
          </Link>
        </div>
      </section>

      {/* الحفظ والمراجعة */}
      <section className="mb-8">
        <h3 className="text-lg font-bold text-mushaf-dark mb-4 flex items-center gap-2">
          <Bookmark className="text-mushaf-teal" size={24} />
          المحفوظات والعلامات
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition">
              <Bookmark size={28} className="text-mushaf-gold" />
            </div>
            <div className="text-center">
              <span className="font-bold text-mushaf-dark block">الفواصل</span>
              <span className="text-xs text-gray-500">4 علامات</span>
            </div>
          </button>

          <button className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full group-hover:bg-mushaf-gold/20 transition">
              <Heart size={28} className="text-mushaf-gold" />
            </div>
            <div className="text-center">
              <span className="font-bold text-mushaf-dark block">المفضلة</span>
              <span className="text-xs text-gray-500">12 آية</span>
            </div>
          </button>
        </div>
      </section>

      {/* خطة الحفظ */}
      <section>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex items-center justify-between group cursor-pointer hover:border-mushaf-teal transition">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-mushaf-paper rounded-full flex items-center justify-center border border-mushaf-gold/50">
              <BookOpen className="text-mushaf-gold" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-mushaf-dark">اختبار الحفظ والمراجعة</h4>
              <p className="text-xs text-gray-500">تسميع وإخفاء الآيات</p>
            </div>
          </div>
          <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
        </div>
      </section>

    </div>
  )
}
