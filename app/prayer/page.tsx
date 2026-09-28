'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  MapPin,
  Compass,
  Clock,
  Bell,
  Loader2,
  RefreshCw,
  Navigation,
  LocateFixed,
  CalendarDays,
  Sunrise,
} from 'lucide-react'

type Timings = {
  Fajr: string
  Sunrise: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
  [key: string]: string
}

type PrayerItem = {
  id: string
  name: string
  time: string
}

type NextPrayer = PrayerItem & {
  isTomorrow?: boolean
}

type QiblaData = {
  direction: number
  directionRounded: number
  compassPoint: string
}

const FALLBACK_LOCATION = {
  latitude: 23.588,
  longitude: 58.3829,
  city: 'مسقط، عُمان',
}

const CALCULATION_METHOD = 8 // Gulf Region

const prayerList: Omit<PrayerItem, 'time'>[] = [
  { id: 'Fajr', name: 'الفجر' },
  { id: 'Sunrise', name: 'الشروق' },
  { id: 'Dhuhr', name: 'الظهر' },
  { id: 'Asr', name: 'العصر' },
  { id: 'Maghrib', name: 'المغرب' },
  { id: 'Isha', name: 'العشاء' },
]

function arabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
}

function stripExtraTimeText(value: string) {
  return String(value || '').replace(/\s*\([^)]*\)/g, '').trim()
}

function parseTime(value: string) {
  const clean = stripExtraTimeText(value)
  const [hours = '0', minutes = '0'] = clean.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function formatTime(timeStr: string) {
  const clean = stripExtraTimeText(timeStr)
  if (!clean) return ''

  const [hourText, minuteText] = clean.split(':')
  let hour = Number(hourText)
  const minute = minuteText || '00'
  const period = hour >= 12 ? 'م' : 'ص'

  hour %= 12
  if (hour === 0) hour = 12

  return `${arabicDigits(hour)}:${arabicDigits(minute)} ${period}`
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360
}

function directionName(degrees: number) {
  const directions = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب']
  const index = Math.round(normalizeAngle(degrees) / 45) % 8
  return directions[index]
}

function getLocationClock(timeZone?: string | null) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date())
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
    const second = Number(parts.find((part) => part.type === 'second')?.value || 0)

    return {
      hour,
      minute,
      second,
      totalSeconds: hour * 3600 + minute * 60 + second,
    }
  } catch {
    const now = new Date()
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
      totalSeconds: now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(),
    }
  }
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  return `${arabicDigits(String(hours).padStart(2, '0'))}:${arabicDigits(
    String(minutes).padStart(2, '0')
  )}:${arabicDigits(String(seconds).padStart(2, '0'))}`
}

