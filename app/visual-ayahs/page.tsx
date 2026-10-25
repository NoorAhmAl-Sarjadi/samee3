'use client'

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, Download, ExternalLink, Film,
  Loader2, Pause, Play, RefreshCcw, Share2, Upload,
  Volume2, X,
} from 'lucide-react'
import {
  GROUPS, SCENES, type Scene,
} from '@/lib/samee3-visual-library'
import {
  clipKeys, readClip, saveClip,
} from '@/lib/samee3-visual-storage'

type Surah = {
  id: number
  name: string
  count: number
}
type Verse = {
  number: number
  text: string
}
type Prepared = {
  verses: Verse[]
  buffers: AudioBuffer[]
  starts: number[]
  duration: number
}
type MadeVideo = {
  blob: Blob
  url: string
  filename: string
}

const names = 'الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس'.split('|')

const counts = [
  7,286,200,176,120,165,206,75,129,109,123,111,
  43,52,99,128,111,110,98,135,112,78,118,64,
  77,227,93,88,69,60,34,30,73,54,45,83,182,
  88,75,85,54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,14,11,11,
  18,12,12,30,52,52,44,28,28,20,56,40,31,
  50,40,46,42,29,19,36,25,22,17,19,26,30,
  20,15,21,11,8,8,19,5,8,8,11,11,8,3,
  9,5,4,7,3,6,3,5,4,5,6,
]

const fallbackSurahs: Surah[] = names.map(
  (name, i) => ({
    id: i + 1,
    name,
    count: counts[i],
  })
)

const READERS = [
  { id: 'husary', name: 'محمود خليل الحصري' },
  { id: 'afasy', name: 'مشاري راشد العفاسي' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي' },
  { id: 'basit', name: 'عبد الباسط عبد الصمد' },
  { id: 'maher', name: 'ماهر المعيقلي' },
  { id: 'sudais', name: 'عبد الرحمن السديس' },
]

const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-45'

const primary = btn + ' bg-[#245343] text-white'
const secondary =
  btn + ' border border-[#e0d9c8] bg-white text-[#2a5446]'

const input =
  'mt-2 w-full rounded-2xl border border-[#e1d9c7] bg-white p-3 text-sm outline-none focus:border-[#aa8c4f]'

const panel =
  'rounded-[26px] border border-[#e6dfd1] bg-white p-5 shadow-sm'

const ar = (n: number) =>
  n.toLocaleString('ar-EG', { useGrouping: false })

const timerLabel = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

async function api<T>(
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(
    '/api/visual-ayahs?' + new URLSearchParams(params),
    { signal, cache: 'no-store' }
  )
  const body = await res.json()
  if (!res.ok) {
    throw Error(
      typeof body.error === 'string'
        ? body.error
        : 'تعذر تحميل البيانات'
    )
  }
  return body as T
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const rows: string[] = []
  let row = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = row ? row + ' ' + word : word
    if (row && ctx.measureText(next).width > maxWidth) {
      rows.push(row)
      row = word
    } else {
      row = next
    }
  }
  if (row) rows.push(row)
  return rows
}

function hushAudio() {
  document.querySelectorAll<HTMLAudioElement>('audio')
    .forEach(a => a.pause())

  const w = window as Window & {
    __samee3PersistentAudio?:
      HTMLAudioElement & { __samee3Continue?: boolean }
  }

  if (w.__samee3PersistentAudio) {
    w.__samee3PersistentAudio.__samee3Continue = false
    w.__samee3PersistentAudio.pause()
  }
}

