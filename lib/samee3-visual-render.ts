
import {
  fontById,
  type VideoDesign,
  type Verse,
} from './samee3-visual-config'

export type {
  VideoDesign,
  VideoRatio,
} from './samee3-visual-config'

export type FrameInfo = {
  surahName: string
  readerName: string
  verse: Verse | null
  verseProgress?: number
  placeholder: string
  tint: string
  design: VideoDesign
  alternateVideo?: HTMLVideoElement | null
  backgroundMix?: number
}

export function dimensions(design: VideoDesign) {
  const q = design.quality

  if (design.ratio === '16:9') {
    return {
      width: Math.round(q * 16 / 9),
      height: q,
    }
  }

  if (design.ratio === '1:1') {
    return { width: q, height: q }
  }

  return {
    width: q,
    height: Math.round(q * 16 / 9),
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
): string[] {
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

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(
    0,
    Math.min(r, Math.min(w, h) / 2)
  )

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

  const value = Math.max(
    0,
    Math.min(100, opacityPercent)
  ) / 100

  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)

  return `rgba(${r},${g},${b},${value})`
}

function drawFrameDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: VideoDesign
) {
  if (design.frameStyle === 'none') return

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
      ctx.strokeRect(
        x + w * 0.02,
        y + h * 0.02,
        boxW - w * 0.04,
        boxH - h * 0.04
      )
      break

    case 'rounded':
      roundedRect(
        ctx, x, y, boxW, boxH,
        design.cornerRadius
      )
      ctx.stroke()
      break

    case 'glow':
      ctx.shadowBlur = 18
      ctx.shadowColor = color
      roundedRect(
        ctx, x, y, boxW, boxH,
        design.cornerRadius
      )
      ctx.stroke()
      ctx.shadowBlur = 0
      break

    case 'corners': {
      const len = Math.min(boxW, boxH) * 0.12
      const right = x + boxW
      const bottom = y + boxH

      const drawCorner = (
        sx: number,
        sy: number,
        dx: number,
        dy: number
      ) => {
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

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  design: VideoDesign
) {
  if (design.panelStyle === 'none') return

  ctx.save()

  const radius = Math.max(
    14,
    design.cornerRadius - 8
  )

  roundedRect(ctx, x, y, w, h, radius)

  if (design.panelStyle === 'solid') {
    ctx.fillStyle = alpha(
      design.panelColor,
      design.panelOpacity
    )
    ctx.fill()
  } else if (design.panelStyle === 'gradient') {
    const gradient = ctx.createLinearGradient(
      x, y, x, y + h
    )

    gradient.addColorStop(
      0,
      alpha(
        design.panelColor,
        Math.min(100, design.panelOpacity + 18)
      )
    )

    gradient.addColorStop(
      1,
      alpha(
        design.panelColor,
        Math.max(12, design.panelOpacity - 10)
      )
    )

    ctx.fillStyle = gradient
    ctx.fill()
  } else if (design.panelStyle === 'outline') {
    ctx.fillStyle = alpha(
      design.panelColor,
      Math.max(5, design.panelOpacity - 12)
    )
    ctx.fill()

    ctx.lineWidth = 1.2
    ctx.strokeStyle = alpha('#ffffff', 36)
    ctx.stroke()
  } else {
    ctx.fillStyle = alpha(
      design.panelColor,
      design.panelOpacity
    )
    ctx.fill()

    ctx.strokeStyle = alpha('#ffffff', 18)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.restore()
}

export function drawVisualFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement | null,
  info: FrameInfo
): void {
  const { width: w, height: h } =
    dimensions(info.design)

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  const rawContext = canvas.getContext(
    '2d',
    { alpha: false }
  )

  if (!rawContext) return

  const ctx: CanvasRenderingContext2D = rawContext
  const quranFont =
    fontById(info.design.quranFontId).family
  const uiFont =
    fontById(info.design.uiFontId).family

  const background = ctx.createLinearGradient(
    0, 0, w, h
  )

  background.addColorStop(0, info.tint)
  background.addColorStop(1, '#091f1c')

  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  function drawVideoFrame(
    source: HTMLVideoElement | null | undefined,
    opacity: number
  ) {
    if (
      !source ||
      source.readyState < 2 ||
      !source.videoWidth ||
      !source.videoHeight
    ) {
      return
    }

    const scale = Math.max(
      w / source.videoWidth,
      h / source.videoHeight
    )

    const vw = source.videoWidth * scale
    const vh = source.videoHeight * scale

    ctx.save()
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, opacity)
    )

    try {
      ctx.drawImage(
        source,
        (w - vw) / 2,
        (h - vh) / 2,
        vw,
        vh
      )
    } catch {
      // Safari قد يتجاوز إطارًا أثناء انتقال الفيديو.
    }

    ctx.restore()
  }

  drawVideoFrame(video, 1)

  if (
    info.alternateVideo &&
    (info.backgroundMix || 0) > 0
  ) {
    drawVideoFrame(
      info.alternateVideo,
      info.backgroundMix || 0
    )
  }

  ctx.fillStyle = `rgba(0,0,0,${
    Math.max(
      0,
      Math.min(80, info.design.shade)
    ) / 100
  })`

  ctx.fillRect(0, 0, w, h)

  if (info.design.overlayOpacity > 0) {
    ctx.fillStyle = alpha(
      info.design.overlayColor,
      info.design.overlayOpacity
    )

    ctx.fillRect(0, 0, w, h)
  }

  drawFrameDecor(ctx, w, h, info.design)

  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = info.design.titleColor

  const title =
    `سورة ${normalizeSurahName(info.surahName)}`

  let titleSize = Math.round(
    w * 0.039 * (info.design.titleScale ?? 1)
  )

  do {
    ctx.font = `bold ${titleSize}px Amiri, serif`

    if (
      ctx.measureText(title).width <= w * 0.83
    ) {
      break
    }

    titleSize -= 2
  } while (titleSize > 16)

  ctx.fillText(
    title,
    w / 2,
    h * 0.145,
    w * 0.85
  )

  const text =
    info.verse?.text || info.placeholder

  const maxTextWidth =
    w * Math.max(
      0.55,
      Math.min(
        0.9,
        (info.design.textWidth ?? 80) / 100
      )
    )

  const spacing = Math.max(
    1.3,
    Math.min(
      2.3,
      info.design.lineSpacing ?? 1.72
    )
  )

  const minSize = Math.max(
    18,
    Math.round(w * 0.02)
  )

  let size = Math.max(
    minSize,
    Math.round(
      w * 0.062 * info.design.fontScale
    )
  )

  let rows: string[] = []

  const maxTextHeight =
    h * (
      info.design.ratio === '16:9'
        ? 0.48
        : 0.43
    )

  for (; size >= minSize; size -= 2) {
    ctx.font = `${size}px ${quranFont}`
    rows = wrapLines(
      ctx,
      text,
      maxTextWidth
    )

    if (
      rows.length * size * spacing <=
      maxTextHeight
    ) {
      break
    }
  }

  ctx.font =
    `${Math.max(minSize, size)}px ${quranFont}`

  rows = wrapLines(
    ctx,
    text,
    maxTextWidth
  )

  const effectiveSize = Math.max(
    minSize,
    size
  )

  const lineHeight =
    effectiveSize * spacing

  const blockHeight =
    rows.length * lineHeight

  const middle =
    h * Math.max(
      0.32,
      Math.min(
        0.67,
        (info.design.verseVertical ?? 49) / 100
      )
    )

  const viewportHeight = Math.min(
    maxTextHeight,
    blockHeight + lineHeight
  )

  const viewportY =
    middle - viewportHeight / 2

  const scrollDistance = Math.max(
    0,
    blockHeight -
    viewportHeight +
    lineHeight * 0.6
  )

  const progress = Math.max(
    0,
    Math.min(
      1,
      info.verseProgress || 0
    )
  )

  const scroll = scrollDistance * progress

  const firstBaseline =
    blockHeight > viewportHeight
      ? viewportY + lineHeight / 2 - scroll
      : middle - blockHeight / 2 + lineHeight / 2

  drawPanel(
    ctx,
    w * 0.073,
    viewportY - lineHeight * 0.2,
    w * 0.854,
    viewportHeight + lineHeight * 0.4,
    info.design
  )

  ctx.save()

  roundedRect(
    ctx,
    w * 0.09,
    viewportY,
    w * 0.82,
    viewportHeight,
    Math.max(
      10,
      info.design.cornerRadius - 10
    )
  )

  ctx.clip()
  ctx.fillStyle = info.design.textColor

  rows.forEach((row, index) => {
    ctx.fillText(
      row,
      w / 2,
      firstBaseline + index * lineHeight,
      maxTextWidth
    )
  })

  ctx.restore()

  if (info.verse) {
    ctx.fillStyle = info.design.titleColor

    ctx.font =
      `${Math.round(w * 0.029)}px ${uiFont}`

    ctx.fillText(
      `﴿ ${info.verse.number.toLocaleString('ar-EG')} ﴾`,
      w / 2,
      Math.min(
        h * 0.8,
        viewportY +
        viewportHeight +
        lineHeight * 0.85
      )
    )
  }

  ctx.fillStyle = info.design.readerColor

  ctx.font = `${
    Math.round(
      w * 0.031 *
      (info.design.readerScale ?? 1)
    )
  }px ${uiFont}`

  ctx.fillText(
    info.readerName,
    w / 2,
    h * 0.86,
    w * 0.8
  )

  ctx.fillStyle =
    info.design.signatureColor

  ctx.fillRect(
    w * 0.36,
    h * 0.895,
    w * 0.28,
    Math.max(1, w * 0.0016)
  )

  ctx.font = `${
    Math.round(
      w * 0.024 *
      (info.design.signatureScale ?? 1)
    )
  }px ${uiFont}`

  ctx.fillText(
    info.design.signature.slice(0, 45),
    w / 2,
    h * 0.928,
    w * 0.8
  )
}

