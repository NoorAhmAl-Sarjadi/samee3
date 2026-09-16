'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, List, Hash, Loader2 } from 'lucide-react'

const surahsList = [
  { id: 1, name: 'الفاتحة', type: 'مكية', ayahs: 7, startPage: 1 },
  { id: 2, name: 'البقرة', type: 'مدنية', ayahs: 286, startPage: 2 },
  { id: 3, name: 'آل عمران', type: 'مدنية', ayahs: 200, startPage: 50 },
  { id: 4, name: 'النساء', type: 'مدنية', ayahs: 176, startPage: 77 },
  { id: 5, name: 'المائدة', type: 'مدنية', ayahs: 120, startPage: 106 },
  { id: 6, name: 'الأنعام', type: 'مكية', ayahs: 165, startPage: 128 },
  { id: 7, name: 'الأعراف', type: 'مكية', ayahs: 206, startPage: 151 },
  { id: 8, name: 'الأنفال', type: 'مدنية', ayahs: 75, startPage: 177 },
  { id: 9, name: 'التوبة', type: 'مدنية', ayahs: 129, startPage: 187 },
  { id: 10, name: 'يونس', type: 'مكية', ayahs: 109, startPage: 208 },
  { id: 11, name: 'هود', type: 'مكية', ayahs: 123, startPage: 221 },
  { id: 12, name: 'يوسف', type: 'مكية', ayahs: 111, startPage: 235 },
  { id: 18, name: 'الكهف', type: 'مكية', ayahs: 110, startPage: 293 },
  { id: 36, name: 'يس', type: 'مكية', ayahs: 83, startPage: 440 },
  { id: 55, name: 'الرحمن', type: 'مدنية', ayahs: 78, startPage: 531 },
  { id: 67, name: 'الملك', type: 'مكية', ayahs: 30, startPage: 562 },
  { id: 112, name: 'الإخلاص', type: 'مكية', ayahs: 4, startPage: 604 },
  { id: 113, name: 'الفلق', type: 'مكية', ayahs: 5, startPage: 604 },
  { id: 114, name: 'الناس', type: 'مكية', ayahs: 6, startPage: 604 },
]

function IndexContent() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSurahs = surahsList.filter(surah => 
    surah.name.includes(searchQuery)
  )

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      <div className="flex items-center gap-3 mb-6 pt-2">
        <List size={28} className="text-mushaf-teal" />
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">فهرس السور</h1>
      </div>

      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="ابحث عن سورة..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-mushaf-border/50 text-mushaf-dark placeholder-gray-400 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-mushaf-teal transition shadow-sm"
        />
        <Search className="absolute right-4 top-3.5 text-mushaf-gold" size={20} />
      </div>

      <div className="flex flex-col gap-3">
        {filteredSurahs.map((surah) => (
          <Link 
            key={surah.id}
            href={`/mushaf?page=${surah.startPage}`} 
            className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/40 flex items-center justify-between hover:border-mushaf-teal transition group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-mushaf-paper border border-mushaf-gold/50 rounded-xl group-hover:bg-mushaf-teal transition">
                <span className="font-bold text-mushaf-gold group-hover:text-white">{surah.id}</span>
              </div>
              <div>
                <h2 className="font-bold font-uthmani text-xl text-mushaf-dark mb-1 group-hover:text-mushaf-teal transition">
                  سُورَةُ {surah.name}
                </h2>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Hash size={12}/> {surah.type}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{surah.ayahs} آية</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-left hidden sm:block">
                <span className="text-xs text-gray-400 block mb-1">الصفحة</span>
                <span className="font-bold text-mushaf-teal">{surah.startPage}</span>
              </div>
              <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </div>
          </Link>
        ))}

        {filteredSurahs.length === 0 && (
          <div className="text-center py-10 text-gray-400 font-bold">
            لم يتم العثور على سورة بهذا الاسم
          </div>
        )}
      </div>
    </div>
  )
}

export default function SurahsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-mushaf-paper">
        <Loader2 className="animate-spin text-mushaf-teal" size={40}/>
      </div>
    }>
      <IndexContent />
    </Suspense>
  )
}
