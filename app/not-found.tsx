import Link from 'next/link'
import { BookOpen, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <main dir="rtl" className="min-h-[72vh] flex items-center justify-center bg-mushaf-paper px-5 pb-28">
      <section className="w-full max-w-xl text-center rounded-[30px] bg-white border border-mushaf-gold/20 p-10 shadow-sm">
        <div className="mx-auto w-16 h-16 rounded-3xl flex items-center justify-center bg-mushaf-teal/10 text-mushaf-teal"><BookOpen size={29}/></div>
        <h1 className="mt-6 text-2xl font-black text-mushaf-teal">الصفحة غير متاحة</h1>
        <p className="mt-3 text-sm text-gray-500 leading-7">قد يكون الرابط قد تغير. يمكنك الرجوع للرئيسية أو فتح المصحف مباشرةً.</p>
        <div className="mt-6 flex justify-center flex-wrap gap-2">
          <Link href="/" className="rounded-xl px-5 py-3 bg-mushaf-teal text-white text-sm font-black inline-flex gap-2 items-center"><Home size={16}/> الرئيسية</Link>
          <Link href="/mushaf" className="rounded-xl px-5 py-3 border border-mushaf-gold/30 text-mushaf-teal text-sm font-black inline-flex gap-2 items-center"><BookOpen size={16}/> المصحف</Link>
        </div>
      </section>
    </main>
  )
}
