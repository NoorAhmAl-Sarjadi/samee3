1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import { claimAudioFocus } from '@/lib/audio-focus'
import { loadYoutubePlayer, youtubeSource, youtubeError, type StudyPlayer } from '@/lib/islamic/youtube-player'
import type { LearningCourse } from '@/lib/islamic/curriculum'
import PdfBookReader from './PdfBookReader'

type MediaLesson = { id: string; title: string; url: string; order?: number; allowSeeking?: boolean | null; allowSpeed?: boolean | null }
type Source = { key: string; label: string; url: string; list?: string; ids?: string[]; titles?: string[]; perLesson?: MediaLesson[] }
type Player = StudyPlayer & { playVideo?: () => void; pauseVideo?: () => void; seekTo?: (seconds: number, allowSeekAhead: boolean) => void; getDuration?: () => number; getPlayerState?: () => number; setPlaybackRate?: (rate: number) => void; getPlaybackRate?: () => number; getAvailablePlaybackRates?: () => number[] }
type PolicyCourse = LearningCourse & { lessonSeekDefault?: boolean; lessonSpeedDefault?: boolean; playlistPolicies?: Record<string, { allowSeeking?: boolean; allowSpeed?: boolean }> }
const input = 'w-full rounded-xl border border-[#d2c4a7] bg-white p-3 text-base text-slate-900 outline-none'
const btn = 'inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#d2c4a7] bg-white px-3 py-2 text-xs font-bold disabled:opacity-40'
const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`
function sourcesFor(book: PolicyCourse): Source[] {
  const result: Source[] = []
  const playlistIds = new Set<string>()
  const individuals: { id: string; title: string; video: MediaLesson }[] = []
  const all: MediaLesson[] = [...(book.videoUrl ? [{ id: 'bundled-playlist', title: book.videoAuthor ? `شرح ${book.videoAuthor}` : 'الشرح الأصلي', url: book.videoUrl, order: -1 }] : []), ...((book.videos || []) as MediaLesson[]).slice().sort((a, b) => (a.order || 0) - (b.order || 0))]
  for (const item of all) {
    const parsed = youtubeSource(item.url)
    if (!parsed) continue
    if (parsed.list) {
      if (!playlistIds.has(parsed.list)) { playlistIds.add(parsed.list); result.push({ key: parsed.list, label: item.title, url: item.url, list: parsed.list }) }
    } else if (parsed.video && !individuals.some(v => v.id === parsed.video)) individuals.push({ id: parsed.video, title: item.title, video: item })
  }
  if (individuals.length) result.push({ key: 'individual-'+individuals.map(x => x.id).join(','), label: individuals.length > 1 ? 'الدروس الفردية المرتبة' : individuals[0].title, url: individuals[0].video.url, ids: individuals.map(x => x.id), titles: individuals.map(x => x.title), perLesson: individuals.map(x => x.video) })
  return result
}
export default function CourseStudyStudio({ book }: { book: LearningCourse }) {
  const policyBook = book as PolicyCourse
  const sources = useMemo(() => sourcesFor(policyBook), [book.videoUrl, book.videos, book.videoAuthor])
  const [selected, setSelected] = useState('')
  const [ids, setIds] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [part, setPart] = useState(0)
  const [page, setPage] = useState(0)
  const [listOpen, setListOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<Player | null>(null)
  const source = sources.find(x => x.key === selected) || sources[0]
  const sourceSignature = JSON.stringify(source)
  const lessonPolicy = source?.list ? policyBook.playlistPolicies?.[String(index + 1)] : source?.perLesson?.[index]
  const allowSeeking = lessonPolicy?.allowSeeking ?? policyBook.lessonSeekDefault ?? true
  const allowSpeed = lessonPolicy?.allowSpeed ?? policyBook.lessonSpeedDefault ?? true
  const pdfParts = book.pdfParts?.length ? book.pdfParts : book.downloadUrl ? [{ label: 'نسخة الكتاب', url: book.downloadUrl }] : []

  useEffect(() => {
    let alive = true
    let current: Player | null = null
    let interval: ReturnType<typeof setInterval> | undefined
    setReady(false); setError(''); setIds([]); setIndex(0); setPage(0); setCurrentTime(0); setDuration(0); setPlaying(false)
    if (!source || !host.current) return
    const memoryKey = `samee3_study_v1:${book.id}:${source.key}`
    let savedIndex = 0, savedTime = 0
    try { const saved = JSON.parse(localStorage.getItem(memoryKey) || '{}'); savedIndex = Math.max(0, Math.floor(Number(saved.index) || 0)); savedTime = Math.max(0, Number(saved.time) || 0) } catch { /* no saved position */ }
    let lastSave = 0
    const sync = () => {
      if (!alive || !current) return
      const newIds = current.getPlaylist() || source.ids || []
      if (newIds.length) setIds(old => old.length === newIds.length && old.every((x, i) => x === newIds[i]) ? old : newIds)
      const at = Math.max(0, current.getPlaylistIndex())
      setIndex(at)
      const time = Math.max(0, current.getCurrentTime() || 0)
      setCurrentTime(time)
      setDuration(Math.max(0, current.getDuration?.() || 0))
      setPlaying(current.getPlayerState?.() === 1)
      if (Date.now() - lastSave > 4000) { lastSave = Date.now(); try { localStorage.setItem(memoryKey, JSON.stringify({ index: at, time: Math.floor(time) })) } catch { /* storage unavailable */ } }
    }
    void loadYoutubePlayer().then(api => {
      if (!alive || !host.current) return
      const target = document.createElement('iframe')
      target.title = `شرح ${book.title}`; target.referrerPolicy = 'strict-origin-when-cross-origin'
      target.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; target.allowFullscreen = true
      const embed = new URL(`https://www.youtube.com/embed/${source.list ? 'videoseries' : source.ids?.[0] || ''}`)
      embed.searchParams.set('enablejsapi', '1'); embed.searchParams.set('origin', location.origin); embed.searchParams.set('playsinline', '1'); embed.searchParams.set('rel', '0')
      // All navigation and time controls are drawn by SAMEE3, allowing lesson-level permissions.
      embed.searchParams.set('controls', '0'); embed.searchParams.set('disablekb', '1')
      if (source.list) embed.searchParams.set('list', source.list)
      target.src = embed.href; host.current.replaceChildren(target)
      current = new api.Player(target, { width: '100%', height: '100%', host: 'https://www.youtube.com', playerVars: { origin: location.origin, playsinline: 1, rel: 0, autoplay: 0, controls: 0, disablekb: 1 }, events: {
        onReady: event => {
          if (!alive) return
          current = event.target as Player; player.current = current
          if (source.list) current.cuePlaylist({ list: source.list, listType: 'playlist', index: savedIndex, startSeconds: savedTime })
          else current.cuePlaylist(source.ids || [], Math.min(savedIndex, (source.ids?.length || 1) - 1), savedTime)
