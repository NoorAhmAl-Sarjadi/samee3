'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  Heart,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

type AdhkarItem = {
  id: number
  text: string
  count: number
  audio?: string
  filename?: string
}

type AdhkarCategory = {
  id: number
  category: string
  audio?: string
  filename?: string
  array: AdhkarItem[]
}

type AdhkarType = 'morning' | 'evening' | 'sleep' | 'waking'

const DATA_URL = 'https://raw.githubusercontent.com/rn0x/Adhkar-json/main/adhkar.json'
const AUDIO_BASE_URL = 'https://raw.githubusercontent.com/rn0x/Adhkar-json/main'

const typeConfig: Record<AdhkarType, { title: string; categoryNames: string[] }> = {
  morning: {
    title: 'أذكار الصباح',
    categoryNames: ['أذكار الصباح والمساء'],
  },
  evening: {
    title: 'أذكار المساء',
    categoryNames: ['أذكار الصباح والمساء'],
  },
  sleep: {
    title: 'أذكار النوم',
    categoryNames: ['أذكار النوم'],
  },
  waking: {
    title: 'أذكار الاستيقاظ من النوم',
    categoryNames: ['أذكار الاستيقاظ من النوم'],
  },
}

const fallbackData: Record<string, AdhkarCategory> = {
  morning: {
    id: 1,
    category: 'أذكار الصباح والمساء',
    array: [
      {
        id: 1,
        text: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ وَلَا يَئُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ﴾.',
        count: 1,
      },
      {
        id: 2,
        text: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ﴾. بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ﴾. بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ﴾.',
        count: 3,
      },
      {
        id: 3,
        text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا.',
        count: 3,
      },
      {
        id: 4,
        text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.',
        count: 100,
      },
    ],
  },
  sleep: {
    id: 2,
    category: 'أذكار النوم',
    array: [
      {
        id: 1,
        text: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.',
        count: 1,
      },
      {
        id: 2,
        text: 'اللَّهُمَّ إِنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ.',
        count: 1,
      },
      {
        id: 3,
        text: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ.',
        count: 33,
      },
    ],
  },
  waking: {
    id: 3,
    category: 'أذكار الاستيقاظ من النوم',
    array: [
      {
        id: 1,
        text: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانِي بَعْدَ مَا أَمَاتَنِي وَإِلَيْهِ النُّشُورُ.',
        count: 1,
      },
      {
        id: 2,
        text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.',
        count: 1,
      },
    ],
  },
}

