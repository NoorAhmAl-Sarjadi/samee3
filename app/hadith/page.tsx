'use client'

import { useMemo, useState } from 'react'
import {
  BookOpen,
  Search,
  Share2,
  Bookmark,
  ChevronLeft,
  X,
  Copy,
  CheckCheck,
  ImageIcon,
  Download,
  Loader2,
} from 'lucide-react'

interface Hadith {
  id: number
  collection: string
  title: string
  text: string
  narrator: string
  reference: string
  book: string
}

const hadithOfDay: Hadith = {
  id: 1,
  collection: 'صحيح البخاري',
  title: 'الأعمال بالنيات',
  text:
    'عَنْ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ: «إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيبُهَا أَوِ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ».',
  narrator: 'عمر بن الخطاب رضي الله عنه',
  reference: 'رواه البخاري (1)',
  book: 'كتاب بدء الوحي',
}

const books = [
  { name: 'صحيح البخاري', count: '7563 حديث' },
  { name: 'صحيح مسلم', count: '3033 حديث' },
  { name: 'سنن أبي داود', count: '5274 حديث' },
  { name: 'جامع الترمذي', count: '3956 حديث' },
  { name: 'سنن النسائي', count: '5758 حديث' },
  { name: 'سنن ابن ماجه', count: '4341 حديث' },
]

