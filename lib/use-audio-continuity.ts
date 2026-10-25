'use client'

import { useEffect, type RefObject } from 'react'

export function useAudioContinuity(ref: RefObject<HTMLAudioElement | null>, notify: (message: string) => void) {
  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0, wanted = false, restoring = false, failed = false, lastSave = 0, recoveredAt = 0, previous = ''
    let resume = 0
    const key = () => {
      const url = new URL(audio.currentSrc || audio.src, location.href)
      url.searchParams.delete('_retry')
      return url.href
    }
    const stopTimer = () => { clearTimeout(timer); timer = undefined }
    const save = () => {
      if (!audio.src || audio.src.startsWith('blob:') || !Number.isFinite(audio.currentTime) || audio.currentTime < 1) return
      try { localStorage.setItem('samee3_audio_position_v2', JSON.stringify({ url: key(), time: audio.currentTime, at: Date.now() })) } catch {}
    }
    const restore = () => {
      const position = resume
      resume = 0
      if (position > 0 && Number.isFinite(audio.duration) && position < audio.duration - 2) {
        try { audio.currentTime = position } catch {}
      }
      if (restoring && wanted) {
        restoring = false
        void audio.play().catch(() => { wanted = false; notify('اضغط تشغيل لاستكمال الصوت من نفس الموضع.') })
      } else restoring = false
    }
    const recover = () => {
      timer = undefined
      if (!wanted || audio.ended || !audio.src || audio.src.startsWith('blob:') || navigator.onLine === false) return
      if (attempts >= 3) { wanted = false; notify('المصدر لا يستجيب. اضغط تشغيل للمحاولة من نفس الموضع أو حمّل التسجيل.'); return }
      const time = audio.currentTime
      save(); attempts++; restoring = true; failed = false; recoveredAt = Date.now(); resume = time
      const src = new URL(audio.src, location.href)
      if (src.pathname === '/api/audio-proxy') src.searchParams.set('_retry', String(Date.now()))
      audio.src = src.href
      audio.load()
    }
    const waiting = () => { if (wanted && !timer) timer = setTimeout(recover, 15000) }
    const playing = () => { wanted = true; restoring = false; stopTimer() }
    const pause = () => { if (!restoring) { wanted = false; stopTimer(); save() } }
    const play = () => { wanted = true; if (!restoring) attempts = 0 }
    const progress = () => {
      if (!failed && !audio.paused && audio.readyState >= 3) stopTimer()
      if (recoveredAt && Date.now() - recoveredAt > 30000) attempts = 0
      if (Date.now() - lastSave > 5000) { lastSave = Date.now(); save() }
    }
    const load = () => {
      const current = key()
      if (current === previous) return
      previous = current; attempts = 0
      if (!restoring) {
        resume = 0
        try {
          const saved = JSON.parse(localStorage.getItem('samee3_audio_position_v2') || '{}')
          if (saved.url === current && Date.now() - saved.at < 86400000 && Number.isFinite(saved.time)) resume = Math.max(0, saved.time)
        } catch {}
      }
    }
    const error = () => {
      if (audio.error?.code === 2) {
        wanted = true; failed = true; stopTimer()
        if (navigator.onLine !== false) timer = setTimeout(recover, 1000 * (attempts + 1))
      } else { wanted = false; restoring = false; stopTimer(); notify('تعذر تشغيل صيغة هذا الملف أو لم يعد متاحًا لدى المصدر.') }
    }
    const manualRetry = () => {
      stopTimer(); attempts = 0; wanted = true
      if (navigator.onLine === false) { notify('اتصل بالإنترنت لاستكمال التسجيل غير المحفوظ.'); return }
      recover()
    }
    const online = () => { if (wanted) waiting() }
    const ended = () => { wanted = false; stopTimer(); try { localStorage.removeItem('samee3_audio_position_v2') } catch {} }
    const events = { loadstart: load, loadedmetadata: restore, play, playing, pause, waiting, stalled: waiting, timeupdate: progress, error, ended, 'samee3-audio-retry': manualRetry }
    for (const [name, listener] of Object.entries(events)) audio.addEventListener(name, listener)
    window.addEventListener('online', online); window.addEventListener('pagehide', save)
    return () => {
      save(); stopTimer()
      for (const [name, listener] of Object.entries(events)) audio.removeEventListener(name, listener)
      window.removeEventListener('online', online); window.removeEventListener('pagehide', save)
    }
  }, [ref, notify])
}