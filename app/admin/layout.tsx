'use client'

import type { ReactNode } from 'react'
import Samee3ViewportGuard from '@/components/mobile/Samee3ViewportGuard'

// Covers both /admin (including Islamic Library forms) and /admin/messages.
// Auth checks stay inside the existing AdminGate in each page.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Samee3ViewportGuard scope="admin">{children}</Samee3ViewportGuard>
}