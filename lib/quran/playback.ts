import { bindQuranMediaSession } from './media-session'

export async function seekAudioBeforePlay(
  audio: HTMLMediaElement,
  seconds: number,
  isCurrent: () => boolean,
  timeoutMs = 15000,
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error('موضع التلاوة غير صالح.')
  }

  bindQuranMediaSession(audio)

  await new Promise<void>((resolve, reject) => {
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true

      clearTimeout(timer)

      audio.removeEventListener(
        'loadedmetadata',
        seek,
      )
      audio.removeEventListener('canplay', seek)
      audio.removeEventListener('seeked', verify)
      audio.removeEventListener('error', fail)

      if (error) reject(error)
      else resolve()
    }

    const verify = () => {
      if (!isCurrent()) {
        finish(
          new DOMException(
            'Playback superseded',
            'AbortError',
          ),
        )
        return
      }

      if (
        Math.abs(audio.currentTime - seconds) <= 0.4
      ) {
        finish()
      }
    }

    const seek = () => {
      if (!isCurrent()) {
        finish(
          new DOMException(
            'Playback superseded',
            'AbortError',
          ),
        )
        return
      }

      if (audio.readyState < 1) return

      if (
        Number.isFinite(audio.duration) &&
        seconds >= audio.duration &&
        seconds > 0
      ) {
        finish(
          new Error(
            'توقيت الآية يتجاوز مدة التسجيل. اختر تسجيلًا آخر.',
          ),
        )
        return
      }

      try {
        audio.currentTime = seconds

        if (seconds === 0 || !audio.seeking) {
          verify()
        }
      } catch {
        // يعاد الانتقال عند وصول بيانات التسجيل.
      }
    }

    const fail = () => {
      finish(
        new Error('تعذر تحميل التسجيل الصوتي.'),
      )
    }

    const timer = setTimeout(() => {
      finish(
        new Error(
          'تعذر الانتقال إلى الآية في الوقت المحدد. أعد المحاولة.',
        ),
      )
    }, timeoutMs)

    audio.addEventListener('loadedmetadata', seek)
    audio.addEventListener('canplay', seek)
    audio.addEventListener('seeked', verify)
    audio.addEventListener('error', fail)

    seek()
  })
}

export function activeAyahAt(
  timings: Array<{
    ayah?: number
    start_time?: number
    end_time?: number
  }>,
  seconds: number,
): number | null {
  if (!Number.isFinite(seconds)) return null

  for (
    let index = timings.length - 1;
    index >= 0;
    index--
  ) {
    const row = timings[index]
    const start = Number(row.start_time) / 1000
    if (!Number.isFinite(start) || start < 0 || seconds < start) continue

    const next =
      index + 1 < timings.length
        ? Number(
            timings[index + 1].start_time,
          ) / 1000
        : Infinity

    const declaredEnd = Number(row.end_time) / 1000
    const end = Number.isFinite(declaredEnd) && declaredEnd > start
      ? Math.min(declaredEnd, next) : next

    if (
      seconds >= start &&
      seconds < end
    ) {
      return Number(row.ayah) > 0
        ? Number(row.ayah)
        : null
    }
  }

  return null
}
