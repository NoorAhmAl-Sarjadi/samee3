export type SunniLibraryLevelId =
  | 'beginner'
  | 'intermediate'
  | 'advanced'

export type SunniLibraryCategoryId =
  | 'quran'
  | 'tafsir'
  | 'aqidah'
  | 'fiqh'
  | 'hadith'
  | 'usul-fiqh'
  | 'mustalah-hadith'
  | 'seerah'
  | 'language'

export type SunniLibraryLevelLabel =
  | 'مبتدئ'
  | 'متوسط'
  | 'متقدم'

export type SunniLibraryContentType =
  | 'book'
  | 'volume'
  | 'lesson'
  | 'quran-program'

export type SunniLibrarySourceKind =
  | 'text'
  | 'pdf'
  | 'video'
  | 'external'

export type SunniLibraryRightsStatus =
  | 'public-domain'
  | 'open-license'
  | 'source-permission-required'
  | 'verify-before-local-copy'

export interface SunniLibrarySource {
  id: string
  kind: SunniLibrarySourceKind
  title: string
  url: string
  label: string
  provider?: string
  rightsStatus?: SunniLibraryRightsStatus
  notes?: string
}

export interface SunniLibraryVideoConfig {
  youtube_playlist_id?: string | null
  youtube_channel_url?: string | null
  allowed_scholars?: string[]
  sequential?: boolean
  playback_rate_locked?: boolean
  prevent_forward_seek?: boolean
  rewind_allowed?: boolean
}

export interface SunniLibraryVolume {
  id: string
  bookId: string
  volumeNumber: number
  title?: string
  pdfUrl?: string | null
  readingUrl?: string | null
  pageCount?: number | null
  sourceLabel?: string | null
  sourceProvider?: string | null
  rightsStatus?: SunniLibraryRightsStatus
}

export interface SunniLibraryLesson {
  id: string
  bookId: string
  orderIndex: number
  title: string
  description?: string
  durationMinutes?: number | null
  youtubeVideoId?: string | null
  completed?: boolean
}

export interface SunniLibraryBook {
  id: string
  category: SunniLibraryCategoryId
  title: string
  author: string
  level: SunniLibraryLevelLabel
  levelId: SunniLibraryLevelId
  description: string

  /**
   * مصادر القراءة العامة/الخارجية.
   * لا نفترض الترخيص المحلي إلا بعد التحقق منه.
   */
  readingUrl?: string | null
  readingLabel?: string | null

  /**
   * مصدر نص الكتاب أو صفحة القراءة الرقمية.
   */
  textSource?: SunniLibrarySource | null

  /**
   * PDF واحد أو عدة مجلدات.
   */
  pdfSources?: SunniLibrarySource[]

  /**
   * روابط الشروح التاريخية/المباشرة إن وجدت.
   */
  sharhTitle?: string | null
  sharhAuthor?: string | null
  sharhUrl?: string | null
  sharhLabel?: string | null

  /**
   * إعدادات شرح YouTube.
   * يتم تعبئة playlist ID من لوحة الإدارة أو Supabase.
   */
  videoConfig?: SunniLibraryVideoConfig

  /**
   * بيانات المجلدات والدروس المرتبطة بالكتاب.
   * يمكن استبدالها مستقبلًا بقراءة من Supabase.
   */
  volumes?: SunniLibraryVolume[]
  lessons?: SunniLibraryLesson[]

  /**
   * تكاملات اختيارية مع مصادر القرآن.
   */
  quranpediaBookId?: number | null

  /**
   * مصدر/ترخيص المحتوى.
   */
  rightsStatus?: SunniLibraryRightsStatus
  sourceNote?: string
}

/* -------------------------------------------------------------------------- */
/* التصنيفات                                                                   */
/* -------------------------------------------------------------------------- */

