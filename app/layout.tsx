import ‘./globals.css’
import type { Metadata, Viewport } from ‘next’
import { AuthProvider } from ‘@/context/AuthContext’
import BottomNav from ‘@/components/BottomNav’
import ServiceWorkerRegistration from ‘@/components/ServiceWorkerRegistration’

export const metadata: Metadata = {
title: {
default: ‘مصحف سميع’,
template: ‘%s | مصحف سميع’,
},
description:
‘موقع ومنصة سميع القرآنية الشاملة. استمع وحمل القرآن الكريم بصوت جميع قراء العالم الإسلامي.’,
applicationName: ‘مصحف سميع’,
manifest: ‘/manifest.json’,
icons: {
icon: ‘/icon.svg’,
shortcut: ‘/icon.svg’,
apple: ‘/icon.svg’,
},
appleWebApp: {
capable: true,
statusBarStyle: ‘default’,
title: ‘مصحف سميع’,
},
formatDetection: {
telephone: false,
},
}

export const viewport: Viewport = {
themeColor: ‘#0284C7’,
width: ‘device-width’,
initialScale: 1,
viewportFit: ‘cover’,
}

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode
}>) {
return (
{children}
)
}