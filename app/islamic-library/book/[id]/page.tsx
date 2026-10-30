import { notFound } from 'next/navigation'
import ManagedBookStudyView from '@/components/library/ManagedBookStudyView'
import { validBookId } from '@/lib/islamic/managed-library'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!validBookId(id)) notFound()
  return <ManagedBookStudyView bookId={id} />
}
