1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, Search } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { LEARNING_COURSES, LEARNING_LEVELS, type LearningCourse, type LevelId } from '@/lib/islamic/curriculum'
import { SUNNI_LIBRARY_CATEGORIES, type SunniLibraryCategoryId } from '@/lib/islamic/sunniLibrary'
import { useLearningProgress } from '@/lib/islamic/learning-progress'

type CatalogBook = LearningCourse & { deleted?: boolean }
const levelOf = (level: string): LevelId => level === 'متوسط' ? 'intermediate' : level === 'متقدم' ? 'advanced' : 'beginner'
const allowedCategory = (x: unknown): x is SunniLibraryCategoryId => typeof x === 'string' && SUNNI_LIBRARY_CATEGORIES.some(c => c.id === x)
export default function ManagedCategoryView({ levelId, categoryId }: { levelId: LevelId; categoryId: string }) {
  const progress = useLearningProgress()
  const [books, setBooks] = useState<CatalogBook[]>(LEARNING_COURSES)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => onSnapshot(collection(db, 'islamicLibraryBooks'), snapshot => {
    const map = new Map<string, CatalogBook>(LEARNING_COURSES.map(course => [course.id, { ...course }]))
    for (const item of snapshot.docs) {
      const d = item.data()
      const initial = map.get(item.id)
      if (!initial && !(typeof d.title === 'string' && typeof d.author === 'string' && typeof d.description === 'string')) continue
      const merged: CatalogBook = initial ? { ...initial } : {
        id: item.id, title: d.title, author: d.author, description: d.description,
        level: d.level || 'مبتدئ', category: allowedCategory(d.category) ? d.category : 'aqidah', levelId: levelOf(d.level),
      }
      for (const key of ['title','author','description'] as const) if (typeof d[key] === 'string' && d[key].trim()) merged[key] = d[key]
      if (allowedCategory(d.category)) merged.category = d.category
      // Certificate curriculum IDs stay stable. Display category edits without modifying certificate logic.
      if (typeof d.level === 'string' && ['مبتدئ','متوسط','متقدم'].includes(d.level)) merged.levelId = levelOf(d.level)
      merged.deleted = d.deleted === true
      map.set(item.id, merged)
    }
    setBooks([...map.values()])
  }, () => setNotice('تعذّر تحديث فهرس المكتبة؛ يجري عرض القائمة الأساسية.')), [])
  const level = LEARNING_LEVELS.find(x => x.id === levelId)!
  const category = SUNNI_LIBRARY_CATEGORIES.find(x => x.id === categoryId)!
  const filtered = useMemo(() => books.filter(b => !b.deleted && b.levelId === levelId && b.category === categoryId && `${b.title} ${b.author}`.toLowerCase().includes(query.trim().toLowerCase())), [books, levelId, categoryId, query])
  return <div dir="rtl" className="min-h-screen bg-[#f7f5ee] pb-28 text-[#203f43]"><div className="h-1 bg-gradient-to-l from-[#98713c] via-[#d9c39b] to-[#175759]"/><main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-10">
    <Link href={`/islamic-library/level/${levelId}`} className="mb-7 inline-flex items-center gap-2 text-sm text-[#687b79]"><ArrowRight size={17}/>{level.name}</Link><p className="mb-2 text-xs font-bold text-[#a47a3e]">{level.name} / {category.label}</p><h1 className="mb-8 text-3xl font-black sm:text-4xl">{category.label}</h1>
    <label className="mb-6 flex max-w-xl items-center gap-3 rounded-2xl border border-[#ddd2bc] bg-white px-4 py-3"><Search size={18} className="text-[#a88b54]"/><input aria-label="البحث في كتب المجال" placeholder="ابحث بالكتاب أو المؤلف" value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-transparent text-base outline-none"/></label>
    {notice && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">{notice}</p>}
    <div className="grid gap-4 sm:grid-cols-2">{filtered.map(book => <Link key={book.id} href={`/islamic-library/book/${book.id}`} className="group flex gap-5 rounded-3xl border border-[#ded5c5] bg-white p-5 transition hover:shadow-md"><div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-l-2xl rounded-r-sm border-r-4 border-[#aa8143] bg-[#1b4849] text-[#d4b57a]"><BookOpen size={30}/></div><div className="flex min-w-0 flex-1 flex-col justify-center"><h2 className="mb-2 text-lg font-black">{book.title}</h2><p className="mb-4 text-xs text-[#7c877f]">{book.author}</p><span className="flex items-center gap-2 text-xs font-bold text-[#96703c]">{progress.completed.includes(book.id) ? <><CheckCircle2 size={17}/>أتممت دراسة الكتاب</> : <>افتح الكتاب والشرح<ChevronLeft size={17}/></>}</span></div></Link>)}</div>
    {!filtered.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">لا توجد كتب مطابقة.</p>}
  </main></div>
}
