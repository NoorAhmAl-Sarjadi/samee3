/** Public publisher catalogs; inclusion describes the recording's source. */
export const KHUTBAH_SCHOLARS = [
  { id: '452', name: 'أبو إسحاق الحويني' },
  { id: '451', name: 'محمد حسان' },
  { id: '773', name: 'مصطفى العدوي' },
  { id: '453', name: 'محمد حسين يعقوب' },
  { id: '159', name: 'عبد العزيز بن باز' },
  { id: '162', name: 'محمد بن صالح العثيمين' },
  { id: '235', name: 'صالح بن فوزان الفوزان' },
  { id: '165', name: 'محمد ناصر الدين الألباني' },
  { id: '317', name: 'عبد المحسن العباد' },
].map((scholar) => ({ ...scholar, sourceUrl: `https://audio.islamweb.net/audio/index.php?page=lecview&read=0&sid=${scholar.id}` }))
export type KhutbahScholar = typeof KHUTBAH_SCHOLARS[number]
export const LIBRARY_MEDIA_HOSTS = new Set([
  'quran.tv', 'ar.assabile.com', 'www.assabile.com',
  'lecture-h9afefaff7fjc2h3.z01.azurefd.net', 'audio.islamweb.net', 'audio.islamweb.org',
])
export function isLibraryMedia(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.port && !url.username && !url.password && LIBRARY_MEDIA_HOSTS.has(url.hostname) && /\.(mp3|m4a|ogg|wav|aac|opus)$/i.test(url.pathname) }
  catch { return false }
}
export function libraryAudioSource(value: string) { return isLibraryMedia(value) ? `/api/audio-proxy?url=${encodeURIComponent(value)}` : value }
export function decodeMediaText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_whole, code: string) => {
    const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1),16) : Number(code)
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
  }).replace(/\s+/g, ' ').trim()
}
export function parseScholarAudio(html: string, scholar: KhutbahScholar) {
  const found = new Map<string, { id: string; title: string; subtitle: string; audioUrl: string; authorName: string; section: 'khutbah'; sourceName: string; sourceUrl: string; downloadable: boolean; isSynthetic: boolean }>()
  // Each li owns its title and file: never guess attribution from adjacent markup.
  for (const match of html.matchAll(/<li\b[^>]*\bid=["']poem-line-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi)) {
    const [, id, card] = match
    const title = decodeMediaText(card.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '')
    const raw = card.match(/\bdata-file=["']([^"']+)["']/i)?.[1] || ''
    const audioUrl = decodeMediaText(raw)
    if (!title || !isLibraryMedia(audioUrl)) continue
    found.set(id, { id: `islamweb-${id}`, title, subtitle: 'خطب ومحاضرات ودروس', audioUrl, authorName: scholar.name, section: 'khutbah', sourceName: 'إسلام ويب', sourceUrl: `https://audio.islamweb.net/audio/index.php?page=audioinfo&audioid=${id}`, downloadable: true, isSynthetic: false })
  }
  return Array.from(found.values())
}
export const EXTRA_RUQYAH_ITEMS = [
  ['4','سعد الغامدي',342], ['33','ماهر المعيقلي',281], ['12','عبد الرحمن السديس',290], ['1','مشاري العفاسي',385],
  ['11','سعود الشريم',251], ['2','عبد الباسط عبد الصمد',400], ['52','ياسر الدوسري',376], ['13','أحمد العجمي',311],
].map(([id, name, duration]) => ({ id: `ruqyah-assabile-${id}`, title: 'آيات الرقية الشرعية', subtitle: String(name), authorName: String(name), audioUrl: `https://ar.assabile.com/media/roqya/${id}.mp3`, section: 'ruqyah' as const, sourceName: 'السبيل', sourceUrl: 'https://ar.assabile.com/ruqya', duration: Number(duration), downloadable: true, isSynthetic: false }))