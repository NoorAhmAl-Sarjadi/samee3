'use client'

import { useState } from 'react'
import { Heart, Sun, Moon, Shield, ChevronLeft, Plus, RotateCcw } from 'lucide-react'
import Link from 'next/link'

export default function AdhkarPage() {
  const [count, setCount] = useState(0)
  
  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex items-center gap-3 mb-8 pt-2">
        <Heart size={28} className="text-mushaf-teal" />
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">الأذكار والتسبيح</h1>
      </div>

      {/* السبحة الإلكترونية (تحديث شكلها) */}
      <section className="mb-8">
        <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-3xl p-8 shadow-xl text-center relative overflow-hidden border border-mushaf-gold/20 flex flex-col items-center justify-center">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
          
          <h2 className="text-mushaf-gold font-bold mb-6 text-lg relative z-10">المسبحة الإلكترونية</h2>
          
          <div className="w-48 h-48 rounded-full border-4 border-mushaf-gold/30 flex items-center justify-center relative z-10 mb-8 bg-white/5 backdrop-blur-sm shadow-inner">
            <span className="text-6xl font-mono text-white font-bold">{count}</span>
          </div>

          <div className="flex gap-4 w-full relative z-10">
            <button 
              onClick={() => setCount(prev => prev + 1)}
              className="flex-1 bg-white text-mushaf-teal font-bold text-xl py-4 rounded-2xl shadow-lg hover:bg-mushaf-paper hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus size={24} />
              تسبيح
            </button>
            <button 
              onClick={() => setCount(0)}
              className="w-16 bg-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-white/20"
            >
              <RotateCcw size={24} />
            </button>
          </div>
        </div>
      </section>

      {/* تصنيفات الأذكار المربوطة بالصفحة الجديدة */}
      <section>
        <h3 className="text-lg font-bold text-mushaf-dark mb-4">أقسام الأذكار</h3>
        
        <div className="flex flex-col gap-3">
          <Link href="/adhkar/read?type=morning" className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition">
                <Sun size={24} />
              </div>
              <span className="font-bold text-mushaf-dark text-lg group-hover:text-mushaf-teal transition">أذكار الصباح</span>
            </div>
            <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
          </Link>

          <Link href="/adhkar/read?type=evening" className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition">
                <Moon size={24} />
              </div>
              <span className="font-bold text-mushaf-dark text-lg group-hover:text-mushaf-teal transition">أذكار المساء</span>
            </div>
            <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
          </Link>

          <Link href="/adhkar/read?type=sleep" className="bg-white p-5 rounded-2xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-mushaf-paper text-mushaf-teal rounded-xl flex items-center justify-center group-hover:bg-mushaf-teal group-hover:text-white transition">
                <Shield size={24} />
              </div>
              <span className="font-bold text-mushaf-dark text-lg group-hover:text-mushaf-teal transition">أذكار النوم</span>
            </div>
            <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
          </Link>
        </div>
      </section>

    </div>
  )
}
