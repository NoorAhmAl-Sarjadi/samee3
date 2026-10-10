'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

/**
 * SAMEE3 — Service Worker registration and safe update prompt.
 * Path: components/ServiceWorkerRegistration.tsx
 *
 * Never clears Cache Storage, unregisters the SW, or reloads the page
 * automatically while Quran audio/downloads may be running.
 */

const SW_URL = '/sw.js'
const CHECK_INTERVAL_MS = 30 * 60 * 1000
const ACTIVATION_WAIT_MS = 12 * 1000

export default function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [applyingUpdate, setApplyingUpdate] = useState(false)

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const reloadOnActivationRef = useRef(false)
  const activationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      return
    }

    const serviceWorkers = navigator.serviceWorker
    let disposed = false
    let checking = false
    let lastCheckedAt = 0
    let hadController = Boolean(serviceWorkers.controller)
    let listeningRegistration: ServiceWorkerRegistration | null = null
    let installingWorker: ServiceWorker | null = null

    const onInstallingStateChange = () => {
      if (
        !disposed &&
        installingWorker?.state === 'installed' &&
        serviceWorkers.controller
      ) {
        setUpdateAvailable(true)
      }
    }

    const watchInstalling = (worker: ServiceWorker | null) => {
      if (installingWorker) {
        installingWorker.removeEventListener(
          'statechange',
          onInstallingStateChange,
        )
      }

      installingWorker = worker

      if (worker) {
        worker.addEventListener('statechange', onInstallingStateChange)
        onInstallingStateChange()
      }
    }

    const onUpdateFound = () => {
      watchInstalling(listeningRegistration?.installing || null)
    }

    const attachRegistration = (registration: ServiceWorkerRegistration) => {
      if (disposed) return

      if (listeningRegistration !== registration) {
        listeningRegistration?.removeEventListener(
          'updatefound',
          onUpdateFound,
        )
        listeningRegistration = registration
        registration.addEventListener('updatefound', onUpdateFound)
      }

      registrationRef.current = registration
      watchInstalling(registration.installing)

      if (registration.waiting && serviceWorkers.controller) {
        setUpdateAvailable(true)
      }
    }

    const onControllerChange = () => {
      if (disposed) return

      const nowControlled = Boolean(serviceWorkers.controller)
      const replacingExistingWorker = hadController && nowControlled
      hadController = nowControlled

      if (!replacingExistingWorker) return

      if (reloadOnActivationRef.current) {
        window.location.reload()
      } else {
        // The new SW may take control now, but we never interrupt
        // an active recitation or a Quran/tafsir download with reload.
        setUpdateAvailable(true)
        setApplyingUpdate(false)
      }
    }

    const checkForUpdates = async (force = false) => {
      if (disposed || checking || navigator.onLine === false) return

      const now = Date.now()
      if (!force && now - lastCheckedAt < CHECK_INTERVAL_MS) return

      checking = true

      try {
        const existing = registrationRef.current
        const registration = existing || await serviceWorkers.register(
          SW_URL,
          { scope: '/', updateViaCache: 'none' },
        )

        if (disposed) return
        attachRegistration(registration)

        // register() already checks the script; don't immediately
        // issue a second network request for a new registration.
        if (existing) {
          await registration.update()
        }

        lastCheckedAt = Date.now()
      } catch (error) {
        if (!disposed && navigator.onLine) {
          console.warn('SAMEE3: تعذر فحص تحديث التطبيق.', error)
        }
      } finally {
        checking = false
      }
    }

    const onOnline = () => { void checkForUpdates(true) }
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates()
      }
    }

    serviceWorkers.addEventListener('controllerchange', onControllerChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    const periodicCheck = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates()
      }
    }, CHECK_INTERVAL_MS)

    if (navigator.onLine === false) {
      // An existing worker continues serving downloaded content offline.
      void serviceWorkers.getRegistration('/').then((registration) => {
        if (registration && !disposed) attachRegistration(registration)
      }).catch(() => undefined)
    } else {
      void checkForUpdates(true)
    }

    // Best effort only; refusal never deletes or blocks downloads.
    void (async () => {
      try {
        if (navigator.storage?.persist) {
          const persisted = await navigator.storage.persisted?.()
          if (!disposed && !persisted) {
            await navigator.storage.persist()
          }
        }
      } catch {
        // The browser owns storage persistence policy.
      }
    })()

    return () => {
      disposed = true
      window.clearInterval(periodicCheck)

      if (activationTimeoutRef.current !== null) {
        clearTimeout(activationTimeoutRef.current)
        activationTimeoutRef.current = null
      }

      watchInstalling(null)
      listeningRegistration?.removeEventListener('updatefound', onUpdateFound)
      serviceWorkers.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)

      reloadOnActivationRef.current = false
    }
  }, [])

  const installUpdate = () => {
    if (applyingUpdate) return

    const waiting = registrationRef.current?.waiting

    if (!waiting) {
      // The current public/sw.js calls skipWaiting() itself.
      // Refresh only after the user explicitly chooses to do so.
      window.location.reload()
      return
    }

    reloadOnActivationRef.current = true
    setApplyingUpdate(true)
    waiting.postMessage({ type: 'SKIP_WAITING' })

    // Don't leave the button disabled forever if the browser does
    // not activate a waiting worker (e.g. because of an OS policy).
    activationTimeoutRef.current = window.setTimeout(() => {
      activationTimeoutRef.current = null
      reloadOnActivationRef.current = false
      setApplyingUpdate(false)
    }, ACTIVATION_WAIT_MS)
  }

  if (!updateAvailable) return null

  return (
    <aside
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-3 right-3 z-[120] mx-auto max-w-md rounded-2xl border border-[#dfc89d] bg-white p-4 text-[#12384a] shadow-[0_14px_45px_rgba(15,49,67,0.20)] sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8f0df] text-[#b18a4a]">
          <RefreshCw size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">تحديث جديد لمصحف سميع</p>
          <p className="mt-1 text-xs leading-6 text-slate-600">
            التحديث جاهز. لن نعيد تحميل الصفحة تلقائيًا حتى لا تنقطع
            التلاوة أو التنزيلات الجارية. احفظ عملك ثم حدّث في الوقت المناسب.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setUpdateAvailable(false)}
          aria-label="تأجيل التحديث"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={installUpdate}
        disabled={applyingUpdate}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#145a72] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        <RefreshCw
          size={17}
          className={applyingUpdate ? 'animate-spin' : ''}
          aria-hidden="true"
        />
        {applyingUpdate ? 'جارٍ تفعيل التحديث…' : 'تحديث التطبيق الآن'}
      </button>
    </aside>
  )
}
