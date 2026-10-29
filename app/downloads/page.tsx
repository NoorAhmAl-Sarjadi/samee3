import Link from 'next/link'
import AppDownloadsCard from '@/components/AppDownloadsCard'

export const metadata = { title: 'تحميل تطبيق مصحف سميع لأندرويد وويندوز والماك' }

export default function DownloadsPage() {
  return <main dir="rtl" className="min-h-screen bg-[var(--bg-main)] px-4 pb-32 pt-7"><div className="mx-auto max-w-3xl">
    <Link href="/" className="text-sm font-bold text-[#194f43]">→ العودة للرئيسية</Link>
    <header className="my-6"><h1 className="text-2xl font-extrabold text-[#194f43]">سميع معك على أجهزتك</h1><p className="mt-2 text-sm leading-7 text-slate-600">حمّل النسخة المناسبة لجهازك، واحتفظ بالقرآن بالقرب منك.</p></header>
    <AppDownloadsCard detailed />
  </div></main>
}