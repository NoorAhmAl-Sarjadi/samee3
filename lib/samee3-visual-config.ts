export type SurahInfo = { id: number; name: string; count: number }
export type Verse = { number: number; text: string }
export type ReaderInfo = { id: string; name: string }

export type FontOption = {
  id: string
  name: string
  family: string
  kind: 'quran' | 'ui'
}

export type FrameStyle =
  | 'classic'
  | 'double'
  | 'rounded'
  | 'glow'
  | 'corners'
  | 'top-bottom'

export type PanelStyle = 'glass' | 'solid' | 'gradient' | 'outline' | 'none'

export type VideoRatio = '9:16' | '1:1' | '16:9'

export type VideoDesign = {
  ratio: VideoRatio
  quality: 720 | 1080
  shade: number
  textColor: string
  signature: string
  fontScale: number
  quranFontId: string
  uiFontId: string
  frameStyle: FrameStyle
  frameColor: string
  frameWidth: number
  panelStyle: PanelStyle
  panelColor: string
  panelOpacity: number
  overlayColor: string
  overlayOpacity: number
  titleColor: string
  readerColor: string
  signatureColor: string
  cornerRadius: number
}

export type TemplatePreset = {
  id: string
  name: string
  category: string
  description: string
  design: Partial<VideoDesign>
}

export const READERS: ReaderInfo[] = [
  { id: 'husary', name: 'محمود خليل الحصري' },
  { id: 'afasy', name: 'مشاري راشد العفاسي' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي' },
  { id: 'basit', name: 'عبد الباسط عبد الصمد' },
  { id: 'maher', name: 'ماهر المعيقلي' },
  { id: 'sudais', name: 'عبد الرحمن السديس' },
]

const SURAHS = "الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس".split('|')
const COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]

export const FALLBACK_SURAHS: SurahInfo[] = SURAHS.map((name, index) => ({
  id: index + 1,
  name,
  count: COUNTS[index],
}))

export const MAX_AYAH_COUNT = 10
export const MAX_DURATION_SECONDS = 90
export const MAX_BACKGROUND_BYTES = 40 * 1024 * 1024

export const FONT_OPTIONS: FontOption[] = [
  { id: 'amiri-quran', name: 'Amiri Quran', family: '"Amiri Quran", Amiri, serif', kind: 'quran' },
  { id: 'amiri', name: 'Amiri', family: 'Amiri, serif', kind: 'quran' },
  { id: 'tajawal', name: 'Tajawal', family: 'Tajawal, sans-serif', kind: 'ui' },
  { id: 'cairo', name: 'Cairo', family: 'Cairo, sans-serif', kind: 'ui' },
  { id: 'aref-ruqaa', name: 'Aref Ruqaa', family: '"Aref Ruqaa", serif', kind: 'quran' },
  { id: 'scheherazade', name: 'Scheherazade New', family: '"Scheherazade New", serif', kind: 'quran' },
  { id: 'noto-naskh', name: 'Noto Naskh Arabic', family: '"Noto Naskh Arabic", serif', kind: 'quran' },
  { id: 'noto-kufi', name: 'Noto Kufi Arabic', family: '"Noto Kufi Arabic", sans-serif', kind: 'ui' },
  { id: 'markazi', name: 'Markazi Text', family: '"Markazi Text", serif', kind: 'quran' },
  { id: 'lateef', name: 'Lateef', family: 'Lateef, serif', kind: 'quran' },
  { id: 'almarai', name: 'Almarai', family: 'Almarai, sans-serif', kind: 'ui' },
  { id: 'alexandria', name: 'Alexandria', family: 'Alexandria, sans-serif', kind: 'ui' },
  { id: 'el-messiri', name: 'El Messiri', family: '"El Messiri", sans-serif', kind: 'ui' },
  { id: 'reem-kufi', name: 'Reem Kufi', family: '"Reem Kufi", sans-serif', kind: 'ui' },
  { id: 'ibm-plex-arabic', name: 'IBM Plex Sans Arabic', family: '"IBM Plex Sans Arabic", sans-serif', kind: 'ui' },
  { id: 'georgia-arabic', name: 'Georgia Arabic', family: 'Georgia, serif', kind: 'quran' },
  { id: 'arial-arabic', name: 'Arial Arabic', family: 'Arial, sans-serif', kind: 'ui' },
  { id: 'system-serif', name: 'System Serif', family: 'serif', kind: 'quran' },
  { id: 'system-sans', name: 'System Sans', family: 'sans-serif', kind: 'ui' },
  { id: 'times-arabic', name: 'Times Arabic', family: '"Times New Roman", serif', kind: 'quran' },
]

