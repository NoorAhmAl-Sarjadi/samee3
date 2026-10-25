export const CARD_PALETTES = {
  ivory: { name: 'عاجي', bg: '#f2ece1', paper: '#fffdf7', ink: '#233f42', muted: '#667573', accent: '#a77b3d' },
  gold: { name: 'ذهبي', bg: '#e5d1ab', paper: '#fff6e4', ink: '#493a25', muted: '#817052', accent: '#976928' },
  emerald: { name: 'زمردي', bg: '#d9e8e1', paper: '#f9fffb', ink: '#16483e', muted: '#5a7a6c', accent: '#31826b' },
  night: { name: 'ليلي', bg: '#10252e', paper: '#1c3540', ink: '#f7efdc', muted: '#bfd0cb', accent: '#dfbc7b' },
  rose: { name: 'وردي', bg: '#f0e2df', paper: '#fff9f7', ink: '#573d45', muted: '#8b7477', accent: '#ae7f76' },
  white: { name: 'أبيض', bg: '#ffffff', paper: '#ffffff', ink: '#1b272c', muted: '#637179', accent: '#647078' },
  plum: { name: 'بنفسجي', bg: '#2f2138', paper: '#432e4b', ink: '#fff3ee', muted: '#d2bbd4', accent: '#e2b9a0' },
  sand: { name: 'رملي', bg: '#ddd1bc', paper: '#f7f0e3', ink: '#443d31', muted: '#82735e', accent: '#936b40' },
} as const
export const CARD_FONTS = ['Amiri', 'Tajawal', 'Aref Ruqaa', 'Amiri Quran', 'KFGQPC Uthmanic Script HAFS'] as const
export type CardFont = typeof CARD_FONTS[number]
export type CardBlock = 'title' | 'body' | 'secondaryTitle' | 'secondary' | 'reference' | 'signature'
export type TextStyle = { font: string; size: number; color: string; align: 'center' | 'right' | 'left'; lineHeight: number; bold: boolean }
export type CardFrame = { style: 'single' | 'double' | 'rounded' | 'corners' | 'dashed' | 'dotted' | 'geometric'; color: string; width: number; inset: number }
export type CardContent = { title: string; text: string; reference: string; kind: 'ayah' | 'hadith' | 'dhikr'; quranFont?: 'Samee3-sousi' | 'Samee3-bazzi' | 'Amiri Quran'; secondary?: { title: string; text: string } }
export type CardOptions = {
  theme: keyof typeof CARD_PALETTES; format: 'auto' | 'square' | 'portrait' | 'story'
  template: 'editorial' | 'frame' | 'minimal' | 'gradient'; font: CardFont; fontSize: number
  align: 'center' | 'right'; margin: number; border: boolean; signature: string; showBrand: boolean
  colors: Partial<Record<'bg' | 'paper' | 'accent', string>>; styles: Partial<Record<CardBlock, Partial<TextStyle>>>
  frames: CardFrame[]; lineHeight: number; radius: number; vertical: 'center' | 'top'; pattern: 'none' | 'dots' | 'diamonds'
}
type CardLine = TextStyle & { text: string; height: number; block: CardBlock; secondary: boolean }
export type CardPage = { lines: CardLine[]; height: number; header: CardLine[]; reference: CardLine[]; footer: CardLine[]; top: number; bottomSpace: number }
export const DEFAULT_CARD_OPTIONS: CardOptions = {
  theme: 'ivory', format: 'auto', template: 'editorial', font: 'Amiri', fontSize: 48, align: 'center', margin: 88,
  border: true, signature: '', showBrand: true, colors: {}, styles: {}, frames: [], lineHeight: 1.95, radius: 28, vertical: 'center', pattern: 'none',
}
export function cardTextStyle(options: CardOptions, block: CardBlock, content?: CardContent): TextStyle {
  const p = CARD_PALETTES[options.theme]
  const sizes = { title: 32, body: options.fontSize, secondaryTitle: 30, secondary: Math.max(30, options.fontSize - 10), reference: 24, signature: 22 }
  const style: TextStyle = {
    font: block === 'body' || block === 'secondary' ? options.font : 'Tajawal', size: sizes[block],
    color: block === 'body' || block === 'title' ? p.ink : block === 'secondaryTitle' ? options.colors.accent || p.accent : p.muted,
    align: block === 'body' || block === 'secondary' ? options.align : 'center',
    lineHeight: block === 'body' || block === 'secondary' ? options.lineHeight : 1.6, bold: block === 'title' || block === 'secondaryTitle',
    ...options.styles[block],
  }
  if (block === 'body' && content?.kind === 'ayah') {
    const required = content.quranFont || 'Amiri Quran'
    // Source-encoded Susi/Bazzi text cannot be rendered with a generic Arabic font.
    style.font = required.startsWith('Samee3-') ? required : ['Amiri Quran', 'KFGQPC Uthmanic Script HAFS'].includes(style.font) ? style.font : required
    style.bold = false
  }
  return style
}
export function wrapCardText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue }
    let line = ''
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= width) { line = next; continue }
      if (line) lines.push(line)
      if (ctx.measureText(word).width > width) throw new Error('توجد كلمة أطول من عرض البطاقة. قلّل حجم الخط أو الهوامش.')
      line = word
    }
    if (line) lines.push(line)
  }
  return lines
}
const fontSpec = (style: TextStyle) => `${style.bold ? 'bold ' : ''}${style.size}px "${style.font}",serif`
const heightOf = (lines: CardLine[]) => lines.reduce((n, line) => n + line.height, 0)
export async function prepareCardPages(content: CardContent, options: CardOptions): Promise<CardPage[]> {
  if (!content.text.trim()) throw new Error('لا يوجد نص لتصميمه.')
  if (content.text.length + (content.secondary?.text.length || 0) > 100000) throw new Error('هذا النص كبير جدًا للتصدير على الهاتف.')
  const blocks: CardBlock[] = ['title', 'body', 'secondaryTitle', 'secondary', 'reference', 'signature']
  await Promise.all(blocks.map((block) => document.fonts.load(fontSpec(cardTextStyle(options, block, content)))))
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error('المتصفح لا يدعم إنشاء الصور.')
  const width = 1080 - 2 * options.margin - 56
  const rows = (text: string, block: CardBlock): CardLine[] => {
    const style = cardTextStyle(options, block, content); ctx.font = fontSpec(style)
    return wrapCardText(ctx, text, width).map((row) => ({ ...style, text: row, height: Math.ceil(style.size * style.lineHeight), block, secondary: block === 'secondary' || block === 'secondaryTitle' }))
  }
  const header = rows(content.title, 'title'), reference = content.reference ? rows(content.reference, 'reference') : [], footer = options.signature ? rows(options.signature, 'signature') : []
  const lines = rows(content.text, 'body')
  if (content.secondary?.text.trim()) lines.push(...rows('', 'secondaryTitle'), ...rows(content.secondary.title, 'secondaryTitle'), ...rows(content.secondary.text, 'secondary'))
  const top = 180 + heightOf(header), bottomSpace = 135 + heightOf(reference) + heightOf(footer)
  const maxHeight = options.format === 'square' ? 1080 : options.format === 'portrait' ? 1350 : 1920
  const capacity = maxHeight - top - bottomSpace
  if (capacity < 120 || lines.some((line) => line.height > capacity)) throw new Error('العنوان أو المرجع كبير للمقاس المختار. قلّل حجم خطه أو اختر مقاسًا أطول.')
  const pages: CardPage[] = []
  let batch: CardLine[] = [], used = 0
  const push = () => { if (batch.length) pages.push({ lines: batch, header, reference, footer, top, bottomSpace, height: options.format === 'auto' ? Math.min(maxHeight, Math.max(1080, Math.ceil(used + top + bottomSpace))) : maxHeight }); batch = []; used = 0 }
  for (const line of lines) { if (used + line.height > capacity && batch.length) push(); batch.push(line); used += line.height }
  push()
  if (pages.length > 40) throw new Error('النص يحتاج أكثر من ٤٠ بطاقة. اختر نصًا أقصر أو خطًا أصغر.')
  return pages
}
function drawFrame(ctx: CanvasRenderingContext2D, frame: CardFrame, w: number, h: number) {
  const m = frame.inset, x = w - 2 * m, y = h - 2 * m
  ctx.save(); ctx.strokeStyle = frame.color; ctx.lineWidth = frame.width
  if (frame.style === 'dashed' || frame.style === 'dotted') { ctx.setLineDash(frame.style === 'dashed' ? [18, 12] : [2, 10]); ctx.lineCap = 'round' }
  if (frame.style === 'corners') {
    for (const [px, py, sx, sy] of [[m,m,1,1],[w-m,m,-1,1],[m,h-m,1,-1],[w-m,h-m,-1,-1]]) { ctx.beginPath(); ctx.moveTo(px,py+sy*90);ctx.lineTo(px,py);ctx.lineTo(px+sx*90,py);ctx.stroke() }
  } else if (frame.style === 'rounded') { ctx.beginPath();ctx.roundRect(m,m,x,y,32);ctx.stroke() }
  else { ctx.strokeRect(m,m,x,y); if (frame.style === 'double') ctx.strokeRect(m+12,m+12,x-24,y-24) }
  if (frame.style === 'geometric') for (const [px,py] of [[m,m],[w-m,m],[m,h-m],[w-m,h-m]]) { ctx.save();ctx.translate(px,py);ctx.rotate(Math.PI/4);ctx.fillStyle=frame.color;ctx.fillRect(-9,-9,18,18);ctx.restore() }
  ctx.restore()
}
export function renderCard(page: CardPage, options: CardOptions, index: number, total: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');canvas.width=1080;canvas.height=page.height
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذر رسم البطاقة.')
  const p={...CARD_PALETTES[options.theme],...options.colors},w=1080,h=page.height,m=options.margin
  ctx.fillStyle=p.bg;ctx.fillRect(0,0,w,h)
  if(options.template!=='minimal') {
    if(options.template==='gradient'){const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,p.paper);gradient.addColorStop(1,p.bg);ctx.fillStyle=gradient}else ctx.fillStyle=p.paper
    ctx.beginPath();ctx.roundRect(34,34,w-68,h-68,options.radius);ctx.fill()
  }
  if(options.pattern!=='none') {
    ctx.save();ctx.fillStyle=p.accent;ctx.globalAlpha=.09
    for(let x=78;x<w;x+=48)for(let y=78;y<h;y+=48){ctx.save();ctx.translate(x,y);if(options.pattern==='diamonds')ctx.rotate(Math.PI/4);ctx.fillRect(-2,-2,4,4);ctx.restore()}
    ctx.restore()
  }
  if(options.border) {
    const frames=options.frames.length?options.frames:[{style:options.template==='frame'?'double':'single',color:p.accent,width:2,inset:52} as CardFrame]
    frames.forEach((frame)=>drawFrame(ctx,frame,w,h))
  }
  ctx.direction='rtl';ctx.textBaseline='alphabetic';ctx.textAlign='center';ctx.fillStyle=p.accent;ctx.font='24px "Tajawal",sans-serif'
  if(options.showBrand)ctx.fillText('مُصْحَف سَمِيع  /  SAMEE3',w/2,116)
  const draw=(lines:CardLine[],start:number)=>{
    let y=start
    for(const line of lines){ctx.font=fontSpec(line);ctx.fillStyle=line.color;ctx.textAlign=line.align;ctx.fillText(line.text,line.align==='right'?w-m-28:line.align==='left'?m+28:w/2,y+line.height*.72);y+=line.height}
    return y
  }
  draw(page.header,145)
  ctx.fillStyle=p.accent;ctx.fillRect(w/2-34,page.top-18,68,3)
  const bottom=h-page.bottomSpace
  draw(page.lines,page.top+(options.vertical==='center'?Math.max(0,(bottom-page.top-heightOf(page.lines))/2):0))
  draw(page.footer,draw(page.reference,bottom+30)+15)
  if(total>1){ctx.direction='ltr';ctx.textAlign='left';ctx.fillStyle=p.accent;ctx.font='20px sans-serif';ctx.fillText(`${index+1} / ${total}`,78,h-77)}
  return canvas
}
export function cardBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error('تعذر تصدير الصورة.')),type,.95))
}
export function downloadBlob(blob: Blob, filename: string) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000)
}