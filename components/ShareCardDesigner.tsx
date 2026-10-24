'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ImageIcon, Loader2, Share2, X } from 'lucide-react'
import Modal from '@/components/Modal'
import { CARD_PALETTES, DEFAULT_CARD_OPTIONS, cardBlob, downloadBlob, prepareCardPages, renderCard, type CardContent, type CardOptions, type CardPage } from '@/lib/share-card'

export default function ShareCardDesigner({ content, onClose }: { content: CardContent; onClose: () => void }) {
  const [options, setOptions] = useState<CardOptions>({ ...DEFAULT_CARD_OPTIONS })
  const [pages, setPages] = useState<CardPage[]>([])
  const [page, setPage] = useState(0)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState('image/png')
  const [secondary, setSecondary] = useState(!!content.secondary)
  const exportLock = useRef(false)
  const signature = JSON.stringify(content)
  const update = <K extends keyof CardOptions>(key: K, value: CardOptions[K]) => setOptions((old) => ({ ...old, [key]: value }))
  useEffect(() => {
    let alive = true
    setPreparing(true); setError(''); setPages([])
    const timer = window.setTimeout(() => {
      void prepareCardPages({ ...content, secondary: secondary ? content.secondary : undefined }, options).then((next) => { if (alive) { setPages(next); setPage(0) } }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : 'تعذر إعداد التصميم.') }).finally(() => { if (alive) setPreparing(false) })
    }, 180)
    return () => { alive = false; window.clearTimeout(timer) }
  // content is keyed by its exact scripture and reference, not parent render identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, options, secondary])
  useEffect(() => {
    let alive = true, url = ''
    if (!pages[page] || preparing) { setPreview(''); return }
    void cardBlob(renderCard(pages[page], options, page, pages.length)).then((blob) => { if (alive) { url = URL.createObjectURL(blob); setPreview(url) } }).catch(() => { if (alive) setError('تعذرت معاينة التصميم. أعد المحاولة.') })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [pages, page, options, preparing])
  const save = async (share = false) => {
    if (exportLock.current || preparing || !pages.length) return
    exportLock.current = true; setBusy(true); setError('')
    try {
      const extension = type === 'image/png' ? 'png' : 'jpg'
      if (share) {
        const blob = await cardBlob(renderCard(pages[page], options, page, pages.length), type)
        const file = new File([blob], `samee3-${content.kind}-${page + 1}.${extension}`, { type })
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: content.title }); return }
        downloadBlob(blob, file.name); return
      }
      if (pages.length === 1) downloadBlob(await cardBlob(renderCard(pages[0], options, 0, 1), type), `samee3-${content.kind}.${extension}`)
      else {
        const JSZip = (await import('jszip')).default, zip = new JSZip()
        for (let i = 0; i < pages.length; i++) zip.file(`samee3-${content.kind}-${String(i + 1).padStart(2, '0')}.${extension}`, await cardBlob(renderCard(pages[i], options, i, pages.length), type))
        downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `samee3-${content.kind}.zip`)
      }
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'تعذر حفظ التصميم.') }
    finally { exportLock.current = false; setBusy(false) }
  }
  const field = 'mt-1 w-full rounded-xl border border-[#ded7c9] bg-white px-3 py-2 text-sm'
  return <Modal title="استوديو بطاقات سميع" onClose={() => { if (!exportLock.current) onClose() }} wide>
    <header className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs text-[#a47a3e]">مشاركة تليق بالكلمة</p><h2 className="text-xl font-black">استوديو بطاقات سميع</h2></div><button type="button" disabled={busy} onClick={onClose} aria-label="إغلاق الاستوديو" className="rounded-xl bg-white p-3"><X size={20} /></button></header>
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <fieldset disabled={busy} className="space-y-4"><legend className="sr-only">خيارات التصميم</legend>
          <div className="grid grid-cols-3 gap-2">{Object.entries(CARD_PALETTES).map(([id, palette]) => <button type="button" key={id} aria-pressed={options.theme === id} onClick={() => update('theme', id as CardOptions['theme'])} className={`rounded-xl border-2 p-2 text-xs font-bold ${options.theme === id ? 'border-[#ab8145]' : 'border-transparent'}`}><span className="mb-2 block h-9 rounded-lg border border-black/10" style={{ background: palette.bg }} />{palette.name}</button>)}</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold">القالب<select className={field} value={options.template} onChange={(e) => update('template', e.target.value as CardOptions['template'])}><option value="editorial">صفحة أنيقة</option><option value="frame">إطار كلاسيكي</option><option value="minimal">بسيط</option></select></label>
            <label className="text-xs font-bold">المقاس<select className={field} value={options.format} onChange={(e) => update('format', e.target.value as CardOptions['format'])}><option value="auto">تلقائي للنص</option><option value="square">مربع 1080×1080</option><option value="portrait">منشور 1080×1350</option><option value="story">قصة 1080×1920</option></select></label>
            <label className="text-xs font-bold">الخط<select className={field} value={options.font} onChange={(e) => update('font', e.target.value as CardOptions['font'])}><option value="Amiri">أميري</option><option value="Tajawal">تجوال</option></select></label>
            <label className="text-xs font-bold">المحاذاة<select className={field} value={options.align} onChange={(e) => update('align', e.target.value as CardOptions['align'])}><option value="center">في المنتصف</option><option value="right">إلى اليمين</option></select></label>
            <label className="text-xs font-bold">نوع الملف<select className={field} value={type} onChange={(e) => setType(e.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></label>
            <label className="text-xs font-bold">الهوامش<select className={field} value={options.margin} onChange={(e) => update('margin', Number(e.target.value))}><option value={68}>ضيقة</option><option value={88}>متوازنة</option><option value={116}>واسعة</option></select></label>
          </div>
          <label className="block text-xs font-bold">حجم الخط: {options.fontSize}<input aria-label="حجم خط البطاقة" type="range" min={32} max={64} step={2} value={options.fontSize} onChange={(e) => update('fontSize', Number(e.target.value))} className="mt-3 w-full accent-[#a47a3e]" /></label>
          <label className="block text-xs font-bold">توقيع اختياري<input className={field} maxLength={45} value={options.signature} onChange={(e) => update('signature', e.target.value)} placeholder="اسمك أو اسم صفحتك" /></label>
          <div className="flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={options.border} onChange={(e) => update('border', e.target.checked)} /> إطار</label><label><input type="checkbox" checked={options.showBrand} onChange={(e) => update('showBrand', e.target.checked)} /> اسم سميع</label>{content.secondary && <label><input type="checkbox" checked={secondary} onChange={(e) => setSecondary(e.target.checked)} /> تضمين التفسير</label>}</div>
        </fieldset>
        <p className="text-xs leading-6 text-slate-500">النص الطويل يُوزَّع على بطاقات متتابعة ويُحفظ كاملًا في ملف ZIP. نص الآية يبقى بخط القرآن.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex gap-2"><button type="button" disabled={busy || preparing || !pages.length} onClick={() => void save()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1b5659] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}حفظ {pages.length > 1 ? 'كل البطاقات' : 'الصورة'}</button><button type="button" disabled={busy || preparing || !pages.length} onClick={() => void save(true)} className="flex items-center gap-2 rounded-xl border border-[#b59b6b] px-3 py-3 text-sm font-bold disabled:opacity-50"><Share2 size={18} />مشاركة الحالية</button></div>
      </div>
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-[#e9e4d9] p-3">
        {preparing ? <Loader2 className="animate-spin" /> : preview ? <img alt={`معاينة البطاقة ${page + 1} من ${pages.length}`} src={preview} className="max-h-[62dvh] w-full rounded-lg object-contain" /> : <ImageIcon size={36} />}
        {pages.length > 1 && <nav aria-label="بطاقات التصميم" className="mt-3 flex items-center gap-4"><button type="button" disabled={page === 0 || busy} onClick={() => setPage((p) => p - 1)} aria-label="البطاقة السابقة"><ChevronRight /></button><span className="text-xs">{page + 1} / {pages.length}</span><button type="button" disabled={page === pages.length - 1 || busy} onClick={() => setPage((p) => p + 1)} aria-label="البطاقة التالية"><ChevronLeft /></button></nav>}
      </div>
    </div>
  </Modal>
}
