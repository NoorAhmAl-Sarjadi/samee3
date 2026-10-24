import { notFound } from 'next/navigation'
import { LevelView } from '@/components/library/LearningLibrary'
import { isLevelId } from '@/lib/islamic/curriculum'
export default async function Page({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  if (!isLevelId(level)) notFound()
  return <LevelView levelId={level} />
}
