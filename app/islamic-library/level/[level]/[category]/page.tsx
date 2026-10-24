import { notFound } from 'next/navigation'
import { CategoryView } from '@/components/library/LearningLibrary'
import { isLevelId } from '@/lib/islamic/curriculum'
import { SUNNI_LIBRARY_CATEGORIES } from '@/lib/islamic/sunniLibrary'
export default async function Page({ params }: { params: Promise<{ level: string; category: string }> }) {
  const { level, category } = await params
  if (!isLevelId(level) || !SUNNI_LIBRARY_CATEGORIES.some((item) => item.id === category)) notFound()
  return <CategoryView levelId={level} categoryId={category} />
}
