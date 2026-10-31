
'use client'

// SAMEE3_COLLECTED_MANUAL_TRIM_V3
// Precision editor for collected Alafasy only.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  MAX_DURATION_SECONDS,
} from '@/lib/samee3-visual-config'

export type CollectedTiming = {
  startSeconds: number
  duration: number
  starts: number[]
}

export type CollectedTrimOffsets = {
  startOffset: number
  endOffset: number
}

type EditorProps = {
  surah: number
  from: number
  to: number
  streamUrl: string
  original: CollectedTiming
  disabled: boolean
  onStop: () => void
  onApply: (timing: CollectedTiming) => void
}

const DEFAULT_TRIM: CollectedTrimOffsets = {
  startOffset: 0,
  endOffset: 0,
}

const buttonClass =
  'inline-flex min-h-11 items-center justify-center ' +
  'rounded-xl border border-[#d9cdb6] bg-white ' +
  'px-3 py-2 text-sm font-bold text-[#245343] ' +
  'transition-colors hover:bg-[#f3f7f3] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

function trimStorageKey(
  surah: number,
  from: number,
  to: number
): string {
  return (
    'samee3_collected_visual_trim_v3:' +
    surah + ':' + from + ':' + to
  )
}

function normalizeOffset(value: number): number {
  if (!Number.isFinite(value)) return 0

  return (
    Math.round(
      Math.max(-30, Math.min(30, value)) * 20
    ) / 20
  )
}

function readStoredOffsets(
  surah: number,
  from: number,
  to: number
): CollectedTrimOffsets {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_TRIM }
  }

  try {
    const raw = window.localStorage.getItem(
      trimStorageKey(surah, from, to)
    )

    if (!raw) return { ...DEFAULT_TRIM }

    const parsed: unknown = JSON.parse(raw)

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return { ...DEFAULT_TRIM }
    }

    const value = parsed as Record<string, unknown>

    if (
      typeof value.startOffset !== 'number' ||
      typeof value.endOffset !== 'number' ||
      !Number.isFinite(value.startOffset) ||
      !Number.isFinite(value.endOffset)
    ) {
      return { ...DEFAULT_TRIM }
    }

    return {
      startOffset: normalizeOffset(value.startOffset),
      endOffset: normalizeOffset(value.endOffset),
    }
  } catch {
    return { ...DEFAULT_TRIM }
  }
}

export function calculateCollectedTrim(
  original: CollectedTiming,
  offsets: CollectedTrimOffsets
): CollectedTiming {
  const startSeconds = Math.max(
    0,
    original.startSeconds + offsets.startOffset
  )

  const endSeconds =
    original.startSeconds +
    original.duration +
    offsets.endOffset

  const duration = endSeconds - startSeconds

  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    !Number.isFinite(duration) ||
    duration < 0.25 ||
    duration > MAX_DURATION_SECONDS
  ) {
    throw new Error(
      'حدود المقطع غير صالحة. تأكد أن النهاية بعد البداية ' +
      'وأن مدة الفيديو لا تتجاوز الحد المسموح.'
    )
  }

  const starts = original.starts.map(relative => {
    const absoluteVerseStart =
      original.startSeconds + relative

    return Math.max(
      0,
      Math.min(
        duration,
        absoluteVerseStart - startSeconds
      )
    )
  })

  return {
    startSeconds,
    duration,
    starts,
  }
}

export function applyStoredCollectedTrim<
  T extends CollectedTiming
>(
  clip: T,
  surah: number,
  from: number,
  to: number
): T {
  const offsets = readStoredOffsets(surah, from, to)

  try {
    return {
      ...clip,
      ...calculateCollectedTrim(clip, offsets),
    }
  } catch {
    return {
      ...clip,
      ...calculateCollectedTrim(clip, DEFAULT_TRIM),
    }
  }
}

async function waitForMetadata(
  audio: HTMLAudioElement
): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout)

      audio.removeEventListener(
        'loadedmetadata',
        success
      )

      audio.removeEventListener(
        'error',
        failure
      )
    }

    const success = () => {
      cleanup()
      resolve()
    }

    const failure = () => {
      cleanup()

      reject(
        new Error(
          'تعذر تحميل التسجيل الصوتي للعفاسي المجمع.'
        )
      )
    }

    const timeout = window.setTimeout(
      failure,
      15000
    )

    audio.addEventListener(
      'loadedmetadata',
      success
    )

    audio.addEventListener(
      'error',
      failure
    )

    audio.load()
  })
}

