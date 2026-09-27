export type HumanHadithAudio = {
  url: string
  label?: string
  startSeconds?: number
  endSeconds?: number
  sourceUrl?: string
}

// جدول الربط الخاص بالأحاديث والتسجيلات البشرية
export const HUMAN_HADITH_AUDIO: Record<string, HumanHadithAudio> = {
  'bukhari:1': {
    url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
    startSeconds: 15,
    endSeconds: 125,
    label: 'تسجيل بشري - صحيح البخاري',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
  },
  'bukhari:2': {
    url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
    startSeconds: 126,
    endSeconds: 198,
    label: 'تسجيل بشري - صحيح البخاري',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
  },
}

/**
 * دالة جلب بيانات الصوت البشري للحديث المحدد
 */
export function getHumanHadithAudio(
  bookId: string,
  hadithId: number | string,
): HumanHadithAudio | null {
  if (!bookId || !hadithId) return null

  const key = `${bookId}:${hadithId}`
  return HUMAN_HADITH_AUDIO[key] || null
}
