
/**
 * Mishary Alafasy collected Mushaf, Hafs only.
 * Uses same-origin SAMEE3 byte-range audio relay and the original timings.
 * No timing data is ever substituted from another Alafasy recording.
 */
export const ALAFASY_COLLECTED_VISUAL_ID = 'alafasy-collected'

export type CollectedVisualClip = {
  url: string
  startSeconds: number
  duration: number
  starts: number[]
}

type Timing = { ayah: number; start_time: number; end_time: number }

export async function loadCollectedVisualClip(
  surah: number,
  ayahs: readonly number[],
  signal?: AbortSignal,
): Promise<CollectedVisualClip> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !ayahs.length || ayahs.length > 10 ||
      ayahs.some((n, i) => !Number.isInteger(n) || n < 1 || (i > 0 && n !== ayahs[i - 1] + 1))) {
    throw new Error('اختر سورة صحيحة وحتى عشر آيات متتابعة.')
  }
  const response = await fetch(`/api/alafasy-timings/${surah}`, {
    cache: 'no-store', signal,
  })
  if (!response.ok) throw new Error(`تعذّر تحميل توقيتات العفاسي المجمع (${response.status}).`)
  const raw: unknown = await response.json()
  if (!Array.isArray(raw)) throw new Error('ملف توقيتات العفاسي المجمع غير صالح.')

  const rows = new Map<number, Timing>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const x = entry as Record<string, unknown>
    const ayah = Number(x.ayah)
    const start_time = Number(x.start_time)
    const end_time = Number(x.end_time)
    if (Number.isInteger(ayah) && ayah >= 1 && Number.isFinite(start_time) &&
        Number.isFinite(end_time) && start_time >= 0 && end_time > start_time) {
      if (rows.has(ayah)) throw new Error(`توقيت مكرر للآية ${ayah}.`)
      rows.set(ayah, { ayah, start_time, end_time })
    }
  }
  const chosen = ayahs.map(ayah => rows.get(ayah))
  if (chosen.some(x => !x)) throw new Error('توقيت بعض الآيات غير موجود في تسجيل العفاسي المجمع.')
  const timings = chosen as Timing[]
  const firstStart = timings[0].start_time
  const duration = (timings[timings.length - 1].end_time - firstStart) / 1000
  if (!Number.isFinite(duration) || duration <= 0 || duration > 90) {
    throw new Error('مدّة الآيات تتجاوز 90 ثانية؛ اختر آيات أقل.')
  }
  const starts = timings.map((x, i) => {
    if (i && x.start_time < timings[i - 1].end_time - 1000) {
      throw new Error('توقيتات الآيات غير مرتبة بصورة صحيحة.')
    }
    return (x.start_time - firstStart) / 1000
  })
  return {
    url: `/api/alafasy-audio/${String(surah).padStart(3, '0')}.mp3`,
    startSeconds: firstStart / 1000,
    duration,
    starts,
  }
}
