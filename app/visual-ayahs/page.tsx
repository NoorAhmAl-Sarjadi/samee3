'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, Download, ExternalLink, Film, Loader2,
  Pause, Play, RefreshCcw, Share2, Upload, Volume2, X,
} from 'lucide-react'
import {
  FALLBACK_SURAHS, MAX_AYAH_COUNT, MAX_BACKGROUND_BYTES,
  MAX_DURATION_SECONDS, READERS,
  type SurahInfo, type Verse,
} from '@/lib/samee3-visual-config'
import { SCENES, sceneFromFile, type Scene } from '@/lib/samee3-visual-library'
import { clipKeys, readClip, saveClip } from '@/lib/samee3-visual-storage'
import {
  drawVisualFrame, verseIndexAt, type VideoDesign, type VideoRatio,
} from '@/lib/samee3-visual-render'

type Prepared = {
  verses: Verse[]
  buffers: AudioBuffer[]
  starts: number[]
  duration: number
}
type ExportFile = { url: string; blob: Blob; filename: string }
type Busy = 'idle' | 'prepare' | 'export'
type GalleryResponse = {
  files: { filename: string; size: number }[]
  warning?: string
}

const primary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl ' +
  'bg-[#245343] px-5 py-3 text-sm font-bold text-white disabled:opacity-45'
const secondary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl ' +
  'border border-[#e0d9c8] bg-white px-5 py-3 text-sm font-bold ' +
  'text-[#2a5446] disabled:opacity-45'
const field =
  'mt-2 min-h-12 w-full rounded-xl border border-[#e4ddce] ' +
  'bg-white px-3 py-2 text-sm outline-none focus:border-[#b79a5b]'
const section = 'rounded-[24px] border border-[#e7dfd0] bg-white p-5 shadow-sm'
const digits = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })
const durationText = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

async function requestJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  const data: unknown = await response.json()
  if (!response.ok) {
    const error = data as { error?: string }
    throw new Error(error.error || 'تعذّر تحميل البيانات.')
  }
  return data as T
}

function stopGlobalAudio() {
  document.querySelectorAll<HTMLAudioElement>('audio').forEach(media => media.pause())
  const state = window as Window & {
    __samee3PersistentAudio?: HTMLAudioElement & { __samee3Continue?: boolean }
  }
  if (state.__samee3PersistentAudio) {
    state.__samee3PersistentAudio.__samee3Continue = false
    state.__samee3PersistentAudio.pause()
  }
}

function validateVideo(file: File): string | null {
  if (!/\.(mp4|webm)$/i.test(file.name)) return 'اختر فيديو MP4 أو WebM.'
  if (file.type && !/^video\/(mp4|webm)$/i.test(file.type)) {
    return 'نوع الملف غير مدعوم. اختر MP4 أو WebM.'
  }
  if (!file.size || file.size > MAX_BACKGROUND_BYTES) {
    return 'حجم الفيديو يجب أن يكون أقل من 40 ميجابايت.'
  }
  return null
}

