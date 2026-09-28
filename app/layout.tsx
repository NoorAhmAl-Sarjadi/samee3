import './globals.css'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/context/AuthContext'
import BottomNav from '@/components/BottomNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: {
    default: 'مصحف سميع',
    template: '%s | مصحف سميع',
  },
  description:
    'موقع ومنصة سميع القرآنية الشاملة. استمع وحمل القرآن الكريم بصوت جميع قراء العالم الإسلامي.',
  applicationName: 'مصحف سميع',
  manifest: '/manifest.json',

  icons: {
    icon: [
      {
        url: 'https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: 'https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png',
        type: 'image/png',
      },
    ],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'مصحف سميع',
  },

  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0284C7',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] antialiased">
        <AuthProvider>
          <ServiceWorkerRegistration />

          <main className="min-h-screen">{children}</main>

          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}