async function seekAudio(
  audio: HTMLAudioElement,
  seconds: number
): Promise<void> {
  await waitForMetadata(audio)

  const target = Math.max(0, seconds)

  audio.currentTime = target

  if (!audio.seeking) return

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout)

      audio.removeEventListener(
        'seeked',
        success
      )

      audio.removeEventListener(
        'error',
        failure
      )
    }

    const success = () => {
      cleanup()
      resolve()
    }

    const failure = () => {
      cleanup()

      reject(
        new Error('تعذر الانتقال إلى موضع التلاوة.')
      )
    }

    const timeout = window.setTimeout(
      failure,
      10000
    )

    audio.addEventListener(
      'seeked',
      success
    )

    audio.addEventListener(
      'error',
      failure
    )
  })
}

export function Samee3CollectedTrimEditor({
  surah,
  from,
  to,
  streamUrl,
  original,
  disabled,
  onStop,
  onApply,
}: EditorProps) {
  const [offsets, setOffsets] =
    useState<CollectedTrimOffsets>({
      ...DEFAULT_TRIM,
    })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [previewSide, setPreviewSide] =
    useState<'start' | 'end' | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)

  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const sequenceRef = useRef(0)

  const stopPreview = useCallback(() => {
    sequenceRef.current += 1

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    audioRef.current?.pause()
    setPreviewSide(null)
  }, [])

  useEffect(() => {
    const saved = readStoredOffsets(
      surah,
      from,
      to
    )

    try {
      calculateCollectedTrim(original, saved)
      setOffsets(saved)
    } catch {
      setOffsets({ ...DEFAULT_TRIM })
    }

    setMessage('')
    setError('')
  }, [surah, from, to, original])

  useEffect(() => {
    return () => {
      sequenceRef.current += 1

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }

      audioRef.current?.pause()
    }
  }, [])

  const current = useMemo(() => {
    try {
      return calculateCollectedTrim(
        original,
        offsets
      )
    } catch {
      return null
    }
  }, [original, offsets])

  function updateOffset(
    key: keyof CollectedTrimOffsets,
    value: number
  ) {
    if (disabled) return

    const next: CollectedTrimOffsets = {
      ...offsets,
      [key]: normalizeOffset(value),
    }

    try {
      const adjusted = calculateCollectedTrim(
        original,
        next
      )

      stopPreview()
      onStop()
      onApply(adjusted)

      setOffsets(next)
      setError('')

      setMessage(
        'تم تطبيق التوقيت الجديد على التشغيل والتصدير.'
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'تعذر تعديل التوقيت.'
      )
    }
  }

  function saveOffsets() {
    if (disabled || !current) return

    try {
      window.localStorage.setItem(
        trimStorageKey(surah, from, to),
        JSON.stringify(offsets)
      )

      setError('')

      setMessage(
        'تم حفظ بداية ونهاية هذا المقطع على جهازك.'
      )
    } catch {
      setError(
        'تعذر حفظ الضبط على هذا الجهاز.'
      )
    }
  }

  function resetOffsets() {
    if (disabled) return

    try {
      const originalTiming = calculateCollectedTrim(
        original,
        DEFAULT_TRIM
      )

      stopPreview()
      onStop()
      onApply(originalTiming)

      window.localStorage.removeItem(
        trimStorageKey(surah, from, to)
      )

      setOffsets({ ...DEFAULT_TRIM })
      setError('')

      setMessage(
        'تمت استعادة توقيت المقطع الأصلي.'
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'تعذرت استعادة التوقيت.'
      )
    }
  }

  async function listenToEdge(
    side: 'start' | 'end'
  ) {
    if (disabled || !current) return

    stopPreview()
    onStop()

    const audio = audioRef.current

    if (!audio) return

    const sequence = ++sequenceRef.current

    const clipStart = current.startSeconds
    const clipEnd = clipStart + current.duration

    const begin =
      side === 'start'
        ? clipStart
        : Math.max(clipStart, clipEnd - 3)

    const finish =
      side === 'start'
        ? Math.min(clipEnd, clipStart + 3)
        : clipEnd

    try {
      await seekAudio(audio, begin)

      if (sequence !== sequenceRef.current) {
        return
      }

      await audio.play()

      if (sequence !== sequenceRef.current) {
        audio.pause()
        return
      }

      setPreviewSide(side)
      setError('')

      intervalRef.current = window.setInterval(
        () => {
          if (
            sequence !== sequenceRef.current ||
            audio.paused ||
            audio.ended ||
            audio.currentTime >= finish - 0.025
          ) {
            stopPreview()
          }
        },
        35
      )

      timeoutRef.current = window.setTimeout(
        stopPreview,
        8000
      )
    } catch (cause) {
      stopPreview()

      setError(
        cause instanceof Error
          ? cause.message
          : 'تعذر الاستماع لبداية أو نهاية التلاوة.'
      )
    }
  }

  return (
    <section
      dir="rtl"
      className="mt-4 rounded-2xl border border-[#d9c8a5] bg-[#fffcf3] p-4"
    >
      <h3 className="text-base font-extrabold text-[#245343]">
        ضبط بداية ونهاية تلاوة العفاسي المجمع
      </h3>

      <p className="mt-2 text-xs leading-6 text-[#746d5b]">
        التحكم خاص بالمصحف المجمع فقط.
        الرقم الموجب يؤخر الموضع، والرقم السالب يقدمه.
        يمكنك ضبط البداية والنهاية بدقة 0.05 ثانية.
      </p>

      {([
        {
          key: 'startOffset' as const,
          title: 'ضبط بداية التلاوة',
        },
        {
          key: 'endOffset' as const,
          title: 'ضبط نهاية التلاوة',
        },
      ]).map(item => (
        <div
          key={item.key}
          className="mt-4 rounded-xl border border-[#e7dfd0] bg-white p-3"
        >
          <label
            className="block text-sm font-bold text-[#245343]"
          >
            {item.title}
          </label>

          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              aria-label={item.title}
              min={-30}
              max={30}
              step={0.05}
              disabled={disabled}
              value={offsets[item.key]}
              onChange={event => {
                updateOffset(
                  item.key,
                  Number(event.target.value)
                )
              }}
              className="min-w-0 flex-1 accent-[#245343]"
            />

            <input
              type="number"
              aria-label={`${item.title} بالثواني`}
              min={-30}
              max={30}
              step={0.05}
              disabled={disabled}
              value={offsets[item.key]}
              onChange={event => {
                updateOffset(
                  item.key,
                  Number(event.target.value)
                )
              }}
              className="w-24 rounded-lg border border-[#d9cdb6] px-2 py-2 text-center text-sm"
            />
          </div>
        </div>
      ))}

      {current && (
        <div
          className="mt-4 rounded-xl bg-white p-3 text-center text-xs leading-7 text-[#245343]"
        >
          البداية: {current.startSeconds.toFixed(2)} ثانية
          {' · '}
          النهاية: {(
            current.startSeconds +
            current.duration
          ).toFixed(2)} ثانية
          {' · '}
          المدة: {current.duration.toFixed(2)} ثانية
        </div>
      )}

      <audio
        ref={audioRef}
        src={streamUrl}
        preload="metadata"
        className="hidden"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || !current}
          onClick={() => {
            void listenToEdge('start')
          }}
        >
          سماع أول 3 ثوانٍ
        </button>

        <button
          type="button"
          className={buttonClass}
          disabled={disabled || !current}
          onClick={() => {
            void listenToEdge('end')
          }}
        >
          سماع آخر 3 ثوانٍ
        </button>
      </div>

      {previewSide && (
        <button
          type="button"
          className={buttonClass + ' mt-2 w-full'}
          onClick={stopPreview}
        >
          إيقاف الاستماع
        </button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || !current}
          onClick={saveOffsets}
        >
          حفظ الضبط
        </button>

        <button
          type="button"
          className={buttonClass}
          disabled={disabled}
          onClick={resetOffsets}
        >
          استعادة التوقيت الأصلي
        </button>
      </div>

      {message && (
        <p
          role="status"
          className="mt-3 text-xs leading-6 text-[#245343]"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-xs leading-6 text-red-700"
        >
          {error}
        </p>
      )}
    </section>
  )
}
