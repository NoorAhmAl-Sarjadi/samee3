'use client'

import { useEffect } from 'react'

const SERVICE_WORKER_URL = '/sw.js'
const UPDATE_CHECK_INTERVAL_MS = 60_000

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return

    const serviceWorkers = navigator.serviceWorker
    let disposed = false
    let checking = false
    let lastCheckAt: number | null = null
    let registration: ServiceWorkerRegistration | null = null

    const checkForUpdates = async (force = false) => {
      // النسخة المثبتة تظل تعمل دون اتصال؛ ننتظر الشبكة للتسجيل أو التحديث.
      if (disposed || checking || navigator.onLine === false) return

      const now = Date.now()
      if (
        !force &&
        lastCheckAt !== null &&
        now - lastCheckAt < UPDATE_CHECK_INTERVAL_MS
      ) {
        return
      }

      checking = true
      lastCheckAt = now

      try {
        if (registration) {
          await registration.update()
        } else {
          // register يفحص التحديث أيضًا؛ لا نكرر الطلب فور التسجيل.
          const nextRegistration = await serviceWorkers.register(
            SERVICE_WORKER_URL,
            { scope: '/', updateViaCache: 'none' },
          )

          if (!disposed) registration = nextRegistration
        }
      } catch (error) {
        if (!disposed && navigator.onLine) {
          console.warn('SAMEE3: تعذر تسجيل أو تحديث Service Worker.', error)
        }
        // نحافظ على التسجيل القديم والملفات المحفوظة عند فشل الشبكة.
      } finally {
        checking = false
      }
    }

    const requestPersistentStorage = async () => {
      try {
        const storage = navigator.storage
        if (!storage || typeof storage.persist !== 'function') return

        const alreadyPersistent =
          typeof storage.persisted === 'function'
            ? await storage.persisted()
            : false

        if (!disposed && !alreadyPersistent) {
          await storage.persist()
        }
      } catch {
        // رفض الطلب لا يعطل التخزين العادي؛ المتصفح يقرر منح الاستمرارية.
      }
    }

    const handleOnline = () => {
      void checkForUpdates(true)
    }

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    void checkForUpdates(true)
    void requestPersistentStorage()

    // لا نعيد تحميل الصفحة عند controllerchange حتى لا نقطع التلاوة
    // أو التنزيل الجاري، ولا نحذف أي كاش أو تسجيل من هذا المكوّن.
    return () => {
      disposed = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [])

  return null
}
