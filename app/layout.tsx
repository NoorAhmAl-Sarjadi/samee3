import './globals.css'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/context/AuthContext'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'مصحف سميع',
  description:
    'تطبيق إسلامي متكامل للقرآن الكريم، الأذكار، الأحاديث، ومواقيت الصلاة',
  manifest: '/manifest.json',
  icons: {
    icon: 'https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png',
    apple:
      'https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'مصحف سميع',
  },
}

export const viewport: Viewport = {
  themeColor: '#175E67',
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
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
