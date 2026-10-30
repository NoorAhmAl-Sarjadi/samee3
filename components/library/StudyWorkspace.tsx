'use client'

import { useState, type ReactNode } from 'react'
import { BookOpen, Columns2, Video } from 'lucide-react'

/** Keep the PDF and media in separate tracks; neither can paint over the other. */
export default function StudyWorkspace({
  media,
  book,
  sourcePicker,
  lessons,
  hasVideo = true,
}: {
  media: ReactNode
  book: ReactNode
  sourcePicker?: ReactNode
  lessons?: ReactNode
  hasVideo?: boolean
}) {
  const [view, setView] = useState<'both' | 'book' | 'video'>('both')
  const activeView = hasVideo ? view : 'book'
  return (
    <div data-study-workspace dir="rtl" className="flex min-h-0 flex-1 flex-col gap-2 text-slate-900">
      <nav aria-label="طريقة عرض الكتاب والشرح" className="flex shrink-0 flex-wrap items-center gap-1.5">
        {(
          [
            ['both', 'الكتاب والشرح', Columns2],
            ['book', 'تكبير الكتاب', BookOpen],
            ['video', 'تكبير الشرح', Video],
          ] as const
        )
          .filter(([id]) => hasVideo || id === 'book')
          .map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeView === id}
              onClick={() => setView(id)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${activeView === id ? 'border-teal-800 bg-teal-800 text-white' : 'border-[#d7ccb7] bg-white text-slate-700'}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
      </nav>
      <div
        data-study-tracks
        className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${activeView === 'both' ? 'grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]' : 'grid-cols-1 grid-rows-[minmax(0,1fr)]'}`}
      >
        <div
          data-study-media
          className={`${activeView === 'book' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col gap-2 overflow-y-auto overscroll-contain ${activeView === 'both' ? 'max-h-[42dvh] lg:max-h-none' : ''}`}
        >
          {sourcePicker}
          {media}
          {lessons}
        </div>
        <div
          data-study-book
          className={`${activeView === 'video' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col gap-2 overflow-hidden`}
        >
          {book}
        </div>
      </div>
    </div>
  )
}
