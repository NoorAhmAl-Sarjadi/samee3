import { notFound, redirect } from 'next/navigation'
import { BookStudyView } from '@/components/library/LearningLibrary'
import { courseById } from '@/lib/islamic/curriculum'
import { SUNNI_LIBRARY_BOOKS } from '@/lib/islamic/sunniLibrary'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!courseById(id)) {
    if (SUNNI_LIBRARY_BOOKS.some((book) => book.id === id)) redirect(`/islamic-library/book/${id}/read`)
    notFound()
  }
  return <BookStudyView bookId={id} />
}
