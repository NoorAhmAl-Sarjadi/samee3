'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  BookOpen,
  Heart,
  List,
  ChevronUp,
  ChevronDown,
  User,
} from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()
  const [mushafNavOpen, setMushafNavOpen] = useState(false)

  const isMushafPage = pathname === '/mushaf'

  useEffect(() => {
    setMushafNavOpen(!isMushafPage)
  }, [isMushafPage])

  const navItems = isMushafPage
    ? [
        { label: 'الرئيسية', icon: Home, href: '/' },
        { label: 'المصحف', icon: BookOpen, href: '/mushaf' },
        { label: 'الأذكار', icon: Heart, href: '/adhkar' },
        { label: 'الفهرس', icon: List, href: '/surahs' },
      ]
    : [
        { label: 'الرئيسية', icon: Home, href: '/' },
        { label: 'المصحف', icon: BookOpen, href: '/mushaf' },
        { label: 'الأذكار', icon: Heart, href: '/adhkar' },
        { label: 'الحساب', icon: User, href: '/profile' },
        { label: 'الفهرس', icon: List, href: '/surahs' },
      ]

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  if (isMushafPage && !mushafNavOpen) {
    return (
      <button
        type="button"
        onClick={() => setMushafNavOpen(true)}
        aria-label="إظهار شريط التنقل"
        className="fixed bottom-0 left-1/2 z-[90] flex h-5 w-24 -translate-x-1/2 items-center justify-center rounded-t-full border border-b-0 border-[rgba(14,165,233,0.45)] bg-white/95 shadow-[0_-4px_20px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-all duration-300 hover:h-6 active:scale-95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ChevronUp size={14} strokeWidth={2.5} className="text-[var(--royal-blue)]" />
      </button>
    )
  }

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-3 left-1/2 z-[90] w-[calc(100%-20px)] max-w-[620px] -translate-x-1/2 rounded-[24px] border border-[rgba(14,165,233,0.28)] bg-white/95 shadow-[0_10px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {isMushafPage && (
        <button
          type="button"
          onClick={() => setMushafNavOpen(false)}
          aria-label="إخفاء شريط التنقل"
          className="absolute -top-4 left-1/2 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-t-xl border border-b-0 border-[rgba(14,165,233,0.40)] bg-white shadow-[0_-3px_12px_rgba(15,23,42,0.07)] transition-transform duration-200 active:scale-95"
        >
          <ChevronDown size={14} strokeWidth={2.5} className="text-[var(--royal-blue)]" />
        </button>
      )}

      <div className="flex h-[70px] items-stretch px-1.5 sm:px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isActiveRoute(item.href)

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (isMushafPage) setMushafNavOpen(false)
              }}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] transition-all duration-200 active:scale-95"
            >
              {isActive && (
                <span aria-hidden="true" className="absolute top-0 h-1 w-10 rounded-b-full bg-[var(--royal-blue)] shadow-[0_3px_10px_rgba(2,132,199,0.28)]" />
              )}

              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${isActive ? 'bg-[rgba(2,132,199,0.10)]' : 'bg-transparent'}`}
              >
                <Icon
                  size={23}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-colors duration-200 ${isActive ? 'text-[var(--royal-blue)]' : 'text-slate-400'}`}
                />
              </span>

              <span
                className={`mt-0.5 whitespace-nowrap text-[11px] font-bold leading-none transition-colors duration-200 ${isActive ? 'text-[var(--royal-blue)]' : 'text-slate-400'}`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}