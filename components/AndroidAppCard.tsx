'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, Download, RefreshCw, Share2, Smartphone, BookOpen } from 'lucide-react'
import { nativeRequest, useAndroidApp } from '@/lib/android-native'
import { parseAndroidRelease, type AndroidRelease } from '@/lib/android-release'

export default function AndroidAppCard() {
  const { status } = useAndroidApp()
  const [release, setRelease] = useState<AndroidRelease | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const load = () => {
      if (navigator.onLine === false) return
      void fetch('/android/release.json', { cache: 'no-store', signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((raw) => { if (!controller.signal.aborted) setRelease(parseAndroidRelease(raw)) }).catch(() => undefined)
    }
    const visible = () => { if (document.visibilityState === 'visible') load() }
    load(); const interval = window.setInterval(visible, 60_000)
    window.addEventListener('online', load); document.addEventListener('visibilitychange', visible)
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener('online', load); document.removeEventListener('visibilitychange', visible) }
  }, [])
  useEffect(() => { const show = (event: Event) => { const value = (event as CustomEvent<unknown>).detail; if (typeof value === 'string') setNotice(value) }; window.addEventListener('samee3:update-status', show); return () => window.removeEventListener('samee3:update-status', show) }, [])
  const update = Boolean(status && release && release.versionCode > status.versionCode)
  const current = Boolean(status && release && release.versionCode <= status.versionCode)
  const compatible = !status || !release || status.sdk >= release.minSdk
  const share = async () => {
    const url = 'https://samee3.vercel.app/'
    try {
      if (status) { await nativeRequest('share'); return }
      if (navigator.share) await navigator.share({ title: 'مصحف سميع', text: 'القرآن والأذكار والأحاديث ومواقيت الصلاة مع مصحف سميع', url })
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setNotice('تم نسخ رابط سميع للمشاركة.') }
      else setNotice(`رابط المشاركة: ${url}`)
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setNotice(`رابط المشاركة: ${url}`) }
  }
  return <section aria-label="تطبيق سميع لأندرويد" className="mb-6 overflow-hidden rounded-3xl border border-[#d9c39d] bg-gradient-to-br from-white to-[#f8f1e3] p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#194f43] text-[#f7d992]"><Smartphone size={25} /></span>
      <div className="min-w-0 flex-1"><h2 className="text-base font-extrabold text-[#194f43]">{update ? 'تحديث جديد لتطبيق سميع' : status ? 'سميع على هاتفك' : 'حمّل تطبيق سميع لأندرويد'}</h2>
        <p className="mt-1 text-xs leading-6 text-slate-600">{status ? `الإصدار المثبّت ${status.versionName} · تصميم سميع الأساسي مع إشعارات الهاتف وقارئ محلي.` : 'ملف APK للتثبيت على الهاتف، مع إشعارات الورد والأذكار والحديث وتنبيهات الصلاة.'}</p>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {release && !current && compatible ? <a href={release.apkPath} download onClick={(event) => {
        if (!status) return
        event.preventDefault(); void nativeRequest('download', { path: release.apkPath }).catch((error: Error) => setNotice(error.message))
      }} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#194f43] px-4 py-3 text-sm font-bold text-white"><Download size={18} />{update ? `تنزيل التحديث ${release.versionName}` : 'تحميل وتثبيت'}</a>
        : !status ? <span className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-500">نسخة التحديث قيد التجهيز</span> : null}
      {status && <Link href="/notifications" className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#194f43] px-3 py-3 text-sm font-bold text-white"><BellRing size={18} />{status.notificationsAllowed ? 'إعدادات التذكير' : 'تفعيل الإشعارات'}</Link>}
      <button type="button" onClick={() => void share()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d9c39d] bg-white px-4 py-3 text-sm font-bold text-[#194f43]"><Share2 size={17} />مشاركة</button>
    </div>
    {status && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[#194f43]">
      <button type="button" onClick={() => void nativeRequest('offline').catch((error: Error) => setNotice(error.message))} className="flex min-h-9 items-center gap-1"><BookOpen size={15} />المصحف المحفوظ داخل التطبيق</button>
      <button type="button" onClick={() => window.dispatchEvent(new Event('samee3:check-update'))} className="flex min-h-9 items-center gap-1"><RefreshCw size={15} />فحص تحديث المحتوى</button>
    </div>}
    {release && !current && <p className="mt-3 text-[11px] leading-6 text-slate-500">{(release.bytes / 1024 / 1024).toFixed(1)} ميجابايت · افتح ملف APK بعد التنزيل وأكمل موافقة أندرويد على التثبيت.</p>}
    {!compatible && <p role="status" className="mt-2 text-xs text-amber-800">الإصدار الجديد يحتاج نظام أندرويد أحدث من الموجود على هذا الهاتف.</p>}
    {notice && <p role="status" className="mt-2 break-words text-xs leading-6 text-[#194f43]">{notice}</p>}
  </section>
}