export const SUNNI_LIBRARY_CATEGORIES: Array<{
  id: SunniLibraryCategoryId
  label: string
  short: string
  description: string
}> = [
  {
    id: 'quran',
    label: 'القرآن الكريم',
    short: 'الحفظ والمراجعة',
    description: 'ورد الحفظ والمراجعة اليومية مع متابعة التقدم والختمة.',
  },
  {
    id: 'tafsir',
    label: 'التفسير',
    short: 'فهم كتاب الله',
    description: 'كتب التفسير وشرح معاني الآيات وقواعد الفهم والتدبر.',
  },
  {
    id: 'aqidah',
    label: 'العقيدة',
    short: 'أصول الاعتقاد',
    description: 'متون العقيدة والتوحيد وشروحها ضمن مسار تدريجي.',
  },
  {
    id: 'fiqh',
    label: 'الفقه',
    short: 'العبادات والمعاملات',
    description: 'التفقه في العبادات والأحكام العملية وفق مسار متدرج.',
  },
  {
    id: 'hadith',
    label: 'الحديث',
    short: 'السنة النبوية',
    description: 'متون الحديث وأحاديث الأحكام وشروحها.',
  },
  {
    id: 'usul-fiqh',
    label: 'أصول الفقه',
    short: 'أصول الاستنباط',
    description: 'المبادئ والقواعد التي تضبط فهم الأدلة والاستنباط.',
  },
  {
    id: 'mustalah-hadith',
    label: 'مصطلح الحديث',
    short: 'علوم الحديث',
    description: 'مصطلحات الحديث وقواعد التصنيف والرواية والدراية.',
  },
  {
    id: 'seerah',
    label: 'السيرة',
    short: 'سيرة النبي ﷺ',
    description: 'دراسة السيرة النبوية بصورة مرتبة ومتدرجة.',
  },
  {
    id: 'language',
    label: 'اللغة العربية',
    short: 'فهم اللسان العربي',
    description: 'أساسيات العربية والإعراب التي تعين الطالب على الفهم.',
  },
]

/* -------------------------------------------------------------------------- */
/* مستويات المسار                                                              */
/* -------------------------------------------------------------------------- */

export interface SunniLibraryQuranPlan {
  target: string
  memorizationDailyPages: number
  reviewDailyPages: number
  warning: string
}

export interface SunniLibraryLevel {
  id: SunniLibraryLevelId
  title: string
  subtitle: string
  description: string
  quran: SunniLibraryQuranPlan
  recommendedDurationDays?: number | null
  colorKey: 'sky' | 'gold' | 'teal'
}

const QURAN_WARNING =
  'تنبيه: الحفظ الذاتي لا يكفي، يجب تسميع وردك اليومي لشيخ متقن ومجاز لضمان صحة التلاوة'

export const SUNNI_LIBRARY_LEVELS: SunniLibraryLevel[] = [
  {
    id: 'beginner',
    title: 'المبتدئ',
    subtitle: 'التأسيس الراسخ',
    description:
      'مسار تأسيسي يبني عادة الحفظ والمراجعة اليومية، ويضع الطالب على طريق التأصيل في العلوم الشرعية.',
    quran: {
      target: 'جزء عم وتبارك',
      memorizationDailyPages: 0.5,
      reviewDailyPages: 1,
      warning: QURAN_WARNING,
    },
    recommendedDurationDays: null,
    colorKey: 'sky',
  },
  {
    id: 'intermediate',
    title: 'المتوسط',
    subtitle: 'البناء العلمي',
    description:
      'مرحلة انتقالية تجمع بين التوسع في حفظ القرآن ودراسة المتون والشروح الأساسية في العلوم الشرعية.',
    quran: {
      target: 'سورتا البقرة وآل عمران',
      memorizationDailyPages: 1,
      reviewDailyPages: 3,
      warning: QURAN_WARNING,
    },
    recommendedDurationDays: null,
    colorKey: 'teal',
  },
  {
    id: 'advanced',
    title: 'المتقدم',
    subtitle: 'التأصيل والتمكن',
    description:
      'مسار متقدم للتوسع في بقية القرآن الكريم والكتب الأصولية والحديثية والسيرية مع تعدد المجلدات.',
    quran: {
      target: 'إتمام حفظ باقي القرآن الكريم',
      memorizationDailyPages: 2,
      reviewDailyPages: 10,
      warning: QURAN_WARNING,
    },
    recommendedDurationDays: null,
    colorKey: 'gold',
  },
]

/* -------------------------------------------------------------------------- */
/* مصادر النواة                                                                */
/* -------------------------------------------------------------------------- */