export default function HadithPage() {
  const [search, setSearch] = useState('')
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [designOpen, setDesignOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const filteredBooks = useMemo(() => {
    const value = search.trim().toLowerCase()

    if (!value) return books

    return books.filter((book) =>
      book.name.toLowerCase().includes(value)
    )
  }, [search])

  const openHadith = (hadith: Hadith) => {
    setSelectedHadith(hadith)
    setCopied(false)

    try {
      const saved = localStorage.getItem('samee3_hadith_bookmark')
      setIsBookmarked(saved === String(hadith.id))
    } catch {
      setIsBookmarked(false)
    }
  }

  const closeHadith = () => {
    setSelectedHadith(null)
    setDesignOpen(false)
  }

  const toggleBookmark = () => {
    if (!selectedHadith) return

    try {
      if (isBookmarked) {
        localStorage.removeItem('samee3_hadith_bookmark')
        setIsBookmarked(false)
      } else {
        localStorage.setItem(
          'samee3_hadith_bookmark',
          String(selectedHadith.id)
        )
        setIsBookmarked(true)
      }
    } catch (error) {
      console.error('Hadith bookmark error:', error)
    }
  }

  const getShareText = (hadith: Hadith) => {
    return (
      `«${hadith.title}»\n\n` +
      `${hadith.text}\n\n` +
      `${hadith.narrator}\n` +
      `${hadith.reference} • ${hadith.book}\n\n` +
      `مصحف سَميع`
    )
  }

  const copyHadith = async () => {
    if (!selectedHadith) return

    try {
      await navigator.clipboard.writeText(
        getShareText(selectedHadith)
      )

      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Hadith copy error:', error)
    }
  }

  const shareHadith = async () => {
    if (!selectedHadith) return

    const text = getShareText(selectedHadith)

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedHadith.title,
          text,
        })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => {
          setCopied(false)
        }, 2000)
      }
    } catch (error) {
      // المستخدم قد يغلق نافذة المشاركة؛ لا نعرض خطأ حينها
      console.log('Share cancelled or unavailable:', error)
    }
  }

  const escapeXml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  const wrapText = (text: string, maxChars: number) => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const test = current ? `${current} ${word}` : word

      if (test.length > maxChars) {
        if (current) lines.push(current)
        current = word
      } else {
        current = test
      }
    }

    if (current) lines.push(current)
    return lines
  }

  const createHadithSvg = (hadith: Hadith) => {
    const width = 1200
    const titleLines = wrapText(hadith.title, 28)
    const textLines = wrapText(hadith.text, 45)
    const narratorLines = wrapText(`الراوي: ${hadith.narrator}`, 45)

    const titleFontSize = 44
    const textFontSize = 36
    const titleLineHeight = 65
    const textLineHeight = 72
    const narratorLineHeight = 45

    const titleHeight = titleLines.length * titleLineHeight
    const textHeight = textLines.length * textLineHeight
    const narratorHeight = narratorLines.length * narratorLineHeight

    const height = Math.max(
      1050,
      420 + titleHeight + textHeight + narratorHeight
    )

    const centerX = width / 2
    let currentY = 150

    const titleSvg = titleLines
      .map((line, index) => {
        const y = currentY + index * titleLineHeight
        return `
          <text
            x="${centerX}"
            y="${y}"
            text-anchor="middle"
            direction="rtl"
            unicode-bidi="bidi-override"
            font-family="Arial, Tahoma, sans-serif"
            font-size="${titleFontSize}"
            font-weight="700"
            fill="#C59A53"
          >${escapeXml(line)}</text>
        `
      })
      .join('')

    currentY += titleHeight + 90

    const textSvg = textLines
      .map((line, index) => {
        const y = currentY + index * textLineHeight
        return `
          <text
            x="${centerX}"
            y="${y}"
            text-anchor="middle"
            direction="rtl"
            unicode-bidi="bidi-override"
            font-family="Arial, Tahoma, sans-serif"
            font-size="${textFontSize}"
            font-weight="600"
            fill="#FFFFFF"
          >${escapeXml(line)}</text>
        `
      })
      .join('')

    currentY += textHeight + 95

    const narratorSvg = narratorLines
      .map((line, index) => {
        const y = currentY + index * narratorLineHeight
        return `
          <text
            x="${centerX}"
            y="${y}"
            text-anchor="middle"
            direction="rtl"
            unicode-bidi="bidi-override"
            font-family="Arial, Tahoma, sans-serif"
            font-size="24"
            font-weight="700"
            fill="#C59A53"
          >${escapeXml(line)}</text>
        `
      })
      .join('')

    const refY = currentY + narratorHeight + 65

    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
      >
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#175E67" />
            <stop offset="100%" stop-color="#0D383E" />
          </linearGradient>
        </defs>

        <rect
          width="100%"
          height="100%"
          rx="55"
          fill="url(#bg)"
        />

        <circle
          cx="90"
          cy="80"
          r="210"
          fill="#FFFFFF"
          opacity="0.04"
        />

        <circle
          cx="1120"
          cy="${height - 100}"
          r="260"
          fill="#C59A53"
          opacity="0.07"
        />

        <rect
          x="25"
          y="25"
          width="${width - 50}"
          height="${height - 50}"
          rx="42"
          fill="none"
          stroke="#C59A53"
          stroke-width="4"
          opacity="0.8"
        />

        <text
          x="75"
          y="100"
          direction="rtl"
          text-anchor="start"
          font-family="Arial, Tahoma, sans-serif"
          font-size="32"
          font-weight="700"
          fill="#C59A53"
        >مصحف سَميع</text>

        <text
          x="75"
          y="138"
          direction="rtl"
          text-anchor="start"
          font-family="Arial, Tahoma, sans-serif"
          font-size="18"
          fill="#FFFFFF"
          opacity="0.55"
        >الأحاديث النبوية</text>

        <rect
          x="350"
          y="120"
          width="500"
          height="76"
          rx="38"
          fill="#FFFFFF"
          opacity="0.08"
        />

        ${titleSvg}

        <line
          x1="140"
          y1="${currentY - 40}"
          x2="1060"
          y2="${currentY - 40}"
          stroke="#C59A53"
          stroke-opacity="0.4"
          stroke-width="2"
        />

        ${textSvg}

        <line
          x1="220"
          y1="${currentY - 35}"
          x2="980"
          y2="${currentY - 35}"
          stroke="#FFFFFF"
          stroke-opacity="0.12"
          stroke-width="2"
        />

        ${narratorSvg}

        <text
          x="${centerX}"
          y="${refY}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="22"
          font-weight="700"
          fill="#FFFFFF"
          opacity="0.82"
        >${escapeXml(hadith.reference)} • ${escapeXml(hadith.book)}</text>

        <line
          x1="300"
          y1="${height - 135}"
          x2="900"
          y2="${height - 135}"
          stroke="#FFFFFF"
          stroke-opacity="0.14"
          stroke-width="2"
        />

        <text
          x="${centerX}"
          y="${height - 90}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="24"
          font-weight="700"
          fill="#C59A53"
        >مصحف سَميع • الأحاديث النبوية</text>
      </svg>
    `
  }

  const downloadDesign = async () => {
    if (!selectedHadith) return

    setIsDownloading(true)

    try {
      const svg = createHadithSvg(selectedHadith)
      const blob = new Blob([svg], {
        type: 'image/svg+xml;charset=utf-8',
      })

      const url = URL.createObjectURL(blob)
      const image = new Image()

      image.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth || 1200
          canvas.height = image.naturalHeight || 1050

          const context = canvas.getContext('2d')

          if (!context) {
            throw new Error('Canvas unavailable')
          }

          context.fillStyle = '#0D383E'
          context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0)

          const pngUrl = canvas.toDataURL('image/png', 1)
          const link = document.createElement('a')

          link.download = `مصحف-سميع-حديث-${selectedHadith.id}.png`
          link.href = pngUrl

          document.body.appendChild(link)
          link.click()
          link.remove()

          URL.revokeObjectURL(url)
          setIsDownloading(false)
        } catch (error) {
          console.error('Hadith image generation error:', error)
          URL.revokeObjectURL(url)
          setIsDownloading(false)
          alert('حدث خطأ أثناء إنشاء صورة الحديث.')
        }
      }

      image.onerror = () => {
        URL.revokeObjectURL(url)
        setIsDownloading(false)
        alert('تعذر إنشاء صورة الحديث.')
      }

      image.src = url
    } catch (error) {
      console.error('Hadith design error:', error)
      setIsDownloading(false)
      alert('حدث خطأ أثناء تجهيز التصميم.')
    }
  }

  return (
    <div
      className="min-h-screen bg-mushaf-paper flex flex-col p-5 pb-28 md:pb-8"
      dir="rtl"
    >
      {/* الهيدر */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <div className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-mushaf-border/40 flex items-center justify-center">
          <BookOpen size={26} className="text-mushaf-teal" />
        </div>

        <div>
          <h1 className="text-2xl font-bold font-cairo text-mushaf-teal">
            الأحاديث النبوية
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            قراءة وحفظ ومشاركة الأحاديث
          </p>
        </div>
      </div>

      {/* البحث */}
      <div className="relative mb-6">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث في كتب الحديث..."
          className="w-full bg-white border border-mushaf-border/50 text-mushaf-dark placeholder-gray-400 rounded-2xl py-3.5 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-mushaf-teal/30 transition shadow-sm"
        />
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 text-mushaf-gold"
          size={20}
        />
      </div>

      {/* حديث اليوم */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark">حديث اليوم</h3>
          <span className="text-xs font-bold text-mushaf-gold">
            الحديث رقم {hadithOfDay.id}
          </span>
        </div>

        <button
          type="button"
          onClick={() => openHadith(hadithOfDay)}
          className="w-full text-right bg-white rounded-[30px] p-6 shadow-md border border-mushaf-border/30 relative overflow-hidden hover:border-mushaf-teal/50 transition"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-mushaf-teal/5 rounded-bl-[100px]" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-mushaf-gold/5 rounded-tr-[80px]" />

          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="bg-mushaf-paper text-mushaf-teal text-xs font-bold px-3 py-1 rounded-full border border-mushaf-gold/30">
              {hadithOfDay.collection}
            </span>

            <div className="flex gap-2 text-mushaf-gold">
              <span className="p-1.5 rounded-full bg-mushaf-paper">
                <Bookmark size={18} />
              </span>
              <span className="p-1.5 rounded-full bg-mushaf-paper">
                <Share2 size={18} />
              </span>
            </div>
          </div>

          <p className="text-sm font-bold text-mushaf-teal mb-3 relative z-10">
            {hadithOfDay.title}
          </p>

          <p className="font-uthmani text-xl leading-[2] text-mushaf-dark text-justify mb-4 relative z-10 line-clamp-5">
            {hadithOfDay.text}
          </p>

          <div className="border-t border-gray-100 pt-3 mt-2 text-xs text-gray-500 font-semibold flex flex-col sm:flex-row sm:justify-between gap-2 relative z-10">
            <span>{hadithOfDay.narrator}</span>
            <span>{hadithOfDay.reference} • {hadithOfDay.book}</span>
          </div>
        </button>
      </section>

      {/* كتب الحديث */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-mushaf-dark">كتب الحديث المعتمدة</h3>
          <span className="text-xs text-gray-400">
            {filteredBooks.length} كتب
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {filteredBooks.map((book) => (
            <button
              key={book.name}
              type="button"
              className="bg-white p-4 rounded-2xl shadow-sm border border-mushaf-border/30 flex items-center justify-between hover:border-mushaf-teal transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-mushaf-paper border border-mushaf-gold/50 rounded-xl group-hover:bg-mushaf-teal transition">
                  <BookOpen className="text-mushaf-gold group-hover:text-white" size={24} />
                </div>

                <div className="text-right">
                  <h4 className="font-bold text-mushaf-dark text-lg mb-1 group-hover:text-mushaf-teal transition">
                    {book.name}
                  </h4>
                  <p className="text-xs text-gray-500">{book.count}</p>
                </div>
              </div>

              <ChevronLeft className="text-mushaf-gold opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition" />
            </button>
          ))}

          {filteredBooks.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 font-bold border border-mushaf-border/30">
              لم يتم العثور على كتاب بهذا الاسم
            </div>
          )}
        </div>
      </section>

      {/* مودال الحديث */}
      {selectedHadith && !designOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-[#FEFCF8] rounded-t-[32px] sm:rounded-[32px] shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-mushaf-border/50 flex items-center justify-between gap-4 bg-white">
              <div>
                <p className="text-xs text-mushaf-gold font-bold mb-1">
                  {selectedHadith.collection}
                </p>
                <h2 className="font-bold text-xl text-mushaf-teal">
                  {selectedHadith.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeHadith}
                className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 sm:p-8">
              <div className="bg-white rounded-3xl border border-mushaf-border/40 shadow-sm p-6 sm:p-8">
                <p className="font-uthmani text-2xl leading-[2.2] text-mushaf-dark text-justify">
                  {selectedHadith.text}
                </p>

                <div className="mt-7 pt-5 border-t border-gray-100">
                  <p className="text-sm font-bold text-mushaf-teal">
                    الراوي: {selectedHadith.narrator}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedHadith.reference} • {selectedHadith.book}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-mushaf-border/50 bg-white grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={copyHadith}
                className="flex flex-col items-center gap-2 rounded-2xl bg-mushaf-paper py-3 text-blue-600 font-bold text-xs hover:bg-blue-50 transition"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  {copied ? <CheckCheck size={21} /> : <Copy size={21} />}
                </div>
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>

              <button
                type="button"
                onClick={shareHadith}
                className="flex flex-col items-center gap-2 rounded-2xl bg-mushaf-paper py-3 text-mushaf-teal font-bold text-xs hover:bg-mushaf-teal/5 transition"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <Share2 size={21} />
                </div>
                مشاركة
              </button>

              <button
                type="button"
                onClick={toggleBookmark}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-mushaf-paper py-3 font-bold text-xs transition ${
                  isBookmarked
                    ? 'text-white bg-mushaf-gold'
                    : 'text-mushaf-gold hover:bg-mushaf-gold/10'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                  <Bookmark size={21} fill={isBookmarked ? 'currentColor' : 'none'} />
                </div>
                {isBookmarked ? 'محفوظ' : 'حفظ'}
              </button>

              <button
                type="button"
                onClick={() => setDesignOpen(true)}
                className="flex flex-col items-center gap-2 rounded-2xl bg-mushaf-paper py-3 text-purple-600 font-bold text-xs hover:bg-purple-50 transition"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <ImageIcon size={21} />
                </div>
                كصورة
              </button>

              <button
                type="button"
                onClick={closeHadith}
                className="flex flex-col items-center gap-2 rounded-2xl bg-mushaf-paper py-3 text-gray-500 font-bold text-xs hover:bg-gray-100 transition"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <X size={21} />
                </div>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تصميم الحديث */}
      {selectedHadith && designOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-2xl flex items-center justify-between mb-4">
              <div className="text-white">
                <p className="font-bold">تصميم الحديث</p>
                <p className="text-white/55 text-xs mt-1">
                  جاهز للمشاركة والتحميل
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDesignOpen(false)}
                className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-red-500 transition"
                aria-label="إغلاق التصميم"
              >
                <X size={22} />
              </button>
            </div>

            <div className="w-full max-w-2xl rounded-[32px] overflow-hidden border border-mushaf-gold/50 shadow-2xl bg-gradient-to-br from-[#175E67] to-[#0D383E] text-white">
              <div className="p-7 sm:p-10 relative">
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-mushaf-gold/10 blur-3xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <p className="font-bold text-mushaf-gold text-sm">
                        مصحف سَميع
                      </p>
                      <p className="text-white/50 text-[10px] mt-1">
                        الأحاديث النبوية
                      </p>
                    </div>

                    <div className="w-12 h-12 rounded-full border border-mushaf-gold/60 bg-white/10 flex items-center justify-center">
                      <BookOpen size={20} className="text-mushaf-gold" />
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/10 text-mushaf-gold text-xs font-bold">
                      {selectedHadith.collection}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-2xl sm:text-3xl text-center mt-7 leading-[1.7]">
                    {selectedHadith.title}
                  </h3>

                  <div className="my-8 h-px bg-white/10" />

                  <p className="font-uthmani text-white text-2xl sm:text-[28px] leading-[2.2] text-justify">
                    {selectedHadith.text}
                  </p>

                  <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-mushaf-gold text-sm font-bold">
                      الراوي: {selectedHadith.narrator}
                    </p>
                    <p className="text-white/60 text-xs mt-2">
                      {selectedHadith.reference} • {selectedHadith.book}
                    </p>
                  </div>

                  <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-center">
                    <p className="font-bold text-white text-sm">
                      مصحف سَميع • الأحاديث النبوية
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={downloadDesign}
              disabled={isDownloading}
              className="mt-5 w-full max-w-2xl bg-mushaf-gold text-white rounded-2xl py-4 px-6 font-bold flex items-center justify-center gap-3 shadow-xl hover:scale-[1.01] transition disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <Download size={21} />
              )}
              {isDownloading ? 'جاري إنشاء الصورة...' : 'تحميل التصميم'}
            </button>

            <button
              type="button"
              onClick={() => setDesignOpen(false)}
              className="mt-3 text-white/65 text-sm hover:text-white transition"
            >
              العودة إلى الحديث
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
