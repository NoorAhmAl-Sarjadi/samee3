import { notFound } from 'next/navigation'
import ManagedCategoryView from '@/components/library/ManagedCategoryView'
import { isLevelId } from '@/lib/islamic/curriculum'
import { SUNNI_LIBRARY_CATEGORIES } from '@/lib/islamic/sunniLibrary'
export default async function Page({ params }: { params: Promise<{ level: string; category: string }> }) {
  const { level, category } = await params
  if (!isLevelId(level) || !SUNNI_LIBRARY_CATEGORIES.some(item => item.id === category)) notFound()
  return <ManagedCategoryView levelId={level} categoryId={category}/>
}
