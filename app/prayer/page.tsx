'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MapPin, Compass, Calendar, ChevronRight, Bell, BellOff } from 'lucide-react'

export default function PrayerPage() {
  const [currentTime, setCurrentTime] = useState('')

  // تحديث الساعة لايف
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const prayers = [
    { name: 'الفجر', time: '04:30 ص', active: false },
    { name: 'الشروق', time: '05:50 ص', active: false },
    { name: 'الظهر', time: '12:15 م', active: false },
    { name: 'العصر', time: '03:45 م', active: true }, // الصلاة القادمة
    { name: 'المغرب', time: '06:20 م', active: false },
    { name: 'العشاء', time: '07:50 م', active: false },
  ]

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link href="/" className="bg-white p-2 rounded-full shadow-sm text-mushaf-teal hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">مواقيت الصلاة والقبلة</h1>
      </div>

      {/* بطاقة الصلاة القادمة */}
      <section className="bg-gradient-to-br from-mushaf-teal to-[#11464D] rounded-3xl p-6 shadow-xl mb-6 relative overflow-hidden text-white border border-mushaf-gold/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
        
        <div className="flex justify-between items-start relative z-10 mb-6">
          <div>
            <p className="text-mushaf-gold font-bold mb-1">الصلاة القادمة</p>
            <h2 className="font-cairo text-4xl font-bold">العصر</h2>
          </div>
          <div className="text-left">
            <p className="text-sm opacity-80 mb-1">الوقت المتبقي</p>
            <p className="font-mono text-2xl font-bold text-mushaf-gold" dir="ltr">- 01:20:45</p>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-white/20 pt-4 relative z-10 text-sm">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-mushaf-gold" />
            <span>نزوى، عُمان</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-mushaf-gold" />
            <span>15 ربيع الأول 1448</span>
          </div>
        </div>
      </section>

      {/* قائمة المواقيت */}
      <section className="mb-8">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-mushaf-border/40">
          {prayers.map((prayer, index) => (
            <div 
              key={index} 
              className={`flex justify-between items-center p-4 rounded-2xl mb-2 last:mb-0 transition-all ${
                prayer.active 
                  ? 'bg-mushaf-teal text-white shadow-md transform scale-[1.02]' 
                  : 'hover:bg-mushaf-paper text-mushaf-dark'
              }`}
            >
              <span className="font-bold text-lg">{prayer.name}</span>
              <div className="flex items-center gap-4">
                <span className="font-bold font-mono">{prayer.time}</span>
                {prayer.active ? (
                  <Bell className="text-mushaf-gold" size={20} />
                ) : (
                  <BellOff className="text-gray-300" size={20} />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* بوصلة القبلة */}
      <section>
        <h3 className="text-lg font-bold text-mushaf-dark mb-4 flex items-center gap-2">
          <Compass className="text-mushaf-teal" size={24} />
          اتجاه القبلة
        </h3>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-mushaf-border/40 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* تصميم البوصلة */}
          <div className="w-48 h-48 rounded-full border-4 border-mushaf-teal/20 flex items-center justify-center relative">
            {/* إطار داخلي مزخرف */}
            <div className="w-40 h-40 rounded-full border border-dashed border-mushaf-gold/60 flex items-center justify-center relative">
              {/* عقرب البوصلة يشير لمكة */}
              <div className="absolute w-2 h-32 bg-gradient-to-t from-transparent via-mushaf-teal to-mushaf-teal rounded-full transform rotate-45"></div>
              {/* الكعبة (نقطة المركز) */}
              <div className="w-8 h-8 bg-mushaf-dark rounded-sm border-2 border-mushaf-gold relative z-10 shadow-lg flex items-center justify-center">
                <div className="w-full h-2 bg-mushaf-gold/80 absolute top-1"></div>
              </div>
            </div>
            
            {/* الاتجاهات */}
            <span className="absolute top-2 text-xs font-bold text-gray-400">ش</span>
            <span className="absolute bottom-2 text-xs font-bold text-gray-400">ج</span>
            <span className="absolute right-2 text-xs font-bold text-gray-400">ق</span>
            <span className="absolute left-2 text-xs font-bold text-gray-400">غ</span>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6 mt-4">
            تتجه القبلة بزاوية <span className="font-bold text-mushaf-teal">260°</span> تقريباً من موقعك الحالي.
          </p>
        </div>
      </section>

    </div>
  )
}
