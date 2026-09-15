
'use client'

import Link from 'next/link'
import { Home, List, BookOpen, Heart, PlayCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { name: 'الرئيسية', href: '/', icon: Home },
    { name: 'الفهرس', href: '/index', icon: List },
    { name: 'الأحاديث', href: '/hadith', icon: BookOpen },
    { name: 'الأذكار', href: '/adhkar', icon: Heart },
  ]

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-mushaf-paper border-t-2 border-mushaf-border rounded-t-3xl shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-50">
      <div className="flex justify-between items-center px-6 py-3 max-w-md mx-auto">
        
        <div className="flex w-full justify-between items-center pr-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <Link key={item.name} href={item.href} className="flex flex-col items-center gap-1">
                <Icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className={`${isActive ? 'text-mushaf-teal' : 'text-mushaf-gold'} transition-colors`} 
                />
                <span className={`text-[10px] font-bold ${isActive ? 'text-mushaf-teal' : 'text-mushaf-gold'}`}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>

        <div className="pl-2 border-r-2 border-mushaf-border/30 pr-4 h-10 flex items-center">
          <button className="bg-mushaf-teal text-white rounded-full p-1 shadow-lg hover:bg-mushaf-teal/90 transition-all">
            <PlayCircle size={36} strokeWidth={1.5} />
          </button>
        </div>

      </div>
    </nav>
  )
}
