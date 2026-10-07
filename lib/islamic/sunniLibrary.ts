export type SunniLibraryCategoryId =
  | 'aqidah'
  | 'fiqh'
  | 'seerah'
  | 'usul-tafsir'
  | 'usul-fiqh'
  | 'usul-hadith'

export type SunniLibraryLevel =
  | 'مبتدئ'
  | 'متوسط'
  | 'متقدم'

export interface SunniLibraryVideo {
  id: string
  title: string
  url: string
  order?: number
}

export interface SunniLibraryBook {
  id: string
  category: SunniLibraryCategoryId
  title: string
  author: string
  level: SunniLibraryLevel
  description: string

  readingUrl?: string
  readingLabel?: string

  sharhTitle?: string
  sharhAuthor?: string
  sharhUrl?: string
  sharhLabel?: string

  downloadUrl?: string

  videos?: SunniLibraryVideo[]

  quranpediaBookId?: number
}

export const SUNNI_LIBRARY_LEVELS: Array<{
  id: SunniLibraryLevel
  label: string
  short: string
  description: string
}> = [
  {
    id: 'مبتدئ',
    label: 'المستوى التمهيدي',
    short: 'بداية الطريق',
    description: 'كتب تأسيسية مناسبة لمن يبدأ طلب العلم الشرعي بصورة منظمة.',
  },
  {
    id: 'متوسط',
    label: 'المستوى المتوسط',
    short: 'بناء المعرفة',
    description: 'كتب توسع المعرفة وتربط الأصول بالتطبيق والدراسة المنهجية.',
  },
  {
    id: 'متقدم',
    label: 'المستوى المتقدم',
    short: 'التعمق والتخصص',
    description: 'كتب ومتون أعمق للطالب الذي تجاوز المرحلة التأسيسية.',
  },
]

export const SUNNI_LIBRARY_CATEGORIES: Array<{
  id: SunniLibraryCategoryId
  label: string
  short: string
}> = [
  {
    id: 'aqidah',
    label: 'العقيدة',
    short: 'أصول الاعتقاد',
  },
  {
    id: 'fiqh',
    label: 'الفقه',
    short: 'العبادات والمعاملات',
  },
  {
    id: 'seerah',
    label: 'السيرة',
    short: 'سيرة النبي ﷺ',
  },
  {
    id: 'usul-tafsir',
    label: 'أصول التفسير',
    short: 'قواعد فهم القرآن',
  },
  {
    id: 'usul-fiqh',
    label: 'أصول الفقه',
    short: 'أصول الاستنباط',
  },
  {
    id: 'usul-hadith',
    label: 'أصول الحديث',
    short: 'مصطلح الحديث وعلومه',
  },
]

/**
 * قائمة تحريرية أولية لكتب سنية مشهورة، وليست ادعاءً بإجماع العلماء على كل عنوان.
 * روابط القراءة/الشرح مأخوذة من مصادر تعليمية أو مكتبات رقمية موثوقة، ويُفضّل
 * لاحقًا إضافة مصدر رسمي/مرخّص لكل كتاب قبل أي نسخ محلي للنص.
 *
 * downloadUrl و videos اختياريان، ويمكن إدخالهما وإدارتهما من لوحة الإدارة.
 */
