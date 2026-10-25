'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download, ImageIcon, Loader2, Share2, X, Plus, Trash2, Save, RotateCcw, Undo2, Redo2 } from 'lucide-react'
import Modal from '@/components/Modal'
import { CARD_FONTS, CARD_PALETTES, DEFAULT_CARD_OPTIONS, cardTextStyle, cardBlob, downloadBlob, prepareCardPages, renderCard, type CardContent, type CardOptions, type CardPage, type CardBlock, type TextStyle, type CardFrame } from '@/lib/share-card'

export default function ShareCardDesigner({ content, onClose }: { content: CardContent; onClose: () => void }) {
  const [options, setOptions] = useState<CardOptions>(structuredClone(DEFAULT_CARD_OPTIONS))
  const [block, setBlock] = useState<CardBlock>('body')
  const [tab, setTab] = useState<'layout' | 'text' | 'frames'>('layout')
  const [presetNotice, setPresetNotice] = useState('')
  const [history, setHistory] = useState<CardOptions[]>([])
  const [future, setFuture] = useState<CardOptions[]>([])
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
  const commit = (next: CardOptions) => { setHistory((old) => [...old.slice(-29), options]); setFuture([]); setOptions(next) }
  const update = <K extends keyof CardOptions>(key: K, value: CardOptions[K]) => commit({ ...options, [key]: value })
  const updateStyle = <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => update('styles', { ...options.styles, [block]: { ...options.styles[block], [key]: value } })
  const currentStyle = cardTextStyle(options, block, content)
  const quranLocked = content.kind === 'ayah' && block === 'body'
  const sourceLocked = quranLocked && !!content.quranFont?.startsWith('Samee3-')
  const currentPalette = { ...CARD_PALETTES[options.theme], ...options.colors }
  const updateFrame = (index: number, patch: Partial<CardFrame>) => update('frames', options.frames.map((frame, i) => i === index ? { ...frame, ...patch } : frame))
  const presets = () => {
    try { localStorage.setItem('samee3_card_preset_v2', JSON.stringify(options)); setPresetNotice('تم حفظ تصميمك المفضل.') } catch { setPresetNotice('تعذر حفظ التصميم على هذا المتصفح.') }
  }
  const restore = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('samee3_card_preset_v2') || 'null')
      if (!raw || !Object.hasOwn(CARD_PALETTES, raw.theme) || !Array.isArray(raw.frames) || !raw.styles || !Number.isFinite(raw.fontSize)) throw new Error()
      commit({ ...structuredClone(DEFAULT_CARD_OPTIONS), ...raw }); setPresetNotice('تم تطبيق تصميمك المفضل.')
    } catch { setPresetNotice('لا يوجد تصميم مفضل محفوظ بعد.') }
  }
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
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" disabled={busy || !history.length} onClick={() => { const last = history[history.length - 1]; if (last) { setFuture((old) => [options, ...old]); setHistory((old) => old.slice(0, -1)); setOptions(last) } }} className="rounded-xl border bg-white p-2 disabled:opacity-30" aria-label="تراجع"><Undo2 size={17} /></button>
          <button type="button" disabled={busy || !future.length} onClick={() => { const next = future[0]; if (next) { setHistory((old) => [...old, options]); setFuture((old) => old.slice(1)); setOptions(next) } }} className="rounded-xl border bg-white p-2 disabled:opacity-30" aria-label="إعادة"><Redo2 size={17} /></button>
          <button type="button" disabled={busy} onClick={presets} className="flex items-center gap-1 rounded-xl border bg-white p-2"><Save size={15} />حفظ تفضيلاتي</button>
          <button type="button" disabled={busy} onClick={restore} className="rounded-xl border bg-white p-2">تطبيـق المفضل</button>
          <button type="button" disabled={busy} onClick={() => commit(structuredClone(DEFAULT_CARD_OPTIONS))} className="flex items-center gap-1 rounded-xl border bg-white p-2"><RotateCcw size={15} />افتراضي</button>
        </div>
        {presetNotice && <p role="status" className="text-xs text-[#92703e]">{presetNotice}</p>}
        <div role="tablist" aria-label="أدوات التصميم" className="flex rounded-2xl bg-[#e8e0d1] p-1">{([['layout','المقاس والألوان'],['text','الخطوط والنصوص'],['frames','الإطارات']] as const).map(([id,label]) => <button type="button" role="tab" aria-selected={tab===id} key={id} onClick={() => setTab(id)} className={`flex-1 rounded-xl p-2 text-xs font-bold ${tab===id?'bg-white shadow-sm':''}`}>{label}</button>)}</div>
        <fieldset disabled={busy} className="space-y-4"><legend className="sr-only">خيارات التصميم</legend>
          {tab === 'layout' && <>
            <div className="grid grid-cols-4 gap-2">{Object.entries(CARD_PALETTES).map(([id,palette]) => <button type="button" key={id} aria-pressed={options.theme===id} onClick={() => commit({ ...options, theme: id as CardOptions['theme'], colors: {} })} className={`rounded-xl border-2 p-2 text-xs font-bold ${options.theme===id?'border-[#ab8145]':'border-transparent'}`}><span className="mb-2 block h-8 rounded-lg border border-black/10" style={{ background: palette.bg }} />{palette.name}</button>)}</div>
            <div className="grid grid-cols-3 gap-2">{([['bg','الخلفية'],['paper','الورقة'],['accent','الزخارف']] as const).map(([key,label]) => <label key={key} className="text-xs font-bold">{label}<input aria-label={label} type="color" className="mt-2 h-10 w-full cursor-pointer rounded-lg" value={currentPalette[key]} onChange={(e) => update('colors',{...options.colors,[key]:e.target.value})} /></label>)}</div>
            <div className="grid grid-cols-2 gap-3">
              <Control label="القالب"><select className={field} value={options.template} onChange={(e) => update('template',e.target.value as CardOptions['template'])}><option value="editorial">صفحة أنيقة</option><option value="frame">كلاسيكي</option><option value="minimal">بسيط</option><option value="gradient">تدرج لوني</option></select></Control>
              <Control label="المقاس"><select className={field} value={options.format} onChange={(e) => update('format',e.target.value as CardOptions['format'])}><option value="auto">تلقائي للنص</option><option value="square">مربع 1080×1080</option><option value="portrait">منشور 1080×1350</option><option value="story">قصة 1080×1920</option></select></Control>
              <Control label="الزخرفة"><select className={field} value={options.pattern} onChange={(e) => update('pattern',e.target.value as CardOptions['pattern'])}><option value="none">بدون زخرفة</option><option value="dots">نقاط ناعمة</option><option value="diamonds">معينات هندسية</option></select></Control>
              <Control label="الموضع الرأسي"><select className={field} value={options.vertical} onChange={(e) => update('vertical',e.target.value as CardOptions['vertical'])}><option value="center">وسط البطاقة</option><option value="top">أعلى البطاقة</option></select></Control>
              <Control label="نوع الملف"><select className={field} value={type} onChange={(e) => setType(e.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></Control>
              <Control label="الهوامش"><input aria-label="هوامش البطاقة" type="range" min={68} max={150} value={options.margin} onChange={(e) => update('margin',Number(e.target.value))} className="mt-4 w-full" /></Control>
            </div>
          </>}
          {tab === 'text' && <>
            <Control label="اختر الجزء الذي تريد تنسيقه"><select className={field} value={block} onChange={(e) => setBlock(e.target.value as CardBlock)}><option value="title">العنوان</option><option value="body">النص الأساسي</option>{content.secondary && <><option value="secondaryTitle">عنوان التفسير</option><option value="secondary">نص التفسير</option></>}<option value="reference">المصدر والمرجع</option><option value="signature">التوقيع</option></select></Control>
            <div className="grid grid-cols-2 gap-3">
              <Control label="نوع الخط"><select disabled={sourceLocked} className={field} value={currentStyle.font} onChange={(e) => updateStyle('font',e.target.value)}>{sourceLocked ? <option value={currentStyle.font}>خط الرواية الأصلي</option> : CARD_FONTS.filter((font) => !quranLocked || font==='Amiri Quran' || font==='KFGQPC Uthmanic Script HAFS').map((font) => <option key={font} value={font}>{({'Amiri':'أميري','Tajawal':'تجوال','Aref Ruqaa':'عارف رقعة','Amiri Quran':'أميري قرآن','KFGQPC Uthmanic Script HAFS':'الرسم العثماني'})[font]}</option>)}</select></Control>
              <Control label="لون هذا الجزء"><input aria-label="لون النص المحدد" type="color" value={currentStyle.color} onChange={(e) => updateStyle('color',e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></Control>
              <Control label={`حجم الخط: ${currentStyle.size}`}><input aria-label="حجم النص المحدد" type="range" min={18} max={76} step={1} value={currentStyle.size} onChange={(e) => updateStyle('size',Number(e.target.value))} className="mt-4 w-full" /></Control>
              <Control label={`تباعد السطور: ${currentStyle.lineHeight.toFixed(2)}`}><input aria-label="تباعد السطور" type="range" min={1.5} max={2.8} step={.05} value={currentStyle.lineHeight} onChange={(e) => updateStyle('lineHeight',Number(e.target.value))} className="mt-4 w-full" /></Control>
              <Control label="المحاذاة"><select className={field} value={currentStyle.align} onChange={(e) => updateStyle('align',e.target.value as TextStyle['align'])}><option value="center">منتصف</option><option value="right">يمين</option><option value="left">يسار</option></select></Control>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={quranLocked} checked={currentStyle.bold} onChange={(e) => updateStyle('bold',e.target.checked)} />خط عريض</label>
            </div>
            {quranLocked && <p className="text-xs leading-6 text-[#937444]">يُعرض نص القرآن بخط يدعم رسمه الأصلي. اللون والحجم والمحاذاة قابلة للتخصيص.</p>}
            <button type="button" className="text-xs text-[#937444] underline" onClick={() => update('styles',{...options.styles,[block]:undefined})}>إعادة تنسيق هذا الجزء</button>
          </>}
          {tab === 'frames' && <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.border} onChange={(e) => update('border',e.target.checked)} />إظهار الإطارات</label>
            {!options.frames.length && <p className="text-xs leading-6 text-slate-500">يُستخدم إطار القالب. أضف إطارًا لتخصيصه، ويمكن تركيب ستة إطارات معًا.</p>}
            {options.frames.map((frame,i) => <div key={i} className="space-y-3 rounded-2xl border border-[#dfd4be] bg-white p-3"><div className="flex items-center justify-between"><strong className="text-xs">الإطار {i+1}</strong><button type="button" aria-label={`حذف الإطار ${i+1}`} onClick={() => update('frames',options.frames.filter((_,j)=>j!==i))}><Trash2 size={16} /></button></div><div className="grid grid-cols-2 gap-3"><Control label="الشكل"><select className={field} value={frame.style} onChange={(e) => updateFrame(i,{style:e.target.value as CardFrame['style']})}>{([['single','مفرد'],['double','مزدوج'],['rounded','دائري الزوايا'],['corners','أركان'],['dashed','متقطع'],['dotted','منقط'],['geometric','هندسي']] as const).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Control><Control label="اللون"><input type="color" aria-label={`لون الإطار ${i+1}`} value={frame.color} onChange={(e) => updateFrame(i,{color:e.target.value})} className="mt-1 h-10 w-full" /></Control><Control label={`السمك: ${frame.width}`}><input type="range" aria-label={`سمك الإطار ${i+1}`} min={1} max={10} value={frame.width} onChange={(e)=>updateFrame(i,{width:Number(e.target.value)})} className="mt-3 w-full" /></Control><Control label={`البعد عن الحافة: ${frame.inset}`}><input type="range" aria-label={`بعد الإطار ${i+1}`} min={12} max={76} value={frame.inset} onChange={(e)=>updateFrame(i,{inset:Number(e.target.value)})} className="mt-3 w-full" /></Control></div></div>)}
            <button type="button" disabled={options.frames.length>=6} onClick={()=>commit({...options,border:true,frames:[...options.frames,{style:'single',color:currentPalette.accent,width:2,inset:Math.min(76,28+options.frames.length*9)}]})} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#b59b6b] p-3 text-sm disabled:opacity-30"><Plus size={17} />إضافة إطار</button>
          </>}
          <Control label="توقيع اختياري"><input className={field} maxLength={80} value={options.signature} onChange={(e)=>update('signature',e.target.value)} placeholder="اسمك أو اسم صفحتك" /></Control>
          <div className="flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={options.showBrand} onChange={(e)=>update('showBrand',e.target.checked)} /> اسم سميع</label>{content.secondary && <label><input type="checkbox" checked={secondary} onChange={(e)=>setSecondary(e.target.checked)} /> تضمين التفسير</label>}</div>
        </fieldset>
        <p className="text-xs leading-6 text-slate-500">المعاينة هي نفس ملف التصدير. النص الطويل يُوزع كاملًا على بطاقات متتابعة، وتُحفظ البطاقات معًا في ملف ZIP.</p>
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

function Control({label,children}:{label:string;children:ReactNode}) { return <label className="block text-xs font-bold">{label}{children}</label> }