const source = (
  id: string,
  kind: SunniLibrarySourceKind,
  title: string,
  url: string,
  label: string,
  provider?: string,
  rightsStatus: SunniLibraryRightsStatus = 'verify-before-local-copy',
  notes?: string,
): SunniLibrarySource => ({
  id,
  kind,
  title,
  url,
  label,
  provider,
  rightsStatus,
  notes,
})

const youtubeConfig = (
  allowedScholars: string[],
  youtubePlaylistId: string | null = null,
): SunniLibraryVideoConfig => ({
  youtube_playlist_id: youtubePlaylistId,
  allowed_scholars: allowedScholars,
  sequential: true,
  playback_rate_locked: true,
  prevent_forward_seek: true,
  rewind_allowed: true,
})

const STANDARD_ALLOWED_SCHOLARS = [
  'محمد بن صالح العثيمين',
  'صالح الفوزان',
  'عبد الرزاق البدر',
  'صالح العصيمي',
  'سعد الشثري',
]

/* -------------------------------------------------------------------------- */
/* البرنامج الدراسي                                                            */
/* -------------------------------------------------------------------------- */

/**
 * ملاحظة:
 * - هذه قائمة المنهج المعتمدة لتكوين واجهة المكتبة.
 * - روابط PDF المباشرة وYouTube Playlist IDs تُترك قابلة للإدارة من Supabase.
 * - لا يتم افتراض أن أي ملف منشور على الإنترنت متاح لإعادة الاستضافة محليًا.
 */
