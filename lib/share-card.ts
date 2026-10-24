export const CARD_PALETTES = {
  ivory: { name: 'عاجي', bg: '#f2ece1', paper: '#fffdf7', ink: '#233f42', muted: '#667573', accent: '#a77b3d' },
  gold: { name: 'ذهبي', bg: '#e5d1ab', paper: '#fff6e4', ink: '#493a25', muted: '#817052', accent: '#976928' },
  emerald: { name: 'زمردي', bg: '#d9e8e1', paper: '#f9fffb', ink: '#16483e', muted: '#5a7a6c', accent: '#31826b' },
  night: { name: 'ليلي', bg: '#10252e', paper: '#1c3540', ink: '#f7efdc', muted: '#bfd0cb', accent: '#dfbc7b' },
  rose: { name: 'وردي', bg: '#f0e2df', paper: '#fff9f7', ink: '#573d45', muted: '#8b7477', accent: '#ae7f76' },
  white: { name: 'أبيض', bg: '#ffffff', paper: '#ffffff', ink: '#1b272c', muted: '#637179', accent: '#647078' },
} as const

export type CardContent = { title: string; text: string; reference: string; kind: 'ayah' | 'hadith' | 'dhikr'; quranFont?: 'Samee3-sousi' | 'Samee3-bazzi' | 'Amiri Quran'; secondary?: { title: string; text: string } }
export type CardOptions = {
  theme: keyof typeof CARD_PALETTES; format: 'auto' | 'square' | 'portrait' | 'story'
  template: 'editorial' | 'frame' | 'minimal'; font: 'Amiri' | 'Tajawal'; fontSize: number
  align: 'center' | 'right'; margin: number; border: boolean; signature: string; showBrand: boolean
}
type CardLine = { text: string; size: number; height: number; font: string; secondary: boolean; heading?: boolean }
export type CardPage = { lines: CardLine[]; height: number; header: string[]; reference: string[] }
export const DEFAULT_CARD_OPTIONS: CardOptions = { theme: 'ivory', format: 'auto', template: 'editorial', font: 'Amiri', fontSize: 48, align: 'center', margin: 88, border: true, signature: '', showBrand: true }

/** Wrap whole words without changing scripture codepoints or dropping paragraphs. */
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

export async function prepareCardPages(content: CardContent, options: CardOptions): Promise<CardPage[]> {
  if (!content.text.trim()) throw new Error('لا يوجد نص لتصميمه.')
  if ((content.text.length + (content.secondary?.text.length || 0)) > 100000) throw new Error('هذا النص كبير جدًا للتصدير على الهاتف.')
  await Promise.all(['Amiri', content.quranFont || 'Amiri Quran', 'Tajawal'].map((font) => document.fonts.load(`48px "${font}"`)))
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error('المتصفح لا يدعم إنشاء الصور.')
  const width = 1080 - 2 * options.margin - 56
  const font = content.kind === 'ayah' ? (content.quranFont || 'Amiri Quran') : options.font
  const lines: CardLine[] = []
  const add = (text: string, size: number, family: string, secondary: boolean, heading = false) => {
    ctx.font = `${size}px "${family}",serif`
    wrapCardText(ctx, text, width).forEach((row) => lines.push({ text: row, size, font: family, height: Math.ceil(size * (family === 'Tajawal' ? 1.65 : 1.95)), secondary, heading }))
  }
  add(content.text, options.fontSize, font, false)
  if (content.secondary?.text.trim()) {
    add('', 22, 'Amiri', true)
    add(content.secondary.title, 30, 'Tajawal', true, true)
    add(content.secondary.text, Math.max(30, options.fontSize - 10), options.font, true)
  }
  ctx.font = 'bold 32px "Tajawal",sans-serif'
  const header = wrapCardText(ctx, content.title, width)
  ctx.font = '24px "Tajawal",sans-serif'
  const reference = wrapCardText(ctx, content.reference, width)
  const reserved = 330 + header.length * 42 + reference.length * 36 + (options.signature ? 45 : 0)
  const maxHeight = options.format === 'square' ? 1080 : options.format === 'portrait' ? 1350 : 1920
  const capacity = maxHeight - reserved
  const pages: CardPage[] = []
  let batch: CardLine[] = [], used = 0
  const push = () => {
    if (!batch.length) return
    pages.push({ lines: batch, header, reference, height: options.format === 'auto' ? Math.max(1080, Math.ceil(used + reserved)) : maxHeight })
    batch = []; used = 0
  }
  for (const line of lines) {
    if (used + line.height > capacity && batch.length) push()
    batch.push(line); used += line.height
  }
  push()
  if (pages.length > 40) throw new Error('النص يحتاج أكثر من ٤٠ بطاقة. اختر تفسيرًا أقصر أو خطًا أصغر.')
  return pages
}

export function renderCard(page: CardPage, options: CardOptions, index: number, total: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = page.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذر رسم البطاقة.')
  const p = CARD_PALETTES[options.theme], w = 1080, h = page.height, m = options.margin
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h)
  if (options.template !== 'minimal') {
    ctx.fillStyle = p.paper; ctx.fillRect(34, 34, w - 68, h - 68)
  }
  if (options.border) {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.strokeRect(52, 52, w - 104, h - 104)
    if (options.template === 'frame') { ctx.globalAlpha = .45; ctx.strokeRect(65, 65, w - 130, h - 130); ctx.globalAlpha = 1 }
  }
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = p.accent; ctx.font = '24px "Tajawal",sans-serif'
  ctx.fillText(options.showBrand ? 'مُصْحَف سَمِيع  /  SAMEE3' : '۞', w / 2, 115)
  ctx.font = 'bold 32px "Tajawal",sans-serif'; ctx.fillStyle = p.ink
  page.header.forEach((line, i) => ctx.fillText(line, w / 2, 179 + i * 42))
  const top = 215 + page.header.length * 42
  ctx.fillStyle = p.accent; ctx.fillRect(w / 2 - 34, top - 14, 68, 3)
  const bottom = h - 100 - page.reference.length * 36 - (options.signature ? 45 : 0)
  const used = page.lines.reduce((sum, row) => sum + row.height, 0)
  let y = top + Math.max(0, (bottom - top - used) / 2)
  page.lines.forEach((line) => {
    ctx.font = `${line.heading ? 'bold ' : ''}${line.size}px "${line.font}",serif`
    ctx.fillStyle = line.secondary ? (line.heading ? p.accent : p.muted) : p.ink
    ctx.textAlign = line.heading ? 'right' : options.align
    ctx.fillText(line.text, ctx.textAlign === 'right' ? w - m - 28 : w / 2, y + line.height * .72)
    y += line.height
  })
  ctx.textAlign = 'center'; ctx.fillStyle = p.muted; ctx.font = '24px "Tajawal",sans-serif'
  page.reference.forEach((line, i) => ctx.fillText(line, w / 2, bottom + 38 + i * 36))
  if (options.signature) { ctx.font = '22px "Tajawal",sans-serif'; ctx.fillText(options.signature, w / 2, h - 90) }
  if (total > 1) { ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.font = '20px sans-serif'; ctx.fillText(`${index + 1} / ${total}`, 78, h - 77) }
  return canvas
}

export function cardBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذر تصدير الصورة.')), type, .95))
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
