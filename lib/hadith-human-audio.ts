export type HumanAudioTrack = {
  id: string
  title: string
  url: string
  label?: string
  sourceUrl?: string
  startSeconds?: number
  endSeconds?: number
  isIntroduction?: boolean
}

export type HumanAudioOrganization = 'sections' | 'chapters' | 'stream'

export type HumanAudioCollection = {
  kind: 'book' | 'chapter'
  organization: HumanAudioOrganization
  label: string
  sourceUrl: string
  tracks: HumanAudioTrack[]
}

/**
 * التسجيلات البشرية للأحاديث الفردية.
 * لا نضع هنا أي مقطع من كتاب كامل إلا إذا كان هناك ربط زمني موثق بالحديث نفسه.
 * حاليًا لا توجد تسجيلات فردية موثقة في المشروع، لذلك لن يظهر زر صوت بجانب الحديث.
 */
export const HUMAN_HADITH_AUDIO: Record<string, HumanAudioTrack> = {}

/**
 * تسجيلات الكتب التسعة على مستوى المصدر الصوتي نفسه.
 * هذه ليست تسجيلات مُفترضة لكل حديث؛ هي المقاطع التي ينشرها المصدر على مستوى الكتاب.
 * يتم تشغيلها من واجهة الكتاب/المصدر فقط.
 */
