'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('SAMEE3: Service Worker غير مدعوم في هذا المتصفح')
      return
    }

    let isReloading = false
    let disposed = false

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        if (disposed) return

        console.log(
          'SAMEE3 Service Worker registered:',
          registration.scope,
        )

        try {
          await registration.update()
        } catch (updateError) {
          console.warn(
            'SAMEE3 Service Worker update warning:',
            updateError,
          )
        }

        /*
         * نحاول جعل مساحة التخزين أكثر ثباتًا للـPWA.
         * المتصفح هو صاحب القرار النهائي، لذلك فشل هذا الطلب لا يكسر التطبيق.
         */
        try {
          if ('storage' in navigator && 'persist' in navigator.storage) {
            await navigator.storage.persist()
          }
        } catch {
          // التخزين العادي يظل فعالًا حتى لو لم يمنح المتصفح persistent storage.
        }
      } catch (error) {
        console.error(
          'SAMEE3 Service Worker registration failed:',
          error,
        )
      }
    }

    void registerServiceWorker()

    const handleControllerChange = () => {
      if (isReloading || disposed) return

      isReloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    )

    return () => {
      disposed = true
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      )
    }
  }, [])

  return null
}
