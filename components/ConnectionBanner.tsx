'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WifiOff } from 'lucide-react'

/** Nonintrusive connectivity feedback shared by every section. */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const check = () => setOffline(navigator.onLine === false)
    check()
    window.addEventListener('offline', check)
    window.addEventListener('online', check)
    return () => {
      window.removeEventListener('offline', check)
      window.removeEventListener('online', check)
    }
  }, [])
  if (!offline) return null
  return (
    <div role="status" aria-live="polite" dir="rtl" className="fixed z-[80] right-3 left-3 sm:left-auto sm:max-w-sm bottom-[calc(env(safe-area-inset-bottom)+5.8rem)]">
      <div className="flex items-center gap-3 rounded-2xl bg-[#183b39] text-white px-4 py-3 shadow-xl border border-white/15">
        <WifiOff size={18} className="shrink-0 text-amber-300" aria-hidden />
        <span className="text-xs leading-5 font-bold flex-1">أنت الآن دون إنترنت. سيعمل المحتوى المحفوظ على جهازك فقط.</span>
        <Link href="/offline" className="shrink-0 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-black">ملفاتي</Link>
      </div>
    </div>
  )
}
