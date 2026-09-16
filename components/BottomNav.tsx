'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  BookOpen,
  Heart,
  User,
  List,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const [mushafNavOpen, setMushafNavOpen] = useState(false)

  const isMushafPage = pathname === '/mushaf'

  useEffect(() => {
    if (isMushafPage) {
      setMushafNavOpen(false)
    } else {
      setMushafNavOpen(true)
    }
  }, [isMushafPage])

  const navItems = [
    { label: 'الرئيسية', icon: Home, href: '/' },
    { label: 'المصحف', icon: BookOpen, href: '/mushaf' },
    { label: 'الفهرس', icon: List, href: '/surahs' },
    { label: 'الأذكار', icon: Heart, href: '/adhkar' },
    { label: 'حسابي', icon: User, href: '/profile' },
  ]

  if (isMushafPage && !mushafNavOpen) {
    return (
      <button
        type="button"
        onClick={() => setMushafNavOpen(true)}
        aria-label="إظهار شريط التنقل"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[90] w-24 h-4 rounded-t-full bg-white/95 backdrop-blur-md border border-b-0 border-mushaf-border/60 shadow-[0_-4px_20px_rgba(0,0,0,0.10)] flex items-center justify-center transition-all duration-300 hover:h-5"
      >
        <ChevronUp size={14} className="text-mushaf-teal" />
      </button>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-[90] bg-white/95 backdrop-blur-md border-t border-mushaf-border/50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {isMushafPage && (
        <button
          type="button"
          onClick={() => setMushafNavOpen(false)}
          aria-label="إخفاء شريط التنقل"
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-5 rounded-t-xl bg-white border border-b-0 border-mushaf-border/60 shadow-[0_-3px_12px_rgba(0,0,0,0.06)] flex items-center justify-center"
        >
          <ChevronDown size={14} className="text-mushaf-teal" />
        </button>
      )}

      <div className="flex items-center justify-between px-1 sm:px-6 h-[78px]">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (isMushafPage) {
                  setMushafNavOpen(false)
                }
              }}
              className="relative flex flex-1 flex-col items-center justify-center h-full min-w-0"
            >
              {isActive && (
                <div className="absolute top-0 w-12 h-1 bg-mushaf-teal rounded-b-lg shadow-[0_4px_10px_rgba(23,94,103,0.35)]" />
              )}

              <div
                className={`flex items-center justify-center transition-all duration-300 ${
                  isActive ? '-translate-y-1' : ''
                }`}
              >
                <Icon
                  size={25}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-colors duration-300 ${
                    isActive
                      ? 'text-mushaf-teal drop-shadow-sm'
                      : 'text-gray-400'
                  }`}
                />
              </div>

              <span
                className={`mt-1 text-[11px] leading-tight font-bold whitespace-nowrap transition-all duration-300 ${
                  isActive
                    ? 'text-mushaf-teal opacity-100'
                    : 'text-gray-400 opacity-100'
                }`}
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
