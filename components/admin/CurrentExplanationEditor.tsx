'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, Pencil, RefreshCw, Save } from 'lucide-react'
import {
  loadYoutubePlayer,
  youtubeSource,
  youtubeError,
  type StudyPlayer,
} from '@/lib/islamic/youtube-player'
import { playlistOverride, studySources, type ManagedBook } from '@/lib/islamic/managed-library'

export type CurrentLessonEdit = {
  title: string
  url: string
  author: string
  seeking: 'inherit' | 'allow' | 'block'
  speed: 'inherit' | 'allow' | 'block'
  deleted: boolean
}
type Metadata = { id: string; title: string; author: string }
const field =
  'w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 focus:border-teal-700'
const button =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40'
const choose = (value?: boolean | null): CurrentLessonEdit['seeking'] =>
  typeof value === 'boolean' ? (value ? 'allow' : 'block') : 'inherit'
const blank: CurrentLessonEdit = {
  title: '',
  url: '',
  author: '',
  seeking: 'inherit',
  speed: 'inherit',
  deleted: false,
}

export default function CurrentExplanationEditor({
  book,
  disabled = false,
  onSave,
  onDirtyChange,
  onBusyChange,
}: {
  book: ManagedBook
  disabled?: boolean
  onSave: (list: string, position: number, edit: CurrentLessonEdit, restore: boolean) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const sources = useMemo(() => studySources(book).filter((source) => source.list), [book])
  const [list, setList] = useState(''),
    [ids, setIds] = useState<string[]>([]),
    [position, setPosition] = useState(1),
    [page, setPage] = useState(0)
  const [draft, setDraft] = useState<CurrentLessonEdit>(blank),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const [metadata, setMetadata] = useState<Record<string, Metadata>>({}),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [retry, setRetry] = useState(0)
  const host = useRef<HTMLDivElement>(null),
    player = useRef<StudyPlayer | null>(null),
    initialized = useRef(''),
    requested = useRef(new Set<string>())
  const source = sources.find((item) => item.list === list) || sources[0]
  const listId = source?.list || ''
  const originalUrl = ids[position - 1] ? `https://www.youtube.com/watch?v=${ids[position - 1]}` : ''
  const override = listId ? playlistOverride(book, listId, position) : undefined
  const currentUrl = override?.url || originalUrl
  const activeVideoId = youtubeSource(currentUrl)?.video
  const actual = activeVideoId ? metadata[activeVideoId] : undefined
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    const key = `${book.id}:${listId}:${position}`
    if (dirty && initialized.current === key) return
    initialized.current = key
    const currentPolicy = !book.lessonPolicyRevision || override?.policyRevision === book.lessonPolicyRevision
    setDraft({
      title: override?.title || actual?.title || (originalUrl ? `الدرس ${position} — ${book.title}` : ''),
      url: currentUrl,
      author: override?.author || book.videoAuthor || actual?.author || '',
      seeking: choose(currentPolicy ? override?.allowSeeking : null),
      speed: choose(currentPolicy ? override?.allowSpeed : null),
      deleted: override?.deleted === true,
    })
  }, [
    book.id,
    book.title,
    book.videoAuthor,
    book.lessonPolicyRevision,
    listId,
    position,
    override,
    currentUrl,
    originalUrl,
    actual,
    dirty,
  ])
  useEffect(() => {
    if (!listId || !source) {
      setLoading(false)
      return
    }
    let alive = true,
      current: StudyPlayer | null = null,
      timer: ReturnType<typeof setInterval> | undefined
    let discovered = false
    setLoading(true)
    setFailure('')
    setIds([])
    setPosition(1)
    setPage(0)
    setDirty(false)
    const sync = () => {
      if (!alive || !current || discovered) return
      const result = current.getPlaylist()
      if (result?.length) {
        discovered = true
        setIds(result)
        setLoading(false)
      }
    }
    void loadYoutubePlayer()
      .then((api) => {
        if (!alive || !host.current) return
        const iframe = document.createElement('iframe')
        iframe.title = `الشرح الحالي: ${source.title}`
        iframe.referrerPolicy = 'strict-origin-when-cross-origin'
        iframe.allow = 'encrypted-media; fullscreen'
        iframe.allowFullscreen = true
        iframe.src = `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(listId)}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
        host.current.replaceChildren(iframe)
        current = new api.Player(iframe, {
          width: '100%',
          height: '100%',
          host: 'https://www.youtube.com',
          playerVars: { origin: location.origin, controls: 1, playsinline: 1 },
          events: {
            onReady: (event) => {
              if (!alive) return
              current = event.target
              player.current = current
              current.cuePlaylist({ list: listId, listType: 'playlist', index: 0, startSeconds: 0 })
              sync()
              timer = setInterval(sync, 600)
            },
            onStateChange: sync,
            onError: (event) => {
              if (alive) {
                setFailure(youtubeError(event.data))
                setLoading(false)
              }
            },
          },
        })
      })
      .catch((error) => {
        if (alive) {
          setFailure(error instanceof Error ? error.message : 'تعذّر تحميل القائمة.')
          setLoading(false)
        }
      })
    const timeout = setTimeout(() => {
      if (alive && !discovered) {
        setLoading(false)
        setFailure(
          'لم تصل دروس القائمة من YouTube. رابط القائمة الحالي ظاهر بالأعلى؛ أعد المحاولة لتحميل روابط دروسها.',
        )
      }
    }, 22000)
    return () => {
      alive = false
      clearInterval(timer)
      clearTimeout(timeout)
      if (player.current === current) player.current = null
      try {
        current?.destroy()
      } catch {
        /* already removed */
      }
    }
  }, [book.id, listId, source?.url, retry])
  const visibleIds = useMemo(
    () => [...ids.slice(page * 12, (page + 1) * 12), ...(activeVideoId ? [activeVideoId] : [])],
    [ids, page, activeVideoId],
  )
  useEffect(() => {
    let alive = true
    const pending = Array.from(new Set(visibleIds)).filter((id) => !requested.current.has(id))
    pending.forEach((id) => requested.current.add(id))
    const worker = async () => {
      while (pending.length && alive) {
        const id = pending.shift()!
        try {
          const response = await fetch(`/api/islamic-library/youtube-details?id=${id}`)
          const data = await response.json()
          if (alive && response.ok && typeof data.title === 'string')
            setMetadata((current) => ({
              ...current,
              [id]: { id, title: data.title, author: typeof data.author === 'string' ? data.author : '' },
            }))
        } catch {
          /* Links remain editable when source metadata is unavailable. */
        }
        if (!alive) requested.current.delete(id)
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker))
    return () => {
      alive = false
      pending.forEach((id) => requested.current.delete(id))
    }
  }, [visibleIds])
  const pick = (next: number) => {
    if (dirty && !window.confirm('توجد تعديلات لم تُحفظ. الانتقال إلى درس آخر؟')) return
    setDirty(false)
    setPosition(next)
    setNotice('')
    setFailure('')
    const entry = playlistOverride(book, listId, next)
    const id = youtubeSource(entry?.url || `https://www.youtube.com/watch?v=${ids[next - 1]}`)?.video
    if (id) player.current?.cueVideoById({ videoId: id })
  }
  const update = <K extends keyof CurrentLessonEdit>(key: K, value: CurrentLessonEdit[K]) => {
    setDirty(true)
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const save = async (restore = false) => {
    if (!listId || !originalUrl) return
    setBusy(true)
    onBusyChange?.(true)
    setFailure('')
    setNotice('')
    try {
      await onSave(listId, position, draft, restore)
      setDirty(false)
      setNotice(
        restore ? 'تمت استعادة بيانات الدرس الأصلي.' : 'تم حفظ تعديلات الدرس الحالي الذي يراه الجمهور.',
      )
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'تعذّر حفظ التعديل.')
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }
  if (!source) return null
  return (
    <section
      data-current-explanation
      className="min-w-0 space-y-4 rounded-2xl border border-teal-200 bg-teal-50/30 p-4"
    >
      <header>
        <h4 className="text-base font-black text-teal-900">دروس الشرح الحالي وروابطها</h4>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          اختر درسًا من القائمة الحالية. بياناته ورابطه الذي يظهر للجمهور موجودة داخل خانات التعديل.
        </p>
      </header>
      {sources.length > 1 && (
        <label className="block space-y-2 text-sm font-bold">
          قائمة الشرح الحالية
          <select
            className={field}
            value={listId}
            onChange={(event) => {
              if (dirty && !window.confirm('الانتقال دون حفظ تعديل الدرس؟')) return
              setDirty(false)
              setList(event.target.value)
            }}
          >
            {sources.map((item) => (
              <option key={item.key} value={item.list}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <a
        className="flex items-center gap-2 break-all text-sm text-teal-800 underline"
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink size={16} />
        رابط القائمة الحالي: {source.url}
      </a>
      <div
        ref={host}
        className="mx-auto h-[200px] w-full max-w-[356px] overflow-hidden rounded-xl bg-slate-900 [&>iframe]:h-full [&>iframe]:w-full"
      />
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 size={17} className="animate-spin" />
          جارٍ تحميل الدروس الحالية وروابطها…
        </p>
      )}
      {failure && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">
          {failure}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              requested.current.clear()
              setRetry((value) => value + 1)
            }}
          >
            إعادة التحميل
          </button>
        </p>
      )}
      {!!ids.length && (
        <>
          <p className="text-xs font-bold text-teal-900">{ids.length} درسًا في القائمة الحالية</p>
          <div className="max-h-64 space-y-2 overflow-auto rounded-xl border bg-white p-2">
            {ids.slice(page * 12, (page + 1) * 12).map((id, i) => {
              const number = page * 12 + i + 1,
                changes = playlistOverride(book, listId, number),
                url = changes?.url || `https://www.youtube.com/watch?v=${id}`,
                videoId = youtubeSource(url)?.video
              return (
                <article
                  key={`${id}-${number}`}
                  className={`rounded-xl border p-3 ${number === position ? 'border-teal-700 bg-teal-50' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm">
                      {changes?.title || (videoId && metadata[videoId]?.title) || `الدرس ${number}`}
                      {changes?.deleted ? ' · مخفي' : ''}
                    </strong>
                    <button
                      type="button"
                      className={button}
                      disabled={disabled || busy}
                      onClick={() => pick(number)}
                    >
                      <Pencil size={15} />
                      تعديل الحالي
                    </button>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="mt-2 block break-all text-left text-xs text-teal-800 underline"
                  >
                    {url}
                  </a>
                </article>
              )
            })}
          </div>
          {ids.length > 12 && (
            <div className="flex items-center justify-between">
              <button type="button" className={button} disabled={!page} onClick={() => setPage(page - 1)}>
                السابق
              </button>
              <span className="text-xs">
                {page + 1} / {Math.ceil(ids.length / 12)}
              </span>
              <button
                type="button"
                className={button}
                disabled={(page + 1) * 12 >= ids.length}
                onClick={() => setPage(page + 1)}
              >
                التالي
              </button>
            </div>
          )}
          <fieldset
            disabled={disabled || busy}
            className="min-w-0 space-y-4 rounded-2xl border-2 border-teal-700 bg-white p-4"
          >
            <legend className="px-2 font-black">تعديل الدرس الحالي رقم {position}</legend>
            <label className="block space-y-2 text-sm font-bold">
              عنوان الدرس الحالي
              <input
                className={field}
                value={draft.title}
                onChange={(event) => update('title', event.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm font-bold">
              الرابط الحالي المعروض للجمهور
              <input
                dir="ltr"
                type="url"
                className={field}
                value={draft.url}
                onChange={(event) => update('url', event.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm font-bold">
              اسم الشارح
              <input
                className={field}
                value={draft.author}
                onChange={(event) => update('author', event.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['seeking', 'speed'] as const).map((key) => (
                <label key={key} className="block space-y-2 text-sm font-bold">
                  {key === 'seeking' ? 'تقديم وتأخير هذا الدرس' : 'تغيير سرعة هذا الدرس'}
                  <select
                    className={field}
                    value={draft[key]}
                    onChange={(event) => update(key, event.target.value as CurrentLessonEdit[typeof key])}
                  >
                    <option value="inherit">يتبع إعداد الكتاب</option>
                    <option value="allow">مسموح</option>
                    <option value="block">غير مسموح</option>
                  </select>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={!draft.deleted}
                onChange={(event) => update('deleted', !event.target.checked)}
              />
              ظاهر للجمهور
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${button} !bg-teal-800 !text-white`}
                onClick={() => void save()}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}حفظ تعديل هذا
                الدرس
              </button>
              <button type="button" className={button} onClick={() => void save(true)}>
                استعادة بيانات الدرس الأصلية
              </button>
            </div>
          </fieldset>
        </>
      )}
      {notice && (
        <p role="status" className="text-sm font-bold text-teal-800">
          {notice}
        </p>
      )}
    </section>
  )
}
