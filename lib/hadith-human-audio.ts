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

export type HumanAudioOrganization = 'attachments' | 'books' | 'stream'

export type HumanAudioCollection = {
  kind: 'book' | 'chapter'
  organization: HumanAudioOrganization
  label: string
  sourceUrl: string
  tracks: HumanAudioTrack[]
}

function numberedTracks(options: {
  idPrefix: string
  titlePrefix: string
  baseUrl: string
  count: number
  digits?: number
  sourceUrl: string
  titleOverrides?: Record<number, string>
}): HumanAudioTrack[] {
  const digits = options.digits ?? 2

  return Array.from({ length: options.count }, (_, index) => {
    const number = index + 1
    const padded = String(number).padStart(digits, '0')
    const title = options.titleOverrides?.[number] || `${options.titlePrefix} ${number}`

    return {
      id: `${options.idPrefix}:${number}`,
      title,
      url: `${options.baseUrl}${padded}.mp3`,
      label: 'تسجيل بشري من المصدر',
      sourceUrl: options.sourceUrl,
      isIntroduction: /مقدم/.test(title),
    }
  })
}

// ربط دقيق فقط عندما تكون هناك بداية ونهاية موثقتان داخل ملف صوتي معروف.
export const HUMAN_HADITH_AUDIO: Record<string, HumanHadithAudio> = {
  'bukhari:1': {
    url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
    startSeconds: 15,
    endSeconds: 125,
    label: 'تسجيل بشري — صحيح البخاري — حديث ١',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
  },
  'bukhari:2': {
    url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
    startSeconds: 126,
    endSeconds: 198,
    label: 'تسجيل بشري — صحيح البخاري — حديث ٢',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
  },
}

// تسجيلات المصدر على مستوى الكتاب/المرفقات. لا تُنسب تلقائيًا لكل حديث.
export const HUMAN_BOOK_AUDIO: Record<string, HumanAudioCollection> = {
  bukhari: {
    kind: 'book',
    organization: 'attachments',
    label: 'صحيح البخاري — التسجيل الصوتي المتاح',
    sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
    tracks: [
      {
        id: 'bukhari:01',
        title: 'المقطع الصوتي المتاح',
        url: 'https://ia801308.us.archive.org/3/items/Sahih-Al-Bukhari-Audio/01.mp3',
        label: 'تسجيل بشري — صحيح البخاري',
        sourceUrl: 'https://archive.org/details/Sahih-Al-Bukhari-Audio',
      },
    ],
  },

  muslim: {
    kind: 'book',
    organization: 'books',
    label: 'صحيح مسلم — المقدمة والكتب الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/412882/',
    tracks: numberedTracks({
      idPrefix: 'muslim',
      titlePrefix: 'المرفق',
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Moslem_Reading/ar_Moslem_Reading_',
      count: 55,
      sourceUrl: 'https://islamhouse.com/ar/audios/412882/',
      titleOverrides: {
        1: 'المقدمة',
        2: 'كتاب الإيمان',
        3: 'كتاب الطهارة',
        4: 'كتاب الحيض',
        5: 'كتاب الصلاة',
        6: 'كتاب المساجد ومواضع الصلاة',
        7: 'كتاب صلاة المسافرين وقصرها',
        8: 'كتاب الجمعة',
        9: 'كتاب صلاة العيدين',
        10: 'كتاب صلاة الاستسقاء',
      },
    }),
  },

  abudawud: {
    kind: 'book',
    organization: 'books',
    label: 'سنن أبي داود — الكتب الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/419008/',
    tracks: numberedTracks({
      idPrefix: 'abudawud',
      titlePrefix: 'المرفق',
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Abo_Dawood_audiobook/ar_Abo_Dawood_audiobook_',
      count: 42,
      sourceUrl: 'https://islamhouse.com/ar/audios/419008/',
    }),
  },

  nasai: {
    kind: 'book',
    organization: 'books',
    label: 'سنن النسائي — الكتب الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/427350/',
    tracks: numberedTracks({
      idPrefix: 'nasai',
      titlePrefix: 'المرفق',
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Sonan_Nasa2ee_A_B/ar_Sonan_Nasa2ee_A_B_',
      count: 50,
      sourceUrl: 'https://islamhouse.com/ar/audios/427350/',
    }),
  },

  tirmidhi: {
    kind: 'book',
    organization: 'books',
    label: 'سنن الترمذي — الكتب والأبواب الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/426239/',
    tracks: numberedTracks({
      idPrefix: 'tirmidhi',
      titlePrefix: 'المرفق',
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Sonan_Termethe_A_B/ar_Sonan_Termethe_A_B_',
      count: 63,
      sourceUrl: 'https://islamhouse.com/ar/audios/426239/',
      titleOverrides: {
        1: 'كتاب الطهارة',
        2: 'كتاب الصلاة',
        3: 'كتاب الوتر',
        4: 'كتاب الجمعة',
        5: 'أبواب العيدين',
        6: 'أبواب السفر',
        7: 'كتاب الزكاة',
        8: 'كتاب الصوم',
        9: 'كتاب الحج',
        10: 'كتاب الجنائز',
      },
    }),
  },

  ibnmajah: {
    kind: 'book',
    organization: 'books',
    label: 'سنن ابن ماجه — المقدمة والكتب الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/426318/',
    tracks: numberedTracks({
      idPrefix: 'ibnmajah',
      titlePrefix: 'المرفق',
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Sonan_Ibn_Majah_A_B/ar_Sonan_Ibn_Majah_A_B_',
      count: 36,
      sourceUrl: 'https://islamhouse.com/ar/audios/426318/',
      titleOverrides: {
        1: 'مقدمة سنن ابن ماجه',
        2: 'كتاب الطهارة وسننها',
        3: 'كتاب الصلاة',
        4: 'كتاب الأذان والسنة فيه',
      },
    }),
  },

  // هذا المصدر يعلن عن تقسيم الكتاب إلى 61 مرفقًا، لكن رابط MP3 المباشر الثابت لم يُتحقق منه هنا؛ لذلك لا نضع زر تشغيل مع رابط مفترض.

  riyad_assalihin: {
    kind: 'book',
    organization: 'books',
    label: 'رياض الصالحين — تسجيلات صوتية',
    sourceUrl: 'https://islamhouse.com/ar/audios/206354/',
    tracks: numberedTracks({
      idPrefix: 'riyad_assalihin',
      titlePrefix: 'المرفق',
      baseUrl: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Riad_Assal7een_Reeding/ar_Riad_Assal7een_Reeding_',
      count: 108,
      digits: 3,
      sourceUrl: 'https://islamhouse.com/ar/audios/206354/',
    }),
  },
}