export default function PrayerPage() {
  const [timings, setTimings] = useState<Timings | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [locationName, setLocationName] = useState('جاري تحديد الموقع...')
  const [coordinates, setCoordinates] = useState({
    latitude: FALLBACK_LOCATION.latitude,
    longitude: FALLBACK_LOCATION.longitude,
  })
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [hijriDate, setHijriDate] = useState('')
  const [gregorianDate, setGregorianDate] = useState('')
  const [nextPrayer, setNextPrayer] = useState<NextPrayer>({
    id: 'Fajr',
    name: 'الفجر',
    time: '',
    isTomorrow: false,
  })
  const [countdown, setCountdown] = useState(0)

  const [qibla, setQibla] = useState<QiblaData | null>(null)
  const [qiblaLoading, setQiblaLoading] = useState(false)
  const [qiblaError, setQiblaError] = useState('')
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null)
  const [compassEnabled, setCompassEnabled] = useState(false)
  const [compassPermissionState, setCompassPermissionState] = useState('')

  const currentPrayerItems = useMemo<PrayerItem[]>(() => {
    if (!timings) return []

    return prayerList.map((prayer) => ({
      ...prayer,
      time: timings[prayer.id],
    }))
  }, [timings])

  const calculateNextPrayer = useCallback(
    (times: Timings) => {
      const now = getLocationClock(timeZone)
      const currentSeconds = now.totalSeconds

      for (const prayer of prayerList) {
        const time = times[prayer.id]
        const prayerSeconds = parseTime(time) * 60

        if (prayerSeconds > currentSeconds) {
          setNextPrayer({ ...prayer, time, isTomorrow: false })
          setCountdown(prayerSeconds - currentSeconds)
          return
        }
      }

      const fajr = times.Fajr
      const fajrSeconds = parseTime(fajr) * 60

      setNextPrayer({
        ...prayerList[0],
        time: fajr,
        isTomorrow: true,
      })
      setCountdown(fajrSeconds + 24 * 60 * 60 - currentSeconds)
    },
    [timeZone]
  )

  const fetchQibla = useCallback(async (lat: number, lng: number) => {
    setQiblaLoading(true)
    setQiblaError('')

    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/qibla/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`,
        { cache: 'no-store' }
      )

      if (!response.ok) throw new Error('Qibla request failed')

      const result = await response.json()
      if (result.code !== 200 || !result.data) throw new Error('Qibla data unavailable')

      const direction = Number(result.data.direction)
      setQibla({
        direction,
        directionRounded: Number(result.data.direction_rounded ?? direction.toFixed(1)),
        compassPoint: result.data.compass_point || directionName(direction),
      })
    } catch (err) {
      console.error('Qibla error:', err)
      setQibla(null)
      setQiblaError('تعذر حساب اتجاه القبلة حاليًا')
    } finally {
      setQiblaLoading(false)
    }
  }, [])

  const fetchTimings = useCallback(
    async (lat: number, lng: number, city = 'موقعك الحالي') => {
      setRefreshing(true)
      setError('')

      try {
        const response = await fetch(
          `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(
            lat
          )}&longitude=${encodeURIComponent(lng)}&method=${CALCULATION_METHOD}`,
          { cache: 'no-store' }
        )

        if (!response.ok) throw new Error('Prayer timings request failed')

        const result = await response.json()
        if (result.code !== 200 || !result.data?.timings) {
          throw new Error('Prayer timings unavailable')
        }

        const data = result.data
        const nextTimings = data.timings as Timings

        setTimings(nextTimings)
        setCoordinates({ latitude: lat, longitude: lng })
        setLocationName(city)
        setTimeZone(data.meta?.timezone || null)
        setHijriDate(
          data.date?.hijri?.date
            ? `${data.date.hijri.date} ${data.date.hijri.month?.ar || ''}`
            : ''
        )
        setGregorianDate(
          data.date?.gregorian?.date
            ? `${data.date.gregorian.date} ${data.date.gregorian.month?.ar || ''}`
            : ''
        )

        // حساب الصلاة القادمة بعد استلام المواقيت.
        // سيتم إعادة الحساب ثانية عند تغير المنطقة الزمنية من استجابة API.
        calculateNextPrayer(nextTimings)
        await fetchQibla(lat, lng)
      } catch (err) {
        console.error('Prayer timings error:', err)
        setError('تعذر جلب مواقيت الصلاة، سنحاول مرة أخرى')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [calculateNextPrayer, fetchQibla]
  )

  const loadCurrentLocation = useCallback(() => {
    setLoading(true)
    setError('')

    if (!navigator.geolocation) {
      fetchTimings(
        FALLBACK_LOCATION.latitude,
        FALLBACK_LOCATION.longitude,
        FALLBACK_LOCATION.city
      )
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchTimings(
          position.coords.latitude,
          position.coords.longitude,
          'موقعك الحالي'
        )
      },
      () => {
        fetchTimings(
          FALLBACK_LOCATION.latitude,
          FALLBACK_LOCATION.longitude,
          FALLBACK_LOCATION.city
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      }
    )
  }, [fetchTimings])

  useEffect(() => {
    loadCurrentLocation()
  }, [loadCurrentLocation])

  useEffect(() => {
    if (!timings) return

    const timer = window.setInterval(() => {
      calculateNextPrayer(timings)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [timings, calculateNextPrayer])

  useEffect(() => {
    if (!('DeviceOrientationEvent' in window) || !compassEnabled) return

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const webkitEvent = event as DeviceOrientationEvent & {
        webkitCompassHeading?: number
      }

      let heading: number | null = null

      if (typeof webkitEvent.webkitCompassHeading === 'number') {
        heading = webkitEvent.webkitCompassHeading
      } else if (typeof event.alpha === 'number') {
        heading = normalizeAngle(360 - event.alpha)
      }

      if (heading !== null && Number.isFinite(heading)) {
        setDeviceHeading(heading)
      }
    }

    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => window.removeEventListener('deviceorientation', handleOrientation, true)
  }, [compassEnabled])

  const enableCompass = async () => {
    try {
      const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }

      if (typeof orientationEvent.requestPermission === 'function') {
        const permission = await orientationEvent.requestPermission()
        setCompassPermissionState(permission)

        if (permission !== 'granted') return
      }

      setCompassEnabled(true)
    } catch (err) {
      console.error('Compass permission error:', err)
      setCompassPermissionState('denied')
    }
  }

  const compassRotation = qibla
    ? deviceHeading !== null
      ? normalizeAngle(qibla.direction - deviceHeading)
      : qibla.direction
    : 0

  const useFallbackLocation = () => {
    fetchTimings(
      FALLBACK_LOCATION.latitude,
      FALLBACK_LOCATION.longitude,
      FALLBACK_LOCATION.city
    )
  }

  return (
    <div className="min-h-screen bg-mushaf-paper flex flex-col pb-28 md:pb-8 relative">
      {/* الهيدر */}
      <div className="flex justify-between items-center p-4 z-10 relative">
        <Link
          href="/"
          className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition"
          aria-label="العودة للرئيسية"
        >
          <ChevronRight size={24} />
        </Link>

        <div className="text-center">
          <h1 className="font-bold text-mushaf-dark text-lg">مواقيت الصلاة</h1>
          {hijriDate && <p className="text-[11px] text-gray-500 mt-1">{hijriDate}</p>}
        </div>

        <button
          onClick={loadCurrentLocation}
          className="text-mushaf-teal bg-white p-2 rounded-full shadow-sm hover:bg-mushaf-paper transition disabled:opacity-50"
          disabled={refreshing}
          aria-label="تحديث الموقع والمواقيت"
          title="تحديث"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-mushaf-teal gap-4 px-6">
          <div className="w-20 h-20 rounded-full bg-white shadow-sm border border-mushaf-border/40 flex items-center justify-center">
            <Loader2 className="animate-spin" size={40} />
          </div>
          <p className="font-bold font-cairo text-center">جاري حساب المواقيت وتحديد القبلة...</p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-6 relative z-10">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 text-sm font-bold text-center">
              {error}
            </div>
          )}

          {/* بطاقة الصلاة القادمة */}
          <div className="bg-gradient-to-br from-[#175E67] to-[#0D383E] rounded-3xl p-6 shadow-xl text-white relative overflow-hidden border border-mushaf-gold/20">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl" />
            <div className="absolute -bottom-14 -right-10 w-44 h-44 bg-mushaf-gold opacity-5 rounded-full blur-3xl" />

            <div className="flex justify-between items-start relative z-10 mb-7">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md max-w-[75%]">
                <MapPin size={16} className="text-mushaf-gold shrink-0" />
                <span className="text-xs font-bold truncate">{locationName}</span>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <Compass size={24} className="text-mushaf-gold opacity-90" />
              </div>
            </div>

            <div className="relative z-10 text-center">
              <p className="text-mushaf-gold text-sm font-bold mb-2">الصلاة القادمة</p>
              <h2 className="font-uthmani text-4xl mb-2">{nextPrayer.name}</h2>
              <p className="text-3xl font-mono tracking-wide">{formatTime(nextPrayer.time)}</p>

              <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                <Clock size={16} className="text-mushaf-gold" />
                <span className="text-sm font-bold">{nextPrayer.isTomorrow ? 'غدًا بعد' : 'متبقي'}</span>
                <span className="font-mono text-mushaf-gold font-black">{formatCountdown(countdown)}</span>
              </div>
            </div>
          </div>

          {/* التاريخ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-mushaf-border/40 shadow-sm p-4">
              <div className="flex items-center gap-2 text-mushaf-teal mb-2">
                <CalendarDays size={17} />
                <span className="text-xs font-bold">التاريخ الهجري</span>
              </div>
              <p className="font-bold text-mushaf-dark text-sm">{hijriDate || '—'}</p>
            </div>

            <div className="bg-white rounded-2xl border border-mushaf-border/40 shadow-sm p-4">
              <div className="flex items-center gap-2 text-mushaf-teal mb-2">
                <CalendarDays size={17} />
                <span className="text-xs font-bold">التاريخ الميلادي</span>
              </div>
              <p className="font-bold text-mushaf-dark text-sm">{gregorianDate || '—'}</p>
            </div>
          </div>

          {/* قائمة المواقيت */}
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-mushaf-border/40">
            {currentPrayerItems.map((prayer) => {
              const isNext = nextPrayer.id === prayer.id

              return (
                <div
                  key={prayer.id}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                    isNext ? 'bg-mushaf-teal/5 border border-mushaf-teal/20' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isNext
                          ? 'bg-mushaf-teal text-white shadow-md'
                          : prayer.id === 'Sunrise'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-mushaf-paper text-mushaf-teal'
                      }`}
                    >
                      {isNext ? (
                        <Bell size={18} />
                      ) : prayer.id === 'Sunrise' ? (
                        <Sunrise size={18} />
                      ) : (
                        <Clock size={18} />
                      )}
                    </div>

                    <span className={`font-bold ${isNext ? 'text-mushaf-teal text-lg' : 'text-mushaf-dark'}`}>
                      {prayer.name}
                    </span>
                  </div>

                  <div className={`font-mono font-bold ${isNext ? 'text-mushaf-teal text-lg' : 'text-gray-500'}`}>
                    {formatTime(prayer.time)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* بطاقة القبلة */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-mushaf-border/40">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-mushaf-paper text-mushaf-teal flex items-center justify-center border border-mushaf-border/30">
                  <Navigation size={23} />
                </div>
                <div>
                  <h2 className="font-bold text-mushaf-dark">اتجاه القبلة</h2>
                  <p className="text-xs text-gray-500 mt-1">من موقعك الحالي باتجاه مكة المكرمة</p>
                </div>
              </div>

              <button
                onClick={enableCompass}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                  compassEnabled
                    ? 'bg-mushaf-teal text-white'
                    : 'bg-mushaf-paper text-mushaf-teal hover:bg-mushaf-teal/10'
                }`}
              >
                {compassEnabled ? 'البوصلة مفعلة' : 'تفعيل البوصلة'}
              </button>
            </div>

            {qiblaLoading ? (
              <div className="py-10 flex flex-col items-center gap-3 text-mushaf-teal">
                <Loader2 className="animate-spin" size={30} />
                <span className="text-sm font-bold">جاري حساب اتجاه القبلة...</span>
              </div>
            ) : qibla ? (
              <div className="flex flex-col items-center">
                <div className="relative w-64 h-64 rounded-full bg-gradient-to-br from-[#FCFBF8] to-white border border-mushaf-border/40 shadow-inner flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-4 rounded-full border border-mushaf-border/30" />
                  <div className="absolute inset-10 rounded-full border border-gray-100" />

                  <span className="absolute top-4 text-xs font-black text-mushaf-teal">ش</span>
                  <span className="absolute bottom-4 text-xs font-black text-gray-400">ج</span>
                  <span className="absolute right-4 text-xs font-black text-gray-400">ش ر</span>
                  <span className="absolute left-4 text-xs font-black text-gray-400">غ</span>

                  <div className="w-16 h-16 rounded-full bg-[#175E67] text-white flex items-center justify-center shadow-lg border-2 border-mushaf-gold relative z-10">
                    <span className="text-2xl">🕋</span>
                  </div>

                  <div
                    className="absolute inset-0 flex items-start justify-center transition-transform duration-300 ease-out"
                    style={{ transform: `rotate(${compassRotation}deg)` }}
                  >
                    <div className="relative mt-7 w-1.5 h-24 bg-gradient-to-t from-transparent via-mushaf-gold to-mushaf-gold rounded-full origin-bottom shadow-md">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-mushaf-gold border-2 border-white shadow" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-center">
                  <p className="text-mushaf-teal font-black text-2xl">{arabicDigits(qibla.directionRounded.toFixed(1))}°</p>
                  <p className="text-sm text-gray-500 mt-1">باتجاه {qibla.compassPoint || directionName(qibla.direction)}</p>

                  {deviceHeading !== null ? (
                    <p className="text-xs text-green-600 font-bold mt-3">البوصلة تتبع اتجاه هاتفك الآن</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-3">فعّل البوصلة لتحريك المؤشر مع اتجاه الهاتف</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-red-700 text-sm font-bold">
                {qiblaError || 'لا تتوفر بيانات القبلة حاليًا'}
              </div>
            )}

            {compassPermissionState === 'denied' && (
              <p className="text-xs text-red-500 text-center mt-4">تم رفض صلاحية اتجاه الهاتف. يمكنك استخدام زاوية القبلة المعروضة يدويًا.</p>
            )}

            <div className="mt-6 bg-mushaf-paper rounded-2xl p-4 flex items-start gap-3">
              <LocateFixed size={18} className="text-mushaf-gold shrink-0 mt-0.5" />
              <div className="text-xs text-gray-500 leading-relaxed">
                <p className="font-bold text-mushaf-dark mb-1">الموقع المستخدم</p>
                <p>
                  خط العرض: {arabicDigits(coordinates.latitude.toFixed(4))}
                  {' · '}
                  خط الطول: {arabicDigits(coordinates.longitude.toFixed(4))}
                </p>
              </div>
            </div>

            <button
              onClick={useFallbackLocation}
              className="mt-3 w-full py-3 rounded-2xl border border-mushaf-border/40 text-mushaf-teal font-bold text-sm hover:bg-mushaf-paper transition"
            >
              استخدام مسقط كالموقع الافتراضي
            </button>
          </section>

          <div className="text-center pb-3">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              المواقيت والحسابات تعتمد على خدمة AlAdhan وفق طريقة الحساب المحددة داخل التطبيق.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
