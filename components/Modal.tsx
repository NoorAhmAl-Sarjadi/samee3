'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const dialogs: Array<{ id: symbol; element: HTMLElement | null }> = []
let bodyOverflow = ''

export default function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  const root = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  const [mounted, setMounted] = useState(false)
  close.current = onClose
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted) return
    const previous = document.activeElement as HTMLElement | null
    const id = Symbol('dialog')
    if (!dialogs.length) bodyOverflow = document.body.style.overflow
    dialogs.push({ id, element: root.current })
    document.body.style.overflow = 'hidden'
    root.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1]?.id !== id) return
      if (event.key === 'Escape') { event.stopPropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const controls = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]')
      if (!controls?.length) { event.preventDefault(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      const wasTop = dialogs[dialogs.length - 1]?.id === id
      const index = dialogs.findIndex((dialog) => dialog.id === id)
      if (index >= 0) dialogs.splice(index, 1)
      if (!dialogs.length) document.body.style.overflow = bodyOverflow
      document.removeEventListener('keydown', keydown)
      if (wasTop) {
        if (previous?.isConnected) previous.focus()
        else dialogs[dialogs.length - 1]?.element?.focus()
      }
    }
  }, [mounted])
  if (!mounted) return null
  return createPortal(<div dir="rtl" className="fixed inset-0 z-[300] flex items-center justify-center bg-[#071a20]/75 p-2 backdrop-blur-sm sm:p-5" onPointerDown={(event) => event.stopPropagation()} onPointerMove={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[94dvh] w-full overflow-auto rounded-3xl bg-[#faf8f3] p-4 text-[#173f43] shadow-2xl outline-none sm:p-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>{children}</section>
  </div>, document.body)
}