export const SUNNI_LIBRARY_BOOKS: SunniLibraryBook[] = [
  /* ============================== المستوى الأول ========================== */

  // القرآن
  {
    id: 'quran-juz-amma-tabark-beginner',
    category: 'quran',
    title: 'برنامج حفظ جزئي عم وتبارك',
    author: 'منهج مصحف سميع',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'برنامج يومي لحفظ نصف وجه ومراجعة وجه واحد من المحفوظ القديم، مع متابعة يومية للإنجاز والتسميع.',
    readingLabel: 'فتح المصحف',
    rightsStatus: 'open-license',
    sourceNote:
      'المصدر الأساسي للحفظ هو مصحف سميع/مصدر المصحف المرئي المستخدم في التطبيق.',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
  },

  // التفسير
  {
    id: 'tafsir-mukhtasar-beginner',
    category: 'tafsir',
    title: 'المختصر في التفسير — شرح قصار السور',
    author: 'مجموعة علمية',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'مدخل مختصر لفهم معاني السور القصيرة بما يناسب مرحلة التأسيس.',
    readingLabel: 'مصدر القراءة',
    rightsStatus: 'verify-before-local-copy',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
  },

  // العقيدة
  {
    id: 'aq-usul-thalatha-beginner',
    category: 'aqidah',
    title: 'ثلاثة الأصول وأدلتها',
    author: 'محمد بن عبد الوهاب',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'متن تأسيسي في معرفة العبد ربه ودينه ونبيه ﷺ.',
    readingUrl: 'https://saleh.af.org.sa/ar/books?page=2',
    readingLabel: 'مصادر الشرح',
    sharhTitle: 'شرح ثلاثة الأصول',
    sharhAuthor: 'صالح آل الشيخ',
    sharhUrl: 'https://saleh.af.org.sa/ar/books?page=2',
    sharhLabel: 'شرح صالح آل الشيخ',
    textSource: source(
      'aq-usul-thalatha-beginner-text',
      'external',
      'مصدر الشرح والكتاب',
      'https://saleh.af.org.sa/ar/books?page=2',
      'فتح المصدر',
      'موقع صالح آل الشيخ',
    ),
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // الفقه
  {
    id: 'fiqh-shurut-salat-beginner',
    category: 'fiqh',
    title: 'شروط الصلاة وأركانها وواجباتها',
    author: 'منهج تأسيسي',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'مسار تأسيسي يركز على شروط الصلاة وأركانها وواجباتها وما يحتاجه المبتدئ في عبادته اليومية.',
    readingLabel: 'مادة المنهج',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // الحديث
  {
    id: 'hadith-arbaeen-beginner',
    category: 'hadith',
    title: 'الأربعون النووية',
    author: 'الإمام النووي',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'مجموعة أحاديث جامعة تصلح مدخلًا لتعلم جوامع السنة وأصول الدين.',
    readingUrl: 'https://hadithmv.gitlab.io/',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // اللغة
  {
    id: 'language-ajurrumiyyah-beginner',
    category: 'language',
    title: 'المقدمة الآجرومية',
    author: 'ابن آجروم',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'متن تأسيسي مختصر في النحو والإعراب، مناسب لبداية دراسة العربية.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // السيرة
  {
    id: 'seerah-miaiiyyah-beginner',
    category: 'seerah',
    title: 'الأرجوزة الميئية في ذكر حال أشرف البرية',
    author: 'ابن أبي العز',
    level: 'مبتدئ',
    levelId: 'beginner',
    description:
      'منظومة موجزة تسرد جانبًا من السيرة النبوية بصورة مناسبة للمرحلة الأولى.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  /* ============================== المستوى الثاني ========================= */

  // القرآن
  {
    id: 'quran-baqarah-imran-intermediate',
    category: 'quran',
    title: 'برنامج حفظ سورتي البقرة وآل عمران',
    author: 'منهج مصحف سميع',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'برنامج يومي لحفظ صفحة كاملة ومراجعة ثلاثة أوجه من المحفوظ القديم مع تتبع مستمر للإنجاز.',
    readingLabel: 'فتح المصحف',
    rightsStatus: 'open-license',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
  },

  // التفسير
  {
    id: 'tafsir-saadi-intermediate',
    category: 'tafsir',
    title: 'تفسير السعدي — تيسير الكريم الرحمن',
    author: 'عبد الرحمن بن ناصر السعدي',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'منهج متوسط لفهم تفسير القرآن ومعانيه بطريقة واضحة ومباشرة.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // العقيدة
  {
    id: 'aq-tawhid-intermediate',
    category: 'aqidah',
    title: 'كتاب التوحيد',
    author: 'محمد بن عبد الوهاب',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'كتاب في أبواب التوحيد والشرك ومسائل الاعتقاد المتعلقة بإفراد الله بالعبادة.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // الفقه
  {
    id: 'fiqh-manhaj-salikin-intermediate',
    category: 'fiqh',
    title: 'منهج السالكين وتوضيح الفقه في الدين',
    author: 'عبد الرحمن بن ناصر السعدي',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'مسار فقهي متوسط يوضح الأحكام بأسلوب موجز ومنظم.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // أصول الفقه
  {
    id: 'usul-fiqh-waraqat-intermediate',
    category: 'usul-fiqh',
    title: 'الورقات',
    author: 'إمام الحرمين الجويني',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'متن تأسيسي/متوسط في مبادئ أصول الفقه ومصطلحاته وقواعده.',
    readingUrl: 'https://sharh.qm.edu.sa/Courses/sharhalwaraqat/',
    readingLabel: 'الكتاب والشرح',
    sharhTitle: 'شرح الورقات',
    sharhAuthor: 'عبد المحسن بن محمد القاسم',
    sharhUrl: 'https://sharh.qm.edu.sa/Courses/sharhalwaraqat/',
    sharhLabel: 'الشرح المفرغ والصوتي',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // مصطلح الحديث
  {
    id: 'mustalah-bayquniyyah-intermediate',
    category: 'mustalah-hadith',
    title: 'المنظومة البيقونية',
    author: 'عمر بن محمد البيقوني',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'منظومة مختصرة في أصول مصطلح الحديث تناسب بناء الأساس العلمي في هذا الفن.',
    readingLabel: 'مصادر الشرح',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // السيرة
  {
    id: 'seerah-fusul-intermediate',
    category: 'seerah',
    title: 'الفصول في سيرة الرسول',
    author: 'ابن كثير',
    level: 'متوسط',
    levelId: 'intermediate',
    description:
      'مسار متوسط في السيرة النبوية والتدرج في قراءة أحداثها.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  /* ============================== المستوى الثالث ========================= */

  // القرآن
  {
    id: 'quran-rest-advanced',
    category: 'quran',
    title: 'برنامج إتمام حفظ باقي القرآن الكريم',
    author: 'منهج مصحف سميع',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'برنامج متقدم لحفظ وجهين يوميًا ومراجعة نصف جزء يوميًا حتى إتمام المقدار المستهدف.',
    readingLabel: 'فتح المصحف',
    rightsStatus: 'open-license',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
  },

  // التفسير
  {
    id: 'tafsir-mukhtasar-ibn-kathir-advanced',
    category: 'tafsir',
    title: 'مختصر تفسير ابن كثير',
    author: 'ابن كثير',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'قراءة تفسيرية متقدمة تتعامل مع مادة ابن كثير ضمن مسار أكثر توسعًا.',
    readingLabel: 'مصدر القراءة',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // العقيدة
  {
    id: 'aq-wasitiyyah-advanced',
    category: 'aqidah',
    title: 'العقيدة الواسطية',
    author: 'شيخ الإسلام ابن تيمية',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'متن عقدي ضمن مسار التأصيل والتمكن مع الاستفادة من الشروح العلمية المتخصصة.',
    readingUrl: 'https://usul.ai/ar/t/sharh-al-aqida-al-wasitiyya-1',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'شرح العقيدة الواسطية',
    sharhAuthor: 'محمد بن صالح العثيمين',
    sharhUrl: 'https://usul.ai/ar/t/sharh-al-aqida-al-wasitiyya-1',
    sharhLabel: 'شرح ابن عثيمين',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },
  {
    id: 'aq-tahawiyyah-advanced',
    category: 'aqidah',
    title: 'العقيدة الطحاوية',
    author: 'الإمام أبو جعفر الطحاوي',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'متن عقدي معتمد ضمن مسار متقدم، مع الاستفادة من الشروح المرتبطة به.',
    readingUrl:
      'https://www.islamweb.org/ar/library/index.php?ID=1&bk_no=106&idfrom=1&page=bookcontents',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'شرح العقيدة الطحاوية',
    sharhAuthor: 'ابن أبي العز الحنفي',
    sharhUrl:
      'https://www.islamweb.org/ar/library/index.php?ID=1&bk_no=106&idfrom=1&page=bookcontents',
    sharhLabel: 'شرح ابن أبي العز',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // أحاديث الأحكام
  {
    id: 'hadith-umdah-advanced',
    category: 'hadith',
    title: 'عمدة الأحكام',
    author: 'عبد الغني المقدسي',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'أحاديث مختارة في الأحكام الفقهية ضمن مسار متقدم في دراسة السنة وأدلتها.',
    readingUrl:
      'https://hadithmv.gitlab.io/books/HDT-umdathulAhkam.html',
    readingLabel: 'قراءة الكتاب',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },
  {
    id: 'hadith-bulugh-advanced',
    category: 'hadith',
    title: 'بلوغ المرام من أدلة الأحكام',
    author: 'الحافظ ابن حجر العسقلاني',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'جمع لأحاديث الأحكام مرتب على أبواب الفقه، ضمن مرحلة التأصيل المتقدم.',
    readingUrl:
      'https://hadithmv.gitlab.io/books/HDT-bulughulMaram.html',
    readingLabel: 'قراءة الكتاب',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // أصول الفقه والمقاصد
  {
    id: 'usul-fiqh-usul-min-ilm-advanced',
    category: 'usul-fiqh',
    title: 'الأصول من علم الأصول',
    author: 'محمد بن صالح العثيمين',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'كتاب/متن أصولي في مباحث الأحكام والأدلة والاجتهاد ضمن مسار التأصيل.',
    readingUrl: 'https://daralhadarah.net/gygQWDK',
    readingLabel: 'بيانات الكتاب',
    sharhTitle: 'شرح الأصول من علم الأصول',
    sharhAuthor: 'محمد بن صالح العثيمين',
    sharhUrl: 'https://www.youtube.com/watch?v=TaZGNlNnGpQ',
    sharhLabel: 'الشرح الصوتي الرسمي',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },
  {
    id: 'usul-fiqh-rawdah-advanced',
    category: 'usul-fiqh',
    title: 'روضة الناظر وجنة المناظر',
    author: 'ابن قدامة المقدسي',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'كتاب أصولي متقدم متعدد المجلدات؛ يُعرض في المكتبة كمجموعة مجلدات مستقلة مع تقدم منفصل لكل مجلد.',
    readingLabel: 'مصادر المجلدات',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    volumes: [
      {
        id: 'usul-fiqh-rawdah-advanced-v1',
        bookId: 'usul-fiqh-rawdah-advanced',
        volumeNumber: 1,
        rightsStatus: 'verify-before-local-copy',
      },
      {
        id: 'usul-fiqh-rawdah-advanced-v2',
        bookId: 'usul-fiqh-rawdah-advanced',
        volumeNumber: 2,
        rightsStatus: 'verify-before-local-copy',
      },
      {
        id: 'usul-fiqh-rawdah-advanced-v3',
        bookId: 'usul-fiqh-rawdah-advanced',
        volumeNumber: 3,
        rightsStatus: 'verify-before-local-copy',
      },
    ],
    rightsStatus: 'verify-before-local-copy',
  },

  // مصطلح الحديث
  {
    id: 'mustalah-nukhbah-advanced',
    category: 'mustalah-hadith',
    title: 'نخبة الفكر في مصطلح أهل الأثر',
    author: 'الحافظ ابن حجر العسقلاني',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'متن متقدم ومختصر في أصول مصطلح الحديث وقواعده.',
    readingUrl: 'https://usul.ai/ar/t/sharh-nukhbat-al-fikr',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'شرح نخبة الفكر',
    sharhAuthor: 'عبد الكريم الخضير',
    sharhUrl: 'https://usul.ai/ar/t/sharh-nukhbat-al-fikr',
    sharhLabel: 'شرح الخضير',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    rightsStatus: 'verify-before-local-copy',
  },

  // السيرة
  {
    id: 'seerah-zad-al-maad-advanced',
    category: 'seerah',
    title: 'زاد المعاد في هدي خير العباد',
    author: 'ابن القيم',
    level: 'متقدم',
    levelId: 'advanced',
    description:
      'كتاب سيرية/هدي نبوي متعدد المجلدات؛ يظهر كمجموعة مجلدات مع إدارة مستقلة لتقدم القراءة.',
    readingLabel: 'مصادر المجلدات',
    videoConfig: youtubeConfig(STANDARD_ALLOWED_SCHOLARS),
    volumes: [
      {
        id: 'seerah-zad-al-maad-advanced-v1',
        bookId: 'seerah-zad-al-maad-advanced',
        volumeNumber: 1,
        rightsStatus: 'verify-before-local-copy',
      },
      {
        id: 'seerah-zad-al-maad-advanced-v2',
        bookId: 'seerah-zad-al-maad-advanced',
        volumeNumber: 2,
        rightsStatus: 'verify-before-local-copy',
      },
      {
        id: 'seerah-zad-al-maad-advanced-v3',
        bookId: 'seerah-zad-al-maad-advanced',
        volumeNumber: 3,
        rightsStatus: 'verify-before-local-copy',
      },
      {
        id: 'seerah-zad-al-maad-advanced-v4',
        bookId: 'seerah-zad-al-maad-advanced',
        volumeNumber: 4,
        rightsStatus: 'verify-before-local-copy',
      },
      {
        id: 'seerah-zad-al-maad-advanced-v5',
        bookId: 'seerah-zad-al-maad-advanced',
        volumeNumber: 5,
        rightsStatus: 'verify-before-local-copy',
      },
    ],
    rightsStatus: 'verify-before-local-copy',
  },
]

/* -------------------------------------------------------------------------- */
/* فهارس سريعة                                                                   */
/* -------------------------------------------------------------------------- */

export const SUNNI_LIBRARY_LEVELS_BY_ID = Object.fromEntries(
  SUNNI_LIBRARY_LEVELS.map((level) => [level.id, level]),
) as Record<SunniLibraryLevelId, SunniLibraryLevel>

export const SUNNI_LIBRARY_BOOKS_BY_ID = Object.fromEntries(
  SUNNI_LIBRARY_BOOKS.map((book) => [book.id, book]),
) as Record<string, SunniLibraryBook>

export const SUNNI_LIBRARY_BOOKS_BY_LEVEL = Object.fromEntries(
  (['beginner', 'intermediate', 'advanced'] as SunniLibraryLevelId[]).map(
    (levelId) => [
      levelId,
      SUNNI_LIBRARY_BOOKS.filter((book) => book.levelId === levelId),
    ],
  ),
) as Record<SunniLibraryLevelId, SunniLibraryBook[]>

export const SUNNI_LIBRARY_BOOKS_BY_CATEGORY = Object.fromEntries(
  SUNNI_LIBRARY_CATEGORIES.map((category) => [
    category.id,
    SUNNI_LIBRARY_BOOKS.filter((book) => book.category === category.id),
  ]),
) as Record<SunniLibraryCategoryId, SunniLibraryBook[]>

/* -------------------------------------------------------------------------- */
/* Supabase-ready row shapes                                                    */
/* -------------------------------------------------------------------------- */

export interface LibraryLevelRow {
  id: string
  title: string
  subtitle: string
  description: string
  quran_target: string
  memorization_daily_pages: number
  review_daily_pages: number
  quran_warning: string
  recommended_duration_days: number | null
  color_key: string
  is_active: boolean
  sort_order: number
}

export interface LibrarySubjectRow {
  id: string
  category_id: string
  level_id: string
  title: string
  description: string
  icon_key: string | null
  sort_order: number
  is_active: boolean
}

export interface LibraryBookRow {
  id: string
  level_id: string
  category_id: string
  title: string
  author: string
  description: string
  reading_url: string | null
  reading_label: string | null
  sharh_title: string | null
  sharh_author: string | null
  sharh_url: string | null
  sharh_label: string | null
  youtube_playlist_id: string | null
  youtube_channel_url: string | null
  allowed_scholars: string[] | null
  rights_status: SunniLibraryRightsStatus
  quranpedia_book_id: number | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface LibraryVolumeRow {
  id: string
  book_id: string
  volume_number: number
  title: string | null
  pdf_url: string | null
  reading_url: string | null
  page_count: number | null
  source_label: string | null
  source_provider: string | null
  rights_status: SunniLibraryRightsStatus
  sort_order: number
}

export interface LibraryLessonRow {
  id: string
  book_id: string
  order_index: number
  title: string
  description: string | null
  duration_minutes: number | null
  youtube_video_id: string | null
  is_published: boolean
}

export interface LibraryProgressRow {
  id: string
  user_id: string
  level_id: string
  book_id: string | null
  lesson_id: string | null
  progress_percent: number
  last_position_seconds: number
  completed: boolean
  completed_at: string | null
  updated_at?: string
}

export interface LibraryQuranProgressRow {
  id: string
  user_id: string
  level_id: string
  target_label: string
  memorized_pages: number
  reviewed_pages: number
  memorization_target_pages_per_day: number
  review_target_pages_per_day: number
  current_streak_days: number
  best_streak_days: number
  last_activity_date: string | null
  updated_at?: string
}

export interface LibraryDailyHabitRow {
  id: string
  user_id: string
  level_id: string
  activity_date: string
  memorization_done: boolean
  memorization_pages: number
  review_done: boolean
  review_pages: number
  lessons_done: number
  note: string | null
  created_at?: string
}

export interface LibraryBookmarkRow {
  id: string
  user_id: string
  book_id: string | null
  volume_id: string | null
  lesson_id: string | null
  page_number: number | null
  anchor_key: string | null
  note: string | null
  created_at?: string
}

export interface LibraryNoteRow {
  id: string
  user_id: string
  book_id: string
  volume_id: string | null
  lesson_id: string | null
  title: string | null
  body: string
  created_at?: string
  updated_at?: string
}

export interface LibraryCertificateRow {
  id: string
  user_id: string
  level_id: string
  learner_name: string
  completion_percent: number
  quran_completion_percent: number
  issued_at: string
  certificate_number: string
  image_url: string | null
  pdf_url: string | null
}

/* -------------------------------------------------------------------------- */
/* Seed helpers: تحويل بيانات الواجهة إلى صفوف Supabase                         */
/* -------------------------------------------------------------------------- */

export const SUNNI_LIBRARY_LEVEL_ROWS: LibraryLevelRow[] =
  SUNNI_LIBRARY_LEVELS.map((level, index) => ({
    id: level.id,
    title: level.title,
    subtitle: level.subtitle,
    description: level.description,
    quran_target: level.quran.target,
    memorization_daily_pages: level.quran.memorizationDailyPages,
    review_daily_pages: level.quran.reviewDailyPages,
    quran_warning: level.quran.warning,
    recommended_duration_days: level.recommendedDurationDays ?? null,
    color_key: level.colorKey,
    is_active: true,
    sort_order: index + 1,
  }))

export const SUNNI_LIBRARY_BOOK_ROWS: LibraryBookRow[] =
  SUNNI_LIBRARY_BOOKS.map((book, index) => ({
    id: book.id,
    level_id: book.levelId,
    category_id: book.category,
    title: book.title,
    author: book.author,
    description: book.description,
    reading_url: book.readingUrl ?? null,
    reading_label: book.readingLabel ?? null,
    sharh_title: book.sharhTitle ?? null,
    sharh_author: book.sharhAuthor ?? null,
    sharh_url: book.sharhUrl ?? null,
    sharh_label: book.sharhLabel ?? null,
    youtube_playlist_id: book.videoConfig?.youtube_playlist_id ?? null,
    youtube_channel_url: book.videoConfig?.youtube_channel_url ?? null,
    allowed_scholars: book.videoConfig?.allowed_scholars ?? null,
    rights_status: book.rightsStatus ?? 'verify-before-local-copy',
    quranpedia_book_id: book.quranpediaBookId ?? null,
    sort_order: index + 1,
    is_active: true,
  }))

export const SUNNI_LIBRARY_VOLUME_ROWS: LibraryVolumeRow[] =
  SUNNI_LIBRARY_BOOKS.flatMap((book) =>
    (book.volumes ?? []).map((volume, index) => ({
      id: volume.id,
      book_id: volume.bookId,
      volume_number: volume.volumeNumber,
      title: volume.title ?? `المجلد ${volume.volumeNumber}`,
      pdf_url: volume.pdfUrl ?? null,
      reading_url: volume.readingUrl ?? null,
      page_count: volume.pageCount ?? null,
      source_label: volume.sourceLabel ?? null,
      source_provider: volume.sourceProvider ?? null,
      rights_status: volume.rightsStatus ?? 'verify-before-local-copy',
      sort_order: index + 1,
    })),
  )

export const SUNNI_LIBRARY_LESSON_ROWS: LibraryLessonRow[] =
  SUNNI_LIBRARY_BOOKS.flatMap((book) =>
    (book.lessons ?? []).map((lesson) => ({
      id: lesson.id,
      book_id: lesson.bookId,
      order_index: lesson.orderIndex,
      title: lesson.title,
      description: lesson.description ?? null,
      duration_minutes: lesson.durationMinutes ?? null,
      youtube_video_id: lesson.youtubeVideoId ?? null,
      is_published: true,
    })),
  )

/* -------------------------------------------------------------------------- */
/* أدوات العرض                                                                  */
/* -------------------------------------------------------------------------- */

export const getLibraryLevel = (levelId: SunniLibraryLevelId) =>
  SUNNI_LIBRARY_LEVELS_BY_ID[levelId]

export const getLibraryBooksForLevel = (levelId: SunniLibraryLevelId) =>
  SUNNI_LIBRARY_BOOKS_BY_LEVEL[levelId]

export const getLibraryBooksForCategory = (
  categoryId: SunniLibraryCategoryId,
) => SUNNI_LIBRARY_BOOKS_BY_CATEGORY[categoryId]

export const getLibraryBook = (bookId: string) =>
  SUNNI_LIBRARY_BOOKS_BY_ID[bookId] || null

export const getLibraryBookVolumeCount = (bookId: string) =>
  SUNNI_LIBRARY_BOOKS_BY_ID[bookId]?.volumes?.length || 0

export const getLibraryBookLessonCount = (bookId: string) =>
  SUNNI_LIBRARY_BOOKS_BY_ID[bookId]?.lessons?.length || 0
