'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Heart, User, List } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { label: 'الرئيسية', icon: Home, href: '/' },
    { label: 'المصحف', icon: BookOpen, href: '/mushaf' },
    // الرابط هنا بقى quran-index
    { label: 'الفهرس', icon: List, href: '/quran-index' },
    { label: 'الأذكار', icon: Heart, href: '/adhkar' },
    { label: 'حسابي', icon: User, href: '/profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-mushaf-border/50 pb-safe z-50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center px-2 sm:px-6 h-20 relative">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href
          
          return (
            <Link 
              key={index} 
              href={item.href}
              className="relative flex flex-col items-center justify-center w-full h-full group"
            >
              {isActive && (
                <div className="absolute -top-4 w-12 h-1 bg-mushaf-teal rounded-b-lg shadow-[0_4px_10px_rgba(23,94,103,0.5)]"></div>
              )}
              
              <div className={`transition-all duration-300 transform ${isActive ? '-translate-y-2' : 'group-hover:-translate-y-1'}`}>
                <item.icon 
                  size={26} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-colors duration-300 ${isActive ? 'text-mushaf-teal drop-shadow-md' : 'text-gray-400 group-hover:text-mushaf-gold'}`} 
                />
              </div>
              
              <span className={`text-[11px] font-bold mt-1 transition-all duration-300 ${isActive ? 'text-mushaf-teal opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-mushaf-gold absolute bottom-2'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