export const HUMAN_BOOK_AUDIO: Record<string, HumanAudioCollection> = {
  bukhari: {
    kind: 'book',
    organization: 'sections',
    label: 'صحيح البخاري — المقاطع الصوتية المنشورة',
    sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/',
    tracks: [
      { id: 'bukhari:01', title: 'المقطع ١ — الأحاديث ١–٣٠', url: 'https://server03.quran-uni.com:7049', label: 'تسجيل بشري — صحيح البخاري', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'bukhari:02', title: 'المقطع ٢ — الأحاديث ٣١–٥٨', url: 'https://server03.quran-uni.com:7054', label: 'تسجيل بشري — صحيح البخاري', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'bukhari:03', title: 'المقطع ٣ — الأحاديث ٥٩–٦٢', url: 'https://server03.quran-uni.com:7055', label: 'تسجيل بشري — صحيح البخاري', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'bukhari:04', title: 'المقطع ٤ — الأحاديث ٦٣–٩٤', url: 'https://server03.quran-uni.com:7056', label: 'تسجيل بشري — صحيح البخاري', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  muslim: {
    kind: 'book',
    organization: 'sections',
    label: 'صحيح مسلم — المقدمة والمقاطع الصوتية',
    sourceUrl: 'https://islamhouse.com/ar/audios/412882/',
    tracks: [
      { id: 'muslim:intro', title: 'المقدمة', url: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Moslem_Reading/ar_Moslem_Reading_01.mp3', label: 'تسجيل بشري — المقدمة', sourceUrl: 'https://islamhouse.com/ar/audios/412882/', isIntroduction: true },
      { id: 'muslim:01', title: 'المقطع ١ — الأحاديث ١–١٥', url: 'https://server03.quran-uni.com:7063', label: 'تسجيل بشري — صحيح مسلم', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'muslim:02', title: 'المقطع ٢ — الأحاديث ١٦–٣٤', url: 'https://server03.quran-uni.com:7064', label: 'تسجيل بشري — صحيح مسلم', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'muslim:03', title: 'المقطع ٣ — الأحاديث ٣٥–٥٥', url: 'https://server03.quran-uni.com:7065', label: 'تسجيل بشري — صحيح مسلم', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  abudawud: {
    kind: 'book',
    organization: 'sections',
    label: 'سنن أبي داود — المقاطع الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/419008/',
    tracks: [
      { id: 'abudawud:01', title: 'المقطع ١ — الأحاديث ١–٩', url: 'https://server03.quran-uni.com:7156', label: 'تسجيل بشري — سنن أبي داود', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'abudawud:02', title: 'المقطع ٢ — الأحاديث ١٠–٢٣', url: 'https://server03.quran-uni.com:7157', label: 'تسجيل بشري — سنن أبي داود', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'abudawud:03', title: 'المقطع ٣ — الأحاديث ٢٤–٤٢', url: 'https://server03.quran-uni.com:7158', label: 'تسجيل بشري — سنن أبي داود', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  nasai: {
    kind: 'book',
    organization: 'sections',
    label: 'سنن النسائي — المقاطع الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/427350/',
    tracks: [
      { id: 'nasai:01', title: 'المقطع ١ — الأحاديث ١–١٨', url: 'https://server03.quran-uni.com:7163', label: 'تسجيل بشري — سنن النسائي', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'nasai:02', title: 'المقطع ٢ — الأحاديث ١٩–٣٦', url: 'https://server03.quran-uni.com:7164', label: 'تسجيل بشري — سنن النسائي', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'nasai:03', title: 'المقطع ٣ — الأحاديث ٤٠–٥١', url: 'https://server03.quran-uni.com:7165', label: 'تسجيل بشري — سنن النسائي', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  tirmidhi: {
    kind: 'book',
    organization: 'sections',
    label: 'سنن الترمذي — المقاطع الصوتية المنشورة',
    sourceUrl: 'https://islamhouse.com/ar/audios/426239/',
    tracks: [
      { id: 'tirmidhi:01', title: 'المقطع ١ — الأحاديث ١–٣١', url: 'https://server03.quran-uni.com:7069', label: 'تسجيل بشري — سنن الترمذي', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'tirmidhi:02', title: 'المقطع ٢ — الأحاديث ٣٢–٦٣', url: 'https://server03.quran-uni.com:7070', label: 'تسجيل بشري — سنن الترمذي', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  ibnmajah: {
    kind: 'book',
    organization: 'sections',
    label: 'سنن ابن ماجه — المقدمة والمقاطع الصوتية',
    sourceUrl: 'https://islamhouse.com/ar/audios/426318/',
    tracks: [
      { id: 'ibnmajah:intro', title: 'مقدمة سنن ابن ماجه', url: 'https://d1.islamhouse.com/data/ar/ih_sounds/chain/ar_Sonan_Ibn_Majah_A_B/ar_Sonan_Ibn_Majah_A_B_01.mp3', label: 'تسجيل بشري — المقدمة', sourceUrl: 'https://islamhouse.com/ar/audios/426318/', isIntroduction: true },
      { id: 'ibnmajah:01', title: 'المقطع ١ — الأحاديث ١–١٨', url: 'https://server03.quran-uni.com:7161', label: 'تسجيل بشري — سنن ابن ماجه', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ibnmajah:02', title: 'المقطع ٢ — الأحاديث ١٩–٣٦', url: 'https://server03.quran-uni.com:7162', label: 'تسجيل بشري — سنن ابن ماجه', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  malik: {
    kind: 'book',
    organization: 'stream',
    label: 'موطأ مالك — بث صوتي للكتاب',
    sourceUrl: 'https://islamhouse.com/ar/audios/2805550/',
    tracks: [
      { id: 'malik:full', title: 'البث الصوتي للكتاب', url: 'https://server03.quran-uni.com:7160', label: 'تسجيل بشري — موطأ مالك', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  darimi: {
    kind: 'book',
    organization: 'stream',
    label: 'سنن الدارمي — بث صوتي للكتاب',
    sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/',
    tracks: [
      { id: 'darimi:full', title: 'البث الصوتي للكتاب كاملًا', url: 'https://server03.quran-uni.com:7179', label: 'تسجيل بشري — سنن الدارمي', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
  ahmed: {
    kind: 'book',
    organization: 'sections',
    label: 'مسند أحمد — المقاطع الصوتية المنشورة',
    sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/',
    tracks: [
      { id: 'ahmed:01', title: 'المقطع ١ — الأحاديث ١–٢٣', url: 'https://server03.quran-uni.com:7167', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:02', title: 'المقطع ٢ — الأحاديث ٢٤–٢٧', url: 'https://server03.quran-uni.com:7168', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:03', title: 'المقطع ٣ — الأحاديث ٢٨–٣١', url: 'https://server03.quran-uni.com:7169', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:04', title: 'المقطع ٤ — الأحاديث ٣٢–٣٥', url: 'https://server03.quran-uni.com:7170', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:05', title: 'المقطع ٥ — الأحاديث ٣٦–٣٩', url: 'https://server03.quran-uni.com:7171', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:06', title: 'المقطع ٦ — الأحاديث ٤٠–٤٣', url: 'https://server03.quran-uni.com:7172', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:07', title: 'المقطع ٧ — الأحاديث ٤٤–٤٦', url: 'https://server03.quran-uni.com:7173', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:08', title: 'المقطع ٨ — الأحاديث ٤٧–٤٩', url: 'https://server03.quran-uni.com:7174', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:09', title: 'المقطع ٩ — الأحاديث ٥٠–٥٤', url: 'https://server03.quran-uni.com:7175', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:10', title: 'المقطع ١٠ — الأحاديث ٥٥–٦٠', url: 'https://server03.quran-uni.com:7176', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:11', title: 'المقطع ١١ — الأحاديث ٦١–٦٦', url: 'https://server03.quran-uni.com:7177', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
      { id: 'ahmed:12', title: 'المقطع ١٢ — الأحاديث ٦٧–٧٣', url: 'https://server03.quran-uni.com:7178', label: 'تسجيل بشري — مسند أحمد', sourceUrl: 'https://quran-uni.com/quran-radio-on-platforms/' },
    ],
  },
}

/**
 * لا توجد خرائط موثقة حاليًا لتسجيلات على مستوى أبواب API بعينها.
 * لذلك لا يظهر زر صوت بجانب أي باب إلا بعد إضافة رابط يطابق الباب فعلًا.
 */
export const HUMAN_CHAPTER_AUDIO: Record<string, HumanAudioCollection> = {}

export function getHumanHadithAudio(
  bookId: string,
  hadithId: number | string,
): HumanAudioTrack | null {
  if (!bookId || hadithId === undefined || hadithId === null) return null
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

  const exact = HUMAN_CHAPTER_AUDIO[`${bookId}:chapter:${chapterId}`]
  if (exact) return exact

  const normalizedName = String(chapterName || '').trim().toLowerCase()
  if (!normalizedName) return null

  return HUMAN_CHAPTER_AUDIO[`${bookId}:name:${normalizedName}`] || null
}