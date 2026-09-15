'use client'

import { useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, Headphones, ListMusic } from 'lucide-react'

export default function AudioPlayerPage() {
  const [isPlaying, setIsPlaying] = useState(false)

  const reciters = [
    { name: 'مشاري راشد العفاسي', rewaya: 'حفص عن عاصم' },
    { name: 'محمود خليل الحصري', rewaya: 'المصحف المرتل' },
    { name: 'عبد الباسط عبد الصمد', rewaya: 'المصحف المجود' },
    { name: 'ياسر الدوسري', rewaya: 'حفص عن عاصم' },
    { name: 'ماهر المعيقلي', rewaya: 'حفص عن عاصم' },
  ]

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Headphones size={28} className="text-mushaf-teal" />
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">التلاوات الصوتية</h1>
      </div>

      {/* المشغل الرئيسي (Now Playing) */}
      <section className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-[2rem] p-6 shadow-2xl mb-8 relative overflow-hidden border border-mushaf-gold/20">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-mushaf-gold opacity-10 rounded-full blur-2xl"></div>
        
        {/* تصميم الأسطوانة / الزخرفة الإسلامية */}
        <div className="w-32 h-32 mx-auto bg-mushaf-paper rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(197,154,83,0.3)] border-4 border-mushaf-gold/40 relative">
          <div className={`w-24 h-24 rounded-full border-2 border-mushaf-teal flex items-center justify-center bg-white ${isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`}>
             <div className="w-16 h-16 bg-mushaf-gold/20 rounded-full flex items-center justify-center">
                <Headphones className="text-mushaf-teal" size={32} />
             </div>
          </div>
        </div>

        {/* تفاصيل المقطع */}
        <div className="text-center text-white mb-8">
          <h2 className="font-uthmani text-3xl mb-2 text-mushaf-gold">سُورَةُ البَقَرَةِ</h2>
          <p className="text-sm opacity-80">الشيخ مشاري راشد العفاسي</p>
        </div>

        {/* شريط التقدم */}
        <div className="mb-8">
          <div className="w-full h-1.5 bg-white/20 rounded-full relative cursor-pointer">
            <div className="absolute top-0 right-0 h-full w-1/3 bg-mushaf-gold rounded-full"></div>
            <div className="absolute top-1/2 right-1/3 w-3 h-3 bg-white rounded-full transform translate-x-1/2 -translate-y-1/2 shadow-md"></div>
          </div>
          <div className="flex justify-between text-white/50 text-xs mt-2 font-mono" dir="ltr">
            <span>04:30</span>
            <span>42:15</span>
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex items-center justify-center gap-8 text-white relative z-10" dir="ltr">
          <button className="hover:text-mushaf-gold transition"><SkipBack size={28} fill="currentColor" /></button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 bg-mushaf-gold rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-[0_0_15px_rgba(197,154,83,0.5)]"
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </button>

          <button className="hover:text-mushaf-gold transition"><SkipForward size={28} fill="currentColor" /></button>
        </div>
      </section>

      {/* مكتبة القراء */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark">مكتبة القراء</h3>
          <ListMusic size={20} className="text-mushaf-gold" />
        </div>
        
        <div className="flex flex-col gap-3">
          {reciters.map((reciter, index) => (
            <button 
              key={index}
              className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/30 flex items-center gap-4 hover:border-mushaf-teal transition group text-right w-full"
            >
              <div className="w-12 h-12 bg-mushaf-paper border border-mushaf-gold/30 rounded-full flex items-center justify-center group-hover:bg-mushaf-teal transition">
                <Play size={20} className="text-mushaf-gold group-hover:text-white" fill="currentColor" />
              </div>
              <div>
                <h4 className="font-bold text-mushaf-dark mb-1 group-hover:text-mushaf-teal transition">{reciter.name}</h4>
                <p className="text-xs text-gray-500">{reciter.rewaya}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

    </div>
  )
}
