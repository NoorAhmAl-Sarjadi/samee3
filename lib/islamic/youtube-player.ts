export type StudyPlayer = {
  getPlaylist: () => string[] | null; getPlaylistIndex: () => number; getCurrentTime: () => number
  getIframe: () => HTMLIFrameElement; getVideoUrl: () => string; playVideoAt: (index: number) => void
  cuePlaylist: (value: string[] | { list: string; listType: string; index: number; startSeconds: number }, index?: number, seconds?: number) => void
  destroy: () => void
}
export type YoutubeAPI = { Player: new (element: HTMLElement, options: {
  width: string; height: string; host: string; playerVars: Record<string, string | number>
  events: { onReady: (event: { target: StudyPlayer }) => void; onStateChange: (event: { target: StudyPlayer; data: number }) => void; onError: (event: { data: number }) => void }
}) => StudyPlayer }
let loading: Promise<YoutubeAPI> | null = null
export function youtubeSource(value: unknown): { list?: string; video?: string } | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value), host = url.hostname.replace(/^www\./, '')
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !['youtube.com','m.youtube.com','youtube-nocookie.com','youtu.be'].includes(host)) return null
    const list = url.searchParams.get('list'), video = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1]
    if (list && /^[\w-]{10,80}$/.test(list)) return { list }
    return video && /^[\w-]{11}$/.test(video) ? { video } : null
  } catch { return null }
}
export function loadYoutubePlayer(): Promise<YoutubeAPI> {
  const win = window as Window & { YT?: YoutubeAPI; onYouTubeIframeAPIReady?: () => void }
  if (win.YT?.Player) return Promise.resolve(win.YT)
  if (loading) return loading
  loading = new Promise<YoutubeAPI>((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady
    const timer = window.setTimeout(() => { loading = null; reject(new Error('تعذر الاتصال بمشغل YouTube. أعد المحاولة.')) }, 20000)
    win.onYouTubeIframeAPIReady = () => { try { previous?.() } finally { window.clearTimeout(timer); if (win.YT?.Player) resolve(win.YT); else { loading = null; reject(new Error('تعذر تهيئة المشغل.')) } } }
    let script = document.querySelector<HTMLScriptElement>('#samee3-youtube-api')
    if (!script) { script = document.createElement('script'); script.id = 'samee3-youtube-api'; script.src = 'https://www.youtube.com/iframe_api'; script.async = true; document.head.append(script) }
    script.onerror = () => { window.clearTimeout(timer); script?.remove(); loading = null; reject(new Error('تعذر تحميل مشغل YouTube.')) }
  })
  return loading
}