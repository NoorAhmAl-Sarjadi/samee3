'use client'

import Link from 'next/link'

export default function AudioError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <main
      dir="rtl"
      className="flex min-h-[75vh] items-center justify-center bg-mushaf-paper px-5"
    >
      <section className="w-full max-w-md rounded-3xl border border-mushaf-gold/25 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-black text-mushaf-dark">
          تعذر عرض المكتبة الصوتية
        </h1>

        <p className="mt-3 text-sm leading-7 text-gray-500">
          حاول فتح المكتبة مرة أخرى. التسجيلات المحفوظة على
          جهازك تظل موجودة.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-2xl bg-mushaf-teal px-5 py-3 font-bold text-white"
        >
          إعادة فتح المكتبة
        </button>

        <Link
          href="/"
          className="mt-4 inline-block text-sm font-bold text-mushaf-teal"
        >
          العودة للرئيسية
        </Link>
      </section>
    </main>
  )
}