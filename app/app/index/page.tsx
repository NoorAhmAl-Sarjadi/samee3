'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, Book, Loader2 } from 'lucide-react'

export default function IndexPage() {
  const [surahs, setSurahs] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => {
        setSurahs(data.data)
        setIsLoading(false)
      })
      .catch(err => console.error("Error fetching surahs:", err))
  }, [])

  const filteredSurahs = surahs.filter(surah => 
    surah.name.includes(searchQuery) || surah.number.toString() === searchQuery
  )

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8">
      
      <div className="bg-mushaf-teal text-white p-5 rounded-b-3xl shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-4">
          <Book size={28} className="text-mushaf-gold" />
          <h1 className="text-2xl font-bold font-cairo">فهرس السور</h1>
        </div>
        
        <div className="relative">
          <input 
            type="text" 
            placeholder="ابحث باسم السورة أو رقمها..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/60 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-mushaf-gold transition"
          />
          <Search className="absolute right-4 top-3.5 text-mushaf-gold" size={20} />
        </div>
      </div>

      <div className="p-4 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-mushaf-teal gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold">جاري تحميل الفهرس...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSurahs.length > 0 ? (
              filteredSurahs.map((surah) => (
                <Link 
                  href="/mushaf" 
                  key={surah.number}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/30 flex items-center justify-between hover:border-mushaf-teal transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-mushaf-paper border-2 border-mushaf-gold rounded-full transform rotate-45 group-hover:bg-mushaf-teal transition">
                      <span className="transform -rotate-45 font-bold text-mushaf-dark group-hover:text-white">
                        {surah.number}
                      </span>
                    </div>
                    
                    <div>
                      <h2 className="font-uthmani text-2xl text-mushaf-teal mb-1">
                        {surah.name}
                      </h2>
                      <p className="text-xs text-gray-500 font-semibold">
                        {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • {surah.numberOfAyahs} آية
                      </p>
                    </div>
                  </div>
                  
                  <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
                </Link>
              ))
            ) : (
              <div className="text-center text-gray-500 py-10">
                لا توجد سورة بهذا الاسم
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
