import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Suspense, type ReactNode } from 'react'

import { AuthProvider } from '@/context/AuthContext'
import BottomNav from '@/components/BottomNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import ConnectionBanner from '@/components/ConnectionBanner'
import MushafDownloadNotice from '@/components/MushafDownloadNotice'
import AudioFocus from '@/components/AudioFocus'

export const metadata: Metadata = {
  title: {
    default: 'مصحف سميع',
    template: '%s | مصحف سميع',
  },

  description:
    'موقع ومنصة سميع القرآنية الشاملة. اقرأ القرآن الكريم بروايات متعددة، واستمع للتلاوات والأذكار، وتابع وردك واحفظ ما يتاح دون إنترنت.',

  applicationName: 'مصحف سميع',

  manifest: '/manifest.json',

  keywords: [
    'مصحف سميع',
    'القرآن الكريم',
    'مصحف',
    'قرآن',
    'قراء',
    'استماع القرآن',
    'تحميل القرآن',
  ],

  authors: [
    {
      name: 'مصحف سميع',
    },
  ],

  creator: 'مصحف سميع',
  publisher: 'مصحف سميع',

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],

    icon: [
      {
        url: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      },
    ],

    shortcut: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
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
  themeColor: '#8A642D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <div className="min-h-screen">
            <Suspense
              fallback={
                <div
                  dir="rtl"
                  className="flex min-h-screen items-center justify-center text-[#8a642d]"
                >
                  جارٍ فتح سميع…
                </div>
              }
            >
              {children}
            </Suspense>
          </div>

          <BottomNav />

          <ServiceWorkerRegistration />

          <ConnectionBanner />

          <Suspense fallback={null}>
            <MushafDownloadNotice />
          </Suspense>

          <AudioFocus />
        </AuthProvider>
      </body>
    </html>
  )
}