export type HumanHadithAudio = {
  url: string
  label?: string
  sourceUrl?: string
  startSeconds?: number
  endSeconds?: number
}

export type HumanAudioTrack = HumanHadithAudio & {
  id: string
  title: string
  isIntroduction?: boolean
}

export type HumanAudioOrganization = 'attachments' | 'books' | 'chapters' | 'stream'

export type HumanAudioCollection = {
  kind: 'book' | 'chapter'
  organization: HumanAudioOrganization
  label: string
  sourceUrl: string
  tracks: HumanAudioTrack[]
}

export type HumanAudioSource = {
  label: string
  sourceUrl: string
}

/**
 * لا يظهر زر صوت إلا للكتب التي لها صفحة صوتية فعلية موثقة.
 * ملفات المصدر تُكتشف من صفحة المصدر نفسها حتى يظل ترتيبها وعناوينها مطابقين للمصدر.
 * لا نعتبر ملف الكتاب كله صوتًا لكل حديث منفرد.
 */
export const HUMAN_AUDIO_SOURCES: Record<string, HumanAudioSource> = {
  bukhari: {
    label: 'قراءة كتاب صحيح البخاري',
    sourceUrl: 'https://islamhouse.com/ar/audios/401375/',
  },
  muslim: {
    label: 'قراءة كتاب صحيح مسلم',
    sourceUrl: 'https://islamhouse.com/ar/audios/412882/',
  },
  abudawud: {
    label: 'قراءة كتاب سنن أبي داود',
    sourceUrl: 'https://islamhouse.com/ar/audios/419008/',
  },
  nasai: {
    label: 'سنن النسائي [ كتاب صوتي ]',
    sourceUrl: 'https://islamhouse.com/ar/audios/427350/',
  },
  tirmidhi: {
    label: 'سنن الترمذي [ كتاب صوتي ]',
    sourceUrl: 'https://islamhouse.com/ar/audios/426239/',
  },
  ibnmajah: {
    label: 'سنن ابن ماجه [ كتاب صوتي ]',
    sourceUrl: 'https://islamhouse.com/ar/audios/426318/',
  },
  malik: {
    label: 'موطأ مالك [ كتاب صوتي ]',
    sourceUrl: 'https://islamhouse.com/ar/audios/2805550/',
  },
  riyad_assalihin: {
    label: 'قراءة كتاب رياض الصالحين',
    sourceUrl: 'https://islamhouse.com/ar/audios/206354/',
  },
}

/**
 * لا نضع أي صوت هنا إلا عند وجود ربط دقيق وحديث بعينه.
 * صوت الكتاب أو الباب لا يتحول تلقائيًا إلى صوت حديث.
 */
export const HUMAN_HADITH_AUDIO: Record<string, HumanHadithAudio> = {}

/** ربط ثابت اختياري للأبواب، ويُستخدم فقط عند معرفة التطابق بدقة. */
export const HUMAN_CHAPTER_AUDIO: Record<string, HumanAudioCollection> = {}

export function getHumanHadithAudio(
  bookId: string,
  hadithId: number | string,
): HumanHadithAudio | null {
  if (!bookId || hadithId === undefined || hadithId === null) return null
  return HUMAN_HADITH_AUDIO[`${bookId}:${hadithId}`] || null
}

export function getHumanBookAudio(_bookId: string): HumanAudioCollection | null {
  return null
}

export function getHumanAudioSource(bookId: string): HumanAudioSource | null {
  if (!bookId) return null
  return HUMAN_AUDIO_SOURCES[bookId] || null
}

export function getHumanChapterAudio(
  bookId: string,
  chapterId: number | string,
  _chapterName?: string,
): HumanAudioCollection | null {
  if (!bookId || chapterId === undefined || chapterId === null) return null
  return HUMAN_CHAPTER_AUDIO[`${bookId}:chapter:${chapterId}`] || null
}

export const getHumanBookAudioSource = getHumanAudioSource