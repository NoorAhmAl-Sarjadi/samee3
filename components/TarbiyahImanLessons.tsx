'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  GraduationCap,
  ListVideo,
  PlayCircle,
  Search,
} from 'lucide-react'

const PLAYLIST_ID = 'PLXtPgiwrUEOKxmSJFZOMO9UqL_q2bEVo3'
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`
const MATERIAL_URL =
  'https://sites.google.com/view/drmohamedabozaid/التربية-الايمانية-للأبناء'
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/

type VideoDetails = { title?: string; video_id?: string }
type YouTubePlayer = {
  getPlaylist(): string[] | null
  getPlaylistIndex(): number
  getVideoData(): VideoDetails
  playVideoAt(index: number): void
  nextVideo(): void
  previousVideo(): void
  destroy(): void
}
type YouTubeEvent = { target: YouTubePlayer; data?: number }
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string
      height: string
      playerVars: {
        listType: string
        list: string
        playsinline: number
        autoplay: number
        rel: number
        origin: string
      }
      events: {
        onReady: (event: YouTubeEvent) => void
        onStateChange: (event: YouTubeEvent) => void
        onError: (event: YouTubeEvent) => void
      }
    },
  ) => YouTubePlayer
}
type YouTubeWindow = Window & {
  YT?: YouTubeAPI
  onYouTubeIframeAPIReady?: () => void
}

type TitlesResponse = { titles?: Record<string, string | null> }

const ar = (value: number) => value.toLocaleString('ar-EG')

export default function TarbiyahImanLessons() {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [videoIds, setVideoIds] = useState<string[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [titlesFinished, setTitlesFinished] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    let syncTimer: number | undefined
    let startupTimer: number | undefined
    let player: YouTubePlayer | null = null
    let playlistFound = false
    const win = window as YouTubeWindow

    const synchronize = () => {
      if (disposed || !player) return
      try {
        const playlist = (player.getPlaylist() || []).filter((id) =>
          VIDEO_ID.test(id),
        )

        if (playlist.length) {
          playlistFound = true
          setVideoIds((previous) =>
            previous.length === playlist.length &&
            previous.every((id, index) => id === playlist[index])
              ? previous
              : playlist,
          )
          setLoaded(true)
        }

        const currentIndex = player.getPlaylistIndex()
        if (
          Number.isInteger(currentIndex) &&
          currentIndex >= 0 &&
          (playlist.length === 0 || currentIndex < playlist.length)
        ) {
          setActiveIndex((previous) =>
            previous === currentIndex ? previous : currentIndex,
          )
        }

        const video = player.getVideoData()
        if (VIDEO_ID.test(video.video_id || '') && video.title?.trim()) {
          const id = video.video_id as string
          const title = video.title.trim()
          setTitles((previous) =>
            previous[id] === title ? previous : { ...previous, [id]: title },
          )
        }
      } catch {
        // The YouTube player can temporarily be unavailable while loading.
      }
    }

    const createPlayer = () => {
      if (disposed || player || !win.YT?.Player || !mountRef.current) return

      try {
        const node = document.createElement('div')
        mountRef.current.replaceChildren(node)

        player = new win.YT.Player(node, {
          width: '100%',
          height: '100%',
          playerVars: {
            listType: 'playlist',
            list: PLAYLIST_ID,
            playsinline: 1,
            autoplay: 0,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (disposed) return
              synchronize()
              syncTimer = window.setInterval(synchronize, 1600)
            },
            onStateChange: () => {
              synchronize()
              window.setTimeout(synchronize, 300)
            },
            onError: () => {
              setError(
                'تعذر تشغيل هذا الفيديو داخل التطبيق. يمكنك فتح قائمة التشغيل مباشرةً على يوتيوب.',
              )
            },
          },
        })

        playerRef.current = player
      } catch {
        setError('تعذر تهيئة مشغل يوتيوب في هذا المتصفح.')
      }
    }

    const previousReady = win.onYouTubeIframeAPIReady
    const handleReady = () => {
      previousReady?.()
      createPlayer()
    }

    if (win.YT?.Player) {
      createPlayer()
    } else {
      win.onYouTubeIframeAPIReady = handleReady
      if (!document.querySelector('script[data-samee3-youtube-api]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        script.dataset.samee3YoutubeApi = 'true'
        script.onerror = () => {
          if (!disposed) setError('تعذر تحميل مشغل يوتيوب. تحقق من الاتصال بالإنترنت.')
        }
        document.head.appendChild(script)
      }
    }

    startupTimer = window.setTimeout(() => {
      if (!disposed && !playlistFound) {
        setError('تعذّر قراءة قائمة الدروس هنا. يمكنك فتح قائمة التشغيل الأصلية على يوتيوب.')
      }
    }, 18000)

    return () => {
      disposed = true
      window.clearInterval(syncTimer)
      window.clearTimeout(startupTimer)
      if (win.onYouTubeIframeAPIReady === handleReady) {
        win.onYouTubeIframeAPIReady = previousReady
      }
      try {
        player?.destroy()
      } catch {}
      playerRef.current = null
      mountRef.current?.replaceChildren()
    }
  }, [])

  // The IFrame API supplies every ID in the playlist in its real order.
  // Retrieve the original titles via YouTube's public oEmbed endpoint.
  useEffect(() => {
    if (!videoIds.length) return
    const controller = new AbortController()

    const loadTitles = async () => {
      setTitlesFinished(false)
      const batches: string[][] = []
      for (let offset = 0; offset < videoIds.length; offset += 8) {
        batches.push(videoIds.slice(offset, offset + 8))
      }

      const getBatchTitles = async (batch: string[]) => {
        try {
          const response = await fetch(
            `/api/tarbiyah-iman/titles?ids=${encodeURIComponent(batch.join(','))}`,
            { signal: controller.signal },
          )
          if (!response.ok) return
          const result = (await response.json()) as TitlesResponse
          if (controller.signal.aborted || !result.titles) return

          setTitles((previous) => {
            let next = previous
            for (const [id, title] of Object.entries(result.titles || {})) {
              if (VIDEO_ID.test(id) && typeof title === 'string' && title && previous[id] !== title) {
                if (next === previous) next = { ...previous }
                next[id] = title
              }
            }
            return next
          })
        } catch {
          // The currently playing video's title can still come from the player.
        }
      }

      // Two small batches at once: reduces loading time without overwhelming YouTube.
      for (let index = 0; index < batches.length; index += 2) {
        if (controller.signal.aborted) return
        await Promise.all(batches.slice(index, index + 2).map(getBatchTitles))
      }
      if (!controller.signal.aborted) setTitlesFinished(true)
    }

    void loadTitles()
    return () => controller.abort()
  }, [videoIds])

  const visibleLessons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar')
    return videoIds
      .map((id, index) => ({ id, index, title: titles[id] || '' }))
      .filter((lesson) =>
        !query ||
        lesson.title.toLocaleLowerCase('ar').includes(query) ||
        String(lesson.index + 1).includes(query),
      )
  }, [search, titles, videoIds])

  const activeVideoId = videoIds[activeIndex]
  const activeTitle = activeVideoId ? titles[activeVideoId] : ''

  const playLesson = (index: number) => {
    if (index < 0 || index >= videoIds.length) return
    try {
      playerRef.current?.playVideoAt(index)
      setActiveIndex(index)
      setError('')
    } catch {
      setError('تعذر الانتقال إلى هذا الدرس داخل المشغل.')
    }
  }

  const changeLesson = (direction: -1 | 1) => {
    const index = activeIndex + direction
    if (index < 0 || index >= videoIds.length) return
    playLesson(index)
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f5ee] pb-32 text-[#203f43]">
      <div className="h-1 bg-gradient-to-l from-[#98713c] via-[#d9c39b] to-[#175759]" />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-10">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#687b79]">
          <ArrowRight size={18} /> العودة للرئيسية
        </Link>

        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold text-[#a47a3e]">مصحف سميع · الدروس العلمية</p>
            <h1 className="text-2xl font-black sm:text-4xl">التربية الإيمانية للأبناء</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#687b79]">
              تابع دروس السلسلة بالترتيب، وانتقل بين الفيديوهات بسهولة،
              واستفد من الملفات العلمية المساندة.
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eee3ce] text-[#977241]">
            <GraduationCap size={31} />
          </span>
        </header>

        <section className="mb-6 flex flex-col gap-3 rounded-3xl border border-[#d9c7a8] bg-[#183f42] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <BookOpen className="shrink-0 text-[#e3c692]" size={25} />
            <div>
              <h2 className="text-lg font-extrabold">المادة العلمية المساندة</h2>
              <p className="mt-1 text-xs leading-6 text-white/75">
                السيرة والفقه والعقيدة والأذكار والتفسير والتجويد.
              </p>
            </div>
          </div>
          <a
            href={MATERIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#e6ca91] px-5 py-3 text-sm font-black text-[#213c3b] transition hover:bg-[#f4ddb1]"
          >
            <Download size={19} /> تحميل المادة العلمية <ExternalLink size={15} />
          </a>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <section className="min-w-0 overflow-hidden rounded-3xl border border-[#e0d6c4] bg-white shadow-sm">
            <div className="aspect-video w-full bg-[#112a2c]" aria-label="مشغل سلسلة التربية الإيمانية">
              <div ref={mountRef} className="h-full w-full" />
            </div>

            <div className="p-5 sm:p-6">
              <p className="mb-2 text-xs font-bold text-[#967340]">
                {videoIds.length
                  ? `الدرس ${ar(activeIndex + 1)} من ${ar(videoIds.length)}`
                  : 'سلسلة التربية الإيمانية للأبناء'}
              </p>
              <h2 className="min-h-8 text-xl font-black leading-8 text-[#203f43]">
                {activeTitle || (!loaded ? 'جارٍ تحميل قائمة الدروس…' : titlesFinished ? 'عنوان الفيديو غير متاح حاليًا من يوتيوب' : 'جارٍ استرجاع عنوان الفيديو من يوتيوب…')}
              </h2>

              {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">{error}</p>}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!videoIds.length || activeIndex <= 0}
                  onClick={() => changeLesson(-1)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-[#d9cbb5] bg-white px-4 py-3 font-bold text-[#315354] transition hover:bg-[#f7f2e9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={20} /> السابق
                </button>
                <button
                  type="button"
                  disabled={!videoIds.length || activeIndex >= videoIds.length - 1}
                  onClick={() => changeLesson(1)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#195b57] px-4 py-3 font-bold text-white transition hover:bg-[#124743] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  التالي <ChevronLeft size={20} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-4 text-sm">
                <a href={PLAYLIST_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-bold text-[#936b33] underline underline-offset-4">
                  <ExternalLink size={16} /> فتح قائمة يوتيوب الأصلية
                </a>
                <a href={MATERIAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-bold text-[#195b57] underline underline-offset-4">
                  <Download size={16} /> ملفات المادة العلمية
                </a>
              </div>
            </div>
          </section>

          <aside className="overflow-hidden rounded-3xl border border-[#e0d6c4] bg-white shadow-sm">
            <div className="border-b border-[#eee5d8] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <ListVideo className="text-[#a7834c]" size={22} /> فهرس الدروس
                </h2>
                {!!videoIds.length && <span className="rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold text-[#8f6b39]">{ar(videoIds.length)} فيديو</span>}
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-[#e2d9c9] px-3 py-2.5">
                <Search className="shrink-0 text-[#9b8f78]" size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث باسم الدرس أو رقمه"
                  aria-label="ابحث في دروس التربية الإيمانية"
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                />
              </label>
            </div>

            <div className="max-h-[570px] space-y-1 overflow-y-auto p-3">
              {!videoIds.length && (
                <p role="status" className="px-3 py-6 text-center text-sm leading-7 text-slate-500">
                  جارٍ قراءة الدروس من قائمة يوتيوب…
                  <span className="mt-2 block text-xs">يمكنك تشغيل السلسلة من المشغل أو فتحها على يوتيوب مباشرة.</span>
                </p>
              )}
              {!!videoIds.length && !visibleLessons.length && (
                <p className="p-5 text-center text-sm text-slate-500">لا توجد دروس مطابقة للبحث.</p>
              )}
              {visibleLessons.map((lesson) => {
                const selected = lesson.index === activeIndex
                return (
                  <button
                    type="button"
                    key={lesson.id}
                    onClick={() => playLesson(lesson.index)}
                    aria-current={selected ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition ${
                      selected
                        ? 'border border-[#bfd3c8] bg-[#edf5f0] text-[#195b57]'
                        : 'border border-transparent hover:bg-[#f7f5ee]'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${selected ? 'bg-[#195b57] text-white' : 'bg-[#f0e9dc] text-[#96723b]'}`}>
                      {selected ? <PlayCircle size={20} /> : ar(lesson.index + 1)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-bold leading-6">
                      {lesson.title || `الدرس ${ar(lesson.index + 1)} — العنوان غير متاح مؤقتًا`}
                    </span>
                    <ChevronLeft className="shrink-0 opacity-40" size={16} />
                  </button>
                )
              })}
            </div>
          </aside>
        </div>

        <p className="mt-5 text-xs leading-6 text-[#7d8a82]">
          تنبيه: زر المادة العلمية يفتح صفحة الملفات الأصلية التي تحتوي على روابط التحميل؛
          ولا يُحمّل جميع الملفات تلقائيًا. عرض الفيديوهات يعتمد على إتاحتها للتضمين من يوتيوب.
        </p>
      </main>
    </div>
  )
}