import Link from 'next/link'
import reminders from '@/native/shared/reminders.json'

export const metadata = { title: 'حديث التذكير' }

export default async function ReminderHadithPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  const hadith = reminders.hadiths.find((item) => item.id === id)
  return <main dir="rtl" className="min-h-screen bg-[var(--bg-main)] px-4 pb-32 pt-8"><article className="mx-auto max-w-3xl rounded-3xl border border-[#ddd1b9] bg-white p-6 shadow-sm">
    <Link href="/hadith" className="text-sm font-bold text-[#194f43]">← مكتبة الحديث</Link>
    <h1 className="mt-5 text-xl font-extrabold text-[#194f43]">حديث تقرؤه اليوم</h1>
    {hadith ? <><p className="mt-6 whitespace-pre-wrap font-uthmani text-2xl leading-[2.5] text-slate-800">{hadith.text}</p><p className="mt-5 text-sm font-bold text-[#8a642d]">{hadith.reference}</p><p className="mt-2 text-xs leading-6 text-slate-500">متن الحديث بالعربية. الترقيم بحسب المصدر المرتبط، وقد يختلف بين الطبعات.</p><a href={hadith.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#ddd1b9] px-4 text-sm font-bold text-[#194f43]">فتح المصدر والسند</a></> : <p className="mt-5 text-sm leading-7">هذا التذكير غير متاح. يمكنك قراءة الأحاديث من مكتبة الحديث.</p>}
    <Link href="/notifications" className="mt-6 block text-sm font-bold text-[#194f43]">تعديل مواعيد تذكير الحديث</Link>
  </article></main>
}
