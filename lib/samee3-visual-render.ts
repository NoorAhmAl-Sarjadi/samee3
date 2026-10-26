import type { Verse } from './samee3-visual-config'

export type VideoRatio = '9:16' | '1:1' | '16:9'

export type VideoDesign = {
  ratio: VideoRatio
  quality: 720 | 1080
  shade: number
  textColor: string
  signature: string
  fontScale: number
}

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
  if (design.ratio === '16:9') return { width: Math.round(q * 16 / 9), height: q }
  if (design.ratio === '1:1') return { width: q, height: q }
  return { width: q, height: Math.round(q * 16 / 9) }
}

function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const result: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? line + ' ' + word : word
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

/** The same Canvas renderer is used for live preview AND the video recording. */
export function drawVisualFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement | null,
  info: FrameInfo,
): void {
  const { width: w, height: h } = dimensions(info.design)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return
  const background = ctx.createLinearGradient(0, 0, w, h)
  background.addColorStop(0, info.tint)
  background.addColorStop(1, '#0a211d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight)
    const vw = video.videoWidth * scale
    const vh = video.videoHeight * scale
    try {
      ctx.drawImage(video, (w - vw) / 2, (h - vh) / 2, vw, vh)
    } catch {
      // Keep the dark fallback if a browser is switching video frames.
    }
  }

  ctx.fillStyle = `rgba(2,12,11,${Math.max(0, Math.min(80, info.design.shade)) / 100})`
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = Math.max(2, w * .0025)
  ctx.strokeStyle = 'rgba(233,195,116,.76)'
  ctx.strokeRect(w * .052, h * .045, w * .896, h * .91)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = 'rtl'
  ctx.fillStyle = '#f0d39b'
  ctx.font = `bold ${Math.round(w * .039)}px Amiri, serif`
  ctx.fillText('سورة ' + info.surahName, w / 2, h * .15, w * .78)

  const text = info.verse?.text || info.placeholder
  const minSize = Math.max(16, Math.round(w * .020))
  let size = Math.max(minSize, Math.round(w * .062 * info.design.fontScale))
  let rows: string[] = []
  const maxTextHeight = h * (info.design.ratio === '16:9' ? .48 : .43)
  // Never cut the final lines of a long ayah. Shrink instead.
  for (; size >= minSize; size -= 2) {
    ctx.font = `${size}px "Amiri Quran", Amiri, serif`
    rows = lines(ctx, text, w * .80)
    if (rows.length * size * 1.75 <= maxTextHeight) break
  }
  ctx.font = `${Math.max(minSize, size)}px "Amiri Quran", Amiri, serif`
  rows = lines(ctx, text, w * .80)
  const effectiveSize = Math.max(minSize, size)
  const lineHeight = effectiveSize * 1.75
  const blockHeight = rows.length * lineHeight
  const middle = h * (info.design.ratio === '16:9' ? .50 : .49)
  const viewportHeight = Math.min(maxTextHeight, blockHeight + lineHeight)
  const viewportY = middle - viewportHeight / 2
  const scrollDistance = Math.max(0, blockHeight - viewportHeight + lineHeight * .6)
  const progress = Math.max(0, Math.min(1, info.verseProgress || 0))
  const scroll = scrollDistance * progress
  const firstBaseline = blockHeight > viewportHeight
    ? viewportY + lineHeight / 2 - scroll
    : middle - blockHeight / 2 + lineHeight / 2

  ctx.fillStyle = 'rgba(0,14,12,.34)'
  ctx.fillRect(w * .073, viewportY - lineHeight * .2,
    w * .854, viewportHeight + lineHeight * .4)
  ctx.save()
  ctx.beginPath()
  ctx.rect(w * .09, viewportY, w * .82, viewportHeight)
  ctx.clip()

  ctx.fillStyle = info.design.textColor
  rows.forEach((row, index) => {
    ctx.fillText(row, w / 2, firstBaseline + index * lineHeight, w * .80)
  })
  ctx.restore()

  if (info.verse) {
    ctx.fillStyle = '#e9c889'
    ctx.font = `${Math.round(w * .030)}px Amiri, serif`
    ctx.fillText(`﴿ ${info.verse.number.toLocaleString('ar-EG')} ﴾`,
      w / 2, Math.min(h * .80, viewportY + viewportHeight + lineHeight * .9))
  }

  ctx.fillStyle = '#f1dfb9'
  ctx.font = `${Math.round(w * .031)}px Amiri, serif`
  ctx.fillText(info.readerName, w / 2, h * .86, w * .82)
  ctx.fillStyle = '#d9bc81'
  ctx.fillRect(w * .36, h * .895, w * .28, Math.max(1, w * .0016))
  ctx.font = `${Math.round(w * .024)}px Tajawal, sans-serif`
  ctx.fillText(info.design.signature.slice(0, 45), w / 2, h * .929, w * .80)
}

export function verseIndexAt(starts: number[], second: number): number {
  let index = 0
  for (let i = 1; i < starts.length; i++) {
    if (second < starts[i]) break
    index = i
  }
  return index
}