export const SUNNI_LIBRARY_BOOKS: SunniLibraryBook[] = [
  // =========================================================
  // العقيدة
  // =========================================================

  {
    id: 'aq-wasitiyyah',
    category: 'aqidah',
    title: 'العقيدة الواسطية',
    author: 'شيخ الإسلام ابن تيمية',
    level: 'متوسط',
    description:
      'متن مختصر في أصول عقيدة أهل السنة والجماعة في الأسماء والصفات وغيرها.',
    readingUrl:
      'https://usul.ai/ar/t/sharh-al-aqida-al-wasitiyya-1',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'شرح العقيدة الواسطية',
    sharhAuthor: 'محمد بن صالح العثيمين',
    sharhUrl:
      'https://usul.ai/ar/t/sharh-al-aqida-al-wasitiyya-1',
    sharhLabel: 'شرح ابن عثيمين',
  },

  {
    id: 'aq-tahawiyyah',
    category: 'aqidah',
    title: 'العقيدة الطحاوية',
    author: 'الإمام أبو جعفر الطحاوي',
    level: 'متوسط',
    description:
      'متن عقدي مشهور، ومعه شرح ابن أبي العز الدمشقي الحنفي.',
    readingUrl:
      'https://www.islamweb.org/ar/library/index.php?ID=1&bk_no=106&idfrom=1&page=bookcontents',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'شرح العقيدة الطحاوية',
    sharhAuthor: 'ابن أبي العز الحنفي',
    sharhUrl:
      'https://www.islamweb.org/ar/library/index.php?ID=1&bk_no=106&idfrom=1&page=bookcontents',
    sharhLabel: 'شرح ابن أبي العز',
  },

  {
    id: 'aq-lumat',
    category: 'aqidah',
    title: 'لمعة الاعتقاد',
    author: 'ابن قدامة المقدسي',
    level: 'مبتدئ',
    description:
      'رسالة مختصرة في أبواب الاعتقاد ومسائل الأسماء والصفات والإيمان.',
    readingUrl:
      'https://islamhouse.com/ar/books/313434/',
    readingLabel: 'الكتاب والشرح',
    sharhTitle: 'شرح لمعة الاعتقاد',
    sharhAuthor: 'صالح آل الشيخ',
    sharhUrl:
      'https://islamhouse.com/ar/books/313434/',
    sharhLabel: 'شرح صالح آل الشيخ',
  },

  {
    id: 'aq-usul-thalatha',
    category: 'aqidah',
    title: 'الأصول الثلاثة وأدلتها',
    author: 'محمد بن عبد الوهاب',
    level: 'مبتدئ',
    description:
      'متن تأسيسي في معرفة العبد ربه ودينه ونبيه ﷺ.',
    readingUrl:
      'https://saleh.af.org.sa/ar/books?page=2',
    readingLabel: 'مصادر الشرح',
    sharhTitle: 'شرح ثلاثة الأصول',
    sharhAuthor: 'صالح آل الشيخ',
    sharhUrl:
      'https://saleh.af.org.sa/ar/books?page=2',
    sharhLabel: 'شرح صالح آل الشيخ',
  },

  {
    id: 'aq-qawaid-arbaa',
    category: 'aqidah',
    title: 'القواعد الأربع',
    author: 'محمد بن عبد الوهاب',
    level: 'مبتدئ',
    description:
      'رسالة قصيرة في تقرير أصل التوحيد والتمييز بين التوحيد والشرك.',
    readingUrl:
      'https://saleh.af.org.sa/ar/node/1423',
    readingLabel: 'الشرح الرسمي',
    sharhTitle: 'شرح القواعد الأربع',
    sharhAuthor: 'صالح آل الشيخ',
    sharhUrl:
      'https://saleh.af.org.sa/ar/node/1423',
    sharhLabel: 'شرح صالح آل الشيخ',
  },

  // =========================================================
  // الفقه
  // =========================================================

  {
    id: 'fiqh-zad',
    category: 'fiqh',
    title: 'زاد المستقنع',
    author: 'موسى الحجاوي',
    level: 'متقدم',
    description:
      'متن فقهي حنبلي مشهور، وتوجد له شروح كاملة مسموعة ومفرغة.',
    readingUrl:
      'https://usul.ai/ar/t/al-sharh-al-sawti-li-zad-al-mustaqni',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'الشرح الصوتي لزاد المستقنع',
    sharhAuthor: 'محمد بن صالح العثيمين',
    sharhUrl:
      'https://usul.ai/ar/t/al-sharh-al-sawti-li-zad-al-mustaqni',
    sharhLabel: 'شرح ابن عثيمين',
  },

  {
    id: 'fiqh-mulakhkhas',
    category: 'fiqh',
    title: 'الملخص الفقهي',
    author: 'صالح بن فوزان الفوزان',
    level: 'مبتدئ',
    description:
      'عرض موجز لأبواب الفقه مقرون بالأدلة من الكتاب والسنة.',
    readingUrl:
      'https://islamhouse.com/ar/books/2089/',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'دروس وشروحات على أبواب الكتاب',
    sharhAuthor: 'مشايخ وطلاب علم سنية من مصادر موثقة',
    sharhUrl:
      'https://www.mimham.net/mat-122',
    sharhLabel: 'الشروحات المسموعة',
  },

  {
    id: 'fiqh-bulugh',
    category: 'fiqh',
    title: 'بلوغ المرام من أدلة الأحكام',
    author: 'الحافظ ابن حجر العسقلاني',
    level: 'متوسط',
    description:
      'جمع لأحاديث الأحكام مع ترتيبها على أبواب الفقه.',
    readingUrl:
      'https://hadithmv.gitlab.io/books/HDT-bulughulMaram.html',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'شروح بلوغ المرام',
    sharhAuthor: 'عبد المحسن القاسم وغيرُه من أهل العلم',
    sharhUrl:
      'https://a-alqasim.com/books-cats/explanations/',
    sharhLabel: 'مصادر الشرح',
  },

  {
    id: 'fiqh-umdah',
    category: 'fiqh',
    title: 'عمدة الأحكام',
    author: 'عبد الغني المقدسي',
    level: 'مبتدئ',
    description:
      'أحاديث مختارة في الأحكام الفقهية، مناسبة للتدرج في فقه السنة.',
    readingUrl:
      'https://hadithmv.gitlab.io/books/HDT-umdathulAhkam.html',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'شروح عمدة الأحكام',
    sharhAuthor: 'شروح علمية متعددة',
    sharhUrl:
      'https://hadithmv.gitlab.io/books/HDT-umdathulAhkam.html',
    sharhLabel: 'عرض الشروح والمصادر',
  },

  // =========================================================
  // السيرة
  // =========================================================

  {
    id: 'seerah-raheeq',
    category: 'seerah',
    title: 'الرحيق المختوم',
    author: 'صفي الرحمن المباركفوري',
    level: 'مبتدئ',
    description:
      'بحث مرتب في السيرة النبوية، مع ترتيب زمني واضح للأحداث.',
    readingUrl:
      'https://usul.ai/ar/t/ar-raheeq-al-makhtum',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'التعليق على الرحيق المختوم',
    sharhAuthor: 'محمود الملاح',
    sharhUrl:
      'https://usul.ai/ar/t/commentary-on-the-sealed-nectar',
    sharhLabel: 'التعليق والشرح',
  },

  {
    id: 'seerah-raheeq-official',
    category: 'seerah',
    title: 'الرحيق المختوم — طبعات حديثة',
    author: 'صفي الرحمن المباركفوري',
    level: 'مبتدئ',
    description:
      'معلومات الطبعات الحديثة وبيانات الكتاب من دور نشر معروفة.',
    readingUrl:
      'https://ibn-katheer.com/Book/detBooks/20/129/index.php',
    readingLabel: 'بيانات الطبعة',
    sharhTitle: 'مصادر إضافية للسيرة',
    sharhAuthor: 'مصادر علمية سنية',
    sharhUrl:
      'https://usul.ai/ar/t/ar-raheeq-al-makhtum',
    sharhLabel: 'فتح الكتاب',
  },

  {
    id: 'seerah-index',
    category: 'seerah',
    title: 'مناهج قراءة السيرة ومصادرها',
    author: 'مجموعة من مصادر السيرة المحققة',
    level: 'متقدم',
    description:
      'مسار داخل المكتبة للوصول إلى المصادر الأصلية والشروح والتعليقات.',
    readingUrl:
      'https://usul.ai/ar/t/ar-raheeq-al-makhtum',
    readingLabel: 'ابدأ من الرحيق المختوم',
    sharhTitle: 'التعليق على الرحيق المختوم',
    sharhAuthor: 'محمود الملاح',
    sharhUrl:
      'https://usul.ai/ar/t/commentary-on-the-sealed-nectar',
    sharhLabel: 'التعليق',
  },

  // =========================================================
  // أصول التفسير
  // =========================================================

  {
    id: 'usul-tafsir-muqaddimah',
    category: 'usul-tafsir',
    title: 'مقدمة في أصول التفسير',
    author: 'شيخ الإسلام ابن تيمية',
    level: 'متوسط',
    description:
      'من أشهر المداخل المختصرة في أصول التفسير وضوابط فهم كلام الله.',
    readingUrl:
      'https://quranpedia.net/book/280',
    readingLabel: 'قراءة وشرح',
    sharhTitle: 'شرح مقدمة في أصول التفسير',
    sharhAuthor: 'محمد بن صالح العثيمين',
    sharhUrl:
      'https://quranpedia.net/book/280',
    sharhLabel: 'شرح ابن عثيمين',
  },

  {
    id: 'usul-tafsir-qawaid',
    category: 'usul-tafsir',
    title: 'مختصر قواعد التفسير',
    author: 'خالد بن عثمان السبت',
    level: 'متوسط',
    description:
      'مختصر يضم قواعد مهمة لفهم النص القرآني وضبط عملية التفسير.',
    readingUrl:
      'https://quranpedia.net/book/15493',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'مختارات من قواعد التفسير',
    sharhAuthor: 'خالد بن عثمان السبت',
    sharhUrl:
      'https://khaledalsabt.com/series/category/46/%D9%85%D8%AE%D8%AA%D8%A7%D8%B1%D8%A7%D8%AA-%D9%85%D9%86-%D9%82%D9%88%D8%A7%D8%B9%D8%AF-%D8%A7%D9%84%D8%AA%D9%81%D8%B3%D9%8A%D8%B1',
    sharhLabel: 'الدروس الرسمية',
  },

  {
    id: 'usul-tafsir-rumi',
    category: 'usul-tafsir',
    title: 'أصول التفسير ومناهجه',
    author: 'فهد بن عبد الرحمن الرومي',
    level: 'متقدم',
    description:
      'دراسة منهجية في أصول التفسير ومناهجه واتجاهاته.',
    readingUrl:
      'https://www.aljam3.com/ar/17818/38327/1',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'عرض وتقويم علمي',
    sharhAuthor: 'مركز تفسير للدراسات القرآنية',
    sharhUrl:
      'https://www.tafsir.sa/article/5365/ktab-aswl-at-tfsyr-wmnahjh-lldktwr-fhd-bn-abd-ar-rhmn-al-rwmy-ard-wtqwym',
    sharhLabel: 'عرض علمي',
  },

  // =========================================================
  // أصول الفقه
  // =========================================================

  {
    id: 'usul-fiqh-waraqat',
    category: 'usul-fiqh',
    title: 'الورقات',
    author: 'إمام الحرمين الجويني',
    level: 'مبتدئ',
    description:
      'متن تأسيسي مشهور في مبادئ أصول الفقه.',
    readingUrl:
      'https://sharh.qm.edu.sa/Courses/sharhalwaraqat/',
    readingLabel: 'الكتاب والشرح',
    sharhTitle: 'شرح الورقات',
    sharhAuthor: 'عبد المحسن بن محمد القاسم',
    sharhUrl:
      'https://sharh.qm.edu.sa/Courses/sharhalwaraqat/',
    sharhLabel: 'الشرح المفرغ والصوتي',
  },

  {
    id: 'usul-fiqh-usul',
    category: 'usul-fiqh',
    title: 'الأصول من علم الأصول',
    author: 'محمد بن صالح العثيمين',
    level: 'مبتدئ',
    description:
      'متن/كتاب تعليمي مختصر يؤصل مباحث أصول الفقه للمبتدئ، مع تقسيم واضح لأبواب الأحكام والأدلة والاجتهاد.',
    readingUrl:
      'https://daralhadarah.net/gygQWDK',
    readingLabel: 'بيانات الكتاب',
    sharhTitle: 'شرح الأصول من علم الأصول',
    sharhAuthor: 'محمد بن صالح العثيمين',
    sharhUrl:
      'https://www.youtube.com/watch?v=TaZGNlNnGpQ',
    sharhLabel: 'الشرح الصوتي الرسمي',
  },

  {
    id: 'usul-fiqh-waraqat-extra',
    category: 'usul-fiqh',
    title: 'الورقات — شروح وتدرج علمي',
    author: 'إمام الحرمين الجويني',
    level: 'متوسط',
    description:
      'متن أصولي مشهور، مع برنامج شرح منظم يجمع الشرح المفرغ والصوتي.',
    readingUrl:
      'https://sharh.qm.edu.sa/Courses/sharhalwaraqat/',
    readingLabel: 'قراءة المتن والشرح',
    sharhTitle: 'شرح الورقات',
    sharhAuthor: 'عبد المحسن بن محمد القاسم',
    sharhUrl:
      'https://sharh.qm.edu.sa/Courses/sharhalwaraqat/',
    sharhLabel: 'الشرح المفرغ والصوتي',
  },

  // =========================================================
  // أصول الحديث
  // =========================================================

  {
    id: 'usul-hadith-nukhbah',
    category: 'usul-hadith',
    title: 'نخبة الفكر في مصطلح أهل الأثر',
    author: 'الحافظ ابن حجر العسقلاني',
    level: 'متوسط',
    description:
      'متن مختصر جامع لأبواب أساسية في مصطلح الحديث.',
    readingUrl:
      'https://usul.ai/ar/t/sharh-nukhbat-al-fikr',
    readingLabel: 'قراءة الشرح',
    sharhTitle: 'شرح نخبة الفكر',
    sharhAuthor: 'عبد الكريم الخضير',
    sharhUrl:
      'https://usul.ai/ar/t/sharh-nukhbat-al-fikr',
    sharhLabel: 'شرح الخضير',
  },

  {
    id: 'usul-hadith-bayquniyyah',
    category: 'usul-hadith',
    title: 'منظومة البيقونية',
    author: 'عمر بن محمد البيقوني',
    level: 'مبتدئ',
    description:
      'من أشهر المنظومات المختصرة للمبتدئ في مصطلح الحديث.',
    readingUrl:
      'https://a-alqasim.com/books-cats/explanations/',
    readingLabel: 'مصادر الشرح',
    sharhTitle: 'شرح منظومة البيقونية',
    sharhAuthor: 'عبد المحسن القاسم',
    sharhUrl:
      'https://a-alqasim.com/books-cats/explanations/',
    sharhLabel: 'شرح القاسم',
  },

  {
    id: 'usul-hadith-taysir',
    category: 'usul-hadith',
    title: 'تيسير مصطلح الحديث',
    author: 'محمود الطحان',
    level: 'مبتدئ',
    description:
      'كتاب تعليمي مبسط في مصطلح الحديث، يمر على الخبر والرواية والإسناد والجرح والتعديل.',
    readingUrl:
      'https://usul.ai/ar/t/tayseer-mustalah-al-hadith',
    readingLabel: 'قراءة الكتاب',
    sharhTitle: 'شرح وتدريس الكتاب',
    sharhAuthor: 'مصادر تعليمية متخصصة في علم الحديث',
    sharhUrl:
      'https://www.dar-alhadith.com/show_book/10',
    sharhLabel: 'مصدر تدريسي',
  },
]

