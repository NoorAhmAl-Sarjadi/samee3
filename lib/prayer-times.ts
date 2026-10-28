export const PRAYERS = [
  { id: 'Fajr', name: 'الفجر' }, { id: 'Dhuhr', name: 'الظهر' },
  { id: 'Asr', name: 'العصر' }, { id: 'Maghrib', name: 'المغرب' }, { id: 'Isha', name: 'العشاء' },
] as const
export type PrayerDay = { date: string; timezone: string; timings: Record<string, string>; hijri: string; gregorian: string }

export function locationDate(now: Date, timezone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function shiftPrayerDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}
export const apiPrayerDate = (date: string) => date.split('-').reverse().join('-')
export function validPrayerTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?:\s*\([^)]*\))?$/.test(value.trim())
}
export function parsePrayerDay(payload: unknown): PrayerDay {
  const body = payload as { code?: number; data?: { timings?: Record<string, string>; meta?: { timezone?: string }; date?: { gregorian?: { date?: string }; hijri?: { date?: string; month?: { ar?: string } } } } }
  const data = body?.data
  const rawDate = data?.date?.gregorian?.date || ''
  const date = /^\d{2}-\d{2}-\d{4}$/.test(rawDate) ? rawDate.split('-').reverse().join('-') : ''
  const timezone = data?.meta?.timezone || ''
  if (body?.code !== 200 || !date || !data?.timings || ![...PRAYERS.map((p) => p.id), 'Sunrise'].every((id) => validPrayerTime(data.timings![id]))) throw new Error('بيانات مواقيت الصلاة غير مكتملة.')
  if (new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('تاريخ المواقيت غير صالح.')
  locationDate(new Date(), timezone)
  return { date, timezone, timings: Object.fromEntries(Object.entries(data.timings).map(([id, value]) => [id, typeof value === 'string' ? value.trim() : value])), gregorian: rawDate,
    hijri: `${data.date?.hijri?.date || ''} ${data.date?.hijri?.month?.ar || ''}`.trim() }
}

/** A failed tomorrow request must not cancel today's successful request. */
export async function fetchPrayerDay(url: string, signal: AbortSignal, timeoutMs = 18000): Promise<PrayerDay> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  const timeout = setTimeout(cancel, timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error('تعذر جلب مواقيت الصلاة.')
    return parsePrayerDay(await response.json())
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}

/** Convert local civil time to an instant, including a change in UTC offset. */
export function prayerInstant(date: string, time: string, timezone: string): number {
  if (!validPrayerTime(time)) return NaN
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  let instant = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = format.formatToParts(new Date(instant))
    const get = (kind: string) => Number(parts.find((p) => p.type === kind)?.value)
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    if (local === target) return instant
    instant += target - local
  }
  return NaN
}
export function nextPrayerFromDays(days: PrayerDay[], now: Date) {
  const candidates = days.flatMap((day) => PRAYERS.map((prayer) => ({ ...prayer,
    time: day.timings[prayer.id], at: prayerInstant(day.date, day.timings[prayer.id], day.timezone),
    isTomorrow: day.date !== locationDate(now, day.timezone),
  }))).filter((p) => Number.isFinite(p.at) && p.at > now.getTime()).sort((a, b) => a.at - b.at)
  return candidates[0] || null
}
export function qiblaBearing(latitude: number, longitude: number): number {
  const rad = Math.PI / 180, lat = latitude * rad, kaaba = 21.4225 * rad, delta = (39.8262 - longitude) * rad
  const bearing = Math.atan2(Math.sin(delta), Math.cos(lat) * Math.tan(kaaba) - Math.sin(lat) * Math.cos(delta)) / rad
  return (bearing + 360) % 360
}