export default function VisualAyahsPage() {
  const [step, setStep] = useState(1)
  const [group, setGroup] = useState('الكل')
  const [scene, setScene] = useState<Scene>(SCENES[0])
  const [cached, setCached] = useState<string[]>([])
  const [sceneRevision, setSceneRevision] = useState(0)
  const [backgroundReady, setBackgroundReady] = useState(false)
  const [backgroundStatus, setBackgroundStatus] = useState('')
  const [surahs, setSurahs] = useState<Surah[]>(fallbackSurahs)
  const [surah, setSurah] = useState(13)
  const [verses, setVerses] = useState<Verse[]>([])
  const [verseLoading, setVerseLoading] = useState(true)
  const [verseError, setVerseError] = useState('')
  const [verseRetry, setVerseRetry] = useState(0)
  const [start, setStart] = useState(28)
  const [end, setEnd] = useState(28)
  const [reader, setReader] = useState('husary')
  const [busy, setBusy] =
    useState<'idle' | 'prepare' | 'export'>('idle')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [result, setResult] = useState<MadeVideo | null>(null)
  const [ratio, setRatio] =
    useState<'9:16' | '1:1' | '16:9'>('9:16')
  const [quality, setQuality] = useState(720)
  const [shade, setShade] = useState(45)
  const [signature, setSignature] = useState('مصحف سميع')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const playingRef = useRef({
    active: false,
    at: 0,
    ctxStart: 0,
  })
  const prepRef = useRef<Prepared | null>(null)
  const dataRef = useRef({
    verses, surahs, surah, start, end, scene,
    reader, ratio, quality, shade, signature,
  })
  const resultURL = useRef<string | null>(null)
  const requestRef = useRef(0)
  const playerRAF = useRef(0)
  const stopExportRef = useRef<(() => void) | null>(null)

  prepRef.current = prepared
  dataRef.current = {
    verses, surahs, surah, start, end, scene,
    reader, ratio, quality, shade, signature,
  }

  const selected = useMemo(
    () => verses.filter(
      v => v.number >= start && v.number <= end
    ),
    [verses, start, end]
  )

  const chapter = surahs.find(s => s.id === surah)
  const active = busy !== 'idle'

  const aspect =
    ratio === '9:16'
      ? '9 / 16'
      : ratio === '1:1' ? '1 / 1' : '16 / 9'

  const visibleScenes = SCENES.filter(
    s => group === 'الكل' || group === s.group
  )

  const clearResult = useCallback(() => {
    if (resultURL.current) {
      URL.revokeObjectURL(resultURL.current)
    }
    resultURL.current = null
    setResult(null)
  }, [])

  const stopAudio = useCallback((reset = false) => {
    const p = playingRef.current

    if (p.active && audioRef.current) {
      p.at = Math.max(
        0,
        audioRef.current.currentTime - p.ctxStart
      )
    }

    p.active = false
    sourcesRef.current.forEach(n => {
      try {
        n.stop()
        n.disconnect()
      } catch {}
    })
    sourcesRef.current = []

    if (reset) p.at = 0
    setPlaying(false)
    setPosition(p.at)
  }, [])

  const invalidate = useCallback(() => {
    requestRef.current++
    stopAudio(true)
    setPrepared(null)
    clearResult()
    setError('')
  }, [stopAudio, clearResult])

  useEffect(() => {
    let canceled = false

    void clipKeys()
      .then(keys => {
        if (!canceled) setCached(keys)
      })
      .catch(() => {})

    const controller = new AbortController()

    void api<{ surahs: Surah[] }>(
      { kind: 'surahs' },
      controller.signal
    ).then(data => {
      if (!canceled && data.surahs.length === 114) {
        setSurahs(data.surahs)
      }
    }).catch(() => {})

    return () => {
      canceled = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    setVerseLoading(true)
    setVerseError('')
    setVerses([])

    void api<{ ayahs: Verse[] }>(
      { kind: 'verses', surah: String(surah) },
      controller.signal
    ).then(data => {
      if (!controller.signal.aborted) {
        setVerses(data.ayahs)
      }
    }).catch(e => {
      if (!controller.signal.aborted) {
        setVerseError(
          e instanceof Error
            ? e.message
            : 'تعذر تحميل السورة'
        )
      }
    }).finally(() => {
      if (!controller.signal.aborted) {
        setVerseLoading(false)
      }
    })

    return () => controller.abort()
  }, [surah, verseRetry])

  useEffect(() => {
    let canceled = false
    let ownedURL: string | null = null
    const v = videoRef.current
    if (!v) return

    v.pause()
    v.removeAttribute('src')
    v.load()

    setBackgroundReady(false)
    setBackgroundStatus('جارٍ فحص الخلفية…')

    const show = async () => {
      try {
        const saved = await readClip(scene.id)
          .catch(() => null)

        if (canceled) return

        if (saved) {
          ownedURL = URL.createObjectURL(saved)
        } else {
          const url = scene.id === 'flowers-demo'
            ? '/api/visual-ayahs?kind=demo'
            : '/visual-backgrounds/' + scene.id + '.mp4'

          const head = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store',
          })

          if (canceled) return

          if (
            head.ok &&
            (head.headers.get('content-type') || '')
              .includes('video/')
          ) {
            ownedURL = url
          }
        }

        if (!ownedURL) {
          setBackgroundStatus(
            'المقطع غير مثبت بعد. افتح المصدر، نزّل فيديو Free License ثم أضفه من زر «استيراد MP4».'
          )
          return
        }

        v.src = ownedURL
        v.loop = true
        v.muted = true
        v.playsInline = true
        v.load()

        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            v.onloadeddata = null
            v.onerror = null
            clearTimeout(wait)
          }

          const wait = setTimeout(() => {
            cleanup()
            reject(Error('انتهت مهلة فتح الفيديو'))
          }, 18000)

          v.onloadeddata = () => {
            cleanup()
            resolve()
          }

          v.onerror = () => {
            cleanup()
            reject(
              Error('صيغة الفيديو غير مدعومة على جهازك')
            )
          }
        })

        if (canceled) return

        await v.play().catch(() => {})
        setBackgroundReady(true)
        setBackgroundStatus('')
      } catch (e) {
        if (!canceled) {
          setBackgroundStatus(
            e instanceof Error
              ? e.message
              : 'تعذّر تشغيل الخلفية'
          )
        }
      }
    }

    void show()

    return () => {
      canceled = true
      v.pause()
      v.onloadeddata = null
      v.onerror = null
      v.removeAttribute('src')

      if (ownedURL?.startsWith('blob:')) {
        URL.revokeObjectURL(ownedURL)
      }
    }
  }, [scene.id, sceneRevision])

  const drawFrame = useCallback((now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const {
      verses: all,
      surahs: chapters,
      surah: surahID,
      start: first,
      scene: sc,
      ratio: r,
      quality: q,
      shade: dim,
      signature: mark,
      reader: reciter,
    } = dataRef.current

    const W = r === '16:9'
      ? Math.round(q * 16 / 9)
      : q

    const H = r === '9:16'
      ? Math.round(q * 16 / 9)
      : q

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }

    const ctx = canvas.getContext('2d', {
      alpha: false,
    })
    if (!ctx) return

    const gradient = ctx.createLinearGradient(0, 0, W, H)
    gradient.addColorStop(0, sc.tint)
    gradient.addColorStop(1, '#122f30')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, W, H)

    const movie = videoRef.current

    if (
      movie &&
      movie.readyState >= 2 &&
      movie.videoWidth
    ) {
      const k = Math.max(
        W / movie.videoWidth,
        H / movie.videoHeight
      )
      const w = movie.videoWidth * k
      const h = movie.videoHeight * k

      try {
        ctx.drawImage(
          movie,
          (W - w) / 2,
          (H - h) / 2,
          w,
          h
        )
      } catch {}
    }

    ctx.fillStyle = `rgba(0,9,14,${dim / 100})`
    ctx.fillRect(0, 0, W, H)

    const glow = ctx.createRadialGradient(
      W / 2, H / 2, W * .05,
      W / 2, H / 2, H * .68
    )
    glow.addColorStop(0, 'rgba(0,0,0,.03)')
    glow.addColorStop(1, 'rgba(0,0,0,.32)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(220,187,123,.75)'
    ctx.lineWidth = Math.max(2, W * .002)
    ctx.strokeRect(
      W * .055, H * .043,
      W * .89, H * .913
    )

    ctx.direction = 'rtl'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const chapterName =
      chapters.find(s => s.id === surahID)?.name ||
      'القرآن الكريم'

    ctx.fillStyle = '#e7c990'
    ctx.font =
      `bold ${Math.round(W * .039)}px Amiri,serif`

    ctx.fillText(
      'سورة ' + chapterName,
      W / 2, H * .13, W * .8
    )

    const prep = prepRef.current
    const p = playingRef.current

    let seconds = p.at

    if (p.active && audioRef.current) {
      seconds = Math.max(
        0,
        audioRef.current.currentTime - p.ctxStart
      )
    }

    let at = 0

    if (prep) {
      for (let i = 0; i < prep.starts.length; i++) {
        if (seconds >= prep.starts[i]) {
          at = i
        }
      }
    }

    const current =
      prep?.verses[at] ||
      all.find(v => v.number === first)

    const text = current?.text ||
      'جارٍ تحميل آيات السورة…'

    let fontSize = W * .063
    let rows: string[] = []

    for (; fontSize > W * .025; fontSize -= 2) {
      ctx.font =
        `${fontSize}px "Amiri Quran",Amiri,serif`

      rows = wrapText(ctx, text, W * .77)

      if (
        rows.length * fontSize * 1.7 < H * .39 &&
        rows.every(
          line => ctx.measureText(line).width <= W * .79
        )
      ) {
        break
      }
    }

    const lineH = fontSize * 1.78
    const top =
      H * .51 - rows.length * lineH / 2

    ctx.fillStyle = 'rgba(0,21,23,.35)'
    ctx.fillRect(
      W * .075,
      top - lineH * .75,
      W * .85,
      rows.length * lineH + lineH * 1.4
    )

    ctx.fillStyle = '#fff7e8'
    ctx.font =
      `${fontSize}px "Amiri Quran",Amiri,serif`

    rows.forEach((line, i) => {
      ctx.fillText(
        line,
        W / 2,
        top + i * lineH + lineH / 2,
        W * .78
      )
    })

    ctx.fillStyle = '#dfc38b'
    ctx.font =
      `${Math.round(W * .029)}px Amiri,serif`

    if (current) {
      ctx.fillText(
        '﴿ ' + ar(current.number) + ' ﴾',
        W / 2,
        Math.min(
          H * .77,
          top + rows.length * lineH + lineH * .6
        ),
        W * .7
      )
    }

    ctx.font =
      `${Math.round(W * .031)}px Amiri,serif`

    ctx.fillText(
      READERS.find(x => x.id === reciter)?.name || '',
      W / 2,
      H * .855,
      W * .78
    )

    ctx.font =
      `${Math.round(W * .024)}px sans-serif`

    ctx.fillText(
      mark.slice(0, 45),
      W / 2, H * .918, W * .8
    )

    void now
  }, [])

  useEffect(() => {
    let last = 0

    const loop = (now: number) => {
      if (now - last >= 34) {
        drawFrame(now)
        last = now
      }

      const prep = prepRef.current
      const p = playingRef.current

      if (prep && p.active && audioRef.current) {
        const t = Math.max(
          0,
          audioRef.current.currentTime - p.ctxStart
        )

        if (t >= prep.duration) {
          stopAudio(true)
          setPosition(prep.duration)
        } else if (Math.abs(t - p.at) > .15) {
          p.at = t
          setPosition(t)
        }
      }

      playerRAF.current =
        requestAnimationFrame(loop)
    }

    playerRAF.current =
      requestAnimationFrame(loop)

    return () =>
      cancelAnimationFrame(playerRAF.current)
  }, [drawFrame, stopAudio])

  useEffect(() => () => {
    stopExportRef.current?.()

    sourcesRef.current.forEach(n => {
      try { n.stop() } catch {}
    })

    if (audioRef.current) {
      void audioRef.current.close().catch(() => {})
    }

    if (resultURL.current) {
      URL.revokeObjectURL(resultURL.current)
    }
  }, [])

  const importVideo = async (file: File) => {
    if (
      !/\.(mp4|webm)$/i.test(file.name) ||
      !file.type.startsWith('video/')
    ) {
      setError('اختر ملف MP4 أو WebM صالحًا.')
      return
    }

    if (file.size > 40 * 1024 * 1024) {
      setError('اختر فيديو أقل من 40 ميجابايت.')
      return
    }

    setStatus('جارٍ حفظ الخلفية على جهازك…')
    setError('')

    try {
      await saveClip(scene.id, file)
      setCached(keys =>
        Array.from(new Set([...keys, scene.id]))
      )
      setSceneRevision(v => v + 1)
      setStatus(
        'تم حفظ الخلفية على هذا الجهاز فقط. لإتاحتها للجميع ارفعها إلى public/visual-backgrounds باسم القالب.'
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'تعذّر حفظ الفيديو'
      )
    }
  }

  const selectScene = (s: Scene) => {
    if (active) return
    stopAudio(true)
    clearResult()
    setScene(s)
    setError('')
    setStep(1)
  }

  const changeSurah = (id: number) => {
    setSurah(id)
    setStart(1)
    setEnd(1)
    invalidate()
  }

  const chooseStart = (n: number) => {
    setStart(n)
    setEnd(n)
    invalidate()
  }

  const chooseEnd = (n: number) => {
    if (n < start || n - start > 9) {
      setError(
        'اختر نهاية بعد البداية، وبحد أقصى 10 آيات.'
      )
      return
    }

    setEnd(n)
    invalidate()
  }

  const prepare = async () => {
    if (active) return

    if (
      !verses.length ||
      !selected.length ||
      end - start > 9
    ) {
      setError('اختر آيات صحيحة أولًا.')
      return
    }

    const ticket = ++requestRef.current
    stopAudio(true)
    setPrepared(null)
    clearResult()
    hushAudio()

    setError('')
    setStatus('جارٍ تجهيز الآيات…')
    setBusy('prepare')

    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext()
      }

      await audioRef.current.resume()

      const buffers: AudioBuffer[] = []
      const starts: number[] = []
      let duration = 0

      for (let i = 0; i < selected.length; i++) {
        if (ticket !== requestRef.current) return

        setStatus(
          `تحميل التلاوة ${ar(i + 1)} من ${ar(selected.length)}`
        )

        const url =
          '/api/visual-ayahs?' +
          new URLSearchParams({
            kind: 'audio',
            surah: String(surah),
            ayah: String(selected[i].number),
            reciter: reader,
          })

        const response = await fetch(url)

        if (!response.ok) {
          const body = await response.json()
            .catch(() => ({}))
          throw Error(
            body.error || 'تعذّر تحميل التلاوة'
          )
        }

        const buffer =
          await audioRef.current.decodeAudioData(
            await response.arrayBuffer()
          )

        if (ticket !== requestRef.current) return

        starts.push(duration)
        buffers.push(buffer)
        duration += buffer.duration

        if (duration > 90) {
          throw Error(
            'اختر آيات لا تتجاوز تلاوتها 90 ثانية لتفادي الضغط على الآيفون.'
          )
        }
      }

      if (ticket !== requestRef.current) return

      const next: Prepared = {
        verses: selected,
        buffers,
        starts,
        duration,
      }

      prepRef.current = next
      setPrepared(next)
      setStep(3)
      setPosition(0)
      setStatus('')
    } catch (e) {
      if (ticket === requestRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'تعذر تجهيز التلاوة'
        )
      }
    } finally {
      if (ticket === requestRef.current) {
        setBusy('idle')
      }
    }
  }

  const playPause = async () => {
    const prep = prepRef.current
    if (!prep || active) return

    if (playingRef.current.active) {
      stopAudio()
      return
    }

    hushAudio()

    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext()
      }

      const ctx = audioRef.current
      await ctx.resume()

      const p = playingRef.current

      if (p.at >= prep.duration - .1) {
        p.at = 0
      }

      const offset = p.at
      const startAt = ctx.currentTime + .05
      p.ctxStart = startAt - offset

      prep.buffers.forEach((buffer, i) => {
        if (
          prep.starts[i] + buffer.duration <= offset
        ) return

        const node = ctx.createBufferSource()
        node.buffer = buffer
        node.connect(ctx.destination)

        node.start(
          startAt +
            Math.max(0, prep.starts[i] - offset),
          Math.max(0, offset - prep.starts[i])
        )

        sourcesRef.current.push(node)
      })

      p.active = true
      setPlaying(true)
      void videoRef.current?.play().catch(() => {})
    } catch {
      setError(
        'تعذّر تشغيل الصوت. اضغط تشغيل التلاوة مرة أخرى.'
      )
    }
  }

  const exportVideo = async () => {
    const prep = prepRef.current
    const canvas = canvasRef.current
    const context = audioRef.current
    const video = videoRef.current

    if (
      !prep || !canvas || !context ||
      !video || active
    ) return

    if (!backgroundReady || video.readyState < 2) {
      setError(
        'يجب استيراد الخلفية المتحركة أولًا.'
      )
      return
    }

    if (
      !canvas.captureStream ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(
        'المتصفح الحالي لا يدعم تسجيل الفيديو من Canvas. جرّب Chrome على الكمبيوتر.'
      )
      return
    }

    const mime = [
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(type =>
      MediaRecorder.isTypeSupported(type)
    )

    if (!mime) {
      setError(
        'المتصفح لا يدعم التصدير إلى MP4 أو WebM.'
      )
      return
    }

    stopAudio(true)
    clearResult()
    hushAudio()

    setError('')
    setProgress(0)
    setStatus('جارٍ تجهيز الفيديو…')
    setBusy('export')

    let recorder: MediaRecorder | null = null
    let canvasStream: MediaStream | null = null
    let stream: MediaStream | null = null
    let output: MediaStreamAudioDestinationNode | null = null
    let raf = 0
    let timeout = 0
    let canceled = false

    const nodes: AudioBufferSourceNode[] = []

    try {
      await context.resume()
      video.currentTime = 0
      await video.play()

      drawFrame(performance.now())

      canvasStream = canvas.captureStream(25)
      output = context.createMediaStreamDestination()

      stream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...output.stream.getAudioTracks(),
      ])

      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond:
          quality === 1080
            ? 5_000_000
            : 3_000_000,
      })

      recorder = rec

      const blob = await new Promise<Blob>(
        (resolve, reject) => {
          const chunks: BlobPart[] = []
          let settled = false

          const fail = (error: Error) => {
            if (settled) return
            settled = true
            reject(error)
          }

          stopExportRef.current = () => {
            canceled = true
            fail(Error('تم إلغاء إنشاء المقطع'))

            if (rec.state !== 'inactive') {
              rec.stop()
            }
          }

          rec.ondataavailable = e => {
            if (e.data.size) {
              chunks.push(e.data)
            }
          }

          rec.onerror = () =>
            fail(
              Error('فشل تسجيل الفيديو. جرّب جودة 720p.')
            )

          rec.onstop = () => {
            if (canceled) {
              fail(Error('تم إلغاء إنشاء المقطع'))
              return
            }

            const b = new Blob(chunks, {
              type: mime.split(';')[0],
            })

            if (b.size < 3000) {
              fail(Error('ملف الفيديو الناتج فارغ'))
            } else if (!settled) {
              settled = true
              resolve(b)
            }
          }

          try {
            rec.start(400)
          } catch {
            fail(
              Error('تعذر بدء المسجل في المتصفح.')
            )
            return
          }

          const started = context.currentTime + .12

          prep.buffers.forEach((buffer, i) => {
            const node =
              context.createBufferSource()

            node.buffer = buffer
            node.connect(output!)

            node.start(
              started + prep.starts[i]
            )
            nodes.push(node)
          })

          const pulse = () => {
            if (canceled || settled) return

            const t = Math.max(
              0,
              context.currentTime - started
            )

            playingRef.current.at =
              Math.min(t, prep.duration)

            setProgress(
              Math.min(
                100,
                Math.round(
                  t / prep.duration * 100
                )
              )
            )

            if (t >= prep.duration + .12) {
              if (rec.state !== 'inactive') {
                rec.stop()
              }
              return
            }

            raf = requestAnimationFrame(pulse)
          }

          raf = requestAnimationFrame(pulse)

          timeout = window.setTimeout(
            () =>
              fail(
                Error(
                  'انتهت مهلة تسجيل الفيديو. جرّب مقطعًا أقصر.'
                )
              ),
            (prep.duration + 20) * 1000
          )
        }
      )

      if (!canceled) {
        const url = URL.createObjectURL(blob)
        resultURL.current = url

        setResult({
          blob,
          url,
          filename:
            `samee3-${surah}-${start}-${end}.` +
            (blob.type.includes('mp4')
              ? 'mp4'
              : 'webm'),
        })

        setProgress(100)
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'تعذر إنشاء المقطع'
      )
    } finally {
      stopExportRef.current = null
      cancelAnimationFrame(raf)
      clearTimeout(timeout)

      if (
        recorder &&
        (recorder as MediaRecorder).state !== 'inactive'
      ) {
        try {
          (recorder as MediaRecorder).stop()
        } catch {}
      }

      nodes.forEach(n => {
        try {
          n.stop()
          n.disconnect()
        } catch {}
      })

      stream?.getTracks().forEach(t => t.stop())
      canvasStream?.getTracks().forEach(t => t.stop())
      output?.disconnect()

      playingRef.current.at = 0
      playingRef.current.active = false

      setPlaying(false)
      setPosition(0)
      setBusy('idle')
      setStatus('')
    }
  }

  const shareVideo = async () => {
    if (!result) return

    try {
      const media = new File(
        [result.blob],
        result.filename,
        { type: result.blob.type }
      )

      if (navigator.canShare?.({ files: [media] })) {
        await navigator.share({
          files: [media],
          title: 'آيات مرئية — مصحف سميع',
        })
      } else {
        setError(
          'يمكنك تنزيل الفيديو ومشاركته من الجهاز.'
        )
      }
    } catch (e) {
      if (
        !(e instanceof Error && e.name === 'AbortError')
      ) {
        setError(
          'تعذرت المشاركة. استخدم زر التنزيل.'
        )
      }
    }
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-[#f8f5ef] pb-32 text-[#273d33]"
    >
      <header className="border-b border-[#e5ddcd] bg-[#fffdf8] px-4 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href="/"
            aria-label="العودة للرئيسية"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e6dcc6] bg-white"
          >
            <ArrowRight size={20} />
          </Link>

          <div className="flex-1">
            <h1 className="text-xl font-extrabold">
              آيات مرئية
            </h1>
            <p className="mt-1 text-xs text-[#7f897f]">
              خلفيات طبيعية متحركة، وآيات تختارها من نص المصحف
            </p>
          </div>

          <Film className="text-[#b49a65]" size={24} />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <nav
          className="mb-5 grid grid-cols-3 gap-2"
          aria-label="خطوات إنشاء الفيديو"
        >
          {[
            'الخلفيات الطبيعية',
            'اختيار الآيات',
            'المعاينة والحفظ',
          ].map((label, i) => (
            <button
              key={label}
              disabled={
                active || (i === 2 && !prepared)
              }
              onClick={() => setStep(i + 1)}
              className={
                'rounded-2xl px-2 py-3 text-xs font-bold ' +
                (step === i + 1
                  ? 'bg-[#245343] text-white'
                  : 'bg-[#ebe7dd] text-[#68766c]')
              }
            >
              {ar(i + 1)}. {label}
            </button>
          ))}
        </nav>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <p className="flex-1">{error}</p>
            <button
              aria-label="إغلاق التنبيه"
              onClick={() => setError('')}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="order-2 space-y-4 lg:order-1">
            {step === 1 && (
              <>
                <h2 className="text-xl font-extrabold">
                  50 خلفية طبيعية من Mixkit
                </h2>

                <p className="text-sm leading-7 text-[#778376]">
                  اختر خلفية طبيعية من المياه أو الزهور أو السحاب أو الغابات.
                  افتح المقطع الأصلي، نزّل MP4 ثم استورده.
                  المقاطع المرفوعة إلى الموقع تعمل لكل المستخدمين،
                  والمحفوظة في المتصفح تعمل على جهازك فقط.
                </p>

                <div className="flex flex-wrap gap-2">
                  {GROUPS.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroup(g)}
                      className={
                        'rounded-full px-4 py-2 text-xs font-bold ' +
                        (group === g
                          ? 'bg-[#245343] text-white'
                          : 'border border-[#e6dcc7] bg-white')
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {visibleScenes.map(s => (
                    <div
                      key={s.id}
                      className={
                        'overflow-hidden rounded-2xl border-2 bg-white ' +
                        (scene.id === s.id
                          ? 'border-[#b89d65]'
                          : 'border-transparent')
                      }
                    >
                      <button
                        type="button"
                        disabled={active}
                        onClick={() => selectScene(s)}
                        className="block w-full text-right"
                      >
                        <div
                          className="relative flex aspect-[4/5] items-center justify-center text-6xl"
                          style={{
                            background:
                              `linear-gradient(140deg,${s.tint},#102c30)`,
                          }}
                        >
                          <span>{s.emoji}</span>

                          {scene.id === s.id && (
                            <Check
                              className="absolute left-2 top-2 rounded-full bg-white p-1 text-[#245343]"
                              size={24}
                            />
                          )}

                          <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white">
                            {cached.includes(s.id)
                              ? 'محفوظ على جهازك'
                              : 'مشهد طبيعي'}
                          </span>
                        </div>

                        <p className="px-2 pt-2 text-xs font-bold">
                          {s.name}
                        </p>
                      </button>

                      <a
                        href={s.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 px-2 py-3 text-[11px] text-[#2b6a59] underline"
                      >
                        <ExternalLink size={12} />
                        مشاهدة وتنزيل المقطع
                      </a>
                    </div>
                  ))}
                </div>

                <div className={panel}>
                  <h3 className="font-bold">
                    الخلفية المحددة: {scene.name}
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-[#718073]">
                    {backgroundReady
                      ? 'الخلفية جاهزة وتتحرك في المعاينة.'
                      : 'افتح صفحة المقطع ونزّل ملف MP4 ثم أضفه هنا.'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={scene.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={secondary}
                    >
                      <ExternalLink size={17} />
                      فتح موقع الفيديو
                    </a>

                    <label className={primary + ' cursor-pointer'}>
                      <Upload size={17} />
                      استيراد MP4

                      <input
                        className="sr-only"
                        type="file"
                        accept="video/mp4,video/webm,.mp4,.webm"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          e.target.value = ''

                          if (f) {
                            void importVideo(f)
                          }
                        }}
                      />
                    </label>
                  </div>

                  {status && (
                    <p className="mt-3 text-xs leading-6 text-[#6f7d6f]">
                      {status}
                    </p>
                  )}
                </div>

                <button
                  className={primary + ' w-full'}
                  disabled={active}
                  onClick={() => setStep(2)}
                >
                  اختيار آيات القرآن
                </button>
              </>
            )}

            {step === 2 && (
              <div className={panel}>
                <h2 className="text-xl font-extrabold">
                  اختر الآيات من النص نفسه
                </h2>

                <p className="mt-2 text-sm leading-7 text-[#6d7e73]">
                  تظهر آيات السورة كلها مكتوبة.
                  اضغط «بداية» للآية الأولى، ثم «نهاية»
                  للآية الأخيرة. الحد الأقصى عشر آيات.
                </p>

                <label className="mt-4 block text-sm font-bold">
                  السورة
                  <select
                    className={input}
                    value={surah}
                    disabled={active}
                    onChange={e =>
                      changeSurah(Number(e.target.value))
                    }
                  >
                    {surahs.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block text-sm font-bold">
                  القارئ
                  <select
                    className={input}
                    value={reader}
                    disabled={active}
                    onChange={e => {
                      setReader(e.target.value)
                      invalidate()
                    }}
                  >
                    {READERS.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="my-4 rounded-2xl bg-[#f5efde] p-3 text-sm leading-7">
                  من الآية <strong>{ar(start)}</strong> إلى الآية{' '}
                  <strong>{ar(end)}</strong> ·{' '}
                  {ar(end - start + 1)} آية
                </p>

                {verseLoading && (
                  <p role="status" className="my-4 flex gap-2 text-sm">
                    <Loader2 size={17} className="animate-spin" />
                    جارٍ تحميل نصوص السورة…
                  </p>
                )}

                {verseError && (
                  <div className="my-3 rounded-xl bg-red-50 p-3 text-xs leading-6 text-red-800">
                    {verseError}
                    <button
                      className="mr-3 underline"
                      onClick={() =>
                        setVerseRetry(v => v + 1)
                      }
                    >
                      إعادة تحميل الآيات
                    </button>
                  </div>
                )}

                <div className="max-h-[62vh] space-y-2 overflow-y-auto rounded-2xl border border-[#eee6d7] p-2">
                  {verses.map(v => (
                    <article
                      key={v.number}
                      className={
                        'rounded-xl border p-3 ' +
                        (v.number >= start && v.number <= end
                          ? 'border-[#cdb57e] bg-[#fcf7e9]'
                          : 'border-[#eee9df] bg-white')
                      }
                    >
                      <p
                        className="text-center text-xl leading-[2.5]"
                        style={{
                          fontFamily:
                            '"Amiri Quran",Amiri,serif',
                        }}
                      >
                        {v.text}{' '}
                        <span className="text-[#a18349]">
                          ﴿{ar(v.number)}﴾
                        </span>
                      </p>

                      <div className="mt-2 flex gap-2">
                        <button
                          className={
                            start === v.number
                              ? primary
                              : secondary
                          }
                          disabled={active}
                          onClick={() =>
                            chooseStart(v.number)
                          }
                        >
                          بداية
                        </button>

                        <button
                          className={
                            end === v.number
                              ? primary
                              : secondary
                          }
                          disabled={active}
                          onClick={() =>
                            chooseEnd(v.number)
                          }
                        >
                          نهاية
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <button
                  className={primary + ' mt-5 w-full'}
                  disabled={
                    active ||
                    verseLoading ||
                    !selected.length
                  }
                  onClick={() => void prepare()}
                >
                  {busy === 'prepare' ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Volume2 size={17} />
                  )}

                  {busy === 'prepare'
                    ? status
                    : 'تجهيز التلاوة ومعاينة الآيات'}
                </button>
              </div>
            )}

            {step === 3 && prepared && (
              <div className={panel + ' space-y-4'}>
                <h2 className="text-xl font-extrabold">
                  المعاينة والتصدير
                </h2>

                <p className="text-sm text-[#7b8478]">
                  سورة {chapter?.name} · {ar(start)}
                  {' '}إلى {ar(end)} ·{' '}
                  {timerLabel(prepared.duration)}
                </p>

                <label className="block text-sm font-bold">
                  مقاس الفيديو
                  <select
                    className={input}
                    disabled={active}
                    value={ratio}
                    onChange={e => {
                      setRatio(
                        e.target.value as typeof ratio
                      )
                      clearResult()
                    }}
                  >
                    <option value="9:16">عمودي 9:16</option>
                    <option value="1:1">مربع 1:1</option>
                    <option value="16:9">أفقي 16:9</option>
                  </select>
                </label>

                <label className="block text-sm font-bold">
                  الدقة
                  <select
                    className={input}
                    value={quality}
                    disabled={active}
                    onChange={e => {
                      setQuality(
                        Number(e.target.value)
                      )
                      clearResult()
                    }}
                  >
                    <option value={720}>720p</option>
                    <option value={1080}>1080p</option>
                  </select>
                </label>

                <label className="block text-sm font-bold">
                  تعتيم الخلفية: {ar(shade)}٪
                  <input
                    className="mt-3 w-full accent-[#ad8b4d]"
                    type="range"
                    min={10}
                    max={80}
                    value={shade}
                    disabled={active}
                    onChange={e => {
                      setShade(
                        Number(e.target.value)
                      )
                      clearResult()
                    }}
                  />
                </label>

                <label className="block text-sm font-bold">
                  التوقيع
                  <input
                    className={input}
                    value={signature}
                    maxLength={45}
                    disabled={active}
                    onChange={e => {
                      setSignature(e.target.value)
                      clearResult()
                    }}
                  />
                </label>

                {busy === 'export' ? (
                  <div role="status" className="space-y-3">
                    <p className="text-sm">
                      جارٍ إنشاء الفيديو: {ar(progress)}٪
                    </p>

                    <progress
                      className="w-full accent-[#a68c57]"
                      max={100}
                      value={progress}
                    />

                    <button
                      className={secondary + ' w-full'}
                      onClick={() =>
                        stopExportRef.current?.()
                      }
                    >
                      إلغاء التصدير
                    </button>
                  </div>
                ) : (
                  <button
                    className={primary + ' w-full'}
                    disabled={!backgroundReady}
                    onClick={() =>
                      void exportVideo()
                    }
                  >
                    <Film size={17} />
                    إنشاء فيديو بالمنظر الطبيعي والتلاوة
                  </button>
                )}

                {!backgroundReady && (
                  <p className="text-xs leading-6 text-[#936f33]">
                    الخلفية لم تُضاف بعد. ارجع للقوالب
                    ونزّل المقطع الأصلي واستورده،
                    أو ارفع ملف MP4 إلى المستودع.
                  </p>
                )}

                {result && (
                  <div className="space-y-3">
                    <p className="font-bold">
                      تم إنشاء الفيديو
                    </p>

                    <video
                      src={result.url}
                      playsInline
                      controls
                      className="max-h-80 w-full rounded-2xl bg-black"
                    />

                    <div className="flex gap-2">
                      <a
                        href={result.url}
                        download={result.filename}
                        className={primary + ' flex-1'}
                      >
                        <Download size={17} />
                        تنزيل
                      </a>

                      <button
                        className={secondary}
                        onClick={() =>
                          void shareVideo()
                        }
                      >
                        <Share2 size={17} />
                        مشاركة
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className={secondary + ' w-full'}
                  disabled={active}
                  onClick={() => setStep(2)}
                >
                  تغيير الآيات
                </button>
              </div>
            )}
          </section>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <b>معاينة حية</b>
              <span className="text-xs text-[#778176]">
                {scene.name}
              </span>
            </div>

            <div
              className="relative mx-auto max-w-[330px] overflow-hidden rounded-[25px] bg-[#143b34] shadow-lg"
              style={{ aspectRatio: aspect }}
            >
              <video
                ref={videoRef}
                muted
                loop
                playsInline
                preload="auto"
                className="absolute inset-0 h-full w-full object-cover"
                aria-hidden="true"
              />

              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                aria-label="معاينة الآية فوق الخلفية المتحركة"
              />

              {!backgroundReady && (
                <div
                  role="status"
                  className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-4 py-3 text-center text-xs leading-6 text-white"
                >
                  {backgroundStatus ||
                    'الخلفية غير مثبتة. اختر ملف الفيديو من Mixkit.'}
                </div>
              )}
            </div>

            {prepared && (
              <div className="mx-auto mt-3 flex max-w-[330px] items-center gap-2 rounded-2xl bg-white p-3">
                <button
                  className="rounded-full bg-[#245343] p-3 text-white disabled:opacity-40"
                  disabled={active}
                  onClick={() => void playPause()}
                  aria-label={
                    playing
                      ? 'إيقاف التلاوة'
                      : 'تشغيل التلاوة'
                  }
                >
                  {playing
                    ? <Pause size={17} />
                    : <Play size={17} />}
                </button>

                <div className="flex-1">
                  <progress
                    className="w-full accent-[#a8884b]"
                    max={prepared.duration}
                    value={position}
                  />

                  <p
                    dir="ltr"
                    className="text-center text-[11px]"
                  >
                    {timerLabel(position)}
                    {' / '}
                    {timerLabel(prepared.duration)}
                  </p>
                </div>

                <button
                  className="p-2"
                  aria-label="إعادة التلاوة"
                  onClick={() => stopAudio(true)}
                >
                  <RefreshCcw size={17} />
                </button>
              </div>
            )}

            {!backgroundReady && (
              <a
                href={scene.source}
                target="_blank"
                rel="noopener noreferrer"
                className={secondary + ' mt-3 w-full'}
              >
                <ExternalLink size={17} />
                تنزيل مشهد «{scene.name}» من Mixkit
              </a>
            )}

            <p className="mt-3 text-center text-[11px] leading-6 text-[#788577]">
              الخلفية صامتة. صوت المقطع النهائي هو التلاوة فقط،
              بلا موسيقى.
            </p>
          </aside>
        </div>

        <footer className="mt-10 text-center text-xs leading-6 text-[#83887e]">
          الفيديوهات: Mixkit · الآيات: AlQuran.cloud ·
          الأصوات: EveryAyah
        </footer>
      </div>
    </main>
  )
}
