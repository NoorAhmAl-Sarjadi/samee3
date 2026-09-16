import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/context/AuthContext'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'مصحف سميع',
  description: 'تطبيق إسلامي متكامل للقرآن الكريم، الأذكار، الأحاديث، ومواقيت الصلاة',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-mushaf-paper text-mushaf-dark antialiased">
        <AuthProvider>
          <main className="min-h-screen">
            {children}
          </main>
          {/* شريط التنقل السفلي هيظهر في كل الصفحات */}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
