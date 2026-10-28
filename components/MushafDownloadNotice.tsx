'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { RIWAYAT, type RiwayaId } from '@/lib/quran/Samee3DataAdapter'
import { currentMushafReading, DOWNLOADS_CHANGED, inspectMushafDownloads, TOTAL_MUSHAF_PAGES } from '@/lib/quran/mushaf-downloads'

type Notice = { riwaya: RiwayaId; count: number }
const dismissed = new Set<RiwayaId>()

export default function MushafDownloadNotice() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedReading = searchParams.get('riwaya')
  const [notice, setNotice] = useState<Notice | null>(null)
  const request = useRef(0)
  const hidden = /^\/(auth|admin|messages)(\/|$)/.test(pathname)

  useEffect(() => {
    let alive = true
    let scheduled: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(scheduled)
      scheduled = setTimeout(() => { void check() }, 150)
    }
    const check = async () => {
      const id = ++request.current
      if (hidden) { setNotice(null); return }
      const riwaya = currentMushafReading()
      const summary = await inspectMushafDownloads()
      if (!alive || id !== request.current) return
      const count = summary.completed[riwaya].size
      let deferred = dismissed.has(riwaya)
      try { deferred ||= sessionStorage.getItem(`samee3_download_notice_v1:${riwaya}`) === 'later' } catch {}
      setNotice(summary.supported && count < TOTAL_MUSHAF_PAGES && !deferred ? { riwaya, count } : null)
    }
    const visibility = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    window.addEventListener(DOWNLOADS_CHANGED, refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive = false
      request.current += 1
      clearTimeout(scheduled)
      window.removeEventListener(DOWNLOADS_CHANGED, refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [pathname, hidden, selectedReading])

  const defer = () => {
    if (!notice) return
    dismissed.add(notice.riwaya)
    try { sessionStorage.setItem(`samee3_download_notice_v1:${notice.riwaya}`, 'later') } catch {}
    setNotice(null)
  }
  if (!notice) return null
  const label = RIWAYAT.find((item) => item.id === notice.riwaya)?.label
  return (
    <aside dir="rtl" aria-label="تنبيه تنزيل صفحات المصحف" role="status"
      className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+12px)] z-[150] mx-auto max-w-md rounded-3xl border border-[#d9bd88] bg-[#fffdf6] p-4 text-[#194b50] shadow-xl sm:left-auto sm:mx-0 sm:w-[380px]">
      <div className="flex items-start gap-3">
        <Download size={22} className="mt-1 shrink-0 text-[#a37a39]" aria-hidden />
        <div className="flex-1">
          <strong className="block text-sm">جهّز مصحفك للقراءة دون إنترنت</strong>
          <p className="mt-1 text-xs leading-6 text-slate-600">{label} · {notice.count
            ? `محفوظ ${notice.count.toLocaleString('ar-EG')} من ٦٠٤ صفحات؛ استكمل الناقص.`
            : 'نزّل الصفحات مرة واحدة لتفتحها وقتما تحتاج.'}</p>
        </div>
        <button type="button" onClick={defer} aria-label="تأجيل تنبيه تنزيل المصحف" className="rounded-lg p-1.5"><X size={17} /></button>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { const riwaya = notice.riwaya; defer(); router.push(`/mushaf?riwaya=${riwaya}&download=1`) }}
          className="flex-1 rounded-xl bg-[#194f53] px-3 py-2.5 text-xs font-bold text-white">{notice.count ? 'استكمال تنزيل الصفحات' : 'تنزيل صفحات المصحف'}</button>
        <button type="button" onClick={defer} className="rounded-xl border border-[#ddcfb3] px-4 py-2.5 text-xs font-bold">لاحقًا</button>
      </div>
    </aside>
  )
}