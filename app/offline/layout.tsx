
'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  Info,
  ClipboardCheck,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react'

/**
 * SAMEE3 — Offline section layout
 * Path: app/offline/layout.tsx
 *
 * شريط تنقل موحد يظهر تلقائيًا في الصفحات:
 * /offline
 * /offline/manage
 * /offline/test
 *
 * للعرض والتنقل فقط؛ لا يقرأ أو يعدل Cache Storage أو IndexedDB.
 */

const SECTIONS = [
  {
    href: '/offline',
    label: 'التنزيلات',
    icon: BookOpen,
  },
  {
    href: '/offline/manage',
    label: 'إدارة التنزيلات',
    icon: Database,
  },
  {
    href: '/offline/test',
    label: 'اختبار الجاهزية',
    icon: ClipboardCheck,
  },
] as const

type ConnectionState = 'checking' | 'online' | 'offline'

function normalizePath(path: string | null): string {
  if (!path) return '/offline'
  return path.replace(/\/+$/, '') || '/'
}

function selectedPath(current: string, target: string): boolean {
  if (target === '/offline') {
    return current === '/offline'
  }

  return current === target || current.startsWith(`${target}/`)
}

export default function OfflineLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname()
  const currentPath = normalizePath(pathname)

  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [hasController, setHasController] = useState<boolean | null>(null)

  useEffect(() => {
    const refreshConnection = () => {
      setConnection(navigator.onLine ? 'online' : 'offline')
    }

    const refreshController = () => {
      setHasController(
        'serviceWorker' in navigator &&
          Boolean(navigator.serviceWorker.controller),
      )
    }

    refreshConnection()
    refreshController()

    window.addEventListener('online', refreshConnection)
    window.addEventListener('offline', refreshConnection)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        refreshController,
      )
    }

    return () => {
      window.removeEventListener('online', refreshConnection)
      window.removeEventListener('offline', refreshConnection)

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          refreshController,
        )
      }
    }
  }, [])

  return (
    <div dir="rtl" className="bg-[#f4f9fe]">
      <div className="relative z-10 border-b border-[#dce7ed] bg-white/95 shadow-sm">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#103e52] text-[#ebd3a4]">
                <BookOpen size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-[#214558]">
                  مركز التنزيلات
                </p>
                <p className="text-[10px] font-semibold text-[#a27c45]">
                  مصحف سميع
                </p>
              </div>
            </div>

            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${
                connection === 'offline'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : connection === 'online'
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              {connection === 'offline' ? (
                <WifiOff size={13} aria-hidden="true" />
              ) : (
                <Wifi size={13} aria-hidden="true" />
              )}
              {connection === 'offline'
                ? 'غير متصل بالشبكة'
                : connection === 'online'
                  ? 'الجهاز متصل بالشبكة'
                  : 'جارٍ فحص الاتصال'}
            </span>
          </div>

          <nav aria-label="أقسام التنزيلات دون إنترنت" className="grid grid-cols-3 gap-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const selected = selectedPath(currentPath, section.href)

              return (
                <Link
                  key={section.href}
                  href={section.href}
                  prefetch={false}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2.5 text-center transition-colors sm:flex-row sm:gap-2 sm:px-3 ${
                    selected
                      ? 'border-[#d3b27d] bg-[#fff8ec] text-[#77521c] shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#d3b27d] hover:bg-[#fffaf3]'
                  }`}
                >
                  <Icon
                    size={17}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span className="truncate text-[11px] font-extrabold sm:text-sm">
                    {section.label}
                  </span>
                </Link>
              )
            })}
          </nav>

          {connection === 'offline' && (
            <p
              role="status"
              className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff8e9] px-3 py-2 text-xs leading-5 text-[#856020]"
            >
              <WifiOff size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              يمكن استخدام المحتوى المحفوظ فقط. بعض الصفحات قد تحتاج إلى اتصال لتعمل.
            </p>
          )}

          {hasController === false && connection !== 'checking' && (
            <p className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              خدمة العمل دون إنترنت لا تتحكم في هذه الصفحة حاليًا؛ اختبر الجاهزية قبل الاعتماد على الملفات المحفوظة.
            </p>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}