export const DEFAULT_VIDEO_DESIGN: VideoDesign = {
  ratio: '9:16',
  quality: 720,
  shade: 40,
  textColor: '#fff9ec',
  signature: 'مصحف سميع',
  fontScale: 1,
  quranFontId: 'amiri-quran',
  uiFontId: 'tajawal',
  frameStyle: 'classic',
  frameColor: '#e3bf74',
  frameWidth: 2,
  panelStyle: 'glass',
  panelColor: '#091917',
  panelOpacity: 34,
  overlayColor: '#000000',
  overlayOpacity: 0,
  titleColor: '#f0d39b',
  readerColor: '#f1dfb9',
  signatureColor: '#d9bc81',
  cornerRadius: 26,
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: 't1', name: 'ذهبي كلاسيكي', category: 'رسمي', description: 'إطار ذهبي ولوحة زجاجية', design: { frameStyle: 'classic', frameColor: '#e3bf74', panelStyle: 'glass', panelColor: '#0a1817', panelOpacity: 34, titleColor: '#f0d39b', readerColor: '#f1dfb9', signatureColor: '#d9bc81', quranFontId: 'amiri-quran', uiFontId: 'tajawal' } },
  { id: 't2', name: 'مصحف فاخر', category: 'رسمي', description: 'حد مزدوج وهدوء بصري', design: { frameStyle: 'double', frameColor: '#d8b56e', frameWidth: 2, panelStyle: 'glass', panelColor: '#0e1816', panelOpacity: 30, quranFontId: 'scheherazade', uiFontId: 'cairo' } },
  { id: 't3', name: 'نوراني', category: 'رسمي', description: 'إطار مضيء خفيف', design: { frameStyle: 'glow', frameColor: '#f5d68d', panelStyle: 'gradient', panelColor: '#081412', panelOpacity: 28, textColor: '#fffbf3', quranFontId: 'amiri-quran', uiFontId: 'alexandria' } },
  { id: 't4', name: 'زجاج ناعم', category: 'هادئ', description: 'لوحة شفافة ناعمة', design: { frameStyle: 'rounded', panelStyle: 'glass', panelColor: '#0b1c18', panelOpacity: 26, frameColor: '#d9c08f', quranFontId: 'markazi', uiFontId: 'tajawal' } },
  { id: 't5', name: 'وردي هادئ', category: 'ورود', description: 'مناسب لخلفيات الزهور', design: { frameColor: '#e6c0bf', titleColor: '#f3dfd8', readerColor: '#f3dfd8', signatureColor: '#d9b1af', panelStyle: 'glass', panelColor: '#1b1112', panelOpacity: 28, quranFontId: 'lateef', uiFontId: 'cairo' } },
  { id: 't6', name: 'مائي أزرق', category: 'مياه', description: 'مناسب للأمواج والجداول', design: { frameColor: '#9fd7e1', titleColor: '#d6f5fa', readerColor: '#d6f5fa', signatureColor: '#9ad2da', panelStyle: 'solid', panelColor: '#06171a', panelOpacity: 45, quranFontId: 'amiri', uiFontId: 'almarai' } },
  { id: 't7', name: 'سحابي فاتح', category: 'سماء', description: 'لمسة بيضاء ذهبية', design: { frameColor: '#e7e2cf', titleColor: '#fff7e8', readerColor: '#fff7e8', signatureColor: '#d8c6a1', panelStyle: 'outline', panelColor: '#ffffff', panelOpacity: 18, quranFontId: 'scheherazade', uiFontId: 'alexandria' } },
  { id: 't8', name: 'فخم داكن', category: 'رسمي', description: 'لوحة عميقة وإطار واضح', design: { frameStyle: 'double', frameColor: '#cfa65d', panelStyle: 'solid', panelColor: '#07110f', panelOpacity: 52, quranFontId: 'amiri-quran', uiFontId: 'ibm-plex-arabic' } },
  { id: 't9', name: 'ركني', category: 'حديث', description: 'زوايا فقط', design: { frameStyle: 'corners', frameColor: '#edca87', frameWidth: 3, panelStyle: 'glass', panelColor: '#101615', panelOpacity: 32, quranFontId: 'noto-naskh', uiFontId: 'tajawal' } },
  { id: 't10', name: 'أنيق بسيط', category: 'حديث', description: 'خطوط علوية وسفلية', design: { frameStyle: 'top-bottom', frameColor: '#e2c585', panelStyle: 'none', quranFontId: 'markazi', uiFontId: 'system-sans' } },
  { id: 't11', name: 'كوفي حديث', category: 'حديث', description: 'واجهة عربية حديثة', design: { quranFontId: 'noto-kufi', uiFontId: 'noto-kufi', frameStyle: 'rounded', frameColor: '#d9c490', panelStyle: 'solid', panelColor: '#0c1615', panelOpacity: 40 } },
  { id: 't12', name: 'قاهري', category: 'حديث', description: 'قوي وواضح', design: { quranFontId: 'amiri-quran', uiFontId: 'cairo', frameColor: '#e4c37e', panelStyle: 'glass', panelOpacity: 36 } },
  { id: 't13', name: 'تجويد', category: 'رسمي', description: 'خط قرآني بارز', design: { quranFontId: 'amiri-quran', uiFontId: 'aref-ruqaa', fontScale: 1.08, panelStyle: 'gradient', panelColor: '#101513', panelOpacity: 34 } },
  { id: 't14', name: 'أخضر إيماني', category: 'طبيعة', description: 'لون أخضر مع ذهب', design: { frameColor: '#b8d6a2', titleColor: '#eef8dd', readerColor: '#eef8dd', signatureColor: '#b8d6a2', panelColor: '#0b1710', panelOpacity: 34, quranFontId: 'amiri', uiFontId: 'el-messiri' } },
  { id: 't15', name: 'ليل ساكن', category: 'طبيعة', description: 'مناسب للسماء والليل', design: { frameColor: '#c3b3ff', titleColor: '#ede9ff', readerColor: '#ede9ff', signatureColor: '#c3b3ff', panelColor: '#090912', panelOpacity: 42, quranFontId: 'times-arabic', uiFontId: 'alexandria' } },
  { id: 't16', name: 'ثلجي', category: 'شتاء', description: 'ألوان باردة هادئة', design: { frameColor: '#b9dff3', titleColor: '#eef9ff', readerColor: '#eef9ff', signatureColor: '#b9dff3', panelColor: '#091116', panelOpacity: 33, quranFontId: 'noto-naskh', uiFontId: 'ibm-plex-arabic' } },
  { id: 't17', name: 'مخملي', category: 'ورود', description: 'ألوان دافئة ناعمة', design: { frameColor: '#e8b7aa', titleColor: '#ffe7df', readerColor: '#ffe7df', signatureColor: '#e8b7aa', panelColor: '#190d0d', panelOpacity: 39, quranFontId: 'lateef', uiFontId: 'aref-ruqaa' } },
  { id: 't18', name: 'مسجدي', category: 'رسمي', description: 'تقليدي مريح للقراءة', design: { frameStyle: 'double', frameColor: '#ddc07d', panelStyle: 'solid', panelColor: '#101814', panelOpacity: 48, quranFontId: 'scheherazade', uiFontId: 'almarai' } },
  { id: 't19', name: 'هادئ بلا إطار', category: 'بسيط', description: 'تركيز كامل على النص', design: { frameStyle: 'top-bottom', frameWidth: 1, frameColor: '#e7cf98', panelStyle: 'none', quranFontId: 'amiri-quran', uiFontId: 'system-sans' } },
  { id: 't20', name: 'تخصيص كامل', category: 'مخصص', description: 'ابدأ منه ثم عدّل كل شيء', design: { frameStyle: 'rounded', frameColor: '#e3bf74', panelStyle: 'glass', panelColor: '#071311', panelOpacity: 30, overlayColor: '#000000', overlayOpacity: 0, quranFontId: 'amiri-quran', uiFontId: 'tajawal' } },
]

export function fontById(id: string) {
  return FONT_OPTIONS.find(item => item.id === id) || FONT_OPTIONS[0]
}