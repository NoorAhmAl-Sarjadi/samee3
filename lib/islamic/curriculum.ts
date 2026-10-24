import { SUNNI_LIBRARY_BOOKS, type SunniLibraryBook, type SunniLibraryCategoryId } from './sunniLibrary'

export type LevelId = 'beginner' | 'intermediate' | 'advanced'
export type LearningCourse = SunniLibraryBook & {
  levelId: LevelId; videoUrl?: string; audioSourceUrl?: string; audioUrl?: string
  videoDownloadUrl?: string; resourceNote?: string
}
export const CURRICULUM_VERSION = 1
export const LEARNING_LEVELS = [
  { id: 'beginner' as const, name: 'المستوى المبتدئ', label: 'مبتدئ', number: '01', description: 'بداية واضحة لبناء أصول العلم، كتابًا بعد كتاب.' },
  { id: 'intermediate' as const, name: 'المستوى المتوسط', label: 'متوسط', number: '02', description: 'توسّع في الفهم واربط الأصول بالتطبيق والدراسة.' },
  { id: 'advanced' as const, name: 'المستوى المتقدم', label: 'متقدم', number: '03', description: 'قراءة أعمق في المطوّلات وأمهات كتب العلوم الشرعية.' },
]
export function isLevelId(value: string): value is LevelId { return LEARNING_LEVELS.some((level) => level.id === value) }
const extra = (id: string, title: string, author: string, category: SunniLibraryCategoryId, readingUrl: string): SunniLibraryBook => ({ id, title, author, category, readingUrl, level: 'متقدم', description: `دراسة كتاب ${title} في ${category === 'seerah' ? 'السيرة النبوية' : 'العلوم الشرعية'}، مع الرجوع إلى شروحه ومصادره.` })
const extras: SunniLibraryBook[] = [
  extra('usul-tafsir-hisan', 'القواعد الحسان المتعلقة بتفسير القرآن', 'عبد الرحمن بن ناصر السعدي', 'usul-tafsir', 'https://islamhouse.com/ar/books/205542/'),
  extra('seerah-ibn-hisham', 'السيرة النبوية لابن هشام', 'عبد الملك بن هشام', 'seerah', 'https://www.islamweb.org/ar/library/index.php?page=bookcontents&bk_no=58'),
  extra('seerah-zad-maad', 'زاد المعاد في هدي خير العباد', 'ابن قيم الجوزية', 'seerah', 'https://www.islamweb.org/ar/library/index.php?page=bookcontents&bk_no=127'),
  extra('usul-tafsir-itqan', 'الإتقان في علوم القرآن', 'جلال الدين السيوطي', 'usul-tafsir', 'https://www.islamweb.org/ar/library/index.php?page=bookcontents&bk_no=68'),
  extra('usul-fiqh-rawdah', 'شرح مختصر الروضة', 'نجم الدين الطوفي', 'usul-fiqh', 'https://www.islamweb.org/ar/library/index.php?page=bookcontents&bk_no=98'),
  extra('usul-hadith-tadrib', 'تدريب الراوي في شرح تقريب النواوي', 'جلال الدين السيوطي', 'usul-hadith', 'https://www.islamweb.org/ar/library/index.php?page=bookcontents&bk_no=88'),
]
const YT = (id: string) => `https://www.youtube.com/playlist?list=${id}`
// These are real source pages/playlists, never generated search links.
const resources: Record<string, Partial<LearningCourse>> = {
  'aq-lumat': { downloadUrl: 'https://d1.islamhouse.com/data/ar/ih_books/single/ar_Lomat_AlAatakad_AlHady_Ela_Sabeel_AlRashad.pdf', videoUrl: 'https://www.youtube.com/watch?v=-ozrtWggiJ4', resourceNote: 'الفيديو: الدرس الأول من شرح صالح آل الشيخ. التسجيلات الصوتية الكاملة في المصدر.', audioSourceUrl: 'https://islamhouse.com/ar/audios/312573/' },
  'fiqh-mulakhkhas': { downloadUrl: 'https://d1.islamhouse.com/data/ar/ih_books/single_01/ar_Fiqh_Summary.pdf', videoUrl: YT('PL3523jgHxjkY2hy-9-YqgbS3yzGhQkmuq') },
  'seerah-raheeq': { videoUrl: 'https://www.youtube.com/watch?v=Fsi4KiUnHzw', resourceNote: 'درس من شرح الرحيق المختوم للشيخ عبد الرحمن العجلان.' },
  'usul-tafsir-hisan': { videoUrl: YT('PLpl0y8qVS70S5DK8ag-dEZqjskIITryOG'), audioSourceUrl: 'https://www.al-badr.net/sub/101' },
  'usul-fiqh-waraqat': { downloadUrl: 'https://d1.islamhouse.com/data/ar/ih_books/single_02/ar_alwarakat_fe_osol_elfiqh.pdf', videoUrl: 'https://www.youtube.com/watch?v=-jQKkpAgYLM', resourceNote: 'الدرس الأول من شرح نظم الورقات لابن عثيمين.' },
  'usul-hadith-bayquniyyah': { videoUrl: YT('PLWzzF688g_ng8Wmo421MPpDWrZT-fu1as'), audioSourceUrl: 'https://audio.islamweb.net/AUDIO/index.php?page=lecview&sid=162&lg=714' },
  'hadith-shamail': { downloadUrl: 'https://d1.islamhouse.com/data/ar/ih_books/single8/ar_shmeel_mohamadia.pdf', videoUrl: YT('PLL77AuOlMm6TMefGbtKOd-g7EtIUDkyky'), resourceNote: 'الشرح المرئي لمختصر الشمائل المحمدية للشيخ عبد الرزاق البدر.' },
  'fiqh-bulugh': { videoUrl: YT('PL3523jgHxjkaxWI32jnj8Gx3dGvkSrmli') },
  'aq-tahawiyyah': { videoUrl: YT('PLtmYkyY8ieMYuZJz3ROOYGz2DTR65xuQf') },
  'usul-tafsir-muqaddimah': { videoUrl: YT('PLYLDRp4-7YC3ocT1mE9ctmHZM-LwSJjUT') },
  'usul-fiqh-usul': { videoUrl: YT('PLfwfvsTkskdZesaN6p-0q0_PH3xxz6_D4') },
  'usul-hadith-nukhbah': { videoUrl: YT('PLx3Fh1kiMbregHrlhNLi_7mDFdUW6tSA0') },
  'seerah-zad-maad': { videoUrl: YT('PLgaTRTylCbZDo3NyLb7i_NYIyhIKp-Kcq') },
  'usul-tafsir-itqan': { videoUrl: YT('PLVyeHTRwwhc67n9H4M4y1ZblA28HkGj8B') },
  'usul-hadith-tadrib': { videoUrl: YT('PLqHNppJ4B0Z0G0zfuFQKnnhiPKjn9I7XS') },
  'tafsir-tabari': { videoUrl: YT('PLrbxbilHNR6pSmG4zEYU7MNCcJWUx20XA'), resourceNote: 'قراءة مسموعة لتفسير الطبري في قائمة مرئية؛ راجع قائمة الناشر للأجزاء المتاحة.' },
  'hadith-sahih-bukhari': { videoUrl: YT('PLXS0usquloW8vk6FwSeWfR9ES9pcZ_BNI') },
  'aq-wasitiyyah': { videoUrl: YT('PLXS0usquloW-IXuZTBpY8si9ZLeV7i3AV') },
  'fiqh-zad': { videoUrl: YT('PLXS0usquloW_eC9EGBL66I1Fss3Oravm1') },
  'seerah-ibn-hisham': { videoUrl: YT('PLvgpUtaV9tDubz7_d4tfEOfM9bTjjJbUx') },
  'usul-fiqh-rawdah': { videoUrl: YT('PLZQ52aPDC9GDknYN6iDKrTkXQBGKP-Ou0') },
  'tafsir-ibnkathir-mukhtasar': { videoUrl: YT('PLgaTRTylCbZAaRhXYobg2mVSWhDTLzAOp') },
  'hadith-riyad': { videoUrl: YT('PLXS0usquloW9kO9XISmGQbdKHoap4EQPX'), audioSourceUrl: 'https://audio.islamweb.net/AUDIO/index.php?page=lecview&sid=162&lg=118' },
}
const selections: Record<LevelId, string[]> = {
  beginner: ['aq-lumat', 'fiqh-mulakhkhas', 'seerah-raheeq', 'usul-tafsir-hisan', 'usul-fiqh-waraqat', 'usul-hadith-bayquniyyah', 'tafsir-taysir-qattan', 'hadith-shamail'],
  intermediate: ['aq-wasitiyyah', 'fiqh-bulugh', 'seerah-ibn-hisham', 'usul-tafsir-muqaddimah', 'usul-fiqh-usul', 'usul-hadith-nukhbah', 'tafsir-ibnkathir-mukhtasar', 'hadith-riyad'],
  advanced: ['aq-tahawiyyah', 'fiqh-zad', 'seerah-zad-maad', 'usul-tafsir-itqan', 'usul-fiqh-rawdah', 'usul-hadith-tadrib', 'tafsir-tabari', 'hadith-sahih-bukhari'],
}
export const LEARNING_COURSES: LearningCourse[] = LEARNING_LEVELS.flatMap((level) => selections[level.id].map((id) => {
  const source = [...SUNNI_LIBRARY_BOOKS, ...extras].find((book) => book.id === id)
  if (!source) throw new Error(`Missing curriculum book: ${id}`)
  return { ...source, ...resources[id], level: level.label as SunniLibraryBook['level'], levelId: level.id }
}))
export function courseById(id: string) { return LEARNING_COURSES.find((book) => book.id === id) }
export function coursesInLevel(level: LevelId) { return LEARNING_COURSES.filter((book) => book.levelId === level) }
export function completedInLevel(level: LevelId, completed: string[]) { return coursesInLevel(level).filter((book) => completed.includes(book.id)).length }
export function normalizeLearningName(value: string) { return value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) }
export function youtubeEmbed(value?: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value), host = url.hostname.replace(/^www\./, '')
    if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null
    const list = url.searchParams.get('list')
    if (list && /^[A-Za-z0-9_-]{10,80}$/.test(list)) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&rel=0`
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v')
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null
  } catch { return null }
}
