import {
  fontById,
  type VideoDesign,
  type VideoRatio,
  type Verse,
} from './samee3-visual-config'

export type { VideoDesign, VideoRatio } from './samee3-visual-config'

export type FrameInfo = {
  surahName: string
  readerName: string
  verse: Verse | null
  verseProgress?: number
  placeholder: string
  tint: string
  design: VideoDesign
}

export function dimensions(design: VideoDesign) {
  const q = design.quality
  if (design.ratio === '16:9') return { width: Math.round((q * 16) / 9), height: q }
  if (design.ratio === '1:1') return { width: q, height: q }
  return { width: q, height: Math.round((q * 16) / 9) }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const result: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > width) {
      result.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) result.push(line)
  return result
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function alpha(hex: string, opacityPercent: number) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6)
  const value = Math.max(0, Math.min(100, opacityPercent)) / 100
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${value})`
}

function drawFrameDecor(ctx: CanvasRenderingContext2D, w: number, h: number, design: VideoDesign) {
  const color = design.frameColor
  const width = Math.max(1, design.frameWidth)
  const x = w * 0.055
  const y = h * 0.045
  const boxW = w * 0.89
  const boxH = h * 0.91

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width

  switch (design.frameStyle) {
    case 'double':
      ctx.strokeRect(x, y, boxW, boxH)
      ctx.strokeRect(x + w * 0.02, y + h * 0.02, boxW - w * 0.04, boxH - h * 0.04)
      break
    case 'rounded':
      roundedRect(ctx, x, y, boxW, boxH, design.cornerRadius)
      ctx.stroke()
      break
    case 'glow':
      ctx.shadowBlur = 18
      ctx.shadowColor = color
      roundedRect(ctx, x, y, boxW, boxH, design.cornerRadius)
      ctx.stroke()
      ctx.shadowBlur = 0
      break
    case 'corners': {
      const len = Math.min(boxW, boxH) * 0.12
      const right = x + boxW
      const bottom = y + boxH
      const drawCorner = (sx: number, sy: number, dx: number, dy: number) => {
        ctx.beginPath()
        ctx.moveTo(sx, sy + len * dy)
        ctx.lineTo(sx, sy)
        ctx.lineTo(sx + len * dx, sy)
        ctx.stroke()
      }
      drawCorner(x, y, 1, 1)
      drawCorner(right, y, -1, 1)
      drawCorner(x, bottom, 1, -1)
      drawCorner(right, bottom, -1, -1)
      break
    }
    case 'top-bottom':
      ctx.beginPath()
      ctx.moveTo(x + w * 0.08, y)
      ctx.lineTo(x + boxW - w * 0.08, y)
      ctx.moveTo(x + w * 0.08, y + boxH)
      ctx.lineTo(x + boxW - w * 0.08, y + boxH)
      ctx.stroke()
      break
    default:
      ctx.strokeRect(x, y, boxW, boxH)
      break
  }

  ctx.restore()
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, design: VideoDesign) {
  if (design.panelStyle === 'none') return

  ctx.save()
  const radius = Math.max(14, design.cornerRadius - 8)
  roundedRect(ctx, x, y, w, h, radius)

  if (design.panelStyle === 'solid') {
    ctx.fillStyle = alpha(design.panelColor, design.panelOpacity)
    ctx.fill()
  } else if (design.panelStyle === 'gradient') {
    const gradient = ctx.createLinearGradient(x, y, x, y + h)
    gradient.addColorStop(0, alpha(design.panelColor, Math.min(100, design.panelOpacity + 18)))
    gradient.addColorStop(1, alpha(design.panelColor, Math.max(12, design.panelOpacity - 10)))
    ctx.fillStyle = gradient
    ctx.fill()
  } else if (design.panelStyle === 'outline') {
    ctx.fillStyle = alpha(design.panelColor, Math.max(5, design.panelOpacity - 12))
    ctx.fill()
    ctx.lineWidth = 1.2
    ctx.strokeStyle = alpha('#ffffff', 36)
    ctx.stroke()
  } else {
    ctx.fillStyle = alpha(design.panelColor, design.panelOpacity)
    ctx.fill()
    ctx.strokeStyle = alpha('#ffffff', 18)
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

export function drawVisualFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement | null, info: FrameInfo): void {
  const { width: w, height: h } = dimensions(info.design)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return
  const quranFont = fontById(info.design.quranFontId).family
  const uiFont = fontById(info.design.uiFontId).family

  const background = ctx.createLinearGradient(0, 0, w, h)
  background.addColorStop(0, info.tint)
  background.addColorStop(1, '#091f1c')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight)
    const vw = video.videoWidth * scale
    const vh = video.videoHeight * scale
    try {
      ctx.drawImage(video, (w - vw) / 2, (h - vh) / 2, vw, vh)
    } catch {
      // Keep fallback gradient if the browser skips a frame.
    }
  }

  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(80, info.design.shade)) / 100})`
  ctx.fillRect(0, 0, w, h)

  if (info.design.overlayOpacity > 0) {
    ctx.fillStyle = alpha(info.design.overlayColor, info.design.overlayOpacity)
    ctx.fillRect(0, 0, w, h)
  }

  drawFrameDecor(ctx, w, h, info.design)

  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = info.design.titleColor
  ctx.font = `bold ${Math.round(w * 0.039)}px ${uiFont}`
  ctx.fillText(`سورة ${info.surahName}`, w / 2, h * 0.145, w * 0.78)

  const text = info.verse?.text || info.placeholder
  const minSize = Math.max(18, Math.round(w * 0.02))
  let size = Math.max(minSize, Math.round(w * 0.062 * info.design.fontScale))
  let rows: string[] = []
  const maxTextHeight = h * (info.design.ratio === '16:9' ? 0.48 : 0.43)

  for (; size >= minSize; size -= 2) {
    ctx.font = `${size}px ${quranFont}`
    rows = wrapLines(ctx, text, w * 0.8)
    if (rows.length * size * 1.72 <= maxTextHeight) break
  }

  ctx.font = `${Math.max(minSize, size)}px ${quranFont}`
  rows = wrapLines(ctx, text, w * 0.8)
  const effectiveSize = Math.max(minSize, size)
  const lineHeight = effectiveSize * 1.72
  const blockHeight = rows.length * lineHeight
  const middle = h * (info.design.ratio === '16:9' ? 0.5 : 0.49)
  const viewportHeight = Math.min(maxTextHeight, blockHeight + lineHeight)
  const viewportY = middle - viewportHeight / 2
  const scrollDistance = Math.max(0, blockHeight - viewportHeight + lineHeight * 0.6)
  const progress = Math.max(0, Math.min(1, info.verseProgress || 0))
  const scroll = scrollDistance * progress
  const firstBaseline = blockHeight > viewportHeight
    ? viewportY + lineHeight / 2 - scroll
    : middle - blockHeight / 2 + lineHeight / 2

  drawPanel(ctx, w * 0.073, viewportY - lineHeight * 0.2, w * 0.854, viewportHeight + lineHeight * 0.4, info.design)
  ctx.save()
  roundedRect(ctx, w * 0.09, viewportY, w * 0.82, viewportHeight, Math.max(10, info.design.cornerRadius - 10))
  ctx.clip()
  ctx.fillStyle = info.design.textColor
  rows.forEach((row, index) => {
    ctx.fillText(row, w / 2, firstBaseline + index * lineHeight, w * 0.8)
  })
  ctx.restore()

  if (info.verse) {
    ctx.fillStyle = info.design.titleColor
    ctx.font = `${Math.round(w * 0.029)}px ${uiFont}`
    ctx.fillText(`﴿ ${info.verse.number.toLocaleString('ar-EG')} ﴾`, w / 2, Math.min(h * 0.8, viewportY + viewportHeight + lineHeight * 0.85))
  }

  ctx.fillStyle = info.design.readerColor
  ctx.font = `${Math.round(w * 0.031)}px ${uiFont}`
  ctx.fillText(info.readerName, w / 2, h * 0.86, w * 0.8)

  ctx.fillStyle = info.design.signatureColor
  ctx.fillRect(w * 0.36, h * 0.895, w * 0.28, Math.max(1, w * 0.0016))
  ctx.font = `${Math.round(w * 0.024)}px ${uiFont}`
  ctx.fillText(info.design.signature.slice(0, 45), w / 2, h * 0.928, w * 0.8)
}

export function verseIndexAt(starts: number[], second: number): number {
  let index = 0
  for (let i = 1; i < starts.length; i++) {
    if (second < starts[i]) break
    index = i
  }
  return index
}
