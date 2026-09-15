import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' })

export const metadata: Metadata = {
  title: 'مصحف سميع | SAMEE3',
  description: 'رفيقك اليومي مع القرآن الكريم',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-cairo bg-mushaf-paper text-mushaf-dark antialiased pb-20 md:pb-0`}>
        <main className="min-h-screen max-w-4xl mx-auto shadow-2xl bg-mushaf-paper relative overflow-hidden">
          {children}
        </main>
        
        <div className="md:hidden">
          <BottomNav />
        </div>
      </body>
    </html>
  )
}
