'use client'

import { BookOpen, Search, Share2, Bookmark, ChevronLeft } from 'lucide-react'

export default function HadithPage() {
  const books = [
    { name: 'صحيح البخاري', count: '7563 حديث' },
    { name: 'صحيح مسلم', count: '3033 حديث' },
    { name: 'سنن أبي داود', count: '5274 حديث' },
    { name: 'جامع الترمذي', count: '3956 حديث' },
    { name: 'سنن النسائي', count: '5758 حديث' },
    { name: 'سنن ابن ماجه', count: '4341 حديث' },
  ]

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8">
      
      {/* الهيدر */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <BookOpen size={28} className="text-mushaf-teal" />
        <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">الأحاديث النبوية</h1>
      </div>

      {/* شريط البحث */}
      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="ابحث في الأحاديث..." 
          className="w-full bg-white border border-mushaf-border/50 text-mushaf-dark placeholder-gray-400 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-mushaf-teal transition shadow-sm"
        />
        <Search className="absolute right-4 top-3.5 text-mushaf-gold" size={20} />
      </div>

      {/* حديث اليوم */}
      <section className="mb-8">
        <h3 className="text-lg font-bold text-mushaf-dark mb-4">حديث اليوم</h3>
        <div className="bg-white rounded-3xl p-6 shadow-md border border-mushaf-border/30 relative overflow-hidden">
          {/* زخرفة خفيفة في الخلفية */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-mushaf-teal/5 rounded-bl-[100px]"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="bg-mushaf-paper text-mushaf-teal text-xs font-bold px-3 py-1 rounded-full border border-mushaf-gold/30">
              صحيح البخاري
            </span>
            <div className="flex gap-2 text-mushaf-gold">
              <button className="hover:text-mushaf-teal transition"><Bookmark size={20} /></button>
              <button className="hover:text-mushaf-teal transition"><Share2 size={20} /></button>
            </div>
          </div>

          <p className="font-uthmani text-xl leading-relaxed text-mushaf-dark text-justify mb-4 relative z-10">
            عَنْ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ: 
            <span className="text-mushaf-teal block mt-2 font-bold">
              «إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى...»
            </span>
          </p>
          
          <div className="border-t border-gray-100 pt-3 mt-2 text-xs text-gray-500 font-semibold flex justify-between relative z-10">
            <span>رواه البخاري (1)</span>
            <span>كتاب بدء الوحي</span>
          </div>
        </div>
      </section>

      {/* قائمة كتب الحديث */}
      <section>
        <h3 className="text-lg font-bold text-mushaf-dark mb-4">كتب الحديث المعتمدة</h3>
        <div className="flex flex-col gap-3">
          {books.map((book, index) => (
            <button 
              key={index}
              className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/30 flex items-center justify-between hover:border-mushaf-teal transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-mushaf-paper border border-mushaf-gold/50 rounded-xl group-hover:bg-mushaf-teal transition">
                  <BookOpen className="text-mushaf-gold group-hover:text-white" size={24} />
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-mushaf-dark text-lg mb-1 group-hover:text-mushaf-teal transition">{book.name}</h4>
                  <p className="text-xs text-gray-500">{book.count}</p>
                </div>
              </div>
              <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </button>
          ))}
        </div>
      </section>

    </div>
  )
}
