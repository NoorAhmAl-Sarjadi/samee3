/** A seek must finish before play(), especially when WebKit is loading metadata. */
export async function seekAudioBeforePlay(
  audio: HTMLMediaElement,
  seconds: number,
  isCurrent: () => boolean,
  timeoutMs = 15000,
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('موضع التلاوة غير صالح.')
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      audio.removeEventListener('loadedmetadata', seek)
      audio.removeEventListener('canplay', seek)
      audio.removeEventListener('seeked', verify)
      audio.removeEventListener('error', fail)
      error ? reject(error) : resolve()
    }
    const verify = () => {
      if (!isCurrent()) { finish(new DOMException('Playback superseded', 'AbortError')); return }
      if (Math.abs(audio.currentTime - seconds) <= .4) finish()
    }
    const seek = () => {
      if (!isCurrent()) { finish(new DOMException('Playback superseded', 'AbortError')); return }
      if (audio.readyState < 1) return
      if (Number.isFinite(audio.duration) && seconds >= audio.duration && seconds > 0) {
        finish(new Error('توقيت الآية يتجاوز مدة التسجيل. اختر تسجيلًا آخر.')); return
      }
      try {
        audio.currentTime = seconds
        if (seconds === 0 || !audio.seeking) verify()
      } catch { /* WebKit will retry on canplay; never fall back to zero. */ }
    }
    const fail = () => finish(new Error('تعذر تحميل التسجيل الصوتي.'))
    const timer = setTimeout(() => finish(new Error('تعذر الانتقال إلى الآية في الوقت المحدد. أعد المحاولة.')), timeoutMs)
    audio.addEventListener('loadedmetadata', seek)
    audio.addEventListener('canplay', seek)
    audio.addEventListener('seeked', verify)
    audio.addEventListener('error', fail)
    seek()
  })
}

/** At an exact boundary, prefer the ayah that has just started. */
export function activeAyahAt(timings: Array<{ ayah?: number; start_time?: number; end_time?: number }>, seconds: number): number | null {
  if (!Number.isFinite(seconds)) return null
  for (let index = timings.length - 1; index >= 0; index--) {
    const row = timings[index]
    const start = Math.max(0, Number(row.start_time || 0)) / 1000
    const next = index + 1 < timings.length ? Number(timings[index + 1].start_time) / 1000 : Infinity
    const end = Number.isFinite(Number(row.end_time)) ? Math.max(start, Number(row.end_time) / 1000) : next
    if (seconds >= start && seconds < Math.max(end, next) + .08) return Number(row.ayah) > 0 ? Number(row.ayah) : null
  }
  return null
}