export const SUNNI_LIBRARY_BOOKS_BY_CATEGORY =
  Object.fromEntries(
    SUNNI_LIBRARY_CATEGORIES.map((category) => [
      category.id,
      SUNNI_LIBRARY_BOOKS.filter(
        (book) => book.category === category.id
      ),
    ])
  ) as Record<
    SunniLibraryCategoryId,
    SunniLibraryBook[]
  >

export const SUNNI_LIBRARY_BOOKS_BY_LEVEL =
  Object.fromEntries(
    SUNNI_LIBRARY_LEVELS.map((level) => [
      level.id,
      SUNNI_LIBRARY_BOOKS.filter(
        (book) => book.level === level.id
      ),
    ])
  ) as Record<
    SunniLibraryLevel,
    SunniLibraryBook[]
  >

export function getSunniLibraryBook(
  id: string
): SunniLibraryBook | null {
  return (
    SUNNI_LIBRARY_BOOKS.find(
      (book) => book.id === id
    ) || null
  )
}

export function getSunniLibraryCategory(
  id: SunniLibraryCategoryId
) {
  return (
    SUNNI_LIBRARY_CATEGORIES.find(
      (category) => category.id === id
    ) || null
  )
}

export function getSunniLibraryLevel(
  level: SunniLibraryLevel
) {
  return (
    SUNNI_LIBRARY_LEVELS.find(
      (item) => item.id === level
    ) || null
  )
}
