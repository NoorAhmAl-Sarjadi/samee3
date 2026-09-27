export type HumanHadithAudio = {
  url: string
  label?: string
  startSeconds?: number
  endSeconds?: number
  sourceUrl?: string
}

export type HumanAudioTrack = HumanHadithAudio & {
  id: string
  title: string
}

export type HumanAudioCollection = {
  kind: 'book' | 'chapter'
  label: string
  sourceUrl?: string
  tracks: HumanAudioTrack[]
}

function numberedTracks(options: {
  baseUrl: string
  count: number
  start?: number
  digits?: number
  titlePrefix: string
  sourceUrl: string
  idPrefix: string
}): HumanAudioTrack[] {
  const start = options.start ?? 1
  const digits = options.digits ?? 2

  return Array.from({ length: options.count }, (_, index) => {
    const number = start + index
    const padded = String(number).padStart(digits, '0')

    return {
      id: `${options.idPrefix}:${number}`,
      title: `${options.titlePrefix} ${number}`,
      url: `${options.baseUrl}${padded}.mp3`,
      label: 'تسجيل بشري مجاني من المصدر',
      sourceUrl: options.sourceUrl,
    }
  })
}

/**
 * تسجيلات بشرية مرتبطة مباشرة بحديث محدد.
 * هذه القائمة لا تستخدم إلا عندما يكون لدينا ربط زمني موثق بين الحديث والمقطع.
 */
export const HUMAN_HADITH_AUDIO: Record<string, HumanHadithAudio> = {
  'bukhari:1': {
    url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
    startSeconds: 15,
    endSeconds: 125,
    label: 'تسجيل بشري - صحيح البخاري - حديث ١',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
  },
  'bukhari:2': {
    url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
    startSeconds: 126,
    endSeconds: 198,
    label: 'تسجيل بشري - صحيح البخاري - حديث ٢',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
  },
}

/**
 * قراءات على مستوى الكتاب/المادة الصوتية.
 * نستخدمها عندما يكون المصدر منشورًا كقائمة ملفات تغطي الكتاب، لا كملفات منفصلة لكل حديث.
 * الروابط هنا تشير إلى الملفات الأصلية للمصدر ولا يتم استضافتها داخل الموقع.
 */
export const HUMAN_BOOK_AUDIO: Record<string, HumanAudioCollection> = {
  muslim: {
    kind: 'book',
    label: 'قراءة صوتية لصحيح مسلم',
    sourceUrl: 'https://islamhouse.com/ar/audios/412882/',
    tracks: numberedTracks({
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Moslem_Reading/ar_Moslem_Reading_',
      count: 55,
      digits: 2,
      titlePrefix: 'ملف صحيح مسلم',
      sourceUrl: 'https://islamhouse.com/ar/audios/412882/',
      idPrefix: 'muslim',
    }),
  },
  tirmidhi: {
    kind: 'book',
    label: 'قراءة صوتية لسنن الترمذي',
    sourceUrl: 'https://islamhouse.com/ar/audios/426239/',
    tracks: numberedTracks({
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Sonan_Termethe_A_B/ar_Sonan_Termethe_A_B_',
      count: 63,
      digits: 2,
      titlePrefix: 'ملف سنن الترمذي',
      sourceUrl: 'https://islamhouse.com/ar/audios/426239/',
      idPrefix: 'tirmidhi',
    }),
  },
  nasai: {
    kind: 'book',
    label: 'قراءة صوتية لسنن النسائي',
    sourceUrl: 'https://islamhouse.com/ar/audios/427350/',
    tracks: numberedTracks({
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Sonan_Nasa2ee_A_B/ar_Sonan_Nasa2ee_A_B_',
      count: 50,
      digits: 2,
      titlePrefix: 'ملف سنن النسائي',
      sourceUrl: 'https://islamhouse.com/ar/audios/427350/',
      idPrefix: 'nasai',
    }),
  },
  riyad_assalihin: {
    kind: 'book',
    label: 'قراءة صوتية لرياض الصالحين',
    sourceUrl: 'https://islamhouse.com/ar/audios/206354/',
    tracks: numberedTracks({
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Riad_Assal7een_Reeding/ar_Riad_Assal7een_Reeding_',
      count: 108,
      start: 0,
      digits: 3,
      titlePrefix: 'ملف رياض الصالحين',
      sourceUrl: 'https://islamhouse.com/ar/audios/206354/',
      idPrefix: 'riyad_assalihin',
    }),
  },
}

/**
 * ربط على مستوى الباب.
 * أضف هنا فقط الملفات التي تعرف أن محتواها يطابق الباب تحديدًا.
 * المفتاح المفضل: `${bookId}:chapter:${chapterId}`.
 */
export const HUMAN_CHAPTER_AUDIO: Record<string, HumanAudioCollection> = {}

export function getHumanHadithAudio(
  bookId: string,
  hadithId: number | string,
): HumanHadithAudio | null {
  if (!bookId || !hadithId) return null
  return HUMAN_HADITH_AUDIO[`${bookId}:${hadithId}`] || null
}

export function getHumanBookAudio(bookId: string): HumanAudioCollection | null {
  if (!bookId) return null
  return HUMAN_BOOK_AUDIO[bookId] || null
}

export function getHumanChapterAudio(
  bookId: string,
  chapterId: number | string,
  chapterName?: string,
): HumanAudioCollection | null {
  if (!bookId || chapterId === undefined || chapterId === null) return null

  const byId = HUMAN_CHAPTER_AUDIO[`${bookId}:chapter:${chapterId}`]
  if (byId) return byId

  const normalizedName = String(chapterName || '').trim().toLowerCase()
  if (!normalizedName) return null

  return HUMAN_CHAPTER_AUDIO[`${bookId}:name:${normalizedName}`] || null
}
