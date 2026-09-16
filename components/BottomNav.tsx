'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Heart, User, List } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { label: 'الرئيسية', icon: Home, href: '/' },
    { label: 'المصحف', icon: BookOpen, href: '/mushaf' },
    { label: 'الفهرس', icon: List, href: '/quran-index' },
    { label: 'الأذكار', icon: Heart, href: '/adhkar' },
    { label: 'حسابي', icon: User, href: '/profile' },
  ]

  return (
    <nav
      className="
        fixed
        bottom-0
        left-0
        right-0
        w-full
        z-[100]
        bg-white
        border-t
        border-mushaf-border/50
        rounded-t-2xl
        shadow-[0_-4px_20px_rgba(0,0,0,0.06)]
      "
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
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
              className="
                relative
                flex
                flex-1
                flex-col
                items-center
                justify-center
                h-full
                min-w-0
              "
            >
              {/* الخط العلوي للعنصر النشط */}
              {isActive && (
                <div className="absolute top-0 w-12 h-1 bg-mushaf-teal rounded-b-lg shadow-[0_4px_10px_rgba(23,94,103,0.35)]" />
              )}

              {/* الأيقونة */}
              <div
                className={`
                  flex
                  items-center
                  justify-center
                  transition-all
                  duration-300
                  ${isActive ? '-translate-y-1' : ''}
                `}
              >
                <Icon
                  size={25}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`
                    transition-colors
                    duration-300
                    ${
                      isActive
                        ? 'text-mushaf-teal drop-shadow-sm'
                        : 'text-gray-400'
                    }
                  `}
                />
              </div>

              {/* الاسم */}
              <span
                className={`
                  mt-1
                  text-[11px]
                  leading-tight
                  font-bold
                  whitespace-nowrap
                  transition-all
                  duration-300
                  ${
                    isActive
                      ? 'text-mushaf-teal opacity-100'
                      : 'text-gray-400 opacity-100'
                  }
                `}
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
