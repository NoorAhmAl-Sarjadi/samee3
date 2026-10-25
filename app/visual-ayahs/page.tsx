'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'

const GT_URL = '/api/gt-sqr/'
const GT_SOURCE = 'https://github.com/SalehGNUTUX/GT-SQR'

export default function VisualAyahsPage() {
  const frame = useRef<HTMLIFrameElement>(null)

  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [failed, setFailed] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === 'samee3-gt-ready'
      ) {
        setLoading(false)
        setSlow(false)
        setFailed(false)
      }
    }

    window.addEventListener('message', onMessage)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    document
      .querySelectorAll<HTMLMediaElement>('audio,video')
      .forEach(element => element.pause())

    const audio = (
      window as Window & {
        __samee3PersistentAudio?: HTMLAudioElement & {
          __samee3Continue?: boolean
        }
      }
    ).__samee3PersistentAudio

    if (audio) {
      audio.__samee3Continue = false
      audio.pause()
    }

    const updateConnection = () => {
      setOffline(navigator.onLine === false)
    }

    updateConnection()

    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)

    return () => {
      window.removeEventListener('message', onMessage)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  useEffect(() => {
    if (!loading) return

    const timer = window.setTimeout(() => {
      setSlow(true)
    }, 20000)

    return () => window.clearTimeout(timer)
  }, [loading, version])

  function reload() {
    setLoading(true)
    setSlow(false)
    setFailed(false)
    setVersion(value => value + 1)
  }

  return (
    <main
      dir="rtl"
      className="fixed inset-0 z-[100] flex flex-col bg-[#f5f1e7] text-[#233e35]"
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-[#dfd7c7] bg-[#f5f1e7] px-3 pb-2"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        }}
      >
        <Link
          href="/"
          aria-label="العودة إلى سميع"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9d1c1] bg-white"
        >
          <ArrowRight size={20} />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="text-base font-extrabold">
            آيات مرئية
          </h1>

          <p className="text-[10px] text-[#737c73]">
            GT-SQR · مدمج في سميع
          </p>
        </div>

        <button
          type="button"
          onClick={reload}
          aria-label="إعادة تحميل محرر GT-SQR"
          title="إعادة التحميل تفقد التغييرات غير المحفوظة داخل المحرر"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9d1c1] bg-white"
        >
          <RefreshCw size={18} />
        </button>

        <a
          href={GT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="فتح GT-SQR في صفحة مستقلة"
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#35695b] px-3 text-xs font-bold text-white"
        >
          <ExternalLink size={17} />

          <span className="hidden sm:inline">
            فتح مستقل
          </span>
        </a>
      </header>

      {(offline || failed || slow) && (
        <div
          role="status"
          className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-6 text-amber-900"
        >
          {offline
            ? 'اتصل بالإنترنت لاستخدام مصادر المحرر، ثم أعد التحميل.'
            : 'إذا لم يظهر المحرر، اضغط زر الفتح المستقل أعلى الصفحة.'}
        </div>
      )}

      <section className="relative min-h-0 flex-1 bg-[#0a0c0b]">
        <iframe
          ref={frame}
          key={version}
          src={GT_URL}
          title="محرر آيات مرئية — GT-SQR"
          className="absolute inset-0 h-full w-full border-0 bg-[#0a0c0b]"
          allow="autoplay; fullscreen; clipboard-write; web-share; screen-wake-lock"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onLoad={() => {
            frame.current?.contentWindow?.postMessage(
              { type: 'samee3-gt-status' },
              location.origin,
            )
          }}
          onError={() => {
            setLoading(false)
            setFailed(true)
          }}
        />

        {loading && !slow && (
          <div
            role="status"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f5f1e7] text-sm font-bold text-[#35695b]"
          >
            <Loader2
              size={28}
              className="animate-spin"
            />

            جارٍ فتح محرر GT-SQR…
          </div>
        )}
      </section>

      <footer
        className="shrink-0 border-t border-[#dfd7c7] px-3 pt-1.5 text-center text-[10px] leading-5 text-[#737c73]"
        style={{
          paddingBottom:
            'max(0.375rem, env(safe-area-inset-bottom))',
        }}
      >
        يعمل بمشروع{' '}

        <a
          href={GT_SOURCE}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#35695b] underline"
        >
          GT-SQR · SalehGNUTUX
        </a>

        {' · '}

        <a
          href="/api/gt-sqr/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          AGPL-3.0
        </a>
      </footer>
    </main>
  )
}