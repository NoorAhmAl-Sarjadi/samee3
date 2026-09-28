'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('SAMEE3: Service Worker غير مدعوم في هذا المتصفح')
      return
    }

    let isReloading = false

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        console.log(
          'SAMEE3 Service Worker registered:',
          registration.scope
        )

        // طلب تحديث نسخة الـ Service Worker
        try {
          await registration.update()
        } catch (updateError) {
          console.warn(
            'SAMEE3 Service Worker update warning:',
            updateError
          )
        }
      } catch (error) {
        console.error(
          'SAMEE3 Service Worker registration failed:',
          error
        )
      }
    }

    // التسجيل مباشرة بدون انتظار window.load
    registerServiceWorker()

    // عند انتقال التحكم للـ Service Worker،
    // نعيد تحميل الصفحة مرة واحدة حتى تصبح الصفحة الحالية
    // تحت تحكم الـ Service Worker ويتم تخزين ملفاتها.
    const handleControllerChange = () => {
      if (isReloading) {
        return
      }

      isReloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    )

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      )
    }
  }, [])

  return null
}