export default function VisualAyahsPage() {
  const [tab, setTab] = useState(1)
  const [category, setCategory] = useState('الكل')
  const [scene, setScene] = useState<Scene>(SCENES[0])
  const [repository, setRepository] = useState<Scene[]>([])
  const [local, setLocal] = useState<Scene[]>([])
  const [galleryRefresh, setGalleryRefresh] = useState(0)
  const [sceneRefresh, setSceneRefresh] = useState(0)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryWarning, setGalleryWarning] = useState('')
  const [backgroundReady, setBackgroundReady] = useState(false)
  const [backgroundStatus, setBackgroundStatus] = useState('')

  const [surahs, setSurahs] = useState<SurahInfo[]>(FALLBACK_SURAHS)
  const [surah, setSurah] = useState(13)
  const [verses, setVerses] = useState<Verse[]>([])
  const [versesLoading, setVersesLoading] = useState(true)
  const [versesError, setVersesError] = useState('')
  const [versesRefresh, setVersesRefresh] = useState(0)
  const [from, setFrom] = useState(28)
  const [to, setTo] = useState(28)
  const [reader, setReader] = useState('husary')
  const [prepared, setPrepared] = useState<Prepared | null>(null)

  const [design, setDesign] = useState<VideoDesign>({
    ratio: '9:16', quality: 720, shade: 43,
    textColor: '#fff9ec', signature: 'مصحف سميع', fontScale: 1,
  })
  const [busy, setBusy] = useState<Busy>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ExportFile | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const playbackSources = useRef<AudioBufferSourceNode[]>([])
  const playback = useRef({ playing: false, position: 0, begin: 0 })
  const preparedRef = useRef(prepared)
  const latest = useRef({ scene, surah, surahs, verses, from, reader, design })
  const rafRef = useRef(0)
  const requestId = useRef(0)
  const preparationAbort = useRef<AbortController | null>(null)
  const resultObjectURL = useRef<string | null>(null)
  const exportCancel = useRef<(() => void) | null>(null)
  const exportTime = useRef<number | null>(null)
  const pageMounted = useRef(true)

  preparedRef.current = prepared
  latest.current = { scene, surah, surahs, verses, from, reader, design }

  const chosenVerses = useMemo(() =>
    verses.filter(v => v.number >= from && v.number <= to),
  [verses, from, to])
  const allScenes = useMemo(() => [...repository, ...local, ...SCENES], [repository, local])
  const groups = useMemo(() =>
    ['الكل', ...new Set(allScenes.map(s => s.group))], [allScenes])
  const shownScenes = useMemo(() =>
    category === 'الكل' ? allScenes : allScenes.filter(s => s.group === category),
  [category, allScenes])
  const chapter = surahs.find(s => s.id === surah)
  const readerName = READERS.find(r => r.id === reader)?.name || ''
  const working = busy !== 'idle'

  const clearResult = useCallback(() => {
    if (resultObjectURL.current) URL.revokeObjectURL(resultObjectURL.current)
    resultObjectURL.current = null
    setResult(null)
  }, [])

  const stopPlayback = useCallback((reset = false) => {
    const player = playback.current
    if (player.playing && audioContext.current) {
      player.position = Math.max(0, audioContext.current.currentTime - player.begin)
    }
    player.playing = false
    for (const source of playbackSources.current) {
      try { source.stop(); source.disconnect() } catch { /* already stopped */ }
    }
    playbackSources.current = []
    if (reset) player.position = 0
    setPlaying(false)
    setPosition(player.position)
  }, [])

  const invalidatePreparation = useCallback(() => {
    requestId.current += 1
    preparationAbort.current?.abort()
    preparationAbort.current = null
    stopPlayback(true)
    preparedRef.current = null
    setPrepared(null)
    setError('')
    clearResult()
  }, [stopPlayback, clearResult])

  // Quran index and texts are loaded independently of the video engine.
  useEffect(() => {
    const controller = new AbortController()
    requestJSON<{ surahs: SurahInfo[] }>('/api/visual-ayahs?kind=surahs', controller.signal)
      .then(data => { if (data.surahs?.length === 114) setSurahs(data.surahs) })
      .catch(() => { /* The local 114-surah list remains available. */ })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setVersesLoading(true)
    setVersesError('')
    setVerses([])
    requestJSON<{ ayahs: Verse[] }>(
      `/api/visual-ayahs?kind=verses&surah=${surah}`, controller.signal,
    ).then(data => {
      if (!controller.signal.aborted) setVerses(data.ayahs)
    }).catch(cause => {
      if (!controller.signal.aborted) {
        setVersesError(cause instanceof Error ? cause.message : 'تعذّر تحميل السورة.')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setVersesLoading(false)
    })
    return () => controller.abort()
  }, [surah, versesRefresh])

  // Discover uploaded public videos with their ORIGINAL names.
  useEffect(() => {
    const controller = new AbortController()
    setGalleryLoading(true)
    requestJSON<GalleryResponse>('/api/visual-backgrounds', controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setRepository((data.files || []).map(item => sceneFromFile(item.filename, 'repository')))
        setGalleryWarning(data.warning || '')
      }).catch(cause => {
        if (!controller.signal.aborted) setGalleryWarning(
          cause instanceof Error ? cause.message : 'تعذّر تحديث المكتبة.',
        )
      }).finally(() => {
        if (!controller.signal.aborted) setGalleryLoading(false)
      })
    return () => controller.abort()
  }, [galleryRefresh])

  useEffect(() => {
    let active = true
    clipKeys().then(keys => {
      if (active) setLocal(keys.filter(key => key.startsWith('local:'))
        .map(key => sceneFromFile(key.slice('local:'.length), 'local')))
    }).catch(() => { /* Private browsing may disable IndexedDB. */ })
    return () => { active = false }
  }, [])

  // Load background without replacing audio/text. Clean up Blob URLs on change.
  useEffect(() => {
    let canceled = false
    let temporaryURL: string | null = null
    const video = videoRef.current
    if (!video) return
    const element = video
    video.pause()
    video.removeAttribute('src')
    video.load()
    setBackgroundReady(false)
    setBackgroundStatus('جارٍ تحميل الخلفية…')

    async function openScene() {
      try {
        const stored = await readClip(scene.id).catch(() => null)
        if (canceled) return
        let url = ''
        if (stored) {
          temporaryURL = URL.createObjectURL(stored)
          url = temporaryURL
        } else {
          url = scene.videoURL || (scene.id === 'flowers-demo'
            ? '/api/visual-ayahs?kind=demo' : '')
        }
        if (!url) throw new Error('الخلفية لم تُرفع بعد. استورد فيديو من جهازك.')
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanListeners()
            reject(new Error('انتهت مهلة تشغيل الخلفية.'))
          }, 18000)
          const cleanListeners = () => {
            clearTimeout(timeout)
            element.onloadeddata = null
            element.onerror = null
          }
          element.onloadeddata = () => { cleanListeners(); resolve() }
          element.onerror = () => { cleanListeners(); reject(new Error('صيغة الفيديو غير مدعومة. جرّب MP4 H.264.')) }
          element.src = url
          element.load()
        })
        if (canceled) return
        await element.play().catch(() => { /* User-gesture restrictions on autoplay. */ })
        setBackgroundReady(true)
        setBackgroundStatus('')
      } catch (cause) {
        if (!canceled) setBackgroundStatus(
          cause instanceof Error ? cause.message : 'تعذّر فتح الخلفية.',
        )
      }
    }
    void openScene()
    return () => {
      canceled = true
      video.pause()
      video.onloadeddata = null
      video.onerror = null
      video.removeAttribute('src')
      if (temporaryURL) URL.revokeObjectURL(temporaryURL)
    }
  }, [scene.id, scene.videoURL, sceneRefresh])

  // One clock paints the preview continuously. Export uses the SAME renderer.
  useEffect(() => {
    let lastPaint = 0
    function paint(now: number) {
      if (now - lastPaint > 35) {
        const canvas = canvasRef.current
        if (canvas) {
          const data = latest.current
          const prep = preparedRef.current
          const player = playback.current
          let second = exportTime.current ?? player.position
          if (exportTime.current === null && player.playing && audioContext.current) {
            second = Math.max(0, audioContext.current.currentTime - player.begin)
          }
          const index = prep ? verseIndexAt(prep.starts, second) : 0
          const verse = prep?.verses[index] ||
            data.verses.find(item => item.number === data.from) || null
          const chapterName = data.surahs.find(item => item.id === data.surah)?.name || 'القرآن الكريم'
          drawVisualFrame(canvas, videoRef.current, {
            surahName: chapterName.replace(/^س[ُ]?ور[َ]?ة[ُ]?\s*/, ''),
            readerName: READERS.find(item => item.id === data.reader)?.name || '',
            verse,
            verseProgress: prep && prep.buffers[index]?.duration
              ? (second - prep.starts[index]) / prep.buffers[index].duration
              : 0,
            placeholder: 'اختر آية من السورة لتظهر هنا',
            tint: data.scene.tint,
            design: data.design,
          })
          if (prep && exportTime.current === null && player.playing) {
            if (second >= prep.duration) {
              stopPlayback(true)
              setPosition(prep.duration)
            } else if (Math.abs(second - player.position) >= .15) {
              player.position = second
              setPosition(second)
            }
          }
        }
        lastPaint = now
      }
      rafRef.current = requestAnimationFrame(paint)
    }
    rafRef.current = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(rafRef.current)
  }, [stopPlayback])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (exportCancel.current) exportCancel.current()
        else stopPlayback()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [stopPlayback])

  useEffect(() => {
    pageMounted.current = true
    return () => {
      pageMounted.current = false
      preparationAbort.current?.abort()
      exportCancel.current?.()
      for (const source of playbackSources.current) {
        try { source.stop() } catch { /* already stopped */ }
      }
      if (audioContext.current) void audioContext.current.close().catch(() => {})
      if (resultObjectURL.current) URL.revokeObjectURL(resultObjectURL.current)
    }
  }, [])

  async function importVideo(file: File) {
    const message = validateVideo(file)
    if (message) { setError(message); return }
    setStatus('جارٍ حفظ الفيديو على هذا الجهاز…')
    setError('')
    try {
      const added = sceneFromFile(file.name, 'local')
      await saveClip(added.id, file)
      setLocal(old => [added, ...old.filter(item => item.id !== added.id)])
      setScene(added)
      setSceneRefresh(value => value + 1)
      setStatus('تم استيراد الفيديو باسمه الأصلي على جهازك. ارفعه إلى public/visual-backgrounds ليتاح لكل الزوار.')
    } catch {
      setError('تعذّر تخزين الفيديو على جهازك. جرّب ملفًا أصغر أو ارفع الملف إلى GitHub.')
    }
  }

  function pickScene(next: Scene) {
    if (working) return
    stopPlayback(true)
    clearResult()
    setScene(next)
    setError('')
  }

  function changeSurah(nextSurah: number) {
    invalidatePreparation()
    setSurah(nextSurah)
    setFrom(1)
    setTo(1)
  }

  function chooseFirst(number: number) {
    invalidatePreparation()
    setFrom(number)
    setTo(number)
  }

  function chooseLast(number: number) {
    if (number < from || number - from >= MAX_AYAH_COUNT) {
      setError('اختر نهاية بعد البداية، وبحد أقصى عشر آيات.')
      return
    }
    invalidatePreparation()
    setTo(number)
  }

  async function prepareAudio() {
    if (working || versesLoading) return
    if (chosenVerses.length !== to - from + 1 || chosenVerses.length > MAX_AYAH_COUNT) {
      setError('اختر آيات متتابعة وصحيحة أولًا.')
      return
    }
    const controller = new AbortController()
    const id = ++requestId.current
    preparationAbort.current?.abort()
    preparationAbort.current = controller
    stopPlayback(true)
    preparedRef.current = null
    setPrepared(null)
    clearResult()
    stopGlobalAudio()
    setError('')
    setBusy('prepare')
    setStatus('جارٍ تجهيز الآيات والتلاوة…')
    try {
      if (!audioContext.current) audioContext.current = new AudioContext()
      const context = audioContext.current
      await context.resume()
      const buffers: AudioBuffer[] = []
      const starts: number[] = []
      let duration = 0

      for (const [index, verse] of chosenVerses.entries()) {
        if (id !== requestId.current) return
        setStatus(`تحميل الآية ${digits(index + 1)} من ${digits(chosenVerses.length)}`)
        const params = new URLSearchParams({
          kind: 'audio', surah: String(surah), ayah: String(verse.number), reciter: reader,
        })
        const response = await fetch(`/api/visual-ayahs?${params}`, { signal: controller.signal })
        if (!response.ok) {
          const detail = await response.json().catch(() => ({ error: 'تعذّر تحميل التلاوة.' }))
          throw new Error(detail.error || 'تعذّر تحميل التلاوة.')
        }
        const encoded = await response.arrayBuffer()
        const buffer = await context.decodeAudioData(encoded)
        if (id !== requestId.current) return
        starts.push(duration)
        buffers.push(buffer)
        duration += buffer.duration
        if (duration > MAX_DURATION_SECONDS) {
          throw new Error('مدة التلاوة تجاوزت 90 ثانية. اختر عددًا أقل من الآيات.')
        }
      }
      if (id !== requestId.current) return
      const created: Prepared = { verses: chosenVerses, buffers, starts, duration }
      preparedRef.current = created
      setPrepared(created)
      setPosition(0)
      playback.current.position = 0
      setTab(3)
    } catch (cause) {
      if (id === requestId.current) setError(
        cause instanceof Error ? cause.message : 'تعذّر تجهيز التلاوة.',
      )
    } finally {
      if (id === requestId.current) {
        setBusy('idle')
        setStatus('')
        preparationAbort.current = null
      }
    }
  }

  function cancelPreparation() {
    requestId.current += 1
    preparationAbort.current?.abort()
    preparationAbort.current = null
    setBusy('idle')
    setStatus('')
  }

  async function toggleAudio() {
    const prep = preparedRef.current
    if (!prep || working) return
    if (playback.current.playing) { stopPlayback(); return }
    stopGlobalAudio()
    try {
      if (!audioContext.current) audioContext.current = new AudioContext()
      const context = audioContext.current
      await context.resume()
      const player = playback.current
      if (player.position >= prep.duration - .05) player.position = 0
      const offset = player.position
      const base = context.currentTime + .08
      player.begin = base - offset
      prep.buffers.forEach((buffer, index) => {
        if (prep.starts[index] + buffer.duration <= offset) return
        const node = context.createBufferSource()
        node.buffer = buffer
        node.connect(context.destination)
        node.start(base + Math.max(0, prep.starts[index] - offset),
          Math.max(0, offset - prep.starts[index]))
        playbackSources.current.push(node)
      })
      player.playing = true
      setPlaying(true)
      await videoRef.current?.play().catch(() => {})
    } catch {
      setError('تعذّر تشغيل التلاوة على هذا الجهاز. اضغط تشغيل مرة أخرى.')
    }
  }

  async function startExport() {
    const prep = preparedRef.current
    const canvas = canvasRef.current
    const video = videoRef.current
    const context = audioContext.current
    if (!prep || !canvas || !video || !context || working) return
    if (!backgroundReady || video.readyState < 2) {
      setError('يجب اختيار خلفية متحركة جاهزة قبل التصدير.')
      return
    }
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      setError('تصدير الفيديو غير مدعوم في هذا المتصفح. جرّب Chrome أو Safari أحدث.')
      return
    }
    const mime = [
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(type => MediaRecorder.isTypeSupported(type))
    if (!mime) { setError('هذا المتصفح لا يدعم تسجيل MP4 أو WebM.'); return }

    stopPlayback(true)
    clearResult()
    stopGlobalAudio()
    setError('')
    setBusy('export')
    setProgress(0)
    setStatus('جارٍ إنشاء المقطع، أبقِ الصفحة مفتوحة…')
    let recorder: MediaRecorder | null = null
    let canvasStream: MediaStream | null = null
    let recordedStream: MediaStream | null = null
    let destination: MediaStreamAudioDestinationNode | null = null
    let timeout = 0
    let tick = 0
    const nodes: AudioBufferSourceNode[] = []

    try {
      await context.resume()
      video.pause()
      video.currentTime = 0
      await video.play()
      canvasStream = canvas.captureStream(25)
      destination = context.createMediaStreamDestination()
      recordedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ])
      const mediaRecorder = new MediaRecorder(recordedStream, {
        mimeType: mime,
        videoBitsPerSecond: design.quality === 1080 ? 5_000_000 : 3_000_000,
      })
      recorder = mediaRecorder
      const blob = await new Promise<Blob>((resolve, reject) => {
        const chunks: BlobPart[] = []
        let finished = false
        const fail = (cause: Error) => {
          if (finished) return
          finished = true
          reject(cause)
        }
        exportCancel.current = () => {
          fail(new Error('تم إلغاء إنشاء الفيديو.'))
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
        }
        mediaRecorder.onerror = () => fail(new Error('فشل تسجيل الفيديو. جرّب جودة 720p.'))
        mediaRecorder.ondataavailable = event => {
          if (event.data.size) chunks.push(event.data)
        }
        mediaRecorder.onstop = () => {
          if (finished) return
          const output = new Blob(chunks, { type: mime.split(';')[0] })
          if (output.size < 3000) return fail(new Error('الفيديو الناتج غير صالح.'))
          finished = true
          resolve(output)
        }
        mediaRecorder.start(400)
        const audioStart = context.currentTime + .12
        prep.buffers.forEach((buffer, index) => {
          const node = context.createBufferSource()
          node.buffer = buffer
          node.connect(destination!)
          node.start(audioStart + prep.starts[index])
          nodes.push(node)
        })
        const update = () => {
          if (finished) return
          const seconds = Math.max(0, context.currentTime - audioStart)
          exportTime.current = Math.min(seconds, prep.duration)
          setProgress(Math.min(100, Math.round(seconds / prep.duration * 100)))
          if (seconds >= prep.duration + .12) {
            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
            return
          }
          tick = requestAnimationFrame(update)
        }
        tick = requestAnimationFrame(update)
        timeout = window.setTimeout(() => {
          fail(new Error('انتهت مهلة التصدير. اختر مقطعًا أقصر.'))
        }, (prep.duration + 25) * 1000)
      })

      if (!pageMounted.current) return
      const url = URL.createObjectURL(blob)
      resultObjectURL.current = url
      setResult({
        url, blob,
        filename: `samee3-${surah}-${from}-${to}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`,
      })
      setProgress(100)
    } catch (cause) {
      if (pageMounted.current) setError(
        cause instanceof Error ? cause.message : 'تعذّر تصدير الفيديو.',
      )
    } finally {
      exportTime.current = null
      exportCancel.current = null
      clearTimeout(timeout)
      cancelAnimationFrame(tick)
      if (recorder && (recorder as MediaRecorder).state !== 'inactive') {
        try { (recorder as MediaRecorder).stop() } catch { /* stopped already */ }
      }
      for (const node of nodes) {
        try { node.stop(); node.disconnect() } catch { /* stopped already */ }
      }
      recordedStream?.getTracks().forEach(track => track.stop())
      canvasStream?.getTracks().forEach(track => track.stop())
      destination?.disconnect()
      playback.current.position = 0
      if (pageMounted.current) {
        setBusy('idle')
        setStatus('')
        setPosition(0)
        setPlaying(false)
      }
    }
  }

  async function shareResult() {
    if (!result) return
    try {
      const file = new File([result.blob], result.filename, { type: result.blob.type })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'آيات مرئية — سميع' })
      } else {
        setError('حمّل الفيديو أولًا ثم شاركه من جهازك.')
      }
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) {
        setError('المشاركة غير مدعومة. استخدم زر تنزيل الفيديو.')
      }
    }
  }

  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f8f5ec] pb-32 text-[#2b4035]">
      <header className="border-b border-[#e7decf] bg-[#fffdf7] px-4 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link href="/" aria-label="العودة للرئيسية" className={secondary}>
            <ArrowRight size={19} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold">آيات مرئية</h1>
            <p className="mt-1 text-xs text-[#778377]">خلفيات طبيعية متحركة · آيات من نص القرآن · بلا موسيقى</p>
          </div>
          <Film className="text-[#a7894d]" size={25} />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <nav className="mb-6 grid grid-cols-3 gap-2" aria-label="خطوات إنشاء الفيديو">
          {['الخلفيات', 'الآيات والتلاوة', 'الحفظ والمشاركة'].map((label, index) => (
            <button key={label} type="button" disabled={working || (index === 2 && !prepared)}
              onClick={() => setTab(index + 1)}
              className={'rounded-2xl px-2 py-3 text-xs font-bold ' +
                (tab === index + 1 ? 'bg-[#245343] text-white' : 'bg-[#ebe6d8] text-[#64796a]')}>
              {digits(index + 1)}. {label}
            </button>
          ))}
        </nav>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="flex-1 leading-7">{error}</p>
            <button type="button" onClick={() => setError('')} aria-label="إغلاق التنبيه"><X size={17} /></button>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="order-2 space-y-4 lg:order-1">
            {tab === 1 && (
              <>
                <div className={section}>
                  <h2 className="text-xl font-extrabold">مكتبة خلفيات سميع المتحركة</h2>
                  <p className="mt-2 text-sm leading-7 text-[#6e8071]">
                    ارفع فيديو MP4 إلى مجلد public/visual-backgrounds باسمه الأصلي، وسيظهر ضمن القوالب بعد النشر.
                    ويمكنك استيراد فيديو مؤقت من جهازك دون تغيير اسمه.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[#718274]">{digits(repository.length)} للموقع · {digits(local.length)} على هذا الجهاز</p>
                    <button type="button" disabled={galleryLoading} className={secondary}
                      onClick={() => setGalleryRefresh(x => x + 1)}>
                      <RefreshCcw size={16} className={galleryLoading ? 'animate-spin' : ''} /> تحديث المكتبة
                    </button>
                  </div>
                  {galleryWarning && <p role="status" className="mt-3 text-xs text-amber-700">{galleryWarning}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {groups.map(group => (
                    <button type="button" key={group} onClick={() => setCategory(group)}
                      className={'rounded-full px-4 py-2 text-xs font-semibold ' +
                        (category === group ? 'bg-[#245343] text-white' : 'border bg-white')}>
                      {group}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {shownScenes.map(item => (
                    <button type="button" key={item.id} disabled={working}
                      aria-pressed={scene.id === item.id} onClick={() => pickScene(item)}
                      className={'overflow-hidden rounded-2xl border-2 bg-white text-right ' +
                        (scene.id === item.id ? 'border-[#b79859]' : 'border-white')}>
                      <div className="relative flex aspect-[4/5] items-center justify-center text-5xl"
                        style={{ background: `linear-gradient(145deg,${item.tint},#0c2525)` }}>
                        <span>{item.emoji}</span>
                        {scene.id === item.id && <Check size={19} className="absolute left-2 top-2 rounded-full bg-white p-1 text-[#245343]" />}
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white">{item.group}</span>
                      </div>
                      <p className="break-words p-2 text-xs font-bold">{item.name}</p>
                    </button>
                  ))}
                </div>
                <div className={section}>
                  <p className="mb-3 font-bold">المشهد المختار: {scene.name}</p>
                  <p className="mb-4 text-xs leading-7 text-[#788178]">
                    {backgroundReady ? 'الفيديو المتحرك جاهز للمعاينة والتصدير.' : backgroundStatus}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className={primary + ' cursor-pointer'}>
                      <Upload size={17} /> استيراد فيديو باسمه الأصلي
                      <input className="sr-only" type="file" accept=".mp4,.webm,video/mp4,video/webm"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          const file = event.target.files?.[0]
                          event.currentTarget.value = ''
                          if (file) void importVideo(file)
                        }} />
                    </label>
                    <a className={secondary} href={scene.source} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={17} /> المصدر
                    </a>
                  </div>
                  {status && <p className="mt-3 text-xs leading-6 text-[#5b785e]">{status}</p>}
                </div>
                <button type="button" className={primary + ' w-full'} disabled={working} onClick={() => setTab(2)}>
                  التالي: اختيار الآيات
                </button>
              </>
            )}

            {tab === 2 && (
              <div className={section}>
                <h2 className="text-xl font-extrabold">اختر الآيات من نص القرآن</h2>
                <p className="mt-2 text-sm leading-7 text-[#748174]">
                  اضغط «بداية» تحت الآية المطلوبة، ثم «نهاية» لتحديد المقطع. حتى عشر آيات متتابعة.
                </p>
                <label className="mt-4 block text-sm font-bold">
                  السورة
                  <select className={field} value={surah} disabled={working}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => changeSurah(Number(event.target.value))}>
                    {surahs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-bold">
                  القارئ
                  <select className={field} value={reader} disabled={working}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => { invalidatePreparation(); setReader(event.target.value) }}>
                    {READERS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <p className="my-4 rounded-xl bg-[#f5eedb] px-4 py-3 text-sm">
                  من الآية {digits(from)} إلى الآية {digits(to)} · {digits(to - from + 1)} آية
                </p>
                {versesLoading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={18} className="animate-spin" />جارٍ تحميل نصوص السورة…</p>}
                {versesError && (
                  <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                    {versesError}
                    <button type="button" className="mr-3 underline" onClick={() => setVersesRefresh(v => v + 1)}>إعادة المحاولة</button>
                  </div>
                )}
                <div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto rounded-xl border border-[#eee8da] p-2">
                  {verses.map(verse => (
                    <article key={verse.number} className={'rounded-xl border p-3 ' +
                      (verse.number >= from && verse.number <= to ? 'border-[#ccb17b] bg-[#fff9e9]' : 'border-[#eee9df] bg-white')}>
                      <p className="text-center text-xl leading-[2.6]" style={{ fontFamily: '"Amiri Quran", Amiri, serif' }}>
                        {verse.text} <span className="text-[#a98a52]">﴿{digits(verse.number)}﴾</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={working} className={from === verse.number ? primary : secondary}
                          onClick={() => chooseFirst(verse.number)}>بداية</button>
                        <button type="button" disabled={working} className={to === verse.number ? primary : secondary}
                          onClick={() => chooseLast(verse.number)}>نهاية</button>
                      </div>
                    </article>
                  ))}
                </div>
                {busy === 'prepare' ? (
                  <div className="mt-4 space-y-3">
                    <p role="status" className="text-sm">{status}</p>
                    <button type="button" className={secondary + ' w-full'} onClick={cancelPreparation}>إلغاء تحميل التلاوة</button>
                  </div>
                ) : (
                  <button type="button" className={primary + ' mt-5 w-full'}
                    disabled={working || versesLoading || !chosenVerses.length} onClick={() => void prepareAudio()}>
                    <Volume2 size={18} /> تجهيز التلاوة والمعاينة
                  </button>
                )}
              </div>
            )}

            {tab === 3 && prepared && (
              <div className={section + ' space-y-5'}>
                <h2 className="text-xl font-extrabold">المعاينة والحفظ</h2>
                <p className="text-sm text-[#6e8274]">{chapter?.name} · {digits(from)}–{digits(to)} · {durationText(prepared.duration)}</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-bold">مقاس الفيديو
                    <select className={field} disabled={working} value={design.ratio}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => { clearResult(); setDesign(old => ({ ...old, ratio: event.target.value as VideoRatio })) }}>
                      <option value="9:16">عمودي 9:16</option><option value="1:1">مربع 1:1</option><option value="16:9">أفقي 16:9</option>
                    </select>
                  </label>
                  <label className="text-sm font-bold">الدقة
                    <select className={field} disabled={working} value={design.quality}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => { clearResult(); setDesign(old => ({ ...old, quality: Number(event.target.value) as 720 | 1080 })) }}>
                      <option value={720}>720p</option><option value={1080}>1080p</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-bold">تعتيم الخلفية: {digits(design.shade)}٪
                  <input type="range" min="10" max="80" className="mt-3 w-full accent-[#ab8d51]"
                    value={design.shade} disabled={working} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      clearResult(); setDesign(old => ({ ...old, shade: Number(event.target.value) }))
                    }} />
                </label>
                <label className="block text-sm font-bold">حجم خط الآية
                  <input type="range" min="0.7" max="1.3" step="0.05" className="mt-3 w-full accent-[#ab8d51]"
                    value={design.fontScale} disabled={working} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      clearResult(); setDesign(old => ({ ...old, fontScale: Number(event.target.value) }))
                    }} />
                </label>
                <label className="block text-sm font-bold">لون النص
                  <input type="color" className="mt-2 h-10 w-full" value={design.textColor} disabled={working}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => { clearResult(); setDesign(old => ({ ...old, textColor: event.target.value })) }} />
                </label>
                <label className="block text-sm font-bold">التوقيع
                  <input className={field} maxLength={45} disabled={working} value={design.signature}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => { clearResult(); setDesign(old => ({ ...old, signature: event.target.value })) }} />
                </label>
                {busy === 'export' ? (
                  <div role="status" className="space-y-3">
                    <p className="text-sm">{status} {digits(progress)}٪</p>
                    <progress className="w-full accent-[#a98b50]" max="100" value={progress} />
                    <button type="button" className={secondary + ' w-full'} onClick={() => exportCancel.current?.()}>إلغاء الإنشاء</button>
                  </div>
                ) : (
                  <button type="button" className={primary + ' w-full'} disabled={!backgroundReady} onClick={() => void startExport()}>
                    <Film size={18} /> إنشاء الفيديو المتحرك مع التلاوة
                  </button>
                )}
                {!backgroundReady && <p className="text-xs text-amber-700">اختر خلفية متحركة صالحة أولًا من تبويب الخلفيات.</p>}
                {result && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-bold">الفيديو الناتج جاهز</h3>
                    <video src={result.url} controls playsInline className="max-h-80 w-full rounded-xl bg-black" />
                    <div className="flex gap-2">
                      <a className={primary + ' flex-1'} download={result.filename} href={result.url}><Download size={17} /> تنزيل</a>
                      <button type="button" className={secondary} onClick={() => void shareResult()}><Share2 size={17} /> مشاركة</button>
                    </div>
                  </div>
                )}
                <button type="button" disabled={working} className={secondary + ' w-full'} onClick={() => setTab(2)}>تغيير الآيات أو القارئ</button>
              </div>
            )}
          </section>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <b>المعاينة الحية</b>
              <span className="truncate text-xs text-[#758473]">{scene.name}</span>
            </div>
            <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-[24px] bg-[#133a33] shadow-lg"
              style={{ aspectRatio: design.ratio.replace(':', ' / ') }}>
              <video ref={videoRef} muted loop playsInline preload="auto" aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
              <canvas ref={canvasRef} aria-label="المعاينة القرآنية المتحركة" className="absolute inset-0 h-full w-full" />
              {!backgroundReady && (
                <p role="status" className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-3 text-center text-xs leading-6 text-white">
                  {backgroundStatus}
                </p>
              )}
            </div>
            {prepared && (
              <div className="mx-auto mt-3 flex max-w-[340px] items-center gap-3 rounded-2xl bg-white p-3">
                <button type="button" disabled={working} onClick={() => void toggleAudio()}
                  aria-label={playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة'} className="rounded-full bg-[#245343] p-3 text-white disabled:opacity-50">
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <div className="flex-1">
                  <progress className="w-full accent-[#b18e51]" max={prepared.duration} value={position} />
                  <p className="text-center text-xs text-[#758473]" dir="ltr">{durationText(position)} / {durationText(prepared.duration)}</p>
                </div>
                <button type="button" className="p-2" disabled={working} onClick={() => stopPlayback(true)} aria-label="إعادة تشغيل التلاوة">
                  <RefreshCcw size={17} />
                </button>
              </div>
            )}
            <p className="mt-3 text-center text-xs leading-6 text-[#748075]">الخلفية صامتة، والفيديو النهائي يحتوي على التلاوة فقط، من غير موسيقى.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}