'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, MapPin, Compass, Clock, Bell, Loader2 } from 'lucide-react'

export default function PrayerPage() {
  const [timings, setTimings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState('جاري تحديد الموقع...')
  const [nextPrayer, setNextPrayer] = useState({ name: '', time: '', id: '' })

  useEffect(() => {
    // دالة جلب المواقيت بناءً على خطوط الطول والعرض
    const getTimings = async (lat: number, lng: number, city = 'موقعك الحالي') => {
      try {
        const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=4`)
        const data = await res.json()
        setTimings(data.data.timings)
        setLocationName(city)
        calculateNextPrayer(data.data.timings)
        setLoading(false)
      } catch (error) {
        console.error(error)
        setLoading(false)
      }
    }

    // الإعداد الافتراضي (مسقط، عُمان) في حالة رفض المستخدم لمشاركة موقعه
    const getFallbackTimings = async () => {
      try {
        const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=Muscat&country=Oman&method=4`)
        const data = await res.json()
        setTimings(data.data.timings)
        setLocationName('مسقط، عُمان')
        calculateNextPrayer(data.data.timings)
        setLoading(false)
      } catch (error) {
        console.error(error)
        setLoading(false)
      }
    }

    // محاولة الحصول على موقع المستخدم
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          getTimings(position.coords.latitude, position.coords.longitude)
        },
        (error) => {
          getFallbackTimings() // لو رفض، نستخدم الإعداد الافتراضي
        }
      )
    } else {
      getFallbackTimings()
    }
  }, [])

  // دالة حساب الصلاة القادمة
  const calculateNextPrayer = (times: any) => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour + currentMinute / 60

    const prayerList = [
      { id: 'Fajr', name: 'الفجر', time: times.Fajr },
      { id: 'Sunrise', name: 'الشروق', time: times.Sunrise },
      { id: 'Dhuhr', name: 'الظهر', time: times.Dhuhr },
      { id: 'Asr', name: 'العصر', time: times.Asr },
      { id: 'Maghrib', name: 'المغرب', time: times.Maghrib },
      { id: 'Isha', name: 'العشاء', time: times.Isha },
    ]

    let next = prayerList[0] // الافتراضي الفجر لو كل الصلوات خلصت
    for (let prayer of prayerList) {
      const [h, m] = prayer.time.split(':').map(Number)
      const pTime = h + m / 60
      if (pTime > currentTime) {
        next = prayer
        break
      }
    }
    setNextPrayer(next)
  }

  // تحويل الوقت لنظام 12 ساعة (ص/م)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    let hour = parseInt(h)
    const ampm = hour >= 12 ? 'م' : 'ص'
    hour = hour % 12
    hour = hour ? hour : 12
    return `${hour}:${m} ${ampm}`
  }

  const prayers = timings ? [
    { id: 'Fajr', name: 'الفجر', time: timings.Fajr },
    { id: 'Sunrise', name: 'الشروق', time: timings.Sunrise },
    { id: 'Dhuhr', name: 'الظهر', time: timings.Dhuhr },
    { id: 'Asr', name: 'العصر', time: timings.Asr },
    { id: 'Maghrib', name: 'المغرب', time: timings.Maghrib },
    { id: 'Isha', name: 'العشاء', time: timings.Isha },
  ] : []

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8 relative">
      
      {/* الهيدر */}
      <div className="flex justify-between items-center p-4 z-10 relative">
        <Link href="/" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg">مواقيت الصلاة</h1>
        <div className="w-10"></div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-mushaf-teal gap-4">
          <Loader2 className="animate-spin" size={40} />
          <p className="font-bold font-cairo">جاري حساب المواقيت بدقة...</p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-6 relative z-10">
          
          {/* بطاقة الصلاة القادمة والموقع */}
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-3xl p-6 shadow-xl text-white relative overflow-hidden border border-mushaf-gold/20">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start relative z-10 mb-8">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                <MapPin size={16} className="text-mushaf-gold" />
                <span className="text-xs font-bold">{locationName}</span>
              </div>
              <Compass size={28} className="text-mushaf-gold opacity-80" />
            </div>

            <div className="relative z-10 text-center mb-2">
              <p className="text-mushaf-gold text-sm font-bold mb-2">الصلاة القادمة</p>
              <h2 className="font-uthmani text-4xl mb-2">{nextPrayer.name}</h2>
              <p className="text-3xl font-mono">{formatTime(nextPrayer.time)}</p>
            </div>
          </div>

          {/* قائمة الصلوات الخمس */}
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-mushaf-border/40">
            {prayers.map((prayer, index) => {
              const isNext = nextPrayer.id === prayer.id;
              return (
                <div 
                  key={prayer.id} 
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all ${isNext ? 'bg-mushaf-teal/5 border border-mushaf-teal/20' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isNext ? 'bg-mushaf-teal text-white shadow-md' : 'bg-mushaf-paper text-mushaf-teal'}`}>
                      {isNext ? <Bell size={18} /> : <Clock size={18} />}
                    </div>
                    <span className={`font-bold ${isNext ? 'text-mushaf-teal text-lg' : 'text-mushaf-dark'}`}>
                      {prayer.name}
                    </span>
                  </div>
                  
                  <div className={`font-mono font-bold ${isNext ? 'text-mushaf-teal text-lg' : 'text-gray-500'}`}>
                    {formatTime(prayer.time)}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

    </div>
  )
}
