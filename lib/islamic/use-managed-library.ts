'use client'

import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  mergeLibraryBook,
  mergeLibraryCatalog,
  mergeLessons,
  type ManagedBook,
  type StoredRecord,
} from './managed-library'

export function useManagedCatalog() {
  const [books, setBooks] = useState<ManagedBook[]>(() => mergeLibraryCatalog([]))
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'islamicLibraryBooks'),
        (snapshot) => {
          setBooks(mergeLibraryCatalog(snapshot.docs.map((item) => ({ id: item.id, data: item.data() }))))
          setReady(true)
          setError('')
        },
        () => {
          setReady(true)
          setError('تعذّر تحديث المكتبة. تحقق من الاتصال ثم أعد تحميل الصفحة.')
        },
      ),
    [],
  )
  return { books, ready, error }
}

export function useManagedBook(id: string | null) {
  const [state, setState] = useState<{
    id: string | null
    book: ManagedBook | null
    ready: boolean
    lessonsReady: boolean
    error: string
  }>({ id, book: null, ready: false, lessonsReady: false, error: '' })
  useEffect(() => {
    if (!id) {
      setState({ id, book: null, ready: false, lessonsReady: false, error: '' })
      return
    }
    let raw: Record<string, unknown> = {},
      lessons: StoredRecord[] = []
    let ready = false,
      lessonsReady = false,
      error = '',
      alive = true
    const publish = () => {
      if (!alive) return
      const book = mergeLibraryBook(id, raw)
      if (book) book.videos = mergeLessons(book.videos, lessons)
      setState({ id, book, ready, lessonsReady, error })
    }
    publish()
    const stopBook = onSnapshot(
      doc(db, 'islamicLibraryBooks', id),
      (snapshot) => {
        raw = snapshot.data() || {}
        ready = true
        publish()
      },
      () => {
        ready = true
        error = 'تعذّر تحديث بيانات الكتاب. تحقق من الاتصال وأعد المحاولة.'
        publish()
      },
    )
    const stopLessons = onSnapshot(
      collection(db, 'islamicLibraryBooks', id, 'videos'),
      (snapshot) => {
        lessons = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }))
        lessonsReady = true
        publish()
      },
      () => {
        lessonsReady = false
        error = 'تعذّر تحميل الدروس الحالية. أعد المحاولة قبل تعديلها.'
        publish()
      },
    )
    return () => {
      alive = false
      stopBook()
      stopLessons()
    }
  }, [id])
  return state.id === id ? state : { id, book: null, ready: false, lessonsReady: false, error: '' }
}