function toAbsoluteAudioUrl(value?: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${AUDIO_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

function arabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeType(value: string | null): AdhkarType {
  if (value === 'evening' || value === 'sleep' || value === 'waking') return value
  return 'morning'
}

function buildCounts(items: AdhkarItem[]) {
  const result: Record<number, number> = {}
  items.forEach((item) => {
    result[item.id] = Math.max(0, Number(item.count) || 1)
  })
  return result
}

function ReadAdhkarContent() {
  const searchParams = useSearchParams()
  const type = normalizeType(searchParams.get('type'))
  const config = typeConfig[type]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechRef = useRef<number | null>(null)

  const [items, setItems] = useState<AdhkarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [activeId, setActiveId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(0.95)

  const completedCount = useMemo(
    () => items.filter((item) => counts[item.id] === 0).length,
    [items, counts]
  )

  const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0
  const selectedItem = items.find((item) => item.id === activeId) || null

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    speechRef.current = null
  }, [])

  const stopAudio = useCallback(() => {
    stopSpeech()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlaying(false)
  }, [stopSpeech])

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setPlaying(false)
        return
      }

      stopSpeech()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ar-SA'
      utterance.rate = rate
      utterance.pitch = 1
      utterance.volume = muted ? 0 : 1
      utterance.onstart = () => setPlaying(true)
      utterance.onend = () => setPlaying(false)
      utterance.onerror = () => setPlaying(false)
      speechRef.current = window.setTimeout(() => {
        window.speechSynthesis.speak(utterance)
      }, 0)
    },
    [muted, rate, stopSpeech]
  )

  const playItem = useCallback(
    async (item: AdhkarItem) => {
      stopAudio()
      setActiveId(item.id)

      const url = toAbsoluteAudioUrl(item.audio)

      if (!url) {
        speakText(item.text)
        return
      }

      try {
        const audio = new Audio(url)
        audio.preload = 'auto'
        audio.volume = muted ? 0 : 1
        audioRef.current = audio

        audio.onplay = () => setPlaying(true)
        audio.onpause = () => setPlaying(false)
        audio.onended = () => setPlaying(false)
        audio.onerror = () => {
          speakText(item.text)
        }

        await audio.play()
      } catch (error) {
        console.error('Adhkar audio error:', error)
        speakText(item.text)
      }
    },
    [muted, speakText, stopAudio]
  )

  useEffect(() => {
    let ignore = false

    const loadData = async () => {
      setLoading(true)
      setDataError('')
      stopAudio()

      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to fetch adhkar')

        const json = await response.json()
        const categories: AdhkarCategory[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.adhkar)
              ? json.adhkar
              : []

        const wanted = categories.find((category) =>
          config.categoryNames.includes(String(category.category).trim())
        )

        if (!wanted?.array?.length) {
          throw new Error('Category not found')
        }

        if (!ignore) {
          setItems(wanted.array)
          setCounts(buildCounts(wanted.array))
        }
      } catch (error) {
        console.error('Adhkar data error:', error)
        const fallback = fallbackData[type]

        if (!ignore) {
          setDataError('تعذر تحميل البيانات الخارجية الآن، تم تشغيل النسخة الاحتياطية.')
          setItems(fallback.array)
          setCounts(buildCounts(fallback.array))
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()

    return () => {
      ignore = true
      stopAudio()
    }
  }, [config.categoryNames, stopAudio, type])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`samee3_adhkar_favorites_${type}`) || '[]')
      if (Array.isArray(saved)) setFavoriteIds(saved)
    } catch {
      setFavoriteIds([])
    }
  }, [type])

  const handleTap = (item: AdhkarItem) => {
    setActiveId(item.id)
    setCounts((previous) => ({
      ...previous,
      [item.id]: Math.max(0, (previous[item.id] || 0) - 1),
    }))
  }

  const resetItem = (item: AdhkarItem) => {
    setActiveId(item.id)
    setCounts((previous) => ({
      ...previous,
      [item.id]: Math.max(0, Number(item.count) || 1),
    }))
  }

  const copyItem = async (item: AdhkarItem) => {
    try {
      await navigator.clipboard.writeText(item.text)
      setCopiedId(item.id)
      window.setTimeout(() => setCopiedId(null), 1800)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const toggleFavorite = (item: AdhkarItem) => {
    setFavoriteIds((previous) => {
      const next = previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id]

      localStorage.setItem(`samee3_adhkar_favorites_${type}`, JSON.stringify(next))
      return next
    })
  }

  const handleMute = () => {
    setMuted((previous) => {
      const next = !previous

      if (audioRef.current) audioRef.current.volume = next ? 0 : 1

      if (selectedItem && 'speechSynthesis' in window && playing) {
        speakText(selectedItem.text)
      }

      return next
    })
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-mushaf-paper/95 backdrop-blur-md border-b border-mushaf-border/30">
        <div className="flex items-center justify-between p-4">
          <Link
            href="/adhkar"
            className="text-mushaf-teal bg-white p-2.5 rounded-full shadow-sm hover:bg-mushaf-teal hover:text-white transition"
            aria-label="العودة للأذكار"
          >
            <ChevronRight size={22} />
          </Link>

          <div className="text-center">
            <h1 className="font-bold text-mushaf-dark text-lg">{config.title}</h1>
            <p className="text-[11px] text-gray-500 mt-1">حصن المسلم من أذكار الكتاب والسنة</p>
          </div>

          <button
            type="button"
            onClick={handleMute}
            className="text-mushaf-teal bg-white p-2.5 rounded-full shadow-sm hover:bg-mushaf-paper transition"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
            <span>الإنجاز</span>
            <span className="text-mushaf-teal">{arabicDigits(progress)}٪</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-mushaf-teal to-mushaf-gold rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Intro */}
      <main className="px-5 pt-5">
        <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white rounded-3xl p-6 shadow-xl border border-mushaf-gold/20 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-14 -right-10 w-44 h-44 bg-mushaf-gold/5 rounded-full blur-3xl" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <Heart size={28} className="text-mushaf-gold" fill="currentColor" />
            </div>
            <div>
              <h2 className="font-bold text-xl">وردك اليومي</h2>
              <p className="text-white/70 text-sm mt-1">اضغط على الذكر لتسبيح العدد وسماع صوته</p>
            </div>
          </div>

          {dataError && (
            <div className="relative z-10 mt-4 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-xs leading-relaxed text-white/80">
              {dataError}
            </div>
          )}
        </div>

        {/* Voice controls */}
        <div className="mt-4 bg-white rounded-3xl p-4 shadow-sm border border-mushaf-border/40 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-mushaf-teal font-bold text-sm">
            <Volume2 size={18} />
            <span>الصوت</span>
          </div>

          <select
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            className="mr-auto bg-mushaf-paper border border-mushaf-border/40 rounded-xl px-3 py-2 text-xs font-bold text-mushaf-dark outline-none"
            aria-label="سرعة الصوت"
          >
            <option value={0.8}>بطيء</option>
            <option value={0.95}>طبيعي</option>
            <option value={1.1}>سريع</option>
          </select>

          <span className="text-[11px] text-gray-400 font-bold">
            الصوت المتوفر داخل البيانات يُستخدم أولًا، وعند تعذره يتم استخدام الصوت المتاح في الجهاز.
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-mushaf-teal">
            <Loader2 size={42} className="animate-spin" />
            <p className="font-bold">جاري تحميل الأذكار...</p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {items.map((item, index) => {
              const remaining = counts[item.id] ?? item.count
              const completed = remaining === 0
              const isActive = activeId === item.id
              const isFavorite = favoriteIds.includes(item.id)
              const hasAudio = Boolean(item.audio)

              return (
                <article
                  key={`${type}-${item.id}-${index}`}
                  className={`bg-white rounded-3xl p-5 shadow-sm border transition-all duration-300 ${
                    completed
                      ? 'border-green-200 bg-green-50/40 opacity-80'
                      : isActive
                        ? 'border-mushaf-teal/40 shadow-md ring-1 ring-mushaf-teal/10'
                        : 'border-mushaf-border/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-mushaf-paper text-mushaf-teal font-black flex items-center justify-center border border-mushaf-border/30">
                        {arabicDigits(index + 1)}
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 font-bold block">العدد المطلوب</span>
                        <span className="text-sm font-black text-mushaf-dark">{arabicDigits(item.count)} مرات</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {hasAudio && (
                        <span className="text-[10px] bg-mushaf-teal/10 text-mushaf-teal rounded-full px-2 py-1 font-bold">
                          صوت
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item)}
                        className={`p-2 rounded-xl transition ${isFavorite ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}
                        aria-label="إضافة للمفضلة"
                      >
                        <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTap(item)}
                    disabled={completed}
                    className="w-full text-right"
                  >
                    <p className={`font-uthmani text-2xl leading-[2.1] text-mushaf-dark ${completed ? 'line-through decoration-green-400/50' : ''}`}>
                      {item.text}
                    </p>
                  </button>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => playItem(item)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition ${isActive && playing ? 'bg-mushaf-gold text-white shadow-md' : 'bg-mushaf-teal text-white hover:opacity-90'}`}
                    >
                      {isActive && playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                      {isActive && playing ? 'إيقاف الصوت' : 'تشغيل الصوت'}
                    </button>

                    <button
                      type="button"
                      onClick={() => copyItem(item)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-mushaf-paper text-mushaf-teal font-bold text-sm hover:bg-mushaf-teal/10 transition"
                    >
                      {copiedId === item.id ? <CheckCheck size={18} /> : <Copy size={18} />}
                      {copiedId === item.id ? 'تم النسخ' : 'نسخ'}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetItem(item)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 text-gray-500 font-bold text-sm hover:bg-gray-100 transition"
                    >
                      <RotateCcw size={18} />
                      إعادة
                    </button>

                    <div className="mr-auto min-w-[100px] text-left">
                      {completed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-black text-sm">
                          <Check size={18} />
                          تم
                        </span>
                      ) : (
                        <div className="bg-mushaf-paper rounded-2xl px-4 py-2 border border-mushaf-border/30 text-center">
                          <span className="text-[10px] text-gray-400 font-bold block">متبقي</span>
                          <span className="text-lg font-black text-mushaf-teal">{arabicDigits(remaining)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {progress === 100 && (
              <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white rounded-3xl p-7 text-center shadow-xl border border-mushaf-gold/20 animate-[fadeIn_0.4s_ease-out]">
                <CheckCheck size={46} className="mx-auto text-mushaf-gold mb-3" />
                <h2 className="font-bold text-2xl mb-2">تقبّل الله طاعتكم</h2>
                <p className="text-white/75 text-sm">أتممت {config.title} بنجاح.</p>
                <Link
                  href="/adhkar"
                  className="inline-flex items-center gap-2 mt-5 bg-white text-mushaf-teal px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:scale-[1.02] transition"
                >
                  <ChevronRight size={18} />
                  العودة للأذكار
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating audio player */}
      {selectedItem && playing && (
        <div className="fixed bottom-24 left-4 right-4 max-w-xl mx-auto z-50">
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white rounded-3xl p-4 shadow-2xl border border-mushaf-gold/20 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <Volume2 size={23} className="text-mushaf-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-mushaf-gold text-xs font-bold mb-1">يتم تشغيل الذكر</p>
              <p className="text-sm font-bold line-clamp-2 leading-relaxed">{selectedItem.text}</p>
            </div>
            <button
              type="button"
              onClick={stopAudio}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/20 flex items-center justify-center transition"
              aria-label="إغلاق المشغل"
            >
              <X size={19} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReadAdhkarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mushaf-paper flex flex-col items-center justify-center gap-4 text-mushaf-teal">
          <Loader2 size={42} className="animate-spin" />
          <p className="font-bold">جاري تحميل الأذكار...</p>
        </div>
      }
    >
      <ReadAdhkarContent />
    </Suspense>
  )
}