export function verseIndexAt(
  starts: number[],
  second: number
): number {
  let index = 0

  for (let i = 1; i < starts.length; i++) {
    if (second < starts[i]) break
    index = i
  }

  return index
}

export function cleanPrefatoryBasmala(
  text: string,
  surah: number,
  ayah: number
): string {
  if (
    surah === 1 ||
    surah === 9 ||
    ayah !== 1
  ) {
    return text
  }

  const words = text.trim().split(/\s+/)

  if (words.length <= 4) return text

  const normalized = words
    .slice(0, 4)
    .join(' ')
    .replace(
      /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,
      ''
    )
    .replace(/[ٱأإآ]/g, 'ا')

  return normalized === 'بسم الله الرحمن الرحيم'
    ? words.slice(4).join(' ')
    : text
}

export function normalizeSurahName(
  name: string
): string {
  return name
    .replace(
      /[\u064B-\u065F\u0670\u06D6-\u06ED]/g,
      ''
    )
    .replace(/^\s*سورة\s*/, '')
    .replace(/^ال\s+(?=\S)/, 'ال')
    .trim()
}

export class SeamlessVideoLoop {
  private front: HTMLVideoElement
  private back: HTMLVideoElement
  private blending = false
  private opacity = 0
  private overlapSeconds: number

