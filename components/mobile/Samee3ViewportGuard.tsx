'use client'

import { useEffect, type ReactNode } from 'react'

type Scope = 'messages' | 'admin'

/**
 * Mobile Safari has two different viewports. The keyboard resizes the visual
 * viewport without necessarily changing 100dvh or the document height.
 * Keep the conversation inside the *visible* viewport and let library forms
 * scroll inside their dialogs without changing the message/database logic.
 */
export default function Samee3ViewportGuard({
  scope,
  children,
}: {
  scope: Scope
  children: ReactNode
}) {
  useEffect(() => {
    const body = document.body
    const root = document.documentElement
    const oldScope = body.dataset.samee3MobileScope
    body.dataset.samee3MobileScope = scope

    let raf = 0
    const timers: number[] = []
    let focused: HTMLElement | null = null

    const isEditable = (node: Element | null): node is HTMLElement =>
      node instanceof HTMLElement &&
      (node.matches('input, textarea, select, [contenteditable="true"]'))

    function synchronizeViewport() {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const vv = window.visualViewport
        const height = Math.max(200, Math.round(vv?.height ?? window.innerHeight))
        const offset = Math.max(0, Math.round(vv?.offsetTop ?? 0))
        const bottom = Math.max(0, Math.round(window.innerHeight - (height + offset)))
        root.style.setProperty('--samee3-vv-height', `${height}px`)
        root.style.setProperty('--samee3-vv-top', `${offset}px`)
        root.style.setProperty('--samee3-keyboard-gap', `${bottom}px`)
        body.classList.toggle('samee3-field-focused', Boolean(focused))
        body.classList.toggle('samee3-keyboard-visible', Boolean(focused) && bottom > 100)
        if (scope === 'admin' && focused) revealAdminField(focused)
      })
    }

    function revealAdminField(target: HTMLElement) {
      if (!document.contains(target)) return
      const overlay = target.closest<HTMLElement>('[role="dialog"], .fixed.inset-0')
      // For ordinary library inputs, let Safari's own document scroll work.
      // Only scroll the dialog itself: window.scrollTo/scrollIntoView on the
      // whole page can leave the screen completely empty on iPhone Safari.
      if (!overlay) return
      const vv = window.visualViewport
      const viewportTop = vv?.offsetTop ?? 0
      const viewportBottom = viewportTop + (vv?.height ?? window.innerHeight)
      const r = target.getBoundingClientRect()
      const minY = viewportTop + 18
      const maxY = viewportBottom - 28
      if (r.bottom > maxY) {
        overlay.scrollBy({ top: r.bottom - maxY, behavior: 'instant' })
      } else if (r.top < minY) {
        overlay.scrollBy({ top: r.top - minY, behavior: 'instant' })
      }
    }

    function onFocus(event: FocusEvent) {
      const node = event.target
      focused = node instanceof Element && isEditable(node) ? node : null
      synchronizeViewport()
      // iOS animates keyboard geometry after focus, not synchronously.
      for (const delay of [80, 230, 440]) {
        timers.push(window.setTimeout(synchronizeViewport, delay))
      }
    }

    function onBlur() {
      focused = null
      synchronizeViewport()
      timers.push(window.setTimeout(synchronizeViewport, 260))
    }

    synchronizeViewport()
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('focusout', onBlur, true)
    window.visualViewport?.addEventListener('resize', synchronizeViewport)
    window.visualViewport?.addEventListener('scroll', synchronizeViewport)
    window.addEventListener('resize', synchronizeViewport)
    window.addEventListener('orientationchange', synchronizeViewport)

    return () => {
      window.cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('focusout', onBlur, true)
      window.visualViewport?.removeEventListener('resize', synchronizeViewport)
      window.visualViewport?.removeEventListener('scroll', synchronizeViewport)
      window.removeEventListener('resize', synchronizeViewport)
      window.removeEventListener('orientationchange', synchronizeViewport)
      if (body.dataset.samee3MobileScope === scope) {
        if (oldScope) body.dataset.samee3MobileScope = oldScope
        else delete body.dataset.samee3MobileScope
      }
      body.classList.remove('samee3-field-focused', 'samee3-keyboard-visible')
      root.style.removeProperty('--samee3-vv-height')
      root.style.removeProperty('--samee3-vv-top')
      root.style.removeProperty('--samee3-keyboard-gap')
    }
  }, [scope])

  return (
    <>
      <style>{`
        /* Isolated to support messages and the admin panel. */
        @media (max-width: 767px) {
          body[data-samee3-mobile-scope="messages"] {
            overflow: hidden !important;
            overscroll-behavior: none !important;
          }
          body[data-samee3-mobile-scope="messages"] nav[aria-label="التنقل الرئيسي"],
          body[data-samee3-mobile-scope="admin"] nav[aria-label="التنقل الرئيسي"],
          body[data-samee3-mobile-scope="messages"] nav.fixed[class*="bottom-"],
          body[data-samee3-mobile-scope="admin"] nav.fixed[class*="bottom-"] ,
          body[data-samee3-mobile-scope="messages"] aside[aria-label="التحكم في تلاوة المصحف"],
          body[data-samee3-mobile-scope="admin"] aside[aria-label="التحكم في تلاوة المصحف"] {
            display: none !important;
          }

          /* USER CHAT: remove the old 480px minimum and 100dvh subtraction. */
          #samee3-mobile-message-root {
            position: fixed !important;
            z-index: 45;
            left: 0;
            right: 0;
            top: var(--samee3-vv-top, 0px);
            height: var(--samee3-vv-height, 100dvh);
            width: 100%;
            overflow: hidden !important;
            background: #f4f9fe;
            isolation: isolate;
          }
          #samee3-mobile-message-root > main {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
            padding: 8px 8px max(8px, env(safe-area-inset-bottom)) !important;
            margin: 0 !important;
            overflow: hidden !important;
          }
          #samee3-mobile-message-root > main > section:has(> header) {
            display: flex !important;
            flex: 1 1 auto !important;
            flex-direction: column !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: hidden !important;
            border-radius: 18px !important;
          }
          #samee3-mobile-message-root > main > section > header { flex: 0 0 auto !important; }
          #samee3-mobile-message-root > main > section > div {
            min-height: 0 !important;
            flex: 1 1 auto !important;
            overflow: hidden !important;
          }
          #samee3-mobile-message-root > main > section > div > div.overflow-y-auto {
            min-height: 0 !important;
            overflow-y: auto !important;
            overscroll-behavior: contain !important;
            -webkit-overflow-scrolling: touch;
          }
          #samee3-mobile-message-root form {
            flex: 0 0 auto !important;
            padding: 8px !important;
            padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
          }
          #samee3-mobile-message-root textarea {
            min-width: 0 !important;
            max-height: 110px !important;
            resize: none !important;
            font-size: 16px !important;
            color: #1e293b !important;
          }
          body.samee3-keyboard-visible #samee3-mobile-message-root form {
            padding-bottom: 8px !important;
          }

          /* ADMIN CHAT: the previous height update alone was insufficient,
             because the page could still scroll under the iOS keyboard. */
          body[data-samee3-mobile-scope="admin"] .samee3-admin-inbox-page {
            position: fixed !important;
            z-index: 45 !important;
            inset-inline: 0 !important;
            top: var(--samee3-vv-top, 0px) !important;
            height: var(--samee3-vv-height, 100dvh) !important;
            max-height: var(--samee3-vv-height, 100dvh) !important;
            min-height: 0 !important;
            overflow: hidden !important;
            padding-top: 8px !important;
            padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
          }
          body.samee3-keyboard-visible .samee3-admin-inbox-page {
            padding-bottom: 8px !important;
          }
          body[data-samee3-mobile-scope="admin"] .samee3-admin-inbox-page textarea,
          body[data-samee3-mobile-scope="admin"] .samee3-admin-scope input:not([type="checkbox"]),
          body[data-samee3-mobile-scope="admin"] .samee3-admin-scope textarea,
          body[data-samee3-mobile-scope="admin"] .samee3-admin-scope select {
            font-size: 16px !important; /* Prevent Safari focus zoom */
            scroll-margin-top: 16px;
            scroll-margin-bottom: 28px;
          }
          body[data-samee3-mobile-scope="admin"] .samee3-admin-scope {
            max-width: 100%;
            min-width: 0;
            overflow-x: clip;
          }
          /* LIBRARY: focusable book/lesson forms must scroll within dialog. */
          body[data-samee3-mobile-scope="admin"] .fixed.inset-0:has(input, textarea, select),
          body[data-samee3-mobile-scope="admin"] [role="dialog"]:has(input, textarea, select) {
            top: var(--samee3-vv-top, 0px) !important;
            bottom: auto !important;
            max-height: var(--samee3-vv-height, 100dvh) !important;
            height: var(--samee3-vv-height, 100dvh) !important;
            overflow-y: auto !important;
            overscroll-behavior: contain !important;
            -webkit-overflow-scrolling: touch;
            align-items: safe center !important;
            padding: 12px !important;
          }
          body[data-samee3-mobile-scope="admin"] .fixed.inset-0:has(input, textarea, select) > div,
          body[data-samee3-mobile-scope="admin"] [role="dialog"]:has(input, textarea, select) > div {
            min-width: 0 !important;
            max-width: 100% !important;
            max-height: calc(var(--samee3-vv-height, 100dvh) - 24px) !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          body[data-samee3-mobile-scope="admin"] .samee3-admin-scope input,
          body[data-samee3-mobile-scope="admin"] .samee3-admin-scope textarea {
            max-width: 100%;
          }
        }
      `}</style>
      <div
        id={scope === 'messages' ? 'samee3-mobile-message-root' : undefined}
        className={scope === 'admin' ? 'samee3-admin-scope' : undefined}
      >
        {children}
      </div>
    </>
  )
}