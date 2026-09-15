'use client'

import { useState } from 'react'
import { Heart, RotateCcw, Plus, Sun, Moon, Star } from 'lucide-react'

export default function AdhkarPage() {
  const [tasbeehCount, setTasbeehCount] = useState(0)

  // دالة زيادة العداد
  const handleTasbeeh = () => {
    setTasbeehCount(prev => prev + 1)
    // هنا ممكن نضيف اهتزاز خفيف للموبايل (Haptic Feedback) لو المتصفح يدعم
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50)
    }
  }

  // دالة تصفير العداد
  const resetTasbeeh = () => {
    setTasbeehCount(0)
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Heart size={28} className="text-mushaf-teal" />
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">الأذكار والتسبيح</h1>
      </div>

      {/* المسبحة الإلكترونية (عداد التسبيح) */}
      <section className="bg-gradient-to-br from-mushaf-teal to-[#11464D] rounded-3xl p-6 shadow-xl mb-8 relative overflow-hidden flex flex-col items-center justify-center border-4 border-mushaf-gold/20">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        
        <h2 className="text-mushaf-gold font-bold text-lg mb-4 relative z-10">المسبحة الإلكترونية</h2>
        
        {/* شاشة العداد */}
        <div className="bg-mushaf-paper w-40 h-20 rounded-2xl flex items-center justify-center shadow-inner mb-6 relative z-10 border-2 border-mushaf-border">
          <span className="text-4xl font-bold text-mushaf-dark">{tasbeehCount}</span>
        </div>

        {/* أزرار التحكم */}
        <div className="flex items-center gap-6 relative z-10">
          <button 
            onClick={resetTasbeeh}
            className="bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition backdrop-blur-sm"
            title="تصفير العداد"
          >
            <RotateCcw size={24} />
          </button>
          
          <button 
            onClick={handleTasbeeh}
            className="bg-mushaf-gold w-24 h-24 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(197,154,83,0.4)] hover:scale-105 active:scale-95 transition-all border-4 border-white/20"
          >
            <Plus size={40} strokeWidth={3} />
          </button>
        </div>
      </section>

      {/* تصنيفات الأذكار */}
      <section>
        <h3 className="text-lg font-bold text-mushaf-dark mb-4">أذكار المسلم</h3>
        <div className="grid grid-cols-2 gap-4">
          
          {/* بطاقة أذكار الصباح */}
          <button className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition">
              <Sun size={28} className="text-blue-500" />
            </div>
            <span className="font-bold text-mushaf-dark text-sm">أذكار الصباح</span>
          </button>

          {/* بطاقة أذكار المساء */}
          <button className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-indigo-50 p-3 rounded-full group-hover:bg-indigo-100 transition">
              <Moon size={28} className="text-indigo-600" />
            </div>
            <span className="font-bold text-mushaf-dark text-sm">أذكار المساء</span>
          </button>

          {/* بطاقة أذكار النوم */}
          <button className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-purple-50 p-3 rounded-full group-hover:bg-purple-100 transition">
              <Star size={28} className="text-purple-500" />
            </div>
            <span className="font-bold text-mushaf-dark text-sm">أذكار النوم</span>
          </button>

          {/* بطاقة أذكار الصلاة */}
          <button className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex flex-col items-center gap-3 hover:border-mushaf-teal transition group">
            <div className="bg-mushaf-paper p-3 rounded-full border border-mushaf-gold/30 group-hover:bg-mushaf-gold/10 transition">
              <Heart size={28} className="text-mushaf-gold" />
            </div>
            <span className="font-bold text-mushaf-dark text-sm">بعد الصلاة</span>
          </button>

        </div>
      </section>

    </div>
  )
}
