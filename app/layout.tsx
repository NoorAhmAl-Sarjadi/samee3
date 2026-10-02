// app/layout.tsx

import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

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
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
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
  children: ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <main className="min-h-screen">{children}</main>
          <BottomNav />
          <ServiceWorkerRegistration />
        </AuthProvider>
      </body>
    </html>
  )
}
