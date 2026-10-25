
'use client'

import {
  useCallback, useEffect, useMemo, useRef, useState
} from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, ChevronLeft, Download, Film,
  ImagePlus, Loader2, Pause, Play, RefreshCcw,
  Share2, Volume2, X
} from 'lucide-react'
import {
  VISUAL_SCENES, VISUAL_SURAHS, type VisualScene
} from '@/lib/samee3-visual-scenes'

type Surah = { id: number; name: string; count: number }
type Ayah = { number: number; text: string; translation: string }
type Clip = {
  source: string; title: string; artist: string
  license: string; mime: string; size: number; provider: string
}
type Render = {
  ayahs: Ayah[]
  buffers: AudioBuffer[]
  starts: number[]
  duration: number
}
type Result = { blob: Blob; url: string; name: string }

const QARIS = [
  { id: 'husary', name: 'محمود خليل الحصري' },
  { id: 'afasy', name: 'مشاري راشد العفاسي' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي' },
  { id: 'basit', name: 'عبد الباسط عبد الصمد' },
  { id: 'sudais', name: 'عبد الرحمن السديس' },
  { id: 'maher', name: 'ماهر المعيقلي' },
  { id: 'hudhaify', name: 'علي الحذيفي' },
]

const GROUPS = [
  'الكل', 'المياه', 'السماء',
  'الورود', 'الطبيعة', 'مناظر'
]

const input =
  'mt-2 h-12 w-full rounded-2xl border border-[#e4dfd0] bg-white px-3 text-sm outline-none focus:border-[#baa36f] focus:ring-2 focus:ring-[#baa36f33]'

const mainButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#225242] px-5 py-3 text-sm font-bold text-white disabled:opacity-40'

const secondaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#e3dbcc] bg-white px-5 py-3 text-sm font-bold text-[#285344] disabled:opacity-40'

const panel =
  'rounded-[26px] border border-[#e6e0d2] bg-white p-5 shadow-sm'

const digits = (n: number) =>
  n.toLocaleString('ar-EG', { useGrouping: false })

const timeString = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function createCanvasSize(ratio: string, quality: number) {
  if (ratio === '1:1')
    return { width: quality, height: quality }

  if (ratio === '16:9')
    return { width: Math.round(quality * 16 / 9), height: quality }

  return {
    width: quality,
    height: Math.round(quality * 16 / 9),
  }
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  lines = 9
) {
  const words = text.split(/\s+/).filter(Boolean)
  const result: string[] = []
  let line = ''

  for (const word of words) {
    const next = line ? line + ' ' + word : word

    if (line && ctx.measureText(next).width > max) {
      result.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) result.push(line)
  return result.slice(0, lines)
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

async function getJSON<T>(
  url: string,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, {
    signal,
    cache: 'no-store',
  })
  const body = await res.json()

  if (!res.ok)
    throw new Error(
      body.error || 'تعذّر الاتصال بالخادم. حاول مرة أخرى.'
    )

  return body as T
}

function silenceOtherAudio() {
  document
    .querySelectorAll<HTMLAudioElement>('audio')
    .forEach(a => a.pause())

  const win = window as Window & {
    __samee3PersistentAudio?:
      HTMLAudioElement & { __samee3Continue?: boolean }
  }

  if (win.__samee3PersistentAudio) {
    win.__samee3PersistentAudio.__samee3Continue = false
    win.__samee3PersistentAudio.pause()
  }
}

export default function VisualAyahsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<AudioBufferSourceNode[]>([])
  const animRef = useRef(0)

  const selectedRef = useRef(VISUAL_SCENES[0])
  const clipRef = useRef<Clip | null>(null)
  const preparedRef = useRef<Render | null>(null)

  const optionsRef = useRef({
    ratio: '9:16',
    quality: 720,
    dim: 40,
    color: '#fff8e9',
    fontSize: 54,
    signature: 'مصحف سميع',
  })

  const playRef = useRef({
    playing: false,
    at: 0,
    start: 0,
    ctxStart: 0,
  })

  const jobRef = useRef(0)
  const mediaJobRef = useRef(0)
  const blobURLRef = useRef<string | null>(null)
  const resultURLRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const exporter = useRef<{ cancel: () => void } | null>(null)

  const [step, setStep] = useState(1)
  const [group, setGroup] = useState('الكل')
  const [scene, setScene] = useState<VisualScene>(VISUAL_SCENES[0])
  const [surahs, setSurahs] = useState<Surah[]>(VISUAL_SURAHS)
  const [surah, setSurah] = useState(13)
  const [from, setFrom] = useState(28)
  const [to, setTo] = useState(28)
  const [qari, setQari] = useState('husary')
  const [translation, setTranslation] = useState('none')

  const [mediaStatus, setMediaStatus] =
    useState<'loading' | 'ready' | 'error'>('loading')
  const [mediaMessage, setMediaMessage] = useState('')
  const [clip, setClip] = useState<Clip | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loadingSurahs, setLoadingSurahs] = useState(false)

  const [busy, setBusy] =
    useState<'idle' | 'prepare' | 'export'>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [render, setRender] = useState<Render | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  const [ratio, setRatio] = useState('9:16')
  const [quality, setQuality] = useState(720)
  const [dim, setDim] = useState(40)
  const [color, setColor] = useState('#fff8e9')
  const [fontSize, setFontSize] = useState(54)
  const [signature, setSignature] = useState('مصحف سميع')
  const [videoActive, setVideoActive] = useState(false)

  const choices = useMemo(
    () => VISUAL_SCENES.filter(
      s => group === 'الكل' || s.group === group
    ),
    [group]
  )

  const surahItem = surahs.find(s => s.id === surah)
  const ratioStyle = ratio === '1:1'
    ? '1 / 1'
    : ratio === '16:9' ? '16 / 9' : '9 / 16'

  selectedRef.current = scene
  clipRef.current = clip
  preparedRef.current = render
  optionsRef.current = {
    ratio, quality, dim, color, fontSize, signature
  }

  const locked = busy !== 'idle'

  const resetResult = useCallback(() => {
    setResult(null)
    if (resultURLRef.current)
      URL.revokeObjectURL(resultURLRef.current)
    resultURLRef.current = null
  }, [])

  const stop = useCallback((reset = false) => {
    const player = playRef.current
    if (player.playing && ctxRef.current)
      player.at = Math.max(
        0, ctxRef.current.currentTime - player.ctxStart
      )

    player.playing = false
    nodesRef.current.forEach(node => {
      try {
        node.stop()
        node.disconnect()
      } catch {}
    })
    nodesRef.current = []

    if (reset) player.at = 0
    setPlaying(false)
    setPosition(player.at)
  }, [])

  const invalidate = useCallback(() => {
    jobRef.current++
    stop(true)
    setRender(null)
    setPosition(0)
    resetResult()
    setError('')
  }, [stop, resetResult])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    getJSON<{ surahs: Surah[] }>(
      '/api/visual-ayahs?kind=surahs',
      controller.signal
    )
      .then(data => {
        if (data.surahs?.length === 114)
          setSurahs(data.surahs)
      })
      .catch(() => {
        // الفهرس المحلي موجود، ولن تصبح القائمة فارغة.
      })
      .finally(() => setLoadingSurahs(false))

    return () => {
      controller.abort()
      mountedRef.current = false
    }
  }, [])

  const reloadSurahs = async () => {
    setLoadingSurahs(true)
    setError('')
    try {
      const data = await getJSON<{ surahs: Surah[] }>(
        '/api/visual-ayahs?kind=surahs'
      )
      setSurahs(data.surahs)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'تعذّر تحميل السور'
      )
    } finally {
      setLoadingSurahs(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const job = ++mediaJobRef.current

    setMediaStatus('loading')
    setMediaMessage('جارٍ جلب الفيديو الطبيعي…')
    setClip(null)
    setVideoActive(false)

    if (blobURLRef.current) {
      URL.revokeObjectURL(blobURLRef.current)
      blobURLRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    const work = async () => {
      try {
        let url: string
        let metadata: Clip | null = null

        if (file) {
          if (!file.type.startsWith('video/'))
            throw Error('ارفع ملف فيديو MP4 أو WebM.')

          if (file.size > 80 * 1024 * 1024)
            throw Error('الفيديو يجب أن يكون أقل من 80 ميجابايت.')

          url = URL.createObjectURL(file)
        } else {
          const info = await getJSON<{ clip: Clip }>(
            '/api/visual-ayahs?kind=scene&id=' +
              encodeURIComponent(scene.id),
            controller.signal
          )

          metadata = info.clip

          const res = await fetch(
            '/api/visual-ayahs?kind=clip&id=' +
              encodeURIComponent(scene.id),
            { signal: controller.signal }
          )

          if (!res.ok) {
            const data = await res.json()
            throw Error(data.error || 'تعذّر فتح الفيديو')
          }

          const blob = await res.blob()
          if (blob.size < 2000)
            throw Error('ملف الفيديو غير صالح')

          url = URL.createObjectURL(blob)
        }

        if (
          controller.signal.aborted ||
          job !== mediaJobRef.current
        ) {
          URL.revokeObjectURL(url)
          return
        }

        blobURLRef.current = url
        setClip(metadata)

        if (!video)
          throw Error('مشغل الفيديو غير جاهز')

        video.src = url
        video.muted = true
        video.loop = true
        video.playsInline = true
        video.load()

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error('مهلة تحميل الفيديو انتهت')),
            16000
          )

          video.onloadeddata = () => {
            clearTimeout(timer)
            resolve()
          }

          video.onerror = () => {
            clearTimeout(timer)
            reject(
              Error('صيغة الفيديو لا تعمل على هذا الجهاز. اختر مشهدًا آخر.')
            )
          }
        })

        if (job !== mediaJobRef.current) return

        await video.play().catch(() => {})
        setMediaStatus('ready')
        setMediaMessage('')
        setVideoActive(true)
      } catch (e) {
        if (controller.signal.aborted) return

        setMediaStatus('error')
        setMediaMessage(
          e instanceof Error
            ? e.message
            : 'تعذّر تشغيل المشهد'
        )
      }
    }

    void work()

    return () => {
      controller.abort()
      if (video) {
        video.pause()
        video.onerror = null
        video.onloadeddata = null
      }
    }
  }, [scene, file])

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas) return

    const {
      ratio, quality, dim, color, fontSize, signature
    } = optionsRef.current

    const { width: W, height: H } =
      createCanvasSize(ratio, quality)

    if (
      canvas.width !== W ||
      canvas.height !== H
    ) {
      canvas.width = W
      canvas.height = H
    }

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const scene = selectedRef.current
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, scene.color)
    grad.addColorStop(1, scene.shade)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    if (
      video &&
      video.readyState >= 2 &&
      video.videoWidth > 0
    ) {
      const scale = Math.max(
        W / video.videoWidth,
        H / video.videoHeight
      )
      const dw = video.videoWidth * scale
      const dh = video.videoHeight * scale

      ctx.drawImage(
        video,
        (W - dw) / 2,
        (H - dh) / 2,
        dw,
        dh
      )
    } else {
      // حركة مؤقتة أثناء تحميل الفيديو الحقيقي.
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle =
          `rgba(255,255,255,${.035 + i * .006})`
        ctx.lineWidth = H * .007
        ctx.beginPath()

        for (let x = 0; x <= W; x += 15) {
          const y =
            H * (.54 + i * .065) +
            Math.sin(
              (x / W) * Math.PI * 2 +
              t * .0004 + i
            ) * H * .012

          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    ctx.fillStyle = `rgba(1,15,18,${dim / 100})`
    ctx.fillRect(0, 0, W, H)

    const halo = ctx.createRadialGradient(
      W / 2, H * .47, 0,
      W / 2, H * .47, H * .57
    )
    halo.addColorStop(0, 'rgba(0,0,0,.04)')
    halo.addColorStop(1, 'rgba(0,0,0,.35)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, W, H)

    const border = Math.max(2, W * .003)
    ctx.lineWidth = border
    ctx.strokeStyle = 'rgba(221,193,134,.73)'
    rounded(
      ctx, W * .055, H * .04,
      W * .89, H * .92, W * .025
    )
    ctx.stroke()

    const prepared = preparedRef.current
    const surahName =
      surahs.find(s => s.id === surah)?.name ||
      'القرآن الكريم'

    ctx.textAlign = 'center'
    ctx.direction = 'rtl'
    ctx.fillStyle = '#f0dcab'
    ctx.font =
      `bold ${Math.round(W * .042)}px "Amiri",serif`

    ctx.fillText(
      prepared ? 'تلاوة من ' + surahName : scene.name,
      W / 2, H * .135, W * .8
    )

    const reciter =
      QARIS.find(q => q.id === qari)?.name || ''

    const total = prepared?.duration || 0
    const player = playRef.current
    let seconds = player.at

    if (player.playing && ctxRef.current) {
      seconds = Math.min(
        total,
        ctxRef.current.currentTime - player.ctxStart
      )
    }

    let index = 0
    if (prepared) {
      for (let i = 0; i < prepared.starts.length; i++) {
        if (seconds >= prepared.starts[i]) index = i
      }
    }

    const content =
      prepared?.ayahs[index]?.text ||
      'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ'

    const translation =
      prepared?.ayahs[index]?.translation || ''

    let size = Math.round(W * fontSize / 720)
    let lines: string[] = []

    for (; size > W * .027; size -= 2) {
      ctx.font =
        `${size}px "Amiri Quran","Amiri",serif`

      lines = wrap(ctx, content, W * .78)

      if (
        lines.length * size * 1.7 <
          H * (translation ? .31 : .42) &&
        lines.every(
          l => ctx.measureText(l).width <= W * .8
        )
      ) break
    }

    const row = size * 1.73
    const allH = lines.length * row
    const centerY = H * (translation ? .445 : .50)
    const boxY = centerY - allH / 2 - row * .6

    ctx.fillStyle = 'rgba(3,21,22,.31)'
    rounded(
      ctx, W * .08, boxY,
      W * .84, allH + row * 1.15,
      W * .035
    )
    ctx.fill()

    ctx.fillStyle = color
    ctx.font =
      `${size}px "Amiri Quran","Amiri",serif`

    lines.forEach((line, i) => {
      ctx.fillText(
        line, W / 2,
        centerY - allH / 2 + row * (i + .80),
        W * .78
      )
    })

    if (translation) {
      ctx.font = `${Math.round(W * .029)}px sans-serif`
      const trLines = wrap(
        ctx, translation, W * .76, 4
      )
      ctx.fillStyle = '#f3e7c9'

      trLines.forEach((line, i) => {
        ctx.fillText(
          line, W / 2,
          H * .72 + i * W * .041,
          W * .76
        )
      })
    }

    ctx.fillStyle = '#f0dcab'
    ctx.font =
      `${Math.round(W * .029)}px "Amiri",serif`

    ctx.fillText(
      prepared
        ? `الآية ${digits(prepared.ayahs[index].number)} · ${reciter}`
        : 'مصحف سميع · آيات مرئية',
      W / 2, H * .83, W * .79
    )

    ctx.fillStyle = 'rgba(232,206,158,.85)'
    ctx.fillRect(
      W * .36, H * .87,
      W * .28, Math.max(1, W * .002)
    )

    ctx.font =
      `${Math.round(W * .025)}px sans-serif`

    ctx.fillText(
      signature.slice(0, 45),
      W / 2, H * .915, W * .8
    )

    if (clipRef.current) {
      ctx.font =
        `${Math.max(11, Math.round(W * .015))}px sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,.6)'
      ctx.fillText(
        `المشهد: ${clipRef.current.provider} · ${clipRef.current.license}`,
        W / 2, H * .976, W * .9
      )
    }
  }, [surahs, surah, qari])

  useEffect(() => {
    let last = 0

    const frame = (now: number) => {
      if (now - last >= 33) {
        draw(now)
        last = now
      }

      const prep = preparedRef.current
      const player = playRef.current
      const c = ctxRef.current

      if (prep && player.playing && c) {
        const t = Math.min(
          prep.duration,
          c.currentTime - player.ctxStart
        )

        if (t >= prep.duration) {
          stop(true)
          setPosition(prep.duration)
        } else if (Math.abs(t - player.at) > .20) {
          player.at = t
          setPosition(t)
        }
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw, stop])

  useEffect(() => () => {
    exporter.current?.cancel()
    stop(true)

    void ctxRef.current?.close().catch(() => {})

    if (blobURLRef.current)
      URL.revokeObjectURL(blobURLRef.current)

    if (resultURLRef.current)
      URL.revokeObjectURL(resultURLRef.current)
  }, [stop])

  const selectScene = (next: VisualScene) => {
    if (locked) return
    stop(true)
    resetResult()
    setScene(next)
    setFile(null)
    setError('')
  }

  const prepare = async () => {
    if (locked) return

    if (!surahItem) {
      setError('فهرس السور لم يكتمل.')
      return
    }

    if (
      from < 1 ||
      to < from ||
      to > surahItem.count ||
      to - from >= 10
    ) {
      setError(
        'اختر من آية إلى عشر آيات ضمن السورة.'
      )
      return
    }

    setError('')
    setStatus('جارٍ تحميل الآيات…')
    setBusy('prepare')
    setRender(null)
    stop(true)
    resetResult()
    silenceOtherAudio()

    const job = ++jobRef.current

    try {
      if (!ctxRef.current)
        ctxRef.current = new AudioContext()

      await ctxRef.current.resume()

      const info = await getJSON<{ ayahs: Ayah[] }>(
        `/api/visual-ayahs?kind=ayahs&surah=${surah}&from=${from}&to=${to}&translation=${translation}`
      )

      if (info.ayahs.length !== to - from + 1)
        throw Error('الآيات المستلمة غير مكتملة')

      const buffers: AudioBuffer[] = []
      const starts: number[] = []
      let duration = 0

      for (let i = 0; i < info.ayahs.length; i++) {
        if (job !== jobRef.current) return

        setStatus(
          `تحميل التلاوة ${digits(i + 1)} من ${digits(info.ayahs.length)}`
        )

        const a = info.ayahs[i]
        const url =
          `/api/visual-ayahs?kind=audio&surah=${surah}&ayah=${a.number}&reciter=${qari}`

        const res = await fetch(url)

        if (!res.ok) {
          const json = await res.json().catch(() => null)
          throw Error(
            json?.error || 'تعذّر تحميل التلاوة'
          )
        }

        const bytes = await res.arrayBuffer()
        const buffer =
          await ctxRef.current!.decodeAudioData(bytes)

        starts.push(duration)
        duration += buffer.duration
        buffers.push(buffer)

        if (duration > 90)
          throw Error(
            'طول التلاوة يزيد عن 90 ثانية. قلّل عدد الآيات.'
          )
      }

      if (job !== jobRef.current) return

      const next = {
        ayahs: info.ayahs,
        buffers,
        starts,
        duration,
      }

      preparedRef.current = next
      setRender(next)
      playRef.current.at = 0
      setPosition(0)
      setStep(3)
      setStatus('')
      setError('')
    } catch (e) {
      if (job === jobRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'تعذّر تجهيز التلاوة'
        )
      }
    } finally {
      if (job === jobRef.current)
        setBusy('idle')
    }
  }

  const toggleAudio = async () => {
    const prep = preparedRef.current

    if (!prep || busy !== 'idle') return

    silenceOtherAudio()

    if (playRef.current.playing) {
      stop()
      return
    }

    try {
      if (!ctxRef.current)
        ctxRef.current = new AudioContext()

      const ctx = ctxRef.current
      await ctx.resume()

      const player = playRef.current

      if (player.at >= prep.duration - .1)
        player.at = 0

      const offset = player.at
      const start = ctx.currentTime + .06
      player.ctxStart = start - offset

      prep.buffers.forEach((buffer, i) => {
        const begin = prep.starts[i]
        const end = begin + buffer.duration

        if (end <= offset) return

        const node = ctx.createBufferSource()
        node.buffer = buffer
        node.connect(ctx.destination)
        node.start(
          start + Math.max(0, begin - offset),
          Math.max(0, offset - begin)
        )

        nodesRef.current.push(node)
      })

      player.playing = true
      setPlaying(true)
    } catch {
      setError(
        'تعذّر تشغيل الصوت. جرّب الضغط مرة أخرى.'
      )
    }
  }

  const exportVideo = async () => {
    const prep = preparedRef.current
    const canvas = canvasRef.current
    const ctx = ctxRef.current

    if (!prep || !canvas || !ctx || locked) return

    stop(true)
    resetResult()
    silenceOtherAudio()
    setError('')
    setProgress(0)

    if (mediaStatus !== 'ready') {
      setError(
        'انتظر تحميل الفيديو الطبيعي، أو اختر مشهدًا آخر.'
      )
      return
    }

    if (!canvas.captureStream || !window.MediaRecorder) {
      setError(
        'هذا المتصفح لا يدعم تصدير الفيديو من Canvas.'
      )
      return
    }

    const types = [
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]

    const mime = types.find(type =>
      MediaRecorder.isTypeSupported(type)
    )

    if (!mime) {
      setError(
        'متصفحك لا يدعم MP4 أو WebM. حدّث Safari وجرّب مجددًا.'
      )
      return
    }

    setBusy('export')
    setStatus('جارٍ إنشاء الفيديو…')

    let recorded: MediaRecorder | null = null
    let stream: MediaStream | null = null
    let videoStream: MediaStream | null = null
    let destination: MediaStreamAudioDestinationNode | null = null

    const nodes: AudioBufferSourceNode[] = []
    let ticker = 0
    let timeout = 0
    let canceled = false
    let finished = false

    const abort = () => {
      canceled = true
      if (recorded && recorded.state !== 'inactive')
        recorded.stop()
    }

    exporter.current = { cancel: abort }

    try {
      await ctx.resume()

      const player = playRef.current
      player.at = 0

      const video = videoRef.current
      if (video) {
        video.currentTime = 0
        await video.play().catch(() => {})
      }

      draw(performance.now())

      videoStream = canvas.captureStream(25)
      destination = ctx.createMediaStreamDestination()

      stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ])

      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond:
          quality === 1080 ? 5000000 : 3000000,
      })

      recorded = recorder
      const chunks: BlobPart[] = []

      const blob: Blob = await new Promise(
        (resolve, reject) => {
          const start = ctx.currentTime + .1
          player.ctxStart = start
          player.playing = true

          recorder.ondataavailable = e => {
            if (e.data.size) chunks.push(e.data)
          }

          recorder.onerror = () => {
            reject(
              Error('تعذّر إنشاء الفيديو. جرّب جودة 720p.')
            )
          }

          recorder.onstop = () => {
            if (canceled) {
              reject(new Error('تم إلغاء التصدير'))
              return
            }

            finished = true

            const resultBlob = new Blob(chunks, {
              type: mime.split(';')[0],
            })

            if (resultBlob.size < 3000)
              reject(Error('الفيديو الناتج غير صالح.'))
            else
              resolve(resultBlob)
          }

          recorder.start(400)

          prep.buffers.forEach((buffer, i) => {
            const node = ctx.createBufferSource()
            node.buffer = buffer
            node.connect(destination!)
            node.start(start + prep.starts[i])
            nodes.push(node)
          })

          const loop = () => {
            if (canceled || finished) return

            const t = Math.max(
              0, ctx.currentTime - start
            )

            setProgress(
              Math.min(
                100,
                Math.floor(t / prep.duration * 100)
              )
            )

            if (t >= prep.duration + .2) {
              player.playing = false
              if (recorder.state !== 'inactive')
                recorder.stop()
              return
            }

            ticker = requestAnimationFrame(loop)
          }

          ticker = requestAnimationFrame(loop)

          timeout = window.setTimeout(() => {
            if (!finished) {
              canceled = true
              reject(
                Error('انتهت مهلة التصدير. قلّل عدد الآيات أو الجودة.')
              )
            }
          }, (prep.duration + 25) * 1000)
        }
      )

      if (!canceled && mountedRef.current) {
        const url = URL.createObjectURL(blob)
        resultURLRef.current = url

        setResult({
          blob,
          url,
          name:
            `samee3-${surah}-${from}-${to}.` +
            (blob.type.includes('mp4') ? 'mp4' : 'webm'),
        })

        setProgress(100)
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'حدث خطأ أثناء التصدير'
        )
      }
    } finally {
      exporter.current = null
      cancelAnimationFrame(ticker)
      clearTimeout(timeout)

      playRef.current.playing = false
      playRef.current.at = 0

      nodes.forEach(node => {
        try {
          node.stop()
          node.disconnect()
        } catch {}
      })

      stream?.getTracks().forEach(track => track.stop())
      videoStream?.getTracks().forEach(track => track.stop())
      destination?.disconnect()

      if (
        recorded &&
        (recorded as MediaRecorder).state !== 'inactive'
      ) {
        try {
          (recorded as MediaRecorder).stop()
        } catch {}
      }

      if (mountedRef.current) {
        setBusy('idle')
        setStatus('')
        setPlaying(false)
        setPosition(0)
      }
    }
  }

  const share = async () => {
    if (!result) return

    try {
      const media = new File(
        [result.blob],
        result.name,
        { type: result.blob.type }
      )

      if (navigator.canShare?.({ files: [media] })) {
        await navigator.share({
          files: [media],
          title: 'آيات مرئية — مصحف سميع',
        })
      } else {
        setError('نزّل المقطع وشاركه من هاتفك.')
      }
    } catch (e) {
      if (
        !(e instanceof Error && e.name === 'AbortError')
      ) {
        setError(
          'المشاركة غير متاحة. نزّل الفيديو أولًا.'
        )
      }
    }
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-[#f8f6f0] pb-32 text-[#263c32]"
    >
      <header className="border-b border-[#e6ddc9] bg-[#fffcf6] px-4 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e3dccb] bg-white"
            aria-label="الرئيسية"
          >
            <ArrowRight size={19} />
          </Link>

          <div className="flex-1">
            <h1 className="text-xl font-extrabold">
              آيات مرئية
            </h1>
            <p className="mt-1 text-xs text-[#81877d]">
              استوديو سميع · مقاطع قرآن بخلفيات طبيعية متحركة
            </p>
          </div>

          <span className="rounded-xl bg-[#eae2cc] px-3 py-2 font-bold text-[#947943]">
            50
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <nav
          aria-label="خطوات إنشاء الفيديو"
          className="mb-5 grid grid-cols-3 gap-2"
        >
          {[
            'المشهد المتحرك',
            'السورة والتلاوة',
            'المعاينة والحفظ',
          ].map((name, i) => (
            <button
              key={name}
              disabled={locked || (i === 2 && !render)}
              onClick={() => setStep(i + 1)}
              className={
                `rounded-2xl px-2 py-3 text-[11px] font-bold sm:text-sm ` +
                (step === i + 1
                  ? 'bg-[#205441] text-white'
                  : 'bg-[#ece8dd] text-[#788078]')
              }
            >
              {i + 1}. {name}
            </button>
          ))}
        </nav>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <p className="flex-1 leading-7">{error}</p>
            <button
              onClick={() => setError('')}
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="order-2 lg:order-1">
            {step === 1 && (
              <>
                <h2 className="text-xl font-extrabold">
                  50 مشهدًا من الطبيعة الحقيقية
                </h2>

                <p className="mt-2 text-sm leading-7 text-[#768075]">
                  ماء متحرك، ورود، غيوم من الطائرة، أمطار،
                  شلالات وغابات. يتم تحميل الفيديو عند اختياره.
                </p>

                <div className="my-4 flex flex-wrap gap-2">
                  {GROUPS.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroup(g)}
                      aria-pressed={group === g}
                      className={
                        'rounded-full px-4 py-2 text-xs font-semibold ' +
                        (group === g
                          ? 'bg-[#225442] text-white'
                          : 'border border-[#e2dac9] bg-white')
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {choices.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectScene(s)}
                      disabled={locked}
                      aria-pressed={scene.id === s.id}
                      className="text-right"
                    >
                      <div
                        className={
                          'relative aspect-[4/5] overflow-hidden rounded-[20px] border-[3px] ' +
                          (scene.id === s.id
                            ? 'border-[#ba984f]'
                            : 'border-white')
                        }
                        style={{
                          background:
                            `linear-gradient(145deg,${s.color},${s.shade})`,
                        }}
                      >
                        {scene.id === s.id &&
                        mediaStatus === 'ready' &&
                        blobURLRef.current ? (
                          <video
                            src={blobURLRef.current}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-70">
                            {s.emoji}
                          </span>
                        )}

                        <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white">
                          فيديو طبيعي
                        </span>

                        {scene.id === s.id && (
                          <span className="absolute left-2 top-2 rounded-full bg-[#f1d38c] p-1 text-[#2f4839]">
                            <Check size={16} />
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm font-bold">
                        {s.name}
                      </p>
                      <p className="text-[11px] text-[#85877e]">
                        {s.group}
                      </p>
                    </button>
                  ))}
                </div>

                <label className={`${secondaryButton} mt-5 w-full cursor-pointer`}>
                  <ImagePlus size={18} />
                  أو استخدم فيديو من جهازك

                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="sr-only"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      e.currentTarget.value = ''

                      if (f) {
                        stop(true)
                        setFile(f)
                        setError('')
                      }
                    }}
                  />
                </label>

                {file && (
                  <p className="mt-2 text-xs text-[#69786d]">
                    المقطع: {file.name}
                    <button
                      className="mr-2 underline"
                      onClick={() => setFile(null)}
                    >
                      إزالة
                    </button>
                  </p>
                )}

                <button
                  className={`${mainButton} mt-4 w-full`}
                  onClick={() => setStep(2)}
                  disabled={locked}
                >
                  التالي: اختر السورة والقارئ
                  <ChevronLeft size={18} />
                </button>
              </>
            )}

            {step === 2 && (
              <div className={panel}>
                <h2 className="text-xl font-extrabold">
                  اختيار السورة والتلاوة
                </h2>

                <p className="mt-2 text-sm leading-7 text-[#7d8479]">
                  قائمة السور مستقلة عن مشغل الفيديو، وتظهر
                  حتى عند تأخر تحميل الخلفية.
                </p>

                <fieldset
                  disabled={locked || loadingSurahs}
                  className="mt-5 space-y-4"
                >
                  <label className="block text-sm font-bold">
                    السورة

                    <select
                      className={input}
                      value={surah}
                      onChange={e => {
                        const n = Number(e.target.value)
                        setSurah(n)
                        setFrom(1)
                        setTo(1)
                        invalidate()
                      }}
                    >
                      {surahs.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {surahs.length === 0 && (
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => void reloadSurahs()}
                    >
                      <RefreshCcw size={16} />
                      تحديث قائمة السور
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-bold">
                      من الآية

                      <input
                        className={input}
                        type="number"
                        min={1}
                        max={surahItem?.count || 286}
                        value={from}
                        onChange={e => {
                          setFrom(Number(e.target.value))
                          invalidate()
                        }}
                      />
                    </label>

                    <label className="text-sm font-bold">
                      إلى الآية

                      <input
                        className={input}
                        type="number"
                        min={1}
                        max={surahItem?.count || 286}
                        value={to}
                        onChange={e => {
                          setTo(Number(e.target.value))
                          invalidate()
                        }}
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-bold">
                    القارئ

                    <select
                      className={input}
                      value={qari}
                      onChange={e => {
                        setQari(e.target.value)
                        invalidate()
                      }}
                    >
                      {QARIS.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-bold">
                    الترجمة

                    <select
                      className={input}
                      value={translation}
                      onChange={e => {
                        setTranslation(e.target.value)
                        invalidate()
                      }}
                    >
                      <option value="none">بدون ترجمة</option>
                      <option value="en.sahih">الإنجليزية</option>
                      <option value="fr.hamidullah">الفرنسية</option>
                    </select>
                  </label>
                </fieldset>

                <p className="mt-4 text-xs text-[#8a8a7e]">
                  رواية حفص · حتى 10 آيات · أقل من 90 ثانية
                </p>

                <button
                  className={`${mainButton} mt-5 w-full`}
                  disabled={locked || surahs.length !== 114}
                  onClick={() => void prepare()}
                >
                  {busy === 'prepare' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Volume2 size={18} />
                  )}

                  {busy === 'prepare'
                    ? status
                    : 'تجهيز الآيات والتلاوة'}
                </button>

                <button
                  className={`${secondaryButton} mt-3 w-full`}
                  disabled={locked}
                  onClick={() => setStep(1)}
                >
                  رجوع إلى المشاهد
                </button>
              </div>
            )}

            {step === 3 && render && (
              <div className="space-y-4">
                <div className={panel}>
                  <h2 className="text-xl font-extrabold">
                    تخصيص الفيديو
                  </h2>

                  <p className="mt-2 text-sm text-[#738174]">
                    {surahItem?.name} ·{' '}
                    {QARIS.find(r => r.id === qari)?.name}
                    {' · '}{timeString(render.duration)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold">
                      مقاس الفيديو

                      <select
                        className={input}
                        value={ratio}
                        onChange={e => {
                          setRatio(e.target.value)
                          resetResult()
                        }}
                      >
                        <option value="9:16">عمودي 9:16</option>
                        <option value="1:1">مربع 1:1</option>
                        <option value="16:9">أفقي 16:9</option>
                      </select>
                    </label>

                    <label className="text-xs font-bold">
                      جودة الفيديو

                      <select
                        className={input}
                        value={quality}
                        onChange={e => {
                          setQuality(Number(e.target.value))
                          resetResult()
                        }}
                      >
                        <option value={720}>720p</option>
                        <option value={1080}>1080p</option>
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block text-sm font-bold">
                    تعتيم الخلفية: {digits(dim)}٪

                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={dim}
                      onChange={e => {
                        setDim(Number(e.target.value))
                        resetResult()
                      }}
                      className="mt-2 w-full accent-[#aa8c51]"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-bold">
                    حجم الخط: {digits(fontSize)}

                    <input
                      type="range"
                      min={28}
                      max={85}
                      value={fontSize}
                      onChange={e => {
                        setFontSize(Number(e.target.value))
                        resetResult()
                      }}
                      className="mt-2 w-full accent-[#aa8c51]"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-bold">
                    لون القرآن

                    <input
                      type="color"
                      value={color}
                      onChange={e => {
                        setColor(e.target.value)
                        resetResult()
                      }}
                      className="mt-2 block h-11 w-full"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-bold">
                    توقيع الفيديو

                    <input
                      className={input}
                      value={signature}
                      maxLength={45}
                      onChange={e => {
                        setSignature(e.target.value)
                        resetResult()
                      }}
                    />
                  </label>
                </div>

                {busy === 'export' ? (
                  <div className={panel} role="status">
                    <div className="flex justify-between text-sm font-bold">
                      <span>{status}</span>
                      <span>{digits(progress)}٪</span>
                    </div>

                    <progress
                      value={progress}
                      max={100}
                      className="mt-4 w-full accent-[#947640]"
                    />

                    <p className="mt-2 text-xs text-[#85877e]">
                      اترك الصفحة مفتوحة حتى يكتمل الفيديو.
                    </p>

                    <button
                      onClick={() => exporter.current?.cancel()}
                      className={`${secondaryButton} mt-3 w-full`}
                    >
                      إلغاء الإنشاء
                    </button>
                  </div>
                ) : (
                  <button
                    className={`${mainButton} w-full`}
                    disabled={mediaStatus !== 'ready'}
                    onClick={() => void exportVideo()}
                  >
                    <Film size={18} />
                    إنشاء الفيديو المتحرك
                  </button>
                )}

                {result && (
                  <div className={panel}>
                    <h3 className="mb-3 font-bold">
                      الفيديو جاهز
                    </h3>

                    <video
                      key={result.url}
                      src={result.url}
                      controls
                      playsInline
                      className="max-h-80 w-full rounded-2xl bg-black"
                    />

                    <div className="mt-3 flex gap-2">
                      <a
                        href={result.url}
                        download={result.name}
                        className={`${mainButton} flex-1`}
                      >
                        <Download size={17} />
                        تنزيل
                      </a>

                      <button
                        className={secondaryButton}
                        onClick={() => void share()}
                      >
                        <Share2 size={17} />
                        مشاركة
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className={`${secondaryButton} w-full`}
                  disabled={locked}
                  onClick={() => setStep(2)}
                >
                  تغيير السورة أو القارئ
                </button>
              </div>
            )}
          </section>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-4">
            <div className="mb-2 flex justify-between">
              <strong className="text-sm">
                المعاينة المباشرة
              </strong>
              <span className="text-xs text-[#7a8578]">
                {file ? file.name : scene.name}
              </span>
            </div>

            <div
              className="relative mx-auto max-w-[330px] overflow-hidden rounded-[24px] bg-[#163c38] shadow-lg"
              style={{ aspectRatio: ratioStyle }}
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                aria-label="معاينة الآيات مع مشهد طبيعي متحرك"
              />

              <video
                ref={videoRef}
                muted
                playsInline
                loop
                preload="none"
                aria-hidden="true"
                className="pointer-events-none absolute h-px w-px opacity-0"
              />

              {mediaStatus === 'loading' && (
                <div className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-2 rounded-xl bg-black/65 p-3 text-center text-xs text-white">
                  <Loader2
                    className="animate-spin"
                    size={15}
                  />
                  {mediaMessage}
                </div>
              )}

              {mediaStatus === 'error' && (
                <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 p-3 text-center text-xs leading-6 text-white">
                  {mediaMessage}

                  <p className="mt-1 text-amber-100">
                    اختر مشهدًا آخر أو ارفع مقطعًا من جهازك.
                  </p>
                </div>
              )}
            </div>

            {render && (
              <div className="mx-auto mt-3 flex max-w-[330px] items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#285644] text-white"
                  onClick={() => void toggleAudio()}
                  disabled={locked}
                  aria-label={
                    playing
                      ? 'إيقاف التلاوة'
                      : 'تشغيل التلاوة'
                  }
                >
                  {playing
                    ? <Pause size={19} />
                    : <Play size={19} />}
                </button>

                <div className="flex-1">
                  <progress
                    value={position}
                    max={render.duration}
                    className="h-1 w-full accent-[#aa8b51]"
                  />

                  <p
                    className="mt-1 text-center text-xs text-[#818578]"
                    dir="ltr"
                  >
                    {timeString(position)}
                    {' / '}
                    {timeString(render.duration)}
                  </p>
                </div>

                <button
                  className="p-2 text-[#68816e]"
                  aria-label="إعادة"
                  onClick={() => stop(true)}
                >
                  <RefreshCcw size={17} />
                </button>
              </div>
            )}

            {clip && (
              <p className="mt-3 text-center text-[11px] leading-6 text-[#7c8177]">
                فيديو مرخّص من {clip.provider}: {clip.license}
                {' · '}{clip.artist}
                {' — '}
                <a
                  href={clip.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  مصدر الفيديو وترخيصه
                </a>
              </p>
            )}

            <p className="mx-auto mt-3 max-w-[330px] text-center text-[11px] leading-6 text-[#7c8376]">
              {videoActive
                ? 'الخلفية فيديو طبيعي متحرك فعليًا، وليست صورة ثابتة.'
                : 'المشهد المعروض مؤقت حتى تحميل الفيديو الطبيعي.'}
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