  constructor(
    first: HTMLVideoElement,
    second: HTMLVideoElement,
    overlap = 0.9
  ) {
    this.front = first
    this.back = second
    this.overlapSeconds = overlap

    this.front.loop = false
    this.back.loop = false

    this.front.muted = true
    this.back.muted = true
  }

  setOverlap(seconds: number): void {
    this.overlapSeconds = Math.max(
      0.3,
      Math.min(2, seconds)
    )
  }

  async start(): Promise<void> {
    try {
      await this.front.play()
    } catch {
      // قد يمنع النظام التشغيل التلقائي.
    }
  }

  frame(): {
    primary: HTMLVideoElement
    secondary: HTMLVideoElement | null
    mix: number
  } {
    const duration = this.front.duration

    if (
      Number.isFinite(duration) &&
      duration > 2
    ) {
      const overlap = Math.min(
        this.overlapSeconds,
        duration * 0.24
      )

      const begin = duration - overlap

      if (
        !this.blending &&
        this.front.currentTime >= begin &&
        this.back.readyState >= 2
      ) {
        this.blending = true

        try {
          this.back.currentTime = 0
        } catch {}

        void this.back.play().catch(() => {})
      }

      if (this.blending) {
        this.opacity = Math.max(
          0,
          Math.min(
            1,
            (this.front.currentTime - begin) /
              overlap
          )
        )

        if (
          this.front.ended ||
          this.opacity >= 0.998
        ) {
          const old = this.front

          old.pause()

          this.front = this.back
          this.back = old

          this.blending = false
          this.opacity = 0

          try {
            this.back.currentTime = 0
          } catch {}
        }
      }

      if (
        this.front.ended &&
        !this.blending
      ) {
        try {
          this.front.currentTime = 0
        } catch {}

        void this.front.play().catch(() => {})
      }
    } else if (this.front.ended) {
      try {
        this.front.currentTime = 0
      } catch {}

      void this.front.play().catch(() => {})
    }

    return {
      primary: this.front,
      secondary: this.blending
        ? this.back
        : null,
      mix: this.opacity,
    }
  }

  stop(): void {
    this.front.pause()
    this.back.pause()
  }
}
