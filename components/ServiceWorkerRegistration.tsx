'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log(
            'SAMEE3 Service Worker registered:',
            registration.scope
          )
        })
        .catch((error) => {
          console.error(
            'SAMEE3 Service Worker registration failed:',
            error
          )
        })
    })
  }, [])

  return null
}