// لا يوجد ربط ثابت إضافي على مستوى الأبواب إلا عند التأكد من التطابق.
export const HUMAN_CHAPTER_AUDIO: Record<string, HumanAudioCollection> = {}

function normalizeForAudioMatch(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function getHumanHadithAudio(bookId: string, hadithId: number | string): HumanHadithAudio | null {
  if (!bookId || hadithId === undefined || hadithId === null) return null
  return HUMAN_HADITH_AUDIO[`${bookId}:${hadithId}`] || null
}

export function getHumanBookAudio(bookId: string): HumanAudioCollection | null {
  if (!bookId) return null
  return HUMAN_BOOK_AUDIO[bookId] || null
}

export function getHumanChapterAudio(bookId: string, chapterId: number | string, chapterName?: string): HumanAudioCollection | null {
  if (!bookId || chapterId === undefined || chapterId === null) return null

  const exact = HUMAN_CHAPTER_AUDIO[`${bookId}:chapter:${chapterId}`]
  if (exact) return exact

  const chapterKey = normalizeForAudioMatch(chapterName || '')
  if (!chapterKey) return null

  const bookCollection = HUMAN_BOOK_AUDIO[bookId]
  if (!bookCollection?.tracks.length) return null

  const matched = bookCollection.tracks.find((track) => {
    const titleKey = normalizeForAudioMatch(track.title)
    return titleKey === chapterKey || titleKey.includes(chapterKey) || chapterKey.includes(titleKey)
  })

  if (!matched) return null

  return {
    kind: 'chapter',
    organization: bookCollection.organization,
    label: matched.title,
    sourceUrl: matched.sourceUrl || bookCollection.sourceUrl,
    tracks: [matched],
  }
}