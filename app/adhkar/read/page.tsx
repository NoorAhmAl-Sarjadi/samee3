'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Check, Loader2 } from 'lucide-react'

// قاعدة بيانات مصغرة للأذكار
const adhkarDB = {
  morning: {
    title: 'أذكار الصباح',
    items: [
      { id: 1, text: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ: (اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ ...)', count: 1 },
      { id: 2, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ... (والمعوذتين)', count: 3 },
      { id: 3, text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ...', count: 1 },
      { id: 4, text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ.', count: 1 },
      { id: 5, text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.', count: 100 }
    ]
  },
  evening: {
    title: 'أذكار المساء',
    items: [
      { id: 1, text: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ: (اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ ...)', count: 1 },
      { id: 2, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ... (والمعوذتين)', count: 3 },
      { id: 3, text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ...', count: 1 },
      { id: 4, text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ.', count: 1 }
    ]
  },
  sleep: {
    title: 'أذكار النوم',
    items: [
      { id: 1, text: 'بِاسْمِكَ رَبِّـي وَضَعْـتُ جَنْـبي، وَبِكَ أَرْفَعُـه...', count: 1 },
      { id: 2, text: 'اللَّهُمَّ إِنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا...', count: 1 },
      { id: 3, text: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.', count: 1 }
    ]
  }
}

function ReadAdhkarContent() {
  const searchParams = useSearchParams()
  const type = (searchParams.get('type') || 'morning') as keyof typeof adhkarDB
  
  const currentAdhkar = adhkarDB[type]
  const [counts, setCounts] = useState<{ [key: number]: number }>({})

  useEffect(() => {
    const initialCounts: { [key: number]: number } = {}
    currentAdhkar.items.forEach(item => {
      initialCounts[item.id] = item.count
    })
    setCounts(initialCounts)
  }, [type, currentAdhkar.items])

  const handleTap = (id: number) => {
    if (counts[id] > 0) {
      setCounts(prev => ({ ...prev, [id]: prev[id] - 1 }))
    }
  }

  const totalItems = currentAdhkar.items.length
  const completedItems = Object.values(counts).filter(c => c === 0).length
  const progress = Math.round((completedItems / totalItems) * 100) || 0

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8">
      <div className="flex justify-between items-center p-4 bg-mushaf-paper shadow-sm z-10 sticky top-0">
        <Link href="/adhkar" className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition">
          <ChevronRight size={24} />
        </Link>
        <h1 className="font-bold text-mushaf-dark text-lg">{currentAdhkar.title}</h1>
        <div className="w-10 text-center font-mono font-bold text-mushaf-gold">{progress}%</div>
      </div>
      
      <div className="w-full h-1 bg-gray-200">
        <div className="h-full bg-mushaf-teal transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {currentAdhkar.items.map((item) => {
          const isDone = counts[item.id] === 0

          return (
            <div 
              key={item.id}
              onClick={() => handleTap(item.id)}
              className={`relative bg-white rounded-2xl p-5 shadow-sm border transition-all duration-300 cursor-pointer overflow-hidden
                ${isDone ? 'border-green-400 bg-green-50/30 scale-[0.98] opacity-70' : 'border-mushaf-border/40 hover:border-mushaf-teal active:scale-[0.98]'}`}
            >
              <p className={`font-uthmani text-xl leading-relaxed text-center mb-4 transition-all duration-300 ${isDone ? 'text-gray-400' : 'text-mushaf-dark'}`} dir="rtl">
                {item.text}
              </p>
              
              <div className="flex justify-center">
                {isDone ? (
                  <div className="w-12 h-12 bg-green-400 text-white rounded-full flex items-center justify-center shadow-md animate-[scaleIn_0.3s_ease-out]">
                    <Check size={24} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-20 h-10 bg-mushaf-paper border border-mushaf-gold rounded-full flex items-center justify-center text-mushaf-teal font-bold shadow-sm">
                    {counts[item.id]} / {item.count}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {progress === 100 && (
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white p-6 rounded-2xl text-center shadow-lg mt-4 animate-[fadeIn_0.5s_ease-out]">
            <Check size={40} className="mx-auto mb-2 text-mushaf-gold" />
            <h2 className="font-bold text-xl mb-1">تقبل الله طاعتكم</h2>
            <p className="text-sm opacity-80">لقد أتممت قراءة {currentAdhkar.title} بنجاح</p>
            <Link href="/adhkar" className="inline-block mt-4 bg-white text-mushaf-teal px-6 py-2 rounded-xl font-bold text-sm shadow-md">
              العودة
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReadAdhkarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-mushaf-paper">
        <Loader2 className="animate-spin text-mushaf-teal" size={40}/>
        <p className="text-mushaf-teal font-bold">جاري تحميل الأذكار...</p>
      </div>
    }>
      <ReadAdhkarContent />
    </Suspense>
  )
}
