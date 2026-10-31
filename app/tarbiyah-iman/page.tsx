import type { Metadata } from 'next'
import TarbiyahImanLessons from '@/components/TarbiyahImanLessons'

export const metadata: Metadata = {
  title: 'التربية الإيمانية للأبناء',
  description:
    'دروس التربية الإيمانية للأبناء بالفيديو، مع المادة العلمية المساندة، والتنقل بين الدروس حسب ترتيب قائمة التشغيل.',
}

export default function Page() {
  return <TarbiyahImanLessons />
}